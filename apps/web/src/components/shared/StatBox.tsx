import React, { memo } from 'react';
import SmartTooltip from './SmartTooltip';
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
  const isMobile = useIsMobile();

  const box = (
    <div 
      style={{ 
        width: '100%',
        backgroundColor: bgColor,
        borderRadius: '8px',
        padding: isMobile ? '0.5rem 0.4rem' : '0.6rem 0.5rem',
        textAlign: 'center',
        cursor: tooltip ? 'default' : 'auto'
      }}
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
    </div>
  );

  if (tooltip) {
    return (
      <SmartTooltip
        accentColor={color}
        style={{ flex: 1 }}
        content={
          <div style={{ fontSize: '0.7rem' }}>
            <div style={{ color, fontWeight: 'bold', marginBottom: '2px' }}>{tooltip.title}</div>
            <div style={{ color: '#9ca3af' }}>{tooltip.description}</div>
          </div>
        }
      >
        {box}
      </SmartTooltip>
    );
  }

  return <div style={{ flex: 1 }}>{box}</div>;
};

export default memo(StatBox);
