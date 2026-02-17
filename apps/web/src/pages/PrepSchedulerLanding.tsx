import React from 'react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { neonGlow, FONT_DISPLAY } from '../utils/styles';
import { useTranslation } from 'react-i18next';

const PrepSchedulerLanding: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('prepScheduler.pageTitle', 'KvK Prep Scheduler'));
  const isMobile = useIsMobile();

  const features = [
    {
      icon: '📋',
      title: t('prepLanding.featAutoAssign', 'Automated Slot Assignment'),
      desc: t('prepLanding.featAutoAssignDesc', 'Players submit their availability and speedups. The system auto-assigns 30-minute buff slots based on who brings the most value. No spreadsheets, no guesswork.'),
    },
    {
      icon: '⏱️',
      title: t('prepLanding.featSpeedups', 'Speedup Optimization'),
      desc: t('prepLanding.featSpeedupsDesc', 'The algorithm prioritizes players with the highest relevant speedups for each day\'s buff type — Construction, Research, or Training. Every minute counts.'),
    },
    {
      icon: '📊',
      title: t('prepLanding.featExport', 'One-Click Export'),
      desc: t('prepLanding.featExportDesc', 'Export the full 3-day schedule as a CSV. Player names, alliances, slot times, and speedup data — ready for Discord or in-game chat.'),
    },
    {
      icon: '📸',
      title: t('prepLanding.featProof', 'Proof of Speedups'),
      desc: t('prepLanding.featProofDesc', 'Players upload a screenshot of their speedup inventory when submitting. Managers can verify claims before assigning slots. Trust, but verify.'),
    },
    {
      icon: '🔗',
      title: t('prepLanding.featShareLink', 'Shareable Form Link'),
      desc: t('prepLanding.featShareLinkDesc', 'Share one link with your kingdom. Players see only the submission form — clean, simple, no confusion. They fill it out, you manage the schedule.'),
    },
    {
      icon: '⚠️',
      title: t('prepLanding.featConflict', 'Smart Conflict Detection'),
      desc: t('prepLanding.featConflictDesc', 'Unassigned players are flagged instantly. Availability gaps are highlighted. The manager sees exactly where the schedule needs attention — no one gets lost.'),
    },
  ];

  const steps = [
    {
      num: '1',
      icon: '�',
      title: t('prepLanding.step1', 'Create a Schedule'),
      desc: t('prepLanding.step1Desc', 'An Editor, Co-Editor, or Prep Manager creates a Prep Schedule for their Gold Tier kingdom and sets an optional submission deadline.'),
    },
    {
      num: '2',
      icon: '📨',
      title: t('prepLanding.step2', 'Share the Form'),
      desc: t('prepLanding.step2Desc', 'Share the form link with kingdom players. They submit their speedups, availability, and proof screenshots.'),
    },
    {
      num: '3',
      icon: '⚡',
      title: t('prepLanding.step3', 'Auto-Assign & Export'),
      desc: t('prepLanding.step3Desc', 'One click auto-assigns optimal slots. Review, adjust if needed, then export the schedule and share it with your kingdom.'),
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
            borderRadius: '50%', backgroundColor: '#a855f715',
            border: '2px solid #a855f730',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.25rem',
            boxShadow: '0 0 30px rgba(168, 85, 247, 0.15), 0 0 60px rgba(168, 85, 247, 0.08)',
          }}>
            <span style={{ fontSize: isMobile ? '1.75rem' : '2.25rem' }}>📅</span>
          </div>

          <h1 style={{
            fontSize: isMobile ? '1.75rem' : '2.5rem', fontWeight: 'bold',
            marginBottom: '0.75rem', fontFamily: FONT_DISPLAY,
          }}>
            <span style={{ color: '#fff' }}>KvK PREP</span>
            <span style={{ ...neonGlow('#a855f7'), marginLeft: '0.5rem' }}>SCHEDULER</span>
          </h1>
          <p style={{
            color: '#9ca3af', fontSize: isMobile ? '0.95rem' : '1.1rem',
            maxWidth: '520px', margin: '0 auto 0.5rem', lineHeight: 1.6,
          }}>
            {t('prepLanding.heroSubtitle', 'Your Gold Tier kingdom earned elite tools. Stop losing Prep Phase points to disorganized buff scheduling — Atlas turns chaos into a precision-timed machine that maximizes every 30-minute slot.')}
          </p>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.25rem 0.75rem', backgroundColor: '#ffc30b15',
            border: '1px solid #ffc30b30', borderRadius: '20px', marginBottom: '0.5rem',
          }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#ffc30b' }}>
              👑 GOLD TIER KINGDOM FEATURE
            </span>
          </div>
          <p style={{ color: '#6b7280', fontSize: '0.75rem', maxWidth: '400px', margin: '0 auto 1.25rem', lineHeight: 1.5 }}>
            Reach Gold Tier through the Kingdom Fund to unlock this and other premium kingdom tools.
          </p>

          {/* CTA */}
          <div style={{
            display: 'flex', flexDirection: isMobile ? 'column' : 'row',
            gap: '0.75rem', justifyContent: 'center', alignItems: 'center',
          }}>
            <Link
              to="/tools/prep-scheduler"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
                padding: isMobile ? '0.85rem 1.75rem' : '0.9rem 2rem',
                backgroundColor: '#a855f7', border: 'none', borderRadius: '10px',
                color: '#fff', fontWeight: 700,
                fontSize: isMobile ? '0.95rem' : '1rem', textDecoration: 'none',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 20px rgba(168, 85, 247, 0.35)',
              }}
            >
              📅 Open the Scheduler
            </Link>
          </div>
          <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.75rem' }}>
            {t('prepLanding.ctaNote', 'Editors, Co-Editors, and Prep Managers of Gold Tier kingdoms can create and manage schedules.')}
          </p>

          {!isMobile && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
              <div style={{ width: '50px', height: '2px', background: 'linear-gradient(90deg, transparent, #a855f7)' }} />
              <div style={{ width: '6px', height: '6px', backgroundColor: '#a855f7', transform: 'rotate(45deg)', boxShadow: '0 0 8px #a855f7' }} />
              <div style={{ width: '50px', height: '2px', background: 'linear-gradient(90deg, #a855f7, transparent)' }} />
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
            <span style={{ color: '#fff' }}>HOW IT</span>
            <span style={{ ...neonGlow('#a855f7'), marginLeft: '0.4rem' }}>WORKS</span>
          </h2>
          <p style={{
            color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.85rem',
            textAlign: 'center', marginBottom: '1.5rem',
          }}>
            {t('prepLanding.threeSteps', 'Three steps. One organized kingdom.')}
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
                  backgroundColor: '#a855f715', border: '1px solid #a855f730',
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
            <span style={{ color: '#fff' }}>BUILT FOR</span>
            <span style={{ ...neonGlow('#a855f7'), marginLeft: '0.4rem' }}>PREP MANAGERS</span>
          </h2>
          <p style={{
            color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.85rem',
            textAlign: 'center', marginBottom: '1.5rem',
          }}>
            {t('prepLanding.featuresSubtitle', 'Every feature exists because managing prep phase scheduling was a nightmare. Until now.')}
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
          border: '1px solid #a855f730', padding: isMobile ? '1.25rem' : '1.75rem',
          background: 'linear-gradient(135deg, #111111 0%, #a855f708 100%)',
        }}>
          <h2 style={{
            fontSize: isMobile ? '1.05rem' : '1.2rem', fontWeight: 'bold', color: '#fff',
            marginBottom: '1rem', fontFamily: FONT_DISPLAY,
          }}>
            {t('prepLanding.problemTitle', 'Your kingdom has 200 players. 48 buff slots per day. Do the math.')}
          </h2>
          <p style={{ color: '#d1d5db', fontSize: isMobile ? '0.85rem' : '0.9rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            {t('prepLanding.problemP1', 'Right now, your Prep Manager is probably juggling a Google Sheet, a Discord thread that\'s 500 messages deep, and a headache. Players post their availability in different time zones. Nobody knows who has the best speedups. Half the slots go to people who don\'t even show up.')}
          </p>
          <p style={{ color: '#d1d5db', fontSize: isMobile ? '0.85rem' : '0.9rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            {t('prepLanding.problemP2', 'The KvK Prep Scheduler collects everything in one form — speedups, availability, proof screenshots — with a submission deadline shown in 24-hour UTC (and your local time). Then it auto-assigns slots based on who brings the most value for each day\'s buff type. Construction Monday? The system knows who has the most construction speedups and puts them in the best slots. Research Tuesday? Same logic, different data.')}
          </p>
          <p style={{ color: '#d1d5db', fontSize: isMobile ? '0.85rem' : '0.9rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            {t('prepLanding.problemP3', 'Unassigned players get flagged immediately. Empty time slots are highlighted. The manager sees exactly where the gaps are and can manually assign anyone into any slot with override.')}
          </p>
          <p style={{ color: '#a855f7', fontSize: isMobile ? '0.8rem' : '0.85rem', fontWeight: 600, fontStyle: 'italic' }}>
            {t('prepLanding.punchline', 'That\'s not scheduling. That\'s strategic resource allocation.')}
          </p>
        </div>

        {/* Who Is This For */}
        <div style={{
          marginBottom: isMobile ? '2rem' : '3rem',
          backgroundColor: '#111111', borderRadius: '16px',
          border: '1px solid #2a2a2a', padding: isMobile ? '1.25rem' : '1.75rem',
        }}>
          <h2 style={{
            fontSize: isMobile ? '1.05rem' : '1.2rem', fontWeight: 'bold', color: '#fff',
            marginBottom: '1rem', fontFamily: FONT_DISPLAY,
          }}>
            {t('prepLanding.whoTitle', 'Who uses the Prep Scheduler?')}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>👑</span>
              <div>
                <p style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.15rem' }}>{t('prepLanding.whoEditors', 'Kingdom Editors & Co-Editors')}</p>
                <p style={{ color: '#9ca3af', fontSize: '0.8rem', lineHeight: 1.5 }}>{t('prepLanding.whoEditorsDesc', 'Create schedules, assign Prep Managers, and archive or delete schedules. Full control over your kingdom\'s prep coordination.')}</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>🎯</span>
              <div>
                <p style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.15rem' }}>{t('prepLanding.whoManagers', 'Prep Managers')}</p>
                <p style={{ color: '#9ca3af', fontSize: '0.8rem', lineHeight: 1.5 }}>{t('prepLanding.whoManagersDesc', 'Create schedules, auto-assign slots, handle edge cases, export the final schedule, and delete archived schedules. The tool does the heavy lifting.')}</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>⚔️</span>
              <div>
                <p style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.15rem' }}>{t('prepLanding.whoPlayers', 'Kingdom Players')}</p>
                <p style={{ color: '#9ca3af', fontSize: '0.8rem', lineHeight: 1.5 }}>{t('prepLanding.whoPlayersDesc', 'Click the form link, submit your speedups and availability, upload proof. That\'s it — your Prep Manager handles the rest.')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Gold Tier CTA */}
        <div style={{
          marginBottom: isMobile ? '2rem' : '3rem',
          padding: isMobile ? '1.5rem' : '2rem',
          backgroundColor: '#111111', borderRadius: '16px',
          border: '1px solid #ffc30b30', textAlign: 'center',
          background: 'linear-gradient(135deg, #111111 0%, #ffc30b08 100%)',
        }}>
          <span style={{
            fontSize: '0.65rem', fontWeight: 700,
            color: '#ffc30b',
            backgroundColor: '#ffc30b18',
            border: '1px solid #ffc30b30',
            padding: '0.2rem 0.6rem', borderRadius: '4px',
            letterSpacing: '0.05em', textTransform: 'uppercase',
            display: 'inline-block', marginBottom: '0.75rem',
          }}>
            {t('prepLanding.goldBadge', 'Gold Tier Exclusive')}
          </span>
          <h3 style={{
            fontSize: isMobile ? '1.1rem' : '1.25rem', fontWeight: 'bold',
            color: '#fff', marginBottom: '0.5rem', fontFamily: FONT_DISPLAY,
          }}>
            {t('prepLanding.goldTitle', 'Your kingdom deserves organized prep phases.')}
          </h3>
          <p style={{
            color: '#9ca3af', fontSize: isMobile ? '0.8rem' : '0.85rem',
            marginBottom: '1.25rem', maxWidth: '450px', margin: '0 auto 1.25rem', lineHeight: 1.6,
          }}>
            {t('prepLanding.goldDesc', 'The KvK Prep Scheduler is available to kingdoms with Gold Tier status through the Kingdom Fund. If your kingdom isn\'t Gold Tier yet, encourage your alliance leaders to contribute.')}
          </p>
          <div style={{
            display: 'flex', flexDirection: isMobile ? 'column' : 'row',
            gap: '0.75rem', justifyContent: 'center', alignItems: 'center',
          }}>
            <Link
              to="/tools/prep-scheduler"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.75rem 1.5rem', backgroundColor: '#a855f7',
                border: 'none', borderRadius: '8px', color: '#fff',
                fontWeight: 600, fontSize: isMobile ? '0.9rem' : '0.95rem',
                textDecoration: 'none', transition: 'all 0.2s ease',
                boxShadow: '0 4px 15px rgba(168, 85, 247, 0.3)',
              }}
            >
              📅 Get Started
            </Link>
          </div>
        </div>

        {/* Back links */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', paddingBottom: '1rem' }}>
          <Link to="/tools" style={{ color: '#22d3ee', textDecoration: 'none', fontSize: '0.8rem' }}>
            {t('common.allTools', '← All Tools')}
          </Link>
          <Link to="/" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '0.8rem' }}>
            {t('common.backToHome', '← Back to Home')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PrepSchedulerLanding;
