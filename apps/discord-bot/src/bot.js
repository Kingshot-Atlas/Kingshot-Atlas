/**
 * Atlas - Kingshot Atlas Discord Bot
 * 
 * "Know your enemy. Choose your allies. Dominate KvK."
 * 
 * A data-driven companion for competitive Kingshot players.
 * Built by players, for players.
 * 
 * Commands:
 * /kingdom <number>  - Get detailed kingdom stats
 * /compare <k1> <k2> - Compare two kingdoms head-to-head
 * /rankings          - Show top 10 kingdoms by Atlas Score
 * /tier <S|A|B|C|D>  - List kingdoms by tier
 * /history <number>  - KvK season history
 * /predict <k1> <k2> - Matchup prediction
 * /countdownkvk      - Time until next KvK
 * /countdowntransfer - Time until next Transfer Event
 * /codes             - Show active gift codes
 * /multirally        - Coordinate rally timing
 * /help              - Show all commands
 * 
 * Setup:
 * 1. Create Discord Application at https://discord.com/developers/applications
 * 2. Create Bot and get token
 * 3. Copy .env.example to .env and fill in credentials
 * 4. Run: npm install
 * 5. Run: npm run register (registers slash commands)
 * 6. Run: npm start
 */

require('dotenv').config();
const http = require('http');
const { Client, GatewayIntentBits, REST, Routes, ActivityType, Partials } = require('discord.js');
const config = require('./config');
const commands = require('./commands');
const handlers = require('./commands/handlers');
const logger = require('./utils/logger');
const { createWelcomeEmbed } = require('./utils/embeds');
const scheduler = require('./scheduler');
const telemetry = require('./telemetry');
const { initReactionRoles } = require('./reactionRoles');

// ============================================================================
// DISCORD REST API PROXY — bypasses Cloudflare IP bans on Render's shared IP
// When DISCORD_API_PROXY is set, REST calls route through a Cloudflare Worker
// instead of directly to discord.com (which bans Render's IP via Error 1015).
// ============================================================================
const DISCORD_API_PROXY = process.env.DISCORD_API_PROXY || '';
const DISCORD_PROXY_KEY = process.env.DISCORD_PROXY_KEY || '';
const DISCORD_API_BASE = DISCORD_API_PROXY || 'https://discord.com';

/**
 * Fetch from Discord API, routing through proxy if configured.
 * Drop-in replacement for fetch('https://discord.com/...').
 */
function discordFetch(path, options = {}) {
  const url = `${DISCORD_API_BASE}${path}`;
  const headers = { ...options.headers };
  if (DISCORD_API_PROXY && DISCORD_PROXY_KEY) {
    headers['X-Proxy-Key'] = DISCORD_PROXY_KEY;
  }
  return fetch(url, { ...options, headers });
}

if (DISCORD_API_PROXY) {
  console.log(`🔀 Discord REST proxy: ${DISCORD_API_PROXY}`);
} else {
  console.log('📡 Discord REST: direct (no proxy)');
}

// Bot → Atlas API authentication key (must match DISCORD_API_KEY on the API side)
const BOT_API_KEY = process.env.BOT_API_KEY || process.env.DISCORD_API_KEY || '';
if (!BOT_API_KEY) console.warn('⚠️ BOT_API_KEY not set — bot admin API calls will fail in production');

/**
 * Fetch from the Atlas API with bot admin authentication.
 * Always sends X-API-Key header so require_bot_admin passes.
 * Includes timeout (60s) and retry (1x) for Render cold-start resilience.
 */
const ATLAS_API_TIMEOUT = 60_000;
const ATLAS_API_RETRIES = 1;

