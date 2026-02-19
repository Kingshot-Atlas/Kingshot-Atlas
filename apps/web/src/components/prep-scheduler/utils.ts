// ─── KvK Prep Scheduler — Utility Functions ───────────────────────────
import { PrepSchedule, PrepSubmission, SlotAssignment, Day, DAYS, DAY_LABELS, TIME_SLOTS, getEffectiveSlots, getMaxSlots } from './types';

export function utcSlotToLocal(utcSlot: string): string {
  const [h, m] = utcSlot.split(':').map(Number);
  const d = new Date();
  d.setUTCHours(h ?? 0, m ?? 0, 0, 0);
  const hr12 = d.getHours() % 12 || 12;
  const ampm = d.getHours() < 12 ? 'am' : 'pm';
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${hr12}:${min}${ampm}`;
}

export function formatDeadlineUTC(deadline: string | null): string {
  if (!deadline) return '';
  const d = new Date(deadline);
  const utcStr = `${String(d.getUTCFullYear()).slice(2)}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
  const localStr = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${utcStr} (${localStr} local)`;
}

export function getDeadlineCountdown(deadline: string | null, t?: (key: string, fallback: string, opts?: Record<string, unknown>) => string): { text: string; urgent: boolean; expired: boolean } | null {
  if (!deadline) return null;
  const now = Date.now();
  const dl = new Date(deadline).getTime();
  const diff = dl - now;
  if (diff <= 0) return { text: t ? t('prepScheduler.deadlinePassed', 'Deadline passed') : 'Deadline passed', urgent: true, expired: true };
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return { text: t ? t('prepScheduler.deadlineDaysHours', '{{days}}d {{hours}}h left', { days, hours }) : `${days}d ${hours}h left`, urgent: days <= 1, expired: false };
  if (hours > 0) return { text: t ? t('prepScheduler.deadlineHoursMins', '{{hours}}h {{mins}}m left', { hours, mins }) : `${hours}h ${mins}m left`, urgent: hours < 6, expired: false };
  return { text: t ? t('prepScheduler.deadlineMins', '{{mins}}m left', { mins }) : `${mins}m left`, urgent: true, expired: false };
}

export function timeToMinutes(time: string): number {
  const parts = time.split(':').map(Number);
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
}

export function getEffectiveSpeedups(sub: PrepSubmission, day: Day, schedule: PrepSchedule): number {
  const buffType = day === 'monday' ? schedule.monday_buff : day === 'tuesday' ? schedule.tuesday_buff : schedule.thursday_buff;
  let base = 0;
  if (buffType === 'construction') base = sub.construction_speedups;
  else if (buffType === 'research') base = sub.research_speedups;
  else if (buffType === 'training') base = sub.training_speedups;
  if (sub.general_speedup_target === buffType) base += sub.general_speedups;
  return base;
}

export function isSlotInAvailability(slotTime: string, availability: string[][]): boolean {
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

export function formatAvailRanges(ranges: string[][]): string {
  if (!ranges || ranges.length === 0) return '—';
  return ranges.map(r => `${r[0] || '?'}–${r[1] || '?'}`).join(', ');
}

export function formatMinutes(totalMinutes: number): string {
  return `${totalMinutes.toLocaleString()}m`;
}

export function isSkippedDay(sub: PrepSubmission, day: Day): boolean {
  if (day === 'monday') return sub.skip_monday;
  if (day === 'tuesday') return sub.skip_tuesday;
  if (day === 'thursday') return sub.skip_thursday;
  return false;
}

export function autoAssignSlots(submissions: PrepSubmission[], schedule: PrepSchedule, day: Day): { submission_id: string; slot_time: string }[] {
  const availKey = `${day}_availability` as keyof PrepSubmission;
  const sorted = [...submissions]
    .filter(s => {
      if (isSkippedDay(s, day)) return false;
      const avail = (s[availKey] as string[][] | undefined) || []; return avail.length > 0;
    })
    .sort((a, b) => getEffectiveSpeedups(b, day, schedule) - getEffectiveSpeedups(a, day, schedule));

  const effectiveSlots = getEffectiveSlots(schedule.stagger_enabled);
  const maxSlots = getMaxSlots(schedule.stagger_enabled);
  const assignments: { submission_id: string; slot_time: string }[] = [];
  const usedSlots = new Set<string>();
  const assignedUsers = new Set<string>();

  for (const sub of sorted) {
    if (assignments.length >= maxSlots) break;
    if (assignedUsers.has(sub.id)) continue;
    const avail = (sub[availKey] as string[][] | undefined) || [];
    for (const slot of effectiveSlots) {
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

export function exportToSpreadsheet(submissions: PrepSubmission[], assignments: SlotAssignment[], schedule: PrepSchedule) {
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
