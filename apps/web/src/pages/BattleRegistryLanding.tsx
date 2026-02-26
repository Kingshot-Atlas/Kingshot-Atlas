import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { neonGlow, FONT_DISPLAY } from '../utils/styles';
import { useTranslation } from 'react-i18next';
import { usePremium } from '../contexts/PremiumContext';
import { useAuth } from '../contexts/AuthContext';
import { useGoldKingdoms } from '../hooks/useGoldKingdoms';
import { useKvk11Promo } from '../hooks/useKvk11Promo';
import { supabase } from '../lib/supabase';

const BattleRegistryLanding: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('battleRegistryLanding.pageTitle', 'KvK Battle Registry'));
  const isMobile = useIsMobile();
  const { isAdmin } = usePremium();
  const { profile, user } = useAuth();
  const goldKingdoms = useGoldKingdoms();
  const { hasPromoAccess } = useKvk11Promo();
  const isGoldKingdom = !!(profile?.linked_kingdom && goldKingdoms.has(profile.linked_kingdom));
  const hasSilverPromoAccess = !!(profile?.linked_kingdom && hasPromoAccess(profile.linked_kingdom));
  const [isEditorOrCoEditor, setIsEditorOrCoEditor] = useState(false);
  const hasFullAccess = isGoldKingdom || hasSilverPromoAccess || isAdmin || isEditorOrCoEditor;

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
      icon: '⏰',
      title: t('battleRegistryLanding.featTime', 'Time Slot Collection'),
      desc: t('battleRegistryLanding.featTimeDesc', 'Players pick their availability between 12:00–18:00 UTC. Instantly see how many warriors you have at each hour. No more guessing who\'s online.'),
    },
    {
      icon: '🗡️',
      title: t('battleRegistryLanding.featTroops', 'Troop Level Tracking'),
      desc: t('battleRegistryLanding.featTroopsDesc', 'Every player reports their Infantry, Cavalry, and Archer Tier (T1–T11) and Truegold Level (TG1–TG8). Know your kingdom\'s true military strength.'),
    },
    {
      icon: '📊',
      title: t('battleRegistryLanding.featDashboard', 'Commander Dashboard'),
      desc: t('battleRegistryLanding.featDashboardDesc', 'Real-time summary of player availability and troop distribution. See your army composition at a glance — tier spread, truegold levels, alliance breakdown.'),
    },
    {
      icon: '🏰',
      title: t('battleRegistryLanding.featAlliance', 'Alliance Breakdown'),
      desc: t('battleRegistryLanding.featAllianceDesc', 'See exactly how many players each alliance is contributing. Hold everyone accountable. Reward the alliances that show up.'),
    },
    {
      icon: '🔗',
      title: t('battleRegistryLanding.featShare', 'One Link, One Form'),
      desc: t('battleRegistryLanding.featShareDesc', 'Share a single link with your kingdom. Players fill a 30-second form. Username and alliance auto-fill. Zero friction, maximum intel.'),
    },
    {
      icon: '🔒',
      title: t('battleRegistryLanding.featAccess', 'Kingdom-Scoped Security'),
      desc: t('battleRegistryLanding.featAccessDesc', 'Only your kingdom\'s players can register. Editors, Co-Editors, and Battle Managers control the registry. Your data stays yours.'),
    },
  ];

  const steps = [
    {
      num: '1',
      icon: '⚔️',
      title: t('battleRegistryLanding.step1', 'Create a Registry'),
      desc: t('battleRegistryLanding.step1Desc', 'Editors or Battle Managers create a registry for the upcoming KvK Castle Battle.'),
    },
    {
      num: '2',
      icon: '📝',
      title: t('battleRegistryLanding.step2', 'Players Register'),
      desc: t('battleRegistryLanding.step2Desc', 'Share the link. Players fill out their time slot, troop tiers, and truegold levels in 30 seconds.'),
    },
    {
      num: '3',
      icon: '📊',
      title: t('battleRegistryLanding.step3', 'Plan the Battle'),
      desc: t('battleRegistryLanding.step3Desc', 'Use the dashboard to see who\'s available, what they\'re bringing, and plan your castle hit accordingly.'),
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
            borderRadius: '50%', backgroundColor: '#ef444415',
            border: '2px solid #ef444430',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.25rem',
            boxShadow: '0 0 30px rgba(239, 68, 68, 0.15), 0 0 60px rgba(239, 68, 68, 0.08)',
          }}>
            <span style={{ fontSize: isMobile ? '1.75rem' : '2.25rem' }}>⚔️</span>
          </div>

          <h1 style={{
            fontSize: isMobile ? '1.75rem' : '2.5rem', fontWeight: 'bold',
            marginBottom: '0.75rem', fontFamily: FONT_DISPLAY,
          }}>
            <span style={{ color: '#fff' }}>{t('battleRegistryLanding.heroTitle1', 'KvK BATTLE')}</span>
            <span style={{ ...neonGlow('#ef4444'), marginLeft: '0.5rem' }}>{t('battleRegistryLanding.heroTitle2', 'REGISTRY')}</span>
          </h1>
          <p style={{
            color: '#9ca3af', fontSize: isMobile ? '0.95rem' : '1.1rem',
            maxWidth: '520px', margin: '0 auto 1.5rem', lineHeight: 1.6,
          }}>
            {t('battleRegistryLanding.heroSubtitle', 'The difference between winning a castle battle and losing one? Knowing exactly who\'s showing up — and what they\'re bringing.')}
          </p>

          {/* CTA */}
          <div style={{
            display: 'flex', flexDirection: isMobile ? 'column' : 'row',
            gap: '0.75rem', justifyContent: 'center', alignItems: 'center',
          }}>
            <Link
              to="/tools/battle-registry"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
                padding: isMobile ? '0.85rem 1.75rem' : '0.9rem 2rem',
                backgroundColor: '#ef4444', border: 'none', borderRadius: '10px',
                color: '#fff', fontWeight: 700,
                fontSize: isMobile ? '0.95rem' : '1rem', textDecoration: 'none',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 20px rgba(239, 68, 68, 0.35)',
              }}
            >
              ⚔️ {t('battleRegistryLanding.openRegistry', 'Open the Registry')}
            </Link>
            {!hasFullAccess && (
              <Link
                to="/transfer-hub"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.75rem 1.5rem', backgroundColor: 'transparent',
                  border: '1px solid #ffc30b40', borderRadius: '8px',
                  color: '#ffc30b', fontWeight: 600,
                  fontSize: isMobile ? '0.9rem' : '0.95rem', textDecoration: 'none',
                }}
              >
                {t('battleRegistryLanding.getGoldAccess', 'How to Reach Gold Tier')}
              </Link>
            )}
          </div>
          <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.75rem' }}>
            {hasFullAccess
              ? t('battleRegistryLanding.accessConfirm', 'You have full access as a Gold Tier kingdom member.')
              : t('battleRegistryLanding.goldPerk', 'Available for Gold Tier kingdoms. Contribute to the Kingdom Fund to unlock.')}
          </p>

          {!isMobile && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
              <div style={{ width: '50px', height: '2px', background: 'linear-gradient(90deg, transparent, #ef4444)' }} />
              <div style={{ width: '6px', height: '6px', backgroundColor: '#ef4444', transform: 'rotate(45deg)', boxShadow: '0 0 8px #ef4444' }} />
              <div style={{ width: '50px', height: '2px', background: 'linear-gradient(90deg, #ef4444, transparent)' }} />
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
            <span style={{ color: '#fff' }}>{t('battleRegistryLanding.howItWorks1', 'HOW IT')}</span>
            <span style={{ ...neonGlow('#ef4444'), marginLeft: '0.4rem' }}>{t('battleRegistryLanding.howItWorks2', 'WORKS')}</span>
          </h2>
          <p style={{
            color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.85rem',
            textAlign: 'center', marginBottom: '1.5rem',
          }}>
            {t('battleRegistryLanding.threeSteps', 'Three steps. Total battlefield awareness.')}
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
                  backgroundColor: '#ef444415', border: '1px solid #ef444430',
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
            <span style={{ color: '#fff' }}>{t('battleRegistryLanding.builtFor1', 'BUILT FOR')}</span>
            <span style={{ ...neonGlow('#ef4444'), marginLeft: '0.4rem' }}>{t('battleRegistryLanding.builtFor2', 'KINGDOM LEADERS')}</span>
          </h2>
          <p style={{
            color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.85rem',
            textAlign: 'center', marginBottom: '1.5rem',
          }}>
            {t('battleRegistryLanding.featuresSubtitle', 'Every feature exists because R4s and R5s asked for it.')}
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
          border: '1px solid #ef444430', padding: isMobile ? '1.25rem' : '1.75rem',
          background: 'linear-gradient(135deg, #111111 0%, #ef444408 100%)',
        }}>
          <h2 style={{
            fontSize: isMobile ? '1.05rem' : '1.2rem', fontWeight: 'bold', color: '#fff',
            marginBottom: '1rem', fontFamily: FONT_DISPLAY,
          }}>
            {t('battleRegistryLanding.problemTitle', '"How many people do we have for castle?" — Every R5, every KvK.')}
          </h2>
          <p style={{ color: '#d1d5db', fontSize: isMobile ? '0.85rem' : '0.9rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            {t('battleRegistryLanding.problemDesc', 'You post in kingdom chat. Half the alliances don\'t reply. You get a rough count an hour before the battle. Some people show up with T5 infantry when you needed T11 cavalry. The castle falls because you didn\'t know what you had.')}
          </p>
          <p style={{ color: '#d1d5db', fontSize: isMobile ? '0.85rem' : '0.9rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            {t('battleRegistryLanding.solutionDesc', 'The Battle Registry collects every player\'s availability and troop levels in one place. You see exactly who can be online at 14:00 UTC, how many T11 cavalry your kingdom has, and which alliances are pulling their weight. Plan the battle with data — not hope.')}
          </p>
          <p style={{ color: '#ef4444', fontSize: isMobile ? '0.8rem' : '0.85rem', fontWeight: 600, fontStyle: 'italic' }}>
            {t('battleRegistryLanding.punchline', 'Information wins wars. Guessing loses them.')}
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
              ? t('battleRegistryLanding.accessUnlocked', 'Access Unlocked')
              : t('battleRegistryLanding.goldBadge', 'Gold Tier Kingdom Feature')}
          </span>
          <h3 style={{
            fontSize: isMobile ? '1.1rem' : '1.25rem', fontWeight: 'bold',
            color: '#fff', marginBottom: '0.5rem', fontFamily: FONT_DISPLAY,
          }}>
            {hasFullAccess
              ? t('battleRegistryLanding.accessThanks', 'You have full access to the Battle Registry.')
              : t('battleRegistryLanding.goldTitle', 'Give your kingdom the intel advantage.')}
          </h3>
          <p style={{
            color: '#9ca3af', fontSize: isMobile ? '0.8rem' : '0.85rem',
            marginBottom: '1.25rem', maxWidth: '450px', margin: '0 auto 1.25rem', lineHeight: 1.6,
          }}>
            {hasFullAccess
              ? t('battleRegistryLanding.accessThanksDesc', 'Your kingdom has earned access. Create a registry and start collecting player intel for your next castle battle.')
              : t('battleRegistryLanding.goldDesc', 'The Battle Registry is a Gold Tier feature. Help your kingdom reach Gold by contributing to the Kingdom Fund.')}
          </p>
          <div style={{
            display: 'flex', flexDirection: isMobile ? 'column' : 'row',
            gap: '0.75rem', justifyContent: 'center', alignItems: 'center',
          }}>
            {hasFullAccess ? (
              <Link
                to="/tools/battle-registry"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.75rem 1.5rem', backgroundColor: '#22c55e',
                  border: 'none', borderRadius: '8px', color: '#fff',
                  fontWeight: 600, fontSize: isMobile ? '0.9rem' : '0.95rem',
                  textDecoration: 'none', transition: 'all 0.2s ease',
                  boxShadow: '0 4px 15px rgba(34, 197, 94, 0.3)',
                }}
              >
                ⚔️ {t('battleRegistryLanding.openRegistry', 'Open the Registry')}
              </Link>
            ) : (
              <>
                <Link
                  to="/transfer-hub"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.75rem 1.5rem', backgroundColor: '#ffc30b',
                    border: 'none', borderRadius: '8px', color: '#0a0a0a',
                    fontWeight: 600, fontSize: isMobile ? '0.9rem' : '0.95rem',
                    textDecoration: 'none', transition: 'all 0.2s ease',
                    boxShadow: '0 4px 15px rgba(255, 195, 11, 0.3)',
                  }}
                >
                  {t('battleRegistryLanding.reachGold', 'Reach Gold Tier')}
                </Link>
                <Link
                  to="/tools/battle-registry"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.75rem 1.5rem', backgroundColor: 'transparent',
                    border: '1px solid #ef444440', borderRadius: '8px',
                    color: '#ef4444', fontWeight: 600,
                    fontSize: isMobile ? '0.9rem' : '0.95rem', textDecoration: 'none',
                  }}
                >
                  {t('battleRegistryLanding.tryRegistry', 'View the Registry')}
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Back links */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', paddingBottom: '1rem' }}>
          <Link to="/tools" style={{ color: '#22d3ee', textDecoration: 'none', fontSize: '0.8rem' }}>
            {t('battleRegistryLanding.allTools', '← All Tools')}
          </Link>
          <Link to="/" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '0.8rem' }}>
            {t('common.backToHome', '← Back to Home')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default BattleRegistryLanding;
