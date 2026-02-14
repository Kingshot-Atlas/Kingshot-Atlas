import React from 'react';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { colors } from '../../utils/styles';
import { ApplicationCard } from './index';
import type { IncomingApplication } from './types';

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
