import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { colors } from '../../utils/styles';
import { useTransferApplications, useTransferAnalytics } from '../../hooks/useAdminQueries';

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  pending: { bg: `${colors.warning}10`, border: `${colors.warning}30`, text: colors.warning },
  viewed: { bg: `${colors.blue}10`, border: `${colors.blue}30`, text: colors.blue },
  interested: { bg: `${colors.purple}10`, border: `${colors.purple}30`, text: colors.purple },
  accepted: { bg: `${colors.success}10`, border: `${colors.success}30`, text: colors.success },
  declined: { bg: `${colors.error}10`, border: `${colors.error}30`, text: colors.error },
  withdrawn: { bg: `${colors.textMuted}10`, border: `${colors.textMuted}30`, text: colors.textMuted },
  expired: { bg: '#4b556310', border: '#4b556330', text: '#4b5563' },
};

export const TransferApplicationsTab: React.FC = () => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const { data: apps = [], isLoading: loading } = useTransferApplications(filter, true);
  const { data: analytics = null } = useTransferAnalytics(true);

  const filteredApps = search
    ? apps.filter(a =>
        a.applicant_username?.toLowerCase().includes(search.toLowerCase()) ||
        String(a.kingdom_number).includes(search) ||
        String(a.applicant_kingdom || '').includes(search)
      )
    : apps;

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Analytics Cards */}
      {analytics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
          <div style={{ backgroundColor: colors.cardAlt, padding: '1rem', borderRadius: '10px', border: `1px solid ${colors.border}`, textAlign: 'center' }}>
            <div style={{ color: colors.primary, fontWeight: 700, fontSize: '1.5rem' }}>{analytics.total}</div>
            <div style={{ color: colors.textMuted, fontSize: '0.7rem' }}>{t('admin.totalApplications', 'Total Applications')}</div>
          </div>
          <div style={{ backgroundColor: colors.cardAlt, padding: '1rem', borderRadius: '10px', border: `1px solid ${colors.border}`, textAlign: 'center' }}>
            <div style={{ color: colors.warning, fontWeight: 700, fontSize: '1.5rem' }}>{analytics.byStatus['pending'] || 0}</div>
            <div style={{ color: colors.textMuted, fontSize: '0.7rem' }}>{t('admin.pending', 'Pending')}</div>
          </div>
          <div style={{ backgroundColor: colors.cardAlt, padding: '1rem', borderRadius: '10px', border: `1px solid ${colors.border}`, textAlign: 'center' }}>
            <div style={{ color: colors.success, fontWeight: 700, fontSize: '1.5rem' }}>{analytics.byStatus['accepted'] || 0}</div>
            <div style={{ color: colors.textMuted, fontSize: '0.7rem' }}>{t('admin.accepted', 'Accepted')}</div>
          </div>
          <div style={{ backgroundColor: colors.cardAlt, padding: '1rem', borderRadius: '10px', border: `1px solid ${colors.border}`, textAlign: 'center' }}>
            <div style={{ color: colors.error, fontWeight: 700, fontSize: '1.5rem' }}>{analytics.byStatus['declined'] || 0}</div>
            <div style={{ color: colors.textMuted, fontSize: '0.7rem' }}>{t('admin.declined', 'Declined')}</div>
          </div>
          <div style={{ backgroundColor: colors.cardAlt, padding: '1rem', borderRadius: '10px', border: `1px solid ${colors.border}`, textAlign: 'center' }}>
            <div style={{ color: '#4b5563', fontWeight: 700, fontSize: '1.5rem' }}>{analytics.expiredCount}</div>
            <div style={{ color: colors.textMuted, fontSize: '0.7rem' }}>{t('admin.expired', 'Expired')}</div>
          </div>
          <div style={{ backgroundColor: colors.cardAlt, padding: '1rem', borderRadius: '10px', border: `1px solid ${colors.border}`, textAlign: 'center' }}>
            <div style={{ color: colors.purple, fontWeight: 700, fontSize: '1.5rem' }}>
              {analytics.avgResponseTimeHours !== null ? `${analytics.avgResponseTimeHours.toFixed(1)}h` : '—'}
            </div>
            <div style={{ color: colors.textMuted, fontSize: '0.7rem' }}>{t('admin.avgResponseTime', 'Avg Response Time')}</div>
          </div>
        </div>
      )}

      {/* Top Kingdoms by Applications */}
      {analytics && analytics.byKingdom.length > 0 && (
        <div style={{ backgroundColor: colors.cardAlt, padding: '1rem', borderRadius: '10px', border: `1px solid ${colors.border}` }}>
          <h4 style={{ color: colors.text, margin: '0 0 0.5rem', fontSize: '0.85rem' }}>Top Kingdoms by Applications</h4>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {analytics.byKingdom.map(k => (
              <span key={k.kingdom_number} style={{
                padding: '0.25rem 0.6rem',
                backgroundColor: `${colors.primary}10`,
                border: `1px solid ${colors.primary}30`,
                borderRadius: '6px',
                fontSize: '0.75rem',
                color: colors.primary,
                fontWeight: 600,
              }}>
                K{k.kingdom_number} ({k.count})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filter + Search */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{
            padding: '0.5rem 0.75rem',
            backgroundColor: colors.cardAlt,
            border: `1px solid ${colors.border}`,
            borderRadius: '8px',
            color: colors.text,
            fontSize: '0.8rem',
          }}
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="viewed">Viewed</option>
          <option value="interested">Interested</option>
          <option value="accepted">Accepted</option>
          <option value="declined">Declined</option>
          <option value="withdrawn">Withdrawn</option>
          <option value="expired">Expired</option>
        </select>
        <input
          type="text"
          placeholder="Search by username or kingdom..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            padding: '0.5rem 0.75rem',
            backgroundColor: colors.cardAlt,
            border: `1px solid ${colors.border}`,
            borderRadius: '8px',
            color: colors.text,
            fontSize: '0.8rem',
            flex: 1,
            minWidth: '200px',
          }}
        />
        <span style={{ color: colors.textMuted, fontSize: '0.75rem' }}>
          {filteredApps.length} result{filteredApps.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Applications List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: colors.textMuted }}>Loading...</div>
      ) : filteredApps.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: colors.textMuted }}>
          No transfer applications found
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filteredApps.map(app => {
            const sc = STATUS_COLORS[app.status] ?? STATUS_COLORS['pending'] ?? { bg: `${colors.textMuted}10`, border: `${colors.textMuted}30`, text: colors.textMuted };
            const isExpired = app.expires_at && new Date(app.expires_at) < new Date() && app.status === 'pending';
            return (
              <div key={app.id} style={{
                backgroundColor: colors.cardAlt,
                borderRadius: '10px',
                border: `1px solid ${isExpired ? `${colors.error}30` : colors.border}`,
                padding: '0.75rem 1rem',
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: '0.5rem',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                    <span style={{ color: colors.text, fontWeight: 600, fontSize: '0.85rem' }}>
                      {app.applicant_username || 'Unknown'}
                    </span>
                    {app.applicant_kingdom && (
                      <span style={{ color: colors.textMuted, fontSize: '0.7rem' }}>from K{app.applicant_kingdom}</span>
                    )}
                    <span style={{ color: colors.textMuted, fontSize: '0.7rem' }}>→</span>
                    <span style={{ color: colors.primary, fontSize: '0.8rem', fontWeight: 600 }}>K{app.kingdom_number}</span>
                    <span style={{
                      padding: '0.15rem 0.4rem',
                      backgroundColor: sc.bg,
                      border: `1px solid ${sc.border}`,
                      borderRadius: '4px',
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      color: sc.text,
                      textTransform: 'capitalize',
                    }}>
                      {isExpired ? 'expired (stale)' : app.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.7rem', color: colors.textMuted, flexWrap: 'wrap' }}>
                    {app.profile_tc_level && <span>TC{app.profile_tc_level}</span>}
                    {app.profile_power_million && <span>{app.profile_power_million}M power</span>}
                    {app.profile_main_language && <span>{app.profile_main_language}</span>}
                    <span>Applied {timeAgo(app.applied_at)}</span>
                    {app.responded_at && <span>Responded {timeAgo(app.responded_at)}</span>}
                    {app.expires_at && (
                      <span style={{ color: isExpired ? colors.error : '#4b5563' }}>
                        {isExpired ? 'Expired' : `Expires ${timeAgo(app.expires_at)}`}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: '0.65rem', color: colors.textMuted, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {new Date(app.applied_at).toLocaleDateString()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
