import React from 'react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '../hooks/useMediaQuery';
import { neonGlow, FONT_DISPLAY } from '../utils/styles';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useMetaTags, PAGE_META_TAGS } from '../hooks/useMetaTags';
import { useStructuredData, ABOUT_FAQ_DATA, PAGE_BREADCRUMBS } from '../hooks/useStructuredData';
import SupportButton from '../components/SupportButton';
import { useTranslation } from 'react-i18next';

const About: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle('About');
  useMetaTags(PAGE_META_TAGS.about);
  useStructuredData({ type: 'FAQPage', data: ABOUT_FAQ_DATA });
  useStructuredData({ type: 'BreadcrumbList', data: PAGE_BREADCRUMBS.about });
  const isMobile = useIsMobile();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      {/* Hero Section - matching directory */}
      <div style={{ 
        padding: isMobile ? '1.25rem 1rem 1rem' : '1.75rem 2rem 1.25rem',
        textAlign: 'center',
        background: 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '800px', margin: '0 auto' }}>
          <h1 style={{ 
            fontSize: isMobile ? '1.5rem' : '2rem', 
            fontWeight: 'bold', 
            marginBottom: '0.5rem',
            fontFamily: FONT_DISPLAY
          }}>
            <span style={{ color: '#fff' }}>ABOUT</span>
            <span style={{ ...neonGlow('#22d3ee'), marginLeft: '0.5rem', fontSize: isMobile ? '1.6rem' : '2.25rem' }}>US</span>
          </h1>
          <p style={{ color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.9rem', marginBottom: '0.75rem' }}>
            {t('about.heroSubtitle', 'Know your enemy. Choose your allies. Dominate Kingshot.')}
          </p>
          {!isMobile && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '50px', height: '2px', background: 'linear-gradient(90deg, transparent, #22d3ee)' }} />
            <div style={{ width: '6px', height: '6px', backgroundColor: '#22d3ee', transform: 'rotate(45deg)', boxShadow: '0 0 8px #22d3ee' }} />
            <div style={{ width: '50px', height: '2px', background: 'linear-gradient(90deg, #22d3ee, transparent)' }} />
          </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: isMobile ? '1.5rem 1rem' : '2rem' }}>
        {/* What is Kingshot Atlas */}
        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ 
            fontSize: isMobile ? '1.1rem' : '1.25rem', 
            fontWeight: 'bold', 
            color: '#fff', 
            marginBottom: '1rem',
            fontFamily: FONT_DISPLAY
          }}>
            {t('about.stopGuessing', 'Stop Guessing. Start Winning.')}
          </h2>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.9rem' : '0.95rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            <span style={{ color: '#22d3ee' }}>Kingshot Atlas</span> is the only analytics platform built specifically for Kingshot players who refuse to leave victory to chance. We track every KvK result, analyze every kingdom&apos;s performance, and give you the intelligence you need to make decisions that actually matter.
          </p>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.9rem' : '0.95rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            Scouting your next KvK opponent? We&apos;ve got their win rate, their streaks, and their weaknesses. Looking for a new home during Transfer? Find kingdoms that match your competitive level. Recruiting for your alliance? Show prospects exactly why your kingdom dominates.
          </p>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.9rem' : '0.95rem', lineHeight: 1.7 }}>
            No more guessing. No more blind transfers. No more surprises. Just <span style={{ color: '#22c55e' }}>data-driven dominance</span>.
          </p>
        </section>

        {/* Features */}
        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ 
            fontSize: isMobile ? '1.1rem' : '1.25rem', 
            fontWeight: 'bold', 
            color: '#fff', 
            marginBottom: '1rem',
            fontFamily: FONT_DISPLAY
          }}>
            {t('about.competitiveEdge', 'Your Competitive Edge')}
          </h2>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {[
              { title: t('about.featureDirectory', 'Kingdom Directory'), desc: t('about.featureDirectoryDesc', 'Every kingdom. Every stat. Searchable, filterable, and ranked. Find exactly what you\'re looking for in seconds.'), icon: '🗺️' },
              { title: t('about.featureScore', 'Atlas Score'), desc: t('about.featureScoreDesc', 'Battle-tested rating that rewards experience and consistency. One number tells you who\'s a real threat vs a lucky newcomer.'), icon: '⚡' },
              { title: t('about.featureComparison', 'Head-to-Head Comparison'), desc: t('about.featureComparisonDesc', 'Pit any two kingdoms against each other. See who has the edge in Prep, Battle, and overall dominance.'), icon: '⚔️' },
              { title: t('about.featureHistory', 'Complete KvK History'), desc: t('about.featureHistoryDesc', 'Every match. Every result. Every streak. Know exactly what you\'re walking into before the gates open.'), icon: '📜' },
              { title: t('about.featureTiers', 'Power Tier Rankings'), desc: t('about.featureTiersDesc', 'S-Tier elites to D-Tier underdogs. Instantly identify where any kingdom stands in the pecking order.'), icon: '🏆' },
            ].map((feature, i) => (
              <div key={i} style={{ 
                backgroundColor: '#111111', 
                padding: isMobile ? '1rem' : '1.25rem', 
                borderRadius: '10px',
                border: '1px solid #2a2a2a',
                display: 'flex',
                gap: '1rem',
                alignItems: 'flex-start'
              }}>
                <span style={{ fontSize: '1.5rem' }}>{feature.icon}</span>
                <div>
                  <h3 style={{ color: '#22d3ee', fontSize: isMobile ? '0.9rem' : '0.95rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                    {feature.title}
                  </h3>
                  <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.85rem' : '0.9rem', lineHeight: 1.6 }}>
                    {feature.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* How Atlas Score Works */}
        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ 
            fontSize: isMobile ? '1.1rem' : '1.25rem', 
            fontWeight: 'bold', 
            color: '#fff', 
            marginBottom: '1rem',
            fontFamily: FONT_DISPLAY
          }}>
            {t('about.atlasScoreTitle', "The Atlas Score: Your Kingdom's True Power Level")}
          </h2>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.9rem' : '0.95rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            {t('about.atlasScoreIntro', 'Stop guessing. Start winning. The Atlas Score measures what actually matters:')}{' '}<span style={{ color: '#22d3ee' }}>{t('about.consistentPerformance', 'consistent performance')}</span>{'. '}{t('about.atlasScoreIntro2', 'Our formula rewards experience, punishes lucky streaks, and shows who really dominates. Here\'s the breakdown:')}
          </p>
          
          <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {[
              { icon: '⚔️', title: t('about.baseScore', 'Base Score'), desc: t('about.baseScoreDesc', 'Combined Prep (45%) + Battle (55%) win rates with Bayesian adjustment. No inflated scores from lucky starts.'), color: '#22d3ee' },
              { icon: '👑', title: t('about.domInvasion', 'Domination/Invasion'), desc: t('about.domInvasionDesc', 'Dominations boost your score up to +15%. Invasions hurt equally. Rewards consistent double-phase performance.'), color: '#22c55e' },
              { icon: '🔥', title: t('about.recentForm', 'Recent Form'), desc: t('about.recentFormDesc', 'Last 5 KvKs weighted by recency. Domination=1.0, Comeback=0.80, Reversal=0.70, Invasion=0.'), color: '#eab308' },
              { icon: '⚡', title: t('about.streakBonus', 'Streak Bonus'), desc: t('about.streakBonusDesc', 'Current win streaks provide a boost. Battle: +1.1% per win (max 10). Prep: +1% per win (max 10).'), color: '#a855f7' },
            ].map((item, i) => (
              <div key={i} style={{ 
                display: 'flex', 
                alignItems: 'flex-start', 
                gap: '0.75rem',
                backgroundColor: '#111111',
                padding: '0.875rem',
                borderRadius: '8px',
                border: '1px solid #2a2a2a'
              }}>
                <span style={{ fontSize: '1.25rem' }}>{item.icon}</span>
                <div>
                  <div style={{ color: item.color, fontWeight: '600', fontSize: isMobile ? '0.85rem' : '0.9rem', marginBottom: '0.25rem' }}>{item.title}</div>
                  <div style={{ color: '#9ca3af', fontSize: isMobile ? '0.8rem' : '0.85rem', lineHeight: 1.5 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ 
            backgroundColor: '#0d1117', 
            padding: '1rem', 
            borderRadius: '8px', 
            border: '1px solid #22d3ee30',
            marginBottom: '1rem'
          }}>
            <div style={{ color: '#22d3ee', fontWeight: '600', fontSize: isMobile ? '0.85rem' : '0.9rem', marginBottom: '0.5rem' }}>
              {t('about.whyItWorks', 'Why It Works')}
            </div>
            <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.8rem' : '0.85rem', lineHeight: 1.6, margin: '0 0 0.5rem 0' }}>
              • <strong>{t('about.bayesianAdj', 'Bayesian adjustment:')}</strong> {t('about.bayesianAdjDesc', 'Pulls extreme rates toward 50% until you prove yourself')}
            </p>
            <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.8rem' : '0.85rem', lineHeight: 1.6, margin: '0 0 0.5rem 0' }}>
              • <strong>{t('about.expScaling', 'Experience scaling:')}</strong> {t('about.expScalingDesc', 'Full credit at 5+ KvKs—no shortcuts for newcomers')}
            </p>
            <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.8rem' : '0.85rem', lineHeight: 1.6, margin: 0 }}>
              • <strong>{t('about.multiplierStack', 'Multiplier stacking:')}</strong> {t('about.multiplierStackDesc', 'Dominations, form, and streaks compound your base score')}
            </p>
          </div>

          <p style={{ color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.85rem', lineHeight: 1.6 }}>
            {t('about.realData', 'Real data. Real results. No spin. That\'s how you know who to fear and who to target.')}
          </p>
        </section>

        {/* Tier Breakdown */}
        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ 
            fontSize: isMobile ? '1.1rem' : '1.25rem', 
            fontWeight: 'bold', 
            color: '#fff', 
            marginBottom: '1rem',
            fontFamily: FONT_DISPLAY
          }}>
            {t('about.tierSystemTitle', 'The Tier System: Where Does Your Kingdom Rank?')}
          </h2>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.9rem' : '0.95rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            {t('about.tierSystemDesc', 'Every kingdom earns their tier through battle. No politics, no favoritism\u2014just cold, hard results.')}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, 1fr)', gap: '0.75rem' }}>
            {[
              { tier: 'S', range: '57+', color: '#fbbf24', desc: t('about.tierS', 'Elite'), detail: t('about.tierSDetail', 'Top 3% - Apex predators') },
              { tier: 'A', range: '47-57', color: '#22c55e', desc: t('about.tierA', 'Formidable'), detail: t('about.tierADetail', 'Top 10% - Serious contenders') },
              { tier: 'B', range: '38-47', color: '#3b82f6', desc: t('about.tierB', 'Competitive'), detail: t('about.tierBDetail', 'Top 25% - Solid performers') },
              { tier: 'C', range: '29-38', color: '#f97316', desc: t('about.tierC', 'Developing'), detail: t('about.tierCDetail', 'Top 50% - Room to grow') },
              { tier: 'D', range: '0-29', color: '#ef4444', desc: t('about.tierD', 'Struggling'), detail: t('about.tierDDetail', 'Bottom 50% - Rebuilding') },
            ].map((tierItem, i) => (
              <div key={i} style={{ 
                backgroundColor: '#111111', 
                padding: '1rem', 
                borderRadius: '8px',
                border: `1px solid ${tierItem.color}30`,
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: tierItem.color, marginBottom: '0.25rem' }}>
                  {tierItem.tier}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>{tierItem.range}</div>
                <div style={{ fontSize: '0.8rem', color: tierItem.color, marginBottom: '0.25rem', fontWeight: '500' }}>{tierItem.desc}</div>
                <div style={{ fontSize: '0.7rem', color: '#6b7280', fontStyle: 'italic' }}>{tierItem.detail}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Origin Story */}
        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ 
            fontSize: isMobile ? '1.1rem' : '1.25rem', 
            fontWeight: 'bold', 
            color: '#fff', 
            marginBottom: '1rem',
            fontFamily: FONT_DISPLAY
          }}>
            {t('about.builtByPlayer', 'Built by a Player, For Players')}
          </h2>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.9rem' : '0.95rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            {t('about.originP1', 'Kingshot Atlas was born in')} <span style={{ color: '#22d3ee' }}>Kingdom 172</span>{'. '}{t('about.originP1b', 'The founder got tired of making transfer decisions based on rumors and Discord hearsay. Tired of walking into KvK blind. Tired of guessing.')}
          </p>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.9rem' : '0.95rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            {t('about.originP2', 'So he built the tool he wished existed: a place where every kingdom\'s track record is laid bare. Real data. Real results. No spin.')}
          </p>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.9rem' : '0.95rem', lineHeight: 1.7 }}>
            {t('about.originP3', 'Today, Atlas is powered by the community\u2014players contributing data, reporting results, and helping each other make smarter decisions. This isn\'t a corporate product. It\'s a passion project built by someone who plays the game and wants to see the community thrive.')}
          </p>
        </section>

        {/* Data & Disclaimer */}
        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ 
            fontSize: isMobile ? '1.1rem' : '1.25rem', 
            fontWeight: 'bold', 
            color: '#fff', 
            marginBottom: '1rem',
            fontFamily: FONT_DISPLAY
          }}>
            {t('about.finePrint', 'The Fine Print')}
          </h2>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.9rem' : '0.95rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            {t('about.finePrintDesc', 'Our data comes from community contributions and verified KvK results. We obsess over accuracy, but KvK is complex\u2014edge cases exist. If you spot an error, let us know.')}
          </p>
          <div style={{ 
            backgroundColor: '#111111', 
            padding: '1rem', 
            borderRadius: '8px', 
            border: '1px solid #2a2a2a',
            marginBottom: '1rem'
          }}>
            <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.85rem' : '0.9rem', lineHeight: 1.6, margin: 0 }}>
              <span style={{ color: '#22d3ee', fontWeight: '600' }}>{t('about.specialThanks', 'Special thanks')}</span>{' '}{t('about.to', 'to')}{' '}
              <a 
                href="https://www.reddit.com/r/KingShot/comments/1qc42ga/all_kvk_results_for_every_kingdom_rankings/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#f97316', textDecoration: 'none' }}
              >
                Cosmos (u/CosmosSolitarus)
              </a>
              {' '}{t('about.cosmosCredit', 'for compiling the original KvK History spreadsheet that made this project possible. Community effort at its finest.')}
            </p>
          </div>
          <p style={{ color: '#6b7280', fontSize: isMobile ? '0.85rem' : '0.9rem', lineHeight: 1.7, marginBottom: '0.75rem' }}>
            {t('about.disclaimer', 'Kingshot Atlas is an independent fan project. We\'re not affiliated with or endorsed by the developers of Kingshot. We\'re just players who love the game.')}
          </p>
          <p style={{ color: '#4b5563', fontSize: isMobile ? '0.75rem' : '0.8rem', lineHeight: 1.6 }}>
            {t('about.trademarkNotice', 'Kingshot is a trademark of Century Games. All game content and materials are trademarks and copyrights of Century Games and its licensors. Kingshot Atlas is not affiliated with, endorsed, sponsored, or approved by Century Games. All KvK data on this platform is community-sourced and user-submitted.')}
          </p>
        </section>

        {/* Transfer Hub */}
        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ 
            fontSize: isMobile ? '1.1rem' : '1.25rem', 
            fontWeight: 'bold', 
            color: '#fff', 
            marginBottom: '1rem',
            fontFamily: FONT_DISPLAY
          }}>
            {t('about.transferHubTitle', 'The Transfer Hub: No More Blind Transfers')}
          </h2>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.9rem' : '0.95rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            {t('about.transferHubDesc', 'Tired of asking "anyone know a good kingdom?" in Discord and getting 20 different answers? The')}{' '}<span style={{ color: '#22d3ee' }}>Transfer Hub</span>{' '}{t('about.transferHubDesc2', 'puts real data behind the biggest decision in Kingshot.')}
          </p>
          <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem' }}>
            {[
              { icon: '🚀', title: t('about.forPlayers', 'For Players Transferring'), desc: t('about.forPlayersDesc', 'Browse every kingdom with Atlas Scores, KvK records, and community reviews. Create a Transfer Profile, apply directly, and track your applications. Match Scores show which kingdoms fit your playstyle.'), color: '#22d3ee' },
              { icon: '📢', title: t('about.forRecruiters', 'For Recruiters'), desc: t('about.forRecruitersDesc', 'Claim your kingdom, set up your listing with requirements and vibe tags, and review incoming applications. Fund your listing to unlock better visibility and features like invites and priority placement.'), color: '#a855f7' },
            ].map((item, i) => (
              <div key={i} style={{ 
                display: 'flex', 
                alignItems: 'flex-start', 
                gap: '0.75rem',
                backgroundColor: '#111111',
                padding: '0.875rem',
                borderRadius: '8px',
                border: '1px solid #2a2a2a'
              }}>
                <span style={{ fontSize: '1.25rem' }}>{item.icon}</span>
                <div>
                  <div style={{ color: item.color, fontWeight: '600', fontSize: isMobile ? '0.85rem' : '0.9rem', marginBottom: '0.25rem' }}>{item.title}</div>
                  <div style={{ color: '#9ca3af', fontSize: isMobile ? '0.8rem' : '0.85rem', lineHeight: 1.5 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <p style={{ color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.85rem', lineHeight: 1.6 }}>
            {t('about.transferHubCTA', 'Real data. Real applications. No more guessing who\'s actually recruiting and who\'s worth joining.')}{' '}
            <Link to="/transfer-hub" style={{ color: '#22d3ee', textDecoration: 'none' }}>{t('about.checkItOut')}</Link>
          </p>
        </section>

        {/* Support Us */}
        <section style={{ 
          marginBottom: '2.5rem',
          backgroundColor: '#111111', 
          padding: isMobile ? '1.5rem' : '2rem', 
          borderRadius: '12px',
          border: '1px solid #FF6B8A30',
          textAlign: 'center',
          background: 'linear-gradient(135deg, #111111 0%, #FF6B8A08 100%)'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            margin: '0 auto 1rem',
            backgroundColor: '#FF6B8A20',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#FF6B8A">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          </div>
          <h2 style={{ 
            fontSize: isMobile ? '1.1rem' : '1.25rem', 
            fontWeight: 'bold', 
            color: '#fff', 
            marginBottom: '0.75rem',
            fontFamily: FONT_DISPLAY
          }}>
            {t('about.fuelAtlas', 'Fuel the Atlas')}
          </h2>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.85rem' : '0.9rem', lineHeight: 1.6, marginBottom: '1.25rem', maxWidth: '500px', margin: '0 auto 1.25rem' }}>
            {t('about.fuelDesc', 'Servers cost money. Development takes time. If Atlas has helped you make better decisions, consider throwing some support our way. Every bit helps keep the lights on and new features coming.')}
          </p>
          <SupportButton />
          <p style={{ 
            color: '#6b7280', 
            fontSize: '0.75rem', 
            marginTop: '1rem' 
          }}>
            {t('about.fuelFooter', 'Buy us a coffee, fund a feature, or just say thanks ☕')}
          </p>
        </section>

        {/* Contact */}
        <section style={{ 
          backgroundColor: '#111111', 
          padding: isMobile ? '1.25rem' : '1.5rem', 
          borderRadius: '12px',
          border: '1px solid #5865F230',
          textAlign: 'center'
        }}>
          <h2 style={{ 
            fontSize: isMobile ? '1rem' : '1.1rem', 
            fontWeight: 'bold', 
            color: '#fff', 
            marginBottom: '0.75rem',
            fontFamily: FONT_DISPLAY
          }}>
            {t('about.joinCommunity', 'Join the Community')}
          </h2>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.85rem' : '0.9rem', lineHeight: 1.6, marginBottom: '1rem' }}>
            {t('about.joinCommunityDesc', 'Got intel to share? Found a bug? Want to argue about tier rankings? Jump into our Discord. We\'re always looking for contributors, testers, and fellow data nerds.')}
          </p>
          <a
            href="https://discord.gg/cajcacDzGd"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              backgroundColor: '#5865F2',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontWeight: '600',
              fontSize: isMobile ? '0.9rem' : '0.95rem',
              textDecoration: 'none',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 15px rgba(88, 101, 242, 0.3)'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            {t('about.joinDiscord', 'Join Our Discord')}
          </a>
        </section>

        {/* Back Link */}
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <Link to="/" style={{ color: '#22d3ee', textDecoration: 'none', fontSize: '0.85rem' }}>{t('common.backToHome')}</Link>
        </div>
      </div>
    </div>
  );
};

export default About;
