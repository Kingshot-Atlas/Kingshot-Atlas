#!/usr/bin/env node

/**
 * Sitemap Generator for Kingshot Atlas
 * 
 * Generates sitemap.xml with:
 * - All public static routes
 * - All kingdom profile pages (1-1190)
 * - All KvK season pages
 * 
 * Run with: node scripts/generate-sitemap.js
 * Or via npm: npm run sitemap
 */

const fs = require('fs');
const path = require('path');

const DOMAIN = 'https://ks-atlas.com';
const OUTPUT_PATH = path.join(__dirname, '../public/sitemap.xml');
const SITEMAP_INDEX_PATH = path.join(__dirname, '../public/sitemap-index.xml');

// Total kingdoms in database
const TOTAL_KINGDOMS = 1190;

// Current KvK season
const CURRENT_KVK = 11;

// Define all public static routes with their metadata
const staticRoutes = [
  { path: '/', changefreq: 'daily', priority: 1.0 },
  { path: '/rankings', changefreq: 'daily', priority: 0.9 },
  { path: '/compare', changefreq: 'weekly', priority: 0.8 },
  { path: '/tools', changefreq: 'weekly', priority: 0.7 },
  { path: '/players', changefreq: 'daily', priority: 0.7 },
  { path: '/seasons', changefreq: 'weekly', priority: 0.7 },
  { path: '/changelog', changefreq: 'weekly', priority: 0.5 },
  { path: '/about', changefreq: 'monthly', priority: 0.5 },
  { path: '/support', changefreq: 'monthly', priority: 0.4 },
  { path: '/contribute-data', changefreq: 'monthly', priority: 0.4 },
];

function generateUrlEntry(path, changefreq, priority, lastmod) {
  return `  <url>
    <loc>${DOMAIN}${path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

function generateMainSitemap() {
  const today = new Date().toISOString().split('T')[0];
  
  // Static routes
  const staticEntries = staticRoutes.map(route => 
    generateUrlEntry(route.path, route.changefreq, route.priority, today)
  );

  // Kingdom profile pages (1-1190)
  const kingdomEntries = [];
  for (let i = 1; i <= TOTAL_KINGDOMS; i++) {
    kingdomEntries.push(
      generateUrlEntry(`/kingdom/${i}`, 'weekly', 0.8, today)
    );
  }

  // KvK season pages
  const seasonEntries = [];
  for (let i = 1; i <= CURRENT_KVK; i++) {
    seasonEntries.push(
      generateUrlEntry(`/seasons/${i}`, 'monthly', 0.6, today)
    );
  }

  const allEntries = [...staticEntries, ...kingdomEntries, ...seasonEntries];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allEntries.join('\n')}
</urlset>
`;

  fs.writeFileSync(OUTPUT_PATH, sitemap);
  
  const totalUrls = staticRoutes.length + TOTAL_KINGDOMS + CURRENT_KVK;
  console.log(`✅ Sitemap generated: ${OUTPUT_PATH}`);
  console.log(`   📄 ${staticRoutes.length} static pages`);
  console.log(`   🏰 ${TOTAL_KINGDOMS} kingdom profiles`);
  console.log(`   ⚔️  ${CURRENT_KVK} KvK season pages`);
  console.log(`   📊 ${totalUrls} total URLs`);
  console.log(`   📅 Last modified: ${today}`);
}

generateMainSitemap();
