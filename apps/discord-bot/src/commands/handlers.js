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

// Supporter role — used for analytics tracking
const SUPPORTER_ROLE_ID = process.env.DISCORD_SUPPORTER_ROLE_ID || '';


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
 * /rankings [transfer_group] [min_kvks]
 */
async function handleRankings(interaction) {
  await interaction.deferReply();

  const transferGroup = interaction.options.getString('transfer_group');
  const minKvks = interaction.options.getInteger('min_kvks');
  const maxKvks = interaction.options.getInteger('max_kvks');

  // Validate: max_kvks must be >= min_kvks if both are provided
  if (minKvks && maxKvks && maxKvks < minKvks) {
    const errorEmbed = embeds.createErrorEmbed(
      'Invalid KvK range.',
      `max_kvks (${maxKvks}) cannot be less than min_kvks (${minKvks}).`
    );
    return interaction.editReply({ embeds: [errorEmbed] });
  }

  // Fetch more kingdoms when filtering so we can still show top 10 after filters
  const hasFilters = transferGroup || minKvks || maxKvks;
  const fetchLimit = hasFilters ? 100 : 10;
  const result = await api.fetchLeaderboard(fetchLimit);
  
  // Handle new structured response format
  let kingdoms = result.data || result;
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

  // Apply transfer group filter
  if (transferGroup) {
    const [min, max] = transferGroup.split('-').map(Number);
    kingdoms = kingdoms.filter(k => k.kingdom_number >= min && k.kingdom_number <= max);
  }

  // Apply KvK experience filters (exact, min, range)
  if (minKvks && maxKvks) {
    // Range or exact: both provided
    kingdoms = kingdoms.filter(k => {
      const kvks = k.total_kvks || 0;
      return kvks >= minKvks && kvks <= maxKvks;
    });
  } else if (minKvks) {
    // Minimum only
    kingdoms = kingdoms.filter(k => (k.total_kvks || 0) >= minKvks);
  } else if (maxKvks) {
    // Maximum only
    kingdoms = kingdoms.filter(k => (k.total_kvks || 0) <= maxKvks);
  }

  // Limit to top 10 after filtering
  kingdoms = kingdoms.slice(0, 10);

  if (kingdoms.length === 0) {
    const errorEmbed = embeds.createErrorEmbed(
      'No kingdoms match your filters.',
      'Try adjusting the transfer group or KvK experience range.'
    );
    return interaction.editReply({ embeds: [errorEmbed] });
  }

  // Build title with active filters
  const filters = [];
  if (transferGroup) {
    const [min, max] = transferGroup.split('-').map(Number);
    const label = max >= 99999 ? `K${min}+` : `K${min}\u2013K${max}`;
    filters.push(label);
  }
  if (minKvks && maxKvks && minKvks === maxKvks) {
    filters.push(`Exactly ${minKvks} KvKs`);
  } else if (minKvks && maxKvks) {
    filters.push(`${minKvks}\u2013${maxKvks} KvKs`);
  } else if (minKvks) {
    filters.push(`${minKvks}+ KvKs`);
  } else if (maxKvks) {
    filters.push(`\u2264${maxKvks} KvKs`);
  }
  const title = filters.length > 0
    ? `\ud83c\udfc6 Atlas Rankings \u2022 ${filters.join(' \u2022 ')}`
    : '\ud83c\udfc6 Atlas Rankings';

  const embed = embeds.createRankingsEmbed(kingdoms, title);
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
          `Rally Upsells: **${stats.totals.multirallyUpsells || 0}**`,
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

  const isSupporter = SUPPORTER_ROLE_ID && interaction.member?.roles?.cache?.has(SUPPORTER_ROLE_ID);

  const target = interaction.options.getString('target');
  const playersRaw = interaction.options.getString('players');
  const gap = interaction.options.getInteger('gap') ?? 0;

  // Help shortcut: if players field is "help", show usage guide
  if (playersRaw.trim().toLowerCase() === 'help') {
    const helpEmbed = embeds.createMultirallyHelpEmbed();
    return interaction.reply({ embeds: [helpEmbed], ephemeral: true });
  }

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
  const seenNames = new Set();
  for (const entry of entries) {
    const [name, timeStr] = entry.split(':').map(s => s.trim());
    const marchTime = parseInt(timeStr, 10);
    if (!name || isNaN(marchTime) || marchTime < 1 || marchTime > 600) {
      return interaction.reply({
        content: `\u274c Invalid entry: \`${entry}\`. Format: \`PlayerName:MarchTimeInSeconds\` (1-600s).`,
        ephemeral: true,
      });
    }
    const nameLower = name.toLowerCase();
    if (seenNames.has(nameLower)) {
      return interaction.reply({
        content: `\u274c Duplicate player name: \`${name}\`. Each player should appear only once.`,
        ephemeral: true,
      });
    }
    seenNames.add(nameLower);
    players.push({ name, marchTime });
  }

  // Warn about unrealistic march times (>100s)
  const slowPlayers = players.filter(p => p.marchTime > 100);
  const marchWarning = slowPlayers.length > 0
    ? `\n\u26a0\ufe0f **Heads up:** ${slowPlayers.map(p => `${p.name} (${p.marchTime}s)`).join(', ')} ${slowPlayers.length === 1 ? 'has' : 'have'} march time over 100s — double-check that's correct.`
    : '';

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
    return `${emoji} **${p.name}** \u2014 ${timing}\n\u2003\u2003March: ${p.marchTime}s`;
  });

  // Build copy-friendly plain text for alliance chat
  const copyLines = callOrder.map((p, i) => {
    const timing = p.startDelay === 0
      ? 'START NOW (T+0s)'
      : `Wait ${p.startDelay}s (T+${p.startDelay}s)`;
    return `${i + 1}. ${p.name} — ${timing} | March: ${p.marchTime}s`;
  });
  const copyText = [
    `=== RALLY ORDER: ${target} ===`,
    `Gap: ${gap}s | Fill: 5min`,
    '',
    ...copyLines,
  ].join('\n');

  const embed = embeds.createBaseEmbed()
    .setTitle(`\ud83c\udff0 Multi-Rally Coordination \u2014 ${target}`)
    .setDescription(`Target gap: **${gap}s** between hits${marchWarning}\n\u200b`)
    .addFields({
      name: '\ud83d\udce2 Rally Call Order',
      value: lines.join('\n\n'),
    })
    .addFields({
      name: '\ud83d\udccb Copy for Alliance Chat',
      value: `\`\`\`\n${copyText}\n\`\`\``,
    })
    .setFooter({ text: `Kingshot Atlas \u2022 ks-atlas.com` });

  // Track multirally analytics (target building, player count, gap)
  logger.syncToApi('multirally', interaction.guildId || 'DM', interaction.user.id);
  try {
    const body = {
      target,
      player_count: players.length,
      gap,
      guild_id: interaction.guildId || 'DM',
      user_id: interaction.user.id,
      is_supporter: !!isSupporter,
    };
    const apiUrl = process.env.API_URL || 'https://kingshot-atlas.onrender.com';
    fetch(`${apiUrl}/api/v1/bot/log-multirally`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.DISCORD_API_KEY || '' },
      body: JSON.stringify(body),
    }).catch(() => {}); // fire-and-forget
  } catch (_) { /* never block on analytics */ }

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

