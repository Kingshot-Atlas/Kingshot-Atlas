import React, { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import BackLink from '../components/shared/BackLink';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useMetaTags } from '../hooks/useMetaTags';
import { useStructuredData, PAGE_BREADCRUMBS } from '../hooks/useStructuredData';
import { FONT_DISPLAY } from '../utils/styles';
import { useTranslation } from 'react-i18next';
import { useBattleTierList, emptyForm } from '../hooks/useBattleTierList';
import BattleBulkEdit from '../components/battle-tier/BattleBulkEdit';
import BattleBulkInput from '../components/battle-tier/BattleBulkInput';
import BattleTierCutoffEditor from '../components/battle-tier/BattleTierCutoffEditor';
import {
  getHeroesByTroopType,
  EG_BONUS_BY_LEVEL,
  BATTLE_TIER_COLORS,
  TROOP_COLORS,
  getPlayerOffensiveDisplayStats,
  getPlayerDefensiveDisplayStats,
  type BattlePlayerEntry,
  type BattleTier,
  type TroopType,
  isTroopWeightsDefault,
  STAT_LABELS,
} from '../data/battleTierData';

const ACCENT = '#f97316';

// ─── Stat Input Row ─────────────────────────────────────────────────────────

const StatInputRow: React.FC<{
  troopType: TroopType;
  label: string;
  form: Record<string, string | number>;
  updateForm: (field: string, value: string | number) => void;
  isMobile: boolean;
  t: (key: string, fallback: string) => string;
}> = ({ troopType, label, form, updateForm, isMobile, t }) => {
  const prefix = troopType;
  const heroes = getHeroesByTroopType(troopType);
  const color = TROOP_COLORS[troopType];
  const heroKey = `${prefix}Hero` as string;
  const egKey = `${prefix}EGLevel` as string;

  const numInput: React.CSSProperties = {
    width: '100%', padding: '0.4rem 0.5rem',
    backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a',
    borderRadius: '6px', color: '#fff', fontSize: '0.8rem',
    outline: 'none', minWidth: 0, boxSizing: 'border-box',
  };
  const selectStyle: React.CSSProperties = {
    ...numInput, cursor: 'pointer',
    appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.4rem center',
    paddingRight: '1.4rem',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '0.65rem', fontWeight: 700, color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.2rem',
  };

  return (
    <div style={{
      backgroundColor: '#0d0d0d', borderRadius: '10px', border: `1px solid ${color}20`,
      padding: isMobile ? '0.75rem' : '1rem', marginBottom: '0.75rem',
    }}>
      <div style={{
        fontSize: '0.75rem', fontWeight: 700, color, marginBottom: '0.5rem',
        display: 'flex', alignItems: 'center', gap: '0.3rem',
      }}>
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color }} />
        {label}
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr auto',
        gap: '0.5rem', marginBottom: '0.5rem',
      }}>
        <div>
          <div style={labelStyle}>{t('battleTier.hero', 'Hero')}</div>
          <select
            value={form[heroKey] as string || ''}
            onChange={(e) => updateForm(heroKey, e.target.value)}
            style={selectStyle}
          >
            <option value="">{t('battleTier.selectHero', 'Select Hero')}</option>
            {heroes.map(h => (
              <option key={h.name} value={h.name}>
                {h.name} ({h.egDirection === 'offensive' ? '⚔️' : '🛡️'} {h.egStat})
              </option>
            ))}
          </select>
        </div>
        <div>
          <div style={labelStyle}>{t('battleTier.egLevel', 'EG Level')}</div>
          <select
            value={form[egKey] as number ?? -1}
            onChange={(e) => updateForm(egKey, parseInt(e.target.value))}
            style={selectStyle}
          >
            <option value={-1}>{t('battleTier.selectEG', 'EG Lvl')}</option>
            {Array.from({ length: 11 }, (_, i) => (
              <option key={i} value={i}>
                Lv.{i} {(EG_BONUS_BY_LEVEL[i] ?? 0) > 0 ? `(+${((EG_BONUS_BY_LEVEL[i] ?? 0) * 100).toFixed(1)}%)` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '0.35rem',
      }}>
        {(['Attack', 'Lethality', 'Defense', 'Health'] as const).map(stat => {
          const key = `${prefix}${stat}` as string;
          return (
            <div key={stat}>
              <div style={labelStyle}>{stat.slice(0, 3)}</div>
              <input
                type="number"
                step="0.1"
                min="0"
                placeholder="0"
                value={form[key] as string || ''}
                onChange={(e) => updateForm(key, e.target.value)}
                style={numInput}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Tier Badge ─────────────────────────────────────────────────────────────

const TierBadge: React.FC<{ tier: BattleTier; size?: 'sm' | 'md' }> = ({ tier, size = 'md' }) => {
  const color = BATTLE_TIER_COLORS[tier];
  const px = size === 'sm' ? '0.35rem 0.5rem' : '0.3rem 0.6rem';
  const fs = size === 'sm' ? '0.65rem' : '0.75rem';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: px, backgroundColor: `${color}20`, border: `1px solid ${color}50`,
      borderRadius: '6px', color, fontWeight: 800, fontSize: fs,
      minWidth: size === 'sm' ? '28px' : '32px', textAlign: 'center',
    }}>
      {tier}
    </span>
  );
};

// ─── Player Row (Tier Table) ────────────────────────────────────────────────

const PlayerRow: React.FC<{
  player: BattlePlayerEntry & { rank: number };
  mode: 'offense' | 'defense';
  canEdit: boolean;
  isMobile: boolean;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  deleteConfirm: boolean;
  onCancelDelete: () => void;
}> = ({ player, mode, canEdit, isMobile, expanded, onToggle, onEdit, onDelete, deleteConfirm, onCancelDelete }) => {
  const tier = mode === 'offense' ? player.offenseTier : player.defenseTier;
  const score = mode === 'offense' ? player.offenseScore : player.defenseScore;
  const color = BATTLE_TIER_COLORS[tier];
  const stats = mode === 'offense'
    ? getPlayerOffensiveDisplayStats(player)
    : getPlayerDefensiveDisplayStats(player);

  return (
    <div style={{
      backgroundColor: '#111', borderRadius: '10px', border: `1px solid #1a1a1a`,
      marginBottom: '0.5rem', overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      {/* Summary Row */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '0.75rem',
          padding: isMobile ? '0.6rem 0.75rem' : '0.65rem 1rem',
          cursor: 'pointer',
        }}
      >
        <span style={{
          fontSize: '0.7rem', fontWeight: 700, color: '#6b7280',
          minWidth: '24px', textAlign: 'center',
        }}>
          #{player.rank}
        </span>
        <TierBadge tier={tier} size="sm" />
        <span style={{
          flex: 1, fontSize: isMobile ? '0.82rem' : '0.88rem',
          fontWeight: 600, color: '#fff',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {player.playerName}
        </span>
        <span style={{ fontSize: isMobile ? '0.8rem' : '0.85rem', fontWeight: 700, color }}>
          {score.toFixed(1)}
        </span>
        <span style={{
          fontSize: '0.65rem', color: '#6b7280',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
        }}>▼</span>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div style={{
          padding: isMobile ? '0 0.75rem 0.75rem' : '0 1rem 1rem',
          borderTop: '1px solid #1a1a1a',
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '0.5rem', marginTop: '0.75rem',
          }}>
            {(['infantry', 'cavalry', 'archer'] as const).map(troop => {
              const troopStats = stats[troop];
              const tc = TROOP_COLORS[troop];
              return (
                <div key={troop} style={{
                  backgroundColor: '#0d0d0d', borderRadius: '8px',
                  padding: '0.5rem', border: `1px solid ${tc}15`,
                }}>
                  <div style={{
                    fontSize: '0.6rem', fontWeight: 700, color: tc,
                    textTransform: 'uppercase', marginBottom: '0.3rem',
                    display: 'flex', alignItems: 'center', gap: '0.2rem',
                  }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: tc }} />
                    {troop.slice(0, 3)}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#9ca3af', lineHeight: 1.8 }}>
                    <div>ATK <span style={{ color: '#fff', fontWeight: 600 }}>{troopStats.attack.toFixed(1)}%</span></div>
                    <div>LTH <span style={{ color: '#fff', fontWeight: 600 }}>{troopStats.lethality.toFixed(1)}%</span></div>
                    <div>DEF <span style={{ color: '#fff', fontWeight: 600 }}>{troopStats.defense.toFixed(1)}%</span></div>
                    <div>HP <span style={{ color: '#fff', fontWeight: 600 }}>{troopStats.health.toFixed(1)}%</span></div>
                  </div>
                  <div style={{
                    fontSize: '0.55rem', color: '#6b7280', marginTop: '0.25rem',
                    borderTop: '1px solid #1a1a1a', paddingTop: '0.25rem',
                  }}>
                    {player[`${troop}Hero` as keyof BattlePlayerEntry] as string || '—'} (EG{player[`${troop}EGLevel` as keyof BattlePlayerEntry] as number})
                  </div>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          {canEdit && (
            <div style={{
              display: 'flex', gap: '0.5rem', marginTop: '0.75rem',
              justifyContent: 'flex-end',
            }}>
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                style={{
                  padding: '0.3rem 0.75rem', backgroundColor: '#1a1a1a',
                  border: '1px solid #333', borderRadius: '6px',
                  color: '#d1d5db', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                ✏️ Edit
              </button>
              {deleteConfirm ? (
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    style={{
                      padding: '0.3rem 0.75rem', backgroundColor: '#ef444420',
                      border: '1px solid #ef444450', borderRadius: '6px',
                      color: '#ef4444', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Confirm
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onCancelDelete(); }}
                    style={{
                      padding: '0.3rem 0.5rem', background: 'none', border: 'none',
                      color: '#6b7280', fontSize: '0.7rem', cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  style={{
                    padding: '0.3rem 0.75rem', backgroundColor: '#1a1a1a',
                    border: '1px solid #333', borderRadius: '6px',
                    color: '#ef4444', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  🗑️ Delete
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────

const KvKBattleTierList: React.FC = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  useDocumentTitle(t('battleTier.pageTitle', 'KvK Battle Tier List — Kingshot Atlas'));
  useMetaTags({
    title: t('battleTier.pageTitle', 'KvK Battle Tier List — Kingshot Atlas'),
    description: t('battleTier.metaDesc', 'Rank your kingdom\'s players by offensive and defensive power for KvK Castle Battles.'),
  });
  useStructuredData({
    type: 'BreadcrumbList',
    data: [
      ...(PAGE_BREADCRUMBS.tools || []),
      { name: 'KvK Battle Tier List', url: 'https://ks-atlas.com/tools/battle-tier-list' },
    ],
  });

  const state = useBattleTierList();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const rankedPlayers = state.activeSection === 'offense' ? state.offenseRanked : state.defenseRanked;

  // ── Close suggestions on outside click ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (state.suggestionsRef.current && !state.suggestionsRef.current.contains(e.target as Node) &&
          state.nameInputRef.current && !state.nameInputRef.current.contains(e.target as Node)) {
        state.setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [state]);

  // ── Active mode helpers ──
  const activePlayers = state.activeSection === 'offense' ? state.players : state.defensePlayers;
  const activeIncomplete = state.activeSection === 'offense' ? state.offenseIncomplete : state.defenseIncomplete;

  // ── Bulk Edit handler ──
  const handleBulkEdit = useCallback((updatedPlayers: BattlePlayerEntry[]) => {
    if (state.activeSection === 'offense') {
      state.pushUndo('offense', state.players);
      state.setPlayers(updatedPlayers);
    } else {
      state.pushUndo('defense', state.defensePlayers);
      state.setDefensePlayers(updatedPlayers);
    }
    state.setShowBulkEdit(false);
  }, [state]);

  // ── Bulk Add handler ──
  const handleBulkAdd = useCallback((allPlayers: BattlePlayerEntry[]) => {
    if (state.activeSection === 'offense') {
      state.pushUndo('offense', state.players);
      state.setPlayers(allPlayers);
    } else {
      state.pushUndo('defense', state.defensePlayers);
      state.setDefensePlayers(allPlayers);
    }
    state.setShowBulkInput(false);
  }, [state]);

  // Access gate
  if (!state.hasAccess && !state.loading) {
    return (
      <div style={{
        minHeight: '100vh', backgroundColor: '#0a0a0a', color: '#e5e7eb',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '2rem', textAlign: 'center',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          {t('battleTier.goldRequired', 'Gold Tier Required')}
        </h2>
        <p style={{ color: '#6b7280', maxWidth: '400px', marginBottom: '1.5rem', lineHeight: 1.6 }}>
          {t('battleTier.goldRequiredDesc', 'The KvK Battle Tier List is available to Gold Tier Kingdom Fund kingdoms. Link your Kingshot account and contribute to your kingdom\'s fund to unlock this tool.')}
        </p>
        <Link to="/tools/battle-tier-list/about" style={{
          padding: '0.6rem 1.5rem', backgroundColor: ACCENT,
          border: 'none', borderRadius: '8px',
          color: '#fff', fontWeight: 700, textDecoration: 'none',
        }}>
          {t('battleTier.learnMore', 'Learn More')}
        </Link>
      </div>
    );
  }

  if (state.loading) {
    return (
      <div style={{
        minHeight: '100vh', backgroundColor: '#0a0a0a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div className="loading-spinner-sm" />
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: '#0a0a0a', color: '#e5e7eb',
      padding: isMobile ? '1rem 0.5rem 4rem' : '2rem 1.5rem 4rem',
    }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: isMobile ? '1.5rem' : '2rem' }}>
          <h1 style={{
            fontSize: isMobile ? '1.6rem' : '2.2rem', fontWeight: 800,
            fontFamily: FONT_DISPLAY, marginBottom: '0.5rem', letterSpacing: '0.02em',
          }}>
            <span style={{ color: '#fff' }}>{t('battleTier.title1', 'KvK BATTLE')}</span>{' '}
            <span style={{ color: ACCENT }}>{t('battleTier.title2', 'TIER LIST')}</span>
          </h1>
          <p style={{
            fontSize: isMobile ? '0.75rem' : '0.85rem', color: '#6b7280',
            maxWidth: '600px', margin: '0 auto', lineHeight: 1.5,
          }}>
            {t('battleTier.subtitle', 'Rank your kingdom\'s players by combat power. Offense for rallies, Defense for garrisons.')}
          </p>
          {state.kingdomNumber && (
            <div style={{ marginTop: '0.5rem' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                padding: '0.25rem 0.6rem', backgroundColor: `${ACCENT}15`,
                border: `1px solid ${ACCENT}25`, borderRadius: '6px',
                fontSize: '0.7rem', color: ACCENT, fontWeight: 600,
              }}>
                🏰 K{state.kingdomNumber}
                {!state.canEdit && (
                  <span style={{ color: '#6b7280', fontWeight: 400, marginLeft: '0.3rem' }}>
                    ({t('battleTier.viewOnly', 'view only')})
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        {/* List Manager */}
        {state.listsIndex.length === 0 && state.canEdit ? (
          <div style={{
            textAlign: 'center', padding: '2rem',
            backgroundColor: '#111', borderRadius: '16px', border: '1px solid #2a2a2a',
            marginBottom: '1.5rem',
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🏰</div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '0.5rem' }}>
              {t('battleTier.createFirst', 'Create Your First Tier List')}
            </h3>
            <p style={{ color: '#6b7280', fontSize: '0.82rem', maxWidth: '400px', margin: '0 auto 1rem' }}>
              {t('battleTier.createFirstDesc', 'Start ranking your kingdom\'s players for KvK Castle Battles.')}
            </p>
            <button
              onClick={() => state.handleCreateList('')}
              style={{
                padding: '0.6rem 1.5rem', backgroundColor: ACCENT,
                border: 'none', borderRadius: '8px',
                color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
              }}
            >
              + {t('battleTier.createList', 'Create Tier List')}
            </button>
          </div>
        ) : state.listsIndex.length > 0 ? (
          <>
            {/* List Selector + Actions */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              marginBottom: '1rem', flexWrap: 'wrap',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                backgroundColor: '#111', borderRadius: '8px', border: '1px solid #2a2a2a',
                padding: '0.25rem 0.5rem', flex: isMobile ? '1' : undefined,
              }}>
                <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>📋</span>
                {state.listsIndex.length > 1 ? (
                  <select
                    value={state.activeListId || ''}
                    onChange={(e) => state.handleSwitchList(e.target.value)}
                    style={{
                      background: 'none', border: 'none', color: '#fff',
                      fontSize: '0.8rem', fontWeight: 600, outline: 'none', cursor: 'pointer',
                      maxWidth: isMobile ? '150px' : '250px',
                    }}
                  >
                    {state.listsIndex.map(l => (
                      <option key={l.id} value={l.id}>{l.name} ({l.playerCount})</option>
                    ))}
                  </select>
                ) : (
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fff' }}>
                    {state.listsIndex[0]?.name || '—'}
                  </span>
                )}
                {state.canEdit && state.activeListId && (
                  state.editingListName === state.activeListId ? (
                    <form
                      onSubmit={e => {
                        e.preventDefault();
                        if (state.listNameDraft.trim()) {
                          state.handleRenameList(state.activeListId!, state.listNameDraft.trim());
                          state.setEditingListName(null);
                        }
                      }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', marginLeft: '0.2rem' }}
                    >
                      <input
                        autoFocus
                        value={state.listNameDraft}
                        onChange={e => state.setListNameDraft(e.target.value)}
                        onBlur={() => state.setEditingListName(null)}
                        onKeyDown={e => { if (e.key === 'Escape') state.setEditingListName(null); }}
                        style={{
                          width: '120px', padding: '0.2rem 0.4rem',
                          backgroundColor: '#1a1a1a', border: `1px solid ${ACCENT}50`,
                          borderRadius: '4px', color: '#fff', fontSize: '0.75rem', outline: 'none',
                        }}
                      />
                    </form>
                  ) : (
                    <button
                      onClick={() => {
                        const currentList = state.listsIndex.find(l => l.id === state.activeListId);
                        state.setListNameDraft(currentList?.name || '');
                        state.setEditingListName(state.activeListId);
                      }}
                      style={{
                        background: 'none', border: 'none', color: '#4b5563',
                        cursor: 'pointer', padding: '0.1rem', fontSize: '0.65rem',
                      }}
                      title={t('battleTier.renameList', 'Rename list')}
                    >
                      ✏️
                    </button>
                  )
                )}
              </div>
              {state.canEdit && (
                <>
                  <button
                    onClick={() => {
                      const name = prompt(t('battleTier.newListName', 'Enter list name:'));
                      if (name) state.handleCreateList(name);
                    }}
                    style={{
                      padding: '0.35rem 0.7rem', backgroundColor: '#1a1a1a',
                      border: '1px solid #333', borderRadius: '6px',
                      color: '#d1d5db', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    + New
                  </button>
                  {state.undoStackLength > 0 && (
                    <button
                      onClick={state.handleUndo}
                      style={{
                        padding: '0.35rem 0.7rem', backgroundColor: '#1a1a1a',
                        border: '1px solid #333', borderRadius: '6px',
                        color: '#d1d5db', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      ↩️ Undo
                    </button>
                  )}
                </>
              )}
              {rankedPlayers.length > 0 && (
                <button
                  onClick={() => state.handleExportCSV(state.activeSection)}
                  style={{
                    padding: '0.35rem 0.7rem', backgroundColor: '#1a1a1a',
                    border: '1px solid #333', borderRadius: '6px',
                    color: '#d1d5db', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  📥 CSV
                </button>
              )}
              {state.lastEditedBy && (
                <span style={{ fontSize: '0.6rem', color: '#4b5563', marginLeft: 'auto' }}>
                  {t('battleTier.lastEdit', 'Last edit by')} {state.lastEditedBy}
                </span>
              )}
            </div>

            {/* Section Toggle: Offense / Defense */}
            <div style={{
              display: 'flex', gap: '0', marginBottom: '1rem',
              borderRadius: '10px', overflow: 'hidden', border: '1px solid #2a2a2a',
            }}>
              <button
                onClick={() => state.setActiveSection('offense')}
                style={{
                  flex: 1, padding: isMobile ? '0.6rem' : '0.7rem 1.25rem',
                  backgroundColor: state.activeSection === 'offense' ? `${ACCENT}20` : '#111',
                  border: 'none',
                  borderRight: '1px solid #2a2a2a',
                  color: state.activeSection === 'offense' ? ACCENT : '#6b7280',
                  fontWeight: 700, fontSize: isMobile ? '0.8rem' : '0.88rem',
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                ⚔️ {t('battleTier.offenseTab', 'Offense')}
                {state.offenseRanked.length > 0 && (
                  <span style={{
                    marginLeft: '0.35rem', fontSize: '0.65rem', fontWeight: 600,
                    backgroundColor: state.activeSection === 'offense' ? `${ACCENT}30` : '#1a1a1a',
                    padding: '0.1rem 0.35rem', borderRadius: '4px',
                  }}>
                    {state.offenseRanked.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => state.setActiveSection('defense')}
                style={{
                  flex: 1, padding: isMobile ? '0.6rem' : '0.7rem 1.25rem',
                  backgroundColor: state.activeSection === 'defense' ? '#3b82f620' : '#111',
                  border: 'none',
                  color: state.activeSection === 'defense' ? '#3b82f6' : '#6b7280',
                  fontWeight: 700, fontSize: isMobile ? '0.8rem' : '0.88rem',
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                🛡️ {t('battleTier.defenseTab', 'Defense')}
                {state.defenseRanked.length > 0 && (
                  <span style={{
                    marginLeft: '0.35rem', fontSize: '0.65rem', fontWeight: 600,
                    backgroundColor: state.activeSection === 'defense' ? '#3b82f630' : '#1a1a1a',
                    padding: '0.1rem 0.35rem', borderRadius: '4px',
                  }}>
                    {state.defenseRanked.length}
                  </span>
                )}
              </button>
            </div>

            {/* Action Buttons */}
            {state.canEdit && (
              <div style={{
                display: 'flex', gap: '0.35rem', marginBottom: '1rem',
                justifyContent: isMobile ? 'flex-start' : 'center',
              }}>
                {!state.showForm && !state.showBulkEdit && !state.showBulkInput && (
                  <>
                    <button
                      onClick={() => {
                        state.setForm(emptyForm);
                        state.setEditingId(null);
                        state.setShowForm(true);
                        state.setShowBulkEdit(false);
                        state.setShowBulkInput(false);
                      }}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                        padding: isMobile ? '0.45rem 0.7rem' : '0.5rem 1rem',
                        backgroundColor: ACCENT, border: 'none', borderRadius: '8px',
                        color: '#fff', fontSize: isMobile ? '0.75rem' : '0.85rem',
                        fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      + {t('battleTier.addPlayer', 'Add Player')}
                    </button>
                    <button
                      onClick={() => { state.setShowBulkInput(true); state.setShowBulkEdit(false); state.setShowForm(false); }}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                        padding: isMobile ? '0.45rem 0.7rem' : '0.5rem 1rem',
                        backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
                        color: '#d1d5db', fontSize: isMobile ? '0.75rem' : '0.85rem',
                        fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      📋 {t('battleTier.bulkAdd', 'Bulk Add')}
                    </button>
                    {activePlayers.length > 0 && (
                      <button
                        onClick={() => { state.setShowBulkEdit(true); state.setShowBulkInput(false); state.setShowForm(false); }}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                          padding: isMobile ? '0.45rem 0.7rem' : '0.5rem 1rem',
                          backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
                          color: '#d1d5db', fontSize: isMobile ? '0.75rem' : '0.85rem',
                          fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        ✏️ {t('battleTier.bulkEdit', 'Edit All')}
                      </button>
                    )}
                    {(state.isEditor || state.isAdmin) && (
                      <button
                        onClick={() => state.setShowManagerPanel(!state.showManagerPanel)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                          padding: isMobile ? '0.45rem 0.7rem' : '0.5rem 1rem',
                          backgroundColor: state.showManagerPanel ? '#1e293b' : '#1a1a1a',
                          border: `1px solid ${state.showManagerPanel ? '#3b82f650' : '#333'}`,
                          borderRadius: '8px',
                          color: state.showManagerPanel ? '#93c5fd' : '#d1d5db',
                          fontSize: isMobile ? '0.75rem' : '0.85rem',
                          fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        👥 {t('battleTier.managers', 'Managers')}
                        {state.managers.length > 0 && (
                          <span style={{
                            fontSize: '0.6rem', backgroundColor: '#3b82f630',
                            padding: '0.05rem 0.3rem', borderRadius: '4px',
                          }}>
                            {state.managers.length}
                          </span>
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => state.setShowWeightsPanel(!state.showWeightsPanel)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                        padding: isMobile ? '0.45rem 0.7rem' : '0.5rem 1rem',
                        backgroundColor: state.showWeightsPanel ? '#1e293b' : '#1a1a1a',
                        border: `1px solid ${state.showWeightsPanel ? '#eab30850' : '#333'}`,
                        borderRadius: '8px',
                        color: state.showWeightsPanel ? '#fbbf24' : '#d1d5db',
                        fontSize: isMobile ? '0.75rem' : '0.85rem',
                        fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      ⚖️ {t('battleTier.weights', 'Weights')}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Manager Assignment Panel */}
            {state.showManagerPanel && (state.isEditor || state.isAdmin) && (
              <div style={{
                backgroundColor: '#111', borderRadius: '12px', border: '1px solid #3b82f630',
                padding: isMobile ? '0.75rem' : '1rem', marginBottom: '1rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>
                    👥 {t('battleTier.managerTitle', 'Battle Managers')}
                  </h3>
                  <button onClick={() => state.setShowManagerPanel(false)} style={{
                    background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.8rem',
                  }}>✕</button>
                </div>
                <p style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                  {t('battleTier.managerDesc', 'Battle Managers can edit players and tiers for this kingdom. Search by in-game name or player ID to add.')}
                </p>

                {/* Search */}
                <div ref={state.managerSearchRef} style={{ position: 'relative', marginBottom: '0.75rem' }}>
                  <input
                    type="text"
                    placeholder={t('battleTier.managerSearch', 'Search by name or player ID...')}
                    value={state.managerSearchInput}
                    onChange={e => state.setManagerSearchInput(e.target.value)}
                    style={{
                      width: '100%', padding: '0.5rem 0.75rem',
                      backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a',
                      borderRadius: '8px', color: '#fff', fontSize: '0.8rem',
                      outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                  {state.showManagerDropdown && state.managerSearchResults.length > 0 && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                      backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
                      maxHeight: '200px', overflowY: 'auto', marginTop: '0.25rem',
                    }}>
                      {state.managerSearchResults
                        .filter(r => !state.managers.some(m => m.user_id === r.id))
                        .map(result => (
                          <button
                            key={result.id}
                            onClick={async () => {
                              const name = result.linked_username || result.username || result.linked_player_id || 'Unknown';
                              const ok = await state.addManager(result.id, name);
                              if (ok) {
                                state.setManagerSearchInput('');
                                state.setShowManagerDropdown(false);
                              }
                            }}
                            style={{
                              display: 'block', width: '100%', textAlign: 'left',
                              padding: '0.5rem 0.75rem', border: 'none',
                              backgroundColor: 'transparent', color: '#fff',
                              fontSize: '0.75rem', cursor: 'pointer',
                              borderBottom: '1px solid #2a2a2a',
                            }}
                            onMouseOver={e => (e.currentTarget.style.backgroundColor = '#2a2a2a')}
                            onMouseOut={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            <span style={{ fontWeight: 600 }}>{result.linked_username || result.username || '—'}</span>
                            {result.linked_player_id && (
                              <span style={{ color: '#6b7280', marginLeft: '0.5rem', fontSize: '0.65rem' }}>
                                ID: {result.linked_player_id}
                              </span>
                            )}
                          </button>
                        ))
                      }
                    </div>
                  )}
                </div>

                {/* Current Managers */}
                {state.managers.length === 0 ? (
                  <p style={{ fontSize: '0.75rem', color: '#4b5563', fontStyle: 'italic' }}>
                    {t('battleTier.noManagers', 'No managers assigned yet. Only editors can add/remove managers.')}
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {state.managers.map(m => (
                      <div key={m.user_id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.4rem 0.6rem', backgroundColor: '#1a1a1a',
                        borderRadius: '8px', border: '1px solid #2a2a2a',
                      }}>
                        <span style={{ fontSize: '0.8rem', color: '#d1d5db', fontWeight: 600 }}>
                          {m.username || '—'}
                        </span>
                        <button
                          onClick={() => state.removeManager(m.user_id)}
                          style={{
                            background: 'none', border: 'none', color: '#ef444480',
                            cursor: 'pointer', fontSize: '0.7rem', padding: '0.2rem 0.4rem',
                          }}
                          title={t('battleTier.removeManager', 'Remove manager')}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Stat Weights Panel */}
            {state.showWeightsPanel && (() => {
              const activeWeights = state.activeSection === 'offense' ? state.offenseWeights : state.defenseWeights;
              const hasCustom = !isTroopWeightsDefault(state.offenseWeights) || !isTroopWeightsDefault(state.defenseWeights);
              const TROOP_KEYS = ['infantry', 'cavalry', 'archer'] as const;
              const troopLabels: Record<string, string> = {
                infantry: t('battleTier.infantry', 'Infantry'),
                cavalry: t('battleTier.cavalry', 'Cavalry'),
                archer: t('battleTier.archers', 'Archers'),
              };
              const troopEmoji: Record<string, string> = { infantry: '🛡️', cavalry: '🐴', archer: '🏹' };
              const statLabels: Record<string, string> = {
                attack: t('battleTier.wAttack', 'ATK'),
                lethality: t('battleTier.wLethality', 'LTH'),
                defense: t('battleTier.wDefense', 'DEF'),
                health: t('battleTier.wHealth', 'HP'),
              };

              const handleWeightChange = (troop: 'infantry' | 'cavalry' | 'archer', stat: 'attack' | 'lethality' | 'defense' | 'health', value: number) => {
                const clamped = Math.min(5, Math.max(0, value));
                const updated = structuredClone(activeWeights);
                updated[troop][stat] = clamped;
                if (state.activeSection === 'offense') {
                  state.handleApplyWeights(updated, state.defenseWeights);
                } else {
                  state.handleApplyWeights(state.offenseWeights, updated);
                }
              };

              return (
                <div style={{
                  backgroundColor: '#111', borderRadius: '12px', border: '1px solid #eab30830',
                  padding: isMobile ? '0.75rem' : '1rem', marginBottom: '1rem',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                      ⚖️ {t('battleTier.weightsTitle', 'Stat Weights')}
                      <span style={{ fontSize: '0.65rem', color: '#6b7280', fontWeight: 400, marginLeft: '0.5rem' }}>
                        ({state.activeSection === 'offense' ? t('battleTier.offense', 'Offense') : t('battleTier.defense', 'Defense')})
                      </span>
                    </h3>
                    <button onClick={() => state.setShowWeightsPanel(false)} style={{
                      background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '1rem',
                      minWidth: '44px', minHeight: '44px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      WebkitTapHighlightColor: 'transparent',
                    }}>✕</button>
                  </div>
                  <p style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                    {t('battleTier.weightsDesc', 'Adjust how much each stat contributes to the score. Default is 1.0× (equal weight). Higher = more important.')}
                  </p>

                  {/* Header row */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '3.2rem repeat(4, 1fr)' : '5rem repeat(4, 1fr)',
                    gap: '0.35rem', marginBottom: '0.25rem',
                  }}>
                    <div />
                    {STAT_LABELS.map(stat => (
                      <div key={stat} style={{
                        fontSize: '0.55rem', fontWeight: 700, color: '#9ca3af',
                        textTransform: 'uppercase', textAlign: 'center',
                      }}>
                        {statLabels[stat]}
                      </div>
                    ))}
                  </div>

                  {/* Troop rows */}
                  {TROOP_KEYS.map(troop => (
                    <div key={troop} style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '3.2rem repeat(4, 1fr)' : '5rem repeat(4, 1fr)',
                      gap: '0.35rem', marginBottom: '0.35rem', alignItems: 'center',
                    }}>
                      <div style={{
                        fontSize: isMobile ? '0.55rem' : '0.65rem', fontWeight: 700,
                        color: TROOP_COLORS[troop === 'archer' ? 'archer' : troop],
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {isMobile ? `${troopEmoji[troop]}` : `${troopEmoji[troop]} ${troopLabels[troop]}`}
                      </div>
                      {STAT_LABELS.map(stat => (
                        <input
                          key={`${troop}-${stat}`}
                          type="number"
                          step="0.1"
                          min="0"
                          max="5"
                          value={activeWeights[troop][stat]}
                          onChange={e => handleWeightChange(troop, stat, parseFloat(e.target.value) || 0)}
                          style={{
                            width: '100%', padding: isMobile ? '0.4rem 0.2rem' : '0.35rem',
                            backgroundColor: activeWeights[troop][stat] !== 1 ? '#1a1a0a' : '#1a1a1a',
                            border: activeWeights[troop][stat] !== 1 ? '1px solid #eab30840' : '1px solid #2a2a2a',
                            borderRadius: '6px', color: '#fff', fontSize: isMobile ? '1rem' : '0.8rem',
                            textAlign: 'center', outline: 'none',
                          }}
                        />
                      ))}
                    </div>
                  ))}

                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                    {hasCustom && (
                      <button
                        onClick={state.handleResetWeights}
                        style={{
                          padding: isMobile ? '0.6rem 1rem' : '0.4rem 0.8rem', backgroundColor: '#1a1a1a',
                          border: '1px solid #333', borderRadius: '8px',
                          color: '#9ca3af', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                          minHeight: isMobile ? '44px' : 'auto',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          WebkitTapHighlightColor: 'transparent', transition: 'all 0.2s ease',
                        }}
                      >
                        {t('battleTier.weightsReset', 'Reset to Default')}
                      </button>
                    )}
                    {hasCustom && (
                      <span style={{ fontSize: '0.6rem', color: '#eab308', fontStyle: 'italic' }}>
                        {t('battleTier.weightsActive', 'Custom weights active — scores recalculated')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Bulk Edit */}
            {state.showBulkEdit && (
              <BattleBulkEdit
                existingPlayers={activePlayers}
                onSave={handleBulkEdit}
                onClose={() => state.setShowBulkEdit(false)}
                isMobile={isMobile}
                tierOverridesOffense={state.tierOverridesOffense}
                tierOverridesDefense={state.tierOverridesDefense}
              />
            )}

            {/* Bulk Add */}
            {state.showBulkInput && (
              <BattleBulkInput
                existingPlayers={activePlayers}
                onSave={handleBulkAdd}
                onClose={() => state.setShowBulkInput(false)}
                isMobile={isMobile}
                rosterNames={state.kingdomPlayerNames}
                tierOverridesOffense={state.tierOverridesOffense}
                tierOverridesDefense={state.tierOverridesDefense}
              />
            )}

            {/* Player Form */}
            {state.showForm && (
              <div style={{
                backgroundColor: '#111', borderRadius: '12px', border: `1px solid ${ACCENT}30`,
                padding: isMobile ? '1rem' : '1.25rem', marginBottom: '1rem',
              }}>
                <h3 style={{
                  fontSize: '0.88rem', fontWeight: 700, color: '#fff',
                  marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem',
                }}>
                  {state.editingId ? '✏️ ' + t('battleTier.editPlayer', 'Edit Player') : '+ ' + t('battleTier.addPlayer', 'Add Player')}
                </h3>

                {/* Player Name with Autocomplete */}
                <div style={{ marginBottom: '0.75rem', position: 'relative' }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                    {t('battleTier.playerName', 'Player Name')}
                    {state.kingdomPlayerNames.length > 0 && (
                      <span style={{ color: '#6b7280', fontWeight: 400, fontSize: '0.6rem', marginLeft: '0.4rem', textTransform: 'none' }}>
                        {t('battleTier.kingdomHint', '(suggestions from kingdom players)')}
                      </span>
                    )}
                  </div>
                  <input
                    ref={state.nameInputRef}
                    type="text"
                    placeholder={t('battleTier.enterName', 'Enter player name')}
                    value={state.form.playerName}
                    onChange={(e) => { state.updateForm('playerName', e.target.value); state.setShowSuggestions(true); }}
                    onFocus={() => state.setShowSuggestions(true)}
                    autoComplete="off"
                    style={{
                      width: '100%', padding: '0.5rem', backgroundColor: '#1a1a1a',
                      border: '1px solid #2a2a2a', borderRadius: '8px',
                      color: '#fff', fontSize: '0.85rem', outline: 'none',
                    }}
                  />
                  {state.showSuggestions && state.nameSuggestions.length > 0 && (
                    <div ref={state.suggestionsRef} style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                      backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
                      marginTop: '2px', maxHeight: '180px', overflowY: 'auto',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                    }}>
                      {state.nameSuggestions.map(name => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => { state.updateForm('playerName', name); state.setShowSuggestions(false); }}
                          style={{
                            width: '100%', padding: '0.45rem 0.75rem', textAlign: 'left',
                            background: 'none', border: 'none', borderBottom: '1px solid #2a2a2a',
                            color: '#d1d5db', fontSize: '0.82rem', cursor: 'pointer',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#2a2a2a'; }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          <span style={{ color: '#fff', fontWeight: 600 }}>{name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Troop Stat Inputs */}
                <StatInputRow troopType="infantry" label={t('battleTier.infantry', 'Infantry')} form={state.form as unknown as Record<string, string | number>} updateForm={state.updateForm as (f: string, v: string | number) => void} isMobile={isMobile} t={t} />
                <StatInputRow troopType="cavalry" label={t('battleTier.cavalry', 'Cavalry')} form={state.form as unknown as Record<string, string | number>} updateForm={state.updateForm as (f: string, v: string | number) => void} isMobile={isMobile} t={t} />
                <StatInputRow troopType="archer" label={t('battleTier.archers', 'Archers')} form={state.form as unknown as Record<string, string | number>} updateForm={state.updateForm as (f: string, v: string | number) => void} isMobile={isMobile} t={t} />

                {state.formError && (
                  <p style={{ color: '#ef4444', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                    ⚠️ {state.formError}
                  </p>
                )}

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={state.handleSubmit}
                    style={{
                      padding: '0.5rem 1.25rem', backgroundColor: ACCENT,
                      border: 'none', borderRadius: '8px',
                      color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                    }}
                  >
                    {state.editingId ? t('common.save', 'Save') : t('battleTier.addPlayer', 'Add Player')}
                  </button>
                  <button
                    onClick={state.handleCancelForm}
                    style={{
                      padding: '0.5rem 1rem', background: 'none',
                      border: '1px solid #333', borderRadius: '8px',
                      color: '#6b7280', fontSize: '0.85rem', cursor: 'pointer',
                    }}
                  >
                    {t('common.cancel', 'Cancel')}
                  </button>
                </div>
              </div>
            )}

            {/* Undo Toast */}
            {state.showUndoToast && (
              <div style={{
                position: 'fixed', bottom: '5rem', left: '50%', transform: 'translateX(-50%)',
                zIndex: 100, padding: '0.6rem 1.2rem', backgroundColor: '#1a1a1a',
                border: `1px solid ${ACCENT}30`, borderRadius: '10px',
                color: ACCENT, fontSize: '0.8rem', fontWeight: 600,
                boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              }}>
                ↩️ {t('battleTier.undone', 'Action undone')}
              </div>
            )}

            {/* Tier Table */}
            {rankedPlayers.length > 0 ? (
              <div>
                {/* Player Rows */}
                {rankedPlayers.map(player => (
                  <PlayerRow
                    key={player.id}
                    player={player}
                    mode={state.activeSection}
                    canEdit={state.canEdit}
                    isMobile={isMobile}
                    expanded={state.expandedCards.has(player.id)}
                    onToggle={() => {
                      state.setExpandedCards(prev => {
                        const next = new Set(prev);
                        if (next.has(player.id)) next.delete(player.id);
                        else next.add(player.id);
                        return next;
                      });
                    }}
                    onEdit={() => state.handleEdit(player)}
                    onDelete={() => {
                      if (deleteTarget === player.id) {
                        state.handleDelete(player.id);
                        setDeleteTarget(null);
                      } else {
                        setDeleteTarget(player.id);
                      }
                    }}
                    deleteConfirm={deleteTarget === player.id}
                    onCancelDelete={() => setDeleteTarget(null)}
                  />
                ))}

                {/* Tier Distribution Footer */}
                <div style={{
                  padding: '0.6rem 0.75rem',
                  backgroundColor: '#0d0d0d',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  marginTop: '0.25rem',
                  borderTop: '1px solid #1a1a1a',
                }}>
                  <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>
                    {activeIncomplete.length > 0
                      ? t('battleTier.rankedOfTotal', '{{ranked}} ranked / {{total}} total', { ranked: rankedPlayers.length, total: activePlayers.length })
                      : t('battleTier.totalPlayers', '{{count}} players', { count: activePlayers.length })}
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {(['SS', 'S', 'A', 'B', 'C', 'D'] as BattleTier[]).map(tier => {
                      const count = rankedPlayers.filter(p =>
                        (state.activeSection === 'offense' ? p.offenseTier : p.defenseTier) === tier
                      ).length;
                      if (count === 0) return null;
                      return (
                        <span key={tier} style={{
                          fontSize: '0.6rem',
                          color: BATTLE_TIER_COLORS[tier],
                          fontWeight: 700,
                        }}>
                          {tier}: {count}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Incomplete players */}
                {activeIncomplete.length > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    <h4 style={{
                      fontSize: '0.75rem', fontWeight: 700, color: '#eab308',
                      marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem',
                    }}>
                      ⚠️ {t('battleTier.unranked', 'Unranked — Missing Data')} ({activeIncomplete.length})
                    </h4>
                    {activeIncomplete.map(p => (
                      <div key={p.id} style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.5rem 0.75rem', backgroundColor: '#111',
                        borderRadius: '8px', border: '1px solid #eab30820',
                        marginBottom: '0.35rem',
                      }}>
                        <span style={{ fontSize: '0.82rem', color: '#eab308', flex: 1 }}>{p.playerName}</span>
                        {state.canEdit && (
                          <button
                            onClick={() => state.handleEdit(p)}
                            style={{
                              padding: '0.2rem 0.5rem', backgroundColor: '#eab30815',
                              border: '1px solid #eab30830', borderRadius: '6px',
                              color: '#eab308', fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer',
                            }}
                          >
                            {t('battleTier.addData', 'Add Data')}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : activePlayers.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: isMobile ? '2rem 1rem' : '3rem 2rem',
                backgroundColor: '#111', borderRadius: '16px', border: '1px solid #2a2a2a',
              }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏰</div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '0.5rem' }}>
                  {t('battleTier.emptyTitle', 'No players scored yet')}
                </h3>
                <p style={{ fontSize: '0.85rem', color: '#6b7280', maxWidth: '400px', margin: '0 auto 1rem' }}>
                  {t('battleTier.emptyDesc', 'Add kingdom players and their scouted stats to generate Battle Tier rankings.')}
                </p>
                {state.canEdit && (
                  <button
                    onClick={() => {
                      state.setForm(emptyForm);
                      state.setEditingId(null);
                      state.setShowForm(true);
                    }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                      padding: '0.6rem 1.5rem', backgroundColor: ACCENT,
                      border: 'none', borderRadius: '8px',
                      color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
                    }}
                  >
                    + {t('battleTier.addFirstPlayer', 'Add First Player')}
                  </button>
                )}
              </div>
            ) : null}
          </>
        ) : null}

        {/* Tier Cutoff Editor */}
            <BattleTierCutoffEditor
              mode={state.activeSection}
              rankedPlayers={rankedPlayers}
              tierOverrides={state.activeSection === 'offense' ? state.tierOverridesOffense : state.tierOverridesDefense}
              autoBoundaries={state.activeSection === 'offense' ? state.autoOffenseBoundaries : state.autoDefenseBoundaries}
              onSetOverrides={state.activeSection === 'offense' ? state.handleSetOffenseOverrides : state.handleSetDefenseOverrides}
              canEdit={state.canEdit}
              isMobile={isMobile}
            />

        {/* Info Card */}
        <div style={{
          marginTop: '1.5rem', padding: isMobile ? '1rem' : '1.25rem',
          backgroundColor: '#111', borderRadius: '12px', border: '1px solid #2a2a2a',
        }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', marginBottom: '0.5rem' }}>
            ℹ️ {t('battleTier.howTitle', 'How Scores Work')}
          </h3>
          <ul style={{ fontSize: '0.75rem', color: '#9ca3af', paddingLeft: '1.25rem', lineHeight: 1.7, margin: 0 }}>
            <li>{t('battleTier.how1', 'Each player\'s stats come from scouting their Guard Station lineup (3 heroes).')}</li>
            <li>{t('battleTier.how2', 'Offense Score: Defensive EG bonuses are removed from scouted values, then offensive EG bonuses are applied. All 12 stats (ATK, LTH, DEF, HP × 3 troop types) are summed.')}</li>
            <li>{t('battleTier.how3', 'Defense Score: Raw scouted values are summed directly — the scout report already shows exact defensive stats.')}</li>
            <li>{t('battleTier.how4', 'Tiers use a natural-breaks algorithm to find meaningful gaps between player scores.')}</li>
          </ul>
        </div>

        {/* Disclaimer */}
        <div style={{
          marginTop: '1rem', padding: '0.75rem 1rem',
          backgroundColor: '#0d0d0d', borderRadius: '10px', border: '1px solid #1a1a1a',
        }}>
          <p style={{ fontSize: '0.7rem', color: '#6b7280', margin: 0, fontStyle: 'italic', lineHeight: 1.5 }}>
            ⚠️ {t('battleTier.disclaimer', 'This tool is a guide only. Scores are based on troop bonuses and Exclusive Gear adjustments — hero skills are not factored in. Use this as a starting point for rally and garrison decisions.')}
          </p>
        </div>

        {/* Back Links */}
        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <BackLink to="/tools" label={t('common.allTools', 'All Tools')} />
          <BackLink to="/" label={t('common.backToHome', 'Home')} variant="secondary" />
        </div>
      </div>
    </div>
  );
};

export default KvKBattleTierList;
