import React, { useState, useEffect, useRef } from 'react';
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
import CompareRadarChart from '../components/CompareRadarChart';
import ShareButton from '../components/ShareButton';
import { useMetaTags, getCompareMetaTags } from '../hooks/useMetaTags';

// Max slots to show in UI (Pro limit)
const MAX_COMPARE_SLOTS = 5;

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
    const input1 = k1 || kingdom1Input;
    const input2 = k2 || kingdom2Input;
    
    if (!input1 || !input2) {
      setError('Please enter both kingdom numbers');
      return;
    }

    trackFeature('Compare Kingdoms', { kingdom1: parseInt(input1), kingdom2: parseInt(input2) });
    setLoading(true);
    setError('');

    try {
      const [data1, data2] = await Promise.all([
        apiService.getKingdomProfile(parseInt(input1)),
        apiService.getKingdomProfile(parseInt(input2))
      ]);

      if (!data1 || !data2) {
        setError('One or both kingdoms not found. Please check the kingdom numbers and try again.');
        return;
      }

      setKingdom1(data1);
      setKingdom2(data2);
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

  
  const ComparisonRow = ({ label, val1, val2, format = 'number', higherIsBetter = true }: { 
    label: string; val1: number | string; val2: number | string; format?: string; higherIsBetter?: boolean 
  }) => {
    const v1 = typeof val1 === 'number' ? val1 : parseFloat(String(val1)) || 0;
    const v2 = typeof val2 === 'number' ? val2 : parseFloat(String(val2)) || 0;
    
    const formatVal = (v: number | string) => {
      if (typeof v === 'string' && isNaN(parseFloat(v))) return v;
      const num = typeof v === 'number' ? v : parseFloat(String(v));
      if (format === 'percent') return Math.round(num * 100) + '%';
      if (format === 'decimal') return num.toFixed(1);
      return num.toString();
    };

    const leftBest = higherIsBetter ? v1 > v2 : v1 < v2;
    const rightBest = higherIsBetter ? v2 > v1 : v2 < v1;
    const tie = v1 === v2;

    const getColor = (isBest: boolean, isTie: boolean) => {
      if (isTie) return '#9ca3af';
      return isBest ? '#22c55e' : '#ef4444';
    };

    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        padding: isMobile ? '0.6rem 0.75rem' : '0.75rem 1rem',
        borderBottom: '1px solid #2a2a2a'
      }}>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: isMobile ? '0.9rem' : '1rem', fontWeight: 'bold', color: getColor(leftBest, tie) }}>
            {formatVal(val1)}
          </span>
        </div>
        <div style={{ padding: '0 0.5rem', color: '#6b7280', fontSize: isMobile ? '0.7rem' : '0.75rem', textAlign: 'center', minWidth: isMobile ? '80px' : '110px' }}>
          {label}
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: isMobile ? '0.9rem' : '1rem', fontWeight: 'bold', color: getColor(rightBest, tie) }}>
            {formatVal(val2)}
          </span>
        </div>
      </div>
    );
  };

  const SectionDivider = () => (
    <div style={{ height: '1px', backgroundColor: '#333', margin: '0' }} />
  );

  const calculateWinner = () => {
    if (!kingdom1 || !kingdom2) return null;
    
    let k1Wins = 0;
    let k2Wins = 0;

    const compare = (v1: number, v2: number, higherBetter = true) => {
      if (v1 === v2) return;
      if (higherBetter ? v1 > v2 : v1 < v2) k1Wins++;
      else k2Wins++;
    };

    compare(kingdom1.overall_score, kingdom2.overall_score);
    compare(getRank(kingdom1.kingdom_number), getRank(kingdom2.kingdom_number), false);
    compare(kingdom1.total_kvks, kingdom2.total_kvks);
    compare(getDominations(kingdom1), getDominations(kingdom2));
    compare(getDefeats(kingdom1), getDefeats(kingdom2), false);
    compare(kingdom1.prep_wins, kingdom2.prep_wins);
    compare(kingdom1.prep_win_rate, kingdom2.prep_win_rate);
    compare(getCurrentStreak(kingdom1, 'prep'), getCurrentStreak(kingdom2, 'prep'));
    compare(kingdom1.battle_wins, kingdom2.battle_wins);
    compare(kingdom1.battle_win_rate, kingdom2.battle_win_rate);
    compare(getCurrentStreak(kingdom1, 'battle'), getCurrentStreak(kingdom2, 'battle'));

    if (k1Wins > k2Wins) return kingdom1.kingdom_number;
    if (k2Wins > k1Wins) return kingdom2.kingdom_number;
    return 'tie';
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
        {/* Input Section */}
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
            {/* Slot 3 - Free users get this */}
            {(() => {
              const slotIndex = 2;
              const isLocked = features.multiCompare < 3;
              const input = kingdomInputs[slotIndex] || '';
              
              if (isLocked) {
                return (
                  <Link to={user ? '/upgrade' : '/profile'} style={{ textDecoration: 'none' }}>
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
            <Link to={user ? '/upgrade' : '/profile'} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                marginTop: '0.75rem',
                padding: '0.5rem 0.75rem',
                backgroundColor: tier === 'anonymous' ? '#ffffff08' : '#22d3ee10',
                border: `1px solid ${tier === 'anonymous' ? '#ffffff20' : '#22d3ee30'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}>
                {tier !== 'anonymous' && <ProBadge size="sm" />}
                <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>
                  {tier === 'anonymous' 
                    ? 'Sign in to compare up to 3 kingdoms'
                    : 'Go Pro to compare up to 5 kingdoms'
                  }
                </span>
              </div>
            </Link>
          )}
        </div>

        {error && (
          <div style={{ textAlign: 'center', padding: '0.75rem', backgroundColor: '#1f1f1f', borderRadius: '8px', marginBottom: '1rem', color: '#ef4444', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        {kingdom1 && kingdom2 && (
          <>
          <div ref={comparisonRef} style={{ backgroundColor: '#111111', borderRadius: '12px', overflow: 'visible', border: '1px solid #2a2a2a' }}>
            {/* Header with kingdom names and tiers - aligned with data columns */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              padding: isMobile ? '1rem 0.75rem' : '1.25rem 1rem',
              borderBottom: '1px solid #2a2a2a',
              backgroundColor: '#0a0a0a'
            }}>
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <Link to={`/kingdom/${kingdom1.kingdom_number}`} style={{ textDecoration: 'none' }}>
                  <div style={{ fontSize: isMobile ? '1.1rem' : '1.25rem', fontWeight: 'bold', color: '#fff', fontFamily: "'Cinzel', serif" }}>
                    Kingdom {kingdom1.kingdom_number}
                  </div>
                </Link>
                <div style={{ 
                  fontSize: isMobile ? '0.7rem' : '0.75rem', 
                  fontWeight: 'bold', 
                  color: getTierColor(kingdom1.power_tier || getPowerTier(kingdom1.overall_score)),
                  marginTop: '0.25rem'
                }}>
                  {kingdom1.power_tier || getPowerTier(kingdom1.overall_score)}-Tier
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: isMobile ? '80px' : '110px' }}>
                <span style={{ color: '#6b7280', fontSize: isMobile ? '0.75rem' : '0.85rem' }}>vs</span>
              </div>
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <Link to={`/kingdom/${kingdom2.kingdom_number}`} style={{ textDecoration: 'none' }}>
                  <div style={{ fontSize: isMobile ? '1.1rem' : '1.25rem', fontWeight: 'bold', color: '#fff', fontFamily: "'Cinzel', serif" }}>
                    Kingdom {kingdom2.kingdom_number}
                  </div>
                </Link>
                <div style={{ 
                  fontSize: isMobile ? '0.7rem' : '0.75rem', 
                  fontWeight: 'bold', 
                  color: getTierColor(kingdom2.power_tier || getPowerTier(kingdom2.overall_score)),
                  marginTop: '0.25rem'
                }}>
                  {kingdom2.power_tier || getPowerTier(kingdom2.overall_score)}-Tier
                </div>
              </div>
            </div>

            {/* Atlas Score & Rank */}
            <ComparisonRow label="Atlas Score" val1={kingdom1.overall_score || 0} val2={kingdom2.overall_score || 0} format="decimal" />
            <ComparisonRow label="Atlas Rank" val1={getRank(kingdom1.kingdom_number)} val2={getRank(kingdom2.kingdom_number)} higherIsBetter={false} />
            
            <SectionDivider />

            {/* KvK Stats */}
            <ComparisonRow label="Total KvKs" val1={kingdom1.total_kvks} val2={kingdom2.total_kvks} />
            <ComparisonRow label="Dominations" val1={getDominations(kingdom1)} val2={getDominations(kingdom2)} />
            <ComparisonRow label="Invasions" val1={getDefeats(kingdom1)} val2={getDefeats(kingdom2)} higherIsBetter={false} />
            
            <SectionDivider />

            {/* Prep Stats */}
            <ComparisonRow label="Prep Wins" val1={kingdom1.prep_wins} val2={kingdom2.prep_wins} />
            <ComparisonRow label="Prep Win Rate" val1={kingdom1.prep_win_rate} val2={kingdom2.prep_win_rate} format="percent" />
            <ComparisonRow label="Prep Streak" val1={getCurrentStreak(kingdom1, 'prep')} val2={getCurrentStreak(kingdom2, 'prep')} />
            
            <SectionDivider />

            {/* Battle Stats */}
            <ComparisonRow label="Battle Wins" val1={kingdom1.battle_wins} val2={kingdom2.battle_wins} />
            <ComparisonRow label="Battle Win Rate" val1={kingdom1.battle_win_rate} val2={kingdom2.battle_win_rate} format="percent" />
            <ComparisonRow label="Battle Streak" val1={getCurrentStreak(kingdom1, 'battle')} val2={getCurrentStreak(kingdom2, 'battle')} />

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

          {/* Radar Chart Comparison */}
          <CompareRadarChart kingdom1={kingdom1} kingdom2={kingdom2} />

          {/* Share Button */}
          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
            <ShareButton
              type="compare"
              compareData={{
                kingdom1: { 
                  number: kingdom1.kingdom_number, 
                  score: kingdom1.overall_score, 
                  tier: kingdom1.power_tier ?? getPowerTier(kingdom1.overall_score) 
                },
                kingdom2: { 
                  number: kingdom2.kingdom_number, 
                  score: kingdom2.overall_score, 
                  tier: kingdom2.power_tier ?? getPowerTier(kingdom2.overall_score) 
                },
                winner: calculateWinner() === 'tie' ? 'tie' : 
                  calculateWinner() === kingdom1.kingdom_number ? 'kingdom1' : 'kingdom2'
              }}
            />
          </div>
          </>
        )}

        {!kingdom1 && !kingdom2 && !loading && (
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