/**
 * /codes — Show active gift codes (uses backend API)
 */
async function handleCodes(interaction) {
  await interaction.deferReply();

  try {
    const activeCodes = await api.fetchGiftCodes();

    if (!activeCodes || activeCodes.length === 0) {
      const errorEmbed = embeds.createErrorEmbed(
        'No active gift codes found.',
        'Check back later — new codes are added regularly.\nYou can also view codes at [ks-atlas.com/gift-codes](https://ks-atlas.com/gift-codes).'
      );
      return interaction.editReply({ embeds: [errorEmbed] });
    }

    const embed = embeds.createGiftCodesEmbed(activeCodes);
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('View on Atlas')
        .setURL('https://ks-atlas.com/gift-codes')
        .setStyle(ButtonStyle.Link)
        .setEmoji('🌐')
    );
    return interaction.editReply({ embeds: [embed], components: [row] });
  } catch (error) {
    const errorEmbed = embeds.createErrorEmbed(
      'Failed to fetch gift codes.',
      error.message || 'Unknown error'
    );
    return interaction.editReply({ embeds: [errorEmbed] });
  }
}



/**
 * /link — Guide users to link their Discord account to their Atlas profile.
 * Checks if already linked; if so, shows status. Otherwise, provides instructions.
 */
async function handleLink(interaction) {
  await interaction.deferReply({ ephemeral: true });

  // Track usage
  logger.syncToApi('link', interaction.guildId || 'DM', interaction.user.id);

  // Check if user is already linked
  const profile = await api.lookupUserByDiscordId(interaction.user.id);

  if (profile && profile.linked_player_id) {
    const playerName = profile.linked_username || profile.username || `Player ${profile.linked_player_id}`;
    const embed = embeds.createBaseEmbed()
      .setTitle('✅ Already Linked')
      .setDescription(
        `Your Discord is linked to **${playerName}** (ID: \`${profile.linked_player_id}\`).\n\n` +
        '**What you can do:**\n' +
        '• `/codes` — View active gift codes\n' +
        '• Settler role is auto-assigned on next sync\n\n' +
        'To change your linked account, visit [your Atlas profile](https://ks-atlas.com/profile).'
      )
      .setColor(0x22c55e);
    return interaction.editReply({ embeds: [embed] });
  }

  if (profile && !profile.linked_player_id) {
    const embed = embeds.createBaseEmbed()
      .setTitle('🔗 Almost There — Link Your Kingshot Account')
      .setDescription(
        'Your Discord is connected to Atlas, but you haven\'t linked your **Kingshot Player ID** yet.\n\n' +
        '**Next step:**\n' +
        '1. Go to [your Atlas profile](https://ks-atlas.com/profile)\n' +
        '2. Click **Link Kingshot Account**\n' +
        '3. Enter your Player ID (found in-game under Settings > Account)\n\n' +
        'Once linked, you\'ll unlock the Settler role and cloud-synced alt accounts.'
      )
      .setColor(0xfbbf24);

    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Go to Profile')
        .setURL('https://ks-atlas.com/profile')
        .setStyle(ButtonStyle.Link)
        .setEmoji('🔗')
    );
    return interaction.editReply({ embeds: [embed], components: [row] });
  }

  // Not linked at all
  const embed = embeds.createBaseEmbed()
    .setTitle('🔗 Link Your Account')
    .setDescription(
      'Connect your Discord to Atlas to unlock powerful features:\n\n' +
      '**What you get:**\n' +
      '• 🎖️ **Settler role** — automatic Discord role\n' +
      '• 🎁 **`/codes`** — view active gift codes\n' +
      '• ☁️ **Cloud sync** — alt accounts saved across devices\n\n' +
      '**How to link (takes 30 seconds):**\n' +
      '1. Go to [ks-atlas.com](https://ks-atlas.com) and **Sign in with Discord**\n' +
      '2. Go to your **Profile** page\n' +
      '3. Click **Link Kingshot Account** and enter your Player ID\n\n' +
      '*Your Player ID is in-game under Settings > Account.*'
    )
    .setColor(0x5865F2);

  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Sign In to Atlas')
      .setURL('https://ks-atlas.com')
      .setStyle(ButtonStyle.Link)
      .setEmoji('🌐')
  );
  return interaction.editReply({ embeds: [embed], components: [row] });
}

/**
 * /transferstatus <number> — Show a kingdom's full transfer history
 */
async function handleTransferStatus(interaction) {
  const number = interaction.options.getInteger('number');
  await interaction.deferReply();

  // Fetch kingdom data and transfer history in parallel
  const [kingdom, historyData] = await Promise.all([
    api.fetchKingdom(number),
    api.fetchTransferHistory(number),
  ]);

  if (!kingdom) {
    const errorEmbed = embeds.createErrorEmbed(
      `Kingdom ${number} not found.`,
      'Make sure the kingdom number is correct and try again.'
    );
    return interaction.editReply({ embeds: [errorEmbed] });
  }

  const embed = embeds.createTransferStatusEmbed(kingdom, historyData);
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
  handleMultirally,
  handleCodes,
  handleLink,
  handleTransferStatus,
};
