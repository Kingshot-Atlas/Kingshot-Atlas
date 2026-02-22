import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KVKRecord } from '../types';
import { useIsMobile } from '../hooks/useMediaQuery';
import { CHART_WIDTH, CHART_PADDING, CHART_FONTS, CHART_COLORS, X_AXIS_LABEL_OFFSET, X_AXIS_TITLE_OFFSET, Y_AXIS_GRID_COUNT } from '../constants/chartConstants';

interface TrendChartProps {
  kvkRecords: KVKRecord[];
  height?: number;
  isExpanded?: boolean;
  onToggle?: (expanded: boolean) => void;
}

const TrendChart: React.FC<TrendChartProps> = ({ 
  kvkRecords, 
  height = 220,
  isExpanded: externalExpanded,
  onToggle
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<{ index: number; type: 'prep' | 'battle' } | null>(null);
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  
  // Use external control if provided, otherwise use internal state
  const isExpanded = externalExpanded !== undefined ? externalExpanded : internalExpanded;
  const handleToggle = () => {
    const newState = !isExpanded;
    if (onToggle) {
      onToggle(newState);
    } else {
      setInternalExpanded(newState);
    }
  };

  const chartData = useMemo(() => {
    if (!kvkRecords || kvkRecords.length === 0) return [];

    // Sort by KvK number ascending (oldest first)
    const sorted = [...kvkRecords].sort((a, b) => a.kvk_number - b.kvk_number);
    
    // Calculate cumulative stats
    let prepWins = 0, prepLosses = 0, battleWins = 0, battleLosses = 0;
    
    return sorted.filter(kvk => kvk.prep_result !== null && kvk.battle_result !== null).map((kvk) => {
      const isWin = (r: string) => r === 'Win' || r === 'W';
      
      if (isWin(kvk.prep_result!)) prepWins++; else prepLosses++;
      if (isWin(kvk.battle_result!)) battleWins++; else battleLosses++;
      
      const totalPrep = prepWins + prepLosses;
      const totalBattle = battleWins + battleLosses;
      
      return {
        kvk: kvk.kvk_number,
        prepWR: totalPrep > 0 ? (prepWins / totalPrep) * 100 : 0,
        battleWR: totalBattle > 0 ? (battleWins / totalBattle) * 100 : 0,
        prepResult: isWin(kvk.prep_result!),
        battleResult: isWin(kvk.battle_result!),
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
        {t('performanceTrend.needTwo', 'Need at least 2 KvKs for trend data')}
      </div>
    );
  }

  const width = CHART_WIDTH;
  const padding = CHART_PADDING;
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

  // Generate area path (for gradient fill)
  const generateAreaPath = (data: number[]) => {
    const linePath = data.map((val, i) => {
      const x = xScale(i);
      const y = yScale(val);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
    
    const lastX = xScale(data.length - 1);
    const firstX = xScale(0);
    const bottomY = yScale(0);
    
    return `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  };

  const prepPath = generatePath(chartData.map(d => d.prepWR));
  const battlePath = generatePath(chartData.map(d => d.battleWR));
  const prepAreaPath = generateAreaPath(chartData.map(d => d.prepWR));
  const battleAreaPath = generateAreaPath(chartData.map(d => d.battleWR));

  // Colors (per brand style guide)
  const prepColor = '#eab308'; // Yellow for prep (brand standard)
  const battleColor = '#f97316'; // Orange for battle

  return (
    <div style={{ backgroundColor: '#1a1a20', borderRadius: '12px' }}>
      {/* Collapsible Header */}
      <div 
        onClick={handleToggle}
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
        <h4 style={{ margin: 0, color: '#fff', fontSize: '0.9rem', fontWeight: '600', textAlign: 'center' }}>
          {t('performanceTrend.title', 'Performance Trend')}
        </h4>
        {!isExpanded && (
          <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>
            {t('performanceTrend.subtitle', '"What\'s my win rate trend?"')}
          </span>
        )}
        {isExpanded && (
          <div style={{ display: 'flex', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <svg width="16" height="8">
                <line x1="0" y1="4" x2="16" y2="4" stroke={prepColor} strokeWidth="2" strokeDasharray="4,2" />
              </svg>
              <span style={{ color: '#9ca3af', fontSize: '0.72rem', fontWeight: '500' }}>{t('performanceTrend.prepWR', 'Prep WR')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <svg width="16" height="8">
                <line x1="0" y1="4" x2="16" y2="4" stroke={battleColor} strokeWidth="2" />
              </svg>
              <span style={{ color: '#9ca3af', fontSize: '0.72rem', fontWeight: '500' }}>{t('performanceTrend.battleWR', 'Battle WR')}</span>
            </div>
          </div>
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

      {/* Expandable Chart Section */}
      {isExpanded && (
        <div style={{ padding: isMobile ? '1rem' : '1.25rem' }}>
          <svg 
        viewBox={`0 0 ${width} ${height}`} 
        style={{ width: '100%', height: 'auto' }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Gradient for prep area */}
          <linearGradient id="prepGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={prepColor} stopOpacity="0.15" />
            <stop offset="100%" stopColor={prepColor} stopOpacity="0" />
          </linearGradient>
          {/* Gradient for battle area */}
          <linearGradient id="battleGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={battleColor} stopOpacity="0.15" />
            <stop offset="100%" stopColor={battleColor} stopOpacity="0" />
          </linearGradient>
          {/* Glow filter for hover */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid lines - 5 evenly spaced */}
        {Array.from({ length: Y_AXIS_GRID_COUNT }, (_, i) => i * (100 / (Y_AXIS_GRID_COUNT - 1))).map(val => (
          <g key={val}>
            <line
              x1={padding.left}
              y1={yScale(val)}
              x2={width - padding.right}
              y2={yScale(val)}
              stroke={CHART_COLORS.gridLine}
              strokeWidth="0.5"
              strokeDasharray={val === 50 ? "none" : "2,4"}
            />
            <text
              x={padding.left - 10}
              y={yScale(val)}
              fill={CHART_COLORS.axisLabel}
              fontSize={CHART_FONTS.axisLabel}
              textAnchor="end"
              dominantBaseline="middle"
            >
              {val}%
            </text>
          </g>
        ))}

        {/* X-axis title */}
        <text
          x={padding.left + chartWidth / 2}
          y={padding.top + chartHeight + X_AXIS_TITLE_OFFSET}
          fill={CHART_COLORS.axisTitle}
          fontSize={CHART_FONTS.axisTitle}
          textAnchor="middle"
        >
          KvKs
        </text>

        {/* X-axis labels - just numbers */}
        {chartData.map((d, i) => (
          <text
            key={i}
            x={xScale(i)}
            y={padding.top + chartHeight + X_AXIS_LABEL_OFFSET}
            fill={CHART_COLORS.axisLabel}
            fontSize={CHART_FONTS.axisLabel}
            textAnchor="middle"
            fontWeight="500"
          >
            {d.kvk}
          </text>
        ))}

        {/* Area fills - Battle first (back layer) */}
        <path
          d={battleAreaPath}
          fill="url(#battleGradient)"
        />
        
        {/* Area fills - Prep second */}
        <path
          d={prepAreaPath}
          fill="url(#prepGradient)"
        />

        {/* Battle Win Rate Line - solid, drawn first */}
        <path
          d={battlePath}
          fill="none"
          stroke={battleColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Prep Win Rate Line - dashed, drawn on top */}
        <path
          d={prepPath}
          fill="none"
          stroke={prepColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="8,4"
        />

        {/* Data points - Battle (filled circles) */}
        {chartData.map((d, i) => {
          const isHovered = hoveredPoint?.index === i && hoveredPoint?.type === 'battle';
          return (
            <g key={`battle-${i}`}>
              <circle
                cx={xScale(i)}
                cy={yScale(d.battleWR)}
                r={isHovered ? 7 : 5}
                fill={battleColor}
                stroke="#1a1a20"
                strokeWidth="2"
                style={{ cursor: 'pointer', transition: 'r 0.15s ease' }}
                filter={isHovered ? "url(#glow)" : undefined}
                onMouseEnter={() => setHoveredPoint({ index: i, type: 'battle' })}
                onMouseLeave={() => setHoveredPoint(null)}
              />
              {isHovered && (
                <text
                  x={xScale(i)}
                  y={yScale(d.battleWR) - 14}
                  fill={battleColor}
                  fontSize="11"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {d.battleWR.toFixed(0)}%
                </text>
              )}
            </g>
          );
        })}

        {/* Data points - Prep (diamond shapes for distinction) */}
        {chartData.map((d, i) => {
          const isHovered = hoveredPoint?.index === i && hoveredPoint?.type === 'prep';
          const x = xScale(i);
          const y = yScale(d.prepWR);
          const size = isHovered ? 7 : 5;
          
          return (
            <g key={`prep-${i}`}>
              <polygon
                points={`${x},${y - size} ${x + size},${y} ${x},${y + size} ${x - size},${y}`}
                fill={prepColor}
                stroke="#1a1a20"
                strokeWidth="2"
                style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                filter={isHovered ? "url(#glow)" : undefined}
                onMouseEnter={() => setHoveredPoint({ index: i, type: 'prep' })}
                onMouseLeave={() => setHoveredPoint(null)}
              />
              {isHovered && (
                <text
                  x={x}
                  y={y - 14}
                  fill={prepColor}
                  fontSize="11"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {d.prepWR.toFixed(0)}%
                </text>
              )}
            </g>
          );
        })}
          </svg>
        </div>
      )}
    </div>
  );
};

export default TrendChart;