async function atlasFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : `${config.apiUrl}${path}`;
  const headers = { ...options.headers };
  if (BOT_API_KEY) headers['X-API-Key'] = BOT_API_KEY;

  for (let attempt = 0; attempt <= ATLAS_API_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ATLAS_API_TIMEOUT);
    try {
      const res = await fetch(url, { ...options, headers, signal: controller.signal });
      return res;
    } catch (err) {
      if (attempt < ATLAS_API_RETRIES && (err.name === 'AbortError' || err.message.includes('fetch'))) {
        const delay = 2000 * (attempt + 1);
        console.log(`⏳ atlasFetch retry ${attempt + 1} for ${path} (waiting ${delay}ms)...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

// Settler role — assigned to Discord members who linked both Discord + Kingshot on ks-atlas.com
const SETTLER_ROLE_ID = process.env.DISCORD_SETTLER_ROLE_ID || '1466442878585934102';
const SETTLER_SYNC_INTERVAL = 30 * 60 * 1000; // 30 minutes
let settlerSyncTimer = null;
let settlerSyncInitTimeout = null;
let lastSettlerSync = null;

// Transfer Group roles — assigned based on linked kingdom's transfer group
// Role IDs are created/cached dynamically by syncTransferGroupRoles()
// Map: "min-max" -> Discord role ID (e.g. "7-115" -> "1234567890")
const transferGroupRoleCache = new Map(); // populated at runtime
let lastTransferGroupSync = null;
let lastTransferGroupSyncResult = null; // { assigned, removed, alreadyHas, errors, eligible, notInGuild, groups }
// Channel to DM unlinked users who join — set DISCORD_LINK_PROMPT_CHANNEL_ID on Render
const LINK_PROMPT_CHANNEL_ID = process.env.DISCORD_LINK_PROMPT_CHANNEL_ID || '';

// Supporter role — assigned to Atlas Supporter subscribers who linked Discord
const SUPPORTER_ROLE_ID = process.env.DISCORD_SUPPORTER_ROLE_ID || '';
let supporterSyncTimer = null;
let supporterSyncInitTimeout = null;
let lastSupporterSync = null;

// Gilded role — assigned to users from Gold-tier Kingdom Fund kingdoms
const GILDED_ROLE_ID = process.env.DISCORD_GILDED_ROLE_ID || '1472230516823556260';
let gildedSyncTimer = null;
let gildedSyncInitTimeout = null;
let lastGildedSync = null;

// Explorer role — assigned to everyone who joins the Discord server
const EXPLORER_ROLE_ID = process.env.DISCORD_EXPLORER_ROLE_ID || '';

// Referral tier roles — Consul (10+ referrals) and Ambassador (20+ referrals)
const CONSUL_ROLE_ID = process.env.DISCORD_CONSUL_ROLE_ID || '1470500049141235926';
const AMBASSADOR_ROLE_ID = process.env.DISCORD_AMBASSADOR_ROLE_ID || '1466442919304237207';
let referralSyncTimer = null;
let referralSyncInitTimeout = null;
let lastReferralSync = null;

// Spotlight webhook — auto-post celebration messages when roles are assigned
const SPOTLIGHT_WEBHOOK_URL = process.env.DISCORD_SPOTLIGHT_WEBHOOK_URL || '';

// Welcome channel — prefer channel ID over name matching for reliability
const WELCOME_CHANNEL_ID = process.env.DISCORD_WELCOME_CHANNEL_ID || '';

// Spotlight message templates by role type — {user} is replaced with <@discordId> mention
const SPOTLIGHT_MESSAGES = {
  supporter: [
    '🎉 {user} just became an **Atlas Supporter**! 💎 Thank you for powering the Atlas!',
    '💎 Huge shoutout to {user} — our newest **Atlas Supporter**! Your support keeps the data flowing. 🚀',
    '⭐ {user} has joined the Supporter ranks! 💎 Welcome to the inner circle — you make Atlas possible. 🙏',
  ],
  ambassador: [
    '🏛️ {user} just reached **Ambassador** status! 🎉 20+ referrals — that\'s legendary recruitment!',
    '🎉 Everyone welcome {user} as our newest **Ambassador**! 🏛️ Their referral game is elite. 👑',
    '🏛️ Incredible! {user} is now an **Ambassador** — 20+ players brought to Atlas! 🔥 True community leader.',
  ],
  booster: [
    '🚀 {user} just **boosted** the server! 💜 Thank you for the extra sparkle!',
    '💜 Shoutout to {user} for the **server boost**! 🚀 You\'re making this community shine!',
    '🎉 {user} dropped a **server boost**! 💜🚀 The community appreciates you!',
  ],
};

// In-memory spotlight dedup guard — prevents duplicate spotlights within 1 hour
const spotlightSentCache = new Map(); // key: "roleType:discordId" → timestamp
const SPOTLIGHT_DEDUP_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Send an auto-spotlight message to the #spotlight channel via webhook.
 * @param {'supporter'|'ambassador'|'booster'} roleType
 * @param {string} discordId - Discord user ID for mention
 * @param {string} [displayName] - Fallback display name (used in logs only)
 */
async function sendSpotlightMessage(roleType, discordId, displayName) {
  if (!SPOTLIGHT_WEBHOOK_URL) return;
  const templates = SPOTLIGHT_MESSAGES[roleType];
  if (!templates || templates.length === 0) return;

  // Dedup guard: skip if we already sent this spotlight recently
  const dedupKey = `${roleType}:${discordId}`;
  const lastSent = spotlightSentCache.get(dedupKey);
  if (lastSent && Date.now() - lastSent < SPOTLIGHT_DEDUP_TTL) {
    console.log(`🔦 Spotlight dedup: skipping ${roleType} for ${displayName || discordId} (sent ${Math.round((Date.now() - lastSent) / 1000)}s ago)`);
    return;
  }

  const mention = discordId ? `<@${discordId}>` : `**${displayName || 'Someone'}**`;
  const message = templates[Math.floor(Math.random() * templates.length)].replace('{user}', mention);

  try {
    const res = await fetch(SPOTLIGHT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: message,
        username: 'Atlas Spotlight',
        avatar_url: 'https://ks-atlas.com/atlas-logo.png',
      }),
    });
    if (res.ok || res.status === 204) {
      spotlightSentCache.set(dedupKey, Date.now());
      console.log(`🔦 Spotlight sent for ${roleType}: ${displayName || discordId}`);
    } else {
      console.error(`🔦 Spotlight webhook failed (${res.status}) for ${displayName || discordId}`);
    }
  } catch (err) {
    console.error(`🔦 Spotlight webhook error for ${displayName || discordId}: ${err.message}`);
  }
}

// Presence rotation state (module-level to guard against reconnect leaks)
const presenceMessages = [
  '/help | ks-atlas.com',
  '/kingdom | Look up any kingdom',
  '/compare | Head-to-head stats',
  '/history | KvK season history',
  '/predict | Matchup predictions',
  '/rankings | Top kingdoms',
  '/countdownkvk | Next KvK',
  '/codes | Active gift codes',
];
let presenceIndex = 0;
let presenceTimer = null;

// ============================================================================
// HEALTH SERVER - Unified with bot for accurate health reporting
// ============================================================================
let botReady = false;
let lastHeartbeat = Date.now();
const startupTime = Date.now();
const STARTUP_GRACE_PERIOD = 300000; // 5 minutes grace period - Discord may rate limit after repeated restarts

// Diagnostic state - exposed via /health and /diagnostic endpoints
let lastDisconnectCode = null;
let lastDisconnectReason = null;
let lastError = null;
let loginAttemptCount = 0;
let loginLastResult = null;
let tokenValidationResult = null;
let interactionCount = 0;
let lastInteractionTime = null;
let commandRegistrationResult = null;
let lastCommandError = null;
let lastCommandDebug = null;
let kingdomCache = null;
let kingdomCacheTime = 0;

// Diagnostic cache - prevents /diagnostic from burning Discord API rate-limit budget
// Each /diagnostic hit was making 3 Discord API calls, compounding Cloudflare bans
let diagnosticCache = null;
let diagnosticCacheTime = 0;
const DIAGNOSTIC_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

const healthServer = http.createServer(async (req, res) => {
  if (req.url === '/health') {
    // Null-safe access to Discord client state (client may not be initialized yet)
    const wsStatus = client?.ws?.status ?? -1; // -1 = not connected
    const timeSinceStartup = Date.now() - startupTime;
    const inStartupGrace = timeSinceStartup < STARTUP_GRACE_PERIOD;
    
    // ALWAYS return 200 to prevent Render restart cycles.
    // The process IS healthy (health server works). Discord connection status
    // is reported in the response body for monitoring, not via HTTP status.
    // Previous behavior (503 when disconnected) caused a vicious restart cycle:
    // restart → gateway rate-limited → timeout → 503 → restart → repeat
    const isHealthy = true;
    const uptime = process.uptime();
    const memUsage = process.memoryUsage();
    
    const healthData = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      service: 'atlas-discord-bot',
      discord: {
        connected: wsStatus === 0,
        wsStatus: wsStatus,
        wsStatusName: ['READY','CONNECTING','RECONNECTING','IDLE','NEARLY','DISCONNECTED','WAITING_FOR_GUILDS','IDENTIFYING','RESUMING'][wsStatus] || `UNKNOWN(${wsStatus})`,
        guilds: client?.guilds?.cache?.size || 0,
        ping: client?.ws?.ping ?? null,
      },
      diagnostics: {
        lastDisconnectCode: lastDisconnectCode,
        lastDisconnectReason: lastDisconnectReason,
        lastError: lastError,
        loginAttempts: loginAttemptCount,
        loginLastResult: loginLastResult,
        tokenPresent: !!config.token,
        interactionsReceived: interactionCount,
        lastInteractionAt: lastInteractionTime,
        readyFired: typeof readyFiredCount !== 'undefined' ? readyFiredCount : 0,
        commandsRegistered: commandRegistrationResult,
        lastCommandError: lastCommandError,
        lastSettlerSync: lastSettlerSync,
        lastReferralSync: lastReferralSync,
        lastSupporterSync: lastSupporterSync,
        lastGildedSync: lastGildedSync,
        lastTransferGroupSync: lastTransferGroupSync,
        lastTransferGroupSyncResult: lastTransferGroupSyncResult,
        spotlightWebhookSet: !!SPOTLIGHT_WEBHOOK_URL,
        welcomeChannelIdSet: !!WELCOME_CHANNEL_ID,
        explorerRoleIdSet: !!EXPLORER_ROLE_ID,
      },
      process: {
        uptime: Math.floor(uptime),
        memory: Math.floor(memUsage.heapUsed / 1024 / 1024) + 'MB',
        lastHeartbeat: new Date(lastHeartbeat).toISOString(),
        inStartupGrace: inStartupGrace,
      },
      timestamp: new Date().toISOString(),
    };
    
    res.writeHead(isHealthy ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(healthData));
  } else if (req.url === '/diagnostic' || req.url?.startsWith('/diagnostic?')) {
    // Deep diagnostic endpoint - CACHED to prevent burning Discord API rate-limit budget
    // Previously made 3 live Discord API calls per hit, compounding Cloudflare IP bans
    // SECURITY: Requires DIAGNOSTIC_API_KEY to prevent info disclosure
    const diagKey = process.env.DIAGNOSTIC_API_KEY;
    if (diagKey) {
      const url = new URL(req.url, `http://localhost:${HEALTH_PORT}`);
      const providedKey = url.searchParams.get('key') || req.headers['x-diagnostic-key'];
      if (providedKey !== diagKey) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden — provide ?key= or X-Diagnostic-Key header' }));
        return;
      }
    }
    const now = Date.now();
    if (diagnosticCache && (now - diagnosticCacheTime) < DIAGNOSTIC_CACHE_TTL) {
      diagnosticCache._cached = true;
      diagnosticCache._cacheAge = Math.round((now - diagnosticCacheTime) / 1000) + 's';
      diagnosticCache._nextRefresh = Math.round((DIAGNOSTIC_CACHE_TTL - (now - diagnosticCacheTime)) / 1000) + 's';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(diagnosticCache, null, 2));
      return;
    }

    const diag = {
      timestamp: new Date().toISOString(),
      _cached: false,
      tokenSource: process.env.DISCORD_TOKEN ? 'DISCORD_TOKEN' : process.env.DISCORD_BOT_TOKEN ? 'DISCORD_BOT_TOKEN' : 'NONE',
      tokenLength: config.token ? config.token.length : 0,
      tokenBotId: (() => { try { const p = config.token?.split('.')[0]; return p ? Buffer.from(p, 'base64').toString() : 'NO_TOKEN'; } catch { return 'DECODE_ERROR'; } })(),
      tokenMatchesClientId: (() => { try { const p = config.token?.split('.')[0]; const id = p ? Buffer.from(p, 'base64').toString() : ''; return id === config.clientId ? 'YES' : `MISMATCH: token_bot_id=${id} config=${config.clientId}`; } catch { return 'DECODE_ERROR'; } })(),
      lastCommandDebug: lastCommandDebug,
    };
    try {
      if (config.token && config.clientId) {
        const headers = { Authorization: `Bot ${config.token}` };
        // Check global commands
        const globalRes = await discordFetch(`/api/v10/applications/${config.clientId}/commands`, { headers });
        diag.globalCommands = { status: globalRes.status };
        if (globalRes.ok) {
          const cmds = await globalRes.json();
          diag.globalCommands.count = cmds.length;
          diag.globalCommands.names = cmds.map(c => c.name);
        } else {
          diag.globalCommands.error = await globalRes.text();
        }
        // Check guild commands
        if (config.guildId) {
          const guildRes = await discordFetch(`/api/v10/applications/${config.clientId}/guilds/${config.guildId}/commands`, { headers });
          diag.guildCommands = { status: guildRes.status };
          if (guildRes.ok) {
            const cmds = await guildRes.json();
            diag.guildCommands.count = cmds.length;
            diag.guildCommands.names = cmds.map(c => c.name);
          } else {
            diag.guildCommands.error = await guildRes.text();
          }
        }
        // Check bot identity
        const meRes = await discordFetch('/api/v10/users/@me', { headers });
        diag.botIdentity = { status: meRes.status };
        if (meRes.ok) {
          const me = await meRes.json();
          diag.botIdentity.id = me.id;
          diag.botIdentity.username = me.username;
          diag.botIdentity.applicationId = me.id;
          diag.botIdentity.configClientIdMatch = me.id === config.clientId;
        }
      }
      diag.eventListeners = {
        interactionCreate: client.listenerCount('interactionCreate'),
        ready: client.listenerCount('ready'),
        guildMemberAdd: client.listenerCount('guildMemberAdd'),
        error: client.listenerCount('error'),
      };
      diag.configClientId = config.clientId;
      diag.configGuildId = config.guildId;
    } catch (e) {
      diag.error = e.message;
    }
    // Cache the result to avoid repeated Discord API calls
    diagnosticCache = diag;
    diagnosticCacheTime = now;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(diag, null, 2));
  } else if (req.url === '/trigger-gilded-sync' || req.url?.startsWith('/trigger-gilded-sync?')) {
    // Manual trigger for Gilded role sync — secured with DIAGNOSTIC_API_KEY
    const diagKey = process.env.DIAGNOSTIC_API_KEY;
    if (diagKey) {
      const url = new URL(req.url, `http://localhost:${HEALTH_PORT}`);
      const providedKey = url.searchParams.get('key') || req.headers['x-diagnostic-key'];
      if (providedKey !== diagKey) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden — provide ?key= or X-Diagnostic-Key header' }));
        return;
      }
    }
    console.log('✨ Manual Gilded sync triggered via HTTP');
    syncGildedRoles().then(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', message: 'Gilded role sync completed', lastSync: lastGildedSync }));
    }).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', message: err.message }));
    });
  } else if (req.url === '/trigger-transfer-sync' || req.url?.startsWith('/trigger-transfer-sync?')) {
    // Manual trigger for Transfer Group role sync — secured with DIAGNOSTIC_API_KEY
    const diagKey = process.env.DIAGNOSTIC_API_KEY;
    if (diagKey) {
      const url = new URL(req.url, `http://localhost:${HEALTH_PORT}`);
      const providedKey = url.searchParams.get('key') || req.headers['x-diagnostic-key'];
      if (providedKey !== diagKey) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden — provide ?key= or X-Diagnostic-Key header' }));
        return;
      }
    }
    console.log('🔀 Manual Transfer Group sync triggered via HTTP');
    syncTransferGroupRoles().then(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', message: 'Transfer Group role sync completed', lastSync: lastTransferGroupSync }));
    }).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', message: err.message }));
    });
  } else if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Atlas Discord Bot - Use /health for status');
  } else {
    res.writeHead(404);
    res.end();
  }
});

const HEALTH_PORT = process.env.PORT || 10000;
healthServer.listen(HEALTH_PORT, () => {
  console.log(`🏥 Health server running on port ${HEALTH_PORT}`);
});

// Self-ping keepalive to prevent Render free tier spin-down
const SELF_PING_INTERVAL = 10 * 60 * 1000; // 10 minutes
let selfPingTimer = null;

