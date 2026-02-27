import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import {
  ReferralTier,
  REFERRAL_TIER_COLORS,
  REFERRAL_TIER_LABELS,
  REFERRAL_TIER_THRESHOLDS,
  getNextReferralTier,
  isReferralEligible,
} from '../utils/constants';
import { copyToClipboard } from '../utils/sharing';
import { useIsMobile } from '../hooks/useMediaQuery';
import useAnalytics from '../hooks/useAnalytics';
import ReferralBadge from './ReferralBadge';
import SmartTooltip from './shared/SmartTooltip';
import { supabase } from '../lib/supabase';

const SOURCE_ICONS: Record<string, { icon: string; color: string }> = {
  referral_link: { icon: '🔗', color: '#22d3ee' },
  endorsement: { icon: '🗳️', color: '#a855f7' },
  review_invite: { icon: '⭐', color: '#fbbf24' },
  transfer_listing: { icon: '🔄', color: '#22c55e' },
};

const ReferralStats: React.FC = () => {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const isMobile = useIsMobile();
  const { trackFeature } = useAnalytics();
  const [copied, setCopied] = useState(false);
  const [sourceBreakdown, setSourceBreakdown] = useState<{ source: string; count: number }[]>([]);

  useEffect(() => {
    const fetchSources = async () => {
      if (!supabase || !profile?.id) return;
      const { data } = await supabase
        .from('referrals')
        .select('source')
        .eq('referrer_user_id', profile.id)
        .eq('status', 'verified');
      if (data && data.length > 0) {
        const counts = new Map<string, number>();
        data.forEach((r: { source: string }) => {
          const src = r.source || 'referral_link';
          counts.set(src, (counts.get(src) || 0) + 1);
        });
        setSourceBreakdown(Array.from(counts.entries()).map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count));
      }
    };
    fetchSources();
  }, [profile?.id]);

  const referralCount = profile?.referral_count ?? 0;
  const currentTier = profile?.referral_tier as ReferralTier | null;
  const nextTier = getNextReferralTier(currentTier);
  const eligible = profile ? isReferralEligible(profile) : false;

  const handleCopyLink = useCallback(async () => {
    if (!profile?.linked_username) return;
    const kingdom = profile.linked_kingdom || '';
    const encodedRef = encodeURIComponent(profile.linked_username);
    const url = kingdom
      ? `https://ks-atlas.com/kingdom/${kingdom}?ref=${encodedRef}`
      : `https://ks-atlas.com?ref=${encodedRef}`;
    const success = await copyToClipboard(url);
    if (success) {
      setCopied(true);
      trackFeature('Referral Link Copied', { tier: currentTier || 'none', count: referralCount });
      setTimeout(() => setCopied(false), 2000);
    }
  }, [profile, trackFeature, currentTier, referralCount]);

  if (!profile) return null;

  // Not eligible yet — show requirements
  if (!eligible) {
    return (
      <div style={{
        backgroundColor: '#111111',
        borderRadius: '12px',
        padding: isMobile ? '1rem' : '1.25rem',
        marginBottom: '1.5rem',
        border: '1px solid #2a2a2a',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '600', color: '#fff' }}>
            {t('referralProgram.title', 'Referral Program')}
          </h3>
        </div>
        <p style={{ color: '#9ca3af', fontSize: '0.85rem', margin: 0, lineHeight: 1.5, textAlign: 'center' }}>
          {t('referralProgram.unlockDesc', 'Link your Kingshot account (TC25+) to unlock your personal referral link. Bring players to Atlas and earn badges, Discord roles, and recognition.')}
        </p>
      </div>
    );
  }

  // Eligible — show stats + link
  const progressToNext = nextTier
    ? Math.min(100, (referralCount / nextTier.threshold) * 100)
    : 100;

  const currentTierColor = currentTier ? REFERRAL_TIER_COLORS[currentTier] : '#6b7280';
  const nextTierColor = nextTier ? REFERRAL_TIER_COLORS[nextTier.tier] : currentTierColor;

  return (
    <div style={{
      backgroundColor: '#111111',
      borderRadius: '12px',
      padding: isMobile ? '1rem' : '1.25rem',
      marginBottom: '1.5rem',
      border: `1px solid ${currentTier ? `${currentTierColor}30` : '#2a2a2a'}`,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '0.75rem',
        flexWrap: 'wrap',
        gap: '0.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '600', color: '#fff' }}>
            {t('referralProgram.title', 'Referral Program')}
          </h3>
          {currentTier && <ReferralBadge tier={currentTier} />}
        </div>
        <span style={{
          fontSize: '0.85rem',
          fontWeight: 'bold',
          color: currentTierColor,
        }}>
          {t('referralProgram.referralCount', '{{count}} referrals', { count: referralCount })}
        </span>
      </div>

      {/* Progress to next tier */}
      {nextTier && (
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.35rem',
          }}>
            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
              {t('referralProgram.next', 'Next')}: {REFERRAL_TIER_LABELS[nextTier.tier]}
            </span>
            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
              {referralCount}/{nextTier.threshold}
            </span>
          </div>
          <div style={{
            width: '100%',
            height: '6px',
            backgroundColor: '#1a1a1a',
            borderRadius: '3px',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${progressToNext}%`,
              height: '100%',
              backgroundColor: nextTierColor,
              borderRadius: '3px',
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      )}

      {/* Max tier reached */}
      {!nextTier && currentTier === 'ambassador' && (
        <p style={{
          fontSize: '0.8rem',
          color: REFERRAL_TIER_COLORS.ambassador,
          margin: '0 0 0.75rem 0',
          fontWeight: 500,
        }}>
          🏛️ {t('referralProgram.maxTierReached', "You've reached the highest referral tier!")}
        </p>
      )}

      {/* Tier roadmap - compact for mobile */}
      <div style={{
        display: 'flex',
        gap: isMobile ? '0.35rem' : '0.5rem',
        marginBottom: '0.75rem',
        flexWrap: 'wrap',
      }}>
        {(Object.entries(REFERRAL_TIER_THRESHOLDS) as [ReferralTier, number][]).map(([tier, threshold]) => {
          const reached = referralCount >= threshold;
          const tierColor = REFERRAL_TIER_COLORS[tier];
          const tierDescriptions: Record<ReferralTier, string> = {
            scout: t('referralProgram.scoutDesc', "First badge earned. You're on the radar."),
            recruiter: t('referralProgram.recruiterDesc', 'Proven recruiter. Your kingdom notices.'),
            consul: t('referralProgram.consulDesc', 'Unlocks Consul Discord role. Recognized voice in the community.'),
            ambassador: t('referralProgram.ambassadorDesc', 'Top tier. Ambassador role + badge, priority support, and #vip-lounge access.'),
          };
          return (
            <SmartTooltip
              key={tier}
              accentColor={tierColor}
              maxWidth={180}
              content={
                <div style={{ fontSize: '0.75rem', color: '#d1d5db' }}>
                  <div style={{ fontWeight: 600, color: tierColor, marginBottom: '0.2rem' }}>
                    {REFERRAL_TIER_LABELS[tier]} — {t('referralProgram.thresholdReferrals', '{{count}} referrals', { count: threshold })}
                  </div>
                  {tierDescriptions[tier]}
                </div>
              }
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.2rem 0.5rem',
                borderRadius: '12px',
                backgroundColor: reached ? `${tierColor}15` : '#0a0a0a',
                border: `1px solid ${reached ? `${tierColor}40` : '#2a2a2a'}`,
                fontSize: '0.7rem',
                color: reached ? tierColor : '#6b7280',
                fontWeight: reached ? 600 : 400,
                cursor: 'pointer',
              }}>
                {reached ? '✓' : threshold}
                <span>{REFERRAL_TIER_LABELS[tier]}</span>
              </div>
            </SmartTooltip>
          );
        })}
      </div>

      {/* Source breakdown */}
      {sourceBreakdown.length > 1 && (
        <div style={{
          display: 'flex',
          gap: '0.4rem',
          marginBottom: '0.75rem',
          flexWrap: 'wrap',
        }}>
          {sourceBreakdown.map(({ source, count: srcCount }) => {
            const sourceLabels: Record<string, string> = {
              referral_link: t('referralProgram.sourceLinks', 'Referral Links'),
              endorsement: t('referralProgram.sourceEndorsements', 'Endorsements'),
              review_invite: t('referralProgram.sourceReviews', 'Reviews'),
              transfer_listing: t('referralProgram.sourceTransferHub', 'Transfer Hub'),
            };
            const cfg = SOURCE_ICONS[source] || { icon: '📊', color: '#6b7280' };
            return (
              <div key={source} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.2rem 0.5rem',
                borderRadius: '12px',
                backgroundColor: `${cfg.color}10`,
                border: `1px solid ${cfg.color}25`,
                fontSize: '0.65rem',
                color: cfg.color,
              }}>
                <span>{cfg.icon}</span>
                <span style={{ fontWeight: 600 }}>{srcCount}</span>
                <span style={{ color: '#9ca3af' }}>{sourceLabels[source] || source}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Copy referral link button */}
      <button
        onClick={handleCopyLink}
        style={{
          width: '100%',
          padding: '0.75rem',
          backgroundColor: copied ? '#22c55e' : (currentTier ? `${currentTierColor}15` : '#1a1a1a'),
          border: `1px solid ${copied ? '#22c55e' : (currentTier ? `${currentTierColor}40` : '#333')}`,
          borderRadius: '8px',
          color: copied ? '#fff' : (currentTier ? currentTierColor : '#22d3ee'),
          cursor: 'pointer',
          fontSize: '0.85rem',
          fontWeight: 600,
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          minHeight: '48px',
        }}
      >
        {copied ? t('referralProgram.linkCopied', '✓ Link Copied!') : t('referralProgram.copyLink', '📋 Copy Your Referral Link')}
      </button>
    </div>
  );
};

export default ReferralStats;
