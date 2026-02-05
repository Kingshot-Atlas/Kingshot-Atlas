/**
 * Cloudflare Pages Middleware for SEO Prerendering
 * 
 * Detects search engine bots and routes them to prerender.io
 * for server-rendered HTML. Regular users get the normal SPA.
 * 
 * @see https://developers.cloudflare.com/pages/functions/middleware/
 */

interface Env {
  PRERENDER_TOKEN?: string;
}

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
  '.js',
  '.css',
  '.xml',
  '.json',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.map',
  '.txt',
];

function isBot(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return BOT_USER_AGENTS.some(bot => ua.includes(bot));
}

function shouldPrerender(request: Request): boolean {
  const url = new URL(request.url);
  const path = url.pathname.toLowerCase();
  
  // Don't prerender static assets
  if (IGNORED_EXTENSIONS.some(ext => path.endsWith(ext))) {
    return false;
  }
  
  // Don't prerender API routes
  if (path.startsWith('/api/')) {
    return false;
  }
  
  // Don't prerender admin/auth routes
  if (path.startsWith('/admin') || path.startsWith('/callback') || path.startsWith('/login')) {
    return false;
  }
  
  return true;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, next } = context;
  const userAgent = request.headers.get('user-agent') || '';
  
  // Check if this is a bot request that should be prerendered
  if (isBot(userAgent) && shouldPrerender(request)) {
    const prerenderToken = env.PRERENDER_TOKEN;
    
    // If no prerender token configured, fall through to normal response
    if (!prerenderToken) {
      console.log('[Prerender] No PRERENDER_TOKEN configured, serving SPA');
      return next();
    }
    
    try {
      const url = new URL(request.url);
      const prerenderUrl = `https://service.prerender.io/${url.href}`;
      
      console.log(`[Prerender] Bot detected: ${userAgent.substring(0, 50)}...`);
      console.log(`[Prerender] Fetching: ${prerenderUrl}`);
      
      const prerenderResponse = await fetch(prerenderUrl, {
        headers: {
          'X-Prerender-Token': prerenderToken,
          'X-Prerender-Int-Type': 'cloudflare-worker',
        },
      });
      
      if (prerenderResponse.ok) {
        // Return prerendered HTML with appropriate headers
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
      
      // If prerender fails, fall through to normal SPA
      console.log(`[Prerender] Service returned ${prerenderResponse.status}, falling back to SPA`);
    } catch (error) {
      console.error('[Prerender] Error:', error);
    }
  }
  
  // For regular users or if prerender fails, serve the normal SPA
  return next();
};
