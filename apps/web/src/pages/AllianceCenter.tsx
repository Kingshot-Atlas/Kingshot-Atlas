import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useStructuredData, PAGE_BREADCRUMBS } from '../hooks/useStructuredData';
import { useToolAccess } from '../hooks/useToolAccess';
import { useAllianceCenter } from '../hooks/useAllianceCenter';
import type { AllianceMember, MemberSearchResult, PlayerProfileData } from '../hooks/useAllianceCenter';
import { tcLevelToTG } from '../hooks/useAllianceEventCoordinator';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { neonGlow, FONT_DISPLAY } from '../utils/styles';
import { Button } from '../components/shared';

const ACCENT = '#3b82f6';
const ACCENT_DIM = '#3b82f615';
const ACCENT_BORDER = '#3b82f630';

const inputBase: React.CSSProperties = {
  width: '100%', padding: '0.5rem 0.6rem', backgroundColor: '#0d1117',
  border: '1px solid #2a2a2a', borderRadius: '6px', color: '#fff',
  fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
};

// ─── Access Gate (reuses useToolAccess pattern) ───
const AllianceCenterGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { hasAccess, loading } = useToolAccess();
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>{t('common.loading', 'Loading...')}</div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏰</div>
        <h2 style={{ color: '#fff', fontFamily: FONT_DISPLAY, fontSize: isMobile ? '1.25rem' : '1.5rem', marginBottom: '0.75rem' }}>
          {t('allianceCenter.gateTitle', 'Alliance Center')}
        </h2>
        <p style={{ color: '#9ca3af', maxWidth: '420px', marginBottom: '1.5rem', lineHeight: 1.6, fontSize: isMobile ? '0.85rem' : '0.9rem' }}>
          {t('allianceCenter.gateDesc', 'The Alliance Center is available to Atlas Supporters, Ambassadors, Discord Server Boosters, and Admins. Manage your alliance roster and access powerful coordination tools.')}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link to="/support" style={{ textDecoration: 'none' }}>
            <Button variant="primary">{t('allianceCenter.becomeSupporter', 'Become a Supporter')}</Button>
          </Link>
          <Link to="/tools" style={{ textDecoration: 'none' }}>
            <Button variant="ghost">{t('allianceCenter.backToTools', 'Back to Tools')}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// ─── Create Alliance Form ───
