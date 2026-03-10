import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useToast } from '../Toast';
import { Button } from '../shared';
import { inputBase, modalBackdrop, modalContent } from './allianceCenterConstants';
import type { useAllianceCenter } from '../../hooks/useAllianceCenter';

// ─── Import by Player IDs Modal ───
const ImportMembersModal: React.FC<{
  onImport: ReturnType<typeof useAllianceCenter>['importByPlayerIds'];
  onClose: () => void;
  memberCount: number;
  maxMembers: number;
}> = ({ onImport, onClose, memberCount, maxMembers }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const isMob = useIsMobile();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [rawIds, setRawIds] = useState('');
  const [importing, setImporting] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && !importing) { onClose(); return; }
    if (e.key === 'Tab' && dialogRef.current) {
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>('button, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }, [onClose, importing]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const parsedIds = rawIds.split(/[\n,;\s]+/).map(s => s.trim()).filter(Boolean);
  const remaining = maxMembers - memberCount;

  const handleImport = async () => {
    if (parsedIds.length === 0) return;
    setImporting(true);
    setProgress({ done: 0, total: parsedIds.length });
    const result = await onImport(parsedIds, (done, total) => setProgress({ done, total }));
    setImporting(false);
    setProgress(null);
    if (result.success > 0) {
      showToast(t('allianceCenter.importSuccess', '{{count}} members imported', { count: result.success }), 'success');
    }
    if (result.errors.length > 0) { showToast(result.errors[0] ?? 'Import error', 'error'); }
    if (result.failed === 0 && result.errors.length === 0) { onClose(); }
  };

  return (
    <div style={modalBackdrop(isMob)} onClick={onClose} role="dialog" aria-modal="true" aria-label={t('allianceCenter.importTitle', 'Import Members by Player ID')}>
      <div ref={dialogRef} onClick={e => e.stopPropagation()} style={modalContent(isMob, { maxWidth: '440px' })}>
        <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: '700', marginBottom: '0.5rem' }}>
          {t('allianceCenter.importTitle', 'Import Members by Player ID')}
        </h3>
        <p style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: '1rem', lineHeight: 1.4 }}>
          {t('allianceCenter.importDesc', 'Paste player IDs separated by commas, spaces, or new lines. Atlas users will have their names auto-resolved.')}
        </p>
        <textarea value={rawIds} onChange={e => setRawIds(e.target.value)}
          placeholder={'e.g.\n12345678\n87654321\n11223344'}
          rows={5} style={{ ...inputBase, resize: 'vertical', minHeight: '100px', fontFamily: 'monospace', fontSize: '0.8rem' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', marginBottom: '0.75rem' }}>
          <span style={{ color: '#6b7280', fontSize: '0.7rem' }}>{parsedIds.length} IDs detected</span>
          <span style={{ color: parsedIds.length > remaining ? '#ef4444' : '#6b7280', fontSize: '0.7rem' }}>{remaining} slots available</span>
        </div>
        {progress && (
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <span style={{ color: '#9ca3af', fontSize: '0.7rem' }}>{t('allianceCenter.importResolving', 'Resolving player names...')}</span>
              <span style={{ color: '#e5e7eb', fontSize: '0.7rem', fontWeight: 600 }}>{progress.done}/{progress.total}</span>
            </div>
            <div style={{ width: '100%', height: '6px', backgroundColor: '#1a1a24', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(progress.done / Math.max(progress.total, 1)) * 100}%`, backgroundColor: '#3b82f6', borderRadius: '3px', transition: 'width 0.2s ease' }} />
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button variant="ghost" onClick={onClose} style={{ flex: 1 }}>{t('common.cancel', 'Cancel')}</Button>
          <Button variant="primary" onClick={handleImport} disabled={importing || parsedIds.length === 0} loading={importing} style={{ flex: 1 }}>
            {t('allianceCenter.importBtn', 'Import')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ImportMembersModal;
