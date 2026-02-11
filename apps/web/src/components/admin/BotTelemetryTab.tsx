import React, { useState, useEffect, useCallback } from 'react';
import { getAuthHeaders } from '../../services/authHeaders';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

// ============================================================================
// Types
// ============================================================================

interface TelemetryEvent {
  id: string;
  event_type: string;
  severity: 'info' | 'warn' | 'error' | 'critical';
  message: string;
  metadata: Record<string, unknown>;
  process_uptime_seconds: number | null;
  memory_mb: number | null;
  discord_ws_status: number | null;
  discord_guilds: number | null;
  discord_ping: number | null;
  created_at: string;
}

interface TelemetrySummary {
  total_events: number;
  crashes_24h: number;
  memory_warnings: number;
  disconnects: number;
  restarts: number;
  severity_counts: Record<string, number>;
  period_hours: number;
}

interface TelemetryResponse {
  events: TelemetryEvent[];
  summary: TelemetrySummary;
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

const SEVERITY_STYLES: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  info: { bg: '#6b728015', border: '#6b728040', text: '#9ca3af', dot: '#6b7280' },
  warn: { bg: '#eab30815', border: '#eab30840', text: '#eab308', dot: '#eab308' },
  error: { bg: '#ef444415', border: '#ef444440', text: '#ef4444', dot: '#ef4444' },
  critical: { bg: '#dc262620', border: '#dc262660', text: '#fca5a5', dot: '#dc2626' },
};

const EVENT_ICONS: Record<string, string> = {
  startup: '🚀',
  ready: '✅',
  disconnect: '⚡',
  reconnect: '🔄',
  crash: '💥',
  shutdown: '👋',
  login_failed: '🔐',
  login_retry: '🔄',
  memory_warning: '🧠',
  shard_error: '⚠️',
  session_invalidated: '🚫',
  health_check: '💓',
};

const WS_STATUS_NAMES: Record<number, string> = {
  0: 'READY',
  1: 'CONNECTING',
  2: 'RECONNECTING',
  3: 'IDLE',
  4: 'NEARLY',
  5: 'DISCONNECTED',
  6: 'WAITING_FOR_GUILDS',
  7: 'IDENTIFYING',
  8: 'RESUMING',
  [-1]: 'NOT_CONNECTED',
};

// ============================================================================
// Component
// ============================================================================

