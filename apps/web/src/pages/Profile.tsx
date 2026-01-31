import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import ParticleEffect from '../components/ParticleEffect';
import UserAchievements from '../components/UserAchievements';
import SubmissionHistory from '../components/SubmissionHistory';
import AuthModal from '../components/AuthModal';
import ProfileFeatures from '../components/ProfileFeatures';
import LinkKingshotAccount from '../components/LinkKingshotAccount';
import PlayersFromMyKingdom from '../components/PlayersFromMyKingdom';
import UserCorrectionStats from '../components/UserCorrectionStats';
import { useAuth, getCacheBustedAvatarUrl, UserProfile } from '../contexts/AuthContext';
import { usePremium } from '../contexts/PremiumContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getCustomerPortalUrl, createPortalSession } from '../lib/stripe';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useIsMobile } from '../hooks/useMediaQuery';
import { neonGlow } from '../utils/styles';

// Avatar component with error handling and fallback
const AvatarWithFallback: React.FC<{
  avatarUrl?: string;
  username?: string;
  size: number;
  themeColor: string;
  badgeStyle?: string;
}> = ({ avatarUrl, username, size, themeColor, badgeStyle = 'default' }) => {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

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

  // Show fallback if no URL, error loading, or URL is empty
  if (!avatarUrl || imgError || avatarUrl === '') {
    return (
      <div style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: `${size * 0.4}px`,
        color: '#000',
        fontWeight: 'bold',
        ...getBadgeStyle(badgeStyle, themeColor)
      }}>
        {username?.[0]?.toUpperCase() ?? '?'}
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
        crossOrigin="anonymous"
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

const THEME_COLORS = [
  { name: 'Cyan', value: '#22d3ee' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Gold', value: '#fbbf24' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Lime', value: '#84cc16' }
];

const BADGE_STYLES = [
  { name: 'Default', value: 'default', desc: 'Solid color badge' },
  { name: 'Gradient', value: 'gradient', desc: 'Color gradient effect' },
  { name: 'Outline', value: 'outline', desc: 'Outlined with transparent fill' },
  { name: 'Glow', value: 'glow', desc: 'Glowing neon effect' }
];

interface EditForm {
  username: string;
  home_kingdom: number | null;
  alliance_tag: string;
  language: string;
  region: string;
  bio: string;
  theme_color: string;
  badge_style: string;
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

  const winRate = kingdom.kvk_count > 0 ? ((kingdom.total_wins / (kingdom.kvk_count * 2)) * 100).toFixed(0) : '0';

  return (
    <div style={{
      backgroundColor: '#111111',
      borderRadius: '12px',
      padding: isMobile ? '1rem' : '1.25rem',
      marginBottom: '1.5rem',
      border: `1px solid ${themeColor}30`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <span style={{ fontSize: '1.1rem' }}>🏆</span>
        <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '600', color: '#fff' }}>
          Kingdom Leaderboard Position
        </h3>
      </div>
      
      <Link to={`/kingdom/${kingdom.id}`} style={{ textDecoration: 'none' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          gap: '0.75rem',
        }}>
          <div style={{ padding: '0.875rem', minHeight: '48px', backgroundColor: '#0a0a0a', borderRadius: '8px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '0.65rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Kingdom</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '700', color: themeColor }}>{kingdom.id}</div>
          </div>
          <div style={{ padding: '0.875rem', minHeight: '48px', backgroundColor: '#0a0a0a', borderRadius: '8px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '0.65rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Rank</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#fff' }}>#{kingdom.rank}</div>
          </div>
          <div style={{ padding: '0.875rem', minHeight: '48px', backgroundColor: '#0a0a0a', borderRadius: '8px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '0.65rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Atlas Score</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '700', ...neonGlow(themeColor) }}>{kingdom.atlas_score.toFixed(1)}</div>
          </div>
          <div style={{ padding: '0.875rem', minHeight: '48px', backgroundColor: '#0a0a0a', borderRadius: '8px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '0.65rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Win Rate</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '700', color: parseInt(winRate) >= 50 ? '#22c55e' : '#ef4444' }}>{winRate}%</div>
          </div>
        </div>
      </Link>
      
      <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#6b7280', textAlign: 'center' }}>
        {kingdom.total_wins}W - {kingdom.total_losses}L across {kingdom.kvk_count} KvKs • <Link to={`/kingdom/${kingdom.id}`} style={{ color: themeColor }}>View Details →</Link>
      </div>
    </div>
  );
};

const Profile: React.FC = () => {
  const { userId } = useParams<{ userId?: string }>();
  useDocumentTitle(userId ? 'User Profile' : 'My Profile');
  const { user, profile, loading, updateProfile, refreshLinkedPlayer } = useAuth();
  const { tierName, isPro, isRecruiter, isAdmin } = usePremium();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [managingSubscription, setManagingSubscription] = useState(false);
  const isMobile = useIsMobile();
  const [viewedProfile, setViewedProfile] = useState<UserProfile | null>(null);
  const [isViewingOther, setIsViewingOther] = useState(false);
  const [viewedUserTier, setViewedUserTier] = useState<'free' | 'pro' | 'recruiter'>('free');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    username: '',
    home_kingdom: null,
    alliance_tag: '',
    language: '',
    region: '',
    bio: '',
    theme_color: '#22d3ee',
    badge_style: 'default'
  });

  const themeColor = viewedProfile?.theme_color || '#22d3ee';

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
              // Set subscription tier from profile data
              const tier = data.subscription_tier as 'free' | 'pro' | 'recruiter' | undefined;
              setViewedUserTier(tier || 'free');
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
        username: viewedProfile.username || '',
        home_kingdom: viewedProfile.home_kingdom,
        alliance_tag: viewedProfile.alliance_tag || '',
        language: viewedProfile.language || '',
        region: viewedProfile.region || '',
        bio: viewedProfile.bio || '',
        theme_color: viewedProfile.theme_color || '#22d3ee',
        badge_style: viewedProfile.badge_style || 'default'
      });
    }
  }, [viewedProfile, isViewingOther]);

  const handleSave = async () => {
    await updateProfile(editForm);
    setIsEditing(false);
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
            <span style={{ color: '#fff' }}>{isViewingOther ? viewedProfile?.username?.toUpperCase() : 'MY'}</span>
            <span style={{ ...neonGlow(themeColor), marginLeft: '0.5rem', fontSize: isMobile ? '1.6rem' : '2.25rem' }}>PROFILE</span>
          </h1>
          <p style={{ color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.9rem', marginBottom: '0.75rem' }}>
            {isViewingOther ? viewedProfile?.bio : 'Your command center for kingdom intel'}
          </p>
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
              <div>
                <label style={{ color: '#9ca3af', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>Username</label>
                <input
                  type="text"
                  value={editForm.username}
                  onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                  placeholder="Enter your username"
                  style={inputStyle}
                />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '0.75rem' : '1rem' }}>
                <div>
                  <label style={{ color: '#9ca3af', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>Home Kingdom</label>
                  <input
                    type="number"
                    value={editForm.home_kingdom || ''}
                    onChange={(e) => setEditForm({ ...editForm, home_kingdom: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="Kingdom number"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ color: '#9ca3af', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>Alliance Tag (3 chars)</label>
                  <input
                    type="text"
                    value={editForm.alliance_tag}
                    onChange={(e) => handleAllianceTagChange(e.target.value)}
                    placeholder="e.g. TWS"
                    maxLength={3}
                    style={{ ...inputStyle, textTransform: 'uppercase', letterSpacing: '0.1em' }}
                  />
                </div>
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

              {/* Visual Customization */}
              <div style={{ borderTop: '1px solid #2a2a2a', paddingTop: '1.5rem' }}>
                <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: '600', marginBottom: '1rem' }}>Visual Customization</h3>
                
                {/* Theme Color */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ color: '#9ca3af', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>
                    Theme Color
                    <span style={{ color: '#6b7280', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                      (affects your profile accent)
                    </span>
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {THEME_COLORS.map(c => (
                      <button
                        key={c.value}
                        onClick={() => setEditForm({ ...editForm, theme_color: c.value })}
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          backgroundColor: c.value,
                          border: editForm.theme_color === c.value ? '3px solid #fff' : '2px solid transparent',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          boxShadow: editForm.theme_color === c.value ? `0 0 12px ${c.value}60` : 'none'
                        }}
                        aria-label={c.name}
                        onMouseEnter={(e) => {
                          if (editForm.theme_color !== c.value) {
                            e.currentTarget.style.transform = 'scale(1.1)';
                            e.currentTarget.style.boxShadow = `0 0 8px ${c.value}40`;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (editForm.theme_color !== c.value) {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = 'none';
                          }
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Badge Style */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ color: '#9ca3af', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>
                    Alliance Badge Style
                    <span style={{ color: '#6b7280', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                      (how your alliance tag appears)
                    </span>
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                    {BADGE_STYLES.map(s => (
                      <div key={s.value} style={{ position: 'relative' }}>
                        <button
                          onClick={() => setEditForm({ ...editForm, badge_style: s.value })}
                          style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            color: s.value === 'outline' ? editForm.theme_color : '#000',
                            fontWeight: '600',
                            border: editForm.badge_style === s.value ? '2px solid #fff' : '2px solid transparent',
                            transition: 'all 0.2s',
                            ...getBadgeStyle(s.value, editForm.theme_color)
                          }}
                          aria-label={s.desc}
                        >
                          {s.name}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Badge Preview */}
                <div style={{ 
                  padding: '1rem', 
                  backgroundColor: '#0a0a0a', 
                  borderRadius: '8px',
                  border: '1px solid #2a2a2a'
                }}>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>Preview</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '8px',
                      ...getBadgeStyle(editForm.badge_style, editForm.theme_color),
                      color: editForm.badge_style === 'outline' ? editForm.theme_color : '#000',
                      fontSize: '1.1rem',
                      fontWeight: 'bold',
                      letterSpacing: '0.1em'
                    }}>
                      [{editForm.alliance_tag || 'TAG'}]
                    </div>
                    <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                      K-{editForm.home_kingdom || '???'}
                    </span>
                  </div>
                </div>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <AvatarWithFallback 
                  avatarUrl={viewedProfile?.avatar_url}
                  username={viewedProfile?.username}
                  size={64}
                  themeColor={themeColor}
                  badgeStyle={viewedProfile?.badge_style}
                />
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff' }}>
                    {viewedProfile?.username || 'Anonymous User'}
                  </div>
                  {viewedProfile?.home_kingdom && (
                    <Link to={`/kingdom/${viewedProfile.home_kingdom}`} style={{ color: themeColor, textDecoration: 'none', fontSize: '0.9rem' }}>
                      Home: Kingdom {viewedProfile.home_kingdom}
                    </Link>
                  )}
                </div>
              </div>
              {!isViewingOther && (
                <button
                  onClick={() => setIsEditing(true)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: 'transparent',
                    border: '1px solid #3a3a3a',
                    borderRadius: '8px',
                    color: '#9ca3af',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  Edit Profile
                </button>
              )}
            </div>

            {/* Profile Details */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: isMobile ? '0.5rem' : '1rem', marginBottom: isMobile ? '1rem' : '1.5rem' }}>
              {viewedProfile?.alliance_tag && (
                <div style={{ padding: '0.75rem', backgroundColor: '#0a0a0a', borderRadius: '8px', border: '1px solid #2a2a2a' }}>
                  <div style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Alliance</div>
                  <div style={{ fontSize: '1.1rem', color: themeColor, fontWeight: 'bold', letterSpacing: '0.1em' }}>[{viewedProfile.alliance_tag}]</div>
                </div>
              )}
              {viewedProfile?.language && (
                <div style={{ padding: '0.75rem', backgroundColor: '#0a0a0a', borderRadius: '8px', border: '1px solid #2a2a2a' }}>
                  <div style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Language</div>
                  <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: '500' }}>{viewedProfile.language}</div>
                </div>
              )}
              {viewedProfile?.region && (
                <div style={{ padding: '0.75rem', backgroundColor: '#0a0a0a', borderRadius: '8px', border: '1px solid #2a2a2a' }}>
                  <div style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Region</div>
                  <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: '500' }}>{viewedProfile.region}</div>
                </div>
              )}
            </div>
            {viewedProfile?.bio && (
              <p style={{ color: '#9ca3af', lineHeight: 1.6 }}>{viewedProfile.bio}</p>
            )}
          </div>
        )}

        {/* Link Kingshot Account - FIRST card after profile info, only show for own profile */}
        {!isViewingOther && (
          <div style={{ marginBottom: '1.5rem' }}>
            <LinkKingshotAccount
              onLink={(playerData) => {
                if (updateProfile) {
                  updateProfile({
                    ...viewedProfile,
                    linked_player_id: playerData.player_id,
                    linked_username: playerData.username,
                    linked_avatar_url: playerData.avatar_url,
                    linked_kingdom: playerData.kingdom,
                    linked_tc_level: playerData.town_center_level,
                    linked_last_synced: new Date().toISOString(),
                  });
                }
              }}
              onUnlink={() => {
                if (updateProfile) {
                  updateProfile({
                    ...viewedProfile,
                    linked_player_id: undefined,
                    linked_username: undefined,
                    linked_avatar_url: undefined,
                    linked_kingdom: undefined,
                    linked_tc_level: undefined,
                    linked_last_synced: undefined,
                  });
                }
              }}
              linkedPlayer={viewedProfile?.linked_player_id ? {
                player_id: viewedProfile.linked_player_id,
                username: viewedProfile.linked_username || 'Unknown',
                avatar_url: viewedProfile.linked_avatar_url || null,
                kingdom: viewedProfile.linked_kingdom || 0,
                town_center_level: viewedProfile.linked_tc_level || 0,
                verified: true,
              } : null}
              lastSynced={viewedProfile?.linked_last_synced}
              onRefresh={refreshLinkedPlayer}
              subscriptionTier={isRecruiter ? 'recruiter' : isPro ? 'pro' : 'free'}
            />
          </div>
        )}

        {/* Linked Kingshot Account - Public view for other profiles */}
        {isViewingOther && viewedProfile?.linked_player_id && (
          <div style={{ marginBottom: '1.5rem' }}>
            <LinkKingshotAccount
              linkedPlayer={{
                player_id: viewedProfile.linked_player_id,
                username: viewedProfile.linked_username || 'Unknown',
                avatar_url: viewedProfile.linked_avatar_url || null,
                kingdom: viewedProfile.linked_kingdom || 0,
                town_center_level: viewedProfile.linked_tc_level || 0,
                verified: true,
              }}
              subscriptionTier={viewedUserTier}
              isPublicView={true}
              showRefresh={false}
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
                backgroundColor: isAdmin ? '#fbbf2420' 
                  : isRecruiter ? '#f9731620' 
                  : isPro ? '#22d3ee20' 
                  : '#3a3a3a20',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: '600',
                color: isAdmin ? '#fbbf24' 
                  : isRecruiter ? '#f97316' 
                  : isPro ? '#22d3ee' 
                  : '#9ca3af',
              }}>
                {tierName}
              </div>
            </div>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap'
            }}>
              <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: 0 }}>
                {isAdmin 
                  ? 'You have full admin access to all features.'
                  : isPro || isRecruiter 
                  ? `You have full access to ${isRecruiter ? 'Recruiter' : 'Pro'} features.`
                  : 'Upgrade to unlock premium features and support the project.'}
              </p>
              
              {isPro || isRecruiter ? (
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
                    padding: '0.5rem 1rem',
                    backgroundColor: 'transparent',
                    border: `1px solid ${themeColor}50`,
                    borderRadius: '8px',
                    color: themeColor,
                    fontSize: '0.85rem',
                    fontWeight: '500',
                    cursor: managingSubscription ? 'wait' : 'pointer',
                    opacity: managingSubscription ? 0.7 : 1,
                  }}
                >
                  {managingSubscription ? 'Opening Portal...' : 'Manage Subscription'}
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <Link
                    to="/upgrade"
                    style={{
                      padding: '0.5rem 1rem',
                      background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}cc 100%)`,
                      borderRadius: '8px',
                      color: '#000',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      textDecoration: 'none',
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
                      padding: '0.5rem 0.75rem',
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#6b7280',
                      fontSize: '0.75rem',
                      cursor: managingSubscription ? 'wait' : 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    {managingSubscription ? 'Syncing...' : 'Subscription not showing?'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Kingdom Leaderboard Position - show if user has a linked kingdom or home kingdom */}
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

        {/* Data Contributions - KvK correction stats */}
        {user && (
          <div style={{ marginBottom: '2rem' }}>
            <UserCorrectionStats 
              userId={isViewingOther ? (viewedProfile?.id || '') : user.id}
              username={isViewingOther ? viewedProfile?.username : profile?.username}
              themeColor={themeColor}
              isOwnProfile={!isViewingOther}
            />
          </div>
        )}

        {/* C1: Submission History - only for logged in users viewing their own profile */}
        {!isViewingOther && user && (
          <div style={{ marginBottom: '2rem' }}>
            <SubmissionHistory userId={user.id} themeColor={themeColor} />
          </div>
        )}

        {/* Profile Features - Favorites, Watchlist, Reviews, etc. */}
        <div>
          <ProfileFeatures />
          <div style={{ textAlign: 'center', marginTop: '2rem', paddingBottom: '1rem' }}>
            <Link to="/" style={{ color: themeColor, textDecoration: 'none', fontSize: '0.8rem' }}>← Back to Home</Link>
          </div>
        </div>
        </div>
      </div>
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
};

export default Profile;
