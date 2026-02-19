import React from 'react';
import { colors } from '../../utils/styles';
import { downloadCSV } from '../../utils/csvExport';
import SupporterBadge from '../SupporterBadge';
import type { RevenueData } from './FinanceTabHelpers';
import { inputStyle } from './FinanceTabHelpers';

interface SubscribersSectionProps {
  revenue: RevenueData | null;
  onGrantSubscription?: (email: string, tier: string, source: string, reason: string) => Promise<{ success: boolean; message: string }>;
  grantEmail: string;
  setGrantEmail: (v: string) => void;
  grantSource: 'kofi' | 'manual' | 'stripe';
  setGrantSource: (v: 'kofi' | 'manual' | 'stripe') => void;
  grantReason: string;
  setGrantReason: (v: string) => void;
  grantLoading: boolean;
  setGrantLoading: (v: boolean) => void;
  grantResult: { success: boolean; message: string } | null;
  setGrantResult: (v: { success: boolean; message: string } | null) => void;
}

export const SubscribersSection: React.FC<SubscribersSectionProps> = ({
  revenue,
  onGrantSubscription,
  grantEmail,
  setGrantEmail,
  grantSource,
  setGrantSource,
  grantReason,
  setGrantReason,
  grantLoading,
  setGrantLoading,
  grantResult,
  setGrantResult,
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
    {/* Manual Subscription Grant */}
    {onGrantSubscription && (
      <div style={{ backgroundColor: colors.cardAlt, borderRadius: '10px', padding: '1rem', border: `1px solid ${'#FF6B8A'}30` }}>
        <h3 style={{ color: colors.text, fontSize: '0.9rem', margin: '0 0 0.5rem 0' }}>💖 Manual Supporter Grant</h3>
        <p style={{ color: colors.textSecondary, fontSize: '0.75rem', marginBottom: '0.75rem' }}>
          Grant or revoke Supporter perks for Ko-Fi subscribers or manual grants. Updates badge + Discord role.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <input
            type="email"
            placeholder="User email address"
            value={grantEmail}
            onChange={e => { setGrantEmail(e.target.value); setGrantResult(null); }}
            style={inputStyle}
          />
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <span style={{ color: colors.textSecondary, fontSize: '0.75rem' }}>Source:</span>
            {(['kofi', 'manual', 'stripe'] as const).map(src => (
              <button
                key={src}
                onClick={() => setGrantSource(src)}
                style={{
                  padding: '0.25rem 0.55rem', borderRadius: '6px', fontSize: '0.7rem', cursor: 'pointer',
                  backgroundColor: grantSource === src ? '#FF6B8A20' : 'transparent',
                  border: `1px solid ${grantSource === src ? '#FF6B8A' : colors.border}`,
                  color: grantSource === src ? '#FF6B8A' : colors.textMuted,
                  textTransform: 'capitalize',
                }}
              >
                {src === 'kofi' ? 'Ko-Fi' : src}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Reason (optional)"
            value={grantReason}
            onChange={e => setGrantReason(e.target.value)}
            style={inputStyle}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={async () => {
                if (!grantEmail.trim()) return;
                setGrantLoading(true); setGrantResult(null);
                const result = await onGrantSubscription(grantEmail.trim(), 'supporter', grantSource, grantReason);
                setGrantResult(result); setGrantLoading(false);
                if (result.success) { setGrantEmail(''); setGrantReason(''); }
              }}
              disabled={grantLoading || !grantEmail.trim()}
              style={{
                flex: 1, padding: '0.5rem', borderRadius: '6px', fontWeight: 600, fontSize: '0.8rem',
                backgroundColor: grantLoading ? '#374151' : `${colors.success}20`,
                color: grantLoading ? colors.textMuted : colors.success,
                border: `1px solid ${colors.success}50`,
                cursor: grantLoading || !grantEmail.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {grantLoading ? '⏳ Processing...' : '✅ Grant Supporter'}
            </button>
            <button
              onClick={async () => {
                if (!grantEmail.trim()) return;
                setGrantLoading(true); setGrantResult(null);
                const result = await onGrantSubscription(grantEmail.trim(), 'free', grantSource, grantReason || 'Revoked');
                setGrantResult(result); setGrantLoading(false);
                if (result.success) { setGrantEmail(''); setGrantReason(''); }
              }}
              disabled={grantLoading || !grantEmail.trim()}
              style={{
                padding: '0.5rem 0.8rem', borderRadius: '6px', fontWeight: 600, fontSize: '0.8rem',
                backgroundColor: grantLoading ? '#374151' : `${colors.error}20`,
                color: grantLoading ? colors.textMuted : colors.error,
                border: `1px solid ${colors.error}50`,
                cursor: grantLoading || !grantEmail.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              Revoke
            </button>
          </div>
          {grantResult && (
            <div style={{
              padding: '0.4rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem',
              backgroundColor: grantResult.success ? `${colors.success}10` : `${colors.error}10`,
              border: `1px solid ${grantResult.success ? `${colors.success}30` : `${colors.error}30`}`,
              color: grantResult.success ? colors.success : colors.error,
            }}>
              {grantResult.message}
            </div>
          )}
        </div>
      </div>
    )}

    {/* Recent Subscribers */}
    <div style={{ backgroundColor: colors.cardAlt, borderRadius: '10px', padding: '1rem', border: `1px solid ${colors.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div style={{ fontSize: '0.75rem', color: colors.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Recent Subscribers
        </div>
        {revenue?.recentSubscribers && revenue.recentSubscribers.length > 0 && (
          <button
            onClick={() => downloadCSV(
              (revenue?.recentSubscribers || []).map(s => ({ username: s.username, tier: s.tier, supporting_since: s.created_at })),
              'subscribers'
            )}
            style={{ background: 'none', border: `1px solid ${colors.border}`, borderRadius: '4px', color: colors.textMuted, padding: '0.15rem 0.4rem', cursor: 'pointer', fontSize: '0.65rem' }}
          >
            📥 CSV
          </button>
        )}
      </div>
      {revenue?.recentSubscribers && revenue.recentSubscribers.length > 0 ? (
        revenue.recentSubscribers.slice(0, 10).map((sub, i) => {
          const subDate = new Date(sub.created_at);
          const daysAgo = Math.floor((Date.now() - subDate.getTime()) / 86400000);
          const durationLabel = daysAgo < 1 ? 'Today' : daysAgo === 1 ? '1 day' : daysAgo < 30 ? `${daysAgo} days` : `${Math.floor(daysAgo / 30)} mo`;
          return (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.5rem 0',
              borderBottom: i < Math.min(revenue.recentSubscribers.length, 10) - 1 ? `1px solid ${colors.borderSubtle}` : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: colors.text, fontWeight: 500 }}>{sub.username}</span>
                <SupporterBadge size="sm" />
                <span style={{ padding: '0.05rem 0.35rem', borderRadius: '4px', fontSize: '0.55rem', fontWeight: 600, backgroundColor: `${colors.success}15`, color: colors.success }}>
                  {durationLabel}
                </span>
              </div>
              <span style={{ color: colors.textSecondary, fontSize: '0.7rem' }}>
                Since {subDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          );
        })
      ) : (
        <div style={{ padding: '2rem', textAlign: 'center', color: colors.textMuted, fontSize: '0.8rem' }}>No subscribers yet</div>
      )}
    </div>
  </div>
);
