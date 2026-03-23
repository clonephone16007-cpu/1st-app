import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useTimerStore = create(
  persist(
    (set) => ({
      running: false,
      paused: false,
      elapsed: 0,
      target: 0,
      mode: 'focus',
      subject: 'Math',
      startedAt: null, // timestamp when timer was started — used to recover on refresh

      start: (target, mode, subject) => set({
        running: true,
        paused: false,
        elapsed: 0,
        target,
        mode,
        subject,
        startedAt: Date.now(),
      }),
      pause: () => set({ paused: true }),
      resume: () => set({ paused: false }),
      stop: () => set({ running: false, paused: false, elapsed: 0, startedAt: null }),
      setMode: (mode) => set({ mode }),
      setSubject: (subject) => set({ subject }),
      tick: () => set((state) => {
        if (state.running && !state.paused) {
          return { elapsed: state.elapsed + 1 };
        }
        return state;
      }),

      // On rehydration: if we were running, compute elapsed from startedAt
      rehydrate: () => set((state) => {
        if (state.running && state.startedAt) {
          const secondsSinceStart = Math.floor((Date.now() - state.startedAt) / 1000);
          // If target was set and we've exceeded it, cap at target
          const newElapsed = state.target > 0
            ? Math.min(secondsSinceStart, state.target)
            : secondsSinceStart;
          return { elapsed: newElapsed, paused: true }; // Auto-pause on refresh
        }
        return state;
      }),
    }),
    {
      name: 'examhq-timer',
      partialize: (state) => ({
        running: state.running,
        paused: state.paused,
        elapsed: state.elapsed,
        target: state.target,
        mode: state.mode,
        subject: state.subject,
        startedAt: state.startedAt,
      }),
    }
  )
);
