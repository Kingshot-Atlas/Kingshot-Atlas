import type { Metric } from 'web-vitals';
import { logger } from '../utils/logger';

interface AnalyticsEvent {
  name: string;
  value: number;
  delta: number;
  id: string;
  rating?: string;
}

const ANALYTICS_ENDPOINT = process.env.REACT_APP_API_URL 
  ? `${process.env.REACT_APP_API_URL}/api/analytics`
  : null;

export function sendToAnalytics(metric: Metric): void {
  const event: AnalyticsEvent = {
    name: metric.name,
    value: metric.value,
    delta: metric.delta,
    id: metric.id,
    rating: (metric as Metric & { rating?: string }).rating,
  };

  // Always log in development
  if (process.env.NODE_ENV === 'development') {
    logger.log('[Analytics]', event);
    return;
  }

  // In production, send to analytics endpoint if configured
  if (ANALYTICS_ENDPOINT) {
    // Use sendBeacon for reliability (doesn't block page unload)
    const blob = new Blob([JSON.stringify(event)], { type: 'application/json' });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ANALYTICS_ENDPOINT, blob);
    } else {
      // Fallback for browsers without sendBeacon
      fetch(ANALYTICS_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify(event),
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      }).catch(() => {
        // Silently fail - analytics should never break the app
      });
    }
  }
}

export function trackEvent(eventName: string, properties?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === 'development') {
    logger.log('[Track]', eventName, properties);
    return;
  }

  if (ANALYTICS_ENDPOINT) {
    const payload = {
      event: eventName,
      properties,
      timestamp: new Date().toISOString(),
    };

    fetch(`${ANALYTICS_ENDPOINT}/event`, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).catch(() => {
      // Silently fail
    });
  }
}

export function trackPageView(path: string): void {
  trackEvent('page_view', { path });
}
