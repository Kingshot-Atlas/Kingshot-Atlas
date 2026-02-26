import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { notificationService, type Notification } from '../services/notificationService';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useTranslation } from 'react-i18next';
import { logger } from '../utils/logger';

interface GroupedNotification {
  key: string;
  notifications: Notification[];
  latestNotification: Notification;
  count: number;
}

const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [mutedConversations, setMutedConversations] = useState<string[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Group notifications: messages by chat (application_id), others by type+title within 1 hour
  const groupedNotifications = useMemo((): GroupedNotification[] => {
    const groups: GroupedNotification[] = [];
    const ONE_HOUR = 60 * 60 * 1000;

    notifications.forEach(notif => {
      const existing = groups.find(g => {
        // For messages: group by application_id (same chat thread)
        if (notif.type === 'new_message' && g.latestNotification.type === 'new_message') {
          const notifAppId = (notif.metadata as Record<string, unknown>)?.application_id;
          const groupAppId = (g.latestNotification.metadata as Record<string, unknown>)?.application_id;
          return !!notifAppId && !!groupAppId && notifAppId === groupAppId;
        }
        // For other types: existing grouping (type + title within 1 hour)
        const timeDiff = Math.abs(
          new Date(g.latestNotification.created_at).getTime() - new Date(notif.created_at).getTime()
        );
        return g.latestNotification.type === notif.type
          && g.latestNotification.title === notif.title
          && timeDiff < ONE_HOUR;
      });

      if (existing) {
        existing.notifications.push(notif);
        existing.count++;
        // Keep the most recent notification as the representative
        if (new Date(notif.created_at) > new Date(existing.latestNotification.created_at)) {
          existing.latestNotification = notif;
        }
      } else {
        groups.push({
          key: notif.id,
          notifications: [notif],
          latestNotification: notif,
          count: 1
        });
      }
    });

    return groups;
  }, [notifications]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [notifs, count, muted] = await Promise.all([
        notificationService.getNotifications(20),
        notificationService.getUnreadCount(),
        notificationService.getMutedConversations(),
      ]);
      setNotifications(notifs);
      setUnreadCount(count);
      setMutedConversations(muted);
      setLastChecked(new Date());
    } catch (err) {
      logger.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const handleMuteConversation = async (e: React.MouseEvent, group: GroupedNotification) => {
    e.stopPropagation();
    const appId = (group.latestNotification.metadata as Record<string, unknown>)?.application_id as string | undefined;
    if (!appId) return;
    const isMuted = mutedConversations.includes(appId);
    if (isMuted) {
      const success = await notificationService.unmuteConversation(appId);
      if (success) setMutedConversations(prev => prev.filter(id => id !== appId));
    } else {
      const success = await notificationService.muteConversation(appId);
      if (success) setMutedConversations(prev => [...prev, appId]);
    }
  };

  useEffect(() => {
    if (!user) return;
    
    fetchNotifications();
    
    const unsubscribe = notificationService.subscribeToNotifications(
      user.id,
      (newNotification) => {
        // Dedup guard: skip if notification ID already exists in state
        setNotifications(prev => {
          if (prev.some(n => n.id === newNotification.id)) return prev;
          return [newNotification, ...prev].slice(0, 20);
        });
        setUnreadCount(prev => prev + 1);
      }
    );

    return unsubscribe;
  }, [user, fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current && 
        !panelRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const resolveNotificationLink = (notification: Notification): string | null => {
    const meta = notification.metadata || {};
    const kn = meta.kingdom_number as number | undefined;
    // For new_message, always use type-specific routing (deep-link to chat)
    // to override legacy link values like '/transfer-hub'
    if (notification.type === 'new_message') {
      const appId = meta.application_id as string | undefined;
      return appId ? `/messages?app=${appId}` : '/messages';
    }
    if (notification.link) return notification.link;
    switch (notification.type) {
      case 'admin_new_submission':
        return '/admin?tab=kvk-submissions';
      case 'admin_new_claim':
        return '/admin?tab=claims';
      case 'admin_new_transfer':
      case 'admin_new_correction':
        return '/admin?tab=transfer-hub';
      case 'submission_approved':
        return kn ? `/kingdom/${kn}` : '/profile';
      case 'submission_rejected':
        return '/submit-result';
      case 'claim_verified':
      case 'claim_rejected':
        return '/profile';
      case 'fund_contribution':
      case 'fund_grace_period':
      case 'fund_tier_change':
        return '/transfer-hub';
      case 'new_application':
      case 'application_status':
      case 'application_expiring':
      case 'co_editor_invite':
      case 'co_editor_request':
      case 'editor_activated':
      case 'endorsement_received':
        return '/transfer-hub';
      case 'referral_verified':
        return '/profile';
      case 'favorite_score_change':
        return kn ? `/kingdom/${kn}` : '/';
      case 'prep_schedule_form':
        return notification.link || '/tools/prep-scheduler';
      case 'system_announcement':
        return notification.link || '/';
      default:
        return '/';
    }
  };

  const handleGroupClick = async (group: GroupedNotification) => {
    const unreadInGroup = group.notifications.filter(n => !n.read);
    if (unreadInGroup.length > 0) {
      await Promise.all(unreadInGroup.map(n => notificationService.markAsRead(n.id)));
      const unreadIds = new Set(unreadInGroup.map(n => n.id));
      setNotifications(prev =>
        prev.map(n => unreadIds.has(n.id) ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - unreadInGroup.length));
    }
    const link = resolveNotificationLink(group.latestNotification);
    if (link) {
      navigate(link);
    }
    setIsOpen(false);
  };

  const handleMarkAllRead = async () => {
    await notificationService.markAllAsRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const handleClearAll = async () => {
    await notificationService.clearAll();
    setNotifications([]);
    setUnreadCount(0);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('notifications.justNow', 'Just now');
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (!user) return null;

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '44px',
          height: '44px',
          backgroundColor: isOpen ? '#1a1a1a' : 'transparent',
          border: '1px solid transparent',
          borderRadius: '8px',
          color: unreadCount > 0 ? '#22d3ee' : '#9ca3af',
          cursor: 'pointer',
          position: 'relative',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          if (!isOpen) e.currentTarget.style.backgroundColor = '#1a1a1a';
        }}
        onMouseLeave={(e) => {
          if (!isOpen) e.currentTarget.style.backgroundColor = 'transparent';
        }}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '2px',
            right: '2px',
            minWidth: '16px',
            height: '16px',
            backgroundColor: '#ef4444',
            borderRadius: '8px',
            fontSize: '0.65rem',
            fontWeight: '700',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
            border: '2px solid #0a0a0a'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          style={{
            position: isMobile ? 'fixed' : 'absolute',
            top: isMobile ? '60px' : '100%',
            right: isMobile ? '1rem' : 0,
            left: isMobile ? '1rem' : 'auto',
            marginTop: isMobile ? 0 : '0.5rem',
            width: isMobile ? 'auto' : '360px',
            maxWidth: '400px',
            backgroundColor: '#111111',
            border: '1px solid #2a2a2a',
            borderRadius: '12px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.6)',
            zIndex: 1000,
            overflow: 'hidden'
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            borderBottom: '1px solid #2a2a2a'
          }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600', color: '#fff' }}>
              {t('notifications.title', 'Notifications')}
            </h3>
            {notifications.length > 0 && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#22d3ee',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      padding: '0.5rem 0.75rem',
                      minHeight: '36px',
                      borderRadius: '4px'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#22d3ee15'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    {t('notifications.markAllRead', 'Mark all read')}
                  </button>
                )}
                <button
                  onClick={handleClearAll}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#6b7280',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    padding: '0.5rem 0.75rem',
                    minHeight: '36px',
                    borderRadius: '4px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  {t('notifications.clearAll', 'Clear all')}
                </button>
              </div>
            )}
          </div>

          {/* Notification List */}
          <div style={{
            maxHeight: '400px',
            overflowY: 'auto'
          }}>
            {loading && notifications.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                {t('common.loading', 'Loading...')}
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="1.5" style={{ opacity: 0.4, margin: '0 auto 0.75rem' }}>
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <p style={{ margin: '0 0 0.25rem', fontSize: '0.85rem', color: '#9ca3af' }}>{t('notifications.allCaughtUp', "You're all caught up!")}</p>
                {lastChecked && (
                  <p style={{ margin: 0, fontSize: '0.7rem', color: '#4b5563' }}>
                    Last checked {formatTime(lastChecked.toISOString())}
                  </p>
                )}
              </div>
            ) : (
              groupedNotifications.map((group) => {
                const notification = group.latestNotification;
                const hasUnread = group.notifications.some(n => !n.read);
                return (
                  <button
                    key={group.key}
                    onClick={() => handleGroupClick(group)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                      padding: '0.75rem 1rem',
                      backgroundColor: hasUnread ? '#22d3ee08' : 'transparent',
                      border: 'none',
                      borderBottom: '1px solid #1a1a1a',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = hasUnread ? '#22d3ee08' : 'transparent'}
                  >
                    {/* Icon / Avatar */}
                    {notification.type === 'new_message' && (notification.metadata as Record<string, unknown>)?.sender_avatar_url ? (
                      <span style={{ flexShrink: 0, width: '28px', height: '28px', position: 'relative' }}>
                        <img
                          src={(notification.metadata as Record<string, unknown>).sender_avatar_url as string}
                          alt=""
                          style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                        {group.count > 1 && (
                          <span style={{
                            position: 'absolute', top: '-4px', right: '-4px',
                            minWidth: '14px', height: '14px',
                            backgroundColor: '#3b82f6', borderRadius: '7px',
                            fontSize: '0.55rem', fontWeight: '700', color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px'
                          }}>{group.count}</span>
                        )}
                      </span>
                    ) : (
                      <span style={{
                        fontSize: '1.25rem',
                        flexShrink: 0,
                        width: '28px',
                        height: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: `${notificationService.getNotificationColor(notification.type)}15`,
                        borderRadius: '6px',
                        position: 'relative'
                      }}>
                        {notificationService.getNotificationIcon(notification.type)}
                        {group.count > 1 && (
                          <span style={{
                            position: 'absolute', top: '-4px', right: '-4px',
                            minWidth: '14px', height: '14px',
                            backgroundColor: notificationService.getNotificationColor(notification.type),
                            borderRadius: '7px', fontSize: '0.55rem', fontWeight: '700', color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px'
                          }}>{group.count}</span>
                        )}
                      </span>
                    )}

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: '0.25rem'
                      }}>
                        <span style={{
                          fontSize: '0.85rem',
                          fontWeight: hasUnread ? '600' : '400',
                          color: '#fff',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {group.count > 1
                            ? `${notification.title} (+${group.count - 1} more)`
                            : notification.title}
                        </span>
                        {hasUnread && (
                          <span style={{
                            width: '6px',
                            height: '6px',
                            backgroundColor: '#22d3ee',
                            borderRadius: '50%',
                            flexShrink: 0
                          }} />
                        )}
                      </div>
                      <p style={{
                        margin: 0,
                        fontSize: '0.8rem',
                        color: '#9ca3af',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical'
                      }}>
                        {notification.message}
                      </p>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginTop: '0.25rem',
                      }}>
                        <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>
                          {formatTime(notification.created_at)}
                        </span>
                        {notification.type === 'new_message' && !!(notification.metadata as Record<string, unknown>)?.application_id && (
                          <button
                            onClick={(e) => handleMuteConversation(e, group)}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              fontSize: '0.6rem', color: '#6b7280', padding: '0 0.2rem',
                              opacity: 0.7,
                            }}
                            title={mutedConversations.includes((notification.metadata as Record<string, unknown>).application_id as string) ? t('notifications.unmute', 'Unmute this chat') : t('notifications.mute', 'Mute this chat')}
                          >
                            {mutedConversations.includes((notification.metadata as Record<string, unknown>).application_id as string) ? '🔇' : '🔔'}
                          </button>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
