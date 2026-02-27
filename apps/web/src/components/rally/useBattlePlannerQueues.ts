import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { BuildingKey, HitMode } from './types';

export interface QueueRow {
  id: string;
  session_id: string;
  building: BuildingKey;
  queue_type: 'rally' | 'counter';
  slots: { playerId: string; useBuffed: boolean }[];
  hit_mode: HitMode;
  interval_seconds: number;
  updated_by: string | null;
  updated_at: string;
}

type QueueKey = `${BuildingKey}_${'rally' | 'counter'}`;

function makeQueueKey(building: BuildingKey, queueType: 'rally' | 'counter'): QueueKey {
  return `${building}_${queueType}`;
}

interface UseBattlePlannerQueuesReturn {
  queues: Map<QueueKey, QueueRow>;
  isLoading: boolean;
  getQueue: (building: BuildingKey, queueType: 'rally' | 'counter') => QueueRow | undefined;
  updateQueueSlots: (building: BuildingKey, queueType: 'rally' | 'counter', slots: { playerId: string; useBuffed: boolean }[]) => Promise<void>;
  updateQueueHitMode: (building: BuildingKey, queueType: 'rally' | 'counter', hitMode: HitMode) => Promise<void>;
  updateQueueInterval: (building: BuildingKey, queueType: 'rally' | 'counter', interval: number) => Promise<void>;
  getPlayerBuildingAssignments: () => Map<string, BuildingKey[]>;
}

export function useBattlePlannerQueues(sessionId: string | null): UseBattlePlannerQueuesReturn {
  const { user } = useAuth();
  const [queues, setQueues] = useState<Map<QueueKey, QueueRow>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null);
  const saveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Load all queues for session
  useEffect(() => {
    if (!supabase || !sessionId) {
      setQueues(new Map());
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const { data, error } = await supabase
          .from('battle_planner_queues')
          .select('*')
          .eq('session_id', sessionId);

        if (cancelled) return;
        if (error) throw error;

        const map = new Map<QueueKey, QueueRow>();
        for (const row of (data ?? []) as QueueRow[]) {
          const key = makeQueueKey(row.building, row.queue_type);
          map.set(key, row);
        }
        setQueues(map);
      } catch (err) {
        console.error('Failed to load battle planner queues:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    // Realtime subscription
    const channel = supabase
      .channel(`bp-queues-${sessionId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'battle_planner_queues',
        filter: `session_id=eq.${sessionId}`,
      }, (payload) => {
        if (cancelled) return;
        if (payload.eventType === 'DELETE') {
          const old = payload.old as { building: BuildingKey; queue_type: 'rally' | 'counter' };
          const key = makeQueueKey(old.building, old.queue_type);
          setQueues(prev => {
            const next = new Map(prev);
            next.delete(key);
            return next;
          });
        } else {
          const row = (payload.eventType === 'INSERT' ? payload.new : payload.new) as QueueRow;
          const key = makeQueueKey(row.building, row.queue_type);
          // Only apply remote updates if not from current user (avoid overwriting optimistic state)
          if (row.updated_by !== user?.id) {
            setQueues(prev => {
              const next = new Map(prev);
              next.set(key, row);
              return next;
            });
          }
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      cancelled = true;
      // Clear all pending save timers
      for (const timer of saveTimersRef.current.values()) {
        clearTimeout(timer);
      }
      saveTimersRef.current.clear();
      if (channelRef.current) {
        supabase?.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [sessionId, user?.id]);

  const getQueue = useCallback((building: BuildingKey, queueType: 'rally' | 'counter'): QueueRow | undefined => {
    return queues.get(makeQueueKey(building, queueType));
  }, [queues]);

  // Debounced save helper
  const debouncedSave = useCallback((
    building: BuildingKey,
    queueType: 'rally' | 'counter',
    updates: Partial<Pick<QueueRow, 'slots' | 'hit_mode' | 'interval_seconds'>>
  ) => {
    if (!supabase || !sessionId || !user?.id) return;

    const timerKey = `${building}_${queueType}`;
    const existing = saveTimersRef.current.get(timerKey);
    if (existing) clearTimeout(existing);

    const sb = supabase; // captured ref — null guard already passed above
    const timer = setTimeout(async () => {
      saveTimersRef.current.delete(timerKey);
      try {
        const { error } = await sb!
          .from('battle_planner_queues')
          .update({
            ...updates,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq('session_id', sessionId)
          .eq('building', building)
          .eq('queue_type', queueType);

        if (error) console.error('Failed to save queue:', error);
      } catch (err) {
        console.error('Failed to save queue:', err);
      }
    }, 500); // 500ms debounce

    saveTimersRef.current.set(timerKey, timer);
  }, [sessionId, user?.id]);

  const updateQueueSlots = useCallback(async (
    building: BuildingKey,
    queueType: 'rally' | 'counter',
    slots: { playerId: string; useBuffed: boolean }[]
  ) => {
    const key = makeQueueKey(building, queueType);

    // Optimistic update
    setQueues(prev => {
      const next = new Map(prev);
      const existing = next.get(key);
      if (existing) {
        next.set(key, { ...existing, slots, updated_by: user?.id ?? null, updated_at: new Date().toISOString() });
      }
      return next;
    });

    debouncedSave(building, queueType, { slots });
  }, [user?.id, debouncedSave]);

  const updateQueueHitMode = useCallback(async (
    building: BuildingKey,
    queueType: 'rally' | 'counter',
    hitMode: HitMode
  ) => {
    const key = makeQueueKey(building, queueType);

    setQueues(prev => {
      const next = new Map(prev);
      const existing = next.get(key);
      if (existing) {
        next.set(key, { ...existing, hit_mode: hitMode, updated_by: user?.id ?? null, updated_at: new Date().toISOString() });
      }
      return next;
    });

    debouncedSave(building, queueType, { hit_mode: hitMode });
  }, [user?.id, debouncedSave]);

  const updateQueueInterval = useCallback(async (
    building: BuildingKey,
    queueType: 'rally' | 'counter',
    interval: number
  ) => {
    const key = makeQueueKey(building, queueType);

    setQueues(prev => {
      const next = new Map(prev);
      const existing = next.get(key);
      if (existing) {
        next.set(key, { ...existing, interval_seconds: interval, updated_by: user?.id ?? null, updated_at: new Date().toISOString() });
      }
      return next;
    });

    debouncedSave(building, queueType, { interval_seconds: interval });
  }, [user?.id, debouncedSave]);

  // Cross-building player uniqueness: returns map of playerId -> buildings they appear in
  const getPlayerBuildingAssignments = useCallback((): Map<string, BuildingKey[]> => {
    const assignments = new Map<string, BuildingKey[]>();

    for (const [key, queue] of queues.entries()) {
      const building = key.split('_')[0] as BuildingKey;
      for (const slot of queue.slots) {
        const existing = assignments.get(slot.playerId) ?? [];
        if (!existing.includes(building)) {
          existing.push(building);
          assignments.set(slot.playerId, existing);
        }
      }
    }

    return assignments;
  }, [queues]);

  return {
    queues,
    isLoading,
    getQueue,
    updateQueueSlots,
    updateQueueHitMode,
    updateQueueInterval,
    getPlayerBuildingAssignments,
  };
}
