import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { colors, neonGlow, FONT_DISPLAY } from '../../utils/styles';
import {
  BattleRegistry, BattleRegistryEntry,
  ManagerEntry, ManagerSearchResult,
  RegistryView,
  TIME_SLOTS, TROOP_TYPES, TROOP_LABELS, TROOP_COLORS,
  TroopType, MIN_TIER, MAX_TIER, MIN_TG, MAX_TG,
} from './types';

interface BattleRegistryDashboardProps {
  isMobile: boolean;
  registry: BattleRegistry;
  entries: BattleRegistryEntry[];
  managers: ManagerEntry[];
  isEditorOrCoEditor: boolean;
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
  navigate: (path: string) => void;
  setView: (v: RegistryView) => void;
  // Manual entry
  submitManualEntry: (data: {
    username: string; alliance_tag: string;
    time_slot: string; time_slot_to: string;
    infantry_tier: number | null; infantry_tg: number | null;
    cavalry_tier: number | null; cavalry_tg: number | null;
    archers_tier: number | null; archers_tg: number | null;
  }) => Promise<void>;
  updateManualEntry: (entryId: string, data: {
    username: string; alliance_tag: string;
    time_slot: string; time_slot_to: string;
    infantry_tier: number | null; infantry_tg: number | null;
    cavalry_tier: number | null; cavalry_tg: number | null;
    archers_tier: number | null; archers_tg: number | null;
  }) => Promise<void>;
  deleteEntry: (entryId: string) => Promise<void>;
  saving: boolean;
}

