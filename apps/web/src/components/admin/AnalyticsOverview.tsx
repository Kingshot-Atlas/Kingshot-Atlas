import React from 'react';
import type { AnalyticsData } from './types';

interface AnalyticsOverviewProps {
  analytics: AnalyticsData | null;
  syncingSubscriptions: boolean;
  onSyncSubscriptions: () => void;
}

export const AnalyticsOverview: React.FC<AnalyticsOverviewProps> = ({
  analytics,
  syncingSubscriptions,
  onSyncSubscriptions
}) => {
  if (!analytics) {
    return <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>Loading analytics...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Key Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        {[
          { label: 'Total Events', value: analytics.totalVisits.toLocaleString(), color: '#22d3ee', icon: '👁️' },
          { label: 'Sessions (local)', value: analytics.uniqueVisitors.toLocaleString(), color: '#a855f7', icon: '👤' },
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
            { label: 'Atlas Pro', value: analytics.userStats.pro, color: '#22d3ee' },
            { label: 'Atlas Recruiter', value: analytics.userStats.recruiter, color: '#a855f7' },
          ].map((tier, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: tier.color }}>{tier.value}</div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{tier.label}</div>
            </div>
          ))}
        </div>
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
                  backgroundColor: sub.tier === 'recruiter' ? '#f9731620' : '#22d3ee20',
                  color: sub.tier === 'recruiter' ? '#f97316' : '#22d3ee',
                  borderRadius: '9999px',
                  fontSize: '0.7rem',
                  fontWeight: '600',
                  textTransform: 'uppercase'
                }}>
                  {sub.tier}
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
        {analytics.pageViews.map((page, i) => (
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
        ))}
      </div>
    </div>
  );
};

export default AnalyticsOverview;
