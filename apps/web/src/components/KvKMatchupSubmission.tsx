import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './Toast';
import { logger } from '../utils/logger';
import { CURRENT_KVK } from '../constants';
import { supabase } from '../lib/supabase';
import { neonGlow, FONT_DISPLAY } from '../utils/styles';

interface KvKMatchupSubmissionProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  defaultKingdom?: number;
  defaultKvkNumber?: number;
  isAdmin?: boolean;
  /** Pre-select which data the user wants to add: matchup, prep, or battle */
  initialMode?: 'matchup' | 'prep' | 'battle';
}

type SubmitMode = 'matchup' | 'prep' | 'battle' | 'full';
type PhaseStatus = 'pre_matchup' | 'matchup_open' | 'prep_open' | 'battle_open' | 'complete';

interface ExistingMatchup {
  kingdom_number: number;
  opponent_kingdom: number;
  prep_result: string | null;
  battle_result: string | null;
  overall_result: string | null;
}

interface KvKSchedule {
  kvk_number: number;
  matchups_open_at: string;
  prep_open_at: string;
  battle_open_at: string;
  is_complete: boolean;
}

const getPhaseStatus = (schedule: KvKSchedule | null): PhaseStatus => {
  if (!schedule) return 'matchup_open'; // No schedule = allow everything
  const now = new Date();
  if (schedule.is_complete) return 'complete';
  if (now >= new Date(schedule.battle_open_at)) return 'battle_open';
  if (now >= new Date(schedule.prep_open_at)) return 'prep_open';
  if (now >= new Date(schedule.matchups_open_at)) return 'matchup_open';
  return 'pre_matchup';
};

const getPhaseLabel = (phase: PhaseStatus): { label: string; color: string; icon: string } => {
  switch (phase) {
    case 'pre_matchup': return { label: 'Matchups not announced yet', color: '#6b7280', icon: '⏳' };
    case 'matchup_open': return { label: 'Matchup submissions open', color: '#22d3ee', icon: '🔗' };
    case 'prep_open': return { label: 'Prep results open', color: '#eab308', icon: '🛡️' };
    case 'battle_open': return { label: 'Battle results open', color: '#f97316', icon: '⚔️' };
    case 'complete': return { label: 'KvK data complete', color: '#22c55e', icon: '✅' };
  }
};

