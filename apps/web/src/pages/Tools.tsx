import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useMetaTags, PAGE_META_TAGS } from '../hooks/useMetaTags';
import { useStructuredData, PAGE_BREADCRUMBS } from '../hooks/useStructuredData';
import { neonGlow, FONT_DISPLAY } from '../utils/styles';
import { useTranslation } from 'react-i18next';

interface ToolCardProps {
  title: string;
  description: string;
  tagline: string;
  icon: React.ReactNode;
  href?: string;
  comingSoon?: boolean;
  accentColor: string;
  usageStat?: string;
  ctaLabel?: string;
}

const ToolCard: React.FC<ToolCardProps> = ({ 
  title, 
  description, 
  tagline,
  icon, 
  href, 
  comingSoon,
  accentColor,
  usageStat,
  ctaLabel 
}) => {
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  
  const content = (
    <div style={{
      position: 'relative',
      backgroundColor: '#111111',
      borderRadius: '16px',
      border: `1px solid ${comingSoon ? '#2a2a2a' : accentColor + '40'}`,
      padding: isMobile ? '1.25rem' : '1.5rem',
      transition: 'all 0.3s ease',
      cursor: comingSoon ? 'default' : 'pointer',
      overflow: 'hidden',
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}
    onMouseEnter={(e) => {
      if (!comingSoon) {
        e.currentTarget.style.borderColor = accentColor;
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = `0 8px 32px ${accentColor}20`;
      }
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.borderColor = comingSoon ? '#2a2a2a' : accentColor + '40';
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = 'none';
    }}
    >
      {comingSoon && (
        <div style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          padding: '0.25rem 0.6rem',
          backgroundColor: accentColor + '20',
          border: `1px solid ${accentColor}50`,
          borderRadius: '20px',
          fontSize: '0.65rem',
          fontWeight: '700',
          color: accentColor,
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          {t('common.comingSoon')}
        </div>
      )}
      {usageStat && !comingSoon && (
        <div style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          padding: '0.2rem 0.5rem',
          backgroundColor: accentColor + '12',
          borderRadius: '12px',
          fontSize: '0.6rem',
          fontWeight: '600',
          color: accentColor,
          opacity: 0.8
        }}>
          {usageStat}
        </div>
      )}
      
      <div style={{
        width: isMobile ? '48px' : '56px',
        height: isMobile ? '48px' : '56px',
        borderRadius: '12px',
        backgroundColor: accentColor + '15',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '1rem',
        color: accentColor,
        filter: comingSoon ? 'grayscale(0.3)' : 'none'
      }}>
        {icon}
      </div>
      
      <h3 style={{
        fontSize: isMobile ? '1.1rem' : '1.25rem',
        fontWeight: 'bold',
        color: comingSoon ? '#6b7280' : '#fff',
        marginBottom: '0.5rem',
        fontFamily: FONT_DISPLAY
      }}>
        {title}
      </h3>
      
      <p style={{
        fontSize: isMobile ? '0.8rem' : '0.85rem',
        color: comingSoon ? '#4b5563' : '#9ca3af',
        marginBottom: '0.75rem',
        lineHeight: 1.5,
        flex: 1
      }}>
        {description}
      </p>
      
      <p style={{
        fontSize: isMobile ? '0.7rem' : '0.75rem',
        color: accentColor,
        fontWeight: '600',
        fontStyle: 'italic',
        opacity: comingSoon ? 0.6 : 1
      }}>
        {tagline}
      </p>
      
      {!comingSoon && (
        <div style={{
          marginTop: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          color: accentColor,
          fontSize: '0.85rem',
          fontWeight: '600'
        }}>
          {ctaLabel || t('tools.launchTool', 'Launch Tool')}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </div>
      )}
    </div>
  );
  
  if (href && !comingSoon) {
    return (
      <Link to={href} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
        {content}
      </Link>
    );
  }
  
  return content;
};

