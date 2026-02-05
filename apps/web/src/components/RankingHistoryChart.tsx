import React, { useState, useEffect, useMemo, useRef } from 'react';
import { scoreHistoryService, ScoreHistoryRecord } from '../services/scoreHistoryService';
import { useIsMobile } from '../hooks/useMediaQuery';
import { CHART_WIDTH, CHART_PADDING, CHART_FONTS, CHART_COLORS, POINT_SIZES, X_AXIS_LABEL_OFFSET, X_AXIS_TITLE_OFFSET, Y_AXIS_GRID_COUNT } from '../constants/chartConstants';

interface RankingHistoryChartProps {
  kingdomNumber: number;
  height?: number;
  isExpanded?: boolean;
  onToggle?: (expanded: boolean) => void;
}

interface ChartDataPoint {
  kvk: number;
  rank: number;
  score: number;
  tier: string;
}

const RankingHistoryChart: React.FC<RankingHistoryChartProps> = ({ 
  kingdomNumber, 
  height = 300,
  isExpanded: externalExpanded,
  onToggle
}) => {
  const [history, setHistory] = useState<ScoreHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [pinnedPoint, setPinnedPoint] = useState<number | null>(null);
  
  const isExpanded = externalExpanded !== undefined ? externalExpanded : internalExpanded;
  const handleToggle = () => {
    const newState = !isExpanded;
    if (onToggle) {
      onToggle(newState);
    } else {
      setInternalExpanded(newState);
    }
  };
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Purple color scheme for ranking
  const accentColor = CHART_COLORS.rankingHistory;

  useEffect(() => {
    const loadHistory = async () => {
      setLoading(true);
      const data = await scoreHistoryService.getKingdomScoreHistory(kingdomNumber);
      setHistory(data?.history || []);
      setLoading(false);
    };
    loadHistory();
  }, [kingdomNumber]);

  const chartData = useMemo((): ChartDataPoint[] => {
    return history
      .filter((record) => record.rank_at_time !== null)
      .map((record) => ({
        kvk: record.kvk_number,
        rank: record.rank_at_time as number,
        score: record.score,
        tier: record.tier
      }));
  }, [history]);

  if (loading) {
    return (
      <div style={{ backgroundColor: '#1a1a20', borderRadius: '12px', padding: '1rem', marginBottom: isMobile ? '1.25rem' : '1.5rem' }}>
        <h4 style={{ margin: '0 0 0.75rem 0', color: '#fff', fontSize: '0.9rem', fontWeight: '600', textAlign: 'center' }}>
          Kingdom Ranking History
        </h4>
        <div style={{
          height: height - 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#6b7280',
          fontSize: '0.85rem'
        }}>
          Loading ranking history...
        </div>
      </div>
    );
  }

  if (chartData.length < 2) {
    return (
      <div style={{ backgroundColor: '#1a1a20', borderRadius: '12px', padding: '1rem', marginBottom: isMobile ? '1.25rem' : '1.5rem' }}>
        <h4 style={{ margin: '0 0 0.75rem 0', color: '#fff', fontSize: '0.9rem', fontWeight: '600', textAlign: 'center' }}>
          Kingdom Ranking History
        </h4>
        <div style={{
          height: height - 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#6b7280',
          fontSize: '0.85rem'
        }}>
          {chartData.length === 0 
            ? 'No ranking history available yet' 
            : 'Need at least 2 KvKs for trend data'}
        </div>
      </div>
    );
  }

  const width = CHART_WIDTH;
  const padding = CHART_PADDING;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate rank range - always start at #1 (top of chart)
  // Lower rank number = better, so rank 1 is at TOP
  const ranks = chartData.map(d => d.rank);
  const minRank = 1; // Always fixed at #1
  const maxRank = Math.max(...ranks) + 3; // Some padding below worst rank
  const rankRange = maxRank - minRank;

  const xScale = (index: number) => 
    padding.left + (chartData.length > 1 ? (index / (chartData.length - 1)) * chartWidth : chartWidth / 2);
  
  // Y-axis inverted: lower rank (better) = higher on chart
  const yScale = (rank: number) => 
    padding.top + ((rank - minRank) / rankRange) * chartHeight;

  const generatePath = () => {
    return chartData.map((d, i) => {
      const x = xScale(i);
      const y = yScale(d.rank);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

  const generateAreaPath = () => {
    const linePath = chartData.map((d, i) => {
      const x = xScale(i);
      const y = yScale(d.rank);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
    
    const lastX = xScale(chartData.length - 1);
    const firstX = xScale(0);
    const bottom = padding.top + chartHeight;
    
    return `${linePath} L ${lastX} ${bottom} L ${firstX} ${bottom} Z`;
  };

  // Calculate change from previous KvK to last KvK
  const prevRank = chartData.length >= 2 ? chartData[chartData.length - 2]?.rank ?? 0 : 0;
  const lastRank = chartData[chartData.length - 1]?.rank ?? 0;
  const lastKvkChange = prevRank - lastRank; // Positive = improved (moved up in ranking)
  const prevKvk = chartData.length >= 2 ? chartData[chartData.length - 2]?.kvk : null;
  const lastKvk = chartData[chartData.length - 1]?.kvk;
  // Green if improved (positive change), red if declined, gray if same
  const trendColor = lastKvkChange > 0 ? '#22c55e' : lastKvkChange < 0 ? '#ef4444' : '#6b7280';

  const activePoint = isMobile ? pinnedPoint : hoveredPoint;
  const activeData = activePoint !== null ? chartData[activePoint] : null;

  const handlePointTap = (index: number) => {
    if (pinnedPoint === index) {
      setPinnedPoint(null);
      setTooltipPos(null);
    } else {
      setPinnedPoint(index);
      setTooltipPos(getTooltipPosition(index));
    }
  };

  const handleChartAreaClick = (e: React.MouseEvent) => {
    if ((e.target as SVGElement).tagName === 'svg') {
      setPinnedPoint(null);
      setTooltipPos(null);
    }
  };

  const getTooltipPosition = (index: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const svgRect = svgRef.current.getBoundingClientRect();
    
    const svgX = padding.left + (chartData.length > 1 ? (index / (chartData.length - 1)) * chartWidth : chartWidth / 2);
    const rank = chartData[index]?.rank ?? 0;
    const svgY = padding.top + ((rank - minRank) / rankRange) * chartHeight;
    
    const scaleX = svgRect.width / width;
    const scaleY = svgRect.height / height;
    
    return { x: svgX * scaleX, y: svgY * scaleY };
  };

  return (
    <div 
      ref={containerRef}
      style={{ backgroundColor: '#1a1a20', borderRadius: '12px', position: 'relative' }}
    >
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
          Kingdom Ranking History
        </h4>
        {!isExpanded && (
          <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>
            &quot;Am I climbing or slipping?&quot;
          </span>
        )}
        {isExpanded && chartData.length >= 2 && prevKvk && lastKvk && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem',
            fontSize: '0.72rem'
          }}>
            <span style={{ color: '#9ca3af' }}>KvK {prevKvk} → {lastKvk}:</span>
            <span style={{ 
              color: trendColor, 
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}>
              {lastKvkChange > 0 ? '▲' : lastKvkChange < 0 ? '▼' : '—'}
              {Math.abs(lastKvkChange)} {Math.abs(lastKvkChange) === 1 ? 'rank' : 'ranks'}
            </span>
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
        <div style={{ padding: isMobile ? '1rem' : '1.25rem', position: 'relative' }}>
          <svg 
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`} 
            style={{ width: '100%', height: 'auto' }}
            preserveAspectRatio="xMidYMid meet"
            onClick={isMobile ? handleChartAreaClick : undefined}
          >
            <defs>
              <linearGradient id={`rankGradient-${kingdomNumber}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={accentColor} stopOpacity="0.3" />
                <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Grid lines - 5 evenly spaced */}
            {Array.from({ length: Y_AXIS_GRID_COUNT }, (_, i) => i / (Y_AXIS_GRID_COUNT - 1)).map((pct, i) => {
              const y = padding.top + chartHeight * pct;
              const rank = Math.round(minRank + rankRange * pct);
              return (
                <g key={i}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={padding.left + chartWidth}
                    y2={y}
                    stroke={CHART_COLORS.gridLine}
                    strokeDasharray="3,3"
                  />
                  <text
                    x={padding.left - 10}
                    y={y + 4}
                    fill={CHART_COLORS.axisLabel}
                    fontSize={CHART_FONTS.axisLabel}
                    textAnchor="end"
                  >
                    #{rank}
                  </text>
                </g>
              );
            })}

            {/* Area fill */}
            <path
              d={generateAreaPath()}
              fill={`url(#rankGradient-${kingdomNumber})`}
            />

            {/* Line */}
            <path
              d={generatePath()}
              fill="none"
              stroke={accentColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

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

            {/* Data points */}
            {chartData.map((d, i) => {
              const x = xScale(i);
              const y = yScale(d.rank);
              const isActive = activePoint === i;
              const sizes = isMobile ? POINT_SIZES.mobile : POINT_SIZES.desktop;
              const hitAreaRadius = sizes.hitArea;
              const pointRadius = isActive ? sizes.active : sizes.normal;

              return (
                <g key={i}>
                  <circle
                    cx={x}
                    cy={y}
                    r={hitAreaRadius}
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onClick={isMobile ? () => handlePointTap(i) : undefined}
                    onMouseEnter={!isMobile ? () => {
                      setHoveredPoint(i);
                      setTooltipPos(getTooltipPosition(i));
                    } : undefined}
                    onMouseLeave={!isMobile ? () => {
                      setHoveredPoint(null);
                      setTooltipPos(null);
                    } : undefined}
                  />
                  
                  <circle
                    cx={x}
                    cy={y}
                    r={pointRadius}
                    fill={accentColor}
                    stroke="#0a0a0a"
                    strokeWidth="2"
                    style={{ transition: 'r 0.15s ease', pointerEvents: 'none' }}
                  />

                  <text
                    x={x}
                    y={padding.top + chartHeight + X_AXIS_LABEL_OFFSET}
                    fill={CHART_COLORS.axisLabel}
                    fontSize={CHART_FONTS.axisLabel}
                    textAnchor="middle"
                  >
                    {d.kvk}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* HTML Tooltip */}
          {activePoint !== null && activeData && tooltipPos && (
            <div
              style={{
                position: 'absolute',
                left: tooltipPos.x,
                top: tooltipPos.y,
                transform: 'translate(-50%, calc(-100% - 12px))',
                backgroundColor: '#0a0a0a',
                border: `1px solid ${accentColor}`,
                borderRadius: '6px',
                padding: isMobile ? '10px 14px' : '8px 12px',
                zIndex: 1000,
                pointerEvents: isMobile ? 'auto' : 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                whiteSpace: 'nowrap'
              }}
              onClick={isMobile ? (e) => e.stopPropagation() : undefined}
            >
              <div style={{ color: '#fff', fontSize: isMobile ? '12px' : '11px', fontWeight: '600', textAlign: 'center' }}>
                Rank #{activeData.rank}
              </div>
              <div style={{ color: '#6b7280', fontSize: isMobile ? '11px' : '10px', textAlign: 'center' }}>
                After KvK {activeData.kvk} • Score: {activeData.score.toFixed(2)}
              </div>
              {isMobile && (
                <div style={{ color: '#4b5563', fontSize: '9px', textAlign: 'center', marginTop: '4px' }}>
                  Tap point again to dismiss
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RankingHistoryChart;
