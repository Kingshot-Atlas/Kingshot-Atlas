import { useEffect, useRef, useState } from 'react';

/**
 * Shared IntersectionObserver — single observer instance for all subscribers.
 * Replaces per-component observers to reduce memory overhead (e.g. 1200+ KingdomCards).
 */
const callbacks = new Map<Element, () => void>();

let sharedObserver: IntersectionObserver | null = null;

function getSharedObserver(): IntersectionObserver {
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const cb = callbacks.get(entry.target);
            if (cb) {
              cb();
              callbacks.delete(entry.target);
              sharedObserver?.unobserve(entry.target);
            }
          }
        }
      },
      { threshold: 0.3 }
    );
  }
  return sharedObserver;
}

/**
 * Hook that fires once when element enters viewport (30% visible).
 * Uses a single shared IntersectionObserver for all instances.
 */
export function useInViewOnce(): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (inView) return; // Already triggered
    const el = ref.current;
    if (!el) return;

    const observer = getSharedObserver();
    callbacks.set(el, () => setInView(true));
    observer.observe(el);

    return () => {
      callbacks.delete(el);
      observer.unobserve(el);
    };
  }, [inView]);

  return [ref, inView];
}
