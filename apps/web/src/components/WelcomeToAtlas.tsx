import React from 'react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useTranslation } from 'react-i18next';
import { FONT_DISPLAY, neonGlow } from '../utils/styles';

interface WelcomeToAtlasProps {
  kingdomNumber: number | null;
  onDismiss: () => void;
}

const WelcomeToAtlas: React.FC<WelcomeToAtlasProps> = ({ kingdomNumber, onDismiss }) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const highlights = [
    {
      icon: '💎',
      title: t('welcome.scoreTitle', 'Your Kingdom\'s Score'),
      desc: kingdomNumber
        ? t('welcome.scoreDesc', 'See how K{{num}} ranks among 1,300+ kingdoms', { num: kingdomNumber })
        : t('welcome.scoreDescGeneric', 'See how your kingdom ranks among 1,300+ kingdoms'),
      link: kingdomNumber ? `/kingdom/${kingdomNumber}` : '/rankings',
      linkLabel: t('welcome.viewScore', 'View Score'),
    },
    {
      icon: '⚔️',
      title: t('welcome.rivalsTitle', 'Your KvK Rivals'),
      desc: t('welcome.rivalsDesc', 'Check your past opponents and upcoming matchups'),
      link: kingdomNumber ? `/kingdom/${kingdomNumber}` : '/seasons',
      linkLabel: t('welcome.seeRivals', 'See Rivals'),
    },
    {
      icon: '⭐',
      title: t('welcome.favoritesTitle', 'Your Favorites Watchlist'),
      desc: t('welcome.favoritesDesc', 'Track kingdoms you care about and get notified when scores change'),
      link: '/',
      linkLabel: t('welcome.startTracking', 'Start Tracking'),
    },
  ];

  return (
    <div style={{
      backgroundColor: '#0d0d0d',
      border: '1px solid #22d3ee30',
      borderRadius: '16px',
      padding: isMobile ? '1.25rem' : '2rem',
      marginBottom: '1.5rem',
      position: 'relative',
      overflow: 'hidden',
      background: 'linear-gradient(135deg, #0d0d0d 0%, #22d3ee08 50%, #0d0d0d 100%)',
    }}>
      {/* Dismiss button */}
      <button
        onClick={onDismiss}
        aria-label="Dismiss welcome"
        style={{
          position: 'absolute',
          top: '0.75rem',
          right: '0.75rem',
          background: 'none',
          border: 'none',
          color: '#6b7280',
          cursor: 'pointer',
          fontSize: '1rem',
          padding: '0.25rem',
        }}
      >
        ✕
      </button>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: isMobile ? '1rem' : '1.5rem' }}>
        <h2 style={{
          fontSize: isMobile ? '1.25rem' : '1.5rem',
          fontWeight: 'bold',
          fontFamily: FONT_DISPLAY,
          marginBottom: '0.5rem',
        }}>
          <span style={neonGlow('#22d3ee')}>
            {t('welcome.title', 'Welcome to Atlas')}
          </span>
        </h2>
        <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.8rem' : '0.85rem' }}>
          {t('welcome.subtitle', 'Your account is linked. Here\'s what you can do now.')}
        </p>
      </div>

      {/* Three highlights */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
        gap: isMobile ? '0.75rem' : '1rem',
      }}>
        {highlights.map((item, idx) => (
          <div key={idx} style={{
            backgroundColor: '#111111',
            borderRadius: '12px',
            padding: isMobile ? '1rem' : '1.25rem',
            border: '1px solid #2a2a2a',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{item.icon}</div>
            <h3 style={{
              fontSize: isMobile ? '0.9rem' : '0.95rem',
              fontWeight: '600',
              color: '#fff',
              marginBottom: '0.35rem',
            }}>
              {item.title}
            </h3>
            <p style={{
              fontSize: isMobile ? '0.75rem' : '0.8rem',
              color: '#9ca3af',
              marginBottom: '0.75rem',
              lineHeight: 1.4,
            }}>
              {item.desc}
            </p>
            <Link
              to={item.link}
              onClick={onDismiss}
              style={{
                display: 'inline-block',
                padding: '0.35rem 0.75rem',
                backgroundColor: '#22d3ee15',
                border: '1px solid #22d3ee40',
                borderRadius: '6px',
                color: '#22d3ee',
                fontSize: '0.75rem',
                fontWeight: '600',
                textDecoration: 'none',
              }}
            >
              {item.linkLabel}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WelcomeToAtlas;
