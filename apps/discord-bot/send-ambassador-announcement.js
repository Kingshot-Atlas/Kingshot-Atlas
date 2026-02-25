/**
 * Send Ambassador Program Announcement to #announcements
 * Run with: node send-ambassador-announcement.js
 */

require('dotenv').config();

const config = require('./src/config');
const { EmbedBuilder } = require('discord.js');

async function sendAmbassadorAnnouncement() {
  if (!config.announcementsWebhook) {
    console.error('❌ DISCORD_ANNOUNCEMENTS_WEBHOOK not configured in .env');
    process.exit(1);
  }

  console.log('🏛️ Sending Ambassador Program announcement...');
  console.log(`📍 Webhook: ${config.announcementsWebhook.substring(0, 50)}...`);

  try {
    const embed = new EmbedBuilder()
      .setColor(0xa24cf3) // Ambassador purple
      .setTitle('🏛️ Atlas Ambassador Program — Now Live')
      .setDescription(
        'Your network is your power. Every player you bring to Atlas strengthens the community — and levels you up too.\n\n' +
        '**🔍 Scout** — 2 referrals\n' +
        'Profile badge + listed on Ambassador Network\n\n' +
        '**📢 Recruiter** — 5 referrals\n' +
        'Recruiter badge + highlighted in kingdom lists\n\n' +
        '**⚖️ Consul** — 10 referrals\n' +
        'Exclusive Consul Discord role + community recognition\n\n' +
        '**🏛️ Ambassador** — 20 referrals\n' +
        '*The top tier. Here\'s what you unlock:*\n\n' +
        '🟣 Ambassador Discord role + website badge\n' +
        '🔒 Private **#vip-lounge** channel access\n' +
        '⚡ Priority support from the Atlas team\n' +
        '🏆 Leaderboard spotlight\n' +
        '🎯 Direct input on what Atlas builds next'
      )
      .addFields({
        name: '\u200b',
        value: 'This isn\'t a giveaway. It\'s earned. The players who grow this community get a seat at the table.\n\n**👉 [Start climbing → ks-atlas.com/ambassadors](https://ks-atlas.com/ambassadors)**',
      })
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
      console.log('✅ Ambassador Program announcement posted to #announcements!');
      console.log('👀 Check Discord to verify formatting.');
    } else {
      const text = await response.text();
      console.error(`❌ Failed: ${response.status} - ${text}`);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

sendAmbassadorAnnouncement();
