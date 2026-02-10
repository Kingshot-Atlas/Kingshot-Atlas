import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

// =============================================
// TYPES
// =============================================

interface EditorClaim {
  id: string;
  kingdom_number: number;
  user_id: string;
  role: string;
  status: string;
  endorsement_count: number;
  required_endorsements: number;
  nominated_at: string;
  activated_at: string | null;
  last_active_at: string | null;
  created_at: string;
  // Joined
  username?: string;
  linked_username?: string | null;
  linked_kingdom?: number | null;
  linked_tc_level?: number | null;
}

interface KingdomFund {
  id: string;
  kingdom_number: number;
  balance: string;
  tier: string;
  total_contributed: string;
  contributor_count: number;
  is_recruiting: boolean;
  recruitment_pitch: string | null;
  main_language: string | null;
  min_tc_level: number | null;
  min_power_million: number | null;
  created_at: string;
  updated_at: string;
  last_depletion_at: string | null;
  // Joined
  atlas_score?: string | null;
}

interface TransferProfile {
  id: string;
  user_id: string;
  username: string;
  current_kingdom: number;
  tc_level: number;
  power_million: number | null;
  power_range: string;
  main_language: string;
  group_size: string;
  player_bio: string;
  is_active: boolean;
  is_anonymous: boolean;
  looking_for: string[];
  created_at: string;
  updated_at: string;
  last_active_at: string | null;
  // Joined
  profile_username?: string;
}

interface TransferHubStats {
  totalEditors: number;
  pendingEditors: number;
  activeEditors: number;
  totalFunds: number;
  totalFundBalance: number;
  totalContributed: number;
  recruitingKingdoms: number;
  totalProfiles: number;
  activeProfiles: number;
  totalApplications: number;
  pendingApplications: number;
  acceptedApplications: number;
  totalInvites: number;
  totalProfileViews: number;
}

type SubTab = 'overview' | 'editors' | 'funds' | 'profiles';

// =============================================
// CONSTANTS
// =============================================

const TIER_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  gold: { bg: '#fbbf2415', border: '#fbbf2440', text: '#fbbf24' },
  silver: { bg: '#9ca3af15', border: '#9ca3af40', text: '#9ca3af' },
  bronze: { bg: '#cd7f3215', border: '#cd7f3240', text: '#cd7f32' },
  standard: { bg: '#6b728015', border: '#6b728040', text: '#6b7280' },
};

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  active: { bg: '#22c55e15', border: '#22c55e40', text: '#22c55e' },
  pending: { bg: '#eab30815', border: '#eab30840', text: '#eab308' },
  inactive: { bg: '#6b728015', border: '#6b728040', text: '#6b7280' },
  suspended: { bg: '#ef444415', border: '#ef444440', text: '#ef4444' },
};

// =============================================
// COMPONENT
// =============================================

