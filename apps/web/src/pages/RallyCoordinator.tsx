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
  marchTimes: MarchTimes;
}

interface EnemyPlayer {
  id: string;
  name: string;
  marchTimes: MarchTimes;
}

type BuildingKey = 'castle' | 'turret1' | 'turret2' | 'turret3' | 'turret4';
type HitMode = 'simultaneous' | 'interval';
type MarchType = 'regular' | 'buffed';

interface RallySlot {
  playerId: string;
  playerName: string;
  marchTime: number;
}

interface CalculatedRally {
  name: string;
  marchTime: number;
  startDelay: number;
  hitOrder: number;
  fillEnd: number;
  arrivalTime: number;
}

// =============================================
// CONSTANTS
// =============================================

const RALLY_FILL_TIME = 300; // 5 minutes in seconds

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

const RALLY_COLORS = [
  '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
];

// =============================================
// CALCULATION ENGINE (ported from Discord bot)
// =============================================

function calculateRallyTimings(
  slots: RallySlot[],
  gap: number
): CalculatedRally[] {
  if (slots.length < 2) return [];

  const totalTimes: number[] = slots.map(s => RALLY_FILL_TIME + s.marchTime);
  const desiredHits: number[] = slots.map((_, i) => i * gap);
  const offsets: number[] = totalTimes.map((t, i) => t - (desiredHits[i] as number));
  const maxOffset = Math.max(...offsets);
  const startDelays = offsets.map(o => maxOffset - o);

  const results: CalculatedRally[] = slots.map((s, i) => {
    const delay = startDelays[i] ?? 0;
    return {
      name: s.playerName,
      marchTime: s.marchTime,
      startDelay: delay,
      hitOrder: i + 1,
      fillEnd: delay + RALLY_FILL_TIME,
      arrivalTime: delay + RALLY_FILL_TIME + s.marchTime,
    };
  });

  return results.sort((a, b) => a.startDelay - b.startDelay);
}

// =============================================
// HELPER: LOCAL STORAGE PERSISTENCE
// =============================================

const STORAGE_KEY_PLAYERS = 'atlas_rally_players';
const STORAGE_KEY_ENEMIES = 'atlas_rally_enemies';

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

