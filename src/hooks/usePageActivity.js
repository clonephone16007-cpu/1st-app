import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

export function usePageActivity(pageName) {
  const { logEvent } = useAppStore();

  useEffect(() => {
    const mountTime = Date.now();
    return () => {
      const unmountTime = Date.now();
      logEvent({
        type: 'page_visit',
        timestamp: mountTime,
        data: {
          page: pageName,
          durationMs: unmountTime - mountTime
        }
      });
    };
  }, [pageName, logEvent]);
}
