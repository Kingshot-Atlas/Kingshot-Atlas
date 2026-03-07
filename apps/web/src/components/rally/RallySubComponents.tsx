import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FONT_DISPLAY } from '../../utils/styles';
import type {
  BuildingKey, MarchTimes, MarchType, RallyPlayer, RallySlot, CalculatedRally,
} from './types';
import {
  BUILDING_COLORS, DEFAULT_MARCH,
  ALLY_COLOR, ENEMY_COLOR,
  arrowBtnStyle, menuItemStyle, inputStyle, cancelBtnStyle, saveBtnStyle, cardHeader,
  formatTime, formatCountdown,
  getBuildingLabel, getBuildingShort,
  getAllianceColor,
} from './types';

// --- Building Selector ---
export const BuildingSelector: React.FC<{
  selected: BuildingKey;
  onSelect: (b: BuildingKey) => void;
  isMobile: boolean;
}> = ({ selected, onSelect, isMobile }) => {
  const { t } = useTranslation();
  const size = isMobile ? 48 : 54;
  const gap = isMobile ? 4 : 6;
  const containerSize = size * 3 + gap * 2;

  const buildingButton = (key: BuildingKey, row: number, col: number) => {
    const isSelected = selected === key;
    const color = BUILDING_COLORS[key];
    return (
      <button
        key={key}
        className="rally-focusable"
        onClick={() => onSelect(key)}
        aria-label={`${getBuildingLabel(key, t)}${isSelected ? ' (selected)' : ''}`}
        aria-pressed={isSelected}
        style={{
          position: 'absolute',
          top: row * (size + gap),
          left: col * (size + gap),
          width: size,
          height: size,
          borderRadius: key === 'castle' ? '12px' : '10px',
          backgroundColor: isSelected ? `${color}25` : '#0a0a0a',
          border: `2px solid ${isSelected ? color : '#2a2a2a'}`,
          color: isSelected ? color : '#9ca3af',
          fontSize: isMobile ? '0.6rem' : '0.7rem',
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
        <span style={{ fontSize: isMobile ? '0.75rem' : '0.9rem' }} aria-hidden="true">
          {key === 'castle' ? '🏰' : '🗼'}
        </span>
        <span>{getBuildingShort(key, t)}</span>
      </button>
    );
  };

  return (
    <div role="group" aria-label="Target building selector" style={{ position: 'relative', width: containerSize, height: containerSize, margin: '0 auto' }}>
      {buildingButton('turret4', 0, 1)}
      {buildingButton('turret2', 1, 0)}
      {buildingButton('castle', 1, 1)}
      {buildingButton('turret3', 1, 2)}
      {buildingButton('turret1', 2, 1)}
    </div>
  );
};

// --- Player Pill (colored by alliance, with queue-membership badges) ---
export const PlayerPill: React.FC<{
  player: RallyPlayer;
  marchTime: number;
  inRallyQueue: boolean;
  inCounterQueue: boolean;
  onAdd: () => void;
  onEdit: () => void;
  onRemoveFromDb: () => void;
  onDuplicate?: () => void;
  isMobile: boolean;
  hasActiveBuffTimer?: boolean;
}> = ({ player, marchTime, inRallyQueue, inCounterQueue, onAdd, onEdit, onRemoveFromDb, onDuplicate, isMobile, hasActiveBuffTimer }) => {
  const { t } = useTranslation();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pillColor = getAllianceColor(player.team, player.alliance);
  const noMarchTime = marchTime <= 0;

  // Close menu on click outside
  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <div
        role="button"
        tabIndex={noMarchTime ? -1 : 0}
        aria-label={`${player.name}${noMarchTime ? ' — no march time set' : ` — ${marchTime}s march`}${inRallyQueue ? ` (${t('battlePlanner.inRally', 'in rally')})` : ''}${inCounterQueue ? ` (${t('battlePlanner.inCounter', 'in counter')})` : ''}${noMarchTime ? '' : '. Click to add to queue'}`}
        aria-disabled={noMarchTime}
        draggable={!noMarchTime}
        onDragStart={(e) => {
          if (!noMarchTime) {
            e.dataTransfer.setData('text/plain', player.id);
            e.dataTransfer.effectAllowed = 'copy';
          }
        }}
        onClick={() => onAdd()}
        title={noMarchTime ? t('battlePlanner.noMarchTimeHint', 'No march time — right-click to edit') : undefined}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAdd(); }
          if (e.key === 'Escape') setShowMenu(false);
        }}
        onContextMenu={(e) => { e.preventDefault(); setShowMenu(!showMenu); }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.3rem',
          padding: isMobile ? '0.3rem 0.55rem' : '0.35rem 0.65rem',
          backgroundColor: noMarchTime ? '#1a1a1a' : `${pillColor}12`,
          border: `1px solid ${hasActiveBuffTimer ? '#f59e0b80' : noMarchTime ? '#2a2a2a' : `${pillColor}40`}`,
          borderRadius: '20px',
          cursor: noMarchTime ? 'pointer' : 'grab',
          opacity: noMarchTime ? 0.4 : 1,
          transition: 'all 0.2s',
          fontSize: isMobile ? '0.68rem' : '0.8rem',
          color: '#fff',
          userSelect: 'none',
          minHeight: '34px',
          ...(hasActiveBuffTimer ? {
            boxShadow: '0 0 8px #f59e0b30',
            animation: 'buffTimerPulse 2s ease-in-out infinite',
          } : {}),
        }}
        className="rally-focusable"
      >
        <span style={{
          width: '6px', height: '6px', borderRadius: '50%',
          backgroundColor: pillColor, flexShrink: 0,
        }} />
        <span style={{ fontWeight: '600' }}>{player.name}</span>
        {player.alliance && (
          <span style={{
            fontSize: '0.5rem', padding: '0 0.2rem', borderRadius: '3px',
            backgroundColor: `${pillColor}20`, color: pillColor,
            border: `1px solid ${pillColor}30`, fontWeight: '700', letterSpacing: '0.02em',
          }}>
            {player.alliance}
          </span>
        )}
        {marchTime > 0 ? (
          <span style={{ color: '#9ca3af', fontSize: '0.65rem' }}>
            {marchTime}s
          </span>
        ) : (
          <span style={{ color: '#ef4444', fontSize: '0.55rem', fontWeight: '600' }}>⚠</span>
        )}
        {(inRallyQueue || inCounterQueue) && (
          <span style={{
            display: 'inline-flex', gap: '2px', marginLeft: '1px',
          }}>
            {inRallyQueue && (
              <span title={t('battlePlanner.inRally', 'In rally queue')} style={{
                fontSize: '0.5rem', padding: '0 0.15rem', borderRadius: '3px',
                backgroundColor: '#ef444425', color: '#ef4444', fontWeight: '700',
              }}>⚔️</span>
            )}
            {inCounterQueue && (
              <span title={t('battlePlanner.inCounter', 'In counter queue')} style={{
                fontSize: '0.5rem', padding: '0 0.15rem', borderRadius: '3px',
                backgroundColor: '#a855f725', color: '#a855f7', fontWeight: '700',
              }}>🛡</span>
            )}
          </span>
        )}
      </div>
      {showMenu && (
        <div role="menu" aria-label={`Actions for ${player.name}`} style={{
          position: 'absolute', bottom: '100%', left: 0, zIndex: 50,
          marginBottom: '4px', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a',
          borderRadius: '8px', overflow: 'hidden', minWidth: '120px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
        }}>
          <button role="menuitem" className="rally-focusable" onClick={() => { onEdit(); setShowMenu(false); }} style={menuItemStyle}>✏️ {t('rallyCoordinator.editMenu', 'Edit')}</button>
          {onDuplicate && (
            <button role="menuitem" className="rally-focusable" onClick={() => { onDuplicate(); setShowMenu(false); }} style={menuItemStyle}>📋 {t('rallyCoordinator.copyBtn', 'Copy')}</button>
          )}
          <button role="menuitem" className="rally-focusable" onClick={() => { onRemoveFromDb(); setShowMenu(false); }} style={{ ...menuItemStyle, color: '#ef4444' }}>🗑️ {t('rallyCoordinator.removeMenu', 'Remove')}</button>
        </div>
      )}
    </div>
  );
};

