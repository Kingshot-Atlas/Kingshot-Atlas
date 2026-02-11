#!/usr/bin/env node
/**
 * i18n Public Sync Script
 * 
 * Copies translation files from src/locales/ → public/locales/
 * so the HTTP backend can serve them at runtime.
 * 
 * src/locales/ is the source of truth (used by validation + bundled EN).
 * public/locales/ is what gets served to browsers for non-EN languages.
 * 
 * Usage: node scripts/i18n-sync-public.js
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src', 'locales');
const PUB_DIR = path.join(__dirname, '..', 'public', 'locales');

function sync() {
  const languages = fs.readdirSync(SRC_DIR)
    .filter(f => fs.statSync(path.join(SRC_DIR, f)).isDirectory());

  let synced = 0;

  for (const lang of languages) {
    const srcFile = path.join(SRC_DIR, lang, 'translation.json');
    if (!fs.existsSync(srcFile)) continue;

    const pubDir = path.join(PUB_DIR, lang);
    const pubFile = path.join(pubDir, 'translation.json');

    fs.mkdirSync(pubDir, { recursive: true });
    fs.copyFileSync(srcFile, pubFile);
    synced++;
  }

  console.log(`✅ Synced ${synced} language(s) from src/locales → public/locales`);
  console.log(`   Languages: ${languages.join(', ')}`);
}

sync();
