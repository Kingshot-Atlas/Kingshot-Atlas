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


const BattlePlannerLanding: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('battlePlanner.pageTitle', 'KvK Battle Planner'));
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
      icon: '🎯',
      title: t('battlePlanner.featSync', 'Synchronized Strikes'),
      desc: t('battlePlanner.featSyncDesc', 'Calculate exact call delays so every rally lands on the same building within seconds of each other. No more counting on your fingers.'),
    },
    {
      icon: '⚡',
      title: t('battlePlanner.featBuff', 'Buff Timer Intelligence'),
      desc: t('battlePlanner.featBuffDesc', 'Track active speed buffs per player with live countdown timers. The planner auto-switches between regular and buffed march times.'),
    },
    {
      icon: '🔄',
      title: t('battlePlanner.featEstimate', 'March Time Estimator'),
      desc: t('battlePlanner.featEstimateDesc', 'Only know one march time? Enter regular or buffed — the planner estimates the other using the ×1.55 ratio. No spreadsheets needed.'),
    },
    {
      icon: '🛡️',
      title: t('battlePlanner.featCounter', 'Counter-Rally Planning'),
      desc: t('battlePlanner.featCounterDesc', 'Plan offensive and defensive rallies simultaneously. Run two independent queues with different timing strategies.'),
    },
    {
      icon: '💾',
      title: t('battlePlanner.featPresets', 'Player Presets'),
      desc: t('battlePlanner.featPresetsDesc', 'Save your entire roster — allies and enemies — with their march times. Load them instantly for the next battle. Zero repeated setup.'),
    },
    {
      icon: '📋',
      title: t('battlePlanner.featCopy', 'One-Click Call Orders'),
      desc: t('battlePlanner.featCopyDesc', 'Generate the exact call order and copy it to clipboard. Paste it in your alliance chat. Everyone knows when to march.'),
    },
  ];

  const steps = [
    {
      num: '1',
      icon: '👥',
      title: t('battlePlanner.step1', 'Add Your Players'),
      desc: t('battlePlanner.step1Desc', 'Enter each rally caller with their march times to the target building.'),
    },
    {
      num: '2',
      icon: '🏰',
      title: t('battlePlanner.step2', 'Pick Your Target'),
      desc: t('battlePlanner.step2Desc', "Select King's Castle or any of the 4 Turrets. Choose simultaneous or staggered hits."),
    },
    {
      num: '3',
      icon: '📢',
      title: t('battlePlanner.step3', 'Get the Call Order'),
      desc: t('battlePlanner.step3Desc', 'The planner calculates exact delays. Copy the call order and share it with your alliance.'),
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
            <span style={{ color: '#fff' }}>{t('battlePlanner.heroTitle1', 'KvK BATTLE')}</span>
            <span style={{ ...neonGlow('#ef4444'), marginLeft: '0.5rem' }}>{t('battlePlanner.heroTitle2', 'PLANNER')}</span>
          </h1>
          <p style={{
            color: '#9ca3af', fontSize: isMobile ? '0.95rem' : '1.1rem',
            maxWidth: '520px', margin: '0 auto 1.5rem', lineHeight: 1.6,
          }}>
            {t('battlePlanner.heroSubtitle', 'The difference between a coordinated castle hit and wasted marches is timing. Get it right — every time.')}
          </p>

          {/* CTA */}
          <div style={{
            display: 'flex', flexDirection: isMobile ? 'column' : 'row',
            gap: '0.75rem', justifyContent: 'center', alignItems: 'center',
          }}>
            <Link
              to="/tools/kvk-battle-planner"
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
              ⚔️ {t('battlePlanner.launchPlanner', 'Launch the Planner')}
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
                {t('battlePlanner.getGoldAccess', 'How to Reach Gold Tier')}
              </Link>
            )}
          </div>
          <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.75rem' }}>
            {hasFullAccess
              ? t('battlePlanner.goldConfirm', 'You have full access as a Gold Tier kingdom member.')
              : t('battlePlanner.goldPerk', 'Available for Gold Tier kingdoms. Contribute to the Kingdom Fund to unlock.')}
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
            <span style={{ color: '#fff' }}>{t('battlePlanner.howItWorks1', 'HOW IT')}</span>
            <span style={{ ...neonGlow('#ef4444'), marginLeft: '0.4rem' }}>{t('battlePlanner.howItWorks2', 'WORKS')}</span>
          </h2>
          <p style={{
            color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.85rem',
            textAlign: 'center', marginBottom: '1.5rem',
          }}>
            {t('battlePlanner.threeSteps', 'Three steps. One devastating strike.')}
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
            <span style={{ color: '#fff' }}>{t('battlePlanner.builtFor1', 'BUILT FOR')}</span>
            <span style={{ ...neonGlow('#ef4444'), marginLeft: '0.4rem' }}>{t('battlePlanner.builtFor2', 'RALLY CALLERS')}</span>
          </h2>
          <p style={{
            color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.85rem',
            textAlign: 'center', marginBottom: '1.5rem',
          }}>
            {t('battlePlanner.featuresSubtitle', 'Every feature exists because rally callers asked for it.')}
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
            {t('battlePlanner.problemTitle', 'The castle is burning. Your rallies land 30 seconds apart.')}
          </h2>
          <p style={{ color: '#d1d5db', fontSize: isMobile ? '0.85rem' : '0.9rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            {t('battlePlanner.problemDesc', "You've got 5 rally callers. Different march times. Someone calls too early, someone too late. The enemy reinforces between hits. Sound familiar?")}
          </p>
          <p style={{ color: '#d1d5db', fontSize: isMobile ? '0.85rem' : '0.9rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            {t('battlePlanner.solutionDesc', "The Battle Planner accounts for the 5-minute rally fill time plus each player's individual march time, then tells you exactly who calls first and the precise delay between each call. Your rallies connect within a 1-second window. The enemy can't reinforce fast enough.")}
          </p>
          <p style={{ color: '#ef4444', fontSize: isMobile ? '0.8rem' : '0.85rem', fontWeight: 600, fontStyle: 'italic' }}>
            {t('battlePlanner.punchline', "That's not coordination. That's domination.")}
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
              ? t('battlePlanner.accessUnlocked', 'Access Unlocked')
              : t('battlePlanner.goldBadge', 'Gold Tier Kingdom Feature')}
          </span>
          <h3 style={{
            fontSize: isMobile ? '1.1rem' : '1.25rem', fontWeight: 'bold',
            color: '#fff', marginBottom: '0.5rem', fontFamily: FONT_DISPLAY,
          }}>
            {hasFullAccess
              ? t('battlePlanner.goldThanks', 'You have full access to the Battle Planner.')
              : t('battlePlanner.goldTitle', 'Your alliance deserves better coordination.')}
          </h3>
          <p style={{
            color: '#9ca3af', fontSize: isMobile ? '0.8rem' : '0.85rem',
            marginBottom: '1.25rem', maxWidth: '450px', margin: '0 auto 1.25rem', lineHeight: 1.6,
          }}>
            {hasFullAccess
              ? t('battlePlanner.goldThanksDesc', 'Your kingdom has earned Gold Tier status. Jump straight into the planner and coordinate your next castle hit.')
              : t('battlePlanner.goldDesc', 'The Battle Planner is available for Gold Tier kingdoms. Help your kingdom reach Gold by contributing to the Kingdom Fund on the Transfer Hub.')}
          </p>
          <div style={{
            display: 'flex', flexDirection: isMobile ? 'column' : 'row',
            gap: '0.75rem', justifyContent: 'center', alignItems: 'center',
          }}>
            {hasFullAccess ? (
              <Link
                to="/tools/kvk-battle-planner"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.75rem 1.5rem', backgroundColor: '#22c55e',
                  border: 'none', borderRadius: '8px', color: '#fff',
                  fontWeight: 600, fontSize: isMobile ? '0.9rem' : '0.95rem',
                  textDecoration: 'none', transition: 'all 0.2s ease',
                  boxShadow: '0 4px 15px rgba(34, 197, 94, 0.3)',
                }}
              >
                ⚔️ {t('battlePlanner.launchPlanner', 'Launch the Planner')}
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
                  {t('battlePlanner.reachGold', 'Reach Gold Tier')}
                </Link>
                <Link
                  to="/tools/kvk-battle-planner"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.75rem 1.5rem', backgroundColor: 'transparent',
                    border: '1px solid #ef444440', borderRadius: '8px',
                    color: '#ef4444', fontWeight: 600,
                    fontSize: isMobile ? '0.9rem' : '0.95rem', textDecoration: 'none',
                  }}
                >
                  {t('battlePlanner.tryPlanner', 'Try the Planner')}
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Community credit */}
        <div style={{
          textAlign: 'center', padding: '1rem 0', marginBottom: isMobile ? '1rem' : '1.5rem',
        }}>
          <p style={{ color: '#4b5563', fontSize: '0.75rem', letterSpacing: '0.03em', lineHeight: 1.6 }}>
            ⚔️ {t('battlePlanner.communityCredit', 'Huge shoutout to')} <Link
              to="/profile/57d266cf-9800-4a7d-a8a5-f2cbc616bc22"
              style={{ color: '#22d3ee', textDecoration: 'none', fontWeight: 600, fontFamily: FONT_DISPLAY }}
            >bAdClimber</Link> {t('battlePlanner.communityCreditSuffix', 'for rallying this idea into existence. Built by the community, for the community.')}
          </p>
        </div>

        {/* Back links */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', paddingBottom: '1rem' }}>
          <Link to="/tools" style={{ color: '#22d3ee', textDecoration: 'none', fontSize: '0.8rem' }}>
            {t('battlePlanner.allTools', '← All Tools')}
          </Link>
          <Link to="/" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '0.8rem' }}>
            {t('common.backToHome', '← Back to Home')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default BattlePlannerLanding;