// --- Interval Slider ---
export const IntervalSlider: React.FC<{
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
  }, [onChange, min, max]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? (e.touches[0]?.clientX ?? 0) : e.clientX;
      updateValue(clientX);
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: true });
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

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    let newVal = value;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { newVal = Math.min(max, value + 1); e.preventDefault(); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { newVal = Math.max(min, value - 1); e.preventDefault(); }
    if (e.key === 'Home') { newVal = min; e.preventDefault(); }
    if (e.key === 'End') { newVal = max; e.preventDefault(); }
    if (newVal !== value) onChange(newVal);
  }, [value, min, max, onChange]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
        <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>{t('rallyCoordinator.intervalLabel')}</span>
        <span style={{ color: accentColor, fontSize: '0.8rem', fontWeight: '700' }}>{value}s</span>
      </div>
      <div
        ref={sliderRef}
        role="slider"
        tabIndex={0}
        aria-label={t('rallyCoordinator.intervalLabel', 'Interval between hits')}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${value} seconds`}
        className="rally-focusable"
        onKeyDown={handleKeyDown}
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
        {Array.from({ length: max - min + 1 }, (_, i) => min + i).map(v => (
          <span key={v} style={{ color: v === value ? accentColor : '#9ca3af', fontSize: '0.6rem', fontWeight: v === value ? '700' : '400', minWidth: '16px', textAlign: 'center' }}>
            {v}s
          </span>
        ))}
      </div>
    </div>
  );
};

// --- Touch Drag-and-Drop Reorder Hook ---
export function useTouchDragReorder(onReorder: (from: number, to: number) => void) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const itemRectsRef = useRef<DOMRect[]>([]);
  const overIndexRef = useRef<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;

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
    dragIndexRef.current = null;
    overIndexRef.current = null;
    setDragIndex(null);
    setOverIndex(null);
  }, []);

  // Non-passive native touchmove/touchend on document during active drag.
  // React 17+ registers onTouchMove as passive, so e.preventDefault() is a no-op.
  // This native listener with { passive: false } actually prevents page scroll.
  useEffect(() => {
    const onNativeTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current || !ghostRef.current) return;
      e.preventDefault();

      const touch = e.touches[0];
      if (!touch) return;

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
      if (closest >= 0) {
        overIndexRef.current = closest;
        setOverIndex(closest);
      }

      // Auto-scroll near edges
      if (cy < 100) window.scrollBy({ top: -8, behavior: 'auto' });
      if (cy > window.innerHeight - 100) window.scrollBy({ top: 8, behavior: 'auto' });
    };

    const onNativeTouchEnd = () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      if (isDraggingRef.current && dragIndexRef.current != null && overIndexRef.current != null && dragIndexRef.current !== overIndexRef.current) {
        onReorderRef.current(dragIndexRef.current, overIndexRef.current);
        try { navigator.vibrate?.(15); } catch { /* not supported */ }
      }
      cleanup();
    };

    document.addEventListener('touchmove', onNativeTouchMove, { passive: false });
    document.addEventListener('touchend', onNativeTouchEnd);
    return () => {
      document.removeEventListener('touchmove', onNativeTouchMove);
      document.removeEventListener('touchend', onNativeTouchEnd);
    };
  }, [cleanup]);

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup]);

  const handleTouchStart = useCallback((e: React.TouchEvent, index: number) => {
    const touch = e.touches[0];
    if (!touch) return;
    startPosRef.current = { x: touch.clientX, y: touch.clientY };

    // Capture element ref synchronously — React clears e.currentTarget after handler returns
    const targetEl = e.currentTarget as HTMLElement;
    const targetRect = targetEl.getBoundingClientRect();
    const targetHTML = targetEl.outerHTML;

    longPressTimerRef.current = setTimeout(() => {
      isDraggingRef.current = true;
      dragIndexRef.current = index;
      setDragIndex(index);
      try { navigator.vibrate?.(30); } catch { /* not supported */ }

      // Cache item rects for hit testing
      if (containerRef.current) {
        const items = containerRef.current.querySelectorAll('[data-queue-item]');
        itemRectsRef.current = Array.from(items).map(el => el.getBoundingClientRect());
      }

      // Create ghost from captured snapshot
      const ghost = document.createElement('div');
      ghost.style.cssText = `
        position:fixed; z-index:9999; pointer-events:none;
        width:${targetRect.width}px; opacity:0.85; transform:scale(1.04);
        border-radius:10px; box-shadow:0 8px 32px rgba(0,0,0,0.5);
        transition:none;
      `;
      ghost.innerHTML = targetHTML;
      document.body.appendChild(ghost);
      ghost.style.left = `${targetRect.left}px`;
      ghost.style.top = `${targetRect.top}px`;
      ghostRef.current = ghost;
    }, 200);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    // Cancel long-press if finger moved too far before activation
    const touch = e.touches[0];
    if (!touch) return;
    if (!isDraggingRef.current && startPosRef.current && longPressTimerRef.current) {
      const dx = touch.clientX - startPosRef.current.x;
      const dy = touch.clientY - startPosRef.current.y;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }
    // Actual drag handling is done by the native document listener (non-passive)
  }, []);

  const handleTouchEnd = useCallback(() => {
    // Actual end handling is done by the native document listener
  }, []);

  return { containerRef, dragIndex, overIndex, handleTouchStart, handleTouchMove, handleTouchEnd };
}

// --- Rally Queue Slot (with touch drag-and-drop + per-player buff toggle) ---
export const RallyQueueSlot: React.FC<{
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
  const slotAllianceColor = getAllianceColor(slot.team, slot.alliance);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.altKey && e.key === 'ArrowUp' && index > 0) { e.preventDefault(); onMoveUp(); }
    else if (e.altKey && e.key === 'ArrowDown' && index < total - 1) { e.preventDefault(); onMoveDown(); }
    else if (e.key === 'Delete') { e.preventDefault(); onRemove(); }
  };
  const buffBtnStyle: React.CSSProperties = {
    padding: isMobile ? '0.15rem 0.4rem' : '0.2rem 0.5rem',
    minHeight: isMobile ? '32px' : '26px',
    backgroundColor: slot.useBuffed ? '#22c55e20' : '#1a1a1a',
    border: `1px solid ${slot.useBuffed ? '#22c55e50' : '#2a2a2a'}`,
    borderRadius: '14px', cursor: 'pointer',
    color: slot.useBuffed ? '#22c55e' : '#9ca3af',
    fontSize: '0.6rem', fontWeight: '600',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem',
    transition: 'all 0.15s', whiteSpace: 'nowrap',
  };

  return (
    <div
      data-queue-item
      tabIndex={0}
      role="listitem"
      aria-label={`${index + 1}. ${slot.playerName}, ${slot.marchTime}s. Alt+Arrow to reorder, Delete to remove.`}
      draggable
      onKeyDown={handleKeyDown}
      onDragStart={(e) => {
        e.dataTransfer.setData('queue-index', index.toString());
        e.dataTransfer.effectAllowed = 'move';
      }}
      onTouchStart={onTouchDragStart}
      onTouchMove={onTouchDragMove}
      onTouchEnd={onTouchDragEnd}
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile
          ? '1fr auto auto auto auto auto'
          : 'auto 1fr auto auto minmax(90px, auto) auto auto auto',
        alignItems: 'center',
        gap: isMobile ? '0.25rem' : '0.4rem',
        padding: isMobile ? '0.4rem 0.4rem' : '0.4rem 0.6rem',
        backgroundColor: isDragOver ? `${color}20` : `${color}08`,
        border: `1px solid ${isDragOver ? `${color}70` : `${color}30`}`,
        borderLeft: `3px solid ${slotAllianceColor}`,
        borderRadius: '10px',
        transition: isBeingDragged ? 'none' : 'all 0.15s',
        cursor: 'grab',
        opacity: isBeingDragged ? 0.3 : 1,
        transform: isDragOver ? 'scale(1.02)' : 'none',
      }}
    >
      {/* Col 1 (desktop only): grip handle */}
      {!isMobile && (
        <span style={{
          display: 'flex', cursor: 'grab',
          color: '#4b5563', fontSize: '0.85rem', letterSpacing: '0.05em',
          userSelect: 'none',
        }} aria-hidden="true">⠇</span>
      )}

      {/* Col: Player Name (with badge) */}
      <span style={{
        display: 'flex', alignItems: 'center', gap: '0.35rem',
        overflow: 'hidden', minWidth: 0,
      }}>
        <span style={{
          width: '18px', height: '18px', borderRadius: '50%',
          backgroundColor: `${color}25`, color: color,
          fontSize: '0.55rem', fontWeight: '700',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {index + 1}
        </span>
        <span style={{
          color: '#fff', fontSize: isMobile ? '0.75rem' : '0.85rem', fontWeight: '600',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {slot.playerName}
        </span>
      </span>

      {/* Col: Alliance Tag */}
      <span style={{
        padding: slot.alliance ? '0.05rem 0.3rem' : 0,
        borderRadius: '4px',
        fontSize: '0.55rem', fontWeight: '700', letterSpacing: '0.03em',
        backgroundColor: slot.alliance ? `${slotAllianceColor}20` : 'transparent',
        color: slotAllianceColor,
        border: slot.alliance ? `1px solid ${slotAllianceColor}40` : 'none',
        whiteSpace: 'nowrap', textAlign: 'center',
        minWidth: slot.alliance ? undefined : '20px',
      }}>
        {slot.alliance || ''}
      </span>

      {/* Col: March time */}
      <span style={{
        color: '#9ca3af', fontSize: '0.7rem', fontWeight: '600',
        whiteSpace: 'nowrap', textAlign: 'center',
      }}>
        {slot.marchTime}s
      </span>

      {/* Col: Buff/Reg toggle + timer */}
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', justifyContent: 'center' }}>
        <button
          onClick={onToggleBuff}
          className="rally-focusable"
          aria-label={slot.useBuffed ? 'Using buffed march speed. Click to switch to regular' : 'Using regular march speed. Click to switch to buffed'}
          aria-pressed={slot.useBuffed}
          style={buffBtnStyle}
        >
          {slot.useBuffed ? '⚡' : '🏃'}
          <span style={{ fontSize: '0.55rem' }}>{slot.useBuffed ? 'Buff' : 'Reg'}</span>
        </button>
        {buffTimeRemaining != null && buffTimeRemaining > 0 && (
          <span style={{
            color: '#f59e0b', fontSize: '0.5rem', fontWeight: '600',
            padding: '0.1rem 0.2rem', backgroundColor: '#f59e0b15',
            border: '1px solid #f59e0b30', borderRadius: '3px',
            whiteSpace: 'nowrap', lineHeight: 1.3,
          }}>
            {formatCountdown(buffTimeRemaining)}
          </span>
        )}
      </span>

      {/* Col: Up */}
      <button onClick={onMoveUp} disabled={index === 0} className="rally-focusable" aria-label={`Move ${slot.playerName} up`} style={arrowBtnStyle(index > 0, isMobile)}>▲</button>

      {/* Col: Down */}
      <button onClick={onMoveDown} disabled={index === total - 1} className="rally-focusable" aria-label={`Move ${slot.playerName} down`} style={arrowBtnStyle(index < total - 1, isMobile)}>▼</button>

      {/* Col: Remove */}
      <button onClick={onRemove} className="rally-focusable" aria-label={`Remove ${slot.playerName} from queue`} style={{ ...arrowBtnStyle(true, isMobile), color: '#ef4444' }}>✕</button>
    </div>
  );
};

// --- Gantt Chart (march-only timeline, no fill time) ---
export const GanttChart: React.FC<{
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
    <div
      role="img"
      aria-label={`${title}: ${rallies.length} rallies visualized on a Gantt timeline`}
      style={{
        backgroundColor: '#0a0a0a', borderRadius: '10px', border: '1px solid #2a2a2a',
        padding: isMobile ? '0.6rem' : '0.75rem', overflow: 'hidden',
      }}
    >
      <h4 style={cardHeader()}>{title}</h4>
      <div style={{ position: 'relative', height: chartHeight, marginLeft: leftLabelWidth }}>
        {markers.map(t => (
          <div key={t} style={{
            position: 'absolute', left: `${timeToPercent(t)}%`, top: 0, bottom: 0,
            borderLeft: '1px solid #1a1a1a', zIndex: 0,
          }}>
            <span style={{
              position: 'absolute', bottom: 0, left: '-12px',
              color: '#6b7280', fontSize: '0.6rem', whiteSpace: 'nowrap',
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
                color: '#d1d5db', fontSize: isMobile ? '0.65rem' : '0.7rem',
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
                <span style={{ color: '#000', fontSize: '0.6rem', fontWeight: '700' }}>
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

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.4rem', justifyContent: 'center' }} aria-hidden="true">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <div style={{ width: '12px', height: '8px', backgroundColor: colors[0] ?? '#3b82f6', borderRadius: '2px' }} />
          <span style={{ color: '#d1d5db', fontSize: '0.65rem' }}>{t('rallyCoordinator.march')}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <div style={{ width: '2px', height: '10px', backgroundColor: '#fff', boxShadow: '0 0 4px #fff' }} />
          <span style={{ color: '#d1d5db', fontSize: '0.65rem' }}>{t('rallyCoordinator.hit')}</span>
        </div>
      </div>
    </div>
  );
};

// --- Add/Edit Player Modal ---
export const PlayerModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (player: RallyPlayer) => void;
  editingPlayer: RallyPlayer | null;
  defaultTeam?: 'ally' | 'enemy';
}> = ({ isOpen, onClose, onSave, editingPlayer, defaultTeam = 'ally' }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [team, setTeam] = useState<'ally' | 'enemy'>(defaultTeam);
  const [alliance, setAlliance] = useState('');
  const [marchTimes, setMarchTimes] = useState<MarchTimes>(DEFAULT_MARCH);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingPlayer) {
      setName(editingPlayer.name);
      setTeam(editingPlayer.team);
      setAlliance(editingPlayer.alliance || '');
      setMarchTimes(editingPlayer.marchTimes);
    } else {
      setName('');
      setTeam(defaultTeam);
      setAlliance('');
      setMarchTimes(DEFAULT_MARCH);
    }
  }, [editingPlayer, isOpen, defaultTeam]);

  // Focus trap: keep Tab cycling within the dialog
  useEffect(() => {
    if (!isOpen || !dialogRef.current) return;
    const dialog = dialogRef.current;
    const getFocusable = () => dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    // Auto-focus first input
    const timer = setTimeout(() => {
      const first = dialog.querySelector<HTMLElement>('input');
      first?.focus();
    }, 50);
    const handleTrap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    };
    dialog.addEventListener('keydown', handleTrap);
    return () => { clearTimeout(timer); dialog.removeEventListener('keydown', handleTrap); };
  }, [isOpen]);

  if (!isOpen) return null;

  const teamColor = team === 'ally' ? ALLY_COLOR : ENEMY_COLOR;

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: editingPlayer?.id || `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      team,
      marchTimes,
      alliance: alliance.trim() || undefined,
    });
    onClose();
  };

  const updateMarch = (building: BuildingKey, type: MarchType, value: string) => {
    const num = parseInt(value) || 0;
    const clamped = Math.max(0, Math.min(999, num));

    setMarchTimes(prev => {
      const current = prev[building];
      const updated = { ...current, [type]: clamped };
      return { ...prev, [building]: updated };
    });
  };

  const buildings: BuildingKey[] = ['castle', 'turret1', 'turret2', 'turret3', 'turret4'];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)', padding: '1rem',
      }}
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-modal-title"
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#111111', borderRadius: '16px',
          border: `1px solid ${teamColor}30`,
          padding: '1.5rem', maxWidth: '480px', width: '100%',
          maxHeight: '85vh', overflowY: 'auto',
        }}
      >
        <h3 id="player-modal-title" style={{
          color: '#fff', fontSize: '1rem', fontWeight: '700', marginBottom: '1rem',
          fontFamily: FONT_DISPLAY,
        }}>
          {editingPlayer ? t('rallyCoordinator.editPlayer', 'Edit Player') : t('rallyCoordinator.addPlayerTitle', 'Add Player')}
        </h3>

        {/* Team toggle */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          {(['ally', 'enemy'] as const).map(tm => (
            <button key={tm} onClick={() => setTeam(tm)} style={{
              flex: 1, padding: '0.4rem',
              backgroundColor: team === tm ? (tm === 'ally' ? `${ALLY_COLOR}20` : `${ENEMY_COLOR}20`) : 'transparent',
              border: `1px solid ${team === tm ? (tm === 'ally' ? `${ALLY_COLOR}50` : `${ENEMY_COLOR}50`) : '#2a2a2a'}`,
              borderRadius: '8px', cursor: 'pointer',
              color: team === tm ? (tm === 'ally' ? ALLY_COLOR : ENEMY_COLOR) : '#6b7280',
              fontSize: '0.8rem', fontWeight: '600',
            }}>
              {tm === 'ally' ? `🛡️ ${t('rallyCoordinator.allyLabel', 'Ally')}` : `💀 ${t('rallyCoordinator.enemyLabel', 'Enemy')}`}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ color: '#9ca3af', fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '0.3rem' }}>
            {t('rallyCoordinator.playerNameLabel', 'Player Name')}
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('rallyCoordinator.playerNamePlaceholder', 'Player name')}
            style={{ ...inputStyle, borderColor: `${teamColor}30` }}
            autoFocus
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ color: '#9ca3af', fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '0.3rem' }}>
            {t('rallyCoordinator.allianceLabel', 'Alliance')}
          </label>
          <input
            value={alliance}
            onChange={e => setAlliance(e.target.value)}
            placeholder={t('rallyCoordinator.alliancePlaceholder', 'e.g. ABC1')}
            maxLength={10}
            style={{ ...inputStyle, borderColor: `${teamColor}30`, maxWidth: '160px' }}
          />
          <span style={{ color: '#6b7280', fontSize: '0.6rem', marginLeft: '0.5rem' }}>
            {t('rallyCoordinator.allianceHint', 'Shown as a tag in queue & call order')}
          </span>
        </div>

        <p style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '0.75rem' }}>
          {t('rallyCoordinator.marchTimesHelp', 'March times in seconds. Enter regular and/or buffed values for each building.')}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {buildings.map(b => (
            <div key={b} style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.4rem', alignItems: 'center',
            }}>
              <span style={{ color: BUILDING_COLORS[b], fontSize: '0.75rem', fontWeight: '600', gridColumn: '1 / -1' }}>
                {getBuildingLabel(b, t)}
              </span>
              <div style={{ position: 'relative' }}>
                <input
                  type="number" min="0" max="999"
                  value={marchTimes[b].regular || ''}
                  onChange={e => updateMarch(b, 'regular', e.target.value)}
                  placeholder={t('rallyCoordinator.regular', 'Regular')}
                  style={{
                    ...inputStyle, fontSize: '1rem', padding: '0.4rem 1.5rem 0.4rem 0.5rem',
                  }}
                />
                <span style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280', fontSize: '0.65rem' }}>
                  s
                </span>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type="number" min="0" max="999"
                  value={marchTimes[b].buffed || ''}
                  onChange={e => updateMarch(b, 'buffed', e.target.value)}
                  placeholder={t('rallyCoordinator.buffedPlaceholder', 'Buffed ⚡')}
                  style={{
                    ...inputStyle, fontSize: '1rem', padding: '0.4rem 1.5rem 0.4rem 0.5rem',
                    borderColor: '#22c55e30',
                  }}
                />
                <span style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', color: '#22c55e', fontSize: '0.65rem' }}>
                  ⚡
                </span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="rally-focusable" style={cancelBtnStyle}>{t('rallyCoordinator.cancel')}</button>
          <button onClick={handleSave} disabled={!name.trim()} className="rally-focusable" style={{
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

// --- Live Call Timer (real-time voice call ticker) ---
export const LiveCallTimer: React.FC<{
  rallies: CalculatedRally[];
  isMobile: boolean;
  colors: string[];
  accentColor: string;
}> = ({ rallies, isMobile, colors, accentColor }) => {
  const { t } = useTranslation();
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(-1); // -1 = not started, 0+ = seconds elapsed
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Build a timeline: for each second, which leaders start
  const maxDelay = Math.max(0, ...rallies.map(r => r.startDelay));
  type TimelineLeader = { name: string; color: string; index: number; alliance?: string; team: 'ally' | 'enemy' };
  const timeline = useMemo(() => {
    const map = new Map<number, TimelineLeader[]>();
    rallies.forEach((r, i) => {
      const sec = r.startDelay;
      if (!map.has(sec)) map.set(sec, []);
      map.get(sec)!.push({ name: r.name, color: colors[i % colors.length] ?? '#3b82f6', index: i, alliance: r.alliance, team: r.team });
    });
    const result: { second: number; leaders: TimelineLeader[] }[] = [];
    for (let s = 0; s <= maxDelay; s++) {
      result.push({ second: s, leaders: map.get(s) || [] });
    }
    return result;
  }, [rallies, colors, maxDelay]);

  const start = useCallback(() => {
    setElapsed(0);
    setRunning(true);
  }, []);

  const stop = useCallback(() => {
    setRunning(false);
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  const reset = useCallback(() => {
    stop();
    setElapsed(-1);
  }, [stop]);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setElapsed(prev => {
        const next = prev + 1;
        if (next > maxDelay + 2) { // Give 2 extra seconds after last leader
          setRunning(false);
          return prev;
        }
        return next;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, maxDelay]);

  // Auto-scroll to current second
  useEffect(() => {
    if (elapsed < 0 || !scrollRef.current) return;
    const el = scrollRef.current.querySelector(`[data-sec="${elapsed}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [elapsed]);

  const finished = elapsed > maxDelay;

  return (
    <div style={{
      backgroundColor: '#0a0a0a', borderRadius: '10px',
      border: `1px solid ${running ? `${accentColor}50` : '#2a2a2a'}`,
      padding: isMobile ? '0.6rem' : '0.75rem',
      transition: 'border-color 0.3s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <h4 style={cardHeader()}>🎙️ {t('rallyCoordinator.liveCallTimer', 'LIVE CALL TIMER')}</h4>
        <div style={{ display: 'flex', gap: '0.3rem' }}>
          {!running && elapsed < 0 && (
            <button onClick={start} style={{
              padding: isMobile ? '0.4rem 0.75rem' : '0.25rem 0.6rem',
              minHeight: isMobile ? '44px' : 'auto',
              backgroundColor: '#22c55e20', border: '1px solid #22c55e50',
              borderRadius: '6px', color: '#22c55e',
              fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer',
            }}>
              ▶ {t('rallyCoordinator.startTimer', 'START')}
            </button>
          )}
          {running && (
            <button onClick={stop} style={{
              padding: isMobile ? '0.4rem 0.75rem' : '0.25rem 0.6rem',
              minHeight: isMobile ? '44px' : 'auto',
              backgroundColor: '#ef444420', border: '1px solid #ef444450',
              borderRadius: '6px', color: '#ef4444',
              fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer',
            }}>
              ⏸ {t('rallyCoordinator.stopTimer', 'STOP')}
            </button>
          )}
          {!running && elapsed >= 0 && (
            <>
              <button onClick={start} style={{
                padding: isMobile ? '0.4rem 0.75rem' : '0.25rem 0.6rem',
                minHeight: isMobile ? '44px' : 'auto',
                backgroundColor: '#22c55e20', border: '1px solid #22c55e50',
                borderRadius: '6px', color: '#22c55e',
                fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer',
              }}>
                ▶ {t('rallyCoordinator.resumeTimer', 'RESUME')}
              </button>
              <button onClick={reset} style={{
                padding: isMobile ? '0.4rem 0.75rem' : '0.25rem 0.6rem',
                minHeight: isMobile ? '44px' : 'auto',
                backgroundColor: '#ffffff08', border: '1px solid #2a2a2a',
                borderRadius: '6px', color: '#9ca3af',
                fontSize: '0.7rem', fontWeight: '600', cursor: 'pointer',
              }}>
                ↺ {t('rallyCoordinator.resetTimer', 'RESET')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Not started */}
      {elapsed < 0 && (
        <p style={{ color: '#6b7280', fontSize: '0.7rem', textAlign: 'center', padding: '0.5rem 0' }}>
          {t('rallyCoordinator.liveTimerHint', 'Press START when you begin the voice call. The timer will guide you through each leader second by second.')}
        </p>
      )}

      {/* Timer display */}
      {elapsed >= 0 && (
        <div ref={scrollRef} style={{
          display: 'flex', flexDirection: 'column', gap: '2px',
          maxHeight: isMobile ? '280px' : '340px', overflowY: 'auto',
        }}>
          {timeline.map(({ second, leaders }: { second: number; leaders: TimelineLeader[] }) => {
            const isCurrent = second === elapsed;
            const isPast = second < elapsed;
            const isFuture = second > elapsed;
            const hasLeaders = leaders.length > 0;

            return (
              <div
                key={second}
                data-sec={second}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: isCurrent ? '0.5rem 0.6rem' : '0.25rem 0.6rem',
                  borderRadius: '8px',
                  backgroundColor: isCurrent
                    ? hasLeaders ? `${accentColor}20` : '#ffffff08'
                    : 'transparent',
                  border: isCurrent
                    ? `2px solid ${hasLeaders ? accentColor : '#4b5563'}`
                    : '2px solid transparent',
                  opacity: isPast ? 0.35 : isFuture ? 0.6 : 1,
                  transition: 'all 0.2s',
                  transform: isCurrent ? 'scale(1.02)' : 'none',
                }}
              >
                {/* Second counter */}
                <span style={{
                  minWidth: '32px', textAlign: 'right',
                  color: isCurrent ? '#fff' : '#6b7280',
                  fontSize: isCurrent ? '0.9rem' : '0.7rem',
                  fontWeight: isCurrent ? '800' : '600',
                  fontFamily: 'monospace',
                }}>
                  {second}s
                </span>

                {/* Leaders or empty marker */}
                {hasLeaders ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', flex: 1 }}>
                    {leaders.map((l) => (
                      <span key={l.index} style={{
                        padding: isCurrent ? '0.25rem 0.6rem' : '0.15rem 0.4rem',
                        borderRadius: '14px',
                        backgroundColor: isCurrent ? l.color : `${l.color}30`,
                        color: isCurrent ? '#000' : l.color,
                        fontSize: isCurrent ? '0.85rem' : '0.7rem',
                        fontWeight: '700',
                        whiteSpace: 'nowrap',
                        display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                      }}>
                        📢 {l.name}
                        {l.alliance && (
                          <span style={{
                            fontSize: '0.55rem', padding: '0 0.2rem',
                            borderRadius: '3px', fontWeight: '700',
                            backgroundColor: isCurrent ? 'rgba(0,0,0,0.15)' : (l.team === 'enemy' ? '#ef444430' : `${l.color}20`),
                            color: isCurrent ? '#000' : (l.team === 'enemy' ? '#ef4444' : l.color),
                          }}>
                            {l.alliance}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span style={{
                    color: isCurrent ? '#4b5563' : '#2a2a2a',
                    fontSize: '0.65rem', fontStyle: 'italic',
                  }}>
                    —
                  </span>
                )}
              </div>
            );
          })}

          {/* Finished indicator */}
          {finished && (
            <div style={{
              textAlign: 'center', padding: '0.75rem',
              color: '#22c55e', fontSize: '0.85rem', fontWeight: '700',
            }}>
              ✅ {t('rallyCoordinator.allRalliesCalled', 'All rallies called!')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// --- Call Order Output ---
export const CallOrderOutput: React.FC<{
  rallies: CalculatedRally[];
  building: BuildingKey;
  isMobile: boolean;
  title: string;
  colors: string[];
  accentColor: string;
}> = ({ rallies, building, isMobile, title, colors, accentColor }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  if (rallies.length === 0) return null;

  const buildCopyText = () => {
    // Compute base start time in UTC: now + 30s, rounded UP to next :30
    const now = new Date();
    const bufferMs = 30_000;
    const target = now.getTime() + bufferMs;
    const roundTo = 30_000;
    const rounded = Math.ceil(target / roundTo) * roundTo;

    const formatUTC = (ms: number) => {
      const d = new Date(ms);
      return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')} UTC`;
    };

    return [
      `📢 RALLY ORDER: ${getBuildingLabel(building, t)}`,
      '',
      ...rallies.map((r) =>
        `${r.name} — ${formatUTC(rounded + r.startDelay * 1000)}`
      ),
    ].join('\n');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildCopyText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard not available */ }
  };

  return (
    <div style={{
      backgroundColor: '#0a0a0a', borderRadius: '10px', border: '1px solid #2a2a2a',
      padding: isMobile ? '0.6rem' : '0.75rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <h4 style={cardHeader()}>{title}</h4>
        <button onClick={handleCopy} style={{
          padding: isMobile ? '0.4rem 0.75rem' : '0.2rem 0.5rem',
          minHeight: isMobile ? '44px' : 'auto',
          backgroundColor: copied ? '#22c55e20' : `${accentColor}20`,
          border: `1px solid ${copied ? '#22c55e40' : `${accentColor}40`}`,
          borderRadius: '6px',
          color: copied ? '#22c55e' : accentColor,
          fontSize: '0.7rem', fontWeight: '600', cursor: 'pointer',
          transition: 'all 0.2s',
        }}>
          {copied ? `✓ ${t('rallyCoordinator.copied', 'Copied')}` : `📋 ${t('rallyCoordinator.copyBtn', 'Copy')}`}
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {rallies.map((r, i) => {
          const prevDelay = i > 0 ? rallies[i - 1]!.startDelay : 0;
          const diff = r.startDelay - prevDelay;
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.35rem 0.5rem', backgroundColor: `${colors[i % colors.length]}08`,
              borderRadius: '8px', borderLeft: `3px solid ${colors[i % colors.length]}`,
            }}>
              <span style={{
                color: colors[i % colors.length],
                fontWeight: '700', fontSize: '0.8rem', minWidth: '18px',
              }}>
                {i + 1}.
              </span>
              <span style={{ color: '#fff', fontWeight: '600', fontSize: '0.82rem', flex: 1, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                {r.name}
                {r.alliance && (() => {
                  const ac = getAllianceColor(r.team, r.alliance);
                  return (
                    <span style={{
                      fontSize: '0.55rem', padding: '0.05rem 0.25rem', borderRadius: '4px',
                      fontWeight: '700', letterSpacing: '0.03em',
                      backgroundColor: `${ac}20`, color: ac, border: `1px solid ${ac}40`,
                    }}>
                      {r.alliance}
                    </span>
                  );
                })()}
              </span>
              <span style={{ color: '#d1d5db', fontSize: '0.75rem' }}>
                {i === 0 ? (
                  <span style={{ color: '#22c55e', fontWeight: '700' }}>{t('rallyCoordinator.callNow')}</span>
                ) : diff === 0 ? (
                  <span style={{ color: '#f59e0b', fontWeight: '700' }}>{t('rallyCoordinator.sameSec', 'same sec')}</span>
                ) : (
                  <>+<span style={{ color: accentColor, fontWeight: '700' }}>{diff}s</span>{' '}<span style={{ color: '#6b7280', fontSize: '0.6rem' }}>{t('rallyCoordinator.afterPrev', 'after prev')}</span></>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* Copy format preview */}
      <div style={{
        marginTop: '0.5rem', padding: '0.4rem 0.6rem',
        backgroundColor: '#0d0d0d', border: '1px dashed #1a1a1a', borderRadius: '6px',
      }}>
        <div style={{ fontSize: '0.55rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>
          {t('battlePlanner.copyPreviewLabel', 'Copy preview')}
        </div>
        <pre style={{
          fontSize: '0.6rem', color: '#9ca3af', margin: 0,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', lineHeight: 1.5,
        }}>
          {`📢 RALLY ORDER: ${getBuildingLabel(building, t)}\n\n${rallies.map((r, i) => {
            const prevDelay = i > 0 ? rallies[i - 1]!.startDelay : 0;
            const diff = r.startDelay - prevDelay;
            const label = i === 0 ? 'CALL NOW' : diff === 0 ? 'same sec' : `+${diff}s`;
            return `${r.name} — ${label}`;
          }).join('\n')}`}
        </pre>
      </div>
    </div>
  );
};
