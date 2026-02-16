/**
 * Alliance Event Reminders
 * 
 * Reads bot_alliance_events from Supabase every minute, checks if any
 * reminders need to be sent, posts to configured Discord channels with
 * optional role mentions, and logs to bot_event_history.
 * 
 * Event types & cycles:
 *   bear_hunt          — Every 2 days (from reference_date)
 *   viking_vengeance   — Biweekly: Tuesday & Thursday
 *   swordland_showdown — Biweekly: Sunday
 *   tri_alliance_clash — Monthly (every 4 weeks): Saturday
 * 
 * Requires env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY
 */

const { EmbedBuilder } = require('discord.js');
const config = require('./config');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const ENABLED = !!(SUPABASE_URL && SUPABASE_SERVICE_KEY);

// ─── Event Display ───────────────────────────────────────────────────────────

const EVENT_DISPLAY = {
  bear_hunt:          { label: 'Bear Hunt',          emoji: '🐻', color: 0xf59e0b },
  viking_vengeance:   { label: 'Viking Vengeance',   emoji: '⚔️',  color: 0xef4444 },
  swordland_showdown: { label: 'Swordland Showdown', emoji: '🗡️',  color: 0xa855f7 },
  tri_alliance_clash: { label: 'Tri-Alliance Clash', emoji: '🛡️',  color: 0x3b82f6 },
};

// ─── Event Cycles ────────────────────────────────────────────────────────────

const EVENT_CYCLES = {
  bear_hunt:          { type: 'interval_days', intervalDays: 2 },
  viking_vengeance:   { type: 'biweekly',      weekDays: [2, 4] },   // Tue, Thu
  swordland_showdown: { type: 'biweekly',      weekDays: [0] },      // Sun
  tri_alliance_clash: { type: 'monthly',        weekDays: [6], cycleWeeks: 4 }, // Sat, every 4 weeks
};

// ─── Supabase REST Helper ────────────────────────────────────────────────────

async function supabaseRest(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...(options.prefer ? { 'Prefer': options.prefer } : {}),
    ...options.headers,
  };
  return fetch(url, { ...options, headers });
}

// ─── Day Check Logic ─────────────────────────────────────────────────────────

/**
 * Determine if `now` falls on an event day for the given event type.
 * @param {string} eventType
 * @param {string|null} referenceDate  ISO date string
 * @param {Date} now
 * @returns {boolean}
 */
function isEventDay(eventType, referenceDate, now) {
  const cycle = EVENT_CYCLES[eventType];
  if (!cycle) return false;

  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const dayOfWeek = today.getUTCDay(); // 0=Sun … 6=Sat

  switch (cycle.type) {
    case 'interval_days': {
      // Every N days from reference_date (e.g. Bear Hunt every 2 days)
      if (!referenceDate) return true; // No ref → assume every occurrence
      const ref = new Date(referenceDate);
      ref.setUTCHours(0, 0, 0, 0);
      const diffDays = Math.round((today - ref) / (86400000));
      return diffDays >= 0 && diffDays % cycle.intervalDays === 0;
    }

    case 'biweekly': {
      // Specific days of week, every 2 weeks from reference
      if (!cycle.weekDays.includes(dayOfWeek)) return false;
      if (!referenceDate) return true;
      const ref = new Date(referenceDate);
      ref.setUTCHours(0, 0, 0, 0);
      const diffWeeks = Math.floor((today - ref) / (7 * 86400000));
      return diffWeeks >= 0 && diffWeeks % 2 === 0;
    }

    case 'monthly': {
      // Specific days of week, every N weeks from reference
      if (!cycle.weekDays.includes(dayOfWeek)) return false;
      if (!referenceDate) return true;
      const ref = new Date(referenceDate);
      ref.setUTCHours(0, 0, 0, 0);
      const diffWeeks = Math.floor((today - ref) / (7 * 86400000));
      return diffWeeks >= 0 && diffWeeks % cycle.cycleWeeks === 0;
    }

    default:
      return false;
  }
}

// ─── Core: Check & Send Reminders ────────────────────────────────────────────

/**
 * Main reminder loop — called every minute by cron.
 * Fetches enabled events from Supabase, checks timing, sends Discord messages.
 * @param {import('discord.js').Client} client
 */
