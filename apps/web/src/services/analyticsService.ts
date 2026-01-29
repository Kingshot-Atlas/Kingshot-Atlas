/**
 * Analytics Service - Tracks user interactions and feature usage
 * Data is stored locally and displayed in Admin Dashboard
 */

import { logger } from '../utils/logger';

const ANALYTICS_KEY = 'kingshot_analytics_events';
const SESSION_KEY = 'kingshot_session_id';

interface AnalyticsEvent {
  event_type: string;
  event_name: string;
  timestamp: string;
  session_id: string;
  page?: string;
  metadata?: Record<string, string | number | boolean>;
}

interface FeatureUsage {
  feature: string;
  count: number;
  lastUsed: string;
}

class AnalyticsService {
  private sessionId: string;

  constructor() {
    this.sessionId = this.getOrCreateSession();
  }

  private getOrCreateSession(): string {
    let sessionId = sessionStorage.getItem(SESSION_KEY);
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem(SESSION_KEY, sessionId);
    }
    return sessionId;
  }

  private getEvents(): AnalyticsEvent[] {
    try {
      const stored = localStorage.getItem(ANALYTICS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private saveEvent(event: AnalyticsEvent): void {
    try {
      const events = this.getEvents();
      events.push(event);
      // Keep only last 10000 events to prevent storage overflow
      const trimmed = events.slice(-10000);
      localStorage.setItem(ANALYTICS_KEY, JSON.stringify(trimmed));
    } catch (e) {
      logger.warn('Failed to save analytics event:', e);
    }
  }

  // Track page views
  trackPageView(pageName: string): void {
    this.saveEvent({
      event_type: 'page_view',
      event_name: pageName,
      timestamp: new Date().toISOString(),
      session_id: this.sessionId,
      page: pageName
    });
  }

  // Track feature/button clicks
  trackFeatureUse(featureName: string, metadata?: Record<string, string | number | boolean>): void {
    this.saveEvent({
      event_type: 'feature_use',
      event_name: featureName,
      timestamp: new Date().toISOString(),
      session_id: this.sessionId,
      page: window.location.pathname,
      metadata
    });
  }

  // Track button clicks
  trackButtonClick(buttonName: string, page?: string): void {
    this.saveEvent({
      event_type: 'button_click',
      event_name: buttonName,
      timestamp: new Date().toISOString(),
      session_id: this.sessionId,
      page: page || window.location.pathname
    });
  }

  // Track searches
  trackSearch(query: string): void {
    this.saveEvent({
      event_type: 'search',
      event_name: query,
      timestamp: new Date().toISOString(),
      session_id: this.sessionId,
      page: window.location.pathname
    });
  }

  // Get aggregated analytics for Admin Dashboard
  getAnalyticsSummary(): {
    totalEvents: number;
    uniqueSessions: number;
    pageViews: { page: string; views: number }[];
    featureUsage: FeatureUsage[];
    buttonClicks: FeatureUsage[];
    recentSearches: string[];
    eventsByDay: { date: string; count: number }[];
  } {
    const events = this.getEvents();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Filter to last 30 days
    const recentEvents = events.filter(e => new Date(e.timestamp) >= thirtyDaysAgo);

    // Unique sessions
    const sessions = new Set(recentEvents.map(e => e.session_id));

    // Page views aggregation
    const pageViewMap = new Map<string, { views: number; sessions: Set<string> }>();
    recentEvents
      .filter(e => e.event_type === 'page_view')
      .forEach(e => {
        const page = e.event_name || 'Unknown';
        if (!pageViewMap.has(page)) {
          pageViewMap.set(page, { views: 0, sessions: new Set() });
        }
        const entry = pageViewMap.get(page)!;
        entry.views++;
        entry.sessions.add(e.session_id);
      });

    const pageViews = Array.from(pageViewMap.entries())
      .map(([page, data]) => ({ page, views: data.views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    // Feature usage aggregation
    const featureMap = new Map<string, { count: number; lastUsed: string }>();
    recentEvents
      .filter(e => e.event_type === 'feature_use')
      .forEach(e => {
        const feature = e.event_name;
        if (!featureMap.has(feature)) {
          featureMap.set(feature, { count: 0, lastUsed: e.timestamp });
        }
        const entry = featureMap.get(feature)!;
        entry.count++;
        if (e.timestamp > entry.lastUsed) entry.lastUsed = e.timestamp;
      });

    const featureUsage = Array.from(featureMap.entries())
      .map(([feature, data]) => ({ feature, count: data.count, lastUsed: data.lastUsed }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    // Button clicks aggregation
    const buttonMap = new Map<string, { count: number; lastUsed: string }>();
    recentEvents
      .filter(e => e.event_type === 'button_click')
      .forEach(e => {
        const button = e.event_name;
        if (!buttonMap.has(button)) {
          buttonMap.set(button, { count: 0, lastUsed: e.timestamp });
        }
        const entry = buttonMap.get(button)!;
        entry.count++;
        if (e.timestamp > entry.lastUsed) entry.lastUsed = e.timestamp;
      });

    const buttonClicks = Array.from(buttonMap.entries())
      .map(([feature, data]) => ({ feature, count: data.count, lastUsed: data.lastUsed }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    // Recent searches
    const recentSearches = recentEvents
      .filter(e => e.event_type === 'search')
      .slice(-20)
      .map(e => e.event_name)
      .reverse();

    // Events by day (last 7 days)
    const dayMap = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      dayMap.set(dateStr!, 0);
    }
    recentEvents.forEach(e => {
      const dateStr = e.timestamp.split('T')[0];
      if (dateStr && dayMap.has(dateStr)) {
        dayMap.set(dateStr, (dayMap.get(dateStr) || 0) + 1);
      }
    });

    const eventsByDay = Array.from(dayMap.entries())
      .map(([date, count]) => ({ date, count }));

    return {
      totalEvents: recentEvents.length,
      uniqueSessions: sessions.size,
      pageViews,
      featureUsage,
      buttonClicks,
      recentSearches,
      eventsByDay
    };
  }

  // Clear all analytics data (admin function)
  clearAnalytics(): void {
    localStorage.removeItem(ANALYTICS_KEY);
  }
}

export const analyticsService = new AnalyticsService();
