/**
 * Send KvK Battle Planner Announcement to #announcements
 * Run with: node send-battle-planner-announcement.js
 */

require('dotenv').config();

const config = require('./src/config');
const { EmbedBuilder } = require('discord.js');

async function sendBattlePlannerAnnouncement() {
  if (!config.announcementsWebhook) {
    console.error('❌ DISCORD_ANNOUNCEMENTS_WEBHOOK not configured in .env');
    process.exit(1);
  }

  console.log('⚔️ Sending KvK Battle Planner announcement...');
  console.log(`📍 Webhook: ${config.announcementsWebhook.substring(0, 50)}...`);

  try {
    const embed = new EmbedBuilder()
      .setColor(0xef4444) // Battle red
      .setTitle('⚔️ KvK Battle Planner — Now Live')
      .setDescription(
        'Coordinate multi-rally attacks with precision. The **KvK Battle Planner** is here.\n\n' +
        '**What it does:**\n' +
        '🏰 Target any building — Castle or Turrets 1–4\n' +
        '⏱️ Enter march times per player (regular & buffed)\n' +
        '🎯 Set hit intervals (1–5s gaps between rallies)\n' +
        '📊 Get exact call order + visual Gantt timeline\n' +
        '💾 Save player rosters & rally presets locally\n' +
        '⏲️ Track enemy buff timers with expiry alerts\n\n' +
        '**How it works:**\n' +
        'Add your rally players, set their march times, drag them into the queue, and the planner calculates exactly when to call each rally so they hit in sequence. Copy the call order to Discord in one click.'
      )
      .addFields(
        {
          name: '🛡️ Ally Rallies + 💀 Enemy Counter-Rallies',
          value: 'Plan both your attacks AND track incoming enemy rallies side by side. See the full battlefield timeline.',
        },
        {
          name: '💖 Atlas Supporter Perk',
          value: 'The Battle Planner is included with **Atlas Supporter** ($4.99/mo) — along with unlimited /multirally, Supporter badge, exclusive Discord access, and more.\n\n**👉 [Try the Planner → ks-atlas.com/battle-planner](https://ks-atlas.com/battle-planner)**\n**👉 [Become a Supporter → ks-atlas.com/support](https://ks-atlas.com/support)**',
        }
      )
      .setFooter({ text: config.bot.footerText })
      .setTimestamp();

    const response = await fetch(config.announcementsWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Atlas',
        avatar_url: config.botAvatarUrl,
        content: '@everyone',
        embeds: [embed.toJSON()],
      }),
    });

    if (response.ok) {
      console.log('✅ KvK Battle Planner announcement posted to #announcements!');
      console.log('👀 Check Discord to verify formatting.');
    } else {
      const text = await response.text();
      console.error(`❌ Failed: ${response.status} - ${text}`);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

sendBattlePlannerAnnouncement();
