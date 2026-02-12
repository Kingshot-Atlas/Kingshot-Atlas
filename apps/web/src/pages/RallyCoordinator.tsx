import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useToast } from '../components/Toast';
import { neonGlow, FONT_DISPLAY } from '../utils/styles';
import { ADMIN_USERNAMES } from '../utils/constants';
import { supabase } from '../lib/supabase';

// =============================================
// TYPES
// =============================================

interface MarchTimes {
  castle: { regular: number; buffed: number };
  turret1: { regular: number; buffed: number };
  turret2: { regular: number; buffed: number };
  turret3: { regular: number; buffed: number };
  turret4: { regular: number; buffed: number };
}

interface RallyPlayer {
  id: string;
  name: string;
  team: 'ally' | 'enemy';
  marchTimes: MarchTimes;
}

type BuildingKey = 'castle' | 'turret1' | 'turret2' | 'turret3' | 'turret4';
type HitMode = 'simultaneous' | 'interval';
type MarchType = 'regular' | 'buffed';

interface RallySlot {
  playerId: string;
  playerName: string;
  marchTime: number;
  team: 'ally' | 'enemy';
  useBuffed: boolean;
}

interface CalculatedRally {
  name: string;
  marchTime: number;
  startDelay: number;
  hitOrder: number;
  arrivalTime: number;
  team: 'ally' | 'enemy';
}

interface RallyPreset {
  id: string;
  name: string;
  building: BuildingKey;
  hitMode: HitMode;
  interval: number;
  slots: { playerId: string; useBuffed: boolean }[];
}

// =============================================
// CONSTANTS
// =============================================

const BUILDING_LABELS: Record<BuildingKey, string> = {
  castle: "King's Castle",
  turret1: 'Turret 1 (South)',
  turret2: 'Turret 2 (West)',
  turret3: 'Turret 3 (East)',
  turret4: 'Turret 4 (North)',
};

const BUILDING_SHORT: Record<BuildingKey, string> = {
  castle: 'KC',
  turret1: 'T1',
  turret2: 'T2',
  turret3: 'T3',
  turret4: 'T4',
};

const BUILDING_COLORS: Record<BuildingKey, string> = {
  castle: '#fbbf24',
  turret1: '#ef4444',
  turret2: '#3b82f6',
  turret3: '#22c55e',
  turret4: '#a855f7',
};

const DEFAULT_MARCH: MarchTimes = {
  castle: { regular: 0, buffed: 0 },
  turret1: { regular: 0, buffed: 0 },
  turret2: { regular: 0, buffed: 0 },
  turret3: { regular: 0, buffed: 0 },
  turret4: { regular: 0, buffed: 0 },
};

const ALLY_COLOR = '#3b82f6';
const ENEMY_COLOR = '#ef4444';

const RALLY_COLORS = [
  '#3b82f6', '#22c55e', '#f59e0b', '#a855f7',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#06b6d4',
];

const COUNTER_COLORS = [
  '#ef4444', '#f97316', '#ec4899', '#a855f7',
  '#f59e0b', '#84cc16', '#14b8a6', '#6366f1', '#3b82f6', '#22c55e',
];

// =============================================
// CALCULATION ENGINE
// =============================================

function calculateRallyTimings(
  slots: RallySlot[],
  gap: number
): CalculatedRally[] {
  if (slots.length === 0) return [];
  if (slots.length === 1) {
    const s = slots[0]!;
    return [{ name: s.playerName, marchTime: s.marchTime, startDelay: 0, hitOrder: 1, arrivalTime: s.marchTime, team: s.team }];
  }

  // Timeline does NOT include fill time — only march-to-hit
  const marchTimes = slots.map(s => s.marchTime);
  const desiredHits: number[] = slots.map((_, i) => i * gap);
  const offsets: number[] = marchTimes.map((t, i) => t - (desiredHits[i] as number));
  const maxOffset = Math.max(...offsets);
  const startDelays = offsets.map(o => maxOffset - o);

  const results: CalculatedRally[] = slots.map((s, i) => {
    const delay = startDelays[i] ?? 0;
    return {
      name: s.playerName,
      marchTime: s.marchTime,
      startDelay: delay,
      hitOrder: i + 1,
      arrivalTime: delay + s.marchTime,
      team: s.team,
    };
  });

  return results.sort((a, b) => a.startDelay - b.startDelay);
}

// =============================================
// HELPER: LOCAL STORAGE PERSISTENCE
// =============================================

const STORAGE_KEY_PLAYERS = 'atlas_rally_players_v2';
const STORAGE_KEY_PRESETS = 'atlas_rally_presets';
const STORAGE_KEY_BUFF_TIMERS = 'atlas_rally_buff_timers';

const playEnemyBuffExpireSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.frequency.value = 660;
    osc2.type = 'sine';
    gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.3);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
    osc2.start(ctx.currentTime + 0.3);
    osc2.stop(ctx.currentTime + 0.8);
  } catch { /* audio not supported */ }
  try { navigator.vibrate?.([200, 100, 200]); } catch { /* vibrate not supported */ }
};

const playAllyBuffExpireSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 523;
    osc.type = 'triangle';
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.frequency.value = 784;
    osc2.type = 'triangle';
    gain2.gain.setValueAtTime(0.25, ctx.currentTime + 0.25);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.7);
    osc2.start(ctx.currentTime + 0.25);
    osc2.stop(ctx.currentTime + 0.7);
  } catch { /* audio not supported */ }
  try { navigator.vibrate?.([100]); } catch { /* vibrate not supported */ }
};

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, data: T) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch { /* quota exceeded — silent */ }
}

// =============================================
// SUB-COMPONENTS
// =============================================

const CARD: React.CSSProperties = {
  backgroundColor: '#111111', borderRadius: '14px',
  border: '1px solid #2a2a2a', padding: '0.75rem',
};

const cardHeader = (color: string = '#fff'): React.CSSProperties => ({
  color, fontSize: '0.8rem', fontWeight: '700', fontFamily: FONT_DISPLAY, marginBottom: '0.5rem',
});

