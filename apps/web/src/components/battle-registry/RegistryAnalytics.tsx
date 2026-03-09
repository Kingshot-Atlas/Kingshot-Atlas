import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { colors } from '../../utils/styles';
import {
  BattleRegistryEntry,
  TIME_SLOTS, TROOP_TYPES, TROOP_LABELS, TROOP_COLORS,
  TroopType,
} from './types';
import { getEntryTimeSlots } from './useBattleRegistry';

// Sort: tier desc → TG desc → alliance alpha → username alpha
function sortPlayers(a: BattleRegistryEntry, b: BattleRegistryEntry): number {
  const maxTier = (e: BattleRegistryEntry) => Math.max(e.infantry_tier ?? 0, e.cavalry_tier ?? 0, e.archers_tier ?? 0);
  const maxTg = (e: BattleRegistryEntry) => Math.max(e.infantry_tg ?? -1, e.cavalry_tg ?? -1, e.archers_tg ?? -1);
  const ta = maxTier(a), tb = maxTier(b);
  if (ta !== tb) return tb - ta;
  const ga = maxTg(a), gb = maxTg(b);
  if (ga !== gb) return gb - ga;
  const ac = a.alliance_tag.localeCompare(b.alliance_tag);
  if (ac !== 0) return ac;
  return a.username.localeCompare(b.username);
}

// Hourly frames for time distribution
const HOURLY_FRAMES = [
  { label: '12:00 – 13:00', slots: [0, 1] },
  { label: '13:00 – 14:00', slots: [2, 3] },
  { label: '14:00 – 15:00', slots: [4, 5] },
  { label: '15:00 – 16:00', slots: [6, 7] },
  { label: '16:00 – 17:00', slots: [8, 9] },
];

// Parse "T11/TG8" → { tier: 11, tg: 8 } or "T9" → { tier: 9, tg: -1 }
function parseTroopCombo(label: string): { tier: number; tg: number } {
  const m = label.match(/^T(\d+)(?:\/TG(\d+))?$/);
  if (!m) return { tier: 0, tg: -1 };
  return { tier: parseInt(m[1] ?? '0', 10), tg: m[2] != null ? parseInt(m[2], 10) : -1 };
}

function sortCombosDesc(a: string, b: string): number {
  const pa = parseTroopCombo(a);
  const pb = parseTroopCombo(b);
  if (pa.tier !== pb.tier) return pb.tier - pa.tier;
  return pb.tg - pa.tg;
}

interface RegistryAnalyticsProps {
  entries: BattleRegistryEntry[];
  isMobile: boolean;
  cardStyle: React.CSSProperties;
}

