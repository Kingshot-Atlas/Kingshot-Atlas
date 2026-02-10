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
import KingdomListingCard, { KingdomData, KingdomFund, KingdomReviewSummary, BoardMode, MatchDetail, formatTCLevel } from '../components/KingdomListingCard';
import { useScrollDepth } from '../hooks/useScrollDepth';
import TransferHubGuide from '../components/TransferHubGuide';

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
}

// =============================================
// CONSTANTS
// =============================================


const RECRUITMENT_TAG_OPTIONS = [
  'Active KvK', 'Casual Friendly', 'Competitive',
  'Growing Kingdom', 'Established Kingdom',
  'Active Alliances', 'Social Community', 'War Focused', 'Farm Friendly',
  'KvK Focused', 'Event Active', 'Beginner Friendly',
];


// Used in Transfer Profile creation form (future)
// const POWER_RANGE_OPTIONS = [
//   'Any', '10M-50M', '50M-100M', '100M-200M', '200M-500M', '500M-1B', '1B+',
// ];

const LANGUAGE_OPTIONS = [
  'English', 'Mandarin Chinese', 'Hindi', 'Spanish', 'French', 'Arabic', 'Bengali',
  'Portuguese', 'Russian', 'Japanese', 'German', 'Korean', 'Turkish', 'Vietnamese',
  'Italian', 'Thai', 'Polish', 'Indonesian', 'Dutch', 'Tagalog', 'Other',
];

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

// =============================================
// ENTRY MODAL
// =============================================

