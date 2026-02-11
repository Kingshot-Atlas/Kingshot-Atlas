import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';

// English is bundled for instant first paint (no flash of untranslated content)
import en from './locales/en/translation.json';

// Supported languages — add new languages here and in public/locales/{code}/
export const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'zh', 'de', 'ko', 'ja', 'ar', 'tr'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

// Language metadata for UI (Header, etc.)
// dir: 'ltr' | 'rtl' — used to set document direction for RTL languages (e.g., Arabic)
export const LANGUAGE_META: Record<SupportedLanguage, { label: string; flag: string; dir: 'ltr' | 'rtl' }> = {
  en: { label: 'English', flag: '🇺🇸', dir: 'ltr' },
  es: { label: 'Español', flag: '🇪🇸', dir: 'ltr' },
  fr: { label: 'Français', flag: '🇫🇷', dir: 'ltr' },
  zh: { label: '中文', flag: '🇨🇳', dir: 'ltr' },
  de: { label: 'Deutsch', flag: '🇩🇪', dir: 'ltr' },
  ko: { label: '한국어', flag: '🇰🇷', dir: 'ltr' },
  ja: { label: '日本語', flag: '🇯🇵', dir: 'ltr' },
  ar: { label: 'العربية', flag: '🇸🇦', dir: 'rtl' },
  tr: { label: 'Türkçe', flag: '🇹🇷', dir: 'ltr' },
};

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // English bundled inline; other languages loaded on demand from /locales/{lng}/
    partialBundledLanguages: true,
    resources: {
      en: { translation: en },
    },
    supportedLngs: [...SUPPORTED_LANGUAGES],
    nonExplicitSupportedLngs: true, // es-MX, es-419, en-US etc. map to 'es', 'en'
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
  });

// Set document direction and lang on every language change (including initial detection)
i18n.on('languageChanged', (lng: string) => {
  const meta = LANGUAGE_META[lng as SupportedLanguage];
  if (meta) {
    document.documentElement.dir = meta.dir;
    document.documentElement.lang = lng;
  }
});

export default i18n;
