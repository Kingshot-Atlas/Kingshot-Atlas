import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getCacheBustedAvatarUrl, UserProfile } from '../../contexts/AuthContext';

interface UserMenuProps {
  user: boolean;
  profile: UserProfile | null;
  isAdmin: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

const UserMenu: React.FC<UserMenuProps> = ({ user, profile, isAdmin, onSignIn, onSignOut }) => {
  const { t } = useTranslation();
  const [showLoginMenu, setShowLoginMenu] = useState(false);

  return (
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
          onClick={onSignIn}
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
          {t('common.signIn')}
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
            {t('common.myProfile')}
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
              {t('common.admin')}
            </Link>
          )}
          <div style={{ height: '1px', backgroundColor: '#2a2a2a', margin: '0.25rem 0' }} />
          <button
            onClick={() => { onSignOut(); setShowLoginMenu(false); }}
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
            {t('common.signOut')}
          </button>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