function startSelfPing() {
  const selfUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${HEALTH_PORT}`;
  
  selfPingTimer = setInterval(async () => {
    try {
      const res = await fetch(`${selfUrl}/health`);
      const data = await res.json();
      console.log(`🏓 Self-ping: ${data.status} (ws: ${data.discord?.wsStatus}, ping: ${data.discord?.ping}ms)`);
      lastHeartbeat = Date.now();
    } catch (e) {
      console.error('❌ Self-ping failed:', e.message);
    }
  }, SELF_PING_INTERVAL);
  
  console.log(`🏓 Self-ping started (every ${SELF_PING_INTERVAL / 60000} minutes)`);
}

// ============================================================================

// Startup logging
console.log('🚀 Atlas Discord Bot starting...');
console.log(`📅 ${new Date().toISOString()}`);
console.log(`🔧 Node ${process.version}`);
console.log(`🌐 API URL: ${config.apiUrl || 'NOT SET'}`);

// Log which token env var is being used (for debugging)
const tokenSource = process.env.DISCORD_TOKEN ? 'DISCORD_TOKEN' : 
                    process.env.DISCORD_BOT_TOKEN ? 'DISCORD_BOT_TOKEN' : 'NONE';
console.log(`🔑 Token source: ${tokenSource}`);

// Log startup to persistent telemetry
telemetry.logStartup({ token_source: tokenSource, api_url: config.apiUrl });

// Validate configuration
if (!config.token || !config.clientId) {
  console.error('❌ Missing Discord credentials');
  console.log('   DISCORD_TOKEN present:', !!process.env.DISCORD_TOKEN);
  console.log('   DISCORD_BOT_TOKEN present:', !!process.env.DISCORD_BOT_TOKEN);
  console.log('   DISCORD_CLIENT_ID present:', !!config.clientId);
  console.log('   DISCORD_GUILD_ID present:', !!config.guildId);
  console.log('');
  console.log('   Please set either DISCORD_TOKEN or DISCORD_BOT_TOKEN in environment');
  process.exit(1);
}

console.log('✅ Configuration validated');
console.log(`   Token length: ${config.token.length} chars`);
if (!SPOTLIGHT_WEBHOOK_URL) {
  console.warn('⚠️ DISCORD_SPOTLIGHT_WEBHOOK_URL not set — spotlight messages disabled');
}
if (!WELCOME_CHANNEL_ID) {
  console.warn('⚠️ DISCORD_WELCOME_CHANNEL_ID not set — welcome messages will use name matching fallback');
}

// Initialize Discord client
// GuildMembers intent is REQUIRED for: role assignment, welcome messages, member events
// IMPORTANT: Must also enable "Server Members Intent" in Discord Developer Portal:
// https://discord.com/developers/applications/{APP_ID}/bot → Privileged Gateway Intents
const clientRestOptions = {
  timeout: 15_000, // 15s timeout for REST API calls (prevents hanging on rate limits)
  retries: 1,      // Only retry REST calls once
};
if (DISCORD_API_PROXY) {
  clientRestOptions.api = `${DISCORD_API_PROXY}/api`;
  clientRestOptions.headers = { 'X-Proxy-Key': DISCORD_PROXY_KEY };
  console.log(`🔀 Client REST routed through proxy: ${DISCORD_API_PROXY}/api`);
}
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Reaction, Partials.User],
  rest: clientRestOptions,
});

// Event: Ready — MUST use .on() not .once() because login retries can
// consume a once() handler on a partial connection that gets destroyed,
// leaving the successful retry without a ready handler.
let readyFiredCount = 0;
client.on('ready', async () => {
  readyFiredCount++;
  botReady = true;
  lastHeartbeat = Date.now();
  
  // Clear stale diagnostic state - bot is connected now
  lastError = null;
  loginLastResult = 'connected';
  lastDisconnectCode = null;
  lastDisconnectReason = null;
  
  console.log(`\n✅ Atlas is online as ${client.user.tag} (ready #${readyFiredCount})`);
  console.log(`📊 Serving ${client.guilds.cache.size} server(s)`);
  console.log(`🔗 API: ${config.apiUrl}`);
  console.log(`   Bot ID: ${client.user.id}`);
  console.log(`   Config CLIENT_ID: ${config.clientId}`);
  if (client.user.id !== config.clientId) {
    console.error(`❌ CRITICAL: Bot ID (${client.user.id}) does NOT match DISCORD_CLIENT_ID (${config.clientId})!`);
    console.error('   Commands are registered under the wrong application!');
    console.error('   Fix: Set DISCORD_CLIENT_ID=${client.user.id} on Render');
    lastError = `APP_ID_MISMATCH: bot=${client.user.id} config=${config.clientId}`;
  } else {
    console.log('   ✅ Bot ID matches CLIENT_ID');
  }
  console.log(`\n"${config.bot.tagline}"\n`);
  
  // Log ready to persistent telemetry
  telemetry.logReady(client);
  
  // Start memory monitoring
  telemetry.startMemoryMonitoring(client);
  
  // Start self-ping keepalive (guard against duplicate timers)
  if (selfPingTimer) clearInterval(selfPingTimer);
  startSelfPing();

  // Unified role sync — runs all syncs SEQUENTIALLY to share a single
  // guild.members.fetch() call (cached 5 min) and avoid opcode 8 rate limits.
  // First run after 60s, then every 30 min.
  async function runAllRoleSyncs() {
    console.log('🔄 Starting unified role sync...');
    // Pre-fetch linked-users ONCE and share across settler/referral/transfer syncs
    // (previously each sync called /linked-users independently — 3 redundant API calls)
    let cachedLinkedUsers = null;
    try {
      const res = await atlasFetch('/api/v1/bot/linked-users');
      if (res.ok) {
        const data = await res.json();
        cachedLinkedUsers = data.users || [];
        console.log(`🔄 Pre-fetched ${cachedLinkedUsers.length} linked users for unified sync`);
      } else {
        console.error(`🔄 Pre-fetch linked-users failed (${res.status}) — each sync will fetch independently`);
      }
    } catch (err) {
      console.error(`🔄 Pre-fetch linked-users error: ${err.message} — each sync will fetch independently`);
    }
    await syncSettlerRoles(cachedLinkedUsers);
    await syncReferralRoles(cachedLinkedUsers);
    if (SUPPORTER_ROLE_ID) await syncSupporterRoles();
    if (GILDED_ROLE_ID) await syncGildedRoles();
    await syncTransferGroupRoles(cachedLinkedUsers);
    await syncBoosterStatus();
    console.log('🔄 Unified role sync complete');
  }

  if (settlerSyncInitTimeout) clearTimeout(settlerSyncInitTimeout);
  if (settlerSyncTimer) clearInterval(settlerSyncTimer);
  settlerSyncInitTimeout = setTimeout(() => runAllRoleSyncs(), 60_000);
  settlerSyncTimer = setInterval(() => runAllRoleSyncs(), SETTLER_SYNC_INTERVAL);
  console.log(`🔄 Unified role sync scheduled (Settler + Referral + Supporter + Gilded + TransferGroup + Booster, every ${SETTLER_SYNC_INTERVAL / 60000} min)`);
  if (!SUPPORTER_ROLE_ID) console.log('⚠️ DISCORD_SUPPORTER_ROLE_ID not set — Supporter role sync disabled');
  if (!GILDED_ROLE_ID) console.log('⚠️ DISCORD_GILDED_ROLE_ID not set — Gilded role sync disabled');

  // Rotating bot presence (guard against duplicate timers on reconnect)
  if (presenceTimer) clearInterval(presenceTimer);
  presenceIndex = 0;
  const updatePresence = () => {
    client.user.setPresence({
      activities: [{
        name: presenceMessages[presenceIndex % presenceMessages.length],
        type: ActivityType.Playing,
      }],
      status: 'online',
    });
    presenceIndex++;
  };
  updatePresence();
  presenceTimer = setInterval(updatePresence, 60_000);

  // Initialize scheduled tasks (daily updates at 02:00 UTC)
  // Only on first ready to avoid duplicate cron jobs
  if (readyFiredCount === 1) {
    scheduler.initScheduler(client);
    initReactionRoles(client);
  }
  
  // Test API connectivity
  testApiConnectivity();

  // Register slash commands only when explicitly requested — they persist in Discord.
  // Re-registering on every boot wastes 2 REST API calls and contributes to
  // Cloudflare rate-limit bans (Error 1015) on Render's shared IP.
  if (process.env.REGISTER_COMMANDS === '1') {
    console.log('🔄 REGISTER_COMMANDS=1 set, registering commands...');
    registerCommandsWithRetry();
  } else {
    console.log('ℹ️  Command registration skipped (commands persist in Discord)');
    console.log('   Set REGISTER_COMMANDS=1 on Render to force re-registration');
    commandRegistrationResult = 'skipped (persisted)';
  }
});

/**
 * Register slash commands with Discord REST API.
 * Retries up to 5 times with 2-minute delays if registration fails
 * (e.g., REST API still rate-limited even though WebSocket connected).
 */
let cmdRegRetries = 0;
const CMD_REG_MAX_RETRIES = 5;

async function registerCommandsWithRetry() {
  try {
    await registerCommands();
  } catch (err) {
    console.error(`❌ Command registration attempt failed: ${err.message}`);
    if (cmdRegRetries < CMD_REG_MAX_RETRIES) {
      cmdRegRetries++;
      const delay = 120_000; // 2 minutes
      console.log(`🔄 Retrying command registration in 2min (attempt ${cmdRegRetries}/${CMD_REG_MAX_RETRIES})`);
      commandRegistrationResult = `retry_scheduled: attempt ${cmdRegRetries}/${CMD_REG_MAX_RETRIES} in 2min`;
      setTimeout(() => registerCommandsWithRetry(), delay);
    } else {
      commandRegistrationResult = `failed_all_retries: ${err.message}`;
    }
  }
}

async function registerCommands() {
  const restOptions = { version: '10' };
  if (DISCORD_API_PROXY) {
    restOptions.api = `${DISCORD_API_PROXY}/api`;
    restOptions.headers = { 'X-Proxy-Key': DISCORD_PROXY_KEY };
  }
  const rest = new REST(restOptions).setToken(config.token);
  const REGISTRATION_TIMEOUT = 60000; // 60 seconds

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Command registration timed out after 60s')), REGISTRATION_TIMEOUT)
  );

  // Register GUILD commands first (instant effect) — critical for testing
  if (config.guildId) {
    console.log(`🔄 Registering ${commands.length} slash commands to guild ${config.guildId}...`);
    await Promise.race([
      rest.put(
        Routes.applicationGuildCommands(config.clientId, config.guildId),
        { body: commands }
      ),
      timeoutPromise,
    ]);
    console.log(`✅ Guild commands registered (instant effect)`);
    commandRegistrationResult = `guild_ok: ${commands.length} commands`;
  }

  // Also register globally (works in ALL servers, takes up to 1 hour)
  console.log('🔄 Registering slash commands globally...');
  await Promise.race([
    rest.put(
      Routes.applicationCommands(config.clientId),
      { body: commands }
    ),
    timeoutPromise,
  ]);
  console.log('✅ Global commands registered');
  commandRegistrationResult = `ok: ${commands.length} commands (guild+global)`;
  cmdRegRetries = 0;
}

// Event: Resumed (reconnected after disconnect)
client.on('resumed', () => {
  console.log('🔄 Discord connection resumed');
  lastHeartbeat = Date.now();
});

// Event: Disconnect
client.on('disconnect', () => {
  console.warn('⚠️ Discord disconnected');
  botReady = false;
  telemetry.logDisconnect(null, 'disconnect_event', client);
});

// Event: Error
client.on('error', (error) => {
  console.error('❌ Discord client error:', error);
});

// Event: Warn
client.on('warn', (info) => {
  console.warn('⚠️ Discord warning:', info);
});

// Event: Shard reconnecting
client.on('shardReconnecting', (id) => {
  console.log(`🔄 Shard ${id} reconnecting...`);
});

// Event: Shard resumed
client.on('shardResume', (id, replayedEvents) => {
  console.log(`✅ Shard ${id} resumed (${replayedEvents} events replayed)`);
  botReady = true;
  lastHeartbeat = Date.now();
  telemetry.logReconnect(id, replayedEvents, client);
});

// Event: Shard error - critical for diagnosing connection issues
client.on('shardError', (error, shardId) => {
  console.error(`❌ Shard ${shardId} error:`, error.message);
  console.error('   Code:', error.code);
  lastError = `Shard ${shardId}: ${error.message} (code: ${error.code})`;
  telemetry.logShardError(shardId, error, client);
});

// Event: Shard disconnect - capture close code for remote diagnostics
// Discord close codes: 4004=AUTH_FAILED, 4014=DISALLOWED_INTENTS, 4013=INVALID_INTENTS
client.on('shardDisconnect', (event, shardId) => {
  const closeCodeNames = {
    1000: 'NORMAL', 1001: 'GOING_AWAY', 4000: 'UNKNOWN_ERROR',
    4001: 'UNKNOWN_OPCODE', 4002: 'DECODE_ERROR', 4003: 'NOT_AUTHENTICATED',
    4004: 'AUTHENTICATION_FAILED', 4005: 'ALREADY_AUTHENTICATED',
    4007: 'INVALID_SEQ', 4008: 'RATE_LIMITED', 4009: 'SESSION_TIMED_OUT',
    4010: 'INVALID_SHARD', 4011: 'SHARDING_REQUIRED', 4012: 'INVALID_API_VERSION',
    4013: 'INVALID_INTENTS', 4014: 'DISALLOWED_INTENTS',
  };
  const codeName = closeCodeNames[event.code] || 'UNKNOWN';
  console.warn(`⚠️ Shard ${shardId} disconnected. Code: ${event.code} (${codeName}), Clean: ${event.wasClean}`);
  
  lastDisconnectCode = event.code;
  lastDisconnectReason = codeName;
  botReady = false;
  telemetry.logDisconnect(event.code, codeName, client);
  
  // Provide actionable guidance based on close code
  if (event.code === 4004) {
    lastError = 'AUTHENTICATION_FAILED: Bot token is invalid or revoked. Reset token in Discord Developer Portal and update DISCORD_TOKEN on Render.';
    console.error('❌ TOKEN INVALID (4004): Reset token in Discord Developer Portal > Bot > Reset Token');
    console.error('   Then update DISCORD_TOKEN env var on Render dashboard');
  } else if (event.code === 4014) {
    lastError = 'DISALLOWED_INTENTS: Server Members Intent not enabled. Go to Discord Developer Portal > Bot > Privileged Gateway Intents.';
    console.error('❌ DISALLOWED INTENTS (4014): Enable Server Members Intent in Discord Developer Portal');
    console.error('   https://discord.com/developers/applications/' + (config.clientId || 'YOUR_APP_ID') + '/bot');
  } else if (event.code === 4013) {
    lastError = 'INVALID_INTENTS: Requested intents are invalid. Check GatewayIntentBits in bot.js.';
    console.error('❌ INVALID INTENTS (4013): Check intents configuration');
  }
});

