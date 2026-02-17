import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { colors } from '../../utils/styles';
import { ApplicationCard } from './index';
import type { IncomingApplication } from './types';
import { formatTCLevel } from './types';

const downloadApprovedCSV = (apps: IncomingApplication[]) => {
  const headers = ['Player ID', 'Username', 'Kingdom', 'TC Level', 'Power', 'Language', 'KvK Availability', 'Applied At', 'Note'];
  const rows = apps.map(app => [
    app.profile?.linked_player_id || '',
    app.profile?.username || 'Anonymous',
    app.profile?.current_kingdom?.toString() || '',
    app.profile?.tc_level ? formatTCLevel(app.profile.tc_level) : '',
    app.profile?.power_million ? `${app.profile.power_million}M` : app.profile?.power_range || '',
    app.profile?.main_language || '',
    app.profile?.kvk_availability || '',
    new Date(app.applied_at).toLocaleDateString(),
    app.applicant_note || '',
  ]);
  const csvContent = [headers, ...rows].map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `approved_applicants_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

interface InboxTabProps {
  listingViews: number;
  filterStatus: string;
  setFilterStatus: (status: string) => void;
  activeApps: IncomingApplication[];
  approvedApps: IncomingApplication[];
  closedApps: IncomingApplication[];
  filteredApps: IncomingApplication[];
  handleStatusChange: (applicationId: string, newStatus: string) => Promise<void>;
  updating: string | null;
  fundTier?: string;
  perAppUnreadCounts?: Record<string, number>;
}

const InboxTab: React.FC<InboxTabProps> = ({
  listingViews,
  filterStatus,
  setFilterStatus,
  activeApps,
  approvedApps,
  closedApps,
  filteredApps,
  handleStatusChange,
  updating,
  fundTier,
  perAppUnreadCounts,
}) => {
  const { t } = useTranslation();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedIds.size === filteredApps.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredApps.map(a => a.id)));
    }
  }, [selectedIds.size, filteredApps]);

  const handleBulkAction = useCallback(async (newStatus: string) => {
    if (selectedIds.size === 0 || bulkUpdating) return;
    setBulkUpdating(true);
    try {
      const promises = Array.from(selectedIds).map(id => handleStatusChange(id, newStatus));
      await Promise.all(promises);
      setSelectedIds(new Set());
    } finally {
      setBulkUpdating(false);
    }
  }, [selectedIds, bulkUpdating, handleStatusChange]);

  return (
    <div>
      {/* Editor Analytics Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: '0.5rem',
        marginBottom: '0.75rem',
      }}>
        {[
          { label: t('recruiter.profileViews', 'Profile Views'), value: listingViews, sub: t('recruiter.last30Days', 'last 30 days'), color: colors.pink, icon: '👁️' },
        ].map((stat, i) => (
          <div key={i} style={{
            backgroundColor: colors.card,
            borderRadius: '8px',
            padding: '0.5rem 0.6rem',
            border: '1px solid #1a1a1a',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '0.6rem', color: '#4b5563', marginBottom: '0.15rem' }}>{stat.icon} {stat.label}</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: '0.55rem', color: '#374151' }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <button
          onClick={() => setFilterStatus('active')}
          style={{
            padding: '0.3rem 0.6rem',
            backgroundColor: filterStatus === 'active' ? '#22d3ee10' : 'transparent',
            border: `1px solid ${filterStatus === 'active' ? '#22d3ee30' : '#2a2a2a'}`,
            borderRadius: '6px',
            color: filterStatus === 'active' ? '#22d3ee' : '#6b7280',
            fontSize: '0.75rem',
            cursor: 'pointer',
            minHeight: '44px',
          }}
        >
          {t('recruiter.active', 'Active')} ({activeApps.length})
        </button>
        <button
          onClick={() => setFilterStatus('approved')}
          style={{
            padding: '0.3rem 0.6rem',
            backgroundColor: filterStatus === 'approved' ? '#22c55e10' : 'transparent',
            border: `1px solid ${filterStatus === 'approved' ? '#22c55e30' : '#2a2a2a'}`,
            borderRadius: '6px',
            color: filterStatus === 'approved' ? '#22c55e' : '#6b7280',
            fontSize: '0.75rem',
            cursor: 'pointer',
            minHeight: '44px',
          }}
        >
          {t('recruiter.approved', 'Approved')} ({approvedApps.length})
        </button>
        <button
          onClick={() => setFilterStatus('closed')}
          style={{
            padding: '0.3rem 0.6rem',
            backgroundColor: filterStatus === 'closed' ? '#22d3ee10' : 'transparent',
            border: `1px solid ${filterStatus === 'closed' ? '#22d3ee30' : '#2a2a2a'}`,
            borderRadius: '6px',
            color: filterStatus === 'closed' ? '#22d3ee' : '#6b7280',
            fontSize: '0.75rem',
            cursor: 'pointer',
            minHeight: '44px',
          }}
        >
          {t('recruiter.past', 'Past')} ({closedApps.length})
        </button>
      </div>

      {/* CSV Download for Gold tier */}
      {fundTier === 'gold' && filterStatus === 'approved' && approvedApps.length > 0 && (
        <button
          onClick={() => downloadApprovedCSV(approvedApps)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.4rem 0.75rem',
            marginBottom: '0.75rem',
            backgroundColor: '#ffc30b10',
            border: '1px solid #ffc30b30',
            borderRadius: '6px',
            color: '#ffc30b',
            fontSize: '0.7rem',
            fontWeight: '600',
            cursor: 'pointer',
            minHeight: '36px',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          {t('recruiter.downloadCsv', 'Download CSV')} ({approvedApps.length} {t('recruiter.approved', 'approved')})
        </button>
      )}

      {/* Bulk Select Bar */}
      {filteredApps.length > 1 && filterStatus === 'active' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          marginBottom: '0.5rem', padding: '0.4rem 0.6rem',
          backgroundColor: selectedIds.size > 0 ? '#3b82f608' : 'transparent',
          border: `1px solid ${selectedIds.size > 0 ? '#3b82f625' : 'transparent'}`,
          borderRadius: '8px', transition: 'all 0.15s',
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.7rem', color: colors.textSecondary }}>
            <input
              type="checkbox"
              checked={selectedIds.size === filteredApps.length && filteredApps.length > 0}
              onChange={toggleAll}
              style={{ accentColor: '#3b82f6', width: '14px', height: '14px' }}
            />
            {t('recruiter.selectAll', 'Select All')} ({selectedIds.size}/{filteredApps.length})
          </label>
          {selectedIds.size > 0 && (
            <div style={{ display: 'flex', gap: '0.3rem', marginLeft: 'auto' }}>
              {['viewed', 'interested', 'declined'].map(status => {
                const fallbackColor = { bg: '#3b82f615', border: '#3b82f630', text: '#3b82f6' };
                const btnColors: Record<string, { bg: string; border: string; text: string }> = {
                  viewed: fallbackColor,
                  interested: { bg: '#a855f715', border: '#a855f730', text: '#a855f7' },
                  declined: { bg: '#ef444415', border: '#ef444430', text: '#ef4444' },
                };
                const c = btnColors[status] || fallbackColor;
                return (
                  <button
                    key={status}
                    onClick={() => handleBulkAction(status)}
                    disabled={bulkUpdating}
                    style={{
                      padding: '0.25rem 0.5rem',
                      backgroundColor: c.bg,
                      border: `1px solid ${c.border}`,
                      borderRadius: '5px',
                      color: c.text,
                      fontSize: '0.6rem',
                      fontWeight: '600',
                      cursor: bulkUpdating ? 'not-allowed' : 'pointer',
                      opacity: bulkUpdating ? 0.5 : 1,
                      textTransform: 'capitalize',
                      minHeight: '28px',
                    }}
                  >
                    {bulkUpdating ? '...' : status === 'viewed' ? t('appCard.markViewed', 'Mark Viewed') : status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {filteredApps.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '2rem 1rem',
          backgroundColor: colors.surface, borderRadius: '10px',
          border: `1px solid ${colors.border}`,
        }}>
          <p style={{ color: colors.textMuted, fontSize: '0.85rem' }}>
            {filterStatus === 'active' ? t('recruiter.noActiveApps', 'No active applications') : filterStatus === 'approved' ? t('recruiter.noApprovedApps', 'No approved applications') : t('recruiter.noPastApps', 'No past applications')}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filteredApps.map((app) => (
            <div key={app.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
              {filterStatus === 'active' && filteredApps.length > 1 && (
                <input
                  type="checkbox"
                  checked={selectedIds.has(app.id)}
                  onChange={() => toggleSelect(app.id)}
                  style={{ accentColor: '#3b82f6', width: '14px', height: '14px', marginTop: '0.85rem', flexShrink: 0 }}
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <ApplicationCard
                  application={app}
                  onStatusChange={handleStatusChange}
                  updating={updating}
                  unreadCount={perAppUnreadCounts?.[app.id] || 0}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InboxTab;
