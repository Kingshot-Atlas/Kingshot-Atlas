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
import { neonGlow, FONT_DISPLAY, statTypeStyles, colors, cardShadow } from '../utils/styles';
import { getPowerTier } from '../utils/atlasScoreFormula';
import { isAdminUsername, isAdminEmail } from '../utils/constants';

// =============================================
// TYPES
// =============================================

interface KingdomData {
  kingdom_number: number;
  atlas_score: number;
  current_rank: number;
  total_kvks: number;
  prep_wins: number;
  prep_losses: number;
  prep_win_rate: number;
  battle_wins: number;
  battle_losses: number;
  battle_win_rate: number;
  dominations: number;
  invasions: number;
}

interface KingdomFund {
  kingdom_number: number;
  balance: number;
  tier: 'standard' | 'bronze' | 'silver' | 'gold';
  is_recruiting: boolean;
  recruitment_tags: string[];
  contact_link: string | null;
  min_tc_level: number | null;
  min_power_range: string | null;
  recruitment_pitch: string | null;
  main_language: string | null;
  secondary_languages: string[];
  event_times: Array<{ start: string; end: string }>;
  what_we_offer: string | null;
  what_we_want: string | null;
  highlighted_stats: string[];
  banner_theme: string;
  alliance_events: Array<{
    tag: string;
    event_type: 'bear_hunt' | 'viking_vengeance' | 'swordland_showdown' | 'tri_alliance_clash';
    time_slots: string[];
  }>;
}

interface KingdomReviewSummary {
  kingdom_number: number;
  avg_rating: number;
  review_count: number;
  top_review_comment: string | null;
  top_review_author: string | null;
}

type BoardMode = 'transferring' | 'recruiting' | 'browsing';

// =============================================
// CONSTANTS
// =============================================

// Helper function to convert TC level to TG level
const getTGLevel = (tcLevel: number): string => {
  if (tcLevel < 35) return 'TG0';
  if (tcLevel < 40) return 'TG1';
  if (tcLevel < 45) return 'TG2';
  if (tcLevel < 50) return 'TG3';
  if (tcLevel < 55) return 'TG4';
  return 'TG5+';
};

const TIER_COLORS: Record<string, string> = {
  gold: colors.gold,
  silver: colors.textSecondary,
  bronze: '#cd7f32',
  standard: colors.textMuted,
};

const TIER_BORDER_STYLES: Record<string, string> = {
  gold: `2px solid ${colors.gold}`,
  silver: `2px solid ${colors.textSecondary}40`,
  bronze: `2px solid #cd7f3280`,
  standard: `1px solid ${colors.border}`,
};

const RECRUITMENT_TAG_OPTIONS = [
  'Active KvK', 'Casual Friendly', 'Competitive', 'English Speaking',
  'Spanish Speaking', 'Portuguese Speaking', 'Arabic Speaking', 'Turkish Speaking',
  'Looking for TC25+', 'Looking for TC20+', 'Growing Kingdom', 'Established Kingdom',
  'Active Alliances', 'Social Community', 'War Focused', 'Farm Friendly',
];

// Used in Transfer Profile creation form (future)
// const POWER_RANGE_OPTIONS = [
//   'Any', '10M-50M', '50M-100M', '100M-200M', '200M-500M', '500M-1B', '1B+',
// ];

const LANGUAGE_OPTIONS = [
  'English', 'Spanish', 'Portuguese', 'Arabic', 'Turkish', 'French', 'German',
  'Russian', 'Chinese', 'Japanese', 'Korean', 'Indonesian', 'Thai', 'Vietnamese', 'Other',
];