// Event: Invalidated session - token may be invalid
client.on('invalidated', () => {
  console.error('❌ Session invalidated - token may be invalid or revoked');
  botReady = false;
  lastError = 'Session invalidated - token may be invalid or revoked';
  telemetry.logSessionInvalidated(client);
  // Attempt re-login after delay (token may have been rotated on Render)
  scheduleReconnect('session_invalidated');
});

// ============================================================================
// RECONNECTION LOGIC - Exponential backoff for login/session failures
// ============================================================================
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY = 5000; // 5 seconds
let reconnectTimer = null;

function scheduleReconnect(reason) {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error(`❌ Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Reason: ${reason}`);
    console.error('   Bot will rely on Render auto-restart to recover.');
    return;
  }
  
  reconnectAttempts++;
  const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1), 120000); // Cap at 2 minutes
  console.log(`🔄 Reconnect attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay / 1000}s (reason: ${reason})`);
  telemetry.logLoginRetry(reconnectAttempts, MAX_RECONNECT_ATTEMPTS, delay);
  
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(async () => {
    try {
      console.log('🔐 Attempting Discord re-login...');
      await client.login(config.token);
      console.log('✅ Discord re-login successful');
      reconnectAttempts = 0; // Reset on success
    } catch (error) {
      console.error(`❌ Re-login failed: ${error.message}`);
      if (error.code === 'TOKEN_INVALID') {
        console.error('   Token is invalid — cannot retry. Waiting for Render restart with new token.');
        return; // Don't retry on invalid token
      }
      scheduleReconnect(error.message);
    }
  }, delay);
}

// Startup API connectivity test (runs once after client ready)
async function testApiConnectivity() {
  console.log('🧪 Testing API connectivity...');
  try {
    const testUrl = `${config.apiUrl}/api/v1/leaderboard?limit=1`;
    console.log(`[TEST] Fetching: ${testUrl}`);
    const response = await fetch(testUrl);
    console.log(`[TEST] Response status: ${response.status}`);
    if (response.ok) {
      const data = await response.json();
      console.log(`[TEST] ✅ API connected! Got ${data.length} kingdom(s)`);
      if (data.length > 0) {
        console.log(`[TEST] Sample: K${data[0].kingdom_number} score=${data[0].overall_score}`);
      }
    } else {
      console.error(`[TEST] ❌ API returned ${response.status}: ${response.statusText}`);
    }
  } catch (e) {
    console.error(`[TEST] ❌ API connection failed: ${e.name} - ${e.message}`);
  }
}

// Session-based usage tracking for soft upsell prompt (non-supporters only)
// Tracks per-user command count with 1-hour TTL
const sessionUsage = new Map(); // userId -> { count, lastUsed }
const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour
const SUPPORTER_ROLE_ID_FOR_UPSELL = process.env.DISCORD_SUPPORTER_ROLE_ID || '';

function getSessionCount(userId) {
  const entry = sessionUsage.get(userId);
  if (!entry || Date.now() - entry.lastUsed > SESSION_TTL_MS) {
    sessionUsage.set(userId, { count: 1, lastUsed: Date.now() });
    return 1;
  }
  entry.count++;
  entry.lastUsed = Date.now();
  return entry.count;
}

// Event: Interaction (slash commands)
client.on('interactionCreate', async (interaction) => {
  interactionCount++;
  lastInteractionTime = new Date().toISOString();
  
  // Log ALL interactions for debugging
  const iType = interaction.type;
  const isChatInput = interaction.isChatInputCommand();
  console.log(`📥 Interaction #${interactionCount}: type=${iType} isChatInput=${isChatInput} id=${interaction.id}`);
  lastCommandDebug = `type=${iType} isChatInput=${isChatInput} ts=${lastInteractionTime}`;
  
  // Handle autocomplete interactions (e.g. /kingdom number)
  if (interaction.isAutocomplete()) {
    try {
      const focused = interaction.options.getFocused(true);
      if ((interaction.commandName === 'kingdom' || interaction.commandName === 'history') && focused.name === 'number') {
        const typed = String(focused.value);
        if (!kingdomCache || Date.now() - kingdomCacheTime > 300_000) {
          const result = await require('./utils/api').fetchLeaderboard(100);
          kingdomCache = (result.data || result).map(k => k.kingdom_number).sort((a, b) => a - b);
          kingdomCacheTime = Date.now();
        }
        const filtered = kingdomCache
          .filter(n => String(n).startsWith(typed))
          .slice(0, 25)
          .map(n => ({ name: `Kingdom ${n}`, value: n }));
        await interaction.respond(filtered);
      }
    } catch (e) {
      console.error('Autocomplete error:', e.message);
    }
    return;
  }

  if (!isChatInput) {
    lastCommandDebug += ' SKIPPED(not chat input)';
    return;
  }

  const { commandName } = interaction;
  console.log(`📥 Command: /${commandName} from ${interaction.user.tag} (interaction #${interactionCount})`);
  lastCommandDebug = `/${commandName} from ${interaction.user.tag}`;

  // CRITICAL: Patch interaction methods to use raw fetch() instead of discord.js REST client.
  // The REST client may have global rate-limit state from 429s that blocks ALL REST calls,
  // including interaction responses. Raw fetch bypasses this entirely.
  const iToken = interaction.token;
  const iId = interaction.id;
  const appId = client.user?.id || config.clientId;

  interaction.deferReply = async (options = {}) => {
    console.log(`   [${commandName}] RAW deferReply...`);
    const resp = await discordFetch(`/api/v10/interactions/${iId}/${iToken}/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 5, data: options.ephemeral ? { flags: 64 } : {} })
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`deferReply failed: ${resp.status} ${text.substring(0, 200)}`);
    }
    interaction.deferred = true;
    console.log(`   [${commandName}] RAW deferReply OK (${resp.status})`);
  };

  interaction.reply = async (options) => {
    console.log(`   [${commandName}] RAW reply...`);
    const data = typeof options === 'string' ? { content: options } : { ...options };
    const body = {
      type: 4,
      data: {
        content: data.content || undefined,
        embeds: data.embeds?.map(e => (typeof e.toJSON === 'function' ? e.toJSON() : e)),
        components: data.components?.map(c => (typeof c.toJSON === 'function' ? c.toJSON() : c)),
        flags: data.ephemeral ? 64 : 0,
      }
    };
    const resp = await discordFetch(`/api/v10/interactions/${iId}/${iToken}/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`reply failed: ${resp.status} ${text.substring(0, 200)}`);
    }
    interaction.replied = true;
    console.log(`   [${commandName}] RAW reply OK (${resp.status})`);
  };

  interaction.editReply = async (options) => {
    console.log(`   [${commandName}] RAW editReply...`);
    const data = typeof options === 'string' ? { content: options } : { ...options };
    const resp = await discordFetch(`/api/v10/webhooks/${appId}/${iToken}/messages/@original`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: data.content || undefined,
        embeds: data.embeds?.map(e => (typeof e.toJSON === 'function' ? e.toJSON() : e)),
        components: data.components?.map(c => (typeof c.toJSON === 'function' ? c.toJSON() : c)),
      })
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`editReply failed: ${resp.status} ${text.substring(0, 200)}`);
    }
    console.log(`   [${commandName}] RAW editReply OK (${resp.status})`);
  };

  const startTime = Date.now();
  
  try {
    console.log(`   [${commandName}] Step 1: Dispatching to handler...`);
    switch (commandName) {
      case 'kingdom':
        await handlers.handleKingdom(interaction);
        break;
      case 'compare':
        await handlers.handleCompare(interaction);
        break;
      case 'rankings':
        await handlers.handleRankings(interaction);
        break;
      case 'tier':
        await handlers.handleTier(interaction);
        break;
      case 'countdownkvk':
        await handlers.handleCountdownKvk(interaction);
        break;
      case 'countdowntransfer':
        await handlers.handleCountdownTransfer(interaction);
        break;
      case 'history':
        await handlers.handleHistory(interaction);
        break;
      case 'predict':
        await handlers.handlePredict(interaction);
        break;
      case 'multirally':
        await handlers.handleMultirally(interaction);
        break;
      case 'help':
        await handlers.handleHelp(interaction);
        break;
      case 'codes':
        await handlers.handleCodes(interaction);
        break;
      case 'link':
        await handlers.handleLink(interaction);
        break;
      case 'stats':
        await handlers.handleStats(interaction);
        break;
      case 'countdown':
        await interaction.reply({
          content: '`/countdown` has been renamed! Use:\n• `/countdownkvk` — Time until next KvK\n• `/countdowntransfer` — Time until next Transfer Event',
          ephemeral: true,
        });
        break;
      default:
        console.warn(`   [${commandName}] Unknown command`);
        lastCommandDebug += ' UNKNOWN_COMMAND';
    }
    
    // Log successful command
    const responseTime = Date.now() - startTime;
    console.log(`   [${commandName}] ✅ Completed in ${responseTime}ms`);
    lastCommandDebug += ` OK(${responseTime}ms)`;
    lastCommandError = null;
    
    try {
      logger.logCommand(interaction, responseTime, true);
      logger.syncToApi(commandName, interaction.guildId || 'DM', interaction.user.id, responseTime);
    } catch (logErr) {
      console.error(`   [${commandName}] Logger error (non-fatal): ${logErr.message}`);
    }

    // Soft "Support Atlas" prompt after 5th command use in a session (non-supporters only)
    try {
      const sessionCount = getSessionCount(interaction.user.id);
      const isSupporterUser = SUPPORTER_ROLE_ID_FOR_UPSELL && interaction.member?.roles?.cache?.has(SUPPORTER_ROLE_ID_FOR_UPSELL);
      if (sessionCount === 5 && !isSupporterUser && commandName !== 'help') {
        await discordFetch(`/api/v10/webhooks/${appId}/${iToken}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: '💖 *Enjoying Atlas? You\'ve used 5 commands this session! Consider supporting at **ks-atlas.com/support** to unlock unlimited `/multirally` and help keep Atlas free for everyone.*',
            flags: 64, // ephemeral
          }),
        });
      }
    } catch (_) { /* never block on upsell */ }
  } catch (error) {
    const errMsg = `${error.name}: ${error.message}`;
    console.error(`   [${commandName}] ❌ HANDLER ERROR: ${errMsg}`);
    console.error(`   [${commandName}] Stack: ${error.stack}`);
    lastCommandError = `/${commandName}: ${errMsg}`;
    lastCommandDebug += ` ERROR(${errMsg})`;
    
    try { logger.logError(commandName, error, interaction); } catch (e) { /* ignore logger errors */ }

    const errorReply = {
      content: '❌ Something went wrong. Please try again later.',
      ephemeral: true,
    };

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errorReply);
      } else {
        await interaction.reply(errorReply);
      }
    } catch (replyError) {
      console.error('Failed to send error reply:', replyError);
    }
  }
});

// Event: Guild join (new server)
client.on('guildCreate', (guild) => {
  console.log(`📥 Joined new server: ${guild.name} (${guild.id})`);
  logger.logGuildEvent('join', guild);
});

// Event: Guild leave
client.on('guildDelete', (guild) => {
  console.log(`📤 Left server: ${guild.name} (${guild.id})`);
  logger.logGuildEvent('leave', guild);
});

// Event: New member joins - send welcome message + check Settler/TransferGroup role eligibility
// ONLY runs in the primary Atlas Discord server to avoid spamming other servers
client.on('guildMemberAdd', async (member) => {
  console.log(`👋 New member: ${member.user.username} joined ${member.guild.name}`);
  
  // Guard: only run in the Kingshot Atlas Discord server
  if (config.guildId && member.guild.id !== config.guildId) {
    console.log(`⏭️ Skipping welcome for ${member.user.username} — guild ${member.guild.name} is not the primary Atlas server`);
    return;
  }

  try {
    // Fetch channels from API to ensure fresh data (cache may be stale/empty)
    let channels;
    try {
      channels = await member.guild.channels.fetch();
    } catch (fetchErr) {
      console.error(`Failed to fetch channels for ${member.guild.name}:`, fetchErr.message);
      channels = member.guild.channels.cache; // fallback to cache
    }
    
    // Find the welcome channel — prefer channel ID (most reliable), then name patterns
    let welcomeChannel = null;
    
    // Priority 1: Explicit channel ID (set DISCORD_WELCOME_CHANNEL_ID on Render)
    if (WELCOME_CHANNEL_ID) {
      welcomeChannel = channels.get(WELCOME_CHANNEL_ID);
      if (!welcomeChannel) {
        console.warn(`⚠️ DISCORD_WELCOME_CHANNEL_ID=${WELCOME_CHANNEL_ID} not found in ${member.guild.name}`);
      }
    }
    
    // Priority 2: Name matching with configurable patterns
    if (!welcomeChannel) {
      const welcomeChannelName = process.env.DISCORD_WELCOME_CHANNEL || 'welcome';
      const welcomePatterns = [welcomeChannelName, 'welcome', 'welcomes', 'welcome-chat', '👋welcome', '👋-welcome'];
      
      for (const pattern of welcomePatterns) {
        welcomeChannel = channels.find(
          ch => ch.name === pattern && ch.isTextBased()
        );
        if (welcomeChannel) break;
      }
      
      // Broader fallback: any channel containing 'welcome' in the name
      if (!welcomeChannel) {
        welcomeChannel = channels.find(
          ch => ch.name && ch.name.includes('welcome') && ch.isTextBased()
        );
      }
    }
    
    if (welcomeChannel) {
      // Resolve channel mentions by finding actual channel IDs
      const generalCh = channels.find(ch => ch.name && ch.name.includes('general') && ch.isTextBased() && !ch.name.includes('welcome'));
      const commandsCh = channels.find(ch => ch.name && ch.name.includes('atlas-commands') && ch.isTextBased());
      const readmeCh = LINK_PROMPT_CHANNEL_ID ? channels.get(LINK_PROMPT_CHANNEL_ID) : null;
      const gen = generalCh ? `<#${generalCh.id}>` : '#💬-general';
      const cmd = commandsCh ? `<#${commandsCh.id}>` : '#🤖-atlas-commands';
      const readme = readmeCh ? `<#${readmeCh.id}>` : null;
      
      const mention = `<@${member.user.id}>`;
      const embed = createWelcomeEmbed(gen, cmd, readme);
      await welcomeChannel.send({ content: `Welcome to Atlas, ${mention}!`, embeds: [embed] });
      console.log(`✅ Sent welcome message for ${member.user.username} in #${welcomeChannel.name}`);
    } else {
      const channelNames = channels.map(ch => ch.name).filter(Boolean);
      console.warn(`⚠️ No welcome channel found in ${member.guild.name}. Available text channels: ${channelNames.slice(0, 15).join(', ')}`);
    }
  } catch (error) {
    console.error('Failed to send welcome message:', error);
  }

  // Assign Explorer role to every new member instantly
  if (EXPLORER_ROLE_ID) {
    try {
      if (!member.roles.cache.has(EXPLORER_ROLE_ID)) {
        await member.roles.add(EXPLORER_ROLE_ID, 'Auto-assign: Explorer role for all new members');
        console.log(`🧭 Explorer role assigned to ${member.user.username}`);
      }
    } catch (error) {
      console.error(`Failed to assign Explorer role to ${member.user.username}:`, error.message);
    }
  }

  // Check if this new member is eligible for Settler role
  try {
    await checkAndAssignSettlerRole(member);
  } catch (error) {
    console.error(`Failed to check Settler role for ${member.user.username}:`, error.message);
  }

  // Check if this new member is eligible for a Transfer Group role
  try {
    await checkAndAssignTransferGroupRole(member);
  } catch (error) {
    console.error(`Failed to check Transfer Group role for ${member.user.username}:`, error.message);
  }
});

