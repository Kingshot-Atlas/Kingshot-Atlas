import React, { memo } from 'react';
import { useIsMobile } from '../../hooks/useMediaQuery';
import SmartTooltip from '../shared/SmartTooltip';

interface QuickStatsProps {
  totalKvks: number;
  dominations: number;
  invasions: number;
}

const QuickStats: React.FC<QuickStatsProps> = ({ totalKvks, dominations, invasions }) => {
  const isMobile = useIsMobile();

  return (
    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
      {/* Total KvKs */}
      <div style={{ 
        flex: 1,
        backgroundColor: '#1a1a20',
        borderRadius: '8px',
        padding: '0.6rem 0.5rem',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#fff' }}>{totalKvks}</div>
        <div style={{ fontSize: '0.65rem', color: '#6b7280', marginTop: '2px' }}>KvKs</div>
      </div>
      
      {/* Dominations */}
      <SmartTooltip
        accentColor="#22c55e"
        maxWidth={190}
        style={{ flex: 1 }}
        content={
          <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
            <span style={{ color: '#22c55e', fontWeight: 'bold' }}>Dominations</span> — Won both Prep and Battle
          </div>
        }
      >
        <div 
          style={{ 
            width: '100%',
            backgroundColor: '#22c55e12',
            borderRadius: '8px',
            padding: isMobile ? '0.5rem 0.4rem' : '0.6rem 0.5rem',
            textAlign: 'center',
            cursor: 'default'
          }}
        >
          <div style={{ fontSize: isMobile ? '0.95rem' : '1.1rem', fontWeight: '700', color: '#22c55e' }}>
            {dominations} 👑
          </div>
          <div style={{ fontSize: isMobile ? '0.6rem' : '0.65rem', color: '#22c55e80', marginTop: '2px' }}>
            Dominations
          </div>
        </div>
      </SmartTooltip>
      
      {/* Invasions */}
      <SmartTooltip
        accentColor="#ef4444"
        maxWidth={190}
        style={{ flex: 1 }}
        content={
          <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
            <span style={{ color: '#ef4444', fontWeight: 'bold' }}>Invasions</span> — Lost both Prep and Battle
          </div>
        }
      >
        <div 
          style={{ 
            width: '100%',
            backgroundColor: '#ef444412',
            borderRadius: '8px',
            padding: isMobile ? '0.5rem 0.4rem' : '0.6rem 0.5rem',
            textAlign: 'center',
            cursor: 'default'
          }}
        >
          <div style={{ fontSize: isMobile ? '0.95rem' : '1.1rem', fontWeight: '700', color: '#ef4444' }}>
            {invasions} 💀
          </div>
          <div style={{ fontSize: isMobile ? '0.6rem' : '0.65rem', color: '#ef444480', marginTop: '2px' }}>
            Invasions
          </div>
        </div>
      </SmartTooltip>
    </div>
  );
};

export default memo(QuickStats);
