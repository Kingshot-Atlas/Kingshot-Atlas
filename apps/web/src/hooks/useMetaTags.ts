import { useEffect } from 'react';

interface MetaTagsOptions {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
}

/**
 * Hook to dynamically update Open Graph and Twitter meta tags
 * Useful for improving link previews when sharing kingdom profiles
 */
export const useMetaTags = (options: MetaTagsOptions) => {
  useEffect(() => {
    const { title, description, image, url, type = 'website' } = options;
    
    // Store original values to restore on unmount
    const originalTitle = document.title;
    const getMetaContent = (property: string) => {
      const meta = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
      return meta?.content || '';
    };
    
    const originalOgTitle = getMetaContent('og:title');
    const originalOgDescription = getMetaContent('og:description');
    const originalOgImage = getMetaContent('og:image');
    const originalOgUrl = getMetaContent('og:url');
    const originalOgType = getMetaContent('og:type');
    const originalTwitterTitle = getMetaContent('twitter:title');
    const originalTwitterDescription = getMetaContent('twitter:description');
    const originalTwitterImage = getMetaContent('twitter:image');

    // Helper to update or create meta tag
    const updateMeta = (property: string, content: string) => {
      let meta = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('property', property);
        document.head.appendChild(meta);
      }
      meta.content = content;
    };

    const updateTwitterMeta = (name: string, content: string) => {
      let meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', name);
        document.head.appendChild(meta);
      }
      meta.content = content;
    };

    // Update meta tags
    if (title) {
      document.title = title;
      updateMeta('og:title', title);
      updateTwitterMeta('twitter:title', title);
    }

    if (description) {
      updateMeta('og:description', description);
      updateTwitterMeta('twitter:description', description);
      // Also update the main description meta
      const descMeta = document.querySelector('meta[name="description"]') as HTMLMetaElement;
      if (descMeta) descMeta.content = description;
    }

    if (image) {
      updateMeta('og:image', image);
      updateTwitterMeta('twitter:image', image);
    }

    if (url) {
      updateMeta('og:url', url);
      // Update canonical link
      const canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      if (canonical) canonical.href = url;
    }

    updateMeta('og:type', type);

    // Cleanup: restore original values on unmount
    return () => {
      document.title = originalTitle;
      updateMeta('og:title', originalOgTitle);
      updateMeta('og:description', originalOgDescription);
      updateMeta('og:image', originalOgImage);
      updateMeta('og:url', originalOgUrl);
      updateMeta('og:type', originalOgType);
      updateTwitterMeta('twitter:title', originalTwitterTitle);
      updateTwitterMeta('twitter:description', originalTwitterDescription);
      updateTwitterMeta('twitter:image', originalTwitterImage);
    };
  }, [options]);
};

/**
 * Generate meta tags for a kingdom profile
 */
export function getKingdomMetaTags(
  kingdomNumber: number,
  kingdomName?: string,
  tier?: string,
  winRate?: number
): MetaTagsOptions {
  const name = kingdomName || `Kingdom ${kingdomNumber}`;
  const tierInfo = tier ? ` (${tier} Tier)` : '';
  const winRateInfo = winRate !== undefined ? ` | ${(winRate * 100).toFixed(0)}% KvK Win Rate` : '';
  
  return {
    title: `${name}${tierInfo} Stats & KvK History - Kingshot Kingdom Rankings`,
    description: `${name} Kingdom Rankings & Transfer Info.${winRateInfo} View KvK Event history, tier ranking, and stats. Scout before Kingshot Transfer Events.`,
    url: `https://ks-atlas.com/kingdom/${kingdomNumber}`,
    image: 'https://ks-atlas.com/Atlas%20Logo.png',
    type: 'article'
  };
};

/**
 * Generate meta tags for comparison page
 */
