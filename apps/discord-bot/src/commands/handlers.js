/**
 * Command Handlers
 * Business logic for each slash command
 */

const api = require('../utils/api');
const events = require('../utils/events');
const embeds = require('../utils/embeds');

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

  const kingdoms = await api.fetchLeaderboard(10);

  if (kingdoms.length === 0) {
    const errorEmbed = embeds.createErrorEmbed(
      'Failed to fetch leaderboard.',
      'Please try again later.'
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
};
