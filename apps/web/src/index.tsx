import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { registerUpdateHandler } from './serviceWorkerRegistration';
import { sendToAnalytics } from './services/analytics';

// Initialize Sentry for error monitoring (only if DSN is configured)
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.VITE_ENVIRONMENT || 'development',
    
    // Performance monitoring
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    
    // Session replay for debugging (only on errors in production)
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: import.meta.env.PROD ? 1.0 : 0,
    
    // Filter out noisy errors
    ignoreErrors: [
      // Browser extensions
      /extensions\//i,
      /^chrome-extension:\/\//,
      // Network errors (handled gracefully by app)
      'Network request failed',
      'Failed to fetch',
      'Load failed',
      // User-initiated navigation
      'AbortError',
    ],
    
    // Add release version for tracking deployments
    release: import.meta.env.VITE_VERSION || 'development',
    
    // Attach user context when available
    beforeSend(event) {
      // Don't send events in development
      if (import.meta.env.DEV) {
        return null;
      }
      return event;
    },
  });
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Report Web Vitals for performance monitoring
reportWebVitals(sendToAnalytics);

// Listen for SW updates and auto-reload (works with vite-plugin-pwa autoUpdate)
registerUpdateHandler();
