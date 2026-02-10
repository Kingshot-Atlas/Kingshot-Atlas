import React from 'react';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { FONT_DISPLAY, colors } from '../../utils/styles';
import { BoardMode } from '../KingdomListingCard';

const EntryModal: React.FC<{
  onSelect: (mode: BoardMode) => void;
  onClose: () => void;
}> = ({ onSelect, onClose }) => {
  const isMobile = useIsMobile();

  const options: Array<{
    mode: BoardMode;
    icon: string;
    title: string;
    subtitle: string;
    color: string;
  }> = [
    {
      mode: 'transferring',
      icon: '🚀',
      title: "I'm looking for a new kingdom",
      subtitle: 'Create your Transfer Profile and apply to kingdoms',
      color: '#22d3ee',
    },
    {
      mode: 'recruiting',
      icon: '📢',
      title: "I'm recruiting for my kingdom",
      subtitle: 'Manage your kingdom listing and review applications',
      color: '#a855f7',
    },
    {
      mode: 'browsing',
      icon: '👀',
      title: "Just browsing",
      subtitle: 'Explore kingdoms and see what\'s available',
      color: '#9ca3af',
    },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: isMobile ? 0 : '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: isMobile ? '16px 16px 0 0' : '16px',
          padding: isMobile ? '1.5rem 1rem' : '2rem',
          maxWidth: isMobile ? '100%' : '500px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
          paddingBottom: isMobile ? 'max(1.5rem, env(safe-area-inset-bottom))' : '2rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h2
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: isMobile ? '1.2rem' : '1.4rem',
              color: colors.text,
              margin: '0 0 0.5rem 0',
            }}
          >
            What brings you here?
          </h2>
          <p style={{ color: colors.textSecondary, fontSize: '0.85rem', margin: 0 }}>
            This helps us personalize your experience
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {options.map((opt) => (
            <button
              key={opt.mode}
              onClick={() => onSelect(opt.mode)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '1rem 1.25rem',
                backgroundColor: colors.bg,
                border: `1px solid ${opt.color}30`,
                borderRadius: '12px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s',
                minHeight: '44px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `${opt.color}60`;
                e.currentTarget.style.backgroundColor = `${opt.color}10`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = `${opt.color}30`;
                e.currentTarget.style.backgroundColor = colors.bg;
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>{opt.icon}</span>
              <div>
                <div style={{ color: colors.text, fontWeight: '600', fontSize: '0.9rem' }}>
                  {opt.title}
                </div>
                <div style={{ color: colors.textSecondary, fontSize: '0.75rem', marginTop: '0.25rem' }}>
                  {opt.subtitle}
                </div>
              </div>
            </button>
          ))}
        </div>
        <p style={{ color: '#4b5563', fontSize: '0.65rem', textAlign: 'center', marginTop: '1rem', margin: '1rem 0 0 0' }}>
          Your choice is saved on this device. You can switch modes anytime.
        </p>
      </div>
    </div>
  );
};

export default EntryModal;
