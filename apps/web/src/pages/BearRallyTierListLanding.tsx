import React from 'react';
import { Link } from 'react-router-dom';
import BackLink from '../components/shared/BackLink';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useMetaTags } from '../hooks/useMetaTags';
import { neonGlow, FONT_DISPLAY } from '../utils/styles';
import { useTranslation } from 'react-i18next';

const ACCENT = '#3b82f6';

const BearRallyTierListLanding: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('bearRallyLanding.pageTitle', 'Bear Rally Tier List'));
  useMetaTags({
    title: 'Bear Rally Tier List — Kingshot Atlas',
    description: 'Rank your alliance members by Bear Hunt rally power. Scout, input stats, and see who hits the hardest.',
  });
  const isMobile = useIsMobile();

  const features = [
    {
      icon: '🔍',
      title: t('bearRallyLanding.featScout', 'Scout-Based Input'),
      desc: t('bearRallyLanding.featScoutDesc', 'Input each player\'s scouted stats directly — Infantry, Cavalry, and Archer Attack & Lethality percentages. No guesswork needed.'),
    },
    {
      icon: '⚙️',
      title: t('bearRallyLanding.featEG', 'Exclusive Gear Adjustment'),
      desc: t('bearRallyLanding.featEGDesc', 'Atlas knows which heroes have offensive vs defensive Exclusive Gear. Defensive bonuses are removed from scouted stats. Offensive bonuses are applied for rally accuracy.'),
    },
    {
      icon: '📊',
      title: t('bearRallyLanding.featScore', 'Bear Score Ranking'),
      desc: t('bearRallyLanding.featScoreDesc', 'Every player gets a Bear Score based on their adjusted troop bonuses. The list auto-ranks from highest to lowest — your strongest hitters at the top.'),
    },
    {
      icon: '🏅',
      title: t('bearRallyLanding.featTiers', 'Smart Tier Classification'),
      desc: t('bearRallyLanding.featTiersDesc', 'Players are sorted into tiers SS through D using a natural-breaks algorithm that finds the biggest score gaps in your roster. Tiers represent real power differences — not arbitrary percentiles.'),
    },
    {
      icon: '🐻',
      title: t('bearRallyLanding.featBear', 'Built for Bear Hunt'),
      desc: t('bearRallyLanding.featBearDesc', 'Bear Hunt is a rally event — only offensive stats matter. This tool strips away the noise and gives you the real numbers for rally damage.'),
    },
    {
      icon: '🔒',
      title: t('bearRallyLanding.featAccess', 'Alliance Access Control'),
      desc: t('bearRallyLanding.featAccessDesc', 'Supporters, Consuls, and Boosters can create and manage the tier list. Up to 2 delegates can also edit. The rest of your alliance gets read-only access.'),
    },
    {
      icon: '🎛️',
      title: t('bearRallyLanding.featCustomCutoffs', 'Custom Tier Cutoffs'),
      desc: t('bearRallyLanding.featCustomCutoffsDesc', 'Alliance managers can manually adjust tier boundaries if the auto-calculated tiers don\'t match their judgment. Set your own score thresholds — or let Atlas decide.'),
    },
    {
      icon: '⚠️',
      title: t('bearRallyLanding.featDisclaimer', 'Guide, Not Gospel'),
      desc: t('bearRallyLanding.featDisclaimerDesc', 'This tool factors in troop bonuses and Exclusive Gear adjustments only. Hero skills and talent trees are not included. Use it as a starting point for rally decisions.'),
    },
  ];

  const steps = [
    {
      num: '1',
      icon: '🔍',
      title: t('bearRallyLanding.step1', 'Scout Your Players'),
      desc: t('bearRallyLanding.step1Desc', 'Have each alliance member set their best Bear Hunt team in the Guard Station (heroes in city). Scout them to get the report.'),
    },
    {
      num: '2',
      icon: '📝',
      title: t('bearRallyLanding.step2', 'Input the Stats'),
      desc: t('bearRallyLanding.step2Desc', 'Select each hero, their Exclusive Gear level, and enter the Attack & Lethality percentages from the scout report.'),
    },
    {
      num: '3',
      icon: '🏆',
      title: t('bearRallyLanding.step3', 'See the Tier List'),
      desc: t('bearRallyLanding.step3Desc', 'Atlas calculates the Bear Score, ranks all players, and assigns tiers. Your hardest hitters rise to the top.'),
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
            <span style={{ fontSize: isMobile ? '1.75rem' : '2.25rem' }}>🐻</span>
          </div>

          <h1 style={{
            fontSize: isMobile ? '1.75rem' : '2.5rem', fontWeight: 'bold',
            marginBottom: '0.75rem', fontFamily: FONT_DISPLAY,
          }}>
            <span style={{ color: '#fff' }}>{t('bearRallyLanding.heroTitle1', 'BEAR RALLY')}</span>
            <span style={{ ...neonGlow(ACCENT), marginLeft: '0.5rem' }}>{t('bearRallyLanding.heroTitle2', 'TIER LIST')}</span>
          </h1>
          <p style={{
            color: '#9ca3af', fontSize: isMobile ? '0.95rem' : '1.1rem',
            maxWidth: '520px', margin: '0 auto 1.5rem', lineHeight: 1.6,
          }}>
            {t('bearRallyLanding.heroSubtitle', 'Stop guessing who your best Bear Hunt hitters are. Scout them. Rank them. Rally smarter.')}
          </p>

          {/* CTA */}
          <div style={{
            display: 'flex', flexDirection: isMobile ? 'column' : 'row',
            gap: '0.75rem', justifyContent: 'center', alignItems: 'center',
          }}>
            <Link
              to="/tools/bear-rally-tier-list"
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
              🐻 {t('bearRallyLanding.launchTool', 'Launch Tier List')}
            </Link>
          </div>
          <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.75rem' }}>
            {t('bearRallyLanding.freeNote', 'Free for all alliances. No account required.')}
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
            <span style={{ color: '#fff' }}>{t('bearRallyLanding.howItWorks1', 'HOW IT')}</span>
            <span style={{ ...neonGlow(ACCENT), marginLeft: '0.4rem' }}>{t('bearRallyLanding.howItWorks2', 'WORKS')}</span>
          </h2>
          <p style={{
            color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.85rem',
            textAlign: 'center', marginBottom: '1.5rem',
          }}>
            {t('bearRallyLanding.threeSteps', 'Three steps. Total rally clarity.')}
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
                  backgroundColor: `${ACCENT}15`, border: `1px solid ${ACCENT}30`,
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
            <span style={{ color: '#fff' }}>{t('bearRallyLanding.builtFor1', 'BUILT FOR')}</span>
            <span style={{ ...neonGlow(ACCENT), marginLeft: '0.4rem' }}>{t('bearRallyLanding.builtFor2', 'RALLY LEADERS')}</span>
          </h2>
          <p style={{
            color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.85rem',
            textAlign: 'center', marginBottom: '1.5rem',
          }}>
            {t('bearRallyLanding.featuresSubtitle', 'Every feature built to help you pick the right ralliers.')}
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
          border: `1px solid ${ACCENT}30`, padding: isMobile ? '1.25rem' : '1.75rem',
          background: `linear-gradient(135deg, #111111 0%, ${ACCENT}08 100%)`,
        }}>
          <h2 style={{
            fontSize: isMobile ? '1.05rem' : '1.2rem', fontWeight: 'bold', color: '#fff',
            marginBottom: '1rem', fontFamily: FONT_DISPLAY,
          }}>
            {t('bearRallyLanding.problemTitle', '"Who should we put in the Bear rally?" — Every R5, every Bear Hunt.')}
          </h2>
          <p style={{ color: '#d1d5db', fontSize: isMobile ? '0.85rem' : '0.9rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            {t('bearRallyLanding.problemDesc', 'You ask in alliance chat. Half your members say "me" with no stats. You end up picking the same 5 people every time — and wondering if there\'s someone better. Meanwhile, defensive Exclusive Gear bonuses inflate scouted stats, making some players look stronger than they actually are in a rally.')}
          </p>
          <p style={{ color: '#d1d5db', fontSize: isMobile ? '0.85rem' : '0.9rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            {t('bearRallyLanding.solutionDesc', 'The Bear Rally Tier List cuts through the noise. It adjusts for Exclusive Gear — removing inflated defensive bonuses, applying real offensive bonuses — and ranks every player by their actual rally damage potential. No more guessing. No more politics. Just data.')}
          </p>
          <p style={{ color: ACCENT, fontSize: isMobile ? '0.8rem' : '0.85rem', fontWeight: 600, fontStyle: 'italic' }}>
            {t('bearRallyLanding.punchline', 'The bear doesn\'t care about your feelings. It cares about your stats.')}
          </p>
        </div>

        {/* Exclusive Gear Info */}
        <div style={{
          marginBottom: isMobile ? '2rem' : '3rem',
          backgroundColor: '#111111', borderRadius: '16px',
          border: '1px solid #2a2a2a', padding: isMobile ? '1.25rem' : '1.75rem',
        }}>
          <h2 style={{
            fontSize: isMobile ? '1.05rem' : '1.2rem', fontWeight: 'bold', color: '#fff',
            marginBottom: '0.5rem', fontFamily: FONT_DISPLAY,
          }}>
            {t('bearRallyLanding.egTitle', 'Why Exclusive Gear matters')}
          </h2>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.8rem' : '0.85rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            {t('bearRallyLanding.egDesc', 'When you scout a player, defensive Exclusive Gear bonuses are active — inflating their displayed stats. But in a Bear rally, only offensive Exclusive Gear bonuses activate. Atlas knows which heroes have offensive vs defensive EG and adjusts accordingly.')}
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
            gap: '0.75rem',
          }}>
            <div style={{
              padding: '0.75rem', backgroundColor: '#22c55e08',
              border: '1px solid #22c55e20', borderRadius: '8px',
            }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                {t('bearRallyLanding.offensiveEG', 'Offensive EG (Added for Rally)')}
              </div>
              <p style={{ color: '#9ca3af', fontSize: '0.75rem', lineHeight: 1.5 }}>
                Helga, Amadeus, Petra, Thrud, Marlin, Rosa, Yang
              </p>
            </div>
            <div style={{
              padding: '0.75rem', backgroundColor: '#ef444408',
              border: '1px solid #ef444420', borderRadius: '8px',
            }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                {t('bearRallyLanding.defensiveEG', 'Defensive EG (Removed from Scout)')}
              </div>
              <p style={{ color: '#9ca3af', fontSize: '0.75rem', lineHeight: 1.5 }}>
                Zoe, Eric, Alcar, Long Fei, Triton, Jabel, Hilde, Margot, Sophia, Saul, Jaeger, Vivian
              </p>
            </div>
          </div>
        </div>

        {/* Disclaimer Banner */}
        <div style={{
          marginBottom: isMobile ? '1.5rem' : '2rem',
          padding: isMobile ? '1rem' : '1.25rem',
          backgroundColor: '#f59e0b08',
          border: '1px solid #f59e0b20',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.6rem',
        }}>
          <span style={{ fontSize: '1rem', flexShrink: 0, lineHeight: 1.5 }}>⚠️</span>
          <div>
            <h3 style={{ fontSize: isMobile ? '0.85rem' : '0.9rem', fontWeight: 700, color: '#f59e0b', marginBottom: '0.3rem' }}>
              {t('bearRallyLanding.disclaimerTitle', 'Important Disclaimer')}
            </h3>
            <p style={{ color: '#d1a054', fontSize: isMobile ? '0.78rem' : '0.83rem', lineHeight: 1.6, margin: 0 }}>
              {t('bearRallyLanding.disclaimerText', 'The Bear Rally Tier List is a guide \u2014 not a definitive ranking. It calculates Bear Scores based on troop bonuses and Exclusive Gear adjustments only. Hero skills, talent trees, and other variables are not factored in. Use this tool as a starting point for your rally lineup decisions.')}
            </p>
          </div>
        </div>

        {/* Bottom CTA */}
        <div style={{
          marginBottom: isMobile ? '2rem' : '3rem',
          padding: isMobile ? '1.5rem' : '2rem',
          backgroundColor: '#111111', borderRadius: '16px',
          border: `1px solid ${ACCENT}25`, textAlign: 'center',
          background: `linear-gradient(135deg, #111111 0%, ${ACCENT}06 100%)`,
        }}>
          <span style={{
            fontSize: '0.65rem', fontWeight: 700,
            color: ACCENT,
            backgroundColor: `${ACCENT}15`,
            border: `1px solid ${ACCENT}30`,
            padding: '0.2rem 0.6rem', borderRadius: '4px',
            letterSpacing: '0.05em', textTransform: 'uppercase',
            display: 'inline-block', marginBottom: '0.75rem',
          }}>
            {t('bearRallyLanding.freeBadge', 'Free Alliance Tool')}
          </span>
          <h3 style={{
            fontSize: isMobile ? '1.1rem' : '1.25rem', fontWeight: 'bold',
            color: '#fff', marginBottom: '0.5rem', fontFamily: FONT_DISPLAY,
          }}>
            {t('bearRallyLanding.ctaTitle', 'Know your hitters. Win the hunt.')}
          </h3>
          <p style={{
            color: '#9ca3af', fontSize: isMobile ? '0.8rem' : '0.85rem',
            marginBottom: '1.25rem', maxWidth: '450px', margin: '0 auto 1.25rem', lineHeight: 1.6,
          }}>
            {t('bearRallyLanding.ctaDesc', 'Scout your alliance, input the stats, and let Atlas rank your players. Takes 2 minutes per player. Saves hours of debate.')}
          </p>
          <Link
            to="/tools/bear-rally-tier-list"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.75rem 1.5rem', backgroundColor: ACCENT,
              border: 'none', borderRadius: '8px', color: '#fff',
              fontWeight: 600, fontSize: isMobile ? '0.9rem' : '0.95rem',
              textDecoration: 'none', transition: 'all 0.2s ease',
              boxShadow: `0 4px 15px ${ACCENT}30`,
            }}
          >
            🐻 {t('bearRallyLanding.launchTool', 'Launch Tier List')}
          </Link>
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

export default BearRallyTierListLanding;
