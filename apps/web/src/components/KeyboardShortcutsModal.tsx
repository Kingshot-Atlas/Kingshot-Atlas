import React from 'react';
import { COLORS } from '../constants';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcuts = [
  { key: '/', description: 'Focus search bar' },
  { key: 'Escape', description: 'Close modal / Clear selection' },
  { key: '?', description: 'Show keyboard shortcuts' },
  { key: '←/→', description: 'Navigate cards horizontally' },
  { key: '↑/↓', description: 'Navigate cards vertically' },
  { key: 'Enter', description: 'Open selected kingdom' },
  { key: 'G then H', description: 'Go to Home' },
  { key: 'G then L', description: 'Go to Rankings' },
  { key: 'G then P', description: 'Go to Profile' },
];

const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: COLORS.BG_SECONDARY,
          borderRadius: '16px',
          border: `1px solid ${COLORS.BORDER_DEFAULT}`,
          padding: '1.5rem',
          maxWidth: '400px',
          width: '100%',
          maxHeight: '80vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ color: '#fff', fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>
            ⌨️ Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: COLORS.GRAY,
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '0.25rem',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.key}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem 0',
                borderBottom: `1px solid ${COLORS.BORDER_DEFAULT}`,
              }}
            >
              <span style={{ color: COLORS.GRAY, fontSize: '0.9rem' }}>{shortcut.description}</span>
              <kbd
                style={{
                  backgroundColor: COLORS.BG_PRIMARY,
                  border: `1px solid ${COLORS.BORDER_HOVER}`,
                  borderRadius: '4px',
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                  color: COLORS.CYAN,
                  minWidth: '2rem',
                  textAlign: 'center',
                }}
              >
                {shortcut.key}
              </kbd>
            </div>
          ))}
        </div>

        <p style={{ color: COLORS.GRAY, fontSize: '0.75rem', marginTop: '1rem', textAlign: 'center' }}>
          Press <kbd style={{ backgroundColor: COLORS.BG_PRIMARY, padding: '0.1rem 0.3rem', borderRadius: '3px', fontSize: '0.7rem' }}>?</kbd> anywhere to show this help
        </p>
      </div>
    </div>
  );
};

export default KeyboardShortcutsModal;
