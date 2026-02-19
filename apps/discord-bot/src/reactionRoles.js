/**
 * Reaction Role Handler
 * 
 * Listens for messageReactionAdd / messageReactionRemove events and
 * assigns or removes Discord roles based on bot_reaction_roles configs
 * stored in Supabase.
 * 
 * Flow:
 * 1. User reacts on a tracked message → bot looks up config by message_id
 * 2. Finds matching emoji → role_id mapping
 * 3. Assigns or removes the role from the member
 */

const { createClient } = require('@supabase/supabase-js');
const logger = require('./utils/logger');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// In-memory cache of active reaction role configs (refreshed periodically)
let configCache = new Map(); // message_id -> { guild_id, emoji_role_mappings }
let lastCacheRefresh = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Refresh the config cache from Supabase
 */
async function refreshCache() {
  if (!supabase) return;
  try {
    const { data, error } = await supabase
      .from('bot_reaction_roles')
      .select('message_id, guild_id, emoji_role_mappings')
      .eq('active', true)
      .not('message_id', 'is', null);
    
    if (error) {
      logger.error('reactionRoles: cache refresh failed', error.message);
      return;
    }
    
    const newCache = new Map();
    for (const row of (data || [])) {
      if (row.message_id) {
        newCache.set(row.message_id, {
          guild_id: row.guild_id,
          emoji_role_mappings: row.emoji_role_mappings || [],
        });
      }
    }
    configCache = newCache;
    lastCacheRefresh = Date.now();
    logger.info(`reactionRoles: cache refreshed, ${newCache.size} active config(s)`);
  } catch (err) {
    logger.error('reactionRoles: cache refresh error', err.message);
  }
}

/**
 * Get config for a message, refreshing cache if stale
 */
async function getConfig(messageId) {
  if (Date.now() - lastCacheRefresh > CACHE_TTL) {
    await refreshCache();
  }
  return configCache.get(messageId) || null;
}

/**
 * Find the role_id for a given emoji in the config
 */
function findRoleForEmoji(config, emoji) {
  if (!config || !config.emoji_role_mappings) return null;
  for (const mapping of config.emoji_role_mappings) {
    if (mapping.emoji === emoji) return mapping.role_id;
  }
  return null;
}

/**
 * Handle messageReactionAdd event
 */
async function handleReactionAdd(reaction, user, client) {
  // Ignore bot reactions
  if (user.bot) return;

  // Fetch partial reaction/message if needed
  if (reaction.partial) {
    try { await reaction.fetch(); } catch { return; }
  }

  const messageId = reaction.message.id;
  const config = await getConfig(messageId);
  if (!config) return;

  const emoji = reaction.emoji.name;
  const roleId = findRoleForEmoji(config, emoji);
  if (!roleId) return;

  try {
    const guild = client.guilds.cache.get(config.guild_id) || await client.guilds.fetch(config.guild_id);
    const member = await guild.members.fetch(user.id);
    if (!member.roles.cache.has(roleId)) {
      await member.roles.add(roleId, 'Reaction role assignment');
      logger.info(`reactionRoles: +role ${roleId} to ${user.tag} (${emoji})`);
    }
  } catch (err) {
    logger.error(`reactionRoles: failed to add role ${roleId} to ${user.id}:`, err.message);
  }
}

/**
 * Handle messageReactionRemove event
 */
async function handleReactionRemove(reaction, user, client) {
  if (user.bot) return;

  if (reaction.partial) {
    try { await reaction.fetch(); } catch { return; }
  }

  const messageId = reaction.message.id;
  const config = await getConfig(messageId);
  if (!config) return;

  const emoji = reaction.emoji.name;
  const roleId = findRoleForEmoji(config, emoji);
  if (!roleId) return;

  try {
    const guild = client.guilds.cache.get(config.guild_id) || await client.guilds.fetch(config.guild_id);
    const member = await guild.members.fetch(user.id);
    if (member.roles.cache.has(roleId)) {
      await member.roles.remove(roleId, 'Reaction role removal');
      logger.info(`reactionRoles: -role ${roleId} from ${user.tag} (${emoji})`);
    }
  } catch (err) {
    logger.error(`reactionRoles: failed to remove role ${roleId} from ${user.id}:`, err.message);
  }
}

/**
 * Initialize reaction role handling on the Discord client.
 * Call this from bot.js after client is created.
 */
function initReactionRoles(client) {
  // Initial cache load
  refreshCache();

  client.on('messageReactionAdd', (reaction, user) => {
    handleReactionAdd(reaction, user, client).catch(err => {
      logger.error('reactionRoles: unhandled error in add handler', err.message);
    });
  });

  client.on('messageReactionRemove', (reaction, user) => {
    handleReactionRemove(reaction, user, client).catch(err => {
      logger.error('reactionRoles: unhandled error in remove handler', err.message);
    });
  });

  logger.info('reactionRoles: event handlers registered');
}

module.exports = { initReactionRoles, refreshCache };
