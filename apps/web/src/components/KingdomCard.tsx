import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Kingdom, getPowerTier } from '../types';
import { getOutcome, OUTCOMES } from '../utils/outcomes';
import { neonGlow, getStatusColor } from '../utils/styles';

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
  const [hoveredResult, setHoveredResult] = useState<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [showTierTooltip, setShowTierTooltip] = useState(false);
  const [showSharePopup, setShowSharePopup] = useState(false);
  const [showAtlasTooltip, setShowAtlasTooltip] = useState(false);
  const [showHKTooltip, setShowHKTooltip] = useState(false);
  const [showIKTooltip, setShowIKTooltip] = useState(false);
  const [hoveredAchievement, setHoveredAchievement] = useState<number | null>(null);
  const [showStatusTooltip, setShowStatusTooltip] = useState(false);
  const [animatedScore, setAnimatedScore] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);

  // Animated counter effect
  useEffect(() => {
    if (hasAnimated) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          const duration = 800;
          const steps = 25;
          const increment = kingdom.overall_score / steps;
          let current = 0;
          
          const timer = setInterval(() => {
            current += increment;
            if (current >= kingdom.overall_score) {
              setAnimatedScore(kingdom.overall_score);
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
  }, [kingdom.overall_score, hasAnimated]);


  const getStatusDescription = (status: string) => {
    switch (status) {
      case 'Leading': return 'Open for migration with favorable conditions';
      case 'Ordinary': return 'Standard migration status';
      default: return 'Transfer status not yet available';
    }
  };

  const getOutcomeLetter = (prepResult: string, battleResult: string) => {
    const outcome = getOutcome(prepResult, battleResult);
    return OUTCOMES[outcome].abbrev;
  };

  const handleCardClick = () => {
    navigate(`/kingdom/${kingdom.kingdom_number}`);
  };

  const status = kingdom.most_recent_status || 'Unannounced';
  // Sort by kvk_number ascending (chronological order: oldest first)
  const sortedKvks = [...(kingdom.recent_kvks || [])].sort((a, b) => a.kvk_number - b.kvk_number);
  // Get last 5 for display (most recent 5, but in chronological order)
  const recentResults = sortedKvks.slice(-5);
  
  // Use actual kingdom stats for wins/losses (full history from data)
  const prepWins = kingdom.prep_wins;
  const prepLosses = kingdom.prep_losses;
  const battleWins = kingdom.battle_wins;
  const battleLosses = kingdom.battle_losses;
  
  // Use full history values from kingdom data
  const highKings = kingdom.dominations ?? 0;
  const invaderKings = kingdom.defeats ?? 0;
  
  // Use pre-calculated streaks from full history data
  const prepStreak = kingdom.prep_streak ?? 0;
  const battleStreak = kingdom.battle_streak ?? 0;
  
  // Achievement badges logic
  const achievements: { icon: string; title: string; desc: string; color: string }[] = [];
  const isSupremeRuler = kingdom.prep_losses === 0 && kingdom.battle_losses === 0 && kingdom.total_kvks > 0;
  const isPrepMaster = kingdom.prep_losses === 0 && kingdom.prep_wins > 0;
  const isBattleLegend = kingdom.battle_losses === 0 && kingdom.battle_wins > 0;
  
  if (isSupremeRuler) {
    achievements.push({ icon: '👑', title: 'Supreme Ruler', desc: 'Undefeated overall - never lost a KvK', color: '#fbbf24' });
  } else {
    if (isPrepMaster) achievements.push({ icon: '🛡️', title: 'Prep Master', desc: 'Undefeated in Preparation Phase', color: '#eab308' });
    if (isBattleLegend) achievements.push({ icon: '⚔️', title: 'Battle Legend', desc: 'Undefeated in Battle Phase', color: '#f97316' });
  }
  const displayAchievements = achievements.slice(0, 5);
  
  const powerTier = kingdom.power_tier ?? getPowerTier(kingdom.overall_score);

  return (
    <div
      ref={cardRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="kingdom-card"
      style={{
        backgroundColor: '#131318',
        borderRadius: '16px',
        padding: '1.25rem',
        cursor: 'default',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        border: `1px solid ${isHovered ? '#22d3ee40' : '#2a2a2a'}`,
        transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: isHovered 
          ? '0 20px 40px rgba(0, 0, 0, 0.4), 0 0 30px rgba(34, 211, 238, 0.08)' 
          : '0 4px 20px rgba(0, 0, 0, 0.15)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0'
      }}
    >
      {/* ═══════════════════ HEADER SECTION ═══════════════════ */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        marginBottom: '1rem'
      }}>
        {/* Left: Kingdom Name + Tier + Achievements */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <div 
            onClick={handleCardClick}
            style={{ 
              fontSize: '1.4rem', 
              fontWeight: '700', 
              color: '#fff', 
              fontFamily: "'Cinzel', serif", 
              letterSpacing: '0.02em',
              cursor: 'pointer',
              transition: 'color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#22d3ee'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#fff'}
          >
            Kingdom {kingdom.kingdom_number}
          </div>
          
          {/* Tier Badge */}
          <div
            className={powerTier === 'S' ? 's-tier-badge' : ''}
            style={{
              position: 'relative',
              padding: '0.2rem 0.5rem',
              borderRadius: '6px',
              fontSize: '0.7rem',
              fontWeight: 'bold',
              cursor: 'default',
              backgroundColor: powerTier === 'S' ? '#fbbf2420' : powerTier === 'A' ? '#22c55e20' : powerTier === 'B' ? '#3b82f620' : '#6b728020',
              color: powerTier === 'S' ? '#fbbf24' : powerTier === 'A' ? '#22c55e' : powerTier === 'B' ? '#3b82f6' : '#6b7280',
              border: `1px solid ${powerTier === 'S' ? '#fbbf2450' : powerTier === 'A' ? '#22c55e50' : powerTier === 'B' ? '#3b82f650' : '#6b728050'}`
            }}
            onMouseEnter={() => setShowTierTooltip(true)}
            onMouseLeave={() => setShowTierTooltip(false)}
          >
            {powerTier}
            {showTierTooltip && (
              <div style={{
                position: 'absolute',
                bottom: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                marginBottom: '8px',
                backgroundColor: '#0a0a0a',
                border: `1px solid ${powerTier === 'S' ? '#fbbf24' : powerTier === 'A' ? '#22c55e' : powerTier === 'B' ? '#3b82f6' : '#6b7280'}`,
                borderRadius: '8px',
                padding: '0.6rem 0.8rem',
                zIndex: 1000,
                whiteSpace: 'nowrap',
                fontSize: '0.75rem',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: '0.4rem', color: '#fff', fontSize: '0.8rem' }}>Power Tiers</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{ color: '#fbbf24', fontWeight: 'bold', width: '14px' }}>S</span>
                  <span style={{ color: '#9ca3af' }}>10+ (Top 10%)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{ color: '#22c55e', fontWeight: 'bold', width: '14px' }}>A</span>
                  <span style={{ color: '#9ca3af' }}>7 – 9.9 (Top 25%)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{ color: '#3b82f6', fontWeight: 'bold', width: '14px' }}>B</span>
                  <span style={{ color: '#9ca3af' }}>4.5 – 6.9 (Top 50%)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{ color: '#9ca3af', fontWeight: 'bold', width: '14px' }}>C</span>
                  <span style={{ color: '#9ca3af' }}>2.5 – 4.4 (Top 75%)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: '#6b7280', fontWeight: 'bold', width: '14px' }}>D</span>
                  <span style={{ color: '#9ca3af' }}>{'< 2.5'} (Bottom 25%)</span>
                </div>
              </div>
            )}
          </div>
          
          {/* Achievement Badges */}
          {displayAchievements.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              {displayAchievements.map((a, i) => (
                <span 
                  key={i} 
                  style={{ 
                    fontSize: '1rem', 
                    cursor: 'default', 
                    filter: `drop-shadow(0 0 4px ${a.color}60)`, 
                    position: 'relative' 
                  }}
                  onMouseEnter={() => setHoveredAchievement(i)}
                  onMouseLeave={() => setHoveredAchievement(null)}
                >
                  {a.icon}
                  {hoveredAchievement === i && (
                    <div style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      marginBottom: '8px',
                      backgroundColor: '#0a0a0a',
                      border: `1px solid ${a.color}`,
                      borderRadius: '8px',
                      padding: '0.5rem 0.7rem',
                      fontSize: '0.75rem',
                      whiteSpace: 'nowrap',
                      zIndex: 100,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
                    }}>
                      <div style={{ color: a.color, fontWeight: 'bold', marginBottom: '3px' }}>{a.title}</div>
                      <div style={{ color: '#9ca3af', fontSize: '0.7rem' }}>{a.desc}</div>
                    </div>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
        
        {/* Right: Favorite Button */}
        {onToggleFavorite && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
            style={{ 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer', 
              fontSize: '1.3rem', 
              color: isFavorite ? '#fbbf24' : '#3a3a3a', 
              padding: '0.2rem',
              transition: 'transform 0.15s, color 0.15s'
            }}
            onMouseEnter={(e) => { if (!isFavorite) e.currentTarget.style.color = '#6b7280'; }}
            onMouseLeave={(e) => { if (!isFavorite) e.currentTarget.style.color = '#3a3a3a'; }}
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
          <span style={{ fontSize: '0.75rem', color: '#6b7280', lineHeight: '1.2' }}>Atlas</span>
          <span style={{ fontSize: '0.75rem', color: '#6b7280', lineHeight: '1.2' }}>Score</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
          <span 
            style={{ 
              fontSize: '2rem', 
              fontWeight: '700', 
              ...neonGlow('#22d3ee'),
              fontFamily: 'system-ui',
              lineHeight: 1
            }}
            onMouseEnter={() => setShowAtlasTooltip(true)}
            onMouseLeave={() => setShowAtlasTooltip(false)}
          >
            {animatedScore.toFixed(1)}
          </span>
          {rank && (
            <span style={{ 
              fontSize: '0.85rem', 
              color: '#22d3ee', 
              fontWeight: 'normal'
            }}>
              (#{rank})
            </span>
          )}
        </div>
        
        {showAtlasTooltip && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: '1rem',
            marginBottom: '0.5rem',
            backgroundColor: '#0a0a0a',
            border: '1px solid #22d3ee',
            borderRadius: '8px',
            padding: '0.6rem 0.8rem',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            zIndex: 1000,
            whiteSpace: 'nowrap'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '3px', color: '#22d3ee' }}>
              Atlas Score
            </div>
            <div style={{ color: '#9ca3af', fontSize: '0.7rem' }}>
              Performance rating based on KvK results
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════ QUICK STATS ROW ═══════════════════ */}
      <div style={{ 
        display: 'flex', 
        gap: '0.5rem',
        marginBottom: '1rem'
      }}>
        {/* Total KvKs */}
        <div style={{ 
          flex: 1,
          backgroundColor: '#1a1a20',
          borderRadius: '8px',
          padding: '0.6rem 0.5rem',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#fff' }}>{kingdom.total_kvks}</div>
          <div style={{ fontSize: '0.65rem', color: '#6b7280', marginTop: '2px' }}>KvKs</div>
        </div>
        
        {/* Dominations */}
        <div 
          style={{ 
            flex: 1,
            backgroundColor: '#22c55e12',
            borderRadius: '8px',
            padding: '0.6rem 0.5rem',
            textAlign: 'center',
            position: 'relative',
            cursor: 'default'
          }}
          onMouseEnter={() => setShowHKTooltip(true)}
          onMouseLeave={() => setShowHKTooltip(false)}
        >
          <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#22c55e' }}>{highKings} 👑</div>
          <div style={{ fontSize: '0.65rem', color: '#22c55e80', marginTop: '2px' }}>Dominations</div>
          {showHKTooltip && (
            <div style={{
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: '8px',
              backgroundColor: '#0a0a0a',
              border: '1px solid #22c55e',
              borderRadius: '8px',
              padding: '0.6rem 0.8rem',
              fontSize: '0.75rem',
              whiteSpace: 'nowrap',
              zIndex: 100,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
            }}>
              <div style={{ color: '#22c55e', fontWeight: 'bold', marginBottom: '3px' }}>👑 Dominations</div>
              <div style={{ color: '#9ca3af', fontSize: '0.7rem' }}>Won both Prep and Battle</div>
            </div>
          )}
        </div>
        
        {/* Invasions */}
        <div 
          style={{ 
            flex: 1,
            backgroundColor: '#ef444412',
            borderRadius: '8px',
            padding: '0.6rem 0.5rem',
            textAlign: 'center',
            position: 'relative',
            cursor: 'default'
          }}
          onMouseEnter={() => setShowIKTooltip(true)}
          onMouseLeave={() => setShowIKTooltip(false)}
        >
          <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#ef4444' }}>{invaderKings} 🏳️</div>
          <div style={{ fontSize: '0.65rem', color: '#ef444480', marginTop: '2px' }}>Invasions</div>
          {showIKTooltip && (
            <div style={{
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: '8px',
              backgroundColor: '#0a0a0a',
              border: '1px solid #ef4444',
              borderRadius: '8px',
              padding: '0.6rem 0.8rem',
              fontSize: '0.75rem',
              whiteSpace: 'nowrap',
              zIndex: 100,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
            }}>
              <div style={{ color: '#ef4444', fontWeight: 'bold', marginBottom: '3px' }}>🏳️ Invasions</div>
              <div style={{ color: '#9ca3af', fontSize: '0.7rem' }}>Lost both Prep and Battle</div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════ WIN RATES SECTION ═══════════════════ */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '0.75rem',
        marginBottom: '1rem'
      }}>
        {/* Prep Phase */}
        <div style={{ 
          backgroundColor: '#1a1a20',
          borderRadius: '10px',
          padding: '0.75rem',
          borderLeft: '3px solid #eab308'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '0.5rem'
          }}>
            <span style={{ fontSize: '0.7rem', color: '#eab308', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prep</span>
            <span style={{ fontSize: '1.1rem', fontWeight: '700', color: '#fff' }}>
              {Math.round(kingdom.prep_win_rate * 100)}%
            </span>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#fff', marginBottom: '0.4rem' }}>
            {prepWins}W – {prepLosses}L
            {prepStreak >= 2 && (
              <span style={{ 
                color: '#22c55e', 
                marginLeft: '0.4rem',
                fontSize: '0.7rem'
              }}>
                ({prepStreak}W Streak)
              </span>
            )}
          </div>
          <div style={{ height: '4px', backgroundColor: '#2a2a30', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${kingdom.prep_win_rate * 100}%`,
              backgroundColor: '#eab308',
              borderRadius: '2px',
              transition: 'width 0.5s ease'
            }} />
          </div>
        </div>
        
        {/* Battle Phase */}
        <div style={{ 
          backgroundColor: '#1a1a20',
          borderRadius: '10px',
          padding: '0.75rem',
          borderLeft: '3px solid #f97316'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '0.5rem'
          }}>
            <span style={{ fontSize: '0.7rem', color: '#f97316', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Battle</span>
            <span style={{ fontSize: '1.1rem', fontWeight: '700', color: '#fff' }}>
              {Math.round(kingdom.battle_win_rate * 100)}%
            </span>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#fff', marginBottom: '0.4rem' }}>
            {battleWins}W – {battleLosses}L
            {battleStreak >= 2 && (
              <span style={{ 
                color: '#22c55e', 
                marginLeft: '0.4rem',
                fontSize: '0.7rem'
              }}>
                ({battleStreak}W Streak)
              </span>
            )}
          </div>
          <div style={{ height: '4px', backgroundColor: '#2a2a30', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${kingdom.battle_win_rate * 100}%`,
              backgroundColor: '#f97316',
              borderRadius: '2px',
              transition: 'width 0.5s ease'
            }} />
          </div>
        </div>
      </div>

      {/* ═══════════════════ RECENT FORM ═══════════════════ */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '0.75rem'
      }}>
        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Recent KvKs</span>
        <div style={{ display: 'flex', gap: '4px' }}>
          {recentResults.length > 0 ? (
            recentResults.map((kvk, index) => {
              const outcome = getOutcome(kvk.prep_result, kvk.battle_result);
              const outcomeInfo = OUTCOMES[outcome];
              const isWinResult = (r: string) => r === 'Win' || r === 'W';
              const prepDisplay = isWinResult(kvk.prep_result) ? 'W' : 'L';
              const battleDisplay = isWinResult(kvk.battle_result) ? 'W' : 'L';
              return (
                <div
                  key={kvk.id || index}
                  style={{ position: 'relative' }}
                  onMouseEnter={() => setHoveredResult(index)}
                  onMouseLeave={() => setHoveredResult(null)}
                >
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    backgroundColor: outcomeInfo.bgColor,
                    border: `1px solid ${outcomeInfo.color}50`,
                    color: outcomeInfo.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.7rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    transform: hoveredResult === index ? 'scale(1.15)' : 'scale(1)',
                    boxShadow: hoveredResult === index ? `0 0 12px ${outcomeInfo.color}50` : 'none'
                  }}>
                    {getOutcomeLetter(kvk.prep_result, kvk.battle_result)}
                  </div>
                  
                  {hoveredResult === index && (
                    <div style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      marginBottom: '8px',
                      backgroundColor: '#0a0a0a',
                      border: `1px solid ${outcomeInfo.color}`,
                      borderRadius: '8px',
                      padding: '0.6rem 0.8rem',
                      minWidth: '150px',
                      zIndex: 100,
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
                      animation: 'fadeIn 0.15s ease'
                    }}>
                      <div style={{ fontSize: '0.8rem', color: '#fff', fontWeight: 'bold', marginBottom: '0.5rem', textAlign: 'center' }}>
                        KvK #{kvk.kvk_number} vs K{kvk.opponent_kingdom}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '0.4rem' }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '0.65rem', color: '#6b7280', marginBottom: '2px' }}>Prep</div>
                          <div style={{ fontWeight: 'bold', color: isWinResult(kvk.prep_result) ? '#22c55e' : '#ef4444' }}>{prepDisplay}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '0.65rem', color: '#6b7280', marginBottom: '2px' }}>Battle</div>
                          <div style={{ fontWeight: 'bold', color: isWinResult(kvk.battle_result) ? '#22c55e' : '#ef4444' }}>{battleDisplay}</div>
                        </div>
                      </div>
                      <div style={{ 
                        textAlign: 'center', 
                        paddingTop: '0.4rem', 
                        borderTop: '1px solid #2a2a2a',
                        color: outcomeInfo.color,
                        fontWeight: '600',
                        fontSize: '0.75rem'
                      }}>
                        {outcomeInfo.name}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <span style={{ fontSize: '0.75rem', color: '#3a3a3a', fontStyle: 'italic' }}>No KvK history yet</span>
          )}
        </div>
      </div>

      {/* ═══════════════════ FOOTER ═══════════════════ */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        paddingTop: '0.75rem',
        borderTop: '1px solid #1f1f25'
      }}>
        {/* Transfer Status */}
        <div 
          style={{ fontSize: '0.7rem', position: 'relative', cursor: 'default' }}
          onMouseEnter={() => setShowStatusTooltip(true)}
          onMouseLeave={() => setShowStatusTooltip(false)}
        >
          <span style={{ color: '#6b7280', marginRight: '0.25rem' }}>Transfer Status:</span>
          <span style={{ 
            padding: '0.25rem 0.5rem',
            borderRadius: '4px',
            backgroundColor: status === 'Unannounced' ? '#6b728015' : `${getStatusColor(status)}15`,
            color: status === 'Unannounced' ? '#6b7280' : getStatusColor(status),
            fontWeight: '500'
          }}>
            {status}
          </span>
          {showStatusTooltip && (
            <div style={{
              position: 'absolute',
              bottom: '100%',
              left: '0',
              marginBottom: '8px',
              padding: '0.5rem 0.75rem',
              backgroundColor: '#0a0a0a',
              border: `1px solid ${status === 'Unannounced' ? '#4a4a4a' : getStatusColor(status)}`,
              borderRadius: '8px',
              fontSize: '0.75rem',
              color: '#fff',
              whiteSpace: 'nowrap',
              zIndex: 100,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
            }}>
              <div style={{ color: status === 'Unannounced' ? '#9ca3af' : getStatusColor(status), fontWeight: 'bold', marginBottom: '3px' }}>
                {status === 'Unannounced' ? 'No Data Available' : status}
              </div>
              <div style={{ color: '#9ca3af', fontSize: '0.7rem' }}>
                {status === 'Unannounced' 
                  ? 'Transfer status has not been reported yet' 
                  : getStatusDescription(status)}
              </div>
              {status !== 'Unannounced' && kingdom.last_updated && (
                <div style={{ color: '#6b7280', fontSize: '0.65rem', marginTop: '0.25rem', borderTop: '1px solid #2a2a2a', paddingTop: '0.25rem' }}>
                  Last updated: {new Date(kingdom.last_updated).toLocaleDateString()}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Actions Button */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowSharePopup(!showSharePopup);
            }}
            style={{
              padding: '0.4rem 0.6rem',
              backgroundColor: 'transparent',
              border: '1px solid #3a3a3a',
              borderRadius: '6px',
              color: '#6b7280',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.7rem'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#22d3ee';
              e.currentTarget.style.color = '#22d3ee';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#3a3a3a';
              e.currentTarget.style.color = '#6b7280';
            }}
          >
            Actions
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {/* Actions Dropdown */}
          {showSharePopup && (
            <div
              className="share-popup"
              style={{
                position: 'absolute',
                bottom: '100%',
                right: 0,
                marginBottom: '8px',
                backgroundColor: '#1a1a2e',
                border: '1px solid #333',
                borderRadius: '8px',
                padding: '0.5rem',
                zIndex: 1000,
                minWidth: '160px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.5)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Copy Link */}
              <button
                onClick={() => {
                  const url = `${window.location.origin}/kingdom/${kingdom.kingdom_number}`;
                  navigator.clipboard.writeText(url);
                  if (onCopyLink) onCopyLink();
                  setShowSharePopup(false);
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#d1d5db',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2a2a3e'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                Copy Link
              </button>
              {/* Copy Image */}
              <button
                onClick={async () => {
                  setShowSharePopup(false);
                  await new Promise(r => setTimeout(r, 50));
                  if (cardRef.current) {
                    try {
                      const html2canvas = (await import('html2canvas')).default;
                      const canvas = await html2canvas(cardRef.current, {
                        backgroundColor: '#0a0a0a',
                        scale: 2,
                        logging: false,
                        ignoreElements: (el) => el.classList.contains('share-popup')
                      });
                      canvas.toBlob(async (blob) => {
                        if (blob) {
                          try {
                            await navigator.clipboard.write([
                              new ClipboardItem({ 'image/png': blob })
                            ]);
                            if (onCopyLink) onCopyLink();
                          } catch (clipErr) {
                            const link = document.createElement('a');
                            link.download = `Kingdom-${kingdom.kingdom_number}-stats.png`;
                            link.href = canvas.toDataURL('image/png');
                            link.click();
                          }
                        }
                      }, 'image/png');
                    } catch (err) {
                      console.error('Failed to generate image:', err);
                    }
                  }
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#d1d5db',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2a2a3e'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                Copy Image
              </button>
              {/* Compare Kingdom */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onAddToCompare) onAddToCompare(kingdom.kingdom_number);
                  setShowSharePopup(false);
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#d1d5db',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2a2a3e'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7"/>
                  <rect x="14" y="3" width="7" height="7"/>
                  <line x1="7" y1="21" x2="7" y2="14"/>
                  <line x1="17" y1="21" x2="17" y2="14"/>
                </svg>
                Compare Kingdom
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(-50%) translateY(5px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes sTierPulse {
          0%, 100% { box-shadow: 0 0 8px #fbbf2440; }
          50% { box-shadow: 0 0 16px #fbbf2480, 0 0 24px #fbbf2430; }
        }
        .s-tier-badge {
          animation: sTierPulse 2s ease-in-out infinite;
        }
        .kvk-badge:hover {
          transform: scale(1.2) !important;
        }
      `}</style>

    </div>
  );
};

export default KingdomCard;
