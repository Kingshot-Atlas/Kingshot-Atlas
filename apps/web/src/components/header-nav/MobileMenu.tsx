import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getCacheBustedAvatarUrl, UserProfile } from '../../contexts/AuthContext';
import { getDisplayTier, SUBSCRIPTION_COLORS } from '../../utils/constants';
import { useReferralLink } from '../../hooks/useReferralLink';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useGoldKingdoms } from '../../hooks/useGoldKingdoms';

const DISCORD_INVITE = import.meta.env.VITE_DISCORD_INVITE || 'https://discord.gg/cajcacDzGd';

interface MobileMenuProps {
  isActive: (path: string) => boolean;
  user: boolean;
  profile: UserProfile | null;
  isAdmin: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  onClose: () => void;
}

const MobileMenu: React.FC<MobileMenuProps> = ({ isActive, user, profile, isAdmin, onSignIn, onSignOut, onClose }) => {
  const { t } = useTranslation();
  const [showMobileToolsMenu, setShowMobileToolsMenu] = useState(false);
  const [showMobileCommunityMenu, setShowMobileCommunityMenu] = useState(false);
  const [showMobileRankingsMenu, setShowMobileRankingsMenu] = useState(false);
  const [refCopied, setRefCopied] = useState(false);
  const { eligible: referralEligible, copyCurrentPageLink } = useReferralLink();
  const { trackFeature } = useAnalytics();
  const goldKingdoms = useGoldKingdoms();

  const chevronStyle = (open: boolean): React.CSSProperties => ({
    transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
    transition: 'transform 0.2s'
  });

  return (
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
      zIndex: 99,
      maxHeight: 'calc(100vh - 56px)',
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch'
    }}>
      {/* Sign In / Profile */}
      {user ? (
        (() => {
          const displayTier = getDisplayTier(profile?.subscription_tier, profile?.username, profile?.linked_kingdom, goldKingdoms);
          const usernameColor = SUBSCRIPTION_COLORS[displayTier as keyof typeof SUBSCRIPTION_COLORS] || '#ffffff';
          const displayName = profile?.linked_username || profile?.username || t('common.myProfile');
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
          onClick={() => { onSignIn(); onClose(); }}
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
          {t('common.signIn')}
        </button>
      )}

      <div style={{ height: '1px', backgroundColor: '#1f1f1f', margin: '0.5rem 0' }} />

      {/* Home */}
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
        {t('nav.home')}
      </Link>

      {/* Rankings */}
      <button
        onClick={() => setShowMobileRankingsMenu(!showMobileRankingsMenu)}
        style={{
          color: (isActive('/rankings') || isActive('/seasons') || location.pathname.startsWith('/seasons/')) ? '#22d3ee' : '#9ca3af',
          textDecoration: 'none',
          fontSize: '1rem',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          backgroundColor: (isActive('/rankings') || isActive('/seasons') || location.pathname.startsWith('/seasons/')) ? '#111' : 'transparent',
          border: 'none',
          width: '100%',
          textAlign: 'left',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        {t('nav.rankings')}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={chevronStyle(showMobileRankingsMenu)}>
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
      {showMobileRankingsMenu && (
        <>
          <Link to="/rankings" style={{ color: isActive('/rankings') ? '#22d3ee' : '#6b7280', textDecoration: 'none', fontSize: '0.9rem', padding: '0.5rem 1rem 0.5rem 1.5rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: '#333' }}>└</span> {t('nav.kingdomRankings')}
          </Link>
          <Link to="/seasons" style={{ color: (isActive('/seasons') || location.pathname.startsWith('/seasons/')) ? '#22d3ee' : '#6b7280', textDecoration: 'none', fontSize: '0.9rem', padding: '0.5rem 1rem 0.5rem 1.5rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: '#333' }}>└</span> {t('nav.kvkSeasons')}
          </Link>
        </>
      )}

      {/* Tools */}
      <button
        onClick={() => setShowMobileToolsMenu(!showMobileToolsMenu)}
        style={{
          color: (isActive('/tools') || isActive('/compare') || isActive('/atlas-bot') || isActive('/transfer-hub') || isActive('/transfer-hub/about')) ? '#22d3ee' : '#9ca3af',
          textDecoration: 'none',
          fontSize: '1rem',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          backgroundColor: (isActive('/tools') || isActive('/compare') || isActive('/atlas-bot') || isActive('/transfer-hub') || isActive('/transfer-hub/about')) ? '#111' : 'transparent',
          border: 'none',
          width: '100%',
          textAlign: 'left',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        {t('nav.tools')}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={chevronStyle(showMobileToolsMenu)}>
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
      {showMobileToolsMenu && (
        <>
          <Link to="/transfer-hub/about" style={{ color: (isActive('/transfer-hub') || isActive('/transfer-hub/about')) ? '#22d3ee' : '#6b7280', textDecoration: 'none', fontSize: '0.9rem', padding: '0.5rem 1rem 0.5rem 1.5rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: '#333' }}>└</span> {t('nav.transferHub')}
          </Link>
          <Link to="/tools/battle-planner" style={{ color: isActive('/tools/battle-planner') ? '#22d3ee' : '#6b7280', textDecoration: 'none', fontSize: '0.9rem', padding: '0.5rem 1rem 0.5rem 1.5rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: '#333' }}>└</span> {t('nav.kvkBattleCoordinator')}
          </Link>
          <Link to="/atlas-bot" style={{ color: isActive('/atlas-bot') ? '#22d3ee' : '#6b7280', textDecoration: 'none', fontSize: '0.9rem', padding: '0.5rem 1rem 0.5rem 1.5rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: '#333' }}>└</span> {t('nav.atlasBot')}
          </Link>
          <Link to="/gift-codes" style={{ color: isActive('/gift-codes') ? '#22d3ee' : '#6b7280', textDecoration: 'none', fontSize: '0.9rem', padding: '0.5rem 1rem 0.5rem 1.5rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: '#333' }}>└</span> {t('nav.giftCodeRedeemer')}
          </Link>
          <Link to="/compare" style={{ color: isActive('/compare') ? '#22d3ee' : '#6b7280', textDecoration: 'none', fontSize: '0.9rem', padding: '0.5rem 1rem 0.5rem 1.5rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: '#333' }}>└</span> {t('nav.kingdomComparison')}
          </Link>
          <div style={{ color: '#4b5563', fontSize: '0.9rem', padding: '0.5rem 1rem 0.5rem 1.5rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: '#333' }}>└</span> {t('nav.appointmentScheduler')}
            <span style={{ fontSize: '0.55rem', backgroundColor: '#a855f720', color: '#a855f7', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>{t('common.soon')}</span>
          </div>
          <div style={{ color: '#4b5563', fontSize: '0.9rem', padding: '0.5rem 1rem 0.5rem 1.5rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: '#333' }}>└</span> {t('nav.gamingCalculators')}
            <span style={{ fontSize: '0.55rem', backgroundColor: '#10b98120', color: '#10b981', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>{t('common.soon')}</span>
          </div>
        </>
      )}

      {/* Community */}
      <button
        onClick={() => setShowMobileCommunityMenu(!showMobileCommunityMenu)}
        style={{
          color: (isActive('/players') || isActive('/about') || isActive('/contribute-data') || isActive('/ambassadors') || isActive('/kingdoms/communities')) ? '#22d3ee' : '#9ca3af',
          textDecoration: 'none',
          fontSize: '1rem',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          backgroundColor: (isActive('/players') || isActive('/about') || isActive('/contribute-data') || isActive('/ambassadors') || isActive('/kingdoms/communities')) ? '#111' : 'transparent',
          border: 'none',
          width: '100%',
          textAlign: 'left',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        {t('nav.community')}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={chevronStyle(showMobileCommunityMenu)}>
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
      {showMobileCommunityMenu && (
        <>
          <Link to="/players" style={{ color: isActive('/players') ? '#22d3ee' : '#6b7280', textDecoration: 'none', fontSize: '0.9rem', padding: '0.5rem 1rem 0.5rem 1.5rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: '#333' }}>└</span> {t('nav.playerDirectory')}
          </Link>
          <Link to="/kingdoms/communities" style={{ color: isActive('/kingdoms/communities') ? '#22d3ee' : '#6b7280', textDecoration: 'none', fontSize: '0.9rem', padding: '0.5rem 1rem 0.5rem 1.5rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: '#333' }}>└</span> {t('nav.kingdomCommunities', 'Kingdom Communities')}
          </Link>
          <Link to="/ambassadors" style={{ color: isActive('/ambassadors') ? '#22d3ee' : '#6b7280', textDecoration: 'none', fontSize: '0.9rem', padding: '0.5rem 1rem 0.5rem 1.5rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: '#333' }}>└</span> {t('nav.ambassadors')}
          </Link>
          <Link to="/contribute-data" style={{ color: isActive('/contribute-data') ? '#22d3ee' : '#6b7280', textDecoration: 'none', fontSize: '0.9rem', padding: '0.5rem 1rem 0.5rem 1.5rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: '#333' }}>└</span> {t('nav.contributeData')}
          </Link>
          <Link to="/about" style={{ color: isActive('/about') ? '#22d3ee' : '#6b7280', textDecoration: 'none', fontSize: '0.9rem', padding: '0.5rem 1rem 0.5rem 1.5rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: '#333' }}>└</span> {t('nav.aboutAtlas')}
          </Link>
        </>
      )}

      {/* Admin Dashboard */}
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
          {t('common.admin')}
        </Link>
      )}

      <div style={{ height: '1px', backgroundColor: '#1f1f1f', margin: '0.5rem 0' }} />

      {/* Discord */}
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
        {t('common.joinDiscord')}
      </a>

      {/* Copy Referral Link */}
      {user && referralEligible && (
        <button
          onClick={async () => {
            const ok = await copyCurrentPageLink();
            if (ok) {
              setRefCopied(true);
              trackFeature('Referral Link Copied', { source: 'mobile_menu' });
              setTimeout(() => setRefCopied(false), 2000);
            }
          }}
          style={{
            color: refCopied ? '#22c55e' : '#a855f7',
            textDecoration: 'none',
            fontSize: '1rem',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: refCopied ? '#22c55e15' : '#a855f715',
            border: `1px solid ${refCopied ? '#22c55e40' : '#a855f740'}`,
            width: '100%',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.2s'
          }}
        >
          {refCopied ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          )}
          {refCopied ? t('common.copied', 'Copied!') : t('referral.copyLink', 'Copy Referral Link')}
        </button>
      )}

      {/* Sign Out */}
      {user && (
        <>
          <div style={{ height: '1px', backgroundColor: '#1f1f1f', margin: '0.5rem 0' }} />
          <button
            onClick={() => { onSignOut(); onClose(); }}
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
            {t('common.signOut')}
          </button>
        </>
      )}
      <div style={{ height: '1px', backgroundColor: '#1f1f1f', margin: '0.5rem 0' }} />
    </div>
  );
};

export default MobileMenu;
