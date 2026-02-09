/**
 * Command Handlers
 * Business logic for each slash command
 */

const api = require('../utils/api');
const events = require('../utils/events');
const embeds = require('../utils/embeds');
const logger = require('../utils/logger');

// Cooldown tracking: command -> Map<userId, lastUsedTimestamp>
const cooldowns = new Map();

/**
 * Check if a user is on cooldown for a command.
 * Returns seconds remaining if on cooldown, 0 if not.
 */
function checkCooldown(commandName, userId, cooldownSeconds) {
  if (!cooldowns.has(commandName)) {
    cooldowns.set(commandName, new Map());
  }
  const cmdCooldowns = cooldowns.get(commandName);
  const lastUsed = cmdCooldowns.get(userId) || 0;
  const now = Date.now();
  const elapsed = (now - lastUsed) / 1000;
  if (elapsed < cooldownSeconds) {
    return Math.ceil(cooldownSeconds - elapsed);
  }
  cmdCooldowns.set(userId, now);
  return 0;
}

const RALLY_FILL_TIME = 300; // 5 minutes in seconds

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
  // 30-second cooldown per user
  const remaining = checkCooldown('predict', interaction.user.id, 30);
  if (remaining > 0) {
    return interaction.reply({
      content: `\u23f3 Cooldown: try again in **${remaining}s**.`,
      ephemeral: true,
    });
  }

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

/**
 * /multirally — Rally coordination calculator
 * Calculates timing delays so multiple rallies hit a building within 1s of each other.
 * Response is ephemeral to avoid channel spam.
 */
async function handleMultirally(interaction) {
  // 60-second cooldown per user
  const remaining = checkCooldown('multirally', interaction.user.id, 60);
  if (remaining > 0) {
    return interaction.reply({
      content: `\u23f3 Cooldown: try again in **${remaining}s**.`,
      ephemeral: true,
    });
  }

  const target = interaction.options.getString('target');
  const playersRaw = interaction.options.getString('players');
  const gap = interaction.options.getInteger('gap') || 1;

  // Parse "PlayerName:MarchTimeInSeconds" pairs
  const entries = playersRaw.split(',').map(s => s.trim()).filter(Boolean);
  if (entries.length < 2) {
    return interaction.reply({
      content: '\u274c You need at least 2 players. Format: `PlayerA:15,PlayerB:18`',
      ephemeral: true,
    });
  }
  if (entries.length > 10) {
    return interaction.reply({
      content: '\u274c Maximum 10 rallies supported.',
      ephemeral: true,
    });
  }

  const players = [];
  for (const entry of entries) {
    const [name, timeStr] = entry.split(':').map(s => s.trim());
    const marchTime = parseInt(timeStr, 10);
    if (!name || isNaN(marchTime) || marchTime < 1 || marchTime > 600) {
      return interaction.reply({
        content: `\u274c Invalid entry: \`${entry}\`. Format: \`PlayerName:MarchTimeInSeconds\` (1-600s).`,
        ephemeral: true,
      });
    }
    players.push({ name, marchTime });
  }

  // Calculate rally start delays
  // Players are listed in desired HIT ORDER (first listed hits first)
  // desiredHitTime[i] = i * gap (seconds after first hit)
  // totalRallyTime[i] = RALLY_FILL_TIME + marchTime[i]
  // We normalize so the earliest caller starts at T=0
  const totalTimes = players.map(p => RALLY_FILL_TIME + p.marchTime);
  const desiredHits = players.map((_, i) => i * gap);
  const offsets = players.map((_, i) => totalTimes[i] - desiredHits[i]);
  const maxOffset = Math.max(...offsets);
  const startDelays = offsets.map(o => maxOffset - o);

  // Build the sorted call order (by start delay ascending = who calls first)
  const callOrder = players.map((p, i) => ({
    name: p.name,
    marchTime: p.marchTime,
    startDelay: startDelays[i],
    hitTime: startDelays[i] + totalTimes[i],
    hitOrder: i + 1,
  }));
  callOrder.sort((a, b) => a.startDelay - b.startDelay);

  // Format output
  const numberEmojis = ['1\ufe0f\u20e3', '2\ufe0f\u20e3', '3\ufe0f\u20e3', '4\ufe0f\u20e3', '5\ufe0f\u20e3', '6\ufe0f\u20e3', '7\ufe0f\u20e3', '8\ufe0f\u20e3', '9\ufe0f\u20e3', '\ud83d\udd1f'];

  const lines = callOrder.map((p, i) => {
    const emoji = numberEmojis[i] || `${i + 1}.`;
    const timing = p.startDelay === 0
      ? 'Start rally **NOW** (T+0s)'
      : `Wait **${p.startDelay}s**, then start rally (T+${p.startDelay}s)`;
    return `${emoji} **${p.name}** \u2014 ${timing}\n\u2003\u2003March: ${p.marchTime}s \u2192 Hits at T+${p.hitTime}s`;
  });

  const firstHit = Math.min(...callOrder.map(p => p.hitTime));
  const lastHit = Math.max(...callOrder.map(p => p.hitTime));
  const spread = lastHit - firstHit;

  const embed = embeds.createBaseEmbed()
    .setTitle(`\ud83c\udff0 Multi-Rally Coordination \u2014 ${target}`)
    .setDescription(`Target gap: **${gap}s** between hits\n\u200b`)
    .addFields({
      name: '\ud83d\udce2 Rally Call Order',
      value: lines.join('\n\n'),
    })
    .addFields({
      name: '\u200b',
      value: `\u23f1\ufe0f All ${players.length} rallies hit within **${spread}s** of each other`,
    })
    .setFooter({ text: 'Kingshot Atlas \u2022 ks-atlas.com \u2022 Rally times assume 5-minute fill' });

  return interaction.reply({ embeds: [embed], ephemeral: true });
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
  handleMultirally,
};
