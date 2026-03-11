import React from 'react';
import BackLink from '../shared/BackLink';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useAuth } from '../../contexts/AuthContext';
import { FONT_DISPLAY } from '../../utils/styles';

// ─── Access Gate (allows any authenticated user; dashboard handles role-specific views) ───
const AllianceCenterGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  if (authLoading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>{t('common.loading', 'Loading...')}</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏰</div>
        <h2 style={{ color: '#fff', fontFamily: FONT_DISPLAY, fontSize: isMobile ? '1.25rem' : '1.5rem', marginBottom: '0.75rem' }}>
          {t('allianceCenter.gateTitle', 'Alliance Center')}
        </h2>
        <p style={{ color: '#9ca3af', maxWidth: '420px', marginBottom: '1.5rem', lineHeight: 1.6, fontSize: isMobile ? '0.85rem' : '0.9rem' }}>
          {t('allianceCenter.gateDescLogin', 'Sign in to access the Alliance Center. Manage your alliance roster and coordinate with your team.')}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <BackLink to="/tools" label={t('common.allTools', 'All Tools')} />
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AllianceCenterGate;
