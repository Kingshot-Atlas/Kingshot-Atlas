import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Kingdom, FilterOptions, SortOptions, getPowerTier } from '../types';
import { addRanksToKingdoms } from '../utils/rankCalculation';
import { apiService, dataLoadError } from '../services/api';
import { DataLoadError } from '../components/DataLoadError';
import KingdomCard from '../components/KingdomCard';
import ParticleEffect from '../components/ParticleEffect';
import LazyCard from '../components/LazyCard';
import { useToast } from '../components/Toast';
import { logger } from '../utils/logger';
import SkeletonCard from '../components/SkeletonCard';
import KingdomTable from '../components/KingdomTable';
import SearchAutocomplete from '../components/SearchAutocomplete';
import EventCalendar from '../components/EventCalendar';
import PostKvKSubmission from '../components/PostKvKSubmission';
import HotRightNow from '../components/HotRightNow';
import { useIsMobile } from '../hooks/useMediaQuery';
import { usePreferences } from '../hooks/useUrlState';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useMetaTags, PAGE_META_TAGS } from '../hooks/useMetaTags';
import { useAuth } from '../contexts/AuthContext';
import { useFavoritesContext } from '../contexts/FavoritesContext';
import { neonGlow, colors } from '../utils/styles';
import { countActiveFilters, DEFAULT_FILTERS } from '../utils/kingdomStats';
import { DataSyncIndicator } from '../components/DataSyncIndicator';
import QuickActions from '../components/homepage/QuickActions';
import TransferHubBanner from '../components/homepage/TransferHubBanner';
import BattlePlannerBanner from '../components/homepage/BattlePlannerBanner';
import MobileCountdowns from '../components/homepage/MobileCountdowns';
import { useScrollDepth } from '../hooks/useScrollDepth';
import { useTranslation } from 'react-i18next';
import { getTransferGroupOptions, parseTransferGroupValue } from '../config/transferGroups';

