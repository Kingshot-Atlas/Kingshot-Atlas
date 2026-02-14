import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useAnalytics } from '../hooks/useAnalytics';
import { supabase } from '../lib/supabase';
import TransferProfileForm from '../components/TransferProfileForm';
import { ApplyModal, MyApplicationsTracker } from '../components/TransferApplications';
import RecruiterDashboard from '../components/RecruiterDashboard';
import EditorClaiming from '../components/EditorClaiming';
import { logger } from '../utils/logger';
import KingdomFundContribute from '../components/KingdomFundContribute';
import { useTranslation } from 'react-i18next';
import { neonGlow, FONT_DISPLAY, colors } from '../utils/styles';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useMetaTags, PAGE_META_TAGS } from '../hooks/useMetaTags';
import { useStructuredData, PAGE_BREADCRUMBS } from '../hooks/useStructuredData';
import KingdomListingCard, { KingdomData, KingdomFund, KingdomReviewSummary, BoardMode, MatchDetail } from '../components/KingdomListingCard';
import { useScrollDepth } from '../hooks/useScrollDepth';
import TransferHubGuide from '../components/TransferHubGuide';
import EntryModal from '../components/transfer/EntryModal';
import ModeToggle from '../components/transfer/ModeToggle';
import FilterPanel, { FilterState, defaultFilters } from '../components/transfer/FilterPanel';
import { useToast } from '../components/Toast';
import KingdomCompare from '../components/transfer/KingdomCompare';
import EndorsementOverlay from '../components/transfer/EndorsementOverlay';
import TransferProfileCTA from '../components/transfer/TransferProfileCTA';
import ContributionSuccessModal from '../components/transfer/ContributionSuccessModal';
import TransferAuthGate from '../components/transfer/TransferAuthGate';
import { TRANSFER_GROUPS, getTransferGroup, getTransferGroupOptions, areTransferGroupsOutdated, getTransferGroupLabel } from '../config/transferGroups';
import { calculateMatchScore as calcMatchScore, calculateMatchScoreForSort as calcMatchScoreForSort } from '../utils/matchScore';

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

// Transfer Groups are now imported from ../config/transferGroups.ts
// Update that file when new event groups are announced.

// EntryModal and ModeToggle extracted to ../components/transfer/

// FilterPanel, FilterState, defaultFilters extracted to ../components/transfer/FilterPanel

// AllianceEventTimesGrid and KingdomListingCard are now in ../components/KingdomListingCard.tsx
// (removed ~830 lines of inline component code)

// =============================================
// MAIN TRANSFER HUB PAGE
// =============================================

