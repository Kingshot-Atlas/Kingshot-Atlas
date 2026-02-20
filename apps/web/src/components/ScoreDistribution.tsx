import React, { useMemo, memo, useState } from 'react';
import { useIsMobile } from '../hooks/useMediaQuery';
import { 
  Kingdom, 
  getPowerTier, 
  TIER_COLORS,
  type PowerTier
} from '../types';

interface ScoreDistributionProps {
  kingdoms: Kingdom[];
}

const ScoreDistribution: React.FC<ScoreDistributionProps> = ({ kingdoms }) => {
  const isMobile = useIsMobile();
  const [showDetails, setShowDetails] = useState(false);
  
  const distribution = useMemo(() => {
    const scores = kingdoms.map(k => k.overall_score).filter(s => s != null);
    if (scores.length === 0) return null;
    
    const sorted = [...scores].sort((a, b) => a - b);
    const total = sorted.length;
    
    // Tier counts
    const tierCounts: Record<PowerTier, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
    scores.forEach(score => {
      tierCounts[getPowerTier(score)]++;
    });
    
    // Score buckets for histogram — aligned with 0-100 scale tier thresholds
    const buckets: { range: string; count: number; color: string }[] = [
      { range: '0-29', count: 0, color: '#ef4444' },
      { range: '29-38', count: 0, color: '#f97316' },
      { range: '38-47', count: 0, color: '#3b82f6' },
      { range: '47-57', count: 0, color: '#3b82f6' },
      { range: '57-70', count: 0, color: '#22c55e' },
      { range: '70-85', count: 0, color: '#22c55e' },
      { range: '85+', count: 0, color: '#fbbf24' },
    ];
    
    scores.forEach(score => {
      if (score < 29) buckets[0]!.count++;
      else if (score < 38) buckets[1]!.count++;
      else if (score < 47) buckets[2]!.count++;
      else if (score < 57) buckets[3]!.count++;
      else if (score < 70) buckets[4]!.count++;
      else if (score < 85) buckets[5]!.count++;
      else buckets[6]!.count++;
    });
    
    const maxBucket = Math.max(...buckets.map(b => b.count));
    
    return {
      total,
      tierCounts,
      tierPercentages: {
        S: Math.round((tierCounts.S / total) * 100),
        A: Math.round((tierCounts.A / total) * 100),
        B: Math.round((tierCounts.B / total) * 100),
        C: Math.round((tierCounts.C / total) * 100),
        D: Math.round((tierCounts.D / total) * 100),
      },
      buckets,
      maxBucket,
      stats: {
        min: Math.round(sorted[0]! * 100) / 100,
        max: Math.round(sorted[total - 1]! * 100) / 100,
        mean: Math.round((scores.reduce((a, b) => a + b, 0) / total) * 100) / 100,
        median: Math.round(sorted[Math.floor(total / 2)]! * 100) / 100,
        p25: Math.round(sorted[Math.floor(total * 0.25)]! * 100) / 100,
        p75: Math.round(sorted[Math.floor(total * 0.75)]! * 100) / 100,
        p90: Math.round(sorted[Math.floor(total * 0.90)]! * 100) / 100,
      }
    };
  }, [kingdoms]);
  
  if (!distribution) {
    return null;
  }
  
  return (
    <div style={{
      backgroundColor: '#131318',
      borderRadius: '12px',
      border: '1px solid #2a2a2a',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        style={{
          width: '100%',
          padding: isMobile ? '0.75rem 1rem' : '1rem 1.25rem',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1rem' }}>📊</span>
          <span style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '600' }}>
            Score Distribution
          </span>
          <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>
            ({distribution.total} kingdoms)
          </span>
        </div>
        <svg 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="#6b7280" 
          strokeWidth="2"
          style={{
            transform: showDetails ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s'
          }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      
      {/* Tier Summary - Always visible */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '0.5rem',
        padding: '0 1rem 1rem',
        flexWrap: 'wrap'
      }}>
        {(['S', 'A', 'B', 'C', 'D'] as PowerTier[]).map(tier => (
          <div
            key={tier}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.35rem 0.6rem',
              backgroundColor: `${TIER_COLORS[tier]}15`,
              borderRadius: '6px',
              border: `1px solid ${TIER_COLORS[tier]}30`
            }}
          >
            <span style={{ 
              color: TIER_COLORS[tier], 
              fontWeight: '700', 
              fontSize: '0.8rem' 
            }}>
              {tier}
            </span>
            <span style={{ color: '#9ca3af', fontSize: '0.7rem' }}>
              {distribution.tierCounts[tier]}
            </span>
            <span style={{ color: '#6b7280', fontSize: '0.6rem' }}>
              ({distribution.tierPercentages[tier]}%)
            </span>
          </div>
        ))}
      </div>
      
      {/* Expanded Details */}
      {showDetails && (
        <div style={{
          padding: '1rem',
          borderTop: '1px solid #2a2a2a',
          animation: 'fadeIn 0.3s ease-out'
        }}>
          {/* Histogram */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ 
              color: '#9ca3af', 
              fontSize: '0.7rem', 
              marginBottom: '0.5rem',
              fontWeight: '500'
            }}>
              Score Distribution Histogram
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: '2px',
              height: '80px',
              padding: '0.5rem',
              backgroundColor: '#0a0a0a',
              borderRadius: '8px'
            }}>
              {distribution.buckets.map((bucket, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: `${(bucket.count / distribution.maxBucket) * 60}px`,
                      backgroundColor: bucket.color,
                      borderRadius: '2px 2px 0 0',
                      transition: 'height 0.3s ease',
                      minHeight: bucket.count > 0 ? '4px' : '0'
                    }}
                    title={`${bucket.range}: ${bucket.count} kingdoms`}
                  />
                  <span style={{ 
                    color: '#6b7280', 
                    fontSize: '0.5rem',
                    whiteSpace: 'nowrap'
                  }}>
                    {bucket.range}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Statistics */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '0.5rem'
          }}>
            {[
              { label: 'Min', value: distribution.stats.min },
              { label: 'Median', value: distribution.stats.median },
              { label: 'Mean', value: distribution.stats.mean },
              { label: 'Max', value: distribution.stats.max },
            ].map((stat, i) => (
              <div
                key={i}
                style={{
                  padding: '0.5rem',
                  backgroundColor: '#0a0a0a',
                  borderRadius: '6px',
                  textAlign: 'center'
                }}
              >
                <div style={{ color: '#6b7280', fontSize: '0.6rem' }}>
                  {stat.label}
                </div>
                <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '600' }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
          
          {/* Percentiles */}
          <div style={{
            marginTop: '0.75rem',
            padding: '0.75rem',
            backgroundColor: '#0a0a0a',
            borderRadius: '8px'
          }}>
            <div style={{ 
              color: '#9ca3af', 
              fontSize: '0.65rem', 
              marginBottom: '0.5rem' 
            }}>
              Percentile Thresholds
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              color: '#6b7280',
              fontSize: '0.7rem'
            }}>
              <span>P25: <strong style={{ color: '#fff' }}>{distribution.stats.p25}</strong></span>
              <span>P50: <strong style={{ color: '#fff' }}>{distribution.stats.median}</strong></span>
              <span>P75: <strong style={{ color: '#fff' }}>{distribution.stats.p75}</strong></span>
              <span>P90: <strong style={{ color: '#fff' }}>{distribution.stats.p90}</strong></span>
            </div>
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default memo(ScoreDistribution);
