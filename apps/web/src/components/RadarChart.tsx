import React, { memo, useState, useEffect, useRef, useCallback } from 'react';
import { useIsMobile } from '../hooks/useMediaQuery';

interface RadarDataPoint {
  label: string;
  value: number; // 0-100 scale
  color?: string;
  description?: string; // For accessibility
}

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
  const size = propSize || (isMobile ? 200 : 260);
  const center = size / 2;
  const radius = (size / 2) - 30; // Leave room for labels
  const levels = 5; // Number of concentric rings
  
  // Animation state
  const [animatedValues, setAnimatedValues] = useState<number[]>(data.map(() => 0));
  const animationRef = useRef<number | null>(null);
  const prevDataRef = useRef<string>('');
  
  // Touch/hover state for mobile interactions
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  
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
  
  // Label positions (slightly outside the chart)
  const labelPositions = data.map((d, i) => {
    const angle = (i * angleStep) - (Math.PI / 2);
    const labelRadius = radius + 18;
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
                <g>
                  <rect
                    x={point.x - 35}
                    y={point.y - 35}
                    width={70}
                    height={24}
                    rx={4}
                    fill="#0a0a0a"
                    stroke={accentColor}
                    strokeWidth={1}
                  />
                  <text
                    x={point.x}
                    y={point.y - 20}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="11"
                    fontWeight="600"
                  >
                    {data[i]?.label}: {Math.round(data[i]?.value || 0)}%
                  </text>
                </g>
              )}
            </g>
          );
        })}
        
        {/* Labels */}
        {labelPositions.map((pos, i) => (
          <g key={`label-${i}`}>
            <text
              x={pos.x}
              y={pos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#9ca3af"
              fontSize={isMobile ? "9" : "10"}
              fontWeight="500"
            >
              {pos.label}
            </text>
            <text
              x={pos.x}
              y={pos.y + (isMobile ? 11 : 12)}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={accentColor}
              fontSize={isMobile ? "10" : "11"}
              fontWeight="bold"
            >
              {Math.round(pos.value)}%
            </text>
          </g>
        ))}
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
