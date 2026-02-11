#!/usr/bin/env node
/**
 * i18n Hardcoded String Detector
 * 
 * Scans .tsx files for hardcoded user-facing strings that should use t().
 * Detects text content in JSX (>Text</) in files missing useTranslation.
 * 
 * Usage: node scripts/i18n-check-hardcoded.js [--strict]
 *   --strict: exit code 1 if any public-facing files have hardcoded strings
 * 
 * Files in IGNORE_PATTERNS are skipped (admin, test, demo, utility components).
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src');
const strict = process.argv.includes('--strict');

// Files that are admin-only or non-user-facing — skip these
const IGNORE_PATTERNS = [
  /Admin/i,
  /Dashboard/i,
  /\.test\./,
  /ComponentsDemo/,
  /ErrorBoundary/,
  /RouteErrorBoundary/,
  /Skeleton/,
  /LazyCard/,
  /LazyImage/,
  /OptimizedImage/,
  /ParticleEffect/,
  /Toast\.tsx/,
  /Tooltip\.tsx/,
  /DonutChart/,
  /AuthCallback/,
  /DiscordCallback/,
  /DataAttribution/,
  /AdBanner/,
  /ProBadge/,
  /QRCode/,
  /WebhookMonitor/,
  /BotDashboard/,
  /DataSourceStats/,
  /DiscordRolesDashboard/,
  /EngagementDashboard/,
];

function shouldIgnore(filePath) {
  const name = path.basename(filePath);
  return IGNORE_PATTERNS.some(p => p.test(name));
}

function collectTsxFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      results.push(...collectTsxFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.tsx') && !shouldIgnore(full)) {
      results.push(full);
    }
  }
  return results;
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const usesI18n = content.includes('useTranslation');
  
  // Find hardcoded text in JSX: >SomeText</  (3+ chars, starts with uppercase)
  const hardcoded = content.match(/>[A-Z][a-zA-Z ]{2,}<\//g) || [];
  // Filter out common false positives
  const filtered = hardcoded.filter(m => {
    const text = m.slice(1, -2).trim();
    // Skip single words that are likely component names or abbreviations
    if (text.length <= 3) return false;
    // Skip things that look like CSS class references
    if (text.includes('_')) return false;
    return true;
  });

  return {
    path: filePath,
    relative: path.relative(SRC_DIR, filePath),
    usesI18n,
    hardcodedCount: filtered.length,
    examples: filtered.slice(0, 5).map(m => m.slice(1, -2).trim()),
  };
}

function main() {
  console.log('\n🔍 i18n Hardcoded String Report\n');
  console.log('='.repeat(60));

  const files = collectTsxFiles(SRC_DIR);
  const results = files
    .map(checkFile)
    .filter(r => r.hardcodedCount > 0 && !r.usesI18n)
    .sort((a, b) => b.hardcodedCount - a.hardcodedCount);

  const totalFiles = files.length;
  const i18nFiles = files.filter(f => fs.readFileSync(f, 'utf-8').includes('useTranslation')).length;
  const flaggedFiles = results.length;
  const totalHardcoded = results.reduce((sum, r) => sum + r.hardcodedCount, 0);

  if (results.length === 0) {
    console.log('\n✅ No hardcoded strings detected in public-facing components!\n');
  } else {
    console.log(`\n⚠️  ${flaggedFiles} file(s) with hardcoded strings (no useTranslation):\n`);
    for (const r of results) {
      console.log(`  📄 ${r.relative}: ~${r.hardcodedCount} hardcoded strings`);
      for (const ex of r.examples) {
        console.log(`     e.g. "${ex}"`);
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Coverage:');
  console.log(`   Total .tsx files scanned: ${totalFiles}`);
  console.log(`   Files with useTranslation: ${i18nFiles} (${Math.round(i18nFiles / totalFiles * 100)}%)`);
  console.log(`   Files flagged: ${flaggedFiles}`);
  console.log(`   Total hardcoded strings: ${totalHardcoded}`);
  console.log('');

  if (strict && results.length > 0) {
    console.log('❌ Strict mode: failing due to hardcoded strings\n');
    process.exit(1);
  }
}

main();
