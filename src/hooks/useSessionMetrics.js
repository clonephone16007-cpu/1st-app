import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';

export function useSessionMetrics() {
  const { sessions } = useAppStore();

  return useMemo(() => {
    let totalLifetimeMins = 0;
    let bestDayMins = 0;
    const subjectMins = {};
    const daysData = {};

    sessions.forEach(s => {
      const mins = s.mins || 0;
      totalLifetimeMins += mins;
      
      if (s.subject) {
        subjectMins[s.subject] = (subjectMins[s.subject] || 0) + mins;
      }

      if (s.date) {
        const dStr = s.date.split('T')[0];
        daysData[dStr] = (daysData[dStr] || 0) + mins;
      }
    });

    Object.values(daysData).forEach(mins => {
      if (mins > bestDayMins) bestDayMins = mins;
    });

    let bestSubject = 'Math';
    let maxSubjMins = -1;
    Object.entries(subjectMins).forEach(([subj, mins]) => {
      if (mins > maxSubjMins) {
        maxSubjMins = mins;
        bestSubject = subj;
      }
    });

    const sessionDates = Object.keys(daysData).sort();
    
    let longestStreak = 0;
    let currentStreak = 0;

    if (sessionDates.length > 0) {
      let tempStreak = 1;
      longestStreak = 1;

      // Longest streak calculation allowing 1 missed day (grace period: diff <= 2)
      for (let i = 1; i < sessionDates.length; i++) {
        const prev = new Date(sessionDates[i-1]);
        const curr = new Date(sessionDates[i]);
        const diffDays = Math.round((curr - prev) / 86400000);
        
        if (diffDays <= 2) {
          tempStreak++;
        } else {
          tempStreak = 1;
        }
        if (tempStreak > longestStreak) longestStreak = tempStreak;
      }

      // Current streak calculation with grace period
      const sortedDesc = [...sessionDates].reverse();
      const today = new Date();
      today.setHours(0,0,0,0);
      
      const lastSessionDate = new Date(sortedDesc[0]);
      lastSessionDate.setHours(0,0,0,0);
      
      const daysSinceLastSession = Math.round((today - lastSessionDate) / 86400000);
      
      // Grace period: last session was today, yesterday, or day before
      if (daysSinceLastSession <= 2) {
        currentStreak = 1;
        for (let i = 1; i < sortedDesc.length; i++) {
          const curr = new Date(sortedDesc[i-1]);
          const prev = new Date(sortedDesc[i]);
          const diffDays = Math.round((curr - prev) / 86400000);
          
          if (diffDays <= 2) {
            currentStreak++;
          } else {
            break;
          }
        }
      }
    }

    const totalLifetimeHours = totalLifetimeMins / 60;

    return {
      totalLifetimeHours: parseFloat(totalLifetimeHours.toFixed(1)),
      bestDayHours: parseFloat((bestDayMins / 60).toFixed(1)),
      longestStreak,
      currentStreak,
      mostStudiedSubject: bestSubject,
      // FIX: was totalLifetimeHours * 60 * 60 (double conversion) — now correct
      avgSessionLengthMins: sessions.length ? Math.round(totalLifetimeMins / sessions.length) : 0,
    };
  }, [sessions]);
}
