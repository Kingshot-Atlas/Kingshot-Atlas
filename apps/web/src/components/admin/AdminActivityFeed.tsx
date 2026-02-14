import React, { useState, useEffect } from 'react';
import { getAuthHeaders } from '../../services/authHeaders';
import { colors } from '../../utils/styles';
import { logger } from '../../utils/logger';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

interface AuditEntry {
  id: string;
  admin_email: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

const ACTION_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  sync_subscriptions: { label: 'Synced subscriptions', icon: '🔄', color: '#22d3ee' },
  recalculate_scores: { label: 'Recalculated scores', icon: '📊', color: '#a855f7' },
  set_current_kvk: { label: 'Updated KvK number', icon: '⚔️', color: '#fbbf24' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export const AdminActivityFeed: React.FC = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    try {
      const authHeaders = await getAuthHeaders({ requireAuth: false });
      const res = await fetch(`${API_URL}/api/v1/admin/audit-log?limit=10`, {
        headers: authHeaders
      });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
      }
    } catch (e) {
      logger.error('Failed to fetch audit log:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '1rem', color: '#6b7280', fontSize: '0.85rem' }}>
        Loading activity...
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div style={{
        padding: '1.5rem',
        textAlign: 'center',
        color: '#6b7280',
        fontSize: '0.85rem',
        backgroundColor: colors.cardAlt,
        borderRadius: '12px',
        border: '1px solid #2a2a2a'
      }}>
        No admin activity recorded yet
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: colors.cardAlt,
      borderRadius: '12px',
      border: '1px solid #2a2a2a',
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '0.75rem 1rem',
        borderBottom: '1px solid #2a2a2a',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600 }}>Admin Activity</span>
        <button onClick={fetchEntries} style={{
          background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.75rem'
        }}>Refresh</button>
      </div>
      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {entries.map(entry => {
          const meta = ACTION_LABELS[entry.action] || { label: entry.action, icon: '⚡', color: '#6b7280' };
          return (
            <div key={entry.id} style={{
              padding: '0.6rem 1rem',
              borderBottom: '1px solid #1a1a1f',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              fontSize: '0.8rem'
            }}>
              <span>{meta.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ color: meta.color, fontWeight: 500 }}>{meta.label}</span>
                {entry.details && Object.keys(entry.details).length > 0 && (
                  <span style={{ color: '#6b7280', marginLeft: '0.4rem' }}>
                    ({Object.entries(entry.details).map(([k, v]) => `${k}: ${v}`).join(', ')})
                  </span>
                )}
              </div>
              <span style={{ color: '#4b5563', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                {timeAgo(entry.created_at)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
