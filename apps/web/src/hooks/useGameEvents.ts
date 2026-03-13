import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { GameEvent, GameEventWindow, EventMaterial } from '../data/eventCalendarTypes';

const STALE_TIME = 5 * 60 * 1000; // 5 minutes — event data changes rarely

/** Fetch all active materials */
export function useEventMaterials() {
  return useQuery<EventMaterial[]>({
    queryKey: ['event-materials'],
    queryFn: async () => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('event_materials')
        .select('id, name, emoji, category, sort_order, is_active')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data || [];
    },
    staleTime: STALE_TIME,
  });
}

/** Fetch all materials (including inactive) for admin */
export function useAllEventMaterials() {
  return useQuery<EventMaterial[]>({
    queryKey: ['event-materials-all'],
    queryFn: async () => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('event_materials')
        .select('id, name, emoji, category, sort_order, is_active')
        .order('sort_order');
      if (error) throw error;
      return data || [];
    },
    staleTime: STALE_TIME,
  });
}

/** Fetch all active game events with their windows and material assignments */
export function useGameEvents() {
  return useQuery<GameEvent[]>({
    queryKey: ['game-events'],
    queryFn: async () => {
      if (!supabase) return [];

      // Fetch events
      const { data: events, error: eventsError } = await supabase
        .from('game_events')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (eventsError) throw eventsError;
      if (!events?.length) return [];

      const eventIds = events.map(e => e.id);

      // Fetch windows for all events
      const { data: windows, error: windowsError } = await supabase
        .from('game_event_windows')
        .select('*')
        .in('event_id', eventIds)
        .order('display_order');
      if (windowsError) throw windowsError;

      const windowIds = (windows || []).map(w => w.id);

      // Fetch material assignments
      let materialMap = new Map<string, string[]>();
      if (windowIds.length > 0) {
        const { data: wm, error: wmError } = await supabase
          .from('game_event_window_materials')
          .select('window_id, material_id')
          .in('window_id', windowIds);
        if (wmError) throw wmError;
        for (const row of wm || []) {
          const existing = materialMap.get(row.window_id) || [];
          existing.push(row.material_id);
          materialMap.set(row.window_id, existing);
        }
      }

      // Assemble
      const windowsByEvent = new Map<string, GameEventWindow[]>();
      for (const w of windows || []) {
        const eventWindows = windowsByEvent.get(w.event_id) || [];
        eventWindows.push({
          id: w.id,
          event_id: w.event_id,
          label: w.label,
          start_offset_minutes: w.start_offset_minutes,
          end_offset_minutes: w.end_offset_minutes,
          display_order: w.display_order,
          material_ids: materialMap.get(w.id) || [],
        });
        windowsByEvent.set(w.event_id, eventWindows);
      }

      return events.map(e => ({
        id: e.id,
        name: e.name,
        event_kind: e.event_kind as 'cyclical' | 'special',
        cadence_weeks: e.cadence_weeks,
        anchor_start_at: e.anchor_start_at,
        anchor_end_at: e.anchor_end_at,
        color: e.color,
        emoji: e.emoji,
        is_active: e.is_active,
        notes: e.notes,
        windows: windowsByEvent.get(e.id) || [],
      }));
    },
    staleTime: STALE_TIME,
  });
}

/** Fetch all game events (including inactive) for admin */
export function useAllGameEvents() {
  return useQuery<GameEvent[]>({
    queryKey: ['game-events-all'],
    queryFn: async () => {
      if (!supabase) return [];

      const { data: events, error: eventsError } = await supabase
        .from('game_events')
        .select('*')
        .order('name');
      if (eventsError) throw eventsError;
      if (!events?.length) return [];

      const eventIds = events.map(e => e.id);

      const { data: windows, error: windowsError } = await supabase
        .from('game_event_windows')
        .select('*')
        .in('event_id', eventIds)
        .order('display_order');
      if (windowsError) throw windowsError;

      const windowIds = (windows || []).map(w => w.id);

      let materialMap = new Map<string, string[]>();
      if (windowIds.length > 0) {
        const { data: wm, error: wmError } = await supabase
          .from('game_event_window_materials')
          .select('window_id, material_id')
          .in('window_id', windowIds);
        if (wmError) throw wmError;
        for (const row of wm || []) {
          const existing = materialMap.get(row.window_id) || [];
          existing.push(row.material_id);
          materialMap.set(row.window_id, existing);
        }
      }

      const windowsByEvent = new Map<string, GameEventWindow[]>();
      for (const w of windows || []) {
        const eventWindows = windowsByEvent.get(w.event_id) || [];
        eventWindows.push({
          id: w.id,
          event_id: w.event_id,
          label: w.label,
          start_offset_minutes: w.start_offset_minutes,
          end_offset_minutes: w.end_offset_minutes,
          display_order: w.display_order,
          material_ids: materialMap.get(w.id) || [],
        });
        windowsByEvent.set(w.event_id, eventWindows);
      }

      return events.map(e => ({
        id: e.id,
        name: e.name,
        event_kind: e.event_kind as 'cyclical' | 'special',
        cadence_weeks: e.cadence_weeks,
        anchor_start_at: e.anchor_start_at,
        anchor_end_at: e.anchor_end_at,
        color: e.color,
        emoji: e.emoji,
        is_active: e.is_active,
        notes: e.notes,
        windows: windowsByEvent.get(e.id) || [],
      }));
    },
    staleTime: STALE_TIME,
  });
}
