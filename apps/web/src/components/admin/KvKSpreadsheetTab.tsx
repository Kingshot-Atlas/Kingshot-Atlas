import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { registerChannel, unregisterChannel } from '../../lib/realtimeGuard';
import { useToast } from '../Toast';
import { logger } from '../../utils/logger';
import { CURRENT_KVK, HIGHEST_KINGDOM_IN_KVK } from '../../constants';
import { colors } from '../../utils/styles';
import { useAuth } from '../../contexts/AuthContext';
import SpreadsheetToolbar from './kvk-spreadsheet/SpreadsheetToolbar';
import SpreadsheetRow from './kvk-spreadsheet/SpreadsheetRow';
import { cellStyle, headerStyle } from './kvk-spreadsheet/styles';

// ── Types ──────────────────────────────────────────────────────────────────────

type ResultLetter = 'W' | 'L' | '';
type OverallResult = 'Domination' | 'Comeback' | 'Reversal' | 'Invasion' | 'Bye' | 'Pending' | '';

interface LiveEditPayload {
  edits: Array<{
    kingdomNumber: number;
    opponentKingdom: number | '';
    prepResult: ResultLetter;
    battleResult: ResultLetter;
    overallResult: OverallResult;
    isBye: boolean;
  }>;
  senderId: string;
  kvkNumber: number;
}

