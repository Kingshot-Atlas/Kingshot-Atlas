/**
 * Service for handling in-app notifications
 * Notifications are stored in Supabase and displayed via NotificationBell component
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logger } from '../utils/logger';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

export type NotificationType = 
  | 'admin_new_transfer'
  | 'admin_new_submission'
  | 'admin_new_claim'
  | 'admin_new_correction'
  | 'submission_approved'
  | 'submission_rejected'
  | 'claim_verified'
  | 'claim_rejected'
  | 'system_announcement';

class NotificationService {
  /**
   * Fetch all notifications for the current user
   */
  async getNotifications(limit: number = 20): Promise<Notification[]> {
    if (!isSupabaseConfigured || !supabase) {
      logger.warn('Supabase not configured - notifications unavailable');
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Failed to fetch notifications:', error.message);
        return [];
      }

      return data || [];
    } catch (err) {
      logger.error('Error fetching notifications:', err);
      return [];
    }
  }

  /**
   * Get count of unread notifications
   */
  async getUnreadCount(): Promise<number> {
    if (!isSupabaseConfigured || !supabase) {
      return 0;
    }

    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('read', false);

      if (error) {
        logger.error('Failed to fetch unread count:', error.message);
        return 0;
      }

      return count || 0;
    } catch (err) {
      logger.error('Error fetching unread count:', err);
      return 0;
    }
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) {
      return false;
    }

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) {
        logger.error('Failed to mark notification as read:', error.message);
        return false;
      }

      return true;
    } catch (err) {
      logger.error('Error marking notification as read:', err);
      return false;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) {
      return false;
    }

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('read', false);

      if (error) {
        logger.error('Failed to mark all notifications as read:', error.message);
        return false;
      }

      return true;
    } catch (err) {
      logger.error('Error marking all as read:', err);
      return false;
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) {
      return false;
    }

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) {
        logger.error('Failed to delete notification:', error.message);
        return false;
      }

      return true;
    } catch (err) {
      logger.error('Error deleting notification:', err);
      return false;
    }
  }

  /**
   * Clear all notifications for the current user
   */
  async clearAll(): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) {
      return false;
    }

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (RLS handles user filtering)

      if (error) {
        logger.error('Failed to clear notifications:', error.message);
        return false;
      }

      return true;
    } catch (err) {
      logger.error('Error clearing notifications:', err);
      return false;
    }
  }

  /**
   * Subscribe to real-time notification updates
   * Returns an unsubscribe function
   */
  subscribeToNotifications(
    userId: string,
    onNewNotification: (notification: Notification) => void
  ): () => void {
    if (!isSupabaseConfigured || !supabase) {
      return () => {};
    }

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          onNewNotification(payload.new as Notification);
        }
      )
      .subscribe();

    return () => {
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  }

  /**
   * Get notification icon based on type
   */
  getNotificationIcon(type: NotificationType): string {
    switch (type) {
      case 'admin_new_transfer':
        return '🔄';
      case 'admin_new_submission':
        return '⚔️';
      case 'admin_new_claim':
        return '👑';
      case 'admin_new_correction':
        return '📝';
      case 'submission_approved':
        return '✅';
      case 'submission_rejected':
        return '❌';
      case 'claim_verified':
        return '✓';
      case 'claim_rejected':
        return '✗';
      case 'system_announcement':
        return '📢';
      default:
        return '🔔';
    }
  }

  /**
   * Get notification color based on type
   */
  getNotificationColor(type: NotificationType): string {
    switch (type) {
      case 'submission_approved':
      case 'claim_verified':
        return '#22c55e'; // green
      case 'submission_rejected':
      case 'claim_rejected':
        return '#ef4444'; // red
      case 'admin_new_transfer':
      case 'admin_new_submission':
      case 'admin_new_claim':
      case 'admin_new_correction':
        return '#f59e0b'; // amber
      case 'system_announcement':
        return '#22d3ee'; // cyan
      default:
        return '#9ca3af'; // gray
    }
  }
}

export const notificationService = new NotificationService();
