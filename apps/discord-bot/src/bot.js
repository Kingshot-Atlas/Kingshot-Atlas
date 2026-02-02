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
const { Client, GatewayIntentBits, REST, Routes, ActivityType } = require('discord.js');
const config = require('./config');
const commands = require('./commands');
const handlers = require('./commands/handlers');
const logger = require('./utils/logger');
const scheduler = require('./scheduler');

// Startup logging
console.log('🚀 Atlas Discord Bot starting...');
console.log(`� ${new Date().toISOString()}`);
console.log(`🔧 Node ${process.version}`);
console.log(`🌐 API URL: ${config.apiUrl || 'NOT SET'}`);

// Validate configuration
if (!config.token || !config.clientId) {
  console.error('❌ Missing DISCORD_TOKEN or DISCORD_CLIENT_ID');
  console.log('Token present:', !!config.token);
  console.log('Client ID present:', !!config.clientId);
  console.log('Guild ID present:', !!config.guildId);
  process.exit(1);
}

console.log('✅ Configuration validated');

// Initialize Discord client
// Note: GuildMembers intent removed - requires privileged intent in Discord Developer Portal
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ],
});

// Event: Ready
client.once('ready', () => {
  console.log(`\n✅ Atlas is online as ${client.user.tag}`);
  console.log(`📊 Serving ${client.guilds.cache.size} server(s)`);
  console.log(`🔗 API: ${config.apiUrl}`);
  console.log(`\n"${config.bot.tagline}"\n`);

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
});

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
    console.log('🔄 Registering slash commands...');

    if (config.guildId) {
      // Guild-specific registration (faster for development)
      await rest.put(
        Routes.applicationGuildCommands(config.clientId, config.guildId),
        { body: commands }
      );
      console.log(`✅ Commands registered for guild ${config.guildId}`);
    } else {
      // Global registration (takes up to 1 hour to propagate)
      await rest.put(
        Routes.applicationCommands(config.clientId),
        { body: commands }
      );
      console.log('✅ Global commands registered (may take up to 1 hour to appear)');
    }
  } catch (error) {
    console.error('❌ Failed to register commands:', error);
  }

  // Login to Discord
  await client.login(config.token);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down Atlas...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down Atlas...');
  client.destroy();
  process.exit(0);
});

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