const CreateAllianceForm: React.FC<{
  onCreated: () => void;
  createAlliance: ReturnType<typeof useAllianceCenter>['createAlliance'];
}> = ({ onCreated, createAlliance }) => {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { showToast } = useToast();
  const isMobile = useIsMobile();
  const [tag, setTag] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const defaultKingdom = profile?.home_kingdom ?? profile?.linked_kingdom ?? 0;

  const handleCreate = async () => {
    if (!tag.trim() || !name.trim() || !defaultKingdom) return;
    setCreating(true);
    const result = await createAlliance({
      tag: tag.trim(),
      name: name.trim(),
      kingdom_number: defaultKingdom,
      description: description.trim() || undefined,
    });
    setCreating(false);
    if (result.success) {
      showToast(t('allianceCenter.created', 'Alliance center created!'), 'success');
      onCreated();
    } else {
      showToast(result.error || t('allianceCenter.createFailed', 'Failed to create alliance'), 'error');
    }
  };

  const lgInput: React.CSSProperties = { ...inputBase, padding: '0.6rem 0.75rem', borderRadius: '8px', fontSize: '0.9rem' };

  return (
    <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '1.5rem' : '2rem' }}>
      <div style={{ width: '100%', maxWidth: '480px', backgroundColor: '#111111', borderRadius: '16px', border: `1px solid ${ACCENT_BORDER}`, padding: isMobile ? '1.5rem' : '2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: ACCENT_DIM, border: `2px solid ${ACCENT_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: '1.5rem' }}>🏰</div>
          <h2 style={{ color: '#fff', fontFamily: FONT_DISPLAY, fontSize: '1.25rem', marginBottom: '0.4rem' }}>
            {t('allianceCenter.createTitle', 'Create Your Alliance Center')}
          </h2>
          <p style={{ color: '#6b7280', fontSize: '0.8rem', lineHeight: 1.5 }}>
            {t('allianceCenter.createDesc', 'Set up your alliance hub. You can manage one alliance center and add up to 100 members.')}
          </p>
        </div>

        {!defaultKingdom && (
          <div style={{ padding: '0.75rem', marginBottom: '1rem', backgroundColor: '#f59e0b15', border: '1px solid #f59e0b30', borderRadius: '8px', fontSize: '0.8rem', color: '#f59e0b' }}>
            {t('allianceCenter.setKingdomFirst', 'Set your home kingdom in your profile first to create an alliance center.')}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ color: '#9ca3af', fontSize: '0.75rem', fontWeight: '600', display: 'block', marginBottom: '0.3rem' }}>
              {t('allianceCenter.tagLabel', 'Alliance Tag')} *
            </label>
            <input type="text" value={tag} onChange={e => setTag(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 6))} placeholder="e.g. ACE" maxLength={6} style={lgInput} />
            <span style={{ color: '#4b5563', fontSize: '0.65rem' }}>2-6 alphanumeric characters</span>
          </div>
          <div>
            <label style={{ color: '#9ca3af', fontSize: '0.75rem', fontWeight: '600', display: 'block', marginBottom: '0.3rem' }}>
              {t('allianceCenter.nameLabel', 'Alliance Name')} *
            </label>
            <input type="text" value={name} onChange={e => setName(e.target.value.slice(0, 50))} placeholder="e.g. Alliance of Champions" maxLength={50} style={lgInput} />
          </div>
          <div>
            <label style={{ color: '#9ca3af', fontSize: '0.75rem', fontWeight: '600', display: 'block', marginBottom: '0.3rem' }}>
              {t('allianceCenter.kingdomLabel', 'Kingdom')}
            </label>
            <div style={{ ...lgInput, backgroundColor: '#0a0a0a', color: '#6b7280', cursor: 'not-allowed' }}>
              {defaultKingdom ? `Kingdom #${defaultKingdom}` : 'Not set'}
            </div>
            <span style={{ color: '#4b5563', fontSize: '0.65rem' }}>Based on your profile home kingdom</span>
          </div>
          <div>
            <label style={{ color: '#9ca3af', fontSize: '0.75rem', fontWeight: '600', display: 'block', marginBottom: '0.3rem' }}>
              {t('allianceCenter.descriptionLabel', 'Description')}
            </label>
            <textarea value={description} onChange={e => setDescription(e.target.value.slice(0, 200))}
              placeholder={t('allianceCenter.descriptionPlaceholder', 'Optional — a short note about your alliance')}
              maxLength={200} rows={2} style={{ ...lgInput, resize: 'vertical', minHeight: '50px' }} />
          </div>
          <Button variant="primary" onClick={handleCreate}
            disabled={creating || !tag.trim() || tag.trim().length < 2 || !name.trim() || !defaultKingdom}
            loading={creating} style={{ width: '100%', marginTop: '0.5rem' }}>
            {t('allianceCenter.createBtn', 'Create Alliance Center')}
          </Button>
        </div>
      </div>
    </div>
  );
};

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
      showToast(res.error || 'Failed to add member', 'error');
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
      showToast(res.error || 'Failed to add member', 'error');
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '440px', backgroundColor: '#111111', borderRadius: '16px', border: '1px solid #2a2a2a', padding: '1.5rem', boxShadow: '0 16px 64px rgba(0,0,0,0.5)', maxHeight: '80vh', overflowY: 'auto' }}>
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

