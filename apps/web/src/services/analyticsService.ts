/**
 * Analytics Service - Tracks user interactions and feature usage
 * Data is stored locally and displayed in Admin Dashboard
 */

import { logger } from '../utils/logger';

const ANALYTICS_KEY = 'kingshot_analytics_events';
const SESSION_KEY = 'kingshot_session_id';
const SESSION_START_KEY = 'kingshot_session_start';
const USER_ACTIVITY_KEY = 'kingshot_user_activity';

interface UserActivity {
  user_id: string;
  date: string;
  session_count: number;
  total_duration_ms: number;
  page_views: number;
  feature_uses: number;
  subscription_tier?: string;
}

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
  private sessionStartTime: number;

  constructor() {
    this.sessionId = this.getOrCreateSession();
    this.sessionStartTime = this.getOrCreateSessionStart();
    this.setupSessionTracking();
  }

  private getOrCreateSession(): string {
    let sessionId = sessionStorage.getItem(SESSION_KEY);
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem(SESSION_KEY, sessionId);
    }
    return sessionId;
  }

  private getOrCreateSessionStart(): number {
    const stored = sessionStorage.getItem(SESSION_START_KEY);
    if (stored) {
      return parseInt(stored, 10);
    }
    const now = Date.now();
    sessionStorage.setItem(SESSION_START_KEY, now.toString());
    return now;
  }

  private setupSessionTracking(): void {
    // Track session end on page unload
    window.addEventListener('beforeunload', () => {
      this.recordSessionEnd();
    });

    // Track visibility changes (tab switching)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.recordSessionEnd();
      }
    });
  }

  private recordSessionEnd(): void {
    const duration = Date.now() - this.sessionStartTime;
    this.updateUserActivity(duration);
  }

  private getUserActivity(): UserActivity[] {
    try {
      const stored = localStorage.getItem(USER_ACTIVITY_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private saveUserActivity(activities: UserActivity[]): void {
    try {
      // Keep only last 90 days of activity
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const filtered = activities.filter(a => new Date(a.date) >= ninetyDaysAgo);
      localStorage.setItem(USER_ACTIVITY_KEY, JSON.stringify(filtered));
    } catch (e) {
      logger.warn('Failed to save user activity:', e);
    }
  }

  private updateUserActivity(sessionDuration: number): void {
    const today = new Date().toISOString().split('T')[0];
    const activities = this.getUserActivity();
    
    // Find or create today's activity record
    let todayActivity = activities.find(a => a.date === today);
    if (!todayActivity) {
      todayActivity = {
        user_id: this.sessionId.split('_')[1] || 'anonymous',
        date: today!,
        session_count: 0,
        total_duration_ms: 0,
        page_views: 0,
        feature_uses: 0
      };
      activities.push(todayActivity);
    }

    todayActivity.session_count++;
    todayActivity.total_duration_ms += sessionDuration;
    
    this.saveUserActivity(activities);
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

  // Get engagement metrics for dashboard
  getEngagementMetrics(): {
    dau: number;
    wau: number;
    mau: number;
    dauWauRatio: number;
    avgSessionDuration: number;
    avgSessionsPerDay: number;
    dailyActivity: { date: string; users: number; sessions: number; duration: number }[];
    hourlyHeatmap: { hour: number; day: number; count: number }[];
    featureAdoption: { feature: string; users: number; totalUses: number }[];
    userJourney: { step: string; users: number; dropoff: number }[];
  } {
    const events = this.getEvents();
    const activities = this.getUserActivity();
    const now = new Date();
    
    // Calculate DAU/WAU/MAU from unique sessions
    const today = now.toISOString().split('T')[0];
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const todayEvents = events.filter(e => e.timestamp.startsWith(today!));
    const weekEvents = events.filter(e => new Date(e.timestamp) >= sevenDaysAgo);
    const monthEvents = events.filter(e => new Date(e.timestamp) >= thirtyDaysAgo);

    const dau = new Set(todayEvents.map(e => e.session_id)).size;
    const wau = new Set(weekEvents.map(e => e.session_id)).size;
    const mau = new Set(monthEvents.map(e => e.session_id)).size;
    const dauWauRatio = wau > 0 ? Math.round((dau / wau) * 100) : 0;

    // Session duration from activities
    const recentActivities = activities.filter(a => new Date(a.date) >= sevenDaysAgo);
    const totalDuration = recentActivities.reduce((sum, a) => sum + a.total_duration_ms, 0);
    const totalSessions = recentActivities.reduce((sum, a) => sum + a.session_count, 0);
    const avgSessionDuration = totalSessions > 0 ? Math.round(totalDuration / totalSessions / 1000) : 0;
    const avgSessionsPerDay = recentActivities.length > 0 
      ? Math.round((totalSessions / recentActivities.length) * 10) / 10 
      : 0;

    // Daily activity for chart
    const dailyMap = new Map<string, { users: Set<string>; sessions: number; duration: number }>();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      dailyMap.set(dateStr!, { users: new Set(), sessions: 0, duration: 0 });
    }

    monthEvents.forEach(e => {
      const dateStr = e.timestamp.split('T')[0];
      if (dateStr && dailyMap.has(dateStr)) {
        const entry = dailyMap.get(dateStr)!;
        entry.users.add(e.session_id);
        if (e.event_type === 'page_view') entry.sessions++;
      }
    });

    activities.filter(a => new Date(a.date) >= thirtyDaysAgo).forEach(a => {
      if (dailyMap.has(a.date)) {
        const entry = dailyMap.get(a.date)!;
        entry.duration += a.total_duration_ms;
      }
    });

    const dailyActivity = Array.from(dailyMap.entries()).map(([date, data]) => ({
      date,
      users: data.users.size,
      sessions: data.sessions,
      duration: Math.round(data.duration / 1000 / 60) // minutes
    }));

    // Hourly heatmap (hour x day of week)
    const heatmapData: { hour: number; day: number; count: number }[] = [];
    const hourDayMap = new Map<string, number>();
    
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        hourDayMap.set(`${day}-${hour}`, 0);
      }
    }

    weekEvents.forEach(e => {
      const date = new Date(e.timestamp);
      const key = `${date.getDay()}-${date.getHours()}`;
      hourDayMap.set(key, (hourDayMap.get(key) || 0) + 1);
    });

    hourDayMap.forEach((count, key) => {
      const [day, hour] = key.split('-').map(Number);
      heatmapData.push({ hour: hour!, day: day!, count });
    });

    // Feature adoption by unique users
    const featureUserMap = new Map<string, Set<string>>();
    const featureCountMap = new Map<string, number>();
    
    monthEvents
      .filter(e => e.event_type === 'feature_use' || e.event_type === 'button_click')
      .forEach(e => {
        if (!featureUserMap.has(e.event_name)) {
          featureUserMap.set(e.event_name, new Set());
          featureCountMap.set(e.event_name, 0);
        }
        featureUserMap.get(e.event_name)!.add(e.session_id);
        featureCountMap.set(e.event_name, (featureCountMap.get(e.event_name) || 0) + 1);
      });

    const featureAdoption = Array.from(featureUserMap.entries())
      .map(([feature, users]) => ({
        feature,
        users: users.size,
        totalUses: featureCountMap.get(feature) || 0
      }))
      .sort((a, b) => b.users - a.users)
      .slice(0, 15);

    // User journey funnel
    const journeySteps = ['Home', 'Kingdom Directory', 'Kingdom Profile', 'Compare', 'Profile'];
    const journeyData: { step: string; users: number; dropoff: number }[] = [];
    let prevUsers = mau;

    journeySteps.forEach(step => {
      const stepEvents = monthEvents.filter(e => 
        e.event_type === 'page_view' && 
        e.event_name.toLowerCase().includes(step.toLowerCase())
      );
      const stepUsers = new Set(stepEvents.map(e => e.session_id)).size;
      const dropoff = prevUsers > 0 ? Math.round(((prevUsers - stepUsers) / prevUsers) * 100) : 0;
      journeyData.push({ step, users: stepUsers, dropoff });
      prevUsers = stepUsers;
    });

    return {
      dau,
      wau,
      mau,
      dauWauRatio,
      avgSessionDuration,
      avgSessionsPerDay,
      dailyActivity,
      hourlyHeatmap: heatmapData,
      featureAdoption,
      userJourney: journeyData
    };
  }

  // Get homepage click-through rates for Admin Dashboard
  getHomepageCTR(): {
    quickActions: { label: string; clicks: number; lastClicked: string }[];
    transferBanner: { ctaClicks: number; dismissals: number; ctr: number };
    scrollDepthByPage: { page: string; depths: { threshold: number; count: number }[] }[];
    worstDropoffs: { page: string; at25: number; at50: number; dropoffPercent: number }[];
  } {
    const events = this.getEvents();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recent = events.filter(e => new Date(e.timestamp) >= thirtyDaysAgo);

    // QuickAction clicks breakdown by tile label
    const qaMap = new Map<string, { clicks: number; lastClicked: string }>();
    recent
      .filter(e => e.event_name === 'QuickAction Clicked')
      .forEach(e => {
        const label = (e.metadata?.tile as string) || 'Unknown';
        if (!qaMap.has(label)) qaMap.set(label, { clicks: 0, lastClicked: e.timestamp });
        const entry = qaMap.get(label)!;
        entry.clicks++;
        if (e.timestamp > entry.lastClicked) entry.lastClicked = e.timestamp;
      });
    const quickActions = Array.from(qaMap.entries())
      .map(([label, data]) => ({ label, ...data }))
      .sort((a, b) => b.clicks - a.clicks);

    // Transfer Banner CTR
    const ctaClicks = recent.filter(e => e.event_name === 'Transfer Banner CTA Clicked').length;
    const dismissals = recent.filter(e => e.event_name === 'Transfer Banner Dismissed').length;
    const totalImpressions = ctaClicks + dismissals;
    const ctr = totalImpressions > 0 ? Math.round((ctaClicks / totalImpressions) * 100) : 0;

    // Scroll depth by page — collect all tracked pages
    const scrollEvents = recent.filter(e => e.event_name === 'Scroll Depth');
    const pageDepthMap = new Map<string, Map<number, number>>();
    const trackedPages = ['Kingdom Directory', 'Kingdom Profile', 'Transfer Hub', 'Rankings'];
    trackedPages.forEach(p => {
      const m = new Map<number, number>();
      [25, 50, 75, 100].forEach(t => m.set(t, 0));
      pageDepthMap.set(p, m);
    });

    scrollEvents.forEach(e => {
      const page = e.metadata?.page as string;
      const depth = e.metadata?.depth as number;
      if (!page || !depth) return;
      if (!pageDepthMap.has(page)) {
        const m = new Map<number, number>();
        [25, 50, 75, 100].forEach(t => m.set(t, 0));
        pageDepthMap.set(page, m);
      }
      const m = pageDepthMap.get(page)!;
      if (m.has(depth)) m.set(depth, (m.get(depth) || 0) + 1);
    });

    const scrollDepthByPage = Array.from(pageDepthMap.entries())
      .map(([page, depthMap]) => ({
        page,
        depths: Array.from(depthMap.entries())
          .map(([threshold, count]) => ({ threshold, count }))
          .sort((a, b) => a.threshold - b.threshold),
      }))
      .sort((a, b) => {
        const totalA = a.depths.reduce((s, d) => s + d.count, 0);
        const totalB = b.depths.reduce((s, d) => s + d.count, 0);
        return totalB - totalA;
      });

    // Worst drop-offs: pages where <30% of users who hit 25% reach 50%
    const worstDropoffs = scrollDepthByPage
      .map(({ page, depths }) => {
        const at25 = depths.find(d => d.threshold === 25)?.count || 0;
        const at50 = depths.find(d => d.threshold === 50)?.count || 0;
        const dropoffPercent = at25 > 0 ? Math.round(((at25 - at50) / at25) * 100) : 0;
        return { page, at25, at50, dropoffPercent };
      })
      .filter(d => d.at25 > 0 && d.dropoffPercent > 70) // >70% drop means <30% reach 50%
      .sort((a, b) => b.dropoffPercent - a.dropoffPercent);

    return { quickActions, transferBanner: { ctaClicks, dismissals, ctr }, scrollDepthByPage, worstDropoffs };
  }
}

export const analyticsService = new AnalyticsService();
