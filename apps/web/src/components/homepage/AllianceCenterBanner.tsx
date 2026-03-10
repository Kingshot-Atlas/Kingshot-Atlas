import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useTranslation } from 'react-i18next';
import { useAnalytics } from '../../hooks/useAnalytics';

const DISMISS_KEY = 'kingshot_alliance_banner_dismissed';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // Re-show after 7 days

const AllianceCenterBanner: React.FC = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { trackFeature } = useAnalytics();
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(() => {
    const ts = localStorage.getItem(DISMISS_KEY);
    if (!ts) return false;
    return Date.now() - parseInt(ts, 10) < DISMISS_DURATION_MS;
  });

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setDismissed(true);
    trackFeature('Alliance Banner Dismissed');
  };

  if (dismissed) return null;

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: isMobile ? '0 0.75rem 0.5rem' : '0 2rem 0.75rem',
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #0a0f1a 0%, #111 50%, #0a1a1a 100%)',
        border: '1px solid #3b82f640',
        borderRadius: '14px',
        padding: isMobile ? '1rem' : '1.25rem 1.5rem',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        gap: isMobile ? '0.75rem' : '1rem',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Subtle radial glow */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'radial-gradient(ellipse at 20% 50%, #3b82f608, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          style={{
            position: 'absolute',
            top: isMobile ? '0.4rem' : '0.5rem',
            right: isMobile ? '0.5rem' : '0.75rem',
            background: 'none',
            border: 'none',
            color: '#4b5563',
            cursor: 'pointer',
            fontSize: '1rem',
            zIndex: 2,
            padding: '0.25rem',
            lineHeight: 1,
          }}
          aria-label="Dismiss Alliance Center banner"
        >
          ✕
        </button>

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h3 style={{
            fontSize: isMobile ? '0.9rem' : '1.1rem',
            color: '#fff',
            marginBottom: '0.3rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontWeight: 600,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: '#3b82f6', flexShrink: 0 }}>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t('allianceBanner.title', 'Manage your alliance like a pro')}
          </h3>
          <p style={{
            color: '#9ca3af',
            fontSize: isMobile ? '0.75rem' : '0.85rem',
            margin: 0,
          }}>
            {t('allianceBanner.subtitle', 'Track members, coordinate events, and keep your alliance organized — all in one place.')}
          </p>
        </div>

        {/* Actions */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? '0.5rem' : '1rem',
          position: 'relative',
          zIndex: 1,
          width: isMobile ? '100%' : 'auto',
        }}>
          <button
            onClick={() => {
              trackFeature('Alliance Banner CTA Clicked');
              navigate('/alliance-center');
            }}
            style={{
              padding: isMobile ? '0.6rem 1rem' : '0.65rem 1.25rem',
              background: '#3b82f6',
              color: '#fff',
              fontWeight: 600,
              border: 'none',
              borderRadius: '8px',
              fontSize: isMobile ? '0.8rem' : '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 0 20px rgba(59, 130, 246, 0.25)',
              whiteSpace: 'normal',
              flex: isMobile ? 1 : 'none',
              justifyContent: 'center',
              textAlign: 'center',
              lineHeight: 1.3,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 0 30px rgba(59, 130, 246, 0.4)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.25)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {t('allianceBanner.cta', 'Open Alliance Center →')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AllianceCenterBanner;
