// ─── Alliance Event Coordinator — Custom Hook ──────────────────────────
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logger } from '../utils/logger';
import { useAllianceCenter } from './useAllianceCenter';
import type { Alliance } from './useAllianceCenter';

// ─── Constants ───

export const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
] as const;

/** Generate 48 half-hour time slots: 00:00, 00:30, 01:00 … 23:30 */
export const TIME_SLOTS_30MIN: string[] = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? '00' : '30';
  return `${String(h).padStart(2, '0')}:${m}`;
});

// ─── Types ───

export interface AvailabilityRow {
  id: string;
  alliance_id: string;
  member_id: string | null;
  user_id: string | null;
  member_name: string;
  day_of_week: number; // 0-6
  time_slots: string[]; // ["00:00","00:30","14:00",…]
  added_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SlotTally {
  slot: string; // "HH:MM"
  count: number;
  members: string[]; // member names
}

export interface DayTally {
  day: number;
  dayLabel: string;
  slots: SlotTally[];
  peakSlot: string | null;
  peakCount: number;
}

type MutResult = { success: boolean; error?: string };

// ─── TC Level → TG Conversion ───

export function tcLevelToTG(level: number | null | undefined): string | null {
  if (level == null || level < 30) return null;
  // 30-34 = TC30, then TG tiers in 5-level increments starting at 35
  if (level < 35) return 'TC30';
  const tg = Math.floor((level - 35) / 5) + 1;
  return `TG${tg}`;
}

// ─── Hook ───

export function useAllianceEventCoordinator() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const ac = useAllianceCenter();
  const alliance: Alliance | null = ac.alliance;

  // ─── Fetch ALL availability for this alliance (managers see all, members see own) ───
  const { data: allAvailability = [], isLoading: availabilityLoading } = useQuery({
    queryKey: ['alliance-event-availability', alliance?.id],
    queryFn: async (): Promise<AvailabilityRow[]> => {
      if (!isSupabaseConfigured || !supabase || !alliance) return [];
      const { data, error } = await supabase
        .from('alliance_event_availability')
        .select('*')
        .eq('alliance_id', alliance.id)
        .order('day_of_week', { ascending: true })
        .order('member_name', { ascending: true });
      if (error) {
        logger.error('Failed to fetch event availability:', error);
        return [];
      }
      return (data || []) as AvailabilityRow[];
    },
    enabled: !!alliance,
    staleTime: 60 * 1000,
  });

  // My availability (rows where user_id = me)
  const myAvailability = allAvailability.filter(r => r.user_id === user?.id);

  // ─── Tally: aggregate slot counts per day across all members ───
  const tallyByDay: DayTally[] = DAYS_OF_WEEK.map(day => {
    const dayRows = allAvailability.filter(r => r.day_of_week === day.value);
    const slotCounts = new Map<string, string[]>();

    dayRows.forEach(row => {
      row.time_slots.forEach(slot => {
        const existing = slotCounts.get(slot) || [];
        existing.push(row.member_name);
        slotCounts.set(slot, existing);
      });
    });

    const slots: SlotTally[] = TIME_SLOTS_30MIN.map(slot => ({
      slot,
      count: slotCounts.get(slot)?.length ?? 0,
      members: slotCounts.get(slot) ?? [],
    }));

    let peakSlot: string | null = null;
    let peakCount = 0;
    slots.forEach(s => {
      if (s.count > peakCount) {
        peakCount = s.count;
        peakSlot = s.slot;
      }
    });

    return { day: day.value, dayLabel: day.label, slots, peakSlot, peakCount };
  });

  // ─── Unique member names who have submitted availability ───
  const submittedMembers = [...new Set(allAvailability.map(r => r.member_name))].sort();

