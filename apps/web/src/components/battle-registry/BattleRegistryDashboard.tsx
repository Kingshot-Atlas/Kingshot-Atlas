import React, { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { colors, neonGlow, FONT_DISPLAY } from '../../utils/styles';
import {
  BattleRegistry, BattleRegistryEntry,
  ManagerEntry, ManagerSearchResult,
  RegistryView, TimeSlotRange,
  TIME_SLOTS, TROOP_TYPES, TROOP_LABELS, TROOP_COLORS,
  TroopType, MIN_TIER, MAX_TIER, MIN_TG, MAX_TG,
} from './types';
import { getEntryTimeSlots } from './useBattleRegistry';

// Sort: tier desc → TG desc → alliance alpha → username alpha
function sortPlayers(a: BattleRegistryEntry, b: BattleRegistryEntry): number {
  const maxTier = (e: BattleRegistryEntry) => Math.max(e.infantry_tier ?? 0, e.cavalry_tier ?? 0, e.archers_tier ?? 0);
  const maxTg = (e: BattleRegistryEntry) => Math.max(e.infantry_tg ?? -1, e.cavalry_tg ?? -1, e.archers_tg ?? -1);
  const ta = maxTier(a), tb = maxTier(b);
  if (ta !== tb) return tb - ta;
  const ga = maxTg(a), gb = maxTg(b);
  if (ga !== gb) return gb - ga;
  const ac = a.alliance_tag.localeCompare(b.alliance_tag);
  if (ac !== 0) return ac;
  return a.username.localeCompare(b.username);
}

// Hourly frames for time distribution
const HOURLY_FRAMES = [
  { label: '12:00 – 13:00', slots: [0, 1] },
  { label: '13:00 – 14:00', slots: [2, 3] },
  { label: '14:00 – 15:00', slots: [4, 5] },
  { label: '15:00 – 16:00', slots: [6, 7] },
  { label: '16:00 – 17:00', slots: [8, 9] },
  { label: '17:00 – 18:00', slots: [10, 11, 12] },
];

// Parse "T11/TG8" → { tier: 11, tg: 8 } or "T9" → { tier: 9, tg: -1 }
function parseTroopCombo(label: string): { tier: number; tg: number } {
  const m = label.match(/^T(\d+)(?:\/TG(\d+))?$/);
  if (!m) return { tier: 0, tg: -1 };
  return { tier: parseInt(m[1] ?? '0', 10), tg: m[2] != null ? parseInt(m[2], 10) : -1 };
}

function sortCombosDesc(a: string, b: string): number {
  const pa = parseTroopCombo(a);
  const pb = parseTroopCombo(b);
  if (pa.tier !== pb.tier) return pb.tier - pa.tier;
  return pb.tg - pa.tg;
}

interface BattleRegistryDashboardProps {
  isMobile: boolean;
  registry: BattleRegistry;
  entries: BattleRegistryEntry[];
  managers: ManagerEntry[];
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
  updateWebhookUrl: (url: string) => Promise<void>;
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
  isMobile, registry, entries, managers,
  isEditorOrCoEditor, isManager,
  assignManagerInput, setAssignManagerInput,
  managerSearchResults, showManagerDropdown, setShowManagerDropdown: _setShowManagerDropdown,
  managerSearchRef, addManager, removeManager,
  closeRegistry, reopenRegistry, lockRegistry, unlockRegistry, archiveRegistry,
  updateWebhookUrl, navigate: _navigate, setView,
  submitManualEntry, updateManualEntry, deleteEntry, saving,
}) => {
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualUsername, setManualUsername] = useState('');
  const [manualAlliance, setManualAlliance] = useState('');
  const [manualTimeSlots, setManualTimeSlots] = useState<TimeSlotRange[]>([
    { from: TIME_SLOTS[0] ?? '12:00', to: TIME_SLOTS[TIME_SLOTS.length - 1] ?? '18:00' },
  ]);
  const [manualInfTier, setManualInfTier] = useState<number | null>(null);
  const [manualInfTg, setManualInfTg] = useState<number | null>(null);
  const [manualCavTier, setManualCavTier] = useState<number | null>(null);
  const [manualCavTg, setManualCavTg] = useState<number | null>(null);
  const [manualArcTier, setManualArcTier] = useState<number | null>(null);
  const [manualArcTg, setManualArcTg] = useState<number | null>(null);
  const [webhookInput, setWebhookInput] = useState(registry.discord_webhook_url || '');
  const [showSettings, setShowSettings] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [copiedList, setCopiedList] = useState(false);
  const [expandedTroopCombos, setExpandedTroopCombos] = useState<Set<string>>(new Set());
  const [expandedTimeFrames, setExpandedTimeFrames] = useState<Set<string>>(new Set());
  const [expandedAlliances, setExpandedAlliances] = useState<Set<string>>(new Set());
  const manualFormRef = useRef<HTMLDivElement>(null);
  const [playerSearch, setPlayerSearch] = useState('');
  const [sortColumn, setSortColumn] = useState<'player' | 'alliance' | 'time' | 'infantry' | 'cavalry' | 'archers'>('player');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const resetManualForm = () => {
    setManualUsername(''); setManualAlliance('');
    setManualTimeSlots([{ from: TIME_SLOTS[0] ?? '12:00', to: TIME_SLOTS[TIME_SLOTS.length - 1] ?? '18:00' }]);
    setManualInfTier(null); setManualInfTg(null);
    setManualCavTier(null); setManualCavTg(null);
    setManualArcTier(null); setManualArcTg(null);
  };

  const updateManualSlot = (idx: number, field: 'from' | 'to', value: string) => {
    setManualTimeSlots(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };
  const addManualSlot = () => {
    if (manualTimeSlots.length < 4) setManualTimeSlots(prev => [...prev, { from: TIME_SLOTS[0] ?? '12:00', to: TIME_SLOTS[TIME_SLOTS.length - 1] ?? '18:00' }]);
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
        if (ai <= bj && bi <= aj) return true;
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

  // ─── Analytics ──────────────────────────────────────────────────────
  // Helper: get slot indices an entry covers
  const getEntrySlotIndices = (e: BattleRegistryEntry): Set<number> => {
    const indices = new Set<number>();
    getEntryTimeSlots(e).forEach(range => {
      const fi = TIME_SLOTS.indexOf(range.from), ti = TIME_SLOTS.indexOf(range.to);
      for (let i = (fi >= 0 ? fi : 0); i <= (ti >= fi ? ti : fi); i++) indices.add(i);
    });
    return indices;
  };

  // Hourly frame distribution + players
  const hourlyData = useMemo(() => {
    return HOURLY_FRAMES.map(frame => {
      const players: BattleRegistryEntry[] = [];
      entries.forEach(e => {
        const covered = getEntrySlotIndices(e);
        if (frame.slots.some(si => covered.has(si))) players.push(e);
      });
      players.sort(sortPlayers);
      return { ...frame, count: players.length, players };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  const maxHourlyCount = useMemo(() => Math.max(1, ...hourlyData.map(h => h.count)), [hourlyData]);

  // Players per alliance
  const alliancePlayers = useMemo(() => {
    const map: Record<string, BattleRegistryEntry[]> = {};
    entries.forEach(e => {
      if (!map[e.alliance_tag]) map[e.alliance_tag] = [];
      map[e.alliance_tag]!.push(e);
    });
    Object.values(map).forEach(arr => arr.sort(sortPlayers));
    return map;
  }, [entries]);

  // Troop distribution with players per combo (merged roster)
  const troopDistribution = useMemo(() => {
    const dist: Record<TroopType, { combos: { label: string; count: number; players: BattleRegistryEntry[] }[]; total: number }> = {
      infantry: { combos: [], total: 0 },
      cavalry: { combos: [], total: 0 },
      archers: { combos: [], total: 0 },
    };
    entries.forEach(e => {
      TROOP_TYPES.forEach(type => {
        const tier = e[`${type}_tier` as keyof BattleRegistryEntry] as number | null;
        if (tier != null) dist[type].total++;
      });
    });
    TROOP_TYPES.forEach(type => {
      const comboMap: Record<string, BattleRegistryEntry[]> = {};
      entries.forEach(e => {
        const tier = e[`${type}_tier` as keyof BattleRegistryEntry] as number | null;
        const tg = e[`${type}_tg` as keyof BattleRegistryEntry] as number | null;
        if (tier != null) {
          const label = tg != null ? `T${tier}/TG${tg}` : `T${tier}`;
          if (!comboMap[label]) comboMap[label] = [];
          comboMap[label].push(e);
        }
      });
      dist[type].combos = Object.entries(comboMap)
        .map(([label, players]) => {
          players.sort(sortPlayers);
          return { label, count: players.length, players };
        })
        .sort((a, b) => sortCombosDesc(a.label, b.label));
    });
    return dist;
  }, [entries]);

  const allianceDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    entries.forEach(e => { dist[e.alliance_tag] = (dist[e.alliance_tag] || 0) + 1; });
    return Object.entries(dist).sort((a, b) => b[1] - a[1]);
  }, [entries]);

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

  const toggleTroopCombo = (key: string) => {
    setExpandedTroopCombos(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleExpandAllTime = () => {
    const all = hourlyData.filter(h => h.count > 0).map(h => h.label);
    setExpandedTimeFrames(prev => prev.size >= all.length ? new Set() : new Set(all));
  };
  const toggleExpandAllTroops = () => {
    const all = TROOP_TYPES.flatMap(type => troopDistribution[type].combos.map(c => `${type}-${c.label}`));
    setExpandedTroopCombos(prev => prev.size >= all.length ? new Set() : new Set(all));
  };
  const toggleExpandAllAlliances = () => {
    const all = allianceDistribution.map(([tag]) => tag);
    setExpandedAlliances(prev => prev.size >= all.length ? new Set() : new Set(all));
  };
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
              {manualTimeSlots.map((slot, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ color: colors.textMuted, fontSize: '0.65rem', fontWeight: 600, width: '16px', flexShrink: 0 }}>{idx + 1}.</span>
                  <select value={slot.from} onChange={e => { updateManualSlot(idx, 'from', e.target.value); if (TIME_SLOTS.indexOf(e.target.value) > TIME_SLOTS.indexOf(slot.to)) updateManualSlot(idx, 'to', e.target.value); }}
                    style={{ flex: 1, padding: '0.4rem 0.5rem', backgroundColor: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text, fontSize: '0.75rem', cursor: 'pointer', boxSizing: 'border-box' }}>
                    {TIME_SLOTS.map(s => <option key={s} value={s}>{s} UTC</option>)}
                  </select>
                  <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>→</span>
                  <select value={slot.to} onChange={e => updateManualSlot(idx, 'to', e.target.value)}
                    style={{ flex: 1, padding: '0.4rem 0.5rem', backgroundColor: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text, fontSize: '0.75rem', cursor: 'pointer', boxSizing: 'border-box' }}>
                    {TIME_SLOTS.filter((_, i) => i >= TIME_SLOTS.indexOf(slot.from)).map(s => <option key={s} value={s}>{s} UTC</option>)}
                  </select>
                  {manualTimeSlots.length > 1 && (
                    <button onClick={() => removeManualSlot(idx)}
                      style={{ padding: '0.25rem 0.4rem', borderRadius: '4px', border: `1px solid ${colors.error}40`, backgroundColor: 'transparent', color: colors.error, fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer' }}>
                      {t('battleRegistry.removeSlot', 'Remove')}
                    </button>
                  )}
                </div>
              ))}
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

        {/* ─── Settings (Webhook, etc.) ────────────────────────────────── */}
        {isEditorOrCoEditor && (
          <div style={cardStyle}>
            <button onClick={() => setShowSettings(!showSettings)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: 'none', color: colors.textSecondary, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', padding: 0, width: '100%' }}>
              <span style={{ transition: 'transform 0.2s', transform: showSettings ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' }}>▶</span>
              ⚙️ {t('battleRegistry.settings', 'Settings')}
            </button>
            {showSettings && (
              <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div>
                  <label style={{ color: colors.textSecondary, fontSize: '0.7rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>🔔 {t('battleRegistry.discordWebhook', 'Discord Webhook URL (optional)')}</label>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <input type="url" value={webhookInput} onChange={e => setWebhookInput(e.target.value)}
                      placeholder="https://discord.com/api/webhooks/..."
                      style={{ flex: 1, padding: '0.4rem 0.6rem', backgroundColor: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text, fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }} />
                    <button onClick={() => updateWebhookUrl(webhookInput)} disabled={webhookInput === (registry.discord_webhook_url || '')}
                      style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', border: `1px solid ${webhookInput !== (registry.discord_webhook_url || '') ? '#22c55e40' : colors.border}`, backgroundColor: webhookInput !== (registry.discord_webhook_url || '') ? '#22c55e15' : 'transparent', color: webhookInput !== (registry.discord_webhook_url || '') ? '#22c55e' : colors.textMuted, fontSize: '0.75rem', fontWeight: 600, cursor: webhookInput !== (registry.discord_webhook_url || '') ? 'pointer' : 'default' }}>
                      {t('battleRegistry.save', 'Save')}
                    </button>
                  </div>
                  <p style={{ color: colors.textMuted, fontSize: '0.6rem', marginTop: '0.2rem' }}>{t('battleRegistry.discordWebhookDesc', 'Get notified in Discord when players register, registry is locked, etc.')}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Time Availability Distribution (hourly frames, collapsible) ── */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h3 style={{ color: colors.text, fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>🕐 {t('battleRegistry.timeDistribution', 'Time Availability Distribution')}</h3>
            {entries.length > 0 && (
              <button onClick={toggleExpandAllTime} style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', border: `1px solid ${colors.border}`, backgroundColor: 'transparent', color: colors.textMuted, fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer', minHeight: '32px' }}>
                {expandedTimeFrames.size > 0 ? t('battleRegistry.collapseAll', 'Collapse All') : t('battleRegistry.expandAll', 'Expand All')}
              </button>
            )}
          </div>
          {entries.length === 0 ? (
            <p style={{ color: colors.textMuted, fontSize: '0.8rem' }}>{t('battleRegistry.noEntriesYet', 'No registrations yet.')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              {hourlyData.map((frame, fi) => {
                const pct = maxHourlyCount > 0 ? (frame.count / maxHourlyCount) * 100 : 0;
                const isExpanded = expandedTimeFrames.has(frame.label);
                return (
                  <div key={fi}>
                    <button
                      onClick={() => { if (frame.count > 0) setExpandedTimeFrames(prev => { const n = new Set(prev); if (n.has(frame.label)) n.delete(frame.label); else n.add(frame.label); return n; }); }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.5rem',
                        borderRadius: '6px', border: `1px solid ${isExpanded ? '#22c55e30' : 'transparent'}`,
                        backgroundColor: isExpanded ? '#22c55e08' : 'transparent',
                        cursor: frame.count > 0 ? 'pointer' : 'default', transition: 'all 0.15s',
                      }}
                    >
                      {frame.count > 0 && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5"
                          style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }}>
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      )}
                      <span style={{ color: colors.textSecondary, fontSize: '0.75rem', fontWeight: 600, width: '100px', textAlign: 'right', flexShrink: 0 }}>{frame.label}</span>
                      <div style={{ flex: 1, height: '20px', backgroundColor: colors.bg, borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, backgroundColor: frame.count > 0 ? '#22c55e' : 'transparent', borderRadius: '4px', transition: 'width 0.3s ease', minWidth: frame.count > 0 ? '2px' : '0' }} />
                      </div>
                      <span style={{ color: frame.count > 0 ? '#22c55e' : colors.textMuted, fontSize: '0.75rem', fontWeight: 600, width: '24px', textAlign: 'right', flexShrink: 0 }}>{frame.count}</span>
                    </button>
                    {/* Expanded table: #, Alliance, Username, Troop Tier/TG */}
                    {isExpanded && frame.players.length > 0 && (
                      <div style={{ padding: '0.3rem 0 0.3rem 1.2rem', overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                          <tbody>
                            {frame.players.map((p, pi) => {
                              const maxT = Math.max(p.infantry_tier ?? 0, p.cavalry_tier ?? 0, p.archers_tier ?? 0);
                              const maxTg = Math.max(p.infantry_tg ?? -1, p.cavalry_tg ?? -1, p.archers_tg ?? -1);
                              return (
                                <tr key={p.id}>
                                  <td style={{ padding: '0.2rem 0.3rem', color: colors.textMuted, textAlign: 'center', width: '28px', fontSize: '0.65rem' }}>{pi + 1}</td>
                                  <td style={{ padding: '0.2rem 0.3rem', color: '#a855f7', fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap' }}>[{p.alliance_tag}]</td>
                                  <td style={{ padding: '0.2rem 0.3rem', color: colors.text, textAlign: 'left' }}>{p.username}</td>
                                  <td style={{ padding: '0.2rem 0.3rem', color: colors.textMuted, textAlign: 'center', fontSize: '0.65rem', whiteSpace: 'nowrap' }}>
                                    {maxT > 0 ? `T${maxT}${maxTg >= 0 ? `/TG${maxTg}` : ''}` : '—'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── Troop Level Distribution (expandable bars with players) ─── */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h3 style={{ color: colors.text, fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>🗡️ {t('battleRegistry.troopDistribution', 'Troop Level Distribution')}</h3>
            {entries.length > 0 && (
              <button onClick={toggleExpandAllTroops} style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', border: `1px solid ${colors.border}`, backgroundColor: 'transparent', color: colors.textMuted, fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer', minHeight: '32px' }}>
                {expandedTroopCombos.size > 0 ? t('battleRegistry.collapseAll', 'Collapse All') : t('battleRegistry.expandAll', 'Expand All')}
              </button>
            )}
          </div>
          {entries.length === 0 ? (
            <p style={{ color: colors.textMuted, fontSize: '0.8rem' }}>{t('battleRegistry.noEntriesYet', 'No registrations yet.')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {TROOP_TYPES.map(type => {
                const data = troopDistribution[type];
                if (data.total === 0) return null;
                const maxComboCount = Math.max(1, ...data.combos.map(c => c.count));
                return (
                  <div key={type} style={{ padding: '0.75rem', borderRadius: '8px', backgroundColor: `${TROOP_COLORS[type]}06`, border: `1px solid ${TROOP_COLORS[type]}20` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: TROOP_COLORS[type], fontSize: '0.85rem', fontWeight: 700 }}>{TROOP_LABELS[type]}</span>
                      <span style={{ color: colors.textMuted, fontSize: '0.7rem' }}>{data.total} {t('battleRegistry.players', 'players')}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {data.combos.map(combo => {
                        const comboKey = `${type}-${combo.label}`;
                        const isExpanded = expandedTroopCombos.has(comboKey);
                        return (
                          <div key={comboKey}>
                            <button
                              onClick={() => toggleTroopCombo(comboKey)}
                              style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.5rem',
                                borderRadius: '6px', border: `1px solid ${isExpanded ? TROOP_COLORS[type] + '30' : 'transparent'}`,
                                backgroundColor: isExpanded ? `${TROOP_COLORS[type]}08` : 'transparent',
                                cursor: 'pointer', transition: 'all 0.15s',
                              }}
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={TROOP_COLORS[type]} strokeWidth="2.5"
                                style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }}>
                                <path d="M9 18l6-6-6-6" />
                              </svg>
                              <span style={{ color: colors.textSecondary, fontSize: '0.7rem', width: isMobile ? '60px' : '70px', textAlign: 'right', flexShrink: 0, fontWeight: 600 }}>{combo.label}</span>
                              <div style={{ flex: 1, height: '14px', backgroundColor: colors.bg, borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${(combo.count / maxComboCount) * 100}%`, backgroundColor: TROOP_COLORS[type], borderRadius: '3px', opacity: 0.7, minWidth: '2px' }} />
                              </div>
                              <span style={{ color: TROOP_COLORS[type], fontSize: '0.7rem', fontWeight: 600, width: '18px', textAlign: 'right', flexShrink: 0 }}>{combo.count}</span>
                            </button>
                            {/* Expanded table: #, Alliance, Username, Time Slots */}
                            {isExpanded && (
                              <div style={{ padding: '0.25rem 0 0.25rem 1.2rem', overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                                  <tbody>
                                    {combo.players.map((p, pi) => {
                                      const timeLabel = getEntryTimeSlots(p).map(s => s.from === s.to ? s.from : `${s.from}–${s.to}`).join(', ');
                                      return (
                                        <tr key={p.id}>
                                          <td style={{ padding: '0.2rem 0.3rem', color: colors.textMuted, textAlign: 'center', width: '28px', fontSize: '0.65rem' }}>{pi + 1}</td>
                                          <td style={{ padding: '0.2rem 0.3rem', color: '#a855f7', fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap' }}>[{p.alliance_tag}]</td>
                                          <td style={{ padding: '0.2rem 0.3rem', color: colors.text, textAlign: 'left' }}>{p.username}</td>
                                          <td style={{ padding: '0.2rem 0.3rem', color: colors.textMuted, textAlign: 'center', fontSize: '0.65rem', whiteSpace: 'nowrap' }}>{timeLabel}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── Alliance Breakdown (collapsible) ─────────────────────── */}
        {allianceDistribution.length > 0 && (
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <h3 style={{ color: colors.text, fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>🏰 {t('battleRegistry.allianceBreakdown', 'Alliance Breakdown')}</h3>
              <button onClick={toggleExpandAllAlliances} style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', border: `1px solid ${colors.border}`, backgroundColor: 'transparent', color: colors.textMuted, fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer', minHeight: '32px' }}>
                {expandedAlliances.size > 0 ? t('battleRegistry.collapseAll', 'Collapse All') : t('battleRegistry.expandAll', 'Expand All')}
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              {allianceDistribution.map(([tag, count]) => {
                const maxAllianceCount = allianceDistribution[0]?.[1] ?? 1;
                const pct = maxAllianceCount > 0 ? (count / maxAllianceCount) * 100 : 0;
                const isExpanded = expandedAlliances.has(tag);
                const players = alliancePlayers[tag] || [];
                return (
                  <div key={tag}>
                    <button
                      onClick={() => setExpandedAlliances(prev => { const n = new Set(prev); if (n.has(tag)) n.delete(tag); else n.add(tag); return n; })}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.6rem',
                        borderRadius: '6px', border: `1px solid ${isExpanded ? '#a855f730' : 'transparent'}`,
                        backgroundColor: isExpanded ? '#a855f708' : 'transparent',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2.5"
                        style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }}>
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                      <span style={{ color: '#a855f7', fontSize: '0.8rem', fontWeight: 700, width: '40px', textAlign: 'left', flexShrink: 0, letterSpacing: '0.05em' }}>[{tag}]</span>
                      <div style={{ flex: 1, height: '20px', backgroundColor: colors.bg, borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, backgroundColor: '#a855f7', borderRadius: '4px', opacity: 0.5, transition: 'width 0.3s ease', minWidth: '2px' }} />
                      </div>
                      <span style={{ color: '#a855f7', fontSize: '0.75rem', fontWeight: 600, width: '24px', textAlign: 'right', flexShrink: 0 }}>{count}</span>
                    </button>
                    {/* Expanded table: #, Username, Troop Tier/TG, Time Slots */}
                    {isExpanded && players.length > 0 && (
                      <div style={{ padding: '0.3rem 0 0.3rem 1.2rem', overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                          <tbody>
                            {players.map((p, pi) => {
                              const maxT = Math.max(p.infantry_tier ?? 0, p.cavalry_tier ?? 0, p.archers_tier ?? 0);
                              const maxTg = Math.max(p.infantry_tg ?? -1, p.cavalry_tg ?? -1, p.archers_tg ?? -1);
                              const timeLabel = getEntryTimeSlots(p).map(s => s.from === s.to ? s.from : `${s.from}–${s.to}`).join(', ');
                              return (
                                <tr key={p.id}>
                                  <td style={{ padding: '0.2rem 0.3rem', color: colors.textMuted, textAlign: 'center', width: '28px', fontSize: '0.65rem' }}>{pi + 1}</td>
                                  <td style={{ padding: '0.2rem 0.3rem', color: colors.text, fontWeight: 600, textAlign: 'left' }}>{p.username}</td>
                                  <td style={{ padding: '0.2rem 0.3rem', color: colors.textMuted, textAlign: 'center', fontSize: '0.65rem', whiteSpace: 'nowrap' }}>
                                    {maxT > 0 ? `T${maxT}${maxTg >= 0 ? `/TG${maxTg}` : ''}` : '—'}
                                  </td>
                                  <td style={{ padding: '0.2rem 0.3rem', color: colors.textMuted, textAlign: 'center', fontSize: '0.65rem', whiteSpace: 'nowrap' }}>{timeLabel}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
          <Link to="/tools/battle-registry" style={{ color: '#22d3ee', textDecoration: 'none', fontSize: isMobile ? '0.85rem' : '0.8rem', padding: '0.5rem', minHeight: '44px', display: 'flex', alignItems: 'center' }}>← {t('battleRegistry.backToRegistries', 'All Registries')}</Link>
          <Link to="/tools" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: isMobile ? '0.85rem' : '0.8rem', padding: '0.5rem', minHeight: '44px', display: 'flex', alignItems: 'center' }}>← {t('battleRegistry.backToTools', 'Back to Tools')}</Link>
        </div>
      </div>
    </div>
  );
};

export default BattleRegistryDashboard;
