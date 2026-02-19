/**
 * Bot Telemetry — Persistent lifecycle logging to Supabase
 * 
 * Logs startup, shutdown, crashes, disconnects, and memory warnings
 * directly to Supabase via REST API (no SDK needed).
 * 
 * Requires env vars:
 *   SUPABASE_URL — e.g. https://qdczmafwcvnwfvixxbwg.supabase.co
 *   SUPABASE_SERVICE_KEY — service_role key (bypasses RLS)
 * 
 * All writes are fire-and-forget to avoid blocking the bot.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const ENABLED = !!(SUPABASE_URL && SUPABASE_SERVICE_KEY);

if (!ENABLED) {
  console.warn('⚠️ Telemetry disabled — SUPABASE_URL or SUPABASE_SERVICE_KEY not set');
}

// Memory monitoring thresholds (MB)
const MEMORY_WARN_MB = 200;
const MEMORY_CRITICAL_MB = 400;
const MEMORY_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
let memoryCheckTimer = null;
let lastMemoryWarning = 0; // Prevent spam — only warn once per 30min
const MEMORY_WARNING_COOLDOWN = 30 * 60 * 1000;

// Uptime health alert — detect crash loops (uptime < 5min for 3 consecutive starts)
const SHORT_UPTIME_THRESHOLD = 5 * 60; // 5 minutes in seconds
const CRASH_LOOP_COUNT = 3;
let recentStartups = []; // timestamps of recent startups

/**
 * Get current process snapshot for metadata
 */
function getProcessSnapshot(client) {
  const mem = process.memoryUsage();
  return {
    process_uptime_seconds: Math.floor(process.uptime()),
    memory_mb: Math.floor(mem.heapUsed / 1024 / 1024),
    discord_ws_status: client?.ws?.status ?? -1,
    discord_guilds: client?.guilds?.cache?.size ?? 0,
    discord_ping: client?.ws?.ping ?? null,
  };
}

/**
 * Log a telemetry event to Supabase (fire-and-forget)
 */
async function logEvent(eventType, severity, message, metadata = {}, client = null) {
  if (!ENABLED) return;

  const snapshot = getProcessSnapshot(client);

  const payload = {
    event_type: eventType,
    severity,
    message,
    metadata,
    ...snapshot,
  };

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/bot_telemetry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      // Silent fail — don't let telemetry break the bot
      console.error(`⚠️ Telemetry write failed: ${res.status} ${res.statusText}`);
    }
  } catch (err) {
    // Network error — completely silent to avoid cascade failures
    console.error(`⚠️ Telemetry network error: ${err.message}`);
  }
}

// ============================================================================
// Convenience methods
// ============================================================================

function logStartup(metadata = {}) {
  // Crash loop detection: track recent startups to detect rapid restart cycles
  const now = Date.now();
  recentStartups.push(now);
  // Keep only startups within the last 30 minutes
  recentStartups = recentStartups.filter(ts => now - ts < 30 * 60 * 1000);

  const isCrashLoop = recentStartups.length >= CRASH_LOOP_COUNT &&
    recentStartups.every((ts, i) => i === 0 || (ts - recentStartups[i - 1]) < SHORT_UPTIME_THRESHOLD * 1000);

  if (isCrashLoop) {
    console.error(`🚨 CRASH LOOP DETECTED: ${recentStartups.length} restarts within ${SHORT_UPTIME_THRESHOLD}s each`);
    logEvent('crash_loop', 'critical', `Crash loop detected: ${recentStartups.length} restarts in rapid succession`, {
      restart_count: recentStartups.length,
      threshold_seconds: SHORT_UPTIME_THRESHOLD,
      restart_timestamps: recentStartups.map(ts => new Date(ts).toISOString()),
    });
  }

  return logEvent('startup', isCrashLoop ? 'warn' : 'info', 'Bot process starting', {
    node_version: process.version,
    platform: process.platform,
    pid: process.pid,
    recent_restart_count: recentStartups.length,
    crash_loop_detected: isCrashLoop,
    ...metadata,
  });
}

function logReady(client) {
  return logEvent('ready', 'info', `Discord connected — ${client?.guilds?.cache?.size || 0} guilds`, {
    guilds: client?.guilds?.cache?.map(g => ({ id: g.id, name: g.name, members: g.memberCount })) || [],
  }, client);
}