export const TransferHubAdminTab: React.FC = () => {
  const [subTab, setSubTab] = useState<SubTab>('overview');
  const [editors, setEditors] = useState<EditorClaim[]>([]);
  const [funds, setFunds] = useState<KingdomFund[]>([]);
  const [profiles, setProfiles] = useState<TransferProfile[]>([]);
  const [stats, setStats] = useState<TransferHubStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      await Promise.all([
        fetchEditors(),
        fetchFunds(),
        fetchProfiles(),
        fetchStats(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchEditors = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('kingdom_editors')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { console.error('Error fetching editors:', error); return; }
    if (!data || data.length === 0) { setEditors([]); return; }

    // Enrich with profile data
    const userIds = [...new Set(data.map(e => e.user_id))];
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, username, linked_username, linked_kingdom, linked_tc_level')
      .in('id', userIds);
    const profileMap = new Map(profileData?.map(p => [p.id, p]) || []);

    setEditors(data.map(e => ({
      ...e,
      username: profileMap.get(e.user_id)?.username || 'Unknown',
      linked_username: profileMap.get(e.user_id)?.linked_username || null,
      linked_kingdom: profileMap.get(e.user_id)?.linked_kingdom,
      linked_tc_level: profileMap.get(e.user_id)?.linked_tc_level,
    })));
  };

  const fetchFunds = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('kingdom_funds')
      .select('*')
      .order('balance', { ascending: false });
    if (error) { console.error('Error fetching funds:', error); return; }
    if (!data || data.length === 0) { setFunds([]); return; }

    // Enrich with kingdom atlas score
    const kns = data.map(f => f.kingdom_number);
    const { data: kingdomData } = await supabase
      .from('kingdoms')
      .select('kingdom_number, atlas_score')
      .in('kingdom_number', kns);
    const kingdomMap = new Map(kingdomData?.map(k => [k.kingdom_number, k]) || []);

    setFunds(data.map(f => ({
      ...f,
      atlas_score: kingdomMap.get(f.kingdom_number)?.atlas_score ?? null,
    })));
  };

  const fetchProfiles = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('transfer_profiles')
      .select('*')
      .order('last_active_at', { ascending: false });
    if (error) { console.error('Error fetching profiles:', error); return; }
    if (!data || data.length === 0) { setProfiles([]); return; }

    // Enrich with auth profile username
    const userIds = [...new Set(data.map(p => p.user_id))];
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', userIds);
    const profileMap = new Map(profileData?.map(p => [p.id, p]) || []);

    setProfiles(data.map(p => ({
      ...p,
      profile_username: profileMap.get(p.user_id)?.username || p.username,
    })));
  };

  const fetchStats = async () => {
    if (!supabase) return;
    try {
      const [editorsRes, fundsRes, profilesRes, appsRes, invitesRes, viewsRes] = await Promise.all([
        supabase.from('kingdom_editors').select('status', { count: 'exact' }),
        supabase.from('kingdom_funds').select('balance, total_contributed, is_recruiting'),
        supabase.from('transfer_profiles').select('is_active', { count: 'exact' }),
        supabase.from('transfer_applications').select('status', { count: 'exact' }),
        supabase.from('transfer_invites').select('id', { count: 'exact', head: true }),
        supabase.from('transfer_profile_views').select('id', { count: 'exact', head: true }),
      ]);

      const editorData = editorsRes.data || [];
      const fundData = fundsRes.data || [];
      const profileData = profilesRes.data || [];
      const appData = appsRes.data || [];

      setStats({
        totalEditors: editorData.length,
        pendingEditors: editorData.filter(e => e.status === 'pending').length,
        activeEditors: editorData.filter(e => e.status === 'active').length,
        totalFunds: fundData.length,
        totalFundBalance: fundData.reduce((sum, f) => sum + parseFloat(f.balance || '0'), 0),
        totalContributed: fundData.reduce((sum, f) => sum + parseFloat(f.total_contributed || '0'), 0),
        recruitingKingdoms: fundData.filter(f => f.is_recruiting).length,
        totalProfiles: profileData.length,
        activeProfiles: profileData.filter(p => p.is_active).length,
        totalApplications: appData.length,
        pendingApplications: appData.filter(a => a.status === 'pending').length,
        acceptedApplications: appData.filter(a => a.status === 'accepted').length,
        totalInvites: invitesRes.count || 0,
        totalProfileViews: viewsRes.count || 0,
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const timeAgo = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const subTabs: { id: SubTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'editors', label: 'Editor Claims', icon: '👑' },
    { id: 'funds', label: 'Kingdom Funds', icon: '💰' },
    { id: 'profiles', label: 'Transfer Profiles', icon: '🔄' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Sub-tab Navigation */}
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
        {subTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            style={{
              padding: '0.4rem 0.75rem',
              backgroundColor: subTab === tab.id ? '#a855f720' : 'transparent',
              color: subTab === tab.id ? '#a855f7' : '#6b7280',
              border: subTab === tab.id ? '1px solid #a855f740' : '1px solid transparent',
              borderRadius: '6px',
              fontWeight: 500,
              cursor: 'pointer',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
        <button
          onClick={fetchAll}
          style={{
            marginLeft: 'auto',
            padding: '0.3rem 0.6rem',
            background: 'none',
            border: '1px solid #2a2a2a',
            borderRadius: '4px',
            color: '#6b7280',
            cursor: 'pointer',
            fontSize: '0.7rem',
          }}
        >
          {loading ? '...' : '↻ Refresh'}
        </button>
      </div>

      {loading && !stats ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>Loading Transfer Hub data...</div>
      ) : subTab === 'overview' ? (
        <OverviewTab stats={stats} />
      ) : subTab === 'editors' ? (
        <EditorsTab editors={editors} timeAgo={timeAgo} />
      ) : subTab === 'funds' ? (
        <FundsTab funds={funds} timeAgo={timeAgo} />
      ) : subTab === 'profiles' ? (
        <ProfilesTab profiles={profiles} timeAgo={timeAgo} />
      ) : null}
    </div>
  );
};

// =============================================
// SUB-COMPONENTS
// =============================================

const OverviewTab: React.FC<{ stats: TransferHubStats | null }> = ({ stats }) => {
  if (!stats) return <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>No data</div>;

  const cards = [
    { label: 'Editor Claims', value: stats.totalEditors, sub: `${stats.pendingEditors} pending · ${stats.activeEditors} active`, color: '#a855f7', icon: '👑' },
    { label: 'Kingdom Funds', value: stats.totalFunds, sub: `$${stats.totalFundBalance.toFixed(2)} balance · $${stats.totalContributed.toFixed(2)} contributed`, color: '#fbbf24', icon: '💰' },
    { label: 'Recruiting', value: stats.recruitingKingdoms, sub: 'kingdoms actively recruiting', color: '#22c55e', icon: '📢' },
    { label: 'Transfer Profiles', value: stats.totalProfiles, sub: `${stats.activeProfiles} active`, color: '#3b82f6', icon: '🔄' },
    { label: 'Applications', value: stats.totalApplications, sub: `${stats.pendingApplications} pending · ${stats.acceptedApplications} accepted`, color: '#22d3ee', icon: '📨' },
    { label: 'Invites Sent', value: stats.totalInvites, sub: 'recruiter-initiated', color: '#f97316', icon: '✉️' },
    { label: 'Profile Views', value: stats.totalProfileViews, sub: 'transfer profile impressions', color: '#ec4899', icon: '👁️' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
        {cards.map((card, i) => (
          <div key={i} style={{
            backgroundColor: '#111116',
            borderRadius: '10px',
            padding: '1rem',
            border: '1px solid #2a2a2a',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
              <span>{card.icon}</span>
              <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>{card.label}</span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: card.color }}>{card.value}</div>
            <div style={{ color: '#4b5563', fontSize: '0.7rem', marginTop: '0.25rem' }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Health Indicators */}
      <div style={{
        backgroundColor: '#111116',
        borderRadius: '10px',
        padding: '1rem',
        border: '1px solid #2a2a2a',
      }}>
        <h4 style={{ color: '#fff', margin: '0 0 0.75rem', fontSize: '0.85rem' }}>Transfer Hub Health</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[
            { label: 'Pending editor claims need attention', count: stats.pendingEditors, severity: stats.pendingEditors > 5 ? 'warning' : stats.pendingEditors > 0 ? 'info' : 'ok' },
            { label: 'Applications awaiting response', count: stats.pendingApplications, severity: stats.pendingApplications > 10 ? 'warning' : stats.pendingApplications > 0 ? 'info' : 'ok' },
            { label: 'Inactive transfer profiles', count: stats.totalProfiles - stats.activeProfiles, severity: (stats.totalProfiles - stats.activeProfiles) > 5 ? 'warning' : 'ok' },
          ].map((item, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.8rem',
            }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                backgroundColor: item.severity === 'ok' ? '#22c55e' : item.severity === 'info' ? '#eab308' : '#ef4444',
              }} />
              <span style={{ color: '#9ca3af' }}>{item.label}</span>
              <span style={{
                color: item.severity === 'ok' ? '#22c55e' : item.severity === 'info' ? '#eab308' : '#ef4444',
                fontWeight: 600,
              }}>
                {item.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const EditorsTab: React.FC<{ editors: EditorClaim[]; timeAgo: (d: string | null) => string }> = ({ editors, timeAgo }) => {
  if (editors.length === 0) {
    return <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>No editor claims yet</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>
        {editors.length} total claim{editors.length !== 1 ? 's' : ''} · {editors.filter(e => e.status === 'pending').length} pending · {editors.filter(e => e.status === 'active').length} active
      </div>
      {editors.map(editor => {
        const sc = STATUS_COLORS[editor.status] ?? { bg: '#eab30815', border: '#eab30840', text: '#eab308' };
        const endorsementPct = editor.required_endorsements > 0
          ? Math.min(100, (editor.endorsement_count / editor.required_endorsements) * 100)
          : 0;
        return (
          <div key={editor.id} style={{
            backgroundColor: '#111116',
            borderRadius: '10px',
            border: '1px solid #2a2a2a',
            padding: '1rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem' }}>{editor.username}</span>
                  {editor.linked_username && (
                    <span style={{ color: '#a855f7', fontSize: '0.7rem', fontWeight: 500 }}
                      title="Linked Kingshot Account"
                    >
                      ({editor.linked_username})
                    </span>
                  )}
                  <span style={{
                    padding: '0.1rem 0.4rem',
                    backgroundColor: sc.bg,
                    border: `1px solid ${sc.border}`,
                    borderRadius: '4px',
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    color: sc.text,
                    textTransform: 'capitalize',
                  }}>
                    {editor.status}
                  </span>
                  <span style={{
                    padding: '0.1rem 0.4rem',
                    backgroundColor: '#22d3ee15',
                    border: '1px solid #22d3ee40',
                    borderRadius: '4px',
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    color: '#22d3ee',
                    textTransform: 'capitalize',
                  }}>
                    {editor.role}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.7rem', color: '#6b7280' }}>
                  <span>Claiming <strong style={{ color: '#22d3ee' }}>K{editor.kingdom_number}</strong></span>
                  {editor.linked_kingdom && <span>Home: K{editor.linked_kingdom}</span>}
                  {editor.linked_tc_level && <span>TC{editor.linked_tc_level > 30 ? '30+' : editor.linked_tc_level}</span>}
                  <span>Nominated {timeAgo(editor.nominated_at)}</span>
                </div>
              </div>
            </div>

            {/* Endorsement Progress */}
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Endorsements</span>
                <span style={{
                  color: endorsementPct >= 100 ? '#22c55e' : '#eab308',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}>
                  {editor.endorsement_count}/{editor.required_endorsements}
                </span>
              </div>
              <div style={{
                height: '6px',
                backgroundColor: '#1a1a1f',
                borderRadius: '3px',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${endorsementPct}%`,
                  backgroundColor: endorsementPct >= 100 ? '#22c55e' : endorsementPct >= 50 ? '#eab308' : '#ef4444',
                  borderRadius: '3px',
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>

            {/* Endorsement Test Link (admin tool) */}
            {editor.status === 'pending' && (
              <div style={{
                display: 'flex', gap: '0.5rem', marginTop: '0.5rem', alignItems: 'center',
                padding: '0.4rem 0.6rem',
                backgroundColor: '#a855f708',
                border: '1px solid #a855f720',
                borderRadius: '6px',
              }}>
                <span style={{ color: '#a855f7', fontSize: '0.65rem', fontWeight: 500 }}>Test endorsement flow:</span>
                <button
                  onClick={() => {
                    const link = `${window.location.origin}/transfer-hub?endorse=${editor.id}`;
                    navigator.clipboard.writeText(link);
                    const btn = document.getElementById(`copy-btn-${editor.id}`);
                    if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy Link'; }, 2000); }
                  }}
                  id={`copy-btn-${editor.id}`}
                  style={{
                    padding: '0.15rem 0.5rem',
                    backgroundColor: '#a855f715',
                    border: '1px solid #a855f730',
                    borderRadius: '4px',
                    color: '#a855f7',
                    fontSize: '0.6rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >Copy Link</button>
                <button
                  onClick={() => window.open(`/transfer-hub?endorse=${editor.id}`, '_blank')}
                  style={{
                    padding: '0.15rem 0.5rem',
                    backgroundColor: '#22d3ee15',
                    border: '1px solid #22d3ee30',
                    borderRadius: '4px',
                    color: '#22d3ee',
                    fontSize: '0.6rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >Open in New Tab</button>
              </div>
            )}

            {/* Timeline */}
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.65rem', color: '#4b5563' }}>
              {editor.activated_at && <span>Activated {timeAgo(editor.activated_at)}</span>}
              {editor.last_active_at && <span>Last active {timeAgo(editor.last_active_at)}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const FundsTab: React.FC<{ funds: KingdomFund[]; timeAgo: (d: string | null) => string }> = ({ funds, timeAgo }) => {
  if (funds.length === 0) {
    return <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>No kingdom funds yet</div>;
  }

  const totalBalance = funds.reduce((sum, f) => sum + parseFloat(f.balance || '0'), 0);
  const totalContributed = funds.reduce((sum, f) => sum + parseFloat(f.total_contributed || '0'), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
        <div style={{ backgroundColor: '#111116', padding: '0.75rem', borderRadius: '10px', border: '1px solid #2a2a2a', textAlign: 'center' }}>
          <div style={{ color: '#22c55e', fontWeight: 700, fontSize: '1.25rem' }}>${totalBalance.toFixed(2)}</div>
          <div style={{ color: '#6b7280', fontSize: '0.7rem' }}>Current Balance</div>
        </div>
        <div style={{ backgroundColor: '#111116', padding: '0.75rem', borderRadius: '10px', border: '1px solid #2a2a2a', textAlign: 'center' }}>
          <div style={{ color: '#a855f7', fontWeight: 700, fontSize: '1.25rem' }}>${totalContributed.toFixed(2)}</div>
          <div style={{ color: '#6b7280', fontSize: '0.7rem' }}>All-Time Contributed</div>
        </div>
        <div style={{ backgroundColor: '#111116', padding: '0.75rem', borderRadius: '10px', border: '1px solid #2a2a2a', textAlign: 'center' }}>
          <div style={{ color: '#fbbf24', fontWeight: 700, fontSize: '1.25rem' }}>{funds.length}</div>
          <div style={{ color: '#6b7280', fontSize: '0.7rem' }}>Kingdoms with Funds</div>
        </div>
        <div style={{ backgroundColor: '#111116', padding: '0.75rem', borderRadius: '10px', border: '1px solid #2a2a2a', textAlign: 'center' }}>
          <div style={{ color: '#22d3ee', fontWeight: 700, fontSize: '1.25rem' }}>{funds.filter(f => f.is_recruiting).length}</div>
          <div style={{ color: '#6b7280', fontSize: '0.7rem' }}>Actively Recruiting</div>
        </div>
      </div>

      {/* Fund List */}
      {funds.map(fund => {
        const tc = TIER_COLORS[fund.tier] ?? { bg: '#6b728015', border: '#6b728040', text: '#6b7280' };
        const balance = parseFloat(fund.balance || '0');
        const contributed = parseFloat(fund.total_contributed || '0');

        return (
          <div key={fund.id} style={{
            backgroundColor: '#111116',
            borderRadius: '10px',
            border: `1px solid ${tc.border}`,
            padding: '1rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>K{fund.kingdom_number}</span>
                <span style={{
                  padding: '0.1rem 0.5rem',
                  backgroundColor: tc.bg,
                  border: `1px solid ${tc.border}`,
                  borderRadius: '4px',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  color: tc.text,
                  textTransform: 'uppercase',
                }}>
                  {fund.tier}
                </span>
                {fund.is_recruiting && (
                  <span style={{
                    padding: '0.1rem 0.4rem',
                    backgroundColor: '#22c55e15',
                    border: '1px solid #22c55e40',
                    borderRadius: '4px',
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    color: '#22c55e',
                  }}>
                    Recruiting
                  </span>
                )}
                {fund.atlas_score && (
                  <span style={{ color: '#22d3ee', fontSize: '0.75rem', fontWeight: 600 }}>
                    💎 {parseFloat(fund.atlas_score).toFixed(1)}
                  </span>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#22c55e', fontWeight: 700, fontSize: '1.1rem' }}>
                  ${balance.toFixed(2)}
                </div>
                <div style={{ color: '#4b5563', fontSize: '0.65rem' }}>current balance</div>
              </div>
            </div>

            {/* Details Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.75rem' }}>
              <div>
                <span style={{ color: '#6b7280' }}>All-time: </span>
                <span style={{ color: '#a855f7', fontWeight: 600 }}>${contributed.toFixed(2)}</span>
              </div>
              <div>
                <span style={{ color: '#6b7280' }}>Contributors: </span>
                <span style={{ color: '#fff' }}>{fund.contributor_count}</span>
              </div>
              {fund.main_language && (
                <div>
                  <span style={{ color: '#6b7280' }}>Language: </span>
                  <span style={{ color: '#fff' }}>{fund.main_language}</span>
                </div>
              )}
              {fund.min_tc_level && (
                <div>
                  <span style={{ color: '#6b7280' }}>Min TC: </span>
                  <span style={{ color: '#fff' }}>{fund.min_tc_level}</span>
                </div>
              )}
              {fund.min_power_million && (
                <div>
                  <span style={{ color: '#6b7280' }}>Min Power: </span>
                  <span style={{ color: '#fff' }}>{fund.min_power_million}M</span>
                </div>
              )}
            </div>

            {fund.recruitment_pitch && (
              <div style={{
                marginTop: '0.5rem',
                padding: '0.5rem 0.75rem',
                backgroundColor: '#0a0a0a',
                borderRadius: '6px',
                fontSize: '0.75rem',
                color: '#9ca3af',
                fontStyle: 'italic',
                borderLeft: `2px solid ${tc.text}`,
              }}>
                {fund.recruitment_pitch}
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.65rem', color: '#4b5563' }}>
              <span>Created {timeAgo(fund.created_at)}</span>
              <span>Updated {timeAgo(fund.updated_at)}</span>
              {fund.last_depletion_at && <span>Last depletion {timeAgo(fund.last_depletion_at)}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const ProfilesTab: React.FC<{ profiles: TransferProfile[]; timeAgo: (d: string | null) => string }> = ({ profiles, timeAgo }) => {
  const [search, setSearch] = useState('');

  const filtered = search
    ? profiles.filter(p =>
        p.username.toLowerCase().includes(search.toLowerCase()) ||
        (p.profile_username || '').toLowerCase().includes(search.toLowerCase()) ||
        String(p.current_kingdom).includes(search)
      )
    : profiles;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Search + Summary */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search by username or kingdom..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            padding: '0.5rem 0.75rem',
            backgroundColor: '#111116',
            border: '1px solid #2a2a2a',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '0.8rem',
            flex: 1,
            minWidth: '200px',
          }}
        />
        <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>
          {filtered.length} profile{filtered.length !== 1 ? 's' : ''} · {profiles.filter(p => p.is_active).length} active
        </span>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
          {search ? 'No profiles match your search' : 'No transfer profiles yet'}
        </div>
      ) : (
        filtered.map(profile => (
          <div key={profile.id} style={{
            backgroundColor: '#111116',
            borderRadius: '10px',
            border: '1px solid #2a2a2a',
            padding: '1rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem' }}>
                    {profile.is_anonymous ? '(Anonymous)' : (profile.profile_username || profile.username)}
                  </span>
                  <span style={{
                    padding: '0.1rem 0.4rem',
                    backgroundColor: profile.is_active ? '#22c55e15' : '#ef444415',
                    border: `1px solid ${profile.is_active ? '#22c55e40' : '#ef444440'}`,
                    borderRadius: '4px',
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    color: profile.is_active ? '#22c55e' : '#ef4444',
                  }}>
                    {profile.is_active ? 'Active' : 'Inactive'}
                  </span>
                  {profile.is_anonymous && (
                    <span style={{
                      padding: '0.1rem 0.4rem',
                      backgroundColor: '#6b728015',
                      border: '1px solid #6b728040',
                      borderRadius: '4px',
                      fontSize: '0.65rem',
                      color: '#6b7280',
                    }}>
                      Anonymous
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.7rem', color: '#6b7280', flexWrap: 'wrap' }}>
                  <span>From <strong style={{ color: '#22d3ee' }}>K{profile.current_kingdom}</strong></span>
                  <span>TC{profile.tc_level > 30 ? '30+' : profile.tc_level}</span>
                  {profile.power_million && <span>{profile.power_million}M power</span>}
                  <span>{profile.main_language}</span>
                  <span>Group: {profile.group_size}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.65rem', color: '#4b5563' }}>
                <div>Last active {timeAgo(profile.last_active_at)}</div>
                <div>Created {timeAgo(profile.created_at)}</div>
              </div>
            </div>

            {/* Looking For Tags */}
            {profile.looking_for && profile.looking_for.length > 0 && (
              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                {profile.looking_for.map(tag => (
                  <span key={tag} style={{
                    padding: '0.1rem 0.4rem',
                    backgroundColor: '#3b82f615',
                    border: '1px solid #3b82f630',
                    borderRadius: '4px',
                    fontSize: '0.6rem',
                    color: '#3b82f6',
                  }}>
                    {tag.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            )}

            {profile.player_bio && (
              <div style={{
                marginTop: '0.5rem',
                padding: '0.5rem 0.75rem',
                backgroundColor: '#0a0a0a',
                borderRadius: '6px',
                fontSize: '0.75rem',
                color: '#9ca3af',
                fontStyle: 'italic',
              }}>
                {profile.player_bio}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default TransferHubAdminTab;
