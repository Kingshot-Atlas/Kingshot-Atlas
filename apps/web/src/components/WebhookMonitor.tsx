/**
 * Webhook Events Monitor for Admin Dashboard
 * 
 * WHY THIS MATTERS:
 * - 5-10% of payments fail silently without webhook monitoring
 * - Failed webhooks = lost revenue and broken subscriptions
 * - Health indicator prevents issues from going unnoticed
 */
import React, { useState } from 'react';
import { useWebhookEvents, useWebhookStats } from '../hooks/useAdminQueries';

interface WebhookEvent {
  id: string;
  event_id: string;
  event_type: string;
  status: string;
  error_message?: string;
  processing_time_ms?: number;
  customer_id?: string;
  created_at: string;
  processed_at?: string;
}

interface WebhookStats {
  total_24h: number;
  processed: number;
  failed: number;
  failure_rate: number;
  health: 'healthy' | 'warning' | 'critical' | 'unknown';
}

const COLORS = {
  primary: '#22d3ee',
  success: '#22c55e',
  warning: '#fbbf24',
  danger: '#ef4444',
  muted: '#6b7280',
  background: '#111116',
  border: '#2a2a2a'
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'processed': return COLORS.success;
    case 'failed': return COLORS.danger;
    case 'received': return COLORS.warning;
    default: return COLORS.muted;
  }
};

const getHealthColor = (health: string) => {
  switch (health) {
    case 'healthy': return COLORS.success;
    case 'warning': return COLORS.warning;
    case 'critical': return COLORS.danger;
    default: return COLORS.muted;
  }
};

const formatEventType = (type: string) => {
  return type.replace(/\./g, ' → ').replace(/_/g, ' ');
};

const formatTimeAgo = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

