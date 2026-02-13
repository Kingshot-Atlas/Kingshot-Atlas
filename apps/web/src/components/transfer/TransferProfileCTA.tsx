import React from 'react';
import { useTranslation } from 'react-i18next';

interface UserTransferProfile {
  power_million: number;
  tc_level: number;
  main_language: string;
  secondary_languages: string[];
  looking_for: string[];
  kvk_availability: string;
  saving_for_kvk: string;
  group_size: string;
  player_bio: string;
  play_schedule: unknown[];
  contact_method: string;
  visible_to_recruiters: boolean;
}

interface TransferProfileCTAProps {
  hasTransferProfile: boolean;
  transferProfile: UserTransferProfile | null;
  profileViewCount: number;
  activeAppCount: number;
  isMobile: boolean;
  onEditProfile: (scrollToIncomplete: boolean) => void;
}

const TransferProfileCTA: React.FC<TransferProfileCTAProps> = ({
  hasTransferProfile,
  transferProfile,
  profileViewCount,
  activeAppCount,
  isMobile,
  onEditProfile,
}) => {
  const { t } = useTranslation();

  // Calculate profile completeness
  const tp = transferProfile;
  const profilePct = tp ? (() => {
    const checks = [
      tp.power_million > 0,
      !!tp.main_language,
      !!tp.kvk_availability,
      !!tp.saving_for_kvk,
      tp.looking_for.length > 0,
      !!tp.group_size,
      !!tp.player_bio?.trim(),
      tp.play_schedule.length > 0,
      !!tp.contact_method,
      !!tp.visible_to_recruiters,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  })() : 0;
  const isIncomplete = hasTransferProfile && profilePct < 100;
  const barColor = profilePct >= 80 ? '#22c55e' : profilePct >= 50 ? '#fbbf24' : '#22d3ee';

  return (
    <div style={{
      backgroundColor: '#22d3ee08',
      border: '1px solid #22d3ee25',
      borderRadius: '12px',
      padding: isMobile ? '0.75rem' : '1rem',
      marginBottom: '1rem',
      display: 'flex',
      alignItems: isMobile ? 'flex-start' : 'center',
      justifyContent: 'space-between',
      gap: '0.75rem',
      flexDirection: isMobile ? 'column' : 'row',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: '#22d3ee', fontWeight: '600', fontSize: '0.85rem' }}>
            {hasTransferProfile ? t('transferHub.profileActive', 'Your Transfer Profile is Active') : t('transferHub.createProfile', 'Create Your Transfer Profile')}
          </span>
          {isIncomplete && (
            <span style={{
              padding: '0.1rem 0.4rem',
              backgroundColor: `${barColor}15`,
              border: `1px solid ${barColor}30`,
              borderRadius: '4px',
              fontSize: '0.65rem',
              fontWeight: '700',
              color: barColor,
            }}>
              {profilePct}%
            </span>
          )}
        </div>
        <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: '0.2rem 0 0 0' }}>
          {isIncomplete
            ? t('transferHub.completeForBetter', 'Complete your profile for better Match Scores and more recruiter visibility.')
            : hasTransferProfile
              ? t('transferHub.profileVisible', 'Kingdoms can see your profile when you apply. You can edit it anytime.')
              : t('transferHub.setupProfile', 'Set up your profile so kingdoms know what you bring to the table.')}
        </p>
        {hasTransferProfile && profileViewCount > 0 && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
            marginTop: '0.35rem',
            padding: '0.15rem 0.5rem',
            backgroundColor: '#a855f710',
            border: '1px solid #a855f725',
            borderRadius: '6px',
            fontSize: '0.65rem',
            color: '#a855f7',
          }}>
            <span>👀</span>
            <span style={{ fontWeight: '700' }}>{profileViewCount}</span>
            <span>{t('transferHub.kingdomsViewedProfile', '{{count}} kingdom(s) viewed your profile', { count: profileViewCount })}</span>
          </div>
        )}
        {hasTransferProfile && activeAppCount >= 2 && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            marginTop: '0.35rem',
            padding: '0.15rem 0.5rem',
            backgroundColor: activeAppCount >= 3 ? '#ef444410' : '#f59e0b10',
            border: `1px solid ${activeAppCount >= 3 ? '#ef444425' : '#f59e0b25'}`,
            borderRadius: '6px',
            fontSize: '0.65rem',
            color: activeAppCount >= 3 ? '#ef4444' : '#f59e0b',
            fontWeight: '600',
          }}>
            📋 {t('transferHub.appSlotsUsed', '{{count}}/3 application slots used', { count: activeAppCount })}{activeAppCount >= 3 ? ' — ' + t('transferHub.withdrawToApply', 'withdraw one to apply again') : ''}
          </div>
        )}
        {isIncomplete && (
          <div style={{
            width: '100%', maxWidth: '200px', height: '4px',
            backgroundColor: '#1a1a1a', borderRadius: '2px',
            overflow: 'hidden', marginTop: '0.4rem',
          }}>
            <div style={{
              width: `${profilePct}%`, height: '100%',
              backgroundColor: barColor, borderRadius: '2px',
              transition: 'width 0.3s ease',
            }} />
          </div>
        )}
      </div>
      <button
        onClick={() => onEditProfile(!!isIncomplete)}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: hasTransferProfile ? 'transparent' : '#22d3ee',
          border: hasTransferProfile ? '1px solid #22d3ee40' : 'none',
          borderRadius: '8px',
          color: hasTransferProfile ? '#22d3ee' : '#000',
          fontSize: '0.8rem',
          fontWeight: '600',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          minHeight: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isIncomplete ? t('transferHub.completeProfile', 'Complete Profile') : hasTransferProfile ? t('transferHub.editProfile', 'Edit Profile') : t('transferHub.createProfileBtn', 'Create Profile')}
      </button>
    </div>
  );
};

export default TransferProfileCTA;
