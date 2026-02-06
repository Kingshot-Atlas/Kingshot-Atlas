/**
 * Command Handlers
 * Business logic for each slash command
 */

const api = require('../utils/api');
const events = require('../utils/events');
const embeds = require('../utils/embeds');
const logger = require('../utils/logger');

/**
 * /kingdom <number>
 */
async function handleKingdom(interaction) {
  const number = interaction.options.getInteger('number');
  await interaction.deferReply();

  const kingdom = await api.fetchKingdom(number);

  if (!kingdom) {
    const errorEmbed = embeds.createErrorEmbed(
      `Kingdom ${number} not found.`,
      'Make sure the kingdom number is correct and try again.'
    );
    return interaction.editReply({ embeds: [errorEmbed] });
  }

  const embed = embeds.createKingdomEmbed(kingdom);
  return interaction.editReply({ embeds: [embed] });
}

/**
 * /compare <k1> <k2>
 */
async function handleCompare(interaction) {
  const k1 = interaction.options.getInteger('kingdom1');
  const k2 = interaction.options.getInteger('kingdom2');
  await interaction.deferReply();

  if (k1 === k2) {
    const errorEmbed = embeds.createErrorEmbed(
      'Cannot compare a kingdom to itself.',
      'Please select two different kingdoms.'
    );
    return interaction.editReply({ embeds: [errorEmbed] });
  }

  const [kingdom1, kingdom2] = await Promise.all([
    api.fetchKingdom(k1),
    api.fetchKingdom(k2),
  ]);

  if (!kingdom1 || !kingdom2) {
    const missing = !kingdom1 ? k1 : k2;
    const errorEmbed = embeds.createErrorEmbed(
      `Kingdom ${missing} not found.`,
      'Make sure both kingdom numbers are correct.'
    );
    return interaction.editReply({ embeds: [errorEmbed] });
  }

  const embed = embeds.createCompareEmbed(kingdom1, kingdom2);
  return interaction.editReply({ embeds: [embed] });
}

/**
 * /leaderboard
 */
async function handleLeaderboard(interaction) {
  await interaction.deferReply();

  const result = await api.fetchLeaderboard(10);
  
  // Handle new structured response format
  const kingdoms = result.data || result;
  const error = result.error || null;

  if (!kingdoms || kingdoms.length === 0) {
    const errorDetails = error 
      ? `Error: ${error}` 
      : 'No kingdoms returned from API.';
    const errorEmbed = embeds.createErrorEmbed(
      'Failed to fetch leaderboard.',
      errorDetails
    );
    return interaction.editReply({ embeds: [errorEmbed] });
  }

  const embed = embeds.createLeaderboardEmbed(kingdoms);
  return interaction.editReply({ embeds: [embed] });
}

/**
 * /tier <tier>
 */
async function handleTier(interaction) {
  const tier = interaction.options.getString('tier');
  await interaction.deferReply();

  const kingdoms = await api.fetchKingdomsByTier(tier);

  const embed = embeds.createTierEmbed(tier, kingdoms);
  return interaction.editReply({ embeds: [embed] });
}

/**
 * /top <phase>
 */
async function handleTop(interaction) {
  const phase = interaction.options.getString('phase');
  await interaction.deferReply();

  const kingdoms = await api.fetchTopByPhase(phase, 10);

  if (kingdoms.length === 0) {
    const errorEmbed = embeds.createErrorEmbed(
      'Failed to fetch rankings.',
      'Please try again later.'
    );
    return interaction.editReply({ embeds: [errorEmbed] });
  }

  const phaseEmoji = phase === 'prep' ? '🛡️' : '⚔️';
  const phaseName = phase === 'prep' ? 'Prep Phase' : 'Battle Phase';
  const title = `${phaseEmoji} Top 10 by ${phaseName} Win Rate`;

  const embed = embeds.createLeaderboardEmbed(kingdoms, title);
  return interaction.editReply({ embeds: [embed] });
}

/**
 * /upcoming
 */
async function handleUpcoming(interaction) {
  const upcomingEvents = events.getUpcomingEvents();
  const embed = embeds.createUpcomingEmbed(upcomingEvents);
  return interaction.reply({ embeds: [embed] });
}

/**
 * /countdown
 */
