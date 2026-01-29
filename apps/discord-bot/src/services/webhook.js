/**
 * Webhook Service
 * Handles posting patch notes and announcements to Discord via webhooks
 */

const config = require('../config');
const embeds = require('../utils/embeds');

/**
 * Post patch notes to Discord via webhook
 * @param {Object} patchNotes - Parsed patch notes object
 * @param {string} patchNotes.date - Date of the patch notes
 * @param {string[]} patchNotes.new - Array of new features
 * @param {string[]} patchNotes.fixed - Array of bug fixes
 * @param {string[]} patchNotes.improved - Array of improvements
 */
async function postPatchNotes(patchNotes) {
  const webhookUrl = config.patchNotesWebhook;

  if (!webhookUrl) {
    console.error('❌ DISCORD_PATCH_NOTES_WEBHOOK not configured');
    return { success: false, error: 'Webhook URL not configured' };
  }

  try {
    const embed = embeds.createPatchNotesEmbed(patchNotes);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'Atlas',
        avatar_url: 'https://ks-atlas.com/AtlasBotAvatar.webp',
        embeds: [embed.toJSON()],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Webhook failed:', error);
      return { success: false, error };
    }

    console.log('✅ Patch notes posted to Discord');
    return { success: true };
  } catch (error) {
    console.error('❌ Webhook error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Post a major release announcement
 * @param {Object} release - Release information
 * @param {string} release.title - Release title
 * @param {string} release.description - Release description
 * @param {string[]} release.highlights - Key highlights
 */
async function postMajorRelease(release) {
  const webhookUrl = config.patchNotesWebhook;

  if (!webhookUrl) {
    console.error('❌ DISCORD_PATCH_NOTES_WEBHOOK not configured');
    return { success: false, error: 'Webhook URL not configured' };
  }

  try {
    const { EmbedBuilder } = require('discord.js');

    const embed = new EmbedBuilder()
      .setColor(config.colors.gold)
      .setTitle(`🎉 ${release.title}`)
      .setURL(config.urls.changelog)
      .setDescription(release.description);

    if (release.highlights && release.highlights.length > 0) {
      embed.addFields({
        name: '🌟 Highlights',
        value: release.highlights.map(h => `• ${h}`).join('\n'),
      });
    }

    embed.addFields({
      name: '📖 Full Details',
      value: `[View on website](${config.urls.changelog})`,
    });

    embed.setFooter({ text: config.bot.footerText })
      .setTimestamp();

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'Atlas',
        avatar_url: 'https://ks-atlas.com/AtlasBotAvatar.webp',
        content: '📢 **New Release!**',
        embeds: [embed.toJSON()],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Webhook failed:', error);
      return { success: false, error };
    }

    console.log('✅ Major release posted to Discord');
    return { success: true };
  } catch (error) {
    console.error('❌ Webhook error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Post a maintenance notice
 * @param {Object} notice - Maintenance information
 * @param {string} notice.date - Date of maintenance
 * @param {string} notice.time - Time of maintenance
 * @param {string} notice.duration - Expected duration
 * @param {string} notice.reason - Reason for maintenance (optional)
 */
async function postMaintenanceNotice(notice) {
  const webhookUrl = config.patchNotesWebhook;

  if (!webhookUrl) {
    return { success: false, error: 'Webhook URL not configured' };
  }

  try {
    const { EmbedBuilder } = require('discord.js');

    const embed = new EmbedBuilder()
      .setColor(config.colors.warning)
      .setTitle('🔧 Scheduled Maintenance')
      .setDescription(`Kingshot Atlas will be briefly unavailable for maintenance.`)
      .addFields(
        { name: '📆 Date', value: notice.date, inline: true },
        { name: '⏰ Time', value: notice.time, inline: true },
        { name: '⏱️ Duration', value: notice.duration, inline: true }
      );

    if (notice.reason) {
      embed.addFields({ name: '📝 Reason', value: notice.reason });
    }

    embed.addFields({
      name: '💬',
      value: 'Thanks for your patience!',
    });

    embed.setFooter({ text: config.bot.footerText })
      .setTimestamp();

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'Atlas',
        avatar_url: 'https://ks-atlas.com/AtlasBotAvatar.webp',
        embeds: [embed.toJSON()],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }

    console.log('✅ Maintenance notice posted to Discord');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Post a status update (outage/resolution)
 * @param {Object} status - Status information
 * @param {string} status.type - 'outage' or 'resolved'
 * @param {string} status.feature - Affected feature
 * @param {string} status.message - Status message
 */
async function postStatusUpdate(status) {
  const webhookUrl = config.patchNotesWebhook;

  if (!webhookUrl) {
    return { success: false, error: 'Webhook URL not configured' };
  }

  try {
    const { EmbedBuilder } = require('discord.js');

    const isOutage = status.type === 'outage';
    const embed = new EmbedBuilder()
      .setColor(isOutage ? config.colors.error : config.colors.success)
      .setTitle(isOutage ? '⚠️ Service Issue' : '✅ All Clear!')
      .setDescription(status.message);

    if (status.feature) {
      embed.addFields({ name: 'Affected', value: status.feature, inline: true });
    }

    embed.setFooter({ text: config.bot.footerText })
      .setTimestamp();

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'Atlas',
        avatar_url: 'https://ks-atlas.com/AtlasBotAvatar.webp',
        embeds: [embed.toJSON()],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }

    console.log(`✅ Status update (${status.type}) posted to Discord`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  postPatchNotes,
  postMajorRelease,
  postMaintenanceNotice,
  postStatusUpdate,
};
