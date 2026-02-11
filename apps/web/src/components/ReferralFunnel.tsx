import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { REFERRAL_TIER_COLORS, REFERRAL_TIER_LABELS, ReferralTier } from '../utils/constants';

interface ReferralMetrics {
  totalReferrals: number;
  pendingReferrals: number;
  verifiedReferrals: number;
  invalidReferrals: number;
  conversionRate: number;
  uniqueReferrers: number;
  tierBreakdown: { tier: string; count: number }[];
  topReferrers: { username: string; count: number; tier: string | null }[];
  recentReferrals: { referrer: string; referred: string; status: string; source: string; created_at: string }[];
  suspiciousIps: number;
  sourceBreakdown: { source: string; count: number }[];
}

export const ReferralFunnel: React.FC = () => {
  const { t } = useTranslation();
  const [metrics, setMetrics] = useState<ReferralMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    try {
      // Fetch all referrals
      const { data: referrals } = await supabase
        .from('referrals')
        .select('id, referrer_user_id, referred_user_id, referral_code, status, created_at, signup_ip, source')
        .order('created_at', { ascending: false });

      // Fetch referrer profiles (users with referral_count > 0)
      const { data: referrers } = await supabase
        .from('profiles')
        .select('id, linked_username, username, referral_count, referral_tier')
        .gt('referral_count', 0)
        .order('referral_count', { ascending: false })
        .limit(10);

      // Fetch tier breakdown
      const { data: tierData } = await supabase
        .from('profiles')
        .select('referral_tier')
        .not('referral_tier', 'is', null);

      const allRefs = referrals || [];
      const pending = allRefs.filter(r => r.status === 'pending').length;
      const verified = allRefs.filter(r => r.status === 'verified').length;
      const invalid = allRefs.filter(r => r.status === 'invalid').length;

      // Count suspicious IPs (IPs that appear 3+ times for same referrer)
      const ipCounts = new Map<string, number>();
      allRefs.forEach(r => {
        if (r.signup_ip) {
          const key = `${r.referrer_user_id}:${r.signup_ip}`;
          ipCounts.set(key, (ipCounts.get(key) || 0) + 1);
        }
      });
      const suspiciousIps = Array.from(ipCounts.values()).filter(c => c >= 3).length;

      // Unique referrers
      const uniqueReferrerIds = new Set(allRefs.map(r => r.referrer_user_id));

      // Tier breakdown
      const tierCounts = new Map<string, number>();
      (tierData || []).forEach(p => {
        if (p.referral_tier) {
          tierCounts.set(p.referral_tier, (tierCounts.get(p.referral_tier) || 0) + 1);
        }
      });

      // Fetch recent referral details (last 10)
      const recentRefs = allRefs.slice(0, 10);
      const recentReferralDetails: ReferralMetrics['recentReferrals'] = recentRefs.map(r => ({
        referrer: r.referral_code || 'unknown',
        referred: r.referred_user_id?.substring(0, 8) + '...' || 'unknown',
        status: r.status || 'pending',
        source: r.source || 'referral_link',
        created_at: r.created_at,
      }));

      // Source breakdown
      const sourceCounts = new Map<string, number>();
      allRefs.forEach(r => {
        const src = r.source || 'referral_link';
        sourceCounts.set(src, (sourceCounts.get(src) || 0) + 1);
      });

      setMetrics({
        totalReferrals: allRefs.length,
        pendingReferrals: pending,
        verifiedReferrals: verified,
        invalidReferrals: invalid,
        conversionRate: allRefs.length > 0 ? Math.round((verified / allRefs.length) * 100) : 0,
        uniqueReferrers: uniqueReferrerIds.size,
        tierBreakdown: Array.from(tierCounts.entries()).map(([tier, count]) => ({ tier, count })),
        topReferrers: (referrers || []).map(r => ({
          username: r.linked_username || r.username || 'Anonymous',
          count: r.referral_count || 0,
          tier: r.referral_tier,
        })),
        recentReferrals: recentReferralDetails,
        suspiciousIps,
        sourceBreakdown: Array.from(sourceCounts.entries()).map(([source, count]) => ({ source, count })),
      });
    } catch (err) {
      console.error('Failed to fetch referral metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ color: '#6b7280', padding: '2rem', textAlign: 'center' }}>Loading referral metrics...</div>;
  }

  if (!metrics) {
    return <div style={{ color: '#6b7280', padding: '2rem', textAlign: 'center' }}>No referral data available.</div>;
  }

  const statCardStyle: React.CSSProperties = {
    backgroundColor: '#111116',
    borderRadius: '10px',
    padding: '1rem',
    border: '1px solid #2a2a2a',
    textAlign: 'center',
  };

  return (
    <div>
      <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: '700', marginTop: 0, marginBottom: '1rem' }}>
        🏛️ Referral Funnel Metrics
      </h3>

      {/* Top-level stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={statCardStyle}>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#22d3ee' }}>{metrics.totalReferrals}</div>
          <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.25rem' }}>{t('referralFunnel.totalReferrals')}</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#fbbf24' }}>{metrics.pendingReferrals}</div>
          <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.25rem' }}>{t('referralFunnel.pending')}</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#22c55e' }}>{metrics.verifiedReferrals}</div>
          <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.25rem' }}>{t('referralFunnel.verified')}</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#ef4444' }}>{metrics.invalidReferrals}</div>
          <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.25rem' }}>{t('referralFunnel.invalid')}</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#a855f7' }}>{metrics.conversionRate}%</div>
          <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.25rem' }}>{t('referralFunnel.conversionRate')}</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#fff' }}>{metrics.uniqueReferrers}</div>
          <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.25rem' }}>{t('referralFunnel.activeReferrers')}</div>
        </div>
      </div>

      {/* Source Attribution */}
      {metrics.sourceBreakdown.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
          {metrics.sourceBreakdown.map(({ source, count }) => {
            const label = source === 'referral_link' ? '🔗 Referral Links' : source === 'endorsement' ? '🗳️ Endorsements' : source;
            const color = source === 'referral_link' ? '#22d3ee' : '#a855f7';
            return (
              <div key={source} style={{ ...statCardStyle, border: `1px solid ${color}30` }}>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', color }}>{count}</div>
                <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.25rem' }}>{label}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Suspicious IP alert */}
      {metrics.suspiciousIps > 0 && (
        <div style={{
          backgroundColor: '#ef444415',
          border: '1px solid #ef444440',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <span style={{ fontSize: '1rem' }}>⚠️</span>
          <span style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: '600' }}>
            {metrics.suspiciousIps} suspicious IP pattern{metrics.suspiciousIps > 1 ? 's' : ''} detected
          </span>
          <span style={{ color: '#6b7280', fontSize: '0.7rem' }}>
            (same IP + referrer appearing 3+ times)
          </span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
        {/* Tier Breakdown */}
        <div style={{ ...statCardStyle, textAlign: 'left' }}>
          <h4 style={{ color: '#fff', fontSize: '0.85rem', margin: '0 0 0.75rem', fontWeight: '600' }}>{t('referralFunnel.tierDistribution')}</h4>
          {metrics.tierBreakdown.length === 0 ? (
            <div style={{ color: '#4b5563', fontSize: '0.8rem' }}>{t('referralFunnel.noTiersYet')}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {(['ambassador', 'consul', 'recruiter', 'scout'] as ReferralTier[]).map(tier => {
                const count = metrics.tierBreakdown.find(t => t.tier === tier)?.count || 0;
                const maxCount = Math.max(...metrics.tierBreakdown.map(t => t.count), 1);
                return (
                  <div key={tier}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                      <span style={{ color: REFERRAL_TIER_COLORS[tier], fontSize: '0.75rem', fontWeight: '600' }}>
                        {REFERRAL_TIER_LABELS[tier]}
                      </span>
                      <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>{count}</span>
                    </div>
                    <div style={{ height: '6px', backgroundColor: '#1a1a1a', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.max((count / maxCount) * 100, count > 0 ? 5 : 0)}%`,
                        height: '100%',
                        backgroundColor: REFERRAL_TIER_COLORS[tier],
                        borderRadius: '3px',
                        transition: 'width 0.3s',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Referrers */}
        <div style={{ ...statCardStyle, textAlign: 'left' }}>
          <h4 style={{ color: '#fff', fontSize: '0.85rem', margin: '0 0 0.75rem', fontWeight: '600' }}>{t('referralFunnel.topReferrers')}</h4>
          {metrics.topReferrers.length === 0 ? (
            <div style={{ color: '#4b5563', fontSize: '0.8rem' }}>{t('referralFunnel.noReferrersYet')}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {metrics.topReferrers.slice(0, 5).map((ref, i) => {
                const tierColor = ref.tier ? REFERRAL_TIER_COLORS[ref.tier as ReferralTier] || '#fff' : '#fff';
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0' }}>
                    <span style={{ color: '#4b5563', fontSize: '0.7rem', width: '1.2rem' }}>#{i + 1}</span>
                    <span style={{ color: tierColor, fontSize: '0.8rem', fontWeight: '600', flex: 1 }}>
                      {ref.username}
                    </span>
                    {ref.tier && (
                      <span style={{
                        fontSize: '0.55rem',
                        padding: '0.1rem 0.3rem',
                        backgroundColor: `${tierColor}15`,
                        border: `1px solid ${tierColor}40`,
                        borderRadius: '3px',
                        color: tierColor,
                        fontWeight: '600',
                        textTransform: 'uppercase',
                      }}>
                        {ref.tier}
                      </span>
                    )}
                    <span style={{ color: '#22d3ee', fontSize: '0.8rem', fontWeight: '700' }}>{ref.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Referrals Table */}
      <div style={{ ...statCardStyle, textAlign: 'left', marginTop: '1rem' }}>
        <h4 style={{ color: '#fff', fontSize: '0.85rem', margin: '0 0 0.75rem', fontWeight: '600' }}>{t('referralFunnel.recentReferrals')}</h4>
        {metrics.recentReferrals.length === 0 ? (
          <div style={{ color: '#4b5563', fontSize: '0.8rem' }}>{t('referralFunnel.noReferralsYet')}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                  <th style={{ textAlign: 'left', padding: '0.4rem', color: '#6b7280', fontWeight: '600' }}>{t('referralFunnel.referrer')}</th>
                  <th style={{ textAlign: 'left', padding: '0.4rem', color: '#6b7280', fontWeight: '600' }}>{t('referralFunnel.referred')}</th>
                  <th style={{ textAlign: 'left', padding: '0.4rem', color: '#6b7280', fontWeight: '600' }}>{t('referralFunnel.status')}</th>
                  <th style={{ textAlign: 'left', padding: '0.4rem', color: '#6b7280', fontWeight: '600' }}>{t('referralFunnel.source')}</th>
                  <th style={{ textAlign: 'left', padding: '0.4rem', color: '#6b7280', fontWeight: '600' }}>{t('referralFunnel.date')}</th>
                </tr>
              </thead>
              <tbody>
                {metrics.recentReferrals.map((ref, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #1a1a1a' }}>
                    <td style={{ padding: '0.4rem', color: '#fff' }}>{ref.referrer}</td>
                    <td style={{ padding: '0.4rem', color: '#9ca3af' }}>{ref.referred}</td>
                    <td style={{ padding: '0.4rem' }}>
                      <span style={{
                        fontSize: '0.65rem',
                        padding: '0.1rem 0.3rem',
                        borderRadius: '3px',
                        fontWeight: '600',
                        backgroundColor: ref.status === 'verified' ? '#22c55e15' : ref.status === 'invalid' ? '#ef444415' : '#fbbf2415',
                        color: ref.status === 'verified' ? '#22c55e' : ref.status === 'invalid' ? '#ef4444' : '#fbbf24',
                        border: `1px solid ${ref.status === 'verified' ? '#22c55e40' : ref.status === 'invalid' ? '#ef444440' : '#fbbf2440'}`,
                      }}>
                        {ref.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '0.4rem' }}>
                      <span style={{
                        fontSize: '0.6rem',
                        padding: '0.1rem 0.3rem',
                        borderRadius: '3px',
                        backgroundColor: ref.source === 'endorsement' ? '#a855f715' : '#22d3ee15',
                        color: ref.source === 'endorsement' ? '#a855f7' : '#22d3ee',
                        border: `1px solid ${ref.source === 'endorsement' ? '#a855f740' : '#22d3ee40'}`,
                      }}>
                        {ref.source === 'endorsement' ? '🗳️' : '🔗'}
                      </span>
                    </td>
                    <td style={{ padding: '0.4rem', color: '#6b7280' }}>
                      {new Date(ref.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReferralFunnel;
