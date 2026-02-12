import { useEffect } from 'react';

type StructuredDataType = 
  | 'FAQPage'
  | 'BreadcrumbList'
  | 'WebPage'
  | 'Organization'
  | 'KingdomProfile';

interface FAQItem {
  question: string;
  answer: string;
}

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface AggregateRating {
  ratingValue: number;
  reviewCount: number;
  bestRating: number;
  worstRating: number;
}

interface KingdomProfileData {
  kingdomNumber: number;
  kingdomName?: string;
  tier?: string;
  atlasScore?: number;
  rank?: number;
  aggregateRating?: AggregateRating | null;
}

interface StructuredDataOptions {
  type: StructuredDataType;
  data: FAQItem[] | BreadcrumbItem[] | KingdomProfileData | Record<string, unknown>;
}

/**
 * Hook to inject JSON-LD structured data for SEO
 * Automatically cleans up on unmount
 */
export const useStructuredData = (options: StructuredDataOptions) => {
  useEffect(() => {
    const { type, data } = options;
    
    let jsonLd: Record<string, unknown> = {
      '@context': 'https://schema.org',
    };

    switch (type) {
      case 'FAQPage':
        jsonLd = {
          ...jsonLd,
          '@type': 'FAQPage',
          mainEntity: (data as FAQItem[]).map(item => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: item.answer
            }
          }))
        };
        break;

      case 'BreadcrumbList':
        jsonLd = {
          ...jsonLd,
          '@type': 'BreadcrumbList',
          itemListElement: (data as BreadcrumbItem[]).map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            item: item.url
          }))
        };
        break;

      case 'WebPage':
        jsonLd = {
          ...jsonLd,
          '@type': 'WebPage',
          ...(data as Record<string, unknown>)
        };
        break;

      case 'Organization':
        jsonLd = {
          ...jsonLd,
          '@type': 'Organization',
          ...(data as Record<string, unknown>)
        };
        break;

      case 'KingdomProfile': {
        const profileData = data as KingdomProfileData;
        const baseData: Record<string, unknown> = {
          ...jsonLd,
          '@type': 'WebPage',
          name: `Kingdom ${profileData.kingdomNumber}${profileData.kingdomName ? ` - ${profileData.kingdomName}` : ''} Profile`,
          description: `View stats, KvK history, and rankings for Kingdom ${profileData.kingdomNumber} in Kingshot Atlas.`,
          url: `https://ks-atlas.com/kingdom/${profileData.kingdomNumber}`,
          isPartOf: {
            '@type': 'WebSite',
            name: 'Kingshot Atlas',
            url: 'https://ks-atlas.com'
          }
        };

        // Only include aggregateRating if it exists (5+ reviews requirement met)
        if (profileData.aggregateRating) {
          baseData.mainEntity = {
            '@type': 'Product',
            name: `Kingdom ${profileData.kingdomNumber}`,
            description: `Kingdom ${profileData.kingdomNumber} in Kingshot mobile game${profileData.tier ? ` (${profileData.tier} Tier)` : ''}`,
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: profileData.aggregateRating.ratingValue.toString(),
              reviewCount: profileData.aggregateRating.reviewCount.toString(),
              bestRating: profileData.aggregateRating.bestRating.toString(),
              worstRating: profileData.aggregateRating.worstRating.toString()
            }
          };
        }

        jsonLd = baseData;
        break;
      }
    }

    // Create and inject the script element
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = `structured-data-${type}`;
    script.text = JSON.stringify(jsonLd);
    
    // Remove existing script with same ID if present
    const existing = document.getElementById(`structured-data-${type}`);
    if (existing) {
      existing.remove();
    }
    
    document.head.appendChild(script);

    // Cleanup on unmount
    return () => {
      const scriptToRemove = document.getElementById(`structured-data-${type}`);
      if (scriptToRemove) {
        scriptToRemove.remove();
      }
    };
  }, [options]);
};

