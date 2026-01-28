import { useState, useEffect } from 'react';

/**
 * Breakpoint values in pixels
 * These match the CSS custom properties in index.css
 */
export const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
  desktop: 1280,
  wide: 1440,
} as const;

/**
 * Hook to detect if viewport is mobile width
 * @returns boolean indicating if viewport is < 768px
 */
export const useIsMobile = (): boolean => {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < BREAKPOINTS.mobile : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < BREAKPOINTS.mobile);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
};

/**
 * Hook to detect if viewport is tablet width (768px - 1023px)
 * @returns boolean indicating if viewport is tablet size
 */
export const useIsTablet = (): boolean => {
  const [isTablet, setIsTablet] = useState(
    typeof window !== 'undefined' 
      ? window.innerWidth >= BREAKPOINTS.mobile && window.innerWidth < BREAKPOINTS.tablet 
      : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsTablet(
        window.innerWidth >= BREAKPOINTS.mobile && window.innerWidth < BREAKPOINTS.tablet
      );
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isTablet;
};

/**
 * Hook to detect if viewport is desktop width (>= 1024px)
 * @returns boolean indicating if viewport is desktop size
 */
export const useIsDesktop = (): boolean => {
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= BREAKPOINTS.tablet : true
  );

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= BREAKPOINTS.tablet);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isDesktop;
};

/**
 * Generic media query hook
 * @param query - CSS media query string (e.g., '(min-width: 768px)')
 * @returns boolean indicating if the media query matches
 */
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handleChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    
    // Set initial value
    setMatches(mediaQuery.matches);
    
    // Listen for changes
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [query]);

  return matches;
};

/**
 * Hook to detect if user prefers reduced motion
 * @returns boolean indicating if reduced motion is preferred
 */
export const usePrefersReducedMotion = (): boolean => {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
};

/**
 * Hook to get current breakpoint name
 * @returns 'mobile' | 'tablet' | 'desktop' | 'wide'
 */
export const useBreakpoint = (): 'mobile' | 'tablet' | 'desktop' | 'wide' => {
  const [breakpoint, setBreakpoint] = useState<'mobile' | 'tablet' | 'desktop' | 'wide'>('desktop');

  useEffect(() => {
    const getBreakpoint = (): 'mobile' | 'tablet' | 'desktop' | 'wide' => {
      const width = window.innerWidth;
      if (width < BREAKPOINTS.mobile) return 'mobile';
      if (width < BREAKPOINTS.tablet) return 'tablet';
      if (width < BREAKPOINTS.wide) return 'desktop';
      return 'wide';
    };

    const handleResize = () => setBreakpoint(getBreakpoint());
    
    // Set initial value
    setBreakpoint(getBreakpoint());
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return breakpoint;
};
