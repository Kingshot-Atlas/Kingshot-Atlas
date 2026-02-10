import React from 'react';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { colors } from '../../utils/styles';
import { BoardMode } from '../KingdomListingCard';

const ModeToggle: React.FC<{
  mode: BoardMode;
  onChange: (mode: BoardMode) => void;
}> = ({ mode, onChange }) => {
  const isMobile = useIsMobile();
  const tabs: Array<{ mode: BoardMode; label: string; icon: string }> = [
    { mode: 'transferring', label: "I'm Transferring", icon: '🚀' },
    { mode: 'recruiting', label: "I'm Recruiting", icon: '📢' },
    { mode: 'browsing', label: "I'm Browsing", icon: '👀' },
  ];

  return (
    <div
      style={{
        display: 'flex',
        gap: '0.5rem',
        backgroundColor: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: '12px',
        padding: '0.25rem',
        width: 'fit-content',
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.mode}
          onClick={() => onChange(tab.mode)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: isMobile ? '0.5rem 0.75rem' : '0.5rem 1rem',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            fontSize: isMobile ? '0.75rem' : '0.8rem',
            fontWeight: mode === tab.mode ? '600' : '400',
            backgroundColor: mode === tab.mode ? `${colors.primary}15` : 'transparent',
            color: mode === tab.mode ? colors.primary : colors.textSecondary,
            transition: 'all 0.2s',
            minHeight: '44px',
          }}
        >
          <span>{tab.icon}</span>
          {!isMobile && tab.label}
          {isMobile && tab.label.split(' ').pop()}
        </button>
      ))}
    </div>
  );
};

export default ModeToggle;