const SCORE_TIER_COLORS: Record<string, string> = {
  S: colors.gold,
  A: colors.success,
  B: colors.blue,
  C: colors.orange,
  D: colors.error,
  F: colors.textMuted,
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
              max="15"
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

// =============================================
// KINGDOM LISTING CARD
// =============================================

const KingdomListingCard: React.FC<{
  kingdom: KingdomData;
  fund: KingdomFund | null;
  reviewSummary: KingdomReviewSummary | null;
  mode: BoardMode;
  matchScore?: number;
  onApply?: (kingdomNumber: number) => void;
  onFund?: (kingdomNumber: number) => void;
}> = ({ kingdom, fund, reviewSummary, mode, matchScore, onApply, onFund }) => {
  const isMobile = useIsMobile();
  const { profile } = useAuth();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const fundTier = fund?.tier || 'standard';
  const tierColor = TIER_COLORS[fundTier];
  const scoreTier = getPowerTier(kingdom.atlas_score || 0);
  const scoreTierColor = SCORE_TIER_COLORS[scoreTier] || '#6b7280';
  const isGold = fundTier === 'gold';
  const isSilver = fundTier === 'silver';

  // Check if user can fund this kingdom (only their own kingdom)
  const canFundKingdom = profile?.linked_kingdom === kingdom.kingdom_number;

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const renderStars = (rating: number) => {
    const stars = [];
    for (let idx = 1; idx <= 5; idx++) {
      stars.push(
        <span key={idx} style={{ color: idx <= Math.round(rating) ? '#fbbf24' : '#333' }}>★</span>
      );
    }
    return stars;
  };

  return (
    <div
      style={{
        backgroundColor: colors.surface,
        border: TIER_BORDER_STYLES[fundTier],
        borderRadius: '12px',
        overflow: 'hidden',
        transition: 'all 0.2s',
        boxShadow: isHovered && fundTier !== 'standard'
          ? `0 0 20px ${tierColor}20`
          : cardShadow(isHovered),
        ...(isGold ? { animation: 'goldGlow 3s ease-in-out infinite' } : {}),
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Card Header - Always Visible */}
      <div style={{ padding: isMobile ? '0.75rem' : '1rem' }}>
        {/* Top Row: Kingdom Name + Tier Badge + Match Score */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
            <Link
              to={`/kingdom/${kingdom.kingdom_number}`}
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: isMobile ? '0.9rem' : '1rem',
                color: colors.text,
                textDecoration: 'none',
                fontWeight: '700',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Kingdom {kingdom.kingdom_number}
            </Link>
            {fundTier !== 'standard' && (
              <span style={{
                padding: '0.15rem 0.5rem',
                backgroundColor: `${tierColor}15`,
                border: `1px solid ${tierColor}40`,
                borderRadius: '4px',
                fontSize: '0.6rem',
                color: tierColor,
                fontWeight: 'bold',
                textTransform: 'uppercase',
              }}>
                {fundTier}
              </span>
            )}
            {fund?.is_recruiting && (
              <span style={{
                display: 'flex', alignItems: 'center', gap: '0.25rem',
                padding: '0.15rem 0.5rem',
                backgroundColor: '#22c55e15',
                border: '1px solid #22c55e40',
                borderRadius: '4px',
                fontSize: '0.6rem',
                color: '#22c55e',
                fontWeight: 'bold',
              }}>
                <span style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  backgroundColor: '#22c55e', display: 'inline-block',
                  animation: 'pulse 2s infinite',
                }}/>
                RECRUITING
              </span>
            )}
          </div>
          {mode === 'transferring' && matchScore !== undefined && (
            <span style={{
              padding: '0.2rem 0.6rem',
              backgroundColor: matchScore >= 75 ? '#22c55e15' : matchScore >= 50 ? '#eab30815' : '#ef444415',
              border: `1px solid ${matchScore >= 75 ? '#22c55e40' : matchScore >= 50 ? '#eab30840' : '#ef444440'}`,
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 'bold',
              color: matchScore >= 75 ? '#22c55e' : matchScore >= 50 ? '#eab308' : '#ef4444',
            }}>
              {matchScore}% match
            </span>
          )}
        </div>

        {/* Score Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, auto)',
          alignItems: 'center',
          gap: isMobile ? '0.5rem' : '1.5rem',
        }}>
          <div>
            <span style={{ color: colors.textSecondary, fontSize: '0.65rem' }}>Atlas Score</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{
                fontFamily: "'Orbitron', monospace",
                fontWeight: 'bold',
                fontSize: '1.1rem',
                ...neonGlow(scoreTierColor),
              }}>
                {kingdom.atlas_score?.toFixed(1) || '—'}
              </span>
              <span style={{
                padding: '0.1rem 0.35rem',
                backgroundColor: `${scoreTierColor}20`,
                borderRadius: '4px',
                fontSize: '0.65rem',
                fontWeight: 'bold',
                color: scoreTierColor,
              }}>
                {scoreTier}-Tier
              </span>
              <span style={{ color: scoreTierColor, fontSize: '0.75rem' }}>
                (#{kingdom.current_rank})
              </span>
            </div>
          </div>
          <div>
            <span style={{ color: colors.textSecondary, fontSize: '0.65rem' }}>Prep Win Rate</span>
            <div style={{ color: statTypeStyles.prepPhase.color, fontWeight: '600', fontSize: '0.9rem' }}>
              {kingdom.prep_win_rate != null ? `${(kingdom.prep_win_rate * 100).toFixed(0)}%` : '—'}
            </div>
          </div>
          <div>
            <span style={{ color: colors.textSecondary, fontSize: '0.65rem' }}>Battle Win Rate</span>
            <div style={{ color: statTypeStyles.battlePhase.color, fontWeight: '600', fontSize: '0.9rem' }}>
              {kingdom.battle_win_rate != null ? `${(kingdom.battle_win_rate * 100).toFixed(0)}%` : '—'}
            </div>
          </div>
          <div>
            <span style={{ color: colors.textSecondary, fontSize: '0.65rem' }}>KvKs</span>
            <div style={{ color: colors.text, fontWeight: '600', fontSize: '0.9rem' }}>
              {kingdom.total_kvks || 0}
            </div>
          </div>
        </div>

        {/* Recruitment Tags (Bronze+) */}
        {fund && fund.recruitment_tags.length > 0 && (
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            {fund.recruitment_tags.map((tag) => (
              <span key={tag} style={{
                padding: '0.15rem 0.5rem',
                backgroundColor: `${colors.primary}10`,
                border: `1px solid ${colors.primary}25`,
                borderRadius: '4px',
                fontSize: '0.65rem',
                color: colors.primary,
              }}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Min Requirements (Bronze+) */}
        {fund && (fund.min_tc_level || fund.min_power_range) && (
          <div style={{
            display: 'flex', gap: '0.5rem', marginTop: '0.5rem',
            fontSize: '0.7rem', color: colors.textSecondary,
          }}>
            {fund.min_tc_level && (
              <span>Requires {getTGLevel(fund.min_tc_level)}+</span>
            )}
            {fund.min_power_range && fund.min_power_range !== 'Any' && (
              <span>• {fund.min_power_range} power</span>
            )}
          </div>
        )}

        {/* Recruitment Pitch (Silver+) - visible in collapsed view */}
        {(isSilver || isGold) && fund?.recruitment_pitch && (
          <p style={{
            color: colors.textSecondary,
            fontSize: '0.8rem',
            margin: '0.5rem 0 0 0',
            lineHeight: 1.4,
            fontStyle: 'italic',
          }}>
            "{fund.recruitment_pitch}"
          </p>
        )}

        {/* Review Summary */}
        {reviewSummary && reviewSummary.review_count > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem', fontSize: '0.75rem' }}>
              {renderStars(reviewSummary.avg_rating)}
            </div>
            <span style={{ color: colors.textSecondary, fontSize: '0.7rem' }}>
              {reviewSummary.avg_rating.toFixed(1)} ({reviewSummary.review_count} review{reviewSummary.review_count !== 1 ? 's' : ''})
            </span>
          </div>
        )}
      </div>

      {/* Expandable Sections */}
      <div style={{ borderTop: `1px solid ${colors.border}` }}>
        {/* Performance Section */}
        <button
          onClick={() => toggleSection('performance')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', padding: '0.6rem 1rem',
            backgroundColor: expandedSection === 'performance' ? colors.bg : 'transparent',
            border: 'none', borderBottom: `1px solid ${colors.border}`,
            color: colors.textSecondary, fontSize: '0.8rem', cursor: 'pointer',
            minHeight: '44px',
          }}
        >
          <span>{statTypeStyles.atlasScore.emoji} Performance</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ transform: expandedSection === 'performance' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
          >
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>
        {expandedSection === 'performance' && (
          <div style={{
            padding: '0.75rem 1rem',
            backgroundColor: colors.bg,
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
            gap: '0.75rem',
          }}>
            <div>
              <span style={{ color: statTypeStyles.prepPhase.color, fontSize: '0.65rem' }}>{statTypeStyles.prepPhase.emoji} Prep Win Rate</span>
              <div style={{ color: colors.text, fontWeight: '600' }}>
                {kingdom.prep_win_rate != null ? `${(kingdom.prep_win_rate * 100).toFixed(1)}%` : '—'}
                <span style={{ color: colors.textSecondary, fontSize: '0.7rem', fontWeight: 'normal' }}> ({kingdom.prep_wins}W-{kingdom.prep_losses}L)</span>
              </div>
            </div>
            <div>
              <span style={{ color: statTypeStyles.battlePhase.color, fontSize: '0.65rem' }}>{statTypeStyles.battlePhase.emoji} Battle Win Rate</span>
              <div style={{ color: colors.text, fontWeight: '600' }}>
                {kingdom.battle_win_rate != null ? `${(kingdom.battle_win_rate * 100).toFixed(1)}%` : '—'}
                <span style={{ color: colors.textSecondary, fontSize: '0.7rem', fontWeight: 'normal' }}> ({kingdom.battle_wins}W-{kingdom.battle_losses}L)</span>
              </div>
            </div>
            <div>
              <span style={{ color: statTypeStyles.domination.color, fontSize: '0.65rem' }}>{statTypeStyles.domination.emoji} Dominations</span>
              <div style={{ color: colors.text, fontWeight: '600' }}>{kingdom.dominations || 0}</div>
            </div>
            <div>
              <span style={{ color: statTypeStyles.invasion.color, fontSize: '0.65rem' }}>{statTypeStyles.invasion.emoji} Invasions</span>
              <div style={{ color: colors.text, fontWeight: '600' }}>{kingdom.invasions || 0}</div>
            </div>
            <div>
              <span style={{ color: colors.textSecondary, fontSize: '0.65rem' }}>Total KvKs</span>
              <div style={{ color: colors.text, fontWeight: '600' }}>{kingdom.total_kvks || 0}</div>
            </div>
            <div>
              <span style={{ color: colors.textSecondary, fontSize: '0.65rem' }}>Rank</span>
              <div style={{ color: scoreTierColor, fontWeight: '600' }}>#{kingdom.current_rank}</div>
            </div>
          </div>
        )}

        {/* Recruitment Section (Bronze+) */}
        {fund && fundTier !== 'standard' && (
          <>
            <button
              onClick={() => toggleSection('recruitment')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '0.6rem 1rem',
                backgroundColor: expandedSection === 'recruitment' ? colors.bg : 'transparent',
                border: 'none', borderBottom: `1px solid ${colors.border}`,
                color: colors.textSecondary, fontSize: '0.8rem', cursor: 'pointer',
                minHeight: '44px',
              }}
            >
              <span>📋 Recruitment Info</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ transform: expandedSection === 'recruitment' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
              >
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>
            {expandedSection === 'recruitment' && (
              <div style={{ padding: '0.75rem 1rem', backgroundColor: colors.bg }}>
                {fund.main_language && (
                  <div style={{ marginBottom: '0.5rem' }}>
                    <span style={{ color: colors.textSecondary, fontSize: '0.7rem' }}>Language: </span>
                    <span style={{ color: colors.text, fontSize: '0.8rem' }}>{fund.main_language}</span>
                    {fund.secondary_languages.length > 0 && (
                      <span style={{ color: colors.textSecondary, fontSize: '0.75rem' }}> + {fund.secondary_languages.join(', ')}</span>
                    )}
                  </div>
                )}
                {fund.event_times && fund.event_times.length > 0 && (
                  <div style={{ marginBottom: '0.5rem' }}>
                    <span style={{ color: colors.textSecondary, fontSize: '0.7rem' }}>Event Times (UTC): </span>
                    <span style={{ color: colors.text, fontSize: '0.8rem' }}>
                      {fund.event_times.map((t) => `${t.start} - ${t.end}`).join(', ')}
                    </span>
                  </div>
                )}
                {fund.contact_link && (
                  <div style={{ marginBottom: '0.5rem' }}>
                    <span style={{ color: colors.textSecondary, fontSize: '0.7rem' }}>Contact: </span>
                    <a href={fund.contact_link} target="_blank" rel="noopener noreferrer"
                      style={{ color: colors.primary, fontSize: '0.8rem' }}
                    >
                      Discord Invite ↗
                    </a>
                  </div>
                )}
                {isGold && fund.what_we_offer && (
                  <div style={{ marginBottom: '0.5rem', padding: '0.5rem', backgroundColor: colors.surface, borderRadius: '8px' }}>
                    <span style={{ color: colors.success, fontSize: '0.7rem', fontWeight: 'bold' }}>What We Offer</span>
                    <p style={{ color: colors.textSecondary, fontSize: '0.8rem', margin: '0.25rem 0 0 0', lineHeight: 1.4 }}>{fund.what_we_offer}</p>
                  </div>
                )}
                {isGold && fund.what_we_want && (
                  <div style={{ padding: '0.5rem', backgroundColor: colors.surface, borderRadius: '8px' }}>
                    <span style={{ color: colors.orange, fontSize: '0.7rem', fontWeight: 'bold' }}>What We're Looking For</span>
                    <p style={{ color: colors.textSecondary, fontSize: '0.8rem', margin: '0.25rem 0 0 0', lineHeight: 1.4 }}>{fund.what_we_want}</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Alliance Events (Silver+) */}
        {fund && fundTier !== 'standard' && fund.alliance_events && fund.alliance_events.length > 0 && (
          <button
            onClick={() => toggleSection('alliance_events')}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: expandedSection === 'alliance_events' ? colors.bg : 'transparent',
              border: 'none',
              borderBottom: expandedSection === 'alliance_events' ? `1px solid ${colors.border}` : 'none',
              color: colors.textSecondary,
              fontSize: '0.75rem',
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>🤝 Alliance Events ({fund.alliance_events.length})</span>
            <span style={{ fontSize: '0.6rem' }}>{expandedSection === 'alliance_events' ? '▼' : '▶'}</span>
          </button>
        )}
        {expandedSection === 'alliance_events' && fund && fund.alliance_events && fund.alliance_events.length > 0 && (
          <div style={{
            padding: '0.75rem',
            backgroundColor: colors.bg,
            borderBottom: `1px solid ${colors.border}`,
          }}>
            {fund.alliance_events.map((alliance, idx) => (
              <div key={idx} style={{ marginBottom: idx < fund.alliance_events.length - 1 ? '0.75rem' : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{
                    padding: '0.1rem 0.4rem',
                    backgroundColor: `${colors.primary}20`,
                    border: `1px solid ${colors.primary}40`,
                    borderRadius: '4px',
                    fontSize: '0.6rem',
                    color: colors.primary,
                    fontWeight: 'bold',
                  }}>
                    [{alliance.tag}]
                  </span>
                  <span style={{ color: colors.text, fontSize: '0.8rem', fontWeight: '600' }}>
                    {alliance.event_type === 'bear_hunt' && 'Bear Hunt'}
                    {alliance.event_type === 'viking_vengeance' && 'Viking Vengeance'}
                    {alliance.event_type === 'swordland_showdown' && 'Swordland Showdown'}
                    {alliance.event_type === 'tri_alliance_clash' && 'Tri-Alliance Clash'}
                  </span>
                </div>
                <div style={{ color: colors.textSecondary, fontSize: '0.7rem' }}>
                  {alliance.time_slots.join(', ')}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Community Section */}
        <button
          onClick={() => toggleSection('community')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', padding: '0.6rem 1rem',
            backgroundColor: expandedSection === 'community' ? colors.bg : 'transparent',
            border: 'none',
            color: colors.textSecondary, fontSize: '0.8rem', cursor: 'pointer',
            minHeight: '44px',
          }}
        >
          <span>💬 Community</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ transform: expandedSection === 'community' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
          >
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>
        {expandedSection === 'community' && (
          <div style={{ padding: '0.75rem 1rem', backgroundColor: colors.bg }}>
            {reviewSummary && reviewSummary.review_count > 0 ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', gap: '0.1rem', fontSize: '0.9rem' }}>
                    {renderStars(reviewSummary.avg_rating)}
                  </div>
                  <span style={{ color: colors.text, fontWeight: '600', fontSize: '0.85rem' }}>
                    {reviewSummary.avg_rating.toFixed(1)}
                  </span>
                  <span style={{ color: colors.textSecondary, fontSize: '0.75rem' }}>
                    ({reviewSummary.review_count} review{reviewSummary.review_count !== 1 ? 's' : ''})
                  </span>
                </div>
                {reviewSummary.top_review_comment && (
                  <div style={{
                    padding: '0.5rem 0.75rem',
                    backgroundColor: colors.surface,
                    borderRadius: '8px',
                    borderLeft: '3px solid #fbbf24',
                  }}>
                    <p style={{ color: colors.textSecondary, fontSize: '0.8rem', margin: 0, fontStyle: 'italic', lineHeight: 1.4 }}>
                      "{reviewSummary.top_review_comment}"
                    </p>
                    {reviewSummary.top_review_author && (
                      <span style={{ color: colors.textSecondary, fontSize: '0.7rem' }}>— {reviewSummary.top_review_author}</span>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p style={{ color: colors.textMuted, fontSize: '0.8rem', margin: 0 }}>No community reviews yet</p>
            )}
          </div>
        )}
      </div>

      {/* Card Footer - CTA */}
      <div style={{
        padding: '0.75rem 1rem',
        borderTop: `1px solid ${colors.border}`,
        display: 'flex',
        gap: '0.5rem',
        justifyContent: 'flex-end',
      }}>
        <Link
          to={`/kingdom/${kingdom.kingdom_number}`}
          style={{
            padding: '0.4rem 0.75rem',
            backgroundColor: 'transparent',
            border: `1px solid ${colors.border}`,
            borderRadius: '8px',
            color: colors.textSecondary,
            fontSize: '0.75rem',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            minHeight: '44px',
          }}
        >
          View Profile
        </Link>
        {canFundKingdom && (
          <button
            onClick={() => onFund?.(kingdom.kingdom_number)}
            style={{
              padding: '0.4rem 0.75rem',
              backgroundColor: `${colors.success}10`,
              border: `1px solid ${colors.success}30`,
              borderRadius: '8px',
              color: colors.success,
              fontSize: '0.75rem',
              cursor: 'pointer',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              minHeight: '44px',
            }}
          >
            Fund
          </button>
        )}
        {mode === 'transferring' && fundTier !== 'standard' && (
          <button
            style={{
              padding: '0.4rem 0.75rem',
              backgroundColor: `${colors.primary}15`,
              border: `1px solid ${colors.primary}40`,
              borderRadius: '8px',
              color: colors.primary,
              fontSize: '0.75rem',
              cursor: 'pointer',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              minHeight: '44px',
            }}
            onClick={() => onApply?.(kingdom.kingdom_number)}
          >
            Apply to Transfer
          </button>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes goldGlow {
          0%, 100% { box-shadow: 0 0 8px #fbbf2415; }
          50% { box-shadow: 0 0 20px #fbbf2425; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

// =============================================
// MAIN TRANSFER HUB PAGE
// =============================================

const TransferBoard: React.FC = () => {
  const { user, profile } = useAuth();
  const isMobile = useIsMobile();
  const { trackFeature } = useAnalytics();

  // Access gate: owner-only during pre-launch
  // Check all possible username sources (Discord stores in full_name/name/preferred_username, not username)
  const isOwner = isAdminEmail(user?.email)
    || isAdminUsername(user?.user_metadata?.username)
    || isAdminUsername(user?.user_metadata?.preferred_username)
    || isAdminUsername(user?.user_metadata?.full_name)
    || isAdminUsername(user?.user_metadata?.name)
    || isAdminUsername(profile?.discord_username)
    || isAdminUsername(profile?.linked_username)
    || isAdminUsername(profile?.username);
  if (!isOwner) {
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
          Coming soon.
        </p>
        <p style={{ color: '#6b7280', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
          The Transfer Hub is currently in private beta. Stay tuned for the public launch.
        </p>
        <Link to="/" style={{
          display: 'inline-block', padding: '0.6rem 1.5rem',
          backgroundColor: '#22d3ee', color: '#000', borderRadius: '8px',
          fontWeight: '600', fontSize: '0.85rem', textDecoration: 'none',
          minHeight: '44px', lineHeight: '44px',
        }}>
          Back to Atlas
        </Link>
      </div>
    );
  }

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
  const [applyingToKingdom, setApplyingToKingdom] = useState<number | null>(null);
  const [activeAppCount, setActiveAppCount] = useState(0);
  const [appRefreshKey, setAppRefreshKey] = useState(0);
  const [showRecruiterDash, setShowRecruiterDash] = useState(false);
  const [isEditor, setIsEditor] = useState(false);
  const [contributingToKingdom, setContributingToKingdom] = useState<number | null>(null);
  const [showContributionSuccess, setShowContributionSuccess] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
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
        .select('id')
        .eq('user_id', user.id)
        .single();
      setHasTransferProfile(!!data);
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
    checkProfile();
    countActiveApps();
    checkEditor();
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
          .select('kingdom_number, atlas_score, current_rank, total_kvks, prep_wins, prep_losses, prep_win_rate, battle_wins, battle_losses, battle_win_rate, dominations, invasions')
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
    localStorage.setItem('atlas_transfer_hub_mode', selectedMode);
    localStorage.setItem('atlas_transfer_hub_visited', 'true');
    setShowEntryModal(false);
  };

  // Handle mode toggle change
  const handleModeChange = (newMode: BoardMode) => {
    setMode(newMode);
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

  // Filter and sort kingdoms
  const filteredKingdoms = useMemo(() => {
    let result = [...kingdoms];

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
      default:
        break;
    }

    return result;
  }, [kingdoms, filters, fundMap]);

  // Calculate match score for transferring mode
  const calculateMatchScore = (kingdom: KingdomData, fund: KingdomFund | null): number => {
    if (!hasTransferProfile || !fund) return 0;
    
    // Use transfer profile data instead of user profile
    const transferProfile = {
      power_range: '0 - 50M', // Default if not set
      tc_level: 1,
      main_language: 'English',
      kvk_participation: 'most'
    };
    
    let score = 50; // Base score
    
    // Power range matching
    if (fund.min_power_range && transferProfile.power_range) {
      const userPower = parseInt(transferProfile.power_range.split(' - ')[1]) || 0;
      const minPower = parseInt(fund.min_power_range.split(' - ')[1]) || 0;
      if (userPower >= minPower) score += 20;
      else score -= 20;
    }
    
    // TC level matching
    if (fund.min_tc_level && transferProfile.tc_level) {
      if (transferProfile.tc_level >= fund.min_tc_level) score += 15;
      else score -= 15;
    }
    
    // Language matching
    if (fund.main_language && transferProfile.main_language) {
      if (fund.main_language === transferProfile.main_language) score += 10;
      else if (fund.secondary_languages?.includes(transferProfile.main_language)) score += 5;
    }
    
    // KvK participation matching
    if (transferProfile.kvk_participation === 'every' && fund.recruitment_tags?.includes('Active KvK')) score += 5;
    
    return Math.max(0, Math.min(100, score));
  };

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
              onClick={() => setShowRecruiterDash(true)}
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
      {contributingToKingdom && (
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
            const matchScore = mode === 'transferring' ? calculateMatchScore(kingdom, fund) : undefined;
            return (
              <KingdomListingCard
                key={kingdom.kingdom_number}
                kingdom={kingdom}
                fund={fund}
                reviewSummary={reviewMap.get(kingdom.kingdom_number) || null}
                mode={mode}
                matchScore={matchScore}
                onApply={(kn) => setApplyingToKingdom(kn)}
                onFund={(kn) => setContributingToKingdom(kn)}
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
            const matchScore = mode === 'transferring' ? calculateMatchScore(kingdom, fund) : undefined;
            return (
              <KingdomListingCard
                key={kingdom.kingdom_number}
                kingdom={kingdom}
                fund={fund}
                reviewSummary={reviewMap.get(kingdom.kingdom_number) || null}
                mode={mode}
                matchScore={matchScore}
                onApply={(kn) => setApplyingToKingdom(kn)}
                onFund={(kn) => setContributingToKingdom(kn)}
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
              color: '#6b7280',
            }}>
              <p style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>No kingdoms match your filters</p>
              <p style={{ fontSize: '0.85rem' }}>Try adjusting your filters or clearing them</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TransferBoard;
