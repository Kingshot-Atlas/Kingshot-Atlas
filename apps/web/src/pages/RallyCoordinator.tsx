import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePremium } from '../contexts/PremiumContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useToast } from '../components/Toast';
import { neonGlow, FONT_DISPLAY } from '../utils/styles';
import { ADMIN_USERNAMES } from '../utils/constants';
import { supabase } from '../lib/supabase';
import type {
  BuildingKey, HitMode, MarchType, RallyPlayer, RallySlot, RallyPreset,
} from '../components/rally';
import {
  BUILDING_LABELS, BUILDING_SHORT, ALLY_COLOR, ENEMY_COLOR,
  RALLY_COLORS, COUNTER_COLORS,
  BUFF_DURATION_MS, STORAGE_KEY_PLAYERS, STORAGE_KEY_PRESETS, STORAGE_KEY_BUFF_TIMERS,
  CARD, cardHeader, inputStyle,
  loadFromStorage, saveToStorage,
  playEnemyBuffExpireSound, playAllyBuffExpireSound,
  calculateRallyTimings,
  BuildingSelector, PlayerPill, IntervalSlider,
  useTouchDragReorder, GanttChart, PlayerModal, CallOrderOutput,
  QueueDropZone,
} from '../components/rally';

const RallyCoordinator: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle('KvK Battle Planner');
  const { profile, user } = useAuth();
  const { isSupporter, isAdmin: isPremiumAdmin } = usePremium();
  const isMobile = useIsMobile();

  // Admin gate
  const isAdmin = !!(profile?.username && ADMIN_USERNAMES.includes(profile.username.toLowerCase()));

  // Free trial: Feb 12 00:00 UTC → Feb 25 00:00 UTC
  const TRIAL_START = new Date('2026-02-12T00:00:00Z').getTime();
  const TRIAL_END = new Date('2026-02-25T00:00:00Z').getTime();
  const isTrialActive = Date.now() >= TRIAL_START && Date.now() < TRIAL_END;

  // Access gate: admin OR supporter OR granted via battle_planner_access table OR free trial
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    if (isAdmin || isPremiumAdmin || isSupporter || isTrialActive) {
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
  }, [isAdmin, isPremiumAdmin, isSupporter, isTrialActive, user?.id]);

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
    // Prune any already-expired timers on load
    const now = Date.now();
    const valid: Record<string, number> = {};
    for (const [id, expiry] of Object.entries(stored)) {
      if (expiry > now) valid[id] = expiry;
    }
    return valid;
  });
  const [buffConfirmPopup, setBuffConfirmPopup] = useState<{ queueType: 'rally' | 'counter'; index: number } | null>(null);
  const [tickNow, setTickNow] = useState(Date.now());
  const { showToast } = useToast();

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

  // Auto-expire buff timers: toggle off buff when timer runs out
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

    // Resolve player info for notifications
    const expiredPlayers = expiredIds.map(id => {
      const p = playersRef.current.find(pl => pl.id === id);
      return { id, name: p?.name ?? 'Player', team: p?.team ?? ('ally' as const) };
    });

    // Auto-toggle off expired buffs in BOTH queues
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

    // Remove expired timers
    setBuffTimers(prev => {
      const next = { ...prev };
      expiredIds.forEach(id => delete next[id]);
      return next;
    });

    // Differentiated sound + toast by team
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

  // Calculated counter-rallies (same engine as rally, allows 1+ players)
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

  // Toggle buff for a queue slot (with buff timer for ALL players)
  const toggleBuff = useCallback((queueType: 'rally' | 'counter', index: number, forceOff?: boolean) => {
    const queue = queueType === 'rally' ? rallyQueue : counterQueue;
    const slot = queue[index];
    if (!slot) return;

    // Any player with active timer: show confirmation when toggling OFF
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

    // Start/clear buff timer for ALL players
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

  // Touch drag hooks for both queues — MUST be before conditional returns (Rules of Hooks)
  const rallyTouchDrag = useTouchDragReorder(moveInQueue);
  const counterTouchDrag = useTouchDragReorder(moveInCounterQueue);

  // Loading state while checking access
  if (hasAccess === null) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>Loading...</div>
      </div>
    );
  }

  // No access — coming soon gate
  if (!hasAccess) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ textAlign: 'center', maxWidth: '440px' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>⚔️</div>
          <h2 style={{ color: '#fff', fontSize: '1.5rem', fontFamily: FONT_DISPLAY, marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
            <span style={{ color: '#fff' }}>KvK BATTLE </span>
            <span style={neonGlow('#ef4444')}>COORDINATOR</span>
          </h2>
          <div style={{
            display: 'inline-block', padding: '0.25rem 0.75rem', marginBottom: '1rem',
            backgroundColor: '#ef444420', border: '1px solid #ef444440', borderRadius: '20px',
            fontSize: '0.7rem', fontWeight: '700', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            {t('common.comingSoon', 'Coming Soon')}
          </div>
          <p style={{ color: '#9ca3af', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            {t('rallyCoordinator.comingSoonDesc', 'Coordinate multi-rally strikes with surgical precision. Set march times, call orders, and hit windows — so your alliance lands together, every time. Currently in development.')}
          </p>
          <Link to="/tools" style={{
            display: 'inline-block', padding: '0.6rem 1.5rem',
            backgroundColor: '#ef444420', border: '1px solid #ef444450', borderRadius: '8px',
            color: '#ef4444', textDecoration: 'none', fontWeight: '600', fontSize: '0.9rem',
          }}>
            {t('rallyCoordinator.backToTools', '← Back to Tools')}
          </Link>
        </div>
      </div>
    );
  }

  // (access already checked above)

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      {/* Hero */}
      <div style={{
        padding: isMobile ? '1rem 0.75rem 0.75rem' : '1.25rem 2rem 1rem',
        textAlign: 'center',
        background: 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)',
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <Link to="/tools" style={{ color: '#9ca3af', fontSize: '0.8rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.5rem' }}>
            {t('rallyCoordinator.backToTools')}
          </Link>
          <h1 style={{
            fontSize: isMobile ? '1.3rem' : '1.75rem', fontWeight: 'bold',
            fontFamily: FONT_DISPLAY, letterSpacing: '0.05em', marginBottom: '0.3rem',
          }}>
            <span style={{ color: '#fff' }}>{t('rallyCoordinator.title')}</span>
            <span style={{ ...neonGlow('#ef4444'), marginLeft: '0.4rem' }}>{t('rallyCoordinator.titleAccent')}</span>
          </h1>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.75rem' : '0.9rem' }}>
            {t('rallyCoordinator.subtitle')}
          </p>
        </div>
      </div>

      {/* Keyframes for buff timer pulse */}
      <style>{`
        @keyframes buffTimerPulse {
          0%, 100% { box-shadow: 0 0 8px #f59e0b30; }
          50% { box-shadow: 0 0 14px #f59e0b50; }
        }
      `}</style>

      {/* Main Content — 3x3 Grid */}
      <div style={{
        maxWidth: '1400px', margin: '0 auto',
        padding: isMobile ? '0.5rem' : '0.75rem 1.5rem 2rem',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr',
          gap: isMobile ? '0.75rem' : '0.75rem',
        }}>

          {/* ===== COLUMN 1 ===== */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '0.75rem' : '0.75rem' }}>

            {/* Rally Leaders */}
            <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={cardHeader()}>👥 RALLY LEADERS</h3>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={() => { setEditingPlayer(null); setDefaultTeam('ally'); setPlayerModalOpen(true); }} style={{
                    padding: '0.2rem 0.4rem', backgroundColor: `${ALLY_COLOR}15`,
                    border: `1px solid ${ALLY_COLOR}30`, borderRadius: '5px',
                    color: ALLY_COLOR, fontSize: '0.65rem', fontWeight: '700', cursor: 'pointer',
                  }}>
                    {t('rallyCoordinator.addAlly')}
                  </button>
                  <button onClick={() => { setEditingPlayer(null); setDefaultTeam('enemy'); setPlayerModalOpen(true); }} style={{
                    padding: '0.2rem 0.4rem', backgroundColor: `${ENEMY_COLOR}15`,
                    border: `1px solid ${ENEMY_COLOR}30`, borderRadius: '5px',
                    color: ENEMY_COLOR, fontSize: '0.65rem', fontWeight: '700', cursor: 'pointer',
                  }}>
                    {t('rallyCoordinator.addEnemy')}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {(['regular', 'buffed'] as MarchType[]).map(mt => (
                  <button key={mt} onClick={() => setMarchType(mt)} style={{
                    flex: 1, padding: '0.25rem',
                    backgroundColor: marchType === mt ? (mt === 'buffed' ? '#22c55e15' : `${ALLY_COLOR}15`) : 'transparent',
                    border: `1px solid ${marchType === mt ? (mt === 'buffed' ? '#22c55e40' : `${ALLY_COLOR}40`) : '#2a2a2a'}`,
                    borderRadius: '6px', cursor: 'pointer',
                    color: marchType === mt ? (mt === 'buffed' ? '#22c55e' : ALLY_COLOR) : '#6b7280',
                    fontSize: '0.7rem', fontWeight: '600',
                  }}>
                    {mt === 'buffed' ? '⚡ Buffed' : '🏃 Regular'}
                  </button>
                ))}
              </div>

              {allies.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.65rem', color: ALLY_COLOR, fontWeight: '700', marginBottom: '0.25rem', letterSpacing: '0.05em' }}>{t('rallyCoordinator.allies')}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                    {allies.map(p => (
                      <PlayerPill
                        key={p.id} player={p}
                        marchTime={p.marchTimes[selectedBuilding][marchType]}
                        isInQueue={queuedPlayerIds.has(p.id) || counterQueuedIds.has(p.id)}
                        onAdd={() => addToQueue(p, marchType === 'buffed')}
                        onEdit={() => { setEditingPlayer(p); setDefaultTeam('ally'); setPlayerModalOpen(true); }}
                        onRemoveFromDb={() => handleDeletePlayer(p.id)}
                        isMobile={isMobile}
                        hasActiveBuffTimer={!!buffTimers[p.id]}
                      />
                    ))}
                  </div>
                </div>
              )}

              {enemies.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.65rem', color: ENEMY_COLOR, fontWeight: '700', marginBottom: '0.25rem', letterSpacing: '0.05em' }}>{t('rallyCoordinator.enemies')}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                    {enemies.map(p => (
                      <PlayerPill
                        key={p.id} player={p}
                        marchTime={p.marchTimes[selectedBuilding][marchType]}
                        isInQueue={queuedPlayerIds.has(p.id) || counterQueuedIds.has(p.id)}
                        onAdd={() => addToCounterQueue(p, marchType === 'buffed')}
                        onEdit={() => { setEditingPlayer(p); setDefaultTeam('enemy'); setPlayerModalOpen(true); }}
                        onRemoveFromDb={() => handleDeletePlayer(p.id)}
                        isMobile={isMobile}
                        hasActiveBuffTimer={!!buffTimers[p.id]}
                      />
                    ))}
                  </div>
                </div>
              )}

              {players.length === 0 && (
                <p style={{ color: '#6b7280', fontSize: '0.7rem', textAlign: 'center', padding: '0.75rem 0' }}>
                  Add your rally leaders. No guesswork.
                </p>
              )}

              <p style={{ color: '#6b7280', fontSize: '0.65rem' }}>
                Allies → Rally Queue. Enemies → Counter Queue. Right-click to edit.
              </p>
            </div>

            {/* 🏰 TARGET BUILDING + PRESETS (2 columns) */}
            <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: '0.75rem',
              }}>
                {/* Left: Target Building */}
                <div>
                  <h3 style={{ ...cardHeader(), marginBottom: '0.4rem' }}>🏰 TARGET BUILDING</h3>
                  <BuildingSelector selected={selectedBuilding} onSelect={setSelectedBuilding} isMobile={isMobile} />
                </div>

                {/* Right: Presets */}
                <div style={{
                  ...(isMobile ? { borderTop: '1px solid #1a1a1a', paddingTop: '0.5rem' } : { borderLeft: '1px solid #1a1a1a', paddingLeft: '0.75rem' }),
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                    <h3 style={{ ...cardHeader(), marginBottom: 0 }}>💾 PRESETS</h3>
                    {rallyQueue.length >= 2 && (
                      <button onClick={() => setShowPresetSave(!showPresetSave)} style={{
                        padding: '0.15rem 0.35rem', backgroundColor: '#22c55e15',
                        border: '1px solid #22c55e30', borderRadius: '4px',
                        color: '#22c55e', fontSize: '0.6rem', fontWeight: '700', cursor: 'pointer',
                      }}>
                        + Save Current
                      </button>
                    )}
                  </div>
                  {showPresetSave && (
                    <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.4rem' }}>
                      <input
                        value={presetName}
                        onChange={e => setPresetName(e.target.value)}
                        placeholder="Preset name..."
                        style={{ ...inputStyle, fontSize: '0.7rem', padding: '0.25rem 0.4rem', minHeight: '28px', flex: 1 }}
                      />
                      <button onClick={savePreset} disabled={!presetName.trim()} style={{
                        padding: '0.25rem 0.5rem', backgroundColor: '#22c55e',
                        border: 'none', borderRadius: '5px',
                        color: '#000', fontSize: '0.65rem', fontWeight: '700', cursor: 'pointer',
                        opacity: presetName.trim() ? 1 : 0.4,
                      }}>
                        Save
                      </button>
                    </div>
                  )}
                  {presets.length === 0 ? (
                    <p style={{ color: '#6b7280', fontSize: '0.65rem', textAlign: 'center', padding: '1rem 0' }}>
                      No presets yet. Build a rally and save it here for instant recall.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {presets.map(p => (
                        <div key={p.id} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '0.25rem 0.4rem', backgroundColor: '#0a0a0a',
                          border: '1px solid #1a1a1a', borderRadius: '6px',
                        }}>
                          <button onClick={() => loadPreset(p)} style={{
                            background: 'none', border: 'none', color: '#d1d5db',
                            fontSize: '0.7rem', fontWeight: '600', cursor: 'pointer', textAlign: 'left', flex: 1, padding: 0,
                          }}>
                            {p.name}
                            <span style={{ color: '#6b7280', marginLeft: '0.3rem', fontSize: '0.6rem' }}>
                              {BUILDING_SHORT[p.building]} · {p.slots.length} players
                            </span>
                          </button>
                          <button onClick={() => deletePreset(p.id)} style={{
                            background: 'none', border: 'none', color: '#6b7280',
                            fontSize: '0.6rem', cursor: 'pointer', padding: '0 0.2rem',
                          }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* � HOW TO USE (collapsible, initially expanded) */}
            <div style={{ ...CARD }}>
              <button
                onClick={() => setHowToOpen(prev => !prev)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: 0,
                }}
              >
                <h3 style={{ ...cardHeader(), marginBottom: 0 }}>📖 HOW TO USE</h3>
                <span style={{ color: '#6b7280', fontSize: '0.7rem', transition: 'transform 0.2s', transform: howToOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▼</span>
              </button>
              {howToOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.5rem', fontSize: '0.7rem' }}>
                  {[
                    { num: '1', text: 'Add your rally leaders — allies and enemies.', color: '#3b82f6' },
                    { num: '2', text: 'Set their march times for each building.', color: '#22c55e' },
                    { num: '3', text: 'Click or drag players into the Rally Queue.', color: '#f59e0b' },
                    { num: '4', text: 'Set the hit order — who lands first matters.', color: '#a855f7' },
                    { num: '5', text: 'Do the same for the Counter Queue if needed.', color: '#ef4444' },
                    { num: '6', text: 'Activate pet buff timers when applicable.', color: '#22d3ee' },
                  ].map(step => (
                    <div key={step.num} style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.4rem 0.5rem', backgroundColor: `${step.color}08`,
                      borderRadius: '6px', border: `1px solid ${step.color}15`,
                    }}>
                      <span style={{
                        width: '20px', height: '20px', borderRadius: '50%',
                        backgroundColor: `${step.color}20`, color: step.color,
                        fontSize: '0.65rem', fontWeight: '700',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {step.num}
                      </span>
                      <span style={{ color: '#9ca3af' }}>{step.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* ===== COLUMN 2 ===== */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '0.75rem' : '0.75rem' }}>

            {/* Rally Queue */}
            <QueueDropZone
              queue={rallyQueue}
              onDrop={handleDrop}
              onRemove={removeFromQueue}
              onMove={moveInQueue}
              onToggleBuff={(i: number) => toggleBuff('rally', i)}
              onClear={clearQueue}
              queueType="rally"
              title={`⚔️ RALLY QUEUE — ${BUILDING_LABELS[selectedBuilding]}`}
              accent={ALLY_COLOR}
              colors={RALLY_COLORS}
              minPlayers={2}
              isMobile={isMobile}
              buffTimers={buffTimers}
              tickNow={tickNow}
              touchDrag={rallyTouchDrag}
            />

            {/* 📢 RALLY CALL ORDER */}
            {calculatedRallies.length >= 2 ? (
              <CallOrderOutput
                rallies={calculatedRallies}
                building={selectedBuilding}
                gap={gap}
                isMobile={isMobile}
                title="📢 RALLY CALL ORDER"
                colors={RALLY_COLORS}
                accentColor={ALLY_COLOR}
              />
            ) : (
              <div style={{ ...CARD, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100px' }}>
                <p style={{ color: '#4b5563', fontSize: '0.75rem', textAlign: 'center' }}>
                  Add 2+ players to Rally Queue<br />to generate call order
                </p>
              </div>
            )}

            {/* ⚔️ RALLY CONFIGURATION + RALLY TIMELINE (touching) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ ...CARD, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
                <h4 style={cardHeader(ALLY_COLOR)}>⚔️ RALLY CONFIGURATION</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button onClick={() => { setHitMode('simultaneous'); }} style={{
                      flex: 1, padding: '0.3rem',
                      backgroundColor: hitMode === 'simultaneous' ? `${ALLY_COLOR}20` : 'transparent',
                      border: `1px solid ${hitMode === 'simultaneous' ? `${ALLY_COLOR}50` : '#2a2a2a'}`,
                      borderRadius: '7px', cursor: 'pointer',
                      color: hitMode === 'simultaneous' ? ALLY_COLOR : '#6b7280',
                      fontSize: '0.65rem', fontWeight: '600',
                    }}>
                      💥 Simultaneous
                    </button>
                    <button onClick={() => { setHitMode('interval'); if (interval < 1) setInterval(1); }} style={{
                      flex: 1, padding: '0.3rem',
                      backgroundColor: hitMode === 'interval' ? `${ALLY_COLOR}20` : 'transparent',
                      border: `1px solid ${hitMode === 'interval' ? `${ALLY_COLOR}50` : '#2a2a2a'}`,
                      borderRadius: '7px', cursor: 'pointer',
                      color: hitMode === 'interval' ? ALLY_COLOR : '#6b7280',
                      fontSize: '0.65rem', fontWeight: '600',
                    }}>
                      🔗 Chain Hits
                    </button>
                  </div>
                  {hitMode === 'interval' && (
                    <IntervalSlider value={interval} onChange={setInterval} accentColor={ALLY_COLOR} />
                  )}
                </div>
              </div>
              {calculatedRallies.length >= 2 ? (
                <div style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, overflow: 'hidden' }}>
                  <GanttChart
                    rallies={calculatedRallies}
                    isMobile={isMobile}
                    title="⚔️ RALLY TIMELINE"
                    colors={RALLY_COLORS}
                  />
                </div>
              ) : (
                <div style={{ ...CARD, borderTopLeftRadius: 0, borderTopRightRadius: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80px' }}>
                  <p style={{ color: '#4b5563', fontSize: '0.75rem', textAlign: 'center' }}>
                    Rally timeline appears here once you queue 2+ players
                  </p>
                </div>
              )}
            </div>

          </div>

          {/* ===== COLUMN 3 ===== */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '0.75rem' : '0.75rem' }}>

            {/* 🛡️ COUNTER QUEUE */}
            <QueueDropZone
              queue={counterQueue}
              onDrop={handleCounterDrop}
              onRemove={removeFromCounterQueue}
              onMove={moveInCounterQueue}
              onToggleBuff={(i: number) => toggleBuff('counter', i)}
              onClear={clearCounterQueue}
              queueType="counter"
              title={`🛡️ COUNTER QUEUE — ${BUILDING_LABELS[selectedBuilding]}`}
              accent={ENEMY_COLOR}
              colors={COUNTER_COLORS}
              minPlayers={1}
              isMobile={isMobile}
              buffTimers={buffTimers}
              tickNow={tickNow}
              touchDrag={counterTouchDrag}
            />

            {/* 📢 COUNTER CALL ORDER */}
            {calculatedCounters.length >= 1 ? (
              <CallOrderOutput
                rallies={calculatedCounters}
                building={selectedBuilding}
                gap={cGap}
                isMobile={isMobile}
                title="📢 COUNTER CALL ORDER"
                colors={COUNTER_COLORS}
                accentColor={ENEMY_COLOR}
              />
            ) : (
              <div style={{ ...CARD, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100px' }}>
                <p style={{ color: '#4b5563', fontSize: '0.75rem', textAlign: 'center' }}>
                  Add players to Counter Queue<br />to generate counter timing
                </p>
              </div>
            )}

            {/* 🛡️ COUNTER CONFIGURATION + COUNTER TIMELINE (touching) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ ...CARD, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
                <h4 style={cardHeader(ENEMY_COLOR)}>🛡️ COUNTER CONFIGURATION</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button onClick={() => { setCounterHitMode('simultaneous'); }} style={{
                      flex: 1, padding: '0.3rem',
                      backgroundColor: counterHitMode === 'simultaneous' ? `${ENEMY_COLOR}20` : 'transparent',
                      border: `1px solid ${counterHitMode === 'simultaneous' ? `${ENEMY_COLOR}50` : '#2a2a2a'}`,
                      borderRadius: '7px', cursor: 'pointer',
                      color: counterHitMode === 'simultaneous' ? ENEMY_COLOR : '#6b7280',
                      fontSize: '0.65rem', fontWeight: '600',
                    }}>
                      💥 Simultaneous
                    </button>
                    <button onClick={() => { setCounterHitMode('interval'); if (counterInterval < 1) setCounterInterval(1); }} style={{
                      flex: 1, padding: '0.3rem',
                      backgroundColor: counterHitMode === 'interval' ? `${ENEMY_COLOR}20` : 'transparent',
                      border: `1px solid ${counterHitMode === 'interval' ? `${ENEMY_COLOR}50` : '#2a2a2a'}`,
                      borderRadius: '7px', cursor: 'pointer',
                      color: counterHitMode === 'interval' ? ENEMY_COLOR : '#6b7280',
                      fontSize: '0.65rem', fontWeight: '600',
                    }}>
                      🔗 Chain Hits
                    </button>
                  </div>
                  {counterHitMode === 'interval' && (
                    <IntervalSlider value={counterInterval} onChange={setCounterInterval} accentColor={ENEMY_COLOR} />
                  )}
                </div>
              </div>
              {calculatedCounters.length >= 1 ? (
                <div style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, overflow: 'hidden' }}>
                  <GanttChart
                    rallies={calculatedCounters}
                    isMobile={isMobile}
                    title="🛡️ COUNTER TIMELINE"
                    colors={COUNTER_COLORS}
                  />
                </div>
              ) : (
                <div style={{ ...CARD, borderTopLeftRadius: 0, borderTopRightRadius: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80px' }}>
                  <p style={{ color: '#4b5563', fontSize: '0.75rem', textAlign: 'center' }}>
                    Counter timeline appears when you have players queued
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Slow march warning */}
        {(rallyQueue.some(s => s.marchTime > 100) || counterQueue.some(s => s.marchTime > 100)) && (
          <div style={{
            padding: '0.4rem 0.6rem', backgroundColor: '#f59e0b10',
            border: '1px solid #f59e0b25', borderRadius: '8px', marginTop: '0.75rem',
          }}>
            <span style={{ color: '#f59e0b', fontSize: '0.75rem' }}>
              ⚠️ Some players have march times over 100s — double-check those values.
            </span>
          </div>
        )}
      </div>

      {/* Community credit */}
      <div style={{
        marginTop: '2rem', paddingTop: '1rem', paddingBottom: '2rem',
        textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.4rem 0.85rem', borderRadius: '20px',
          border: '1px solid #22d3ee25', backgroundColor: '#22d3ee08',
        }}>
          <span style={{ color: '#6b7280', fontSize: '0.8rem', letterSpacing: '0.03em' }}>
            ⚔️ {t('battlePlanner.communityCredit', 'Huge shoutout to')}
          </span>
          <Link
            to="/profile/57d266cf-9800-4a7d-a8a5-f2cbc616bc22"
            style={{ color: '#22d3ee', textDecoration: 'none', fontWeight: '600', fontFamily: FONT_DISPLAY, fontSize: '0.8rem' }}
          >
            bAdClimber
          </Link>
          <span style={{ color: '#6b7280', fontSize: '0.8rem', letterSpacing: '0.03em' }}>
            {t('battlePlanner.communityCreditSuffix', 'for rallying this idea into existence. Built by the community, for the community.')}
          </span>
        </div>
      </div>

      {/* Modal */}
      <PlayerModal
        isOpen={playerModalOpen}
        onClose={() => { setPlayerModalOpen(false); setEditingPlayer(null); }}
        onSave={handleSavePlayer}
        editingPlayer={editingPlayer}
        defaultTeam={defaultTeam}
      />

      {/* Buff timer confirmation popup */}
      {buffConfirmPopup && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem',
        }}
          onClick={() => setBuffConfirmPopup(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: '#111', border: '1px solid #2a2a2a',
              borderRadius: '12px', padding: '1.25rem', maxWidth: '300px',
              textAlign: 'center', width: '100%',
            }}
          >
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⚠️</div>
            <p style={{ color: '#fff', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem' }}>
              Turn off buff?
            </p>
            <p style={{ color: '#6b7280', fontSize: '0.7rem', marginBottom: '1rem' }}>
              The 2-hour buff timer will be reset.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <button
                onClick={() => setBuffConfirmPopup(null)}
                style={{
                  padding: '0.4rem 1rem', backgroundColor: 'transparent',
                  border: '1px solid #2a2a2a', borderRadius: '8px',
                  color: '#9ca3af', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (buffConfirmPopup) {
                    toggleBuff(buffConfirmPopup.queueType, buffConfirmPopup.index, true);
                  }
                  setBuffConfirmPopup(null);
                }}
                style={{
                  padding: '0.4rem 1rem', backgroundColor: '#ef444420',
                  border: '1px solid #ef444450', borderRadius: '8px',
                  color: '#ef4444', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer',
                }}
              >
                Turn Off
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RallyCoordinator;
