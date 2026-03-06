import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useStructuredData, PAGE_BREADCRUMBS } from '../hooks/useStructuredData';
import { useToolAccess } from '../hooks/useToolAccess';
import { useAllianceCenter } from '../hooks/useAllianceCenter';
import type { AllianceMember, MemberSearchResult } from '../hooks/useAllianceCenter';
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

const thStyle: React.CSSProperties = {
  padding: '0.5rem 0.6rem', color: '#6b7280', fontSize: '0.7rem', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', textAlign: 'center',
};

const tdStyle: React.CSSProperties = {
  padding: '0.45rem 0.6rem', verticalAlign: 'middle',
};

// ─── Troop constants (matching Battle Registry) ───
const TROOP_COLORS = { infantry: '#3b82f6', cavalry: '#f97316', archers: '#ef4444' };
const MIN_TIER = 8;
const MAX_TIER = 11;
const MIN_TG = 0;
const MAX_TG = 8;

// ─── TG badge color helper (unique per level) ───
const TG_COLORS: Record<string, { bg: string; fg: string }> = {
  TC30: { bg: '#94a3b820', fg: '#94a3b8' }, // slate
  TG1:  { bg: '#22d3ee20', fg: '#22d3ee' }, // cyan
  TG2:  { bg: '#10b98120', fg: '#10b981' }, // emerald
  TG3:  { bg: '#84cc1620', fg: '#84cc16' }, // lime
  TG4:  { bg: '#eab30820', fg: '#eab308' }, // yellow
  TG5:  { bg: '#f9731620', fg: '#f97316' }, // orange
  TG6:  { bg: '#ef444420', fg: '#ef4444' }, // red
  TG7:  { bg: '#ec489920', fg: '#ec4899' }, // pink
  TG8:  { bg: '#a855f720', fg: '#a855f7' }, // purple
};
function tgBadgeColor(label: string): { bg: string; fg: string } {
  return TG_COLORS[label] || { bg: '#6b728020', fg: '#6b7280' };
}

// ─── Language name helper (English names instead of flags) ───
const LANG_NAMES: Record<string, string> = {
  english: 'English', spanish: 'Spanish', french: 'French', german: 'German', portuguese: 'Portuguese',
  italian: 'Italian', dutch: 'Dutch', russian: 'Russian', polish: 'Polish', turkish: 'Turkish',
  arabic: 'Arabic', chinese: 'Chinese', japanese: 'Japanese', korean: 'Korean', vietnamese: 'Vietnamese',
  thai: 'Thai', indonesian: 'Indonesian', malay: 'Malay', hindi: 'Hindi', swedish: 'Swedish',
  norwegian: 'Norwegian', danish: 'Danish', finnish: 'Finnish', greek: 'Greek', czech: 'Czech',
  romanian: 'Romanian', hungarian: 'Hungarian', ukrainian: 'Ukrainian', tagalog: 'Tagalog', filipino: 'Filipino',
  persian: 'Persian', hebrew: 'Hebrew', bengali: 'Bengali', urdu: 'Urdu', tamil: 'Tamil',
  en: 'English', es: 'Spanish', fr: 'French', de: 'German', pt: 'Portuguese', it: 'Italian', nl: 'Dutch',
  ru: 'Russian', pl: 'Polish', tr: 'Turkish', ar: 'Arabic', zh: 'Chinese', ja: 'Japanese', ko: 'Korean',
  vi: 'Vietnamese', th: 'Thai', id: 'Indonesian', ms: 'Malay', hi: 'Hindi', sv: 'Swedish', no: 'Norwegian',
  da: 'Danish', fi: 'Finnish', el: 'Greek', cs: 'Czech', ro: 'Romanian', hu: 'Hungarian', uk: 'Ukrainian',
};
function langName(lang: string | null | undefined): string | null {
  if (!lang || !lang.trim()) return null;
  return LANG_NAMES[lang.toLowerCase().trim()] || LANG_NAMES[lang.toLowerCase().trim().slice(0, 2)] || null;
}

// ─── Availability tooltip with visual bars ───
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Renders a visual per-day availability bar chart inside a hover/click popover */
const AvailTooltip: React.FC<{
  avail: { days: number; slots: number; byDay: { day: number; slots: string[] }[] };
  t: (key: string, fallback: string, opts?: Record<string, unknown>) => string;
}> = ({ avail, t }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  // Close on click outside
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Sort byDay and build bar data — 48 half-hour slots per day (0-47)
  const sortedDays = [...avail.byDay].sort((a, b) => a.day - b.day);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          color: '#10b981', fontSize: '0.7rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
        }}
      >
        {t('allianceCenter.availYes', 'Yes')} <span style={{ fontSize: '0.55rem', opacity: 0.7 }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
          marginBottom: '6px', zIndex: 50, backgroundColor: '#111827', border: '1px solid #22d3ee40',
          borderRadius: '8px', padding: '0.5rem 0.6rem', boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
          minWidth: '180px', whiteSpace: 'nowrap',
        }}>
          <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#9ca3af', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {t('allianceCenter.availSchedule', 'Availability')}
          </div>
          {sortedDays.map(d => {
            // Convert slot strings to indices for the bar visualization
            const slotSet = new Set(d.slots.map(s => {
              const parts = s.split(':').map(Number);
              return (parts[0] ?? 0) * 2 + ((parts[1] ?? 0) >= 30 ? 1 : 0);
            }));
            return (
              <div key={d.day} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.2rem' }}>
                <span style={{ fontSize: '0.6rem', color: '#6b7280', width: '26px', flexShrink: 0, fontWeight: 600 }}>{DAY_SHORT[d.day]}</span>
                <div style={{ display: 'flex', flex: 1, height: '8px', borderRadius: '2px', overflow: 'hidden', backgroundColor: '#1a1a24' }}>
                  {Array.from({ length: 48 }, (_, i) => (
                    <div key={i} style={{
                      flex: 1, backgroundColor: slotSet.has(i) ? '#10b981' : 'transparent',
                      borderRight: i % 4 === 3 ? '1px solid #0d111720' : 'none',
                    }} />
                  ))}
                </div>
                <span style={{ fontSize: '0.5rem', color: '#4b5563', width: '20px', textAlign: 'right', flexShrink: 0 }}>{d.slots.length}</span>
              </div>
            );
          })}
          <div style={{ fontSize: '0.5rem', color: '#4b5563', marginTop: '0.25rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>00:00</span><span>12:00</span><span>24:00</span>
          </div>
        </div>
      )}
    </div>
  );
};

type SortKey = 'name' | 'id' | 'tc' | 'infantry' | 'cavalry' | 'archers' | 'lang' | 'avail';
type SortDir = 'asc' | 'desc';

