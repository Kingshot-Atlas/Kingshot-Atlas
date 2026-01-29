import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, UserProfile } from '../contexts/AuthContext';

const UserDirectory: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBy, setFilterBy] = useState<'all' | 'alliance' | 'region' | 'kingdom'>('all');
  const [filterValue, setFilterValue] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Simulate loading users from profiles
    // In real app, this would be an API call
    const profilesKey = 'kingshot_profile';
    const savedProfiles = localStorage.getItem(profilesKey);
    
    if (savedProfiles) {
      // Get all profiles from localStorage (simulated user database)
      const allProfiles: UserProfile[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('kingshot_profile_')) {
          try {
            const profile = JSON.parse(localStorage.getItem(key) || '{}');
            if (profile.username) allProfiles.push(profile);
          } catch (e) {
            // Skip invalid profiles
          }
        }
      }
      
      // Add some demo users if no real users exist
      if (allProfiles.length === 0) {
        allProfiles.push(
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
        );
      }
      
      setUsers(allProfiles);
    }
    setLoading(false);
  }, []);

  const filteredUsers = users.filter(user => {
    if (user.id === currentUser?.id) return false; // Don't show current user
    
    const matchesSearch = !searchQuery || 
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.bio.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.alliance_tag.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    
    switch (filterBy) {
      case 'alliance':
        return !filterValue || user.alliance_tag === filterValue;
      case 'region':
        return !filterValue || user.region === filterValue;
      case 'kingdom':
        return !filterValue || user.home_kingdom === parseInt(filterValue);
      default:
        return true;
    }
  });

  const neonGlow = (color: string) => ({
    color: color,
    textShadow: `0 0 8px ${color}40, 0 0 12px ${color}20`
  });

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

  const uniqueAlliances = Array.from(new Set(users.map(u => u.alliance_tag).filter(Boolean)));
  const uniqueRegions = Array.from(new Set(users.map(u => u.region).filter(Boolean)));
  const uniqueKingdoms = Array.from(new Set(users.map(u => u.home_kingdom).filter(Boolean)));

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#6b7280' }}>Loading users...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      {/* Hero Section */}
      <div style={{ 
        padding: isMobile ? '1.25rem 1rem 1rem' : '1.75rem 2rem 1.25rem',
        textAlign: 'center',
        background: 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '800px', margin: '0 auto' }}>
          <h1 style={{ 
            fontSize: isMobile ? '1.5rem' : '2rem', 
            fontWeight: 'bold', 
            marginBottom: '0.5rem',
            fontFamily: "'Cinzel', 'Times New Roman', serif"
          }}>
            <span style={{ color: '#fff' }}>PLAYER</span>
            <span style={{ ...neonGlow('#22d3ee'), marginLeft: '0.5rem', fontSize: isMobile ? '1.6rem' : '2.25rem' }}>DIRECTORY</span>
          </h1>
          <p style={{ color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.9rem', marginBottom: '0.75rem' }}>
            Find allies, scout rivals, connect with the community
          </p>
          
          {!isMobile && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '50px', height: '2px', background: 'linear-gradient(90deg, transparent, #22d3ee)' }} />
            <div style={{ width: '6px', height: '6px', backgroundColor: '#22d3ee', transform: 'rotate(45deg)', boxShadow: '0 0 8px #22d3ee' }} />
            <div style={{ width: '50px', height: '2px', background: 'linear-gradient(90deg, #22d3ee, transparent)' }} />
          </div>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: isMobile ? '1rem' : '1.5rem 2rem' }}>
        <div style={{ 
          display: 'flex', 
          flexDirection: isMobile ? 'column' : 'row',
          gap: '1rem', 
          marginBottom: '2rem',
          flexWrap: 'wrap'
        }}>
          {/* Search */}
          <div style={{ flex: 1, minWidth: '250px' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search players by name, bio, or alliance..."
              style={{
                width: '100%',
                padding: '0.875rem 1rem',
                backgroundColor: '#111116',
                border: '1px solid #2a2a2a',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.95rem',
                outline: 'none',
                transition: 'border-color 0.2s ease'
              }}
              onFocus={(e) => e.target.style.borderColor = '#22d3ee'}
              onBlur={(e) => e.target.style.borderColor = '#2a2a2a'}
            />
          </div>

          {/* Filter Dropdown */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select
              value={filterBy}
              onChange={(e) => {
                setFilterBy(e.target.value as 'all' | 'alliance' | 'region' | 'kingdom');
                setFilterValue('');
              }}
              style={{
                padding: '0.875rem 1rem',
                backgroundColor: '#111116',
                border: '1px solid #2a2a2a',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.95rem',
                cursor: 'pointer',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.75rem center',
                backgroundSize: '1rem'
              }}
            >
              <option value="all">All Players</option>
              <option value="alliance">By Alliance</option>
              <option value="region">By Region</option>
              <option value="kingdom">By Kingdom</option>
            </select>

            {filterBy !== 'all' && (
              <select
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                style={{
                  padding: '0.875rem 1rem',
                  backgroundColor: '#111116',
                  border: '1px solid #2a2a2a',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.75rem center',
                  backgroundSize: '1rem'
                }}
              >
                <option value="">All</option>
                {filterBy === 'alliance' && uniqueAlliances.map(tag => (
                  <option key={tag} value={tag}>[{tag}]</option>
                ))}
                {filterBy === 'region' && uniqueRegions.map(region => (
                  <option key={region} value={region}>{region}</option>
                ))}
                {filterBy === 'kingdom' && [...uniqueKingdoms].sort((a, b) => (a || 0) - (b || 0)).map(kingdom => (
                  <option key={kingdom} value={kingdom?.toString()}>Kingdom {kingdom}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Results Count */}
        <div style={{ marginBottom: '1.5rem' }}>
          <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>
            Showing <span style={{ ...neonGlow('#22d3ee'), fontWeight: '600' }}>{filteredUsers.length}</span> player{filteredUsers.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* User Grid */}
        {filteredUsers.length === 0 ? (
          <div style={{
            backgroundColor: '#111116',
            borderRadius: '12px',
            padding: '3rem 2rem',
            border: '1px solid #2a2a2a',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
            <h3 style={{ color: '#fff', fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.75rem' }}>
              No players found
            </h3>
            <p style={{ color: '#6b7280', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
              Try adjusting your search or filters to find players.
            </p>
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(350px, 1fr))', 
            gap: '1.5rem' 
          }}>
            {filteredUsers.map(user => (
              <Link
                key={user.id}
                to={`/profile/${user.id}`}
                style={{
                  textDecoration: 'none',
                  display: 'block'
                }}
              >
                <div style={{
                  backgroundColor: '#111116',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  border: '1px solid #2a2a2a',
                  transition: 'transform 0.2s, border-color 0.2s',
                  cursor: 'pointer',
                  height: '100%'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = user.theme_color + '40';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = '#1f1f1f';
                }}
                >
                  {/* User Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    {user.avatar_url ? (
                      <img 
                        src={user.avatar_url} 
                        alt=""
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '50%',
                          objectFit: 'cover'
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.25rem',
                        color: '#fff',
                        fontWeight: 'bold',
                        ...getBadgeStyle(user.badge_style, user.theme_color)
                      }}>
                        {user.username?.[0]?.toUpperCase() ?? '?'}
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        fontSize: '1.1rem', 
                        fontWeight: 'bold', 
                        color: '#fff',
                        marginBottom: '0.25rem'
                      }}>
                        {user.username}
                      </div>
                      {user.alliance_tag && (
                        <div style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          fontWeight: 'bold',
                          backgroundColor: `${user.theme_color}20`,
                          color: user.theme_color
                        }}>
                          [{user.alliance_tag}]
                        </div>
                      )}
                    </div>
                  </div>

                  {/* User Info */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                    {user.home_kingdom && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>🏠</span>
                        <span style={{ color: '#fff', fontSize: '0.9rem' }}>
                          Home: Kingdom {user.home_kingdom}
                        </span>
                      </div>
                    )}
                    {user.region && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>🌍</span>
                        <span style={{ color: '#fff', fontSize: '0.9rem' }}>{user.region}</span>
                      </div>
                    )}
                    {user.language && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>💬</span>
                        <span style={{ color: '#fff', fontSize: '0.9rem' }}>{user.language}</span>
                      </div>
                    )}
                  </div>

                  {/* Bio */}
                  {user.bio && (
                    <p style={{ 
                      color: '#9ca3af', 
                      fontSize: '0.85rem', 
                      lineHeight: 1.5,
                      margin: 0,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {user.bio}
                    </p>
                  )}

                  {/* View Profile Button */}
                  <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '0.5rem 1.5rem',
                      backgroundColor: 'transparent',
                      border: `1px solid ${user.theme_color}`,
                      borderRadius: '6px',
                      color: user.theme_color,
                      fontSize: '0.85rem',
                      fontWeight: '500',
                      transition: 'all 0.2s'
                    }}>
                      View Profile →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Back to Home */}
      <div style={{ textAlign: 'center', marginTop: '3rem', paddingBottom: '2rem' }}>
        <Link to="/" style={{ color: '#22d3ee', textDecoration: 'none', fontSize: '0.85rem' }}>
          ← Back to Home
        </Link>
      </div>
    </div>
  );
};

export default UserDirectory;
