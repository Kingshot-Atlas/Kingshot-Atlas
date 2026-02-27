import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FONT_DISPLAY } from '../../utils/styles';

interface ContributionSuccessModalProps {
  isMobile: boolean;
  onClose: () => void;
}

const ContributionSuccessModal: React.FC<ContributionSuccessModalProps> = ({ isMobile, onClose }) => {
  const { t } = useTranslation();

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center',
        zIndex: 1100, padding: isMobile ? 0 : '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#111111', border: '1px solid #22c55e30',
          borderRadius: isMobile ? '16px 16px 0 0' : '16px',
          padding: isMobile ? '2rem 1.5rem' : '2.5rem',
          maxWidth: '450px', width: '100%',
          textAlign: 'center',
          boxShadow: '0 0 40px #22c55e10',
          paddingBottom: isMobile ? 'max(2rem, env(safe-area-inset-bottom))' : '2.5rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          width: '60px', height: '60px', borderRadius: '50%',
          backgroundColor: '#22c55e15', border: '2px solid #22c55e40',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1rem',
          fontSize: '1.5rem',
        }}>
          ✓
        </div>
        <h2 style={{
          fontFamily: FONT_DISPLAY, fontSize: '1.3rem',
          color: '#fff', margin: '0 0 0.5rem 0',
        }}>
          {t('transferHub.contributionSuccess', 'Contribution Successful!')}
        </h2>
        <p style={{ color: '#9ca3af', fontSize: '0.9rem', margin: '0 0 0.75rem 0', lineHeight: 1.5 }}>
          {t('transferHub.contributionThankYou', 'Thank you for supporting your kingdom\'s Transfer Hub listing. Your contribution helps the fund grow and unlocks better listing features.')}
        </p>
        <div style={{
          padding: '0.75rem', backgroundColor: '#0a0a0a',
          borderRadius: '10px', border: '1px solid #2a2a2a',
          marginBottom: '1rem',
        }}>
          <span style={{ color: '#6b7280', fontSize: '0.7rem' }}>{t('transferHub.whatHappensNext', 'What happens next?')}</span>
          <ul style={{ color: '#d1d5db', fontSize: '0.8rem', margin: '0.5rem 0 0 0', padding: '0 0 0 1.2rem', lineHeight: 1.8, textAlign: 'left' }}>
            <li>{t('transferHub.paymentProcessed', 'Your payment is processed by Stripe')}</li>
            <li>{t('transferHub.balanceUpdated', 'The kingdom fund balance is updated automatically')}</li>
            <li>{t('transferHub.tierUpgrade', 'If the fund reaches a new tier, the listing upgrades')}</li>
            <li>{t('transferHub.fundDepletes', 'Fund depletes ~$5/week to stay active')}</li>
          </ul>
        </div>
        <button
          onClick={onClose}
          style={{
            padding: '0.6rem 2rem',
            backgroundColor: '#22c55e15',
            border: '1px solid #22c55e40',
            borderRadius: '10px',
            color: '#22c55e',
            fontWeight: '600',
            fontSize: '0.9rem',
            cursor: 'pointer',
            minHeight: '44px',
          }}
        >
          {t('transferHub.continueBrowsing', 'Continue Browsing')}
        </button>
      </div>
    </div>
  );
};

export default ContributionSuccessModal;
