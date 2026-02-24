import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { neonGlow, FONT_DISPLAY, colors } from '../utils/styles';
import type { FundTransaction } from '../hooks/useKingdomProfileQueries';

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
  onClose: () => void;
}> = ({ kingdomNumber, currentBalance = 0, currentTier = 'standard', gracePeriodUntil, transactions = [], onClose }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<FundTab>('chipIn');

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
        <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
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

            {/* Transaction List */}
            {transactions.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {transactions.slice(0, 10).map((tx) => {
                  const isDepletion = tx.type === 'depletion';
                  const isContribution = tx.type === 'contribution';
                  return (
                    <div key={tx.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.4rem 0.6rem',
                      backgroundColor: '#0a0a0a', borderRadius: '8px',
                      border: `1px solid ${isDepletion ? '#ef444415' : '#1a1a1a'}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontSize: '0.85rem' }}>{isDepletion ? '📉' : isContribution ? '💰' : '🔧'}</span>
                        <span style={{
                          color: isDepletion ? '#ef4444' : '#22c55e',
                          fontWeight: '600', fontSize: '0.85rem',
                        }}>
                          {isDepletion ? '' : '+'}${Math.abs(tx.amount).toFixed(2)}
                        </span>
                        <span style={{ color: '#4b5563', fontSize: '0.65rem' }}>
                          → ${tx.balance_after.toFixed(2)}
                        </span>
                      </div>
                      <span style={{ color: '#4b5563', fontSize: '0.65rem' }}>
                        {new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  );
                })}
                {transactions.length > 10 && (
                  <div style={{ textAlign: 'center', marginTop: '0.35rem' }}>
                    <span style={{ color: '#4b5563', fontSize: '0.65rem' }}>
                      {t('kingdomFund.moreTransactions', '+ {{count}} more transactions', { count: transactions.length - 10 })}
                    </span>
                  </div>
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
      </div>
    </div>
  );
};

export default KingdomFundContribute;
