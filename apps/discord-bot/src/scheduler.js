/**
 * Scheduled Tasks for Atlas Discord Bot
 * Handles automated daily updates and patch notes at 02:00 UTC
 */

const cron = require('node-cron');
const config = require('./config');
const embeds = require('./utils/embeds');

/**
 * Initialize all scheduled tasks
 * @param {Client} client - Discord.js client
 */
function initScheduler(client) {
  console.log('📅 Initializing scheduled tasks...');

  // Daily patch notes at 02:00 UTC
  // Cron: minute hour day month weekday
  cron.schedule('0 2 * * *', async () => {
    console.log('⏰ [02:00 UTC] Running daily update task...');
    await postDailyUpdate(client);
  }, {
    timezone: 'UTC'
  });

  console.log('✅ Scheduled: Daily updates at 02:00 UTC');

  // KvK reminder - 24h before KvK starts (Sundays at 00:00 UTC)
  cron.schedule('0 0 * * 0', async () => {
    const kvkInfo = getNextKvkInfo();
    const hoursUntil = Math.floor((kvkInfo.startDate - Date.now()) / (1000 * 60 * 60));
    
    if (hoursUntil <= 24 && hoursUntil > 0) {
      console.log(`⏰ KvK #${kvkInfo.number} starts in ${hoursUntil} hours - sending reminder`);
      await postKvkReminder(client, kvkInfo.number, hoursUntil);
    }
  }, {
    timezone: 'UTC'
  });

  console.log('✅ Scheduled: KvK reminders (24h before)');
}

/**
 * Post daily update to Discord
 * @param {Client} client - Discord.js client
 */
async function postDailyUpdate(client) {
  if (!config.patchNotesWebhook) {
    console.warn('⚠️ No patch notes webhook configured');
    return;
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Generate daily update content
    const updateContent = generateDailyUpdateContent();
    
    if (!updateContent.hasUpdates) {
      console.log('📭 No updates to post today');
      return;
    }

    const embed = embeds.createDailyUpdateEmbed(updateContent);
    
    // Post via webhook
    const response = await fetch(config.patchNotesWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Atlas Updates',
        avatar_url: 'https://ks-atlas.com/atlas-icon.png',
        embeds: [embed.toJSON()],
      }),
    });

    if (response.ok) {
      console.log(`✅ Daily update posted for ${today}`);
    } else {
      console.error(`❌ Failed to post daily update: ${response.status}`);
    }
  } catch (error) {
    console.error('❌ Error posting daily update:', error);
  }
}

/**
 * Post KvK reminder
 * @param {Client} client - Discord.js client
 * @param {number} kvkNumber - KvK event number
 * @param {number} hoursUntil - Hours until KvK starts
 */
async function postKvkReminder(client, kvkNumber, hoursUntil) {
  if (!config.patchNotesWebhook) return;

  try {
    const embed = embeds.createKvkReminderEmbed(kvkNumber, hoursUntil);
    
    await fetch(config.patchNotesWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Atlas',
        avatar_url: 'https://ks-atlas.com/atlas-icon.png',
        embeds: [embed.toJSON()],
      }),
    });

    console.log(`✅ KvK reminder posted for KvK #${kvkNumber}`);
  } catch (error) {
    console.error('❌ Error posting KvK reminder:', error);
  }
}

/**
 * Get next KvK info based on reference date
 */
function getNextKvkInfo() {
  const { kvkReference } = config;
  const now = Date.now();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const cycleMs = kvkReference.frequencyWeeks * msPerWeek;
  
  let kvkNumber = kvkReference.number;
  let startDate = new Date(kvkReference.startDate);
  
  while (startDate.getTime() < now) {
    startDate = new Date(startDate.getTime() + cycleMs);
    kvkNumber++;
  }
  
  return {
    number: kvkNumber,
    startDate: startDate,
  };
}

/**
 * Generate daily update content from recent activity
 * This reads from the activity log and curates user-relevant changes
 */
function generateDailyUpdateContent() {
  // This will be populated by the Activity Curator
  // For now, return a template structure
  return {
    hasUpdates: false,
    date: new Date().toISOString().split('T')[0],
    highlight: null,
    newFeatures: [],
    improvements: [],
    fixes: [],
    comingSoon: [],
    stats: {
      changesCount: 0,
      focusArea: null,
    }
  };
}

/**
 * Manually trigger daily update (for testing)
 * @param {Client} client - Discord.js client
 */
async function triggerDailyUpdate(client) {
  console.log('🔧 Manually triggering daily update...');
  await postDailyUpdate(client);
}

module.exports = {
  initScheduler,
  triggerDailyUpdate,
  postDailyUpdate,
  getNextKvkInfo,
};
