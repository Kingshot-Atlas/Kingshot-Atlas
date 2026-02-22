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
  /** Semantic HTML injected into <div id="root"> for bot-visible content (fixes Soft 404) */
  bodyContent?: string;
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
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        { '@type': 'Question', name: 'What are the best Kingshot kingdoms?', acceptedAnswer: { '@type': 'Answer', text: 'The best Kingshot kingdoms are ranked S-Tier on Atlas, scoring 57+ out of 100. Rankings are based on the Atlas Score — a Bayesian rating system that weighs KvK battle win rates, preparation performance, recent form, and experience. Check the Kingdom Rankings page for the live tier list.' } },
        { '@type': 'Question', name: 'How are Kingshot kingdom rankings calculated?', acceptedAnswer: { '@type': 'Answer', text: 'Kingdom rankings use the Atlas Score (v3.1), a composite rating from 0-100 based on: battle win rate (55% weight), preparation win rate (45% weight), recent form multiplier, streak bonuses, and experience factor. Kingdoms are then placed into tiers: S (≥57), A (≥47), B (≥38), C (≥29), D (<29).' } },
        { '@type': 'Question', name: 'What is S-Tier in Kingshot Atlas?', acceptedAnswer: { '@type': 'Answer', text: 'S-Tier is the highest ranking tier in Kingshot Atlas, reserved for the top ~3% of kingdoms that score 57 or above. These kingdoms have consistently strong KvK battle and preparation win rates across multiple seasons.' } },
        { '@type': 'Question', name: 'How often are Kingshot kingdom rankings updated?', acceptedAnswer: { '@type': 'Answer', text: 'Kingdom rankings are updated after every KvK (Kingdom vs Kingdom) event, typically within 24-48 hours. Community members can also submit KvK results which are reviewed by Atlas admins before being incorporated.' } },
        { '@type': 'Question', name: 'How do I find a good kingdom before a Transfer Event?', acceptedAnswer: { '@type': 'Answer', text: 'Use the Kingdom Rankings to filter by tier, KvK experience, and win rate. Compare kingdoms side-by-side on the Compare page, then visit the Transfer Hub to see which kingdoms are actively recruiting and apply directly with your Transfer Profile.' } },
      ],
    },
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
  '/transfer-hub': {
    title: 'Kingshot Transfer Hub - Recruit & Find Kingdoms',
    description: 'Kingshot Transfer Hub: recruit players, find kingdoms accepting transfers, apply directly. Real data for every Transfer Event. No more blind migrations.',
    url: 'https://ks-atlas.com/transfer-hub',
    type: 'website',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        { '@type': 'Question', name: 'How do I transfer to a new kingdom in Kingshot?', acceptedAnswer: { '@type': 'Answer', text: 'During a Transfer Event, visit the Transfer Hub on Kingshot Atlas. Browse kingdoms that are actively recruiting, compare their stats and KvK performance, then apply directly with your Transfer Profile. Recruiters review applications and can accept or decline.' } },
        { '@type': 'Question', name: 'When is the next Kingshot Transfer Event?', acceptedAnswer: { '@type': 'Answer', text: 'Transfer Events happen every 8 weeks with three phases: Pre-Transfer (browse and prepare), Invitational (top kingdoms recruit first), and Open Transfer (all players can move). Check the Event Calendar on the Tools page for exact dates.' } },
        { '@type': 'Question', name: 'How do I recruit players for my kingdom?', acceptedAnswer: { '@type': 'Answer', text: 'Claim your kingdom on the Transfer Hub, set up a recruiting listing with your requirements and what you offer, then review incoming transfer applications. Your kingdom\'s real KvK performance data is shown automatically.' } },
        { '@type': 'Question', name: 'Is the Kingshot Atlas Transfer Hub free?', acceptedAnswer: { '@type': 'Answer', text: 'Yes, the Transfer Hub is 100% free for both transferees and recruiters. Browse kingdoms, create a Transfer Profile, apply to kingdoms, and manage applications — all at no cost.' } },
      ],
    },
  },
  '/transfer-hub/about': {
    title: 'Kingshot Transfer Hub - Find Your Next Kingdom or Recruit Players',
    description: 'The Kingshot Transfer Hub: browse recruiting kingdoms, create a transfer profile, apply directly. Recruiters set up listings and receive applications. 100% free, powered by real data.',
    url: 'https://ks-atlas.com/transfer-hub/about',
    type: 'website',
  },
  '/kingdoms/communities': {
    title: 'Kingdom Colonies | Kingshot Atlas',
    description: 'Discover the most active kingdoms on Atlas. See which kingdoms have the biggest colonies of competitive Kingshot players.',
    url: 'https://ks-atlas.com/kingdoms/communities',
    type: 'website',
  },
  '/terms': {
    title: 'Terms of Service - Kingshot Atlas',
    description: 'Kingshot Atlas Terms of Service. Read about usage terms, acceptable use, and user responsibilities for the kingdom intelligence platform.',
    url: 'https://ks-atlas.com/terms',
    type: 'website',
  },
  '/privacy': {
    title: 'Privacy Policy - Kingshot Atlas',
    description: 'Kingshot Atlas Privacy Policy. How we collect, use, and protect your data. We never sell user information.',
    url: 'https://ks-atlas.com/privacy',
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
      bodyContent: `<article style="max-width:800px;margin:2rem auto;padding:1rem;color:#e5e7eb;font-family:system-ui,sans-serif;">
<h1>KvK Season ${num} — Results &amp; Matchups</h1>
<p>Complete results and matchups for Kingdom vs Kingdom Season ${num}. View all kingdom performances, winners, and battle outcomes.</p>
<section><h2>Season ${num} Overview</h2>
<p>Browse every matchup from KvK Season ${num}, including preparation phase and battle phase results, kingdom scores, and final standings.</p></section>
<nav><h2>More KvK Data</h2>
<ul>
<li><a href="/seasons">All KvK Seasons</a> — Complete history of every KvK event</li>
<li><a href="/rankings">Kingdom Rankings</a> — Current tier list based on all KvK performance</li>
<li><a href="/compare">Compare Kingdoms</a> — Head-to-head kingdom comparison</li>
</ul></nav>
</article>`,
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
    bodyContent: `<article style="max-width:800px;margin:2rem auto;padding:1rem;color:#e5e7eb;font-family:system-ui,sans-serif;">
<h1>Kingdom ${num} — Stats &amp; KvK History</h1>
<p>View stats, KvK history, and rankings for Kingdom ${num} in Kingshot Atlas. Scout before Kingshot Transfer Events.</p>
<section><h2>Kingdom ${num} Profile</h2>
<p>View complete KvK battle history, Atlas Score breakdown, performance trends, and compare with other kingdoms. Make data-driven transfer decisions.</p></section>
<nav><h2>Explore More</h2>
<ul>
<li><a href="/rankings">Kingdom Rankings</a> — All kingdoms ranked S to D Tier</li>
<li><a href="/compare">Compare Kingdoms</a> — Head-to-head kingdom comparison</li>
<li><a href="/transfer-hub">Transfer Hub</a> — Find kingdoms recruiting for Transfer Events</li>
<li><a href="/seasons">KvK Seasons</a> — Complete KvK history and results</li>
</ul></nav>
</article>`,
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

    const statusText = kingdom.most_recent_status ? ` Status: ${kingdom.most_recent_status}.` : '';

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
      bodyContent: `<article style="max-width:800px;margin:2rem auto;padding:1rem;color:#e5e7eb;font-family:system-ui,sans-serif;">
<h1>Kingdom ${num} — ${tier} Tier</h1>
<p>Kingdom ${num} is rated <strong>${tier} Tier</strong> on Kingshot Atlas with an Atlas Score of <strong>${kingdom.overall_score.toFixed(1)}</strong>.${statusText}</p>
<section><h2>KvK Performance</h2>
<ul>
<li>Battle Win Rate: ${winRate}%</li>
<li>Total KvK Events: ${kvks}</li>
<li>Atlas Score: ${kingdom.overall_score.toFixed(1)} / 100</li>
<li>Tier: ${tier} (${tier === 'S' ? '≥57' : tier === 'A' ? '≥47' : tier === 'B' ? '≥38' : tier === 'C' ? '≥29' : '<29'})</li>
</ul></section>
<section><h2>About Kingdom ${num}</h2>
<p>View complete KvK history, performance trends, score breakdown, and compare with other kingdoms. Scout Kingdom ${num} before Kingshot Transfer Events.</p></section>
<nav><h2>Explore More</h2>
<ul>
<li><a href="/rankings">Kingdom Rankings</a> — All kingdoms ranked S to D Tier</li>
<li><a href="/compare">Compare Kingdoms</a> — Head-to-head kingdom comparison</li>
<li><a href="/transfer-hub">Transfer Hub</a> — Find kingdoms recruiting for Transfer Events</li>
<li><a href="/seasons">KvK Seasons</a> — Complete KvK history and results</li>
</ul></nav>
</article>`,
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

// All supported languages — mirrors SUPPORTED_LANGUAGES in i18n.ts
const SUPPORTED_LANGS = ['en', 'es', 'fr', 'zh', 'de', 'ko', 'ja', 'ar', 'tr'];

class HeadInjector {
  private html: string;
  constructor(meta: PageMeta) {
    let html = `\n<link rel="canonical" href="${meta.url}">`;
    // hreflang tags for all supported languages (SPA with client-side detection)
    html += `\n<link rel="alternate" hreflang="x-default" href="${meta.url}">`;
    for (const lang of SUPPORTED_LANGS) {
      html += `\n<link rel="alternate" hreflang="${lang}" href="${meta.url}">`;
    }
    if (meta.jsonLd) {
      html += `\n<script type="application/ld+json">${JSON.stringify(meta.jsonLd)}</script>`;
    }
    this.html = html;
  }
  element(element: Element) { element.append(this.html, { html: true }); }
}

/**
 * Injects semantic HTML into <div id="root"> so bots see real content
 * instead of an empty SPA shell. This is the primary fix for Soft 404.
 * React will replace this content when it hydrates for real users.
 */
class RootContentInjector {
  private html: string;
  constructor(bodyContent: string) { this.html = bodyContent; }
  element(element: Element) { element.setInnerContent(this.html, { html: true }); }
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

  let rewriter = new HTMLRewriter()
    .on('title', new TitleRewriter(meta.title))
    .on('meta[name="description"]', new MetaContentRewriter(meta.description))
    .on('meta[property="og:title"]', new MetaContentRewriter(meta.title))
    .on('meta[property="og:description"]', new MetaContentRewriter(meta.description))
    .on('meta[property="og:url"]', new MetaContentRewriter(meta.url))
    .on('meta[property="og:type"]', new MetaContentRewriter(meta.type))
    .on('meta[name="twitter:title"]', new MetaContentRewriter(meta.title))
    .on('meta[name="twitter:description"]', new MetaContentRewriter(meta.description))
    .on('head', new HeadInjector(meta));

  // Inject semantic HTML into #root so bots see real content (fixes Soft 404)
  if (meta.bodyContent) {
    rewriter = rewriter.on('div#root', new RootContentInjector(meta.bodyContent));
  }

  return rewriter.transform(response);
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
  // Use only pathname (strip query params) so canonical URLs are clean
  const url = new URL(request.url);
  const cleanPath = url.pathname.replace(/\/$/, '') || '/'; // normalize trailing slash
  const meta = await getMetaForPath(cleanPath, env);
  if (meta) {
    return injectSeoMeta(meta, next);
  }

  return next();
};
