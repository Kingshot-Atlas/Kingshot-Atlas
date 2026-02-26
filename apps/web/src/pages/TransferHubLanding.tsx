import React from 'react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useMetaTags, PAGE_META_TAGS } from '../hooks/useMetaTags';
import { useStructuredData, PAGE_BREADCRUMBS } from '../hooks/useStructuredData';
import { neonGlow, FONT_DISPLAY } from '../utils/styles';
import { useTranslation } from 'react-i18next';

const ACCENT = '#22c55e';
const ACCENT_DIM = '#22c55e15';
const ACCENT_BORDER = '#22c55e30';
const FUND_GOLD = '#f59e0b';
const FUND_SILVER = '#d1d5db';
const FUND_BRONZE = '#cd7f32';
const FUND_STANDARD = '#6b7280';

const TransferHubLanding: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('transferHubLanding.pageTitle', 'Transfer Hub — Find Your Next Kingdom'));
  useMetaTags(PAGE_META_TAGS.transferHubLanding);
  useStructuredData({ type: 'BreadcrumbList', data: PAGE_BREADCRUMBS.transferHubLanding });
  const isMobile = useIsMobile();

  const transfereeFeatures = [
    {
      icon: '🔍',
      title: t('transferHubLanding.tfFeat1', 'Browse Every Kingdom'),
      desc: t('transferHubLanding.tfFeat1Desc', 'See which kingdoms are actively recruiting — with Atlas Scores, KvK records, and community reviews. No more guessing.'),
    },
    {
      icon: '📋',
      title: t('transferHubLanding.tfFeat2', 'Create a Transfer Profile'),
      desc: t('transferHubLanding.tfFeat2Desc', 'List your stats, playstyle, and what you\'re looking for. Recruiters find you — no cold-calling required.'),
    },
    {
      icon: '🎯',
      title: t('transferHubLanding.tfFeat3', 'Match Scores'),
      desc: t('transferHubLanding.tfFeat3Desc', 'Every kingdom gets a match percentage based on your profile. Sort by best fit, apply to your top picks, and track your applications.'),
    },
  ];

  const recruiterFeatures = [
    {
      icon: '📢',
      title: t('transferHubLanding.rcFeat1', 'Set Up Your Listing'),
      desc: t('transferHubLanding.rcFeat1Desc', 'Claim your kingdom, set requirements, add vibe tags, and describe what makes your kingdom worth joining. Your listing is always live.'),
    },
    {
      icon: '📥',
      title: t('transferHubLanding.rcFeat2', 'Receive Applications'),
      desc: t('transferHubLanding.rcFeat2Desc', 'Qualified players apply directly. Review their profiles, stats, and playstyle — then accept or pass. No more spamming transfer chat.'),
    },
    {
      icon: '🚀',
      title: t('transferHubLanding.rcFeat3', 'Boost with Kingdom Fund'),
      desc: t('transferHubLanding.rcFeat3Desc', 'Optionally deposit into your kingdom\'s fund to unlock priority placement, invite features, and a premium badge. Anyone in your kingdom can contribute.'),
    },
  ];

  const steps = [
    {
      num: '1',
      icon: '🔗',
      title: t('transferHubLanding.step1', 'Link Your Account'),
      desc: t('transferHubLanding.step1Desc', 'Sign in and link your Kingshot Player ID. Takes 30 seconds.'),
    },
    {
      num: '2',
      icon: '🎭',
      title: t('transferHubLanding.step2', 'Pick Your Role'),
      desc: t('transferHubLanding.step2Desc', 'Transferring? Browse listings. Recruiting? Claim your kingdom and set up your page.'),
    },
    {
      num: '3',
      icon: '🤝',
      title: t('transferHubLanding.step3', 'Connect & Transfer'),
      desc: t('transferHubLanding.step3Desc', 'Apply to kingdoms, review applications, and make moves — all backed by real data.'),
    },
  ];

  // Comparison table rows: feature name + which tiers include it + minTier for color-coding
  const comparisonRows: { feature: string; standard: boolean; bronze: boolean; silver: boolean; gold: boolean; minTier: 'standard' | 'bronze' | 'silver' | 'gold' }[] = [
    { feature: t('transferHubLanding.cmpBasicListing', 'Basic listing with Atlas Score & stats'), standard: true, bronze: true, silver: true, gold: true, minTier: 'standard' },
    { feature: t('transferHubLanding.cmpReviews', 'Community reviews from players'), standard: true, bronze: true, silver: true, gold: true, minTier: 'standard' },
    { feature: t('transferHubLanding.cmpBioLang', 'Kingdom Bio & Language display'), standard: true, bronze: true, silver: true, gold: true, minTier: 'standard' },
    { feature: t('transferHubLanding.cmpMinReqs', 'Min TC & Power requirements shown'), standard: false, bronze: true, silver: true, gold: true, minTier: 'bronze' },
    { feature: t('transferHubLanding.cmpBrowseProfiles', 'Browse recruit candidates'), standard: false, bronze: true, silver: true, gold: true, minTier: 'bronze' },
    { feature: t('transferHubLanding.cmpVibeTags', 'Kingdom Policies & Vibe tags'), standard: false, bronze: true, silver: true, gold: true, minTier: 'bronze' },
    { feature: t('transferHubLanding.cmpInvites', 'Send invites to recruit candidates'), standard: false, bronze: false, silver: true, gold: true, minTier: 'silver' },
    { feature: t('transferHubLanding.cmpAlliance', 'Alliance Information & Schedules'), standard: false, bronze: false, silver: true, gold: true, minTier: 'silver' },
    { feature: t('transferHubLanding.cmpPrepScheduler', 'KvK Prep Scheduler access'), standard: false, bronze: false, silver: true, gold: true, minTier: 'silver' },
    { feature: t('transferHubLanding.cmpBadge', 'Gilded badge for all kingdom users'), standard: false, bronze: false, silver: false, gold: true, minTier: 'gold' },
    { feature: t('transferHubLanding.cmpGlow', 'Gold glow + priority placement'), standard: false, bronze: false, silver: false, gold: true, minTier: 'gold' },
    { feature: t('transferHubLanding.cmpBattlePlanner', 'KvK Battle Planner access'), standard: false, bronze: false, silver: false, gold: true, minTier: 'gold' },
    { feature: t('transferHubLanding.cmpBattleRegistry', 'KvK Battle Registry access'), standard: false, bronze: false, silver: false, gold: true, minTier: 'gold' },
  ];

  const TIER_COLORS: Record<string, string> = { standard: '#ffffff', bronze: FUND_BRONZE, silver: FUND_SILVER, gold: FUND_GOLD };

  const tierColumns = [
    { key: 'standard' as const, label: t('transferHubLanding.standard', 'Standard'), color: FUND_STANDARD, price: t('transferHubLanding.priceFree', 'Free'), recommended: false },
    { key: 'bronze' as const, label: t('transferHubLanding.bronze', 'Bronze'), color: FUND_BRONZE, price: '$25+', recommended: false },
    { key: 'silver' as const, label: t('transferHubLanding.silver', 'Silver'), color: FUND_SILVER, price: '$50+', recommended: false },
    { key: 'gold' as const, label: t('transferHubLanding.gold', 'Gold'), color: FUND_GOLD, price: '$100+', recommended: false },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      {/* Hero */}
      <div style={{
        padding: isMobile ? '2rem 1rem 1.5rem' : '3rem 2rem 2rem',
        textAlign: 'center',
        background: 'linear-gradient(180deg, #0a1f0f 0%, #0a0a0a 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '700px', margin: '0 auto' }}>
          <div style={{
            width: isMobile ? '64px' : '80px', height: isMobile ? '64px' : '80px',
            borderRadius: '50%', backgroundColor: ACCENT_DIM,
            border: `2px solid ${ACCENT_BORDER}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.25rem',
            boxShadow: `0 0 30px rgba(34, 197, 94, 0.15), 0 0 60px rgba(34, 197, 94, 0.08)`,
          }}>
            <span style={{ fontSize: isMobile ? '1.75rem' : '2.25rem', display: 'inline-block', animation: 'rocketFloat 3s ease-in-out infinite' }}>🚀</span>
          </div>

          <h1 style={{
            fontSize: isMobile ? '1.75rem' : '2.5rem', fontWeight: 'bold',
            marginBottom: '0.75rem', fontFamily: FONT_DISPLAY,
          }}>
            <span style={{ color: '#fff' }}>{t('transferHubLanding.heroTitle1', 'TRANSFER')}</span>
            <span style={{ ...neonGlow(ACCENT), marginLeft: '0.5rem' }}>{t('transferHubLanding.heroTitle2', 'HUB')}</span>
          </h1>
          <p style={{
            color: '#9ca3af', fontSize: isMobile ? '0.95rem' : '1.1rem',
            maxWidth: '520px', margin: '0 auto 1.5rem', lineHeight: 1.6,
          }}>
            {t('transferHubLanding.heroSubtitle', 'Stop asking around in Discord. Find the right kingdom — or the right players — with real data. 100% free.')}
          </p>

          {/* CTA */}
          <div style={{
            display: 'flex', flexDirection: isMobile ? 'column' : 'row',
            gap: '0.75rem', justifyContent: 'center', alignItems: 'center',
          }}>
            <Link
              to="/transfer-hub"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
                padding: isMobile ? '0.85rem 1.75rem' : '0.9rem 2rem',
                backgroundColor: ACCENT, border: 'none', borderRadius: '10px',
                color: '#0a0a0a', fontWeight: 700,
                fontSize: isMobile ? '0.95rem' : '1rem', textDecoration: 'none',
                transition: 'all 0.2s ease',
                boxShadow: `0 4px 20px rgba(34, 197, 94, 0.35)`,
              }}
            >
              🚀 {t('transferHubLanding.openHub', 'Open the Transfer Hub')}
            </Link>
          </div>
          <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.75rem' }}>
            {t('transferHubLanding.freeNote', 'Free for all players. Link your Kingshot account to get started.')}
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
            <span style={{ color: '#fff' }}>{t('transferHubLanding.howItWorks1', 'HOW IT')}</span>
            <span style={{ ...neonGlow(ACCENT), marginLeft: '0.4rem' }}>{t('transferHubLanding.howItWorks2', 'WORKS')}</span>
          </h2>
          <p style={{
            color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.85rem',
            textAlign: 'center', marginBottom: '1.5rem',
          }}>
            {t('transferHubLanding.threeSteps', 'Three steps. Whether you\'re moving or recruiting.')}
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

        {/* For Transferees */}
        <div style={{ marginBottom: isMobile ? '2rem' : '3rem' }}>
          <h2 style={{
            fontSize: isMobile ? '1.1rem' : '1.35rem', fontWeight: 'bold', color: '#fff',
            marginBottom: '0.4rem', fontFamily: FONT_DISPLAY, textAlign: 'center',
          }}>
            <span style={{ color: '#fff' }}>{t('transferHubLanding.forPlayers1', 'FOR')}</span>
            <span style={{ ...neonGlow(ACCENT), marginLeft: '0.4rem' }}>{t('transferHubLanding.forPlayers2', 'PLAYERS TRANSFERRING')}</span>
          </h2>
          <p style={{
            color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.85rem',
            textAlign: 'center', marginBottom: '1.5rem',
          }}>
            {t('transferHubLanding.forPlayersSubtitle', 'Find where you belong — backed by data, not rumors.')}
          </p>

          <div style={{
            display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1rem',
          }}>
            {transfereeFeatures.map((f) => (
              <div key={f.title} style={{
                backgroundColor: '#111111', borderRadius: '12px', border: '1px solid #2a2a2a',
                padding: isMobile ? '1rem' : '1.25rem', textAlign: 'center',
              }}>
                <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.6rem' }}>{f.icon}</span>
                <h3 style={{ fontSize: isMobile ? '0.9rem' : '0.95rem', fontWeight: 700, color: '#fff', marginBottom: '0.3rem' }}>
                  {f.title}
                </h3>
                <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.75rem' : '0.8rem', lineHeight: 1.5 }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* For Recruiters */}
        <div style={{ marginBottom: isMobile ? '2rem' : '3rem' }}>
          <h2 style={{
            fontSize: isMobile ? '1.1rem' : '1.35rem', fontWeight: 'bold', color: '#fff',
            marginBottom: '0.4rem', fontFamily: FONT_DISPLAY, textAlign: 'center',
          }}>
            <span style={{ color: '#fff' }}>{t('transferHubLanding.forRecruiters1', 'FOR')}</span>
            <span style={{ ...neonGlow(ACCENT), marginLeft: '0.4rem' }}>{t('transferHubLanding.forRecruiters2', 'RECRUITERS')}</span>
          </h2>
          <p style={{
            color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.85rem',
            textAlign: 'center', marginBottom: '1.5rem',
          }}>
            {t('transferHubLanding.forRecruitersSubtitle', 'Stop cold-calling in transfer chat. Let the right players come to you.')}
          </p>

          <div style={{
            display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1rem',
          }}>
            {recruiterFeatures.map((f) => (
              <div key={f.title} style={{
                backgroundColor: '#111111', borderRadius: '12px', border: '1px solid #2a2a2a',
                padding: isMobile ? '1rem' : '1.25rem', textAlign: 'center',
              }}>
                <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.6rem' }}>{f.icon}</span>
                <h3 style={{ fontSize: isMobile ? '0.9rem' : '0.95rem', fontWeight: 700, color: '#fff', marginBottom: '0.3rem' }}>
                  {f.title}
                </h3>
                <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.75rem' : '0.8rem', lineHeight: 1.5 }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Kingdom Fund Tiers — Comparison Table */}
        <div style={{
          marginBottom: isMobile ? '2rem' : '3rem',
          backgroundColor: '#111111', borderRadius: '16px',
          border: `1px solid ${ACCENT_BORDER}`, padding: isMobile ? '1rem' : '1.75rem',
          background: `linear-gradient(135deg, #111111 0%, ${ACCENT_DIM} 100%)`,
        }}>
          <h2 style={{
            fontSize: isMobile ? '1.05rem' : '1.2rem', fontWeight: 'bold', color: '#fff',
            marginBottom: '0.4rem', fontFamily: FONT_DISPLAY, textAlign: 'center',
          }}>
            {t('transferHubLanding.fundTitle', 'Kingdom Fund: Boost Your Listing')}
          </h2>
          <p style={{
            color: '#9ca3af', fontSize: isMobile ? '0.8rem' : '0.85rem',
            textAlign: 'center', marginBottom: '1.25rem', maxWidth: '520px', margin: '0 auto 1.25rem', lineHeight: 1.6,
          }}>
            {t('transferHubLanding.fundDesc', 'Recruiting is a team effort. Anyone in your kingdom can chip in to boost the listing. Funds deplete slowly over time, so active kingdoms stay on top.')}
          </p>

          {/* Mobile: stacked cards per tier */}
          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {tierColumns.map((tier) => (
                <div key={tier.key} style={{
                  backgroundColor: '#0a0a0a', borderRadius: '12px',
                  border: `1px solid ${tier.recommended ? `${tier.color}60` : `${tier.color}30`}`,
                  padding: '1rem', position: 'relative', overflow: 'hidden',
                  ...(tier.recommended ? { boxShadow: `0 0 20px ${tier.color}15` } : {}),
                }}>
                  {tier.recommended && (
                    <div style={{
                      position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                      background: `linear-gradient(90deg, ${tier.color}, ${tier.color}80)`,
                    }} />
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{
                        fontSize: '0.6rem', fontWeight: 700, color: tier.color,
                        backgroundColor: `${tier.color}18`, border: `1px solid ${tier.color}30`,
                        padding: '0.1rem 0.4rem', borderRadius: '4px',
                        letterSpacing: '0.05em', textTransform: 'uppercase',
                      }}>
                        {tier.label}
                      </span>
                      {tier.recommended && (
                        <span style={{ fontSize: '0.55rem', color: tier.color, fontWeight: 700 }}>
                          {t('transferHubLanding.recommended', 'RECOMMENDED')}
                        </span>
                      )}
                    </div>
                    <span style={{ color: '#fff', fontSize: '1rem', fontWeight: 700 }}>{tier.price}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    {comparisonRows.filter(row => row[tier.key]).map((row, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: '0.35rem',
                        fontSize: '0.72rem',
                        color: TIER_COLORS[row.minTier] || '#d1d5db',
                        fontWeight: row.minTier !== 'standard' ? 600 : 400,
                      }}>
                        <span style={{ color: tier.color, flexShrink: 0, fontSize: '0.6rem' }}>✓</span>
                        {row.feature}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Desktop: comparison table grid */
            <div style={{ overflowX: 'auto' }}>
              {/* Tier headers */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr repeat(4, 100px)',
                gap: '2px', marginBottom: '2px',
              }}>
                <div />
                {tierColumns.map(tier => (
                  <div key={tier.key} style={{
                    textAlign: 'center', padding: '0.75rem 0.25rem',
                    backgroundColor: tier.recommended ? `${tier.color}12` : '#0a0a0a',
                    borderRadius: '10px 10px 0 0',
                    border: tier.recommended ? `1px solid ${tier.color}40` : '1px solid #1a1a1a',
                    borderBottom: 'none', position: 'relative',
                  }}>
                    {tier.recommended && (
                      <div style={{
                        position: 'absolute', top: '-1px', left: '50%', transform: 'translateX(-50%)',
                        fontSize: '0.5rem', fontWeight: 700, color: '#0a0a0a',
                        backgroundColor: tier.color, padding: '0.05rem 0.4rem',
                        borderRadius: '0 0 6px 6px', letterSpacing: '0.05em',
                      }}>
                        {t('transferHubLanding.recommended', 'BEST VALUE')}
                      </div>
                    )}
                    <div style={{
                      fontSize: '0.6rem', fontWeight: 700, color: tier.color,
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                      marginTop: tier.recommended ? '0.3rem' : 0,
                    }}>
                      {tier.label}
                    </div>
                    <div style={{ color: '#fff', fontSize: '1rem', fontWeight: 700, marginTop: '0.15rem' }}>
                      {tier.price}
                    </div>
                  </div>
                ))}
              </div>

              {/* Feature rows */}
              {comparisonRows.map((row, ri) => (
                <div key={ri} style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr repeat(4, 100px)',
                  gap: '2px',
                }}>
                  <div style={{
                    padding: '0.35rem 0.5rem',
                    fontSize: '0.75rem',
                    color: TIER_COLORS[row.minTier] || '#d1d5db',
                    fontWeight: row.minTier !== 'standard' ? 600 : 400,
                    backgroundColor: ri % 2 === 0 ? '#0d0d0d' : 'transparent',
                    borderRadius: '4px 0 0 4px',
                    display: 'flex', alignItems: 'center',
                  }}>
                    {row.feature}
                  </div>
                  {tierColumns.map(tier => {
                    const included = row[tier.key];
                    return (
                      <div key={tier.key} style={{
                        textAlign: 'center', padding: '0.35rem 0.25rem',
                        backgroundColor: tier.recommended
                          ? (ri % 2 === 0 ? `${tier.color}08` : `${tier.color}04`)
                          : (ri % 2 === 0 ? '#0d0d0d' : 'transparent'),
                        borderLeft: tier.recommended ? `1px solid ${tier.color}20` : '1px solid #1a1a1a08',
                        borderRight: tier.recommended ? `1px solid ${tier.color}20` : 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {included ? (
                          <span style={{ color: tier.color, fontSize: '0.85rem', fontWeight: 700 }}>✓</span>
                        ) : (
                          <span style={{ color: '#333', fontSize: '0.75rem' }}>—</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          <p style={{
            color: '#6b7280', fontSize: isMobile ? '0.7rem' : '0.75rem',
            textAlign: 'center', marginTop: '1rem', lineHeight: 1.5,
          }}>
            {t('transferHubLanding.fundNote', 'Depositing is 100% optional. The Transfer Hub is free for everyone. Fund tiers just give your kingdom extra visibility.')}
          </p>
          <p style={{
            color: '#9ca3af', fontSize: isMobile ? '0.72rem' : '0.78rem',
            textAlign: 'center', marginTop: '0.5rem', lineHeight: 1.5, fontStyle: 'italic',
          }}>
            {t('transferHubLanding.fundTeamwork', 'Ask your alliance to chip in — recruiting benefits everyone in the kingdom.')}
          </p>
        </div>

        {/* The Problem */}
        <div style={{
          marginBottom: isMobile ? '2rem' : '3rem',
          backgroundColor: '#111111', borderRadius: '16px',
          border: '1px solid #2a2a2a', padding: isMobile ? '1.25rem' : '1.75rem',
        }}>
          <h2 style={{
            fontSize: isMobile ? '1.05rem' : '1.2rem', fontWeight: 'bold', color: '#fff',
            marginBottom: '1rem', fontFamily: FONT_DISPLAY,
          }}>
            {t('transferHubLanding.problemTitle', 'Transfer chat is a mess. You know it.')}
          </h2>
          <p style={{ color: '#d1d5db', fontSize: isMobile ? '0.85rem' : '0.9rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            {t('transferHubLanding.problemDesc', 'Hundreds of messages. Half of them aren\'t serious. No way to compare kingdoms side by side. No way to know which recruiters are legit. You end up asking in Discord and getting 20 different opinions.')}
          </p>
          <p style={{ color: '#d1d5db', fontSize: isMobile ? '0.85rem' : '0.9rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            {t('transferHubLanding.solutionDesc', 'The Transfer Hub replaces all of that. Every recruiting kingdom has real stats, an Atlas Score, KvK history, and community reviews. Players create profiles with their own stats and preferences. Apply directly. Track your applications. Done.')}
          </p>
          <p style={{ color: ACCENT, fontSize: isMobile ? '0.8rem' : '0.85rem', fontWeight: 600, fontStyle: 'italic' }}>
            {t('transferHubLanding.punchline', 'Real data. Real applications. No more blind migrations.')}
          </p>
        </div>

        {/* Discord Transfer Groups */}
        <div style={{
          marginBottom: isMobile ? '2rem' : '3rem',
          backgroundColor: '#111111', borderRadius: '16px',
          border: '1px solid #5865F220', padding: isMobile ? '1.25rem' : '1.75rem',
          background: 'linear-gradient(135deg, #111111 0%, #5865F208 100%)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#5865F2" style={{ flexShrink: 0 }}>
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            <h2 style={{
              fontSize: isMobile ? '1.05rem' : '1.2rem', fontWeight: 'bold', color: '#fff',
              margin: 0, fontFamily: FONT_DISPLAY,
            }}>
              {t('transferHubLanding.discordTitle', 'Transfer Group Channels — Now Live')}
            </h2>
          </div>
          <p style={{ color: '#d1d5db', fontSize: isMobile ? '0.85rem' : '0.9rem', lineHeight: 1.7, marginBottom: '0.75rem' }}>
            {t('transferHubLanding.discordDesc', 'Every Transfer Event, we open dedicated Discord channels for each kingdom group. Link your account, get auto-assigned to your group, and start coordinating with players in your range — before the event even starts.')}
          </p>
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem',
          }}>
            {[
              { icon: '🔗', text: t('transferHubLanding.discordStep1', 'Link your Kingshot account') },
              { icon: '🏷️', text: t('transferHubLanding.discordStep2', 'Get your group role automatically') },
              { icon: '💬', text: t('transferHubLanding.discordStep3', 'Chat with players in your kingdom range') },
            ].map((step, i) => (
              <div key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.35rem 0.75rem', backgroundColor: '#5865F210',
                border: '1px solid #5865F218', borderRadius: '8px',
                fontSize: isMobile ? '0.75rem' : '0.8rem', color: '#d1d5db',
              }}>
                <span>{step.icon}</span>
                <span>{step.text}</span>
              </div>
            ))}
          </div>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.75rem' : '0.8rem', lineHeight: 1.6, marginBottom: '1rem' }}>
            {t('transferHubLanding.discordWhy', 'The Transfer Hub gives you the data. Discord gives you the conversation. Use both to land in the right kingdom.')}
          </p>
          <a
            href="https://discord.gg/cajcacDzGd"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.6rem 1.25rem', backgroundColor: '#5865F2',
              borderRadius: '8px', color: '#fff', textDecoration: 'none',
              fontSize: isMobile ? '0.85rem' : '0.9rem', fontWeight: '600',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 15px rgba(88, 101, 242, 0.3)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            {t('transferHubLanding.joinDiscord', 'Join the Atlas Discord')}
          </a>
        </div>

        {/* Final CTA */}
        <div style={{
          marginBottom: isMobile ? '2rem' : '3rem',
          padding: isMobile ? '1.5rem' : '2rem',
          backgroundColor: '#111111', borderRadius: '16px',
          border: `1px solid ${ACCENT_BORDER}`, textAlign: 'center',
          background: `linear-gradient(135deg, #111111 0%, ${ACCENT_DIM} 100%)`,
        }}>
          <span style={{
            fontSize: '0.65rem', fontWeight: 700, color: '#22c55e',
            backgroundColor: '#22c55e18', border: '1px solid #22c55e30',
            padding: '0.2rem 0.6rem', borderRadius: '4px',
            letterSpacing: '0.05em', textTransform: 'uppercase',
            display: 'inline-block', marginBottom: '0.75rem',
          }}>
            {t('transferHubLanding.freeBadge', '100% Free')}
          </span>
          <h3 style={{
            fontSize: isMobile ? '1.1rem' : '1.25rem', fontWeight: 'bold',
            color: '#fff', marginBottom: '0.5rem', fontFamily: FONT_DISPLAY,
          }}>
            {t('transferHubLanding.ctaTitle', 'Your next kingdom is waiting.')}
          </h3>
          <p style={{
            color: '#9ca3af', fontSize: isMobile ? '0.8rem' : '0.85rem',
            marginBottom: '1.25rem', maxWidth: '450px', margin: '0 auto 1.25rem', lineHeight: 1.6,
          }}>
            {t('transferHubLanding.ctaDesc', 'Whether you\'re looking for a new home or looking for strong players — the Transfer Hub connects you with the right match. No cost, no catch.')}
          </p>
          <div style={{
            display: 'flex', flexDirection: isMobile ? 'column' : 'row',
            gap: '0.75rem', justifyContent: 'center', alignItems: 'center',
          }}>
            <Link
              to="/transfer-hub"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.75rem 1.5rem', backgroundColor: ACCENT,
                border: 'none', borderRadius: '8px', color: '#0a0a0a',
                fontWeight: 600, fontSize: isMobile ? '0.9rem' : '0.95rem',
                textDecoration: 'none', transition: 'all 0.2s ease',
                boxShadow: `0 4px 15px rgba(34, 197, 94, 0.3)`,
              }}
            >
              🚀 {t('transferHubLanding.ctaButton', 'Enter the Transfer Hub')}
            </Link>
            <Link
              to="/"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.75rem 1.5rem', backgroundColor: 'transparent',
                border: `1px solid ${ACCENT}40`, borderRadius: '8px',
                color: ACCENT, fontWeight: 600,
                fontSize: isMobile ? '0.9rem' : '0.95rem', textDecoration: 'none',
              }}
            >
              {t('transferHubLanding.browseKingdoms', 'Browse All Kingdoms')}
            </Link>
          </div>
        </div>

        {/* Back links */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', paddingBottom: '1rem' }}>
          <Link to="/tools" style={{ color: ACCENT, textDecoration: 'none', fontSize: '0.8rem' }}>
            {t('transferHubLanding.allTools', '← All Tools')}
          </Link>
          <Link to="/" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '0.8rem' }}>
            {t('common.backToHome', '← Back to Home')}
          </Link>
        </div>
      </div>
      <style>{`
        @keyframes rocketFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
};

export default TransferHubLanding;
