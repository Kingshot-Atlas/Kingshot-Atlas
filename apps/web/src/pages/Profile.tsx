import React, { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import ParticleEffect from '../components/ParticleEffect';
import UserAchievements from '../components/UserAchievements';
import SubmissionHistory from '../components/SubmissionHistory';
import AuthModal from '../components/AuthModal';
import ProfileFeatures from '../components/ProfileFeatures';
import LinkKingshotAccount from '../components/LinkKingshotAccount';
import LinkDiscordAccount from '../components/LinkDiscordAccount';
import PlayersFromMyKingdom from '../components/PlayersFromMyKingdom';
import { logger } from '../utils/logger';
import { ProfileEditForm, ProfileStatsGrid, AvatarWithFallback, ProfileLoadingFallback, SubscriptionSection, getTierBorderColor, getAuthProvider } from '../components/profile';
import type { EditForm } from '../components/profile';
import ReferralStats from '../components/ReferralStats';
import ReferralBadge from '../components/ReferralBadge';
import ProfileCompletionProgress from '../components/ProfileCompletionProgress';
import TransferReadinessScore from '../components/TransferReadinessScore';
import KingdomLeaderboardPosition from '../components/KingdomLeaderboardPosition';
import { ReferralTier, getHighestTierColor, SUBSCRIPTION_COLORS } from '../utils/constants';
import { useAuth, UserProfile, getDisplayName } from '../contexts/AuthContext';
import { usePremium } from '../contexts/PremiumContext';
import { useToast } from '../components/Toast';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { discordService } from '../services/discordService';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useIsMobile } from '../hooks/useMediaQuery';
import { neonGlow } from '../utils/styles';
import { isRandomUsername } from '../utils/randomUsername';
import { useTranslation } from 'react-i18next';


// Extracted to components/profile/: AvatarWithFallback, ProfileLoadingFallback, getTierBorderColor, getAuthProvider

