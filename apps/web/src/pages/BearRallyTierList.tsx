import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useMetaTags } from '../hooks/useMetaTags';
import { neonGlow, FONT_DISPLAY } from '../utils/styles';
import { logger } from '../utils/logger';
import { triggerHaptic } from '../hooks/useHaptic';
import { useTranslation } from 'react-i18next';
import {
  getEGBonusDisplay,
  getHeroesByTroopType,
  getPlayerDisplayStats,
  calculateBearScore,
  assignBearTier,
  isPlayerComplete,
  BEAR_TIER_COLORS,
  BEAR_LISTS_INDEX_KEY,
  BEAR_LIST_DATA_PREFIX,
  BEAR_STORAGE_KEY_LEGACY,
  BEAR_ACTIVE_LIST_KEY,
  BEAR_DISCLAIMER_KEY,
  BEAR_DISCLAIMER_DEFAULT,
  getDefaultListName,
  type BearPlayerEntry,
  type BearListMeta,
  type BearTier,
} from '../data/bearHuntData';
import { useAllianceCenter } from '../hooks/useAllianceCenter';
import BearBulkInput from '../components/bear/BearBulkInput';
import BearBulkEdit from '../components/bear/BearBulkEdit';

// ─── Constants ──────────────────────────────────────────────────────────────

const ACCENT = '#3b82f6'; // Blue theme for alliance tools
const ACCENT_LIGHT = '#60a5fa';

const EG_LEVELS = Array.from({ length: 11 }, (_, i) => i);

const infantryHeroes = getHeroesByTroopType('infantry');
const cavalryHeroes = getHeroesByTroopType('cavalry');
const archerHeroes = getHeroesByTroopType('archer');

// ─── Helper: generate unique ID ─────────────────────────────────────────────

const genId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// ─── Helper: normalize Unicode for fuzzy name search ─────────────────────────
// Converts special Unicode chars (small caps, fullwidth, etc.) to ASCII
// so typing "AHK" matches "ᴀʜᴋɪʀᴀ"
const UNICODE_TO_ASCII: Record<string, string> = {
  // Small caps
  '\u1D00': 'a', '\u0299': 'b', '\u1D04': 'c', '\u1D05': 'd', '\u1D07': 'e',
  '\u0493': 'f', '\u0262': 'g', '\u029C': 'h', '\u026A': 'i', '\u1D0A': 'j',
  '\u1D0B': 'k', '\u029F': 'l', '\u1D0D': 'm', '\u0274': 'n', '\u1D0F': 'o',
  '\u1D18': 'p', '\u01EB': 'q', '\u0280': 'r', '\u0455': 's', '\u1D1B': 't',
  '\u1D1C': 'u', '\u1D20': 'v', '\u1D21': 'w', '\u0263': 'x', '\u028F': 'y',
  '\u1D22': 'z',
  // Circled, subscript, superscript — handled by NFKD
  // Fullwidth — handled by NFKD
};

function normalizeForSearch(str: string): string {
  // Step 1: map known special chars
  let result = '';
  for (const ch of str) {
    result += UNICODE_TO_ASCII[ch] ?? ch;
  }
  // Step 2: NFKD decomposition (handles fullwidth, circled, superscript, etc.)
  result = result.normalize('NFKD');
  // Step 3: strip combining marks (accents, diacritics)
  result = result.replace(/[\u0300-\u036f]/g, '');
  return result.toLowerCase();
}

// ─── Multi-List Storage Helpers ──────────────────────────────────────────────

