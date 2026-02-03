import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getPowerTier, type PowerTier } from '../types';

interface ScoreChange {
  kingdomNumber: number;
  oldScore: number;
  newScore: number;
  change: number;
  oldTier: PowerTier;
  newTier: PowerTier;
  tierChanged: boolean;
  timestamp: string;
}

interface ScoreChangeNotification {
  id: string;
  type: 'score_up' | 'score_down' | 'tier_up' | 'tier_down';
  kingdomNumber: number;
  message: string;
  change: ScoreChange;
  read: boolean;
  createdAt: string;
}

const STORAGE_KEY = 'kingshot_score_notifications';
const FOLLOWED_KEY = 'kingshot_followed_kingdoms';

export function useScoreChangeNotifications() {
  // Auth context available for future user-specific notifications
  useAuth();
  const [notifications, setNotifications] = useState<ScoreChangeNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Load notifications from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ScoreChangeNotification[];
        setNotifications(parsed);
        setUnreadCount(parsed.filter(n => !n.read).length);
      } catch {
        setNotifications([]);
      }
    }
  }, []);
  
  // Save notifications to localStorage
  const saveNotifications = useCallback((newNotifications: ScoreChangeNotification[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newNotifications));
    setNotifications(newNotifications);
    setUnreadCount(newNotifications.filter(n => !n.read).length);
  }, []);
  
  // Get followed kingdoms
  const getFollowedKingdoms = useCallback((): number[] => {
    const stored = localStorage.getItem(FOLLOWED_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return [];
      }
    }
    return [];
  }, []);
  
  // Follow a kingdom
  const followKingdom = useCallback((kingdomNumber: number) => {
    const followed = getFollowedKingdoms();
    if (!followed.includes(kingdomNumber)) {
      followed.push(kingdomNumber);
      localStorage.setItem(FOLLOWED_KEY, JSON.stringify(followed));
    }
  }, [getFollowedKingdoms]);
  
  // Unfollow a kingdom
  const unfollowKingdom = useCallback((kingdomNumber: number) => {
    const followed = getFollowedKingdoms();
    const updated = followed.filter(k => k !== kingdomNumber);
    localStorage.setItem(FOLLOWED_KEY, JSON.stringify(updated));
  }, [getFollowedKingdoms]);
  
  // Check if a kingdom is followed
  const isFollowing = useCallback((kingdomNumber: number): boolean => {
    return getFollowedKingdoms().includes(kingdomNumber);
  }, [getFollowedKingdoms]);
  
  // Add a score change notification
  const addScoreChange = useCallback((change: ScoreChange) => {
    const followed = getFollowedKingdoms();
    
    // Only notify for followed kingdoms
    if (!followed.includes(change.kingdomNumber)) {
      return;
    }
    
    let type: ScoreChangeNotification['type'];
    let message: string;
    
    if (change.tierChanged) {
      if (change.newScore > change.oldScore) {
        type = 'tier_up';
        message = `K${change.kingdomNumber} promoted to ${change.newTier}-Tier! (+${change.change.toFixed(2)})`;
      } else {
        type = 'tier_down';
        message = `K${change.kingdomNumber} dropped to ${change.newTier}-Tier (${change.change.toFixed(2)})`;
      }
    } else {
      if (change.change > 0) {
        type = 'score_up';
        message = `K${change.kingdomNumber} score increased by +${change.change.toFixed(2)}`;
      } else {
        type = 'score_down';
        message = `K${change.kingdomNumber} score decreased by ${change.change.toFixed(2)}`;
      }
    }
    
    const notification: ScoreChangeNotification = {
      id: `${change.kingdomNumber}-${Date.now()}`,
      type,
      kingdomNumber: change.kingdomNumber,
      message,
      change,
      read: false,
      createdAt: new Date().toISOString()
    };
    
    const updated = [notification, ...notifications].slice(0, 50); // Keep last 50
    saveNotifications(updated);
  }, [notifications, getFollowedKingdoms, saveNotifications]);
  
  // Mark notification as read
  const markAsRead = useCallback((notificationId: string) => {
    const updated = notifications.map(n => 
      n.id === notificationId ? { ...n, read: true } : n
    );
    saveNotifications(updated);
  }, [notifications, saveNotifications]);
  
  // Mark all as read
  const markAllAsRead = useCallback(() => {
    const updated = notifications.map(n => ({ ...n, read: true }));
    saveNotifications(updated);
  }, [notifications, saveNotifications]);
  
  // Clear all notifications
  const clearAll = useCallback(() => {
    saveNotifications([]);
  }, [saveNotifications]);
  
  // Process score updates from API (to be called when scores are fetched)
  const processScoreUpdates = useCallback((
    currentScores: Map<number, number>,
    previousScores: Map<number, number>
  ) => {
    const followed = getFollowedKingdoms();
    
    followed.forEach(kingdomNumber => {
      const current = currentScores.get(kingdomNumber);
      const previous = previousScores.get(kingdomNumber);
      
      if (current !== undefined && previous !== undefined && current !== previous) {
        const change: ScoreChange = {
          kingdomNumber,
          oldScore: previous,
          newScore: current,
          change: current - previous,
          oldTier: getPowerTier(previous),
          newTier: getPowerTier(current),
          tierChanged: getPowerTier(previous) !== getPowerTier(current),
          timestamp: new Date().toISOString()
        };
        
        // Only notify for significant changes
        if (Math.abs(change.change) >= 0.05 || change.tierChanged) {
          addScoreChange(change);
        }
      }
    });
  }, [getFollowedKingdoms, addScoreChange]);
  
  return {
    notifications,
    unreadCount,
    followedKingdoms: getFollowedKingdoms(),
    followKingdom,
    unfollowKingdom,
    isFollowing,
    addScoreChange,
    processScoreUpdates,
    markAsRead,
    markAllAsRead,
    clearAll
  };
}

export type { ScoreChange, ScoreChangeNotification };
