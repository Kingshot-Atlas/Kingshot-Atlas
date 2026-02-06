import React, { useState, useEffect, useCallback } from 'react';
import { notificationService, type NotificationPreferences as Prefs, DEFAULT_NOTIFICATION_PREFERENCES } from '../services/notificationService';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useMediaQuery';

interface ToggleItemProps {
  label: string;
  description: string;
  icon: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  isMobile: boolean;
}

const ToggleItem: React.FC<ToggleItemProps> = ({ label, description, icon, enabled, onChange, isMobile }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: isMobile ? '0.75rem 0' : '0.625rem 0',
      borderBottom: '1px solid #1a1a1a',
      gap: '0.75rem',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
      <span style={{
        fontSize: '1.1rem',
        width: '28px',
        height: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1a1a1a',
        borderRadius: '6px',
        flexShrink: 0,
      }}>
        {icon}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.85rem', fontWeight: '500', color: '#fff' }}>{label}</div>
        <div style={{ fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.3, marginTop: '0.125rem' }}>{description}</div>
      </div>
    </div>
    <button
      onClick={() => onChange(!enabled)}
      role="switch"
      aria-checked={enabled}
      aria-label={`${label} notifications`}
      style={{
        width: '44px',
        height: '24px',
        borderRadius: '12px',
        border: 'none',
        backgroundColor: enabled ? '#22d3ee' : '#333',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background-color 0.2s',
        flexShrink: 0,
        minWidth: '44px',
        minHeight: isMobile ? '44px' : '24px',
        display: 'flex',
        alignItems: 'center',
        padding: 0,
      }}
    >
      <span style={{
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        backgroundColor: '#fff',
        position: 'absolute',
        top: '50%',
        transform: 'translateY(-50%)',
        left: enabled ? '22px' : '2px',
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </button>
  </div>
);

const NotificationPreferences: React.FC = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [preferences, setPreferences] = useState<Prefs>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    notificationService.getPreferences()
      .then(prefs => setPreferences(prefs))
      .finally(() => setLoading(false));
  }, [user]);

  const handleChange = useCallback(async (key: keyof Prefs, value: boolean) => {
    const updated = { ...preferences, [key]: value };
    setPreferences(updated);
    setSaving(true);
    const success = await notificationService.updatePreferences(updated);
    if (!success) {
      // Revert on failure
      setPreferences(preferences);
    }
    setSaving(false);
  }, [preferences]);

  if (!user) return null;

  return (
    <div style={{
      backgroundColor: '#111111',
      borderRadius: '12px',
      padding: isMobile ? '1rem' : '1.25rem',
      marginBottom: '1.5rem',
      border: '1px solid #2a2a2a',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '0.75rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.1rem' }}>🔔</span>
          <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '600', color: '#fff' }}>
            Notification Preferences
          </h3>
        </div>
        {saving && (
          <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>Saving...</span>
        )}
      </div>

      {loading ? (
        <div style={{ padding: '1rem 0', color: '#6b7280', fontSize: '0.85rem' }}>
          Loading preferences...
        </div>
      ) : (
        <div>
          <ToggleItem
            icon="📊"
            label="Score Changes"
            description="Get notified when a favorited kingdom's Atlas Score changes after a KvK"
            enabled={preferences.score_changes}
            onChange={(v) => handleChange('score_changes', v)}
            isMobile={isMobile}
          />
          <ToggleItem
            icon="✅"
            label="Submission Updates"
            description="Get notified when your KvK submissions are approved or rejected"
            enabled={preferences.submission_updates}
            onChange={(v) => handleChange('submission_updates', v)}
            isMobile={isMobile}
          />
          <ToggleItem
            icon="📢"
            label="System Announcements"
            description="Important Atlas updates, new features, and maintenance notices"
            enabled={preferences.system_announcements}
            onChange={(v) => handleChange('system_announcements', v)}
            isMobile={isMobile}
          />
          <p style={{
            margin: '0.75rem 0 0',
            fontSize: '0.7rem',
            color: '#4b5563',
            lineHeight: 1.4,
          }}>
            Preferences apply to new notifications only. Favorite a kingdom to start receiving score change alerts.
          </p>
        </div>
      )}
    </div>
  );
};

export default NotificationPreferences;
