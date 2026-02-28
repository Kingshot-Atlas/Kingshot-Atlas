import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { FONT_DISPLAY } from '../../utils/styles';
import { CARD, inputStyle, BUILDING_COLORS, getBuildingShort } from './types';
import type { BuildingKey } from './types';
import type { BattlePlannerLeader } from './useBattlePlannerSession';

interface BattleLeadersPanelProps {
  leaders: BattlePlannerLeader[];
  sessionId: string | null;
  isReadOnly: boolean;
  isSessionEditor: boolean;
  isMobile: boolean;
  selectedBuilding: BuildingKey;
  onAddLeader: (userId: string, building?: BuildingKey | null) => Promise<void>;
  onUpdateLeaderAssignment: (leaderId: string, building: BuildingKey | null) => Promise<void>;
  onRemoveLeader: (leaderId: string) => Promise<void>;
}

interface KingdomUser {
  id: string;
  username: string;
  avatar_url: string | null;
  linked_username: string | null;
  linked_avatar_url: string | null;
}

const BUILDINGS: BuildingKey[] = ['castle', 'turret1', 'turret2', 'turret3', 'turret4'];

const BUILDING_ICONS: Record<BuildingKey, string> = {
  castle: '🏰',
  turret1: '🗼',
  turret2: '🗼',
  turret3: '🗼',
  turret4: '🗼',
};

