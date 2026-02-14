import React from 'react';

interface BuffConfirmPopupProps {
  onCancel: () => void;
  onConfirm: () => void;
}

const BuffConfirmPopup: React.FC<BuffConfirmPopupProps> = ({ onCancel, onConfirm }) => {
  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }}
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#111', border: '1px solid #2a2a2a',
          borderRadius: '12px', padding: '1.25rem', maxWidth: '300px',
          textAlign: 'center', width: '100%',
        }}
      >
        <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⚠️</div>
        <p style={{ color: '#fff', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem' }}>
          Turn off buff?
        </p>
        <p style={{ color: '#6b7280', fontSize: '0.7rem', marginBottom: '1rem' }}>
          The 2-hour buff timer will be reset.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '0.4rem 1rem', backgroundColor: 'transparent',
              border: '1px solid #2a2a2a', borderRadius: '8px',
              color: '#9ca3af', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '0.4rem 1rem', backgroundColor: '#ef444420',
              border: '1px solid #ef444450', borderRadius: '8px',
              color: '#ef4444', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer',
            }}
          >
            Turn Off
          </button>
        </div>
      </div>
    </div>
  );
};

export default BuffConfirmPopup;
