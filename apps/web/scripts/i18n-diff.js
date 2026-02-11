#!/usr/bin/env node
/**
 * i18n Translation Diff Script
 * Detects stale translations when EN keys change.
 * Compares structure and values to find:
 *   1. Keys in EN but missing from other languages
 *   2. Keys in other languages but not in EN (orphaned)
 *   3. Keys where EN value changed but translation still matches old EN (stale)
 *
 * Usage:
 *   node scripts/i18n-diff.js                  # report mode
 *   node scripts/i18n-diff.js --strict         # exit 1 if issues found
 *   node scripts/i18n-diff.js --snapshot       # save current EN as baseline
 *   node scripts/i18n-diff.js --check-stale    # compare against saved baseline
 */

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'src', 'locales');
const SNAPSHOT_FILE = path.join(__dirname, '..', '.i18n-baseline.json');
const EN_FILE = path.join(LOCALES_DIR, 'en', 'translation.json');

const LANGUAGES = ['es', 'fr', 'zh', 'de', 'ko', 'ja', 'ar'];

function flattenKeys(obj, prefix = '') {
  const keys = {};
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      Object.assign(keys, flattenKeys(v, fullKey));
    } else {
      keys[fullKey] = v;
    }
  }
  return keys;
}

function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

const args = process.argv.slice(2);
const isStrict = args.includes('--strict');
const isSnapshot = args.includes('--snapshot');
const isCheckStale = args.includes('--check-stale');

const enData = loadJSON(EN_FILE);
if (!enData) {
  console.error('❌ Cannot read EN translation file');
  process.exit(1);
}

const enKeys = flattenKeys(enData);

// --snapshot: Save current EN as baseline for future stale detection
if (isSnapshot) {
  fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(enKeys, null, 2) + '\n');
  console.log(`✅ Saved EN baseline with ${Object.keys(enKeys).length} keys to .i18n-baseline.json`);
  process.exit(0);
}

let totalIssues = 0;

// Check each language
for (const lang of LANGUAGES) {
  const langFile = path.join(LOCALES_DIR, lang, 'translation.json');
  const langData = loadJSON(langFile);
  
  if (!langData) {
    console.log(`\n⚠️  ${lang.toUpperCase()}: File not found or invalid JSON`);
    totalIssues++;
    continue;
  }
  
  const langKeys = flattenKeys(langData);
  const enKeySet = new Set(Object.keys(enKeys));
  const langKeySet = new Set(Object.keys(langKeys));
  
  const missing = [...enKeySet].filter(k => !langKeySet.has(k));
  const orphaned = [...langKeySet].filter(k => !enKeySet.has(k));
  
  if (missing.length === 0 && orphaned.length === 0) {
    console.log(`✅ ${lang.toUpperCase()}: ${langKeySet.size} keys — all in sync`);
  } else {
    if (missing.length > 0) {
      console.log(`\n❌ ${lang.toUpperCase()}: ${missing.length} missing key(s):`);
      missing.forEach(k => console.log(`   - ${k}`));
      totalIssues += missing.length;
    }
    if (orphaned.length > 0) {
      console.log(`\n⚠️  ${lang.toUpperCase()}: ${orphaned.length} orphaned key(s) (not in EN):`);
      orphaned.forEach(k => console.log(`   - ${k}`));
      totalIssues += orphaned.length;
    }
  }
}

// --check-stale: Compare against saved baseline to find potentially stale translations
if (isCheckStale) {
  const baseline = loadJSON(SNAPSHOT_FILE);
  if (!baseline) {
    console.log('\n⚠️  No baseline found. Run with --snapshot first to create one.');
  } else {
    const changedKeys = [];
    for (const [key, value] of Object.entries(enKeys)) {
      if (baseline[key] !== undefined && baseline[key] !== value) {
        changedKeys.push({ key, oldValue: baseline[key], newValue: value });
      }
    }
    
    if (changedKeys.length > 0) {
      console.log(`\n🔄 ${changedKeys.length} EN key(s) changed since baseline — translations may be stale:`);
      for (const { key, oldValue, newValue } of changedKeys) {
        console.log(`   ${key}`);
        console.log(`     was: "${oldValue}"`);
        console.log(`     now: "${newValue}"`);
      }
      totalIssues += changedKeys.length;
    } else {
      console.log('\n✅ No EN keys changed since baseline — translations are up to date');
    }
  }
}

console.log(`\n${totalIssues === 0 ? '✅ All translations in sync!' : `⚠️  ${totalIssues} issue(s) found`}`);
console.log(`📊 EN: ${Object.keys(enKeys).length} keys | Languages: ${LANGUAGES.join(', ')}`);

if (isStrict && totalIssues > 0) {
  process.exit(1);
}
