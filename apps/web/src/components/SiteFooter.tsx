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
      <p style={{ color: '#6b7280', fontSize: '0.8rem', lineHeight: 1.6, margin: 0, maxWidth: '700px', marginLeft: 'auto', marginRight: 'auto' }}>
        {t('footer.trademark', 'Kingshot\u2122 is a trademark of Century Games. All game content and materials are trademarks and copyrights of their respective owners. Kingshot Atlas is an independent fan project \u2014 not affiliated with, endorsed, sponsored, or approved by Century Games.')}
      </p>
      <nav aria-label="Footer navigation" style={{ color: '#4b5563', fontSize: '0.75rem', marginTop: '0.5rem', marginBottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: '0.25rem' }}>
        <span>&copy; {year} Kingshot Atlas</span>
        <span>&middot;</span>
        <Link to="/about" style={{ color: '#6b7280', textDecoration: 'none', padding: '0.35rem 0.25rem' }}>{t('footer.about', 'About')}</Link>
        <span>&middot;</span>
        <Link to="/terms" style={{ color: '#6b7280', textDecoration: 'none', padding: '0.35rem 0.25rem' }}>{t('footer.terms', 'Terms')}</Link>
        <span>&middot;</span>
        <Link to="/privacy" style={{ color: '#6b7280', textDecoration: 'none', padding: '0.35rem 0.25rem' }}>{t('footer.privacy', 'Privacy')}</Link>
      </nav>
    </footer>
  );
};

export default SiteFooter;
