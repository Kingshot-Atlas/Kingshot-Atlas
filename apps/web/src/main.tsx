import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Unregister service workers in development to prevent OAuth redirect issues
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => {
      registration.unregister();
      console.log('[DEV] Service worker unregistered to prevent redirect issues');
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
