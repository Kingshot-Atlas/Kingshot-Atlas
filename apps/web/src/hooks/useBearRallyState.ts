import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { logger } from '../utils/logger';
import { triggerHaptic } from '../hooks/useHaptic';
import {
  getPlayerDisplayStats,
  calculateBearScore,
  assignBearTier,
  isPlayerComplete,
  recalculateAllScores,
  needsRecalculation,
  markFormulaVersionCurrent,
  BEAR_LISTS_INDEX_KEY,
  BEAR_LIST_DATA_PREFIX,
  BEAR_STORAGE_KEY_LEGACY,
  BEAR_ACTIVE_LIST_KEY,
  getDefaultListName,
  validateBearPlayers,
  type BearPlayerEntry,
  type BearListMeta,
  type BearTier,
} from '../data/bearHuntData';
import { useAllianceCenter } from '../hooks/useAllianceCenter';
import { useAuth } from '../contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// ─── Helper: generate unique ID ─────────────────────────────────────────────

const genId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// ─── Helper: normalize Unicode for fuzzy name search ─────────────────────────
const UNICODE_TO_ASCII: Record<string, string> = {
  '\u1D00': 'a', '\u0299': 'b', '\u1D04': 'c', '\u1D05': 'd', '\u1D07': 'e',
  '\u0493': 'f', '\u0262': 'g', '\u029C': 'h', '\u026A': 'i', '\u1D0A': 'j',
  '\u1D0B': 'k', '\u029F': 'l', '\u1D0D': 'm', '\u0274': 'n', '\u1D0F': 'o',
  '\u1D18': 'p', '\u01EB': 'q', '\u0280': 'r', '\u0455': 's', '\u1D1B': 't',
  '\u1D1C': 'u', '\u1D20': 'v', '\u1D21': 'w', '\u0263': 'x', '\u028F': 'y',
  '\u1D22': 'z',
};

