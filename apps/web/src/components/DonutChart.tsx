import React, { memo } from 'react';

interface DonutChartProps {
  value: number; // Current value
  maxValue: number; // Maximum value for percentage calculation
  size?: number;
  strokeWidth?: number;
  color: string;
  label: string;
  sublabel?: string;
  showValue?: boolean;
  isNegative?: boolean;
}

const DonutChart: React.FC<DonutChartProps> = ({
  value,
  maxValue,
  size = 80,
  strokeWidth = 8,
  color,
  label,
  sublabel,
  showValue = true,
  isNegative = false
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = maxValue > 0 ? Math.min(100, Math.max(0, (Math.abs(value) / maxValue) * 100)) : 0;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  const center = size / 2;

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center',
      gap: '0.25rem'
    }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#1a1a1a"
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={isNegative ? '#ef4444' : color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 0.5s ease',
              filter: `drop-shadow(0 0 4px ${isNegative ? '#ef4444' : color}50)`
            }}
          />
        </svg>
        
        {/* Center value */}
        {showValue && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: size > 70 ? '0.75rem' : '0.6rem',
              fontWeight: '700',
              color: isNegative ? '#ef4444' : color,
              lineHeight: 1
            }}>
              {value >= 0 ? '+' : ''}{value.toFixed(1)}
            </div>
            <div style={{
              fontSize: '0.5rem',
              color: '#4a4a4a',
              marginTop: '0.1rem'
            }}>
              pts
            </div>
          </div>
        )}
      </div>
      
      {/* Label */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ 
          fontSize: '0.65rem', 
          fontWeight: '600', 
          color: '#e5e5e5',
          lineHeight: 1.2
        }}>
          {label}
        </div>
        {sublabel && (
          <div style={{ 
            fontSize: '0.5rem', 
            color: '#4a4a4a',
            lineHeight: 1.2,
            marginTop: '0.1rem'
          }}>
            {sublabel}
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(DonutChart);
