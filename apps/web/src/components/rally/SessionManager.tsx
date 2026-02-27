import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CARD, cardHeader, inputStyle, BUILDING_COLORS, getBuildingShort } from './types';
import type { BuildingKey } from './types';
import type { BattlePlannerSession, BattlePlannerLeader } from './useBattlePlannerSession';
import { FONT_DISPLAY } from '../../utils/styles';

interface SessionManagerProps {
  session: BattlePlannerSession | null;
  sessions: BattlePlannerSession[];
  leaders: BattlePlannerLeader[];
  inSession: boolean;
  isSessionLoading: boolean;
  isReadOnly: boolean;
  kingdomNumber: number | null;
  isMobile: boolean;
  selectedBuilding: BuildingKey;
  setSelectedBuilding: (b: BuildingKey) => void;
  buildingQueueCounts: Record<BuildingKey, { rally: number; counter: number }>;
  onCreateSession: (name: string, kingdomNumber: number) => Promise<BattlePlannerSession | null>;
  onArchiveSession: (id: string) => Promise<void>;
  onActivateSession: (id: string) => Promise<void>;
  onDeleteSession: (id: string) => Promise<void>;
  onMigrateLocalData: () => Promise<void>;
  localPlayerCount: number;
}

const BUILDINGS: BuildingKey[] = ['castle', 'turret1', 'turret2', 'turret3', 'turret4'];
const BUILDING_ICONS: Record<BuildingKey, string> = {
  castle: '🏰',
  turret1: '🗼',
  turret2: '🗼',
  turret3: '🗼',
  turret4: '🗼',
};

