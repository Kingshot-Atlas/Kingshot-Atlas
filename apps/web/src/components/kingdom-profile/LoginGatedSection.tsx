import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { analyticsService } from '../../services/analyticsService';

// Login-gated expandable section for anonymous users
const LoginGatedSection: React.FC<{
  title: string;
  subtitle: string;
  isExpanded: boolean;
  onToggle: (expanded: boolean) => void;
  isMobile: boolean;
}> = ({ title, subtitle, isExpanded, onToggle, isMobile }) => {
  const { t } = useTranslation();
  const handleToggle = () => {
    const newState = !isExpanded;
    onToggle(newState);
    if (newState) {
      analyticsService.trackFeatureUse('Gated Section Expanded', { section: title });
    }
  };
  const handleCtaClick = () => {
    analyticsService.trackButtonClick(`Gated CTA: ${title}`);
  };
  return (
  <div style={{
    backgroundColor: '#131318',
    borderRadius: '12px',
    border: '1px solid #2a2a2a',
    marginBottom: isMobile ? '1.25rem' : '1.5rem',
    overflow: 'hidden'
  }}>
    <div
      onClick={handleToggle}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggle(); } }}
      tabIndex={0}
      role="button"
      aria-expanded={isExpanded}
      style={{
        padding: isMobile ? '1rem' : '1.25rem',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.35rem',
        borderBottom: isExpanded ? '1px solid #2a2a2a' : 'none',
        position: 'relative'
      }}
    >
      <h4 style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '600', margin: 0, textAlign: 'center' }}>
        {title}
      </h4>
      {!isExpanded && (
        <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>{subtitle}</span>
      )}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"
        style={{
          position: 'absolute',
          right: isMobile ? '1rem' : '1.25rem',
          top: '50%',
          transform: isExpanded ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%) rotate(0deg)',
          transition: 'transform 0.2s ease'
        }}
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
    {isExpanded && (
      <div style={{ padding: '1.5rem', textAlign: 'center' }}>
        <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🔒</div>
        <div style={{ color: '#d1d5db', fontSize: '0.9rem', fontWeight: '500', marginBottom: '0.5rem' }}>
          {t('kingdomProfile.signInToView', 'Sign in to view')}
        </div>
        <div style={{ color: '#6b7280', fontSize: '0.8rem', marginBottom: '1rem' }}>
          {t('kingdomProfile.freeAccountCta', 'Create a free account to access detailed analytics.')}
        </div>
        <Link
          to="/profile"
          onClick={handleCtaClick}
          style={{
            display: 'inline-block',
            padding: '0.5rem 1.25rem',
            background: 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)',
            borderRadius: '8px',
            color: '#000',
            fontWeight: '600',
            fontSize: '0.85rem',
            textDecoration: 'none'
          }}
        >
          {t('common.signIn')} / {t('kingdomProfile.register', 'Register')}
        </Link>
      </div>
    )}
  </div>
  );
};

export default LoginGatedSection;
