import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { FONT_DISPLAY, statTypeStyles, colors } from '../utils/styles';
import { getPowerTier } from '../utils/atlasScoreFormula';
import SmartTooltip from './shared/SmartTooltip';

// =============================================
// TYPES (shared with TransferBoard)
// =============================================

export interface KingdomData {
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
  comebacks: number;
  reversals: number;
  invasions: number;
  most_recent_status: string | null;
}

export interface KingdomFund {
  kingdom_number: number;
  balance: number;
  tier: 'standard' | 'bronze' | 'silver' | 'gold';
  is_recruiting: boolean;
  recruitment_tags: string[];
  contact_link: string | null;
  min_tc_level: number | null;
  min_power_range: string | null;
  min_power_million: number | null;
  recruitment_pitch: string | null;
  main_language: string | null;
  secondary_languages: string[];
  event_times: Array<{ start: string; end: string }>;
  what_we_offer: string | null;
  what_we_want: string | null;
  highlighted_stats: string[];
  banner_theme: string;
  alliance_events: {
    alliances: string[];
    schedule: Record<string, string[][]>;
  } | null;
  kingdom_vibe: string[];
  nap_policy: boolean | null;
  sanctuary_distribution: boolean | null;
  castle_rotation: boolean | null;
}

export interface KingdomReviewSummary {
  kingdom_number: number;
  avg_rating: number;
  review_count: number;
  top_review_comment: string | null;
  top_review_author: string | null;
}

export interface MatchDetail {
  label: string;
  matched: boolean;
  detail: string;
}

export type BoardMode = 'transferring' | 'recruiting' | 'browsing';

// =============================================
// CONSTANTS
// =============================================

export const formatTCLevel = (tcLevel: number): string => {
  if (tcLevel <= 0) return '—';
  if (tcLevel <= 30) return `TC${tcLevel}`;
  if (tcLevel <= 34) return 'TC30';
  const tgLevel = Math.floor((tcLevel - 35) / 5) + 1;
  return `TG${tgLevel}`;
};

const TIER_COLORS: Record<string, string> = {
  gold: colors.gold,
  silver: colors.textSecondary,
  bronze: '#cd7f32',
  standard: colors.textMuted,
};

const SCORE_TIER_COLORS: Record<string, string> = {
  S: colors.gold,
  A: colors.success,
  B: colors.blue,
  C: colors.orange,
  D: colors.error,
  F: colors.textMuted,
};

const VIBE_LABELS: Record<string, string> = {
  competitive: 'Competitive', casual: 'Casual', kvk_focused: 'KvK-focused',
  community_focused: 'Community-focused', social: 'Social', drama_free: 'Drama-free',
  organized: 'Organized', beginner_friendly: 'Beginner-friendly',
};

// =============================================
// ALLIANCE EVENT TIMES GRID
// =============================================

const EVENT_TYPE_LABELS: Record<string, string> = {
  bear_hunt: 'Bear Hunt',
  viking_vengeance: 'Viking Vengeance',
  swordland_showdown: 'Swordland Showdown',
  tri_alliance_clash: 'Tri-Alliance Clash',
};

const EVENT_TYPES_ORDER = ['bear_hunt', 'viking_vengeance', 'swordland_showdown', 'tri_alliance_clash'];

const convertUtcToLocal = (utcTime: string): string => {
  const parts = utcTime.split(':').map(Number);
  const hours = parts[0];
  const minutes = parts[1];
  if (hours === undefined || minutes === undefined || isNaN(hours) || isNaN(minutes)) return utcTime;
  const now = new Date();
  const utcDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes));
  return utcDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
};

