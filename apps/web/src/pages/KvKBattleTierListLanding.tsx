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
import { supabase } from '../lib/supabase';

const KvKBattleTierListLanding: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('battleTierLanding.pageTitle', 'KvK Battle Tier List'));
  useMetaTags(PAGE_META_TAGS.battleTierList || {
    title: 'KvK Battle Tier List — Rank Your Kingdom for Castle Battle | Kingshot Atlas',
    description: 'Rank your kingdom\'s players by offensive and defensive power for KvK Castle Battles. Scout-based stats, EG adjustments, smart tier classification.',
  });
  const isMobile = useIsMobile();
  const { isAdmin } = usePremium();
  const { profile, user } = useAuth();
  const goldKingdoms = useGoldKingdoms();
  const isGoldKingdom = !!(profile?.linked_kingdom && goldKingdoms.has(profile.linked_kingdom));
  const { hasGrant: hasToolGrant } = useAdminToolGrant('battle_tier_list');
  const [isEditorOrCoEditor, setIsEditorOrCoEditor] = useState(false);
  const hasFullAccess = isGoldKingdom || isAdmin || isEditorOrCoEditor || hasToolGrant;

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
      icon: '⚔️',
      title: t('battleTierLanding.featOffense', 'Offensive Tier List'),
      desc: t('battleTierLanding.featOffenseDesc', 'See who hits the hardest in your kingdom. Defensive EG bonuses are stripped from scouted stats, offensive bonuses applied — revealing true rally power.'),
    },
    {
      icon: '🛡️',
      title: t('battleTierLanding.featDefense', 'Defensive Tier List'),
      desc: t('battleTierLanding.featDefenseDesc', 'Know who holds the line. The scout report shows exact defensive stats — no adjustments needed. Rank your kingdom\'s defenders by raw defensive strength.'),
    },
    {
      icon: '📊',
      title: t('battleTierLanding.featAllStats', 'All Troop Stats'),
      desc: t('battleTierLanding.featAllStatsDesc', 'Attack, Lethality, Defense, and Health — all four stats across Infantry, Cavalry, and Archers. The complete picture of every player\'s combat power.'),
    },
    {
      icon: '⚙️',
      title: t('battleTierLanding.featEG', 'Exclusive Gear Adjustment'),
      desc: t('battleTierLanding.featEGDesc', 'Atlas knows which heroes have offensive vs defensive EG. Scouted values are automatically corrected so you see real rally numbers, not inflated ones.'),
    },
    {
      icon: '🏅',
      title: t('battleTierLanding.featTiers', 'Smart Tier Classification'),
      desc: t('battleTierLanding.featTiersDesc', 'Players are sorted into tiers SS through D using natural-breaks scoring. Separate tiers for offense and defense — because your best attacker might not be your best defender.'),
    },
    {
      icon: '🔒',
      title: t('battleTierLanding.featAccess', 'Kingdom-Wide Access'),
      desc: t('battleTierLanding.featAccessDesc', 'Everyone in your kingdom can view the tier list. Editors, Co-Editors, and designated Battle Managers can add and edit data. Your intel stays organized.'),
    },
  ];

  const steps = [
    {
      num: '1',
      icon: '🔍',
      title: t('battleTierLanding.step1', 'Scout Your Players'),
      desc: t('battleTierLanding.step1Desc', 'Have players set their KvK lineup in the Guard Station. Scout them to get Attack, Lethality, Defense, and Health for all three troop types.'),
    },
    {
      num: '2',
      icon: '📝',
      title: t('battleTierLanding.step2', 'Input the Stats'),
      desc: t('battleTierLanding.step2Desc', 'Select each hero and EG level, then enter all 12 stat values from the scout report. Atlas handles the offensive adjustments automatically.'),
    },
    {
      num: '3',
      icon: '🏆',
      title: t('battleTierLanding.step3', 'See the Tier Lists'),
      desc: t('battleTierLanding.step3Desc', 'Get two separate rankings: Offense Score for rally calls, Defense Score for garrison decisions. Know exactly who to put where in Castle Battle.'),
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
            <span style={{ fontSize: isMobile ? '1.75rem' : '2.25rem' }}>🏰</span>
          </div>

          <h1 style={{
            fontSize: isMobile ? '1.75rem' : '2.5rem', fontWeight: 'bold',
            marginBottom: '0.75rem', fontFamily: FONT_DISPLAY,
          }}>
            <span style={{ color: '#fff' }}>{t('battleTierLanding.heroTitle1', 'KvK BATTLE')}</span>
            <span style={{ ...neonGlow('#f97316'), marginLeft: '0.5rem' }}>{t('battleTierLanding.heroTitle2', 'TIER LIST')}</span>
          </h1>
          <p style={{
            color: '#9ca3af', fontSize: isMobile ? '0.95rem' : '1.1rem',
            maxWidth: '520px', margin: '0 auto 1.5rem', lineHeight: 1.6,
          }}>
            {t('battleTierLanding.heroSubtitle', 'Stop guessing who your best attackers and defenders are. Scout them, rank them, and dominate Castle Battle with real data.')}
          </p>

          {/* CTA */}
          <div style={{
            display: 'flex', flexDirection: isMobile ? 'column' : 'row',
            gap: '0.75rem', justifyContent: 'center', alignItems: 'center',
          }}>
            <Link
              to="/tools/battle-tier-list"
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
              🏰 {t('battleTierLanding.launchTool', 'Launch Tier List')}
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
                {t('battleTierLanding.fundYourKingdom', 'Fund Your Kingdom')}
              </Link>
            )}
          </div>
          <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.75rem' }}>
            {hasFullAccess
              ? t('battleTierLanding.accessConfirm', 'You have full access as a Gold Tier kingdom member.')
              : t('battleTierLanding.goldPerk', 'Available for Gold Tier kingdoms. Contribute to the Kingdom Fund to unlock.')}
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
            <span style={{ color: '#fff' }}>{t('battleTierLanding.howItWorks1', 'HOW IT')}</span>
            <span style={{ ...neonGlow('#f97316'), marginLeft: '0.4rem' }}>{t('battleTierLanding.howItWorks2', 'WORKS')}</span>
          </h2>
          <p style={{
            color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.85rem',
            textAlign: 'center', marginBottom: '1.5rem',
          }}>
            {t('battleTierLanding.threeSteps', 'Three steps. Total combat clarity.')}
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
            <span style={{ color: '#fff' }}>{t('battleTierLanding.builtFor1', 'BUILT FOR')}</span>
            <span style={{ ...neonGlow('#f97316'), marginLeft: '0.4rem' }}>{t('battleTierLanding.builtFor2', 'BATTLE COMMANDERS')}</span>
          </h2>
          <p style={{
            color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.85rem',
            textAlign: 'center', marginBottom: '1.5rem',
          }}>
            {t('battleTierLanding.featuresSubtitle', 'Every feature exists because castle battle leaders needed it.')}
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
            {t('battleTierLanding.problemTitle', 'The Castle Battle Problem')}
          </h2>
          <p style={{ color: '#d1d5db', fontSize: isMobile ? '0.85rem' : '0.9rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            {t('battleTierLanding.problemDesc', '"Who should we rally with?" — asked 5 minutes before the castle hit. "Is Player X stronger than Player Y?" — nobody knows for sure. "Who should garrison and who should rally?" — just vibes, no data.')}
          </p>
          <p style={{ color: '#d1d5db', fontSize: isMobile ? '0.85rem' : '0.9rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            {t('battleTierLanding.solutionDesc', 'The KvK Battle Tier List gives you two clear rankings: who hits hardest (offense) and who holds strongest (defense). Real numbers from real scout reports, with EG adjustments baked in. Know exactly who to put where in Castle Battle.')}
          </p>
          <p style={{ color: '#f97316', fontSize: isMobile ? '0.8rem' : '0.85rem', fontWeight: 600, fontStyle: 'italic' }}>
            {t('battleTierLanding.punchline', 'Data wins castles. Guessing loses them.')}
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
              ? t('battleTierLanding.accessUnlocked', 'Access Unlocked')
              : t('battleTierLanding.goldBadge', 'Gold Tier Kingdom Feature')}
          </span>
          <h3 style={{
            fontSize: isMobile ? '1.1rem' : '1.25rem', fontWeight: 'bold',
            color: '#fff', marginBottom: '0.5rem', fontFamily: FONT_DISPLAY,
          }}>
            {hasFullAccess
              ? t('battleTierLanding.accessThanks', 'You have full access to the Battle Tier List.')
              : t('battleTierLanding.goldTitle', 'Give your kingdom the power ranking advantage.')}
          </h3>
          <p style={{
            color: '#9ca3af', fontSize: isMobile ? '0.8rem' : '0.85rem',
            marginBottom: '1.25rem', maxWidth: '450px', margin: '0 auto 1.25rem', lineHeight: 1.6,
          }}>
            {hasFullAccess
              ? t('battleTierLanding.accessThanksDesc', 'Your kingdom has earned access. Start scouting and ranking your players for the next castle battle.')
              : t('battleTierLanding.goldDesc', 'The Battle Tier List is a Gold Tier feature. Help your kingdom reach Gold by contributing to the Kingdom Fund.')}
          </p>
          <div style={{
            display: 'flex', flexDirection: isMobile ? 'column' : 'row',
            gap: '0.75rem', justifyContent: 'center', alignItems: 'center',
          }}>
            {hasFullAccess ? (
              <Link
                to="/tools/battle-tier-list"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.75rem 1.5rem', backgroundColor: '#22c55e',
                  border: 'none', borderRadius: '8px', color: '#fff',
                  fontWeight: 600, fontSize: isMobile ? '0.9rem' : '0.95rem',
                  textDecoration: 'none', transition: 'all 0.2s ease',
                  boxShadow: '0 4px 15px rgba(34, 197, 94, 0.3)',
                }}
              >
                🏰 {t('battleTierLanding.launchTool', 'Launch Tier List')}
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
                  {t('battleTierLanding.fundYourKingdom', 'Fund Your Kingdom')}
                </Link>
                <Link
                  to="/tools/battle-tier-list"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.75rem 1.5rem', backgroundColor: 'transparent',
                    border: '1px solid #f9731640', borderRadius: '8px',
                    color: '#f97316', fontWeight: 600,
                    fontSize: isMobile ? '0.9rem' : '0.95rem', textDecoration: 'none',
                  }}
                >
                  {t('battleTierLanding.tryTierList', 'View the Tier List')}
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

export default KvKBattleTierListLanding;
