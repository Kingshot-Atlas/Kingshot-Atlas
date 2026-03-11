import React from 'react';
import { Link } from 'react-router-dom';
import BackLink from '../components/shared/BackLink';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useMetaTags, PAGE_META_TAGS } from '../hooks/useMetaTags';
import { neonGlow, FONT_DISPLAY } from '../utils/styles';

const AllianceCenterLanding: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('allianceCenterLanding.pageTitle', 'Alliance Center'));
  useMetaTags(PAGE_META_TAGS.allianceCenter);
  const isMobile = useIsMobile();

  const features = [
    {
      icon: '🏗️',
      title: t('allianceCenterLanding.featBaseDesigner', 'Alliance Base Designer'),
      desc: t('allianceCenterLanding.featBaseDesignerDesc', 'Plan your alliance base layout on an isometric grid. Drag-and-drop buildings, assign player positions, and share the blueprint with leadership.'),
    },
    {
      icon: '📅',
      title: t('allianceCenterLanding.featEventCoordinator', 'Alliance Event Coordinator'),
      desc: t('allianceCenterLanding.featEventCoordinatorDesc', 'Find the best times for alliance events. Members submit their available play times — managers see the most active time slots at a glance.'),
    },
    {
      icon: '🐻',
      title: t('allianceCenterLanding.featBearRally', 'Bear Rally Tier List'),
      desc: t('allianceCenterLanding.featBearRallyDesc', 'Rank your alliance members by Bear Hunt rally power. Scout stats go in, tier rankings come out. Know exactly who your strongest hitters are.'),
    },
    {
      icon: '👥',
      title: t('allianceCenterLanding.featRoster', 'Alliance Roster'),
      desc: t('allianceCenterLanding.featRosterDesc', 'Up to 100 members in one place. Import by player ID, search Atlas users, track troop tiers, TC levels, and availability — all auto-resolved from game data.'),
    },
    {
      icon: '📩',
      title: t('allianceCenterLanding.featApplications', 'Alliance Applications'),
      desc: t('allianceCenterLanding.featApplicationsDesc', 'Players can apply to join your alliance directly through Atlas. Review applications, approve or reject in bulk, and keep a full history.'),
    },
    {
      icon: '📊',
      title: t('allianceCenterLanding.featCharts', 'Alliance Analytics'),
      desc: t('allianceCenterLanding.featChartsDesc', 'See your alliance at a glance with distribution charts for TC levels, troop tiers, and member activity. Data-driven decisions, not gut feelings.'),
    },
    {
      icon: '🔑',
      title: t('allianceCenterLanding.featAccess', 'Delegated Access Control'),
      desc: t('allianceCenterLanding.featAccessDesc', 'Alliance leaders control who can manage tools and settings. Delegate responsibilities to up to 5 managers without losing oversight.'),
    },
    {
      icon: '🔗',
      title: t('allianceCenterLanding.featOneHub', 'One Link, One Hub'),
      desc: t('allianceCenterLanding.featOneHubDesc', 'Stop juggling spreadsheets, Discord channels, and side apps. The Alliance Center brings everything your alliance needs into one place.'),
    },
  ];

  const steps = [
    {
      num: '1',
      icon: '🏰',
      title: t('allianceCenterLanding.step1Title', 'Create Your Alliance Center'),
      desc: t('allianceCenterLanding.step1Desc', 'Supporters, Consuls, or Boosters create the Alliance Center for their alliance. One click and your hub is live.'),
    },
    {
      num: '2',
      icon: '👥',
      title: t('allianceCenterLanding.step2Title', 'Your Alliance Joins In'),
      desc: t('allianceCenterLanding.step2Desc', 'Once created, anyone in your alliance roster can access the Alliance Center. No extra subscriptions needed.'),
    },
    {
      num: '3',
      icon: '⚡',
      title: t('allianceCenterLanding.step3Title', 'Coordinate Everything'),
      desc: t('allianceCenterLanding.step3Desc', 'Design your base, schedule events, rank rally hitters, manage your roster — all from one dashboard. Your alliance, organized.'),
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
            borderRadius: '50%', backgroundColor: '#3b82f615',
            border: '2px solid #3b82f630',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.25rem',
            boxShadow: '0 0 30px rgba(59, 130, 246, 0.15), 0 0 60px rgba(59, 130, 246, 0.08)',
          }}>
            <span style={{ fontSize: isMobile ? '1.75rem' : '2.25rem' }}>🏰</span>
          </div>

          <h1 style={{
            fontSize: isMobile ? '1.75rem' : '2.5rem', fontWeight: 'bold',
            marginBottom: '0.75rem', fontFamily: FONT_DISPLAY,
          }}>
            <span style={{ color: '#fff' }}>{t('allianceCenterLanding.heroTitle1', 'ALLIANCE')}</span>
            <span style={{ ...neonGlow('#3b82f6'), marginLeft: '0.5rem' }}>{t('allianceCenterLanding.heroTitle2', 'CENTER')}</span>
          </h1>
          <p style={{
            color: '#9ca3af', fontSize: isMobile ? '0.95rem' : '1.1rem',
            maxWidth: '520px', margin: '0 auto 1.5rem', lineHeight: 1.6,
          }}>
            {t('allianceCenterLanding.heroSubtitle', 'The must-have hub for alliance leaders who want to be efficient. Design your base, coordinate events, rank your rally hitters, and manage your roster — all from one dashboard.')}
          </p>

          {/* CTA */}
          <div style={{
            display: 'flex', flexDirection: isMobile ? 'column' : 'row',
            gap: '0.75rem', justifyContent: 'center', alignItems: 'center',
          }}>
            <Link
              to="/alliance-center"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
                padding: isMobile ? '0.85rem 1.75rem' : '0.9rem 2rem',
                backgroundColor: '#3b82f6', border: 'none', borderRadius: '10px',
                color: '#fff', fontWeight: 700,
                fontSize: isMobile ? '0.95rem' : '1rem', textDecoration: 'none',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 20px rgba(59, 130, 246, 0.35)',
              }}
            >
              🏰 {t('allianceCenterLanding.openCenter', 'Open Alliance Center')}
            </Link>
          </div>
          <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.75rem' }}>
            {t('allianceCenterLanding.accessNote', 'Supporters, Consuls, and Boosters can create an Alliance Center. Once created, all alliance members can access it.')}
          </p>

          {!isMobile && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
              <div style={{ width: '50px', height: '2px', background: 'linear-gradient(90deg, transparent, #3b82f6)' }} />
              <div style={{ width: '6px', height: '6px', backgroundColor: '#3b82f6', transform: 'rotate(45deg)', boxShadow: '0 0 8px #3b82f6' }} />
              <div style={{ width: '50px', height: '2px', background: 'linear-gradient(90deg, #3b82f6, transparent)' }} />
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
            <span style={{ color: '#fff' }}>{t('allianceCenterLanding.howItWorks1', 'HOW IT')}</span>
            <span style={{ ...neonGlow('#3b82f6'), marginLeft: '0.4rem' }}>{t('allianceCenterLanding.howItWorks2', 'WORKS')}</span>
          </h2>
          <p style={{
            color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.85rem',
            textAlign: 'center', marginBottom: '1.5rem',
          }}>
            {t('allianceCenterLanding.threeSteps', 'Three steps. Your alliance, fully organized.')}
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
                  backgroundColor: '#3b82f615', border: '1px solid #3b82f630',
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
            <span style={{ color: '#fff' }}>{t('allianceCenterLanding.builtFor1', 'BUILT FOR')}</span>
            <span style={{ ...neonGlow('#3b82f6'), marginLeft: '0.4rem' }}>{t('allianceCenterLanding.builtFor2', 'ALLIANCE LEADERS')}</span>
          </h2>
          <p style={{
            color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.85rem',
            textAlign: 'center', marginBottom: '1.5rem',
          }}>
            {t('allianceCenterLanding.featuresSubtitle', 'Everything your alliance needs to coordinate, all under one roof.')}
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
          border: '1px solid #3b82f630', padding: isMobile ? '1.25rem' : '1.75rem',
          background: 'linear-gradient(135deg, #111111 0%, #3b82f608 100%)',
        }}>
          <h2 style={{
            fontSize: isMobile ? '1.05rem' : '1.2rem', fontWeight: 'bold', color: '#fff',
            marginBottom: '1rem', fontFamily: FONT_DISPLAY,
          }}>
            {t('allianceCenterLanding.problemTitle', 'Your alliance tools are scattered across 5 different apps.')}
          </h2>
          <p style={{ color: '#d1d5db', fontSize: isMobile ? '0.85rem' : '0.9rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            {t('allianceCenterLanding.problemDesc', "Base plans in a Google Doc. Event times in a spreadsheet. Roster in a Discord channel. Nobody knows where anything is. Half the alliance misses the memo because it was posted in the wrong place.")}
          </p>
          <p style={{ color: '#d1d5db', fontSize: isMobile ? '0.85rem' : '0.9rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            {t('allianceCenterLanding.solutionDesc', "The Alliance Center puts everything in one place. Design your base, find the best event times, rank your Bear Hunt ralliers, manage your roster — all from a single dashboard that everyone in the alliance can access. No more hunting for links. No more outdated spreadsheets.")}
          </p>
          <p style={{ color: '#3b82f6', fontSize: isMobile ? '0.8rem' : '0.85rem', fontWeight: 600, fontStyle: 'italic' }}>
            {t('allianceCenterLanding.punchline', "One hub. Full control. Zero chaos.")}
          </p>
        </div>

        {/* Access Explainer */}
        <div style={{
          marginBottom: isMobile ? '2rem' : '3rem',
          padding: isMobile ? '1.5rem' : '2rem',
          backgroundColor: '#111111', borderRadius: '16px',
          border: '1px solid #3b82f630', textAlign: 'center',
          background: 'linear-gradient(135deg, #111111 0%, #3b82f608 100%)',
        }}>
          <span style={{
            fontSize: '0.65rem', fontWeight: 700,
            color: '#3b82f6',
            backgroundColor: '#3b82f618',
            border: '1px solid #3b82f630',
            padding: '0.2rem 0.6rem', borderRadius: '4px',
            letterSpacing: '0.05em', textTransform: 'uppercase',
            display: 'inline-block', marginBottom: '0.75rem',
          }}>
            {t('allianceCenterLanding.accessBadge', 'Who Can Access')}
          </span>
          <h3 style={{
            fontSize: isMobile ? '1.1rem' : '1.25rem', fontWeight: 'bold',
            color: '#fff', marginBottom: '0.5rem', fontFamily: FONT_DISPLAY,
          }}>
            {t('allianceCenterLanding.accessTitle', 'Created by leaders. Accessed by everyone.')}
          </h3>
          <p style={{
            color: '#9ca3af', fontSize: isMobile ? '0.8rem' : '0.85rem',
            marginBottom: '1.25rem', maxWidth: '500px', margin: '0 auto 1.25rem', lineHeight: 1.6,
          }}>
            {t('allianceCenterLanding.accessDesc', 'Supporters, Consuls, and Boosters can create an Alliance Center for their respective alliance. Once it\'s set up, every member on the alliance roster gets access automatically. One person creates it — the whole alliance benefits.')}
          </p>

          <div style={{
            display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '0.75rem',
            maxWidth: '500px', margin: '0 auto 1.5rem',
          }}>
            {[
              { label: t('allianceCenterLanding.roleSupporter', 'Supporters'), icon: '💎' },
              { label: t('allianceCenterLanding.roleConsul', 'Consuls'), icon: '🏛️' },
              { label: t('allianceCenterLanding.roleBooster', 'Boosters'), icon: '🚀' },
            ].map((role) => (
              <div key={role.label} style={{
                backgroundColor: '#0a0a0a', borderRadius: '10px', border: '1px solid #2a2a2a',
                padding: '0.75rem', textAlign: 'center',
              }}>
                <div style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{role.icon}</div>
                <div style={{ color: '#e5e7eb', fontSize: '0.8rem', fontWeight: 600 }}>{role.label}</div>
                <div style={{ color: '#6b7280', fontSize: '0.65rem', marginTop: '0.15rem' }}>
                  {t('allianceCenterLanding.canCreate', 'Can create')}
                </div>
              </div>
            ))}
          </div>

          <div style={{
            display: 'flex', flexDirection: isMobile ? 'column' : 'row',
            gap: '0.75rem', justifyContent: 'center', alignItems: 'center',
          }}>
            <Link
              to="/alliance-center"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.75rem 1.5rem', backgroundColor: '#3b82f6',
                border: 'none', borderRadius: '8px', color: '#fff',
                fontWeight: 600, fontSize: isMobile ? '0.9rem' : '0.95rem',
                textDecoration: 'none', transition: 'all 0.2s ease',
                boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)',
              }}
            >
              🏰 {t('allianceCenterLanding.openCenter', 'Open Alliance Center')}
            </Link>
            <Link
              to="/tools"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.75rem 1.5rem', backgroundColor: 'transparent',
                border: '1px solid #3b82f640', borderRadius: '8px',
                color: '#3b82f6', fontWeight: 600,
                fontSize: isMobile ? '0.9rem' : '0.95rem', textDecoration: 'none',
              }}
            >
              {t('allianceCenterLanding.viewAllTools', 'View All Tools')}
            </Link>
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

export default AllianceCenterLanding;
