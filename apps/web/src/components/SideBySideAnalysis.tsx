import React, { useState, useMemo } from 'react';
import { useIsMobile } from '../hooks/useMediaQuery';
import { KingdomProfile } from '../types';
import { useAnalytics } from '../hooks/useAnalytics';
import { neonGlow, getTierColor } from '../utils/styles';
import ComparisonRadarChart from './ComparisonRadarChart';
import ShareButton from './ShareButton';

interface SideBySideAnalysisProps {
  kingdom1: KingdomProfile;
  kingdom2: KingdomProfile;
  showComparisonChart?: boolean;
}

const SideBySideAnalysis: React.FC<SideBySideAnalysisProps> = ({ 
  kingdom1, 
  kingdom2, 
  showComparisonChart = true 
}) => {
  const isMobile = useIsMobile();
  const { trackFeature } = useAnalytics();
  const [activeTab, setActiveTab] = useState<'overview' | 'radar' | 'history'>('overview');
  
  // Calculate radar data for both kingdoms
  const radarData = useMemo(() => ({
    kingdom1: {
      label: `Kingdom ${kingdom1.kingdom_number}`,
      data: [
        { label: 'Prep Win', value: Math.round(kingdom1.prep_win_rate * 100) },
        { label: 'Battle Win', value: Math.round(kingdom1.battle_win_rate * 100) },
        { label: 'Domination', value: Math.round(((kingdom1.dominations ?? 0) / (kingdom1.total_kvks || 1)) * 100) },
        { label: 'Recent', value: (() => {
          const recentKvks = [...(kingdom1.recent_kvks || [])].sort((a, b) => b.kvk_number - a.kvk_number).slice(0, 3);
          const recentWins = recentKvks.filter(k => 
            (k.prep_result === 'Win' || k.prep_result === 'W') && 
            (k.battle_result === 'Win' || k.battle_result === 'W')
          ).length;
          return recentKvks.length > 0 ? Math.round((recentWins / recentKvks.length) * 100) : 50;
        })() },
        { label: 'Experience', value: Math.min(100, Math.round((kingdom1.total_kvks / 10) * 100)) },
        { label: 'Resilience', value: Math.max(0, 100 - Math.round(((kingdom1.invasions ?? kingdom1.defeats ?? 0) / (kingdom1.total_kvks || 1)) * 100)) },
      ],
      color: '#22d3ee'
    },
    kingdom2: {
      label: `Kingdom ${kingdom2.kingdom_number}`,
      data: [
        { label: 'Prep Win', value: Math.round(kingdom2.prep_win_rate * 100) },
        { label: 'Battle Win', value: Math.round(kingdom2.battle_win_rate * 100) },
        { label: 'Domination', value: Math.round(((kingdom2.dominations ?? 0) / (kingdom2.total_kvks || 1)) * 100) },
        { label: 'Recent', value: (() => {
          const recentKvks = [...(kingdom2.recent_kvks || [])].sort((a, b) => b.kvk_number - a.kvk_number).slice(0, 3);
          const recentWins = recentKvks.filter(k => 
            (k.prep_result === 'Win' || k.prep_result === 'W') && 
            (k.battle_result === 'Win' || k.battle_result === 'W')
          ).length;
          return recentKvks.length > 0 ? Math.round((recentWins / recentKvks.length) * 100) : 50;
        })() },
        { label: 'Experience', value: Math.min(100, Math.round((kingdom2.total_kvks / 10) * 100)) },
        { label: 'Resilience', value: Math.max(0, 100 - Math.round(((kingdom2.invasions ?? kingdom2.defeats ?? 0) / (kingdom2.total_kvks || 1)) * 100)) },
      ],
      color: '#a855f7'
    }
  }), [kingdom1, kingdom2]);

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    trackFeature('Side by Side Tab Changed', { tab, kingdom1: kingdom1.kingdom_number, kingdom2: kingdom2.kingdom_number });
  };

  const StatCard = ({ title, value1, value2, format = 'number', higherIsBetter = true }: {
    title: string;
    value1: number | string;
    value2: number | string;
    format?: 'number' | 'percent' | 'decimal';
    higherIsBetter?: boolean;
  }) => {
    const v1 = typeof value1 === 'number' ? value1 : parseFloat(String(value1)) || 0;
    const v2 = typeof value2 === 'number' ? value2 : parseFloat(String(value2)) || 0;
    
    const formatValue = (v: number | string) => {
      if (typeof v === 'string' && isNaN(parseFloat(v))) return v;
      const num = typeof v === 'number' ? v : parseFloat(String(v));
      if (format === 'percent') return Math.round(num * 100) + '%';
      if (format === 'decimal') return num.toFixed(1);
      return num.toString();
    };

    const leftBetter = higherIsBetter ? v1 > v2 : v1 < v2;
    const rightBetter = higherIsBetter ? v2 > v1 : v2 < v1;
    const tie = v1 === v2;

    const getColor = (isBetter: boolean, isTie: boolean) => {
      if (isTie) return '#9ca3af';
      return isBetter ? '#22c55e' : '#ef4444';
    };

    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        padding: isMobile ? '0.5rem 0.75rem' : '0.75rem 1rem',
        backgroundColor: '#0a0a0a',
        borderRadius: '8px',
        marginBottom: '0.5rem'
      }}>
        <div style={{ textAlign: 'center' }}>
          <span style={{ 
            fontSize: isMobile ? '0.9rem' : '1rem', 
            fontWeight: 'bold', 
            color: getColor(leftBetter, tie) 
          }}>
            {formatValue(value1)}
          </span>
        </div>
        <div style={{ 
          padding: '0 0.5rem', 
          color: '#6b7280', 
          fontSize: isMobile ? '0.7rem' : '0.75rem', 
          textAlign: 'center',
          minWidth: isMobile ? '80px' : '100px',
          fontWeight: '500'
        }}>
          {title}
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ 
            fontSize: isMobile ? '0.9rem' : '1rem', 
            fontWeight: 'bold', 
            color: getColor(rightBetter, tie) 
          }}>
            {formatValue(value2)}
          </span>
        </div>
      </div>
    );
  };

  const KingdomCard = ({ kingdom, side }: { kingdom: KingdomProfile; side: 'left' | 'right' }) => {
    const tier = kingdom.power_tier || (() => {
      const score = kingdom.overall_score;
      if (score >= 10) return 'S';
      if (score >= 7) return 'A';
      if (score >= 4.5) return 'B';
      if (score >= 2.5) return 'C';
      return 'D';
    })();
    
    return (
      <div style={{
        flex: 1,
        padding: isMobile ? '1rem' : '1.25rem',
        backgroundColor: '#111111',
        borderRadius: '12px',
        border: `1px solid ${side === 'left' ? '#22d3ee30' : '#a855f730'}`,
        position: 'relative'
      }}>
        {/* Kingdom Header */}
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <h3 style={{ 
            fontSize: isMobile ? '1.1rem' : '1.25rem', 
            fontWeight: 'bold', 
            color: '#fff',
            fontFamily: "'Cinzel', serif",
            margin: '0 0 0.5rem 0'
          }}>
            Kingdom {kingdom.kingdom_number}
          </h3>
          <div style={{ 
            fontSize: '0.75rem', 
            fontWeight: 'bold', 
            color: getTierColor(tier),
            marginBottom: '0.5rem'
          }}>
            {tier}-Tier
          </div>
          <div style={{ 
            fontSize: isMobile ? '1.5rem' : '1.75rem', 
            fontWeight: 'bold', 
            ...neonGlow(side === 'left' ? '#22d3ee' : '#a855f7'),
            fontFamily: 'system-ui'
          }}>
            {kingdom.overall_score.toFixed(1)}
          </div>
          <div style={{ 
            fontSize: '0.7rem', 
            color: side === 'left' ? '#22d3ee' : '#a855f7',
            marginTop: '0.25rem'
          }}>
            Atlas Score
          </div>
        </div>

        {/* Quick Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
          <div style={{ textAlign: 'center', padding: '0.5rem', backgroundColor: '#0a0a0a', borderRadius: '6px' }}>
            <div style={{ fontSize: '0.8rem', color: '#22c55e', fontWeight: 'bold' }}>
              {kingdom.prep_wins}
            </div>
            <div style={{ fontSize: '0.6rem', color: '#6b7280' }}>Prep Wins</div>
          </div>
          <div style={{ textAlign: 'center', padding: '0.5rem', backgroundColor: '#0a0a0a', borderRadius: '6px' }}>
            <div style={{ fontSize: '0.8rem', color: '#f97316', fontWeight: 'bold' }}>
              {kingdom.battle_wins}
            </div>
            <div style={{ fontSize: '0.6rem', color: '#6b7280' }}>Battle Wins</div>
          </div>
          <div style={{ textAlign: 'center', padding: '0.5rem', backgroundColor: '#0a0a0a', borderRadius: '6px' }}>
            <div style={{ fontSize: '0.8rem', color: '#22c55e', fontWeight: 'bold' }}>
              {kingdom.dominations || 0}
            </div>
            <div style={{ fontSize: '0.6rem', color: '#6b7280' }}>Dominations</div>
          </div>
          <div style={{ textAlign: 'center', padding: '0.5rem', backgroundColor: '#0a0a0a', borderRadius: '6px' }}>
            <div style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 'bold' }}>
              {kingdom.invasions ?? kingdom.defeats ?? 0}
            </div>
            <div style={{ fontSize: '0.6rem', color: '#6b7280' }}>Invasions</div>
          </div>
        </div>

        {/* Win Rates */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <div style={{ textAlign: 'center', padding: '0.5rem', backgroundColor: '#0a0a0a', borderRadius: '6px' }}>
            <div style={{ fontSize: '1rem', color: '#fff', fontWeight: 'bold' }}>
              {Math.round(kingdom.prep_win_rate * 100)}%
            </div>
            <div style={{ fontSize: '0.6rem', color: '#6b7280' }}>Prep Win Rate</div>
          </div>
          <div style={{ textAlign: 'center', padding: '0.5rem', backgroundColor: '#0a0a0a', borderRadius: '6px' }}>
            <div style={{ fontSize: '1rem', color: '#fff', fontWeight: 'bold' }}>
              {Math.round(kingdom.battle_win_rate * 100)}%
            </div>
            <div style={{ fontSize: '0.6rem', color: '#6b7280' }}>Battle Win Rate</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ marginTop: '1.5rem' }}>
      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '1rem',
        padding: '0.25rem',
        backgroundColor: '#111111',
        borderRadius: '8px',
        border: '1px solid #2a2a2a'
      }}>
        {(['overview', 'radar', 'history'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            style={{
              flex: 1,
              padding: '0.5rem 1rem',
              backgroundColor: activeTab === tab ? '#22d3ee15' : 'transparent',
              border: activeTab === tab ? '1px solid #22d3ee40' : '1px solid transparent',
              borderRadius: '6px',
              color: activeTab === tab ? '#22d3ee' : '#6b7280',
              fontSize: '0.8rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textTransform: 'capitalize'
            }}
          >
            {tab === 'radar' ? '📊' : tab === 'overview' ? '📋' : '📈'} {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', gap: '1rem', flexDirection: isMobile ? 'column' : 'row' }}>
          <KingdomCard kingdom={kingdom1} side="left" />
          <KingdomCard kingdom={kingdom2} side="right" />
        </div>
      )}

      {activeTab === 'radar' && showComparisonChart && (
        <div style={{
          padding: isMobile ? '1rem' : '1.5rem',
          backgroundColor: '#111111',
          borderRadius: '12px',
          border: '1px solid #2a2a2a'
        }}>
          <h4 style={{ 
            color: '#fff', 
            fontSize: isMobile ? '0.9rem' : '1rem', 
            fontWeight: '600', 
            marginBottom: '1rem',
            textAlign: 'center'
          }}>
            🎯 Direct Performance Comparison
          </h4>
          <ComparisonRadarChart
            datasets={[radarData.kingdom1, radarData.kingdom2]}
            size={isMobile ? 280 : 340}
            animated={true}
            ariaLabel={`Side-by-side comparison between Kingdom ${kingdom1.kingdom_number} and Kingdom ${kingdom2.kingdom_number}`}
          />
        </div>
      )}

      {activeTab === 'history' && (
        <div style={{
          padding: isMobile ? '1rem' : '1.5rem',
          backgroundColor: '#111111',
          borderRadius: '12px',
          border: '1px solid #2a2a2a'
        }}>
          <h4 style={{ 
            color: '#fff', 
            fontSize: isMobile ? '0.9rem' : '1rem', 
            fontWeight: '600', 
            marginBottom: '1rem',
            textAlign: 'center'
          }}>
            📈 Head-to-Head Statistics
          </h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <StatCard 
              title="Atlas Score" 
              value1={kingdom1.overall_score} 
              value2={kingdom2.overall_score} 
              format="decimal" 
            />
            <StatCard 
              title="Total KvKs" 
              value1={kingdom1.total_kvks} 
              value2={kingdom2.total_kvks} 
            />
            <StatCard 
              title="Prep Win Rate" 
              value1={kingdom1.prep_win_rate} 
              value2={kingdom2.prep_win_rate} 
              format="percent" 
            />
            <StatCard 
              title="Battle Win Rate" 
              value1={kingdom1.battle_win_rate} 
              value2={kingdom2.battle_win_rate} 
              format="percent" 
            />
            <StatCard 
              title="Dominations" 
              value1={kingdom1.dominations || 0} 
              value2={kingdom2.dominations || 0} 
            />
            <StatCard 
              title="Invasions" 
              value1={kingdom1.invasions ?? kingdom1.defeats ?? 0} 
              value2={kingdom2.invasions ?? kingdom2.defeats ?? 0} 
              higherIsBetter={false} 
            />
          </div>
        </div>
      )}

      {/* Share Button */}
      <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
        <ShareButton
          type="compare"
          compareData={{
            kingdom1: { 
              number: kingdom1.kingdom_number, 
              score: kingdom1.overall_score, 
              tier: kingdom1.power_tier ?? (() => {
                const score = kingdom1.overall_score;
                if (score >= 10) return 'S';
                if (score >= 7) return 'A';
                if (score >= 4.5) return 'B';
                if (score >= 2.5) return 'C';
                return 'D';
              })()
            },
            kingdom2: { 
              number: kingdom2.kingdom_number, 
              score: kingdom2.overall_score, 
              tier: kingdom2.power_tier ?? (() => {
                const score = kingdom2.overall_score;
                if (score >= 10) return 'S';
                if (score >= 7) return 'A';
                if (score >= 4.5) return 'B';
                if (score >= 2.5) return 'C';
                return 'D';
              })()
            },
            winner: (() => {
              let k1Wins = 0;
              let k2Wins = 0;
              
              const compare = (v1: number, v2: number, higherBetter = true) => {
                if (v1 === v2) return;
                if (higherBetter ? v1 > v2 : v1 < v2) k1Wins++;
                else k2Wins++;
              };
              
              compare(kingdom1.overall_score, kingdom2.overall_score);
              compare(kingdom1.total_kvks, kingdom2.total_kvks);
              compare(kingdom1.dominations || 0, kingdom2.dominations || 0);
              compare(kingdom1.invasions ?? kingdom1.defeats ?? 0, kingdom2.invasions ?? kingdom2.defeats ?? 0, false);
              compare(kingdom1.prep_win_rate, kingdom2.prep_win_rate);
              compare(kingdom1.battle_win_rate, kingdom2.battle_win_rate);
              
              if (k1Wins > k2Wins) return 'kingdom1';
              if (k2Wins > k1Wins) return 'kingdom2';
              return 'tie';
            })()
          }}
        />
      </div>
    </div>
  );
};

export default SideBySideAnalysis;
