import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { colors } from '../../utils/styles';
import { logger } from '../../utils/logger';

interface MatchupConflict {
  kingdom_number: number;
  kvk_number: number;
  opponents: number[];
  records: Array<{
    opponent_kingdom: number;
    prep_result: string | null;
    battle_result: string | null;
    overall_result: string | null;
  }>;
}

export const KvKMatchupConflictsTab: React.FC = () => {
  const [conflicts, setConflicts] = useState<MatchupConflict[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [filter, setFilter] = useState<'all' | number>('all');
  const [availableKvKs, setAvailableKvKs] = useState<number[]>([]);

  const detectConflicts = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      // Fetch all kvk_history records (paginated)
      const allData: Array<{
        kingdom_number: number;
        kvk_number: number;
        opponent_kingdom: number;
        prep_result: string | null;
        battle_result: string | null;
        overall_result: string | null;
      }> = [];
      let offset = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: batch, error } = await supabase
          .from('kvk_history')
          .select('kingdom_number, kvk_number, opponent_kingdom, prep_result, battle_result, overall_result')
          .gt('opponent_kingdom', 0) // Exclude byes
          .order('kingdom_number')
          .range(offset, offset + batchSize - 1);

        if (error) {
          logger.error('Failed to fetch kvk_history:', error);
          break;
        }
        if (!batch || batch.length === 0) {
          hasMore = false;
          continue;
        }
        allData.push(...batch);
        if (batch.length < batchSize) hasMore = false;
        offset += batchSize;
      }

      // Group by kingdom_number + kvk_number and find those with multiple distinct opponents
      const grouped = new Map<string, typeof allData>();
      const kvkSet = new Set<number>();

      for (const row of allData) {
        const key = `${row.kingdom_number}-${row.kvk_number}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(row);
        kvkSet.add(row.kvk_number);
      }

      const detected: MatchupConflict[] = [];
      for (const [, records] of grouped) {
        const uniqueOpponents = [...new Set(records.map(r => r.opponent_kingdom))];
        if (uniqueOpponents.length > 1) {
          detected.push({
            kingdom_number: records[0]!.kingdom_number,
            kvk_number: records[0]!.kvk_number,
            opponents: uniqueOpponents.sort((a, b) => a - b),
            records: records.map(r => ({
              opponent_kingdom: r.opponent_kingdom,
              prep_result: r.prep_result,
              battle_result: r.battle_result,
              overall_result: r.overall_result,
            })),
          });
        }
      }

      // Sort by kvk_number desc, then kingdom_number asc
      detected.sort((a, b) => b.kvk_number - a.kvk_number || a.kingdom_number - b.kingdom_number);

      setConflicts(detected);
      setAvailableKvKs([...kvkSet].sort((a, b) => b - a));
      setLastChecked(new Date());
    } catch (err) {
      logger.error('Matchup conflict detection failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    detectConflicts();
  }, [detectConflicts]);

  const filtered = filter === 'all' ? conflicts : conflicts.filter(c => c.kvk_number === filter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ color: '#fff', margin: 0, fontSize: '1.15rem' }}>
            ⚠️ KvK Matchup Conflicts
          </h2>
          <p style={{ color: colors.textMuted, margin: '0.25rem 0 0', fontSize: '0.8rem' }}>
            Kingdoms reported with more than 1 opponent in the same KvK
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {lastChecked && (
            <span style={{ color: colors.textMuted, fontSize: '0.7rem' }}>
              Checked {lastChecked.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={detectConflicts}
            disabled={loading}
            style={{
              padding: '0.4rem 0.8rem',
              backgroundColor: loading ? '#374151' : `${colors.primary}20`,
              color: loading ? colors.textMuted : colors.primary,
              border: `1px solid ${colors.primary}40`,
              borderRadius: '6px',
              fontSize: '0.8rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 600,
            }}
          >
            {loading ? 'Scanning...' : '🔄 Re-scan'}
          </button>
        </div>
      </div>

      {/* Summary Card */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '0.75rem',
      }}>
        <div style={{
          padding: '1rem',
          backgroundColor: colors.cardAlt,
          borderRadius: '10px',
          border: `1px solid ${conflicts.length > 0 ? `${colors.error}40` : `${colors.success}40`}`,
        }}>
          <div style={{ fontSize: '0.65rem', color: colors.textMuted, textTransform: 'uppercase', marginBottom: '0.3rem' }}>
            Conflicts Found
          </div>
          <div style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: conflicts.length > 0 ? colors.error : colors.success,
          }}>
            {conflicts.length}
          </div>
        </div>
        <div style={{
          padding: '1rem',
          backgroundColor: colors.cardAlt,
          borderRadius: '10px',
          border: `1px solid ${colors.border}`,
        }}>
          <div style={{ fontSize: '0.65rem', color: colors.textMuted, textTransform: 'uppercase', marginBottom: '0.3rem' }}>
            Affected Kingdoms
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: colors.primary }}>
            {new Set(conflicts.map(c => c.kingdom_number)).size}
          </div>
        </div>
        <div style={{
          padding: '1rem',
          backgroundColor: colors.cardAlt,
          borderRadius: '10px',
          border: `1px solid ${colors.border}`,
        }}>
          <div style={{ fontSize: '0.65rem', color: colors.textMuted, textTransform: 'uppercase', marginBottom: '0.3rem' }}>
            KvKs Affected
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: colors.orange }}>
            {new Set(conflicts.map(c => c.kvk_number)).size}
          </div>
        </div>
      </div>

      {/* Filter */}
      {availableKvKs.length > 0 && conflicts.length > 0 && (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: colors.textMuted, fontSize: '0.8rem', marginRight: '0.25rem' }}>Filter:</span>
          <button
            onClick={() => setFilter('all')}
            style={{
              padding: '0.3rem 0.6rem',
              borderRadius: '6px',
              border: `1px solid ${filter === 'all' ? colors.primary : colors.border}`,
              backgroundColor: filter === 'all' ? `${colors.primary}20` : 'transparent',
              color: filter === 'all' ? colors.primary : colors.textMuted,
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: filter === 'all' ? 600 : 400,
            }}
          >
            All ({conflicts.length})
          </button>
          {[...new Set(conflicts.map(c => c.kvk_number))].sort((a, b) => b - a).map(kvk => {
            const count = conflicts.filter(c => c.kvk_number === kvk).length;
            return (
              <button
                key={kvk}
                onClick={() => setFilter(kvk)}
                style={{
                  padding: '0.3rem 0.6rem',
                  borderRadius: '6px',
                  border: `1px solid ${filter === kvk ? colors.orange : colors.border}`,
                  backgroundColor: filter === kvk ? `${colors.orange}20` : 'transparent',
                  color: filter === kvk ? colors.orange : colors.textMuted,
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: filter === kvk ? 600 : 400,
                }}
              >
                KvK #{kvk} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Conflicts List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: colors.textMuted }}>
          Scanning all KvK matchups for conflicts...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          color: colors.textMuted,
          backgroundColor: colors.cardAlt,
          borderRadius: '12px',
          border: `1px solid ${colors.success}30`,
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
          <p style={{ fontSize: '0.9rem', color: colors.success, fontWeight: 600 }}>No matchup conflicts detected</p>
          <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
            All kingdoms have at most 1 opponent per KvK.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filtered.map((conflict, i) => (
            <div
              key={`${conflict.kingdom_number}-${conflict.kvk_number}-${i}`}
              style={{
                backgroundColor: colors.cardAlt,
                borderRadius: '10px',
                padding: '1rem',
                border: `1px solid ${colors.error}30`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ color: colors.primary, fontWeight: 600, fontSize: '0.95rem' }}>
                  Kingdom {conflict.kingdom_number}
                </span>
                <span style={{
                  padding: '0.15rem 0.5rem',
                  borderRadius: '9999px',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  backgroundColor: `${colors.error}20`,
                  color: colors.error,
                }}>
                  KvK #{conflict.kvk_number} — {conflict.opponents.length} opponents
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {conflict.records.map((rec, j) => (
                  <div
                    key={j}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.4rem 0.6rem',
                      backgroundColor: '#0a0a0f',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                    }}
                  >
                    <span style={{ color: '#fff', fontWeight: 600, minWidth: '80px' }}>
                      vs K{rec.opponent_kingdom}
                    </span>
                    <span style={{ color: colors.textMuted }}>
                      Prep: <span style={{ color: rec.prep_result === 'W' ? colors.success : rec.prep_result === 'L' ? colors.error : colors.textMuted }}>
                        {rec.prep_result || '—'}
                      </span>
                    </span>
                    <span style={{ color: colors.textMuted }}>
                      Battle: <span style={{ color: rec.battle_result === 'W' ? colors.success : rec.battle_result === 'L' ? colors.error : colors.textMuted }}>
                        {rec.battle_result || '—'}
                      </span>
                    </span>
                    <span style={{ color: colors.textMuted }}>
                      Result: <span style={{ color: rec.overall_result?.includes('Win') ? colors.success : colors.error }}>
                        {rec.overall_result || '—'}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: colors.textMuted }}>
                Investigate and remove the incorrect matchup(s) from the database.
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default KvKMatchupConflictsTab;
