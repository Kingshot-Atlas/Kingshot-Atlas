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
  if (score >= 8.90) return 'S';  // Top 3%: Score 8.90+
  if (score >= 7.79) return 'A';  // Top 10%: Score 7.79-8.89
  if (score >= 6.42) return 'B';  // Top 25%: Score 6.42-7.78
  if (score >= 4.72) return 'C';  // Top 50%: Score 4.72-6.41
  return 'D';                     // Bottom 50%: Score below 4.72
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
 * Create kingdom stats embed
 */
function createKingdomEmbed(kingdom) {
  const tier = getTier(kingdom.overall_score);
  const tierEmoji = getTierEmoji(tier);
  const dominations = calculateDominations(kingdom.recent_kvks);
  const rankDisplay = kingdom.rank ? ` (Rank #${kingdom.rank})` : '';

  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle(`🏰 Kingdom ${kingdom.kingdom_number}${rankDisplay}`)
    .setURL(config.urls.kingdom(kingdom.kingdom_number))
    .setDescription(`${tierEmoji} **Tier ${tier}** • Atlas Score: **${kingdom.overall_score.toFixed(1)}**`)
    .addFields(
      {
        name: '📊 Overall Stats',
        value: [
          `**Total KvKs:** ${kingdom.total_kvks}`,
          `**Status:** ${kingdom.most_recent_status || 'Unknown'}`,
          `**Dominations:** ${dominations} 👑`,
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

  // Determine winner indicators
  const scoreWinner = k1.overall_score > k2.overall_score ? '✅' : k1.overall_score < k2.overall_score ? '❌' : '➖';
  const scoreWinner2 = k2.overall_score > k1.overall_score ? '✅' : k2.overall_score < k1.overall_score ? '❌' : '➖';

  const prepWinner = k1.prep_win_rate > k2.prep_win_rate ? '✅' : k1.prep_win_rate < k2.prep_win_rate ? '❌' : '➖';
  const prepWinner2 = k2.prep_win_rate > k1.prep_win_rate ? '✅' : k2.prep_win_rate < k1.prep_win_rate ? '❌' : '➖';

  const battleWinner = k1.battle_win_rate > k2.battle_win_rate ? '✅' : k1.battle_win_rate < k2.battle_win_rate ? '❌' : '➖';
  const battleWinner2 = k2.battle_win_rate > k1.battle_win_rate ? '✅' : k2.battle_win_rate < k1.battle_win_rate ? '❌' : '➖';

  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle(`⚔️ Kingdom ${k1.kingdom_number} vs Kingdom ${k2.kingdom_number}`)
    .setURL(config.urls.compare(k1.kingdom_number, k2.kingdom_number))
    .addFields(
      {
        name: `🏰 K${k1.kingdom_number}`,
        value: [
          `${scoreWinner} **Score:** ${k1.overall_score.toFixed(1)} (${tier1})`,
          `${prepWinner} **Prep:** ${formatWinRate(k1.prep_win_rate)}`,
          `${battleWinner} **Battle:** ${formatWinRate(k1.battle_win_rate)}`,
          `📈 **KvKs:** ${k1.total_kvks}`,
        ].join('\n'),
        inline: true,
      },
      {
        name: '⚡',
        value: '\n\nvs\n\n',
        inline: true,
      },
      {
        name: `🏰 K${k2.kingdom_number}`,
        value: [
          `${scoreWinner2} **Score:** ${k2.overall_score.toFixed(1)} (${tier2})`,
          `${prepWinner2} **Prep:** ${formatWinRate(k2.prep_win_rate)}`,
          `${battleWinner2} **Battle:** ${formatWinRate(k2.battle_win_rate)}`,
          `📈 **KvKs:** ${k2.total_kvks}`,
        ].join('\n'),
        inline: true,
      }
    )
    .addFields({
      name: '\u200b',
      value: `[� Compare more kingdoms on ks-atlas.com](${config.urls.compare(k1.kingdom_number, k2.kingdom_number)})`,
    })
    .setFooter({ text: `${config.bot.footerText} • ✅ = Better` })
    .setTimestamp();

  return embed;
}

/**
 * Create leaderboard embed
 */
function createLeaderboardEmbed(kingdoms, title = '🏆 Atlas Leaderboard') {
  const medals = ['🥇', '🥈', '🥉'];

  const leaderboardText = kingdoms.map((k, i) => {
    const medal = medals[i] || `\`${(i + 1).toString().padStart(2, ' ')}.\``;
    const tier = getTier(k.overall_score);
    return `${medal} **K${k.kingdom_number}** • ${k.overall_score.toFixed(1)} pts • Tier ${tier}`;
  }).join('\n');

  const embed = new EmbedBuilder()
    .setColor(config.colors.gold)
    .setTitle(title)
    .setURL(config.urls.leaderboard)
    .setDescription(leaderboardText || 'No kingdoms found.')
    .addFields({
      name: '\u200b',
      value: `[� View full leaderboard on ks-atlas.com](${config.urls.leaderboard})`,
    })
    .setFooter({ text: `${config.bot.footerText} • Based on Atlas Score` })
    .setTimestamp();

  return embed;
}

/**
 * Create tier list embed
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

  const kingdomList = kingdoms.slice(0, 15).map((k, i) => {
    return `\`${(i + 1).toString().padStart(2, ' ')}.\` **K${k.kingdom_number}** • ${k.overall_score.toFixed(1)} pts`;
  }).join('\n');

  const embed = new EmbedBuilder()
    .setColor(getTierColor(tier))
    .setTitle(`${tierEmoji} Tier ${tier} Kingdoms`)
    .setDescription(tierDescriptions[tier] || '')
    .addFields({
      name: `${kingdoms.length} Kingdoms`,
      value: kingdomList || 'No kingdoms in this tier.',
    })
    .setFooter({ text: config.bot.footerText })
    .setTimestamp();

  return embed;
}

/**
 * Create upcoming events embed
 */
function createUpcomingEmbed(events) {
  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle('📅 Upcoming Events')
    .setDescription(config.bot.tagline);

  if (events.kvk) {
    const kvkValue = [
      `📆 **${events.kvk.startDate}**`,
      `⏰ **${events.kvk.daysUntil}** days away`,
      `🔢 KvK #${events.kvk.number}`,
      events.kvk.phase ? `📍 Currently: **${events.kvk.phase}**` : '',
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
      `⏰ **${events.transfer.daysUntil}** days away`,
      `🔢 Transfer Event #${events.transfer.number}`,
      events.transfer.phase ? `📍 Currently: **${events.transfer.phase}**` : '',
    ].filter(Boolean).join('\n');

    embed.addFields({
      name: '🚀 Next Transfer Event',
      value: transferValue,
      inline: true,
    });
  }

  embed.setFooter({ text: config.bot.footerText })
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
          '`/tier <S|A|B|C|D>` - List kingdoms by tier',
          '`/random` - Discover a random kingdom',
        ].join('\n'),
      },
      {
        name: '📊 Rankings',
        value: [
          '`/leaderboard` - Top 10 kingdoms',
          '`/top <prep|battle>` - Top 10 by phase',
        ].join('\n'),
      },
      {
        name: '📅 Events',
        value: [
          '`/upcoming` - Next KvK and Transfer dates',
          '`/countdown` - Time until next KvK',
        ].join('\n'),
      },
      {
        name: '🔗 Account',
        value: [
          '`/link` - Link your Kingshot account for the Settler role',
        ].join('\n'),
      },
      {
        name: '🌐 Links',
        value: [
          `[Website](${config.urls.base})`,
          `[Leaderboard](${config.urls.leaderboard})`,
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
      value: `💬 Love these updates? [Support development with Atlas Pro](${config.premium.ctaUrl})`,
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
 * Create countdown embed
 */
function createCountdownEmbed(event, timeRemaining) {
  const embed = new EmbedBuilder()
    .setColor(event.isActive ? config.colors.orange : config.colors.warning)
    .setTitle(event.isActive ? `⚔️ KvK #${event.number} In Progress!` : `⏰ KvK #${event.number} Countdown`)
    .setDescription(event.isActive 
      ? `**${event.phase}** is happening now!`
      : `*${config.bot.tagline}*`
    );

  if (event.isActive) {
    embed.addFields({
      name: '📍 Current Phase',
      value: `**${event.phase}**\nEnds in: ${timeRemaining}`,
    });
  } else {
    embed.addFields(
      {
        name: '⏱️ Time Until KvK',
        value: `\`\`\`\n${timeRemaining}\n\`\`\``,
      },
      {
        name: '📆 Start Date',
        value: event.startDate,
        inline: true,
      },
      {
        name: '🔢 Event Number',
        value: `KvK #${event.number}`,
        inline: true,
      }
    );
  }

  embed.setFooter({ text: config.bot.footerText })
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
        name: '🔓 Atlas Pro',
        value: [
          '• Matchup win probabilities',
          '• Historical performance trends',
          '• Advanced predictions',
        ].join('\n'),
        inline: true,
      },
      {
        name: '\u200b',
        value: `**Don't go in blind.** [Get Atlas Pro →](${config.premium.ctaUrl})`,
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
      '**Atlas Pro members saw this first.**',
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
  createLeaderboardEmbed,
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
};
