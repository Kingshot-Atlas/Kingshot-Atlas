import React from 'react';
import { COLORS, AnalyticsData, MultirallyStats, MultirallyAnalytics, Server } from './types';

interface BotAnalyticsTabProps {
  analytics: AnalyticsData | null;
  analyticsLoading: boolean;
  analyticsPeriod: '24h' | '7d' | '30d';
  multirallyStats: MultirallyStats | null;
  multirallyAnalytics: MultirallyAnalytics | null;
  servers: Server[];
  onSetAnalyticsPeriod: (period: '24h' | '7d' | '30d') => void;
  onLoadAnalytics: () => void;
}

const BotAnalyticsTab: React.FC<BotAnalyticsTabProps> = ({
  analytics,
  analyticsLoading,
  analyticsPeriod,
  multirallyStats,
  multirallyAnalytics,
  servers,
  onSetAnalyticsPeriod,
  onLoadAnalytics,
}) => {
  if (analyticsLoading) {
    return <div style={{ textAlign: 'center', padding: '2rem', color: COLORS.muted }}>Loading analytics...</div>;
  }

  if (!analytics) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: COLORS.muted }}>
        No analytics data available.
        <button onClick={onLoadAnalytics} style={{ display: 'block', margin: '1rem auto', padding: '0.5rem 1rem', backgroundColor: COLORS.primary, border: 'none', borderRadius: '6px', color: '#0a0a0a', cursor: 'pointer', fontWeight: '600' }}>Retry</button>
      </div>
    );
  }

  const periodData = analyticsPeriod === '24h' ? analytics.period_24h : analyticsPeriod === '7d' ? analytics.period_7d : analytics.period_30d;
  const maxCmd = periodData.commands.length > 0 ? (periodData.commands[0]?.count || 1) : 1;

  return (
    <>
      {/* Period Selector */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <span style={{ color: COLORS.muted, fontSize: '0.8rem' }}>Period:</span>
        {(['24h', '7d', '30d'] as const).map(p => (
          <button key={p} onClick={() => onSetAnalyticsPeriod(p)} style={{
            padding: '0.35rem 0.75rem', borderRadius: '6px', border: `1px solid ${analyticsPeriod === p ? COLORS.primary : COLORS.border}`,
            backgroundColor: analyticsPeriod === p ? COLORS.primary + '20' : 'transparent', color: analyticsPeriod === p ? COLORS.primary : COLORS.muted,
            cursor: 'pointer', fontSize: '0.8rem', fontWeight: analyticsPeriod === p ? '600' : '400'
          }}>{p}</button>
        ))}
        <button onClick={onLoadAnalytics} style={{ marginLeft: 'auto', padding: '0.35rem 0.75rem', borderRadius: '6px', border: `1px solid ${COLORS.border}`, backgroundColor: 'transparent', color: COLORS.muted, cursor: 'pointer', fontSize: '0.8rem' }}>
          🔄
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
        {[
          { label: 'Total Commands', value: periodData.total.toLocaleString(), color: COLORS.primary },
          { label: 'Unique Users', value: periodData.unique_users.toLocaleString(), color: COLORS.success },
          { label: 'Avg Latency', value: periodData.latency ? `${periodData.latency.avg}ms` : '—', color: COLORS.warning },
          { label: 'P95 Latency', value: periodData.latency ? `${periodData.latency.p95}ms` : '—', color: periodData.latency && periodData.latency.p95 > 2000 ? COLORS.danger : COLORS.muted },
        ].map(card => (
          <div key={card.label} style={{ backgroundColor: COLORS.background, borderRadius: '10px', padding: '1rem', border: `1px solid ${COLORS.border}` }}>
            <div style={{ fontSize: '0.7rem', color: COLORS.muted, textTransform: 'uppercase', marginBottom: '0.25rem' }}>{card.label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Command Usage Breakdown */}
      <div style={{ backgroundColor: COLORS.background, borderRadius: '12px', padding: '1.25rem', border: `1px solid ${COLORS.border}` }}>
        <h3 style={{ color: '#fff', margin: '0 0 1rem', fontSize: '1rem' }}>Command Usage</h3>
        {periodData.commands.length === 0 ? (
          <div style={{ color: COLORS.muted, fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>No commands in this period</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {periodData.commands.map(cmd => (
              <div key={cmd.name} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '100px', flexShrink: 0, color: COLORS.primary, fontFamily: 'monospace', fontSize: '0.8rem' }}>/{cmd.name}</div>
                <div style={{ flex: 1, position: 'relative', height: '24px', backgroundColor: '#0a0a0f', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(cmd.count / maxCmd) * 100}%`, backgroundColor: COLORS.primary + '40', borderRadius: '4px', transition: 'width 0.3s' }} />
                  <div style={{ position: 'relative', padding: '0 0.5rem', lineHeight: '24px', fontSize: '0.75rem', color: '#fff' }}>
                    {cmd.count} <span style={{ color: COLORS.muted }}>({cmd.unique_users} users)</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Server Breakdown */}
      {analytics.servers.length > 0 && (
        <div style={{ backgroundColor: COLORS.background, borderRadius: '12px', padding: '1.25rem', border: `1px solid ${COLORS.border}` }}>
          <h3 style={{ color: '#fff', margin: '0 0 1rem', fontSize: '1rem' }}>Server Activity (30d)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {analytics.servers.slice(0, 10).map((srv, i) => {
              const serverName = servers.find(s => s.id === srv.guild_id)?.name;
              const maxSrv = analytics.servers[0]?.commands || 1;
              return (
                <div key={srv.guild_id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '20px', flexShrink: 0, color: COLORS.muted, fontSize: '0.75rem', textAlign: 'right' }}>{i + 1}.</div>
                  <div style={{ width: '140px', flexShrink: 0, color: '#fff', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {serverName ? serverName : srv.guild_id === 'DM' ? 'Direct Messages' : srv.guild_id.slice(0, 8) + '...'}
                  </div>
                  <div style={{ flex: 1, position: 'relative', height: '20px', backgroundColor: '#0a0a0f', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(srv.commands / maxSrv) * 100}%`, backgroundColor: COLORS.success + '40', borderRadius: '4px' }} />
                    <div style={{ position: 'relative', padding: '0 0.5rem', lineHeight: '20px', fontSize: '0.7rem', color: COLORS.muted }}>{srv.commands}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Latency by Command */}
      {analytics.latency_by_command.length > 0 && (
        <div style={{ backgroundColor: COLORS.background, borderRadius: '12px', padding: '1.25rem', border: `1px solid ${COLORS.border}` }}>
          <h3 style={{ color: '#fff', margin: '0 0 1rem', fontSize: '1rem' }}>Latency by Command (30d)</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <th style={{ textAlign: 'left', padding: '0.5rem', color: COLORS.muted, fontWeight: '500' }}>Command</th>
                  <th style={{ textAlign: 'right', padding: '0.5rem', color: COLORS.muted, fontWeight: '500' }}>Avg</th>
                  <th style={{ textAlign: 'right', padding: '0.5rem', color: COLORS.muted, fontWeight: '500' }}>P50</th>
                  <th style={{ textAlign: 'right', padding: '0.5rem', color: COLORS.muted, fontWeight: '500' }}>P95</th>
                  <th style={{ textAlign: 'right', padding: '0.5rem', color: COLORS.muted, fontWeight: '500' }}>Calls</th>
                </tr>
              </thead>
              <tbody>
                {analytics.latency_by_command.map(row => {
                  const latColor = row.avg > 2000 ? COLORS.danger : row.avg > 1000 ? COLORS.warning : COLORS.success;
                  return (
                    <tr key={row.command} style={{ borderBottom: `1px solid ${COLORS.border}20` }}>
                      <td style={{ padding: '0.5rem', color: COLORS.primary, fontFamily: 'monospace' }}>/{row.command}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', color: latColor, fontWeight: '600' }}>{row.avg}ms</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', color: COLORS.muted }}>{row.p50}ms</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', color: row.p95 > 2000 ? COLORS.danger : COLORS.muted }}>{row.p95}ms</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', color: COLORS.muted }}>{row.count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Daily Time Series (visual bar chart) */}
      {analytics.time_series.length > 0 && (
        <div style={{ backgroundColor: COLORS.background, borderRadius: '12px', padding: '1.25rem', border: `1px solid ${COLORS.border}` }}>
          <h3 style={{ color: '#fff', margin: '0 0 1rem', fontSize: '1rem' }}>Daily Activity (30d)</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '120px', padding: '0 0 1.5rem' }}>
            {analytics.time_series.map(day => {
              const maxDay = Math.max(...analytics.time_series.map(d => d.commands), 1);
              const pct = (day.commands / maxDay) * 100;
              return (
                <div key={day.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', height: '100%', justifyContent: 'flex-end' }} title={`${day.date}: ${day.commands} cmds, ${day.unique_users} users`}>
                  <div style={{ width: '100%', maxWidth: '16px', height: `${Math.max(pct, 2)}%`, backgroundColor: COLORS.primary, borderRadius: '2px 2px 0 0', opacity: 0.7, transition: 'height 0.3s' }} />
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: COLORS.muted }}>
            <span>{analytics.time_series[0]?.date.slice(5)}</span>
            <span>{analytics.time_series[analytics.time_series.length - 1]?.date.slice(5)}</span>
          </div>
        </div>
      )}

      {/* Premium Commands — /multirally Stats */}
      {multirallyStats && !multirallyStats.error && (
        <div style={{ backgroundColor: COLORS.background, borderRadius: '12px', padding: '1.25rem', border: `1px solid ${COLORS.danger}40` }}>
          <h3 style={{ color: '#fff', margin: '0 0 1rem', fontSize: '1rem' }}>
            <span style={{ color: COLORS.danger }}>⚔️</span> Premium Commands — /multirally
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            {[
              { label: 'Total Uses', value: multirallyStats.total_uses.toLocaleString(), color: COLORS.primary },
              { label: 'Unique Users', value: multirallyStats.unique_users.toLocaleString(), color: COLORS.success },
              { label: 'Supporter Uses', value: multirallyStats.supporter_uses.toLocaleString(), color: COLORS.warning },
              { label: 'Free Uses', value: multirallyStats.free_uses.toLocaleString(), color: COLORS.muted },
              { label: 'Upsell Views', value: multirallyStats.upsell_impressions.toLocaleString(), color: COLORS.danger },
            ].map(card => (
              <div key={card.label} style={{ backgroundColor: '#0a0a0f', borderRadius: '8px', padding: '0.75rem', border: `1px solid ${COLORS.border}` }}>
                <div style={{ fontSize: '0.65rem', color: COLORS.muted, textTransform: 'uppercase', marginBottom: '0.2rem' }}>{card.label}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '700', color: card.color }}>{card.value}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
            {[
              { label: 'Today', uses: multirallyStats.today.uses, users: multirallyStats.today.users },
              { label: '7 Days', uses: multirallyStats.week.uses, users: multirallyStats.week.users },
              { label: '30 Days', uses: multirallyStats.month.uses, users: multirallyStats.month.users },
            ].map(period => (
              <div key={period.label} style={{ backgroundColor: '#0a0a0f', borderRadius: '6px', padding: '0.6rem', textAlign: 'center', border: `1px solid ${COLORS.border}` }}>
                <div style={{ fontSize: '0.65rem', color: COLORS.muted, marginBottom: '0.2rem' }}>{period.label}</div>
                <div style={{ fontSize: '1rem', fontWeight: '600', color: '#fff' }}>{period.uses}</div>
                <div style={{ fontSize: '0.65rem', color: COLORS.muted }}>{period.users} user{period.users !== 1 ? 's' : ''}</div>
              </div>
            ))}
          </div>
          {multirallyStats.upsell_impressions > 0 && multirallyStats.total_uses > 0 && (
            <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', backgroundColor: COLORS.danger + '10', borderRadius: '6px', fontSize: '0.75rem', color: COLORS.muted }}>
              <span style={{ color: COLORS.danger, fontWeight: '600' }}>Conversion signal:</span>{' '}
              {multirallyStats.upsell_impressions} user{multirallyStats.upsell_impressions !== 1 ? 's' : ''} hit the paywall
              {multirallyStats.supporter_uses > 0 && ` · ${multirallyStats.supporter_uses} Supporter uses tracked`}
            </div>
          )}
        </div>
      )}

      {/* Multirally Detailed Analytics — Target Distribution & Avg Players */}
      {multirallyAnalytics && !multirallyAnalytics.error && multirallyAnalytics.total_uses > 0 && (
        <div style={{ backgroundColor: COLORS.background, borderRadius: '12px', padding: '1.25rem', border: `1px solid ${COLORS.border}` }}>
          <h3 style={{ color: '#fff', margin: '0 0 1rem', fontSize: '1rem' }}>Rally Analytics</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ backgroundColor: '#0a0a0f', borderRadius: '8px', padding: '0.75rem', border: `1px solid ${COLORS.border}` }}>
              <div style={{ fontSize: '0.65rem', color: COLORS.muted, textTransform: 'uppercase', marginBottom: '0.2rem' }}>Avg Players/Call</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: COLORS.primary }}>{multirallyAnalytics.avg_players}</div>
            </div>
            <div style={{ backgroundColor: '#0a0a0f', borderRadius: '8px', padding: '0.75rem', border: `1px solid ${COLORS.border}` }}>
              <div style={{ fontSize: '0.65rem', color: COLORS.muted, textTransform: 'uppercase', marginBottom: '0.2rem' }}>Supporter %</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: COLORS.warning }}>{multirallyAnalytics.supporter_ratio}%</div>
            </div>
          </div>
          {multirallyAnalytics.target_distribution.length > 0 && (
            <>
              <div style={{ fontSize: '0.8rem', color: COLORS.muted, marginBottom: '0.5rem' }}>Target Building Distribution</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {multirallyAnalytics.target_distribution.slice(0, 8).map(t => {
                  const maxT = multirallyAnalytics.target_distribution[0]?.count || 1;
                  return (
                    <div key={t.target} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '100px', flexShrink: 0, color: '#fff', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.target}</div>
                      <div style={{ flex: 1, position: 'relative', height: '20px', backgroundColor: '#0a0a0f', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(t.count / maxT) * 100}%`, backgroundColor: COLORS.danger + '50', borderRadius: '4px' }} />
                        <div style={{ position: 'relative', padding: '0 0.5rem', lineHeight: '20px', fontSize: '0.7rem', color: COLORS.muted }}>{t.count} ({t.pct}%)</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};

export default BotAnalyticsTab;
