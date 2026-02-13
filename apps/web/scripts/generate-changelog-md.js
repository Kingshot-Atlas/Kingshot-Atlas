#!/usr/bin/env node

/**
 * generate-changelog-md.js
 * 
 * Reads changelog data from src/data/changelog.json and generates docs/CHANGELOG.md.
 * This ensures the markdown changelog stays in sync with the user-facing React page.
 * 
 * Usage:
 *   node scripts/generate-changelog-md.js          — preview to stdout
 *   node scripts/generate-changelog-md.js --write   — write to docs/CHANGELOG.md
 *   node scripts/generate-changelog-md.js --check   — exit 1 if markdown is out of sync
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const JSON_PATH = path.join(__dirname, '..', 'src', 'data', 'changelog.json');
const MD_PATH = path.join(ROOT, 'docs', 'CHANGELOG.md');

const args = process.argv.slice(2);
const writeMode = args.includes('--write');
const checkMode = args.includes('--check');

// ─── Category rendering ─────────────────────────────────────────────────────

const CATEGORY_MAP = {
  new:      { heading: '✨ New',      order: 0 },
  fixed:    { heading: '🐛 Fixed',    order: 1 },
  improved: { heading: '🔧 Improved', order: 2 },
};

function formatDate(dateStr) {
  // "February 13, 2026" → "2026-02-13"
  // "January 29, 2026 (Evening)" → "2026-01-29" (strip parenthetical)
  const clean = dateStr.replace(/\s*\(.*\)/, '').trim();
  const d = new Date(clean);
  if (isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function entryToMarkdown(entry) {
  const isoDate = formatDate(entry.date);
  if (!isoDate) return '';

  // Build title from date + first "new" item or version
  const title = entry.version ? `v${entry.version}` : '';
  let lines = [`## [${isoDate}]${title ? ` — ${title}` : ''}`];
  lines.push('');

  const categories = Object.entries(CATEGORY_MAP)
    .filter(([key]) => entry[key] && entry[key].length > 0)
    .sort(([, a], [, b]) => a.order - b.order);

  for (const [key, { heading }] of categories) {
    lines.push(`### ${heading}`);
    for (const item of entry[key]) {
      lines.push(`- ${item}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ─── Main ────────────────────────────────────────────────────────────────────

if (!fs.existsSync(JSON_PATH)) {
  console.error(`❌ changelog.json not found at ${JSON_PATH}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));

// Deduplicate by ISO date (multiple entries like "Jan 29 (Evening)" merge to same date)
const byDate = new Map();
for (const entry of data) {
  const iso = formatDate(entry.date);
  if (!iso) continue;
  if (byDate.has(iso)) {
    // Merge categories
    const existing = byDate.get(iso);
    for (const cat of ['new', 'fixed', 'improved']) {
      if (entry[cat]) {
        existing[cat] = [...(existing[cat] || []), ...entry[cat]];
      }
    }
    // Keep earliest version
    if (!existing.version && entry.version) existing.version = entry.version;
  } else {
    byDate.set(iso, { ...entry });
  }
}

// Sort by date descending (newest first)
const sorted = [...byDate.values()].sort((a, b) => {
  const da = formatDate(a.date);
  const db = formatDate(b.date);
  return db.localeCompare(da);
});

const header = `# Changelog

All notable changes to Kingshot Atlas are documented here.
*Auto-generated from \`src/data/changelog.json\` — do not edit manually.*

---

`;

const body = sorted.map(entryToMarkdown).join('---\n\n');

const footer = `---

## Previous Changes

*Historical changes will be added as patch notes are compiled.*

---

*Maintained by Release Manager*
`;

const generated = header + body + footer;

if (checkMode) {
  if (!fs.existsSync(MD_PATH)) {
    console.error('❌ CHANGELOG.md does not exist');
    process.exit(1);
  }
  const current = fs.readFileSync(MD_PATH, 'utf-8');
  // Compare dates present in both — not exact content match (markdown has manual entries)
  const genDates = new Set([...generated.matchAll(/^## \[(\d{4}-\d{2}-\d{2})\]/gm)].map(m => m[1]));
  const curDates = new Set([...current.matchAll(/^## \[(\d{4}-\d{2}-\d{2})\]/gm)].map(m => m[1]));
  
  const missingFromMd = [...genDates].filter(d => !curDates.has(d));
  if (missingFromMd.length > 0) {
    console.error(`❌ CHANGELOG.md is missing ${missingFromMd.length} date(s) from changelog.json: ${missingFromMd.join(', ')}`);
    console.error('   Run: npm run changelog:sync to update');
    process.exit(1);
  }
  console.log('✅ CHANGELOG.md is in sync with changelog.json');
  process.exit(0);
}

if (writeMode) {
  fs.writeFileSync(MD_PATH, generated, 'utf-8');
  console.log(`✅ CHANGELOG.md updated (${sorted.length} entries)`);
} else {
  console.log(generated);
  console.log('---');
  console.log(`ℹ️  Preview only. Use --write to update docs/CHANGELOG.md`);
}
