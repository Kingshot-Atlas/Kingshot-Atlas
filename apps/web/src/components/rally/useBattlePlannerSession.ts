import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../Toast';
import type { BuildingKey } from './types';

export interface BattlePlannerSession {
  id: string;
  kingdom_number: number;
  name: string;
  created_by: string;
  status: 'active' | 'archived';
  created_at: string;
}

export interface BattlePlannerLeader {
  id: string;
  session_id: string;
  user_id: string;
  building_assignment: BuildingKey | null;
  assigned_by: string;
  created_at: string;
  // Joined from profiles
  username?: string;
  avatar_url?: string;
  linked_username?: string;
  linked_avatar_url?: string;
}

interface UseBattlePlannerSessionReturn {
  session: BattlePlannerSession | null;
  sessions: BattlePlannerSession[];
  leaders: BattlePlannerLeader[];
  isLoading: boolean;
  isReadOnly: boolean;
  isSessionEditor: boolean;
  createSession: (name: string, kingdomNumber: number) => Promise<BattlePlannerSession | null>;
  archiveSession: (id: string) => Promise<void>;
  activateSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  addLeader: (userId: string, buildingAssignment?: BuildingKey | null) => Promise<void>;
  updateLeaderAssignment: (leaderId: string, building: BuildingKey | null) => Promise<void>;
  removeLeader: (leaderId: string) => Promise<void>;
  initializeQueues: (sessionId: string) => Promise<void>;
}

const BUILDINGS: BuildingKey[] = ['castle', 'turret1', 'turret2', 'turret3', 'turret4'];
const QUEUE_TYPES = ['rally', 'counter'] as const;

