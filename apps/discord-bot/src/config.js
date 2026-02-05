/**
 * Atlas Discord Bot Configuration
 * Centralized configuration for the Kingshot Atlas Discord bot
 */

require('dotenv').config();

module.exports = {
  // Discord credentials
  // Support both DISCORD_TOKEN and DISCORD_BOT_TOKEN for flexibility
  token: process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN,
  clientId: process.env.DISCORD_CLIENT_ID,
  guildId: process.env.DISCORD_GUILD_ID,

  // Channel IDs
  botChannelId: process.env.BOT_CHANNEL_ID,
  updatesChannelId: process.env.UPDATES_CHANNEL_ID,

  // Webhooks
  patchNotesWebhook: process.env.DISCORD_PATCH_NOTES_WEBHOOK,
  announcementsWebhook: process.env.DISCORD_ANNOUNCEMENTS_WEBHOOK,

  // API - MUST point to the backend API, not frontend
  apiUrl: process.env.API_URL || 'https://kingshot-atlas.onrender.com',

  // Brand colors (from BRAND_GUIDE.md)
  colors: {
    primary: 0x22d3ee,    // Cyan - main accent
    background: 0x0a0a0a, // Dark background
    surface: 0x111111,    // Cards/panels
    success: 0x22c55e,    // Wins, positive
    warning: 0xeab308,    // Prep phase, caution
    error: 0xef4444,      // Losses, negative
    orange: 0xf97316,     // Battle phase
    gold: 0xfbbf24,       // S-Tier, highlights
  },

  // Tier colors
  tierColors: {
    S: 0xfbbf24, // Gold
    A: 0x22c55e, // Green
    B: 0x3b82f6, // Blue
    C: 0x9ca3af, // Gray
    D: 0x6b7280, // Dark gray
  },

  // KvK Schedule (from LATEST_KNOWLEDGE)
  // KvK #10 started Monday, January 26, 2026 at 00:00 UTC
  // Frequency: Every 4 weeks
  kvkReference: {
    number: 10,
    startDate: new Date('2026-01-26T00:00:00Z'),
    frequencyWeeks: 4,
    prepDurationDays: 5.417, // Monday 00:00 to Saturday 10:00
    battleDurationHours: 12, // Saturday 10:00 to 22:00
  },

  // Transfer Event Schedule
  // Transfer Event #3 started Sunday, January 4, 2026 at 00:00 UTC
  // Frequency: Every 8 weeks
  transferReference: {
    number: 3,
    startDate: new Date('2026-01-04T00:00:00Z'),
    frequencyWeeks: 8,
    phases: {
      preTransfer: 3,      // Sunday to Wednesday (3 days)
      invitational: 2,     // Wednesday to Friday (2 days)
      open: 2,             // Friday to Sunday (2 days)
    },
  },

  // Website URLs
  urls: {
    base: 'https://ks-atlas.com',
    kingdom: (num) => `https://ks-atlas.com/kingdom/${num}`,
    compare: (k1, k2) => `https://ks-atlas.com/compare?k1=${k1}&k2=${k2}`,
    leaderboard: 'https://ks-atlas.com/leaderboard',
    changelog: 'https://ks-atlas.com/changelog',
    pro: 'https://ks-atlas.com/pro',
  },

  // Bot avatar (hosted on ks-atlas.com)
  botAvatarUrl: 'https://ks-atlas.com/AtlasBotAvatar.webp',

  // Premium conversion messaging
  premium: {
    cta: '🔓 Want historical trends & predictions? → Atlas Pro',
    ctaShort: '🔓 Unlock more with Atlas Pro',
    ctaUrl: 'https://ks-atlas.com/pro',
  },

  // Bot identity
  bot: {
    name: 'Atlas',
    tagline: 'Know your enemy. Choose your allies. Dominate KvK.',
    footerText: 'Kingshot Atlas • ks-atlas.com',
  },
};
