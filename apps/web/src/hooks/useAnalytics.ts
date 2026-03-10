/**
 * Analytics Hook - Tracks page views and provides tracking utilities
 * Used throughout the app to collect usage data for Admin Dashboard
 */

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { analyticsService } from '../services/analyticsService';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const VISITOR_ID_KEY = 'atlas_visitor_id';

function getVisitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_ID_KEY, id);
    }
    return id;
  } catch {
    return `anon_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

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
  const { user } = useAuth();
  const lastTrackedRef = useRef<string>('');

  useEffect(() => {
    const pageName = getPageName(location.pathname);
    analyticsService.trackPageView(pageName);

    // Debounce: skip if same path tracked in this render cycle
    const trackKey = `${location.pathname}`;
    if (trackKey === lastTrackedRef.current) return;
    lastTrackedRef.current = trackKey;

    // Record page view to Supabase for accurate analytics
    if (supabase) {
      const visitorId = getVisitorId();
      supabase
        .from('page_views')
        .insert({
          visitor_id: visitorId,
          page_path: location.pathname,
          user_id: user?.id || null,
        })
        .then(() => {}, () => {});
    }
  }, [location.pathname, user?.id]);
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