const arrowBtnStyle = (active: boolean): React.CSSProperties => ({
  width: '24px', height: '24px', borderRadius: '4px',
  backgroundColor: 'transparent', border: 'none',
  color: active ? '#9ca3af' : '#2a2a2a', cursor: active ? 'pointer' : 'default',
  fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 0,
});

const BUFF_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours

const formatCountdown = (ms: number): string => {
  if (ms <= 0) return '0:00';
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const menuItemStyle: React.CSSProperties = {
  display: 'block', width: '100%', padding: '0.5rem 0.75rem',
  backgroundColor: 'transparent', border: 'none', color: '#d1d5db',
  fontSize: '0.75rem', cursor: 'pointer', textAlign: 'left',
};

const inputStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem', backgroundColor: '#0a0a0a',
  border: '1px solid #2a2a2a', borderRadius: '8px',
  color: '#fff', fontSize: '1rem', outline: 'none',
  width: '100%', minHeight: '44px', boxSizing: 'border-box',
};

const cancelBtnStyle: React.CSSProperties = {
  padding: '0.5rem 1rem', backgroundColor: 'transparent',
  border: '1px solid #2a2a2a', borderRadius: '8px',
  color: '#9ca3af', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer',
};

const saveBtnStyle: React.CSSProperties = {
  padding: '0.5rem 1rem', border: 'none', borderRadius: '8px',
  color: '#000', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer',
};

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return sec === 0 ? `${m}m` : `${m}:${sec.toString().padStart(2, '0')}`;
};

// --- Building Selector ---
const BuildingSelector: React.FC<{
  selected: BuildingKey;
  onSelect: (b: BuildingKey) => void;
  isMobile: boolean;
}> = ({ selected, onSelect, isMobile }) => {
  const size = isMobile ? 48 : 54;
  const gap = isMobile ? 4 : 6;
  const containerSize = size * 3 + gap * 2;

  const buildingButton = (key: BuildingKey, row: number, col: number) => {
    const isSelected = selected === key;
    const color = BUILDING_COLORS[key];
    return (
      <button
        key={key}
        onClick={() => onSelect(key)}
        style={{
          position: 'absolute',
          top: row * (size + gap),
          left: col * (size + gap),
          width: size,
          height: size,
          borderRadius: key === 'castle' ? '12px' : '10px',
          backgroundColor: isSelected ? `${color}25` : '#0a0a0a',
          border: `2px solid ${isSelected ? color : '#2a2a2a'}`,
          color: isSelected ? color : '#6b7280',
          fontSize: isMobile ? '0.6rem' : '0.65rem',
          fontWeight: isSelected ? '700' : '600',
          cursor: 'pointer',
          transition: 'all 0.2s',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '2px',
          boxShadow: isSelected ? `0 0 12px ${color}30` : 'none',
        }}
      >
        <span style={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>
          {key === 'castle' ? '🏰' : '🗼'}
        </span>
        <span>{BUILDING_SHORT[key]}</span>
      </button>
    );
  };

  return (
    <div style={{ position: 'relative', width: containerSize, height: containerSize, margin: '0 auto' }}>
      {buildingButton('turret4', 0, 1)}
      {buildingButton('turret2', 1, 0)}
      {buildingButton('castle', 1, 1)}
      {buildingButton('turret3', 1, 2)}
      {buildingButton('turret1', 2, 1)}
    </div>
  );
};

// --- Player Pill (Ally=blue, Enemy=red) ---
const PlayerPill: React.FC<{
  player: RallyPlayer;
  marchTime: number;
  isInQueue: boolean;
  onAdd: () => void;
  onEdit: () => void;
  onRemoveFromDb: () => void;
  isMobile: boolean;
  hasActiveBuffTimer?: boolean;
}> = ({ player, marchTime, isInQueue, onAdd, onEdit, onRemoveFromDb, isMobile, hasActiveBuffTimer }) => {
  const [showMenu, setShowMenu] = useState(false);
  const teamColor = player.team === 'ally' ? ALLY_COLOR : ENEMY_COLOR;

  return (
    <div style={{ position: 'relative' }}>
      <div
        draggable={!isInQueue}
        onDragStart={(e) => {
          if (!isInQueue) {
            e.dataTransfer.setData('text/plain', player.id);
            e.dataTransfer.effectAllowed = 'copy';
          }
        }}
        onClick={() => !isInQueue && onAdd()}
        onContextMenu={(e) => { e.preventDefault(); setShowMenu(!showMenu); }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          padding: isMobile ? '0.3rem 0.55rem' : '0.35rem 0.65rem',
          backgroundColor: isInQueue ? '#1a1a1a' : `${teamColor}12`,
          border: `1px solid ${hasActiveBuffTimer ? '#f59e0b80' : isInQueue ? '#2a2a2a' : `${teamColor}40`}`,
          borderRadius: '20px',
          cursor: isInQueue ? 'not-allowed' : 'grab',
          opacity: isInQueue ? 0.4 : 1,
          transition: 'all 0.2s',
          fontSize: isMobile ? '0.68rem' : '0.73rem',
          color: isInQueue ? '#4b5563' : '#fff',
          userSelect: 'none',
          minHeight: '34px',
          ...(hasActiveBuffTimer ? {
            boxShadow: '0 0 8px #f59e0b30',
            animation: 'buffTimerPulse 2s ease-in-out infinite',
          } : {}),
        }}
      >
        <span style={{
          width: '6px', height: '6px', borderRadius: '50%',
          backgroundColor: teamColor, flexShrink: 0,
        }} />
        <span style={{ fontWeight: '600' }}>{player.name}</span>
        {marchTime > 0 && (
          <span style={{ color: '#9ca3af', fontSize: '0.6rem' }}>
            {marchTime}s
          </span>
        )}
      </div>
      {showMenu && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0, zIndex: 50,
          marginBottom: '4px', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a',
          borderRadius: '8px', overflow: 'hidden', minWidth: '120px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
        }}>
          <button onClick={() => { onEdit(); setShowMenu(false); }} style={menuItemStyle}>✏️ Edit</button>
          <button onClick={() => { onRemoveFromDb(); setShowMenu(false); }} style={{ ...menuItemStyle, color: '#ef4444' }}>🗑️ Remove</button>
        </div>
      )}
    </div>
  );
};

