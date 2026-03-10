import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useToast } from '../Toast';
import { Button } from '../shared';
import { ACCENT, inputBase, modalBackdrop, modalContent } from './allianceCenterConstants';
import type { useAllianceCenter } from '../../hooks/useAllianceCenter';
import type { MemberSearchResult } from '../../hooks/useAllianceCenter';

// ─── Add Member Modal (search Atlas + manual entry) ───
const AddMemberModal: React.FC<{
  onAdd: ReturnType<typeof useAllianceCenter>['addMember'];
  searchAtlasUsers: ReturnType<typeof useAllianceCenter>['searchAtlasUsers'];
  onClose: () => void;
  memberCount: number;
  maxMembers: number;
}> = ({ onAdd, searchAtlasUsers, onClose, memberCount, maxMembers }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const isMob = useIsMobile();
  const dialogRef = useRef<HTMLDivElement>(null);

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

  const [mode, setMode] = useState<'search' | 'manual'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MemberSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [notes, setNotes] = useState('');
  const [adding, setAdding] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (mode !== 'search' || searchQuery.length < 2) { setSearchResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const results = await searchAtlasUsers(searchQuery);
      setSearchResults(results);
      setSearching(false);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchQuery, mode, searchAtlasUsers]);

  const handleAddFromSearch = async (result: MemberSearchResult) => {
    setAdding(true);
    const res = await onAdd({ player_name: result.linked_username || result.username, player_id: result.linked_player_id || undefined });
    setAdding(false);
    if (res.success) {
      showToast(t('allianceCenter.memberAdded', '{{name}} added to roster', { name: result.linked_username || result.username }), 'success');
      setSearchQuery(''); setSearchResults([]);
    } else {
      showToast(res.error || t('allianceCenter.addMemberFailed', 'Failed to add member'), 'error');
    }
  };

  const handleManualAdd = async () => {
    if (!playerName.trim()) return;
    setAdding(true);
    const res = await onAdd({ player_name: playerName.trim(), player_id: playerId.trim() || undefined, notes: notes.trim() || undefined });
    setAdding(false);
    if (res.success) {
      showToast(t('allianceCenter.memberAdded', '{{name}} added to roster', { name: playerName.trim() }), 'success');
      setPlayerName(''); setPlayerId(''); setNotes('');
    } else {
      showToast(res.error || t('allianceCenter.addMemberFailed', 'Failed to add member'), 'error');
    }
  };

  return (
    <div style={modalBackdrop(isMob)} onClick={onClose} role="dialog" aria-modal="true" aria-label={t('allianceCenter.addMember', 'Add Member')}>
      <div ref={dialogRef} onClick={e => e.stopPropagation()} style={modalContent(isMob, { maxWidth: '440px' })}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: '700', margin: 0 }}>{t('allianceCenter.addMember', 'Add Member')}</h3>
          <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>{memberCount}/{maxMembers}</span>
        </div>

        {/* Mode tabs */}
        <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '1rem' }}>
          {(['search', 'manual'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex: 1, padding: '0.4rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', border: 'none',
              backgroundColor: mode === m ? ACCENT + '20' : '#1a1a20', color: mode === m ? ACCENT : '#6b7280',
              outline: mode === m ? `1px solid ${ACCENT}40` : '1px solid #2a2a2a',
            }}>{m === 'search' ? '🔍 Search Atlas' : '✏️ Manual Entry'}</button>
          ))}
        </div>

        {mode === 'search' ? (
          <div>
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('allianceCenter.searchAtlasPlaceholder', 'Search Atlas users by name...')} style={inputBase} autoFocus />
            {searching && <div style={{ color: '#6b7280', fontSize: '0.75rem', padding: '0.5rem 0' }}>{t('common.loading', 'Loading...')}</div>}
            {searchResults.length > 0 && (
              <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '240px', overflowY: 'auto' }}>
                {searchResults.map(r => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.6rem', backgroundColor: '#0d1117', borderRadius: '6px', border: '1px solid #1e1e24' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: '#e5e7eb', fontSize: '0.85rem', fontWeight: '500' }}>{r.linked_username || r.username}</div>
                      {r.linked_player_id && <div style={{ color: '#4b5563', fontSize: '0.65rem' }}>ID: {r.linked_player_id}</div>}
                    </div>
                    <button onClick={() => handleAddFromSearch(r)} disabled={adding} style={{
                      padding: '0.2rem 0.5rem', backgroundColor: ACCENT + '15', border: `1px solid ${ACCENT}30`,
                      borderRadius: '4px', color: ACCENT, fontSize: '0.7rem', fontWeight: '600', cursor: 'pointer', flexShrink: 0,
                    }}>+ Add</button>
                  </div>
                ))}
              </div>
            )}
            {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
              <div style={{ color: '#4b5563', fontSize: '0.75rem', padding: '0.75rem 0', textAlign: 'center' }}>
                {t('allianceCenter.noSearchResults', 'No Atlas users found. Try manual entry.')}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label style={{ color: '#9ca3af', fontSize: '0.7rem', fontWeight: '600', display: 'block', marginBottom: '0.2rem' }}>
                {t('allianceCenter.playerName', 'Player Name')} *
              </label>
              <input type="text" value={playerName} onChange={e => setPlayerName(e.target.value.slice(0, 30))}
                placeholder="e.g. LordCommander" maxLength={30} style={inputBase} autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleManualAdd(); }} />
            </div>
            <div>
              <label style={{ color: '#9ca3af', fontSize: '0.7rem', fontWeight: '600', display: 'block', marginBottom: '0.2rem' }}>
                {t('allianceCenter.playerIdLabel', 'Player ID')}
              </label>
              <input type="text" value={playerId} onChange={e => setPlayerId(e.target.value.replace(/\D/g, '').slice(0, 20))}
                placeholder={t('allianceCenter.playerIdPlaceholder', 'Optional — in-game player ID')} style={inputBase} />
            </div>
            <div>
              <label style={{ color: '#9ca3af', fontSize: '0.7rem', fontWeight: '600', display: 'block', marginBottom: '0.2rem' }}>
                {t('allianceCenter.notesLabel', 'Notes')}
              </label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value.slice(0, 200))}
                placeholder={t('allianceCenter.notesPlaceholder', 'Optional — e.g. cavalry main, trap lead')} maxLength={200} style={inputBase} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
              <Button variant="ghost" onClick={onClose} style={{ flex: 1 }}>{t('common.cancel', 'Cancel')}</Button>
              <Button variant="primary" onClick={handleManualAdd} disabled={adding || !playerName.trim()} loading={adding} style={{ flex: 1 }}>
                {t('allianceCenter.addBtn', 'Add')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddMemberModal;
