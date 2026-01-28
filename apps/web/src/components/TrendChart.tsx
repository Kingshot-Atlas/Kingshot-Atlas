import React, { useMemo } from 'react';
import { KVKRecord } from '../types';

interface TrendChartProps {
  kvkRecords: KVKRecord[];
  kingdomNumber: number;
  height?: number;
}

const TrendChart: React.FC<TrendChartProps> = ({ kvkRecords, height = 200 }) => {
  const chartData = useMemo(() => {
    // Sort by KvK number ascending (oldest first)
    const sorted = [...kvkRecords].sort((a, b) => a.kvk_number - b.kvk_number);
    
    // Calculate cumulative stats
    let prepWins = 0, prepLosses = 0, battleWins = 0, battleLosses = 0;
    
    return sorted.map((kvk) => {
      const isWin = (r: string) => r === 'Win' || r === 'W';
      
      if (isWin(kvk.prep_result)) prepWins++; else prepLosses++;
      if (isWin(kvk.battle_result)) battleWins++; else battleLosses++;
      
      const totalPrep = prepWins + prepLosses;
      const totalBattle = battleWins + battleLosses;
      
      return {
        kvk: kvk.kvk_number,
        prepWR: totalPrep > 0 ? (prepWins / totalPrep) * 100 : 0,
        battleWR: totalBattle > 0 ? (battleWins / totalBattle) * 100 : 0,
        prepResult: isWin(kvk.prep_result),
        battleResult: isWin(kvk.battle_result),
        opponent: kvk.opponent_kingdom
      };
    });
  }, [kvkRecords]);

  if (chartData.length < 2) {
    return (
      <div style={{
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1a1a20',
        borderRadius: '10px',
        color: '#6b7280',
        fontSize: '0.85rem'
      }}>
        Need at least 2 KvKs for trend data
      </div>
    );
  }

  const width = 400;
  const padding = { top: 20, right: 30, bottom: 40, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const xScale = (index: number) => 
    padding.left + (chartData.length > 1 ? (index / (chartData.length - 1)) * chartWidth : chartWidth / 2);
  
  const yScale = (value: number) => 
    padding.top + ((100 - value) / 100) * chartHeight;

  // Generate path for line
  const generatePath = (data: number[]) => {
    return data.map((val, i) => {
      const x = xScale(i);
      const y = yScale(val);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

  const prepPath = generatePath(chartData.map(d => d.prepWR));
  const battlePath = generatePath(chartData.map(d => d.battleWR));

  return (
    <div style={{ backgroundColor: '#1a1a20', borderRadius: '10px', padding: '1rem' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '1rem'
      }}>
        <h4 style={{ margin: 0, color: '#fff', fontSize: '0.9rem', fontWeight: '600' }}>
          📈 Performance Trend
        </h4>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <div style={{ width: '12px', height: '3px', backgroundColor: '#eab308', borderRadius: '2px' }} />
            <span style={{ color: '#6b7280', fontSize: '0.7rem' }}>Prep WR</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <div style={{ width: '12px', height: '3px', backgroundColor: '#f97316', borderRadius: '2px' }} />
            <span style={{ color: '#6b7280', fontSize: '0.7rem' }}>Battle WR</span>
          </div>
        </div>
      </div>

      <svg 
        viewBox={`0 0 ${width} ${height}`} 
        style={{ width: '100%', height: 'auto' }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map(val => (
          <g key={val}>
            <line
              x1={padding.left}
              y1={yScale(val)}
              x2={width - padding.right}
              y2={yScale(val)}
              stroke="#2a2a2a"
              strokeWidth="0.5"
            />
            <text
              x={padding.left - 8}
              y={yScale(val)}
              fill="#6b7280"
              fontSize="11"
              textAnchor="end"
              dominantBaseline="middle"
            >
              {val}%
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {chartData.map((d, i) => (
          <text
            key={i}
            x={xScale(i)}
            y={height - 12}
            fill="#6b7280"
            fontSize="10"
            textAnchor="middle"
          >
            KvK{d.kvk}
          </text>
        ))}

        {/* Prep Win Rate Line */}
        <path
          d={prepPath}
          fill="none"
          stroke="#eab308"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Battle Win Rate Line */}
        <path
          d={battlePath}
          fill="none"
          stroke="#f97316"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points - Prep */}
        {chartData.map((d, i) => (
          <circle
            key={`prep-${i}`}
            cx={xScale(i)}
            cy={yScale(d.prepWR)}
            r="5"
            fill="#eab308"
          />
        ))}

        {/* Data points - Battle */}
        {chartData.map((d, i) => (
          <circle
            key={`battle-${i}`}
            cx={xScale(i)}
            cy={yScale(d.battleWR)}
            r="5"
            fill="#f97316"
          />
        ))}
      </svg>

      {/* Stats Summary */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '0.5rem',
        marginTop: '1rem',
        paddingTop: '1rem',
        borderTop: '1px solid #2a2a2a'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#6b7280', fontSize: '0.7rem' }}>Current Prep WR</div>
          <div style={{ color: '#eab308', fontWeight: '600' }}>
            {chartData[chartData.length - 1]?.prepWR.toFixed(1)}%
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#6b7280', fontSize: '0.7rem' }}>Current Battle WR</div>
          <div style={{ color: '#f97316', fontWeight: '600' }}>
            {chartData[chartData.length - 1]?.battleWR.toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrendChart;
