import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useToolAccess } from '../../hooks/useToolAccess';
import { useAllianceCenter } from '../../hooks/useAllianceCenter';
import type { AllianceMember } from '../../hooks/useAllianceCenter';
import { tcLevelToTG } from '../../hooks/useAllianceEventCoordinator';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useToast } from '../Toast';
import { FONT_DISPLAY } from '../../utils/styles';
import { Button } from '../shared';
import {
  ACCENT, ACCENT_DIM, ACCENT_BORDER,
  inputBase, thStyle, tdStyle,
  TROOP_COLORS, tgBadgeColor, langName, DAY_SHORT,
  modalBackdrop, modalContent, modalContentCentered,
} from './allianceCenterConstants';
import type { SortKey, SortDir } from './allianceCenterConstants';
import AllianceCenterOnboarding from './AllianceCenterOnboarding';
import CreateAllianceForm from './CreateAllianceForm';
import AllianceChartsSection from './AllianceChartsSection';
import ApplicationsInbox from './ApplicationsInbox';
import AddMemberModal from './AddMemberModal';
import ImportMembersModal from './ImportMembersModal';
import TransferOwnershipModal from './TransferOwnershipModal';
import ManagerModal from './ManagerModal';
import EditMemberModal from './EditMemberModal';
import ToolGrantBanner from '../shared/ToolGrantBanner';
import AvailTooltip from './AvailTooltip';
import { logAllianceActivity } from './logAllianceActivity';
import AllianceActivityLog from './AllianceActivityLog';

