import React, { useState } from 'react';
import { KingdomProfile as KingdomProfileType, getTierDescription as getCentralizedTierDescription, type PowerTier } from '../../types';
import ShareButton from '../ShareButton';
import ScoreFreshness from '../ScoreFreshness';
import { neonGlow, getStatusColor, getTierColor, FONT_DISPLAY } from '../../utils/styles';

interface Achievement {
  icon: string;
  title: string;
  desc: string;
  color: string;
}

interface KingdomHeaderProps {
  kingdom: KingdomProfileType;
  rank: number;
  totalKingdomsAtKvk: number;
  percentileRank: number;
  atlasScore: number;
  powerTier: PowerTier;
  achievements: Achievement[];
  status: string;
  hasPendingSubmission: boolean;
  isMobile: boolean;
  onStatusModalOpen: () => void;
  onReportModalOpen: () => void;
}

const KingdomHeader: React.FC<KingdomHeaderProps> = ({
  kingdom,
  rank,
  totalKingdomsAtKvk,
  percentileRank,
  atlasScore,
  powerTier,
  achievements,
  status,
  hasPendingSubmission,
  isMobile,
  onStatusModalOpen,
  onReportModalOpen,
}) => {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const tierColor = getTierColor(powerTier);

  const handleTooltipToggle = (id: string) => {
    setActiveTooltip(activeTooltip === id ? null : id);
  };

  const getTierDescription = (tier: string) => {
    return getCentralizedTierDescription(tier as PowerTier);
  };

  const getStatusDescription = (status: string) => {
    switch (status) {
      case 'Leading': return 'Open for migration with favorable conditions';
      case 'Ordinary': return 'Standard migration status';
      default: return 'Transfer status not yet available';
    }
  };

  return (
    <div style={{ 
      padding: isMobile ? '1.25rem 1rem 1rem' : '1.75rem 2rem 1.25rem',
      textAlign: 'center',
      background: 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)',
      position: 'relative',
      overflow: 'visible'
    }}>
      <div style={{ position: 'relative', zIndex: 1, maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center' }}>
          {/* Row 1: Kingdom name + tier */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <h1 style={{ 
              fontSize: isMobile ? '1.5rem' : '2.25rem', 
              fontWeight: 'bold', 
              color: '#ffffff',
              fontFamily: FONT_DISPLAY, 
              letterSpacing: '0.02em',
              margin: 0
            }}>
              Kingdom {kingdom.kingdom_number}
            </h1>
            
            {/* Power Tier Badge */}
            <div 
              onClick={() => isMobile && handleTooltipToggle('tier')}
              style={{
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
                fontSize: '0.7rem',
                fontWeight: 'bold',
                backgroundColor: `${tierColor}20`,
                color: tierColor,
                border: `1px solid ${tierColor}40`,
                boxShadow: powerTier === 'S' ? `0 0 8px ${tierColor}40` : 'none',
                cursor: 'pointer',
                position: 'relative'
              }}
              aria-label={getTierDescription(powerTier)}
            >
              {powerTier}-Tier
              {isMobile && activeTooltip === 'tier' && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginTop: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  backgroundColor: '#1f1f1f',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  fontSize: '0.7rem',
                  color: '#fff',
                  whiteSpace: 'nowrap',
                  zIndex: 100
                }}>
                  {getTierDescription(powerTier)}
                </div>
              )}
            </div>
          </div>
          
          {/* Row 2: Atlas Score + Rank + Achievements */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>Atlas Score:</span>
            <span
              onClick={() => isMobile && handleTooltipToggle('score')}
              onMouseEnter={() => !isMobile && setActiveTooltip('score')}
              onMouseLeave={() => !isMobile && setActiveTooltip(null)}
              style={{ 
                fontSize: '2rem', 
                fontWeight: '700', 
                ...neonGlow('#22d3ee'), 
                fontFamily: 'system-ui',
                cursor: 'pointer',
                position: 'relative',
                lineHeight: 1
              }}
            >
              {atlasScore.toFixed(2)}
              {activeTooltip === 'score' && (
                <div style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginBottom: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #22d3ee',
                  borderRadius: '6px',
                  fontSize: '0.7rem',
                  color: '#fff',
                  whiteSpace: 'nowrap',
                  zIndex: 100,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
                }}>
                  <div style={{ color: '#22d3ee', fontWeight: 'bold', marginBottom: '2px' }}>Atlas Score</div>
                  <div style={{ color: '#9ca3af' }}>Rewards experience and consistency over lucky streaks</div>
                </div>
              )}
            </span>
            {rank > 0 && (
              <span style={{ color: '#22d3ee', fontSize: '0.85rem', fontWeight: 'normal' }}>
                (#{rank}{totalKingdomsAtKvk > 0 ? ` of ${totalKingdomsAtKvk}` : ''})
              </span>
            )}
            {percentileRank > 0 && (
              <span style={{
                padding: '0.15rem 0.4rem',
                borderRadius: '4px',
                fontSize: '0.65rem',
                fontWeight: '600',
                backgroundColor: percentileRank >= 90 ? '#22c55e20' : percentileRank >= 70 ? '#eab30820' : percentileRank >= 50 ? '#3b82f620' : '#6b728020',
                color: percentileRank >= 90 ? '#22c55e' : percentileRank >= 70 ? '#eab308' : percentileRank >= 50 ? '#3b82f6' : '#6b7280',
                border: `1px solid ${percentileRank >= 90 ? '#22c55e40' : percentileRank >= 70 ? '#eab30840' : percentileRank >= 50 ? '#3b82f640' : '#6b728040'}`
              }}>
                Top {(100 - percentileRank).toFixed(0)}%
              </span>
            )}
            {kingdom.score_updated_at && (
              <ScoreFreshness updatedAt={kingdom.score_updated_at} style={{ marginLeft: '0.5rem' }} />
            )}
            {/* Achievement badges */}
            {achievements.map((a, i) => (
              <span 
                key={i} 
                onClick={() => isMobile && handleTooltipToggle(`achievement-${i}`)}
                onMouseEnter={() => !isMobile && setActiveTooltip(`achievement-${i}`)}
                onMouseLeave={() => !isMobile && setActiveTooltip(null)}
                style={{ 
                  fontSize: '1rem', 
                  filter: `drop-shadow(0 0 4px ${a.color}60)`,
                  cursor: 'pointer',
                  position: 'relative'
                }}
              >
                {a.icon}
                {activeTooltip === `achievement-${i}` && (
                  <div style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    marginBottom: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    backgroundColor: '#0a0a0a',
                    border: `1px solid ${a.color}`,
                    borderRadius: '6px',
                    fontSize: '0.7rem',
                    color: '#fff',
                    whiteSpace: 'nowrap',
                    zIndex: 100,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
                  }}>
                    <div style={{ color: a.color, fontWeight: 'bold', marginBottom: '2px' }}>{a.title}</div>
                    <div style={{ color: '#9ca3af' }}>{a.desc}</div>
                  </div>
                )}
              </span>
            ))}
          </div>
          
          {/* Row 3: Last Transfer Status */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>Transfer Status:</span>
            <span 
              onClick={() => isMobile && handleTooltipToggle('status')}
              style={{ 
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                fontSize: '0.7rem',
                fontWeight: '500',
                backgroundColor: status === 'Unannounced' ? '#6b728015' : `${getStatusColor(status)}15`,
                color: status === 'Unannounced' ? '#6b7280' : getStatusColor(status),
                border: `1px solid ${status === 'Unannounced' ? '#6b728030' : `${getStatusColor(status)}30`}`,
                cursor: 'pointer',
                position: 'relative',
                height: '24px',
                display: 'inline-flex',
                alignItems: 'center'
              }}
              onMouseEnter={() => !isMobile && setActiveTooltip('status')}
              onMouseLeave={() => !isMobile && setActiveTooltip(null)}
            >
              {status}
              {activeTooltip === 'status' && (
                <div style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginBottom: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  backgroundColor: '#0a0a0a',
                  border: `1px solid ${status === 'Unannounced' ? '#4a4a4a' : getStatusColor(status)}`,
                  borderRadius: '6px',
                  fontSize: '0.7rem',
                  color: '#fff',
                  whiteSpace: 'nowrap',
                  zIndex: 100,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
                }}>
                  <div style={{ color: status === 'Unannounced' ? '#9ca3af' : getStatusColor(status), fontWeight: 'bold', marginBottom: '2px' }}>
                    {status === 'Unannounced' ? 'No Data Available' : status}
                  </div>
                  <div style={{ color: '#9ca3af' }}>
                    {status === 'Unannounced' ? 'Transfer status has not been reported yet' : getStatusDescription(status)}
                  </div>
                  {status !== 'Unannounced' && kingdom.last_updated && (
                    <div style={{ color: '#6b7280', fontSize: '0.65rem', marginTop: '0.25rem', borderTop: '1px solid #2a2a2a', paddingTop: '0.25rem' }}>
                      Last updated: {new Date(kingdom.last_updated).toLocaleDateString()}
                    </div>
                  )}
                </div>
              )}
            </span>
            {/* Update Status Button */}
            <button
              onClick={onStatusModalOpen}
              disabled={hasPendingSubmission}
              style={{
                padding: '0.25rem 0.5rem',
                backgroundColor: hasPendingSubmission ? '#2a2a2a' : '#22d3ee15',
                border: `1px solid ${hasPendingSubmission ? '#3a3a3a' : '#22d3ee40'}`,
                borderRadius: '4px',
                color: hasPendingSubmission ? '#6b7280' : '#22d3ee',
                fontSize: '0.7rem',
                cursor: hasPendingSubmission ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                height: '24px'
              }}
            >
              {hasPendingSubmission ? '⏳ Pending' : '✏️ Update'}
            </button>
          </div>
          
          {/* Row 4: Total KvKs + Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap', position: 'relative', zIndex: 10 }}>
            <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>Total KvKs:</span>
            <span style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 'bold' }}>{kingdom.total_kvks}</span>
            <span style={{ color: '#3a3a3a' }}>|</span>

            {/* Share Button */}
            <ShareButton
              type="kingdom"
              kingdomData={{
                number: kingdom.kingdom_number,
                score: kingdom.overall_score,
                tier: powerTier,
                rank: rank,
                prepWinRate: Math.round(kingdom.prep_win_rate * 100),
                battleWinRate: Math.round(kingdom.battle_win_rate * 100),
                totalKvks: kingdom.total_kvks
              }}
            />
            
            <button
              onClick={onReportModalOpen}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: isMobile ? '0.35rem 0.6rem' : '0.5rem 0.75rem',
                backgroundColor: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '6px',
                color: '#ef4444',
                cursor: 'pointer',
                fontSize: isMobile ? '0.75rem' : '0.85rem',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#ef444420';
                e.currentTarget.style.borderColor = '#ef444440';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#1a1a1a';
                e.currentTarget.style.borderColor = '#333';
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                <line x1="4" y1="22" x2="4" y2="15"/>
              </svg>
              Report
            </button>
          </div>
          
          {/* Decorative divider */}
          {!isMobile && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
            <div style={{ width: '50px', height: '2px', background: 'linear-gradient(90deg, transparent, #22d3ee)' }} />
            <div style={{ width: '6px', height: '6px', backgroundColor: '#22d3ee', transform: 'rotate(45deg)', boxShadow: '0 0 8px #22d3ee' }} />
            <div style={{ width: '50px', height: '2px', background: 'linear-gradient(90deg, #22d3ee, transparent)' }} />
          </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KingdomHeader;