export const BotTelemetryTab: React.FC = () => {
  const [data, setData] = useState<TelemetryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [hoursFilter, setHoursFilter] = useState<number>(168);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const fetchTelemetry = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders({ requireAuth: false });
      const params = new URLSearchParams({ limit: '100', hours: String(hoursFilter) });
      if (severityFilter !== 'all') params.set('severity', severityFilter);
      if (eventFilter !== 'all') params.set('event_type', eventFilter);

      const res = await fetch(`${API_URL}/api/v1/bot/telemetry?${params}`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: TelemetryResponse = await res.json();
      if (json.error) setError(json.error);
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch telemetry');
    } finally {
      setLoading(false);
    }
  }, [severityFilter, eventFilter, hoursFilter]);

  useEffect(() => {
    fetchTelemetry();
  }, [fetchTelemetry]);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(fetchTelemetry, 60000);
    return () => clearInterval(interval);
  }, [fetchTelemetry]);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const formatUptime = (seconds: number | null) => {
    if (seconds === null) return '—';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const summary = data?.summary;
  const events = data?.events || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Summary Cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
          {[
            { label: 'Total Events', value: summary.total_events, color: '#22d3ee', icon: '📊' },
            { label: 'Crashes (24h)', value: summary.crashes_24h, color: summary.crashes_24h > 0 ? '#ef4444' : '#22c55e', icon: '💥' },
            { label: 'Memory Warnings', value: summary.memory_warnings, color: summary.memory_warnings > 0 ? '#eab308' : '#22c55e', icon: '🧠' },
            { label: 'Disconnects', value: summary.disconnects, color: summary.disconnects > 2 ? '#eab308' : '#22c55e', icon: '⚡' },
            { label: 'Restarts', value: summary.restarts, color: summary.restarts > 3 ? '#eab308' : '#22c55e', icon: '🚀' },
          ].map((card, i) => (
            <div key={i} style={{
              backgroundColor: '#111116',
              borderRadius: '10px',
              padding: '1rem',
              border: '1px solid #2a2a2a',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
                <span style={{ fontSize: '0.9rem' }}>{card.icon}</span>
                <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>{card.label}</span>
              </div>
              <div style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: card.color,
              }}>
                {card.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Severity Breakdown Bar */}
      {summary && summary.total_events > 0 && (
        <div style={{
          backgroundColor: '#111116',
          borderRadius: '10px',
          padding: '0.75rem 1rem',
          border: '1px solid #2a2a2a',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          flexWrap: 'wrap',
        }}>
          <span style={{ color: '#6b7280', fontSize: '0.75rem', fontWeight: 500 }}>Severity:</span>
          <div style={{ display: 'flex', flex: 1, height: '8px', borderRadius: '4px', overflow: 'hidden', minWidth: '100px' }}>
            {(['info', 'warn', 'error', 'critical'] as const).map(s => {
              const count = summary?.severity_counts?.[s] || 0;
              const pct = summary?.total_events ? (count / summary.total_events) * 100 : 0;
              if (pct === 0) return null;
              return (
                <div
                  key={s}
                  title={`${s}: ${count}`}
                  style={{
                    width: `${pct}%`,
                    backgroundColor: SEVERITY_STYLES[s]?.dot ?? '#6b7280',
                    minWidth: count > 0 ? '4px' : '0',
                  }}
                />
              );
            })}
          </div>
          {(['info', 'warn', 'error', 'critical'] as const).map(s => {
            const count = summary?.severity_counts?.[s] || 0;
            if (count === 0) return null;
            return (
              <span key={s} style={{
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                fontSize: '0.7rem', color: SEVERITY_STYLES[s]?.text ?? '#9ca3af',
              }}>
                <span style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  backgroundColor: SEVERITY_STYLES[s]?.dot ?? '#6b7280',
                }} />
                {count} {s}
              </span>
            );
          })}
        </div>
      )}

      {/* Filters + Refresh */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={hoursFilter}
          onChange={e => setHoursFilter(Number(e.target.value))}
          style={selectStyle}
        >
          <option value={24}>Last 24h</option>
          <option value={72}>Last 3 days</option>
          <option value={168}>Last 7 days</option>
          <option value={720}>Last 30 days</option>
        </select>
        <select
          value={severityFilter}
          onChange={e => setSeverityFilter(e.target.value)}
          style={selectStyle}
        >
          <option value="all">All Severity</option>
          <option value="info">Info</option>
          <option value="warn">Warning</option>
          <option value="error">Error</option>
          <option value="critical">Critical</option>
        </select>
        <select
          value={eventFilter}
          onChange={e => setEventFilter(e.target.value)}
          style={selectStyle}
        >
          <option value="all">All Events</option>
          <option value="startup">Startup</option>
          <option value="ready">Ready</option>
          <option value="disconnect">Disconnect</option>
          <option value="reconnect">Reconnect</option>
          <option value="crash">Crash</option>
          <option value="shutdown">Shutdown</option>
          <option value="login_failed">Login Failed</option>
          <option value="login_retry">Login Retry</option>
          <option value="memory_warning">Memory Warning</option>
          <option value="shard_error">Shard Error</option>
          <option value="session_invalidated">Session Invalidated</option>
        </select>
        <button
          onClick={fetchTelemetry}
          style={{
            marginLeft: 'auto',
            padding: '0.35rem 0.7rem',
            background: 'none',
            border: '1px solid #2a2a2a',
            borderRadius: '6px',
            color: '#6b7280',
            cursor: 'pointer',
            fontSize: '0.75rem',
          }}
        >
          {loading ? '...' : '↻ Refresh'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '0.75rem 1rem',
          backgroundColor: '#ef444415',
          border: '1px solid #ef444440',
          borderRadius: '8px',
          color: '#ef4444',
          fontSize: '0.85rem',
        }}>
          {error}
        </div>
      )}

      {/* Event List */}
      {loading && !data ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>Loading telemetry...</div>
      ) : events.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
          No telemetry events found. The bot may not have logged any events yet, or SUPABASE_URL/SUPABASE_SERVICE_KEY may not be set on Render.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {events.map(event => {
            const sev = SEVERITY_STYLES[event.severity] ?? SEVERITY_STYLES.info;
            const icon = EVENT_ICONS[event.event_type] || '📌';
            const isExpanded = expandedEvent === event.id;
            const isCritical = event.severity === 'critical';

            return (
              <div
                key={event.id}
                onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
                style={{
                  backgroundColor: sev?.bg ?? '#111116',
                  border: `1px solid ${sev?.border ?? '#2a2a2a'}`,
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                  ...(isCritical ? { animation: 'pulse-border 2s infinite' } : {}),
                }}
              >
                {/* Header Row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.9rem' }}>{icon}</span>
                  <span style={{
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    backgroundColor: sev?.border ?? '#2a2a2a',
                    color: sev?.text ?? '#9ca3af',
                  }}>
                    {event.severity}
                  </span>
                  <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 500 }}>
                    {event.event_type.replace(/_/g, ' ')}
                  </span>
                  <span style={{ color: '#6b7280', fontSize: '0.75rem', marginLeft: 'auto' }}>
                    {timeAgo(event.created_at)}
                  </span>
                </div>

                {/* Message */}
                <div style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: '0.3rem' }}>
                  {event.message}
                </div>

                {/* Quick Stats Row */}
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                  {event.memory_mb !== null && (
                    <span style={{ color: '#6b7280', fontSize: '0.7rem' }}>
                      💾 {event.memory_mb}MB
                    </span>
                  )}
                  {event.process_uptime_seconds !== null && (
                    <span style={{ color: '#6b7280', fontSize: '0.7rem' }}>
                      ⏱️ {formatUptime(event.process_uptime_seconds)}
                    </span>
                  )}
                  {event.discord_ws_status !== null && (
                    <span style={{ color: '#6b7280', fontSize: '0.7rem' }}>
                      🔌 {WS_STATUS_NAMES[event.discord_ws_status] || `WS:${event.discord_ws_status}`}
                    </span>
                  )}
                  {event.discord_guilds !== null && (
                    <span style={{ color: '#6b7280', fontSize: '0.7rem' }}>
                      🏰 {event.discord_guilds} guilds
                    </span>
                  )}
                  {event.discord_ping !== null && (
                    <span style={{ color: '#6b7280', fontSize: '0.7rem' }}>
                      📶 {event.discord_ping}ms
                    </span>
                  )}
                </div>

                {/* Expanded Metadata */}
                {isExpanded && event.metadata && Object.keys(event.metadata).length > 0 && (
                  <div style={{
                    marginTop: '0.5rem',
                    padding: '0.5rem',
                    backgroundColor: '#0a0a0a',
                    borderRadius: '6px',
                    fontSize: '0.7rem',
                    fontFamily: 'monospace',
                    color: '#9ca3af',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}>
                    {JSON.stringify(event.metadata, null, 2)}
                  </div>
                )}
                {isExpanded && (
                  <div style={{ color: '#4b5563', fontSize: '0.65rem', marginTop: '0.3rem' }}>
                    {new Date(event.created_at).toLocaleString()} • ID: {event.id.slice(0, 8)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* CSS for critical pulse animation */}
      <style>{`
        @keyframes pulse-border {
          0%, 100% { border-color: #dc262660; }
          50% { border-color: #ef4444; }
        }
      `}</style>
    </div>
  );
};

// ============================================================================
// Shared styles
// ============================================================================

const selectStyle: React.CSSProperties = {
  padding: '0.35rem 0.6rem',
  backgroundColor: '#111116',
  color: '#fff',
  border: '1px solid #2a2a2a',
  borderRadius: '6px',
  fontSize: '0.75rem',
  cursor: 'pointer',
};

export default BotTelemetryTab;
