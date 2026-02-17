import React, { useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { colors } from '../../utils/styles';
import { PendingConfirm } from './types';

interface ConfirmDialogProps {
  confirm: PendingConfirm;
  onDismiss: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ confirm, onDismiss }) => {
  const { t } = useTranslation();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onDismiss();
  }, [onDismiss]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div role="dialog" aria-modal="true" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 1000, padding: '1rem',
    }} onClick={onDismiss}>
      <div onClick={e => e.stopPropagation()} style={{
        backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
        borderRadius: '12px', padding: '1.25rem', width: '100%', maxWidth: '380px',
      }}>
        <p style={{ color: colors.text, fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1rem' }}>
          {confirm.message}
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button onClick={onDismiss} style={{
            padding: '0.5rem 1rem', backgroundColor: colors.border, border: 'none',
            borderRadius: '6px', color: colors.textSecondary, fontSize: '0.8rem', cursor: 'pointer',
          }}>{t('prepScheduler.cancel', 'Cancel')}</button>
          <button onClick={() => { confirm.onConfirm(); onDismiss(); }} style={{
            padding: '0.5rem 1rem', backgroundColor: '#a855f720', border: '1px solid #a855f750',
            borderRadius: '6px', color: '#a855f7', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
          }}>{t('prepScheduler.confirm', 'Confirm')}</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
