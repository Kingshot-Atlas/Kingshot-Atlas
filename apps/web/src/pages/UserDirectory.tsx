import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth, UserProfile } from '../contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { colors, neonGlow as neonGlowUtil, subscriptionColors, FONT_DISPLAY } from '../utils/styles';
import { getDisplayTier, getTierBorderColor, SubscriptionTier } from '../utils/constants';
import { logger } from '../utils/logger';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useMetaTags, PAGE_META_TAGS } from '../hooks/useMetaTags';
import { useStructuredData, PAGE_BREADCRUMBS } from '../hooks/useStructuredData';

// Get username color based on subscription tier (including admin)
const getUsernameColor = (tier: SubscriptionTier | null | undefined): string => {
  switch (tier) {
    case 'supporter': return subscriptionColors.supporter;
    case 'admin': return subscriptionColors.admin;
    default: return colors.text;
  }
};

// Convert TC level to display string (TC 31+ becomes TG tiers)
// Source of truth: Level 35-39 = TG1, 40-44 = TG2, 45-49 = TG3, 50-54 = TG4, 55-59 = TG5, etc.
const formatTCLevel = (level: number | null | undefined): string => {
  if (!level) return '';
  if (level <= 30) return `TC ${level}`;
  if (level <= 34) return 'TC 30';
  const tgTier = Math.floor((level - 35) / 5) + 1;
  return `TG${tgTier}`;
};

