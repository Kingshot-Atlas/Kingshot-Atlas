/**
 * Professional Analytics Charts for Admin Dashboard
 * Industry-grade SaaS metrics visualization
 */
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { getAuthHeaders } from '../services/authHeaders';
import { logger } from '../utils/logger';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

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

const CHART_COLORS = ['#22d3ee', '#a855f7', '#22c55e', '#fbbf24', '#ef4444'];

interface KPI {
  mrr: number;
  arr: number;
  arpu: number;
  ltv: number;
  total_users: number;
  paid_users: number;
  conversion_rate: number;
  churn_rate: number;
  retention_rate: number;
  net_growth: number;
  active_subscriptions: number;
}

interface MRRDataPoint {
  date: string;
  mrr: number;
  revenue: number;
}

interface ForecastDataPoint {
  month: string;
  projected_mrr: number;
  projected_arr: number;
  confidence: number;
}

interface CohortData {
  month: string;
  total_signups: number;
  still_active: number;
  churned: number;
  retention_rate: number;
}

// KPI Card Component
const KPICard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: number;
  color?: string;
  icon?: string;
}> = ({ title, value, subtitle, trend, color = COLORS.primary, icon }) => (
  <div style={{
    backgroundColor: COLORS.background,
    borderRadius: '12px',
    padding: '1.25rem',
    border: `1px solid ${COLORS.border}`,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem'
  }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: '0.75rem', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title}
      </span>
      {icon && <span style={{ fontSize: '1.25rem' }}>{icon}</span>}
    </div>
    <div style={{ fontSize: '1.75rem', fontWeight: '700', color }}>
      {value}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      {trend !== undefined && (
        <span style={{
          fontSize: '0.75rem',
          fontWeight: '600',
          color: trend >= 0 ? COLORS.success : COLORS.danger,
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem'
        }}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
        </span>
      )}
      {subtitle && (
        <span style={{ fontSize: '0.75rem', color: COLORS.muted }}>{subtitle}</span>
      )}
    </div>
  </div>
);

