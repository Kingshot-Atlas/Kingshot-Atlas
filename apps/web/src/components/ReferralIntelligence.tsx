import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { REFERRAL_TIER_COLORS, REFERRAL_TIER_LABELS, ReferralTier } from '../utils/constants';
import { logger } from '../utils/logger';

// =============================================
// TYPES
// =============================================

interface ReferralRecord {
  id: string;
  referrer_user_id: string;
  referred_user_id: string;
  referral_code: string;
  status: string;
  source: string;
  created_at: string;
  verified_at: string | null;
  signup_ip: string | null;
}

interface ReferrerProfile {
  id: string;
  username: string;
  linked_username: string | null;
  referral_count: number;
  referral_tier: string | null;
  linked_kingdom: number | null;
}

interface Metrics {
  total: number;
  pending: number;
  verified: number;
  invalid: number;
  conversionRate: number;
  uniqueReferrers: number;
  sourceBreakdown: { source: string; count: number; verified: number }[];
  tierBreakdown: { tier: string; count: number }[];
  topReferrers: ReferrerProfile[];
  recentReferrals: ReferralRecord[];
  suspiciousIps: number;
  dailyTrend: { date: string; count: number }[];
  avgTimeToVerify: number | null;
  thisMonthCount: number;
  lastMonthCount: number;
}

const SOURCE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  referral_link: { label: 'Referral Links', icon: '🔗', color: '#22d3ee' },
  endorsement: { label: 'Endorsements', icon: '🗳️', color: '#a855f7' },
  review_invite: { label: 'Reviews', icon: '⭐', color: '#fbbf24' },
  transfer_listing: { label: 'Transfer Hub', icon: '🔄', color: '#22c55e' },
  manual_admin: { label: 'Manual (Admin)', icon: '✏️', color: '#f97316' },
};

// =============================================
// COMPONENT
// =============================================