const Profile: React.FC = () => {
  const { t } = useTranslation();
  const { userId } = useParams<{ userId?: string }>();
  useDocumentTitle(userId ? t('profile.publicProfile', 'User Profile') : t('common.myProfile', 'My Profile'));
  const { user, profile, loading, updateProfile, refreshLinkedPlayer } = useAuth();
  const { isSupporter, isAdmin } = usePremium();
  const { showToast } = useToast();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const isMobile = useIsMobile();
  const [viewedProfile, setViewedProfile] = useState<UserProfile | null>(null);
  const [isViewingOther, setIsViewingOther] = useState(false);
  const [viewedUserTier, setViewedUserTier] = useState<string>('free');
  const [referredByUsername, setReferredByUsername] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [hasShownWelcome, setHasShownWelcome] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    alliance_tag: '',
    language: '',
    region: '',
    bio: '',
    show_coordinates: false,
    coordinates: '',
  });

  // Structured coordinate fields for profile coordinates
  const [profileCoordKingdom, setProfileCoordKingdom] = useState<string>('');
  const [profileCoordX, setProfileCoordX] = useState<string>('');
  const [profileCoordY, setProfileCoordY] = useState<string>('');

  const themeColor = viewedProfile?.theme_color || '#22d3ee';
  
  // Discord linked toast — detect ?discord=linked after redirect from DiscordCallback
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('discord') === 'linked') {
      showToast('Discord account linked successfully! 🎉', 'success');
      searchParams.delete('discord');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, showToast]);

  // Welcome toast for new users (random username = new user)
  useEffect(() => {
    if (!hasShownWelcome && profile && !userId && isRandomUsername(profile.username)) {
      const welcomeKey = `atlas_welcomed_${profile.id}`;
      if (!localStorage.getItem(welcomeKey)) {
        showToast(t('profile.welcomeToast', 'Welcome to Atlas, {{name}}! 🌍', { name: profile.username }), 'info');
        localStorage.setItem(welcomeKey, 'true');
        setHasShownWelcome(true);
      }
    }
  }, [profile, userId, hasShownWelcome, showToast]);
  
  // Handle hash-based scroll (e.g. /profile#referral-program from Ambassadors page)
  useEffect(() => {
    const hash = window.location.hash?.replace('#', '');
    if (hash && !loading) {
      const el = document.getElementById(hash);
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth' });
          el.style.transition = 'box-shadow 0.3s ease';
          el.style.boxShadow = '0 0 0 2px #a24cf3, 0 0 20px rgba(162, 76, 243, 0.4)';
          setTimeout(() => { el.style.boxShadow = 'none'; }, 1500);
        }, 600);
      }
    }
  }, [loading]);

  // Scroll to link section helper with highlight animation
  const scrollToLinkSection = useCallback(() => {
    const linkSection = document.getElementById('link-kingshot-section');
    if (linkSection) {
      linkSection.scrollIntoView({ behavior: 'smooth' });
      // Add highlight animation after scroll completes
      setTimeout(() => {
        linkSection.style.transition = 'box-shadow 0.3s ease';
        linkSection.style.boxShadow = '0 0 0 2px #22d3ee, 0 0 20px rgba(34, 211, 238, 0.4)';
        setTimeout(() => {
          linkSection.style.boxShadow = 'none';
        }, 1500);
      }, 500);
    }
  }, []);

  useEffect(() => {
    if (userId) {
      // Viewing another user's profile
      setIsEditing(false); // Reset edit mode on navigation
      setViewedProfile(null); // Reset while loading
      const loadOtherProfile = async () => {
        // Try to fetch from Supabase first
        if (isSupabaseConfigured && supabase) {
          try {
            const { data, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', userId)
              .single();
            
            if (!error && data) {
              setViewedProfile(data as UserProfile);
              setIsViewingOther(true);
              // Set subscription tier from profile data - check is_admin first
              if (data.is_admin) {
                setViewedUserTier('admin');
              } else {
                setViewedUserTier(data.subscription_tier || 'free');
              }

              // Fetch "Referred by" info if profile was created within 30 days
              if (data.referred_by && data.created_at) {
                const createdAt = new Date(data.created_at);
                const daysSinceCreated = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
                if (daysSinceCreated <= 30) {
                  setReferredByUsername(data.referred_by);
                } else {
                  setReferredByUsername(null);
                }
              } else {
                setReferredByUsername(null);
              }
              return;
            }
          } catch (err) {
            logger.error('Failed to fetch profile:', err);
          }
        }

      };
      
      loadOtherProfile();
    } else {
      // Viewing own profile - only update viewedProfile if profile is loaded
      // Don't set to null if profile hasn't loaded yet (prevents "Profile Not Found" flash)
      if (profile) {
        setViewedProfile(profile);
      }
      setIsViewingOther(false);
    }
  }, [userId, profile]);

  useEffect(() => {
    if (viewedProfile && !isViewingOther) {
      const coords = viewedProfile.coordinates || '';
      setEditForm({
        alliance_tag: viewedProfile.alliance_tag || '',
        language: viewedProfile.language || '',
        region: viewedProfile.region || '',
        bio: viewedProfile.bio || '',
        show_coordinates: viewedProfile.show_coordinates ?? false,
        coordinates: coords,
      });
      // Parse structured coordinates into individual fields
      if (coords) {
        const kMatch = coords.match(/K:(\d+)/);
        const xMatch = coords.match(/X:(\d+)/);
        const yMatch = coords.match(/Y:(\d+)/);
        if (kMatch?.[1]) setProfileCoordKingdom(kMatch[1]);
        if (xMatch?.[1]) setProfileCoordX(xMatch[1]);
        if (yMatch?.[1]) setProfileCoordY(yMatch[1]);
      }
      // Pre-fill kingdom from linked account if no coordinates yet
      if (!coords && viewedProfile.linked_kingdom) {
        setProfileCoordKingdom(String(viewedProfile.linked_kingdom));
      }
    }
  }, [viewedProfile, isViewingOther]);

  const handleSave = async () => {
    // Validate coordinates if shown
    if (editForm.show_coordinates) {
      if (profileCoordX.trim() || profileCoordY.trim()) {
        const xNum = parseInt(profileCoordX, 10);
        const yNum = parseInt(profileCoordY, 10);
        if (profileCoordX.trim() && (isNaN(xNum) || xNum < 0 || xNum > 1199)) {
          showToast(t('profile.coordXError', 'X coordinate must be between 0 and 1199'), 'error');
          return;
        }
        if (profileCoordY.trim() && (isNaN(yNum) || yNum < 0 || yNum > 1199)) {
          showToast(t('profile.coordYError', 'Y coordinate must be between 0 and 1199'), 'error');
          return;
        }
      }
    }

    // Compose coordinates string from structured fields
    const composedCoords = (editForm.show_coordinates && profileCoordKingdom && profileCoordX && profileCoordY)
      ? `K:${profileCoordKingdom} X:${profileCoordX} Y:${profileCoordY}`
      : '';

    const result = await updateProfile({
      ...editForm,
      coordinates: composedCoords,
    });
    if (result.success) {
      setIsEditing(false);
      showToast(t('profile.profileSaved', 'Profile saved successfully!'), 'success');
    } else {
      showToast(t('profile.profileSaveFailed', 'Failed to save profile: {{error}}', { error: result.error || 'Unknown error' }), 'error');
    }
  };


  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#6b7280' }}>Loading...</div>
      </div>
    );
  }

  if (!user && !userId) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
        <ParticleEffect />
        <div style={{ 
          maxWidth: '500px', 
          margin: '0 auto', 
          padding: '4rem 2rem',
          textAlign: 'center'
        }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '1rem' }}>
            My <span style={neonGlow('#22d3ee')}>Profile</span>
          </h1>
          <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
            {t('profile.trackKingdoms', 'Track your kingdoms, earn achievements, and prove your dominance.')}
          </p>
          <button
            onClick={() => setShowAuthModal(true)}
            style={{
              padding: '0.875rem 2rem',
              background: 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)',
              border: 'none',
              borderRadius: '8px',
              color: '#000',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            {t('profile.signInToContinue', 'Sign In to Continue')}
          </button>
          <div style={{ marginTop: '3rem' }}>
            <Link to="/" style={{ color: '#22d3ee', textDecoration: 'none', fontSize: '0.85rem' }}>
              {t('common.backToHome')}
            </Link>
          </div>
        </div>
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </div>
    );
  }

  // User is logged in but profile is still loading (race condition fix)
  if (user && !userId && !profile) {
    return <ProfileLoadingFallback />;
  }

  if (!viewedProfile) {
    // Race condition: viewing own profile, profile exists but useEffect hasn't set viewedProfile yet
    if (!userId && profile) {
      return (
        <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: '#6b7280' }}>{t('profile.loadingProfile', 'Loading profile...')}</div>
        </div>
      );
    }
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
        <ParticleEffect />
        <div style={{ 
          maxWidth: '500px', 
          margin: '0 auto', 
          padding: '4rem 2rem',
          textAlign: 'center'
        }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '1rem' }}>
            {t('profile.notFound', 'Profile Not Found')}
          </h1>
          <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
            {t('profile.notFoundDesc', 'This user profile could not be found or may have been removed.')}
          </p>
          <div style={{ marginTop: '3rem' }}>
            <Link to="/players" style={{ color: '#22d3ee', textDecoration: 'none', fontSize: '0.85rem' }}>
              {t('profile.backToPlayers', '← Back to Players')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      {/* Hero Section - matching About page style */}
      <div style={{ 
        padding: isMobile ? '1.25rem 1rem 1rem' : '1.75rem 2rem 1.25rem',
        textAlign: 'center',
        background: 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <ParticleEffect />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '800px', margin: '0 auto' }}>
          <h1 style={{ 
            fontSize: isMobile ? '1.5rem' : '2rem', 
            fontWeight: 'bold', 
            marginBottom: '0.5rem',
            fontFamily: "'Cinzel', 'Times New Roman', serif"
          }}>
            <span style={{ color: '#fff' }}>{isViewingOther ? t('profile.publicProfile', 'PUBLIC') : 'MY'}</span>
            <span style={{ ...neonGlow('#22d3ee'), marginLeft: '0.5rem', fontSize: isMobile ? '1.6rem' : '2.25rem' }}>{t('profile.profileWord', 'PROFILE')}</span>
          </h1>
          {!isViewingOther && (
          <p style={{ color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.9rem', marginBottom: '0.75rem' }}>
            {t('profile.commandCenter', 'Your command center for kingdom intel')}
          </p>
          )}
          {!isMobile && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '50px', height: '2px', background: `linear-gradient(90deg, transparent, ${themeColor})` }} />
            <div style={{ width: '6px', height: '6px', backgroundColor: themeColor, transform: 'rotate(45deg)', boxShadow: `0 0 8px ${themeColor}` }} />
            <div style={{ width: '50px', height: '2px', background: `linear-gradient(90deg, ${themeColor}, transparent)` }} />
          </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: isMobile ? '1rem' : '2rem' }}>
        {/* Link Account Banner - persistent reminder for unlinked users */}
        {!isViewingOther && !viewedProfile?.linked_username && (
          <div 
            onClick={scrollToLinkSection}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              padding: isMobile ? '0.875rem 1rem' : '0.75rem 1.25rem',
              marginBottom: '1rem',
              backgroundColor: '#22d3ee10',
              border: '1px solid #22d3ee30',
              borderRadius: '10px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              minHeight: '48px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#22d3ee20';
              e.currentTarget.style.borderColor = '#22d3ee50';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#22d3ee10';
              e.currentTarget.style.borderColor = '#22d3ee30';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.25rem' }}>🔗</span>
              <div>
                <div style={{ fontSize: isMobile ? '0.85rem' : '0.9rem', fontWeight: '600', color: '#fff' }}>
                  {t('profile.linkBannerTitle', 'Link your Kingshot account')}
                </div>
                <div style={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: '#9ca3af' }}>
                  {t('profile.linkBannerDesc', 'Unlock profile editing and show your in-game stats')}
                </div>
              </div>
            </div>
            <div style={{ 
              color: '#22d3ee', 
              fontSize: '1.25rem',
              flexShrink: 0
            }}>
              →
            </div>
          </div>
        )}

        {/* Profile Card */}
        <div style={{
          backgroundColor: '#111111',
          borderRadius: isMobile ? '12px' : '16px',
          padding: isMobile ? '1.25rem' : '2rem',
          marginBottom: isMobile ? '1.5rem' : '2rem',
          border: `1px solid ${themeColor}30`
        }}>
          {isEditing && !isViewingOther ? (
            <ProfileEditForm
              editForm={editForm}
              setEditForm={setEditForm}
              profileCoordKingdom={profileCoordKingdom}
              setProfileCoordKingdom={setProfileCoordKingdom}
              profileCoordX={profileCoordX}
              setProfileCoordX={setProfileCoordX}
              profileCoordY={profileCoordY}
              setProfileCoordY={setProfileCoordY}
              viewedProfile={viewedProfile}
              themeColor={themeColor}
              isMobile={isMobile}
              onSave={handleSave}
              onCancel={() => setIsEditing(false)}
            />
        ) : (
          <div>
            {/* Profile Header - different layout for public vs own profile */}
            {isViewingOther ? (
              // Public profile: centered avatar with username below
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                gap: '0.75rem',
                marginBottom: '1.5rem',
                textAlign: 'center'
              }}>
                <AvatarWithFallback 
                  avatarUrl={viewedProfile?.linked_avatar_url ?? undefined}
                  username={viewedProfile?.linked_username ?? undefined}
                  size={isMobile ? 96 : 80}
                  themeColor={getHighestTierColor(viewedUserTier, viewedProfile?.referral_tier).color}
                  badgeStyle={viewedProfile?.badge_style ?? undefined}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <div style={{ fontSize: isMobile ? '1.5rem' : '1.75rem', fontWeight: 'bold', color: '#fff' }}>
                    {viewedProfile?.linked_username || getDisplayName(viewedProfile)}
                  </div>
                  {viewedUserTier === 'supporter' && (
                    <span style={{
                      fontSize: '0.7rem',
                      padding: '0.2rem 0.5rem',
                      backgroundColor: `${SUBSCRIPTION_COLORS.supporter}15`,
                      border: `1px solid ${SUBSCRIPTION_COLORS.supporter}40`,
                      borderRadius: '4px',
                      color: SUBSCRIPTION_COLORS.supporter,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}>
                      💖 SUPPORTER
                    </span>
                  )}
                  {viewedProfile?.referral_tier && (
                    <ReferralBadge tier={viewedProfile.referral_tier as ReferralTier} size="md" />
                  )}
                </div>
                {referredByUsername && isViewingOther && (
                  <div style={{
                    fontSize: '0.75rem',
                    color: '#6b7280',
                    marginTop: '0.25rem',
                  }}>
                    {t('profile.referredBy', 'Referred by')} <span style={{ color: '#a24cf3', fontWeight: '600' }}>{referredByUsername}</span>
                  </div>
                )}
              </div>
            ) : (
              // Own profile: centered avatar like public profile, with action buttons in corner
              <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                {/* Action buttons - top right corner */}
                <div style={{ 
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  zIndex: 1
                }}>
                  <button
                    onClick={() => {
                      if (viewedProfile?.linked_username) {
                        setIsEditing(true);
                      } else {
                        showToast(t('profile.linkToEdit', 'Link your Kingshot account to unlock profile editing'), 'info');
                        scrollToLinkSection();
                      }
                    }}
                    style={{
                      padding: isMobile ? '0.625rem 0.875rem' : '0.5rem 1rem',
                      minWidth: isMobile ? '100px' : '120px',
                      minHeight: isMobile ? '44px' : 'auto',
                      backgroundColor: 'transparent',
                      border: '1px solid #3a3a3a',
                      borderRadius: '8px',
                      color: '#9ca3af',
                      cursor: 'pointer',
                      fontSize: isMobile ? '0.8rem' : '0.8rem',
                      WebkitTapHighlightColor: 'transparent',
                      transition: 'border-color 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    ✏️ {t('profile.editProfile')}
                  </button>
                </div>
                
                {/* Centered avatar and username - matching public profile */}
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'center', 
                  gap: '0.75rem',
                  textAlign: 'center',
                  paddingTop: isMobile ? '0' : '0'
                }}>
                  <AvatarWithFallback 
                    avatarUrl={viewedProfile?.linked_username ? viewedProfile?.linked_avatar_url || undefined : undefined}
                    username={viewedProfile?.linked_username}
                    size={isMobile ? 96 : 80}
                    themeColor={getTierBorderColor(isAdmin ? 'admin' : isSupporter ? 'supporter' : 'free')}
                    badgeStyle={viewedProfile?.badge_style}
                    showGlobeDefault={!viewedProfile?.linked_username}
                    onClick={!viewedProfile?.linked_username ? () => {
                      showToast('Link your Kingshot account to unlock profile editing', 'info');
                      scrollToLinkSection();
                    } : undefined}
                  />
                  <style>{`
                    @keyframes spin {
                      from { transform: rotate(0deg); }
                      to { transform: rotate(360deg); }
                    }
                  `}</style>
                  <div 
                    onClick={!viewedProfile?.linked_username ? () => {
                      showToast('Link your Kingshot account to unlock profile editing', 'info');
                      scrollToLinkSection();
                    } : undefined}
                    style={{ 
                      fontSize: isMobile ? '1.5rem' : '1.75rem', 
                      fontWeight: 'bold', 
                      color: '#fff',
                      cursor: !viewedProfile?.linked_username ? 'pointer' : 'default',
                      padding: !viewedProfile?.linked_username ? '0.5rem 1rem' : '0',
                      minHeight: !viewedProfile?.linked_username && isMobile ? '44px' : 'auto',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '8px',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (!viewedProfile?.linked_username) {
                        e.currentTarget.style.backgroundColor = '#22d3ee10';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {viewedProfile?.linked_username || getDisplayName(viewedProfile)}
                  </div>
                  {/* Auth Provider Badge */}
                  {getAuthProvider(user) && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.35rem 0.75rem',
                      backgroundColor: getAuthProvider(user) === 'discord' ? '#5865F215' : '#4285f415',
                      border: `1px solid ${getAuthProvider(user) === 'discord' ? '#5865F240' : '#4285f440'}`,
                      borderRadius: '20px',
                      marginTop: '0.5rem'
                    }}>
                      {getAuthProvider(user) === 'discord' ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#5865F2">
                          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24">
                          <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                      )}
                      <span style={{
                        fontSize: '0.75rem',
                        color: getAuthProvider(user) === 'discord' ? '#5865F2' : '#4285f4',
                        fontWeight: '500'
                      }}>
                        {t('profile.signedInWith', 'Signed in with {{provider}}', { provider: getAuthProvider(user) === 'discord' ? 'Discord' : 'Google' })}
                      </span>
                    </div>
                  )}
                  
                  {/* Unlink & Refresh buttons - below auth chip */}
                  {viewedProfile?.linked_username && (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginTop: '0.5rem'
                    }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {/* Unlink button */}
                        <button
                          onClick={async () => {
                            if (confirm(t('profile.unlinkConfirm', 'Are you sure you want to unlink your Kingshot account?'))) {
                              if (updateProfile && user) {
                                await updateProfile({
                                  ...viewedProfile,
                                  linked_player_id: undefined,
                                  linked_username: undefined,
                                  linked_avatar_url: undefined,
                                  linked_kingdom: undefined,
                                  linked_tc_level: undefined,
                                  linked_last_synced: undefined,
                                });
                                showToast(t('profile.kingshotUnlinked', 'Kingshot account unlinked'), 'success');
                                // Remove Settler role from Discord (fire and forget)
                                discordService.syncSettlerRole(user.id, false).catch(() => {});
                              }
                            }
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#ef444430';
                            e.currentTarget.style.borderColor = '#ef444480';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#ef444415';
                            e.currentTarget.style.borderColor = '#ef444440';
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.35rem 0.75rem',
                            backgroundColor: '#ef444415',
                            border: '1px solid #ef444440',
                            borderRadius: '20px',
                            color: '#ef4444',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            transition: 'all 0.2s'
                          }}
                        >
                          🔓 {t('profile.unlinkKingshot', 'Unlink Kingshot')}
                        </button>
                        
                        {/* Refresh button */}
                        {refreshLinkedPlayer && (
                          <button
                            onClick={async () => {
                              const btn = document.getElementById('refresh-sync-btn');
                              const icon = document.getElementById('refresh-icon');
                              if (btn) btn.setAttribute('disabled', 'true');
                              if (icon) icon.style.animation = 'spin 1s linear infinite';
                              await refreshLinkedPlayer();
                              if (icon) icon.style.animation = 'none';
                              if (btn) btn.removeAttribute('disabled');
                              showToast(t('profile.playerDataSynced', 'Player data synced!'), 'success');
                            }}
                            id="refresh-sync-btn"
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#22d3ee30';
                              e.currentTarget.style.borderColor = '#22d3ee80';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#22d3ee15';
                              e.currentTarget.style.borderColor = '#22d3ee40';
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              padding: '0.35rem 0.75rem',
                              backgroundColor: '#22d3ee15',
                              border: '1px solid #22d3ee40',
                              borderRadius: '20px',
                              color: '#22d3ee',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              fontWeight: '500',
                              transition: 'all 0.2s'
                            }}
                          >
                            <span id="refresh-icon">🔄</span> {t('profile.refreshKingshot', 'Refresh Kingshot')}
                          </button>
                        )}
                      </div>
                      {/* Last synced timestamp */}
                      {viewedProfile?.linked_last_synced && (
                        <span style={{
                          fontSize: '0.65rem',
                          color: '#6b7280',
                          fontStyle: 'italic'
                        }}>
                          {t('profile.lastSynced', 'Last synced: {{date}}', { date: new Date(viewedProfile.linked_last_synced).toLocaleString() })}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Profile Details - Stats Grid */}
            <ProfileStatsGrid viewedProfile={viewedProfile} isMobile={isMobile} />
          </div>
        )}

        {/* Hide all sections below when editing */}
        {!isEditing && (<>
        {/* Bio Section - separate from profile card */}
        {viewedProfile?.bio && (
          <div style={{
            marginBottom: '1.5rem',
            padding: isMobile ? '1rem' : '1.25rem',
            backgroundColor: '#111111',
            borderRadius: '12px',
            border: '1px solid #2a2a2a'
          }}>
            <div style={{
              marginBottom: '0.75rem',
              textAlign: 'center'
            }}>
              <span style={{ 
                fontSize: '0.95rem', 
                color: '#fff', 
                fontWeight: '600'
              }}>{t('profile.aboutMe', 'About Me')}</span>
            </div>
            <p style={{ 
              color: '#d1d5db', 
              lineHeight: 1.6, 
              fontSize: isMobile ? '0.9rem' : '0.95rem',
              margin: 0,
              fontStyle: 'italic'
            }}>&quot;{viewedProfile.bio}&quot;</p>
          </div>
        )}

        {/* In-Game Coordinates - shown when user has enabled it */}
        {viewedProfile?.show_coordinates && viewedProfile?.coordinates && (
          <div style={{
            marginBottom: '1.5rem',
            padding: isMobile ? '1rem' : '1.25rem',
            backgroundColor: '#111111',
            borderRadius: '12px',
            border: '1px solid #2a2a2a'
          }}>
            <div style={{
              marginBottom: '0.75rem',
              textAlign: 'center'
            }}>
              <span style={{ 
                fontSize: '0.95rem', 
                color: '#fff', 
                fontWeight: '600'
              }}>{t('profile.inGameLocation', 'In-Game Location')}</span>
            </div>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '1rem',
              color: themeColor,
              fontSize: isMobile ? '0.95rem' : '1.05rem',
              fontWeight: '600',
              fontFamily: 'monospace',
            }}>
              {(() => {
                const m = viewedProfile.coordinates.match(/^K:(\d+) X:(\d+) Y:(\d+)$/);
                if (m) {
                  return (
                    <>
                      <span>K{m[1]}</span>
                      <span style={{ color: '#3a3a3a' }}>·</span>
                      <span>X: {m[2]}</span>
                      <span style={{ color: '#3a3a3a' }}>·</span>
                      <span>Y: {m[3]}</span>
                    </>
                  );
                }
                return <span>{viewedProfile.coordinates}</span>;
              })()}
            </div>
          </div>
        )}

        {/* 1. Profile Completion Progress - only show for own profile */}
        {!isViewingOther && (
          <ProfileCompletionProgress 
            profile={viewedProfile} 
            isMobile={isMobile} 
            onScrollToLink={scrollToLinkSection}
          />
        )}

        {/* 2. Link Kingshot Account - only show for own profile when NOT linked */}
        {!isViewingOther && !viewedProfile?.linked_username && (
          <div id="link-kingshot-section" style={{ marginBottom: '1.5rem' }}>
            <LinkKingshotAccount
              onLink={async (playerData) => {
                try {
                  if (updateProfile && user) {
                    const result = await updateProfile({
                      ...viewedProfile,
                      linked_player_id: playerData.player_id,
                      linked_username: playerData.username,
                      linked_avatar_url: playerData.avatar_url,
                      linked_kingdom: playerData.kingdom,
                      linked_tc_level: playerData.town_center_level,
                      linked_last_synced: new Date().toISOString(),
                    });
                    if (!result.success) {
                      showToast(result.error || 'Failed to link account', 'error');
                      return;
                    }
                    // Assign Settler role in Discord (fire and forget)
                    discordService.syncSettlerRole(user.id, true).catch(() => {});
                  }
                } catch (err) {
                  logger.error('Link account error:', err);
                  showToast('Failed to link account. Please try again.', 'error');
                }
              }}
              onUnlink={() => {}}
              linkedPlayer={null}
              subscriptionTier={isAdmin ? 'admin' : isSupporter ? 'supporter' : 'free'}
            />
          </div>
        )}

        {/* 3. Discord Account Link - only show for own profile */}
        {!isViewingOther && user && (
          <div style={{ marginBottom: '1.5rem' }}>
            <LinkDiscordAccount
              discordId={profile?.discord_id}
              discordUsername={profile?.discord_username}
              isDiscordAuth={getAuthProvider(user) === 'discord'}
              onUnlink={() => {
                if (updateProfile) {
                  updateProfile({
                    discord_id: null,
                    discord_username: null,
                    discord_linked_at: null,
                  });
                }
              }}
            />
          </div>
        )}

        {/* 4. Subscription Status - only show for own profile */}
        {!isViewingOther && user && (
          <SubscriptionSection themeColor={themeColor} isMobile={isMobile} />
        )}

        {/* 5. Referral Program - only show for own profile */}
        {!isViewingOther && (
          <div id="referral-program">
            <ReferralStats />
          </div>
        )}

        {/* 6. User Achievements - only show for own profile (uses current user's stats) */}
        {!isViewingOther && (
          <div style={{ marginBottom: '1.5rem' }}>
            <UserAchievements />
          </div>
        )}

        {/* 7. My Contributions - only for logged in users viewing their own profile */}
        {!isViewingOther && user && (
          <div style={{ marginBottom: '1.5rem' }}>
            <SubmissionHistory userId={user.id} themeColor={themeColor} />
          </div>
        )}

        {/* 8. Favorites - only show for own profile */}
        {!isViewingOther && (
          <div style={{ marginBottom: '1.5rem' }}>
            <ProfileFeatures />
          </div>
        )}

        {/* Transfer Readiness Score - only show for own profile */}
        {!isViewingOther && user && (
          <div style={{ marginBottom: '1.5rem' }}>
            <TransferReadinessScore
              userId={user.id}
              hasLinkedAccount={!!viewedProfile?.linked_username}
              isMobile={isMobile}
            />
          </div>
        )}

        {/* User's Kingdom Rankings - show if user has a linked kingdom or home kingdom */}
        <div style={{ marginBottom: '1.5rem' }}>
          <KingdomLeaderboardPosition 
            kingdomId={viewedProfile?.linked_kingdom || viewedProfile?.home_kingdom || null}
            themeColor={themeColor}
            isMobile={isMobile}
          />
        </div>

        {/* Players from My Kingdom - only show for own profile */}
        {!isViewingOther && (
          <PlayersFromMyKingdom themeColor={themeColor} />
        )}
        
        <div style={{ textAlign: 'center', marginTop: '2rem', paddingBottom: '1rem' }}>
          <Link to="/" style={{ color: themeColor, textDecoration: 'none', fontSize: '0.8rem' }}>{t('profile.backToHome', '← Back to Home')}</Link>
        </div>
        </>)}
        </div>
      </div>
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
};

export default Profile;