function logDisconnect(code, reason, client) {
  const severity = [4004, 4013, 4014].includes(code) ? 'critical' : 'warn';
  return logEvent('disconnect', severity, `Shard disconnected: ${code} (${reason})`, {
    close_code: code,
    close_reason: reason,
  }, client);
}

function logReconnect(shardId, replayedEvents, client) {
  return logEvent('reconnect', 'info', `Shard ${shardId} resumed (${replayedEvents} events replayed)`, {
    shard_id: shardId,
    replayed_events: replayedEvents,
  }, client);
}

function logLoginFailed(error) {
  return logEvent('login_failed', 'error', `Login failed: ${error.message}`, {
    error_code: error.code || null,
    error_message: error.message,
  });
}

function logLoginRetry(attempt, maxRetries, delayMs) {
  return logEvent('login_retry', 'warn', `Login retry ${attempt}/${maxRetries} in ${Math.round(delayMs / 1000)}s`, {
    attempt,
    max_retries: maxRetries,
    delay_ms: delayMs,
  });
}

function logShutdown(signal, client) {
  return logEvent('shutdown', 'info', `Graceful shutdown: ${signal}`, { signal }, client);
}

function logCrash(error, context = 'uncaughtException') {
  return logEvent('crash', 'critical', `${context}: ${error.message}`, {
    context,
    error_message: error.message,
    error_stack: error.stack?.substring(0, 1000),
  });
}

function logShardError(shardId, error, client) {
  return logEvent('shard_error', 'error', `Shard ${shardId}: ${error.message}`, {
    shard_id: shardId,
    error_code: error.code || null,
    error_message: error.message,
  }, client);
}

function logSessionInvalidated(client) {
  return logEvent('session_invalidated', 'error', 'Discord session invalidated — token may be invalid', {}, client);
}

function logMemoryWarning(memMb, severity, client) {
  return logEvent('memory_warning', severity, `Memory usage: ${memMb}MB (threshold: ${severity === 'critical' ? MEMORY_CRITICAL_MB : MEMORY_WARN_MB}MB)`, {
    heap_used_mb: memMb,
    heap_total_mb: Math.floor(process.memoryUsage().heapTotal / 1024 / 1024),
    rss_mb: Math.floor(process.memoryUsage().rss / 1024 / 1024),
  }, client);
}

// ============================================================================
// Memory monitoring
// ============================================================================

function startMemoryMonitoring(client) {
  if (memoryCheckTimer) clearInterval(memoryCheckTimer);

  memoryCheckTimer = setInterval(() => {
    const memMb = Math.floor(process.memoryUsage().heapUsed / 1024 / 1024);
    const now = Date.now();

    if (memMb >= MEMORY_CRITICAL_MB && (now - lastMemoryWarning) > MEMORY_WARNING_COOLDOWN) {
      console.error(`🚨 CRITICAL: Memory at ${memMb}MB (threshold: ${MEMORY_CRITICAL_MB}MB)`);
      logMemoryWarning(memMb, 'critical', client);
      lastMemoryWarning = now;
    } else if (memMb >= MEMORY_WARN_MB && (now - lastMemoryWarning) > MEMORY_WARNING_COOLDOWN) {
      console.warn(`⚠️ Memory warning: ${memMb}MB (threshold: ${MEMORY_WARN_MB}MB)`);
      logMemoryWarning(memMb, 'warn', client);
      lastMemoryWarning = now;
    }
  }, MEMORY_CHECK_INTERVAL);

  console.log(`📊 Memory monitoring started (warn: ${MEMORY_WARN_MB}MB, critical: ${MEMORY_CRITICAL_MB}MB, check every ${MEMORY_CHECK_INTERVAL / 60000}min)`);
}

function stopMemoryMonitoring() {
  if (memoryCheckTimer) {
    clearInterval(memoryCheckTimer);
    memoryCheckTimer = null;
  }
}

module.exports = {
  logStartup,
  logReady,
  logDisconnect,
  logReconnect,
  logLoginFailed,
  logLoginRetry,
  logShutdown,
  logCrash,
  logShardError,
  logSessionInvalidated,
  logMemoryWarning,
  startMemoryMonitoring,
  stopMemoryMonitoring,
  ENABLED,
};
