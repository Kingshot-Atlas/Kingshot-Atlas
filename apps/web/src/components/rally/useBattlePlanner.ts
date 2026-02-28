import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { usePremium } from '../../contexts/PremiumContext';
import { useGoldKingdoms } from '../../hooks/useGoldKingdoms';
import { useKvk11Promo } from '../../hooks/useKvk11Promo';
import { useToast } from '../Toast';
import { ADMIN_USERNAMES } from '../../utils/constants';
import { supabase } from '../../lib/supabase';
import type {
  BuildingKey, HitMode, MarchType, RallyPlayer, RallySlot, RallyPreset,
} from './types';
import {
  BUFF_DURATION_MS, STORAGE_KEY_PLAYERS, STORAGE_KEY_PRESETS, STORAGE_KEY_BUFF_TIMERS,
  loadFromStorage, saveToStorage,
  playEnemyBuffExpireSound, playAllyBuffExpireSound,
  calculateRallyTimings, getBuildingLabel,
} from './types';
import { useTouchDragReorder } from './RallySubComponents';
import { useBattlePlannerSession } from './useBattlePlannerSession';
import { useBattlePlannerPlayers } from './useBattlePlannerPlayers';
import { useBattlePlannerQueues } from './useBattlePlannerQueues';

const BUILDINGS: BuildingKey[] = ['castle', 'turret1', 'turret2', 'turret3', 'turret4'];

