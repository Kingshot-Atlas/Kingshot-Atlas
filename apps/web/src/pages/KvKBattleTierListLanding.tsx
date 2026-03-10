import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useMetaTags } from '../hooks/useMetaTags';
import { neonGlow, FONT_DISPLAY } from '../utils/styles';
import { usePremium } from '../contexts/PremiumContext';
import { useAuth } from '../contexts/AuthContext';
import { useGoldKingdoms } from '../hooks/useGoldKingdoms';
import { supabase } from '../lib/supabase';

const ACCENT = '#f97316';

const KvKBattleTierListLanding: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('battleTierLanding.pageTitle', 'KvK Battle Tier List'));
  useMetaTags({
    title: 'KvK Battle Tier List — Rank Your Kingdom for Castle Battle | Kingshot Atlas',
    description: 'Rank your kingdom\'s players by offensive and defensive power for KvK Castle Battles. Scout-based stats, EG adjustments, smart tier classification.',
  });
  const isMobile = useIsMobile();
  const { isAdmin } = usePremium();
  const { profile, user } = useAuth();
  const goldKingdoms = useGoldKingdoms();
  const isGoldKingdom = !!(profile?.linked_kingdom && goldKingdoms.has(profile.linked_kingdom));
  const [isEditorOrCoEditor, setIsEditorOrCoEditor] = useState(false);
  const hasFullAccess = isGoldKingdom || isAdmin || isEditorOrCoEditor;

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
            borderRadius: '50%', backgroundColor: `${ACCENT}15`,
            border: `2px solid ${ACCENT}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.25rem',
            boxShadow: `0 0 30px ${ACCENT}15, 0 0 60px ${ACCENT}08`,
          }}>
            <span style={{ fontSize: isMobile ? '1.75rem' : '2.25rem' }}>🏰</span>
          </div>

          <h1 style={{
            fontSize: isMobile ? '1.75rem' : '2.5rem', fontWeight: 'bold',
            marginBottom: '0.75rem', fontFamily: FONT_DISPLAY,
          }}>
            <span style={{ color: '#fff' }}>{t('battleTierLanding.heroTitle1', 'KvK BATTLE')}</span>
            <span style={{ ...neonGlow(ACCENT), marginLeft: '0.5rem' }}>{t('battleTierLanding.heroTitle2', 'TIER LIST')}</span>
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
            {hasFullAccess ? (
              <Link
                to="/tools/battle-tier-list"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
                  padding: isMobile ? '0.85rem 1.75rem' : '0.9rem 2rem',
                  backgroundColor: ACCENT, border: 'none', borderRadius: '10px',
                  color: '#fff', fontWeight: 700,
                  fontSize: isMobile ? '0.95rem' : '1rem', textDecoration: 'none',
                  transition: 'all 0.2s ease',
                  boxShadow: `0 4px 20px ${ACCENT}35`,
                }}
              >
                🏰 {t('battleTierLanding.launchTool', 'Launch Tier List')}
              </Link>
            ) : (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
                padding: isMobile ? '0.85rem 1.75rem' : '0.9rem 2rem',
                backgroundColor: '#333', borderRadius: '10px',
                color: '#9ca3af', fontWeight: 700,
                fontSize: isMobile ? '0.95rem' : '1rem',
              }}>
                🔒 {t('battleTierLanding.goldOnly', 'Gold Tier Kingdoms Only')}
              </div>
            )}
            <Link
              to="/tools"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: isMobile ? '0.75rem 1.5rem' : '0.8rem 1.75rem',
                backgroundColor: 'transparent',
                border: '1px solid #333', borderRadius: '10px',
                color: '#9ca3af', fontWeight: 600,
                fontSize: isMobile ? '0.85rem' : '0.9rem', textDecoration: 'none',
              }}
            >
              ← {t('common.backToTools', 'All Tools')}
            </Link>
          </div>
          <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.75rem' }}>
            {t('battleTierLanding.goldNote', 'Available for Gold Tier Kingdom Fund kingdoms.')}
          </p>
        </div>
      </div>

      {/* Problem / Solution */}
      <div style={{
        maxWidth: '700px', margin: '0 auto',
        padding: isMobile ? '1.5rem 1rem' : '2rem 2rem',
      }}>
        <div style={{
          backgroundColor: '#111', borderRadius: '16px', border: '1px solid #2a2a2a',
          padding: isMobile ? '1.25rem' : '1.75rem',
        }}>
          <h2 style={{
            fontSize: isMobile ? '1.1rem' : '1.3rem', fontWeight: 700,
            color: '#fff', marginBottom: '1rem', fontFamily: FONT_DISPLAY,
          }}>
            {t('battleTierLanding.problemTitle', 'The Castle Battle Problem')}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <p style={{ color: '#ef4444', fontSize: isMobile ? '0.82rem' : '0.88rem', lineHeight: 1.6, margin: 0 }}>
              ❌ {t('battleTierLanding.problem1', '"Who should we rally with?" — asked 5 minutes before the castle hit.')}
            </p>
            <p style={{ color: '#ef4444', fontSize: isMobile ? '0.82rem' : '0.88rem', lineHeight: 1.6, margin: 0 }}>
              ❌ {t('battleTierLanding.problem2', '"Is Player X stronger than Player Y?" — nobody knows for sure.')}
            </p>
            <p style={{ color: '#ef4444', fontSize: isMobile ? '0.82rem' : '0.88rem', lineHeight: 1.6, margin: 0 }}>
              ❌ {t('battleTierLanding.problem3', '"Who should garrison and who should rally?" — just vibes, no data.')}
            </p>
            <div style={{ height: '1px', backgroundColor: '#2a2a2a', margin: '0.5rem 0' }} />
            <p style={{ color: '#22c55e', fontSize: isMobile ? '0.82rem' : '0.88rem', lineHeight: 1.6, margin: 0 }}>
              ✅ {t('battleTierLanding.solution', 'The KvK Battle Tier List gives you two clear rankings: who hits hardest (offense) and who holds strongest (defense). Real numbers. No guesswork.')}
            </p>
          </div>
        </div>
      </div>

      {/* Features */}
      <div style={{
        maxWidth: '900px', margin: '0 auto',
        padding: isMobile ? '0 1rem 1.5rem' : '0 2rem 2rem',
      }}>
        <h2 style={{
          textAlign: 'center', fontSize: isMobile ? '1.25rem' : '1.5rem',
          fontWeight: 700, color: '#fff', marginBottom: '1.5rem', fontFamily: FONT_DISPLAY,
        }}>
          {t('battleTierLanding.featuresTitle', 'What You Get')}
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
          gap: isMobile ? '0.75rem' : '1rem',
        }}>
          {features.map((f, i) => (
            <div key={i} style={{
              backgroundColor: '#111', borderRadius: '12px', border: '1px solid #1a1a1a',
              padding: isMobile ? '1rem' : '1.25rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.1rem' }}>{f.icon}</span>
                <h3 style={{ fontSize: isMobile ? '0.9rem' : '0.95rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                  {f.title}
                </h3>
              </div>
              <p style={{ fontSize: isMobile ? '0.78rem' : '0.82rem', color: '#9ca3af', lineHeight: 1.6, margin: 0 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Steps */}
      <div style={{
        maxWidth: '700px', margin: '0 auto',
        padding: isMobile ? '0 1rem 2rem' : '0 2rem 3rem',
      }}>
        <h2 style={{
          textAlign: 'center', fontSize: isMobile ? '1.25rem' : '1.5rem',
          fontWeight: 700, color: '#fff', marginBottom: '1.5rem', fontFamily: FONT_DISPLAY,
        }}>
          {t('battleTierLanding.howTitle', 'How It Works')}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {steps.map((s, i) => (
            <div key={i} style={{
              display: 'flex', gap: '1rem', alignItems: 'flex-start',
              backgroundColor: '#111', borderRadius: '12px', border: '1px solid #1a1a1a',
              padding: isMobile ? '1rem' : '1.25rem',
            }}>
              <div style={{
                minWidth: '40px', height: '40px', borderRadius: '50%',
                backgroundColor: `${ACCENT}15`, border: `1px solid ${ACCENT}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.1rem',
              }}>
                {s.icon}
              </div>
              <div>
                <h3 style={{ fontSize: isMobile ? '0.9rem' : '0.95rem', fontWeight: 700, color: '#fff', margin: '0 0 0.25rem' }}>
                  <span style={{ color: ACCENT, marginRight: '0.35rem' }}>{s.num}.</span>{s.title}
                </h3>
                <p style={{ fontSize: isMobile ? '0.78rem' : '0.82rem', color: '#9ca3af', lineHeight: 1.6, margin: 0 }}>
                  {s.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div style={{
        maxWidth: '700px', margin: '0 auto',
        padding: isMobile ? '0 1rem 3rem' : '0 2rem 4rem',
        textAlign: 'center',
      }}>
        {hasFullAccess ? (
          <Link
            to="/tools/battle-tier-list"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
              padding: isMobile ? '0.85rem 2rem' : '0.9rem 2.5rem',
              backgroundColor: ACCENT, border: 'none', borderRadius: '10px',
              color: '#fff', fontWeight: 700,
              fontSize: isMobile ? '0.95rem' : '1rem', textDecoration: 'none',
              boxShadow: `0 4px 20px ${ACCENT}35`,
            }}
          >
            🏰 {t('battleTierLanding.launchTool', 'Launch Tier List')}
          </Link>
        ) : (
          <div>
            <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
              {t('battleTierLanding.goldExplain', 'This tool is available to kingdoms that have reached Gold Tier in the Kingdom Fund.')}
            </p>
            <Link
              to="/transfer-hub"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.7rem 1.5rem',
                backgroundColor: '#ffc30b15', border: '1px solid #ffc30b30',
                borderRadius: '10px', color: '#ffc30b', fontWeight: 600,
                fontSize: '0.85rem', textDecoration: 'none',
              }}
            >
              🏆 {t('battleTierLanding.learnFund', 'Learn About Kingdom Fund')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default KvKBattleTierListLanding;
