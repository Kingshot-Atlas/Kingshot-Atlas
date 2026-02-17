import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { colors } from '../../utils/styles';

interface OutcomeRow {
  id: string;
  application_id: string;
  confirmed_role: string;
  did_transfer: boolean;
  satisfaction_rating: number | null;
  feedback: string | null;
  created_at: string;
  kingdom_number?: number;
  applicant_username?: string;
}

interface OutcomeStats {
  total: number;
  transferred: number;
  notTransferred: number;
  avgSatisfaction: number;
  byKingdom: { kingdom_number: number; count: number; transferred: number; avgRating: number }[];
}

const TransferOutcomesTab: React.FC = () => {
  const [outcomes, setOutcomes] = useState<OutcomeRow[]>([]);
  const [stats, setStats] = useState<OutcomeStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOutcomes();
  }, []);

  const loadOutcomes = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      // Fetch all outcomes with application details
      const { data: rawOutcomes } = await supabase
        .from('transfer_outcomes')
        .select('id, application_id, confirmed_role, did_transfer, satisfaction_rating, feedback, created_at')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!rawOutcomes || rawOutcomes.length === 0) {
        setOutcomes([]);
        setStats({ total: 0, transferred: 0, notTransferred: 0, avgSatisfaction: 0, byKingdom: [] });
        setLoading(false);
        return;
      }

      // Enrich with application data
      const appIds = [...new Set(rawOutcomes.map(o => o.application_id))];
      const { data: apps } = await supabase
        .from('transfer_applications')
        .select('id, kingdom_number, applicant_user_id')
        .in('id', appIds);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', (apps || []).map(a => a.applicant_user_id));

      const appMap = new Map((apps || []).map(a => [a.id, a]));
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      const enriched: OutcomeRow[] = rawOutcomes.map(o => {
        const app = appMap.get(o.application_id);
        const profile = app ? profileMap.get(app.applicant_user_id) : null;
        return {
          ...o,
          kingdom_number: app?.kingdom_number,
          applicant_username: profile?.username || 'Unknown',
        };
      });

      setOutcomes(enriched);

      // Compute stats
      const transferred = enriched.filter(o => o.did_transfer).length;
      const ratings = enriched.filter(o => o.satisfaction_rating).map(o => o.satisfaction_rating!);
      const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

      // Per-kingdom breakdown
      const kingdomMap = new Map<number, { count: number; transferred: number; ratings: number[] }>();
      for (const o of enriched) {
        if (!o.kingdom_number) continue;
        const entry = kingdomMap.get(o.kingdom_number) || { count: 0, transferred: 0, ratings: [] };
        entry.count++;
        if (o.did_transfer) entry.transferred++;
        if (o.satisfaction_rating) entry.ratings.push(o.satisfaction_rating);
        kingdomMap.set(o.kingdom_number, entry);
      }

      const byKingdom = [...kingdomMap.entries()]
        .map(([kn, v]) => ({
          kingdom_number: kn,
          count: v.count,
          transferred: v.transferred,
          avgRating: v.ratings.length > 0 ? v.ratings.reduce((a, b) => a + b, 0) / v.ratings.length : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);

      setStats({
        total: enriched.length,
        transferred,
        notTransferred: enriched.length - transferred,
        avgSatisfaction: Math.round(avgRating * 10) / 10,
        byKingdom,
      });
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '2rem', color: colors.textMuted }}>Loading outcomes...</div>;
  }

  if (!stats || stats.total === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <div style={{ fontSize: '2rem', opacity: 0.5, marginBottom: '0.5rem' }}>📋</div>
        <p style={{ color: colors.textMuted, fontSize: '0.85rem' }}>No transfer outcomes submitted yet.</p>
        <p style={{ color: colors.textMuted, fontSize: '0.7rem' }}>Outcomes appear after accepted applicants or recruiters confirm whether the transfer happened.</p>
      </div>
    );
  }

  const successRate = stats.total > 0 ? Math.round((stats.transferred / stats.total) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem' }}>
        {[
          { label: 'Total Outcomes', value: stats.total, color: '#a855f7' },
          { label: 'Transferred', value: stats.transferred, color: '#22c55e' },
          { label: 'Did Not Transfer', value: stats.notTransferred, color: '#ef4444' },
          { label: 'Success Rate', value: `${successRate}%`, color: successRate >= 50 ? '#22c55e' : '#f59e0b' },
          { label: 'Avg Satisfaction', value: stats.avgSatisfaction > 0 ? `${stats.avgSatisfaction}/5` : '—', color: '#fbbf24' },
        ].map(card => (
          <div key={card.label} style={{
            padding: '0.75rem',
            backgroundColor: colors.bg,
            border: `1px solid ${colors.border}`,
            borderRadius: '8px',
            textAlign: 'center',
          }}>
            <div style={{ color: card.color, fontSize: '1.5rem', fontWeight: '700' }}>{card.value}</div>
            <div style={{ color: colors.textMuted, fontSize: '0.65rem', marginTop: '0.2rem' }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Per-Kingdom Breakdown */}
      {stats.byKingdom.length > 0 && (
        <div style={{
          padding: '0.75rem',
          backgroundColor: colors.bg,
          border: `1px solid ${colors.border}`,
          borderRadius: '10px',
        }}>
          <h4 style={{ color: colors.text, fontSize: '0.8rem', fontWeight: '700', margin: '0 0 0.5rem 0' }}>
            Success Rate by Kingdom
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {stats.byKingdom.map(k => {
              const rate = k.count > 0 ? Math.round((k.transferred / k.count) * 100) : 0;
              return (
                <div key={k.kingdom_number} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: '#22d3ee', fontSize: '0.75rem', fontWeight: '600', minWidth: '50px' }}>
                    K{k.kingdom_number}
                  </span>
                  <div style={{ flex: 1, height: '16px', backgroundColor: '#1a1a1a', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                    <div style={{
                      width: `${rate}%`,
                      height: '100%',
                      backgroundColor: rate >= 70 ? '#22c55e30' : rate >= 40 ? '#f59e0b30' : '#ef444430',
                      borderRadius: '4px',
                    }} />
                    <span style={{
                      position: 'absolute', left: '0.4rem', top: '50%', transform: 'translateY(-50%)',
                      color: colors.text, fontSize: '0.6rem', fontWeight: '600',
                    }}>
                      {rate}% ({k.transferred}/{k.count})
                    </span>
                  </div>
                  {k.avgRating > 0 && (
                    <span style={{ color: '#fbbf24', fontSize: '0.65rem', minWidth: '35px', textAlign: 'right' }}>
                      ⭐ {k.avgRating.toFixed(1)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Outcomes Table */}
      <div style={{
        padding: '0.75rem',
        backgroundColor: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: '10px',
      }}>
        <h4 style={{ color: colors.text, fontSize: '0.8rem', fontWeight: '700', margin: '0 0 0.5rem 0' }}>
          Recent Outcomes
        </h4>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                <th style={{ textAlign: 'left', padding: '0.4rem', color: colors.textMuted, fontWeight: '600' }}>Player</th>
                <th style={{ textAlign: 'left', padding: '0.4rem', color: colors.textMuted, fontWeight: '600' }}>Kingdom</th>
                <th style={{ textAlign: 'left', padding: '0.4rem', color: colors.textMuted, fontWeight: '600' }}>Role</th>
                <th style={{ textAlign: 'center', padding: '0.4rem', color: colors.textMuted, fontWeight: '600' }}>Transferred?</th>
                <th style={{ textAlign: 'center', padding: '0.4rem', color: colors.textMuted, fontWeight: '600' }}>Rating</th>
                <th style={{ textAlign: 'right', padding: '0.4rem', color: colors.textMuted, fontWeight: '600' }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {outcomes.slice(0, 25).map(o => (
                <tr key={o.id} style={{ borderBottom: `1px solid ${colors.border}10` }}>
                  <td style={{ padding: '0.4rem', color: colors.text }}>{o.applicant_username}</td>
                  <td style={{ padding: '0.4rem', color: '#22d3ee' }}>K{o.kingdom_number || '?'}</td>
                  <td style={{ padding: '0.4rem' }}>
                    <span style={{
                      padding: '0.05rem 0.3rem',
                      backgroundColor: o.confirmed_role === 'recruiter' ? '#a855f715' : '#22d3ee15',
                      border: `1px solid ${o.confirmed_role === 'recruiter' ? '#a855f730' : '#22d3ee30'}`,
                      borderRadius: '3px',
                      fontSize: '0.6rem',
                      color: o.confirmed_role === 'recruiter' ? '#a855f7' : '#22d3ee',
                      textTransform: 'capitalize',
                    }}>
                      {o.confirmed_role}
                    </span>
                  </td>
                  <td style={{ padding: '0.4rem', textAlign: 'center' }}>
                    <span style={{ color: o.did_transfer ? '#22c55e' : '#ef4444', fontWeight: '600' }}>
                      {o.did_transfer ? '✅' : '❌'}
                    </span>
                  </td>
                  <td style={{ padding: '0.4rem', textAlign: 'center', color: '#fbbf24' }}>
                    {o.satisfaction_rating ? `${o.satisfaction_rating}/5` : '—'}
                  </td>
                  <td style={{ padding: '0.4rem', textAlign: 'right', color: colors.textMuted }}>
                    {new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TransferOutcomesTab;