const EntryModal: React.FC<{
  onSelect: (mode: BoardMode) => void;
  onClose: () => void;
}> = ({ onSelect, onClose }) => {
  const isMobile = useIsMobile();

  const options: Array<{
    mode: BoardMode;
    icon: string;
    title: string;
    subtitle: string;
    color: string;
  }> = [
    {
      mode: 'transferring',
      icon: '🚀',
      title: "I'm looking for a new kingdom",
      subtitle: 'Create your Transfer Profile and apply to kingdoms',
      color: '#22d3ee',
    },
    {
      mode: 'recruiting',
      icon: '📢',
      title: "I'm recruiting for my kingdom",
      subtitle: 'Manage your kingdom listing and review applications',
      color: '#a855f7',
    },
    {
      mode: 'browsing',
      icon: '👀',
      title: "Just browsing",
      subtitle: 'Explore kingdoms and see what\'s available',
      color: '#9ca3af',
    },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: isMobile ? 0 : '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: isMobile ? '16px 16px 0 0' : '16px',
          padding: isMobile ? '1.5rem 1rem' : '2rem',
          maxWidth: isMobile ? '100%' : '500px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
          paddingBottom: isMobile ? 'max(1.5rem, env(safe-area-inset-bottom))' : '2rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h2
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: isMobile ? '1.2rem' : '1.4rem',
              color: colors.text,
              margin: '0 0 0.5rem 0',
            }}
          >
            What brings you here?
          </h2>
          <p style={{ color: colors.textSecondary, fontSize: '0.85rem', margin: 0 }}>
            This helps us personalize your experience
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {options.map((opt) => (
            <button
              key={opt.mode}
              onClick={() => onSelect(opt.mode)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '1rem 1.25rem',
                backgroundColor: colors.bg,
                border: `1px solid ${opt.color}30`,
                borderRadius: '12px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s',
                minHeight: '44px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `${opt.color}60`;
                e.currentTarget.style.backgroundColor = `${opt.color}10`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = `${opt.color}30`;
                e.currentTarget.style.backgroundColor = colors.bg;
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>{opt.icon}</span>
              <div>
                <div style={{ color: colors.text, fontWeight: '600', fontSize: '0.9rem' }}>
                  {opt.title}
                </div>
                <div style={{ color: colors.textSecondary, fontSize: '0.75rem', marginTop: '0.25rem' }}>
                  {opt.subtitle}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// =============================================
// MODE TOGGLE (Tab Bar)
// =============================================

const ModeToggle: React.FC<{
  mode: BoardMode;
  onChange: (mode: BoardMode) => void;
}> = ({ mode, onChange }) => {
  const isMobile = useIsMobile();
  const tabs: Array<{ mode: BoardMode; label: string; icon: string }> = [
    { mode: 'transferring', label: "I'm Transferring", icon: '🚀' },
    { mode: 'recruiting', label: "I'm Recruiting", icon: '📢' },
    { mode: 'browsing', label: 'Browsing', icon: '👀' },
  ];

  return (
    <div
      style={{
        display: 'flex',
        gap: '0.5rem',
        backgroundColor: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: '12px',
        padding: '0.25rem',
        width: 'fit-content',
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.mode}
          onClick={() => onChange(tab.mode)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: isMobile ? '0.5rem 0.75rem' : '0.5rem 1rem',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            fontSize: isMobile ? '0.75rem' : '0.8rem',
            fontWeight: mode === tab.mode ? '600' : '400',
            backgroundColor: mode === tab.mode ? `${colors.primary}15` : 'transparent',
            color: mode === tab.mode ? colors.primary : colors.textSecondary,
            transition: 'all 0.2s',
            minHeight: '44px',
          }}
        >
          <span>{tab.icon}</span>
          {!isMobile && tab.label}
          {isMobile && tab.label.split(' ').pop()}
        </button>
      ))}
    </div>
  );
};

// =============================================
// FILTERS
// =============================================

interface FilterState {
  tier: string;
  language: string;
  minScore: string;
  maxScore: string;
  isRecruiting: boolean;
  tag: string;
  minMatchScore: string;
  sortBy: string;
}

const defaultFilters: FilterState = {
  tier: 'all',
  language: 'all',
  minScore: '',
  maxScore: '',
  isRecruiting: false,
  tag: 'all',
  minMatchScore: '',
  sortBy: 'tier',
};

const FilterPanel: React.FC<{
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  mode: BoardMode;
}> = ({ filters, onChange, mode }) => {
  const isMobile = useIsMobile();
  const [isExpanded, setIsExpanded] = useState(false);

  const update = (key: keyof FilterState, value: string | boolean) => {
    onChange({ ...filters, [key]: value });
  };

  const selectStyle: React.CSSProperties = {
    padding: '0.5rem 0.75rem',
    backgroundColor: colors.bg,
    border: `1px solid ${colors.border}`,
    borderRadius: '8px',
    color: colors.text,
    fontSize: isMobile ? '1rem' : '0.8rem',
    minHeight: '44px',
    cursor: 'pointer',
    width: '100%',
  };

  const activeFilterCount = Object.entries(filters).filter(([key, val]) => {
    if (key === 'sortBy') return false;
    if (typeof val === 'boolean') return val;
    return val !== '' && val !== 'all';
  }).length;

  return (
    <div style={{
      backgroundColor: colors.surface,
      border: `1px solid ${colors.border}`,
      borderRadius: '12px',
      padding: '1rem',
    }}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          background: 'none',
          border: 'none',
          color: colors.text,
          cursor: 'pointer',
          padding: 0,
          fontSize: '0.85rem',
          fontWeight: '500',
          minHeight: '44px',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
          Filters
          {activeFilterCount > 0 && (
            <span style={{
              backgroundColor: colors.primary,
              color: '#000',
              borderRadius: '10px',
              padding: '0.1rem 0.5rem',
              fontSize: '0.7rem',
              fontWeight: 'bold',
            }}>
              {activeFilterCount}
            </span>
          )}
        </span>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        >
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {isExpanded && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: '0.75rem',
          marginTop: '1rem',
          paddingTop: '1rem',
          borderTop: `1px solid ${colors.border}`,
        }}>
          <div>
            <label style={{ color: colors.textSecondary, fontSize: '0.7rem', marginBottom: '0.25rem', display: 'block' }}>Fund Tier</label>
            <select value={filters.tier} onChange={(e) => update('tier', e.target.value)} style={selectStyle}>
              <option value="all">All Tiers</option>
              <option value="gold">Gold</option>
              <option value="silver">Silver</option>
              <option value="bronze">Bronze</option>
              <option value="standard">Standard</option>
            </select>
          </div>
          <div>
            <label style={{ color: colors.textSecondary, fontSize: '0.7rem', marginBottom: '0.25rem', display: 'block' }}>Language</label>
            <select value={filters.language} onChange={(e) => update('language', e.target.value)} style={selectStyle}>
              <option value="all">All Languages</option>
              {LANGUAGE_OPTIONS.map((lang) => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ color: colors.textSecondary, fontSize: '0.7rem', marginBottom: '0.25rem', display: 'block' }}>Sort By</label>
            <select value={filters.sortBy} onChange={(e) => update('sortBy', e.target.value)} style={selectStyle}>
              <option value="tier">Fund Tier (High → Low)</option>
              <option value="score">Atlas Score (High → Low)</option>
              <option value="rank">Rank (Best → Worst)</option>
              <option value="match">Match Score (Best → Worst)</option>
            </select>
          </div>
          <div>
            <label style={{ color: colors.textSecondary, fontSize: '0.7rem', marginBottom: '0.25rem', display: 'block' }}>Recruitment Tag</label>
            <select value={filters.tag} onChange={(e) => update('tag', e.target.value)} style={selectStyle}>
              <option value="all">All Tags</option>
              {RECRUITMENT_TAG_OPTIONS.map((tag) => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ color: colors.textSecondary, fontSize: '0.7rem', marginBottom: '0.25rem', display: 'block' }}>Min Atlas Score</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={filters.minScore}
              onChange={(e) => update('minScore', e.target.value)}
              placeholder="0.0"
              style={{ ...selectStyle, width: '100%' }}
            />
          </div>
          {mode === 'transferring' && (
            <div>
              <label style={{ color: colors.textSecondary, fontSize: '0.7rem', marginBottom: '0.25rem', display: 'block' }}>Min Match Score</label>
              <input
                type="number"
                step="5"
                min="0"
                max="100"
                value={filters.minMatchScore}
                onChange={(e) => update('minMatchScore', e.target.value)}
                placeholder="0%"
                style={{ ...selectStyle, width: '100%' }}
              />
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              color: colors.textSecondary, fontSize: '0.8rem', cursor: 'pointer', minHeight: '44px',
            }}>
              <input
                type="checkbox"
                checked={filters.isRecruiting}
                onChange={(e) => update('isRecruiting', e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: colors.primary }}
              />
              Actively Recruiting Only
            </label>
          </div>
          {activeFilterCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                onClick={() => onChange(defaultFilters)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: 'transparent',
                  border: `1px solid ${colors.error}40`,
                  borderRadius: '8px',
                  color: colors.error,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  minHeight: '44px',
                }}
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// AllianceEventTimesGrid and KingdomListingCard are now in ../components/KingdomListingCard.tsx
// (removed ~830 lines of inline component code)

// =============================================
// MAIN TRANSFER HUB PAGE
// =============================================

const TransferBoard: React.FC = () => {
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
  const sentinelRef = useRef<HTMLDivElement | null>(null);

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
        .select('id, power_million, tc_level, main_language, secondary_languages, looking_for, kvk_availability, saving_for_kvk')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();
      setHasTransferProfile(!!data);
      if (data) {
        setTransferProfile({
          power_million: data.power_million || 0,
          tc_level: data.tc_level || 0,
          main_language: data.main_language || 'English',
          secondary_languages: data.secondary_languages || [],
          looking_for: data.looking_for || [],
          kvk_availability: data.kvk_availability || '',
          saving_for_kvk: data.saving_for_kvk || '',
        });
      } else {
        setTransferProfile(null);
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
    return total === 0 ? 0 : Math.round((matched / total) * 100);
  };

  // Filter and sort kingdoms
  const filteredKingdoms = useMemo(() => {
    let result = [...kingdoms];

    // In transferring mode, exclude user's own kingdom (can't transfer to yourself)
    if (mode === 'transferring' && profile?.linked_kingdom) {
      result = result.filter((k) => k.kingdom_number !== profile.linked_kingdom);
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
  }, [kingdoms, filters, fundMap, mode, profile?.linked_kingdom, userTransferGroup]);

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

    if (total === 0) return { score: 0, details: [] };
    const score = Math.round((matched / total) * 100);
    return { score, details };
  };

  // Access gate: require linked Kingshot account (placed after all hooks for Rules of Hooks compliance)
  const hasLinkedAccount = !!profile?.linked_player_id;
  if (!user || !hasLinkedAccount) {
    return (
      <div style={{
        maxWidth: '600px', margin: '4rem auto', textAlign: 'center',
        padding: '2rem', backgroundColor: '#111111', borderRadius: '16px',
        border: '1px solid #2a2a2a',
      }}>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: '1.5rem', marginBottom: '0.75rem' }}>
          <span style={{ color: '#fff' }}>TRANSFER</span>
          <span style={{ ...neonGlow('#22d3ee'), marginLeft: '0.4rem' }}>HUB</span>
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
          {!user ? 'Sign in to access the Transfer Hub.' : 'Link your Kingshot account to access the Transfer Hub.'}
        </p>
        <p style={{ color: '#6b7280', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
          {!user
            ? 'The Transfer Hub requires an account to browse kingdoms, apply for transfers, and manage recruitment.'
            : 'Go to your Profile and link your in-game account to unlock the Transfer Hub.'}
        </p>
        <Link to={!user ? '/profile' : '/profile'} style={{
          display: 'inline-block', padding: '0.6rem 1.5rem',
          backgroundColor: '#22d3ee', color: '#000', borderRadius: '8px',
          fontWeight: '600', fontSize: '0.85rem', textDecoration: 'none',
          minHeight: '44px', lineHeight: '44px',
        }}>
          {!user ? 'Sign In' : 'Link Account'}
        </Link>
      </div>
    );
  }

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
      <div style={{ marginBottom: '1rem' }}>
        <ModeToggle mode={mode} onChange={handleModeChange} />
      </div>

      {/* Transfer Profile CTA (only in transferring mode) */}
      {mode === 'transferring' && (
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
          <div>
            <span style={{ color: '#22d3ee', fontWeight: '600', fontSize: '0.85rem' }}>
              {hasTransferProfile ? 'Your Transfer Profile is Active' : 'Create Your Transfer Profile'}
            </span>
            <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: '0.2rem 0 0 0' }}>
              {hasTransferProfile
                ? 'Kingdoms can see your profile when you apply. You can edit it anytime.'
                : 'Set up your profile so kingdoms know what you bring to the table.'}
            </p>
          </div>
          <button
            onClick={() => setShowProfileForm(true)}
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
            {hasTransferProfile ? 'Edit Profile' : 'Create Profile'}
          </button>
        </div>
      )}

      {/* Transfer Profile Form Modal */}
      {showProfileForm && (
        <TransferProfileForm
          onClose={() => setShowProfileForm(false)}
          onSaved={() => {
            setShowProfileForm(false);
            setHasTransferProfile(true);
          }}
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

      {/* Recruiter Mode: Editor Claiming + Dashboard Access */}
      {mode === 'recruiting' && user && (
        <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <EditorClaiming onEditorActivated={() => setIsEditor(true)} />
          {isEditor && (
            <button
              onClick={() => { trackFeature('Recruiter Dashboard Open'); setShowRecruiterDash(true); }}
              style={{
                padding: '0.6rem 1rem',
                backgroundColor: '#a855f715',
                border: '1px solid #a855f730',
                borderRadius: '10px',
                color: '#a855f7',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                minHeight: '44px',
                width: '100%',
              }}
            >
              Open Recruiter Dashboard
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

      {/* Filters */}
      <div style={{ marginBottom: '1rem' }}>
        <FilterPanel filters={filters} onChange={setFilters} mode={mode} />
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
                onApply={(kn) => { trackFeature('Transfer Apply Click', { kingdom: kn }); setApplyingToKingdom(kn); }}
                onFund={(kn) => { trackFeature('Transfer Fund Click', { kingdom: kn }); setContributingToKingdom(kn); }}
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
                onApply={(kn) => { trackFeature('Transfer Apply Click', { kingdom: kn }); setApplyingToKingdom(kn); }}
                onFund={(kn) => { trackFeature('Transfer Fund Click', { kingdom: kn }); setContributingToKingdom(kn); }}
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
    </div>
  );
};

export default TransferBoard;
