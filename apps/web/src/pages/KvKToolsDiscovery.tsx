import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import BackLink from '../components/shared/BackLink';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useMetaTags, PAGE_META_TAGS } from '../hooks/useMetaTags';
import { useStructuredData, PAGE_BREADCRUMBS, KVK_TOOLS_FAQ_DATA } from '../hooks/useStructuredData';
import { neonGlow, FONT_DISPLAY } from '../utils/styles';
import { useTranslation } from 'react-i18next';
import { usePremium } from '../contexts/PremiumContext';
import { useAuth } from '../contexts/AuthContext';
import { useGoldKingdoms } from '../hooks/useGoldKingdoms';
import AuthModal from '../components/AuthModal';

interface ToolSection {
  id: string;
  phase: string;
  phaseColor: string;
  emoji: string;
  title: string;
  subtitle: string;
  whatItDoes: string;
  whenToUse: string;
  whyItMatters: string;
  primaryCta: { label: string; to: string };
  secondaryCta?: { label: string; to: string };
  tier: 'silver' | 'gold';
  accentColor: string;
}

const KvKToolsDiscovery: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('kvkTools.pageTitle', 'KvK Tools — Kingshot Atlas'));
  useMetaTags(PAGE_META_TAGS.kvkTools);
  useStructuredData({ type: 'BreadcrumbList', data: PAGE_BREADCRUMBS.kvkTools });
  useStructuredData({ type: 'FAQPage', data: KVK_TOOLS_FAQ_DATA });
  const isMobile = useIsMobile();
  const { isAdmin } = usePremium();
  const { profile } = useAuth();
  const goldKingdoms = useGoldKingdoms();

  const [showAuthModal, setShowAuthModal] = useState(false);
  const user = profile; // profile is null when not logged in
  const linkedKingdom = profile?.linked_kingdom;
  const isLinked = !!profile?.linked_player_id;
  const isGoldKingdom = !!(linkedKingdom && goldKingdoms.has(linkedKingdom));
  const fundPath = linkedKingdom ? `/kingdom/${linkedKingdom}/fund` : '/transfer-hub';

  const tools: ToolSection[] = [
    {
      id: 'prep-scheduler',
      phase: t('kvkTools.phasePrep', 'Prep Phase'),
      phaseColor: '#eab308',
      emoji: '📅',
      title: t('kvkTools.prepTitle', 'KvK Prep Scheduler'),
      subtitle: t('kvkTools.prepSubtitle', 'Organize your kingdom\'s Castle Appointments like a machine.'),
      whatItDoes: t('kvkTools.prepWhat', 'Collects player availability and speedup data, then auto-assigns optimal 30-minute buff slots for Construction, Research, and Training days.'),
      whenToUse: t('kvkTools.prepWhen', 'Monday through Saturday of KvK week, during Prep Phase. Create the schedule early, share the link, let players submit before the deadline.'),
      whyItMatters: t('kvkTools.prepWhy', 'Disorganized Prep Phases cost kingdoms hundreds of points. The scheduler ensures every slot goes to the player who brings the most value — not whoever messaged first.'),
      primaryCta: { label: t('kvkTools.prepCta', 'Open Prep Scheduler'), to: '/tools/prep-scheduler-info' },
      tier: 'silver',
      accentColor: '#eab308',
    },
    {
      id: 'battle-registry',
      phase: t('kvkTools.phaseBattlePrep', 'Battle Preparation'),
      phaseColor: '#f97316',
      emoji: '📋',
      title: t('kvkTools.registryTitle', 'KvK Battle Registry'),
      subtitle: t('kvkTools.registrySubtitle', 'Know exactly who\'s showing up — and what they\'re bringing.'),
      whatItDoes: t('kvkTools.registryWhat', 'Collects player time slot availability (12:00–17:00 UTC), troop tiers, and Truegold levels. Gives commanders a real-time dashboard of army composition.'),
      whenToUse: t('kvkTools.registryWhen', 'Mid-week before Castle Battle Saturday. Share the form link early so players can register their availability and troop data.'),
      whyItMatters: t('kvkTools.registryWhy', 'You can\'t plan rally waves if you don\'t know who has T11 cavalry at 14:00 UTC. The registry turns "how many do we have?" into hard numbers.'),
      primaryCta: { label: t('kvkTools.registryCta', 'Open Battle Registry'), to: '/tools/battle-registry-info' },
      tier: 'gold',
      accentColor: '#f97316',
    },
    {
      id: 'battle-tier-list',
      phase: t('kvkTools.phaseBattlePrep', 'Battle Preparation'),
      phaseColor: '#f97316',
      emoji: '🏆',
      title: t('kvkTools.tierListTitle', 'KvK Battle Tier List'),
      subtitle: t('kvkTools.tierListSubtitle', 'Rank your fighters by real combat power.'),
      whatItDoes: t('kvkTools.tierListWhat', 'Input scouted stats per player — Attack, Lethality, Defense, Health across Infantry, Cavalry, and Archer — with hero EG adjustments. Generates separate offense and defense tier rankings.'),
      whenToUse: t('kvkTools.tierListWhen', 'Before battle day. Use scouted data to identify your strongest rally leaders, garrison anchors, and which players to prioritize in castle hits.'),
      whyItMatters: t('kvkTools.tierListWhy', 'Not all T11 players are equal. EG levels, stat distribution, and hero composition create massive power gaps. This tool surfaces who actually hits hardest.'),
      primaryCta: { label: t('kvkTools.tierListCta', 'Open Tier List'), to: '/tools/battle-tier-list/about' },
      tier: 'gold',
      accentColor: '#f97316',
    },
    {
      id: 'battle-layout',
      phase: t('kvkTools.phaseCastleBattle', 'Castle Battle'),
      phaseColor: '#ef4444',
      emoji: '🗺️',
      title: t('kvkTools.layoutTitle', 'KvK Battle Layout'),
      subtitle: t('kvkTools.layoutSubtitle', 'Plan your teleport positions before the fight starts.'),
      whatItDoes: t('kvkTools.layoutWhat', 'Visual map tool for positioning alliances around the Castle and four Turrets. Place, name, and color-code alliance cities. Drag to reposition. Auto-saves your layout.'),
      whenToUse: t('kvkTools.layoutWhen', 'Before Castle Battle. Coordinate which alliances teleport where — who hits the castle, who holds turrets, who reinforces.'),
      whyItMatters: t('kvkTools.layoutWhy', 'Teleporting blind means wasted marches and overlapping positions. A shared visual layout gives every alliance leader a clear assignment before the timer starts.'),
      primaryCta: { label: t('kvkTools.layoutCta', 'Open Battle Layout'), to: '/tools/battle-layout/about' },
      tier: 'gold',
      accentColor: '#f97316',
    },
    {
      id: 'battle-planner',
      phase: t('kvkTools.phaseCastleBattle', 'Castle Battle'),
      phaseColor: '#ef4444',
      emoji: '⚔️',
      title: t('kvkTools.plannerTitle', 'KvK Battle Planner'),
      subtitle: t('kvkTools.plannerSubtitle', 'Time your rallies to land together.'),
      whatItDoes: t('kvkTools.plannerWhat', 'Manage ally and enemy player databases, set march times per building, and create rally queues with precise timing. Gantt timelines show exactly when each rally hits.'),
      whenToUse: t('kvkTools.plannerWhen', 'During Castle Battle (12:00–17:00 UTC Saturday). Live coordination tool for rally leaders — plan simultaneous hits, counter-rallies, and chain attacks.'),
      whyItMatters: t('kvkTools.plannerWhy', 'A single poorly-timed rally gives the enemy time to reinforce. Synchronized multi-rallies overwhelm defenders. The planner ensures your waves land within seconds of each other.'),
      primaryCta: { label: t('kvkTools.plannerCta', 'Open Battle Planner'), to: '/tools/battle-planner' },
      tier: 'gold',
      accentColor: '#f97316',
    },
  ];

  const timelinePhases = [
    { label: t('kvkTools.tlPrep', 'Prep Phase'), color: '#eab308', days: t('kvkTools.tlPrepDays', 'Mon–Sat'), tools: ['📅'] },
    { label: t('kvkTools.tlBattlePrep', 'Battle Prep'), color: '#f97316', days: t('kvkTools.tlBattlePrepDays', 'Mid-week'), tools: ['📋', '🏆'] },
    { label: t('kvkTools.tlCastleBattle', 'Castle Battle'), color: '#ef4444', days: t('kvkTools.tlCastleDays', 'Saturday'), tools: ['🗺️', '⚔️'] },
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
            borderRadius: '50%', backgroundColor: '#22d3ee15',
            border: '2px solid #22d3ee30',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.25rem',
            boxShadow: '0 0 30px rgba(34, 211, 238, 0.15), 0 0 60px rgba(34, 211, 238, 0.08)',
          }}>
            <span style={{ fontSize: isMobile ? '1.75rem' : '2.25rem' }}>🛡️</span>
          </div>

          <h1 style={{
            fontSize: isMobile ? '1.75rem' : '2.5rem', fontWeight: 'bold',
            marginBottom: '0.75rem', fontFamily: FONT_DISPLAY,
          }}>
            <span style={{ color: '#fff' }}>{t('kvkTools.heroTitle1', 'KvK')}</span>
            <span style={{ ...neonGlow('#22d3ee'), marginLeft: '0.5rem' }}>{t('kvkTools.heroTitle2', 'TOOLS')}</span>
          </h1>
          <p style={{
            color: '#9ca3af', fontSize: isMobile ? '0.95rem' : '1.1rem',
            maxWidth: '540px', margin: '0 auto 1.5rem', lineHeight: 1.6,
          }}>
            {t('kvkTools.heroSubtitle', 'Five tools. One KvK week. From Prep Phase scheduling to Castle Battle rally timing — every stage of KvK has a tool built for it.')}
          </p>

          {!isMobile && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
              <div style={{ width: '50px', height: '2px', background: 'linear-gradient(90deg, transparent, #22d3ee)' }} />
              <div style={{ width: '6px', height: '6px', backgroundColor: '#22d3ee', transform: 'rotate(45deg)', boxShadow: '0 0 8px #22d3ee' }} />
              <div style={{ width: '50px', height: '2px', background: 'linear-gradient(90deg, #22d3ee, transparent)' }} />
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: isMobile ? '0.5rem 1rem' : '0.5rem 2rem' }}>

        {/* KvK Week Timeline */}
        <div style={{
          marginBottom: isMobile ? '2rem' : '2.5rem',
          padding: isMobile ? '1rem' : '1.25rem',
          backgroundColor: '#111111', borderRadius: '12px',
          border: '1px solid #2a2a2a',
        }}>
          <h2 style={{
            fontSize: isMobile ? '0.85rem' : '0.95rem', fontWeight: 700,
            color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em',
            marginBottom: '0.75rem', textAlign: 'center',
          }}>
            {t('kvkTools.timelineTitle', 'KvK Week Timeline')}
          </h2>
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? '0.5rem' : '0',
            alignItems: 'stretch',
          }}>
            {timelinePhases.map((phase, i) => (
              <div key={phase.label} style={{
                flex: 1,
                display: 'flex',
                flexDirection: isMobile ? 'row' : 'column',
                alignItems: 'center',
                gap: isMobile ? '0.75rem' : '0.35rem',
                padding: isMobile ? '0.6rem 0.75rem' : '0.5rem 0.25rem',
                position: 'relative',
                borderLeft: isMobile ? `3px solid ${phase.color}` : 'none',
                borderBottom: !isMobile && i < timelinePhases.length - 1 ? 'none' : 'none',
              }}>
                {!isMobile && (
                  <div style={{
                    width: '100%', height: '3px',
                    background: `linear-gradient(90deg, ${i === 0 ? 'transparent' : timelinePhases[i - 1]!.color}, ${phase.color})`,
                    borderRadius: '2px', marginBottom: '0.25rem',
                  }} />
                )}
                {isMobile ? (
                  <>
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: phase.color }}>
                        {phase.label}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#6b7280' }}>
                        {phase.days}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      {phase.tools.map((e) => <span key={e} style={{ fontSize: '0.9rem' }}>{e}</span>)}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      {phase.tools.map((e) => <span key={e} style={{ fontSize: '1rem' }}>{e}</span>)}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: phase.color }}>
                        {phase.label}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#6b7280' }}>
                        {phase.days}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tool Sections */}
        {tools.map((tool) => {
          const hasAccess = tool.tier === 'silver'
            ? (isGoldKingdom || isAdmin)
            : (isGoldKingdom || isAdmin);
          const showFundCta = !hasAccess && !isAdmin;
          const tierLabel = tool.tier === 'silver' ? 'Silver+ Tier' : 'Gold Tier';
          const tierColor = tool.tier === 'silver' ? '#c0c0c0' : '#ffc30b';

          return (
            <div key={tool.id} style={{
              marginBottom: isMobile ? '1.5rem' : '2rem',
              backgroundColor: '#111111', borderRadius: '16px',
              border: `1px solid ${tool.accentColor}25`,
              overflow: 'hidden',
              transition: 'border-color 0.2s ease',
            }}>
              {/* Phase label bar */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: isMobile ? '0.6rem 1rem' : '0.5rem 1.25rem',
                backgroundColor: `${tool.phaseColor}08`,
                borderBottom: `1px solid ${tool.accentColor}15`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    backgroundColor: tool.phaseColor,
                    boxShadow: `0 0 6px ${tool.phaseColor}80`,
                  }} />
                  <span style={{
                    fontSize: '0.65rem', fontWeight: 700,
                    color: tool.phaseColor, textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    {tool.phase}
                  </span>
                </div>
                <span style={{
                  fontSize: '0.6rem', fontWeight: 700,
                  color: tierColor,
                  backgroundColor: `${tierColor}15`,
                  border: `1px solid ${tierColor}30`,
                  padding: '0.15rem 0.5rem', borderRadius: '4px',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  {hasAccess ? t('kvkTools.unlocked', '✓ Unlocked') : tierLabel}
                </span>
              </div>

              {/* Content */}
              <div style={{ padding: isMobile ? '1rem' : '1.25rem 1.5rem', textAlign: 'center' }}>
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{
                    width: isMobile ? '42px' : '48px', height: isMobile ? '42px' : '48px',
                    borderRadius: '10px', backgroundColor: `${tool.accentColor}12`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: isMobile ? '1.25rem' : '1.5rem',
                    margin: '0 auto 0.5rem',
                  }}>
                    {tool.emoji}
                  </div>
                  <h2 style={{
                    fontSize: isMobile ? '1.1rem' : '1.25rem', fontWeight: 'bold',
                    color: '#fff', marginBottom: '0.2rem', fontFamily: FONT_DISPLAY,
                  }}>
                    {tool.title}
                  </h2>
                  <p style={{
                    fontSize: isMobile ? '0.8rem' : '0.85rem',
                    color: tool.accentColor, fontWeight: 600, fontStyle: 'italic',
                  }}>
                    {tool.subtitle}
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem', textAlign: 'left' }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {t('kvkTools.whatItDoes', 'What it does')}
                    </span>
                    <p style={{ fontSize: isMobile ? '0.8rem' : '0.85rem', color: '#d1d5db', lineHeight: 1.55, marginTop: '0.15rem' }}>
                      {tool.whatItDoes}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {t('kvkTools.whenToUse', 'When to use it')}
                    </span>
                    <p style={{ fontSize: isMobile ? '0.8rem' : '0.85rem', color: '#d1d5db', lineHeight: 1.55, marginTop: '0.15rem' }}>
                      {tool.whenToUse}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {t('kvkTools.whyItMatters', 'Why it matters')}
                    </span>
                    <p style={{ fontSize: isMobile ? '0.8rem' : '0.85rem', color: '#d1d5db', lineHeight: 1.55, marginTop: '0.15rem' }}>
                      {tool.whyItMatters}
                    </p>
                  </div>
                </div>

                {/* CTAs */}
                <div style={{
                  display: 'flex', flexDirection: isMobile ? 'column' : 'row',
                  gap: '0.6rem', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Link
                    to={tool.primaryCta.to}
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                      padding: isMobile ? '0.7rem 1.25rem' : '0.65rem 1.25rem',
                      backgroundColor: tool.accentColor,
                      border: 'none', borderRadius: '8px',
                      color: '#fff', fontWeight: 700,
                      fontSize: isMobile ? '0.85rem' : '0.9rem', textDecoration: 'none',
                      width: isMobile ? '100%' : 'auto',
                      transition: 'all 0.2s ease',
                      boxShadow: `0 4px 15px ${tool.accentColor}30`,
                    }}
                  >
                    {tool.emoji} {tool.primaryCta.label}
                  </Link>
                  {showFundCta && !user && (
                    <button
                      onClick={() => setShowAuthModal(true)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                        padding: '0.6rem 1.1rem',
                        backgroundColor: 'transparent',
                        border: `1px solid ${tierColor}40`,
                        borderRadius: '8px',
                        color: tierColor, fontWeight: 600,
                        fontSize: isMobile ? '0.8rem' : '0.85rem',
                        width: isMobile ? '100%' : 'auto',
                        cursor: 'pointer',
                      }}
                    >
                      {t('kvkTools.loginToFund', 'Log In to Fund Your Kingdom')}
                    </button>
                  )}
                  {showFundCta && user && !isLinked && (
                    <Link
                      to="/profile#link-kingshot-section"
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                        padding: '0.6rem 1.1rem',
                        backgroundColor: 'transparent',
                        border: `1px solid ${tierColor}40`,
                        borderRadius: '8px',
                        color: tierColor, fontWeight: 600,
                        fontSize: isMobile ? '0.8rem' : '0.85rem', textDecoration: 'none',
                        width: isMobile ? '100%' : 'auto',
                      }}
                    >
                      {t('kvkTools.linkToFund', 'Link Your Player ID to Fund Your Kingdom')}
                    </Link>
                  )}
                  {showFundCta && user && isLinked && (
                    <Link
                      to={fundPath}
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                        padding: '0.6rem 1.1rem',
                        backgroundColor: 'transparent',
                        border: `1px solid ${tierColor}40`,
                        borderRadius: '8px',
                        color: tierColor, fontWeight: 600,
                        fontSize: isMobile ? '0.8rem' : '0.85rem', textDecoration: 'none',
                        width: isMobile ? '100%' : 'auto',
                      }}
                    >
                      {t('kvkTools.fundKingdom', 'Fund Your Kingdom')}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Silver vs Gold Summary */}
        <div style={{
          marginBottom: isMobile ? '2rem' : '2.5rem',
          padding: isMobile ? '1.25rem' : '1.5rem',
          backgroundColor: '#111111', borderRadius: '16px',
          border: '1px solid #2a2a2a',
        }}>
          <h2 style={{
            fontSize: isMobile ? '1rem' : '1.15rem', fontWeight: 'bold',
            color: '#fff', marginBottom: '0.75rem', fontFamily: FONT_DISPLAY,
            textAlign: 'center',
          }}>
            {t('kvkTools.accessTitle', 'What unlocks at each tier?')}
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: isMobile ? '0.75rem' : '1rem',
          }}>
            {/* Silver */}
            <div style={{
              padding: '1rem', borderRadius: '12px',
              border: '1px solid #c0c0c025',
              background: 'linear-gradient(135deg, #0a0a0a 0%, #c0c0c006 100%)',
            }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                marginBottom: '0.6rem',
              }}>
                <span style={{ fontSize: '0.75rem' }}>🥈</span>
                <span style={{
                  fontSize: '0.7rem', fontWeight: 700, color: '#c0c0c0',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  {t('kvkTools.silverTier', 'Silver Tier')}
                </span>
                <span style={{ fontSize: '0.65rem', color: '#6b7280' }}>($50+)</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.8rem' }}>📅</span>
                  <span style={{ fontSize: isMobile ? '0.8rem' : '0.85rem', color: '#d1d5db' }}>
                    {t('kvkTools.silverTool1', 'KvK Prep Scheduler')}
                  </span>
                </div>
              </div>
            </div>

            {/* Gold */}
            <div style={{
              padding: '1rem', borderRadius: '12px',
              border: '1px solid #ffc30b25',
              background: 'linear-gradient(135deg, #0a0a0a 0%, #ffc30b06 100%)',
            }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                marginBottom: '0.6rem',
              }}>
                <span style={{ fontSize: '0.75rem' }}>🥇</span>
                <span style={{
                  fontSize: '0.7rem', fontWeight: 700, color: '#ffc30b',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  {t('kvkTools.goldTier', 'Gold Tier')}
                </span>
                <span style={{ fontSize: '0.65rem', color: '#6b7280' }}>($100+)</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {[
                  { emoji: '📅', label: t('kvkTools.goldTool1', 'KvK Prep Scheduler') },
                  { emoji: '📋', label: t('kvkTools.goldTool2', 'KvK Battle Registry') },
                  { emoji: '🏆', label: t('kvkTools.goldTool3', 'KvK Battle Tier List') },
                  { emoji: '🗺️', label: t('kvkTools.goldTool4', 'KvK Battle Layout') },
                  { emoji: '⚔️', label: t('kvkTools.goldTool5', 'KvK Battle Planner') },
                ].map((item) => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.8rem' }}>{item.emoji}</span>
                    <span style={{ fontSize: isMobile ? '0.8rem' : '0.85rem', color: '#d1d5db' }}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Fund CTA */}
          {!isGoldKingdom && !isAdmin && (
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <p style={{
                color: '#9ca3af', fontSize: isMobile ? '0.8rem' : '0.85rem',
                marginBottom: '0.75rem', lineHeight: 1.5,
              }}>
                {t('kvkTools.fundPitch', 'Kingdom Fund contributions from your alliance members add up fast. Rally your R4s — collective investment unlocks elite tools for everyone.')}
              </p>
              {!user ? (
                <button
                  onClick={() => setShowAuthModal(true)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.7rem 1.5rem',
                    backgroundColor: '#ffc30b',
                    border: 'none', borderRadius: '8px',
                    color: '#0a0a0a', fontWeight: 700,
                    fontSize: isMobile ? '0.85rem' : '0.9rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 15px rgba(255, 195, 11, 0.3)',
                  }}
                >
                  {t('kvkTools.loginToFund', 'Log In to Fund Your Kingdom')}
                </button>
              ) : !isLinked ? (
                <Link
                  to="/profile#link-kingshot-section"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.7rem 1.5rem',
                    backgroundColor: '#ffc30b',
                    border: 'none', borderRadius: '8px',
                    color: '#0a0a0a', fontWeight: 700,
                    fontSize: isMobile ? '0.85rem' : '0.9rem', textDecoration: 'none',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 15px rgba(255, 195, 11, 0.3)',
                  }}
                >
                  {t('kvkTools.linkToFund', 'Link Your Player ID to Fund Your Kingdom')}
                </Link>
              ) : (
                <Link
                  to={fundPath}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.7rem 1.5rem',
                    backgroundColor: '#ffc30b',
                    border: 'none', borderRadius: '8px',
                    color: '#0a0a0a', fontWeight: 700,
                    fontSize: isMobile ? '0.85rem' : '0.9rem', textDecoration: 'none',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 15px rgba(255, 195, 11, 0.3)',
                  }}
                >
                  {t('kvkTools.fundKingdom', 'Fund Your Kingdom')}
                </Link>
              )}
            </div>
          )}
          {(isGoldKingdom || isAdmin) && (
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <p style={{
                color: '#22c55e', fontSize: isMobile ? '0.8rem' : '0.85rem',
                fontWeight: 600,
              }}>
                ✓ {t('kvkTools.fullAccessMsg', 'Your kingdom has full access to all KvK tools.')}
              </p>
            </div>
          )}
        </div>

        {/* Back links */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', paddingBottom: '1rem', flexWrap: 'wrap' }}>
          <BackLink to="/tools" label={t('common.allTools', 'All Tools')} />
          <BackLink to="/" label={t('common.backToHome', 'Home')} variant="secondary" />
        </div>
      </div>
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
};

export default KvKToolsDiscovery;
