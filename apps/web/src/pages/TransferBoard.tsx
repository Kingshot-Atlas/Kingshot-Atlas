import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useAnalytics } from '../hooks/useAnalytics';
import KvKCountdown from '../components/KvKCountdown';
import { supabase } from '../lib/supabase';
import TransferProfileForm from '../components/TransferProfileForm';
import { ApplyModal, MyApplicationsTracker } from '../components/TransferApplications';
import RecruiterDashboard from '../components/RecruiterDashboard';
import EditorClaiming from '../components/EditorClaiming';
import KingdomFundContribute from '../components/KingdomFundContribute';
import { neonGlow, FONT_DISPLAY, colors } from '../utils/styles';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useMetaTags, PAGE_META_TAGS } from '../hooks/useMetaTags';
import { useStructuredData, PAGE_BREADCRUMBS } from '../hooks/useStructuredData';
import KingdomListingCard, { KingdomData, KingdomFund, KingdomReviewSummary, BoardMode, MatchDetail, formatTCLevel } from '../components/KingdomListingCard';
import { useScrollDepth } from '../hooks/useScrollDepth';
import TransferHubGuide from '../components/TransferHubGuide';
import EntryModal from '../components/transfer/EntryModal';
import ModeToggle from '../components/transfer/ModeToggle';
import FilterPanel, { FilterState, defaultFilters } from '../components/transfer/FilterPanel';

// =============================================
// TYPES (KingdomData, KingdomFund, KingdomReviewSummary, BoardMode, MatchDetail, formatTCLevel
// are imported from ../components/KingdomListingCard)
// =============================================

interface UserTransferProfile {
  power_million: number;
  tc_level: number;
  main_language: string;
  secondary_languages: string[];
  looking_for: string[];
  kvk_availability: string;
  saving_for_kvk: string;
  group_size: string;
  player_bio: string;
  play_schedule: unknown[];
  contact_method: string;
  visible_to_recruiters: boolean;
}

// =============================================
// CONSTANTS
// =============================================


// RECRUITMENT_TAG_OPTIONS and LANGUAGE_OPTIONS moved to ../components/transfer/FilterPanel

// =============================================
// TRANSFER GROUPS — Update these when new event groups are announced
// Set TRANSFER_GROUPS_ACTIVE = true when event is live, false otherwise
// =============================================

const TRANSFER_GROUPS_ACTIVE = false; // Set to true when transfer groups are announced

// Last known transfer groups (update with each new event)
const TRANSFER_GROUPS: Array<[number, number]> = [
  [1, 6],
  [7, 115],
  [116, 417],
  [418, 587],
  [588, 674],
  [675, 846],
];

// Find which transfer group a kingdom belongs to
const getTransferGroup = (kingdomNumber: number): [number, number] | null => {
  return TRANSFER_GROUPS.find(([min, max]) => kingdomNumber >= min && kingdomNumber <= max) || null;
};

// EntryModal and ModeToggle extracted to ../components/transfer/

// FilterPanel, FilterState, defaultFilters extracted to ../components/transfer/FilterPanel

// AllianceEventTimesGrid and KingdomListingCard are now in ../components/KingdomListingCard.tsx
// (removed ~830 lines of inline component code)

// =============================================
// MAIN TRANSFER HUB PAGE
// =============================================

