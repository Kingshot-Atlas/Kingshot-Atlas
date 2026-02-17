import React from 'react';
import { useTranslation } from 'react-i18next';
import type { RallySlot } from './types';
import { CARD, cardHeader } from './types';
import { RallyQueueSlot } from './RallySubComponents';

interface TouchDragState {
  containerRef: React.RefObject<HTMLDivElement | null>;
  overIndex: number | null;
  dragIndex: number | null;
  handleTouchStart: (e: React.TouchEvent, index: number) => void;
  handleTouchMove: (e: React.TouchEvent) => void;
  handleTouchEnd: () => void;
}

interface QueueDropZoneProps {
  queue: RallySlot[];
  onDrop: (e: React.DragEvent) => void;
  onRemove: (i: number) => void;
  onMove: (from: number, to: number) => void;
  onToggleBuff: (i: number) => void;
  onClear: () => void;
  queueType: 'rally' | 'counter';
  title: string;
  accent: string;
  colors: string[];
  minPlayers: number;
  isMobile: boolean;
  buffTimers: Record<string, number>;
  tickNow: number;
  touchDrag: TouchDragState;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}

const QueueDropZone: React.FC<QueueDropZoneProps> = ({
  queue,
  onDrop,
  onRemove,
  onMove,
  onToggleBuff,
  onClear,
  queueType,
  title,
  accent,
  colors: slotColors,
  minPlayers,
  isMobile,
  buffTimers,
  tickNow,
  touchDrag,
  scrollRef,
}) => {
  const { t } = useTranslation();
  return (
    <div
      ref={scrollRef}
      role="region"
      aria-label={`${queueType === 'rally' ? 'Rally' : 'Counter'} queue — ${queue.length} players`}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDrop={onDrop}
      style={{
        ...CARD,
        border: `2px dashed ${queue.length > 0 ? `${accent}40` : '#2a2a2a'}`,
        minHeight: '120px', transition: 'border-color 0.2s, box-shadow 0.3s',
        ...(queue.length === 0 ? {
          animation: 'dropZonePulse 2.5s ease-in-out infinite',
        } : {}),
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <h3 style={cardHeader()}>{title}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {isMobile && queue.length > 1 && (
            <span style={{ color: '#9ca3af', fontSize: '0.6rem', fontStyle: 'italic' }}>
              {t('rallyCoordinator.holdToDrag', 'Hold to drag')}
            </span>
          )}
          {queue.length > 0 && (
            <button
              onClick={onClear}
              className="rally-focusable"
              aria-label={`Clear all ${queue.length} players from ${queueType} queue`}
              style={{
                padding: '0.15rem 0.4rem', minHeight: '32px', minWidth: '48px',
                backgroundColor: 'transparent',
                border: '1px solid #2a2a2a', borderRadius: '5px',
                color: '#d1d5db', fontSize: '0.65rem', cursor: 'pointer',
              }}
            >
              {t('rallyCoordinator.clearBtn', 'Clear')}
            </button>
          )}
        </div>
      </div>

      {queue.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '1.5rem 0.75rem', color: '#9ca3af',
        }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem', opacity: 0.5 }} aria-hidden="true">
            {queueType === 'rally' ? '🎯' : '🛡️'}
          </div>
          <p style={{ fontSize: '0.75rem', textAlign: 'center', fontWeight: '600', color: '#d1d5db', marginBottom: '0.25rem' }}>
            {queueType === 'rally'
              ? t('rallyCoordinator.emptyRallyTitle', 'No rally leaders queued')
              : t('rallyCoordinator.emptyCounterTitle', 'No counter leaders queued')}
          </p>
          <p style={{ fontSize: '0.7rem', textAlign: 'center' }}>
            {isMobile ? t('rallyCoordinator.tapToAdd', 'Tap players above to add') : t('rallyCoordinator.dropToAdd', 'Drop players here or click to add')}
          </p>
          <p style={{ fontSize: '0.65rem', marginTop: '0.15rem' }}>
            {minPlayers > 1 ? t('rallyCoordinator.minPlayersLabel', 'Min {{count}} players', { count: minPlayers }) : t('rallyCoordinator.minOnePlayer', 'Min 1 player')}
          </p>
        </div>
      ) : (
        <div ref={touchDrag.containerRef} role="list" aria-label={`${queueType === 'rally' ? 'Rally' : 'Counter'} queue players`} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {queue.map((slot, i) => (
            <RallyQueueSlot
              key={`${slot.playerId}-${i}`}
              slot={slot}
              index={i}
              total={queue.length}
              onRemove={() => onRemove(i)}
              onMoveUp={() => onMove(i, i - 1)}
              onMoveDown={() => onMove(i, i + 1)}
              onToggleBuff={() => onToggleBuff(i)}
              color={slotColors[i % slotColors.length] ?? accent}
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
        <p role="status" aria-live="polite" style={{ color: '#f59e0b', fontSize: '0.65rem', marginTop: '0.4rem', textAlign: 'center' }}>
          {t('rallyCoordinator.needMorePlayers', 'Need {{count}} more to calculate timings.', { count: minPlayers - queue.length })}
        </p>
      )}
    </div>
  );
};

export default QueueDropZone;
