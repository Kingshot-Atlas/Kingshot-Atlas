import React, { memo, useState, useEffect, useRef, useCallback } from 'react';
import { useIsMobile } from '../hooks/useMediaQuery';

interface RadarDataPoint {
  label: string;
  value: number; // 0-100 scale
  color?: string;
  description?: string; // For accessibility
}

// Tooltip descriptions for radar chart metrics
const RADAR_TOOLTIPS: Record<string, string> = {
  'Win Rate': 'Combined Prep (30%) and Battle (70%) win rate.',
  'Domination': 'Percentage of KvKs where both phases were won.',
  'Form': 'Recent performance trend based on last 3 KvKs.',
  'Streaks': 'Strength of winning streaks (current + best).',
  'Experience': 'KvK participation (7+ for full credit).',
  'Resilience': 'Ability to avoid double-losses.',
  'Prep Win': 'Preparation Phase win rate.',
  'Battle Win': 'Battle Phase win rate.',
  'Recent': 'Performance in most recent KvKs.'
};

interface ComparisonRadarChartProps {
  datasets: {
    label: string;
    data: RadarDataPoint[];
    color: string;
  }[];
  size?: number;
  animated?: boolean;
  ariaLabel?: string;
}

const ComparisonRadarChart: React.FC<ComparisonRadarChartProps> = ({ 
  datasets, 
  size: propSize,
  animated = true,
  ariaLabel = 'Comparison radar chart'
}) => {
  const isMobile = useIsMobile();
  const size = propSize || (isMobile ? 240 : 300);
  const center = size / 2;
  const radius = (size / 2) - 40; // Leave more room for labels and legend
  const levels = 5; // Number of concentric rings
  
  // Animation state - initialize with actual data values to prevent empty chart
  const [animatedValues, setAnimatedValues] = useState<number[][]>(
    datasets.map(d => d.data.map(v => v.value))
  );
  const animationRef = useRef<number | null>(null);
  const prevDataRef = useRef<string>(datasets.map(d => d.data.map(v => v.value).join(',')).join('|'));
  
  // Touch/hover state for mobile interactions
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [hoveredDataset, setHoveredDataset] = useState<number | null>(null);
  const [hoveredLabel, setHoveredLabel] = useState<number | null>(null);
  
  // Check for reduced motion preference
  const prefersReducedMotion = useRef(
    typeof window !== 'undefined' && 
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
  
  // Determine if animation should run
  const shouldAnimate = animated && !prefersReducedMotion.current;
  
  // Animate values when data changes
  useEffect(() => {
    if (!datasets[0]?.data) return;
    const dataKey = datasets.map(d => d.data.map(v => v.value).join(',')).join('|');
    if (dataKey === prevDataRef.current) return;
    prevDataRef.current = dataKey;
    
    if (!shouldAnimate) {
      setAnimatedValues(datasets.map(d => d.data.map(v => v.value)));
      return;
    }
    
    const targetValues = datasets.map(d => d.data.map(v => v.value));
    const firstTargetLength = targetValues[0]?.length || 0;
    const startValues = animatedValues.length === datasets.length ? 
      animatedValues.map(arr => arr.length === firstTargetLength ? [...arr] : targetValues[0]?.map(() => 0) || []) :
      targetValues.map(() => targetValues[0]?.map(() => 0) || []);
    const startTime = performance.now();
    const duration = 800; // ms
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out cubic)
      const eased = 1 - Math.pow(1 - progress, 3);
      
      const newValues = startValues.map((startArr, datasetIndex) => 
        startArr.map((start, i) => {
          const target = targetValues[datasetIndex]?.[i] ?? 0;
          return start + (target - start) * eased;
        })
      );
      
      setAnimatedValues(newValues);
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [datasets, shouldAnimate]);
  
  // Handle touch/click on data points (mobile-friendly)
  const handlePointInteraction = useCallback((index: number) => {
    setActiveIndex(prev => prev === index ? null : index);
  }, []);
  
  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    const dataLength = datasets[0]?.data.length || 0;
    if (dataLength === 0) return;
    
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        handlePointInteraction(index);
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((index + 1) % dataLength);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((index - 1 + dataLength) % dataLength);
        break;
      case 'Escape':
        setActiveIndex(null);
        break;
    }
  }, [datasets, handlePointInteraction]);
  
  const angleStep = datasets[0]?.data ? (2 * Math.PI) / datasets[0].data.length : 0;
  
  // Calculate point positions using animated values
  const getPoint = (index: number, value: number) => {
    const angle = (index * angleStep) - (Math.PI / 2); // Start from top
    const r = (value / 100) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle)
    };
  };
  
  // Generate polygon points for each dataset
  const datasetPolygons = animatedValues.map((values) => {
    const dataPoints = values.map((value, i) => getPoint(i, value));
    return {
      points: dataPoints.map(p => `${p.x},${p.y}`).join(' '),
      dataPoints
    };
  });
  
  // Generate grid lines
  const gridLines = [];
  if (datasets[0]?.data) {
    for (let level = 1; level <= levels; level++) {
      const levelRadius = (level / levels) * radius;
      const points = datasets[0].data.map((_, i) => {
        const angle = (i * angleStep) - (Math.PI / 2);
        return {
          x: center + levelRadius * Math.cos(angle),
          y: center + levelRadius * Math.sin(angle)
        };
      });
      gridLines.push(points.map(p => `${p.x},${p.y}`).join(' '));
    }
  }
  
  // Generate axis lines
  const axisLines = datasets[0]?.data ? datasets[0].data.map((_, i) => {
    const angle = (i * angleStep) - (Math.PI / 2);
    return {
      x2: center + radius * Math.cos(angle),
      y2: center + radius * Math.sin(angle)
    };
  }) : [];
  
  // Label positions (slightly outside the chart)
  const labelPositions = datasets[0]?.data ? datasets[0].data.map((d, i) => {
    const angle = (i * angleStep) - (Math.PI / 2);
    const labelRadius = radius + (isMobile ? 25 : 30);
    return {
      x: center + labelRadius * Math.cos(angle),
      y: center + labelRadius * Math.sin(angle),
      label: d.label
    };
  }) : [];

  return (
    <div 
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        padding: '0.5rem'
      }}
      role="figure"
      aria-label={ariaLabel}
    >
      {/* Screen reader summary */}
      <div className="sr-only" aria-live="polite">
        {ariaLabel}. {datasets.map((ds) => 
          `${ds.label}: ${ds.data.map(d => `${d.label}: ${Math.round(d.value)}%`).join(', ')}`
        ).join('. ')}
      </div>
      
      <svg 
        width={size} 
        height={size} 
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-hidden="true"
      >
        {/* Background grid */}
        {gridLines.map((points, i) => (
          <polygon
            key={`grid-${i}`}
            points={points}
            fill="none"
            stroke="#2a2a2a"
            strokeWidth="1"
            opacity={0.5 + (i * 0.1)}
          />
        ))}
        
        {/* Axis lines */}
        {axisLines.map((line, i) => (
          <line
            key={`axis-${i}`}
            x1={center}
            y1={center}
            x2={line.x2}
            y2={line.y2}
            stroke="#2a2a2a"
            strokeWidth="1"
          />
        ))}
        
        {/* Data polygons - filled areas for each dataset */}
        {datasetPolygons.map((polygon, datasetIndex) => (
          <g key={`dataset-${datasetIndex}`}>
            <polygon
              points={polygon.points}
              fill={`${datasets[datasetIndex]?.color}15`}
              stroke={datasets[datasetIndex]?.color}
              strokeWidth="2"
              style={{
                filter: `drop-shadow(0 0 6px ${datasets[datasetIndex]?.color}30)`,
                opacity: hoveredDataset === null || hoveredDataset === datasetIndex ? 1 : 0.3,
                transition: 'opacity 0.2s ease'
              }}
            />
            
            {/* Data points - interactive for touch/keyboard */}
            {polygon.dataPoints.map((point, i) => {
              const isActive = activeIndex === i;
              const isFocused = focusedIndex === i;
              const dataset = datasets[datasetIndex];
              const dataPoint = dataset?.data[i];
              
              if (!dataset || !dataPoint) return null;
              
              return (
                <g key={`point-${datasetIndex}-${i}`}>
                  {/* Larger touch target for mobile */}
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={isMobile ? 20 : 12}
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      handlePointInteraction(i);
                      // Track interaction analytics would go here
                      if (typeof window !== 'undefined' && (window as Window & { analytics?: { track: (event: string, data: object) => void } }).analytics) {
                        (window as Window & { analytics?: { track: (event: string, data: object) => void } }).analytics?.track('Chart Point Clicked', {
                          chartType: 'ComparisonRadarChart',
                          dataset: dataset.label,
                          metric: dataPoint.label,
                          value: dataPoint.value
                        });
                      }
                    }}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      handlePointInteraction(i);
                    }}
                    onMouseEnter={() => {
                      setHoveredDataset(datasetIndex);
                      // Track hover analytics would go here
                      if (typeof window !== 'undefined' && (window as Window & { analytics?: { track: (event: string, data: object) => void } }).analytics) {
                        (window as Window & { analytics?: { track: (event: string, data: object) => void } }).analytics?.track('Chart Point Hovered', {
                          chartType: 'ComparisonRadarChart',
                          dataset: dataset.label,
                          metric: dataPoint.label,
                          value: dataPoint.value
                        });
                      }
                    }}
                    onMouseLeave={() => setHoveredDataset(null)}
                    tabIndex={0}
                    role="button"
                    aria-label={`${dataset.label} ${dataPoint.label}: ${Math.round(dataPoint.value || 0)}%`}
                    onKeyDown={(e) => handleKeyDown(e, i)}
                    onFocus={() => setFocusedIndex(i)}
                    onBlur={() => setFocusedIndex(null)}
                  />
                  {/* Visible point */}
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={isActive || isFocused ? 5 : 3}
                    fill={dataset.color}
                    stroke={isFocused ? '#fff' : '#0a0a0a'}
                    strokeWidth={isFocused ? 2 : 1}
                    style={{ 
                      transition: 'r 0.15s ease, stroke-width 0.15s ease',
                      pointerEvents: 'none',
                      opacity: hoveredDataset === null || hoveredDataset === datasetIndex ? 1 : 0.3
                    }}
                  />
                </g>
              );
            })}
          </g>
        ))}
        
        {/* Labels only - no values to keep chart clean */}
        {labelPositions.map((pos, i) => {
          return (
            <g 
              key={`label-${i}`}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => !isMobile && setHoveredLabel(i)}
              onMouseLeave={() => !isMobile && setHoveredLabel(null)}
              onClick={() => isMobile && setHoveredLabel(hoveredLabel === i ? null : i)}
            >
              <text
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={hoveredLabel === i ? '#22d3ee' : '#d1d5db'}
                fontSize={isMobile ? "9" : "10"}
                fontWeight="600"
                style={{ transition: 'fill 0.2s' }}
              >
                {pos.label}
              </text>
            </g>
          );
        })}
        
        {/* Tooltip layer - centered in the chart */}
        {hoveredLabel !== null && labelPositions[hoveredLabel] && RADAR_TOOLTIPS[labelPositions[hoveredLabel].label] && (
          <foreignObject
            x={center - 90}
            y={center - 20}
            width={180}
            height={50}
            style={{ overflow: 'visible', pointerEvents: 'none' }}
          >
            <div style={{
              backgroundColor: '#0a0a0aee',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              padding: '0.4rem 0.5rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              textAlign: 'center',
              fontSize: '0.6rem',
              color: '#d1d5db',
              lineHeight: 1.3
            }}>
              <div style={{ fontWeight: '600', color: '#22d3ee', marginBottom: '2px' }}>
                {labelPositions[hoveredLabel].label}
              </div>
              {RADAR_TOOLTIPS[labelPositions[hoveredLabel].label]}
            </div>
          </foreignObject>
        )}
      </svg>
      
      {/* Legend */}
      <div style={{
        display: 'flex',
        gap: isMobile ? '1rem' : '1.5rem',
        marginTop: '0.75rem',
        flexWrap: 'wrap',
        justifyContent: 'center'
      }}>
        {datasets.map((dataset, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: isMobile ? '0.7rem' : '0.8rem',
              cursor: 'pointer',
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
              transition: 'background-color 0.2s ease',
              opacity: hoveredDataset === null || hoveredDataset === i ? 1 : 0.5
            }}
            onMouseEnter={() => setHoveredDataset(i)}
            onMouseLeave={() => setHoveredDataset(null)}
          >
            <div
              style={{
                width: isMobile ? '12px' : '14px',
                height: isMobile ? '12px' : '14px',
                backgroundColor: dataset.color,
                borderRadius: '2px',
                border: `1px solid ${dataset.color}40`
              }}
            />
            <span style={{ color: '#fff', fontWeight: '500' }}>
              {dataset.label}
            </span>
          </div>
        ))}
      </div>
      
      {/* Screen reader only styles */}
      <style>{`
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
      `}</style>
    </div>
  );
};

export default memo(ComparisonRadarChart);
