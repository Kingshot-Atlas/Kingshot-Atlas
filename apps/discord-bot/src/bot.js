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
 * /leaderboard       - Show top 10 kingdoms by Atlas Score
 * /tier <S|A|B|C|D>  - List kingdoms by tier
 * /top <prep|battle> - Top 10 by phase win rate
 * /upcoming          - Show next KvK and Transfer dates
 * /countdown         - Time until next KvK
 * /random            - Discover a random kingdom
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
const { Client, GatewayIntentBits, REST, Routes, ActivityType } = require('discord.js');
const config = require('./config');
const commands = require('./commands');
const handlers = require('./commands/handlers');
const logger = require('./utils/logger');
const scheduler = require('./scheduler');

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
        tokenLength: config.token ? config.token.length : 0,
        tokenSource: process.env.DISCORD_TOKEN ? 'DISCORD_TOKEN' : process.env.DISCORD_BOT_TOKEN ? 'DISCORD_BOT_TOKEN' : 'NONE',
        configClientId: config.clientId || 'NOT_SET',
        configGuildId: config.guildId || 'NOT_SET',
        actualBotId: client?.user?.id || 'NOT_CONNECTED',
        actualBotTag: client?.user?.tag || 'NOT_CONNECTED',
        appIdMatch: client?.user?.id ? (client.user.id === config.clientId ? 'YES' : `MISMATCH: bot=${client.user.id} config=${config.clientId}`) : 'NOT_CONNECTED',
        tokenBotId: (() => { try { const p = config.token?.split('.')[0]; return p ? Buffer.from(p, 'base64').toString() : 'NO_TOKEN'; } catch { return 'DECODE_ERROR'; } })(),
        tokenMatchesClientId: (() => { try { const p = config.token?.split('.')[0]; const id = p ? Buffer.from(p, 'base64').toString() : ''; return id === config.clientId ? 'YES' : `MISMATCH: token_bot_id=${id} config=${config.clientId}`; } catch { return 'DECODE_ERROR'; } })(),
        tokenValidation: tokenValidationResult,
        interactionsReceived: interactionCount,
        lastInteractionAt: lastInteractionTime,
        readyFired: typeof readyFiredCount !== 'undefined' ? readyFiredCount : 0,
        commandsRegistered: commandRegistrationResult,
        lastCommandError: lastCommandError,
        lastCommandDebug: lastCommandDebug,
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
  } else if (req.url === '/diagnostic') {
    // Deep diagnostic endpoint - fetches registered commands from Discord API
    const diag = { timestamp: new Date().toISOString() };
    try {
      if (config.token && config.clientId) {
        const headers = { Authorization: `Bot ${config.token}` };
        // Check global commands
        const globalRes = await fetch(`https://discord.com/api/v10/applications/${config.clientId}/commands`, { headers });
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
          const guildRes = await fetch(`https://discord.com/api/v10/applications/${config.clientId}/guilds/${config.guildId}/commands`, { headers });
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
        const meRes = await fetch('https://discord.com/api/v10/users/@me', { headers });
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
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(diag, null, 2));
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

// Initialize Discord client
// GuildMembers intent is REQUIRED for: role assignment, welcome messages, member events
// IMPORTANT: Must also enable "Server Members Intent" in Discord Developer Portal:
// https://discord.com/developers/applications/{APP_ID}/bot → Privileged Gateway Intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
  rest: {
    timeout: 15_000, // 15s timeout for REST API calls (prevents hanging on rate limits)
    retries: 1,      // Only retry REST calls once
  },
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
  
  // Start self-ping keepalive (guard against duplicate timers)
  if (selfPingTimer) clearInterval(selfPingTimer);
  startSelfPing();

  // Set bot presence
  client.user.setPresence({
    activities: [{
      name: '/help | ks-atlas.com',
      type: ActivityType.Playing,
    }],
    status: 'online',
  });

  // Initialize scheduled tasks (daily updates at 02:00 UTC)
  // Only on first ready to avoid duplicate cron jobs
  if (readyFiredCount === 1) {
    scheduler.initScheduler(client);
  }
  
  // Test API connectivity
  testApiConnectivity();

  // Register slash commands AFTER bot is connected (non-blocking, with auto-retry)
  registerCommandsWithRetry();
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
  const rest = new REST({ version: '10' }).setToken(config.token);
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
});