export const getCompareMetaTags = (
  kingdom1Number?: number,
  kingdom2Number?: number
): MetaTagsOptions => {
  if (kingdom1Number && kingdom2Number) {
    return {
      title: `Kingdom #${kingdom1Number} vs #${kingdom2Number} - Kingshot Atlas`,
      description: `Compare Kingdom #${kingdom1Number} and Kingdom #${kingdom2Number} - Head-to-head stats, win rates, and performance analysis.`,
      url: `https://ks-atlas.com/compare?kingdoms=${kingdom1Number},${kingdom2Number}`,
      type: 'website',
      image: 'https://ks-atlas.com/Atlas%20Favicon.png'
    };
  }
  
  return {
    title: 'Compare Kingdoms - Kingshot Atlas',
    description: 'Compare any two kingdoms side-by-side. Analyze stats, win rates, and performance to make informed transfer decisions.',
    url: 'https://ks-atlas.com/compare',
    type: 'website'
  };
};

/**
 * Pre-defined meta tags for static pages
 */
export const PAGE_META_TAGS = {
  home: {
    title: 'Kingshot Atlas - Kingdom Rankings, Transfer Events & KvK Results',
    description: 'The #1 database for Kingshot Transfer Events & Kingdom Rankings. Scout 1190+ kingdoms before transfer, track KvK results, compare tier lists. Essential for competitive players.',
    url: 'https://ks-atlas.com/',
    type: 'website'
  },
  leaderboards: {
    title: 'Kingshot Kingdom Rankings & Tier List 2026 - Best Kingdoms to Join',
    description: 'Official Kingshot Kingdom Rankings - S-Tier to F-Tier. Find the best kingdoms before Transfer Events. Updated weekly with KvK results. See which kingdoms dominate.',
    url: 'https://ks-atlas.com/rankings',
    type: 'website'
  },
  tools: {
    title: 'Kingshot Tools - KvK Event Calendar, Score Simulator & More',
    description: 'Free tools for Kingshot Transfer Events & KvK. Event calendar, countdown timer, Atlas Score simulator. Plan your transfer with real data.',
    url: 'https://ks-atlas.com/tools',
    type: 'website'
  },
  about: {
    title: 'About Kingshot Atlas - The #1 Transfer Event & Kingdom Intelligence Platform',
    description: 'Stop guessing before Kingshot Transfer Events. Kingshot Atlas provides Kingdom Rankings and KvK data for informed transfers. Built by players, for players.',
    url: 'https://ks-atlas.com/about',
    type: 'website'
  },
  players: {
    title: 'Kingshot Player Directory - Find Players & Recruiters for Transfer',
    description: 'Browse Kingshot Atlas users. Find players from any kingdom, connect with recruiters before Transfer Events, discover active alliances.',
    url: 'https://ks-atlas.com/players',
    type: 'website'
  },
  changelog: {
    title: 'Kingshot Atlas Changelog - Latest Updates & Features',
    description: 'See what\'s new in Kingshot Atlas. Latest features for Transfer Events, Kingdom Rankings, and KvK tracking. We ship fast for the Kingshot community.',
    url: 'https://ks-atlas.com/changelog',
    type: 'website'
  },
  support: {
    title: 'Support Kingshot Atlas - Help Build the Best Kingdom Rankings Database',
    description: 'Support Kingshot Atlas development. Get premium features, early access, and help us build the ultimate Transfer Event and KvK intelligence platform.',
    url: 'https://ks-atlas.com/support',
    type: 'website'
  },
  kvkSeasons: {
    title: 'Kingshot KvK Event History & Season Results - All KvK Data',
    description: 'Complete Kingshot KvK Event history for all seasons. Track kingdom performance across every KvK, view win rates and rankings. Essential before Transfer Events.',
    url: 'https://ks-atlas.com/seasons',
    type: 'website'
  },
  compare: {
    title: 'Compare Kingshot Kingdoms Before Transfer - Head-to-Head Analysis',
    description: 'Compare Kingshot kingdoms side-by-side before Transfer Events. Analyze KvK stats, Kingdom Rankings, win rates. Make informed transfer decisions.',
    url: 'https://ks-atlas.com/compare',
    type: 'website'
  }
} as const satisfies Record<string, MetaTagsOptions>;

export default useMetaTags;
