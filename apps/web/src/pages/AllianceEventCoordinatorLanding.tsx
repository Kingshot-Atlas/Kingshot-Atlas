import React from 'react';
import { Link } from 'react-router-dom';
import BackLink from '../components/shared/BackLink';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useMetaTags, PAGE_META_TAGS } from '../hooks/useMetaTags';
import { useStructuredData, PAGE_BREADCRUMBS } from '../hooks/useStructuredData';
import { neonGlow, FONT_DISPLAY } from '../utils/styles';

const AllianceEventCoordinatorLanding: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('eventCoordinatorLanding.pageTitle', 'Alliance Event Coordinator — Kingshot Atlas'));
  useMetaTags(PAGE_META_TAGS.eventCoordinator);
  useStructuredData({ type: 'BreadcrumbList', data: PAGE_BREADCRUMBS.eventCoordinator });
  const isMobile = useIsMobile();

  const features = [
    {
      icon: '📅',
      title: t('eventCoordinatorLanding.featSchedule', 'Time Slot Scheduling'),
      desc: t('eventCoordinatorLanding.featScheduleDesc', 'Members select their available 30-minute time slots for each day of the week. UTC-based with automatic local time display — no timezone confusion.'),
    },
    {
      icon: '🔥',
      title: t('eventCoordinatorLanding.featHeatmap', 'Availability Heatmap'),
      desc: t('eventCoordinatorLanding.featHeatmapDesc', 'Managers see a color-coded heatmap of alliance availability. Instantly spot the time slots where the most members are online and ready.'),
    },
    {
      icon: '⏰',
      title: t('eventCoordinatorLanding.featTimezone', 'Timezone-Aware'),
      desc: t('eventCoordinatorLanding.featTimezoneDesc', 'Every member sees slots in their own local time. Data is stored in UTC so everyone is on the same page — no more "wait, was that my time or server time?"'),
    },
    {
      icon: '🎯',
      title: t('eventCoordinatorLanding.featBestSlot', 'Best Slot Finder'),
      desc: t('eventCoordinatorLanding.featBestSlotDesc', 'Atlas highlights the top time slots with the most overlap. Stop guessing when to schedule Bear Hunts, Swordland, or Tri-Alliance events.'),
    },
    {
      icon: '👥',
      title: t('eventCoordinatorLanding.featMemberView', 'Per-Member Breakdown'),
      desc: t('eventCoordinatorLanding.featMemberViewDesc', 'See exactly who is available in each time slot. Plan rally lineups and event rosters based on real availability — not assumptions.'),
    },
    {
      icon: '🔒',
      title: t('eventCoordinatorLanding.featAccess', 'Alliance Access Control'),
      desc: t('eventCoordinatorLanding.featAccessDesc', 'Supporters, Consuls, and Boosters can open the Event Coordinator for their alliance. All alliance members can then submit their availability.'),
    },
  ];

  const steps = [
    {
      num: '1',
      icon: '🗓️',
      title: t('eventCoordinatorLanding.step1Title', 'Open the Coordinator'),
      desc: t('eventCoordinatorLanding.step1Desc', 'A Supporter, Consul, or Booster opens the Event Coordinator from the Alliance Center. Your alliance is automatically detected.'),
    },
    {
      num: '2',
      icon: '✋',
      title: t('eventCoordinatorLanding.step2Title', 'Members Submit Availability'),
      desc: t('eventCoordinatorLanding.step2Desc', 'Each member selects the 30-minute slots they can play — for any or all days of the week. Takes less than a minute.'),
    },
    {
      num: '3',
      icon: '📊',
      title: t('eventCoordinatorLanding.step3Title', 'Managers Pick the Best Time'),
      desc: t('eventCoordinatorLanding.step3Desc', 'The heatmap shows where availability peaks. Pick the slot with the most overlap and schedule your event with confidence.'),
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
            <span style={{ fontSize: isMobile ? '1.75rem' : '2.25rem' }}>📅</span>
          </div>

          <h1 style={{
            fontSize: isMobile ? '1.75rem' : '2.5rem', fontWeight: 'bold',
            marginBottom: '0.75rem', fontFamily: FONT_DISPLAY,
          }}>
            <span style={{ color: '#fff' }}>{t('eventCoordinatorLanding.heroTitle1', 'EVENT')}</span>
            <span style={{ ...neonGlow('#3b82f6'), marginLeft: '0.5rem' }}>{t('eventCoordinatorLanding.heroTitle2', 'COORDINATOR')}</span>
          </h1>
          <p style={{
            color: '#9ca3af', fontSize: isMobile ? '0.95rem' : '1.1rem',
            maxWidth: '520px', margin: '0 auto 1.5rem', lineHeight: 1.6,
          }}>
            {t('eventCoordinatorLanding.heroSubtitle', 'Stop scheduling alliance events based on vibes. Collect real availability from every member and pick the time slot that gets the most people in the fight.')}
          </p>

          {/* CTA */}
          <div style={{
            display: 'flex', flexDirection: isMobile ? 'column' : 'row',
            gap: '0.75rem', justifyContent: 'center', alignItems: 'center',
          }}>
            <Link
              to="/tools/event-coordinator"
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
              📅 {t('eventCoordinatorLanding.launchTool', 'Launch Event Coordinator')}
            </Link>
          </div>
          <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.75rem' }}>
            {t('eventCoordinatorLanding.accessNote', 'Supporters, Consuls, and Boosters can open this for their alliance. All alliance members can then submit availability.')}
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
            <span style={{ color: '#fff' }}>{t('eventCoordinatorLanding.howItWorks1', 'HOW IT')}</span>
            <span style={{ ...neonGlow('#3b82f6'), marginLeft: '0.4rem' }}>{t('eventCoordinatorLanding.howItWorks2', 'WORKS')}</span>
          </h2>
          <p style={{
            color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.85rem',
            textAlign: 'center', marginBottom: '1.5rem',
          }}>
            {t('eventCoordinatorLanding.threeSteps', 'Three steps. Perfect event timing.')}
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
            <span style={{ color: '#fff' }}>{t('eventCoordinatorLanding.builtFor1', 'BUILT FOR')}</span>
            <span style={{ ...neonGlow('#3b82f6'), marginLeft: '0.4rem' }}>{t('eventCoordinatorLanding.builtFor2', 'ALLIANCE LEADERS')}</span>
          </h2>
          <p style={{
            color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.85rem',
            textAlign: 'center', marginBottom: '1.5rem',
          }}>
            {t('eventCoordinatorLanding.featuresSubtitle', 'Every feature designed to eliminate scheduling guesswork.')}
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
            {t('eventCoordinatorLanding.problemTitle', '"When should we do Bear Hunt?" — Every R5, every week.')}
          </h2>
          <p style={{ color: '#d1d5db', fontSize: isMobile ? '0.85rem' : '0.9rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            {t('eventCoordinatorLanding.problemDesc', "You ask in alliance chat. Three people say \"evening.\" Two say \"morning.\" Nobody specifies a timezone. You pick a time that works for you, and half the alliance misses it because they were asleep.")}
          </p>
          <p style={{ color: '#d1d5db', fontSize: isMobile ? '0.85rem' : '0.9rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            {t('eventCoordinatorLanding.solutionDesc', "The Event Coordinator collects real availability from every member — in 30-minute slots, converted to each person's local time. The heatmap shows you exactly when the most people can play. No more guessing. No more timezone math.")}
          </p>
          <p style={{ color: '#3b82f6', fontSize: isMobile ? '0.8rem' : '0.85rem', fontWeight: 600, fontStyle: 'italic' }}>
            {t('eventCoordinatorLanding.punchline', "Full attendance starts with the right time. Atlas finds it.")}
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
            {t('eventCoordinatorLanding.accessBadge', 'Who Can Access')}
          </span>
          <h3 style={{
            fontSize: isMobile ? '1.1rem' : '1.25rem', fontWeight: 'bold',
            color: '#fff', marginBottom: '0.5rem', fontFamily: FONT_DISPLAY,
          }}>
            {t('eventCoordinatorLanding.accessTitle', 'Leaders open it. Everyone fills it in.')}
          </h3>
          <p style={{
            color: '#9ca3af', fontSize: isMobile ? '0.8rem' : '0.85rem',
            marginBottom: '1.25rem', maxWidth: '500px', margin: '0 auto 1.25rem', lineHeight: 1.6,
          }}>
            {t('eventCoordinatorLanding.accessExplainer', 'Supporters, Consuls, and Boosters can open the Event Coordinator for their alliance. Once active, every member on the alliance roster can submit their available play times. One leader activates — the whole alliance participates.')}
          </p>

          <div style={{
            display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '0.75rem',
            maxWidth: '500px', margin: '0 auto 1.5rem',
          }}>
            {[
              { label: t('eventCoordinatorLanding.roleSupporter', 'Supporters'), icon: '💎' },
              { label: t('eventCoordinatorLanding.roleConsul', 'Consuls'), icon: '🏛️' },
              { label: t('eventCoordinatorLanding.roleBooster', 'Boosters'), icon: '🚀' },
            ].map((role) => (
              <div key={role.label} style={{
                backgroundColor: '#0a0a0a', borderRadius: '10px', border: '1px solid #2a2a2a',
                padding: '0.75rem', textAlign: 'center',
              }}>
                <div style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{role.icon}</div>
                <div style={{ color: '#e5e7eb', fontSize: '0.8rem', fontWeight: 600 }}>{role.label}</div>
                <div style={{ color: '#6b7280', fontSize: '0.65rem', marginTop: '0.15rem' }}>
                  {t('eventCoordinatorLanding.canActivate', 'Can activate')}
                </div>
              </div>
            ))}
          </div>

          <div style={{
            display: 'flex', flexDirection: isMobile ? 'column' : 'row',
            gap: '0.75rem', justifyContent: 'center', alignItems: 'center',
          }}>
            <Link
              to="/tools/event-coordinator"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.75rem 1.5rem', backgroundColor: '#3b82f6',
                border: 'none', borderRadius: '8px', color: '#fff',
                fontWeight: 600, fontSize: isMobile ? '0.9rem' : '0.95rem',
                textDecoration: 'none', transition: 'all 0.2s ease',
                boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)',
              }}
            >
              📅 {t('eventCoordinatorLanding.launchTool', 'Launch Event Coordinator')}
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
              {t('eventCoordinatorLanding.viewAllTools', 'View All Tools')}
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

export default AllianceEventCoordinatorLanding;