// --- Interval Slider ---
const IntervalSlider: React.FC<{
  value: number;
  onChange: (v: number) => void;
  accentColor?: string;
  min?: number;
  max?: number;
}> = ({ value, onChange, accentColor = '#ef4444', min = 1, max = 5 }) => {
  const { t } = useTranslation();
  const sliderRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const updateValue = useCallback((clientX: number) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onChange(min + Math.round(pct * (max - min)));
  }, [onChange]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? (e.touches[0]?.clientX ?? 0) : e.clientX;
      updateValue(clientX);
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [dragging, updateValue]);

  const range = max - min;
  const pct = range > 0 ? ((value - min) / range) * 100 : 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
        <span style={{ color: '#9ca3af', fontSize: '0.65rem' }}>{t('rallyCoordinator.intervalLabel')}</span>
        <span style={{ color: accentColor, fontSize: '0.7rem', fontWeight: '700' }}>{value}s</span>
      </div>
      <div
        ref={sliderRef}
        onMouseDown={(e) => { setDragging(true); updateValue(e.clientX); }}
        onTouchStart={(e) => { setDragging(true); updateValue(e.touches[0]?.clientX ?? 0); }}
        style={{
          position: 'relative', height: '28px', cursor: 'pointer',
          display: 'flex', alignItems: 'center',
        }}
      >
        <div style={{
          position: 'absolute', left: 0, right: 0, height: '5px',
          backgroundColor: '#2a2a2a', borderRadius: '3px',
        }} />
        <div style={{
          position: 'absolute', left: 0, width: `${pct}%`, height: '5px',
          backgroundColor: accentColor, borderRadius: '3px',
        }} />
        <div style={{
          position: 'absolute', left: `${pct}%`, transform: 'translateX(-50%)',
          width: '20px', height: '20px',
          backgroundColor: accentColor, borderRadius: '50%',
          border: '3px solid #0a0a0a', boxShadow: `0 0 8px ${accentColor}40`,
          transition: dragging ? 'none' : 'left 0.1s',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
        <span style={{ color: '#4b5563', fontSize: '0.5rem' }}>{min}s</span>
        <span style={{ color: '#4b5563', fontSize: '0.5rem' }}>{max}s</span>
      </div>
    </div>
  );
};

// --- Touch Drag-and-Drop Reorder Hook ---
function useTouchDragReorder(onReorder: (from: number, to: number) => void) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const itemRectsRef = useRef<DOMRect[]>([]);

  const cleanup = useCallback(() => {
    if (ghostRef.current) {
      ghostRef.current.remove();
      ghostRef.current = null;
    }
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    isDraggingRef.current = false;
    setDragIndex(null);
    setOverIndex(null);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent, index: number) => {
    const touch = e.touches[0];
    if (!touch) return;
    startPosRef.current = { x: touch.clientX, y: touch.clientY };

    longPressTimerRef.current = setTimeout(() => {
      isDraggingRef.current = true;
      setDragIndex(index);
      try { navigator.vibrate?.(30); } catch { /* not supported */ }

      // Cache item rects for hit testing
      if (containerRef.current) {
        const items = containerRef.current.querySelectorAll('[data-queue-item]');
        itemRectsRef.current = Array.from(items).map(el => el.getBoundingClientRect());
      }

      // Create ghost
      const target = e.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      const ghost = document.createElement('div');
      ghost.style.cssText = `
        position:fixed; z-index:9999; pointer-events:none;
        width:${rect.width}px; opacity:0.85; transform:scale(1.04);
        border-radius:10px; box-shadow:0 8px 32px rgba(0,0,0,0.5);
        transition:none;
      `;
      ghost.innerHTML = target.outerHTML;
      document.body.appendChild(ghost);
      ghost.style.left = `${rect.left}px`;
      ghost.style.top = `${rect.top}px`;
      ghostRef.current = ghost;
    }, 200);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;

    // Cancel long-press if finger moved too far before activation
    if (!isDraggingRef.current && startPosRef.current && longPressTimerRef.current) {
      const dx = touch.clientX - startPosRef.current.x;
      const dy = touch.clientY - startPosRef.current.y;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
        return;
      }
    }

    if (!isDraggingRef.current || !ghostRef.current) return;
    e.preventDefault();

    // Move ghost
    ghostRef.current.style.left = `${touch.clientX - ghostRef.current.offsetWidth / 2}px`;
    ghostRef.current.style.top = `${touch.clientY - 20}px`;

    // Determine which slot we're over
    const cy = touch.clientY;
    let closest = -1;
    let minDist = Infinity;
    for (let i = 0; i < itemRectsRef.current.length; i++) {
      const r = itemRectsRef.current[i]!;
      const mid = r.top + r.height / 2;
      const d = Math.abs(cy - mid);
      if (d < minDist) { minDist = d; closest = i; }
    }
    if (closest >= 0) setOverIndex(closest);

    // Auto-scroll near edges
    const scrollParent = containerRef.current?.closest('[style*="overflow"]') || window;
    if (cy < 100) (scrollParent === window ? window : scrollParent as HTMLElement).scrollBy?.({ top: -8, behavior: 'auto' });
    if (cy > window.innerHeight - 100) (scrollParent === window ? window : scrollParent as HTMLElement).scrollBy?.({ top: 8, behavior: 'auto' });
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (isDraggingRef.current && dragIndex != null && overIndex != null && dragIndex !== overIndex) {
      onReorder(dragIndex, overIndex);
      try { navigator.vibrate?.(15); } catch { /* not supported */ }
    }
    cleanup();
  }, [dragIndex, overIndex, onReorder, cleanup]);

  return { containerRef, dragIndex, overIndex, handleTouchStart, handleTouchMove, handleTouchEnd };
}

