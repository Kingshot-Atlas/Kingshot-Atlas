import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../Toast';
import type { RallyPlayer, MarchTimes } from './types';
import { DEFAULT_MARCH } from './types';

interface DbPlayer {
  id: string;
  session_id: string;
  name: string;
  team: 'ally' | 'enemy';
  march_times: MarchTimes;
  created_by: string;
  created_at: string;
}

interface UseBattlePlannerPlayersReturn {
  players: RallyPlayer[];
  isLoading: boolean;
  addPlayer: (player: Omit<RallyPlayer, 'id'>) => Promise<RallyPlayer | null>;
  updatePlayer: (player: RallyPlayer) => Promise<void>;
  deletePlayer: (id: string) => Promise<void>;
  duplicatePlayer: (id: string) => Promise<void>;
  importPlayers: (jsonStr: string) => Promise<void>;
  exportPlayers: () => void;
  migrateFromLocalStorage: (localPlayers: RallyPlayer[]) => Promise<number>;
}

function dbToRallyPlayer(row: DbPlayer): RallyPlayer {
  return {
    id: row.id,
    name: row.name,
    team: row.team,
    marchTimes: row.march_times ?? DEFAULT_MARCH,
  };
}

export function useBattlePlannerPlayers(sessionId: string | null): UseBattlePlannerPlayersReturn {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [players, setPlayers] = useState<RallyPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null);

  // Load players for session + subscribe to realtime
  useEffect(() => {
    if (!supabase || !sessionId) {
      setPlayers([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const { data, error } = await supabase
          .from('battle_planner_players')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });

        if (cancelled) return;
        if (error) throw error;

        setPlayers((data ?? []).map((row: DbPlayer) => dbToRallyPlayer(row)));
      } catch (err) {
        console.error('Failed to load battle planner players:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    // Realtime subscription
    const channel = supabase
      .channel(`bp-players-${sessionId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'battle_planner_players',
        filter: `session_id=eq.${sessionId}`,
      }, (payload) => {
        if (cancelled) return;
        const newPlayer = dbToRallyPlayer(payload.new as DbPlayer);
        setPlayers(prev => {
          if (prev.some(p => p.id === newPlayer.id)) return prev;
          return [...prev, newPlayer];
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'battle_planner_players',
        filter: `session_id=eq.${sessionId}`,
      }, (payload) => {
        if (cancelled) return;
        const updated = dbToRallyPlayer(payload.new as DbPlayer);
        setPlayers(prev => prev.map(p => p.id === updated.id ? updated : p));
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'battle_planner_players',
        filter: `session_id=eq.${sessionId}`,
      }, (payload) => {
        if (cancelled) return;
        const deletedId = (payload.old as { id: string }).id;
        setPlayers(prev => prev.filter(p => p.id !== deletedId));
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      cancelled = true;
      if (channelRef.current) {
        supabase!.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [sessionId]);

  const addPlayer = useCallback(async (player: Omit<RallyPlayer, 'id'>): Promise<RallyPlayer | null> => {
    if (!supabase || !user?.id || !sessionId) return null;

    try {
      const { data, error } = await supabase
        .from('battle_planner_players')
        .insert({
          session_id: sessionId,
          name: player.name,
          team: player.team,
          march_times: player.marchTimes,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return dbToRallyPlayer(data as DbPlayer);
    } catch (err) {
      console.error('Failed to add player:', err);
      showToast('Failed to add player', 'error');
      return null;
    }
  }, [user?.id, sessionId, showToast]);

  const updatePlayer = useCallback(async (player: RallyPlayer) => {
    if (!supabase || !sessionId) return;

    try {
      const { error } = await supabase
        .from('battle_planner_players')
        .update({
          name: player.name,
          team: player.team,
          march_times: player.marchTimes,
        })
        .eq('id', player.id)
        .eq('session_id', sessionId);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to update player:', err);
      showToast('Failed to update player', 'error');
    }
  }, [sessionId, showToast]);

  const deletePlayer = useCallback(async (id: string) => {
    if (!supabase || !sessionId) return;

    // Optimistic delete
    const deletedPlayer = players.find(p => p.id === id);
    setPlayers(prev => prev.filter(p => p.id !== id));

    try {
      const { error } = await supabase
        .from('battle_planner_players')
        .delete()
        .eq('id', id)
        .eq('session_id', sessionId);

      if (error) throw error;

      if (deletedPlayer) {
        showToast(`${deletedPlayer.name} deleted`, 'info');
      }
    } catch (err) {
      console.error('Failed to delete player:', err);
      // Restore on failure
      if (deletedPlayer) {
        setPlayers(prev => [...prev, deletedPlayer]);
      }
      showToast('Failed to delete player', 'error');
    }
  }, [sessionId, players, showToast]);

  const duplicatePlayer = useCallback(async (id: string) => {
    const original = players.find(p => p.id === id);
    if (!original) return;

    const copy = await addPlayer({
      name: `${original.name} (copy)`,
      team: original.team,
      marchTimes: { ...original.marchTimes },
    });

    if (copy) {
      showToast(`📋 ${copy.name} created`, 'success');
    }
  }, [players, addPlayer, showToast]);

  const importPlayers = useCallback(async (jsonStr: string) => {
    if (!supabase || !user?.id || !sessionId) return;

    try {
      const parsed = JSON.parse(jsonStr);
      if (!Array.isArray(parsed)) throw new Error('Invalid format');

      const valid = parsed.filter(
        (p: unknown): p is RallyPlayer =>
          typeof p === 'object' && p !== null &&
          'name' in p && 'team' in p && 'marchTimes' in p
      );

      if (valid.length === 0) {
        showToast('No valid players found in file', 'error');
        return;
      }

      // Check for duplicates by name+team
      const existingKeys = new Set(players.map(p => `${p.name.toLowerCase()}-${p.team}`));
      const newPlayers = valid.filter(p => !existingKeys.has(`${p.name.toLowerCase()}-${p.team}`));

      if (newPlayers.length === 0) {
        showToast('All players already exist in this session', 'info');
        return;
      }

      const rows = newPlayers.map(p => ({
        session_id: sessionId,
        name: p.name,
        team: p.team,
        march_times: p.marchTimes,
        created_by: user.id,
      }));

      const { error } = await supabase
        .from('battle_planner_players')
        .insert(rows);

      if (error) throw error;

      showToast(
        `Imported ${newPlayers.length} player(s) (${valid.length - newPlayers.length} duplicates skipped)`,
        'success'
      );
    } catch {
      showToast('Failed to import — invalid JSON file', 'error');
    }
  }, [user?.id, sessionId, players, showToast]);

  const exportPlayers = useCallback(() => {
    const data = JSON.stringify(players, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `battle-planner-players-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Player database exported', 'success');
  }, [players, showToast]);

  // Migrate from localStorage to Supabase (one-time import)
  const migrateFromLocalStorage = useCallback(async (localPlayers: RallyPlayer[]): Promise<number> => {
    if (!supabase || !user?.id || !sessionId || localPlayers.length === 0) return 0;

    // Filter out players that already exist in the session
    const existingKeys = new Set(players.map(p => `${p.name.toLowerCase()}-${p.team}`));
    const newPlayers = localPlayers.filter(p => !existingKeys.has(`${p.name.toLowerCase()}-${p.team}`));

    if (newPlayers.length === 0) return 0;

    try {
      const rows = newPlayers.map(p => ({
        session_id: sessionId,
        name: p.name,
        team: p.team,
        march_times: p.marchTimes,
        created_by: user.id,
      }));

      const { error } = await supabase
        .from('battle_planner_players')
        .insert(rows);

      if (error) throw error;
      return newPlayers.length;
    } catch (err) {
      console.error('Failed to migrate players:', err);
      return 0;
    }
  }, [user?.id, sessionId, players]);

  return {
    players,
    isLoading,
    addPlayer,
    updatePlayer,
    deletePlayer,
    duplicatePlayer,
    importPlayers,
    exportPlayers,
    migrateFromLocalStorage,
  };
}
