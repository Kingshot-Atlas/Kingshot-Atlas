import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface DailyRedemption {
  date: string;
  total: number;
  success: number;
  failed: number;
}

interface TopCode {
  code: string;
  attempts: number;
  successes: number;
  successRate: number;
}

interface GiftCodeStats {
  total24h: number;
  totalAll: number;
  successRate: number;
  uniquePlayers: number;
  dailyRedemptions: DailyRedemption[];
  topCodes: TopCode[];
  recentRedemptions: Array<{
    code: string;
    player_id: string;
    success: boolean;
    message: string | null;
    created_at: string;
  }>;
}

export const GiftCodeAnalyticsTab: React.FC = () => {
  const [stats, setStats] = useState<GiftCodeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('7d');

  useEffect(() => {
    fetchStats();
  }, [timeRange]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const rangeStart = timeRange === '7d'
        ? new Date(now.getTime() - 7 * 86400000).toISOString()
        : timeRange === '30d'
          ? new Date(now.getTime() - 30 * 86400000).toISOString()
          : '2020-01-01T00:00:00Z';

      const last24h = new Date(now.getTime() - 86400000).toISOString();

      // Fetch all redemptions in range
      if (!supabase) throw new Error('Supabase not initialized');
      const { data: redemptions, error } = await supabase
        .from('gift_code_redemptions')
        .select('code, player_id, success, message, error_code, created_at')
        .gte('created_at', rangeStart)
        .order('created_at', { ascending: false })
        .limit(5000);

      if (error) throw error;
      const rows = redemptions || [];

      // 24h count
      const total24h = rows.filter(r => r.created_at >= last24h).length;

      // Success rate
      const successes = rows.filter(r => r.success).length;
      const successRate = rows.length > 0 ? (successes / rows.length) * 100 : 0;

      // Unique players
      const uniquePlayers = new Set(rows.map(r => r.player_id)).size;

      // Daily aggregation
      const dailyMap = new Map<string, { total: number; success: number; failed: number }>();
      rows.forEach(r => {
        const day = r.created_at.slice(0, 10);
        const entry = dailyMap.get(day) || { total: 0, success: 0, failed: 0 };
        entry.total++;
        if (r.success) entry.success++;
        else entry.failed++;
        dailyMap.set(day, entry);
      });
      const dailyRedemptions = [...dailyMap.entries()]
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Top codes
      const codeMap = new Map<string, { attempts: number; successes: number }>();
      rows.forEach(r => {
        const entry = codeMap.get(r.code) || { attempts: 0, successes: 0 };
        entry.attempts++;
        if (r.success) entry.successes++;
        codeMap.set(r.code, entry);
      });
      const topCodes = [...codeMap.entries()]
        .map(([code, data]) => ({
          code,
          attempts: data.attempts,
          successes: data.successes,
          successRate: data.attempts > 0 ? (data.successes / data.attempts) * 100 : 0,
        }))
        .sort((a, b) => b.attempts - a.attempts)
        .slice(0, 10);

      // Recent redemptions (last 20)
      const recentRedemptions = rows.slice(0, 20).map(r => ({
        code: r.code,
        player_id: r.player_id,
        success: r.success,
        message: r.message,
        created_at: r.created_at,
      }));

      setStats({
        total24h,
        totalAll: rows.length,
        successRate,
        uniquePlayers,
        dailyRedemptions,
        topCodes,
        recentRedemptions,
      });
    } catch (err) {
      console.error('Failed to fetch gift code stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', color: '#6b7280', textAlign: 'center' }}>
        Loading gift code analytics...
      </div>
    );
  }

  if (!stats) {
    return (
      <div style={{ padding: '2rem', color: '#6b7280', textAlign: 'center' }}>
        Failed to load analytics data.
      </div>
    );
  }

  return (
    <div>
      {/* Time Range Selector */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {(['7d', '30d', 'all'] as const).map(range => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            style={{
              padding: '0.35rem 0.7rem',
              backgroundColor: timeRange === range ? '#f59e0b20' : 'transparent',
              color: timeRange === range ? '#f59e0b' : '#6b7280',
              border: timeRange === range ? '1px solid #f59e0b40' : '1px solid transparent',
              borderRadius: '6px',
              fontWeight: 500,
              cursor: 'pointer',
              fontSize: '0.8rem',
            }}
          >
            {range === '7d' ? 'Last 7 Days' : range === '30d' ? 'Last 30 Days' : 'All Time'}
          </button>
        ))}
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {[
          { label: 'Last 24h', value: stats.total24h.toString(), color: '#22d3ee' },
          { label: 'Total Redemptions', value: stats.totalAll.toString(), color: '#f59e0b' },
          { label: 'Success Rate', value: `${stats.successRate.toFixed(1)}%`, color: stats.successRate >= 50 ? '#22c55e' : '#ef4444' },
          { label: 'Unique Players', value: stats.uniquePlayers.toString(), color: '#a855f7' },
        ].map(card => (
          <div key={card.label} style={{
            padding: '0.75rem', backgroundColor: '#111116', borderRadius: '10px',
            border: '1px solid #2a2a2a',
          }}>
            <div style={{ fontSize: '0.65rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>
              {card.label}
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: card.color }}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Daily Redemptions Chart (simple bar visualization) */}
      {stats.dailyRedemptions.length > 0 && (
        <div style={{ marginBottom: '1.25rem', padding: '1rem', backgroundColor: '#111116', borderRadius: '10px', border: '1px solid #2a2a2a' }}>
          <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 600, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Redemptions / Day
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '80px' }}>
            {stats.dailyRedemptions.slice(-14).map(day => {
              const maxTotal = Math.max(...stats.dailyRedemptions.slice(-14).map(d => d.total), 1);
              const height = Math.max((day.total / maxTotal) * 100, 4);
              const successPct = day.total > 0 ? (day.success / day.total) * 100 : 0;
              return (
                <div
                  key={day.date}
                  title={`${day.date}: ${day.total} total, ${day.success} success, ${day.failed} failed`}
                  style={{
                    flex: 1,
                    height: `${height}%`,
                    borderRadius: '3px 3px 0 0',
                    background: `linear-gradient(180deg, #22c55e ${successPct}%, #ef4444 ${successPct}%)`,
                    minWidth: '6px',
                    cursor: 'pointer',
                    opacity: 0.8,
                    transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.8')}
                />
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.3rem' }}>
            <span style={{ fontSize: '0.55rem', color: '#4b5563' }}>
              {stats.dailyRedemptions.slice(-14)[0]?.date}
            </span>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.55rem', color: '#22c55e' }}>■ Success</span>
              <span style={{ fontSize: '0.55rem', color: '#ef4444' }}>■ Failed</span>
            </div>
            <span style={{ fontSize: '0.55rem', color: '#4b5563' }}>
              {stats.dailyRedemptions.slice(-14)[stats.dailyRedemptions.slice(-14).length - 1]?.date}
            </span>
          </div>
        </div>
      )}

      {/* Top Codes Table */}
      {stats.topCodes.length > 0 && (
        <div style={{ marginBottom: '1.25rem', padding: '1rem', backgroundColor: '#111116', borderRadius: '10px', border: '1px solid #2a2a2a' }}>
          <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 600, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Top Codes
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '0.4rem 1rem', fontSize: '0.75rem' }}>
            <div style={{ color: '#4b5563', fontWeight: 600 }}>Code</div>
            <div style={{ color: '#4b5563', fontWeight: 600, textAlign: 'right' }}>Attempts</div>
            <div style={{ color: '#4b5563', fontWeight: 600, textAlign: 'right' }}>Success</div>
            <div style={{ color: '#4b5563', fontWeight: 600, textAlign: 'right' }}>Rate</div>
            {stats.topCodes.map(tc => (
              <React.Fragment key={tc.code}>
                <div style={{ color: '#e5e7eb', fontFamily: 'monospace', fontSize: '0.7rem' }}>{tc.code}</div>
                <div style={{ color: '#9ca3af', textAlign: 'right' }}>{tc.attempts}</div>
                <div style={{ color: '#22c55e', textAlign: 'right' }}>{tc.successes}</div>
                <div style={{
                  textAlign: 'right',
                  color: tc.successRate >= 70 ? '#22c55e' : tc.successRate >= 40 ? '#f59e0b' : '#ef4444',
                }}>
                  {tc.successRate.toFixed(0)}%
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Recent Redemptions */}
      {stats.recentRedemptions.length > 0 && (
        <div style={{ padding: '1rem', backgroundColor: '#111116', borderRadius: '10px', border: '1px solid #2a2a2a' }}>
          <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 600, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Recent Redemptions
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {stats.recentRedemptions.map((r, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.35rem 0.5rem', borderRadius: '6px',
                backgroundColor: r.success ? '#22c55e08' : '#ef444408',
                fontSize: '0.7rem',
              }}>
                <span style={{ color: r.success ? '#22c55e' : '#ef4444', fontWeight: 600, width: '12px' }}>
                  {r.success ? '✓' : '✗'}
                </span>
                <span style={{ color: '#e5e7eb', fontFamily: 'monospace', minWidth: '100px' }}>{r.code}</span>
                <span style={{ color: '#6b7280', flex: 1 }}>Player {r.player_id.slice(0, 6)}...</span>
                <span style={{ color: '#4b5563', fontSize: '0.6rem' }}>
                  {new Date(r.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {stats.totalAll === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#4b5563' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
          <p style={{ fontSize: '0.85rem' }}>No gift code redemption data yet.</p>
          <p style={{ fontSize: '0.7rem' }}>Data will appear once users start redeeming codes through Atlas.</p>
        </div>
      )}
    </div>
  );
};

export default GiftCodeAnalyticsTab;
