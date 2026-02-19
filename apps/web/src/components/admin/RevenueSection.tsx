import React from 'react';
import { colors } from '../../utils/styles';
import { downloadCSV } from '../../utils/csvExport';
import type { RevenueData, ChurnAlert } from './FinanceTabHelpers';

interface RevenueSectionProps {
  loading: boolean;
  error: string | null;
  revenue: RevenueData | null;
  churnAlerts: ChurnAlert[];
  syncingSubscriptions: boolean;
  onSyncSubscriptions: () => void;
  onRetry: () => void;
}

export const RevenueSection: React.FC<RevenueSectionProps> = ({
  loading,
  error,
  revenue,
  churnAlerts,
  syncingSubscriptions,
  onSyncSubscriptions,
  onRetry,
}) => {
  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: colors.textMuted }}>Loading revenue data...</div>;
  }
  if (error || !revenue) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ color: colors.error, marginBottom: '0.75rem' }}>Failed to load revenue data</div>
        {error && <div style={{ color: colors.textMuted, fontSize: '0.8rem', marginBottom: '1rem' }}>{error}</div>}
        <button onClick={onRetry} style={{ padding: '0.5rem 1rem', backgroundColor: `${colors.primary}20`, color: colors.primary, border: `1px solid ${colors.primary}40`, borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Key Revenue Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
        {[
          { label: 'Monthly Recurring Revenue', value: `$${revenue.mrr.toFixed(2)}`, color: colors.success, icon: '💰' },
          { label: 'Total Revenue (All Time)', value: `$${revenue.total.toFixed(2)}`, color: colors.gold, icon: '🏆' },
          { label: 'Active Subscriptions', value: revenue.activeSubscriptions.toString(), color: colors.purple, icon: '🔄' },
          { label: 'Stripe Balance', value: `$${(revenue.stripeBalance.available / 100).toFixed(2)}`, color: colors.primary, icon: '🏦' },
        ].map((metric, i) => (
          <div key={i} style={{
            backgroundColor: colors.cardAlt, borderRadius: '10px', padding: '1rem',
            border: `1px solid ${colors.border}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
              <span>{metric.icon}</span>
              <span style={{ color: colors.textMuted, fontSize: '0.75rem' }}>{metric.label}</span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: metric.color }}>
              {metric.value}
            </div>
          </div>
        ))}
      </div>

      {/* Sync Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={onSyncSubscriptions}
          disabled={syncingSubscriptions}
          style={{
            padding: '0.4rem 0.8rem',
            backgroundColor: syncingSubscriptions ? '#374151' : `${colors.primary}20`,
            color: syncingSubscriptions ? colors.textMuted : colors.primary,
            border: `1px solid ${colors.primary}40`,
            borderRadius: '6px', fontSize: '0.75rem',
            cursor: syncingSubscriptions ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: '0.35rem',
          }}
        >
          {syncingSubscriptions ? '⏳ Syncing...' : '🔄 Sync with Stripe'}
        </button>
      </div>

      {/* Subscription Breakdown */}
      {revenue.subscriptions.length > 0 && (
        <div style={{ backgroundColor: colors.cardAlt, borderRadius: '10px', padding: '1rem', border: `1px solid ${colors.border}` }}>
          <div style={{ fontSize: '0.75rem', color: colors.textSecondary, fontWeight: 600, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Subscription Tiers
          </div>
          {revenue.subscriptions.map((sub, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: i < revenue.subscriptions.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none' }}>
              <span style={{ color: colors.text, fontSize: '0.85rem' }}>{sub.tier}</span>
              <span style={{ color: colors.primary, fontWeight: 600, fontSize: '0.85rem' }}>{sub.count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Recent Payments */}
      <div style={{ backgroundColor: colors.cardAlt, borderRadius: '10px', padding: '1rem', border: `1px solid ${colors.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.75rem', color: colors.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Recent Payments
          </div>
          {revenue.recentPayments.length > 0 && (
            <button
              onClick={() => downloadCSV(revenue.recentPayments.map(p => ({ amount: `$${p.amount.toFixed(2)}`, date: p.date, email: p.customer_email || 'N/A' })), 'payments')}
              style={{ background: 'none', border: `1px solid ${colors.border}`, borderRadius: '4px', color: colors.textMuted, padding: '0.15rem 0.4rem', cursor: 'pointer', fontSize: '0.65rem' }}
            >
              📥 CSV
            </button>
          )}
        </div>
        {revenue.recentPayments.length > 0 ? (
          revenue.recentPayments.slice(0, 8).map((payment, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.4rem 0',
              borderBottom: i < Math.min(revenue.recentPayments.length, 8) - 1 ? `1px solid ${colors.borderSubtle}` : 'none',
            }}>
              <div>
                <span style={{ color: colors.success, fontWeight: 600 }}>${payment.amount.toFixed(2)}</span>
                <span style={{ color: colors.textMuted, fontSize: '0.7rem', marginLeft: '0.5rem' }}>
                  {new Date(payment.date).toLocaleDateString()}
                </span>
              </div>
              {payment.customer_email && (
                <span style={{ color: colors.textSecondary, fontSize: '0.7rem' }}>
                  {payment.customer_email.length > 25 ? payment.customer_email.substring(0, 25) + '…' : payment.customer_email}
                </span>
              )}
            </div>
          ))
        ) : (
          <div style={{ color: colors.textMuted, fontSize: '0.8rem', fontStyle: 'italic', padding: '1rem 0', textAlign: 'center' }}>No payments yet</div>
        )}
      </div>

      {/* Churn Alerts */}
      {churnAlerts.length > 0 && (
        <div style={{ backgroundColor: colors.cardAlt, borderRadius: '10px', padding: '1rem', border: `1px solid ${colors.error}30` }}>
          <div style={{ fontSize: '0.75rem', color: colors.error, fontWeight: 600, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ⚠️ Churn Alerts ({churnAlerts.length})
          </div>
          {churnAlerts.slice(0, 5).map((alert, i) => (
            <div key={alert.event_id || i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.4rem 0',
              borderBottom: i < Math.min(churnAlerts.length, 5) - 1 ? `1px solid ${colors.borderSubtle}` : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: colors.error, fontSize: '0.75rem' }}>✕</span>
                <span style={{ color: colors.text, fontSize: '0.8rem' }}>{alert.customer_id}</span>
                <span style={{ padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 600, backgroundColor: `${colors.error}15`, color: colors.error }}>
                  {alert.reason}
                </span>
              </div>
              <span style={{ color: colors.textMuted, fontSize: '0.7rem' }}>
                {new Date(alert.canceled_at).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
