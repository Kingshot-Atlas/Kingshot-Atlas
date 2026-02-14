import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { usePremium } from '../../contexts/PremiumContext';
import { useToast } from '../Toast';
import { ADMIN_USERNAMES } from '../../utils/constants';
import { supabase } from '../../lib/supabase';
import type {
  BuildingKey, HitMode, MarchType, RallyPlayer, RallySlot, RallyPreset, CalculatedRally,
} from './types';
import {
  BUFF_DURATION_MS, STORAGE_KEY_PLAYERS, STORAGE_KEY_PRESETS, STORAGE_KEY_BUFF_TIMERS,
  loadFromStorage, saveToStorage,
  playEnemyBuffExpireSound, playAllyBuffExpireSound,
  calculateRallyTimings,
} from './types';
import { useTouchDragReorder } from './RallySubComponents';

export interface RallyCoordinatorState {
  players: RallyPlayer[];
  presets: RallyPreset[];
  selectedBuilding: BuildingKey;
  hitMode: HitMode;
  interval: number;
  marchType: MarchType;
  rallyQueue: RallySlot[];
  counterQueue: RallySlot[];
  counterHitMode: HitMode;
  counterInterval: number;
  playerModalOpen: boolean;
  editingPlayer: RallyPlayer | null;
  defaultTeam: 'ally' | 'enemy';
  presetName: string;
  showPresetSave: boolean;
  howToOpen: boolean;
  buffTimers: Record<string, number>;
  buffConfirmPopup: { queueType: 'rally' | 'counter'; index: number } | null;
  tickNow: number;
  hasAccess: boolean | null;
}

export interface RallyCoordinatorActions {
  setSelectedBuilding: (b: BuildingKey) => void;
  setHitMode: (m: HitMode) => void;
  setInterval: (n: number) => void;
  setMarchType: (m: MarchType) => void;
  setCounterHitMode: (m: HitMode) => void;
  setCounterInterval: (n: number) => void;
  setPlayerModalOpen: (open: boolean) => void;
  setEditingPlayer: (p: RallyPlayer | null) => void;
  setDefaultTeam: (t: 'ally' | 'enemy') => void;
  setPresetName: (n: string) => void;
  setShowPresetSave: (s: boolean) => void;
  setHowToOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setBuffConfirmPopup: (p: RallyCoordinatorState['buffConfirmPopup']) => void;
  addToQueue: (player: RallyPlayer, useBuffed?: boolean) => void;
  addToCounterQueue: (player: RallyPlayer, useBuffed?: boolean) => void;
  removeFromQueue: (index: number) => void;
  removeFromCounterQueue: (index: number) => void;
  moveInQueue: (from: number, to: number) => void;
  moveInCounterQueue: (from: number, to: number) => void;
  toggleBuff: (queueType: 'rally' | 'counter', index: number, forceOff?: boolean) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleCounterDrop: (e: React.DragEvent) => void;
  handleSavePlayer: (player: RallyPlayer) => void;
  handleDeletePlayer: (id: string) => void;
  savePreset: () => void;
  loadPreset: (preset: RallyPreset) => void;
  deletePreset: (id: string) => void;
  clearQueue: () => void;
  clearCounterQueue: () => void;
}

export interface RallyCoordinatorDerived {
  allies: RallyPlayer[];
  enemies: RallyPlayer[];
  gap: number;
  cGap: number;
  calculatedRallies: CalculatedRally[];
  calculatedCounters: CalculatedRally[];
  queuedPlayerIds: Set<string>;
  counterQueuedIds: Set<string>;
  isAdmin: boolean;
  rallyTouchDrag: ReturnType<typeof useTouchDragReorder>;
  counterTouchDrag: ReturnType<typeof useTouchDragReorder>;
}