const RegistryAnalytics: React.FC<RegistryAnalyticsProps> = ({ entries, isMobile, cardStyle }) => {
  const { t } = useTranslation();
  const [expandedTroopCombos, setExpandedTroopCombos] = useState<Set<string>>(new Set());
  const [expandedTimeFrames, setExpandedTimeFrames] = useState<Set<string>>(new Set());
  const [expandedAlliances, setExpandedAlliances] = useState<Set<string>>(new Set());

  // Helper: get slot indices an entry covers
  const getEntrySlotIndices = (e: BattleRegistryEntry): Set<number> => {
    const indices = new Set<number>();
    getEntryTimeSlots(e).forEach(range => {
      const fi = TIME_SLOTS.indexOf(range.from), ti = TIME_SLOTS.indexOf(range.to);
      for (let i = (fi >= 0 ? fi : 0); i < (ti >= fi ? ti : fi + 1); i++) indices.add(i);
    });
    return indices;
  };

  // Hourly frame distribution + players
  const hourlyData = useMemo(() => {
    return HOURLY_FRAMES.map(frame => {
      const players: BattleRegistryEntry[] = [];
      entries.forEach(e => {
        const covered = getEntrySlotIndices(e);
        if (frame.slots.some(si => covered.has(si))) players.push(e);
      });
      players.sort(sortPlayers);
      return { ...frame, count: players.length, players };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  const maxHourlyCount = useMemo(() => Math.max(1, ...hourlyData.map(h => h.count)), [hourlyData]);

  // Players per alliance
  const alliancePlayers = useMemo(() => {
    const map: Record<string, BattleRegistryEntry[]> = {};
    entries.forEach(e => {
      if (!map[e.alliance_tag]) map[e.alliance_tag] = [];
      map[e.alliance_tag]!.push(e);
    });
    Object.values(map).forEach(arr => arr.sort(sortPlayers));
    return map;
  }, [entries]);

  // Troop distribution with players per combo (merged roster)
  const troopDistribution = useMemo(() => {
    const dist: Record<TroopType, { combos: { label: string; count: number; players: BattleRegistryEntry[] }[]; total: number }> = {
      infantry: { combos: [], total: 0 },
      cavalry: { combos: [], total: 0 },
      archers: { combos: [], total: 0 },
    };
    entries.forEach(e => {
      TROOP_TYPES.forEach(type => {
        const tier = e[`${type}_tier` as keyof BattleRegistryEntry] as number | null;
        if (tier != null) dist[type].total++;
      });
    });
    TROOP_TYPES.forEach(type => {
      const comboMap: Record<string, BattleRegistryEntry[]> = {};
      entries.forEach(e => {
        const tier = e[`${type}_tier` as keyof BattleRegistryEntry] as number | null;
        const tg = e[`${type}_tg` as keyof BattleRegistryEntry] as number | null;
        if (tier != null) {
          const label = tg != null ? `T${tier}/TG${tg}` : `T${tier}`;
          if (!comboMap[label]) comboMap[label] = [];
          comboMap[label].push(e);
        }
      });
      dist[type].combos = Object.entries(comboMap)
        .map(([label, players]) => {
          players.sort(sortPlayers);
          return { label, count: players.length, players };
        })
        .sort((a, b) => sortCombosDesc(a.label, b.label));
    });
    return dist;
  }, [entries]);

  const allianceDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    entries.forEach(e => { dist[e.alliance_tag] = (dist[e.alliance_tag] || 0) + 1; });
    return Object.entries(dist).sort((a, b) => b[1] - a[1]);
  }, [entries]);

  const toggleTroopCombo = (key: string) => {
    setExpandedTroopCombos(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleExpandAllTime = () => {
    const all = hourlyData.filter(h => h.count > 0).map(h => h.label);
    setExpandedTimeFrames(prev => prev.size >= all.length ? new Set() : new Set(all));
  };
  const toggleExpandAllTroops = () => {
    const all = TROOP_TYPES.flatMap(type => troopDistribution[type].combos.map(c => `${type}-${c.label}`));
    setExpandedTroopCombos(prev => prev.size >= all.length ? new Set() : new Set(all));
  };
  const toggleExpandAllAlliances = () => {
    const all = allianceDistribution.map(([tag]) => tag);
    setExpandedAlliances(prev => prev.size >= all.length ? new Set() : new Set(all));
  };

  return (
    <>
      {/* ─── Time Availability Distribution (hourly frames, collapsible) ── */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <h3 style={{ color: colors.text, fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>🕐 {t('battleRegistry.timeDistribution', 'Time Availability Distribution')}</h3>
          {entries.length > 0 && (
            <button onClick={toggleExpandAllTime} style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', border: `1px solid ${colors.border}`, backgroundColor: 'transparent', color: colors.textMuted, fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer', minHeight: '32px' }}>
              {expandedTimeFrames.size > 0 ? t('battleRegistry.collapseAll', 'Collapse All') : t('battleRegistry.expandAll', 'Expand All')}
            </button>
          )}
        </div>
        {entries.length === 0 ? (
          <p style={{ color: colors.textMuted, fontSize: '0.8rem' }}>{t('battleRegistry.noEntriesYet', 'No registrations yet.')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {hourlyData.map((frame, fi) => {
              const pct = maxHourlyCount > 0 ? (frame.count / maxHourlyCount) * 100 : 0;
              const isExpanded = expandedTimeFrames.has(frame.label);
              return (
                <div key={fi}>
                  <button
                    onClick={() => { if (frame.count > 0) setExpandedTimeFrames(prev => { const n = new Set(prev); if (n.has(frame.label)) n.delete(frame.label); else n.add(frame.label); return n; }); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.5rem',
                      borderRadius: '6px', border: `1px solid ${isExpanded ? '#22c55e30' : 'transparent'}`,
                      backgroundColor: isExpanded ? '#22c55e08' : 'transparent',
                      cursor: frame.count > 0 ? 'pointer' : 'default', transition: 'all 0.15s',
                    }}
                  >
                    {frame.count > 0 && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5"
                        style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }}>
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    )}
                    <span style={{ color: colors.textSecondary, fontSize: '0.75rem', fontWeight: 600, width: '100px', textAlign: 'right', flexShrink: 0 }}>{frame.label}</span>
                    <div style={{ flex: 1, height: '20px', backgroundColor: colors.bg, borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, backgroundColor: frame.count > 0 ? '#22c55e' : 'transparent', borderRadius: '4px', transition: 'width 0.3s ease', minWidth: frame.count > 0 ? '2px' : '0' }} />
                    </div>
                    <span style={{ color: frame.count > 0 ? '#22c55e' : colors.textMuted, fontSize: '0.75rem', fontWeight: 600, width: '24px', textAlign: 'right', flexShrink: 0 }}>{frame.count}</span>
                  </button>
                  {/* Expanded table: #, Alliance, Username, Troop Tier/TG */}
                  {isExpanded && frame.players.length > 0 && (
                    <div style={{ padding: '0.3rem 0 0.3rem 1.2rem', overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                        <tbody>
                          {frame.players.map((p, pi) => {
                            const maxT = Math.max(p.infantry_tier ?? 0, p.cavalry_tier ?? 0, p.archers_tier ?? 0);
                            const maxTg = Math.max(p.infantry_tg ?? -1, p.cavalry_tg ?? -1, p.archers_tg ?? -1);
                            return (
                              <tr key={p.id}>
                                <td style={{ padding: '0.2rem 0.3rem', color: colors.textMuted, textAlign: 'center', width: '28px', fontSize: '0.65rem' }}>{pi + 1}</td>
                                <td style={{ padding: '0.2rem 0.3rem', color: '#a855f7', fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap' }}>[{p.alliance_tag}]</td>
                                <td style={{ padding: '0.2rem 0.3rem', color: colors.text, textAlign: 'left' }}>{p.username}</td>
                                <td style={{ padding: '0.2rem 0.3rem', color: colors.textMuted, textAlign: 'center', fontSize: '0.65rem', whiteSpace: 'nowrap' }}>
                                  {maxT > 0 ? `T${maxT}${maxTg >= 0 ? `/TG${maxTg}` : ''}` : '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Troop Level Distribution (expandable bars with players) ─── */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <h3 style={{ color: colors.text, fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>🗡️ {t('battleRegistry.troopDistribution', 'Troop Level Distribution')}</h3>
          {entries.length > 0 && (
            <button onClick={toggleExpandAllTroops} style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', border: `1px solid ${colors.border}`, backgroundColor: 'transparent', color: colors.textMuted, fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer', minHeight: '32px' }}>
              {expandedTroopCombos.size > 0 ? t('battleRegistry.collapseAll', 'Collapse All') : t('battleRegistry.expandAll', 'Expand All')}
            </button>
          )}
        </div>
        {entries.length === 0 ? (
          <p style={{ color: colors.textMuted, fontSize: '0.8rem' }}>{t('battleRegistry.noEntriesYet', 'No registrations yet.')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {TROOP_TYPES.map(type => {
              const data = troopDistribution[type];
              if (data.total === 0) return null;
              const maxComboCount = Math.max(1, ...data.combos.map(c => c.count));
              return (
                <div key={type} style={{ padding: '0.75rem', borderRadius: '8px', backgroundColor: `${TROOP_COLORS[type]}06`, border: `1px solid ${TROOP_COLORS[type]}20` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: TROOP_COLORS[type], fontSize: '0.85rem', fontWeight: 700 }}>{TROOP_LABELS[type]}</span>
                    <span style={{ color: colors.textMuted, fontSize: '0.7rem' }}>{data.total} {t('battleRegistry.players', 'players')}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {data.combos.map(combo => {
                      const comboKey = `${type}-${combo.label}`;
                      const isExpanded = expandedTroopCombos.has(comboKey);
                      return (
                        <div key={comboKey}>
                          <button
                            onClick={() => toggleTroopCombo(comboKey)}
                            style={{
                              width: '100%', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.5rem',
                              borderRadius: '6px', border: `1px solid ${isExpanded ? TROOP_COLORS[type] + '30' : 'transparent'}`,
                              backgroundColor: isExpanded ? `${TROOP_COLORS[type]}08` : 'transparent',
                              cursor: 'pointer', transition: 'all 0.15s',
                            }}
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={TROOP_COLORS[type]} strokeWidth="2.5"
                              style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }}>
                              <path d="M9 18l6-6-6-6" />
                            </svg>
                            <span style={{ color: colors.textSecondary, fontSize: '0.7rem', width: isMobile ? '60px' : '70px', textAlign: 'right', flexShrink: 0, fontWeight: 600 }}>{combo.label}</span>
                            <div style={{ flex: 1, height: '14px', backgroundColor: colors.bg, borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${(combo.count / maxComboCount) * 100}%`, backgroundColor: TROOP_COLORS[type], borderRadius: '3px', opacity: 0.7, minWidth: '2px' }} />
                            </div>
                            <span style={{ color: TROOP_COLORS[type], fontSize: '0.7rem', fontWeight: 600, width: '18px', textAlign: 'right', flexShrink: 0 }}>{combo.count}</span>
                          </button>
                          {/* Expanded table: #, Alliance, Username, Time Slots */}
                          {isExpanded && (
                            <div style={{ padding: '0.25rem 0 0.25rem 1.2rem', overflowX: 'auto' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                                <tbody>
                                  {combo.players.map((p, pi) => {
                                    const timeLabel = getEntryTimeSlots(p).map(s => s.from === s.to ? s.from : `${s.from}–${s.to}`).join(', ');
                                    return (
                                      <tr key={p.id}>
                                        <td style={{ padding: '0.2rem 0.3rem', color: colors.textMuted, textAlign: 'center', width: '28px', fontSize: '0.65rem' }}>{pi + 1}</td>
                                        <td style={{ padding: '0.2rem 0.3rem', color: '#a855f7', fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap' }}>[{p.alliance_tag}]</td>
                                        <td style={{ padding: '0.2rem 0.3rem', color: colors.text, textAlign: 'left' }}>{p.username}</td>
                                        <td style={{ padding: '0.2rem 0.3rem', color: colors.textMuted, textAlign: 'center', fontSize: '0.65rem', whiteSpace: 'nowrap' }}>{timeLabel}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Alliance Breakdown (collapsible) ─────────────────────── */}
      {allianceDistribution.length > 0 && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h3 style={{ color: colors.text, fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>🏰 {t('battleRegistry.allianceBreakdown', 'Alliance Breakdown')}</h3>
            <button onClick={toggleExpandAllAlliances} style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', border: `1px solid ${colors.border}`, backgroundColor: 'transparent', color: colors.textMuted, fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer', minHeight: '32px' }}>
              {expandedAlliances.size > 0 ? t('battleRegistry.collapseAll', 'Collapse All') : t('battleRegistry.expandAll', 'Expand All')}
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {allianceDistribution.map(([tag, count]) => {
              const maxAllianceCount = allianceDistribution[0]?.[1] ?? 1;
              const pct = maxAllianceCount > 0 ? (count / maxAllianceCount) * 100 : 0;
              const isExpanded = expandedAlliances.has(tag);
              const players = alliancePlayers[tag] || [];
              return (
                <div key={tag}>
                  <button
                    onClick={() => setExpandedAlliances(prev => { const n = new Set(prev); if (n.has(tag)) n.delete(tag); else n.add(tag); return n; })}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.6rem',
                      borderRadius: '6px', border: `1px solid ${isExpanded ? '#a855f730' : 'transparent'}`,
                      backgroundColor: isExpanded ? '#a855f708' : 'transparent',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2.5"
                      style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }}>
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                    <span style={{ color: '#a855f7', fontSize: '0.8rem', fontWeight: 700, width: '40px', textAlign: 'left', flexShrink: 0, letterSpacing: '0.05em' }}>[{tag}]</span>
                    <div style={{ flex: 1, height: '20px', backgroundColor: colors.bg, borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, backgroundColor: '#a855f7', borderRadius: '4px', opacity: 0.5, transition: 'width 0.3s ease', minWidth: '2px' }} />
                    </div>
                    <span style={{ color: '#a855f7', fontSize: '0.75rem', fontWeight: 600, width: '24px', textAlign: 'right', flexShrink: 0 }}>{count}</span>
                  </button>
                  {/* Expanded table: #, Username, Troop Tier/TG, Time Slots */}
                  {isExpanded && players.length > 0 && (
                    <div style={{ padding: '0.3rem 0 0.3rem 1.2rem', overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                        <tbody>
                          {players.map((p, pi) => {
                            const maxT = Math.max(p.infantry_tier ?? 0, p.cavalry_tier ?? 0, p.archers_tier ?? 0);
                            const maxTg = Math.max(p.infantry_tg ?? -1, p.cavalry_tg ?? -1, p.archers_tg ?? -1);
                            const timeLabel = getEntryTimeSlots(p).map(s => s.from === s.to ? s.from : `${s.from}–${s.to}`).join(', ');
                            return (
                              <tr key={p.id}>
                                <td style={{ padding: '0.2rem 0.3rem', color: colors.textMuted, textAlign: 'center', width: '28px', fontSize: '0.65rem' }}>{pi + 1}</td>
                                <td style={{ padding: '0.2rem 0.3rem', color: colors.text, fontWeight: 600, textAlign: 'left' }}>{p.username}</td>
                                <td style={{ padding: '0.2rem 0.3rem', color: colors.textMuted, textAlign: 'center', fontSize: '0.65rem', whiteSpace: 'nowrap' }}>
                                  {maxT > 0 ? `T${maxT}${maxTg >= 0 ? `/TG${maxTg}` : ''}` : '—'}
                                </td>
                                <td style={{ padding: '0.2rem 0.3rem', color: colors.textMuted, textAlign: 'center', fontSize: '0.65rem', whiteSpace: 'nowrap' }}>{timeLabel}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
};

export default RegistryAnalytics;
