import React, { useState, useEffect, useMemo, useRef } from 'react';
import { scoreHistoryService, ScoreHistoryRecord } from '../services/scoreHistoryService';
import { useIsMobile } from '../hooks/useMediaQuery';
import { CHART_WIDTH, CHART_PADDING, CHART_FONTS, CHART_COLORS, POINT_SIZES, X_AXIS_LABEL_OFFSET, X_AXIS_TITLE_OFFSET, Y_AXIS_GRID_COUNT } from '../constants/chartConstants';

interface ScoreHistoryChartProps {
  kingdomNumber: number;
  height?: number;
  isExpanded?: boolean;
  onToggle?: (expanded: boolean) => void;
}

interface ChartDataPoint {
  kvk: number;
  score: number;
  tier: string;
  rank: number | null;
  percentile: number | null;
}

const ScoreHistoryChart: React.FC<ScoreHistoryChartProps> = ({ 
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
  const [pinnedPoint, setPinnedPoint] = useState<number | null>(null); // For mobile tap-to-pin
  
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
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

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
    return history.map((record) => ({
      kvk: record.kvk_number,
      score: record.score,
      tier: record.tier,
      rank: record.rank_at_time,
      percentile: record.percentile_rank
    }));
  }, [history]);

  if (loading) {
    return (
      <div style={{ backgroundColor: '#1a1a20', borderRadius: '12px', padding: '1rem', marginBottom: isMobile ? '1.25rem' : '1.5rem' }}>
        <h4 style={{ margin: '0 0 0.75rem 0', color: '#fff', fontSize: '0.9rem', fontWeight: '600', textAlign: 'center' }}>
          Atlas Score History
        </h4>
        <div style={{
          height: height - 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#6b7280',
          fontSize: '0.85rem'
        }}>
          Loading score history...
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div style={{
        backgroundColor: '#131318',
        borderRadius: '12px',
        padding: isMobile ? '1rem' : '1.25rem',
        border: '1px solid #2a2a2a',
        marginBottom: isMobile ? '1.25rem' : '1.5rem'
      }}>
        <h4 style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '600', margin: '0 0 0.75rem 0', textAlign: 'center' }}>
          Atlas Score History
        </h4>
        <div style={{ color: '#6b7280', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
          Play your first KvK to unlock score history!
        </div>
      </div>
    );
  }

  if (chartData.length < 2) {
    return (
      <div style={{
        backgroundColor: '#131318',
        borderRadius: '12px',
        padding: isMobile ? '1rem' : '1.25rem',
        border: '1px solid #2a2a2a',
        marginBottom: isMobile ? '1.25rem' : '1.5rem'
      }}>
        <h4 style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '600', margin: '0 0 0.75rem 0', textAlign: 'center' }}>
          Atlas Score History
        </h4>
        <div style={{ color: '#6b7280', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
          Need at least 2 KvKs for trend data
        </div>
      </div>
    );
  }

  const width = CHART_WIDTH;
  const padding = CHART_PADDING;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Fixed Y-axis range: 0 to 100 (max possible Atlas Score)
  const minScore = 0;
  const maxScore = 100;
  const scoreRange = maxScore - minScore;

  const xScale = (index: number) => 
    padding.left + (chartData.length > 1 ? (index / (chartData.length - 1)) * chartWidth : chartWidth / 2);
  
  const yScale = (score: number) => 
    padding.top + ((maxScore - score) / scoreRange) * chartHeight;

  // Generate path for line
  const generatePath = () => {
    return chartData.map((d, i) => {
      const x = xScale(i);
      const y = yScale(d.score);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

  // Generate area path for gradient fill
  const generateAreaPath = () => {
    const linePath = chartData.map((d, i) => {
      const x = xScale(i);
      const y = yScale(d.score);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
    
    const lastX = xScale(chartData.length - 1);
    const firstX = xScale(0);
    const bottom = padding.top + chartHeight;
    
    return `${linePath} L ${lastX} ${bottom} L ${firstX} ${bottom} Z`;
  };

  // Calculate change from previous KvK to last KvK (not overall change)
  const prevScore = chartData.length >= 2 ? chartData[chartData.length - 2]?.score ?? 0 : 0;
  const lastScore = chartData[chartData.length - 1]?.score ?? 0;
  const lastKvkChange = lastScore - prevScore;
  const prevKvk = chartData.length >= 2 ? chartData[chartData.length - 2]?.kvk : null;
  const lastKvk = chartData[chartData.length - 1]?.kvk;
  const trendColor = lastKvkChange > 0 ? '#22c55e' : lastKvkChange < 0 ? '#ef4444' : '#6b7280';

  // Get active point (pinned on mobile, hovered on desktop)
  const activePoint = isMobile ? pinnedPoint : hoveredPoint;
  const activeData = activePoint !== null ? chartData[activePoint] : null;

  // Handle mobile tap on data point
  const handlePointTap = (index: number) => {
    if (pinnedPoint === index) {
      // Tapping same point dismisses tooltip
      setPinnedPoint(null);
      setTooltipPos(null);
    } else {
      // Pin new point
      setPinnedPoint(index);
      setTooltipPos(getTooltipPosition(index));
    }
  };

  // Handle tap outside chart area to dismiss tooltip on mobile
  const handleChartAreaClick = (e: React.MouseEvent) => {
    // Only dismiss if clicking on the chart area itself, not on a data point
    if ((e.target as SVGElement).tagName === 'svg') {
      setPinnedPoint(null);
      setTooltipPos(null);
    }
  };

  // Calculate tooltip position in screen coordinates
  const getTooltipPosition = (index: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const svgRect = svgRef.current.getBoundingClientRect();
    
    // SVG viewBox coordinates
    const svgX = padding.left + (chartData.length > 1 ? (index / (chartData.length - 1)) * chartWidth : chartWidth / 2);
    const score = chartData[index]?.score ?? 0;
    const svgY = padding.top + ((maxScore - score) / scoreRange) * chartHeight;
    
    // Convert SVG coordinates to actual rendered pixel coordinates relative to SVG element
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
          Atlas Score History
        </h4>
        {!isExpanded && (
          <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>
            &quot;How has my score evolved?&quot;
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
              {Math.abs(lastKvkChange).toFixed(2)}
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
            <linearGradient id={`scoreGradient-${kingdomNumber}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grid lines - 5 evenly spaced */}
          {Array.from({ length: Y_AXIS_GRID_COUNT }, (_, i) => i / (Y_AXIS_GRID_COUNT - 1)).map((pct, i) => {
            const y = padding.top + chartHeight * pct;
            const score = maxScore - scoreRange * pct;
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
                  {score.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          <path
            d={generateAreaPath()}
            fill={`url(#scoreGradient-${kingdomNumber})`}
          />

          {/* Line */}
          <path
            d={generatePath()}
            fill="none"
            stroke={CHART_COLORS.scoreHistory}
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
            const y = yScale(d.score);
            const isActive = activePoint === i;
            const sizes = isMobile ? POINT_SIZES.mobile : POINT_SIZES.desktop;
            const hitAreaRadius = sizes.hitArea;
            const pointRadius = isActive ? sizes.active : sizes.normal;

            return (
              <g key={i}>
                {/* Touch/hover area - larger on mobile for easier tapping */}
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
                
                {/* Visible point */}
                <circle
                  cx={x}
                  cy={y}
                  r={pointRadius}
                  fill={CHART_COLORS.scoreHistory}
                  stroke="#0a0a0a"
                  strokeWidth="2"
                  style={{ transition: 'r 0.15s ease', pointerEvents: 'none' }}
                />

                {/* X-axis label - just the number */}
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

          {/* HTML Tooltip - rendered outside SVG to prevent clipping */}
          {activePoint !== null && activeData && tooltipPos && (
            <div
              style={{
                position: 'absolute',
                left: tooltipPos.x,
                top: tooltipPos.y,
                transform: 'translate(-50%, calc(-100% - 12px))',
                backgroundColor: '#0a0a0a',
                border: `1px solid ${CHART_COLORS.scoreHistory}`,
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
                {activeData.score.toFixed(2)}
              </div>
              <div style={{ color: '#6b7280', fontSize: isMobile ? '11px' : '10px', textAlign: 'center' }}>
                After KvK {activeData.kvk}
                {activeData.percentile !== null && ` • Top ${(100 - activeData.percentile).toFixed(1)}%`}
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

export default ScoreHistoryChart;
