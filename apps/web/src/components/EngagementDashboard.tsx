/**
 * User Engagement Analytics Dashboard
 * Industry-grade engagement metrics visualization
 * 
 * WHY THIS MATTERS:
 * - DAU/WAU ratio indicates product stickiness (target: 20-25% for SaaS)
 * - Session duration shows content value and user investment
 * - Feature adoption reveals which features drive value vs. which need improvement
 * - User journey funnel identifies drop-off points to optimize conversion
 * - Heatmap reveals peak usage times for deployment/maintenance planning
 */
import React, { useState, useEffect } from 'react';
import { logger } from '../utils/logger';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  FunnelChart, Funnel, LabelList, Cell
} from 'recharts';
import { analyticsService } from '../services/analyticsService';

// Theme colors
const COLORS = {
  primary: '#22d3ee',
  secondary: '#a855f7',
  success: '#22c55e',
  warning: '#fbbf24',
  danger: '#ef4444',
  muted: '#6b7280',
  background: '#111116',
  border: '#2a2a2a'
};

const HEATMAP_COLORS = [
  '#1a1a2e', '#16213e', '#0f3460', '#1a508b', '#0d7377', 
  '#14a085', '#22c55e', '#84cc16', '#fbbf24', '#f97316'
];

interface EngagementMetrics {
  dau: number;
  wau: number;
  mau: number;
  dauWauRatio: number;
  avgSessionDuration: number;
  avgSessionsPerDay: number;
  dailyActivity: { date: string; users: number; sessions: number; duration: number }[];
  hourlyHeatmap: { hour: number; day: number; count: number }[];
  featureAdoption: { feature: string; users: number; totalUses: number }[];
  userJourney: { step: string; users: number; dropoff: number }[];
}

