import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { useAnalytics } from '../hooks/useAnalytics';

const TransferReadinessScore: React.FC<{
  userId: string;
  hasLinkedAccount: boolean;
  isMobile: boolean;
}> = ({ userId, hasLinkedAccount, isMobile }) => {
  const { t } = useTranslation();
  const { trackFeature } = useAnalytics();
  const [transferProfile, setTransferProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!supabase || !userId) { setLoading(false); return; }
      const { data } = await supabase
        .from('transfer_profiles')
        .select('power_million, tc_level, main_language, secondary_languages, looking_for, kvk_availability, saving_for_kvk, group_size, player_bio, play_schedule, contact_method, contact_discord, contact_coordinates, visible_to_recruiters')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();
      setTransferProfile(data);
      setLoading(false);
    };
    fetchProfile();
  }, [userId]);

  if (loading) return (
    <div style={{
      backgroundColor: '#111111',
      borderRadius: '12px',
      padding: isMobile ? '1rem' : '1.25rem',
      marginBottom: '1.5rem',
      border: '1px solid #2a2a2a',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#1a1a1a', animation: 'skeletonPulse 1.5s ease-in-out infinite' }} />
        <div style={{ width: '120px', height: '14px', borderRadius: '4px', backgroundColor: '#1a1a1a', animation: 'skeletonPulse 1.5s ease-in-out infinite' }} />
      </div>
      <div style={{ width: '100%', height: '8px', borderRadius: '4px', backgroundColor: '#1a1a1a', animation: 'skeletonPulse 1.5s ease-in-out infinite' }} />
      <style>{`@keyframes skeletonPulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }`}</style>
    </div>
  );

  // No transfer profile yet — show CTA
  if (!transferProfile) {
    if (!hasLinkedAccount) return null;
    return (
      <div style={{
        backgroundColor: '#111111',
        borderRadius: '12px',
        padding: isMobile ? '1rem' : '1.25rem',
        marginBottom: '1.5rem',
        border: '1px solid #22d3ee20',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '1rem' }}>🚀</span>
          <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '600', color: '#fff' }}>
            {t('transferReadiness.title', 'Transfer Readiness')}
          </h3>
          <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '400' }}>0%</span>
        </div>
        <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '0 0 0.75rem 0', lineHeight: 1.5 }}>
          {t('transferReadiness.createDesc', 'Create a Transfer Profile to get matched with kingdoms and apply directly from the Transfer Hub.')}
        </p>
        <a
          href="/transfer-hub"
          onClick={() => trackFeature('Transfer Readiness CTA', { action: 'create' })}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#22d3ee10',
            border: '1px solid #22d3ee30',
            borderRadius: '8px',
            color: '#22d3ee',
            fontSize: '0.8rem',
            fontWeight: '600',
            textDecoration: 'none',
            minHeight: '44px',
          }}
        >
          {t('transferReadiness.createProfile', 'Create Transfer Profile →')}
        </a>
      </div>
    );
  }

  // Calculate readiness
  const tp = transferProfile;
  const checks = [
    { label: t('transferReadiness.powerSet', 'Power set'), done: !!(tp.power_million && (tp.power_million as number) > 0) },
    { label: t('transferReadiness.languageSet', 'Language set'), done: !!tp.main_language },
    { label: t('transferReadiness.kvkAvailability', 'KvK availability'), done: !!tp.kvk_availability },
    { label: t('transferReadiness.savingPreference', 'Saving preference'), done: !!tp.saving_for_kvk },
    { label: t('transferReadiness.lookingForTags', 'Looking for tags'), done: Array.isArray(tp.looking_for) && (tp.looking_for as string[]).length > 0 },
    { label: t('transferReadiness.groupSize', 'Group size'), done: !!tp.group_size },
    { label: t('transferReadiness.playerBio', 'Player bio'), done: !!(tp.player_bio && (tp.player_bio as string).trim()) },
    { label: t('transferReadiness.playSchedule', 'Play schedule'), done: Array.isArray(tp.play_schedule) && (tp.play_schedule as unknown[]).length > 0 },
    { label: t('transferReadiness.contactMethod', 'Contact method'), done: !!tp.contact_method },
    { label: t('transferReadiness.visibleToRecruiters', 'Visible to recruiters'), done: !!tp.visible_to_recruiters },
  ];

  const doneCount = checks.filter(c => c.done).length;
  const pct = Math.round((doneCount / checks.length) * 100);

  // Don't show if 100%
  if (pct === 100) return null;

  const barColor = pct >= 80 ? '#22c55e' : pct >= 50 ? '#fbbf24' : '#22d3ee';

  return (
    <div style={{
      backgroundColor: '#111111',
      borderRadius: '12px',
      padding: isMobile ? '1rem' : '1.25rem',
      marginBottom: '1.5rem',
      border: '1px solid #2a2a2a',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1rem' }}>🚀</span>
          <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '600', color: '#fff' }}>
            {t('transferReadiness.title', 'Transfer Readiness')}
          </h3>
        </div>
        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: barColor }}>{pct}%</span>
      </div>

      {/* Progress bar */}
      <div style={{
        width: '100%', height: '8px',
        backgroundColor: '#1a1a1a', borderRadius: '4px',
        overflow: 'hidden', marginBottom: '0.75rem',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          backgroundColor: barColor, borderRadius: '4px',
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Incomplete items only */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
        {checks.filter(c => !c.done).map((item, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0' }}>
            <span style={{
              width: '16px', height: '16px', borderRadius: '50%',
              border: '2px solid #3a3a3a', flexShrink: 0,
            }} />
            <span style={{ fontSize: '0.78rem', color: '#fff' }}>{item.label}</span>
          </div>
        ))}
      </div>

      <a
        href="/transfer-hub"
        onClick={() => trackFeature('Transfer Readiness CTA', { action: 'edit', pct })}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
          marginTop: '0.75rem', fontSize: '0.75rem', color: '#22d3ee',
          textDecoration: 'none',
        }}
      >
        {t('transferReadiness.editProfile', 'Edit Transfer Profile →')}
      </a>
    </div>
  );
};

export default TransferReadinessScore;
