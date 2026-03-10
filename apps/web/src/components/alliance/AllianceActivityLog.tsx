import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { FONT_DISPLAY } from '../../utils/styles';

interface ActivityEntry {
  id: string;
  actor_name: string;
  action: string;
  target_name: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

const ACTION_META: Record<string, { icon: string; color: string; label: string }> = {
  member_added:          { icon: '➕', color: '#22c55e', label: 'added member' },
  member_removed:        { icon: '➖', color: '#ef4444', label: 'removed member' },
  member_updated:        { icon: '✏️', color: '#3b82f6', label: 'updated member' },
  application_approved:  { icon: '✅', color: '#22c55e', label: 'approved application from' },
  application_rejected:  { icon: '❌', color: '#ef4444', label: 'rejected application from' },
  ownership_transferred: { icon: '🔄', color: '#f59e0b', label: 'transferred ownership to' },
  manager_added:         { icon: '⚙️', color: '#a855f7', label: 'added manager' },
  manager_removed:       { icon: '⚙️', color: '#ef4444', label: 'removed manager' },
  alliance_updated:      { icon: '✏️', color: '#3b82f6', label: 'updated alliance settings' },
  alliance_created:      { icon: '🏰', color: '#22d3ee', label: 'created the alliance center' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const AllianceActivityLog: React.FC<{
  allianceId: string;
  isMobile: boolean;
}> = ({ allianceId, isMobile }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['alliance-activity-log', allianceId],
    queryFn: async () => {
      if (!isSupabaseConfigured || !supabase) return [];
      const { data, error } = await supabase
        .from('alliance_activity_log')
        .select('id, actor_name, action, target_name, details, created_at')
        .eq('alliance_id', allianceId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error || !data) return [];
      return data as ActivityEntry[];
    },
    staleTime: 60 * 1000,
  });

  if (entries.length === 0 && !isLoading) return null;

  return (
    <div style={{
      backgroundColor: '#111111', borderRadius: '12px', border: '1px solid #ffffff08',
      marginBottom: '1.5rem', overflow: 'hidden',
    }}>
      <button
        onClick={() => setExpanded(prev => !prev)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: isMobile ? '0.75rem' : '0.85rem 1rem',
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#fff', fontFamily: FONT_DISPLAY, WebkitTapHighlightColor: 'transparent',
          minHeight: isMobile ? '44px' : undefined,
        }}
      >
        <span style={{ fontSize: '0.9rem' }}>📋</span>
        <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>
          {t('allianceCenter.activityLogTitle', 'Recent Activity')}
        </span>
        {entries.length > 0 && (
          <span style={{
            fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '10px',
            backgroundColor: '#22d3ee20', color: '#22d3ee', fontFamily: 'monospace',
          }}>{entries.length}</span>
        )}
        <span style={{
          marginLeft: 'auto', fontSize: '0.7rem', color: '#6b7280',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
        }}>▼</span>
      </button>

      {expanded && (
        <div style={{ padding: isMobile ? '0 0.75rem 0.75rem' : '0 1rem 1rem' }}>
          {isLoading ? (
            <div style={{ color: '#6b7280', fontSize: '0.75rem', padding: '0.5rem 0' }}>
              {t('common.loading', 'Loading...')}
            </div>
          ) : entries.length === 0 ? (
            <div style={{ color: '#4b5563', fontSize: '0.75rem', padding: '0.5rem 0', textAlign: 'center' }}>
              {t('allianceCenter.noActivity', 'No activity recorded yet.')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
              {entries.map(entry => {
                const meta = ACTION_META[entry.action] || { icon: '•', color: '#6b7280', label: entry.action };
                return (
                  <div key={entry.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                    padding: '0.4rem 0.5rem', borderRadius: '6px',
                    transition: 'background-color 0.1s',
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#ffffff05'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    <span style={{ fontSize: '0.75rem', flexShrink: 0, marginTop: '0.05rem' }}>{meta.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.75rem', color: '#d1d5db', lineHeight: 1.4 }}>
                        <span style={{ fontWeight: 600, color: '#e5e7eb' }}>{entry.actor_name}</span>
                        {' '}
                        <span style={{ color: '#9ca3af' }}>{meta.label}</span>
                        {entry.target_name && (
                          <>
                            {' '}
                            <span style={{ fontWeight: 600, color: meta.color }}>{entry.target_name}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span style={{ color: '#4b5563', fontSize: '0.6rem', flexShrink: 0, whiteSpace: 'nowrap', marginTop: '0.1rem' }}>
                      {timeAgo(entry.created_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AllianceActivityLog;
