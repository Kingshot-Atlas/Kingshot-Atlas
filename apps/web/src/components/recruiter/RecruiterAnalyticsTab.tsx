import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { colors } from '../../utils/styles';
import { logger } from '../../utils/logger';
import type { EditorInfo, IncomingApplication } from './types';

interface AnalyticsData {
  avgResponseHours: number | null;
  conversionRate: number;
  inviteSuccessRate: number;
  totalApplications: number;
  acceptedApplications: number;
  declinedApplications: number;
  expiredApplications: number;
  totalInvitesSent: number;
  invitesAccepted: number;
  invitesDeclined: number;
  invitesExpired: number;
  invitesPending: number;
  listingViews30d: number;
  profileViews30d: number;
  applicationsByWeek: { week: string; count: number }[];
}

// ─── Query Keys ─────────────────────────────────────────────
const analyticsKeys = {
  all: ['recruiterAnalytics'] as const,
  data: (kingdomNumber: number) => [...analyticsKeys.all, kingdomNumber] as const,
};

async function fetchAnalytics(kingdomNumber: number): Promise<AnalyticsData> {
  if (!supabase) {
    return {
      avgResponseHours: null, conversionRate: 0, inviteSuccessRate: 0,
      totalApplications: 0, acceptedApplications: 0, declinedApplications: 0, expiredApplications: 0,
      totalInvitesSent: 0, invitesAccepted: 0, invitesDeclined: 0, invitesExpired: 0, invitesPending: 0,
      listingViews30d: 0, profileViews30d: 0, applicationsByWeek: [],
    };
  }

  // Fetch applications
  const { data: apps } = await supabase
    .from('transfer_applications')
    .select('id, status, applied_at, responded_at, viewed_at')
    .eq('kingdom_number', kingdomNumber);

  const allApps = (apps || []) as Array<{ id: string; status: string; applied_at: string; responded_at: string | null; viewed_at: string | null }>;

  // Compute response times (time from applied_at to first responded_at or viewed_at)
  const responseTimes: number[] = [];
  for (const app of allApps) {
    const responseDate = app.viewed_at || app.responded_at;
    if (responseDate) {
      const diff = new Date(responseDate).getTime() - new Date(app.applied_at).getTime();
      if (diff > 0) responseTimes.push(diff / (1000 * 60 * 60)); // hours
    }
  }
  const avgResponseHours = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length * 10) / 10
    : null;

  const accepted = allApps.filter(a => a.status === 'accepted').length;
  const declined = allApps.filter(a => a.status === 'declined').length;
  const expired = allApps.filter(a => a.status === 'expired').length;
  const decided = accepted + declined;
  const conversionRate = decided > 0 ? Math.round((accepted / decided) * 100) : 0;

  // Fetch invites
  const { data: invites } = await supabase
    .from('transfer_invites')
    .select('id, status')
    .eq('kingdom_number', kingdomNumber);

  const allInvites = (invites || []) as Array<{ id: string; status: string }>;
  const invAccepted = allInvites.filter(i => i.status === 'accepted').length;
  const invDeclined = allInvites.filter(i => i.status === 'declined').length;
  const invExpired = allInvites.filter(i => i.status === 'expired').length;
  const invPending = allInvites.filter(i => i.status === 'pending').length;
  const invResponded = invAccepted + invDeclined;
  const inviteSuccessRate = invResponded > 0 ? Math.round((invAccepted / invResponded) * 100) : 0;

  // Listing views (30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { count: listingViews } = await supabase
    .from('kingdom_listing_views')
    .select('id', { count: 'exact', head: true })
    .eq('kingdom_number', kingdomNumber)
    .gte('viewed_at', thirtyDaysAgo);

  // Profile views (30 days) — how many times recruiters viewed transferee profiles from this kingdom
  const { count: profileViews } = await supabase
    .from('transfer_profile_views')
    .select('id', { count: 'exact', head: true })
    .eq('viewer_kingdom_number', kingdomNumber)
    .gte('view_date', thirtyDaysAgo.slice(0, 10));

  // Applications by week (last 8 weeks)
  const eightWeeksAgo = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000);
  const weekBuckets: Record<string, number> = {};
  for (const app of allApps) {
    const appDate = new Date(app.applied_at);
    if (appDate >= eightWeeksAgo) {
      const weekStart = new Date(appDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const key = weekStart.toISOString().slice(0, 10);
      weekBuckets[key] = (weekBuckets[key] || 0) + 1;
    }
  }
  const applicationsByWeek = Object.entries(weekBuckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, count]) => ({ week, count }));

  return {
    avgResponseHours,
    conversionRate,
    inviteSuccessRate,
    totalApplications: allApps.length,
    acceptedApplications: accepted,
    declinedApplications: declined,
    expiredApplications: expired,
    totalInvitesSent: allInvites.length,
    invitesAccepted: invAccepted,
    invitesDeclined: invDeclined,
    invitesExpired: invExpired,
    invitesPending: invPending,
    listingViews30d: listingViews || 0,
    profileViews30d: profileViews || 0,
    applicationsByWeek,
  };
}