// Event: Member update — detect server boosts for auto-spotlight
// ONLY runs in the primary Atlas Discord server
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  // Guard: only run in the Kingshot Atlas Discord server
  if (config.guildId && newMember.guild.id !== config.guildId) return;

  try {
    const wasBoosting = oldMember.premiumSince !== null;
    const isBoosting = newMember.premiumSince !== null;
    if (!wasBoosting && isBoosting) {
      console.log(`🚀 ${newMember.user.username} just boosted the server!`);
      sendSpotlightMessage('booster', newMember.user.id, newMember.displayName || newMember.user.username).catch(() => {});
    }
  } catch (err) {
    // Non-critical — don't let spotlight errors affect member updates
    console.error('Boost detection error:', err.message);
  }
});

// ============================================================================
// CACHED GUILD MEMBERS FETCH — prevents opcode 8 rate limiting
// Each guild.members.fetch() sends REQUEST_GUILD_MEMBERS (opcode 8) to the
// gateway. When 4+ syncs run within minutes of each other, Discord rate-limits
// this. Solution: cache the result for 5 minutes and share across all syncs.
// ============================================================================
let _cachedMembers = null;
let _cachedMembersTime = 0;
const MEMBERS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchGuildMembersCached(guild) {
  const now = Date.now();
  if (_cachedMembers && (now - _cachedMembersTime) < MEMBERS_CACHE_TTL) {
    return _cachedMembers;
  }
  _cachedMembers = await guild.members.fetch();
  _cachedMembersTime = now;
  console.log(`📋 Guild members cache refreshed (${_cachedMembers.size} members)`);
  return _cachedMembers;
}

// ============================================================================
// SETTLER ROLE AUTO-ASSIGNMENT
// Queries API for users with linked Discord + Kingshot accounts,
// then assigns the Settler role to eligible guild members.
// ============================================================================

/**
 * Check a single guild member for Settler role eligibility via API.
 */
async function checkAndAssignSettlerRole(member) {
  try {
    const res = await atlasFetch('/api/v1/bot/linked-users');
    if (!res.ok) return;
    const data = await res.json();
    const eligible = (data.users || []).find(u => u.discord_id === member.user.id);
    if (eligible && !member.roles.cache.has(SETTLER_ROLE_ID)) {
      await member.roles.add(SETTLER_ROLE_ID, 'Auto-assign: linked Kingshot + Discord on ks-atlas.com');
      console.log(`🎖️ Settler role assigned to ${member.user.username} (new member, already linked)`);
    }
  } catch (err) {
    console.error(`Settler check failed for ${member.user.username}:`, err.message);
  }
}

/**
 * Periodic sync: fetch all eligible users from API, assign Settler role
 * to guild members who don't have it yet, remove from those who lost eligibility.
 */
async function syncSettlerRoles(prefetchedUsers = null) {
  if (!botReady || !client.guilds.cache.size) {
    console.log('🎖️ Settler sync skipped (bot not ready)');
    return;
  }

  console.log('🎖️ Settler role sync starting...');
  const startTime = Date.now();

  try {
    // Use pre-fetched data from unified sync, or fetch independently as fallback
    let eligibleUsers;
    if (prefetchedUsers) {
      eligibleUsers = prefetchedUsers;
    } else {
      const res = await atlasFetch('/api/v1/bot/linked-users');
      if (!res.ok) {
        console.error(`🎖️ Settler sync: API returned ${res.status}`);
        return;
      }
      const data = await res.json();
      eligibleUsers = data.users || [];
    }
    const eligibleDiscordIds = new Set(eligibleUsers.map(u => u.discord_id).filter(Boolean));

    console.log(`🎖️ ${eligibleDiscordIds.size} eligible users from API`);

    const guild = client.guilds.cache.get(config.guildId);
    if (!guild) {
      console.error('🎖️ Settler sync: guild not found in cache');
      return;
    }

    // Fetch all members (cached to prevent opcode 8 rate limiting)
    await fetchGuildMembersCached(guild);

    let assigned = 0;
    let removed = 0;
    let alreadyHas = 0;

    // Assign to eligible members who don't have it
    for (const discordId of eligibleDiscordIds) {
      const member = guild.members.cache.get(discordId);
      if (!member) continue; // Not in guild
      if (member.roles.cache.has(SETTLER_ROLE_ID)) {
        alreadyHas++;
        continue;
      }
      try {
        await member.roles.add(SETTLER_ROLE_ID, 'Auto-assign: linked Kingshot + Discord on ks-atlas.com');
        assigned++;
        console.log(`   🎖️ +Settler: ${member.user.username}`);
      } catch (err) {
        console.error(`   ❌ Failed to assign Settler to ${member.user.username}: ${err.message}`);
      }
    }

    // Remove from members who have the role but are no longer eligible
    // SAFETY: If API returned 0 users, skip removal — likely API error, not real data
    const settlerMembers = guild.members.cache.filter(m => m.roles.cache.has(SETTLER_ROLE_ID));
    if (eligibleDiscordIds.size === 0 && settlerMembers.size > 0) {
      console.warn(`🎖️ SAFETY: API returned 0 eligible users but ${settlerMembers.size} members have Settler role — skipping removal`);
    } else for (const [memberId, member] of settlerMembers) {
      if (!eligibleDiscordIds.has(memberId) && !member.user.bot) {
        try {
          await member.roles.remove(SETTLER_ROLE_ID, 'Auto-remove: Kingshot account unlinked on ks-atlas.com');
          removed++;
          console.log(`   🎖️ -Settler: ${member.user.username}`);
        } catch (err) {
          console.error(`   ❌ Failed to remove Settler from ${member.user.username}: ${err.message}`);
        }
      }
    }

    const elapsed = Date.now() - startTime;
    lastSettlerSync = new Date().toISOString();
    console.log(`🎖️ Settler sync done in ${elapsed}ms: +${assigned} -${removed} =${alreadyHas} already`);
  } catch (err) {
    console.error('🎖️ Settler sync error:', err.message);
  }
}

/**
 * Periodic sync: fetch all linked users from API, assign/remove Consul and
 * Ambassador Discord roles based on their referral_tier.
 * Runs on the same interval as Settler sync.
 */
