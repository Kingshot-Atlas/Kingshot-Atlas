/**
 * Command Definitions
 * All slash commands for the Atlas Discord bot
 */

const { SlashCommandBuilder } = require('discord.js');

const commands = [
  // /kingdom <number>
  new SlashCommandBuilder()
    .setName('kingdom')
    .setDescription('Get detailed stats for a Kingshot kingdom')
    .addIntegerOption(option =>
      option
        .setName('number')
        .setDescription('Kingdom number (e.g., 172, 1001)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(9999)
        .setAutocomplete(true)
    ),

  // /compare <k1> <k2>
  new SlashCommandBuilder()
    .setName('compare')
    .setDescription('Compare two kingdoms head-to-head')
    .addIntegerOption(option =>
      option
        .setName('kingdom1')
        .setDescription('First kingdom number')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(9999)
    )
    .addIntegerOption(option =>
      option
        .setName('kingdom2')
        .setDescription('Second kingdom number')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(9999)
    ),

  // /leaderboard
  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show top 10 kingdoms by Atlas Score'),

  // /tier <tier>
  new SlashCommandBuilder()
    .setName('tier')
    .setDescription('List kingdoms by tier')
    .addStringOption(option =>
      option
        .setName('tier')
        .setDescription('Select a tier')
        .setRequired(true)
        .addChoices(
          { name: '🏆 S-Tier (Elite)', value: 'S' },
          { name: '⭐ A-Tier (Strong)', value: 'A' },
          { name: '🔷 B-Tier (Solid)', value: 'B' },
          { name: '⚪ C-Tier (Developing)', value: 'C' },
          { name: '⬜ D-Tier (New)', value: 'D' }
        )
    ),

  // /top <phase>
  new SlashCommandBuilder()
    .setName('top')
    .setDescription('Show top 10 kingdoms by phase win rate')
    .addStringOption(option =>
      option
        .setName('phase')
        .setDescription('Select phase')
        .setRequired(true)
        .addChoices(
          { name: '🛡️ Prep Phase', value: 'prep' },
          { name: '⚔️ Battle Phase', value: 'battle' }
        )
    ),

  // /upcoming
  new SlashCommandBuilder()
    .setName('upcoming')
    .setDescription('Show upcoming KvK and Transfer Event dates'),

  // /countdownkvk
  new SlashCommandBuilder()
    .setName('countdownkvk')
    .setDescription('Show countdown timer to next KvK'),

  // /countdowntransfer
  new SlashCommandBuilder()
    .setName('countdowntransfer')
    .setDescription('Show countdown timer to next Transfer Event'),

  // /random
  new SlashCommandBuilder()
    .setName('random')
    .setDescription('Discover a random kingdom'),

  // /help
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all Atlas bot commands'),

  // /link - Link your Kingshot account to get the Settler role
  new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your Kingshot account to Atlas for the Settler role'),

  // /stats (admin only - for Discord Community Manager analysis)
  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Show bot usage statistics (admin only)'),
];

module.exports = commands.map(cmd => cmd.toJSON());
