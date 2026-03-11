/**
 * useBattleTierList — Supabase-backed state for KvK Battle Tier List
 *
 * Kingdom-level tool: all users in a Gold kingdom share the same lists.
 * Editors, Co-Editors, and Battle Managers can edit.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { usePremium } from '../contexts/PremiumContext';
import { useGoldKingdoms } from './useGoldKingdoms';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import {
  isPlayerComplete,
  calculateOffenseScore,
  calculateDefenseScore,
  recalculateAll,
  recalculateAllWeighted,
  validateBattlePlayers,
  BATTLE_TIER_ACTIVE_LIST_KEY,
  DEFAULT_TROOP_WEIGHTS,
  isTroopWeightsDefault,
  calculateWeightedOffenseScore,
  calculateWeightedDefenseScore,
  type BattlePlayerEntry,
  type BattleTierOverrides,
  type BattleTroopWeights,
} from '../data/battleTierData';
import { computeTierBoundaries } from '../data/bearHuntData';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BattleTierListMeta {
  id: string;
  name: string;
  kingdom_number: number;
  created_at: string;
  updated_at: string;
  updated_by_username: string | null;
  playerCount: number;
}

export interface BattleTierManager {
  id: string;
  user_id: string;
  username: string | null;
  kingdom_number: number;
}

interface FormState {
  playerName: string;
  infantryHero: string;
  infantryEGLevel: number;
  cavalryHero: string;
  cavalryEGLevel: number;
  archerHero: string;
  archerEGLevel: number;
  infantryAttack: string;
  infantryLethality: string;
  infantryDefense: string;
  infantryHealth: string;
  cavalryAttack: string;
  cavalryLethality: string;
  cavalryDefense: string;
  cavalryHealth: string;
  archerAttack: string;
  archerLethality: string;
  archerDefense: string;
  archerHealth: string;
}

export const emptyForm: FormState = {
  playerName: '',
  infantryHero: '', infantryEGLevel: -1,
  cavalryHero: '', cavalryEGLevel: -1,
  archerHero: '', archerEGLevel: -1,
  infantryAttack: '', infantryLethality: '', infantryDefense: '', infantryHealth: '',
  cavalryAttack: '', cavalryLethality: '', cavalryDefense: '', cavalryHealth: '',
  archerAttack: '', archerLethality: '', archerDefense: '', archerHealth: '',
};

const genId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useBattleTierList() {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const { isAdmin } = usePremium();
  const goldKingdoms = useGoldKingdoms();

  const kingdomNumber = profile?.linked_kingdom ?? null;
  const isGoldKingdom = !!(kingdomNumber && goldKingdoms.has(kingdomNumber));
  const hasAccess = isGoldKingdom || isAdmin;

  // ── Editor / Manager status ──
  const [isEditor, setIsEditor] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [managers, setManagers] = useState<BattleTierManager[]>([]);

  useEffect(() => {
    if (!user?.id || !supabase || !kingdomNumber) return;
    // Check editor status
    supabase.from('kingdom_editors')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()
      .then(({ data }) => setIsEditor(!!data));
    // Check manager status
    supabase.from('battle_tier_list_managers')
      .select('id')
      .eq('kingdom_number', kingdomNumber)
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => setIsManager(!!data));
  }, [user?.id, kingdomNumber]);

  // Load managers for the kingdom
  useEffect(() => {
    if (!supabase) return;
    supabase!.from('battle_tier_list_managers')
      .select('*')
      .eq('kingdom_number', kingdomNumber)
      .then(({ data }) => {
        if (data) setManagers(data);
      });
  }, [kingdomNumber]);

  const canEdit = isEditor || isManager || isAdmin;

  // ── Lists ──
  const [listsIndex, setListsIndex] = useState<BattleTierListMeta[]>([]);
  const [activeListId, setActiveListIdState] = useState<string | null>(null);
  const [players, setPlayers] = useState<BattlePlayerEntry[]>([]);
  const [defensePlayers, setDefensePlayers] = useState<BattlePlayerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tierOverridesOffense, setTierOverridesOffense] = useState<BattleTierOverrides | null>(null);
  const [tierOverridesDefense, setTierOverridesDefense] = useState<BattleTierOverrides | null>(null);

  // ── UI State ──
  const [showForm, setShowForm] = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showBulkInput, setShowBulkInput] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [showListMenu, setShowListMenu] = useState(false);
  const [showNewListPrompt, setShowNewListPrompt] = useState(false);
  const [newListNameDraft, setNewListNameDraft] = useState('');
  const [editingListName, setEditingListName] = useState<string | null>(null);
  const [listNameDraft, setListNameDraft] = useState('');
  const [deleteListConfirm, setDeleteListConfirm] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'offense' | 'defense'>('offense');
  const [lastEditedBy, setLastEditedBy] = useState<string | null>(null);
  const [showManagerPanel, setShowManagerPanel] = useState(false);
  const [managerSearchInput, setManagerSearchInput] = useState('');
  const [managerSearchResults, setManagerSearchResults] = useState<Array<{ id: string; linked_username: string | null; username: string | null; linked_player_id: string | null }>>([]); 
  const [showManagerDropdown, setShowManagerDropdown] = useState(false);
  const [showWeightsPanel, setShowWeightsPanel] = useState(false);
  const [offenseWeights, setOffenseWeights] = useState<BattleTroopWeights>(structuredClone(DEFAULT_TROOP_WEIGHTS));
  const [defenseWeights, setDefenseWeights] = useState<BattleTroopWeights>(structuredClone(DEFAULT_TROOP_WEIGHTS));

  // ── Kingdom player names for autocomplete ──
  const [kingdomPlayerNames, setKingdomPlayerNames] = useState<string[]>([]);

  useEffect(() => {
    if (!supabase || !kingdomNumber) { setKingdomPlayerNames([]); return; }
    supabase.from('profiles')
      .select('linked_username')
      .eq('linked_kingdom', kingdomNumber)
      .not('linked_username', 'is', null)
      .order('linked_username')
      .then(({ data }) => {
        if (data) setKingdomPlayerNames(data.map(d => d.linked_username!).filter(Boolean));
      });
  }, [kingdomNumber]);

  const nameSuggestions = useMemo(() => {
    if (!form.playerName.trim() || kingdomPlayerNames.length === 0) return [];
    const q = form.playerName.trim().toLowerCase();
    return kingdomPlayerNames.filter(n => n.toLowerCase().includes(q) && n.toLowerCase() !== q).slice(0, 8);
  }, [form.playerName, kingdomPlayerNames]);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const listMenuRef = useRef<HTMLDivElement>(null);
  const managerSearchRef = useRef<HTMLDivElement>(null);
  const undoStack = useRef<Array<{ mode: 'offense' | 'defense'; snapshot: BattlePlayerEntry[] }>>([]);

  // ── Load lists from Supabase ──
  useEffect(() => {
    if (!supabase || !kingdomNumber) {
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase.from('battle_tier_lists')
      .select('id, name, kingdom_number, created_at, updated_at, updated_by_username, players, defense_players, tier_overrides_offense, tier_overrides_defense')
      .eq('kingdom_number', kingdomNumber)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          logger.error('Failed to load battle tier lists:', error);
          setLoading(false);
          return;
        }
        const lists: BattleTierListMeta[] = (data || []).map(d => ({
          id: d.id,
          name: d.name,
          kingdom_number: d.kingdom_number,
          created_at: d.created_at,
          updated_at: d.updated_at,
          updated_by_username: d.updated_by_username,
          playerCount: (Array.isArray(d.players) ? d.players.length : 0) + (Array.isArray(d.defense_players) ? d.defense_players.length : 0),
        }));
        setListsIndex(lists);

        // Restore active list
        const savedId = localStorage.getItem(BATTLE_TIER_ACTIVE_LIST_KEY);
        const firstId = lists[0]?.id ?? null;
        const targetId = (savedId && lists.some(l => l.id === savedId)) ? savedId : firstId;

        if (targetId) {
          setActiveListIdState(targetId);
          const match = data?.find(d => d.id === targetId);
          if (match) {
            const p = Array.isArray(match.players) ? match.players as BattlePlayerEntry[] : [];
            const dp = Array.isArray(match.defense_players) ? match.defense_players as BattlePlayerEntry[] : [];
            setPlayers(recalculateAll(p));
            setDefensePlayers(recalculateAll(dp));
            setLastEditedBy(match.updated_by_username);
            // Load overrides from the match data
            if (match.tier_overrides_offense) setTierOverridesOffense(match.tier_overrides_offense as unknown as BattleTierOverrides);
            if (match.tier_overrides_defense) setTierOverridesDefense(match.tier_overrides_defense as unknown as BattleTierOverrides);
          }
        }
        setLoading(false);
      });
  }, [kingdomNumber, hasAccess]);

  // ── Persist to Supabase (debounced) ──
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistToSupabase = useCallback((listId: string, offPlayers: BattlePlayerEntry[], defPlayers: BattlePlayerEntry[]) => {
    if (!supabase || !user?.id) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const offValidation = validateBattlePlayers(offPlayers);
      if (offValidation) { logger.error('Battle tier offense validation failed:', offValidation); return; }
      const defValidation = validateBattlePlayers(defPlayers);
      if (defValidation) { logger.error('Battle tier defense validation failed:', defValidation); return; }
      const username = profile?.linked_username || profile?.display_name || profile?.username || 'Unknown';
      supabase!.from('battle_tier_lists')
        .update({
          players: offPlayers as unknown as Record<string, unknown>[],
          defense_players: defPlayers as unknown as Record<string, unknown>[],
          updated_by: user.id,
          updated_by_username: username,
          updated_at: new Date().toISOString(),
          tier_overrides_offense: tierOverridesOffense,
          tier_overrides_defense: tierOverridesDefense,
        })
        .eq('id', listId)
        .then(({ error }) => {
          if (error) logger.error('Battle tier save failed:', error);
          else setLastEditedBy(username);
        });

      // Update index counts
      setListsIndex(prev => prev.map(l =>
        l.id === listId ? { ...l, playerCount: offPlayers.length + defPlayers.length, updated_at: new Date().toISOString() } : l
      ));
    }, 800);
  }, [user?.id, profile, tierOverridesOffense, tierOverridesDefense]);

  // ── Auto-save on player changes ──
  const prevPlayersRef = useRef<string>('');
  const prevDefPlayersRef = useRef<string>('');
  useEffect(() => {
    if (!activeListId || loading) return;
    const offSerialized = JSON.stringify(players);
    const defSerialized = JSON.stringify(defensePlayers);
    if (offSerialized === prevPlayersRef.current && defSerialized === prevDefPlayersRef.current) return;
    prevPlayersRef.current = offSerialized;
    prevDefPlayersRef.current = defSerialized;
    persistToSupabase(activeListId, players, defensePlayers);
  }, [players, defensePlayers, activeListId, loading, persistToSupabase]);

  // ── Undo ──
  const pushUndo = useCallback((mode: 'offense' | 'defense', snapshot: BattlePlayerEntry[]) => {
    undoStack.current = [...undoStack.current.slice(-19), { mode, snapshot }];
  }, []);

  const [showUndoToast, setShowUndoToast] = useState(false);
  const handleUndo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const { mode, snapshot } = undoStack.current.pop()!;
    if (mode === 'offense') setPlayers(snapshot);
    else setDefensePlayers(snapshot);
    setShowUndoToast(true);
    setTimeout(() => setShowUndoToast(false), 2000);
  }, []);

  // ── Create list ──
  const handleCreateList = useCallback(async (name: string) => {
    if (!supabase || !user?.id || !kingdomNumber) return;
    const username = profile?.linked_username || profile?.display_name || profile?.username || 'Unknown';
    const { data, error } = await supabase.from('battle_tier_lists')
      .insert({
        kingdom_number: kingdomNumber,
        name: name || new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        players: [],
        defense_players: [],
        created_by: user.id,
        updated_by: user.id,
        updated_by_username: username,
      })
      .select('id, name, kingdom_number, created_at, updated_at, updated_by_username')
      .single();
    if (error || !data) {
      logger.error('Failed to create battle tier list:', error);
      return;
    }
    const meta: BattleTierListMeta = {
      id: data.id,
      name: data.name,
      kingdom_number: data.kingdom_number,
      created_at: data.created_at,
      updated_at: data.updated_at,
      updated_by_username: data.updated_by_username,
      playerCount: 0,
    };
    setListsIndex(prev => [...prev, meta]);
    setActiveListIdState(data.id);
    localStorage.setItem(BATTLE_TIER_ACTIVE_LIST_KEY, data.id);
    setPlayers([]);
    setDefensePlayers([]);
    setShowNewListPrompt(false);
    setNewListNameDraft('');
    setShowListMenu(false);
    setShowForm(false);
    setEditingId(null);
    setTierOverridesOffense(null);
    setTierOverridesDefense(null);
  }, [user?.id, kingdomNumber, profile]);

  // ── Switch list ──
  const handleSwitchList = useCallback(async (listId: string) => {
    if (!supabase) return;
    setActiveListIdState(listId);
    localStorage.setItem(BATTLE_TIER_ACTIVE_LIST_KEY, listId);
    setShowListMenu(false);
    setShowForm(false);
    setEditingId(null);

    const { data } = await supabase.from('battle_tier_lists')
      .select('players, defense_players, updated_by_username, tier_overrides_offense, tier_overrides_defense')
      .eq('id', listId)
      .single();
    if (data) {
      const p = Array.isArray(data.players) ? data.players as BattlePlayerEntry[] : [];
      const dp = Array.isArray(data.defense_players) ? data.defense_players as BattlePlayerEntry[] : [];
      setPlayers(recalculateAll(p));
      setDefensePlayers(recalculateAll(dp));
      setLastEditedBy(data.updated_by_username);
      setTierOverridesOffense(data.tier_overrides_offense as BattleTierOverrides | null);
      setTierOverridesDefense(data.tier_overrides_defense as BattleTierOverrides | null);
    }
  }, []);

  // ── Rename list ──
  const handleRenameList = useCallback(async (listId: string, newName: string) => {
    if (!supabase || !newName.trim()) return;
    await supabase.from('battle_tier_lists')
      .update({ name: newName.trim() })
      .eq('id', listId);
    setListsIndex(prev => prev.map(l =>
      l.id === listId ? { ...l, name: newName.trim() } : l
    ));
    setEditingListName(null);
  }, []);

  // ── Delete list ──
  const handleDeleteList = useCallback(async (listId: string) => {
    if (!supabase) return;
    await supabase.from('battle_tier_lists')
      .delete()
      .eq('id', listId);
    setListsIndex(prev => {
      const updated = prev.filter(l => l.id !== listId);
      if (activeListId === listId) {
        if (updated.length > 0 && updated[0]) {
          setActiveListIdState(updated[0].id);
          localStorage.setItem(BATTLE_TIER_ACTIVE_LIST_KEY, updated[0].id);
          // Reload that list
          handleSwitchList(updated[0].id);
        } else {
          setActiveListIdState(null);
          setPlayers([]);
        }
      }
      return updated;
    });
    setDeleteListConfirm(null);
    setShowListMenu(false);
  }, [activeListId, handleSwitchList]);

  // ── Form handlers ──
  const updateForm = useCallback((field: keyof FormState, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setFormError('');
  }, []);

  const handleSubmit = useCallback(() => {
    if (!form.playerName.trim()) {
      setFormError(t('battleTier.errorName', 'Player name is required.'));
      return;
    }
    if (!form.infantryHero || !form.cavalryHero || !form.archerHero) {
      setFormError(t('battleTier.errorHeroes', 'All three heroes must be selected.'));
      return;
    }
    if (form.infantryEGLevel < 0 || form.cavalryEGLevel < 0 || form.archerEGLevel < 0) {
      setFormError(t('battleTier.errorEG', 'All Exclusive Gear levels must be selected.'));
      return;
    }
    const statFields = [
      'infantryAttack', 'infantryLethality', 'infantryDefense', 'infantryHealth',
      'cavalryAttack', 'cavalryLethality', 'cavalryDefense', 'cavalryHealth',
      'archerAttack', 'archerLethality', 'archerDefense', 'archerHealth',
    ] as const;
    for (const f of statFields) {
      if (!form[f]) {
        setFormError(t('battleTier.errorStats', 'All stat values are required.'));
        return;
      }
    }

    const infAtk = parseFloat(form.infantryAttack) || 0;
    const infLeth = parseFloat(form.infantryLethality) || 0;
    const infDef = parseFloat(form.infantryDefense) || 0;
    const infHp = parseFloat(form.infantryHealth) || 0;
    const cavAtk = parseFloat(form.cavalryAttack) || 0;
    const cavLeth = parseFloat(form.cavalryLethality) || 0;
    const cavDef = parseFloat(form.cavalryDefense) || 0;
    const cavHp = parseFloat(form.cavalryHealth) || 0;
    const arcAtk = parseFloat(form.archerAttack) || 0;
    const arcLeth = parseFloat(form.archerLethality) || 0;
    const arcDef = parseFloat(form.archerDefense) || 0;
    const arcHp = parseFloat(form.archerHealth) || 0;

    const playerData = {
      infantryHero: form.infantryHero, infantryEGLevel: form.infantryEGLevel,
      infantryAttack: infAtk, infantryLethality: infLeth, infantryDefense: infDef, infantryHealth: infHp,
      cavalryHero: form.cavalryHero, cavalryEGLevel: form.cavalryEGLevel,
      cavalryAttack: cavAtk, cavalryLethality: cavLeth, cavalryDefense: cavDef, cavalryHealth: cavHp,
      archerHero: form.archerHero, archerEGLevel: form.archerEGLevel,
      archerAttack: arcAtk, archerLethality: arcLeth, archerDefense: arcDef, archerHealth: arcHp,
    };

    const hasCustomWeights = !isTroopWeightsDefault(offenseWeights) || !isTroopWeightsDefault(defenseWeights);
    const offenseScore = hasCustomWeights ? calculateWeightedOffenseScore(playerData, offenseWeights) : calculateOffenseScore(playerData);
    const defenseScore = hasCustomWeights ? calculateWeightedDefenseScore(playerData, defenseWeights) : calculateDefenseScore(playerData);

    const entry: BattlePlayerEntry = {
      id: editingId || genId(),
      playerName: form.playerName.trim(),
      ...playerData,
      offenseScore,
      defenseScore,
      offenseTier: 'D',
      defenseTier: 'D',
    };

    const currentPlayers = activeSection === 'offense' ? players : defensePlayers;
    pushUndo(activeSection, currentPlayers);
    const setter = activeSection === 'offense' ? setPlayers : setDefensePlayers;
    setter(prev => {
      let updated: BattlePlayerEntry[];
      if (editingId) {
        updated = prev.map(p => p.id === editingId ? entry : p);
      } else {
        updated = [...prev, entry];
      }
      return hasCustomWeights
        ? recalculateAllWeighted(updated, tierOverridesOffense, tierOverridesDefense, offenseWeights, defenseWeights)
        : recalculateAll(updated, tierOverridesOffense, tierOverridesDefense);
    });

    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setFormError('');
  }, [form, editingId, t, players, defensePlayers, activeSection, pushUndo, tierOverridesOffense, tierOverridesDefense, offenseWeights, defenseWeights]);

  const handleEdit = useCallback((player: BattlePlayerEntry) => {
    setForm({
      playerName: player.playerName,
      infantryHero: player.infantryHero, infantryEGLevel: player.infantryEGLevel,
      cavalryHero: player.cavalryHero, cavalryEGLevel: player.cavalryEGLevel,
      archerHero: player.archerHero, archerEGLevel: player.archerEGLevel,
      infantryAttack: player.infantryAttack.toString(), infantryLethality: player.infantryLethality.toString(),
      infantryDefense: player.infantryDefense.toString(), infantryHealth: player.infantryHealth.toString(),
      cavalryAttack: player.cavalryAttack.toString(), cavalryLethality: player.cavalryLethality.toString(),
      cavalryDefense: player.cavalryDefense.toString(), cavalryHealth: player.cavalryHealth.toString(),
      archerAttack: player.archerAttack.toString(), archerLethality: player.archerLethality.toString(),
      archerDefense: player.archerDefense.toString(), archerHealth: player.archerHealth.toString(),
    });
    setEditingId(player.id);
    setShowForm(true);
    setFormError('');
  }, []);

  const handleDelete = useCallback((playerId: string) => {
    const currentPlayers = activeSection === 'offense' ? players : defensePlayers;
    pushUndo(activeSection, currentPlayers);
    const setter = activeSection === 'offense' ? setPlayers : setDefensePlayers;
    setter(prev => {
      const updated = prev.filter(p => p.id !== playerId);
      return recalculateAll(updated, tierOverridesOffense, tierOverridesDefense);
    });
    setDeleteConfirm(null);
  }, [players, defensePlayers, activeSection, pushUndo, tierOverridesOffense, tierOverridesDefense]);

  const handleCancelForm = useCallback(() => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
  }, []);

  // ── Tier override handlers ──
  const handleSetOffenseOverrides = useCallback((overrides: BattleTierOverrides | null) => {
    setTierOverridesOffense(overrides);
    setPlayers(prev => recalculateAll(prev, overrides, tierOverridesDefense));
    setDefensePlayers(prev => recalculateAll(prev, overrides, tierOverridesDefense));
  }, [tierOverridesDefense]);

  const handleSetDefenseOverrides = useCallback((overrides: BattleTierOverrides | null) => {
    setTierOverridesDefense(overrides);
    setPlayers(prev => recalculateAll(prev, tierOverridesOffense, overrides));
    setDefensePlayers(prev => recalculateAll(prev, tierOverridesOffense, overrides));
  }, [tierOverridesOffense]);

  // ── Weight handlers ──
  const handleApplyWeights = useCallback((offW: BattleTroopWeights, defW: BattleTroopWeights) => {
    setOffenseWeights(offW);
    setDefenseWeights(defW);
    setPlayers(prev => recalculateAllWeighted(prev, tierOverridesOffense, tierOverridesDefense, offW, defW));
    setDefensePlayers(prev => recalculateAllWeighted(prev, tierOverridesOffense, tierOverridesDefense, offW, defW));
  }, [tierOverridesOffense, tierOverridesDefense]);

  const handleResetWeights = useCallback(() => {
    const def = structuredClone(DEFAULT_TROOP_WEIGHTS);
    setOffenseWeights(def);
    setDefenseWeights(structuredClone(DEFAULT_TROOP_WEIGHTS));
    setPlayers(prev => recalculateAll(prev, tierOverridesOffense, tierOverridesDefense));
    setDefensePlayers(prev => recalculateAll(prev, tierOverridesOffense, tierOverridesDefense));
  }, [tierOverridesOffense, tierOverridesDefense]);

  // ── Manager search ──
  const searchUsers = useCallback(async (query: string) => {
    if (!supabase || query.length < 2 || !kingdomNumber) { setManagerSearchResults([]); setShowManagerDropdown(false); return; }
    const sanitized = query.replace(/[%_\\'"(),.:!]/g, '');
    if (sanitized.length < 2) { setManagerSearchResults([]); setShowManagerDropdown(false); return; }
    try {
      const { data } = await supabase.from('profiles')
        .select('id, linked_username, username, linked_player_id')
        .eq('linked_kingdom', kingdomNumber)
        .or(`linked_username.ilike.%${sanitized}%,linked_player_id.ilike.%${sanitized}%,username.ilike.%${sanitized}%`)
        .limit(8);
      setManagerSearchResults(data || []);
      setShowManagerDropdown((data || []).length > 0);
    } catch { setManagerSearchResults([]); }
  }, [kingdomNumber]);

  // Debounced manager search
  useEffect(() => {
    const timer = setTimeout(() => { if (managerSearchInput.trim().length >= 2) searchUsers(managerSearchInput.trim()); }, 300);
    return () => clearTimeout(timer);
  }, [managerSearchInput, searchUsers]);

  // Click outside to close manager dropdown
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (managerSearchRef.current && !managerSearchRef.current.contains(e.target as Node)) {
        setShowManagerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ── Manager management ──
  const addManager = useCallback(async (userId: string, username: string) => {
    if (!supabase || !kingdomNumber || !user?.id) return false;
    const { error } = await supabase.from('battle_tier_list_managers')
      .insert({
        kingdom_number: kingdomNumber,
        user_id: userId,
        username,
        granted_by: user.id,
      });
    if (!error) {
      setManagers(prev => [...prev, { id: genId(), user_id: userId, username, kingdom_number: kingdomNumber }]);
      return true;
    }
    return false;
  }, [kingdomNumber, user?.id]);

  const removeManager = useCallback(async (userId: string) => {
    if (!supabase || !kingdomNumber) return;
    await supabase.from('battle_tier_list_managers')
      .delete()
      .eq('kingdom_number', kingdomNumber)
      .eq('user_id', userId);
    setManagers(prev => prev.filter(m => m.user_id !== userId));
  }, [kingdomNumber]);

  // ── CSV Export ──
  const handleExportCSV = useCallback((mode: 'offense' | 'defense') => {
    const sourceArray = mode === 'offense' ? players : defensePlayers;
    const complete = sourceArray.filter(isPlayerComplete);
    if (complete.length === 0) return;
    const ranked = mode === 'offense'
      ? [...complete].sort((a, b) => b.offenseScore - a.offenseScore)
      : [...complete].sort((a, b) => b.defenseScore - a.defenseScore);

    const headers = [
      'Rank', 'Player', 'Tier', 'Score',
      'INF Hero', 'INF EG', 'INF Atk', 'INF Lth', 'INF Def', 'INF HP',
      'CAV Hero', 'CAV EG', 'CAV Atk', 'CAV Lth', 'CAV Def', 'CAV HP',
      'ARC Hero', 'ARC EG', 'ARC Atk', 'ARC Lth', 'ARC Def', 'ARC HP',
    ];
    const rows = ranked.map((p, i) => [
      i + 1,
      `"${p.playerName}"`,
      mode === 'offense' ? p.offenseTier : p.defenseTier,
      (mode === 'offense' ? p.offenseScore : p.defenseScore).toFixed(1),
      `"${p.infantryHero}"`, p.infantryEGLevel, p.infantryAttack, p.infantryLethality, p.infantryDefense, p.infantryHealth,
      `"${p.cavalryHero}"`, p.cavalryEGLevel, p.cavalryAttack, p.cavalryLethality, p.cavalryDefense, p.cavalryHealth,
      `"${p.archerHero}"`, p.archerEGLevel, p.archerAttack, p.archerLethality, p.archerDefense, p.archerHealth,
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const listName = listsIndex.find(l => l.id === activeListId)?.name || 'battle-tier';
    a.download = `${listName}-${mode}-rankings.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [players, defensePlayers, listsIndex, activeListId]);

  // ── Ranked & incomplete players ──
  const { offenseRanked, defenseRanked, offenseIncomplete, defenseIncomplete } = useMemo(() => {
    const offComplete = players.filter(isPlayerComplete);
    const offInc = players.filter(p => !isPlayerComplete(p));
    const offRanked = [...offComplete].sort((a, b) => b.offenseScore - a.offenseScore).map((p, i) => ({ ...p, rank: i + 1 }));

    const defComplete = defensePlayers.filter(isPlayerComplete);
    const defInc = defensePlayers.filter(p => !isPlayerComplete(p));
    const defRanked = [...defComplete].sort((a, b) => b.defenseScore - a.defenseScore).map((p, i) => ({ ...p, rank: i + 1 }));

    return { offenseRanked: offRanked, defenseRanked: defRanked, offenseIncomplete: offInc, defenseIncomplete: defInc };
  }, [players, defensePlayers]);

  // ── Auto-computed tier boundaries ──
  const autoOffenseBoundaries = useMemo(() => {
    const complete = players.filter(isPlayerComplete);
    if (complete.length < 2) return null;
    const scores = complete.map(p => p.offenseScore);
    const b = computeTierBoundaries(scores);
    return { SS: b[0] ?? 0, S: b[1] ?? 0, A: b[2] ?? 0, B: b[3] ?? 0, C: b[4] ?? 0 };
  }, [players]);

  const autoDefenseBoundaries = useMemo(() => {
    const complete = defensePlayers.filter(isPlayerComplete);
    if (complete.length < 2) return null;
    const scores = complete.map(p => p.defenseScore);
    const b = computeTierBoundaries(scores);
    return { SS: b[0] ?? 0, S: b[1] ?? 0, A: b[2] ?? 0, B: b[3] ?? 0, C: b[4] ?? 0 };
  }, [defensePlayers]);

  // ── Close form on section change ──
  const handleSetActiveSection = useCallback((section: 'offense' | 'defense') => {
    setActiveSection(section);
    setShowForm(false);
    setShowBulkEdit(false);
    setShowBulkInput(false);
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
  }, []);

  return {
    // Auth & access
    kingdomNumber, hasAccess, canEdit, isEditor, isAdmin,
    // Lists
    listsIndex, activeListId, loading,
    // Players
    players, setPlayers, defensePlayers, setDefensePlayers,
    offenseRanked, defenseRanked, offenseIncomplete, defenseIncomplete,
    // Form
    form, setForm, editingId, setEditingId, formError, showForm, setShowForm,
    showBulkEdit, setShowBulkEdit,
    showBulkInput, setShowBulkInput,
    kingdomPlayerNames, nameSuggestions, showSuggestions, setShowSuggestions,
    nameInputRef, suggestionsRef,
    updateForm, handleSubmit, handleEdit, handleDelete, handleCancelForm,
    // List management
    showListMenu, setShowListMenu, listMenuRef,
    editingListName, setEditingListName, listNameDraft, setListNameDraft,
    showNewListPrompt, setShowNewListPrompt, newListNameDraft, setNewListNameDraft,
    handleCreateList, handleSwitchList, handleRenameList, handleDeleteList,
    deleteListConfirm, setDeleteListConfirm,
    // Undo
    pushUndo, handleUndo, undoStackLength: undoStack.current.length, showUndoToast,
    // Tier overrides
    tierOverridesOffense, tierOverridesDefense,
    handleSetOffenseOverrides, handleSetDefenseOverrides,
    autoOffenseBoundaries, autoDefenseBoundaries,
    // UI
    expandedCards, setExpandedCards, deleteConfirm, setDeleteConfirm,
    activeSection, setActiveSection: handleSetActiveSection, lastEditedBy,
    // Managers
    managers, addManager, removeManager,
    showManagerPanel, setShowManagerPanel,
    managerSearchInput, setManagerSearchInput,
    managerSearchResults, showManagerDropdown, setShowManagerDropdown,
    managerSearchRef,
    // Weights
    showWeightsPanel, setShowWeightsPanel,
    offenseWeights, defenseWeights,
    handleApplyWeights, handleResetWeights,
    // Export
    handleExportCSV,
  };
}
