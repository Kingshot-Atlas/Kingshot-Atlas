import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { colors } from '../../utils/styles';

interface ToolGrantBannerProps {
  toolId: string;
  toolLabel: string;
  hasGrant: boolean;
  isTrial: boolean;
  expiresAt: string | null;
  accentColor?: string;
}

/**
 * Reusable banner shown at the top of tool pages for admin-granted users.
 * - Trial grants: persistent amber countdown "Access expires in X"
 * - Permanent grants: dismissible green "You have been granted access!" (once per tool via localStorage)
 */
const ToolGrantBanner: React.FC<ToolGrantBannerProps> = ({
  toolId, toolLabel, hasGrant, isTrial, expiresAt, accentColor = '#22c55e',
}) => {
  const { t } = useTranslation();
  const dismissKey = `tool_grant_seen_${toolId}`;
  const [dismissed, setDismissed] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  // Check localStorage for permanent grant dismissal
  useEffect(() => {
    if (!isTrial && hasGrant) {
      try {
        if (localStorage.getItem(dismissKey)) setDismissed(true);
      } catch { /* */ }
    }
  }, [hasGrant, isTrial, dismissKey]);

  // Live countdown for trial grants
  useEffect(() => {
    if (!isTrial || !expiresAt) return;
    const update = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      if (ms <= 0) { setTimeLeft(t('toolGrantBanner.expired', 'Expired')); return; }
      const days = Math.floor(ms / 86400000);
      const hours = Math.floor((ms % 86400000) / 3600000);
      const mins = Math.floor((ms % 3600000) / 60000);
      if (days > 0) setTimeLeft(`${days}d ${hours}h`);
      else if (hours > 0) setTimeLeft(`${hours}h ${mins}m`);
      else setTimeLeft(`${mins}m`);
    };
    update();
    const iv = setInterval(update, 60000);
    return () => clearInterval(iv);
  }, [isTrial, expiresAt, t]);

  if (!hasGrant) return null;

  // Permanent grant — show once, then dismiss
  if (!isTrial) {
    if (dismissed) return null;
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '0.75rem', padding: '0.6rem 1rem',
        backgroundColor: `${accentColor}12`, border: `1px solid ${accentColor}40`,
        borderRadius: 10, marginBottom: '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: '1rem' }}>🎉</span>
          <span style={{ color: accentColor, fontSize: '0.8rem', fontWeight: 600 }}>
            {t('toolGrantBanner.granted', 'You have been granted access to {{tool}}!', { tool: toolLabel })}
          </span>
        </div>
        <button
          onClick={() => {
            setDismissed(true);
            try { localStorage.setItem(dismissKey, '1'); } catch { /* */ }
          }}
          style={{
            background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer',
            fontSize: '1rem', padding: '0.25rem', lineHeight: 1, flexShrink: 0,
          }}
          aria-label={t('toolGrantBanner.dismiss', 'Dismiss')}
        >
          ✕
        </button>
      </div>
    );
  }

  // Trial grant — persistent countdown
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.5rem',
      padding: '0.6rem 1rem',
      backgroundColor: '#f59e0b12', border: '1px solid #f59e0b40',
      borderRadius: 10, marginBottom: '1rem',
    }}>
      <span style={{ fontSize: '1rem' }}>⏳</span>
      <span style={{ color: '#f59e0b', fontSize: '0.8rem', fontWeight: 600 }}>
        {t('toolGrantBanner.trialExpires', 'Trial access expires in {{time}}', { time: timeLeft })}
      </span>
    </div>
  );
};

export default ToolGrantBanner;
