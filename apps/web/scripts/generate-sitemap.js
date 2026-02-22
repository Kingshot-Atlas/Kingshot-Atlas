#!/usr/bin/env node

/**
 * Sitemap Generator for Kingshot Atlas
 * 
 * Generates a sitemap index with separate sub-sitemaps for better crawl targeting:
 * - sitemap.xml          → Sitemap index pointing to sub-sitemaps
 * - sitemap-static.xml   → Static pages (rankings, tools, etc.)
 * - sitemap-kingdoms.xml → All kingdom profile pages (with real lastmod from Supabase)
 * - sitemap-seasons.xml  → All KvK season pages
 * 
 * Queries Supabase for:
 * - Actual kingdom numbers + last_updated timestamps (for accurate lastmod)
 * - Current max KvK season
 * Falls back to hardcoded values if Supabase is unavailable.
 * 
 * Run with: node scripts/generate-sitemap.js
 * Or via npm: npm run sitemap
 * Runs automatically as prebuild hook.
 */

const fs = require('fs');
const path = require('path');

const DOMAIN = 'https://ks-atlas.com';
const PUBLIC_DIR = path.join(__dirname, '../public');

// Fallback values if Supabase query fails (updated 2026-02-22)
const FALLBACK_MAX_KINGDOM = 1260;
const FALLBACK_MAX_KVK = 11;

// Define all public static routes with their metadata
const staticRoutes = [
  { path: '/', changefreq: 'daily', priority: 1.0 },
  { path: '/rankings', changefreq: 'daily', priority: 0.9 },
  { path: '/compare', changefreq: 'weekly', priority: 0.8 },
  { path: '/tools', changefreq: 'weekly', priority: 0.7 },
  { path: '/players', changefreq: 'daily', priority: 0.7 },
  { path: '/seasons', changefreq: 'weekly', priority: 0.7 },
  { path: '/ambassadors', changefreq: 'weekly', priority: 0.6 },
  { path: '/atlas-bot', changefreq: 'monthly', priority: 0.6 },
  { path: '/tools/gift-codes', changefreq: 'weekly', priority: 0.6 },
  { path: '/changelog', changefreq: 'weekly', priority: 0.5 },
  { path: '/about', changefreq: 'monthly', priority: 0.5, lastmod: '2026-02-01' },
  { path: '/support', changefreq: 'monthly', priority: 0.4, lastmod: '2026-01-15' },
  { path: '/contribute-data', changefreq: 'monthly', priority: 0.4, lastmod: '2026-01-01' },
  { path: '/transfer-hub', changefreq: 'daily', priority: 0.8 },
  { path: '/transfer-hub/about', changefreq: 'monthly', priority: 0.6, lastmod: '2026-02-01' },
  { path: '/kingdoms/communities', changefreq: 'weekly', priority: 0.7 },
  { path: '/terms', changefreq: 'yearly', priority: 0.3, lastmod: '2025-12-01' },
  { path: '/privacy', changefreq: 'yearly', priority: 0.3, lastmod: '2025-12-01' },
];

function generateUrlEntry(urlPath, changefreq, priority, lastmod) {
  return `  <url>
    <loc>${DOMAIN}${urlPath}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

function wrapUrlset(entries) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`;
}

