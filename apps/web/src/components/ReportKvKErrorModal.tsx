import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { KVKRecord } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './Toast';
import { contributorService } from '../services/contributorService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logger } from '../utils/logger';

interface ReportKvKErrorModalProps {
  kingdomNumber: number;
  kvkRecords: KVKRecord[];
  isOpen: boolean;
  onClose: () => void;
}

type ErrorType =
  | 'wrong_opponent'
  | 'wrong_prep_result'
  | 'wrong_battle_result'
  | 'wrong_both_results'
  | 'missing_kvk'
  | 'everything_wrong';

const ERROR_TYPES: { key: ErrorType; label: string }[] = [
  { key: 'wrong_opponent', label: 'Incorrect opponent kingdom' },
  { key: 'wrong_prep_result', label: 'Incorrect prep phase result' },
  { key: 'wrong_battle_result', label: 'Incorrect battle phase result' },
  { key: 'wrong_both_results', label: 'Incorrect prep & battle phase results' },
  { key: 'missing_kvk', label: 'Missing KvK' },
  { key: 'everything_wrong', label: 'Everything is incorrect' },
];

const RESULT_OPTIONS = [
  { value: 'W', label: 'W (Win)', color: '#22c55e' },
  { value: 'L', label: 'L (Loss)', color: '#ef4444' },
  { value: 'B', label: 'B (Bye)', color: '#6b7280' },
];

const sInput: React.CSSProperties = {
  width: '100%', padding: '0.65rem', backgroundColor: '#0a0a0a',
  border: '1px solid #2a2a2a', borderRadius: '8px', color: '#fff', fontSize: '0.85rem',
  boxSizing: 'border-box' as const,
};
const sLabel: React.CSSProperties = { display: 'block', color: '#9ca3af', fontSize: '0.8rem', marginBottom: '0.5rem' };

// ─── Searchable Kingdom Dropdown ────────────────────────────────────────────

