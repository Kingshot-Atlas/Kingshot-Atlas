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

// ─── Manager Modal (owner only) ───
const ManagerModal: React.FC<{ ac: ReturnType<typeof useAllianceCenter>; onClose: () => void }> = ({ ac, onClose }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { user: authUser, profile: authProfile } = useAuth();
  const isMob = useIsMobile();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MemberSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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

  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const results = await ac.searchAtlasUsers(searchQuery);
      const mgrIds = new Set(ac.managers.map(m => m.user_id));
      if (ac.alliance) mgrIds.add(ac.alliance.owner_id);
      setSearchResults(results.filter(r => !mgrIds.has(r.id)));
      setSearching(false);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchQuery, ac]);

  const handleAdd = async (userId: string, name: string) => {
    const result = await ac.addManager(userId);
    if (result.success) {
      showToast(t('allianceCenter.managerAdded', '{{name}} is now a manager', { name }), 'success');
      if (ac.alliance && authUser) {
        logAllianceActivity({
          allianceId: ac.alliance.id,
          actorUserId: authUser.id,
          actorName: (authProfile as { linked_username?: string; display_name?: string; username?: string } | null)?.linked_username || (authProfile as { display_name?: string; username?: string } | null)?.display_name || (authProfile as { username?: string } | null)?.username || 'Unknown',
          action: 'manager_added',
          targetName: name,
        });
      }
      setSearchQuery(''); setSearchResults([]);
    } else { showToast(result.error || t('common.failed', 'Failed'), 'error'); }
  };

  const handleRemove = async (managerId: string, name: string) => {
    const result = await ac.removeManager(managerId);
    if (result.success) {
      showToast(t('allianceCenter.managerRemoved', '{{name}} removed', { name }), 'success');
      if (ac.alliance && authUser) {
        logAllianceActivity({
          allianceId: ac.alliance.id,
          actorUserId: authUser.id,
          actorName: (authProfile as { linked_username?: string; display_name?: string; username?: string } | null)?.linked_username || (authProfile as { display_name?: string; username?: string } | null)?.display_name || (authProfile as { username?: string } | null)?.username || 'Unknown',
          action: 'manager_removed',
          targetName: name,
        });
      }
    } else { showToast(result.error || t('common.failed', 'Failed'), 'error'); }
  };

  return (
    <div style={modalBackdrop(isMob)} onClick={onClose} role="dialog" aria-modal="true" aria-label={t('allianceCenter.managersLabel', 'Managers')}>
      <div ref={dialogRef} onClick={e => e.stopPropagation()} style={modalContent(isMob, { maxWidth: '440px', borderColor: '#a855f730' })}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: '700', margin: 0 }}>
            {t('allianceCenter.managersLabel', 'Managers')} ({ac.managers.length}/{ac.maxManagers})
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '1rem', padding: '0.2rem' }}>✕</button>
        </div>
        <p style={{ color: '#4b5563', fontSize: '0.7rem', marginBottom: '0.75rem', lineHeight: 1.4 }}>
          {t('allianceCenter.managersDesc', 'Managers can add/remove members and edit info, but cannot delete the alliance, transfer ownership, or manage other managers.')}
        </p>
        {ac.managers.map(mgr => (
          <div key={mgr.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.6rem', backgroundColor: '#0d1117', borderRadius: '6px', border: '1px solid #1e1e24', marginBottom: '0.3rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem', backgroundColor: '#a855f720', color: '#a855f7', borderRadius: '3px', fontWeight: '700' }}>MGR</span>
              <span style={{ color: '#e5e7eb', fontSize: '0.8rem' }}>{mgr.username}</span>
            </div>
            {ac.isOwner && (
              <button onClick={() => handleRemove(mgr.id, mgr.username || 'Manager')} style={{ padding: '0.15rem 0.3rem', backgroundColor: 'transparent', border: '1px solid transparent', borderRadius: '3px', color: '#ef4444', fontSize: '0.6rem', cursor: 'pointer' }}>✕</button>
            )}
          </div>
        ))}
        {ac.managers.length === 0 && (
          <div style={{ padding: '0.75rem', textAlign: 'center', color: '#4b5563', fontSize: '0.75rem' }}>{t('allianceCenter.noManagersYet', 'No managers yet')}</div>
        )}
        {ac.isOwner && ac.canAddManager && (
          <div style={{ marginTop: '0.75rem' }}>
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('allianceCenter.searchManagerPlaceholder', 'Search Atlas users to add...')}
              style={{ ...inputBase, fontSize: '0.8rem' }} autoFocus />
            {searching && <div style={{ color: '#6b7280', fontSize: '0.7rem', padding: '0.3rem 0' }}>{t('common.loading', 'Loading...')}</div>}
            {searchResults.length > 0 && (
              <div style={{ marginTop: '0.3rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                {searchResults.map(r => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.35rem 0.5rem', backgroundColor: '#0d1117', borderRadius: '4px', border: '1px solid #1e1e24' }}>
                    <span style={{ color: '#e5e7eb', fontSize: '0.8rem' }}>{r.username}</span>
                    <button onClick={() => handleAdd(r.id, r.username)} style={{ padding: '0.15rem 0.4rem', backgroundColor: '#a855f715', border: '1px solid #a855f730', borderRadius: '3px', color: '#a855f7', fontSize: '0.65rem', fontWeight: '600', cursor: 'pointer' }}>+ Manager</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <Button variant="ghost" onClick={onClose} style={{ width: '100%', marginTop: '1rem' }}>{t('common.close', 'Close')}</Button>
      </div>
    </div>
  );
};

export default ManagerModal;