interface RecruiterAnalyticsTabProps {
  editorInfo: EditorInfo;
  applications: IncomingApplication[];
}

const RecruiterAnalyticsTab: React.FC<RecruiterAnalyticsTabProps> = ({ editorInfo }) => {
  const { data: analytics, isLoading } = useQuery({
    queryKey: analyticsKeys.data(editorInfo.kingdom_number),
    queryFn: () => fetchAnalytics(editorInfo.kingdom_number),
    staleTime: 5 * 60 * 1000, // 5 min
    retry: 1,
  });

  if (isLoading || !analytics) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: colors.textMuted }}>
        Loading analytics...
      </div>
    );
  }

  const statCard = (label: string, value: string | number, color: string, sub?: string) => (
    <div style={{
      backgroundColor: colors.surface,
      border: `1px solid ${colors.border}`,
      borderRadius: '8px',
      padding: '0.6rem',
      textAlign: 'center',
    }}>
      <div style={{ color, fontWeight: 'bold', fontSize: '1.1rem' }}>{value}</div>
      <div style={{ color: colors.textMuted, fontSize: '0.6rem', marginTop: '0.1rem' }}>{label}</div>
      {sub && <div style={{ color: colors.textMuted, fontSize: '0.5rem', marginTop: '0.05rem' }}>{sub}</div>}
    </div>
  );

  const maxWeekCount = Math.max(...analytics.applicationsByWeek.map(w => w.count), 1);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '0.75rem' }}>
        <span style={{ color: colors.textSecondary, fontSize: '0.7rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Recruiter Analytics
        </span>
        <p style={{ color: colors.textMuted, fontSize: '0.65rem', margin: '0.15rem 0 0' }}>
          Performance metrics for Kingdom {editorInfo.kingdom_number}
        </p>
      </div>

      {/* Key Metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '0.4rem',
        marginBottom: '0.75rem',
      }}>
        {statCard(
          'Avg Response Time',
          analytics.avgResponseHours !== null ? `${analytics.avgResponseHours}h` : '—',
          analytics.avgResponseHours !== null && analytics.avgResponseHours <= 24 ? '#22c55e' : analytics.avgResponseHours !== null && analytics.avgResponseHours <= 72 ? '#f59e0b' : '#ef4444',
        )}
        {statCard(
          'Accept Rate',
          `${analytics.conversionRate}%`,
          analytics.conversionRate >= 50 ? '#22c55e' : analytics.conversionRate >= 25 ? '#f59e0b' : '#ef4444',
          `${analytics.acceptedApplications}/${analytics.acceptedApplications + analytics.declinedApplications} decided`,
        )}
        {statCard(
          'Invite Success',
          `${analytics.inviteSuccessRate}%`,
          analytics.inviteSuccessRate >= 30 ? '#22c55e' : analytics.inviteSuccessRate >= 15 ? '#f59e0b' : '#6b7280',
          `${analytics.invitesAccepted}/${analytics.invitesAccepted + analytics.invitesDeclined} responded`,
        )}
      </div>

      {/* Activity Summary */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '0.4rem',
        marginBottom: '0.75rem',
      }}>
        {statCard('Listing Views', analytics.listingViews30d, '#22d3ee', 'last 30 days')}
        {statCard('Profiles Browsed', analytics.profileViews30d, '#a855f7', 'last 30 days')}
        {statCard('Total Applications', analytics.totalApplications, colors.textSecondary)}
        {statCard('Total Invites Sent', analytics.totalInvitesSent, colors.textSecondary)}
      </div>

      {/* Application Breakdown */}
      <div style={{
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: '10px',
        padding: '0.75rem',
        marginBottom: '0.75rem',
      }}>
        <span style={{ color: colors.textSecondary, fontSize: '0.65rem', fontWeight: '600' }}>Application Breakdown</span>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Accepted', value: analytics.acceptedApplications, color: '#22c55e' },
            { label: 'Declined', value: analytics.declinedApplications, color: '#ef4444' },
            { label: 'Expired', value: analytics.expiredApplications, color: '#6b7280' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: s.color }} />
              <span style={{ color: colors.textSecondary, fontSize: '0.7rem' }}>{s.value} {s.label}</span>
            </div>
          ))}
        </div>
        {analytics.totalApplications > 0 && (
          <div style={{ display: 'flex', height: '6px', borderRadius: '3px', overflow: 'hidden', marginTop: '0.5rem', backgroundColor: '#1a1a1a' }}>
            {analytics.acceptedApplications > 0 && (
              <div style={{ width: `${(analytics.acceptedApplications / analytics.totalApplications) * 100}%`, backgroundColor: '#22c55e' }} />
            )}
            {analytics.declinedApplications > 0 && (
              <div style={{ width: `${(analytics.declinedApplications / analytics.totalApplications) * 100}%`, backgroundColor: '#ef4444' }} />
            )}
            {analytics.expiredApplications > 0 && (
              <div style={{ width: `${(analytics.expiredApplications / analytics.totalApplications) * 100}%`, backgroundColor: '#6b7280' }} />
            )}
          </div>
        )}
      </div>

      {/* Invite Breakdown */}
      <div style={{
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: '10px',
        padding: '0.75rem',
        marginBottom: '0.75rem',
      }}>
        <span style={{ color: colors.textSecondary, fontSize: '0.65rem', fontWeight: '600' }}>Invite Breakdown</span>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Pending', value: analytics.invitesPending, color: '#f59e0b' },
            { label: 'Accepted', value: analytics.invitesAccepted, color: '#22c55e' },
            { label: 'Declined', value: analytics.invitesDeclined, color: '#ef4444' },
            { label: 'Expired', value: analytics.invitesExpired, color: '#6b7280' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: s.color }} />
              <span style={{ color: colors.textSecondary, fontSize: '0.7rem' }}>{s.value} {s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Applications by Week Chart */}
      {analytics.applicationsByWeek.length > 0 && (
        <div style={{
          backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: '10px',
          padding: '0.75rem',
        }}>
          <span style={{ color: colors.textSecondary, fontSize: '0.65rem', fontWeight: '600' }}>Applications per Week</span>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.25rem', marginTop: '0.5rem', height: '60px' }}>
            {analytics.applicationsByWeek.map(w => (
              <div
                key={w.week}
                title={`Week of ${w.week}: ${w.count} application${w.count !== 1 ? 's' : ''}`}
                style={{
                  flex: 1,
                  height: `${Math.max((w.count / maxWeekCount) * 100, 4)}%`,
                  backgroundColor: '#22d3ee',
                  borderRadius: '3px 3px 0 0',
                  opacity: 0.7,
                  minHeight: '3px',
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem' }}>
            <span style={{ color: colors.textMuted, fontSize: '0.5rem' }}>
              {analytics.applicationsByWeek[0]?.week}
            </span>
            <span style={{ color: colors.textMuted, fontSize: '0.5rem' }}>
              {analytics.applicationsByWeek[analytics.applicationsByWeek.length - 1]?.week}
            </span>
          </div>
        </div>
      )}

      {/* Tips */}
      <div style={{
        marginTop: '0.75rem',
        padding: '0.6rem 0.75rem',
        backgroundColor: '#22d3ee08',
        border: '1px solid #22d3ee15',
        borderRadius: '8px',
      }}>
        <span style={{ color: '#22d3ee', fontSize: '0.65rem', fontWeight: '600' }}>💡 Tips to Improve</span>
        <ul style={{ color: colors.textSecondary, fontSize: '0.65rem', margin: '0.3rem 0 0', paddingLeft: '1.2rem', lineHeight: 1.6 }}>
          {analytics.avgResponseHours !== null && analytics.avgResponseHours > 48 && (
            <li>Your average response time is {analytics.avgResponseHours}h — try to respond within 24h to keep applicants engaged.</li>
          )}
          {analytics.conversionRate < 30 && analytics.totalApplications >= 5 && (
            <li>Your accept rate is low. Consider updating your listing requirements to better match who applies.</li>
          )}
          {analytics.inviteSuccessRate < 20 && analytics.totalInvitesSent >= 5 && (
            <li>Invite success rate is low. Try personalizing your listing pitch and targeting players who match your requirements.</li>
          )}
          {analytics.listingViews30d < 10 && (
            <li>Low listing views — make sure recruiting is toggled on and your profile is complete.</li>
          )}
          {analytics.avgResponseHours !== null && analytics.avgResponseHours <= 24 && analytics.conversionRate >= 40 && (
            <li>Great job! Your response time and accept rate are strong. Keep it up!</li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default RecruiterAnalyticsTab;