// MRR Chart Component
export const MRRChart: React.FC<{ data: MRRDataPoint[] }> = ({ data }) => {
  if (!data.length) {
    return (
      <div style={{ textAlign: 'center', color: COLORS.muted, padding: '2rem' }}>
        No MRR data available yet
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
              <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
          <XAxis 
            dataKey="date" 
            stroke={COLORS.muted}
            tick={{ fill: COLORS.muted, fontSize: 11 }}
            tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          />
          <YAxis 
            stroke={COLORS.muted}
            tick={{ fill: COLORS.muted, fontSize: 11 }}
            tickFormatter={(value) => `$${value}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1a1f',
              border: `1px solid ${COLORS.border}`,
              borderRadius: '8px',
              color: '#fff'
            }}
            formatter={(value) => [`$${(value as number || 0).toFixed(2)}`, 'MRR']}
            labelFormatter={(label) => new Date(label).toLocaleDateString()}
          />
          <Area
            type="monotone"
            dataKey="mrr"
            stroke={COLORS.primary}
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#mrrGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// Revenue Forecast Chart
export const ForecastChart: React.FC<{ 
  data: ForecastDataPoint[];
  currentMRR: number;
}> = ({ data, currentMRR }) => {
  const chartData = [
    { month: 'Current', projected_mrr: currentMRR, confidence: 1 },
    ...data
  ];

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.secondary} stopOpacity={0.3} />
              <stop offset="95%" stopColor={COLORS.secondary} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
          <XAxis 
            dataKey="month" 
            stroke={COLORS.muted}
            tick={{ fill: COLORS.muted, fontSize: 11 }}
          />
          <YAxis 
            stroke={COLORS.muted}
            tick={{ fill: COLORS.muted, fontSize: 11 }}
            tickFormatter={(value) => `$${value}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1a1f',
              border: `1px solid ${COLORS.border}`,
              borderRadius: '8px',
              color: '#fff'
            }}
            formatter={(value, name) => [
              `$${(value as number || 0).toFixed(2)}`,
              name === 'projected_mrr' ? 'Projected MRR' : name
            ]}
          />
          <Area
            type="monotone"
            dataKey="projected_mrr"
            stroke={COLORS.secondary}
            strokeWidth={2}
            strokeDasharray="5 5"
            fillOpacity={1}
            fill="url(#forecastGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// Cohort Retention Chart
export const CohortChart: React.FC<{ data: CohortData[] }> = ({ data }) => {
  if (!data.length) {
    return (
      <div style={{ textAlign: 'center', color: COLORS.muted, padding: '2rem' }}>
        No cohort data available yet
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
          <XAxis 
            dataKey="month" 
            stroke={COLORS.muted}
            tick={{ fill: COLORS.muted, fontSize: 11 }}
          />
          <YAxis 
            stroke={COLORS.muted}
            tick={{ fill: COLORS.muted, fontSize: 11 }}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1a1f',
              border: `1px solid ${COLORS.border}`,
              borderRadius: '8px',
              color: '#fff'
            }}
            formatter={(value) => [`${value}%`, 'Retention']}
          />
          <Bar dataKey="retention_rate" fill={COLORS.success} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// Subscription Distribution Pie Chart
export const SubscriptionPieChart: React.FC<{ 
  data: { tier: string; count: number }[] 
}> = ({ data }) => {
  if (!data.length) {
    return (
      <div style={{ textAlign: 'center', color: COLORS.muted, padding: '2rem' }}>
        No subscription data yet
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: 250 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="count"
            nameKey="tier"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1a1f',
              border: `1px solid ${COLORS.border}`,
              borderRadius: '8px',
              color: '#fff'
            }}
          />
          <Legend 
            wrapperStyle={{ color: '#fff' }}
            formatter={(value) => {
              const normalized = typeof value === 'string' && /pro/i.test(value) ? 'Supporter' : value;
              return <span style={{ color: '#fff' }}>{normalized}</span>;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

// Main Analytics Dashboard Component
export const AnalyticsDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [kpis, setKpis] = useState<KPI | null>(null);
  const [mrrHistory, setMrrHistory] = useState<MRRDataPoint[]>([]);
  const [forecast, setForecast] = useState<{ current_mrr: number; forecast: ForecastDataPoint[] } | null>(null);
  const [cohorts, setCohorts] = useState<CohortData[]>([]);
  const [subscriptions, setSubscriptions] = useState<{ tier: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'revenue' | 'retention'>('overview');

  useEffect(() => {
    fetchAllData();
    // Refresh every 60 seconds for real-time updates
    const interval = setInterval(fetchAllData, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const authHeaders = await getAuthHeaders({ requireAuth: false });
      const opts = { headers: authHeaders };
      const [kpiRes, mrrRes, forecastRes, cohortRes, overviewRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/admin/stats/kpis`, opts),
        fetch(`${API_URL}/api/v1/admin/stats/mrr-history?days=30`, opts),
        fetch(`${API_URL}/api/v1/admin/stats/forecast?months=6`, opts),
        fetch(`${API_URL}/api/v1/admin/stats/cohort`, opts),
        fetch(`${API_URL}/api/v1/admin/stats/overview`, opts)
      ]);

      const failedEndpoints: string[] = [];
      if (kpiRes.ok) setKpis(await kpiRes.json()); else failedEndpoints.push('KPIs');
      if (mrrRes.ok) {
        const data = await mrrRes.json();
        setMrrHistory(data.data || []);
      } else failedEndpoints.push('MRR History');
      if (forecastRes.ok) setForecast(await forecastRes.json()); else failedEndpoints.push('Forecast');
      if (cohortRes.ok) {
        const data = await cohortRes.json();
        setCohorts(data.cohorts || []);
      } else failedEndpoints.push('Cohorts');
      if (overviewRes.ok) {
        const data = await overviewRes.json();
        setSubscriptions(data.subscriptions || []);
      } else failedEndpoints.push('Overview');

      if (failedEndpoints.length > 0) {
        setError(`Failed to load: ${failedEndpoints.join(', ')}`);
      }
    } catch (error) {
      logger.error('Failed to fetch analytics:', error);
      setError('Failed to connect to API');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'subscribers' | 'revenue') => {
    try {
      const authHeaders = await getAuthHeaders({ requireAuth: false });
      const response = await fetch(`${API_URL}/api/v1/admin/export/${type}`, {
        headers: authHeaders
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        setError(`Export failed: ${response.status}`);
      }
    } catch (error) {
      logger.error('Export failed:', error);
      setError('Export failed: network error');
    }
  };

  const tabStyle = (isActive: boolean) => ({
    padding: '0.5rem 1rem',
    backgroundColor: isActive ? COLORS.primary + '20' : 'transparent',
    border: `1px solid ${isActive ? COLORS.primary : COLORS.border}`,
    borderRadius: '8px',
    color: isActive ? COLORS.primary : COLORS.muted,
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: isActive ? '600' : '500',
    transition: 'all 0.15s'
  });

  if (loading && !kpis) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: COLORS.muted }}>
        Loading analytics...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Error Banner */}
      {error && (
        <div style={{
          padding: '0.75rem 1rem',
          backgroundColor: '#ef444420',
          border: '1px solid #ef444450',
          borderRadius: '8px',
          color: '#ef4444',
          fontSize: '0.85rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>⚠️ {error}</span>
          <button onClick={() => { setError(null); fetchAllData(); }} style={{ background: 'none', border: '1px solid #ef444450', borderRadius: '4px', color: '#ef4444', padding: '0.2rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem' }}>{t('admin.retry', 'Retry')}</button>
        </div>
      )}
      {/* Header with Tabs and Export */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => setActiveTab('overview')} style={tabStyle(activeTab === 'overview')}>
            📊 Overview
          </button>
          <button onClick={() => setActiveTab('revenue')} style={tabStyle(activeTab === 'revenue')}>
            💰 Revenue
          </button>
          <button onClick={() => setActiveTab('retention')} style={tabStyle(activeTab === 'retention')}>
            📈 Retention
          </button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => handleExport('subscribers')}
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
            📥 Export Subscribers
          </button>
          <button
            onClick={() => handleExport('revenue')}
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
            📥 Export Revenue
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        <KPICard
          title="MRR"
          value={`$${kpis?.mrr?.toFixed(2) || '0.00'}`}
          subtitle="Monthly Recurring"
          icon="💵"
          color={COLORS.success}
        />
        <KPICard
          title="ARR"
          value={`$${kpis?.arr?.toFixed(2) || '0.00'}`}
          subtitle="Annual Run Rate"
          icon="📈"
          color={COLORS.primary}
        />
        <KPICard
          title="ARPU"
          value={`$${kpis?.arpu?.toFixed(2) || '0.00'}`}
          subtitle="Avg Revenue/User"
          icon="👤"
          color={COLORS.secondary}
        />
        <KPICard
          title="LTV"
          value={`$${kpis?.ltv?.toFixed(2) || '0.00'}`}
          subtitle="Lifetime Value"
          icon="💎"
          color={COLORS.warning}
        />
        <KPICard
          title="Conversion"
          value={`${kpis?.conversion_rate || 0}%`}
          subtitle={`${kpis?.paid_users || 0} of ${kpis?.total_users || 0}`}
          icon="🎯"
          color={COLORS.success}
        />
        <KPICard
          title="Churn Rate"
          value={`${kpis?.churn_rate || 0}%`}
          subtitle="Monthly"
          icon="📉"
          color={kpis?.churn_rate && kpis.churn_rate > 5 ? COLORS.danger : COLORS.success}
        />
        <KPICard
          title="Retention"
          value={`${kpis?.retention_rate || 100}%`}
          subtitle="Monthly"
          icon="🔒"
          color={COLORS.success}
        />
        <KPICard
          title="Net Growth"
          value={kpis?.net_growth || 0}
          subtitle="This Month"
          trend={kpis?.net_growth ? (kpis.net_growth > 0 ? 100 : -100) : undefined}
          icon="🚀"
          color={kpis?.net_growth && kpis.net_growth >= 0 ? COLORS.success : COLORS.danger}
        />
      </div>

      {/* Charts based on active tab */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
          <div style={{ backgroundColor: COLORS.background, borderRadius: '12px', padding: '1.25rem', border: `1px solid ${COLORS.border}` }}>
            <h3 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1rem' }}>📈 MRR Trend (30 Days)</h3>
            <MRRChart data={mrrHistory} />
          </div>
          <div style={{ backgroundColor: COLORS.background, borderRadius: '12px', padding: '1.25rem', border: `1px solid ${COLORS.border}` }}>
            <h3 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1rem' }}>🎯 Subscription Distribution</h3>
            <SubscriptionPieChart data={subscriptions} />
          </div>
        </div>
      )}

      {activeTab === 'revenue' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
          <div style={{ backgroundColor: COLORS.background, borderRadius: '12px', padding: '1.25rem', border: `1px solid ${COLORS.border}` }}>
            <h3 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1rem' }}>📈 MRR History</h3>
            <MRRChart data={mrrHistory} />
          </div>
          <div style={{ backgroundColor: COLORS.background, borderRadius: '12px', padding: '1.25rem', border: `1px solid ${COLORS.border}` }}>
            <h3 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1rem' }}>🔮 6-Month Revenue Forecast</h3>
            {forecast && <ForecastChart data={forecast.forecast} currentMRR={forecast.current_mrr} />}
          </div>
        </div>
      )}

      {activeTab === 'retention' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
          <div style={{ backgroundColor: COLORS.background, borderRadius: '12px', padding: '1.25rem', border: `1px solid ${COLORS.border}` }}>
            <h3 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1rem' }}>📊 Cohort Retention by Month</h3>
            <CohortChart data={cohorts} />
          </div>
        </div>
      )}

      {/* Last Updated */}
      <div style={{ textAlign: 'center', color: COLORS.muted, fontSize: '0.75rem' }}>
        Last updated: {new Date().toLocaleTimeString()} • Auto-refreshes every 60s
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
