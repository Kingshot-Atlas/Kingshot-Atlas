/**
 * Test script for KvK Battle End Announcement
 * Run with: node test-announcement.js
 */

require('dotenv').config();

const config = require('./src/config');
const embeds = require('./src/utils/embeds');

async function testKvkBattleEndAnnouncement() {
  const kvkNumber = 10; // Current KvK

  if (!config.announcementsWebhook) {
    console.error('❌ DISCORD_ANNOUNCEMENTS_WEBHOOK not configured in .env');
    process.exit(1);
  }

  console.log('🧪 Testing KvK Battle End Announcement...');
  console.log(`📍 Webhook: ${config.announcementsWebhook.substring(0, 50)}...`);

  try {
    const embed = embeds.createKvkBattleEndEmbed(kvkNumber);

    const response = await fetch(config.announcementsWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Atlas',
        avatar_url: 'https://ks-atlas.com/atlas-icon.png',
        content: '@everyone',
        embeds: [embed.toJSON()],
      }),
    });

    if (response.ok) {
      console.log('✅ Test announcement posted to #announcements!');
      console.log('👀 Check Discord to verify formatting.');
    } else {
      const text = await response.text();
      console.error(`❌ Failed: ${response.status} - ${text}`);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testKvkBattleEndAnnouncement();
