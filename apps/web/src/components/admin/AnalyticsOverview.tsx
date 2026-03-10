import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { AnalyticsData } from './types';
import { colors } from '../../utils/styles';
import { supabase } from '../../lib/supabase';

// S3.4: Inline SVG sparkline component
const Sparkline: React.FC<{ data: number[]; color: string; width?: number; height?: number }> = ({ data, color, width = 80, height = 24 }) => {
  if (!data.length || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block', opacity: 0.7 }}>
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
    </svg>
  );
};

// Prep Scheduler usage analytics for admin dashboard
const PrepSchedulerStats: React.FC = () => {
  const [stats, setStats] = useState<{ schedules: number; submissions: number; assignments: number; kingdoms: number } | null>(null);
  useEffect(() => {
    if (!supabase) return;
    (async () => {
      try {
        const [{ count: schedCount }, { count: subCount }, { count: assignCount }] = await Promise.all([
          supabase.from('prep_schedules').select('*', { count: 'exact', head: true }),
          supabase.from('prep_submissions').select('*', { count: 'exact', head: true }),
          supabase.from('prep_slot_assignments').select('*', { count: 'exact', head: true }),
        ]);
        const { data: kingdoms } = await supabase.from('prep_schedules').select('kingdom_number');
        const uniqueKingdoms = new Set((kingdoms || []).map((k: { kingdom_number: number }) => k.kingdom_number));
        setStats({ schedules: schedCount || 0, submissions: subCount || 0, assignments: assignCount || 0, kingdoms: uniqueKingdoms.size });
      } catch { /* silent */ }
    })();
  }, []);

  if (!stats) return null;
  return (
    <div style={{ backgroundColor: colors.cardAlt, borderRadius: '12px', padding: '1.5rem', border: `1px solid #a855f730` }}>
      <h3 style={{ color: colors.text, marginBottom: '1rem', fontSize: '1rem' }}>📅 Prep Scheduler Usage</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        {[
          { label: 'Schedules', value: stats.schedules, color: '#a855f7' },
          { label: 'Submissions', value: stats.submissions, color: '#22d3ee' },
          { label: 'Assignments', value: stats.assignments, color: '#22c55e' },
          { label: 'Kingdoms', value: stats.kingdoms, color: '#f59e0b' },
        ].map((s, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.8rem', color: colors.textMuted }}>{s.label}</div>
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

export const AnalyticsOverview: React.FC<AnalyticsOverviewProps> = ({
  analytics,
  syncingSubscriptions,
  onSyncSubscriptions,
  currentKvK,
  incrementingKvK,
  onIncrementKvK,
}) => {
  const { t } = useTranslation();

  // Fetch real sparkline data from Supabase (daily signups)
  const [sparkData, setSparkData] = useState<{ signups: number[] }>({ signups: [] });
  useEffect(() => {
    if (!supabase) return;
    (async () => {
      try {
        const { data: signupData } = await supabase.rpc('get_daily_signups');
        if (Array.isArray(signupData)) {
          setSparkData({ signups: signupData.map((d: { count: number }) => d.count) });
        }
      } catch { /* silent - function may not exist yet */ }
    })();
  }, [analytics]);

  if (!analytics) {
    return <div style={{ textAlign: 'center', padding: '2rem', color: colors.textMuted }}>Loading analytics...</div>;
  }

  // Revenue sparkline: recent payments in chronological order (oldest first)
  const revenueSparkData = analytics.revenue.recentPayments
    ? [...analytics.revenue.recentPayments].reverse().slice(-10).map((p: { amount: number }) => p.amount)
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Key Metrics with S3.4 Sparklines */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        {[
          { label: t('admin.totalUsers', 'Total Users'), value: analytics.userStats.total.toLocaleString(), color: colors.success, icon: '👥', sparkData: sparkData.signups.length >= 2 ? sparkData.signups : [] },
          { label: t('admin.monthlyRevenue', 'Monthly Revenue'), value: `$${analytics.revenue.monthly.toFixed(2)}`, color: colors.gold, icon: '💰', sparkData: revenueSparkData },
        ].map((metric, i) => (
          <div key={i} style={{
            backgroundColor: colors.cardAlt,
            borderRadius: '12px',
            padding: '1.25rem',
            border: `1px solid ${colors.border}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>{metric.icon}</span>
                <span style={{ color: colors.textMuted, fontSize: '0.85rem' }}>{metric.label}</span>
              </div>
              <Sparkline data={metric.sparkData} color={metric.color} />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: '700', color: metric.color }}>
              {metric.value}
            </div>
          </div>
        ))}
      </div>

      {/* User Breakdown */}
      <div style={{ backgroundColor: colors.cardAlt, borderRadius: '12px', padding: '1.5rem', border: `1px solid ${colors.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ color: colors.text, fontSize: '1rem', margin: 0 }}>👥 User Breakdown</h3>
          <button
            onClick={onSyncSubscriptions}
            disabled={syncingSubscriptions}
            style={{
              padding: '0.35rem 0.75rem',
              backgroundColor: syncingSubscriptions ? '#374151' : `${colors.primary}20`,
              color: syncingSubscriptions ? colors.textMuted : colors.primary,
              border: `1px solid ${colors.primary}40`,
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
            { label: t('admin.freeUsers', 'Free Users'), value: analytics.userStats.free, color: colors.textMuted },
            { label: t('admin.kingshotLinked', 'Kingshot Linked'), value: analytics.userStats.kingshot_linked, color: colors.gold },
            { label: t('admin.atlasSupporter', 'Atlas Supporter'), value: analytics.userStats.pro, color: '#FF6B8A' },
          ].map((tier, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: tier.color }}>{tier.value}</div>
              <div style={{ fontSize: '0.8rem', color: colors.textMuted }}>{tier.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* KvK Management */}
      <div style={{ backgroundColor: colors.cardAlt, borderRadius: '12px', padding: '1.5rem', border: `1px solid ${'#8b5cf6'}40` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ color: colors.text, fontSize: '1rem', margin: 0 }}>⚔️ KvK Management</h3>
          <div style={{ 
            padding: '0.25rem 0.75rem', 
            backgroundColor: '#8b5cf620', 
            borderRadius: '6px',
            border: `1px solid ${'#8b5cf6'}40`
          }}>
            <span style={{ color: '#8b5cf6', fontWeight: '600', fontSize: '0.9rem' }}>Current: KvK #{currentKvK}</span>
          </div>
        </div>
        <p style={{ color: colors.textSecondary, fontSize: '0.8rem', marginBottom: '1rem' }}>
          After each KvK battle phase ends, increment the KvK number to update submission forms and missing data tracking across the app.
        </p>
        <button
          onClick={onIncrementKvK}
          disabled={incrementingKvK}
          style={{
            padding: '0.6rem 1.25rem',
            backgroundColor: incrementingKvK ? '#374151' : '#8b5cf620',
            color: incrementingKvK ? colors.textMuted : '#8b5cf6',
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
      <div style={{ backgroundColor: colors.cardAlt, borderRadius: '12px', padding: '1.5rem', border: `1px solid ${colors.border}` }}>
        <h3 style={{ color: colors.text, marginBottom: '1rem', fontSize: '1rem' }}>📝 Submissions</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          {[
            { label: t('admin.pending', 'Pending'), value: analytics.submissions.pending, color: colors.gold },
            { label: t('admin.approved', 'Approved'), value: analytics.submissions.approved, color: colors.success },
            { label: t('admin.rejected', 'Rejected'), value: analytics.submissions.rejected, color: colors.error },
          ].map((stat, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: '0.8rem', color: colors.textMuted }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Prep Scheduler Usage */}
      <PrepSchedulerStats />
    </div>
  );
};

export default AnalyticsOverview;
