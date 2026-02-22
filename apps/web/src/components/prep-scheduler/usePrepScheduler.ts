// ─── KvK Prep Scheduler — Custom Hook ─────────────────────────────────
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useGoldKingdoms } from '../../hooks/useGoldKingdoms';
import { useKvk11Promo } from '../../hooks/useKvk11Promo';
import { useToast } from '../Toast';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { logger } from '../../utils/logger';
import { RealtimeChannel } from '@supabase/supabase-js';
import * as Sentry from '@sentry/react';
import {
  PrepSchedule, PrepSubmission, ChangeRequest, SlotAssignment, EditorRecord,
  ManagerEntry, ManagerSearchResult, PendingConfirm,
  SchedulerView, Day, getDayLabel, getEffectiveSlots, getMaxSlots,
} from './types';
import {
  getDeadlineCountdown, getEffectiveSpeedups, isSlotInAvailability,
  isSkippedDay, autoAssignSlots, exportToSpreadsheet,
} from './utils';

export function usePrepScheduler() {
  const { scheduleId } = useParams<{ scheduleId?: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const isMobile = useIsMobile();
  const goldKingdoms = useGoldKingdoms();
  const { hasPromoAccess, isPromoActive, msRemaining: promoMsRemaining } = useKvk11Promo();
  const { showToast } = useToast();
  useDocumentTitle('KvK Prep Scheduler');

  // State
  const [view, setView] = useState<SchedulerView>('landing');
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<PrepSchedule | null>(null);
  const [mySchedules, setMySchedules] = useState<PrepSchedule[]>([]);
  const [submissions, setSubmissions] = useState<PrepSubmission[]>([]);
  const [assignments, setAssignments] = useState<SlotAssignment[]>([]);
  const [isManager, setIsManager] = useState(false);
  const [isEditorOrCoEditor, setIsEditorOrCoEditor] = useState(false);
  const [activeDay, setActiveDay] = useState<Day>('monday');
  const [saving, setSaving] = useState(false);
  const [, setEditorRecords] = useState<EditorRecord[]>([]);
  const [managerUsername, setManagerUsername] = useState<string>('');

  // Form state
  const [formUsername, setFormUsername] = useState('');
  const [formAlliance, setFormAlliance] = useState('');
  const [mondayAvail, setMondayAvail] = useState<string[][]>([]);
  const [tuesdayAvail, setTuesdayAvail] = useState<string[][]>([]);
  const [thursdayAvail, setThursdayAvail] = useState<string[][]>([]);
  const [generalSpeedups, setGeneralSpeedups] = useState(0);
  const [trainingSpeedups, setTrainingSpeedups] = useState(0);
  const [constructionSpeedups, setConstructionSpeedups] = useState(0);
  const [researchSpeedups, setResearchSpeedups] = useState(0);
  const [generalTarget, setGeneralTarget] = useState<string>('');
  const [generalAllocation, setGeneralAllocation] = useState<{ construction: number; training: number; research: number } | null>(null);
  const [existingSubmission, setExistingSubmission] = useState<PrepSubmission | null>(null);
  const [mySubmissions, setMySubmissions] = useState<PrepSubmission[]>([]);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string>('');
  const [skipMonday, setSkipMonday] = useState(false);
  const [skipTuesday, setSkipTuesday] = useState(false);
  const [skipThursday, setSkipThursday] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Create schedule state
  const [createKingdom, setCreateKingdom] = useState<number>(0);
  const [createKvkNumber, setCreateKvkNumber] = useState<number>(0);
  const [createNotes, setCreateNotes] = useState('');
  const [createDeadline, setCreateDeadline] = useState('');
  const [createDisabledDays, setCreateDisabledDays] = useState<string[]>([]);

  // Prep Manager assignment state (multi-manager)
  const [assignManagerInput, setAssignManagerInput] = useState('');
  const [managerSearchResults, setManagerSearchResults] = useState<ManagerSearchResult[]>([]);
  const [managers, setManagers] = useState<ManagerEntry[]>([]);
  const [showManagerDropdown, setShowManagerDropdown] = useState(false);
  const managerSearchRef = useRef<HTMLDivElement>(null);

  // Kingdom schedules for "Fill The Form" CTA
  const [kingdomSchedules, setKingdomSchedules] = useState<PrepSchedule[]>([]);

  // Schedules the user has submitted to (regardless of kingdom)
  const [submittedSchedules, setSubmittedSchedules] = useState<PrepSchedule[]>([]);

  // Change requests state
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [showChangeRequestForm, setShowChangeRequestForm] = useState(false);
  const [changeRequestDay, setChangeRequestDay] = useState<Day>('monday');
  const [changeRequestType, setChangeRequestType] = useState<'cant_attend' | 'change_slot' | 'other'>('cant_attend');
  const [changeRequestMessage, setChangeRequestMessage] = useState('');

  // Non-qualifying popup
  const [showNonQualifyingPopup, setShowNonQualifyingPopup] = useState(false);

  // Re-fill mode: allows form fillers to edit their submitted form again
  const [isRefilling, setIsRefilling] = useState(false);

  // Confirmation dialog state (replaces native confirm())
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  // Slot removal state — undo support + disabled button tracking
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const pendingRemoveIds = useRef<Set<string>>(new Set());
  const undoTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastConflictToast = useRef<number>(0);

  // Cleanup pending deletes on unmount
  useEffect(() => {
    return () => {
      undoTimers.current.forEach((timer, id) => {
        clearTimeout(timer);
        if (supabase) supabase.from('prep_slot_assignments').delete().eq('id', id);
      });
      undoTimers.current.clear();
      pendingRemoveIds.current.clear();
    };
  }, []);

  // ─── Data Fetching ─────────────────────────────────────────────────
  const fetchMySchedules = useCallback(async () => {
    if (!user?.id || !supabase) return;
    try {
      const { data: created } = await supabase.from('prep_schedules').select('*').eq('created_by', user.id).order('created_at', { ascending: false });
      const { data: managed } = await supabase.from('prep_schedules').select('*').eq('prep_manager_id', user.id).order('created_at', { ascending: false });
      const { data: mgrLinks } = await supabase.from('prep_schedule_managers').select('schedule_id').eq('user_id', user.id);
      let managedNew: PrepSchedule[] = [];
      if (mgrLinks && mgrLinks.length > 0) {
        const ids = mgrLinks.map(m => m.schedule_id);
        const { data: mgrSchedules } = await supabase.from('prep_schedules').select('*').in('id', ids).order('created_at', { ascending: false });
        managedNew = mgrSchedules || [];
      }
      // Also include schedules for kingdoms where user is an editor/co-editor
      let editorSchedules: PrepSchedule[] = [];
      const { data: editorRoles } = await supabase.from('kingdom_editors').select('kingdom_number').eq('user_id', user.id).eq('status', 'active');
      if (editorRoles && editorRoles.length > 0) {
        const kNums = editorRoles.map(e => e.kingdom_number);
        const { data: edSch } = await supabase.from('prep_schedules').select('*').in('kingdom_number', kNums).order('created_at', { ascending: false });
        editorSchedules = edSch || [];
      }
      const all = [...(created || []), ...(managed || []), ...managedNew, ...editorSchedules];
      const unique = all.filter((s, i, arr) => arr.findIndex(x => x.id === s.id) === i);
      setMySchedules(unique);
    } catch (err) { logger.error('Failed to fetch schedules:', err); }
  }, [user?.id]);

  const fetchSchedule = useCallback(async (id: string) => {
    if (!supabase) return;
    try {
      const { data } = await supabase.from('prep_schedules').select('*').eq('id', id).single();
      if (data) {
        // Check if creator was authorized (Editor, Co-Editor, Prep Manager, or admin)
        const { data: creatorEditors } = await supabase.from('kingdom_editors').select('id')
          .eq('user_id', data.created_by).eq('kingdom_number', data.kingdom_number).eq('status', 'active');
        const { data: creatorMgrLinks } = await supabase.from('prep_schedule_managers').select('id')
          .eq('user_id', data.created_by).limit(1);
        const { data: creatorProfile } = await supabase.from('profiles').select('is_admin')
          .eq('id', data.created_by).single();
        const creatorIsEditor = (creatorEditors && creatorEditors.length > 0);
        const creatorIsManager = data.prep_manager_id === data.created_by || (creatorMgrLinks && creatorMgrLinks.length > 0);
        const creatorIsAdmin = creatorProfile?.is_admin === true;
        if (!creatorIsEditor && !creatorIsManager && !creatorIsAdmin) {
          // Flag unauthorized schedule for admin review instead of hard-deleting
          logger.info(`Flagging schedule ${data.id} created by unauthorized user ${data.created_by}`);
          await supabase.from('prep_schedules').update({ status: 'flagged', flagged_at: new Date().toISOString() }).eq('id', data.id);
          showToast(t('prepScheduler.toastScheduleFlagged', 'This schedule was created by an unauthorized user and has been flagged for admin review.'), 'error');
          navigate('/tools/prep-scheduler');
          return;
        }

        setSchedule(data);
        const isCreator = data.created_by === user?.id;
        const isPrepManager = data.prep_manager_id === user?.id;
        if (user?.id) {
          const { data: editors } = await supabase.from('kingdom_editors').select('*')
            .eq('kingdom_number', data.kingdom_number).eq('status', 'active');
          setEditorRecords(editors || []);
          const isEditor = (editors || []).some(e => e.user_id === user.id);
          setIsEditorOrCoEditor(isEditor || isCreator);
          // All editors/co-editors and prep managers can fully manage the schedule
          setIsManager(isCreator || isPrepManager || isEditor);
        } else {
          setIsManager(isCreator || isPrepManager);
        }
        if (data.prep_manager_id) {
          const { data: mgr } = await supabase.from('profiles').select('linked_username, username').eq('id', data.prep_manager_id).single();
          if (mgr) setManagerUsername(mgr.linked_username || mgr.username || '');
        }
        await fetchManagers(data.id);
      }
    } catch (err) { logger.error('Failed to fetch schedule:', err); }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchSubmissions = useCallback(async (schedId: string) => {
    if (!supabase) return;
    try {
      const { data } = await supabase.from('prep_submissions').select('*').eq('schedule_id', schedId).order('created_at', { ascending: true });
      setSubmissions(data || []);
      if (user?.id && data) {
        const allMine = data.filter((s: PrepSubmission) => s.user_id === user.id);
        setMySubmissions(allMine);
        // Primary submission = first one (linked username)
        const mine = allMine.length > 0 ? allMine[0] : null;
        if (mine && !existingSubmission) { setExistingSubmission(mine); prefillForm(mine); }
      }
    } catch (err) { logger.error('Failed to fetch submissions:', err); }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAssignments = useCallback(async (schedId: string) => {
    if (!supabase) return;
    try {
      const { data } = await supabase.from('prep_slot_assignments').select('*').eq('schedule_id', schedId);
      // Filter out assignments with pending undo (not yet deleted on server)
      const filtered = (data || []).filter(a => !pendingRemoveIds.current.has(a.id));
      setAssignments(filtered);
    } catch (err) { logger.error('Failed to fetch assignments:', err); }
  }, []);

  const fetchManagers = useCallback(async (schedId: string) => {
    if (!supabase) return;
    try {
      const { data: mgrRows } = await supabase.from('prep_schedule_managers').select('id, user_id').eq('schedule_id', schedId);
      if (mgrRows && mgrRows.length > 0) {
        const userIds = mgrRows.map(m => m.user_id);
        const { data: profiles } = await supabase.from('profiles').select('id, linked_username, username').in('id', userIds);
        const mgrs = mgrRows.map(m => {
          const p = (profiles || []).find(pr => pr.id === m.user_id);
          return { id: m.id, user_id: m.user_id, username: p?.linked_username || p?.username || 'Unknown' };
        });
        setManagers(mgrs);
        if (user?.id && mgrs.some(m => m.user_id === user.id)) {
          setIsManager(true);
        }
      } else {
        setManagers([]);
      }
    } catch (err) { logger.error('Failed to fetch managers:', err); }
  }, [user?.id]);

  const fetchChangeRequests = useCallback(async (schedId: string) => {
    if (!supabase) return;
    try {
      const { data } = await supabase.from('prep_change_requests').select('*').eq('schedule_id', schedId).order('created_at', { ascending: false });
      setChangeRequests(data || []);
    } catch (err) { logger.error('Failed to fetch change requests:', err); }
  }, []);

  const searchUsers = useCallback(async (query: string) => {
    if (!supabase || query.length < 2) { setManagerSearchResults([]); setShowManagerDropdown(false); return; }
    try {
      const { data } = await supabase.from('profiles')
        .select('id, linked_username, username, linked_player_id')
        .or(`linked_username.ilike.%${query}%,linked_player_id.ilike.%${query}%,username.ilike.%${query}%`)
        .limit(8);
      setManagerSearchResults(data || []);
      setShowManagerDropdown((data || []).length > 0);
    } catch { setManagerSearchResults([]); }
  }, []);

  const prefillForm = (sub: PrepSubmission) => {
    setFormUsername(sub.username);
    setFormAlliance(sub.alliance_tag || '');
    setMondayAvail(sub.monday_availability || []);
    setTuesdayAvail(sub.tuesday_availability || []);
    setThursdayAvail(sub.thursday_availability || []);
    setGeneralSpeedups(sub.general_speedups);
    setTrainingSpeedups(sub.training_speedups);
    setConstructionSpeedups(sub.construction_speedups);
    setResearchSpeedups(sub.research_speedups);
    setGeneralTarget(sub.general_speedup_target || '');
    setGeneralAllocation(sub.general_speedup_allocation || null);
    setSkipMonday(sub.skip_monday || false);
    setSkipTuesday(sub.skip_tuesday || false);
    setSkipThursday(sub.skip_thursday || false);
    if (sub.screenshot_url) setScreenshotPreview(sub.screenshot_url);
  };

  // Cleanup blob URL on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (screenshotPreview && screenshotPreview.startsWith('blob:')) {
        URL.revokeObjectURL(screenshotPreview);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Supabase Realtime ─────────────────────────────────────────────
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!scheduleId || !isSupabaseConfigured || !supabase) return;
    const client = supabase;

    const channel = client
      .channel(`prep-schedule-${scheduleId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prep_submissions', filter: `schedule_id=eq.${scheduleId}` },
        () => { fetchSubmissions(scheduleId); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prep_slot_assignments', filter: `schedule_id=eq.${scheduleId}` },
        (payload: { new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
          fetchAssignments(scheduleId);
          // Conflict detection: notify when another editor changes assignments
          const record = (payload.new || payload.old) as { assigned_by?: string } | undefined;
          if (record?.assigned_by && record.assigned_by !== user?.id && Date.now() - lastConflictToast.current > 10000) {
            lastConflictToast.current = Date.now();
            showToast(t('prepScheduler.toastExternalChange', 'Schedule updated by another editor.'), 'info');
          }
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prep_change_requests', filter: `schedule_id=eq.${scheduleId}` },
        () => { fetchChangeRequests(scheduleId); })
      .subscribe((status) => {
        logger.info(`Prep scheduler realtime: ${status}`);
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current && client) {
        client.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [scheduleId, fetchSubmissions, fetchAssignments, fetchChangeRequests]);

  // ─── Initialization ───────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      if (scheduleId) {
        await Promise.all([
          fetchSchedule(scheduleId),
          fetchSubmissions(scheduleId),
          fetchAssignments(scheduleId),
          fetchChangeRequests(scheduleId),
        ]);
      } else {
        await fetchMySchedules();
      }
      if (profile) {
        if (!formUsername && profile.linked_username) setFormUsername(profile.linked_username);
        if (!formAlliance && profile.alliance_tag) setFormAlliance(profile.alliance_tag);
        if (!createKingdom && profile.linked_kingdom) setCreateKingdom(profile.linked_kingdom);
        if (profile.linked_kingdom && supabase && !scheduleId) {
          try {
            const { data: ks } = await supabase.from('prep_schedules').select('*')
              .eq('kingdom_number', profile.linked_kingdom).in('status', ['active', 'closed'])
              .order('created_at', { ascending: false });
            setKingdomSchedules(ks || []);
          } catch { /* silent */ }
        }
        // Fetch schedules the user has submitted to (even from other kingdoms)
        if (user?.id && supabase && !scheduleId) {
          try {
            const { data: subs } = await supabase.from('prep_submissions').select('schedule_id').eq('user_id', user.id);
            if (subs && subs.length > 0) {
              const schedIds = [...new Set(subs.map(s => s.schedule_id))];
              const { data: schedules } = await supabase.from('prep_schedules').select('*')
                .in('id', schedIds).in('status', ['active', 'closed'])
                .order('created_at', { ascending: false });
              setSubmittedSchedules(schedules || []);
            }
          } catch { /* silent */ }
        }
        // Check editor/co-editor status for landing view (schedule creation gate)
        if (user?.id && supabase && !scheduleId) {
          try {
            const { data: editors } = await supabase.from('kingdom_editors').select('*')
              .eq('user_id', user.id).eq('status', 'active');
            if (editors && editors.length > 0) setIsEditorOrCoEditor(true);
          } catch { /* silent */ }
          // Check if user is a manager of any schedule
          try {
            const { data: mgrLinks } = await supabase.from('prep_schedule_managers').select('id').eq('user_id', user.id).limit(1);
            if (mgrLinks && mgrLinks.length > 0) setIsManager(true);
          } catch { /* silent */ }
        }
      }
      setLoading(false);
    };
    init();
  }, [scheduleId, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-close form when deadline is reached
  useEffect(() => {
    if (!schedule?.deadline || schedule.status !== 'active' || !supabase) return;
    const sb = supabase;
    const check = () => {
      const countdown = getDeadlineCountdown(schedule.deadline);
      if (countdown?.expired) {
        sb.from('prep_schedules').update({ status: 'closed' }).eq('id', schedule.id).then(() => {
          setSchedule(prev => prev ? { ...prev, status: 'closed' } : prev);
        });
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [schedule?.id, schedule?.deadline, schedule?.status]);

  // Determine view
  useEffect(() => {
    if (!scheduleId) { setView('landing'); return; }
    if (!user) { setView('gate'); return; }
    if (!profile?.linked_player_id) { setView('gate'); return; }
    if (schedule) { setView(isManager ? 'manage' : 'form'); }
  }, [scheduleId, schedule, isManager, user, profile]);

  // Click outside to close manager dropdown
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (managerSearchRef.current && !managerSearchRef.current.contains(e.target as Node)) {
        setShowManagerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => { if (assignManagerInput.trim().length >= 2) searchUsers(assignManagerInput.trim()); }, 300);
    return () => clearTimeout(timer);
  }, [assignManagerInput, searchUsers]);

  // ─── Actions (alert → showToast, confirm → pendingConfirm) ────────
  const createSchedule = async () => {
    if (!supabase || !user?.id || !createKingdom) return;
    if (!profile?.is_admin && !isEditorOrCoEditor && !isManager) {
      showToast(t('prepScheduler.toastRoleRequired', 'Only Editors, Co-Editors, and Prep Managers can create schedules.'), 'error');
      return;
    }
    if (!goldKingdoms.has(createKingdom) && !hasPromoAccess(createKingdom)) {
      showToast(t('prepScheduler.toastGoldOnly', 'Only Gold Tier kingdoms can use the KvK Prep Scheduler.'), 'error');
      return;
    }
    setSaving(true);
    try {
      // Only 1 active schedule per kingdom at a time
      const { data: existing } = await supabase.from('prep_schedules').select('id').eq('kingdom_number', createKingdom).eq('status', 'active');
      if (existing && existing.length > 0) {
        showToast(t('prepScheduler.toastDuplicateSchedule', 'An active schedule already exists for this kingdom. Close or archive it first.'), 'error');
        setSaving(false);
        return;
      }
      const { data, error } = await supabase.from('prep_schedules').insert({
        kingdom_number: createKingdom, created_by: user.id,
        kvk_number: createKvkNumber || null, notes: createNotes || null,
        deadline: createDeadline ? new Date(createDeadline + 'Z').toISOString() : null,
        disabled_days: createDisabledDays,
      }).select().single();
      if (error) throw error;
      if (data) {
        try {
          await supabase.rpc('notify_kingdom_prep_schedule', {
            p_kingdom_number: createKingdom, p_schedule_id: data.id, p_kvk_number: createKvkNumber || null,
          });
        } catch (notifErr) { logger.error('Failed to send notifications:', notifErr); }
        navigate(`/tools/prep-scheduler/${data.id}`);
      }
    } catch (err) { logger.error('Failed to create schedule:', err); showToast(t('prepScheduler.toastCreateFailed', 'Failed to create schedule.'), 'error'); }
    setSaving(false);
  };

  const closeOrReopenForm = () => {
    if (!supabase || !schedule) return;
    const newStatus = schedule.status === 'closed' ? 'active' : 'closed';
    const msg = newStatus === 'closed'
      ? t('prepScheduler.confirmCloseForm', 'Close the form? No new submissions or edits will be allowed.')
      : t('prepScheduler.confirmReopenForm', 'Reopen the form for submissions?');
    setPendingConfirm({
      message: msg,
      onConfirm: async () => {
        try {
          await supabase!.from('prep_schedules').update({ status: newStatus }).eq('id', schedule.id);
          setSchedule({ ...schedule, status: newStatus });
          showToast(newStatus === 'closed' ? t('prepScheduler.toastFormClosed', 'Form closed.') : t('prepScheduler.toastFormReopened', 'Form reopened.'), 'success');
        } catch (err) { logger.error('Failed to update status:', err); showToast(t('prepScheduler.toastStatusFailed', 'Failed to update status.'), 'error'); }
      },
    });
  };

  const toggleStagger = async () => {
    if (!supabase || !schedule) return;
    const newVal = !schedule.stagger_enabled;
    setSaving(true);
    try {
      await supabase.from('prep_schedules').update({ stagger_enabled: newVal }).eq('id', schedule.id);
      setSchedule({ ...schedule, stagger_enabled: newVal });
      showToast(
        newVal
          ? t('prepScheduler.toastStaggerEnabled', 'Stagger enabled — slots shifted to :15/:45 pattern.')
          : t('prepScheduler.toastStaggerDisabled', 'Stagger disabled — back to :00/:30 slots.'),
        'success'
      );
    } catch (err) {
      logger.error('Failed to toggle stagger:', err);
      showToast(t('prepScheduler.toastStaggerFailed', 'Failed to toggle stagger.'), 'error');
    }
    setSaving(false);
  };

  const notifyScheduleReady = async () => {
    if (!supabase || !schedule) return;
    setSaving(true);
    try {
      const { data: count, error } = await supabase.rpc('notify_prep_schedule_ready', {
        p_schedule_id: schedule.id,
        p_kingdom_number: schedule.kingdom_number,
        p_kvk_number: schedule.kvk_number || null,
      });
      if (error) throw error;
      showToast(t('prepScheduler.toastNotified', 'Notified {{count}} player(s) that the schedule is ready.', { count: count || 0 }), 'success');
    } catch (err) {
      logger.error('Failed to send schedule ready notification:', err);
      showToast(t('prepScheduler.toastNotifyFailed', 'Failed to send notifications.'), 'error');
    }
    setSaving(false);
  };

  const toggleDisabledDay = async (day: string) => {
    if (!supabase || !schedule) return;
    const current = schedule.disabled_days || [];
    const newDays = current.includes(day) ? current.filter(d => d !== day) : [...current, day];
    // Don't allow disabling all 3 days
    if (newDays.length >= 3) {
      showToast(t('prepScheduler.toastCantDisableAll', 'At least one day must remain enabled.'), 'error');
      return;
    }
    setSaving(true);
    try {
      await supabase.from('prep_schedules').update({ disabled_days: newDays }).eq('id', schedule.id);
      setSchedule({ ...schedule, disabled_days: newDays });
      showToast(
        newDays.includes(day)
          ? t('prepScheduler.toastDayDisabled', '{{day}} disabled.', { day: day.charAt(0).toUpperCase() + day.slice(1) })
          : t('prepScheduler.toastDayEnabled', '{{day}} enabled.', { day: day.charAt(0).toUpperCase() + day.slice(1) }),
        'success'
      );
    } catch (err) {
      logger.error('Failed to toggle disabled day:', err);
      showToast(t('prepScheduler.toastDayToggleFailed', 'Failed to update day settings.'), 'error');
    }
    setSaving(false);
  };

  const toggleLock = () => {
    if (!supabase || !schedule) return;
    const newLocked = !schedule.is_locked;
    const msg = newLocked ? t('prepScheduler.confirmLock', 'Lock the schedule? This marks it as finalized.') : t('prepScheduler.confirmUnlock', 'Unlock the schedule?');
    setPendingConfirm({
      message: msg,
      onConfirm: async () => {
        try {
          await supabase!.from('prep_schedules').update({ is_locked: newLocked }).eq('id', schedule.id);
          setSchedule({ ...schedule, is_locked: newLocked });
          showToast(newLocked ? t('prepScheduler.toastLocked', 'Schedule locked.') : t('prepScheduler.toastUnlocked', 'Schedule unlocked.'), 'success');
        } catch (err) { logger.error('Failed to toggle lock:', err); showToast(t('prepScheduler.toastLockFailed', 'Failed to update lock status.'), 'error'); }
      },
    });
  };

  const updateDeadline = async (newDeadline: string) => {
    if (!supabase || !schedule) return;
    setSaving(true);
    try {
      const deadlineISO = newDeadline ? new Date(newDeadline + 'Z').toISOString() : null;
      await supabase.from('prep_schedules').update({ deadline: deadlineISO }).eq('id', schedule.id);
      setSchedule({ ...schedule, deadline: deadlineISO });
      showToast(t('prepScheduler.toastDeadlineUpdated', 'Deadline updated.'), 'success');
    } catch (err) {
      logger.error('Failed to update deadline:', err);
      showToast(t('prepScheduler.toastDeadlineFailed', 'Failed to update deadline.'), 'error');
    }
    setSaving(false);
  };

  const archiveSchedule = () => {
    if (!supabase || !schedule) return;
    setPendingConfirm({
      message: t('prepScheduler.confirmArchive', 'Archive this schedule? It will no longer accept submissions.'),
      onConfirm: async () => {
        try {
          await supabase!.from('prep_schedules').update({ status: 'archived' }).eq('id', schedule.id);
          setSchedule({ ...schedule, status: 'archived' });
          showToast(t('prepScheduler.toastArchived', 'Schedule archived.'), 'success');
        } catch (err) { logger.error('Failed to archive:', err); showToast(t('prepScheduler.toastArchiveFailed', 'Failed to archive schedule.'), 'error'); }
      },
    });
  };

  const deleteSchedule = () => {
    if (!supabase || !schedule) return;
    if (schedule.status !== 'archived') {
      showToast(t('prepScheduler.toastDeleteOnlyArchived', 'Only archived schedules can be deleted.'), 'error');
      return;
    }
    setPendingConfirm({
      message: t('prepScheduler.confirmDelete', 'Permanently delete this archived schedule? All submissions, assignments, and change requests will be removed. This cannot be undone.'),
      onConfirm: async () => {
        try {
          await supabase!.from('prep_change_requests').delete().eq('schedule_id', schedule.id);
          await supabase!.from('prep_slot_assignments').delete().eq('schedule_id', schedule.id);
          await supabase!.from('prep_submissions').delete().eq('schedule_id', schedule.id);
          await supabase!.from('prep_schedule_managers').delete().eq('schedule_id', schedule.id);
          await supabase!.from('prep_schedules').delete().eq('id', schedule.id);
          showToast(t('prepScheduler.toastDeleted', 'Schedule deleted.'), 'success');
          navigate('/tools/prep-scheduler');
        } catch (err) { logger.error('Failed to delete schedule:', err); showToast(t('prepScheduler.toastDeleteFailed', 'Failed to delete schedule.'), 'error'); }
      },
    });
  };

  const submitChangeRequest = async () => {
    if (!supabase || !user?.id || !schedule || !existingSubmission) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('prep_change_requests').insert({
        schedule_id: schedule.id, submission_id: existingSubmission.id, user_id: user.id,
        request_type: changeRequestType, day: changeRequestDay, message: changeRequestMessage.trim() || null,
      });
      if (error) throw error;
      showToast(t('prepScheduler.toastChangeRequestSent', 'Change request submitted! Your Prep Manager will be notified.'), 'success');
      setShowChangeRequestForm(false); setChangeRequestMessage('');
    } catch (err) { logger.error('Failed to submit change request:', err); showToast(t('prepScheduler.toastChangeRequestFailed', 'Failed to submit request.'), 'error'); }
    setSaving(false);
  };

  const acknowledgeChangeRequest = async (reqId: string) => {
    if (!supabase || !user?.id) return;
    try {
      await supabase.from('prep_change_requests').update({ status: 'resolved', resolved_at: new Date().toISOString(), resolved_by: user.id }).eq('id', reqId);
      setChangeRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: 'resolved' as const } : r));
      showToast(t('prepScheduler.toastChangeResolved', 'Change request resolved.'), 'success');
    } catch (err) { logger.error('Failed to acknowledge:', err); }
  };

  const uploadScreenshot = async (): Promise<string | null> => {
    if (!screenshotFile || !supabase || !user?.id) return existingSubmission?.screenshot_url || null;
    try {
      const ext = screenshotFile.name.split('.').pop() || 'jpg';
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('prep-screenshots').upload(path, screenshotFile, { cacheControl: '3600', upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('prep-screenshots').getPublicUrl(path);
      return urlData?.publicUrl || null;
    } catch (err) { logger.error('Screenshot upload failed:', err); return null; }
  };

  const submitForm = async () => {
    if (!supabase || !user?.id || !scheduleId) return;
    if (!formUsername.trim()) { showToast(t('prepScheduler.toastUsernameRequired', 'Please enter your username.'), 'error'); return; }
    if (!formAlliance.trim()) { showToast(t('prepScheduler.toastAllianceRequired', 'Please enter your alliance tag.'), 'error'); return; }
    // Screenshot is required
    if (!screenshotFile && !existingSubmission?.screenshot_url) {
      showToast(t('prepScheduler.toastScreenshotRequired', 'Please upload a screenshot of your speedups.'), 'error'); return;
    }
    const hasAvail = (!skipMonday && mondayAvail.length > 0) || (!skipTuesday && tuesdayAvail.length > 0) || (!skipThursday && thursdayAvail.length > 0);
    if (!hasAvail && !(skipMonday && skipTuesday && skipThursday)) {
      showToast(t('prepScheduler.toastAvailabilityRequired', 'Please add availability for at least one day, or mark all days as skipped.'), 'error'); return;
    }
    setSaving(true);
    try {
      const screenshotUrl = await uploadScreenshot();
      const payload = {
        schedule_id: scheduleId, user_id: user.id, username: formUsername.trim(),
        alliance_tag: formAlliance.trim() || null,
        monday_availability: mondayAvail, tuesday_availability: tuesdayAvail, thursday_availability: thursdayAvail,
        general_speedups: generalSpeedups, training_speedups: trainingSpeedups,
        construction_speedups: constructionSpeedups, research_speedups: researchSpeedups,
        general_speedup_target: generalAllocation ? null : (generalTarget || null),
        general_speedup_allocation: generalAllocation,
        screenshot_url: screenshotUrl,
        skip_monday: skipMonday, skip_tuesday: skipTuesday, skip_thursday: skipThursday,
      };
      if (existingSubmission) {
        const { error } = await supabase.from('prep_submissions').update(payload).eq('id', existingSubmission.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('prep_submissions').insert(payload);
        if (error) throw error;
      }
      showToast(existingSubmission ? t('prepScheduler.toastSubmissionUpdated', 'Submission updated!') : t('prepScheduler.toastSubmissionReceived', 'Submission received! Your Prep Manager will assign you a slot.'), 'success');
      // Auto-update profile alliance_tag if it was empty and user provided one
      if (formAlliance.trim() && profile && !profile.alliance_tag) {
        try {
          await supabase.from('profiles').update({ alliance_tag: formAlliance.trim() }).eq('id', user.id);
        } catch { /* silent — non-critical */ }
      }
      await fetchSubmissions(scheduleId);
    } catch (err: unknown) { logger.error('Failed to submit:', err); showToast(t('prepScheduler.toastSubmitFailed', 'Failed: {{error}}', { error: err instanceof Error ? err.message : 'Unknown error' }), 'error'); }
    setSaving(false);
  };

  const runAutoAssign = async (day: Day) => {
    if (!supabase || !user?.id || !schedule) return;
    setSaving(true);
    try {
      await supabase.from('prep_slot_assignments').delete().eq('schedule_id', schedule.id).eq('day', day);
      const newAssignments = autoAssignSlots(submissions, schedule, day);
      if (newAssignments.length > 0) {
        const rows = newAssignments.map(a => ({ schedule_id: schedule.id, submission_id: a.submission_id, day, slot_time: a.slot_time, assigned_by: user.id }));
        const { error } = await supabase.from('prep_slot_assignments').insert(rows);
        if (error) throw error;
      }
      await fetchAssignments(schedule.id);
      const maxSlots = getMaxSlots(schedule.stagger_enabled);
      const eligibleCount = submissions.filter(s => {
        if (isSkippedDay(s, day)) return false;
        const ak = `${day}_availability` as keyof PrepSubmission;
        const av = (s[ak] as string[][] | undefined) || [];
        return av.length > 0;
      }).length;
      const topNCount = Math.min(eligibleCount, maxSlots);
      const msg = eligibleCount > maxSlots
        ? t('prepScheduler.toastAutoAssignedTopN', 'Auto-assigned {{count}}/{{topN}} top players for {{day}} ({{excess}} below cutoff excluded).', { count: newAssignments.length, topN: topNCount, day: getDayLabel(day, t), excess: eligibleCount - maxSlots })
        : t('prepScheduler.toastAutoAssigned', 'Auto-assigned {{count}} slots for {{day}}.', { count: newAssignments.length, day: getDayLabel(day, t) });
      showToast(msg, 'success');
    } catch (err) { logger.error('Auto-assign failed:', err); showToast(t('prepScheduler.toastAutoAssignFailed', 'Auto-assign failed.'), 'error'); }
    setSaving(false);
  };

  const assignSlot = async (day: Day, slotTime: string, submissionId: string) => {
    if (!supabase || !user?.id || !schedule) return;

    Sentry.addBreadcrumb({ category: 'prep-scheduler', message: 'Assign slot', data: { day, slotTime, submissionId, scheduleId: schedule.id }, level: 'info' });

    // Optimistic update — add assignment to local state instantly
    const prevAssignments = assignments;
    const tempId = `temp-${Date.now()}`;
    setAssignments(prev => {
      // Remove any existing assignment for this slot + any existing assignment for this submission on same day
      const filtered = prev.filter(a => !(a.schedule_id === schedule.id && a.day === day && a.slot_time === slotTime)
        && !(a.schedule_id === schedule.id && a.day === day && a.submission_id === submissionId));
      if (submissionId) {
        filtered.push({ id: tempId, schedule_id: schedule.id, submission_id: submissionId, day, slot_time: slotTime, assigned_by: user!.id });
      }
      return filtered;
    });

    try {
      // Clear existing slot assignment
      await supabase.from('prep_slot_assignments').delete().eq('schedule_id', schedule.id).eq('day', day).eq('slot_time', slotTime);
      if (submissionId) {
        // Clear any other slot this submission had on the same day
        await supabase.from('prep_slot_assignments').delete().eq('schedule_id', schedule.id).eq('day', day).eq('submission_id', submissionId);
        await supabase.from('prep_slot_assignments').insert({ schedule_id: schedule.id, submission_id: submissionId, day, slot_time: slotTime, assigned_by: user.id });
      }
      // Fetch real IDs from server to replace temp ID
      await fetchAssignments(schedule.id);
    } catch (err) {
      setAssignments(prevAssignments);
      showToast(t('prepScheduler.toastAssignFailed', 'Failed to assign slot.'), 'error');
      logger.error('[PrepScheduler] Failed to assign slot:', err);
    }
  };

  const removeAssignment = async (assignmentId: string) => {
    if (!supabase || !schedule) return;
    const removedAssignment = assignments.find(a => a.id === assignmentId);
    if (!removedAssignment) return;

    Sentry.addBreadcrumb({ category: 'prep-scheduler', message: 'Remove assignment', data: { assignmentId, scheduleId: schedule.id }, level: 'info' });

    // Track as removing (disables X button)
    setRemovingIds(prev => new Set(prev).add(assignmentId));

    // Optimistic remove — instant UI update
    setAssignments(prev => prev.filter(a => a.id !== assignmentId));
    pendingRemoveIds.current.add(assignmentId);

    const username = submissions.find(s => s.id === removedAssignment.submission_id)?.username || 'Player';

    // Delayed server delete — 5 second undo window
    const executeDelete = async () => {
      undoTimers.current.delete(assignmentId);
      try {
        const { error } = await supabase!.from('prep_slot_assignments').delete().eq('id', assignmentId);
        if (error) {
          logger.error('[PrepScheduler] Delete error:', error);
          pendingRemoveIds.current.delete(assignmentId);
          setAssignments(prev => !prev.find(a => a.id === assignmentId) && removedAssignment ? [...prev, removedAssignment] : prev);
          showToast(t('prepScheduler.toastRemoveError', 'Error removing assignment.'), 'error');
        }
      } catch (err) {
        logger.error('[PrepScheduler] Failed to remove assignment:', err);
        pendingRemoveIds.current.delete(assignmentId);
        setAssignments(prev => !prev.find(a => a.id === assignmentId) && removedAssignment ? [...prev, removedAssignment] : prev);
        showToast(t('prepScheduler.toastRemoveError', 'Error removing assignment.'), 'error');
      } finally {
        pendingRemoveIds.current.delete(assignmentId);
        setRemovingIds(prev => { const next = new Set(prev); next.delete(assignmentId); return next; });
      }
    };

    const timer = setTimeout(executeDelete, 5000);
    undoTimers.current.set(assignmentId, timer);

    // Success toast with Undo button (5s window)
    showToast(
      t('prepScheduler.toastSlotCleared', '{{username}} removed from slot.', { username }),
      'success',
      5500,
      () => {
        // Undo: cancel pending delete, restore assignment
        const pending = undoTimers.current.get(assignmentId);
        if (pending) clearTimeout(pending);
        undoTimers.current.delete(assignmentId);
        pendingRemoveIds.current.delete(assignmentId);
        setAssignments(prev => !prev.find(a => a.id === assignmentId) && removedAssignment ? [...prev, removedAssignment] : prev);
        setRemovingIds(prev => { const next = new Set(prev); next.delete(assignmentId); return next; });
      },
      t('prepScheduler.undo', 'Undo'),
    );
  };

  const clearDayAssignments = async (day: Day) => {
    if (!supabase || !schedule) return;
    const dayAssigns = assignments.filter(a => a.day === day && a.schedule_id === schedule.id);
    if (dayAssigns.length === 0) return;

    Sentry.addBreadcrumb({ category: 'prep-scheduler', message: 'Clear day assignments', data: { day, count: dayAssigns.length, scheduleId: schedule.id }, level: 'info' });

    const prev = assignments;
    setAssignments(p => p.filter(a => !(a.day === day && a.schedule_id === schedule.id)));

    try {
      const { error } = await supabase.from('prep_slot_assignments').delete().eq('schedule_id', schedule.id).eq('day', day);
      if (error) { setAssignments(prev); showToast(t('prepScheduler.toastClearFailed', 'Failed to clear assignments.'), 'error'); }
      else showToast(t('prepScheduler.toastDayCleared', 'All {{day}} assignments cleared.', { day: getDayLabel(day, t) }), 'success');
    } catch (err) {
      setAssignments(prev);
      showToast(t('prepScheduler.toastClearFailed', 'Failed to clear assignments.'), 'error');
      logger.error('[PrepScheduler] Failed to clear day:', err);
    }
  };

  const copyShareLink = () => {
    if (!schedule) return;
    navigator.clipboard.writeText(`${window.location.origin}/tools/prep-scheduler/${schedule.id}`);
    showToast(t('prepScheduler.toastLinkCopied', 'Link copied! Share it with your kingdom players.'), 'success');
  };

  const addManager = async (userId: string, username: string) => {
    if (!supabase || !schedule || !user?.id) return;
    if (managers.some(m => m.user_id === userId)) { setAssignManagerInput(''); setShowManagerDropdown(false); return; }
    try {
      const { data, error } = await supabase.from('prep_schedule_managers').insert({
        schedule_id: schedule.id, user_id: userId, assigned_by: user.id,
      }).select().single();
      if (error) throw error;
      if (data) {
        setManagers(prev => [...prev, { id: data.id, user_id: userId, username }]);
        if (!schedule.prep_manager_id) {
          await supabase.from('prep_schedules').update({ prep_manager_id: userId }).eq('id', schedule.id);
          setSchedule({ ...schedule, prep_manager_id: userId });
          setManagerUsername(username);
        }
      }
      setAssignManagerInput('');
      setShowManagerDropdown(false);
      showToast(t('prepScheduler.toastManagerAdded', '{{username}} added as Prep Manager.', { username }), 'success');
    } catch (err) { logger.error('Failed to add manager:', err); showToast(t('prepScheduler.toastManagerFailed', 'Failed to add manager.'), 'error'); }
  };

  const removeManagerById = async (mgrId: string, userId: string) => {
    if (!supabase || !schedule) return;
    try {
      await supabase.from('prep_schedule_managers').delete().eq('id', mgrId);
      setManagers(prev => prev.filter(m => m.id !== mgrId));
      if (schedule.prep_manager_id === userId) {
        const remaining = managers.filter(m => m.id !== mgrId);
        const nextId = remaining.length > 0 ? remaining[0]!.user_id : null;
        await supabase.from('prep_schedules').update({ prep_manager_id: nextId }).eq('id', schedule.id);
        setSchedule({ ...schedule, prep_manager_id: nextId });
        setManagerUsername(remaining.length > 0 ? remaining[0]!.username : '');
      }
    } catch (err) { logger.error('Failed to remove manager:', err); }
  };

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) { showToast(t('prepScheduler.toastInvalidImage', 'Please upload a JPEG, PNG, GIF, or WebP image.'), 'error'); return; }
    if (file.size > 5 * 1024 * 1024) { showToast(t('prepScheduler.toastImageTooLarge', 'Image must be under 5MB.'), 'error'); return; }
    setScreenshotFile(file);
    if (screenshotPreview && screenshotPreview.startsWith('blob:')) URL.revokeObjectURL(screenshotPreview);
    setScreenshotPreview(URL.createObjectURL(file));
  };

  const exportScheduleCSV = () => {
    if (schedule) exportToSpreadsheet(submissions, assignments, schedule);
  };

  // ─── Computed data ────────────────────────────────────────────────
  const dayAssignments = useMemo(() => assignments.filter(a => a.day === activeDay), [assignments, activeDay]);
  const daySubmissions = useMemo(() => {
    if (!schedule) return [];
    const availKey = `${activeDay}_availability` as keyof PrepSubmission;
    return [...submissions]
      .filter(s => {
        if (isSkippedDay(s, activeDay)) return false;
        const avail = (s[availKey] as string[][] | undefined) || []; return avail.length > 0;
      })
      .sort((a, b) => getEffectiveSpeedups(b, activeDay, schedule) - getEffectiveSpeedups(a, activeDay, schedule));
  }, [submissions, activeDay, schedule]);

  const unassignedPlayers = useMemo(() => {
    const assignedIds = new Set(dayAssignments.map(a => a.submission_id));
    return daySubmissions.filter(s => !assignedIds.has(s.id));
  }, [daySubmissions, dayAssignments]);

  const effectiveSlots = useMemo(() => getEffectiveSlots(schedule?.stagger_enabled ?? false), [schedule?.stagger_enabled]);
  const maxSlots = useMemo(() => getMaxSlots(schedule?.stagger_enabled ?? false), [schedule?.stagger_enabled]);

  const availabilityGaps = useMemo(() => {
    if (!schedule) return [];
    const gaps: { slot: string; candidates: number }[] = [];
    const availKey = `${activeDay}_availability` as keyof PrepSubmission;
    for (const slot of effectiveSlots) {
      const candidates = daySubmissions.filter(s => {
        const avail = (s[availKey] as string[][] | undefined) || [];
        return isSlotInAvailability(slot, avail);
      });
      if (candidates.length === 0 && !dayAssignments.find(a => a.slot_time === slot)) {
        gaps.push({ slot, candidates: 0 });
      }
    }
    return gaps;
  }, [daySubmissions, dayAssignments, activeDay, schedule, effectiveSlots]);

  // Update opt-outs for a submission (form fillers can edit their own, managers can edit any)
  const updateSubmissionOptOuts = useCallback(async (submissionId: string, optOuts: { skip_monday: boolean; skip_tuesday: boolean; skip_thursday: boolean }) => {
    if (!supabase || !scheduleId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('prep_submissions').update(optOuts).eq('id', submissionId);
      if (error) throw error;
      showToast(t('prepScheduler.toastOptOutsUpdated', 'Opt-outs updated.'), 'success');
      await fetchSubmissions(scheduleId);
    } catch (err) { logger.error('Failed to update opt-outs:', err); showToast(t('prepScheduler.toastOptOutsFailed', 'Failed to update opt-outs.'), 'error'); }
    setSaving(false);
  }, [scheduleId, fetchSubmissions, showToast, t]);

  // Update any submission's data (for editors/managers editing a player's form)
  const updateAnySubmission = useCallback(async (submissionId: string, data: Partial<PrepSubmission>) => {
    if (!supabase || !scheduleId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('prep_submissions').update(data).eq('id', submissionId);
      if (error) throw error;
      showToast(t('prepScheduler.toastSubmissionEdited', 'Submission updated.'), 'success');
      await fetchSubmissions(scheduleId);
    } catch (err) { logger.error('Failed to update submission:', err); showToast(t('prepScheduler.toastEditFailed', 'Failed to update submission.'), 'error'); }
    setSaving(false);
  }, [scheduleId, fetchSubmissions, showToast, t]);

  // Start a new submission for an alt account (clears form but keeps schedule context)
  const startAltSubmission = () => {
    setExistingSubmission(null);
    setFormUsername('');
    setFormAlliance(profile?.alliance_tag || '');
    setMondayAvail([]);
    setTuesdayAvail([]);
    setThursdayAvail([]);
    setGeneralSpeedups(0);
    setTrainingSpeedups(0);
    setConstructionSpeedups(0);
    setResearchSpeedups(0);
    setGeneralTarget('');
    setGeneralAllocation(null);
    setScreenshotFile(null);
    setScreenshotPreview('');
    setSkipMonday(false);
    setSkipTuesday(false);
    setSkipThursday(false);
  };

  // Switch to editing an existing submission (for multi-account)
  const editSubmission = (sub: PrepSubmission) => {
    setExistingSubmission(sub);
    prefillForm(sub);
  };

  return {
    // Routing
    scheduleId, navigate,
    // Auth
    user, profile, goldKingdoms, hasPromoAccess, isPromoActive, promoMsRemaining,
    // Layout
    isMobile,
    // State
    view, setView, loading, schedule, mySchedules,
    submissions, assignments, isManager, isEditorOrCoEditor,
    activeDay, setActiveDay, saving, managerUsername,
    // Form state
    formUsername, setFormUsername, formAlliance, setFormAlliance,
    mondayAvail, setMondayAvail, tuesdayAvail, setTuesdayAvail,
    thursdayAvail, setThursdayAvail,
    generalSpeedups, setGeneralSpeedups, trainingSpeedups, setTrainingSpeedups,
    constructionSpeedups, setConstructionSpeedups, researchSpeedups, setResearchSpeedups,
    generalTarget, setGeneralTarget,
    generalAllocation, setGeneralAllocation,
    existingSubmission, mySubmissions, screenshotFile, screenshotPreview,
    skipMonday, setSkipMonday, skipTuesday, setSkipTuesday, skipThursday, setSkipThursday,
    fileInputRef,
    // Create state
    createKingdom, setCreateKingdom, createKvkNumber, setCreateKvkNumber,
    createNotes, setCreateNotes, createDeadline, setCreateDeadline,
    createDisabledDays, setCreateDisabledDays,
    // Manager state
    assignManagerInput, setAssignManagerInput, managerSearchResults,
    managers, showManagerDropdown, setShowManagerDropdown, managerSearchRef,
    // Kingdom schedules
    kingdomSchedules, submittedSchedules,
    // Change request state
    changeRequests, showChangeRequestForm, setShowChangeRequestForm,
    changeRequestDay, setChangeRequestDay, changeRequestType, setChangeRequestType,
    changeRequestMessage, setChangeRequestMessage,
    // Non-qualifying popup
    showNonQualifyingPopup, setShowNonQualifyingPopup,
    // Confirmation
    pendingConfirm, setPendingConfirm,
    // Computed
    effectiveSlots, maxSlots,
    dayAssignments, daySubmissions, unassignedPlayers, availabilityGaps,
    // Slot management state
    removingIds,
    // Actions
    createSchedule, closeOrReopenForm, toggleStagger, toggleLock, toggleDisabledDay, notifyScheduleReady, archiveSchedule, deleteSchedule, updateDeadline,
    submitForm, submitChangeRequest, acknowledgeChangeRequest,
    runAutoAssign, assignSlot, removeAssignment, clearDayAssignments,
    copyShareLink, exportScheduleCSV,
    handleScreenshotChange, addManager, removeManagerById,
    startAltSubmission, editSubmission,
    // Refill mode
    isRefilling, setIsRefilling,
    // Submission editing
    updateSubmissionOptOuts, updateAnySubmission,
  };
}
