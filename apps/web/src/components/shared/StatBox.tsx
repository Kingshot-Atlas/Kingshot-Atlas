import React, { useState, memo } from 'react';
import { useIsMobile } from '../../hooks/useMediaQuery';

interface StatBoxProps {
  value: number | string;
  label: string;
  icon?: string;
  color?: string;
  bgColor?: string;
  tooltip?: {
    title: string;
    description: string;
  };
}

const StatBox: React.FC<StatBoxProps> = ({
  value,
  label,
  icon,
  color = '#fff',
  bgColor = '#1a1a20',
  tooltip
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const isMobile = useIsMobile();

  return (
    <div 
      style={{ 
        flex: 1,
        backgroundColor: bgColor,
        borderRadius: '8px',
        padding: isMobile ? '0.5rem 0.4rem' : '0.6rem 0.5rem',
        textAlign: 'center',
        position: 'relative',
        cursor: tooltip ? 'default' : 'auto'
      }}
      onMouseEnter={() => tooltip && !isMobile && setShowTooltip(true)}
      onMouseLeave={() => tooltip && !isMobile && setShowTooltip(false)}
      onClick={() => tooltip && isMobile && setShowTooltip(!showTooltip)}
    >
      <div style={{ 
        fontSize: isMobile ? '0.95rem' : '1.1rem', 
        fontWeight: '700', 
        color 
      }}>
        {value} {icon}
      </div>
      <div style={{ 
        fontSize: isMobile ? '0.6rem' : '0.65rem', 
        color: `${color}80`, 
        marginTop: '2px' 
      }}>
        {label}
      </div>
      {showTooltip && tooltip && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: '8px',
          backgroundColor: '#0a0a0a',
          border: `1px solid ${color}`,
          borderRadius: '8px',
          padding: '0.6rem 0.8rem',
          fontSize: '0.75rem',
          whiteSpace: 'nowrap',
          zIndex: 100,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
        }}>
          <div style={{ color, fontWeight: 'bold', marginBottom: '3px' }}>{tooltip.title}</div>
          <div style={{ color: '#9ca3af', fontSize: '0.7rem' }}>{tooltip.description}</div>
        </div>
      )}
    </div>
  );
};

export default memo(StatBox);
