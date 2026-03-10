import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { logger } from '../../utils/logger';

interface KingdomTransferRow {
  id: string;
  user_id: string;
  from_kingdom: number;
  to_kingdom: number;
  detected_at: string;
  linked_player_id: string | null;
  linked_username: string | null;
  // joined from profiles
  username?: string;
  avatar_url?: string;
  subscription_tier?: string;
}

export const KingdomTransfersTab: React.FC = () => {
  const [transfers, setTransfers] = useState<KingdomTransferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    const fetch = async () => {
      if (!supabase) return;
      setLoading(true);
      try {
        const since = new Date();
        since.setDate(since.getDate() - days);

        const { data, error } = await supabase
          .from('kingdom_transfers')
          .select('*')
          .gte('detected_at', since.toISOString())
          .order('detected_at', { ascending: false })
          .limit(200);

        if (error) throw error;

        // Enrich with profile data
        if (data?.length) {
          const userIds = [...new Set(data.map(t => t.user_id))];
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, username, linked_username, display_name, avatar_url, subscription_tier')
            .in('id', userIds);

          const profileMap = new Map((profiles || []).map(p => [p.id, p]));
          for (const t of data) {
            const p = profileMap.get(t.user_id);
            if (p) {
              t.username = p.linked_username || p.display_name || p.username;
              t.avatar_url = p.avatar_url;
              t.subscription_tier = p.subscription_tier;
            }
          }
        }

        setTransfers(data || []);
      } catch (err) {
        logger.error('Failed to fetch kingdom transfers:', err);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [days]);

  const uniqueUsers = new Set(transfers.map(t => t.user_id)).size;

  return (
    <div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1rem',
        flexWrap: 'wrap',
        gap: '0.75rem',
      }}>
        <div>
          <h3 style={{ color: '#fff', margin: 0, fontSize: '1rem' }}>
            Kingdom Transfers
          </h3>
          <p style={{ color: '#6b7280', margin: '0.25rem 0 0', fontSize: '0.8rem' }}>
            Auto-detected when linked_kingdom changes during player sync
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {[7, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              style={{
                padding: '0.3rem 0.6rem',
                backgroundColor: days === d ? '#a855f720' : 'transparent',
                color: days === d ? '#a855f7' : '#6b7280',
                border: days === d ? '1px solid #a855f740' : '1px solid transparent',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 500,
              }}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '1rem',
        flexWrap: 'wrap',
      }}>
        {[
          { label: 'Total Transfers', value: transfers.length, color: '#a855f7' },
          { label: 'Unique Users', value: uniqueUsers, color: '#3b82f6' },
        ].map(stat => (
          <div key={stat.label} style={{
            padding: '0.75rem 1rem',
            backgroundColor: '#111116',
            borderRadius: '8px',
            border: '1px solid #1a1a2e',
            minWidth: '120px',
          }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ color: '#6b7280', padding: '2rem', textAlign: 'center' }}>Loading...</div>
      ) : transfers.length === 0 ? (
        <div style={{ color: '#6b7280', padding: '2rem', textAlign: 'center', fontSize: '0.9rem' }}>
          No kingdom transfers detected in the last {days} days.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1a1a2e' }}>
                {['User', 'Player', 'From', 'To', 'Detected'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left',
                    padding: '0.5rem 0.75rem',
                    color: '#6b7280',
                    fontWeight: 500,
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transfers.map(t => {
                const date = new Date(t.detected_at);
                const timeAgo = getTimeAgo(date);
                return (
                  <tr key={t.id} style={{ borderBottom: '1px solid #111116' }}>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {t.avatar_url && (
                          <img
                            src={t.avatar_url}
                            alt=""
                            style={{ width: 24, height: 24, borderRadius: '50%' }}
                          />
                        )}
                        <span style={{ color: '#e5e7eb', fontWeight: 500 }}>{t.username || 'Unknown'}</span>
                        {t.subscription_tier && t.subscription_tier !== 'free' && (
                          <span style={{
                            fontSize: '0.6rem',
                            backgroundColor: '#a855f720',
                            color: '#a855f7',
                            padding: '0.1rem 0.3rem',
                            borderRadius: '4px',
                            fontWeight: 600,
                          }}>{t.subscription_tier}</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', color: '#9ca3af', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      {t.linked_username || t.linked_player_id || '—'}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      <span style={{
                        color: '#ef4444',
                        fontFamily: 'monospace',
                        fontWeight: 600,
                      }}>K{t.from_kingdom}</span>
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      <span style={{
                        color: '#22c55e',
                        fontFamily: 'monospace',
                        fontWeight: 600,
                      }}>K{t.to_kingdom}</span>
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', color: '#6b7280', fontSize: '0.8rem' }}>
                      {timeAgo}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHrs < 1) return 'Just now';
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 30) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}
