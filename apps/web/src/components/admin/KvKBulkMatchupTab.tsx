import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../Toast';
import { logger } from '../../utils/logger';
import { CURRENT_KVK } from '../../constants';
import { colors } from '../../utils/styles';

interface ParsedMatchup {
  kingdom1: number;
  kingdom2: number;
  valid: boolean;
  error?: string;
}

interface SubmitResult {
  kingdom1: number;
  kingdom2: number;
  success: boolean;
  error?: string;
}

const KvKBulkMatchupTab: React.FC = () => {
  const { showToast } = useToast();
  const [kvkNumber, setKvkNumber] = useState<number>(CURRENT_KVK);
  const [bulkText, setBulkText] = useState('');
  const [parsed, setParsed] = useState<ParsedMatchup[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<SubmitResult[]>([]);
  const [reports, setReports] = useState<Array<{
    id: string;
    kvk_number: number;
    kingdom_number: number;
    opponent_kingdom: number;
    report_type: string;
    description: string | null;
    status: string;
    created_at: string;
  }>>([]);
  const [loadingReports, setLoadingReports] = useState(false);

  // Parse bulk text into matchups
  const handleParse = () => {
    const lines = bulkText.trim().split('\n').filter(l => l.trim());
    const matchups: ParsedMatchup[] = lines.map(line => {
      // Support formats: "K172 vs K189", "172 vs 189", "172-189", "172,189", "172 189"
      const cleaned = line.replace(/[Kk]/g, '').trim();
      const parts = cleaned.split(/\s*(?:vs|VS|Vs|[-,\s])\s*/).filter(Boolean);
      
      if (parts.length !== 2) {
        return { kingdom1: 0, kingdom2: 0, valid: false, error: `Cannot parse: "${line}"` };
      }

      const k1 = parseInt(parts[0]!, 10);
      const k2 = parseInt(parts[1]!, 10);

      if (isNaN(k1) || isNaN(k2)) {
        return { kingdom1: 0, kingdom2: 0, valid: false, error: `Invalid numbers: "${line}"` };
      }

      if (k1 === k2) {
        return { kingdom1: k1, kingdom2: k2, valid: false, error: `Same kingdom: K${k1}` };
      }

      return { kingdom1: k1, kingdom2: k2, valid: true };
    });

    setParsed(matchups);
    setResults([]);

    const validCount = matchups.filter(m => m.valid).length;
    const invalidCount = matchups.filter(m => !m.valid).length;
    showToast(`Parsed ${validCount} valid matchups${invalidCount ? `, ${invalidCount} errors` : ''}`, validCount > 0 ? 'success' : 'error');
  };

  // Submit all valid matchups
  const handleSubmitAll = async () => {
    if (!supabase) return;
    const validMatchups = parsed.filter(m => m.valid);
    if (validMatchups.length === 0) {
      showToast('No valid matchups to submit', 'error');
      return;
    }

    setSubmitting(true);
    const submitResults: SubmitResult[] = [];

    for (const matchup of validMatchups) {
      try {
        const { data, error } = await supabase.rpc('submit_kvk_partial', {
          p_kingdom_number: matchup.kingdom1,
          p_opponent_kingdom: matchup.kingdom2,
          p_kvk_number: kvkNumber,
          p_prep_winner: null,
          p_battle_winner: null,
          p_is_admin: true,
        });

        if (error) {
          submitResults.push({ kingdom1: matchup.kingdom1, kingdom2: matchup.kingdom2, success: false, error: error.message });
        } else if (data?.error) {
          submitResults.push({ kingdom1: matchup.kingdom1, kingdom2: matchup.kingdom2, success: false, error: data.error });
        } else {
          submitResults.push({ kingdom1: matchup.kingdom1, kingdom2: matchup.kingdom2, success: true });
        }
      } catch (err) {
        submitResults.push({ kingdom1: matchup.kingdom1, kingdom2: matchup.kingdom2, success: false, error: String(err) });
      }
    }

    setResults(submitResults);
    setSubmitting(false);

    const successCount = submitResults.filter(r => r.success).length;
    const failCount = submitResults.filter(r => !r.success).length;
    showToast(`${successCount} matchups submitted${failCount ? `, ${failCount} failed` : ''}`, failCount > 0 ? 'error' : 'success');
  };

  // Load matchup reports for admin review
  const loadReports = async () => {
    if (!supabase) return;
    setLoadingReports(true);
    try {
      const { data, error } = await supabase
        .from('kvk_matchup_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setReports(data || []);
    } catch (err) {
      logger.error('Failed to load reports:', err);
      showToast('Failed to load reports', 'error');
    } finally {
      setLoadingReports(false);
    }
  };

  const resolveReport = async (reportId: string, status: 'resolved' | 'dismissed') => {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('kvk_matchup_reports')
        .update({ status, reviewed_at: new Date().toISOString() })
        .eq('id', reportId);
      if (error) throw error;
      showToast(`Report ${status}`, 'success');
      loadReports();
    } catch {
      showToast('Failed to update report', 'error');
    }
  };

  const inputStyle: React.CSSProperties = {
    padding: '0.65rem',
    backgroundColor: '#0a0a0a',
    border: '1px solid #2a2a2a',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '0.9rem',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Bulk Matchup Input */}
      <div style={{ backgroundColor: colors.cardAlt, borderRadius: '12px', padding: '1.5rem', border: '1px solid #2a2a2a' }}>
        <h3 style={{ color: '#22d3ee', fontSize: '1.1rem', fontWeight: 600, margin: '0 0 1rem' }}>
          📋 Bulk Matchup Input
        </h3>
        <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0 0 1rem' }}>
          Paste matchups one per line. Supported formats: <code style={{ color: '#9ca3af' }}>K172 vs K189</code>, <code style={{ color: '#9ca3af' }}>172-189</code>, <code style={{ color: '#9ca3af' }}>172,189</code>
        </p>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.75rem', marginBottom: '0.35rem' }}>KvK #</label>
            <input
              type="number"
              value={kvkNumber}
              onChange={e => setKvkNumber(parseInt(e.target.value) || CURRENT_KVK)}
              style={{ ...inputStyle, width: '80px' }}
            />
          </div>
          <button
            onClick={handleParse}
            disabled={!bulkText.trim()}
            style={{
              padding: '0.65rem 1.25rem',
              backgroundColor: bulkText.trim() ? '#3b82f6' : '#1a1a1a',
              border: 'none', borderRadius: '6px',
              color: bulkText.trim() ? '#fff' : '#6b7280',
              cursor: bulkText.trim() ? 'pointer' : 'not-allowed',
              fontWeight: 600, fontSize: '0.85rem',
            }}
          >
            Parse
          </button>
          {parsed.length > 0 && parsed.some(m => m.valid) && (
            <button
              onClick={handleSubmitAll}
              disabled={submitting}
              style={{
                padding: '0.65rem 1.25rem',
                backgroundColor: '#22c55e',
                border: 'none', borderRadius: '6px',
                color: '#fff',
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontWeight: 600, fontSize: '0.85rem',
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? 'Submitting...' : `Submit ${parsed.filter(m => m.valid).length} Matchups`}
            </button>
          )}
        </div>

        <textarea
          value={bulkText}
          onChange={e => setBulkText(e.target.value)}
          placeholder={`K172 vs K189\nK201 vs K315\n420-530\n600,712`}
          rows={8}
          style={{ ...inputStyle, width: '100%', resize: 'vertical', fontFamily: 'monospace' }}
        />

        {/* Parsed preview */}
        {parsed.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <h4 style={{ color: '#9ca3af', fontSize: '0.8rem', marginBottom: '0.5rem' }}>Preview ({parsed.filter(m => m.valid).length} valid, {parsed.filter(m => !m.valid).length} errors)</h4>
            <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {parsed.map((m, i) => {
                const result = results[i] || (results.length > 0 ? results.find(r => r.kingdom1 === m.kingdom1 && r.kingdom2 === m.kingdom2) : null);
                return (
                  <div key={i} style={{
                    padding: '0.35rem 0.6rem',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    backgroundColor: !m.valid ? '#ef444410' : result?.success ? '#22c55e10' : result?.error ? '#ef444410' : '#22d3ee08',
                    color: !m.valid ? '#ef4444' : result?.success ? '#22c55e' : result?.error ? '#ef4444' : '#d1d5db',
                    display: 'flex', justifyContent: 'space-between',
                  }}>
                    <span>{m.valid ? `K${m.kingdom1} vs K${m.kingdom2}` : m.error}</span>
                    {result && <span>{result.success ? '✓' : `✗ ${result.error}`}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Matchup Reports Review */}
      <div style={{ backgroundColor: colors.cardAlt, borderRadius: '12px', padding: '1.5rem', border: '1px solid #2a2a2a' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ color: '#ef4444', fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
            🚩 Matchup Reports ({reports.filter(r => r.status === 'pending').length} pending)
          </h3>
          <button
            onClick={loadReports}
            disabled={loadingReports}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#1a1a1a',
              border: '1px solid #2a2a2a', borderRadius: '6px',
              color: '#9ca3af', cursor: 'pointer', fontSize: '0.8rem',
            }}
          >
            {loadingReports ? 'Loading...' : 'Load Reports'}
          </button>
        </div>

        {reports.length === 0 ? (
          <div style={{ color: '#6b7280', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
            {loadingReports ? 'Loading...' : 'Click "Load Reports" to see user reports'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {reports.map(report => (
              <div key={report.id} style={{
                padding: '0.75rem',
                backgroundColor: '#0a0a0a',
                borderRadius: '8px',
                border: `1px solid ${report.status === 'pending' ? '#ef444430' : '#2a2a2a'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#22d3ee', fontWeight: 600, fontSize: '0.9rem' }}>
                    K{report.kingdom_number} vs K{report.opponent_kingdom} — KvK #{report.kvk_number}
                  </span>
                  <span style={{
                    padding: '0.15rem 0.5rem',
                    borderRadius: '9999px',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    backgroundColor: report.status === 'pending' ? '#fbbf2420' : report.status === 'resolved' ? '#22c55e20' : '#6b728020',
                    color: report.status === 'pending' ? '#fbbf24' : report.status === 'resolved' ? '#22c55e' : '#6b7280',
                  }}>
                    {report.status.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
                  <strong style={{ color: '#d1d5db' }}>{report.report_type.replace(/_/g, ' ')}</strong>
                  {report.description && <span> — {report.description}</span>}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>
                  {new Date(report.created_at).toLocaleDateString()}
                </div>
                {report.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button
                      onClick={() => resolveReport(report.id, 'resolved')}
                      style={{ padding: '0.3rem 0.75rem', backgroundColor: '#22c55e', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Resolve
                    </button>
                    <button
                      onClick={() => resolveReport(report.id, 'dismissed')}
                      style={{ padding: '0.3rem 0.75rem', backgroundColor: '#6b7280', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default KvKBulkMatchupTab;
