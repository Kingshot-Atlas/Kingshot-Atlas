import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { kingdomKeys } from './useKingdoms';
import { kingdomsSupabaseService } from '../services/kingdomsSupabaseService';
import { kvkHistoryService } from '../services/kvkHistoryService';
import { kvkCorrectionService } from '../services/kvkCorrectionService';
import { logger } from '../utils/logger';

interface RealtimeState {
  isConnected: boolean;
  lastUpdate: Date | null;
  updatedKingdoms: number[];
  lastKvkUpdate: Date | null;
}

interface RealtimeOptions {
  onKingdomUpdate?: (kingdomNumber: number, eventType: string) => void;
  onKvkHistoryUpdate?: (kingdomNumber: number, kvkNumber: number, eventType: string) => void;
  showToasts?: boolean;
}

/**
 * Hook to subscribe to real-time updates from the kingdoms table.
 * Automatically invalidates React Query cache when kingdoms are updated.
 */
export function useKingdomsRealtime(options?: RealtimeOptions) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<RealtimeState>({
    isConnected: false,
    lastUpdate: null,
    updatedKingdoms: [],
    lastKvkUpdate: null,
  });
  const channelRef = useRef<RealtimeChannel | null>(null);
  const kvkChannelRef = useRef<RealtimeChannel | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

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
          
          // Call the callback if provided
          if (kingdomNumber && optionsRef.current?.onKingdomUpdate) {
            optionsRef.current.onKingdomUpdate(kingdomNumber, payload.eventType);
          }

          // Update state
          setState(prev => ({
            isConnected: true,
            lastUpdate: new Date(),
            lastKvkUpdate: prev.lastKvkUpdate,
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

    // Subscribe to changes on the kvk_history table
    const kvkChannel = client
      .channel('kvk-history-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'kvk_history',
        },
        (payload) => {
          const kingdomNumber = (payload.new as { kingdom_number?: number })?.kingdom_number ||
                               (payload.old as { kingdom_number?: number })?.kingdom_number;
          const kvkNumber = (payload.new as { kvk_number?: number })?.kvk_number ||
                           (payload.old as { kvk_number?: number })?.kvk_number;

          logger.info(`Realtime: KvK history K${kingdomNumber} #${kvkNumber} ${payload.eventType}`);
          
          // Call the callback if provided
          if (kingdomNumber && kvkNumber && optionsRef.current?.onKvkHistoryUpdate) {
            optionsRef.current.onKvkHistoryUpdate(kingdomNumber, kvkNumber, payload.eventType);
          }

          // Update state
          setState(prev => ({
            ...prev,
            lastKvkUpdate: new Date(),
            updatedKingdoms: kingdomNumber 
              ? [...prev.updatedKingdoms.slice(-9), kingdomNumber]
              : prev.updatedKingdoms,
          }));

          // Invalidate all caches to pick up the change
          kvkHistoryService.invalidateCache();
          kvkCorrectionService.invalidateCache();
          kingdomsSupabaseService.invalidateCache();

          // Invalidate React Query cache
          queryClient.invalidateQueries({ queryKey: kingdomKeys.all });
          if (kingdomNumber) {
            queryClient.invalidateQueries({ queryKey: kingdomKeys.detail(kingdomNumber) });
          }
        }
      )
      .subscribe((status) => {
        logger.info(`KvK history realtime subscription status: ${status}`);
      });

    kvkChannelRef.current = kvkChannel;

    // Cleanup on unmount
    return () => {
      if (channelRef.current && client) {
        client.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (kvkChannelRef.current && client) {
        client.removeChannel(kvkChannelRef.current);
        kvkChannelRef.current = null;
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