export function useRallyCoordinator(): RallyCoordinatorState & RallyCoordinatorActions & RallyCoordinatorDerived {
  const { profile, user } = useAuth();
  const { isSupporter, isAdmin: isPremiumAdmin } = usePremium();
  const { showToast } = useToast();

  // Admin gate
  const isAdmin = !!(profile?.username && ADMIN_USERNAMES.includes(profile.username.toLowerCase()));

  // Free trial: Feb 12 00:00 UTC → Feb 25 00:00 UTC
  const TRIAL_START = new Date('2026-02-12T00:00:00Z').getTime();
  const TRIAL_END = new Date('2026-02-25T00:00:00Z').getTime();
  const isTrialActive = Date.now() >= TRIAL_START && Date.now() < TRIAL_END;

  // Onboarding 1-hour trial check (Stage 3)
  const hasOnboardingTrial = (() => {
    try {
      const raw = localStorage.getItem('atlas_onboarding_bpTrialStartedAt');
      if (!raw) return false;
      const startedAt = JSON.parse(raw);
      if (typeof startedAt !== 'number') return false;
      const used = localStorage.getItem('atlas_onboarding_bpTrialUsed');
      if (used === 'true') return false;
      return (Date.now() - startedAt) < 60 * 60 * 1000; // 1 hour
    } catch { return false; }
  })();

  // Access gate
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    if (isAdmin || isPremiumAdmin || isSupporter || isTrialActive || hasOnboardingTrial) {
      setHasAccess(true);
      return;
    }
    if (!user?.id || !supabase) {
      setHasAccess(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('battle_planner_access')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (!cancelled) {
          setHasAccess(!error && !!data);
        }
      } catch {
        if (!cancelled) setHasAccess(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isAdmin, isPremiumAdmin, isSupporter, isTrialActive, hasOnboardingTrial, user?.id]);

  // State: Unified player database (allies + enemies)
  const [players, setPlayers] = useState<RallyPlayer[]>(() => loadFromStorage(STORAGE_KEY_PLAYERS, []));
  const [presets, setPresets] = useState<RallyPreset[]>(() => loadFromStorage(STORAGE_KEY_PRESETS, []));

  // State: Configuration
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingKey>('castle');
  const [hitMode, setHitMode] = useState<HitMode>('simultaneous');
  const [interval, setInterval] = useState(1);
  const [marchType, setMarchType] = useState<MarchType>('regular');

  // State: Rally queue
  const [rallyQueue, setRallyQueue] = useState<RallySlot[]>([]);

  // State: Counter-rally
  const [counterQueue, setCounterQueue] = useState<RallySlot[]>([]);
  const [counterHitMode, setCounterHitMode] = useState<HitMode>('simultaneous');
  const [counterInterval, setCounterInterval] = useState(1);

  // State: Modals
  const [playerModalOpen, setPlayerModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<RallyPlayer | null>(null);
  const [defaultTeam, setDefaultTeam] = useState<'ally' | 'enemy'>('ally');
  const [presetName, setPresetName] = useState('');
  const [showPresetSave, setShowPresetSave] = useState(false);
  const [howToOpen, setHowToOpen] = useState(true);

  // State: Enemy buff timers (playerId -> expiry timestamp in ms)
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

  // Persist
  useEffect(() => { saveToStorage(STORAGE_KEY_PLAYERS, players); }, [players]);
  useEffect(() => { saveToStorage(STORAGE_KEY_PRESETS, presets); }, [presets]);
  useEffect(() => { saveToStorage(STORAGE_KEY_BUFF_TIMERS, buffTimers); }, [buffTimers]);

  // Tick every second when buff timers are active
  useEffect(() => {
    const hasTimers = Object.keys(buffTimers).length > 0;
    if (!hasTimers) return;
    const id = window.setInterval(() => setTickNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [Object.keys(buffTimers).length]);

  // Auto-expire buff timers
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

    const toggleOffExpired = (prev: RallySlot[]) => prev.map(slot => {
      if (!expiredIds.includes(slot.playerId) || !slot.useBuffed) return slot;
      const player = playersRef.current.find(p => p.id === slot.playerId);
      if (!player) return slot;
      const mt = player.marchTimes[selectedBuildingRef.current].regular;
      if (mt <= 0) return slot;
      return { ...slot, useBuffed: false, marchTime: mt };
    });
    setRallyQueue(toggleOffExpired);
    setCounterQueue(toggleOffExpired);

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

  // Derived: allies and enemies
  const allies = useMemo(() => players.filter(p => p.team === 'ally'), [players]);
  const enemies = useMemo(() => players.filter(p => p.team === 'enemy'), [players]);

  // Compute gaps
  const gap = hitMode === 'simultaneous' ? 0 : interval;
  const cGap = counterHitMode === 'simultaneous' ? 0 : counterInterval;

  // Calculated rallies
  const calculatedRallies = useMemo(
    () => calculateRallyTimings(rallyQueue, gap),
    [rallyQueue, gap]
  );
  const calculatedCounters = useMemo(
    () => calculateRallyTimings(counterQueue, cGap),
    [counterQueue, cGap]
  );

  // Player IDs in queues
  const queuedPlayerIds = useMemo(() => new Set(rallyQueue.map(s => s.playerId)), [rallyQueue]);
  const counterQueuedIds = useMemo(() => new Set(counterQueue.map(s => s.playerId)), [counterQueue]);

  // Helper: resolve march time for a player
  const getMarchTime = useCallback((player: RallyPlayer, useBuffed: boolean) => {
    const mt = player.marchTimes[selectedBuilding];
    if (useBuffed && mt.buffed > 0) return mt.buffed;
    return mt.regular;
  }, [selectedBuilding]);

  // Add player to rally queue
  const addToQueue = useCallback((player: RallyPlayer, useBuffed: boolean = false) => {
    if (queuedPlayerIds.has(player.id)) return;
    const mt = getMarchTime(player, useBuffed);
    if (mt <= 0) return;
    setRallyQueue(prev => [...prev, {
      playerId: player.id,
      playerName: player.name,
      marchTime: mt,
      team: player.team,
      useBuffed,
    }]);
  }, [queuedPlayerIds, getMarchTime]);

  // Add player to counter-rally queue
  const addToCounterQueue = useCallback((player: RallyPlayer, useBuffed: boolean = false) => {
    if (counterQueuedIds.has(player.id)) return;
    const mt = getMarchTime(player, useBuffed);
    if (mt <= 0) return;
    setCounterQueue(prev => [...prev, {
      playerId: player.id,
      playerName: player.name,
      marchTime: mt,
      team: player.team,
      useBuffed,
    }]);
  }, [counterQueuedIds, getMarchTime]);

  // Queue operations
  const removeFromQueue = useCallback((index: number) => {
    setRallyQueue(prev => prev.filter((_, i) => i !== index));
  }, []);

  const removeFromCounterQueue = useCallback((index: number) => {
    setCounterQueue(prev => prev.filter((_, i) => i !== index));
  }, []);

  const moveInQueue = useCallback((from: number, to: number) => {
    setRallyQueue(prev => {
      const next = [...prev];
      const removed = next.splice(from, 1);
      if (removed[0]) next.splice(to, 0, removed[0]);
      return next;
    });
  }, []);

  const moveInCounterQueue = useCallback((from: number, to: number) => {
    setCounterQueue(prev => {
      const next = [...prev];
      const removed = next.splice(from, 1);
      if (removed[0]) next.splice(to, 0, removed[0]);
      return next;
    });
  }, []);

  // Toggle buff for a queue slot
  const toggleBuff = useCallback((queueType: 'rally' | 'counter', index: number, forceOff?: boolean) => {
    const queue = queueType === 'rally' ? rallyQueue : counterQueue;
    const slot = queue[index];
    if (!slot) return;

    if (slot.useBuffed && !forceOff && buffTimers[slot.playerId]) {
      setBuffConfirmPopup({ queueType, index });
      return;
    }

    const setter = queueType === 'rally' ? setRallyQueue : setCounterQueue;
    setter(prev => prev.map((s, i) => {
      if (i !== index) return s;
      const player = players.find(p => p.id === s.playerId);
      if (!player) return s;
      const newBuffed = !s.useBuffed;
      const mt = getMarchTime(player, newBuffed);
      if (mt <= 0) return s;
      return { ...s, useBuffed: newBuffed, marchTime: mt };
    }));

    const newBuffed = !slot.useBuffed;
    if (newBuffed) {
      setBuffTimers(prev => ({ ...prev, [slot.playerId]: Date.now() + BUFF_DURATION_MS }));
    } else {
      setBuffTimers(prev => {
        const next = { ...prev };
        delete next[slot.playerId];
        return next;
      });
    }
  }, [players, getMarchTime, rallyQueue, counterQueue, buffTimers]);

  // Drop handler for rally queue
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const playerId = e.dataTransfer.getData('text/plain');
    const player = players.find(p => p.id === playerId);
    if (player) addToQueue(player, marchType === 'buffed');
  }, [players, addToQueue, marchType]);

  // Drop handler for counter queue
  const handleCounterDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const playerId = e.dataTransfer.getData('text/plain');
    const player = players.find(p => p.id === playerId);
    if (player) addToCounterQueue(player, marchType === 'buffed');
  }, [players, addToCounterQueue, marchType]);

  // Update queue march times when building changes
  useEffect(() => {
    const updateQueue = (prev: RallySlot[]) => prev.map(slot => {
      const player = players.find(p => p.id === slot.playerId);
      if (!player) return slot;
      const mt = player.marchTimes[selectedBuilding][slot.useBuffed ? 'buffed' : 'regular'];
      return { ...slot, marchTime: mt > 0 ? mt : player.marchTimes[selectedBuilding].regular };
    }).filter(slot => slot.marchTime > 0);
    setRallyQueue(updateQueue);
    setCounterQueue(updateQueue);
  }, [selectedBuilding, players]);

  // Player DB handlers
  const handleSavePlayer = useCallback((player: RallyPlayer) => {
    setPlayers(prev => {
      const idx = prev.findIndex(p => p.id === player.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = player;
        return next;
      }
      return [...prev, player];
    });
    setEditingPlayer(null);
  }, []);

  const handleDeletePlayer = useCallback((id: string) => {
    setPlayers(prev => prev.filter(p => p.id !== id));
    setRallyQueue(prev => prev.filter(s => s.playerId !== id));
    setCounterQueue(prev => prev.filter(s => s.playerId !== id));
  }, []);

  // Preset handlers
  const savePreset = useCallback(() => {
    if (!presetName.trim() || rallyQueue.length === 0) return;
    const preset: RallyPreset = {
      id: `preset_${Date.now()}`,
      name: presetName.trim(),
      building: selectedBuilding,
      hitMode,
      interval,
      slots: rallyQueue.map(s => ({ playerId: s.playerId, useBuffed: s.useBuffed })),
    };
    setPresets(prev => [...prev, preset]);
    setPresetName('');
    setShowPresetSave(false);
  }, [presetName, rallyQueue, selectedBuilding, hitMode, interval]);

  const loadPreset = useCallback((preset: RallyPreset) => {
    setSelectedBuilding(preset.building);
    setHitMode(preset.hitMode);
    setInterval(preset.interval);
    const newQueue: RallySlot[] = preset.slots
      .map(s => {
        const player = players.find(p => p.id === s.playerId);
        if (!player) return null;
        const mt = player.marchTimes[preset.building][s.useBuffed ? 'buffed' : 'regular'];
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
    setRallyQueue(newQueue);
  }, [players]);

  const deletePreset = useCallback((id: string) => {
    setPresets(prev => prev.filter(p => p.id !== id));
  }, []);

  const clearQueue = useCallback(() => setRallyQueue([]), []);
  const clearCounterQueue = useCallback(() => setCounterQueue([]), []);

  // Touch drag hooks — MUST be before conditional returns (Rules of Hooks)
  const rallyTouchDrag = useTouchDragReorder(moveInQueue);
  const counterTouchDrag = useTouchDragReorder(moveInCounterQueue);

  return {
    // State
    players, presets,
    selectedBuilding, hitMode, interval, marchType,
    rallyQueue, counterQueue, counterHitMode, counterInterval,
    playerModalOpen, editingPlayer, defaultTeam,
    presetName, showPresetSave, howToOpen,
    buffTimers, buffConfirmPopup, tickNow,
    hasAccess,
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
    savePreset, loadPreset, deletePreset,
    clearQueue, clearCounterQueue,
    // Derived
    allies, enemies,
    gap, cGap,
    calculatedRallies, calculatedCounters,
    queuedPlayerIds, counterQueuedIds,
    isAdmin,
    rallyTouchDrag, counterTouchDrag,
  };
}
