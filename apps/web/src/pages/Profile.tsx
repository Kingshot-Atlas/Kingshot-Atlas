import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import ParticleEffect from '../components/ParticleEffect';
import UserAchievements from '../components/UserAchievements';
import AuthModal from '../components/AuthModal';
import ProfileFeatures from '../components/ProfileFeatures';
import { useAuth, UserProfile } from '../contexts/AuthContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const FAVORITES_KEY = 'kingshot_favorites';

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

const Profile: React.FC = () => {
  const { userId } = useParams<{ userId?: string }>();
  useDocumentTitle(userId ? 'User Profile' : 'My Profile');
  const { user, profile, loading, updateProfile } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [viewedProfile, setViewedProfile] = useState<UserProfile | null>(null);
  const [isViewingOther, setIsViewingOther] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_favorites, _setFavorites] = useState<number[]>(() => {
    const saved = localStorage.getItem(FAVORITES_KEY);
    return saved ? JSON.parse(saved) : [];
  });
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

  const neonGlow = (color: string) => ({
    color: color,
    textShadow: `0 0 8px ${color}40, 0 0 12px ${color}20`
  });

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (userId) {
      // Viewing another user's profile
      const loadOtherProfile = () => {
        // Check demo users first
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
        
        // Try to find profile in localStorage (simulated database)
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith('kingshot_profile_')) {
            try {
              const userProfile = JSON.parse(localStorage.getItem(key) || '{}');
              if (userProfile.id === userId) {
                setViewedProfile(userProfile);
                setIsViewingOther(true);
                return;
              }
            } catch (e) {
              // Skip invalid profiles
            }
          }
        }
      };
      
      loadOtherProfile();
    } else {
      // Viewing own profile
      setViewedProfile(profile);
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
            Sign in to access your profile, track kingdoms, and earn achievements.
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
              ← Back to Directory
            </Link>
          </div>
        </div>
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </div>
    );
  }

  if (!viewedProfile) {
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
            {isViewingOther ? viewedProfile?.bio : 'Manage your profile and tracked kingdoms'}
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

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
        {/* Profile Card */}
        <div style={{
          backgroundColor: '#111111',
          borderRadius: '16px',
          padding: '2rem',
          marginBottom: '2rem',
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
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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
                        title={c.name}
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
                          title={s.desc}
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
                {viewedProfile?.avatar_url ? (
                  <img 
                    src={viewedProfile.avatar_url} 
                    alt="Avatar"
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: `2px solid ${themeColor}`
                    }}
                  />
                ) : (
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem',
                    color: '#000',
                    fontWeight: 'bold',
                    ...getBadgeStyle(viewedProfile?.badge_style || 'default', themeColor)
                  }}>
                    {viewedProfile?.username?.[0]?.toUpperCase() ?? '?'}
                  </div>
                )}
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
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
        {/* User Achievements */}
        <div style={{ marginBottom: '2rem' }}>
          <UserAchievements />
        </div>

        {/* Profile Features - Favorites, Watchlist, Reviews, etc. */}
        <div>
          <ProfileFeatures />
          <div style={{ textAlign: 'center', marginTop: '2rem', paddingBottom: '1rem' }}>
            <Link to="/" style={{ color: themeColor, textDecoration: 'none', fontSize: '0.8rem' }}>← Back to Directory</Link>
          </div>
        </div>
        </div>
      </div>
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
};

export default Profile;
