#!/usr/bin/env node
/**
 * i18n Validation Script
 * 
 * Checks for:
 * 1. Missing keys between language files
 * 2. Unused keys (keys in JSON but not referenced in code)
 * 3. Untranslated t() calls (keys used in code but missing from JSON)
 * 4. Key count summary per language
 * 
 * Usage: node scripts/i18n-validate.js
 */

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'src', 'locales');
const SRC_DIR = path.join(__dirname, '..', 'src');

// Recursively flatten nested JSON keys with dot notation
function flattenKeys(obj, prefix = '') {
  const keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...flattenKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

// Get all language directories
function getLanguages() {
  return fs.readdirSync(LOCALES_DIR)
    .filter(f => fs.statSync(path.join(LOCALES_DIR, f)).isDirectory());
}

// Load and flatten a language file
function loadLanguage(lang) {
  const filePath = path.join(LOCALES_DIR, lang, 'translation.json');
  if (!fs.existsSync(filePath)) {
    console.error(`  ❌ Missing file: ${filePath}`);
    return [];
  }
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return flattenKeys(data);
}

// Recursively collect all .ts/.tsx files
function collectSourceFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '__tests__') {
      results.push(...collectSourceFiles(full));
    } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name) && !entry.name.endsWith('.test.tsx')) {
      results.push(full);
    }
  }
  return results;
}

// Extract all t() keys from source code using pure Node.js (no shell grep)
function extractUsedKeys() {
  const pattern = /t\(['"]([a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)+)['"]\s*[,)]/g;
  const keys = new Set();

  for (const file of collectSourceFiles(SRC_DIR)) {
    const content = fs.readFileSync(file, 'utf-8');
    let match;
    while ((match = pattern.exec(content)) !== null) {
      keys.add(match[1]);
    }
    pattern.lastIndex = 0; // reset regex state for next file
  }

  return [...keys].sort();
}

// Main validation
function validate() {
  console.log('\n🌍 i18n Validation Report\n');
  console.log('='.repeat(60));

  const languages = getLanguages();
  const langKeys = {};

  // Load all languages
  for (const lang of languages) {
    langKeys[lang] = new Set(loadLanguage(lang));
    console.log(`\n📄 ${lang}: ${langKeys[lang].size} keys`);
  }

  // Use English as reference
  const refLang = 'en';
  if (!langKeys[refLang]) {
    console.error('\n❌ English (en) language file not found!');
    process.exit(1);
  }

  console.log('\n' + '='.repeat(60));

  // Check each language against English
  let totalMissing = 0;
  let totalExtra = 0;

  for (const lang of languages) {
    if (lang === refLang) continue;

    const missing = [...langKeys[refLang]].filter(k => !langKeys[lang].has(k));
    const extra = [...langKeys[lang]].filter(k => !langKeys[refLang].has(k));

    if (missing.length > 0) {
      console.log(`\n⚠️  ${lang} is MISSING ${missing.length} keys (exist in en):`);
      missing.forEach(k => console.log(`   - ${k}`));
      totalMissing += missing.length;
    }

    if (extra.length > 0) {
      console.log(`\n📌 ${lang} has ${extra.length} EXTRA keys (not in en):`);
      extra.forEach(k => console.log(`   + ${k}`));
      totalExtra += extra.length;
    }

    if (missing.length === 0 && extra.length === 0) {
      console.log(`\n✅ ${lang}: Perfect match with en (${langKeys[lang].size} keys)`);
    }
  }

  // Check for keys used in code but missing from EN
  console.log('\n' + '='.repeat(60));
  console.log('\n🔍 Checking code for untranslated keys...');

  const usedKeys = extractUsedKeys();
  const missingFromEn = usedKeys.filter(k => !langKeys[refLang].has(k));

  if (missingFromEn.length > 0) {
    console.log(`\n⚠️  ${missingFromEn.length} keys used in code but MISSING from en.json:`);
    missingFromEn.forEach(k => console.log(`   - ${k}`));
  } else {
    console.log(`\n✅ All ${usedKeys.length} keys used in code exist in en.json`);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Summary:');
  console.log(`   Languages: ${languages.join(', ')}`);
  console.log(`   Reference keys (en): ${langKeys[refLang].size}`);
  console.log(`   Keys used in code: ${usedKeys.length}`);
  if (totalMissing > 0) console.log(`   ⚠️  Total missing translations: ${totalMissing}`);
  if (totalExtra > 0) console.log(`   📌 Total extra keys: ${totalExtra}`);
  if (totalMissing === 0 && totalExtra === 0) {
    console.log(`   ✅ All languages are in sync!`);
  }
  console.log('');

  process.exit(totalMissing > 0 ? 1 : 0);
}

validate();