// --- Building Selector (+ formation) ---
const BuildingSelector: React.FC<{
  selected: BuildingKey;
  onSelect: (b: BuildingKey) => void;
  isMobile: boolean;
}> = ({ selected, onSelect, isMobile }) => {
  const size = isMobile ? 52 : 60;
  const gap = isMobile ? 4 : 8;
  const containerSize = size * 3 + gap * 2;

  const buildingButton = (key: BuildingKey, row: number, col: number) => {
    const isSelected = selected === key;
    const color = BUILDING_COLORS[key];
    return (
      <button
        key={key}
        onClick={() => onSelect(key)}
        title={BUILDING_LABELS[key]}
        style={{
          position: 'absolute',
          top: row * (size + gap),
          left: col * (size + gap),
          width: size,
          height: size,
          borderRadius: key === 'castle' ? '12px' : '10px',
          backgroundColor: isSelected ? `${color}25` : '#111111',
          border: `2px solid ${isSelected ? color : '#2a2a2a'}`,
          color: isSelected ? color : '#6b7280',
          fontSize: key === 'castle' ? (isMobile ? '0.65rem' : '0.7rem') : (isMobile ? '0.6rem' : '0.65rem'),
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
        <span style={{ fontSize: isMobile ? '0.8rem' : '0.9rem' }}>
          {key === 'castle' ? '🏰' : '🗼'}
        </span>
        <span>{BUILDING_SHORT[key]}</span>
      </button>
    );
  };

  return (
    <div style={{ position: 'relative', width: containerSize, height: containerSize, margin: '0 auto' }}>
      {/* T4 - North (top center) */}
      {buildingButton('turret4', 0, 1)}
      {/* T2 - West (middle left) */}
      {buildingButton('turret2', 1, 0)}
      {/* KC - Center */}
      {buildingButton('castle', 1, 1)}
      {/* T3 - East (middle right) */}
      {buildingButton('turret3', 1, 2)}
      {/* T1 - South (bottom center) */}
      {buildingButton('turret1', 2, 1)}
    </div>
  );
};

// --- Player Pill ---
const PlayerPill: React.FC<{
  player: RallyPlayer;
  marchTime: number;
  marchType: MarchType;
  isInQueue: boolean;
  onAdd: () => void;
  onEdit: () => void;
  onRemoveFromDb: () => void;
  isMobile: boolean;
}> = ({ player, marchTime, marchType, isInQueue, onAdd, onEdit, onRemoveFromDb, isMobile }) => {
  const [showMenu, setShowMenu] = useState(false);
  
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
          gap: '0.4rem',
          padding: isMobile ? '0.35rem 0.6rem' : '0.4rem 0.75rem',
          backgroundColor: isInQueue ? '#1a1a1a' : '#ef444415',
          border: `1px solid ${isInQueue ? '#2a2a2a' : '#ef444440'}`,
          borderRadius: '20px',
          cursor: isInQueue ? 'not-allowed' : 'grab',
          opacity: isInQueue ? 0.4 : 1,
          transition: 'all 0.2s',
          fontSize: isMobile ? '0.7rem' : '0.75rem',
          color: isInQueue ? '#4b5563' : '#fff',
          userSelect: 'none',
          minHeight: '36px',
        }}
      >
        <span style={{ fontWeight: '600' }}>{player.name}</span>
        {marchTime > 0 && (
          <span style={{ color: marchType === 'buffed' ? '#22c55e' : '#9ca3af', fontSize: '0.65rem' }}>
            {marchTime}s{marchType === 'buffed' ? '⚡' : ''}
          </span>
        )}
      </div>
      {showMenu && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 50,
          marginTop: '4px', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a',
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

const menuItemStyle: React.CSSProperties = {
  display: 'block', width: '100%', padding: '0.5rem 0.75rem',
  backgroundColor: 'transparent', border: 'none', color: '#d1d5db',
  fontSize: '0.75rem', cursor: 'pointer', textAlign: 'left',
};

// --- Interval Slider ---
const IntervalSlider: React.FC<{
  value: number;
  onChange: (v: number) => void;
  isMobile: boolean;
}> = ({ value, onChange, isMobile }) => {
  const sliderRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const updateValue = useCallback((clientX: number) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onChange(Math.round(pct * 10));
  }, [onChange]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
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

  const pct = (value / 10) * 100;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
        <span style={{ color: '#9ca3af', fontSize: '0.7rem' }}>Interval between hits</span>
        <span style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: '700' }}>{value}s</span>
      </div>
      <div
        ref={sliderRef}
        onMouseDown={(e) => { setDragging(true); updateValue(e.clientX); }}
        onTouchStart={(e) => { setDragging(true); updateValue(e.touches[0].clientX); }}
        style={{
          position: 'relative', height: '28px', cursor: 'pointer',
          display: 'flex', alignItems: 'center',
        }}
      >
        <div style={{
          position: 'absolute', left: 0, right: 0, height: '6px',
          backgroundColor: '#2a2a2a', borderRadius: '3px',
        }} />
        <div style={{
          position: 'absolute', left: 0, width: `${pct}%`, height: '6px',
          backgroundColor: '#ef4444', borderRadius: '3px',
        }} />
        <div style={{
          position: 'absolute', left: `${pct}%`, transform: 'translateX(-50%)',
          width: isMobile ? '22px' : '18px', height: isMobile ? '22px' : '18px',
          backgroundColor: '#ef4444', borderRadius: '50%',
          border: '3px solid #0a0a0a', boxShadow: '0 0 8px #ef444440',
          transition: dragging ? 'none' : 'left 0.1s',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
        <span style={{ color: '#4b5563', fontSize: '0.55rem' }}>0s</span>
        <span style={{ color: '#4b5563', fontSize: '0.55rem' }}>10s</span>
      </div>
    </div>
  );
};

// --- Rally Queue Slot ---
const RallyQueueSlot: React.FC<{
  slot: RallySlot;
  index: number;
  total: number;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  color: string;
  isMobile: boolean;
}> = ({ slot, index, total, onRemove, onMoveUp, onMoveDown, color, isMobile }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: isMobile ? '0.4rem' : '0.6rem',
    padding: isMobile ? '0.5rem' : '0.5rem 0.75rem',
    backgroundColor: `${color}08`, border: `1px solid ${color}30`,
    borderRadius: '10px', transition: 'all 0.2s',
  }}>
    <span style={{
      width: '24px', height: '24px', borderRadius: '50%',
      backgroundColor: `${color}25`, color: color,
      fontSize: '0.7rem', fontWeight: '700',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      {index + 1}
    </span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <span style={{ color: '#fff', fontSize: isMobile ? '0.75rem' : '0.8rem', fontWeight: '600' }}>
        {slot.playerName}
      </span>
      <span style={{ color: '#6b7280', fontSize: '0.65rem', marginLeft: '0.5rem' }}>
        {slot.marchTime}s march
      </span>
    </div>
    <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
      <button onClick={onMoveUp} disabled={index === 0} style={arrowBtnStyle(index > 0)}>▲</button>
      <button onClick={onMoveDown} disabled={index === total - 1} style={arrowBtnStyle(index < total - 1)}>▼</button>
      <button onClick={onRemove} style={{ ...arrowBtnStyle(true), color: '#ef4444' }}>✕</button>
    </div>
  </div>
);

const arrowBtnStyle = (active: boolean): React.CSSProperties => ({
  width: '24px', height: '24px', borderRadius: '4px',
  backgroundColor: 'transparent', border: 'none',
  color: active ? '#9ca3af' : '#2a2a2a', cursor: active ? 'pointer' : 'default',
  fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 0,
});

// --- Gantt Chart ---
const GanttChart: React.FC<{
  rallies: CalculatedRally[];
  isMobile: boolean;
}> = ({ rallies, isMobile }) => {
  if (rallies.length === 0) return null;

  const maxTime = Math.max(...rallies.map(r => r.arrivalTime));
  const barHeight = isMobile ? 28 : 32;
  const rowGap = 6;
  const chartHeight = rallies.length * (barHeight + rowGap) + 40;
  const leftLabelWidth = isMobile ? 60 : 80;

  const timeToPercent = (t: number) => (t / maxTime) * 100;

  // Generate time markers
  const markerInterval = maxTime > 400 ? 60 : 30;
  const markers: number[] = [];
  for (let t = 0; t <= maxTime; t += markerInterval) markers.push(t);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return sec === 0 ? `${m}m` : `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{
      backgroundColor: '#0a0a0a', borderRadius: '12px', border: '1px solid #2a2a2a',
      padding: isMobile ? '0.75rem' : '1rem', overflow: 'hidden',
    }}>
      <h4 style={{ color: '#fff', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.75rem', fontFamily: FONT_DISPLAY }}>
        ⚔️ RALLY TIMELINE
      </h4>
      <div style={{ position: 'relative', height: chartHeight, marginLeft: leftLabelWidth }}>
        {/* Time axis markers */}
        {markers.map(t => (
          <div key={t} style={{
            position: 'absolute', left: `${timeToPercent(t)}%`, top: 0, bottom: 0,
            borderLeft: '1px solid #1a1a1a', zIndex: 0,
          }}>
            <span style={{
              position: 'absolute', bottom: 0, left: '-12px',
              color: '#4b5563', fontSize: '0.55rem', whiteSpace: 'nowrap',
            }}>
              {formatTime(t)}
            </span>
          </div>
        ))}

        {/* Rally bars */}
        {rallies.map((r, i) => {
          const color = RALLY_COLORS[i % RALLY_COLORS.length];
          const fillStart = timeToPercent(r.startDelay);
          const fillWidth = timeToPercent(RALLY_FILL_TIME);
          const marchStart = timeToPercent(r.fillEnd);
          const marchWidth = timeToPercent(r.marchTime);

          return (
            <div key={i} style={{
              position: 'absolute',
              top: i * (barHeight + rowGap),
              left: 0, right: 0, height: barHeight,
            }}>
              {/* Player label */}
              <div style={{
                position: 'absolute', right: '100%', marginRight: '8px',
                width: leftLabelWidth - 8, textAlign: 'right',
                color: '#d1d5db', fontSize: isMobile ? '0.6rem' : '0.65rem',
                fontWeight: '600', lineHeight: `${barHeight}px`,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {r.name}
              </div>

              {/* Fill phase bar */}
              <div title={`Fill: ${formatTime(r.startDelay)} → ${formatTime(r.fillEnd)}`} style={{
                position: 'absolute', left: `${fillStart}%`, width: `${fillWidth}%`,
                height: '100%', backgroundColor: `${color}30`,
                borderRadius: '4px 0 0 4px', border: `1px solid ${color}40`,
                borderRight: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ color: `${color}90`, fontSize: '0.5rem', fontWeight: '600' }}>FILL</span>
              </div>

              {/* March phase bar */}
              <div title={`March: ${formatTime(r.fillEnd)} → ${formatTime(r.arrivalTime)}`} style={{
                position: 'absolute', left: `${marchStart}%`, width: `${marchWidth}%`,
                height: '100%', backgroundColor: color,
                borderRadius: '0 4px 4px 0',
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

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <div style={{ width: '12px', height: '8px', backgroundColor: '#ef444430', borderRadius: '2px', border: '1px solid #ef444440' }} />
          <span style={{ color: '#6b7280', fontSize: '0.6rem' }}>Fill (5min)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <div style={{ width: '12px', height: '8px', backgroundColor: '#ef4444', borderRadius: '2px' }} />
          <span style={{ color: '#6b7280', fontSize: '0.6rem' }}>March</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <div style={{ width: '2px', height: '10px', backgroundColor: '#fff', boxShadow: '0 0 4px #fff' }} />
          <span style={{ color: '#6b7280', fontSize: '0.6rem' }}>Hit</span>
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
  isEnemy?: boolean;
}> = ({ isOpen, onClose, onSave, editingPlayer, isEnemy }) => {
  const [name, setName] = useState('');
  const [marchTimes, setMarchTimes] = useState<MarchTimes>(DEFAULT_MARCH);

  useEffect(() => {
    if (editingPlayer) {
      setName(editingPlayer.name);
      setMarchTimes(editingPlayer.marchTimes);
    } else {
      setName('');
      setMarchTimes(DEFAULT_MARCH);
    }
  }, [editingPlayer, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: editingPlayer?.id || `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
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
        border: `1px solid ${isEnemy ? '#ef4444' : '#22d3ee'}30`,
        padding: '1.5rem', maxWidth: '480px', width: '100%',
        maxHeight: '85vh', overflowY: 'auto',
      }}>
        <h3 style={{
          color: '#fff', fontSize: '1rem', fontWeight: '700', marginBottom: '1rem',
          fontFamily: FONT_DISPLAY,
        }}>
          {editingPlayer ? 'Edit' : 'Add'} {isEnemy ? 'Enemy' : 'Rally Leader'}
        </h3>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ color: '#9ca3af', fontSize: '0.7rem', fontWeight: '600', display: 'block', marginBottom: '0.3rem' }}>
            Player Name
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={isEnemy ? 'Enemy player name' : 'Rally leader name'}
            style={inputStyle}
            autoFocus
          />
        </div>

        <p style={{ color: '#6b7280', fontSize: '0.65rem', marginBottom: '0.75rem' }}>
          March times in seconds to each building. Enter both regular and buffed (with march speed buff).
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {buildings.map(b => (
            <div key={b} style={{
              display: 'grid', gridTemplateColumns: '90px 1fr 1fr', gap: '0.4rem', alignItems: 'center',
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
            backgroundColor: isEnemy ? '#ef4444' : '#22d3ee',
            opacity: name.trim() ? 1 : 0.4,
          }}>
            {editingPlayer ? 'Save Changes' : 'Add Player'}
          </button>
        </div>
      </div>
    </div>
  );
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

// --- Call Order Output ---
const CallOrderOutput: React.FC<{
  rallies: CalculatedRally[];
  building: BuildingKey;
  gap: number;
  isMobile: boolean;
}> = ({ rallies, building, gap, isMobile }) => {
  if (rallies.length === 0) return null;

  const copyText = [
    `=== RALLY ORDER: ${BUILDING_LABELS[building]} ===`,
    `Gap: ${gap}s | Fill: 5min`,
    '',
    ...rallies.map((r, i) => {
      const timing = r.startDelay === 0
        ? 'START NOW (T+0s)'
        : `Wait ${r.startDelay}s (T+${r.startDelay}s)`;
      return `${i + 1}. ${r.name} — ${timing} | March: ${r.marchTime}s`;
    }),
  ].join('\n');

  const handleCopy = () => {
    navigator.clipboard.writeText(copyText);
  };

  return (
    <div style={{
      backgroundColor: '#0a0a0a', borderRadius: '12px', border: '1px solid #2a2a2a',
      padding: isMobile ? '0.75rem' : '1rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h4 style={{ color: '#fff', fontSize: '0.8rem', fontWeight: '700', fontFamily: FONT_DISPLAY }}>
          📢 CALL ORDER
        </h4>
        <button onClick={handleCopy} style={{
          padding: '0.3rem 0.6rem', backgroundColor: '#ef444420',
          border: '1px solid #ef444440', borderRadius: '6px',
          color: '#ef4444', fontSize: '0.65rem', fontWeight: '600', cursor: 'pointer',
        }}>
          📋 Copy for Chat
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {rallies.map((r, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.4rem 0.6rem', backgroundColor: `${RALLY_COLORS[i % RALLY_COLORS.length]}08`,
            borderRadius: '8px', borderLeft: `3px solid ${RALLY_COLORS[i % RALLY_COLORS.length]}`,
          }}>
            <span style={{
              color: RALLY_COLORS[i % RALLY_COLORS.length],
              fontWeight: '700', fontSize: '0.75rem', minWidth: '20px',
            }}>
              {i + 1}.
            </span>
            <span style={{ color: '#fff', fontWeight: '600', fontSize: '0.8rem', flex: 1 }}>
              {r.name}
            </span>
            <span style={{ color: '#d1d5db', fontSize: '0.7rem' }}>
              {r.startDelay === 0 ? (
                <span style={{ color: '#22c55e', fontWeight: '700' }}>START NOW</span>
              ) : (
                <>Wait <span style={{ color: '#ef4444', fontWeight: '700' }}>{r.startDelay}s</span></>
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

  // State: Player databases
  const [players, setPlayers] = useState<RallyPlayer[]>(() => loadFromStorage(STORAGE_KEY_PLAYERS, []));
  const [enemies, setEnemies] = useState<EnemyPlayer[]>(() => loadFromStorage(STORAGE_KEY_ENEMIES, []));

  // State: Configuration
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingKey>('castle');
  const [hitMode, setHitMode] = useState<HitMode>('simultaneous');
  const [interval, setInterval] = useState(0);
  const [marchType, setMarchType] = useState<MarchType>('regular');

  // State: Rally queue (ordered list of players for this rally)
  const [rallyQueue, setRallyQueue] = useState<RallySlot[]>([]);

  // State: Modals
  const [playerModalOpen, setPlayerModalOpen] = useState(false);
  const [enemyModalOpen, setEnemyModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<RallyPlayer | null>(null);
  const [editingEnemy, setEditingEnemy] = useState<EnemyPlayer | null>(null);

  // Persist players/enemies
  useEffect(() => { saveToStorage(STORAGE_KEY_PLAYERS, players); }, [players]);
  useEffect(() => { saveToStorage(STORAGE_KEY_ENEMIES, enemies); }, [enemies]);

  // Compute gap
  const gap = hitMode === 'simultaneous' ? 0 : interval;

  // Calculated rallies
  const calculatedRallies = useMemo(
    () => calculateRallyTimings(rallyQueue, gap),
    [rallyQueue, gap]
  );

  // Player IDs in queue
  const queuedPlayerIds = useMemo(() => new Set(rallyQueue.map(s => s.playerId)), [rallyQueue]);

  // Add player to queue
  const addToQueue = useCallback((player: RallyPlayer) => {
    if (queuedPlayerIds.has(player.id)) return;
    const mt = player.marchTimes[selectedBuilding][marchType];
    if (mt <= 0) return; // Can't add without march time for this building
    setRallyQueue(prev => [...prev, {
      playerId: player.id,
      playerName: player.name,
      marchTime: mt,
    }]);
  }, [queuedPlayerIds, selectedBuilding, marchType]);

  // Remove from queue
  const removeFromQueue = useCallback((index: number) => {
    setRallyQueue(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Reorder in queue
  const moveInQueue = useCallback((from: number, to: number) => {
    setRallyQueue(prev => {
      const next = [...prev];
      const removed = next.splice(from, 1);
      if (removed[0]) next.splice(to, 0, removed[0]);
      return next;
    });
  }, []);

  // Drop handler for drag-and-drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const playerId = e.dataTransfer.getData('text/plain');
    const player = players.find(p => p.id === playerId);
    if (player) addToQueue(player);
  }, [players, addToQueue]);

  // Update queue march times when building or march type changes
  useEffect(() => {
    setRallyQueue(prev => prev.map(slot => {
      const player = players.find(p => p.id === slot.playerId);
      if (!player) return slot;
      const mt = player.marchTimes[selectedBuilding][marchType];
      return { ...slot, marchTime: mt };
    }).filter(slot => slot.marchTime > 0));
  }, [selectedBuilding, marchType, players]);

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
  }, []);

  const handleSaveEnemy = useCallback((enemy: EnemyPlayer) => {
    setEnemies(prev => {
      const idx = prev.findIndex(p => p.id === enemy.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = enemy;
        return next;
      }
      return [...prev, enemy];
    });
    setEditingEnemy(null);
  }, []);

  const handleDeleteEnemy = useCallback((id: string) => {
    setEnemies(prev => prev.filter(p => p.id !== id));
  }, []);

  // Clear rally queue
  const clearQueue = useCallback(() => setRallyQueue([]), []);

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

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      {/* Hero */}
      <div style={{
        padding: isMobile ? '1.25rem 1rem 1rem' : '1.5rem 2rem 1.25rem',
        textAlign: 'center',
        background: 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)',
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <Link to="/tools" style={{ color: '#6b7280', fontSize: '0.75rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.75rem' }}>
            ← Back to Tools
          </Link>
          <h1 style={{
            fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 'bold',
            fontFamily: FONT_DISPLAY, letterSpacing: '0.05em', marginBottom: '0.5rem',
          }}>
            <span style={{ color: '#fff' }}>KvK RALLY</span>
            <span style={{ ...neonGlow('#ef4444'), marginLeft: '0.5rem' }}>COORDINATOR</span>
          </h1>
          <p style={{ color: '#6b7280', fontSize: isMobile ? '0.8rem' : '0.85rem' }}>
            Synchronized destruction. No guesswork.
          </p>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.2rem 0.6rem', backgroundColor: '#f59e0b15',
            border: '1px solid #f59e0b30', borderRadius: '20px',
            marginTop: '0.5rem',
          }}>
            <span style={{ color: '#f59e0b', fontSize: '0.6rem', fontWeight: '700' }}>🔧 ADMIN PREVIEW</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{
        maxWidth: '1200px', margin: '0 auto',
        padding: isMobile ? '0.75rem' : '1rem 2rem 2rem',
      }}>
        {/* Two-column layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: isMobile ? '1rem' : '1.5rem',
        }}>
          {/* LEFT COLUMN: Players + Config */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '0.75rem' : '1rem' }}>
            {/* Player Database */}
            <div style={{
              backgroundColor: '#111111', borderRadius: '14px',
              border: '1px solid #2a2a2a', padding: isMobile ? '0.75rem' : '1rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ color: '#fff', fontSize: '0.85rem', fontWeight: '700', fontFamily: FONT_DISPLAY }}>
                  👥 RALLY LEADERS
                </h3>
                <button onClick={() => { setEditingPlayer(null); setPlayerModalOpen(true); }} style={{
                  padding: '0.3rem 0.6rem', backgroundColor: '#ef444420',
                  border: '1px solid #ef444440', borderRadius: '6px',
                  color: '#ef4444', fontSize: '0.65rem', fontWeight: '700', cursor: 'pointer',
                }}>
                  + Add
                </button>
              </div>

              {/* March type toggle */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {(['regular', 'buffed'] as MarchType[]).map(t => (
                  <button key={t} onClick={() => setMarchType(t)} style={{
                    flex: 1, padding: '0.35rem',
                    backgroundColor: marchType === t ? (t === 'buffed' ? '#22c55e20' : '#ef444420') : 'transparent',
                    border: `1px solid ${marchType === t ? (t === 'buffed' ? '#22c55e50' : '#ef444450') : '#2a2a2a'}`,
                    borderRadius: '8px', cursor: 'pointer',
                    color: marchType === t ? (t === 'buffed' ? '#22c55e' : '#ef4444') : '#6b7280',
                    fontSize: '0.7rem', fontWeight: '600',
                  }}>
                    {t === 'buffed' ? '⚡ Buffed' : '🏃 Regular'}
                  </button>
                ))}
              </div>

              {players.length === 0 ? (
                <p style={{ color: '#4b5563', fontSize: '0.7rem', textAlign: 'center', padding: '1rem 0' }}>
                  No rally leaders yet. Add players to start coordinating.
                </p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {players.map(p => (
                    <PlayerPill
                      key={p.id}
                      player={p}
                      marchTime={p.marchTimes[selectedBuilding][marchType]}
                      marchType={marchType}
                      isInQueue={queuedPlayerIds.has(p.id)}
                      onAdd={() => addToQueue(p)}
                      onEdit={() => { setEditingPlayer(p); setPlayerModalOpen(true); }}
                      onRemoveFromDb={() => handleDeletePlayer(p.id)}
                      isMobile={isMobile}
                    />
                  ))}
                </div>
              )}
              <p style={{ color: '#4b5563', fontSize: '0.55rem', marginTop: '0.5rem' }}>
                Click or drag players to the rally queue →
              </p>
            </div>

            {/* Building Selector + Timing */}
            <div style={{
              backgroundColor: '#111111', borderRadius: '14px',
              border: '1px solid #2a2a2a', padding: isMobile ? '0.75rem' : '1rem',
            }}>
              <h3 style={{ color: '#fff', fontSize: '0.85rem', fontWeight: '700', fontFamily: FONT_DISPLAY, marginBottom: '0.75rem' }}>
                🏰 TARGET BUILDING
              </h3>
              <BuildingSelector selected={selectedBuilding} onSelect={setSelectedBuilding} isMobile={isMobile} />

              <div style={{ marginTop: '1rem' }}>
                <h4 style={{ color: '#fff', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                  ⏱️ Hit Timing
                </h4>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: hitMode === 'interval' ? '0.75rem' : 0 }}>
                  <button onClick={() => { setHitMode('simultaneous'); setInterval(0); }} style={{
                    flex: 1, padding: '0.5rem',
                    backgroundColor: hitMode === 'simultaneous' ? '#ef444420' : 'transparent',
                    border: `1px solid ${hitMode === 'simultaneous' ? '#ef444450' : '#2a2a2a'}`,
                    borderRadius: '8px', cursor: 'pointer',
                    color: hitMode === 'simultaneous' ? '#ef4444' : '#6b7280',
                    fontSize: '0.7rem', fontWeight: '600',
                  }}>
                    💥 Simultaneous
                  </button>
                  <button onClick={() => setHitMode('interval')} style={{
                    flex: 1, padding: '0.5rem',
                    backgroundColor: hitMode === 'interval' ? '#ef444420' : 'transparent',
                    border: `1px solid ${hitMode === 'interval' ? '#ef444450' : '#2a2a2a'}`,
                    borderRadius: '8px', cursor: 'pointer',
                    color: hitMode === 'interval' ? '#ef4444' : '#6b7280',
                    fontSize: '0.7rem', fontWeight: '600',
                  }}>
                    🔗 Chain Hits
                  </button>
                </div>
                {hitMode === 'interval' && (
                  <IntervalSlider value={interval} onChange={setInterval} isMobile={isMobile} />
                )}
              </div>
            </div>

            {/* Enemy Database */}
            <div style={{
              backgroundColor: '#111111', borderRadius: '14px',
              border: '1px solid #ef444425', padding: isMobile ? '0.75rem' : '1rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: '700', fontFamily: FONT_DISPLAY }}>
                  💀 ENEMY INTEL
                </h3>
                <button onClick={() => { setEditingEnemy(null); setEnemyModalOpen(true); }} style={{
                  padding: '0.25rem 0.5rem', backgroundColor: '#ef444415',
                  border: '1px solid #ef444430', borderRadius: '6px',
                  color: '#ef4444', fontSize: '0.6rem', fontWeight: '700', cursor: 'pointer',
                }}>
                  + Add
                </button>
              </div>
              <p style={{ color: '#4b5563', fontSize: '0.6rem', marginBottom: '0.5rem' }}>
                Track enemy march times for counter-rally coordination.
              </p>
              {enemies.length === 0 ? (
                <p style={{ color: '#2a2a2a', fontSize: '0.65rem', textAlign: 'center', padding: '0.5rem 0' }}>
                  No enemy intel yet.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {enemies.map(e => (
                    <div key={e.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.35rem 0.5rem', backgroundColor: '#ef444408',
                      border: '1px solid #ef444415', borderRadius: '8px',
                    }}>
                      <div>
                        <span style={{ color: '#d1d5db', fontSize: '0.7rem', fontWeight: '600' }}>{e.name}</span>
                        <span style={{ color: '#6b7280', fontSize: '0.6rem', marginLeft: '0.5rem' }}>
                          {BUILDING_SHORT[selectedBuilding]}: {e.marchTimes[selectedBuilding][marchType]}s
                          {marchType === 'buffed' && '⚡'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => { setEditingEnemy(e); setEnemyModalOpen(true); }}
                          style={{ ...arrowBtnStyle(true), fontSize: '0.55rem' }}>✏️</button>
                        <button onClick={() => handleDeleteEnemy(e.id)}
                          style={{ ...arrowBtnStyle(true), color: '#ef4444', fontSize: '0.55rem' }}>🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Rally Queue + Results */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '0.75rem' : '1rem' }}>
            {/* Rally Queue (Drop Zone) */}
            <div
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
              onDrop={handleDrop}
              style={{
                backgroundColor: '#111111', borderRadius: '14px',
                border: `2px dashed ${rallyQueue.length > 0 ? '#ef444440' : '#2a2a2a'}`,
                padding: isMobile ? '0.75rem' : '1rem',
                minHeight: '180px', transition: 'border-color 0.2s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ color: '#fff', fontSize: '0.85rem', fontWeight: '700', fontFamily: FONT_DISPLAY }}>
                  ⚔️ RALLY QUEUE — {BUILDING_LABELS[selectedBuilding]}
                </h3>
                {rallyQueue.length > 0 && (
                  <button onClick={clearQueue} style={{
                    padding: '0.2rem 0.5rem', backgroundColor: 'transparent',
                    border: '1px solid #2a2a2a', borderRadius: '6px',
                    color: '#6b7280', fontSize: '0.6rem', cursor: 'pointer',
                  }}>
                    Clear
                  </button>
                )}
              </div>

              {rallyQueue.length === 0 ? (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', padding: '2rem 1rem', color: '#4b5563',
                }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem', opacity: 0.5 }}>🎯</div>
                  <p style={{ fontSize: '0.75rem', textAlign: 'center' }}>
                    Drag or click rally leaders here to set hit order.
                  </p>
                  <p style={{ fontSize: '0.6rem', marginTop: '0.25rem' }}>
                    Minimum 2 players required.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {rallyQueue.map((slot, i) => (
                    <RallyQueueSlot
                      key={`${slot.playerId}-${i}`}
                      slot={slot}
                      index={i}
                      total={rallyQueue.length}
                      onRemove={() => removeFromQueue(i)}
                      onMoveUp={() => moveInQueue(i, i - 1)}
                      onMoveDown={() => moveInQueue(i, i + 1)}
                      color={RALLY_COLORS[i % RALLY_COLORS.length] ?? '#ef4444'}
                      isMobile={isMobile}
                    />
                  ))}
                </div>
              )}

              {rallyQueue.length === 1 && (
                <p style={{ color: '#f59e0b', fontSize: '0.6rem', marginTop: '0.5rem', textAlign: 'center' }}>
                  ⚠️ Add at least one more player to calculate timings.
                </p>
              )}
            </div>

            {/* Results */}
            {calculatedRallies.length >= 2 && (
              <>
                <CallOrderOutput
                  rallies={calculatedRallies}
                  building={selectedBuilding}
                  gap={gap}
                  isMobile={isMobile}
                />
                <GanttChart rallies={calculatedRallies} isMobile={isMobile} />
              </>
            )}

            {/* Slow march warning */}
            {rallyQueue.some(s => s.marchTime > 100) && (
              <div style={{
                padding: '0.5rem 0.75rem', backgroundColor: '#f59e0b10',
                border: '1px solid #f59e0b25', borderRadius: '8px',
              }}>
                <span style={{ color: '#f59e0b', fontSize: '0.7rem' }}>
                  ⚠️ Some players have march times over 100s — double-check those values.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <PlayerModal
        isOpen={playerModalOpen}
        onClose={() => { setPlayerModalOpen(false); setEditingPlayer(null); }}
        onSave={handleSavePlayer}
        editingPlayer={editingPlayer}
      />
      <PlayerModal
        isOpen={enemyModalOpen}
        onClose={() => { setEnemyModalOpen(false); setEditingEnemy(null); }}
        onSave={handleSaveEnemy}
        editingPlayer={editingEnemy as RallyPlayer | null}
        isEnemy
      />
    </div>
  );
};

export default RallyCoordinator;
