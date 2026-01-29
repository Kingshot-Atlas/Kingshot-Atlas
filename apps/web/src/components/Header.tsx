import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth, getCacheBustedAvatarUrl } from '../contexts/AuthContext';
import AuthModal from './AuthModal';
import KvKCountdown from './KvKCountdown';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useAnalytics } from '../hooks/useAnalytics';
import { neonGlow } from '../utils/styles';
import { useAccessibility } from '../contexts/AccessibilityContext';

// Admin users list - must match AdminDashboard.tsx
const ADMIN_USERS = ['gatreno'];

// Discord invite link - configurable via environment variable
const DISCORD_INVITE = process.env.REACT_APP_DISCORD_INVITE || 'https://discord.gg/aA3a7JGcHV';

const Header: React.FC = () => {
  const location = useLocation();
  const { user, profile, signOut } = useAuth();
  const { trackButton } = useAnalytics();
  const { highContrast, toggleHighContrast } = useAccessibility();
  const isAdmin = profile?.username && ADMIN_USERS.includes(profile.username.toLowerCase());
  const [showLoginMenu, setShowLoginMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    setShowMobileMenu(false);
    setShowLoginMenu(false);
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
        {/* Logo + Countdowns Section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.75rem' : '9rem' }}>
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

          {/* Countdowns - next to logo */}
          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <KvKCountdown navbar type="kvk" />
              <KvKCountdown navbar type="transfer" />
            </div>
          )}
        </div>

        {/* Mobile Menu Button + Discord */}
        {isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* Pro Button - visible on mobile header (left of Discord) */}
            <Link
              to="/upgrade"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.25rem',
                padding: '0.4rem 0.6rem',
                backgroundColor: '#22d3ee15',
                border: '1px solid #22d3ee40',
                borderRadius: '8px',
                color: '#22d3ee',
                textDecoration: 'none',
                fontSize: '0.75rem',
                fontWeight: '600'
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
              </svg>
              Pro
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
          <Link
            to="/compare"
            style={{
              color: isActive('/compare') ? '#22d3ee' : '#9ca3af',
              textDecoration: 'none',
              fontSize: '0.9rem',
              fontWeight: isActive('/compare') ? '600' : '400',
              transition: 'color 0.2s',
              ...(isActive('/compare') ? neonGlow('#22d3ee') : {})
            }}
          >
            Compare
          </Link>
          <Link
            to="/about"
            style={{
              color: isActive('/about') ? '#22d3ee' : '#9ca3af',
              textDecoration: 'none',
              fontSize: '0.9rem',
              fontWeight: isActive('/about') ? '600' : '400',
              transition: 'color 0.2s',
              ...(isActive('/about') ? neonGlow('#22d3ee') : {})
            }}
          >
            About
          </Link>
          <Link
            to="/upgrade"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              color: '#22d3ee',
              textDecoration: 'none',
              fontSize: '0.85rem',
              fontWeight: '600',
              padding: '0.35rem 0.65rem',
              backgroundColor: '#22d3ee15',
              border: '1px solid #22d3ee40',
              borderRadius: '6px',
              transition: 'all 0.2s'
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
            </svg>
            Pro
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
          
          {/* Accessibility Toggle */}
          <button
            onClick={() => {
              toggleHighContrast();
              trackButton('Toggle High Contrast');
            }}
            title={highContrast ? 'Disable high contrast mode' : 'Enable high contrast mode'}
            aria-label={highContrast ? 'Disable high contrast mode' : 'Enable high contrast mode'}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              padding: 0,
              backgroundColor: highContrast ? '#ffffff' : '#1a1a1a',
              border: `1px solid ${highContrast ? '#ffffff' : '#333'}`,
              borderRadius: '6px',
              color: highContrast ? '#000000' : '#9ca3af',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          </button>
          
          <a
            href={DISCORD_INVITE}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.4rem 0.75rem',
              backgroundColor: '#5865F2',
              borderRadius: '6px',
              color: '#fff',
              textDecoration: 'none',
              fontSize: '0.85rem',
              fontWeight: '500'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            Discord
          </a>
          
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
                {profile?.avatar_url ? (
                  <img src={getCacheBustedAvatarUrl(profile.avatar_url)} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%' }} />
                ) : (
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: profile?.theme_color || '#22d3ee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold', color: '#000' }}>
                    {profile?.username?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                {profile?.username || 'User'}
              </button>
            ) : (
              <button
                onClick={() => { trackButton('Sign In Button'); setShowAuthModal(true); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  backgroundColor: '#111111',
                  border: '1px solid #2a2a2a',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                <svg style={{ width: '18px', height: '18px', color: '#9ca3af' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          {/* Sign In / Profile - First Item */}
          {user ? (
            <Link
              to="/profile"
              style={{
                color: '#22d3ee',
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
              {profile?.avatar_url ? (
                <img src={getCacheBustedAvatarUrl(profile.avatar_url)} alt="" style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
              ) : (
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: profile?.theme_color || '#22d3ee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 'bold', color: '#000' }}>
                  {profile?.username?.[0]?.toUpperCase() || '?'}
                </div>
              )}
              {profile?.username || 'My Profile'}
            </Link>
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
          <Link
            to="/compare"
            style={{
              color: isActive('/compare') ? '#22d3ee' : '#9ca3af',
              textDecoration: 'none',
              fontSize: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              backgroundColor: isActive('/compare') ? '#111' : 'transparent'
            }}
          >
            Compare
          </Link>
          <Link
            to="/about"
            style={{
              color: isActive('/about') ? '#22d3ee' : '#9ca3af',
              textDecoration: 'none',
              fontSize: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              backgroundColor: isActive('/about') ? '#111' : 'transparent'
            }}
          >
            About
          </Link>
          <Link
            to="/upgrade"
            style={{
              color: '#22d3ee',
              textDecoration: 'none',
              fontSize: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: '#22d3ee15',
              border: '1px solid #22d3ee40'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
            </svg>
            Upgrade to Pro
          </Link>
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