function generateSitemapIndex(sitemaps, today) {
  const entries = sitemaps.map(s => `  <sitemap>
    <loc>${DOMAIN}/${s.file}</loc>
    <lastmod>${s.lastmod || today}</lastmod>
  </sitemap>`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</sitemapindex>
`;
}

/**
 * Query Supabase REST API for kingdom data and max KvK.
 * Now fetches last_updated for accurate lastmod dates.
 * Returns { kingdoms: Array<{kingdom_number, last_updated}>, maxKvk: number } or null.
 */
async function fetchFromSupabase() {
  const url = process.env.VITE_SUPABASE_URL || '';
  const key = process.env.VITE_SUPABASE_ANON_KEY || '';

  if (!url || !key) {
    console.log('   ⚠️  Supabase env vars not set, using fallback values');
    return null;
  }

  try {
    // Fetch kingdom numbers + last_updated for accurate lastmod
    const kRes = await fetch(
      `${url}/rest/v1/kingdoms?select=kingdom_number,last_updated&order=kingdom_number.asc&limit=5000`,
      {
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`,
        },
      }
    );
    if (!kRes.ok) throw new Error(`kingdoms query failed: ${kRes.status}`);
    const kingdoms = await kRes.json();

    // Fetch max KvK number
    const kvkRes = await fetch(
      `${url}/rest/v1/kvk_history?select=kvk_number&order=kvk_number.desc&limit=1`,
      {
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`,
        },
      }
    );
    if (!kvkRes.ok) throw new Error(`kvk query failed: ${kvkRes.status}`);
    const kvkData = await kvkRes.json();
    const maxKvk = kvkData.length > 0 ? kvkData[0].kvk_number : FALLBACK_MAX_KVK;

    return { kingdoms, maxKvk };
  } catch (err) {
    console.log(`   ⚠️  Supabase query failed: ${err.message}, using fallback values`);
    return null;
  }
}

/**
 * Load .env file manually (no dotenv dependency needed).
 */
function loadEnvFile() {
  const envPath = path.join(__dirname, '../.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

/** Convert ISO timestamp to YYYY-MM-DD, falling back to today */
function toDateStr(isoStr, fallback) {
  if (!isoStr) return fallback;
  try {
    return new Date(isoStr).toISOString().split('T')[0];
  } catch {
    return fallback;
  }
}

async function generateSitemaps() {
  // Load .env if running locally (CI will have env vars already set)
  loadEnvFile();
  const today = new Date().toISOString().split('T')[0];
  
  let kingdoms;
  let maxKvk;
  let source;

  // Try to fetch live data from Supabase
  const data = await fetchFromSupabase();
  if (data && data.kingdoms.length > 0) {
    kingdoms = data.kingdoms;
    maxKvk = data.maxKvk;
    source = 'Supabase (live)';
  }

  // Fallback to hardcoded range
  if (!kingdoms) {
    kingdoms = Array.from({ length: FALLBACK_MAX_KINGDOM }, (_, i) => ({
      kingdom_number: i + 1,
      last_updated: null,
    }));
    maxKvk = FALLBACK_MAX_KVK;
    source = 'fallback (hardcoded)';
  }

  // --- 1. Static sitemap ---
  const staticEntries = staticRoutes.map(route => 
    generateUrlEntry(route.path, route.changefreq, route.priority, route.lastmod || today)
  );
  const staticSitemap = wrapUrlset(staticEntries);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap-static.xml'), staticSitemap);

  // --- 2. Kingdom sitemap (with real lastmod from Supabase) ---
  let latestKingdomUpdate = today;
  const kingdomEntries = kingdoms.map(k => {
    const lastmod = toDateStr(k.last_updated, today);
    if (lastmod > latestKingdomUpdate) latestKingdomUpdate = lastmod;
    return generateUrlEntry(`/kingdom/${k.kingdom_number}`, 'weekly', 0.8, lastmod);
  });
  const kingdomSitemap = wrapUrlset(kingdomEntries);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap-kingdoms.xml'), kingdomSitemap);

  // --- 3. Season sitemap ---
  const seasonEntries = [];
  for (let i = 1; i <= maxKvk + 1; i++) {
    seasonEntries.push(
      generateUrlEntry(`/seasons/${i}`, 'monthly', 0.6, today)
    );
  }
  const seasonSitemap = wrapUrlset(seasonEntries);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap-seasons.xml'), seasonSitemap);

  // --- 4. Sitemap index ---
  const sitemapIndex = generateSitemapIndex([
    { file: 'sitemap-static.xml', lastmod: today },
    { file: 'sitemap-kingdoms.xml', lastmod: latestKingdomUpdate },
    { file: 'sitemap-seasons.xml', lastmod: today },
  ], today);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap.xml'), sitemapIndex);

  // --- Summary ---
  const totalUrls = staticEntries.length + kingdomEntries.length + seasonEntries.length;
  console.log(`✅ Sitemap index generated with 3 sub-sitemaps`);
  console.log(`   📡 Source: ${source}`);
  console.log(`   📄 ${staticRoutes.length} static pages → sitemap-static.xml`);
  console.log(`   🏰 ${kingdoms.length} kingdom profiles → sitemap-kingdoms.xml (max: K${kingdoms[kingdoms.length - 1].kingdom_number})`);
  console.log(`   ⚔️  ${maxKvk + 1} KvK season pages → sitemap-seasons.xml`);
  console.log(`   📊 ${totalUrls} total URLs across all sitemaps`);
  console.log(`   📅 Kingdom lastmod: real timestamps from Supabase`);
}

generateSitemaps();