const BattleLeadersPanel: React.FC<BattleLeadersPanelProps> = ({
  leaders, sessionId, isReadOnly, isSessionEditor, isMobile,
  selectedBuilding,
  onAddLeader, onUpdateLeaderAssignment, onRemoveLeader,
}) => {
  // Only session creator + existing leaders can manage leaders
  const canManageLeaders = isSessionEditor && !isReadOnly;
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<KingdomUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Search kingdom members to add as leaders
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2 || !supabase) {
      setSearchResults([]);
      return;
    }

    const sb = supabase;
    const timeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        // Sanitize search input: strip PostgREST filter metacharacters
        const sanitized = searchQuery.trim().replace(/[%_.*(),"\\]/g, '');
        if (!sanitized) { setSearchResults([]); setIsSearching(false); return; }
        const { data } = await sb
          .from('profiles')
          .select('id, username, avatar_url, linked_username, linked_avatar_url')
          .or(`username.ilike.%${sanitized}%,linked_username.ilike.%${sanitized}%`)
          .limit(8);

        setSearchResults((data ?? []).slice(0, 5));
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery, leaders]);

  if (!sessionId) return null;

  const leadersByBuilding = BUILDINGS.reduce<Record<BuildingKey, BattlePlannerLeader[]>>((acc, b) => {
    acc[b] = leaders.filter(l => l.building_assignment === b);
    return acc;
  }, { castle: [], turret1: [], turret2: [], turret3: [], turret4: [] });

  const unassigned = leaders.filter(l => !l.building_assignment);
  const currentBuildingLeader = leadersByBuilding[selectedBuilding]?.[0] ?? null;

  const getDisplayName = (leader: BattlePlannerLeader) =>
    leader.linked_username || leader.username || 'Unknown';

  const getAvatarUrl = (leader: BattlePlannerLeader) =>
    leader.linked_avatar_url || leader.avatar_url || null;

  return (
    <div style={{
      ...CARD,
      border: `1px solid ${expanded ? '#3b82f630' : '#2a2a2a'}`,
      transition: 'border-color 0.15s',
    }}>
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: 0, backgroundColor: 'transparent', border: 'none',
          cursor: 'pointer', color: '#fff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.85rem' }}>🎖️</span>
          <span style={{
            fontSize: '0.8rem', fontWeight: '700', fontFamily: FONT_DISPLAY,
            letterSpacing: '0.05em', color: '#d1d5db',
          }}>
            {t('battlePlanner.battleCaptains', 'BATTLE CAPTAINS')}
          </span>
          {leaders.length > 0 && (
            <span style={{
              fontSize: '0.55rem', fontWeight: '700',
              padding: '0.1rem 0.35rem', borderRadius: '8px',
              backgroundColor: '#3b82f618', color: '#3b82f6',
            }}>
              {leaders.length}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          {/* Mini building assignment indicators */}
          {!expanded && (
            <div style={{ display: 'flex', gap: '2px' }}>
              {BUILDINGS.map(b => {
                const hasLeader = leadersByBuilding[b].length > 0;
                const color = BUILDING_COLORS[b];
                return (
                  <span
                    key={b}
                    style={{
                      width: '6px', height: '6px', borderRadius: '50%',
                      backgroundColor: hasLeader ? color : '#2a2a2a',
                      transition: 'background-color 0.15s',
                    }}
                  />
                );
              })}
            </div>
          )}
          <span style={{
            fontSize: '0.7rem', color: '#6b7280',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s',
          }}>
            ▼
          </span>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

          {/* Current building leader highlight */}
          <div style={{
            padding: '0.4rem 0.5rem',
            backgroundColor: `${BUILDING_COLORS[selectedBuilding]}08`,
            border: `1px solid ${BUILDING_COLORS[selectedBuilding]}25`,
            borderRadius: '8px',
          }}>
            <div style={{
              fontSize: '0.6rem', fontWeight: '700', color: BUILDING_COLORS[selectedBuilding],
              letterSpacing: '0.05em', marginBottom: '0.25rem',
            }}>
              {BUILDING_ICONS[selectedBuilding]} {t('battlePlanner.buildingCaptain', '{{building}} CAPTAIN', { building: t(`building.${selectedBuilding}`, selectedBuilding.toUpperCase()) })}
            </div>
            {currentBuildingLeader ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  {getAvatarUrl(currentBuildingLeader) ? (
                    <img
                      src={getAvatarUrl(currentBuildingLeader)!}
                      alt=""
                      referrerPolicy="no-referrer"
                      style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{
                      width: '22px', height: '22px', borderRadius: '50%',
                      backgroundColor: '#2a2a2a', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: '0.6rem', color: '#6b7280',
                    }}>
                      ?
                    </div>
                  )}
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#fff' }}>
                    {getDisplayName(currentBuildingLeader)}
                  </span>
                </div>
                {canManageLeaders && (
                  <button
                    onClick={() => onUpdateLeaderAssignment(currentBuildingLeader.id, null)}
                    style={{
                      padding: '0.15rem 0.35rem', minHeight: isMobile ? '36px' : '24px',
                      backgroundColor: 'transparent', border: '1px solid #2a2a2a',
                      borderRadius: '4px', color: '#6b7280', fontSize: '0.55rem',
                      fontWeight: '600', cursor: 'pointer',
                    }}
                  >
                    {t('battlePlanner.unassign', 'Unassign')}
                  </button>
                )}
              </div>
            ) : (
              <span style={{ fontSize: '0.65rem', color: '#6b7280', fontStyle: 'italic' }}>
                {t('battlePlanner.noCaptainAssigned', 'No captain assigned')}
              </span>
            )}
          </div>

          {/* All buildings overview */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(5, 1fr)',
            gap: '4px',
          }}>
            {BUILDINGS.map(b => {
              const bLeaders = leadersByBuilding[b];
              const color = BUILDING_COLORS[b];
              const isSelected = selectedBuilding === b;
              return (
                <div
                  key={b}
                  style={{
                    padding: '0.3rem',
                    backgroundColor: isSelected ? `${color}10` : '#0a0a0a',
                    border: `1px solid ${isSelected ? `${color}40` : '#1a1a1a'}`,
                    borderRadius: '6px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '0.55rem', fontWeight: '700', color, marginBottom: '0.15rem' }}>
                    {BUILDING_ICONS[b]} {getBuildingShort(b, t)}
                  </div>
                  {bLeaders.length > 0 ? (
                    bLeaders.map(l => (
                      <div key={l.id} style={{
                        fontSize: '0.55rem', color: '#d1d5db', fontWeight: '500',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {getDisplayName(l)}
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: '0.5rem', color: '#374151' }}>—</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Unassigned leaders */}
          {unassigned.length > 0 && (
            <div>
              <div style={{
                fontSize: '0.6rem', fontWeight: '600', color: '#6b7280',
                marginBottom: '0.25rem', letterSpacing: '0.03em',
              }}>
                {t('battlePlanner.unassigned', 'UNASSIGNED')} ({unassigned.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {unassigned.map(l => (
                  <div key={l.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.25rem',
                    padding: '0.2rem 0.4rem', backgroundColor: '#0a0a0a',
                    border: '1px solid #1a1a1a', borderRadius: '6px',
                  }}>
                    {getAvatarUrl(l) ? (
                      <img
                        src={getAvatarUrl(l)!}
                        alt=""
                        referrerPolicy="no-referrer"
                        style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{
                        width: '16px', height: '16px', borderRadius: '50%',
                        backgroundColor: '#2a2a2a', fontSize: '0.5rem', color: '#6b7280',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>?</div>
                    )}
                    <span style={{ fontSize: '0.6rem', color: '#d1d5db', fontWeight: '500' }}>
                      {getDisplayName(l)}
                    </span>
                    {canManageLeaders && (
                      <>
                        <select
                          onChange={e => {
                            if (e.target.value) onUpdateLeaderAssignment(l.id, e.target.value as BuildingKey);
                          }}
                          value=""
                          style={{
                            padding: '0.1rem', backgroundColor: '#1a1a1a',
                            border: '1px solid #2a2a2a', borderRadius: '4px',
                            color: '#9ca3af', fontSize: '0.5rem', cursor: 'pointer',
                            minHeight: isMobile ? '36px' : '20px',
                          }}
                        >
                          <option value="">Assign...</option>
                          {BUILDINGS.map(b => (
                            <option key={b} value={b}>{getBuildingShort(b, t)}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => onRemoveLeader(l.id)}
                          style={{
                            padding: '0 0.4rem', minHeight: isMobile ? '36px' : '20px',
                            backgroundColor: 'transparent', border: 'none',
                            color: '#ef4444', fontSize: '0.6rem', cursor: 'pointer',
                          }}
                          title={t('battlePlanner.removeCaptain', 'Remove captain')}
                        >
                          ×
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add leader search — only editors + co-editors */}
          {canManageLeaders && (
            <div>
              {showSearch ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    <input
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder={t('battlePlanner.searchByUsername', 'Search by username...')}
                      style={{ ...inputStyle, fontSize: '0.75rem', flex: 1, minHeight: '36px' }}
                      autoFocus
                    />
                    <button
                      onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }}
                      style={{
                        padding: '0.25rem 0.5rem', minHeight: '36px',
                        backgroundColor: 'transparent', border: '1px solid #2a2a2a',
                        borderRadius: '8px', color: '#6b7280', fontSize: '0.65rem',
                        cursor: 'pointer',
                      }}
                    >
                      {t('battlePlanner.cancel', 'Cancel')}
                    </button>
                  </div>

                  {isSearching && (
                    <span style={{ fontSize: '0.6rem', color: '#6b7280' }}>{t('battlePlanner.searching', 'Searching...')}</span>
                  )}

                  {searchResults.length > 0 && (
                    <div style={{
                      display: 'flex', flexDirection: 'column', gap: '2px',
                      maxHeight: '180px', overflowY: 'auto',
                    }}>
                      {searchResults.map(u => (
                        <button
                          key={u.id}
                          onClick={async () => {
                            await onAddLeader(u.id, selectedBuilding);
                            setSearchQuery('');
                            setSearchResults([]);
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.35rem',
                            padding: '0.3rem 0.4rem', backgroundColor: '#0a0a0a',
                            border: '1px solid #1a1a1a', borderRadius: '6px',
                            cursor: 'pointer', color: '#d1d5db', minHeight: '36px',
                            width: '100%', textAlign: 'left',
                          }}
                        >
                          {(u.linked_avatar_url || u.avatar_url) ? (
                            <img
                              src={(u.linked_avatar_url || u.avatar_url)!}
                              alt=""
                              referrerPolicy="no-referrer"
                              style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }}
                            />
                          ) : (
                            <div style={{
                              width: '20px', height: '20px', borderRadius: '50%',
                              backgroundColor: '#2a2a2a', fontSize: '0.5rem', color: '#6b7280',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>?</div>
                          )}
                          <div>
                            <div style={{ fontSize: '0.7rem', fontWeight: '600' }}>
                              {u.linked_username || u.username}
                            </div>
                            {u.linked_username && u.username && u.linked_username !== u.username && (
                              <div style={{ fontSize: '0.5rem', color: '#6b7280' }}>
                                @{u.username}
                              </div>
                            )}
                          </div>
                          <span style={{
                            marginLeft: 'auto', fontSize: '0.5rem', color: BUILDING_COLORS[selectedBuilding],
                            fontWeight: '600',
                          }}>
                            → {getBuildingShort(selectedBuilding, t)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
                    <span style={{ fontSize: '0.6rem', color: '#6b7280' }}>
                      {t('battlePlanner.noMatchingUsers', 'No matching users found')}
                    </span>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setShowSearch(true)}
                  style={{
                    width: '100%', padding: '0.3rem', minHeight: '32px',
                    backgroundColor: 'transparent', border: '1px dashed #2a2a2a',
                    borderRadius: '6px', color: '#6b7280', fontSize: '0.65rem',
                    fontWeight: '600', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
                  }}
                >
                  {t('battlePlanner.addBattleCaptain', '+ Add Battle Captain')}
                </button>
              )}
            </div>
          )}

          {/* Empty state */}
          {leaders.length === 0 && !showSearch && (
            <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
              <p style={{ color: '#6b7280', fontSize: '0.65rem', margin: 0 }}>
                {canManageLeaders
                  ? t('battlePlanner.emptyCaptainsEditor', 'No battle captains assigned yet. Add captains to coordinate your rally efforts across buildings.')
                  : t('battlePlanner.emptyCaptainsViewer', 'No battle captains assigned yet. The session editor can add captains.')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BattleLeadersPanel;
