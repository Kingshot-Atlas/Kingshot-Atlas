/**
 * Data Freshness Service
 * Tracks data staleness and provides alerts when data needs updating
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface DataFreshnessStatus {
  source: string;
  lastUpdated: Date | null;
  recordCount: number;
  staleness: 'fresh' | 'aging' | 'stale' | 'critical';
  daysOld: number;
  nextExpectedUpdate: Date | null;
  message: string;
}

export interface FreshnessAlert {
  id: string;
  type: 'warning' | 'error' | 'info';
  source: string;
  message: string;
  actionRequired: string;
  createdAt: Date;
}

const KVK_CYCLE_DAYS = 28;
const FRESHNESS_THRESHOLDS = {
  fresh: 7,
  aging: 14,
  stale: 28,
  critical: 42
};

class DataFreshnessService {
  private cachedStatus: DataFreshnessStatus | null = null;
  private lastCheck: number = 0;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Get the freshness status of KvK data
   */
  async getKvKFreshnessStatus(): Promise<DataFreshnessStatus> {
    const now = Date.now();
    if (this.cachedStatus && (now - this.lastCheck) < this.CACHE_TTL_MS) {
      return this.cachedStatus;
    }

    if (!isSupabaseConfigured || !supabase) {
      return this.getOfflineStatus();
    }

    try {
      // Get the most recent KvK date and count
      const { data, error } = await supabase
        .from('kvk_history')
        .select('kvk_date, kvk_number')
        .order('kvk_date', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Failed to fetch freshness data:', error);
        return this.getOfflineStatus();
      }

      const { count } = await supabase
        .from('kvk_history')
        .select('*', { count: 'exact', head: true });

      const latestDate = data?.[0]?.kvk_date ? new Date(data[0].kvk_date) : null;
      const latestKvK = data?.[0]?.kvk_number || 0;
      const recordCount = count || 0;

      const status = this.calculateFreshness(latestDate, latestKvK, recordCount);
      
      this.cachedStatus = status;
      this.lastCheck = now;
      
      return status;
    } catch (err) {
      console.error('Error checking data freshness:', err);
      return this.getOfflineStatus();
    }
  }

  /**
   * Calculate freshness based on last update date
   */
  private calculateFreshness(
    lastDate: Date | null,
    latestKvK: number,
    recordCount: number
  ): DataFreshnessStatus {
    const now = new Date();
    
    if (!lastDate) {
      return {
        source: 'kvk_history',
        lastUpdated: null,
        recordCount,
        staleness: 'critical',
        daysOld: -1,
        nextExpectedUpdate: null,
        message: 'No KvK data available'
      };
    }

    const daysOld = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Calculate next expected KvK date (every 28 days)
    const nextKvKDate = new Date(lastDate);
    nextKvKDate.setDate(nextKvKDate.getDate() + KVK_CYCLE_DAYS);

    let staleness: 'fresh' | 'aging' | 'stale' | 'critical';
    let message: string;

    if (daysOld <= FRESHNESS_THRESHOLDS.fresh) {
      staleness = 'fresh';
      message = `Data updated ${daysOld} days ago. Up to date!`;
    } else if (daysOld <= FRESHNESS_THRESHOLDS.aging) {
      staleness = 'aging';
      message = `Data is ${daysOld} days old. Consider updating after next KvK.`;
    } else if (daysOld <= FRESHNESS_THRESHOLDS.stale) {
      staleness = 'stale';
      message = `Data is ${daysOld} days old. KvK #${latestKvK + 1} results may be available.`;
    } else {
      staleness = 'critical';
      message = `Data is ${daysOld} days old! Multiple KvK cycles may be missing.`;
    }

    return {
      source: 'kvk_history',
      lastUpdated: lastDate,
      recordCount,
      staleness,
      daysOld,
      nextExpectedUpdate: nextKvKDate,
      message
    };
  }

  /**
   * Get offline/error status
   */
  private getOfflineStatus(): DataFreshnessStatus {
    return {
      source: 'kvk_history',
      lastUpdated: null,
      recordCount: 0,
      staleness: 'critical',
      daysOld: -1,
      nextExpectedUpdate: null,
      message: 'Unable to check data freshness (offline or error)'
    };
  }

  /**
   * Get active alerts based on current freshness
   */
  async getAlerts(): Promise<FreshnessAlert[]> {
    const status = await this.getKvKFreshnessStatus();
    const alerts: FreshnessAlert[] = [];

    if (status.staleness === 'stale') {
      alerts.push({
        id: 'kvk-stale',
        type: 'warning',
        source: 'kvk_history',
        message: status.message,
        actionRequired: 'Run sync script after battle phase ends',
        createdAt: new Date()
      });
    } else if (status.staleness === 'critical') {
      alerts.push({
        id: 'kvk-critical',
        type: 'error',
        source: 'kvk_history',
        message: status.message,
        actionRequired: 'Urgent: Update KvK data immediately',
        createdAt: new Date()
      });
    }

    // Check for upcoming KvK
    if (status.nextExpectedUpdate) {
      const daysUntilNext = Math.ceil(
        (status.nextExpectedUpdate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysUntilNext <= 3 && daysUntilNext > 0) {
        alerts.push({
          id: 'kvk-upcoming',
          type: 'info',
          source: 'kvk_history',
          message: `Next KvK expected in ${daysUntilNext} day${daysUntilNext === 1 ? '' : 's'}`,
          actionRequired: 'Prepare to collect new KvK results',
          createdAt: new Date()
        });
      }
    }

    return alerts;
  }

  /**
   * Check if data needs immediate attention
   */
  async needsAttention(): Promise<boolean> {
    const status = await this.getKvKFreshnessStatus();
    return status.staleness === 'stale' || status.staleness === 'critical';
  }

  /**
   * Get staleness color for UI
   */
  getStalenessColor(staleness: string): string {
    switch (staleness) {
      case 'fresh': return '#22c55e';
      case 'aging': return '#f59e0b';
      case 'stale': return '#f97316';
      case 'critical': return '#ef4444';
      default: return '#6b7280';
    }
  }

  /**
   * Invalidate cache (call after data sync)
   */
  invalidateCache(): void {
    this.cachedStatus = null;
    this.lastCheck = 0;
  }
}

export const dataFreshnessService = new DataFreshnessService();
