import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import BackLink from '../components/shared/BackLink';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useMetaTags, PAGE_META_TAGS } from '../hooks/useMetaTags';
import { neonGlow, FONT_DISPLAY } from '../utils/styles';
import { usePremium } from '../contexts/PremiumContext';
import { useAuth } from '../contexts/AuthContext';
import { useGoldKingdoms } from '../hooks/useGoldKingdoms';
import { useAdminToolGrant } from '../hooks/useAdminToolGrant';
import { useKvk11Promo } from '../hooks/useKvk11Promo';
import { supabase } from '../lib/supabase';

const KvKBattleLayoutLanding: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('battleLayoutLanding.pageTitle', 'KvK Battle Layout'));
  useMetaTags(PAGE_META_TAGS.battleLayout || {
    title: 'KvK Battle Layout — Plan Alliance Teleport Positions | Kingshot Atlas',
    description: 'Plan your alliance positioning around the castle and turrets for KvK Castle Battle. Visual map tool for coordinating teleport positions.',
  });
  const isMobile = useIsMobile();
  const { isAdmin } = usePremium();
  const { profile, user } = useAuth();
  const goldKingdoms = useGoldKingdoms();
  const { hasPromoAccess } = useKvk11Promo();
  const isGoldKingdom = !!(profile?.linked_kingdom && goldKingdoms.has(profile.linked_kingdom));
  const hasSilverPromoAccess = !!(profile?.linked_kingdom && hasPromoAccess(profile.linked_kingdom));
  const { hasGrant: hasToolGrant } = useAdminToolGrant('battle_layout');
  const [isEditorOrCoEditor, setIsEditorOrCoEditor] = useState(false);
  const hasFullAccess = isGoldKingdom || hasSilverPromoAccess || isAdmin || isEditorOrCoEditor || hasToolGrant;

  useEffect(() => {
    if (!user?.id || !supabase) return;
    (async () => {
      const { data } = await supabase
        .from('kingdom_editors')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();
      setIsEditorOrCoEditor(!!data);
    })();
  }, [user?.id]);

  const features = [
    {
      icon: '🏰',
      title: t('battleLayoutLanding.featMap', 'Visual Battle Map'),
      desc: t('battleLayoutLanding.featMapDesc', 'See the castle and all four turrets in their correct compass positions. South, West, East, North — no more confusion about where to teleport.'),
    },
    {
      icon: '📍',
      title: t('battleLayoutLanding.featCities', 'City Placement'),
      desc: t('battleLayoutLanding.featCitiesDesc', 'Tap to place alliance cities on the map. Assign positions per alliance so every member knows exactly where to teleport before the battle starts.'),
    },
    {
      icon: '🏷️',
      title: t('battleLayoutLanding.featLabels', 'Player Labels'),
      desc: t('battleLayoutLanding.featLabelsDesc', 'Double-tap any city to label it with a player or alliance name. Crystal-clear assignments — no confusion in the heat of battle.'),
    },
    {
      icon: '🔄',
      title: t('battleLayoutLanding.featDrag', 'Drag & Reposition'),
      desc: t('battleLayoutLanding.featDragDesc', 'Fine-tune positions by dragging cities around the map. Adjust the plan in real time as your strategy evolves.'),
    },
    {
      icon: '📸',
      title: t('battleLayoutLanding.featScreenshot', 'Screenshot Ready'),
      desc: t('battleLayoutLanding.featScreenshotDesc', 'The layout is designed to be screenshotted and shared in alliance chat. One image, zero misunderstandings.'),
    },
    {
      icon: '💾',
      title: t('battleLayoutLanding.featSave', 'Auto-Save'),
      desc: t('battleLayoutLanding.featSaveDesc', 'Your layout saves automatically. Come back anytime to review or adjust your battle plan — nothing is lost.'),
    },
  ];

  const steps = [
    {
      num: '1',
      icon: '🗺️',
      title: t('battleLayoutLanding.step1Title', 'Open the Layout'),
      desc: t('battleLayoutLanding.step1Desc', 'Launch the Battle Layout tool and see the castle battlefield with all four turrets.'),
    },
    {
      num: '2',
      icon: '📍',
      title: t('battleLayoutLanding.step2Title', 'Place Your Cities'),
      desc: t('battleLayoutLanding.step2Desc', 'Tap to place alliance cities around the buildings. Label them and drag to finalize positions.'),
    },
    {
      num: '3',
      icon: '📢',
      title: t('battleLayoutLanding.step3Title', 'Share the Plan'),
      desc: t('battleLayoutLanding.step3Desc', 'Screenshot the layout and share it with your kingdom. Everyone knows exactly where to be.'),
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
            borderRadius: '50%', backgroundColor: '#f9731615',
            border: '2px solid #f9731630',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.25rem',
            boxShadow: '0 0 30px rgba(249, 115, 22, 0.15), 0 0 60px rgba(249, 115, 22, 0.08)',
          }}>
            <span style={{ fontSize: isMobile ? '1.75rem' : '2.25rem' }}>🗺️</span>
          </div>

          <h1 style={{
            fontSize: isMobile ? '1.75rem' : '2.5rem', fontWeight: 'bold',
            marginBottom: '0.75rem', fontFamily: FONT_DISPLAY,
          }}>
            <span style={{ color: '#fff' }}>{t('battleLayoutLanding.heroTitle1', 'KvK BATTLE')}</span>
            <span style={{ ...neonGlow('#f97316'), marginLeft: '0.5rem' }}>{t('battleLayoutLanding.heroTitle2', 'LAYOUT')}</span>
          </h1>
          <p style={{
            color: '#9ca3af', fontSize: isMobile ? '0.95rem' : '1.1rem',
            maxWidth: '520px', margin: '0 auto 1.5rem', lineHeight: 1.6,
          }}>
            {t('battleLayoutLanding.heroSubtitle', 'Teleport chaos loses castles. A clear positioning plan wins them. Know where every alliance should be — before a single rally is called.')}
          </p>

          {/* CTA */}
          <div style={{
            display: 'flex', flexDirection: isMobile ? 'column' : 'row',
            gap: '0.75rem', justifyContent: 'center', alignItems: 'center',
          }}>
            <Link
              to="/tools/battle-layout"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
                padding: isMobile ? '0.85rem 1.75rem' : '0.9rem 2rem',
                backgroundColor: '#f97316', border: 'none', borderRadius: '10px',
                color: '#fff', fontWeight: 700,
                fontSize: isMobile ? '0.95rem' : '1rem', textDecoration: 'none',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 20px rgba(249, 115, 22, 0.35)',
              }}
            >
              🗺️ {t('battleLayoutLanding.launchLayout', 'Open the Layout')}
            </Link>
            {!hasFullAccess && (
              <Link
                to={profile?.linked_kingdom ? `/kingdom/${profile.linked_kingdom}/fund` : '/transfer-hub'}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.75rem 1.5rem', backgroundColor: 'transparent',
                  border: '1px solid #ffc30b40', borderRadius: '8px',
                  color: '#ffc30b', fontWeight: 600,
                  fontSize: isMobile ? '0.9rem' : '0.95rem', textDecoration: 'none',
                }}
              >
                {t('battleLayoutLanding.fundYourKingdom', 'Fund Your Kingdom')}
              </Link>
            )}
          </div>
          <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.75rem' }}>
            {hasFullAccess
              ? t('battleLayoutLanding.accessConfirm', 'You have full access as a Gold Tier kingdom member.')
              : t('battleLayoutLanding.goldPerk', 'Available for Gold Tier kingdoms. Contribute to the Kingdom Fund to unlock.')}
          </p>

          {!isMobile && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
              <div style={{ width: '50px', height: '2px', background: 'linear-gradient(90deg, transparent, #f97316)' }} />
              <div style={{ width: '6px', height: '6px', backgroundColor: '#f97316', transform: 'rotate(45deg)', boxShadow: '0 0 8px #f97316' }} />
              <div style={{ width: '50px', height: '2px', background: 'linear-gradient(90deg, #f97316, transparent)' }} />
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
            <span style={{ color: '#fff' }}>{t('battleLayoutLanding.howItWorks1', 'HOW IT')}</span>
            <span style={{ ...neonGlow('#f97316'), marginLeft: '0.4rem' }}>{t('battleLayoutLanding.howItWorks2', 'WORKS')}</span>
          </h2>
          <p style={{
            color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.85rem',
            textAlign: 'center', marginBottom: '1.5rem',
          }}>
            {t('battleLayoutLanding.threeSteps', 'Three steps. Total positioning clarity.')}
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
                  backgroundColor: '#f9731615', border: '1px solid #f9731630',
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
            <span style={{ color: '#fff' }}>{t('battleLayoutLanding.builtFor1', 'BUILT FOR')}</span>
            <span style={{ ...neonGlow('#f97316'), marginLeft: '0.4rem' }}>{t('battleLayoutLanding.builtFor2', 'BATTLE COMMANDERS')}</span>
          </h2>
          <p style={{
            color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.85rem',
            textAlign: 'center', marginBottom: '1.5rem',
          }}>
            {t('battleLayoutLanding.featuresSubtitle', 'Every feature exists because castle battle leaders needed it.')}
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
          border: '1px solid #f9731630', padding: isMobile ? '1.25rem' : '1.75rem',
          background: 'linear-gradient(135deg, #111111 0%, #f9731608 100%)',
        }}>
          <h2 style={{
            fontSize: isMobile ? '1.05rem' : '1.2rem', fontWeight: 'bold', color: '#fff',
            marginBottom: '1rem', fontFamily: FONT_DISPLAY,
          }}>
            {t('battleLayoutLanding.problemTitle', 'Three alliances stack on the same turret. Nobody covers the castle.')}
          </h2>
          <p style={{ color: '#d1d5db', fontSize: isMobile ? '0.85rem' : '0.9rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            {t('battleLayoutLanding.problemDesc', "Everyone teleports wherever they feel like. Two alliances fight over the south turret while the north is wide open. The enemy walks into your castle because nobody was positioned to defend it. Sound familiar?")}
          </p>
          <p style={{ color: '#d1d5db', fontSize: isMobile ? '0.85rem' : '0.9rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            {t('battleLayoutLanding.solutionDesc', "The Battle Layout gives you a bird's-eye view of the castle battlefield. Place your alliance cities exactly where they need to be — every turret covered, every approach defended. Share the plan before the battle. Zero confusion when the clock hits zero.")}
          </p>
          <p style={{ color: '#f97316', fontSize: isMobile ? '0.8rem' : '0.85rem', fontWeight: 600, fontStyle: 'italic' }}>
            {t('battleLayoutLanding.punchline', "Positioning isn't a suggestion. It's the difference between a coordinated hold and a chaotic wipe.")}
          </p>
        </div>

        {/* Gold Kingdom CTA */}
        <div style={{
          marginBottom: isMobile ? '2rem' : '3rem',
          padding: isMobile ? '1.5rem' : '2rem',
          backgroundColor: '#111111', borderRadius: '16px',
          border: hasFullAccess ? '1px solid #22c55e30' : '1px solid #ffc30b30', textAlign: 'center',
          background: hasFullAccess
            ? 'linear-gradient(135deg, #111111 0%, #22c55e08 100%)'
            : 'linear-gradient(135deg, #111111 0%, #ffc30b08 100%)',
        }}>
          <span style={{
            fontSize: '0.65rem', fontWeight: 700,
            color: hasFullAccess ? '#22c55e' : '#ffc30b',
            backgroundColor: hasFullAccess ? '#22c55e18' : '#ffc30b18',
            border: hasFullAccess ? '1px solid #22c55e30' : '1px solid #ffc30b30',
            padding: '0.2rem 0.6rem', borderRadius: '4px',
            letterSpacing: '0.05em', textTransform: 'uppercase',
            display: 'inline-block', marginBottom: '0.75rem',
          }}>
            {hasFullAccess
              ? t('battleLayoutLanding.accessUnlocked', 'Access Unlocked')
              : t('battleLayoutLanding.goldBadge', 'Gold Tier Kingdom Feature')}
          </span>
          <h3 style={{
            fontSize: isMobile ? '1.1rem' : '1.25rem', fontWeight: 'bold',
            color: '#fff', marginBottom: '0.5rem', fontFamily: FONT_DISPLAY,
          }}>
            {hasFullAccess
              ? t('battleLayoutLanding.accessThanks', 'You have full access to the Battle Layout.')
              : t('battleLayoutLanding.goldTitle', 'Your kingdom deserves a clear battle plan.')}
          </h3>
          <p style={{
            color: '#9ca3af', fontSize: isMobile ? '0.8rem' : '0.85rem',
            marginBottom: '1.25rem', maxWidth: '450px', margin: '0 auto 1.25rem', lineHeight: 1.6,
          }}>
            {hasFullAccess
              ? t('battleLayoutLanding.accessThanksDesc', 'Your kingdom has earned Gold Tier status. Open the layout and start planning your next castle battle positions.')
              : t('battleLayoutLanding.goldDesc', 'The Battle Layout is a Gold Tier feature. Help your kingdom reach Gold by contributing to the Kingdom Fund on the Transfer Hub.')}
          </p>
          <div style={{
            display: 'flex', flexDirection: isMobile ? 'column' : 'row',
            gap: '0.75rem', justifyContent: 'center', alignItems: 'center',
          }}>
            {hasFullAccess ? (
              <Link
                to="/tools/battle-layout"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.75rem 1.5rem', backgroundColor: '#22c55e',
                  border: 'none', borderRadius: '8px', color: '#fff',
                  fontWeight: 600, fontSize: isMobile ? '0.9rem' : '0.95rem',
                  textDecoration: 'none', transition: 'all 0.2s ease',
                  boxShadow: '0 4px 15px rgba(34, 197, 94, 0.3)',
                }}
              >
                🗺️ {t('battleLayoutLanding.launchLayout', 'Open the Layout')}
              </Link>
            ) : (
              <>
                <Link
                  to={profile?.linked_kingdom ? `/kingdom/${profile.linked_kingdom}/fund` : '/transfer-hub'}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.75rem 1.5rem', backgroundColor: '#ffc30b',
                    border: 'none', borderRadius: '8px', color: '#0a0a0a',
                    fontWeight: 600, fontSize: isMobile ? '0.9rem' : '0.95rem',
                    textDecoration: 'none', transition: 'all 0.2s ease',
                    boxShadow: '0 4px 15px rgba(255, 195, 11, 0.3)',
                  }}
                >
                  {t('battleLayoutLanding.fundYourKingdom', 'Fund Your Kingdom')}
                </Link>
                <Link
                  to="/tools/battle-layout"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.75rem 1.5rem', backgroundColor: 'transparent',
                    border: '1px solid #f9731640', borderRadius: '8px',
                    color: '#f97316', fontWeight: 600,
                    fontSize: isMobile ? '0.9rem' : '0.95rem', textDecoration: 'none',
                  }}
                >
                  {t('battleLayoutLanding.tryLayout', 'Try the Layout')}
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Back links */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', paddingBottom: '1rem', flexWrap: 'wrap' }}>
          <BackLink to="/tools" label={t('common.allTools', 'All Tools')} />
          <BackLink to="/" label={t('common.backToHome', 'Home')} variant="secondary" />
        </div>
      </div>
    </div>
  );
};

export default KvKBattleLayoutLanding;
