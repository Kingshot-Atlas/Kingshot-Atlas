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
export const getKingdomMetaTags = (
  kingdomNumber: number,
  atlasScore: number,
  tier: string,
  rank?: number
): MetaTagsOptions => {
  const title = `Kingdom #${kingdomNumber} - Kingshot Atlas`;
  const description = `Kingdom #${kingdomNumber} | Atlas Score: ${atlasScore.toFixed(1)} | ${tier}-Tier${rank ? ` | Rank #${rank}` : ''} - View detailed KvK stats, win rates, and performance history.`;
  
  return {
    title,
    description,
    url: `https://ks-atlas.com/kingdom/${kingdomNumber}`,
    type: 'website',
    image: 'https://ks-atlas.com/Atlas%20Favicon.png'
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

export default useMetaTags;
