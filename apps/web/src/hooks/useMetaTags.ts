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
    const getNameMetaContent = (name: string) => {
      const meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
      return meta?.content || '';
    };
    const originalTwitterTitle = getNameMetaContent('twitter:title');
    const originalTwitterDescription = getNameMetaContent('twitter:description');
    const originalTwitterImage = getNameMetaContent('twitter:image');

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
      // Update or create canonical link
      let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.setAttribute('rel', 'canonical');
        document.head.appendChild(canonical);
      }
      canonical.href = url;
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
      // Update canonical to current URL on cleanup (avoid stale homepage canonical)
      const canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      if (canonical) {
        canonical.href = `https://ks-atlas.com${window.location.pathname}`;
      }
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
    image: 'https://ks-atlas.com/atlas-og.png',
    type: 'article'
  };
}

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
      image: 'https://ks-atlas.com/atlas-og.png'
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
    title: 'Kingshot Atlas - Kingdom Rankings, KvK Results & Scouting Tool',
    description: 'The #1 Kingshot kingdom database. Scout opponents, find the best kingdoms, compare rankings, track KvK history. Recruit or transfer with real data.',
    url: 'https://ks-atlas.com/',
    type: 'website'
  },
  leaderboards: {
    title: 'Kingshot Kingdom Rankings - Best Kingdoms & Tier List',
    description: 'Find the best Kingshot kingdoms ranked S-Tier to D-Tier. Kingdom rankings updated after every KvK. Scout top kingdoms before Transfer Events.',
    url: 'https://ks-atlas.com/rankings',
    type: 'website'
  },
  tools: {
    title: 'Kingshot Tools - KvK Calendar, Scouting & Score Simulator',
    description: 'Free Kingshot tools for KvK scouting: event calendar, countdown timer, kingdom comparison, Atlas Score simulator. Plan transfers with data.',
    url: 'https://ks-atlas.com/tools',
    type: 'website'
  },
  about: {
    title: 'About Kingshot Atlas - Kingdom Scouting & Recruiting Platform',
    description: 'Kingshot Atlas: the kingdom intelligence platform. Scout KvK opponents, find the best kingdoms, recruit for transfers. Built by players, for players.',
    url: 'https://ks-atlas.com/about',
    type: 'website'
  },
  players: {
    title: 'Kingshot Player Directory - Find Recruiters & Players',
    description: 'Browse Kingshot players and recruiters. Find players from any kingdom, connect before Transfer Events. Recruiting made easy.',
    url: 'https://ks-atlas.com/players',
    type: 'website'
  },
  changelog: {
    title: 'Changelog - Kingshot Atlas Updates',
    description: 'See what\'s new in Kingshot Atlas. Latest features for Transfer Events, kingdom rankings, and KvK tracking.',
    url: 'https://ks-atlas.com/changelog',
    type: 'website'
  },
  support: {
    title: 'Support Kingshot Atlas - Premium Features',
    description: 'Support Kingshot Atlas development. Get premium features, early access, and help build the ultimate KvK intelligence platform.',
    url: 'https://ks-atlas.com/support',
    type: 'website'
  },
  kvkSeasons: {
    title: 'Kingshot KvK History - All Season Results & Matchups',
    description: 'Complete Kingshot KvK history: every season, every matchup, every result. Track kingdom performance across all KvK events.',
    url: 'https://ks-atlas.com/seasons',
    type: 'website'
  },
  compare: {
    title: 'Compare Kingshot Kingdoms - Head-to-Head Scouting',
    description: 'Compare Kingshot kingdoms side-by-side. Analyze KvK stats, Atlas Scores, rankings, and win rates. Scout opponents before battle.',
    url: 'https://ks-atlas.com/compare',
    type: 'website'
  },
  atlasBot: {
    title: 'Kingshot Atlas Discord Bot - Kingdom Lookup & KvK Tools',
    description: 'Add the Atlas Discord Bot to your server. Look up kingdoms, compare matchups, check rankings — all from Discord. Free for all servers.',
    url: 'https://ks-atlas.com/atlas-bot',
    type: 'website'
  },
  transferHub: {
    title: 'Kingshot Transfer Hub - Recruit & Find Kingdoms',
    description: 'Kingshot Transfer Hub: recruit players, find kingdoms accepting transfers, apply directly. Real data for every Transfer Event. No more blind migrations.',
    url: 'https://ks-atlas.com/transfer-hub',
    type: 'website'
  },
  ambassadors: {
    title: 'Kingshot Atlas Ambassador Network - Refer & Earn',
    description: 'Join the Kingshot Atlas Ambassador Network. Refer players, earn badges, and help grow the community. Scout, recruit, and climb the ranks.',
    url: 'https://ks-atlas.com/ambassadors',
    type: 'website'
  },
  contributeData: {
    title: 'Contribute KvK Data - Kingshot Atlas',
    description: 'Submit KvK results and kingdom data to Kingshot Atlas. Help build the most accurate Kingshot database. Community-powered accuracy.',
    url: 'https://ks-atlas.com/contribute-data',
    type: 'website'
  },
  giftCodes: {
    title: 'Kingshot Gift Codes - Never Miss Free Rewards',
    description: 'Every active Kingshot gift code in one place. Copy codes and redeem them in-game — never miss free rewards again. Free tool by Kingshot Atlas.',
    url: 'https://ks-atlas.com/tools/gift-codes',
    type: 'website'
  },
  transferHubLanding: {
    title: 'Kingshot Transfer Hub - Find Your Next Kingdom or Recruit Players',
    description: 'The Kingshot Transfer Hub: browse recruiting kingdoms, create a transfer profile, apply directly. Recruiters set up listings and receive applications. 100% free, powered by real data.',
    url: 'https://ks-atlas.com/transfer-hub/about',
    type: 'website'
  },
  kingdomCommunities: {
    title: 'Kingdom Colonies | Kingshot Atlas',
    description: 'Discover the most active kingdoms on Atlas. See which kingdoms have the biggest colonies of competitive Kingshot players.',
    url: 'https://ks-atlas.com/kingdoms/communities',
    type: 'website'
  },
  terms: {
    title: 'Terms of Service - Kingshot Atlas',
    description: 'Kingshot Atlas Terms of Service. Read about usage terms, acceptable use, and user responsibilities for the kingdom intelligence platform.',
    url: 'https://ks-atlas.com/terms',
    type: 'website'
  },
  privacy: {
    title: 'Privacy Policy - Kingshot Atlas',
    description: 'Kingshot Atlas Privacy Policy. How we collect, use, and protect your data. We never sell user information.',
    url: 'https://ks-atlas.com/privacy',
    type: 'website'
  }
} as const satisfies Record<string, MetaTagsOptions>;

export default useMetaTags;
