import React, { useState, useEffect, useCallback } from 'react';
import type { AnalyticsData } from './types';
import { getAuthHeaders } from '../../services/authHeaders';

const API_URL = import.meta.env.VITE_API_URL || '';

// --- Mini Area Chart (SVG) ---
interface AreaChartProps {
  data: number[];
  labels?: string[];
  color: string;
  height?: number;
}

const MiniAreaChart: React.FC<AreaChartProps> = ({ data, labels, color, height = 120 }) => {
  if (!data.length) return null;
  const W = 600;
  const H = height;
  const PAD = { top: 10, right: 10, bottom: 24, left: 40 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const max = Math.max(...data, 1);
  const step = chartW / Math.max(data.length - 1, 1);

  const points = data.map((v, i) => ({
    x: PAD.left + i * step,
    y: PAD.top + chartH - (v / max) * chartH,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1]!.x},${PAD.top + chartH} L${PAD.left},${PAD.top + chartH} Z`;

  // Y-axis ticks (4 levels)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(pct => ({
    value: Math.round(max * pct),
    y: PAD.top + chartH - pct * chartH,
  }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} preserveAspectRatio="xMidYMid meet">
      {/* Grid lines */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y} stroke="#1f1f24" strokeWidth={1} />
          <text x={PAD.left - 6} y={t.y + 3} textAnchor="end" fill="#4b5563" fontSize={9}>{t.value}</text>
        </g>
      ))}
      {/* Area fill */}
      <path d={areaPath} fill={`${color}15`} />
      {/* Line */}
      <path d={linePath} fill="none" stroke={color} strokeWidth={2} />
      {/* Dots */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={color} />
      ))}
      {/* X-axis labels (every ~7 days) */}
      {labels && labels.map((l, i) => {
        if (data.length <= 7 || i % Math.ceil(data.length / 7) === 0 || i === data.length - 1) {
          return (
            <text key={i} x={PAD.left + i * step} y={H - 4} textAnchor="middle" fill="#4b5563" fontSize={8}>
              {l}
            </text>
          );
        }
        return null;
      })}
    </svg>
  );
};

// --- Collapsible Section ---
const CollapsibleChart: React.FC<{
  title: string;
  color: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}> = ({ title, color, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      backgroundColor: '#111116',
      borderRadius: '10px',
      border: `1px solid ${open ? color + '30' : '#2a2a2a'}`,
      overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#fff',
        }}
      >
        <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{title}</span>
        <span style={{
          color: '#6b7280',
          fontSize: '0.75rem',
          transition: 'transform 0.2s',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>▼</span>
      </button>
      {open && (
        <div style={{ padding: '0 1rem 1rem' }}>
          {children}
        </div>
      )}
    </div>
  );
};

// --- Stacked Bar for User Breakdown ---
const BreakdownBar: React.FC<{ breakdown: { label: string; value: number; color: string }[] }> = ({ breakdown }) => {
  const total = breakdown.reduce((s, b) => s + b.value, 0) || 1;
  return (
    <div>
      <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', height: '28px', marginBottom: '0.5rem' }}>
        {breakdown.map((b, i) => (
          <div
            key={i}
            style={{
              width: `${(b.value / total) * 100}%`,
              backgroundColor: b.color,
              minWidth: b.value > 0 ? '2px' : 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'width 0.3s',
            }}
          >
            {(b.value / total) > 0.08 && (
              <span style={{ fontSize: '0.65rem', color: '#fff', fontWeight: '600' }}>{b.value}</span>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
        {breakdown.map((b, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: b.color }} />
            <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{b.label}: <span style={{ color: '#fff', fontWeight: '600' }}>{b.value}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
};

interface AnalyticsOverviewProps {
  analytics: AnalyticsData | null;
  syncingSubscriptions: boolean;
  onSyncSubscriptions: () => void;
  currentKvK: number;
  incrementingKvK: boolean;
  onIncrementKvK: () => void;
}

interface TimeseriesPoint { date: string; visitors: number; pageviews: number }
interface UserGrowthData {
  signups: { date: string; count: number }[];
  cumulative: { date: string; total: number }[];
  total_users: number;
  breakdown: { free: number; supporter: number; recruiter: number; kingshot_linked: number };
}

export const AnalyticsOverview: React.FC<AnalyticsOverviewProps> = ({
  analytics,
  syncingSubscriptions,
  onSyncSubscriptions,
  currentKvK,
  incrementingKvK,
  onIncrementKvK
}) => {
  const [timeseries, setTimeseries] = useState<TimeseriesPoint[]>([]);
  const [userGrowth, setUserGrowth] = useState<UserGrowthData | null>(null);
  const [chartsLoading, setChartsLoading] = useState(false);

  const fetchGrowthData = useCallback(async () => {
    setChartsLoading(true);
    try {
      const headers = await getAuthHeaders({ requireAuth: false });
      const [tsRes, ugRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/admin/stats/plausible/timeseries?period=30d`, { headers }),
        fetch(`${API_URL}/api/v1/admin/stats/user-growth`, { headers }),
      ]);
      if (tsRes.ok) {
        const tsData = await tsRes.json();
        setTimeseries(tsData.results || []);
      }
      if (ugRes.ok) {
        const ugData = await ugRes.json();
        setUserGrowth(ugData);
      }
    } catch (e) {
      console.error('Failed to load growth data:', e);
    } finally {
      setChartsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGrowthData();
  }, [fetchGrowthData]);

  if (!analytics) {
    return <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>Loading analytics...</div>;
  }

  const fmtDate = (d: string) => {
    const parts = d.split('-');
    return `${parts[1]}/${parts[2]}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Key Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        {[
          { label: analytics.bounceRate ? 'Visitors (30d)' : 'Total Events', value: (analytics.bounceRate ? analytics.uniqueVisitors : analytics.totalVisits).toLocaleString(), color: '#22d3ee', icon: '👁️' },
          { label: analytics.bounceRate ? 'Page Views (30d)' : 'Page Views', value: (analytics.totalPageViews ?? (Array.isArray(analytics.pageViews) ? analytics.pageViews.length : 0)).toLocaleString(), color: '#a855f7', icon: '📄' },
          { label: 'Total Users', value: analytics.userStats.total.toLocaleString(), color: '#22c55e', icon: '👥' },
          { label: 'Monthly Revenue', value: `$${analytics.revenue.monthly.toFixed(2)}`, color: '#fbbf24', icon: '💰' },
        ].map((metric, i) => (
          <div key={i} style={{
            backgroundColor: '#111116',
            borderRadius: '12px',
            padding: '1.25rem',
            border: '1px solid #2a2a2a'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span>{metric.icon}</span>
              <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>{metric.label}</span>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: '700', color: metric.color }}>
              {metric.value}
            </div>
          </div>
        ))}
      </div>

      {/* Growth Charts (Collapsible) */}
      {chartsLoading ? (
        <div style={{ textAlign: 'center', padding: '1rem', color: '#6b7280', fontSize: '0.8rem' }}>Loading growth charts...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Visitors Growth */}
          {timeseries.length > 0 && (
            <CollapsibleChart title="📈 Visitors — 30 Day Trend" color="#22d3ee">
              <MiniAreaChart
                data={timeseries.map(t => t.visitors)}
                labels={timeseries.map(t => fmtDate(t.date))}
                color="#22d3ee"
              />
            </CollapsibleChart>
          )}

          {/* Page Views Growth */}
          {timeseries.length > 0 && (
            <CollapsibleChart title="📄 Page Views — 30 Day Trend" color="#a855f7">
              <MiniAreaChart
                data={timeseries.map(t => t.pageviews)}
                labels={timeseries.map(t => fmtDate(t.date))}
                color="#a855f7"
              />
            </CollapsibleChart>
          )}

          {/* Total Users Growth */}
          {userGrowth && userGrowth.cumulative.length > 0 && (
            <CollapsibleChart title="👥 Total Users — 30 Day Growth" color="#22c55e">
              <MiniAreaChart
                data={userGrowth.cumulative.map(c => c.total)}
                labels={userGrowth.cumulative.map(c => fmtDate(c.date))}
                color="#22c55e"
              />
              <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
                New signups in period: <span style={{ color: '#22c55e', fontWeight: '600' }}>
                  {userGrowth.signups.reduce((s, d) => s + d.count, 0)}
                </span>
              </div>
            </CollapsibleChart>
          )}

          {/* User Breakdown Chart */}
          {userGrowth && (
            <CollapsibleChart title="🧩 User Breakdown" color="#f59e0b">
              <BreakdownBar breakdown={[
                { label: 'Free', value: userGrowth.breakdown.free, color: '#6b7280' },
                { label: 'Kingshot Linked', value: userGrowth.breakdown.kingshot_linked, color: '#f59e0b' },
                { label: 'Supporter', value: userGrowth.breakdown.supporter, color: '#FF6B8A' },
                { label: 'Recruiter', value: userGrowth.breakdown.recruiter, color: '#22d3ee' },
              ]} />
            </CollapsibleChart>
          )}
        </div>
      )}

      {/* User Breakdown */}
      <div style={{ backgroundColor: '#111116', borderRadius: '12px', padding: '1.5rem', border: '1px solid #2a2a2a' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ color: '#fff', fontSize: '1rem', margin: 0 }}>👥 User Breakdown</h3>
          <button
            onClick={onSyncSubscriptions}
            disabled={syncingSubscriptions}
            style={{
              padding: '0.35rem 0.75rem',
              backgroundColor: syncingSubscriptions ? '#374151' : '#22d3ee20',
              color: syncingSubscriptions ? '#6b7280' : '#22d3ee',
              border: '1px solid #22d3ee40',
              borderRadius: '6px',
              fontSize: '0.75rem',
              cursor: syncingSubscriptions ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            {syncingSubscriptions ? '⏳ Syncing...' : '🔄 Sync with Stripe'}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem' }}>
          {[
            { label: 'Free Users', value: analytics.userStats.free, color: '#6b7280' },
            { label: 'Kingshot Linked', value: analytics.userStats.kingshot_linked, color: '#f59e0b' },
            { label: 'Atlas Supporter', value: analytics.userStats.pro, color: '#FF6B8A' },
            { label: 'Atlas Recruiter', value: analytics.userStats.recruiter, color: '#22d3ee' },
          ].map((tier, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: tier.color }}>{tier.value}</div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{tier.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* KvK Management */}
      <div style={{ backgroundColor: '#111116', borderRadius: '12px', padding: '1.5rem', border: '1px solid #8b5cf640' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ color: '#fff', fontSize: '1rem', margin: 0 }}>⚔️ KvK Management</h3>
          <div style={{ 
            padding: '0.25rem 0.75rem', 
            backgroundColor: '#8b5cf620', 
            borderRadius: '6px',
            border: '1px solid #8b5cf640'
          }}>
            <span style={{ color: '#8b5cf6', fontWeight: '600', fontSize: '0.9rem' }}>Current: KvK #{currentKvK}</span>
          </div>
        </div>
        <p style={{ color: '#9ca3af', fontSize: '0.8rem', marginBottom: '1rem' }}>
          After each KvK battle phase ends, increment the KvK number to update submission forms and missing data tracking across the app.
        </p>
        <button
          onClick={onIncrementKvK}
          disabled={incrementingKvK}
          style={{
            padding: '0.6rem 1.25rem',
            backgroundColor: incrementingKvK ? '#374151' : '#8b5cf620',
            color: incrementingKvK ? '#6b7280' : '#8b5cf6',
            border: '1px solid #8b5cf6',
            borderRadius: '8px',
            fontSize: '0.85rem',
            fontWeight: '600',
            cursor: incrementingKvK ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s'
          }}
        >
          {incrementingKvK ? (
            <>⏳ Incrementing...</>
          ) : (
            <>📈 Increment to KvK #{currentKvK + 1}</>
          )}
        </button>
      </div>

      {/* Submissions Overview */}
      <div style={{ backgroundColor: '#111116', borderRadius: '12px', padding: '1.5rem', border: '1px solid #2a2a2a' }}>
        <h3 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1rem' }}>📝 Submissions</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          {[
            { label: 'Pending', value: analytics.submissions.pending, color: '#fbbf24' },
            { label: 'Approved', value: analytics.submissions.approved, color: '#22c55e' },
            { label: 'Rejected', value: analytics.submissions.rejected, color: '#ef4444' },
          ].map((stat, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue */}
      <div style={{ backgroundColor: '#111116', borderRadius: '12px', padding: '1.5rem', border: '1px solid #2a2a2a' }}>
        <h3 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1rem' }}>💰 Revenue & Subscriptions</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#22c55e' }}>${analytics.revenue.monthly.toFixed(2)}</div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>MRR</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#fbbf24' }}>${analytics.revenue.total.toFixed(2)}</div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Total Revenue</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#a855f7' }}>{analytics.revenue.activeSubscriptions || 0}</div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Active Subs</div>
          </div>
        </div>
        
        {/* Subscription Breakdown */}
        {analytics.revenue.subscriptions.length > 0 && (
          <div style={{ borderTop: '1px solid #2a2a2a', paddingTop: '1rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '0.5rem' }}>By Tier:</div>
            {analytics.revenue.subscriptions.map((sub, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                <span style={{ color: '#fff' }}>{sub.tier}</span>
                <span style={{ color: '#22d3ee', fontWeight: '600' }}>{sub.count}</span>
              </div>
            ))}
          </div>
        )}
        
        {/* Recent Payments */}
        <div style={{ borderTop: '1px solid #2a2a2a', paddingTop: '1rem' }}>
          <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '0.5rem' }}>Recent Payments:</div>
          {analytics.revenue.recentPayments && analytics.revenue.recentPayments.length > 0 ? (
            analytics.revenue.recentPayments.slice(0, 5).map((payment, i) => (
              <div key={i} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '0.4rem 0',
                borderBottom: i < 4 ? '1px solid #1a1a1f' : 'none'
              }}>
                <div>
                  <span style={{ color: '#22c55e', fontWeight: '600' }}>${payment.amount.toFixed(2)}</span>
                  <span style={{ color: '#6b7280', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                    {new Date(payment.date).toLocaleDateString()}
                  </span>
                </div>
                {payment.customer_email && (
                  <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
                    {payment.customer_email.substring(0, 20)}...
                  </span>
                )}
              </div>
            ))
          ) : (
            <div style={{ color: '#6b7280', fontSize: '0.85rem', fontStyle: 'italic' }}>No payments yet</div>
          )}
        </div>
      </div>

      {/* Recent Subscribers */}
      {analytics.recentSubscribers && analytics.recentSubscribers.length > 0 && (
        <div style={{ backgroundColor: '#111116', borderRadius: '12px', padding: '1.5rem', border: '1px solid #2a2a2a' }}>
          <h3 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1rem' }}>🎉 Recent Subscribers</h3>
          {analytics.recentSubscribers.slice(0, 5).map((sub, i) => (
            <div key={i} style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              padding: '0.5rem 0',
              borderBottom: i < 4 ? '1px solid #1a1a1f' : 'none'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#fff' }}>{sub.username}</span>
                <span style={{ 
                  padding: '0.15rem 0.5rem',
                  backgroundColor: '#FF6B8A20',
                  color: '#FF6B8A',
                  borderRadius: '9999px',
                  fontSize: '0.7rem',
                  fontWeight: '600',
                  textTransform: 'uppercase'
                }}>
                  SUPPORTER
                </span>
              </div>
              <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                {new Date(sub.created_at).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Top Pages */}
      <div style={{ backgroundColor: '#111116', borderRadius: '12px', padding: '1.5rem', border: '1px solid #2a2a2a' }}>
        <h3 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1rem' }}>📊 Top Pages</h3>
        {Array.isArray(analytics.pageViews) && analytics.pageViews.length > 0 ? analytics.pageViews.map((page, i) => (
          <div key={i} style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: '0.5rem 0',
            borderBottom: i < analytics.pageViews.length - 1 ? '1px solid #1a1a1f' : 'none'
          }}>
            <span style={{ color: '#fff' }}>{page.page}</span>
            <span style={{ color: '#22d3ee', fontWeight: '600' }}>{page.views.toLocaleString()}</span>
          </div>
        )) : (
          <div style={{ color: '#6b7280', fontSize: '0.85rem', fontStyle: 'italic' }}>No page view data available</div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsOverview;