async function syncReferralRoles(prefetchedUsers = null) {
  if (!botReady || !client.guilds.cache.size) {
    console.log('🏛️ Referral sync skipped (bot not ready)');
    return;
  }

  console.log('🏛️ Referral role sync starting...');
  const startTime = Date.now();

  try {
    // Use pre-fetched data from unified sync, or fetch independently as fallback
    let users;
    if (prefetchedUsers) {
      users = prefetchedUsers;
    } else {
      const res = await atlasFetch('/api/v1/bot/linked-users');
      if (!res.ok) {
        console.error(`🏛️ Referral sync: API returned ${res.status}`);
        return;
      }
      const data = await res.json();
      users = data.users || [];
    }

    // Build maps of who should have which referral roles
    const consulEligible = new Set();
    const ambassadorEligible = new Set();
    for (const u of users) {
      if (!u.discord_id) continue;
      if (u.referral_tier === 'ambassador') {
        ambassadorEligible.add(u.discord_id);
        consulEligible.add(u.discord_id); // Ambassadors also get Consul
      } else if (u.referral_tier === 'consul') {
        consulEligible.add(u.discord_id);
      }
    }

    console.log(`🏛️ Eligible: ${consulEligible.size} Consul, ${ambassadorEligible.size} Ambassador`);

    const guild = client.guilds.cache.get(config.guildId);
    if (!guild) {
      console.error('🏛️ Referral sync: guild not found');
      return;
    }

    // Members cached to prevent opcode 8 rate limiting
    await fetchGuildMembersCached(guild);

    let changes = 0;

    // --- Consul role ---
    for (const discordId of consulEligible) {
      const member = guild.members.cache.get(discordId);
      if (!member) continue;
      if (!member.roles.cache.has(CONSUL_ROLE_ID)) {
        try {
          await member.roles.add(CONSUL_ROLE_ID, 'Auto-assign: 10+ verified referrals on ks-atlas.com');
          changes++;
          console.log(`   🏛️ +Consul: ${member.user.username}`);
        } catch (err) {
          console.error(`   ❌ Failed +Consul ${member.user.username}: ${err.message}`);
        }
      }
    }
    // Remove Consul from those who lost eligibility
    // SAFETY: If API returned 0 eligible, skip removal to prevent mass stripping
    const consulMembers = guild.members.cache.filter(m => m.roles.cache.has(CONSUL_ROLE_ID));
    if (users.length === 0 && consulMembers.size > 0) {
      console.warn(`🏛️ SAFETY: API returned 0 users but ${consulMembers.size} have Consul — skipping removal`);
    } else for (const [memberId, member] of consulMembers) {
      if (!consulEligible.has(memberId) && !member.user.bot) {
        try {
          await member.roles.remove(CONSUL_ROLE_ID, 'Auto-remove: referral tier changed on ks-atlas.com');
          changes++;
          console.log(`   🏛️ -Consul: ${member.user.username}`);
        } catch (err) {
          console.error(`   ❌ Failed -Consul ${member.user.username}: ${err.message}`);
        }
      }
    }

    // --- Ambassador role ---
    for (const discordId of ambassadorEligible) {
      const member = guild.members.cache.get(discordId);
      if (!member) continue;
      if (!member.roles.cache.has(AMBASSADOR_ROLE_ID)) {
        try {
          await member.roles.add(AMBASSADOR_ROLE_ID, 'Auto-assign: 20+ verified referrals on ks-atlas.com');
          changes++;
          console.log(`   🏛️ +Ambassador: ${member.user.username}`);
          // Auto-spotlight for new ambassadors
          sendSpotlightMessage('ambassador', member.user.id, member.displayName || member.user.username).catch(() => {});
        } catch (err) {
          console.error(`   ❌ Failed +Ambassador ${member.user.username}: ${err.message}`);
        }
      }
    }
    // Remove Ambassador from those who lost eligibility
    const ambMembers = guild.members.cache.filter(m => m.roles.cache.has(AMBASSADOR_ROLE_ID));
    if (users.length === 0 && ambMembers.size > 0) {
      console.warn(`🏛️ SAFETY: API returned 0 users but ${ambMembers.size} have Ambassador — skipping removal`);
    } else for (const [memberId, member] of ambMembers) {
      if (!ambassadorEligible.has(memberId) && !member.user.bot) {
        try {
          await member.roles.remove(AMBASSADOR_ROLE_ID, 'Auto-remove: referral tier changed on ks-atlas.com');
          changes++;
          console.log(`   🏛️ -Ambassador: ${member.user.username}`);
        } catch (err) {
          console.error(`   ❌ Failed -Ambassador ${member.user.username}: ${err.message}`);
        }
      }
    }

    const elapsed = Date.now() - startTime;
    lastReferralSync = new Date().toISOString();
    console.log(`🏛️ Referral sync done in ${elapsed}ms: ${changes} role changes`);
  } catch (err) {
    console.error('🏛️ Referral sync error:', err.message);
  }
}

/**
 * Periodic sync: fetch all supporter subscribers from API, assign Supporter
 * Discord role to eligible guild members, remove from those who lost eligibility.
 * Runs on the same interval as Settler sync.
 */
async function syncSupporterRoles() {
  if (!botReady || !client.guilds.cache.size) {
    console.log('💎 Supporter sync skipped (bot not ready)');
    return;
  }
  if (!SUPPORTER_ROLE_ID) {
    console.log('💎 Supporter sync skipped (DISCORD_SUPPORTER_ROLE_ID not set)');
    return;
  }

  console.log('💎 Supporter role sync starting...');
  const startTime = Date.now();

  try {
    const res = await atlasFetch('/api/v1/bot/supporter-users');
    if (!res.ok) {
      console.error(`💎 Supporter sync: API returned ${res.status}`);
      return;
    }
    const data = await res.json();
    const supporterUsers = data.users || [];
    const supporterDiscordIds = new Set(supporterUsers.map(u => u.discord_id).filter(Boolean));

    console.log(`💎 ${supporterDiscordIds.size} supporter users from API`);

    const guild = client.guilds.cache.get(config.guildId);
    if (!guild) {
      console.error('💎 Supporter sync: guild not found in cache');
      return;
    }

    await fetchGuildMembersCached(guild);

    let assigned = 0;
    let removed = 0;
    let alreadyHas = 0;

    // Assign to eligible members who don't have it
    for (const discordId of supporterDiscordIds) {
      const member = guild.members.cache.get(discordId);
      if (!member) continue;
      if (member.roles.cache.has(SUPPORTER_ROLE_ID)) {
        alreadyHas++;
        continue;
      }
      try {
        await member.roles.add(SUPPORTER_ROLE_ID, 'Auto-assign: Atlas Supporter subscriber on ks-atlas.com');
        assigned++;
        console.log(`   💎 +Supporter: ${member.user.username}`);
        // Spotlight is sent by the API Stripe webhook handler (bot.py) — no duplicate here
      } catch (err) {
        console.error(`   ❌ Failed to assign Supporter to ${member.user.username}: ${err.message}`);
      }
    }

    // Remove from members who have the role but are no longer supporters
    const supporterMembers = guild.members.cache.filter(m => m.roles.cache.has(SUPPORTER_ROLE_ID));
    for (const [memberId, member] of supporterMembers) {
      if (!supporterDiscordIds.has(memberId) && !member.user.bot) {
        try {
          await member.roles.remove(SUPPORTER_ROLE_ID, 'Auto-remove: subscription ended on ks-atlas.com');
          removed++;
          console.log(`   💎 -Supporter: ${member.user.username}`);
        } catch (err) {
          console.error(`   ❌ Failed to remove Supporter from ${member.user.username}: ${err.message}`);
        }
      }
    }

    const elapsed = Date.now() - startTime;
    lastSupporterSync = new Date().toISOString();
    console.log(`💎 Supporter sync done in ${elapsed}ms: +${assigned} -${removed} =${alreadyHas} already`);
  } catch (err) {
    console.error('💎 Supporter sync error:', err.message);
  }
}

/**
 * Gilded Role Sync — assigns the Gilded Discord role to users from Gold-tier Kingdom Fund kingdoms.
 * Fetches gold kingdoms from the API, then checks which Discord-linked users belong to those kingdoms.
 * Runs on the same interval as Settler sync.
 */
async function syncGildedRoles() {
  if (!botReady || !client.guilds.cache.size) {
    console.log('✨ Gilded sync skipped (bot not ready)');
    return;
  }
  if (!GILDED_ROLE_ID) {
    console.log('✨ Gilded sync skipped (DISCORD_GILDED_ROLE_ID not set)');
    return;
  }

  console.log('✨ Gilded role sync starting...');
  const startTime = Date.now();

  try {
    const res = await atlasFetch('/api/v1/bot/gilded-users');
    if (!res.ok) {
      console.error(`✨ Gilded sync: API returned ${res.status}`);
      return;
    }
    const data = await res.json();
    const gildedUsers = data.users || [];
    const gildedDiscordIds = new Set(gildedUsers.map(u => u.discord_id).filter(Boolean));

    console.log(`✨ ${gildedDiscordIds.size} gilded users from API`);

    const guild = client.guilds.cache.get(config.guildId);
    if (!guild) {
      console.error('✨ Gilded sync: guild not found in cache');
      return;
    }

    await fetchGuildMembersCached(guild);

    let assigned = 0;
    let removed = 0;
    let alreadyHas = 0;

    // Assign to eligible members who don't have it
    for (const discordId of gildedDiscordIds) {
      const member = guild.members.cache.get(discordId);
      if (!member) continue;
      if (member.roles.cache.has(GILDED_ROLE_ID)) {
        alreadyHas++;
        continue;
      }
      try {
        await member.roles.add(GILDED_ROLE_ID, 'Auto-assign: Gold-tier Kingdom Fund member on ks-atlas.com');
        assigned++;
        console.log(`   ✨ +Gilded: ${member.user.username}`);
      } catch (err) {
        console.error(`   ❌ Failed to assign Gilded to ${member.user.username}: ${err.message}`);
      }
    }

    // Remove from members who have the role but are no longer eligible
    const gildedMembers = guild.members.cache.filter(m => m.roles.cache.has(GILDED_ROLE_ID));
    for (const [memberId, member] of gildedMembers) {
      if (!gildedDiscordIds.has(memberId) && !member.user.bot) {
        try {
          await member.roles.remove(GILDED_ROLE_ID, 'Auto-remove: kingdom no longer Gold-tier on ks-atlas.com');
          removed++;
          console.log(`   ✨ -Gilded: ${member.user.username}`);
        } catch (err) {
          console.error(`   ❌ Failed to remove Gilded from ${member.user.username}: ${err.message}`);
        }
      }
    }

    const elapsed = Date.now() - startTime;
    lastGildedSync = new Date().toISOString();
    console.log(`✨ Gilded sync done in ${elapsed}ms: +${assigned} -${removed} =${alreadyHas} already`);
  } catch (err) {
    console.error('✨ Gilded sync error:', err.message);
  }
}

// ============================================================================
// TRANSFER GROUP ROLE AUTO-ASSIGNMENT
// Fetches transfer groups from API (Supabase source of truth), creates Discord
// roles if they don't exist, then assigns/removes roles based on each user's
// linked kingdom. Users with multiple kingdoms get all applicable group roles.
// ============================================================================

/**
 * Get or create a Discord role for a transfer group.
 * Caches role ID in transferGroupRoleCache to avoid repeated API calls.
 * @param {import('discord.js').Guild} guild
 * @param {number} min - min kingdom number
 * @param {number} max - max kingdom number
 * @param {string} label - human-readable label e.g. "K7–K115"
 * @returns {Promise<string|null>} role ID or null on failure
 */