interface SpreadsheetRow {
  id: string;
  kingdomNumber: number | '';
  opponentKingdom: number | '';
  prepResult: ResultLetter;
  battleResult: ResultLetter;
  overallResult: OverallResult;
  isBye: boolean;
  autoCreated: boolean; // row was auto-created (not from DB)
  dirty: boolean;
  saved: boolean;
  saving: boolean;
  error: string | null;
  dbExists: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const computeOverall = (prep: ResultLetter, battle: ResultLetter): OverallResult => {
  if (!prep || !battle) return prep || battle ? 'Pending' : '';
  if (prep === 'W' && battle === 'W') return 'Domination';
  if (prep === 'L' && battle === 'W') return 'Comeback';
  if (prep === 'W' && battle === 'L') return 'Reversal';
  if (prep === 'L' && battle === 'L') return 'Invasion';
  return '';
};

const flipResult = (r: ResultLetter): ResultLetter => {
  if (r === 'W') return 'L';
  if (r === 'L') return 'W';
  return '';
};

const outcomeColor = (o: OverallResult): string => {
  switch (o) {
    case 'Domination': return '#22c55e';
    case 'Comeback': return '#3b82f6';
    case 'Reversal': return '#a855f7';
    case 'Invasion': return '#ef4444';
    case 'Bye': return '#6b7280';
    case 'Pending': return '#fbbf24';
    default: return '#4b5563';
  }
};

const resultColor = (r: ResultLetter): string => {
  if (r === 'W') return '#22c55e';
  if (r === 'L') return '#ef4444';
  return '#4b5563';
};

let rowIdCounter = 0;
const nextId = () => `row_${++rowIdCounter}_${Date.now()}`;

// ── Component ──────────────────────────────────────────────────────────────────

const KvKSpreadsheetTab: React.FC = () => {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [kvkNumber, setKvkNumber] = useState<number>(CURRENT_KVK);
  const [rows, setRows] = useState<SpreadsheetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [jumpTo, setJumpTo] = useState('');
  const [hideComplete, setHideComplete] = useState(false);
  const [maxKingdom, setMaxKingdom] = useState<string>(String(HIGHEST_KINGDOM_IN_KVK));
  const [populateLoading, setPopulateLoading] = useState(false);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const [remoteEditIds, setRemoteEditIds] = useState<Set<string>>(new Set());
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [stats, setStats] = useState({ total: 0, withResults: 0, pending: 0, byes: 0 });
  const tableRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());
  const realtimeRef = useRef<RealtimeChannel | null>(null);
  const kvkNumberRef = useRef(kvkNumber);
  kvkNumberRef.current = kvkNumber;
  // Stable session ID for broadcast dedup (persists across re-renders, unique per tab)
  const sessionIdRef = useRef(`${user?.id || 'anon'}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

  // ── Load existing data from kvk_history ────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('kvk_history')
        .select('kingdom_number, opponent_kingdom, prep_result, battle_result, overall_result')
        .eq('kvk_number', kvkNumber)
        .order('kingdom_number', { ascending: true });

      if (error) throw error;

      const loaded: SpreadsheetRow[] = (data || []).map(r => {
        const isBye = r.opponent_kingdom === 0 || r.prep_result === 'B' || r.battle_result === 'B';
        const prep = (isBye ? '' : (r.prep_result as ResultLetter)) || '';
        const battle = (isBye ? '' : (r.battle_result as ResultLetter)) || '';
        return {
          id: nextId(),
          kingdomNumber: r.kingdom_number,
          opponentKingdom: isBye ? '' : (r.opponent_kingdom ?? ''),
          prepResult: prep,
          battleResult: battle,
          overallResult: isBye ? 'Bye' : (computeOverall(prep, battle) || (r.overall_result as OverallResult) || ''),
          isBye,
          autoCreated: false,
          dirty: false,
          saved: true,
          saving: false,
          error: null,
          dbExists: true,
        };
      });

      // Restore auto-populated rows from localStorage that don't have DB entries
      const storageKey = `kvk_spreadsheet_rows_${kvkNumber}`;
      const dbKingdoms = new Set(loaded.map(r => r.kingdomNumber));
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const savedRows: Array<{ kingdomNumber: number }> = JSON.parse(saved);
          const restored: SpreadsheetRow[] = savedRows
            .filter(sr => sr.kingdomNumber && !dbKingdoms.has(sr.kingdomNumber))
            .map(sr => ({
              id: nextId(),
              kingdomNumber: sr.kingdomNumber,
              opponentKingdom: '' as number | '',
              prepResult: '' as ResultLetter,
              battleResult: '' as ResultLetter,
              overallResult: '' as OverallResult,
              isBye: false,
              autoCreated: true,
              dirty: false,
              saved: false,
              saving: false,
              error: null,
              dbExists: false,
            }));
          if (restored.length > 0) {
            loaded.push(...restored);
            loaded.sort((a, b) => {
              const an = typeof a.kingdomNumber === 'number' ? a.kingdomNumber : 99999;
              const bn = typeof b.kingdomNumber === 'number' ? b.kingdomNumber : 99999;
              return an - bn;
            });
          }
        }
      } catch { /* ignore parse errors */ }

      setRows(loaded);
      updateStats(loaded);
      showToast(`Loaded ${loaded.length} records for KvK #${kvkNumber}`, 'success');
    } catch (err) {
      logger.error('Failed to load KvK data:', err);
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }, [kvkNumber, showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Stats ──────────────────────────────────────────────────────────────────

  const updateStats = (data: SpreadsheetRow[]) => {
    setStats({
      total: data.length,
      withResults: data.filter(r => r.prepResult && r.battleResult).length,
      pending: data.filter(r => !r.isBye && (!r.prepResult || !r.battleResult)).length,
      byes: data.filter(r => r.isBye).length,
    });
  };

  // ── Flash effect for updated counterpart rows ─────────────────────────────

  const flashRow = (id: string) => {
    setFlashIds(prev => new Set(prev).add(id));
    setTimeout(() => setFlashIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    }), 800);
  };

  // ── Row manipulation ────────────────────────────────────────────────────────

  const markRemoteEdit = useCallback((id: string) => {
    setRemoteEditIds(prev => new Set(prev).add(id));
    setTimeout(() => setRemoteEditIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    }), 3000);
  }, []);

  const updateRow = (id: string, field: keyof SpreadsheetRow, value: any, _isRemote = false) => {
    setRows(prev => {
      const updated = prev.map(r => ({ ...r }));
      const idx = updated.findIndex(r => r.id === id);
      if (idx < 0) return prev;

      const row = updated[idx]!;
      (row as any)[field] = value;
      row.dirty = true;
      row.saved = false;

      // Auto-compute overall when prep/battle change
      if (field === 'prepResult' || field === 'battleResult') {
        row.overallResult = row.isBye ? 'Bye' : computeOverall(row.prepResult, row.battleResult);
      }

      // Handle bye toggle
      if (field === 'isBye') {
        if (value) {
          row.opponentKingdom = '';
          row.prepResult = '';
          row.battleResult = '';
          row.overallResult = 'Bye';
        } else {
          row.overallResult = '';
        }
      }

      // Track changed kingdoms for broadcast (populated after all modifications)
      const changedKingdoms: Array<{ kingdomNumber: number; opponentKingdom: number | ''; prepResult: ResultLetter; battleResult: ResultLetter; overallResult: OverallResult; isBye: boolean }> = [];

      // ── Bidirectional sync: update counterpart row instantly ──
      if ((field === 'prepResult' || field === 'battleResult') && row.kingdomNumber && row.opponentKingdom && !row.isBye) {
        const cpIdx = updated.findIndex(r =>
          r.id !== id &&
          r.kingdomNumber === row.opponentKingdom &&
          r.opponentKingdom === row.kingdomNumber
        );
        if (cpIdx >= 0) {
          const cp = updated[cpIdx]!;
          cp.prepResult = flipResult(row.prepResult);
          cp.battleResult = flipResult(row.battleResult);
          cp.overallResult = computeOverall(cp.prepResult, cp.battleResult);
          cp.dirty = true;
          cp.saved = false;
          flashRow(cp.id);
          if (typeof cp.kingdomNumber === 'number') {
            changedKingdoms.push({
              kingdomNumber: cp.kingdomNumber,
              opponentKingdom: cp.opponentKingdom,
              prepResult: cp.prepResult,
              battleResult: cp.battleResult,
              overallResult: cp.overallResult,
              isBye: cp.isBye,
            });
          }
        }
      }

      // When opponent changes, look for counterpart and link
      if (field === 'opponentKingdom' && row.kingdomNumber && value) {
        const cpIdx = updated.findIndex(r =>
          r.id !== id &&
          r.kingdomNumber === value &&
          (r.opponentKingdom === row.kingdomNumber || r.opponentKingdom === '')
        );
        if (cpIdx >= 0) {
          const cp = updated[cpIdx]!;
          cp.opponentKingdom = row.kingdomNumber;

          const cpHasResults = cp.prepResult || cp.battleResult;
          const rowHasResults = row.prepResult || row.battleResult;

          if (cpHasResults && !rowHasResults) {
            // Counterpart has results, current row doesn't → auto-fill current row
            row.prepResult = flipResult(cp.prepResult);
            row.battleResult = flipResult(cp.battleResult);
            row.overallResult = computeOverall(row.prepResult, row.battleResult);
          } else if (rowHasResults && !cpHasResults) {
            // Current row has results, counterpart doesn't → auto-fill counterpart
            cp.prepResult = flipResult(row.prepResult);
            cp.battleResult = flipResult(row.battleResult);
            cp.overallResult = computeOverall(cp.prepResult, cp.battleResult);
          }
          // If both have results or neither has results, just link without overwriting

          cp.dirty = true;
          cp.saved = false;
          flashRow(cp.id);
          if (typeof cp.kingdomNumber === 'number') {
            changedKingdoms.push({
              kingdomNumber: cp.kingdomNumber,
              opponentKingdom: cp.opponentKingdom,
              prepResult: cp.prepResult,
              battleResult: cp.battleResult,
              overallResult: cp.overallResult,
              isBye: cp.isBye,
            });
          }
        }
      }

      // Add current row to broadcast payload (after all modifications are applied)
      if (typeof row.kingdomNumber === 'number') {
        changedKingdoms.unshift({
          kingdomNumber: row.kingdomNumber,
          opponentKingdom: row.opponentKingdom,
          prepResult: row.prepResult,
          battleResult: row.battleResult,
          overallResult: row.overallResult,
          isBye: row.isBye,
        });
      }

      // ── Broadcast edits to other connected users (skip for remote edits) ──
      if (!_isRemote && realtimeRef.current && changedKingdoms.length > 0) {
        realtimeRef.current.send({
          type: 'broadcast',
          event: 'live-edit',
          payload: {
            edits: changedKingdoms,
            senderId: sessionIdRef.current,
            kvkNumber: kvkNumberRef.current,
          } satisfies LiveEditPayload,
        });
      }

      updateStats(updated);
      return updated;
    });
  };

  const deleteRow = (id: string) => {
    setRows(prev => {
      const filtered = prev.filter(r => r.id !== id);
      updateStats(filtered);
      return filtered;
    });
  };

  // ── Auto-populate: add rows for all kingdoms up to max ─────────────────────

  const autoPopulate = async () => {
    const max = parseInt(maxKingdom);
    if (!max || max < 1 || !supabase) return;
    setPopulateLoading(true);
    try {
      const { data, error } = await supabase
        .from('kingdoms')
        .select('kingdom_number')
        .lte('kingdom_number', max)
        .gt('kingdom_number', 0)
        .order('kingdom_number', { ascending: true });

      if (error) throw error;

      const existingKingdoms = new Set(rows.map(r => r.kingdomNumber));
      const newRows: SpreadsheetRow[] = (data || [])
        .filter(k => !existingKingdoms.has(k.kingdom_number))
        .map(k => ({
          id: nextId(),
          kingdomNumber: k.kingdom_number,
          opponentKingdom: '' as number | '',
          prepResult: '' as ResultLetter,
          battleResult: '' as ResultLetter,
          overallResult: '' as OverallResult,
          isBye: false,
          autoCreated: true,
          dirty: false,
          saved: false,
          saving: false,
          error: null,
          dbExists: false,
        }));

      if (newRows.length === 0) {
        showToast('All kingdoms already have rows', 'info');
        return;
      }

      // Persist auto-populated kingdom numbers to localStorage
      setRows(prev => {
        const merged = [...prev, ...newRows].sort((a, b) => {
          const an = typeof a.kingdomNumber === 'number' ? a.kingdomNumber : 99999;
          const bn = typeof b.kingdomNumber === 'number' ? b.kingdomNumber : 99999;
          return an - bn;
        });
        const autoKingdoms = merged
          .filter(r => r.autoCreated && typeof r.kingdomNumber === 'number')
          .map(r => ({ kingdomNumber: r.kingdomNumber }));
        try {
          localStorage.setItem(`kvk_spreadsheet_rows_${kvkNumber}`, JSON.stringify(autoKingdoms));
        } catch { /* quota */ }
        updateStats(merged);
        return merged;
      });

      showToast(`Added ${newRows.length} kingdom rows (up to K${max})`, 'success');
    } catch (err) {
      logger.error('Failed to auto-populate:', err);
      showToast('Failed to load kingdoms', 'error');
    } finally {
      setPopulateLoading(false);
    }
  };

  // ── Supabase Realtime subscription for kvk_history ────────────────────────

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    const channelName = 'kvk-spreadsheet-live';
    if (!registerChannel(channelName)) {
      logger.warn('RealtimeGuard: cannot create kvk-spreadsheet channel');
      return;
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kvk_history' },
        (payload) => {
          const rec = (payload.new || payload.old) as {
            kingdom_number?: number;
            opponent_kingdom?: number;
            kvk_number?: number;
            prep_result?: string;
            battle_result?: string;
            overall_result?: string;
          } | null;
          if (!rec || rec.kvk_number !== kvkNumberRef.current) return;

          const kn = rec.kingdom_number;
          if (!kn) return;
          const isBye = rec.opponent_kingdom === 0 || rec.prep_result === 'B';
          const prep = (isBye ? '' : (rec.prep_result as ResultLetter)) || '';
          const battle = (isBye ? '' : (rec.battle_result as ResultLetter)) || '';
          const opp: number | '' = isBye ? '' : (rec.opponent_kingdom ?? '');

          logger.info(`Realtime KvK: K${kn} ${payload.eventType}`);

          setRows(prev => {
            const updated = prev.map(r => ({ ...r }));
            const existingIdx = updated.findIndex(r => r.kingdomNumber === kn);

            if (payload.eventType === 'DELETE') {
              if (existingIdx >= 0) {
                updated[existingIdx] = { ...updated[existingIdx]!, dbExists: false, saved: false };
              }
            } else {
              const newData: Partial<SpreadsheetRow> = {
                opponentKingdom: opp,
                prepResult: prep,
                battleResult: battle,
                overallResult: isBye ? 'Bye' as OverallResult : (computeOverall(prep, battle) || (rec.overall_result as OverallResult) || ''),
                isBye,
                dbExists: true,
                saved: true,
                dirty: false,
                saving: false,
                error: null,
              };
              if (existingIdx >= 0) {
                // Only update if row is not currently being edited (not dirty)
                if (!updated[existingIdx]!.dirty) {
                  Object.assign(updated[existingIdx]!, newData);
                  flashRow(updated[existingIdx]!.id);
                }
              } else {
                // New row from another user — insert it
                const row: SpreadsheetRow = {
                  id: nextId(),
                  kingdomNumber: kn,
                  opponentKingdom: opp,
                  prepResult: prep,
                  battleResult: battle,
                  overallResult: newData.overallResult || '',
                  isBye,
                  autoCreated: false,
                  dirty: false,
                  saved: true,
                  saving: false,
                  error: null,
                  dbExists: true,
                };
                updated.push(row);
                updated.sort((a, b) => {
                  const an = typeof a.kingdomNumber === 'number' ? a.kingdomNumber : 99999;
                  const bn = typeof b.kingdomNumber === 'number' ? b.kingdomNumber : 99999;
                  return an - bn;
                });
                flashRow(row.id);
              }
            }
            updateStats(updated);
            return updated;
          });
        }
      )
      .on('broadcast', { event: 'live-edit' }, ({ payload }) => {
        const data = payload as LiveEditPayload;
        if (!data || data.senderId === sessionIdRef.current) return;
        if (data.kvkNumber !== kvkNumberRef.current) return;

        logger.info(`Live edit from remote user: ${data.edits.length} kingdom(s)`);

        setRows(prev => {
          const updated = prev.map(r => ({ ...r }));
          let changed = false;

          for (const edit of data.edits) {
            const idx = updated.findIndex(r => r.kingdomNumber === edit.kingdomNumber);
            if (idx >= 0) {
              const row = updated[idx]!;
              // Update row with remote data (don't overwrite if user is actively editing)
              if (!row.dirty) {
                row.opponentKingdom = edit.opponentKingdom;
                row.prepResult = edit.prepResult;
                row.battleResult = edit.battleResult;
                row.overallResult = edit.overallResult;
                row.isBye = edit.isBye;
                flashRow(row.id);
                markRemoteEdit(row.id);
                changed = true;
              }
            }
          }

          if (changed) updateStats(updated);
          return changed ? updated : prev;
        });
      })
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED');
        logger.info(`KvK spreadsheet realtime: ${status}`);
      });

    realtimeRef.current = channel;

    return () => {
      if (realtimeRef.current && supabase) {
        supabase.removeChannel(realtimeRef.current);
        realtimeRef.current = null;
        unregisterChannel(channelName);
      }
      setRealtimeConnected(false);
    };
  }, []); // Mount once — kvkNumberRef handles current kvk

  // ── Search / filter ───────────────────────────────────────────────────────

  const isRowComplete = (r: SpreadsheetRow) =>
    r.isBye || (r.prepResult && r.battleResult && r.opponentKingdom);

  const filteredRows = useMemo(() => {
    let result = rows;
    if (hideComplete) {
      // Keep dirty (unsaved) rows visible even if complete
      result = result.filter(r => r.dirty || !isRowComplete(r));
    }
    if (search.trim()) {
      const q = search.trim();
      result = result.filter(r =>
        String(r.kingdomNumber).includes(q) ||
        String(r.opponentKingdom).includes(q)
      );
    }
    return result;
  }, [rows, search, hideComplete]);

  const scrollToKingdom = (kingdomStr?: string) => {
    const q = (kingdomStr || jumpTo || '').trim();
    if (!q) return;
    const target = rows.find(r => String(r.kingdomNumber) === q);
    if (target) {
      const el = rowRefs.current.get(target.id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        flashRow(target.id);
      } else {
        // Row exists but may be hidden by filter — temporarily disable filters
        setHideComplete(false);
        setSearch('');
        // Re-attempt scroll after state update
        setTimeout(() => {
          const retryEl = rowRefs.current.get(target.id);
          if (retryEl) {
            retryEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            flashRow(target.id);
          }
        }, 100);
      }
    } else {
      showToast(`Kingdom ${q} not found in table`, 'info');
    }
  };

  // ── Save to Supabase ──────────────────────────────────────────────────────

  const saveRow = async (row: SpreadsheetRow) => {
    if (!supabase || !row.kingdomNumber) return;

    setRows(prev => prev.map(r => r.id === row.id ? { ...r, saving: true, error: null } : r));

    try {
      if (row.isBye) {
        const { data, error } = await supabase.rpc('submit_kvk_partial', {
          p_kingdom_number: row.kingdomNumber as number,
          p_opponent_kingdom: 0,
          p_kvk_number: kvkNumber,
          p_prep_winner: null,
          p_battle_winner: null,
          p_is_admin: true,
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      } else {
        // Save with or without opponent — use direct result params
        // When opp is null, the SQL function preserves any existing opponent from DB
        const kn = row.kingdomNumber as number;
        const opp = row.opponentKingdom ? (row.opponentKingdom as number) : null;

        // Skip saving rows with no opponent AND no results (nothing meaningful to persist)
        if (!opp && !row.prepResult && !row.battleResult) {
          setRows(prev => prev.map(r => r.id === row.id ? { ...r, saving: false, dirty: false } : r));
          return;
        }

        const { data, error } = await supabase.rpc('submit_kvk_partial', {
          p_kingdom_number: kn,
          p_opponent_kingdom: opp,
          p_kvk_number: kvkNumber,
          p_prep_winner: null,
          p_battle_winner: null,
          p_is_admin: true,
          p_prep_result_direct: row.prepResult || null,
          p_battle_result_direct: row.battleResult || null,
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      }

      // Mark saved — also mark counterpart (RPC handles both sides)
      setRows(prev => prev.map(r => {
        if (r.id === row.id) return { ...r, saving: false, saved: true, dirty: false, dbExists: true, error: null };
        if (row.kingdomNumber && row.opponentKingdom &&
            r.kingdomNumber === row.opponentKingdom && r.opponentKingdom === row.kingdomNumber) {
          return { ...r, saved: true, dirty: false, dbExists: true, error: null };
        }
        return r;
      }));
    } catch (err: any) {
      const msg = err?.message || 'Save failed';
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, saving: false, error: msg } : r));
      showToast(`K${row.kingdomNumber}: ${msg}`, 'error');
    }
  };

  const saveAllDirty = async () => {
    // Deduplicate paired rows — only save one side per matchup
    const savedPairs = new Set<string>();
    const dirtyRows = rows.filter(r => {
      if (!r.dirty || !r.kingdomNumber) return false;
      if (r.opponentKingdom) {
        const pairKey = [Math.min(r.kingdomNumber as number, r.opponentKingdom as number),
                         Math.max(r.kingdomNumber as number, r.opponentKingdom as number)].join('-');
        if (savedPairs.has(pairKey)) return false;
        savedPairs.add(pairKey);
      }
      return true;
    });

    if (dirtyRows.length === 0) {
      showToast('No changes to save', 'info');
      return;
    }

    setSaving(true);
    let success = 0;
    let failed = 0;

    for (const row of dirtyRows) {
      try {
        await saveRow(row);
        success++;
      } catch {
        failed++;
      }
    }

    setSaving(false);
    showToast(
      `Saved ${success} matchup${success !== 1 ? 's' : ''}${failed > 0 ? `, ${failed} failed` : ''}`,
      failed > 0 ? 'error' : 'success'
    );
    if (success > 0) {
      setTimeout(() => loadData(), 500);
    }
  };

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      saveAllDirty();
    }
  };

  const handleResultKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowId: string, field: 'prepResult' | 'battleResult') => {
    const key = e.key.toUpperCase();
    if (key === 'W' || key === 'L') {
      e.preventDefault();
      updateRow(rowId, field, key as ResultLetter);
    } else if (key === 'BACKSPACE' || key === 'DELETE') {
      e.preventDefault();
      updateRow(rowId, field, '' as ResultLetter);
    } else if (key === 'TAB' || key === 'ENTER' || key === 'ESCAPE') {
      // Allow default Tab/Enter/Escape behavior
    } else {
      e.preventDefault();
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const completionPct = stats.total > 0 ? Math.round((stats.withResults + stats.byes) / stats.total * 100) : 0;
  const dirtyCount = rows.filter(r => r.dirty && r.kingdomNumber).length;
  const uniqueDirtyCount = (() => {
    const pairs = new Set<string>();
    return rows.filter(r => {
      if (!r.dirty || !r.kingdomNumber) return false;
      if (r.opponentKingdom) {
        const key = [Math.min(r.kingdomNumber as number, r.opponentKingdom as number),
                     Math.max(r.kingdomNumber as number, r.opponentKingdom as number)].join('-');
        if (pairs.has(key)) return false;
        pairs.add(key);
      }
      return true;
    }).length;
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} onKeyDown={handleKeyDown}>
      {/* Header Card */}
      <SpreadsheetToolbar
        kvkNumber={kvkNumber}
        setKvkNumber={setKvkNumber}
        defaultKvk={CURRENT_KVK}
        loading={loading}
        saving={saving}
        uniqueDirtyCount={uniqueDirtyCount}
        dirtyCount={dirtyCount}
        search={search}
        setSearch={setSearch}
        jumpTo={jumpTo}
        setJumpTo={setJumpTo}
        scrollToKingdom={scrollToKingdom}
        hideComplete={hideComplete}
        setHideComplete={setHideComplete}
        maxKingdom={maxKingdom}
        setMaxKingdom={setMaxKingdom}
        populateLoading={populateLoading}
        realtimeConnected={realtimeConnected}
        stats={stats}
        completionPct={completionPct}
        filteredRowsCount={filteredRows.length}
        totalRowsCount={rows.length}
        completeRowsCount={rows.filter(r => isRowComplete(r)).length}
        loadData={loadData}
        saveAllDirty={saveAllDirty}
        autoPopulate={autoPopulate}
      />

      {/* Spreadsheet Table */}
      <div
        ref={tableRef}
        style={{
          backgroundColor: colors.cardAlt,
          borderRadius: '12px',
          border: '1px solid #2a2a2a',
          overflow: 'auto',
          maxHeight: '70vh',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#111116' }}>
            <tr>
              <th style={{ ...headerStyle, width: '40px', textAlign: 'center' }}>#</th>
              <th style={{ ...headerStyle, width: '100px' }}>Kingdom</th>
              <th style={{ ...headerStyle, width: '100px' }}>Opponent</th>
              <th style={{ ...headerStyle, width: '70px', textAlign: 'center' }}>Prep</th>
              <th style={{ ...headerStyle, width: '70px', textAlign: 'center' }}>Battle</th>
              <th style={{ ...headerStyle, width: '110px' }}>Outcome</th>
              <th style={{ ...headerStyle, width: '50px', textAlign: 'center' }}>Bye</th>
              <th style={{ ...headerStyle, width: '100px', textAlign: 'center' }}>Status</th>
              <th style={{ ...headerStyle, width: '80px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && !loading && (
              <tr>
                <td colSpan={9} style={{ ...cellStyle, textAlign: 'center', color: '#6b7280', padding: '2rem' }}>
                  {(search || hideComplete) ? 'No rows match current filters.' : 'No records yet. Use "Populate" to fill kingdoms.'}
                </td>
              </tr>
            )}
            {filteredRows.map((row, idx) => (
              <SpreadsheetRow
                key={row.id}
                row={row}
                idx={idx}
                isFlashing={flashIds.has(row.id)}
                isRemoteEditing={remoteEditIds.has(row.id)}
                updateRow={updateRow}
                handleResultKeyDown={handleResultKeyDown}
                saveRow={saveRow}
                deleteRow={deleteRow}
                rowRef={el => { if (el) rowRefs.current.set(row.id, el); }}
                resultColor={resultColor}
                outcomeColor={outcomeColor}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Tips section */}
      <div style={{
        backgroundColor: colors.cardAlt,
        borderRadius: '12px',
        padding: '1rem 1.25rem',
        border: '1px solid #2a2a2a',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>
            Tip: Type <kbd style={{ backgroundColor: '#1a1a1a', padding: '0.1rem 0.3rem', borderRadius: '3px', fontSize: '0.7rem', border: '1px solid #333' }}>W</kbd> or <kbd style={{ backgroundColor: '#1a1a1a', padding: '0.1rem 0.3rem', borderRadius: '3px', fontSize: '0.7rem', border: '1px solid #333' }}>L</kbd> in result fields. <kbd style={{ backgroundColor: '#1a1a1a', padding: '0.1rem 0.3rem', borderRadius: '3px', fontSize: '0.7rem', border: '1px solid #333' }}>Tab</kbd> to navigate. Opponent rows update with flipped results.
            Press <kbd style={{ backgroundColor: '#1a1a1a', padding: '0.1rem 0.3rem', borderRadius: '3px', fontSize: '0.7rem', border: '1px solid #333' }}>Cmd+Enter</kbd> to save all.
          </span>
          <span style={{ color: '#4b5563', fontSize: '0.7rem' }}>
            Use &ldquo;Populate&rdquo; to add kingdom rows.
          </span>
        </div>
      </div>
    </div>
  );
};

export default KvKSpreadsheetTab;
