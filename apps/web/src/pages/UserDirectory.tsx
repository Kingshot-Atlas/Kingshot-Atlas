import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth, UserProfile } from '../contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { colors, neonGlow as neonGlowUtil, subscriptionColors, FONT_DISPLAY } from '../utils/styles';
import { getDisplayTier, getHighestTierColor, SubscriptionTier, ReferralTier, REFERRAL_TIER_COLORS } from '../utils/constants';
import ReferralBadge from '../components/ReferralBadge';
import { logger } from '../utils/logger';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useMetaTags, PAGE_META_TAGS } from '../hooks/useMetaTags';
import { useStructuredData, PAGE_BREADCRUMBS } from '../hooks/useStructuredData';
import { useTranslation } from 'react-i18next';
import { getTransferGroupOptions, parseTransferGroupValue } from '../config/transferGroups';

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

const formatMemberSince = (dateStr: string): string => {
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
};

type SortBy = 'role' | 'joined' | 'kingdom' | 'tc';

const UserDirectory: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('playerDirectory.title', 'Player Directory'));
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
  const [tierFilter, setTierFilter] = useState<'all' | 'admin' | 'supporter' | 'ambassador' | 'consul' | 'recruiter' | 'scout'>('all');
  const [sortBy, setSortBy] = useState<SortBy>('role');
  const [transferGroupFilter, setTransferGroupFilter] = useState<string>('all');
  const PAGE_SIZE = 25;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);
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
            .select('id, username, email, avatar_url, home_kingdom, alliance_tag, language, region, bio, theme_color, badge_style, created_at, linked_username, linked_avatar_url, linked_kingdom, linked_tc_level, subscription_tier, referral_tier, referral_count')
            .neq('linked_username', '')
            .not('linked_username', 'is', null)
            .order('created_at', { ascending: false });

          logger.log('[PlayerDirectory] Query result:', { data, error, count: data?.length });

          if (error) {
            console.error('[PlayerDirectory] Supabase error:', error);
          }

          if (data && data.length > 0) {
            setUsers(data as UserProfile[]);
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

  // Compute tier counts for filter chip badges
  const tierCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: users.length, admin: 0, supporter: 0, ambassador: 0, consul: 0, recruiter: 0, scout: 0 };
    users.forEach(u => {
      const dt = getDisplayTier(u.subscription_tier, u.linked_username || u.username);
      if (dt === 'admin') counts.admin!++;
      if (dt === 'supporter') counts.supporter!++;
      const rt = u.referral_tier as string | null;
      if (rt === 'ambassador') counts.ambassador!++;
      else if (rt === 'consul') counts.consul!++;
      else if (rt === 'recruiter') counts.recruiter!++;
      else if (rt === 'scout') counts.scout!++;
    });
    return counts;
  }, [users]);

  // Current user's kingdom for "My Kingdom" filter
  const myKingdom = (currentUser as UserProfile | null)?.linked_kingdom;

  // Sort helper
  const getUserPriority = (u: UserProfile): number => {
    const dt = getDisplayTier(u.subscription_tier, u.linked_username || u.username);
    if (dt === 'admin') return 0;
    if (dt === 'supporter') return 1;
    const rt = u.referral_tier as string | null;
    if (rt === 'ambassador') return 2;
    if (rt === 'consul') return 3;
    if (rt === 'recruiter') return 4;
    if (rt === 'scout') return 5;
    return 6;
  };

  const filteredUsers = React.useMemo(() => {
    const filtered = users.filter(user => {
      // Search by linked Kingshot username or alliance tag
      const matchesSearch = !searchQuery || 
        (user.linked_username && user.linked_username.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (user.alliance_tag && user.alliance_tag.toLowerCase().includes(searchQuery.toLowerCase()));
      
      if (!matchesSearch) return false;

      // Tier filter - subscription tiers and referral tiers
      if (tierFilter !== 'all') {
        if (tierFilter === 'admin' || tierFilter === 'supporter') {
          const userDisplayTier = getDisplayTier(user.subscription_tier, user.linked_username || user.username);
          if (userDisplayTier !== tierFilter) return false;
        } else {
          if (user.referral_tier !== tierFilter) return false;
        }
      }
      
      // Transfer group filter
      if (transferGroupFilter !== 'all') {
        const tgRange = parseTransferGroupValue(transferGroupFilter);
        if (tgRange) {
          const [min, max] = tgRange;
          if (!user.linked_kingdom || user.linked_kingdom < min || user.linked_kingdom > max) return false;
        }
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

    // Sort based on sortBy
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'joined':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'kingdom':
          return (a.linked_kingdom || 9999) - (b.linked_kingdom || 9999);
        case 'tc':
          return (b.linked_tc_level || 0) - (a.linked_tc_level || 0);
        case 'role':
        default: {
          const aPri = getUserPriority(a);
          const bPri = getUserPriority(b);
          if (aPri !== bPri) return aPri - bPri;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
      }
    });
  }, [users, searchQuery, tierFilter, filterBy, filterValue, sortBy, transferGroupFilter]);

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
  
  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, filterBy, filterValue]);

  // Infinite scroll: observe sentinel to load more
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount(prev => prev + PAGE_SIZE);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  });

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
        <div style={{ color: '#6b7280' }}>{t('playerDirectory.loadingUsers', 'Loading users...')}</div>
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
            <span style={{ color: '#fff' }}>{t('playerDirectory.heroTitle1', 'PLAYER')}</span>
            <span style={{ ...neonGlow('#22d3ee'), marginLeft: '0.5rem', fontSize: isMobile ? '1.6rem' : '2.25rem' }}>{t('playerDirectory.heroTitle2', 'DIRECTORY')}</span>
          </h1>
          <p style={{ color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.9rem', marginBottom: '0.75rem' }}>
            {t('playerDirectory.heroSubtitle', 'Find allies, scout rivals, connect with the community')}
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
              placeholder={t('playerDirectory.searchPlaceholder', 'Search by Kingshot username or alliance...')}
              style={{
                width: '100%',
                padding: '0.875rem 1rem',
                backgroundColor: '#111116',
                border: '1px solid #2a2a2a',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '1rem',
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
                fontSize: '1rem',
                cursor: 'pointer',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.75rem center',
                backgroundSize: '1rem',
                minWidth: '130px'
              }}
            >
              <option value="all">{t('playerDirectory.allPlayers', 'All Players')}</option>
              <option value="alliance">{t('playerDirectory.byAlliance', 'By Alliance')}</option>
              <option value="region">{t('playerDirectory.byRegion', 'By Region')}</option>
              <option value="kingdom">{t('playerDirectory.byKingdom', 'By Kingdom')}</option>
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
                  fontSize: '1rem',
                  cursor: 'pointer',
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.75rem center',
                  backgroundSize: '1rem',
                  minWidth: '160px'
                }}
              >
                <option value="">{t('playerDirectory.allAlliances', 'All Alliances')}</option>
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
                  fontSize: '1rem',
                  cursor: 'pointer',
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.75rem center',
                  backgroundSize: '1rem',
                  minWidth: '140px'
                }}
              >
                <option value="">{t('playerDirectory.allRegions', 'All Regions')}</option>
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
                  placeholder={t('playerDirectory.typeKingdom', 'Type kingdom #...')}
                  style={{
                    padding: '0.875rem 2.5rem 0.875rem 1rem',
                    backgroundColor: '#111116',
                    border: '1px solid #2a2a2a',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '1rem',
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
                      {t('playerDirectory.allKingdoms', 'All Kingdoms')}
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
                          <span>{t('common.kingdom', 'Kingdom')} {kingdom}</span>
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
                        {t('playerDirectory.noKingdomsFound', 'No kingdoms found')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Transfer Group + Tier Filter Chips + My Kingdom button */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Transfer Group filter */}
          <select
            value={transferGroupFilter}
            onChange={(e) => { setTransferGroupFilter(e.target.value); setVisibleCount(PAGE_SIZE); }}
            style={{
              padding: '0.4rem 1.6rem 0.4rem 0.6rem',
              backgroundColor: transferGroupFilter !== 'all' ? '#22d3ee15' : 'transparent',
              border: `1px solid ${transferGroupFilter !== 'all' ? '#22d3ee' : '#2a2a2a'}`,
              borderRadius: '20px',
              color: transferGroupFilter !== 'all' ? '#22d3ee' : '#6b7280',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: transferGroupFilter !== 'all' ? '600' : '400',
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 0.4rem center',
              backgroundSize: '0.6rem',
            }}
          >
            <option value="all">{t('playerDirectory.transferGroup', 'Transfer Group')}</option>
            {getTransferGroupOptions().map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <span style={{ color: '#2a2a2a' }}>|</span>
          {([
            { key: 'all' as const, label: 'All Players', color: '#6b7280' },
            { key: 'admin' as const, label: '👑 Admin', color: subscriptionColors.admin },
            { key: 'supporter' as const, label: '💖 Supporter', color: subscriptionColors.supporter },
            { key: 'ambassador' as const, label: '🟣 Ambassador', color: '#a24cf3' },
            { key: 'consul' as const, label: '🟣 Consul', color: '#b890dd' },
            { key: 'recruiter' as const, label: '🟢 Recruiter', color: '#4ade80' },
            { key: 'scout' as const, label: '⚪ Scout', color: '#ffffff' },
          ]).map(({ key, label, color }) => {
            const isActive = tierFilter === key;
            const count = tierCounts[key] ?? 0;
            return (
              <button
                key={key}
                onClick={() => { setTierFilter(key); setVisibleCount(PAGE_SIZE); }}
                style={{
                  padding: '0.4rem 0.75rem',
                  borderRadius: '20px',
                  border: `1px solid ${isActive ? color : '#2a2a2a'}`,
                  backgroundColor: isActive ? `${color}15` : 'transparent',
                  color: isActive ? color : '#6b7280',
                  fontSize: '0.75rem',
                  fontWeight: isActive ? '600' : '400',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                {label}
                {key !== 'all' && count > 0 && (
                  <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>({count})</span>
                )}
              </button>
            );
          })}
          {/* My Kingdom quick filter */}
          {myKingdom && (
            <button
              onClick={() => {
                setFilterBy('kingdom');
                setFilterValue(myKingdom.toString());
                setKingdomSearchInput(`Kingdom ${myKingdom}`);
                setVisibleCount(PAGE_SIZE);
              }}
              style={{
                padding: '0.4rem 0.75rem',
                borderRadius: '20px',
                border: `1px solid ${filterBy === 'kingdom' && filterValue === myKingdom.toString() ? '#22d3ee' : '#2a2a2a'}`,
                backgroundColor: filterBy === 'kingdom' && filterValue === myKingdom.toString() ? '#22d3ee15' : 'transparent',
                color: filterBy === 'kingdom' && filterValue === myKingdom.toString() ? '#22d3ee' : '#6b7280',
                fontSize: '0.75rem',
                fontWeight: filterBy === 'kingdom' && filterValue === myKingdom.toString() ? '600' : '400',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              🏠 {t('playerDirectory.myKingdom', 'My Kingdom')} ({myKingdom})
            </button>
          )}
        </div>

        {/* Sort-by + Results Count row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>
            {t('playerDirectory.showing', 'Showing')} <span style={{ ...neonGlow('#22d3ee'), fontWeight: '600' }}>{Math.min(visibleCount, filteredUsers.length)}</span> {t('playerDirectory.of', 'of')} <span style={{ ...neonGlow('#22d3ee'), fontWeight: '600' }}>{filteredUsers.length}</span> {filteredUsers.length !== 1 ? t('playerDirectory.players', 'players') : t('playerDirectory.player', 'player')}
          </span>
          <select
            value={sortBy}
            onChange={e => { setSortBy(e.target.value as SortBy); setVisibleCount(PAGE_SIZE); }}
            style={{
              padding: '0.5rem 1.5rem 0.5rem 0.75rem',
              backgroundColor: '#111116',
              border: '1px solid #2a2a2a',
              borderRadius: '8px',
              color: '#9ca3af',
              fontSize: '1rem',
              cursor: 'pointer',
              outline: 'none',
              minHeight: '44px',
            }}
          >
            <option value="role">{t('playerDirectory.sortRole', 'Sort: Role Priority')}</option>
            <option value="joined">{t('playerDirectory.sortNewest', 'Sort: Newest First')}</option>
            <option value="kingdom">{t('playerDirectory.sortKingdom', 'Sort: Kingdom #')}</option>
            <option value="tc">{t('playerDirectory.sortTC', 'Sort: TC Level')}</option>
          </select>
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
              {t('playerDirectory.noPlayersFound', 'No players found')}
            </h3>
            <p style={{ color: '#6b7280', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
              {t('playerDirectory.noPlayersDesc', 'Try adjusting your search or filters to find players.')}
            </p>
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(350px, 1fr))', 
            gap: isMobile ? '1rem' : '1.5rem' 
          }}>
            {filteredUsers.slice(0, visibleCount).map(user => {
              const displayTier = getDisplayTier(user.subscription_tier, user.linked_username || user.username);
              // Use unified priority: Admin > Supporter > Ambassador > Consul > Recruiter > Scout > Free
              const refTier = user.referral_tier as ReferralTier | null;
              const { color: tierColor, hasGlow } = getHighestTierColor(displayTier, refTier);
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
                  padding: isMobile ? '1rem' : '1.5rem',
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
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: isMobile ? '0.5rem' : '1rem', marginBottom: '0.75rem' }}>
                    {user.linked_avatar_url ? (
                      <div style={{
                        width: isMobile ? '44px' : '52px',
                        height: isMobile ? '44px' : '52px',
                        borderRadius: '50%',
                        border: `2px solid ${tierColor}`,
                        overflow: 'hidden',
                        flexShrink: 0,
                        ...(hasGlow ? { boxShadow: `0 0 8px ${tierColor}40` } : {})
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
                        width: isMobile ? '44px' : '52px',
                        height: isMobile ? '44px' : '52px',
                        borderRadius: '50%',
                        border: `2px solid ${tierColor}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.25rem',
                        color: '#fff',
                        fontWeight: 'bold',
                        backgroundColor: '#1a1a1a',
                        ...(hasGlow ? { boxShadow: `0 0 8px ${tierColor}40` } : {})
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
                        {refTier && (
                          <ReferralBadge tier={refTier} />
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
                        gap: isMobile ? '0.15rem 0.75rem' : '0.25rem 1rem',
                        fontSize: isMobile ? '0.8rem' : '0.85rem'
                      }}>
                        <div>
                          <span style={{ color: '#6b7280' }}>{t('common.kingdom', 'Kingdom')}: </span>
                          <span style={{ color: '#fff', fontWeight: '600' }}>
                            {user.linked_kingdom || '—'}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: '#6b7280' }}>{t('kingdomProfile.language', 'Language')}: </span>
                          <span style={{ color: '#fff', fontWeight: '600' }}>
                            {user.language || '—'}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: '#6b7280' }}>{t('kingdomProfile.townCenter', 'Town Center')}: </span>
                          <span style={{ color: '#fff', fontWeight: '600' }}>
                            {user.linked_tc_level ? formatTCLevel(user.linked_tc_level) : '—'}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: '#6b7280' }}>{t('kingdomProfile.region', 'Region')}: </span>
                          <span style={{ color: '#fff', fontWeight: '600' }}>
                            {user.region || '—'}
                          </span>
                        </div>
                        {(user.referral_count ?? 0) > 0 && (
                          <div>
                            <span style={{ color: '#6b7280' }}>{t('kingdomProfile.referrals', 'Referrals')}: </span>
                            <span style={{ color: REFERRAL_TIER_COLORS[(user.referral_tier as ReferralTier)] || '#fff', fontWeight: '600' }}>
                              {user.referral_count}
                            </span>
                          </div>
                        )}
                        {user.created_at && (
                          <div>
                            <span style={{ color: '#6b7280' }}>{t('playerDirectory.memberSince', 'Member since')}: </span>
                            <span style={{ color: '#9ca3af', fontWeight: '600' }}>
                              {formatMemberSince(user.created_at)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bio - fixed height container for consistent layout */}
                  <div style={{ 
                    minHeight: isMobile ? '2rem' : '2.5rem',
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
                      {t('kingdomProfile.viewProfile', 'View Profile')} →
                    </span>
                  </div>
                </div>
              </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Infinite scroll sentinel */}
      {visibleCount < filteredUsers.length && (
        <div ref={sentinelRef} style={{ height: '1px' }} />
      )}

      {/* Back to Home */}
      <div style={{ textAlign: 'center', marginTop: '3rem', paddingBottom: '2rem' }}>
        <Link to="/" style={{ color: '#22d3ee', textDecoration: 'none', fontSize: '0.85rem' }}>
          {t('common.backToHome', '← Back to Home')}
        </Link>
      </div>
    </div>
  );
};

export default UserDirectory;
