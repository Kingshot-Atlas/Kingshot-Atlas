/**
 * Cloudflare Pages Middleware for SEO
 * 
 * Two-tier strategy for search engine bots:
 * 1. If PRERENDER_TOKEN is set → full prerender via prerender.io (preferred)
 * 2. Otherwise → free edge-side meta injection via HTMLRewriter
 *    - Rewrites <title>, meta tags, canonical, og:*, twitter:* per page
 *    - Fetches kingdom data from Supabase for dynamic pages
 *    - Zero external cost (runs on Cloudflare's free tier)
 * 
 * Regular users always get the normal SPA experience.
 * 
 * @see https://developers.cloudflare.com/pages/functions/middleware/
 * @see https://developers.cloudflare.com/workers/runtime-apis/html-rewriter/
 */

interface Env {
  PRERENDER_TOKEN?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

interface PageMeta {
  title: string;
  description: string;
  url: string;
  type: string;
  jsonLd?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Bot detection
// ---------------------------------------------------------------------------

const BOT_USER_AGENTS = [
  'googlebot',
  'google-inspectiontool',
  'bingbot',
  'yandex',
  'baiduspider',
  'facebookexternalhit',
  'twitterbot',
  'rogerbot',
  'linkedinbot',
  'embedly',
  'quora link preview',
  'showyoubot',
  'outbrain',
  'pinterest',
  'slackbot',
  'vkshare',
  'w3c_validator',
  'redditbot',
  'applebot',
  'whatsapp',
  'flipboard',
  'tumblr',
  'bitlybot',
  'skypeuripreview',
  'nuzzel',
  'discordbot',
  'google page speed',
  'qwantify',
  'pinterestbot',
  'bitrix link preview',
  'xing-contenttabreceiver',
  'chrome-lighthouse',
  'telegrambot',
];

const IGNORED_EXTENSIONS = [
  '.js', '.css', '.xml', '.json', '.png', '.jpg', '.jpeg',
  '.gif', '.webp', '.svg', '.ico', '.woff', '.woff2',
  '.ttf', '.eot', '.map', '.txt',
];

function isBot(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return BOT_USER_AGENTS.some(bot => ua.includes(bot));
}

function shouldPrerender(request: Request): boolean {
  const url = new URL(request.url);
  const path = url.pathname.toLowerCase();
  if (IGNORED_EXTENSIONS.some(ext => path.endsWith(ext))) return false;
  if (path.startsWith('/api/')) return false;
  if (path.startsWith('/admin') || path.startsWith('/callback') || path.startsWith('/login')) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Tier helper (mirrors frontend getPowerTier — thresholds: S≥57, A≥47, B≥38, C≥29, D<29)
// ---------------------------------------------------------------------------

function getTier(score: number): string {
  if (score >= 57) return 'S';
  if (score >= 47) return 'A';
  if (score >= 38) return 'B';
  if (score >= 29) return 'C';
  return 'D';
}

// ---------------------------------------------------------------------------
// Static page meta (mirrors PAGE_META_TAGS from useMetaTags.ts)
// ---------------------------------------------------------------------------

const STATIC_META: Record<string, PageMeta> = {
  '/': {
    title: 'Kingshot Atlas - Kingdom Rankings, KvK Results & Scouting Tool',
    description: 'The #1 Kingshot kingdom database. Scout opponents, find the best kingdoms, compare rankings, track KvK history. Recruit or transfer with real data.',
    url: 'https://ks-atlas.com/',
    type: 'website',
  },
  '/rankings': {
    title: 'Kingshot Kingdom Rankings - Best Kingdoms & Tier List',
    description: 'Find the best Kingshot kingdoms ranked S-Tier to D-Tier. Kingdom rankings updated after every KvK. Scout top kingdoms before Transfer Events.',
    url: 'https://ks-atlas.com/rankings',
    type: 'website',
  },
  '/compare': {
    title: 'Compare Kingshot Kingdoms - Head-to-Head Scouting',
    description: 'Compare Kingshot kingdoms side-by-side. Analyze KvK stats, Atlas Scores, rankings, and win rates. Scout opponents before battle.',
    url: 'https://ks-atlas.com/compare',
    type: 'website',
  },
  '/tools': {
    title: 'Kingshot Tools - KvK Calendar, Scouting & Score Simulator',
    description: 'Free Kingshot tools for KvK scouting: event calendar, countdown timer, kingdom comparison, Atlas Score simulator. Plan transfers with data.',
    url: 'https://ks-atlas.com/tools',
    type: 'website',
  },
  '/tools/gift-codes': {
    title: 'Kingshot Gift Code Redeemer - One Click Redemption',
    description: 'Redeem Kingshot gift codes instantly with one click. No copy-pasting — rewards go straight to your in-game mailbox. Free tool by Kingshot Atlas.',
    url: 'https://ks-atlas.com/tools/gift-codes',
    type: 'website',
  },
  '/players': {
    title: 'Kingshot Player Directory - Find Recruiters & Players',
    description: 'Browse Kingshot players and recruiters. Find players from any kingdom, connect before Transfer Events. Recruiting made easy.',
    url: 'https://ks-atlas.com/players',
    type: 'website',
  },
  '/seasons': {
    title: 'Kingshot KvK History - All Season Results & Matchups',
    description: 'Complete Kingshot KvK history: every season, every matchup, every result. Track kingdom performance across all KvK events.',
    url: 'https://ks-atlas.com/seasons',
    type: 'website',
  },
  '/ambassadors': {
    title: 'Kingshot Atlas Ambassador Network - Refer & Earn',
    description: 'Join the Kingshot Atlas Ambassador Network. Refer players, earn badges, and help grow the community. Scout, recruit, and climb the ranks.',
    url: 'https://ks-atlas.com/ambassadors',
    type: 'website',
  },
  '/atlas-bot': {
    title: 'Kingshot Atlas Discord Bot - Kingdom Lookup & KvK Tools',
    description: 'Add the Atlas Discord Bot to your server. Look up kingdoms, compare matchups, check rankings — all from Discord. Free for all servers.',
    url: 'https://ks-atlas.com/atlas-bot',
    type: 'website',
  },
  '/changelog': {
    title: 'Changelog - Kingshot Atlas Updates',
    description: "See what's new in Kingshot Atlas. Latest features for Transfer Events, kingdom rankings, and KvK tracking.",
    url: 'https://ks-atlas.com/changelog',
    type: 'website',
  },
  '/about': {
    title: 'About Kingshot Atlas - Kingdom Scouting & Recruiting Platform',
    description: 'Kingshot Atlas: the kingdom intelligence platform. Scout KvK opponents, find the best kingdoms, recruit for transfers. Built by players, for players.',
    url: 'https://ks-atlas.com/about',
    type: 'website',
  },
  '/support': {
    title: 'Support Kingshot Atlas - Premium Features',
    description: 'Support Kingshot Atlas development. Get premium features, early access, and help build the ultimate KvK intelligence platform.',
    url: 'https://ks-atlas.com/support',
    type: 'website',
  },
  '/contribute-data': {
    title: 'Contribute KvK Data - Kingshot Atlas',
    description: 'Submit KvK results and kingdom data to Kingshot Atlas. Help build the most accurate Kingshot database. Community-powered accuracy.',
    url: 'https://ks-atlas.com/contribute-data',
    type: 'website',
  },
};

// ---------------------------------------------------------------------------
// Dynamic meta resolution
// ---------------------------------------------------------------------------

async function getMetaForPath(path: string, env: Env): Promise<PageMeta | null> {
  // Static routes
  const staticMeta = STATIC_META[path];
  if (staticMeta) return staticMeta;

  // Kingdom profile: /kingdom/:id
  const kingdomMatch = path.match(/^\/kingdom\/(\d+)$/);
  if (kingdomMatch) {
    return getKingdomMeta(parseInt(kingdomMatch[1], 10), env);
  }

  // KvK season page: /seasons/:id
  const seasonMatch = path.match(/^\/seasons\/(\d+)$/);
  if (seasonMatch) {
    const num = parseInt(seasonMatch[1], 10);
    return {
      title: `KvK Season ${num} Results & Matchups - Kingshot Atlas`,
      description: `KvK Season ${num} results: all matchups, winners, scores, and kingdom performance. Track how every kingdom performed in Season ${num}.`,
      url: `https://ks-atlas.com/seasons/${num}`,
      type: 'article',
    };
  }

  // Fallback: just set correct canonical for any unknown path
  return {
    title: 'Kingshot Atlas - Kingdom Rankings, KvK Results & Scouting Tool',
    description: 'The #1 Kingshot kingdom database. Scout opponents, find the best kingdoms, compare rankings, track KvK history.',
    url: `https://ks-atlas.com${path}`,
    type: 'website',
  };
}

async function getKingdomMeta(num: number, env: Env): Promise<PageMeta> {
  const baseUrl = `https://ks-atlas.com/kingdom/${num}`;
  const fallback: PageMeta = {
    title: `Kingdom ${num} Stats & KvK History - Kingshot Atlas`,
    description: `View stats, KvK history, and rankings for Kingdom ${num} in Kingshot Atlas. Scout before Transfer Events.`,
    url: baseUrl,
    type: 'article',
  };

  // Fetch live data from Supabase for richer meta
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) return fallback;

  try {
    const apiUrl = `${env.VITE_SUPABASE_URL}/rest/v1/kingdoms?kingdom_number=eq.${num}&select=kingdom_number,overall_score,total_kvks,battle_win_rate,most_recent_status&limit=1`;
    const res = await fetch(apiUrl, {
      headers: {
        'apikey': env.VITE_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${env.VITE_SUPABASE_ANON_KEY}`,
      },
      cf: { cacheTtl: 3600, cacheEverything: true } as RequestInitCfProperties,
    });

    if (!res.ok) return fallback;

    const data = await res.json() as Array<{
      kingdom_number: number;
      overall_score: number;
      total_kvks: number;
      battle_win_rate: number;
      most_recent_status: string;
    }>;
    const kingdom = data[0];
    if (!kingdom) return fallback;

    const tier = getTier(kingdom.overall_score);
    const winRate = Math.round((kingdom.battle_win_rate || 0) * 100);
    const kvks = kingdom.total_kvks || 0;

    return {
      title: `Kingdom ${num} (${tier} Tier) Stats & KvK History - Kingshot Atlas`,
      description: `Kingdom ${num} — ${tier} Tier. ${winRate}% battle win rate across ${kvks} KvK events. View full history, rankings, and transfer info. Scout before Kingshot Transfer Events.`,
      url: baseUrl,
      type: 'article',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: `Kingdom ${num} (${tier} Tier) Profile`,
        description: `Stats, KvK history, and rankings for Kingdom ${num} in Kingshot Atlas.`,
        url: baseUrl,
        isPartOf: { '@type': 'WebSite', name: 'Kingshot Atlas', url: 'https://ks-atlas.com' },
      },
    };
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// HTMLRewriter handlers
// ---------------------------------------------------------------------------

class TitleRewriter {
  private title: string;
  constructor(title: string) { this.title = title; }
  element(element: Element) { element.setInnerContent(this.title); }
}

class MetaContentRewriter {
  private content: string;
  constructor(content: string) { this.content = content; }
  element(element: Element) { element.setAttribute('content', this.content); }
}

class HeadInjector {
  private html: string;
  constructor(meta: PageMeta) {
    let html = `\n<link rel="canonical" href="${meta.url}">`;
    if (meta.jsonLd) {
      html += `\n<script type="application/ld+json">${JSON.stringify(meta.jsonLd)}</script>`;
    }
    this.html = html;
  }
  element(element: Element) { element.append(this.html, { html: true }); }
}

// ---------------------------------------------------------------------------
// Edge-side meta injection (free alternative to prerender.io)
// ---------------------------------------------------------------------------

async function injectSeoMeta(
  meta: PageMeta,
  next: () => Promise<Response>,
): Promise<Response> {
  const response = await next();

  // Only rewrite HTML responses
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  return new HTMLRewriter()
    .on('title', new TitleRewriter(meta.title))
    .on('meta[name="description"]', new MetaContentRewriter(meta.description))
    .on('meta[property="og:title"]', new MetaContentRewriter(meta.title))
    .on('meta[property="og:description"]', new MetaContentRewriter(meta.description))
    .on('meta[property="og:url"]', new MetaContentRewriter(meta.url))
    .on('meta[property="og:type"]', new MetaContentRewriter(meta.type))
    .on('meta[name="twitter:title"]', new MetaContentRewriter(meta.title))
    .on('meta[name="twitter:description"]', new MetaContentRewriter(meta.description))
    .on('head', new HeadInjector(meta))
    .transform(response);
}

// ---------------------------------------------------------------------------
// Main middleware
// ---------------------------------------------------------------------------

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, next } = context;
  const userAgent = request.headers.get('user-agent') || '';

  if (!isBot(userAgent) || !shouldPrerender(request)) {
    return next();
  }

  // Tier 1: Full prerender via prerender.io (if configured)
  if (env.PRERENDER_TOKEN) {
    try {
      const url = new URL(request.url);
      const prerenderUrl = `https://service.prerender.io/${url.href}`;

      const prerenderResponse = await fetch(prerenderUrl, {
        headers: {
          'X-Prerender-Token': env.PRERENDER_TOKEN,
          'X-Prerender-Int-Type': 'cloudflare-worker',
        },
      });

      if (prerenderResponse.ok) {
        const html = await prerenderResponse.text();
        return new Response(html, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'X-Prerendered': 'true',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }
      console.log(`[Prerender] Service returned ${prerenderResponse.status}, falling back to meta injection`);
    } catch (error) {
      console.error('[Prerender] Error:', error);
    }
  }

  // Tier 2: Free edge-side meta injection via HTMLRewriter
  const url = new URL(request.url);
  const meta = await getMetaForPath(url.pathname, env);
  if (meta) {
    return injectSeoMeta(meta, next);
  }

  return next();
};