/**
 * Pre-defined FAQ data for About page
 */
export const ABOUT_FAQ_DATA: FAQItem[] = [
  {
    question: 'What is Kingshot Atlas?',
    answer: 'Kingshot Atlas is the most comprehensive analytics platform for Kingshot mobile game players. We track KvK (Kingdom vs Kingdom) results, rank kingdoms by performance, and help players make data-driven decisions about transfers and strategy.'
  },
  {
    question: 'How is the Atlas Score calculated?',
    answer: 'The Atlas Score uses a Bayesian rating system that considers win rate, KvK history, kingdom power, and performance consistency. It weights recent performance more heavily and adjusts for opponent strength.'
  },
  {
    question: 'Is Kingshot Atlas free?',
    answer: 'Yes, core features are free including kingdom rankings, basic comparisons, and KvK history. Premium features like unlimited comparisons and advanced analytics are available for supporters.'
  },
  {
    question: 'How often is the data updated?',
    answer: 'Kingdom data is updated after every KvK event, typically within 24-48 hours. Community submissions are reviewed and approved by Atlas admins to ensure data accuracy.'
  },
  {
    question: 'Can I contribute data to Kingshot Atlas?',
    answer: 'Yes! Registered users can submit KvK results and kingdom updates. All submissions are reviewed by admins before being added to the database to maintain data integrity.'
  },
  {
    question: 'What is the Transfer Hub?',
    answer: 'The Transfer Hub is where players looking for a new kingdom and recruiters seeking new members connect. Browse every kingdom with real performance data, create a Transfer Profile, apply directly, and track your applications — all without relying on Discord hearsay or blind transfers.'
  },
  {
    question: 'How do I find the best Kingshot kingdom to transfer to?',
    answer: 'Use the Kingdom Rankings page to see every kingdom ranked by Atlas Score (S through D tier). Filter by KvK experience, win rate, and more. Compare kingdoms side-by-side, then visit the Transfer Hub to apply directly to kingdoms accepting transfers.'
  },
  {
    question: 'How does Kingshot scouting work on Atlas?',
    answer: 'Kingshot Atlas lets you scout any kingdom before KvK or Transfer Events. View their KvK history, win rates, domination record, and Atlas Score. Compare your upcoming opponent head-to-head to prepare your strategy.'
  },
  {
    question: 'How do I recruit players for my kingdom?',
    answer: 'Recruiters can claim their kingdom on the Transfer Hub, set up a recruiting profile with requirements and offers, then review and manage incoming transfer applications. All backed by real kingdom performance data.'
  },
  {
    question: 'When is the next Kingshot KvK event?',
    answer: 'KvK events happen every 4 weeks. Check the KvK Countdown on the Tools page or homepage for the exact date and time. The Atlas Event Calendar shows all upcoming KvK and Transfer Event dates.'
  },
  {
    question: 'When is the next Kingshot Transfer Event?',
    answer: 'Transfer Events happen every 8 weeks with three phases: Pre-Transfer, Invitational, and Open Transfer. Check the Event Calendar on the Tools page for exact dates and use the Transfer Hub to prepare your move.'
  }
];

/**
 * Pre-defined FAQ data for Rankings page — targets featured snippets
 * for "best kingdoms", "kingdom rankings", "top tier" queries.
 */