const TransferBoard: React.FC = () => {
  useDocumentTitle('Transfer Hub');
  useMetaTags(PAGE_META_TAGS.transferHub);
  useStructuredData({ type: 'BreadcrumbList', data: PAGE_BREADCRUMBS.transferHub });
  useScrollDepth('Transfer Hub');
  const { user, profile } = useAuth();
  const isMobile = useIsMobile();
  const { trackFeature } = useAnalytics();

  // Mode state — persisted in localStorage
  const [mode, setMode] = useState<BoardMode>(() => {
    const saved = localStorage.getItem('atlas_transfer_hub_mode');
    return (saved as BoardMode) || 'browsing';
  });
  const [showEntryModal, setShowEntryModal] = useState(() => {
    return !localStorage.getItem('atlas_transfer_hub_visited');
  });

  // Data state
  const [kingdoms, setKingdoms] = useState<KingdomData[]>([]);
  const [funds, setFunds] = useState<KingdomFund[]>([]);
  const [reviewSummaries, setReviewSummaries] = useState<KingdomReviewSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [scrollToIncomplete, setScrollToIncomplete] = useState(false);
  const [hasTransferProfile, setHasTransferProfile] = useState(false);
  const [transferProfile, setTransferProfile] = useState<UserTransferProfile | null>(null);
  const [applyingToKingdom, setApplyingToKingdom] = useState<number | null>(null);
  const [activeAppCount, setActiveAppCount] = useState(0);
  const [appRefreshKey, setAppRefreshKey] = useState(0);
  const [showRecruiterDash, setShowRecruiterDash] = useState(false);
  const [isEditor, setIsEditor] = useState(false);
  const [contributingToKingdom, setContributingToKingdom] = useState<number | null>(null);
  const [showContributionSuccess, setShowContributionSuccess] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [activeTransfereeCount, setActiveTransfereeCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [profileViewCount, setProfileViewCount] = useState(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [showAuthGate, setShowAuthGate] = useState<'login' | 'link' | null>(null);

  // Track page view
  useEffect(() => {
    trackFeature('Transfer Hub');
  }, [trackFeature]);

  // Handle URL parameters: ?fund=N opens contribution modal, ?contributed=true shows success toast
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fundParam = params.get('fund');
    const contributed = params.get('contributed');

    if (contributed === 'true') {
      setShowContributionSuccess(true);
    }

    if (fundParam) {
      const kn = parseInt(fundParam, 10);
      if (!isNaN(kn) && kn > 0) {
        setContributingToKingdom(kn);
      }
    }

    // Clean URL params
    if (fundParam || contributed) {
      params.delete('fund');
      params.delete('contributed');
      const newUrl = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  // Infinite scroll: load more standard listings when sentinel comes into view
  const loadMore = useCallback(() => {
    setVisibleCount(prev => prev + 20);
  }, []);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) loadMore(); },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, loading]);

  // Reset visible count when filters or mode change
  useEffect(() => {
    setVisibleCount(20);
  }, [filters, mode]);

  // Check if user has a transfer profile + count active applications + editor status
  useEffect(() => {
    const checkProfile = async () => {
      if (!supabase || !user) return;
      const { data } = await supabase
        .from('transfer_profiles')
        .select('id, power_million, tc_level, main_language, secondary_languages, looking_for, kvk_availability, saving_for_kvk, group_size, player_bio, play_schedule, contact_method, visible_to_recruiters')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();
      setHasTransferProfile(!!data);
      if (data) {
        // Touch last_active_at silently (debounced — max once per hour)
        const lastTouch = localStorage.getItem('atlas_tp_last_active_touch');
        if (!lastTouch || Date.now() - parseInt(lastTouch, 10) > 3600000) {
          supabase.from('transfer_profiles').update({ last_active_at: new Date().toISOString() }).eq('id', data.id).then(() => {});
          localStorage.setItem('atlas_tp_last_active_touch', String(Date.now()));
        }
        setTransferProfile({
          power_million: data.power_million || 0,
          tc_level: data.tc_level || 0,
          main_language: data.main_language || 'English',
          secondary_languages: data.secondary_languages || [],
          looking_for: data.looking_for || [],
          kvk_availability: data.kvk_availability || '',
          saving_for_kvk: data.saving_for_kvk || '',
          group_size: data.group_size || '',
          player_bio: data.player_bio || '',
          play_schedule: data.play_schedule || [],
          contact_method: data.contact_method || '',
          visible_to_recruiters: !!data.visible_to_recruiters,
        });
        // Fetch distinct kingdom view count
        const { data: viewRows } = await supabase
          .from('transfer_profile_views')
          .select('viewer_kingdom_number')
          .eq('transfer_profile_id', data.id);
        const uniqueKingdoms = new Set((viewRows || []).map((v: { viewer_kingdom_number: number }) => v.viewer_kingdom_number));
        setProfileViewCount(uniqueKingdoms.size);
      } else {
        setTransferProfile(null);
        setProfileViewCount(0);
      }
    };
    const countActiveApps = async () => {
      if (!supabase || !user) return;
      const { count } = await supabase
        .from('transfer_applications')
        .select('*', { count: 'exact', head: true })
        .eq('applicant_user_id', user.id)
        .in('status', ['pending', 'viewed', 'interested']);
      setActiveAppCount(count || 0);
    };
    const checkEditor = async () => {
      if (!supabase || !user) return;
      const { data } = await supabase
        .from('kingdom_editors')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();
      setIsEditor(!!data);
    };
    const countTransferees = async () => {
      if (!supabase) return;
      const { count } = await supabase
        .from('transfer_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .eq('visible_to_recruiters', true);
      setActiveTransfereeCount(count || 0);
    };
    checkProfile();
    countActiveApps();
    checkEditor();
    countTransferees();
  }, [user, appRefreshKey]);

  // Load kingdom data from Supabase
  useEffect(() => {
    const loadData = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        // Fetch kingdoms with scores (from Supabase single source of truth)
        const { data: kingdomData, error: kError } = await supabase
          .from('kingdoms')
          .select('kingdom_number, atlas_score, current_rank, total_kvks, prep_wins, prep_losses, prep_win_rate, battle_wins, battle_losses, battle_win_rate, dominations, comebacks, reversals, invasions, most_recent_status')
          .order('current_rank', { ascending: true });

        if (kError) throw kError;
        setKingdoms(kingdomData || []);

        // Fetch kingdom funds
        const { data: fundData, error: fError } = await supabase
          .from('kingdom_funds')
          .select('*');

        if (!fError) setFunds(fundData || []);

        // Fetch review summaries (aggregate from kingdom_reviews)
        const { data: reviewData, error: rError } = await supabase
          .from('kingdom_reviews')
          .select('kingdom_number, rating, comment, author_linked_username, helpful_count');

        if (!rError && reviewData) {
          const summaryMap = new Map<number, {
            ratings: number[];
            topComment: string | null;
            topAuthor: string | null;
            topHelpful: number;
          }>();

          reviewData.forEach((r: { kingdom_number: number; rating: number; comment: string; author_linked_username: string; helpful_count: number }) => {
            const existing = summaryMap.get(r.kingdom_number);
            if (!existing) {
              summaryMap.set(r.kingdom_number, {
                ratings: [r.rating],
                topComment: r.comment,
                topAuthor: r.author_linked_username,
                topHelpful: r.helpful_count || 0,
              });
            } else {
              existing.ratings.push(r.rating);
              if ((r.helpful_count || 0) > existing.topHelpful) {
                existing.topComment = r.comment;
                existing.topAuthor = r.author_linked_username;
                existing.topHelpful = r.helpful_count || 0;
              }
            }
          });

          const summaries: KingdomReviewSummary[] = [];
          summaryMap.forEach((val, kn) => {
            summaries.push({
              kingdom_number: kn,
              avg_rating: val.ratings.reduce((a, b) => a + b, 0) / val.ratings.length,
              review_count: val.ratings.length,
              top_review_comment: val.topComment,
              top_review_author: val.topAuthor,
            });
          });
          setReviewSummaries(summaries);
        }
      } catch (err) {
        console.error('Transfer Hub data load error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Handle entry modal selection
  const handleModeSelect = (selectedMode: BoardMode) => {
    setMode(selectedMode);
    trackFeature('Transfer Hub Mode', { mode: selectedMode });
    localStorage.setItem('atlas_transfer_hub_mode', selectedMode);
    localStorage.setItem('atlas_transfer_hub_visited', 'true');
    setShowEntryModal(false);
  };

  // Handle mode toggle change
  const handleModeChange = (newMode: BoardMode) => {
    setMode(newMode);
    trackFeature('Transfer Hub Mode Toggle', { mode: newMode });
    localStorage.setItem('atlas_transfer_hub_mode', newMode);
  };

  // Create fund lookup map
  const fundMap = useMemo(() => {
    const map = new Map<number, KingdomFund>();
    funds.forEach((f) => map.set(f.kingdom_number, f));
    return map;
  }, [funds]);

  // Create review summary lookup map
  const reviewMap = useMemo(() => {
    const map = new Map<number, KingdomReviewSummary>();
    reviewSummaries.forEach((r) => map.set(r.kingdom_number, r));
    return map;
  }, [reviewSummaries]);

  // Determine user's transfer group
  const userTransferGroup = useMemo(() => {
    if (!TRANSFER_GROUPS_ACTIVE || !profile?.linked_kingdom) return null;
    return getTransferGroup(profile.linked_kingdom);
  }, [profile?.linked_kingdom]);

  // Lightweight match score for sorting (no details array allocation)
  const calculateMatchScoreForSort = (_kingdom: KingdomData, fund: KingdomFund | null): number => {
    if (!transferProfile || !fund) return 0;
    let matched = 0;
    let total = 0;
    const minPower = fund.min_power_million || (fund.min_power_range ? parseInt(fund.min_power_range, 10) || 0 : 0);
    if (minPower > 0) { total++; if (transferProfile.power_million >= minPower) matched++; }
    if (fund.min_tc_level && fund.min_tc_level > 0) { total++; if (transferProfile.tc_level >= fund.min_tc_level) matched++; }
    if (fund.main_language) { total++; if (fund.main_language === transferProfile.main_language || (fund.secondary_languages || []).includes(transferProfile.main_language) || fund.main_language === (transferProfile.secondary_languages?.[0] || '')) matched++; }
    if (fund.kingdom_vibe && fund.kingdom_vibe.length > 0 && transferProfile.looking_for.length > 0) { total++; if (transferProfile.looking_for.some(v => fund.kingdom_vibe.includes(v))) matched++; }
    if (total === 0) {
      // Fallback: soft heuristic when no explicit requirements set
      let fallback = 0, fallbackTotal = 0;
      if (fund.main_language) { fallbackTotal++; if (fund.main_language === transferProfile.main_language) fallback++; }
      if (fund.kingdom_vibe && fund.kingdom_vibe.length > 0 && transferProfile.looking_for.length > 0) {
        fallbackTotal++; if (transferProfile.looking_for.some(v => fund.kingdom_vibe.includes(v))) fallback++;
      }
      if (fund.is_recruiting) { fallbackTotal++; fallback++; }
      return fallbackTotal === 0 ? 0 : Math.round((fallback / fallbackTotal) * 100);
    }
    return Math.round((matched / total) * 100);
  };

  // Filter and sort kingdoms
  const filteredKingdoms = useMemo(() => {
    let result = [...kingdoms];

    // In transferring mode, exclude user's own kingdom (can't transfer to yourself)
    if (mode === 'transferring' && profile?.linked_kingdom) {
      result = result.filter((k) => k.kingdom_number !== profile.linked_kingdom);
    }

    // In recruiting mode, only show the viewer's own kingdom
    if (mode === 'recruiting' && profile?.linked_kingdom) {
      result = result.filter((k) => k.kingdom_number === profile.linked_kingdom);
    }

    // Kingdom number search filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim();
      result = result.filter((k) => String(k.kingdom_number).includes(q));
    }

    // Transfer group filter — only show kingdoms in user's transfer group
    if (TRANSFER_GROUPS_ACTIVE && userTransferGroup) {
      const [min, max] = userTransferGroup;
      result = result.filter((k) => k.kingdom_number >= min && k.kingdom_number <= max);
    }

    // Apply filters
    if (filters.isRecruiting) {
      result = result.filter((k) => {
        const fund = fundMap.get(k.kingdom_number);
        return fund?.is_recruiting;
      });
    }

    if (filters.tier !== 'all') {
      result = result.filter((k) => {
        const fund = fundMap.get(k.kingdom_number);
        return (fund?.tier || 'standard') === filters.tier;
      });
    }

    if (filters.language !== 'all') {
      result = result.filter((k) => {
        const fund = fundMap.get(k.kingdom_number);
        return fund?.main_language === filters.language ||
          fund?.secondary_languages?.includes(filters.language);
      });
    }

    if (filters.minScore) {
      const min = parseFloat(filters.minScore);
      result = result.filter((k) => (k.atlas_score || 0) >= min);
    }

    if (filters.maxScore) {
      const max = parseFloat(filters.maxScore);
      result = result.filter((k) => (k.atlas_score || 0) <= max);
    }

    if (filters.tag !== 'all') {
      result = result.filter((k) => {
        const fund = fundMap.get(k.kingdom_number);
        return fund?.recruitment_tags?.includes(filters.tag);
      });
    }

    // Sort
    const tierOrder = { gold: 0, silver: 1, bronze: 2, standard: 3 };
    switch (filters.sortBy) {
      case 'tier':
        result.sort((a, b) => {
          const aTier = fundMap.get(a.kingdom_number)?.tier || 'standard';
          const bTier = fundMap.get(b.kingdom_number)?.tier || 'standard';
          const tierDiff = (tierOrder[aTier as keyof typeof tierOrder] || 3) - (tierOrder[bTier as keyof typeof tierOrder] || 3);
          if (tierDiff !== 0) return tierDiff;
          return (b.atlas_score || 0) - (a.atlas_score || 0);
        });
        break;
      case 'score':
        result.sort((a, b) => (b.atlas_score || 0) - (a.atlas_score || 0));
        break;
      case 'rank':
        result.sort((a, b) => (a.current_rank || 9999) - (b.current_rank || 9999));
        break;
      case 'match':
        if (transferProfile) {
          result.sort((a, b) => {
            const aFund = fundMap.get(a.kingdom_number) || null;
            const bFund = fundMap.get(b.kingdom_number) || null;
            const aScore = aFund && transferProfile ? calculateMatchScoreForSort(a, aFund) : 0;
            const bScore = bFund && transferProfile ? calculateMatchScoreForSort(b, bFund) : 0;
            return bScore - aScore;
          });
        }
        break;
      default:
        break;
    }

    return result;
  }, [kingdoms, filters, fundMap, mode, profile?.linked_kingdom, userTransferGroup, searchQuery, transferProfile]);

  // Calculate match score for transferring mode
  const calculateMatchScore = (_kingdom: KingdomData, fund: KingdomFund | null): { score: number; details: MatchDetail[] } => {
    if (!transferProfile || !fund) return { score: 0, details: [] };

    const details: MatchDetail[] = [];
    let matched = 0;
    let total = 0;

    // 1. Power check
    const minPower = fund.min_power_million || (fund.min_power_range ? parseInt(fund.min_power_range, 10) || 0 : 0);
    if (minPower > 0) {
      total++;
      const powerOk = transferProfile.power_million >= minPower;
      if (powerOk) matched++;
      details.push({ label: 'Power', matched: powerOk, detail: powerOk ? `${transferProfile.power_million}M ≥ ${minPower}M required` : `${transferProfile.power_million}M < ${minPower}M required` });
    }

    // 2. TC Level check
    if (fund.min_tc_level && fund.min_tc_level > 0) {
      total++;
      const tcOk = transferProfile.tc_level >= fund.min_tc_level;
      if (tcOk) matched++;
      details.push({ label: 'TC Level', matched: tcOk, detail: tcOk ? `${formatTCLevel(transferProfile.tc_level)} ≥ ${formatTCLevel(fund.min_tc_level)} required` : `${formatTCLevel(transferProfile.tc_level)} < ${formatTCLevel(fund.min_tc_level)} required` });
    }

    // 3. Language check
    if (fund.main_language) {
      total++;
      const langMatch = fund.main_language === transferProfile.main_language
        || (fund.secondary_languages || []).includes(transferProfile.main_language)
        || fund.main_language === (transferProfile.secondary_languages?.[0] || '');
      if (langMatch) matched++;
      details.push({ label: 'Language', matched: langMatch, detail: langMatch ? `${transferProfile.main_language} matches` : `${transferProfile.main_language} ≠ ${fund.main_language}` });
    }

    // 4. Kingdom Vibe / Looking For overlap
    if (fund.kingdom_vibe && fund.kingdom_vibe.length > 0 && transferProfile.looking_for.length > 0) {
      total++;
      const overlap = transferProfile.looking_for.filter(v => fund.kingdom_vibe.includes(v));
      const vibeMatch = overlap.length > 0;
      if (vibeMatch) matched++;
      details.push({ label: 'Vibe Match', matched: vibeMatch, detail: vibeMatch ? `${overlap.length} shared: ${overlap.join(', ')}` : 'No overlapping vibes' });
    }

    if (total === 0) {
      // Fallback heuristic when no explicit min requirements are set
      const fbDetails: MatchDetail[] = [];
      let fbMatched = 0, fbTotal = 0;
      if (fund.main_language) {
        fbTotal++;
        const langOk = fund.main_language === transferProfile.main_language
          || (fund.secondary_languages || []).includes(transferProfile.main_language);
        if (langOk) fbMatched++;
        fbDetails.push({ label: 'Language', matched: langOk, detail: langOk ? `${transferProfile.main_language} matches` : `${transferProfile.main_language} ≠ ${fund.main_language}` });
      }
      if (fund.kingdom_vibe && fund.kingdom_vibe.length > 0 && transferProfile.looking_for.length > 0) {
        fbTotal++;
        const overlap = transferProfile.looking_for.filter(v => fund.kingdom_vibe.includes(v));
        const vibeOk = overlap.length > 0;
        if (vibeOk) fbMatched++;
        fbDetails.push({ label: 'Vibe Match', matched: vibeOk, detail: vibeOk ? `${overlap.length} shared: ${overlap.join(', ')}` : 'No overlapping vibes' });
      }
      if (fund.is_recruiting) {
        fbTotal++; fbMatched++;
        fbDetails.push({ label: 'Recruiting', matched: true, detail: 'Kingdom is actively recruiting' });
      }
      if (fbTotal === 0) return { score: 0, details: [] };
      return { score: Math.round((fbMatched / fbTotal) * 100), details: fbDetails };
    }
    const score = Math.round((matched / total) * 100);
    return { score, details };
  };

  // Auth helpers — browsing is open to all, actions require login + linked account
  const hasLinkedAccount = !!profile?.linked_player_id;
  const requireAuth = (action: () => void) => {
    if (!user) { setShowAuthGate('login'); return; }
    if (!hasLinkedAccount) { setShowAuthGate('link'); return; }
    action();
  };

  // Memoized top matches for Recommended Kingdoms section
  const topMatches = useMemo(() => {
    if (!transferProfile || mode !== 'transferring') return [];
    return filteredKingdoms
      .map(k => {
        const f = fundMap.get(k.kingdom_number) || null;
        const { score, details } = calculateMatchScore(k, f);
        return { kingdom: k, fund: f, score, details };
      })
      .filter(m => m.score >= 50)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [filteredKingdoms, fundMap, transferProfile, mode]);

  const kingdomsWithFunds = filteredKingdoms.filter((k) => fundMap.has(k.kingdom_number));
  const kingdomsWithoutFunds = filteredKingdoms.filter((k) => !fundMap.has(k.kingdom_number));

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: isMobile ? '0 0.25rem' : 0 }}>
      {showEntryModal && (
        <EntryModal
          onSelect={handleModeSelect}
          onClose={() => {
            localStorage.setItem('atlas_transfer_hub_visited', 'true');
            setShowEntryModal(false);
          }}
        />
      )}

      {/* Hero Section - matching Rankings/About pages */}
      <div style={{
        padding: isMobile ? '1.25rem 1rem 1rem' : '1.75rem 2rem 1.25rem',
        textAlign: 'center',
        background: 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)',
        borderRadius: '16px',
        marginBottom: '1.25rem',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '800px', margin: '0 auto' }}>
          <h1 style={{
            fontSize: isMobile ? '1.5rem' : '2rem',
            fontWeight: 'bold',
            marginBottom: '0.5rem',
            fontFamily: FONT_DISPLAY,
          }}>
            <span style={{ color: '#fff' }}>TRANSFER</span>
            <span style={{ ...neonGlow('#22d3ee'), marginLeft: '0.5rem', fontSize: isMobile ? '1.6rem' : '2.25rem' }}>HUB</span>
          </h1>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.8rem' : '0.9rem', marginBottom: '0.25rem' }}>
            No more blind transfers.
          </p>
          <p style={{ color: '#6b7280', fontSize: isMobile ? '0.7rem' : '0.8rem', marginBottom: '0.75rem' }}>
            Find the perfect kingdom for you — or the best recruits.
          </p>
          {!isMobile && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div style={{ width: '50px', height: '2px', background: 'linear-gradient(90deg, transparent, #22d3ee)' }} />
              <div style={{ width: '6px', height: '6px', backgroundColor: '#22d3ee', transform: 'rotate(45deg)', boxShadow: '0 0 8px #22d3ee' }} />
              <div style={{ width: '50px', height: '2px', background: 'linear-gradient(90deg, #22d3ee, transparent)' }} />
            </div>
          )}
          {/* Transfer Countdown Only */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <KvKCountdown type="transfer" />
          </div>
        </div>
      </div>

      {/* How It Works Guide */}
      <TransferHubGuide />

      {/* Transfer Hub Stats */}
      {!loading && (
        <div style={{
          display: 'flex',
          gap: isMobile ? '0.5rem' : '0.75rem',
          marginBottom: '1rem',
          justifyContent: 'center',
        }}>
          {[
            { label: 'Kingdoms', value: kingdoms.length, icon: '🏰' },
            { label: 'Recruiting', value: funds.filter(f => f.is_recruiting).length, icon: '📢', color: '#22c55e' },
            { label: 'Transferees', value: activeTransfereeCount, icon: '🚀', color: '#22d3ee' },
          ].map((stat) => (
            <div key={stat.label} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.35rem 0.65rem',
              backgroundColor: '#111111',
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              fontSize: '0.75rem',
            }}>
              <span style={{ fontSize: '0.85rem' }}>{stat.icon}</span>
              <span style={{ color: stat.color || colors.text, fontWeight: '700' }}>{stat.value}</span>
              <span style={{ color: colors.textMuted, fontSize: '0.7rem' }}>{stat.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Mode Toggle */}
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
        <ModeToggle mode={mode} onChange={handleModeChange} />
      </div>

      {/* Transfer Profile CTA (only in transferring mode) */}
      {mode === 'transferring' && (() => {
        // Calculate profile completeness
        const tp = transferProfile;
        const profilePct = tp ? (() => {
          const checks = [
            tp.power_million > 0,
            !!tp.main_language,
            !!tp.kvk_availability,
            !!tp.saving_for_kvk,
            tp.looking_for.length > 0,
            !!tp.group_size,
            !!tp.player_bio?.trim(),
            tp.play_schedule.length > 0,
            !!tp.contact_method,
            !!tp.visible_to_recruiters,
          ];
          return Math.round((checks.filter(Boolean).length / checks.length) * 100);
        })() : 0;
        const isIncomplete = hasTransferProfile && profilePct < 100;
        const barColor = profilePct >= 80 ? '#22c55e' : profilePct >= 50 ? '#fbbf24' : '#22d3ee';

        return (
          <div style={{
            backgroundColor: '#22d3ee08',
            border: '1px solid #22d3ee25',
            borderRadius: '12px',
            padding: isMobile ? '0.75rem' : '1rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: isMobile ? 'flex-start' : 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexDirection: isMobile ? 'column' : 'row',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#22d3ee', fontWeight: '600', fontSize: '0.85rem' }}>
                  {hasTransferProfile ? 'Your Transfer Profile is Active' : 'Create Your Transfer Profile'}
                </span>
                {isIncomplete && (
                  <span style={{
                    padding: '0.1rem 0.4rem',
                    backgroundColor: `${barColor}15`,
                    border: `1px solid ${barColor}30`,
                    borderRadius: '4px',
                    fontSize: '0.65rem',
                    fontWeight: '700',
                    color: barColor,
                  }}>
                    {profilePct}%
                  </span>
                )}
              </div>
              <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: '0.2rem 0 0 0' }}>
                {isIncomplete
                  ? 'Complete your profile for better Match Scores and more recruiter visibility.'
                  : hasTransferProfile
                    ? 'Kingdoms can see your profile when you apply. You can edit it anytime.'
                    : 'Set up your profile so kingdoms know what you bring to the table.'}
              </p>
              {hasTransferProfile && profileViewCount > 0 && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                  marginTop: '0.35rem',
                  padding: '0.15rem 0.5rem',
                  backgroundColor: '#a855f710',
                  border: '1px solid #a855f725',
                  borderRadius: '6px',
                  fontSize: '0.65rem',
                  color: '#a855f7',
                }}>
                  <span>👀</span>
                  <span style={{ fontWeight: '700' }}>{profileViewCount}</span>
                  <span>kingdom{profileViewCount !== 1 ? 's' : ''} viewed your profile</span>
                </div>
              )}
              {hasTransferProfile && activeAppCount >= 2 && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                  marginTop: '0.35rem',
                  padding: '0.15rem 0.5rem',
                  backgroundColor: activeAppCount >= 3 ? '#ef444410' : '#f59e0b10',
                  border: `1px solid ${activeAppCount >= 3 ? '#ef444425' : '#f59e0b25'}`,
                  borderRadius: '6px',
                  fontSize: '0.65rem',
                  color: activeAppCount >= 3 ? '#ef4444' : '#f59e0b',
                  fontWeight: '600',
                }}>
                  📋 {activeAppCount}/3 application slots used{activeAppCount >= 3 ? ' — withdraw one to apply again' : ''}
                </div>
              )}
              {isIncomplete && (
                <div style={{
                  width: '100%', maxWidth: '200px', height: '4px',
                  backgroundColor: '#1a1a1a', borderRadius: '2px',
                  overflow: 'hidden', marginTop: '0.4rem',
                }}>
                  <div style={{
                    width: `${profilePct}%`, height: '100%',
                    backgroundColor: barColor, borderRadius: '2px',
                    transition: 'width 0.3s ease',
                  }} />
                </div>
              )}
            </div>
            <button
              onClick={() => requireAuth(() => { setScrollToIncomplete(!!isIncomplete); setShowProfileForm(true); })}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: hasTransferProfile ? 'transparent' : '#22d3ee',
                border: hasTransferProfile ? '1px solid #22d3ee40' : 'none',
                borderRadius: '8px',
                color: hasTransferProfile ? '#22d3ee' : '#000',
                fontSize: '0.8rem',
                fontWeight: '600',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isIncomplete ? 'Complete Profile' : hasTransferProfile ? 'Edit Profile' : 'Create Profile'}
            </button>
          </div>
        );
      })()}

      {/* Transfer Profile Form Modal */}
      {showProfileForm && (
        <TransferProfileForm
          onClose={() => { setShowProfileForm(false); setScrollToIncomplete(false); }}
          onSaved={() => {
            setShowProfileForm(false);
            setScrollToIncomplete(false);
            setHasTransferProfile(true);
          }}
          scrollToIncomplete={scrollToIncomplete}
        />
      )}

      {/* Apply Modal */}
      {applyingToKingdom !== null && (
        <ApplyModal
          kingdomNumber={applyingToKingdom}
          onClose={() => setApplyingToKingdom(null)}
          onApplied={() => {
            setApplyingToKingdom(null);
            setAppRefreshKey((k) => k + 1);
          }}
          activeCount={activeAppCount}
          hasProfile={hasTransferProfile}
        />
      )}

      {/* My Applications Tracker (transferring mode only) */}
      {mode === 'transferring' && user && (
        <MyApplicationsTracker
          onWithdraw={() => setAppRefreshKey((k) => k + 1)}
        />
      )}

      {/* Recruiter Mode: Sign-in prompt for guests */}
      {mode === 'recruiting' && !user && (
        <div style={{
          textAlign: 'center',
          padding: '2rem 1rem',
          backgroundColor: '#111111',
          borderRadius: '12px',
          border: '1px solid #2a2a2a',
          marginBottom: '1rem',
        }}>
          <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.75rem' }}>👑</span>
          <p style={{ color: '#fff', fontSize: '0.95rem', fontWeight: '600', marginBottom: '0.3rem' }}>
            Sign In to Recruit
          </p>
          <p style={{ color: '#6b7280', fontSize: '0.8rem', marginBottom: '1rem', maxWidth: '400px', margin: '0 auto 1rem' }}>
            Sign in and link your Kingshot account to claim your kingdom, set up your listing, and review transfer applications.
          </p>
          <Link to="/auth" style={{
            display: 'inline-block',
            padding: '0.6rem 1.5rem',
            backgroundColor: '#a855f7',
            color: '#fff',
            borderRadius: '8px',
            fontWeight: '600',
            fontSize: '0.85rem',
            textDecoration: 'none',
            minHeight: '44px',
            lineHeight: '44px',
          }}>
            Sign In
          </Link>
        </div>
      )}

      {/* Recruiter Mode: No linked kingdom empty state */}
      {mode === 'recruiting' && user && !profile?.linked_kingdom && (
        <div style={{
          textAlign: 'center',
          padding: '2rem 1rem',
          backgroundColor: '#111111',
          borderRadius: '12px',
          border: '1px solid #2a2a2a',
          marginBottom: '1rem',
        }}>
          <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.75rem' }}>🏰</span>
          <p style={{ color: '#fff', fontSize: '0.95rem', fontWeight: '600', marginBottom: '0.3rem' }}>
            Link Your Kingshot Account
          </p>
          <p style={{ color: '#6b7280', fontSize: '0.8rem', marginBottom: '1rem', maxWidth: '400px', margin: '0 auto 1rem' }}>
            To recruit for your kingdom, you need to link your in-game account first. This tells us which kingdom you represent.
          </p>
          <Link to="/profile" style={{
            display: 'inline-block',
            padding: '0.6rem 1.5rem',
            backgroundColor: '#a855f7',
            color: '#fff',
            borderRadius: '8px',
            fontWeight: '600',
            fontSize: '0.85rem',
            textDecoration: 'none',
            minHeight: '44px',
            lineHeight: '44px',
          }}>
            Go to Profile
          </Link>
        </div>
      )}

      {/* Recruiter Mode: Editor Claiming + Dashboard Access */}
      {mode === 'recruiting' && user && profile?.linked_kingdom && (
        <div style={{
          marginBottom: '1rem',
          display: 'grid',
          gridTemplateColumns: isEditor ? '1fr 1fr' : '1fr',
          gap: '0.75rem',
          maxWidth: isMobile ? '100%' : '500px',
          margin: '0 auto 1rem',
        }}>
          <EditorClaiming onEditorActivated={() => setIsEditor(true)} />
          {isEditor && (
            <button
              onClick={() => { trackFeature('Recruiter Dashboard Open'); setShowRecruiterDash(true); }}
              style={{
                padding: '0.6rem 1rem',
                backgroundColor: '#a855f710',
                border: '1px solid #a855f730',
                borderRadius: '10px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                minHeight: '44px',
              }}
            >
              <span style={{ color: '#a855f7', fontSize: '0.75rem', fontWeight: '600' }}>
                Recruiter Dashboard
              </span>
              <span style={{
                padding: '0.15rem 0.6rem',
                backgroundColor: '#a855f720',
                border: '1px solid #a855f740',
                borderRadius: '6px',
                fontSize: '0.6rem',
                color: '#a855f7',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}>
                Open
              </span>
            </button>
          )}
        </div>
      )}

      {/* Recruiter Dashboard Modal */}
      {showRecruiterDash && (
        <RecruiterDashboard onClose={() => setShowRecruiterDash(false)} />
      )}

      {/* Kingdom Fund Contribution Modal */}
      {contributingToKingdom !== null && (
        <KingdomFundContribute
          kingdomNumber={contributingToKingdom}
          currentBalance={fundMap.get(contributingToKingdom)?.balance || 0}
          currentTier={fundMap.get(contributingToKingdom)?.tier || 'standard'}
          onClose={() => setContributingToKingdom(null)}
        />
      )}

      {/* Contribution Success Overlay */}
      {showContributionSuccess && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center',
            zIndex: 1100, padding: isMobile ? 0 : '1rem',
          }}
          onClick={() => setShowContributionSuccess(false)}
        >
          <div
            style={{
              backgroundColor: '#111111', border: '1px solid #22c55e30',
              borderRadius: isMobile ? '16px 16px 0 0' : '16px',
              padding: isMobile ? '2rem 1.5rem' : '2.5rem',
              maxWidth: '450px', width: '100%',
              textAlign: 'center',
              boxShadow: '0 0 40px #22c55e10',
              paddingBottom: isMobile ? 'max(2rem, env(safe-area-inset-bottom))' : '2.5rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              width: '60px', height: '60px', borderRadius: '50%',
              backgroundColor: '#22c55e15', border: '2px solid #22c55e40',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1rem',
              fontSize: '1.5rem',
            }}>
              ✓
            </div>
            <h2 style={{
              fontFamily: FONT_DISPLAY, fontSize: '1.3rem',
              color: '#fff', margin: '0 0 0.5rem 0',
            }}>
              Contribution Successful!
            </h2>
            <p style={{ color: '#9ca3af', fontSize: '0.9rem', margin: '0 0 0.75rem 0', lineHeight: 1.5 }}>
              Thank you for supporting your kingdom's Transfer Hub listing.
              Your contribution helps the fund grow and unlocks better listing features.
            </p>
            <div style={{
              padding: '0.75rem', backgroundColor: '#0a0a0a',
              borderRadius: '10px', border: '1px solid #2a2a2a',
              marginBottom: '1rem',
            }}>
              <span style={{ color: '#6b7280', fontSize: '0.7rem' }}>What happens next?</span>
              <ul style={{ color: '#d1d5db', fontSize: '0.8rem', margin: '0.5rem 0 0 0', padding: '0 0 0 1.2rem', lineHeight: 1.8, textAlign: 'left' }}>
                <li>Your payment is processed by Stripe</li>
                <li>The kingdom fund balance is updated automatically</li>
                <li>If the fund reaches a new tier, the listing upgrades</li>
                <li>Fund depletes ~$5/week to stay active</li>
              </ul>
            </div>
            <button
              onClick={() => setShowContributionSuccess(false)}
              style={{
                padding: '0.6rem 2rem',
                backgroundColor: '#22c55e15',
                border: '1px solid #22c55e40',
                borderRadius: '10px',
                color: '#22c55e',
                fontWeight: '600',
                fontSize: '0.9rem',
                cursor: 'pointer',
                minHeight: '44px',
              }}
            >
              Continue Browsing
            </button>
          </div>
        </div>
      )}

      {/* Recommended Kingdoms (transferring mode, profile exists) */}
      {mode === 'transferring' && hasTransferProfile && transferProfile && !loading && topMatches.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem' }}>🎯</span>
            <span style={{ color: '#22c55e', fontSize: '0.8rem', fontWeight: '600' }}>Top Matches For You</span>
            <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>based on your Transfer Profile</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {topMatches.map(({ kingdom, fund, score, details }) => (
              <KingdomListingCard
                key={`rec-${kingdom.kingdom_number}`}
                kingdom={kingdom}
                fund={fund}
                reviewSummary={reviewMap.get(kingdom.kingdom_number) || null}
                mode={mode}
                matchScore={score}
                matchDetails={details}
                onApply={(kn) => requireAuth(() => { trackFeature('Transfer Apply Click', { kingdom: kn, source: 'recommended' }); setApplyingToKingdom(kn); })}
                onFund={(kn) => requireAuth(() => { trackFeature('Transfer Fund Click', { kingdom: kn }); setContributingToKingdom(kn); })}
              />
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '0.75rem 0 0 0', color: '#4b5563', fontSize: '0.7rem' }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#2a2a2a' }} />
            <span>All Kingdoms</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#2a2a2a' }} />
          </div>
        </div>
      )}

      {/* Search + Filters (hidden in Recruiting mode) */}
      {mode !== 'recruiting' && (
        <div style={{ marginBottom: '1rem' }}>
          <FilterPanel filters={filters} onChange={setFilters} mode={mode} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
          {/* Kingdom and Recruiting Counts */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'flex-end', 
            gap: '1rem', 
            color: colors.textSecondary, 
            fontSize: '0.75rem',
            marginTop: '0.5rem',
            paddingRight: '0.5rem'
          }}>
            <span>{filteredKingdoms.length} kingdoms</span>
            <span>{funds.filter((f) => f.is_recruiting).length} recruiting</span>
          </div>
        </div>
      )}

      {/* Transfer Group Banner */}
      {TRANSFER_GROUPS_ACTIVE && (
        <div style={{
          padding: '0.6rem 1rem',
          backgroundColor: '#22d3ee08',
          border: '1px solid #22d3ee20',
          borderRadius: '10px',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.8rem',
        }}>
          <span style={{ fontSize: '1rem' }}>🔀</span>
          {userTransferGroup ? (
            <span style={{ color: colors.textSecondary }}>
              <span style={{ color: '#22d3ee', fontWeight: '600' }}>Transfer Group Active</span>
              {' — '}Showing kingdoms {userTransferGroup[0]}–{userTransferGroup[1]} (your group)
            </span>
          ) : (
            <span style={{ color: colors.textSecondary }}>
              <span style={{ color: '#eab308', fontWeight: '600' }}>Transfer Groups Active</span>
              {' — '}<Link to="/profile" style={{ color: '#22d3ee', textDecoration: 'underline' }}>Link your kingdom</Link> to see only your transfer group
            </span>
          )}
        </div>
      )}

      {/* Kingdom Listings */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{
              backgroundColor: '#111111',
              borderRadius: '12px',
              border: '1px solid #2a2a2a',
              padding: '1rem',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: '#1a1a1a' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: '14px', width: '120px', backgroundColor: '#1a1a1a', borderRadius: '4px', marginBottom: '6px' }} />
                  <div style={{ height: '10px', width: '80px', backgroundColor: '#1a1a1a', borderRadius: '4px' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} style={{ flex: 1, height: '36px', backgroundColor: '#1a1a1a', borderRadius: '6px' }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '0.75rem',
          transition: 'opacity 0.2s ease',
          opacity: 1,
        }}>
          {/* Funded kingdoms first */}
          {kingdomsWithFunds.map((kingdom) => {
            const fund = fundMap.get(kingdom.kingdom_number) || null;
            const matchResult = mode === 'transferring' ? calculateMatchScore(kingdom, fund) : undefined;
            return (
              <KingdomListingCard
                key={kingdom.kingdom_number}
                kingdom={kingdom}
                fund={fund}
                reviewSummary={reviewMap.get(kingdom.kingdom_number) || null}
                mode={mode}
                matchScore={matchResult?.score}
                matchDetails={matchResult?.details}
                onApply={(kn) => requireAuth(() => { trackFeature('Transfer Apply Click', { kingdom: kn }); setApplyingToKingdom(kn); })}
                onFund={(kn) => requireAuth(() => { trackFeature('Transfer Fund Click', { kingdom: kn }); setContributingToKingdom(kn); })}
              />
            );
          })}

          {/* Separator if both groups exist */}
          {kingdomsWithFunds.length > 0 && kingdomsWithoutFunds.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '1rem',
              margin: '0.5rem 0', color: '#4b5563', fontSize: '0.75rem',
            }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#2a2a2a' }} />
              <span>Standard Listings</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#2a2a2a' }} />
            </div>
          )}

          {/* Standard (unfunded) kingdoms — infinite scroll */}
          {kingdomsWithoutFunds.slice(0, visibleCount).map((kingdom) => {
            const fund = null;
            const matchResult = mode === 'transferring' ? calculateMatchScore(kingdom, fund) : undefined;
            return (
              <KingdomListingCard
                key={kingdom.kingdom_number}
                kingdom={kingdom}
                fund={fund}
                reviewSummary={reviewMap.get(kingdom.kingdom_number) || null}
                mode={mode}
                matchScore={matchResult?.score}
                matchDetails={matchResult?.details}
                onApply={(kn) => requireAuth(() => { trackFeature('Transfer Apply Click', { kingdom: kn }); setApplyingToKingdom(kn); })}
                onFund={(kn) => requireAuth(() => { trackFeature('Transfer Fund Click', { kingdom: kn }); setContributingToKingdom(kn); })}
              />
            );
          })}

          {/* Infinite scroll sentinel */}
          {visibleCount < kingdomsWithoutFunds.length && (
            <div ref={sentinelRef} style={{ padding: '1.5rem 0', textAlign: 'center' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                color: '#6b7280', fontSize: '0.8rem',
              }}>
                <div style={{
                  width: '16px', height: '16px',
                  border: '2px solid #2a2a2a', borderTopColor: '#22d3ee',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }} />
                Loading more kingdoms...
              </div>
            </div>
          )}

          {filteredKingdoms.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '3rem 1rem',
              backgroundColor: '#111111', borderRadius: '16px',
              border: '1px solid #2a2a2a',
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem', opacity: 0.6 }}>🔍</div>
              <p style={{ fontSize: '1.1rem', marginBottom: '0.4rem', color: '#d1d5db', fontWeight: '600' }}>No kingdoms match your filters</p>
              <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1rem' }}>Try adjusting your filters or clearing them to see all kingdoms.</p>
              <button
                onClick={() => setFilters(defaultFilters)}
                style={{
                  padding: '0.5rem 1.25rem', backgroundColor: '#22d3ee15',
                  border: '1px solid #22d3ee30', borderRadius: '8px',
                  color: '#22d3ee', fontSize: '0.8rem', fontWeight: '600',
                  cursor: 'pointer', minHeight: '44px',
                }}
              >
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      )}
      {/* Auth Gate Modal */}
      {showAuthGate && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center',
            zIndex: 1100, padding: isMobile ? 0 : '1rem',
          }}
          onClick={() => setShowAuthGate(null)}
        >
          <div
            style={{
              backgroundColor: '#111111', border: '1px solid #22d3ee30',
              borderRadius: isMobile ? '16px 16px 0 0' : '16px',
              padding: isMobile ? '2rem 1.5rem' : '2.5rem',
              maxWidth: '420px', width: '100%',
              textAlign: 'center',
              paddingBottom: isMobile ? 'max(2rem, env(safe-area-inset-bottom))' : '2.5rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              width: '50px', height: '50px', borderRadius: '50%',
              backgroundColor: '#22d3ee10', border: '2px solid #22d3ee30',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1rem', fontSize: '1.3rem',
            }}>
              {showAuthGate === 'login' ? '🔒' : '🔗'}
            </div>
            <h2 style={{
              fontFamily: FONT_DISPLAY, fontSize: '1.1rem',
              color: '#fff', margin: '0 0 0.5rem 0',
            }}>
              {showAuthGate === 'login' ? 'Sign In Required' : 'Link Your Account'}
            </h2>
            <p style={{ color: '#9ca3af', fontSize: '0.85rem', margin: '0 0 1.25rem 0', lineHeight: 1.5 }}>
              {showAuthGate === 'login'
                ? 'Sign in to apply for transfers, create your profile, and manage recruitment.'
                : 'Link your Kingshot account to apply for transfers and access all Transfer Hub features.'}
            </p>
            <Link
              to={showAuthGate === 'login' ? '/auth' : '/profile'}
              style={{
                display: 'inline-block', padding: '0.6rem 1.5rem',
                backgroundColor: '#22d3ee', color: '#000', borderRadius: '8px',
                fontWeight: '600', fontSize: '0.85rem', textDecoration: 'none',
                minHeight: '44px', lineHeight: '44px',
              }}
              onClick={() => setShowAuthGate(null)}
            >
              {showAuthGate === 'login' ? 'Sign In' : 'Go to Profile'}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransferBoard;