export function useBattlePlannerSession(): UseBattlePlannerSessionReturn {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();

  const [session, setSession] = useState<BattlePlannerSession | null>(null);
  const [sessions, setSessions] = useState<BattlePlannerSession[]>([]);
  const [leaders, setLeaders] = useState<BattlePlannerLeader[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const kingdomNumber = profile?.linked_kingdom ?? null;
  const isReadOnly = session?.status === 'archived';

  // Is current user the session creator or an assigned leader?
  const isSessionEditor = !!(user?.id && session && (
    session.created_by === user.id ||
    leaders.some(l => l.user_id === user.id)
  ));

  // Load all sessions for user's kingdom
  useEffect(() => {
    if (!supabase || !kingdomNumber) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase
          .from('battle_planner_sessions')
          .select('*')
          .eq('kingdom_number', kingdomNumber)
          .order('created_at', { ascending: false });

        if (cancelled) return;
        if (error) throw error;

        const typed = (data ?? []) as BattlePlannerSession[];
        setSessions(typed);

        // Auto-select first active session
        const active = typed.find(s => s.status === 'active');
        if (active) {
          setSession(active);
        }
      } catch (err) {
        console.error('Failed to load battle planner sessions:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [kingdomNumber]);

  // Load leaders when session changes
  useEffect(() => {
    if (!supabase || !session?.id) {
      setLeaders([]);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase
          .from('battle_planner_leaders')
          .select(`
            *,
            profiles!battle_planner_leaders_user_id_profiles_fkey (
              username,
              avatar_url,
              linked_username,
              linked_avatar_url
            )
          `)
          .eq('session_id', session.id);

        if (cancelled) return;
        if (error) throw error;

        const mapped = (data ?? []).map((row: Record<string, unknown>) => {
          const profileData = row.profiles as Record<string, unknown> | null;
          return {
            id: row.id as string,
            session_id: row.session_id as string,
            user_id: row.user_id as string,
            building_assignment: row.building_assignment as BuildingKey | null,
            assigned_by: row.assigned_by as string,
            created_at: row.created_at as string,
            username: profileData?.username as string | undefined,
            avatar_url: profileData?.avatar_url as string | undefined,
            linked_username: profileData?.linked_username as string | undefined,
            linked_avatar_url: profileData?.linked_avatar_url as string | undefined,
          };
        });
        setLeaders(mapped);
      } catch (err) {
        console.error('Failed to load battle planner leaders:', err);
      }
    })();

    // Realtime subscription for leaders
    const channel = supabase
      .channel(`bp-leaders-${session.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'battle_planner_leaders',
        filter: `session_id=eq.${session.id}`,
      }, () => {
        // Re-fetch on any change (includes profile join)
        supabase!
          .from('battle_planner_leaders')
          .select(`
            *,
            profiles!battle_planner_leaders_user_id_profiles_fkey (
              username,
              avatar_url,
              linked_username,
              linked_avatar_url
            )
          `)
          .eq('session_id', session.id)
          .then(({ data: refreshData, error: refreshError }) => {
            if (refreshError) {
              console.error('Realtime re-fetch failed:', refreshError);
              return;
            }
            if (cancelled || !refreshData) return;
            const refreshMapped = refreshData.map((row: Record<string, unknown>) => {
              const profileData = row.profiles as Record<string, unknown> | null;
              return {
                id: row.id as string,
                session_id: row.session_id as string,
                user_id: row.user_id as string,
                building_assignment: row.building_assignment as BuildingKey | null,
                assigned_by: row.assigned_by as string,
                created_at: row.created_at as string,
                username: profileData?.username as string | undefined,
                avatar_url: profileData?.avatar_url as string | undefined,
                linked_username: profileData?.linked_username as string | undefined,
                linked_avatar_url: profileData?.linked_avatar_url as string | undefined,
              };
            });
            setLeaders(refreshMapped);
          });
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase!.removeChannel(channel);
    };
  }, [session?.id]);

  // Initialize 10 queue rows for a new session
  const initializeQueues = useCallback(async (sessionId: string) => {
    if (!supabase || !user?.id) return;

    const rows = BUILDINGS.flatMap(building =>
      QUEUE_TYPES.map(queueType => ({
        session_id: sessionId,
        building,
        queue_type: queueType,
        slots: [],
        hit_mode: 'simultaneous',
        interval_seconds: 1,
        updated_by: user.id,
      }))
    );

    const { error } = await supabase
      .from('battle_planner_queues')
      .insert(rows);

    if (error) {
      console.error('Failed to initialize queues:', error);
    }
  }, [user?.id]);

  const createSession = useCallback(async (name: string, kNum: number): Promise<BattlePlannerSession | null> => {
    if (!supabase || !user?.id) return null;

    try {
      const { data, error } = await supabase
        .from('battle_planner_sessions')
        .insert({
          kingdom_number: kNum,
          name,
          created_by: user.id,
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;

      const newSession = data as BattlePlannerSession;

      // Initialize 10 queue rows
      await initializeQueues(newSession.id);

      setSessions(prev => [newSession, ...prev]);
      setSession(newSession);
      showToast(t('battlePlanner.sessionCreate', 'Session created'), 'success');
      return newSession;
    } catch (err) {
      console.error('Failed to create session:', err);
      showToast(t('battlePlanner.captainAddFailed', 'Failed to create session'), 'error');
      return null;
    }
  }, [user?.id, initializeQueues, showToast]);

  const archiveSession = useCallback(async (id: string) => {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('battle_planner_sessions')
        .update({ status: 'archived' })
        .eq('id', id);
      if (error) throw error;
      setSessions(prev => prev.map(s => s.id === id ? { ...s, status: 'archived' as const } : s));
      if (session?.id === id) {
        setSession(prev => prev ? { ...prev, status: 'archived' as const } : null);
      }
      showToast(t('battlePlanner.sessionArchived', 'Session archived'), 'info');
    } catch (err) {
      console.error('Failed to archive session:', err);
      showToast(t('battlePlanner.captainAddFailed', 'Failed to archive session'), 'error');
    }
  }, [session?.id, showToast]);

  const activateSession = useCallback(async (id: string) => {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('battle_planner_sessions')
        .update({ status: 'active' })
        .eq('id', id);
      if (error) throw error;
      setSessions(prev => prev.map(s => s.id === id ? { ...s, status: 'active' as const } : s));
      const target = sessions.find(s => s.id === id);
      if (target) setSession({ ...target, status: 'active' });
      showToast(t('battlePlanner.sessionActive', 'Session activated'), 'success');
    } catch (err) {
      console.error('Failed to activate session:', err);
    }
  }, [sessions, showToast]);

  const deleteSession = useCallback(async (id: string) => {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('battle_planner_sessions')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setSessions(prev => prev.filter(s => s.id !== id));
      if (session?.id === id) {
        setSession(null);
      }
      showToast(t('battlePlanner.sessionDelete', 'Session deleted'), 'info');
    } catch (err) {
      console.error('Failed to delete session:', err);
      showToast(t('battlePlanner.captainAddFailed', 'Failed to delete session'), 'error');
    }
  }, [session?.id, showToast]);

  const updateLeaderAssignment = useCallback(async (leaderId: string, building: BuildingKey | null) => {
    if (!supabase) return;

    // Store original value before optimistic update for safe revert
    const originalBuilding = leaders.find(l => l.id === leaderId)?.building_assignment ?? null;

    // Optimistic UI update
    setLeaders(prev => prev.map(l =>
      l.id === leaderId ? { ...l, building_assignment: building } : l
    ));

    try {
      const { error } = await supabase
        .from('battle_planner_leaders')
        .update({ building_assignment: building })
        .eq('id', leaderId);
      if (error) throw error;
    } catch (err) {
      console.error('Failed to update leader assignment:', err);
      // Revert optimistic update on failure
      setLeaders(prev => prev.map(l =>
        l.id === leaderId ? { ...l, building_assignment: originalBuilding } : l
      ));
      showToast(t('battlePlanner.captainAssignFailed', 'Failed to update assignment'), 'error');
    }
  }, [leaders, showToast, t]);

  const addLeader = useCallback(async (userId: string, buildingAssignment?: BuildingKey | null) => {
    if (!supabase || !user?.id || !session?.id) return;
    try {
      const { error } = await supabase
        .from('battle_planner_leaders')
        .insert({
          session_id: session.id,
          user_id: userId,
          building_assignment: buildingAssignment ?? null,
          assigned_by: user.id,
        });
      if (error) {
        // Handle duplicate leader — re-assign building instead of failing
        if (error.code === '23505') {
          const existing = leaders.find(l => l.user_id === userId);
          if (existing && buildingAssignment) {
            await updateLeaderAssignment(existing.id, buildingAssignment);
            return;
          }
          showToast(t('battlePlanner.captainAlreadyExists', 'This user is already a captain in this session'), 'info');
          return;
        }
        // Handle RLS permission denied
        if (error.code === '42501') {
          showToast(t('battlePlanner.captainPermissionDenied', 'Only editors and co-editors can add captains'), 'error');
          return;
        }
        throw error;
      }
      showToast(t('battlePlanner.captainAdded', 'Captain added'), 'success');
    } catch (err) {
      console.error('Failed to add leader:', err);
      showToast(t('battlePlanner.captainAddFailed', 'Failed to add captain'), 'error');
    }
  }, [user?.id, session?.id, leaders, showToast, t, updateLeaderAssignment]);

  const removeLeader = useCallback(async (leaderId: string) => {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('battle_planner_leaders')
        .delete()
        .eq('id', leaderId);
      if (error) throw error;
      showToast(t('battlePlanner.captainRemoved', 'Captain removed'), 'info');
    } catch (err) {
      console.error('Failed to remove leader:', err);
    }
  }, [showToast]);

  return {
    session,
    sessions,
    leaders,
    isLoading,
    isReadOnly,
    isSessionEditor,
    createSession,
    archiveSession,
    activateSession,
    deleteSession,
    addLeader,
    updateLeaderAssignment,
    removeLeader,
    initializeQueues,
  };
}