export function useBattlePlanner() {
  const { profile, user } = useAuth();
  const { isAdmin: isPremiumAdmin } = usePremium();
  const goldKingdoms = useGoldKingdoms();
  const { hasPromoAccess } = useKvk11Promo();
  const { showToast } = useToast();
  const { t } = useTranslation();

  // ─── Access Gating ───
  const isAdmin = !!(profile?.username && ADMIN_USERNAMES.includes(profile.username.toLowerCase()));
  const isGoldKingdom = !!(profile?.linked_kingdom && goldKingdoms.has(profile.linked_kingdom));
  const hasSilverPromoAccess = !!(profile?.linked_kingdom && hasPromoAccess(profile.linked_kingdom));

  const hasOnboardingTrial = (() => {
    try {
      const raw = localStorage.getItem('atlas_onboarding_bpTrialStartedAt');
      if (!raw) return false;
      const startedAt = JSON.parse(raw);
      if (typeof startedAt !== 'number') return false;
      const used = localStorage.getItem('atlas_onboarding_bpTrialUsed');
      if (used === 'true') return false;
      return (Date.now() - startedAt) < 60 * 60 * 1000;
    } catch { return false; }
  })();

  const [isEditorOrCoEditor, setIsEditorOrCoEditor] = useState(false);
  useEffect(() => {
    if (!user?.id || !supabase) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('kingdom_editors')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();
        if (!cancelled) setIsEditorOrCoEditor(!!data);
      } catch { if (!cancelled) setIsEditorOrCoEditor(false); }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  useEffect(() => {
    if (isAdmin || isPremiumAdmin || isGoldKingdom || hasSilverPromoAccess || isEditorOrCoEditor || hasOnboardingTrial) {
      setHasAccess(true);
      return;
    }
    if (!user?.id || !supabase) { setHasAccess(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('tool_access')
          .select('id')
          .eq('user_id', user.id)
          .eq('tool', 'battle_planner')
          .maybeSingle();
        if (!cancelled) setHasAccess(!error && !!data);
      } catch { if (!cancelled) setHasAccess(false); }
    })();
    return () => { cancelled = true; };
  }, [isAdmin, isPremiumAdmin, isGoldKingdom, hasSilverPromoAccess, isEditorOrCoEditor, hasOnboardingTrial, user?.id]);

  // ─── Session Management ───
  const sessionHook = useBattlePlannerSession();

  // ─── Supabase-backed Players (when session active) ───
  const supabasePlayers = useBattlePlannerPlayers(sessionHook.session?.id ?? null);

  // ─── Supabase-backed Queues (when session active) ───
  const supabaseQueues = useBattlePlannerQueues(sessionHook.session?.id ?? null);

  // ─── Local fallback state (when no session) ───
  const [localPlayers, setLocalPlayers] = useState<RallyPlayer[]>(() => loadFromStorage(STORAGE_KEY_PLAYERS, []));
  const [localPresets, setLocalPresets] = useState<RallyPreset[]>(() => loadFromStorage(STORAGE_KEY_PRESETS, []));
  useEffect(() => { saveToStorage(STORAGE_KEY_PLAYERS, localPlayers); }, [localPlayers]);
  useEffect(() => { saveToStorage(STORAGE_KEY_PRESETS, localPresets); }, [localPresets]);

  // ─── Mode: session or local ───
  const inSession = !!sessionHook.session;
  const players = inSession ? supabasePlayers.players : localPlayers;
  const presets = localPresets; // presets stay local for now

  // ─── UI State ───
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingKey>('castle');
  const [marchType, setMarchType] = useState<MarchType>('regular');
  const [playerModalOpen, setPlayerModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<RallyPlayer | null>(null);
  const [defaultTeam, setDefaultTeam] = useState<'ally' | 'enemy'>('ally');
  const [presetName, setPresetName] = useState('');
  const [showPresetSave, setShowPresetSave] = useState(false);
  const [lastAnnouncement, setLastAnnouncement] = useState('');
  const [howToOpen, setHowToOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('atlas_rally_howToOpen');
      if (saved !== null) return saved === 'true';
      return window.innerWidth >= 768;
    } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem('atlas_rally_howToOpen', String(howToOpen)); } catch { /* noop */ }
  }, [howToOpen]);

  // ─── Buff Timers ───
  const [buffTimers, setBuffTimers] = useState<Record<string, number>>(() => {
    const stored = loadFromStorage<Record<string, number>>(STORAGE_KEY_BUFF_TIMERS, {});
    const now = Date.now();
    const valid: Record<string, number> = {};
    for (const [id, expiry] of Object.entries(stored)) {
      if (expiry > now) valid[id] = expiry;
    }
    return valid;
  });
  const [buffConfirmPopup, setBuffConfirmPopup] = useState<{ queueType: 'rally' | 'counter'; index: number } | null>(null);
  const [tickNow, setTickNow] = useState(Date.now());
  useEffect(() => { saveToStorage(STORAGE_KEY_BUFF_TIMERS, buffTimers); }, [buffTimers]);

  const buffTimerCount = Object.keys(buffTimers).length;
  useEffect(() => {
    if (!buffTimerCount) return;
    const id = window.setInterval(() => setTickNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [buffTimerCount]);

  // ─── Resolve queue slots from Supabase queue data ───
  const resolveSlots = useCallback((
    rawSlots: { playerId: string; useBuffed: boolean }[],
    building: BuildingKey,
    playerList: RallyPlayer[]
  ): RallySlot[] => {
    return rawSlots
      .map(s => {
        const player = playerList.find(p => p.id === s.playerId);
        if (!player) return null;
        const mt = player.marchTimes[building][s.useBuffed ? 'buffed' : 'regular'];
        if (mt <= 0) return null;
        return {
          playerId: player.id,
          playerName: player.name,
          marchTime: mt,
          team: player.team,
          useBuffed: s.useBuffed,
        };
      })
      .filter((s): s is RallySlot => s !== null);
  }, []);

  // ─── Rally Queue (resolved for current building) ───
  const rallyQueueRow = supabaseQueues.getQueue(selectedBuilding, 'rally');
  const counterQueueRow = supabaseQueues.getQueue(selectedBuilding, 'counter');

  // Local queue state (when no session)
  const [localRallyQueue, setLocalRallyQueue] = useState<RallySlot[]>([]);
  const [localCounterQueue, setLocalCounterQueue] = useState<RallySlot[]>([]);
  const [localHitMode, setLocalHitMode] = useState<HitMode>('simultaneous');
  const [localInterval, setLocalInterval] = useState(1);
  const [localCounterHitMode, setLocalCounterHitMode] = useState<HitMode>('simultaneous');
  const [localCounterInterval, setLocalCounterInterval] = useState(1);

  // Resolve queues from Supabase or local
  const rallyQueue = inSession
    ? resolveSlots(rallyQueueRow?.slots ?? [], selectedBuilding, players)
    : localRallyQueue;
  const counterQueue = inSession
    ? resolveSlots(counterQueueRow?.slots ?? [], selectedBuilding, players)
    : localCounterQueue;
  const hitMode = inSession ? (rallyQueueRow?.hit_mode ?? 'simultaneous') : localHitMode;
  const interval = inSession ? (rallyQueueRow?.interval_seconds ?? 1) : localInterval;
  const counterHitMode = inSession ? (counterQueueRow?.hit_mode ?? 'simultaneous') : localCounterHitMode;
  const counterInterval = inSession ? (counterQueueRow?.interval_seconds ?? 1) : localCounterInterval;

  // ─── Derived ───
  const allies = useMemo(() => players.filter(p => p.team === 'ally'), [players]);
  const enemies = useMemo(() => players.filter(p => p.team === 'enemy'), [players]);
  const gap = hitMode === 'simultaneous' ? 0 : interval;
  const cGap = counterHitMode === 'simultaneous' ? 0 : counterInterval;
  const calculatedRallies = useMemo(() => calculateRallyTimings(rallyQueue, gap), [rallyQueue, gap]);
  const calculatedCounters = useMemo(() => calculateRallyTimings(counterQueue, cGap), [counterQueue, cGap]);
  const queuedPlayerIds = useMemo(() => new Set(rallyQueue.map(s => s.playerId)), [rallyQueue]);
  const counterQueuedIds = useMemo(() => new Set(counterQueue.map(s => s.playerId)), [counterQueue]);

  const getMarchTime = useCallback((player: RallyPlayer, useBuffed: boolean) => {
    const mt = player.marchTimes[selectedBuilding];
    if (useBuffed && mt.buffed > 0) return mt.buffed;
    return mt.regular;
  }, [selectedBuilding]);

  const rallyQueueRef = useRef<HTMLDivElement>(null);
  const counterQueueRef = useRef<HTMLDivElement>(null);

  // ─── Queue Setters (bridge Supabase and local) ───
  const persistRallySlots = useCallback((slots: RallySlot[]) => {
    if (inSession) {
      supabaseQueues.updateQueueSlots(
        selectedBuilding,
        'rally',
        slots.map(s => ({ playerId: s.playerId, useBuffed: s.useBuffed }))
      );
    } else {
      setLocalRallyQueue(slots);
    }
  }, [inSession, selectedBuilding, supabaseQueues]);

  const persistCounterSlots = useCallback((slots: RallySlot[]) => {
    if (inSession) {
      supabaseQueues.updateQueueSlots(
        selectedBuilding,
        'counter',
        slots.map(s => ({ playerId: s.playerId, useBuffed: s.useBuffed }))
      );
    } else {
      setLocalCounterQueue(slots);
    }
  }, [inSession, selectedBuilding, supabaseQueues]);

  // ─── Actions ───
  const addToQueue = useCallback((player: RallyPlayer, useBuffed: boolean = false) => {
    if (queuedPlayerIds.has(player.id)) return;
    const mt = getMarchTime(player, useBuffed);
    if (mt <= 0) {
      showToast(t('battlePlanner.noMarchTime', 'Set march times for {{building}} first', { building: getBuildingLabel(selectedBuilding, t) }), 'info');
      return;
    }
    const newSlot: RallySlot = { playerId: player.id, playerName: player.name, marchTime: mt, team: player.team, useBuffed };
    persistRallySlots([...rallyQueue, newSlot]);
    if ('vibrate' in navigator) navigator.vibrate(30);
    setLastAnnouncement(`${player.name} added to rally queue`);
    requestAnimationFrame(() => { rallyQueueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });
  }, [queuedPlayerIds, getMarchTime, persistRallySlots, rallyQueue, showToast, t, selectedBuilding]);

  const addToCounterQueue = useCallback((player: RallyPlayer, useBuffed: boolean = false) => {
    if (counterQueuedIds.has(player.id)) return;
    const mt = getMarchTime(player, useBuffed);
    if (mt <= 0) {
      showToast(t('battlePlanner.noMarchTime', 'Set march times for {{building}} first', { building: getBuildingLabel(selectedBuilding, t) }), 'info');
      return;
    }
    const newSlot: RallySlot = { playerId: player.id, playerName: player.name, marchTime: mt, team: player.team, useBuffed };
    persistCounterSlots([...counterQueue, newSlot]);
    if ('vibrate' in navigator) navigator.vibrate(30);
    setLastAnnouncement(`${player.name} added to counter queue`);
    requestAnimationFrame(() => { counterQueueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });
  }, [counterQueuedIds, getMarchTime, persistCounterSlots, counterQueue, showToast, t, selectedBuilding]);

  const removeFromQueue = useCallback((index: number) => {
    const removed = rallyQueue[index];
    if (removed) setLastAnnouncement(`${removed.playerName} removed from rally queue`);
    persistRallySlots(rallyQueue.filter((_, i) => i !== index));
    if ('vibrate' in navigator) navigator.vibrate([15, 30, 15]);
  }, [rallyQueue, persistRallySlots]);

  const removeFromCounterQueue = useCallback((index: number) => {
    const removed = counterQueue[index];
    if (removed) setLastAnnouncement(`${removed.playerName} removed from counter queue`);
    persistCounterSlots(counterQueue.filter((_, i) => i !== index));
    if ('vibrate' in navigator) navigator.vibrate([15, 30, 15]);
  }, [counterQueue, persistCounterSlots]);

  const moveInQueue = useCallback((from: number, to: number) => {
    const next = [...rallyQueue];
    const removed = next.splice(from, 1);
    if (removed[0]) next.splice(to, 0, removed[0]);
    persistRallySlots(next);
  }, [rallyQueue, persistRallySlots]);

  const moveInCounterQueue = useCallback((from: number, to: number) => {
    const next = [...counterQueue];
    const removed = next.splice(from, 1);
    if (removed[0]) next.splice(to, 0, removed[0]);
    persistCounterSlots(next);
  }, [counterQueue, persistCounterSlots]);

  const setHitMode = useCallback((m: HitMode) => {
    if (inSession) {
      supabaseQueues.updateQueueHitMode(selectedBuilding, 'rally', m);
    } else {
      setLocalHitMode(m);
    }
  }, [inSession, selectedBuilding, supabaseQueues]);

  const setInterval = useCallback((n: number) => {
    if (inSession) {
      supabaseQueues.updateQueueInterval(selectedBuilding, 'rally', n);
    } else {
      setLocalInterval(n);
    }
  }, [inSession, selectedBuilding, supabaseQueues]);

  const setCounterHitMode = useCallback((m: HitMode) => {
    if (inSession) {
      supabaseQueues.updateQueueHitMode(selectedBuilding, 'counter', m);
    } else {
      setLocalCounterHitMode(m);
    }
  }, [inSession, selectedBuilding, supabaseQueues]);

  const setCounterInterval = useCallback((n: number) => {
    if (inSession) {
      supabaseQueues.updateQueueInterval(selectedBuilding, 'counter', n);
    } else {
      setLocalCounterInterval(n);
    }
  }, [inSession, selectedBuilding, supabaseQueues]);

  // ─── Toggle Buff ───
  const toggleBuff = useCallback((queueType: 'rally' | 'counter', index: number, forceOff?: boolean) => {
    const queue = queueType === 'rally' ? rallyQueue : counterQueue;
    const slot = queue[index];
    if (!slot) return;

    if (slot.useBuffed && !forceOff) {
      setBuffConfirmPopup({ queueType, index });
      return;
    }

    const newQueue = queue.map((s, i) => {
      if (i !== index) return s;
      const player = players.find(p => p.id === s.playerId);
      if (!player) return s;
      const newBuffed = !s.useBuffed;
      const mt = getMarchTime(player, newBuffed);
      if (mt <= 0) return s;
      return { ...s, useBuffed: newBuffed, marchTime: mt };
    });

    if (queueType === 'rally') persistRallySlots(newQueue);
    else persistCounterSlots(newQueue);

    const newBuffed = !slot.useBuffed;
    if (newBuffed) {
      setBuffTimers(prev => ({ ...prev, [slot.playerId]: Date.now() + BUFF_DURATION_MS }));
    } else {
      setBuffTimers(prev => { const next = { ...prev }; delete next[slot.playerId]; return next; });
    }
  }, [players, getMarchTime, rallyQueue, counterQueue, persistRallySlots, persistCounterSlots]);

  // ─── Auto-expire buff timers ───
  const buffTimersRef = useRef(buffTimers);
  buffTimersRef.current = buffTimers;
  const playersRef = useRef(players);
  playersRef.current = players;
  const selectedBuildingRef = useRef(selectedBuilding);
  selectedBuildingRef.current = selectedBuilding;

  useEffect(() => {
    const now = Date.now();
    const expiredIds = Object.entries(buffTimersRef.current)
      .filter(([, expiry]) => now >= expiry)
      .map(([id]) => id);
    if (expiredIds.length === 0) return;

    const expiredPlayers = expiredIds.map(id => {
      const p = playersRef.current.find(pl => pl.id === id);
      return { id, name: p?.name ?? 'Player', team: p?.team ?? ('ally' as const) };
    });

    setBuffTimers(prev => {
      const next = { ...prev };
      expiredIds.forEach(id => delete next[id]);
      return next;
    });

    const hasEnemy = expiredPlayers.some(p => p.team === 'enemy');
    const hasAlly = expiredPlayers.some(p => p.team === 'ally');
    if (hasEnemy) playEnemyBuffExpireSound();
    if (hasAlly) playAllyBuffExpireSound();
    expiredPlayers.forEach(({ name, team }) => {
      showToast(
        team === 'enemy'
          ? `⚔️ ${name}'s buff expired — switched to regular march time`
          : `🏃 ${name}'s buff expired — switched to regular march time`,
        'info'
      );
    });
  }, [tickNow, showToast]);

  // ─── Drop Handlers ───
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const playerId = e.dataTransfer.getData('text/plain');
    const player = players.find(p => p.id === playerId);
    if (player) addToQueue(player, marchType === 'buffed');
  }, [players, addToQueue, marchType]);

  const handleCounterDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const playerId = e.dataTransfer.getData('text/plain');
    const player = players.find(p => p.id === playerId);
    if (player) addToCounterQueue(player, marchType === 'buffed');
  }, [players, addToCounterQueue, marchType]);

  // ─── Player CRUD ───
  const handleSavePlayer = useCallback(async (player: RallyPlayer) => {
    if (inSession) {
      if (editingPlayer) {
        await supabasePlayers.updatePlayer(player);
      } else {
        await supabasePlayers.addPlayer({ name: player.name, team: player.team, marchTimes: player.marchTimes });
      }
    } else {
      setLocalPlayers(prev => {
        const idx = prev.findIndex(p => p.id === player.id);
        if (idx >= 0) { const next = [...prev]; next[idx] = player; return next; }
        return [...prev, player];
      });
    }
    setEditingPlayer(null);
  }, [inSession, editingPlayer, supabasePlayers]);

  const handleDeletePlayer = useCallback(async (id: string) => {
    if (inSession) {
      await supabasePlayers.deletePlayer(id);
    } else {
      const deletedPlayer = localPlayers.find(p => p.id === id);
      if (!deletedPlayer) return;
      setLocalPlayers(prev => prev.filter(p => p.id !== id));
      setLocalRallyQueue(prev => prev.filter(s => s.playerId !== id));
      setLocalCounterQueue(prev => prev.filter(s => s.playerId !== id));
      showToast(`${deletedPlayer.name} deleted`, 'info');
    }
  }, [inSession, localPlayers, supabasePlayers, showToast]);

  const exportPlayers = useCallback(() => {
    if (inSession) {
      supabasePlayers.exportPlayers();
    } else {
      const data = JSON.stringify(localPlayers, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `battle-planner-players-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      URL.revokeObjectURL(url);
      showToast('Player database exported', 'success');
    }
  }, [inSession, localPlayers, supabasePlayers, showToast]);

  const importPlayers = useCallback(async (jsonStr: string) => {
    if (inSession) {
      await supabasePlayers.importPlayers(jsonStr);
    } else {
      try {
        const parsed = JSON.parse(jsonStr);
        if (!Array.isArray(parsed)) throw new Error('Invalid');
        const valid = parsed.filter(
          (p: unknown): p is RallyPlayer =>
            typeof p === 'object' && p !== null && 'name' in p && 'team' in p && 'marchTimes' in p
        );
        if (valid.length === 0) { showToast('No valid players found', 'error'); return; }
        setLocalPlayers(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newP = valid.filter(p => !existingIds.has(p.id));
          showToast(`Imported ${newP.length} player(s)`, 'success');
          return [...prev, ...newP];
        });
      } catch { showToast('Failed to import', 'error'); }
    }
  }, [inSession, supabasePlayers, showToast]);

  const duplicatePlayer = useCallback(async (id: string) => {
    if (inSession) {
      await supabasePlayers.duplicatePlayer(id);
    } else {
      const original = localPlayers.find(p => p.id === id);
      if (!original) return;
      const copy: RallyPlayer = {
        ...original,
        id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: `${original.name} (copy)`,
      };
      setLocalPlayers(prev => [...prev, copy]);
      showToast(`📋 ${copy.name} created`, 'success');
    }
  }, [inSession, localPlayers, supabasePlayers, showToast]);

  // ─── Preset Handlers (local only for now) ───
  const savePreset = useCallback(() => {
    if (!presetName.trim() || (rallyQueue.length === 0 && counterQueue.length === 0)) return;
    const preset: RallyPreset = {
      id: `preset_${Date.now()}`,
      name: presetName.trim(),
      building: selectedBuilding,
      hitMode,
      interval,
      slots: rallyQueue.map(s => ({ playerId: s.playerId, useBuffed: s.useBuffed })),
      counterSlots: counterQueue.length > 0 ? counterQueue.map(s => ({ playerId: s.playerId, useBuffed: s.useBuffed })) : undefined,
      counterHitMode: counterQueue.length > 0 ? counterHitMode : undefined,
      counterInterval: counterQueue.length > 0 ? counterInterval : undefined,
    };
    setLocalPresets(prev => [...prev, preset]);
    setPresetName('');
    setShowPresetSave(false);
  }, [presetName, rallyQueue, counterQueue, selectedBuilding, hitMode, interval, counterHitMode, counterInterval]);

  const loadPreset = useCallback((preset: RallyPreset) => {
    setSelectedBuilding(preset.building);
    if (inSession) {
      supabaseQueues.updateQueueHitMode(preset.building, 'rally', preset.hitMode);
      supabaseQueues.updateQueueInterval(preset.building, 'rally', preset.interval);
    } else {
      setLocalHitMode(preset.hitMode);
      setLocalInterval(preset.interval);
    }
    const resolvedSlots = resolveSlots(preset.slots, preset.building, players);
    if (inSession) {
      supabaseQueues.updateQueueSlots(preset.building, 'rally', preset.slots);
    } else {
      setLocalRallyQueue(resolvedSlots);
    }
    if (preset.counterSlots && preset.counterSlots.length > 0) {
      const resolvedCounter = resolveSlots(preset.counterSlots, preset.building, players);
      if (inSession) {
        supabaseQueues.updateQueueSlots(preset.building, 'counter', preset.counterSlots);
        if (preset.counterHitMode) supabaseQueues.updateQueueHitMode(preset.building, 'counter', preset.counterHitMode);
        if (preset.counterInterval != null) supabaseQueues.updateQueueInterval(preset.building, 'counter', preset.counterInterval);
      } else {
        setLocalCounterQueue(resolvedCounter);
        if (preset.counterHitMode) setLocalCounterHitMode(preset.counterHitMode);
        if (preset.counterInterval != null) setLocalCounterInterval(preset.counterInterval);
      }
    }
  }, [inSession, players, resolveSlots, supabaseQueues]);

  const deletePreset = useCallback((id: string) => {
    setLocalPresets(prev => prev.filter(p => p.id !== id));
  }, []);

  // ─── Clear Queue ───
  const clearQueue = useCallback(() => {
    if (rallyQueue.length === 0) return;
    persistRallySlots([]);
    setLastAnnouncement('Rally queue cleared');
    showToast(`Rally queue cleared (${rallyQueue.length} players)`, 'info');
  }, [rallyQueue, persistRallySlots, showToast]);

  const clearCounterQueue = useCallback(() => {
    if (counterQueue.length === 0) return;
    persistCounterSlots([]);
    setLastAnnouncement('Counter queue cleared');
    showToast(`Counter queue cleared (${counterQueue.length} players)`, 'info');
  }, [counterQueue, persistCounterSlots, showToast]);

  // ─── Touch Drag ───
  const rallyTouchDrag = useTouchDragReorder(moveInQueue);
  const counterTouchDrag = useTouchDragReorder(moveInCounterQueue);

  // ─── Cross-building stats ───
  const playerBuildingAssignments = useMemo(() => {
    if (!inSession) return new Map<string, BuildingKey[]>();
    return supabaseQueues.getPlayerBuildingAssignments();
  }, [inSession, supabaseQueues]);

  // ─── Building queue summaries (for tabbed UI badges) ───
  const buildingQueueCounts = useMemo(() => {
    const counts: Record<BuildingKey, { rally: number; counter: number }> = {
      castle: { rally: 0, counter: 0 },
      turret1: { rally: 0, counter: 0 },
      turret2: { rally: 0, counter: 0 },
      turret3: { rally: 0, counter: 0 },
      turret4: { rally: 0, counter: 0 },
    };
    if (!inSession) return counts;
    for (const b of BUILDINGS) {
      const rq = supabaseQueues.getQueue(b, 'rally');
      const cq = supabaseQueues.getQueue(b, 'counter');
      counts[b] = {
        rally: rq?.slots?.length ?? 0,
        counter: cq?.slots?.length ?? 0,
      };
    }
    return counts;
  }, [inSession, supabaseQueues]);

  // ─── Migration helper ───
  const migrateLocalData = useCallback(async () => {
    if (!inSession || localPlayers.length === 0) return;
    const migrated = await supabasePlayers.migrateFromLocalStorage(localPlayers);
    if (migrated > 0) {
      showToast(`Migrated ${migrated} player(s) from local storage`, 'success');
    }
  }, [inSession, localPlayers, supabasePlayers, showToast]);

  return {
    // State
    players, presets,
    selectedBuilding, hitMode, interval, marchType,
    rallyQueue, counterQueue, counterHitMode, counterInterval,
    playerModalOpen, editingPlayer, defaultTeam,
    presetName, showPresetSave, howToOpen,
    buffTimers, buffConfirmPopup, tickNow,
    hasAccess, lastAnnouncement,
    // Actions
    setSelectedBuilding, setHitMode, setInterval, setMarchType,
    setCounterHitMode, setCounterInterval,
    setPlayerModalOpen, setEditingPlayer, setDefaultTeam,
    setPresetName, setShowPresetSave, setHowToOpen,
    setBuffConfirmPopup,
    addToQueue, addToCounterQueue,
    removeFromQueue, removeFromCounterQueue,
    moveInQueue, moveInCounterQueue,
    toggleBuff,
    handleDrop, handleCounterDrop,
    handleSavePlayer, handleDeletePlayer,
    exportPlayers, importPlayers, duplicatePlayer,
    savePreset, loadPreset, deletePreset,
    clearQueue, clearCounterQueue, setLastAnnouncement,
    // Derived
    allies, enemies,
    gap, cGap,
    calculatedRallies, calculatedCounters,
    queuedPlayerIds, counterQueuedIds,
    isAdmin,
    rallyTouchDrag, counterTouchDrag,
    rallyQueueRef, counterQueueRef,
    // New: session management
    session: sessionHook.session,
    sessions: sessionHook.sessions,
    leaders: sessionHook.leaders,
    isSessionLoading: sessionHook.isLoading,
    isReadOnly: sessionHook.isReadOnly,
    isSessionEditor: sessionHook.isSessionEditor,
    createSession: sessionHook.createSession,
    archiveSession: sessionHook.archiveSession,
    activateSession: sessionHook.activateSession,
    deleteSession: sessionHook.deleteSession,
    addLeader: sessionHook.addLeader,
    updateLeaderAssignment: sessionHook.updateLeaderAssignment,
    removeLeader: sessionHook.removeLeader,
    inSession,
    playerBuildingAssignments,
    buildingQueueCounts,
    migrateLocalData,
    isPlayersLoading: supabasePlayers.isLoading,
    isQueuesLoading: supabaseQueues.isLoading,
    kingdomNumber: profile?.linked_kingdom ?? null,
  };
}
