import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
const AuthModal = lazy(() => import('./AuthModal'));
import KvKCountdown from './KvKCountdown';
const NotificationBell = lazy(() => import('./NotificationBell'));
import { useIsMobile } from '../hooks/useMediaQuery';
import { useAnalytics } from '../hooks/useAnalytics';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, LANGUAGE_META } from '../i18n';
import { neonGlow, FONT_DISPLAY } from '../utils/styles';
import { ADMIN_USERNAMES } from '../utils/constants';
import { DesktopNav, MobileMenu, UserMenu } from './header-nav';
import { useUnreadMessages } from '../hooks/useUnreadMessages';

// Discord invite link - configurable via environment variable
const DISCORD_INVITE = import.meta.env.VITE_DISCORD_INVITE || 'https://discord.gg/cajcacDzGd';

const LANGUAGE_OPTIONS = SUPPORTED_LANGUAGES.map(code => ({
  code,
  ...LANGUAGE_META[code],
}));

const Header: React.FC = () => {
  const location = useLocation();
  const { user, profile, signOut } = useAuth();
  const { trackButton } = useAnalytics();
  const { i18n } = useTranslation();
  const [showMobileLangMenu, setShowMobileLangMenu] = useState(false);
  const mobileLangMenuRef = useRef<HTMLDivElement>(null);
  const isAdmin = !!(profile?.username && ADMIN_USERNAMES.includes(profile.username.toLowerCase()));
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const isMobile = useIsMobile();
  const unreadMsgCount = useUnreadMessages();


  // Close mobile language menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (mobileLangMenuRef.current && !mobileLangMenuRef.current.contains(e.target as Node)) {
        setShowMobileLangMenu(false);
      }
    };
    if (showMobileLangMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMobileLangMenu]);

  const changeLanguage = (code: string) => {
    i18n.changeLanguage(code);
    const meta = LANGUAGE_META[code as keyof typeof LANGUAGE_META];
    if (meta) {
      document.documentElement.dir = meta.dir;
      document.documentElement.lang = code;
    }
    setShowMobileLangMenu(false);
    trackButton(`Language Switch: ${code}`);
  };

  useEffect(() => {
    setShowMobileMenu(false);
  }, [location.pathname]);

  // Lock body scroll when mobile menu is open (preserves scroll position)
  useEffect(() => {
    if (showMobileMenu) {
      const scrollY = window.scrollY;
      document.body.style.top = `-${scrollY}px`;
      document.body.classList.add('menu-open');
    } else {
      const scrollY = document.body.style.top;
      document.body.classList.remove('menu-open');
      document.body.style.top = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    }
    return () => {
      const scrollY = document.body.style.top;
      document.body.classList.remove('menu-open');
      document.body.style.top = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    };
  }, [showMobileMenu]);
  
  const isActive = (path: string) => location.pathname === path;

  const handleSignIn = () => { trackButton('Sign In Button'); setShowAuthModal(true); };

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
            src="/atlas-favicon.png" 
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
                fontFamily: FONT_DISPLAY,
                lineHeight: 1
              }}>
                KINGSHOT
              </span>
              <span style={{ 
                ...neonGlow('#22d3ee'), 
                fontSize: '1.4rem', 
                fontWeight: 'bold', 
                fontFamily: FONT_DISPLAY,
                lineHeight: 1
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {/* Support Atlas Button */}
            <Link
              to="/support"
              onClick={() => trackButton('Upgrade Click: Header Mobile')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.15rem',
                padding: '0.35rem 0.6rem',
                minHeight: '44px',
                backgroundColor: '#ff6b8a15',
                border: '1px solid #ff6b8a40',
                borderRadius: '8px',
                color: '#ff6b8a',
                textDecoration: 'none',
                fontSize: '0.6rem',
                fontWeight: '600',
                lineHeight: 1
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
              <span>Support</span>
            </Link>
            {/* Discord Button */}
            <a
              href={DISCORD_INVITE}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '44px',
                height: '44px',
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
            {user && <Suspense fallback={null}><NotificationBell /></Suspense>}
            {/* Mobile Language Switcher */}
            <div ref={mobileLangMenuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setShowMobileLangMenu(!showMobileLangMenu)}
                aria-label="Change language"
                style={{
                  width: '44px',
                  height: '44px',
                  padding: 0,
                  backgroundColor: showMobileLangMenu ? '#22d3ee20' : 'transparent',
                  border: showMobileLangMenu ? '1px solid #22d3ee' : '1px solid #2a2a2a',
                  borderRadius: '8px',
                  color: showMobileLangMenu ? '#22d3ee' : '#9ca3af',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease'
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </button>
              {showMobileLangMenu && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '6px',
                  backgroundColor: '#111116',
                  border: '1px solid #2a2a2a',
                  borderRadius: '10px',
                  padding: '0.25rem',
                  minWidth: '160px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  zIndex: 100,
                  animation: 'fadeIn 0.15s ease-out'
                }}>
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => changeLanguage(lang.code)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        width: '100%',
                        padding: '0.6rem 0.75rem',
                        backgroundColor: i18n.language === lang.code ? '#22d3ee15' : 'transparent',
                        border: 'none',
                        borderRadius: '8px',
                        color: i18n.language === lang.code ? '#22d3ee' : '#d1d5db',
                        fontSize: '0.9rem',
                        fontWeight: i18n.language === lang.code ? '600' : '400',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease'
                      }}
                    >
                      <span style={{ fontSize: '1.2rem' }}>{lang.flag}</span>
                      <span>{lang.label}</span>
                      {i18n.language === lang.code && (
                        <span style={{ marginInlineStart: 'auto', fontSize: '0.75rem' }}>✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Hamburger Menu */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              aria-label={showMobileMenu ? 'Close menu' : 'Open menu'}
              aria-expanded={showMobileMenu}
              style={{
                padding: '0.5rem',
                minWidth: '44px',
                minHeight: '44px',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#9ca3af',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
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
              {unreadMsgCount > 0 && !showMobileMenu && (
                <span style={{
                  position: 'absolute',
                  top: '4px',
                  right: '2px',
                  minWidth: '16px',
                  height: '16px',
                  padding: '0 3px',
                  backgroundColor: '#3b82f6',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '0.6rem',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #0a0a0a',
                  lineHeight: 1,
                }}>
                  {unreadMsgCount > 99 ? '99+' : unreadMsgCount}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Desktop Nav */}
        {!isMobile && (
          <DesktopNav isActive={isActive} user={!!user} changeLanguage={changeLanguage}>
            <UserMenu
              user={!!user}
              profile={profile}
              isAdmin={isAdmin}
              onSignIn={handleSignIn}
              onSignOut={signOut}
              unreadMsgCount={unreadMsgCount}
            />
          </DesktopNav>
        )}
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobile && showMobileMenu && (
        <MobileMenu
          isActive={isActive}
          user={!!user}
          profile={profile}
          isAdmin={isAdmin}
          onSignIn={() => setShowAuthModal(true)}
          onSignOut={signOut}
          onClose={() => setShowMobileMenu(false)}
          unreadMsgCount={unreadMsgCount}
        />
      )}
      {showAuthModal && <Suspense fallback={null}><AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} /></Suspense>}
    </header>
  );
};

export default Header;
