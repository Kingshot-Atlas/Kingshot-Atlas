/**
 * Atlas Bot Logger
 * 
 * Logs command usage, errors, and engagement metrics for analysis
 * by the Discord Community Manager agent.
 * 
 * Logs are stored in /logs directory:
 * - commands.log: All command executions with metadata
 * - errors.log: Failed commands and errors
 * - stats.json: Aggregated statistics
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');

// API sync configuration
const API_SYNC_ENABLED = process.env.BOT_API_SYNC !== 'false';
const API_SYNC_INTERVAL = 60000; // Sync every 60 seconds

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const commandsLogPath = path.join(logsDir, 'commands.log');
const errorsLogPath = path.join(logsDir, 'errors.log');
const statsPath = path.join(logsDir, 'stats.json');

// Initialize stats file if not exists
function initStats() {
  if (!fs.existsSync(statsPath)) {
    const initialStats = {
      startedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      totalCommands: 0,
      totalErrors: 0,
      commandCounts: {},
      dailyActivity: {},
      errorTypes: {},
      guilds: {},
    };
    fs.writeFileSync(statsPath, JSON.stringify(initialStats, null, 2));
    return initialStats;
  }
  try {
    return JSON.parse(fs.readFileSync(statsPath, 'utf-8'));
  } catch {
    return initStats();
  }
}

let stats = initStats();

// Save stats to file (debounced)
let saveTimeout = null;
function saveStats() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    stats.lastUpdated = new Date().toISOString();
    fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
  }, 1000);
}

// Format timestamp
function timestamp() {
  return new Date().toISOString();
}

// Get today's date key
function todayKey() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Log a command execution
 * @param {Object} interaction - Discord interaction object
 * @param {number} responseTime - Time to respond in ms
 * @param {boolean} success - Whether command succeeded
 */
function logCommand(interaction, responseTime = 0, success = true) {
  const commandName = interaction.commandName;
  const guildId = interaction.guildId || 'DM';
  const guildName = interaction.guild?.name || 'Direct Message';
  const userId = interaction.user.id;
  const options = interaction.options?._hoistedOptions?.map(o => `${o.name}:${o.value}`).join(', ') || '';

  const logEntry = [
    timestamp(),
    'COMMAND',
    commandName,
    success ? 'OK' : 'FAIL',
    `${responseTime}ms`,
    `guild:${guildId}`,
    `user:${userId}`,
    options ? `options:[${options}]` : '',
  ].filter(Boolean).join(' | ');

  fs.appendFileSync(commandsLogPath, logEntry + '\n');

  // Update stats
  stats.totalCommands++;
  stats.commandCounts[commandName] = (stats.commandCounts[commandName] || 0) + 1;
  
  const today = todayKey();
  if (!stats.dailyActivity[today]) {
    stats.dailyActivity[today] = { commands: 0, errors: 0, uniqueUsers: [] };
  }
  stats.dailyActivity[today].commands++;
  if (!stats.dailyActivity[today].uniqueUsers.includes(userId)) {
    stats.dailyActivity[today].uniqueUsers.push(userId);
  }

  // Track guild activity
  if (!stats.guilds[guildId]) {
    stats.guilds[guildId] = { name: guildName, commands: 0, firstSeen: timestamp() };
  }
  stats.guilds[guildId].commands++;
  stats.guilds[guildId].lastActive = timestamp();

  saveStats();
}

/**
 * Log an error
 * @param {string} commandName - Name of the command that failed
 * @param {Error} error - The error object
 * @param {Object} interaction - Discord interaction object (optional)
 */
function logError(commandName, error, interaction = null) {
  const guildId = interaction?.guildId || 'unknown';
  const userId = interaction?.user?.id || 'unknown';
  const errorType = error.name || 'Error';
  const errorMessage = error.message || String(error);

  const logEntry = [
    timestamp(),
    'ERROR',
    commandName,
    errorType,
    `guild:${guildId}`,
    `user:${userId}`,
    errorMessage.replace(/\n/g, ' '),
  ].join(' | ');

  fs.appendFileSync(errorsLogPath, logEntry + '\n');

  // Update stats
  stats.totalErrors++;
  stats.errorTypes[errorType] = (stats.errorTypes[errorType] || 0) + 1;
  
  const today = todayKey();
  if (!stats.dailyActivity[today]) {
    stats.dailyActivity[today] = { commands: 0, errors: 0, uniqueUsers: [] };
  }
  stats.dailyActivity[today].errors++;

  saveStats();
}

