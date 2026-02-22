import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        skipWaiting: true,      // Activate new SW immediately (no waiting for tabs to close)
        clientsClaim: true,     // Take control of all pages immediately
        cleanupOutdatedCaches: true, // Remove old caches on activation
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        navigateFallback: '/index.html',  // SPA: serve app shell for all navigation
        navigateFallbackDenylist: [/^\/api\//, /^\/sw\.js$/, /^\/auth\//],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',  // Always try network for HTML navigation
            options: {
              cacheName: 'pages-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 }, // 1 hour
              networkTimeoutSeconds: 3, // Fall back to cache after 3s
            }
          },
          {
            urlPattern: /^https:\/\/api\.ks-atlas\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 5 // 5 minutes
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkOnly', // NEVER cache Supabase - always fetch fresh data
            options: {
              cacheName: 'supabase-cache'
            }
          }
        ]
      },
      manifest: {
        name: 'Kingshot Atlas',
        short_name: 'Atlas',
        description: 'Compare kingdoms, track KvK results, and find your next home.',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        icons: [
          {
            src: '/atlas-favicon.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/atlas-favicon.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom')) return 'vendor';
            if (id.includes('react-router-dom') || id.includes('@remix-run') || id.includes('turbo-stream')) return 'router';
            if (id.includes('@tanstack/react-query')) return 'query';
            if (id.includes('@tanstack/react-virtual')) return 'virtual';
            if (id.includes('@headlessui') || id.includes('@heroicons')) return 'ui';
            if (id.includes('@supabase')) return 'supabase';
            if (id.includes('@sentry')) return 'sentry';
            if (id.includes('i18next') || id.includes('react-i18next')) return 'i18n';
            if (id.includes('recharts') || id.includes('d3-') || id.includes('victory')) return 'charts';
            if (id.includes('html2canvas')) return 'html2canvas';
            if (id.includes('zod')) return 'zod';
          }
        }
      }
    }
  },
  server: {
    port: 3000,
    host: true
  },
  preview: {
    port: 3000,
    host: true
  }
})
