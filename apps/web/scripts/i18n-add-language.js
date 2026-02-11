#!/usr/bin/env node
/**
 * i18n Language Template Generator
 * 
 * Creates a new language file from the English reference,
 * with all values prefixed with [LANG] to mark them for translation.
 * 
 * Usage: node scripts/i18n-add-language.js <language-code>
 * Example: node scripts/i18n-add-language.js pt
 *          node scripts/i18n-add-language.js ko
 * 
 * This generates translation files in BOTH locations:
 *   - src/locales/<lang>/translation.json   (source of truth, for validation)
 *   - public/locales/<lang>/translation.json (served by HTTP backend at runtime)
 * 
 * After generating, you need to:
 * 1. Translate all values (remove the [LANG] prefix)
 * 2. Add the language code + metadata to SUPPORTED_LANGUAGES and LANGUAGE_META in src/i18n.ts
 * 3. Run: node scripts/i18n-validate.js
 * 4. Run: node scripts/i18n-sync-public.js  (copies src → public)
 */

const fs = require('fs');
const path = require('path');

const SRC_LOCALES_DIR = path.join(__dirname, '..', 'src', 'locales');
const PUBLIC_LOCALES_DIR = path.join(__dirname, '..', 'public', 'locales');

// Recursively prefix all string values with [LANG] marker
function prefixValues(obj, langCode) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = prefixValues(value, langCode);
    } else if (typeof value === 'string') {
      result[key] = `[${langCode.toUpperCase()}] ${value}`;
    } else {
      result[key] = value;
    }
  }
  return result;
}

function main() {
  const langCode = process.argv[2];

  if (!langCode) {
    console.error('Usage: node scripts/i18n-add-language.js <language-code>');
    console.error('Example: node scripts/i18n-add-language.js pt');
    process.exit(1);
  }

  const srcTargetDir = path.join(SRC_LOCALES_DIR, langCode);
  const srcTargetFile = path.join(srcTargetDir, 'translation.json');
  const pubTargetDir = path.join(PUBLIC_LOCALES_DIR, langCode);
  const pubTargetFile = path.join(pubTargetDir, 'translation.json');

  // Check if language already exists
  if (fs.existsSync(srcTargetFile)) {
    console.error(`⚠️  Language "${langCode}" already exists at ${srcTargetFile}`);
    console.error('   Use i18n-validate.js to check for missing keys instead.');
    process.exit(1);
  }

  // Load English reference
  const enFile = path.join(SRC_LOCALES_DIR, 'en', 'translation.json');
  if (!fs.existsSync(enFile)) {
    console.error('❌ English reference file not found!');
    process.exit(1);
  }

  const enData = JSON.parse(fs.readFileSync(enFile, 'utf-8'));
  const template = prefixValues(enData, langCode);
  const content = JSON.stringify(template, null, 2) + '\n';

  // Create directories and write files to BOTH locations
  fs.mkdirSync(srcTargetDir, { recursive: true });
  fs.writeFileSync(srcTargetFile, content, 'utf-8');

  fs.mkdirSync(pubTargetDir, { recursive: true });
  fs.writeFileSync(pubTargetFile, content, 'utf-8');

  console.log(`\n✅ Created translation files for "${langCode}":`);
  console.log(`   src:    ${srcTargetFile}`);
  console.log(`   public: ${pubTargetFile}`);
  console.log(`   ${Object.keys(enData).length} top-level sections`);
  console.log(`\n📋 Next steps:`);
  console.log(`   1. Translate all values in ${srcTargetFile}`);
  console.log(`      (values are prefixed with [${langCode.toUpperCase()}] — remove prefix after translating)`);
  console.log(`   2. Add to SUPPORTED_LANGUAGES and LANGUAGE_META in src/i18n.ts`);
  console.log(`   3. Run: node scripts/i18n-validate.js`);
  console.log(`   4. Run: node scripts/i18n-sync-public.js  (copies src → public)`);
  console.log('');
}

main();
