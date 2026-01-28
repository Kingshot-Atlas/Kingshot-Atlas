import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

// Initialize Sentry for error monitoring (only if DSN is configured)
const SENTRY_DSN = process.env.REACT_APP_SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: process.env.REACT_APP_ENVIRONMENT || 'development',
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
// In production, these can be sent to an analytics endpoint
reportWebVitals((metric) => {
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log(metric);
  }
  // TODO: Send to analytics endpoint in production
  // Example: sendToAnalytics(metric)
});

// Register service worker for offline support (production only)
serviceWorkerRegistration.register({
  onSuccess: () => console.log('Kingshot Atlas is ready for offline use'),
  onUpdate: () => console.log('New version available - refresh to update'),
});
