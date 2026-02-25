import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useTranslation } from 'react-i18next';

const DISMISS_KEY = 'kingshot_settlers_campaign_dismissed';
const RESHOW_HOURS = 24;

const CampaignSettlersBanner: React.FC = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(true); // Start hidden to avoid flash

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (raw) {
        const dismissedAt = parseInt(raw, 10);
        const hoursSince = (Date.now() - dismissedAt) / (1000 * 60 * 60);
        if (hoursSince < RESHOW_HOURS) {
          setDismissed(true);
          return;
        }
      }
      setDismissed(false);
    } catch {
      setDismissed(false);
    }
  }, []);

  // Don't show on the campaign page itself or the draw page
  if (location.pathname === '/campaigns/kingdom-settlers') return null;
  if (location.pathname === '/admin/campaign-draw') return null;
  if (dismissed) return null;

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      localStorage.setItem(DISMISS_KEY, Date.now().toString());
    } catch { /* ignore */ }
    setDismissed(true);
  };

  return (
    <div style={{
      width: '100%',
      background: 'linear-gradient(90deg, #0a1628 0%, #0f1a2e 50%, #0a1628 100%)',
      borderBottom: '1px solid #22d3ee25',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle animated shimmer */}
      <div style={{
        position: 'absolute',
        top: 0, left: '-100%', right: 0, bottom: 0,
        background: 'linear-gradient(90deg, transparent 0%, #22d3ee08 50%, transparent 100%)',
        animation: 'bannerShimmer 4s ease-in-out infinite',
        pointerEvents: 'none',
      }} />

      <Link
        to="/campaigns/kingdom-settlers"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: isMobile ? '0.4rem' : '0.75rem',
          padding: isMobile ? '0.5rem 2.5rem 0.5rem 0.75rem' : '0.55rem 3rem 0.55rem 1rem',
          textDecoration: 'none',
          position: 'relative',
          zIndex: 1,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: isMobile ? '0.85rem' : '1rem' }}>🏰</span>
        <span style={{
          color: '#22d3ee',
          fontSize: isMobile ? '0.7rem' : '0.8rem',
          fontWeight: 700,
          letterSpacing: '0.5px',
        }}>
          {t('campaignBanner.title', 'Kingdom Settlers Campaign #1')}
        </span>
        <span style={{
          color: '#9ca3af',
          fontSize: isMobile ? '0.65rem' : '0.78rem',
          textAlign: 'center',
        }}>
          {t('campaignBanner.subtitle', 'Your kingdom could win real prizes. Rally your settlers!')}
        </span>
        <span style={{
          color: '#22d3ee',
          fontSize: isMobile ? '0.65rem' : '0.75rem',
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}>
          {t('campaignBanner.cta', 'Learn More →')}
        </span>
      </Link>

      <button
        onClick={handleDismiss}
        style={{
          position: 'absolute',
          right: isMobile ? '0.5rem' : '0.75rem',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          color: '#4b5563',
          cursor: 'pointer',
          fontSize: '1.1rem',
          lineHeight: 1,
          padding: '0.35rem',
          zIndex: 2,
          minWidth: '44px',
          minHeight: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-label={t('common.dismiss', 'Dismiss')}
      >
        ×
      </button>

      <style>{`
        @keyframes bannerShimmer {
          0% { transform: translateX(0); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
};

export default CampaignSettlersBanner;
