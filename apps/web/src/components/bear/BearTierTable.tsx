import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  getPlayerDisplayStats,
  BEAR_TIER_COLORS,
  type BearPlayerEntry,
  type BearTier,
} from '../../data/bearHuntData';
import { FONT_DISPLAY } from '../../utils/styles';

const ACCENT = '#3b82f6';

// ── TierBadge ─────────────────────────────────────────────────────────────

const TierBadge: React.FC<{ tier: BearTier; size?: 'sm' | 'md' }> = ({ tier, size = 'md' }) => {
  const color = BEAR_TIER_COLORS[tier];
  const isSm = size === 'sm';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: isSm ? '28px' : '32px', height: isSm ? '22px' : '26px',
      padding: `0 ${isSm ? '0.35rem' : '0.45rem'}`,
      backgroundColor: `${color}18`, border: `1px solid ${color}40`,
      borderRadius: '6px', color, fontSize: isSm ? '0.6rem' : '0.7rem',
      fontWeight: 800, fontFamily: FONT_DISPLAY, letterSpacing: '0.03em',
    }}>
      {tier}
    </span>
  );
};

// ── Types ─────────────────────────────────────────────────────────────────

type RankedPlayer = BearPlayerEntry & { rank: number };

interface BearTierTableProps {
  isMobile: boolean;
  canEdit: boolean;
  rankedPlayers: RankedPlayer[];
  incompletePlayers: BearPlayerEntry[];
  unscoredRosterMembers: string[];
  expandedCards: Set<string>;
  setExpandedCards: React.Dispatch<React.SetStateAction<Set<string>>>;
  deleteConfirm: string | null;
  setDeleteConfirm: React.Dispatch<React.SetStateAction<string | null>>;
  handleEdit: (player: BearPlayerEntry) => void;
  handleDelete: (id: string) => void;
  handleAddRosterMember: (name: string) => void;
  tierListRef: React.RefObject<HTMLDivElement | null>;
  lastEditedBy: string | null;
  players: BearPlayerEntry[];
}

