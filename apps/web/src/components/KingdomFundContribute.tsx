import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { neonGlow, FONT_DISPLAY } from '../utils/styles';

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
  gold: '#fbbf24',
  silver: '#9ca3af',
  bronze: '#cd7f32',
  standard: '#4b5563',
};

const TIER_BENEFITS: Record<string, string[]> = {
  standard: ['Basic listing with Atlas Score & stats', 'Community reviews from players'],
  bronze: ['Min TC & Power requirements shown', 'Browse transferee profiles', 'Kingdom Policies & Vibe tags'],
  silver: ['All Bronze benefits', 'Send invites to transferees', 'Kingdom Bio & Language display', 'Alliance Event Times'],
  gold: ['All Silver benefits', '5 bonus invites per cycle', 'Gold glow on listing', 'Top listing priority'],
};

// =============================================
// CONTRIBUTE MODAL
// =============================================

const KingdomFundContribute: React.FC<{
  kingdomNumber: number;
  currentBalance?: number;
  currentTier?: string;
  onClose: () => void;
}> = ({ kingdomNumber, currentBalance = 0, currentTier = 'standard', onClose }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);

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
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
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
      </div>
    </div>
  );
};

export default KingdomFundContribute;
