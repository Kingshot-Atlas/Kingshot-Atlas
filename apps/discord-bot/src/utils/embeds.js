/**
 * Embed Builder Utilities
 * Creates visually appealing Discord embeds following brand guidelines
 */

const { EmbedBuilder } = require('discord.js');
const config = require('../config');

/**
 * Get tier from Atlas Score
 * IMPORTANT: Keep in sync with apps/web/src/types/index.ts POWER_TIER_THRESHOLDS
 */
function getTier(score) {
  if (score >= 57) return 'S';  // Top 2.9%: Score 57+ (v3.1, 0-100 scale)
  if (score >= 47) return 'A';  // Top 9.6%: Score 47-56.99
  if (score >= 38) return 'B';  // Top 24.3%: Score 38-46.99
  if (score >= 29) return 'C';  // Top 48.9%: Score 29-37.99
  return 'D';                   // Bottom 51.1%: Score below 29
}

/**
 * Get color for tier
 */
function getTierColor(tier) {
  return config.tierColors[tier] || config.colors.primary;
}

/**
 * Get tier emoji
 */
function getTierEmoji(tier) {
  const emojis = {
    S: '🏆',
    A: '⭐',
    B: '🔷',
    C: '⚪',
    D: '⬜',
  };
  return emojis[tier] || '⬜';
}

/**
 * Format win rate as percentage
 */
function formatWinRate(rate) {
  if (rate === null || rate === undefined) return 'N/A';
  return `${Math.round(rate * 100)}%`;
}

/**
 * Format record (W-L)
 */
function formatRecord(wins, losses) {
  return `${wins}W - ${losses}L`;
}

/**
 * Create a progress bar
 */
