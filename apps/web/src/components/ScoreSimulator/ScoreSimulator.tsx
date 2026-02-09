import React, { useState, useMemo } from 'react';
import { KingdomProfile } from '../../types';
import { usePremium } from '../../contexts/PremiumContext';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { simulateScore, SimulatedKvK, getSimulatedOutcome } from './simulatorUtils';
import { neonGlow, getTierColor } from '../../utils/styles';

interface ScoreSimulatorProps {
  kingdom: KingdomProfile;
  isExpanded?: boolean;
  onToggle?: (expanded: boolean) => void;
}

const ScoreSimulator: React.FC<ScoreSimulatorProps> = ({ kingdom, isExpanded: externalExpanded, onToggle }) => {
  usePremium(); // Keep hook call for potential future use
  const isMobile = useIsMobile();
  const [simulatedKvKs, setSimulatedKvKs] = useState<SimulatedKvK[]>([
    { prepResult: 'W', battleResult: 'W' }
  ]);
  const [internalExpanded, setInternalExpanded] = useState(false);
  
  // Use external control if provided, otherwise internal state
  const isExpanded = externalExpanded !== undefined ? externalExpanded : internalExpanded;
  const setIsExpanded = (value: boolean) => {
    if (onToggle) {
      onToggle(value);
    } else {
      setInternalExpanded(value);
    }
  };

  // Simulation results - must be called before early returns (hooks rules)
  // Note: Returns valid result even for 0 KvKs; early return below handles that case
  const simulation = useMemo(() => {
    return simulateScore(kingdom, simulatedKvKs);
  }, [kingdom, simulatedKvKs]);

  // Handle edge case: new kingdom with 0 KvKs
  if (kingdom.total_kvks === 0) {
    return (
      <div style={{
        backgroundColor: '#131318',
        borderRadius: '12px',
        padding: isMobile ? '1rem' : '1.25rem',
        border: '1px solid #2a2a2a',
        marginBottom: isMobile ? '1.25rem' : '1.5rem'
      }}>
        <h4 style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '600', margin: '0 0 0.75rem 0', textAlign: 'center' }}>
          Atlas Score Simulator
        </h4>
        <div style={{ color: '#6b7280', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
          Play your first KvK to unlock score projections!
        </div>
      </div>
    );
  }

  const addKvK = () => {
    if (simulatedKvKs.length < 5) {
      setSimulatedKvKs([...simulatedKvKs, { prepResult: 'W', battleResult: 'W' }]);
    }
  };

  const removeKvK = (index: number) => {
    if (simulatedKvKs.length > 1) {
      setSimulatedKvKs(simulatedKvKs.filter((_, i) => i !== index));
    }
  };

  const updateKvK = (index: number, field: 'prepResult' | 'battleResult', value: 'W' | 'L') => {
    const updated = simulatedKvKs.map((kvk, i) => 
      i === index ? { ...kvk, [field]: value } as SimulatedKvK : kvk
    );
    setSimulatedKvKs(updated);
  };

  const resetSimulation = () => {
    setSimulatedKvKs([{ prepResult: 'W', battleResult: 'W' }]);
  };


  const scoreChangeColor = simulation.scoreChange >= 0 ? '#22c55e' : '#ef4444';
  const tierChanged = simulation.currentTier !== simulation.projectedTier;

  return (
    <div style={{
      backgroundColor: '#131318',
      borderRadius: '12px',
      border: '1px solid #2a2a2a',
      marginBottom: isMobile ? '1.25rem' : '1.5rem',
      overflow: 'hidden'
    }}>
      {/* Header - Always visible */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsExpanded(!isExpanded); } }}
        tabIndex={0}
        role="button"
        aria-expanded={isExpanded}
        aria-label="Toggle Atlas Score Simulator"
        style={{
          padding: isMobile ? '1rem' : '1.25rem',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.35rem',
          borderBottom: isExpanded ? '1px solid #2a2a2a' : 'none',
          position: 'relative'
        }}
      >
        <h4 style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '600', margin: 0, textAlign: 'center' }}>
          Atlas Score Simulator
        </h4>
        {!isExpanded && (
          <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>
            &quot;What if I win the next KvK?&quot;
          </span>
        )}
        <svg 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="#6b7280" 
          strokeWidth="2"
          style={{ 
            position: 'absolute',
            right: isMobile ? '1rem' : '1.25rem',
            top: '50%',
            transform: isExpanded ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%) rotate(0deg)',
            transition: 'transform 0.2s ease'
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* Expandable Content */}
      {isExpanded && (
        <div style={{ padding: isMobile ? '1rem' : '1.25rem' }}>
          {/* Current Score Display */}
          <div style={{ 
            textAlign: 'center', 
            marginBottom: '1.25rem',
            padding: '0.75rem',
            backgroundColor: '#0a0a0a',
            borderRadius: '8px',
            border: '1px solid #1f1f1f'
          }}>
            <div style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Current Atlas Score</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <span style={{ 
                fontSize: '1.5rem', 
                fontWeight: 'bold', 
                ...neonGlow('#22d3ee')
              }}>
                {(kingdom.overall_score ?? 0).toFixed(2)}
              </span>
              <span style={{
                padding: '0.15rem 0.35rem',
                backgroundColor: `${getTierColor(simulation.currentTier)}20`,
                color: getTierColor(simulation.currentTier),
                borderRadius: '4px',
                fontSize: '0.65rem',
                fontWeight: 'bold',
                border: `1px solid ${getTierColor(simulation.currentTier)}40`
              }}>
                {simulation.currentTier}-Tier
              </span>
            </div>
          </div>

          {/* Simulate KvKs Section */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '0.75rem'
            }}>
              <span style={{ color: '#9ca3af', fontSize: '0.85rem', fontWeight: '500' }}>
                Simulate Next KvKs
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={resetSimulation}
                  style={{
                    padding: '0.25rem 0.5rem',
                    backgroundColor: 'transparent',
                    border: '1px solid #333',
                    borderRadius: '4px',
                    color: '#6b7280',
                    fontSize: '0.7rem',
                    cursor: 'pointer'
                  }}
                >
                  Reset
                </button>
                {simulatedKvKs.length < 5 && (
                  <button
                    onClick={addKvK}
                    style={{
                      padding: '0.25rem 0.5rem',
                      backgroundColor: '#22d3ee15',
                      border: '1px solid #22d3ee40',
                      borderRadius: '4px',
                      color: '#22d3ee',
                      fontSize: '0.7rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    + Add KvK
                  </button>
                )}
              </div>
            </div>

            {/* KvK Input Rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {simulatedKvKs.map((kvk, index) => {
                const outcome = getSimulatedOutcome(kvk.prepResult, kvk.battleResult);
                return (
                  <div 
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: isMobile ? '0.5rem' : '0.75rem',
                      padding: '0.5rem 0.75rem',
                      backgroundColor: '#0a0a0a',
                      borderRadius: '8px',
                      border: '1px solid #1f1f1f'
                    }}
                  >
                    <span style={{ 
                      color: '#6b7280', 
                      fontSize: '0.75rem',
                      minWidth: isMobile ? '50px' : '60px'
                    }}>
                      KvK #{kingdom.total_kvks + index + 1}
                    </span>

                    {/* Prep Result */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ color: '#eab308', fontSize: '0.65rem' }}>Prep:</span>
                      <select
                        value={kvk.prepResult}
                        onChange={(e) => updateKvK(index, 'prepResult', e.target.value as 'W' | 'L')}
                        style={{
                          padding: '0.25rem 0.4rem',
                          backgroundColor: '#1a1a1a',
                          border: `1px solid ${kvk.prepResult === 'W' ? '#22c55e40' : '#ef444440'}`,
                          borderRadius: '4px',
                          color: kvk.prepResult === 'W' ? '#22c55e' : '#ef4444',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          outline: 'none'
                        }}
                      >
                        <option value="W">W</option>
                        <option value="L">L</option>
                      </select>
                    </div>

                    {/* Battle Result */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ color: '#f97316', fontSize: '0.65rem' }}>Battle:</span>
                      <select
                        value={kvk.battleResult}
                        onChange={(e) => updateKvK(index, 'battleResult', e.target.value as 'W' | 'L')}
                        style={{
                          padding: '0.25rem 0.4rem',
                          backgroundColor: '#1a1a1a',
                          border: `1px solid ${kvk.battleResult === 'W' ? '#22c55e40' : '#ef444440'}`,
                          borderRadius: '4px',
                          color: kvk.battleResult === 'W' ? '#22c55e' : '#ef4444',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          outline: 'none'
                        }}
                      >
                        <option value="W">W</option>
                        <option value="L">L</option>
                      </select>
                      </div>

                    {/* Outcome Badge with emoji */}
                    <span style={{
                      padding: '0.2rem 0.4rem',
                      backgroundColor: outcome.bgColor,
                      border: `1px solid ${outcome.color}40`,
                      borderRadius: '4px',
                      color: outcome.color,
                      fontSize: '0.65rem',
                      fontWeight: 'bold',
                      marginLeft: 'auto',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}>
                      {outcome.emoji} {outcome.label}
                    </span>

                    {/* Remove Button */}
                    {simulatedKvKs.length > 1 && (
                      <button
                        onClick={() => removeKvK(index)}
                        style={{
                          padding: '0.15rem 0.35rem',
                          backgroundColor: 'transparent',
                          border: '1px solid #ef444430',
                          borderRadius: '4px',
                          color: '#ef4444',
                          fontSize: '0.6rem',
                          cursor: 'pointer'
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Projected Results */}
          <div style={{
            padding: '1rem',
            backgroundColor: '#0a0a0a',
            borderRadius: '8px',
            border: `1px solid ${scoreChangeColor}30`,
            marginBottom: '1rem'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              {/* Projected Score */}
              <div style={{ textAlign: 'center', flex: 1, minWidth: '120px' }}>
                <div style={{ color: '#6b7280', fontSize: '0.7rem', marginBottom: '0.25rem' }}>Projected Score</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                  <span style={{ 
                    fontSize: '1.75rem', 
                    fontWeight: 'bold', 
                    ...neonGlow(scoreChangeColor)
                  }}>
                    {simulation.projectedScore.toFixed(2)}
                  </span>
                  {tierChanged && (
                    <span style={{
                      padding: '0.15rem 0.35rem',
                      backgroundColor: `${getTierColor(simulation.projectedTier)}20`,
                      color: getTierColor(simulation.projectedTier),
                      borderRadius: '4px',
                      fontSize: '0.65rem',
                      fontWeight: 'bold',
                      border: `1px solid ${getTierColor(simulation.projectedTier)}40`
                    }}>
                      {simulation.projectedTier}-Tier
                    </span>
                  )}
                </div>
              </div>

              {/* Score Change */}
              <div style={{ textAlign: 'center', flex: 1, minWidth: '100px' }}>
                <div style={{ color: '#6b7280', fontSize: '0.7rem', marginBottom: '0.25rem' }}>Change</div>
                <div style={{ 
                  fontSize: '1.25rem', 
                  fontWeight: 'bold', 
                  color: scoreChangeColor
                }}>
                  {simulation.scoreChange >= 0 ? '+' : ''}{simulation.scoreChange.toFixed(2)}
                </div>
                <div style={{ color: scoreChangeColor, fontSize: '0.7rem' }}>
                  {simulation.percentageChange >= 0 ? '↑' : '↓'} {Math.abs(simulation.percentageChange).toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Breakdown */}
            <div style={{ 
              marginTop: '1rem', 
              paddingTop: '0.75rem', 
              borderTop: '1px solid #1f1f1f',
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
              gap: '0.5rem'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#6b7280', fontSize: '0.6rem' }}>Base Win Rate</div>
                <div style={{ 
                  color: simulation.breakdown.baseScoreChange >= 0 ? '#22c55e' : '#ef4444',
                  fontSize: '0.8rem',
                  fontWeight: '600'
                }}>
                  {simulation.breakdown.baseScoreChange >= 0 ? '+' : ''}{simulation.breakdown.baseScoreChange.toFixed(2)}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#6b7280', fontSize: '0.6rem' }}>Streak Impact</div>
                <div style={{ 
                  color: simulation.breakdown.streakImpact >= 0 ? '#22c55e' : '#ef4444',
                  fontSize: '0.8rem',
                  fontWeight: '600'
                }}>
                  {simulation.breakdown.streakImpact >= 0 ? '+' : ''}{simulation.breakdown.streakImpact.toFixed(2)}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#6b7280', fontSize: '0.6rem' }}>Experience</div>
                <div style={{ 
                  color: simulation.breakdown.experienceGain >= 0 ? '#22c55e' : '#ef4444',
                  fontSize: '0.8rem',
                  fontWeight: '600'
                }}>
                  {simulation.breakdown.experienceGain >= 0 ? '+' : ''}{simulation.breakdown.experienceGain.toFixed(2)}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#6b7280', fontSize: '0.6rem' }}>Form Bonus</div>
                <div style={{ 
                  color: simulation.breakdown.formBonus >= 0 ? '#22c55e' : '#ef4444',
                  fontSize: '0.8rem',
                  fontWeight: '600'
                }}>
                  {simulation.breakdown.formBonus >= 0 ? '+' : ''}{simulation.breakdown.formBonus.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default ScoreSimulator;