const BattleRegistryDashboard: React.FC<BattleRegistryDashboardProps> = ({
  isMobile, registry, entries, managers,
  isEditorOrCoEditor,
  assignManagerInput, setAssignManagerInput,
  managerSearchResults, showManagerDropdown, setShowManagerDropdown: _setShowManagerDropdown,
  managerSearchRef, addManager, removeManager,
  closeRegistry, reopenRegistry, navigate: _navigate, setView,
  submitManualEntry, updateManualEntry, deleteEntry, saving,
}) => {
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualUsername, setManualUsername] = useState('');
  const [manualAlliance, setManualAlliance] = useState('');
  const [manualTimeSlot, setManualTimeSlot] = useState(TIME_SLOTS[0] ?? '12:00');
  const [manualTimeSlotTo, setManualTimeSlotTo] = useState(TIME_SLOTS[TIME_SLOTS.length - 1] ?? '18:00');
  const [manualInfTier, setManualInfTier] = useState<number | null>(null);
  const [manualInfTg, setManualInfTg] = useState<number | null>(null);
  const [manualCavTier, setManualCavTier] = useState<number | null>(null);
  const [manualCavTg, setManualCavTg] = useState<number | null>(null);
  const [manualArcTier, setManualArcTier] = useState<number | null>(null);
  const [manualArcTg, setManualArcTg] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [copiedList, setCopiedList] = useState(false);

  const resetManualForm = () => {
    setManualUsername(''); setManualAlliance('');
    setManualTimeSlot(TIME_SLOTS[0] ?? '12:00'); setManualTimeSlotTo(TIME_SLOTS[TIME_SLOTS.length - 1] ?? '18:00');
    setManualInfTier(null); setManualInfTg(null);
    setManualCavTier(null); setManualCavTg(null);
    setManualArcTier(null); setManualArcTg(null);
  };

  const handleManualSubmit = async () => {
    const formData = {
      username: manualUsername, alliance_tag: manualAlliance,
      time_slot: manualTimeSlot, time_slot_to: manualTimeSlotTo,
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
    setEditingEntryId(entry.id);
    setManualUsername(entry.username);
    setManualAlliance(entry.alliance_tag);
    setManualTimeSlot(entry.time_slot);
    setManualTimeSlotTo(entry.time_slot_to ?? entry.time_slot);
    setManualInfTier(entry.infantry_tier);
    setManualInfTg(entry.infantry_tg);
    setManualCavTier(entry.cavalry_tier);
    setManualCavTg(entry.cavalry_tg);
    setManualArcTier(entry.archers_tier);
    setManualArcTg(entry.archers_tg);
    setShowManualForm(true);
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
      const time = e.time_slot_to && e.time_slot_to !== e.time_slot ? `${e.time_slot}-${e.time_slot_to}` : e.time_slot;
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

  // ─── Analytics ──────────────────────────────────────────────────────
  const timeDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    TIME_SLOTS.forEach(slot => { dist[slot] = 0; });
    entries.forEach(e => {
      const fromIdx = TIME_SLOTS.indexOf(e.time_slot);
      const toIdx = e.time_slot_to ? TIME_SLOTS.indexOf(e.time_slot_to) : fromIdx;
      const start = fromIdx >= 0 ? fromIdx : 0;
      const end = toIdx >= start ? toIdx : start;
      for (let i = start; i <= end; i++) {
        const slot = TIME_SLOTS[i];
        if (slot) dist[slot] = (dist[slot] ?? 0) + 1;
      }
    });
    return dist;
  }, [entries]);

  const maxTimeCount = useMemo(() => {
    const vals = Object.values(timeDistribution);
    return vals.length > 0 ? Math.max(1, ...vals) : 1;
  }, [timeDistribution]);

  const troopDistribution = useMemo(() => {
    const dist: Record<TroopType, { combos: Record<string, number>; total: number }> = {
      infantry: { combos: {}, total: 0 },
      cavalry: { combos: {}, total: 0 },
      archers: { combos: {}, total: 0 },
    };
    entries.forEach(e => {
      TROOP_TYPES.forEach(type => {
        const tierKey = `${type}_tier` as keyof BattleRegistryEntry;
        const tgKey = `${type}_tg` as keyof BattleRegistryEntry;
        const tier = e[tierKey] as number | null;
        const tg = e[tgKey] as number | null;
        if (tier != null) {
          const label = tg != null ? `T${tier}/TG${tg}` : `T${tier}`;
          dist[type].combos[label] = (dist[type].combos[label] || 0) + 1;
          dist[type].total++;
        }
      });
    });
    return dist;
  }, [entries]);

  const allianceDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    entries.forEach(e => { dist[e.alliance_tag] = (dist[e.alliance_tag] || 0) + 1; });
    return Object.entries(dist).sort((a, b) => b[1] - a[1]);
  }, [entries]);

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
              backgroundColor: registry.status === 'active' ? `${colors.success}20` : `${colors.textMuted}20`,
              color: registry.status === 'active' ? colors.success : colors.textMuted,
            }}>{registry.status.toUpperCase()}</span>
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
          {registry.status === 'active' && (
            <button onClick={closeRegistry}
              style={{ padding: isMobile ? '0.65rem 0.85rem' : '0.45rem 0.85rem', borderRadius: '8px', border: `1px solid ${colors.error}40`, backgroundColor: `${colors.error}10`, color: colors.error, fontSize: isMobile ? '0.85rem' : '0.8rem', fontWeight: 600, cursor: 'pointer', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
              🔒 {t('battleRegistry.closeRegistrations', 'Close Registrations')}
            </button>
          )}
          {registry.status === 'closed' && (
            <button onClick={reopenRegistry}
              style={{ padding: isMobile ? '0.65rem 0.85rem' : '0.45rem 0.85rem', borderRadius: '8px', border: `1px solid ${colors.success}40`, backgroundColor: `${colors.success}10`, color: colors.success, fontSize: isMobile ? '0.85rem' : '0.8rem', fontWeight: 600, cursor: 'pointer', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
              🔓 {t('battleRegistry.reopenRegistrations', 'Reopen Registrations')}
            </button>
          )}
        </div>

        {/* ─── Manual Add Player Form ──────────────────────────────────── */}
        {showManualForm && (
          <div style={{ ...cardStyle, borderColor: '#f9731630' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div>
                <label style={{ color: colors.textSecondary, fontSize: '0.7rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>{t('battleRegistry.timeFrom', 'From')}</label>
                <select value={manualTimeSlot} onChange={e => { setManualTimeSlot(e.target.value); if (TIME_SLOTS.indexOf(e.target.value) > TIME_SLOTS.indexOf(manualTimeSlotTo)) setManualTimeSlotTo(e.target.value); }}
                  style={{ width: '100%', padding: '0.45rem 0.6rem', backgroundColor: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text, fontSize: '0.8rem', cursor: 'pointer', boxSizing: 'border-box' }}>
                  {TIME_SLOTS.map(s => <option key={s} value={s}>{s} UTC</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: colors.textSecondary, fontSize: '0.7rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>{t('battleRegistry.timeTo_label', 'To')}</label>
                <select value={manualTimeSlotTo} onChange={e => setManualTimeSlotTo(e.target.value)}
                  style={{ width: '100%', padding: '0.45rem 0.6rem', backgroundColor: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text, fontSize: '0.8rem', cursor: 'pointer', boxSizing: 'border-box' }}>
                  {TIME_SLOTS.filter((_, i) => i >= TIME_SLOTS.indexOf(manualTimeSlot)).map(s => <option key={s} value={s}>{s} UTC</option>)}
                </select>
              </div>
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
            <button onClick={handleManualSubmit} disabled={saving || !manualUsername.trim() || manualAlliance.trim().length !== 3}
              style={{
                padding: '0.5rem 1.25rem', borderRadius: '8px', border: 'none',
                backgroundColor: manualAlliance.trim().length === 3 && manualUsername.trim() ? '#f97316' : `${colors.textMuted}20`,
                color: manualAlliance.trim().length === 3 && manualUsername.trim() ? '#fff' : colors.textMuted,
                fontSize: '0.8rem', fontWeight: 700, cursor: manualAlliance.trim().length === 3 && manualUsername.trim() ? 'pointer' : 'not-allowed',
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

        {/* ─── Time Distribution Chart ────────────────────────────────── */}
        <div style={cardStyle}>
          <h3 style={{ color: colors.text, fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem' }}>🕐 {t('battleRegistry.timeDistribution', 'Time Availability Distribution')}</h3>
          {entries.length === 0 ? (
            <p style={{ color: colors.textMuted, fontSize: '0.8rem' }}>{t('battleRegistry.noEntriesYet', 'No registrations yet.')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {TIME_SLOTS.map(slot => {
                const count = timeDistribution[slot] || 0;
                const pct = maxTimeCount > 0 ? (count / maxTimeCount) * 100 : 0;
                return (
                  <div key={slot} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: colors.textSecondary, fontSize: '0.75rem', fontWeight: 600, width: '45px', textAlign: 'right', flexShrink: 0 }}>{slot}</span>
                    <div style={{ flex: 1, height: '20px', backgroundColor: colors.bg, borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                      <div style={{ height: '100%', width: `${pct}%`, backgroundColor: count > 0 ? '#22c55e' : 'transparent', borderRadius: '4px', transition: 'width 0.3s ease', minWidth: count > 0 ? '2px' : '0' }} />
                    </div>
                    <span style={{ color: count > 0 ? '#22c55e' : colors.textMuted, fontSize: '0.75rem', fontWeight: 600, width: '24px', textAlign: 'right', flexShrink: 0 }}>{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── Troop Distribution ─────────────────────────────────────── */}
        <div style={cardStyle}>
          <h3 style={{ color: colors.text, fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem' }}>🗡️ {t('battleRegistry.troopDistribution', 'Troop Level Distribution')}</h3>
          {entries.length === 0 ? (
            <p style={{ color: colors.textMuted, fontSize: '0.8rem' }}>{t('battleRegistry.noEntriesYet', 'No registrations yet.')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {TROOP_TYPES.map(type => {
                const data = troopDistribution[type];
                if (data.total === 0) return null;
                const sortedCombos = Object.entries(data.combos).sort((a, b) => b[1] - a[1]);
                const maxComboCount = Math.max(1, ...sortedCombos.map(c => c[1]));
                return (
                  <div key={type} style={{ padding: '0.75rem', borderRadius: '8px', backgroundColor: `${TROOP_COLORS[type]}06`, border: `1px solid ${TROOP_COLORS[type]}20` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: TROOP_COLORS[type], fontSize: '0.85rem', fontWeight: 700 }}>{TROOP_LABELS[type]}</span>
                      <span style={{ color: colors.textMuted, fontSize: '0.7rem' }}>{data.total} {t('battleRegistry.players', 'players')}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      {sortedCombos.map(([label, count]) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ color: colors.textSecondary, fontSize: '0.7rem', width: isMobile ? '60px' : '70px', textAlign: 'right', flexShrink: 0, fontWeight: 600 }}>{label}</span>
                          <div style={{ flex: 1, height: '14px', backgroundColor: colors.bg, borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${(count / maxComboCount) * 100}%`, backgroundColor: TROOP_COLORS[type], borderRadius: '3px', opacity: 0.7, minWidth: '2px' }} />
                          </div>
                          <span style={{ color: TROOP_COLORS[type], fontSize: '0.7rem', fontWeight: 600, width: '18px', textAlign: 'right', flexShrink: 0 }}>{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── Alliance Breakdown ─────────────────────────────────────── */}
        {allianceDistribution.length > 0 && (
          <div style={cardStyle}>
            <h3 style={{ color: colors.text, fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem' }}>🏰 {t('battleRegistry.allianceBreakdown', 'Alliance Breakdown')}</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {allianceDistribution.map(([tag, count]) => (
                <div key={tag} style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', backgroundColor: '#a855f710', border: '1px solid #a855f725', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ color: '#a855f7', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.05em' }}>[{tag}]</span>
                  <span style={{ color: colors.textMuted, fontSize: '0.7rem' }}>× {count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Player List ────────────────────────────────────────────── */}
        <div style={cardStyle}>
          <h3 style={{ color: colors.text, fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem' }}>📋 {t('battleRegistry.playerList', 'Registered Players')}</h3>
          {entries.length === 0 ? (
            <p style={{ color: colors.textMuted, fontSize: '0.8rem' }}>{t('battleRegistry.noEntriesYet', 'No registrations yet.')}</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <th style={{ textAlign: 'left', padding: '0.5rem 0.35rem', color: colors.textMuted, fontWeight: 600 }}>{t('battleRegistry.player', 'Player')}</th>
                    <th style={{ textAlign: 'center', padding: '0.5rem 0.35rem', color: colors.textMuted, fontWeight: 600 }}>{t('battleRegistry.alliance', 'Alliance')}</th>
                    <th style={{ textAlign: 'center', padding: '0.5rem 0.35rem', color: colors.textMuted, fontWeight: 600 }}>{t('battleRegistry.timeSlot', 'Time')}</th>
                    <th style={{ textAlign: 'center', padding: '0.5rem 0.35rem', color: TROOP_COLORS.infantry, fontWeight: 600 }}>🛡️</th>
                    <th style={{ textAlign: 'center', padding: '0.5rem 0.35rem', color: TROOP_COLORS.cavalry, fontWeight: 600 }}>🐴</th>
                    <th style={{ textAlign: 'center', padding: '0.5rem 0.35rem', color: TROOP_COLORS.archers, fontWeight: 600 }}>🏹</th>
                    <th style={{ textAlign: 'center', padding: '0.5rem 0.35rem', color: colors.textMuted, fontWeight: 600, width: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(entry => (
                    <tr key={entry.id} style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}>
                      <td style={{ padding: '0.5rem 0.35rem', color: colors.text, fontWeight: 600 }}>
                        {entry.username}
                        {entry.added_by && !entry.user_id && (
                          <span style={{ fontSize: '0.55rem', color: '#f97316', marginLeft: '0.3rem', fontWeight: 500 }}>{t('battleRegistry.manualTag', 'MANUAL')}</span>
                        )}
                      </td>
                      <td style={{ padding: '0.5rem 0.35rem', color: '#a855f7', textAlign: 'center', fontWeight: 600 }}>[{entry.alliance_tag}]</td>
                      <td style={{ padding: '0.5rem 0.35rem', color: colors.textSecondary, textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {entry.time_slot_to && entry.time_slot_to !== entry.time_slot
                          ? `${entry.time_slot}–${entry.time_slot_to}`
                          : entry.time_slot}
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
                      <td style={{ padding: '0.5rem 0.35rem', textAlign: 'center' }}>
                        {entry.added_by && !entry.user_id && (
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
          <Link to="/tools/battle-registry" style={{ color: '#22d3ee', textDecoration: 'none', fontSize: isMobile ? '0.85rem' : '0.8rem', padding: '0.5rem', minHeight: '44px', display: 'flex', alignItems: 'center' }}>← {t('battleRegistry.backToRegistries', 'All Registries')}</Link>
          <Link to="/tools" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: isMobile ? '0.85rem' : '0.8rem', padding: '0.5rem', minHeight: '44px', display: 'flex', alignItems: 'center' }}>← {t('battleRegistry.backToTools', 'Back to Tools')}</Link>
        </div>
      </div>
    </div>
  );
};

export default BattleRegistryDashboard;