// ─── Access Gate (allows any authenticated user; dashboard handles role-specific views) ───
const AllianceCenterGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  if (authLoading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>{t('common.loading', 'Loading...')}</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏰</div>
        <h2 style={{ color: '#fff', fontFamily: FONT_DISPLAY, fontSize: isMobile ? '1.25rem' : '1.5rem', marginBottom: '0.75rem' }}>
          {t('allianceCenter.gateTitle', 'Alliance Center')}
        </h2>
        <p style={{ color: '#9ca3af', maxWidth: '420px', marginBottom: '1.5rem', lineHeight: 1.6, fontSize: isMobile ? '0.85rem' : '0.9rem' }}>
          {t('allianceCenter.gateDescLogin', 'Sign in to access the Alliance Center. Manage your alliance roster and coordinate with your team.')}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
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

// ─── Manager Modal (owner only) ───
const ManagerModal: React.FC<{ ac: ReturnType<typeof useAllianceCenter>; onClose: () => void }> = ({ ac, onClose }) => {
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
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '440px', backgroundColor: '#111111', borderRadius: '16px', border: '1px solid #a855f730', padding: '1.5rem', boxShadow: '0 16px 64px rgba(0,0,0,0.5)', maxHeight: '80vh', overflowY: 'auto' }}>
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
          <div style={{ padding: '0.75rem', textAlign: 'center', color: '#4b5563', fontSize: '0.75rem' }}>No managers yet</div>
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