const BearTierTable: React.FC<BearTierTableProps> = ({
  isMobile,
  canEdit,
  rankedPlayers,
  incompletePlayers,
  unscoredRosterMembers,
  expandedCards,
  setExpandedCards,
  deleteConfirm,
  setDeleteConfirm,
  handleEdit,
  handleDelete,
  handleAddRosterMember,
  tierListRef,
  lastEditedBy,
  players,
}) => {
  const { t } = useTranslation();

  return (
    <div ref={tierListRef} style={{
      backgroundColor: '#111111',
      borderRadius: '16px',
      border: '1px solid #2a2a2a',
      overflow: 'hidden',
    }}>
      {isMobile ? (
        /* ═══ MOBILE: Collapsible Card Layout ═══ */
        <div>
          {rankedPlayers.map((player) => {
            const tierColor = BEAR_TIER_COLORS[player.tier];
            const ds = getPlayerDisplayStats(player);
            const isExpanded = expandedCards.has(player.id);
            return (
              <div
                key={player.id}
                style={{ borderBottom: '1px solid #1a1a1a' }}
              >
                {/* Collapsed header row */}
                <div
                  onClick={() => setExpandedCards(prev => {
                    const next = new Set(prev);
                    if (next.has(player.id)) next.delete(player.id);
                    else next.add(player.id);
                    return next;
                  })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.6rem 0.85rem', cursor: 'pointer',
                    transition: 'background-color 0.1s',
                  }}
                >
                  <span style={{
                    fontSize: '0.8rem', fontWeight: 800,
                    color: '#fff',
                    fontFamily: FONT_DISPLAY, minWidth: '24px',
                  }}>
                    #{player.rank}
                  </span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: tierColor, fontFamily: FONT_DISPLAY }}>
                    {player.bearScore.toFixed(1)}
                  </span>
                  <TierBadge tier={player.tier} size="sm" />
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {player.playerName}
                  </span>
                  <svg
                    width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5"
                    style={{ flexShrink: 0, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  >
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ padding: '0 0.85rem 0.6rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <tbody>
                        {([
                          { label: 'INF', hero: player.infantryHero, eg: player.infantryEGLevel, atk: ds.infAtk, leth: ds.infLeth, color: '#3b82f6', bg: '#3b82f608' },
                          { label: 'CAV', hero: player.cavalryHero, eg: player.cavalryEGLevel, atk: ds.cavAtk, leth: ds.cavLeth, color: '#f97316', bg: '#f9731608' },
                          { label: 'ARC', hero: player.archerHero, eg: player.archerEGLevel, atk: ds.arcAtk, leth: ds.arcLeth, color: '#ef4444', bg: '#ef444408' },
                        ] as const).map(troop => (
                          <tr key={troop.label} style={{ backgroundColor: troop.bg }}>
                            <td style={{ fontSize: '0.65rem', fontWeight: 800, color: troop.color, padding: '0.3rem 0.4rem', width: '30px' }}>
                              {troop.label}
                            </td>
                            <td style={{ fontSize: '0.7rem', color: '#9ca3af', padding: '0.3rem 0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80px' }}>
                              {troop.hero}
                            </td>
                            <td style={{ fontSize: '0.58rem', color: '#6b7280', padding: '0.3rem 0.2rem', width: '32px' }}
                              title={t('bearRally.egTooltip', 'Exclusive Gear (EG) — each hero\'s unique equipment that boosts specific stats. Levels range from 0 to 10.')}
                            >
                              EG{troop.eg}
                            </td>
                            <td style={{ fontSize: '0.7rem', fontWeight: 600, color: '#d1d5db', fontVariantNumeric: 'tabular-nums', padding: '0.3rem 0.2rem', textAlign: 'right' }}>
                              {troop.atk.toFixed(1)}%
                            </td>
                            <td style={{ fontSize: '0.55rem', color: '#6b7280', padding: '0.3rem 0', width: '12px', textAlign: 'center' }}>A</td>
                            <td style={{ fontSize: '0.7rem', fontWeight: 600, color: '#d1d5db', fontVariantNumeric: 'tabular-nums', padding: '0.3rem 0.2rem', textAlign: 'right' }}>
                              {troop.leth.toFixed(1)}%
                            </td>
                            <td style={{ fontSize: '0.55rem', color: '#6b7280', padding: '0.3rem 0.4rem 0.3rem 0', width: '12px' }}>L</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Edit / Delete actions */}
                    {canEdit && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.3rem' }}>
                        <button
                          onClick={() => handleEdit(player)}
                          style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.6rem' }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        {deleteConfirm === player.id ? (
                          <button
                            onClick={() => handleDelete(player.id)}
                            style={{ background: 'none', border: '1px solid #ef444440', borderRadius: '4px', color: '#ef4444', cursor: 'pointer', padding: '0.15rem 0.5rem', fontSize: '0.6rem', fontWeight: 700 }}
                          >
                            {t('common.confirm', 'Confirm')}
                          </button>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(player.id)}
                            style={{ background: 'none', border: 'none', color: '#6b728060', cursor: 'pointer', padding: '0.15rem' }}
                            title="Delete"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {/* Incomplete players */}
          {incompletePlayers.length > 0 && (
            <>
              <div style={{ padding: '0.5rem 0.75rem 0.25rem', fontSize: '0.6rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em', borderTop: rankedPlayers.length > 0 ? '1px solid #2a2a2a' : 'none' }}>
                {t('bearRally.incompleteSection', 'Unranked — Missing Data')} ({incompletePlayers.length})
              </div>
              {incompletePlayers.map((player) => (
                <div key={player.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.5rem 0.75rem', borderBottom: '1px solid #1a1a1a',
                  backgroundColor: '#f59e0b06',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '0.7rem', color: '#f59e0b80', fontWeight: 700 }}>—</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.playerName}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.55rem', color: '#f59e0b80', fontStyle: 'italic' }}>{t('bearRally.needsData', 'needs data')}</span>
                    {canEdit && (
                      <button
                        onClick={() => handleEdit(player)}
                        style={{
                          padding: '0.2rem 0.6rem', backgroundColor: '#f59e0b15',
                          border: '1px solid #f59e0b30', borderRadius: '6px',
                          color: '#f59e0b', fontSize: '0.6rem', fontWeight: 700, cursor: 'pointer',
                          minHeight: '28px',
                        }}
                      >
                        + {t('bearRally.addData', 'Add Data')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
          {/* Unscored roster members */}
          {unscoredRosterMembers.length > 0 && (
            <>
              <div style={{ padding: '0.5rem 0.75rem 0.25rem', fontSize: '0.6rem', fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t('bearRally.unscoredSection', 'Roster — No Data Yet')} ({unscoredRosterMembers.length})
              </div>
              {unscoredRosterMembers.map((name) => (
                <div key={name} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.5rem 0.75rem', borderBottom: '1px solid #1a1a1a',
                  backgroundColor: '#0a162808',
                }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#6b7280' }}>{name}</span>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.6rem', color: '#4b5563' }}>—</span>
                    {canEdit && (
                      <button
                        onClick={() => handleAddRosterMember(name)}
                        style={{
                          padding: '0.2rem 0.6rem', backgroundColor: `${ACCENT}15`,
                          border: `1px solid ${ACCENT}30`, borderRadius: '6px',
                          color: ACCENT, fontSize: '0.6rem', fontWeight: 700, cursor: 'pointer',
                        }}
                      >
                        + {t('bearRally.addData', 'Add Data')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      ) : (
        /* ═══ DESKTOP: Proper HTML Table with Gear columns ═══ */
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '40px' }} />
              <col style={{ width: '58px' }} />
              <col style={{ width: '42px' }} />
              <col />
              <col style={{ width: '62px' }} />
              <col style={{ width: '34px' }} />
              <col style={{ width: '62px' }} />
              <col style={{ width: '34px' }} />
              <col style={{ width: '62px' }} />
              <col style={{ width: '34px' }} />
              <col style={{ width: '72px' }} />
              <col style={{ width: '72px' }} />
              <col style={{ width: '72px' }} />
              <col style={{ width: '72px' }} />
              <col style={{ width: '72px' }} />
              <col style={{ width: '72px' }} />
              {canEdit && <col style={{ width: '48px' }} />}
            </colgroup>
            <thead>
              {/* Group header row */}
              <tr style={{ backgroundColor: '#0d0d0d' }}>
                <th colSpan={4} style={{ padding: 0 }} />
                <th colSpan={6} style={{
                  fontSize: '0.58rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase',
                  letterSpacing: '0.04em', textAlign: 'center', padding: '0.35rem 0 0.15rem',
                  borderBottom: '1px solid #9ca3af20',
                }}>
                  {t('bearRally.sectionHeroesGear', 'Heroes & Gear')}
                </th>
                <th colSpan={6} style={{
                  fontSize: '0.58rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase',
                  letterSpacing: '0.04em', textAlign: 'center', padding: '0.35rem 0 0.15rem',
                  borderBottom: '1px solid #9ca3af20',
                }}>
                  {t('bearRally.sectionTroopBonuses', 'Troop Bonuses')}
                </th>
                {canEdit && <th style={{ padding: 0 }} />}
              </tr>
              {/* Column header row */}
              <tr style={{ backgroundColor: '#0d0d0d', borderBottom: '1px solid #2a2a2a' }}>
                <th style={{ fontSize: '0.6rem', fontWeight: 700, color: '#6b7280', textAlign: 'left', padding: '0.3rem 0.4rem' }}>#</th>
                <th style={{ fontSize: '0.6rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', textAlign: 'center', padding: '0.3rem 0.4rem' }}>
                  {t('bearRally.bearScore', 'Score')}
                </th>
                <th style={{ fontSize: '0.6rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', textAlign: 'center', padding: '0.3rem 0.4rem' }}>
                  {t('bearRally.tierLabel', 'Tier')}
                </th>
                <th style={{ fontSize: '0.6rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', textAlign: 'left', padding: '0.3rem 0.4rem' }}>
                  {t('bearRally.player', 'Player')}
                </th>
                {/* Heroes & Gear sub-headers */}
                {([
                  { emoji: '🛡️', label: t('bearRally.hero', 'Hero'), color: '#3b82f6', isGear: false },
                  { emoji: '🛡️', label: t('bearRally.gearShort', 'Gear'), color: '#3b82f6', isGear: true },
                  { emoji: '🐎', label: t('bearRally.hero', 'Hero'), color: '#f97316', isGear: false },
                  { emoji: '🐎', label: t('bearRally.gearShort', 'Gear'), color: '#f97316', isGear: true },
                  { emoji: '🏹', label: t('bearRally.hero', 'Hero'), color: '#ef4444', isGear: false },
                  { emoji: '🏹', label: t('bearRally.gearShort', 'Gear'), color: '#ef4444', isGear: true },
                ] as const).map((col, i) => (
                  <th key={`hg-${i}`} style={{
                    fontSize: '0.6rem', fontWeight: 700, color: col.color, textTransform: 'uppercase',
                    textAlign: 'center', padding: '0.2rem 0.15rem', verticalAlign: 'bottom',
                    cursor: col.isGear ? 'help' : undefined,
                  }}
                    title={col.isGear ? t('bearRally.egTooltip', 'Exclusive Gear (EG) — each hero\'s unique equipment that boosts specific stats. Levels range from 0 to 10.') : undefined}
                  >
                    <div style={{ fontSize: '0.7rem', lineHeight: 1 }}>{col.emoji}</div>
                    <div style={{ lineHeight: 1.2, marginTop: '1px' }}>{col.label}</div>
                  </th>
                ))}
                {/* Troop Bonuses sub-headers */}
                {([
                  { emoji: '🛡️', label: t('bearRally.attackShort', 'Attack'), color: '#3b82f6' },
                  { emoji: '🛡️', label: t('bearRally.lethalityShort', 'Lethality'), color: '#3b82f6' },
                  { emoji: '🐎', label: t('bearRally.attackShort', 'Attack'), color: '#f97316' },
                  { emoji: '🐎', label: t('bearRally.lethalityShort', 'Lethality'), color: '#f97316' },
                  { emoji: '🏹', label: t('bearRally.attackShort', 'Attack'), color: '#ef4444' },
                  { emoji: '🏹', label: t('bearRally.lethalityShort', 'Lethality'), color: '#ef4444' },
                ] as const).map((col, i) => (
                  <th key={`tb-${i}`} style={{
                    fontSize: '0.6rem', fontWeight: 700, color: col.color, textTransform: 'uppercase',
                    textAlign: 'center', padding: '0.2rem 0.15rem', verticalAlign: 'bottom',
                  }}>
                    <div style={{ fontSize: '0.7rem', lineHeight: 1 }}>{col.emoji}</div>
                    <div style={{ lineHeight: 1.2, marginTop: '1px' }}>{col.label}</div>
                    <div style={{ fontSize: '0.55rem', color: '#6b7280', lineHeight: 1, marginTop: '1px' }}>%</div>
                  </th>
                ))}
                {canEdit && <th style={{ padding: '0.3rem 0.15rem' }} />}
              </tr>
            </thead>
            <tbody>
              {rankedPlayers.map((player) => {
                const tierColor = BEAR_TIER_COLORS[player.tier];
                const ds = getPlayerDisplayStats(player);
                const tdBase: React.CSSProperties = { padding: '0.4rem 0.15rem', fontSize: '0.72rem', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid #1a1a1a' };
                const heroCellBase: React.CSSProperties = { ...tdBase, fontWeight: 500, textAlign: 'center', fontSize: '0.62rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
                const gearCellBase: React.CSSProperties = { ...tdBase, fontWeight: 600, textAlign: 'center', fontSize: '0.6rem' };
                return (
                  <tr key={player.id} style={{ transition: 'background-color 0.1s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#1a1a1a'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <td style={{ ...tdBase, fontWeight: 800, color: '#fff', fontFamily: FONT_DISPLAY, padding: '0.4rem 0.4rem' }}>
                      #{player.rank}
                    </td>
                    <td style={{ ...tdBase, fontWeight: 800, color: tierColor, fontFamily: FONT_DISPLAY, textAlign: 'center', fontSize: '0.78rem', padding: '0.4rem 0.4rem' }}>
                      {player.bearScore.toFixed(1)}
                    </td>
                    <td style={{ ...tdBase, textAlign: 'center', padding: '0.4rem 0.4rem' }}>
                      <TierBadge tier={player.tier} size="sm" />
                    </td>
                    <td style={{ ...tdBase, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0.4rem 0.4rem' }}>
                      {player.playerName}
                    </td>
                    {/* Heroes & Gear */}
                    <td style={{ ...heroCellBase, color: '#93c5fd' }}>{player.infantryHero}</td>
                    <td style={{ ...gearCellBase, color: '#93c5fd' }}>{player.infantryEGLevel}</td>
                    <td style={{ ...heroCellBase, color: '#fdba74' }}>{player.cavalryHero}</td>
                    <td style={{ ...gearCellBase, color: '#fdba74' }}>{player.cavalryEGLevel}</td>
                    <td style={{ ...heroCellBase, color: '#fca5a5' }}>{player.archerHero}</td>
                    <td style={{ ...gearCellBase, color: '#fca5a5' }}>{player.archerEGLevel}</td>
                    {/* Troop Bonuses */}
                    <td style={{ ...tdBase, fontWeight: 600, color: '#93c5fd', textAlign: 'center' }}>{ds.infAtk.toFixed(1)}</td>
                    <td style={{ ...tdBase, fontWeight: 600, color: '#93c5fd', textAlign: 'center' }}>{ds.infLeth.toFixed(1)}</td>
                    <td style={{ ...tdBase, fontWeight: 600, color: '#fdba74', textAlign: 'center' }}>{ds.cavAtk.toFixed(1)}</td>
                    <td style={{ ...tdBase, fontWeight: 600, color: '#fdba74', textAlign: 'center' }}>{ds.cavLeth.toFixed(1)}</td>
                    <td style={{ ...tdBase, fontWeight: 600, color: '#fca5a5', textAlign: 'center' }}>{ds.arcAtk.toFixed(1)}</td>
                    <td style={{ ...tdBase, fontWeight: 600, color: '#fca5a5', textAlign: 'center' }}>{ds.arcLeth.toFixed(1)}</td>
                    {canEdit && (
                      <td style={{ ...tdBase, textAlign: 'center', paddingRight: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.15rem' }}>
                          <button
                            onClick={() => handleEdit(player)}
                            style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '0.15rem' }}
                            title="Edit"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          {deleteConfirm === player.id ? (
                            <button
                              onClick={() => handleDelete(player.id)}
                              style={{ background: 'none', border: '1px solid #ef444440', borderRadius: '3px', color: '#ef4444', cursor: 'pointer', padding: '0.1rem 0.3rem', fontSize: '0.55rem', fontWeight: 700 }}
                            >
                              ✓
                            </button>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(player.id)}
                              style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '0.15rem' }}
                              title="Delete"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {/* Incomplete players */}
              {incompletePlayers.length > 0 && (
                <>
                  <tr><td colSpan={canEdit ? 17 : 16} style={{ padding: '0.35rem 0.6rem 0.15rem', fontSize: '0.55rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #1a1a1a', borderTop: rankedPlayers.length > 0 ? '1px solid #2a2a2a' : 'none' }}>
                    {t('bearRally.incompleteSection', 'Unranked — Missing Data')} ({incompletePlayers.length})
                  </td></tr>
                  {incompletePlayers.map((player) => {
                    const tdBase: React.CSSProperties = { padding: '0.4rem 0.15rem', fontSize: '0.72rem', borderBottom: '1px solid #1a1a1a' };
                    return (
                      <tr key={player.id} style={{ backgroundColor: '#f59e0b06' }}>
                        <td style={{ ...tdBase, color: '#f59e0b60', paddingLeft: '0.6rem', fontWeight: 700 }}>—</td>
                        <td style={{ ...tdBase, color: '#f59e0b60', textAlign: 'center', fontStyle: 'italic', fontSize: '0.6rem' }}>—</td>
                        <td style={{ ...tdBase, textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            minWidth: '28px', height: '22px', padding: '0 0.35rem',
                            backgroundColor: '#f59e0b10', border: '1px solid #f59e0b25',
                            borderRadius: '6px', color: '#f59e0b80', fontSize: '0.55rem',
                            fontWeight: 700, letterSpacing: '0.03em',
                          }}>?</span>
                        </td>
                        <td style={{ ...tdBase, fontWeight: 600, color: '#9ca3af' }}>{player.playerName}</td>
                        {Array.from({ length: 12 }).map((_, i) => (
                          <td key={i} style={{ ...tdBase, color: '#f59e0b30', textAlign: 'center', fontSize: '0.6rem' }}>—</td>
                        ))}
                        {canEdit && (
                          <td style={{ ...tdBase, textAlign: 'center' }}>
                            <button
                              onClick={() => handleEdit(player)}
                              title={t('bearRally.addData', 'Add Data')}
                              style={{
                                background: 'none', border: '1px solid #f59e0b30', borderRadius: '4px',
                                color: '#f59e0b', cursor: 'pointer', padding: '0.1rem 0.3rem', fontSize: '0.55rem', fontWeight: 700,
                              }}
                            >
                              +
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </>
              )}
              {/* Unscored roster members */}
              {unscoredRosterMembers.length > 0 && (
                <>
                  <tr><td colSpan={canEdit ? 17 : 16} style={{ padding: '0.35rem 0.6rem 0.15rem', fontSize: '0.55rem', fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #1a1a1a' }}>
                    {t('bearRally.unscoredSection', 'Roster — No Data Yet')} ({unscoredRosterMembers.length})
                  </td></tr>
                  {unscoredRosterMembers.map((name) => {
                    const tdBase: React.CSSProperties = { padding: '0.4rem 0.15rem', fontSize: '0.72rem', borderBottom: '1px solid #1a1a1a' };
                    return (
                      <tr key={name} style={{ backgroundColor: '#0a162808' }}>
                        <td style={{ ...tdBase, color: '#4b5563', paddingLeft: '0.6rem' }}>—</td>
                        <td style={{ ...tdBase, color: '#4b5563', textAlign: 'center' }}>—</td>
                        <td style={{ ...tdBase, textAlign: 'center' }}>—</td>
                        <td style={{ ...tdBase, fontWeight: 600, color: '#6b7280' }}>{name}</td>
                        {Array.from({ length: 12 }).map((_, i) => (
                          <td key={i} style={{ ...tdBase, color: '#333', textAlign: 'center', fontSize: '0.6rem' }}>—</td>
                        ))}
                        {canEdit && (
                          <td style={{ ...tdBase, textAlign: 'center' }}>
                            <button
                              onClick={() => handleAddRosterMember(name)}
                              style={{
                                background: 'none', border: `1px solid ${ACCENT}30`, borderRadius: '4px',
                                color: ACCENT, cursor: 'pointer', padding: '0.1rem 0.3rem', fontSize: '0.55rem', fontWeight: 700,
                              }}
                            >
                              +
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary Footer */}
      <div style={{
        padding: '0.6rem 0.75rem',
        backgroundColor: '#0d0d0d',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.5rem',
      }}>
        <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>
          {incompletePlayers.length > 0
            ? t('bearRally.rankedOfTotal', '{{ranked}} ranked / {{total}} total', { ranked: rankedPlayers.length, total: players.length })
            : t('bearRally.totalPlayers', '{{count}} players', { count: players.length })}
        </span>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {(['SS', 'S', 'A', 'B', 'C', 'D'] as BearTier[]).map(tier => {
            const count = rankedPlayers.filter(p => p.tier === tier).length;
            if (count === 0) return null;
            return (
              <span key={tier} style={{
                fontSize: '0.6rem',
                color: BEAR_TIER_COLORS[tier],
                fontWeight: 700,
              }}>
                {tier}: {count}
              </span>
            );
          })}
        </div>
      </div>

      {/* Screenshot watermark */}
      <div style={{
        padding: '0.35rem 0.75rem',
        backgroundColor: '#0a0a0a',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: '0.5rem', color: '#333', fontWeight: 600, letterSpacing: '0.05em' }}>
          Kingshot Atlas • ks-atlas.com
        </span>
        {lastEditedBy && (
          <span style={{ fontSize: '0.5rem', color: '#333', fontStyle: 'italic' }}>
            {t('bearRally.lastEditedBy', 'Last edited by {{name}}', { name: lastEditedBy })}
          </span>
        )}
      </div>
    </div>
  );
};

export default BearTierTable;
