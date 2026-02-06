/**
 * Analytics Hook - Tracks page views and provides tracking utilities
 * Used throughout the app to collect usage data for Admin Dashboard
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { analyticsService } from '../services/analyticsService';

// Map route paths to readable page names
const getPageName = (pathname: string): string => {
  if (pathname === '/') return 'Kingdom Directory';
  if (pathname.startsWith('/kingdom/')) return 'Kingdom Profile';
  if (pathname === '/compare') return 'Compare Kingdoms';
  if (pathname === '/rankings' || pathname === '/leaderboards') return 'Kingdom Rankings';
  if (pathname === '/profile') return 'My Profile';
  if (pathname.startsWith('/profile/')) return 'User Profile';
  if (pathname === '/players') return 'Player Directory';
  if (pathname === '/about') return 'About';
  if (pathname === '/admin') return 'Admin Dashboard';
  if (pathname === '/upgrade') return 'Upgrade';
  return pathname;
};

/**
 * Hook to track page views on route changes
 * Add this to App.tsx or any component that needs route tracking
 */
export function usePageTracking(): void {
  const location = useLocation();

  useEffect(() => {
    const pageName = getPageName(location.pathname);
    analyticsService.trackPageView(pageName);
  }, [location.pathname]);
}

/**
 * Hook to get analytics tracking functions
 * Use this in components to track feature usage and button clicks
 */
export function useAnalytics() {
  const trackFeature = (featureName: string, metadata?: Record<string, string | number | boolean>) => {
    analyticsService.trackFeatureUse(featureName, metadata);
  };

  const trackButton = (buttonName: string) => {
    analyticsService.trackButtonClick(buttonName);
  };

  const trackSearch = (query: string) => {
    analyticsService.trackSearch(query);
  };

  return {
    trackFeature,
    trackButton,
    trackSearch,
  };
}

export default useAnalytics;
