import { useEffect, useRef } from 'react';
import { analyticsService } from '../services/analyticsService';

/**
 * Tracks how far users scroll down the page.
 * Fires events at 25%, 50%, 75%, and 100% scroll depth.
 * Each threshold fires only once per page load.
 */
export function useScrollDepth(pageName: string): void {
  const firedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    firedRef.current = new Set();

    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;

      const percent = Math.round((scrollTop / docHeight) * 100);

      const thresholds = [25, 50, 75, 100];
      for (const t of thresholds) {
        if (percent >= t && !firedRef.current.has(t)) {
          firedRef.current.add(t);
          analyticsService.trackFeatureUse('Scroll Depth', {
            page: pageName,
            depth: t,
          });
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [pageName]);
}