async function getOrCreateTransferGroupRole(guild, min, max, label) {
  const key = `${min}-${max}`;
  if (transferGroupRoleCache.has(key)) {
    return transferGroupRoleCache.get(key);
  }

  // Format: "Transfer K1-K6" (plain hyphen, no colon)
  const roleName = `Transfer ${label.replace(/\u2013/g, '-')}`;

  // Search existing roles first
  const existing = guild.roles.cache.find(r => r.name === roleName);
  if (existing) {
    transferGroupRoleCache.set(key, existing.id);
    console.log(`   🔀 Found existing role: "${roleName}" (${existing.id})`);
    return existing.id;
  }

  // Create the role
  try {
    const newRole = await guild.roles.create({
      name: roleName,
      color: 0xa855f7, // purple — matches Transfer Hub brand color
      reason: 'Auto-created: Transfer Group role for Atlas Transfer Hub',
      mentionable: false,
      hoist: false,
    });
    transferGroupRoleCache.set(key, newRole.id);
    console.log(`   🔀 Created role: "${roleName}" (${newRole.id})`);
    return newRole.id;
  } catch (err) {
    console.error(`   ❌ Failed to create role "${roleName}": ${err.message}`);
    return null;
  }
}

/**
 * Find which transfer group a kingdom belongs to.
 * @param {number} kingdom
 * @param {Array<{min_kingdom: number, max_kingdom: number, label: string}>} groups
 * @returns {{min_kingdom: number, max_kingdom: number, label: string}|null}
 */
function findTransferGroup(kingdom, groups) {
  return groups.find(g => kingdom >= g.min_kingdom && kingdom <= g.max_kingdom) || null;
}

/**
 * Periodic sync: fetch transfer groups + linked users from API, create Discord
 * roles if needed, assign/remove roles based on each user's linked kingdom(s).
 */
async function syncTransferGroupRoles(prefetchedUsers = null) {
  if (!botReady || !client.guilds.cache.size) {
    console.log('🔀 Transfer Group sync skipped (bot not ready)');
    return;
  }

  console.log('🔀 Transfer Group role sync starting...');
  const startTime = Date.now();

  try {
    // Fetch transfer groups from API (Supabase source of truth)
    const groupsRes = await atlasFetch('/api/v1/bot/transfer-groups');
    if (!groupsRes.ok) {
      console.error(`🔀 Transfer Group sync: groups API returned ${groupsRes.status}`);
      lastTransferGroupSyncResult = { error: `groups API ${groupsRes.status}` };
      return;
    }
    const groupsData = await groupsRes.json();
    const groups = groupsData.groups || [];

    if (groups.length === 0) {
      console.log('🔀 Transfer Group sync: no active groups found, skipping');
      lastTransferGroupSyncResult = { error: 'no active groups' };
      return;
    }

    console.log(`🔀 ${groups.length} active transfer groups from API`);

    // Use pre-fetched data from unified sync, or fetch independently as fallback
    let users;
    if (prefetchedUsers) {
      users = prefetchedUsers;
    } else {
      const usersRes = await atlasFetch('/api/v1/bot/linked-users');
      if (!usersRes.ok) {
        console.error(`🔀 Transfer Group sync: users API returned ${usersRes.status}`);
        lastTransferGroupSyncResult = { error: `users API ${usersRes.status}` };
        return;
      }
      const usersData = await usersRes.json();
      users = usersData.users || [];
    }

    const guild = client.guilds.cache.get(config.guildId);
    if (!guild) {
      console.error('🔀 Transfer Group sync: guild not found in cache');
      lastTransferGroupSyncResult = { error: 'guild not in cache' };
      return;
    }

    // Fetch all members (cached to prevent opcode 8 rate limiting)
    await fetchGuildMembersCached(guild);

    // Build map: discordId -> Set of role IDs they should have
    const expectedRoles = new Map(); // discordId -> Set<roleId>
    let usersWithKingdoms = 0;

    for (const user of users) {
      if (!user.discord_id) continue;
      const kingdoms = user.all_kingdoms || (user.linked_kingdom ? [user.linked_kingdom] : []);
      if (kingdoms.length === 0) continue;
      usersWithKingdoms++;

      const roleIds = new Set();
      for (const kingdom of kingdoms) {
        const group = findTransferGroup(kingdom, groups);
        if (!group) continue;
        const roleId = await getOrCreateTransferGroupRole(guild, group.min_kingdom, group.max_kingdom, group.label);
        if (roleId) roleIds.add(roleId);
      }

      if (roleIds.size > 0) {
        expectedRoles.set(user.discord_id, roleIds);
      }
    }

    // Count how many eligible users are actually in the Discord server
    let notInGuild = 0;
    for (const [discordId] of expectedRoles) {
      if (!guild.members.cache.get(discordId)) notInGuild++;
    }
    const inGuild = expectedRoles.size - notInGuild;
    console.log(`🔀 ${users.length} linked users, ${usersWithKingdoms} with kingdoms, ${expectedRoles.size} matched to groups (${inGuild} in guild, ${notInGuild} not in server)`);

    // Collect all transfer group role IDs we manage
    const allManagedRoleIds = new Set(transferGroupRoleCache.values());

    let assigned = 0;
    let removed = 0;
    let alreadyHas = 0;
    let errors = 0;

    // Assign roles to eligible members
    for (const [discordId, roleIds] of expectedRoles) {
      const member = guild.members.cache.get(discordId);
      if (!member) continue;

      for (const roleId of roleIds) {
        if (member.roles.cache.has(roleId)) {
          alreadyHas++;
        } else {
          try {
            await member.roles.add(roleId, 'Auto-assign: Transfer Group role based on linked kingdom on ks-atlas.com');
            assigned++;
            const roleName = guild.roles.cache.get(roleId)?.name || roleId;
            console.log(`   🔀 +${roleName}: ${member.user.username}`);
          } catch (err) {
            errors++;
            console.error(`   ❌ Failed to assign transfer group role to ${member.user.username}: ${err.message}`);
          }
        }
      }

      // Remove any managed transfer group roles they shouldn't have
      for (const roleId of allManagedRoleIds) {
        if (!roleIds.has(roleId) && member.roles.cache.has(roleId)) {
          try {
            await member.roles.remove(roleId, 'Auto-remove: kingdom changed transfer group on ks-atlas.com');
            removed++;
            const roleName = guild.roles.cache.get(roleId)?.name || roleId;
            console.log(`   🔀 -${roleName}: ${member.user.username}`);
          } catch (err) {
            console.error(`   ❌ Failed to remove transfer group role from ${member.user.username}: ${err.message}`);
          }
        }
      }
    }

    // Safety guard: skip unlinked-user removal if we got 0 eligible but roles exist
    // (protects against mass role removal from a bad API response)
    if (expectedRoles.size === 0 && allManagedRoleIds.size > 0) {
      console.warn('🔀 ⚠️ Safety guard: 0 eligible users but managed roles exist — skipping unlinked removal to prevent mass role strip');
    } else {
      // Remove managed roles from members who are no longer eligible (unlinked)
      for (const roleId of allManagedRoleIds) {
        const roleMembers = guild.members.cache.filter(m => m.roles.cache.has(roleId));
        for (const [memberId, member] of roleMembers) {
          if (!expectedRoles.has(memberId) && !member.user.bot) {
            try {
              await member.roles.remove(roleId, 'Auto-remove: Kingshot account unlinked on ks-atlas.com');
              removed++;
              const roleName = guild.roles.cache.get(roleId)?.name || roleId;
              console.log(`   🔀 -${roleName} (unlinked): ${member.user.username}`);
            } catch (err) {
              console.error(`   ❌ Failed to remove transfer group role from ${member.user.username}: ${err.message}`);
            }
          }
        }
      }
    }

    const elapsed = Date.now() - startTime;
    lastTransferGroupSync = new Date().toISOString();
    lastTransferGroupSyncResult = { assigned, removed, alreadyHas, errors, eligible: expectedRoles.size, inGuild, notInGuild, groups: groups.length, users: users.length };
    console.log(`🔀 Transfer Group sync done in ${elapsed}ms: +${assigned} -${removed} =${alreadyHas} already, ${errors} errors, ${notInGuild} not in server`);
  } catch (err) {
    console.error('🔀 Transfer Group sync error:', err.message);
    lastTransferGroupSyncResult = { error: err.message };
  }
}

/**
 * Check a single guild member for Transfer Group role eligibility via API.
 * Called on guildMemberAdd for instant role assignment without waiting for the next sync.
 */
async function checkAndAssignTransferGroupRole(member) {
  try {
    const { lookupUserByDiscordId } = require('./utils/api');
    const user = await lookupUserByDiscordId(member.user.id);
    if (!user || !user.linked_kingdom) return; // Not linked or no kingdom

    // Fetch transfer groups
    const groupsRes = await atlasFetch('/api/v1/bot/transfer-groups');
    if (!groupsRes.ok) return;
    const groupsData = await groupsRes.json();
    const groups = groupsData.groups || [];

    // Use all_kingdoms (includes alts) like syncTransferGroupRoles does
    const kingdoms = user.all_kingdoms || (user.linked_kingdom ? [user.linked_kingdom] : []);
    if (kingdoms.length === 0) return;

    const guild = member.guild;
    for (const kingdom of kingdoms) {
      const group = findTransferGroup(kingdom, groups);
      if (!group) continue;

      const roleId = await getOrCreateTransferGroupRole(guild, group.min_kingdom, group.max_kingdom, group.label);
      if (!roleId) continue;

      if (!member.roles.cache.has(roleId)) {
        await member.roles.add(roleId, 'Auto-assign: Transfer Group role on join (linked kingdom)');
        const roleName = guild.roles.cache.get(roleId)?.name || roleId;
        console.log(`   🔀 +${roleName} (on join): ${member.user.username}`);
      }
    }
  } catch (err) {
    console.error(`🔀 checkAndAssignTransferGroupRole error for ${member.user.username}: ${err.message}`);
  }
}

// ============================================================================
// DISCORD SERVER BOOSTER STATUS SYNC
// Checks if linked members have the Booster role (ID: 1471857928695844884)
// and updates profiles.is_discord_booster in Supabase via REST API.
// Runs as part of the unified role sync cycle.
// ============================================================================
const BOOSTER_ROLE_ID = '1471857928695844884';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
let lastBoosterSync = null;

/**
 * Update profiles.is_discord_booster for linked Discord members.
 * Uses Supabase REST API with service_role key (same pattern as telemetry.js).
 */
