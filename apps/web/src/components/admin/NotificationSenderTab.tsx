import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../Toast';
import { logger } from '../../utils/logger';
import { colors } from '../../utils/styles';

const cardStyle: React.CSSProperties = {
  backgroundColor: '#111116',
  borderRadius: '10px',
  border: '1px solid #2a2a2a',
  padding: '1.25rem',
};

export const NotificationSenderTab: React.FC = () => {
  const { showToast } = useToast();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('');
  const [sending, setSending] = useState(false);
  const [sentHistory, setSentHistory] = useState<Array<{ title: string; message: string; link: string; count: number; sentAt: string }>>([]);

  const handleSend = async () => {
    if (!supabase) return;
    if (!title.trim() || !message.trim()) {
      showToast('Title and message are required', 'error');
      return;
    }

    setSending(true);
    try {
      // Get all user IDs from profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id');

      if (profilesError) throw profilesError;
      if (!profiles || profiles.length === 0) {
        showToast('No users found', 'error');
        setSending(false);
        return;
      }

      // Build notification rows
      const notifications = profiles.map(p => ({
        user_id: p.id,
        type: 'system_announcement' as const,
        title: title.trim(),
        message: message.trim(),
        link: link.trim() || null,
        metadata: { source: 'admin_broadcast' },
        read: false,
      }));

      // Insert in batches of 500 to avoid payload limits
      const BATCH_SIZE = 500;
      let totalInserted = 0;
      for (let i = 0; i < notifications.length; i += BATCH_SIZE) {
        const batch = notifications.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('notifications').insert(batch);
        if (error) throw error;
        totalInserted += batch.length;
      }

      setSentHistory(prev => [{
        title: title.trim(),
        message: message.trim(),
        link: link.trim(),
        count: totalInserted,
        sentAt: new Date().toISOString(),
      }, ...prev]);

      showToast(`Notification sent to ${totalInserted} users`, 'success');
      setTitle('');
      setMessage('');
      setLink('');
    } catch (err) {
      logger.error('Failed to send broadcast notification:', err);
      showToast('Failed to send notification', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Compose */}
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 1rem', color: '#e5e7eb', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          📢 Send Site-Wide Notification
        </h3>
        <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '0 0 1rem' }}>
          This will send a notification to <strong style={{ color: '#e5e7eb' }}>every user</strong> on the platform.
          It will appear in their notification bell as a system announcement.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Title */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.25rem', fontWeight: 600 }}>
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. New Feature: Kingdom Settlers Campaign"
              maxLength={100}
              style={{
                width: '100%',
                padding: '0.6rem 0.75rem',
                backgroundColor: '#0a0a0a',
                border: '1px solid #2a2a2a',
                borderRadius: '6px',
                color: '#e5e7eb',
                fontSize: '0.85rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <span style={{ fontSize: '0.65rem', color: '#6b7280', marginTop: '0.15rem', display: 'block' }}>
              {title.length}/100
            </span>
          </div>

          {/* Message */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.25rem', fontWeight: 600 }}>
              Message
            </label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="e.g. Check out the Kingdom Settlers Campaign! Win prizes for growing your kingdom on Atlas."
              maxLength={300}
              rows={3}
              style={{
                width: '100%',
                padding: '0.6rem 0.75rem',
                backgroundColor: '#0a0a0a',
                border: '1px solid #2a2a2a',
                borderRadius: '6px',
                color: '#e5e7eb',
                fontSize: '0.85rem',
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
            <span style={{ fontSize: '0.65rem', color: '#6b7280', marginTop: '0.15rem', display: 'block' }}>
              {message.length}/300
            </span>
          </div>

          {/* Link */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.25rem', fontWeight: 600 }}>
              Link (optional)
            </label>
            <input
              type="text"
              value={link}
              onChange={e => setLink(e.target.value)}
              placeholder="e.g. /campaigns/kingdom-settlers or https://ks-atlas.com/..."
              style={{
                width: '100%',
                padding: '0.6rem 0.75rem',
                backgroundColor: '#0a0a0a',
                border: '1px solid #2a2a2a',
                borderRadius: '6px',
                color: '#e5e7eb',
                fontSize: '0.85rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <span style={{ fontSize: '0.65rem', color: '#6b7280', marginTop: '0.15rem', display: 'block' }}>
              Clicking the notification will navigate the user to this URL
            </span>
          </div>

          {/* Preview */}
          {(title.trim() || message.trim()) && (
            <div style={{
              backgroundColor: '#0a0a0a',
              borderRadius: '8px',
              border: '1px solid #2a2a2a',
              padding: '0.75rem',
            }}>
              <p style={{ color: '#6b7280', fontSize: '0.7rem', margin: '0 0 0.5rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Preview
              </p>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                <span style={{
                  fontSize: '1.25rem',
                  flexShrink: 0,
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: `${colors.primary}15`,
                  borderRadius: '6px',
                }}>
                  📢
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, color: '#e5e7eb' }}>
                    {title.trim() || 'Notification Title'}
                  </p>
                  <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {message.trim() || 'Notification message...'}
                  </p>
                  {link.trim() && (
                    <span style={{ fontSize: '0.65rem', color: colors.primary, marginTop: '0.2rem', display: 'block' }}>
                      → {link.trim()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={sending || !title.trim() || !message.trim()}
            style={{
              padding: '0.65rem 1.5rem',
              backgroundColor: sending || !title.trim() || !message.trim() ? '#333' : colors.primary,
              color: sending || !title.trim() || !message.trim() ? '#666' : '#0a0a0a',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 700,
              cursor: sending || !title.trim() || !message.trim() ? 'not-allowed' : 'pointer',
              fontSize: '0.85rem',
              alignSelf: 'flex-start',
            }}
          >
            {sending ? 'Sending…' : '📢 Send to All Users'}
          </button>
        </div>
      </div>

      {/* Sent History (session only) */}
      {sentHistory.length > 0 && (
        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 0.75rem', color: '#e5e7eb', fontSize: '0.9rem' }}>
            Recent Broadcasts (this session)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {sentHistory.map((item, i) => (
              <div key={i} style={{
                padding: '0.6rem',
                backgroundColor: '#0a0a0a',
                borderRadius: '6px',
                border: '1px solid #1a1a1a',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.8rem', color: '#e5e7eb' }}>{item.title}</span>
                  <span style={{ fontSize: '0.65rem', color: '#22c55e' }}>✓ Sent to {item.count} users</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af' }}>{item.message}</p>
                {item.link && <span style={{ fontSize: '0.65rem', color: colors.primary }}>→ {item.link}</span>}
                <span style={{ display: 'block', fontSize: '0.6rem', color: '#4b5563', marginTop: '0.25rem' }}>
                  {new Date(item.sentAt).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationSenderTab;
