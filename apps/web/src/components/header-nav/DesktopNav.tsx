import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import NotificationBell from '../NotificationBell';
import { neonGlow } from '../../utils/styles';
import { SUPPORTED_LANGUAGES, LANGUAGE_META } from '../../i18n';

const DISCORD_INVITE = import.meta.env.VITE_DISCORD_INVITE || 'https://discord.gg/cajcacDzGd';

const LANGUAGE_OPTIONS = SUPPORTED_LANGUAGES.map(code => ({
  code,
  ...LANGUAGE_META[code],
}));

interface DesktopNavProps {
  isActive: (path: string) => boolean;
  user: boolean;
  changeLanguage: (code: string) => void;
  children: React.ReactNode; // UserMenu slot
}

const DesktopNav: React.FC<DesktopNavProps> = ({ isActive, user, changeLanguage, children }) => {
  const { t, i18n } = useTranslation();
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [showCommunityMenu, setShowCommunityMenu] = useState(false);
  const [showRankingsMenu, setShowRankingsMenu] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);

  // Timeout refs for dropdown close delay
  const toolsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const communityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const rankingsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleToolsEnter = () => { if (toolsTimeoutRef.current) clearTimeout(toolsTimeoutRef.current); setShowToolsMenu(true); };
  const handleToolsLeave = () => { toolsTimeoutRef.current = setTimeout(() => setShowToolsMenu(false), 150); };
  const handleCommunityEnter = () => { if (communityTimeoutRef.current) clearTimeout(communityTimeoutRef.current); setShowCommunityMenu(true); };
  const handleCommunityLeave = () => { communityTimeoutRef.current = setTimeout(() => setShowCommunityMenu(false), 150); };
  const handleRankingsEnter = () => { if (rankingsTimeoutRef.current) clearTimeout(rankingsTimeoutRef.current); setShowRankingsMenu(true); };
  const handleRankingsLeave = () => { rankingsTimeoutRef.current = setTimeout(() => setShowRankingsMenu(false), 150); };

  const handleChangeLanguage = (code: string) => {
    changeLanguage(code);
    setShowLangMenu(false);
  };

  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <Link
        to="/"
        style={{
          color: isActive('/') ? '#22d3ee' : '#9ca3af',
          textDecoration: 'none',
          fontSize: '0.9rem',
          fontWeight: isActive('/') ? '600' : '400',
          transition: 'color 0.2s',
          ...(isActive('/') ? neonGlow('#22d3ee') : {})
        }}
      >
        {t('nav.home')}
      </Link>

      {/* Rankings Dropdown */}
      <div 
        style={{ position: 'relative' }}
        onMouseEnter={handleRankingsEnter}
        onMouseLeave={handleRankingsLeave}
      >
        <Link
          to="/rankings"
          style={{
            color: (isActive('/rankings') || isActive('/seasons') || location.pathname.startsWith('/seasons/')) ? '#22d3ee' : '#9ca3af',
            textDecoration: 'none',
            fontSize: '0.9rem',
            fontWeight: (isActive('/rankings') || isActive('/seasons') || location.pathname.startsWith('/seasons/')) ? '600' : '400',
            transition: 'color 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            ...((isActive('/rankings') || isActive('/seasons') || location.pathname.startsWith('/seasons/')) ? neonGlow('#22d3ee') : {})
          }}
        >
          {t('nav.rankings')}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.6 }}>
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </Link>
        
        {showRankingsMenu && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            paddingTop: '0.5rem',
            backgroundColor: '#111111',
            border: '1px solid #2a2a2a',
            borderRadius: '12px',
            padding: '0.5rem',
            minWidth: '200px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.6)',
            zIndex: 1000
          }}>
            <Link
              to="/rankings"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                color: isActive('/rankings') ? '#22d3ee' : '#fff',
                textDecoration: 'none',
                fontSize: '0.85rem',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#22d3ee' }}>
                <path d="M12 20V10M18 20V4M6 20v-4"/>
              </svg>
              {t('nav.kingdomRankings')}
            </Link>
            <Link
              to="/seasons"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                color: (isActive('/seasons') || location.pathname.startsWith('/seasons/')) ? '#22d3ee' : '#fff',
                textDecoration: 'none',
                fontSize: '0.85rem',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#f97316' }}>
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
              {t('nav.kvkSeasons')}
            </Link>
          </div>
        )}
      </div>

      {/* Tools Dropdown */}
      <div 
        style={{ position: 'relative' }}
        onMouseEnter={handleToolsEnter}
        onMouseLeave={handleToolsLeave}
      >
        <Link
          to="/tools"
          style={{
            color: (isActive('/tools') || isActive('/compare') || isActive('/atlas-bot') || isActive('/transfer-hub') || isActive('/transfer-hub/about') || isActive('/tools/prep-scheduler') || isActive('/tools/prep-scheduler-info')) ? '#22d3ee' : '#9ca3af',
            textDecoration: 'none',
            fontSize: '0.9rem',
            fontWeight: (isActive('/tools') || isActive('/compare') || isActive('/atlas-bot') || isActive('/transfer-hub') || isActive('/transfer-hub/about') || isActive('/tools/prep-scheduler') || isActive('/tools/prep-scheduler-info')) ? '600' : '400',
            transition: 'color 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            ...((isActive('/tools') || isActive('/compare') || isActive('/atlas-bot') || isActive('/transfer-hub') || isActive('/transfer-hub/about') || isActive('/tools/prep-scheduler') || isActive('/tools/prep-scheduler-info')) ? neonGlow('#22d3ee') : {})
          }}
        >
          {t('nav.tools')}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.6 }}>
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </Link>
        
        {showToolsMenu && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            paddingTop: '0.5rem',
            backgroundColor: '#111111',
            border: '1px solid #2a2a2a',
            borderRadius: '12px',
            padding: '0.5rem',
            minWidth: '200px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.6)',
            zIndex: 1000
          }}>
            {/* 1. Transfer Hub */}
            <Link
              to="/transfer-hub/about"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                color: (isActive('/transfer-hub') || isActive('/transfer-hub/about')) ? '#22d3ee' : '#fff',
                textDecoration: 'none',
                fontSize: '0.85rem',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#22c55e' }}>
                <path d="M18 8L22 12L18 16"/>
                <path d="M2 12H22"/>
                <path d="M6 16L2 12L6 8"/>
              </svg>
              {t('nav.transferHub')}
            </Link>
            {/* 2. KvK Battle Planner */}
            <Link
              to="/tools/battle-planner"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                color: isActive('/tools/battle-planner') ? '#22d3ee' : '#fff',
                textDecoration: 'none',
                fontSize: '0.85rem',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#ef4444' }}>
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
              </svg>
              {t('nav.kvkBattleCoordinator')}
            </Link>
            {/* 3. Atlas Discord Bot */}
            <Link
              to="/atlas-bot"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                color: isActive('/atlas-bot') ? '#22d3ee' : '#fff',
                textDecoration: 'none',
                fontSize: '0.85rem',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#5865F2' }}>
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              {t('nav.atlasBot')}
            </Link>
            <div style={{ height: '1px', backgroundColor: '#2a2a2a', margin: '0.25rem 0' }} />
            {/* 4. Gift Code Redeemer */}
            <Link
              to="/gift-codes"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                color: isActive('/gift-codes') ? '#22d3ee' : '#fff',
                textDecoration: 'none',
                fontSize: '0.85rem',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#f59e0b' }}>
                <path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7"/>
              </svg>
              {t('nav.giftCodeRedeemer')}
            </Link>
            {/* 5. Kingdom Comparison */}
            <Link
              to="/compare"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                color: isActive('/compare') ? '#22d3ee' : '#fff',
                textDecoration: 'none',
                fontSize: '0.85rem',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#22d3ee' }}>
                <path d="M16 3h5v5M8 3H3v5M3 16v5h5M21 16v5h-5"/>
              </svg>
              {t('nav.kingdomComparison')}
            </Link>
            <div style={{ height: '1px', backgroundColor: '#2a2a2a', margin: '0.25rem 0' }} />
            {/* 6. KvK Prep Scheduler */}
            <Link
              to="/tools/prep-scheduler-info"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                color: isActive('/tools/prep-scheduler') || isActive('/tools/prep-scheduler-info') ? '#22d3ee' : '#fff',
                textDecoration: 'none',
                fontSize: '0.85rem',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#a855f7' }}>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              {t('nav.kvkPrepScheduler', 'KvK Prep Scheduler')}
            </Link>
            {/* 7. Gaming Calculators (SOON) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                color: '#4b5563',
                fontSize: '0.85rem',
                cursor: 'default'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#10b981', opacity: 0.5 }}>
                <rect x="4" y="2" width="16" height="20" rx="2"/>
                <line x1="8" y1="6" x2="16" y2="6"/>
              </svg>
              {t('nav.gamingCalculators')}
              <span style={{ fontSize: '0.6rem', backgroundColor: '#10b98120', color: '#10b981', padding: '0.15rem 0.4rem', borderRadius: '4px', marginLeft: 'auto' }}>{t('common.soon')}</span>
            </div>
            <div style={{ height: '1px', backgroundColor: '#2a2a2a', margin: '0.25rem 0' }} />
            <Link
              to="/tools"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.6rem 1rem',
                borderRadius: '8px',
                color: '#22d3ee',
                textDecoration: 'none',
                fontSize: '0.8rem',
                fontWeight: '500',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#22d3ee15'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              {t('nav.viewAllTools')}
            </Link>
          </div>
        )}
      </div>

      {/* Community Dropdown */}
      <div 
        style={{ position: 'relative' }}
        onMouseEnter={handleCommunityEnter}
        onMouseLeave={handleCommunityLeave}
      >
        <button
          style={{
            color: (isActive('/players') || isActive('/about') || isActive('/contribute-data') || isActive('/ambassadors') || isActive('/kingdoms/communities')) ? '#22d3ee' : '#9ca3af',
            textDecoration: 'none',
            fontSize: '0.9rem',
            fontWeight: (isActive('/players') || isActive('/about') || isActive('/contribute-data') || isActive('/ambassadors') || isActive('/kingdoms/communities')) ? '600' : '400',
            transition: 'color 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            ...((isActive('/players') || isActive('/about') || isActive('/contribute-data') || isActive('/ambassadors') || isActive('/kingdoms/communities')) ? neonGlow('#22d3ee') : {})
          }}
        >
          {t('nav.community')}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.6 }}>
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>
        
        {showCommunityMenu && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            paddingTop: '0.5rem',
            backgroundColor: '#111111',
            border: '1px solid #2a2a2a',
            borderRadius: '12px',
            padding: '0.5rem',
            minWidth: '180px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.6)',
            zIndex: 1000
          }}>
            <Link
              to="/players"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                color: isActive('/players') ? '#22d3ee' : '#fff',
                textDecoration: 'none',
                fontSize: '0.85rem',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#22d3ee' }}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              {t('nav.playerDirectory')}
            </Link>
            <Link
              to="/kingdoms/communities"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                color: isActive('/kingdoms/communities') ? '#22d3ee' : '#fff',
                textDecoration: 'none',
                fontSize: '0.85rem',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#ffc30b' }}>
                <path d="M3 21h18"/>
                <path d="M5 21V7l8-4v18"/>
                <path d="M19 21V11l-6-4"/>
                <path d="M9 9v.01M9 12v.01M9 15v.01M9 18v.01"/>
              </svg>
              {t('nav.kingdomCommunities', 'Kingdom Communities')}
            </Link>
            <Link
              to="/ambassadors"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                color: isActive('/ambassadors') ? '#22d3ee' : '#fff',
                textDecoration: 'none',
                fontSize: '0.85rem',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#a24cf3' }}>
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
              {t('nav.ambassadors')}
            </Link>
            <Link
              to="/contribute-data"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                color: isActive('/contribute-data') ? '#22d3ee' : '#fff',
                textDecoration: 'none',
                fontSize: '0.85rem',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#f97316' }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
              {t('nav.contributeData')}
            </Link>
            <a
              href={DISCORD_INVITE}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                color: '#fff',
                textDecoration: 'none',
                fontSize: '0.85rem',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#5865F2' }}>
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              {t('common.joinDiscord')}
            </a>
            <div style={{ height: '1px', backgroundColor: '#2a2a2a', margin: '0.25rem 0' }} />
            <Link
              to="/about"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                color: isActive('/about') ? '#22d3ee' : '#fff',
                textDecoration: 'none',
                fontSize: '0.85rem',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#9ca3af' }}>
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
              {t('nav.aboutAtlas')}
            </Link>
          </div>
        )}
      </div>

      {/* Support Atlas Button */}
      <Link
        to="/support"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          color: '#ff6b8a',
          textDecoration: 'none',
          fontSize: '0.85rem',
          fontWeight: '500',
          padding: '0.4rem 0.75rem',
          backgroundColor: '#ff6b8a15',
          border: '1px solid #ff6b8a40',
          borderRadius: '6px',
          whiteSpace: 'nowrap'
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
        {t('common.supportUs')}
      </Link>
      
      {/* Notification Bell - only for logged in users */}
      {user && <NotificationBell />}

      {/* Language Switcher */}
      <div ref={langMenuRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setShowLangMenu(!showLangMenu)}
          aria-label={t('languageSwitcher.label')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            padding: '0.35rem 0.5rem',
            backgroundColor: 'transparent',
            border: '1px solid #333',
            borderRadius: '6px',
            color: '#9ca3af',
            cursor: 'pointer',
            fontSize: '0.8rem',
            transition: 'border-color 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = '#555'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = '#333'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
          {LANGUAGE_OPTIONS.find(l => l.code === i18n.language)?.flag ?? '🇺🇸'}
        </button>
        {showLangMenu && (
          <div style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '0.5rem',
            backgroundColor: '#111111',
            border: '1px solid #2a2a2a',
            borderRadius: '10px',
            padding: '0.35rem',
            minWidth: '140px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.6)',
            zIndex: 1000
          }}>
            {LANGUAGE_OPTIONS.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleChangeLanguage(lang.code)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.6rem 0.75rem',
                  backgroundColor: i18n.language === lang.code ? '#22d3ee15' : 'transparent',
                  border: i18n.language === lang.code ? '1px solid #22d3ee40' : '1px solid transparent',
                  borderRadius: '6px',
                  color: i18n.language === lang.code ? '#22d3ee' : '#fff',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  textAlign: 'left',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => { if (i18n.language !== lang.code) e.currentTarget.style.backgroundColor = '#1a1a1a'; }}
                onMouseLeave={(e) => { if (i18n.language !== lang.code) e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <span>{lang.flag}</span>
                {lang.label}
                {i18n.language === lang.code && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ marginInlineStart: 'auto' }}>
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* UserMenu slot */}
      {children}
    </nav>
  );
};

export default DesktopNav;
