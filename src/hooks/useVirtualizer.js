import { useState, useEffect } from 'react';

export function useVirtualizer(itemCount, itemHeight = 120, overscan = 10, listOffsetTop = 0) {
  const [scrollTop, setScrollTop] = useState({ top: 0, height: 800 });

  useEffect(() => {
    const handleScroll = () => {
      setScrollTop({
        top: window.scrollY,
        height: window.innerHeight
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const adjustedScrollTop = Math.max(0, scrollTop.top - listOffsetTop);

  const startIndex = Math.max(0, Math.floor(adjustedScrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    Math.max(0, itemCount - 1),
    Math.floor((adjustedScrollTop + scrollTop.height) / itemHeight) + overscan
  );

  const paddingTop = Math.max(0, startIndex * itemHeight);
  const paddingBottom = Math.max(0, (Math.max(0, itemCount - 1) - endIndex) * itemHeight);

  return { startIndex, endIndex, paddingTop, paddingBottom };
}
