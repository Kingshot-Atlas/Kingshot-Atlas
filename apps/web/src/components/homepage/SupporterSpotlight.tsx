import React from 'react';
import { Link } from 'react-router-dom';
import { usePremium } from '../../contexts/PremiumContext';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useTranslation } from 'react-i18next';
import { useAnalytics } from '../../hooks/useAnalytics';

/**
 * SupporterSpotlight — Social proof section on the homepage
 * Shows real supporter count and encourages upgrades through
 * community validation rather than aggressive marketing.
 * Hidden from supporters (they already converted).
 */
const SupporterSpotlight: React.FC = () => {
  const { t } = useTranslation();
  const { isSupporter } = usePremium();
  const isMobile = useIsMobile();
  const { trackButton } = useAnalytics();

  // Don't show to current supporters — they already converted
  if (isSupporter) return null;

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: isMobile ? '0 0.75rem 0.75rem' : '0 2rem 1rem',
    }}>
      <div style={{
        backgroundColor: '#111116',
        border: '1px solid #2a2a2a',
        borderRadius: '12px',
        padding: isMobile ? '0.75rem 1rem' : '1rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '200px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #FF6B8A 0%, #22d3ee 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: '1rem',
          }}>
            ❤️
          </div>
          <div>
            <div style={{ color: '#fff', fontSize: isMobile ? '0.8rem' : '0.85rem', fontWeight: '600' }}>
              {t('supporter.spotlightTitle', 'Community-Powered Data')}
            </div>
            <div style={{ color: '#9ca3af', fontSize: isMobile ? '0.7rem' : '0.75rem', lineHeight: 1.4 }}>
              {t('supporter.spotlightDesc', 'Atlas Supporters fund the servers, database, and development that keep 1200+ kingdom profiles accurate and free for everyone.')}
            </div>
          </div>
        </div>

        <Link
          to="/support"
          onClick={() => trackButton('Upgrade Click: Supporter Spotlight')}
          style={{
            padding: isMobile ? '0.45rem 0.85rem' : '0.4rem 1rem',
            minHeight: isMobile ? '44px' : 'auto',
            backgroundColor: '#FF6B8A15',
            border: '1px solid #FF6B8A40',
            borderRadius: '8px',
            color: '#FF6B8A',
            fontSize: '0.8rem',
            fontWeight: '600',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            transition: 'all 0.2s',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#FF6B8A25';
            e.currentTarget.style.borderColor = '#FF6B8A60';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#FF6B8A15';
            e.currentTarget.style.borderColor = '#FF6B8A40';
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          {t('supporter.spotlightCta', 'Learn More')}
        </Link>
      </div>
    </div>
  );
};

export default SupporterSpotlight;