async function syncBoosterStatus() {
  if (!botReady || !client.guilds.cache.size) {
    console.log('💜 Booster sync skipped (bot not ready)');
    return;
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.log('💜 Booster sync skipped (SUPABASE_URL or SUPABASE_SERVICE_KEY not set)');
    return;
  }

  console.log('💜 Booster status sync starting...');
  const startTime = Date.now();

  try {
    // Fetch linked users from API
    const res = await atlasFetch('/api/v1/bot/linked-users');
    if (!res.ok) {
      console.error(`💜 Booster sync: API returned ${res.status}`);
      return;
    }
    const data = await res.json();
    const users = data.users || [];

    // Build map: discord_id -> atlas profile info
    const linkedMap = new Map();
    for (const u of users) {
      if (u.discord_id) linkedMap.set(u.discord_id, u);
    }

    const guild = client.guilds.cache.get(config.guildId);
    if (!guild) {
      console.error('💜 Booster sync: guild not found in cache');
      return;
    }

    await fetchGuildMembersCached(guild);

    // Determine booster discord_ids
    const boosterDiscordIds = new Set();
    const nonBoosterDiscordIds = new Set();

    for (const [discordId] of linkedMap) {
      const member = guild.members.cache.get(discordId);
      if (!member) continue;
      if (member.roles.cache.has(BOOSTER_ROLE_ID)) {
        boosterDiscordIds.add(discordId);
      } else {
        nonBoosterDiscordIds.add(discordId);
      }
    }

    console.log(`💜 ${boosterDiscordIds.size} boosters, ${nonBoosterDiscordIds.size} non-boosters (among linked members in guild)`);

    let updated = 0;

    // Set is_discord_booster = true for boosters
    if (boosterDiscordIds.size > 0) {
      const boosterArr = [...boosterDiscordIds];
      const setTrueRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?discord_id=in.(${boosterArr.map(id => `"${id}"`).join(',')})`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ is_discord_booster: true }),
      });
      if (setTrueRes.ok) {
        updated += boosterDiscordIds.size;
      } else {
        console.error(`💜 Booster sync: failed to set true: ${setTrueRes.status}`);
      }
    }

    // Set is_discord_booster = false for non-boosters (only those currently marked true)
    if (nonBoosterDiscordIds.size > 0) {
      const nonBoosterArr = [...nonBoosterDiscordIds];
      // Only update those that are currently true to avoid unnecessary writes
      const setFalseRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?discord_id=in.(${nonBoosterArr.map(id => `"${id}"`).join(',')})&is_discord_booster=eq.true`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ is_discord_booster: false }),
      });
      if (!setFalseRes.ok) {
        console.error(`💜 Booster sync: failed to set false: ${setFalseRes.status}`);
      }
    }

    const elapsed = Date.now() - startTime;
    lastBoosterSync = new Date().toISOString();
    console.log(`💜 Booster sync done in ${elapsed}ms: ${boosterDiscordIds.size} boosters, ${updated} updated`);
  } catch (err) {
    console.error('💜 Booster sync error:', err.message);
  }
}

// Pre-login token validation using raw fetch (bypasses discord.js REST module)
async function validateToken(token) {
  console.log('🔍 Validating token with Discord API (raw fetch)...');
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000); // 10s timeout
    
    const response = await discordFetch('/api/v10/users/@me', {
      headers: { 'Authorization': `Bot ${token}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    
    const status = response.status;
    console.log(`   Discord API responded: ${status} ${response.statusText}`);
    
    if (status === 200) {
      const data = await response.json();
      console.log(`   ✅ Token valid! Bot: ${data.username}#${data.discriminator} (ID: ${data.id})`);
      
      // Also check /gateway/bot - this is what discord.js calls during login
      console.log('🔍 Checking gateway/bot endpoint...');
      try {
        const gwController = new AbortController();
        const gwTimeout = setTimeout(() => gwController.abort(), 10_000);
        const gwResponse = await discordFetch('/api/v10/gateway/bot', {
          headers: { 'Authorization': `Bot ${token}` },
          signal: gwController.signal,
        });
        clearTimeout(gwTimeout);
        const gwStatus = gwResponse.status;
        if (gwStatus === 200) {
          const gwData = await gwResponse.json();
          console.log(`   ✅ Gateway accessible: ${gwData.url}, shards: ${gwData.shards}`);
          console.log(`   Session limits: total=${gwData.session_start_limit?.total}, remaining=${gwData.session_start_limit?.remaining}, reset_after=${gwData.session_start_limit?.reset_after}ms`);
          return { valid: true, status, botName: data.username, botId: data.id, gateway: gwData.url, sessionsRemaining: gwData.session_start_limit?.remaining };
        } else if (gwStatus === 429) {
          const retryAfter = gwResponse.headers.get('retry-after');
          console.warn(`   ⚠️ Gateway rate limited (429). Retry after: ${retryAfter}s`);
          return { valid: true, status, botName: data.username, botId: data.id, gatewayError: `RATE_LIMITED_429_retry_${retryAfter}s` };
        } else {
          console.warn(`   ⚠️ Gateway returned ${gwStatus}`);
          return { valid: true, status, botName: data.username, botId: data.id, gatewayError: `HTTP_${gwStatus}` };
        }
      } catch (gwErr) {
        console.error(`   ⚠️ Gateway check failed: ${gwErr.message}`);
        return { valid: true, status, botName: data.username, botId: data.id, gatewayError: gwErr.message };
      }
    } else if (status === 401) {
      console.error('   ❌ Token is INVALID (401 Unauthorized)');
      return { valid: false, status, error: 'TOKEN_INVALID_401' };
    } else if (status === 429) {
      const retryAfter = response.headers.get('retry-after');
      console.warn(`   ⚠️ Rate limited (429). Retry after: ${retryAfter}s`);
      return { valid: null, status, error: `RATE_LIMITED_429_retry_${retryAfter}s` };
    } else {
      return { valid: null, status, error: `UNEXPECTED_${status}` };
    }
  } catch (err) {
    console.error(`   ❌ Token validation failed: ${err.message}`);
    return { valid: null, status: 0, error: err.message };
  }
}

// Start bot - login directly (skip validateToken to minimize API calls)
async function main() {
  console.log('🔐 Starting Discord login sequence...');
  console.log(`   Token: ${config.token ? `present (${config.token.length} chars)` : 'MISSING'}`);
  
  // Optional startup delay to break Cloudflare rate-limit cycles.
  // When Render restarts repeatedly, each restart hammers Discord's API,
  // triggering Cloudflare Error 1015 (IP ban). A delay lets the ban expire.
  // Set STARTUP_DELAY_SECONDS=300 on Render to wait 5 min before first login.
  const startupDelay = parseInt(process.env.STARTUP_DELAY_SECONDS || '0', 10) * 1000;
  if (startupDelay > 0) {
    console.log(`⏳ Startup delay: ${startupDelay / 1000}s (STARTUP_DELAY_SECONDS=${process.env.STARTUP_DELAY_SECONDS})`);
    console.log('   This prevents Cloudflare bans from rapid restart cycles');
    await new Promise(r => setTimeout(r, startupDelay));
    console.log('✅ Startup delay complete, proceeding with login');
  }
  
  // Go straight to login — validateToken made 2 extra API calls that contributed
  // to rate limiting. client.login() only calls GET /gateway/bot internally.
  // Token validation is still used in retries to check rate-limit status.
  loginAttemptCount = 1;
  
  // Login to Discord with timeout protection
  const LOGIN_TIMEOUT = 60_000; // 60 seconds (generous — gateway can be slow under load)
  
  try {
    const loginPromise = client.login(config.token);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('LOGIN_TIMEOUT: client.login() hung for 60s. Gateway may be rate-limited.')), LOGIN_TIMEOUT)
    );
    
    await Promise.race([loginPromise, timeoutPromise]);
    console.log('✅ Discord login call completed (WebSocket connection is async)');
    loginLastResult = 'login_resolved';
    reconnectAttempts = 0;
  } catch (loginError) {
    loginLastResult = `failed: ${loginError.code || loginError.message}`;
    lastError = `Login: ${loginError.message} (code: ${loginError.code || 'none'})`;
    console.error('❌ Discord login failed:', loginError.message);
    telemetry.logLoginFailed(loginError);
    
    if (loginError.code === 'TOKEN_INVALID' || loginError.message.includes('invalid token')) {
      console.error('   🔧 TOKEN INVALID: Reset in Discord Developer Portal > Bot > Reset Token');
    } else if (loginError.code === 'DISALLOWED_INTENTS') {
      console.error('   🔧 DISALLOWED INTENTS: Enable Server Members Intent in Discord Developer Portal');
    } else if (loginError.message.includes('LOGIN_TIMEOUT')) {
      console.error('   🔧 LOGIN TIMED OUT: Gateway rate-limited. Will retry on next Render restart.');
    }
    
    console.error('   Bot remains running for diagnostics. Check /health for details.');
    
    // Schedule internal retry with long backoff to break the rate-limit cycle
    // Discord gateway rate limits last ~5-15 minutes for frequent connectors
    scheduleLoginRetry();
  }
}

// Internal login retry — just try client.login() directly each time.
// DO NOT call validateToken() here — it wastes rate-limit budget
// (2 REST API calls per check) and preemptively blocks login attempts
// based on REST rate limits, while the WebSocket gateway may be available.
let loginRetryCount = 0;
const MAX_LOGIN_RETRIES = 6;
let loginRetryTimer = null;

function scheduleLoginRetry() {
  if (loginRetryCount >= MAX_LOGIN_RETRIES) {
    console.error(`❌ Max login retries (${MAX_LOGIN_RETRIES}) exhausted. Waiting for Render restart.`);
    lastError = `All ${MAX_LOGIN_RETRIES} login retries exhausted. Render will restart the service.`;
    return;
  }
  
  loginRetryCount++;
  // Linear backoff: 5min, 10min, 15min, 20min, 25min, 30min (cap at 30min)
  // Long delays let Cloudflare IP bans expire (typically 15-30 min)
  // Total coverage: 5+10+15+20+25+30 = 105 min (~1.75 hours)
  const delay = Math.min(loginRetryCount * 5 * 60_000, 30 * 60_000);
  const delayMin = Math.round(delay / 60_000);
  console.log(`🔄 Login retry ${loginRetryCount}/${MAX_LOGIN_RETRIES} scheduled in ${delayMin} minutes`);
  telemetry.logLoginRetry(loginRetryCount, MAX_LOGIN_RETRIES, delay);
  lastError = `Waiting ${delayMin}min before login retry ${loginRetryCount}/${MAX_LOGIN_RETRIES}`;
  
  if (loginRetryTimer) clearTimeout(loginRetryTimer);
  loginRetryTimer = setTimeout(async () => {
    console.log(`🔐 Login retry ${loginRetryCount}/${MAX_LOGIN_RETRIES} starting...`);
    loginAttemptCount = loginRetryCount + 1;
    
    // Guard: if a background login already succeeded, don't retry
    if (client?.ws?.status === 0) {
      console.log('   ✅ Client already connected (background login succeeded), skipping retry');
      loginRetryCount = 0;
      return;
    }
    
    try {
      // CRITICAL: Destroy old client state before retrying to prevent
      // overlapping WebSocket connections that corrupt event routing
      console.log('   Destroying old connection before retry...');
      client.destroy();
      
      const loginPromise = client.login(config.token);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('LOGIN_TIMEOUT')), 60_000)
      );
      
      await Promise.race([loginPromise, timeoutPromise]);
      console.log('✅ Login retry succeeded!');
      loginLastResult = 'login_resolved_on_retry';
      lastError = null;
      loginRetryCount = 0;
    } catch (err) {
      console.error(`❌ Login retry ${loginRetryCount} failed: ${err.message}`);
      loginLastResult = `retry_${loginRetryCount}_failed: ${err.message}`;
      scheduleLoginRetry(); // Try again with longer delay
    }
  }, delay);
}

// Handle graceful shutdown
function gracefulShutdown(signal) {
  console.log(`\n👋 Shutting down Atlas (${signal})...`);
  botReady = false;
  telemetry.stopMemoryMonitoring();
  
  // Log shutdown to persistent telemetry (best-effort, may not complete)
  telemetry.logShutdown(signal, client);
  
  if (selfPingTimer) {
    clearInterval(selfPingTimer);
  }
  
  healthServer.close(() => {
    console.log('🏥 Health server closed');
  });
  
  client.destroy();
  
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught errors to prevent silent crashes
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  telemetry.logCrash(error, 'uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  const err = reason instanceof Error ? reason : new Error(String(reason));
  telemetry.logCrash(err, 'unhandledRejection');
});

// Start the bot (don't exit on failure - keep health server for diagnostics)
main().catch((error) => {
  console.error('❌ Failed to start bot:', error);
  lastError = `main() crash: ${error.message}`;
  loginLastResult = `crash: ${error.message}`;
  telemetry.logCrash(error, 'main_catch');
  // Don't process.exit() - keep health server alive so we can diagnose remotely
  console.error('   Health server still running at /health for diagnostics');
});
