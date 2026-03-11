import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { colors } from '../../utils/styles';
import { supabase } from '../../lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────────

type RangePreset = 'today' | '7d' | '30d' | '90d' | 'custom';

interface DailyData {
  day: string;
  unique_visitors: number;
  total_views: number;
}

interface HourlyData {
  hour: string;
  unique_visitors: number;
  total_views: number;
}

interface TopPage {
  page_path: string;
  unique_visitors: number;
  views: number;
}

interface ChartPoint {
  label: string;
  value: number;
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

function fmtHour(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
}

// ── Area Chart (SVG) ──────────────────────────────────────────────────────────

const AreaChart: React.FC<{
  data: ChartPoint[];
  height?: number;
  lineColor?: string;
  emptyMessage?: string;
}> = ({ data, height = 280, lineColor = colors.primary, emptyMessage }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (!data.length) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: colors.textMuted, fontSize: '0.85rem' }}>
        {emptyMessage || 'No data yet. Page views will appear here once visitors are tracked.'}
      </div>
    );
  }

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const chartPadding = { top: 40, right: 16, bottom: 44, left: 50 };
  const chartW = Math.max(data.length * 32, 400);
  const innerW = chartW - chartPadding.left - chartPadding.right;
  const innerH = height - chartPadding.top - chartPadding.bottom;

  // Y-axis gridlines
  const gridLines = 4;
  const yTicks = Array.from({ length: gridLines + 1 }, (_, i) =>
    Math.round((maxVal / gridLines) * i)
  );

  // Compute point positions
  const points = data.map((d, i) => ({
    x: chartPadding.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW),
    y: chartPadding.top + innerH - (d.value / maxVal) * innerH,
    ...d,
  }));

  // Build SVG path for the line
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  // Build SVG path for the filled area
  const areaPath = `${linePath} L${points[points.length - 1]!.x},${chartPadding.top + innerH} L${points[0]!.x},${chartPadding.top + innerH} Z`;

  // Tooltip clamped within SVG bounds
  const tooltipW = 100;
  const hoveredPoint = hoveredIdx !== null ? points[hoveredIdx] : null;
  const tooltipX = hoveredPoint
    ? Math.max(tooltipW / 2 + 4, Math.min(hoveredPoint.x, chartW - tooltipW / 2 - 4))
    : 0;
  const tooltipY = hoveredPoint
    ? Math.max(chartPadding.top + 4, hoveredPoint.y - 42)
    : 0;

  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <svg
        ref={svgRef}
        width={chartW}
        height={height}
        style={{ display: 'block', minWidth: '100%' }}
        onMouseLeave={() => setHoveredIdx(null)}
      >
        <defs>
          <linearGradient id={`areaGrad-${lineColor.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity={0.3} />
            <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
          </linearGradient>
        </defs>

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
                x={chartPadding.left - 8}
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

        {/* Filled area */}
        <path d={areaPath} fill={`url(#areaGrad-${lineColor.replace('#', '')})`} />

        {/* Line */}
        <path d={linePath} fill="none" stroke={lineColor} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

        {/* Data points + invisible hover zones */}
        {points.map((p, i) => {
          const isHovered = hoveredIdx === i;
          return (
            <g key={i}>
              {/* Invisible wide hover target */}
              <rect
                x={p.x - (innerW / data.length) / 2}
                y={chartPadding.top}
                width={innerW / data.length}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHoveredIdx(i)}
                style={{ cursor: 'pointer' }}
              />
              {/* Dot */}
              <circle
                cx={p.x}
                cy={p.y}
                r={isHovered ? 5 : 3}
                fill={isHovered ? lineColor : colors.cardAlt}
                stroke={lineColor}
                strokeWidth={2}
              />
              {/* Vertical guide line on hover */}
              {isHovered && (
                <line
                  x1={p.x}
                  y1={p.y}
                  x2={p.x}
                  y2={chartPadding.top + innerH}
                  stroke={lineColor}
                  strokeWidth={1}
                  strokeDasharray="3,3"
                  opacity={0.4}
                />
              )}
              {/* X-axis label */}
              {(data.length <= 16 || i % Math.ceil(data.length / 16) === 0 || i === data.length - 1) && (
                <text
                  x={p.x}
                  y={chartPadding.top + innerH + 18}
                  textAnchor="middle"
                  fill={colors.textMuted}
                  fontSize={9}
                  transform={data.length > 30 ? `rotate(-35, ${p.x}, ${chartPadding.top + innerH + 18})` : undefined}
                >
                  {p.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Tooltip — rendered last to stay on top */}
        {hoveredPoint && hoveredIdx !== null && (
          <g>
            <rect
              x={tooltipX - tooltipW / 2}
              y={tooltipY}
              width={tooltipW}
              height={30}
              rx={6}
              fill="#1a1a2e"
              stroke={lineColor}
              strokeWidth={1}
              opacity={0.95}
            />
            <text
              x={tooltipX}
              y={tooltipY + 19}
              textAnchor="middle"
              fill={colors.text}
              fontSize={11}
              fontWeight={600}
            >
              {hoveredPoint.value.toLocaleString()} visitors
            </text>
          </g>
        )}
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
  const [todayHourly, setTodayHourly] = useState<HourlyData[]>([]);
  const [last24hHourly, setLast24hHourly] = useState<HourlyData[]>([]);
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

  // Fetch daily + hourly analytics data
  const fetchAnalytics = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { start, end } = getRange();

      // Today = start of today (local midnight) to now
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      // Last 24h = now minus 24 hours
      const last24hStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const [dailyRes, pagesRes, todayRes, last24hRes] = await Promise.all([
        supabase.rpc('get_page_analytics', { p_start: start, p_end: end }),
        supabase.rpc('get_top_pages', { p_start: start, p_end: end, p_limit: 20 }),
        supabase.rpc('get_hourly_analytics', { p_start: todayStart.toISOString(), p_end: now.toISOString() }),
        supabase.rpc('get_hourly_analytics', { p_start: last24hStart.toISOString(), p_end: now.toISOString() }),
      ]);
      if (dailyRes.data) setDailyData(dailyRes.data as DailyData[]);
      if (pagesRes.data) setTopPages(pagesRes.data as TopPage[]);
      if (todayRes.data) setTodayHourly(todayRes.data as HourlyData[]);
      if (last24hRes.data) setLast24hHourly(last24hRes.data as HourlyData[]);
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

  // Prepare chart data
  const dailyChartData: ChartPoint[] = useMemo(() =>
    dailyData.map(d => ({ label: shortDay(d.day), value: d.unique_visitors })),
    [dailyData]
  );

  const todayChartData: ChartPoint[] = useMemo(() =>
    todayHourly.map(d => ({ label: fmtHour(d.hour), value: d.unique_visitors })),
    [todayHourly]
  );

  const last24hChartData: ChartPoint[] = useMemo(() =>
    last24hHourly.map(d => ({ label: fmtHour(d.hour), value: d.unique_visitors })),
    [last24hHourly]
  );

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

      {/* Today Hourly Chart */}
      <div style={{
        backgroundColor: colors.cardAlt,
        borderRadius: '12px',
        padding: '1.25rem',
        border: `1px solid ${colors.border}`,
      }}>
        <h3 style={{ color: colors.text, margin: '0 0 1rem 0', fontSize: '1rem' }}>
          📈 Today — Hourly Unique Visitors
        </h3>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: colors.textMuted }}>Loading chart...</div>
        ) : (
          <AreaChart
            data={todayChartData}
            lineColor={colors.success}
            emptyMessage="No visitors tracked today yet."
          />
        )}
      </div>

      {/* Last 24h Hourly Chart */}
      <div style={{
        backgroundColor: colors.cardAlt,
        borderRadius: '12px',
        padding: '1.25rem',
        border: `1px solid ${colors.border}`,
      }}>
        <h3 style={{ color: colors.text, margin: '0 0 1rem 0', fontSize: '1rem' }}>
          🕐 Last 24 Hours — Hourly Unique Visitors
        </h3>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: colors.textMuted }}>Loading chart...</div>
        ) : (
          <AreaChart
            data={last24hChartData}
            lineColor={colors.purple}
            emptyMessage="No visitor data in the last 24 hours."
          />
        )}
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
          <AreaChart data={dailyChartData} />
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