// ─── Import by Player IDs Modal ───
const ImportMembersModal: React.FC<{
  onImport: ReturnType<typeof useAllianceCenter>['importByPlayerIds'];
  onClose: () => void;
  memberCount: number;
  maxMembers: number;
}> = ({ onImport, onClose, memberCount, maxMembers }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [rawIds, setRawIds] = useState('');
  const [importing, setImporting] = useState(false);

  const parsedIds = rawIds.split(/[\n,;\s]+/).map(s => s.trim()).filter(Boolean);
  const remaining = maxMembers - memberCount;

  const handleImport = async () => {
    if (parsedIds.length === 0) return;
    setImporting(true);
    const result = await onImport(parsedIds);
    setImporting(false);
    if (result.success > 0) {
      showToast(t('allianceCenter.importSuccess', '{{count}} members imported', { count: result.success }), 'success');
    }
    if (result.errors.length > 0) { showToast(result.errors[0] ?? 'Import error', 'error'); }
    if (result.failed === 0 && result.errors.length === 0) { onClose(); }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '440px', backgroundColor: '#111111', borderRadius: '16px', border: '1px solid #2a2a2a', padding: '1.5rem', boxShadow: '0 16px 64px rgba(0,0,0,0.5)' }}>
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

// ─── Manager Section (owner only) ───
const ManagerSection: React.FC<{ ac: ReturnType<typeof useAllianceCenter> }> = ({ ac }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MemberSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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
      setSearchQuery(''); setSearchResults([]);
    } else { showToast(result.error || 'Failed', 'error'); }
  };

  const handleRemove = async (managerId: string, name: string) => {
    const result = await ac.removeManager(managerId);
    if (result.success) { showToast(t('allianceCenter.managerRemoved', '{{name}} removed', { name }), 'success'); }
    else { showToast(result.error || 'Failed', 'error'); }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <span style={{ color: '#9ca3af', fontSize: '0.75rem', fontWeight: '600' }}>
          {t('allianceCenter.managersLabel', 'Managers')} ({ac.managers.length}/{ac.maxManagers})
        </span>
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
      {ac.isOwner && ac.canAddManager && (
        <div style={{ marginTop: '0.5rem' }}>
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('allianceCenter.searchManagerPlaceholder', 'Search Atlas users to add...')}
            style={{ ...inputBase, fontSize: '0.8rem' }} />
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
    </div>
  );
};

// ─── Transfer Ownership Modal ───
const TransferOwnershipModal: React.FC<{
  ac: ReturnType<typeof useAllianceCenter>;
  onClose: () => void;
}> = ({ ac, onClose }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MemberSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<MemberSearchResult | null>(null);
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
      onClose();
    } else { showToast(result.error || 'Failed', 'error'); }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '420px', backgroundColor: '#111111', borderRadius: '16px', border: '1px solid #f59e0b30', padding: '1.5rem', boxShadow: '0 16px 64px rgba(0,0,0,0.5)' }}>
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

