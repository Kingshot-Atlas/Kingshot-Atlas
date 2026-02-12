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

// Supporter role — users with this Discord role bypass /multirally credit limits
const SUPPORTER_ROLE_ID = process.env.DISCORD_SUPPORTER_ROLE_ID || '';

// Daily usage credits for /multirally (non-Supporters)
const MULTIRALLY_DAILY_LIMIT = 3;
const multirallyCredits = new Map(); // userId -> { uses: number, date: string }

/**
 * Check if a user has remaining /multirally credits.
 * Supporters always return true. Free users get MULTIRALLY_DAILY_LIMIT per day.
 * Returns { allowed: boolean, remaining: number }.
 * Uses API-backed persistent tracking; falls back to in-memory on API failure.
 */
async function checkMultirallyCredits(userId, isSupporter) {
  // Try API-backed check first (persistent across restarts)
  const apiResult = await api.checkMultirallyCredits(userId, isSupporter);
  if (apiResult) {
    return {
      allowed: apiResult.allowed,
      remaining: apiResult.is_supporter ? Infinity : apiResult.remaining,
    };
  }

  // Fallback to in-memory tracking if API is unavailable
  console.warn('[multirally] API credit check failed, using in-memory fallback');
  if (isSupporter) return { allowed: true, remaining: Infinity };

  const today = new Date().toISOString().split('T')[0];
  const entry = multirallyCredits.get(userId);

  if (!entry || entry.date !== today) {
    return { allowed: true, remaining: MULTIRALLY_DAILY_LIMIT - 1 };
  }

  if (entry.uses >= MULTIRALLY_DAILY_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: MULTIRALLY_DAILY_LIMIT - entry.uses };
}

/**
 * Increment /multirally usage after successful execution.
 * Writes to API (persistent) and updates in-memory fallback.
 */
async function incrementMultirallyCredits(userId, isSupporter) {
  // Always update in-memory fallback
  const today = new Date().toISOString().split('T')[0];
  const entry = multirallyCredits.get(userId);
  if (!entry || entry.date !== today) {
    multirallyCredits.set(userId, { uses: 1, date: today });
  } else {
    entry.uses++;
  }

  // Write to API for persistence
  const apiResult = await api.incrementMultirallyCredits(userId, isSupporter);
  if (!apiResult) {
    console.warn('[multirally] API increment failed, in-memory fallback used');
  }
  return apiResult;
}

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

  // Credits check: Supporters get unlimited, free users get 3/day
  const isSupporter = SUPPORTER_ROLE_ID && interaction.member?.roles?.cache?.has(SUPPORTER_ROLE_ID);

  const target = interaction.options.getString('target');
  const playersRaw = interaction.options.getString('players');
  const gap = interaction.options.getInteger('gap') ?? 0;

  // Help shortcut: if players field is "help", show usage guide
  if (playersRaw.trim().toLowerCase() === 'help') {
    const helpEmbed = embeds.createMultirallyHelpEmbed();
    return interaction.reply({ embeds: [helpEmbed], ephemeral: true });
  }

  // Check credits AFTER help (help doesn't cost a credit)
  const credits = await checkMultirallyCredits(interaction.user.id, isSupporter);
  if (!credits.allowed) {
    logger.logMultirallyUpsell(interaction.user.id, interaction.guildId || 'DM');
    logger.syncToApi('multirally_upsell', interaction.guildId || 'DM', interaction.user.id);
    const upsellEmbed = embeds.createMultirallyUpsellEmbed();
    return interaction.reply({ embeds: [upsellEmbed], ephemeral: true });
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

  // Credits remaining footer (subtract 1 since this use will be incremented after)
  const remainingAfter = isSupporter ? Infinity : Math.max(0, credits.remaining - 1);
  const creditsText = isSupporter
    ? 'Atlas Supporter \u2022 Unlimited'
    : `${remainingAfter} use${remainingAfter !== 1 ? 's' : ''} remaining today`;

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
    .setFooter({ text: `Kingshot Atlas \u2022 ks-atlas.com \u2022 ${creditsText}` });

  // Increment usage AFTER successful execution
  await incrementMultirallyCredits(interaction.user.id, isSupporter);

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
        'Check back later — new codes are added regularly.\nYou can also redeem codes at [ks-atlas.com/gift-codes](https://ks-atlas.com/gift-codes).'
      );
      return interaction.editReply({ embeds: [errorEmbed] });
    }

    const embed = embeds.createGiftCodesEmbed(activeCodes);
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Redeem on Atlas')
        .setURL('https://ks-atlas.com/tools/gift-codes')
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
 * Non-retryable err_codes — skip these during bulk redemption
 */
const NON_RETRYABLE_ERR_CODES = [40008, 40007, 40014, 40009, 20000];

/**
 * /redeem [code] — Redeem gift codes for a linked Kingshot account
 * If code is omitted or '__ALL__', redeems all active codes.
 * If a specific code is provided, redeems just that one.
 */
