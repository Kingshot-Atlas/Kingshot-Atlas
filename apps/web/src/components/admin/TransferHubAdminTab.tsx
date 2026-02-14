import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { colors } from '../../utils/styles';
import { logger } from '../../utils/logger';

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
  admin_tier_override: string | null;
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

interface AuditLogEntry {
  id: string;
  editor_id: string | null;
  kingdom_number: number;
  action: string;
  performed_by: string | null;
  target_user_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
  // Joined
  performer_name?: string;
  target_name?: string;
}

type SubTab = 'overview' | 'editors' | 'co-editors' | 'funds' | 'profiles' | 'audit-log';

// =============================================
// CONSTANTS
// =============================================

const TIER_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  gold: { bg: `${colors.gold}15`, border: `${colors.gold}40`, text: colors.gold },
  silver: { bg: '#d1d5db15', border: '#d1d5db40', text: '#d1d5db' },
  bronze: { bg: `${colors.bronze}15`, border: `${colors.bronze}40`, text: colors.bronze },
  standard: { bg: `${colors.textMuted}15`, border: `${colors.textMuted}40`, text: colors.textMuted },
};

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  active: { bg: `${colors.success}15`, border: `${colors.success}40`, text: colors.success },
  pending: { bg: `${colors.warning}15`, border: `${colors.warning}40`, text: colors.warning },
  inactive: { bg: `${colors.textMuted}15`, border: `${colors.textMuted}40`, text: colors.textMuted },
  suspended: { bg: `${colors.error}15`, border: `${colors.error}40`, text: colors.error },
  cancelled: { bg: '#ef444415', border: '#ef444440', text: '#ef4444' },
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
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: string; name: string } | null>(null);

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
    if (error) { logger.error('Error fetching editors:', error); return; }
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
    if (error) { logger.error('Error fetching funds:', error); return; }
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
    if (error) { logger.error('Error fetching profiles:', error); return; }
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
      logger.error('Error fetching stats:', err);
    }
  };

  const fetchAuditLog = async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('editor_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) { logger.error('Error fetching audit log:', error); return; }
      if (!data || data.length === 0) { setAuditLog([]); return; }

      // Enrich with performer and target names
      const userIds = [...new Set([
        ...data.map(e => e.performed_by).filter(Boolean),
        ...data.map(e => e.target_user_id).filter(Boolean),
      ])] as string[];

      const profileMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, username, linked_username')
          .in('id', userIds);
        profileData?.forEach(p => {
          profileMap.set(p.id, p.linked_username || p.username || 'Unknown');
        });
      }

      setAuditLog(data.map(e => ({
        ...e,
        performer_name: e.performed_by ? profileMap.get(e.performed_by) || 'System' : 'System',
        target_name: e.target_user_id ? profileMap.get(e.target_user_id) || 'Unknown' : '—',
      })));
    } catch (err) {
      logger.error('Error fetching audit log:', err);
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

  const updateEditorStatus = async (editorId: string, newStatus: string, editorUserId: string, kingdomNumber: number, notifyMessage: string) => {
    if (!supabase) return;
    setActionLoading(editorId);
    try {
      const updateData: Record<string, unknown> = { status: newStatus };
      if (newStatus === 'active') updateData.activated_at = new Date().toISOString();

      const { error } = await supabase
        .from('kingdom_editors')
        .update(updateData)
        .eq('id', editorId);

      if (error) { logger.error('Status update failed:', error); return; }

      // Notify the editor
      await supabase.from('notifications').insert({
        user_id: editorUserId,
        type: 'editor_status_change',
        title: 'Editor Status Updated',
        message: notifyMessage,
        link: '/transfer-hub',
        metadata: { kingdom_number: kingdomNumber, new_status: newStatus },
      });

      // Audit log
      await supabase.from('editor_audit_log').insert({
        editor_id: editorId,
        kingdom_number: kingdomNumber,
        action: newStatus === 'active' ? 'activate' : 'suspend',
        performed_by: (await supabase.auth.getUser()).data.user?.id,
        target_user_id: editorUserId,
        details: { new_status: newStatus, source: 'admin_dashboard' },
      });

      await fetchEditors();
    } catch (err) {
      logger.error('Error updating editor status:', err);
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  };

  const removeEditor = async (editorId: string, editorUserId: string, kingdomNumber: number) => {
    if (!supabase) return;
    setActionLoading(editorId);
    try {
      const { error } = await supabase
        .from('kingdom_editors')
        .delete()
        .eq('id', editorId);

      if (error) { logger.error('Remove failed:', error); return; }

      await supabase.from('notifications').insert({
        user_id: editorUserId,
        type: 'editor_status_change',
        title: 'Editor Role Removed',
        message: `Your editor role for Kingdom ${kingdomNumber} has been removed by an admin.`,
        link: '/transfer-hub',
        metadata: { kingdom_number: kingdomNumber, action: 'removed' },
      });

      // Audit log (removal cascade trigger also fires)
      await supabase.from('editor_audit_log').insert({
        editor_id: editorId,
        kingdom_number: kingdomNumber,
        action: 'remove',
        performed_by: (await supabase.auth.getUser()).data.user?.id,
        target_user_id: editorUserId,
        details: { source: 'admin_dashboard' },
      });

      await fetchEditors();
    } catch (err) {
      logger.error('Error removing editor:', err);
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  };

  const promoteToEditor = async (editorId: string, editorUserId: string, kingdomNumber: number) => {
    if (!supabase) return;
    setActionLoading(editorId);
    try {
      const { error } = await supabase
        .from('kingdom_editors')
        .update({ role: 'editor', status: 'active', activated_at: new Date().toISOString() })
        .eq('id', editorId);

      if (error) { logger.error('Promote failed:', error); return; }

      await supabase.from('notifications').insert({
        user_id: editorUserId,
        type: 'editor_status_change',
        title: 'Promoted to Editor',
        message: `You have been promoted to primary Editor for Kingdom ${kingdomNumber}!`,
        link: '/transfer-hub',
        metadata: { kingdom_number: kingdomNumber, action: 'promoted' },
      });

      // Audit log
      await supabase.from('editor_audit_log').insert({
        editor_id: editorId,
        kingdom_number: kingdomNumber,
        action: 'promote',
        performed_by: (await supabase.auth.getUser()).data.user?.id,
        target_user_id: editorUserId,
        details: { source: 'admin_dashboard' },
      });

      await fetchEditors();
    } catch (err) {
      logger.error('Error promoting editor:', err);
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  };

  const bulkDeactivateInactive = async () => {
    if (!supabase) return;
    setActionLoading('bulk');
    try {
      // Find editors inactive for 30+ days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: staleEditors } = await supabase
        .from('kingdom_editors')
        .select('id, user_id, kingdom_number')
        .eq('status', 'active')
        .lt('last_active_at', thirtyDaysAgo);

      if (!staleEditors || staleEditors.length === 0) {
        setActionLoading(null);
        return;
      }

      const ids = staleEditors.map(e => e.id);
      await supabase
        .from('kingdom_editors')
        .update({ status: 'inactive' })
        .in('id', ids);

      // Notify each
      const notifications = staleEditors.map(e => ({
        user_id: e.user_id,
        type: 'editor_status_change',
        title: 'Editor Status: Inactive',
        message: `Your editor role for Kingdom ${e.kingdom_number} was set to inactive due to 30+ days of inactivity.`,
        link: '/transfer-hub',
        metadata: { kingdom_number: e.kingdom_number, action: 'auto_inactive' },
      }));
      await supabase.from('notifications').insert(notifications);

      // Audit log for bulk action
      const adminId = (await supabase.auth.getUser()).data.user?.id;
      const auditEntries = staleEditors.map(e => ({
        editor_id: e.id,
        kingdom_number: e.kingdom_number,
        action: 'bulk_deactivate' as const,
        performed_by: adminId,
        target_user_id: e.user_id,
        details: { reason: '30d_inactive', source: 'admin_dashboard' },
      }));
      await supabase.from('editor_audit_log').insert(auditEntries);

      await fetchEditors();
    } catch (err) {
      logger.error('Bulk deactivate error:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const grantTierOverride = async (fundId: string, _kingdomNumber: number, tier: string) => {
    if (!supabase) return;
    setActionLoading(fundId);
    try {
      const { error } = await supabase
        .from('kingdom_funds')
        .update({ admin_tier_override: tier })
        .eq('id', fundId);
      if (error) { logger.error('Grant tier failed:', error); return; }
      await fetchFunds();
    } catch (err) {
      logger.error('Error granting tier:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const revokeTierOverride = async (fundId: string) => {
    if (!supabase) return;
    setActionLoading(fundId);
    try {
      const { error } = await supabase
        .from('kingdom_funds')
        .update({ admin_tier_override: null })
        .eq('id', fundId);
      if (error) { logger.error('Revoke tier failed:', error); return; }
      await fetchFunds();
    } catch (err) {
      logger.error('Error revoking tier:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const grantTierToNewKingdom = async (kingdomNumber: number, tier: string) => {
    if (!supabase) return;
    setActionLoading('new-kingdom');
    try {
      // Check if fund entry already exists
      const { data: existing } = await supabase
        .from('kingdom_funds')
        .select('id')
        .eq('kingdom_number', kingdomNumber)
        .maybeSingle();

      if (existing) {
        // Update existing entry
        const { error } = await supabase
          .from('kingdom_funds')
          .update({ admin_tier_override: tier })
          .eq('id', existing.id);
        if (error) { logger.error('Grant tier to existing fund failed:', error); return; }
      } else {
        // Create new fund entry with override
        const { error } = await supabase
          .from('kingdom_funds')
          .insert({
            kingdom_number: kingdomNumber,
            balance: 0,
            tier: tier,
            total_contributed: 0,
            contributor_count: 0,
            is_recruiting: false,
            admin_tier_override: tier,
          });
        if (error) { logger.error('Create fund with tier failed:', error); return; }
      }
      await fetchFunds();
    } catch (err) {
      logger.error('Error granting tier to kingdom:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const addFundsToKingdom = async (kingdomNumber: number, amount: number) => {
    if (!supabase || amount <= 0) return;
    setActionLoading('add-funds');
    try {
      // Check if fund entry exists
      const { data: existing } = await supabase
        .from('kingdom_funds')
        .select('id, balance, total_contributed')
        .eq('kingdom_number', kingdomNumber)
        .maybeSingle();

      if (existing) {
        const newBalance = parseFloat(existing.balance || '0') + amount;
        const newTotal = parseFloat(existing.total_contributed || '0') + amount;
        // Determine tier based on new balance
        const newTier = newBalance >= 100 ? 'gold' : newBalance >= 50 ? 'silver' : newBalance >= 25 ? 'bronze' : 'standard';
        const { error } = await supabase
          .from('kingdom_funds')
          .update({ balance: newBalance, total_contributed: newTotal, tier: newTier })
          .eq('id', existing.id);
        if (error) { logger.error('Add funds failed:', error); return; }
      } else {
        const newTier = amount >= 100 ? 'gold' : amount >= 50 ? 'silver' : amount >= 25 ? 'bronze' : 'standard';
        const { error } = await supabase
          .from('kingdom_funds')
          .insert({
            kingdom_number: kingdomNumber,
            balance: amount,
            tier: newTier,
            total_contributed: amount,
            contributor_count: 1,
            is_recruiting: false,
          });
        if (error) { logger.error('Create fund with balance failed:', error); return; }
      }
      await fetchFunds();
    } catch (err) {
      logger.error('Error adding funds to kingdom:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const subTabs: { id: SubTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'editors', label: 'Editor Claims', icon: '👑' },
    { id: 'co-editors', label: 'Co-Editors', icon: '🤝' },
    { id: 'funds', label: 'Kingdom Funds', icon: '💰' },
    { id: 'profiles', label: 'Transfer Profiles', icon: '🔄' },
    { id: 'audit-log', label: 'Audit Log', icon: '📋' },
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
              backgroundColor: subTab === tab.id ? `${colors.purple}20` : 'transparent',
              color: subTab === tab.id ? colors.purple : colors.textMuted,
              border: subTab === tab.id ? `1px solid ${colors.purple}40` : '1px solid transparent',
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
            border: `1px solid ${colors.border}`,
            borderRadius: '4px',
            color: colors.textMuted,
            cursor: 'pointer',
            fontSize: '0.7rem',
          }}
        >
          {loading ? '...' : '↻ Refresh'}
        </button>
      </div>

      {loading && !stats ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: colors.textMuted }}>Loading Transfer Hub data...</div>
      ) : subTab === 'overview' ? (
        <OverviewTab stats={stats} />
      ) : subTab === 'editors' ? (
        <EditorsTab
          editors={editors.filter(e => e.role === 'editor')}
          timeAgo={timeAgo}
          actionLoading={actionLoading}
          confirmAction={confirmAction}
          onConfirmAction={setConfirmAction}
          onUpdateStatus={updateEditorStatus}
          onRemove={removeEditor}
          onBulkDeactivate={bulkDeactivateInactive}
        />
      ) : subTab === 'co-editors' ? (
        <CoEditorsTab
          editors={editors.filter(e => e.role === 'co-editor')}
          timeAgo={timeAgo}
          actionLoading={actionLoading}
          confirmAction={confirmAction}
          onConfirmAction={setConfirmAction}
          onUpdateStatus={updateEditorStatus}
          onRemove={removeEditor}
          onPromote={promoteToEditor}
        />
      ) : subTab === 'funds' ? (
        <FundsTab funds={funds} timeAgo={timeAgo} onGrantTier={grantTierOverride} onRevokeTier={revokeTierOverride} onGrantNewKingdom={grantTierToNewKingdom} onAddFunds={addFundsToKingdom} actionLoading={actionLoading} />
      ) : subTab === 'profiles' ? (
        <ProfilesTab profiles={profiles} timeAgo={timeAgo} />
      ) : subTab === 'audit-log' ? (
        <AuditLogTab entries={auditLog} timeAgo={timeAgo} loading={loading} onRefresh={fetchAuditLog} />
      ) : null}
    </div>
  );
};

// =============================================
// SUB-COMPONENTS
// =============================================

const OverviewTab: React.FC<{ stats: TransferHubStats | null }> = ({ stats }) => {
  if (!stats) return <div style={{ textAlign: 'center', padding: '2rem', color: colors.textMuted }}>No data</div>;

  const cards = [
    { label: 'Editor Claims', value: stats.totalEditors, sub: `${stats.pendingEditors} pending · ${stats.activeEditors} active`, color: colors.purple, icon: '👑' },
    { label: 'Kingdom Funds', value: stats.totalFunds, sub: `$${stats.totalFundBalance.toFixed(2)} balance · $${stats.totalContributed.toFixed(2)} contributed`, color: colors.gold, icon: '💰' },
    { label: 'Recruiting', value: stats.recruitingKingdoms, sub: 'kingdoms actively recruiting', color: colors.success, icon: '📢' },
    { label: 'Transfer Profiles', value: stats.totalProfiles, sub: `${stats.activeProfiles} active`, color: colors.blue, icon: '🔄' },
    { label: 'Applications', value: stats.totalApplications, sub: `${stats.pendingApplications} pending · ${stats.acceptedApplications} accepted`, color: colors.primary, icon: '📨' },
    { label: 'Invites Sent', value: stats.totalInvites, sub: 'recruiter-initiated', color: colors.orange, icon: '✉️' },
    { label: 'Profile Views', value: stats.totalProfileViews, sub: 'transfer profile impressions', color: colors.pink, icon: '👁️' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
        {cards.map((card, i) => (
          <div key={i} style={{
            backgroundColor: colors.cardAlt,
            borderRadius: '10px',
            padding: '1rem',
            border: `1px solid ${colors.border}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
              <span>{card.icon}</span>
              <span style={{ color: colors.textMuted, fontSize: '0.75rem' }}>{card.label}</span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: card.color }}>{card.value}</div>
            <div style={{ color: colors.textMuted, fontSize: '0.7rem', marginTop: '0.25rem' }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Health Indicators */}
      <div style={{
        backgroundColor: colors.cardAlt,
        borderRadius: '10px',
        padding: '1rem',
        border: `1px solid ${colors.border}`,
      }}>
        <h4 style={{ color: colors.text, margin: '0 0 0.75rem', fontSize: '0.85rem' }}>Transfer Hub Health</h4>
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
                backgroundColor: item.severity === 'ok' ? colors.success : item.severity === 'info' ? colors.warning : colors.error,
              }} />
              <span style={{ color: colors.textSecondary }}>{item.label}</span>
              <span style={{
                color: item.severity === 'ok' ? colors.success : item.severity === 'info' ? colors.warning : colors.error,
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

// Shared action button styles
const actionBtn = (bg: string, border: string, color: string, disabled?: boolean): React.CSSProperties => ({
  padding: '0.2rem 0.5rem',
  backgroundColor: disabled ? colors.surfaceHover : bg,
  border: `1px solid ${disabled ? colors.border : border}`,
  borderRadius: '4px',
  color: disabled ? colors.textMuted : color,
  fontSize: '0.6rem',
  fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.5 : 1,
});

// Confirmation dialog
const ConfirmDialog: React.FC<{
  action: { id: string; action: string; name: string };
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ action, loading, onConfirm, onCancel }) => (
  <div style={{
    padding: '0.5rem 0.75rem',
    backgroundColor: `${colors.error}10`,
    border: `1px solid ${colors.error}30`,
    borderRadius: '6px',
    marginTop: '0.5rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.7rem',
  }}>
    <span style={{ color: colors.error }}>
      {action.action === 'remove' ? `Remove ${action.name}?` : `${action.action} ${action.name}?`}
    </span>
    <button
      onClick={onConfirm}
      disabled={loading}
      style={actionBtn(`${colors.error}20`, `${colors.error}40`, colors.error, loading)}
    >
      {loading ? '...' : 'Confirm'}
    </button>
    <button onClick={onCancel} style={actionBtn('transparent', colors.border, colors.textMuted)}>
      Cancel
    </button>
  </div>
);

interface EditorsTabProps {
  editors: EditorClaim[];
  timeAgo: (d: string | null) => string;
  actionLoading: string | null;
  confirmAction: { id: string; action: string; name: string } | null;
  onConfirmAction: (a: { id: string; action: string; name: string } | null) => void;
  onUpdateStatus: (id: string, status: string, userId: string, kn: number, msg: string) => void;
  onRemove: (id: string, userId: string, kn: number) => void;
  onBulkDeactivate: () => void;
}

const EditorsTab: React.FC<EditorsTabProps> = ({
  editors, timeAgo, actionLoading, confirmAction, onConfirmAction, onUpdateStatus, onRemove, onBulkDeactivate,
}) => {
  if (editors.length === 0) {
    return <div style={{ textAlign: 'center', padding: '2rem', color: colors.textMuted }}>No editor claims yet</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: colors.textMuted, fontSize: '0.75rem' }}>
          {editors.length} total claim{editors.length !== 1 ? 's' : ''} · {editors.filter(e => e.status === 'pending').length} pending · {editors.filter(e => e.status === 'active').length} active
        </div>
        <button
          onClick={onBulkDeactivate}
          disabled={actionLoading === 'bulk'}
          style={actionBtn(`${colors.textMuted}10`, `${colors.textMuted}40`, colors.textMuted, actionLoading === 'bulk')}
        >
          {actionLoading === 'bulk' ? 'Processing...' : 'Deactivate 30d+ Inactive'}
        </button>
      </div>
      {editors.map(editor => {
        const sc = STATUS_COLORS[editor.status] ?? { bg: `${colors.warning}15`, border: `${colors.warning}40`, text: colors.warning };
        const endorsementPct = editor.required_endorsements > 0
          ? Math.min(100, (editor.endorsement_count / editor.required_endorsements) * 100)
          : 0;
        const displayName = editor.linked_username || editor.username || 'Unknown';
        const isLoading = actionLoading === editor.id;
        return (
          <div key={editor.id} style={{
            backgroundColor: colors.cardAlt,
            borderRadius: '10px',
            border: `1px solid ${colors.border}`,
            padding: '1rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{ color: colors.text, fontWeight: 600, fontSize: '0.9rem' }}>{displayName}</span>
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
                    backgroundColor: `${colors.primary}15`,
                    border: `1px solid ${colors.primary}40`,
                    borderRadius: '4px',
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    color: colors.primary,
                    textTransform: 'capitalize',
                  }}>
                    {editor.role}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.7rem', color: colors.textMuted }}>
                  <span>Claiming <strong style={{ color: colors.primary }}>K{editor.kingdom_number}</strong></span>
                  {editor.linked_kingdom && <span>Home: K{editor.linked_kingdom}</span>}
                  {editor.linked_tc_level && <span>TC{editor.linked_tc_level > 30 ? '30+' : editor.linked_tc_level}</span>}
                  <span>Nominated {timeAgo(editor.nominated_at)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                {editor.status !== 'active' && (
                  <button
                    onClick={() => onUpdateStatus(editor.id, 'active', editor.user_id, editor.kingdom_number, `Your editor claim for Kingdom ${editor.kingdom_number} has been activated by an admin.`)}
                    disabled={isLoading}
                    style={actionBtn(`${colors.success}15`, `${colors.success}40`, colors.success, isLoading)}
                  >Activate</button>
                )}
                {editor.status !== 'suspended' && editor.status !== 'pending' && (
                  <button
                    onClick={() => onUpdateStatus(editor.id, 'suspended', editor.user_id, editor.kingdom_number, `Your editor role for Kingdom ${editor.kingdom_number} has been suspended by an admin.`)}
                    disabled={isLoading}
                    style={actionBtn(`${colors.warning}15`, `${colors.warning}40`, colors.warning, isLoading)}
                  >Suspend</button>
                )}
                <button
                  onClick={() => onConfirmAction({ id: editor.id, action: 'remove', name: displayName })}
                  disabled={isLoading}
                  style={actionBtn(`${colors.error}15`, `${colors.error}40`, colors.error, isLoading)}
                >Remove</button>
              </div>
            </div>

            {/* Confirm dialog */}
            {confirmAction?.id === editor.id && (
              <ConfirmDialog
                action={confirmAction}
                loading={isLoading}
                onConfirm={() => onRemove(editor.id, editor.user_id, editor.kingdom_number)}
                onCancel={() => onConfirmAction(null)}
              />
            )}

            {/* Endorsement Progress */}
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                <span style={{ color: colors.textSecondary, fontSize: '0.75rem' }}>Endorsements</span>
                <span style={{
                  color: endorsementPct >= 100 ? colors.success : colors.warning,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}>
                  {editor.endorsement_count}/{editor.required_endorsements}
                </span>
              </div>
              <div style={{
                height: '6px',
                backgroundColor: colors.surfaceHover,
                borderRadius: '3px',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${endorsementPct}%`,
                  backgroundColor: endorsementPct >= 100 ? colors.success : endorsementPct >= 50 ? colors.warning : colors.error,
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
                backgroundColor: `${colors.purple}08`,
                border: `1px solid ${colors.purple}20`,
                borderRadius: '6px',
              }}>
                <span style={{ color: colors.purple, fontSize: '0.65rem', fontWeight: 500 }}>Test endorsement flow:</span>
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
                    backgroundColor: `${colors.purple}15`,
                    border: `1px solid ${colors.purple}30`,
                    borderRadius: '4px',
                    color: colors.purple,
                    fontSize: '0.6rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >Copy Link</button>
                <button
                  onClick={() => window.open(`/transfer-hub?endorse=${editor.id}`, '_blank')}
                  style={{
                    padding: '0.15rem 0.5rem',
                    backgroundColor: `${colors.primary}15`,
                    border: `1px solid ${colors.primary}30`,
                    borderRadius: '4px',
                    color: colors.primary,
                    fontSize: '0.6rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >Open in New Tab</button>
              </div>
            )}

            {/* Timeline */}
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.65rem', color: colors.textMuted }}>
              {editor.activated_at && <span>Activated {timeAgo(editor.activated_at)}</span>}
              {editor.last_active_at && <span>Last active {timeAgo(editor.last_active_at)}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

interface CoEditorsTabProps {
  editors: EditorClaim[];
  timeAgo: (d: string | null) => string;
  actionLoading: string | null;
  confirmAction: { id: string; action: string; name: string } | null;
  onConfirmAction: (a: { id: string; action: string; name: string } | null) => void;
  onUpdateStatus: (id: string, status: string, userId: string, kn: number, msg: string) => void;
  onRemove: (id: string, userId: string, kn: number) => void;
  onPromote: (id: string, userId: string, kn: number) => void;
}

const CoEditorsTab: React.FC<CoEditorsTabProps> = ({
  editors, timeAgo, actionLoading, confirmAction, onConfirmAction, onUpdateStatus, onRemove, onPromote,
}) => {
  if (editors.length === 0) {
    return <div style={{ textAlign: 'center', padding: '2rem', color: colors.textMuted }}>No co-editors yet</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ color: colors.textMuted, fontSize: '0.75rem' }}>
        {editors.length} co-editor{editors.length !== 1 ? 's' : ''} · {editors.filter(e => e.status === 'pending').length} pending · {editors.filter(e => e.status === 'active').length} active
      </div>
      {editors.map(editor => {
        const sc = STATUS_COLORS[editor.status] ?? { bg: `${colors.warning}15`, border: `${colors.warning}40`, text: colors.warning };
        const displayName = editor.linked_username || editor.username || 'Unknown';
        const isLoading = actionLoading === editor.id;
        return (
          <div key={editor.id} style={{
            backgroundColor: colors.cardAlt,
            borderRadius: '10px',
            border: `1px solid ${colors.border}`,
            padding: '1rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{ color: colors.text, fontWeight: 600, fontSize: '0.9rem' }}>{displayName}</span>
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
                    backgroundColor: `${colors.purple}15`,
                    border: `1px solid ${colors.purple}40`,
                    borderRadius: '4px',
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    color: colors.purple,
                  }}>
                    Co-Editor
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.7rem', color: colors.textMuted }}>
                  <span>Kingdom <strong style={{ color: colors.primary }}>K{editor.kingdom_number}</strong></span>
                  {editor.linked_kingdom && <span>Home: K{editor.linked_kingdom}</span>}
                  {editor.linked_tc_level && <span>TC{editor.linked_tc_level > 30 ? '30+' : editor.linked_tc_level}</span>}
                  <span>Nominated {timeAgo(editor.nominated_at)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                {editor.status !== 'active' && (
                  <button
                    onClick={() => onUpdateStatus(editor.id, 'active', editor.user_id, editor.kingdom_number, `Your co-editor role for Kingdom ${editor.kingdom_number} has been activated by an admin.`)}
                    disabled={isLoading}
                    style={actionBtn(`${colors.success}15`, `${colors.success}40`, colors.success, isLoading)}
                  >Activate</button>
                )}
                <button
                  onClick={() => onConfirmAction({ id: editor.id, action: 'promote', name: displayName })}
                  disabled={isLoading}
                  style={actionBtn(`${colors.primary}15`, `${colors.primary}40`, colors.primary, isLoading)}
                >Promote to Editor</button>
                {editor.status !== 'suspended' && editor.status !== 'pending' && (
                  <button
                    onClick={() => onUpdateStatus(editor.id, 'suspended', editor.user_id, editor.kingdom_number, `Your co-editor role for Kingdom ${editor.kingdom_number} has been suspended by an admin.`)}
                    disabled={isLoading}
                    style={actionBtn(`${colors.warning}15`, `${colors.warning}40`, colors.warning, isLoading)}
                  >Suspend</button>
                )}
                <button
                  onClick={() => onConfirmAction({ id: editor.id, action: 'remove', name: displayName })}
                  disabled={isLoading}
                  style={actionBtn(`${colors.error}15`, `${colors.error}40`, colors.error, isLoading)}
                >Remove</button>
              </div>
            </div>

            {/* Confirm dialog */}
            {confirmAction?.id === editor.id && (
              <ConfirmDialog
                action={confirmAction}
                loading={isLoading}
                onConfirm={() => {
                  if (confirmAction.action === 'promote') {
                    onPromote(editor.id, editor.user_id, editor.kingdom_number);
                  } else {
                    onRemove(editor.id, editor.user_id, editor.kingdom_number);
                  }
                }}
                onCancel={() => onConfirmAction(null)}
              />
            )}

            {/* Timeline */}
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.65rem', color: colors.textMuted }}>
              {editor.activated_at && <span>Activated {timeAgo(editor.activated_at)}</span>}
              {editor.last_active_at && <span>Last active {timeAgo(editor.last_active_at)}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

interface FundsTabProps {
  funds: KingdomFund[];
  timeAgo: (d: string | null) => string;
  onGrantTier: (fundId: string, kingdomNumber: number, tier: string) => void;
  onRevokeTier: (fundId: string) => void;
  onGrantNewKingdom: (kingdomNumber: number, tier: string) => void;
  onAddFunds: (kingdomNumber: number, amount: number) => Promise<void>;
  actionLoading: string | null;
}

const FundsTab: React.FC<FundsTabProps> = ({ funds, timeAgo, onGrantTier, onRevokeTier, onGrantNewKingdom, onAddFunds, actionLoading }) => {
  const [grantKingdom, setGrantKingdom] = useState('');
  const [grantTier, setGrantTier] = useState('gold');
  const [showGrantForm, setShowGrantForm] = useState(false);
  const [showAddFundsForm, setShowAddFundsForm] = useState(false);
  const [addFundsKingdom, setAddFundsKingdom] = useState('');
  const [addFundsAmount, setAddFundsAmount] = useState('');
  const [addingFunds, setAddingFunds] = useState(false);

  const totalBalance = funds.reduce((sum, f) => sum + parseFloat(f.balance || '0'), 0);
  const totalContributed = funds.reduce((sum, f) => sum + parseFloat(f.total_contributed || '0'), 0);
  const overrideCount = funds.filter(f => f.admin_tier_override).length;

  const handleGrantNew = () => {
    const kn = parseInt(grantKingdom, 10);
    if (isNaN(kn) || kn <= 0) return;
    onGrantNewKingdom(kn, grantTier);
    setGrantKingdom('');
    setShowGrantForm(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
        <div style={{ backgroundColor: colors.cardAlt, padding: '0.75rem', borderRadius: '10px', border: `1px solid ${colors.border}`, textAlign: 'center' }}>
          <div style={{ color: colors.success, fontWeight: 700, fontSize: '1.25rem' }}>${totalBalance.toFixed(2)}</div>
          <div style={{ color: colors.textMuted, fontSize: '0.7rem' }}>Current Balance</div>
        </div>
        <div style={{ backgroundColor: colors.cardAlt, padding: '0.75rem', borderRadius: '10px', border: `1px solid ${colors.border}`, textAlign: 'center' }}>
          <div style={{ color: colors.purple, fontWeight: 700, fontSize: '1.25rem' }}>${totalContributed.toFixed(2)}</div>
          <div style={{ color: colors.textMuted, fontSize: '0.7rem' }}>All-Time Contributed</div>
        </div>
        <div style={{ backgroundColor: colors.cardAlt, padding: '0.75rem', borderRadius: '10px', border: `1px solid ${colors.border}`, textAlign: 'center' }}>
          <div style={{ color: colors.gold, fontWeight: 700, fontSize: '1.25rem' }}>{funds.length}</div>
          <div style={{ color: colors.textMuted, fontSize: '0.7rem' }}>Kingdoms with Funds</div>
        </div>
        <div style={{ backgroundColor: colors.cardAlt, padding: '0.75rem', borderRadius: '10px', border: `1px solid ${colors.border}`, textAlign: 'center' }}>
          <div style={{ color: colors.primary, fontWeight: 700, fontSize: '1.25rem' }}>{overrideCount}</div>
          <div style={{ color: colors.textMuted, fontSize: '0.7rem' }}>Admin Tier Overrides</div>
        </div>
      </div>

      {/* Grant Tier to Kingdom */}
      <div style={{
        backgroundColor: colors.cardAlt,
        borderRadius: '10px',
        border: `1px solid ${colors.gold}30`,
        padding: '0.75rem 1rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem' }}>👑</span>
            <span style={{ color: colors.gold, fontWeight: 600, fontSize: '0.8rem' }}>Grant Tier to Kingdom</span>
          </div>
          <button
            onClick={() => setShowGrantForm(!showGrantForm)}
            style={{
              padding: '0.3rem 0.7rem',
              backgroundColor: showGrantForm ? `${colors.error}15` : `${colors.gold}15`,
              border: `1px solid ${showGrantForm ? `${colors.error}40` : `${colors.gold}40`}`,
              borderRadius: '6px',
              color: showGrantForm ? colors.error : colors.gold,
              fontSize: '0.7rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {showGrantForm ? 'Cancel' : '+ Grant Tier'}
          </button>
        </div>

        {showGrantForm && (
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            marginTop: '0.75rem',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}>
            <input
              type="number"
              placeholder="Kingdom #"
              value={grantKingdom}
              onChange={e => setGrantKingdom(e.target.value)}
              style={{
                padding: '0.4rem 0.6rem',
                backgroundColor: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                color: colors.text,
                fontSize: '0.8rem',
                width: '100px',
              }}
            />
            <select
              value={grantTier}
              onChange={e => setGrantTier(e.target.value)}
              style={{
                padding: '0.4rem 0.6rem',
                backgroundColor: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                color: colors.text,
                fontSize: '0.8rem',
              }}
            >
              <option value="gold">Gold</option>
              <option value="silver">Silver</option>
              <option value="bronze">Bronze</option>
            </select>
            <button
              onClick={handleGrantNew}
              disabled={!grantKingdom || actionLoading === 'new-kingdom'}
              style={{
                padding: '0.4rem 0.8rem',
                backgroundColor: `${colors.gold}20`,
                border: `1px solid ${colors.gold}50`,
                borderRadius: '6px',
                color: colors.gold,
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: !grantKingdom ? 'not-allowed' : 'pointer',
                opacity: !grantKingdom ? 0.5 : 1,
              }}
            >
              {actionLoading === 'new-kingdom' ? 'Granting...' : 'Grant'}
            </button>
            <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>
              Creates fund entry if needed. Override persists through depletion cycles.
            </span>
          </div>
        )}
      </div>

      {/* Add Funds to Kingdom */}
      <div style={{
        backgroundColor: colors.cardAlt,
        borderRadius: '10px',
        border: `1px solid ${colors.success}30`,
        padding: '0.75rem 1rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem' }}>💰</span>
            <span style={{ color: colors.success, fontWeight: 600, fontSize: '0.8rem' }}>Add Funds to Kingdom</span>
          </div>
          <button
            onClick={() => setShowAddFundsForm(!showAddFundsForm)}
            style={{
              padding: '0.3rem 0.7rem',
              backgroundColor: showAddFundsForm ? `${colors.error}15` : `${colors.success}15`,
              border: `1px solid ${showAddFundsForm ? `${colors.error}40` : `${colors.success}40`}`,
              borderRadius: '6px',
              color: showAddFundsForm ? colors.error : colors.success,
              fontSize: '0.7rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {showAddFundsForm ? 'Cancel' : '+ Add Funds'}
          </button>
        </div>

        {showAddFundsForm && (
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            marginTop: '0.75rem',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}>
            <input
              type="number"
              placeholder="Kingdom #"
              value={addFundsKingdom}
              onChange={e => setAddFundsKingdom(e.target.value)}
              style={{
                padding: '0.4rem 0.6rem',
                backgroundColor: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                color: colors.text,
                fontSize: '0.8rem',
                width: '100px',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ color: colors.success, fontWeight: 600, fontSize: '0.9rem' }}>$</span>
              <input
                type="number"
                placeholder="Amount"
                value={addFundsAmount}
                onChange={e => setAddFundsAmount(e.target.value)}
                min="0"
                step="5"
                style={{
                  padding: '0.4rem 0.6rem',
                  backgroundColor: colors.bg,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  color: colors.text,
                  fontSize: '0.8rem',
                  width: '100px',
                }}
              />
            </div>
            <button
              onClick={async () => {
                const kn = parseInt(addFundsKingdom, 10);
                const amt = parseFloat(addFundsAmount);
                if (isNaN(kn) || kn <= 0 || isNaN(amt) || amt <= 0) return;
                setAddingFunds(true);
                await onAddFunds(kn, amt);
                setAddingFunds(false);
                setAddFundsKingdom('');
                setAddFundsAmount('');
                setShowAddFundsForm(false);
              }}
              disabled={!addFundsKingdom || !addFundsAmount || addingFunds || actionLoading === 'add-funds'}
              style={{
                padding: '0.4rem 0.8rem',
                backgroundColor: `${colors.success}20`,
                border: `1px solid ${colors.success}50`,
                borderRadius: '6px',
                color: colors.success,
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: (!addFundsKingdom || !addFundsAmount) ? 'not-allowed' : 'pointer',
                opacity: (!addFundsKingdom || !addFundsAmount) ? 0.5 : 1,
              }}
            >
              {addingFunds ? 'Adding...' : 'Add Funds'}
            </button>
            <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>
              Increases balance & total contributed. Tier auto-updates based on new balance.
            </span>
          </div>
        )}
      </div>

      {/* Fund List */}
      {funds.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: colors.textMuted }}>No kingdom funds yet. Use "Grant Tier" above to add one.</div>
      ) : funds.map(fund => {
        const displayTier = fund.admin_tier_override || fund.tier;
        const tc = TIER_COLORS[displayTier] ?? { bg: `${colors.textMuted}15`, border: `${colors.textMuted}40`, text: colors.textMuted };
        const balance = parseFloat(fund.balance || '0');
        const contributed = parseFloat(fund.total_contributed || '0');
        const isOverridden = !!fund.admin_tier_override;
        const isLoading = actionLoading === fund.id;

        return (
          <div key={fund.id} style={{
            backgroundColor: colors.cardAlt,
            borderRadius: '10px',
            border: `1px solid ${isOverridden ? `${colors.gold}40` : tc.border}`,
            padding: '1rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ color: colors.text, fontWeight: 700, fontSize: '1rem' }}>K{fund.kingdom_number}</span>
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
                  {displayTier}
                </span>
                {isOverridden && (
                  <span style={{
                    padding: '0.1rem 0.4rem',
                    backgroundColor: `${colors.gold}10`,
                    border: `1px solid ${colors.gold}30`,
                    borderRadius: '4px',
                    fontSize: '0.6rem',
                    fontWeight: 600,
                    color: colors.gold,
                  }}>
                    ADMIN OVERRIDE
                  </span>
                )}
                {fund.is_recruiting && (
                  <span style={{
                    padding: '0.1rem 0.4rem',
                    backgroundColor: `${colors.success}15`,
                    border: `1px solid ${colors.success}40`,
                    borderRadius: '4px',
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    color: colors.success,
                  }}>
                    Recruiting
                  </span>
                )}
                {fund.atlas_score && (
                  <span style={{ color: colors.primary, fontSize: '0.75rem', fontWeight: 600 }}>
                    💎 {parseFloat(fund.atlas_score).toFixed(1)}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {/* Tier Action Buttons */}
                {isOverridden ? (
                  <button
                    onClick={() => onRevokeTier(fund.id)}
                    disabled={isLoading}
                    style={actionBtn(`${colors.error}15`, `${colors.error}40`, colors.error, isLoading)}
                  >
                    {isLoading ? '...' : 'Revoke Override'}
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    {['gold', 'silver', 'bronze'].map(t => {
                      const tColors = TIER_COLORS[t] ?? { bg: '#6b728015', border: '#6b728040', text: '#6b7280' };
                      return (
                        <button
                          key={t}
                          onClick={() => onGrantTier(fund.id, fund.kingdom_number, t)}
                          disabled={isLoading || fund.tier === t}
                          style={{
                            ...actionBtn(tColors.bg, tColors.border, tColors.text, isLoading || fund.tier === t),
                            textTransform: 'capitalize',
                          }}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: colors.success, fontWeight: 700, fontSize: '1.1rem' }}>
                    ${balance.toFixed(2)}
                  </div>
                  <div style={{ color: colors.textMuted, fontSize: '0.65rem' }}>current balance</div>
                </div>
              </div>
            </div>

            {/* Details Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.75rem' }}>
              <div>
                <span style={{ color: colors.textMuted }}>All-time: </span>
                <span style={{ color: colors.purple, fontWeight: 600 }}>${contributed.toFixed(2)}</span>
              </div>
              <div>
                <span style={{ color: colors.textMuted }}>Contributors: </span>
                <span style={{ color: colors.text }}>{fund.contributor_count}</span>
              </div>
              {fund.main_language && (
                <div>
                  <span style={{ color: colors.textMuted }}>Language: </span>
                  <span style={{ color: colors.text }}>{fund.main_language}</span>
                </div>
              )}
              {fund.min_tc_level && (
                <div>
                  <span style={{ color: colors.textMuted }}>Min TC: </span>
                  <span style={{ color: colors.text }}>{fund.min_tc_level}</span>
                </div>
              )}
              {fund.min_power_million && (
                <div>
                  <span style={{ color: colors.textMuted }}>Min Power: </span>
                  <span style={{ color: colors.text }}>{fund.min_power_million}M</span>
                </div>
              )}
            </div>

            {fund.recruitment_pitch && (
              <div style={{
                marginTop: '0.5rem',
                padding: '0.5rem 0.75rem',
                backgroundColor: colors.bg,
                borderRadius: '6px',
                fontSize: '0.75rem',
                color: colors.textSecondary,
                fontStyle: 'italic',
                borderLeft: `2px solid ${tc.text}`,
              }}>
                {fund.recruitment_pitch}
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.65rem', color: colors.textMuted }}>
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
            backgroundColor: colors.cardAlt,
            border: `1px solid ${colors.border}`,
            borderRadius: '8px',
            color: colors.text,
            fontSize: '0.8rem',
            flex: 1,
            minWidth: '200px',
          }}
        />
        <span style={{ color: colors.textMuted, fontSize: '0.75rem' }}>
          {filtered.length} profile{filtered.length !== 1 ? 's' : ''} · {profiles.filter(p => p.is_active).length} active
        </span>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: colors.textMuted }}>
          {search ? 'No profiles match your search' : 'No transfer profiles yet'}
        </div>
      ) : (
        filtered.map(profile => (
          <div key={profile.id} style={{
            backgroundColor: colors.cardAlt,
            borderRadius: '10px',
            border: `1px solid ${colors.border}`,
            padding: '1rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{ color: colors.text, fontWeight: 600, fontSize: '0.9rem' }}>
                    {profile.is_anonymous ? '(Anonymous)' : (profile.profile_username || profile.username)}
                  </span>
                  <span style={{
                    padding: '0.1rem 0.4rem',
                    backgroundColor: profile.is_active ? `${colors.success}15` : `${colors.error}15`,
                    border: `1px solid ${profile.is_active ? `${colors.success}40` : `${colors.error}40`}`,
                    borderRadius: '4px',
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    color: profile.is_active ? colors.success : colors.error,
                  }}>
                    {profile.is_active ? 'Active' : 'Inactive'}
                  </span>
                  {profile.is_anonymous && (
                    <span style={{
                      padding: '0.1rem 0.4rem',
                      backgroundColor: `${colors.textMuted}15`,
                      border: `1px solid ${colors.textMuted}40`,
                      borderRadius: '4px',
                      fontSize: '0.65rem',
                      color: colors.textMuted,
                    }}>
                      Anonymous
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.7rem', color: colors.textMuted, flexWrap: 'wrap' }}>
                  <span>From <strong style={{ color: colors.primary }}>K{profile.current_kingdom}</strong></span>
                  <span>TC{profile.tc_level > 30 ? '30+' : profile.tc_level}</span>
                  {profile.power_million && <span>{profile.power_million}M power</span>}
                  <span>{profile.main_language}</span>
                  <span>Group: {profile.group_size}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.65rem', color: colors.textMuted }}>
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
                    backgroundColor: `${colors.blue}15`,
                    border: `1px solid ${colors.blue}30`,
                    borderRadius: '4px',
                    fontSize: '0.6rem',
                    color: colors.blue,
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
                backgroundColor: colors.bg,
                borderRadius: '6px',
                fontSize: '0.75rem',
                color: colors.textSecondary,
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

// =============================================
// AUDIT LOG TAB
// =============================================

const ACTION_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  activate: { label: 'Activated', color: colors.success, icon: '✅' },
  suspend: { label: 'Suspended', color: colors.error, icon: '⏸️' },
  remove: { label: 'Removed', color: colors.error, icon: '🗑️' },
  promote: { label: 'Promoted', color: colors.purple, icon: '⬆️' },
  bulk_deactivate: { label: 'Bulk Deactivated', color: '#f97316', icon: '📦' },
  approve: { label: 'Approved', color: colors.success, icon: '✓' },
  reject: { label: 'Rejected', color: colors.error, icon: '✕' },
  self_nominate: { label: 'Self-Nominated', color: '#eab308', icon: '🙋' },
  invite: { label: 'Invited', color: colors.blue, icon: '✉️' },
  expire: { label: 'Expired', color: colors.textMuted, icon: '⏰' },
  cascade_delete: { label: 'Cascade Deleted', color: colors.textMuted, icon: '🔗' },
};

const AuditLogTab: React.FC<{
  entries: AuditLogEntry[];
  timeAgo: (d: string | null) => string;
  loading: boolean;
  onRefresh: () => void;
}> = ({ entries, timeAgo, loading, onRefresh }) => {
  const [filter, setFilter] = useState<string>('all');

  // Lazy-load audit log on first render
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!loaded) {
      onRefresh();
      setLoaded(true);
    }
  }, [loaded, onRefresh]);

  const filtered = filter === 'all' ? entries : entries.filter(e => e.action === filter);
  const actionTypes = [...new Set(entries.map(e => e.action))];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Header + Filters */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: colors.text, fontSize: '0.9rem', fontWeight: '600' }}>📋 Audit Log</span>
          <span style={{ color: colors.textMuted, fontSize: '0.7rem' }}>({filtered.length} entries)</span>
        </div>
        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilter('all')}
            style={{
              padding: '0.2rem 0.5rem',
              backgroundColor: filter === 'all' ? `${colors.purple}20` : 'transparent',
              color: filter === 'all' ? colors.purple : colors.textMuted,
              border: filter === 'all' ? `1px solid ${colors.purple}40` : `1px solid ${colors.border}`,
              borderRadius: '4px',
              fontSize: '0.65rem',
              cursor: 'pointer',
            }}
          >
            All
          </button>
          {actionTypes.map(action => {
            const meta = ACTION_LABELS[action] || { label: action, color: colors.textMuted, icon: '•' };
            return (
              <button
                key={action}
                onClick={() => setFilter(action)}
                style={{
                  padding: '0.2rem 0.5rem',
                  backgroundColor: filter === action ? `${meta.color}20` : 'transparent',
                  color: filter === action ? meta.color : colors.textMuted,
                  border: filter === action ? `1px solid ${meta.color}40` : `1px solid ${colors.border}`,
                  borderRadius: '4px',
                  fontSize: '0.65rem',
                  cursor: 'pointer',
                }}
              >
                {meta.icon} {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Entries */}
      {loading && entries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: colors.textMuted }}>Loading audit log...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: colors.textMuted, fontSize: '0.8rem' }}>
          No audit log entries{filter !== 'all' ? ` for "${filter}"` : ''}.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {filtered.map(entry => {
            const meta = ACTION_LABELS[entry.action] || { label: entry.action, color: colors.textMuted, icon: '•' };
            return (
              <div key={entry.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.6rem 0.75rem',
                backgroundColor: colors.cardAlt,
                borderRadius: '8px',
                border: `1px solid ${colors.surfaceHover}`,
                fontSize: '0.75rem',
              }}>
                {/* Action badge */}
                <span style={{
                  padding: '0.15rem 0.4rem',
                  backgroundColor: `${meta.color}15`,
                  border: `1px solid ${meta.color}30`,
                  borderRadius: '4px',
                  color: meta.color,
                  fontSize: '0.6rem',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  minWidth: '80px',
                  textAlign: 'center',
                }}>
                  {meta.icon} {meta.label}
                </span>

                {/* Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: colors.textSecondary, fontSize: '0.75rem' }}>
                    <span style={{ color: colors.primary, fontWeight: '500' }}>{entry.performer_name}</span>
                    {' → '}
                    <span style={{ color: colors.text, fontWeight: '500' }}>{entry.target_name}</span>
                  </div>
                  <div style={{ color: colors.textMuted, fontSize: '0.65rem', marginTop: '0.1rem' }}>
                    K{entry.kingdom_number}
                    {entry.details?.source ? <> · {String(entry.details.source).replace(/_/g, ' ')}</> : null}
                    {entry.details?.reason ? <> · {String(entry.details.reason).replace(/_/g, ' ')}</> : null}
                  </div>
                </div>

                {/* Time */}
                <span style={{ color: colors.textMuted, fontSize: '0.6rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {timeAgo(entry.created_at)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TransferHubAdminTab;