const KingdomSearch: React.FC<{
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
}> = ({ value, onChange, placeholder = 'Search kingdom...' }) => {
  const [search, setSearch] = useState(value !== null ? (value === 0 ? 'Bye' : `K${value}`) : '');
  const [open, setOpen] = useState(false);
  const [kingdoms, setKingdoms] = useState<number[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.from('kingdoms').select('kingdom_number').order('kingdom_number').then(({ data }) => {
      if (data) setKingdoms(data.map(k => k.kingdom_number));
    });
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = useMemo(() => {
    const q = search.replace(/^k/i, '').trim();
    if (!q) return kingdoms.slice(0, 30);
    const num = parseInt(q);
    if (!isNaN(num)) return kingdoms.filter(k => String(k).includes(q)).slice(0, 30);
    return kingdoms.slice(0, 30);
  }, [search, kingdoms]);

  const select = (k: number | null) => {
    onChange(k);
    setSearch(k === null ? '' : k === 0 ? 'Bye' : `K${k}`);
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        type="text"
        value={search}
        onChange={e => { setSearch(e.target.value); setOpen(true); if (!e.target.value) onChange(null); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        style={sInput}
      />
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          maxHeight: '200px', overflowY: 'auto', backgroundColor: '#0f0f0f',
          border: '1px solid #2a2a2a', borderRadius: '0 0 8px 8px',
          boxShadow: '0 8px 20px rgba(0,0,0,0.5)',
        }}>
          <div
            onClick={() => select(0)}
            style={{
              padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem',
              color: value === 0 ? '#22d3ee' : '#6b7280',
              backgroundColor: value === 0 ? '#22d3ee10' : 'transparent',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#1a1a1a')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = value === 0 ? '#22d3ee10' : 'transparent')}
          >
            Bye (no opponent)
          </div>
          {filtered.map(k => (
            <div
              key={k}
              onClick={() => select(k)}
              style={{
                padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem',
                color: value === k ? '#22d3ee' : '#fff',
                backgroundColor: value === k ? '#22d3ee10' : 'transparent',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#1a1a1a')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = value === k ? '#22d3ee10' : 'transparent')}
            >
              Kingdom {k}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Result Picker ──────────────────────────────────────────────────────────

const ResultPicker: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
}> = ({ label, value, onChange }) => (
  <div>
    <label style={sLabel}>{label}</label>
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      {RESULT_OPTIONS.map(r => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          style={{
            flex: 1, padding: '0.5rem', borderRadius: '8px', cursor: 'pointer',
            fontSize: '0.85rem', fontWeight: 600,
            border: value === r.value ? `2px solid ${r.color}` : '1px solid #2a2a2a',
            backgroundColor: value === r.value ? `${r.color}20` : '#0a0a0a',
            color: value === r.value ? r.color : '#6b7280',
          }}
        >
          {r.label}
        </button>
      ))}
    </div>
  </div>
);

// ─── Flip helper ────────────────────────────────────────────────────────────

const flipR = (r: string | null) => {
  if (r === null) return '-';
  if (r === 'W' || r === 'Win') return 'L';
  if (r === 'L' || r === 'Loss') return 'W';
  return r;
};
const normR = (r: string | null) => (r === null ? '-' : r === 'Win' ? 'W' : r === 'Loss' ? 'L' : r);
const colorR = (r: string | null) => r === null ? '#6b7280' : r === 'W' || r === 'Win' ? '#22c55e' : r === 'L' || r === 'Loss' ? '#ef4444' : '#6b7280';

// ─── Main Component ─────────────────────────────────────────────────────────

const ReportKvKErrorModal: React.FC<ReportKvKErrorModalProps> = ({
  kingdomNumber,
  kvkRecords,
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const { showToast } = useToast();

  const [selectedKvK, setSelectedKvK] = useState<number | null>(null);
  const [errorType, setErrorType] = useState<ErrorType | ''>('');
  const [submitting, setSubmitting] = useState(false);

  // Correction data fields
  const [corrOpponent, setCorrOpponent] = useState<number | null>(null);
  const [corrPrep, setCorrPrep] = useState('');
  const [corrBattle, setCorrBattle] = useState('');
  const [missingKvkNumber, setMissingKvkNumber] = useState('');

  const sortedKvKs = [...kvkRecords].sort((a, b) => b.kvk_number - a.kvk_number);
  const rec = sortedKvKs.find(k => k.kvk_number === selectedKvK);

  const isAdmin = profile?.is_admin === true;
  const needsKvkSelect = errorType !== 'missing_kvk' && errorType !== '';
  const needsKingdom = errorType === 'wrong_opponent' || errorType === 'missing_kvk' || errorType === 'everything_wrong';
  const needsResults = errorType === 'missing_kvk' || errorType === 'everything_wrong';
  const isAutoFlip = errorType === 'wrong_prep_result' || errorType === 'wrong_battle_result' || errorType === 'wrong_both_results';

  // Reset dependent fields when error type changes
  const handleErrorTypeChange = (v: ErrorType | '') => {
    setErrorType(v);
    setCorrOpponent(null);
    setCorrPrep('');
    setCorrBattle('');
    setMissingKvkNumber('');
  };

  // Compute preview of correction
  const preview = useMemo(() => {
    if (!errorType) return null;
    if (isAutoFlip && rec) {
      const p = errorType === 'wrong_prep_result' || errorType === 'wrong_both_results' ? flipR(rec.prep_result) : normR(rec.prep_result);
      const b = errorType === 'wrong_battle_result' || errorType === 'wrong_both_results' ? flipR(rec.battle_result) : normR(rec.battle_result);
      return { opponent: rec.opponent_kingdom, prep: p, battle: b };
    }
    if (errorType === 'wrong_opponent' && corrOpponent !== null && rec) {
      return { opponent: corrOpponent, prep: normR(rec.prep_result), battle: normR(rec.battle_result) };
    }
    if ((errorType === 'missing_kvk' || errorType === 'everything_wrong') && corrOpponent !== null && corrPrep && corrBattle) {
      return { opponent: corrOpponent, prep: corrPrep, battle: corrBattle };
    }
    return null;
  }, [errorType, rec, corrOpponent, corrPrep, corrBattle, isAutoFlip]);

  // Validate form
  const canSubmit = useMemo(() => {
    if (!user?.id || !errorType || submitting) return false;
    if (needsKvkSelect && !selectedKvK) return false;
    if (errorType === 'missing_kvk' && !missingKvkNumber.trim()) return false;
    if (needsKingdom && corrOpponent === null) return false;
    if (needsResults && (!corrPrep || !corrBattle)) return false;
    return true;
  }, [user, errorType, submitting, needsKvkSelect, selectedKvK, needsKingdom, corrOpponent, needsResults, corrPrep, corrBattle, missingKvkNumber]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!canSubmit || !user?.id) return;

    setSubmitting(true);
    try {
      const kvkNum = errorType === 'missing_kvk' ? parseInt(missingKvkNumber) : selectedKvK;

      // Check for duplicates
      const dup = await contributorService.checkDuplicate('kvkError', {
        kingdom_number: kingdomNumber,
        kvk_number: kvkNum,
        error_type: errorType,
      });
      if (dup.isDuplicate) {
        showToast(t('reportKvkError.duplicateError', 'A pending report already exists for this issue.'), 'error');
        setSubmitting(false);
        return;
      }

      if (!isSupabaseConfigured || !supabase) throw new Error('Database unavailable');

      // Build current_data from the existing record
      const currentData = rec ? {
        opponent: rec.opponent_kingdom,
        prep_result: normR(rec.prep_result),
        battle_result: normR(rec.battle_result),
      } : null;

      // Build corrected_data based on error type
      let correctedData: Record<string, unknown> | null = null;
      if (errorType === 'wrong_opponent') {
        correctedData = { opponent: corrOpponent };
      } else if (errorType === 'missing_kvk' || errorType === 'everything_wrong') {
        correctedData = { opponent: corrOpponent, prep_result: corrPrep, battle_result: corrBattle };
      }
      // For auto-flip types, corrected_data is computed at approval time

      // Build description automatically
      let autoDesc = '';
      if (isAutoFlip && preview && rec) {
        const changes: string[] = [];
        if (errorType.includes('prep')) changes.push(`Prep: ${normR(rec.prep_result)}→${preview.prep}`);
        if (errorType.includes('battle')) changes.push(`Battle: ${normR(rec.battle_result)}→${preview.battle}`);
        autoDesc = changes.join(', ');
      } else if (errorType === 'wrong_opponent' && corrOpponent !== null) {
        autoDesc = `Opponent: K${rec?.opponent_kingdom || '?'}→${corrOpponent === 0 ? 'Bye' : `K${corrOpponent}`}`;
      } else if (errorType === 'missing_kvk') {
        autoDesc = `Missing KvK #${missingKvkNumber} vs ${corrOpponent === 0 ? 'Bye' : `K${corrOpponent}`} (${corrPrep}/${corrBattle})`;
      } else if (errorType === 'everything_wrong') {
        autoDesc = `Full correction: vs ${corrOpponent === 0 ? 'Bye' : `K${corrOpponent}`} (${corrPrep}/${corrBattle})`;
      }

      const errorLabel = ERROR_TYPES.find(e => e.key === errorType)?.label || errorType;

      const payload: Record<string, unknown> = {
        kingdom_number: kingdomNumber,
        kvk_number: kvkNum,
        error_type: errorType,
        error_type_label: errorLabel,
        current_data: currentData,
        corrected_data: correctedData,
        description: autoDesc,
        submitted_by: user.id,
        submitted_by_name: profile?.username || 'Anonymous',
        status: isAdmin ? 'approved' : 'pending',
      };

      if (isAdmin) {
        payload.reviewed_by = user.id;
        payload.reviewed_by_name = profile?.username || 'admin';
        payload.reviewed_at = new Date().toISOString();
        payload.review_notes = 'Auto-approved (admin submission)';
      }

      const { error } = await supabase.from('kvk_errors').insert(payload);

      if (error) {
        logger.error('Failed to submit KvK error:', error.message, error.code, error.details, error.hint);
        throw new Error(`Failed to submit: ${error.message}`);
      }

      // If admin, also apply the correction immediately
      if (isAdmin && kvkNum) {
        try {
          const { kvkCorrectionService } = await import('../services/kvkCorrectionService');
          const corrObj = {
            id: 'admin-auto',
            kingdom_number: kingdomNumber,
            kvk_number: kvkNum,
            error_type: errorType,
            current_data: currentData,
            corrected_prep: preview?.prep,
            corrected_battle: preview?.battle,
          };

          // For wrong_opponent, missing_kvk, everything_wrong — handle differently
          if (errorType === 'wrong_opponent' && corrOpponent !== null && currentData) {
            // Update opponent kingdom in kvk_history
            await supabase.from('kvk_history').update({ opponent_kingdom: corrOpponent }).eq('kingdom_number', kingdomNumber).eq('kvk_number', kvkNum);
            // Update the inverse record's opponent too
            if (currentData.opponent && currentData.opponent !== 0) {
              await supabase.from('kvk_history').update({ opponent_kingdom: 0 }).eq('kingdom_number', currentData.opponent).eq('kvk_number', kvkNum).eq('opponent_kingdom', kingdomNumber);
            }
            if (corrOpponent !== 0) {
              await supabase.from('kvk_history').update({ opponent_kingdom: kingdomNumber }).eq('kingdom_number', corrOpponent).eq('kvk_number', kvkNum);
            }
          } else if (errorType === 'missing_kvk' && correctedData) {
            // Insert new kvk_history row
            const opp = correctedData.opponent as number;
            const overall = corrPrep === 'B' && corrBattle === 'B' ? 'Bye'
              : corrPrep === 'W' && corrBattle === 'W' ? 'Domination'
              : corrPrep === 'L' && corrBattle === 'W' ? 'Comeback'
              : corrPrep === 'W' && corrBattle === 'L' ? 'Reversal'
              : 'Invasion';
            await supabase.from('kvk_history').insert({
              kingdom_number: kingdomNumber, kvk_number: kvkNum, opponent_kingdom: opp,
              prep_result: corrPrep, battle_result: corrBattle, overall_result: overall,
            });
            // Insert opponent's inverse if not Bye
            if (opp !== 0) {
              const oppOverall = flipR(corrPrep) === 'W' && flipR(corrBattle) === 'W' ? 'Domination'
                : flipR(corrPrep) === 'L' && flipR(corrBattle) === 'W' ? 'Comeback'
                : flipR(corrPrep) === 'W' && flipR(corrBattle) === 'L' ? 'Reversal'
                : 'Invasion';
              await supabase.from('kvk_history').insert({
                kingdom_number: opp, kvk_number: kvkNum, opponent_kingdom: kingdomNumber,
                prep_result: flipR(corrPrep), battle_result: flipR(corrBattle), overall_result: oppOverall,
              });
            }
          } else if (errorType === 'everything_wrong' && correctedData && currentData) {
            const opp = correctedData.opponent as number;
            const overall = corrPrep === 'B' && corrBattle === 'B' ? 'Bye'
              : corrPrep === 'W' && corrBattle === 'W' ? 'Domination'
              : corrPrep === 'L' && corrBattle === 'W' ? 'Comeback'
              : corrPrep === 'W' && corrBattle === 'L' ? 'Reversal'
              : 'Invasion';
            await supabase.from('kvk_history').update({
              opponent_kingdom: opp, prep_result: corrPrep, battle_result: corrBattle, overall_result: overall,
            }).eq('kingdom_number', kingdomNumber).eq('kvk_number', kvkNum);
            // Update opponent inverse
            if (currentData.opponent && currentData.opponent !== 0) {
              await supabase.from('kvk_history').delete().eq('kingdom_number', currentData.opponent).eq('kvk_number', kvkNum).eq('opponent_kingdom', kingdomNumber);
            }
            if (opp !== 0) {
              await supabase.from('kvk_history').upsert({
                kingdom_number: opp, kvk_number: kvkNum, opponent_kingdom: kingdomNumber,
                prep_result: flipR(corrPrep), battle_result: flipR(corrBattle),
                overall_result: flipR(corrPrep) === 'W' && flipR(corrBattle) === 'W' ? 'Domination'
                  : flipR(corrPrep) === 'L' && flipR(corrBattle) === 'W' ? 'Comeback'
                  : flipR(corrPrep) === 'W' && flipR(corrBattle) === 'L' ? 'Reversal'
                  : 'Invasion',
              }, { onConflict: 'kingdom_number,kvk_number' });
            }
          } else {
            // Auto-flip types: use existing correction service
            await kvkCorrectionService.applyCorrectionAsync(corrObj as Parameters<typeof kvkCorrectionService.applyCorrectionAsync>[0], profile?.username || 'admin');
          }
        } catch (applyErr) {
          logger.error('Failed to auto-apply admin correction:', applyErr);
        }
      }

      contributorService.trackNewSubmission(user.id, profile?.username || 'Anonymous', 'kvkError');
      showToast(
        isAdmin
          ? t('reportKvkError.successToast', 'Report submitted!') + ' (auto-approved & applied)'
          : t('reportKvkError.successToast', 'Report submitted! An admin will review it.'),
        'success'
      );
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      logger.error('KvK error submission failed:', msg, err);
      showToast(t('reportKvkError.failedToast', 'Failed to submit report. Please try again.'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
      onClick={onClose}
    >
      <div
        style={{ backgroundColor: '#131318', borderRadius: '16px', border: '1px solid #2a2a2a', padding: '1.5rem', maxWidth: '480px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ color: '#fff', fontSize: '1.1rem', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🚩</span> {t('reportKvkError.title', 'Report KvK Error')}
            </h2>
            <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>Kingdom {kingdomNumber}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1 }}>×</button>
        </div>

        {/* Step 1: Error Type */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={sLabel}>{t('reportKvkError.whatsWrong', "What's wrong?")}</label>
          <select value={errorType} onChange={e => handleErrorTypeChange(e.target.value as ErrorType | '')} style={sInput}>
            <option value="">Select error type...</option>
            {ERROR_TYPES.map(et => <option key={et.key} value={et.key}>{et.label}</option>)}
          </select>
        </div>

        {/* Step 2: Select KvK (unless missing_kvk) */}
        {needsKvkSelect && (
          <div style={{ marginBottom: '1rem' }}>
            <label style={sLabel}>{t('reportKvkError.whichKvk', 'Which KvK?')}</label>
            <select value={selectedKvK || ''} onChange={e => setSelectedKvK(e.target.value ? parseInt(e.target.value) : null)} style={sInput}>
              <option value="">Select KvK...</option>
              {sortedKvKs.map(k => (
                <option key={k.kvk_number} value={k.kvk_number}>
                  KvK #{k.kvk_number} vs {k.opponent_kingdom === 0 ? 'Bye' : `K${k.opponent_kingdom}`} ({normR(k.prep_result)}/{normR(k.battle_result)})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* For missing_kvk: enter KvK number */}
        {errorType === 'missing_kvk' && (
          <div style={{ marginBottom: '1rem' }}>
            <label style={sLabel}>KvK Number</label>
            <input
              type="number" min={1} value={missingKvkNumber}
              onChange={e => setMissingKvkNumber(e.target.value)}
              placeholder="e.g. 5"
              style={sInput}
            />
          </div>
        )}

        {/* Show current data when KvK is selected */}
        {rec && needsKvkSelect && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#0a0a0a', borderRadius: '8px', border: '1px solid #1f1f1f' }}>
            <div style={{ color: '#6b7280', fontSize: '0.7rem', marginBottom: '0.5rem' }}>Current record</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', fontSize: '0.8rem' }}>
              <div><div style={{ color: '#6b7280', fontSize: '0.65rem' }}>Opponent</div><div style={{ color: '#22d3ee' }}>{rec.opponent_kingdom === 0 ? 'Bye' : `K${rec.opponent_kingdom}`}</div></div>
              <div><div style={{ color: '#6b7280', fontSize: '0.65rem' }}>Prep</div><div style={{ color: colorR(rec.prep_result) }}>{normR(rec.prep_result)}</div></div>
              <div><div style={{ color: '#6b7280', fontSize: '0.65rem' }}>Battle</div><div style={{ color: colorR(rec.battle_result) }}>{normR(rec.battle_result)}</div></div>
            </div>
          </div>
        )}

        {/* Dynamic correction fields based on error type */}
        {needsKingdom && (
          <div style={{ marginBottom: '1rem' }}>
            <label style={sLabel}>{errorType === 'wrong_opponent' ? 'Correct opponent' : 'Opponent kingdom'}</label>
            <KingdomSearch value={corrOpponent} onChange={setCorrOpponent} placeholder="Search kingdom or select Bye..." />
          </div>
        )}

        {needsResults && (
          <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <ResultPicker label="Prep Phase Result" value={corrPrep} onChange={setCorrPrep} />
            <ResultPicker label="Battle Phase Result" value={corrBattle} onChange={setCorrBattle} />
          </div>
        )}

        {/* Auto-flip preview */}
        {isAutoFlip && rec && selectedKvK && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#0a0a0a', borderRadius: '8px', border: '1px solid #22c55e30' }}>
            <div style={{ color: '#22c55e', fontSize: '0.7rem', marginBottom: '0.5rem', fontWeight: 600 }}>✓ Correction preview</div>
            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>Prep: </span>
                <span style={{ color: colorR(rec.prep_result), textDecoration: errorType.includes('prep') || errorType.includes('both') ? 'line-through' : 'none', opacity: errorType.includes('prep') || errorType.includes('both') ? 0.5 : 1 }}>{normR(rec.prep_result)}</span>
                {(errorType.includes('prep') || errorType.includes('both')) && <span style={{ color: colorR(flipR(rec.prep_result)), fontWeight: 700 }}> → {flipR(rec.prep_result)}</span>}
              </div>
              <div>
                <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>Battle: </span>
                <span style={{ color: colorR(rec.battle_result), textDecoration: errorType.includes('battle') || errorType.includes('both') ? 'line-through' : 'none', opacity: errorType.includes('battle') || errorType.includes('both') ? 0.5 : 1 }}>{normR(rec.battle_result)}</span>
                {(errorType.includes('battle') || errorType.includes('both')) && <span style={{ color: colorR(flipR(rec.battle_result)), fontWeight: 700 }}> → {flipR(rec.battle_result)}</span>}
              </div>
            </div>
          </div>
        )}

        {/* Preview for non-auto-flip corrections */}
        {!isAutoFlip && preview && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#0a0a0a', borderRadius: '8px', border: '1px solid #22c55e30' }}>
            <div style={{ color: '#22c55e', fontSize: '0.7rem', marginBottom: '0.5rem', fontWeight: 600 }}>✓ Correction preview</div>
            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem' }}>
              <div><span style={{ color: '#6b7280', fontSize: '0.65rem' }}>Opponent: </span><span style={{ color: '#22d3ee' }}>{preview.opponent === 0 ? 'Bye' : `K${preview.opponent}`}</span></div>
              <div><span style={{ color: '#6b7280', fontSize: '0.65rem' }}>Prep: </span><span style={{ color: colorR(preview.prep) }}>{preview.prep}</span></div>
              <div><span style={{ color: '#6b7280', fontSize: '0.65rem' }}>Battle: </span><span style={{ color: colorR(preview.battle) }}>{preview.battle}</span></div>
            </div>
          </div>
        )}

        {/* Notice */}
        <div style={{ padding: '0.65rem', backgroundColor: '#22d3ee10', border: '1px solid #22d3ee30', borderRadius: '8px', marginBottom: '1rem' }}>
          <div style={{ color: '#22d3ee', fontSize: '0.75rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <span>ℹ️</span>
            <span>{isAdmin ? 'As an admin, your report will be auto-approved and applied instantly.' : t('reportKvkError.reviewNotice', 'Reports are reviewed by admins. Approved corrections apply instantly.')}</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.6rem 1rem', backgroundColor: 'transparent', border: '1px solid #3a3a3a', borderRadius: '8px', color: '#9ca3af', cursor: 'pointer', fontSize: '0.85rem' }}>
            {t('reportKvkError.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              padding: '0.6rem 1rem',
              backgroundColor: canSubmit ? '#ef4444' : '#1a1a1a',
              border: 'none', borderRadius: '8px',
              color: canSubmit ? '#fff' : '#6b7280',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              fontSize: '0.85rem', fontWeight: '600',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}
          >
            {submitting && <span style={{ width: 14, height: 14, border: '2px solid #fff3', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'authSpin 0.6s linear infinite' }} />}
            🚩 {t('reportKvkError.submitReport', 'Submit Report')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportKvKErrorModal;
