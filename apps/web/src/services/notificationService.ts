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
  | 'system_announcement'
  | 'favorite_score_change';

export interface NotificationPreferences {
  score_changes: boolean;
  submission_updates: boolean;
  system_announcements: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  score_changes: true,
  submission_updates: true,
  system_announcements: true,
};

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
      case 'favorite_score_change':
        return '📊';
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
      case 'favorite_score_change':
        return '#a855f7'; // purple
      default:
        return '#9ca3af'; // gray
    }
  }

  /**
   * Get notification preferences from user_data.settings
   */
  async getPreferences(): Promise<NotificationPreferences> {
    if (!isSupabaseConfigured || !supabase) {
      return { ...DEFAULT_NOTIFICATION_PREFERENCES };
    }

    try {
      const { data, error } = await supabase
        .from('user_data')
        .select('settings')
        .single();

      if (error || !data?.settings?.notification_preferences) {
        return { ...DEFAULT_NOTIFICATION_PREFERENCES };
      }

      const prefs = data.settings.notification_preferences;
      return {
        score_changes: prefs.score_changes !== false,
        submission_updates: prefs.submission_updates !== false,
        system_announcements: prefs.system_announcements !== false,
      };
    } catch (err) {
      logger.error('Error fetching notification preferences:', err);
      return { ...DEFAULT_NOTIFICATION_PREFERENCES };
    }
  }

  /**
   * Update notification preferences in user_data.settings
   */
  async updatePreferences(prefs: NotificationPreferences): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) {
      return false;
    }

    try {
      // First get current settings to merge
      const { data: current } = await supabase
        .from('user_data')
        .select('settings')
        .single();

      const currentSettings = current?.settings || {};
      const updatedSettings = {
        ...currentSettings,
        notification_preferences: {
          score_changes: prefs.score_changes,
          submission_updates: prefs.submission_updates,
          system_announcements: prefs.system_announcements,
        }
      };

      const { error } = await supabase
        .from('user_data')
        .update({ settings: updatedSettings })
        .not('user_id', 'is', null); // RLS handles user filtering

      if (error) {
        logger.error('Failed to update notification preferences:', error.message);
        return false;
      }

      return true;
    } catch (err) {
      logger.error('Error updating notification preferences:', err);
      return false;
    }
  }
}

export const notificationService = new NotificationService();
