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

const healthServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    // Null-safe access to Discord client state (client may not be initialized yet)
    const wsStatus = client?.ws?.status ?? -1; // -1 = not connected
    const timeSinceStartup = Date.now() - startupTime;
    const inStartupGrace = timeSinceStartup < STARTUP_GRACE_PERIOD;
    
    // During startup grace period, return 200 to pass health checks while Discord connects
    // After grace period, require actual Discord connection
    const isHealthy = inStartupGrace || (botReady && wsStatus === 0); // 0 = READY
    const uptime = process.uptime();
    const memUsage = process.memoryUsage();
    
    const healthData = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      service: 'atlas-discord-bot',
      discord: {
        connected: wsStatus === 0,
        wsStatus: wsStatus,
        guilds: client?.guilds?.cache?.size || 0,
        ping: client?.ws?.ping ?? -1,
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
// Note: GuildMembers intent removed - requires privileged intent in Discord Developer Portal
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ],
});

// Event: Ready
client.once('ready', async () => {
  botReady = true;
  lastHeartbeat = Date.now();
  
  console.log(`\n✅ Atlas is online as ${client.user.tag}`);
  console.log(`📊 Serving ${client.guilds.cache.size} server(s)`);
  console.log(`🔗 API: ${config.apiUrl}`);
  console.log(`\n"${config.bot.tagline}"\n`);
  
  // Start self-ping keepalive
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
  scheduler.initScheduler(client);
  
  // Test API connectivity
  testApiConnectivity();
  
});

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
});

// Event: Shard disconnect
client.on('shardDisconnect', (event, shardId) => {
  console.warn(`⚠️ Shard ${shardId} disconnected. Code: ${event.code}, Clean: ${event.wasClean}`);
  botReady = false;
});

// Event: Invalidated session - token may be invalid
client.on('invalidated', () => {
  console.error('❌ Session invalidated - token may be invalid or revoked');
  botReady = false;
});

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
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;
  console.log(`📥 Command received: /${commandName} from ${interaction.user.tag}`);

  const startTime = Date.now();
  
  try {
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
      case 'stats':
        await handlers.handleStats(interaction);
        break;
      default:
        console.warn(`Unknown command: ${commandName}`);
    }
    
    // Log successful command
    const responseTime = Date.now() - startTime;
    logger.logCommand(interaction, responseTime, true);
    
    // Sync to API for dashboard tracking (non-blocking)
    logger.syncToApi(commandName, interaction.guildId || 'DM', interaction.user.id);
  } catch (error) {
    console.error(`Command error (${commandName}):`, error);
    logger.logError(commandName, error, interaction);

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

// Register slash commands and start bot
async function main() {
  const rest = new REST({ version: '10' }).setToken(config.token);

  try {
    console.log('🔄 Registering slash commands globally...');

    // Register commands globally - works in ALL servers
    // Note: Global commands can take up to 1 hour to propagate
    await rest.put(
      Routes.applicationCommands(config.clientId),
      { body: commands }
    );
    console.log('✅ Global commands registered');

    // Clear any guild-specific commands to avoid duplicates
    if (config.guildId) {
      await rest.put(
        Routes.applicationGuildCommands(config.clientId, config.guildId),
        { body: [] }  // Empty array removes guild commands
      );
      console.log(`✅ Cleared guild-specific commands from ${config.guildId} (using global only)`);
    }
  } catch (error) {
    console.error('❌ Failed to register commands:', error);
  }

  // Login to Discord
  console.log('🔐 Attempting Discord login...');
  try {
    await client.login(config.token);
    console.log('✅ Discord login call completed');
  } catch (loginError) {
    console.error('❌ Discord login failed:', loginError.message);
    console.error('   Code:', loginError.code);
    
    // Provide helpful error messages for common issues
    if (loginError.code === 'TOKEN_INVALID' || loginError.message.includes('invalid token')) {
      console.error('');
      console.error('   🔧 TOKEN INVALID - Common causes:');
      console.error('   1. Token was reset in Discord Developer Portal');
      console.error('   2. Wrong token copied (use Bot token, not Client Secret)');
      console.error('   3. Token has extra whitespace or newlines');
      console.error('   4. Environment variable not properly set in Render');
      console.error('');
      console.error('   To fix: Go to Discord Developer Portal > Your App > Bot > Reset Token');
      console.error('   Then update DISCORD_TOKEN or DISCORD_BOT_TOKEN in Render');
    } else if (loginError.code === 'DISALLOWED_INTENTS') {
      console.error('');
      console.error('   🔧 DISALLOWED INTENTS - Enable in Discord Developer Portal:');
      console.error('   Settings > Bot > Privileged Gateway Intents');
    } else if (loginError.message.includes('rate limit')) {
      console.error('');
      console.error('   🔧 RATE LIMITED - Too many login attempts');
      console.error('   Wait 5-15 minutes before restarting');
    }
    
    throw loginError;
  }
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

// Start the bot
main().catch((error) => {
  console.error('❌ Failed to start bot:', error);
  process.exit(1);
});
