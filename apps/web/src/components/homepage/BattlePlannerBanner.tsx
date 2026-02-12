import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useTranslation } from 'react-i18next';
import { useAnalytics } from '../../hooks/useAnalytics';

const DISMISS_KEY = 'kingshot_battle_planner_banner_dismissed';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // Re-show after 7 days
const FREE_ACCESS_END = new Date('2026-02-25T00:00:00Z').getTime();

const BattlePlannerBanner: React.FC = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { trackFeature } = useAnalytics();
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(() => {
    const ts = localStorage.getItem(DISMISS_KEY);
    if (!ts) return false;
    return Date.now() - parseInt(ts, 10) < DISMISS_DURATION_MS;
  });
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setDismissed(true);
    trackFeature('Battle Planner Banner Dismissed');
  };

  // Hide after free access ends
  if (dismissed || now >= FREE_ACCESS_END) return null;

  const remaining = Math.max(0, FREE_ACCESS_END - now);
  const totalSec = Math.floor(remaining / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: isMobile ? '0 0.75rem 0.5rem' : '0 2rem 0.75rem',
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #1a0a0a 0%, #111 50%, #1a0f0a 100%)',
        border: '1px solid #ef444440',
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
          background: 'radial-gradient(ellipse at 20% 50%, #ef444408, transparent 70%)',
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
          aria-label={t('battlePlannerBanner.dismiss', 'Dismiss Battle Planner banner')}
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
            <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>⚔️</span>
            {t('battlePlannerBanner.title', 'KvK Battle Planner is HERE')}
            <span style={{
              fontSize: '0.55rem', fontWeight: 700, color: '#f59e0b',
              backgroundColor: '#f59e0b18', border: '1px solid #f59e0b30',
              padding: '0.1rem 0.4rem', borderRadius: '4px',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {t('battlePlannerBanner.newBadge', 'NEW')}
            </span>
          </h3>
          <p style={{
            color: '#9ca3af',
            fontSize: isMobile ? '0.75rem' : '0.85rem',
            margin: 0,
          }}>
            {t('battlePlannerBanner.desc', "Free access for everyone — try it this weekend's Castle Battle. Coordinate rallies like never before.")}
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
          <div style={{
            padding: isMobile ? '0.4rem 0.6rem' : '0.5rem 0.75rem',
            background: '#0a0a0a',
            border: '1px solid #ef444430',
            borderRadius: '8px',
            textAlign: 'center',
            flexShrink: 0,
          }}>
            <div style={{
              display: 'flex', gap: '0.2rem', alignItems: 'baseline',
              color: '#ef4444',
              fontSize: isMobile ? '0.85rem' : '1.1rem',
              fontWeight: 'bold',
              fontVariantNumeric: 'tabular-nums',
              fontFamily: 'monospace',
              lineHeight: 1.2,
            }}>
              <span>{String(days).padStart(2, '0')}</span>
              <span style={{ fontSize: '0.6rem', color: '#6b7280' }}>{t('battlePlannerBanner.d', 'd')}</span>
              <span>{String(hours).padStart(2, '0')}</span>
              <span style={{ fontSize: '0.6rem', color: '#6b7280' }}>{t('battlePlannerBanner.h', 'h')}</span>
              <span>{String(minutes).padStart(2, '0')}</span>
              <span style={{ fontSize: '0.6rem', color: '#6b7280' }}>{t('battlePlannerBanner.m', 'm')}</span>
              {!isMobile && <>
                <span>{String(seconds).padStart(2, '0')}</span>
                <span style={{ fontSize: '0.6rem', color: '#6b7280' }}>{t('battlePlannerBanner.s', 's')}</span>
              </>}
            </div>
            <div style={{
              color: '#6b7280',
              fontSize: '0.55rem',
              textTransform: 'uppercase',
              lineHeight: 1.2,
            }}>
              {t('battlePlannerBanner.freeEnds', 'Free Access')}
            </div>
          </div>
          <button
            onClick={() => {
              trackFeature('Battle Planner Banner CTA Clicked');
              navigate('/tools/kvk-battle-planner');
            }}
            style={{
              padding: isMobile ? '0.6rem 1rem' : '0.65rem 1.25rem',
              background: '#ef4444',
              color: '#fff',
              fontWeight: 600,
              border: 'none',
              borderRadius: '8px',
              fontSize: isMobile ? '0.8rem' : '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 0 20px rgba(239, 68, 68, 0.25)',
              whiteSpace: 'normal',
              flex: isMobile ? 1 : 'none',
              justifyContent: 'center',
              textAlign: 'center',
              lineHeight: 1.3,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 0 30px rgba(239, 68, 68, 0.4)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 0 20px rgba(239, 68, 68, 0.25)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {t('battlePlannerBanner.cta', 'Try Battle Planner →')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BattlePlannerBanner;