export const RANKINGS_FAQ_DATA: FAQItem[] = [
  {
    question: 'What are the best Kingshot kingdoms?',
    answer: 'The best Kingshot kingdoms are ranked S-Tier on Atlas, scoring 57+ out of 100. Rankings are based on the Atlas Score — a Bayesian rating system that weighs KvK battle win rates, preparation performance, recent form, and experience. Check the Kingdom Rankings page for the live tier list.',
  },
  {
    question: 'How are Kingshot kingdom rankings calculated?',
    answer: 'Kingdom rankings use the Atlas Score (v3.1), a composite rating from 0-100 based on: battle win rate (55% weight), preparation win rate (45% weight), recent form multiplier, streak bonuses, and experience factor. Kingdoms are then placed into tiers: S (≥57), A (≥47), B (≥38), C (≥29), D (<29).',
  },
  {
    question: 'What is S-Tier in Kingshot Atlas?',
    answer: 'S-Tier is the highest ranking tier in Kingshot Atlas, reserved for the top ~3% of kingdoms that score 57 or above. These kingdoms have consistently strong KvK battle and preparation win rates across multiple seasons.',
  },
  {
    question: 'How often are Kingshot kingdom rankings updated?',
    answer: 'Kingdom rankings are updated after every KvK (Kingdom vs Kingdom) event, typically within 24-48 hours. Community members can also submit KvK results which are reviewed by Atlas admins before being incorporated.',
  },
  {
    question: 'How do I find a good kingdom before a Transfer Event?',
    answer: 'Use the Kingdom Rankings to filter by tier, KvK experience, and win rate. Compare kingdoms side-by-side on the Compare page, then visit the Transfer Hub to see which kingdoms are actively recruiting and apply directly with your Transfer Profile.',
  },
];

/**
 * Pre-defined breadcrumb data for key pages.
 * Google displays breadcrumbs in search results, improving CTR.
 */
const HOME_CRUMB = { name: 'Kingshot Atlas', url: 'https://ks-atlas.com/' };

export const PAGE_BREADCRUMBS = {
  rankings: [HOME_CRUMB, { name: 'Kingdom Rankings', url: 'https://ks-atlas.com/rankings' }],
  compare: [HOME_CRUMB, { name: 'Compare Kingdoms', url: 'https://ks-atlas.com/compare' }],
  tools: [HOME_CRUMB, { name: 'Tools', url: 'https://ks-atlas.com/tools' }],
  players: [HOME_CRUMB, { name: 'Player Directory', url: 'https://ks-atlas.com/players' }],
  seasons: [HOME_CRUMB, { name: 'KvK Seasons', url: 'https://ks-atlas.com/seasons' }],
  changelog: [HOME_CRUMB, { name: 'Changelog', url: 'https://ks-atlas.com/changelog' }],
  about: [HOME_CRUMB, { name: 'About', url: 'https://ks-atlas.com/about' }],
  support: [HOME_CRUMB, { name: 'Support', url: 'https://ks-atlas.com/support' }],
  contributeData: [HOME_CRUMB, { name: 'Contribute Data', url: 'https://ks-atlas.com/contribute-data' }],
  atlasBot: [HOME_CRUMB, { name: 'Atlas Bot', url: 'https://ks-atlas.com/atlas-bot' }],
  transferHub: [HOME_CRUMB, { name: 'Transfer Hub', url: 'https://ks-atlas.com/transfer-hub' }],
  ambassadors: [HOME_CRUMB, { name: 'Ambassador Network', url: 'https://ks-atlas.com/ambassadors' }],
};

/**
 * Generate breadcrumb data for a kingdom profile page.
 */
export function getKingdomBreadcrumbs(kingdomNumber: number, kingdomName?: string): { name: string; url: string }[] {
  return [
    HOME_CRUMB,
    { name: 'Kingdom Rankings', url: 'https://ks-atlas.com/rankings' },
    { name: kingdomName || `Kingdom ${kingdomNumber}`, url: `https://ks-atlas.com/kingdom/${kingdomNumber}` },
  ];
}

/**
 * Generate breadcrumb data for a KvK season page.
 */
export function getSeasonBreadcrumbs(seasonNumber: number): { name: string; url: string }[] {
  return [
    HOME_CRUMB,
    { name: 'KvK Seasons', url: 'https://ks-atlas.com/seasons' },
    { name: `Season ${seasonNumber}`, url: `https://ks-atlas.com/seasons/${seasonNumber}` },
  ];
}

export default useStructuredData;