// --- Rally Queue Slot (with touch drag-and-drop + per-player buff toggle) ---
const RallyQueueSlot: React.FC<{
  slot: RallySlot;
  index: number;
  total: number;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleBuff: () => void;
  color: string;
  isMobile: boolean;
  buffTimeRemaining?: number | null;
  isDragOver?: boolean;
  isBeingDragged?: boolean;
  onTouchDragStart?: (e: React.TouchEvent) => void;
  onTouchDragMove?: (e: React.TouchEvent) => void;
  onTouchDragEnd?: () => void;
}> = ({ slot, index, total, onRemove, onMoveUp, onMoveDown, onToggleBuff, color, isMobile, buffTimeRemaining, isDragOver, isBeingDragged, onTouchDragStart, onTouchDragMove, onTouchDragEnd }) => {
  const teamColor = slot.team === 'ally' ? ALLY_COLOR : ENEMY_COLOR;
  return (
    <div
      data-queue-item
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('queue-index', index.toString());
        e.dataTransfer.effectAllowed = 'move';
      }}
      onTouchStart={onTouchDragStart}
      onTouchMove={onTouchDragMove}
      onTouchEnd={onTouchDragEnd}
      style={{
        display: 'flex', alignItems: 'center', gap: isMobile ? '0.35rem' : '0.5rem',
        padding: isMobile ? '0.4rem' : '0.45rem 0.65rem',
        backgroundColor: isDragOver ? `${color}20` : `${color}08`,
        border: `1px solid ${isDragOver ? `${color}70` : `${color}30`}`,
        borderLeft: `3px solid ${teamColor}`,
        borderRadius: '10px',
        transition: isBeingDragged ? 'none' : 'all 0.15s',
        cursor: 'grab', touchAction: 'none',
        opacity: isBeingDragged ? 0.3 : 1,
        transform: isDragOver ? 'scale(1.02)' : 'none',
      }}
    >
      {/* Drag handle for mobile */}
      {isMobile && (
        <span style={{
          display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0,
          padding: '0.2rem 0.1rem', color: '#4b5563', fontSize: '0.5rem',
          cursor: 'grab', touchAction: 'none', userSelect: 'none',
        }}>
          ⠿
        </span>
      )}
      <span style={{
        width: '22px', height: '22px', borderRadius: '50%',
        backgroundColor: `${color}25`, color: color,
        fontSize: '0.65rem', fontWeight: '700',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {index + 1}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ color: '#fff', fontSize: isMobile ? '0.7rem' : '0.75rem', fontWeight: '600' }}>
          {slot.playerName}
        </span>
        <span style={{ color: '#6b7280', fontSize: '0.6rem', marginLeft: '0.4rem' }}>
          {slot.marchTime}s
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', flexShrink: 0 }}>
        <button onClick={onToggleBuff} style={{
          padding: '0.15rem 0.35rem',
          backgroundColor: slot.useBuffed ? '#22c55e20' : 'transparent',
          border: `1px solid ${slot.useBuffed ? '#22c55e50' : '#2a2a2a'}`,
          borderRadius: '4px', cursor: 'pointer',
          color: slot.useBuffed ? '#22c55e' : '#6b7280',
          fontSize: '0.55rem', fontWeight: '600',
        }}>
          {slot.useBuffed ? '⚡' : '🏃'}
        </button>
        {buffTimeRemaining != null && buffTimeRemaining > 0 && (
          <span style={{
            color: '#f59e0b', fontSize: '0.5rem', fontWeight: '600',
            padding: '0.1rem 0.25rem', backgroundColor: '#f59e0b15',
            border: '1px solid #f59e0b30', borderRadius: '3px',
            whiteSpace: 'nowrap',
          }}>
            ⏱ {formatCountdown(buffTimeRemaining)}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: '1px', flexShrink: 0 }}>
        <button onClick={onMoveUp} disabled={index === 0} style={arrowBtnStyle(index > 0)}>▲</button>
        <button onClick={onMoveDown} disabled={index === total - 1} style={arrowBtnStyle(index < total - 1)}>▼</button>
        <button onClick={onRemove} style={{ ...arrowBtnStyle(true), color: '#ef4444' }}>✕</button>
      </div>
    </div>
  );
};

