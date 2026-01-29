#!/usr/bin/env node

/**
 * Sitemap Generator for Kingshot Atlas
 * 
 * Automatically generates sitemap.xml based on route definitions.
 * Run with: node scripts/generate-sitemap.js
 * Or via npm: npm run sitemap
 */

const fs = require('fs');
const path = require('path');

const DOMAIN = 'https://ks-atlas.com';
const OUTPUT_PATH = path.join(__dirname, '../public/sitemap.xml');

// Define all public routes with their metadata
const routes = [
  { path: '/', changefreq: 'daily', priority: 1.0 },
  { path: '/kingdoms', changefreq: 'daily', priority: 0.9 },
  { path: '/leaderboards', changefreq: 'daily', priority: 0.8 },
  { path: '/compare', changefreq: 'weekly', priority: 0.8 },
  { path: '/about', changefreq: 'monthly', priority: 0.5 },
];

// Routes that should NOT be in sitemap (require auth, dynamic, etc.)
const excludedRoutes = [
  '/profile',
  '/admin',
  '/login',
  '/callback',
];

function generateSitemap() {
  const today = new Date().toISOString().split('T')[0];
  
  const urlEntries = routes
    .filter(route => !excludedRoutes.includes(route.path))
    .map(route => `  <url>
    <loc>${DOMAIN}${route.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`)
    .join('\n');

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>
`;

  fs.writeFileSync(OUTPUT_PATH, sitemap);
  console.log(`✅ Sitemap generated: ${OUTPUT_PATH}`);
  console.log(`   ${routes.length} URLs included`);
  console.log(`   Last modified: ${today}`);
}

generateSitemap();
