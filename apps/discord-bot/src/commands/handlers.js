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
 * /rankings
 */
async function handleRankings(interaction) {
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
      'Failed to fetch rankings.',
      errorDetails
    );
    return interaction.editReply({ embeds: [errorEmbed] });
  }

  const embed = embeds.createRankingsEmbed(kingdoms);
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
 * /countdownkvk
 */
async function handleCountdownKvk(interaction) {
  const kvk = events.getNextKvK();
  const targetDate = kvk.isActive 
    ? (kvk.phase === 'Prep Phase' ? kvk.prepEnd : kvk.battleEnd)
    : kvk.startDateRaw;
  
  const timeRemaining = events.formatCountdown(targetDate);
  const embed = embeds.createCountdownEmbed(kvk, timeRemaining, 'kvk');
  return interaction.reply({ embeds: [embed] });
}

/**
 * /countdowntransfer
 */
async function handleCountdownTransfer(interaction) {
  const transfer = events.getNextTransfer();
  let targetDate;
  if (transfer.isActive) {
    if (transfer.phase === 'Pre-Transfer Phase') targetDate = transfer.preTransferEnd;
    else if (transfer.phase === 'Invitational Transfer Phase') targetDate = transfer.invitationalEnd;
    else targetDate = transfer.openEnd;
  } else {
    targetDate = transfer.startDateRaw;
  }
  
  const timeRemaining = events.formatCountdown(targetDate);
  const embed = embeds.createCountdownEmbed(transfer, timeRemaining, 'transfer');
  return interaction.reply({ embeds: [embed] });
}

/**
 * /help
 */
async function handleHelp(interaction) {
  const embed = embeds.createHelpEmbed();
  return interaction.reply({ embeds: [embed] });
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

async function handleHistory(interaction) {
  await interaction.deferReply();

  const number = interaction.options.getInteger('number');
  const kingdom = await api.fetchKingdom(number);

  if (!kingdom) {
    const errorEmbed = embeds.createErrorEmbed(
      `Kingdom ${number} not found.`,
      'Check the kingdom number and try again.'
    );
    return interaction.editReply({ embeds: [errorEmbed] });
  }

  const embed = embeds.createHistoryEmbed(kingdom);
  return interaction.editReply({ embeds: [embed] });
}

async function handlePredict(interaction) {
  await interaction.deferReply();

  const num1 = interaction.options.getInteger('kingdom1');
  const num2 = interaction.options.getInteger('kingdom2');

  if (num1 === num2) {
    const errorEmbed = embeds.createErrorEmbed(
      'Cannot predict a kingdom against itself.',
      'Choose two different kingdoms.'
    );
    return interaction.editReply({ embeds: [errorEmbed] });
  }

  const [k1, k2] = await Promise.all([
    api.fetchKingdom(num1),
    api.fetchKingdom(num2),
  ]);

  if (!k1 || !k2) {
    const missing = !k1 ? num1 : num2;
    const errorEmbed = embeds.createErrorEmbed(
      `Kingdom ${missing} not found.`,
      'Check the kingdom number and try again.'
    );
    return interaction.editReply({ embeds: [errorEmbed] });
  }

  const embed = embeds.createPredictEmbed(k1, k2);
  return interaction.editReply({ embeds: [embed] });
}

module.exports = {
  handleKingdom,
  handleCompare,
  handleRankings,
  handleTier,
  handleCountdownKvk,
  handleCountdownTransfer,
  handleHelp,
  handleStats,
  handleHistory,
  handlePredict,
};
