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
import MiniRadarChart from './MiniRadarChart';

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
  const [showMiniRadar, setShowMiniRadar] = useState(false);
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
  const hasActiveTooltip = showAtlasTooltip || showMiniRadar;
  
  // Mini radar data - memoized
  const miniRadarData = useMemo(() => {
    const totalKvks = kingdom.total_kvks || 1;
    return [
      { label: 'Prep', value: Math.round(kingdom.prep_win_rate * 100) },
      { label: 'Battle', value: Math.round(kingdom.battle_win_rate * 100) },
      { label: 'Dom', value: Math.round(((kingdom.dominations ?? 0) / totalKvks) * 100) },
      { label: 'Exp', value: Math.min(100, Math.round((totalKvks / 10) * 100)) },
      { label: 'Resil', value: Math.max(0, 100 - Math.round(((kingdom.defeats ?? 0) / totalKvks) * 100)) },
    ];
  }, [kingdom.prep_win_rate, kingdom.battle_win_rate, kingdom.dominations, kingdom.defeats, kingdom.total_kvks]);

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
        
        {/* Mini Radar Chart - shows on hover, clickable to profile */}
        {!isMobile && (
          <div 
            style={{ marginLeft: 'auto', position: 'relative' }}
            onMouseEnter={() => setShowMiniRadar(true)}
            onMouseLeave={() => setShowMiniRadar(false)}
          >
            <div 
              onClick={(e) => {
                e.stopPropagation();
                trackFeature('Quick Insights Click', { kingdom: kingdom.kingdom_number });
                navigate(`/kingdom/${kingdom.kingdom_number}#performance`);
              }}
              style={{ 
                cursor: 'pointer',
                opacity: isHovered ? 1 : 0.5,
                transition: transition.fast
              }}
              title=""
            >
              <MiniRadarChart data={miniRadarData} size={50} accentColor={colors.primary} />
            </div>
            
            {showMiniRadar && (
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/kingdom/${kingdom.kingdom_number}#performance`);
                }}
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  right: 0,
                  marginBottom: '0.5rem',
                  backgroundColor: colors.bg,
                  border: `1px solid ${colors.primary}`,
                  borderRadius: '6px',
                  padding: '0.5rem 0.75rem',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                  zIndex: 1000,
                  whiteSpace: 'nowrap',
                  fontSize: '0.65rem',
                  color: colors.textSecondary,
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontWeight: '600', color: colors.primary, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  Quick Insights
                  <span style={{ fontSize: '0.6rem', color: colors.textMuted }}>→ View Full</span>
                </div>
                {miniRadarData.map((d, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                    <span>{d.label}:</span>
                    <span style={{ color: colors.text, fontWeight: '500' }}>{d.value}%</span>
                  </div>
                ))}
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
        defeats={kingdom.defeats ?? 0}
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
    </div>
  );
};

export default memo(KingdomCard);