async function handleCountdown(interaction) {
  const kvk = events.getNextKvK();
  const targetDate = kvk.isActive 
    ? (kvk.phase === 'Prep Phase' ? kvk.prepEnd : kvk.battleEnd)
    : kvk.startDateRaw;
  
  const timeRemaining = events.formatCountdown(targetDate);
  const embed = embeds.createCountdownEmbed(kvk, timeRemaining);
  return interaction.reply({ embeds: [embed] });
}

/**
 * /random
 */
async function handleRandom(interaction) {
  await interaction.deferReply();

  const kingdom = await api.fetchRandomKingdom();

  if (!kingdom) {
    const errorEmbed = embeds.createErrorEmbed(
      'Failed to fetch a random kingdom.',
      'Please try again later.'
    );
    return interaction.editReply({ embeds: [errorEmbed] });
  }

  const embed = embeds.createKingdomEmbed(kingdom);
  embed.setTitle(`🎲 Random Kingdom: K${kingdom.kingdom_number}`);
  return interaction.editReply({ embeds: [embed] });
}

/**
 * /help
 */
async function handleHelp(interaction) {
  const embed = embeds.createHelpEmbed();
  return interaction.reply({ embeds: [embed] });
}

/**
 * /link
 * Provides instructions to link Kingshot account for Settler role
 */
async function handleLink(interaction) {
  const embed = embeds.createBaseEmbed()
    .setTitle('🔗 Link Your Kingshot Account')
    .setDescription(
      'Connect your Kingshot account to Atlas and earn the **Settler** role in this server!\n\n' +
      'The Settler role proves you\'re a verified Kingshot player with a linked account.'
    )
    .addFields(
      {
        name: '📋 How to Link',
        value: [
          '1. Go to **[ks-atlas.com/profile](https://ks-atlas.com/profile)**',
          '2. Sign in to your Atlas account',
          '3. Click **Link Discord** in your profile',
          '4. Click **Link Kingshot Account** and enter your player ID',
          '5. The **Settler** role is assigned automatically!',
        ].join('\n'),
        inline: false,
      },
      {
        name: '🎖️ What You Get',
        value: [
          '• **Settler** Discord role — verified player badge',
          '• Access to Settler-only channels',
          '• Your kingdom info shown on your Atlas profile',
        ].join('\n'),
        inline: false,
      }
    )
    .setURL('https://ks-atlas.com/profile');

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

/**
 * /stats (admin only)
 * Shows bot usage statistics for Discord Community Manager analysis
 */
async function handleStats(interaction) {
  // Check if user has admin permissions
  const isAdmin = interaction.member?.permissions?.has('Administrator') || false;
  
  if (!isAdmin) {
    return interaction.reply({
      content: '❌ This command is only available to server administrators.',
      ephemeral: true,
    });
  }

  const stats = logger.getStats();
  
  const embed = embeds.createBaseEmbed()
    .setTitle('📊 Atlas Bot Statistics')
    .setDescription('Usage analytics for community management')
    .addFields(
      {
        name: '📈 All Time',
        value: [
          `Commands: **${stats.totals.commands.toLocaleString()}**`,
          `Errors: **${stats.totals.errors}** (${stats.totals.errorRate})`,
          `Active Servers: **${stats.activeGuilds}**`,
        ].join('\n'),
        inline: true,
      },
      {
        name: '📅 Today',
        value: [
          `Commands: **${stats.today.commands}**`,
          `Unique Users: **${stats.today.uniqueUsers}**`,
          `Errors: **${stats.today.errors}**`,
        ].join('\n'),
        inline: true,
      },
      {
        name: '🏆 Top Commands',
        value: stats.topCommands.length > 0
          ? stats.topCommands.map((c, i) => `${i + 1}. \`/${c.command}\`: ${c.count}`).join('\n')
          : 'No data yet',
        inline: false,
      }
    )
    .setFooter({ text: `Last updated: ${new Date(stats.lastUpdated).toLocaleString()}` });

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

module.exports = {
  handleKingdom,
  handleCompare,
  handleLeaderboard,
  handleTier,
  handleTop,
  handleUpcoming,
  handleCountdown,
  handleRandom,
  handleHelp,
  handleLink,
  handleStats,
};