const SessionManager: React.FC<SessionManagerProps> = ({
  session, sessions, leaders,
  inSession, isSessionLoading, isReadOnly,
  kingdomNumber, isMobile,
  selectedBuilding, setSelectedBuilding,
  buildingQueueCounts,
  onCreateSession, onArchiveSession, onActivateSession, onDeleteSession,
  onMigrateLocalData, localPlayerCount,
}) => {
  const { t } = useTranslation();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [showSessionList, setShowSessionList] = useState(false);
  const [showMigratePrompt, setShowMigratePrompt] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim() || !kingdomNumber) return;
    const created = await onCreateSession(newName.trim(), kingdomNumber);
    if (created) {
      setNewName('');
      setShowCreate(false);
      // Check if migration is needed
      if (localPlayerCount > 0) {
        setShowMigratePrompt(true);
      }
    }
  };

  if (isSessionLoading) {
    return (
      <div style={{ ...CARD, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>Loading sessions...</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

      {/* Session Bar */}
      <div style={{
        ...CARD,
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center',
        gap: '0.5rem',
        padding: '0.5rem 0.75rem',
      }}>
        {inSession ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%',
                backgroundColor: isReadOnly ? '#6b7280' : '#22c55e',
                flexShrink: 0,
              }} />
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '0.8rem', fontWeight: '700', color: '#fff',
                  fontFamily: FONT_DISPLAY, letterSpacing: '0.03em',
                }}>
                  {session!.name}
                </div>
                <div style={{ fontSize: '0.6rem', color: '#6b7280' }}>
                  K{session!.kingdom_number} · {isReadOnly ? 'Archived' : 'Active'}
                  {leaders.length > 0 && ` · ${leaders.length} captain${leaders.length !== 1 ? 's' : ''}`}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
              <button
                onClick={() => setShowSessionList(!showSessionList)}
                style={{
                  padding: '0.25rem 0.5rem', minHeight: '28px',
                  backgroundColor: 'transparent', border: '1px solid #2a2a2a',
                  borderRadius: '5px', color: '#9ca3af', fontSize: '0.6rem',
                  fontWeight: '600', cursor: 'pointer',
                }}
              >
                {showSessionList ? 'Hide' : 'Sessions'}
              </button>
              {!isReadOnly && (
                <button
                  onClick={() => onArchiveSession(session!.id)}
                  style={{
                    padding: '0.25rem 0.5rem', minHeight: '28px',
                    backgroundColor: '#f59e0b08', border: '1px solid #f59e0b30',
                    borderRadius: '5px', color: '#f59e0b', fontSize: '0.6rem',
                    fontWeight: '600', cursor: 'pointer',
                  }}
                >
                  Archive
                </button>
              )}
            </div>
          </>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'stretch' : 'center',
            gap: '0.5rem', width: '100%',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#d1d5db', marginBottom: '0.15rem' }}>
                No active session
              </div>
              <div style={{ fontSize: '0.6rem', color: '#6b7280' }}>
                Create a session to enable collaborative planning with your kingdom
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.3rem' }}>
              <button
                onClick={() => setShowCreate(!showCreate)}
                style={{
                  padding: '0.3rem 0.75rem', minHeight: '32px',
                  backgroundColor: '#22c55e15', border: '1px solid #22c55e40',
                  borderRadius: '6px', color: '#22c55e', fontSize: '0.7rem',
                  fontWeight: '700', cursor: 'pointer',
                }}
              >
                + New Session
              </button>
              {sessions.length > 0 && (
                <button
                  onClick={() => setShowSessionList(!showSessionList)}
                  style={{
                    padding: '0.3rem 0.75rem', minHeight: '32px',
                    backgroundColor: 'transparent', border: '1px solid #2a2a2a',
                    borderRadius: '6px', color: '#9ca3af', fontSize: '0.7rem',
                    fontWeight: '600', cursor: 'pointer',
                  }}
                >
                  Past Sessions ({sessions.length})
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Session Form */}
      {showCreate && (
        <div style={{
          ...CARD, display: 'flex', flexDirection: 'column', gap: '0.5rem',
          border: '1px solid #22c55e30',
        }}>
          <h4 style={{ ...cardHeader('#22c55e'), margin: 0, fontSize: '0.75rem' }}>
            Create Battle Session
          </h4>
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder={`e.g. KvK ${kingdomNumber ? `K${kingdomNumber}` : ''} Castle Battle`}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
              style={{ ...inputStyle, fontSize: '0.8rem', flex: 1 }}
              autoFocus
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || !kingdomNumber}
              style={{
                padding: '0.4rem 1rem', minHeight: '44px',
                backgroundColor: newName.trim() && kingdomNumber ? '#22c55e' : '#22c55e40',
                border: 'none', borderRadius: '8px',
                color: '#000', fontSize: '0.8rem', fontWeight: '700',
                cursor: newName.trim() && kingdomNumber ? 'pointer' : 'not-allowed',
              }}
            >
              Create
            </button>
          </div>
          {!kingdomNumber && (
            <p style={{ color: '#f59e0b', fontSize: '0.65rem', margin: 0 }}>
              Link your Kingshot account first to create a session
            </p>
          )}
        </div>
      )}

      {/* Session List */}
      {showSessionList && sessions.length > 0 && (
        <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <h4 style={{ ...cardHeader(), margin: 0, fontSize: '0.75rem' }}>
            All Sessions
          </h4>
          {sessions.map(s => (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0.35rem 0.5rem', backgroundColor: s.id === session?.id ? '#ffffff08' : '#0a0a0a',
              border: `1px solid ${s.id === session?.id ? '#3b82f640' : '#1a1a1a'}`,
              borderRadius: '6px',
            }}>
              <div style={{ flex: 1 }}>
                <span style={{
                  fontSize: '0.7rem', fontWeight: '600',
                  color: s.id === session?.id ? '#3b82f6' : '#d1d5db',
                }}>
                  {s.name}
                </span>
                <span style={{
                  marginLeft: '0.4rem', fontSize: '0.55rem',
                  padding: '0.1rem 0.3rem', borderRadius: '3px',
                  backgroundColor: s.status === 'active' ? '#22c55e15' : '#6b728015',
                  color: s.status === 'active' ? '#22c55e' : '#6b7280',
                  fontWeight: '600',
                }}>
                  {s.status}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.2rem' }}>
                {s.id !== session?.id && s.status === 'active' && (
                  <button
                    onClick={() => { onActivateSession(s.id); setShowSessionList(false); }}
                    style={{
                      padding: '0.2rem 0.4rem', minHeight: '24px',
                      backgroundColor: '#3b82f615', border: '1px solid #3b82f630',
                      borderRadius: '4px', color: '#3b82f6', fontSize: '0.55rem',
                      fontWeight: '600', cursor: 'pointer',
                    }}
                  >
                    Switch
                  </button>
                )}
                {s.status === 'archived' && (
                  <button
                    onClick={() => { onActivateSession(s.id); setShowSessionList(false); }}
                    style={{
                      padding: '0.2rem 0.4rem', minHeight: '24px',
                      backgroundColor: '#22c55e15', border: '1px solid #22c55e30',
                      borderRadius: '4px', color: '#22c55e', fontSize: '0.55rem',
                      fontWeight: '600', cursor: 'pointer',
                    }}
                  >
                    Reactivate
                  </button>
                )}
                <button
                  onClick={() => onDeleteSession(s.id)}
                  style={{
                    padding: '0.2rem 0.4rem', minHeight: '24px',
                    backgroundColor: '#ef444408', border: '1px solid #ef444430',
                    borderRadius: '4px', color: '#ef4444', fontSize: '0.55rem',
                    fontWeight: '600', cursor: 'pointer',
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Migration Prompt */}
      {showMigratePrompt && inSession && localPlayerCount > 0 && (
        <div style={{
          ...CARD,
          border: '1px solid #3b82f640',
          backgroundColor: '#3b82f608',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '1.1rem' }}>📦</span>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#d1d5db' }}>
                Import existing players?
              </div>
              <div style={{ fontSize: '0.6rem', color: '#9ca3af' }}>
                Found {localPlayerCount} player(s) in local storage
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            <button
              onClick={async () => { await onMigrateLocalData(); setShowMigratePrompt(false); }}
              style={{
                flex: 1, padding: '0.3rem', minHeight: '32px',
                backgroundColor: '#3b82f6', border: 'none', borderRadius: '6px',
                color: '#fff', fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer',
              }}
            >
              Import Players
            </button>
            <button
              onClick={() => setShowMigratePrompt(false)}
              style={{
                padding: '0.3rem 0.75rem', minHeight: '32px',
                backgroundColor: 'transparent', border: '1px solid #2a2a2a',
                borderRadius: '6px', color: '#9ca3af', fontSize: '0.7rem',
                fontWeight: '600', cursor: 'pointer',
              }}
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Building Tabs (when in session) */}
      {inSession && (
        <div style={{
          display: 'flex', gap: '3px',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          msOverflowStyle: 'none',
          scrollbarWidth: 'none',
        }}>
          {BUILDINGS.map(b => {
            const isActive = selectedBuilding === b;
            const color = BUILDING_COLORS[b];
            const counts = buildingQueueCounts[b];
            const totalPlayers = (counts?.rally ?? 0) + (counts?.counter ?? 0);
            return (
              <button
                key={b}
                onClick={() => setSelectedBuilding(b)}
                style={{
                  flex: isMobile ? 1 : 'none',
                  minWidth: isMobile ? 0 : '80px',
                  padding: isMobile ? '0.35rem 0.2rem' : '0.35rem 0.6rem',
                  backgroundColor: isActive ? `${color}18` : '#0a0a0a',
                  border: `1px solid ${isActive ? `${color}60` : '#1a1a1a'}`,
                  borderBottom: isActive ? `3px solid ${color}` : '1px solid #1a1a1a',
                  borderRadius: '8px 8px 0 0',
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: isMobile ? '0.85rem' : '0.9rem' }} aria-hidden="true">
                  {BUILDING_ICONS[b]}
                </span>
                <span style={{
                  fontSize: '0.6rem', fontWeight: '700', color: isActive ? color : '#6b7280',
                  letterSpacing: '0.03em',
                }}>
                  {getBuildingShort(b, t)}
                </span>
                {totalPlayers > 0 && (
                  <span style={{
                    fontSize: '0.5rem', fontWeight: '700',
                    padding: '0 0.25rem', borderRadius: '8px',
                    backgroundColor: `${color}25`, color: color,
                    lineHeight: '1.3',
                  }}>
                    {counts.rally > 0 ? `⚔${counts.rally}` : ''}
                    {counts.rally > 0 && counts.counter > 0 ? ' ' : ''}
                    {counts.counter > 0 ? `🛡${counts.counter}` : ''}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SessionManager;
