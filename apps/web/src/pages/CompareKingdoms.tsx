import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { KingdomProfile, Kingdom, getPowerTier } from '../types';
import { apiService } from '../services/api';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useAnalytics } from '../hooks/useAnalytics';
import { neonGlow, getTierColor } from '../utils/styles';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { usePremium } from '../contexts/PremiumContext';
import { useAuth } from '../contexts/AuthContext';
import ProBadge from '../components/ProBadge';
import ComparisonRadarChart from '../components/ComparisonRadarChart';
import ShareButton from '../components/ShareButton';
import { useMetaTags, getCompareMetaTags } from '../hooks/useMetaTags';

// Max slots to show in UI (Pro limit)
const MAX_COMPARE_SLOTS = 5;

// Colors for each kingdom in multi-compare (exported for radar chart)
export const KINGDOM_COLORS = ['#22d3ee', '#a855f7', '#22c55e', '#f59e0b', '#ef4444'];

// Helper to calculate radar data for a kingdom
const calculateRadarData = (kingdom: KingdomProfile) => {
  const totalKvks = kingdom.total_kvks || 1;
  const prepWinRate = Math.round(kingdom.prep_win_rate * 100);
  const battleWinRate = Math.round(kingdom.battle_win_rate * 100);
  const dominationRate = Math.round(((kingdom.dominations ?? 0) / totalKvks) * 100);
  const defeatRate = Math.round(((kingdom.defeats ?? 0) / totalKvks) * 100);
  
  const recentKvks = [...(kingdom.recent_kvks || [])].sort((a, b) => b.kvk_number - a.kvk_number).slice(0, 3);
  const recentWins = recentKvks.filter(k => 
    (k.prep_result === 'Win' || k.prep_result === 'W') && 
    (k.battle_result === 'Win' || k.battle_result === 'W')
  ).length;
  const recentPerformance = recentKvks.length > 0 ? Math.round((recentWins / recentKvks.length) * 100) : 50;
  const experienceFactor = Math.min(100, Math.round((totalKvks / 10) * 100));
  
  return [
    { label: 'Prep Win', value: prepWinRate },
    { label: 'Battle Win', value: battleWinRate },
    { label: 'Domination', value: dominationRate },
    { label: 'Recent', value: recentPerformance },
    { label: 'Experience', value: experienceFactor },
    { label: 'Resilience', value: Math.max(0, 100 - defeatRate) },
  ];
};

// Multi-kingdom radar chart component
interface MultiCompareRadarChartProps {
  kingdoms: KingdomProfile[];
  colors: string[];
}

