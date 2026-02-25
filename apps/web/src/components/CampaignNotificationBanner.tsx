import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { getAuthProvider } from './profile';

const DISMISS_KEY = 'kingshot_transfer_groups_updated_v5';

const TransferGroupUpdateBanner: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { user, profile } = useAuth();
  const [dismissed, setDismissed] = useState(() => {
    return !!localStorage.getItem(DISMISS_KEY);
  });

  // Don't show if dismissed, or already on transfer hub or profile
  if (dismissed) return null;
  if (location.pathname.startsWith('/transfer-hub')) return null;
  if (location.pathname === '/profile') return null;

  const hasDiscordLinked = !!(profile?.discord_id) || getAuthProvider(user) === 'discord';

  const handleClick = () => {
    if (!user) {
      navigate('/transfer-hub');
    } else if (hasDiscordLinked) {
      navigate('/transfer-hub');
    } else {
      navigate('/profile');
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: isMobile ? '0 0.75rem 0.5rem' : '0 2rem 0.75rem',
    }}>
      <div
        onClick={handleClick}
        style={{
          background: 'linear-gradient(135deg, #0a0f1a 0%, #111 50%, #0f1a15 100%)',
          border: '1px solid #a855f740',
          borderRadius: '12px',
          padding: isMobile ? '0.75rem 1rem' : '0.75rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
          transition: 'border-color 0.2s ease',
        }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#a855f780'}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = '#a855f740'}
      >
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'radial-gradient(ellipse at 20% 50%, #a855f706, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative', zIndex: 1, minWidth: 0 }}>
          <span style={{ fontSize: '1rem', flexShrink: 0 }}>🔀</span>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontWeight: '700',
              fontSize: isMobile ? '0.8rem' : '0.85rem',
              color: '#a855f7',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              flexWrap: 'wrap',
            }}>
              {t('transferGroupUpdate.title', 'Transfer Groups Updated')}
              <span style={{
                fontSize: '0.55rem',
                padding: '0.1rem 0.35rem',
                backgroundColor: '#22c55e20',
                border: '1px solid #22c55e40',
                borderRadius: '3px',
                color: '#22c55e',
                fontWeight: '700',
              }}>
                {t('transferGroupUpdate.new', 'NEW')}
              </span>
            </div>
            <div style={{
              color: '#9ca3af',
              fontSize: isMobile ? '0.7rem' : '0.75rem',
              marginTop: '0.15rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              ...(isMobile ? {} : { whiteSpace: 'nowrap' }),
            }}>
              {t('transferGroupUpdate.subtitle', 'Groups are set for the upcoming Transfer Event. Join your group\'s dedicated channel on our Discord to coordinate.')}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative', zIndex: 1, flexShrink: 0 }}>
          <span style={{
            color: '#a855f7',
            fontSize: isMobile ? '0.7rem' : '0.8rem',
            fontWeight: '600',
            whiteSpace: 'nowrap',
          }}>
            {hasDiscordLinked
              ? t('transferGroupUpdate.ctaHub', 'Transfer Hub →')
              : user
                ? t('transferGroupUpdate.ctaLink', 'Link Discord →')
                : t('transferGroupUpdate.ctaHub', 'Transfer Hub →')
            }
          </span>
          <button
            onClick={handleDismiss}
            style={{
              background: 'none',
              border: 'none',
              color: '#4b5563',
              cursor: 'pointer',
              fontSize: '0.9rem',
              padding: '0.2rem',
              lineHeight: 1,
            }}
            aria-label={t('transferGroupUpdate.dismiss', 'Dismiss notification')}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransferGroupUpdateBanner;
