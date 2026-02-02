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
  'Win Rate': 'Combined Prep (30%) and Battle (70%) win rate. Higher is better.',
  'Domination': 'Percentage of KvKs where both Prep and Battle were won.',
  'Form': 'Recent performance trend based on last 3 KvKs.',
  'Streaks': 'Strength of current and historical winning streaks.',
  'Experience': 'Number of KvKs participated (5+ for full score).',
  'Resilience': 'Ability to avoid double-losses (invasions).',
  'Prep Win': 'Preparation Phase win rate percentage.',
  'Battle Win': 'Battle Phase win rate percentage.',
  'Recent': 'Performance in your most recent KvKs.'
};

interface RadarChartProps {
  data: RadarDataPoint[];
  size?: number;
  accentColor?: string;
  animated?: boolean;
  ariaLabel?: string;
}

const RadarChart: React.FC<RadarChartProps> = ({ 
  data, 
  size: propSize,
  accentColor = '#22d3ee',
  animated = true,
  ariaLabel = 'Performance radar chart'
}) => {
  const isMobile = useIsMobile();
  const size = propSize || (isMobile ? 240 : 300);
  const center = size / 2;
  const radius = (size / 2) - 55; // Leave more room for labels to prevent cutoff
  const levels = 5; // Number of concentric rings
  
  // Animation state - initialize with actual data values to prevent empty chart
  const [animatedValues, setAnimatedValues] = useState<number[]>(data.map(d => d.value));
  const animationRef = useRef<number | null>(null);
  const prevDataRef = useRef<string>(data.map(d => d.value).join(','));
  
  // Touch/hover state for mobile interactions
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
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
    const dataKey = data.map(d => d.value).join(',');
    if (dataKey === prevDataRef.current) return;
    prevDataRef.current = dataKey;
    
    if (!shouldAnimate) {
      setAnimatedValues(data.map(d => d.value));
      return;
    }
    
    const targetValues = data.map(d => d.value);
    const startValues = animatedValues.length === data.length ? [...animatedValues] : data.map(() => 0);
    const startTime = performance.now();
    const duration = 600; // ms
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out cubic)
      const eased = 1 - Math.pow(1 - progress, 3);
      
      const newValues = startValues.map((start, i) => {
        const target = targetValues[i] ?? 0;
        return start + (target - start) * eased;
      });
      
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, shouldAnimate]);
  
  // Handle touch/click on data points (mobile-friendly)
  const handlePointInteraction = useCallback((index: number) => {
    setActiveIndex(prev => prev === index ? null : index);
  }, []);
  
  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        handlePointInteraction(index);
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((index + 1) % data.length);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((index - 1 + data.length) % data.length);
        break;
      case 'Escape':
        setActiveIndex(null);
        break;
    }
  }, [data.length, handlePointInteraction]);
  
  const angleStep = (2 * Math.PI) / data.length;
  
  // Calculate point positions using animated values
  const getPoint = (index: number, value: number) => {
    const angle = (index * angleStep) - (Math.PI / 2); // Start from top
    const r = (value / 100) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle)
    };
  };
  
  // Generate polygon points for the animated data
  const dataPoints = animatedValues.map((value, i) => getPoint(i, value));
  const polygonPoints = dataPoints.map(p => `${p.x},${p.y}`).join(' ');
  
  // Generate grid lines
  const gridLines = [];
  for (let level = 1; level <= levels; level++) {
    const levelRadius = (level / levels) * radius;
    const points = data.map((_, i) => {
      const angle = (i * angleStep) - (Math.PI / 2);
      return {
        x: center + levelRadius * Math.cos(angle),
        y: center + levelRadius * Math.sin(angle)
      };
    });
    gridLines.push(points.map(p => `${p.x},${p.y}`).join(' '));
  }
  
  // Generate axis lines
  const axisLines = data.map((_, i) => {
    const angle = (i * angleStep) - (Math.PI / 2);
    return {
      x2: center + radius * Math.cos(angle),
      y2: center + radius * Math.sin(angle)
    };
  });
  
  // Label positions (further outside the chart to prevent cutoff)
  const labelPositions = data.map((d, i) => {
    const angle = (i * angleStep) - (Math.PI / 2);
    const labelRadius = radius + (isMobile ? 35 : 42);
    return {
      x: center + labelRadius * Math.cos(angle),
      y: center + labelRadius * Math.sin(angle),
      label: d.label,
      value: d.value
    };
  });

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
        {ariaLabel}. {data.map(d => `${d.label}: ${Math.round(d.value)}%`).join(', ')}
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
        
        {/* Data polygon - filled area */}
        <polygon
          points={polygonPoints}
          fill={`${accentColor}20`}
          stroke={accentColor}
          strokeWidth="2"
          style={{
            filter: `drop-shadow(0 0 8px ${accentColor}40)`
          }}
        />
        
        {/* Data points - interactive for touch/keyboard */}
        {dataPoints.map((point, i) => {
          const isActive = activeIndex === i;
          const isFocused = focusedIndex === i;
          return (
            <g key={`point-${i}`}>
              {/* Larger touch target for mobile */}
              <circle
                cx={point.x}
                cy={point.y}
                r={isMobile ? 20 : 12}
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onClick={() => handlePointInteraction(i)}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  handlePointInteraction(i);
                }}
                tabIndex={0}
                role="button"
                aria-label={`${data[i]?.label}: ${Math.round(data[i]?.value || 0)}%`}
                onKeyDown={(e) => handleKeyDown(e, i)}
                onFocus={() => setFocusedIndex(i)}
                onBlur={() => setFocusedIndex(null)}
              />
              {/* Visible point */}
              <circle
                cx={point.x}
                cy={point.y}
                r={isActive || isFocused ? 6 : 4}
                fill={accentColor}
                stroke={isFocused ? '#fff' : '#0a0a0a'}
                strokeWidth={isFocused ? 3 : 2}
                style={{ 
                  transition: 'r 0.15s ease, stroke-width 0.15s ease',
                  pointerEvents: 'none'
                }}
              />
              {/* Tooltip on active/focused */}
              {(isActive || isFocused) && (
                <foreignObject
                  x={point.x - 90}
                  y={point.y - 75}
                  width={180}
                  height={70}
                  style={{ overflow: 'visible' }}
                >
                  <div style={{
                    backgroundColor: '#0a0a0a',
                    border: `1px solid ${accentColor}`,
                    borderRadius: '6px',
                    padding: '0.5rem 0.6rem',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                    textAlign: 'center'
                  }}>
                    <div style={{ 
                      color: accentColor, 
                      fontWeight: 600, 
                      fontSize: '0.75rem',
                      marginBottom: '0.2rem'
                    }}>
                      {data[i]?.label}: {Math.round(data[i]?.value || 0)}%
                    </div>
                    {RADAR_TOOLTIPS[data[i]?.label || ''] && (
                      <div style={{ 
                        color: '#9ca3af', 
                        fontSize: '0.6rem',
                        lineHeight: 1.3
                      }}>
                        {RADAR_TOOLTIPS[data[i]?.label || '']}
                      </div>
                    )}
                  </div>
                </foreignObject>
              )}
            </g>
          );
        })}
        
        {/* Labels with tooltips */}
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
                y={pos.y - (isMobile ? 6 : 7)}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={hoveredLabel === i ? accentColor : '#9ca3af'}
                fontSize={isMobile ? "9" : "10"}
                fontWeight="500"
                style={{ transition: 'fill 0.2s ease' }}
              >
                {pos.label}
              </text>
              <text
                x={pos.x}
                y={pos.y + (isMobile ? 6 : 7)}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={accentColor}
                fontSize={isMobile ? "10" : "11"}
                fontWeight="bold"
              >
                {Math.round(pos.value)}%
              </text>
            </g>
          );
        })}
        
        {/* Tooltip layer - rendered last to be on top */}
        {hoveredLabel !== null && labelPositions[hoveredLabel] && RADAR_TOOLTIPS[labelPositions[hoveredLabel]?.label ?? ''] && (
          <foreignObject
            x={Math.max(10, Math.min(size - 190, (labelPositions[hoveredLabel]?.x ?? 0) - 90))}
            y={(labelPositions[hoveredLabel]?.y ?? 0) + 18}
            width={180}
            height={50}
            style={{ overflow: 'visible', pointerEvents: 'none' }}
          >
            <div style={{
              backgroundColor: '#0a0a0a',
              border: `1px solid ${accentColor}`,
              borderRadius: '6px',
              padding: '0.4rem 0.5rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              textAlign: 'center',
              fontSize: '0.6rem',
              color: '#d1d5db',
              lineHeight: 1.3
            }}>
              {RADAR_TOOLTIPS[labelPositions[hoveredLabel]?.label ?? '']}
            </div>
          </foreignObject>
        )}
      </svg>
      
      {/* Accessible data table (hidden visually, available to screen readers) */}
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th>Metric</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={i}>
              <td>{d.label}</td>
              <td>{Math.round(d.value)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      
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

export default memo(RadarChart);
