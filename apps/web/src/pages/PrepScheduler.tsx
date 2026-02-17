import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useGoldKingdoms } from '../hooks/useGoldKingdoms';
import { colors, neonGlow, FONT_DISPLAY } from '../utils/styles';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

// ─── Types ─────────────────────────────────────────────────────────────
interface PrepSchedule {
  id: string;
  kingdom_number: number;
  created_by: string;
  prep_manager_id: string | null;
  kvk_number: number | null;
  status: 'active' | 'closed' | 'archived';
  is_locked: boolean;
  monday_buff: string;
  tuesday_buff: string;
  thursday_buff: string;
  notes: string | null;
  deadline: string | null;
  created_at: string;
}

interface PrepSubmission {
  id: string;
  schedule_id: string;
  user_id: string;
  username: string;
  alliance_tag: string | null;
  monday_availability: string[][];
  tuesday_availability: string[][];
  thursday_availability: string[][];
  general_speedups: number;
  training_speedups: number;
  construction_speedups: number;
  research_speedups: number;
  general_speedup_target: string | null;
  screenshot_url: string | null;
  skip_monday: boolean;
  skip_tuesday: boolean;
  skip_thursday: boolean;
  speedup_changed_at: string | null;
  previous_speedups: { general: number; training: number; construction: number; research: number; changed_at: string } | null;
  created_at: string;
}

interface ChangeRequest {
  id: string;
  schedule_id: string;
  submission_id: string;
  user_id: string;
  request_type: 'cant_attend' | 'change_slot' | 'other';
  day: Day | null;
  message: string | null;
  status: 'pending' | 'acknowledged' | 'resolved';
  created_at: string;
}

interface SlotAssignment {
  id: string;
  schedule_id: string;
  submission_id: string;
  day: 'monday' | 'tuesday' | 'thursday';
  slot_time: string;
  assigned_by: string | null;
}

interface EditorRecord {
  user_id: string;
  role: string;
  status: string;
  kingdom_number: number;
}

type SchedulerView = 'landing' | 'form' | 'manage' | 'gate';
type Day = 'monday' | 'tuesday' | 'thursday';

const DAYS: Day[] = ['monday', 'tuesday', 'thursday'];
const DAY_LABELS: Record<Day, string> = { monday: 'Monday', tuesday: 'Tuesday', thursday: 'Thursday' };
const DAY_BUFF_LABELS: Record<string, string> = {
  construction: '🏗️ Construction', research: '🔬 Research', training: '⚔️ Soldier Training',
};
const DAY_COLORS: Record<Day, string> = { monday: '#f59e0b', tuesday: '#3b82f6', thursday: '#ef4444' };

// Generate 30-min time slots (00:00 to 23:30 UTC)
const TIME_SLOTS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 30) {
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
}

// ─── Timezone Helpers ──────────────────────────────────────────────────
const USER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
const UTC_OFFSET_HOURS = -(new Date().getTimezoneOffset() / 60);
const TZ_ABBR = (() => {
  try {
    const parts = new Intl.DateTimeFormat('en', { timeZoneName: 'short' }).formatToParts(new Date());
    return parts.find(p => p.type === 'timeZoneName')?.value || USER_TZ.split('/').pop()?.replace(/_/g, ' ') || USER_TZ;
  } catch { return USER_TZ.split('/').pop()?.replace(/_/g, ' ') || USER_TZ; }
})();

