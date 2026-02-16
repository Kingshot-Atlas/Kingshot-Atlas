/**
 * Scheduled Tasks for Atlas Discord Bot
 * Handles automated daily updates and patch notes at 02:00 UTC
 */

const cron = require('node-cron');
const config = require('./config');
const embeds = require('./utils/embeds');
const { checkAndSendReminders } = require('./allianceReminders');

/**
 * Initialize all scheduled tasks
 * @param {Client} client - Discord.js client
 */
function initScheduler(client) {
  console.log('📅 Initializing scheduled tasks...');

  // Store client reference for gift code channel posting
  giftCodeClient = client;

  // Log webhook status
  if (config.patchNotesWebhook) {
    console.log('✅ Patch notes webhook configured');
  } else {
    console.warn('⚠️ DISCORD_PATCH_NOTES_WEBHOOK not set - daily updates disabled');
  }

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

  // KvK Castle Battle START announcement - 12:00 UTC on KvK Saturdays
  // Castle Battle is the core competitive window (12:00-18:00 UTC)
  cron.schedule('0 12 * * 6', async () => {
    const kvkInfo = getCurrentKvkInfo();
    
    // Only post if we're in the KvK week (battle Saturday)
    if (kvkInfo.isKvkSaturday) {
      console.log(`⏰ [12:00 UTC Saturday] KvK #${kvkInfo.number} Castle Battle starting!`);
      await postCastleBattleStartAnnouncement(client, kvkInfo.number);
    }
  }, {
    timezone: 'UTC'
  });

  console.log('✅ Scheduled: Castle Battle start announcements (12:00 UTC Saturdays)');

  // KvK Castle Battle END announcement - 18:00 UTC on KvK Saturdays
  // Castle Battle ends, time to submit results
  cron.schedule('0 18 * * 6', async () => {
    const kvkInfo = getCurrentKvkInfo();
    
    // Only post if we're in the KvK week (battle Saturday)
    if (kvkInfo.isKvkSaturday) {
      console.log(`⏰ [18:00 UTC Saturday] KvK #${kvkInfo.number} Castle Battle ending - sending data submission reminder`);
      await postKvkBattleEndAnnouncement(client, kvkInfo.number);
    }
  }, {
    timezone: 'UTC'
  });

  console.log('✅ Scheduled: Castle Battle end announcements (18:00 UTC Saturdays)');

  // Gift code check every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    console.log('⏰ Checking for new gift codes...');
    await checkAndPostNewGiftCodes();
  }, {
    timezone: 'UTC'
  });

  // Log webhook status for gift codes
  if (config.giftCodesWebhook) {
    console.log('✅ Scheduled: Gift code checks every 30 minutes');
  } else {
    console.warn('⚠️ DISCORD_GIFT_CODES_WEBHOOK not set - gift code auto-posting disabled');
  }

  // Alliance Event Reminders — every minute, checks Supabase for upcoming events
  cron.schedule('* * * * *', async () => {
    await checkAndSendReminders(client);
  }, {
    timezone: 'UTC'
  });

  console.log('✅ Scheduled: Alliance event reminders (every minute)');
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
 * Post Castle Battle START announcement to Discord
 * Tags @everyone to alert that the core competitive window has begun
 * @param {Client} client - Discord.js client
 * @param {number} kvkNumber - KvK event number
 */
async function postCastleBattleStartAnnouncement(client, kvkNumber) {
  if (!config.announcementsWebhook) {
    console.warn('⚠️ No announcements webhook configured for Castle Battle start announcement');
    return;
  }

  try {
    const embed = embeds.createCastleBattleStartEmbed(kvkNumber);
    
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
      console.log(`✅ KvK #${kvkNumber} Castle Battle START announcement posted`);
    } else {
      console.error(`❌ Failed to post Castle Battle start announcement: ${response.status}`);
    }
  } catch (error) {
    console.error('❌ Error posting Castle Battle start announcement:', error);
  }
}

/**
 * Post KvK battle end announcement to Discord
 * Tags @everyone and prompts users to submit their KvK data
 * @param {Client} client - Discord.js client
 * @param {number} kvkNumber - KvK event number
 */
async function postKvkBattleEndAnnouncement(client, kvkNumber) {
  if (!config.announcementsWebhook) {
    console.warn('⚠️ No announcements webhook configured for KvK battle end announcement');
    return;
  }

  try {
    const embed = embeds.createKvkBattleEndEmbed(kvkNumber);
    
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
      console.log(`✅ KvK #${kvkNumber} Castle Battle end announcement posted to #announcements`);
    } else {
      console.error(`❌ Failed to post KvK battle end announcement: ${response.status}`);
    }
  } catch (error) {
    console.error('❌ Error posting KvK battle end announcement:', error);
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
 * Get current KvK info - checks if we're currently in a KvK week
 * KvK runs Monday 00:00 UTC to Saturday 22:00 UTC
 */
function getCurrentKvkInfo() {
  const { kvkReference } = config;
  const now = new Date();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const cycleMs = kvkReference.frequencyWeeks * msPerWeek;
  
  let kvkNumber = kvkReference.number;
  let startDate = new Date(kvkReference.startDate);
  
  // Find the most recent KvK that has started
  while (startDate.getTime() + cycleMs <= now.getTime()) {
    startDate = new Date(startDate.getTime() + cycleMs);
    kvkNumber++;
  }
  
  // Check if we're currently in a KvK week
  // KvK starts Monday 00:00 and ends Saturday 22:00
  const kvkEndDate = new Date(startDate.getTime() + (5 * 24 + 22) * 60 * 60 * 1000); // Saturday 22:00
  const isInKvkWeek = now >= startDate && now <= kvkEndDate;
  
  // Check if today is the KvK battle Saturday
  const isSaturday = now.getUTCDay() === 6;
  const isKvkSaturday = isInKvkWeek && isSaturday;
  
  return {
    number: kvkNumber,
    startDate: startDate,
    endDate: kvkEndDate,
    isInKvkWeek,
    isKvkSaturday,
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

/**
 * Post a test message to verify scheduler is working
 */
async function postTestMessage() {
  if (!config.patchNotesWebhook) {
    console.warn('⚠️ No patch notes webhook configured for test');
    return;
  }

  try {
    const response = await fetch(config.patchNotesWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Atlas',
        avatar_url: 'https://ks-atlas.com/atlas-icon.png',
        content: '🧪 Just testing, no worries!',
      }),
    });

    if (response.ok) {
      console.log('✅ Test message posted successfully');
    } else {
      console.error(`❌ Failed to post test message: ${response.status}`);
    }
  } catch (error) {
    console.error('❌ Error posting test message:', error);
  }
}

