import React, { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import ParticleEffect from '../components/ParticleEffect';
import UserAchievements from '../components/UserAchievements';
import SubmissionHistory from '../components/SubmissionHistory';
import AuthModal from '../components/AuthModal';
import ProfileFeatures from '../components/ProfileFeatures';
import LinkKingshotAccount from '../components/LinkKingshotAccount';
import LinkDiscordAccount from '../components/LinkDiscordAccount';
import PlayersFromMyKingdom from '../components/PlayersFromMyKingdom';
import { useAuth, getCacheBustedAvatarUrl, UserProfile, getDisplayName } from '../contexts/AuthContext';
import { usePremium } from '../contexts/PremiumContext';
import { useToast } from '../components/Toast';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getCustomerPortalUrl, createPortalSession } from '../lib/stripe';
import { discordService } from '../services/discordService';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useIsMobile } from '../hooks/useMediaQuery';
import { neonGlow } from '../utils/styles';
import { isRandomUsername } from '../utils/randomUsername';

// Convert TC level to display string (TC 31+ becomes TG tiers)
// Source of truth: /docs/TC_TG_NAMING.md
const formatTCLevel = (level: number | null | undefined): string => {
  if (!level) return '';
  if (level <= 30) return `TC ${level}`;
  if (level <= 34) return 'TC 30';
  const tgTier = Math.floor((level - 35) / 5) + 1;
  return `TG${tgTier}`;
};

// Get border color for avatar based on subscription tier
// Supporter = Pink, Recruiter = Purple, Admin = Gold
const getTierBorderColor = (tier: 'free' | 'pro' | 'recruiter' | 'admin'): string => {
  switch (tier) {
    case 'admin': return '#f59e0b';    // Gold - Admin
    case 'recruiter': return '#a855f7'; // Purple - Atlas Recruiter
    case 'pro': return '#FF6B8A';       // Pink - Atlas Supporter
    default: return '#ffffff';          // White
  }
};

// Globe icon SVG for unlinked users (matches Atlas logo)
const GlobeIcon: React.FC<{ size: number; pulse?: boolean }> = ({ size, pulse = false }) => (
  <div style={{ 
    animation: pulse ? 'globePulse 2s ease-in-out infinite' : 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }}>
    <style>{`
      @keyframes globePulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.1); opacity: 0.8; }
      }
    `}</style>
    <svg 
      width={size * 0.5} 
      height={size * 0.5} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="1.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  </div>
);

// Avatar component with error handling and fallback
const AvatarWithFallback: React.FC<{
  avatarUrl?: string;
  username?: string;
  size: number;
  themeColor: string;
  badgeStyle?: string;
  showGlobeDefault?: boolean;
  onClick?: () => void;
}> = ({ avatarUrl, username, size, themeColor, badgeStyle = 'default', showGlobeDefault = false, onClick }) => {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const getBadgeStyle = (style: string, color: string) => {
    switch (style) {
      case 'gradient':
        return { background: `linear-gradient(135deg, ${color} 0%, ${color}80 100%)` };
      case 'outline':
        return { backgroundColor: 'transparent', border: `2px solid ${color}` };
      case 'glow':
        return { backgroundColor: color, boxShadow: `0 0 20px ${color}60` };
      default:
        return { backgroundColor: color };
    }
  };

  // Show globe icon for unlinked users, or letter fallback if linked but image failed
  if (!avatarUrl || imgError || avatarUrl === '') {
    return (
      <div style={{ position: 'relative' }}>
        <div 
          onClick={onClick}
          onMouseEnter={() => onClick && setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: `${size * 0.4}px`,
            color: showGlobeDefault ? '#22d3ee' : '#000',
            fontWeight: 'bold',
            cursor: onClick ? 'pointer' : 'default',
            backgroundColor: showGlobeDefault ? '#0a0a0a' : undefined,
            border: showGlobeDefault ? '2px solid #22d3ee' : undefined,
            transform: isHovered && onClick ? 'scale(1.05)' : 'scale(1)',
            boxShadow: isHovered && onClick ? '0 0 20px rgba(34, 211, 238, 0.5)' : 'none',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            ...(!showGlobeDefault ? getBadgeStyle(badgeStyle, themeColor) : {})
          }}>
          {showGlobeDefault ? <GlobeIcon size={size} pulse={true} /> : (username?.[0]?.toUpperCase() ?? '?')}
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: `${size}px`, height: `${size}px` }}>
      {!imgLoaded && (
        <div style={{
          position: 'absolute',
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          backgroundColor: '#1a1a1a',
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      )}
      <img 
        src={getCacheBustedAvatarUrl(avatarUrl)} 
        alt="Avatar"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          objectFit: 'cover',
          border: `2px solid ${themeColor}`,
          opacity: imgLoaded ? 1 : 0,
          transition: 'opacity 0.2s ease-in-out'
        }}
        onLoad={() => setImgLoaded(true)}
        onError={() => {
          console.error('Avatar failed to load:', avatarUrl);
          setImgError(true);
        }}
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