function loadListsIndex(): BearListMeta[] {
  try {
    const raw = localStorage.getItem(BEAR_LISTS_INDEX_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveListsIndex(lists: BearListMeta[]) {
  localStorage.setItem(BEAR_LISTS_INDEX_KEY, JSON.stringify(lists));
}

function loadListPlayers(listId: string): BearPlayerEntry[] {
  try {
    const raw = localStorage.getItem(BEAR_LIST_DATA_PREFIX + listId);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveListPlayers(listId: string, players: BearPlayerEntry[]) {
  localStorage.setItem(BEAR_LIST_DATA_PREFIX + listId, JSON.stringify(players));
}

function deleteListData(listId: string) {
  localStorage.removeItem(BEAR_LIST_DATA_PREFIX + listId);
}

function getActiveListId(): string | null {
  return localStorage.getItem(BEAR_ACTIVE_LIST_KEY);
}

function setActiveListId(id: string) {
  localStorage.setItem(BEAR_ACTIVE_LIST_KEY, id);
}

/** Migrate legacy single-list storage → multi-list on first load */
function migrateLegacyIfNeeded(): { lists: BearListMeta[]; activeId: string | null } {
  const existing = loadListsIndex();
  if (existing.length > 0) return { lists: existing, activeId: getActiveListId() };

  // Check for legacy data
  try {
    const legacyRaw = localStorage.getItem(BEAR_STORAGE_KEY_LEGACY);
    if (legacyRaw) {
      const legacyPlayers: BearPlayerEntry[] = JSON.parse(legacyRaw);
      if (legacyPlayers.length > 0) {
        const id = genId();
        const meta: BearListMeta = {
          id,
          name: getDefaultListName(),
          createdAt: new Date().toISOString(),
          playerCount: legacyPlayers.length,
        };
        saveListPlayers(id, legacyPlayers);
        saveListsIndex([meta]);
        setActiveListId(id);
        localStorage.removeItem(BEAR_STORAGE_KEY_LEGACY);
        return { lists: [meta], activeId: id };
      }
    }
  } catch { /* ignore */ }

  return { lists: [], activeId: null };
}

// ─── Empty Form State ───────────────────────────────────────────────────────

interface FormState {
  playerName: string;
  infantryHero: string;
  infantryEGLevel: number;
  infantryAttack: string;
  infantryLethality: string;
  cavalryHero: string;
  cavalryEGLevel: number;
  cavalryAttack: string;
  cavalryLethality: string;
  archerHero: string;
  archerEGLevel: number;
  archerAttack: string;
  archerLethality: string;
}

const emptyForm: FormState = {
  playerName: '',
  infantryHero: '',
  infantryEGLevel: -1,
  infantryAttack: '',
  infantryLethality: '',
  cavalryHero: '',
  cavalryEGLevel: -1,
  cavalryAttack: '',
  cavalryLethality: '',
  archerHero: '',
  archerEGLevel: -1,
  archerAttack: '',
  archerLethality: '',
};

// ─── Tier Badge Component ───────────────────────────────────────────────────

const TierBadge: React.FC<{ tier: BearTier; size?: 'sm' | 'md' }> = ({ tier, size = 'md' }) => {
  const color = BEAR_TIER_COLORS[tier];
  const isSm = size === 'sm';
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: isSm ? '28px' : '36px',
      height: isSm ? '22px' : '28px',
      padding: `0 ${isSm ? '0.35rem' : '0.5rem'}`,
      backgroundColor: `${color}18`,
      border: `1px solid ${color}40`,
      borderRadius: '6px',
      color,
      fontSize: isSm ? '0.65rem' : '0.75rem',
      fontWeight: 800,
      letterSpacing: '0.05em',
      fontFamily: FONT_DISPLAY,
    }}>
      {tier}
    </span>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────

const BearRallyTierList: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('bearRally.pageTitle', 'Bear Rally Tier List'));
  useMetaTags({
    title: 'Bear Rally Tier List — Kingshot Atlas',
    description: 'Rank your alliance players by Bear Hunt rally power. Input hero stats, get Bear Scores, see who hits hardest.',
  });
  const isMobile = useIsMobile();

  // ── Alliance Roster (optional — works without auth) ──
  const ac = useAllianceCenter();
  const rosterNames = useMemo(() =>
    ac.members.map(m => m.player_name).filter(Boolean).sort((a, b) => a.localeCompare(b)),
    [ac.members]
  );
  // Edit access: owner/manager/delegate can edit; member sees read-only; no alliance = full access (local tool)
  const canEdit = !ac.alliance || ac.canManage || ac.accessRole === 'delegate';

  // ── Multi-list state ──
  const [listsIndex, setListsIndex] = useState<BearListMeta[]>([]);
  const [activeListId, setActiveListIdState] = useState<string | null>(null);
  const [players, setPlayers] = useState<BearPlayerEntry[]>([]);
  const [editingListName, setEditingListName] = useState<string | null>(null);
  const [listNameDraft, setListNameDraft] = useState('');
  const [showListMenu, setShowListMenu] = useState(false);
  const [deleteListConfirm, setDeleteListConfirm] = useState<string | null>(null);
  const [showNewListPrompt, setShowNewListPrompt] = useState(false);
  const [newListNameDraft, setNewListNameDraft] = useState('');
  const listMenuRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const tierListRef = useRef<HTMLDivElement>(null);
  const shareCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [sharePreview, setSharePreview] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // ── Form state ──
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showBulkInput, setShowBulkInput] = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const nameInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // ── Initialize multi-list storage (migrate legacy if needed) ──
  useEffect(() => {
    const { lists, activeId } = migrateLegacyIfNeeded();
    setListsIndex(lists);
    if (activeId && lists.some(l => l.id === activeId)) {
      setActiveListIdState(activeId);
      setPlayers(loadListPlayers(activeId));
    } else if (lists.length > 0 && lists[0]) {
      setActiveListIdState(lists[0].id);
      setActiveListId(lists[0].id);
      setPlayers(loadListPlayers(lists[0].id));
    }
    // Mark init complete so persist effect won't overwrite localStorage with []
    initializedRef.current = true;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Filtered roster suggestions based on current input (Unicode-normalized for fuzzy matching)
  const nameSuggestions = useMemo(() => {
    if (!form.playerName.trim() || rosterNames.length === 0) return [];
    const q = normalizeForSearch(form.playerName.trim());
    return rosterNames.filter(n => {
      const normalized = normalizeForSearch(n);
      return normalized.includes(q) && normalized !== q;
    }).slice(0, 8);
  }, [form.playerName, rosterNames]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
        nameInputRef.current && !nameInputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Persist players to active list (guarded: skip until init is done)
  useEffect(() => {
    if (!activeListId || !initializedRef.current) return;
    saveListPlayers(activeListId, players);
    // Update player count in index
    setListsIndex(prev => {
      const updated = prev.map(l => l.id === activeListId ? { ...l, playerCount: players.length } : l);
      saveListsIndex(updated);
      return updated;
    });
  }, [players, activeListId]);

  // Close list menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (listMenuRef.current && !listMenuRef.current.contains(e.target as Node)) {
        setShowListMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── List Management Handlers ──
  const getNextMonthName = useCallback(() => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return next.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, []);

  const openNewListPrompt = useCallback(() => {
    setNewListNameDraft(getNextMonthName());
    setShowNewListPrompt(true);
    setShowListMenu(false);
  }, [getNextMonthName]);

  const handleCreateList = useCallback((name?: string) => {
    const listName = (name ?? getNextMonthName()).trim();
    if (!listName) return;
    const id = genId();

    // Auto-populate with roster members (empty stats, score 0, tier D)
    const initialPlayers: BearPlayerEntry[] = rosterNames.map(playerName => ({
      id: genId(),
      playerName,
      infantryHero: '',
      infantryEGLevel: 0,
      infantryAttack: 0,
      infantryLethality: 0,
      cavalryHero: '',
      cavalryEGLevel: 0,
      cavalryAttack: 0,
      cavalryLethality: 0,
      archerHero: '',
      archerEGLevel: 0,
      archerAttack: 0,
      archerLethality: 0,
      bearScore: 0,
      tier: 'D' as BearTier,
    }));

    const meta: BearListMeta = {
      id,
      name: listName,
      createdAt: new Date().toISOString(),
      playerCount: initialPlayers.length,
    };
    setListsIndex(prev => {
      const updated = [...prev, meta];
      saveListsIndex(updated);
      return updated;
    });
    saveListPlayers(id, initialPlayers);
    setActiveListIdState(id);
    setActiveListId(id);
    setPlayers(initialPlayers);
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setShowListMenu(false);
    setShowNewListPrompt(false);
  }, [getNextMonthName, rosterNames]);

  const handleSwitchList = useCallback((listId: string) => {
    if (listId === activeListId) return;
    setActiveListIdState(listId);
    setActiveListId(listId);
    setPlayers(loadListPlayers(listId));
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setShowListMenu(false);
  }, [activeListId]);

  const handleRenameList = useCallback((listId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setListsIndex(prev => {
      const updated = prev.map(l => l.id === listId ? { ...l, name: trimmed } : l);
      saveListsIndex(updated);
      return updated;
    });
    setEditingListName(null);
  }, []);

  const handleDeleteList = useCallback((listId: string) => {
    deleteListData(listId);
    setListsIndex(prev => {
      const updated = prev.filter(l => l.id !== listId);
      saveListsIndex(updated);
      // Switch to another list or clear
      if (activeListId === listId) {
        if (updated.length > 0 && updated[0]) {
          setActiveListIdState(updated[0].id);
          setActiveListId(updated[0].id);
          setPlayers(loadListPlayers(updated[0].id));
        } else {
          setActiveListIdState(null);
          setPlayers([]);
        }
      }
      return updated;
    });
    setDeleteListConfirm(null);
    setShowListMenu(false);
    setShowForm(false);
    setEditingId(null);
  }, [activeListId]);

  // ── Sorted & ranked players (only complete data gets ranked) ──
  const { rankedPlayers, incompletePlayers } = useMemo(() => {
    const complete = players.filter(isPlayerComplete);
    const incomplete = players.filter(p => !isPlayerComplete(p));
    const ranked = [...complete].sort((a, b) => b.bearScore - a.bearScore).map((p, i) => ({ ...p, rank: i + 1 }));
    return { rankedPlayers: ranked, incompletePlayers: incomplete };
  }, [players]);

  // ── Unscored roster members (alliance members not yet in this list) ──
  const unscoredRosterMembers = useMemo(() => {
    if (rosterNames.length === 0) return [];
    const playerNamesLower = new Set(players.map(p => p.playerName.toLowerCase()));
    return rosterNames.filter(n => !playerNamesLower.has(n.toLowerCase()));
  }, [rosterNames, players]);

  // ── Form Handlers ──
  const updateForm = useCallback((field: keyof FormState, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setFormError('');
  }, []);

  const handleSubmit = useCallback(() => {
    if (!form.playerName.trim()) {
      setFormError(t('bearRally.errorName', 'Player name is required.'));
      return;
    }
    // Validate all heroes selected
    if (!form.infantryHero || !form.cavalryHero || !form.archerHero) {
      setFormError(t('bearRally.errorHeroes', 'All three heroes must be selected.'));
      return;
    }
    // Validate all EG levels selected
    if (form.infantryEGLevel < 0 || form.cavalryEGLevel < 0 || form.archerEGLevel < 0) {
      setFormError(t('bearRally.errorEG', 'All Exclusive Gear levels must be selected.'));
      return;
    }
    // Validate all stat fields filled
    if (!form.infantryAttack || !form.infantryLethality || !form.cavalryAttack || !form.cavalryLethality || !form.archerAttack || !form.archerLethality) {
      setFormError(t('bearRally.errorStats', 'All Attack and Lethality values are required.'));
      return;
    }

    const infAtk = parseFloat(form.infantryAttack) || 0;
    const infLeth = parseFloat(form.infantryLethality) || 0;
    const cavAtk = parseFloat(form.cavalryAttack) || 0;
    const cavLeth = parseFloat(form.cavalryLethality) || 0;
    const archAtk = parseFloat(form.archerAttack) || 0;
    const archLeth = parseFloat(form.archerLethality) || 0;

    const bearScore = calculateBearScore(
      form.infantryHero, form.infantryEGLevel, infAtk, infLeth,
      form.cavalryHero, form.cavalryEGLevel, cavAtk, cavLeth,
      form.archerHero, form.archerEGLevel, archAtk, archLeth,
    );

    const entry: Omit<BearPlayerEntry, 'tier'> & { tier: BearTier } = {
      id: editingId || genId(),
      playerName: form.playerName.trim(),
      infantryHero: form.infantryHero,
      infantryEGLevel: form.infantryEGLevel,
      infantryAttack: infAtk,
      infantryLethality: infLeth,
      cavalryHero: form.cavalryHero,
      cavalryEGLevel: form.cavalryEGLevel,
      cavalryAttack: cavAtk,
      cavalryLethality: cavLeth,
      archerHero: form.archerHero,
      archerEGLevel: form.archerEGLevel,
      archerAttack: archAtk,
      archerLethality: archLeth,
      bearScore,
      tier: 'D', // placeholder — recalculated below with all scores
    };

    setPlayers(prev => {
      let updated: BearPlayerEntry[];
      if (editingId) {
        updated = prev.map(p => p.id === editingId ? entry : p);
      } else {
        updated = [...prev, entry];
      }
      // Recalculate tiers only for complete players using percentile-based assignment
      const completePlayers = updated.filter(isPlayerComplete);
      const allScores = completePlayers.map(p => p.bearScore);
      return updated.map(p => isPlayerComplete(p) ? { ...p, tier: assignBearTier(p.bearScore, allScores) } : p);
    });

    // Sync new name to alliance roster if not already there
    const trimmedName = form.playerName.trim();
    if (
      !editingId &&
      ac.alliance &&
      ac.canManage &&
      trimmedName &&
      !rosterNames.some(n => n.toLowerCase() === trimmedName.toLowerCase())
    ) {
      ac.addMember({ player_name: trimmedName }).catch(() => { /* silent — roster sync is best-effort */ });
    }

    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setFormError('');
  }, [form, editingId, t, ac, rosterNames]);

  const handleEdit = useCallback((player: BearPlayerEntry) => {
    setForm({
      playerName: player.playerName,
      infantryHero: player.infantryHero,
      infantryEGLevel: player.infantryEGLevel,
      infantryAttack: player.infantryAttack.toString(),
      infantryLethality: player.infantryLethality.toString(),
      cavalryHero: player.cavalryHero,
      cavalryEGLevel: player.cavalryEGLevel,
      cavalryAttack: player.cavalryAttack.toString(),
      cavalryLethality: player.cavalryLethality.toString(),
      archerHero: player.archerHero,
      archerEGLevel: player.archerEGLevel,
      archerAttack: player.archerAttack.toString(),
      archerLethality: player.archerLethality.toString(),
    });
    setEditingId(player.id);
    setShowForm(true);
    setFormError('');
  }, []);

  const handleDelete = useCallback((id: string) => {
    setPlayers(prev => {
      const remaining = prev.filter(p => p.id !== id);
      if (remaining.length === 0) return remaining;
      const completePlayers = remaining.filter(isPlayerComplete);
      const allScores = completePlayers.map(p => p.bearScore);
      return remaining.map(p => isPlayerComplete(p) ? { ...p, tier: assignBearTier(p.bearScore, allScores) } : p);
    });
    setDeleteConfirm(null);
    if (editingId === id) {
      setEditingId(null);
      setForm(emptyForm);
      setShowForm(false);
    }
  }, [editingId]);

  const handleCancelForm = useCallback(() => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setFormError('');
  }, []);

  const handleAddRosterMember = useCallback((name: string) => {
    setForm({ ...emptyForm, playerName: name });
    setEditingId(null);
    setShowForm(true);
    setShowBulkEdit(false);
    setFormError('');
  }, []);

  // ── Share handlers ──
  const captureScreenshot = useCallback(async (): Promise<HTMLCanvasElement | null> => {
    if (!tierListRef.current) return null;
    setIsCapturing(true);
    triggerHaptic('light');
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(tierListRef.current, {
        backgroundColor: '#0a0a0a',
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
      });
      shareCanvasRef.current = canvas;
      return canvas;
    } catch (error) {
      logger.error('Bear tier list screenshot failed:', error);
      return null;
    } finally {
      setIsCapturing(false);
    }
  }, []);

  const handleSharePreview = useCallback(async () => {
    const canvas = await captureScreenshot();
    if (canvas) {
      setSharePreview(canvas.toDataURL('image/png'));
      triggerHaptic('success');
    }
  }, [captureScreenshot]);

  const handleShareDownload = useCallback(async () => {
    let canvas = shareCanvasRef.current;
    if (!canvas) canvas = await captureScreenshot();
    if (!canvas) return;
    triggerHaptic('medium');
    const listName = listsIndex.find(l => l.id === activeListId)?.name ?? 'tier-list';
    const link = document.createElement('a');
    link.download = `bear-rally-${listName.replace(/\s+/g, '-').toLowerCase()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    setSharePreview(null);
  }, [captureScreenshot, listsIndex, activeListId]);

  const handleShareNative = useCallback(async () => {
    let canvas = shareCanvasRef.current;
    if (!canvas) canvas = await captureScreenshot();
    if (!canvas) return;
    triggerHaptic('medium');
    const listName = listsIndex.find(l => l.id === activeListId)?.name ?? 'tier-list';
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const shareText = `🐻 Bear Rally Tier List: ${listName}\n${rankedPlayers.length} ranked players\n\nView at ${window.location.href}`;
      if (navigator.share && navigator.canShare) {
        const file = new File([blob], `bear-rally-${listName.replace(/\s+/g, '-').toLowerCase()}.png`, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ title: `Bear Rally — ${listName}`, text: shareText, files: [file] });
            setSharePreview(null);
            return;
          } catch (err) {
            if ((err as Error).name !== 'AbortError') logger.error('Share failed:', err);
          }
        }
      }
      if (navigator.clipboard && 'write' in navigator.clipboard) {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          setSharePreview(null);
          shareCanvasRef.current = null;
          return;
        } catch (err) {
          logger.error('Clipboard write failed:', err);
        }
      }
      handleShareDownload();
    }, 'image/png');
  }, [captureScreenshot, listsIndex, activeListId, rankedPlayers.length, handleShareDownload]);

  const handleCopyLink = useCallback(() => {
    triggerHaptic('light');
    navigator.clipboard.writeText(window.location.href);
  }, []);

  const closeSharePreview = useCallback(() => {
    setSharePreview(null);
    shareCanvasRef.current = null;
  }, []);

  // ── Styles ──
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.6rem 0.75rem',
    backgroundColor: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '1rem',
    outline: 'none',
    transition: 'border-color 0.2s',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
    appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 0.75rem center',
    paddingRight: '2rem',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#9ca3af',
    marginBottom: '0.3rem',
    display: 'block',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  };

  // ── Hero Row Renderer (hero + gear per troop type) ──
  const renderHeroRow = (
    label: string,
    emoji: string,
    heroList: { name: string }[],
    heroKey: 'infantryHero' | 'cavalryHero' | 'archerHero',
    egKey: 'infantryEGLevel' | 'cavalryEGLevel' | 'archerEGLevel',
    accentHex: string,
  ) => (
    <div style={{
      backgroundColor: '#111111',
      borderRadius: '10px',
      border: `1px solid ${accentHex}20`,
      padding: isMobile ? '0.7rem' : '0.85rem',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.4rem',
        marginBottom: '0.5rem',
        fontSize: isMobile ? '0.8rem' : '0.85rem',
        fontWeight: 700, color: accentHex,
      }}>
        <span>{emoji}</span> {label}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        <div>
          <label style={labelStyle}>{t('bearRally.hero', 'Hero')} <span style={{ color: '#ef4444' }}>*</span></label>
          <select
            value={form[heroKey]}
            onChange={(e) => updateForm(heroKey, e.target.value)}
            style={{ ...selectStyle, ...(formError && !form[heroKey] ? { borderColor: '#ef444480' } : {}) }}
          >
            <option value="" disabled>{t('bearRally.selectHero', '— Select hero —')}</option>
            {heroList.map(h => (
              <option key={h.name} value={h.name}>{h.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            {t('bearRally.egLevel', 'Gear Level')} <span style={{ color: '#ef4444' }}>*</span>
            <span
              title={t('bearRally.egTooltip', 'Exclusive Gear (EG) — each hero\'s unique equipment that boosts specific stats. Levels range from 0 to 10.')}
              style={{ cursor: 'help', color: '#6b7280', fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '14px', height: '14px', borderRadius: '50%', border: '1px solid #4b5563', lineHeight: 1 }}
            >?</span>
          </label>
          <select
            value={form[egKey]}
            onChange={(e) => updateForm(egKey, parseInt(e.target.value))}
            style={{ ...selectStyle, ...(formError && form[egKey] < 0 ? { borderColor: '#ef444480' } : {}) }}
          >
            <option value={-1} disabled>{t('bearRally.selectEG', '— Select EG level —')}</option>
            {EG_LEVELS.map(lvl => (
              <option key={lvl} value={lvl}>
                Lv {lvl} ({getEGBonusDisplay(lvl)}%)
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );

  // ── Stats Row Renderer (attack + lethality per troop type) ──
  const renderStatsRow = (
    label: string,
    emoji: string,
    atkKey: 'infantryAttack' | 'cavalryAttack' | 'archerAttack',
    lethKey: 'infantryLethality' | 'cavalryLethality' | 'archerLethality',
    accentHex: string,
  ) => (
    <div style={{
      backgroundColor: '#111111',
      borderRadius: '10px',
      border: `1px solid ${accentHex}20`,
      padding: isMobile ? '0.7rem' : '0.85rem',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.4rem',
        marginBottom: '0.5rem',
        fontSize: isMobile ? '0.8rem' : '0.85rem',
        fontWeight: 700, color: accentHex,
      }}>
        <span>{emoji}</span> {label}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        <div>
          <label style={labelStyle}>{t('bearRally.attack', 'Attack %')} <span style={{ color: '#ef4444' }}>*</span></label>
          <input
            type="number"
            step="0.1"
            placeholder="e.g. 250"
            value={form[atkKey]}
            onChange={(e) => updateForm(atkKey, e.target.value)}
            style={{ ...inputStyle, ...(formError && !form[atkKey] ? { borderColor: '#ef444480' } : {}) }}
          />
        </div>
        <div>
          <label style={labelStyle}>{t('bearRally.lethality', 'Lethality %')} <span style={{ color: '#ef4444' }}>*</span></label>
          <input
            type="number"
            step="0.1"
            placeholder="e.g. 180"
            value={form[lethKey]}
            onChange={(e) => updateForm(lethKey, e.target.value)}
            style={{ ...inputStyle, ...(formError && !form[lethKey] ? { borderColor: '#ef444480' } : {}) }}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      {/* Header */}
      <div style={{
        padding: isMobile ? '1.5rem 1rem 1rem' : '2rem 2rem 1.25rem',
        textAlign: 'center',
        background: 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)',
      }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <h1 style={{
            fontSize: isMobile ? '1.5rem' : '2rem',
            fontWeight: 'bold',
            marginBottom: '0.5rem',
            fontFamily: FONT_DISPLAY,
          }}>
            <span style={{ color: '#fff' }}>{t('bearRally.title1', 'BEAR RALLY')}</span>
            <span style={{ ...neonGlow(ACCENT), marginLeft: '0.5rem' }}>{t('bearRally.title2', 'TIER LIST')}</span>
          </h1>
          <p style={{
            color: '#6b7280',
            fontSize: isMobile ? '0.8rem' : '0.85rem',
            maxWidth: '450px',
            margin: '0 auto',
          }}>
            {t('bearRally.subtitle', 'Rank your alliance by Bear Hunt rally power. Input scouted stats — Atlas handles the math.')}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: isMobile ? '0.75rem' : '1.5rem' }}>

        {/* List Selector */}
        <div style={{
          marginBottom: '1rem',
          padding: isMobile ? '0.75rem' : '0.85rem 1rem',
          backgroundColor: '#111111',
          borderRadius: '12px',
          border: '1px solid #2a2a2a',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap',
          position: 'relative',
        }} ref={listMenuRef}>
          <span style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            📋 {t('bearRally.listLabel', 'List')}:
          </span>

          {listsIndex.length === 0 ? (
            canEdit ? (
              showNewListPrompt ? (
                <form
                  onSubmit={(e) => { e.preventDefault(); handleCreateList(newListNameDraft); }}
                  style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}
                >
                  <input
                    autoFocus
                    value={newListNameDraft}
                    onChange={(e) => setNewListNameDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Escape') setShowNewListPrompt(false); }}
                    placeholder={t('bearRally.listNamePlaceholder', 'List name')}
                    style={{
                      padding: '0.3rem 0.5rem', backgroundColor: '#1a1a1a',
                      border: `1px solid ${ACCENT}50`, borderRadius: '6px',
                      color: '#fff', fontSize: '0.8rem', outline: 'none', width: '180px',
                    }}
                  />
                  <button type="submit" style={{
                    padding: '0.3rem 0.6rem', backgroundColor: ACCENT, border: 'none',
                    borderRadius: '6px', color: '#fff', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
                  }}>
                    {t('common.create', 'Create')}
                  </button>
                  <button type="button" onClick={() => setShowNewListPrompt(false)} style={{
                    background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.7rem',
                  }}>
                    {t('common.cancel', 'Cancel')}
                  </button>
                </form>
              ) : (
                <button
                  onClick={openNewListPrompt}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                    padding: '0.35rem 0.75rem', backgroundColor: `${ACCENT}20`,
                    border: `1px solid ${ACCENT}40`, borderRadius: '6px',
                    color: ACCENT, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  + {t('bearRally.createFirstList', 'Create First List')}
                </button>
              )
            ) : (
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                {t('bearRally.noListsYet', 'No tier lists created yet.')}
              </span>
            )
          ) : (
            <>
              {/* Active list name / selector */}
              {editingListName === activeListId ? (
                <form
                  onSubmit={(e) => { e.preventDefault(); if (activeListId) handleRenameList(activeListId, listNameDraft); }}
                  style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}
                >
                  <input
                    autoFocus
                    value={listNameDraft}
                    onChange={(e) => setListNameDraft(e.target.value)}
                    onBlur={() => { if (activeListId) handleRenameList(activeListId, listNameDraft); }}
                    style={{
                      padding: '0.3rem 0.5rem', backgroundColor: '#1a1a1a',
                      border: `1px solid ${ACCENT}50`, borderRadius: '6px',
                      color: '#fff', fontSize: '0.8rem', outline: 'none', width: '160px',
                    }}
                  />
                </form>
              ) : (
                <button
                  onClick={() => setShowListMenu(prev => !prev)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                    padding: '0.35rem 0.65rem', backgroundColor: '#1a1a1a',
                    border: '1px solid #333', borderRadius: '6px',
                    color: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                    maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {listsIndex.find(l => l.id === activeListId)?.name ?? '—'}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
                </button>
              )}

              {/* Rename button */}
              {canEdit && editingListName !== activeListId && activeListId && (
                <button
                  onClick={() => {
                    const current = listsIndex.find(l => l.id === activeListId);
                    setListNameDraft(current?.name ?? '');
                    setEditingListName(activeListId);
                  }}
                  title={t('bearRally.renameList', 'Rename list')}
                  style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '0.2rem', display: 'flex' }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
              )}

              {/* New List button / prompt */}
              {canEdit && (
                showNewListPrompt ? (
                  <form
                    onSubmit={(e) => { e.preventDefault(); handleCreateList(newListNameDraft); }}
                    style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', marginLeft: 'auto' }}
                  >
                    <input
                      autoFocus
                      value={newListNameDraft}
                      onChange={(e) => setNewListNameDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Escape') setShowNewListPrompt(false); }}
                      placeholder={t('bearRally.listNamePlaceholder', 'List name')}
                      style={{
                        padding: '0.3rem 0.5rem', backgroundColor: '#1a1a1a',
                        border: `1px solid ${ACCENT}50`, borderRadius: '6px',
                        color: '#fff', fontSize: '0.75rem', outline: 'none', width: isMobile ? '130px' : '170px',
                      }}
                    />
                    <button type="submit" style={{
                      padding: '0.3rem 0.55rem', backgroundColor: ACCENT, border: 'none',
                      borderRadius: '6px', color: '#fff', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer',
                    }}>
                      ✓
                    </button>
                    <button type="button" onClick={() => setShowNewListPrompt(false)} style={{
                      background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.65rem', padding: '0.2rem',
                    }}>
                      ✕
                    </button>
                  </form>
                ) : (
                  <button
                    onClick={openNewListPrompt}
                    title={t('bearRally.newList', 'New list')}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                      padding: '0.3rem 0.6rem', backgroundColor: `${ACCENT}15`,
                      border: `1px solid ${ACCENT}30`, borderRadius: '6px',
                      color: ACCENT, fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer',
                      marginLeft: 'auto',
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    {!isMobile && t('bearRally.newList', 'New List')}
                  </button>
                )
              )}

              {/* Share / Link buttons */}
              {players.length > 0 && (
                <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', marginLeft: canEdit ? '0' : 'auto' }}>
                  <button
                    onClick={handleSharePreview}
                    disabled={isCapturing}
                    title={t('bearRally.shareScreenshot', 'Share as image')}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                      padding: '0.3rem 0.55rem', backgroundColor: '#1a1a1a',
                      border: '1px solid #333', borderRadius: '6px',
                      color: '#9ca3af', fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer',
                      opacity: isCapturing ? 0.5 : 1,
                    }}
                  >
                    📸 {!isMobile && t('bearRally.share', 'Share')}
                  </button>
                  <button
                    onClick={handleCopyLink}
                    title={t('bearRally.copyLink', 'Copy link')}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                      padding: '0.3rem 0.55rem', backgroundColor: '#1a1a1a',
                      border: '1px solid #333', borderRadius: '6px',
                      color: '#9ca3af', fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    🔗 {!isMobile && t('bearRally.link', 'Link')}
                  </button>
                </div>
              )}

              {/* Dropdown menu */}
              {showListMenu && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                  backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '10px',
                  marginTop: '4px', maxHeight: '300px', overflowY: 'auto',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                }}>
                  {listsIndex.map((list) => (
                    <div
                      key={list.id}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.6rem 0.85rem', borderBottom: '1px solid #2a2a2a',
                        backgroundColor: list.id === activeListId ? `${ACCENT}10` : 'transparent',
                        cursor: 'pointer',
                        transition: 'background-color 0.1s',
                      }}
                      onClick={() => handleSwitchList(list.id)}
                      onMouseEnter={(e) => { if (list.id !== activeListId) e.currentTarget.style.backgroundColor = '#2a2a2a'; }}
                      onMouseLeave={(e) => { if (list.id !== activeListId) e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '0.8rem', fontWeight: list.id === activeListId ? 700 : 500,
                          color: list.id === activeListId ? ACCENT : '#fff',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {list.name}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#6b7280', marginTop: '0.15rem' }}>
                          {t('bearRally.listPlayerCount', '{{count}} players', { count: list.playerCount })}
                          {' · '}
                          {new Date(list.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      {list.id === activeListId && (
                        <span style={{ fontSize: '0.65rem', color: ACCENT, fontWeight: 700, marginLeft: '0.5rem' }}>✓</span>
                      )}
                      {canEdit && listsIndex.length > 1 && (
                        deleteListConfirm === list.id ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteList(list.id); }}
                            style={{
                              background: 'none', border: '1px solid #ef444460', borderRadius: '4px',
                              color: '#ef4444', cursor: 'pointer', padding: '0.15rem 0.4rem',
                              fontSize: '0.6rem', fontWeight: 700, marginLeft: '0.5rem',
                            }}
                          >
                            {t('common.confirm', 'Confirm')}
                          </button>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteListConfirm(list.id); }}
                            title={t('bearRally.deleteList', 'Delete list')}
                            style={{ background: 'none', border: 'none', color: '#6b728080', cursor: 'pointer', padding: '0.2rem', marginLeft: '0.5rem', display: 'flex' }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          </button>
                        )
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Add Player / Bulk Add / Bulk Edit Buttons */}
        {canEdit && !showForm && !showBulkInput && !showBulkEdit && activeListId && (
          <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.7rem 1.5rem',
                backgroundColor: ACCENT,
                border: 'none',
                borderRadius: '10px',
                color: '#fff',
                fontWeight: 700,
                fontSize: isMobile ? '0.9rem' : '0.95rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: `0 4px 20px ${ACCENT}35`,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              {t('bearRally.addPlayer', 'Add Player')}
            </button>
            <button
              onClick={() => setShowBulkInput(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.7rem 1.5rem',
                backgroundColor: 'transparent',
                border: `1px solid ${ACCENT}50`,
                borderRadius: '10px',
                color: ACCENT,
                fontWeight: 700,
                fontSize: isMobile ? '0.9rem' : '0.95rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              {t('bearRally.bulkAdd', 'Bulk Add')}
            </button>
            {players.length > 0 && (
              <button
                onClick={() => setShowBulkEdit(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.7rem 1.5rem',
                  backgroundColor: 'transparent',
                  border: `1px solid #6b728040`,
                  borderRadius: '10px',
                  color: '#9ca3af',
                  fontWeight: 700,
                  fontSize: isMobile ? '0.9rem' : '0.95rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                {t('bearRally.bulkEdit', 'Edit All')}
              </button>
            )}
          </div>
        )}

        {/* Bulk Input */}
        {canEdit && showBulkInput && (
          <BearBulkInput
            existingPlayers={players}
            onSave={(allPlayers) => {
              setPlayers(allPlayers);
              setShowBulkInput(false);
            }}
            onClose={() => setShowBulkInput(false)}
            isMobile={isMobile}
            rosterNames={rosterNames}
          />
        )}

        {/* Bulk Edit */}
        {canEdit && showBulkEdit && (
          <BearBulkEdit
            existingPlayers={players}
            unscoredNames={unscoredRosterMembers}
            onSave={(updatedPlayers) => {
              setPlayers(updatedPlayers);
              setShowBulkEdit(false);
            }}
            onClose={() => setShowBulkEdit(false)}
            isMobile={isMobile}
          />
        )}

        {/* Player Form */}
        {canEdit && showForm && (
          <div style={{
            marginBottom: '1.5rem',
            backgroundColor: '#0d0d0d',
            borderRadius: '16px',
            border: `1px solid ${ACCENT}30`,
            padding: isMobile ? '1rem' : '1.5rem',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
            }}>
              <h2 style={{
                fontSize: isMobile ? '1rem' : '1.1rem',
                fontWeight: 700,
                color: '#fff',
              }}>
                {editingId
                  ? t('bearRally.editPlayer', 'Edit Player')
                  : t('bearRally.addNewPlayer', 'Add New Player')}
              </h2>
              <button
                onClick={handleCancelForm}
                style={{
                  background: 'none', border: 'none', color: '#6b7280',
                  cursor: 'pointer', fontSize: '0.85rem', padding: '0.3rem 0.6rem',
                }}
              >
                {t('common.cancel', 'Cancel')}
              </button>
            </div>

            {/* Player Name (with roster autocomplete) */}
            <div style={{ marginBottom: '0.75rem', position: 'relative' }}>
              <label style={labelStyle}>
                {t('bearRally.playerName', 'Player Name')} <span style={{ color: '#ef4444' }}>*</span>
                {rosterNames.length > 0 && (
                  <span style={{ color: '#6b7280', fontWeight: 400, fontSize: '0.65rem', marginLeft: '0.5rem', textTransform: 'none' }}>
                    {t('bearRally.rosterHint', '(suggestions from alliance roster)')}
                  </span>
                )}
              </label>
              <input
                ref={nameInputRef}
                type="text"
                placeholder={t('bearRally.playerNamePlaceholder', 'e.g. LordCommander')}
                value={form.playerName}
                onChange={(e) => { updateForm('playerName', e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                style={inputStyle}
                autoFocus
                autoComplete="off"
              />
              {showSuggestions && nameSuggestions.length > 0 && (
                <div
                  ref={suggestionsRef}
                  style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                    backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
                    marginTop: '4px', maxHeight: '200px', overflowY: 'auto',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  }}
                >
                  {nameSuggestions.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        updateForm('playerName', name);
                        setShowSuggestions(false);
                      }}
                      style={{
                        width: '100%', padding: '0.5rem 0.75rem', textAlign: 'left',
                        background: 'none', border: 'none', borderBottom: '1px solid #2a2a2a',
                        color: '#d1d5db', fontSize: '0.85rem', cursor: 'pointer',
                        transition: 'background-color 0.1s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2a2a2a'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <span style={{ color: '#fff', fontWeight: 600 }}>{name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Section 1: Heroes & Gear */}
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem', paddingLeft: '0.25rem' }}>
                {t('bearRally.formSectionHeroes', '① Heroes & Exclusive Gear')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {renderHeroRow(t('bearRally.infantry', 'Infantry'), '🛡️', infantryHeroes, 'infantryHero', 'infantryEGLevel', '#3b82f6')}
                {renderHeroRow(t('bearRally.cavalry', 'Cavalry'), '🐎', cavalryHeroes, 'cavalryHero', 'cavalryEGLevel', '#f97316')}
                {renderHeroRow(t('bearRally.archer', 'Archer'), '🏹', archerHeroes, 'archerHero', 'archerEGLevel', '#ef4444')}
              </div>
            </div>

            {/* Section 2: Troop Stats */}
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem', paddingLeft: '0.25rem' }}>
                {t('bearRally.formSectionStats', '② Troop Bonus Stats')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {renderStatsRow(t('bearRally.infantry', 'Infantry'), '🛡️', 'infantryAttack', 'infantryLethality', '#3b82f6')}
                {renderStatsRow(t('bearRally.cavalry', 'Cavalry'), '🐎', 'cavalryAttack', 'cavalryLethality', '#f97316')}
                {renderStatsRow(t('bearRally.archer', 'Archer'), '🏹', 'archerAttack', 'archerLethality', '#ef4444')}
              </div>
            </div>

            {/* Error */}
            {formError && (
              <p style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                {formError}
              </p>
            )}

            {/* Submit */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={handleSubmit}
                style={{
                  flex: 1,
                  padding: '0.7rem',
                  backgroundColor: ACCENT,
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                }}
              >
                {editingId
                  ? t('bearRally.updatePlayer', 'Update Player')
                  : t('bearRally.savePlayer', 'Save Player')}
              </button>
            </div>
          </div>
        )}

        {/* Read-only banner for non-editors */}
        {!canEdit && ac.alliance && (
          <div style={{
            marginBottom: '0.75rem',
            padding: '0.5rem 0.75rem',
            backgroundColor: `${ACCENT}08`,
            border: `1px solid ${ACCENT}20`,
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
              {t('bearRally.readOnly', 'Read-only — only alliance owners, managers, and delegates can edit this tier list.')}
            </span>
          </div>
        )}

        {/* Tier List / Rankings Table */}
        {(rankedPlayers.length > 0 || incompletePlayers.length > 0) ? (
          <div ref={tierListRef} style={{
            backgroundColor: '#111111',
            borderRadius: '16px',
            border: '1px solid #2a2a2a',
            overflow: 'hidden',
          }}>
            {isMobile ? (
              /* ═══ MOBILE: Collapsible Card Layout ═══ */
              <div>
                {rankedPlayers.map((player) => {
                  const tierColor = BEAR_TIER_COLORS[player.tier];
                  const ds = getPlayerDisplayStats(player);
                  const isExpanded = expandedCards.has(player.id);
                  return (
                    <div
                      key={player.id}
                      style={{ borderBottom: '1px solid #1a1a1a' }}
                    >
                      {/* Collapsed header row — always visible, tap to expand */}
                      <div
                        onClick={() => setExpandedCards(prev => {
                          const next = new Set(prev);
                          if (next.has(player.id)) next.delete(player.id);
                          else next.add(player.id);
                          return next;
                        })}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.4rem',
                          padding: '0.6rem 0.85rem', cursor: 'pointer',
                          transition: 'background-color 0.1s',
                        }}
                      >
                        <span style={{
                          fontSize: '0.8rem', fontWeight: 800,
                          color: player.rank <= 3 ? ACCENT_LIGHT : '#6b7280',
                          fontFamily: FONT_DISPLAY, minWidth: '24px',
                        }}>
                          #{player.rank}
                        </span>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {player.playerName}
                        </span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: tierColor, fontFamily: FONT_DISPLAY }}>
                          {player.bearScore.toFixed(1)}
                        </span>
                        <TierBadge tier={player.tier} size="sm" />
                        <svg
                          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5"
                          style={{ flexShrink: 0, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        >
                          <path d="M6 9l6 6 6-6"/>
                        </svg>
                      </div>

                      {/* Expanded detail — troop rows with EG + edit/delete */}
                      {isExpanded && (
                        <div style={{ padding: '0 0.85rem 0.6rem' }}>
                          {([
                            { label: 'INF', hero: player.infantryHero, eg: player.infantryEGLevel, atk: ds.infAtk, leth: ds.infLeth, color: '#3b82f6', bg: '#3b82f608' },
                            { label: 'CAV', hero: player.cavalryHero, eg: player.cavalryEGLevel, atk: ds.cavAtk, leth: ds.cavLeth, color: '#f97316', bg: '#f9731608' },
                            { label: 'ARC', hero: player.archerHero, eg: player.archerEGLevel, atk: ds.arcAtk, leth: ds.arcLeth, color: '#ef4444', bg: '#ef444408' },
                          ] as const).map(troop => (
                            <div key={troop.label} style={{
                              display: 'flex', alignItems: 'center', gap: '0.4rem',
                              padding: '0.25rem 0.4rem', marginBottom: '0.15rem',
                              borderRadius: '6px', backgroundColor: troop.bg,
                            }}>
                              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: troop.color, width: '26px', flexShrink: 0 }}>
                                {troop.label}
                              </span>
                              <span style={{ fontSize: '0.7rem', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {troop.hero}
                              </span>
                              <span style={{ fontSize: '0.58rem', color: '#6b7280', flexShrink: 0 }}
                                title={t('bearRally.egTooltip', 'Exclusive Gear (EG) — each hero\'s unique equipment that boosts specific stats. Levels range from 0 to 10.')}
                              >
                                EG{troop.eg}
                              </span>
                              <span style={{ flex: 1 }} />
                              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#d1d5db', fontVariantNumeric: 'tabular-nums', minWidth: '42px', textAlign: 'right' }}>
                                {troop.atk}%
                              </span>
                              <span style={{ fontSize: '0.55rem', color: '#6b7280', flexShrink: 0 }}>A</span>
                              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#d1d5db', fontVariantNumeric: 'tabular-nums', minWidth: '42px', textAlign: 'right' }}>
                                {troop.leth}%
                              </span>
                              <span style={{ fontSize: '0.55rem', color: '#6b7280', flexShrink: 0 }}>L</span>
                            </div>
                          ))}

                          {/* Edit / Delete actions */}
                          {canEdit && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.3rem' }}>
                              <button
                                onClick={() => handleEdit(player)}
                                style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.6rem' }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                              {deleteConfirm === player.id ? (
                                <button
                                  onClick={() => handleDelete(player.id)}
                                  style={{ background: 'none', border: '1px solid #ef444440', borderRadius: '4px', color: '#ef4444', cursor: 'pointer', padding: '0.15rem 0.5rem', fontSize: '0.6rem', fontWeight: 700 }}
                                >
                                  {t('common.confirm', 'Confirm')}
                                </button>
                              ) : (
                                <button
                                  onClick={() => setDeleteConfirm(player.id)}
                                  style={{ background: 'none', border: 'none', color: '#6b728060', cursor: 'pointer', padding: '0.15rem' }}
                                  title="Delete"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* Incomplete players — in list but missing data */}
                {incompletePlayers.length > 0 && (
                  <>
                    <div style={{ padding: '0.5rem 0.75rem 0.25rem', fontSize: '0.6rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em', borderTop: rankedPlayers.length > 0 ? '1px solid #2a2a2a' : 'none' }}>
                      {t('bearRally.incompleteSection', 'Unranked — Missing Data')} ({incompletePlayers.length})
                    </div>
                    {incompletePlayers.map((player) => (
                      <div key={player.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.5rem 0.75rem', borderBottom: '1px solid #1a1a1a',
                        backgroundColor: '#f59e0b06',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: '0.7rem', color: '#f59e0b80', fontWeight: 700 }}>—</span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.playerName}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: '0.55rem', color: '#f59e0b80', fontStyle: 'italic' }}>{t('bearRally.needsData', 'needs data')}</span>
                          {canEdit && (
                            <button
                              onClick={() => handleEdit(player)}
                              style={{
                                padding: '0.2rem 0.6rem', backgroundColor: '#f59e0b15',
                                border: '1px solid #f59e0b30', borderRadius: '6px',
                                color: '#f59e0b', fontSize: '0.6rem', fontWeight: 700, cursor: 'pointer',
                                minHeight: '28px',
                              }}
                            >
                              + {t('bearRally.addData', 'Add Data')}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                )}
                {/* Unscored roster members */}
                {unscoredRosterMembers.length > 0 && (
                  <>
                    <div style={{ padding: '0.5rem 0.75rem 0.25rem', fontSize: '0.6rem', fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {t('bearRally.unscoredSection', 'Roster — No Data Yet')} ({unscoredRosterMembers.length})
                    </div>
                    {unscoredRosterMembers.map((name) => (
                      <div key={name} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.5rem 0.75rem', borderBottom: '1px solid #1a1a1a',
                        backgroundColor: '#0a162808',
                      }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#6b7280' }}>{name}</span>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.6rem', color: '#4b5563' }}>—</span>
                          {canEdit && (
                            <button
                              onClick={() => handleAddRosterMember(name)}
                              style={{
                                padding: '0.2rem 0.6rem', backgroundColor: `${ACCENT}15`,
                                border: `1px solid ${ACCENT}30`, borderRadius: '6px',
                                color: ACCENT, fontSize: '0.6rem', fontWeight: 700, cursor: 'pointer',
                              }}
                            >
                              + {t('bearRally.addData', 'Add Data')}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            ) : (
              /* ═══ DESKTOP: Proper HTML Table with Gear columns ═══ */
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '40px' }} />   {/* # rank */}
                    <col style={{ width: '58px' }} />   {/* Bear Score */}
                    <col style={{ width: '42px' }} />   {/* Tier */}
                    <col />                              {/* Player name — flex */}
                    {/* Heroes & Gear: INF Hero, INF Gear, CAV Hero, CAV Gear, ARC Hero, ARC Gear */}
                    <col style={{ width: '62px' }} />
                    <col style={{ width: '34px' }} />
                    <col style={{ width: '62px' }} />
                    <col style={{ width: '34px' }} />
                    <col style={{ width: '62px' }} />
                    <col style={{ width: '34px' }} />
                    {/* Troop Bonuses: INF Atk, INF Leth, CAV Atk, CAV Leth, ARC Atk, ARC Leth */}
                    <col style={{ width: '56px' }} />
                    <col style={{ width: '56px' }} />
                    <col style={{ width: '56px' }} />
                    <col style={{ width: '56px' }} />
                    <col style={{ width: '56px' }} />
                    <col style={{ width: '56px' }} />
                    {canEdit && <col style={{ width: '48px' }} />}
                  </colgroup>
                  <thead>
                    {/* Group header row */}
                    <tr style={{ backgroundColor: '#0d0d0d' }}>
                      <th colSpan={4} style={{ padding: 0 }} />
                      <th colSpan={6} style={{
                        fontSize: '0.58rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase',
                        letterSpacing: '0.04em', textAlign: 'center', padding: '0.35rem 0 0.15rem',
                        borderBottom: '1px solid #9ca3af20',
                      }}>
                        {t('bearRally.sectionHeroesGear', 'Heroes & Gear')}
                      </th>
                      <th colSpan={6} style={{
                        fontSize: '0.58rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase',
                        letterSpacing: '0.04em', textAlign: 'center', padding: '0.35rem 0 0.15rem',
                        borderBottom: '1px solid #9ca3af20',
                      }}>
                        {t('bearRally.sectionTroopBonuses', 'Troop Bonuses')}
                      </th>
                      {canEdit && <th style={{ padding: 0 }} />}
                    </tr>
                    {/* Column header row */}
                    <tr style={{ backgroundColor: '#0d0d0d', borderBottom: '1px solid #2a2a2a' }}>
                      <th style={{ fontSize: '0.6rem', fontWeight: 700, color: '#6b7280', textAlign: 'left', padding: '0.3rem 0.25rem 0.3rem 0.6rem' }}>#</th>
                      <th style={{ fontSize: '0.6rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', textAlign: 'center', padding: '0.3rem 0.25rem' }}>
                        {t('bearRally.bearScore', 'Score')}
                      </th>
                      <th style={{ fontSize: '0.6rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', textAlign: 'center', padding: '0.3rem 0.25rem' }}>
                        {t('bearRally.tierLabel', 'Tier')}
                      </th>
                      <th style={{ fontSize: '0.6rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', textAlign: 'left', padding: '0.3rem 0.25rem' }}>
                        {t('bearRally.player', 'Player')}
                      </th>
                      {/* Heroes & Gear sub-headers: INF → CAV → ARC */}
                      {([
                        { emoji: '🛡️', label: t('bearRally.hero', 'Hero'), color: '#3b82f6', isGear: false },
                        { emoji: '🛡️', label: t('bearRally.gearShort', 'Gear'), color: '#3b82f6', isGear: true },
                        { emoji: '🐎', label: t('bearRally.hero', 'Hero'), color: '#f97316', isGear: false },
                        { emoji: '🐎', label: t('bearRally.gearShort', 'Gear'), color: '#f97316', isGear: true },
                        { emoji: '🏹', label: t('bearRally.hero', 'Hero'), color: '#ef4444', isGear: false },
                        { emoji: '🏹', label: t('bearRally.gearShort', 'Gear'), color: '#ef4444', isGear: true },
                      ] as const).map((col, i) => (
                        <th key={`hg-${i}`} style={{
                          fontSize: '0.6rem', fontWeight: 700, color: col.color, textTransform: 'uppercase',
                          textAlign: 'center', padding: '0.2rem 0.15rem', verticalAlign: 'bottom',
                          cursor: col.isGear ? 'help' : undefined,
                        }}
                          title={col.isGear ? t('bearRally.egTooltip', 'Exclusive Gear (EG) — each hero\'s unique equipment that boosts specific stats. Levels range from 0 to 10.') : undefined}
                        >
                          <div style={{ fontSize: '0.7rem', lineHeight: 1 }}>{col.emoji}</div>
                          <div style={{ lineHeight: 1.2, marginTop: '1px' }}>{col.label}</div>
                        </th>
                      ))}
                      {/* Troop Bonuses sub-headers: INF → CAV → ARC */}
                      {([
                        { emoji: '🛡️', label: t('bearRally.attack', 'Attack'), color: '#3b82f6' },
                        { emoji: '🛡️', label: t('bearRally.lethality', 'Lethality'), color: '#3b82f6' },
                        { emoji: '🐎', label: t('bearRally.attack', 'Attack'), color: '#f97316' },
                        { emoji: '🐎', label: t('bearRally.lethality', 'Lethality'), color: '#f97316' },
                        { emoji: '🏹', label: t('bearRally.attack', 'Attack'), color: '#ef4444' },
                        { emoji: '🏹', label: t('bearRally.lethality', 'Lethality'), color: '#ef4444' },
                      ] as const).map((col, i) => (
                        <th key={`tb-${i}`} style={{
                          fontSize: '0.6rem', fontWeight: 700, color: col.color, textTransform: 'uppercase',
                          textAlign: 'center', padding: '0.2rem 0.15rem', verticalAlign: 'bottom',
                        }}>
                          <div style={{ fontSize: '0.7rem', lineHeight: 1 }}>{col.emoji}</div>
                          <div style={{ lineHeight: 1.2, marginTop: '1px' }}>{col.label}</div>
                          <div style={{ fontSize: '0.55rem', color: '#6b7280', lineHeight: 1, marginTop: '1px' }}>%</div>
                        </th>
                      ))}
                      {canEdit && <th style={{ padding: '0.3rem 0.15rem' }} />}
                    </tr>
                  </thead>
                  <tbody>
                    {rankedPlayers.map((player) => {
                      const tierColor = BEAR_TIER_COLORS[player.tier];
                      const ds = getPlayerDisplayStats(player);
                      const tdBase: React.CSSProperties = { padding: '0.4rem 0.15rem', fontSize: '0.72rem', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid #1a1a1a' };
                      const heroCellBase: React.CSSProperties = { ...tdBase, fontWeight: 500, textAlign: 'center', fontSize: '0.62rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
                      const gearCellBase: React.CSSProperties = { ...tdBase, fontWeight: 600, textAlign: 'center', fontSize: '0.6rem' };
                      return (
                        <tr key={player.id} style={{ transition: 'background-color 0.1s' }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#1a1a1a'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          <td style={{ ...tdBase, fontWeight: 800, color: player.rank <= 3 ? ACCENT_LIGHT : '#6b7280', fontFamily: FONT_DISPLAY, paddingLeft: '0.6rem' }}>
                            #{player.rank}
                          </td>
                          <td style={{ ...tdBase, fontWeight: 800, color: tierColor, fontFamily: FONT_DISPLAY, textAlign: 'center', fontSize: '0.78rem' }}>
                            {player.bearScore.toFixed(1)}
                          </td>
                          <td style={{ ...tdBase, textAlign: 'center' }}>
                            <TierBadge tier={player.tier} size="sm" />
                          </td>
                          <td style={{ ...tdBase, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {player.playerName}
                          </td>
                          {/* Heroes & Gear: INF → CAV → ARC */}
                          <td style={{ ...heroCellBase, color: '#93c5fd' }}>{player.infantryHero}</td>
                          <td style={{ ...gearCellBase, color: '#93c5fd' }}>{player.infantryEGLevel}</td>
                          <td style={{ ...heroCellBase, color: '#fdba74' }}>{player.cavalryHero}</td>
                          <td style={{ ...gearCellBase, color: '#fdba74' }}>{player.cavalryEGLevel}</td>
                          <td style={{ ...heroCellBase, color: '#fca5a5' }}>{player.archerHero}</td>
                          <td style={{ ...gearCellBase, color: '#fca5a5' }}>{player.archerEGLevel}</td>
                          {/* Troop Bonuses: INF → CAV → ARC */}
                          <td style={{ ...tdBase, fontWeight: 600, color: '#93c5fd', textAlign: 'center' }}>{ds.infAtk}</td>
                          <td style={{ ...tdBase, fontWeight: 600, color: '#93c5fd', textAlign: 'center' }}>{ds.infLeth}</td>
                          <td style={{ ...tdBase, fontWeight: 600, color: '#fdba74', textAlign: 'center' }}>{ds.cavAtk}</td>
                          <td style={{ ...tdBase, fontWeight: 600, color: '#fdba74', textAlign: 'center' }}>{ds.cavLeth}</td>
                          <td style={{ ...tdBase, fontWeight: 600, color: '#fca5a5', textAlign: 'center' }}>{ds.arcAtk}</td>
                          <td style={{ ...tdBase, fontWeight: 600, color: '#fca5a5', textAlign: 'center' }}>{ds.arcLeth}</td>
                          {canEdit && (
                            <td style={{ ...tdBase, textAlign: 'center', paddingRight: '0.5rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.15rem' }}>
                                <button
                                  onClick={() => handleEdit(player)}
                                  style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '0.15rem' }}
                                  title="Edit"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                </button>
                                {deleteConfirm === player.id ? (
                                  <button
                                    onClick={() => handleDelete(player.id)}
                                    style={{ background: 'none', border: '1px solid #ef444440', borderRadius: '3px', color: '#ef4444', cursor: 'pointer', padding: '0.1rem 0.3rem', fontSize: '0.55rem', fontWeight: 700 }}
                                  >
                                    ✓
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => setDeleteConfirm(player.id)}
                                    style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '0.15rem' }}
                                    title="Delete"
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                    {/* Incomplete players — in list but missing data */}
                    {incompletePlayers.length > 0 && (
                      <>
                        <tr><td colSpan={canEdit ? 17 : 16} style={{ padding: '0.35rem 0.6rem 0.15rem', fontSize: '0.55rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #1a1a1a', borderTop: rankedPlayers.length > 0 ? '1px solid #2a2a2a' : 'none' }}>
                          {t('bearRally.incompleteSection', 'Unranked — Missing Data')} ({incompletePlayers.length})
                        </td></tr>
                        {incompletePlayers.map((player) => {
                          const tdBase: React.CSSProperties = { padding: '0.4rem 0.15rem', fontSize: '0.72rem', borderBottom: '1px solid #1a1a1a' };
                          return (
                            <tr key={player.id} style={{ backgroundColor: '#f59e0b06' }}>
                              <td style={{ ...tdBase, color: '#f59e0b60', paddingLeft: '0.6rem', fontWeight: 700 }}>—</td>
                              <td style={{ ...tdBase, color: '#f59e0b60', textAlign: 'center', fontStyle: 'italic', fontSize: '0.6rem' }}>—</td>
                              <td style={{ ...tdBase, textAlign: 'center' }}>
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                  minWidth: '28px', height: '22px', padding: '0 0.35rem',
                                  backgroundColor: '#f59e0b10', border: '1px solid #f59e0b25',
                                  borderRadius: '6px', color: '#f59e0b80', fontSize: '0.55rem',
                                  fontWeight: 700, letterSpacing: '0.03em',
                                }}>?</span>
                              </td>
                              <td style={{ ...tdBase, fontWeight: 600, color: '#9ca3af' }}>{player.playerName}</td>
                              {Array.from({ length: 12 }).map((_, i) => (
                                <td key={i} style={{ ...tdBase, color: '#f59e0b30', textAlign: 'center', fontSize: '0.6rem' }}>—</td>
                              ))}
                              {canEdit && (
                                <td style={{ ...tdBase, textAlign: 'center' }}>
                                  <button
                                    onClick={() => handleEdit(player)}
                                    title={t('bearRally.addData', 'Add Data')}
                                    style={{
                                      background: 'none', border: '1px solid #f59e0b30', borderRadius: '4px',
                                      color: '#f59e0b', cursor: 'pointer', padding: '0.1rem 0.3rem', fontSize: '0.55rem', fontWeight: 700,
                                    }}
                                  >
                                    +
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </>
                    )}
                    {/* Unscored roster members */}
                    {unscoredRosterMembers.length > 0 && (
                      <>
                        <tr><td colSpan={canEdit ? 17 : 16} style={{ padding: '0.35rem 0.6rem 0.15rem', fontSize: '0.55rem', fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #1a1a1a' }}>
                          {t('bearRally.unscoredSection', 'Roster — No Data Yet')} ({unscoredRosterMembers.length})
                        </td></tr>
                        {unscoredRosterMembers.map((name) => {
                          const tdBase: React.CSSProperties = { padding: '0.4rem 0.15rem', fontSize: '0.72rem', borderBottom: '1px solid #1a1a1a' };
                          return (
                            <tr key={name} style={{ backgroundColor: '#0a162808' }}>
                              <td style={{ ...tdBase, color: '#4b5563', paddingLeft: '0.6rem' }}>—</td>
                              <td style={{ ...tdBase, color: '#4b5563', textAlign: 'center' }}>—</td>
                              <td style={{ ...tdBase, textAlign: 'center' }}>—</td>
                              <td style={{ ...tdBase, fontWeight: 600, color: '#6b7280' }}>{name}</td>
                              {Array.from({ length: 12 }).map((_, i) => (
                                <td key={i} style={{ ...tdBase, color: '#333', textAlign: 'center', fontSize: '0.6rem' }}>—</td>
                              ))}
                              {canEdit && (
                                <td style={{ ...tdBase, textAlign: 'center' }}>
                                  <button
                                    onClick={() => handleAddRosterMember(name)}
                                    style={{
                                      background: 'none', border: `1px solid ${ACCENT}30`, borderRadius: '4px',
                                      color: ACCENT, cursor: 'pointer', padding: '0.1rem 0.3rem', fontSize: '0.55rem', fontWeight: 700,
                                    }}
                                  >
                                    +
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Summary Footer */}
            <div style={{
              padding: '0.6rem 0.75rem',
              backgroundColor: '#0d0d0d',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}>
              <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>
                {incompletePlayers.length > 0
                  ? t('bearRally.rankedOfTotal', '{{ranked}} ranked / {{total}} total', { ranked: rankedPlayers.length, total: players.length })
                  : t('bearRally.totalPlayers', '{{count}} players', { count: players.length })}
              </span>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {(['SS', 'S', 'A', 'B', 'C', 'D'] as BearTier[]).map(tier => {
                  const count = rankedPlayers.filter(p => p.tier === tier).length;
                  if (count === 0) return null;
                  return (
                    <span key={tier} style={{
                      fontSize: '0.6rem',
                      color: BEAR_TIER_COLORS[tier],
                      fontWeight: 700,
                    }}>
                      {tier}: {count}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* Empty State — prominent creation prompt */
          !showForm && (
            <div style={{
              textAlign: 'center',
              padding: isMobile ? '2.5rem 1.25rem' : '3.5rem 2.5rem',
              backgroundColor: '#111111',
              borderRadius: '16px',
              border: `1px solid ${ACCENT}18`,
              background: `linear-gradient(180deg, #111111 0%, ${ACCENT}06 100%)`,
            }}>
              <div style={{
                width: '80px', height: '80px', borderRadius: '50%',
                backgroundColor: `${ACCENT}15`, border: `2px solid ${ACCENT}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1.25rem',
                boxShadow: `0 0 30px ${ACCENT}12`,
              }}>
                <span style={{ fontSize: '2rem' }}>🐻</span>
              </div>
              <h3 style={{
                fontSize: isMobile ? '1.15rem' : '1.35rem',
                fontWeight: 700, color: '#fff',
                marginBottom: '0.5rem',
              }}>
                {t('bearRally.emptyTitle', 'No players yet')}
              </h3>
              <p style={{
                color: '#9ca3af',
                fontSize: isMobile ? '0.82rem' : '0.9rem',
                maxWidth: '440px', margin: '0 auto 0.75rem',
                lineHeight: 1.6,
              }}>
                {t('bearRally.emptyDesc', 'Scout your alliance members with their best Bear Hunt team in the Guard Station, then add them here.')}
              </p>
              {/* No list exists yet — show creation prompt with roster hints */}
              {!activeListId && rosterNames.length > 0 && canEdit && (
                <p style={{
                  color: `${ACCENT}cc`,
                  fontSize: isMobile ? '0.8rem' : '0.85rem',
                  marginBottom: '1.5rem',
                }}>
                  {t('bearRally.emptyRosterHint', '{{count}} roster members will be auto-added to get you started.', { count: rosterNames.length })}
                </p>
              )}
              {!activeListId && rosterNames.length === 0 && canEdit && (
                <p style={{ color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.85rem', marginBottom: '1.5rem' }}>
                  {t('bearRally.emptyNoRoster', 'No roster members found — you can add players manually after creating a list.')}
                </p>
              )}
              {/* List exists but has no players */}
              {activeListId && canEdit && (
                <p style={{ color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.85rem', marginBottom: '1.5rem' }}>
                  {t('bearRally.emptyListHint', 'This list has no players yet. Add your first player to get started.')}
                </p>
              )}
              {!canEdit && (
                <p style={{ color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.85rem', marginBottom: '1.5rem' }}>
                  {t('bearRally.emptyReadOnly', 'Ask an alliance owner, manager, or delegate to create a list.')}
                </p>
              )}
              {canEdit && !activeListId && (
                <button
                  onClick={() => openNewListPrompt()}
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
                    padding: isMobile ? '0.8rem 1.75rem' : '0.85rem 2rem',
                    minHeight: isMobile ? '44px' : 'auto',
                    backgroundColor: ACCENT, border: 'none', borderRadius: '12px',
                    color: '#fff', fontWeight: 700,
                    fontSize: isMobile ? '0.95rem' : '1rem', cursor: 'pointer',
                    boxShadow: `0 4px 24px ${ACCENT}40`,
                    transition: 'transform 0.15s, box-shadow 0.15s',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 6px 28px ${ACCENT}50`; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 4px 24px ${ACCENT}40`; }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  {t('bearRally.createFirstList', 'Create Tier List')}
                </button>
              )}
              {canEdit && activeListId && (
                <button
                  onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm); }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
                    padding: isMobile ? '0.8rem 1.75rem' : '0.85rem 2rem',
                    minHeight: isMobile ? '44px' : 'auto',
                    backgroundColor: ACCENT, border: 'none', borderRadius: '12px',
                    color: '#fff', fontWeight: 700,
                    fontSize: isMobile ? '0.95rem' : '1rem', cursor: 'pointer',
                    boxShadow: `0 4px 24px ${ACCENT}40`,
                    transition: 'transform 0.15s, box-shadow 0.15s',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 6px 28px ${ACCENT}50`; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 4px 24px ${ACCENT}40`; }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  {t('bearRally.addFirstPlayer', 'Add First Player')}
                </button>
              )}
            </div>
          )
        )}

        {/* Info Card */}
        <div style={{
          marginTop: '1.5rem',
          padding: isMobile ? '1rem' : '1.25rem',
          backgroundColor: '#111111',
          borderRadius: '12px',
          border: `1px solid ${ACCENT}15`,
          background: `linear-gradient(135deg, #111111 0%, ${ACCENT}05 100%)`,
        }}>
          <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: ACCENT, marginBottom: '0.5rem' }}>
            💡 {t('bearRally.howItWorksTitle', 'How it works')}
          </h4>
          <ul style={{
            color: '#9ca3af', fontSize: isMobile ? '0.75rem' : '0.8rem',
            lineHeight: 1.7, paddingLeft: '1.25rem', margin: 0,
          }}>
            <li>{t('bearRally.tip1', 'Scout each alliance member with their best Bear Hunt team in the Guard Station (heroes must be in city).')}</li>
            <li>{t('bearRally.tip2', 'Input the 3 heroes (Infantry, Cavalry, Archer), their Exclusive Gear levels, and the Attack/Lethality percentages from the scout report.')}</li>
            <li>{t('bearRally.tip3', 'Atlas automatically adjusts for defensive EG bonuses (inflated in scout) and applies offensive EG bonuses (active in rally).')}</li>
            <li>{t('bearRally.tip4', 'Players are ranked by Bear Score and assigned tiers from SS (highest) to D (lowest).')}</li>
          </ul>
        </div>

        {/* Disclaimer */}
        <div style={{
          marginTop: '1rem',
          padding: isMobile ? '0.75rem' : '0.85rem 1rem',
          backgroundColor: '#f59e0b08',
          border: '1px solid #f59e0b20',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.5rem',
        }}>
          <span style={{ fontSize: '0.8rem', flexShrink: 0, lineHeight: 1.6 }}>⚠️</span>
          <p style={{ color: '#d1a054', fontSize: isMobile ? '0.7rem' : '0.75rem', lineHeight: 1.6, margin: 0 }}>
            {t(BEAR_DISCLAIMER_KEY, BEAR_DISCLAIMER_DEFAULT)}
          </p>
        </div>

        {/* Back Links */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', paddingTop: '1.5rem', paddingBottom: '1rem' }}>
          <Link to="/tools/bear-rally-tier-list/about" style={{ color: ACCENT, textDecoration: 'none', fontSize: '0.8rem' }}>
            {t('bearRally.aboutTool', 'About this tool')}
          </Link>
          <Link to="/alliance-center" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '0.8rem' }}>
            {t('bearRally.allianceCenter', '← Alliance Center')}
          </Link>
          <Link to="/tools" style={{ color: '#22d3ee', textDecoration: 'none', fontSize: '0.8rem' }}>
            {t('common.allTools', '← All Tools')}
          </Link>
        </div>
        {/* Share Preview Modal */}
        {sharePreview && (
          <div
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.92)', zIndex: 9999,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '1rem',
            }}
            onClick={closeSharePreview}
          >
            <div
              style={{
                maxWidth: '90vw', maxHeight: '65vh', overflow: 'auto',
                borderRadius: '12px', border: '1px solid #333', marginBottom: '1.25rem',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <img src={sharePreview} alt={t('bearRally.sharePreviewAlt', 'Tier list preview')} style={{ maxWidth: '100%', height: 'auto', display: 'block' }} />
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
              <button onClick={handleShareNative} style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.5rem 1rem', backgroundColor: ACCENT, border: 'none', borderRadius: '8px',
                color: '#fff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
              }}>
                📤 {t('bearRally.shareAction', 'Share')}
              </button>
              <button onClick={handleShareDownload} style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.5rem 1rem', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
                color: '#d1d5db', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
              }}>
                💾 {t('bearRally.download', 'Download')}
              </button>
              <button onClick={() => { handleCopyLink(); closeSharePreview(); }} style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.5rem 1rem', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
                color: '#d1d5db', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
              }}>
                🔗 {t('bearRally.copyLink', 'Copy Link')}
              </button>
              <button onClick={closeSharePreview} style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.5rem 1rem', backgroundColor: '#1a1a1a', border: '1px solid #ef444440', borderRadius: '8px',
                color: '#ef4444', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
              }}>
                ✕ {t('common.close', 'Close')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BearRallyTierList;
