/**
 * Register Slash Commands
 * Standalone script to register commands without starting the bot
 * 
 * Usage: npm run register
 */

require('dotenv').config();
const { REST, Routes } = require('discord.js');
const config = require('./config');
const commands = require('./commands');

if (!config.token || !config.clientId) {
  console.error('❌ Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in .env');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(config.token);

async function registerCommands() {
  try {
    console.log('🔄 Registering slash commands...');
    console.log(`📋 Commands: ${commands.map(c => c.name).join(', ')}`);

    // Always register globally so commands work in ALL servers
    await rest.put(
      Routes.applicationCommands(config.clientId),
      { body: commands }
    );
    console.log('✅ Global commands registered');
    console.log('⏰ Note: Global commands may take up to 1 hour to appear in all servers.');

    // Clear guild-specific commands to prevent duplicates
    if (config.guildId) {
      await rest.put(
        Routes.applicationGuildCommands(config.clientId, config.guildId),
        { body: [] }
      );
      console.log(`🧹 Cleared guild-specific commands for ${config.guildId} (prevents duplicates)`);
    }

    console.log('\n📋 Registered commands:');
    commands.forEach(cmd => {
      console.log(`  /${cmd.name} - ${cmd.description}`);
    });

  } catch (error) {
    console.error('❌ Failed to register commands:', error);
    process.exit(1);
  }
}

registerCommands();