async function checkAndSendReminders(client) {
  if (!ENABLED) return;

  try {
    // Fetch enabled events with their guild settings (PostgREST embedded select)
    const res = await supabaseRest(
      'bot_alliance_events?enabled=eq.true&time_slots=not.eq.[]&select=*,bot_guild_settings!inner(guild_id,guild_name,reminder_channel_id)',
      { prefer: 'return=representation' }
    );

    if (!res.ok) {
      console.error(`❌ Alliance reminders: fetch failed (${res.status})`);
      return;
    }

    const events = await res.json();
    if (!events || events.length === 0) return;

    const now = new Date();
    const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

    for (const event of events) {
      if (!event.time_slots || event.time_slots.length === 0) continue;

      const guild = event.bot_guild_settings;
      if (!guild) continue;

      // Check if today is an event day for this type
      if (!isEventDay(event.event_type, event.reference_date, now)) continue;

      for (const slot of event.time_slots) {
        // Support per-day slots (e.g. Viking Vengeance: Tuesday=2, Thursday=4)
        if (slot.day !== undefined && slot.day !== null && slot.day !== now.getUTCDay()) continue;

        const eventMinutes = slot.hour * 60 + slot.minute;
        let reminderMinutes = eventMinutes - (event.reminder_minutes_before || 0);
        // Handle midnight wrap (e.g. event at 00:05 with 10min reminder → 23:55)
        if (reminderMinutes < 0) reminderMinutes += 1440;

        // Must match current minute exactly
        if (nowMinutes !== reminderMinutes) continue;

        // Duplicate guard: skip if reminded within last 90 minutes
        if (event.last_reminded_at) {
          const elapsed = now.getTime() - new Date(event.last_reminded_at).getTime();
          if (elapsed < 90 * 60 * 1000) continue;
        }

        // Resolve channel
        const channelId = event.channel_id || guild.reminder_channel_id;
        if (!channelId) {
          console.warn(`⚠️ No channel for ${event.event_type} in guild ${guild.guild_id}`);
          continue;
        }

        await sendReminder(client, event, guild, slot, channelId, now);
      }
    }
  } catch (error) {
    console.error('❌ Alliance reminders check error:', error.message);
  }
}

/**
 * Send a single reminder message and log the result.
 */
async function sendReminder(client, event, guild, slot, channelId, now) {
  const meta = EVENT_DISPLAY[event.event_type] || { label: event.event_type, emoji: '📢', color: 0x22d3ee };
  const timeStr = `${String(slot.hour).padStart(2, '0')}:${String(slot.minute).padStart(2, '0')} UTC`;
  const minsBefore = event.reminder_minutes_before || 0;

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) throw new Error(`Channel ${channelId} not found`);

    // Use custom message if configured, otherwise default
    const customMsg = event.custom_message;
    const defaultMessages = {
      bear_hunt: 'Rally your alliance and hunt together!',
      viking_vengeance: 'Time to fight for glory!',
      swordland_showdown: 'Ready your blades and fight for dominance!',
      tri_alliance_clash: 'Coordinate with your allies!',
    };
    const baseMsg = customMsg || defaultMessages[event.event_type] || `${meta.label} is starting soon!`;
    const description = `${baseMsg}\nJoin us at **${timeStr}**.`;

    const embed = new EmbedBuilder()
      .setTitle(`${meta.emoji} ${meta.label} starting soon!`)
      .setURL('https://ks-atlas.com')
      .setDescription(description)
      .setColor(meta.color)
      .setFooter({ text: 'Brought to you by Atlas · ks-atlas.com' })
      .setTimestamp();

    const roleMention = event.role_id ? `<@&${event.role_id}>` : '';

    await channel.send({
      content: roleMention || undefined,
      embeds: [embed],
      allowedMentions: event.role_id ? { roles: [event.role_id] } : undefined,
    });

    console.log(`🔔 Reminder sent: ${meta.label} for ${guild.guild_name} (${guild.guild_id})`);

    // Update last_reminded_at
    await supabaseRest(
      `bot_alliance_events?id=eq.${event.id}`,
      { method: 'PATCH', body: JSON.stringify({ last_reminded_at: now.toISOString() }) }
    ).catch(() => {});

    // Log success to history
    await logEventHistory(guild.guild_id, event, slot, channelId, 'sent', null, minsBefore);

  } catch (sendErr) {
    console.error(`❌ Reminder failed: ${meta.label} in ${guild.guild_id}: ${sendErr.message}`);
    await logEventHistory(guild.guild_id, event, slot, channelId, 'failed', sendErr.message, minsBefore);
  }
}

/**
 * Write a row to bot_event_history (fire-and-forget).
 */
async function logEventHistory(guildId, event, slot, channelId, status, errorMessage, minsBefore) {
  try {
    await supabaseRest('bot_event_history', {
      method: 'POST',
      body: JSON.stringify({
        guild_id: guildId,
        event_type: event.event_type,
        event_id: event.id,
        channel_id: channelId,
        role_id: event.role_id,
        time_slot: slot,
        status,
        error_message: errorMessage,
        reminder_minutes_before: minsBefore,
      }),
    });
  } catch (e) {
    // Fire-and-forget — don't let logging failures block reminders
  }
}

module.exports = { checkAndSendReminders, isEventDay };