const Tools: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle('Tools');
  useMetaTags(PAGE_META_TAGS.tools);
  useStructuredData({ type: 'BreadcrumbList', data: PAGE_BREADCRUMBS.tools });
  const isMobile = useIsMobile();

  // Fetch active gift code count for badge
  const [giftCodeCount, setGiftCodeCount] = useState<number | null>(null);
  useEffect(() => {
    const API_BASE = import.meta.env.VITE_API_URL || 'https://kingshot-atlas.onrender.com';
    fetch(`${API_BASE}/api/v1/player-link/gift-codes`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.codes?.length) setGiftCodeCount(data.codes.filter((c: any) => !c.is_expired).length);
      })
      .catch(() => {});
  }, []);

  const tools: ToolCardProps[] = [
    {
      title: t('tools.transferTitle', 'Transfer Hub'),
      description: t('tools.transferDesc', 'Find your next kingdom — or find the right players. Browse listings, create a transfer profile, and apply directly. No more blind transfers.'),
      tagline: t('tools.transferTagline', 'Real data. Real applications. Zero guesswork.'),
      ctaLabel: t('tools.learnMore', 'Learn More'),
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 4L3 8L7 12"/>
          <path d="M3 8H15C17.7614 8 20 10.2386 20 13"/>
          <path d="M17 20L21 16L17 12"/>
          <path d="M21 16H9C6.23858 16 4 13.7614 4 11"/>
        </svg>
      ),
      href: '/transfer-hub/about',
      accentColor: '#22c55e'
    },
    {
      title: t('tools.rallyTitle', 'KvK Battle Planner'),
      description: t('tools.rallyDesc', 'Time your rallies to land together. Set hit order, march times, and delay windows — so your alliance strikes as one.'),
      tagline: t('tools.rallyTagline', 'Synchronized destruction. No guesswork.'),
      ctaLabel: t('tools.learnMore', 'Learn More'),
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 2"/>
          <path d="M2 12h2M20 12h2M12 2v2M12 20v2"/>
        </svg>
      ),
      href: '/tools/battle-planner',
      accentColor: '#ef4444'
    },
    {
      title: t('tools.botTitle', 'Discord Bot Atlas'),
      description: t('tools.botDesc', 'Bring kingdom intelligence directly to your Discord server. Look up kingdoms, compare matchups, and check rankings — without leaving Discord.'),
      tagline: t('tools.botTagline', 'Intel at your fingertips. No tab-switching.'),
      usageStat: t('tools.botStat', '10+ Discord servers'),
      ctaLabel: t('tools.learnMore', 'Learn More'),
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
        </svg>
      ),
      href: '/atlas-bot',
      accentColor: '#5865F2'
    },
    {
      title: t('tools.giftTitle', 'Gift Code Redeemer'),
      description: t('tools.giftDesc', 'Redeem gift codes with one click. No copy-pasting. Rewards go straight to your mailbox.'),
      tagline: t('tools.giftTagline', 'Stop typing. Start claiming.'),
      usageStat: giftCodeCount ? `${giftCodeCount} active codes` : undefined,
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
        </svg>
      ),
      ctaLabel: t('tools.learnMore', 'Learn More'),
      href: '/gift-codes',
      accentColor: '#f59e0b'
    },
    {
      title: t('tools.compareTitle', 'Kingdom Comparison'),
      description: t('tools.compareDesc', 'Put any kingdoms in the ring. Head-to-head stats, win rates, and Atlas Scores. Let the data crown the champion.'),
      tagline: t('tools.compareTagline', 'Know your enemy. Choose your allies.'),
      usageStat: t('tools.compareStat', '1,300+ kingdoms'),
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M16 3h5v5M8 3H3v5M3 16v5h5M21 16v5h-5M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/>
        </svg>
      ),
      href: '/compare',
      accentColor: '#22d3ee'
    },
    {
      title: t('tools.appointmentTitle', 'Appointment Scheduler'),
      description: t('tools.appointmentDesc', 'Schedule King\'s Appointments across your kingdom during Prep Phase. Maximize buff slots, avoid overlap, and make every 30 minutes count.'),
      tagline: t('tools.appointmentTagline', 'Precision wins wars.'),
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
          <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
        </svg>
      ),
      comingSoon: true,
      accentColor: '#a855f7'
    },
    {
      title: t('tools.calcTitle', 'Gaming Calculators'),
      description: t('tools.calcDesc', 'Resource planners, upgrade costs, speedup estimates. Math so you don\'t have to.'),
      tagline: t('tools.calcTagline', 'Calculate smarter. Grow faster.'),
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="2" width="16" height="20" rx="2"/>
          <line x1="8" y1="6" x2="16" y2="6"/>
          <line x1="8" y1="10" x2="8" y2="10.01"/>
          <line x1="12" y1="10" x2="12" y2="10.01"/>
          <line x1="16" y1="10" x2="16" y2="10.01"/>
          <line x1="8" y1="14" x2="8" y2="14.01"/>
          <line x1="12" y1="14" x2="12" y2="14.01"/>
          <line x1="16" y1="14" x2="16" y2="14.01"/>
          <line x1="8" y1="18" x2="8" y2="18.01"/>
          <line x1="12" y1="18" x2="16" y2="18"/>
        </svg>
      ),
      comingSoon: true,
      accentColor: '#10b981'
    }
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      {/* Hero Section */}
      <div style={{ 
        padding: isMobile ? '1.5rem 1rem 1.25rem' : '2rem 2rem 1.5rem',
        textAlign: 'center',
        background: 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '800px', margin: '0 auto' }}>
          <h1 style={{ 
            fontSize: isMobile ? '1.75rem' : '2.5rem', 
            fontWeight: 'bold', 
            marginBottom: '0.75rem',
            fontFamily: FONT_DISPLAY,
            letterSpacing: '0.05em'
          }}>
            <span style={{ color: '#fff' }}>ATLAS</span>
            <span style={{ ...neonGlow('#22d3ee'), marginLeft: '0.5rem' }}>TOOLS</span>
          </h1>
          <p style={{ 
            color: '#9ca3af', 
            fontSize: isMobile ? '0.9rem' : '1rem', 
            maxWidth: '500px', 
            margin: '0 auto 1rem',
            lineHeight: 1.6
          }}>
            {t('tools.heroSubtitle', 'Your arsenal for KvK supremacy. Data-driven tools built by players, for players.')}
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

      {/* Tools Grid */}
      <div style={{ 
        maxWidth: '1000px', 
        margin: '0 auto', 
        padding: isMobile ? '1rem' : '2rem'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
          gap: isMobile ? '1rem' : '1.5rem'
        }}>
          {tools.map((tool, index) => (
            <ToolCard key={index} {...tool} />
          ))}
        </div>

        {/* Bottom CTA */}
        <div style={{
          marginTop: isMobile ? '2rem' : '2.5rem',
          padding: isMobile ? '1.25rem' : '1.5rem',
          backgroundColor: '#111111',
          borderRadius: '16px',
          border: '1px solid #2a2a2a',
          textAlign: 'center'
        }}>
          <h3 style={{
            fontSize: isMobile ? '1rem' : '1.15rem',
            fontWeight: 'bold',
            color: '#fff',
            marginBottom: '0.5rem'
          }}>
            {t('tools.gotIdea', 'Got a tool idea?')}
          </h3>
          <p style={{
            fontSize: isMobile ? '0.8rem' : '0.85rem',
            color: '#6b7280',
            marginBottom: '1rem'
          }}>
            {t('tools.dropSuggestions', "We're building what the community needs. Drop your suggestions in Discord.")}
          </p>
          <a
            href="https://discord.gg/cajcacDzGd"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.6rem 1.25rem',
              backgroundColor: '#5865F2',
              borderRadius: '8px',
              color: '#fff',
              textDecoration: 'none',
              fontSize: '0.85rem',
              fontWeight: '600'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            {t('tools.joinDiscussion', 'Join the Discussion')}
          </a>
        </div>

        {/* Back to Home */}
        <div style={{ textAlign: 'center', marginTop: '2rem', paddingBottom: '1rem' }}>
          <Link to="/" style={{ color: '#22d3ee', textDecoration: 'none', fontSize: '0.8rem' }}>
            {t('common.backToHome')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Tools;
