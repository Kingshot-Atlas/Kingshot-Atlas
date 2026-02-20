import React, { useMemo, memo, useState } from 'react';
import { useIsMobile } from '../hooks/useMediaQuery';
import { 
  KingdomProfile, 
  TIER_COLORS,
  extractStatsFromProfile,
  calculateAtlasScore,
  type PowerTier
} from '../types';

interface ScorePredictionProps {
  kingdom: KingdomProfile;
  opponent?: KingdomProfile;
}

type MatchupOutcome = 'Domination' | 'Comeback' | 'Reversal' | 'Invasion';

interface Prediction {
  outcome: MatchupOutcome;
  probability: number;
  projectedScore: number;
  scoreChange: number;
  newTier: PowerTier;
  tierChange: boolean;
}

const ScorePrediction: React.FC<ScorePredictionProps> = ({ kingdom, opponent }) => {
  const isMobile = useIsMobile();
  const [selectedOutcome, setSelectedOutcome] = useState<MatchupOutcome | null>(null);
  
  const predictions = useMemo(() => {
    const stats = extractStatsFromProfile(kingdom);
    const currentBreakdown = calculateAtlasScore(stats);
    const currentScore = currentBreakdown.finalScore;
    const currentTier = currentBreakdown.tier;
    
    // Calculate probabilities based on current stats
    const prepWinProb = kingdom.prep_win_rate || 0.5;
    const battleWinProb = kingdom.battle_win_rate || 0.5;
    
    // Adjust for opponent if provided
    let adjustedPrepProb = prepWinProb;
    let adjustedBattleProb = battleWinProb;
    
    if (opponent) {
      const oppPrepWin = opponent.prep_win_rate || 0.5;
      const oppBattleWin = opponent.battle_win_rate || 0.5;
      // Simple probability adjustment based on opponent strength
      adjustedPrepProb = prepWinProb * (1 - oppPrepWin) / ((prepWinProb * (1 - oppPrepWin)) + ((1 - prepWinProb) * oppPrepWin)) || 0.5;
      adjustedBattleProb = battleWinProb * (1 - oppBattleWin) / ((battleWinProb * (1 - oppBattleWin)) + ((1 - battleWinProb) * oppBattleWin)) || 0.5;
    }
    
    const outcomes: { outcome: MatchupOutcome; prepWin: boolean; battleWin: boolean }[] = [
      { outcome: 'Domination', prepWin: true, battleWin: true },
      { outcome: 'Comeback', prepWin: false, battleWin: true },
      { outcome: 'Reversal', prepWin: true, battleWin: false },
      { outcome: 'Invasion', prepWin: false, battleWin: false },
    ];
    
    const result: Prediction[] = outcomes.map(({ outcome, prepWin, battleWin }) => {
      // Calculate outcome probability
      const prob = (prepWin ? adjustedPrepProb : (1 - adjustedPrepProb)) * 
                   (battleWin ? adjustedBattleProb : (1 - adjustedBattleProb));
      
      // Simulate score change
      const simStats = { ...stats };
      simStats.totalKvks += 1;
      if (prepWin) simStats.prepWins += 1;
      else simStats.prepLosses += 1;
      if (battleWin) simStats.battleWins += 1;
      else simStats.battleLosses += 1;
      if (prepWin && battleWin) simStats.dominations += 1;
      if (!prepWin && !battleWin) simStats.invasions += 1;
      simStats.currentPrepStreak = prepWin ? Math.max(1, simStats.currentPrepStreak + 1) : 0;
      simStats.currentBattleStreak = battleWin ? Math.max(1, simStats.currentBattleStreak + 1) : 0;
      simStats.recentOutcomes = [outcome, ...simStats.recentOutcomes.slice(0, 4)];
      
      const projectedBreakdown = calculateAtlasScore(simStats);
      const projectedScore = projectedBreakdown.finalScore;
      
      return {
        outcome,
        probability: prob,
        projectedScore,
        scoreChange: projectedScore - currentScore,
        newTier: projectedBreakdown.tier,
        tierChange: projectedBreakdown.tier !== currentTier
      };
    });
    
    // Sort by probability
    result.sort((a, b) => b.probability - a.probability);
    
    return { predictions: result, currentScore, currentTier };
  }, [kingdom, opponent]);
  
  const getOutcomeIcon = (outcome: MatchupOutcome) => {
    switch (outcome) {
      case 'Domination': return '👑';
      case 'Comeback': return '🔄';
      case 'Reversal': return '↩️';
      case 'Invasion': return '💀';
    }
  };
  
  const getOutcomeColor = (outcome: MatchupOutcome) => {
    switch (outcome) {
      case 'Domination': return '#22c55e';
      case 'Comeback': return '#3b82f6';
      case 'Reversal': return '#f97316';
      case 'Invasion': return '#ef4444';
    }
  };
  
  return (
    <div style={{
      padding: isMobile ? '1rem' : '1.25rem',
      backgroundColor: '#131318',
      borderRadius: '12px',
      border: '1px solid #2a2a2a'
    }}>
      <h4 style={{
        color: '#fff',
        fontSize: isMobile ? '0.9rem' : '0.95rem',
        fontWeight: '600',
        marginBottom: '0.75rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        🎯 Next KvK Prediction
        {opponent && (
          <span style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: '400' }}>
            vs K{opponent.kingdom_number}
          </span>
        )}
      </h4>
      
      {/* Current Score */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        marginBottom: '1rem',
        padding: '0.5rem 0.75rem',
        backgroundColor: '#0a0a0a',
        borderRadius: '8px'
      }}>
        <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>Current:</span>
        <span style={{ 
          color: TIER_COLORS[predictions.currentTier], 
          fontWeight: '600',
          fontSize: '0.9rem'
        }}>
          {predictions.currentScore.toFixed(2)}
        </span>
        <span style={{ 
          color: TIER_COLORS[predictions.currentTier], 
          fontSize: '0.7rem'
        }}>
          ({predictions.currentTier}-Tier)
        </span>
      </div>
      
      {/* Outcome Predictions */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '0.5rem'
      }}>
        {predictions.predictions.map((pred, _i) => (
          <button
            key={pred.outcome}
            onClick={() => setSelectedOutcome(selectedOutcome === pred.outcome ? null : pred.outcome)}
            style={{
              padding: '0.6rem',
              backgroundColor: selectedOutcome === pred.outcome ? `${getOutcomeColor(pred.outcome)}15` : '#0a0a0a',
              border: `1px solid ${selectedOutcome === pred.outcome ? getOutcomeColor(pred.outcome) : '#1a1a1a'}`,
              borderRadius: '8px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s'
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.35rem'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}>
                <span style={{ fontSize: '0.9rem' }}>{getOutcomeIcon(pred.outcome)}</span>
                <span style={{ color: '#fff', fontSize: '0.75rem', fontWeight: '500' }}>
                  {pred.outcome}
                </span>
              </div>
              <span style={{ 
                color: getOutcomeColor(pred.outcome), 
                fontSize: '0.7rem',
                fontWeight: '600'
              }}>
                {Math.round(pred.probability * 100)}%
              </span>
            </div>
            
            {/* Probability bar */}
            <div style={{
              height: '4px',
              backgroundColor: '#1a1a1a',
              borderRadius: '2px',
              overflow: 'hidden',
              marginBottom: '0.35rem'
            }}>
              <div style={{
                height: '100%',
                width: `${pred.probability * 100}%`,
                backgroundColor: getOutcomeColor(pred.outcome),
                borderRadius: '2px'
              }} />
            </div>
            
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.65rem'
            }}>
              <span style={{
                color: pred.scoreChange >= 0 ? '#22c55e' : '#ef4444'
              }}>
                {pred.scoreChange >= 0 ? '+' : ''}{pred.scoreChange.toFixed(2)}
              </span>
              <span style={{ color: '#6b7280' }}>
                → {pred.projectedScore.toFixed(2)}
              </span>
              {pred.tierChange && (
                <span style={{ color: '#fbbf24' }}>⭐</span>
              )}
            </div>
          </button>
        ))}
      </div>
      
      {/* Selected outcome details */}
      {selectedOutcome && (
        <div style={{
          marginTop: '0.75rem',
          padding: '0.75rem',
          backgroundColor: '#0a0a0a',
          borderRadius: '8px',
          border: `1px solid ${getOutcomeColor(selectedOutcome)}30`
        }}>
          {(() => {
            const pred = predictions.predictions.find(p => p.outcome === selectedOutcome);
            if (!pred) return null;
            return (
              <div style={{ fontSize: '0.7rem' }}>
                <div style={{ color: '#fff', marginBottom: '0.5rem' }}>
                  If next KvK is a <strong style={{ color: getOutcomeColor(pred.outcome) }}>{pred.outcome}</strong>:
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9ca3af' }}>
                  <span>New Score: <strong style={{ color: '#fff' }}>{pred.projectedScore.toFixed(2)}</strong></span>
                  <span>Change: <strong style={{ color: pred.scoreChange >= 0 ? '#22c55e' : '#ef4444' }}>
                    {pred.scoreChange >= 0 ? '+' : ''}{pred.scoreChange.toFixed(2)}
                  </strong></span>
                </div>
                {pred.tierChange && (
                  <div style={{ marginTop: '0.5rem', color: '#fbbf24', textAlign: 'center' }}>
                    ⭐ Tier change: {predictions.currentTier} → {pred.newTier}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
      
      {/* Most Likely Outcome */}
      <div style={{
        marginTop: '0.75rem',
        padding: '0.5rem',
        backgroundColor: '#0a0a0a',
        borderRadius: '6px',
        textAlign: 'center',
        fontSize: '0.7rem'
      }}>
        <span style={{ color: '#6b7280' }}>Most likely: </span>
        <span style={{ color: getOutcomeColor(predictions.predictions[0]?.outcome ?? 'Domination'), fontWeight: '600' }}>
          {predictions.predictions[0]?.outcome} ({Math.round((predictions.predictions[0]?.probability ?? 0) * 100)}%)
        </span>
      </div>
    </div>
  );
};

export default memo(ScorePrediction);
