import React from 'react'
import ReactDOM from 'react-dom/client'
import './i18n'
import App from './App'
import './index.css'
import { logger } from './utils/logger'
import { registerUpdateHandler } from './serviceWorkerRegistration'

// Unregister service workers in development to prevent OAuth redirect issues
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => {
      registration.unregister();
      logger.log('[DEV] Service worker unregistered to prevent redirect issues');
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Listen for SW updates and auto-reload so users always see the latest build
registerUpdateHandler()