// --- Gantt Chart (march-only timeline, no fill time) ---
const GanttChart: React.FC<{
  rallies: CalculatedRally[];
  isMobile: boolean;
  title: string;
  colors: string[];
}> = ({ rallies, isMobile, title, colors }) => {
  const { t } = useTranslation();
  if (rallies.length === 0) return null;

  const maxTime = Math.max(...rallies.map(r => r.arrivalTime));
  if (maxTime === 0) return null;
  const barHeight = isMobile ? 26 : 30;
  const rowGap = 5;
  const chartHeight = rallies.length * (barHeight + rowGap) + 30;
  const leftLabelWidth = isMobile ? 58 : 75;

  const timeToPercent = (t: number) => (t / maxTime) * 100;

  const markerInterval = maxTime > 120 ? 30 : maxTime > 60 ? 15 : 10;
  const markers: number[] = [];
  for (let t = 0; t <= maxTime; t += markerInterval) markers.push(t);

  return (
    <div style={{
      backgroundColor: '#0a0a0a', borderRadius: '10px', border: '1px solid #2a2a2a',
      padding: isMobile ? '0.6rem' : '0.75rem', overflow: 'hidden',
    }}>
      <h4 style={cardHeader()}>{title}</h4>
      <div style={{ position: 'relative', height: chartHeight, marginLeft: leftLabelWidth }}>
        {markers.map(t => (
          <div key={t} style={{
            position: 'absolute', left: `${timeToPercent(t)}%`, top: 0, bottom: 0,
            borderLeft: '1px solid #1a1a1a', zIndex: 0,
          }}>
            <span style={{
              position: 'absolute', bottom: 0, left: '-12px',
              color: '#4b5563', fontSize: '0.5rem', whiteSpace: 'nowrap',
            }}>
              {formatTime(t)}
            </span>
          </div>
        ))}

        {rallies.map((r, i) => {
          const color = colors[i % colors.length] ?? '#3b82f6';
          const marchStart = timeToPercent(r.startDelay);
          const marchWidth = timeToPercent(r.marchTime);

          return (
            <div key={i} style={{
              position: 'absolute',
              top: i * (barHeight + rowGap),
              left: 0, right: 0, height: barHeight,
            }}>
              <div style={{
                position: 'absolute', right: '100%', marginRight: '6px',
                width: leftLabelWidth - 6, textAlign: 'right',
                color: '#d1d5db', fontSize: isMobile ? '0.55rem' : '0.6rem',
                fontWeight: '600', lineHeight: `${barHeight}px`,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {r.name}
              </div>

              {/* March bar */}
              <div style={{
                position: 'absolute', left: `${marchStart}%`, width: `${Math.max(marchWidth, 1)}%`,
                height: '100%', backgroundColor: color,
                borderRadius: '4px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ color: '#000', fontSize: '0.5rem', fontWeight: '700' }}>
                  {r.marchTime}s
                </span>
              </div>

              {/* Hit marker */}
              <div style={{
                position: 'absolute', left: `${timeToPercent(r.arrivalTime)}%`,
                top: '-2px', bottom: '-2px', width: '2px',
                backgroundColor: '#fff', boxShadow: '0 0 6px #fff',
              }} />
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.4rem', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <div style={{ width: '12px', height: '8px', backgroundColor: colors[0] ?? '#3b82f6', borderRadius: '2px' }} />
          <span style={{ color: '#6b7280', fontSize: '0.55rem' }}>{t('rallyCoordinator.march')}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <div style={{ width: '2px', height: '10px', backgroundColor: '#fff', boxShadow: '0 0 4px #fff' }} />
          <span style={{ color: '#6b7280', fontSize: '0.55rem' }}>Hit</span>
        </div>
      </div>
    </div>
  );
};

// --- Add/Edit Player Modal ---
const PlayerModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (player: RallyPlayer) => void;
  editingPlayer: RallyPlayer | null;
  defaultTeam?: 'ally' | 'enemy';
}> = ({ isOpen, onClose, onSave, editingPlayer, defaultTeam = 'ally' }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [team, setTeam] = useState<'ally' | 'enemy'>(defaultTeam);
  const [marchTimes, setMarchTimes] = useState<MarchTimes>(DEFAULT_MARCH);
  // Track which fields were manually entered (not estimated)
  const [manualFields, setManualFields] = useState<Record<string, Set<string>>>({});

  useEffect(() => {
    if (editingPlayer) {
      setName(editingPlayer.name);
      setTeam(editingPlayer.team);
      setMarchTimes(editingPlayer.marchTimes);
      // Mark all non-zero fields as manual on edit
      const manual: Record<string, Set<string>> = {};
      for (const [bKey, times] of Object.entries(editingPlayer.marchTimes)) {
        const s = new Set<string>();
        if (times.regular > 0) s.add('regular');
        if (times.buffed > 0) s.add('buffed');
        manual[bKey] = s;
      }
      setManualFields(manual);
    } else {
      setName('');
      setTeam(defaultTeam);
      setMarchTimes(DEFAULT_MARCH);
      setManualFields({});
    }
  }, [editingPlayer, isOpen, defaultTeam]);

  if (!isOpen) return null;

  const teamColor = team === 'ally' ? ALLY_COLOR : ENEMY_COLOR;

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: editingPlayer?.id || `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      team,
      marchTimes,
    });
    onClose();
  };

  const updateMarch = (building: BuildingKey, type: MarchType, value: string) => {
    const num = parseInt(value) || 0;
    const clamped = Math.max(0, Math.min(120, num));
    const otherType: MarchType = type === 'regular' ? 'buffed' : 'regular';

    // Track this field as manually entered
    setManualFields(prev => {
      const s = new Set(prev[building] || []);
      if (clamped > 0) {
        s.add(type);
      } else {
        s.delete(type);
      }
      return { ...prev, [building]: s };
    });

    setMarchTimes(prev => {
      const current = prev[building];
      const otherManual = manualFields[building]?.has(otherType);
      const updated = { ...current, [type]: clamped };

      // Auto-estimate counterpart only if not manually entered
      if (clamped > 0 && !otherManual) {
        if (type === 'regular') {
          updated.buffed = estimateBuffed(clamped);
        } else {
          updated.regular = estimateRegular(clamped);
        }
      }
      // If cleared, also clear the estimated counterpart
      if (clamped === 0 && !otherManual) {
        updated[otherType] = 0;
      }

      return { ...prev, [building]: updated };
    });
  };

  const isEstimated = (building: BuildingKey, type: MarchType): boolean => {
    const manual = manualFields[building];
    if (!manual) return false;
    // It's estimated if the value is > 0, this field wasn't manually set, but the other was
    const otherType: MarchType = type === 'regular' ? 'buffed' : 'regular';
    return !manual.has(type) && manual.has(otherType) && marchTimes[building][type] > 0;
  };

  const buildings: BuildingKey[] = ['castle', 'turret1', 'turret2', 'turret3', 'turret4'];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.7)', padding: '1rem',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        backgroundColor: '#111111', borderRadius: '16px',
        border: `1px solid ${teamColor}30`,
        padding: '1.5rem', maxWidth: '480px', width: '100%',
        maxHeight: '85vh', overflowY: 'auto',
      }}>
        <h3 style={{
          color: '#fff', fontSize: '1rem', fontWeight: '700', marginBottom: '1rem',
          fontFamily: FONT_DISPLAY,
        }}>
          {editingPlayer ? 'Edit' : 'Add'} Player
        </h3>

        {/* Team toggle */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          {(['ally', 'enemy'] as const).map(t => (
            <button key={t} onClick={() => setTeam(t)} style={{
              flex: 1, padding: '0.4rem',
              backgroundColor: team === t ? (t === 'ally' ? `${ALLY_COLOR}20` : `${ENEMY_COLOR}20`) : 'transparent',
              border: `1px solid ${team === t ? (t === 'ally' ? `${ALLY_COLOR}50` : `${ENEMY_COLOR}50`) : '#2a2a2a'}`,
              borderRadius: '8px', cursor: 'pointer',
              color: team === t ? (t === 'ally' ? ALLY_COLOR : ENEMY_COLOR) : '#6b7280',
              fontSize: '0.7rem', fontWeight: '600',
            }}>
              {t === 'ally' ? '🛡️ Ally' : '💀 Enemy'}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ color: '#9ca3af', fontSize: '0.7rem', fontWeight: '600', display: 'block', marginBottom: '0.3rem' }}>
            Player Name
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Player name"
            style={{ ...inputStyle, borderColor: `${teamColor}30` }}
            autoFocus
          />
        </div>

        <p style={{ color: '#6b7280', fontSize: '0.65rem', marginBottom: '0.5rem' }}>
          March times in seconds (0–120). Enter one — the other is estimated automatically.
        </p>
        <p style={{ color: '#f59e0b80', fontSize: '0.55rem', marginBottom: '0.75rem' }}>
          ≈ = estimated (×1.55 ratio). Enter both to use exact values.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {buildings.map(b => (
            <div key={b} style={{
              display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: '0.4rem', alignItems: 'center',
            }}>
              <span style={{ color: BUILDING_COLORS[b], fontSize: '0.65rem', fontWeight: '600' }}>
                {BUILDING_LABELS[b]}
              </span>
              <div style={{ position: 'relative' }}>
                <input
                  type="number" min="0" max="120"
                  value={marchTimes[b].regular || ''}
                  onChange={e => updateMarch(b, 'regular', e.target.value)}
                  placeholder="Regular"
                  style={{
                    ...inputStyle, fontSize: '1rem', padding: '0.4rem 1.5rem 0.4rem 0.5rem',
                    ...(isEstimated(b, 'regular') ? { borderColor: '#f59e0b40', color: '#f59e0b' } : {}),
                  }}
                />
                <span style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', color: isEstimated(b, 'regular') ? '#f59e0b' : '#4b5563', fontSize: '0.55rem' }}>
                  {isEstimated(b, 'regular') ? '≈' : 's'}
                </span>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type="number" min="0" max="120"
                  value={marchTimes[b].buffed || ''}
                  onChange={e => updateMarch(b, 'buffed', e.target.value)}
                  placeholder="Buffed ⚡"
                  style={{
                    ...inputStyle, fontSize: '1rem', padding: '0.4rem 1.5rem 0.4rem 0.5rem',
                    borderColor: isEstimated(b, 'buffed') ? '#f59e0b40' : '#22c55e30',
                    ...(isEstimated(b, 'buffed') ? { color: '#f59e0b' } : {}),
                  }}
                />
                <span style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', color: isEstimated(b, 'buffed') ? '#f59e0b' : '#22c55e', fontSize: '0.55rem' }}>
                  {isEstimated(b, 'buffed') ? '≈' : '⚡'}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={cancelBtnStyle}>{t('rallyCoordinator.cancel')}</button>
          <button onClick={handleSave} disabled={!name.trim()} style={{
            ...saveBtnStyle,
            backgroundColor: teamColor,
            opacity: name.trim() ? 1 : 0.4,
          }}>
            {editingPlayer ? t('rallyCoordinator.saveChanges') : t('rallyCoordinator.addPlayer')}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Call Order Output ---
const CallOrderOutput: React.FC<{
  rallies: CalculatedRally[];
  building: BuildingKey;
  gap: number;
  isMobile: boolean;
  title: string;
  colors: string[];
  accentColor: string;
}> = ({ rallies, building, gap, isMobile, title, colors, accentColor }) => {
  const { t } = useTranslation();
  if (rallies.length === 0) return null;

  const copyText = [
    `=== ${title}: ${BUILDING_LABELS[building]} ===`,
    `Gap: ${gap}s | Fill: 5min`,
    '',
    ...rallies.map((r, i) => {
      const timing = r.startDelay === 0
        ? 'CALL NOW (T+0s)'
        : `Call at T+${r.startDelay}s`;
      return `${i + 1}. ${r.name} — ${timing} | March: ${r.marchTime}s | Hits at T+${r.arrivalTime}s`;
    }),
  ].join('\n');

  const handleCopy = () => { navigator.clipboard.writeText(copyText); };

  return (
    <div style={{
      backgroundColor: '#0a0a0a', borderRadius: '10px', border: '1px solid #2a2a2a',
      padding: isMobile ? '0.6rem' : '0.75rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <h4 style={cardHeader()}>{title}</h4>
        <button onClick={handleCopy} style={{
          padding: '0.2rem 0.5rem', backgroundColor: `${accentColor}20`,
          border: `1px solid ${accentColor}40`, borderRadius: '6px',
          color: accentColor, fontSize: '0.6rem', fontWeight: '600', cursor: 'pointer',
        }}>
          📋 Copy
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {rallies.map((r, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.35rem 0.5rem', backgroundColor: `${colors[i % colors.length]}08`,
            borderRadius: '8px', borderLeft: `3px solid ${colors[i % colors.length]}`,
          }}>
            <span style={{
              color: colors[i % colors.length],
              fontWeight: '700', fontSize: '0.7rem', minWidth: '18px',
            }}>
              {i + 1}.
            </span>
            <span style={{ color: '#fff', fontWeight: '600', fontSize: '0.73rem', flex: 1 }}>
              {r.name}
            </span>
            <span style={{ color: '#d1d5db', fontSize: '0.65rem' }}>
              {r.startDelay === 0 ? (
                <span style={{ color: '#22c55e', fontWeight: '700' }}>{t('rallyCoordinator.callNow')}</span>
              ) : (
                <>T+<span style={{ color: accentColor, fontWeight: '700' }}>{r.startDelay}s</span></>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// =============================================
// MAIN COMPONENT
// =============================================

const BUFF_MULTIPLIER = 1.55;

const estimateBuffed = (regular: number): number => {
  if (regular <= 0) return 0;
  return Math.ceil(regular / BUFF_MULTIPLIER);
};

const estimateRegular = (buffed: number): number => {
  if (buffed <= 0) return 0;
  return Math.ceil(buffed * BUFF_MULTIPLIER);
};

const RallyCoordinator: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle('KvK Battle Planner');
  const { profile, user } = useAuth();
  const isMobile = useIsMobile();

  // Admin gate
  const isAdmin = !!(profile?.username && ADMIN_USERNAMES.includes(profile.username.toLowerCase()));

  // Free trial: Feb 15 00:00 UTC → Feb 25 00:00 UTC
  const TRIAL_START = new Date('2026-02-15T00:00:00Z').getTime();
  const TRIAL_END = new Date('2026-02-25T00:00:00Z').getTime();
  const isTrialActive = Date.now() >= TRIAL_START && Date.now() < TRIAL_END;

  // Access gate: admin OR granted via battle_planner_access table OR free trial
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    if (isAdmin || isTrialActive) {
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
  }, [isAdmin, isTrialActive, user?.id]);

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

  // Touch drag hooks for both queues
  const rallyTouchDrag = useTouchDragReorder(moveInQueue);
  const counterTouchDrag = useTouchDragReorder(moveInCounterQueue);

  // Shared queue drop zone renderer
  const renderQueueDropZone = (
    queue: RallySlot[],
    onDrop: (e: React.DragEvent) => void,
    onRemove: (i: number) => void,
    onMoveUp: (from: number, to: number) => void,
    onToggle: (i: number) => void,
    onClear: () => void,
    queueType: 'rally' | 'counter',
    title: string,
    accent: string,
    colors: string[],
    minPlayers: number,
  ) => {
    const touchDrag = queueType === 'rally' ? rallyTouchDrag : counterTouchDrag;
    return (
    <div
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDrop={onDrop}
      style={{
        ...CARD,
        border: `2px dashed ${queue.length > 0 ? `${accent}40` : '#2a2a2a'}`,
        minHeight: '120px', transition: 'border-color 0.2s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <h3 style={cardHeader()}>{title}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {isMobile && queue.length > 1 && (
            <span style={{ color: '#4b5563', fontSize: '0.5rem', fontStyle: 'italic' }}>
              Hold to drag
            </span>
          )}
          {queue.length > 0 && (
            <button onClick={onClear} style={{
              padding: '0.15rem 0.4rem', backgroundColor: 'transparent',
              border: '1px solid #2a2a2a', borderRadius: '5px',
              color: '#6b7280', fontSize: '0.55rem', cursor: 'pointer',
            }}>
              Clear
            </button>
          )}
        </div>
      </div>

      {queue.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '1.5rem 0.75rem', color: '#4b5563',
        }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem', opacity: 0.4 }}>
            {queueType === 'rally' ? '🎯' : '🛡️'}
          </div>
          <p style={{ fontSize: '0.65rem', textAlign: 'center' }}>
            {isMobile ? 'Tap players above to add' : 'Drop players here or click to add'}
          </p>
          <p style={{ fontSize: '0.55rem', marginTop: '0.15rem' }}>
            {minPlayers > 1 ? `Min ${minPlayers} players` : 'Min 1 player'}
          </p>
        </div>
      ) : (
        <div ref={touchDrag.containerRef} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {queue.map((slot, i) => (
            <RallyQueueSlot
              key={`${slot.playerId}-${i}`}
              slot={slot}
              index={i}
              total={queue.length}
              onRemove={() => onRemove(i)}
              onMoveUp={() => onMoveUp(i, i - 1)}
              onMoveDown={() => onMoveUp(i, i + 1)}
              onToggleBuff={() => onToggle(i)}
              color={colors[i % colors.length] ?? accent}
              isMobile={isMobile}
              buffTimeRemaining={
                buffTimers[slot.playerId]
                  ? Math.max(0, buffTimers[slot.playerId]! - tickNow)
                  : null
              }
              isDragOver={touchDrag.overIndex === i && touchDrag.dragIndex !== i}
              isBeingDragged={touchDrag.dragIndex === i}
              onTouchDragStart={(e) => touchDrag.handleTouchStart(e, i)}
              onTouchDragMove={touchDrag.handleTouchMove}
              onTouchDragEnd={touchDrag.handleTouchEnd}
            />
          ))}
        </div>
      )}

      {queue.length > 0 && queue.length < minPlayers && (
        <p style={{ color: '#f59e0b', fontSize: '0.55rem', marginTop: '0.4rem', textAlign: 'center' }}>
          Need {minPlayers - queue.length} more to calculate timings.
        </p>
      )}
    </div>
    );
  };

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
          <Link to="/tools" style={{ color: '#6b7280', fontSize: '0.7rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.5rem' }}>
            {t('rallyCoordinator.backToTools')}
          </Link>
          <h1 style={{
            fontSize: isMobile ? '1.3rem' : '1.75rem', fontWeight: 'bold',
            fontFamily: FONT_DISPLAY, letterSpacing: '0.05em', marginBottom: '0.3rem',
          }}>
            <span style={{ color: '#fff' }}>{t('rallyCoordinator.title')}</span>
            <span style={{ ...neonGlow('#ef4444'), marginLeft: '0.4rem' }}>{t('rallyCoordinator.titleAccent')}</span>
          </h1>
          <p style={{ color: '#6b7280', fontSize: isMobile ? '0.7rem' : '0.8rem' }}>
            {t('rallyCoordinator.subtitle')}
          </p>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.15rem 0.5rem', backgroundColor: '#f59e0b15',
            border: '1px solid #f59e0b30', borderRadius: '20px',
            marginTop: '0.4rem',
          }}>
            <span style={{ color: '#f59e0b', fontSize: '0.55rem', fontWeight: '700' }}>{t('rallyCoordinator.adminPreview')}</span>
          </div>
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
                    color: ALLY_COLOR, fontSize: '0.55rem', fontWeight: '700', cursor: 'pointer',
                  }}>
                    {t('rallyCoordinator.addAlly')}
                  </button>
                  <button onClick={() => { setEditingPlayer(null); setDefaultTeam('enemy'); setPlayerModalOpen(true); }} style={{
                    padding: '0.2rem 0.4rem', backgroundColor: `${ENEMY_COLOR}15`,
                    border: `1px solid ${ENEMY_COLOR}30`, borderRadius: '5px',
                    color: ENEMY_COLOR, fontSize: '0.55rem', fontWeight: '700', cursor: 'pointer',
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
                    fontSize: '0.6rem', fontWeight: '600',
                  }}>
                    {mt === 'buffed' ? '⚡ Buffed' : '🏃 Regular'}
                  </button>
                ))}
              </div>

              {allies.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.55rem', color: ALLY_COLOR, fontWeight: '700', marginBottom: '0.25rem', letterSpacing: '0.05em' }}>{t('rallyCoordinator.allies')}</div>
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
                  <div style={{ fontSize: '0.55rem', color: ENEMY_COLOR, fontWeight: '700', marginBottom: '0.25rem', letterSpacing: '0.05em' }}>{t('rallyCoordinator.enemies')}</div>
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
                <p style={{ color: '#4b5563', fontSize: '0.6rem', textAlign: 'center', padding: '0.75rem 0' }}>
                  Add your rally leaders. No guesswork.
                </p>
              )}

              <p style={{ color: '#4b5563', fontSize: '0.5rem' }}>
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
                        color: '#22c55e', fontSize: '0.5rem', fontWeight: '700', cursor: 'pointer',
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
                        style={{ ...inputStyle, fontSize: '0.6rem', padding: '0.25rem 0.4rem', minHeight: '28px', flex: 1 }}
                      />
                      <button onClick={savePreset} disabled={!presetName.trim()} style={{
                        padding: '0.25rem 0.5rem', backgroundColor: '#22c55e',
                        border: 'none', borderRadius: '5px',
                        color: '#000', fontSize: '0.55rem', fontWeight: '700', cursor: 'pointer',
                        opacity: presetName.trim() ? 1 : 0.4,
                      }}>
                        Save
                      </button>
                    </div>
                  )}
                  {presets.length === 0 ? (
                    <p style={{ color: '#4b5563', fontSize: '0.55rem', textAlign: 'center', padding: '1rem 0' }}>
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
                            fontSize: '0.6rem', fontWeight: '600', cursor: 'pointer', textAlign: 'left', flex: 1, padding: 0,
                          }}>
                            {p.name}
                            <span style={{ color: '#4b5563', marginLeft: '0.3rem', fontSize: '0.5rem' }}>
                              {BUILDING_SHORT[p.building]} · {p.slots.length} players
                            </span>
                          </button>
                          <button onClick={() => deletePreset(p.id)} style={{
                            background: 'none', border: 'none', color: '#4b5563',
                            fontSize: '0.5rem', cursor: 'pointer', padding: '0 0.2rem',
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.5rem', fontSize: '0.6rem' }}>
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
                        fontSize: '0.6rem', fontWeight: '700',
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
            {renderQueueDropZone(
              rallyQueue, handleDrop, removeFromQueue, moveInQueue,
              (i) => toggleBuff('rally', i), clearQueue,
              'rally', `⚔️ RALLY QUEUE — ${BUILDING_LABELS[selectedBuilding]}`,
              ALLY_COLOR, RALLY_COLORS, 2,
            )}

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
                <p style={{ color: '#2a2a2a', fontSize: '0.65rem', textAlign: 'center' }}>
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
                      fontSize: '0.55rem', fontWeight: '600',
                    }}>
                      💥 Simultaneous
                    </button>
                    <button onClick={() => { setHitMode('interval'); if (interval < 1) setInterval(1); }} style={{
                      flex: 1, padding: '0.3rem',
                      backgroundColor: hitMode === 'interval' ? `${ALLY_COLOR}20` : 'transparent',
                      border: `1px solid ${hitMode === 'interval' ? `${ALLY_COLOR}50` : '#2a2a2a'}`,
                      borderRadius: '7px', cursor: 'pointer',
                      color: hitMode === 'interval' ? ALLY_COLOR : '#6b7280',
                      fontSize: '0.55rem', fontWeight: '600',
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
                  <p style={{ color: '#2a2a2a', fontSize: '0.65rem', textAlign: 'center' }}>
                    Rally timeline appears here once you queue 2+ players
                  </p>
                </div>
              )}
            </div>

          </div>

          {/* ===== COLUMN 3 ===== */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '0.75rem' : '0.75rem' }}>

            {/* 🛡️ COUNTER QUEUE */}
            {renderQueueDropZone(
              counterQueue, handleCounterDrop, removeFromCounterQueue, moveInCounterQueue,
              (i) => toggleBuff('counter', i), clearCounterQueue,
              'counter', `🛡️ COUNTER QUEUE — ${BUILDING_LABELS[selectedBuilding]}`,
              ENEMY_COLOR, COUNTER_COLORS, 1,
            )}

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
                <p style={{ color: '#2a2a2a', fontSize: '0.65rem', textAlign: 'center' }}>
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
                      fontSize: '0.55rem', fontWeight: '600',
                    }}>
                      💥 Simultaneous
                    </button>
                    <button onClick={() => { setCounterHitMode('interval'); if (counterInterval < 1) setCounterInterval(1); }} style={{
                      flex: 1, padding: '0.3rem',
                      backgroundColor: counterHitMode === 'interval' ? `${ENEMY_COLOR}20` : 'transparent',
                      border: `1px solid ${counterHitMode === 'interval' ? `${ENEMY_COLOR}50` : '#2a2a2a'}`,
                      borderRadius: '7px', cursor: 'pointer',
                      color: counterHitMode === 'interval' ? ENEMY_COLOR : '#6b7280',
                      fontSize: '0.55rem', fontWeight: '600',
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
                  <p style={{ color: '#2a2a2a', fontSize: '0.65rem', textAlign: 'center' }}>
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
            <span style={{ color: '#f59e0b', fontSize: '0.65rem' }}>
              ⚠️ Some players have march times over 100s — double-check those values.
            </span>
          </div>
        )}
      </div>

      {/* Community credit */}
      <div style={{
        marginTop: '2rem', paddingTop: '1rem',
        borderTop: '1px solid #1a1a1a', textAlign: 'center',
      }}>
        <p style={{ color: '#4b5563', fontSize: '0.65rem', letterSpacing: '0.03em' }}>
          ⚔️ Battle Planner concept by{' '}
          <Link
            to="/profile/57d266cf-9800-4a7d-a8a5-f2cbc616bc22"
            style={{ color: '#22d3ee', textDecoration: 'none', fontWeight: '600', fontFamily: FONT_DISPLAY }}
          >
            bAdClimber
          </Link>
          {' '}— rallied the idea, we built the weapon.
        </p>
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