// ============================================================================
// GIFT CODE AUTO-POSTING
// Polls backend API every 30 min (which merges kingshot.net + Supabase DB),
// posts new codes to #giftcodes channel with @Giftcodes role mention
// ============================================================================

// Track known codes to detect new ones (persists in memory across checks)
let knownGiftCodes = new Set();
let giftCodeInitialized = false;
let giftCodeClient = null; // Set by initScheduler

/**
 * Check for new gift codes and post to Discord if found.
 * Uses the backend API which auto-syncs kingshot.net → Supabase.
 */
async function checkAndPostNewGiftCodes() {
  const channelId = config.giftCodesChannelId;
  const roleId = config.giftCodesRoleId;
  const hasChannel = giftCodeClient && channelId;
  const hasWebhook = config.giftCodesWebhook;

  if (!hasChannel && !hasWebhook) {
    console.warn('⚠️ No gift codes channel or webhook configured');
    return;
  }

  try {
    // Fetch from backend API (triggers kingshot.net sync + DB merge)
    const apiUrl = config.apiUrl;
    const response = await fetch(`${apiUrl}/api/v1/player-link/gift-codes`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.warn(`⚠️ Gift code API fetch failed: ${response.status}`);
      return;
    }

    const data = await response.json();
    const activeCodes = (data.codes || []).filter(c => c.code && !c.is_expired);

    if (!giftCodeInitialized) {
      // First run: seed known codes without posting (avoid spam on restart)
      activeCodes.forEach(c => knownGiftCodes.add(c.code));
      giftCodeInitialized = true;
      console.log(`🎁 Gift code tracker initialized with ${knownGiftCodes.size} known codes (source: ${data.source})`);
      return;
    }

    // Detect new codes
    const newCodes = activeCodes.filter(c => !knownGiftCodes.has(c.code));

    if (newCodes.length > 0) {
      console.log(`🎁 ${newCodes.length} new gift code(s) detected!`);

      for (const code of newCodes) {
        knownGiftCodes.add(code.code);

        // Post to #giftcodes channel via bot client (preferred)
        if (hasChannel) {
          try {
            const channel = await giftCodeClient.channels.fetch(channelId);
            if (channel) {
              const embed = embeds.createNewGiftCodeEmbed(code);
              const roleMention = roleId ? `<@&${roleId}>` : '';
              await channel.send({
                content: roleMention,
                embeds: [embed],
                allowedMentions: { roles: roleId ? [roleId] : [] },
              });
              console.log(`✅ Posted new gift code to #giftcodes: ${code.code}`);
            }
          } catch (channelErr) {
            console.error(`❌ Failed to post to #giftcodes channel: ${channelErr.message}`);
          }
        }
        // Fallback: webhook
        else if (hasWebhook) {
          try {
            const embed = embeds.createNewGiftCodeEmbed(code);
            await fetch(config.giftCodesWebhook, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                username: 'Atlas',
                avatar_url: config.botAvatarUrl,
                embeds: [embed.toJSON()],
              }),
            });
            console.log(`✅ Posted new gift code via webhook: ${code.code}`);
          } catch (webhookErr) {
            console.error(`❌ Webhook post failed for ${code.code}:`, webhookErr.message);
          }
        }

        // Small delay between posts
        if (newCodes.indexOf(code) < newCodes.length - 1) {
          await new Promise(r => setTimeout(r, 1500));
        }
      }
    } else {
      console.log(`🎁 No new gift codes (${knownGiftCodes.size} known, source: ${data.source})`);
    }

    // Prune expired/removed codes from known set
    const activeCodeSet = new Set(activeCodes.map(c => c.code));
    for (const known of knownGiftCodes) {
      if (!activeCodeSet.has(known)) {
        knownGiftCodes.delete(known);
      }
    }
  } catch (error) {
    console.error('❌ Error checking gift codes:', error.message);
  }
}

module.exports = {
  initScheduler,
  triggerDailyUpdate,
  postDailyUpdate,
  getNextKvkInfo,
  getCurrentKvkInfo,
  postCastleBattleStartAnnouncement,
  postKvkBattleEndAnnouncement,
  checkAndPostNewGiftCodes,
};
