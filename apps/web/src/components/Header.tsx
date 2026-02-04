import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth, getCacheBustedAvatarUrl } from '../contexts/AuthContext';
import AuthModal from './AuthModal';
import KvKCountdown from './KvKCountdown';
import NotificationBell from './NotificationBell';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useAnalytics } from '../hooks/useAnalytics';
import { neonGlow } from '../utils/styles';
import { ADMIN_USERNAMES, getDisplayTier, SUBSCRIPTION_COLORS } from '../utils/constants';

// Discord invite link - configurable via environment variable
const DISCORD_INVITE = import.meta.env.VITE_DISCORD_INVITE || 'https://discord.gg/cajcacDzGd';

const Header: React.FC = () => {
  const location = useLocation();
  const { user, profile, signOut } = useAuth();
  const { trackButton } = useAnalytics();
  const isAdmin = profile?.username && ADMIN_USERNAMES.includes(profile.username.toLowerCase());
  const [showLoginMenu, setShowLoginMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [showMobileToolsMenu, setShowMobileToolsMenu] = useState(false);
  const [showCommunityMenu, setShowCommunityMenu] = useState(false);
  const [showMobileCommunityMenu, setShowMobileCommunityMenu] = useState(false);
  const isMobile = useIsMobile();
  
  // Timeout refs for dropdown close delay (prevents flickering when moving between trigger and menu)
  const toolsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const communityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const handleToolsEnter = () => {
    if (toolsTimeoutRef.current) clearTimeout(toolsTimeoutRef.current);
    setShowToolsMenu(true);
  };
  
  const handleToolsLeave = () => {
    toolsTimeoutRef.current = setTimeout(() => setShowToolsMenu(false), 150);
  };
  
  const handleCommunityEnter = () => {
    if (communityTimeoutRef.current) clearTimeout(communityTimeoutRef.current);
    setShowCommunityMenu(true);
  };
  
  const handleCommunityLeave = () => {
    communityTimeoutRef.current = setTimeout(() => setShowCommunityMenu(false), 150);
  };

  useEffect(() => {
    setShowMobileMenu(false);
    setShowLoginMenu(false);
    setShowToolsMenu(false);
  }, [location.pathname]);
  
  const isActive = (path: string) => location.pathname === path;

  return (
    <header style={{
      backgroundColor: '#0a0a0a',
      borderBottom: '1px solid #333333',
      padding: isMobile ? '0 1rem' : '0 2rem',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '56px'
      }}>
        {/* Logo Section */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
          <img 
            src="/Atlas Favicon.png" 
            alt="KA" 
            style={{
              width: isMobile ? '28px' : '32px',
              height: isMobile ? '28px' : '32px',
              objectFit: 'contain'
            }}
          />
          {!isMobile && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.1rem' }}>
              <span style={{ 
                color: '#fff', 
                fontSize: '1rem', 
                fontWeight: 'bold', 
                fontFamily: "'Cinzel', 'Times New Roman', serif",
                lineHeight: 1
              }}>
                KINGSHOT
              </span>
              <span style={{ 
                ...neonGlow('#22d3ee'), 
                fontSize: '1.4rem', 
                fontWeight: 'bold', 
                fontFamily: "'Cinzel', 'Times New Roman', serif",
                lineHeight: 1
              }}>
                ATLAS
              </span>
            </div>
          )}
          {isMobile && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0' }}>
              <span style={{ 
                color: '#fff', 
                fontSize: '0.65rem', 
                fontWeight: 'bold', 
                fontFamily: "'Cinzel', 'Times New Roman', serif",
                lineHeight: 1.1,
                letterSpacing: '0.02em'
              }}>
                KINGSHOT
              </span>
              <span style={{ 
                ...neonGlow('#22d3ee'), 
                fontSize: '0.95rem', 
                fontWeight: 'bold', 
                fontFamily: "'Cinzel', 'Times New Roman', serif",
                lineHeight: 1,
                letterSpacing: '0.02em'
              }}>
                ATLAS
              </span>
            </div>
          )}
        </Link>

        {/* Countdowns - centered between logo and nav */}
        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <KvKCountdown navbar type="kvk" />
            <KvKCountdown navbar type="transfer" />
          </div>
        )}

        {/* Mobile Menu Button + Discord */}
        {isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* Support Atlas Button */}
            <Link
              to="/support"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.25rem',
                padding: '0.4rem 0.6rem',
                backgroundColor: '#ff6b8a15',
                border: '1px solid #ff6b8a40',
                borderRadius: '8px',
                color: '#ff6b8a',
                textDecoration: 'none',
                fontSize: '0.7rem',
                fontWeight: '600'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
              Support Us
            </Link>
            {/* Discord Button - visible on mobile header */}
            <a
              href={DISCORD_INVITE}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                backgroundColor: '#5865F2',
                borderRadius: '8px',
                color: '#fff'
              }}
              aria-label="Join Discord"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
            </a>
            {/* Notification Bell - mobile */}
            {user && <NotificationBell />}
            {/* Hamburger Menu */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              style={{
                padding: '0.5rem',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#9ca3af',
                cursor: 'pointer'
              }}
            >
              {showMobileMenu ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        )}

        {/* Desktop Nav */}
        {!isMobile && (
        <nav style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
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
            Home
          </Link>
          <Link
            to="/leaderboards"
            style={{
              color: isActive('/leaderboards') ? '#22d3ee' : '#9ca3af',
              textDecoration: 'none',
              fontSize: '0.9rem',
              fontWeight: isActive('/leaderboards') ? '600' : '400',
              transition: 'color 0.2s',
              ...(isActive('/leaderboards') ? neonGlow('#22d3ee') : {})
            }}
          >
            Rankings
          </Link>
          <div 
            style={{ position: 'relative' }}
            onMouseEnter={handleToolsEnter}
            onMouseLeave={handleToolsLeave}
          >
            <Link
              to="/tools"
              style={{
                color: (isActive('/tools') || isActive('/compare')) ? '#22d3ee' : '#9ca3af',
                textDecoration: 'none',
                fontSize: '0.9rem',
                fontWeight: (isActive('/tools') || isActive('/compare')) ? '600' : '400',
                transition: 'color 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                ...((isActive('/tools') || isActive('/compare')) ? neonGlow('#22d3ee') : {})
              }}
            >
              Tools
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
                <a
                  href="https://discord.com/oauth2/authorize?client_id=1465531618965061672&permissions=2147485696&scope=bot%20applications.commands"
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
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#22d3ee' }}>
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                  Atlas Discord Bot
                </a>
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
                  Kingdom Comparison
                </Link>
                <div style={{ height: '1px', backgroundColor: '#2a2a2a', margin: '0.25rem 0' }} />
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
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#f59e0b', opacity: 0.5 }}>
                    <path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7"/>
                  </svg>
                  Gift Code Redeemer
                  <span style={{ fontSize: '0.6rem', backgroundColor: '#f59e0b20', color: '#f59e0b', padding: '0.15rem 0.4rem', borderRadius: '4px', marginLeft: 'auto' }}>Soon</span>
                </div>
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
                  Gaming Calculators
                  <span style={{ fontSize: '0.6rem', backgroundColor: '#10b98120', color: '#10b981', padding: '0.15rem 0.4rem', borderRadius: '4px', marginLeft: 'auto' }}>Soon</span>
                </div>
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
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#a855f7', opacity: 0.5 }}>
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  Appointment Scheduler
                  <span style={{ fontSize: '0.6rem', backgroundColor: '#a855f720', color: '#a855f7', padding: '0.15rem 0.4rem', borderRadius: '4px', marginLeft: 'auto' }}>Soon</span>
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
                  View All Tools →
                </Link>
              </div>
            )}
          </div>
          <div 
            style={{ position: 'relative' }}
            onMouseEnter={handleCommunityEnter}
            onMouseLeave={handleCommunityLeave}
          >
            <button
              style={{
                color: (isActive('/players') || isActive('/about') || isActive('/contribute-data')) ? '#22d3ee' : '#9ca3af',
                textDecoration: 'none',
                fontSize: '0.9rem',
                fontWeight: (isActive('/players') || isActive('/about') || isActive('/contribute-data')) ? '600' : '400',
                transition: 'color 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                ...((isActive('/players') || isActive('/about') || isActive('/contribute-data')) ? neonGlow('#22d3ee') : {})
              }}
            >
              Community
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
                  Player Directory
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
                  Contribute Data
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
                  Join Discord
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
                  About Atlas
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
            Support Us
          </Link>
          
          {/* <Link
            to="/players"
            style={{
              color: isActive('/players') ? '#22d3ee' : '#9ca3af',
              textDecoration: 'none',
              fontSize: '0.9rem',
              fontWeight: isActive('/players') ? '600' : '400',
              transition: 'color 0.2s',
              ...(isActive('/players') ? neonGlow('#22d3ee') : {})
            }}
          >
            Players
          </Link> */}
          
          {/* Notification Bell - only for logged in users */}
          {user && <NotificationBell />}
          
          <div style={{ position: 'relative' }}>
            {user ? (
              <button
                onClick={() => setShowLoginMenu(!showLoginMenu)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.35rem',
                  paddingRight: '0.75rem',
                  backgroundColor: '#111111',
                  border: '1px solid #2a2a2a',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                {(profile?.linked_avatar_url || profile?.avatar_url) ? (
                  <img src={getCacheBustedAvatarUrl(profile?.linked_avatar_url || profile?.avatar_url)} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%' }} />
                ) : (
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: profile?.theme_color || '#22d3ee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold', color: '#000' }}>
                    {(profile?.linked_username || profile?.username)?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                {profile?.linked_username || profile?.username || 'User'}
              </button>
            ) : (
              <button
                onClick={() => { trackButton('Sign In Button'); setShowAuthModal(true); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.4rem 0.75rem',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  whiteSpace: 'nowrap'
                }}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Sign In
              </button>
            )}

            {showLoginMenu && user && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '0.5rem',
                backgroundColor: '#111111',
                border: '1px solid #2a2a2a',
                borderRadius: '12px',
                padding: '0.5rem',
                minWidth: '180px',
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.6)',
                zIndex: 1000
              }}>
                <Link
                  to="/profile"
                  onClick={() => setShowLoginMenu(false)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    textAlign: 'left',
                    textDecoration: 'none',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <svg style={{ width: '18px', height: '18px', color: '#9ca3af' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  My Profile
                </Link>
                {isAdmin && (
                  <Link
                    to="/admin"
                    onClick={() => setShowLoginMenu(false)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem 1rem',
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#a855f7',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      textAlign: 'left',
                      textDecoration: 'none',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Admin Dashboard
                  </Link>
                )}
                <div style={{ height: '1px', backgroundColor: '#2a2a2a', margin: '0.25rem 0' }} />
                <button
                  onClick={() => { signOut(); setShowLoginMenu(false); }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ef4444',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    textAlign: 'left',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </nav>
        )}
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobile && showMobileMenu && (
        <div style={{
          position: 'absolute',
          top: '56px',
          left: 0,
          right: 0,
          backgroundColor: '#0a0a0a',
          borderBottom: '1px solid #2a2a2a',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          zIndex: 99
        }}>
          {/* Sign In / Profile - First Item - Show Kingshot account if linked */}
          {user ? (
            (() => {
              const displayTier = getDisplayTier(profile?.subscription_tier as 'free' | 'pro' | 'recruiter' | null, profile?.username);
              const usernameColor = SUBSCRIPTION_COLORS[displayTier as keyof typeof SUBSCRIPTION_COLORS] || '#ffffff';
              const displayName = profile?.linked_username || profile?.username || 'My Profile';
              const displayAvatar = profile?.linked_avatar_url || profile?.avatar_url;
              return (
                <Link
                  to="/profile"
                  style={{
                    color: usernameColor,
                    textDecoration: 'none',
                    fontSize: '1rem',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    backgroundColor: '#111'
                  }}
                >
                  {displayAvatar ? (
                    <img src={getCacheBustedAvatarUrl(displayAvatar)} alt="" style={{ width: '24px', height: '24px', borderRadius: '50%' }} referrerPolicy="no-referrer" />
                  ) : (
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: profile?.theme_color || '#22d3ee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 'bold', color: '#000' }}>
                      {displayName?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  {displayName}
                </Link>
              );
            })()
          ) : (
            <button
              onClick={() => { setShowAuthModal(true); setShowMobileMenu(false); }}
              style={{
                color: '#22d3ee',
                textDecoration: 'none',
                fontSize: '1rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: '#22d3ee20',
                border: '1px solid #22d3ee50',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Sign In
            </button>
          )}
          <div style={{ height: '1px', backgroundColor: '#1f1f1f', margin: '0.5rem 0' }} />
          <Link
            to="/"
            style={{
              color: isActive('/') ? '#22d3ee' : '#9ca3af',
              textDecoration: 'none',
              fontSize: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              backgroundColor: isActive('/') ? '#111' : 'transparent'
            }}
          >
            Home
          </Link>
          <Link
            to="/leaderboards"
            style={{
              color: isActive('/leaderboards') ? '#22d3ee' : '#9ca3af',
              textDecoration: 'none',
              fontSize: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              backgroundColor: isActive('/leaderboards') ? '#111' : 'transparent'
            }}
          >
            Rankings
          </Link>
          <button
            onClick={() => setShowMobileToolsMenu(!showMobileToolsMenu)}
            style={{
              color: (isActive('/tools') || isActive('/compare')) ? '#22d3ee' : '#9ca3af',
              textDecoration: 'none',
              fontSize: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              backgroundColor: (isActive('/tools') || isActive('/compare')) ? '#111' : 'transparent',
              border: 'none',
              width: '100%',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            Tools
            <svg 
              width="12" 
              height="12" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
              style={{ 
                transform: showMobileToolsMenu ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s'
              }}
            >
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
          {showMobileToolsMenu && (
            <Link
              to="/compare"
              style={{
                color: isActive('/compare') ? '#22d3ee' : '#6b7280',
                textDecoration: 'none',
                fontSize: '0.9rem',
                padding: '0.5rem 1rem 0.5rem 1.5rem',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <span style={{ color: '#333' }}>└</span> Kingdom Comparison
            </Link>
          )}
          <button
            onClick={() => setShowMobileCommunityMenu(!showMobileCommunityMenu)}
            style={{
              color: (isActive('/players') || isActive('/about') || isActive('/contribute-data')) ? '#22d3ee' : '#9ca3af',
              textDecoration: 'none',
              fontSize: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              backgroundColor: (isActive('/players') || isActive('/about') || isActive('/contribute-data')) ? '#111' : 'transparent',
              border: 'none',
              width: '100%',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            Community
            <svg 
              width="12" 
              height="12" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
              style={{ 
                transform: showMobileCommunityMenu ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s'
              }}
            >
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
          {showMobileCommunityMenu && (
            <>
              <Link
                to="/players"
                style={{
                  color: isActive('/players') ? '#22d3ee' : '#6b7280',
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                  padding: '0.5rem 1rem 0.5rem 1.5rem',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <span style={{ color: '#333' }}>└</span> Player Directory
              </Link>
              <Link
                to="/contribute-data"
                style={{
                  color: isActive('/contribute-data') ? '#22d3ee' : '#6b7280',
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                  padding: '0.5rem 1rem 0.5rem 1.5rem',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <span style={{ color: '#333' }}>└</span> Contribute Data
              </Link>
              <Link
                to="/about"
                style={{
                  color: isActive('/about') ? '#22d3ee' : '#6b7280',
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                  padding: '0.5rem 1rem 0.5rem 1.5rem',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <span style={{ color: '#333' }}>└</span> About Atlas
              </Link>
            </>
          )}
          {/* Admin Dashboard - Only visible to admins */}
          {isAdmin && (
            <Link
              to="/admin"
              style={{
                color: '#a855f7',
                textDecoration: 'none',
                fontSize: '1rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: '#a855f715',
                border: '1px solid #a855f740'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Admin Dashboard
            </Link>
          )}
          <div style={{ height: '1px', backgroundColor: '#1f1f1f', margin: '0.5rem 0' }} />
          <a
            href={DISCORD_INVITE}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#fff',
              textDecoration: 'none',
              fontSize: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: '#5865F2'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            Join Discord
          </a>
          {/* Sign Out Button - Mobile Menu */}
          {user && (
            <>
              <div style={{ height: '1px', backgroundColor: '#1f1f1f', margin: '0.5rem 0' }} />
              <button
                onClick={() => { signOut(); setShowMobileMenu(false); }}
                style={{
                  color: '#ef4444',
                  textDecoration: 'none',
                  fontSize: '1rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: '#ef444415',
                  border: '1px solid #ef444440',
                  width: '100%',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            </>
          )}
          <div style={{ height: '1px', backgroundColor: '#1f1f1f', margin: '0.5rem 0' }} />
          {/* <Link
            to="/players"
            style={{
              color: '#9ca3af',
              textDecoration: 'none',
              fontSize: '0.9rem',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#111111';
              e.currentTarget.style.color = '#22d3ee';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#9ca3af';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Players
          </Link> */}
                  </div>
      )}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </header>
  );
};

export default Header;
