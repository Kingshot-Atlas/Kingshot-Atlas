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
 * Pre-defined FAQ data for Transfer Hub — targets featured snippets
 * for "how to transfer kingdoms", "kingdom recruiting", "transfer event" queries.
 */
export const TRANSFER_HUB_FAQ_DATA: FAQItem[] = [
  {
    question: 'How do I transfer to a new kingdom in Kingshot?',
    answer: 'During a Transfer Event, visit the Transfer Hub on Kingshot Atlas. Browse kingdoms that are actively recruiting, compare their stats and KvK performance, then apply directly with your Transfer Profile. Recruiters review applications and can accept or decline.',
  },
  {
    question: 'When is the next Kingshot Transfer Event?',
    answer: 'Transfer Events happen every 8 weeks with three phases: Pre-Transfer (browse and prepare), Invitational (top kingdoms recruit first), and Open Transfer (all players can move). Check the Event Calendar on the Tools page for exact dates.',
  },
  {
    question: 'How do I recruit players for my kingdom?',
    answer: 'Claim your kingdom on the Transfer Hub, set up a recruiting listing with your requirements and what you offer, then review incoming transfer applications. Your kingdom\'s real KvK performance data is shown automatically — no need to exaggerate.',
  },
  {
    question: 'What should I look for when choosing a kingdom to transfer to?',
    answer: 'Check the kingdom\'s Atlas Score and tier (S-Tier kingdoms are top 3%), battle win rate, KvK experience count, and recent form. Use the Compare tool to evaluate kingdoms side-by-side. Also check if the kingdom has an active recruiter on the Transfer Hub.',
  },
  {
    question: 'Is the Kingshot Atlas Transfer Hub free?',
    answer: 'Yes, the Transfer Hub is 100% free for both transferees and recruiters. Browse kingdoms, create a Transfer Profile, apply to kingdoms, and manage applications — all at no cost. Powered by real data from every KvK event.',
  },
];

/**
 * Pre-defined FAQ data for KvK Tools page — targets featured snippets
 * for "kingshot kvk tools", "kvk battle planner", "kvk prep" queries.
 */
export const KVK_TOOLS_FAQ_DATA: FAQItem[] = [
  {
    question: 'What KvK tools does Kingshot Atlas offer?',
    answer: 'Kingshot Atlas offers five KvK tools: Prep Scheduler for organizing buff slot assignments during Prep Phase, Battle Registry for tracking player availability and troop tiers, Battle Tier List for ranking players by combat power, Battle Layout for planning alliance teleport positions, and Battle Planner for synchronizing multi-rally castle hits.',
  },
  {
    question: 'How does the KvK Prep Scheduler work?',
    answer: 'The Prep Scheduler collects player availability and speedup data, then auto-assigns optimal 30-minute buff slots for Construction, Research, and Training days. Share the link with your kingdom — players submit before the deadline, and the scheduler ensures every slot goes to the player who brings the most value.',
  },
  {
    question: 'How do I plan synchronized rallies in Kingshot KvK?',
    answer: 'Use the Battle Planner tool on Kingshot Atlas. Set march times per building, create rally queues with precise timing, and view Gantt timelines showing exactly when each rally hits. This ensures your waves land within seconds of each other during Castle Battle.',
  },
  {
    question: 'How do I rank my kingdom\'s players for Castle Battle?',
    answer: 'Use the Battle Tier List tool. Input scouted stats per player — Attack, Lethality, Defense, Health across Infantry, Cavalry, and Archer — with hero EG adjustments. The tool generates separate offense and defense tier rankings from SS to D tier.',
  },
  {
    question: 'Are KvK tools free on Kingshot Atlas?',
    answer: 'The Prep Scheduler is available for Silver Tier kingdoms ($50+ in Kingdom Fund contributions). Gold Tier kingdoms ($100+) unlock all five KvK tools including Battle Registry, Battle Tier List, Battle Layout, and Battle Planner. Contributions from alliance members add up collectively.',
  },
];

/**
 * Pre-defined FAQ data for Event Calendar page — targets featured snippets
 * for "kingshot event calendar", "kingshot kvk schedule", "when is next kvk" queries.
 */
export const EVENT_CALENDAR_FAQ_DATA: FAQItem[] = [
  {
    question: 'When is the next Kingshot KvK event?',
    answer: 'KvK events happen every 4 weeks. Check the Event Calendar on Kingshot Atlas for the exact date and countdown timer. The calendar shows all upcoming KvK phases including Prep Phase (Monday–Saturday) and Castle Battle (Saturday).',
  },
  {
    question: 'When is the next Kingshot Transfer Event?',
    answer: 'Transfer Events happen every 8 weeks with three phases: Pre-Transfer (browse and prepare), Invitational (top kingdoms recruit first), and Open Transfer (all players can move). The Kingshot Atlas Event Calendar shows exact dates for all three phases.',
  },
  {
    question: 'What is the Kingshot event calendar?',
    answer: 'The Kingshot Atlas Event Calendar is a free tool that shows all upcoming in-game events with their exact dates and material overlaps. It tracks KvK events, Transfer Events, and recurring in-game events so you can plan when to spend your materials for maximum value.',
  },
  {
    question: 'How do material overlaps work in Kingshot events?',
    answer: 'Some in-game events share the same materials (e.g., speedups, gold). When multiple events run simultaneously, spending materials counts toward all overlapping events. The Event Calendar highlights these overlaps so you can time your spending for maximum rewards.',
  },
];