const KvKMatchupSubmission: React.FC<KvKMatchupSubmissionProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultKingdom,
  defaultKvkNumber,
  isAdmin = false,
  initialMode: initialModeProp,
}) => {
  const { user, profile } = useAuth();
  const { showToast } = useToast();

  const kvkNumber = defaultKvkNumber || CURRENT_KVK;
  const userKingdom = profile?.linked_kingdom || profile?.home_kingdom || null;

  const [kingdomNumber, setKingdomNumber] = useState<number | ''>(defaultKingdom || '');
  const [opponentKingdom, setOpponentKingdom] = useState<number | ''>('');
  const [prepWinner, setPrepWinner] = useState<number | null>(null);
  const [battleWinner, setBattleWinner] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<SubmitMode>('matchup');
  const [existing, setExisting] = useState<ExistingMatchup | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(false);
  const [schedule, setSchedule] = useState<KvKSchedule | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [reportType, setReportType] = useState<string>('wrong_matchup');
  const [reportDesc, setReportDesc] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const phase = getPhaseStatus(schedule);
  const phaseInfo = getPhaseLabel(phase);

  // Fetch KvK schedule
  useEffect(() => {
    if (!isOpen || !supabase) return;
    supabase
      .from('kvk_schedule')
      .select('kvk_number, matchups_open_at, prep_open_at, battle_open_at, is_complete')
      .eq('kvk_number', kvkNumber)
      .maybeSingle()
      .then(({ data }) => { if (data) setSchedule(data); });
  }, [isOpen, kvkNumber]);

  // Reset form when opened — auto-fill user's kingdom
  useEffect(() => {
    if (isOpen) {
      const autoKingdom = defaultKingdom || (isAdmin ? '' : userKingdom) || '';
      setKingdomNumber(autoKingdom);
      setOpponentKingdom('');
      setPrepWinner(null);
      setBattleWinner(null);
      setExisting(null);
      setMode(initialModeProp || 'matchup');
      setShowReport(false);
      setReportDesc('');

      // Auto-lookup opponent when opening in prep/battle mode with a known kingdom
      if ((initialModeProp === 'prep' || initialModeProp === 'battle') && autoKingdom && supabase) {
        supabase
          .from('kvk_history')
          .select('kingdom_number, opponent_kingdom, prep_result, battle_result, overall_result')
          .eq('kingdom_number', autoKingdom)
          .eq('kvk_number', kvkNumber)
          .neq('opponent_kingdom', 0)
          .limit(1)
          .maybeSingle()
          .then(({ data }) => {
            if (data && data.opponent_kingdom) {
              setOpponentKingdom(data.opponent_kingdom);
              setExisting(data);
              if (data.prep_result && data.battle_result) {
                setMode('full');
              } else if (data.prep_result && !data.battle_result) {
                setMode('battle');
              } else {
                setMode(initialModeProp);
              }
            }
          });
      }
    }
  }, [isOpen, defaultKingdom, userKingdom, isAdmin, initialModeProp, kvkNumber]);

  // Check for existing matchup when both kingdoms are entered
  const checkExisting = useCallback(async () => {
    if (!supabase || !kingdomNumber || !opponentKingdom || kingdomNumber === opponentKingdom) {
      setExisting(null);
      return;
    }
    setCheckingExisting(true);
    try {
      const { data } = await supabase
        .from('kvk_history')
        .select('kingdom_number, opponent_kingdom, prep_result, battle_result, overall_result')
        .eq('kingdom_number', kingdomNumber)
        .eq('opponent_kingdom', opponentKingdom)
        .eq('kvk_number', kvkNumber)
        .limit(1)
        .maybeSingle();

      if (data) {
        setExisting(data);
        // Auto-detect mode based on existing data
        if (data.prep_result && data.battle_result) {
          setMode('full');
        } else if (data.prep_result && !data.battle_result) {
          setMode('battle');
        } else if (!data.prep_result && !data.battle_result) {
          setMode(initialModeProp === 'battle' ? 'prep' : initialModeProp || 'prep');
        }
      } else {
        setExisting(null);
        setMode(initialModeProp || 'matchup');
      }
    } catch (err) {
      logger.error('Error checking existing matchup:', err);
    } finally {
      setCheckingExisting(false);
    }
  }, [kingdomNumber, opponentKingdom, kvkNumber, initialModeProp]);

  useEffect(() => {
    const timer = setTimeout(checkExisting, 300);
    return () => clearTimeout(timer);
  }, [checkExisting]);

  if (!isOpen) return null;
  if (!user) return null;

  // Phase-based restrictions (admins bypass)
  const canSubmitMatchup = isAdmin || phase === 'matchup_open' || phase === 'prep_open' || phase === 'battle_open';
  const canSubmitPrep = isAdmin || phase === 'prep_open' || phase === 'battle_open';
  const canSubmitBattle = isAdmin || phase === 'battle_open';

  const isFormValid = () => {
    if (!kingdomNumber || !opponentKingdom || kingdomNumber === opponentKingdom) return false;
    if (mode === 'matchup') return canSubmitMatchup;
    if (mode === 'prep') return prepWinner !== null && canSubmitPrep;
    if (mode === 'battle') return battleWinner !== null && canSubmitBattle;
    if (mode === 'full') return false;
    return false;
  };

  const handleSubmit = async () => {
    if (!supabase || !isFormValid()) return;

    // Any linked user can submit matchup data for any kingdom pair.
    // Corrections to existing data are handled server-side (RPC rejects non-admin changes).

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('submit_kvk_partial', {
        p_kingdom_number: kingdomNumber as number,
        p_opponent_kingdom: opponentKingdom as number,
        p_kvk_number: kvkNumber,
        p_prep_winner: prepWinner,
        p_battle_winner: battleWinner,
        p_is_admin: isAdmin,
      });

      if (error) {
        logger.error('Partial KvK submission error:', error);
        showToast(error.message || 'Submission failed', 'error');
        return;
      }

      if (data?.error) {
        showToast(data.error, 'error');
        return;
      }

      const action = data?.action || 'submitted';
      const labels: Record<string, string> = {
        matchup: `K${kingdomNumber} vs K${opponentKingdom} matchup recorded!`,
        prep: `Prep result ${action} for K${kingdomNumber} vs K${opponentKingdom}!`,
        battle: `Battle result ${action}! KvK complete for K${kingdomNumber} vs K${opponentKingdom}!`,
      };

      let msgKey = 'matchup';
      if (battleWinner) msgKey = 'battle';
      else if (prepWinner) msgKey = 'prep';

      showToast(labels[msgKey] || 'Submitted!', 'success');
      onSuccess?.();
      onClose();
    } catch (err) {
      logger.error('Partial KvK submission caught error:', err);
      showToast('Submission failed. Try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReport = async () => {
    if (!supabase || !kingdomNumber || !opponentKingdom) return;
    setReportSubmitting(true);
    try {
      const { error } = await supabase.from('kvk_matchup_reports').insert({
        kvk_number: kvkNumber,
        kingdom_number: kingdomNumber as number,
        opponent_kingdom: opponentKingdom as number,
        reported_by: user.id,
        report_type: reportType,
        description: reportDesc || null,
      });
      if (error) {
        showToast(error.message || 'Report failed', 'error');
        return;
      }
      showToast('Report submitted! An admin will review it.', 'success');
      setShowReport(false);
      setReportDesc('');
    } catch {
      showToast('Report failed. Try again.', 'error');
    } finally {
      setReportSubmitting(false);
    }
  };

  const getOutcomePreview = () => {
    if (!prepWinner || !battleWinner || !kingdomNumber) return null;
    const prepW = prepWinner === kingdomNumber;
    const battleW = battleWinner === kingdomNumber;
    if (prepW && battleW) return { label: 'Domination', color: '#22c55e', emoji: '👑' };
    if (!prepW && battleW) return { label: 'Comeback', color: '#3b82f6', emoji: '💪' };
    if (prepW && !battleW) return { label: 'Reversal', color: '#a855f7', emoji: '🔄' };
    return { label: 'Invasion', color: '#ef4444', emoji: '💀' };
  };

  const getStatusBadge = () => {
    if (!existing) return null;
    if (!existing.prep_result && !existing.battle_result) {
      return { label: 'Matchup Only', color: '#6b7280', icon: '🔗' };
    }
    if (existing.prep_result && !existing.battle_result) {
      return { label: 'Prep Done', color: '#eab308', icon: '🛡️' };
    }
    if (existing.prep_result && existing.battle_result) {
      return { label: 'Complete', color: '#22c55e', icon: '✅' };
    }
    return null;
  };

  const outcome = getOutcomePreview();
  const statusBadge = getStatusBadge();

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.65rem',
    backgroundColor: '#0a0a0a',
    border: '1px solid #2a2a2a',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '0.9rem',
  };

  const WinnerPicker: React.FC<{
    label: string;
    labelColor: string;
    value: number | null;
    onChange: (v: number | null) => void;
    disabled?: boolean;
    existingResult?: string | null;
    phaseBlocked?: boolean;
    phaseMsg?: string;
  }> = ({ label, labelColor, value, onChange, disabled, existingResult, phaseBlocked, phaseMsg }) => (
    <div>
      <label style={{ display: 'block', color: labelColor, fontSize: '0.75rem', marginBottom: '0.35rem', fontWeight: 600 }}>
        {label} {existingResult && <span style={{ color: '#22c55e' }}>✓ {existingResult === 'W' ? 'Won' : 'Lost'}</span>}
      </label>
      {disabled || existingResult ? (
        <div style={{ padding: '0.5rem', backgroundColor: '#0a0a0a', borderRadius: 6, border: '1px solid #2a2a2a', color: '#6b7280', fontSize: '0.8rem' }}>
          Already recorded
        </div>
      ) : phaseBlocked ? (
        <div style={{ padding: '0.5rem', backgroundColor: '#0a0a0a', borderRadius: 6, border: '1px dashed #4a4a4a', color: '#6b7280', fontSize: '0.8rem' }}>
          ⏳ {phaseMsg || 'Not available yet'}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {[kingdomNumber as number, opponentKingdom as number].filter(Boolean).map(k => (
            <button
              key={k}
              type="button"
              onClick={() => onChange(value === k ? null : k)}
              style={{
                flex: 1,
                padding: '0.5rem',
                backgroundColor: value === k ? '#22c55e20' : '#0a0a0a',
                border: `1px solid ${value === k ? '#22c55e' : '#2a2a2a'}`,
                borderRadius: '6px',
                color: value === k ? '#22c55e' : '#6b7280',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem',
              }}
            >
              K{k}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // Report sub-view
  if (showReport) {
    return createPortal(
      <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }} onClick={() => setShowReport(false)}>
        <div style={{ backgroundColor: '#131318', borderRadius: '16px', border: '1px solid #2a2a2a', padding: '1.5rem', maxWidth: '420px', width: '100%' }} onClick={e => e.stopPropagation()}>
          <h3 style={{ color: '#fff', margin: '0 0 1rem', fontSize: '1rem', fontFamily: FONT_DISPLAY }}>
            🚩 Report Matchup Issue
          </h3>
          <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '0 0 1rem' }}>
            K{kingdomNumber} vs K{opponentKingdom} — KvK #{kvkNumber}
          </p>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.75rem', marginBottom: '0.35rem' }}>Issue Type</label>
            <select value={reportType} onChange={e => setReportType(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="wrong_matchup">Wrong matchup pairing</option>
              <option value="wrong_prep">Wrong prep result</option>
              <option value="wrong_battle">Wrong battle result</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.75rem', marginBottom: '0.35rem' }}>Description (optional)</label>
            <textarea value={reportDesc} onChange={e => setReportDesc(e.target.value)} placeholder="What's wrong?" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowReport(false)} style={{ padding: '0.6rem 1rem', backgroundColor: 'transparent', border: '1px solid #3a3a3a', borderRadius: '8px', color: '#9ca3af', cursor: 'pointer', fontSize: '0.85rem' }}>Cancel</button>
            <button onClick={handleReport} disabled={reportSubmitting} style={{ padding: '0.6rem 1.25rem', backgroundColor: '#ef4444', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', opacity: reportSubmitting ? 0.6 : 1 }}>
              {reportSubmitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#131318', borderRadius: '16px', border: '1px solid #2a2a2a',
          padding: '1.5rem', maxWidth: '480px', width: '100%', maxHeight: '90vh', overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '1.25rem' }}>
                {initialModeProp === 'prep' ? '🛡️' : initialModeProp === 'battle' ? '⚔️' : '📋'}
              </span>
              <h2 style={{ color: '#fff', fontSize: '1.15rem', fontWeight: 600, margin: 0, fontFamily: FONT_DISPLAY }}>
                <span style={{ color: '#fff' }}>KvK</span>
                <span style={{ ...neonGlow(initialModeProp === 'prep' ? '#eab308' : initialModeProp === 'battle' ? '#f97316' : '#22d3ee'), marginLeft: '0.3rem' }}>
                  {initialModeProp === 'prep' ? 'PREP RESULT' : initialModeProp === 'battle' ? 'BATTLE RESULT' : 'MATCHUP'}
                </span>
              </h2>
            </div>
            <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>
              {initialModeProp === 'prep' 
                ? 'Report who won the Prep Phase for your matchup'
                : initialModeProp === 'battle'
                ? 'Report who won the Battle Phase for your matchup'
                : 'Add matchup info progressively — matchup → prep → battle'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1 }}>×</button>
        </div>

        {/* KvK + Phase Badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <span style={{ color: '#22d3ee', fontWeight: 600, fontSize: '0.9rem', padding: '0.4rem 0.75rem', backgroundColor: '#22d3ee10', border: '1px solid #22d3ee30', borderRadius: '8px' }}>
            📅 KvK #{kvkNumber}
          </span>
          <span style={{ color: phaseInfo.color, fontWeight: 600, fontSize: '0.8rem', padding: '0.4rem 0.75rem', backgroundColor: `${phaseInfo.color}10`, border: `1px solid ${phaseInfo.color}30`, borderRadius: '8px' }}>
            {phaseInfo.icon} {phaseInfo.label}
          </span>
        </div>

        {/* No kingdom linked warning — skip when kingdom comes from profile page */}
        {!defaultKingdom && !isAdmin && !userKingdom && (
          <div style={{ padding: '0.75rem', backgroundColor: '#ef444410', border: '1px solid #ef444430', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.8rem', color: '#ef4444' }}>
            ⚠️ You must link your kingdom in your <strong>Profile</strong> before submitting matchups.
          </div>
        )}

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Kingdom Numbers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
                {defaultKingdom ? 'Kingdom' : 'Your Kingdom'} {!isAdmin && '(locked)'}
              </label>
              {isAdmin ? (
                <input
                  type="number"
                  value={kingdomNumber}
                  onChange={e => setKingdomNumber(e.target.value ? parseInt(e.target.value) : '')}
                  placeholder="e.g., 172"
                  min={1} max={9999}
                  style={inputStyle}
                />
              ) : (
                <div style={{ ...inputStyle, backgroundColor: '#0a0a0a', color: kingdomNumber ? '#22d3ee' : '#6b7280', fontWeight: 600 }}>
                  {kingdomNumber ? `K${kingdomNumber}` : 'Not linked'}
                </div>
              )}
            </div>
            <div>
              <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
                Opponent Kingdom *
              </label>
              <input
                type="number"
                value={opponentKingdom}
                onChange={e => setOpponentKingdom(e.target.value ? parseInt(e.target.value) : '')}
                placeholder="e.g., 189"
                min={1} max={9999}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Existing status */}
          {checkingExisting && (
            <div style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.8rem', padding: '0.5rem' }}>
              Checking existing data...
            </div>
          )}

          {statusBadge && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
              padding: '0.5rem', backgroundColor: `${statusBadge.color}15`, border: `1px solid ${statusBadge.color}30`,
              borderRadius: '8px',
            }}>
              <span>{statusBadge.icon}</span>
              <span style={{ color: statusBadge.color, fontWeight: 600, fontSize: '0.85rem' }}>
                {statusBadge.label}
              </span>
              {existing?.prep_result && (
                <span style={{ color: '#6b7280', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                  Prep: K{existing.prep_result === 'W' ? existing.kingdom_number : existing.opponent_kingdom} won
                </span>
              )}
            </div>
          )}

          {mode === 'full' && existing?.overall_result && (
            <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#22c55e10', border: '1px solid #22c55e30', borderRadius: '8px' }}>
              <span style={{ color: '#22c55e', fontWeight: 600, fontSize: '0.9rem' }}>
                ✅ This matchup is already complete — {existing.overall_result}
              </span>
            </div>
          )}

          {/* Prep Winner */}
          {kingdomNumber && opponentKingdom && kingdomNumber !== opponentKingdom && mode !== 'full' && (
            <WinnerPicker
              label="🛡️ Prep Phase Winner"
              labelColor="#eab308"
              value={prepWinner}
              onChange={setPrepWinner}
              disabled={mode === 'battle'}
              existingResult={existing?.prep_result}
              phaseBlocked={!canSubmitPrep && !existing?.prep_result}
              phaseMsg={schedule ? `Opens ${new Date(schedule.prep_open_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : undefined}
            />
          )}

          {/* Battle Winner */}
          {kingdomNumber && opponentKingdom && kingdomNumber !== opponentKingdom && mode !== 'full' && (
            (existing?.prep_result || prepWinner) && (
              <WinnerPicker
                label="⚔️ Battle Phase Winner"
                labelColor="#f97316"
                value={battleWinner}
                onChange={setBattleWinner}
                existingResult={existing?.battle_result}
                phaseBlocked={!canSubmitBattle && !existing?.battle_result}
                phaseMsg={schedule ? `Opens ${new Date(schedule.battle_open_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : undefined}
              />
            )
          )}

          {/* Outcome Preview */}
          {outcome && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.5rem', backgroundColor: `${outcome.color}15`, border: `1px solid ${outcome.color}40`, borderRadius: '6px' }}>
              <span style={{ color: outcome.color, fontWeight: 600, fontSize: '0.85rem' }}>
                {outcome.emoji} K{kingdomNumber} → {outcome.label}
              </span>
            </div>
          )}

          {/* Info Box */}
          {mode === 'matchup' && !existing && kingdomNumber && opponentKingdom && canSubmitMatchup && (
            <div style={{ padding: '0.6rem 0.8rem', backgroundColor: '#3b82f610', border: '1px solid #3b82f630', borderRadius: '8px', fontSize: '0.75rem', color: '#9ca3af', lineHeight: 1.5 }}>
              💡 <strong style={{ color: '#3b82f6' }}>Tip:</strong> You can submit just the matchup now, then come back to add prep and battle results later.
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', flexWrap: 'wrap' }}>
          {/* Report button (only show when existing data) */}
          <div>
            {existing && (
              <button
                onClick={() => setShowReport(true)}
                style={{ padding: '0.5rem 0.75rem', backgroundColor: 'transparent', border: '1px solid #ef444440', borderRadius: '6px', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
              >
                🚩 Report Issue
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={onClose}
              style={{ padding: '0.7rem 1.25rem', backgroundColor: 'transparent', border: '1px solid #3a3a3a', borderRadius: '8px', color: '#9ca3af', cursor: 'pointer', fontSize: '0.9rem' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isFormValid() || submitting || mode === 'full'}
              style={{
                padding: '0.7rem 1.5rem',
                backgroundColor: isFormValid() && mode !== 'full' ? '#22d3ee' : '#1a1a1a',
                border: 'none', borderRadius: '8px',
                color: isFormValid() && mode !== 'full' ? '#000' : '#6b7280',
                cursor: isFormValid() && mode !== 'full' ? 'pointer' : 'not-allowed',
                fontWeight: 600, fontSize: '0.9rem',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}
            >
              {submitting ? (
                <>
                  <span style={{ width: 14, height: 14, border: '2px solid transparent', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  Submitting...
                </>
              ) : phase === 'pre_matchup' && !isAdmin ? (
                'Matchups Not Open Yet'
              ) : mode === 'full' ? (
                'Already Complete'
              ) : mode === 'battle' ? (
                canSubmitBattle ? 'Update Battle Result' : 'Battle Not Open Yet'
              ) : mode === 'prep' && !prepWinner ? (
                canSubmitPrep ? 'Select Prep Winner' : 'Prep Not Open Yet'
              ) : prepWinner && !battleWinner ? (
                'Submit with Prep Result'
              ) : !prepWinner && !battleWinner ? (
                'Submit Matchup Only'
              ) : (
                'Submit'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default KvKMatchupSubmission;
