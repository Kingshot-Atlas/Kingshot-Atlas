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
  if (score >= 10) return 'S';   // Top 10%: Score 10+
  if (score >= 7) return 'A';    // Top 25%: Score 7-9.9
  if (score >= 4.5) return 'B';  // Top 50%: Score 4.5-6.9
  if (score >= 2.5) return 'C';  // Top 75%: Score 2.5-4.4
  return 'D';                    // Bottom 25%: Score below 2.5
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
 * Create kingdom stats embed
 */
function createKingdomEmbed(kingdom) {
  const tier = getTier(kingdom.overall_score);
  const tierEmoji = getTierEmoji(tier);

  const embed = new EmbedBuilder()
    .setColor(getTierColor(tier))
    .setTitle(`🏰 Kingdom ${kingdom.kingdom_number}`)
    .setURL(config.urls.kingdom(kingdom.kingdom_number))
    .setDescription(`${tierEmoji} **Tier ${tier}** • Atlas Score: **${kingdom.overall_score.toFixed(1)}**`)
    .addFields(
      {
        name: '📊 Overall Stats',
        value: [
          `**Total KvKs:** ${kingdom.total_kvks}`,
          `**Status:** ${kingdom.most_recent_status || 'Unknown'}`,
          `**Dominations:** ${kingdom.high_kings || 0} 👑`,
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
        name: '🔗 Links',
        value: [
          `[Website](${config.urls.base})`,
          `[Leaderboard](${config.urls.leaderboard})`,
          `[Changelog](${config.urls.changelog})`,
        ].join(' • '),
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

  embed.addFields({
    name: '📖 Full Notes',
    value: `[View on website](${config.urls.changelog})`,
  });

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

module.exports = {
  getTier,
  getTierColor,
  getTierEmoji,
  formatWinRate,
  formatRecord,
  createProgressBar,
  createKingdomEmbed,
  createCompareEmbed,
  createLeaderboardEmbed,
  createTierEmbed,
  createUpcomingEmbed,
  createHelpEmbed,
  createPatchNotesEmbed,
  createErrorEmbed,
  createCountdownEmbed,
};