function utcSlotToLocal(utcSlot: string): string {
  // Convert "HH:MM" UTC to local time string
  const [h, m] = utcSlot.split(':').map(Number);
  const d = new Date();
  d.setUTCHours(h ?? 0, m ?? 0, 0, 0);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

// ─── Deadline Helpers ──────────────────────────────────────────────────
function getDeadlineCountdown(deadline: string | null): { text: string; urgent: boolean; expired: boolean } | null {
  if (!deadline) return null;
  const now = Date.now();
  const dl = new Date(deadline).getTime();
  const diff = dl - now;
  if (diff <= 0) return { text: 'Deadline passed', urgent: true, expired: true };
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return { text: `${days}d ${hours}h left`, urgent: days <= 1, expired: false };
  if (hours > 0) return { text: `${hours}h ${mins}m left`, urgent: hours < 6, expired: false };
  return { text: `${mins}m left`, urgent: true, expired: false };
}

// ─── Utility Functions ─────────────────────────────────────────────────
function timeToMinutes(time: string): number {
  const parts = time.split(':').map(Number);
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
}

function getEffectiveSpeedups(sub: PrepSubmission, day: Day, schedule: PrepSchedule): number {
  const buffType = day === 'monday' ? schedule.monday_buff : day === 'tuesday' ? schedule.tuesday_buff : schedule.thursday_buff;
  let base = 0;
  if (buffType === 'construction') base = sub.construction_speedups;
  else if (buffType === 'research') base = sub.research_speedups;
  else if (buffType === 'training') base = sub.training_speedups;
  if (sub.general_speedup_target === buffType) base += sub.general_speedups;
  return base;
}

function isSlotInAvailability(slotTime: string, availability: string[][]): boolean {
  const slotMin = timeToMinutes(slotTime);
  for (const range of availability) {
    if (range.length === 2) {
      const startMin = timeToMinutes(range[0] ?? '00:00');
      const endMin = timeToMinutes(range[1] ?? '00:00');
      if (endMin <= startMin) {
        if (slotMin >= startMin || slotMin < endMin) return true;
      } else {
        if (slotMin >= startMin && slotMin < endMin) return true;
      }
    }
  }
  return false;
}

function formatAvailRanges(ranges: string[][]): string {
  if (!ranges || ranges.length === 0) return '—';
  return ranges.map(r => `${r[0] || '?'}–${r[1] || '?'}`).join(', ');
}

function formatMinutes(totalMinutes: number): string {
  return `${totalMinutes.toLocaleString()}m`;
}

function isSkippedDay(sub: PrepSubmission, day: Day): boolean {
  if (day === 'monday') return sub.skip_monday;
  if (day === 'tuesday') return sub.skip_tuesday;
  if (day === 'thursday') return sub.skip_thursday;
  return false;
}

function autoAssignSlots(submissions: PrepSubmission[], schedule: PrepSchedule, day: Day): { submission_id: string; slot_time: string }[] {
  const availKey = `${day}_availability` as keyof PrepSubmission;
  const sorted = [...submissions]
    .filter(s => {
      if (isSkippedDay(s, day)) return false;
      const avail = (s[availKey] as string[][] | undefined) || []; return avail.length > 0;
    })
    .sort((a, b) => getEffectiveSpeedups(b, day, schedule) - getEffectiveSpeedups(a, day, schedule));

  const assignments: { submission_id: string; slot_time: string }[] = [];
  const usedSlots = new Set<string>();
  const assignedUsers = new Set<string>();

  for (const sub of sorted) {
    if (assignments.length >= 48) break;
    if (assignedUsers.has(sub.id)) continue;
    const avail = (sub[availKey] as string[][] | undefined) || [];
    for (const slot of TIME_SLOTS) {
      if (usedSlots.has(slot)) continue;
      if (isSlotInAvailability(slot, avail)) {
        assignments.push({ submission_id: sub.id, slot_time: slot });
        usedSlots.add(slot);
        assignedUsers.add(sub.id);
        break;
      }
    }
  }
  return assignments;
}

// ─── Spreadsheet Export ────────────────────────────────────────────────
function exportToSpreadsheet(submissions: PrepSubmission[], assignments: SlotAssignment[], schedule: PrepSchedule) {
  // Simple CSV-based multi-tab export using xlsx-like tab separation
  // We'll generate a proper .csv per day and zip them, or generate a single CSV with day headers
  const rows: string[] = [];
  for (const day of DAYS) {
    const dayAssignments = assignments.filter(a => a.day === day).sort((a, b) => a.slot_time.localeCompare(b.slot_time));
    const buffType = day === 'monday' ? schedule.monday_buff : day === 'tuesday' ? schedule.tuesday_buff : schedule.thursday_buff;
    rows.push(`--- ${DAY_LABELS[day]} (${buffType}) ---`);
    rows.push('Slot Time,Username,Alliance,Speedups (minutes)');
    for (const assignment of dayAssignments) {
      const sub = submissions.find(s => s.id === assignment.submission_id);
      if (sub) {
        const effective = getEffectiveSpeedups(sub, day, schedule);
        rows.push(`${assignment.slot_time},${sub.username},${sub.alliance_tag || ''},${effective}`);
      }
    }
    rows.push('');
  }
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `prep-schedule-K${schedule.kingdom_number}${schedule.kvk_number ? `-KvK${schedule.kvk_number}` : ''}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Time Range Picker ─────────────────────────────────────────────────
const TimeRangePicker: React.FC<{
  ranges: string[][]; onChange: (ranges: string[][]) => void; maxRanges?: number; accentColor: string;
}> = ({ ranges, onChange, maxRanges = 3, accentColor }) => {
  const addRange = () => { if (ranges.length < maxRanges) onChange([...ranges, ['10:00', '12:00']]); };
  const removeRange = (idx: number) => { onChange(ranges.filter((_, i) => i !== idx)); };
  const updateRange = (idx: number, pos: 0 | 1, value: string) => {
    const updated = [...ranges]; const current = updated[idx];
    if (!current) return; updated[idx] = [...current]; updated[idx]![pos] = value; onChange(updated);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {ranges.map((range, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <select value={range[0] || '10:00'} onChange={(e) => updateRange(idx, 0, e.target.value)}
            style={{ padding: '0.4rem 0.5rem', backgroundColor: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text, fontSize: '0.8rem' }}>
            {TIME_SLOTS.map(t => <option key={t} value={t}>{t} UTC ({utcSlotToLocal(t)})</option>)}
          </select>
          <span style={{ color: colors.textMuted, fontSize: '0.8rem' }}>to</span>
          <select value={range[1] || '12:00'} onChange={(e) => updateRange(idx, 1, e.target.value)}
            style={{ padding: '0.4rem 0.5rem', backgroundColor: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text, fontSize: '0.8rem' }}>
            {TIME_SLOTS.map(t => <option key={t} value={t}>{t} UTC ({utcSlotToLocal(t)})</option>)}
          </select>
          <button onClick={() => removeRange(idx)} style={{ background: 'none', border: 'none', color: colors.error, cursor: 'pointer', fontSize: '1rem', padding: '0 0.25rem' }}>×</button>
        </div>
      ))}
      {ranges.length < maxRanges && (
        <button onClick={addRange} style={{ padding: '0.3rem 0.6rem', backgroundColor: `${accentColor}15`, border: `1px solid ${accentColor}30`, borderRadius: '6px', color: accentColor, fontSize: '0.75rem', cursor: 'pointer', width: 'fit-content' }}>+ Add Time Range</button>
      )}
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────
const PrepScheduler: React.FC = () => {
  const { scheduleId } = useParams<{ scheduleId?: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const isMobile = useIsMobile();
  const goldKingdoms = useGoldKingdoms();
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
  const [managerSearchResults, setManagerSearchResults] = useState<{ id: string; linked_username: string; username: string; linked_player_id: string | null }[]>([]);
  const [managers, setManagers] = useState<{ id: string; user_id: string; username: string }[]>([]);
  const [showManagerDropdown, setShowManagerDropdown] = useState(false);
  const managerSearchRef = useRef<HTMLDivElement>(null);
  // Kingdom schedules for "Fill The Form" CTA on landing
  const [kingdomSchedules, setKingdomSchedules] = useState<PrepSchedule[]>([]);
  // Change requests state
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [showChangeRequestForm, setShowChangeRequestForm] = useState(false);
  const [changeRequestDay, setChangeRequestDay] = useState<Day>('monday');
  const [changeRequestType, setChangeRequestType] = useState<'cant_attend' | 'change_slot' | 'other'>('cant_attend');
  const [changeRequestMessage, setChangeRequestMessage] = useState('');
  // Non-qualifying popup
  const [showNonQualifyingPopup, setShowNonQualifyingPopup] = useState(false);

  // ─── Styles ────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.5rem 0.75rem', backgroundColor: colors.bg,
    border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.text,
    fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    color: colors.textSecondary, fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem',
  };
  const cardStyle: React.CSSProperties = {
    backgroundColor: colors.cardAlt, borderRadius: '12px', padding: isMobile ? '1rem' : '1.25rem',
    border: `1px solid ${colors.border}`,
  };

  // ─── Data Fetching ─────────────────────────────────────────────────
  const fetchMySchedules = useCallback(async () => {
    if (!user?.id || !supabase) return;
    try {
      // Fetch schedules where user is creator OR prep_manager (legacy) OR in managers table
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
        // Check if current user is manager, creator, or editor/co-editor
        const isCreator = data.created_by === user?.id;
        const isPrepManager = data.prep_manager_id === user?.id;
        setIsManager(isCreator || isPrepManager);
        // Check editor/co-editor status
        if (user?.id) {
          const { data: editors } = await supabase.from('kingdom_editors').select('*')
            .eq('kingdom_number', data.kingdom_number).eq('status', 'active');
          setEditorRecords(editors || []);
          const isEditor = (editors || []).some(e => e.user_id === user.id);
          setIsEditorOrCoEditor(isEditor || isCreator);
        }
        // Fetch manager username if set (legacy single manager)
        if (data.prep_manager_id) {
          const { data: mgr } = await supabase.from('profiles').select('linked_username, username').eq('id', data.prep_manager_id).single();
          if (mgr) setManagerUsername(mgr.linked_username || mgr.username || '');
        }
        // Fetch multi-managers from junction table
        await fetchManagers(data.id);
      }
    } catch (err) { logger.error('Failed to fetch schedule:', err); }
  }, [user?.id]);

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
  }, [user?.id]);

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
        // Also check if current user is in the managers list
        if (user?.id && mgrs.some(m => m.user_id === user.id)) {
          setIsManager(true);
        }
      } else {
        setManagers([]);
      }
    } catch (err) { logger.error('Failed to fetch managers:', err); }
  }, [user?.id]);

  const searchUsers = useCallback(async (query: string) => {
    if (!supabase || query.length < 2) { setManagerSearchResults([]); setShowManagerDropdown(false); return; }
    try {
      // Search by linked_username or linked_player_id
      const { data } = await supabase.from('profiles')
        .select('id, linked_username, username, linked_player_id')
        .or(`linked_username.ilike.%${query}%,linked_player_id.ilike.%${query}%,username.ilike.%${query}%`)
        .limit(8);
      setManagerSearchResults(data || []);
      setShowManagerDropdown((data || []).length > 0);
    } catch { setManagerSearchResults([]); }
  }, []);

  const addManager = async (userId: string, username: string) => {
    if (!supabase || !schedule || !user?.id) return;
    // Check if already added
    if (managers.some(m => m.user_id === userId)) { setAssignManagerInput(''); setShowManagerDropdown(false); return; }
    try {
      const { data, error } = await supabase.from('prep_schedule_managers').insert({
        schedule_id: schedule.id, user_id: userId, assigned_by: user.id,
      }).select().single();
      if (error) throw error;
      if (data) {
        setManagers(prev => [...prev, { id: data.id, user_id: userId, username }]);
        // Also update legacy prep_manager_id if it's the first manager
        if (!schedule.prep_manager_id) {
          await supabase.from('prep_schedules').update({ prep_manager_id: userId }).eq('id', schedule.id);
          setSchedule({ ...schedule, prep_manager_id: userId });
          setManagerUsername(username);
        }
      }
      setAssignManagerInput('');
      setShowManagerDropdown(false);
    } catch (err) { logger.error('Failed to add manager:', err); alert('Failed to add manager.'); }
  };

  const removeManagerById = async (mgrId: string, userId: string) => {
    if (!supabase || !schedule) return;
    try {
      await supabase.from('prep_schedule_managers').delete().eq('id', mgrId);
      setManagers(prev => prev.filter(m => m.id !== mgrId));
      // If removing the legacy prep_manager, update to next manager or null
      if (schedule.prep_manager_id === userId) {
        const remaining = managers.filter(m => m.id !== mgrId);
        const nextId = remaining.length > 0 ? remaining[0]!.user_id : null;
        await supabase.from('prep_schedules').update({ prep_manager_id: nextId }).eq('id', schedule.id);
        setSchedule({ ...schedule, prep_manager_id: nextId });
        setManagerUsername(remaining.length > 0 ? remaining[0]!.username : '');
      }
    } catch (err) { logger.error('Failed to remove manager:', err); }
  };

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

  // ─── Initialization ───────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      if (scheduleId) {
        await fetchSchedule(scheduleId);
        await fetchSubmissions(scheduleId);
        await fetchAssignments(scheduleId);
        await fetchChangeRequests(scheduleId);
      } else {
        await fetchMySchedules();
      }
      if (profile) {
        if (!formUsername && profile.linked_username) setFormUsername(profile.linked_username);
        if (!formAlliance && profile.alliance_tag) setFormAlliance(profile.alliance_tag);
        if (!createKingdom && profile.linked_kingdom) setCreateKingdom(profile.linked_kingdom);
        // Fetch active schedules for user's kingdom (for "Fill The Form" CTA)
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
    const interval = setInterval(check, 30000); // check every 30s
    return () => clearInterval(interval);
  }, [schedule?.id, schedule?.deadline, schedule?.status]);

  // Determine view
  useEffect(() => {
    if (!scheduleId) { setView('landing'); return; }
    if (!user) { setView('gate'); return; }
    if (!profile?.linked_player_id) { setView('gate'); return; }
    if (schedule) { setView(isManager ? 'manage' : 'form'); }
  }, [scheduleId, schedule, isManager, user, profile]);

  // ─── Actions ──────────────────────────────────────────────────────
  const createSchedule = async () => {
    if (!supabase || !user?.id || !createKingdom) return;
    if (!goldKingdoms.has(createKingdom)) {
      alert('Only Gold Tier kingdoms can use the KvK Prep Scheduler. Encourage your kingdom to reach Gold tier through the Kingdom Fund!');
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.from('prep_schedules').insert({
        kingdom_number: createKingdom, created_by: user.id,
        kvk_number: createKvkNumber || null, notes: createNotes || null,
        deadline: createDeadline ? new Date(createDeadline).toISOString() : null,
      }).select().single();
      if (error) throw error;
      if (data) {
        // Notify all kingdom users about the new schedule
        try {
          await supabase.rpc('notify_kingdom_prep_schedule', {
            p_kingdom_number: createKingdom,
            p_schedule_id: data.id,
            p_kvk_number: createKvkNumber || null,
          });
        } catch (notifErr) { logger.error('Failed to send notifications:', notifErr); }
        navigate(`/tools/prep-scheduler/${data.id}`);
      }
    } catch (err) { logger.error('Failed to create schedule:', err); alert('Failed to create schedule.'); }
    setSaving(false);
  };

  const closeOrReopenForm = async () => {
    if (!supabase || !schedule) return;
    const newStatus = schedule.status === 'closed' ? 'active' : 'closed';
    const msg = newStatus === 'closed' ? 'Close the form? No new submissions or edits will be allowed.' : 'Reopen the form for submissions?';
    if (!confirm(msg)) return;
    try {
      await supabase.from('prep_schedules').update({ status: newStatus }).eq('id', schedule.id);
      setSchedule({ ...schedule, status: newStatus });
    } catch (err) { logger.error('Failed to update status:', err); }
  };

  const toggleLock = async () => {
    if (!supabase || !schedule) return;
    const newLocked = !schedule.is_locked;
    const msg = newLocked ? 'Lock the schedule? This marks it as finalized.' : 'Unlock the schedule?';
    if (!confirm(msg)) return;
    try {
      await supabase.from('prep_schedules').update({ is_locked: newLocked }).eq('id', schedule.id);
      setSchedule({ ...schedule, is_locked: newLocked });
    } catch (err) { logger.error('Failed to toggle lock:', err); }
  };

  const archiveSchedule = async () => {
    if (!supabase || !schedule) return;
    if (!confirm('Archive this schedule? It will no longer accept submissions.')) return;
    try {
      await supabase.from('prep_schedules').update({ status: 'archived' }).eq('id', schedule.id);
      setSchedule({ ...schedule, status: 'archived' });
      alert('Schedule archived.');
    } catch (err) { logger.error('Failed to archive:', err); }
  };

  const fetchChangeRequests = useCallback(async (schedId: string) => {
    if (!supabase) return;
    try {
      const { data } = await supabase.from('prep_change_requests').select('*').eq('schedule_id', schedId).order('created_at', { ascending: false });
      setChangeRequests(data || []);
    } catch (err) { logger.error('Failed to fetch change requests:', err); }
  }, []);

  const submitChangeRequest = async () => {
    if (!supabase || !user?.id || !schedule || !existingSubmission) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('prep_change_requests').insert({
        schedule_id: schedule.id, submission_id: existingSubmission.id, user_id: user.id,
        request_type: changeRequestType, day: changeRequestDay, message: changeRequestMessage.trim() || null,
      });
      if (error) throw error;
      alert('Change request submitted! Your Prep Manager will be notified.');
      setShowChangeRequestForm(false); setChangeRequestMessage('');
    } catch (err) { logger.error('Failed to submit change request:', err); alert('Failed to submit request.'); }
    setSaving(false);
  };

  const acknowledgeChangeRequest = async (reqId: string) => {
    if (!supabase || !user?.id) return;
    try {
      await supabase.from('prep_change_requests').update({ status: 'resolved', resolved_at: new Date().toISOString(), resolved_by: user.id }).eq('id', reqId);
      setChangeRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: 'resolved' as const } : r));
    } catch (err) { logger.error('Failed to acknowledge:', err); }
  };

  const exportOptedOut = (day: Day) => {
    const skipped = submissions.filter(s => isSkippedDay(s, day));
    if (skipped.length === 0) { alert(`No opted-out players for ${DAY_LABELS[day]}.`); return; }
    const rows = ['Username,Alliance,Reason'];
    for (const s of skipped) rows.push(`${s.username},${s.alliance_tag || ''},Opted out of ${DAY_LABELS[day]}`);
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `opted-out-${day}-K${schedule?.kingdom_number || ''}.csv`;
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
    if (!formUsername.trim()) { alert('Please enter your username.'); return; }
    const hasAvail = (!skipMonday && mondayAvail.length > 0) || (!skipTuesday && tuesdayAvail.length > 0) || (!skipThursday && thursdayAvail.length > 0);
    if (!hasAvail && !(skipMonday && skipTuesday && skipThursday)) {
      alert('Please add availability for at least one day, or mark all days as skipped.'); return;
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
      alert(existingSubmission ? 'Submission updated!' : 'Submission received! Your Prep Manager will assign you a slot.');
      await fetchSubmissions(scheduleId);
    } catch (err: unknown) { logger.error('Failed to submit:', err); alert(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`); }
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
      alert(`Auto-assigned ${newAssignments.length} slots for ${DAY_LABELS[day]}.`);
    } catch (err) { logger.error('Auto-assign failed:', err); alert('Auto-assign failed.'); }
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
      // Find the assignment details before deleting (for waitlist auto-promotion)
      const toRemove = assignments.find(a => a.id === assignmentId);
      await supabase.from('prep_slot_assignments').delete().eq('id', assignmentId);

      // Waitlist auto-promotion: find next best unassigned player for that day
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
    alert('Link copied! Share it with your kingdom players.');
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

  // Unassigned players for active day
  const unassignedPlayers = useMemo(() => {
    const assignedIds = new Set(dayAssignments.map(a => a.submission_id));
    return daySubmissions.filter(s => !assignedIds.has(s.id));
  }, [daySubmissions, dayAssignments]);

  // Availability gap detection
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

  // ─── Screenshot handling ──────────────────────────────────────────
  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) { alert('Please upload a JPEG, PNG, GIF, or WebP image.'); return; }
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB.'); return; }
    setScreenshotFile(file);
    if (screenshotPreview && screenshotPreview.startsWith('blob:')) URL.revokeObjectURL(screenshotPreview);
    setScreenshotPreview(URL.createObjectURL(file));
  };

  // ─── Render: Loading ──────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ color: colors.textMuted }}>Loading...</div>
      </div>
    );
  }

  // ─── Render: Gate (not logged in or not linked) ───────────────────
  if (view === 'gate') {
    const needsLogin = !user;
    // Save return URL for after login/linking
    if (scheduleId) {
      try { sessionStorage.setItem('prep_return_url', `/tools/prep-scheduler/${scheduleId}`); } catch { /* */ }
    }
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: '420px', textAlign: 'center', padding: '2rem' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#a855f715', border: '2px solid #a855f730', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', fontSize: '1.75rem' }}>
            {needsLogin ? '🔒' : '🔗'}
          </div>
          <h2 style={{ color: colors.text, fontFamily: FONT_DISPLAY, fontSize: '1.5rem', marginBottom: '0.75rem' }}>
            {needsLogin ? 'Sign In Required' : 'Link Your Kingshot Account'}
          </h2>
          <p style={{ color: colors.textMuted, fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            {needsLogin
              ? 'You need to sign in to fill out the KvK Prep form. After signing in, you\'ll be redirected back here.'
              : 'You need to link your Kingshot account to participate in KvK Prep scheduling. This verifies your in-game identity.'}
          </p>
          {needsLogin ? (
            <Link to="/profile" style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1.5rem',
              backgroundColor: '#a855f720', border: '1px solid #a855f750', borderRadius: '8px',
              color: '#a855f7', fontWeight: 600, fontSize: '0.9rem', textDecoration: 'none',
            }}>
              🔑 Sign In to Continue
            </Link>
          ) : (
            <Link to="/profile" style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1.5rem',
              backgroundColor: '#22d3ee20', border: '1px solid #22d3ee50', borderRadius: '8px',
              color: '#22d3ee', fontWeight: 600, fontSize: '0.9rem', textDecoration: 'none',
            }}>
              🔗 Link Your Account
            </Link>
          )}
          <p style={{ color: colors.textMuted, fontSize: '0.7rem', marginTop: '1rem' }}>
            You'll be redirected back to the form after completing this step.
          </p>
        </div>
      </div>
    );
  }

  // ─── Render: Landing ──────────────────────────────────────────────
  if (view === 'landing') {
    // Check for return URL (after login/linking)
    const returnUrl = (() => { try { return sessionStorage.getItem('prep_return_url'); } catch { return null; } })();
    if (returnUrl && user && profile?.linked_player_id) {
      sessionStorage.removeItem('prep_return_url');
      navigate(returnUrl);
      return null;
    }

    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
        <div style={{ padding: isMobile ? '1.5rem 1rem' : '2rem', textAlign: 'center', background: 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)' }}>
          <div style={{ maxWidth: '700px', margin: '0 auto' }}>
            <h1 style={{ fontSize: isMobile ? '1.5rem' : '2rem', fontFamily: FONT_DISPLAY, marginBottom: '0.5rem', letterSpacing: '0.04em' }}>
              <span style={{ color: '#fff' }}>KvK</span>
              <span style={{ ...neonGlow('#a855f7'), marginLeft: '0.5rem' }}>PREP SCHEDULER</span>
            </h1>
            <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.85rem' : '0.95rem', lineHeight: 1.6 }}>
              Coordinate Castle Appointments for your kingdom's Prep Phase. Collect player availability and speedup data, then assign optimal buff slots.
            </p>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem', padding: '0.2rem 0.6rem', backgroundColor: '#ffc30b15', border: '1px solid #ffc30b30', borderRadius: '20px' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#ffc30b' }}>👑 GOLD TIER KINGDOMS ONLY</span>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: '700px', margin: '0 auto', padding: isMobile ? '1rem' : '1.5rem' }}>
          {/* Return notification */}
          {returnUrl && user && !profile?.linked_player_id && (
            <div style={{ ...cardStyle, marginBottom: '1rem', borderColor: '#22d3ee30', backgroundColor: '#22d3ee08' }}>
              <p style={{ color: '#22d3ee', fontSize: '0.8rem', fontWeight: 600 }}>
                🔗 Link your Kingshot account to access the prep form you were invited to.
              </p>
            </div>
          )}

          {/* Fill The Form CTA — for Gold kingdom users who have active schedules */}
          {kingdomSchedules.length > 0 && user && profile?.linked_kingdom && goldKingdoms.has(profile.linked_kingdom) && (
            <div style={{ ...cardStyle, marginBottom: '1.5rem', borderColor: '#a855f730', backgroundColor: '#a855f708' }}>
              <h3 style={{ color: '#a855f7', fontSize: '0.95rem', marginBottom: '0.5rem', fontWeight: 700 }}>📅 Your Kingdom Has an Active Prep Schedule</h3>
              <p style={{ color: colors.textMuted, fontSize: '0.8rem', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                Kingdom {profile.linked_kingdom} has {kingdomSchedules.length === 1 ? 'an active prep schedule' : `${kingdomSchedules.length} active schedules`}. Submit your speedups and availability so your Prep Manager can assign you a slot.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {kingdomSchedules.map(ks => (
                  <button key={ks.id} onClick={() => navigate(`/tools/prep-scheduler/${ks.id}`)}
                    style={{ padding: '0.6rem 1rem', backgroundColor: '#a855f720', border: '1px solid #a855f750', borderRadius: '8px', color: '#a855f7', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', width: 'fit-content', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    📝 Fill The Form{ks.kvk_number ? ` — KvK #${ks.kvk_number}` : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          {user && profile?.linked_kingdom && !goldKingdoms.has(profile.linked_kingdom) && !kingdomSchedules.length && mySchedules.length === 0 && (
            <div style={{ ...cardStyle, marginBottom: '1.5rem', borderColor: '#ffc30b30', backgroundColor: '#ffc30b08' }}>
              <h3 style={{ color: '#ffc30b', fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.5rem' }}>👑 Gold Tier Required</h3>
              <p style={{ color: colors.textMuted, fontSize: '0.8rem', lineHeight: 1.5 }}>
                The KvK Prep Scheduler is available for Gold Tier kingdoms. Encourage your kingdom to reach Gold tier through the Kingdom Fund to unlock this tool!
              </p>
            </div>
          )}

          {user && (profile?.is_admin || (profile?.linked_kingdom && goldKingdoms.has(profile.linked_kingdom))) && (
            <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
              <h3 style={{ color: colors.text, fontSize: '1rem', marginBottom: '0.75rem', fontWeight: 700 }}>📋 Create New Schedule</h3>
              <p style={{ color: colors.textMuted, fontSize: '0.75rem', marginBottom: '1rem', lineHeight: 1.5 }}>
                Create a Prep Schedule for your Gold Tier kingdom. You'll get a shareable link for players to submit their availability and speedups.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Kingdom Number *</label>
                  <input type="number" value={createKingdom || ''} readOnly={!!profile?.linked_kingdom} style={{ ...inputStyle, ...(profile?.linked_kingdom ? { opacity: 0.7, cursor: 'not-allowed', backgroundColor: '#1a1a1a' } : {}) }} onChange={(e) => { if (!profile?.linked_kingdom) setCreateKingdom(parseInt(e.target.value) || 0); }} placeholder="e.g. 172" />
                  {profile?.linked_kingdom && <p style={{ color: colors.textMuted, fontSize: '0.65rem', marginTop: '0.2rem' }}>Auto-filled from your linked kingdom.</p>}
                  {createKingdom > 0 && !goldKingdoms.has(createKingdom) && (
                    <p style={{ color: colors.error, fontSize: '0.7rem', marginTop: '0.25rem' }}>⚠️ Kingdom {createKingdom} is not Gold Tier. Only Gold Tier kingdoms can use this tool.</p>
                  )}
                </div>
                <div>
                  <label style={labelStyle}>KvK Number (optional)</label>
                  <input type="number" value={createKvkNumber || ''} onChange={(e) => setCreateKvkNumber(parseInt(e.target.value) || 0)} placeholder="e.g. 11" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Notes for Players (optional)</label>
                  <textarea value={createNotes} onChange={(e) => setCreateNotes(e.target.value)} placeholder="Any instructions or reminders..." rows={3} maxLength={500} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
                </div>
                <div>
                  <label style={labelStyle}>Submission Deadline (optional)</label>
                  <input type="datetime-local" value={createDeadline} onChange={(e) => setCreateDeadline(e.target.value)} style={inputStyle} />
                  <p style={{ color: colors.textMuted, fontSize: '0.65rem', marginTop: '0.2rem' }}>Form will auto-close when the deadline is reached. Uses your local timezone.</p>
                </div>
                <button onClick={createSchedule} disabled={saving || !createKingdom || !goldKingdoms.has(createKingdom)}
                  style={{ padding: '0.6rem 1.25rem', backgroundColor: createKingdom && goldKingdoms.has(createKingdom) ? '#a855f720' : `${colors.textMuted}10`, border: `1px solid ${createKingdom && goldKingdoms.has(createKingdom) ? '#a855f750' : colors.border}`, borderRadius: '8px', color: createKingdom && goldKingdoms.has(createKingdom) ? '#a855f7' : colors.textMuted, fontSize: '0.85rem', fontWeight: 600, cursor: createKingdom && goldKingdoms.has(createKingdom) ? 'pointer' : 'not-allowed', width: 'fit-content', opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Creating...' : '✨ Create Schedule'}
                </button>
              </div>
            </div>
          )}

          {mySchedules.length > 0 && (
            <div style={cardStyle}>
              <h3 style={{ color: colors.text, fontSize: '1rem', marginBottom: '0.75rem', fontWeight: 700 }}>📁 My Schedules</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {mySchedules.map(s => (
                  <div key={s.id} onClick={() => navigate(`/tools/prep-scheduler/${s.id}`)}
                    style={{ padding: '0.75rem', borderRadius: '8px', cursor: 'pointer', backgroundColor: colors.bg, border: `1px solid ${colors.borderSubtle}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ color: colors.text, fontWeight: 600, fontSize: '0.85rem' }}>Kingdom {s.kingdom_number}</span>
                      {s.kvk_number && <span style={{ color: colors.textMuted, fontSize: '0.75rem', marginLeft: '0.5rem' }}>KvK #{s.kvk_number}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 600, backgroundColor: s.status === 'active' ? `${colors.success}20` : `${colors.textMuted}20`, color: s.status === 'active' ? colors.success : colors.textMuted }}>{s.status}</span>
                      <span style={{ color: colors.textMuted, fontSize: '0.7rem' }}>→</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <Link to="/tools" style={{ color: '#22d3ee', textDecoration: 'none', fontSize: '0.8rem' }}>← Back to Tools</Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render: Player Form ──────────────────────────────────────────
  if (view === 'form' && schedule) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
        <div style={{ padding: isMobile ? '1.5rem 1rem' : '2rem', textAlign: 'center', background: 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)' }}>
          <h1 style={{ fontSize: isMobile ? '1.25rem' : '1.75rem', fontFamily: FONT_DISPLAY, marginBottom: '0.25rem' }}>
            <span style={{ color: '#fff' }}>Kingdom {schedule.kingdom_number}</span>
            <span style={{ ...neonGlow('#a855f7'), marginLeft: '0.5rem' }}>PREP FORM</span>
          </h1>
          {schedule.kvk_number && <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>KvK #{schedule.kvk_number}</p>}
          {schedule.notes && <p style={{ color: '#a855f7', fontSize: '0.8rem', fontStyle: 'italic', marginTop: '0.5rem', maxWidth: '500px', margin: '0.5rem auto 0' }}>{schedule.notes}</p>}
          {(() => { const dl = getDeadlineCountdown(schedule.deadline); return dl && !dl.expired ? (
            <div style={{ marginTop: '0.5rem', padding: '0.3rem 0.8rem', backgroundColor: dl.urgent ? '#ef444415' : '#f59e0b15', border: `1px solid ${dl.urgent ? '#ef444430' : '#f59e0b30'}`, borderRadius: '20px', display: 'inline-block' }}>
              <span style={{ color: dl.urgent ? '#ef4444' : '#f59e0b', fontSize: '0.75rem', fontWeight: 600 }}>⏰ {dl.text}</span>
            </div>
          ) : null; })()}
          {schedule.status === 'closed' && (
            <div style={{ marginTop: '0.5rem', padding: '0.3rem 0.8rem', backgroundColor: '#ef444415', border: '1px solid #ef444430', borderRadius: '20px', display: 'inline-block' }}>
              <span style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 600 }}>🔒 Form is closed — no new submissions or changes allowed</span>
            </div>
          )}
          {existingSubmission && schedule.status !== 'closed' && (
            <div style={{ marginTop: '0.5rem', padding: '0.3rem 0.8rem', backgroundColor: '#22c55e15', border: '1px solid #22c55e30', borderRadius: '20px', display: 'inline-block' }}>
              <span style={{ color: '#22c55e', fontSize: '0.75rem', fontWeight: 600 }}>✅ Editing your existing response</span>
            </div>
          )}
        </div>

        <div style={{ maxWidth: '600px', margin: '0 auto', padding: isMobile ? '1rem' : '1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* View My Slot — show if player has been assigned a slot */}
            {existingSubmission && assignments.filter(a => a.submission_id === existingSubmission.id).length > 0 && (
              <div style={{ ...cardStyle, borderColor: '#22c55e30', backgroundColor: '#22c55e08' }}>
                <h4 style={{ color: '#22c55e', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>🗓️ Your Assigned Slots</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {DAYS.map(day => {
                    const mySlots = assignments.filter(a => a.submission_id === existingSubmission.id && a.day === day);
                    if (mySlots.length === 0) return null;
                    const buffType = day === 'monday' ? schedule.monday_buff : day === 'tuesday' ? schedule.tuesday_buff : schedule.thursday_buff;
                    return (
                      <div key={day} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.5rem', backgroundColor: `${DAY_COLORS[day]}10`, borderRadius: '6px', border: `1px solid ${DAY_COLORS[day]}20` }}>
                        <span style={{ color: DAY_COLORS[day], fontSize: '0.8rem', fontWeight: 600, minWidth: '70px' }}>{DAY_LABELS[day]}</span>
                        <span style={{ color: colors.textMuted, fontSize: '0.7rem' }}>{DAY_BUFF_LABELS[buffType]}</span>
                        <span style={{ marginLeft: 'auto', color: DAY_COLORS[day], fontSize: '0.8rem', fontWeight: 700, fontFamily: 'monospace' }}>
                          {mySlots.map(s => s.slot_time).join(', ')} UTC
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <p style={{ color: colors.textMuted, fontSize: '0.7rem', margin: 0 }}>Be online at these times to receive the buff.</p>
                  <button onClick={() => setShowChangeRequestForm(true)} style={{ padding: '0.25rem 0.6rem', backgroundColor: '#f59e0b15', border: '1px solid #f59e0b30', borderRadius: '4px', color: '#f59e0b', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}>🔄 Request Change</button>
                </div>
              </div>
            )}

            {/* Non-qualifying popup — show when user has submission but NO slots assigned and schedule is locked */}
            {existingSubmission && schedule.is_locked && assignments.filter(a => a.submission_id === existingSubmission.id).length === 0 && !showNonQualifyingPopup && (
              <div style={{ ...cardStyle, borderColor: '#ef444430', backgroundColor: '#ef444408' }}>
                <h4 style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>❌ You were not assigned a slot</h4>
                <p style={{ color: colors.textMuted, fontSize: '0.75rem', marginBottom: '0.5rem', lineHeight: 1.5 }}>
                  The schedule has been locked and you did not receive an appointment slot. This may be due to the 48-user limit per day or scheduling conflicts.
                </p>
                <button onClick={() => setShowNonQualifyingPopup(true)} style={{ padding: '0.4rem 0.8rem', backgroundColor: '#a855f715', border: '1px solid #a855f730', borderRadius: '6px', color: '#a855f7', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>📊 View Report</button>
              </div>
            )}

            {/* Username & Alliance */}
            <div style={cardStyle}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Username *</label>
                  <input type="text" value={formUsername} onChange={(e) => setFormUsername(e.target.value)} placeholder="In-game username" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Alliance</label>
                  <input type="text" value={formAlliance} onChange={(e) => setFormAlliance(e.target.value)} placeholder="e.g. ABC" style={inputStyle} />
                </div>
              </div>
            </div>

            {/* Availability per day */}
            {DAYS.map(day => {
              const isSkipped = day === 'monday' ? skipMonday : day === 'tuesday' ? skipTuesday : skipThursday;
              const setSkipped = day === 'monday' ? setSkipMonday : day === 'tuesday' ? setSkipTuesday : setSkipThursday;
              const buffType = day === 'monday' ? schedule.monday_buff : day === 'tuesday' ? schedule.tuesday_buff : schedule.thursday_buff;
              return (
                <div key={day} style={{ ...cardStyle, borderColor: `${DAY_COLORS[day]}30`, opacity: isSkipped ? 0.6 : 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label style={{ ...labelStyle, marginBottom: 0, color: DAY_COLORS[day] }}>
                      {DAY_LABELS[day]} — {DAY_BUFF_LABELS[buffType]}
                    </label>
                    {day !== 'monday' && !isSkipped && (
                      <button onClick={() => {
                        if (day === 'tuesday') setTuesdayAvail([...mondayAvail]);
                        if (day === 'thursday') setThursdayAvail([...tuesdayAvail]);
                      }} style={{ padding: '0.2rem 0.5rem', backgroundColor: `${DAY_COLORS[day]}10`, border: `1px solid ${DAY_COLORS[day]}30`, borderRadius: '4px', color: DAY_COLORS[day], fontSize: '0.65rem', cursor: 'pointer' }}>
                        Copy from {day === 'tuesday' ? 'Monday' : 'Tuesday'}
                      </button>
                    )}
                  </div>
                  {/* Opt-out checkbox */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: isSkipped ? 0 : '0.5rem' }}>
                    <input type="checkbox" checked={isSkipped} onChange={(e) => setSkipped(e.target.checked)}
                      style={{ width: '14px', height: '14px', accentColor: DAY_COLORS[day], cursor: 'pointer' }} />
                    <span style={{ color: isSkipped ? DAY_COLORS[day] : colors.textMuted, fontSize: '0.75rem', fontWeight: isSkipped ? 600 : 400 }}>
                      I don't need this buff
                    </span>
                  </label>
                  {!isSkipped && (
                    <>
                      <p style={{ color: colors.textMuted, fontSize: '0.7rem', marginBottom: '0.5rem' }}>Select up to 3 time ranges when you can play (UTC). <span style={{ color: '#a855f7' }}>Your timezone: {TZ_ABBR} (UTC{UTC_OFFSET_HOURS >= 0 ? '+' : ''}{UTC_OFFSET_HOURS})</span></p>
                      <TimeRangePicker
                        ranges={day === 'monday' ? mondayAvail : day === 'tuesday' ? tuesdayAvail : thursdayAvail}
                        onChange={day === 'monday' ? setMondayAvail : day === 'tuesday' ? setTuesdayAvail : setThursdayAvail}
                        accentColor={DAY_COLORS[day]}
                      />
                    </>
                  )}
                </div>
              );
            })}

            {/* Speedups */}
            <div style={cardStyle}>
              <label style={{ ...labelStyle, marginBottom: '0.5rem', fontSize: '0.85rem' }}>⏱️ Speedups (in minutes)</label>
              <p style={{ color: colors.textMuted, fontSize: '0.7rem', marginBottom: '0.75rem' }}>Total minutes of each speedup type you plan to use this KvK Prep Phase.</p>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.75rem' }}>
                <div><label style={labelStyle}>🔧 General</label><input type="number" value={generalSpeedups || ''} onChange={(e) => setGeneralSpeedups(parseInt(e.target.value) || 0)} placeholder="0" style={inputStyle} min={0} /></div>
                <div><label style={labelStyle}>⚔️ Training</label><input type="number" value={trainingSpeedups || ''} onChange={(e) => setTrainingSpeedups(parseInt(e.target.value) || 0)} placeholder="0" style={inputStyle} min={0} /></div>
                <div><label style={labelStyle}>🏗️ Construction</label><input type="number" value={constructionSpeedups || ''} onChange={(e) => setConstructionSpeedups(parseInt(e.target.value) || 0)} placeholder="0" style={inputStyle} min={0} /></div>
                <div><label style={labelStyle}>🔬 Research</label><input type="number" value={researchSpeedups || ''} onChange={(e) => setResearchSpeedups(parseInt(e.target.value) || 0)} placeholder="0" style={inputStyle} min={0} /></div>
              </div>
            </div>

            {/* General Speedup Target */}
            <div style={cardStyle}>
              <label style={labelStyle}>Where will you spend most of your General Speedups?</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                {(['construction', 'research', 'training'] as const).map(t => (
                  <button key={t} onClick={() => setGeneralTarget(t)}
                    style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem',
                      backgroundColor: generalTarget === t ? `${t === 'construction' ? DAY_COLORS.monday : t === 'research' ? DAY_COLORS.tuesday : DAY_COLORS.thursday}20` : 'transparent',
                      border: `1px solid ${generalTarget === t ? `${t === 'construction' ? DAY_COLORS.monday : t === 'research' ? DAY_COLORS.tuesday : DAY_COLORS.thursday}50` : colors.border}`,
                      color: generalTarget === t ? (t === 'construction' ? DAY_COLORS.monday : t === 'research' ? DAY_COLORS.tuesday : DAY_COLORS.thursday) : colors.textMuted,
                      fontWeight: generalTarget === t ? 600 : 400 }}>
                    {DAY_BUFF_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            {/* Screenshot Upload */}
            <div style={cardStyle}>
              <label style={labelStyle}>📸 Screenshot Proof (optional)</label>
              <p style={{ color: colors.textMuted, fontSize: '0.7rem', marginBottom: '0.5rem' }}>Upload a screenshot of your speedups. JPEG, PNG, GIF, or WebP. Max 5MB.</p>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={handleScreenshotChange} style={{ display: 'none' }} />
              <button onClick={() => fileInputRef.current?.click()}
                style={{ padding: '0.4rem 0.75rem', backgroundColor: `${colors.primary}15`, border: `1px solid ${colors.primary}30`, borderRadius: '6px', color: colors.primary, fontSize: '0.8rem', cursor: 'pointer' }}>
                {screenshotPreview ? '📷 Change Screenshot' : '📷 Upload Screenshot'}
              </button>
              {screenshotPreview && (
                <div style={{ marginTop: '0.5rem' }}>
                  <img src={screenshotPreview} alt="Screenshot preview" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', border: `1px solid ${colors.border}` }} />
                </div>
              )}
            </div>

            {/* Submit */}
            {schedule.status === 'closed' ? (
              <div style={{ padding: '0.75rem 1.5rem', backgroundColor: '#ef444410', border: '1px solid #ef444430', borderRadius: '10px', textAlign: 'center' }}>
                <span style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 600 }}>🔒 Form is closed — submissions are locked</span>
              </div>
            ) : (
              <button onClick={submitForm} disabled={saving || !formUsername.trim()}
                style={{ padding: '0.75rem 1.5rem', backgroundColor: '#a855f720', border: '1px solid #a855f750', borderRadius: '10px', color: '#a855f7', fontSize: '0.9rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Submitting...' : existingSubmission ? '✏️ Update Submission' : '📤 Submit'}
              </button>
            )}

            <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
              <Link to="/tools" style={{ color: '#22d3ee', textDecoration: 'none', fontSize: '0.8rem' }}>← Back to Tools</Link>
            </div>
          </div>
        </div>

        {/* Change Request Modal */}
        {showChangeRequestForm && existingSubmission && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '1rem' }} onClick={() => setShowChangeRequestForm(false)}>
            <div onClick={e => e.stopPropagation()} style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '1.25rem', width: '100%', maxWidth: '400px' }}>
              <h4 style={{ color: colors.text, fontSize: '0.95rem', margin: '0 0 1rem', fontWeight: 600 }}>🔄 Request Slot Change</h4>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={labelStyle}>Type</label>
                <select value={changeRequestType} onChange={e => setChangeRequestType(e.target.value as 'cant_attend' | 'change_slot' | 'other')} style={{ ...inputStyle, width: '100%' }}>
                  <option value="cant_attend">❌ Can't attend my assigned slot</option>
                  <option value="change_slot">🔄 Need a different time</option>
                  <option value="other">💬 Other</option>
                </select>
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={labelStyle}>Day</label>
                <select value={changeRequestDay} onChange={e => setChangeRequestDay(e.target.value as Day)} style={{ ...inputStyle, width: '100%' }}>
                  {DAYS.map(d => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Message (optional)</label>
                <textarea value={changeRequestMessage} onChange={e => setChangeRequestMessage(e.target.value)} placeholder="Explain your situation..." rows={3} maxLength={500} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowChangeRequestForm(false)} style={{ padding: '0.5rem 1rem', backgroundColor: colors.border, border: 'none', borderRadius: '6px', color: colors.textSecondary, fontSize: '0.8rem', cursor: 'pointer' }}>Cancel</button>
                <button onClick={submitChangeRequest} disabled={saving} style={{ padding: '0.5rem 1rem', backgroundColor: '#a855f720', border: '1px solid #a855f750', borderRadius: '6px', color: '#a855f7', fontSize: '0.8rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Sending...' : 'Submit Request'}</button>
              </div>
            </div>
          </div>
        )}

        {/* Non-Qualifying Report Popup */}
        {showNonQualifyingPopup && existingSubmission && schedule && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '1rem' }} onClick={() => setShowNonQualifyingPopup(false)}>
            <div onClick={e => e.stopPropagation()} style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '1.25rem', width: '100%', maxWidth: '420px' }}>
              <h4 style={{ color: colors.text, fontSize: '0.95rem', margin: '0 0 0.75rem', fontWeight: 600 }}>📊 Your Prep Report</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {DAYS.map(day => {
                  const isSkipped = isSkippedDay(existingSubmission, day);
                  const effective = getEffectiveSpeedups(existingSubmission, day, schedule);
                  const buffType = day === 'monday' ? schedule.monday_buff : day === 'tuesday' ? schedule.tuesday_buff : schedule.thursday_buff;
                  const availKey = `${day}_availability` as keyof PrepSubmission;
                  const avail = (existingSubmission[availKey] as string[][] | undefined) || [];
                  const hasSlot = assignments.some(a => a.submission_id === existingSubmission.id && a.day === day);
                  return (
                    <div key={day} style={{ padding: '0.5rem', borderRadius: '6px', border: `1px solid ${isSkipped ? colors.border : hasSlot ? '#22c55e30' : '#ef444430'}`, backgroundColor: isSkipped ? `${colors.textMuted}05` : hasSlot ? '#22c55e08' : '#ef444408' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span style={{ color: isSkipped ? colors.textMuted : hasSlot ? '#22c55e' : '#ef4444', fontSize: '0.8rem', fontWeight: 700 }}>{DAY_LABELS[day]}</span>
                        <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>{DAY_BUFF_LABELS[buffType]}</span>
                        <span style={{ marginLeft: 'auto', fontSize: '0.7rem', fontWeight: 600, color: isSkipped ? '#f59e0b' : hasSlot ? '#22c55e' : '#ef4444' }}>
                          {isSkipped ? '⏭ Opted Out' : hasSlot ? '✅ Qualified' : '❌ Not Selected'}
                        </span>
                      </div>
                      {!isSkipped && (
                        <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.7rem', color: colors.textMuted }}>
                          <span>Speedups: {formatMinutes(effective)}</span>
                          <span>Availability: {avail.length > 0 ? formatAvailRanges(avail) : 'None'}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <button onClick={() => setShowNonQualifyingPopup(false)} style={{ marginTop: '1rem', padding: '0.5rem 1rem', backgroundColor: colors.border, border: 'none', borderRadius: '6px', color: colors.textSecondary, fontSize: '0.8rem', cursor: 'pointer', width: '100%' }}>Close</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Render: Manager View ─────────────────────────────────────────
  if (view === 'manage' && schedule) {
    const assignedCount = dayAssignments.length;
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
        {/* Header */}
        <div style={{ padding: isMobile ? '1rem' : '1.5rem 2rem', background: 'linear-gradient(180deg, #111111 0%, #0a0a0a 100%)' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h1 style={{ fontSize: isMobile ? '1.1rem' : '1.5rem', fontFamily: FONT_DISPLAY, margin: 0 }}>
                  <span style={{ color: '#fff' }}>K{schedule.kingdom_number}</span>
                  <span style={{ color: '#a855f7', marginLeft: '0.5rem' }}>Prep Manager</span>
                  {schedule.kvk_number && <span style={{ color: colors.textMuted, fontSize: '0.8rem', marginLeft: '0.5rem' }}>KvK #{schedule.kvk_number}</span>}
                </h1>
                <p style={{ color: colors.textMuted, fontSize: '0.75rem', margin: '0.25rem 0 0' }}>
                  {submissions.length} submissions · {assignedCount}/48 slots for {DAY_LABELS[activeDay]}
                  {(() => { const skipCount = submissions.filter(s => isSkippedDay(s, activeDay)).length; return skipCount > 0 ? <span style={{ color: '#f59e0b' }}> · {skipCount} skipped {DAY_LABELS[activeDay]}</span> : null; })()}
                  {managerUsername && <span> · Manager: <span style={{ color: '#a855f7' }}>{managerUsername}</span></span>}
                  {schedule.status === 'archived' && <span style={{ marginLeft: '0.5rem', padding: '0.1rem 0.4rem', backgroundColor: `${colors.textMuted}20`, borderRadius: '4px', fontSize: '0.65rem', color: colors.textMuted }}>ARCHIVED</span>}
                  {schedule.status === 'closed' && <span style={{ marginLeft: '0.5rem', padding: '0.1rem 0.4rem', backgroundColor: '#ef444420', borderRadius: '4px', fontSize: '0.65rem', color: '#ef4444', fontWeight: 600 }}>🔒 FORM CLOSED</span>}
                  {schedule.is_locked && <span style={{ marginLeft: '0.5rem', padding: '0.1rem 0.4rem', backgroundColor: '#22c55e20', borderRadius: '4px', fontSize: '0.65rem', color: '#22c55e', fontWeight: 600 }}>✅ LOCKED IN</span>}
                  {changeRequests.filter(r => r.status === 'pending').length > 0 && <span style={{ marginLeft: '0.5rem', padding: '0.1rem 0.4rem', backgroundColor: '#ef444420', borderRadius: '4px', fontSize: '0.65rem', color: '#ef4444', fontWeight: 600 }}>🔔 {changeRequests.filter(r => r.status === 'pending').length} change request{changeRequests.filter(r => r.status === 'pending').length !== 1 ? 's' : ''}</span>}
                  {(() => { const dl = getDeadlineCountdown(schedule.deadline); return dl ? <span style={{ marginLeft: '0.5rem', padding: '0.1rem 0.4rem', backgroundColor: dl.urgent ? '#ef444420' : '#f59e0b20', borderRadius: '4px', fontSize: '0.65rem', color: dl.urgent ? '#ef4444' : '#f59e0b', fontWeight: 600 }}>⏰ {dl.text}</span> : null; })()}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button onClick={copyShareLink} style={{ padding: '0.4rem 0.75rem', backgroundColor: `${colors.primary}15`, border: `1px solid ${colors.primary}30`, borderRadius: '6px', color: colors.primary, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>🔗 Copy Form Link</button>
                <button onClick={() => exportToSpreadsheet(submissions, assignments, schedule)} style={{ padding: '0.4rem 0.75rem', backgroundColor: '#22c55e15', border: '1px solid #22c55e30', borderRadius: '6px', color: '#22c55e', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>📊 Export CSV</button>
                <button onClick={() => exportOptedOut(activeDay)} style={{ padding: '0.4rem 0.75rem', backgroundColor: '#f59e0b15', border: '1px solid #f59e0b30', borderRadius: '6px', color: '#f59e0b', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>📋 Opted-Out CSV</button>
                <button onClick={() => setView('form')} style={{ padding: '0.4rem 0.75rem', backgroundColor: '#a855f715', border: '1px solid #a855f730', borderRadius: '6px', color: '#a855f7', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>📝 View Form</button>
                {schedule.status !== 'archived' && (isEditorOrCoEditor || isManager) && (
                  <button onClick={closeOrReopenForm} style={{ padding: '0.4rem 0.75rem', backgroundColor: schedule.status === 'closed' ? '#22c55e15' : '#ef444415', border: `1px solid ${schedule.status === 'closed' ? '#22c55e30' : '#ef444430'}`, borderRadius: '6px', color: schedule.status === 'closed' ? '#22c55e' : '#ef4444', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>{schedule.status === 'closed' ? '🔓 Reopen Form' : '🔒 Close Form'}</button>
                )}
                {schedule.status !== 'archived' && (isEditorOrCoEditor || isManager) && (
                  <button onClick={toggleLock} style={{ padding: '0.4rem 0.75rem', backgroundColor: schedule.is_locked ? '#f59e0b15' : '#22c55e15', border: `1px solid ${schedule.is_locked ? '#f59e0b30' : '#22c55e30'}`, borderRadius: '6px', color: schedule.is_locked ? '#f59e0b' : '#22c55e', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>{schedule.is_locked ? '🔓 Unlock Schedule' : '✅ Lock In Schedule'}</button>
                )}
                {schedule.status === 'active' && isEditorOrCoEditor && (
                  <button onClick={archiveSchedule} style={{ padding: '0.4rem 0.75rem', backgroundColor: `${colors.textMuted}10`, border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.textMuted, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>📦 Archive</button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '0.75rem' : '1rem 2rem' }}>
          {/* Prep Manager Assignment (editor/co-editor only) — Multi-manager with search */}
          {isEditorOrCoEditor && (
            <div style={{ ...cardStyle, marginBottom: '1rem', borderColor: '#a855f730' }}>
              <h4 style={{ color: '#a855f7', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem' }}>👤 Prep Managers</h4>
              {/* Current managers chips */}
              {managers.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.5rem' }}>
                  {managers.map(mgr => (
                    <div key={mgr.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.5rem', backgroundColor: '#a855f715', border: '1px solid #a855f730', borderRadius: '20px' }}>
                      <span style={{ color: '#a855f7', fontSize: '0.75rem', fontWeight: 600 }}>{mgr.username}</span>
                      <button onClick={() => removeManagerById(mgr.id, mgr.user_id)} style={{ background: 'none', border: 'none', color: colors.error, cursor: 'pointer', fontSize: '0.8rem', padding: '0 0.1rem', lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
              {/* Search input with autocomplete dropdown */}
              <div ref={managerSearchRef} style={{ position: 'relative' }}>
                <input
                  value={assignManagerInput}
                  onChange={(e) => setAssignManagerInput(e.target.value)}
                  onFocus={() => { if (managerSearchResults.length > 0) setShowManagerDropdown(true); }}
                  placeholder="Search by username or player ID..."
                  style={{ ...inputStyle, width: isMobile ? '100%' : '280px' }}
                />
                {showManagerDropdown && managerSearchResults.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: isMobile ? 0 : 'auto',
                    width: isMobile ? '100%' : '280px', backgroundColor: '#1a1a1a', border: `1px solid ${colors.border}`,
                    borderRadius: '8px', marginTop: '2px', zIndex: 50, maxHeight: '200px', overflowY: 'auto',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                  }}>
                    {managerSearchResults.map(u => {
                      const alreadyAdded = managers.some(m => m.user_id === u.id);
                      return (
                        <button
                          key={u.id}
                          onClick={() => !alreadyAdded && addManager(u.id, u.linked_username || u.username)}
                          disabled={alreadyAdded}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%',
                            padding: '0.5rem 0.75rem', background: 'none', border: 'none', borderBottom: `1px solid ${colors.borderSubtle}`,
                            color: alreadyAdded ? colors.textMuted : colors.text, fontSize: '0.8rem', textAlign: 'left',
                            cursor: alreadyAdded ? 'default' : 'pointer', opacity: alreadyAdded ? 0.5 : 1,
                          }}
                          onMouseEnter={(e) => { if (!alreadyAdded) e.currentTarget.style.backgroundColor = '#252525'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          <span style={{ fontWeight: 600 }}>{u.linked_username || u.username}</span>
                          {u.linked_player_id && <span style={{ color: colors.textMuted, fontSize: '0.7rem' }}>ID: {u.linked_player_id}</span>}
                          {alreadyAdded && <span style={{ marginLeft: 'auto', color: '#a855f7', fontSize: '0.65rem' }}>✓ Added</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {managers.length === 0 && <p style={{ color: colors.textMuted, fontSize: '0.7rem', marginTop: '0.35rem' }}>No managers assigned yet. Search and add Prep Managers above.</p>}
            </div>
          )}

          {/* Change Requests Panel */}
          {(isManager || isEditorOrCoEditor) && changeRequests.filter(r => r.status === 'pending').length > 0 && (
            <div style={{ ...cardStyle, marginBottom: '1rem', borderColor: '#ef444430', backgroundColor: '#ef444408' }}>
              <h4 style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem' }}>🔔 Pending Change Requests</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {changeRequests.filter(r => r.status === 'pending').map(req => {
                  const sub = submissions.find(s => s.id === req.submission_id);
                  return (
                    <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.6rem', backgroundColor: '#1a1a1a', borderRadius: '6px', border: '1px solid #2a2a2a', flexWrap: 'wrap' }}>
                      <span style={{ color: '#ef4444', fontSize: '0.7rem', fontWeight: 600 }}>{req.request_type === 'cant_attend' ? '❌' : req.request_type === 'change_slot' ? '🔄' : '💬'}</span>
                      <span style={{ color: colors.text, fontSize: '0.75rem', fontWeight: 600 }}>{sub?.username || 'Unknown'}</span>
                      {req.day && <span style={{ color: DAY_COLORS[req.day as Day], fontSize: '0.65rem' }}>{DAY_LABELS[req.day as Day]}</span>}
                      <span style={{ color: colors.textMuted, fontSize: '0.7rem', flex: 1 }}>{req.message || req.request_type.replace('_', ' ')}</span>
                      <button onClick={() => acknowledgeChangeRequest(req.id)} style={{ padding: '0.2rem 0.5rem', backgroundColor: '#22c55e15', border: '1px solid #22c55e30', borderRadius: '4px', color: '#22c55e', fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer' }}>✓ Resolve</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Day Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            {DAYS.map(day => {
              const dayCount = assignments.filter(a => a.day === day).length;
              return (
                <button key={day} onClick={() => setActiveDay(day)}
                  style={{ padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: activeDay === day ? 700 : 400, flex: isMobile ? 1 : undefined,
                    backgroundColor: activeDay === day ? `${DAY_COLORS[day]}20` : 'transparent',
                    border: `1px solid ${activeDay === day ? `${DAY_COLORS[day]}50` : colors.border}`,
                    color: activeDay === day ? DAY_COLORS[day] : colors.textMuted }}>
                  {DAY_LABELS[day]} ({dayCount}/48)
                </button>
              );
            })}
          </div>

          {/* Auto-assign + Stats */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={() => runAutoAssign(activeDay)} disabled={saving || daySubmissions.length === 0}
              style={{ padding: '0.5rem 1rem', backgroundColor: `${DAY_COLORS[activeDay]}20`, border: `1px solid ${DAY_COLORS[activeDay]}50`, borderRadius: '8px', color: DAY_COLORS[activeDay], fontSize: '0.8rem', fontWeight: 600, cursor: daySubmissions.length > 0 ? 'pointer' : 'not-allowed', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Assigning...' : `⚡ Auto-Assign ${DAY_LABELS[activeDay]}`}
            </button>
            <span style={{ color: colors.textMuted, fontSize: '0.75rem' }}>
              {daySubmissions.length} available · {unassignedPlayers.length} unassigned
              {availabilityGaps.length > 0 && <span style={{ color: colors.error }}> · {availabilityGaps.length} uncovered slots</span>}
            </span>
          </div>

          {/* Unassigned Players Warning */}
          {unassignedPlayers.length > 0 && dayAssignments.length > 0 && (
            <div style={{ ...cardStyle, marginBottom: '1rem', borderColor: '#f59e0b30', backgroundColor: '#f59e0b08' }}>
              <h4 style={{ color: '#f59e0b', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                ⚠️ {unassignedPlayers.length} Unassigned Player{unassignedPlayers.length !== 1 ? 's' : ''} — Waitlist
              </h4>
              <p style={{ color: colors.textMuted, fontSize: '0.7rem', marginBottom: '0.5rem' }}>
                These players have availability for {DAY_LABELS[activeDay]} but weren't assigned a slot. You can manually assign them using the dropdowns below.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {unassignedPlayers.slice(0, 12).map(sub => (
                  <span key={sub.id} style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', backgroundColor: '#f59e0b15', border: '1px solid #f59e0b25', color: '#f59e0b' }}>
                    {sub.username} ({formatMinutes(getEffectiveSpeedups(sub, activeDay, schedule))})
                  </span>
                ))}
                {unassignedPlayers.length > 12 && <span style={{ color: colors.textMuted, fontSize: '0.7rem', alignSelf: 'center' }}>+{unassignedPlayers.length - 12} more</span>}
              </div>
            </div>
          )}

          {/* Two-column layout: 75% submissions / 25% slots */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '3fr 1fr', gap: '1rem' }}>
            {/* Submissions Table */}
            <div style={cardStyle}>
              <h3 style={{ color: DAY_COLORS[activeDay], fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>📊 Submissions — {DAY_LABELS[activeDay]}</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                  <thead><tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <th style={{ textAlign: 'center', padding: '0.4rem', color: colors.textMuted, fontWeight: 600, width: '30px' }}>#</th>
                    <th style={{ textAlign: 'left', padding: '0.4rem', color: colors.textMuted, fontWeight: 600 }}>Alliance</th>
                    <th style={{ textAlign: 'left', padding: '0.4rem', color: colors.textMuted, fontWeight: 600 }}>Username</th>
                    <th style={{ textAlign: 'right', padding: '0.4rem', color: colors.textMuted, fontWeight: 600 }}>Speedups</th>
                    <th style={{ textAlign: 'center', padding: '0.4rem', color: colors.textMuted, fontWeight: 600 }}>Proof</th>
                    <th style={{ textAlign: 'left', padding: '0.4rem', color: colors.textMuted, fontWeight: 600 }}>Availability</th>
                    <th style={{ textAlign: 'center', padding: '0.4rem', color: colors.textMuted, fontWeight: 600 }}>Slot</th>
                  </tr></thead>
                  <tbody>
                    {daySubmissions.map((sub, idx) => {
                      const effective = getEffectiveSpeedups(sub, activeDay, schedule);
                      const assignment = dayAssignments.find(a => a.submission_id === sub.id);
                      const availKey = `${activeDay}_availability` as keyof PrepSubmission;
                      const avail = (sub[availKey] as string[][] | undefined) || [];
                      const rank = idx + 1;
                      const isBeyondCutoff = rank > 48;
                      const hasChanged = !!sub.speedup_changed_at;
                      return (
                        <tr key={sub.id} style={{ borderBottom: `1px solid ${isBeyondCutoff ? '#ef444430' : colors.borderSubtle}`, backgroundColor: isBeyondCutoff ? '#ef444410' : assignment ? `${DAY_COLORS[activeDay]}08` : 'transparent' }}>
                          <td style={{ padding: '0.4rem', textAlign: 'center', color: isBeyondCutoff ? '#ef4444' : DAY_COLORS[activeDay], fontWeight: 700, fontSize: '0.7rem' }}>{rank}{isBeyondCutoff && <span title="Beyond 48-user cutoff" style={{ display: 'block', fontSize: '0.5rem', color: '#ef4444' }}>WAIT</span>}</td>
                          <td style={{ padding: '0.4rem', color: colors.textMuted }}>{sub.alliance_tag || '—'}</td>
                          <td style={{ padding: '0.4rem', color: isBeyondCutoff ? '#ef4444' : assignment ? colors.text : colors.textMuted, fontWeight: assignment ? 500 : 400 }}>{sub.username}{hasChanged && <span title={`Speedups changed ${new Date(sub.speedup_changed_at!).toLocaleDateString()}`} style={{ marginLeft: '0.3rem', color: '#f59e0b', fontSize: '0.65rem', cursor: 'help' }}>⚠️</span>}</td>
                          <td style={{ padding: '0.4rem', textAlign: 'right', color: isBeyondCutoff ? '#ef4444' : DAY_COLORS[activeDay], fontWeight: 600 }}>{formatMinutes(effective)}</td>
                          <td style={{ padding: '0.4rem', textAlign: 'center' }}>
                            {sub.screenshot_url ? (
                              <a href={sub.screenshot_url} target="_blank" rel="noopener noreferrer" style={{ color: '#22c55e', fontSize: '0.7rem' }}>📷</a>
                            ) : <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>—</span>}
                          </td>
                          <td style={{ padding: '0.4rem', color: colors.textSecondary, fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{formatAvailRanges(avail)}</td>
                          <td style={{ padding: '0.4rem', textAlign: 'center' }}>
                            {assignment ? (
                              <span style={{ padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', backgroundColor: `${DAY_COLORS[activeDay]}20`, color: DAY_COLORS[activeDay], fontWeight: 600 }}>{assignment.slot_time}</span>
                            ) : (
                              <span style={{ color: colors.textMuted, fontSize: '0.65rem' }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {daySubmissions.length === 0 && (
                      <tr><td colSpan={7} style={{ padding: '1rem', textAlign: 'center', color: colors.textMuted }}>No submissions for {DAY_LABELS[activeDay]}.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Slot Assignment Grid */}
            <div style={cardStyle}>
              <h3 style={{ color: DAY_COLORS[activeDay], fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>🗓️ Slots</h3>
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {TIME_SLOTS.map(slot => {
                    const assignment = dayAssignments.find(a => a.slot_time === slot);
                    const assignedSub = assignment ? submissions.find(s => s.id === assignment.submission_id) : null;
                    const isGap = availabilityGaps.some(g => g.slot === slot);
                    return (
                      <div key={slot} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.4rem', borderRadius: '4px',
                        backgroundColor: assignment ? `${DAY_COLORS[activeDay]}10` : isGap ? `${colors.error}05` : 'transparent',
                        border: `1px solid ${assignment ? `${DAY_COLORS[activeDay]}20` : isGap ? `${colors.error}15` : 'transparent'}` }}>
                        <span style={{ color: isGap ? colors.error : colors.textMuted, fontSize: '0.65rem', fontFamily: 'monospace', width: '36px', flexShrink: 0 }}>{slot}</span>
                        {assignment && assignedSub ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flex: 1, minWidth: 0 }}>
                            <span style={{ color: DAY_COLORS[activeDay], fontSize: '0.7rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{assignedSub.username}</span>
                            <button onClick={() => removeAssignment(assignment.id)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: colors.error, cursor: 'pointer', fontSize: '0.7rem', padding: '0 0.15rem', flexShrink: 0 }}>×</button>
                          </div>
                        ) : (
                          <select value="" onChange={(e) => { if (e.target.value) assignSlot(activeDay, slot, e.target.value); }}
                            style={{ flex: 1, padding: '0.1rem 0.2rem', backgroundColor: 'transparent', border: `1px solid ${colors.borderSubtle}`, borderRadius: '4px', color: colors.textMuted, fontSize: '0.65rem', minWidth: 0 }}>
                            <option value="">{isGap ? '⚠️ none' : '—'}</option>
                            {submissions
                              .filter(s => !dayAssignments.find(a => a.submission_id === s.id) && !isSkippedDay(s, activeDay))
                              .sort((a, b) => getEffectiveSpeedups(b, activeDay, schedule) - getEffectiveSpeedups(a, activeDay, schedule))
                              .map(s => {
                                const sAvailKey = `${activeDay}_availability` as keyof PrepSubmission;
                                const sAvail = (s[sAvailKey] as string[][] | undefined) || [];
                                const inAvail = isSlotInAvailability(slot, sAvail);
                                return (
                                  <option key={s.id} value={s.id}>
                                    {!inAvail ? '⚠️ ' : ''}{s.username}
                                  </option>
                                );
                              })
                            }
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingBottom: '1rem' }}>
            <Link to="/tools/prep-scheduler" style={{ color: '#22d3ee', textDecoration: 'none', fontSize: '0.8rem' }}>← Back to Schedules</Link>
          </div>
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', padding: '2rem', textAlign: 'center' }}>
      <p style={{ color: colors.textMuted }}>Schedule not found.</p>
      <Link to="/tools/prep-scheduler" style={{ color: '#22d3ee', textDecoration: 'none', fontSize: '0.8rem' }}>← Back</Link>
    </div>
  );
};

export default PrepScheduler;
