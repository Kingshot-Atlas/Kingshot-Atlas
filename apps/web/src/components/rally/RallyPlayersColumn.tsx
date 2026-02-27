import React from 'react';
import { useTranslation } from 'react-i18next';
import type { BuildingKey, MarchType, RallyPlayer, RallyPreset, RallySlot } from './types';
import {
  ALLY_COLOR, ENEMY_COLOR,
  CARD, cardHeader, inputStyle,
  getBuildingShort,
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
  onExportPlayers: () => void;
  onImportPlayers: (jsonStr: string) => void;
  onDuplicatePlayer: (id: string) => void;
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
  onExportPlayers, onImportPlayers, onDuplicatePlayer,
}) => {
  const { t } = useTranslation();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

      {/* Rally Captains */}
      <div role="region" aria-label="Rally captains" style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={cardHeader()}>👥 {t('rallyCoordinator.rallyCaptains', 'RALLY CAPTAINS')}</h3>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={onAddAlly} className="rally-focusable" aria-label="Add an ally rally captain" style={{
              padding: isMobile ? '0.4rem 0.6rem' : '0.3rem 0.5rem', minHeight: isMobile ? '44px' : '32px',
              backgroundColor: `${ALLY_COLOR}15`,
              border: `1px solid ${ALLY_COLOR}30`, borderRadius: '5px',
              color: ALLY_COLOR, fontSize: '0.65rem', fontWeight: '700', cursor: 'pointer',
            }}>
              {t('rallyCoordinator.addAlly')}
            </button>
            <button onClick={onAddEnemy} className="rally-focusable" aria-label="Add an enemy rally captain" style={{
              padding: isMobile ? '0.4rem 0.6rem' : '0.3rem 0.5rem', minHeight: isMobile ? '44px' : '32px',
              backgroundColor: `${ENEMY_COLOR}15`,
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
              {mt === 'buffed' ? `⚡ ${t('rallyCoordinator.buffed')}` : `🏃 ${t('rallyCoordinator.regular')}`}
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
                  onDuplicate={() => onDuplicatePlayer(p.id)}
                  isMobile={isMobile}
                  hasActiveBuffTimer={!!buffTimers[p.id]}
                />
              ))}
            </div>
          </div>
        )}

        {enemies.length > 0 && allies.length > 0 && (
          <div style={{ height: '1px', background: `linear-gradient(90deg, transparent, #4b556340, transparent)`, margin: '0.15rem 0' }} />
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
                  onDuplicate={() => onDuplicatePlayer(p.id)}
                  isMobile={isMobile}
                  hasActiveBuffTimer={!!buffTimers[p.id]}
                />
              ))}
            </div>
          </div>
        )}

        {players.length === 0 && (
          <div style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>
            <p style={{ color: '#d1d5db', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.4rem' }}>
              {t('rallyCoordinator.emptyPlayersTitle', 'No rally captains yet')}
            </p>
            <p style={{ color: '#9ca3af', fontSize: '0.65rem', lineHeight: 1.5, marginBottom: '0.5rem' }}>
              {t('rallyCoordinator.emptyPlayersGuide', 'Start by adding allies and enemies with their march times. Then drag them into the Rally or Counter queue.')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.6rem', color: '#9ca3af' }}>
              <span>1️⃣ {t('rallyCoordinator.emptyStep1', 'Click + Add Ally or + Add Enemy above')}</span>
              <span>2️⃣ {t('rallyCoordinator.emptyStep2', 'Enter player name and march times')}</span>
              <span>3️⃣ {t('rallyCoordinator.emptyStep3', 'Drag players to Rally or Counter queue')}</span>
            </div>
          </div>
        )}

        {players.length > 0 && (
          <>
            <p style={{ color: '#9ca3af', fontSize: '0.65rem' }}>
              {isMobile ? t('rallyCoordinator.playersHintMobile') : t('rallyCoordinator.playersHintDesktop')}
            </p>
            {isMobile && (
              <p style={{ color: '#6b7280', fontSize: '0.6rem', fontStyle: 'italic' }}>
                {t('battlePlanner.longPressHint', 'Long-press a player to edit or remove')}
              </p>
            )}
          </>
        )}

        {/* Export/Import */}
        {players.length > 0 && (
          <div style={{ display: 'flex', gap: '0.3rem', borderTop: '1px solid #1a1a1a', paddingTop: '0.4rem' }}>
            <button onClick={onExportPlayers} className="rally-focusable" aria-label="Export players as JSON file" style={{
              flex: 1, padding: '0.3rem', minHeight: '36px', backgroundColor: 'transparent',
              border: '1px solid #2a2a2a', borderRadius: '6px',
              color: '#d1d5db', fontSize: '0.65rem', fontWeight: '600', cursor: 'pointer',
            }}>
              📤 {t('rallyCoordinator.exportPlayers', 'Export')}
            </button>
            <label style={{
              flex: 1, padding: '0.3rem', minHeight: '36px', backgroundColor: 'transparent',
              border: '1px solid #2a2a2a', borderRadius: '6px',
              color: '#d1d5db', fontSize: '0.65rem', fontWeight: '600', cursor: 'pointer',
              textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              📥 {t('rallyCoordinator.importPlayers', 'Import')}
              <input
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    if (typeof reader.result === 'string') onImportPlayers(reader.result);
                  };
                  reader.readAsText(file);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        )}
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
              {(rallyQueue.length >= 2 || allies.length > 0 || enemies.length > 0) && (
                <button onClick={() => setShowPresetSave(!showPresetSave)} className="rally-focusable" aria-label="Save current configuration as preset" style={{
                  padding: '0.25rem 0.45rem', minHeight: '32px',
                  backgroundColor: '#22c55e15',
                  border: '1px solid #22c55e30', borderRadius: '4px',
                  color: '#22c55e', fontSize: '0.6rem', fontWeight: '700', cursor: 'pointer',
                }}>
                  {t('rallyCoordinator.saveCurrent', '+ Save Current')}
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
                  {t('rallyCoordinator.saveBtn', 'Save')}
                </button>
              </div>
            )}
            {presets.length === 0 ? (
              <p style={{ color: '#9ca3af', fontSize: '0.65rem', textAlign: 'center', padding: '1rem 0' }}>
                {t('rallyCoordinator.noPresetsYet', 'No presets yet. Build a rally and save it here for instant recall.')}
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
                        {getBuildingShort(p.building, t)} · {p.slots.length} players
                      </span>
                    </button>
                    <button onClick={() => onDeletePreset(p.id)} className="rally-focusable" aria-label={`Delete preset ${p.name}`} style={{
                      background: 'none', border: 'none', color: '#9ca3af',
                      fontSize: '0.7rem', cursor: 'pointer', padding: '0.2rem 0.4rem',
                      minWidth: '28px', minHeight: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
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
              { num: '1', text: t('rallyCoordinator.howToStep1'), color: '#3b82f6' },
              { num: '2', text: t('rallyCoordinator.howToStep2'), color: '#22c55e' },
              { num: '3', text: t('rallyCoordinator.howToStep3'), color: '#f59e0b' },
              { num: '4', text: t('rallyCoordinator.howToStep4'), color: '#a855f7' },
              { num: '5', text: t('rallyCoordinator.howToStep5'), color: '#ef4444' },
              { num: '6', text: t('rallyCoordinator.howToStep6'), color: '#22d3ee' },
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
