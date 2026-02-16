import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePremium } from '../contexts/PremiumContext';
import { useOnboardingTracker } from '../hooks/useOnboardingTracker';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useTranslation } from 'react-i18next';

const ConversionBanner: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { tier } = usePremium();
  const { weeklySessionCount, shouldShowConversionBanner, dismissConversionBanner } = useOnboardingTracker();
  const isMobile = useIsMobile();

  // Only show for logged-in free users with 3+ sessions this week
  if (!user || tier === 'supporter' || tier === 'anonymous') return null;
  if (!shouldShowConversionBanner) return null;

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: isMobile ? '0 0.75rem 0.5rem' : '0 2rem 0.75rem',
    }}>
    <div style={{
      backgroundColor: '#111111',
      border: '1px solid #FF6B8A30',
      borderRadius: '12px',
      padding: isMobile ? '0.75rem 1rem' : '1rem 1.25rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '0.75rem',
      flexWrap: 'wrap',
      background: 'linear-gradient(135deg, #111111 0%, #FF6B8A08 100%)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '200px' }}>
        <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>💪</span>
        <div>
          <div style={{ color: '#fff', fontSize: isMobile ? '0.8rem' : '0.85rem', fontWeight: '600' }}>
            {t('conversion.title', 'You\'ve used Atlas {{count}} times this week', { count: weeklySessionCount })}
          </div>
          <div style={{ color: '#9ca3af', fontSize: isMobile ? '0.7rem' : '0.75rem' }}>
            {t('conversion.subtitle', 'Supporters like you keep us running. $4.17/mo billed yearly.')}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
        <Link
          to="/support"
          style={{
            padding: '0.4rem 0.85rem',
            backgroundColor: '#FF6B8A',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '0.8rem',
            fontWeight: '600',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {t('conversion.cta', 'Support Atlas')}
        </Link>
        <button
          onClick={dismissConversionBanner}
          aria-label="Dismiss"
          style={{
            background: 'none',
            border: 'none',
            color: '#6b7280',
            cursor: 'pointer',
            fontSize: '0.9rem',
            padding: '0.2rem',
          }}
        >
          ✕
        </button>
      </div>
    </div>
    </div>
  );
};

export default ConversionBanner;