const TransferBoard: React.FC = () => {
  useStructuredData({ type: 'BreadcrumbList', data: PAGE_BREADCRUMBS.transferHub });
  useScrollDepth('Transfer Hub');
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const isMobile = useIsMobile();
  const { trackFeature } = useAnalytics();
  const { showToast } = useToast();

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
  const [newAppCount, setNewAppCount] = useState(0);
  const [pendingCoEditorCount, setPendingCoEditorCount] = useState(0);
  const [contributingToKingdom, setContributingToKingdom] = useState<number | null>(null);
  const [showContributionSuccess, setShowContributionSuccess] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [activeTransfereeCount, setActiveTransfereeCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedKingdom, setHighlightedKingdom] = useState<number | null>(null);
  const [profileViewCount, setProfileViewCount] = useState(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [showAuthGate, setShowAuthGate] = useState<'login' | 'link' | null>(null);
  const [endorseClaimId, setEndorseClaimId] = useState<string | null>(null);
  const [endorseClaimData, setEndorseClaimData] = useState<{
    id: string;
    kingdom_number: number;
    status: string;
    endorsement_count: number;
    required_endorsements: number;
    nominee_username: string;
    nominee_linked_username: string | null;
  } | null>(null);
  const [endorseLoading, setEndorseLoading] = useState(false);
  const [compareKingdoms, setCompareKingdoms] = useState<Set<number>>(new Set());
  const [showCompareModal, setShowCompareModal] = useState(false);

  useDocumentTitle(
    highlightedKingdom
      ? `${t('common.kingdom', 'Kingdom')} ${highlightedKingdom} Transfer Listing — Kingshot Atlas`
      : endorseClaimData
        ? `Endorse for K${endorseClaimData.kingdom_number} — Kingshot Atlas`
        : t('nav.transferHub', 'Transfer Hub')
  );
  useMetaTags(
    highlightedKingdom ? {
      title: `Kingdom ${highlightedKingdom} Transfer Listing — Kingshot Atlas`,
      description: `View Kingdom ${highlightedKingdom}'s transfer listing on the Kingshot Atlas Transfer Hub. Check stats, recruitment info, and apply to transfer.`,
      url: `https://ks-atlas.com/transfer-hub?kingdom=${highlightedKingdom}`,
      image: 'https://ks-atlas.com/Atlas%20Logo.png',
      type: 'article',
    } : endorseClaimData ? {
      title: `Endorse ${endorseClaimData.nominee_linked_username || endorseClaimData.nominee_username} for Kingdom ${endorseClaimData.kingdom_number} — Kingshot Atlas`,
      description: `${endorseClaimData.nominee_linked_username || endorseClaimData.nominee_username} is running for Kingdom ${endorseClaimData.kingdom_number} editor. ${endorseClaimData.endorsement_count}/${endorseClaimData.required_endorsements} endorsements so far. Your vote matters.`,
      url: `https://ks-atlas.com/transfer-hub?endorse=${endorseClaimData.id}`,
      image: 'https://ks-atlas.com/Atlas%20Logo.png',
      type: 'article',
    } : PAGE_META_TAGS.transferHub
  );

  // Track page view
  useEffect(() => {
    trackFeature('Transfer Hub');
  }, [trackFeature]);

  // Handle URL parameters: ?fund=N opens contribution modal, ?contributed=true shows success toast, ?endorse=ID opens endorsement
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fundParam = params.get('fund');
    const contributed = params.get('contributed');
    const endorseParam = params.get('endorse');

    const kingdomParam = params.get('kingdom');
    const refParam = params.get('ref');

    // Track referral landing if ?ref= is present
    if (refParam) {
      trackFeature('Transfer Hub Referral Landing', { referrer: refParam, kingdom: kingdomParam || 'none' });
    }

    if (contributed === 'true') {
      setShowContributionSuccess(true);
    }

    if (fundParam) {
      const kn = parseInt(fundParam, 10);
      if (!isNaN(kn) && kn > 0) {
        setContributingToKingdom(kn);
      }
    }

    if (kingdomParam) {
      const kn = parseInt(kingdomParam, 10);
      if (!isNaN(kn) && kn > 0) {
        setHighlightedKingdom(kn);
        // Skip entry modal when arriving via direct kingdom link
        setShowEntryModal(false);
      }
    }

    if (endorseParam) {
      setEndorseClaimId(endorseParam);
      // Clear any stored pending endorsement since we have it in URL
      localStorage.removeItem('atlas_pending_endorsement');
    } else {
      // Check localStorage for pending endorsement (from auth redirect flow)
      const stored = localStorage.getItem('atlas_pending_endorsement');
      if (stored) {
        setEndorseClaimId(stored);
        localStorage.removeItem('atlas_pending_endorsement');
      }
    }

    // Clean non-endorse URL params (keep endorse for auth redirect flow)
    if (fundParam || contributed) {
      params.delete('fund');
      params.delete('contributed');
      const newUrl = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  // Fetch endorsement claim details when endorseClaimId is set
  useEffect(() => {
    const fetchEndorseClaim = async () => {
      if (!supabase || !endorseClaimId) return;
      setEndorseLoading(true);
      try {
        const { data: claim, error } = await supabase
          .from('kingdom_editors')
          .select('id, kingdom_number, user_id, status, endorsement_count, required_endorsements')
          .eq('id', endorseClaimId)
          .single();

        if (error || !claim) {
          setEndorseClaimData(null);
          return;
        }

        // Fetch nominee's profile
        const { data: nomineeProfile } = await supabase
          .from('profiles')
          .select('username, linked_username')
          .eq('id', claim.user_id)
          .single();

        setEndorseClaimData({
          id: claim.id,
          kingdom_number: claim.kingdom_number,
          status: claim.status,
          endorsement_count: claim.endorsement_count,
          required_endorsements: claim.required_endorsements,
          nominee_username: nomineeProfile?.username || 'Unknown',
          nominee_linked_username: nomineeProfile?.linked_username || null,
        });
      } catch (err) {
        logger.error('Error fetching endorsement claim:', err);
        setEndorseClaimData(null);
      } finally {
        setEndorseLoading(false);
      }
    };
    fetchEndorseClaim();
  }, [endorseClaimId, user]);

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
        .maybeSingle();
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
        .select('id, kingdom_number')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();
      setIsEditor(!!data);
      if (data?.kingdom_number) {
        // Fetch pending application count for badge
        const { count } = await supabase
          .from('transfer_applications')
          .select('*', { count: 'exact', head: true })
          .eq('kingdom_number', data.kingdom_number)
          .eq('status', 'pending');
        setNewAppCount(count || 0);
        // Fetch pending co-editor request count for badge
        const { count: coEditorCount } = await supabase
          .from('kingdom_editors')
          .select('*', { count: 'exact', head: true })
          .eq('kingdom_number', data.kingdom_number)
          .eq('role', 'co-editor')
          .eq('status', 'pending');
        setPendingCoEditorCount(coEditorCount || 0);
      }
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
        logger.error('Transfer Hub data load error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Ensure highlighted kingdom is visible in the unfunded list (expand visibleCount if needed)
  useEffect(() => {
    if (!highlightedKingdom || loading || kingdoms.length === 0) return;
    // Check if the kingdom is in the unfunded list and beyond visibleCount
    const unfundedIndex = kingdomsWithoutFunds.findIndex(k => k.kingdom_number === highlightedKingdom);
    if (unfundedIndex >= 0 && unfundedIndex >= visibleCount) {
      setVisibleCount(unfundedIndex + 5);
    }
  }, [highlightedKingdom, loading, kingdoms.length]);

  // Scroll to highlighted kingdom card after data loads + recruiting toast + conversion tracking
  useEffect(() => {
    if (!highlightedKingdom || loading) return;

    // Track shared link landing
    trackFeature('Transfer Listing Shared Link', { kingdom: highlightedKingdom, authenticated: !!user });

    // Show recruiting toast if the kingdom is actively recruiting
    const highlightedFund = fundMap.get(highlightedKingdom);
    if (highlightedFund?.is_recruiting) {
      showToast(`Kingdom ${highlightedKingdom} is actively recruiting! Check their listing below.`, 'info');
    }

    // Small delay to let DOM render the cards
    const timer = setTimeout(() => {
      const el = document.getElementById(`listing-${highlightedKingdom}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [highlightedKingdom, loading]);

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

  // Determine user's transfer group (always active — groups come from central config)
  const userTransferGroup = useMemo(() => {
    if (!profile?.linked_kingdom) return null;
    return getTransferGroup(profile.linked_kingdom);
  }, [profile?.linked_kingdom]);

  // Transfer group filter state (for manual selection when not linked)
  const [transferGroupFilter, setTransferGroupFilter] = useState<string>('auto');

  // Effective transfer group for filtering
  const effectiveTransferGroup = useMemo(() => {
    if (transferGroupFilter === 'all') return null;
    if (transferGroupFilter === 'auto' && userTransferGroup) return userTransferGroup;
    if (transferGroupFilter !== 'auto' && transferGroupFilter !== 'all') {
      const parts = transferGroupFilter.split('-');
      const min = parseInt(parts[0] || '', 10);
      const max = parseInt(parts[1] || '', 10);
      if (!isNaN(min) && !isNaN(max)) return [min, max] as [number, number];
    }
    return null;
  }, [transferGroupFilter, userTransferGroup]);

  const transferGroupsOutdated = areTransferGroupsOutdated();

  // Match score for sorting — delegated to utils/matchScore.ts
  const calculateMatchScoreForSort = (kingdom: KingdomData, fund: KingdomFund | null): number =>
    calcMatchScoreForSort(kingdom, fund, transferProfile);

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

    // Transfer group filter — show kingdoms in selected/auto transfer group
    if (mode === 'transferring' && effectiveTransferGroup) {
      const [min, max] = effectiveTransferGroup;
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
          const aFund = fundMap.get(a.kingdom_number);
          const bFund = fundMap.get(b.kingdom_number);
          const aTier = aFund?.tier || 'standard';
          const bTier = bFund?.tier || 'standard';
          const tierDiff = (tierOrder[aTier as keyof typeof tierOrder] || 3) - (tierOrder[bTier as keyof typeof tierOrder] || 3);
          if (tierDiff !== 0) return tierDiff;
          // Within same tier, higher fund balance gets priority
          const balanceDiff = (bFund?.balance || 0) - (aFund?.balance || 0);
          if (balanceDiff !== 0) return balanceDiff;
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

  // Match score with details — delegated to utils/matchScore.ts
  const calculateMatchScore = (kingdom: KingdomData, fund: KingdomFund | null): { score: number; details: MatchDetail[] } =>
    calcMatchScore(kingdom, fund, transferProfile);

  // Auth helpers — browsing is open to all, actions require login + linked account
  const hasLinkedAccount = !!profile?.linked_player_id;
  const requireAuth = (action: () => void) => {
    if (!user) { setShowAuthGate('login'); return; }
    if (!hasLinkedAccount) { setShowAuthGate('link'); return; }
    action();
  };

  // Pre-computed match scores for all filtered kingdoms (avoids recalculating in render loop)
  const matchScoreMap = useMemo(() => {
    if (mode !== 'transferring' || !transferProfile) return new Map<number, { score: number; details: MatchDetail[] }>();
    const map = new Map<number, { score: number; details: MatchDetail[] }>();
    for (const k of filteredKingdoms) {
      const fund = fundMap.get(k.kingdom_number) || null;
      map.set(k.kingdom_number, calculateMatchScore(k, fund));
    }
    return map;
  }, [filteredKingdoms, fundMap, transferProfile, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Memoized top matches for Recommended Kingdoms section
  const topMatches = useMemo(() => {
    if (!transferProfile || mode !== 'transferring') return [];
    return filteredKingdoms
      .map(k => {
        const f = fundMap.get(k.kingdom_number) || null;
        const result = matchScoreMap.get(k.kingdom_number) || { score: 0, details: [] };
        return { kingdom: k, fund: f, score: result.score, details: result.details };
      })
      .filter(m => m.score >= 50)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [filteredKingdoms, fundMap, transferProfile, mode, matchScoreMap]);

  const kingdomsWithFunds = useMemo(() => {
    const funded = filteredKingdoms.filter((k) => fundMap.has(k.kingdom_number));
    const tierOrder: Record<string, number> = { gold: 0, silver: 1, bronze: 2, standard: 3 };
    return funded.sort((a, b) => {
      const aTier = fundMap.get(a.kingdom_number)?.tier || 'standard';
      const bTier = fundMap.get(b.kingdom_number)?.tier || 'standard';
      const tierDiff = (tierOrder[aTier] ?? 3) - (tierOrder[bTier] ?? 3);
      if (tierDiff !== 0) return tierDiff;
      return 0;
    });
  }, [filteredKingdoms, fundMap]);
  const kingdomsWithoutFunds = useMemo(() => filteredKingdoms.filter((k) => !fundMap.has(k.kingdom_number)), [filteredKingdoms, fundMap]);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: isMobile ? '0 0.25rem' : 0 }}>
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
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
            <span style={{ color: '#fff' }}>{t('transferHub.heroTitle1', 'TRANSFER')}</span>
            <span style={{ ...neonGlow('#22d3ee'), marginLeft: '0.5rem', fontSize: isMobile ? '1.6rem' : '2.25rem' }}>{t('transferHub.heroTitle2', 'HUB')}</span>
          </h1>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.8rem' : '0.9rem', marginBottom: '0.25rem' }}>
            {t('transferHub.heroSubtitle', 'No more blind transfers.')}
          </p>
          <p style={{ color: '#6b7280', fontSize: isMobile ? '0.7rem' : '0.8rem', marginBottom: '0.75rem' }}>
            {t('transferHub.heroDesc', 'Find the perfect kingdom for you — or the best recruits.')}
          </p>
          {!isMobile && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div style={{ width: '50px', height: '2px', background: 'linear-gradient(90deg, transparent, #22d3ee)' }} />
              <div style={{ width: '6px', height: '6px', backgroundColor: '#22d3ee', transform: 'rotate(45deg)', boxShadow: '0 0 8px #22d3ee' }} />
              <div style={{ width: '50px', height: '2px', background: 'linear-gradient(90deg, #22d3ee, transparent)' }} />
            </div>
          )}
        </div>
      </div>

      {/* Shared Link CTA for unauthenticated users */}
      {highlightedKingdom && !user && (
        <div style={{
          padding: isMobile ? '1rem' : '1.25rem 1.5rem',
          marginBottom: '1rem',
          backgroundColor: '#22d3ee08',
          border: '1px solid #22d3ee20',
          borderRadius: '12px',
          display: 'flex',
          alignItems: isMobile ? 'flex-start' : 'center',
          gap: isMobile ? '0.75rem' : '1rem',
          flexDirection: isMobile ? 'column' : 'row',
          animation: 'fadeSlideUp 0.5s ease-out',
        }}>
          <div style={{ flex: 1 }}>
            <p style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '600', margin: '0 0 0.25rem 0' }}>
              {t('transferHub.interestedIn', 'Interested in Kingdom {{num}}?', { num: highlightedKingdom })}
            </p>
            <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: 0, lineHeight: 1.5 }}>
              {t('transferHub.signInCta', 'Sign in and create your Transfer Profile to apply directly. Recruiters will see your stats and reach out.')}
            </p>
          </div>
          <Link to="/auth" style={{
            padding: '0.5rem 1.25rem',
            backgroundColor: '#22d3ee',
            color: '#000',
            borderRadius: '8px',
            fontWeight: '700',
            fontSize: '0.85rem',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            minHeight: '44px',
            display: 'inline-flex',
            alignItems: 'center',
          }}>
            {t('transferHub.signUpToApply', 'Sign Up to Apply')}
          </Link>
        </div>
      )}

      {/* How It Works Guide */}
      <TransferHubGuide />

      {/* Mode Toggle — right below guide */}
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
        <ModeToggle mode={mode} onChange={handleModeChange} />
      </div>

      {/* Transfer Hub Stats */}
      {!loading && (
        <div style={{
          display: 'flex',
          gap: isMobile ? '0.5rem' : '0.75rem',
          marginBottom: '1rem',
          justifyContent: 'center',
        }}>
          {[
            { label: t('transferHub.kingdoms', 'Kingdoms'), value: kingdoms.length, icon: '🏰' },
            { label: t('transferHub.recruiting', 'Recruiting'), value: funds.filter(f => f.is_recruiting).length, icon: '📢', color: '#22c55e' },
            { label: t('transferHub.transferees', 'Transferees'), value: activeTransfereeCount, icon: '🚀', color: '#22d3ee' },
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

      {/* Transfer Profile CTA (only in transferring mode) */}
      {mode === 'transferring' && (
        <TransferProfileCTA
          hasTransferProfile={hasTransferProfile}
          transferProfile={transferProfile}
          profileViewCount={profileViewCount}
          activeAppCount={activeAppCount}
          isMobile={isMobile}
          onEditProfile={(scrollToInc) => requireAuth(() => { setScrollToIncomplete(scrollToInc); setShowProfileForm(true); })}
        />
      )}

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
            {t('transferHub.signInToRecruit', 'Sign In to Recruit')}
          </p>
          <p style={{ color: '#6b7280', fontSize: '0.8rem', marginBottom: '1rem', maxWidth: '400px', margin: '0 auto 1rem' }}>
            {t('transferHub.signInRecruitDesc', 'Sign in and link your Kingshot account to claim your kingdom, set up your listing, and review transfer applications.')}
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
            {t('common.signIn', 'Sign In')}
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
            {t('transferHub.linkAccount', 'Link Your Kingshot Account')}
          </p>
          <p style={{ color: '#6b7280', fontSize: '0.8rem', marginBottom: '1rem', maxWidth: '400px', margin: '0 auto 1rem' }}>
            {t('transferHub.linkAccountDesc', 'To recruit for your kingdom, you need to link your in-game account first. This tells us which kingdom you represent.')}
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
            {t('transferHub.goToProfile', 'Go to Profile')}
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
              onClick={() => {
                trackFeature('Recruiter Dashboard Open');
                setShowRecruiterDash(true);
                setNewAppCount(0);
                // Track weekly streak
                const now = new Date();
                const weekKey = `${now.getFullYear()}-W${Math.ceil(((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000 + new Date(now.getFullYear(), 0, 1).getDay() + 1) / 7)}`;
                const streakData = JSON.parse(localStorage.getItem('atlas_editor_streak') || '{"weeks":[],"current":0}');
                if (!streakData.weeks.includes(weekKey)) {
                  streakData.weeks.push(weekKey);
                  // Calculate current streak
                  const sorted = streakData.weeks.sort().reverse();
                  let streak = 1;
                  for (let i = 1; i < sorted.length; i++) {
                    const [y1, w1] = sorted[i - 1].split('-W').map(Number);
                    const [y2, w2] = sorted[i].split('-W').map(Number);
                    if ((y1 === y2 && w1 - w2 === 1) || (y1 - y2 === 1 && w2 === 52 && w1 === 1)) {
                      streak++;
                    } else break;
                  }
                  streakData.current = streak;
                  localStorage.setItem('atlas_editor_streak', JSON.stringify(streakData));
                }
              }}
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
                position: 'relative',
              }}
            >
              <span style={{ color: '#a855f7', fontSize: '0.75rem', fontWeight: '600' }}>
                {t('transferHub.recruiterDashboard', 'Recruiter Dashboard')}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
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
                  {t('transferHub.open', 'Open')}
                </span>
                {(() => {
                  const streakData = JSON.parse(localStorage.getItem('atlas_editor_streak') || '{"weeks":[],"current":0}');
                  return streakData.current >= 2 ? (
                    <span style={{
                      padding: '0.1rem 0.35rem',
                      backgroundColor: '#f9731615',
                      border: '1px solid #f9731630',
                      borderRadius: '4px',
                      fontSize: '0.55rem',
                      color: '#f97316',
                      fontWeight: '700',
                    }}>
                      🔥 {streakData.current}w
                    </span>
                  ) : null;
                })()}
              </div>
              {(newAppCount > 0 || pendingCoEditorCount > 0) && (
                <div style={{ position: 'absolute', top: '-4px', right: '-4px', display: 'flex', gap: '0.2rem' }}>
                  {newAppCount > 0 && (
                    <span style={{
                      backgroundColor: '#ef4444',
                      color: '#fff',
                      fontSize: '0.6rem',
                      fontWeight: '700',
                      borderRadius: '999px',
                      padding: '0.1rem 0.35rem',
                      minWidth: '16px',
                      textAlign: 'center',
                      lineHeight: '1.2',
                      boxShadow: '0 2px 6px rgba(239,68,68,0.4)',
                    }}>
                      {newAppCount > 9 ? '9+' : newAppCount}
                    </span>
                  )}
                  {pendingCoEditorCount > 0 && (
                    <span style={{
                      backgroundColor: '#a855f7',
                      color: '#fff',
                      fontSize: '0.6rem',
                      fontWeight: '700',
                      borderRadius: '999px',
                      padding: '0.1rem 0.35rem',
                      minWidth: '16px',
                      textAlign: 'center',
                      lineHeight: '1.2',
                      boxShadow: '0 2px 6px rgba(168,85,247,0.4)',
                    }}>
                      {pendingCoEditorCount > 9 ? '9+' : pendingCoEditorCount}
                    </span>
                  )}
                </div>
              )}
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
        <ContributionSuccessModal
          isMobile={isMobile}
          onClose={() => setShowContributionSuccess(false)}
        />
      )}

      {/* Recommended Kingdoms (transferring mode, profile exists) */}
      {mode === 'transferring' && hasTransferProfile && transferProfile && !loading && topMatches.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem' }}>🎯</span>
            <span style={{ color: '#22c55e', fontSize: '0.8rem', fontWeight: '600' }}>{t('transferHub.topMatches', 'Top Matches For You')}</span>
            <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>{t('transferHub.basedOnProfile', 'based on your Transfer Profile')}</span>
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
                highlighted={highlightedKingdom === kingdom.kingdom_number}
              />
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '0.75rem 0 0 0', color: '#4b5563', fontSize: '0.7rem' }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#2a2a2a' }} />
            <span>{t('transferHub.allKingdoms', 'All Kingdoms')}</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#2a2a2a' }} />
          </div>
        </div>
      )}

      {/* Search + Filters — sticky when scrolling (hidden in Recruiting mode) */}
      {mode !== 'recruiting' && (
        <div style={{
          position: 'sticky',
          top: '56px',
          zIndex: 90,
          backgroundColor: '#0a0a0a',
          paddingTop: '0.5rem',
          paddingBottom: '0.5rem',
          marginBottom: '0.5rem',
          marginLeft: isMobile ? '-0.25rem' : 0,
          marginRight: isMobile ? '-0.25rem' : 0,
          paddingLeft: isMobile ? '0.25rem' : 0,
          paddingRight: isMobile ? '0.25rem' : 0,
          borderBottom: '1px solid #1a1a1a',
        }}>
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
            <span>{filteredKingdoms.length} {t('transferHub.kingdoms', 'Kingdoms').toLowerCase()}</span>
            <span>{funds.filter((f) => f.is_recruiting).length} {t('transferHub.recruiting', 'Recruiting').toLowerCase()}</span>
          </div>
        </div>
      )}

      {/* Transfer Group Filter — shown in "I'm Transferring" mode */}
      {mode === 'transferring' && TRANSFER_GROUPS.length > 0 && (
        <div style={{
          padding: '0.75rem 1rem',
          backgroundColor: '#22d3ee08',
          border: '1px solid #22d3ee20',
          borderRadius: '10px',
          marginBottom: '1rem',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: '1rem' }}>🔀</span>
            <span style={{ color: '#22d3ee', fontWeight: '600', fontSize: '0.8rem' }}>
              {t('transferHub.transferGroup', 'Transfer Group')}
            </span>
            <select
              value={transferGroupFilter}
              onChange={(e) => setTransferGroupFilter(e.target.value)}
              style={{
                padding: '0.35rem 0.6rem',
                backgroundColor: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                color: colors.text,
                fontSize: isMobile ? '1rem' : '0.8rem',
                minHeight: '36px',
                cursor: 'pointer',
              }}
            >
              {userTransferGroup && (
                <option value="auto">
                  {t('transferHub.myGroup', 'My Group')} ({getTransferGroupLabel(userTransferGroup)})
                </option>
              )}
              <option value="all">{t('transferHub.allGroups', 'All Groups')}</option>
              {getTransferGroupOptions().map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {effectiveTransferGroup && (
              <span style={{ color: colors.textSecondary, fontSize: '0.75rem' }}>
                — {t('transferHub.showingKingdoms', 'Showing kingdoms')} {effectiveTransferGroup[0]}–{effectiveTransferGroup[1]}
              </span>
            )}
            {!userTransferGroup && (
              <Link to="/profile" style={{ color: '#22d3ee', textDecoration: 'underline', fontSize: '0.75rem', marginLeft: '0.25rem' }}>
                {t('transferHub.linkKingdom', 'Link your kingdom for auto-filter')}
              </Link>
            )}
          </div>
          {transferGroupsOutdated && (
            <div style={{
              marginTop: '0.5rem',
              padding: '0.35rem 0.6rem',
              backgroundColor: '#eab30810',
              border: '1px solid #eab30825',
              borderRadius: '6px',
              fontSize: '0.7rem',
              color: '#eab308',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}>
              <span>⚠️</span>
              {t('transferHub.groupsOutdated', 'These groups are from the last Transfer Event and may change before the next one.')}
            </div>
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
            const matchResult = matchScoreMap.get(kingdom.kingdom_number);
            return (
              <KingdomListingCard
                key={kingdom.kingdom_number}
                kingdom={kingdom}
                fund={fund}
                reviewSummary={reviewMap.get(kingdom.kingdom_number) || null}
                mode={mode}
                matchScore={matchResult?.score}
                matchDetails={matchResult?.details}
                onApply={(kn) => requireAuth(() => { trackFeature('Transfer Apply Click', { kingdom: kn, ...(highlightedKingdom === kn ? { source: 'shared_link' } : {}) }); setApplyingToKingdom(kn); })}
                onFund={(kn) => requireAuth(() => { trackFeature('Transfer Fund Click', { kingdom: kn }); setContributingToKingdom(kn); })}
                highlighted={highlightedKingdom === kingdom.kingdom_number}
                isComparing={compareKingdoms.has(kingdom.kingdom_number)}
                onToggleCompare={(kn) => setCompareKingdoms(prev => { const next = new Set(prev); if (next.has(kn)) next.delete(kn); else if (next.size < 3) next.add(kn); return next; })}
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
              <span>{t('transferHub.standardListings', 'Standard Listings')}</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#2a2a2a' }} />
            </div>
          )}

          {/* Standard (unfunded) kingdoms — infinite scroll */}
          {kingdomsWithoutFunds.slice(0, visibleCount).map((kingdom) => {
            const fund = null;
            const matchResult = matchScoreMap.get(kingdom.kingdom_number);
            return (
              <KingdomListingCard
                key={kingdom.kingdom_number}
                kingdom={kingdom}
                fund={fund}
                reviewSummary={reviewMap.get(kingdom.kingdom_number) || null}
                mode={mode}
                matchScore={matchResult?.score}
                matchDetails={matchResult?.details}
                onApply={(kn) => requireAuth(() => { trackFeature('Transfer Apply Click', { kingdom: kn, ...(highlightedKingdom === kn ? { source: 'shared_link' } : {}) }); setApplyingToKingdom(kn); })}
                onFund={(kn) => requireAuth(() => { trackFeature('Transfer Fund Click', { kingdom: kn }); setContributingToKingdom(kn); })}
                highlighted={highlightedKingdom === kingdom.kingdom_number}
                isComparing={compareKingdoms.has(kingdom.kingdom_number)}
                onToggleCompare={(kn) => setCompareKingdoms(prev => { const next = new Set(prev); if (next.has(kn)) next.delete(kn); else if (next.size < 3) next.add(kn); return next; })}
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
                {t('transferHub.loadingMore', 'Loading more kingdoms...')}
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
              <p style={{ fontSize: '1.1rem', marginBottom: '0.4rem', color: '#d1d5db', fontWeight: '600' }}>{t('transferHub.noMatch', 'No kingdoms match your filters')}</p>
              <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1rem' }}>{t('transferHub.tryAdjusting', 'Try adjusting your filters or clearing them to see all kingdoms.')}</p>
              <button
                onClick={() => setFilters(defaultFilters)}
                style={{
                  padding: '0.5rem 1.25rem', backgroundColor: '#22d3ee15',
                  border: '1px solid #22d3ee30', borderRadius: '8px',
                  color: '#22d3ee', fontSize: '0.8rem', fontWeight: '600',
                  cursor: 'pointer', minHeight: '44px',
                }}
              >
                {t('transferHub.clearFilters', 'Clear All Filters')}
              </button>
            </div>
          )}
        </div>
      )}
      {/* Endorsement Overlay Modal */}
      {endorseClaimId && (
        <EndorsementOverlay
          endorseClaimId={endorseClaimId}
          endorseClaimData={endorseClaimData}
          endorseLoading={endorseLoading}
          user={user}
          linkedPlayerId={profile?.linked_player_id}
          onClose={() => {
            setEndorseClaimId(null);
            setEndorseClaimData(null);
          }}
          onEndorsed={() => {
            setEndorseClaimData(prev => prev ? {
              ...prev,
              endorsement_count: prev.endorsement_count + 1,
            } : null);
          }}
        />
      )}

      {/* Auth Gate Modal */}
      {showAuthGate && (
        <TransferAuthGate
          gateType={showAuthGate}
          isMobile={isMobile}
          endorseClaimId={endorseClaimId}
          onClose={() => setShowAuthGate(null)}
        />
      )}

      {/* Floating Compare Bar */}
      {compareKingdoms.size > 0 && (
        <div style={{
          position: 'fixed',
          bottom: isMobile ? 'env(safe-area-inset-bottom, 0px)' : '1rem',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: colors.surface,
          border: `1px solid ${colors.primary}40`,
          borderRadius: '12px',
          padding: '0.5rem 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
          zIndex: 900,
          minWidth: isMobile ? '90vw' : '300px',
          justifyContent: 'space-between',
        }}>
          <span style={{ color: colors.text, fontSize: '0.8rem', fontWeight: 600 }}>
            ⚖️ {compareKingdoms.size}/3 {t('transferHub.compare.selected', 'selected')}
          </span>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              onClick={() => setCompareKingdoms(new Set())}
              style={{
                padding: '0.35rem 0.6rem',
                backgroundColor: 'transparent',
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                color: colors.textMuted,
                fontSize: '0.7rem',
                cursor: 'pointer',
                minHeight: '36px',
              }}
            >
              {t('transferHub.compare.clear', 'Clear')}
            </button>
            <button
              onClick={() => { if (compareKingdoms.size >= 2) setShowCompareModal(true); }}
              disabled={compareKingdoms.size < 2}
              style={{
                padding: '0.35rem 0.8rem',
                backgroundColor: compareKingdoms.size >= 2 ? colors.primary : `${colors.primary}30`,
                border: 'none',
                borderRadius: '8px',
                color: compareKingdoms.size >= 2 ? '#000' : colors.textMuted,
                fontSize: '0.7rem',
                fontWeight: 600,
                cursor: compareKingdoms.size >= 2 ? 'pointer' : 'not-allowed',
                minHeight: '36px',
              }}
            >
              {t('transferHub.compare.compareNow', 'Compare')} →
            </button>
          </div>
        </div>
      )}

      {/* Kingdom Compare Modal */}
      {showCompareModal && (
        <KingdomCompare
          kingdoms={kingdoms.filter(k => compareKingdoms.has(k.kingdom_number))}
          funds={fundMap}
          onClose={() => setShowCompareModal(false)}
          onRemove={(kn) => {
            setCompareKingdoms(prev => { const next = new Set(prev); next.delete(kn); return next; });
            if (compareKingdoms.size <= 2) setShowCompareModal(false);
          }}
          onApply={mode === 'transferring' ? (kn) => {
            setShowCompareModal(false);
            requireAuth(() => { trackFeature('Transfer Apply Click', { kingdom: kn, source: 'compare' }); setApplyingToKingdom(kn); });
          } : undefined}
        />
      )}
    </div>
  );
};

export default TransferBoard;
