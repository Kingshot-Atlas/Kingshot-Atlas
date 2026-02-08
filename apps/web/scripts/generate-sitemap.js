#!/usr/bin/env node

/**
 * Sitemap Generator for Kingshot Atlas
 * 
 * Dynamically generates sitemap.xml by querying Supabase for:
 * - Actual kingdom numbers (not a hardcoded range)
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
const OUTPUT_PATH = path.join(__dirname, '../public/sitemap.xml');

// Fallback values if Supabase query fails (updated 2026-02-08)
const FALLBACK_MAX_KINGDOM = 1260;
const FALLBACK_MAX_KVK = 11;

// Supabase config is read dynamically after .env loading (see fetchFromSupabase)

// Define all public static routes with their metadata
const staticRoutes = [
  { path: '/', changefreq: 'daily', priority: 1.0 },
  { path: '/rankings', changefreq: 'daily', priority: 0.9 },
  { path: '/compare', changefreq: 'weekly', priority: 0.8 },
  { path: '/tools', changefreq: 'weekly', priority: 0.7 },
  { path: '/players', changefreq: 'daily', priority: 0.7 },
  { path: '/seasons', changefreq: 'weekly', priority: 0.7 },
  { path: '/atlas-bot', changefreq: 'monthly', priority: 0.6 },
  { path: '/changelog', changefreq: 'weekly', priority: 0.5 },
  { path: '/about', changefreq: 'monthly', priority: 0.5 },
  { path: '/support', changefreq: 'monthly', priority: 0.4 },
  { path: '/contribute-data', changefreq: 'monthly', priority: 0.4 },
];

function generateUrlEntry(urlPath, changefreq, priority, lastmod) {
  return `  <url>
    <loc>${DOMAIN}${urlPath}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

/**
 * Query Supabase REST API for kingdom numbers and max KvK.
 * Returns { kingdomNumbers: number[], maxKvk: number } or null on failure.
 */
async function fetchFromSupabase() {
  const url = process.env.VITE_SUPABASE_URL || '';
  const key = process.env.VITE_SUPABASE_ANON_KEY || '';

  if (!url || !key) {
    console.log('   ⚠️  Supabase env vars not set, using fallback values');
    return null;
  }

  try {
    // Fetch all kingdom numbers (only the column we need)
    const kRes = await fetch(
      `${url}/rest/v1/kingdoms?select=kingdom_number&order=kingdom_number.asc&limit=5000`,
      {
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`,
        },
      }
    );
    if (!kRes.ok) throw new Error(`kingdoms query failed: ${kRes.status}`);
    const kingdoms = await kRes.json();
    const kingdomNumbers = kingdoms.map(k => k.kingdom_number);

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

    return { kingdomNumbers, maxKvk };
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

async function generateMainSitemap() {
  // Load .env if running locally (CI will have env vars already set)
  loadEnvFile();
  const today = new Date().toISOString().split('T')[0];
  
  let kingdomNumbers;
  let maxKvk;
  let source;

  // Try to fetch live data from Supabase
  const data = await fetchFromSupabase();
  if (data && data.kingdomNumbers.length > 0) {
    kingdomNumbers = data.kingdomNumbers;
    maxKvk = data.maxKvk;
    source = 'Supabase (live)';
  }

  // Fallback to hardcoded range
  if (!kingdomNumbers) {
    kingdomNumbers = Array.from({ length: FALLBACK_MAX_KINGDOM }, (_, i) => i + 1);
    maxKvk = FALLBACK_MAX_KVK;
    source = 'fallback (hardcoded)';
  }

  // Static routes
  const staticEntries = staticRoutes.map(route => 
    generateUrlEntry(route.path, route.changefreq, route.priority, today)
  );

  // Kingdom profile pages
  const kingdomEntries = kingdomNumbers.map(num =>
    generateUrlEntry(`/kingdom/${num}`, 'weekly', 0.8, today)
  );

  // KvK season pages (include next upcoming season)
  const seasonEntries = [];
  for (let i = 1; i <= maxKvk + 1; i++) {
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
  
  const totalUrls = allEntries.length;
  console.log(`✅ Sitemap generated: ${OUTPUT_PATH}`);
  console.log(`   � Source: ${source}`);
  console.log(`   �� ${staticRoutes.length} static pages`);
  console.log(`   🏰 ${kingdomNumbers.length} kingdom profiles (max: ${kingdomNumbers[kingdomNumbers.length - 1]})`);
  console.log(`   ⚔️  ${maxKvk + 1} KvK season pages`);
  console.log(`   📊 ${totalUrls} total URLs`);
  console.log(`   📅 Last modified: ${today}`);
}

generateMainSitemap();