const MultiCompareRadarChart: React.FC<MultiCompareRadarChartProps> = memo(({ kingdoms, colors }) => {
  const [showChart, setShowChart] = useState(false);
  const isMobile = useIsMobile();
  const { trackFeature } = useAnalytics();
  
  const radarData = useMemo(() => 
    kingdoms.map((kingdom, i) => ({
      label: `K${kingdom.kingdom_number}`,
      data: calculateRadarData(kingdom),
      color: colors[i % colors.length] || '#22d3ee'
    })),
    [kingdoms, colors]
  );
  
  const handleToggle = useCallback(() => {
    const newState = !showChart;
    setShowChart(newState);
    if (newState) {
      trackFeature('Compare Radar Opened', {
        kingdomCount: kingdoms.length
      });
    }
  }, [showChart, trackFeature, kingdoms.length]);

  return (
    <div style={{ marginTop: '1rem' }}>
      <button
        onClick={handleToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          width: '100%',
          padding: '1rem 1.5rem',
          background: showChart 
            ? 'linear-gradient(135deg, #22d3ee20 0%, #a855f720 100%)' 
            : 'linear-gradient(135deg, #1a1a2e 0%, #131318 100%)',
          border: `2px solid ${showChart ? '#22d3ee' : '#22d3ee50'}`,
          borderRadius: '12px',
          color: showChart ? '#22d3ee' : '#fff',
          fontSize: '1rem',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          boxShadow: showChart 
            ? '0 0 20px rgba(34, 211, 238, 0.3), 0 0 40px rgba(168, 85, 247, 0.2)' 
            : '0 4px 15px rgba(34, 211, 238, 0.15)'
        }}
      >
        <span style={{ fontSize: '1.25rem' }}>🎯</span>
        <span>{showChart ? 'Hide Visual Comparison' : 'Show Overlapping Comparison'}</span>
        <svg 
          width="18" 
          height="18" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2.5"
          style={{
            transform: showChart ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s ease'
          }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      
      {showChart && (
        <div 
          style={{
            marginTop: '0.75rem',
            padding: isMobile ? '1rem' : '1.25rem',
            backgroundColor: '#131318',
            borderRadius: '12px',
            border: '1px solid #2a2a2a',
            animation: 'fadeIn 0.3s ease-out'
          }}
        >
          <h4 style={{ 
            color: '#fff', 
            fontSize: isMobile ? '0.85rem' : '0.95rem', 
            fontWeight: '600', 
            marginBottom: '0.5rem',
            textAlign: 'center'
          }}>
            🎯 {kingdoms.length}-Kingdom Performance Comparison
          </h4>
          
          <p style={{ 
            color: '#6b7280', 
            fontSize: '0.7rem', 
            textAlign: 'center', 
            marginBottom: '1rem',
            lineHeight: 1.4
          }}>
            Direct visual comparison with overlapping metrics. Hover over datasets to highlight.
          </p>
          
          <ComparisonRadarChart
            datasets={radarData}
            size={isMobile ? 280 : 340}
            animated={true}
            ariaLabel={`Performance comparison of ${kingdoms.map(k => `Kingdom ${k.kingdom_number}`).join(', ')}`}
          />
        </div>
      )}
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
});

const CompareKingdoms: React.FC = () => {
  useDocumentTitle('Compare Kingdoms');
  const [searchParams] = useSearchParams();
  const { features, tier } = usePremium();
  const { user } = useAuth();
  const { trackFeature } = useAnalytics();
  // Multi-kingdom state: array of inputs and loaded kingdoms
  const [kingdomInputs, setKingdomInputs] = useState<string[]>(['', '']);
  const [kingdoms, setKingdoms] = useState<(KingdomProfile | null)[]>([null, null]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [allKingdoms, setAllKingdoms] = useState<Kingdom[]>([]);
  const isMobile = useIsMobile();
  const comparisonRef = useRef<HTMLDivElement>(null);
  
  // Track if initial load from URL params has been done
  const initialLoadDone = useRef(false);
  
  // Get loaded kingdoms (non-null)
  const loadedKingdoms = kingdoms.filter((k): k is KingdomProfile => k !== null);
  
  // Legacy compatibility for old state names
  const kingdom1Input = kingdomInputs[0] || '';
  const kingdom2Input = kingdomInputs[1] || '';
  const setKingdom1Input = (v: string) => setKingdomInputs(prev => [v, prev[1] || '']);
  const setKingdom2Input = (v: string) => setKingdomInputs(prev => [prev[0] || '', v]);
  const kingdom1 = kingdoms[0];
  const kingdom2 = kingdoms[1];
  const setKingdom1 = (k: KingdomProfile | null) => setKingdoms(prev => [k, prev[1] ?? null]);
  const setKingdom2 = (k: KingdomProfile | null) => setKingdoms(prev => [prev[0] ?? null, k]);

  // Update meta tags for better link previews when sharing
  useMetaTags(getCompareMetaTags(kingdom1?.kingdom_number, kingdom2?.kingdom_number));

  useEffect(() => {
    // Fetch ALL kingdoms for accurate ranking (not just top 50)
    apiService.getKingdoms().then(setAllKingdoms);
  }, []);

  // Handle URL params on initial load only
  useEffect(() => {
    if (initialLoadDone.current) return;
    
    const kingdomsParam = searchParams.get('kingdoms');
    if (kingdomsParam) {
      const nums = kingdomsParam.split(',').map(n => n.trim());
      if (nums[0]) setKingdom1Input(nums[0]);
      if (nums[1]) setKingdom2Input(nums[1]);
      if (nums[0] && nums[1]) {
        initialLoadDone.current = true;
        // Inline the compare logic to avoid dependency issues
        const loadComparison = async () => {
          setLoading(true);
          setError('');
          try {
            const [data1, data2] = await Promise.all([
              apiService.getKingdomProfile(parseInt(nums[0]!)),
              apiService.getKingdomProfile(parseInt(nums[1]!))
            ]);
            if (!data1 || !data2) {
              setError('One or both kingdoms not found');
            } else {
              setKingdom1(data1);
              setKingdom2(data2);
            }
          } catch {
            setError('Failed to load kingdom data');
          } finally {
            setLoading(false);
          }
        };
        loadComparison();
      }
    }
  }, [searchParams]);

  const handleCompare = async (k1?: string, k2?: string) => {
    // Gather all non-empty inputs
    const allInputs = [k1 || kingdom1Input, k2 || kingdom2Input, ...kingdomInputs.slice(2)]
      .filter(input => input && input.trim() !== '')
      .slice(0, features.multiCompare); // Limit to user's allowed slots
    
    if (allInputs.length < 2) {
      setError('Please enter at least 2 kingdom numbers');
      return;
    }

    trackFeature('Compare Kingdoms', { 
      kingdomCount: allInputs.length 
    });
    setLoading(true);
    setError('');

    try {
      // Load all kingdoms in parallel
      const results = await Promise.all(
        allInputs.map(input => apiService.getKingdomProfile(parseInt(input)))
      );

      const validResults = results.filter((k): k is KingdomProfile => k !== null);
      
      if (validResults.length < 2) {
        setError('Not enough kingdoms found. Please check the kingdom numbers and try again.');
        return;
      }

      // Pad array to maintain slot positions
      const newKingdoms: (KingdomProfile | null)[] = Array(MAX_COMPARE_SLOTS).fill(null);
      results.forEach((k, i) => {
        newKingdoms[i] = k;
      });
      setKingdoms(newKingdoms);
    } catch (err) {
      setError('Failed to load kingdom data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const getRank = (kingdomNumber: number) => {
    const sorted = [...allKingdoms].sort((a, b) => b.overall_score - a.overall_score);
    const idx = sorted.findIndex(k => k.kingdom_number === kingdomNumber);
    return idx >= 0 ? idx + 1 : 0;
  };

  const getCurrentStreak = (k: KingdomProfile, phase: 'prep' | 'battle') => {
    const sortedKvks = [...(k.recent_kvks || [])].sort((a, b) => b.kvk_number - a.kvk_number);
    let streak = 0;
    for (const kvk of sortedKvks) {
      const result = phase === 'prep' ? kvk.prep_result : kvk.battle_result;
      const isWin = result === 'Win' || result === 'W';
      if (streak === 0) {
        if (!isWin) return 0; // Last game was a loss, current streak is 0
        streak = 1;
      } else if (isWin) {
        streak++;
      } else break;
    }
    return streak;
  };


  // Use full history data from kingdom object (not just recent_kvks)
  const getDominations = (k: KingdomProfile) => k.dominations ?? 0;
  const getDefeats = (k: KingdomProfile) => k.defeats ?? 0;

  
  // Multi-kingdom comparison row - supports 2-5 kingdoms
  const ComparisonRow = ({ label, values, format = 'number', higherIsBetter = true }: { 
    label: string; 
    values: (number | string)[]; 
    format?: string; 
    higherIsBetter?: boolean 
  }) => {
    const numericValues = values.map(v => typeof v === 'number' ? v : parseFloat(String(v)) || 0);
    
    const formatVal = (v: number | string) => {
      if (typeof v === 'string' && isNaN(parseFloat(v))) return v;
      const num = typeof v === 'number' ? v : parseFloat(String(v));
      if (format === 'percent') return Math.round(num * 100) + '%';
      if (format === 'decimal') return num.toFixed(1);
      return num.toString();
    };

    // Find best value
    const bestValue = higherIsBetter 
      ? Math.max(...numericValues) 
      : Math.min(...numericValues);
    const allSame = numericValues.every(v => v === numericValues[0]);

    const getColor = (idx: number) => {
      if (allSame) return '#9ca3af';
      return numericValues[idx] === bestValue ? '#22c55e' : '#ef4444';
    };

    const columnCount = values.length;
    const gridColumns = columnCount === 2 
      ? '1fr auto 1fr' 
      : `repeat(${columnCount}, 1fr)`;

    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: gridColumns,
        alignItems: 'center',
        padding: isMobile ? '0.5rem 0.5rem' : '0.75rem 1rem',
        borderBottom: '1px solid #2a2a2a'
      }}>
        {columnCount === 2 ? (
          // Original 2-kingdom layout with label in middle
          <>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: isMobile ? '0.9rem' : '1rem', fontWeight: 'bold', color: getColor(0) }}>
                {formatVal(values[0] ?? 0)}
              </span>
            </div>
            <div style={{ padding: '0 0.5rem', color: '#6b7280', fontSize: isMobile ? '0.7rem' : '0.75rem', textAlign: 'center', minWidth: isMobile ? '80px' : '110px' }}>
              {label}
            </div>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: isMobile ? '0.9rem' : '1rem', fontWeight: 'bold', color: getColor(1) }}>
                {formatVal(values[1] ?? 0)}
              </span>
            </div>
          </>
        ) : (
          // Multi-kingdom layout - values in columns
          values.map((val, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <span style={{ 
                fontSize: isMobile ? '0.8rem' : '0.9rem', 
                fontWeight: 'bold', 
                color: getColor(i) 
              }}>
                {formatVal(val)}
              </span>
            </div>
          ))
        )}
      </div>
    );
  };


  const SectionDivider = () => (
    <div style={{ height: '1px', backgroundColor: '#333', margin: '0' }} />
  );

  // Multi-kingdom winner calculation
  const calculateWinner = (): number | 'tie' | null => {
    if (loadedKingdoms.length < 2) return null;
    
    // Score each kingdom based on wins across metrics
    const scores = loadedKingdoms.map(() => 0);

    const compareMetric = (getValue: (k: KingdomProfile) => number, higherBetter = true) => {
      const vals = loadedKingdoms.map(getValue);
      const bestVal = higherBetter ? Math.max(...vals) : Math.min(...vals);
      vals.forEach((v, i) => {
        if (v === bestVal && scores[i] !== undefined) scores[i]++;
      });
    };

    compareMetric(k => k.overall_score);
    compareMetric(k => getRank(k.kingdom_number), false);
    compareMetric(k => k.total_kvks);
    compareMetric(k => getDominations(k));
    compareMetric(k => getDefeats(k), false);
    compareMetric(k => k.prep_wins);
    compareMetric(k => k.prep_win_rate);
    compareMetric(k => getCurrentStreak(k, 'prep'));
    compareMetric(k => k.battle_wins);
    compareMetric(k => k.battle_win_rate);
    compareMetric(k => getCurrentStreak(k, 'battle'));

    const maxScore = Math.max(...scores);
    const winners = loadedKingdoms.filter((_, i) => (scores[i] ?? 0) === maxScore);
    
    if (winners.length > 1) return 'tie';
    return winners[0]?.kingdom_number ?? null;
  };


  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      {/* Hero Section - matching directory */}
      <div style={{ 
        padding: isMobile ? '1.25rem 1rem 1rem' : '1.75rem 2rem 1.25rem',
        textAlign: 'center',
        background: 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '800px', margin: '0 auto' }}>
          <h1 style={{ 
            fontSize: isMobile ? '1.5rem' : '2rem', 
            fontWeight: 'bold', 
            marginBottom: '0.5rem',
            fontFamily: "'Cinzel', 'Times New Roman', serif"
          }}>
            <span style={{ color: '#fff' }}>KINGDOM</span>
            <span style={{ ...neonGlow('#22d3ee'), marginLeft: '0.5rem', fontSize: isMobile ? '1.6rem' : '2.25rem' }}>COMPARISON</span>
          </h1>
          <p style={{ color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.9rem', marginBottom: '0.75rem' }}>
            Put any kingdoms in the ring. Let the stats decide.
          </p>
          {!isMobile && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '50px', height: '2px', background: 'linear-gradient(90deg, transparent, #22d3ee)' }} />
            <div style={{ width: '6px', height: '6px', backgroundColor: '#22d3ee', transform: 'rotate(45deg)', boxShadow: '0 0 8px #22d3ee' }} />
            <div style={{ width: '50px', height: '2px', background: 'linear-gradient(90deg, #22d3ee, transparent)' }} />
          </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: isMobile ? '1rem' : '1.5rem' }}>
        {/* Login Required for Anonymous Users */}
        {tier === 'anonymous' && (
          <div style={{
            textAlign: 'center',
            padding: '2rem',
            marginBottom: '1.5rem',
            backgroundColor: '#111111',
            borderRadius: '12px',
            border: '1px solid #22d3ee30'
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🔒</div>
            <h3 style={{ color: '#fff', fontSize: '1.1rem', marginBottom: '0.5rem' }}>
              Sign in to Compare Kingdoms
            </h3>
            <p style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Create a free account to compare up to 2 kingdoms side-by-side.
            </p>
            <Link
              to="/profile"
              style={{
                display: 'inline-block',
                padding: '0.6rem 1.5rem',
                background: 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)',
                borderRadius: '8px',
                color: '#000',
                fontWeight: '600',
                fontSize: '0.9rem',
                textDecoration: 'none'
              }}
            >
              Sign In / Register
            </Link>
            <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '1rem' }}>
              Pro & Recruiter can compare up to 5 kingdoms
            </p>
          </div>
        )}

        {/* Input Section - Only show for logged-in users */}
        {tier !== 'anonymous' && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '1.5rem',
          padding: isMobile ? '1rem' : '1.25rem',
          backgroundColor: '#111111',
          borderRadius: '12px',
          border: '1px solid #2a2a2a'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '1rem', width: '100%', justifyContent: 'center' }}>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={kingdom1Input}
              onChange={(e) => setKingdom1Input(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="Kingdom A"
              className="input-glow"
              style={{
                width: isMobile ? '110px' : '140px',
                padding: isMobile ? '0.7rem' : '0.85rem',
                backgroundColor: '#0a0a0a',
                border: '1px solid #3a3a3a',
                borderRadius: '8px',
                color: '#fff',
                fontSize: isMobile ? '0.85rem' : '0.95rem',
                textAlign: 'center',
                fontWeight: '500',
                outline: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                MozAppearance: 'textfield',
                WebkitAppearance: 'none'
              } as React.CSSProperties}
            />
            <span style={{ color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.9rem', fontWeight: '500' }}>vs</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={kingdom2Input}
              onChange={(e) => setKingdom2Input(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="Kingdom B"
              className="input-glow"
              style={{
                width: isMobile ? '110px' : '140px',
                padding: isMobile ? '0.7rem' : '0.85rem',
                backgroundColor: '#0a0a0a',
                border: '1px solid #3a3a3a',
                borderRadius: '8px',
                color: '#fff',
                fontSize: isMobile ? '0.85rem' : '0.95rem',
                textAlign: 'center',
                fontWeight: '500',
                outline: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                MozAppearance: 'textfield',
                WebkitAppearance: 'none'
              } as React.CSSProperties}
            />
          </div>
          <button
            onClick={() => handleCompare()}
            disabled={loading}
            style={{
              padding: isMobile ? '0.6rem 2rem' : '0.7rem 2.5rem',
              backgroundColor: '#22d3ee',
              border: 'none',
              borderRadius: '8px',
              color: '#000',
              fontWeight: 'bold',
              fontSize: isMobile ? '0.85rem' : '0.9rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Loading...' : 'Compare'}
          </button>
          
          {/* Additional Kingdom Slots */}
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: '0.5rem', 
            justifyContent: 'center',
            marginTop: '0.75rem',
            width: '100%'
          }}>
            {/* Slot 3 - Pro/Recruiter only (Free users have limit of 2) */}
            {(() => {
              const slotIndex = 2;
              const isLocked = features.multiCompare < 3;
              const input = kingdomInputs[slotIndex] || '';
              
              if (isLocked) {
                return (
                  <Link to="/upgrade" style={{ textDecoration: 'none' }}>
                    <div style={{
                      width: isMobile ? '80px' : '100px',
                      height: isMobile ? '38px' : '42px',
                      backgroundColor: '#0a0a0a',
                      border: '1px dashed #333',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      filter: 'blur(2px)',
                      opacity: 0.5,
                      position: 'relative',
                      cursor: 'pointer'
                    }}>
                      <span style={{ color: '#4b5563', fontSize: '0.7rem' }}>+3</span>
                    </div>
                  </Link>
                );
              }
              
              return (
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={input}
                  onChange={(e) => {
                    const newInputs = [...kingdomInputs];
                    newInputs[slotIndex] = e.target.value.replace(/[^0-9]/g, '');
                    setKingdomInputs(newInputs);
                  }}
                  placeholder="+3"
                  className="input-glow"
                  style={{
                    width: isMobile ? '80px' : '100px',
                    padding: isMobile ? '0.6rem' : '0.7rem',
                    backgroundColor: '#0a0a0a',
                    border: '1px solid #3a3a3a',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: isMobile ? '0.8rem' : '0.85rem',
                    textAlign: 'center',
                    fontWeight: '500',
                    outline: 'none'
                  }}
                />
              );
            })()}
            
            {/* Slots 4-5 - Pro users only */}
            {[3, 4].map((slotIndex) => {
              const isLocked = features.multiCompare <= slotIndex;
              const input = kingdomInputs[slotIndex] || '';
              
              if (isLocked) {
                return (
                  <Link key={slotIndex} to={user ? '/upgrade' : '/profile'} style={{ textDecoration: 'none' }}>
                    <div style={{
                      width: isMobile ? '80px' : '100px',
                      height: isMobile ? '38px' : '42px',
                      backgroundColor: '#0a0a0a',
                      border: '1px dashed #22d3ee30',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      filter: 'blur(2px)',
                      opacity: 0.4,
                      position: 'relative',
                      cursor: 'pointer'
                    }}>
                      <span style={{ color: '#22d3ee', fontSize: '0.7rem' }}>+{slotIndex + 1}</span>
                    </div>
                  </Link>
                );
              }
              
              return (
                <input
                  key={slotIndex}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={input}
                  onChange={(e) => {
                    const newInputs = [...kingdomInputs];
                    newInputs[slotIndex] = e.target.value.replace(/[^0-9]/g, '');
                    setKingdomInputs(newInputs);
                  }}
                  placeholder={`+${slotIndex + 1}`}
                  className="input-glow"
                  style={{
                    width: isMobile ? '80px' : '100px',
                    padding: isMobile ? '0.6rem' : '0.7rem',
                    backgroundColor: '#0a0a0a',
                    border: '1px solid #3a3a3a',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: isMobile ? '0.8rem' : '0.85rem',
                    textAlign: 'center',
                    fontWeight: '500',
                    outline: 'none'
                  }}
                />
              );
            })}
          </div>
          
          {/* Upgrade Prompt - tier-aware messaging */}
          {features.multiCompare < MAX_COMPARE_SLOTS && (
            <Link to="/upgrade" style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                marginTop: '0.75rem',
                padding: '0.5rem 0.75rem',
                backgroundColor: '#22d3ee10',
                border: '1px solid #22d3ee30',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}>
                <ProBadge size="sm" />
                <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>
                  Go Pro to compare up to 5 kingdoms
                </span>
              </div>
            </Link>
          )}
        </div>
        )}

        {error && (
          <div style={{ textAlign: 'center', padding: '0.75rem', backgroundColor: '#1f1f1f', borderRadius: '8px', marginBottom: '1rem', color: '#ef4444', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        {loadedKingdoms.length >= 2 && (
          <>
          <div ref={comparisonRef} style={{ backgroundColor: '#111111', borderRadius: '12px', overflow: 'visible', border: '1px solid #2a2a2a' }}>
            {/* Header with kingdom names and tiers - dynamic columns */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: loadedKingdoms.length === 2 
                ? '1fr auto 1fr' 
                : `repeat(${loadedKingdoms.length}, 1fr)`,
              padding: isMobile ? '1rem 0.75rem' : '1.25rem 1rem',
              borderBottom: '1px solid #2a2a2a',
              backgroundColor: '#0a0a0a',
              gap: loadedKingdoms.length > 2 ? '0.5rem' : '0'
            }}>
              {loadedKingdoms.length === 2 ? (
                // Original 2-kingdom layout with vs in middle
                <>
                  <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <Link to={`/kingdom/${loadedKingdoms[0]!.kingdom_number}`} style={{ textDecoration: 'none' }}>
                      <div style={{ fontSize: isMobile ? '1.1rem' : '1.25rem', fontWeight: 'bold', color: KINGDOM_COLORS[0], fontFamily: "'Cinzel', serif" }}>
                        K{loadedKingdoms[0]!.kingdom_number}
                      </div>
                    </Link>
                    <div style={{ 
                      fontSize: isMobile ? '0.7rem' : '0.75rem', 
                      fontWeight: 'bold', 
                      color: getTierColor(loadedKingdoms[0]!.power_tier || getPowerTier(loadedKingdoms[0]!.overall_score)),
                      marginTop: '0.25rem'
                    }}>
                      {loadedKingdoms[0]!.power_tier || getPowerTier(loadedKingdoms[0]!.overall_score)}-Tier
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: isMobile ? '80px' : '110px' }}>
                    <span style={{ color: '#6b7280', fontSize: isMobile ? '0.75rem' : '0.85rem' }}>vs</span>
                  </div>
                  <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <Link to={`/kingdom/${loadedKingdoms[1]!.kingdom_number}`} style={{ textDecoration: 'none' }}>
                      <div style={{ fontSize: isMobile ? '1.1rem' : '1.25rem', fontWeight: 'bold', color: KINGDOM_COLORS[1], fontFamily: "'Cinzel', serif" }}>
                        K{loadedKingdoms[1]!.kingdom_number}
                      </div>
                    </Link>
                    <div style={{ 
                      fontSize: isMobile ? '0.7rem' : '0.75rem', 
                      fontWeight: 'bold', 
                      color: getTierColor(loadedKingdoms[1]!.power_tier || getPowerTier(loadedKingdoms[1]!.overall_score)),
                      marginTop: '0.25rem'
                    }}>
                      {loadedKingdoms[1]!.power_tier || getPowerTier(loadedKingdoms[1]!.overall_score)}-Tier
                    </div>
                  </div>
                </>
              ) : (
                // Multi-kingdom layout - all kingdoms in a row
                loadedKingdoms.map((k, i) => (
                  <div key={k.kingdom_number} style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <Link to={`/kingdom/${k.kingdom_number}`} style={{ textDecoration: 'none' }}>
                      <div style={{ 
                        fontSize: isMobile ? '0.9rem' : '1rem', 
                        fontWeight: 'bold', 
                        color: KINGDOM_COLORS[i % KINGDOM_COLORS.length], 
                        fontFamily: "'Cinzel', serif" 
                      }}>
                        K{k.kingdom_number}
                      </div>
                    </Link>
                    <div style={{ 
                      fontSize: isMobile ? '0.6rem' : '0.65rem', 
                      fontWeight: 'bold', 
                      color: getTierColor(k.power_tier || getPowerTier(k.overall_score)),
                      marginTop: '0.2rem'
                    }}>
                      {k.power_tier || getPowerTier(k.overall_score)}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Atlas Score & Rank */}
            <ComparisonRow label="Atlas Score" values={loadedKingdoms.map(k => k.overall_score || 0)} format="decimal" />
            <ComparisonRow label="Atlas Rank" values={loadedKingdoms.map(k => getRank(k.kingdom_number))} higherIsBetter={false} />
            
            <SectionDivider />

            {/* KvK Stats */}
            <ComparisonRow label="Total KvKs" values={loadedKingdoms.map(k => k.total_kvks)} />
            <ComparisonRow label="Dominations" values={loadedKingdoms.map(k => getDominations(k))} />
            <ComparisonRow label="Invasions" values={loadedKingdoms.map(k => getDefeats(k))} higherIsBetter={false} />
            
            <SectionDivider />

            {/* Prep Stats */}
            <ComparisonRow label="Prep Wins" values={loadedKingdoms.map(k => k.prep_wins)} />
            <ComparisonRow label="Prep Win Rate" values={loadedKingdoms.map(k => k.prep_win_rate)} format="percent" />
            <ComparisonRow label="Prep Streak" values={loadedKingdoms.map(k => getCurrentStreak(k, 'prep'))} />
            
            <SectionDivider />

            {/* Battle Stats */}
            <ComparisonRow label="Battle Wins" values={loadedKingdoms.map(k => k.battle_wins)} />
            <ComparisonRow label="Battle Win Rate" values={loadedKingdoms.map(k => k.battle_win_rate)} format="percent" />
            <ComparisonRow label="Battle Streak" values={loadedKingdoms.map(k => getCurrentStreak(k, 'battle'))} />

            {/* Verdict */}
            <div style={{ padding: isMobile ? '1rem' : '1.25rem', backgroundColor: '#0a0a0a', textAlign: 'center', borderTop: '1px solid #2a2a2a' }}>
              {(() => {
                const winner = calculateWinner();
                if (winner === 'tie') {
                  return <div style={{ color: '#9ca3af', fontSize: isMobile ? '0.9rem' : '1rem', fontWeight: 'bold' }}>It's a tie!</div>;
                }
                return (
                  <div style={{ color: '#22c55e', fontSize: isMobile ? '0.9rem' : '1rem', fontWeight: 'bold' }}>
                    🏆 Kingdom {winner} wins the comparison
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Radar Chart Comparison - supports multi-kingdom */}
          <MultiCompareRadarChart kingdoms={loadedKingdoms} colors={KINGDOM_COLORS} />

          {/* Share Button */}
          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
            <ShareButton
              type="compare"
              compareData={{
                kingdom1: { 
                  number: loadedKingdoms[0]?.kingdom_number ?? 0, 
                  score: loadedKingdoms[0]?.overall_score ?? 0, 
                  tier: loadedKingdoms[0]?.power_tier ?? getPowerTier(loadedKingdoms[0]?.overall_score ?? 0) 
                },
                kingdom2: { 
                  number: loadedKingdoms[1]?.kingdom_number ?? 0, 
                  score: loadedKingdoms[1]?.overall_score ?? 0, 
                  tier: loadedKingdoms[1]?.power_tier ?? getPowerTier(loadedKingdoms[1]?.overall_score ?? 0) 
                },
                winner: calculateWinner() === 'tie' ? 'tie' : 
                  calculateWinner() === loadedKingdoms[0]?.kingdom_number ? 'kingdom1' : 'kingdom2'
              }}
            />
          </div>
          </>
        )}

        {loadedKingdoms.length === 0 && !loading && (
          <div style={{ textAlign: 'center', color: '#6b7280', marginTop: '-0.5rem' }}>
            <div style={{ fontSize: isMobile ? '0.8rem' : '0.85rem' }}>Pick your matchup. The numbers will tell the story.</div>
          </div>
        )}

        {/* Back to Home link */}
        <div style={{ textAlign: 'center', marginTop: '2rem', paddingBottom: '1rem' }}>
          <Link to="/" style={{ color: '#22d3ee', textDecoration: 'none', fontSize: '0.8rem' }}>← Back to Home</Link>
        </div>
      </div>
    </div>
  );
};

export default CompareKingdoms;
