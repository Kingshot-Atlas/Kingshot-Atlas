import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const BASE_URL = 'https://ks-atlas.com';
const DEFAULT_TITLE = 'Kingshot Atlas - Kingdom Rankings, KvK Results & Scouting Tool';
const DEFAULT_DESCRIPTION = 'The #1 Kingshot kingdom database. Scout opponents, find the best kingdoms, compare rankings, track KvK history. Recruit or transfer with real data.';

// All supported languages — mirrors SUPPORTED_LANGUAGES in i18n.ts
const HREFLANG_LANGS = ['en', 'es', 'fr', 'zh', 'de', 'ko', 'ja', 'ar', 'tr'] as const;

/**
 * Sets baseline meta tags (canonical, description, hreflang) on every route change.
 * Runs BEFORE page-specific useMetaTags calls, so pages that call useMetaTags
 * will override these defaults. Pages that don't will still get correct canonicals,
 * a sensible description, and full hreflang coverage.
 *
 * This ensures:
 * - Every page has a correct canonical URL (not a stale one from a previous page)
 * - Every page has a meta description (even auth-gated pages get the default)
 * - Every page has hreflang tags for all 9 languages + x-default
 */
export function useDefaultMetaTags() {
  const { pathname } = useLocation();

  useEffect(() => {
    const pageUrl = `${BASE_URL}${pathname === '/' ? '/' : pathname.replace(/\/$/, '')}`;

    // Set canonical
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.href = pageUrl;

    // Set description fallback (only if it's still the index.html default or empty)
    const descMeta = document.querySelector('meta[name="description"]') as HTMLMetaElement;
    if (descMeta) {
      // Reset to default — page-specific useMetaTags will override immediately after
      descMeta.content = DEFAULT_DESCRIPTION;
    }

    // Reset title to default — page-specific hooks override immediately
    document.title = DEFAULT_TITLE;

    // Set og:url to current page
    const ogUrl = document.querySelector('meta[property="og:url"]') as HTMLMetaElement;
    if (ogUrl) ogUrl.content = pageUrl;

    // Set hreflang tags
    const existingHreflangs = document.querySelectorAll('link[rel="alternate"][hreflang]');
    existingHreflangs.forEach(el => el.remove());

    const xDefault = document.createElement('link');
    xDefault.setAttribute('rel', 'alternate');
    xDefault.setAttribute('hreflang', 'x-default');
    xDefault.setAttribute('href', pageUrl);
    document.head.appendChild(xDefault);

    for (const lang of HREFLANG_LANGS) {
      const link = document.createElement('link');
      link.setAttribute('rel', 'alternate');
      link.setAttribute('hreflang', lang);
      link.setAttribute('href', pageUrl);
      document.head.appendChild(link);
    }
  }, [pathname]);
}