/**
 * Pre-defined FAQ data for Gift Codes page — targets featured snippets
 * for "kingshot gift codes", "kingshot redeem codes", "kingshot free rewards" queries.
 */
export const GIFT_CODES_FAQ_DATA: FAQItem[] = [
  {
    question: 'Where do I find active Kingshot gift codes?',
    answer: 'Kingshot Atlas aggregates all active Kingshot gift codes in one place. Visit the Gift Codes page to see every current code, copy them instantly, and never miss free rewards. Codes are updated automatically from official sources.',
  },
  {
    question: 'How do I redeem Kingshot gift codes?',
    answer: 'On Android: Open Kingshot, go to Settings (gear icon), tap "Gift Code", paste the code, and tap Redeem. On iOS: Visit the official Kingshot Gift Code website (ks-giftcode.centurygame.com), log in with your account, and paste the code. Rewards appear in your mailbox.',
  },
  {
    question: 'Why can\'t I redeem Kingshot gift codes on iOS?',
    answer: 'Apple\'s App Store policies prevent in-app code redemption. iOS players must use the official Kingshot Gift Code website (ks-giftcode.centurygame.com) to redeem codes. Log in with your account credentials and paste the code there.',
  },
  {
    question: 'How often are new Kingshot gift codes released?',
    answer: 'Century Games releases new gift codes through social media, community events, partnerships, and milestones. There is no fixed schedule, but new codes typically appear every few weeks. Kingshot Atlas checks for new codes automatically so you never miss one.',
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
  transferHubLanding: [HOME_CRUMB, { name: 'Transfer Hub', url: 'https://ks-atlas.com/transfer-hub' }, { name: 'About', url: 'https://ks-atlas.com/transfer-hub/about' }],
  kingdomCommunities: [HOME_CRUMB, { name: 'Kingdom Colonies', url: 'https://ks-atlas.com/kingdoms/communities' }],
  battlePlanner: [HOME_CRUMB, { name: 'Tools', url: 'https://ks-atlas.com/tools' }, { name: 'Battle Planner', url: 'https://ks-atlas.com/tools/battle-planner' }],
  battleRegistry: [HOME_CRUMB, { name: 'Tools', url: 'https://ks-atlas.com/tools' }, { name: 'Battle Registry', url: 'https://ks-atlas.com/tools/battle-registry-info' }],
  prepScheduler: [HOME_CRUMB, { name: 'Tools', url: 'https://ks-atlas.com/tools' }, { name: 'Prep Scheduler', url: 'https://ks-atlas.com/tools/prep-scheduler-info' }],
  battleLayout: [HOME_CRUMB, { name: 'Tools', url: 'https://ks-atlas.com/tools' }, { name: 'Battle Layout', url: 'https://ks-atlas.com/tools/battle-layout/about' }],
  battleTierList: [HOME_CRUMB, { name: 'Tools', url: 'https://ks-atlas.com/tools' }, { name: 'Battle Tier List', url: 'https://ks-atlas.com/tools/battle-tier-list/about' }],
  bearRallyTierList: [HOME_CRUMB, { name: 'Tools', url: 'https://ks-atlas.com/tools' }, { name: 'Bear Rally Tier List', url: 'https://ks-atlas.com/tools/bear-rally-tier-list/about' }],
  baseDesigner: [HOME_CRUMB, { name: 'Tools', url: 'https://ks-atlas.com/tools' }, { name: 'Base Designer', url: 'https://ks-atlas.com/tools/base-designer/about' }],
  eventCoordinator: [HOME_CRUMB, { name: 'Tools', url: 'https://ks-atlas.com/tools' }, { name: 'Event Coordinator', url: 'https://ks-atlas.com/tools/event-coordinator/about' }],
  allianceCenter: [HOME_CRUMB, { name: 'Alliance Center', url: 'https://ks-atlas.com/alliance-center/about' }],
  kvkTools: [HOME_CRUMB, { name: 'Tools', url: 'https://ks-atlas.com/tools' }, { name: 'KvK Tools', url: 'https://ks-atlas.com/tools/kvk-tools' }],
  eventCalendar: [HOME_CRUMB, { name: 'Tools', url: 'https://ks-atlas.com/tools' }, { name: 'Event Calendar', url: 'https://ks-atlas.com/tools/event-calendar' }],
  giftCodes: [HOME_CRUMB, { name: 'Tools', url: 'https://ks-atlas.com/tools' }, { name: 'Gift Codes', url: 'https://ks-atlas.com/tools/gift-codes' }],
  kingdomSettlers: [HOME_CRUMB, { name: 'Campaigns', url: 'https://ks-atlas.com/campaigns/kingdom-settlers' }, { name: 'Kingdom Settlers', url: 'https://ks-atlas.com/campaigns/kingdom-settlers' }],
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