/**
 * Log a guild join/leave event
 * @param {string} event - 'join' or 'leave'
 * @param {Object} guild - Discord guild object
 */
function logGuildEvent(event, guild) {
  const logEntry = [
    timestamp(),
    event === 'join' ? 'GUILD_JOIN' : 'GUILD_LEAVE',
    `id:${guild.id}`,
    `name:${guild.name}`,
    `members:${guild.memberCount || 'unknown'}`,
  ].join(' | ');

  fs.appendFileSync(commandsLogPath, logEntry + '\n');

  if (event === 'join') {
    stats.guilds[guild.id] = {
      name: guild.name,
      commands: 0,
      firstSeen: timestamp(),
      memberCount: guild.memberCount,
    };
  } else if (event === 'leave' && stats.guilds[guild.id]) {
    stats.guilds[guild.id].leftAt = timestamp();
  }

  saveStats();
}

/**
 * Get current stats summary
 * @returns {Object} Stats summary
 */
function getStats() {
  const today = todayKey();
  const todayStats = stats.dailyActivity[today] || { commands: 0, errors: 0, uniqueUsers: [] };

  return {
    uptime: stats.startedAt,
    lastUpdated: stats.lastUpdated,
    totals: {
      commands: stats.totalCommands,
      errors: stats.totalErrors,
      errorRate: stats.totalCommands > 0 
        ? ((stats.totalErrors / stats.totalCommands) * 100).toFixed(2) + '%' 
        : '0%',
    },
    today: {
      commands: todayStats.commands,
      errors: todayStats.errors,
      uniqueUsers: todayStats.uniqueUsers?.length || 0,
    },
    topCommands: Object.entries(stats.commandCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cmd, count]) => ({ command: cmd, count })),
    activeGuilds: Object.keys(stats.guilds).filter(
      id => !stats.guilds[id].leftAt
    ).length,
    errorTypes: stats.errorTypes,
  };
}

/**
 * Get formatted stats for Discord embed
 * @returns {string} Formatted stats string
 */
function getFormattedStats() {
  const s = getStats();
  return [
    `**📊 Atlas Bot Statistics**`,
    ``,
    `**All Time**`,
    `• Commands: ${s.totals.commands.toLocaleString()}`,
    `• Errors: ${s.totals.errors.toLocaleString()} (${s.totals.errorRate})`,
    `• Active Servers: ${s.activeGuilds}`,
    ``,
    `**Today**`,
    `• Commands: ${s.today.commands}`,
    `• Unique Users: ${s.today.uniqueUsers}`,
    ``,
    `**Top Commands**`,
    ...s.topCommands.map((c, i) => `${i + 1}. /${c.command}: ${c.count}`),
  ].join('\n');
}

/**
 * Sync command usage to API for dashboard tracking
 * @param {string} command - Command name
 * @param {string} guildId - Guild ID
 * @param {string} userId - User ID
 */
async function syncToApi(command, guildId, userId, latencyMs = null) {
  if (!API_SYNC_ENABLED || !config.apiUrl) return;
  
  try {
    const body = { command, guild_id: guildId, user_id: userId };
    if (latencyMs !== null) body.latency_ms = latencyMs;
    await fetch(`${config.apiUrl}/api/v1/bot/log-command`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.DISCORD_API_KEY || ''
      },
      body: JSON.stringify(body)
    });
  } catch (error) {
    // Silent fail - don't disrupt bot operation for API sync issues
  }
}

module.exports = {
  logCommand,
  logError,
  logGuildEvent,
  getStats,
  getFormattedStats,
  syncToApi,
};