function normalizeForSearch(str: string): string {
  let result = '';
  for (const ch of str) {
    result += UNICODE_TO_ASCII[ch] ?? ch;
  }
  result = result.normalize('NFKD');
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

// ─── Version-gated recalculation wrapper ─────────────────────────────────────

/** Recalculates scores only if the formula version changed; otherwise returns as-is. */
function maybeRecalculate(players: BearPlayerEntry[]): BearPlayerEntry[] {
  if (!needsRecalculation()) return players;
  return recalculateAllScores(players);
}

// ─── Empty Form State ───────────────────────────────────────────────────────

export interface FormState {
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

export const emptyForm: FormState = {
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

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useBearRallyState() {
  const { t } = useTranslation();
  const ac = useAllianceCenter();
  const { user } = useAuth();

  const rosterNames = useMemo(() =>
    ac.members.map(m => m.player_name).filter(Boolean).sort((a, b) => a.localeCompare(b)),
    [ac.members]
  );
  const canEdit = !ac.alliance || ac.canManage || (ac.accessRole === 'delegate' && ac.hasDelegateAccessTo('bear_rally'));

  // ── Auth + Supabase sync ──
  const supabaseSync = !!(ac.alliance && isSupabaseConfigured && supabase);
  const allianceId = ac.alliance?.id;
  const supabaseSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloudUpdatedAt = useRef<string | null>(null);
  const [lastEditedBy, setLastEditedBy] = useState<string | null>(null);
  const undoStack = useRef<BearPlayerEntry[][]>([]);
  const MAX_UNDO = 20;

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
  const [isCapturing, setIsCapturing] = useState(false);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const shareMenuRef = useRef<HTMLDivElement>(null);

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

  // ── Initialize multi-list storage ──
  useEffect(() => {
    if (ac.allianceLoading) return;
    if (initializedRef.current) return;

    if (ac.alliance && isSupabaseConfigured && supabase) {
      const aid = ac.alliance.id;
      let cancelled = false;
      (async () => {
        try {
          const { data, error } = await supabase
            .from('bear_rally_lists')
            .select('id, name, players, created_at, updated_at, updated_by')
            .eq('alliance_id', aid)
            .order('created_at', { ascending: true });

          if (cancelled) return;
          if (error) throw error;

          if (data && data.length > 0) {
            const lists: BearListMeta[] = data.map(row => ({
              id: row.id,
              name: row.name,
              createdAt: row.created_at,
              playerCount: Array.isArray(row.players) ? (row.players as unknown[]).length : 0,
            }));
            setListsIndex(lists);
            saveListsIndex(lists);

            const savedActive = getActiveListId();
            const pickId = (savedActive && data.some(d => d.id === savedActive)) ? savedActive : data[0]!.id;
            setActiveListIdState(pickId);
            setActiveListId(pickId);
            const activeRow = data.find(d => d.id === pickId);
            const loaded = maybeRecalculate((activeRow?.players as BearPlayerEntry[]) ?? []);
            setPlayers(loaded);
            cloudUpdatedAt.current = (activeRow as Record<string, unknown>)?.updated_at as string ?? null;
            const editedById = (activeRow as Record<string, unknown>)?.updated_by as string | null;
            if (editedById && supabase) {
              supabase.from('profiles').select('linked_username, username').eq('id', editedById).single()
                .then(({ data: profile }) => {
                  if (!cancelled && profile) setLastEditedBy(profile.linked_username || profile.username || null);
                });
            }

            data.forEach(row => saveListPlayers(row.id, row.players as BearPlayerEntry[]));
          } else {
            const { lists: localLists } = migrateLegacyIfNeeded();
            if (localLists.length > 0 && user?.id) {
              const migrated: BearListMeta[] = [];
              for (const list of localLists) {
                const lp = loadListPlayers(list.id);
                const { data: ins } = await supabase
                  .from('bear_rally_lists')
                  .insert({ alliance_id: aid, name: list.name, players: lp, created_by: user.id })
                  .select('id, name, created_at')
                  .single();
                if (cancelled) return;
                if (ins) {
                  migrated.push({ id: ins.id, name: ins.name, createdAt: ins.created_at, playerCount: lp.length });
                  saveListPlayers(ins.id, lp);
                }
              }
              if (migrated.length > 0 && !cancelled) {
                setListsIndex(migrated);
                saveListsIndex(migrated);
                setActiveListIdState(migrated[0]!.id);
                setActiveListId(migrated[0]!.id);
                setPlayers(maybeRecalculate(loadListPlayers(migrated[0]!.id)));
              }
            }
          }
        } catch (err) {
          logger.error('Bear rally cloud load failed:', err);
          const { lists, activeId } = migrateLegacyIfNeeded();
          setListsIndex(lists);
          if (activeId && lists.some(l => l.id === activeId)) {
            setActiveListIdState(activeId);
            setPlayers(maybeRecalculate(loadListPlayers(activeId)));
          } else if (lists.length > 0 && lists[0]) {
            setActiveListIdState(lists[0].id);
            setActiveListId(lists[0].id);
            setPlayers(maybeRecalculate(loadListPlayers(lists[0].id)));
          }
        }
        if (!cancelled) {
          initializedRef.current = true;
          markFormulaVersionCurrent();
        }
      })();
      return () => { cancelled = true; };
    } else {
      const { lists, activeId } = migrateLegacyIfNeeded();
      setListsIndex(lists);
      if (activeId && lists.some(l => l.id === activeId)) {
        setActiveListIdState(activeId);
        setPlayers(maybeRecalculate(loadListPlayers(activeId)));
      } else if (lists.length > 0 && lists[0]) {
        setActiveListIdState(lists[0].id);
        setActiveListId(lists[0].id);
        setPlayers(maybeRecalculate(loadListPlayers(lists[0].id)));
      }
      initializedRef.current = true;
      markFormulaVersionCurrent();
      return undefined;
    }
  }, [ac.allianceLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filtered roster suggestions based on current input
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
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target as Node)) {
        setShowShareMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Undo helper ──
  const pushUndo = useCallback((snapshot: BearPlayerEntry[]) => {
    undoStack.current = [...undoStack.current.slice(-(MAX_UNDO - 1)), snapshot];
  }, [MAX_UNDO]);

  const handleUndo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const prev = undoStack.current.pop()!;
    setPlayers(prev);
    triggerHaptic('medium');
    setShowUndoToast(true);
    setTimeout(() => setShowUndoToast(false), 2000);
  }, []);

  // Keyboard shortcut: Ctrl/Cmd+Z for undo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey && canEdit) {
        e.preventDefault();
        handleUndo();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handleUndo, canEdit]);

  // Persist players to active list
  useEffect(() => {
    if (!activeListId || !initializedRef.current) return;
    saveListPlayers(activeListId, players);
    setListsIndex(prev => {
      const updated = prev.map(l => l.id === activeListId ? { ...l, playerCount: players.length } : l);
      saveListsIndex(updated);
      return updated;
    });

    // Debounced Supabase save
    if (supabaseSync) {
      if (supabaseSaveTimer.current) clearTimeout(supabaseSaveTimer.current);
      const sb = supabase!;
      const lid = activeListId;
      const uid = user?.id;
      supabaseSaveTimer.current = setTimeout(async () => {
        const validationErr = validateBearPlayers(players);
        if (validationErr) {
          logger.error('Bear rally validation failed (skipping save):', validationErr);
          return;
        }

        if (cloudUpdatedAt.current) {
          const { data: current } = await sb
            .from('bear_rally_lists')
            .select('updated_at')
            .eq('id', lid)
            .single();
          if (current && current.updated_at !== cloudUpdatedAt.current) {
            logger.error('Bear rally conflict detected — another user modified this list. Refetching...');
            const { data: fresh } = await sb
              .from('bear_rally_lists')
              .select('players, updated_at, updated_by')
              .eq('id', lid)
              .single();
            if (fresh) {
              cloudUpdatedAt.current = fresh.updated_at;
            }
          }
        }

        const { data: saved, error } = await sb
          .from('bear_rally_lists')
          .update({ players, updated_by: uid })
          .eq('id', lid)
          .select('updated_at')
          .single();
        if (error) {
          logger.error('Bear rally cloud save failed:', error);
        } else if (saved) {
          cloudUpdatedAt.current = saved.updated_at;
          setLastEditedBy(user?.user_metadata?.full_name || user?.email || null);
        }
      }, 1000);
    }
  }, [players, activeListId, supabaseSync, user]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (supabaseSaveTimer.current) clearTimeout(supabaseSaveTimer.current);
    };
  }, []);

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

  const handleCreateList = useCallback(async (name?: string) => {
    const listName = (name ?? getNextMonthName()).trim();
    if (!listName) return;

    const initialPlayers: BearPlayerEntry[] = players.length > 0
      ? players.map(p => ({
          id: genId(),
          playerName: p.playerName,
          infantryHero: p.infantryHero,
          infantryEGLevel: p.infantryEGLevel,
          infantryAttack: 0,
          infantryLethality: 0,
          cavalryHero: p.cavalryHero,
          cavalryEGLevel: p.cavalryEGLevel,
          cavalryAttack: 0,
          cavalryLethality: 0,
          archerHero: p.archerHero,
          archerEGLevel: p.archerEGLevel,
          archerAttack: 0,
          archerLethality: 0,
          bearScore: 0,
          tier: 'D' as BearTier,
        }))
      : rosterNames.map(playerName => ({
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

    let listId: string;
    let createdAt = new Date().toISOString();

    if (supabaseSync && allianceId) {
      const { data, error } = await supabase!
        .from('bear_rally_lists')
        .insert({ alliance_id: allianceId, name: listName, players: initialPlayers, created_by: user?.id })
        .select('id, created_at')
        .single();
      if (error || !data) {
        logger.error('Failed to create list in cloud:', error);
        return;
      }
      listId = data.id;
      createdAt = data.created_at;
    } else {
      listId = genId();
    }

    const meta: BearListMeta = {
      id: listId,
      name: listName,
      createdAt,
      playerCount: initialPlayers.length,
    };
    setListsIndex(prev => {
      const updated = [...prev, meta];
      saveListsIndex(updated);
      return updated;
    });
    saveListPlayers(listId, initialPlayers);
    setActiveListIdState(listId);
    setActiveListId(listId);
    setPlayers(initialPlayers);
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setShowListMenu(false);
    setShowNewListPrompt(false);
  }, [getNextMonthName, rosterNames, players, supabaseSync, allianceId, user?.id]);

  const handleSwitchList = useCallback(async (listId: string) => {
    if (listId === activeListId) return;
    setActiveListIdState(listId);
    setActiveListId(listId);

    if (supabaseSync) {
      try {
        const { data } = await supabase!
          .from('bear_rally_lists')
          .select('players')
          .eq('id', listId)
          .single();
        if (data) {
          const cloudPlayers = maybeRecalculate(data.players as BearPlayerEntry[]);
          setPlayers(cloudPlayers);
          saveListPlayers(listId, cloudPlayers);
        } else {
          setPlayers(maybeRecalculate(loadListPlayers(listId)));
        }
      } catch {
        setPlayers(maybeRecalculate(loadListPlayers(listId)));
      }
    } else {
      setPlayers(maybeRecalculate(loadListPlayers(listId)));
    }

    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setShowListMenu(false);
  }, [activeListId, supabaseSync]);

  const handleRenameList = useCallback((listId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setListsIndex(prev => {
      const updated = prev.map(l => l.id === listId ? { ...l, name: trimmed } : l);
      saveListsIndex(updated);
      return updated;
    });
    setEditingListName(null);
    if (supabaseSync) {
      supabase!.from('bear_rally_lists').update({ name: trimmed }).eq('id', listId)
        .then(({ error }) => { if (error) logger.error('Bear rally cloud rename failed:', error); });
    }
  }, [supabaseSync]);

  const handleDeleteList = useCallback((listId: string) => {
    deleteListData(listId);
    setListsIndex(prev => {
      const updated = prev.filter(l => l.id !== listId);
      saveListsIndex(updated);
      if (activeListId === listId) {
        if (updated.length > 0 && updated[0]) {
          setActiveListIdState(updated[0].id);
          setActiveListId(updated[0].id);
          setPlayers(maybeRecalculate(loadListPlayers(updated[0].id)));
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
    if (supabaseSync) {
      supabase!.from('bear_rally_lists').delete().eq('id', listId)
        .then(({ error }) => { if (error) logger.error('Bear rally cloud delete failed:', error); });
    }
  }, [activeListId, supabaseSync]);

  // ── Sorted & ranked players ──
  const { rankedPlayers, incompletePlayers } = useMemo(() => {
    const complete = players.filter(isPlayerComplete);
    const incomplete = players.filter(p => !isPlayerComplete(p));
    const ranked = [...complete].sort((a, b) => b.bearScore - a.bearScore).map((p, i) => ({ ...p, rank: i + 1 }));
    return { rankedPlayers: ranked, incompletePlayers: incomplete };
  }, [players]);

  // ── Unscored roster members ──
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
    if (!form.infantryHero || !form.cavalryHero || !form.archerHero) {
      setFormError(t('bearRally.errorHeroes', 'All three heroes must be selected.'));
      return;
    }
    if (form.infantryEGLevel < 0 || form.cavalryEGLevel < 0 || form.archerEGLevel < 0) {
      setFormError(t('bearRally.errorEG', 'All Exclusive Gear levels must be selected.'));
      return;
    }
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

    pushUndo(players);
    setPlayers(prev => {
      let updated: BearPlayerEntry[];
      if (editingId) {
        updated = prev.map(p => p.id === editingId ? entry : p);
      } else {
        updated = [...prev, entry];
      }
      const completePlayers = updated.filter(isPlayerComplete);
      const allScores = completePlayers.map(p => p.bearScore);
      return updated.map(p => isPlayerComplete(p) ? { ...p, tier: assignBearTier(p.bearScore, allScores) } : p);
    });

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
  }, [form, editingId, t, ac, rosterNames, players, pushUndo]);

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
    pushUndo(players);
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
  }, [editingId, players, pushUndo]);

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

  const handleCopyImage = useCallback(async () => {
    setShowShareMenu(false);
    const canvas = await captureScreenshot();
    if (!canvas) return;
    triggerHaptic('success');
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      if (navigator.clipboard && 'write' in navigator.clipboard) {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          return;
        } catch (err) {
          logger.error('Clipboard write failed, falling back to download:', err);
        }
      }
      const listName = listsIndex.find(l => l.id === activeListId)?.name ?? 'tier-list';
      const link = document.createElement('a');
      link.download = `bear-rally-${listName.replace(/\s+/g, '-').toLowerCase()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }, 'image/png');
  }, [captureScreenshot, listsIndex, activeListId]);

  const handleCopyLink = useCallback(() => {
    setShowShareMenu(false);
    triggerHaptic('light');
    navigator.clipboard.writeText(window.location.href);
  }, []);

  const handleExportCSV = useCallback(() => {
    setShowShareMenu(false);
    triggerHaptic('light');
    const listName = listsIndex.find(l => l.id === activeListId)?.name ?? 'tier-list';
    const headers = ['Rank', 'Bear Score', 'Tier', 'Player', 'Inf Hero', 'Inf Gear', 'Cav Hero', 'Cav Gear', 'Arc Hero', 'Arc Gear', 'Inf Attack%', 'Inf Lethality%', 'Cav Attack%', 'Cav Lethality%', 'Arc Attack%', 'Arc Lethality%'];
    const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const rows = rankedPlayers.map(p => {
      const ds = getPlayerDisplayStats(p);
      return [p.rank, p.bearScore.toFixed(1), p.tier, q(p.playerName), q(p.infantryHero), p.infantryEGLevel, q(p.cavalryHero), p.cavalryEGLevel, q(p.archerHero), p.archerEGLevel, ds.infAtk.toFixed(1), ds.infLeth.toFixed(1), ds.cavAtk.toFixed(1), ds.cavLeth.toFixed(1), ds.arcAtk.toFixed(1), ds.arcLeth.toFixed(1)].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.download = `bear-rally-${listName.replace(/\s+/g, '-').toLowerCase()}.csv`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }, [listsIndex, activeListId, rankedPlayers]);

  return {
    // Alliance
    ac,
    canEdit,
    rosterNames,

    // Auth
    user,

    // List state
    listsIndex,
    activeListId: activeListId as string | null,
    players,
    setPlayers,
    lastEditedBy,

    // List management
    editingListName,
    setEditingListName,
    listNameDraft,
    setListNameDraft,
    showListMenu,
    setShowListMenu,
    deleteListConfirm,
    setDeleteListConfirm,
    showNewListPrompt,
    setShowNewListPrompt,
    newListNameDraft,
    setNewListNameDraft,
    listMenuRef,
    openNewListPrompt,
    handleCreateList,
    handleSwitchList,
    handleRenameList,
    handleDeleteList,

    // Player data
    rankedPlayers,
    incompletePlayers,
    unscoredRosterMembers,

    // Form state
    form,
    setForm,
    editingId,
    setEditingId,
    showForm,
    setShowForm,
    showBulkInput,
    setShowBulkInput,
    showBulkEdit,
    setShowBulkEdit,
    formError,
    setFormError,
    deleteConfirm,
    setDeleteConfirm,
    showSuggestions,
    setShowSuggestions,
    expandedCards,
    setExpandedCards,
    nameInputRef,
    suggestionsRef,
    nameSuggestions,
    updateForm,
    handleSubmit,
    handleEdit,
    handleDelete,
    handleCancelForm,
    handleAddRosterMember,
    pushUndo,

    // Undo
    undoStack,
    handleUndo,
    showUndoToast,

    // Share
    tierListRef,
    isCapturing,
    showShareMenu,
    setShowShareMenu,
    shareMenuRef,
    handleCopyImage,
    handleCopyLink,
    handleExportCSV,
  };
}

export type { BearPlayerEntry, BearListMeta, BearTier };
