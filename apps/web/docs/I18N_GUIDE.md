# i18n Translation Guide

**Last Updated:** 2026-02-11  
**Stack:** i18next + react-i18next + i18next-http-backend  
**Languages:** English (en), Spanish (es), French (fr), Chinese (zh), German (de)

---

## Architecture Overview

```
src/locales/{lang}/translation.json   ← Source of truth (validation + EN bundled)
public/locales/{lang}/translation.json ← Runtime assets (loaded by HTTP backend)
src/i18n.ts                            ← Config, SUPPORTED_LANGUAGES, LANGUAGE_META
```

- **English** is bundled in the JS bundle for instant first paint (no flash)
- **Other languages** are loaded on demand via `i18next-http-backend` from `/locales/{lng}/translation.json`
- The `prebuild` script auto-syncs `src/locales → public/locales`

---

## Adding Translations to a New Feature

### Step 1: Add translation keys to English

Edit `src/locales/en/translation.json`. Group keys under a descriptive section:

```json
{
  "myFeature": {
    "title": "My Feature",
    "description": "This does something useful",
    "submitButton": "Submit",
    "loading": "Loading..."
  }
}
```

### Step 2: Use translations in your component

```tsx
import { useTranslation } from 'react-i18next';

const MyComponent = () => {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('myFeature.title')}</h1>
      <p>{t('myFeature.description')}</p>
      <button>{t('myFeature.submitButton')}</button>
    </div>
  );
};
```

### Step 3: Add translations for other languages

Add the same keys to all other language files:
- `src/locales/es/translation.json`
- `src/locales/fr/translation.json`
- `src/locales/zh/translation.json`
- `src/locales/de/translation.json`

### Step 4: Validate

```bash
npm run validate:i18n
```

This checks:
- All languages have the same keys as English
- All `t()` calls in code reference existing keys

### Step 5: Sync to public

```bash
npm run i18n:sync
```

Or just build — the prebuild step does this automatically.

---

## Adding a New Language

```bash
npm run i18n:add -- <code>    # e.g. npm run i18n:add -- pt
```

This creates template files in both `src/locales/` and `public/locales/` with `[LANG]` prefixed values.

Then:
1. Translate all values in `src/locales/<code>/translation.json`
2. Add the code to `SUPPORTED_LANGUAGES` and `LANGUAGE_META` in `src/i18n.ts`
3. Run `npm run validate:i18n` to verify
4. Run `npm run i18n:sync` to copy to public

---

## Translation Keys: Naming Conventions

| Pattern | Example | When |
|---------|---------|------|
| `section.key` | `home.title` | Simple page/feature keys |
| `section.subKey` | `kingdomProfile.quickStats` | Grouped feature keys |
| `common.key` | `common.loading` | Shared across multiple pages |

**Rules:**
- Use **camelCase** for all keys
- Group by feature/page, not by component
- Prefix with page name for page-specific content
- Use `common.*` for strings used in 3+ places

---

## Interpolation

```json
{ "greeting": "Welcome, {{name}}!" }
```

```tsx
t('greeting', { name: 'Player123' })
```

---

## npm Scripts Reference

| Script | Purpose |
|--------|---------|
| `npm run validate:i18n` | Check all languages match EN + all t() keys exist |
| `npm run i18n:sync` | Copy src/locales → public/locales |
| `npm run i18n:add -- <code>` | Scaffold a new language |
| `npm run i18n:check` | Detect hardcoded strings in .tsx files |

---

## CI/CD

The `validate:i18n` step runs on every PR via GitHub Actions. If you add a new `t()` call without adding the key to `en/translation.json`, the CI build will fail.

---

## Checklist for New Content

- [ ] All user-facing strings use `t('section.key')` — no hardcoded English in JSX
- [ ] Keys added to `src/locales/en/translation.json`
- [ ] Same keys added to ES, FR, ZH, DE translation files
- [ ] `npm run validate:i18n` passes
- [ ] `npm run i18n:check` shows no new hardcoded strings in your files
