import React, { useState, memo } from 'react';
import { useIsMobile } from '../../hooks/useMediaQuery';

interface QuickStatsProps {
  totalKvks: number;
  dominations: number;
  invasions: number;
}

const QuickStats: React.FC<QuickStatsProps> = ({ totalKvks, dominations, invasions }) => {
  const [showHKTooltip, setShowHKTooltip] = useState(false);
  const [showIKTooltip, setShowIKTooltip] = useState(false);
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
      <div 
        style={{ 
          flex: 1,
          backgroundColor: '#22c55e12',
          borderRadius: '8px',
          padding: isMobile ? '0.5rem 0.4rem' : '0.6rem 0.5rem',
          textAlign: 'center',
          position: 'relative',
          cursor: 'default'
        }}
        onMouseEnter={() => !isMobile && setShowHKTooltip(true)}
        onMouseLeave={() => !isMobile && setShowHKTooltip(false)}
        onClick={() => isMobile && setShowHKTooltip(!showHKTooltip)}
      >
        <div style={{ fontSize: isMobile ? '0.95rem' : '1.1rem', fontWeight: '700', color: '#22c55e' }}>
          {dominations} 👑
        </div>
        <div style={{ fontSize: isMobile ? '0.6rem' : '0.65rem', color: '#22c55e80', marginTop: '2px' }}>
          Dominations
        </div>
        {showHKTooltip && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: '8px',
            backgroundColor: '#0a0a0a',
            border: '1px solid #22c55e',
            borderRadius: '8px',
            padding: '0.6rem 0.8rem',
            fontSize: '0.75rem',
            whiteSpace: 'nowrap',
            zIndex: 100,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
          }}>
            <div style={{ color: '#22c55e', fontWeight: 'bold', marginBottom: '3px' }}>👑 Dominations</div>
            <div style={{ color: '#9ca3af', fontSize: '0.7rem' }}>Won both Prep and Battle</div>
          </div>
        )}
      </div>
      
      {/* Invasions */}
      <div 
        style={{ 
          flex: 1,
          backgroundColor: '#ef444412',
          borderRadius: '8px',
          padding: isMobile ? '0.5rem 0.4rem' : '0.6rem 0.5rem',
          textAlign: 'center',
          position: 'relative',
          cursor: 'default'
        }}
        onMouseEnter={() => !isMobile && setShowIKTooltip(true)}
        onMouseLeave={() => !isMobile && setShowIKTooltip(false)}
        onClick={() => isMobile && setShowIKTooltip(!showIKTooltip)}
      >
        <div style={{ fontSize: isMobile ? '0.95rem' : '1.1rem', fontWeight: '700', color: '#ef4444' }}>
          {invasions} 💀
        </div>
        <div style={{ fontSize: isMobile ? '0.6rem' : '0.65rem', color: '#ef444480', marginTop: '2px' }}>
          Invasions
        </div>
        {showIKTooltip && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: '8px',
            backgroundColor: '#0a0a0a',
            border: '1px solid #ef4444',
            borderRadius: '8px',
            padding: '0.6rem 0.8rem',
            fontSize: '0.75rem',
            whiteSpace: 'nowrap',
            zIndex: 100,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
          }}>
            <div style={{ color: '#ef4444', fontWeight: 'bold', marginBottom: '3px' }}>💀 Invasions</div>
            <div style={{ color: '#9ca3af', fontSize: '0.7rem' }}>Lost both Prep and Battle</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(QuickStats);
