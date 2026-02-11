import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { neonGlow, FONT_DISPLAY } from '../utils/styles';
import { ADMIN_USERNAMES } from '../utils/constants';

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

const menuItemStyle: React.CSSProperties = {
  display: 'block', width: '100%', padding: '0.5rem 0.75rem',
  backgroundColor: 'transparent', border: 'none', color: '#d1d5db',
  fontSize: '0.75rem', cursor: 'pointer', textAlign: 'left',
};

const inputStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem', backgroundColor: '#0a0a0a',
  border: '1px solid #2a2a2a', borderRadius: '8px',
  color: '#fff', fontSize: '0.8rem', outline: 'none',
  width: '100%', minHeight: '40px', boxSizing: 'border-box',
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
}> = ({ player, marchTime, isInQueue, onAdd, onEdit, onRemoveFromDb, isMobile }) => {
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
          border: `1px solid ${isInQueue ? '#2a2a2a' : `${teamColor}40`}`,
          borderRadius: '20px',
          cursor: isInQueue ? 'not-allowed' : 'grab',
          opacity: isInQueue ? 0.4 : 1,
          transition: 'all 0.2s',
          fontSize: isMobile ? '0.68rem' : '0.73rem',
          color: isInQueue ? '#4b5563' : '#fff',
          userSelect: 'none',
          minHeight: '34px',
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
        <span style={{ color: '#9ca3af', fontSize: '0.65rem' }}>Interval between hits</span>
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
}> = ({ slot, index, total, onRemove, onMoveUp, onMoveDown, onToggleBuff, color, isMobile }) => {
  const teamColor = slot.team === 'ally' ? ALLY_COLOR : ENEMY_COLOR;
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('queue-index', index.toString());
        e.dataTransfer.effectAllowed = 'move';
      }}
      onTouchStart={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.dataset.touchDragIndex = index.toString();
      }}
      style={{
        display: 'flex', alignItems: 'center', gap: isMobile ? '0.35rem' : '0.5rem',
        padding: isMobile ? '0.4rem' : '0.45rem 0.65rem',
        backgroundColor: `${color}08`, border: `1px solid ${color}30`,
        borderLeft: `3px solid ${teamColor}`,
        borderRadius: '10px', transition: 'all 0.2s',
        cursor: 'grab', touchAction: 'none',
      }}
    >
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
      <button onClick={onToggleBuff} style={{
        padding: '0.15rem 0.35rem',
        backgroundColor: slot.useBuffed ? '#22c55e20' : 'transparent',
        border: `1px solid ${slot.useBuffed ? '#22c55e50' : '#2a2a2a'}`,
        borderRadius: '4px', cursor: 'pointer',
        color: slot.useBuffed ? '#22c55e' : '#6b7280',
        fontSize: '0.55rem', fontWeight: '600', flexShrink: 0,
      }}>
        {slot.useBuffed ? '⚡' : '🏃'}
      </button>
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
          <span style={{ color: '#6b7280', fontSize: '0.55rem' }}>March</span>
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
  const [name, setName] = useState('');
  const [team, setTeam] = useState<'ally' | 'enemy'>(defaultTeam);
  const [marchTimes, setMarchTimes] = useState<MarchTimes>(DEFAULT_MARCH);

  useEffect(() => {
    if (editingPlayer) {
      setName(editingPlayer.name);
      setTeam(editingPlayer.team);
      setMarchTimes(editingPlayer.marchTimes);
    } else {
      setName('');
      setTeam(defaultTeam);
      setMarchTimes(DEFAULT_MARCH);
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
    setMarchTimes(prev => ({
      ...prev,
      [building]: { ...prev[building], [type]: Math.max(0, Math.min(600, num)) },
    }));
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

        <p style={{ color: '#6b7280', fontSize: '0.65rem', marginBottom: '0.75rem' }}>
          March times in seconds. Enter regular and buffed (with march speed buff).
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {buildings.map(b => (
            <div key={b} style={{
              display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: '0.4rem', alignItems: 'center',
            }}>
              <span style={{ color: BUILDING_COLORS[b], fontSize: '0.7rem', fontWeight: '600' }}>
                {BUILDING_SHORT[b]}
              </span>
              <div style={{ position: 'relative' }}>
                <input
                  type="number" min="0" max="600"
                  value={marchTimes[b].regular || ''}
                  onChange={e => updateMarch(b, 'regular', e.target.value)}
                  placeholder="Regular"
                  style={{ ...inputStyle, fontSize: '0.7rem', padding: '0.35rem 0.5rem', paddingRight: '1.5rem' }}
                />
                <span style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', color: '#4b5563', fontSize: '0.55rem' }}>s</span>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type="number" min="0" max="600"
                  value={marchTimes[b].buffed || ''}
                  onChange={e => updateMarch(b, 'buffed', e.target.value)}
                  placeholder="Buffed ⚡"
                  style={{ ...inputStyle, fontSize: '0.7rem', padding: '0.35rem 0.5rem', paddingRight: '1.5rem', borderColor: '#22c55e30' }}
                />
                <span style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', color: '#22c55e', fontSize: '0.55rem' }}>⚡</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={cancelBtnStyle}>Cancel</button>
          <button onClick={handleSave} disabled={!name.trim()} style={{
            ...saveBtnStyle,
            backgroundColor: teamColor,
            opacity: name.trim() ? 1 : 0.4,
          }}>
            {editingPlayer ? 'Save Changes' : 'Add Player'}
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
                <span style={{ color: '#22c55e', fontWeight: '700' }}>CALL NOW</span>
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

const RallyCoordinator: React.FC = () => {
  useDocumentTitle('KvK Rally Coordinator');
  const { profile } = useAuth();
  const isMobile = useIsMobile();

  // Admin gate
  const isAdmin = !!(profile?.username && ADMIN_USERNAMES.includes(profile.username.toLowerCase()));

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

  // Persist
  useEffect(() => { saveToStorage(STORAGE_KEY_PLAYERS, players); }, [players]);
  useEffect(() => { saveToStorage(STORAGE_KEY_PRESETS, presets); }, [presets]);

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

  // Toggle buff for a queue slot
  const toggleBuff = useCallback((queueType: 'rally' | 'counter', index: number) => {
    const setter = queueType === 'rally' ? setRallyQueue : setCounterQueue;
    setter(prev => prev.map((slot, i) => {
      if (i !== index) return slot;
      const player = players.find(p => p.id === slot.playerId);
      if (!player) return slot;
      const newBuffed = !slot.useBuffed;
      const mt = getMarchTime(player, newBuffed);
      if (mt <= 0) return slot;
      return { ...slot, useBuffed: newBuffed, marchTime: mt };
    }));
  }, [players, getMarchTime]);

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

  // Non-admin view
  if (!isAdmin) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
          <h1 style={{ color: '#fff', fontSize: '1.5rem', fontFamily: FONT_DISPLAY, marginBottom: '0.75rem' }}>
            KvK Rally Coordinator
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            This tool is currently in development. Check back soon.
          </p>
          <Link to="/tools" style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            color: '#ef4444', textDecoration: 'none', fontSize: '0.85rem', fontWeight: '600',
          }}>
            ← Back to Tools
          </Link>
        </div>
      </div>
    );
  }

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
  ) => (
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

      {queue.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '1.5rem 0.75rem', color: '#4b5563',
        }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem', opacity: 0.4 }}>
            {queueType === 'rally' ? '🎯' : '🛡️'}
          </div>
          <p style={{ fontSize: '0.65rem', textAlign: 'center' }}>
            Drag or click players here
          </p>
          <p style={{ fontSize: '0.55rem', marginTop: '0.15rem' }}>
            {minPlayers > 1 ? `Min ${minPlayers} players` : 'Min 1 player'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
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
            />
          ))}
        </div>
      )}

      {queue.length > 0 && queue.length < minPlayers && (
        <p style={{ color: '#f59e0b', fontSize: '0.55rem', marginTop: '0.4rem', textAlign: 'center' }}>
          Add {minPlayers - queue.length} more to calculate timings.
        </p>
      )}
    </div>
  );

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
            ← Back to Tools
          </Link>
          <h1 style={{
            fontSize: isMobile ? '1.3rem' : '1.75rem', fontWeight: 'bold',
            fontFamily: FONT_DISPLAY, letterSpacing: '0.05em', marginBottom: '0.3rem',
          }}>
            <span style={{ color: '#fff' }}>KvK RALLY</span>
            <span style={{ ...neonGlow('#ef4444'), marginLeft: '0.4rem' }}>COORDINATOR</span>
          </h1>
          <p style={{ color: '#6b7280', fontSize: isMobile ? '0.7rem' : '0.8rem' }}>
            Synchronized destruction. No guesswork.
          </p>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.15rem 0.5rem', backgroundColor: '#f59e0b15',
            border: '1px solid #f59e0b30', borderRadius: '20px',
            marginTop: '0.4rem',
          }}>
            <span style={{ color: '#f59e0b', fontSize: '0.55rem', fontWeight: '700' }}>ADMIN PREVIEW</span>
          </div>
        </div>
      </div>

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

          {/* ===== ROW 1 ===== */}

          {/* Cell 1,1: Rally Leaders (Allies + Enemies) */}
          <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={cardHeader()}>👥 RALLY LEADERS</h3>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button onClick={() => { setEditingPlayer(null); setDefaultTeam('ally'); setPlayerModalOpen(true); }} style={{
                  padding: '0.2rem 0.4rem', backgroundColor: `${ALLY_COLOR}15`,
                  border: `1px solid ${ALLY_COLOR}30`, borderRadius: '5px',
                  color: ALLY_COLOR, fontSize: '0.55rem', fontWeight: '700', cursor: 'pointer',
                }}>
                  + Ally
                </button>
                <button onClick={() => { setEditingPlayer(null); setDefaultTeam('enemy'); setPlayerModalOpen(true); }} style={{
                  padding: '0.2rem 0.4rem', backgroundColor: `${ENEMY_COLOR}15`,
                  border: `1px solid ${ENEMY_COLOR}30`, borderRadius: '5px',
                  color: ENEMY_COLOR, fontSize: '0.55rem', fontWeight: '700', cursor: 'pointer',
                }}>
                  + Enemy
                </button>
              </div>
            </div>

            {/* Default march display toggle */}
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {(['regular', 'buffed'] as MarchType[]).map(t => (
                <button key={t} onClick={() => setMarchType(t)} style={{
                  flex: 1, padding: '0.25rem',
                  backgroundColor: marchType === t ? (t === 'buffed' ? '#22c55e15' : `${ALLY_COLOR}15`) : 'transparent',
                  border: `1px solid ${marchType === t ? (t === 'buffed' ? '#22c55e40' : `${ALLY_COLOR}40`) : '#2a2a2a'}`,
                  borderRadius: '6px', cursor: 'pointer',
                  color: marchType === t ? (t === 'buffed' ? '#22c55e' : ALLY_COLOR) : '#6b7280',
                  fontSize: '0.6rem', fontWeight: '600',
                }}>
                  {t === 'buffed' ? '⚡ Buffed' : '🏃 Regular'}
                </button>
              ))}
            </div>

            {/* Allies */}
            {allies.length > 0 && (
              <div>
                <div style={{ fontSize: '0.55rem', color: ALLY_COLOR, fontWeight: '700', marginBottom: '0.25rem', letterSpacing: '0.05em' }}>
                  ALLIES
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                  {allies.map(p => (
                    <PlayerPill
                      key={p.id}
                      player={p}
                      marchTime={p.marchTimes[selectedBuilding][marchType]}
                      isInQueue={queuedPlayerIds.has(p.id) || counterQueuedIds.has(p.id)}
                      onAdd={() => addToQueue(p, marchType === 'buffed')}
                      onEdit={() => { setEditingPlayer(p); setDefaultTeam('ally'); setPlayerModalOpen(true); }}
                      onRemoveFromDb={() => handleDeletePlayer(p.id)}
                      isMobile={isMobile}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Enemies */}
            {enemies.length > 0 && (
              <div>
                <div style={{ fontSize: '0.55rem', color: ENEMY_COLOR, fontWeight: '700', marginBottom: '0.25rem', letterSpacing: '0.05em' }}>
                  ENEMIES
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                  {enemies.map(p => (
                    <PlayerPill
                      key={p.id}
                      player={p}
                      marchTime={p.marchTimes[selectedBuilding][marchType]}
                      isInQueue={queuedPlayerIds.has(p.id) || counterQueuedIds.has(p.id)}
                      onAdd={() => addToCounterQueue(p, marchType === 'buffed')}
                      onEdit={() => { setEditingPlayer(p); setDefaultTeam('enemy'); setPlayerModalOpen(true); }}
                      onRemoveFromDb={() => handleDeletePlayer(p.id)}
                      isMobile={isMobile}
                    />
                  ))}
                </div>
              </div>
            )}

            {players.length === 0 && (
              <p style={{ color: '#4b5563', fontSize: '0.6rem', textAlign: 'center', padding: '0.75rem 0' }}>
                Add allies and enemies to start coordinating.
              </p>
            )}

            <p style={{ color: '#4b5563', fontSize: '0.5rem' }}>
              Click allies → Rally Queue. Click enemies → Counter Queue. Right-click to edit/remove.
            </p>
          </div>

          {/* Cell 1,2: Rally Queue */}
          {renderQueueDropZone(
            rallyQueue, handleDrop, removeFromQueue, moveInQueue,
            (i) => toggleBuff('rally', i), clearQueue,
            'rally', `⚔️ RALLY QUEUE — ${BUILDING_LABELS[selectedBuilding]}`,
            ALLY_COLOR, RALLY_COLORS, 2,
          )}

          {/* Cell 1,3: Counter-Rally Queue */}
          {renderQueueDropZone(
            counterQueue, handleCounterDrop, removeFromCounterQueue, moveInCounterQueue,
            (i) => toggleBuff('counter', i), clearCounterQueue,
            'counter', `🛡️ COUNTER-RALLY QUEUE`,
            ENEMY_COLOR, COUNTER_COLORS, 1,
          )}

          {/* ===== ROW 2 ===== */}

          {/* Cell 2,1: Target Building + Hit Timing */}
          <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <h3 style={cardHeader()}>🏰 TARGET & TIMING</h3>
            <BuildingSelector selected={selectedBuilding} onSelect={setSelectedBuilding} isMobile={isMobile} />

            <div style={{ marginTop: '0.25rem' }}>
              <div style={{ fontSize: '0.6rem', color: '#9ca3af', fontWeight: '600', marginBottom: '0.3rem' }}>Hit Timing</div>
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: hitMode === 'interval' ? '0.5rem' : 0 }}>
                <button onClick={() => { setHitMode('simultaneous'); }} style={{
                  flex: 1, padding: '0.35rem',
                  backgroundColor: hitMode === 'simultaneous' ? `${ALLY_COLOR}20` : 'transparent',
                  border: `1px solid ${hitMode === 'simultaneous' ? `${ALLY_COLOR}50` : '#2a2a2a'}`,
                  borderRadius: '7px', cursor: 'pointer',
                  color: hitMode === 'simultaneous' ? ALLY_COLOR : '#6b7280',
                  fontSize: '0.6rem', fontWeight: '600',
                }}>
                  💥 Simultaneous
                </button>
                <button onClick={() => { setHitMode('interval'); if (interval < 1) setInterval(1); }} style={{
                  flex: 1, padding: '0.35rem',
                  backgroundColor: hitMode === 'interval' ? `${ALLY_COLOR}20` : 'transparent',
                  border: `1px solid ${hitMode === 'interval' ? `${ALLY_COLOR}50` : '#2a2a2a'}`,
                  borderRadius: '7px', cursor: 'pointer',
                  color: hitMode === 'interval' ? ALLY_COLOR : '#6b7280',
                  fontSize: '0.6rem', fontWeight: '600',
                }}>
                  🔗 Chain Hits
                </button>
              </div>
              {hitMode === 'interval' && (
                <IntervalSlider value={interval} onChange={setInterval} accentColor={ALLY_COLOR} />
              )}
            </div>

            {/* Presets */}
            <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                <span style={{ fontSize: '0.6rem', color: '#9ca3af', fontWeight: '600' }}>Presets</span>
                {rallyQueue.length >= 2 && (
                  <button onClick={() => setShowPresetSave(!showPresetSave)} style={{
                    padding: '0.15rem 0.35rem', backgroundColor: '#22c55e15',
                    border: '1px solid #22c55e30', borderRadius: '4px',
                    color: '#22c55e', fontSize: '0.5rem', fontWeight: '700', cursor: 'pointer',
                  }}>
                    💾 Save Current
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
                <p style={{ color: '#2a2a2a', fontSize: '0.55rem' }}>No presets saved yet.</p>
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

          {/* Cell 2,2: Call Order */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {calculatedRallies.length >= 2 ? (
              <CallOrderOutput
                rallies={calculatedRallies}
                building={selectedBuilding}
                gap={gap}
                isMobile={isMobile}
                title="📢 CALL ORDER"
                colors={RALLY_COLORS}
                accentColor={ALLY_COLOR}
              />
            ) : (
              <div style={{ ...CARD, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '120px' }}>
                <p style={{ color: '#2a2a2a', fontSize: '0.65rem', textAlign: 'center' }}>
                  Add 2+ players to Rally Queue<br />to see call order
                </p>
              </div>
            )}
          </div>

          {/* Cell 2,3: Counter-Rally Call Order */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
              <div style={{ ...CARD, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '120px' }}>
                <p style={{ color: '#2a2a2a', fontSize: '0.65rem', textAlign: 'center' }}>
                  Add players to Counter Queue<br />to see counter call order
                </p>
              </div>
            )}

            {/* Counter-Rally Config */}
            <div style={{ ...CARD }}>
              <h4 style={cardHeader(ENEMY_COLOR)}>🛡️ COUNTER-RALLY CONFIG</h4>
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
          </div>

          {/* ===== ROW 3 ===== */}

          {/* Cell 3,1: Info / Tips */}
          <div style={{ ...CARD }}>
            <h3 style={cardHeader()}>📋 INFO</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.6rem', color: '#6b7280' }}>
              <div style={{
                padding: '0.4rem', backgroundColor: '#0a0a0a', borderRadius: '6px',
                border: '1px solid #1a1a1a',
              }}>
                <span style={{ color: '#9ca3af', fontWeight: '600' }}>Building:</span> {BUILDING_LABELS[selectedBuilding]}
              </div>
              <div style={{
                padding: '0.4rem', backgroundColor: '#0a0a0a', borderRadius: '6px',
                border: '1px solid #1a1a1a',
              }}>
                <span style={{ color: ALLY_COLOR, fontWeight: '600' }}>Rally:</span> {rallyQueue.length} players, {hitMode === 'simultaneous' ? 'simultaneous' : `${interval}s gaps`}
              </div>
              <div style={{
                padding: '0.4rem', backgroundColor: '#0a0a0a', borderRadius: '6px',
                border: '1px solid #1a1a1a',
              }}>
                <span style={{ color: ENEMY_COLOR, fontWeight: '600' }}>Counter:</span> {counterQueue.length} players, {counterHitMode === 'simultaneous' ? 'simultaneous' : `${counterInterval}s gaps`}
              </div>
              {/* Right-click hint */}
              <div style={{
                padding: '0.4rem', backgroundColor: '#22c55e08', borderRadius: '6px',
                border: '1px solid #22c55e15',
              }}>
                <span style={{ color: '#22c55e' }}>Tip:</span> Right-click players to edit march times.
              </div>
            </div>
          </div>

          {/* Cell 3,2: Rally Timeline */}
          {calculatedRallies.length >= 2 ? (
            <GanttChart
              rallies={calculatedRallies}
              isMobile={isMobile}
              title="⚔️ RALLY TIMELINE"
              colors={RALLY_COLORS}
            />
          ) : (
            <div style={{ ...CARD, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100px' }}>
              <p style={{ color: '#2a2a2a', fontSize: '0.65rem', textAlign: 'center' }}>
                Rally timeline will appear here
              </p>
            </div>
          )}

          {/* Cell 3,3: Counter-Rally Timeline */}
          {calculatedCounters.length >= 1 ? (
            <GanttChart
              rallies={calculatedCounters}
              isMobile={isMobile}
              title="🛡️ COUNTER TIMELINE"
              colors={COUNTER_COLORS}
            />
          ) : (
            <div style={{ ...CARD, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100px' }}>
              <p style={{ color: '#2a2a2a', fontSize: '0.65rem', textAlign: 'center' }}>
                Counter timeline will appear here
              </p>
            </div>
          )}
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

      {/* Modal */}
      <PlayerModal
        isOpen={playerModalOpen}
        onClose={() => { setPlayerModalOpen(false); setEditingPlayer(null); }}
        onSave={handleSavePlayer}
        editingPlayer={editingPlayer}
        defaultTeam={defaultTeam}
      />
    </div>
  );
};

export default RallyCoordinator;