// Event: Shard error - critical for diagnosing connection issues
client.on('shardError', (error, shardId) => {
  console.error(`❌ Shard ${shardId} error:`, error.message);
  console.error('   Code:', error.code);
  lastError = `Shard ${shardId}: ${error.message} (code: ${error.code})`;
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

// Event: Interaction (slash commands)
client.on('interactionCreate', async (interaction) => {
  interactionCount++;
  lastInteractionTime = new Date().toISOString();
  
  // Log ALL interactions for debugging
  const iType = interaction.type;
  const isChatInput = interaction.isChatInputCommand();
  console.log(`📥 Interaction #${interactionCount}: type=${iType} isChatInput=${isChatInput} id=${interaction.id}`);
  lastCommandDebug = `type=${iType} isChatInput=${isChatInput} ts=${lastInteractionTime}`;
  
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
    const resp = await fetch(`https://discord.com/api/v10/interactions/${iId}/${iToken}/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 5, data: options.ephemeral ? { flags: 64 } : {} })
    });
    interaction.deferred = true;
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`deferReply failed: ${resp.status} ${text.substring(0, 200)}`);
    }
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
        flags: data.ephemeral ? 64 : 0,
      }
    };
    const resp = await fetch(`https://discord.com/api/v10/interactions/${iId}/${iToken}/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    interaction.replied = true;
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`reply failed: ${resp.status} ${text.substring(0, 200)}`);
    }
    console.log(`   [${commandName}] RAW reply OK (${resp.status})`);
  };

  interaction.editReply = async (options) => {
    console.log(`   [${commandName}] RAW editReply...`);
    const data = typeof options === 'string' ? { content: options } : { ...options };
    const resp = await fetch(`https://discord.com/api/v10/webhooks/${appId}/${iToken}/messages/@original`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: data.content || undefined,
        embeds: data.embeds?.map(e => (typeof e.toJSON === 'function' ? e.toJSON() : e)),
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
      case 'leaderboard':
        await handlers.handleLeaderboard(interaction);
        break;
      case 'tier':
        await handlers.handleTier(interaction);
        break;
      case 'top':
        await handlers.handleTop(interaction);
        break;
      case 'upcoming':
        await handlers.handleUpcoming(interaction);
        break;
      case 'countdown':
        await handlers.handleCountdown(interaction);
        break;
      case 'random':
        await handlers.handleRandom(interaction);
        break;
      case 'help':
        await handlers.handleHelp(interaction);
        break;
      case 'link':
        await handlers.handleLink(interaction);
        break;
      case 'stats':
        await handlers.handleStats(interaction);
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
      logger.syncToApi(commandName, interaction.guildId || 'DM', interaction.user.id);
    } catch (logErr) {
      console.error(`   [${commandName}] Logger error (non-fatal): ${logErr.message}`);
    }
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

// Event: New member joins - send welcome message to #welcome channel
client.on('guildMemberAdd', async (member) => {
  console.log(`👋 New member: ${member.user.username} joined ${member.guild.name}`);
  
  try {
    // Find the #welcome channel
    const welcomeChannel = member.guild.channels.cache.find(
      ch => ch.name === 'welcome' && ch.isTextBased()
    );
    
    if (welcomeChannel) {
      const embeds = require('./utils/embeds');
      const welcomeEmbed = embeds.createWelcomeEmbed(member.user.username);
      await welcomeChannel.send({ embeds: [welcomeEmbed] });
      console.log(`✅ Sent welcome message for ${member.user.username}`);
    }
  } catch (error) {
    console.error('Failed to send welcome message:', error);
  }
});

// Pre-login token validation using raw fetch (bypasses discord.js REST module)
async function validateToken(token) {
  console.log('🔍 Validating token with Discord API (raw fetch)...');
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000); // 10s timeout
    
    const response = await fetch('https://discord.com/api/v10/users/@me', {
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
        const gwResponse = await fetch('https://discord.com/api/v10/gateway/bot', {
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
  console.log(`   Token: ${config.token ? config.token.substring(0, 10) + '...' + config.token.substring(config.token.length - 5) : 'MISSING'} (${config.token?.length || 0} chars)`);
  
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
const MAX_LOGIN_RETRIES = 10;
let loginRetryTimer = null;

function scheduleLoginRetry() {
  if (loginRetryCount >= MAX_LOGIN_RETRIES) {
    console.error(`❌ Max login retries (${MAX_LOGIN_RETRIES}) exhausted. Waiting for Render restart.`);
    lastError = `All ${MAX_LOGIN_RETRIES} login retries exhausted. Render will restart the service.`;
    return;
  }
  
  loginRetryCount++;
  // Linear backoff: 1min, 2min, 3min, 4min, 5min (cap at 5min)
  const delay = Math.min(loginRetryCount * 60_000, 300_000);
  const delayMin = Math.round(delay / 60_000);
  console.log(`🔄 Login retry ${loginRetryCount}/${MAX_LOGIN_RETRIES} scheduled in ${delayMin} minutes`);
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
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the bot (don't exit on failure - keep health server for diagnostics)
main().catch((error) => {
  console.error('❌ Failed to start bot:', error);
  lastError = `main() crash: ${error.message}`;
  loginLastResult = `crash: ${error.message}`;
  // Don't process.exit() - keep health server alive so we can diagnose remotely
  console.error('   Health server still running at /health for diagnostics');
});