  // ─── Save my availability (upsert per day) ───
  const saveMyAvailability = async (
    memberName: string,
    days: { day: number; slots: string[] }[],
  ): Promise<MutResult> => {
    if (!isSupabaseConfigured || !supabase || !user || !alliance) {
      return { success: false, error: 'Not authenticated or no alliance' };
    }

    try {
      // Delete existing rows for this user in this alliance
      await supabase
        .from('alliance_event_availability')
        .delete()
        .eq('alliance_id', alliance.id)
        .eq('user_id', user.id);

      // Insert new rows (skip days with no slots)
      const rows = days
        .filter(d => d.slots.length > 0)
        .map(d => ({
          alliance_id: alliance.id,
          user_id: user.id,
          member_name: memberName.trim(),
          day_of_week: d.day,
          time_slots: d.slots,
          added_by: null,
        }));

      if (rows.length > 0) {
        const { error } = await supabase
          .from('alliance_event_availability')
          .insert(rows);
        if (error) {
          logger.error('Failed to save availability:', error);
          return { success: false, error: 'Failed to save availability' };
        }
      }

      queryClient.invalidateQueries({ queryKey: ['alliance-event-availability', alliance.id] });
      return { success: true };
    } catch (err) {
      logger.error('Save availability error:', err);
      return { success: false, error: 'Unexpected error' };
    }
  };

  // ─── Manager: save availability for a member (manual input) ───
  const saveForMember = async (
    memberName: string,
    days: { day: number; slots: string[] }[],
    memberId?: string,
  ): Promise<MutResult> => {
    if (!isSupabaseConfigured || !supabase || !user || !alliance) {
      return { success: false, error: 'Not authenticated or no alliance' };
    }
    if (!ac.canManage) {
      return { success: false, error: 'Only managers/owners can input for others' };
    }

    try {
      // Delete existing rows for this member_name in this alliance (manager-added only, or all if no user_id)
      await supabase
        .from('alliance_event_availability')
        .delete()
        .eq('alliance_id', alliance.id)
        .eq('member_name', memberName.trim());

      const rows = days
        .filter(d => d.slots.length > 0)
        .map(d => ({
          alliance_id: alliance.id,
          member_id: memberId || null,
          user_id: null,
          member_name: memberName.trim(),
          day_of_week: d.day,
          time_slots: d.slots,
          added_by: user.id,
        }));

      if (rows.length > 0) {
        const { error } = await supabase
          .from('alliance_event_availability')
          .insert(rows);
        if (error) {
          logger.error('Failed to save availability for member:', error);
          return { success: false, error: error.message || 'Failed to save' };
        }
      }

      queryClient.invalidateQueries({ queryKey: ['alliance-event-availability', alliance.id] });
      return { success: true };
    } catch (err) {
      logger.error('Save for member error:', err);
      return { success: false, error: 'Unexpected error' };
    }
  };

  // ─── Delete availability for a member (manager) ───
  const deleteForMember = async (memberName: string): Promise<MutResult> => {
    if (!isSupabaseConfigured || !supabase || !user || !alliance) {
      return { success: false, error: 'Not authenticated' };
    }
    if (!ac.canManage) {
      return { success: false, error: 'Only managers/owners can delete' };
    }

    try {
      const { error } = await supabase
        .from('alliance_event_availability')
        .delete()
        .eq('alliance_id', alliance.id)
        .eq('member_name', memberName.trim());

      if (error) {
        logger.error('Failed to delete availability:', error);
        return { success: false, error: 'Failed to delete' };
      }

      queryClient.invalidateQueries({ queryKey: ['alliance-event-availability', alliance.id] });
      return { success: true };
    } catch (err) {
      logger.error('Delete for member error:', err);
      return { success: false, error: 'Unexpected error' };
    }
  };

  return {
    // Alliance center data pass-through
    alliance: ac.alliance,
    allianceLoading: ac.allianceLoading,
    members: ac.members,
    membersLoading: ac.membersLoading,
    isOwner: ac.isOwner,
    isManager: ac.isManager,
    canManage: ac.canManage,
    accessRole: ac.accessRole,

    // Availability data
    allAvailability,
    myAvailability,
    availabilityLoading,
    tallyByDay,
    submittedMembers,

    // Actions
    saveMyAvailability,
    saveForMember,
    deleteForMember,
  };
}
