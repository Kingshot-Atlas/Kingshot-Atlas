import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { usePremium } from '../../contexts/PremiumContext';
import { useGoldKingdoms } from '../../hooks/useGoldKingdoms';
import { useKvk11Promo } from '../../hooks/useKvk11Promo';
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
  lastAnnouncement: string;
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
  exportPlayers: () => void;
  importPlayers: (jsonStr: string) => void;
  duplicatePlayer: (id: string) => void;
  savePreset: () => void;
  loadPreset: (preset: RallyPreset) => void;
  deletePreset: (id: string) => void;
  clearQueue: () => void;
  clearCounterQueue: () => void;
  setLastAnnouncement: (msg: string) => void;
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
  rallyQueueRef: React.RefObject<HTMLDivElement | null>;
  counterQueueRef: React.RefObject<HTMLDivElement | null>;
}

export function useRallyCoordinator(): RallyCoordinatorState & RallyCoordinatorActions & RallyCoordinatorDerived {
  const { profile, user } = useAuth();
  const { isAdmin: isPremiumAdmin } = usePremium();
  const goldKingdoms = useGoldKingdoms();
  const { hasPromoAccess } = useKvk11Promo();
  const { showToast } = useToast();

  // Admin gate
  const isAdmin = !!(profile?.username && ADMIN_USERNAMES.includes(profile.username.toLowerCase()));

  // Gold kingdom gate: user's linked kingdom must be Gold tier
  const isGoldKingdom = !!(profile?.linked_kingdom && goldKingdoms.has(profile.linked_kingdom));

  // KvK #11 promo: Silver tier kingdoms also get access until Feb 21 22:00 UTC
  const hasSilverPromoAccess = !!(profile?.linked_kingdom && hasPromoAccess(profile.linked_kingdom));

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

  // Editor/Co-Editor gate: active editors get Battle Planner access (like PrepScheduler)
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
      } catch {
        if (!cancelled) setIsEditorOrCoEditor(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Access gate — Gold kingdoms, admins, editors/co-editors, trial users, or explicitly granted
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    if (isAdmin || isPremiumAdmin || isGoldKingdom || hasSilverPromoAccess || isEditorOrCoEditor || hasOnboardingTrial) {
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
  }, [isAdmin, isPremiumAdmin, isGoldKingdom, hasSilverPromoAccess, isEditorOrCoEditor, hasOnboardingTrial, user?.id]);

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

  // Session recovery: restore from Supabase on mount
  const sessionRestoredRef = useRef(false);
  useEffect(() => {
    if (!user?.id || !supabase || sessionRestoredRef.current) return;
    sessionRestoredRef.current = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('rally_sessions')
          .select('session_data')
          .eq('user_id', user.id)
          .maybeSingle();
        if (!data?.session_data) return;
        const s = data.session_data as {
          building?: BuildingKey; hitMode?: HitMode; interval?: number;
          rallyQueue?: RallySlot[]; counterQueue?: RallySlot[];
          counterHitMode?: HitMode; counterInterval?: number;
        };
        if (s.building) setSelectedBuilding(s.building);
        if (s.hitMode) setHitMode(s.hitMode);
        if (typeof s.interval === 'number') setInterval(s.interval);
        if (s.counterHitMode) setCounterHitMode(s.counterHitMode);
        if (typeof s.counterInterval === 'number') setCounterInterval(s.counterInterval);
        if (Array.isArray(s.rallyQueue) && s.rallyQueue.length > 0) setRallyQueue(s.rallyQueue);
        if (Array.isArray(s.counterQueue) && s.counterQueue.length > 0) setCounterQueue(s.counterQueue);
      } catch { /* silent — localStorage still works as fallback */ }
    })();
  }, [user?.id]);

  // State: Modals
  const [playerModalOpen, setPlayerModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<RallyPlayer | null>(null);
  const [defaultTeam, setDefaultTeam] = useState<'ally' | 'enemy'>('ally');
  const [presetName, setPresetName] = useState('');
  const [showPresetSave, setShowPresetSave] = useState(false);
  const [howToOpen, setHowToOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('atlas_rally_howToOpen');
      if (saved !== null) return saved === 'true';
      // Default: collapsed on mobile, open on desktop
      return window.innerWidth >= 768;
    } catch { return true; }
  });

  // Persist howToOpen state
  useEffect(() => {
    try { localStorage.setItem('atlas_rally_howToOpen', String(howToOpen)); } catch { /* noop */ }
  }, [howToOpen]);

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

  // Persist (localStorage)
  useEffect(() => { saveToStorage(STORAGE_KEY_PLAYERS, players); }, [players]);
  useEffect(() => { saveToStorage(STORAGE_KEY_PRESETS, presets); }, [presets]);
  useEffect(() => { saveToStorage(STORAGE_KEY_BUFF_TIMERS, buffTimers); }, [buffTimers]);

  // Session recovery: debounced auto-save to Supabase
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!user?.id || !supabase || !sessionRestoredRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const sessionData = {
        building: selectedBuilding, hitMode, interval,
        rallyQueue, counterQueue, counterHitMode, counterInterval,
      };
      supabase!.from('rally_sessions').upsert({
        user_id: user.id,
        session_data: sessionData,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' }).then(() => { /* silent */ });
    }, 2000); // 2s debounce
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [user?.id, selectedBuilding, hitMode, interval, rallyQueue, counterQueue, counterHitMode, counterInterval]);

  // Tick every second when buff timers are active
  const buffTimerCount = Object.keys(buffTimers).length;
  useEffect(() => {
    if (!buffTimerCount) return;
    const id = window.setInterval(() => setTickNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [buffTimerCount]);

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

  // Scroll refs for auto-scroll on mobile
  const rallyQueueRef = useRef<HTMLDivElement>(null);
  const counterQueueRef = useRef<HTMLDivElement>(null);

  const [lastAnnouncement, setLastAnnouncement] = useState('');

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
    if ('vibrate' in navigator) navigator.vibrate(30);
    setLastAnnouncement(`${player.name} added to rally queue`);
    // Auto-scroll to rally queue on mobile after a tick
    requestAnimationFrame(() => {
      rallyQueueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
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
    if ('vibrate' in navigator) navigator.vibrate(30);
    setLastAnnouncement(`${player.name} added to counter queue`);
    // Auto-scroll to counter queue on mobile after a tick
    requestAnimationFrame(() => {
      counterQueueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }, [counterQueuedIds, getMarchTime]);

  // Queue operations
  const removeFromQueue = useCallback((index: number) => {
    setRallyQueue(prev => {
      const removed = prev[index];
      if (removed) setLastAnnouncement(`${removed.playerName} removed from rally queue`);
      return prev.filter((_, i) => i !== index);
    });
    if ('vibrate' in navigator) navigator.vibrate([15, 30, 15]);
  }, []);

  const removeFromCounterQueue = useCallback((index: number) => {
    setCounterQueue(prev => {
      const removed = prev[index];
      if (removed) setLastAnnouncement(`${removed.playerName} removed from counter queue`);
      return prev.filter((_, i) => i !== index);
    });
    if ('vibrate' in navigator) navigator.vibrate([15, 30, 15]);
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

    if (slot.useBuffed && !forceOff) {
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

  // Player export/import
  const exportPlayers = useCallback(() => {
    const data = JSON.stringify(players, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `battle-planner-players-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Player database exported', 'success');
  }, [players, showToast]);

  const importPlayers = useCallback((jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (!Array.isArray(parsed)) throw new Error('Invalid format');
      const valid = parsed.filter(
        (p: unknown): p is RallyPlayer =>
          typeof p === 'object' && p !== null &&
          'id' in p && 'name' in p && 'team' in p && 'marchTimes' in p
      );
      if (valid.length === 0) {
        showToast('No valid players found in file', 'error');
        return;
      }
      setPlayers(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const newPlayers = valid.filter(p => !existingIds.has(p.id));
        const merged = [...prev, ...newPlayers];
        showToast(`Imported ${newPlayers.length} new player(s) (${valid.length - newPlayers.length} duplicates skipped)`, 'success');
        return merged;
      });
    } catch {
      showToast('Failed to import — invalid JSON file', 'error');
    }
  }, [showToast]);

  // Duplicate player
  const duplicatePlayer = useCallback((id: string) => {
    const original = players.find(p => p.id === id);
    if (!original) return;
    const copy: RallyPlayer = {
      ...original,
      id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `${original.name} (copy)`,
    };
    setPlayers(prev => [...prev, copy]);
    showToast(`📋 ${copy.name} created`, 'success');
  }, [players, showToast]);

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

  const deleteUndoRef = useRef<{ timer: ReturnType<typeof setTimeout>; id: string } | null>(null);

  const handleDeletePlayer = useCallback((id: string) => {
    const deletedPlayer = players.find(p => p.id === id);
    if (!deletedPlayer) return;

    // Immediately remove from UI
    setPlayers(prev => prev.filter(p => p.id !== id));
    setRallyQueue(prev => prev.filter(s => s.playerId !== id));
    setCounterQueue(prev => prev.filter(s => s.playerId !== id));

    // Cancel any previous undo timer
    if (deleteUndoRef.current) {
      clearTimeout(deleteUndoRef.current.timer);
      deleteUndoRef.current = null;
    }

    // Store for potential undo
    const timer = setTimeout(() => {
      deleteUndoRef.current = null;
    }, 5000);
    deleteUndoRef.current = { timer, id };

    // Show undo toast with action button
    showToast(
      `${deletedPlayer.name} deleted`,
      'info',
      5000,
      () => {
        // Undo: restore the player
        if (deleteUndoRef.current?.id === id) {
          clearTimeout(deleteUndoRef.current.timer);
          deleteUndoRef.current = null;
          setPlayers(prev => [...prev, deletedPlayer]);
          showToast(`↩️ ${deletedPlayer.name} restored`, 'success');
        }
      },
      'Undo'
    );
  }, [players, showToast]);

  // Preset handlers
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
    setPresets(prev => [...prev, preset]);
    setPresetName('');
    setShowPresetSave(false);
  }, [presetName, rallyQueue, counterQueue, selectedBuilding, hitMode, interval, counterHitMode, counterInterval]);

  const loadPreset = useCallback((preset: RallyPreset) => {
    setSelectedBuilding(preset.building);
    setHitMode(preset.hitMode);
    setInterval(preset.interval);
    const resolveSlots = (slots: { playerId: string; useBuffed: boolean }[]): RallySlot[] =>
      slots
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
    setRallyQueue(resolveSlots(preset.slots));
    // Restore counter queue if saved
    if (preset.counterSlots && preset.counterSlots.length > 0) {
      setCounterQueue(resolveSlots(preset.counterSlots));
      if (preset.counterHitMode) setCounterHitMode(preset.counterHitMode);
      if (preset.counterInterval != null) setCounterInterval(preset.counterInterval);
    }
  }, [players]);

  const deletePreset = useCallback((id: string) => {
    setPresets(prev => prev.filter(p => p.id !== id));
  }, []);

  const clearUndoRef = useRef<{ timer: ReturnType<typeof setTimeout>; queue: RallySlot[]; type: 'rally' | 'counter' } | null>(null);

  const clearQueue = useCallback(() => {
    const snapshot = rallyQueue;
    if (snapshot.length === 0) return;
    setRallyQueue([]);
    setLastAnnouncement('Rally queue cleared');
    if (clearUndoRef.current) clearTimeout(clearUndoRef.current.timer);
    const timer = setTimeout(() => { clearUndoRef.current = null; }, 5000);
    clearUndoRef.current = { timer, queue: snapshot, type: 'rally' };
    showToast(`Rally queue cleared (${snapshot.length} players)`, 'info', 5000, () => {
      if (clearUndoRef.current?.type === 'rally') {
        clearTimeout(clearUndoRef.current.timer);
        setRallyQueue(clearUndoRef.current.queue);
        clearUndoRef.current = null;
        showToast('↩️ Rally queue restored', 'success');
      }
    }, 'Undo');
  }, [rallyQueue, showToast]);

  const clearCounterQueue = useCallback(() => {
    const snapshot = counterQueue;
    if (snapshot.length === 0) return;
    setCounterQueue([]);
    setLastAnnouncement('Counter queue cleared');
    if (clearUndoRef.current) clearTimeout(clearUndoRef.current.timer);
    const timer = setTimeout(() => { clearUndoRef.current = null; }, 5000);
    clearUndoRef.current = { timer, queue: snapshot, type: 'counter' };
    showToast(`Counter queue cleared (${snapshot.length} players)`, 'info', 5000, () => {
      if (clearUndoRef.current?.type === 'counter') {
        clearTimeout(clearUndoRef.current.timer);
        setCounterQueue(clearUndoRef.current.queue);
        clearUndoRef.current = null;
        showToast('↩️ Counter queue restored', 'success');
      }
    }, 'Undo');
  }, [counterQueue, showToast]);

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
  };
}