const AllianceEventTimesGrid: React.FC<{
  allianceEvents: {
    alliances: string[];
    schedule: Record<string, string[][]>;
  };
}> = ({ allianceEvents }) => {
  const [showLocal, setShowLocal] = useState(false);
  const { alliances, schedule } = allianceEvents;

  if (alliances.length === 0) return null;

  const formatSlots = (slots: string[] | undefined): string => {
    if (!slots || slots.length === 0 || slots.every(s => !s)) return '—';
    const filtered = slots.filter(s => s);
    return filtered.map(s => showLocal ? convertUtcToLocal(s) : s).join(' & ');
  };

  return (
    <div style={{ marginBottom: '0.6rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
        <span style={{ color: colors.textMuted, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Alliance Event Times
        </span>
        <button
          onClick={() => setShowLocal(!showLocal)}
          style={{
            background: 'none',
            border: `1px solid ${colors.border}`,
            borderRadius: '4px',
            padding: '0.1rem 0.4rem',
            fontSize: '0.55rem',
            color: showLocal ? '#22d3ee' : colors.textMuted,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {showLocal ? '🕐 Local Time' : '🌐 UTC'}
        </button>
      </div>
      <div style={{
        border: `1px solid ${colors.border}`,
        borderRadius: '6px',
        overflow: 'hidden',
      }}>
        {/* Header row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `1fr ${alliances.map(() => '1fr').join(' ')}`,
          backgroundColor: colors.surface,
          borderBottom: `1px solid ${colors.border}`,
        }}>
          <div style={{ padding: '0.3rem 0.4rem', fontSize: '0.55rem', color: colors.textMuted, fontWeight: '600' }}>
            Event
          </div>
          {alliances.map((tag, i) => (
            <div key={i} style={{
              padding: '0.3rem 0.4rem',
              fontSize: '0.55rem',
              color: colors.primary,
              fontWeight: '700',
              textAlign: 'center',
              borderLeft: `1px solid ${colors.border}`,
            }}>
              {tag}
            </div>
          ))}
        </div>
        {/* Data rows */}
        {EVENT_TYPES_ORDER.map((eventType, rowIdx) => (
          <div key={eventType} style={{
            display: 'grid',
            gridTemplateColumns: `1fr ${alliances.map(() => '1fr').join(' ')}`,
            borderBottom: rowIdx < EVENT_TYPES_ORDER.length - 1 ? `1px solid ${colors.border}` : 'none',
          }}>
            <div style={{
              padding: '0.3rem 0.4rem',
              fontSize: '0.55rem',
              color: colors.textSecondary,
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
            }}>
              {EVENT_TYPE_LABELS[eventType]}
            </div>
            {alliances.map((_, aIdx) => {
              const slots = schedule[eventType]?.[aIdx];
              return (
                <div key={aIdx} style={{
                  padding: '0.25rem 0.3rem',
                  fontSize: '0.6rem',
                  color: slots && slots.some(s => s) ? colors.text : colors.textMuted,
                  fontWeight: '500',
                  textAlign: 'center',
                  borderLeft: `1px solid ${colors.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {formatSlots(slots)}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

// =============================================
// KINGDOM LISTING CARD
// =============================================

export interface KingdomListingCardProps {
  kingdom: KingdomData;
  fund: KingdomFund | null;
  reviewSummary: KingdomReviewSummary | null;
  mode: BoardMode;
  matchScore?: number;
  matchDetails?: MatchDetail[];
  onApply?: (kingdomNumber: number) => void;
  onFund?: (kingdomNumber: number) => void;
}

const KingdomListingCard: React.FC<KingdomListingCardProps> = ({ kingdom, fund, reviewSummary, mode, matchScore, matchDetails, onApply, onFund }) => {
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
  const isPremium = fundTier !== 'standard';

  // Check if user can fund this kingdom (only their own kingdom)
  const canFundKingdom = profile?.linked_kingdom === kingdom.kingdom_number;
  // Prevent applying to own kingdom
  const isOwnKingdom = profile?.linked_kingdom === kingdom.kingdom_number;

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

  // Score tier letter for chip
  const tierLetter = scoreTier.charAt(0);
  const isSTier = scoreTier === 'S';

  // Transfer status
  const transferStatus = kingdom.most_recent_status || 'Unknown';

  // Border styling
  const borderWidth = isGold ? 3 : isPremium ? 2 : 1;
  const borderColor = isPremium ? tierColor : colors.border;

  // Min power display helper — prefer new min_power_million, fallback to min_power_range
  const getMinPowerDisplay = (): string | null => {
    if (fund?.min_power_million) return `${fund.min_power_million}M`;
    const val = fund?.min_power_range;
    if (!val || val === 'Any') return null;
    const numVal = parseInt(val, 10);
    if (!isNaN(numVal) && String(numVal) === val) return `${numVal}M`;
    return val;
  };
  const minPowerDisplay = getMinPowerDisplay();

  // Gold shimmer border uses a wrapper approach
  const cardContent = (
    <div
      style={{
        position: 'relative',
        backgroundColor: colors.surface,
        borderRadius: isGold ? '12px' : '14px',
        overflow: 'hidden',
        ...(isGold ? {} : {
          border: `${borderWidth}px solid ${borderColor}`,
          transition: 'all 0.3s ease',
          boxShadow: isHovered
            ? isPremium
              ? `0 0 24px ${tierColor}30, 0 0 48px ${tierColor}10, 0 4px 16px rgba(0,0,0,0.4)`
              : '0 4px 16px rgba(0,0,0,0.4)'
            : isPremium
              ? `0 0 12px ${tierColor}15, 0 2px 8px rgba(0,0,0,0.3)`
              : '0 2px 8px rgba(0,0,0,0.2)',
        }),
      }}
    >
      {/* Card Header */}
      <div style={{ padding: isMobile ? '0.75rem' : '1rem' }}>

        {/* Top row: Kingdom Name + Tier on left, badges on right */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap',
        }}>
          {/* Left: Kingdom Name + Score Tier chip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Link
              to={`/kingdom/${kingdom.kingdom_number}`}
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: isMobile ? '1.15rem' : '1.3rem',
                color: colors.text,
                textDecoration: 'none',
                fontWeight: '700',
                letterSpacing: '0.02em',
              }}
            >
              Kingdom {kingdom.kingdom_number}
            </Link>
            <span
              className={isSTier ? 's-tier-badge' : undefined}
              style={{
                padding: '0.1rem 0.4rem',
                backgroundColor: `${scoreTierColor}20`,
                border: `1px solid ${scoreTierColor}50`,
                borderRadius: '4px',
                fontSize: '0.65rem',
                fontWeight: 'bold',
                color: scoreTierColor,
                ...(isSTier ? {
                  boxShadow: `0 0 8px ${scoreTierColor}40`,
                  textShadow: `0 0 6px ${scoreTierColor}60`,
                } : {}),
              }}
            >
              {tierLetter}
            </span>
          </div>

          {/* Right: Recruiting badge + Match Score */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {fund?.is_recruiting && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                padding: '0.2rem 0.6rem',
                backgroundColor: '#22c55e12',
                border: '1px solid #22c55e35',
                borderRadius: '6px',
                fontSize: '0.65rem',
                color: '#22c55e',
                fontWeight: 'bold',
                letterSpacing: '0.03em',
              }}>
                <span style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  backgroundColor: '#22c55e', display: 'inline-block',
                  animation: 'pulse 2s infinite',
                }}/>
                RECRUITING
              </div>
            )}
            {mode === 'transferring' && matchScore !== undefined && matchScore > 0 && (
              <span
                style={{
                  padding: '0.2rem 0.5rem',
                  backgroundColor: matchScore >= 75 ? '#22c55e12' : matchScore >= 50 ? '#eab30812' : '#ef444412',
                  border: `1px solid ${matchScore >= 75 ? '#22c55e35' : matchScore >= 50 ? '#eab30835' : '#ef444435'}`,
                  borderRadius: '6px',
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                  color: matchScore >= 75 ? '#22c55e' : matchScore >= 50 ? '#eab308' : '#ef4444',
                  cursor: matchDetails ? 'help' : 'default',
                }}
                title={matchDetails ? matchDetails.map(d => `${d.matched ? '✅' : '❌'} ${d.label}: ${d.detail}`).join('\n') : undefined}
              >
                {matchScore}% match
              </span>
            )}
            {mode === 'transferring' && (!matchScore || matchScore === 0) && !profile?.linked_username && fund?.is_recruiting && (
              <Link to="/profile" style={{ textDecoration: 'none' }}>
                <span style={{
                  padding: '0.2rem 0.5rem',
                  backgroundColor: '#9ca3af08',
                  border: '1px solid #9ca3af20',
                  borderRadius: '6px',
                  fontSize: '0.65rem',
                  fontWeight: 'bold',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  cursor: 'pointer',
                }}>
                  <span style={{ color: '#4b5563', fontSize: '0.6rem' }}>Link to see match %</span>
                </span>
              </Link>
            )}
          </div>
        </div>

        {/* Transfer Status below name — with SmartTooltip */}
        <div style={{ marginBottom: '0.6rem' }}>
          <SmartTooltip
            accentColor={transferStatus === 'Leading' ? colors.gold : transferStatus === 'Ordinary' ? '#c0c0c0' : '#6b7280'}
            maxWidth={260}
            content={
              <div style={{ fontSize: '0.7rem' }}>
                <span style={{ color: transferStatus === 'Leading' ? colors.gold : transferStatus === 'Ordinary' ? '#c0c0c0' : '#9ca3af', fontWeight: 'bold' }}>
                  {transferStatus}
                </span>
                <span style={{ color: '#9ca3af', marginLeft: '0.3rem' }}>
                  — {transferStatus === 'Leading'
                    ? '20 regular invites, 10 open slots, lower power cap'
                    : transferStatus === 'Ordinary'
                    ? '35 regular invites, up to 3 special invites, 20 open slots, higher power cap'
                    : 'Transfer status not yet reported'}
                </span>
              </div>
            }
          >
            <span style={{ cursor: 'help' }}>
              <span style={{ fontSize: '0.7rem', color: colors.textMuted }}>
                Transfer Status:{' '}
              </span>
              <span style={{
                fontSize: '0.7rem',
                color: transferStatus === 'Leading' ? colors.gold
                  : transferStatus === 'Ordinary' ? '#c0c0c0'
                  : colors.textSecondary,
                fontWeight: '600',
              }}>
                {transferStatus}
              </span>
            </span>
          </SmartTooltip>
        </div>

        {/* 2-Column Layout: Performance | Characteristics */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: isMobile ? '0.5rem' : '0.6rem',
          marginBottom: '0.6rem',
        }}>
          {/* Performance Section — 2x4 grid */}
          <div style={{
            backgroundColor: colors.bg,
            borderRadius: '8px',
            padding: '0.6rem',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{ fontSize: '0.7rem', color: '#e5e7eb', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem', textAlign: 'center' }}>
              Performance
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '0.3rem',
              flex: 1,
            }}>
              {[
                { label: 'Atlas Score', value: kingdom.atlas_score ? `${kingdom.atlas_score.toFixed(2)} (#${kingdom.current_rank || '—'})` : '—', color: '#22d3ee', emoji: '💎', tooltip: 'Overall performance rating (0-100) combining prep & battle win rates, KvK outcomes, streaks and experience. Higher = stronger kingdom.' },
                { label: 'KvKs', value: `${kingdom.total_kvks || 0}`, color: colors.text, emoji: '⚡', tooltip: null },
                { label: 'Prep Win Rate', value: kingdom.prep_win_rate != null ? `${(kingdom.prep_win_rate * 100).toFixed(0)}%` : '—', color: statTypeStyles.prepPhase.color, emoji: '🛡️', tooltip: null },
                { label: 'Battle Win Rate', value: kingdom.battle_win_rate != null ? `${(kingdom.battle_win_rate * 100).toFixed(0)}%` : '—', color: statTypeStyles.battlePhase.color, emoji: '⚔️', tooltip: null },
                { label: 'Dominations', value: `${kingdom.dominations || 0}`, color: statTypeStyles.domination.color, emoji: '👑', tooltip: 'Won BOTH Prep Phase and Battle Phase in a KvK — the best possible outcome.' },
                { label: 'Comebacks', value: `${kingdom.comebacks || 0}`, color: '#3b82f6', emoji: '💪', tooltip: 'Lost Prep Phase but won Battle Phase — recovered from a slow start.' },
                { label: 'Reversals', value: `${kingdom.reversals || 0}`, color: '#a855f7', emoji: '🔄', tooltip: 'Won Prep Phase but lost Battle Phase — strong start that didn\'t hold.' },
                { label: 'Invasions', value: `${kingdom.invasions || 0}`, color: statTypeStyles.invasion.color, emoji: '💀', tooltip: 'Lost BOTH Prep Phase and Battle Phase — the worst possible outcome.' },
              ].map((stat) => {
                const statBox = (
                  <div style={{
                    textAlign: 'center',
                    padding: '0.3rem 0.2rem',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    cursor: stat.tooltip ? 'help' : 'default',
                    width: '100%',
                  }}>
                    <div style={{ fontSize: '0.55rem', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.05rem' }}>
                      {stat.emoji} {stat.label} {stat.emoji}
                    </div>
                    <div style={{ fontSize: stat.label === 'Atlas Score' ? '0.7rem' : '0.85rem', fontWeight: '600', color: stat.color, lineHeight: 1.2 }}>
                      {stat.value}
                    </div>
                  </div>
                );
                return stat.tooltip ? (
                  <SmartTooltip
                    key={stat.label}
                    accentColor={stat.color}
                    maxWidth={220}
                    style={{ width: '100%' }}
                    content={<span style={{ fontSize: '0.65rem', color: '#d1d5db', lineHeight: 1.4 }}>{stat.tooltip}</span>}
                  >
                    {statBox}
                  </SmartTooltip>
                ) : (
                  <div key={stat.label}>{statBox}</div>
                );
              })}
            </div>
          </div>

          {/* Characteristics Section — 4-row grid with empty states */}
          <div style={{
            backgroundColor: colors.bg,
            borderRadius: '8px',
            padding: '0.6rem',
          }}>
            <div style={{ fontSize: '0.7rem', color: '#e5e7eb', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem', textAlign: 'center' }}>
              Characteristics
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              {/* Row 1: Minimum Power + Minimum TC Level (2 cols) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem' }}>
                <div style={{
                  textAlign: 'center',
                  padding: '0.3rem 0.2rem',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  minHeight: '42px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}>
                  <div style={{ fontSize: '0.5rem', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.05rem' }}>
                    🔥 Minimum Power 🔥
                  </div>
                  <div style={{ fontSize: '0.8rem', fontWeight: '600', color: minPowerDisplay ? colors.text : colors.textMuted, lineHeight: 1.2 }}>
                    {minPowerDisplay || 'Not set'}
                  </div>
                </div>
                <div style={{
                  textAlign: 'center',
                  padding: '0.3rem 0.2rem',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  minHeight: '42px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}>
                  <div style={{ fontSize: '0.5rem', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.05rem' }}>
                    🏰 Minimum TC Level 🏰
                  </div>
                  <div style={{ fontSize: '0.8rem', fontWeight: '600', color: fund?.min_tc_level ? colors.text : colors.textMuted, lineHeight: 1.2 }}>
                    {fund?.min_tc_level ? formatTCLevel(fund.min_tc_level) : 'Not set'}
                  </div>
                </div>
              </div>
              {/* Row 2: Main Language + Secondary Language (2 cols) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem' }}>
                <div style={{
                  textAlign: 'center',
                  padding: '0.3rem 0.2rem',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  minHeight: '42px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}>
                  <div style={{ fontSize: '0.5rem', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.05rem' }}>
                    🌐 Main Language 🌐
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: '600', color: fund?.main_language ? colors.text : colors.textMuted, lineHeight: 1.2 }}>
                    {fund?.main_language || 'Not set'}
                  </div>
                </div>
                <div style={{
                  textAlign: 'center',
                  padding: '0.3rem 0.2rem',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  minHeight: '42px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}>
                  <div style={{ fontSize: '0.5rem', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.05rem' }}>
                    💬 Secondary Language 💬
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: '600', color: (fund?.secondary_languages && fund.secondary_languages.length > 0) ? colors.text : colors.textMuted, lineHeight: 1.2 }}>
                    {fund?.secondary_languages && fund.secondary_languages.length > 0 ? fund.secondary_languages.join(', ') : 'Not set'}
                  </div>
                </div>
              </div>
              {/* Row 3: Kingdom Vibe (full width, 1 row, with empty state) */}
              <div style={{
                padding: '0.35rem 0.4rem',
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
              }}>
                <div style={{ fontSize: '0.5rem', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.15rem', textAlign: 'center' }}>
                  ✨ Kingdom Vibe ✨
                </div>
                {fund?.kingdom_vibe && fund.kingdom_vibe.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', justifyContent: 'center' }}>
                    {fund.kingdom_vibe.map((vibe) => (
                      <span key={vibe} style={{
                        padding: '0.1rem 0.4rem',
                        backgroundColor: `${colors.primary}10`,
                        border: `1px solid ${colors.primary}25`,
                        borderRadius: '12px',
                        fontSize: '0.6rem',
                        color: colors.text,
                      }}>
                        {VIBE_LABELS[vibe] || vibe}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.7rem', color: colors.textMuted, fontStyle: 'italic' }}>
                    Not set — editors can add vibes in the Recruiter Dashboard
                  </div>
                )}
              </div>
              {/* Row 4: Kingdom Bio (full width, with empty state, 3 rows of space) */}
              <div style={{
                padding: '0.35rem 0.4rem',
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                minHeight: '80px',
                flex: 1,
              }}>
                <div style={{ fontSize: '0.5rem', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.15rem', textAlign: 'center' }}>
                  📝 Kingdom Bio 📝 {!(isSilver || isGold) && <span style={{ color: '#c0c0c0', fontSize: '0.45rem', fontWeight: 'normal', textTransform: 'none' }}>(Silver+)</span>}
                </div>
                {(isSilver || isGold) && fund?.recruitment_pitch ? (
                  <p style={{
                    color: colors.textSecondary,
                    fontSize: '0.7rem',
                    margin: 0,
                    lineHeight: 1.4,
                    fontStyle: 'italic',
                    wordBreak: 'break-word',
                  }}>
                    &ldquo;{fund.recruitment_pitch}&rdquo;
                  </p>
                ) : (isSilver || isGold) ? (
                  <div style={{ fontSize: '0.7rem', color: colors.textMuted, fontStyle: 'italic' }}>
                    Not set — add a bio in the Recruiter Dashboard (max 150 chars)
                  </div>
                ) : (
                  <div style={{ fontSize: '0.7rem', color: colors.textMuted, fontStyle: 'italic' }}>
                    Upgrade to Silver to add a kingdom bio
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expandable Sections */}
      <div style={{ borderTop: `1px solid ${colors.border}` }}>
        {/* More Details Section */}
        <button
          onClick={() => toggleSection('details')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', padding: '0.5rem 1rem',
            backgroundColor: expandedSection === 'details' ? colors.bg : 'transparent',
            border: 'none', borderBottom: `1px solid ${colors.border}`,
            color: colors.textSecondary, fontSize: '0.75rem', cursor: 'pointer',
            minHeight: '44px',
          }}
        >
          <span>📋 More Details</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ transform: expandedSection === 'details' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
          >
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>
        {expandedSection === 'details' && (
          <div style={{
            padding: '0.75rem 1rem',
            backgroundColor: colors.bg,
          }}>
            {/* NAP / Sanctuary / Castle Rotation — same row */}
            {fund && (fund.nap_policy !== null || fund.sanctuary_distribution !== null || fund.castle_rotation !== null) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.6rem' }}>
                {fund.nap_policy !== null && (
                  <span style={{
                    padding: '0.15rem 0.5rem',
                    backgroundColor: fund.nap_policy ? '#22c55e08' : '#ef444408',
                    border: `1px solid ${fund.nap_policy ? '#22c55e25' : '#ef444425'}`,
                    borderRadius: '6px',
                    fontSize: '0.65rem',
                    color: fund.nap_policy ? '#22c55e' : '#ef4444',
                  }}>
                    {fund.nap_policy ? '✓' : '✗'} NAP
                  </span>
                )}
                {fund.sanctuary_distribution !== null && (
                  <span style={{
                    padding: '0.15rem 0.5rem',
                    backgroundColor: fund.sanctuary_distribution ? '#22c55e08' : '#ef444408',
                    border: `1px solid ${fund.sanctuary_distribution ? '#22c55e25' : '#ef444425'}`,
                    borderRadius: '6px',
                    fontSize: '0.65rem',
                    color: fund.sanctuary_distribution ? '#22c55e' : '#ef4444',
                  }}>
                    {fund.sanctuary_distribution ? '✓' : '✗'} Sanctuary Distribution
                  </span>
                )}
                {fund.castle_rotation !== null && (
                  <span style={{
                    padding: '0.15rem 0.5rem',
                    backgroundColor: fund.castle_rotation ? '#22c55e08' : '#ef444408',
                    border: `1px solid ${fund.castle_rotation ? '#22c55e25' : '#ef444425'}`,
                    borderRadius: '6px',
                    fontSize: '0.65rem',
                    color: fund.castle_rotation ? '#22c55e' : '#ef4444',
                  }}>
                    {fund.castle_rotation ? '✓' : '✗'} Castle Rotation
                  </span>
                )}
              </div>
            )}

            {/* Alliance Event Times Table */}
            {fund && fund.alliance_events && fund.alliance_events.alliances && fund.alliance_events.alliances.length > 0 && (
              <AllianceEventTimesGrid allianceEvents={fund.alliance_events} />
            )}

            {/* Community Reviews — moved here from primary view */}
            {reviewSummary && reviewSummary.review_count > 0 && (
              <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                  <div style={{ display: 'flex', gap: '0.1rem', fontSize: '0.8rem' }}>
                    {renderStars(reviewSummary.avg_rating)}
                  </div>
                  <span style={{ color: colors.text, fontWeight: '600', fontSize: '0.75rem' }}>
                    {reviewSummary.avg_rating.toFixed(1)}
                  </span>
                  <span style={{ color: colors.textSecondary, fontSize: '0.65rem' }}>
                    ({reviewSummary.review_count} review{reviewSummary.review_count !== 1 ? 's' : ''})
                  </span>
                </div>
                {reviewSummary.top_review_comment && (
                  <div style={{
                    padding: '0.35rem 0.5rem',
                    backgroundColor: colors.surface,
                    borderRadius: '6px',
                    borderLeft: '3px solid #fbbf24',
                  }}>
                    <p style={{ color: colors.textSecondary, fontSize: '0.7rem', margin: 0, fontStyle: 'italic', lineHeight: 1.4 }}>
                      &ldquo;{reviewSummary.top_review_comment}&rdquo;
                    </p>
                    {reviewSummary.top_review_author && (
                      <span style={{ color: colors.textMuted, fontSize: '0.6rem' }}>— {reviewSummary.top_review_author}</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Card Footer - CTA */}
      <div style={{
        padding: '0.6rem 1rem',
        borderTop: `1px solid ${colors.border}`,
        display: 'flex',
        gap: '0.5rem',
        justifyContent: 'flex-end',
        alignItems: 'center',
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
            transition: 'border-color 0.2s',
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
        {mode === 'transferring' && !isOwnKingdom && (
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
        {mode === 'transferring' && isOwnKingdom && (
          <span style={{
            padding: '0.4rem 0.75rem',
            backgroundColor: '#22c55e10',
            border: '1px solid #22c55e30',
            borderRadius: '8px',
            color: '#22c55e',
            fontSize: '0.7rem',
            fontWeight: '600',
          }}>
            Your Kingdom
          </span>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes goldShimmer {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );

  // Gold cards get a full-border shimmer wrapper
  if (isGold) {
    return (
      <div
        style={{
          padding: '3px',
          borderRadius: '14px',
          background: 'linear-gradient(135deg, #fbbf24, #f59e0b, #fbbf24, #d97706, #fbbf24, #f59e0b, #fbbf24)',
          backgroundSize: '300% 300%',
          animation: 'goldShimmer 4s ease-in-out infinite',
          boxShadow: isHovered
            ? '0 0 28px #fbbf2430, 0 0 48px #fbbf2415, 0 4px 16px rgba(0,0,0,0.4)'
            : '0 0 14px #fbbf2420, 0 2px 8px rgba(0,0,0,0.3)',
          transition: 'box-shadow 0.3s ease',
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {cardContent}
      </div>
    );
  }

  return cardContent;
};

export default KingdomListingCard;
