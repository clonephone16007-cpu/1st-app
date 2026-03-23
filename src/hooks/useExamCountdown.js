import { useState, useEffect } from 'react';
import { exams } from '../data/exams';
import { useAppStore } from '../store/useAppStore';

export function useExamCountdown(examId) {
  const [timeRemaining, setTimeRemaining] = useState({ days: 0, hours: 0, mins: 0, text: '' });
  const { settings } = useAppStore();

  useEffect(() => {
    const exam = exams.find(e => e.id === examId);
    if (!exam) return;
    
    const targetDateStr = settings.examDates?.[examId] || exam.date;
    const targetDate = new Date(targetDateStr).getTime();

    const update = () => {
      const now = new Date().getTime();
      const diff = targetDate - now;
      
      if (diff <= 0) {
        setTimeRemaining({ days: 0, hours: 0, mins: 0, text: 'Exam passed' });
        return;
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      setTimeRemaining({
        days, hours, mins,
        text: `${days}d ${hours}h ${mins}m`
      });
    };

    update();
    const int = setInterval(update, 60000);
    return () => clearInterval(int);
  }, [examId, settings.examDates]);

  return timeRemaining;
}
