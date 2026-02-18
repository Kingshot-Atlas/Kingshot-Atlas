import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const SiteFooter: React.FC = () => {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer
      style={{
        borderTop: '1px solid #1a1a1a',
        padding: '1rem 1.5rem',
        textAlign: 'center',
        backgroundColor: '#0a0a0a',
      }}
    >
      <p style={{ color: '#4b5563', fontSize: '0.7rem', lineHeight: 1.6, margin: 0, maxWidth: '700px', marginLeft: 'auto', marginRight: 'auto' }}>
        {t('footer.trademark', 'Kingshot\u2122 is a trademark of Century Games. All game content and materials are trademarks and copyrights of their respective owners. Kingshot Atlas is an independent fan project \u2014 not affiliated with, endorsed, sponsored, or approved by Century Games.')}
      </p>
      <p style={{ color: '#374151', fontSize: '0.65rem', marginTop: '0.5rem', marginBottom: 0 }}>
        &copy; {year} Kingshot Atlas &middot;{' '}
        <Link to="/about" style={{ color: '#4b5563', textDecoration: 'none' }}>{t('footer.about', 'About')}</Link>
        {' '}&middot;{' '}
        <Link to="/terms" style={{ color: '#4b5563', textDecoration: 'none' }}>{t('footer.terms', 'Terms')}</Link>
        {' '}&middot;{' '}
        <Link to="/privacy" style={{ color: '#4b5563', textDecoration: 'none' }}>{t('footer.privacy', 'Privacy')}</Link>
      </p>
    </footer>
  );
};

export default SiteFooter;
