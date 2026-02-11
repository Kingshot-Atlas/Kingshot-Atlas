#!/usr/bin/env node
/**
 * i18n Language Template Generator
 * 
 * Creates a new language file from the English reference,
 * with all values prefixed with [LANG] to mark them for translation.
 * 
 * Usage: node scripts/i18n-add-language.js <language-code>
 * Example: node scripts/i18n-add-language.js fr
 *          node scripts/i18n-add-language.js zh
 * 
 * This generates src/locales/<lang>/translation.json with all EN keys
 * and values prefixed with the language code for easy find-and-translate.
 * 
 * After generating, you can:
 * 1. Translate the values (remove the [LANG] prefix)
 * 2. Register the language in src/i18n.ts
 * 3. Add the language option to the Header language switcher
 */

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'src', 'locales');

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
    console.error('Example: node scripts/i18n-add-language.js fr');
    process.exit(1);
  }

  const targetDir = path.join(LOCALES_DIR, langCode);
  const targetFile = path.join(targetDir, 'translation.json');

  // Check if language already exists
  if (fs.existsSync(targetFile)) {
    console.error(`⚠️  Language "${langCode}" already exists at ${targetFile}`);
    console.error('   Use i18n-validate.js to check for missing keys instead.');
    process.exit(1);
  }

  // Load English reference
  const enFile = path.join(LOCALES_DIR, 'en', 'translation.json');
  if (!fs.existsSync(enFile)) {
    console.error('❌ English reference file not found!');
    process.exit(1);
  }

  const enData = JSON.parse(fs.readFileSync(enFile, 'utf-8'));
  const template = prefixValues(enData, langCode);

  // Create directory and write file
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(targetFile, JSON.stringify(template, null, 2) + '\n', 'utf-8');

  console.log(`\n✅ Created ${targetFile}`);
  console.log(`   ${Object.keys(enData).length} top-level sections`);
  console.log(`\n📋 Next steps:`);
  console.log(`   1. Translate all values in ${targetFile}`);
  console.log(`      (values are prefixed with [${langCode.toUpperCase()}] — remove prefix after translating)`);
  console.log(`   2. Add import to src/i18n.ts:`);
  console.log(`      import ${langCode} from './locales/${langCode}/translation.json';`);
  console.log(`   3. Add to resources in i18n.ts:`);
  console.log(`      ${langCode}: { translation: ${langCode} },`);
  console.log(`   4. Add language option to Header.tsx language switcher`);
  console.log(`   5. Run: node scripts/i18n-validate.js`);
  console.log('');
}

main();
