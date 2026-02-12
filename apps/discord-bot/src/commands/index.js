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

  // /rankings
  new SlashCommandBuilder()
    .setName('rankings')
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

  // /countdownkvk
  new SlashCommandBuilder()
    .setName('countdownkvk')
    .setDescription('Show countdown timer to next KvK'),

  // /countdowntransfer
  new SlashCommandBuilder()
    .setName('countdowntransfer')
    .setDescription('Show countdown timer to next Transfer Event'),

  // /history <number>
  new SlashCommandBuilder()
    .setName('history')
    .setDescription('View a kingdom\'s full KvK season history')
    .addIntegerOption(option =>
      option
        .setName('number')
        .setDescription('Kingdom number (e.g., 172, 1001)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(9999)
        .setAutocomplete(true)
    ),

  // /predict <k1> <k2>
  new SlashCommandBuilder()
    .setName('predict')
    .setDescription('Predict the outcome of a KvK matchup between two kingdoms')
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

  // /multirally <target> <players> [gap]
  new SlashCommandBuilder()
    .setName('multirally')
    .setDescription('Coordinate multiple rallies to hit a building at the same time')
    .addStringOption(option =>
      option
        .setName('target')
        .setDescription('Building to target')
        .setRequired(true)
        .addChoices(
          { name: "King's Castle", value: "King's Castle" },
          { name: 'Turret 1 (South)', value: 'Turret 1' },
          { name: 'Turret 2 (West)', value: 'Turret 2' },
          { name: 'Turret 3 (East)', value: 'Turret 3' },
          { name: 'Turret 4 (North)', value: 'Turret 4' }
        )
    )
    .addStringOption(option =>
      option
        .setName('players')
        .setDescription('Player:MarchTime pairs in desired HIT order (e.g. PlayerB:18,PlayerA:15)')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('gap')
        .setDescription('Seconds between each hit (default: 0)')
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(10)
    ),

  // /codes
  new SlashCommandBuilder()
    .setName('codes')
    .setDescription('Show active Kingshot gift codes you can redeem right now'),

  // /redeem [code]
  new SlashCommandBuilder()
    .setName('redeem')
    .setDescription('Redeem gift codes for your linked Kingshot account')
    .addStringOption(option =>
      option
        .setName('code')
        .setDescription('Pick a specific code or "All" to redeem everything')
        .setRequired(false)
        .setAutocomplete(true)
    ),

  // /help
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all Atlas bot commands'),

  // /stats (admin only - for Discord Community Manager analysis)
  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Show bot usage statistics (admin only)'),
];

module.exports = commands.map(cmd => cmd.toJSON());
