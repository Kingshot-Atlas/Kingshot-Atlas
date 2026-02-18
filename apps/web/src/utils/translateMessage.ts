// Lightweight message translation utility using MyMemory free API
// No API key required for reasonable usage (< 5000 chars/day)
import { logger } from './logger';

const CACHE = new Map<string, string>();

export async function translateMessage(text: string, targetLang: string): Promise<string> {
  if (!text.trim()) return text;
  const cacheKey = `${targetLang}:${text}`;
  if (CACHE.has(cacheKey)) return CACHE.get(cacheKey)!;

  try {
    // Map i18n language codes to ISO 639-1 codes MyMemory expects
    const langMap: Record<string, string> = {
      en: 'en', es: 'es', fr: 'fr', zh: 'zh-CN', de: 'de',
      ko: 'ko', ja: 'ja', ar: 'ar', tr: 'tr', pt: 'pt',
      ru: 'ru', it: 'it', hi: 'hi', th: 'th', vi: 'vi',
    };
    const target = langMap[targetLang] || targetLang;

    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 500))}&langpair=autodetect|${target}`
    );
    if (!res.ok) throw new Error(`Translation API returned ${res.status}`);
    const data = await res.json();
    const translated = data?.responseData?.translatedText;
    if (translated && translated !== text) {
      CACHE.set(cacheKey, translated);
      return translated;
    }
    return text;
  } catch (err) {
    logger.error('Translation failed:', err);
    throw err;
  }
}

export function getBrowserLanguage(): string {
  // Use i18next language if available, otherwise browser navigator
  const i18nLang = document.documentElement.lang;
  if (i18nLang && i18nLang !== 'en') return i18nLang.split('-')[0] || 'en';
  const nav = navigator.language || (navigator as { userLanguage?: string }).userLanguage || 'en';
  return nav.split('-')[0] || 'en';
}
