import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useAnalytics } from '../hooks/useAnalytics';
import PageTitle from '../components/PageTitle';
import KvKCountdown from '../components/KvKCountdown';
import { supabase } from '../lib/supabase';
import TransferProfileForm from '../components/TransferProfileForm';
import { ApplyModal, MyApplicationsTracker } from '../components/TransferApplications';
import { neonGlow, FONT_DISPLAY, shadows, statTypeStyles } from '../utils/styles';

// =============================================
// TYPES
// =============================================

interface KingdomData {
  kingdom_number: number;
  kingdom_name: string;
  overall_score: number;
  tier: string;
  rank: number;
  total_kvks: number;
  prep_wins: number;
  prep_losses: number;
  prep_win_rate: number;
  battle_wins: number;
  battle_losses: number;
  battle_win_rate: number;
  dominations: number;
  invasions: number;
  transfer_status: string;
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

const TIER_COLORS: Record<string, string> = {
  gold: '#fbbf24',
  silver: '#9ca3af',
  bronze: '#cd7f32',
  standard: '#4b5563',
};

const TIER_BORDER_STYLES: Record<string, string> = {
  gold: '2px solid #fbbf24',
  silver: '2px solid #9ca3af80',
  bronze: '2px solid #cd7f3280',
  standard: '1px solid #2a2a2a',
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
  S: '#fbbf24',
  A: '#22c55e',
  B: '#3b82f6',
  C: '#f97316',
  D: '#ef4444',
  F: '#6b7280',
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
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#111111',
          border: '1px solid #2a2a2a',
          borderRadius: '16px',
          padding: isMobile ? '1.5rem' : '2rem',
          maxWidth: '500px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h2
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: isMobile ? '1.2rem' : '1.4rem',
              color: '#fff',
              margin: '0 0 0.5rem 0',
            }}
          >
            What brings you here?
          </h2>
          <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: 0 }}>
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
                backgroundColor: '#0a0a0a',
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
                e.currentTarget.style.backgroundColor = '#0a0a0a';
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>{opt.icon}</span>
              <div>
                <div style={{ color: '#fff', fontWeight: '600', fontSize: '0.9rem' }}>
                  {opt.title}
                </div>
                <div style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.25rem' }}>
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
        backgroundColor: '#0a0a0a',
        border: '1px solid #2a2a2a',
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
            backgroundColor: mode === tab.mode ? '#22d3ee15' : 'transparent',
            color: mode === tab.mode ? '#22d3ee' : '#6b7280',
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
    backgroundColor: '#0a0a0a',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '0.8rem',
    minHeight: '44px',
    cursor: 'pointer',
  };

  const activeFilterCount = Object.entries(filters).filter(([key, val]) => {
    if (key === 'sortBy') return false;
    if (typeof val === 'boolean') return val;
    return val !== '' && val !== 'all';
  }).length;

  return (
    <div style={{
      backgroundColor: '#111111',
      border: '1px solid #2a2a2a',
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
          color: '#fff',
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
              backgroundColor: '#22d3ee',
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
          borderTop: '1px solid #2a2a2a',
        }}>
          <div>
            <label style={{ color: '#9ca3af', fontSize: '0.7rem', marginBottom: '0.25rem', display: 'block' }}>Fund Tier</label>
            <select value={filters.tier} onChange={(e) => update('tier', e.target.value)} style={selectStyle}>
              <option value="all">All Tiers</option>
              <option value="gold">Gold</option>
              <option value="silver">Silver</option>
              <option value="bronze">Bronze</option>
              <option value="standard">Standard</option>
            </select>
          </div>
          <div>
            <label style={{ color: '#9ca3af', fontSize: '0.7rem', marginBottom: '0.25rem', display: 'block' }}>Language</label>
            <select value={filters.language} onChange={(e) => update('language', e.target.value)} style={selectStyle}>
              <option value="all">All Languages</option>
              {LANGUAGE_OPTIONS.map((lang) => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ color: '#9ca3af', fontSize: '0.7rem', marginBottom: '0.25rem', display: 'block' }}>Sort By</label>
            <select value={filters.sortBy} onChange={(e) => update('sortBy', e.target.value)} style={selectStyle}>
              <option value="tier">Fund Tier (High → Low)</option>
              <option value="score">Atlas Score (High → Low)</option>
              <option value="rank">Rank (Best → Worst)</option>
              <option value="match">Match Score (Best → Worst)</option>
            </select>
          </div>
          <div>
            <label style={{ color: '#9ca3af', fontSize: '0.7rem', marginBottom: '0.25rem', display: 'block' }}>Recruitment Tag</label>
            <select value={filters.tag} onChange={(e) => update('tag', e.target.value)} style={selectStyle}>
              <option value="all">All Tags</option>
              {RECRUITMENT_TAG_OPTIONS.map((tag) => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ color: '#9ca3af', fontSize: '0.7rem', marginBottom: '0.25rem', display: 'block' }}>Min Atlas Score</label>
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
              <label style={{ color: '#9ca3af', fontSize: '0.7rem', marginBottom: '0.25rem', display: 'block' }}>Min Match Score</label>
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
              color: '#9ca3af', fontSize: '0.8rem', cursor: 'pointer', minHeight: '44px',
            }}>
              <input
                type="checkbox"
                checked={filters.isRecruiting}
                onChange={(e) => update('isRecruiting', e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#22d3ee' }}
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
                  border: '1px solid #ef444440',
                  borderRadius: '8px',
                  color: '#ef4444',
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
}> = ({ kingdom, fund, reviewSummary, mode, matchScore, onApply }) => {
  const isMobile = useIsMobile();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const fundTier = fund?.tier || 'standard';
  const tierColor = TIER_COLORS[fundTier];
  const scoreTierColor = SCORE_TIER_COLORS[kingdom.tier] || '#6b7280';
  const isGold = fundTier === 'gold';
  const isSilver = fundTier === 'silver';

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
        backgroundColor: '#111111',
        border: TIER_BORDER_STYLES[fundTier],
        borderRadius: '12px',
        overflow: 'hidden',
        transition: 'all 0.2s',
        boxShadow: isHovered && fundTier !== 'standard'
          ? `0 0 20px ${tierColor}20`
          : shadows.card,
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
                color: '#fff',
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
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? '0.75rem' : '1.5rem',
          flexWrap: 'wrap',
        }}>
          <div>
            <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>Atlas Score</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{
                fontFamily: "'Orbitron', monospace",
                fontWeight: 'bold',
                fontSize: '1.1rem',
                ...neonGlow(scoreTierColor),
              }}>
                {kingdom.overall_score?.toFixed(1) || '—'}
              </span>
              <span style={{
                padding: '0.1rem 0.35rem',
                backgroundColor: `${scoreTierColor}20`,
                borderRadius: '4px',
                fontSize: '0.65rem',
                fontWeight: 'bold',
                color: scoreTierColor,
              }}>
                {kingdom.tier}-Tier
              </span>
              <span style={{ color: scoreTierColor, fontSize: '0.75rem' }}>
                (#{kingdom.rank})
              </span>
            </div>
          </div>
          <div>
            <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>Prep Win Rate</span>
            <div style={{ color: statTypeStyles.prepPhase.color, fontWeight: '600', fontSize: '0.9rem' }}>
              {kingdom.prep_win_rate != null ? `${(kingdom.prep_win_rate * 100).toFixed(0)}%` : '—'}
            </div>
          </div>
          <div>
            <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>Battle Win Rate</span>
            <div style={{ color: statTypeStyles.battlePhase.color, fontWeight: '600', fontSize: '0.9rem' }}>
              {kingdom.battle_win_rate != null ? `${(kingdom.battle_win_rate * 100).toFixed(0)}%` : '—'}
            </div>
          </div>
          <div>
            <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>KvKs</span>
            <div style={{ color: '#fff', fontWeight: '600', fontSize: '0.9rem' }}>
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
                backgroundColor: '#22d3ee10',
                border: '1px solid #22d3ee25',
                borderRadius: '4px',
                fontSize: '0.65rem',
                color: '#22d3ee',
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
            fontSize: '0.7rem', color: '#9ca3af',
          }}>
            {fund.min_tc_level && (
              <span>Requires TC{fund.min_tc_level}+</span>
            )}
            {fund.min_power_range && fund.min_power_range !== 'Any' && (
              <span>• {fund.min_power_range} power</span>
            )}
          </div>
        )}

        {/* Recruitment Pitch (Silver+) - visible in collapsed view */}
        {(isSilver || isGold) && fund?.recruitment_pitch && (
          <p style={{
            color: '#d1d5db',
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
            <span style={{ color: '#9ca3af', fontSize: '0.7rem' }}>
              {reviewSummary.avg_rating.toFixed(1)} ({reviewSummary.review_count} review{reviewSummary.review_count !== 1 ? 's' : ''})
            </span>
          </div>
        )}
      </div>

      {/* Expandable Sections */}
      <div style={{ borderTop: '1px solid #1a1a1a' }}>
        {/* Performance Section */}
        <button
          onClick={() => toggleSection('performance')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', padding: '0.6rem 1rem',
            backgroundColor: expandedSection === 'performance' ? '#0a0a0a' : 'transparent',
            border: 'none', borderBottom: '1px solid #1a1a1a',
            color: '#9ca3af', fontSize: '0.8rem', cursor: 'pointer',
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
            backgroundColor: '#0a0a0a',
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
            gap: '0.75rem',
          }}>
            <div>
              <span style={{ color: statTypeStyles.prepPhase.color, fontSize: '0.65rem' }}>{statTypeStyles.prepPhase.emoji} Prep Win Rate</span>
              <div style={{ color: '#fff', fontWeight: '600' }}>
                {kingdom.prep_win_rate != null ? `${(kingdom.prep_win_rate * 100).toFixed(1)}%` : '—'}
                <span style={{ color: '#6b7280', fontSize: '0.7rem', fontWeight: 'normal' }}> ({kingdom.prep_wins}W-{kingdom.prep_losses}L)</span>
              </div>
            </div>
            <div>
              <span style={{ color: statTypeStyles.battlePhase.color, fontSize: '0.65rem' }}>{statTypeStyles.battlePhase.emoji} Battle Win Rate</span>
              <div style={{ color: '#fff', fontWeight: '600' }}>
                {kingdom.battle_win_rate != null ? `${(kingdom.battle_win_rate * 100).toFixed(1)}%` : '—'}
                <span style={{ color: '#6b7280', fontSize: '0.7rem', fontWeight: 'normal' }}> ({kingdom.battle_wins}W-{kingdom.battle_losses}L)</span>
              </div>
            </div>
            <div>
              <span style={{ color: statTypeStyles.domination.color, fontSize: '0.65rem' }}>{statTypeStyles.domination.emoji} Dominations</span>
              <div style={{ color: '#fff', fontWeight: '600' }}>{kingdom.dominations || 0}</div>
            </div>
            <div>
              <span style={{ color: statTypeStyles.invasion.color, fontSize: '0.65rem' }}>{statTypeStyles.invasion.emoji} Invasions</span>
              <div style={{ color: '#fff', fontWeight: '600' }}>{kingdom.invasions || 0}</div>
            </div>
            <div>
              <span style={{ color: '#9ca3af', fontSize: '0.65rem' }}>Total KvKs</span>
              <div style={{ color: '#fff', fontWeight: '600' }}>{kingdom.total_kvks || 0}</div>
            </div>
            <div>
              <span style={{ color: '#9ca3af', fontSize: '0.65rem' }}>Rank</span>
              <div style={{ color: scoreTierColor, fontWeight: '600' }}>#{kingdom.rank}</div>
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
                backgroundColor: expandedSection === 'recruitment' ? '#0a0a0a' : 'transparent',
                border: 'none', borderBottom: '1px solid #1a1a1a',
                color: '#9ca3af', fontSize: '0.8rem', cursor: 'pointer',
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
              <div style={{ padding: '0.75rem 1rem', backgroundColor: '#0a0a0a' }}>
                {fund.main_language && (
                  <div style={{ marginBottom: '0.5rem' }}>
                    <span style={{ color: '#6b7280', fontSize: '0.7rem' }}>Language: </span>
                    <span style={{ color: '#fff', fontSize: '0.8rem' }}>{fund.main_language}</span>
                    {fund.secondary_languages.length > 0 && (
                      <span style={{ color: '#6b7280', fontSize: '0.75rem' }}> + {fund.secondary_languages.join(', ')}</span>
                    )}
                  </div>
                )}
                {fund.event_times && fund.event_times.length > 0 && (
                  <div style={{ marginBottom: '0.5rem' }}>
                    <span style={{ color: '#6b7280', fontSize: '0.7rem' }}>Event Times (UTC): </span>
                    <span style={{ color: '#fff', fontSize: '0.8rem' }}>
                      {fund.event_times.map((t) => `${t.start} - ${t.end}`).join(', ')}
                    </span>
                  </div>
                )}
                {fund.contact_link && (
                  <div style={{ marginBottom: '0.5rem' }}>
                    <span style={{ color: '#6b7280', fontSize: '0.7rem' }}>Contact: </span>
                    <a href={fund.contact_link} target="_blank" rel="noopener noreferrer"
                      style={{ color: '#22d3ee', fontSize: '0.8rem' }}
                    >
                      Discord Invite ↗
                    </a>
                  </div>
                )}
                {isGold && fund.what_we_offer && (
                  <div style={{ marginBottom: '0.5rem', padding: '0.5rem', backgroundColor: '#111', borderRadius: '8px' }}>
                    <span style={{ color: '#22c55e', fontSize: '0.7rem', fontWeight: 'bold' }}>What We Offer</span>
                    <p style={{ color: '#d1d5db', fontSize: '0.8rem', margin: '0.25rem 0 0 0', lineHeight: 1.4 }}>{fund.what_we_offer}</p>
                  </div>
                )}
                {isGold && fund.what_we_want && (
                  <div style={{ padding: '0.5rem', backgroundColor: '#111', borderRadius: '8px' }}>
                    <span style={{ color: '#f97316', fontSize: '0.7rem', fontWeight: 'bold' }}>What We're Looking For</span>
                    <p style={{ color: '#d1d5db', fontSize: '0.8rem', margin: '0.25rem 0 0 0', lineHeight: 1.4 }}>{fund.what_we_want}</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Community Section */}
        <button
          onClick={() => toggleSection('community')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', padding: '0.6rem 1rem',
            backgroundColor: expandedSection === 'community' ? '#0a0a0a' : 'transparent',
            border: 'none',
            color: '#9ca3af', fontSize: '0.8rem', cursor: 'pointer',
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
          <div style={{ padding: '0.75rem 1rem', backgroundColor: '#0a0a0a' }}>
            {reviewSummary && reviewSummary.review_count > 0 ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', gap: '0.1rem', fontSize: '0.9rem' }}>
                    {renderStars(reviewSummary.avg_rating)}
                  </div>
                  <span style={{ color: '#fff', fontWeight: '600', fontSize: '0.85rem' }}>
                    {reviewSummary.avg_rating.toFixed(1)}
                  </span>
                  <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                    ({reviewSummary.review_count} review{reviewSummary.review_count !== 1 ? 's' : ''})
                  </span>
                </div>
                {reviewSummary.top_review_comment && (
                  <div style={{
                    padding: '0.5rem 0.75rem',
                    backgroundColor: '#111',
                    borderRadius: '8px',
                    borderLeft: '3px solid #fbbf24',
                  }}>
                    <p style={{ color: '#d1d5db', fontSize: '0.8rem', margin: 0, fontStyle: 'italic', lineHeight: 1.4 }}>
                      "{reviewSummary.top_review_comment}"
                    </p>
                    {reviewSummary.top_review_author && (
                      <span style={{ color: '#6b7280', fontSize: '0.7rem' }}>— {reviewSummary.top_review_author}</span>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p style={{ color: '#4b5563', fontSize: '0.8rem', margin: 0 }}>No community reviews yet</p>
            )}
          </div>
        )}
      </div>

      {/* Card Footer - CTA */}
      <div style={{
        padding: '0.75rem 1rem',
        borderTop: '1px solid #1a1a1a',
        display: 'flex',
        gap: '0.5rem',
        justifyContent: 'flex-end',
      }}>
        <Link
          to={`/kingdom/${kingdom.kingdom_number}`}
          style={{
            padding: '0.4rem 0.75rem',
            backgroundColor: 'transparent',
            border: '1px solid #2a2a2a',
            borderRadius: '8px',
            color: '#9ca3af',
            fontSize: '0.75rem',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            minHeight: '36px',
          }}
        >
          View Profile
        </Link>
        {mode === 'transferring' && fundTier !== 'standard' && (
          <button
            style={{
              padding: '0.4rem 0.75rem',
              backgroundColor: '#22d3ee15',
              border: '1px solid #22d3ee40',
              borderRadius: '8px',
              color: '#22d3ee',
              fontSize: '0.75rem',
              cursor: 'pointer',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              minHeight: '36px',
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
      `}</style>
    </div>
  );
};

// =============================================
// COMING SOON BANNER
// =============================================

const ComingSoonBanner: React.FC = () => {
  const isMobile = useIsMobile();
  return (
    <div style={{
      backgroundColor: '#f59e0b10',
      border: '1px solid #f59e0b30',
      borderRadius: '12px',
      padding: isMobile ? '1rem' : '1.25rem',
      marginBottom: '1.5rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
    }}>
      <span style={{ fontSize: '1.5rem' }}>🚧</span>
      <div>
        <span style={{ color: '#f59e0b', fontWeight: '700', fontSize: '0.9rem' }}>Coming Soon</span>
        <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '0.25rem 0 0 0' }}>
          The Transfer Board is under construction. Kingdom listings, transfer profiles, and the application system are being built. Stay tuned!
        </p>
      </div>
    </div>
  );
};

// =============================================
// MAIN TRANSFER BOARD PAGE
// =============================================

const TransferBoard: React.FC = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { trackFeature } = useAnalytics();

  // Mode state — persisted in localStorage
  const [mode, setMode] = useState<BoardMode>(() => {
    const saved = localStorage.getItem('atlas_transfer_board_mode');
    return (saved as BoardMode) || 'browsing';
  });
  const [showEntryModal, setShowEntryModal] = useState(() => {
    return !localStorage.getItem('atlas_transfer_board_visited');
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

  // Track page view
  useEffect(() => {
    trackFeature('Transfer Board');
  }, [trackFeature]);

  // Check if user has a transfer profile + count active applications
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
    checkProfile();
    countActiveApps();
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
          .select('kingdom_number, kingdom_name, overall_score, tier, rank, total_kvks, prep_wins, prep_losses, prep_win_rate, battle_wins, battle_losses, battle_win_rate, dominations, invasions, transfer_status')
          .order('rank', { ascending: true });

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
        console.error('Transfer Board data load error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Handle entry modal selection
  const handleModeSelect = (selectedMode: BoardMode) => {
    setMode(selectedMode);
    localStorage.setItem('atlas_transfer_board_mode', selectedMode);
    localStorage.setItem('atlas_transfer_board_visited', 'true');
    setShowEntryModal(false);
  };

  // Handle mode toggle change
  const handleModeChange = (newMode: BoardMode) => {
    setMode(newMode);
    localStorage.setItem('atlas_transfer_board_mode', newMode);
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
      result = result.filter((k) => (k.overall_score || 0) >= min);
    }

    if (filters.maxScore) {
      const max = parseFloat(filters.maxScore);
      result = result.filter((k) => (k.overall_score || 0) <= max);
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
          return (b.overall_score || 0) - (a.overall_score || 0);
        });
        break;
      case 'score':
        result.sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0));
        break;
      case 'rank':
        result.sort((a, b) => (a.rank || 9999) - (b.rank || 9999));
        break;
      default:
        break;
    }

    return result;
  }, [kingdoms, filters, fundMap]);

  const kingdomsWithFunds = filteredKingdoms.filter((k) => fundMap.has(k.kingdom_number));
  const kingdomsWithoutFunds = filteredKingdoms.filter((k) => !fundMap.has(k.kingdom_number));

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {showEntryModal && (
        <EntryModal
          onSelect={handleModeSelect}
          onClose={() => {
            localStorage.setItem('atlas_transfer_board_visited', 'true');
            setShowEntryModal(false);
          }}
        />
      )}

      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <PageTitle tagline="No more blind migrations. Find your perfect kingdom.">
          TRANSFER BOARD
        </PageTitle>
      </div>

      {/* Coming Soon Banner */}
      <ComingSoonBanner />

      {/* Transfer Event Countdown */}
      <div style={{
        display: 'flex',
        gap: '0.75rem',
        marginBottom: '1.25rem',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        <KvKCountdown type="transfer" />
        <KvKCountdown type="kvk" />
      </div>

      {/* Mode Toggle + Stats Row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
        marginBottom: '1rem',
      }}>
        <ModeToggle mode={mode} onChange={handleModeChange} />
        <div style={{ display: 'flex', gap: '1rem', color: '#6b7280', fontSize: '0.75rem' }}>
          <span>{filteredKingdoms.length} kingdoms</span>
          <span>{funds.filter((f) => f.is_recruiting).length} recruiting</span>
        </div>
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

      {/* Filters */}
      <div style={{ marginBottom: '1rem' }}>
        <FilterPanel filters={filters} onChange={setFilters} mode={mode} />
      </div>

      {/* Kingdom Listings */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: '#6b7280' }}>
          Loading kingdoms...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Funded kingdoms first */}
          {kingdomsWithFunds.map((kingdom) => (
            <KingdomListingCard
              key={kingdom.kingdom_number}
              kingdom={kingdom}
              fund={fundMap.get(kingdom.kingdom_number) || null}
              reviewSummary={reviewMap.get(kingdom.kingdom_number) || null}
              mode={mode}
              onApply={(kn) => setApplyingToKingdom(kn)}
            />
          ))}

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

          {/* Standard (unfunded) kingdoms */}
          {kingdomsWithoutFunds.slice(0, 50).map((kingdom) => (
            <KingdomListingCard
              key={kingdom.kingdom_number}
              kingdom={kingdom}
              fund={null}
              reviewSummary={reviewMap.get(kingdom.kingdom_number) || null}
              mode={mode}
              onApply={(kn) => setApplyingToKingdom(kn)}
            />
          ))}

          {kingdomsWithoutFunds.length > 50 && (
            <div style={{
              textAlign: 'center', padding: '1rem',
              color: '#6b7280', fontSize: '0.8rem',
            }}>
              Showing top 50 standard listings. Use filters to narrow results.
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