// Health Status Card
const HealthCard: React.FC<{ stats: WebhookStats }> = ({ stats }) => {
  const healthColor = getHealthColor(stats.health);
  const healthEmoji = stats.health === 'healthy' ? '✅' : 
                      stats.health === 'warning' ? '⚠️' : 
                      stats.health === 'critical' ? '🚨' : '❓';

  return (
    <div style={{
      backgroundColor: COLORS.background,
      borderRadius: '12px',
      padding: '1.25rem',
      border: `1px solid ${healthColor}40`,
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
      gap: '1rem'
    }}>
      <div>
        <div style={{ fontSize: '0.75rem', color: COLORS.muted, textTransform: 'uppercase' }}>Health</div>
        <div style={{ fontSize: '1.25rem', fontWeight: '700', color: healthColor, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {healthEmoji} {stats.health}
        </div>
      </div>
      <div>
        <div style={{ fontSize: '0.75rem', color: COLORS.muted, textTransform: 'uppercase' }}>24h Events</div>
        <div style={{ fontSize: '1.25rem', fontWeight: '700', color: COLORS.primary }}>{stats.total_24h}</div>
      </div>
      <div>
        <div style={{ fontSize: '0.75rem', color: COLORS.muted, textTransform: 'uppercase' }}>Processed</div>
        <div style={{ fontSize: '1.25rem', fontWeight: '700', color: COLORS.success }}>{stats.processed}</div>
      </div>
      <div>
        <div style={{ fontSize: '0.75rem', color: COLORS.muted, textTransform: 'uppercase' }}>Failed</div>
        <div style={{ fontSize: '1.25rem', fontWeight: '700', color: stats.failed > 0 ? COLORS.danger : COLORS.success }}>{stats.failed}</div>
      </div>
      <div>
        <div style={{ fontSize: '0.75rem', color: COLORS.muted, textTransform: 'uppercase' }}>Failure Rate</div>
        <div style={{ fontSize: '1.25rem', fontWeight: '700', color: stats.failure_rate > 5 ? COLORS.danger : COLORS.success }}>{stats.failure_rate}%</div>
      </div>
    </div>
  );
};

// Event Row Component
const EventRow: React.FC<{ event: WebhookEvent }> = ({ event }) => {
  const [expanded, setExpanded] = useState(false);
  const statusColor = getStatusColor(event.status);

  return (
    <div style={{
      backgroundColor: COLORS.background,
      borderRadius: '8px',
      border: `1px solid ${COLORS.border}`,
      overflow: 'hidden'
    }}>
      <div 
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: '0.75rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: statusColor,
            flexShrink: 0
          }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ 
              fontSize: '0.85rem', 
              color: '#fff', 
              fontWeight: '500',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {formatEventType(event.event_type)}
            </div>
            <div style={{ fontSize: '0.7rem', color: COLORS.muted }}>
              {event.event_id.substring(0, 20)}...
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
          {event.processing_time_ms && (
            <span style={{ fontSize: '0.75rem', color: COLORS.muted }}>
              {event.processing_time_ms}ms
            </span>
          )}
          <span style={{
            padding: '0.2rem 0.5rem',
            backgroundColor: `${statusColor}20`,
            color: statusColor,
            borderRadius: '4px',
            fontSize: '0.7rem',
            fontWeight: '600',
            textTransform: 'uppercase'
          }}>
            {event.status}
          </span>
          <span style={{ fontSize: '0.75rem', color: COLORS.muted }}>
            {formatTimeAgo(event.created_at)}
          </span>
          <span style={{ color: COLORS.muted }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>
      
      {expanded && (
        <div style={{ 
          padding: '0.75rem 1rem', 
          borderTop: `1px solid ${COLORS.border}`,
          backgroundColor: '#0a0a0f'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.8rem' }}>
            <div>
              <span style={{ color: COLORS.muted }}>Event ID:</span>{' '}
              <span style={{ color: '#fff', fontFamily: 'monospace' }}>{event.event_id}</span>
            </div>
            {event.customer_id && (
              <div>
                <span style={{ color: COLORS.muted }}>Customer:</span>{' '}
                <span style={{ color: '#fff', fontFamily: 'monospace' }}>{event.customer_id}</span>
              </div>
            )}
            <div>
              <span style={{ color: COLORS.muted }}>Created:</span>{' '}
              <span style={{ color: '#fff' }}>{new Date(event.created_at).toLocaleString()}</span>
            </div>
            {event.processed_at && (
              <div>
                <span style={{ color: COLORS.muted }}>Processed:</span>{' '}
                <span style={{ color: '#fff' }}>{new Date(event.processed_at).toLocaleString()}</span>
              </div>
            )}
          </div>
          {event.error_message && (
            <div style={{ 
              marginTop: '0.75rem', 
              padding: '0.5rem', 
              backgroundColor: `${COLORS.danger}10`,
              borderRadius: '4px',
              border: `1px solid ${COLORS.danger}30`
            }}>
              <span style={{ color: COLORS.danger, fontSize: '0.8rem' }}>Error: {event.error_message}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Main Webhook Monitor Component
export const WebhookMonitor: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'processed' | 'failed'>('all');

  const { data: events = [], isLoading: eventsLoading, error: eventsError, refetch: refetchEvents } = useWebhookEvents(filter);
  const { data: stats = null, error: statsError, refetch: refetchStats } = useWebhookStats();

  const loading = eventsLoading;
  const error = eventsError || statsError ? 'Failed to load webhook data' : null;
  const loadData = () => { refetchEvents(); refetchStats(); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Error Banner */}
      {error && (
        <div style={{
          padding: '0.75rem 1rem',
          backgroundColor: '#ef444420',
          border: '1px solid #ef444450',
          borderRadius: '8px',
          color: '#ef4444',
          fontSize: '0.85rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>⚠️ {error}</span>
          <button onClick={() => { loadData(); }} style={{ background: 'none', border: '1px solid #ef444450', borderRadius: '4px', color: '#ef4444', padding: '0.2rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem' }}>Retry</button>
        </div>
      )}
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ color: '#fff', margin: 0, fontSize: '1.25rem' }}>🔗 Webhook Monitor</h2>
          <p style={{ color: COLORS.muted, margin: '0.25rem 0 0', fontSize: '0.8rem' }}>
            Track Stripe webhook events and health status
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['all', 'processed', 'failed'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '0.4rem 0.75rem',
                backgroundColor: filter === f ? COLORS.primary + '20' : 'transparent',
                border: `1px solid ${filter === f ? COLORS.primary : COLORS.border}`,
                borderRadius: '6px',
                color: filter === f ? COLORS.primary : COLORS.muted,
                cursor: 'pointer',
                fontSize: '0.8rem',
                textTransform: 'capitalize'
              }}
            >
              {f}
            </button>
          ))}
          <button
            onClick={loadData}
            style={{
              padding: '0.4rem 0.75rem',
              backgroundColor: 'transparent',
              border: `1px solid ${COLORS.border}`,
              borderRadius: '6px',
              color: COLORS.muted,
              cursor: 'pointer',
              fontSize: '0.8rem'
            }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Health Stats */}
      {stats && <HealthCard stats={stats} />}

      {/* Events List */}
      <div>
        <h3 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1rem' }}>
          Recent Events {events.length > 0 && `(${events.length})`}
        </h3>
        
        {loading && events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: COLORS.muted }}>
            Loading webhook events...
          </div>
        ) : events.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '2rem', 
            color: COLORS.muted,
            backgroundColor: COLORS.background,
            borderRadius: '8px',
            border: `1px solid ${COLORS.border}`
          }}>
            No webhook events yet. Events will appear here when Stripe sends webhooks.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {events.map(event => (
              <EventRow key={event.id || event.event_id} event={event} />
            ))}
          </div>
        )}
      </div>

      {/* Migration Notice */}
      <div style={{ 
        padding: '1rem', 
        backgroundColor: '#1e3a5f20', 
        borderRadius: '8px',
        border: `1px solid ${COLORS.primary}30`,
        fontSize: '0.8rem',
        color: COLORS.muted
      }}>
        <strong style={{ color: COLORS.primary }}>📋 Setup Required:</strong> Run the migration{' '}
        <code style={{ 
          backgroundColor: '#0a0a0f', 
          padding: '0.1rem 0.3rem', 
          borderRadius: '4px',
          fontFamily: 'monospace',
          fontSize: '0.75rem'
        }}>
          docs/migrations/add_webhook_events.sql
        </code>{' '}
        in Supabase SQL Editor to enable webhook logging.
      </div>

      {/* Last Updated */}
      <div style={{ textAlign: 'center', color: COLORS.muted, fontSize: '0.75rem' }}>
        Last updated: {new Date().toLocaleTimeString()} • Auto-refreshes every 30s
      </div>
    </div>
  );
};

export default WebhookMonitor;
