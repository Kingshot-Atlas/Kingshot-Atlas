import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { colors } from '../../utils/styles';
import { logger } from '../../utils/logger';
import {
  EditorClaim, KingdomFund, TransferProfile, TransferHubStats, AuditLogEntry,
  SubTab,
} from './transferHubTypes';
import {
  OverviewTab, EditorsTab, CoEditorsTab, FundsTab, ProfilesTab, AuditLogTab,
} from './TransferHubSubTabs';

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        .select('id, balance, total_contributed, tier, grace_period_until')
        .eq('kingdom_number', kingdomNumber)
        .maybeSingle();

      if (existing) {
        const newBalance = parseFloat(existing.balance || '0') + amount;
        const newTotal = parseFloat(existing.total_contributed || '0') + amount;
        const balanceTier = newBalance >= 100 ? 'gold' : newBalance >= 50 ? 'silver' : newBalance >= 25 ? 'bronze' : 'standard';
        const currentTier = existing.tier || 'standard';
        const tierThresholds: Record<string, number> = { gold: 100, silver: 50, bronze: 25, standard: 0 };
        const threshold = tierThresholds[currentTier] ?? 0;
        const hasGrace = existing.grace_period_until && new Date(existing.grace_period_until) > new Date();

        // During grace period: keep current tier, clear grace if balance recovered
        const updateData: Record<string, unknown> = { balance: newBalance, total_contributed: newTotal };
        if (hasGrace && newBalance >= threshold) {
          updateData.tier = currentTier;
          updateData.grace_period_until = null;
        } else if (hasGrace) {
          updateData.tier = currentTier;
        } else {
          updateData.tier = balanceTier;
        }
        const { error } = await supabase
          .from('kingdom_funds')
          .update(updateData)
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

export default TransferHubAdminTab;
