import React, { useState, useEffect, useCallback, useRef } from 'react';
import { colors } from '../../utils/styles';
import { supabase } from '../../lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────────

type RangePreset = 'today' | '7d' | '30d' | '90d' | 'custom';

interface DailyData {
  day: string;
  unique_visitors: number;
  total_views: number;
}

interface TopPage {
  page_path: string;
  unique_visitors: number;
  views: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dateFromPreset(preset: RangePreset): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  switch (preset) {
    case 'today':
      break;
    case '7d':
      start.setDate(start.getDate() - 6);
      break;
    case '30d':
      start.setDate(start.getDate() - 29);
      break;
    case '90d':
      start.setDate(start.getDate() - 89);
      break;
    default:
      start.setDate(start.getDate() - 29);
  }
  return { start: fmtDate(start), end: fmtDate(end) };
}

function shortDay(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Bar Chart (SVG) ────────────────────────────────────────────────────────────

const BarChart: React.FC<{
  data: DailyData[];
  height?: number;
  barColor?: string;
}> = ({ data, height = 220, barColor = colors.primary }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data.length) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: colors.textMuted, fontSize: '0.85rem' }}>
        No data yet. Page views will appear here once visitors are tracked.
      </div>
    );
  }

  const maxVal = Math.max(...data.map(d => d.unique_visitors), 1);
  const chartPadding = { top: 20, right: 12, bottom: 40, left: 44 };
  const chartW = Math.max(data.length * 28, 300);
  const innerW = chartW - chartPadding.left - chartPadding.right;
  const innerH = height - chartPadding.top - chartPadding.bottom;
  const barWidth = Math.max(Math.min(innerW / data.length - 4, 24), 6);

  // Y-axis gridlines
  const gridLines = 4;
  const yTicks = Array.from({ length: gridLines + 1 }, (_, i) =>
    Math.round((maxVal / gridLines) * i)
  );

  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <svg
        width={chartW}
        height={height}
        style={{ display: 'block', minWidth: '100%' }}
      >
        {/* Y-axis gridlines */}
        {yTicks.map((tick, i) => {
          const y = chartPadding.top + innerH - (tick / maxVal) * innerH;
          return (
            <g key={i}>
              <line
                x1={chartPadding.left}
                y1={y}
                x2={chartW - chartPadding.right}
                y2={y}
                stroke={colors.border}
                strokeWidth={1}
                strokeDasharray={i === 0 ? undefined : '4,4'}
              />
              <text
                x={chartPadding.left - 6}
                y={y + 4}
                textAnchor="end"
                fill={colors.textMuted}
                fontSize={10}
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const barH = (d.unique_visitors / maxVal) * innerH;
          const x = chartPadding.left + (i * (innerW / data.length)) + (innerW / data.length - barWidth) / 2;
          const y = chartPadding.top + innerH - barH;
          const isHovered = hoveredIdx === i;

          return (
            <g
              key={d.day}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barH, 1)}
                rx={3}
                fill={isHovered ? colors.primaryHover : barColor}
                opacity={isHovered ? 1 : 0.8}
              />
              {/* Hover tooltip */}
              {isHovered && (
                <>
                  <rect
                    x={x + barWidth / 2 - 46}
                    y={y - 36}
                    width={92}
                    height={28}
                    rx={4}
                    fill="#1e1e2a"
                    stroke={colors.border}
                    strokeWidth={1}
                  />
                  <text
                    x={x + barWidth / 2}
                    y={y - 18}
                    textAnchor="middle"
                    fill={colors.text}
                    fontSize={11}
                    fontWeight={600}
                  >
                    {d.unique_visitors} visitors
                  </text>
                </>
              )}
              {/* X-axis label — show every Nth depending on data length */}
              {(data.length <= 14 || i % Math.ceil(data.length / 14) === 0 || i === data.length - 1) && (
                <text
                  x={x + barWidth / 2}
                  y={chartPadding.top + innerH + 16}
                  textAnchor="middle"
                  fill={colors.textMuted}
                  fontSize={9}
                  transform={data.length > 30 ? `rotate(-35, ${x + barWidth / 2}, ${chartPadding.top + innerH + 16})` : undefined}
                >
                  {shortDay(d.day)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────

export const PageAnalyticsTab: React.FC = () => {
  const [preset, setPreset] = useState<RangePreset>('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [topPages, setTopPages] = useState<TopPage[]>([]);
  const [liveCount, setLiveCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getRange = useCallback((): { start: string; end: string } => {
    if (preset === 'custom' && customStart && customEnd) {
      return { start: customStart, end: customEnd };
    }
    return dateFromPreset(preset);
  }, [preset, customStart, customEnd]);

  // Fetch daily analytics data
  const fetchAnalytics = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { start, end } = getRange();
      const [dailyRes, pagesRes] = await Promise.all([
        supabase.rpc('get_page_analytics', { p_start: start, p_end: end }),
        supabase.rpc('get_top_pages', { p_start: start, p_end: end, p_limit: 20 }),
      ]);
      if (dailyRes.data) setDailyData(dailyRes.data as DailyData[]);
      if (pagesRes.data) setTopPages(pagesRes.data as TopPage[]);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [getRange]);

  // Fetch live visitor count
  const fetchLive = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data } = await supabase.rpc('get_live_visitors');
      if (typeof data === 'number') setLiveCount(data);
    } catch { /* silent */ }
  }, []);

  // Initial fetch + re-fetch on range change
  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Live visitor polling every 30s
  useEffect(() => {
    fetchLive();
    liveIntervalRef.current = setInterval(fetchLive, 30000);
    return () => {
      if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
    };
  }, [fetchLive]);

  // Aggregate totals for the selected range
  const totalVisitors = dailyData.reduce((sum, d) => sum + d.unique_visitors, 0);
  const totalViews = dailyData.reduce((sum, d) => sum + d.total_views, 0);
  const avgDaily = dailyData.length > 0 ? Math.round(totalVisitors / dailyData.length) : 0;

  const presets: { id: RangePreset; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: '7d', label: '7 Days' },
    { id: '30d', label: '30 Days' },
    { id: '90d', label: '90 Days' },
    { id: 'custom', label: 'Custom' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Time Range Selector */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        flexWrap: 'wrap',
        padding: '0.75rem 1rem',
        backgroundColor: colors.cardAlt,
        borderRadius: '10px',
        border: `1px solid ${colors.border}`,
      }}>
        <span style={{ color: colors.textMuted, fontSize: '0.8rem', marginRight: '0.25rem' }}>Range:</span>
        {presets.map(p => (
          <button
            key={p.id}
            onClick={() => setPreset(p.id)}
            style={{
              padding: '0.3rem 0.65rem',
              backgroundColor: preset === p.id ? `${colors.primary}25` : 'transparent',
              color: preset === p.id ? colors.primary : colors.textMuted,
              border: preset === p.id ? `1px solid ${colors.primary}50` : '1px solid transparent',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: preset === p.id ? 600 : 400,
              transition: 'all 0.15s',
            }}
          >
            {p.label}
          </button>
        ))}
        {preset === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginLeft: '0.5rem' }}>
            <input
              type="date"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              style={{
                padding: '0.25rem 0.5rem',
                backgroundColor: colors.bg,
                color: colors.text,
                border: `1px solid ${colors.border}`,
                borderRadius: '4px',
                fontSize: '0.75rem',
              }}
            />
            <span style={{ color: colors.textMuted, fontSize: '0.8rem' }}>to</span>
            <input
              type="date"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              style={{
                padding: '0.25rem 0.5rem',
                backgroundColor: colors.bg,
                color: colors.text,
                border: `1px solid ${colors.border}`,
                borderRadius: '4px',
                fontSize: '0.75rem',
              }}
            />
            <button
              onClick={fetchAnalytics}
              style={{
                padding: '0.25rem 0.6rem',
                backgroundColor: `${colors.primary}20`,
                color: colors.primary,
                border: `1px solid ${colors.primary}40`,
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              Apply
            </button>
          </div>
        )}
        <button
          onClick={() => { fetchAnalytics(); fetchLive(); }}
          disabled={loading}
          style={{
            marginLeft: 'auto',
            padding: '0.25rem 0.6rem',
            background: 'none',
            border: `1px solid ${colors.border}`,
            borderRadius: '4px',
            color: colors.textMuted,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '0.75rem',
          }}
        >
          {loading ? '...' : '↻ Refresh'}
        </button>
      </div>

      {/* Key Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem' }}>
        {/* Live Visitors */}
        <div style={{
          backgroundColor: colors.cardAlt,
          borderRadius: '12px',
          padding: '1.25rem',
          border: `1px solid ${colors.success}40`,
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: liveCount !== null && liveCount > 0 ? colors.success : colors.textMuted,
            boxShadow: liveCount !== null && liveCount > 0 ? `0 0 6px ${colors.success}` : 'none',
            animation: liveCount !== null && liveCount > 0 ? 'pulse 2s infinite' : 'none',
          }} />
          <div style={{ color: colors.textMuted, fontSize: '0.8rem', marginBottom: '0.4rem' }}>Live Visitors</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: colors.success }}>
            {liveCount !== null ? liveCount : '—'}
          </div>
          <div style={{ color: colors.textMuted, fontSize: '0.7rem', marginTop: '0.2rem' }}>Last 5 min · refreshes every 30s</div>
          <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
        </div>

        {/* Unique Visitors */}
        <div style={{
          backgroundColor: colors.cardAlt,
          borderRadius: '12px',
          padding: '1.25rem',
          border: `1px solid ${colors.border}`,
        }}>
          <div style={{ color: colors.textMuted, fontSize: '0.8rem', marginBottom: '0.4rem' }}>Unique Visitors</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: colors.primary }}>
            {loading ? '...' : totalVisitors.toLocaleString()}
          </div>
          <div style={{ color: colors.textMuted, fontSize: '0.7rem', marginTop: '0.2rem' }}>
            {dailyData.length} day{dailyData.length !== 1 ? 's' : ''} selected
          </div>
        </div>

        {/* Total Page Views */}
        <div style={{
          backgroundColor: colors.cardAlt,
          borderRadius: '12px',
          padding: '1.25rem',
          border: `1px solid ${colors.border}`,
        }}>
          <div style={{ color: colors.textMuted, fontSize: '0.8rem', marginBottom: '0.4rem' }}>Total Page Views</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: colors.purple }}>
            {loading ? '...' : totalViews.toLocaleString()}
          </div>
          <div style={{ color: colors.textMuted, fontSize: '0.7rem', marginTop: '0.2rem' }}>
            {totalVisitors > 0 ? `${(totalViews / totalVisitors).toFixed(1)} views/visitor` : '—'}
          </div>
        </div>

        {/* Avg Daily */}
        <div style={{
          backgroundColor: colors.cardAlt,
          borderRadius: '12px',
          padding: '1.25rem',
          border: `1px solid ${colors.border}`,
        }}>
          <div style={{ color: colors.textMuted, fontSize: '0.8rem', marginBottom: '0.4rem' }}>Avg. Daily Visitors</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: colors.gold }}>
            {loading ? '...' : avgDaily.toLocaleString()}
          </div>
          <div style={{ color: colors.textMuted, fontSize: '0.7rem', marginTop: '0.2rem' }}>
            {dailyData.length > 1
              ? (() => {
                  const recent = dailyData.slice(-7);
                  const older = dailyData.slice(0, Math.max(dailyData.length - 7, 1));
                  const recentAvg = recent.reduce((s, d) => s + d.unique_visitors, 0) / recent.length;
                  const olderAvg = older.reduce((s, d) => s + d.unique_visitors, 0) / older.length;
                  if (olderAvg === 0) return 'No prior data';
                  const pct = Math.round(((recentAvg - olderAvg) / olderAvg) * 100);
                  return pct >= 0 ? `↑ ${pct}% vs prior period` : `↓ ${Math.abs(pct)}% vs prior period`;
                })()
              : 'Need more data for trend'}
          </div>
        </div>
      </div>

      {/* Daily Unique Visitors Chart */}
      <div style={{
        backgroundColor: colors.cardAlt,
        borderRadius: '12px',
        padding: '1.25rem',
        border: `1px solid ${colors.border}`,
      }}>
        <h3 style={{ color: colors.text, margin: '0 0 1rem 0', fontSize: '1rem' }}>
          📊 Daily Unique Visitors
        </h3>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: colors.textMuted }}>Loading chart...</div>
        ) : (
          <BarChart data={dailyData} />
        )}
      </div>

      {/* Top Pages */}
      <div style={{
        backgroundColor: colors.cardAlt,
        borderRadius: '12px',
        padding: '1.25rem',
        border: `1px solid ${colors.border}`,
      }}>
        <h3 style={{ color: colors.text, margin: '0 0 1rem 0', fontSize: '1rem' }}>
          📄 Top Pages
        </h3>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '1rem', color: colors.textMuted }}>Loading...</div>
        ) : topPages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1rem', color: colors.textMuted, fontSize: '0.85rem', fontStyle: 'italic' }}>
            No page data yet. Views will appear once visitors are tracked.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: colors.textMuted, fontSize: '0.75rem', fontWeight: 600, borderBottom: `1px solid ${colors.border}` }}>
                    Page
                  </th>
                  <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', color: colors.textMuted, fontSize: '0.75rem', fontWeight: 600, borderBottom: `1px solid ${colors.border}` }}>
                    Unique Visitors
                  </th>
                  <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', color: colors.textMuted, fontSize: '0.75rem', fontWeight: 600, borderBottom: `1px solid ${colors.border}` }}>
                    Page Views
                  </th>
                </tr>
              </thead>
              <tbody>
                {topPages.map((p, i) => {
                  const maxVisitors = topPages[0]?.unique_visitors || 1;
                  const barPct = (p.unique_visitors / maxVisitors) * 100;
                  return (
                    <tr key={p.page_path} style={{ borderBottom: i < topPages.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none' }}>
                      <td style={{ padding: '0.6rem 0.75rem', position: 'relative' }}>
                        <div style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: `${barPct}%`,
                          backgroundColor: `${colors.primary}08`,
                          borderRadius: '4px',
                        }} />
                        <span style={{ color: colors.text, fontSize: '0.85rem', position: 'relative' }}>{p.page_path}</span>
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>
                        <span style={{ color: colors.primary, fontWeight: 600, fontSize: '0.85rem' }}>{p.unique_visitors.toLocaleString()}</span>
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>
                        <span style={{ color: colors.textSecondary, fontSize: '0.85rem' }}>{p.views.toLocaleString()}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Data Accuracy Note */}
      <div style={{
        padding: '0.75rem 1rem',
        backgroundColor: `${colors.primary}08`,
        borderRadius: '8px',
        border: `1px solid ${colors.primary}20`,
      }}>
        <p style={{ color: colors.textMuted, fontSize: '0.75rem', margin: 0 }}>
          📌 All data is sourced from real page view records stored in the database. Unique visitors are identified by a persistent browser fingerprint (localStorage UUID). 
          Tracking started when this feature was deployed — historical data before that date is not available.
        </p>
      </div>
    </div>
  );
};

export default PageAnalyticsTab;