const LANGUAGES = [
  'English', 'Spanish', 'Portuguese', 'French', 'German', 'Italian', 
  'Russian', 'Chinese', 'Japanese', 'Korean', 'Arabic', 'Turkish',
  'Vietnamese', 'Thai', 'Indonesian', 'Polish', 'Dutch', 'Other'
];

const REGIONS = ['Americas', 'Europe', 'Asia', 'Oceania'];

interface EditForm {
  display_name: string;
  alliance_tag: string;
  language: string;
  region: string;
  bio: string;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

interface KingdomData {
  id: number;
  atlas_score: number;
  rank: number;
  total_wins: number;
  total_losses: number;
  kvk_count: number;
}

const KingdomLeaderboardPosition: React.FC<{
  kingdomId: number | null;
  themeColor: string;
  isMobile: boolean;
}> = ({ kingdomId, themeColor, isMobile }) => {
  const [kingdom, setKingdom] = useState<KingdomData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!kingdomId) {
      setKingdom(null);
      return;
    }
    
    setLoading(true);
    fetch(`${API_BASE}/api/v1/kingdoms/${kingdomId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setKingdom({
            id: data.id ?? data.kingdom_number ?? kingdomId,
            atlas_score: data.atlas_score ?? data.overall_score ?? 0,
            rank: data.rank ?? 0,
            total_wins: data.total_wins ?? (data.prep_wins ?? 0) + (data.battle_wins ?? 0),
            total_losses: data.total_losses ?? (data.prep_losses ?? 0) + (data.battle_losses ?? 0),
            kvk_count: data.kvk_count ?? data.total_kvks ?? 0,
          });
        }
      })
      .catch(() => setKingdom(null))
      .finally(() => setLoading(false));
  }, [kingdomId]);

  if (!kingdomId) return null;
  if (loading) return (
    <div style={{
      backgroundColor: '#111111',
      borderRadius: '12px',
      padding: '1rem',
      marginBottom: '1.5rem',
      border: '1px solid #2a2a2a',
    }}>
      <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>Loading kingdom data...</div>
    </div>
  );
  if (!kingdom) return null;

  return (
    <Link to={`/kingdom/${kingdom.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{
        backgroundColor: '#111111',
        borderRadius: '12px',
        padding: isMobile ? '1rem' : '1.25rem',
        marginBottom: '1.5rem',
        border: `1px solid ${themeColor}30`,
        cursor: 'pointer',
        transition: 'border-color 0.2s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <span style={{ fontSize: '1.1rem' }}>🏆</span>
          <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '600', color: '#fff' }}>
            User&apos;s Kingdom Rankings
          </h3>
        </div>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          gap: '0.75rem',
        }}>
          <div style={{ padding: '0.875rem', minHeight: '48px', backgroundColor: '#0a0a0a', borderRadius: '8px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '0.65rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Kingdom</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#fff' }}>{kingdom.id}</div>
          </div>
          <div style={{ padding: '0.875rem', minHeight: '48px', backgroundColor: '#0a0a0a', borderRadius: '8px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '0.65rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Atlas Score</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '700', ...neonGlow(themeColor) }}>{kingdom.atlas_score.toFixed(2)}</div>
          </div>
          <div style={{ padding: '0.875rem', minHeight: '48px', backgroundColor: '#0a0a0a', borderRadius: '8px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '0.65rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Rank</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '700', ...neonGlow(themeColor) }}>#{kingdom.rank}</div>
          </div>
          <div style={{ padding: '0.875rem', minHeight: '48px', backgroundColor: '#0a0a0a', borderRadius: '8px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '0.65rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Experience</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#fff' }}>{kingdom.kvk_count} KvKs</div>
          </div>
        </div>
      </div>
    </Link>
  );
};

// Profile Completion Progress Component
const ProfileCompletionProgress: React.FC<{
  profile: UserProfile | null;
  isMobile: boolean;
  onScrollToLink: () => void;
}> = ({ profile, isMobile, onScrollToLink }) => {
  if (!profile) return null;
  
  // Calculate completion items
  const items = [
    { label: 'Link Kingshot Account', done: !!profile.linked_username, action: onScrollToLink },
    { label: 'Set Language', done: !!profile.language },
    { label: 'Set Region', done: !!profile.region },
    { label: 'Add Alliance Tag', done: !!profile.alliance_tag },
    { label: 'Write Bio', done: !!profile.bio },
  ];
  
  const completedCount = items.filter(i => i.done).length;
  const totalCount = items.length;
  const percentage = Math.round((completedCount / totalCount) * 100);
  
  // Don't show if 100% complete
  if (percentage === 100) return null;
  
  return (
    <div style={{
      backgroundColor: '#111111',
      borderRadius: '12px',
      padding: isMobile ? '1rem' : '1.25rem',
      marginBottom: '1.5rem',
      border: '1px solid #2a2a2a',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1rem' }}>📊</span>
          <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '600', color: '#fff' }}>
            Profile Completion
          </h3>
        </div>
        <span style={{ 
          fontSize: '0.85rem', 
          fontWeight: 'bold', 
          color: percentage >= 80 ? '#22c55e' : percentage >= 50 ? '#fbbf24' : '#22d3ee' 
        }}>
          {percentage}%
        </span>
      </div>
      
      {/* Progress bar */}
      <div style={{
        width: '100%',
        height: '8px',
        backgroundColor: '#1a1a1a',
        borderRadius: '4px',
        overflow: 'hidden',
        marginBottom: '1rem'
      }}>
        <div style={{
          width: `${percentage}%`,
          height: '100%',
          backgroundColor: percentage >= 80 ? '#22c55e' : percentage >= 50 ? '#fbbf24' : '#22d3ee',
          borderRadius: '4px',
          transition: 'width 0.3s ease'
        }} />
      </div>
      
      {/* Checklist */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {items.map((item, idx) => (
          <div 
            key={idx}
            onClick={item.action}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              padding: '0.5rem 0.25rem',
              minHeight: '44px',
              cursor: item.action ? 'pointer' : 'default',
              opacity: item.done ? 0.6 : 1,
              borderRadius: '6px',
              transition: 'background-color 0.15s'
            }}
            onMouseEnter={(e) => item.action && (e.currentTarget.style.backgroundColor = '#ffffff08')}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <span style={{ 
              width: '18px', 
              height: '18px', 
              borderRadius: '50%', 
              border: item.done ? 'none' : '2px solid #3a3a3a',
              backgroundColor: item.done ? '#22c55e' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.7rem',
              color: '#fff',
              flexShrink: 0
            }}>
              {item.done && '✓'}
            </span>
            <span style={{ 
              fontSize: '0.8rem', 
              color: item.done ? '#6b7280' : '#fff',
              textDecoration: item.done ? 'line-through' : 'none'
            }}>
              {item.label}
            </span>
            {!item.done && item.action && (
              <span style={{ fontSize: '0.7rem', color: '#22d3ee', marginLeft: 'auto' }}>→</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Get auth provider from user metadata
const getAuthProvider = (user: { app_metadata?: { provider?: string; providers?: string[] } } | null): 'discord' | 'google' | 'email' | null => {
  if (!user) return null;
  const provider = user.app_metadata?.provider || user.app_metadata?.providers?.[0];
  if (provider === 'discord') return 'discord';
  if (provider === 'google') return 'google';
  if (provider === 'email') return 'email';
  return null;
};

const Profile: React.FC = () => {
  const { userId } = useParams<{ userId?: string }>();
  useDocumentTitle(userId ? 'User Profile' : 'My Profile');
  const { user, profile, loading, updateProfile, refreshLinkedPlayer } = useAuth();
  const { tierName, isPro, isRecruiter, isAdmin } = usePremium();
  const { showToast } = useToast();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [managingSubscription, setManagingSubscription] = useState(false);
  const isMobile = useIsMobile();
  const [viewedProfile, setViewedProfile] = useState<UserProfile | null>(null);
  const [isViewingOther, setIsViewingOther] = useState(false);
  const [viewedUserTier, setViewedUserTier] = useState<'free' | 'pro' | 'recruiter' | 'admin'>('free');
  const [isEditing, setIsEditing] = useState(false);
  const [hasShownWelcome, setHasShownWelcome] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    display_name: '',
    alliance_tag: '',
    language: '',
    region: '',
    bio: ''
  });

  const themeColor = viewedProfile?.theme_color || '#22d3ee';
  
  // Welcome toast for new users (random username = new user)
  useEffect(() => {
    if (!hasShownWelcome && profile && !userId && isRandomUsername(profile.username)) {
      const welcomeKey = `atlas_welcomed_${profile.id}`;
      if (!localStorage.getItem(welcomeKey)) {
        showToast(`Welcome to Atlas, ${profile.username}! 🌍`, 'info');
        localStorage.setItem(welcomeKey, 'true');
        setHasShownWelcome(true);
      }
    }
  }, [profile, userId, hasShownWelcome, showToast]);
  
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
                const tier = data.subscription_tier as 'free' | 'pro' | 'recruiter' | undefined;
                setViewedUserTier(tier || 'free');
              }
              return;
            }
          } catch (err) {
            console.error('Failed to fetch profile:', err);
          }
        }

        // Fallback to demo users
        const demoUsers = [
          {
            id: 'demo1',
            username: 'DragonSlayer',
            email: 'demo1@example.com',
            avatar_url: '',
            home_kingdom: 42,
            alliance_tag: 'DRG',
            language: 'English',
            region: 'Americas',
            bio: 'Leading kingdoms to victory since KvK #1',
            theme_color: '#ef4444',
            badge_style: 'glow',
            created_at: new Date().toISOString()
          },
          {
            id: 'demo2',
            username: 'PhoenixRising',
            email: 'demo2@example.com',
            avatar_url: '',
            home_kingdom: 17,
            alliance_tag: 'PHX',
            language: 'Spanish',
            region: 'Europe',
            bio: 'From ashes we rise. Building the strongest alliances.',
            theme_color: '#f97316',
            badge_style: 'gradient',
            created_at: new Date().toISOString()
          },
          {
            id: 'demo3',
            username: 'ShadowHunter',
            email: 'demo3@example.com',
            avatar_url: '',
            home_kingdom: 88,
            alliance_tag: 'SHD',
            language: 'English',
            region: 'Asia',
            bio: 'Master strategist. Victory through superior tactics.',
            theme_color: '#8b5cf6',
            badge_style: 'outline',
            created_at: new Date().toISOString()
          }
        ];
        
        const demoUser = demoUsers.find(u => u.id === userId);
        if (demoUser) {
          setViewedProfile(demoUser);
          setIsViewingOther(true);
          return;
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
      setEditForm({
        display_name: viewedProfile.display_name || '',
        alliance_tag: viewedProfile.alliance_tag || '',
        language: viewedProfile.language || '',
        region: viewedProfile.region || '',
        bio: viewedProfile.bio || ''
      });
    }
  }, [viewedProfile, isViewingOther]);

  const handleSave = async () => {
    const result = await updateProfile(editForm);
    if (result.success) {
      setIsEditing(false);
      showToast('Profile saved successfully!', 'success');
    } else {
      showToast(`Failed to save profile: ${result.error || 'Unknown error'}`, 'error');
      // Keep edit form open so user can retry
    }
  };

  const handleAllianceTagChange = (value: string) => {
    const cleaned = value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase();
    setEditForm({ ...editForm, alliance_tag: cleaned });
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
            Track your kingdoms, earn achievements, and prove your dominance.
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
            Sign In to Continue
          </button>
          <div style={{ marginTop: '3rem' }}>
            <Link to="/" style={{ color: '#22d3ee', textDecoration: 'none', fontSize: '0.85rem' }}>
              ← Back to Home
            </Link>
          </div>
        </div>
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </div>
    );
  }

  // User is logged in but profile is still loading (race condition fix)
  if (user && !userId && !profile) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#6b7280' }}>Loading profile...</div>
      </div>
    );
  }

  if (!viewedProfile) {
    // Race condition: viewing own profile, profile exists but useEffect hasn't set viewedProfile yet
    if (!userId && profile) {
      return (
        <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: '#6b7280' }}>Loading profile...</div>
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
            Profile Not Found
          </h1>
          <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
            This user profile could not be found or may have been removed.
          </p>
          <div style={{ marginTop: '3rem' }}>
            <Link to="/players" style={{ color: '#22d3ee', textDecoration: 'none', fontSize: '0.85rem' }}>
              ← Back to Players
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const selectStyle = {
    width: '100%',
    padding: '0.75rem 1rem',
    backgroundColor: '#0a0a0a',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '1rem',
    cursor: 'pointer',
    appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 0.75rem center',
    backgroundSize: '1rem'
  };

  const inputStyle = {
    width: '100%',
    padding: '0.75rem 1rem',
    backgroundColor: '#0a0a0a',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '1rem'
  };

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
            <span style={{ color: '#fff' }}>{isViewingOther ? 'PUBLIC' : 'MY'}</span>
            <span style={{ ...neonGlow('#22d3ee'), marginLeft: '0.5rem', fontSize: isMobile ? '1.6rem' : '2.25rem' }}>PROFILE</span>
          </h1>
          {!isViewingOther && (
          <p style={{ color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.9rem', marginBottom: '0.75rem' }}>
            Your command center for kingdom intel
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
                  Link your Kingshot account
                </div>
                <div style={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: '#9ca3af' }}>
                  Unlock profile editing and show your in-game stats
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Alliance Tag */}
              <div>
                <label style={{ color: '#9ca3af', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>Alliance Tag (3 chars)</label>
                <input
                  type="text"
                  value={editForm.alliance_tag}
                  onChange={(e) => handleAllianceTagChange(e.target.value)}
                  placeholder="e.g. TWS"
                  maxLength={3}
                  style={{ ...inputStyle, textTransform: 'uppercase', letterSpacing: '0.1em', maxWidth: '150px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '0.75rem' : '1rem' }}>
                <div>
                  <label style={{ color: '#9ca3af', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>Main Language</label>
                  <select
                    value={editForm.language}
                    onChange={(e) => setEditForm({ ...editForm, language: e.target.value })}
                    style={selectStyle}
                  >
                    <option value="">Select language</option>
                    {LANGUAGES.map(lang => (
                      <option key={lang} value={lang}>{lang}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ color: '#9ca3af', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>Region</label>
                  <select
                    value={editForm.region}
                    onChange={(e) => setEditForm({ ...editForm, region: e.target.value })}
                    style={selectStyle}
                  >
                    <option value="">Select region</option>
                    {REGIONS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ color: '#9ca3af', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>Bio</label>
                <textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  placeholder="Tell us about yourself..."
                  rows={3}
                  style={{
                    ...inputStyle,
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  onClick={handleSave}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}cc 100%)`,
                    border: 'none',
                    borderRadius: '8px',
                    color: '#000',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  Save Profile
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: 'transparent',
                    border: '1px solid #3a3a3a',
                    borderRadius: '8px',
                    color: '#9ca3af',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
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
                  themeColor={getTierBorderColor(viewedUserTier)}
                  badgeStyle={viewedProfile?.badge_style ?? undefined}
                />
                <div style={{ fontSize: isMobile ? '1.5rem' : '1.75rem', fontWeight: 'bold', color: '#fff' }}>
                  {viewedProfile?.linked_username || getDisplayName(viewedProfile)}
                </div>
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
                        showToast('Link your Kingshot account to unlock profile editing', 'info');
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
                    ✏️ Edit Profile
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
                    themeColor={getTierBorderColor(isAdmin ? 'admin' : isRecruiter ? 'recruiter' : isPro ? 'pro' : 'free')}
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
                        Signed in with {getAuthProvider(user) === 'discord' ? 'Discord' : 'Google'}
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
                            if (confirm('Are you sure you want to unlink your Kingshot account?')) {
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
                                showToast('Kingshot account unlinked', 'success');
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
                          🔓 Unlink Kingshot
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
                              showToast('Player data synced!', 'success');
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
                            <span id="refresh-icon">🔄</span> Refresh Kingshot
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
                          Last synced: {new Date(viewedProfile.linked_last_synced).toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Profile Details - Different layout for public vs own profile */}
            {isViewingOther ? (
              // Public profile: Kingdom, Alliance, Player ID | TC level, Language, Region
              <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '0.5rem' : '0.75rem', marginBottom: isMobile ? '1rem' : '1.5rem' }}>
                {/* Row 1: Kingdom, Alliance, Player ID */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: isMobile ? '0.5rem' : '1rem' }}>
                  {viewedProfile?.linked_kingdom ? (
                    <Link to={`/kingdom/${viewedProfile.linked_kingdom}`} style={{ textDecoration: 'none' }}>
                      <div style={{ padding: isMobile ? '0.5rem' : '0.875rem', minHeight: '48px', backgroundColor: '#0a0a0a', borderRadius: '8px', border: '1px solid #2a2a2a', cursor: 'pointer', transition: 'border-color 0.2s', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{ fontSize: isMobile ? '0.55rem' : '0.65rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Kingdom</div>
                        <div style={{ fontSize: isMobile ? '1rem' : '1.25rem', fontWeight: '700', color: '#fff' }}>{viewedProfile.linked_kingdom}</div>
                      </div>
                    </Link>
                  ) : (
                    <div style={{ padding: isMobile ? '0.5rem' : '0.875rem', minHeight: '48px', backgroundColor: '#0a0a0a', borderRadius: '8px', border: '1px solid #2a2a2a', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div style={{ fontSize: isMobile ? '0.55rem' : '0.65rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Kingdom</div>
                      <div style={{ fontSize: isMobile ? '1rem' : '1.25rem', fontWeight: '700', color: '#4a4a4a' }}>—</div>
                    </div>
                  )}
                  <div style={{ padding: isMobile ? '0.5rem' : '0.875rem', minHeight: '48px', backgroundColor: '#0a0a0a', borderRadius: '8px', border: '1px solid #2a2a2a', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: isMobile ? '0.55rem' : '0.65rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Alliance</div>
                    <div style={{ fontSize: isMobile ? '1rem' : '1.25rem', fontWeight: '700', color: viewedProfile?.alliance_tag ? '#fff' : '#4a4a4a' }}>
                      {viewedProfile?.alliance_tag ? `[${viewedProfile.alliance_tag}]` : '—'}
                    </div>
                  </div>
                  <div style={{ padding: isMobile ? '0.5rem' : '0.875rem', minHeight: '48px', backgroundColor: '#0a0a0a', borderRadius: '8px', border: '1px solid #2a2a2a', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: isMobile ? '0.55rem' : '0.65rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Player ID</div>
                    <div style={{ fontSize: isMobile ? '0.85rem' : '1.25rem', fontWeight: '700', color: viewedProfile?.linked_player_id ? '#fff' : '#4a4a4a' }}>{viewedProfile?.linked_player_id || '—'}</div>
                  </div>
                </div>
                {/* Row 2: TC Level, Language, Region */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: isMobile ? '0.5rem' : '1rem' }}>
                  <div style={{ padding: isMobile ? '0.5rem' : '0.875rem', minHeight: '48px', backgroundColor: '#0a0a0a', borderRadius: '8px', border: '1px solid #2a2a2a', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: isMobile ? '0.55rem' : '0.65rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Town Center</div>
                    <div style={{ fontSize: isMobile ? '1rem' : '1.25rem', fontWeight: '700', color: viewedProfile?.linked_tc_level ? '#fff' : '#4a4a4a' }}>{viewedProfile?.linked_tc_level ? formatTCLevel(viewedProfile.linked_tc_level) : '—'}</div>
                  </div>
                  <div style={{ padding: isMobile ? '0.5rem' : '0.875rem', minHeight: '48px', backgroundColor: '#0a0a0a', borderRadius: '8px', border: '1px solid #2a2a2a', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: isMobile ? '0.55rem' : '0.65rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Language</div>
                    <div style={{ fontSize: isMobile ? '1rem' : '1.25rem', fontWeight: '700', color: viewedProfile?.language ? '#fff' : '#4a4a4a' }}>
                      {viewedProfile?.language || '—'}
                    </div>
                  </div>
                  <div style={{ padding: isMobile ? '0.5rem' : '0.875rem', minHeight: '48px', backgroundColor: '#0a0a0a', borderRadius: '8px', border: '1px solid #2a2a2a', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: isMobile ? '0.55rem' : '0.65rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Region</div>
                    <div style={{ fontSize: isMobile ? '1rem' : '1.25rem', fontWeight: '700', color: viewedProfile?.region ? '#fff' : '#4a4a4a' }}>
                      {viewedProfile?.region || '—'}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Own profile: 2x3 grid matching public profile layout
              <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '0.5rem' : '0.75rem', marginBottom: isMobile ? '1rem' : '1.5rem' }}>
                {/* Row 1: Kingdom, Alliance, Player ID */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: isMobile ? '0.5rem' : '1rem' }}>
                  {viewedProfile?.linked_kingdom ? (
                    <Link to={`/kingdom/${viewedProfile.linked_kingdom}`} style={{ textDecoration: 'none' }}>
                      <div style={{ padding: isMobile ? '0.5rem' : '0.875rem', minHeight: '48px', backgroundColor: '#0a0a0a', borderRadius: '8px', border: '1px solid #2a2a2a', cursor: 'pointer', transition: 'border-color 0.2s', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{ fontSize: isMobile ? '0.55rem' : '0.65rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Kingdom</div>
                        <div style={{ fontSize: isMobile ? '1rem' : '1.25rem', fontWeight: '700', color: '#fff' }}>{viewedProfile.linked_kingdom}</div>
                      </div>
                    </Link>
                  ) : (
                    <div style={{ padding: isMobile ? '0.5rem' : '0.875rem', minHeight: '48px', backgroundColor: '#0a0a0a', borderRadius: '8px', border: '1px solid #2a2a2a', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div style={{ fontSize: isMobile ? '0.55rem' : '0.65rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Kingdom</div>
                      <div style={{ fontSize: isMobile ? '1rem' : '1.25rem', fontWeight: '700', color: '#4a4a4a' }}>—</div>
                    </div>
                  )}
                  <div style={{ padding: isMobile ? '0.5rem' : '0.875rem', minHeight: '48px', backgroundColor: '#0a0a0a', borderRadius: '8px', border: '1px solid #2a2a2a', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: isMobile ? '0.55rem' : '0.65rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Alliance</div>
                    <div style={{ fontSize: isMobile ? '1rem' : '1.25rem', fontWeight: '700', color: viewedProfile?.alliance_tag ? '#fff' : '#4a4a4a' }}>
                      {viewedProfile?.alliance_tag ? `[${viewedProfile.alliance_tag}]` : '—'}
                    </div>
                  </div>
                  <div style={{ padding: isMobile ? '0.5rem' : '0.875rem', minHeight: '48px', backgroundColor: '#0a0a0a', borderRadius: '8px', border: '1px solid #2a2a2a', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: isMobile ? '0.55rem' : '0.65rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Player ID</div>
                    <div style={{ fontSize: isMobile ? '0.85rem' : '1.25rem', fontWeight: '700', color: viewedProfile?.linked_player_id ? '#fff' : '#4a4a4a' }}>{viewedProfile?.linked_player_id || '—'}</div>
                  </div>
                </div>
                {/* Row 2: TC Level, Language, Region */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: isMobile ? '0.5rem' : '1rem' }}>
                  <div style={{ padding: isMobile ? '0.5rem' : '0.875rem', minHeight: '48px', backgroundColor: '#0a0a0a', borderRadius: '8px', border: '1px solid #2a2a2a', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: isMobile ? '0.55rem' : '0.65rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Town Center</div>
                    <div style={{ fontSize: isMobile ? '1rem' : '1.25rem', fontWeight: '700', color: viewedProfile?.linked_tc_level ? '#fff' : '#4a4a4a' }}>{viewedProfile?.linked_tc_level ? formatTCLevel(viewedProfile.linked_tc_level) : '—'}</div>
                  </div>
                  <div style={{ padding: isMobile ? '0.5rem' : '0.875rem', minHeight: '48px', backgroundColor: '#0a0a0a', borderRadius: '8px', border: '1px solid #2a2a2a', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: isMobile ? '0.55rem' : '0.65rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Language</div>
                    <div style={{ fontSize: isMobile ? '1rem' : '1.25rem', fontWeight: '700', color: viewedProfile?.language ? '#fff' : '#4a4a4a' }}>
                      {viewedProfile?.language || '—'}
                    </div>
                  </div>
                  <div style={{ padding: isMobile ? '0.5rem' : '0.875rem', minHeight: '48px', backgroundColor: '#0a0a0a', borderRadius: '8px', border: '1px solid #2a2a2a', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: isMobile ? '0.55rem' : '0.65rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Region</div>
                    <div style={{ fontSize: isMobile ? '1rem' : '1.25rem', fontWeight: '700', color: viewedProfile?.region ? '#fff' : '#4a4a4a' }}>
                      {viewedProfile?.region || '—'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

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
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.75rem'
            }}>
              <span style={{ fontSize: '1rem' }}>📝</span>
              <span style={{ 
                fontSize: '0.95rem', 
                color: '#fff', 
                fontWeight: '600'
              }}>About Me:</span>
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

        {/* Profile Completion Progress - only show for own profile */}
        {!isViewingOther && (
          <ProfileCompletionProgress 
            profile={viewedProfile} 
            isMobile={isMobile} 
            onScrollToLink={scrollToLinkSection}
          />
        )}

        {/* Link Kingshot Account - only show for own profile when NOT linked */}
        {!isViewingOther && !viewedProfile?.linked_username && (
          <div id="link-kingshot-section" style={{ marginBottom: '1.5rem' }}>
            <LinkKingshotAccount
              onLink={async (playerData) => {
                if (updateProfile && user) {
                  await updateProfile({
                    ...viewedProfile,
                    linked_player_id: playerData.player_id,
                    linked_username: playerData.username,
                    linked_avatar_url: playerData.avatar_url,
                    linked_kingdom: playerData.kingdom,
                    linked_tc_level: playerData.town_center_level,
                    linked_last_synced: new Date().toISOString(),
                  });
                  // Assign Settler role in Discord (fire and forget)
                  discordService.syncSettlerRole(user.id, true).catch(() => {});
                }
              }}
              onUnlink={() => {}}
              linkedPlayer={null}
              subscriptionTier={isAdmin ? 'admin' : isRecruiter ? 'recruiter' : isPro ? 'pro' : 'free'}
            />
          </div>
        )}

        {/* Subscription Status - only show for own profile */}
        {!isViewingOther && user && (
          <div style={{
            backgroundColor: '#111111',
            borderRadius: '12px',
            padding: isMobile ? '1rem' : '1.25rem',
            marginBottom: '1.5rem',
            border: `1px solid ${isPro || isRecruiter ? themeColor : '#2a2a2a'}30`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.1rem' }}>{isAdmin ? '⚡' : isPro || isRecruiter ? '⭐' : '👤'}</span>
                <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '600', color: '#fff' }}>
                  Subscription
                </h3>
              </div>
              <div style={{
                padding: '0.25rem 0.75rem',
                backgroundColor: isAdmin ? '#ef444420' 
                  : isRecruiter ? '#f9731620' 
                  : isPro ? '#22d3ee20' 
                  : '#3a3a3a20',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: '600',
                color: isAdmin ? '#ef4444' 
                  : isRecruiter ? '#f97316' 
                  : isPro ? '#22d3ee' 
                  : '#9ca3af',
              }}>
                {tierName}
              </div>
            </div>
            
            <div style={{ 
              display: 'flex', 
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: isMobile ? 'stretch' : 'center', 
              justifyContent: 'space-between',
              gap: isMobile ? '0.75rem' : '1rem',
              flexWrap: 'wrap'
            }}>
              <p style={{ color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.85rem', margin: 0, lineHeight: 1.5 }}>
                {isAdmin 
                  ? 'You have full admin access to all features.'
                  : isPro || isRecruiter 
                  ? `You have full access to ${isRecruiter ? 'Recruiter' : 'Pro'} features.`
                  : 'Upgrade to unlock premium features and support the project.'}
              </p>
              
              {(isPro || isRecruiter) && !isAdmin ? (
                <button
                  onClick={async () => {
                    if (!user) return;
                    setManagingSubscription(true);
                    try {
                      // Try API-based portal session first (links to user's actual Stripe account)
                      const portalUrl = await createPortalSession(user.id);
                      window.location.href = portalUrl;
                    } catch (error) {
                      console.warn('API portal failed, trying direct URL:', error);
                      // Fallback to direct portal URL if configured
                      const directPortalUrl = getCustomerPortalUrl();
                      if (directPortalUrl && directPortalUrl !== '/profile') {
                        window.location.href = directPortalUrl;
                      } else {
                        alert('Unable to open subscription management. Please email support@ks-atlas.com for assistance.');
                      }
                    } finally {
                      setManagingSubscription(false);
                    }
                  }}
                  disabled={managingSubscription}
                  style={{
                    padding: isMobile ? '0.75rem 1rem' : '0.5rem 1rem',
                    minHeight: isMobile ? '48px' : 'auto',
                    width: isMobile ? '100%' : 'auto',
                    backgroundColor: 'transparent',
                    border: `1px solid ${themeColor}50`,
                    borderRadius: '10px',
                    color: themeColor,
                    fontSize: isMobile ? '0.9rem' : '0.85rem',
                    fontWeight: '500',
                    cursor: managingSubscription ? 'wait' : 'pointer',
                    opacity: managingSubscription ? 0.7 : 1,
                    WebkitTapHighlightColor: 'transparent'
                  }}
                >
                  {managingSubscription ? 'Opening Portal...' : 'Manage Subscription'}
                </button>
              ) : !isAdmin ? (
                <div style={{ 
                  display: 'flex', 
                  flexDirection: isMobile ? 'column' : 'row',
                  alignItems: isMobile ? 'stretch' : 'center', 
                  gap: isMobile ? '0.5rem' : '1rem', 
                  width: isMobile ? '100%' : 'auto'
                }}>
                  <Link
                    to="/upgrade"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: isMobile ? '0.75rem 1rem' : '0.5rem 1rem',
                      minHeight: isMobile ? '48px' : 'auto',
                      background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}cc 100%)`,
                      borderRadius: '10px',
                      color: '#000',
                      fontSize: isMobile ? '0.9rem' : '0.85rem',
                      fontWeight: '600',
                      textDecoration: 'none',
                      WebkitTapHighlightColor: 'transparent'
                    }}
                  >
                    Upgrade to Pro
                  </Link>
                  <button
                    onClick={async () => {
                      if (!user) return;
                      setManagingSubscription(true);
                      try {
                        const { syncSubscription } = await import('../lib/stripe');
                        const result = await syncSubscription(user.id);
                        if (result.synced && result.tier !== 'free') {
                          alert(`✅ ${result.message}`);
                          window.location.reload();
                        } else {
                          alert(result.message || 'No active subscription found.');
                        }
                      } catch (error) {
                        console.error('Sync error:', error);
                        alert('Unable to sync subscription. Please email support@ks-atlas.com');
                      } finally {
                        setManagingSubscription(false);
                      }
                    }}
                    disabled={managingSubscription}
                    style={{
                      padding: isMobile ? '0.625rem 0.75rem' : '0.5rem 0.75rem',
                      minHeight: isMobile ? '44px' : 'auto',
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#6b7280',
                      fontSize: isMobile ? '0.8rem' : '0.75rem',
                      cursor: managingSubscription ? 'wait' : 'pointer',
                      textDecoration: 'underline',
                      WebkitTapHighlightColor: 'transparent'
                    }}
                  >
                    {managingSubscription ? 'Syncing...' : 'Subscription not showing?'}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Discord Account Link - only show for own profile */}
        {!isViewingOther && user && (
          <div style={{ marginBottom: '1.5rem' }}>
            <LinkDiscordAccount
              discordId={profile?.discord_id}
              discordUsername={profile?.discord_username}
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

        {/* User's Kingdom Rankings - show if user has a linked kingdom or home kingdom */}
        <KingdomLeaderboardPosition 
          kingdomId={viewedProfile?.linked_kingdom || viewedProfile?.home_kingdom || null}
          themeColor={themeColor}
          isMobile={isMobile}
        />

        {/* Players from My Kingdom - only show for own profile */}
        {!isViewingOther && (
          <PlayersFromMyKingdom themeColor={themeColor} />
        )}


        {/* User Achievements */}
        <div style={{ marginBottom: '2rem' }}>
          <UserAchievements />
        </div>

        {/* C1: Submission History - only for logged in users viewing their own profile */}
        {!isViewingOther && user && (
          <div style={{ marginBottom: '2rem' }}>
            <SubmissionHistory userId={user.id} themeColor={themeColor} />
          </div>
        )}

        {/* Profile Features - Favorites, Watchlist, Reviews, etc. - only show for own profile */}
        {!isViewingOther && (
          <div>
            <ProfileFeatures />
          </div>
        )}
        
        <div style={{ textAlign: 'center', marginTop: '2rem', paddingBottom: '1rem' }}>
          <Link to="/" style={{ color: themeColor, textDecoration: 'none', fontSize: '0.8rem' }}>← Back to Home</Link>
        </div>
        </div>
      </div>
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
};

export default Profile;