const UserDirectory: React.FC = () => {
  useDocumentTitle('Player Directory');
  useMetaTags(PAGE_META_TAGS.players);
  useStructuredData({ type: 'BreadcrumbList', data: PAGE_BREADCRUMBS.players });
  const { user: currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [allKingdoms, setAllKingdoms] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Initialize filters from URL params
  const urlKingdom = searchParams.get('kingdom');
  const [filterBy, setFilterBy] = useState<'all' | 'alliance' | 'region' | 'kingdom'>(urlKingdom ? 'kingdom' : 'all');
  const [filterValue, setFilterValue] = useState(urlKingdom || '');
  const [tierFilter, setTierFilter] = useState<'all' | 'admin' | 'supporter'>('all');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  // Searchable kingdom filter state
  const [kingdomSearchInput, setKingdomSearchInput] = useState(urlKingdom ? `Kingdom ${urlKingdom}` : '');
  const [showKingdomDropdown, setShowKingdomDropdown] = useState(false);
  const kingdomInputRef = React.useRef<HTMLInputElement>(null);
  const kingdomDropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch all kingdoms for the dropdown
  useEffect(() => {
    const fetchKingdoms = async () => {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data } = await supabase
            .from('kingdoms')
            .select('kingdom_number')
            .order('kingdom_number', { ascending: true });
          
          if (data) {
            setAllKingdoms(data.map(k => k.kingdom_number));
          }
        } catch (err) {
          console.error('[PlayerDirectory] Failed to fetch kingdoms:', err);
        }
      }
    };
    fetchKingdoms();
  }, []);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      
      // Fetch from Supabase if configured
      if (isSupabaseConfigured && supabase) {
        try {
          logger.log('[PlayerDirectory] Fetching users from Supabase...');
          const { data, error } = await supabase
            .from('profiles')
            .select('id, username, email, avatar_url, home_kingdom, alliance_tag, language, region, bio, theme_color, badge_style, created_at, linked_username, linked_avatar_url, linked_kingdom, linked_tc_level, subscription_tier')
            .neq('linked_username', '')
            .not('linked_username', 'is', null)
            .order('created_at', { ascending: false })
            .limit(100);

          logger.log('[PlayerDirectory] Query result:', { data, error, count: data?.length });

          if (error) {
            console.error('[PlayerDirectory] Supabase error:', error);
          }

          if (data && data.length > 0) {
            // Sort: by tier hierarchy (Admin > Recruiter > Pro > Free), then by created_at
            // Use getDisplayTier to properly detect admins by username
            const sorted = [...data].sort((a, b) => {
              const tierOrder = { admin: 0, supporter: 1, free: 2 };
              const aDisplayTier = getDisplayTier(a.subscription_tier, a.linked_username || a.username);
              const bDisplayTier = getDisplayTier(b.subscription_tier, b.linked_username || b.username);
              const aTier = tierOrder[aDisplayTier as keyof typeof tierOrder] ?? 3;
              const bTier = tierOrder[bDisplayTier as keyof typeof tierOrder] ?? 3;
              if (aTier !== bTier) return aTier - bTier;
              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            });
            setUsers(sorted as UserProfile[]);
            setLoading(false);
            return;
          }
        } catch (err) {
          console.error('[PlayerDirectory] Failed to fetch users:', err);
        }
      }

      // Fallback to demo users with linked Kingshot accounts
      const demoUsers: UserProfile[] = [
        {
          id: 'demo1',
          username: 'demo1_discord',
          email: 'demo1@example.com',
          avatar_url: '',
          home_kingdom: 42,
          alliance_tag: 'DRG',
          language: 'English',
          region: 'Americas',
          bio: 'Leading kingdoms to victory since KvK #1',
          theme_color: '#ef4444',
          badge_style: 'glow',
          created_at: new Date().toISOString(),
          subscription_tier: 'supporter',
          linked_username: 'DragonSlayer',
          linked_avatar_url: '',
          linked_kingdom: 42,
          linked_tc_level: 35
        },
        {
          id: 'demo2',
          username: 'demo2_google',
          email: 'demo2@example.com',
          avatar_url: '',
          home_kingdom: 17,
          alliance_tag: 'PHX',
          language: 'Spanish',
          region: 'Europe',
          bio: 'From ashes we rise. Building the strongest alliances.',
          theme_color: '#f97316',
          badge_style: 'gradient',
          created_at: new Date().toISOString(),
          subscription_tier: 'supporter',
          linked_username: 'PhoenixRising',
          linked_avatar_url: '',
          linked_kingdom: 17,
          linked_tc_level: 32
        },
        {
          id: 'demo3',
          username: 'demo3_discord',
          email: 'demo3@example.com',
          avatar_url: '',
          home_kingdom: 88,
          alliance_tag: 'SHD',
          language: 'English',
          region: 'Asia',
          bio: 'Master strategist. Victory through superior tactics.',
          theme_color: '#8b5cf6',
          badge_style: 'outline',
          created_at: new Date().toISOString(),
          subscription_tier: 'free',
          linked_username: 'ShadowHunter',
          linked_avatar_url: '',
          linked_kingdom: 88,
          linked_tc_level: 28
        }
      ];
      
      setUsers(demoUsers);
      setLoading(false);
    };

    fetchUsers();
  }, []);

  const filteredUsers = users.filter(user => {
    // Search by linked Kingshot username or alliance tag
    const matchesSearch = !searchQuery || 
      (user.linked_username && user.linked_username.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (user.alliance_tag && user.alliance_tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (!matchesSearch) return false;

    // Tier filter - use getDisplayTier to properly detect admins
    if (tierFilter !== 'all') {
      const userDisplayTier = getDisplayTier(user.subscription_tier, user.linked_username || user.username);
      if (userDisplayTier !== tierFilter) return false;
    }
    
    switch (filterBy) {
      case 'alliance':
        return !filterValue || user.alliance_tag === filterValue;
      case 'region':
        return !filterValue || user.region === filterValue;
      case 'kingdom':
        return !filterValue || user.linked_kingdom === parseInt(filterValue);
      default:
        return true;
    }
  });

  const neonGlow = (color: string) => ({
    color: color,
    textShadow: `0 0 8px ${color}40, 0 0 12px ${color}20`
  });

  const uniqueAlliances = Array.from(new Set(users.map(u => u.alliance_tag).filter(Boolean)));
  const uniqueRegions = Array.from(new Set(users.map(u => u.region).filter(Boolean)));
  // Use all kingdoms from DB, not just those with users
  const uniqueKingdoms = allKingdoms.length > 0 ? allKingdoms : Array.from(new Set(users.map(u => u.home_kingdom).filter(Boolean)));
  
  // Calculate player counts per kingdom
  const kingdomPlayerCounts = React.useMemo(() => {
    const counts: Record<number, number> = {};
    users.forEach(u => {
      if (u.linked_kingdom) {
        counts[u.linked_kingdom] = (counts[u.linked_kingdom] || 0) + 1;
      }
    });
    return counts;
  }, [users]);
  
  // Calculate player counts per alliance
  const alliancePlayerCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    users.forEach(u => {
      if (u.alliance_tag) {
        counts[u.alliance_tag] = (counts[u.alliance_tag] || 0) + 1;
      }
    });
    return counts;
  }, [users]);
  
  // Filter kingdoms based on search input
  const filteredKingdomOptions = React.useMemo(() => {
    const searchNum = kingdomSearchInput.replace(/\D/g, '');
    return [...uniqueKingdoms].sort((a, b) => (a || 0) - (b || 0)).filter(k => {
      if (!kingdomSearchInput) return true;
      return k?.toString().includes(searchNum);
    });
  }, [uniqueKingdoms, kingdomSearchInput]);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        kingdomDropdownRef.current && 
        !kingdomDropdownRef.current.contains(e.target as Node) &&
        kingdomInputRef.current &&
        !kingdomInputRef.current.contains(e.target as Node)
      ) {
        setShowKingdomDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
            fontFamily: FONT_DISPLAY
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
              placeholder="Search by Kingshot username or alliance..."
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
                padding: '0.875rem 2.5rem 0.875rem 1rem',
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
                backgroundSize: '1rem',
                minWidth: '130px'
              }}
            >
              <option value="all">All Players</option>
              <option value="alliance">By Alliance</option>
              <option value="region">By Region</option>
              <option value="kingdom">By Kingdom</option>
            </select>

            {filterBy === 'alliance' && (
              <select
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                style={{
                  padding: '0.875rem 2.5rem 0.875rem 1rem',
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
                  backgroundSize: '1rem',
                  minWidth: '160px'
                }}
              >
                <option value="">All Alliances</option>
                {uniqueAlliances.sort().map(tag => (
                  <option key={tag} value={tag}>[{tag}] · {alliancePlayerCounts[tag as string] || 0} players</option>
                ))}
              </select>
            )}
            
            {filterBy === 'region' && (
              <select
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                style={{
                  padding: '0.875rem 2.5rem 0.875rem 1rem',
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
                  backgroundSize: '1rem',
                  minWidth: '140px'
                }}
              >
                <option value="">All Regions</option>
                {uniqueRegions.map(region => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>
            )}
            
            {filterBy === 'kingdom' && (
              <div style={{ position: 'relative' }}>
                <input
                  ref={kingdomInputRef}
                  type="text"
                  value={kingdomSearchInput}
                  onChange={(e) => {
                    setKingdomSearchInput(e.target.value);
                    setShowKingdomDropdown(true);
                    // Clear filter if input is cleared
                    if (!e.target.value) {
                      setFilterValue('');
                    }
                  }}
                  onFocus={() => setShowKingdomDropdown(true)}
                  placeholder="Type kingdom #..."
                  style={{
                    padding: '0.875rem 2.5rem 0.875rem 1rem',
                    backgroundColor: '#111116',
                    border: '1px solid #2a2a2a',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '0.95rem',
                    outline: 'none',
                    minWidth: '160px',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 0.75rem center',
                    backgroundSize: '1rem',
                  }}
                />
                {showKingdomDropdown && (
                  <div
                    ref={kingdomDropdownRef}
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: '4px',
                      backgroundColor: '#111116',
                      border: '1px solid #2a2a2a',
                      borderRadius: '8px',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      zIndex: 50,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
                    }}
                  >
                    <div
                      onClick={() => {
                        setFilterValue('');
                        setKingdomSearchInput('');
                        setShowKingdomDropdown(false);
                      }}
                      style={{
                        padding: '0.75rem 1rem',
                        cursor: 'pointer',
                        color: !filterValue ? '#22d3ee' : '#9ca3af',
                        fontSize: '0.9rem',
                        borderBottom: '1px solid #2a2a2a',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      All Kingdoms
                    </div>
                    {filteredKingdomOptions.map(kingdom => {
                      const count = kingdomPlayerCounts[kingdom as number] || 0;
                      const isSelected = filterValue === kingdom?.toString();
                      return (
                        <div
                          key={kingdom}
                          onClick={() => {
                            setFilterValue(kingdom?.toString() || '');
                            setKingdomSearchInput(`Kingdom ${kingdom}`);
                            setShowKingdomDropdown(false);
                          }}
                          style={{
                            padding: '0.75rem 1rem',
                            cursor: 'pointer',
                            color: isSelected ? '#22d3ee' : '#fff',
                            fontSize: '0.9rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <span>Kingdom {kingdom}</span>
                          {count > 0 && (
                            <span style={{ 
                              color: '#6b7280', 
                              fontSize: '0.75rem',
                              fontStyle: 'italic'
                            }}>
                              {count} player{count !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {filteredKingdomOptions.length === 0 && (
                      <div style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.85rem' }}>
                        No kingdoms found
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tier Filter Chips */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {(['all', 'admin', 'supporter'] as const).map((tier) => {
            const isActive = tierFilter === tier;
            const chipColor = tier === 'admin' ? subscriptionColors.admin : tier === 'supporter' ? subscriptionColors.supporter : '#6b7280';
            const label = tier === 'all' ? 'All Players' : tier === 'admin' ? '👑 Admin' : '💖 Supporter';
            
            return (
              <button
                key={tier}
                onClick={() => setTierFilter(tier)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '20px',
                  border: `1px solid ${isActive ? chipColor : '#2a2a2a'}`,
                  backgroundColor: isActive ? `${chipColor}15` : 'transparent',
                  color: isActive ? chipColor : '#6b7280',
                  fontSize: '0.8rem',
                  fontWeight: isActive ? '600' : '400',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                {label}
              </button>
            );
          })}
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
            {filteredUsers.map(user => {
              const displayTier = getDisplayTier(user.subscription_tier, user.linked_username || user.username);
              const tierColor = getTierBorderColor(displayTier);
              return (
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
                  border: `2px solid ${tierColor}40`,
                  transition: 'transform 0.2s, border-color 0.2s, box-shadow 0.2s',
                  cursor: 'pointer',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = tierColor;
                  e.currentTarget.style.boxShadow = `0 4px 20px ${tierColor}30`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = `${tierColor}40`;
                  e.currentTarget.style.boxShadow = 'none';
                }}
                >
                  {/* Player Header - Avatar + Info */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
                    {user.linked_avatar_url ? (
                      <div style={{
                        width: '52px',
                        height: '52px',
                        borderRadius: '50%',
                        border: `2px solid ${tierColor}`,
                        overflow: 'hidden',
                        flexShrink: 0,
                        ...(displayTier !== 'free' ? { boxShadow: `0 0 8px ${tierColor}40` } : {})
                      }}>
                        <img 
                          src={user.linked_avatar_url} 
                          alt=""
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                        />
                      </div>
                    ) : (
                      <div style={{
                        width: '52px',
                        height: '52px',
                        borderRadius: '50%',
                        border: `2px solid ${tierColor}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.25rem',
                        color: '#fff',
                        fontWeight: 'bold',
                        backgroundColor: '#1a1a1a',
                        ...(displayTier !== 'free' ? { boxShadow: `0 0 8px ${tierColor}40` } : {})
                      }}>
                        {user.linked_username?.[0]?.toUpperCase() ?? '?'}
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      {/* Alliance tag + Username row */}
                      <div style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: '0.5rem',
                        flexWrap: 'wrap'
                      }}>
                        {user.alliance_tag && (
                          <span style={{
                            fontSize: '0.9rem',
                            fontWeight: 'bold',
                            color: '#9ca3af'
                          }}>
                            [{user.alliance_tag}]
                          </span>
                        )}
                        <span style={{ 
                          fontSize: '1.1rem', 
                          fontWeight: 'bold', 
                          color: getUsernameColor(displayTier),
                          ...(displayTier !== 'free' 
                            ? neonGlowUtil(getUsernameColor(displayTier)) 
                            : {})
                        }}>
                          {user.linked_username}
                        </span>
                        {displayTier === 'admin' && (
                          <span style={{
                            fontSize: '0.6rem',
                            padding: '0.15rem 0.4rem',
                            backgroundColor: `${subscriptionColors.admin}15`,
                            border: `1px solid ${subscriptionColors.admin}40`,
                            borderRadius: '4px',
                            color: subscriptionColors.admin,
                            fontWeight: '600',
                          }}>
                            👑 ADMIN
                          </span>
                        )}
                        {displayTier === 'supporter' && (
                          <span style={{
                            fontSize: '0.6rem',
                            padding: '0.15rem 0.4rem',
                            backgroundColor: `${subscriptionColors.supporter}15`,
                            border: `1px solid ${subscriptionColors.supporter}40`,
                            borderRadius: '4px',
                            color: subscriptionColors.supporter,
                            fontWeight: '600',
                          }}>
                            💖 SUPPORTER
                          </span>
                        )}
                        {user.id === currentUser?.id && (
                          <span style={{
                            fontSize: '0.6rem',
                            padding: '0.15rem 0.4rem',
                            backgroundColor: '#10b98115',
                            border: '1px solid #10b98140',
                            borderRadius: '4px',
                            color: '#10b981',
                            fontWeight: '600',
                          }}>
                            YOU
                          </span>
                        )}
                      </div>

                      {/* 2x2 Info Grid */}
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '1fr 1fr', 
                        gap: '0.25rem 1rem',
                        fontSize: '0.85rem'
                      }}>
                        <div>
                          <span style={{ color: '#6b7280' }}>Kingdom: </span>
                          <span style={{ color: '#fff', fontWeight: '600' }}>
                            {user.linked_kingdom || '—'}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: '#6b7280' }}>Language: </span>
                          <span style={{ color: '#fff', fontWeight: '600' }}>
                            {user.language || '—'}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: '#6b7280' }}>Town Center: </span>
                          <span style={{ color: '#fff', fontWeight: '600' }}>
                            {user.linked_tc_level ? formatTCLevel(user.linked_tc_level) : '—'}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: '#6b7280' }}>Region: </span>
                          <span style={{ color: '#fff', fontWeight: '600' }}>
                            {user.region || '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bio - fixed height container for consistent layout */}
                  <div style={{ 
                    minHeight: '2.5rem',
                    marginBottom: '0.5rem'
                  }}>
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
                  </div>

                  {/* View Profile Button - uses tier color, always at bottom */}
                  <div style={{ marginTop: 'auto', textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '0.5rem 1.5rem',
                      backgroundColor: 'transparent',
                      border: `2px solid ${tierColor}`,
                      borderRadius: '6px',
                      color: tierColor,
                      fontSize: '0.85rem',
                      fontWeight: '500',
                      transition: 'all 0.2s'
                    }}>
                      View Profile →
                    </span>
                  </div>
                </div>
              </Link>
              );
            })}
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
