import React, { useMemo, useRef, useState } from 'react';
import BackLink from '../shared/BackLink';
import { useTranslation } from 'react-i18next';
import { colors, neonGlow, FONT_DISPLAY } from '../../utils/styles';
import {
  BattleRegistry, BattleRegistryEntry,
  ManagerEntry, ManagerSearchResult,
  RegistryView, TimeSlotRange,
  TIME_SLOTS, TROOP_LABELS, TROOP_COLORS,
  MIN_TIER, MAX_TIER, MIN_TG, MAX_TG,
} from './types';
import { getEntryTimeSlots } from './useBattleRegistry';
import RegistryAnalytics from './RegistryAnalytics';
import { BATTLE_TIER_COLORS } from '../../data/battleTierData';
import type { TierMapEntry } from './BattleRegistryMain';

function getSlotDuration(from: string, to: string, slots: string[]): string {
  const fi = slots.indexOf(from);
  const ti = slots.indexOf(to);
  if (fi < 0 || ti < 0 || ti <= fi) return '';
  const mins = (ti - fi) * 30;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

interface BattleRegistryDashboardProps {
  isMobile: boolean;
  registry: BattleRegistry;
  entries: BattleRegistryEntry[];
  managers: ManagerEntry[];
  tierMap?: Record<string, TierMapEntry>;
  isEditorOrCoEditor: boolean;
  isManager: boolean;
  // Manager assignment
  assignManagerInput: string;
  setAssignManagerInput: (v: string) => void;
  managerSearchResults: ManagerSearchResult[];
  showManagerDropdown: boolean;
  setShowManagerDropdown: (v: boolean) => void;
  managerSearchRef: React.RefObject<HTMLDivElement | null>;
  addManager: (userId: string, username: string) => Promise<void>;
  removeManager: (mgrId: string) => Promise<void>;
  // Actions
  closeRegistry: () => Promise<void>;
  reopenRegistry: () => Promise<void>;
  lockRegistry: () => Promise<void>;
  unlockRegistry: () => Promise<void>;
  archiveRegistry: () => Promise<void>;
  navigate: (path: string) => void;
  setView: (v: RegistryView) => void;
  // Manual entry
  submitManualEntry: (data: {
    username: string; alliance_tag: string;
    time_slots: TimeSlotRange[];
    infantry_tier: number | null; infantry_tg: number | null;
    cavalry_tier: number | null; cavalry_tg: number | null;
    archers_tier: number | null; archers_tg: number | null;
  }) => Promise<void>;
  updateManualEntry: (entryId: string, data: {
    username: string; alliance_tag: string;
    time_slots: TimeSlotRange[];
    infantry_tier: number | null; infantry_tg: number | null;
    cavalry_tier: number | null; cavalry_tg: number | null;
    archers_tier: number | null; archers_tg: number | null;
  }) => Promise<void>;
  deleteEntry: (entryId: string) => Promise<void>;
  saving: boolean;
}

const BattleRegistryDashboard: React.FC<BattleRegistryDashboardProps> = ({
  isMobile, registry, entries, managers, tierMap,
  isEditorOrCoEditor, isManager,
  assignManagerInput, setAssignManagerInput,
  managerSearchResults, showManagerDropdown, setShowManagerDropdown: _setShowManagerDropdown,
  managerSearchRef, addManager, removeManager,
  closeRegistry, reopenRegistry, lockRegistry, unlockRegistry, archiveRegistry,
  navigate: _navigate, setView,
  submitManualEntry, updateManualEntry, deleteEntry, saving,
}) => {
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualUsername, setManualUsername] = useState('');
  const [manualAlliance, setManualAlliance] = useState('');
  const [manualTimeSlots, setManualTimeSlots] = useState<TimeSlotRange[]>([
    { from: '12:00', to: '14:00' },
  ]);
  const [manualInfTier, setManualInfTier] = useState<number | null>(null);
  const [manualInfTg, setManualInfTg] = useState<number | null>(null);
  const [manualCavTier, setManualCavTier] = useState<number | null>(null);
  const [manualCavTg, setManualCavTg] = useState<number | null>(null);
  const [manualArcTier, setManualArcTier] = useState<number | null>(null);
  const [manualArcTg, setManualArcTg] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [copiedList, setCopiedList] = useState(false);
  const manualFormRef = useRef<HTMLDivElement>(null);
  const [playerSearch, setPlayerSearch] = useState('');
  const [sortColumn, setSortColumn] = useState<'player' | 'alliance' | 'time' | 'infantry' | 'cavalry' | 'archers'>('player');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const resetManualForm = () => {
    setManualUsername(''); setManualAlliance('');
    setManualTimeSlots([{ from: '12:00', to: '14:00' }]);
    setManualInfTier(null); setManualInfTg(null);
    setManualCavTier(null); setManualCavTg(null);
    setManualArcTier(null); setManualArcTg(null);
  };

  const updateManualSlot = (idx: number, field: 'from' | 'to', value: string) => {
    setManualTimeSlots(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };
  const addManualSlot = () => {
    if (manualTimeSlots.length < 4) {
      const lastSlot = manualTimeSlots[manualTimeSlots.length - 1];
      const lastToIdx = lastSlot ? TIME_SLOTS.indexOf(lastSlot.to) : -1;
      const newFromIdx = lastToIdx > 0 && lastToIdx < TIME_SLOTS.length - 1 ? lastToIdx : 0;
      const newToIdx = Math.min(newFromIdx + 4, TIME_SLOTS.length - 1);
      setManualTimeSlots(prev => [...prev, { from: TIME_SLOTS[newFromIdx] ?? '12:00', to: TIME_SLOTS[newToIdx] ?? '14:00' }]);
    }
  };
  const removeManualSlot = (idx: number) => {
    if (manualTimeSlots.length > 1) setManualTimeSlots(prev => prev.filter((_, i) => i !== idx));
  };

  const overlapWarning = useMemo(() => {
    if (manualTimeSlots.length < 2) return false;
    for (let i = 0; i < manualTimeSlots.length; i++) {
      for (let j = i + 1; j < manualTimeSlots.length; j++) {
        const a = manualTimeSlots[i]!, b = manualTimeSlots[j]!;
        const ai = TIME_SLOTS.indexOf(a.from), aj = TIME_SLOTS.indexOf(a.to);
        const bi = TIME_SLOTS.indexOf(b.from), bj = TIME_SLOTS.indexOf(b.to);
        if (ai < bj && bi < aj) return true;
      }
    }
    return false;
  }, [manualTimeSlots]);

  const duplicateWarning = useMemo(() => {
    if (!manualUsername.trim() || manualAlliance.trim().length !== 3) return false;
    return entries.some(e =>
      e.id !== editingEntryId &&
      e.username.toLowerCase() === manualUsername.trim().toLowerCase() &&
      e.alliance_tag.toLowerCase() === manualAlliance.trim().toLowerCase()
    );
  }, [entries, manualUsername, manualAlliance, editingEntryId]);

  const handleManualSubmit = async () => {
    if (overlapWarning) return;
    const formData = {
      username: manualUsername, alliance_tag: manualAlliance,
      time_slots: manualTimeSlots,
      infantry_tier: manualInfTier, infantry_tg: manualInfTg,
      cavalry_tier: manualCavTier, cavalry_tg: manualCavTg,
      archers_tier: manualArcTier, archers_tg: manualArcTg,
    };
    if (editingEntryId) {
      await updateManualEntry(editingEntryId, formData);
      setEditingEntryId(null);
    } else {
      await submitManualEntry(formData);
    }
    resetManualForm();
  };

  const startEditing = (entry: BattleRegistryEntry) => {
    setConfirmDelete(null);
    setEditingEntryId(entry.id);
    setManualUsername(entry.username);
    setManualAlliance(entry.alliance_tag);
    setManualTimeSlots(getEntryTimeSlots(entry));
    setManualInfTier(entry.infantry_tier);
    setManualInfTg(entry.infantry_tg);
    setManualCavTier(entry.cavalry_tier);
    setManualCavTg(entry.cavalry_tg);
    setManualArcTier(entry.archers_tier);
    setManualArcTg(entry.archers_tg);
    setShowManualForm(true);
    setTimeout(() => manualFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const cancelEditing = () => {
    setEditingEntryId(null);
    resetManualForm();
  };

  const exportPlayerList = () => {
    const lines = entries.map(e => {
      const troops: string[] = [];
      if (e.infantry_tier != null) troops.push(`Inf T${e.infantry_tier}${e.infantry_tg != null ? `/TG${e.infantry_tg}` : ''}`);
      if (e.cavalry_tier != null) troops.push(`Cav T${e.cavalry_tier}${e.cavalry_tg != null ? `/TG${e.cavalry_tg}` : ''}`);
      if (e.archers_tier != null) troops.push(`Arc T${e.archers_tier}${e.archers_tg != null ? `/TG${e.archers_tg}` : ''}`);
      const slots = getEntryTimeSlots(e);
      const time = slots.map(s => s.from === s.to ? s.from : `${s.from}-${s.to}`).join(', ');
      return `[${e.alliance_tag}] ${e.username} | ${time} UTC | ${troops.join(', ') || '—'}`;
    });
    const header = `BATTLE REGISTRY K${registry.kingdom_number}${registry.kvk_number ? ` — KvK #${registry.kvk_number}` : ''} (${entries.length} players)`;
    const text = `${header}\n${'—'.repeat(40)}\n${lines.join('\n')}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => { setCopiedList(true); setTimeout(() => setCopiedList(false), 2000); }).catch(() => {});
    }
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: colors.surface, borderRadius: '12px', padding: isMobile ? '1rem' : '1.25rem',
    border: `1px solid ${colors.border}`, marginBottom: '1rem',
  };

  const sortedFilteredEntries = useMemo(() => {
    let list = entries;
    if (playerSearch.trim()) {
      const q = playerSearch.trim().toLowerCase();
      list = entries.filter(e => e.username.toLowerCase().includes(q) || e.alliance_tag.toLowerCase().includes(q));
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      switch (sortColumn) {
        case 'player': return dir * a.username.localeCompare(b.username);
        case 'alliance': return dir * a.alliance_tag.localeCompare(b.alliance_tag);
        case 'time': return dir * ((getEntryTimeSlots(a)[0]?.from ?? '').localeCompare(getEntryTimeSlots(b)[0]?.from ?? ''));
        case 'infantry': return dir * ((a.infantry_tier ?? 0) - (b.infantry_tier ?? 0));
        case 'cavalry': return dir * ((a.cavalry_tier ?? 0) - (b.cavalry_tier ?? 0));
        case 'archers': return dir * ((a.archers_tier ?? 0) - (b.archers_tier ?? 0));
        default: return 0;
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, playerSearch, sortColumn, sortDir]);

  const handleSort = (col: typeof sortColumn) => {
    if (sortColumn === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortColumn(col); setSortDir(['infantry', 'cavalry', 'archers'].includes(col) ? 'desc' : 'asc'); }
  };

  const shareLink = `${window.location.origin}/tools/battle-registry/${registry.id}`;

  const copyLink = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(shareLink).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      }).catch(() => { fallbackCopy(); });
    } else {
      fallbackCopy();
    }
  };

  const fallbackCopy = () => {
    const textarea = document.createElement('textarea');
    textarea.value = shareLink;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try { document.execCommand('copy'); setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); } catch { /* silent */ }
    document.body.removeChild(textarea);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      {/* Header */}
      <div style={{ padding: isMobile ? '1.5rem 1rem' : '2rem', textAlign: 'center', background: 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h1 style={{ fontSize: isMobile ? '1.3rem' : '1.75rem', fontFamily: FONT_DISPLAY, marginBottom: '0.5rem', letterSpacing: '0.04em' }}>
            <span style={{ color: '#fff' }}>BATTLE REGISTRY</span>
            <span style={{ ...neonGlow('#ef4444'), marginLeft: '0.5rem' }}>K{registry.kingdom_number}</span>
          </h1>
          {registry.kvk_number && (
            <span style={{ color: colors.textMuted, fontSize: '0.85rem' }}>KvK #{registry.kvk_number}</span>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{
              padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700,
              backgroundColor: registry.status === 'active' ? `${colors.success}20` : registry.status === 'archived' ? '#a855f720' : `${colors.textMuted}20`,
              color: registry.status === 'active' ? colors.success : registry.status === 'archived' ? '#a855f7' : colors.textMuted,
            }}>{registry.status.toUpperCase()}</span>
            {registry.locked_at && (
              <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700, backgroundColor: '#f9731620', color: '#f97316' }}>
                🔒 {t('battleRegistry.locked', 'LOCKED')}
              </span>
            )}
            <span style={{
              padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 600,
              backgroundColor: '#ef444415', color: '#ef4444',
            }}>{entries.length} {t('battleRegistry.registrations', 'registrations')}</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: isMobile ? '1rem' : '1.5rem' }}>
        {/* Quick Actions */}
        <div style={{ ...cardStyle, display: 'flex', flexDirection: isMobile ? 'column' : 'row', flexWrap: 'wrap', gap: '0.5rem', alignItems: isMobile ? 'stretch' : 'center' }}>
          <button onClick={copyLink}
            style={{ padding: isMobile ? '0.65rem 0.85rem' : '0.45rem 0.85rem', borderRadius: '8px', border: '1px solid #ef444440', backgroundColor: '#ef444415', color: '#ef4444', fontSize: isMobile ? '0.85rem' : '0.8rem', fontWeight: 600, cursor: 'pointer', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
            {copiedLink ? `✓ ${t('battleRegistry.copied', 'Copied!')}` : `🔗 ${t('battleRegistry.shareLink', 'Share Link')}`}
          </button>
          <button onClick={() => setShowForm(!showForm)}
            style={{ padding: isMobile ? '0.65rem 0.85rem' : '0.45rem 0.85rem', borderRadius: '8px', border: `1px solid ${colors.border}`, backgroundColor: colors.bg, color: colors.textSecondary, fontSize: isMobile ? '0.85rem' : '0.8rem', fontWeight: 600, cursor: 'pointer', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
            📝 {showForm ? t('battleRegistry.hideForm', 'Hide Form') : t('battleRegistry.fillFormYourself', 'Fill Form Yourself')}
          </button>
          <button onClick={() => { if (showManualForm && editingEntryId) { cancelEditing(); } setShowManualForm(!showManualForm); }}
            style={{ padding: isMobile ? '0.65rem 0.85rem' : '0.45rem 0.85rem', borderRadius: '8px', border: '1px solid #f9731640', backgroundColor: '#f9731610', color: '#f97316', fontSize: isMobile ? '0.85rem' : '0.8rem', fontWeight: 600, cursor: 'pointer', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
            ➕ {showManualForm ? t('battleRegistry.hideManualForm', 'Hide Manual Add') : t('battleRegistry.addPlayerManually', 'Add Player Manually')}
          </button>
          {entries.length > 0 && (
            <button onClick={exportPlayerList}
              style={{ padding: isMobile ? '0.65rem 0.85rem' : '0.45rem 0.85rem', borderRadius: '8px', border: `1px solid ${colors.border}`, backgroundColor: colors.bg, color: colors.textSecondary, fontSize: isMobile ? '0.85rem' : '0.8rem', fontWeight: 600, cursor: 'pointer', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
              {copiedList ? `✓ ${t('battleRegistry.copied', 'Copied!')}` : `📋 ${t('battleRegistry.exportList', 'Copy Player List')}`}
            </button>
          )}
          {registry.status === 'active' && !registry.locked_at && (
            <button onClick={lockRegistry}
              style={{ padding: isMobile ? '0.65rem 0.85rem' : '0.45rem 0.85rem', borderRadius: '8px', border: '1px solid #f9731640', backgroundColor: '#f9731610', color: '#f97316', fontSize: isMobile ? '0.85rem' : '0.8rem', fontWeight: 600, cursor: 'pointer', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
              🔒 {t('battleRegistry.lockEntries', 'Lock Entries')}
            </button>
          )}
          {registry.status === 'active' && registry.locked_at && (
            <button onClick={unlockRegistry}
              style={{ padding: isMobile ? '0.65rem 0.85rem' : '0.45rem 0.85rem', borderRadius: '8px', border: `1px solid ${colors.success}40`, backgroundColor: `${colors.success}10`, color: colors.success, fontSize: isMobile ? '0.85rem' : '0.8rem', fontWeight: 600, cursor: 'pointer', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
              🔓 {t('battleRegistry.unlockEntries', 'Unlock Entries')}
            </button>
          )}
          {registry.status === 'active' && (
            <button onClick={closeRegistry}
              style={{ padding: isMobile ? '0.65rem 0.85rem' : '0.45rem 0.85rem', borderRadius: '8px', border: `1px solid ${colors.error}40`, backgroundColor: `${colors.error}10`, color: colors.error, fontSize: isMobile ? '0.85rem' : '0.8rem', fontWeight: 600, cursor: 'pointer', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
              ⛔ {t('battleRegistry.closeRegistrations', 'Close Registrations')}
            </button>
          )}
          {registry.status === 'closed' && (
            <button onClick={reopenRegistry}
              style={{ padding: isMobile ? '0.65rem 0.85rem' : '0.45rem 0.85rem', borderRadius: '8px', border: `1px solid ${colors.success}40`, backgroundColor: `${colors.success}10`, color: colors.success, fontSize: isMobile ? '0.85rem' : '0.8rem', fontWeight: 600, cursor: 'pointer', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
              🔓 {t('battleRegistry.reopenRegistrations', 'Reopen Registrations')}
            </button>
          )}
          {registry.status === 'closed' && (
            <button onClick={archiveRegistry}
              style={{ padding: isMobile ? '0.65rem 0.85rem' : '0.45rem 0.85rem', borderRadius: '8px', border: '1px solid #a855f740', backgroundColor: '#a855f710', color: '#a855f7', fontSize: isMobile ? '0.85rem' : '0.8rem', fontWeight: 600, cursor: 'pointer', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
              📦 {t('battleRegistry.archiveRegistry', 'Archive')}
            </button>
          )}
        </div>

        {/* Locked Banner */}
        {registry.locked_at && (
          <div style={{ ...cardStyle, borderColor: '#f9731630', backgroundColor: '#f9731608', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>🔒</span>
            <div>
              <p style={{ color: '#f97316', fontSize: '0.8rem', fontWeight: 700, margin: 0 }}>{t('battleRegistry.lockedBannerTitle', 'Registry Locked')}</p>
              <p style={{ color: colors.textMuted, fontSize: '0.7rem', margin: '0.15rem 0 0', lineHeight: 1.4 }}>{t('battleRegistry.lockedBannerDesc', 'Players cannot submit or edit entries. Only managers can make changes.')}</p>
            </div>
          </div>
        )}

        {/* Archived Banner */}
        {registry.status === 'archived' && (
          <div style={{ ...cardStyle, borderColor: '#a855f730', backgroundColor: '#a855f708', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>📦</span>
            <div>
              <p style={{ color: '#a855f7', fontSize: '0.8rem', fontWeight: 700, margin: 0 }}>{t('battleRegistry.archivedBannerTitle', 'Archived Registry')}</p>
              <p style={{ color: colors.textMuted, fontSize: '0.7rem', margin: '0.15rem 0 0', lineHeight: 1.4 }}>{t('battleRegistry.archivedBannerDesc', 'This registry has been archived. It is read-only for historical reference.')}</p>
            </div>
          </div>
        )}

        {/* ─── Manual Add Player Form ──────────────────────────────────── */}
        {showManualForm && (
          <div ref={manualFormRef} style={{ ...cardStyle, borderColor: '#f9731630' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <h4 style={{ color: '#f97316', fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>
                {editingEntryId ? `✏️ ${t('battleRegistry.editPlayerTitle', 'Edit Player Entry')}` : `➕ ${t('battleRegistry.manualAddTitle', 'Add Player Manually')}`}
              </h4>
              {editingEntryId && (
                <button onClick={cancelEditing}
                  style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', border: `1px solid ${colors.border}`, backgroundColor: 'transparent', color: colors.textMuted, fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}>
                  {t('battleRegistry.cancelEdit', 'Cancel')}
                </button>
              )}
            </div>
            <p style={{ color: colors.textMuted, fontSize: '0.7rem', marginBottom: '0.75rem', lineHeight: 1.5 }}>
              {t('battleRegistry.manualAddDesc', 'Add a registration entry for a player who hasn\'t registered in Atlas. This entry will be marked as manually added.')}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div>
                <label style={{ color: colors.textSecondary, fontSize: '0.7rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>{t('battleRegistry.username', 'Username')} *</label>
                <input type="text" value={manualUsername} onChange={e => setManualUsername(e.target.value)}
                  placeholder={t('battleRegistry.manualUsernamePlaceholder', 'Player name')}
                  style={{ width: '100%', padding: '0.45rem 0.6rem', backgroundColor: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text, fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ color: colors.textSecondary, fontSize: '0.7rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>{t('battleRegistry.allianceTag', 'Alliance Tag')} *</label>
                <input type="text" value={manualAlliance} maxLength={3} onChange={e => setManualAlliance(e.target.value.toUpperCase())}
                  placeholder="ABC"
                  style={{ width: '100%', padding: '0.45rem 0.6rem', backgroundColor: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text, fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box', textTransform: 'uppercase', letterSpacing: '0.1em' }} />
              </div>
            </div>
            {/* Time Slots */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
              {manualTimeSlots.map((slot, idx) => {
                const fromIdx = TIME_SLOTS.indexOf(slot.from);
                const toIdx = TIME_SLOTS.indexOf(slot.to);
                const isZeroDuration = fromIdx >= 0 && toIdx >= 0 && fromIdx === toIdx;
                const duration = getSlotDuration(slot.from, slot.to, TIME_SLOTS);
                return (
                  <div key={idx}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ color: colors.textMuted, fontSize: '0.65rem', fontWeight: 600, width: '16px', flexShrink: 0 }}>{idx + 1}.</span>
                      <select value={slot.from} onChange={e => { updateManualSlot(idx, 'from', e.target.value); if (TIME_SLOTS.indexOf(e.target.value) > TIME_SLOTS.indexOf(slot.to)) updateManualSlot(idx, 'to', e.target.value); }}
                        style={{ flex: 1, padding: '0.4rem 0.5rem', backgroundColor: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text, fontSize: '0.75rem', cursor: 'pointer', boxSizing: 'border-box' }}>
                        {TIME_SLOTS.map(s => <option key={s} value={s}>{s} UTC</option>)}
                      </select>
                      <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>→</span>
                      <select value={slot.to} onChange={e => updateManualSlot(idx, 'to', e.target.value)}
                        title={t('battleRegistry.toTooltip', 'End time — your availability runs up to this time')}
                        style={{ flex: 1, padding: '0.4rem 0.5rem', backgroundColor: colors.bg, border: `1px solid ${isZeroDuration ? '#f97316' : colors.border}`, borderRadius: '6px', color: colors.text, fontSize: '0.75rem', cursor: 'pointer', boxSizing: 'border-box' }}>
                        {TIME_SLOTS.filter((_, i) => i >= TIME_SLOTS.indexOf(slot.from)).map(s => <option key={s} value={s}>{s} UTC</option>)}
                      </select>
                      {duration && <span style={{ color: '#22d3ee', fontSize: '0.6rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{duration}</span>}
                      {manualTimeSlots.length > 1 && (
                        <button onClick={() => removeManualSlot(idx)}
                          style={{ padding: '0.25rem 0.4rem', borderRadius: '4px', border: `1px solid ${colors.error}40`, backgroundColor: 'transparent', color: colors.error, fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer' }}>
                          {t('battleRegistry.removeSlot', 'Remove')}
                        </button>
                      )}
                    </div>
                    {isZeroDuration && (
                      <p style={{ color: '#f97316', fontSize: '0.6rem', marginTop: '0.15rem', marginLeft: '20px', fontWeight: 600 }}>
                        ⚠️ {t('battleRegistry.zeroDuration', 'From and To are the same — this range covers no time.')}
                      </p>
                    )}
                  </div>
                );
              })}
              {manualTimeSlots.length < 4 && (
                <button onClick={addManualSlot}
                  style={{ alignSelf: 'flex-start', padding: '0.25rem 0.6rem', borderRadius: '6px', border: `1px solid ${colors.border}`, backgroundColor: 'transparent', color: colors.textSecondary, fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', marginTop: '0.15rem' }}>
                  + {t('battleRegistry.addTimeSlot', 'Add Another Time Slot')}
                </button>
              )}
            </div>
            {/* Troop selectors */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
              {([
                { label: TROOP_LABELS.infantry, color: TROOP_COLORS.infantry, tier: manualInfTier, setTier: setManualInfTier, tg: manualInfTg, setTg: setManualInfTg },
                { label: TROOP_LABELS.cavalry, color: TROOP_COLORS.cavalry, tier: manualCavTier, setTier: setManualCavTier, tg: manualCavTg, setTg: setManualCavTg },
                { label: TROOP_LABELS.archers, color: TROOP_COLORS.archers, tier: manualArcTier, setTier: setManualArcTier, tg: manualArcTg, setTg: setManualArcTg },
              ] as const).map(troop => (
                <div key={troop.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ color: troop.color, fontSize: '0.75rem', fontWeight: 700, width: '60px', flexShrink: 0 }}>{troop.label}</span>
                  <select value={troop.tier ?? ''} onChange={e => troop.setTier(e.target.value ? parseInt(e.target.value) : null)}
                    style={{ padding: '0.35rem 0.5rem', backgroundColor: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text, fontSize: '0.75rem', cursor: 'pointer' }}>
                    <option value="">—</option>
                    {Array.from({ length: MAX_TIER - MIN_TIER + 1 }, (_, i) => MIN_TIER + i).map(n => <option key={n} value={n}>T{n}</option>)}
                  </select>
                  <select value={troop.tg ?? ''} onChange={e => troop.setTg(e.target.value ? parseInt(e.target.value) : null)}
                    style={{ padding: '0.35rem 0.5rem', backgroundColor: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text, fontSize: '0.75rem', cursor: 'pointer' }}>
                    <option value="">—</option>
                    {Array.from({ length: MAX_TG - MIN_TG + 1 }, (_, i) => MIN_TG + i).map(n => <option key={n} value={n}>TG{n}</option>)}
                  </select>
                </div>
              ))}
            </div>
            {overlapWarning && (
              <p style={{ color: colors.error, fontSize: '0.7rem', marginBottom: '0.35rem', fontWeight: 600 }}>
                ⚠️ {t('battleRegistry.toastOverlappingSlots', 'Time slots overlap. Please adjust your time ranges.')}
              </p>
            )}
            {duplicateWarning && (
              <p style={{ color: '#f97316', fontSize: '0.7rem', marginBottom: '0.35rem', fontWeight: 600 }}>
                ⚠️ {t('battleRegistry.duplicateWarning', 'A player with this username and alliance already exists.')}
              </p>
            )}
            <button onClick={handleManualSubmit} disabled={saving || overlapWarning || !manualUsername.trim() || manualAlliance.trim().length !== 3}
              style={{
                padding: '0.5rem 1.25rem', borderRadius: '8px', border: 'none',
                backgroundColor: !overlapWarning && manualAlliance.trim().length === 3 && manualUsername.trim() ? '#f97316' : `${colors.textMuted}20`,
                color: !overlapWarning && manualAlliance.trim().length === 3 && manualUsername.trim() ? '#fff' : colors.textMuted,
                fontSize: '0.8rem', fontWeight: 700, cursor: !overlapWarning && manualAlliance.trim().length === 3 && manualUsername.trim() ? 'pointer' : 'not-allowed',
                opacity: saving ? 0.5 : 1, minHeight: '40px',
              }}>
              {saving ? '...' : editingEntryId ? `✏️ ${t('battleRegistry.updatePlayer', 'Update Player')}` : `➕ ${t('battleRegistry.addPlayer', 'Add Player')}`}
            </button>
          </div>
        )}

        {/* Show inline form toggle */}
        {showForm && (
          <div style={{ ...cardStyle, borderColor: '#ef444430' }}>
            <p style={{ color: colors.textMuted, fontSize: '0.8rem', marginBottom: '0.75rem' }}>
              {t('battleRegistry.fillFormRedirect', 'Use the player form to submit your own registration:')}
            </p>
            <button onClick={() => { setView('form'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              style={{ padding: isMobile ? '0.65rem 1.25rem' : '0.5rem 1rem', borderRadius: '8px', border: '1px solid #ef444450', backgroundColor: '#ef444420', color: '#ef4444', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', minHeight: '44px', width: isMobile ? '100%' : 'auto' }}>
              📝 {t('battleRegistry.goToForm', 'Open Registration Form')}
            </button>
          </div>
        )}

        {/* Battle Managers */}
        {isEditorOrCoEditor && (
          <div style={{ ...cardStyle, borderColor: '#ef444430' }}>
            <h4 style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem' }}>👤 {t('battleRegistry.battleManagers', 'Battle Managers')}</h4>
            {managers.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.5rem' }}>
                {managers.map(mgr => (
                  <div key={mgr.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.5rem', backgroundColor: '#ef444415', border: '1px solid #ef444430', borderRadius: '20px' }}>
                    <span style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 600 }}>{mgr.username}</span>
                    <button onClick={() => removeManager(mgr.id)} style={{ background: 'none', border: 'none', color: colors.error, cursor: 'pointer', fontSize: '0.8rem', padding: '0 0.1rem', lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>
            )}
            <div ref={managerSearchRef as React.RefObject<HTMLDivElement>} style={{ position: 'relative' }}>
              <input type="text" value={assignManagerInput} onChange={(e) => setAssignManagerInput(e.target.value)}
                placeholder={t('battleRegistry.searchManagerPlaceholder', 'Search by username or player ID...')}
                style={{ width: '100%', padding: '0.4rem 0.65rem', backgroundColor: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text, fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }} />
              {showManagerDropdown && managerSearchResults.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '8px', marginTop: '0.25rem', zIndex: 50, maxHeight: '200px', overflowY: 'auto' }}>
                  {managerSearchResults
                    .filter(r => !managers.some(m => m.user_id === r.id))
                    .map(result => (
                      <button key={result.id} onClick={() => addManager(result.id, result.linked_username || result.username)}
                        style={{ display: 'block', width: '100%', padding: '0.5rem 0.75rem', border: 'none', backgroundColor: 'transparent', color: colors.text, fontSize: '0.8rem', cursor: 'pointer', textAlign: 'left' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.bg}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                        {result.linked_username || result.username}
                        {result.linked_player_id && <span style={{ color: colors.textMuted, fontSize: '0.7rem', marginLeft: '0.35rem' }}>({result.linked_player_id})</span>}
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}


        <RegistryAnalytics entries={entries} isMobile={isMobile} cardStyle={cardStyle} />

        {/* ─── Player List ────────────────────────────────────────────── */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', gap: '0.5rem', flexWrap: 'wrap' }}>
            <h3 style={{ color: colors.text, fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>📋 {t('battleRegistry.playerList', 'Registered Players')}</h3>
            {entries.length > 0 && (
              <input
                type="text" value={playerSearch} onChange={e => setPlayerSearch(e.target.value)}
                placeholder={t('battleRegistry.searchPlayers', 'Search players...')}
                style={{ padding: '0.3rem 0.6rem', backgroundColor: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text, fontSize: '0.75rem', outline: 'none', width: isMobile ? '100%' : '180px', boxSizing: 'border-box' }}
              />
            )}
          </div>
          {entries.length === 0 ? (
            <p style={{ color: colors.textMuted, fontSize: '0.8rem' }}>{t('battleRegistry.noEntriesYet', 'No registrations yet.')}</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <th onClick={() => handleSort('player')} style={{ textAlign: 'left', padding: '0.5rem 0.35rem', color: sortColumn === 'player' ? '#ef4444' : colors.textMuted, fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>{t('battleRegistry.player', 'Player')} {sortColumn === 'player' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                    <th onClick={() => handleSort('alliance')} style={{ textAlign: 'center', padding: '0.5rem 0.35rem', color: sortColumn === 'alliance' ? '#ef4444' : colors.textMuted, fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>{t('battleRegistry.alliance', 'Alliance')} {sortColumn === 'alliance' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                    <th onClick={() => handleSort('time')} style={{ textAlign: 'center', padding: '0.5rem 0.35rem', color: sortColumn === 'time' ? '#ef4444' : colors.textMuted, fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>{t('battleRegistry.timeSlot', 'Time')} {sortColumn === 'time' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                    <th onClick={() => handleSort('infantry')} style={{ textAlign: 'center', padding: '0.5rem 0.35rem', color: sortColumn === 'infantry' ? '#ef4444' : TROOP_COLORS.infantry, fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>🛡️{sortColumn === 'infantry' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                    <th onClick={() => handleSort('cavalry')} style={{ textAlign: 'center', padding: '0.5rem 0.35rem', color: sortColumn === 'cavalry' ? '#ef4444' : TROOP_COLORS.cavalry, fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>🐴{sortColumn === 'cavalry' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                    <th onClick={() => handleSort('archers')} style={{ textAlign: 'center', padding: '0.5rem 0.35rem', color: sortColumn === 'archers' ? '#ef4444' : TROOP_COLORS.archers, fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>🏹{sortColumn === 'archers' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                    {tierMap && Object.keys(tierMap).length > 0 && (
                      <th style={{ textAlign: 'center', padding: '0.5rem 0.35rem', color: '#f97316', fontWeight: 600, fontSize: '0.65rem' }}>⚔️/🛡️</th>
                    )}
                    <th style={{ textAlign: 'center', padding: '0.5rem 0.35rem', color: colors.textMuted, fontWeight: 600, width: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFilteredEntries.map(entry => (
                    <tr key={entry.id} style={{ borderBottom: `1px solid ${colors.borderSubtle}`, backgroundColor: editingEntryId === entry.id ? '#f9731612' : undefined, outline: editingEntryId === entry.id ? '1px solid #f9731640' : undefined }}>
                      <td style={{ padding: '0.5rem 0.35rem', color: colors.text, fontWeight: 600 }}>
                        {entry.username}
                        {entry.added_by && !entry.user_id && (
                          <span style={{ fontSize: '0.55rem', color: '#f97316', marginLeft: '0.3rem', fontWeight: 500 }}>{t('battleRegistry.manualTag', 'MANUAL')}</span>
                        )}
                      </td>
                      <td style={{ padding: '0.5rem 0.35rem', color: '#a855f7', textAlign: 'center', fontWeight: 600 }}>[{entry.alliance_tag}]</td>
                      <td style={{ padding: '0.5rem 0.35rem', color: colors.textSecondary, textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {getEntryTimeSlots(entry).map((s, i) => (
                          <span key={i}>{i > 0 ? ', ' : ''}{s.from === s.to ? s.from : `${s.from}–${s.to}`}</span>
                        ))}
                      </td>
                      <td style={{ padding: '0.5rem 0.35rem', textAlign: 'center', color: TROOP_COLORS.infantry }}>
                        {entry.infantry_tier != null ? `T${entry.infantry_tier}` : '—'}
                        {entry.infantry_tg != null ? <span style={{ fontSize: '0.6rem', opacity: 0.7 }}>/TG{entry.infantry_tg}</span> : ''}
                      </td>
                      <td style={{ padding: '0.5rem 0.35rem', textAlign: 'center', color: TROOP_COLORS.cavalry }}>
                        {entry.cavalry_tier != null ? `T${entry.cavalry_tier}` : '—'}
                        {entry.cavalry_tg != null ? <span style={{ fontSize: '0.6rem', opacity: 0.7 }}>/TG{entry.cavalry_tg}</span> : ''}
                      </td>
                      <td style={{ padding: '0.5rem 0.35rem', textAlign: 'center', color: TROOP_COLORS.archers }}>
                        {entry.archers_tier != null ? `T${entry.archers_tier}` : '—'}
                        {entry.archers_tg != null ? <span style={{ fontSize: '0.6rem', opacity: 0.7 }}>/TG{entry.archers_tg}</span> : ''}
                      </td>
                      {tierMap && Object.keys(tierMap).length > 0 && (() => {
                        const tierData = tierMap[entry.username.toLowerCase()];
                        return (
                          <td style={{ padding: '0.5rem 0.35rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {tierData ? (
                              <div style={{ display: 'flex', gap: '0.15rem', justifyContent: 'center' }}>
                                <span title={`Offense: ${tierData.offenseScore.toFixed(1)}`} style={{
                                  fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.3rem',
                                  borderRadius: '3px', backgroundColor: `${BATTLE_TIER_COLORS[tierData.offenseTier]}20`,
                                  color: BATTLE_TIER_COLORS[tierData.offenseTier],
                                }}>{tierData.offenseTier}</span>
                                <span style={{ color: colors.textMuted, fontSize: '0.5rem', lineHeight: '1.6' }}>/</span>
                                <span title={`Defense: ${tierData.defenseScore.toFixed(1)}`} style={{
                                  fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.3rem',
                                  borderRadius: '3px', backgroundColor: `${BATTLE_TIER_COLORS[tierData.defenseTier]}20`,
                                  color: BATTLE_TIER_COLORS[tierData.defenseTier],
                                }}>{tierData.defenseTier}</span>
                              </div>
                            ) : (
                              <span style={{ color: colors.textMuted, fontSize: '0.6rem' }}>—</span>
                            )}
                          </td>
                        );
                      })()}
                      <td style={{ padding: '0.5rem 0.35rem', textAlign: 'center' }}>
                        {(isManager || (entry.added_by && !entry.user_id)) && (
                          confirmDelete === entry.id ? (
                            <div style={{ display: 'flex', gap: '0.2rem', justifyContent: 'center' }}>
                              <button onClick={() => { deleteEntry(entry.id); setConfirmDelete(null); }}
                                style={{ padding: '0.15rem 0.35rem', borderRadius: '4px', border: `1px solid ${colors.error}`, backgroundColor: `${colors.error}20`, color: colors.error, fontSize: '0.6rem', fontWeight: 700, cursor: 'pointer' }}>
                                {t('battleRegistry.confirmDelete', 'Yes')}
                              </button>
                              <button onClick={() => setConfirmDelete(null)}
                                style={{ padding: '0.15rem 0.35rem', borderRadius: '4px', border: `1px solid ${colors.border}`, backgroundColor: 'transparent', color: colors.textMuted, fontSize: '0.6rem', fontWeight: 600, cursor: 'pointer' }}>
                                {t('battleRegistry.cancelDelete', 'No')}
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '0.15rem', justifyContent: 'center' }}>
                              <button onClick={() => startEditing(entry)}
                                title={t('battleRegistry.editEntry', 'Edit entry')}
                                style={{ padding: '0.15rem 0.35rem', borderRadius: '4px', border: 'none', backgroundColor: 'transparent', color: colors.textMuted, fontSize: '0.7rem', cursor: 'pointer', opacity: 0.6 }}
                                onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#f97316'; }}
                                onMouseLeave={e => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.color = colors.textMuted; }}>
                                ✏️
                              </button>
                              <button onClick={() => setConfirmDelete(entry.id)}
                                title={t('battleRegistry.removeEntry', 'Remove entry')}
                                style={{ padding: '0.15rem 0.35rem', borderRadius: '4px', border: 'none', backgroundColor: 'transparent', color: colors.textMuted, fontSize: '0.7rem', cursor: 'pointer', opacity: 0.6 }}
                                onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = colors.error; }}
                                onMouseLeave={e => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.color = colors.textMuted; }}>
                                ✕
                              </button>
                            </div>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Navigation links */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: isMobile ? '1rem' : '1.5rem', marginTop: '1rem', paddingBottom: isMobile ? '1.5rem' : '0', flexWrap: 'wrap' }}>
          <BackLink to="/tools/battle-registry" label={t('battleRegistry.backToRegistries', 'All Registries')} />
          <BackLink to="/tools" label={t('common.allTools', 'All Tools')} variant="secondary" />
        </div>
      </div>
    </div>
  );
};

export default BattleRegistryDashboard;
