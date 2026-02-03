/**
 * ContributorService - Handles B1-B5 and C4-C5 features
 * B1: Auto-apply approved corrections
 * B2: Screenshot verification tracking
 * B3: Reputation scoring
 * B4: Duplicate detection
 * B5: Data quality reporting
 * C4: Contributor leaderboard
 * C5: Badge rewards
 * 
 * IMPORTANT: Supabase is the SINGLE SOURCE OF TRUTH (ADR-010, ADR-011)
 * Stats are computed from submission tables, notifications use Supabase notifications table
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logger } from '../utils/logger';

export interface SubmissionCounts {
  total: number;
  approved: number;
  rejected: number;
  pending: number;
}

export interface ContributorStats {
  userId: string;
  username: string;
  statusSubmissions: SubmissionCounts;   // Transfer status changes
  kvkCorrections: SubmissionCounts;      // KvK result corrections
  kvkSubmissions: SubmissionCounts;      // New KvK data submissions
  dataCorrections: SubmissionCounts;     // Kingdom data corrections
  kvkErrors: SubmissionCounts;           // KvK error reports
  totals: SubmissionCounts;              // Aggregate across all types
  reputation: number;
  badges: string[];
  lastActive: string;
  joinedAt: string;
}

export interface UserNotification {
  id: string;
  userId: string;
  type: 'submission_approved' | 'submission_rejected' | 'correction_approved' | 'correction_rejected' | 'badge_earned' | 'appeal_response';
  title: string;
  message: string;
  itemId?: string;
  read: boolean;
  createdAt: string;
}

export interface DataQualityReport {
  generatedAt: string;
  period: 'weekly' | 'monthly';
  stats: {
    totalSubmissions: number;
    approvalRate: number;
    avgResponseTime: number;
    topContributors: { userId: string; username: string; approved: number }[];
    commonErrors: { type: string; count: number }[];
    duplicatesDetected: number;
  };
}

// Badge definitions - Tiers: Scout (1), Hunter (5), Master (10), Legend (25)
const BADGES = {
  // Data contribution tiers
  data_scout: { name: 'Data Scout', description: '1 approved contribution', icon: '🥉', tier: 1 },
  data_hunter: { name: 'Data Hunter', description: '5 approved contributions', icon: '🥈', tier: 2 },
  data_master: { name: 'Data Master', description: '10 approved contributions', icon: '🥇', tier: 3 },
  atlas_legend: { name: 'Atlas Legend', description: '25 approved contributions - Discord role eligible', icon: '👑', tier: 4 },
  // Special badges
  perfect_accuracy: { name: 'Sharp Eye', description: '10+ submissions with 100% approval', icon: '👁️', tier: 0 },
  quick_responder: { name: 'Speed Demon', description: 'Submitted 5 corrections in one day', icon: '⚡', tier: 0 },
  veteran: { name: 'Veteran', description: 'Contributing for 30+ days', icon: '🏆', tier: 0 },
  screenshot_hero: { name: 'Evidence Expert', description: '10 submissions with screenshots', icon: '📸', tier: 0 },
};

class ContributorService {
  /**
   * Compute contributor stats from submission tables (source of truth)
   */
  async getContributorStats(userId: string): Promise<ContributorStats | null> {
    if (!isSupabaseConfigured || !supabase) {
      return null;
    }

    try {
      // Get profile for username and join date
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, created_at')
        .eq('id', userId)
        .single();

      // Query all 5 submission tables in parallel
      const [statusRes, correctionsRes, kvkSubsRes, dataCorRes, kvkErrorsRes] = await Promise.all([
        supabase.from('status_submissions').select('status').eq('submitted_by', userId),
        supabase.from('kvk_corrections').select('status').eq('submitted_by', userId),
        supabase.from('kvk_submissions').select('status').eq('submitter_id', userId),
        supabase.from('data_corrections').select('status').eq('submitted_by', userId),
        supabase.from('kvk_errors').select('status').eq('submitted_by', userId),
      ]);

      const countByStatus = (items: { status: string }[] | null): SubmissionCounts => {
        const result = { total: 0, approved: 0, rejected: 0, pending: 0 };
        if (!items) return result;
        for (const item of items) {
          result.total++;
          if (item.status === 'approved') result.approved++;
          else if (item.status === 'rejected') result.rejected++;
          else if (item.status === 'pending') result.pending++;
        }
        return result;
      };

      const statusSubmissions = countByStatus(statusRes.data);
      const kvkCorrections = countByStatus(correctionsRes.data);
      const kvkSubmissions = countByStatus(kvkSubsRes.data);
      const dataCorrections = countByStatus(dataCorRes.data);
      const kvkErrors = countByStatus(kvkErrorsRes.data);

      // Aggregate totals across all submission types
      const totals: SubmissionCounts = {
        total: statusSubmissions.total + kvkCorrections.total + kvkSubmissions.total + dataCorrections.total + kvkErrors.total,
        approved: statusSubmissions.approved + kvkCorrections.approved + kvkSubmissions.approved + dataCorrections.approved + kvkErrors.approved,
        rejected: statusSubmissions.rejected + kvkCorrections.rejected + kvkSubmissions.rejected + dataCorrections.rejected + kvkErrors.rejected,
        pending: statusSubmissions.pending + kvkCorrections.pending + kvkSubmissions.pending + dataCorrections.pending + kvkErrors.pending,
      };

      // Calculate reputation: base 100 + 10 per approved - 5 per rejected
      const reputation = Math.max(0, Math.min(1000, 100 + (totals.approved * 10) - (totals.rejected * 5)));

      // Determine badges based on stats
      const badges = this.computeBadges(
        totals.approved,
        totals.total,
        totals.rejected,
        profile?.created_at || new Date().toISOString()
      );

      return {
        userId,
        username: profile?.username || 'Unknown',
        statusSubmissions,
        kvkCorrections,
        kvkSubmissions,
        dataCorrections,
        kvkErrors,
        totals,
        reputation,
        badges,
        lastActive: new Date().toISOString(),
        joinedAt: profile?.created_at || new Date().toISOString()
      };
    } catch (err) {
      logger.error('Failed to get contributor stats:', err);
      return null;
    }
  }

  /**
   * Compute badges based on stats
   */
  private computeBadges(totalApproved: number, totalSubmitted: number, totalRejected: number, joinedAt: string): string[] {
    const badges: string[] = [];

    if (totalApproved >= 1) badges.push('data_scout');
    if (totalApproved >= 5) badges.push('data_hunter');
    if (totalApproved >= 10) badges.push('data_master');
    if (totalApproved >= 25) badges.push('atlas_legend');

    if (totalSubmitted >= 10 && totalRejected === 0) {
      badges.push('perfect_accuracy');
    }

    const daysSinceJoin = Math.floor((Date.now() - new Date(joinedAt).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceJoin >= 30 && totalApproved >= 5) {
      badges.push('veteran');
    }

    return badges;
  }

  /**
   * Get leaderboard - computed from submission tables
   */
  async getLeaderboard(limit: number = 10): Promise<ContributorStats[]> {
    if (!isSupabaseConfigured || !supabase) {
      return [];
    }

    try {
      // Query all 5 submission tables for approved items in parallel
      const [statusRes, correctionsRes, kvkSubsRes, dataCorRes, kvkErrorsRes] = await Promise.all([
        supabase.from('status_submissions').select('submitted_by').eq('status', 'approved'),
        supabase.from('kvk_corrections').select('submitted_by').eq('status', 'approved'),
        supabase.from('kvk_submissions').select('submitter_id').eq('status', 'approved'),
        supabase.from('data_corrections').select('submitted_by').eq('status', 'approved'),
        supabase.from('kvk_errors').select('submitted_by').eq('status', 'approved'),
      ]);

      // Count approvals per user across all tables
      const userApprovals = new Map<string, number>();
      
      const addApprovals = (items: { submitted_by?: string; submitter_id?: string }[] | null) => {
        for (const item of items || []) {
          const id = item.submitted_by || item.submitter_id;
          if (id) userApprovals.set(id, (userApprovals.get(id) || 0) + 1);
        }
      };

      addApprovals(statusRes.data);
      addApprovals(correctionsRes.data);
      addApprovals((kvkSubsRes.data || []).map(d => ({ submitter_id: d.submitter_id })));
      addApprovals(dataCorRes.data);
      addApprovals(kvkErrorsRes.data);

      // Sort by approval count and get top users
      const topUsers = Array.from(userApprovals.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);

      // Get full stats for top users
      const results: ContributorStats[] = [];
      for (const [userId] of topUsers) {
        const stats = await this.getContributorStats(userId);
        if (stats) results.push(stats);
      }

      return results;
    } catch (err) {
      logger.error('Failed to get leaderboard:', err);
      return [];
    }
  }

  /**
   * Check for duplicate pending submission in Supabase
   */
  async checkDuplicate(type: 'correction' | 'kvkError', data: Record<string, unknown>): Promise<{ isDuplicate: boolean; existingId?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { isDuplicate: false };
    }

    try {
      if (type === 'correction') {
        const { data: existing } = await supabase
          .from('kvk_corrections')
          .select('id')
          .eq('kingdom_number', data.kingdom_number as number)
          .eq('kvk_number', data.kvk_number as number)
          .eq('status', 'pending')
          .limit(1);

        return { 
          isDuplicate: (existing?.length || 0) > 0, 
          existingId: existing?.[0]?.id?.toString() 
        };
      }

      if (type === 'kvkError') {
        const { data: existing } = await supabase
          .from('kvk_submissions')
          .select('id')
          .eq('kingdom_number', data.kingdom_number as number)
          .eq('kvk_number', data.kvk_number as number)
          .eq('status', 'pending')
          .limit(1);

        return { 
          isDuplicate: (existing?.length || 0) > 0, 
          existingId: existing?.[0]?.id?.toString() 
        };
      }

      return { isDuplicate: false };
    } catch (err) {
      logger.error('Failed to check duplicate:', err);
      return { isDuplicate: false };
    }
  }

  /**
   * Add notification using Supabase notifications table
   */
  async addNotification(userId: string, notification: Omit<UserNotification, 'id' | 'userId' | 'read' | 'createdAt'>): Promise<void> {
    if (!isSupabaseConfigured || !supabase) {
      logger.warn('Cannot add notification - Supabase not configured');
      return;
    }

    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          link: notification.itemId ? `/submissions/${notification.itemId}` : null,
          metadata: { itemId: notification.itemId },
          read: false
        });

      if (error) {
        logger.error('Failed to add notification:', error.message);
      }
    } catch (err) {
      logger.error('Error adding notification:', err);
    }
  }

  /**
   * Get notifications from Supabase
   */
  async getNotifications(userId: string): Promise<UserNotification[]> {
    if (!isSupabaseConfigured || !supabase) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        logger.error('Failed to get notifications:', error.message);
        return [];
      }

      return (data || []).map(n => ({
        id: n.id,
        userId: n.user_id,
        type: n.type as UserNotification['type'],
        title: n.title,
        message: n.message,
        itemId: n.metadata?.itemId,
        read: n.read,
        createdAt: n.created_at
      }));
    } catch (err) {
      logger.error('Error getting notifications:', err);
      return [];
    }
  }

  /**
   * Mark notification as read in Supabase
   */
  async markNotificationRead(notificationId: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) {
        logger.error('Failed to mark notification read:', error.message);
      }
    } catch (err) {
      logger.error('Error marking notification read:', err);
    }
  }

  /**
   * Get unread count from Supabase
   */
  async getUnreadCount(userId: string): Promise<number> {
    if (!isSupabaseConfigured || !supabase) {
      return 0;
    }

    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) {
        logger.error('Failed to get unread count:', error.message);
        return 0;
      }

      return count || 0;
    } catch (err) {
      logger.error('Error getting unread count:', err);
      return 0;
    }
  }

  /**
   * Generate data quality report from Supabase
   */
  async generateDataQualityReport(): Promise<DataQualityReport> {
    const emptyReport: DataQualityReport = {
      generatedAt: new Date().toISOString(),
      period: 'weekly',
      stats: {
        totalSubmissions: 0,
        approvalRate: 0,
        avgResponseTime: 24,
        topContributors: [],
        commonErrors: [],
        duplicatesDetected: 0
      }
    };

    if (!isSupabaseConfigured || !supabase) {
      return emptyReport;
    }

    try {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Get recent corrections
      const { data: corrections } = await supabase
        .from('kvk_corrections')
        .select('status, submitted_by')
        .gte('corrected_at', oneWeekAgo);

      // Get recent status submissions
      const { data: statusSubs } = await supabase
        .from('status_submissions')
        .select('status, submitted_by')
        .gte('submitted_at', oneWeekAgo);

      const allRecent = [...(corrections || []), ...(statusSubs || [])];
      const total = allRecent.length;
      const approved = allRecent.filter(s => s.status === 'approved').length;

      // Get top contributors
      const leaderboard = await this.getLeaderboard(5);
      const topContributors = leaderboard.map(c => ({
        userId: c.userId,
        username: c.username,
        approved: c.totals.approved
      }));

      return {
        generatedAt: new Date().toISOString(),
        period: 'weekly',
        stats: {
          totalSubmissions: total,
          approvalRate: total > 0 ? Math.round((approved / total) * 100) : 0,
          avgResponseTime: 24,
          topContributors,
          commonErrors: [],
          duplicatesDetected: 0
        }
      };
    } catch (err) {
      logger.error('Failed to generate data quality report:', err);
      return emptyReport;
    }
  }

  // Sync methods for backward compatibility (now async)
  // These are kept for components that may still use sync patterns
  
  updateReputation(_userId: string, _username: string, _type: 'submission' | 'correction' | 'kvkError', _approved: boolean): void {
    // No-op: Stats are now computed from submission tables
    // The actual data is updated when submissions are approved/rejected
  }

  trackNewSubmission(_userId: string, _username: string, _type: 'submission' | 'correction' | 'kvkError', _hasScreenshot: boolean = false): void {
    // No-op: Stats are now computed from submission tables
  }

  getAllContributors(): ContributorStats[] {
    // Deprecated: Use getLeaderboard() async method instead
    logger.warn('getAllContributors() is deprecated - use async getLeaderboard()');
    return [];
  }

  getBadgeInfo(badgeId: string) {
    return BADGES[badgeId as keyof typeof BADGES] || { name: badgeId, description: '', icon: '🏅', tier: 0 };
  }

  getAllBadges() {
    return BADGES;
  }
}

export const contributorService = new ContributorService();