// Engagement KPI Card
const EngagementKPI: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  benchmark?: string;
  icon?: string;
  status?: 'good' | 'warning' | 'bad';
}> = ({ title, value, subtitle, benchmark, icon, status }) => {
  const statusColor = status === 'good' ? COLORS.success : 
                      status === 'warning' ? COLORS.warning : 
                      status === 'bad' ? COLORS.danger : COLORS.primary;
  
  return (
    <div style={{
      backgroundColor: COLORS.background,
      borderRadius: '12px',
      padding: '1.25rem',
      border: `1px solid ${COLORS.border}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.75rem', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
        </span>
        {icon && <span style={{ fontSize: '1.25rem' }}>{icon}</span>}
      </div>
      <div style={{ fontSize: '1.75rem', fontWeight: '700', color: statusColor }}>
        {value}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
        {subtitle && <span style={{ fontSize: '0.75rem', color: COLORS.muted }}>{subtitle}</span>}
        {benchmark && (
          <span style={{ fontSize: '0.7rem', color: COLORS.muted, fontStyle: 'italic' }}>
            Benchmark: {benchmark}
          </span>
        )}
      </div>
    </div>
  );
};

// Daily Active Users Chart
const DAUChart: React.FC<{ data: { date: string; users: number; sessions: number }[] }> = ({ data }) => {
  if (!data.length) {
    return <div style={{ textAlign: 'center', color: COLORS.muted, padding: '2rem' }}>No activity data yet</div>;
  }

  return (
    <div style={{ width: '100%', height: 250 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="dauGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
              <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
          <XAxis 
            dataKey="date" 
            stroke={COLORS.muted}
            tick={{ fill: COLORS.muted, fontSize: 10 }}
            tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            interval={6}
          />
          <YAxis stroke={COLORS.muted} tick={{ fill: COLORS.muted, fontSize: 10 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1a1f',
              border: `1px solid ${COLORS.border}`,
              borderRadius: '8px',
              color: '#fff'
            }}
            labelFormatter={(label) => new Date(label).toLocaleDateString()}
          />
          <Area type="monotone" dataKey="users" stroke={COLORS.primary} strokeWidth={2} fill="url(#dauGradient)" name="Active Users" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// Activity Heatmap Component
const ActivityHeatmap: React.FC<{ data: { hour: number; day: number; count: number }[] }> = ({ data }) => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  const maxCount = Math.max(...data.map(d => d.count), 1);
  const getColor = (count: number) => {
    const index = Math.floor((count / maxCount) * (HEATMAP_COLORS.length - 1));
    return HEATMAP_COLORS[index] || HEATMAP_COLORS[0];
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', gap: '2px', marginBottom: '0.5rem' }}>
        <div style={{ width: '40px' }} />
        {hours.filter((_, i) => i % 3 === 0).map(hour => (
          <div key={hour} style={{ 
            width: '36px', 
            textAlign: 'center', 
            fontSize: '0.65rem', 
            color: COLORS.muted 
          }}>
            {hour}:00
          </div>
        ))}
      </div>
      {days.map((day, dayIndex) => (
        <div key={day} style={{ display: 'flex', gap: '2px', marginBottom: '2px' }}>
          <div style={{ width: '40px', fontSize: '0.7rem', color: COLORS.muted, display: 'flex', alignItems: 'center' }}>
            {day}
          </div>
          {hours.map(hour => {
            const cellData = data.find(d => d.day === dayIndex && d.hour === hour);
            const count = cellData?.count || 0;
            return (
              <div
                key={hour}
                style={{
                  width: '12px',
                  height: '16px',
                  backgroundColor: getColor(count),
                  borderRadius: '2px',
                  cursor: 'pointer',
                }}
                title={`${day} ${hour}:00 - ${count} events`}
              />
            );
          })}
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', justifyContent: 'flex-end' }}>
        <span style={{ fontSize: '0.65rem', color: COLORS.muted }}>Less</span>
        {HEATMAP_COLORS.slice(0, 5).map((color, i) => (
          <div key={i} style={{ width: '12px', height: '12px', backgroundColor: color, borderRadius: '2px' }} />
        ))}
        <span style={{ fontSize: '0.65rem', color: COLORS.muted }}>More</span>
      </div>
    </div>
  );
};

// Feature Adoption Chart
const FeatureAdoptionChart: React.FC<{ data: { feature: string; users: number; totalUses: number }[] }> = ({ data }) => {
  if (!data.length) {
    return <div style={{ textAlign: 'center', color: COLORS.muted, padding: '2rem' }}>No feature data yet</div>;
  }

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <BarChart data={data.slice(0, 10)} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
          <XAxis type="number" stroke={COLORS.muted} tick={{ fill: COLORS.muted, fontSize: 10 }} />
          <YAxis 
            type="category" 
            dataKey="feature" 
            stroke={COLORS.muted} 
            tick={{ fill: COLORS.muted, fontSize: 10 }}
            width={90}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1a1f',
              border: `1px solid ${COLORS.border}`,
              borderRadius: '8px',
              color: '#fff'
            }}
          />
          <Bar dataKey="users" fill={COLORS.primary} name="Unique Users" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// User Journey Funnel
const UserJourneyFunnel: React.FC<{ data: { step: string; users: number; dropoff: number }[] }> = ({ data }) => {
  const FUNNEL_COLORS = ['#22d3ee', '#06b6d4', '#0891b2', '#0e7490', '#155e75'];
  
  if (!data.length || data.every(d => d.users === 0)) {
    return <div style={{ textAlign: 'center', color: COLORS.muted, padding: '2rem' }}>No journey data yet</div>;
  }

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <FunnelChart>
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1a1f',
              border: `1px solid ${COLORS.border}`,
              borderRadius: '8px',
              color: '#fff'
            }}
            formatter={(value) => [`${value} users`, 'Users']}
          />
          <Funnel
            dataKey="users"
            data={data}
            isAnimationActive
          >
            <LabelList position="right" fill="#fff" stroke="none" dataKey="step" fontSize={11} />
            <LabelList position="center" fill="#fff" stroke="none" dataKey="users" fontSize={12} fontWeight={600} />
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={FUNNEL_COLORS[index % FUNNEL_COLORS.length]} />
            ))}
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
    </div>
  );
};

// Main Engagement Dashboard
export const EngagementDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<EngagementMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
    const interval = setInterval(loadMetrics, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const loadMetrics = () => {
    setLoading(true);
    try {
      const data = analyticsService.getEngagementMetrics();
      setMetrics(data);
    } catch (error) {
      logger.error('Failed to load engagement metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !metrics) {
    return <div style={{ textAlign: 'center', padding: '2rem', color: COLORS.muted }}>Loading engagement data...</div>;
  }

  // Determine status based on industry benchmarks
  const getDauWauStatus = (ratio: number): 'good' | 'warning' | 'bad' => {
    if (ratio >= 20) return 'good';
    if (ratio >= 10) return 'warning';
    return 'bad';
  };

  const getSessionStatus = (seconds: number): 'good' | 'warning' | 'bad' => {
    if (seconds >= 180) return 'good'; // 3+ minutes
    if (seconds >= 60) return 'warning';
    return 'bad';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ color: '#fff', margin: 0, fontSize: '1.25rem' }}>👥 User Engagement</h2>
          <p style={{ color: COLORS.muted, margin: '0.25rem 0 0', fontSize: '0.8rem' }}>
            Track user activity, retention, and feature adoption
          </p>
        </div>
        <button
          onClick={loadMetrics}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'transparent',
            border: `1px solid ${COLORS.border}`,
            borderRadius: '8px',
            color: COLORS.muted,
            cursor: 'pointer',
            fontSize: '0.8rem'
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
        <EngagementKPI
          title="DAU"
          value={metrics?.dau || 0}
          subtitle="Daily Active"
          icon="📅"
        />
        <EngagementKPI
          title="WAU"
          value={metrics?.wau || 0}
          subtitle="Weekly Active"
          icon="📆"
        />
        <EngagementKPI
          title="MAU"
          value={metrics?.mau || 0}
          subtitle="Monthly Active"
          icon="🗓️"
        />
        <EngagementKPI
          title="DAU/WAU"
          value={`${metrics?.dauWauRatio || 0}%`}
          subtitle="Stickiness"
          benchmark="20-25%"
          icon="🎯"
          status={getDauWauStatus(metrics?.dauWauRatio || 0)}
        />
        <EngagementKPI
          title="Avg Session"
          value={`${Math.floor((metrics?.avgSessionDuration || 0) / 60)}m ${(metrics?.avgSessionDuration || 0) % 60}s`}
          subtitle="Duration"
          benchmark=">3 min"
          icon="⏱️"
          status={getSessionStatus(metrics?.avgSessionDuration || 0)}
        />
        <EngagementKPI
          title="Sessions/Day"
          value={metrics?.avgSessionsPerDay || 0}
          subtitle="Average"
          icon="🔁"
        />
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
        {/* Daily Active Users */}
        <div style={{ backgroundColor: COLORS.background, borderRadius: '12px', padding: '1.25rem', border: `1px solid ${COLORS.border}` }}>
          <h3 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1rem' }}>📈 Daily Active Users (30 Days)</h3>
          <DAUChart data={metrics?.dailyActivity || []} />
        </div>

        {/* Activity Heatmap */}
        <div style={{ backgroundColor: COLORS.background, borderRadius: '12px', padding: '1.25rem', border: `1px solid ${COLORS.border}` }}>
          <h3 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1rem' }}>🗓️ Activity Heatmap (Week)</h3>
          <p style={{ color: COLORS.muted, fontSize: '0.75rem', marginBottom: '1rem' }}>
            Peak usage times — useful for planning deployments and maintenance
          </p>
          <ActivityHeatmap data={metrics?.hourlyHeatmap || []} />
        </div>
      </div>

      {/* Feature Adoption & Journey */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
        {/* Feature Adoption */}
        <div style={{ backgroundColor: COLORS.background, borderRadius: '12px', padding: '1.25rem', border: `1px solid ${COLORS.border}` }}>
          <h3 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1rem' }}>⭐ Feature Adoption</h3>
          <p style={{ color: COLORS.muted, fontSize: '0.75rem', marginBottom: '1rem' }}>
            Which features are users actually using? Low adoption = opportunity to improve or remove.
          </p>
          <FeatureAdoptionChart data={metrics?.featureAdoption || []} />
        </div>

        {/* User Journey Funnel */}
        <div style={{ backgroundColor: COLORS.background, borderRadius: '12px', padding: '1.25rem', border: `1px solid ${COLORS.border}` }}>
          <h3 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1rem' }}>🚀 User Journey Funnel</h3>
          <p style={{ color: COLORS.muted, fontSize: '0.75rem', marginBottom: '1rem' }}>
            Where do users drop off? Focus optimization on the biggest drop-off points.
          </p>
          <UserJourneyFunnel data={metrics?.userJourney || []} />
        </div>
      </div>

      {/* Insights */}
      <div style={{ 
        backgroundColor: '#0f172a', 
        borderRadius: '12px', 
        padding: '1.25rem', 
        border: `1px solid ${COLORS.primary}30` 
      }}>
        <h3 style={{ color: COLORS.primary, marginBottom: '1rem', fontSize: '1rem' }}>💡 Engagement Insights</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          <div>
            <strong style={{ color: '#fff', fontSize: '0.85rem' }}>DAU/WAU Ratio</strong>
            <p style={{ color: COLORS.muted, fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
              {(metrics?.dauWauRatio || 0) >= 20 
                ? '✅ Healthy stickiness — users are returning frequently'
                : '⚠️ Low stickiness — consider push notifications or email reminders'}
            </p>
          </div>
          <div>
            <strong style={{ color: '#fff', fontSize: '0.85rem' }}>Session Duration</strong>
            <p style={{ color: COLORS.muted, fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
              {(metrics?.avgSessionDuration || 0) >= 180
                ? '✅ Users are engaged and exploring content'
                : '⚠️ Short sessions — improve content depth or page load speed'}
            </p>
          </div>
          <div>
            <strong style={{ color: '#fff', fontSize: '0.85rem' }}>Top Feature</strong>
            <p style={{ color: COLORS.muted, fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
              {metrics?.featureAdoption?.[0]
                ? `🎯 "${metrics.featureAdoption[0].feature}" is most used — double down on this`
                : 'No feature data yet'}
            </p>
          </div>
        </div>
      </div>

      {/* Last Updated */}
      <div style={{ textAlign: 'center', color: COLORS.muted, fontSize: '0.75rem' }}>
        Last updated: {new Date().toLocaleTimeString()} • Auto-refreshes every 30s
      </div>
    </div>
  );
};

export default EngagementDashboard;