// ─── Member Row (with TC level badge + collapsed availability) ───
const MemberRow: React.FC<{
  member: AllianceMember;
  onUpdate: ReturnType<typeof useAllianceCenter>['updateMember'];
  onRemove: ReturnType<typeof useAllianceCenter>['removeMember'];
  canManage: boolean;
  isMobile: boolean;
  profile?: PlayerProfileData;
  availabilityDays?: number;
  availabilitySlots?: number;
}> = ({ member, onUpdate, onRemove, canManage, isMobile, profile, availabilityDays, availabilitySlots }) => {
  const { showToast } = useToast();
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(member.player_name);
  const [editNotes, setEditNotes] = useState(member.notes || '');
  const [removing, setRemoving] = useState(false);
  const [showAvail, setShowAvail] = useState(false);

  const tgLabel = profile ? tcLevelToTG(profile.linked_tc_level) : null;

  const handleSave = async () => {
    const result = await onUpdate(member.id, { player_name: editName.trim(), notes: editNotes.trim() });
    if (result.success) { setEditing(false); showToast(t('allianceCenter.memberUpdated', 'Member updated'), 'success'); }
    else { showToast(result.error || 'Failed to update', 'error'); }
  };

  const handleRemove = async () => {
    setRemoving(true);
    const result = await onRemove(member.id);
    setRemoving(false);
    if (result.success) { showToast(t('allianceCenter.memberRemoved', '{{name}} removed', { name: member.player_name }), 'success'); }
    else { showToast(result.error || 'Failed to remove', 'error'); }
  };

  if (editing) {
    return (
      <div style={{ padding: '0.6rem 0.75rem', backgroundColor: '#1a1a20', borderRadius: '8px', border: `1px solid ${ACCENT_BORDER}`, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <input type="text" value={editName} onChange={e => setEditName(e.target.value.slice(0, 30))}
          style={{ ...inputBase, padding: '0.35rem 0.5rem', fontSize: '0.8rem' }} />
        <input type="text" value={editNotes} onChange={e => setEditNotes(e.target.value.slice(0, 200))}
          placeholder="Notes..." maxLength={200} style={{ ...inputBase, padding: '0.35rem 0.5rem', fontSize: '0.75rem' }} />
        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
          <button onClick={() => setEditing(false)} style={{ padding: '0.25rem 0.5rem', backgroundColor: 'transparent', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#6b7280', fontSize: '0.7rem', cursor: 'pointer' }}>
            {t('common.cancel', 'Cancel')}
          </button>
          <button onClick={handleSave} style={{ padding: '0.25rem 0.5rem', backgroundColor: ACCENT + '20', border: `1px solid ${ACCENT}40`, borderRadius: '4px', color: ACCENT, fontSize: '0.7rem', fontWeight: '600', cursor: 'pointer' }}>
            {t('common.save', 'Save')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ borderRadius: '8px', border: '1px solid #1e1e24', transition: 'border-color 0.15s', backgroundColor: '#111116' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#2a2a2a'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#1e1e24'; }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '0.75rem', padding: '0.5rem 0.75rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
            <span style={{ color: '#e5e7eb', fontSize: '0.85rem', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {member.player_name}
            </span>
            {tgLabel && (
              <span style={{
                fontSize: '0.55rem', fontWeight: 700, padding: '0.05rem 0.3rem', borderRadius: '3px',
                backgroundColor: tgLabel.startsWith('TG') ? '#fbbf2420' : '#22d3ee20',
                color: tgLabel.startsWith('TG') ? '#fbbf24' : '#22d3ee',
              }}>{tgLabel}</span>
            )}
            {profile?.linked_kingdom && (
              <span style={{ color: '#4b5563', fontSize: '0.55rem' }}>K{profile.linked_kingdom}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {member.player_id && <span style={{ color: '#4b5563', fontSize: '0.6rem', fontFamily: 'monospace' }}>ID: {member.player_id}</span>}
            {member.notes && <span style={{ color: '#4b5563', fontSize: '0.6rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.notes}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
          {/* Collapsed availability badge */}
          {availabilityDays != null && availabilityDays > 0 && (
            <button onClick={() => setShowAvail(prev => !prev)} title={t('allianceCenter.toggleAvailability', 'Toggle availability')}
              style={{ padding: '0.15rem 0.35rem', backgroundColor: '#10b98115', border: '1px solid #10b98130', borderRadius: '3px', color: '#10b981', fontSize: '0.55rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              📅 {availabilityDays}d/{availabilitySlots}s
            </button>
          )}
          {canManage && (
            <>
              <button onClick={() => setEditing(true)} style={{ padding: '0.2rem 0.4rem', backgroundColor: 'transparent', border: '1px solid transparent', borderRadius: '4px', color: '#6b7280', fontSize: '0.65rem', cursor: 'pointer' }} title="Edit">✏️</button>
              <button onClick={handleRemove} disabled={removing} style={{ padding: '0.2rem 0.4rem', backgroundColor: 'transparent', border: '1px solid transparent', borderRadius: '4px', color: '#ef4444', fontSize: '0.65rem', cursor: removing ? 'wait' : 'pointer', opacity: removing ? 0.5 : 1 }} title="Remove">🗑️</button>
            </>
          )}
        </div>
      </div>
      {/* Expanded availability detail */}
      {showAvail && availabilityDays != null && availabilityDays > 0 && (
        <div style={{ padding: '0.25rem 0.75rem 0.5rem', borderTop: '1px solid #1e1e24' }}>
          <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>
            {t('allianceCenter.availabilityHint', 'Has submitted availability for {{days}} days ({{slots}} time slots). View details in the Event Coordinator.', { days: availabilityDays, slots: availabilitySlots })}
          </span>
        </div>
      )}
    </div>
  );
};

// ─── Section Wrapper ───
const DashboardSection: React.FC<{
  title: string; icon: string; rightContent?: React.ReactNode; children: React.ReactNode; accentColor?: string;
}> = ({ title, icon, rightContent, children, accentColor = '#6b7280' }) => (
  <div style={{ marginBottom: '1.5rem' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
      <span style={{ fontSize: '1rem' }}>{icon}</span>
      <h3 style={{ color: '#fff', fontSize: '0.95rem', fontWeight: '700', margin: 0, fontFamily: FONT_DISPLAY }}>{title}</h3>
      <div style={{ flex: 1, height: '1px', backgroundColor: accentColor + '30', marginLeft: '0.25rem' }} />
      {rightContent}
    </div>
    {children}
  </div>
);

// ─── Alliance Dashboard ───
const AllianceDashboard: React.FC = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { showToast } = useToast();
  const ac = useAllianceCenter();
  const { reason, grantedBy } = useToolAccess();
  const [showAddMember, setShowAddMember] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditAlliance, setShowEditAlliance] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [editTag, setEditTag] = useState('');
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [memberFilter, setMemberFilter] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Fetch availability summary per member (lightweight: just member_name + day count + slot count)
  const { data: availSummary = new Map<string, { days: number; slots: number }>() } = useQuery({
    queryKey: ['alliance-avail-summary', ac.alliance?.id],
    queryFn: async () => {
      if (!isSupabaseConfigured || !supabase || !ac.alliance) return new Map();
      const { data, error } = await supabase
        .from('alliance_event_availability')
        .select('member_name, time_slots')
        .eq('alliance_id', ac.alliance.id);
      if (error || !data) return new Map();
      const map = new Map<string, { days: number; slots: number }>();
      data.forEach((row: { member_name: string; time_slots: string[] }) => {
        const existing = map.get(row.member_name) || { days: 0, slots: 0 };
        existing.days += 1;
        existing.slots += (row.time_slots?.length || 0);
        map.set(row.member_name, existing);
      });
      return map;
    },
    enabled: !!ac.alliance,
    staleTime: 2 * 60 * 1000,
  });

  // Memoize player profiles map for member rows
  const profilesMap = useMemo(() => ac.playerProfiles, [ac.playerProfiles]);

  const handleDeleteAlliance = useCallback(async () => {
    setDeleting(true);
    const result = await ac.deleteAlliance();
    setDeleting(false);
    setShowDeleteConfirm(false);
    if (result.success) { showToast(t('allianceCenter.deleted', 'Alliance center deleted'), 'success'); }
    else { showToast(result.error || 'Failed to delete', 'error'); }
  }, [ac, showToast, t]);

  const handleEditSave = useCallback(async () => {
    const result = await ac.updateAlliance({ tag: editTag, name: editName, description: editDesc });
    if (result.success) { setShowEditAlliance(false); showToast(t('allianceCenter.updated', 'Alliance updated'), 'success'); }
    else { showToast(result.error || 'Failed to update', 'error'); }
  }, [ac, editTag, editName, editDesc, showToast, t]);

  // Loading state — show spinner FIRST to prevent create form flash for returning users
  if (ac.allianceLoading) {
    return (
      <div style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>{t('common.loading', 'Loading...')}</div>
      </div>
    );
  }

  // No alliance — show create or delegate/manager message
  if (!ac.alliance) {
    if (ac.accessRole === 'delegate' || reason === 'delegate') {
      return (
        <div style={{ minHeight: '50vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🤝</div>
          <h2 style={{ color: '#fff', fontSize: '1.25rem', marginBottom: '0.5rem' }}>
            {t('allianceCenter.delegateNoAlliance', 'Your delegator hasn\'t set up their Alliance Center yet')}
          </h2>
          <p style={{ color: '#6b7280', fontSize: '0.85rem', maxWidth: '400px' }}>
            {t('allianceCenter.delegateNoAllianceDesc', 'Ask {{name}} to create their Alliance Center so you can help manage it.', { name: grantedBy || 'your delegator' })}
          </p>
        </div>
      );
    }
    return <CreateAllianceForm onCreated={() => window.location.reload()} createAlliance={ac.createAlliance} />;
  }

  const alliance = ac.alliance!;
  const filtered = ac.sortedMembers.filter(m =>
    !memberFilter || m.player_name.toLowerCase().includes(memberFilter.toLowerCase()) ||
    (m.player_id && m.player_id.includes(memberFilter))
  );
  const roleLabel = ac.isOwner ? 'Owner' : ac.isManager ? 'Manager' : ac.accessRole === 'delegate' ? 'Delegate' : '';

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: isMobile ? '0.5rem' : '1rem' }}>
      {/* Alliance Header */}
      <div style={{
        backgroundColor: '#111111', borderRadius: '16px', border: `1px solid ${ACCENT_BORDER}`,
        padding: isMobile ? '1.25rem' : '1.5rem', marginBottom: '1.5rem',
        background: `linear-gradient(135deg, #111111 0%, ${ACCENT_DIM} 100%)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
              <span style={{ padding: '0.2rem 0.5rem', backgroundColor: ACCENT + '20', border: `1px solid ${ACCENT}40`, borderRadius: '4px', fontSize: '0.7rem', fontWeight: '800', color: ACCENT, fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                [{alliance.tag}]
              </span>
              <h2 style={{ color: '#fff', fontSize: isMobile ? '1.1rem' : '1.3rem', fontWeight: '700', margin: 0, fontFamily: FONT_DISPLAY }}>
                {alliance.name}
              </h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
              <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>K{alliance.kingdom_number}</span>
              <span style={{ color: '#4b5563', fontSize: '0.6rem' }}>•</span>
              <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>{ac.memberCount}/{ac.maxMembers} members</span>
              <span style={{ color: '#4b5563', fontSize: '0.6rem' }}>•</span>
              <span style={{
                fontSize: '0.65rem', fontWeight: '700', padding: '0.1rem 0.35rem', borderRadius: '3px',
                backgroundColor: ac.isOwner ? '#fbbf2420' : ac.isManager ? '#a855f720' : '#22d3ee20',
                color: ac.isOwner ? '#fbbf24' : ac.isManager ? '#a855f7' : '#22d3ee',
              }}>{roleLabel}</span>
              {ac.accessRole === 'delegate' && grantedBy && (
                <span style={{ color: '#22d3ee', fontSize: '0.7rem' }}>of {grantedBy}</span>
              )}
            </div>
            {alliance.description && (
              <p style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: '0.5rem', lineHeight: 1.4 }}>{alliance.description}</p>
            )}
          </div>

          {ac.canManage && (
            <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0, flexWrap: 'wrap' }}>
              <button onClick={() => { setEditTag(alliance.tag); setEditName(alliance.name); setEditDesc(alliance.description || ''); setShowEditAlliance(true); }}
                style={{ padding: '0.35rem 0.6rem', backgroundColor: '#1a1a20', border: '1px solid #2a2a2a', borderRadius: '6px', color: '#9ca3af', fontSize: '0.7rem', cursor: 'pointer' }}>
                ✏️ Edit
              </button>
              {ac.isOwner && (
                <>
                  <button onClick={() => setShowTransfer(true)}
                    style={{ padding: '0.35rem 0.6rem', backgroundColor: '#f59e0b10', border: '1px solid #f59e0b30', borderRadius: '6px', color: '#f59e0b', fontSize: '0.7rem', cursor: 'pointer' }}>
                    🔄 Transfer
                  </button>
                  <button onClick={() => setShowDeleteConfirm(true)}
                    style={{ padding: '0.35rem 0.6rem', backgroundColor: '#ef444410', border: '1px solid #ef444430', borderRadius: '6px', color: '#ef4444', fontSize: '0.7rem', cursor: 'pointer' }}>
                    🗑️
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Two-column layout on desktop */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 320px', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left: Members */}
        <div>
          <DashboardSection title={t('allianceCenter.rosterTitle', 'Alliance Roster')} icon="👥" accentColor={ACCENT}
            rightContent={ac.canManage ? (
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                <button onClick={() => setShowImport(true)} disabled={!ac.canAddMember}
                  style={{ padding: '0.25rem 0.5rem', backgroundColor: '#22d3ee15', border: '1px solid #22d3ee30', borderRadius: '6px', color: '#22d3ee', fontSize: '0.65rem', fontWeight: '600', cursor: ac.canAddMember ? 'pointer' : 'not-allowed', opacity: ac.canAddMember ? 1 : 0.5 }}>
                  📋 Import IDs
                </button>
                <button onClick={() => setShowAddMember(true)} disabled={!ac.canAddMember}
                  style={{ padding: '0.25rem 0.6rem', backgroundColor: ACCENT + '15', border: `1px solid ${ACCENT}30`, borderRadius: '6px', color: ACCENT, fontSize: '0.7rem', fontWeight: '600', cursor: ac.canAddMember ? 'pointer' : 'not-allowed', opacity: ac.canAddMember ? 1 : 0.5 }}>
                  + {t('allianceCenter.addMember', 'Add Member')}
                </button>
              </div>
            ) : undefined}>
            {/* Search bar */}
            <div style={{ marginBottom: '0.75rem' }}>
              <input type="text" value={memberFilter} onChange={e => setMemberFilter(e.target.value)}
                placeholder={t('allianceCenter.searchMembers', 'Search by name or ID...')}
                style={{ ...inputBase, fontSize: '0.8rem', padding: '0.4rem 0.6rem' }} />
            </div>

            {/* Member list */}
            {ac.membersLoading ? (
              <div style={{ color: '#6b7280', fontSize: '0.85rem', padding: '1rem 0', textAlign: 'center' }}>{t('common.loading', 'Loading...')}</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#111116', borderRadius: '10px', border: '1px dashed #2a2a2a' }}>
                <p style={{ color: '#4b5563', fontSize: '0.85rem', margin: 0 }}>
                  {ac.memberCount === 0
                    ? t('allianceCenter.noMembers', 'No members yet. Add your alliance roster to get started.')
                    : t('allianceCenter.noResults', 'No members match your filter.')}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '500px', overflowY: 'auto' }}>
                {filtered.map(m => {
                  const prof = m.player_id ? profilesMap.get(m.player_id) : undefined;
                  const avail = availSummary.get(m.player_name);
                  return (
                    <MemberRow key={m.id} member={m} onUpdate={ac.updateMember} onRemove={ac.removeMember} canManage={ac.canManage} isMobile={isMobile}
                      profile={prof} availabilityDays={avail?.days} availabilitySlots={avail?.slots} />
                  );
                })}
              </div>
            )}
          </DashboardSection>
        </div>

        {/* Right sidebar: Managers */}
        <div>
          <DashboardSection title={t('allianceCenter.managementTitle', 'Alliance Management')} icon="⚙️" accentColor="#a855f7">
            <ManagerSection ac={ac} />
          </DashboardSection>

          {/* Event Coordinator Quick Link */}
          <Link to="/tools/event-coordinator" style={{ textDecoration: 'none', display: 'block' }}>
            <div style={{
              padding: '0.75rem 1rem', backgroundColor: '#111116', borderRadius: '10px',
              border: '1px solid #10b98130', cursor: 'pointer', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: '0.6rem',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#10b981'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#10b98130'; }}>
              <span style={{ fontSize: '1.25rem' }}>📅</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#e5e7eb', fontSize: '0.8rem', fontWeight: 600 }}>
                  {t('allianceCenter.eventCoordinatorLink', 'Event Coordinator')}
                </div>
                <div style={{ color: '#6b7280', fontSize: '0.65rem' }}>
                  {t('allianceCenter.eventCoordinatorDesc', 'Find the best times for alliance events')}
                </div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </div>
          </Link>
        </div>
      </div>

      {/* Modals */}
      {showAddMember && (
        <AddMemberModal onAdd={ac.addMember} searchAtlasUsers={ac.searchAtlasUsers}
          onClose={() => setShowAddMember(false)} memberCount={ac.memberCount} maxMembers={ac.maxMembers} />
      )}
      {showImport && (
        <ImportMembersModal onImport={ac.importByPlayerIds}
          onClose={() => setShowImport(false)} memberCount={ac.memberCount} maxMembers={ac.maxMembers} />
      )}
      {showTransfer && <TransferOwnershipModal ac={ac} onClose={() => setShowTransfer(false)} />}

      {/* Edit alliance modal */}
      {showEditAlliance && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
          onClick={() => setShowEditAlliance(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '400px', backgroundColor: '#111111', borderRadius: '16px', border: '1px solid #2a2a2a', padding: '1.5rem', boxShadow: '0 16px 64px rgba(0,0,0,0.5)' }}>
            <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' }}>
              {t('allianceCenter.editAlliance', 'Edit Alliance')}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input type="text" value={editTag} onChange={e => setEditTag(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 6))}
                placeholder="Tag" maxLength={6} style={inputBase} />
              <input type="text" value={editName} onChange={e => setEditName(e.target.value.slice(0, 50))}
                placeholder="Name" maxLength={50} style={inputBase} />
              <textarea value={editDesc} onChange={e => setEditDesc(e.target.value.slice(0, 200))}
                placeholder="Description (optional)" maxLength={200} rows={2}
                style={{ ...inputBase, resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button variant="ghost" onClick={() => setShowEditAlliance(false)} style={{ flex: 1 }}>{t('common.cancel', 'Cancel')}</Button>
                <Button variant="primary" onClick={handleEditSave} style={{ flex: 1 }}
                  disabled={!editTag.trim() || editTag.trim().length < 2 || !editName.trim()}>
                  {t('common.save', 'Save')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {showDeleteConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
          onClick={() => setShowDeleteConfirm(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '380px', backgroundColor: '#111111', borderRadius: '16px', border: '1px solid #ef444430', padding: '1.5rem', boxShadow: '0 16px 64px rgba(0,0,0,0.5)', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⚠️</div>
            <h3 style={{ color: '#fff', fontSize: '1.05rem', fontWeight: '700', marginBottom: '0.5rem' }}>
              {t('allianceCenter.deleteTitle', 'Delete Alliance Center?')}
            </h3>
            <p style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              {t('allianceCenter.deleteDesc', 'This will permanently delete your alliance center and remove all {{count}} members. This cannot be undone.', { count: ac.memberCount })}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)} style={{ flex: 1 }}>{t('common.cancel', 'Cancel')}</Button>
              <Button variant="danger" onClick={handleDeleteAlliance} loading={deleting} style={{ flex: 1 }}>
                {t('allianceCenter.deleteBtn', 'Delete')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Page ───
const AllianceCenter: React.FC = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  useDocumentTitle(t('allianceCenter.pageTitle', 'Alliance Center'));
  useStructuredData({
    type: 'BreadcrumbList',
    data: [
      ...(PAGE_BREADCRUMBS.tools || []),
      { name: 'Alliance Center', url: 'https://ks-atlas.com/alliance-center' },
    ],
  });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      <div style={{ padding: isMobile ? '1.25rem 1rem 1rem' : '1.5rem 2rem 1.25rem', textAlign: 'center', background: 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)' }}>
        <h1 style={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 'bold', fontFamily: FONT_DISPLAY, letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
          <span style={{ color: '#fff' }}>ALLIANCE </span>
          <span style={neonGlow(ACCENT)}>CENTER</span>
        </h1>
        <p style={{ color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.85rem', margin: 0 }}>
          {t('allianceCenter.subtitle', 'Your alliance command hub — manage your roster and coordinate.')}
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginTop: '0.75rem' }}>
          <Link to="/tools" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.75rem' }}>← {t('common.allTools', 'All Tools')}</Link>
        </div>
      </div>
      <AllianceCenterGate>
        <AllianceDashboard />
      </AllianceCenterGate>
    </div>
  );
};

export default AllianceCenter;
