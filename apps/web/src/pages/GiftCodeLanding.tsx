import React from 'react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useMetaTags, PAGE_META_TAGS } from '../hooks/useMetaTags';
import { useStructuredData, PAGE_BREADCRUMBS } from '../hooks/useStructuredData';
import { neonGlow, FONT_DISPLAY } from '../utils/styles';
import { useTranslation } from 'react-i18next';

const GiftCodeLanding: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('giftCodeLanding.pageTitle', 'Gift Code Redeemer'));
  useMetaTags(PAGE_META_TAGS.giftCodes);
  useStructuredData({ type: 'BreadcrumbList', data: PAGE_BREADCRUMBS.tools });
  const isMobile = useIsMobile();

  const features = [
    {
      icon: '🎁',
      title: t('giftCodeLanding.featAuto', 'Auto-Detect Active Codes'),
      desc: t('giftCodeLanding.featAutoDesc', 'Atlas pulls every active gift code from the game — automatically. No hunting through Discord servers or Reddit threads.'),
    },
    {
      icon: '⚡',
      title: t('giftCodeLanding.featOneClick', 'One-Click Redeem'),
      desc: t('giftCodeLanding.featOneClickDesc', 'Hit "Redeem All" and every code gets applied to your account instantly. No copy-pasting. No typing errors. Just rewards in your mailbox.'),
    },
    {
      icon: '👤',
      title: t('giftCodeLanding.featAlt', 'Alt Account Support'),
      desc: t('giftCodeLanding.featAltDesc', 'Got alts? Add up to 10 accounts and redeem all codes across every one of them with a single button. Supporters only.'),
    },
    {
      icon: '🔄',
      title: t('giftCodeLanding.featSmart', 'Smart Retry Logic'),
      desc: t('giftCodeLanding.featSmartDesc', 'Rate-limited? Already redeemed? Expired? Atlas tracks every result and only retries what actually needs retrying. No wasted attempts.'),
    },
    {
      icon: '☁️',
      title: t('giftCodeLanding.featCloud', 'Cloud-Synced Accounts'),
      desc: t('giftCodeLanding.featCloudDesc', 'Your alt accounts sync to the cloud. Switch devices, clear your browser — your setup is always there waiting for you.'),
    },
    {
      icon: '🤖',
      title: t('giftCodeLanding.featDiscord', 'Discord Integration'),
      desc: t('giftCodeLanding.featDiscordDesc', 'Use /codes in Discord to see active codes. Use /redeem to redeem them without opening a browser. Atlas Bot handles it.'),
    },
  ];

  const steps = [
    {
      num: '1',
      icon: '🔗',
      title: t('giftCodeLanding.step1', 'Link Your Account'),
      desc: t('giftCodeLanding.step1Desc', 'Sign in to Atlas and link your Kingshot Player ID in your profile settings.'),
    },
    {
      num: '2',
      icon: '🎁',
      title: t('giftCodeLanding.step2', 'View Active Codes'),
      desc: t('giftCodeLanding.step2Desc', 'Atlas shows every active gift code with expiration timers. Always up to date.'),
    },
    {
      num: '3',
      icon: '🚀',
      title: t('giftCodeLanding.step3', 'Redeem & Collect'),
      desc: t('giftCodeLanding.step3Desc', 'Hit "Redeem All" — codes get applied instantly. Check your in-game mailbox for rewards.'),
    },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      {/* Hero */}
      <div style={{
        padding: isMobile ? '2rem 1rem 1.5rem' : '3rem 2rem 2rem',
        textAlign: 'center',
        background: 'linear-gradient(180deg, #1a1400 0%, #0a0a0a 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '700px', margin: '0 auto' }}>
          <div style={{
            width: isMobile ? '64px' : '80px', height: isMobile ? '64px' : '80px',
            borderRadius: '50%', backgroundColor: '#f59e0b15',
            border: '2px solid #f59e0b30',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.25rem',
            boxShadow: '0 0 30px rgba(245, 158, 11, 0.15), 0 0 60px rgba(245, 158, 11, 0.08)',
          }}>
            <span style={{ fontSize: isMobile ? '1.75rem' : '2.25rem' }}>🎁</span>
          </div>

          <h1 style={{
            fontSize: isMobile ? '1.75rem' : '2.5rem', fontWeight: 'bold',
            marginBottom: '0.75rem', fontFamily: FONT_DISPLAY,
          }}>
            <span style={{ color: '#fff' }}>{t('giftCodeLanding.heroTitle1', 'GIFT CODE')}</span>
            <span style={{ ...neonGlow('#f59e0b'), marginLeft: '0.5rem' }}>{t('giftCodeLanding.heroTitle2', 'REDEEMER')}</span>
          </h1>
          <p style={{
            color: '#9ca3af', fontSize: isMobile ? '0.95rem' : '1.1rem',
            maxWidth: '520px', margin: '0 auto 1.5rem', lineHeight: 1.6,
          }}>
            {t('giftCodeLanding.heroSubtitle', 'Stop typing codes one by one. Atlas finds them, you click once, rewards land in your mailbox. Done.')}
          </p>

          {/* CTA */}
          <div style={{
            display: 'flex', flexDirection: isMobile ? 'column' : 'row',
            gap: '0.75rem', justifyContent: 'center', alignItems: 'center',
          }}>
            <Link
              to="/tools/gift-codes"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
                padding: isMobile ? '0.85rem 1.75rem' : '0.9rem 2rem',
                backgroundColor: '#f59e0b', border: 'none', borderRadius: '10px',
                color: '#0a0a0a', fontWeight: 700,
                fontSize: isMobile ? '0.95rem' : '1rem', textDecoration: 'none',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 20px rgba(245, 158, 11, 0.35)',
              }}
            >
              🎁 {t('giftCodeLanding.redeemNow', 'Redeem Codes Now')}
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
              {t('giftCodeLanding.orUseBot', 'Or Use /redeem in Discord')}
            </Link>
          </div>
          <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.75rem' }}>
            {t('giftCodeLanding.freeNote', 'Free for all Atlas users. Link your Kingshot account to get started.')}
          </p>

          {!isMobile && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
              <div style={{ width: '50px', height: '2px', background: 'linear-gradient(90deg, transparent, #f59e0b)' }} />
              <div style={{ width: '6px', height: '6px', backgroundColor: '#f59e0b', transform: 'rotate(45deg)', boxShadow: '0 0 8px #f59e0b' }} />
              <div style={{ width: '50px', height: '2px', background: 'linear-gradient(90deg, #f59e0b, transparent)' }} />
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
            <span style={{ color: '#fff' }}>{t('giftCodeLanding.howItWorks1', 'HOW IT')}</span>
            <span style={{ ...neonGlow('#f59e0b'), marginLeft: '0.4rem' }}>{t('giftCodeLanding.howItWorks2', 'WORKS')}</span>
          </h2>
          <p style={{
            color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.85rem',
            textAlign: 'center', marginBottom: '1.5rem',
          }}>
            {t('giftCodeLanding.threeSteps', 'Three steps. Zero typing. All rewards.')}
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
                  backgroundColor: '#f59e0b15', border: '1px solid #f59e0b30',
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
            <span style={{ color: '#fff' }}>{t('giftCodeLanding.whyAtlas1', 'WHY USE')}</span>
            <span style={{ ...neonGlow('#f59e0b'), marginLeft: '0.4rem' }}>{t('giftCodeLanding.whyAtlas2', 'ATLAS')}</span>
          </h2>
          <p style={{
            color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.85rem',
            textAlign: 'center', marginBottom: '1.5rem',
          }}>
            {t('giftCodeLanding.whySubtitle', "Because typing codes manually is so 2024.")}
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

        {/* Free vs Supporter comparison */}
        <div style={{
          marginBottom: isMobile ? '2rem' : '3rem',
          backgroundColor: '#111111', borderRadius: '16px',
          border: '1px solid #f59e0b30', padding: isMobile ? '1.25rem' : '1.75rem',
          background: 'linear-gradient(135deg, #111111 0%, #f59e0b08 100%)',
        }}>
          <h2 style={{
            fontSize: isMobile ? '1.05rem' : '1.2rem', fontWeight: 'bold', color: '#fff',
            marginBottom: '1.25rem', fontFamily: FONT_DISPLAY, textAlign: 'center',
          }}>
            {t('giftCodeLanding.freeVsSupporter', 'Free vs. Supporter')}
          </h2>

          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: isMobile ? '0.75rem' : '1rem',
          }}>
            {/* Free Column */}
            <div style={{
              backgroundColor: '#0a0a0a', borderRadius: '12px', border: '1px solid #2a2a2a',
              padding: isMobile ? '1rem' : '1.25rem',
            }}>
              <div style={{
                fontSize: '0.65rem', fontWeight: 700, color: '#22c55e',
                backgroundColor: '#22c55e18', border: '1px solid #22c55e30',
                padding: '0.15rem 0.5rem', borderRadius: '4px', display: 'inline-block',
                marginBottom: '0.75rem', letterSpacing: '0.05em', textTransform: 'uppercase',
              }}>
                {t('giftCodeLanding.freeTier', 'Free')}
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {[
                  t('giftCodeLanding.freeF1', 'View all active codes'),
                  t('giftCodeLanding.freeF2', 'One-click redeem all'),
                  t('giftCodeLanding.freeF3', 'Copy codes to clipboard'),
                  t('giftCodeLanding.freeF4', 'Manual code entry'),
                  t('giftCodeLanding.freeF5', '1 alt account slot'),
                  t('giftCodeLanding.freeF6', '/codes & /redeem in Discord'),
                ].map((item, i) => (
                  <li key={i} style={{
                    color: '#d1d5db', fontSize: isMobile ? '0.72rem' : '0.8rem',
                    padding: '0.3rem 0', display: 'flex', alignItems: 'flex-start', gap: '0.4rem',
                  }}>
                    <span style={{ color: '#22c55e', flexShrink: 0 }}>✓</span> {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Supporter Column */}
            <div style={{
              backgroundColor: '#0a0a0a', borderRadius: '12px', border: '1px solid #FF6B8A30',
              padding: isMobile ? '1rem' : '1.25rem',
              background: 'linear-gradient(135deg, #0a0a0a 0%, #FF6B8A08 100%)',
            }}>
              <div style={{
                fontSize: '0.65rem', fontWeight: 700, color: '#FF6B8A',
                backgroundColor: '#FF6B8A18', border: '1px solid #FF6B8A30',
                padding: '0.15rem 0.5rem', borderRadius: '4px', display: 'inline-block',
                marginBottom: '0.75rem', letterSpacing: '0.05em', textTransform: 'uppercase',
              }}>
                {t('giftCodeLanding.supporterTier', 'Supporter')}
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {[
                  t('giftCodeLanding.supF1', 'Everything in Free'),
                  t('giftCodeLanding.supF2', 'Up to 10 alt accounts'),
                  t('giftCodeLanding.supF3', 'Bulk redeem all accounts'),
                  t('giftCodeLanding.supF4', 'Cloud-synced alt list'),
                  t('giftCodeLanding.supF5', 'Per-account result tracking'),
                  t('giftCodeLanding.supF6', 'Smart retry for failed codes'),
                ].map((item, i) => (
                  <li key={i} style={{
                    color: '#d1d5db', fontSize: isMobile ? '0.72rem' : '0.8rem',
                    padding: '0.3rem 0', display: 'flex', alignItems: 'flex-start', gap: '0.4rem',
                  }}>
                    <span style={{ color: '#FF6B8A', flexShrink: 0 }}>✓</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p style={{
            color: '#6b7280', fontSize: isMobile ? '0.7rem' : '0.75rem',
            textAlign: 'center', marginTop: '1rem', lineHeight: 1.5,
          }}>
            {t('giftCodeLanding.supporterNote', 'Managing 10 alts manually? That\'s 40+ codes to type every time. Supporters click once.')}
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
            {t('giftCodeLanding.problemTitle', 'New gift codes dropped. You missed 3 of them.')}
          </h2>
          <p style={{ color: '#d1d5db', fontSize: isMobile ? '0.85rem' : '0.9rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            {t('giftCodeLanding.problemDesc', 'Gift codes come from social media posts, in-game events, creator partnerships, and milestone celebrations. They expire fast. Miss one and those free speedups, gems, and resources are gone forever.')}
          </p>
          <p style={{ color: '#d1d5db', fontSize: isMobile ? '0.85rem' : '0.9rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            {t('giftCodeLanding.solutionDesc', 'Atlas monitors all sources and aggregates every active code in one place. Open the redeemer, click one button, and every code gets applied. No typing. No missed rewards. No expired opportunities.')}
          </p>
          <p style={{ color: '#f59e0b', fontSize: isMobile ? '0.8rem' : '0.85rem', fontWeight: 600, fontStyle: 'italic' }}>
            {t('giftCodeLanding.punchline', 'Stop leaving free resources on the table.')}
          </p>
        </div>

        {/* Supporter CTA */}
        <div style={{
          marginBottom: isMobile ? '2rem' : '3rem',
          padding: isMobile ? '1.5rem' : '2rem',
          backgroundColor: '#111111', borderRadius: '16px',
          border: '1px solid #FF6B8A30', textAlign: 'center',
          background: 'linear-gradient(135deg, #111111 0%, #FF6B8A08 100%)',
        }}>
          <span style={{
            fontSize: '0.65rem', fontWeight: 700, color: '#FF6B8A',
            backgroundColor: '#FF6B8A18', border: '1px solid #FF6B8A30',
            padding: '0.2rem 0.6rem', borderRadius: '4px',
            letterSpacing: '0.05em', textTransform: 'uppercase',
            display: 'inline-block', marginBottom: '0.75rem',
          }}>
            {t('giftCodeLanding.supporterBadge', 'Atlas Supporter Perk')}
          </span>
          <h3 style={{
            fontSize: isMobile ? '1.1rem' : '1.25rem', fontWeight: 'bold',
            color: '#fff', marginBottom: '0.5rem', fontFamily: FONT_DISPLAY,
          }}>
            {t('giftCodeLanding.supporterTitle', '10 accounts. One click. Every code.')}
          </h3>
          <p style={{
            color: '#9ca3af', fontSize: isMobile ? '0.8rem' : '0.85rem',
            marginBottom: '1.25rem', maxWidth: '450px', margin: '0 auto 1.25rem', lineHeight: 1.6,
          }}>
            {t('giftCodeLanding.supporterDesc', 'The Gift Code Auto-Redeemer for alt accounts is included with Atlas Supporter — along with unlimited /multirally, exclusive Discord perks, and more. Starting at $4.99/month.')}
          </p>
          <div style={{
            display: 'flex', flexDirection: isMobile ? 'column' : 'row',
            gap: '0.75rem', justifyContent: 'center', alignItems: 'center',
          }}>
            <Link
              to="/support"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.75rem 1.5rem', backgroundColor: '#FF6B8A',
                border: 'none', borderRadius: '8px', color: '#fff',
                fontWeight: 600, fontSize: isMobile ? '0.9rem' : '0.95rem',
                textDecoration: 'none', transition: 'all 0.2s ease',
                boxShadow: '0 4px 15px rgba(255, 107, 138, 0.3)',
              }}
            >
              {t('giftCodeLanding.becomeSupporter', 'Become a Supporter')}
            </Link>
            <Link
              to="/tools/gift-codes"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.75rem 1.5rem', backgroundColor: 'transparent',
                border: '1px solid #f59e0b40', borderRadius: '8px',
                color: '#f59e0b', fontWeight: 600,
                fontSize: isMobile ? '0.9rem' : '0.95rem', textDecoration: 'none',
              }}
            >
              {t('giftCodeLanding.tryFree', 'Try It Free')}
            </Link>
          </div>
        </div>

        {/* Back links */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', paddingBottom: '1rem' }}>
          <Link to="/tools" style={{ color: '#22d3ee', textDecoration: 'none', fontSize: '0.8rem' }}>
            {t('giftCodeLanding.allTools', '← All Tools')}
          </Link>
          <Link to="/" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '0.8rem' }}>
            {t('common.backToHome', '← Back to Home')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default GiftCodeLanding;
