import React from 'react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { neonGlow, FONT_DISPLAY } from '../utils/styles';
import { useTranslation } from 'react-i18next';
import { useToolAccess } from '../hooks/useToolAccess';
import ToolDelegates from '../components/ToolDelegates';

const ACCENT = '#f97316';
const ACCENT_DIM = '#f9731615';
const ACCENT_BORDER = '#f9731630';

const BaseDesignerLanding: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('baseDesigner.pageTitle', 'Alliance Base Designer'));
  const isMobile = useIsMobile();
  const { hasAccess, reason, grantedBy } = useToolAccess();
  const canManageDelegates = reason === 'supporter' || reason === 'ambassador' || reason === 'booster' || reason === 'admin';

  const features = [
    {
      icon: '🗺️',
      title: t('baseDesigner.featGrid', 'Isometric Grid Map'),
      desc: t('baseDesigner.featGridDesc', 'A full 1200×1200 isometric grid that mirrors the in-game alliance territory. Zoom, pan, and navigate just like the real map.'),
    },
    {
      icon: '🏗️',
      title: t('baseDesigner.featBuildings', 'Drag & Drop Buildings'),
      desc: t('baseDesigner.featBuildingsDesc', 'Place cities, traps, flags, resource points, and alliance buildings. Each type has its correct footprint — no guesswork.'),
    },
    {
      icon: '🏷️',
      title: t('baseDesigner.featLabels', 'Player Labels'),
      desc: t('baseDesigner.featLabelsDesc', 'Assign player names to city blocks and time slots to traps. Everyone knows exactly where they belong.'),
    },
    {
      icon: '💾',
      title: t('baseDesigner.featSave', 'Auto-Save & Restore'),
      desc: t('baseDesigner.featSaveDesc', 'Your layout auto-saves to your browser. Refresh the page, come back tomorrow — your design is still there. Save multiple designs too.'),
    },
    {
      icon: '📐',
      title: t('baseDesigner.featBounds', 'Map Area Focus'),
      desc: t('baseDesigner.featBoundsDesc', 'Set coordinate bounds to highlight your alliance territory. Focus the view instantly on the area that matters.'),
    },
    {
      icon: '⌨️',
      title: t('baseDesigner.featShortcuts', 'Keyboard & Trackpad'),
      desc: t('baseDesigner.featShortcutsDesc', 'Full keyboard shortcuts for undo, redo, delete, and navigation. Smooth trackpad panning and pinch-to-zoom on desktop.'),
    },
  ];

  const steps = [
    {
      num: '1',
      icon: '📐',
      title: t('baseDesigner.step1', 'Set Your Territory'),
      desc: t('baseDesigner.step1Desc', 'Enter the coordinate range of your alliance base. Focus the map on your area.'),
    },
    {
      num: '2',
      icon: '🧱',
      title: t('baseDesigner.step2', 'Place Buildings'),
      desc: t('baseDesigner.step2Desc', 'Select building types and click to place them on the grid. Drag to reposition. Label cities with player names.'),
    },
    {
      num: '3',
      icon: '📢',
      title: t('baseDesigner.step3', 'Share the Plan'),
      desc: t('baseDesigner.step3Desc', 'Screenshot or save your design. Share it with R4/R5 leadership to coordinate the alliance base layout.'),
    },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      {/* Hero */}
      <div style={{
        padding: isMobile ? '2rem 1rem 1.5rem' : '3rem 2rem 2rem',
        textAlign: 'center',
        background: 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '700px', margin: '0 auto' }}>
          <div style={{
            width: isMobile ? '64px' : '80px', height: isMobile ? '64px' : '80px',
            borderRadius: '50%', backgroundColor: ACCENT_DIM,
            border: `2px solid ${ACCENT_BORDER}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.25rem',
            boxShadow: `0 0 30px rgba(249, 115, 22, 0.15), 0 0 60px rgba(249, 115, 22, 0.08)`,
          }}>
            <span style={{ fontSize: isMobile ? '1.75rem' : '2.25rem' }}>🏰</span>
          </div>

          <h1 style={{
            fontSize: isMobile ? '1.75rem' : '2.5rem', fontWeight: 'bold',
            marginBottom: '0.75rem', fontFamily: FONT_DISPLAY,
          }}>
            <span style={{ color: '#fff' }}>{t('baseDesigner.heroTitle1', 'ALLIANCE BASE')}</span>
            <span style={{ ...neonGlow(ACCENT), marginLeft: '0.5rem' }}>{t('baseDesigner.heroTitle2', 'DESIGNER')}</span>
          </h1>
          <p style={{
            color: '#9ca3af', fontSize: isMobile ? '0.95rem' : '1.1rem',
            maxWidth: '520px', margin: '0 auto 1.5rem', lineHeight: 1.6,
          }}>
            {t('baseDesigner.heroSubtitle', 'Your alliance base is a fortress — or a liability. Plan the layout before a single flag drops. No more "just put your city anywhere."')}
          </p>

          {/* CTA */}
          <div style={{
            display: 'flex', flexDirection: isMobile ? 'column' : 'row',
            gap: '0.75rem', justifyContent: 'center', alignItems: 'center',
          }}>
            <Link
              to="/tools/base-designer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
                padding: isMobile ? '0.85rem 1.75rem' : '0.9rem 2rem',
                backgroundColor: ACCENT, border: 'none', borderRadius: '10px',
                color: '#fff', fontWeight: 700,
                fontSize: isMobile ? '0.95rem' : '1rem', textDecoration: 'none',
                transition: 'all 0.2s ease',
                boxShadow: `0 4px 20px rgba(249, 115, 22, 0.35)`,
              }}
            >
              🏰 {t('baseDesigner.launchDesigner', 'Launch the Designer')}
            </Link>
          </div>
          <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.75rem' }}>
            {reason === 'delegate'
              ? t('baseDesigner.accessDelegate', 'Access granted by {{name}}', { name: grantedBy })
              : hasAccess
                ? t('baseDesigner.accessConfirm', 'You have access to the Alliance Base Designer.')
                : t('baseDesigner.accessNote', 'Available for Atlas Supporters, Ambassadors, and Admins.')}
          </p>

          {!isMobile && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
              <div style={{ width: '50px', height: '2px', background: `linear-gradient(90deg, transparent, ${ACCENT})` }} />
              <div style={{ width: '6px', height: '6px', backgroundColor: ACCENT, transform: 'rotate(45deg)', boxShadow: `0 0 8px ${ACCENT}` }} />
              <div style={{ width: '50px', height: '2px', background: `linear-gradient(90deg, ${ACCENT}, transparent)` }} />
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: isMobile ? '1rem' : '2rem' }}>

        {/* How It Works */}
        <div style={{ marginBottom: isMobile ? '2rem' : '3rem' }}>
          <h2 style={{
            fontSize: isMobile ? '1.1rem' : '1.35rem', fontWeight: 'bold', color: '#fff',
            marginBottom: '0.4rem', fontFamily: FONT_DISPLAY, textAlign: 'center',
          }}>
            <span style={{ color: '#fff' }}>{t('baseDesigner.howItWorks1', 'HOW IT')}</span>
            <span style={{ ...neonGlow(ACCENT), marginLeft: '0.4rem' }}>{t('baseDesigner.howItWorks2', 'WORKS')}</span>
          </h2>
          <p style={{
            color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.85rem',
            textAlign: 'center', marginBottom: '1.5rem',
          }}>
            {t('baseDesigner.threeSteps', 'Three steps. One organized fortress.')}
          </p>

          <div style={{
            display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1rem',
          }}>
            {steps.map((item) => (
              <div key={item.num} style={{
                backgroundColor: '#111111', borderRadius: '12px', border: '1px solid #2a2a2a',
                padding: isMobile ? '1rem' : '1.25rem', textAlign: 'center',
              }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '50%',
                  backgroundColor: ACCENT_DIM, border: `1px solid ${ACCENT_BORDER}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 0.75rem', fontSize: '1.1rem',
                }}>
                  {item.icon}
                </div>
                <h3 style={{ fontSize: isMobile ? '0.95rem' : '1rem', fontWeight: 700, color: '#fff', marginBottom: '0.35rem' }}>
                  {item.title}
                </h3>
                <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.75rem' : '0.8rem', lineHeight: 1.5 }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Features */}
        <div style={{ marginBottom: isMobile ? '2rem' : '3rem' }}>
          <h2 style={{
            fontSize: isMobile ? '1.1rem' : '1.35rem', fontWeight: 'bold', color: '#fff',
            marginBottom: '0.4rem', fontFamily: FONT_DISPLAY, textAlign: 'center',
          }}>
            <span style={{ color: '#fff' }}>{t('baseDesigner.builtFor1', 'BUILT FOR')}</span>
            <span style={{ ...neonGlow(ACCENT), marginLeft: '0.4rem' }}>{t('baseDesigner.builtFor2', 'ALLIANCE LEADERS')}</span>
          </h2>
          <p style={{
            color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.85rem',
            textAlign: 'center', marginBottom: '1.5rem',
          }}>
            {t('baseDesigner.featuresSubtitle', 'Every feature exists because R4/R5 leaders asked for it.')}
          </p>

          <div style={{
            display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '1rem',
          }}>
            {features.map((f) => (
              <div key={f.title} style={{
                backgroundColor: '#111111', borderRadius: '12px', border: '1px solid #2a2a2a',
                padding: isMobile ? '1rem' : '1.25rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.25rem', lineHeight: 1, flexShrink: 0 }}>{f.icon}</span>
                  <div>
                    <h3 style={{ fontSize: isMobile ? '0.9rem' : '0.95rem', fontWeight: 700, color: '#fff', marginBottom: '0.3rem' }}>
                      {f.title}
                    </h3>
                    <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.75rem' : '0.8rem', lineHeight: 1.5 }}>
                      {f.desc}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* The Problem & Solution */}
        <div style={{
          marginBottom: isMobile ? '2rem' : '3rem',
          backgroundColor: '#111111', borderRadius: '16px',
          border: `1px solid ${ACCENT_BORDER}`, padding: isMobile ? '1.25rem' : '1.75rem',
          background: `linear-gradient(135deg, #111111 0%, ${ACCENT_DIM} 100%)`,
        }}>
          <h2 style={{
            fontSize: isMobile ? '1.05rem' : '1.2rem', fontWeight: 'bold', color: '#fff',
            marginBottom: '1rem', fontFamily: FONT_DISPLAY,
          }}>
            {t('baseDesigner.problemTitle', '"Just put your city near the flag." That\'s not a strategy.')}
          </h2>
          <p style={{ color: '#d1d5db', fontSize: isMobile ? '0.85rem' : '0.9rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            {t('baseDesigner.problemDesc', 'Players too far from the bear traps. Cities scattered in dead zones where reinforcements can\'t reach them in time. Without a layout tool, you\'re stuck with spreadsheets, hand-drawn maps, or just hoping everyone figures it out. R4s spend hours directing teleports one by one — and between language barriers and players who keep landing on the wrong tile, half the work gets undone the moment someone moves.')}
          </p>
          <p style={{ color: '#d1d5db', fontSize: isMobile ? '0.85rem' : '0.9rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            {t('baseDesigner.solutionDesc', 'The Alliance Base Designer lets you plan the entire layout before anyone moves. Place every city, every trap, every building on the exact coordinates. Label each block with the player\'s name. Share the screenshot. Everyone knows exactly where to go. Need to adjust? It\'s drag and drop — rearrange the whole base in minutes, not hours.')}
          </p>
          <p style={{ color: ACCENT, fontSize: isMobile ? '0.8rem' : '0.85rem', fontWeight: 600, fontStyle: 'italic' }}>
            {t('baseDesigner.punchline', 'That\'s not planning. That\'s a defensive masterclass.')}
          </p>
        </div>

        {/* Access CTA */}
        <div style={{
          marginBottom: isMobile ? '2rem' : '3rem',
          padding: isMobile ? '1.5rem' : '2rem',
          backgroundColor: '#111111', borderRadius: '16px',
          border: hasAccess ? '1px solid #22c55e30' : `1px solid ${ACCENT_BORDER}`, textAlign: 'center',
          background: hasAccess
            ? 'linear-gradient(135deg, #111111 0%, #22c55e08 100%)'
            : `linear-gradient(135deg, #111111 0%, ${ACCENT_DIM} 100%)`,
        }}>
          <span style={{
            fontSize: '0.65rem', fontWeight: 700,
            color: hasAccess ? '#22c55e' : ACCENT,
            backgroundColor: hasAccess ? '#22c55e18' : `${ACCENT}18`,
            border: hasAccess ? '1px solid #22c55e30' : `1px solid ${ACCENT_BORDER}`,
            padding: '0.2rem 0.6rem', borderRadius: '4px',
            letterSpacing: '0.05em', textTransform: 'uppercase',
            display: 'inline-block', marginBottom: '0.75rem',
          }}>
            {hasAccess
              ? t('baseDesigner.accessUnlocked', 'Access Unlocked')
              : t('baseDesigner.supporterBadge', 'Supporter · Ambassador · Admin')}
          </span>
          <h3 style={{
            fontSize: isMobile ? '1.1rem' : '1.25rem', fontWeight: 'bold',
            color: '#fff', marginBottom: '0.5rem', fontFamily: FONT_DISPLAY,
          }}>
            {hasAccess
              ? t('baseDesigner.accessThanks', 'You have full access to the Base Designer.')
              : t('baseDesigner.accessTitle', 'Your alliance deserves a real battle plan.')}
          </h3>
          <p style={{
            color: '#9ca3af', fontSize: isMobile ? '0.8rem' : '0.85rem',
            marginBottom: '1.25rem', maxWidth: '450px', margin: '0 auto 1.25rem', lineHeight: 1.6,
          }}>
            {hasAccess
              ? t('baseDesigner.accessThanksDesc', 'Jump into the designer and start planning your alliance fortress.')
              : t('baseDesigner.accessDesc', 'The Alliance Base Designer is currently available for Atlas Supporters, Ambassadors, and Admins. Become a Supporter to unlock this and other premium tools.')}
          </p>
          <div style={{
            display: 'flex', flexDirection: isMobile ? 'column' : 'row',
            gap: '0.75rem', justifyContent: 'center', alignItems: 'center',
          }}>
            {hasAccess ? (
              <Link
                to="/tools/base-designer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.75rem 1.5rem', backgroundColor: '#22c55e',
                  border: 'none', borderRadius: '8px', color: '#fff',
                  fontWeight: 600, fontSize: isMobile ? '0.9rem' : '0.95rem',
                  textDecoration: 'none', transition: 'all 0.2s ease',
                  boxShadow: '0 4px 15px rgba(34, 197, 94, 0.3)',
                }}
              >
                🏰 {t('baseDesigner.launchDesigner', 'Launch the Designer')}
              </Link>
            ) : (
              <>
                <Link
                  to="/support"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.75rem 1.5rem', backgroundColor: ACCENT,
                    border: 'none', borderRadius: '8px', color: '#fff',
                    fontWeight: 600, fontSize: isMobile ? '0.9rem' : '0.95rem',
                    textDecoration: 'none', transition: 'all 0.2s ease',
                    boxShadow: `0 4px 15px rgba(249, 115, 22, 0.3)`,
                  }}
                >
                  {t('baseDesigner.becomeSupporter', 'Become a Supporter')}
                </Link>
                <Link
                  to="/tools/base-designer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.75rem 1.5rem', backgroundColor: 'transparent',
                    border: `1px solid ${ACCENT}40`, borderRadius: '8px',
                    color: ACCENT, fontWeight: 600,
                    fontSize: isMobile ? '0.9rem' : '0.95rem', textDecoration: 'none',
                  }}
                >
                  {t('baseDesigner.tryDesigner', 'Try the Designer')}
                </Link>
              </>
            )}
          </div>
          {reason === 'delegate' && grantedBy && (
            <p style={{ color: '#22d3ee', fontSize: '0.8rem', marginTop: '0.75rem' }}>
              🤝 {t('baseDesigner.delegateBadge', 'Delegated access from {{name}}', { name: grantedBy })}
            </p>
          )}
          {canManageDelegates && (
            <div style={{ marginTop: '1.5rem', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
              <ToolDelegates />
            </div>
          )}
        </div>

        {/* Back links */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', paddingBottom: '1rem' }}>
          <Link to="/tools" style={{ color: ACCENT, textDecoration: 'none', fontSize: '0.8rem' }}>
            {t('common.allTools', '← All Tools')}
          </Link>
          <Link to="/" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '0.8rem' }}>
            {t('common.backToHome', '← Back to Home')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default BaseDesignerLanding;
