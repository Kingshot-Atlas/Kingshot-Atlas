import React from 'react';
import BackLink from '../components/shared/BackLink';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useStructuredData, PAGE_BREADCRUMBS } from '../hooks/useStructuredData';
import { neonGlow, FONT_DISPLAY } from '../utils/styles';
import { ACCENT } from '../components/alliance/allianceCenterConstants';
import AllianceCenterGate from '../components/alliance/AllianceCenterGate';
import AllianceDashboard from '../components/alliance/AllianceDashboard';

// ─── Main Page ───
const AllianceCenter: React.FC = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  useDocumentTitle(t('allianceCenter.pageTitle', 'Alliance Center'));
  useStructuredData({
    type: 'BreadcrumbList',
    data: [
      ...(PAGE_BREADCRUMBS.tools || []),
      { name: 'Alliance Center', url: 'https://ks-atlas.com/alliance-center' },
    ],
  });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      <div style={{ padding: isMobile ? '1.25rem 1rem 1rem' : '1.5rem 2rem 1.25rem', textAlign: 'center', background: 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)' }}>
        <h1 style={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 'bold', fontFamily: FONT_DISPLAY, letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
          <span style={{ color: '#fff' }}>ALLIANCE </span>
          <span style={neonGlow(ACCENT)}>CENTER</span>
        </h1>
        <p style={{ color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.85rem', margin: 0 }}>
          {t('allianceCenter.subtitle', 'Your alliance command hub — manage your roster and coordinate.')}
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginTop: '0.75rem' }}>
          <BackLink to="/tools" label={t('common.allTools', 'All Tools')} variant="secondary" />
        </div>
      </div>
      <AllianceCenterGate>
        <AllianceDashboard />
      </AllianceCenterGate>
    </div>
  );
};

export default AllianceCenter;
