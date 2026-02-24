import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { neonGlow, FONT_DISPLAY, colors } from '../utils/styles';
import type { FundTransaction, FundContributor } from '../hooks/useKingdomProfileQueries';

// =============================================
// STRIPE PAYMENT LINKS (Kingdom Fund Contribution)
// =============================================

const CONTRIBUTION_TIERS = [
  {
    amount: 5,
    label: '$5',
    description: 'Starter',
    paymentLink: 'https://buy.stripe.com/fZu6oIdjSegWgOcaPBeZ207',
    color: '#6b7280',
  },
  {
    amount: 10,
    label: '$10',
    description: 'Supporter',
    paymentLink: 'https://buy.stripe.com/cNieVedjSfl055u5vheZ208',
    color: '#22d3ee',
  },
  {
    amount: 25,
    label: '$25',
    description: 'Champion',
    paymentLink: 'https://buy.stripe.com/28EfZibbKdcS69y4rdeZ209',
    color: '#a855f7',
  },
  {
    amount: 50,
    label: '$50',
    description: 'Legend',
    paymentLink: 'https://buy.stripe.com/7sYcN61BaegW0PeaPBeZ20a',
    color: '#fbbf24',
  },
];

// Fund tier thresholds (same as DB logic)
const TIER_THRESHOLDS = {
  gold: 100,
  silver: 50,
  bronze: 25,
  standard: 0,
};

const getTierFromBalance = (balance: number): string => {
  if (balance >= TIER_THRESHOLDS.gold) return 'gold';
  if (balance >= TIER_THRESHOLDS.silver) return 'silver';
  if (balance >= TIER_THRESHOLDS.bronze) return 'bronze';
  return 'standard';
};

const TIER_COLORS: Record<string, string> = {
  gold: colors.gold,
  silver: '#d1d5db',
  bronze: colors.bronze,
  standard: colors.textMuted,
};

const TIER_BENEFITS: Record<string, string[]> = {
  standard: ['Basic listing with Atlas Score & stats', 'Community reviews from players'],
  bronze: ['Min TC & Power requirements shown', 'Browse transferee profiles', 'Kingdom Policies & Vibe tags'],
  silver: ['All Bronze benefits', 'Send invites to transferees', 'Kingdom Bio & Language display', 'Alliance Information schedule'],
  gold: ['All Silver benefits', '+2 alliance slots (5 total)', 'Gilded badge for all kingdom users', 'Gold glow + priority placement', 'KvK Prep Scheduler access', 'KvK Battle Planner access'],
};

// =============================================
// CONTRIBUTE MODAL
// =============================================

type FundTab = 'chipIn' | 'activity';

