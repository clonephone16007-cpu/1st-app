import { useEffect, useState, useRef } from 'react';

export function useIdleDetection(thresholdMs = 300000, onIdle) {
  const [isIdle, setIsIdle] = useState(false);
  const timeoutRef = useRef(null);
  const savedCallback = useRef(onIdle);

  useEffect(() => {
    savedCallback.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    const handleActivity = () => {
      setIsIdle(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setIsIdle(true);
        if (savedCallback.current) savedCallback.current();
      }, thresholdMs);
    };

    handleActivity(); // Init

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('scroll', handleActivity);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('scroll', handleActivity);
    };
  }, [thresholdMs]);

  return isIdle;
}
