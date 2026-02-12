import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { notificationService, type Notification } from '../services/notificationService';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useTranslation } from 'react-i18next';

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
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Group similar notifications (same type + title within 1 hour)
  const groupedNotifications = useMemo((): GroupedNotification[] => {
    const groups: GroupedNotification[] = [];
    const ONE_HOUR = 60 * 60 * 1000;

    notifications.forEach(notif => {
      const existing = groups.find(g => {
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
      const [notifs, count] = await Promise.all([
        notificationService.getNotifications(20),
        notificationService.getUnreadCount()
      ]);
      setNotifications(notifs);
      setUnreadCount(count);
      setLastChecked(new Date());
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

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

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await notificationService.markAsRead(notification.id);
      setNotifications(prev => 
        prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    
    if (notification.link) {
      navigate(notification.link);
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
                    onClick={() => handleNotificationClick(notification)}
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
                    {/* Icon */}
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
                          position: 'absolute',
                          top: '-4px',
                          right: '-4px',
                          minWidth: '14px',
                          height: '14px',
                          backgroundColor: notificationService.getNotificationColor(notification.type),
                          borderRadius: '7px',
                          fontSize: '0.55rem',
                          fontWeight: '700',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0 3px'
                        }}>
                          {group.count}
                        </span>
                      )}
                    </span>

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
                      <span style={{
                        fontSize: '0.7rem',
                        color: '#6b7280',
                        marginTop: '0.25rem',
                        display: 'block'
                      }}>
                        {formatTime(notification.created_at)}
                      </span>
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
