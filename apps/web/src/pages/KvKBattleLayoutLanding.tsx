import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useMetaTags } from '../hooks/useMetaTags';
import { useStructuredData, PAGE_BREADCRUMBS } from '../hooks/useStructuredData';
import { neonGlow, FONT_DISPLAY } from '../utils/styles';

const KvKBattleLayoutLanding: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('battleLayoutLanding.pageTitle', 'KvK Battle Layout'));
  useMetaTags({
    title: 'KvK Battle Layout — Kingshot Atlas',
    description: 'Plan your alliance positioning around the castle and turrets for KvK Castle Battle. Visual map tool for coordinating teleport positions.',
  });
  useStructuredData({
    type: 'BreadcrumbList',
    data: [
      ...(PAGE_BREADCRUMBS.tools || []),
      { name: 'KvK Battle Layout', url: 'https://ks-atlas.com/tools/battle-layout/about' },
    ],
  });
  const isMobile = useIsMobile();
  const features = [
    {
      icon: '🏰',
      title: t('battleLayoutLanding.featMap', 'Visual Battle Map'),
      desc: t('battleLayoutLanding.featMapDesc', 'See the castle and all four turrets in their correct compass positions. South, West, East, North — no more confusion about where to teleport.'),
    },
    {
      icon: '📍',
      title: t('battleLayoutLanding.featCities', 'City Placement'),
      desc: t('battleLayoutLanding.featCitiesDesc', 'Tap to place alliance cities on the map. Name each city, drag to reposition, and plan exactly where your members should teleport before the battle starts.'),
    },
    {
      icon: '🗺️',
      title: t('battleLayoutLanding.featCompass', 'Compass Orientation'),
      desc: t('battleLayoutLanding.featCompassDesc', 'Grid lines and compass markers help you orient the map exactly like the in-game battle map. Plan positioning with zero guesswork.'),
    },
    {
      icon: '💾',
      title: t('battleLayoutLanding.featSave', 'Auto-Save'),
      desc: t('battleLayoutLanding.featSaveDesc', 'Your layout saves automatically to your browser. Come back anytime to review or adjust your battle plan.'),
    },
  ];

  const steps = [
    { num: '1', text: t('battleLayoutLanding.step1', 'Open the Battle Layout tool') },
    { num: '2', text: t('battleLayoutLanding.step2', 'Tap the map to place alliance cities around buildings') },
    { num: '3', text: t('battleLayoutLanding.step3', 'Double-tap cities to label them with player names') },
    { num: '4', text: t('battleLayoutLanding.step4', 'Drag cities to finalize teleport positions') },
    { num: '5', text: t('battleLayoutLanding.step5', 'Share your screen or screenshot the plan with your alliance') },
  ];

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: isMobile ? '1rem 0.75rem' : '2rem 1rem' }}>
      {/* Back link */}
      <Link to="/tools" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem' }}>
        ← {t('common.backToTools', 'Back to Tools')}
      </Link>

      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: isMobile ? '1.5rem' : '2.5rem' }}>
        <div style={{ fontSize: isMobile ? '2.5rem' : '3.5rem', marginBottom: '0.5rem' }}>🏰</div>
        <h1 style={{
          fontFamily: FONT_DISPLAY,
          fontSize: isMobile ? '1.5rem' : '2.2rem',
          fontWeight: 'bold',
          letterSpacing: '0.04em',
          marginBottom: '0.5rem',
          ...neonGlow('#f97316'),
        }}>
          {t('battleLayoutLanding.title', 'KvK Battle Layout')}
        </h1>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
          padding: '0.25rem 0.75rem', borderRadius: '20px',
          backgroundColor: '#f59e0b15', border: '1px solid #f59e0b40',
          marginBottom: '0.5rem',
        }}>
          <span style={{ fontSize: '0.7rem' }}>👑</span>
          <span style={{ color: '#f59e0b', fontSize: '0.65rem', fontWeight: '700', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {t('battleLayoutLanding.goldBadge', 'Gold Tier Kingdom Tool')}
          </span>
        </div>
        <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.8rem' : '0.95rem', maxWidth: 550, margin: '0 auto', lineHeight: 1.5 }}>
          {t('battleLayoutLanding.hero', 'Plan your alliance\'s teleport positions around the castle and turrets before the battle begins. Know where every member should be — before a single rally is called.')}
        </p>
      </div>

      {/* Features Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: isMobile ? '0.75rem' : '1rem',
        marginBottom: isMobile ? '1.5rem' : '2rem',
      }}>
        {features.map((f, i) => (
          <div key={i} style={{
            backgroundColor: '#111827',
            borderRadius: 12,
            border: '1px solid #1e2a35',
            padding: isMobile ? '0.75rem' : '1rem',
          }}>
            <div style={{ fontSize: '1.3rem', marginBottom: '0.3rem' }}>{f.icon}</div>
            <h3 style={{ color: '#fff', fontSize: isMobile ? '0.8rem' : '0.9rem', fontWeight: 'bold', margin: '0 0 0.25rem' }}>{f.title}</h3>
            <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.65rem' : '0.75rem', margin: 0, lineHeight: 1.4 }}>{f.desc}</p>
          </div>
        ))}
      </div>

      {/* How to Use */}
      <div style={{
        backgroundColor: '#111827',
        borderRadius: 12,
        border: '1px solid #1e2a35',
        padding: isMobile ? '1rem' : '1.25rem',
        marginBottom: isMobile ? '1.5rem' : '2rem',
      }}>
        <h2 style={{ color: '#fff', fontSize: isMobile ? '0.9rem' : '1.1rem', fontWeight: 'bold', marginBottom: '0.75rem' }}>
          {t('battleLayoutLanding.howToTitle', 'How It Works')}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {steps.map(s => (
            <div key={s.num} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                backgroundColor: '#f9731620', border: '1px solid #f9731640',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.6rem', fontWeight: 'bold', color: '#f97316', flexShrink: 0,
              }}>
                {s.num}
              </div>
              <span style={{ color: '#d1d5db', fontSize: isMobile ? '0.7rem' : '0.8rem' }}>{s.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ textAlign: 'center' }}>
        <Link
          to="/tools/battle-layout"
          style={{
            display: 'inline-block',
            padding: isMobile ? '0.65rem 1.5rem' : '0.75rem 2rem',
            backgroundColor: '#f97316',
            color: '#000',
            fontWeight: 'bold',
            fontSize: isMobile ? '0.85rem' : '0.95rem',
            borderRadius: 8,
            textDecoration: 'none',
            transition: 'all 0.2s ease',
          }}
        >
          {t('battleLayoutLanding.cta', 'Open Battle Layout')} →
        </Link>
        <p style={{ color: '#6b7280', fontSize: '0.65rem', marginTop: '0.5rem' }}>
          {t('battleLayoutLanding.ctaSub', 'Available to Gold tier kingdoms. Contribute to your kingdom fund to unlock.')}
        </p>
      </div>
    </div>
  );
};

export default KvKBattleLayoutLanding;
