import React, { useState, useEffect, useRef, memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Kingdom, getPowerTier } from '../types';
import { neonGlow, colors, radius, shadows, transition } from '../utils/styles';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useAnalytics } from '../hooks/useAnalytics';
import { TierBadge } from './shared';
import { 
  AchievementBadges, 
  RecentKvKs, 
  QuickStats, 
  WinRates, 
  CardActions, 
  TransferStatus 
} from './kingdom-card';
import PostKvKSubmission from './PostKvKSubmission';
import { CURRENT_KVK } from '../constants';

interface KingdomCardProps {
  kingdom: Kingdom;
  onCompare?: (kingdom: Kingdom) => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  rank?: number;
  onCopyLink?: () => void;
  onAddToCompare?: (kingdomNumber: number) => void;
}

const KingdomCard: React.FC<KingdomCardProps> = ({ 
  kingdom, 
  isFavorite = false, 
  onToggleFavorite,
  rank,
  onCopyLink,
  onAddToCompare
}) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { trackFeature } = useAnalytics();
  const [isHovered, setIsHovered] = useState(false);
  const [showAtlasTooltip, setShowAtlasTooltip] = useState(false);
  const [showMissingDataTooltip, setShowMissingDataTooltip] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [animatedScore, setAnimatedScore] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const overallScore = typeof kingdom.overall_score === 'number' && !isNaN(kingdom.overall_score) 
    ? kingdom.overall_score 
    : 0;

  // Animated counter effect
  useEffect(() => {
    if (hasAnimated) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          const duration = 800;
          const steps = 25;
          const increment = overallScore / steps;
          let current = 0;
          
          const timer = setInterval(() => {
            current += increment;
            if (current >= overallScore) {
              setAnimatedScore(overallScore);
              clearInterval(timer);
            } else {
              setAnimatedScore(current);
            }
          }, duration / steps);
        }
      },
      { threshold: 0.3 }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, [overallScore, hasAnimated]);

  const handleCardClick = () => {
    trackFeature('Kingdom Card Click', { kingdom: kingdom.kingdom_number });
    navigate(`/kingdom/${kingdom.kingdom_number}`);
  };

  const status = kingdom.most_recent_status || 'Unannounced';
  const powerTier = kingdom.power_tier ?? getPowerTier(kingdom.overall_score);

  // Check if any tooltip is showing for z-index
  const hasActiveTooltip = showAtlasTooltip || showMissingDataTooltip;

  // Check if kingdom is missing latest KvK data
  const isMissingLatestKvK = useMemo(() => {
    if (!kingdom.recent_kvks || kingdom.recent_kvks.length === 0) return true;
    const hasLatestKvK = kingdom.recent_kvks.some(kvk => kvk.kvk_number === CURRENT_KVK);
    return !hasLatestKvK;
  }, [kingdom.recent_kvks]);

  // Unique color for missing data chip (violet)
  const missingDataColor = '#8b5cf6';

  return (
    <div
      ref={cardRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="kingdom-card"
      style={{
        backgroundColor: colors.card,
        borderRadius: isMobile ? radius.lg : radius.xl,
        padding: isMobile ? '1rem' : '1.25rem',
        cursor: 'default',
        transition: transition.slow,
        border: `1px solid ${isHovered ? `${colors.primary}40` : colors.border}`,
        transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: isHovered 
          ? `${shadows.cardHover}, 0 0 30px ${colors.primary}08` 
          : shadows.card,
        display: 'flex',
        flexDirection: 'column',
        gap: '0',
        position: 'relative',
        overflow: 'visible',
        zIndex: hasActiveTooltip ? 100 : 1
      }}
    >
      {/* ═══════════════════ HEADER SECTION ═══════════════════ */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        marginBottom: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <div 
            onClick={handleCardClick}
            style={{ 
              fontSize: isMobile ? '1.15rem' : '1.4rem', 
              fontWeight: '700', 
              color: colors.text, 
              fontFamily: "'Cinzel', serif", 
              letterSpacing: '0.02em',
              cursor: 'pointer',
              transition: transition.fast
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = colors.primary}
            onMouseLeave={(e) => e.currentTarget.style.color = colors.text}
          >
            Kingdom {kingdom.kingdom_number}
          </div>
          
          <TierBadge tier={powerTier as 'S' | 'A' | 'B' | 'C' | 'D'} />
          <AchievementBadges kingdom={kingdom} />
        </div>
        
        {onToggleFavorite && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
            style={{ 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer', 
              fontSize: '1.3rem', 
              color: isFavorite ? colors.gold : colors.borderStrong, 
              padding: '0.2rem',
              transition: transition.fast
            }}
            onMouseEnter={(e) => { if (!isFavorite) e.currentTarget.style.color = colors.textMuted; }}
            onMouseLeave={(e) => { if (!isFavorite) e.currentTarget.style.color = colors.borderStrong; }}
          >
            {isFavorite ? '★' : '☆'}
          </button>
        )}
      </div>

      {/* ═══════════════════ ATLAS SCORE ═══════════════════ */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '0.5rem',
        marginBottom: '0.75rem'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: colors.textMuted, lineHeight: '1.2' }}>Atlas</span>
          <span style={{ fontSize: '0.75rem', color: colors.textMuted, lineHeight: '1.2' }}>Score</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
          <span 
            style={{ 
              fontSize: isMobile ? '1.6rem' : '2rem', 
              fontWeight: '700', 
              ...neonGlow(colors.primary),
              fontFamily: 'system-ui',
              lineHeight: 1
            }}
            onMouseEnter={() => setShowAtlasTooltip(true)}
            onMouseLeave={() => setShowAtlasTooltip(false)}
          >
            {animatedScore.toFixed(1)}
          </span>
          {rank && (
            <span style={{ fontSize: '0.85rem', color: colors.primary, fontWeight: 'normal' }}>
              (#{rank})
            </span>
          )}
        </div>
        
        {/* Missing KvK Data Chip - shows only when kingdom is missing latest KvK data */}
        {!isMobile && isMissingLatestKvK && (
          <div 
            style={{ marginLeft: 'auto', position: 'relative' }}
            onMouseEnter={() => setShowMissingDataTooltip(true)}
            onMouseLeave={() => setShowMissingDataTooltip(false)}
          >
            <div 
              onClick={(e) => {
                e.stopPropagation();
                trackFeature('Missing KvK Chip Click', { kingdom: kingdom.kingdom_number });
                setShowSubmitModal(true);
              }}
              style={{ 
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
                backgroundColor: `${missingDataColor}15`,
                border: `1px solid ${missingDataColor}40`,
                fontSize: '0.6rem',
                fontWeight: 500,
                color: missingDataColor,
                cursor: 'pointer',
                transition: transition.fast
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = `${missingDataColor}25`;
                e.currentTarget.style.borderColor = missingDataColor;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = `${missingDataColor}15`;
                e.currentTarget.style.borderColor = `${missingDataColor}40`;
              }}
            >
              📊 Submit KvK {CURRENT_KVK}
            </div>
            
            {showMissingDataTooltip && (
              <div 
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  right: 0,
                  marginBottom: '0.5rem',
                  backgroundColor: colors.bg,
                  border: `1px solid ${missingDataColor}`,
                  borderRadius: '6px',
                  padding: '0.5rem 0.75rem',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                  zIndex: 1000,
                  whiteSpace: 'nowrap',
                  fontSize: '0.65rem',
                  color: colors.textSecondary
                }}
              >
                <div style={{ fontWeight: '600', color: missingDataColor, marginBottom: '0.25rem' }}>
                  Missing KvK #{CURRENT_KVK} Data
                </div>
                <div style={{ color: colors.textMuted }}>
                  Click to submit results for this kingdom
                </div>
              </div>
            )}
          </div>
        )}
        
        {showAtlasTooltip && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: '1rem',
            marginBottom: '0.5rem',
            backgroundColor: colors.bg,
            border: `1px solid ${colors.primary}`,
            borderRadius: radius.md,
            padding: '0.6rem 0.8rem',
            boxShadow: shadows.tooltip,
            zIndex: 1000,
            whiteSpace: 'nowrap'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '3px', color: colors.primary }}>
              Atlas Score
            </div>
            <div style={{ color: colors.textSecondary, fontSize: '0.7rem' }}>
              Rewards experience and consistency over lucky streaks
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════ QUICK STATS ROW ═══════════════════ */}
      <QuickStats 
        totalKvks={kingdom.total_kvks}
        dominations={kingdom.dominations ?? 0}
        invasions={kingdom.invasions ?? kingdom.defeats ?? 0}
      />

      {/* ═══════════════════ WIN RATES SECTION ═══════════════════ */}
      <WinRates
        prepWinRate={kingdom.prep_win_rate}
        prepWins={kingdom.prep_wins}
        prepLosses={kingdom.prep_losses}
        prepStreak={kingdom.prep_streak ?? 0}
        prepLossStreak={kingdom.prep_loss_streak ?? 0}
        prepBestStreak={kingdom.prep_best_streak ?? 0}
        battleWinRate={kingdom.battle_win_rate}
        battleWins={kingdom.battle_wins}
        battleLosses={kingdom.battle_losses}
        battleStreak={kingdom.battle_streak ?? 0}
        battleLossStreak={kingdom.battle_loss_streak ?? 0}
        battleBestStreak={kingdom.battle_best_streak ?? 0}
      />

      {/* ═══════════════════ RECENT PERFORMANCE ═══════════════════ */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '0.75rem'
      }}>
        <span style={{ fontSize: '0.75rem', color: colors.textMuted }}>Recent Performance</span>
        <RecentKvKs recentKvks={kingdom.recent_kvks || []} />
      </div>

      {/* ═══════════════════ FOOTER ═══════════════════ */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        paddingTop: '0.75rem',
        borderTop: `1px solid ${colors.borderSubtle}`
      }}>
        <TransferStatus status={status} lastUpdated={kingdom.last_updated} />
        <CardActions 
          kingdom={kingdom}
          onCopyLink={onCopyLink}
          onAddToCompare={onAddToCompare}
          cardRef={cardRef}
        />
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(-50%) translateY(5px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>

      {/* PostKvKSubmission Modal */}
      <PostKvKSubmission
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        defaultKingdom={kingdom.kingdom_number}
        defaultKvkNumber={CURRENT_KVK}
      />
    </div>
  );
};

export default memo(KingdomCard);

// PostKvKSubmission modal wrapper - rendered outside the card
export const KingdomCardWithModal: React.FC<KingdomCardProps & { showModal?: boolean; onCloseModal?: () => void }> = (props) => {
  return <KingdomCard {...props} />;
};
