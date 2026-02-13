import React from 'react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useMetaTags, PAGE_META_TAGS } from '../hooks/useMetaTags';
import { useStructuredData, PAGE_BREADCRUMBS } from '../hooks/useStructuredData';
import { neonGlow, FONT_DISPLAY } from '../utils/styles';
import { useTranslation } from 'react-i18next';

const ACCENT = '#22d3ee';
const ACCENT_DIM = '#22d3ee15';
const ACCENT_BORDER = '#22d3ee30';
const FUND_GOLD = '#f59e0b';
const FUND_SILVER = '#94a3b8';
const FUND_BRONZE = '#cd7f32';

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

  const fundTiers = [
    {
      tier: t('transferHubLanding.bronze', 'Bronze'),
      color: FUND_BRONZE,
      min: '$25+',
      perks: [
        t('transferHubLanding.bronzePerk1', 'Bronze badge on listing'),
        t('transferHubLanding.bronzePerk2', 'Higher in search results'),
      ],
    },
    {
      tier: t('transferHubLanding.silver', 'Silver'),
      color: FUND_SILVER,
      min: '$50+',
      perks: [
        t('transferHubLanding.silverPerk1', 'Silver badge + all Bronze perks'),
        t('transferHubLanding.silverPerk2', 'Send invites to top players'),
      ],
    },
    {
      tier: t('transferHubLanding.gold', 'Gold'),
      color: FUND_GOLD,
      min: '$100+',
      perks: [
        t('transferHubLanding.goldPerk1', 'Gold badge + all Silver perks'),
        t('transferHubLanding.goldPerk2', 'Priority placement at the top'),
      ],
    },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      {/* Hero */}
      <div style={{
        padding: isMobile ? '2rem 1rem 1.5rem' : '3rem 2rem 2rem',
        textAlign: 'center',
        background: 'linear-gradient(180deg, #0a1a1f 0%, #0a0a0a 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '700px', margin: '0 auto' }}>
          <div style={{
            width: isMobile ? '64px' : '80px', height: isMobile ? '64px' : '80px',
            borderRadius: '50%', backgroundColor: ACCENT_DIM,
            border: `2px solid ${ACCENT_BORDER}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.25rem',
            boxShadow: `0 0 30px rgba(34, 211, 238, 0.15), 0 0 60px rgba(34, 211, 238, 0.08)`,
          }}>
            <span style={{ fontSize: isMobile ? '1.75rem' : '2.25rem' }}>🔄</span>
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
                boxShadow: `0 4px 20px rgba(34, 211, 238, 0.35)`,
              }}
            >
              🔄 {t('transferHubLanding.openHub', 'Open the Transfer Hub')}
            </Link>
            <Link
              to="/atlas-bot"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.75rem 1.5rem', backgroundColor: 'transparent',
                border: '1px solid #5865F240', borderRadius: '8px',
                color: '#5865F2', fontWeight: 600,
                fontSize: isMobile ? '0.9rem' : '0.95rem', textDecoration: 'none',
              }}
            >
              {t('transferHubLanding.orDiscord', 'Or Use /kingdom in Discord')}
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

        {/* Kingdom Fund Tiers */}
        <div style={{
          marginBottom: isMobile ? '2rem' : '3rem',
          backgroundColor: '#111111', borderRadius: '16px',
          border: `1px solid ${ACCENT_BORDER}`, padding: isMobile ? '1.25rem' : '1.75rem',
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

          <div style={{
            display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
            gap: isMobile ? '0.75rem' : '1rem',
          }}>
            {fundTiers.map((tier) => (
              <div key={tier.tier} style={{
                backgroundColor: '#0a0a0a', borderRadius: '12px',
                border: `1px solid ${tier.color}30`,
                padding: isMobile ? '1rem' : '1.25rem', textAlign: 'center',
              }}>
                <div style={{
                  fontSize: '0.65rem', fontWeight: 700, color: tier.color,
                  backgroundColor: `${tier.color}18`, border: `1px solid ${tier.color}30`,
                  padding: '0.15rem 0.5rem', borderRadius: '4px', display: 'inline-block',
                  marginBottom: '0.5rem', letterSpacing: '0.05em', textTransform: 'uppercase',
                }}>
                  {tier.tier}
                </div>
                <div style={{ color: '#fff', fontSize: isMobile ? '1rem' : '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                  {tier.min}
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {tier.perks.map((perk, i) => (
                    <li key={i} style={{
                      color: '#d1d5db', fontSize: isMobile ? '0.72rem' : '0.78rem',
                      padding: '0.25rem 0', display: 'flex', alignItems: 'flex-start', gap: '0.4rem',
                      justifyContent: 'center',
                    }}>
                      <span style={{ color: tier.color, flexShrink: 0 }}>✓</span> {perk}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

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
                boxShadow: `0 4px 15px rgba(34, 211, 238, 0.3)`,
              }}
            >
              🔄 {t('transferHubLanding.ctaButton', 'Enter the Transfer Hub')}
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
    </div>
  );
};

export default TransferHubLanding;
