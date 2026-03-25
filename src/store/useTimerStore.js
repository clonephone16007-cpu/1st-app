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
      startedAt: null,      // wall-clock ms when timer last (re)started
      pausedAt: null,       // wall-clock ms when paused
      pausedDuration: 0,    // total ms spent paused so far

      start: (target, mode, subject) => set({
        running: true,
        paused: false,
        elapsed: 0,
        target,
        mode,
        subject,
        startedAt: Date.now(),
        pausedAt: null,
        pausedDuration: 0,
      }),

      pause: () => set((state) => ({
        paused: true,
        pausedAt: Date.now(),
        // snapshot elapsed so resume can offset correctly
        elapsed: state.startedAt
          ? Math.floor((Date.now() - state.startedAt - (state.pausedDuration || 0)) / 1000)
          : state.elapsed,
      })),

      resume: () => set((state) => {
        const additionalPause = state.pausedAt ? Date.now() - state.pausedAt : 0;
        return {
          paused: false,
          pausedAt: null,
          pausedDuration: (state.pausedDuration || 0) + additionalPause,
        };
      }),

      stop: () => set({
        running: false,
        paused: false,
        elapsed: 0,
        startedAt: null,
        pausedAt: null,
        pausedDuration: 0,
      }),

      setMode: (mode) => set({ mode }),
      setSubject: (subject) => set({ subject }),

      // Called every second by setInterval — uses wall clock so background tabs auto-catch-up
      tick: () => set((state) => {
        if (!state.running || state.paused || !state.startedAt) return state;
        const elapsed = Math.floor((Date.now() - state.startedAt - (state.pausedDuration || 0)) / 1000);
        return { elapsed: Math.max(0, elapsed) };
      }),

      // On rehydration after page refresh
      rehydrate: () => set((state) => {
        if (state.running && state.startedAt) {
          const secondsSinceStart = Math.floor(
            (Date.now() - state.startedAt - (state.pausedDuration || 0)) / 1000
          );
          const newElapsed = state.target > 0
            ? Math.min(secondsSinceStart, state.target)
            : secondsSinceStart;
          return { elapsed: newElapsed, paused: true, pausedAt: Date.now() };
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
        pausedAt: state.pausedAt,
        pausedDuration: state.pausedDuration,
      }),
    }
  )
);
