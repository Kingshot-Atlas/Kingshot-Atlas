import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { FONT_DISPLAY, statTypeStyles, colors } from '../utils/styles';
import { getPowerTier } from '../utils/atlasScoreFormula';
import SmartTooltip from './shared/SmartTooltip';
import { generateTransferListingDiscordMessage, generateTransferListingCard, copyToClipboard, copyImageToClipboard, shareImageOnMobile, downloadBlob, isMobileDevice } from '../utils/sharing';
import { isReferralEligible } from '../utils/constants';

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
  const { t } = useTranslation();
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
          {t('listing.allianceEventTimes', 'Alliance Event Times')}
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
          {showLocal ? `🕐 ${t('listing.localTime', 'Local Time')}` : `🌐 ${t('listing.utc', 'UTC')}`}
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
            {t('listing.event', 'Event')}
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
  highlighted?: boolean;
}

const KingdomListingCard: React.FC<KingdomListingCardProps> = ({ kingdom, fund, reviewSummary, mode, matchScore, matchDetails, onApply, onFund, highlighted }) => {
  const { t } = useTranslation();
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedDiscord, setCopiedDiscord] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const isMobile = useIsMobile();
  const { profile } = useAuth();
  const refParam = profile && isReferralEligible(profile) && profile.linked_username
    ? profile.linked_username : null;
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const fundTier = fund?.tier || 'standard';
  const tierColor = TIER_COLORS[fundTier];
  const scoreTier = getPowerTier(kingdom.atlas_score || 0);
  const scoreTierColor = SCORE_TIER_COLORS[scoreTier] || '#6b7280';
  const isGold = fundTier === 'gold';
  const isSilver = fundTier === 'silver';
  const isBronze = fundTier === 'bronze';
  const isPremium = fundTier !== 'standard';
  const hasWrapper = isGold || isSilver || isBronze;

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

  const handleCopyListingLink = () => {
    const refSuffix = refParam ? `&ref=${refParam}&src=transfer` : '';
    const url = `${window.location.origin}/transfer-hub?kingdom=${kingdom.kingdom_number}${refSuffix}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const handleCopyDiscord = async () => {
    const refSuffix = refParam ? `&ref=${refParam}&src=transfer` : '';
    const message = generateTransferListingDiscordMessage(
      kingdom.kingdom_number,
      kingdom.atlas_score || 0,
      scoreTier,
      fund?.is_recruiting || false,
      fund?.main_language || undefined,
      fund?.tier || undefined
    ) + (refSuffix ? refSuffix : '');
    const ok = await copyToClipboard(message);
    if (ok) {
      setCopiedDiscord(true);
      setTimeout(() => setCopiedDiscord(false), 2000);
    }
  };

  const handleCopyAsImage = async () => {
    try {
      const blob = await generateTransferListingCard(
        kingdom.kingdom_number,
        kingdom.atlas_score || 0,
        scoreTier,
        fund?.is_recruiting || false,
        fund?.main_language || undefined,
        fund?.tier || undefined
      );
      const filename = `kingdom-${kingdom.kingdom_number}-listing.png`;
      if (isMobileDevice()) {
        const shared = await shareImageOnMobile(blob, filename, `Kingdom ${kingdom.kingdom_number} Transfer Listing`);
        if (!shared) downloadBlob(blob, filename);
      } else {
        const copied = await copyImageToClipboard(blob, filename);
        if (!copied) downloadBlob(blob, filename);
      }
      setCopiedImage(true);
      setTimeout(() => setCopiedImage(false), 2000);
    } catch (err) {
      console.error('Failed to generate listing card:', err);
    }
  };

  // Premium tiers (Gold/Silver/Bronze) use a wrapper approach for shimmer borders
  const cardContent = (
    <div
      {...(!hasWrapper ? { id: `listing-${kingdom.kingdom_number}` } : {})}
      style={{
        position: 'relative',
        ...(isGold
          ? { background: `linear-gradient(180deg, #fbbf240a 0%, ${colors.surface} 35%, ${colors.surface} 100%)` }
          : isSilver
          ? { background: `linear-gradient(180deg, #c0c0c005 0%, ${colors.surface} 25%, ${colors.surface} 100%)` }
          : isBronze
          ? { background: `linear-gradient(180deg, #cd7f3206 0%, ${colors.surface} 35%, ${colors.surface} 100%)` }
          : { backgroundColor: colors.surface }),
        borderRadius: hasWrapper ? '12px' : '14px',
        overflow: 'hidden',
        ...(!hasWrapper ? { scrollMarginTop: '80px' } : {}),
        ...(hasWrapper ? {} : {
          border: highlighted
            ? `2px solid ${colors.primary}`
            : `${borderWidth}px solid ${borderColor}`,
          transition: 'all 0.3s ease',
          boxShadow: highlighted
            ? `0 0 20px ${colors.primary}30, 0 0 40px ${colors.primary}10, 0 4px 16px rgba(0,0,0,0.4)`
            : isHovered
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
              {t('common.kingdom', 'Kingdom')} {kingdom.kingdom_number}
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
            {isPremium && (
              <SmartTooltip
                accentColor={tierColor}
                maxWidth={240}
                content={
                  <div style={{ fontSize: '0.7rem' }}>
                    <div style={{ fontWeight: '600', color: tierColor, marginBottom: '0.3rem' }}>
                      {fundTier.charAt(0).toUpperCase() + fundTier.slice(1)} {t('listing.listing', 'Listing')}
                    </div>
                    <div style={{ color: '#9ca3af', lineHeight: 1.5, marginBottom: '0.3rem' }}>
                      {t('listing.fundDescription', 'Kingdoms fund their listing to unlock better visibility and features.')}
                    </div>
                    <div style={{ color: '#6b7280', lineHeight: 1.8, display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                      <div>🥉 <span style={{ color: '#cd7f32' }}>Bronze $25+</span> — {t('listing.bronzePerks', 'Shimmer border · requirements · vibes')}</div>
                      <div>🥈 <span style={{ color: '#9ca3af' }}>Silver $50+</span> — {t('listing.silverPerks', '+ Silver glow · bio · event times')}</div>
                      <div>🥇 <span style={{ color: colors.gold }}>Gold $100+</span> — {t('listing.goldPerks', '+ Gold glow · highlight · priority')}</div>
                    </div>
                  </div>
                }
              >
                <span
                  className={isGold ? 'tier-chip-gold' : isSilver ? 'tier-chip-silver' : 'tier-chip-bronze'}
                  style={{
                    padding: '0.1rem 0.4rem',
                    backgroundColor: `${tierColor}15`,
                    border: `1px solid ${tierColor}40`,
                    borderRadius: '4px',
                    fontSize: '0.6rem',
                    fontWeight: 'bold',
                    color: tierColor,
                    cursor: 'help',
                    textTransform: 'capitalize',
                  }}
                >
                  {fundTier}
                </span>
              </SmartTooltip>
            )}
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
                {t('listing.recruiting', 'RECRUITING')}
              </div>
            )}
            {mode === 'transferring' && matchScore !== undefined && matchScore > 0 && (
              <SmartTooltip
                accentColor={matchScore >= 75 ? '#22c55e' : matchScore >= 50 ? '#eab308' : '#ef4444'}
                maxWidth={260}
                content={
                  matchDetails && matchDetails.length > 0 ? (
                    <div>
                      <div style={{ fontSize: '0.7rem', fontWeight: '600', color: '#fff', marginBottom: '0.3rem' }}>
                        {t('listing.matchBreakdown', 'Match Breakdown')}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginBottom: '0.35rem', lineHeight: 1.4 }}>
                        {t('listing.matchBreakdownDesc', 'How well this kingdom fits your Transfer Profile preferences.')}
                      </div>
                      {matchDetails.map((d, i) => (
                        <div key={i} style={{ fontSize: '0.7rem', color: d.matched ? '#22c55e' : '#ef4444', lineHeight: 1.6 }}>
                          {d.matched ? '✅' : '❌'} <span style={{ color: '#d1d5db' }}>{d.label}:</span> {d.detail}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                      {t('listing.matchBasedOn', 'Based on your Transfer Profile preferences vs this kingdom\'s listing.')}
                    </span>
                  )
                }
              >
                <span
                  style={{
                    padding: '0.2rem 0.5rem',
                    backgroundColor: matchScore >= 75 ? '#22c55e12' : matchScore >= 50 ? '#eab30812' : '#ef444412',
                    border: `1px solid ${matchScore >= 75 ? '#22c55e35' : matchScore >= 50 ? '#eab30835' : '#ef444435'}`,
                    borderRadius: '6px',
                    fontSize: '0.7rem',
                    fontWeight: 'bold',
                    color: matchScore >= 75 ? '#22c55e' : matchScore >= 50 ? '#eab308' : '#ef4444',
                    cursor: 'help',
                  }}
                >
                  {t('listing.matchPercent', '{{score}}% match', { score: matchScore })}
                </span>
              </SmartTooltip>
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
                  <span style={{ color: '#4b5563', fontSize: '0.6rem' }}>{t('listing.linkToSeeMatch', 'Link to see match %')}</span>
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
                    ? t('listing.leadingDesc', '20 regular invites, 10 open slots, lower power cap')
                    : transferStatus === 'Ordinary'
                    ? t('listing.ordinaryDesc', '35 regular invites, up to 3 special invites, 20 open slots, higher power cap')
                    : t('listing.unknownStatusDesc', 'Transfer status not yet reported')}
                </span>
              </div>
            }
          >
            <span style={{ cursor: 'help' }}>
              <span style={{ fontSize: '0.7rem', color: isSilver ? colors.textSecondary : colors.textMuted }}>
                {t('listing.transferStatus', 'Transfer Status')}:{' '}
              </span>
              <span style={{
                fontSize: '0.7rem',
                color: transferStatus === 'Leading' ? colors.gold
                  : transferStatus === 'Ordinary' ? (isSilver ? '#e5e7eb' : '#c0c0c0')
                  : (isSilver ? '#d1d5db' : colors.textSecondary),
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
              {t('listing.performance', 'Performance')}
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '0.3rem',
              flex: 1,
            }}>
              {[
                { label: t('listing.atlasScore', 'Atlas Score'), value: kingdom.atlas_score ? `${kingdom.atlas_score.toFixed(2)} (#${kingdom.current_rank || '—'})` : '—', color: '#22d3ee', emoji: '💎', tooltip: t('listing.atlasScoreTooltip', 'Comprehensive rating based on win rates, performance patterns, recent form, and experience. Rewards consistency over lucky streaks.') },
                { label: t('listing.kvks', 'KvKs'), value: `${kingdom.total_kvks || 0}`, color: colors.text, emoji: '⚡', tooltip: null },
                { label: t('listing.prepWinRate', 'Prep Win Rate'), value: kingdom.prep_win_rate != null ? `${(kingdom.prep_win_rate * 100).toFixed(0)}%` : '—', color: statTypeStyles.prepPhase.color, emoji: '🛡️', tooltip: null },
                { label: t('listing.battleWinRate', 'Battle Win Rate'), value: kingdom.battle_win_rate != null ? `${(kingdom.battle_win_rate * 100).toFixed(0)}%` : '—', color: statTypeStyles.battlePhase.color, emoji: '⚔️', tooltip: null },
                { label: t('listing.dominations', 'Dominations'), value: `${kingdom.dominations || 0}`, color: statTypeStyles.domination.color, emoji: '👑', tooltip: t('listing.dominationsTooltip', 'Won both Prep and Battle') },
                { label: t('listing.comebacks', 'Comebacks'), value: `${kingdom.comebacks || 0}`, color: '#3b82f6', emoji: '💪', tooltip: t('listing.comebacksTooltip', 'Lost Prep but won Battle') },
                { label: t('listing.reversals', 'Reversals'), value: `${kingdom.reversals || 0}`, color: '#a855f7', emoji: '🔄', tooltip: t('listing.reversalsTooltip', 'Won Prep but lost Battle') },
                { label: t('listing.invasions', 'Invasions'), value: `${kingdom.invasions || 0}`, color: statTypeStyles.invasion.color, emoji: '💀', tooltip: t('listing.invasionsTooltip', 'Lost both Prep and Battle') },
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
                    content={
                      <div style={{ fontSize: '0.7rem' }}>
                        <div style={{ color: stat.color, fontWeight: 'bold', marginBottom: '2px' }}>{stat.emoji} {stat.label}</div>
                        <div style={{ color: '#9ca3af' }}>{stat.tooltip}</div>
                      </div>
                    }
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
              {t('listing.characteristics', 'Characteristics')}
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
                    🔥 {t('listing.minPower', 'Minimum Power')} 🔥
                  </div>
                  <div style={{ fontSize: '0.8rem', fontWeight: '600', color: minPowerDisplay ? colors.text : colors.textMuted, lineHeight: 1.2 }}>
                    {minPowerDisplay || t('listing.notSet', 'Not set')}
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
                    🏰 {t('listing.minTCLevel', 'Minimum TC Level')} 🏰
                  </div>
                  <div style={{ fontSize: '0.8rem', fontWeight: '600', color: fund?.min_tc_level ? colors.text : colors.textMuted, lineHeight: 1.2 }}>
                    {fund?.min_tc_level ? formatTCLevel(fund.min_tc_level) : t('listing.notSet', 'Not set')}
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
                    🌐 {t('listing.mainLanguage', 'Main Language')} 🌐
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: '600', color: fund?.main_language ? colors.text : colors.textMuted, lineHeight: 1.2 }}>
                    {fund?.main_language || t('listing.notSet', 'Not set')}
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
                    💬 {t('listing.secondaryLanguage', 'Secondary Language')} 💬
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: '600', color: (fund?.secondary_languages && fund.secondary_languages.length > 0) ? colors.text : colors.textMuted, lineHeight: 1.2 }}>
                    {fund?.secondary_languages && fund.secondary_languages.length > 0 ? fund.secondary_languages.join(', ') : t('listing.notSet', 'Not set')}
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
                  ✨ {t('listing.kingdomVibe', 'Kingdom Vibe')} ✨
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
                    {t('listing.vibeNotSet', 'Not set — editors can add vibes in the Recruiter Dashboard')}
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
                  📝 {t('listing.kingdomBio', 'Kingdom Bio')} 📝 {!(isSilver || isGold) && <span style={{ color: '#c0c0c0', fontSize: '0.45rem', fontWeight: 'normal', textTransform: 'none' }}>(Silver+)</span>}
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
                    {t('listing.bioNotSet', 'Not set — add a bio in the Recruiter Dashboard (max 150 chars)')}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.7rem', color: colors.textMuted, fontStyle: 'italic' }}>
                    {t('listing.upgradeForBio', 'Upgrade to Silver to add a kingdom bio')}
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
          <span>📋 {t('listing.moreDetails', 'More Details')}</span>
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
                    {fund.nap_policy ? '✓' : '✗'} {t('listing.nap', 'NAP')}
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
                    {fund.sanctuary_distribution ? '✓' : '✗'} {t('listing.sanctuaryDistribution', 'Sanctuary Distribution')}
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
                    {fund.castle_rotation ? '✓' : '✗'} {t('listing.castleRotation', 'Castle Rotation')}
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
                    ({t('listing.reviewCount', '{{count}} review(s)', { count: reviewSummary.review_count })})
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

      {/* Why Fund? — subtle upgrade nudge for standard tier */}
      {!isPremium && (
        <div style={{
          padding: '0.35rem 1rem',
          borderTop: `1px solid ${colors.border}`,
          textAlign: 'center',
          background: `linear-gradient(90deg, transparent 0%, #fbbf2404 50%, transparent 100%)`,
        }}>
          <span style={{ fontSize: '0.6rem', color: colors.textMuted }}>
            {t('listing.fundedListingsPromo', '✨ Funded listings get shimmer borders, glow effects & more visibility')}
          </span>
        </div>
      )}

      {/* Card Footer - CTA */}
      <div style={{
        padding: '0.6rem 1rem',
        borderTop: `1px solid ${colors.border}`,
        display: 'flex',
        gap: '0.5rem',
        justifyContent: 'flex-end',
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        <button
          onClick={handleCopyListingLink}
          style={{
            padding: '0.4rem 0.75rem',
            backgroundColor: copiedLink ? `${colors.success}10` : 'transparent',
            border: `1px solid ${copiedLink ? `${colors.success}30` : colors.border}`,
            borderRadius: '8px',
            color: copiedLink ? colors.success : colors.textMuted,
            fontSize: '0.75rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            minHeight: '44px',
            transition: 'all 0.2s',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          {copiedLink ? t('listing.linkCopied', 'Link Copied!') : t('listing.share', 'Share')}
        </button>
        <button
          onClick={handleCopyDiscord}
          style={{
            padding: '0.4rem 0.75rem',
            backgroundColor: copiedDiscord ? '#5865F210' : 'transparent',
            border: `1px solid ${copiedDiscord ? '#5865F230' : colors.border}`,
            borderRadius: '8px',
            color: copiedDiscord ? '#5865F2' : colors.textMuted,
            fontSize: '0.75rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            minHeight: '44px',
            transition: 'all 0.2s',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
          </svg>
          {copiedDiscord ? t('listing.copied', 'Copied!') : t('listing.discord', 'Discord')}
        </button>
        <button
          onClick={handleCopyAsImage}
          style={{
            padding: '0.4rem 0.75rem',
            backgroundColor: copiedImage ? `${colors.success}10` : 'transparent',
            border: `1px solid ${copiedImage ? `${colors.success}30` : colors.border}`,
            borderRadius: '8px',
            color: copiedImage ? colors.success : colors.textMuted,
            fontSize: '0.75rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            minHeight: '44px',
            transition: 'all 0.2s',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          {copiedImage ? t('listing.saved', 'Saved!') : t('listing.image', 'Image')}
        </button>
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
          {t('listing.viewProfile', 'View Profile')}
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
            {t('listing.fund', 'Fund')}
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
            {t('listing.applyToTransfer', 'Apply to Transfer')}
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
            {t('listing.yourKingdom', 'Your Kingdom')}
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
        @keyframes tierChipGlow {
          0%, 100% { box-shadow: 0 0 4px currentColor; }
          50% { box-shadow: 0 0 8px currentColor, 0 0 14px currentColor; }
        }
        @keyframes tierChipWarm {
          0%, 100% { box-shadow: 0 0 3px currentColor; }
          50% { box-shadow: 0 0 6px currentColor; }
        }
        .tier-chip-gold {
          animation: tierChipGlow 3s ease-in-out infinite;
          text-shadow: 0 0 6px #fbbf2460;
        }
        .tier-chip-silver {
          animation: tierChipGlow 4s ease-in-out infinite;
          text-shadow: 0 0 4px #c0c0c040;
        }
        .tier-chip-bronze {
          animation: tierChipWarm 5s ease-in-out infinite;
          text-shadow: 0 0 3px #cd7f3240;
        }
      `}</style>
    </div>
  );

  // Gold cards get a full-border shimmer wrapper + glow
  if (isGold) {
    return (
      <div
        id={`listing-${kingdom.kingdom_number}`}
        style={{
          padding: '3px',
          borderRadius: '14px',
          scrollMarginTop: '80px',
          background: 'linear-gradient(135deg, #fbbf24, #f59e0b, #fbbf24, #d97706, #fbbf24, #f59e0b, #fbbf24)',
          backgroundSize: '300% 300%',
          animation: 'goldShimmer 4s ease-in-out infinite',
          boxShadow: isHovered
            ? '0 0 32px #fbbf2440, 0 0 56px #fbbf2420, 0 0 80px #fbbf2410, 0 4px 16px rgba(0,0,0,0.4)'
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

  // Silver cards get a shimmer border + glow (like Gold but silver)
  if (isSilver) {
    return (
      <div
        id={`listing-${kingdom.kingdom_number}`}
        style={{
          padding: '2px',
          borderRadius: '14px',
          scrollMarginTop: '80px',
          background: 'linear-gradient(135deg, #c0c0c0, #a8a8a8, #d4d4d4, #8e8e8e, #c0c0c0, #a8a8a8, #c0c0c0)',
          backgroundSize: '300% 300%',
          animation: 'goldShimmer 5s ease-in-out infinite',
          boxShadow: isHovered
            ? '0 0 28px #c0c0c030, 0 0 48px #c0c0c018, 0 0 72px #c0c0c00c, 0 4px 16px rgba(0,0,0,0.4)'
            : '0 0 10px #c0c0c018, 0 2px 8px rgba(0,0,0,0.3)',
          transition: 'box-shadow 0.3s ease',
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {cardContent}
      </div>
    );
  }

  // Bronze cards get a shimmer border (no glow)
  if (isBronze) {
    return (
      <div
        id={`listing-${kingdom.kingdom_number}`}
        style={{
          padding: '2px',
          borderRadius: '14px',
          scrollMarginTop: '80px',
          background: 'linear-gradient(135deg, #cd7f32, #b87333, #da8a45, #a0682d, #cd7f32, #b87333, #cd7f32)',
          backgroundSize: '300% 300%',
          animation: 'goldShimmer 6s ease-in-out infinite',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          transition: 'all 0.3s ease',
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
