
/**
 * Atlas Discord API Proxy — Cloudflare Worker
 * 
 * Proxies Discord REST API calls through Cloudflare's IP space,
 * bypassing Cloudflare WAF Error 1015 IP bans on Render's shared IP.
 * 
 * Deploy:
 *   1. Go to Cloudflare Dashboard → Workers & Pages → Create
 *   2. Name it "atlas-discord-proxy"
 *   3. Paste this code
 *   4. Go to Settings → Variables → add PROXY_SECRET (generate a random string)
 *   5. Deploy
 * 
 * Then on Render, set:
 *   DISCORD_API_PROXY=https://atlas-discord-proxy.<your-subdomain>.workers.dev
 *   DISCORD_PROXY_KEY=<same secret you set in step 4>
 */

export default {
  async fetch(request, env) {
    // Only allow configured methods
    const allowed = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    if (!allowed.includes(request.method)) {
      return new Response('Method not allowed', { status: 405 });
    }

    // Authenticate — reject requests without valid key
    const proxyKey = request.headers.get('X-Proxy-Key');
    if (!env.PROXY_SECRET || proxyKey !== env.PROXY_SECRET) {
      return new Response('Unauthorized', { status: 403 });
    }

    // Build Discord API target URL
    const url = new URL(request.url);
    const target = `https://discord.com${url.pathname}${url.search}`;

    // Forward headers (strip proxy-specific ones)
    const headers = new Headers(request.headers);
    headers.delete('X-Proxy-Key');
    headers.delete('Host');
    headers.delete('CF-Connecting-IP');
    headers.delete('CF-Ray');

    try {
      const resp = await fetch(target, {
        method: request.method,
        headers,
        body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      });

      // Pass through Discord's response (including rate-limit headers)
      return new Response(resp.body, {
        status: resp.status,
        statusText: resp.statusText,
        headers: resp.headers,
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