const KingdomDirectory: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle('Kingdom Directory');
  useMetaTags(PAGE_META_TAGS.home);
  useScrollDepth('Kingdom Directory');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const { user, profile } = useAuth();
  const { loadPreferences, savePreferences } = usePreferences();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [allKingdoms, setAllKingdoms] = useState<Kingdom[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || '');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    const prefs = loadPreferences();
    return prefs.viewMode;
  });
  const [showFilters, setShowFilters] = useState(false);
  const [displayCount, setDisplayCount] = useState(15);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedCardIndex, setSelectedCardIndex] = useState(-1);
  const [filters, setFilters] = useState<FilterOptions>({
    status: 'all',
    minKvKs: 0,
    maxKvKs: 99,
    minPrepWinRate: 0,
    minBattleWinRate: 0,
    tier: 'all',
    minAtlasScore: 0
  });
  const [sort, _setSort] = useState<SortOptions>(() => {
    const prefs = loadPreferences();
    return {
      sortBy: (prefs.sortBy as SortOptions['sortBy']) || 'overall_score',
      order: (prefs.sortOrder as 'asc' | 'desc') || 'desc'
    };
  });
  const setSort = (newSort: SortOptions) => {
    _setSort(newSort);
    savePreferences({ sortBy: newSort.sortBy, sortOrder: newSort.order });
  };
  
  
  const { favorites, toggleFavorite: contextToggleFavorite } = useFavoritesContext();
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(() => searchParams.get('favorites') === 'true');

  // Sync showFavoritesOnly with URL query param (header heart badge toggle)
  useEffect(() => {
    const favParam = searchParams.get('favorites') === 'true';
    setShowFavoritesOnly(favParam);
  }, [searchParams]);
  
  const [showBackToTop, setShowBackToTop] = useState(false);
  const isMobile = useIsMobile();
  const [recentlyViewed, setRecentlyViewed] = useState<number[]>(() => {
    const saved = localStorage.getItem('kingshot_recently_viewed');
    return saved ? JSON.parse(saved) : [];
  });
  
  
  const [showPostKvKModal, setShowPostKvKModal] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false); // Closed by default
  const [transferGroupFilter, _setTransferGroupFilter] = useState<string>(() => {
    return localStorage.getItem('kingshot_transferGroup') || 'all';
  });
  const setTransferGroupFilter = (val: string) => {
    _setTransferGroupFilter(val);
    localStorage.setItem('kingshot_transferGroup', val);
  };

  // Handler for KvK submission - requires login + linked Kingshot account + TC20+
  const handleSubmitKvKClick = () => {
    if (!user) {
      showToast('Please log in to submit KvK results', 'error');
      navigate('/login?redirect=/');
      return;
    }
    if (!profile?.linked_username) {
      showToast('Please link your Kingshot account to submit results', 'error');
      navigate('/profile');
      return;
    }
    if (!profile?.linked_tc_level || profile.linked_tc_level < 20) {
      showToast(`TC20+ required to submit KvK results (you're TC${profile?.linked_tc_level || '?'})`, 'error');
      return;
    }
    setShowPostKvKModal(true);
  };

  // Scroll listener for back-to-top button
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setShowFilters(false);
        setSelectedCardIndex(-1);
        searchInputRef.current?.blur();
      }
      
      // Arrow key navigation only (J/K removed)
      if (viewMode === 'grid' && document.activeElement?.tagName !== 'INPUT') {
        const cols = Math.floor((gridRef.current?.offsetWidth || 900) / 300);
        const total = displayedKingdoms.length;
        
        if (e.key === 'ArrowRight' && selectedCardIndex < total - 1) {
          e.preventDefault();
          setSelectedCardIndex(prev => Math.min(prev + 1, total - 1));
        }
        if (e.key === 'ArrowLeft' && selectedCardIndex > 0) {
          e.preventDefault();
          setSelectedCardIndex(prev => Math.max(prev - 1, 0));
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedCardIndex(prev => {
            if (prev === -1) return 0;
            return Math.min(prev + cols, total - 1);
          });
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedCardIndex(prev => Math.max(prev - cols, 0));
        }
        if (e.key === 'Enter' && selectedCardIndex >= 0) {
          const selectedKingdom = displayedKingdoms[selectedCardIndex];
          if (selectedKingdom) {
            e.preventDefault();
            navigate(`/kingdom/${selectedKingdom.kingdom_number}`);
          }
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCardIndex, viewMode, navigate]);


  // Debounced search - 300ms delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Save view mode preference
  useEffect(() => {
    savePreferences({ viewMode });
  }, [viewMode, savePreferences]);

  // Sync search query to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (debouncedSearch) {
      params.set('q', debouncedSearch);
    } else {
      params.delete('q');
    }
    setSearchParams(params, { replace: true });
  }, [debouncedSearch, searchParams, setSearchParams]);

  useEffect(() => {
    const loadKingdoms = async () => {
      setLoading(true);
      try {
        const data = await apiService.getKingdoms(undefined, sort);
        setAllKingdoms(data);
      } catch (error) {
        logger.error('Failed to load kingdoms:', error);
        showToast('Failed to load kingdoms', 'error');
      } finally {
        setLoading(false);
      }
    };
    loadKingdoms();
  }, [sort, showToast]);

  const toggleFavorite = useCallback((kingdomNumber: number) => {
    // Gate favorites to logged-in users only
    if (!user) {
      showToast('Sign in to save favorites', 'info');
      navigate('/profile');
      return;
    }
    const isFav = favorites.includes(kingdomNumber);
    contextToggleFavorite(kingdomNumber);
    if (isFav) {
      showToast(`K${kingdomNumber} removed from favorites`, 'info');
    } else {
      showToast(`K${kingdomNumber} added to favorites`, 'success');
    }
  }, [showToast, user, navigate, favorites, contextToggleFavorite]);

  const hasAnyFilter = countActiveFilters(filters) > 0 || transferGroupFilter !== 'all' || sort.sortBy !== 'overall_score' || sort.order !== 'desc' || debouncedSearch.trim() !== '' || showFavoritesOnly;
  const clearAllFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setSort({ sortBy: 'overall_score', order: 'desc' });
    setTransferGroupFilter('all');
    setSearchQuery('');
    setShowFavoritesOnly(false);
    localStorage.removeItem('kingshot_rankings_kvkFilter');
    localStorage.removeItem('kingshot_rankings_displayCount');
    showToast(t('home.filtersCleared', 'All filters cleared'), 'info');
  };

  const filteredKingdoms = useMemo(() => {
    let result = [...allKingdoms];
    
    if (showFavoritesOnly) {
      result = result.filter(k => favorites.includes(k.kingdom_number));
    }
    
    if (debouncedSearch.trim()) {
      const query = debouncedSearch.trim();
      result = result.filter(k => k.kingdom_number.toString().includes(query));
    }
    
    if (filters.minKvKs && filters.minKvKs > 0) {
      result = result.filter(k => k.total_kvks >= filters.minKvKs!);
    }
    if (filters.maxKvKs && filters.maxKvKs < 99) {
      result = result.filter(k => k.total_kvks <= filters.maxKvKs!);
    }
    if (filters.minPrepWinRate && filters.minPrepWinRate > 0) {
      result = result.filter(k => k.prep_win_rate >= filters.minPrepWinRate!);
    }
    if (filters.minBattleWinRate && filters.minBattleWinRate > 0) {
      result = result.filter(k => k.battle_win_rate >= filters.minBattleWinRate!);
    }
    if (filters.tier && filters.tier !== 'all') {
      result = result.filter(k => (k.power_tier || getPowerTier(k.overall_score)) === filters.tier);
    }
    if (filters.status && filters.status !== 'all') {
      result = result.filter(k => k.most_recent_status === filters.status);
    }

    // Transfer group filter
    const tgRange = parseTransferGroupValue(transferGroupFilter);
    if (tgRange) {
      const [min, max] = tgRange;
      result = result.filter(k => k.kingdom_number >= min && k.kingdom_number <= max);
    }
    
    return result;
  }, [allKingdoms, debouncedSearch, filters, showFavoritesOnly, favorites, transferGroupFilter]);

  // Helper to get calculated outcome stats for sorting
  const getOutcomeValue = (k: Kingdom, field: string): number => {
    const dominations = k.dominations ?? 0;
    if (field === 'dominations') return dominations;
    if (field === 'invasions') return k.invasions ?? 0;
    if (field === 'comebacks') return Math.max(0, k.battle_wins - dominations);
    if (field === 'reversals') return Math.max(0, k.prep_wins - dominations);
    return 0;
  };

  // Add rank based on overall_score order (all kingdoms, not just filtered)
  // Also apply frontend sorting for calculated fields
  const rankedKingdoms = useMemo(() => {
    const ranked = addRanksToKingdoms(filteredKingdoms, allKingdoms);
    
    // For calculated fields (comebacks, reversals), sort in frontend
    if (['comebacks', 'reversals', 'dominations', 'invasions'].includes(sort.sortBy)) {
      return [...ranked].sort((a, b) => {
        const aVal = getOutcomeValue(a, sort.sortBy);
        const bVal = getOutcomeValue(b, sort.sortBy);
        return sort.order === 'desc' ? bVal - aVal : aVal - bVal;
      });
    }
    
    return ranked;
  }, [allKingdoms, filteredKingdoms, sort.sortBy, sort.order]);

  const displayedKingdoms = rankedKingdoms.slice(0, displayCount);

  // Load more function with loading feedback
  const handleLoadMore = useCallback(() => {
    if (loadingMore) return;
    setLoadingMore(true);
    // Brief delay for visual feedback
    setTimeout(() => {
      setDisplayCount(prev => Math.min(prev + 15, filteredKingdoms.length));
      setLoadingMore(false);
    }, 300);
  }, [loadingMore, filteredKingdoms.length]);

  // Infinite scroll using IntersectionObserver
  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && displayCount < filteredKingdoms.length && !loading && !loadingMore) {
          handleLoadMore();
        }
      },
      { rootMargin: '200px', threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [displayCount, filteredKingdoms.length, loading, loadingMore, handleLoadMore]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.bg, paddingBottom: '100px' }}>
      <style>{`
        @keyframes chipPop {
          0% { transform: scale(0.92); opacity: 0.7; }
          60% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
        .filter-chip-active { animation: chipPop 0.2s ease-out; }
        @keyframes clearSlide {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .clear-all-btn { animation: clearSlide 0.2s ease-out; }
      `}</style>
      {/* Hero Section with Particles - Compact */}
      <div style={{ 
        padding: isMobile ? '1.25rem 1rem 1rem' : '1.75rem 2rem 1.25rem',
        textAlign: 'center',
        background: 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {!isMobile && <ParticleEffect />}
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '800px', margin: '0 auto' }}>
          <h1 style={{ 
            fontSize: isMobile ? '1.5rem' : '2rem', 
            fontWeight: 'bold', 
            marginBottom: '0.5rem',
            fontFamily: "'Cinzel', 'Times New Roman', serif"
          }}>
            <span style={{ color: '#fff' }}>KINGSHOT</span>
            <span style={{ ...neonGlow('#22d3ee'), marginLeft: '0.5rem', fontSize: isMobile ? '1.6rem' : '2.25rem' }}>ATLAS</span>
          </h1>
          <p style={{ color: colors.textSecondary, fontSize: isMobile ? '0.75rem' : '0.85rem', marginBottom: '0.75rem', lineHeight: 1.6, fontStyle: 'italic' }}>
            {t('home.subtitle').split('\n').map((line, i) => <React.Fragment key={i}>{i > 0 && <br />}{line}</React.Fragment>)}
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


      {/* Mobile Countdowns - KvK + Transfer thin pills (mobile only) */}
      {isMobile && <MobileCountdowns />}

      {/* Quick Actions - 4 tiles (2x2 mobile, 4-col desktop) */}
      <QuickActions />

      {/* Transfer Hub Banner - dismissable CTA */}
      <TransferHubBanner />

      {/* Battle Planner Banner - dismissable launch CTA */}
      <BattlePlannerBanner />

      {/* Search and Controls - Sticky */}
      <div style={{ 
        position: 'sticky', 
        top: isMobile ? '56px' : '60px', 
        zIndex: 50, 
        backgroundColor: colors.bg, 
        paddingTop: isMobile ? '0.5rem' : '1rem',
        paddingBottom: '0.5rem'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '0 0.75rem' : '0 2rem' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: isMobile ? 'stretch' : 'center', 
          gap: isMobile ? '0.5rem' : '0.75rem',
          padding: isMobile ? '0.75rem' : '1rem',
          backgroundColor: 'rgba(17, 17, 17, 0.95)',
          backdropFilter: 'blur(12px)',
          borderRadius: '12px',
          marginBottom: '0.5rem',
          flexWrap: 'wrap',
          flexDirection: isMobile ? 'column' : 'row',
          border: '1px solid #2a2a2a'
        }}>
          {/* Search Bar with Autocomplete */}
          <SearchAutocomplete
            kingdoms={allKingdoms}
            value={searchQuery}
            onChange={(value) => { setSearchQuery(value); setDisplayCount(15); }}
          />

          {/* Mobile Controls Row */}
          {isMobile ? (
            <>
            <div style={{ display: 'flex', gap: '0.5rem', width: '100%', justifyContent: 'space-between' }}>
              <button
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.25rem',
                  padding: '0.6rem',
                  minHeight: '44px',
                  backgroundColor: showFavoritesOnly ? '#22d3ee20' : '#0a0a0a',
                  border: `1px solid ${showFavoritesOnly ? '#22d3ee' : '#2a2a2a'}`,
                  borderRadius: '8px',
                  color: showFavoritesOnly ? '#22d3ee' : '#9ca3af',
                  cursor: 'pointer',
                  fontSize: '0.8rem'
                }}
              >
                <span>{showFavoritesOnly ? '★' : '☆'}</span>
                {favorites.length > 0 && `(${favorites.length})`}
              </button>
              <button onClick={() => setShowFilters(!showFilters)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', padding: '0.6rem', minHeight: '44px', backgroundColor: showFilters ? '#2a2a2a' : '#0a0a0a', border: `1px solid ${countActiveFilters(filters) > 0 ? '#22d3ee50' : '#2a2a2a'}`, borderRadius: '8px', color: showFilters ? '#fff' : '#9ca3af', cursor: 'pointer', fontSize: '0.8rem', position: 'relative' }}>
                <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                {t('common.filter')}{countActiveFilters(filters) > 0 && ` (${countActiveFilters(filters)})`}
              </button>
              <select value={sort.sortBy} onChange={(e) => setSort({ ...sort, sortBy: e.target.value as SortOptions['sortBy'] })} style={{ flex: 1.5, padding: '0.6rem 1.5rem 0.6rem 0.5rem', minHeight: '44px', backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#fff', fontSize: '1rem', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.3rem center', backgroundSize: '0.8rem' }}>
                <option value="overall_score">{t('stats.atlasScore')}</option>
                <option value="kingdom_number">{t('home.sortKingdomNumber')}</option>
                <option value="prep_win_rate">{t('stats.prepWR')}</option>
                <option value="battle_win_rate">{t('stats.battleWR')}</option>
                <option value="total_kvks">{t('stats.totalKvKs')}</option>
                <option value="dominations">{t('stats.dominations')}</option>
                <option value="comebacks">{t('stats.comebacks')}</option>
                <option value="reversals">{t('stats.reversals')}</option>
                <option value="invasions">{t('stats.invasions')}</option>
              </select>
            </div>
            {hasAnyFilter && (
              <button className="clear-all-btn" onClick={clearAllFilters} style={{ width: '100%', padding: '0.5rem', minHeight: '36px', backgroundColor: '#ef444415', border: '1px solid #ef444450', borderRadius: '8px', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                <svg style={{ width: '12px', height: '12px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                {t('home.clearAll', 'Clear All')}
              </button>
            )}
            </>
          ) : (
          <>
          {/* Favorites Toggle */}
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              backgroundColor: showFavoritesOnly ? '#22d3ee20' : '#0a0a0a',
              border: `1px solid ${showFavoritesOnly ? '#22d3ee' : '#2a2a2a'}`,
              borderRadius: '8px',
              color: showFavoritesOnly ? '#22d3ee' : '#9ca3af',
              cursor: 'pointer',
              fontSize: '0.9rem',
              transition: 'all 0.2s ease'
            }}
          >
            <span style={{ fontSize: '1.1rem' }}>{showFavoritesOnly ? '★' : '☆'}</span>
            {t('home.favorites')} {favorites.length > 0 && `(${favorites.length})`}
          </button>

          {/* View Toggle */}
          <div style={{ display: 'flex', backgroundColor: colors.bg, borderRadius: '8px', padding: '4px' }}>
            <button onClick={() => setViewMode('grid')} style={{ padding: '0.6rem', backgroundColor: viewMode === 'grid' ? '#2a2a2a' : 'transparent', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 0.2s' }}>
              <svg style={{ width: '18px', height: '18px', color: viewMode === 'grid' ? '#fff' : '#6b7280' }} fill="currentColor" viewBox="0 0 24 24">
                <path d="M4 4h4v4H4V4zm6 0h4v4h-4V4zm6 0h4v4h-4V4zM4 10h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4zM4 16h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4z" />
              </svg>
            </button>
            <button onClick={() => setViewMode('table')} style={{ padding: '0.6rem', backgroundColor: viewMode === 'table' ? '#2a2a2a' : 'transparent', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 0.2s' }}>
              <svg style={{ width: '18px', height: '18px', color: viewMode === 'table' ? '#fff' : '#6b7280' }} fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 4h18v2H3V4zm0 7h18v2H3v-2zm0 7h18v2H3v-2z" />
              </svg>
            </button>
          </div>

          {/* Filters Button */}
          <button onClick={() => setShowFilters(!showFilters)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', backgroundColor: showFilters ? '#2a2a2a' : '#0a0a0a', border: `1px solid ${countActiveFilters(filters) > 0 ? '#22d3ee50' : '#2a2a2a'}`, borderRadius: '8px', color: countActiveFilters(filters) > 0 ? '#22d3ee' : (showFilters ? '#fff' : '#9ca3af'), cursor: 'pointer', fontSize: '0.9rem', transition: 'all 0.2s' }}>
            <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            {t('common.filter')}{countActiveFilters(filters) > 0 && <span style={{ backgroundColor: '#22d3ee', color: '#000', borderRadius: '10px', padding: '0.1rem 0.4rem', fontSize: '0.7rem', fontWeight: 'bold', marginLeft: '0.25rem' }}>{countActiveFilters(filters)}</span>}
          </button>

          {/* Sort Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: colors.textMuted, fontSize: '0.9rem', whiteSpace: 'nowrap' }}>{t('home.sortLabel')}</span>
            <select value={sort.sortBy} onChange={(e) => setSort({ ...sort, sortBy: e.target.value as SortOptions['sortBy'] })} style={{ padding: '0.75rem 2rem 0.75rem 1rem', backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#fff', fontSize: '0.9rem', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '1rem' }}>
              <option value="overall_score">{t('stats.atlasScore')}</option>
              <option value="kingdom_number">{t('home.sortKingdomNumber')}</option>
              <option value="prep_win_rate">{t('stats.prepWinRate')}</option>
              <option value="battle_win_rate">{t('stats.battleWinRate')}</option>
              <option value="total_kvks">{t('stats.totalKvKs')}</option>
              <option value="dominations">👑 {t('stats.dominations')}</option>
              <option value="comebacks">💪 {t('stats.comebacks')}</option>
              <option value="reversals">🔄 {t('stats.reversals')}</option>
              <option value="invasions">💀 {t('stats.invasions')}</option>
            </select>
            <button onClick={() => setSort({ ...sort, order: sort.order === 'desc' ? 'asc' : 'desc' })} style={{ padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.2s', gap: '0.25rem' }}>
              <svg style={{ width: '16px', height: '16px', color: '#6b7280', transform: sort.order === 'asc' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>{sort.order === 'desc' ? '↓' : '↑'}</span>
            </button>
          </div>
          </>
          )}
        </div>

        {/* Results Count + Quick Filter Chips - Below Search */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ color: colors.textMuted, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
              {t('kingdomDirectory.showing', 'Showing')} <span style={{ ...neonGlow('#22d3ee'), fontWeight: '600' }}>{displayedKingdoms.length}</span> {t('kingdomDirectory.of', 'of')} {filteredKingdoms.length} {t('kingdomDirectory.kingdoms', 'kingdoms')}
              {showFavoritesOnly && <span style={{ color: '#22d3ee' }}> (Favorites)</span>}
            </span>
            <DataSyncIndicator compact />
          </div>
          {/* Transfer Group filter - Mobile (in results count row) */}
          {isMobile && (
            <select
              value={transferGroupFilter}
              onChange={(e) => setTransferGroupFilter(e.target.value)}
              style={{
                padding: '0.4rem 1.4rem 0.4rem 0.5rem',
                backgroundColor: transferGroupFilter !== 'all' ? '#22d3ee10' : '#0a0a0a',
                border: `1px solid ${transferGroupFilter !== 'all' ? '#22d3ee40' : '#2a2a2a'}`,
                borderRadius: '6px',
                color: transferGroupFilter !== 'all' ? '#22d3ee' : '#9ca3af',
                fontSize: '0.75rem',
                cursor: 'pointer',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.3rem center',
                backgroundSize: '0.7rem',
              }}
            >
              <option value="all">{t('home.allTransferGroups', 'Transfer Group')}</option>
              {getTransferGroupOptions().map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          )}
          
          {/* Quick Filter Chips - Desktop only */}
          {!isMobile && (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* S-Tier */}
            <button
              className={filters.tier === 'S' ? 'filter-chip-active' : ''}
              onClick={() => setFilters(f => ({ ...f, tier: f.tier === 'S' ? 'all' : 'S' }))}
              style={{
                padding: '0.3rem 0.6rem',
                backgroundColor: filters.tier === 'S' ? '#fbbf2420' : 'transparent',
                border: `1px solid ${filters.tier === 'S' ? '#fbbf24' : '#3a3a3a'}`,
                borderRadius: '16px',
                color: filters.tier === 'S' ? '#fbbf24' : '#6b7280',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
            >
              S-Tier
            </button>
            {/* A-Tier */}
            <button
              className={filters.tier === 'A' ? 'filter-chip-active' : ''}
              onClick={() => setFilters(f => ({ ...f, tier: f.tier === 'A' ? 'all' : 'A' }))}
              style={{
                padding: '0.3rem 0.6rem',
                backgroundColor: filters.tier === 'A' ? '#22c55e20' : 'transparent',
                border: `1px solid ${filters.tier === 'A' ? '#22c55e' : '#3a3a3a'}`,
                borderRadius: '16px',
                color: filters.tier === 'A' ? '#22c55e' : '#6b7280',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
            >
              A-Tier
            </button>
            
            <span style={{ color: '#2a2a2a', margin: '0 0.25rem' }}>|</span>
            
            {/* 100% Prep */}
            <button
              className={filters.minPrepWinRate === 1 ? 'filter-chip-active' : ''}
              onClick={() => setFilters(f => ({ ...f, minPrepWinRate: f.minPrepWinRate === 1 ? 0 : 1 }))}
              style={{
                padding: '0.3rem 0.6rem',
                backgroundColor: filters.minPrepWinRate === 1 ? '#eab30820' : 'transparent',
                border: `1px solid ${filters.minPrepWinRate === 1 ? '#eab308' : '#3a3a3a'}`,
                borderRadius: '16px',
                color: filters.minPrepWinRate === 1 ? '#eab308' : '#6b7280',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
            >
              100% Prep
            </button>
            {/* 80%+ Prep */}
            <button
              className={filters.minPrepWinRate === 0.8 ? 'filter-chip-active' : ''}
              onClick={() => setFilters(f => ({ ...f, minPrepWinRate: f.minPrepWinRate === 0.8 ? 0 : 0.8 }))}
              style={{
                padding: '0.3rem 0.6rem',
                backgroundColor: filters.minPrepWinRate === 0.8 ? '#eab30815' : 'transparent',
                border: `1px solid ${filters.minPrepWinRate === 0.8 ? '#eab30880' : '#3a3a3a'}`,
                borderRadius: '16px',
                color: filters.minPrepWinRate === 0.8 ? '#eab308' : '#6b7280',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
            >
              80%+ Prep
            </button>
            {/* 100% Battle */}
            <button
              className={filters.minBattleWinRate === 1 ? 'filter-chip-active' : ''}
              onClick={() => setFilters(f => ({ ...f, minBattleWinRate: f.minBattleWinRate === 1 ? 0 : 1 }))}
              style={{
                padding: '0.3rem 0.6rem',
                backgroundColor: filters.minBattleWinRate === 1 ? '#f9731620' : 'transparent',
                border: `1px solid ${filters.minBattleWinRate === 1 ? '#f97316' : '#3a3a3a'}`,
                borderRadius: '16px',
                color: filters.minBattleWinRate === 1 ? '#f97316' : '#6b7280',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
            >
              100% Battle
            </button>
            {/* 80%+ Battle */}
            <button
              className={filters.minBattleWinRate === 0.8 ? 'filter-chip-active' : ''}
              onClick={() => setFilters(f => ({ ...f, minBattleWinRate: f.minBattleWinRate === 0.8 ? 0 : 0.8 }))}
              style={{
                padding: '0.3rem 0.6rem',
                backgroundColor: filters.minBattleWinRate === 0.8 ? '#f9731615' : 'transparent',
                border: `1px solid ${filters.minBattleWinRate === 0.8 ? '#f9731680' : '#3a3a3a'}`,
                borderRadius: '16px',
                color: filters.minBattleWinRate === 0.8 ? '#f97316' : '#6b7280',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
            >
              80%+ Battle
            </button>
            
            <span style={{ color: '#2a2a2a', margin: '0 0.25rem' }}>|</span>

            {/* Transfer Group Filter */}
            <select
              value={transferGroupFilter}
              onChange={(e) => setTransferGroupFilter(e.target.value)}
              style={{
                padding: '0.3rem 1.4rem 0.3rem 0.5rem',
                backgroundColor: transferGroupFilter !== 'all' ? '#22d3ee15' : 'transparent',
                border: `1px solid ${transferGroupFilter !== 'all' ? '#22d3ee' : '#3a3a3a'}`,
                borderRadius: '16px',
                color: transferGroupFilter !== 'all' ? '#22d3ee' : '#6b7280',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: '500',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.3rem center',
                backgroundSize: '0.6rem',
              }}
            >
              <option value="all">{t('home.allTransferGroups', 'Transfer Group')}</option>
              {getTransferGroupOptions().map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          )}
        </div>
        </div>
      </div>

      {/* Content Area */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '0 0.75rem' : '0 2rem' }}>
        {/* Ad Banner removed per user request */}
        
        {/* Recently Viewed - Compact Inline - Desktop only */}
        {!isMobile && recentlyViewed.length > 0 && (
          <div style={{ 
            marginBottom: '1rem', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.75rem',
            padding: '0.5rem 0'
          }}>
            <span style={{ color: '#4a4a4a', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{t('home.recentlyViewed')}</span>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {recentlyViewed.slice(0, 5).map(kNum => (
                <button
                  key={kNum}
                  onClick={() => navigate(`/kingdom/${kNum}`)}
                  style={{
                    padding: '0.4rem 0.6rem',
                    minHeight: '36px',
                    backgroundColor: 'transparent',
                    border: '1px solid #2a2a2a',
                    borderRadius: '4px',
                    color: colors.textMuted,
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => { 
                    e.currentTarget.style.borderColor = '#22d3ee40'; 
                    e.currentTarget.style.color = '#22d3ee';
                  }}
                  onMouseLeave={(e) => { 
                    e.currentTarget.style.borderColor = '#2a2a2a'; 
                    e.currentTarget.style.color = '#6b7280';
                  }}
                >
                  K-{kNum}
                </button>
              ))}
              <button
                onClick={() => { localStorage.removeItem('kingshot_recently_viewed'); setRecentlyViewed([]); }}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: '#3a3a3a', 
                  fontSize: '0.75rem', 
                  cursor: 'pointer',
                  padding: '0.5rem',
                  minWidth: '36px',
                  minHeight: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: '0.25rem'
                }}
                aria-label="Clear history"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Filters Panel */}
        {showFilters && (
          <div className="filter-panel" style={{ padding: isMobile ? '1rem' : '1.5rem', backgroundColor: 'rgba(17, 17, 17, 0.9)', borderRadius: '12px', marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: isMobile ? '1rem' : '1.25rem', border: '1px solid #2a2a2a', animation: 'fadeIn 0.2s ease', backdropFilter: 'blur(12px)' }}>
            {/* Kingdom Tier */}
            <div>
              <label style={{ fontSize: '0.85rem', color: '#9ca3af', display: 'block', marginBottom: '0.5rem' }}>{t('home.filterKingdomTier')}</label>
              <select value={filters.tier || 'all'} onChange={(e) => setFilters({ ...filters, tier: e.target.value })} style={{ width: '100%', padding: '0.6rem', backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: '6px', color: '#fff', fontSize: '1rem' }}>
                <option value="all">{t('tiers.allTiers')}</option>
                <option value="S">{t('tiers.sDescription')}</option>
                <option value="A">{t('tiers.aDescription')}</option>
                <option value="B">{t('tiers.bDescription')}</option>
                <option value="C">{t('tiers.cDescription')}</option>
                <option value="D">{t('tiers.dDescription')}</option>
              </select>
            </div>
            {/* Transfer Status */}
            <div>
              <label style={{ fontSize: '0.85rem', color: '#9ca3af', display: 'block', marginBottom: '0.5rem' }}>{t('home.filterTransferStatus')}</label>
              <select value={filters.status || 'all'} onChange={(e) => setFilters({ ...filters, status: e.target.value })} style={{ width: '100%', padding: '0.6rem', backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: '6px', color: '#fff', fontSize: '1rem' }}>
                <option value="all">{t('home.allStatuses')}</option>
                <option value="Leading">{t('home.statusLeading')}</option>
                <option value="Ordinary">{t('home.statusOrdinary')}</option>
                <option value="Unannounced">{t('home.statusUnannounced')}</option>
              </select>
            </div>
            {/* Experience (KvKs Range) */}
            <div>
              <label style={{ fontSize: '0.85rem', color: '#9ca3af', display: 'block', marginBottom: '0.5rem' }}>{t('home.filterExperience')}</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input 
                  type="number" 
                  min="0" 
                  max="20" 
                  value={filters.minKvKs || 0} 
                  onChange={(e) => setFilters({ ...filters, minKvKs: parseInt(e.target.value) || 0 })} 
                  placeholder="Min"
                  style={{ width: '100%', padding: '0.6rem', backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: '6px', color: '#fff', fontSize: '1rem', textAlign: 'center' }} 
                />
                <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>to</span>
                <input 
                  type="number" 
                  min="0" 
                  max="99" 
                  value={filters.maxKvKs === 99 ? '' : filters.maxKvKs} 
                  onChange={(e) => setFilters({ ...filters, maxKvKs: parseInt(e.target.value) || 99 })} 
                  placeholder="Max"
                  style={{ width: '100%', padding: '0.6rem', backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: '6px', color: '#fff', fontSize: '1rem', textAlign: 'center' }} 
                />
              </div>
            </div>
            {/* Min Prep WR */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: '#9ca3af' }}>{t('home.filterMinPrepWR')}</label>
                <span style={{ fontSize: '0.85rem', color: '#eab308', fontWeight: 'bold' }}>{Math.round((filters.minPrepWinRate || 0) * 100)}%</span>
              </div>
              <input type="range" min="0" max="100" value={(filters.minPrepWinRate || 0) * 100} onChange={(e) => setFilters({ ...filters, minPrepWinRate: parseInt(e.target.value) / 100 })} style={{ width: '100%', height: '6px', appearance: 'none', backgroundColor: '#1f1f1f', borderRadius: '3px', cursor: 'pointer' }} />
            </div>
            {/* Min Battle WR */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: '#9ca3af' }}>{t('home.filterMinBattleWR')}</label>
                <span style={{ fontSize: '0.85rem', color: '#f97316', fontWeight: 'bold' }}>{Math.round((filters.minBattleWinRate || 0) * 100)}%</span>
              </div>
              <input type="range" min="0" max="100" value={(filters.minBattleWinRate || 0) * 100} onChange={(e) => setFilters({ ...filters, minBattleWinRate: parseInt(e.target.value) / 100 })} style={{ width: '100%', height: '6px', appearance: 'none', backgroundColor: '#1f1f1f', borderRadius: '3px', cursor: 'pointer' }} />
            </div>
            {/* Reset */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
              <button onClick={() => setFilters(DEFAULT_FILTERS)} style={{ padding: '0.6rem 1.25rem', backgroundColor: countActiveFilters(filters) > 0 ? '#ef444420' : 'transparent', border: `1px solid ${countActiveFilters(filters) > 0 ? '#ef4444' : '#3a3a3a'}`, borderRadius: '6px', color: countActiveFilters(filters) > 0 ? '#ef4444' : '#9ca3af', cursor: 'pointer', fontSize: '0.85rem', fontWeight: countActiveFilters(filters) > 0 ? '500' : 'normal', transition: 'all 0.2s' }}>
                {t('home.clearFilters')}{countActiveFilters(filters) > 0 && ` (${countActiveFilters(filters)})`}
              </button>
              {hasAnyFilter && (
                <button className="clear-all-btn" onClick={clearAllFilters} style={{ padding: '0.6rem 1.25rem', backgroundColor: '#ef444420', border: '1px solid #ef4444', borderRadius: '6px', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', transition: 'all 0.2s' }}>
                  {t('home.clearAll', 'Clear All')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Results */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: isMobile ? '1rem' : '1.5rem' }}>
            {[1,2,3,4,5,6].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : dataLoadError ? (
          <DataLoadError onRetry={() => window.location.reload()} />
        ) : filteredKingdoms.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '4rem 2rem',
            backgroundColor: '#111111',
            borderRadius: '12px',
            border: `1px solid ${showFavoritesOnly ? '#ef444440' : '#2a2a2a'}`
          }}>
            {showFavoritesOnly && !debouncedSearch && countActiveFilters(filters) === 0 ? (
              <>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" style={{ opacity: 0.6 }}>
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                  </svg>
                </div>
                <h3 style={{ color: '#fff', fontSize: '1.25rem', marginBottom: '0.5rem' }}>{t('home.noFavoritesTitle')}</h3>
                <p style={{ color: colors.textSecondary, fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto 1.5rem', lineHeight: '1.5' }}>
                  Track the kingdoms that matter to you. Click the <span style={{ color: '#ef4444' }}>★</span> on any kingdom card to add it to your watchlist.
                </p>
                <button
                  onClick={() => { setShowFavoritesOnly(false); navigate('/'); }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#ef444420',
                    border: '1px solid #ef4444',
                    borderRadius: '8px',
                    color: '#ef4444',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: '500',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ef444440'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#ef444420'; }}
                >
                  {t('home.browseAll', 'Browse all kingdoms')}
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>🔍</div>
                <h3 style={{ color: '#fff', fontSize: '1.25rem', marginBottom: '0.5rem' }}>{t('home.noKingdomsTitle')}</h3>
                <p style={{ color: colors.textMuted, fontSize: '0.9rem', marginBottom: '1.5rem', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
                  {debouncedSearch ? 
                    `No kingdoms match "${debouncedSearch}". Try a different search term.` :
                    countActiveFilters(filters) > 0 ?
                      'No kingdoms match your current filters. Try adjusting your criteria.' :
                      'No kingdoms available.'
                  }
                </p>
                {hasAnyFilter && (
                  <button
                    onClick={clearAllFilters}
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#22d3ee20',
                      border: '1px solid #22d3ee',
                      borderRadius: '8px',
                      color: '#22d3ee',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: '500'
                    }}
                  >
                    {t('home.clearFilters')}
                  </button>
                )}
              </>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div ref={gridRef} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: isMobile ? '1rem' : '1.5rem', paddingTop: '0.5rem', paddingBottom: '3rem' }}>
            {displayedKingdoms.map((kingdom, index) => (
              <div 
                key={kingdom.kingdom_number} 
                style={{ 
                  outline: selectedCardIndex === index ? '2px solid #22d3ee' : 'none',
                  outlineOffset: '4px',
                  borderRadius: '14px'
                }}
              >
                <LazyCard delay={index > 8 ? (index - 8) * 20 : 0}>
                  <KingdomCard 
                    kingdom={kingdom} 
                    rank={kingdom.rank}
                    isFavorite={favorites.includes(kingdom.kingdom_number)}
                    onToggleFavorite={() => toggleFavorite(kingdom.kingdom_number)}
                    onCopyLink={() => showToast('Link copied to clipboard!', 'success')}
                  />
                </LazyCard>
              </div>
            ))}
          </div>
        ) : (
          <KingdomTable 
            kingdoms={displayedKingdoms}
            favorites={favorites}
            toggleFavorite={toggleFavorite}
            sortBy={sort.sortBy}
            sortOrder={sort.order}
            onSort={(newSortBy) => {
              if (sort.sortBy === newSortBy) {
                setSort({ ...sort, order: sort.order === 'desc' ? 'asc' : 'desc' });
              } else {
                setSort({ sortBy: newSortBy as SortOptions['sortBy'], order: 'desc' });
              }
            }}
          />
        )}

        {/* Infinite Scroll Sentinel */}
        <div ref={loadMoreRef} style={{ height: '1px', marginTop: '-1px' }} />
        
        {/* Loading indicator for infinite scroll */}
        {loadingMore && displayCount < filteredKingdoms.length && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: colors.textMuted }}>
              <span className="loading-spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }} />
              <span>Loading more kingdoms...</span>
            </div>
          </div>
        )}
        
        {/* End of list indicator */}
        {displayCount >= filteredKingdoms.length && filteredKingdoms.length > 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '2rem', color: colors.textMuted, fontSize: '0.9rem' }}>
            {t('kingdomDirectory.showingAll', 'Showing all')} {filteredKingdoms.length} {t('kingdomDirectory.kingdoms', 'kingdoms')}
          </div>
        )}
      </div>

      {/* Back to Top Button */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          style={{
            position: 'fixed',
            bottom: '1rem',
            left: '1rem',
            width: '44px',
            height: '44px',
            padding: 0,
            backgroundColor: '#111111',
            border: '1px solid #2a2a2a',
            borderRadius: '50%',
            color: '#22d3ee',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.4)',
            zIndex: 1000,
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#1a1a1a';
            e.currentTarget.style.borderColor = '#22d3ee';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#111111';
            e.currentTarget.style.borderColor = '#2a2a2a';
          }}
          aria-label="Back to top"
        >
          <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </button>
      )}

      {/* Sidebar Toggle Button */}
      {!isMobile && (
        <button
          onClick={() => setShowSidebar(!showSidebar)}
          style={{
            position: 'fixed',
            right: showSidebar ? '320px' : '0',
            top: '50%',
            transform: 'translateY(-50%)',
            padding: '0.75rem 0.35rem',
            backgroundColor: '#111',
            border: '1px solid #2a2a2a',
            borderRight: showSidebar ? '1px solid #2a2a2a' : 'none',
            borderRadius: showSidebar ? '8px 0 0 8px' : '8px 0 0 8px',
            color: '#22d3ee',
            cursor: 'pointer',
            zIndex: 90,
            transition: 'right 0.3s ease'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {showSidebar ? <path d="M9 18l6-6-6-6" /> : <path d="M15 18l-6-6 6-6" />}
          </svg>
        </button>
      )}

      {/* Sidebar with Calendar and Submit */}
      {!isMobile && showSidebar && (
        <div style={{
          position: 'fixed',
          right: 0,
          top: '56px',
          bottom: 0,
          width: '320px',
          backgroundColor: colors.bg,
          borderLeft: `1px solid ${colors.border}`,
          padding: '1rem',
          overflowY: 'auto',
          zIndex: 80
        }}>
          {/* Hot Right Now */}
          <HotRightNow kingdoms={allKingdoms} recentlyViewed={recentlyViewed} limit={6} />
          
          <EventCalendar />
          
          <button
            onClick={handleSubmitKvKClick}
            style={{
              width: '100%',
              marginTop: '1rem',
              padding: '0.75rem 1rem',
              backgroundColor: '#22d3ee15',
              border: '1px solid #22d3ee50',
              borderRadius: '10px',
              color: '#22d3ee',
              cursor: 'pointer',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Submit KvK Results
          </button>
        </div>
      )}

      {/* Post-KvK Submission Modal */}
      <PostKvKSubmission
        isOpen={showPostKvKModal}
        onClose={() => setShowPostKvKModal(false)}
      />

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        input[type="range"]::-webkit-slider-thumb { appearance: none; width: 16px; height: 16px; background: #22d3ee; border-radius: 50%; cursor: pointer; box-shadow: 0 0 10px rgba(34, 211, 238, 0.5); }
        input[type="range"]::-moz-range-thumb { width: 16px; height: 16px; background: #22d3ee; border-radius: 50%; cursor: pointer; border: none; box-shadow: 0 0 10px rgba(34, 211, 238, 0.5); }
      `}</style>
    </div>
  );
};

export default KingdomDirectory;