const AllianceDashboard: React.FC = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { showToast } = useToast();
  const { user: authUser, profile: authProfile } = useAuth();
  const ac = useAllianceCenter();
  const queryClient = useQueryClient();
  const { hasAccess, reason, grantedBy, isTrial, expiresAt } = useToolAccess();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditAlliance, setShowEditAlliance] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showManagers, setShowManagers] = useState(false);
  const [editingMember, setEditingMember] = useState<AllianceMember | null>(null);
  const [editTag, setEditTag] = useState('');
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [memberFilter, setMemberFilter] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [confirmRemoveMember, setConfirmRemoveMember] = useState<AllianceMember | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [appsExpanded, setAppsExpanded] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [showBulkTroop, setShowBulkTroop] = useState(false);
  const [bulkInfTier, setBulkInfTier] = useState<number | null>(null);
  const [bulkCavTier, setBulkCavTier] = useState<number | null>(null);
  const [bulkArcTier, setBulkArcTier] = useState<number | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const bulkDialogRef = useRef<HTMLDivElement>(null);

  // Global Escape key handler for inline modals
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showDeleteConfirm) { setShowDeleteConfirm(false); return; }
      if (confirmRemoveMember) { setConfirmRemoveMember(null); return; }
      if (showEditAlliance) { setShowEditAlliance(false); return; }
      if (showBulkTroop) { setShowBulkTroop(false); return; }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showDeleteConfirm, confirmRemoveMember, showEditAlliance, showBulkTroop]);

  // Pending application count for the collapsible header badge
  const { data: pendingAppCount = 0 } = useQuery({
    queryKey: ['alliance-pending-apps-count', ac.alliance?.id],
    queryFn: async () => {
      if (!isSupabaseConfigured || !supabase || !ac.alliance) return 0;
      const { count } = await supabase
        .from('alliance_applications')
        .select('id', { count: 'exact', head: true })
        .eq('alliance_id', ac.alliance.id)
        .eq('status', 'pending');
      return count ?? 0;
    },
    enabled: !!ac.alliance && ac.canManage,
    staleTime: 30 * 1000,
  });

  // Fetch availability summary per member (includes per-day detail for tooltip)
  const { data: availSummary = new Map<string, { days: number; slots: number; byDay: { day: number; slots: string[] }[] }>() } = useQuery({
    queryKey: ['alliance-avail-summary', ac.alliance?.id],
    queryFn: async () => {
      if (!isSupabaseConfigured || !supabase || !ac.alliance) return new Map();
      const { data, error } = await supabase
        .from('alliance_event_availability')
        .select('member_name, day_of_week, time_slots')
        .eq('alliance_id', ac.alliance.id);
      if (error || !data) return new Map();
      const map = new Map<string, { days: number; slots: number; byDay: { day: number; slots: string[] }[] }>();
      data.forEach((row: { member_name: string; day_of_week: number; time_slots: string[] }) => {
        const existing = map.get(row.member_name) || { days: 0, slots: 0, byDay: [] };
        existing.days += 1;
        existing.slots += (row.time_slots?.length || 0);
        existing.byDay.push({ day: row.day_of_week, slots: row.time_slots || [] });
        map.set(row.member_name, existing);
      });
      return map;
    },
    enabled: !!ac.alliance,
    staleTime: 2 * 60 * 1000,
  });

  // Memoize player profiles map for member rows
  const profilesMap = useMemo(() => ac.playerProfiles, [ac.playerProfiles]);

  const handleDeleteAlliance = useCallback(async () => {
    setDeleting(true);
    const result = await ac.deleteAlliance();
    setDeleting(false);
    setShowDeleteConfirm(false);
    if (result.success) { showToast(t('allianceCenter.deleted', 'Alliance center deleted'), 'success'); }
    else { showToast(result.error || t('allianceCenter.deleteFailed', 'Failed to delete'), 'error'); }
  }, [ac, showToast, t]);

  const handleEditSave = useCallback(async () => {
    const result = await ac.updateAlliance({ tag: editTag, name: editName, description: editDesc });
    if (result.success) {
      setShowEditAlliance(false);
      showToast(t('allianceCenter.updated', 'Alliance updated'), 'success');
      if (ac.alliance && authUser) {
        logAllianceActivity({
          allianceId: ac.alliance.id,
          actorUserId: authUser.id,
          actorName: (authProfile as { linked_username?: string; display_name?: string; username?: string } | null)?.linked_username || (authProfile as { display_name?: string; username?: string } | null)?.display_name || (authProfile as { username?: string } | null)?.username || 'Unknown',
          action: 'alliance_updated',
          details: { tag: editTag, name: editName },
        });
      }
    } else { showToast(result.error || t('allianceCenter.updateFailed', 'Failed to update'), 'error'); }
  }, [ac, editTag, editName, editDesc, showToast, t, authUser, authProfile]);

  // Bulk troop tier update handler
  const handleBulkTroopSave = useCallback(async () => {
    if (bulkSelected.size === 0) return;
    setBulkSaving(true);
    let success = 0;
    for (const memberId of bulkSelected) {
      const updates: Record<string, number | null> = {};
      if (bulkInfTier !== null) updates.infantry_tier = bulkInfTier;
      if (bulkCavTier !== null) updates.cavalry_tier = bulkCavTier;
      if (bulkArcTier !== null) updates.archers_tier = bulkArcTier;
      if (Object.keys(updates).length === 0) continue;
      const result = await ac.updateMember(memberId, updates);
      if (result.success) success++;
    }
    setBulkSaving(false);
    if (success > 0) {
      showToast(t('allianceCenter.bulkUpdated', '{{count}} members updated', { count: success }), 'success');
      if (ac.alliance && authUser) {
        logAllianceActivity({
          allianceId: ac.alliance.id,
          actorUserId: authUser.id,
          actorName: (authProfile as { linked_username?: string; display_name?: string; username?: string } | null)?.linked_username || (authProfile as { display_name?: string; username?: string } | null)?.display_name || (authProfile as { username?: string } | null)?.username || 'Unknown',
          action: 'member_updated',
          details: { bulk: true, count: success, infantry_tier: bulkInfTier, cavalry_tier: bulkCavTier, archers_tier: bulkArcTier },
        });
      }
    }
    setShowBulkTroop(false);
    setBulkSelected(new Set());
    setBulkInfTier(null); setBulkCavTier(null); setBulkArcTier(null);
  }, [bulkSelected, bulkInfTier, bulkCavTier, bulkArcTier, ac, showToast, t, authUser, authProfile]);

  const toggleBulkSelect = (id: string) => {
    setBulkSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleBulkSelectAll = () => {
    if (bulkSelected.size === filtered.length) setBulkSelected(new Set());
    else setBulkSelected(new Set(filtered.map(m => m.id)));
  };

  // Build enriched + filtered + sorted list (MUST be above early returns — Rules of Hooks)
  const filtered = useMemo(() => {
    const base = ac.sortedMembers.filter(m =>
      !memberFilter || m.player_name.toLowerCase().includes(memberFilter.toLowerCase()) ||
      (m.player_id && m.player_id.includes(memberFilter))
    );
    const getVal = (m: AllianceMember): string | number => {
      const prof = m.player_id ? profilesMap.get(m.player_id) : undefined;
      const apiData = m.player_id ? ac.apiPlayerData.get(m.player_id) : undefined;
      const regTroop = m.player_id ? ac.registryTroopData.get(m.player_id) : undefined;
      const tcLevel = prof?.linked_tc_level ?? apiData?.town_center_level ?? 0;
      switch (sortKey) {
        case 'name': return m.player_name.toLowerCase();
        case 'id': return m.player_id || '';
        case 'tc': return tcLevel;
        case 'infantry': return m.infantry_tier ?? regTroop?.infantry_tier ?? 0;
        case 'cavalry': return m.cavalry_tier ?? regTroop?.cavalry_tier ?? 0;
        case 'archers': return m.archers_tier ?? regTroop?.archers_tier ?? 0;
        case 'lang': return prof?.language || 'zzz';
        case 'avail': return availSummary.get(m.player_name)?.slots ?? 0;
        default: return m.player_name.toLowerCase();
      }
    };
    return [...base].sort((a, b) => {
      const va = getVal(a), vb = getVal(b);
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [ac.sortedMembers, memberFilter, sortKey, sortDir, profilesMap, ac.apiPlayerData, ac.registryTroopData, availSummary]);

  // ─── CSV Export ───
  const handleExportCSV = useCallback(() => {
    if (!ac.alliance || filtered.length === 0) return;
    const escCSV = (v: string) => {
      if (v.includes(',') || v.includes('"') || v.includes('\n')) return `"${v.replace(/"/g, '""')}"`;
      return v;
    };
    const header = ['Player Name', 'Player ID', 'TC Level', 'TG', 'Infantry', 'Cavalry', 'Archers', 'Language', 'Availability'];
    const rows = filtered.map(m => {
      const prof = m.player_id ? profilesMap.get(m.player_id) : undefined;
      const apiData = m.player_id ? ac.apiPlayerData.get(m.player_id) : undefined;
      const regTroop = m.player_id ? ac.registryTroopData.get(m.player_id) : undefined;
      const tcLevel = prof?.linked_tc_level ?? apiData?.town_center_level ?? null;
      const tgLabel = tcLevelToTG(tcLevel) || '';
      const fmtTroop = (manual: number | null, manualTg: number | null, reg: number | undefined, regTg: number | undefined) => {
        const tier = manual ?? reg ?? null;
        const tg = manual ? manualTg : (regTg ?? null);
        if (!tier) return '';
        return tg != null && tg > 0 ? `T${tier}/TG${tg}` : `T${tier}`;
      };
      const lang = prof ? (langName(prof.language) || '') : '';
      const avail = availSummary.get(m.player_name);
      const availStr = avail
        ? avail.byDay.map((d: { day: number; slots: string[] }) => `${DAY_SHORT[d.day]}:${d.slots.length}`).join(' ')
        : 'No';
      return [
        escCSV(m.player_name),
        m.player_id || '',
        tcLevel != null ? String(tcLevel) : '',
        tgLabel,
        fmtTroop(m.infantry_tier, m.infantry_tg, regTroop?.infantry_tier, regTroop?.infantry_tg),
        fmtTroop(m.cavalry_tier, m.cavalry_tg, regTroop?.cavalry_tier, regTroop?.cavalry_tg),
        fmtTroop(m.archers_tier, m.archers_tg, regTroop?.archers_tier, regTroop?.archers_tg),
        escCSV(lang),
        availStr,
      ].join(',');
    });
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ac.alliance.tag}_roster_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(t('allianceCenter.csvExported', 'Roster exported to CSV'), 'success');
  }, [ac.alliance, filtered, profilesMap, ac.apiPlayerData, ac.registryTroopData, availSummary, showToast, t]);

  // Loading state — show spinner FIRST to prevent create form flash for returning users
  if (ac.allianceLoading) {
    return (
      <div style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>{t('common.loading', 'Loading...')}</div>
      </div>
    );
  }

  // No alliance — show delegate message, create form, or onboarding flow
  if (!ac.alliance) {
    if (ac.accessRole === 'delegate' || reason === 'delegate') {
      return (
        <div style={{ minHeight: '50vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🤝</div>
          <h2 style={{ color: '#fff', fontSize: '1.25rem', marginBottom: '0.5rem' }}>
            {t('allianceCenter.delegateNoAlliance', 'Your delegator hasn\'t set up their Alliance Center yet')}
          </h2>
          <p style={{ color: '#6b7280', fontSize: '0.85rem', maxWidth: '400px' }}>
            {t('allianceCenter.delegateNoAllianceDesc', 'Ask {{name}} to create their Alliance Center so you can help manage it.', { name: grantedBy || 'your delegator' })}
          </p>
        </div>
      );
    }
    if (showCreateForm && hasAccess) {
      return <CreateAllianceForm onCreated={() => window.location.reload()} createAlliance={ac.createAlliance} />;
    }
    return (
      <AllianceCenterOnboarding
        hasAccess={hasAccess}
        reason={reason}
        onShowCreate={() => setShowCreateForm(true)}
      />
    );
  }

  const alliance = ac.alliance!;
  const roleLabel = ac.isOwner ? 'Owner' : ac.isManager ? 'Manager' : ac.accessRole === 'delegate' ? 'Delegate' : ac.accessRole === 'member' ? 'Member' : '';
  const isMemberOnly = ac.accessRole === 'member';

  // Sort toggle
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };
  const sortArrow = (key: SortKey) => sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: isMobile ? '0.5rem' : '1rem' }}>
      {reason === 'tool_grant' && <ToolGrantBanner toolId="alliance_center" toolLabel={t('tools.allianceCenter', 'Alliance Center')} hasGrant={hasAccess} isTrial={!!isTrial} expiresAt={expiresAt ?? null} accentColor="#a855f7" />}
      {/* Alliance Header */}
      <div style={{
        backgroundColor: '#111111', borderRadius: '16px', border: `1px solid ${ACCENT_BORDER}`,
        padding: isMobile ? '1.25rem' : '1.5rem', marginBottom: '1.5rem',
        background: `linear-gradient(135deg, #111111 0%, ${ACCENT_DIM} 100%)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
              <span style={{ padding: '0.2rem 0.5rem', backgroundColor: ACCENT + '20', border: `1px solid ${ACCENT}40`, borderRadius: '4px', fontSize: '0.7rem', fontWeight: '800', color: ACCENT, fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                [{alliance.tag}]
              </span>
              <h2 style={{ color: '#fff', fontSize: isMobile ? '1.1rem' : '1.3rem', fontWeight: '700', margin: 0, fontFamily: FONT_DISPLAY }}>
                {alliance.name}
              </h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
              <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>K{alliance.kingdom_number}</span>
              <span style={{ color: '#4b5563', fontSize: '0.6rem' }}>•</span>
              <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>{ac.memberCount}/{ac.maxMembers} members</span>
              <span style={{ color: '#4b5563', fontSize: '0.6rem' }}>•</span>
              <span style={{
                fontSize: '0.65rem', fontWeight: '700', padding: '0.1rem 0.35rem', borderRadius: '3px',
                backgroundColor: ac.isOwner ? '#fbbf2420' : ac.isManager ? '#a855f720' : '#22d3ee20',
                color: ac.isOwner ? '#fbbf24' : ac.isManager ? '#a855f7' : '#22d3ee',
              }}>{roleLabel}</span>
              {ac.accessRole === 'delegate' && grantedBy && (
                <span style={{ color: '#22d3ee', fontSize: '0.7rem' }}>of {grantedBy}</span>
              )}
            </div>
            {alliance.description && (
              <p style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: '0.5rem', lineHeight: 1.4 }}>{alliance.description}</p>
            )}
          </div>

          {ac.canManage && (
            <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0, flexWrap: 'wrap' }}>
              <button onClick={() => { setEditTag(alliance.tag); setEditName(alliance.name); setEditDesc(alliance.description || ''); setShowEditAlliance(true); }}
                style={{ padding: '0.35rem 0.6rem', backgroundColor: '#1a1a20', border: '1px solid #2a2a2a', borderRadius: '6px', color: '#9ca3af', fontSize: '0.7rem', cursor: 'pointer' }}>
                ✏️ Edit
              </button>
              {ac.isOwner && (
                <>
                  <button onClick={() => setShowTransfer(true)}
                    style={{ padding: '0.35rem 0.6rem', backgroundColor: '#f59e0b10', border: '1px solid #f59e0b30', borderRadius: '6px', color: '#f59e0b', fontSize: '0.7rem', cursor: 'pointer' }}>
                    🔄 Transfer
                  </button>
                  <button onClick={() => setShowManagers(true)}
                    style={{ padding: '0.35rem 0.6rem', backgroundColor: '#a855f710', border: '1px solid #a855f730', borderRadius: '6px', color: '#a855f7', fontSize: '0.7rem', cursor: 'pointer' }}>
                    ⚙️ Managers ({ac.managers.length}/{ac.maxManagers})
                  </button>
                  <button onClick={() => setShowDeleteConfirm(true)}
                    style={{ padding: '0.35rem 0.6rem', backgroundColor: '#ef444410', border: '1px solid #ef444430', borderRadius: '6px', color: '#ef4444', fontSize: '0.7rem', cursor: 'pointer' }}>
                    🗑️
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        {/* Alliance Tools Row */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #ffffff10', flexWrap: 'wrap' }}>
          <Link to="/tools/event-coordinator" style={{
            textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.4rem 0.75rem', backgroundColor: '#3b82f610', border: '1px solid #3b82f625',
            borderRadius: '8px', color: '#3b82f6', fontSize: '0.75rem', fontWeight: 600, transition: 'border-color 0.15s',
            minHeight: isMobile ? '44px' : undefined, WebkitTapHighlightColor: 'transparent',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#3b82f6'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#3b82f625'; }}>
            📅 {t('allianceCenter.eventCoordinatorLink', 'Event Coordinator')}
          </Link>
          <Link to="/tools/base-designer/about" style={{
            textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.4rem 0.75rem', backgroundColor: '#3b82f610', border: '1px solid #3b82f625',
            borderRadius: '8px', color: '#3b82f6', fontSize: '0.75rem', fontWeight: 600, transition: 'border-color 0.15s',
            minHeight: isMobile ? '44px' : undefined, WebkitTapHighlightColor: 'transparent',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#3b82f6'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#3b82f625'; }}>
            🏰 {t('allianceCenter.baseDesignerLink', 'Base Designer')}
          </Link>
          <Link to="/tools/bear-rally-tier-list" style={{
            textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.4rem 0.75rem', backgroundColor: '#3b82f610', border: '1px solid #3b82f625',
            borderRadius: '8px', color: '#3b82f6', fontSize: '0.75rem', fontWeight: 600, transition: 'border-color 0.15s',
            minHeight: isMobile ? '44px' : undefined, WebkitTapHighlightColor: 'transparent',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#3b82f6'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#3b82f625'; }}>
            🐻 {t('allianceCenter.bearRallyLink', 'Bear Rally Tier List')}
          </Link>
        </div>
      </div>

      {/* Applications Inbox (managers only — collapsible) */}
      {ac.alliance && ac.canManage && (
        <div style={{
          backgroundColor: '#111111', borderRadius: '12px', border: '1px solid #a855f720',
          marginBottom: '1rem', overflow: 'hidden',
        }}>
          <button
            onClick={() => setAppsExpanded(prev => !prev)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: isMobile ? '0.75rem' : '0.85rem 1rem',
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#fff', fontFamily: FONT_DISPLAY, WebkitTapHighlightColor: 'transparent',
              minHeight: isMobile ? '44px' : undefined,
            }}
          >
            <span style={{ fontSize: '0.9rem' }}>📩</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>
              {t('allianceCenter.applicationsTitle', 'Applications')}
            </span>
            {pendingAppCount > 0 && (
              <span style={{
                fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '10px',
                backgroundColor: '#a855f720', color: '#a855f7', fontFamily: 'monospace',
              }}>{pendingAppCount}</span>
            )}
            <span style={{
              marginLeft: 'auto', fontSize: '0.7rem', color: '#6b7280',
              transform: appsExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
            }}>▼</span>
          </button>
          {appsExpanded && (
            <ApplicationsInbox
              allianceId={ac.alliance.id}
              canManage={ac.canManage}
              isMobile={isMobile}
              onResolved={() => {
                queryClient.invalidateQueries({ queryKey: ['alliance-members', ac.alliance?.id] });
                queryClient.invalidateQueries({ queryKey: ['alliance-pending-apps-count', ac.alliance?.id] });
              }}
            />
          )}
        </div>
      )}

      {/* Recent Activity Log (collapsible) */}
      {ac.alliance && (
        <AllianceActivityLog allianceId={ac.alliance.id} isMobile={isMobile} />
      )}

      {/* Alliance Charts — Distribution Analytics */}
      {ac.memberCount >= 3 && (
        <AllianceChartsSection members={filtered} profilesMap={profilesMap} apiPlayerData={ac.apiPlayerData} registryTroopData={ac.registryTroopData} allianceId={alliance.id} isMobile={isMobile} t={t} />
      )}

      {/* Alliance Roster — Full Width */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1rem' }}>👥</span>
          <h3 style={{ color: '#fff', fontSize: '0.95rem', fontWeight: '700', margin: 0, fontFamily: FONT_DISPLAY }}>
            {t('allianceCenter.rosterTitle', 'Alliance Roster')}
          </h3>
          {ac.memberCount > 0 && (
            <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '10px', backgroundColor: ac.apiPlayerDataLoading ? '#f59e0b20' : '#22d3ee20', color: ac.apiPlayerDataLoading ? '#f59e0b' : '#22d3ee', fontFamily: 'monospace', letterSpacing: '0.03em' }}>
              {ac.apiPlayerDataLoading
                ? t('allianceCenter.resolving', 'Resolving...')
                : (() => {
                    const resolved = filtered.filter(m => !m.player_id || profilesMap.get(m.player_id) || ac.apiPlayerData.get(m.player_id)).length;
                    return `${resolved}/${ac.memberCount}`;
                  })()}
            </span>
          )}
          <div style={{ flex: 1, height: '1px', backgroundColor: ACCENT + '30', marginLeft: '0.25rem' }} />
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            {ac.memberCount > 0 && (
              <button onClick={handleExportCSV}
                style={{ padding: isMobile ? '0.4rem 0.6rem' : '0.25rem 0.5rem', minHeight: isMobile ? '44px' : 'auto', backgroundColor: '#f59e0b10', border: '1px solid #f59e0b25', borderRadius: '6px', color: '#f59e0b', fontSize: '0.65rem', fontWeight: '600', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
                📤 {t('allianceCenter.exportCSV', 'Export CSV')}
              </button>
            )}
            {ac.canManage && (
              <button onClick={() => ac.refreshApiPlayerData()} disabled={ac.apiPlayerDataLoading}
                style={{ padding: isMobile ? '0.4rem 0.6rem' : '0.25rem 0.5rem', minHeight: isMobile ? '44px' : 'auto', backgroundColor: '#10b98115', border: '1px solid #10b98130', borderRadius: '6px', color: '#10b981', fontSize: '0.65rem', fontWeight: '600', cursor: ac.apiPlayerDataLoading ? 'wait' : 'pointer', opacity: ac.apiPlayerDataLoading ? 0.5 : 1, WebkitTapHighlightColor: 'transparent' }}>
                🔄 {t('allianceCenter.refreshData', 'Refresh')}
              </button>
            )}
            {ac.canManage && (
              <>
                <button onClick={() => setShowImport(true)} disabled={!ac.canAddMember}
                  style={{ padding: isMobile ? '0.4rem 0.6rem' : '0.25rem 0.5rem', minHeight: isMobile ? '44px' : 'auto', backgroundColor: '#22d3ee15', border: '1px solid #22d3ee30', borderRadius: '6px', color: '#22d3ee', fontSize: '0.65rem', fontWeight: '600', cursor: ac.canAddMember ? 'pointer' : 'not-allowed', opacity: ac.canAddMember ? 1 : 0.5, WebkitTapHighlightColor: 'transparent' }}>
                  📋 Import IDs
                </button>
                <button onClick={() => setShowAddMember(true)} disabled={!ac.canAddMember}
                  style={{ padding: isMobile ? '0.4rem 0.6rem' : '0.25rem 0.6rem', minHeight: isMobile ? '44px' : 'auto', backgroundColor: ACCENT + '15', border: `1px solid ${ACCENT}30`, borderRadius: '6px', color: ACCENT, fontSize: '0.7rem', fontWeight: '600', cursor: ac.canAddMember ? 'pointer' : 'not-allowed', opacity: ac.canAddMember ? 1 : 0.5, WebkitTapHighlightColor: 'transparent' }}>
                  + {t('allianceCenter.addMember', 'Add Member')}
                </button>
              </>
            )}
          </div>
        </div>
        {/* Search bar + bulk actions */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="text" value={memberFilter} onChange={e => setMemberFilter(e.target.value)}
            placeholder={t('allianceCenter.searchMembers', 'Search by name or ID...')}
            style={{ ...inputBase, fontSize: isMobile ? '1rem' : '0.8rem', padding: isMobile ? '0.5rem 0.7rem' : '0.4rem 0.6rem', flex: 1, minWidth: '160px' }} />
          {ac.canManage && filtered.length > 1 && (
            <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', fontSize: isMobile ? '0.75rem' : '0.65rem', color: '#9ca3af', whiteSpace: 'nowrap', minHeight: isMobile ? '44px' : 'auto', padding: isMobile ? '0 0.25rem' : '0' }}>
                <input type="checkbox" checked={bulkSelected.size === filtered.length && filtered.length > 0} onChange={toggleBulkSelectAll} style={{ accentColor: '#a855f7', width: isMobile ? '18px' : '14px', height: isMobile ? '18px' : '14px' }} />
                {t('allianceCenter.selectAll', 'Select All')} ({bulkSelected.size})
              </label>
              {bulkSelected.size > 0 && (
                <button onClick={() => setShowBulkTroop(true)} style={{
                  padding: isMobile ? '0.4rem 0.6rem' : '0.25rem 0.5rem', minHeight: isMobile ? '44px' : 'auto',
                  fontSize: '0.65rem', fontWeight: 600, borderRadius: '6px',
                  backgroundColor: '#a855f715', border: '1px solid #a855f730', color: '#a855f7',
                  cursor: 'pointer', whiteSpace: 'nowrap', WebkitTapHighlightColor: 'transparent',
                }}>
                  {t('allianceCenter.bulkEditTroops', 'Batch Edit Troops')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* API status banners */}
        {ac.apiPlayerDataError && !ac.apiPlayerDataLoading && (
          <div style={{ padding: '0.5rem 0.75rem', marginBottom: '0.5rem', backgroundColor: '#ef444410', border: '1px solid #ef444425', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem' }}>⚠️</span>
            <span style={{ color: '#f87171', fontSize: '0.75rem' }}>
              {t('allianceCenter.apiUnavailable', 'Player data service unavailable — showing cached data where available.')}
            </span>
          </div>
        )}
        {ac.apiPlayerDataLoading && ac.memberCount > 0 && (
          <div style={{ padding: '0.4rem 0.75rem', marginBottom: '0.5rem', backgroundColor: '#f59e0b08', border: '1px solid #f59e0b15', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ display: 'inline-block', width: '10px', height: '10px', border: '2px solid #f59e0b40', borderTop: '2px solid #f59e0b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ color: '#f59e0b', fontSize: '0.75rem' }}>
              {t('allianceCenter.resolvingData', 'Resolving player data from game server...')}
            </span>
          </div>
        )}
        {!ac.apiPlayerDataLoading && !ac.apiPlayerDataError && ac.canManage && ac.memberCount > 0 && (() => {
          const unresolvedCount = filtered.filter(m => m.player_id && !profilesMap.get(m.player_id) && !ac.apiPlayerData.get(m.player_id)).length;
          return unresolvedCount > 0 ? (
            <div style={{ padding: '0.4rem 0.75rem', marginBottom: '0.5rem', backgroundColor: '#6366f108', border: '1px solid #6366f115', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.7rem' }}>💡</span>
              <span style={{ color: '#818cf8', fontSize: '0.7rem' }}>
                {t('allianceCenter.unresolvedHint', '{{count}} member(s) not yet resolved. Click 🔄 Refresh to fetch data from game server.', { count: unresolvedCount })}
              </span>
            </div>
          ) : null;
        })()}

        {/* Roster */}
        {ac.membersLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{ backgroundColor: '#111116', borderRadius: '10px', border: '1px solid #1e1e24', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <div style={{ width: '120px', height: '14px', backgroundColor: '#1a1a24', borderRadius: '3px', animation: 'pulse 1.5s ease-in-out infinite' }} />
                  <div style={{ width: '60px', height: '12px', backgroundColor: '#1a1a24', borderRadius: '3px', animation: 'pulse 1.5s ease-in-out 0.2s infinite' }} />
                </div>
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <div style={{ width: '50px', height: '12px', backgroundColor: '#1a1a24', borderRadius: '3px', animation: 'pulse 1.5s ease-in-out 0.4s infinite' }} />
                  <div style={{ width: '50px', height: '12px', backgroundColor: '#1a1a24', borderRadius: '3px', animation: 'pulse 1.5s ease-in-out 0.6s infinite' }} />
                  <div style={{ width: '50px', height: '12px', backgroundColor: '#1a1a24', borderRadius: '3px', animation: 'pulse 1.5s ease-in-out 0.8s infinite' }} />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#111116', borderRadius: '10px', border: '1px dashed #2a2a2a' }}>
            {ac.memberCount === 0 && (
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ margin: '0 auto 0.75rem', display: 'block', opacity: 0.5 }}>
                <circle cx="22" cy="22" r="10" stroke="#4b5563" strokeWidth="2" fill="none" />
                <circle cx="22" cy="19" r="3" fill="#4b5563" />
                <path d="M15 28c0-4 3-6 7-6s7 2 7 6" stroke="#4b5563" strokeWidth="2" fill="none" />
                <circle cx="42" cy="22" r="10" stroke="#6b7280" strokeWidth="2" strokeDasharray="4 3" fill="none" />
                <line x1="38" y1="22" x2="46" y2="22" stroke="#6b7280" strokeWidth="2" />
                <line x1="42" y1="18" x2="42" y2="26" stroke="#6b7280" strokeWidth="2" />
                <rect x="12" y="42" width="40" height="14" rx="4" stroke="#4b5563" strokeWidth="2" fill="none" strokeDasharray="4 3" />
                <line x1="20" y1="47" x2="44" y2="47" stroke="#4b5563" strokeWidth="1.5" opacity="0.5" />
                <line x1="20" y1="51" x2="36" y2="51" stroke="#4b5563" strokeWidth="1.5" opacity="0.3" />
              </svg>
            )}
            <p style={{ color: '#4b5563', fontSize: '0.85rem', margin: 0 }}>
              {ac.memberCount === 0
                ? t('allianceCenter.noMembers', 'No members yet. Add your alliance roster to get started.')
                : t('allianceCenter.noResults', 'No members match your filter.')}
            </p>
          </div>
        ) : isMobile ? (
          /* ─── Mobile Card Layout ─── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {/* Mobile sort bar */}
            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
              {([['name', 'Name'], ['tc', 'TC'], ['infantry', 'Inf'], ['cavalry', 'Cav'], ['archers', 'Arc'], ['lang', 'Lang']] as [SortKey, string][]).map(([key, label]) => (
                <button key={key} onClick={() => toggleSort(key)} style={{
                  padding: '0.2rem 0.45rem', fontSize: '0.6rem', fontWeight: 600, borderRadius: '4px', border: 'none', cursor: 'pointer',
                  backgroundColor: sortKey === key ? ACCENT + '25' : '#1a1a20', color: sortKey === key ? ACCENT : '#6b7280',
                }}>{label}{sortArrow(key)}</button>
              ))}
            </div>
            {filtered.map((m) => {
              const prof = m.player_id ? profilesMap.get(m.player_id) : undefined;
              const apiData = m.player_id ? ac.apiPlayerData.get(m.player_id) : undefined;
              const regTroop = m.player_id ? ac.registryTroopData.get(m.player_id) : undefined;
              const avail = availSummary.get(m.player_name);
              const tcLevel = prof?.linked_tc_level ?? apiData?.town_center_level ?? null;
              const tgLabel = tcLevelToTG(tcLevel);
              const tgColors = tgLabel ? tgBadgeColor(tgLabel) : null;
              const isNotInAtlas = m.player_id && !prof;
              const isOwnRow = ac.currentMemberId === m.id;
              const isRemoving = removingMemberId === m.id;
              const lang = prof ? langName(prof.language) : null;

              const renderTroopMobile = (label: string, manualTier: number | null, manualTg: number | null, regTier: number | undefined, regTg: number | undefined, color: string) => {
                const tier = manualTier ?? regTier ?? null;
                const tg = manualTier ? manualTg : (regTg ?? null);
                const fromReg = !manualTier && regTier != null;
                if (!tier) return null;
                const text = tg != null && tg > 0 ? `T${tier}/TG${tg}` : `T${tier}`;
                return (
                  <span style={{ color: fromReg ? color + 'aa' : color, fontSize: '0.7rem', fontWeight: 600 }}>
                    {label}: {text}{fromReg && <sup style={{ fontSize: '0.45rem', opacity: 0.6 }}>R</sup>}
                  </span>
                );
              };

              return (
                <div key={m.id} style={{
                  backgroundColor: isOwnRow ? '#111120' : '#111116', borderRadius: '10px', border: `1px solid ${isOwnRow ? '#3b82f625' : '#1e1e24'}`,
                  padding: '0.75rem', transition: 'background-color 0.1s',
                }}>
                  {/* Row 1: Username + TC badge + Player ID (top-right) */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.3rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flex: 1, minWidth: 0 }}>
                      {isNotInAtlas && (
                        <span
                          title={apiData
                            ? t('allianceCenter.notInAtlasResolved', 'Not an Atlas user — resolved from game server')
                            : ac.apiPlayerDataLoading
                              ? t('allianceCenter.resolvingPlayer', 'Resolving player data...')
                              : t('allianceCenter.unknownPlayer', 'Unknown player — not found in Atlas or game server')}
                          style={{ cursor: 'help', width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, display: 'inline-block', backgroundColor: apiData ? '#f59e0b' : ac.apiPlayerDataLoading ? '#6b7280' : '#ef4444' }}
                        />
                      )}
                      {prof ? (
                        <Link to={`/profile/${prof.user_id}`} style={{ color: '#e5e7eb', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          onMouseOver={e => (e.currentTarget.style.color = ACCENT)} onMouseOut={e => (e.currentTarget.style.color = '#e5e7eb')}>
                          {m.player_name}
                        </Link>
                      ) : ac.apiPlayerDataLoading && /^Player \d+$/.test(m.player_name) ? (
                        <span style={{ color: '#9ca3af', fontWeight: 600, fontSize: '0.85rem', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.player_name} <span style={{ color: '#f59e0b', fontSize: '0.65rem', animation: 'pulse 1.5s ease-in-out infinite' }}>{t('allianceCenter.resolvingInline', '(resolving...)')}</span>
                        </span>
                      ) : (
                        <span style={{ color: '#e5e7eb', fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.player_name}</span>
                      )}
                      {isOwnRow && <span style={{ fontSize: '0.5rem', fontWeight: 700, padding: '0.05rem 0.2rem', borderRadius: '3px', backgroundColor: '#3b82f625', color: '#3b82f6', flexShrink: 0 }}>YOU</span>}
                      {tgLabel && tgColors && <span style={{ fontSize: '0.55rem', fontWeight: 700, padding: '0.05rem 0.25rem', borderRadius: '3px', backgroundColor: tgColors.bg, color: tgColors.fg, flexShrink: 0 }}>{tgLabel}</span>}
                    </div>
                    <span style={{ color: '#4b5563', fontFamily: 'monospace', fontSize: '0.65rem', flexShrink: 0 }}>{m.player_id || '—'}</span>
                  </div>
                  {/* Row 2: Inf + Cav + Arc */}
                  <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                    {renderTroopMobile('Inf', m.infantry_tier, m.infantry_tg, regTroop?.infantry_tier, regTroop?.infantry_tg, TROOP_COLORS.infantry)}
                    {renderTroopMobile('Cav', m.cavalry_tier, m.cavalry_tg, regTroop?.cavalry_tier, regTroop?.cavalry_tg, TROOP_COLORS.cavalry)}
                    {renderTroopMobile('Arc', m.archers_tier, m.archers_tg, regTroop?.archers_tier, regTroop?.archers_tg, TROOP_COLORS.archers)}
                  </div>
                  {/* Row 3: Main Language */}
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.3rem' }}>
                    <span style={{ fontSize: '0.65rem', color: '#6b7280' }}>
                      {lang
                        ? <>{t('allianceCenter.mainLanguage', 'Main Language')}: <span style={{ color: '#9ca3af', fontWeight: 600 }}>{lang}</span></>
                        : <span style={{ color: '#3a3a40' }}>—</span>
                      }
                    </span>
                  </div>
                  {/* Row 4: Availability + Edit + Delete */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.65rem', color: '#6b7280' }}>
                        {t('allianceCenter.availability', 'Availability')}:{' '}
                        {avail
                          ? <AvailTooltip avail={avail} t={t} />
                          : <span style={{ color: '#ef4444', fontWeight: 600, fontSize: '0.7rem' }}>{t('allianceCenter.availNo', 'No')}</span>
                        }
                      </span>
                      {isOwnRow && !avail && (
                        <Link to={`/tools/event-coordinator?member=${encodeURIComponent(m.player_name)}`}
                          style={{ fontSize: '0.6rem', color: '#3b82f6', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          📅 {t('allianceCenter.setAvailability', 'Set Availability')}
                        </Link>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      {ac.canManage ? (
                        <>
                          <button onClick={() => setEditingMember(m)} style={{ padding: '0.4rem 0.6rem', backgroundColor: '#1a1a24', border: '1px solid #2a2a2a', borderRadius: '6px', color: '#6b7280', fontSize: '0.7rem', cursor: 'pointer', minHeight: '44px', minWidth: '44px', WebkitTapHighlightColor: 'transparent' }} title="Edit">✏️</button>
                          <button onClick={() => setConfirmRemoveMember(m)} disabled={isRemoving} style={{ padding: '0.4rem 0.6rem', backgroundColor: '#1a1a24', border: '1px solid #ef444430', borderRadius: '6px', color: '#ef4444', fontSize: '0.7rem', cursor: isRemoving ? 'wait' : 'pointer', opacity: isRemoving ? 0.5 : 1, minHeight: '44px', minWidth: '44px', WebkitTapHighlightColor: 'transparent' }} title={t('common.remove', 'Remove')}>🗑️</button>
                        </>
                      ) : isOwnRow ? (
                        <button onClick={() => setEditingMember(m)} style={{ padding: '0.4rem 0.6rem', backgroundColor: '#1a1a24', border: `1px solid ${ACCENT}30`, borderRadius: '6px', color: ACCENT, fontSize: '0.7rem', cursor: 'pointer', minHeight: '44px', minWidth: '44px', WebkitTapHighlightColor: 'transparent' }} title="Edit my troops">✏️</button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ─── Desktop Table ─── */
          <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid #1e1e24' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#0d1117', borderBottom: '2px solid #2a2a2a' }}>
                  {ac.canManage && filtered.length > 1 && (
                    <th style={{ ...thStyle, width: '32px', textAlign: 'center' }}>
                      <input type="checkbox" checked={bulkSelected.size === filtered.length && filtered.length > 0} onChange={toggleBulkSelectAll} style={{ accentColor: '#a855f7', cursor: 'pointer' }} aria-label={t('allianceCenter.selectAll', 'Select All')} />
                    </th>
                  )}
                  <th style={{ ...thStyle, textAlign: 'left', cursor: 'pointer', userSelect: 'none', minWidth: '120px' }} onClick={() => toggleSort('name')}>Username{sortArrow('name')}</th>
                  <th style={{ ...thStyle, textAlign: 'left', cursor: 'pointer', userSelect: 'none', width: '90px' }} onClick={() => toggleSort('id')}>ID{sortArrow('id')}</th>
                  <th style={{ ...thStyle, cursor: 'pointer', userSelect: 'none', width: '52px' }} onClick={() => toggleSort('tc')}>TC{sortArrow('tc')}</th>
                  <th style={{ ...thStyle, color: TROOP_COLORS.infantry, cursor: 'pointer', userSelect: 'none', width: '78px' }} onClick={() => toggleSort('infantry')}>Inf{sortArrow('infantry')}</th>
                  <th style={{ ...thStyle, color: TROOP_COLORS.cavalry, cursor: 'pointer', userSelect: 'none', width: '78px' }} onClick={() => toggleSort('cavalry')}>Cav{sortArrow('cavalry')}</th>
                  <th style={{ ...thStyle, color: TROOP_COLORS.archers, cursor: 'pointer', userSelect: 'none', width: '78px' }} onClick={() => toggleSort('archers')}>Arc{sortArrow('archers')}</th>
                  <th style={{ ...thStyle, cursor: 'pointer', userSelect: 'none', width: '72px' }} onClick={() => toggleSort('lang')}>Lang{sortArrow('lang')}</th>
                  <th style={{ ...thStyle, cursor: 'pointer', userSelect: 'none', width: '56px' }} onClick={() => toggleSort('avail')}>Avail{sortArrow('avail')}</th>
                  {(ac.canManage || isMemberOnly) && <th style={{ ...thStyle, width: '56px' }}></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((m, idx) => {
                  const prof = m.player_id ? profilesMap.get(m.player_id) : undefined;
                  const apiData = m.player_id ? ac.apiPlayerData.get(m.player_id) : undefined;
                  const regTroop = m.player_id ? ac.registryTroopData.get(m.player_id) : undefined;
                  const avail = availSummary.get(m.player_name);
                  const tcLevel = prof?.linked_tc_level ?? apiData?.town_center_level ?? null;
                  const tgLabel = tcLevelToTG(tcLevel);
                  const tgColors = tgLabel ? tgBadgeColor(tgLabel) : null;
                  const isNotInAtlas = m.player_id && !prof;
                  const isRemoving = removingMemberId === m.id;
                  const isOwnRow = ac.currentMemberId === m.id;
                  const lang = prof ? langName(prof.language) : null;

                  const renderTroop = (manualTier: number | null, manualTg: number | null, regTier: number | undefined, regTg: number | undefined, color: string) => {
                    const tier = manualTier ?? regTier ?? null;
                    const tg = manualTier ? manualTg : (regTg ?? null);
                    const fromRegistry = !manualTier && regTier != null;
                    if (!tier) return <span style={{ color: '#3a3a40' }}>—</span>;
                    const label = tg != null && tg > 0 ? `T${tier}/TG${tg}` : `T${tier}`;
                    return (
                      <span style={{ color: fromRegistry ? color + 'aa' : color, fontSize: '0.75rem', fontWeight: 600 }} title={fromRegistry ? 'From Battle Registry' : undefined}>
                        {label}{fromRegistry && <span style={{ fontSize: '0.5rem', verticalAlign: 'super', opacity: 0.6 }}>R</span>}
                      </span>
                    );
                  };

                  return (
                    <tr key={m.id} style={{ borderBottom: '1px solid #1e1e24', backgroundColor: isOwnRow ? '#1a1a3020' : idx % 2 === 0 ? '#111116' : '#0d1117', transition: 'background-color 0.1s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1a1a24'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = isOwnRow ? '#1a1a3020' : idx % 2 === 0 ? '#111116' : '#0d1117'; }}>
                      {ac.canManage && filtered.length > 1 && (
                        <td style={{ ...tdStyle, textAlign: 'center', width: '32px' }}>
                          <input type="checkbox" checked={bulkSelected.has(m.id)} onChange={() => toggleBulkSelect(m.id)} style={{ accentColor: '#a855f7', cursor: 'pointer' }} aria-label={`Select ${m.player_name}`} />
                        </td>
                      )}
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                          {isNotInAtlas && (
                            <span
                              title={apiData
                                ? t('allianceCenter.notInAtlasResolved', 'Not an Atlas user — resolved from game server')
                                : ac.apiPlayerDataLoading
                                  ? t('allianceCenter.resolvingPlayer', 'Resolving player data...')
                                  : t('allianceCenter.unknownPlayer', 'Unknown player — not found in Atlas or game server')}
                              style={{ cursor: 'help', width: '6px', height: '6px', borderRadius: '50%', display: 'inline-block', flexShrink: 0, backgroundColor: apiData ? '#f59e0b' : ac.apiPlayerDataLoading ? '#6b7280' : '#ef4444' }}
                            />
                          )}
                          {prof ? (
                            <Link to={`/profile/${prof.user_id}`} style={{ color: '#e5e7eb', fontWeight: 500, textDecoration: 'none' }}
                              onMouseOver={e => (e.currentTarget.style.color = ACCENT)} onMouseOut={e => (e.currentTarget.style.color = '#e5e7eb')}>
                              {m.player_name}
                            </Link>
                          ) : ac.apiPlayerDataLoading && /^Player \d+$/.test(m.player_name) ? (
                            <span style={{ color: '#9ca3af', fontWeight: 500, fontStyle: 'italic' }}>
                              {m.player_name} <span style={{ color: '#f59e0b', fontSize: '0.65rem', animation: 'pulse 1.5s ease-in-out infinite' }}>{t('allianceCenter.resolvingInline', '(resolving...)')}</span>
                            </span>
                          ) : (
                            <span style={{ color: '#e5e7eb', fontWeight: 500 }}>{m.player_name}</span>
                          )}
                          {isOwnRow && (
                            <span style={{
                              fontSize: '0.55rem', fontWeight: 700, padding: '0.05rem 0.25rem', borderRadius: '3px',
                              backgroundColor: '#3b82f625', color: '#3b82f6', whiteSpace: 'nowrap',
                            }}>YOU</span>
                          )}
                        </div>
                        {m.notes && <div style={{ color: '#4b5563', fontSize: '0.65rem', marginTop: '0.1rem' }}>{m.notes}</div>}
                      </td>
                      <td style={tdStyle}>
                        <span style={{ color: '#6b7280', fontFamily: 'monospace', fontSize: '0.75rem' }}>{m.player_id || '—'}</span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {tgLabel && tgColors ? (
                          <span style={{
                            fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.35rem', borderRadius: '3px',
                            backgroundColor: tgColors.bg, color: tgColors.fg,
                          }}>{tgLabel}</span>
                        ) : <span style={{ color: '#3a3a40' }}>—</span>}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {renderTroop(m.infantry_tier, m.infantry_tg, regTroop?.infantry_tier, regTroop?.infantry_tg, TROOP_COLORS.infantry)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {renderTroop(m.cavalry_tier, m.cavalry_tg, regTroop?.cavalry_tier, regTroop?.cavalry_tg, TROOP_COLORS.cavalry)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {renderTroop(m.archers_tier, m.archers_tg, regTroop?.archers_tier, regTroop?.archers_tg, TROOP_COLORS.archers)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {lang ? <span style={{ color: '#9ca3af', fontSize: '0.7rem', fontWeight: 500 }}>{lang}</span> : <span style={{ color: '#3a3a40' }}>—</span>}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {avail ? (
                          <AvailTooltip avail={avail} t={t} />
                        ) : isOwnRow ? (
                          <Link to={`/tools/event-coordinator?member=${encodeURIComponent(m.player_name)}`}
                            style={{ color: '#3b82f6', fontSize: '0.6rem', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}
                            title={t('allianceCenter.setAvailability', 'Set Availability')}>
                            📅 {t('allianceCenter.setAvailabilityShort', 'Set')}
                          </Link>
                        ) : <span style={{ color: '#ef4444', fontSize: '0.7rem', fontWeight: 600 }}>{t('allianceCenter.availNo', 'No')}</span>}
                      </td>
                      {(ac.canManage || isMemberOnly) && (
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.15rem', justifyContent: 'center' }}>
                            {ac.canManage ? (
                              <>
                                <button onClick={() => setEditingMember(m)} style={{ padding: '0.15rem 0.3rem', backgroundColor: 'transparent', border: 'none', color: '#6b7280', fontSize: '0.7rem', cursor: 'pointer' }} title="Edit">✏️</button>
                                <button onClick={() => setConfirmRemoveMember(m)} disabled={isRemoving} style={{ padding: '0.15rem 0.3rem', backgroundColor: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.7rem', cursor: isRemoving ? 'wait' : 'pointer', opacity: isRemoving ? 0.5 : 1 }} title="Remove">🗑️</button>
                              </>
                            ) : isOwnRow ? (
                              <button onClick={() => setEditingMember(m)} style={{ padding: '0.15rem 0.3rem', backgroundColor: 'transparent', border: 'none', color: '#3b82f6', fontSize: '0.7rem', cursor: 'pointer' }} title="Edit my troops">✏️</button>
                            ) : null}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddMember && (
        <AddMemberModal onAdd={ac.addMember} searchAtlasUsers={ac.searchAtlasUsers}
          onClose={() => setShowAddMember(false)} memberCount={ac.memberCount} maxMembers={ac.maxMembers} />
      )}
      {showImport && (
        <ImportMembersModal onImport={ac.importByPlayerIds}
          onClose={() => setShowImport(false)} memberCount={ac.memberCount} maxMembers={ac.maxMembers} />
      )}
      {showTransfer && <TransferOwnershipModal ac={ac} onClose={() => setShowTransfer(false)} />}
      {showManagers && <ManagerModal ac={ac} onClose={() => setShowManagers(false)} />}
      {editingMember && <EditMemberModal member={editingMember} onUpdate={ac.updateMember} onClose={() => setEditingMember(null)} restrictedMode={isMemberOnly && editingMember.id === ac.currentMemberId} allianceId={ac.alliance?.id} />}

      {/* Edit alliance modal */}
      {showEditAlliance && (
        <div style={modalBackdrop(isMobile)}
          onClick={() => setShowEditAlliance(false)} role="dialog" aria-modal="true" aria-label={t('allianceCenter.editAlliance', 'Edit Alliance')}>
          <div onClick={e => e.stopPropagation()} style={modalContent(isMobile)}>
            <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' }}>
              {t('allianceCenter.editAlliance', 'Edit Alliance')}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input type="text" value={editTag} onChange={e => setEditTag(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 3))}
                placeholder="Tag (3 chars)" maxLength={3} style={inputBase} />
              <input type="text" value={editName} onChange={e => setEditName(e.target.value.slice(0, 50))}
                placeholder="Name" maxLength={50} style={inputBase} />
              <textarea value={editDesc} onChange={e => setEditDesc(e.target.value.slice(0, 200))}
                placeholder="Description (optional)" maxLength={200} rows={2}
                style={{ ...inputBase, resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button variant="ghost" onClick={() => setShowEditAlliance(false)} style={{ flex: 1 }}>{t('common.cancel', 'Cancel')}</Button>
                <Button variant="primary" onClick={handleEditSave} style={{ flex: 1 }}
                  disabled={!editTag.trim() || editTag.trim().length !== 3 || !editName.trim()}>
                  {t('common.save', 'Save')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Remove member confirm modal */}
      {confirmRemoveMember && (
        <div style={modalBackdrop(isMobile)}
          onClick={() => setConfirmRemoveMember(null)} role="dialog" aria-modal="true" aria-label={t('allianceCenter.removeMemberTitle', 'Remove Member?')}>
          <div onClick={e => e.stopPropagation()} style={modalContentCentered(isMobile, { maxWidth: '380px', borderColor: '#ef444430' })}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🗑️</div>
            <h3 style={{ color: '#fff', fontSize: '1.05rem', fontWeight: '700', marginBottom: '0.5rem' }}>
              {t('allianceCenter.removeMemberTitle', 'Remove Member?')}
            </h3>
            <p style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              {t('allianceCenter.removeMemberDesc', 'Are you sure you want to remove {{name}} from the roster? Their troop data will be lost.', { name: confirmRemoveMember.player_name })}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button variant="ghost" onClick={() => setConfirmRemoveMember(null)} style={{ flex: 1 }}>{t('common.cancel', 'Cancel')}</Button>
              <Button variant="danger" onClick={async () => {
                const member = confirmRemoveMember;
                setConfirmRemoveMember(null);
                setRemovingMemberId(member.id);
                const result = await ac.removeMember(member.id);
                setRemovingMemberId(null);
                if (result.success) {
                  showToast(t('allianceCenter.memberRemoved', '{{name}} removed', { name: member.player_name }), 'success');
                  if (ac.alliance && authUser) {
                    logAllianceActivity({
                      allianceId: ac.alliance.id,
                      actorUserId: authUser.id,
                      actorName: (authProfile as { linked_username?: string; display_name?: string; username?: string } | null)?.linked_username || (authProfile as { display_name?: string; username?: string } | null)?.display_name || (authProfile as { username?: string } | null)?.username || 'Unknown',
                      action: 'member_removed',
                      targetName: member.player_name,
                    });
                  }
                } else {
                  showToast(result.error || t('allianceCenter.removeFailed', 'Failed to remove'), 'error');
                }
              }} loading={removingMemberId === confirmRemoveMember.id} style={{ flex: 1 }}>
                {t('common.remove', 'Remove')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk troop tier edit modal */}
      {showBulkTroop && (
        <div style={modalBackdrop(isMobile)} onClick={() => setShowBulkTroop(false)} role="dialog" aria-modal="true" aria-label={t('allianceCenter.bulkEditTroops', 'Batch Edit Troops')}>
          <div ref={bulkDialogRef} onClick={e => e.stopPropagation()} style={modalContent(isMobile, { maxWidth: '380px', borderColor: '#a855f730' })}>
            <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: '700', marginBottom: '0.5rem' }}>
              {t('allianceCenter.bulkEditTroops', 'Batch Edit Troops')}
            </h3>
            <p style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: '1rem', lineHeight: 1.4 }}>
              {t('allianceCenter.bulkEditDesc', 'Set troop tiers for {{count}} selected members. Only changed fields will be updated.', { count: bulkSelected.size })}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ color: TROOP_COLORS.infantry, fontSize: '0.7rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Infantry Tier</label>
                <select value={bulkInfTier ?? ''} onChange={e => setBulkInfTier(e.target.value ? Number(e.target.value) : null)} style={{ ...inputBase, fontSize: isMobile ? '1rem' : '0.8rem', minHeight: isMobile ? '44px' : 'auto' }}>
                  <option value="">— No change —</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(t => <option key={t} value={t}>T{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: TROOP_COLORS.cavalry, fontSize: '0.7rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Cavalry Tier</label>
                <select value={bulkCavTier ?? ''} onChange={e => setBulkCavTier(e.target.value ? Number(e.target.value) : null)} style={{ ...inputBase, fontSize: isMobile ? '1rem' : '0.8rem', minHeight: isMobile ? '44px' : 'auto' }}>
                  <option value="">— No change —</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(t => <option key={t} value={t}>T{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: TROOP_COLORS.archers, fontSize: '0.7rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Archers Tier</label>
                <select value={bulkArcTier ?? ''} onChange={e => setBulkArcTier(e.target.value ? Number(e.target.value) : null)} style={{ ...inputBase, fontSize: isMobile ? '1rem' : '0.8rem', minHeight: isMobile ? '44px' : 'auto' }}>
                  <option value="">— No change —</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(t => <option key={t} value={t}>T{t}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                <Button variant="ghost" onClick={() => setShowBulkTroop(false)} style={{ flex: 1 }}>{t('common.cancel', 'Cancel')}</Button>
                <Button variant="primary" onClick={handleBulkTroopSave} loading={bulkSaving} disabled={bulkSaving || (bulkInfTier === null && bulkCavTier === null && bulkArcTier === null)} style={{ flex: 1 }}>
                  {t('allianceCenter.applyToSelected', 'Apply to {{count}}', { count: bulkSelected.size })}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {showDeleteConfirm && (
        <div style={modalBackdrop(isMobile)}
          onClick={() => setShowDeleteConfirm(false)} role="dialog" aria-modal="true" aria-label={t('allianceCenter.deleteTitle', 'Delete Alliance Center?')}>
          <div onClick={e => e.stopPropagation()} style={modalContentCentered(isMobile, { maxWidth: '380px', borderColor: '#ef444430' })}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⚠️</div>
            <h3 style={{ color: '#fff', fontSize: '1.05rem', fontWeight: '700', marginBottom: '0.5rem' }}>
              {t('allianceCenter.deleteTitle', 'Delete Alliance Center?')}
            </h3>
            <p style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              {t('allianceCenter.deleteDesc', 'This will permanently delete your alliance center and remove all {{count}} members. This cannot be undone.', { count: ac.memberCount })}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)} style={{ flex: 1 }}>{t('common.cancel', 'Cancel')}</Button>
              <Button variant="danger" onClick={handleDeleteAlliance} loading={deleting} style={{ flex: 1 }}>
                {t('allianceCenter.deleteBtn', 'Delete')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AllianceDashboard;
