// ─── KvK Prep Scheduler — Custom Hook ─────────────────────────────────
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useGoldKingdoms } from '../../hooks/useGoldKingdoms';
import { useToast } from '../Toast';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { logger } from '../../utils/logger';
import { RealtimeChannel } from '@supabase/supabase-js';
import {
  PrepSchedule, PrepSubmission, ChangeRequest, SlotAssignment, EditorRecord,
  ManagerEntry, ManagerSearchResult, PendingConfirm,
  SchedulerView, Day, TIME_SLOTS, getDayLabel,
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
  const [existingSubmission, setExistingSubmission] = useState<PrepSubmission | null>(null);
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

  // Prep Manager assignment state (multi-manager)
  const [assignManagerInput, setAssignManagerInput] = useState('');
  const [managerSearchResults, setManagerSearchResults] = useState<ManagerSearchResult[]>([]);
  const [managers, setManagers] = useState<ManagerEntry[]>([]);
  const [showManagerDropdown, setShowManagerDropdown] = useState(false);
  const managerSearchRef = useRef<HTMLDivElement>(null);

  // Kingdom schedules for "Fill The Form" CTA
  const [kingdomSchedules, setKingdomSchedules] = useState<PrepSchedule[]>([]);

  // Change requests state
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [showChangeRequestForm, setShowChangeRequestForm] = useState(false);
  const [changeRequestDay, setChangeRequestDay] = useState<Day>('monday');
  const [changeRequestType, setChangeRequestType] = useState<'cant_attend' | 'change_slot' | 'other'>('cant_attend');
  const [changeRequestMessage, setChangeRequestMessage] = useState('');

  // Non-qualifying popup
  const [showNonQualifyingPopup, setShowNonQualifyingPopup] = useState(false);

  // Confirmation dialog state (replaces native confirm())
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

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
      const all = [...(created || []), ...(managed || []), ...managedNew];
      const unique = all.filter((s, i, arr) => arr.findIndex(x => x.id === s.id) === i);
      setMySchedules(unique);
    } catch (err) { logger.error('Failed to fetch schedules:', err); }
  }, [user?.id]);

  const fetchSchedule = useCallback(async (id: string) => {
    if (!supabase) return;
    try {
      const { data } = await supabase.from('prep_schedules').select('*').eq('id', id).single();
      if (data) {
        setSchedule(data);
        const isCreator = data.created_by === user?.id;
        const isPrepManager = data.prep_manager_id === user?.id;
        setIsManager(isCreator || isPrepManager);
        if (user?.id) {
          const { data: editors } = await supabase.from('kingdom_editors').select('*')
            .eq('kingdom_number', data.kingdom_number).eq('status', 'active');
          setEditorRecords(editors || []);
          const isEditor = (editors || []).some(e => e.user_id === user.id);
          setIsEditorOrCoEditor(isEditor || isCreator);
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
        const mine = data.find((s: PrepSubmission) => s.user_id === user.id);
        if (mine) { setExistingSubmission(mine); prefillForm(mine); }
      }
    } catch (err) { logger.error('Failed to fetch submissions:', err); }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAssignments = useCallback(async (schedId: string) => {
    if (!supabase) return;
    try {
      const { data } = await supabase.from('prep_slot_assignments').select('*').eq('schedule_id', schedId);
      setAssignments(data || []);
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
        () => { fetchAssignments(scheduleId); })
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
              .eq('kingdom_number', profile.linked_kingdom).eq('status', 'active')
              .order('created_at', { ascending: false });
            setKingdomSchedules(ks || []);
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
    if (!goldKingdoms.has(createKingdom)) {
      showToast(t('prepScheduler.toastGoldOnly', 'Only Gold Tier kingdoms can use the KvK Prep Scheduler.'), 'error');
      return;
    }
    setSaving(true);
    try {
      // Check for existing active schedule for this kingdom (+KvK)
      const dupQuery = supabase.from('prep_schedules').select('id').eq('kingdom_number', createKingdom).eq('status', 'active');
      if (createKvkNumber) dupQuery.eq('kvk_number', createKvkNumber);
      const { data: existing } = await dupQuery;
      if (existing && existing.length > 0) {
        showToast(t('prepScheduler.toastDuplicateSchedule', 'An active schedule already exists for this kingdom{{kvk}}. Close or archive it first.', { kvk: createKvkNumber ? ` (KvK #${createKvkNumber})` : '' }), 'error');
        setSaving(false);
        return;
      }
      const { data, error } = await supabase.from('prep_schedules').insert({
        kingdom_number: createKingdom, created_by: user.id,
        kvk_number: createKvkNumber || null, notes: createNotes || null,
        deadline: createDeadline ? new Date(createDeadline).toISOString() : null,
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

  const exportOptedOut = (day: Day) => {
    if (!schedule) return;
    const skipped = submissions.filter(s => isSkippedDay(s, day));
    if (skipped.length === 0) { showToast(t('prepScheduler.toastNoOptedOut', 'No opted-out players for {{day}}.', { day: getDayLabel(day, t) }), 'info'); return; }
    const rows = ['Username,Alliance,Reason'];
    for (const s of skipped) rows.push(`${s.username},${s.alliance_tag || ''},Opted out of ${getDayLabel(day, t)}`);
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `opted-out-${day}-K${schedule.kingdom_number || ''}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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
        general_speedup_target: generalTarget || null,
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
      showToast(t('prepScheduler.toastAutoAssigned', 'Auto-assigned {{count}} slots for {{day}}.', { count: newAssignments.length, day: getDayLabel(day, t) }), 'success');
    } catch (err) { logger.error('Auto-assign failed:', err); showToast(t('prepScheduler.toastAutoAssignFailed', 'Auto-assign failed.'), 'error'); }
    setSaving(false);
  };

  const assignSlot = async (day: Day, slotTime: string, submissionId: string) => {
    if (!supabase || !user?.id || !schedule) return;
    try {
      await supabase.from('prep_slot_assignments').delete().eq('schedule_id', schedule.id).eq('day', day).eq('slot_time', slotTime);
      if (submissionId) {
        await supabase.from('prep_slot_assignments').delete().eq('schedule_id', schedule.id).eq('day', day).eq('submission_id', submissionId);
        await supabase.from('prep_slot_assignments').insert({ schedule_id: schedule.id, submission_id: submissionId, day, slot_time: slotTime, assigned_by: user.id });
      }
      await fetchAssignments(schedule.id);
    } catch (err) { logger.error('Failed to assign slot:', err); }
  };

  const removeAssignment = async (assignmentId: string) => {
    if (!supabase || !schedule || !user?.id) return;
    try {
      const toRemove = assignments.find(a => a.id === assignmentId);
      await supabase.from('prep_slot_assignments').delete().eq('id', assignmentId);
      // Waitlist auto-promotion
      if (toRemove) {
        const day = toRemove.day as Day;
        const slotTime = toRemove.slot_time;
        const currentAssignedIds = new Set(assignments.filter(a => a.day === day && a.id !== assignmentId).map(a => a.submission_id));
        const availKey = `${day}_availability` as keyof PrepSubmission;
        const candidates = submissions
          .filter(s => !currentAssignedIds.has(s.id) && !isSkippedDay(s, day))
          .filter(s => { const avail = (s[availKey] as string[][] | undefined) || []; return isSlotInAvailability(slotTime, avail); })
          .sort((a, b) => getEffectiveSpeedups(b, day, schedule) - getEffectiveSpeedups(a, day, schedule));
        const next = candidates[0];
        if (next) {
          await supabase.from('prep_slot_assignments').insert({ schedule_id: schedule.id, submission_id: next.id, day, slot_time: slotTime, assigned_by: user.id });
        }
      }
      await fetchAssignments(schedule.id);
    } catch (err) { logger.error('Failed to remove assignment:', err); }
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

  const availabilityGaps = useMemo(() => {
    if (!schedule) return [];
    const gaps: { slot: string; candidates: number }[] = [];
    const availKey = `${activeDay}_availability` as keyof PrepSubmission;
    for (const slot of TIME_SLOTS) {
      const candidates = daySubmissions.filter(s => {
        const avail = (s[availKey] as string[][] | undefined) || [];
        return isSlotInAvailability(slot, avail);
      });
      if (candidates.length === 0 && !dayAssignments.find(a => a.slot_time === slot)) {
        gaps.push({ slot, candidates: 0 });
      }
    }
    return gaps;
  }, [daySubmissions, dayAssignments, activeDay, schedule]);

  return {
    // Routing
    scheduleId, navigate,
    // Auth
    user, profile, goldKingdoms,
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
    existingSubmission, screenshotFile, screenshotPreview,
    skipMonday, setSkipMonday, skipTuesday, setSkipTuesday, skipThursday, setSkipThursday,
    fileInputRef,
    // Create state
    createKingdom, setCreateKingdom, createKvkNumber, setCreateKvkNumber,
    createNotes, setCreateNotes, createDeadline, setCreateDeadline,
    // Manager state
    assignManagerInput, setAssignManagerInput, managerSearchResults,
    managers, showManagerDropdown, setShowManagerDropdown, managerSearchRef,
    // Kingdom schedules
    kingdomSchedules,
    // Change request state
    changeRequests, showChangeRequestForm, setShowChangeRequestForm,
    changeRequestDay, setChangeRequestDay, changeRequestType, setChangeRequestType,
    changeRequestMessage, setChangeRequestMessage,
    // Non-qualifying popup
    showNonQualifyingPopup, setShowNonQualifyingPopup,
    // Confirmation
    pendingConfirm, setPendingConfirm,
    // Computed
    dayAssignments, daySubmissions, unassignedPlayers, availabilityGaps,
    // Actions
    createSchedule, closeOrReopenForm, toggleLock, archiveSchedule,
    submitForm, submitChangeRequest, acknowledgeChangeRequest,
    runAutoAssign, assignSlot, removeAssignment,
    copyShareLink, exportScheduleCSV, exportOptedOut,
    handleScreenshotChange, addManager, removeManagerById,
  };
}
