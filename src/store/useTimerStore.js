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
<<<<<<< Updated upstream
      startedAt: null,      // wall-clock ms when timer last (re)started
      pausedAt: null,       // wall-clock ms when paused
      pausedDuration: 0,    // total ms spent paused so far
=======
      startedAt: null, // timestamp when timer was started or resumed
      accumulated: 0,  // total seconds accumulated before the current startedAt
>>>>>>> Stashed changes

      start: (target, mode, subject) => set({
        running: true,
        paused: false,
        elapsed: 0,
        accumulated: 0,
        target,
        mode,
        subject,
        startedAt: Date.now(),
<<<<<<< Updated upstream
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
=======
      }),
      pause: () => set((state) => {
        if (!state.running || state.paused || !state.startedAt) return state;
        const currentRunSecs = Math.floor((Date.now() - state.startedAt) / 1000);
        return { paused: true, accumulated: state.accumulated + currentRunSecs, elapsed: state.accumulated + currentRunSecs, startedAt: null };
      }),
      resume: () => set({ paused: false, startedAt: Date.now() }),
      stop: () => set({ running: false, paused: false, elapsed: 0, accumulated: 0, startedAt: null }),
      setMode: (mode) => set({ mode }),
      setSubject: (subject) => set({ subject }),
      tick: () => set((state) => {
        if (state.running && !state.paused && state.startedAt) {
          const now = Date.now();
          const currentRunSecs = Math.floor((now - state.startedAt) / 1000);
          return { elapsed: state.accumulated + currentRunSecs };
        }
        return state;
      }),

      // On rehydration: if we were running, auto-pause and compute elapsed
      rehydrate: () => set((state) => {
        if (state.running && state.startedAt) {
          const currentRunSecs = Math.floor((Date.now() - state.startedAt) / 1000);
          const newElapsed = state.accumulated + currentRunSecs;
          // If target was set and we've exceeded it, cap at target
          const cappedElapsed = state.target > 0 ? Math.min(newElapsed, state.target) : newElapsed;
          return { elapsed: cappedElapsed, paused: true, accumulated: cappedElapsed, startedAt: null };
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
        pausedAt: state.pausedAt,
        pausedDuration: state.pausedDuration,
=======
        accumulated: state.accumulated,
>>>>>>> Stashed changes
      }),
    }
  )
);