const KingdomFundContribute: React.FC<{
  kingdomNumber: number;
  currentBalance?: number;
  currentTier?: string;
  gracePeriodUntil?: string | null;
  transactions?: FundTransaction[];
  showConfetti?: boolean;
  onClose: () => void;
}> = ({ kingdomNumber, currentBalance = 0, currentTier = 'standard', gracePeriodUntil, transactions = [], showConfetti = false, onClose }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<FundTab>('chipIn');
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const confettiContainerRef = useRef<HTMLDivElement>(null);
  const [hasShownConfetti, setHasShownConfetti] = useState(false);

  // Progress to next tier
  const nextTierInfo = useMemo(() => {
    const tiers = ['standard', 'bronze', 'silver', 'gold'] as const;
    const currentIdx = tiers.indexOf(currentTier as (typeof tiers)[number]);
    if (currentIdx >= tiers.length - 1) return null;
    const nextTier = tiers[currentIdx + 1] as keyof typeof TIER_THRESHOLDS;
    const nextThreshold = TIER_THRESHOLDS[nextTier];
    const prevThreshold = TIER_THRESHOLDS[currentTier as keyof typeof TIER_THRESHOLDS] || 0;
    const range = nextThreshold - prevThreshold;
    const progress = range > 0 ? Math.min(1, Math.max(0, (currentBalance - prevThreshold) / range)) : 0;
    return { nextTier, nextThreshold, progress, amountNeeded: Math.max(0, nextThreshold - currentBalance) };
  }, [currentBalance, currentTier]);

  // Aggregate contributor data
  const { recentContributors, topContributorId } = useMemo(() => {
    const contributions = transactions.filter((tx) => tx.type === 'contribution' && tx.contributor);
    const aggregated = new Map<string, { contributor: FundContributor; totalAmount: number; latestDate: string }>();
    for (const tx of contributions) {
      if (!tx.user_id || !tx.contributor) continue;
      const existing = aggregated.get(tx.user_id);
      if (existing) {
        existing.totalAmount += tx.amount;
        if (tx.created_at > existing.latestDate) existing.latestDate = tx.created_at;
      } else {
        aggregated.set(tx.user_id, { contributor: tx.contributor, totalAmount: tx.amount, latestDate: tx.created_at });
      }
    }
    const sorted = [...aggregated.values()].sort((a, b) => b.totalAmount - a.totalAmount);
    const topId = sorted[0]?.contributor.id || null;
    const recent = [...aggregated.values()]
      .sort((a, b) => b.latestDate.localeCompare(a.latestDate))
      .slice(0, 5)
      .map((c) => c.contributor);
    return { recentContributors: recent, topContributorId: topId };
  }, [transactions]);

  const getDisplayInfo = useCallback((c: FundContributor) => ({
    name: c.linked_username || c.username || 'Anonymous',
    avatar: c.linked_avatar_url || c.avatar_url || null,
  }), []);

  // Confetti animation
  const triggerConfetti = useCallback(() => {
    if (!confettiContainerRef.current || hasShownConfetti) return;
    setHasShownConfetti(true);
    const container = confettiContainerRef.current;
    const confettiColors = ['#22c55e', '#fbbf24', '#22d3ee', '#a855f7', '#fff'];
    for (let i = 0; i < 40; i++) {
      const piece = document.createElement('div');
      piece.style.cssText = `
        position: absolute; width: ${Math.random() * 8 + 4}px; height: ${Math.random() * 8 + 4}px;
        background: ${confettiColors[Math.floor(Math.random() * confettiColors.length)]};
        left: ${Math.random() * 100}%; top: 0;
        border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
        pointer-events: none; opacity: 1;
        transform: rotate(${Math.random() * 360}deg);
        animation: fund-confetti ${1.5 + Math.random()}s ease-out forwards;
      `;
      container.appendChild(piece);
      setTimeout(() => piece.remove(), 2500);
    }
  }, [hasShownConfetti]);

  useEffect(() => {
    if (!showConfetti) return;
    const timer = setTimeout(triggerConfetti, 400);
    return () => clearTimeout(timer);
  }, [showConfetti, triggerConfetti]);

  const handleShareLink = useCallback(() => {
    const url = `${window.location.origin}/kingdom/${kingdomNumber}/fund`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  }, [kingdomNumber]);

  // Grace period should only show when the kingdom is at risk of losing its tier.
  // If balance meets/exceeds the current tier threshold, the grace period doesn't apply.
  const currentTierThreshold = TIER_THRESHOLDS[currentTier as keyof typeof TIER_THRESHOLDS] ?? 0;
  const isAtRiskOfLosingTier = currentTier !== 'standard' && currentBalance < currentTierThreshold;
  const hasActiveGracePeriod = !!gracePeriodUntil && new Date(gracePeriodUntil) > new Date() && isAtRiskOfLosingTier;

  const handleContribute = (paymentLink: string) => {
    // Append metadata as URL params for the redirect
    const url = new URL(paymentLink);
    url.searchParams.set('client_reference_id', `kf_${kingdomNumber}_${user?.id || 'anon'}`);
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  };

  // Calculate what tier they'd reach with each amount
  const getProjectedTier = (addAmount: number) => {
    return getTierFromBalance(currentBalance + addAmount);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: isMobile ? 0 : '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#111111',
          border: '1px solid #2a2a2a',
          borderRadius: isMobile ? '16px 16px 0 0' : '16px',
          padding: isMobile ? '1.25rem 1rem' : '1.5rem',
          paddingBottom: isMobile ? 'max(1.25rem, env(safe-area-inset-bottom))' : '1.5rem',
          maxWidth: isMobile ? '100%' : '500px',
          width: '100%',
          maxHeight: isMobile ? '90vh' : '85vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '0.75rem', position: 'relative' }}>
          <h2 style={{
            fontFamily: FONT_DISPLAY,
            fontSize: isMobile ? '1.1rem' : '1.25rem',
            color: '#fff',
            margin: '0 0 0.35rem 0',
          }}>
            {t('kingdomFund.fundKingdom', { num: '' })} <span style={{ ...neonGlow('#22d3ee') }}>{kingdomNumber}</span>
          </h2>
          <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>
            {t('kingdomFund.boostDesc')}
          </p>
          <button
            onClick={handleShareLink}
            style={{
              position: 'absolute', top: 0, right: 0,
              background: copiedLink ? '#22c55e20' : '#ffffff08',
              border: `1px solid ${copiedLink ? '#22c55e40' : '#333'}`,
              borderRadius: '6px',
              color: copiedLink ? '#22c55e' : '#9ca3af',
              cursor: 'pointer', fontSize: '0.7rem', padding: '0.25rem 0.6rem',
              transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', gap: '0.3rem',
              fontWeight: 500,
            }}
            title={t('kingdomFund.shareFundLink', 'Share fund link')}
          >
            {copiedLink ? '✓' : '🔗'} {copiedLink ? t('kingdomFund.copied', 'Copied!') : t('kingdomFund.share', 'Share')}
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: '0.25rem',
          marginBottom: '0.75rem',
          backgroundColor: '#0a0a0a',
          borderRadius: '10px',
          padding: '3px',
        }}>
          {(['chipIn', 'activity'] as FundTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: '0.45rem 0.75rem',
                backgroundColor: activeTab === tab ? '#1a1a20' : 'transparent',
                border: activeTab === tab ? '1px solid #2a2a2a' : '1px solid transparent',
                borderRadius: '8px',
                color: activeTab === tab ? '#fff' : '#6b7280',
                fontSize: '0.8rem',
                fontWeight: activeTab === tab ? '600' : '400',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.3rem',
              }}
            >
              {tab === 'chipIn' ? '💰' : '📊'}
              {tab === 'chipIn' ? t('kingdomFund.tabChipIn', 'Chip In') : t('kingdomFund.tabActivity', 'Activity')}
            </button>
          ))}
        </div>

        {/* Grace Period Alert — shown on both tabs when at risk */}
        {hasActiveGracePeriod && (
          <div style={{
            padding: '0.5rem 0.6rem',
            backgroundColor: '#f59e0b10',
            border: '1px solid #f59e0b30',
            borderRadius: '8px',
            marginBottom: '0.75rem',
            display: 'flex', alignItems: 'center', gap: '0.4rem',
          }}>
            <span style={{ fontSize: '0.85rem' }}>⚠️</span>
            <span style={{ color: '#f59e0b', fontSize: '0.7rem', lineHeight: 1.3 }}>
              {t('kingdomFund.gracePeriodWarning', 'Tier grace period active — contribute to maintain the current tier before {{date}}', {
                date: new Date(gracePeriodUntil!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              })}
            </span>
          </div>
        )}

        {/* Current Status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem',
          backgroundColor: '#0a0a0a',
          borderRadius: '10px',
          marginBottom: '1rem',
          border: `1px solid ${TIER_COLORS[currentTier] || '#2a2a2a'}30`,
        }}>
          <div>
            <span style={{ color: '#6b7280', fontSize: '0.7rem' }}>{t('kingdomFund.currentBalance')}</span>
            <div style={{
              fontWeight: 'bold',
              fontSize: '1.1rem',
              ...neonGlow('#22c55e'),
            }}>
              ${currentBalance.toFixed(2)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ color: '#6b7280', fontSize: '0.7rem' }}>{t('kingdomFund.currentTier')}</span>
            <div style={{
              color: TIER_COLORS[currentTier] || '#4b5563',
              fontWeight: 'bold',
              fontSize: '1.1rem',
              textTransform: 'capitalize',
            }}>
              {currentTier}
            </div>
          </div>
        </div>

        {/* Progress to Next Tier */}
        {nextTierInfo && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
              <span style={{ color: '#6b7280', fontSize: '0.65rem', textTransform: 'capitalize' }}>
                {t('kingdomFund.progressToTier', 'Progress to {{tier}}', { tier: nextTierInfo.nextTier })}
              </span>
              <span style={{ color: TIER_COLORS[nextTierInfo.nextTier] || '#6b7280', fontSize: '0.65rem', fontWeight: '600' }}>
                ${nextTierInfo.amountNeeded.toFixed(0)} {t('kingdomFund.needed', 'needed')}
              </span>
            </div>
            <div style={{ height: '6px', backgroundColor: '#1a1a1a', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${nextTierInfo.progress * 100}%`,
                backgroundColor: TIER_COLORS[nextTierInfo.nextTier] || '#22d3ee',
                borderRadius: '3px',
                transition: 'width 0.5s ease',
                minWidth: nextTierInfo.progress > 0 ? '4px' : '0',
              }} />
            </div>
          </div>
        )}

        {/* ===== CHIP IN TAB ===== */}
        {activeTab === 'chipIn' && (
          <>
            {/* Contribution Options */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '0.5rem',
              marginBottom: '1rem',
            }}>
              {CONTRIBUTION_TIERS.map((tier) => {
                const projectedTier = getProjectedTier(tier.amount);
                const isUpgrade = projectedTier !== currentTier;
                const isSelected = selectedAmount === tier.amount;

                return (
                  <button
                    key={tier.amount}
                    onClick={() => setSelectedAmount(tier.amount)}
                    style={{
                      padding: '0.75rem',
                      backgroundColor: isSelected ? `${tier.color}15` : '#0a0a0a',
                      border: `2px solid ${isSelected ? `${tier.color}60` : '#2a2a2a'}`,
                      borderRadius: '12px',
                      cursor: 'pointer',
                      textAlign: 'center',
                      position: 'relative',
                      transition: 'all 0.2s',
                      minHeight: '80px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <span style={{
                      fontSize: '1.25rem',
                      fontWeight: 'bold',
                      color: isSelected ? tier.color : '#fff',
                    }}>
                      {tier.label}
                    </span>
                    <span style={{ color: '#6b7280', fontSize: '0.7rem' }}>
                      {tier.description}
                    </span>
                    {isUpgrade && (
                      <span style={{
                        fontSize: '0.6rem',
                        color: TIER_COLORS[projectedTier],
                        fontWeight: '600',
                        marginTop: '0.1rem',
                      }}>
                        {t('kingdomFund.toTier', { tier: projectedTier })}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tier Benefits Preview */}
            {selectedAmount && (
              <div style={{
                padding: '0.75rem',
                backgroundColor: '#0a0a0a',
                borderRadius: '10px',
                marginBottom: '1rem',
                border: '1px solid #2a2a2a',
              }}>
                <span style={{ color: '#9ca3af', fontSize: '0.7rem', fontWeight: '600' }}>
                  {t('kingdomFund.tierBenefits', { tier: getProjectedTier(selectedAmount).toUpperCase() })}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.35rem' }}>
                  {(TIER_BENEFITS[getProjectedTier(selectedAmount)] || []).map((benefit) => (
                    <div key={benefit} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ color: '#22c55e', fontSize: '0.7rem' }}>✓</span>
                      <span style={{ color: '#d1d5db', fontSize: '0.75rem' }}>{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Alliance-wide pitch */}
            {currentTier !== 'gold' && (() => {
              const nextTier = currentTier === 'standard' ? 'bronze' : currentTier === 'bronze' ? 'silver' : 'gold';
              const nextThreshold = TIER_THRESHOLDS[nextTier as keyof typeof TIER_THRESHOLDS];
              const amountNeeded = Math.max(0, nextThreshold - currentBalance);
              const perMember = (amountNeeded / 100).toFixed(2);
              return amountNeeded > 0 ? (
                <div style={{
                  padding: '0.75rem',
                  backgroundColor: '#22d3ee08',
                  border: '1px solid #22d3ee20',
                  borderRadius: '10px',
                  marginBottom: '1rem',
                  textAlign: 'center',
                }}>
                  <p style={{ color: '#d1d5db', fontSize: '0.75rem', margin: '0 0 0.25rem', lineHeight: 1.4 }}>
                    {t('kingdomFund.alliancePitch', {
                      amount: amountNeeded,
                      tier: nextTier.charAt(0).toUpperCase() + nextTier.slice(1),
                      defaultValue: `Your kingdom needs $${amountNeeded} more to reach ${nextTier.charAt(0).toUpperCase() + nextTier.slice(1)} tier`,
                    })}
                  </p>
                  <p style={{ color: '#22d3ee', fontSize: '0.7rem', fontWeight: '600', margin: 0 }}>
                    {t('kingdomFund.perMember', {
                      amount: perMember,
                      defaultValue: `That's just $${perMember} per alliance member`,
                    })}
                  </p>
                </div>
              ) : null;
            })()}

            {/* How It Works */}
            <div style={{
              padding: '0.6rem 0.75rem',
              backgroundColor: '#0a0a0a',
              borderRadius: '8px',
              marginBottom: '1rem',
            }}>
              <p style={{ color: '#9ca3af', fontSize: '0.7rem', margin: 0, lineHeight: 1.5 }}>
                {t('kingdomFund.fundsDeplete')}
              </p>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '0.6rem 1rem',
                  backgroundColor: 'transparent',
                  border: '1px solid #2a2a2a',
                  borderRadius: '10px',
                  color: '#9ca3af',
                  fontSize: isMobile ? '1rem' : '0.85rem',
                  cursor: 'pointer',
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {t('kingdomFund.cancel')}
              </button>
              <button
                onClick={() => {
                  const tier = CONTRIBUTION_TIERS.find((t) => t.amount === selectedAmount);
                  if (tier) handleContribute(tier.paymentLink);
                }}
                disabled={!selectedAmount}
                style={{
                  flex: 2,
                  padding: '0.6rem 1rem',
                  backgroundColor: selectedAmount ? '#22c55e' : '#22c55e30',
                  border: 'none',
                  borderRadius: '10px',
                  color: selectedAmount ? '#000' : '#6b7280',
                  fontSize: isMobile ? '1rem' : '0.85rem',
                  fontWeight: '600',
                  cursor: selectedAmount ? 'pointer' : 'not-allowed',
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                }}
              >
                {selectedAmount ? t('kingdomFund.contribute', { amount: selectedAmount }) : t('kingdomFund.selectAmount')}
              </button>
            </div>

            {/* Security Note */}
            <p style={{
              color: '#4b5563',
              fontSize: '0.6rem',
              textAlign: 'center',
              marginTop: '0.75rem',
              marginBottom: 0,
            }}>
              🔒 {t('kingdomFund.securePayment')}
            </p>
          </>
        )}

        {/* ===== ACTIVITY TAB ===== */}
        {activeTab === 'activity' && (
          <>
            {/* Activity Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '0.75rem',
            }}>
              <span style={{ color: '#9ca3af', fontSize: '0.7rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t('kingdomFund.fundActivityTitle', 'Fund Activity')}
              </span>
              <span style={{
                color: TIER_COLORS[currentTier] || '#6b7280',
                fontSize: '0.75rem', fontWeight: '600', textTransform: 'capitalize',
              }}>
                {currentTier} · ${currentBalance.toFixed(2)}
              </span>
            </div>

            {/* Recent Contributors */}
            {recentContributors.length > 0 && (
              <div style={{ marginBottom: '0.75rem' }}>
                <span style={{ color: '#6b7280', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>
                  {t('kingdomFund.recentContributors', 'Recent Contributors')}
                </span>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.4rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
                  {recentContributors.map((c) => {
                    const info = getDisplayInfo(c);
                    const isTop = topContributorId === c.id;
                    return (
                      <div key={c.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', minWidth: '48px' }}>
                        <div style={{ position: 'relative' }}>
                          {info.avatar ? (
                            <img src={info.avatar} alt="" style={{ width: 36, height: 36, borderRadius: '50%', border: isTop ? '2px solid #fbbf24' : '2px solid #2a2a2a', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                          ) : (
                            <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: '#1a1a1a', border: isTop ? '2px solid #fbbf24' : '2px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: '0.75rem', fontWeight: '600' }}>
                              {info.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          {isTop && <span style={{ position: 'absolute', top: -6, right: -6, fontSize: '0.65rem' }}>🏆</span>}
                        </div>
                        <span style={{ color: '#9ca3af', fontSize: '0.55rem', maxWidth: '52px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
                          {info.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Transaction List */}
            {transactions.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {transactions.slice(0, showAllTransactions ? undefined : 10).map((tx) => {
                  const isDepletion = tx.type === 'depletion';
                  const isContribution = tx.type === 'contribution';
                  const contributor = isContribution && tx.contributor ? getDisplayInfo(tx.contributor) : null;
                  return (
                    <div key={tx.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.4rem 0.6rem',
                      backgroundColor: '#0a0a0a', borderRadius: '8px',
                      border: `1px solid ${isDepletion ? '#ef444415' : '#1a1a1a'}`,
                      gap: '0.4rem',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0, flex: 1 }}>
                        {contributor?.avatar ? (
                          <img src={contributor.avatar} alt="" style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, border: topContributorId === tx.user_id ? '1.5px solid #fbbf24' : '1.5px solid #2a2a2a', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                        ) : contributor ? (
                          <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: '#1a1a1a', border: topContributorId === tx.user_id ? '1.5px solid #fbbf24' : '1.5px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: '0.55rem', fontWeight: '600', flexShrink: 0 }}>
                            {contributor.name.charAt(0).toUpperCase()}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.85rem' }}>{isDepletion ? '📉' : isContribution ? '💰' : '🔧'}</span>
                        )}
                        <span style={{
                          color: isDepletion ? '#ef4444' : '#22c55e',
                          fontWeight: '600', fontSize: '0.85rem',
                        }}>
                          {isDepletion ? '' : '+'}${Math.abs(tx.amount).toFixed(2)}
                        </span>
                        {contributor ? (
                          <span style={{ color: '#6b7280', fontSize: '0.6rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {contributor.name}{topContributorId === tx.user_id ? ' 🏆' : ''}
                          </span>
                        ) : (
                          <span style={{ color: '#4b5563', fontSize: '0.65rem' }}>
                            → ${tx.balance_after.toFixed(2)}
                          </span>
                        )}
                      </div>
                      <span style={{ color: '#4b5563', fontSize: '0.65rem', flexShrink: 0 }}>
                        {new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  );
                })}
                {!showAllTransactions && transactions.length > 10 && (
                  <button
                    onClick={() => setShowAllTransactions(true)}
                    style={{
                      width: '100%', padding: '0.4rem', marginTop: '0.35rem',
                      backgroundColor: 'transparent', border: '1px solid #2a2a2a',
                      borderRadius: '8px', color: '#9ca3af', fontSize: '0.7rem',
                      cursor: 'pointer', transition: 'all 0.2s',
                    }}
                  >
                    {t('kingdomFund.viewAll', 'View All {{count}} Transactions', { count: transactions.length })}
                  </button>
                )}
              </div>
            ) : (
              <div style={{
                padding: '2rem 1rem',
                textAlign: 'center',
                color: '#4b5563',
                fontSize: '0.8rem',
                fontStyle: 'italic',
              }}>
                {t('kingdomFund.noActivity', 'No fund activity yet. Be the first to contribute!')}
              </div>
            )}

            {/* Close button for activity tab */}
            <button
              onClick={onClose}
              style={{
                width: '100%',
                padding: '0.6rem 1rem',
                backgroundColor: 'transparent',
                border: '1px solid #2a2a2a',
                borderRadius: '10px',
                color: '#9ca3af',
                fontSize: isMobile ? '1rem' : '0.85rem',
                cursor: 'pointer',
                minHeight: '44px',
                marginTop: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {t('common.close', 'Close')}
            </button>
          </>
        )}

        {/* Confetti Container */}
        <div
          ref={confettiContainerRef}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 1001, overflow: 'hidden' }}
        />

        {/* Confetti CSS */}
        <style>{`
          @keyframes fund-confetti {
            0% { transform: translateY(0) rotate(0deg); opacity: 1; }
            100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
          }
        `}</style>
      </div>
    </div>
  );
};

export default KingdomFundContribute;