// ─── Alliance Charts Section (Distribution Analytics) ───
const AllianceChartsSection: React.FC<{
  members: AllianceMember[];
  profilesMap: Map<string, import('../hooks/useAllianceCenter').PlayerProfileData>;
  apiPlayerData: Map<string, import('../hooks/useAllianceCenter').ApiPlayerData>;
  registryTroopData: Map<string, { infantry_tier: number; infantry_tg: number; cavalry_tier: number; cavalry_tg: number; archers_tier: number; archers_tg: number; updated_at: string }>;
  isMobile: boolean;
  t: (key: string, fallback: string, opts?: Record<string, unknown>) => string;
}> = ({ members, profilesMap, apiPlayerData, registryTroopData, isMobile, t }) => {
  const [expanded, setExpanded] = useState(false);

  // ── TC Level / TG Distribution (descending) ──
  const tgDist = useMemo(() => {
    const counts = new Map<string, number>();
    members.forEach(m => {
      const prof = m.player_id ? profilesMap.get(m.player_id) : undefined;
      const api = m.player_id ? apiPlayerData.get(m.player_id) : undefined;
      const tcLevel = prof?.linked_tc_level ?? api?.town_center_level ?? null;
      const label = tcLevelToTG(tcLevel);
      if (label) counts.set(label, (counts.get(label) || 0) + 1);
    });
    return [...counts.entries()]
      .sort((a, b) => {
        const order = ['TC30', 'TG1', 'TG2', 'TG3', 'TG4', 'TG5', 'TG6', 'TG7', 'TG8'];
        return order.indexOf(b[0]) - order.indexOf(a[0]);
      });
  }, [members, profilesMap, apiPlayerData]);

  // ── Troop Tier Distribution — separate per troop type, sorted descending ──
  const buildTroopDist = useCallback((getTier: (m: AllianceMember, reg?: { infantry_tier: number; infantry_tg: number; cavalry_tier: number; cavalry_tg: number; archers_tier: number; archers_tg: number }) => { tier: number | null | undefined; tg: number | null | undefined }): [string, number][] => {
    const counts = new Map<string, number>();
    members.forEach(m => {
      const reg = m.player_id ? registryTroopData.get(m.player_id) : undefined;
      const { tier, tg } = getTier(m, reg);
      if (tier) {
        const label = tg != null && tg > 0 ? `T${tier}/TG${tg}` : `T${tier}`;
        counts.set(label, (counts.get(label) || 0) + 1);
      }
    });
    return [...counts.entries()]
      .sort((a, b) => {
        const parseLabel = (s: string): [number, number] => {
          const m = s.match(/T(\d+)(?:\/TG(\d+))?/);
          return m ? [Number(m[1]), Number(m[2] || 0)] : [0, 0];
        };
        const pa = parseLabel(a[0]);
        const pb = parseLabel(b[0]);
        return pb[0] !== pa[0] ? pb[0] - pa[0] : pb[1] - pa[1];
      });
  }, [members, registryTroopData]);

  const infantryDist = useMemo(() => buildTroopDist((m, reg) => ({
    tier: m.infantry_tier ?? reg?.infantry_tier, tg: m.infantry_tier ? m.infantry_tg : reg?.infantry_tg,
  })), [buildTroopDist]);
  const cavalryDist = useMemo(() => buildTroopDist((m, reg) => ({
    tier: m.cavalry_tier ?? reg?.cavalry_tier, tg: m.cavalry_tier ? m.cavalry_tg : reg?.cavalry_tg,
  })), [buildTroopDist]);
  const archersDist = useMemo(() => buildTroopDist((m, reg) => ({
    tier: m.archers_tier ?? reg?.archers_tier, tg: m.archers_tier ? m.archers_tg : reg?.archers_tg,
  })), [buildTroopDist]);

  // ── Language Distribution ──
  const langDist = useMemo(() => {
    const counts = new Map<string, number>();
    members.forEach(m => {
      const prof = m.player_id ? profilesMap.get(m.player_id) : undefined;
      const name = prof ? langName(prof.language) : null;
      if (name) counts.set(name, (counts.get(name) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [members, profilesMap]);

  const hasData = tgDist.length > 0 || infantryDist.length > 0 || cavalryDist.length > 0 || archersDist.length > 0 || langDist.length > 0;
  if (!hasData) return null;

  const BarChart: React.FC<{ data: [string, number][]; color: string; maxVal?: number }> = ({ data, color, maxVal }) => {
    const max = maxVal ?? Math.max(...data.map(d => d[1]), 1);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
        {data.map(([label, count]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ color: '#9ca3af', fontSize: '0.65rem', fontWeight: 600, width: isMobile ? '52px' : '60px', textAlign: 'right', flexShrink: 0 }}>{label}</span>
            <div style={{ flex: 1, height: '14px', backgroundColor: '#1a1a20', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(count / max) * 100}%`, backgroundColor: color, borderRadius: '3px', opacity: 0.75, minWidth: '2px', transition: 'width 0.3s' }} />
            </div>
            <span style={{ color: '#e5e7eb', fontSize: '0.65rem', fontWeight: 700, width: '22px', textAlign: 'right', flexShrink: 0 }}>{count}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ backgroundColor: '#111111', borderRadius: '12px', border: `1px solid ${ACCENT_BORDER}`, marginBottom: '1.5rem', overflow: 'hidden' }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: isMobile ? '0.75rem 1rem' : '0.75rem 1.25rem', minHeight: isMobile ? '44px' : undefined,
          backgroundColor: 'transparent', border: 'none',
          cursor: 'pointer', color: '#fff', textAlign: 'left',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1rem' }}>📊</span>
          <h3 style={{ color: '#fff', fontSize: '0.95rem', fontWeight: 700, margin: 0, fontFamily: FONT_DISPLAY }}>
            {t('allianceCenter.chartsTitle', 'Alliance Analytics')}
          </h3>
          <span style={{ fontSize: '0.6rem', fontWeight: 600, padding: '0.1rem 0.35rem', borderRadius: '4px', backgroundColor: ACCENT + '20', color: ACCENT }}>
            {t('allianceCenter.chartsCount', '{{count}} members', { count: members.length })}
          </span>
        </div>
        <span style={{ color: '#6b7280', fontSize: '0.75rem', transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
      </button>

      {expanded && (
        <div style={{ padding: isMobile ? '0 1rem 1rem' : '0 1.25rem 1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
            {/* Town Center Level Distribution */}
            {tgDist.length > 0 && (
              <div style={{ backgroundColor: '#0d1117', borderRadius: '10px', border: '1px solid #1e1e24', padding: '0.75rem' }}>
                <h4 style={{ color: '#e5e7eb', fontSize: '0.75rem', fontWeight: 700, margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  🏰 {t('allianceCenter.chartsTcDist', 'Town Center Level')}
                </h4>
                <BarChart data={tgDist} color="#22d3ee" />
              </div>
            )}

            {/* Language Distribution */}
            {langDist.length > 0 && (
              <div style={{ backgroundColor: '#0d1117', borderRadius: '10px', border: '1px solid #1e1e24', padding: '0.75rem' }}>
                <h4 style={{ color: '#e5e7eb', fontSize: '0.75rem', fontWeight: 700, margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  🌐 {t('allianceCenter.chartsLangDist', 'Languages Spoken')}
                </h4>
                <BarChart data={langDist} color="#a855f7" />
              </div>
            )}

            {/* Infantry Tier */}
            {infantryDist.length > 0 && (
              <div style={{ backgroundColor: '#0d1117', borderRadius: '10px', border: '1px solid #1e1e24', padding: '0.75rem' }}>
                <h4 style={{ color: TROOP_COLORS.infantry, fontSize: '0.75rem', fontWeight: 700, margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  🗡️ {t('allianceCenter.chartsInfantry', 'Infantry')}
                </h4>
                <BarChart data={infantryDist} color={TROOP_COLORS.infantry} />
              </div>
            )}

            {/* Cavalry Tier */}
            {cavalryDist.length > 0 && (
              <div style={{ backgroundColor: '#0d1117', borderRadius: '10px', border: '1px solid #1e1e24', padding: '0.75rem' }}>
                <h4 style={{ color: TROOP_COLORS.cavalry, fontSize: '0.75rem', fontWeight: 700, margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  🐎 {t('allianceCenter.chartsCavalry', 'Cavalry')}
                </h4>
                <BarChart data={cavalryDist} color={TROOP_COLORS.cavalry} />
              </div>
            )}

            {/* Archers Tier */}
            {archersDist.length > 0 && (
              <div style={{ backgroundColor: '#0d1117', borderRadius: '10px', border: '1px solid #1e1e24', padding: '0.75rem' }}>
                <h4 style={{ color: TROOP_COLORS.archers, fontSize: '0.75rem', fontWeight: 700, margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  🏹 {t('allianceCenter.chartsArchers', 'Archers')}
                </h4>
                <BarChart data={archersDist} color={TROOP_COLORS.archers} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Tier/TG select helper ───
const TroopSelect: React.FC<{
  label: string; color: string;
  tier: number | null; tg: number | null;
  onTierChange: (v: number | null) => void; onTgChange: (v: number | null) => void;
}> = ({ label, color, tier, tg, onTierChange, onTgChange }) => {
  const selStyle: React.CSSProperties = { ...inputBase, padding: '0.35rem 0.4rem', fontSize: '0.8rem', appearance: 'auto' as const };
  return (
    <div>
      <label style={{ color, fontSize: '0.7rem', fontWeight: '700', display: 'block', marginBottom: '0.25rem' }}>{label}</label>
      <div style={{ display: 'flex', gap: '0.3rem' }}>
        <select value={tier ?? ''} onChange={e => onTierChange(e.target.value ? Number(e.target.value) : null)} style={{ ...selStyle, flex: 1 }}>
          <option value="">Tier</option>
          {Array.from({ length: MAX_TIER - MIN_TIER + 1 }, (_, i) => MIN_TIER + i).map(t => (
            <option key={t} value={t}>T{t}</option>
          ))}
        </select>
        <select value={tg ?? ''} onChange={e => onTgChange(e.target.value ? Number(e.target.value) : null)} style={{ ...selStyle, flex: 1 }}>
          <option value="">TG</option>
          {Array.from({ length: MAX_TG - MIN_TG + 1 }, (_, i) => MIN_TG + i).map(t => (
            <option key={t} value={t}>TG{t}</option>
          ))}
        </select>
      </div>
    </div>
  );
};

// ─── Edit Member Modal ───
const EditMemberModal: React.FC<{
  member: AllianceMember;
  onUpdate: ReturnType<typeof useAllianceCenter>['updateMember'];
  onClose: () => void;
  restrictedMode?: boolean; // member self-edit: only troop fields
}> = ({ member, onUpdate, onClose, restrictedMode }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [editName, setEditName] = useState(member.player_name);
  const [editNotes, setEditNotes] = useState(member.notes || '');
  const [infTier, setInfTier] = useState<number | null>(member.infantry_tier);
  const [infTg, setInfTg] = useState<number | null>(member.infantry_tg);
  const [cavTier, setCavTier] = useState<number | null>(member.cavalry_tier);
  const [cavTg, setCavTg] = useState<number | null>(member.cavalry_tg);
  const [arcTier, setArcTier] = useState<number | null>(member.archers_tier);
  const [arcTg, setArcTg] = useState<number | null>(member.archers_tg);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const data: Parameters<typeof onUpdate>[1] = {
      infantry_tier: infTier, infantry_tg: infTg,
      cavalry_tier: cavTier, cavalry_tg: cavTg,
      archers_tier: arcTier, archers_tg: arcTg,
    };
    if (!restrictedMode) {
      data.player_name = editName.trim();
      data.notes = editNotes.trim();
    }
    const result = await onUpdate(member.id, data);
    setSaving(false);
    if (result.success) { showToast(t('allianceCenter.memberUpdated', 'Member updated'), 'success'); onClose(); }
    else { showToast(result.error || 'Failed to update', 'error'); }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '440px', backgroundColor: '#111111', borderRadius: '16px', border: '1px solid #2a2a2a', padding: '1.5rem', boxShadow: '0 16px 64px rgba(0,0,0,0.5)' }}>
        <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' }}>
          {restrictedMode ? t('allianceCenter.editMyTroops', 'Edit My Troops') : t('allianceCenter.editMember', 'Edit Member')}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {!restrictedMode && (
            <div>
              <label style={{ color: '#9ca3af', fontSize: '0.7rem', fontWeight: '600', display: 'block', marginBottom: '0.2rem' }}>Username</label>
              <input type="text" value={editName} onChange={e => setEditName(e.target.value.slice(0, 30))} style={inputBase} autoFocus />
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
            <TroopSelect label="Infantry" color={TROOP_COLORS.infantry} tier={infTier} tg={infTg} onTierChange={setInfTier} onTgChange={setInfTg} />
            <TroopSelect label="Cavalry" color={TROOP_COLORS.cavalry} tier={cavTier} tg={cavTg} onTierChange={setCavTier} onTgChange={setCavTg} />
            <TroopSelect label="Archers" color={TROOP_COLORS.archers} tier={arcTier} tg={arcTg} onTierChange={setArcTier} onTgChange={setArcTg} />
          </div>
          {!restrictedMode && (
            <div>
              <label style={{ color: '#9ca3af', fontSize: '0.7rem', fontWeight: '600', display: 'block', marginBottom: '0.2rem' }}>Notes</label>
              <input type="text" value={editNotes} onChange={e => setEditNotes(e.target.value.slice(0, 200))} placeholder="Optional notes" maxLength={200} style={inputBase} />
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            <Button variant="ghost" onClick={onClose} style={{ flex: 1 }}>{t('common.cancel', 'Cancel')}</Button>
            <Button variant="primary" onClick={handleSave} disabled={saving || (!restrictedMode && !editName.trim())} loading={saving} style={{ flex: 1 }}>
              {t('common.save', 'Save')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Alliance Dashboard ───
const AllianceDashboard: React.FC = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { showToast } = useToast();
  const ac = useAllianceCenter();
  const { hasAccess, reason, grantedBy } = useToolAccess();
  const [showAddMember, setShowAddMember] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditAlliance, setShowEditAlliance] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showManagers, setShowManagers] = useState(false);
  const [editingMember, setEditingMember] = useState<AllianceMember | null>(null);
  const [editTag, setEditTag] = useState('');
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [memberFilter, setMemberFilter] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Fetch availability summary per member (includes per-day detail for tooltip)
  const { data: availSummary = new Map<string, { days: number; slots: number; byDay: { day: number; slots: string[] }[] }>() } = useQuery({
    queryKey: ['alliance-avail-summary', ac.alliance?.id],
    queryFn: async () => {
      if (!isSupabaseConfigured || !supabase || !ac.alliance) return new Map();
      const { data, error } = await supabase
        .from('alliance_event_availability')
        .select('member_name, day_of_week, time_slots')
        .eq('alliance_id', ac.alliance.id);
      if (error || !data) return new Map();
      const map = new Map<string, { days: number; slots: number; byDay: { day: number; slots: string[] }[] }>();
      data.forEach((row: { member_name: string; day_of_week: number; time_slots: string[] }) => {
        const existing = map.get(row.member_name) || { days: 0, slots: 0, byDay: [] };
        existing.days += 1;
        existing.slots += (row.time_slots?.length || 0);
        existing.byDay.push({ day: row.day_of_week, slots: row.time_slots || [] });
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

  // Build enriched + filtered + sorted list (MUST be above early returns — Rules of Hooks)
  const filtered = useMemo(() => {
    const base = ac.sortedMembers.filter(m =>
      !memberFilter || m.player_name.toLowerCase().includes(memberFilter.toLowerCase()) ||
      (m.player_id && m.player_id.includes(memberFilter))
    );
    const getVal = (m: AllianceMember): string | number => {
      const prof = m.player_id ? profilesMap.get(m.player_id) : undefined;
      const apiData = m.player_id ? ac.apiPlayerData.get(m.player_id) : undefined;
      const regTroop = m.player_id ? ac.registryTroopData.get(m.player_id) : undefined;
      const tcLevel = prof?.linked_tc_level ?? apiData?.town_center_level ?? 0;
      switch (sortKey) {
        case 'name': return m.player_name.toLowerCase();
        case 'id': return m.player_id || '';
        case 'tc': return tcLevel;
        case 'infantry': return m.infantry_tier ?? regTroop?.infantry_tier ?? 0;
        case 'cavalry': return m.cavalry_tier ?? regTroop?.cavalry_tier ?? 0;
        case 'archers': return m.archers_tier ?? regTroop?.archers_tier ?? 0;
        case 'lang': return prof?.language || 'zzz';
        case 'avail': return availSummary.get(m.player_name)?.slots ?? 0;
        default: return m.player_name.toLowerCase();
      }
    };
    return [...base].sort((a, b) => {
      const va = getVal(a), vb = getVal(b);
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [ac.sortedMembers, memberFilter, sortKey, sortDir, profilesMap, ac.apiPlayerData, ac.registryTroopData, availSummary]);

  // Loading state — show spinner FIRST to prevent create form flash for returning users
  if (ac.allianceLoading) {
    return (
      <div style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>{t('common.loading', 'Loading...')}</div>
      </div>
    );
  }

  // No alliance — show create, delegate message, or "not in any alliance" for regular users
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
    // Supporters can create; regular users see "not in any alliance"
    if (hasAccess) {
      return <CreateAllianceForm onCreated={() => window.location.reload()} createAlliance={ac.createAlliance} />;
    }
    return (
      <div style={{ minHeight: '50vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🏰</div>
        <h2 style={{ color: '#fff', fontSize: '1.25rem', marginBottom: '0.5rem' }}>
          {t('allianceCenter.noAlliance', 'You\'re not in any Alliance Center')}
        </h2>
        <p style={{ color: '#6b7280', fontSize: '0.85rem', maxWidth: '420px', lineHeight: 1.6 }}>
          {t('allianceCenter.noAllianceDesc', 'Ask your alliance leader to add your Player ID to their roster. Once added, you\'ll be able to view the roster and update your own troop levels here.')}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap', justifyContent: 'center' }}>
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

  const alliance = ac.alliance!;
  const roleLabel = ac.isOwner ? 'Owner' : ac.isManager ? 'Manager' : ac.accessRole === 'delegate' ? 'Delegate' : ac.accessRole === 'member' ? 'Member' : '';
  const isMemberOnly = ac.accessRole === 'member';

  // Sort toggle
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };
  const sortArrow = (key: SortKey) => sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

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
                  <button onClick={() => setShowManagers(true)}
                    style={{ padding: '0.35rem 0.6rem', backgroundColor: '#a855f710', border: '1px solid #a855f730', borderRadius: '6px', color: '#a855f7', fontSize: '0.7rem', cursor: 'pointer' }}>
                    ⚙️ Managers ({ac.managers.length}/{ac.maxManagers})
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
        {/* Alliance Tools Row */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #ffffff10', flexWrap: 'wrap' }}>
          <Link to="/tools/event-coordinator" style={{
            textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.4rem 0.75rem', backgroundColor: '#3b82f610', border: '1px solid #3b82f625',
            borderRadius: '8px', color: '#3b82f6', fontSize: '0.75rem', fontWeight: 600, transition: 'border-color 0.15s',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#3b82f6'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#3b82f625'; }}>
            📅 {t('allianceCenter.eventCoordinatorLink', 'Event Coordinator')}
          </Link>
          <Link to="/tools/base-designer/about" style={{
            textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.4rem 0.75rem', backgroundColor: '#3b82f610', border: '1px solid #3b82f625',
            borderRadius: '8px', color: '#3b82f6', fontSize: '0.75rem', fontWeight: 600, transition: 'border-color 0.15s',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#3b82f6'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#3b82f625'; }}>
            🏰 {t('allianceCenter.baseDesignerLink', 'Base Designer')}
          </Link>
        </div>
      </div>

      {/* Alliance Charts — Distribution Analytics */}
      {ac.memberCount >= 3 && (
        <AllianceChartsSection members={filtered} profilesMap={profilesMap} apiPlayerData={ac.apiPlayerData} registryTroopData={ac.registryTroopData} isMobile={isMobile} t={t} />
      )}

      {/* Alliance Roster — Full Width */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1rem' }}>👥</span>
          <h3 style={{ color: '#fff', fontSize: '0.95rem', fontWeight: '700', margin: 0, fontFamily: FONT_DISPLAY }}>
            {t('allianceCenter.rosterTitle', 'Alliance Roster')}
          </h3>
          {ac.memberCount > 0 && (
            <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '10px', backgroundColor: ac.apiPlayerDataLoading ? '#f59e0b20' : '#22d3ee20', color: ac.apiPlayerDataLoading ? '#f59e0b' : '#22d3ee', fontFamily: 'monospace', letterSpacing: '0.03em' }}>
              {ac.apiPlayerDataLoading
                ? t('allianceCenter.resolving', 'Resolving...')
                : (() => {
                    const resolved = filtered.filter(m => !m.player_id || profilesMap.get(m.player_id) || ac.apiPlayerData.get(m.player_id)).length;
                    return `${resolved}/${ac.memberCount}`;
                  })()}
            </span>
          )}
          <div style={{ flex: 1, height: '1px', backgroundColor: ACCENT + '30', marginLeft: '0.25rem' }} />
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            {ac.canManage && (
              <button onClick={() => ac.refreshApiPlayerData()} disabled={ac.apiPlayerDataLoading}
                style={{ padding: isMobile ? '0.4rem 0.6rem' : '0.25rem 0.5rem', minHeight: isMobile ? '36px' : 'auto', backgroundColor: '#10b98115', border: '1px solid #10b98130', borderRadius: '6px', color: '#10b981', fontSize: '0.65rem', fontWeight: '600', cursor: ac.apiPlayerDataLoading ? 'wait' : 'pointer', opacity: ac.apiPlayerDataLoading ? 0.5 : 1, WebkitTapHighlightColor: 'transparent' }}>
                🔄 {t('allianceCenter.refreshData', 'Refresh')}
              </button>
            )}
            {ac.canManage && (
              <>
                <button onClick={() => setShowImport(true)} disabled={!ac.canAddMember}
                  style={{ padding: '0.25rem 0.5rem', backgroundColor: '#22d3ee15', border: '1px solid #22d3ee30', borderRadius: '6px', color: '#22d3ee', fontSize: '0.65rem', fontWeight: '600', cursor: ac.canAddMember ? 'pointer' : 'not-allowed', opacity: ac.canAddMember ? 1 : 0.5 }}>
                  📋 Import IDs
                </button>
                <button onClick={() => setShowAddMember(true)} disabled={!ac.canAddMember}
                  style={{ padding: '0.25rem 0.6rem', backgroundColor: ACCENT + '15', border: `1px solid ${ACCENT}30`, borderRadius: '6px', color: ACCENT, fontSize: '0.7rem', fontWeight: '600', cursor: ac.canAddMember ? 'pointer' : 'not-allowed', opacity: ac.canAddMember ? 1 : 0.5 }}>
                  + {t('allianceCenter.addMember', 'Add Member')}
                </button>
              </>
            )}
          </div>
        </div>
        {/* Search bar */}
        <div style={{ marginBottom: '0.75rem' }}>
          <input type="text" value={memberFilter} onChange={e => setMemberFilter(e.target.value)}
            placeholder={t('allianceCenter.searchMembers', 'Search by name or ID...')}
            style={{ ...inputBase, fontSize: '0.8rem', padding: '0.4rem 0.6rem' }} />
        </div>

        {/* API status banners */}
        {ac.apiPlayerDataError && !ac.apiPlayerDataLoading && (
          <div style={{ padding: '0.5rem 0.75rem', marginBottom: '0.5rem', backgroundColor: '#ef444410', border: '1px solid #ef444425', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem' }}>⚠️</span>
            <span style={{ color: '#f87171', fontSize: '0.75rem' }}>
              {t('allianceCenter.apiUnavailable', 'Player data service unavailable — showing cached data where available.')}
            </span>
          </div>
        )}
        {ac.apiPlayerDataLoading && ac.memberCount > 0 && (
          <div style={{ padding: '0.4rem 0.75rem', marginBottom: '0.5rem', backgroundColor: '#f59e0b08', border: '1px solid #f59e0b15', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ display: 'inline-block', width: '10px', height: '10px', border: '2px solid #f59e0b40', borderTop: '2px solid #f59e0b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ color: '#f59e0b', fontSize: '0.75rem' }}>
              {t('allianceCenter.resolvingData', 'Resolving player data from game server...')}
            </span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
        {!ac.apiPlayerDataLoading && !ac.apiPlayerDataError && ac.canManage && ac.memberCount > 0 && (() => {
          const unresolvedCount = filtered.filter(m => m.player_id && !profilesMap.get(m.player_id) && !ac.apiPlayerData.get(m.player_id)).length;
          return unresolvedCount > 0 ? (
            <div style={{ padding: '0.4rem 0.75rem', marginBottom: '0.5rem', backgroundColor: '#6366f108', border: '1px solid #6366f115', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.7rem' }}>💡</span>
              <span style={{ color: '#818cf8', fontSize: '0.7rem' }}>
                {t('allianceCenter.unresolvedHint', '{{count}} member(s) not yet resolved. Click 🔄 Refresh to fetch data from game server.', { count: unresolvedCount })}
              </span>
            </div>
          ) : null;
        })()}

        {/* Roster */}
        {ac.membersLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{ backgroundColor: '#111116', borderRadius: '10px', border: '1px solid #1e1e24', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <div style={{ width: '120px', height: '14px', backgroundColor: '#1a1a24', borderRadius: '3px', animation: 'pulse 1.5s ease-in-out infinite' }} />
                  <div style={{ width: '60px', height: '12px', backgroundColor: '#1a1a24', borderRadius: '3px', animation: 'pulse 1.5s ease-in-out 0.2s infinite' }} />
                </div>
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <div style={{ width: '50px', height: '12px', backgroundColor: '#1a1a24', borderRadius: '3px', animation: 'pulse 1.5s ease-in-out 0.4s infinite' }} />
                  <div style={{ width: '50px', height: '12px', backgroundColor: '#1a1a24', borderRadius: '3px', animation: 'pulse 1.5s ease-in-out 0.6s infinite' }} />
                  <div style={{ width: '50px', height: '12px', backgroundColor: '#1a1a24', borderRadius: '3px', animation: 'pulse 1.5s ease-in-out 0.8s infinite' }} />
                </div>
                <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }`}</style>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#111116', borderRadius: '10px', border: '1px dashed #2a2a2a' }}>
            <p style={{ color: '#4b5563', fontSize: '0.85rem', margin: 0 }}>
              {ac.memberCount === 0
                ? t('allianceCenter.noMembers', 'No members yet. Add your alliance roster to get started.')
                : t('allianceCenter.noResults', 'No members match your filter.')}
            </p>
          </div>
        ) : isMobile ? (
          /* ─── Mobile Card Layout ─── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {/* Mobile sort bar */}
            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
              {([['name', 'Name'], ['tc', 'TC'], ['infantry', 'Inf'], ['cavalry', 'Cav'], ['archers', 'Arc'], ['lang', 'Lang']] as [SortKey, string][]).map(([key, label]) => (
                <button key={key} onClick={() => toggleSort(key)} style={{
                  padding: '0.2rem 0.45rem', fontSize: '0.6rem', fontWeight: 600, borderRadius: '4px', border: 'none', cursor: 'pointer',
                  backgroundColor: sortKey === key ? ACCENT + '25' : '#1a1a20', color: sortKey === key ? ACCENT : '#6b7280',
                }}>{label}{sortArrow(key)}</button>
              ))}
            </div>
            {filtered.map((m) => {
              const prof = m.player_id ? profilesMap.get(m.player_id) : undefined;
              const apiData = m.player_id ? ac.apiPlayerData.get(m.player_id) : undefined;
              const regTroop = m.player_id ? ac.registryTroopData.get(m.player_id) : undefined;
              const avail = availSummary.get(m.player_name);
              const tcLevel = prof?.linked_tc_level ?? apiData?.town_center_level ?? null;
              const tgLabel = tcLevelToTG(tcLevel);
              const tgColors = tgLabel ? tgBadgeColor(tgLabel) : null;
              const isNotInAtlas = m.player_id && !prof;
              const isOwnRow = ac.currentMemberId === m.id;
              const isRemoving = removingMemberId === m.id;
              const lang = prof ? langName(prof.language) : null;

              const renderTroopMobile = (label: string, manualTier: number | null, manualTg: number | null, regTier: number | undefined, regTg: number | undefined, color: string) => {
                const tier = manualTier ?? regTier ?? null;
                const tg = manualTier ? manualTg : (regTg ?? null);
                const fromReg = !manualTier && regTier != null;
                if (!tier) return null;
                const text = tg != null && tg > 0 ? `T${tier}/TG${tg}` : `T${tier}`;
                return (
                  <span style={{ color: fromReg ? color + 'aa' : color, fontSize: '0.7rem', fontWeight: 600 }}>
                    {label}: {text}{fromReg && <sup style={{ fontSize: '0.45rem', opacity: 0.6 }}>R</sup>}
                  </span>
                );
              };

              return (
                <div key={m.id} style={{
                  backgroundColor: isOwnRow ? '#111120' : '#111116', borderRadius: '10px', border: `1px solid ${isOwnRow ? '#3b82f625' : '#1e1e24'}`,
                  padding: '0.75rem', transition: 'background-color 0.1s',
                }}>
                  {/* Row 1: Username + TC badge + Player ID (top-right) */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.3rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flex: 1, minWidth: 0 }}>
                      {isNotInAtlas && (
                        <span
                          title={apiData
                            ? t('allianceCenter.notInAtlasResolved', 'Not an Atlas user — resolved from game server')
                            : ac.apiPlayerDataLoading
                              ? t('allianceCenter.resolvingPlayer', 'Resolving player data...')
                              : t('allianceCenter.unknownPlayer', 'Unknown player — not found in Atlas or game server')}
                          style={{ cursor: 'help', width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, display: 'inline-block', backgroundColor: apiData ? '#f59e0b' : ac.apiPlayerDataLoading ? '#6b7280' : '#ef4444' }}
                        />
                      )}
                      {prof ? (
                        <Link to={`/profile/${prof.user_id}`} style={{ color: '#e5e7eb', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          onMouseOver={e => (e.currentTarget.style.color = ACCENT)} onMouseOut={e => (e.currentTarget.style.color = '#e5e7eb')}>
                          {m.player_name}
                        </Link>
                      ) : ac.apiPlayerDataLoading && /^Player \d+$/.test(m.player_name) ? (
                        <span style={{ color: '#9ca3af', fontWeight: 600, fontSize: '0.85rem', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.player_name} <span style={{ color: '#f59e0b', fontSize: '0.65rem', animation: 'pulse 1.5s ease-in-out infinite' }}>{t('allianceCenter.resolvingInline', '(resolving...)')}</span>
                        </span>
                      ) : (
                        <span style={{ color: '#e5e7eb', fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.player_name}</span>
                      )}
                      {isOwnRow && <span style={{ fontSize: '0.5rem', fontWeight: 700, padding: '0.05rem 0.2rem', borderRadius: '3px', backgroundColor: '#3b82f625', color: '#3b82f6', flexShrink: 0 }}>YOU</span>}
                      {tgLabel && tgColors && <span style={{ fontSize: '0.55rem', fontWeight: 700, padding: '0.05rem 0.25rem', borderRadius: '3px', backgroundColor: tgColors.bg, color: tgColors.fg, flexShrink: 0 }}>{tgLabel}</span>}
                    </div>
                    <span style={{ color: '#4b5563', fontFamily: 'monospace', fontSize: '0.65rem', flexShrink: 0 }}>{m.player_id || '—'}</span>
                  </div>
                  {/* Row 2: Inf + Cav + Arc */}
                  <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                    {renderTroopMobile('Inf', m.infantry_tier, m.infantry_tg, regTroop?.infantry_tier, regTroop?.infantry_tg, TROOP_COLORS.infantry)}
                    {renderTroopMobile('Cav', m.cavalry_tier, m.cavalry_tg, regTroop?.cavalry_tier, regTroop?.cavalry_tg, TROOP_COLORS.cavalry)}
                    {renderTroopMobile('Arc', m.archers_tier, m.archers_tg, regTroop?.archers_tier, regTroop?.archers_tg, TROOP_COLORS.archers)}
                  </div>
                  {/* Row 3: Main Language */}
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.3rem' }}>
                    <span style={{ fontSize: '0.65rem', color: '#6b7280' }}>
                      {lang
                        ? <>{t('allianceCenter.mainLanguage', 'Main Language')}: <span style={{ color: '#9ca3af', fontWeight: 600 }}>{lang}</span></>
                        : <span style={{ color: '#3a3a40' }}>—</span>
                      }
                    </span>
                  </div>
                  {/* Row 4: Availability + Edit + Delete */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.65rem', color: '#6b7280' }}>
                      {t('allianceCenter.availability', 'Availability')}:{' '}
                      {avail
                        ? <AvailTooltip avail={avail} t={t} />
                        : <span style={{ color: '#ef4444', fontWeight: 600, fontSize: '0.7rem' }}>{t('allianceCenter.availNo', 'No')}</span>
                      }
                    </span>
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      {ac.canManage ? (
                        <>
                          <button onClick={() => setEditingMember(m)} style={{ padding: '0.3rem 0.5rem', backgroundColor: '#1a1a24', border: '1px solid #2a2a2a', borderRadius: '6px', color: '#6b7280', fontSize: '0.7rem', cursor: 'pointer', minHeight: '28px' }} title="Edit">✏️</button>
                          <button onClick={async () => {
                            setRemovingMemberId(m.id);
                            const result = await ac.removeMember(m.id);
                            setRemovingMemberId(null);
                            if (result.success) showToast(t('allianceCenter.memberRemoved', '{{name}} removed', { name: m.player_name }), 'success');
                            else showToast(result.error || 'Failed to remove', 'error');
                          }} disabled={isRemoving} style={{ padding: '0.3rem 0.5rem', backgroundColor: '#1a1a24', border: '1px solid #ef444430', borderRadius: '6px', color: '#ef4444', fontSize: '0.7rem', cursor: isRemoving ? 'wait' : 'pointer', opacity: isRemoving ? 0.5 : 1, minHeight: '28px' }} title="Remove">🗑️</button>
                        </>
                      ) : isOwnRow ? (
                        <button onClick={() => setEditingMember(m)} style={{ padding: '0.3rem 0.5rem', backgroundColor: '#1a1a24', border: `1px solid ${ACCENT}30`, borderRadius: '6px', color: ACCENT, fontSize: '0.7rem', cursor: 'pointer', minHeight: '28px' }} title="Edit my troops">✏️</button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ─── Desktop Table ─── */
          <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid #1e1e24' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#0d1117', borderBottom: '2px solid #2a2a2a' }}>
                  <th style={{ ...thStyle, textAlign: 'left', cursor: 'pointer', userSelect: 'none', minWidth: '120px' }} onClick={() => toggleSort('name')}>Username{sortArrow('name')}</th>
                  <th style={{ ...thStyle, textAlign: 'left', cursor: 'pointer', userSelect: 'none', width: '90px' }} onClick={() => toggleSort('id')}>ID{sortArrow('id')}</th>
                  <th style={{ ...thStyle, cursor: 'pointer', userSelect: 'none', width: '52px' }} onClick={() => toggleSort('tc')}>TC{sortArrow('tc')}</th>
                  <th style={{ ...thStyle, color: TROOP_COLORS.infantry, cursor: 'pointer', userSelect: 'none', width: '78px' }} onClick={() => toggleSort('infantry')}>Inf{sortArrow('infantry')}</th>
                  <th style={{ ...thStyle, color: TROOP_COLORS.cavalry, cursor: 'pointer', userSelect: 'none', width: '78px' }} onClick={() => toggleSort('cavalry')}>Cav{sortArrow('cavalry')}</th>
                  <th style={{ ...thStyle, color: TROOP_COLORS.archers, cursor: 'pointer', userSelect: 'none', width: '78px' }} onClick={() => toggleSort('archers')}>Arc{sortArrow('archers')}</th>
                  <th style={{ ...thStyle, cursor: 'pointer', userSelect: 'none', width: '72px' }} onClick={() => toggleSort('lang')}>Lang{sortArrow('lang')}</th>
                  <th style={{ ...thStyle, cursor: 'pointer', userSelect: 'none', width: '56px' }} onClick={() => toggleSort('avail')}>Avail{sortArrow('avail')}</th>
                  {(ac.canManage || isMemberOnly) && <th style={{ ...thStyle, width: '56px' }}></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((m, idx) => {
                  const prof = m.player_id ? profilesMap.get(m.player_id) : undefined;
                  const apiData = m.player_id ? ac.apiPlayerData.get(m.player_id) : undefined;
                  const regTroop = m.player_id ? ac.registryTroopData.get(m.player_id) : undefined;
                  const avail = availSummary.get(m.player_name);
                  const tcLevel = prof?.linked_tc_level ?? apiData?.town_center_level ?? null;
                  const tgLabel = tcLevelToTG(tcLevel);
                  const tgColors = tgLabel ? tgBadgeColor(tgLabel) : null;
                  const isNotInAtlas = m.player_id && !prof;
                  const isRemoving = removingMemberId === m.id;
                  const isOwnRow = ac.currentMemberId === m.id;
                  const lang = prof ? langName(prof.language) : null;

                  const renderTroop = (manualTier: number | null, manualTg: number | null, regTier: number | undefined, regTg: number | undefined, color: string) => {
                    const tier = manualTier ?? regTier ?? null;
                    const tg = manualTier ? manualTg : (regTg ?? null);
                    const fromRegistry = !manualTier && regTier != null;
                    if (!tier) return <span style={{ color: '#3a3a40' }}>—</span>;
                    const label = tg != null && tg > 0 ? `T${tier}/TG${tg}` : `T${tier}`;
                    return (
                      <span style={{ color: fromRegistry ? color + 'aa' : color, fontSize: '0.75rem', fontWeight: 600 }} title={fromRegistry ? 'From Battle Registry' : undefined}>
                        {label}{fromRegistry && <span style={{ fontSize: '0.5rem', verticalAlign: 'super', opacity: 0.6 }}>R</span>}
                      </span>
                    );
                  };

                  return (
                    <tr key={m.id} style={{ borderBottom: '1px solid #1e1e24', backgroundColor: isOwnRow ? '#1a1a3020' : idx % 2 === 0 ? '#111116' : '#0d1117', transition: 'background-color 0.1s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1a1a24'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = isOwnRow ? '#1a1a3020' : idx % 2 === 0 ? '#111116' : '#0d1117'; }}>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                          {isNotInAtlas && (
                            <span
                              title={apiData
                                ? t('allianceCenter.notInAtlasResolved', 'Not an Atlas user — resolved from game server')
                                : ac.apiPlayerDataLoading
                                  ? t('allianceCenter.resolvingPlayer', 'Resolving player data...')
                                  : t('allianceCenter.unknownPlayer', 'Unknown player — not found in Atlas or game server')}
                              style={{ cursor: 'help', width: '6px', height: '6px', borderRadius: '50%', display: 'inline-block', flexShrink: 0, backgroundColor: apiData ? '#f59e0b' : ac.apiPlayerDataLoading ? '#6b7280' : '#ef4444' }}
                            />
                          )}
                          {prof ? (
                            <Link to={`/profile/${prof.user_id}`} style={{ color: '#e5e7eb', fontWeight: 500, textDecoration: 'none' }}
                              onMouseOver={e => (e.currentTarget.style.color = ACCENT)} onMouseOut={e => (e.currentTarget.style.color = '#e5e7eb')}>
                              {m.player_name}
                            </Link>
                          ) : ac.apiPlayerDataLoading && /^Player \d+$/.test(m.player_name) ? (
                            <span style={{ color: '#9ca3af', fontWeight: 500, fontStyle: 'italic' }}>
                              {m.player_name} <span style={{ color: '#f59e0b', fontSize: '0.65rem', animation: 'pulse 1.5s ease-in-out infinite' }}>{t('allianceCenter.resolvingInline', '(resolving...)')}</span>
                            </span>
                          ) : (
                            <span style={{ color: '#e5e7eb', fontWeight: 500 }}>{m.player_name}</span>
                          )}
                          {isOwnRow && (
                            <span style={{
                              fontSize: '0.55rem', fontWeight: 700, padding: '0.05rem 0.25rem', borderRadius: '3px',
                              backgroundColor: '#3b82f625', color: '#3b82f6', whiteSpace: 'nowrap',
                            }}>YOU</span>
                          )}
                        </div>
                        {m.notes && <div style={{ color: '#4b5563', fontSize: '0.65rem', marginTop: '0.1rem' }}>{m.notes}</div>}
                      </td>
                      <td style={tdStyle}>
                        <span style={{ color: '#6b7280', fontFamily: 'monospace', fontSize: '0.75rem' }}>{m.player_id || '—'}</span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {tgLabel && tgColors ? (
                          <span style={{
                            fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.35rem', borderRadius: '3px',
                            backgroundColor: tgColors.bg, color: tgColors.fg,
                          }}>{tgLabel}</span>
                        ) : <span style={{ color: '#3a3a40' }}>—</span>}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {renderTroop(m.infantry_tier, m.infantry_tg, regTroop?.infantry_tier, regTroop?.infantry_tg, TROOP_COLORS.infantry)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {renderTroop(m.cavalry_tier, m.cavalry_tg, regTroop?.cavalry_tier, regTroop?.cavalry_tg, TROOP_COLORS.cavalry)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {renderTroop(m.archers_tier, m.archers_tg, regTroop?.archers_tier, regTroop?.archers_tg, TROOP_COLORS.archers)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {lang ? <span style={{ color: '#9ca3af', fontSize: '0.7rem', fontWeight: 500 }}>{lang}</span> : <span style={{ color: '#3a3a40' }}>—</span>}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {avail ? (
                          <AvailTooltip avail={avail} t={t} />
                        ) : <span style={{ color: '#ef4444', fontSize: '0.7rem', fontWeight: 600 }}>{t('allianceCenter.availNo', 'No')}</span>}
                      </td>
                      {(ac.canManage || isMemberOnly) && (
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.15rem', justifyContent: 'center' }}>
                            {ac.canManage ? (
                              <>
                                <button onClick={() => setEditingMember(m)} style={{ padding: '0.15rem 0.3rem', backgroundColor: 'transparent', border: 'none', color: '#6b7280', fontSize: '0.7rem', cursor: 'pointer' }} title="Edit">✏️</button>
                                <button onClick={async () => {
                                  setRemovingMemberId(m.id);
                                  const result = await ac.removeMember(m.id);
                                  setRemovingMemberId(null);
                                  if (result.success) showToast(t('allianceCenter.memberRemoved', '{{name}} removed', { name: m.player_name }), 'success');
                                  else showToast(result.error || 'Failed to remove', 'error');
                                }} disabled={isRemoving} style={{ padding: '0.15rem 0.3rem', backgroundColor: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.7rem', cursor: isRemoving ? 'wait' : 'pointer', opacity: isRemoving ? 0.5 : 1 }} title="Remove">🗑️</button>
                              </>
                            ) : isOwnRow ? (
                              <button onClick={() => setEditingMember(m)} style={{ padding: '0.15rem 0.3rem', backgroundColor: 'transparent', border: 'none', color: '#3b82f6', fontSize: '0.7rem', cursor: 'pointer' }} title="Edit my troops">✏️</button>
                            ) : null}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
      {showManagers && <ManagerModal ac={ac} onClose={() => setShowManagers(false)} />}
      {editingMember && <EditMemberModal member={editingMember} onUpdate={ac.updateMember} onClose={() => setEditingMember(null)} restrictedMode={isMemberOnly && editingMember.id === ac.currentMemberId} />}

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
