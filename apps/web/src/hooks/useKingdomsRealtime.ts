import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { kingdomKeys } from './useKingdoms';
import { kingdomsSupabaseService } from '../services/kingdomsSupabaseService';
import { logger } from '../utils/logger';

interface RealtimeState {
  isConnected: boolean;
  lastUpdate: Date | null;
  updatedKingdoms: number[];
}

/**
 * Hook to subscribe to real-time updates from the kingdoms table.
 * Automatically invalidates React Query cache when kingdoms are updated.
 */
export function useKingdomsRealtime() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<RealtimeState>({
    isConnected: false,
    lastUpdate: null,
    updatedKingdoms: [],
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      logger.warn('Supabase not configured, skipping realtime subscription');
      return;
    }

    const client = supabase; // TypeScript now knows this is non-null

    // Subscribe to changes on the kingdoms table
    const channel = client
      .channel('kingdoms-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'kingdoms',
        },
        (payload) => {
          const kingdomNumber = (payload.new as { kingdom_number?: number })?.kingdom_number ||
                               (payload.old as { kingdom_number?: number })?.kingdom_number;

          logger.info(`Realtime: Kingdom ${kingdomNumber} ${payload.eventType}`);

          // Update state
          setState(prev => ({
            isConnected: true,
            lastUpdate: new Date(),
            updatedKingdoms: kingdomNumber 
              ? [...prev.updatedKingdoms.slice(-9), kingdomNumber] // Keep last 10
              : prev.updatedKingdoms,
          }));

          // Invalidate the kingdoms service cache
          kingdomsSupabaseService.invalidateCache();

          // Invalidate React Query cache for all kingdom queries
          queryClient.invalidateQueries({ queryKey: kingdomKeys.all });

          // If a specific kingdom was updated, also invalidate its detail
          if (kingdomNumber) {
            queryClient.invalidateQueries({ queryKey: kingdomKeys.detail(kingdomNumber) });
          }
        }
      )
      .subscribe((status) => {
        logger.info(`Realtime subscription status: ${status}`);
        setState(prev => ({ ...prev, isConnected: status === 'SUBSCRIBED' }));
      });

    channelRef.current = channel;

    // Cleanup on unmount
    return () => {
      if (channelRef.current && client) {
        client.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [queryClient]);

  return state;
}

/**
 * Hook to get data freshness information
 */
export function useDataFreshness() {
  const { source, lastUpdated, kingdomCount } = kingdomsSupabaseService.getDataSourceStatus();
  
  return {
    source,
    lastUpdated,
    kingdomCount,
    isStale: lastUpdated ? (Date.now() - lastUpdated.getTime()) > 10 * 60 * 1000 : false, // 10 min
  };
}
