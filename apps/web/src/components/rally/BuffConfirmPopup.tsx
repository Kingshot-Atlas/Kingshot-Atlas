import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface BuffConfirmPopupProps {
  onCancel: () => void;
  onConfirm: () => void;
}

const BuffConfirmPopup: React.FC<BuffConfirmPopupProps> = ({ onCancel, onConfirm }) => {
  const { t } = useTranslation();
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Auto-focus cancel button and handle Escape
  useEffect(() => {
    cancelRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }}
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="buff-confirm-title"
        aria-describedby="buff-confirm-desc"
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#111', border: '1px solid #2a2a2a',
          borderRadius: '12px', padding: '1.25rem', maxWidth: '300px',
          textAlign: 'center', width: '100%',
        }}
      >
        <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }} aria-hidden="true">⚠️</div>
        <p id="buff-confirm-title" style={{ color: '#fff', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem' }}>
          {t('rallyCoordinator.turnOffBuff', 'Turn off buff?')}
        </p>
        <p id="buff-confirm-desc" style={{ color: '#9ca3af', fontSize: '0.7rem', marginBottom: '1rem' }}>
          {t('rallyCoordinator.buffResetWarning', 'The 2-hour buff timer will be reset.')}
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="rally-focusable"
            style={{
              padding: '0.4rem 1rem', minHeight: '36px',
              backgroundColor: 'transparent',
              border: '1px solid #2a2a2a', borderRadius: '8px',
              color: '#d1d5db', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer',
            }}
          >
            {t('rallyCoordinator.cancel', 'Cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="rally-focusable"
            style={{
              padding: '0.4rem 1rem', minHeight: '36px',
              backgroundColor: '#ef444420',
              border: '1px solid #ef444450', borderRadius: '8px',
              color: '#ef4444', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer',
            }}
          >
            {t('rallyCoordinator.turnOff', 'Turn Off')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BuffConfirmPopup;