async function handleRedeem(interaction) {
  // 30-second cooldown per user
  const remaining = checkCooldown('redeem', interaction.user.id, 30);
  if (remaining > 0) {
    return interaction.reply({
      content: `\u23f3 Cooldown: try again in **${remaining}s**.`,
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  // Track usage
  logger.syncToApi('redeem', interaction.guildId || 'DM', interaction.user.id);

  // 1. Look up Atlas profile by Discord ID
  const profile = await api.lookupUserByDiscordId(interaction.user.id);

  if (!profile) {
    const embed = embeds.createBaseEmbed()
      .setTitle('\ud83d\udd17 Account Not Linked')
      .setDescription(
        'Your Discord account isn\'t linked to an Atlas profile yet.\n\n' +
        '**How to link:**\n' +
        '1. Go to [ks-atlas.com](https://ks-atlas.com) and sign in with Discord\n' +
        '2. Go to your **Profile** page\n' +
        '3. Click **Link Kingshot Account** and enter your Player ID\n\n' +
        'Once linked, come back and use `/redeem` to auto-redeem all active codes!'
      )
      .setColor(0xfbbf24);
    return interaction.editReply({ embeds: [embed] });
  }

  const playerId = profile.linked_player_id;
  if (!playerId) {
    const embed = embeds.createBaseEmbed()
      .setTitle('\ud83c\udfae Kingshot Account Not Linked')
      .setDescription(
        'Your Atlas profile exists, but you haven\'t linked your Kingshot account yet.\n\n' +
        'Go to [your Atlas profile](https://ks-atlas.com/profile) and click **Link Kingshot Account**.'
      )
      .setColor(0xfbbf24);
    return interaction.editReply({ embeds: [embed] });
  }

  const playerName = profile.linked_username || profile.username || `Player ${playerId}`;

  // 2. Determine which codes to redeem
  const selectedCode = interaction.options.getString('code');
  const redeemAll = !selectedCode || selectedCode === '__ALL__';

  const allCodes = await api.fetchGiftCodes();
  if (!allCodes || allCodes.length === 0) {
    const embed = embeds.createBaseEmbed()
      .setTitle('\ud83c\udf81 No Active Gift Codes')
      .setDescription('There are no active gift codes right now. Check back later!')
      .setColor(0x6b7280);
    return interaction.editReply({ embeds: [embed] });
  }

  const codesToRedeem = redeemAll
    ? allCodes
    : allCodes.filter(c => c.code === selectedCode);

  if (codesToRedeem.length === 0) {
    const embed = embeds.createBaseEmbed()
      .setTitle('\ud83c\udf81 Code Not Found')
      .setDescription(`\`${selectedCode}\` isn't in the active codes list. Use \`/codes\` to see what's available.`)
      .setColor(0xef4444);
    return interaction.editReply({ embeds: [embed] });
  }

  // 3. Redeem sequentially with ~5s delay
  const startEmbed = embeds.createBaseEmbed()
    .setTitle('\ud83c\udf81 Redeeming Gift Codes')
    .setDescription(`Redeeming **${codesToRedeem.length}** code${codesToRedeem.length > 1 ? 's' : ''} for **${playerName}**...\nThis may take a moment.`)
    .setColor(0x3b82f6);

  await interaction.editReply({ embeds: [startEmbed] });

  const results = [];
  for (let i = 0; i < codesToRedeem.length; i++) {
    const code = codesToRedeem[i].code;

    const result = await api.redeemGiftCode(playerId, code);
    const emoji = result.success ? '\u2705' : '\u274c';
    let status = result.message || (result.success ? 'Success' : 'Failed');

    // Classify outcome
    if (result.err_code && NON_RETRYABLE_ERR_CODES.includes(result.err_code)) {
      if (result.err_code === 40008 || result.err_code === 40014) status = 'Already redeemed';
      else if (result.err_code === 40007) status = 'Expired';
      else if (result.err_code === 40009) status = 'Invalid code';
    }

    results.push(`${emoji} \`${code}\` — ${status}`);

    // Update progress embed every code
    const progressEmbed = embeds.createBaseEmbed()
      .setTitle('\ud83c\udf81 Redeeming Gift Codes')
      .setDescription(`Progress: **${i + 1}/${codesToRedeem.length}** for **${playerName}**`)
      .addFields({ name: 'Results', value: results.join('\n') })
      .setColor(0x3b82f6);

    await interaction.editReply({ embeds: [progressEmbed] }).catch(() => {});

    // Wait ~5 seconds between codes (except after last)
    if (i < codesToRedeem.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  // 4. Final summary
  const successes = results.filter(r => r.startsWith('\u2705')).length;
  const failures = results.filter(r => r.startsWith('\u274c')).length;

  const finalColor = successes === codesToRedeem.length ? 0x22c55e
    : successes > 0 ? 0xfbbf24
    : 0xef4444;

  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const finalEmbed = embeds.createBaseEmbed()
    .setTitle('\ud83c\udf81 Gift Code Redemption Complete')
    .setDescription(
      `**${playerName}** — ${successes} succeeded, ${failures} failed\n\n` +
      results.join('\n')
    )
    .setColor(finalColor)
    .setFooter({ text: `Kingshot Atlas \u2022 Redeemed ${timestamp} UTC` });

  return interaction.editReply({ embeds: [finalEmbed] });
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
  handleRedeem,
};
