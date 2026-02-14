import React from 'react';
import { useTranslation } from 'react-i18next';
import type { BuildingKey, MarchType, RallyPlayer, RallyPreset, RallySlot } from './types';
import {
  ALLY_COLOR, ENEMY_COLOR, BUILDING_SHORT,
  CARD, cardHeader, inputStyle,
} from './types';
import { BuildingSelector, PlayerPill } from './RallySubComponents';

interface RallyPlayersColumnProps {
  allies: RallyPlayer[];
  enemies: RallyPlayer[];
  players: RallyPlayer[];
  selectedBuilding: BuildingKey;
  setSelectedBuilding: (b: BuildingKey) => void;
  marchType: MarchType;
  setMarchType: (m: MarchType) => void;
  queuedPlayerIds: Set<string>;
  counterQueuedIds: Set<string>;
  buffTimers: Record<string, number>;
  presets: RallyPreset[];
  presetName: string;
  setPresetName: (n: string) => void;
  showPresetSave: boolean;
  setShowPresetSave: (s: boolean) => void;
  howToOpen: boolean;
  setHowToOpen: React.Dispatch<React.SetStateAction<boolean>>;
  rallyQueue: RallySlot[];
  isMobile: boolean;
  onAddAlly: () => void;
  onAddEnemy: () => void;
  onAddToQueue: (player: RallyPlayer, useBuffed: boolean) => void;
  onAddToCounterQueue: (player: RallyPlayer, useBuffed: boolean) => void;
  onEditPlayer: (player: RallyPlayer, team: 'ally' | 'enemy') => void;
  onDeletePlayer: (id: string) => void;
  onSavePreset: () => void;
  onLoadPreset: (preset: RallyPreset) => void;
  onDeletePreset: (id: string) => void;
}

const RallyPlayersColumn: React.FC<RallyPlayersColumnProps> = ({
  allies, enemies, players,
  selectedBuilding, setSelectedBuilding,
  marchType, setMarchType,
  queuedPlayerIds, counterQueuedIds, buffTimers,
  presets, presetName, setPresetName,
  showPresetSave, setShowPresetSave,
  howToOpen, setHowToOpen,
  rallyQueue, isMobile,
  onAddAlly, onAddEnemy,
  onAddToQueue, onAddToCounterQueue,
  onEditPlayer, onDeletePlayer,
  onSavePreset, onLoadPreset, onDeletePreset,
}) => {
  const { t } = useTranslation();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '0.75rem' : '0.75rem' }}>

      {/* Rally Leaders */}
      <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={cardHeader()}>👥 RALLY LEADERS</h3>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={onAddAlly} style={{
              padding: '0.2rem 0.4rem', backgroundColor: `${ALLY_COLOR}15`,
              border: `1px solid ${ALLY_COLOR}30`, borderRadius: '5px',
              color: ALLY_COLOR, fontSize: '0.65rem', fontWeight: '700', cursor: 'pointer',
            }}>
              {t('rallyCoordinator.addAlly')}
            </button>
            <button onClick={onAddEnemy} style={{
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
                  onAdd={() => onAddToQueue(p, marchType === 'buffed')}
                  onEdit={() => onEditPlayer(p, 'ally')}
                  onRemoveFromDb={() => onDeletePlayer(p.id)}
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
                  onAdd={() => onAddToCounterQueue(p, marchType === 'buffed')}
                  onEdit={() => onEditPlayer(p, 'enemy')}
                  onRemoveFromDb={() => onDeletePlayer(p.id)}
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
                <button onClick={onSavePreset} disabled={!presetName.trim()} style={{
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
                    <button onClick={() => onLoadPreset(p)} style={{
                      background: 'none', border: 'none', color: '#d1d5db',
                      fontSize: '0.7rem', fontWeight: '600', cursor: 'pointer', textAlign: 'left', flex: 1, padding: 0,
                    }}>
                      {p.name}
                      <span style={{ color: '#6b7280', marginLeft: '0.3rem', fontSize: '0.6rem' }}>
                        {BUILDING_SHORT[p.building]} · {p.slots.length} players
                      </span>
                    </button>
                    <button onClick={() => onDeletePreset(p.id)} style={{
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

      {/* 📖 HOW TO USE (collapsible, initially expanded) */}
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
  );
};

export default RallyPlayersColumn;
