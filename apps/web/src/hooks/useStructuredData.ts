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
  }
];

export default useStructuredData;
