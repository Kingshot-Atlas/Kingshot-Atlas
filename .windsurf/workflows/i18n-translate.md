---
description: Translate new or changed content into all supported languages (ES/FR/ZH/DE/KO/JA/AR/TR)
---

# i18n Translation Workflow

Use this workflow whenever new user-facing strings are added to the codebase, or when existing EN strings change and translations need updating.

## When to Use
- After adding a new feature/page with user-facing text
- After modifying existing EN translation values
- When `npm run i18n:diff` reports issues
- When `npm run validate:i18n` shows missing keys

## Steps

### 1. Identify what needs translating
```bash
cd apps/web
npm run i18n:diff           # Shows missing/orphaned keys across languages
npm run validate:i18n       # Shows keys used in code but missing from JSON
npm run i18n:check          # Shows .tsx files with hardcoded strings (no useTranslation)
```

### 2. Extract hardcoded strings (if new component)
For each .tsx file flagged by `i18n:check`:
1. Add `import { useTranslation } from 'react-i18next';` at the top
2. Add `const { t } = useTranslation();` inside the component
3. Replace each hardcoded string with `t('section.keyName')`
4. Follow naming convention: `sectionName.camelCaseKey`

### 3. Add EN keys to `src/locales/en/translation.json`
- Group under a section matching the component name (camelCase)
- Use interpolation for dynamic values: `"greeting": "Hello {{name}}"`
- Use `_one`/`_other` suffixes for plurals: `"items_one": "{{count}} item"`, `"items_other": "{{count}} items"`

### 4. Translate to all languages
For each new/changed key in EN, add the translation to:
- `src/locales/es/translation.json` (Spanish)
- `src/locales/fr/translation.json` (French)
- `src/locales/zh/translation.json` (Chinese)
- `src/locales/de/translation.json` (German)
- `src/locales/ko/translation.json` (Korean)
- `src/locales/ja/translation.json` (Japanese)
- `src/locales/ar/translation.json` (Arabic — RTL language, ensure `dir: 'rtl'` in LANGUAGE_META)
- `src/locales/tr/translation.json` (Turkish)

**Translation quality guidelines:**
- Use natural phrasing, not literal word-for-word translation
- Preserve interpolation variables exactly: `{{count}}`, `{{name}}`
- Preserve emoji placement
- For plural forms: add `_one`/`_other` variants (Chinese and Japanese use same form for both)
- For game-specific terms (KvK, Prep, Battle), keep English or use established translations

### 5. Sync and validate
```bash
npm run i18n:sync           # Copy src/locales → public/locales
npm run i18n:diff            # Verify all languages in sync
npm run validate:i18n        # Verify all code keys exist in JSON
npm run i18n:snapshot        # Save baseline for future stale detection
```

### 6. Build verification
```bash
npm run build               # Ensure no TypeScript/compilation errors
```

## Integration with /task
When `/task` routes to the Product Engineer and the task involves:
- New UI components with text → run this workflow after implementation
- Text changes to existing components → run steps 4-6

## Available npm scripts
| Script | Purpose |
|--------|---------|
| `i18n:sync` | Copy src/locales → public/locales |
| `i18n:diff` | Check for missing/orphaned/stale keys |
| `i18n:snapshot` | Save EN baseline for stale detection |
| `i18n:check` | Find .tsx files with hardcoded strings |
| `i18n:add` | Scaffold a new language |
| `validate:i18n` | Full validation (CI-compatible) |

## Reference
- Source of truth: `src/locales/{lang}/translation.json`
- Runtime files: `public/locales/{lang}/translation.json` (auto-synced)
- Config: `src/i18n.ts` (SUPPORTED_LANGUAGES, LANGUAGE_META)
- Guide: `apps/web/docs/I18N_GUIDE.md`
