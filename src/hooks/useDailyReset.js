import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

export function useDailyReset() {
  const { logEvent, planner, addPlannerTask, deletePlannerTask } = useAppStore();

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const lastActive = localStorage.getItem('examhq-last-active-date');

    if (lastActive && lastActive !== today) {
      logEvent({ type: 'day_changed', timestamp: Date.now(), from: lastActive, to: today });
      
      // We don't forcefully mutate the store here for carry-forward tasks because 
      // Planner component renders them visually as combined. But this hook
      // allows future per-day cleanup tasks (like resetting UI state) to fire neatly.
    }
    
    localStorage.setItem('examhq-last-active-date', today);
  }, [logEvent]);
}
