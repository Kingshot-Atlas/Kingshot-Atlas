import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UserProfile } from '../../contexts/AuthContext';

// Convert TC level to display string (TC 31+ becomes TG tiers)
// Source of truth: /docs/TC_TG_NAMING.md
const formatTCLevel = (level: number | null | undefined): string => {
  if (!level) return '';
  if (level <= 30) return `TC ${level}`;
  if (level <= 34) return 'TC 30';
  const tgTier = Math.floor((level - 35) / 5) + 1;
  return `TG${tgTier}`;
};

interface ProfileStatsGridProps {
  viewedProfile: UserProfile | null;
  isMobile: boolean;
}

const ProfileStatsGrid: React.FC<ProfileStatsGridProps> = ({ viewedProfile, isMobile }) => {
  const { t } = useTranslation();

  const cellStyle: React.CSSProperties = {
    padding: isMobile ? '0.5rem' : '0.875rem',
    minHeight: '48px',
    backgroundColor: '#0a0a0a',
    borderRadius: '8px',
    border: '1px solid #2a2a2a',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center'
  };

  const labelStyle: React.CSSProperties = {
    fontSize: isMobile ? '0.55rem' : '0.65rem',
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: '0.25rem'
  };

  const valueStyle = (hasValue: boolean): React.CSSProperties => ({
    fontSize: isMobile ? '1rem' : '1.25rem',
    fontWeight: '700',
    color: hasValue ? '#fff' : '#4a4a4a'
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '0.5rem' : '0.75rem', marginBottom: isMobile ? '1rem' : '1.5rem' }}>
      {/* Row 1: Kingdom, Alliance, Player ID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: isMobile ? '0.5rem' : '1rem' }}>
        {viewedProfile?.linked_kingdom ? (
          <Link to={`/kingdom/${viewedProfile.linked_kingdom}`} style={{ textDecoration: 'none' }}>
            <div style={{ ...cellStyle, cursor: 'pointer', transition: 'border-color 0.2s' }}>
              <div style={labelStyle}>{t('profile.kingdom', 'Kingdom')}</div>
              <div style={valueStyle(true)}>{viewedProfile.linked_kingdom}</div>
            </div>
          </Link>
        ) : (
          <div style={cellStyle}>
            <div style={labelStyle}>{t('profile.kingdom', 'Kingdom')}</div>
            <div style={valueStyle(false)}>—</div>
          </div>
        )}
        <div style={cellStyle}>
          <div style={labelStyle}>{t('profile.alliance', 'Alliance')}</div>
          <div style={valueStyle(!!viewedProfile?.alliance_tag)}>
            {viewedProfile?.alliance_tag ? `[${viewedProfile.alliance_tag}]` : '—'}
          </div>
        </div>
        <div style={cellStyle}>
          <div style={labelStyle}>{t('profile.playerId', 'Player ID')}</div>
          <div style={{ ...valueStyle(!!viewedProfile?.linked_player_id), fontSize: isMobile ? '0.85rem' : '1.25rem' }}>
            {viewedProfile?.linked_player_id || '—'}
          </div>
        </div>
      </div>
      {/* Row 2: TC Level, Language, Region */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: isMobile ? '0.5rem' : '1rem' }}>
        <div style={cellStyle}>
          <div style={labelStyle}>{t('profile.townCenter', 'Town Center')}</div>
          <div style={valueStyle(!!viewedProfile?.linked_tc_level)}>
            {viewedProfile?.linked_tc_level ? formatTCLevel(viewedProfile.linked_tc_level) : '—'}
          </div>
        </div>
        <div style={cellStyle}>
          <div style={labelStyle}>{t('profile.language', 'Language')}</div>
          <div style={valueStyle(!!viewedProfile?.language)}>
            {viewedProfile?.language || '—'}
          </div>
        </div>
        <div style={cellStyle}>
          <div style={labelStyle}>{t('profile.region', 'Region')}</div>
          <div style={valueStyle(!!viewedProfile?.region)}>
            {viewedProfile?.region || '—'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileStatsGrid;