function createProgressBar(value, max = 100, length = 10) {
  const filled = Math.round((value / max) * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Calculate dominations (double wins) from recent_kvks
 */
function calculateDominations(recentKvks) {
  if (!recentKvks || !Array.isArray(recentKvks)) return 0;
  return recentKvks.filter(kvk => 
    kvk.overall_result === 'Win' || 
    (kvk.prep_result === 'W' && kvk.battle_result === 'W')
  ).length;
}

/**
 * Calculate invasions (double losses) from recent_kvks
 */
function calculateInvasions(recentKvks) {
  if (!recentKvks || !Array.isArray(recentKvks)) return 0;
  return recentKvks.filter(kvk => 
    kvk.overall_result === 'Loss' || 
    (kvk.prep_result === 'L' && kvk.battle_result === 'L')
  ).length;
}

/**
 * Create kingdom stats embed
 */
function createKingdomEmbed(kingdom) {
  const tier = getTier(kingdom.overall_score);
  const dominations = calculateDominations(kingdom.recent_kvks);
  const invasions = calculateInvasions(kingdom.recent_kvks);
  const rankDisplay = kingdom.rank ? ` (Rank #${kingdom.rank})` : '';

  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle(`🏰 Kingdom ${kingdom.kingdom_number}${rankDisplay}`)
    .setURL(config.urls.kingdom(kingdom.kingdom_number))
    .setDescription(`💎 Atlas Score: **${kingdom.overall_score.toFixed(1)}** • ${tier}-Tier`)
    .addFields(
      {
        name: '📊 Overall Stats',
        value: [
          `**Total KvKs:** ${kingdom.total_kvks}`,
          `**Dominations:** ${dominations} 👑`,
          `**Invasions:** ${invasions} 💀`,
        ].join('\n'),
        inline: true,
      },
      {
        name: '🛡️ Prep Phase',
        value: [
          `**Record:** ${formatRecord(kingdom.prep_wins, kingdom.prep_losses)}`,
          `**Win Rate:** ${formatWinRate(kingdom.prep_win_rate)}`,
          `${createProgressBar(kingdom.prep_win_rate * 100)}`,
        ].join('\n'),
        inline: true,
      },
      {
        name: '⚔️ Battle Phase',
        value: [
          `**Record:** ${formatRecord(kingdom.battle_wins, kingdom.battle_losses)}`,
          `**Win Rate:** ${formatWinRate(kingdom.battle_win_rate)}`,
          `${createProgressBar(kingdom.battle_win_rate * 100)}`,
        ].join('\n'),
        inline: true,
      }
    )
    .addFields({
      name: '\u200b',
      value: `[📊 View full stats on ks-atlas.com](${config.urls.kingdom(kingdom.kingdom_number)})`,
    })
    .setFooter({ text: config.bot.footerText })
    .setTimestamp();

  return embed;
}

/**
 * Create comparison embed
 */
function createCompareEmbed(k1, k2) {
  const tier1 = getTier(k1.overall_score);
  const tier2 = getTier(k2.overall_score);
  const doms1 = calculateDominations(k1.recent_kvks);
  const doms2 = calculateDominations(k2.recent_kvks);
  const invs1 = calculateInvasions(k1.recent_kvks);
  const invs2 = calculateInvasions(k2.recent_kvks);

  // Determine winner indicators (higher is better)
  const better = (a, b) => a > b ? '✅' : a < b ? '❌' : '➖';
  // For invasions, lower is better
  const betterLow = (a, b) => a < b ? '✅' : a > b ? '❌' : '➖';

  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle(`⚖️ Kingdom ${k1.kingdom_number} vs Kingdom ${k2.kingdom_number}`)
    .setURL(config.urls.compare(k1.kingdom_number, k2.kingdom_number))
    .addFields(
      {
        name: `🏰 K${k1.kingdom_number}`,
        value: [
          `⚔️ **KvKs:** ${k1.total_kvks}`,
          `${better(k1.overall_score, k2.overall_score)} **Score:** ${k1.overall_score.toFixed(1)} (${tier1})`,
          `${better(k1.prep_win_rate, k2.prep_win_rate)} **Prep:** ${formatWinRate(k1.prep_win_rate)}`,
          `${better(k1.battle_win_rate, k2.battle_win_rate)} **Battle:** ${formatWinRate(k1.battle_win_rate)}`,
          `${better(doms1, doms2)} **Dominations:** ${doms1}`,
          `${betterLow(invs1, invs2)} **Invasions:** ${invs1}`,
        ].join('\n'),
        inline: true,
      },
      {
        name: `🏰 K${k2.kingdom_number}`,
        value: [
          `⚔️ **KvKs:** ${k2.total_kvks}`,
          `${better(k2.overall_score, k1.overall_score)} **Score:** ${k2.overall_score.toFixed(1)} (${tier2})`,
          `${better(k2.prep_win_rate, k1.prep_win_rate)} **Prep:** ${formatWinRate(k2.prep_win_rate)}`,
          `${better(k2.battle_win_rate, k1.battle_win_rate)} **Battle:** ${formatWinRate(k2.battle_win_rate)}`,
          `${better(doms2, doms1)} **Dominations:** ${doms2}`,
          `${betterLow(invs2, invs1)} **Invasions:** ${invs2}`,
        ].join('\n'),
        inline: true,
      }
    )
    .addFields({
      name: '\u200b',
      value: `[🔀 Compare more kingdoms on ks-atlas.com](${config.urls.compare(k1.kingdom_number, k2.kingdom_number)})`,
    })
    .setFooter({ text: `${config.bot.footerText} • ✅ = Better` })
    .setTimestamp();

  return embed;
}

/**
 * Create leaderboard embed
 */
function createRankingsEmbed(kingdoms, title = '\ud83c\udfc6 Atlas Rankings') {
  const medals = ['\ud83e\udd47', '\ud83e\udd48', '\ud83e\udd49'];

  const rankingsText = kingdoms.map((k, i) => {
    const medal = medals[i] || `\`${(i + 1).toString().padStart(2, ' ')}.\``;
    const tier = getTier(k.overall_score);
    return `${medal} **K${k.kingdom_number}** \u2022 ${k.overall_score.toFixed(1)} pts \u2022 Tier ${tier}`;
  }).join('\n');

  const embed = new EmbedBuilder()
    .setColor(config.colors.gold)
    .setTitle(title)
    .setURL(config.urls.rankings)
    .setDescription(rankingsText || 'No kingdoms found.')
    .addFields({
      name: '\u200b',
      value: `[\ud83c\udfc6 View full rankings on ks-atlas.com](${config.urls.rankings})`,
    })
    .setFooter({ text: `${config.bot.footerText} \u2022 Based on Atlas Score` })
    .setTimestamp();

  return embed;
}

/**
 * Create tier list embed — 2-column layout, 10 kingdoms per page
 */
function createTierEmbed(tier, kingdoms) {
  const tierEmoji = getTierEmoji(tier);
  const tierDescriptions = {
    S: 'Elite kingdoms with exceptional track records',
    A: 'Strong performers with consistent results',
    B: 'Solid kingdoms with room to grow',
    C: 'Developing kingdoms building their legacy',
    D: 'New or struggling kingdoms',
  };

  const pageSize = 10;
  const page = kingdoms.slice(0, pageSize);

  // Format a single row: rank + full kingdom name + right-aligned score
  const formatRow = (k, idx) => {
    const rank = (idx + 1).toString().padStart(2, ' ');
    const name = `Kingdom ${k.kingdom_number}`;
    const score = k.overall_score.toFixed(1);
    // Pad between name and score so score is right-aligned (total ~22 chars)
    const padLen = Math.max(1, 22 - rank.length - 2 - name.length - score.length);
    return `${rank}. ${name}${' '.repeat(padLen)}${score}`;
  };

  const half = Math.ceil(page.length / 2);
  const col1 = page.slice(0, half);
  const col2 = page.slice(half);

  const col1Text = col1.length > 0
    ? '```\n' + col1.map((k, i) => formatRow(k, i)).join('\n') + '\n```'
    : 'No kingdoms.';
  const col2Text = col2.length > 0
    ? '```\n' + col2.map((k, i) => formatRow(k, i + half)).join('\n') + '\n```'
    : '\u200b';

  const embed = new EmbedBuilder()
    .setColor(getTierColor(tier))
    .setTitle(`${tierEmoji} Tier ${tier} Kingdoms`)
    .setDescription(tierDescriptions[tier] || '')
    .addFields(
      { name: '\u200b', value: col1Text, inline: true },
      { name: '\u200b', value: col2Text, inline: true },
      {
        name: '\u200b',
        value: `[\ud83c\udfc6 View full rankings on ks-atlas.com](${config.urls.rankings})`,
      }
    )
    .setFooter({ text: `${config.bot.footerText} • Showing ${page.length} of ${kingdoms.length}` })
    .setTimestamp();

  return embed;
}

/**
 * Create upcoming events embed
 */
function createUpcomingEmbed(events) {
  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle('📅 Upcoming Events');

  if (events.kvk) {
    const kvkValue = [
      `📆 **${events.kvk.startDate}**`,
      `⏳ **${events.kvk.daysUntil}** days away`,
      events.kvk.phase ? `⚔️ Currently: **${events.kvk.phase}**` : '',
    ].filter(Boolean).join('\n');

    embed.addFields({
      name: '⚔️ Next KvK',
      value: kvkValue,
      inline: true,
    });
  }

  if (events.transfer) {
    const transferValue = [
      `📆 **${events.transfer.startDate}**`,
      `⏳ **${events.transfer.daysUntil}** days away`,
      events.transfer.phase ? `🔄 Currently: **${events.transfer.phase}**` : '',
    ].filter(Boolean).join('\n');

    embed.addFields({
      name: '🔄 Next Transfer Event',
      value: transferValue,
      inline: true,
    });
  }

  embed.addFields({
    name: '\u200b',
    value: `[\ud83d\udcc5 View event schedule on ks-atlas.com](${config.urls.base})`,
  })
  .setFooter({ text: config.bot.footerText })
  .setTimestamp();

  return embed;
}

/**
 * Create help embed
 */
function createHelpEmbed() {
  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle('📖 Atlas Commands')
    .setDescription(`*${config.bot.tagline}*`)
    .addFields(
      {
        name: '🔍 Lookup Commands',
        value: [
          '`/kingdom <number>` - Get kingdom stats',
          '`/compare <k1> <k2>` - Compare two kingdoms',
          '`/history <number>` - KvK season history',
          '`/predict <k1> <k2>` - Matchup prediction',
          '`/tier <S|A|B|C|D>` - List kingdoms by tier',
        ].join('\n'),
      },
      {
        name: '📊 Rankings & Events',
        value: [
          '`/rankings` - Top 10 kingdoms by Atlas Score',
          '`/countdownkvk` - Time until next KvK',
          '`/countdowntransfer` - Time until next Transfer Event',
        ].join('\n'),
      },
      {
        name: '⚔️ Battle Tools',
        value: '`/multirally <target> <players>` - Coordinate rally timing',
      },
      {
        name: '🌐 Links',
        value: [
          `[Website](${config.urls.base})`,
          `[Rankings](${config.urls.rankings})`,
          `[Changelog](${config.urls.changelog})`,
        ].join(' • '),
      },
      {
        name: '⭐ Atlas Supporter',
        value: [
          '**Unlock premium features:**',
          '• Historical trends & predictions',
          '• Matchup win probabilities',
          '• Advanced analytics',
          `[Upgrade Now](${config.premium.ctaUrl})`,
        ].join('\n'),
      }
    )
    .setFooter({ text: config.bot.footerText })
    .setTimestamp();

  return embed;
}

/**
 * Create patch notes embed
 */
function createPatchNotesEmbed(patchNotes) {
  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle(`📢 Kingshot Atlas Update — ${patchNotes.date}`)
    .setURL(config.urls.changelog);

  if (patchNotes.new && patchNotes.new.length > 0) {
    embed.addFields({
      name: '✨ New',
      value: patchNotes.new.map(item => `• ${item}`).join('\n'),
    });
  }

  if (patchNotes.fixed && patchNotes.fixed.length > 0) {
    embed.addFields({
      name: '🐛 Fixed',
      value: patchNotes.fixed.map(item => `• ${item}`).join('\n'),
    });
  }

  if (patchNotes.improved && patchNotes.improved.length > 0) {
    embed.addFields({
      name: '🔧 Improved',
      value: patchNotes.improved.map(item => `• ${item}`).join('\n'),
    });
  }

  embed.addFields(
    {
      name: '📖 Full Notes',
      value: `[View on website](${config.urls.changelog})`,
    },
    {
      name: '\u200b',
      value: `💬 Love these updates? [Support development](${config.premium.ctaUrl})`,
    }
  );

  embed.setFooter({ text: config.bot.footerText })
    .setTimestamp();

  return embed;
}

/**
 * Create error embed
 */
function createErrorEmbed(message, details = null) {
  const embed = new EmbedBuilder()
    .setColor(config.colors.error)
    .setTitle('❌ Error')
    .setDescription(message);

  if (details) {
    embed.addFields({ name: 'Details', value: details });
  }

  embed.setFooter({ text: config.bot.footerText })
    .setTimestamp();

  return embed;
}

/**
 * Create countdown embed (generic for KvK and Transfer)
 */
function createCountdownEmbed(event, timeRemaining, type = 'kvk') {
  const isKvk = type === 'kvk';
  const label = isKvk ? 'KvK' : 'Transfer Event';

  const embed = new EmbedBuilder()
    .setColor(config.colors.primary);

  if (event.isActive) {
    embed.setTitle(`${label} Countdown`)
      .setDescription(`⚔️ **${event.phase}** is happening now!\n\n\`\`\`\n${timeRemaining}\n\`\`\``);
  } else {
    embed.setTitle(`${label} Countdown`)
      .setDescription(`📆 **Start Date:** ${event.startDate}\n\n\`\`\`\n${timeRemaining}\n\`\`\``);
  }

  embed.addFields({
    name: '\u200b',
    value: `[\u23f3 View event schedule on ks-atlas.com](${config.urls.base})`,
  })
  .setFooter({ text: config.bot.footerText })
  .setTimestamp();

  return embed;
}

/**
 * Create a base embed with default styling
 */
function createBaseEmbed() {
  return new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTimestamp();
}

/**
 * Create daily update embed for automated patch notes
 * Posted at 02:00 UTC daily
 */
function createDailyUpdateEmbed(content) {
  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle(`📢 Atlas Daily Update — ${content.date}`)
    .setDescription(content.highlight 
      ? `🎯 **Today's Highlight:** ${content.highlight}`
      : '*Building something great. Stay tuned.*'
    );

  // New features
  if (content.newFeatures && content.newFeatures.length > 0) {
    embed.addFields({
      name: '✨ What\'s New',
      value: content.newFeatures.map(f => `• ${f}`).join('\n'),
    });
  }

  // Improvements
  if (content.improvements && content.improvements.length > 0) {
    embed.addFields({
      name: '🔧 Improved',
      value: content.improvements.map(f => `• ${f}`).join('\n'),
    });
  }

  // Bug fixes
  if (content.fixes && content.fixes.length > 0) {
    embed.addFields({
      name: '🐛 Fixed',
      value: content.fixes.map(f => `• ${f}`).join('\n'),
    });
  }

  // Coming soon teaser
  if (content.comingSoon && content.comingSoon.length > 0) {
    embed.addFields({
      name: '🔮 Coming Soon',
      value: content.comingSoon.map(f => `• ${f}`).join('\n'),
    });
  }

  // Stats footer
  if (content.stats && content.stats.changesCount > 0) {
    embed.addFields({
      name: '\u200b',
      value: `📊 *${content.stats.changesCount} changes today${content.stats.focusArea ? ` • Focus: ${content.stats.focusArea}` : ''}*`,
    });
  }

  embed
    .setFooter({ text: `${config.bot.footerText} • Daily at 02:00 UTC` })
    .setTimestamp()
    .setURL(config.urls.changelog);

  return embed;
}

/**
 * Create Castle Battle START embed
 * Posted at 12:00 UTC on KvK Saturday when the core competitive window begins
 */
function createCastleBattleStartEmbed(kvkNumber) {
  const embed = new EmbedBuilder()
    .setColor(config.colors.red || '#dc2626')
    .setTitle(`🏰 KvK #${kvkNumber} CASTLE BATTLE HAS BEGUN!`)
    .setDescription('**The core competitive window is NOW LIVE!**')
    .addFields(
      {
        name: '⏰ Castle Battle Window',
        value: [
          '**12:00 - 18:00 UTC** (6 hours)',
          '',
          'This is it! The kingdom that wins Castle Battle wins the KvK.',
          'Rally your alliance and fight for victory!',
        ].join('\n'),
      },
      {
        name: '📊 Know Your Enemy',
        value: `**[Check opponent stats →](${config.urls.base})**`,
      }
    )
    .setFooter({ text: config.bot.footerText })
    .setTimestamp();

  return embed;
}

/**
 * Create KvK Castle Battle end embed
 * Posted at 18:00 UTC on KvK Saturday to prompt data submission
 */
function createKvkBattleEndEmbed(kvkNumber) {
  const embed = new EmbedBuilder()
    .setColor(config.colors.gold)
    .setTitle(`⚔️ KvK #${kvkNumber} Castle Battle is Over!`)
    .setDescription('**The dust has settled. Time to record history.**')
    .addFields(
      {
        name: '📊 Submit Your Results',
        value: [
          `**[→ Submit Now](${config.urls.base})**`,
          '',
          'Report your Prep & Battle results so we can update the rankings.',
        ].join('\n'),
      },
      {
        name: '\u200b',
        value: `**Real data. Real results.** [ks-atlas.com](${config.urls.base})`,
      }
    )
    .setFooter({ text: config.bot.footerText })
    .setTimestamp();

  return embed;
}

/**
 * Create KvK reminder embed with premium CTA
 * Used for automated 24h pre-KvK announcements
 */
function createKvkReminderEmbed(kvkNumber, hoursUntil = 24) {
  const embed = new EmbedBuilder()
    .setColor(config.colors.orange)
    .setTitle(`⚔️ KvK #${kvkNumber} starts in ${hoursUntil} hours!`)
    .setDescription('Time to scout your opponents and plan your strategy.')
    .addFields(
      {
        name: '📊 Free',
        value: [
          '• Check kingdom stats with `/kingdom`',
          '• Compare matchups with `/compare`',
          '• View the leaderboard',
        ].join('\n'),
        inline: true,
      },
      {
        name: '🔓 Atlas Supporter',
        value: [
          '• Matchup win probabilities',
          '• Historical performance trends',
          '• Advanced predictions',
        ].join('\n'),
        inline: true,
      },
      {
        name: '\u200b',
        value: `**Don't go in blind.** [Become a Supporter →](${config.premium.ctaUrl})`,
      }
    )
    .setFooter({ text: config.bot.footerText })
    .setTimestamp();

  return embed;
}

/**
 * Create premium showcase embed
 * Used for #premium-showcase channel to demonstrate Pro features
 */
function createPremiumShowcaseEmbed(showcaseData) {
  const embed = new EmbedBuilder()
    .setColor(config.colors.gold)
    .setTitle(`🔮 Premium Insight — ${showcaseData.title}`)
    .setDescription(showcaseData.teaser);

  if (showcaseData.preview) {
    embed.addFields({
      name: '👀 Sneak Peek',
      value: showcaseData.preview,
    });
  }

  embed.addFields({
    name: '\u200b',
    value: [
      '**Atlas Supporter members saw this first.**',
      '',
      `[Unlock Premium Features →](${config.premium.ctaUrl})`,
    ].join('\n'),
  });

  embed.setFooter({ text: `${config.bot.footerText} • Premium Preview` })
    .setTimestamp();

  return embed;
}

/**
 * Welcome message variations - keeps things fresh
 */
const welcomeVariations = [
  {
    title: 'Welcome to Kingshot Atlas! 🏰',
    greeting: (name) => `Hey ${name}! **Stop guessing. Start winning.**`,
    tagline: "We're a community of competitive players who make decisions with data, not rumors.",
    footer: 'Built by Kingdom 172 — Data-driven dominance.'
  },
  {
    title: 'A New Challenger Appears! ⚔️',
    greeting: (name) => `${name} has entered the arena. **Ready to dominate?**`,
    tagline: 'Here, we turn data into victories. No more blind decisions.',
    footer: 'Know your enemy. Choose your allies. Dominate KvK.'
  },
  {
    title: 'Welcome, Strategist! 🎯',
    greeting: (name) => `${name}, you've found the right place. **Real data. Real results.**`,
    tagline: "Tired of Discord rumors? We deal in facts, not hearsay.",
    footer: 'No more blind migrations. Just wins.'
  },
  {
    title: 'The Atlas Awaits! 🗺️',
    greeting: (name) => `${name} joins the ranks. **Time to level up your game.**`,
    tagline: 'Every kingdom. Every stat. Every advantage you need.',
    footer: 'Data-driven dominance starts here.'
  },
  {
    title: 'New Recruit Spotted! 👀',
    greeting: (name) => `${name} is here. **Let's get you winning.**`,
    tagline: 'We built the tool we wished existed. Now it\'s yours.',
    footer: 'By players, for players.'
  }
];

/**
 * Create welcome embed for new members with varied messages
 */
function createWelcomeEmbed(memberName) {
  // Pick a random variation
  const variation = welcomeVariations[Math.floor(Math.random() * welcomeVariations.length)];
  
  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle(variation.title)
    .setDescription([
      variation.greeting(memberName),
      '',
      variation.tagline,
    ].join('\n'))
    .addFields(
      {
        name: '🚀 Quick Start',
        value: [
          '• Check out #rules',
          '• Try `/kingdom YOUR_NUMBER`',
          '• Browse [ks-atlas.com](https://ks-atlas.com)',
        ].join('\n'),
        inline: true,
      },
      {
        name: '💬 Join In',
        value: [
          '• Chat in #general',
          '• Ideas → #suggestions',
          '• Bugs → #bugs',
        ].join('\n'),
        inline: true,
      }
    )
    .setFooter({ text: variation.footer })
    .setTimestamp();

  return embed;
}

/**
 * Create KvK history embed for a kingdom
 */
function createHistoryEmbed(kingdom, page = 1) {
  const kvks = kingdom.recent_kvks || [];

  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle(`\ud83d\udcdc Kingdom ${kingdom.kingdom_number} - KvK History`)
    .setURL(config.urls.kingdom(kingdom.kingdom_number));

  if (kvks.length === 0) {
    embed.setDescription('No KvK history recorded yet.');
  } else {
    const resultEmoji = (r) => r === 'W' ? '\u2705' : r === 'L' ? '\u274c' : '\u2796';

    // Sort by kvk_number descending (most recent first)
    const sorted = [...kvks].sort((a, b) => (b.kvk_number || b.order_index) - (a.kvk_number || a.order_index));

    // Paginate: 10 per page
    const perPage = 10;
    const totalPages = Math.ceil(sorted.length / perPage);
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const pageItems = sorted.slice((safePage - 1) * perPage, safePage * perPage);

    // Build two-column layout
    const matchups = pageItems.map((kvk) => {
      const num = kvk.kvk_number ? `KvK #${kvk.kvk_number}` : `#${kvk.order_index}`;
      const opponent = kvk.opponent_kingdom ? `vs K${kvk.opponent_kingdom}` : '';
      return `\u2796 **${num}** ${opponent}`;
    });

    const results = pageItems.map((kvk) => {
      const prep = resultEmoji(kvk.prep_result);
      const battle = resultEmoji(kvk.battle_result);
      return `Prep: ${prep}  Battle: ${battle}`;
    });

    embed.addFields(
      {
        name: 'Matchup',
        value: matchups.join('\n'),
        inline: true,
      },
      {
        name: 'Result',
        value: results.join('\n'),
        inline: true,
      }
    );

    if (totalPages > 1) {
      embed.setDescription(`Page ${safePage} of ${totalPages}`);
    }
  }

  embed.addFields({
    name: '\u200b',
    value: `[\ud83d\udcdc View full history on ks-atlas.com](${config.urls.kingdom(kingdom.kingdom_number)})`,
  })
  .setFooter({ text: config.bot.footerText })
  .setTimestamp();

  return embed;
}

/**
 * Predict outcome emoji
 */
function getOutcomeEmoji(outcome) {
  const emojis = {
    Domination: '\ud83d\udc51',
    Comeback: '\ud83d\udcaa',
    Reversal: '\ud83d\udd04',
    Invasion: '\ud83d\udc80',
  };
  return emojis[outcome] || '';
}

/**
 * Create matchup prediction embed
 */
function createPredictEmbed(k1, k2) {
  const tier1 = getTier(k1.overall_score);
  const tier2 = getTier(k2.overall_score);

  // Use direct counts from kingdom data (source of truth)
  const doms1 = k1.dominations || 0;
  const doms2 = k2.dominations || 0;
  const inv1 = k1.invasions || 0;
  const inv2 = k2.invasions || 0;

  // Win rates (already 0-1)
  const p1 = k1.prep_win_rate || 0;
  const p2 = k2.prep_win_rate || 0;
  const b1 = k1.battle_win_rate || 0;
  const b2 = k2.battle_win_rate || 0;

  // Head-to-head phase win chances (both 0 → 50/50)
  const prepChance1 = (p1 === 0 && p2 === 0) ? 50 : Math.round((p1 / (p1 + p2)) * 100);
  const prepChance2 = 100 - prepChance1;
  const battleChance1 = (b1 === 0 && b2 === 0) ? 50 : Math.round((b1 / (b1 + b2)) * 100);
  const battleChance2 = 100 - battleChance1;

  // Predict most likely outcome per kingdom
  function predictOutcome(prepPct, battlePct) {
    const pW = prepPct / 100;
    const bW = battlePct / 100;
    const outcomes = {
      Domination: pW * bW,
      Reversal: pW * (1 - bW),
      Comeback: (1 - pW) * bW,
      Invasion: (1 - pW) * (1 - bW),
    };
    return Object.entries(outcomes).reduce((a, b) => a[1] > b[1] ? a : b)[0];
  }

  const outcome1 = predictOutcome(prepChance1, battleChance1);
  const outcome2 = predictOutcome(prepChance2, battleChance2);

  // Determine favorite based on weighted composite (v3.1 scale: 0-100)
  const scoreWeight = 0.40;
  const prepWeight = 0.25;
  const battleWeight = 0.25;
  const domWeight = 0.10;
  const s1 = (k1.overall_score || 0) / 100;
  const s2 = (k2.overall_score || 0) / 100;
  const d1 = k1.total_kvks > 0 ? doms1 / k1.total_kvks : 0;
  const d2 = k2.total_kvks > 0 ? doms2 / k2.total_kvks : 0;
  const composite1 = (s1 * scoreWeight) + (p1 * prepWeight) + (b1 * battleWeight) + (d1 * domWeight);
  const composite2 = (s2 * scoreWeight) + (p2 * prepWeight) + (b2 * battleWeight) + (d2 * domWeight);
  const compTotal = composite1 + composite2 || 1;
  const favProb = Math.round((Math.max(composite1, composite2) / compTotal) * 100);
  const favoriteNum = composite1 >= composite2 ? k1.kingdom_number : k2.kingdom_number;

  // Confidence label
  let confidence;
  if (favProb >= 75) confidence = '\ud83d\udd25 Strong Favorite';
  else if (favProb >= 60) confidence = '\u2694\ufe0f Slight Edge';
  else confidence = '\u2696\ufe0f Coin Flip';

  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle(`\ud83d\udd2e Prediction: Kingdom ${k1.kingdom_number} vs Kingdom ${k2.kingdom_number}`)
    .setURL(config.urls.compare(k1.kingdom_number, k2.kingdom_number))
    .setDescription(`${confidence} \u2014 **Kingdom ${favoriteNum}** is favored\n\u200b`)
    .addFields(
      {
        name: `\ud83c\udff0 Kingdom ${k1.kingdom_number} (${tier1})`,
        value: [
          `\ud83d\udc8e Atlas Score: ${k1.overall_score.toFixed(1)}`,
          `\ud83d\udee1\ufe0f Prep WR: ${formatWinRate(k1.prep_win_rate)}`,
          `\u2694\ufe0f Battle WR: ${formatWinRate(k1.battle_win_rate)}`,
          `\ud83d\udc51 Dominations: ${doms1}`,
          `\ud83d\udc80 Invasions: ${inv1}`,
          '',
          `Prep W chance: ${prepChance1}%`,
          `Battle W chance: ${battleChance1}%`,
          `Outcome: ${getOutcomeEmoji(outcome1)} ${outcome1}`,
          '',
          '\u2500'.repeat(18),
        ].join('\n'),
        inline: true,
      },
      {
        name: `\ud83c\udff0 Kingdom ${k2.kingdom_number} (${tier2})`,
        value: [
          `\ud83d\udc8e Atlas Score: ${k2.overall_score.toFixed(1)}`,
          `\ud83d\udee1\ufe0f Prep WR: ${formatWinRate(k2.prep_win_rate)}`,
          `\u2694\ufe0f Battle WR: ${formatWinRate(k2.battle_win_rate)}`,
          `\ud83d\udc51 Dominations: ${doms2}`,
          `\ud83d\udc80 Invasions: ${inv2}`,
          '',
          `Prep W chance: ${prepChance2}%`,
          `Battle W chance: ${battleChance2}%`,
          `Outcome: ${getOutcomeEmoji(outcome2)} ${outcome2}`,
        ].join('\n'),
        inline: true,
      }
    )
    .addFields({
      name: '\u200b',
      value: `[\ud83d\udd00 Full comparison on ks-atlas.com](${config.urls.compare(k1.kingdom_number, k2.kingdom_number)})`,
    })
    .setFooter({ text: `${config.bot.footerText} \u2022 Data-driven estimate, not a crystal ball. KvK is won on the battlefield.` })
    .setTimestamp();

  return embed;
}

/**
 * Create /multirally upsell embed
 * Shown when free users exhaust their daily credits
 */
function createMultirallyUpsellEmbed() {
  return new EmbedBuilder()
    .setColor(config.colors.gold)
    .setTitle('\u2694\ufe0f Daily Rally Credits Used')
    .setDescription([
      "You've used all **3 free** `/multirally` uses for today.",
      '',
      '**Atlas Supporters** get **unlimited** rally coordination \u2014 plus every other premium feature.',
      '',
      `[Become a Supporter \u2192](${config.premium.ctaUrl})`,
    ].join('\n'))
    .addFields({
      name: '\u200b',
      value: '\u23f0 Your free credits reset at midnight UTC.',
    })
    .setFooter({ text: config.bot.footerText })
    .setTimestamp();
}

module.exports = {
  getTier,
  getTierColor,
  getTierEmoji,
  formatWinRate,
  formatRecord,
  createProgressBar,
  createBaseEmbed,
  createKingdomEmbed,
  createCompareEmbed,
  createRankingsEmbed,
  createTierEmbed,
  createUpcomingEmbed,
  createHelpEmbed,
  createPatchNotesEmbed,
  createErrorEmbed,
  createCountdownEmbed,
  createKvkReminderEmbed,
  createCastleBattleStartEmbed,
  createKvkBattleEndEmbed,
  createPremiumShowcaseEmbed,
  createWelcomeEmbed,
  createDailyUpdateEmbed,
  createHistoryEmbed,
  createPredictEmbed,
  createMultirallyUpsellEmbed,
};
