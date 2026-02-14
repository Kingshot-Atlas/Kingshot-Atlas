import React from 'react';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../hooks/useMediaQuery';
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
}) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  return (
    <div>
      {/* Editor Analytics Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: '0.5rem',
        marginBottom: '0.75rem',
      }}>
        {[
          { label: 'Profile Views', value: listingViews, sub: 'last 30 days', color: colors.pink, icon: '👁️' },
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
          Download CSV ({approvedApps.length} approved)
        </button>
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
            <ApplicationCard
              key={app.id}
              application={app}
              onStatusChange={handleStatusChange}
              updating={updating}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default InboxTab;
