import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../Toast';
import { Button } from '../shared';
import { inputBase, modalBackdrop, modalContent } from './allianceCenterConstants';
import { logAllianceActivity } from './logAllianceActivity';
import type { useAllianceCenter } from '../../hooks/useAllianceCenter';
import type { MemberSearchResult } from '../../hooks/useAllianceCenter';

// ─── Transfer Ownership Modal ───
const TransferOwnershipModal: React.FC<{
  ac: ReturnType<typeof useAllianceCenter>;
  onClose: () => void;
}> = ({ ac, onClose }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { user: authUser, profile: authProfile } = useAuth();
  const isMob = useIsMobile();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trap + Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'Tab' && dialogRef.current) {
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])');
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MemberSearchResult[]>([]);
  const [confirmTarget, setConfirmTarget] = useState<MemberSearchResult | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const results = await ac.searchAtlasUsers(searchQuery);
      setSearchResults(results.filter(r => r.id !== ac.alliance?.owner_id));
      setSearching(false);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchQuery, ac]);

  const handleTransfer = async () => {
    if (!confirmTarget) return;
    setTransferring(true);
    const result = await ac.transferOwnership(confirmTarget.id);
    setTransferring(false);
    if (result.success) {
      showToast(t('allianceCenter.transferSuccess', 'Ownership transferred to {{name}}', { name: confirmTarget.username }), 'success');
      if (ac.alliance && authUser) {
        logAllianceActivity({
          allianceId: ac.alliance.id,
          actorUserId: authUser.id,
          actorName: (authProfile as { username?: string } | null)?.username || authUser.email || 'Unknown',
          action: 'ownership_transferred',
          targetName: confirmTarget.username,
        });
      }
      onClose();
    } else { showToast(result.error || t('common.failed', 'Failed'), 'error'); }
  };

  return (
    <div style={modalBackdrop(isMob)} onClick={onClose} role="dialog" aria-modal="true" aria-label={t('allianceCenter.transferTitle', 'Transfer Ownership')}>
      <div ref={dialogRef} onClick={e => e.stopPropagation()} style={modalContent(isMob, { maxWidth: '420px', borderColor: '#f59e0b30' })}>
        {!confirmTarget ? (
          <>
            <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: '700', marginBottom: '0.5rem' }}>
              {t('allianceCenter.transferTitle', 'Transfer Ownership')}
            </h3>
            <p style={{ color: '#f59e0b', fontSize: '0.75rem', marginBottom: '1rem', lineHeight: 1.4 }}>
              {t('allianceCenter.transferWarning', 'This will make another Atlas user the owner. You will lose owner privileges. This cannot be undone by you.')}
            </p>
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('allianceCenter.searchTransferTarget', 'Search for the new owner...')} style={inputBase} autoFocus />
            {searching && <div style={{ color: '#6b7280', fontSize: '0.7rem', padding: '0.4rem 0' }}>{t('common.loading', 'Loading...')}</div>}
            {searchResults.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.45rem 0.6rem', backgroundColor: '#0d1117', borderRadius: '6px', border: '1px solid #1e1e24', marginTop: '0.3rem' }}>
                <span style={{ color: '#e5e7eb', fontSize: '0.85rem' }}>{r.username}</span>
                <button onClick={() => setConfirmTarget(r)} style={{ padding: '0.2rem 0.5rem', backgroundColor: '#f59e0b15', border: '1px solid #f59e0b30', borderRadius: '4px', color: '#f59e0b', fontSize: '0.7rem', fontWeight: '600', cursor: 'pointer' }}>
                  {t('allianceCenter.selectBtn', 'Select')}
                </button>
              </div>
            ))}
            <Button variant="ghost" onClick={onClose} style={{ width: '100%', marginTop: '1rem' }}>{t('common.cancel', 'Cancel')}</Button>
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⚠️</div>
            <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: '700', marginBottom: '0.5rem' }}>
              {t('allianceCenter.confirmTransfer', 'Transfer ownership to {{name}}?', { name: confirmTarget.username })}
            </h3>
            <p style={{ color: '#f59e0b', fontSize: '0.8rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              {t('allianceCenter.confirmTransferDesc', 'You will no longer be the owner. The new owner will have full control.')}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button variant="ghost" onClick={() => setConfirmTarget(null)} style={{ flex: 1 }}>{t('common.back', 'Back')}</Button>
              <Button variant="danger" onClick={handleTransfer} loading={transferring} style={{ flex: 1 }}>
                {t('allianceCenter.transferBtn', 'Transfer')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransferOwnershipModal;
