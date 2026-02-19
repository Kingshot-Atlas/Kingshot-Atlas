import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useAuth } from '../../contexts/AuthContext';
import { useKvk11Promo, KVK11_PROMO_END } from '../../hooks/useKvk11Promo';
import { useAnalytics } from '../../hooks/useAnalytics';
import { FONT_DISPLAY } from '../../utils/styles';

const DISMISS_KEY = 'kingshot_kvk11_promo_dismissed';

/**
 * KvK #11 Silver Tier Promotion Banner
 *
 * Shows on the homepage during the promo period (until Feb 28, 2026 22:00 UTC).
 * Directs users to their kingdom's fund page so they can contribute to reach Silver tier.
 * Only visible to logged-in users with a linked kingdom.
 */
const Kvk11PromoBanner: React.FC = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user, profile } = useAuth();
  const { isPromoActive } = useKvk11Promo();
  const { trackFeature } = useAnalytics();
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem(DISMISS_KEY));
  const [countdown, setCountdown] = useState('');

  // Live countdown
  useEffect(() => {
    if (!isPromoActive) return;
    const update = () => {
      const diff = KVK11_PROMO_END - Date.now();
      if (diff <= 0) { setCountdown(''); return; }
      const d = Math.floor(diff / 86_400_000);
      const h = Math.floor((diff % 86_400_000) / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      if (d > 0) setCountdown(`${d}d ${h}h left`);
      else if (h > 0) setCountdown(`${h}h ${m}m left`);
      else setCountdown(`${m}m left`);
    };
    update();
    const interval = window.setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, [isPromoActive]);

  // Don't render if promo expired, not logged in, no linked kingdom, or dismissed
  if (!isPromoActive || !user || !profile?.linked_kingdom || dismissed) return null;

  const kingdomNumber = profile.linked_kingdom;

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  const handleCTA = () => {
    trackFeature('KvK11 Promo CTA', { kingdom: kingdomNumber });
    navigate(`/kingdom/${kingdomNumber}/fund`);
  };

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: isMobile ? '0 0.75rem 0.5rem' : '0 2rem 0.75rem',
    }}>
      <div
        onClick={handleCTA}
        style={{
          background: 'linear-gradient(135deg, #1a1005 0%, #111 40%, #1a0f1a 100%)',
          border: '1px solid #d1d5db50',
          borderRadius: '14px',
          padding: isMobile ? '1rem' : '1rem 1.5rem',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'flex-start' : 'center',
          justifyContent: 'space-between',
          gap: isMobile ? '0.75rem' : '1rem',
          position: 'relative',
          overflow: 'hidden',
          cursor: 'pointer',
          transition: 'border-color 0.2s ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#d1d5db90'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#d1d5db50'; }}
      >
        {/* Radial glow */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'radial-gradient(ellipse at 15% 50%, #d1d5db08, transparent 60%), radial-gradient(ellipse at 85% 50%, #a855f708, transparent 60%)',
          pointerEvents: 'none',
        }} />

        {/* Dismiss */}
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
          aria-label="Dismiss KvK #11 promotion banner"
        >
          ✕
        </button>

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1, flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.3rem',
            flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>⚔️</span>
            <h3 style={{
              fontFamily: FONT_DISPLAY,
              fontSize: isMobile ? '0.85rem' : '1rem',
              color: '#fff',
              margin: 0,
              fontWeight: 600,
            }}>
              KvK #11 Special —{' '}
              <span style={{ color: '#d1d5db' }}>Silver Tier</span>{' '}
              gets{' '}
              <span style={{ color: '#22c55e' }}>Gold Tools</span>
            </h3>
            <span style={{
              fontSize: '0.55rem',
              padding: '0.1rem 0.35rem',
              backgroundColor: '#a855f720',
              border: '1px solid #a855f740',
              borderRadius: '3px',
              color: '#a855f7',
              fontWeight: '700',
              whiteSpace: 'nowrap',
            }}>
              50% OFF
            </span>
            {countdown && (
              <span style={{
                fontSize: '0.6rem',
                color: '#f97316',
                fontWeight: '600',
                whiteSpace: 'nowrap',
              }}>
                {countdown}
              </span>
            )}
          </div>
          <p style={{
            color: '#9ca3af',
            fontSize: isMobile ? '0.72rem' : '0.8rem',
            margin: 0,
            lineHeight: 1.4,
          }}>
            Prep Scheduler & Battle Planner unlocked for Silver Tier kingdoms until KvK #11 ends.
            Fund your kingdom to Silver ($50) and gain the edge.
          </p>
        </div>

        {/* CTA */}
        <div style={{
          position: 'relative',
          zIndex: 1,
          flexShrink: 0,
          width: isMobile ? '100%' : 'auto',
        }}>
          <button
            onClick={(e) => { e.stopPropagation(); handleCTA(); }}
            style={{
              padding: isMobile ? '0.6rem 1rem' : '0.6rem 1.25rem',
              background: 'linear-gradient(135deg, #d1d5db 0%, #9ca3af 100%)',
              color: '#000',
              fontWeight: 600,
              border: 'none',
              borderRadius: '8px',
              fontSize: isMobile ? '0.8rem' : '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              justifyContent: 'center',
              width: isMobile ? '100%' : 'auto',
              boxShadow: '0 0 20px rgba(209, 213, 219, 0.15)',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 0 30px rgba(209, 213, 219, 0.3)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 0 20px rgba(209, 213, 219, 0.15)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Fund Kingdom {kingdomNumber} →
          </button>
        </div>
      </div>
    </div>
  );
};

export default Kvk11PromoBanner;
