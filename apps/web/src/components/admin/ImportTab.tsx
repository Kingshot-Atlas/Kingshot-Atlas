import React, { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../Toast';
import { kingdomKeys } from '../../hooks/useKingdoms';
import { apiService } from '../../services/api';
import { kvkHistoryService } from '../../services/kvkHistoryService';
import { supabase } from '../../lib/supabase';
import { colors } from '../../utils/styles';
import { logger } from '../../utils/logger';

// Helper to create empty kingdom records
const createEmptyKingdom = (kingdomNumber: number) => ({
  kingdom_number: kingdomNumber,
  total_kvks: 0,
  prep_wins: 0,
  prep_losses: 0,
  prep_win_rate: 0,
  prep_streak: 0,
  prep_loss_streak: 0,
  prep_best_streak: 0,
  battle_wins: 0,
  battle_losses: 0,
  battle_win_rate: 0,
  battle_streak: 0,
  battle_loss_streak: 0,
  battle_best_streak: 0,
  dominations: 0,
  reversals: 0,
  comebacks: 0,
  invasions: 0,
  atlas_score: 0,
  most_recent_status: 'Unannounced',
  last_updated: new Date().toISOString()
});

interface ImportHistoryEntry {
  id: string;
  admin_username: string;
  total_rows: number;
  inserted_rows: number;
  replaced_rows: number;
  skipped_rows: number;
  kingdoms_created: number;
  kvk_numbers: number[];
  validation_errors: number;
  created_at: string;
}

const ImportTab: React.FC = () => {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [importData, setImportData] = useState('');
  const [importStep, setImportStep] = useState<'input' | 'preview' | 'duplicates' | 'importing'>('input');
  const [parsedRecords, setParsedRecords] = useState<Array<Record<string, unknown>>>([]);
  const [validationErrors, setValidationErrors] = useState<Array<{ row: number; field: string; value: string; message: string }>>([]);
  const [duplicateRows, setDuplicateRows] = useState<Array<{ existing: Record<string, unknown>; incoming: Record<string, unknown>; action: 'replace' | 'skip' }>>([]);
  const [newRows, setNewRows] = useState<Array<Record<string, unknown>>>([]);
  const [importProcessing, setImportProcessing] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; phase: string }>({ current: 0, total: 0, phase: '' });
  const [importHistory, setImportHistory] = useState<ImportHistoryEntry[]>([]);
  const [missingKingdomsForImport, setMissingKingdomsForImport] = useState<number[]>([]);
  const [recalculating, setRecalculating] = useState(false);
  const [recalcResult, setRecalcResult] = useState<{ updated: number; avgScore: number; ranksFixed: number } | null>(null);

  // Fetch import history on mount
  useEffect(() => {
    fetchImportHistory();
  }, []);

  const fetchImportHistory = async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from('import_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) setImportHistory(data);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setImportData(event.target?.result as string || '');
    };
    reader.readAsText(file);
  };

  // Step 1: Parse & Validate CSV → show preview
  const handleParseAndPreview = () => {
    if (!importData.trim()) {
      showToast('Please paste CSV data', 'error');
      return;
    }
    const lines = importData.trim().split('\n');
    if (lines.length < 2) {
      showToast('CSV must have header and at least one data row', 'error');
      return;
    }
    const headers = lines[0]?.split(',').map(h => h.trim().toLowerCase()) || [];

    const hasOpponentCol = headers.includes('opponent_kingdom') || headers.includes('opponent_number');
    const requiredCols = ['kingdom_number', 'kvk_number', 'prep_result', 'battle_result', 'overall_result', 'kvk_date'];
    const missingCols = requiredCols.filter(col => !headers.includes(col));
    if (!hasOpponentCol) missingCols.push('opponent_kingdom');
    if (missingCols.length > 0) {
      showToast(`Missing columns: ${missingCols.join(', ')}`, 'error');
      return;
    }

    const opponentHeader = headers.includes('opponent_kingdom') ? 'opponent_kingdom' : 'opponent_number';
    const rawRecords = lines.slice(1).filter(line => line.trim()).map(line => {
      const values = line.split(',');
      const record: Record<string, string> = {};
      headers.forEach((h, i) => record[h] = values[i]?.trim() || '');
      return record;
    });

    const errors: Array<{ row: number; field: string; value: string; message: string }> = [];
    const validResults = ['W', 'L', 'B'];
    const validOutcomes = ['DOMINATION', 'INVASION', 'COMEBACK', 'REVERSAL', 'BYE'];

    const kvkRecords = rawRecords.map((r, idx) => {
      const rowNum = idx + 2;
      const kn = parseInt(r.kingdom_number || '0', 10);
      const kvk = parseInt(r.kvk_number || '0', 10);
      const opp = parseInt(r[opponentHeader] || '0', 10);
      const prep = r.prep_result?.toUpperCase() || '';
      const battle = r.battle_result?.toUpperCase() || '';
      const overall = r.overall_result || '';
      const date = r.kvk_date || '';
      const isBye = overall.toUpperCase() === 'BYE' || (opp === 0 && prep === 'B' && battle === 'B');

      if (!kn || kn <= 0) errors.push({ row: rowNum, field: 'kingdom_number', value: r.kingdom_number || '', message: 'Must be a positive integer' });
      if (!kvk || kvk <= 0) errors.push({ row: rowNum, field: 'kvk_number', value: r.kvk_number || '', message: 'Must be a positive integer' });
      if (!isBye && opp <= 0) errors.push({ row: rowNum, field: opponentHeader, value: r[opponentHeader] || '', message: 'Must be a positive integer (or 0 for Bye)' });
      if (!validResults.includes(prep)) errors.push({ row: rowNum, field: 'prep_result', value: prep, message: `Must be W, L, or B (got "${prep}")` });
      if (!validResults.includes(battle)) errors.push({ row: rowNum, field: 'battle_result', value: battle, message: `Must be W, L, or B (got "${battle}")` });
      if (!validOutcomes.includes(overall.toUpperCase()) && overall) errors.push({ row: rowNum, field: 'overall_result', value: overall, message: `Expected Domination/Invasion/Comeback/Reversal/Bye` });
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push({ row: rowNum, field: 'kvk_date', value: date, message: 'Must be YYYY-MM-DD format' });

      return {
        kingdom_number: kn,
        kvk_number: kvk,
        opponent_kingdom: opp,
        prep_result: prep || null,
        battle_result: battle || null,
        overall_result: overall || null,
        kvk_date: date || null,
        order_index: r.order_index ? parseInt(r.order_index, 10) : kvk
      };
    });

    setValidationErrors(errors);
    setParsedRecords(kvkRecords);
    setImportStep('preview');
    if (errors.length > 0) {
      showToast(`${errors.length} validation issue(s) found — review highlighted rows`, 'error');
    }
  };

  // Step 2: Check duplicates and proceed
  const handleCheckDuplicates = async () => {
    if (!supabase) return;
    const validRecords = parsedRecords.filter(r => (r.kingdom_number as number) > 0 && (r.kvk_number as number) > 0);
    if (validRecords.length === 0) {
      showToast('No valid rows to import after filtering errors', 'error');
      return;
    }

    setImportProcessing(true);
    try {
      const allKingdomNumbers = new Set<number>();
      validRecords.forEach(r => {
        if ((r.kingdom_number as number) > 0) allKingdomNumbers.add(r.kingdom_number as number);
        if ((r.opponent_kingdom as number) > 0) allKingdomNumbers.add(r.opponent_kingdom as number);
      });

      const { data: existingKingdoms } = await supabase
        .from('kingdoms')
        .select('kingdom_number')
        .in('kingdom_number', Array.from(allKingdomNumbers));
      const existingSet = new Set((existingKingdoms || []).map(k => k.kingdom_number));
      const missingKingdoms = Array.from(allKingdomNumbers).filter(kn => !existingSet.has(kn));
      setMissingKingdomsForImport(missingKingdoms);

      const uniqueKvkNumbers = [...new Set(validRecords.map(r => r.kvk_number as number))];
      const uniqueKingdomNumbers = [...new Set(validRecords.map(r => r.kingdom_number as number))];

      const { data: existingRows } = await supabase
        .from('kvk_history')
        .select('*')
        .in('kingdom_number', uniqueKingdomNumbers)
        .in('kvk_number', uniqueKvkNumbers);

      const existingMap = new Map<string, Record<string, unknown>>();
      (existingRows || []).forEach(row => {
        existingMap.set(`${row.kingdom_number}-${row.kvk_number}`, row);
      });

      const freshRows: Record<string, unknown>[] = [];
      const dupes: Array<{ existing: Record<string, unknown>; incoming: Record<string, unknown>; action: 'replace' | 'skip' }> = [];

      validRecords.forEach(r => {
        const key = `${r.kingdom_number}-${r.kvk_number}`;
        const existing = existingMap.get(key);
        if (existing) {
          dupes.push({ existing, incoming: r, action: 'skip' });
        } else {
          freshRows.push(r);
        }
      });

      setNewRows(freshRows);
      setDuplicateRows(dupes);

      if (dupes.length > 0) {
        setImportStep('duplicates');
        showToast(`Found ${dupes.length} duplicate row(s). Review below.`, 'info');
      } else {
        await executeImport(freshRows, [], missingKingdoms);
      }
    } catch (error) {
      logger.error('Duplicate check error:', error);
      showToast('Error checking for duplicates', 'error');
    } finally {
      setImportProcessing(false);
    }
  };

  const handleConfirmImport = async () => {
    const rowsToReplace = duplicateRows.filter(d => d.action === 'replace').map(d => d.incoming);
    const skippedCount = duplicateRows.filter(d => d.action === 'skip').length;
    await executeImport(newRows, rowsToReplace, missingKingdomsForImport, skippedCount);
  };

  const executeImport = async (freshRows: Record<string, unknown>[], replaceRows: Record<string, unknown>[], missingKingdoms: number[], skippedCount = 0) => {
    if (!supabase) return;
    setImportStep('importing');
    setImportProcessing(true);
    const totalOps = freshRows.length + replaceRows.length + (missingKingdoms.length > 0 ? 1 : 0);
    let completedOps = 0;

    try {
      // Phase 1: Auto-create missing kingdoms
      if (missingKingdoms.length > 0) {
        setImportProgress({ current: 0, total: totalOps, phase: `Creating ${missingKingdoms.length} missing kingdoms...` });
        const batchSize = 200;
        for (let i = 0; i < missingKingdoms.length; i += batchSize) {
          const batch = missingKingdoms.slice(i, i + batchSize).map(kn => createEmptyKingdom(kn));
          const { error: createError } = await supabase
            .from('kingdoms')
            .upsert(batch, { onConflict: 'kingdom_number' });
          if (createError) {
            logger.error('Failed to create missing kingdoms:', createError);
            showToast(`Warning: Could not create some missing kingdoms`, 'error');
          }
        }
        completedOps++;
        setImportProgress({ current: completedOps, total: totalOps, phase: 'Kingdoms created' });
      }

      let insertedCount = 0;
      let replacedCount = 0;
      const batchSize = 50;

      // Disable expensive triggers during bulk insert
      setImportProgress({ current: completedOps, total: totalOps, phase: 'Preparing bulk insert...' });
      const { error: disableErr } = await supabase.rpc('disable_kvk_triggers');
      if (disableErr) logger.error('Could not disable triggers (non-fatal):', disableErr);

      // Phase 2: Insert fresh rows in batches
      if (freshRows.length > 0) {
        setImportProgress({ current: completedOps, total: totalOps, phase: `Inserting ${freshRows.length} new rows...` });
        for (let i = 0; i < freshRows.length; i += batchSize) {
          const batch = freshRows.slice(i, i + batchSize);
          const { error } = await supabase.from('kvk_history').insert(batch);
          if (error) {
            logger.error('Insert error:', error);
            await supabase.rpc('enable_kvk_triggers');
            showToast(`Insert failed at row ${i + 1}: ${error.message}`, 'error');
            setImportProcessing(false);
            return;
          }
          insertedCount += batch.length;
          completedOps += batch.length;
          setImportProgress({ current: completedOps, total: totalOps, phase: `Inserted ${insertedCount}/${freshRows.length} new rows...` });
        }
      }

      // Phase 3: Upsert replacement rows in batches
      if (replaceRows.length > 0) {
        setImportProgress({ current: completedOps, total: totalOps, phase: `Replacing ${replaceRows.length} existing rows...` });
        for (let i = 0; i < replaceRows.length; i += batchSize) {
          const batch = replaceRows.slice(i, i + batchSize);
          const { error } = await supabase
            .from('kvk_history')
            .upsert(batch, { onConflict: 'kingdom_number,kvk_number', ignoreDuplicates: false });
          if (error) {
            logger.error('Upsert error:', error);
            await supabase.rpc('enable_kvk_triggers');
            showToast(`Replace failed at row ${i + 1}: ${error.message}`, 'error');
            setImportProcessing(false);
            return;
          }
          replacedCount += batch.length;
          completedOps += batch.length;
          setImportProgress({ current: completedOps, total: totalOps, phase: `Replaced ${replacedCount}/${replaceRows.length} rows...` });
        }
      }

      // Re-enable triggers before recalc phases
      const { error: enableErr } = await supabase.rpc('enable_kvk_triggers');
      if (enableErr) logger.error('Could not re-enable triggers:', enableErr);

      // Phase 4: Log to import_history
      const kvkNums = [...new Set([...freshRows, ...replaceRows].map(r => r.kvk_number as number))];
      await supabase.from('import_history').insert({
        admin_user_id: user?.id,
        admin_username: profile?.username || 'unknown',
        total_rows: freshRows.length + replaceRows.length + skippedCount,
        inserted_rows: insertedCount,
        replaced_rows: replacedCount,
        skipped_rows: skippedCount,
        kingdoms_created: missingKingdoms.length,
        kvk_numbers: kvkNums,
        validation_errors: validationErrors.length
      });

      // Phase 5: Auto-recalculate scores for affected kingdoms
      setImportProgress({ current: completedOps, total: totalOps, phase: 'Recalculating Atlas Scores...' });
      const { data: recalcData, error: recalcError } = await supabase.rpc('recalculate_all_kingdom_scores');
      const recalcUpdated = recalcError ? 0 : (recalcData?.[0]?.updated_count ?? 0);
      if (recalcError) logger.error('Auto-recalc error (non-fatal):', recalcError);

      // Phase 6: Auto-backfill score_history via edge function
      let backfillCreated = 0;
      for (const kvk of kvkNums) {
        setImportProgress({ current: completedOps, total: totalOps, phase: `Backfilling score history for KvK #${kvk}...` });
        const { data: bfData, error: bfError } = await supabase.functions.invoke('backfill-score-history', {
          body: { kvk_number: kvk }
        });
        if (bfError) {
          logger.error(`Backfill error for KvK #${kvk} (non-fatal):`, bfError);
        } else {
          backfillCreated += bfData?.created ?? 0;
        }
      }

      // Phase 7: Recalculate ranks via edge function
      let ranksFixed = 0;
      for (const kvk of kvkNums) {
        setImportProgress({ current: completedOps, total: totalOps, phase: `Recalculating ranks for KvK #${kvk}...` });
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
          const { data: rankData, error: rankError } = await supabase.functions.invoke('backfill-score-history', {
            body: { kvk_number: kvk, action: 'recalculate_ranks', offset }
          });
          if (rankError) {
            logger.error(`Rank recalc error for KvK #${kvk} (non-fatal):`, rankError);
            hasMore = false;
          } else {
            ranksFixed += rankData?.updated ?? 0;
            hasMore = rankData?.has_more ?? false;
            offset = rankData?.next_offset ?? 0;
          }
        }
      }

      // Reload caches
      kvkHistoryService.invalidateCache();
      apiService.reloadData();
      queryClient.invalidateQueries({ queryKey: kingdomKeys.all });

      const parts: string[] = [];
      if (insertedCount > 0) parts.push(`${insertedCount} new`);
      if (replacedCount > 0) parts.push(`${replacedCount} replaced`);
      if (skippedCount > 0) parts.push(`${skippedCount} skipped`);
      const createdMsg = missingKingdoms.length > 0 ? ` (created ${missingKingdoms.length} new kingdoms)` : '';
      const recalcMsg = recalcUpdated > 0 ? ` | ${recalcUpdated} scores recalculated` : '';
      const backfillMsg = backfillCreated > 0 ? ` | ${backfillCreated} score history entries created` : '';
      const rankMsg = ranksFixed > 0 ? ` | ${ranksFixed} rank(s) fixed` : '';
      setImportProgress({ current: totalOps, total: totalOps, phase: 'Complete!' });
      showToast(`Imported ${parts.join(', ')} KvK records${createdMsg}${recalcMsg}${backfillMsg}${rankMsg}`, 'success');

      setTimeout(() => {
        setImportData('');
        setImportStep('input');
        setParsedRecords([]);
        setValidationErrors([]);
        setDuplicateRows([]);
        setNewRows([]);
        fetchImportHistory();
      }, 1500);
    } catch (error) {
      logger.error('Import error:', error);
      if (supabase) await supabase.rpc('enable_kvk_triggers');
      showToast('Import failed unexpectedly', 'error');
    } finally {
      setImportProcessing(false);
    }
  };

  const handleRecalculateScores = async () => {
    if (!supabase) return;
    setRecalculating(true);
    setRecalcResult(null);
    try {
      const { data: recalcData, error: recalcError } = await supabase.rpc('recalculate_all_kingdom_scores');
      if (recalcError) {
        logger.error('Recalc error:', recalcError);
        showToast(`Score recalculation failed: ${recalcError.message}`, 'error');
        setRecalculating(false);
        return;
      }
      const updated = recalcData?.[0]?.updated_count ?? 0;
      const avgScore = recalcData?.[0]?.avg_score ?? 0;

      const { data: rankData, error: rankError } = await supabase.rpc('verify_and_fix_rank_consistency');
      if (rankError) {
        logger.error('Rank fix error:', rankError);
        showToast(`Ranks fix failed: ${rankError.message}`, 'error');
      }
      const ranksFixed = rankData?.filter((r: Record<string, unknown>) => (r.mismatches_found as number) > 0)
        .reduce((sum: number, r: Record<string, unknown>) => sum + (r.mismatches_fixed as number || 0), 0) ?? 0;

      kvkHistoryService.invalidateCache();
      apiService.reloadData();
      queryClient.invalidateQueries({ queryKey: kingdomKeys.all });

      setRecalcResult({ updated, avgScore: parseFloat(String(avgScore)), ranksFixed });
      showToast(`Recalculated ${updated} kingdoms (avg score: ${avgScore}). ${ranksFixed} rank(s) fixed.`, 'success');
    } catch (error) {
      logger.error('Recalc error:', error);
      showToast('Score recalculation failed', 'error');
    } finally {
      setRecalculating(false);
    }
  };

  const handleBulkCreateKingdoms = async (startNum: number, endNum: number) => {
    if (!supabase) {
      showToast('Supabase not available', 'error');
      return;
    }
    
    try {
      const { data: existingKingdoms } = await supabase
        .from('kingdoms')
        .select('kingdom_number')
        .gte('kingdom_number', startNum)
        .lte('kingdom_number', endNum);
      
      const existingSet = new Set((existingKingdoms || []).map(k => k.kingdom_number));
      
      const kingdomsToCreate: ReturnType<typeof createEmptyKingdom>[] = [];
      for (let kn = startNum; kn <= endNum; kn++) {
        if (!existingSet.has(kn)) {
          kingdomsToCreate.push(createEmptyKingdom(kn));
        }
      }
      
      if (kingdomsToCreate.length === 0) {
        showToast(`All kingdoms ${startNum}-${endNum} already exist`, 'info');
        return;
      }
      
      const batchSize = 500;
      let created = 0;
      for (let i = 0; i < kingdomsToCreate.length; i += batchSize) {
        const batch = kingdomsToCreate.slice(i, i + batchSize);
        const { error } = await supabase
          .from('kingdoms')
          .upsert(batch, { onConflict: 'kingdom_number' });
        
        if (error) {
          logger.error('Batch insert error:', error);
          showToast(`Error creating kingdoms: ${error.message}`, 'error');
          return;
        }
        created += batch.length;
      }
      
      kvkHistoryService.invalidateCache();
      apiService.reloadData();
      queryClient.invalidateQueries({ queryKey: kingdomKeys.all });
      
      showToast(`✅ Created ${created} empty kingdom profiles (${startNum}-${endNum})`, 'success');
    } catch (error) {
      logger.error('Bulk create kingdoms error:', error);
      showToast('Failed to create kingdoms', 'error');
    }
  };

  return (
    <div style={{ backgroundColor: colors.cardAlt, borderRadius: '12px', padding: '1.5rem', border: `1px solid ${colors.border}` }}>
      <h3 style={{ color: colors.text, marginBottom: '0.5rem' }}>Bulk Import KvK Results</h3>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem', fontSize: '0.75rem' }}>
        {(['input', 'preview', 'duplicates', 'importing'] as const).map((step, i) => (
          <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', backgroundColor: importStep === step ? `${colors.primary}20` : 'transparent', color: importStep === step ? colors.primary : colors.textMuted, fontWeight: importStep === step ? 600 : 400, border: `1px solid ${importStep === step ? `${colors.primary}50` : colors.border}` }}>
              {i + 1}. {step === 'input' ? 'Input' : step === 'preview' ? 'Preview' : step === 'duplicates' ? 'Duplicates' : 'Import'}
            </span>
            {i < 3 && <span style={{ color: colors.border }}>→</span>}
          </div>
        ))}
      </div>

      {/* Step 1: Input */}
      {importStep === 'input' && (
        <>
          <p style={{ color: colors.textMuted, fontSize: '0.875rem', marginBottom: '0.5rem' }}>
            Required columns: <code style={{ color: colors.primary }}>kingdom_number, kvk_number, opponent_kingdom, prep_result, battle_result, overall_result, kvk_date</code>
          </p>
          <p style={{ color: colors.textMuted, fontSize: '0.75rem', marginBottom: '1rem' }}>
            Results: W/L/B. Date: YYYY-MM-DD. Also accepts <code style={{ color: colors.textMuted }}>opponent_number</code> as alias.
          </p>
          <div style={{ marginBottom: '1rem' }}>
            <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />
            <button onClick={() => fileInputRef.current?.click()} style={{ padding: '0.75rem 1.5rem', backgroundColor: `${colors.primary}20`, border: `1px solid ${colors.primary}40`, borderRadius: '8px', color: colors.primary, cursor: 'pointer', fontWeight: 500 }}>
              📁 Choose CSV File
            </button>
          </div>
          <button onClick={handleParseAndPreview} style={{ padding: '0.75rem 2rem', backgroundColor: `${colors.primary}20`, border: 'none', borderRadius: '8px', color: colors.text, fontWeight: 600, cursor: 'pointer' }}>
            Preview &amp; Validate
          </button>
        </>
      )}

      {/* Step 2: Preview */}
      {importStep === 'preview' && (
        <>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ color: colors.text, fontWeight: 600, fontSize: '0.9rem' }}>
                {parsedRecords.length} records parsed
                {validationErrors.length > 0 && (
                  <span style={{ color: colors.error, marginLeft: '0.5rem', fontSize: '0.8rem' }}>
                    ({validationErrors.length} validation issue{validationErrors.length !== 1 ? 's' : ''})
                  </span>
                )}
              </span>
              <button onClick={() => { setImportStep('input'); setParsedRecords([]); setValidationErrors([]); }} style={{ padding: '0.3rem 0.6rem', backgroundColor: 'transparent', border: `1px solid ${colors.border}`, borderRadius: '4px', color: colors.textMuted, cursor: 'pointer', fontSize: '0.7rem' }}>
                ← Back
              </button>
            </div>

            {/* Validation errors */}
            {validationErrors.length > 0 && (
              <div style={{ marginBottom: '0.75rem', padding: '0.75rem', backgroundColor: `${colors.error}10`, border: `1px solid ${colors.error}30`, borderRadius: '8px', maxHeight: '150px', overflowY: 'auto' }}>
                <div style={{ color: colors.error, fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.4rem' }}>Validation Issues:</div>
                {validationErrors.slice(0, 20).map((err, i) => (
                  <div key={i} style={{ color: colors.textSecondary, fontSize: '0.7rem', marginBottom: '0.15rem' }}>
                    Row {err.row}: <span style={{ color: colors.primary }}>{err.field}</span> = &quot;{err.value}&quot; — {err.message}
                  </div>
                ))}
                {validationErrors.length > 20 && (
                  <div style={{ color: colors.textMuted, fontSize: '0.7rem', marginTop: '0.3rem' }}>...and {validationErrors.length - 20} more</div>
                )}
              </div>
            )}

            {/* Preview table */}
            <div style={{ maxHeight: '300px', overflowY: 'auto', border: `1px solid ${colors.border}`, borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
                <thead>
                  <tr style={{ backgroundColor: colors.bg }}>
                    {['#', 'Kingdom', 'KvK', 'Opponent', 'Prep', 'Battle', 'Result', 'Date'].map(h => (
                      <th key={h} style={{ padding: '0.4rem 0.5rem', color: colors.textMuted, fontWeight: 600, textAlign: 'left', borderBottom: `1px solid ${colors.border}`, position: 'sticky', top: 0, backgroundColor: colors.bg }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsedRecords.slice(0, 100).map((r, i) => {
                    const hasError = validationErrors.some(e => e.row === i + 2);
                    return (
                      <tr key={i} style={{ backgroundColor: hasError ? `${colors.error}08` : 'transparent' }}>
                        <td style={{ padding: '0.3rem 0.5rem', color: colors.textMuted, borderBottom: `1px solid ${colors.borderSubtle}` }}>{i + 1}</td>
                        <td style={{ padding: '0.3rem 0.5rem', color: colors.primary, fontWeight: 600, borderBottom: `1px solid ${colors.borderSubtle}` }}>K{r.kingdom_number as number}</td>
                        <td style={{ padding: '0.3rem 0.5rem', color: colors.textSecondary, borderBottom: `1px solid ${colors.borderSubtle}` }}>{r.kvk_number as number}</td>
                        <td style={{ padding: '0.3rem 0.5rem', color: colors.orange, borderBottom: `1px solid ${colors.borderSubtle}` }}>K{r.opponent_kingdom as number}</td>
                        <td style={{ padding: '0.3rem 0.5rem', color: (r.prep_result as string) === 'W' ? colors.success : (r.prep_result as string) === 'L' ? colors.error : colors.textMuted, fontWeight: 600, borderBottom: `1px solid ${colors.borderSubtle}` }}>{r.prep_result as string}</td>
                        <td style={{ padding: '0.3rem 0.5rem', color: (r.battle_result as string) === 'W' ? colors.success : (r.battle_result as string) === 'L' ? colors.error : colors.textMuted, fontWeight: 600, borderBottom: `1px solid ${colors.borderSubtle}` }}>{r.battle_result as string}</td>
                        <td style={{ padding: '0.3rem 0.5rem', color: colors.textSecondary, borderBottom: `1px solid ${colors.borderSubtle}` }}>{r.overall_result as string}</td>
                        <td style={{ padding: '0.3rem 0.5rem', color: colors.textMuted, borderBottom: `1px solid ${colors.borderSubtle}` }}>{r.kvk_date as string}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {parsedRecords.length > 100 && (
                <div style={{ padding: '0.5rem', color: colors.textMuted, fontSize: '0.7rem', textAlign: 'center' }}>
                  Showing first 100 of {parsedRecords.length} rows
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleCheckDuplicates}
            disabled={importProcessing || validationErrors.length > 0}
            style={{
              padding: '0.75rem 2rem',
              backgroundColor: validationErrors.length > 0 ? colors.textMuted : colors.success,
              border: 'none',
              borderRadius: '8px',
              color: colors.text,
              fontWeight: 600,
              cursor: validationErrors.length > 0 ? 'not-allowed' : 'pointer',
              opacity: importProcessing ? 0.6 : 1,
            }}
          >
            {importProcessing ? '⏳ Checking...' : validationErrors.length > 0 ? '⚠️ Fix validation errors first' : `✓ Check Duplicates & Import (${parsedRecords.length} rows)`}
          </button>
        </>
      )}

      {/* Step 3: Duplicates */}
      {importStep === 'duplicates' && (
        <>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ color: colors.text, fontWeight: 600, fontSize: '0.9rem' }}>
                {duplicateRows.length} duplicate{duplicateRows.length !== 1 ? 's' : ''} found
                <span style={{ color: colors.textMuted, fontSize: '0.8rem', marginLeft: '0.5rem' }}>
                  + {newRows.length} new row{newRows.length !== 1 ? 's' : ''}
                </span>
              </span>
              <button onClick={() => setImportStep('preview')} style={{ padding: '0.3rem 0.6rem', backgroundColor: 'transparent', border: `1px solid ${colors.border}`, borderRadius: '4px', color: colors.textMuted, cursor: 'pointer', fontSize: '0.7rem' }}>
                ← Back
              </button>
            </div>

            {missingKingdomsForImport.length > 0 && (
              <div style={{ marginBottom: '0.75rem', padding: '0.5rem 0.75rem', backgroundColor: `${colors.blue}10`, border: `1px solid ${colors.blue}30`, borderRadius: '6px', fontSize: '0.75rem', color: colors.blue }}>
                ℹ️ {missingKingdomsForImport.length} kingdom(s) will be auto-created: {missingKingdomsForImport.slice(0, 10).map(k => `K${k}`).join(', ')}{missingKingdomsForImport.length > 10 ? '...' : ''}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <button onClick={() => setDuplicateRows(prev => prev.map(d => ({ ...d, action: 'replace' })))} style={{ padding: '0.3rem 0.6rem', backgroundColor: `${colors.warning}15`, border: `1px solid ${colors.warning}30`, borderRadius: '4px', color: colors.warning, cursor: 'pointer', fontSize: '0.7rem' }}>
                Replace All
              </button>
              <button onClick={() => setDuplicateRows(prev => prev.map(d => ({ ...d, action: 'skip' })))} style={{ padding: '0.3rem 0.6rem', backgroundColor: `${colors.textMuted}15`, border: `1px solid ${colors.textMuted}30`, borderRadius: '4px', color: colors.textMuted, cursor: 'pointer', fontSize: '0.7rem' }}>
                Skip All
              </button>
            </div>

            <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              {duplicateRows.map((d, i) => (
                <div key={i} style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: d.action === 'replace' ? `${colors.warning}08` : `${colors.textMuted}08`,
                  border: `1px solid ${d.action === 'replace' ? `${colors.warning}20` : colors.borderSubtle}`,
                  borderRadius: '6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.75rem',
                }}>
                  <span style={{ color: colors.textSecondary }}>
                    <span style={{ color: colors.primary, fontWeight: 600 }}>K{d.incoming.kingdom_number as number}</span> KvK #{d.incoming.kvk_number as number} vs K{d.incoming.opponent_kingdom as number}
                  </span>
                  <button
                    onClick={() => setDuplicateRows(prev => prev.map((item, j) => j === i ? { ...item, action: item.action === 'replace' ? 'skip' : 'replace' } : item))}
                    style={{
                      padding: '0.2rem 0.5rem',
                      backgroundColor: d.action === 'replace' ? `${colors.warning}20` : 'transparent',
                      border: `1px solid ${d.action === 'replace' ? `${colors.warning}40` : colors.border}`,
                      borderRadius: '4px',
                      color: d.action === 'replace' ? colors.warning : colors.textMuted,
                      cursor: 'pointer',
                      fontSize: '0.65rem',
                      fontWeight: 600,
                    }}
                  >
                    {d.action === 'replace' ? '↻ Replace' : '⏭ Skip'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              onClick={handleConfirmImport}
              disabled={importProcessing}
              style={{
                padding: '0.75rem 2rem',
                backgroundColor: colors.success,
                border: 'none',
                borderRadius: '8px',
                color: colors.text,
                fontWeight: 600,
                cursor: 'pointer',
                opacity: importProcessing ? 0.6 : 1,
              }}
            >
              {importProcessing ? '⏳ Processing...' : `✓ Confirm Import (${newRows.length} new + ${duplicateRows.filter(d => d.action === 'replace').length} replace)`}
            </button>
            <span style={{ color: colors.textMuted, fontSize: '0.75rem' }}>
              {duplicateRows.filter(d => d.action === 'skip').length} will be skipped
            </span>
          </div>
        </>
      )}

      {/* Step 4: Importing */}
      {importStep === 'importing' && (
        <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ width: '100%', height: '8px', backgroundColor: colors.border, borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${importProgress.total > 0 ? Math.min((importProgress.current / importProgress.total) * 100, 100) : 0}%`,
                backgroundColor: colors.primary,
                borderRadius: '4px',
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>
          <div style={{ color: colors.text, fontWeight: 600, fontSize: '1rem', marginBottom: '0.5rem' }}>
            {importProgress.phase || 'Preparing...'}
          </div>
          <div style={{ color: colors.textMuted, fontSize: '0.8rem' }}>
            {importProgress.total > 0 ? `${importProgress.current} / ${importProgress.total} operations` : 'Starting import...'}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h4 style={{ color: colors.text, margin: 0 }}>Import History</h4>
        <button onClick={fetchImportHistory} style={{ padding: '0.3rem 0.6rem', backgroundColor: 'transparent', border: `1px solid ${colors.border}`, borderRadius: '4px', color: colors.textMuted, cursor: 'pointer', fontSize: '0.7rem' }}>Refresh</button>
      </div>
      {importHistory.length === 0 ? (
        <p style={{ color: colors.textMuted, fontSize: '0.8rem' }}>No import history yet. <button onClick={fetchImportHistory} style={{ color: colors.primary, background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}>Load history</button></p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto' }}>
          {importHistory.map(h => (
            <div key={h.id} style={{ backgroundColor: colors.bg, borderRadius: '6px', padding: '0.6rem 0.75rem', border: `1px solid ${colors.borderSubtle}`, fontSize: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span style={{ color: colors.primary, fontWeight: 600 }}>{h.admin_username}</span>
                <span style={{ color: colors.textMuted }}>{new Date(h.created_at).toLocaleString()}</span>
                    {h.kingdoms_created > 0 && <span style={{ color: colors.purple }}>{h.kingdoms_created} kingdoms created</span>}
                    {h.kvk_numbers?.length > 0 && <span>KvK {h.kvk_numbers.join(', ')}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

      {/* Recalculate Atlas Scores (only on input step) */}
      {importStep === 'input' && (
        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #2a2a2a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div>
              <h4 style={{ color: colors.text, margin: 0 }}>Recalculate Atlas Scores</h4>
              <p style={{ color: colors.textMuted, fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
                Recalculates stats, Atlas Scores, and rank consistency for all kingdoms with KvK data. Run after bulk imports.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleRecalculateScores}
              disabled={recalculating}
              style={{ padding: '0.6rem 1.25rem', backgroundColor: recalculating ? colors.textMuted : `${colors.warning}20`, border: `1px solid ${recalculating ? colors.textMuted : `${colors.warning}50`}`, borderRadius: '8px', color: recalculating ? colors.textSecondary : colors.warning, cursor: recalculating ? 'not-allowed' : 'pointer', fontWeight: 500, fontSize: '0.85rem' }}
            >
              {recalculating ? '⏳ Recalculating...' : '🔄 Recalculate All Scores'}
            </button>
            {recalcResult && (
              <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: colors.textSecondary }}>
                <span style={{ color: colors.success }}>✓ {recalcResult.updated} kingdoms updated</span>
                <span>Avg score: {recalcResult.avgScore.toFixed(2)}</span>
                {recalcResult.ranksFixed > 0 && <span style={{ color: colors.gold }}>{recalcResult.ranksFixed} rank(s) corrected</span>}
                {recalcResult.ranksFixed === 0 && <span style={{ color: colors.success }}>All ranks consistent</span>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bulk Create Kingdoms (only on input step) */}
      {importStep === 'input' && (
        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #2a2a2a' }}>
          <h4 style={{ color: colors.text, marginBottom: '0.75rem' }}>Bulk Create Empty Kingdoms</h4>
          <p style={{ color: colors.textMuted, fontSize: '0.8rem', marginBottom: '1rem' }}>
            Create all empty kingdom profiles from K1 up to the number you enter. Skips any kingdoms that already exist. New kingdoms are added daily — increase this number as needed.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: colors.textSecondary, fontSize: '0.85rem' }}>Create kingdoms up to K</span>
            <input
              type="number"
              min={1}
              max={9999}
              defaultValue={1500}
              id="bulk-kingdom-max"
              style={{
                width: '80px',
                padding: '0.5rem 0.75rem',
                backgroundColor: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                color: colors.text,
                fontSize: '0.9rem',
                fontWeight: 600,
                textAlign: 'center',
              }}
            />
            <button
              onClick={() => {
                const input = document.getElementById('bulk-kingdom-max') as HTMLInputElement;
                const maxNum = parseInt(input?.value || '0', 10);
                if (!maxNum || maxNum < 1) {
                  showToast('Enter a valid kingdom number', 'error');
                  return;
                }
                handleBulkCreateKingdoms(1, maxNum);
              }}
              style={{ padding: '0.6rem 1.25rem', backgroundColor: `${colors.purple}20`, border: `1px solid ${colors.purple}50`, borderRadius: '8px', color: colors.purple, cursor: 'pointer', fontWeight: 500, fontSize: '0.85rem' }}
            >
              Create Missing Kingdoms
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportTab;
