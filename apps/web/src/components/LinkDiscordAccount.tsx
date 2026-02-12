import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { discordService } from '../services/discordService';
import { useToast } from './Toast';

interface LinkDiscordAccountProps {
  discordId?: string | null;
  discordUsername?: string | null;
  onUnlink?: () => void;
  isDiscordAuth?: boolean;
}

const LinkDiscordAccount: React.FC<LinkDiscordAccountProps> = ({
  discordId,
  discordUsername,
  onUnlink,
  isDiscordAuth = false
}) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [isUnlinking, setIsUnlinking] = useState(false);

  const handleLinkDiscord = () => {
    if (!discordService.isConfigured()) {
      showToast(t('discord.notConfigured', 'Discord integration is not configured yet'), 'error');
      return;
    }
    
    // Generate a random state for security
    const state = Math.random().toString(36).substring(2);
    sessionStorage.setItem('discord_oauth_state', state);
    
    // Redirect to Discord OAuth
    window.location.href = discordService.getAuthUrl(state);
  };

  const handleUnlinkDiscord = async () => {
    setIsUnlinking(true);
    const result = await discordService.unlinkDiscord();
    setIsUnlinking(false);
    
    if (result.success) {
      showToast(t('discord.accountUnlinked', 'Discord account unlinked'), 'success');
      onUnlink?.();
    } else {
      showToast(result.error || t('discord.unlinkFailed', 'Failed to unlink Discord'), 'error');
    }
  };

  const isLinked = !!discordId;

  return (
    <div style={{
      backgroundColor: '#111116',
      borderRadius: '12px',
      padding: '1.25rem',
      border: '1px solid #2a2a2a'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
        <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: '600', margin: 0 }}>
          {t('discord.title', 'Discord Account')}
        </h3>
      </div>

      {isLinked ? (
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.75rem',
            backgroundColor: '#5865F215',
            borderRadius: '8px',
            marginBottom: '0.75rem'
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: '#5865F2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 'bold',
              fontSize: '0.9rem'
            }}>
              {discordUsername?.[0]?.toUpperCase() || 'D'}
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: '500', fontSize: '0.9rem' }}>
                {discordUsername || 'Discord User'}
              </div>
              <div style={{ color: '#22c55e', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                </svg>
                {t('discord.connected', 'Connected')}
              </div>
            </div>
          </div>
          
          <p style={{ color: '#6b7280', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
            {isDiscordAuth
              ? t('discord.connectedViaSignIn', 'Connected via Discord sign-in. Eligible roles will be synced automatically.')
              : t('discord.accountLinked', 'Your Discord account is linked. Eligible roles will be synced automatically.')}
          </p>
          
          {!isDiscordAuth && (
            <button
              onClick={handleUnlinkDiscord}
              disabled={isUnlinking}
              style={{
                width: '100%',
                padding: '0.6rem',
                backgroundColor: 'transparent',
                border: '1px solid #ef444440',
                borderRadius: '8px',
                color: '#ef4444',
                fontSize: '0.85rem',
                fontWeight: '500',
                cursor: isUnlinking ? 'wait' : 'pointer',
                opacity: isUnlinking ? 0.6 : 1
              }}
            >
              {isUnlinking ? t('discord.unlinking', 'Unlinking...') : t('discord.unlinkDiscord', 'Unlink Discord')}
            </button>
          )}
        </div>
      ) : (
        <div>
          <p style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            {t('discord.linkDesc', 'Link your Discord account to receive roles based on your Atlas achievements:')}
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6b7280', fontSize: '0.8rem' }}>
              <span style={{ color: '#FF6B8A' }}>*</span> {t('discord.supporterRole', 'Atlas Supporter role for subscribers')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6b7280', fontSize: '0.8rem' }}>
              <span style={{ color: '#a855f7' }}>*</span> {t('discord.recruiterRole', 'Atlas Recruiter role for affiliates')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6b7280', fontSize: '0.8rem' }}>
              <span style={{ color: '#f97316' }}>*</span> {t('discord.archivistRole', 'Atlas Archivist role for top contributors')}
            </div>
          </div>
          
          <button
            onClick={handleLinkDiscord}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: '#5865F2',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '0.9rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            {t('discord.linkDiscordAccount', 'Link Discord Account')}
          </button>
        </div>
      )}
    </div>
  );
};

export default LinkDiscordAccount;