export const ReferralIntelligence: React.FC = () => {
  const { t } = useTranslation();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'overview' | 'sources' | 'referrers' | 'recent' | 'manual'>('overview');

  // Manual referral assignment state
  const [manualReferrer, setManualReferrer] = useState('');
  const [manualReferred, setManualReferred] = useState('');
  const [manualSaving, setManualSaving] = useState(false);
  const [manualResult, setManualResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleManualReferral = async () => {
    if (!supabase || !manualReferrer.trim() || !manualReferred.trim()) return;
    setManualSaving(true);
    setManualResult(null);
    try {
      // Look up the referrer by linked_username or linked_player_id
      const referrerQuery = manualReferrer.trim();
      const { data: referrerData } = await supabase
        .from('profiles')
        .select('id, linked_username')
        .or(`linked_username.ilike.${referrerQuery},linked_player_id.eq.${referrerQuery}`)
        .limit(1)
        .maybeSingle();
      if (!referrerData) {
        setManualResult({ type: 'error', message: `Referrer "${referrerQuery}" not found. Use their linked username or player ID.` });
        setManualSaving(false);
        return;
      }

      // Look up the referred user
      const referredQuery = manualReferred.trim();
      const { data: referredData } = await supabase
        .from('profiles')
        .select('id, linked_username, referred_by')
        .or(`linked_username.ilike.${referredQuery},linked_player_id.eq.${referredQuery}`)
        .limit(1)
        .maybeSingle();
      if (!referredData) {
        setManualResult({ type: 'error', message: `Referred user "${referredQuery}" not found. Use their linked username or player ID.` });
        setManualSaving(false);
        return;
      }

      if (referrerData.id === referredData.id) {
        setManualResult({ type: 'error', message: 'Referrer and referred user cannot be the same person.' });
        setManualSaving(false);
        return;
      }

      // Check if referral already exists
      const { data: existing } = await supabase
        .from('referrals')
        .select('id')
        .eq('referrer_user_id', referrerData.id)
        .eq('referred_user_id', referredData.id)
        .maybeSingle();
      if (existing) {
        setManualResult({ type: 'error', message: 'This referral already exists.' });
        setManualSaving(false);
        return;
      }

      // Insert verified referral
      const { error: insertErr } = await supabase.from('referrals').insert({
        referrer_user_id: referrerData.id,
        referred_user_id: referredData.id,
        referral_code: referrerData.linked_username || referrerQuery,
        status: 'verified',
        source: 'manual_admin',
        verified_at: new Date().toISOString(),
      });
      if (insertErr) throw insertErr;

      // Update referred_by on the referred user's profile
      await supabase.from('profiles').update({ referred_by: referrerData.linked_username || referrerQuery }).eq('id', referredData.id);

      // Recount and update the referrer's count and tier
      const { count: newCount } = await supabase
        .from('referrals')
        .select('*', { count: 'exact', head: true })
        .eq('referrer_user_id', referrerData.id)
        .eq('status', 'verified');

      const tierValue = (newCount ?? 0) >= 20 ? 'ambassador' : (newCount ?? 0) >= 10 ? 'consul' : (newCount ?? 0) >= 5 ? 'recruiter' : (newCount ?? 0) >= 2 ? 'scout' : null;
      await supabase.from('profiles').update({ referral_count: newCount ?? 0, referral_tier: tierValue }).eq('id', referrerData.id);

      setManualResult({ type: 'success', message: `Referral added: ${referredData.linked_username || referredQuery} → ${referrerData.linked_username || referrerQuery} (new count: ${newCount})` });
      setManualReferrer('');
      setManualReferred('');
      fetchMetrics(); // Refresh data
    } catch (err) {
      logger.error('Manual referral failed:', err);
      setManualResult({ type: 'error', message: 'Failed to create referral. Check the console for details.' });
    }
    setManualSaving(false);
  };

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
        .select('id, referrer_user_id, referred_user_id, referral_code, status, source, created_at, verified_at, signup_ip')
        .order('created_at', { ascending: false });

      // Fetch referrer profiles
      const { data: referrers } = await supabase
        .from('profiles')
        .select('id, username, linked_username, referral_count, referral_tier, linked_kingdom')
        .gt('referral_count', 0)
        .order('referral_count', { ascending: false })
        .limit(20);

      // Fetch tier breakdown
      const { data: tierData } = await supabase
        .from('profiles')
        .select('referral_tier')
        .not('referral_tier', 'is', null);

      const allRefs = (referrals || []) as ReferralRecord[];
      const pending = allRefs.filter(r => r.status === 'pending').length;
      const verified = allRefs.filter(r => r.status === 'verified').length;
      const invalid = allRefs.filter(r => r.status === 'invalid').length;

      // Source breakdown with verified counts
      const sourceMap = new Map<string, { count: number; verified: number }>();
      allRefs.forEach(r => {
        const src = r.source || 'referral_link';
        const existing = sourceMap.get(src) || { count: 0, verified: 0 };
        existing.count++;
        if (r.status === 'verified') existing.verified++;
        sourceMap.set(src, existing);
      });

      // Suspicious IPs
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
      (tierData || []).forEach((p: { referral_tier: string }) => {
        if (p.referral_tier) {
          tierCounts.set(p.referral_tier, (tierCounts.get(p.referral_tier) || 0) + 1);
        }
      });

      // Daily trend (last 14 days)
      const dailyMap = new Map<string, number>();
      const now = new Date();
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        dailyMap.set(d.toISOString().split('T')[0] as string, 0);
      }
      allRefs.forEach(r => {
        const day = r.created_at.split('T')[0] as string;
        if (dailyMap.has(day)) {
          dailyMap.set(day, (dailyMap.get(day) || 0) + 1);
        }
      });

      // Average time to verify
      const verifiedRefs = allRefs.filter(r => r.status === 'verified' && r.verified_at);
      let avgTimeToVerify: number | null = null;
      if (verifiedRefs.length > 0) {
        const totalHours = verifiedRefs.reduce((sum, r) => {
          const created = new Date(r.created_at).getTime();
          const verified_at = new Date(r.verified_at!).getTime();
          return sum + (verified_at - created) / (1000 * 60 * 60);
        }, 0);
        avgTimeToVerify = Math.round(totalHours / verifiedRefs.length * 10) / 10;
      }

      // This month vs last month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const startOfLastMonth = new Date(startOfMonth);
      startOfLastMonth.setMonth(startOfLastMonth.getMonth() - 1);
      const thisMonthCount = allRefs.filter(r => new Date(r.created_at) >= startOfMonth).length;
      const lastMonthCount = allRefs.filter(r => {
        const d = new Date(r.created_at);
        return d >= startOfLastMonth && d < startOfMonth;
      }).length;

      setMetrics({
        total: allRefs.length,
        pending,
        verified,
        invalid,
        conversionRate: allRefs.length > 0 ? Math.round((verified / allRefs.length) * 100) : 0,
        uniqueReferrers: uniqueReferrerIds.size,
        sourceBreakdown: Array.from(sourceMap.entries())
          .map(([source, { count, verified: v }]) => ({ source, count, verified: v }))
          .sort((a, b) => b.count - a.count),
        tierBreakdown: Array.from(tierCounts.entries()).map(([tier, count]) => ({ tier, count })),
        topReferrers: (referrers || []) as ReferrerProfile[],
        recentReferrals: allRefs.slice(0, 20),
        suspiciousIps,
        dailyTrend: Array.from(dailyMap.entries()).map(([date, count]) => ({ date, count })),
        avgTimeToVerify,
        thisMonthCount,
        lastMonthCount,
      });
    } catch (err) {
      logger.error('Failed to fetch referral metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ color: '#6b7280', padding: '2rem', textAlign: 'center' }}>Loading referral intelligence...</div>;
  }

  if (!metrics) {
    return <div style={{ color: '#6b7280', padding: '2rem', textAlign: 'center' }}>No referral data available.</div>;
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#111116',
    borderRadius: '10px',
    padding: '1rem',
    border: '1px solid #2a2a2a',
  };

  const monthDelta = metrics.lastMonthCount > 0
    ? Math.round(((metrics.thisMonthCount - metrics.lastMonthCount) / metrics.lastMonthCount) * 100)
    : metrics.thisMonthCount > 0 ? 100 : 0;

  const maxDailyCount = Math.max(...metrics.dailyTrend.map(d => d.count), 1);

  return (
    <div>
      {/* Section Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {[
          { id: 'overview' as const, label: '📊 Overview' },
          { id: 'sources' as const, label: '🧭 How People Found Atlas' },
          { id: 'referrers' as const, label: '👥 Top Referrers' },
          { id: 'recent' as const, label: '📋 Recent Activity' },
          { id: 'manual' as const, label: '✏️ Manual Assign' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: activeSection === tab.id ? '700' : '500',
              border: `1px solid ${activeSection === tab.id ? '#22d3ee40' : '#2a2a2a'}`,
              backgroundColor: activeSection === tab.id ? '#22d3ee10' : 'transparent',
              color: activeSection === tab.id ? '#22d3ee' : '#6b7280',
              cursor: 'pointer',
              minHeight: '38px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ============================================= */}
      {/* OVERVIEW SECTION */}
      {/* ============================================= */}
      {activeSection === 'overview' && (
        <div>
          {/* Key Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div style={{ ...cardStyle, textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#22d3ee' }}>{metrics.total}</div>
              <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.25rem' }}>{t('referralIntelligence.totalReferrals')}</div>
            </div>
            <div style={{ ...cardStyle, textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#22c55e' }}>{metrics.verified}</div>
              <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.25rem' }}>{t('referralIntelligence.verified')}</div>
            </div>
            <div style={{ ...cardStyle, textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#fbbf24' }}>{metrics.pending}</div>
              <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.25rem' }}>{t('referralIntelligence.pending')}</div>
            </div>
            <div style={{ ...cardStyle, textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#a855f7' }}>{metrics.conversionRate}%</div>
              <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.25rem' }}>{t('referralIntelligence.conversion')}</div>
            </div>
            <div style={{ ...cardStyle, textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#fff' }}>{metrics.uniqueReferrers}</div>
              <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.25rem' }}>{t('referralIntelligence.activeReferrers')}</div>
            </div>
            <div style={{ ...cardStyle, textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '800', color: metrics.thisMonthCount > 0 ? '#22c55e' : '#6b7280' }}>
                {metrics.thisMonthCount}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.25rem' }}>
                This Month {monthDelta !== 0 && (
                  <span style={{ color: monthDelta > 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                    ({monthDelta > 0 ? '+' : ''}{monthDelta}%)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Suspicious IP Alert */}
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
            </div>
          )}

          {/* 14-Day Trend Chart */}
          <div style={{ ...cardStyle, marginBottom: '1rem' }}>
            <h4 style={{ color: '#fff', fontSize: '0.85rem', margin: '0 0 0.75rem', fontWeight: '600' }}>
              14-Day Referral Trend
            </h4>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '80px' }}>
              {metrics.dailyTrend.map(({ date, count }) => (
                <div
                  key={date}
                  style={{
                    flex: 1,
                    height: `${Math.max((count / maxDailyCount) * 100, count > 0 ? 8 : 2)}%`,
                    backgroundColor: count > 0 ? '#22d3ee' : '#1a1a1a',
                    borderRadius: '2px 2px 0 0',
                    minHeight: '2px',
                    position: 'relative',
                  }}
                  title={`${date}: ${count} referral${count !== 1 ? 's' : ''}`}
                />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.35rem' }}>
              <span style={{ fontSize: '0.6rem', color: '#4b5563' }}>{metrics.dailyTrend[0]?.date.split('-').slice(1).join('/')}</span>
              <span style={{ fontSize: '0.6rem', color: '#4b5563' }}>{t('referralIntelligence.today')}</span>
            </div>
          </div>

          {/* Tier Distribution + Avg Verify Time */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <div style={{ ...cardStyle }}>
              <h4 style={{ color: '#fff', fontSize: '0.85rem', margin: '0 0 0.75rem', fontWeight: '600' }}>{t('referralIntelligence.tierDistribution')}</h4>
              {metrics.tierBreakdown.length === 0 ? (
                <div style={{ color: '#4b5563', fontSize: '0.8rem' }}>{t('referralIntelligence.noTiersYet')}</div>
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
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ ...cardStyle }}>
              <h4 style={{ color: '#fff', fontSize: '0.85rem', margin: '0 0 0.75rem', fontWeight: '600' }}>{t('referralIntelligence.healthMetrics')}</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <div style={{ color: '#6b7280', fontSize: '0.7rem', marginBottom: '0.2rem' }}>Avg. Time to Verify</div>
                  <div style={{ color: '#fff', fontSize: '1.1rem', fontWeight: '700' }}>
                    {metrics.avgTimeToVerify !== null ? (
                      metrics.avgTimeToVerify < 1 ? '<1 hour' :
                      metrics.avgTimeToVerify < 24 ? `${Math.round(metrics.avgTimeToVerify)}h` :
                      `${Math.round(metrics.avgTimeToVerify / 24)}d`
                    ) : '—'}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#6b7280', fontSize: '0.7rem', marginBottom: '0.2rem' }}>{t('referralIntelligence.invalidRate')}</div>
                  <div style={{ color: metrics.invalid > 0 ? '#ef4444' : '#22c55e', fontSize: '1.1rem', fontWeight: '700' }}>
                    {metrics.total > 0 ? `${Math.round((metrics.invalid / metrics.total) * 100)}%` : '0%'}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#6b7280', fontSize: '0.7rem', marginBottom: '0.2rem' }}>{t('referralIntelligence.attributionSources')}</div>
                  <div style={{ color: '#fff', fontSize: '1.1rem', fontWeight: '700' }}>
                    {metrics.sourceBreakdown.length}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================= */}
      {/* HOW PEOPLE FOUND ATLAS */}
      {/* ============================================= */}
      {activeSection === 'sources' && (
        <div>
          <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: '700', margin: '0 0 1rem' }}>
            🧭 How People Found Atlas
          </h3>

          {/* Source cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {metrics.sourceBreakdown.map(({ source, count, verified }) => {
              const cfg = SOURCE_CONFIG[source] || { label: source, icon: '📊', color: '#6b7280' };
              const pct = metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0;
              const verifyRate = count > 0 ? Math.round((verified / count) * 100) : 0;
              return (
                <div key={source} style={{
                  ...cardStyle,
                  border: `1px solid ${cfg.color}30`,
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  {/* Background percentage fill */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: `${pct}%`,
                    backgroundColor: `${cfg.color}08`,
                    transition: 'width 0.5s',
                  }} />
                  <div style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '1.25rem' }}>{cfg.icon}</span>
                      <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: '600' }}>{cfg.label}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.35rem' }}>
                      <span style={{ fontSize: '1.75rem', fontWeight: '800', color: cfg.color }}>{count}</span>
                      <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>({pct}% of total)</span>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.7rem' }}>
                      <span style={{ color: '#22c55e' }}>✓ {verified} verified</span>
                      <span style={{ color: '#6b7280' }}>{verifyRate}% conversion</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Source comparison table */}
          {metrics.sourceBreakdown.length > 0 && (
            <div style={cardStyle}>
              <h4 style={{ color: '#fff', fontSize: '0.85rem', margin: '0 0 0.75rem', fontWeight: '600' }}>{t('referralIntelligence.sourceComparison')}</h4>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                      <th style={{ textAlign: 'left', padding: '0.5rem', color: '#6b7280', fontWeight: '600' }}>{t('referralIntelligence.source')}</th>
                      <th style={{ textAlign: 'right', padding: '0.5rem', color: '#6b7280', fontWeight: '600' }}>{t('referralIntelligence.total')}</th>
                      <th style={{ textAlign: 'right', padding: '0.5rem', color: '#6b7280', fontWeight: '600' }}>{t('referralIntelligence.verified')}</th>
                      <th style={{ textAlign: 'right', padding: '0.5rem', color: '#6b7280', fontWeight: '600' }}>{t('referralIntelligence.pending')}</th>
                      <th style={{ textAlign: 'right', padding: '0.5rem', color: '#6b7280', fontWeight: '600' }}>Conv. Rate</th>
                      <th style={{ textAlign: 'right', padding: '0.5rem', color: '#6b7280', fontWeight: '600' }}>% of Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.sourceBreakdown.map(({ source, count, verified }) => {
                      const cfg = SOURCE_CONFIG[source] || { label: source, icon: '📊', color: '#6b7280' };
                      const pendingForSource = metrics.recentReferrals.filter(r => (r.source || 'referral_link') === source && r.status === 'pending').length;
                      return (
                        <tr key={source} style={{ borderBottom: '1px solid #1a1a1a' }}>
                          <td style={{ padding: '0.5rem', color: cfg.color, fontWeight: '600' }}>
                            {cfg.icon} {cfg.label}
                          </td>
                          <td style={{ padding: '0.5rem', color: '#fff', textAlign: 'right' }}>{count}</td>
                          <td style={{ padding: '0.5rem', color: '#22c55e', textAlign: 'right' }}>{verified}</td>
                          <td style={{ padding: '0.5rem', color: '#fbbf24', textAlign: 'right' }}>{pendingForSource}</td>
                          <td style={{ padding: '0.5rem', color: '#9ca3af', textAlign: 'right' }}>
                            {count > 0 ? `${Math.round((verified / count) * 100)}%` : '—'}
                          </td>
                          <td style={{ padding: '0.5rem', color: '#9ca3af', textAlign: 'right' }}>
                            {metrics.total > 0 ? `${Math.round((count / metrics.total) * 100)}%` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================= */}
      {/* TOP REFERRERS */}
      {/* ============================================= */}
      {activeSection === 'referrers' && (
        <div>
          <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: '700', margin: '0 0 1rem' }}>
            👥 Top Referrers
          </h3>

          {metrics.topReferrers.length === 0 ? (
            <div style={{ ...cardStyle, color: '#4b5563', fontSize: '0.85rem', textAlign: 'center' }}>{t('referralIntelligence.noReferrersYet')}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {metrics.topReferrers.map((ref, i) => {
                const tierColor = ref.referral_tier
                  ? REFERRAL_TIER_COLORS[ref.referral_tier as ReferralTier] || '#fff'
                  : '#fff';
                return (
                  <div key={ref.id} style={{
                    ...cardStyle,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    border: i < 3 ? `1px solid ${tierColor}30` : '1px solid #2a2a2a',
                  }}>
                    <span style={{
                      color: i < 3 ? tierColor : '#4b5563',
                      fontSize: '0.8rem',
                      fontWeight: '700',
                      width: '2rem',
                      textAlign: 'center',
                    }}>
                      #{i + 1}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ color: tierColor, fontWeight: '600', fontSize: '0.85rem' }}>
                          {ref.linked_username || ref.username || 'Anonymous'}
                        </span>
                        {ref.referral_tier && (
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
                            {ref.referral_tier}
                          </span>
                        )}
                        {ref.linked_kingdom && (
                          <span style={{ fontSize: '0.65rem', color: '#6b7280' }}>K{ref.linked_kingdom}</span>
                        )}
                      </div>
                    </div>
                    <span style={{
                      color: tierColor,
                      fontSize: '1.1rem',
                      fontWeight: '800',
                    }}>
                      {ref.referral_count}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================= */}
      {/* RECENT ACTIVITY */}
      {/* ============================================= */}
      {activeSection === 'recent' && (
        <div>
          <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: '700', margin: '0 0 1rem' }}>
            📋 Recent Referral Activity
          </h3>

          {metrics.recentReferrals.length === 0 ? (
            <div style={{ ...cardStyle, color: '#4b5563', fontSize: '0.85rem', textAlign: 'center' }}>{t('referralIntelligence.noReferralsYet')}</div>
          ) : (
            <div style={{ ...cardStyle, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                    <th style={{ textAlign: 'left', padding: '0.5rem', color: '#6b7280', fontWeight: '600' }}>{t('referralIntelligence.referrer')}</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem', color: '#6b7280', fontWeight: '600' }}>{t('referralIntelligence.referred')}</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem', color: '#6b7280', fontWeight: '600' }}>{t('referralIntelligence.source')}</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem', color: '#6b7280', fontWeight: '600' }}>{t('referralIntelligence.status')}</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem', color: '#6b7280', fontWeight: '600' }}>{t('referralIntelligence.date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.recentReferrals.map(ref => {
                    const srcCfg = SOURCE_CONFIG[ref.source || 'referral_link'] || { label: ref.source, icon: '📊', color: '#6b7280' };
                    return (
                      <tr key={ref.id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                        <td style={{ padding: '0.5rem', color: '#fff' }}>{ref.referral_code || 'unknown'}</td>
                        <td style={{ padding: '0.5rem', color: '#9ca3af' }}>{ref.referred_user_id?.substring(0, 8)}...</td>
                        <td style={{ padding: '0.5rem' }}>
                          <span style={{
                            fontSize: '0.65rem',
                            padding: '0.15rem 0.4rem',
                            borderRadius: '4px',
                            backgroundColor: `${srcCfg.color}10`,
                            border: `1px solid ${srcCfg.color}30`,
                            color: srcCfg.color,
                            fontWeight: '600',
                            whiteSpace: 'nowrap',
                          }}>
                            {srcCfg.icon} {srcCfg.label}
                          </span>
                        </td>
                        <td style={{ padding: '0.5rem' }}>
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
                        <td style={{ padding: '0.5rem', color: '#6b7280' }}>
                          {new Date(ref.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {/* ============================================= */}
      {/* MANUAL ASSIGN SECTION */}
      {/* ============================================= */}
      {activeSection === 'manual' && (
        <div>
          <div style={{ ...cardStyle, marginBottom: '1rem' }}>
            <h4 style={{ color: '#fff', fontSize: '0.85rem', margin: '0 0 0.75rem', fontWeight: '600' }}>✏️ Manually Assign Referral</h4>
            <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: '0 0 1rem', lineHeight: 1.5 }}>
              Add a verified referral for a user who wasn't automatically tracked. Enter the referrer's and referred user's linked username or player ID.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ color: '#9ca3af', fontSize: '0.7rem', display: 'block', marginBottom: '0.25rem' }}>Referrer (who brought them)</label>
                <input
                  type="text"
                  value={manualReferrer}
                  onChange={(e) => setManualReferrer(e.target.value)}
                  placeholder="Username or Player ID..."
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #2a2a2a', backgroundColor: '#0a0a0a', color: '#fff', fontSize: '0.8rem', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ color: '#9ca3af', fontSize: '0.7rem', display: 'block', marginBottom: '0.25rem' }}>Referred User (who was brought)</label>
                <input
                  type="text"
                  value={manualReferred}
                  onChange={(e) => setManualReferred(e.target.value)}
                  placeholder="Username or Player ID..."
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #2a2a2a', backgroundColor: '#0a0a0a', color: '#fff', fontSize: '0.8rem', boxSizing: 'border-box' }}
                />
              </div>
              <button
                onClick={handleManualReferral}
                disabled={manualSaving || !manualReferrer.trim() || !manualReferred.trim()}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  border: '1px solid #22c55e40',
                  backgroundColor: '#22c55e15',
                  color: '#22c55e',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  cursor: manualSaving ? 'not-allowed' : 'pointer',
                  opacity: manualSaving || !manualReferrer.trim() || !manualReferred.trim() ? 0.5 : 1,
                  alignSelf: 'flex-start',
                }}
              >
                {manualSaving ? 'Adding...' : '+ Add Verified Referral'}
              </button>
              {manualResult && (
                <div style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: '500',
                  backgroundColor: manualResult.type === 'success' ? '#22c55e15' : '#ef444415',
                  border: `1px solid ${manualResult.type === 'success' ? '#22c55e40' : '#ef444440'}`,
                  color: manualResult.type === 'success' ? '#22c55e' : '#ef4444',
                }}>
                  {manualResult.message}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReferralIntelligence;
