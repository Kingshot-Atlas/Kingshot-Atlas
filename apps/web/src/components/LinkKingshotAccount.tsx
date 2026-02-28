import React, { useState, useEffect } from 'react';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useToast } from './Toast';
import { colors, neonGlow, transition, subscriptionColors } from '../utils/styles';
import { Button, Card } from './shared';
import { supabase } from '../lib/supabase';
import { useTranslation } from 'react-i18next';
import { logger } from '../utils/logger';
import { getAuthHeaders } from '../services/authHeaders';

// Get username color based on subscription tier (includes admin and gilded)
const getUsernameColor = (tier: string): string => {
  switch (tier) {
    case 'admin': return subscriptionColors.admin;     // Cyan
    case 'gilded': return subscriptionColors.gilded;   // Gold
    case 'supporter':
    case 'pro':        // Legacy
    case 'recruiter':  // Legacy
      return subscriptionColors.supporter;
    default: return colors.text; // White for free users
  }
};

// Convert TC level to display string (TC 31+ becomes TG tiers)
const formatTCLevel = (level: number): string => {
  if (level <= 30) return `TC ${level}`;
  if (level <= 34) return 'TC 30';
  const tgTier = Math.floor((level - 35) / 5) + 1;
  return `TG${tgTier}`;
};

// Avatar component with error handling - no crossOrigin to avoid CORS issues with Akamai CDN
const KingshotAvatar: React.FC<{
  url: string | null;
  size: number;
  borderColor: string;
}> = ({ url, size, borderColor }) => {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  
  // Reset error state when URL changes
  useEffect(() => {
    setImgError(false);
    setImgLoaded(false);
  }, [url]);

  // Timeout fallback - if image doesn't load in 5s, show fallback
  useEffect(() => {
    if (!url || imgLoaded || imgError) return;
    const timeout = setTimeout(() => {
      if (!imgLoaded) {
        logger.warn('Kingshot avatar timeout, showing fallback:', url);
        setImgError(true);
      }
    }, 5000);
    return () => clearTimeout(timeout);
  }, [url, imgLoaded, imgError]);

  if (!url || imgError) {
    return (
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          backgroundColor: colors.card,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: `${size * 0.4}px`,
          border: `2px solid ${borderColor}`,
        }}
      >
        👤
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: `${size}px`, height: `${size}px` }}>
      {!imgLoaded && (
        <div
          style={{
            position: 'absolute',
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: '50%',
            backgroundColor: colors.card,
            border: `2px solid ${borderColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: `${size * 0.3}px`,
          }}
        >
          ⏳
        </div>
      )}
      <img
        src={url}
        alt=""
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          border: `2px solid ${borderColor}`,
          objectFit: 'cover',
          opacity: imgLoaded ? 1 : 0,
          transition: 'opacity 0.2s ease-in-out',
        }}
        onLoad={() => setImgLoaded(true)}
        onError={() => {
          logger.error('Kingshot avatar failed to load:', url);
          setImgError(true);
        }}
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

// Loading skeleton for preview state
const LoadingSkeleton: React.FC = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem' }}>
    <div
      style={{
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        backgroundColor: colors.surface,
        animation: 'pulse 1.5s ease-in-out infinite',
      }}
    />
    <div style={{ flex: 1 }}>
      <div
        style={{
          height: '1.25rem',
          width: '60%',
          backgroundColor: colors.surface,
          borderRadius: '4px',
          marginBottom: '0.5rem',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      />
      <div
        style={{
          height: '0.85rem',
          width: '40%',
          backgroundColor: colors.surface,
          borderRadius: '4px',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      />
    </div>
  </div>
);

interface LinkedPlayerData {
  player_id: string;
  username: string;
  avatar_url: string | null;
  kingdom: number;
  town_center_level: number;
  verified: boolean;
}

interface LinkKingshotAccountProps {
  onLink?: (playerData: LinkedPlayerData) => void;
  onUnlink?: () => void;
  linkedPlayer?: LinkedPlayerData | null;
  showRefresh?: boolean;
  lastSynced?: string | null;
  onRefresh?: () => void;
  subscriptionTier?: string;
  isPublicView?: boolean;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

// Format relative time for last synced
const formatLastSynced = (dateString: string | null | undefined): string => {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

export const LinkKingshotAccount: React.FC<LinkKingshotAccountProps> = ({
  onLink,
  onUnlink,
  linkedPlayer,
  showRefresh = true,
  lastSynced,
  subscriptionTier = 'free',
  isPublicView = false,
}) => {
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [playerId, setPlayerId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<LinkedPlayerData | null>(null);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);

  const verifyPlayer = async (id: string): Promise<LinkedPlayerData> => {
    const authHeaders = await getAuthHeaders({ requireAuth: false });
    const response = await fetch(`${API_BASE}/api/v1/player-link/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ player_id: id }),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to verify player';
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail?.error || errorMessage;
      } catch {
        // Response body wasn't valid JSON (e.g. Render cold start HTML, CORS error)
        if (response.status === 429) errorMessage = 'Too many requests. Please wait a moment and try again.';
        else if (response.status >= 500) errorMessage = 'Server is temporarily unavailable. Please try again in a moment.';
      }
      throw new Error(errorMessage);
    }

    return response.json();
  };

  const refreshPlayer = async (id: string): Promise<LinkedPlayerData> => {
    const authHeaders = await getAuthHeaders({ requireAuth: false });
    const response = await fetch(`${API_BASE}/api/v1/player-link/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ player_id: id }),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to refresh player data';
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail?.error || errorMessage;
      } catch {
        if (response.status === 429) errorMessage = 'Too many requests. Please wait a moment.';
        else if (response.status >= 500) errorMessage = 'Server is temporarily unavailable. Please try again.';
      }
      throw new Error(errorMessage);
    }

    return response.json();
  };

  const handleVerify = async () => {
    if (!playerId.trim()) {
      setError(t('linkAccount.enterPlayerId', 'Please enter your Player ID'));
      return;
    }

    if (!/^\d{6,20}$/.test(playerId.trim())) {
      setError(t('linkAccount.playerIdFormat', 'Player ID must be 6-20 digits'));
      return;
    }

    setIsLoading(true);
    setError(null);
    setPreviewData(null);

    try {
      const data = await verifyPlayer(playerId.trim());

      // Check if this player ID is already linked to another Atlas account
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUserId = session?.user?.id;

        let query = supabase
          .from('profiles')
          .select('username')
          .eq('linked_player_id', playerId.trim());

        // Exclude current user — they may be re-linking their own ID
        if (currentUserId) {
          query = query.neq('id', currentUserId);
        }

        const { data: existing } = await query.maybeSingle();

        if (existing) {
          setError(t('linkAccount.alreadyLinked', 'This Player ID is already linked to another Atlas account.'));
          setIsLoading(false);
          return;
        }
      }

      setPreviewData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('linkAccount.verificationFailed', 'Verification failed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmLink = () => {
    if (previewData && onLink) {
      onLink(previewData);
      showToast(t('linkAccount.accountLinked', 'Account linked: {{name}}', { name: previewData.username }), 'success');
      setPreviewData(null);
      setPlayerId('');
    }
  };

  const handleCancelPreview = () => {
    setPreviewData(null);
    setPlayerId('');
  };

  const handleRefresh = async () => {
    if (!linkedPlayer) return;

    setIsRefreshing(true);
    setError(null);

    try {
      const data = await refreshPlayer(linkedPlayer.player_id);
      if (onLink) {
        onLink(data);
        showToast(t('linkAccount.dataRefreshed', 'Player data refreshed!'), 'success');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('linkAccount.refreshFailed', 'Refresh failed'));
      showToast(t('linkAccount.refreshError', 'Failed to refresh data'), 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleUnlink = () => {
    if (onUnlink) {
      onUnlink();
      showToast(t('linkAccount.accountUnlinked', 'Account unlinked'), 'info');
      setShowUnlinkConfirm(false);
    }
  };

  // If already linked, show linked account view
  if (linkedPlayer) {
    return (
      <Card
        borderColor={`${colors.success}40`}
        padding={{ mobile: '1rem', desktop: '1.5rem' }}
        style={{ backgroundColor: colors.card, borderRadius: '16px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: colors.text }}>
            {t('linkAccount.title', 'Link Kingshot Account')}
          </h3>
          <span
            style={{
              fontSize: '0.7rem',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              backgroundColor: `${colors.success}20`,
              color: colors.success,
              fontWeight: '600',
            }}
          >
            {t('linkAccount.verified', 'Verified')}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            gap: isMobile ? '0.875rem' : '1rem',
            padding: isMobile ? '0.875rem' : '1rem',
            backgroundColor: colors.surface,
            borderRadius: '12px',
            marginBottom: '1rem',
          }}
        >
          <KingshotAvatar 
            url={linkedPlayer.avatar_url} 
            size={isMobile ? 64 : 56} 
            borderColor={getUsernameColor(subscriptionTier)} 
          />

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {/* Row 1: Username */}
            <span 
              style={{ 
                fontSize: '1.1rem', 
                fontWeight: '700',
                color: getUsernameColor(subscriptionTier),
                ...(subscriptionTier !== 'free' ? neonGlow(getUsernameColor(subscriptionTier)) : {})
              }}
            >
              {linkedPlayer.username}
            </span>

            {/* Row 2: ID */}
            <div style={{ fontSize: '0.85rem', color: colors.textSecondary }}>
              <span style={{ color: colors.textMuted }}>ID:</span> {linkedPlayer.player_id}
            </div>

            {/* Row 3: Kingdom */}
            <div style={{ fontSize: '0.85rem', color: colors.textSecondary }}>
              <span style={{ color: colors.textMuted }}>{t('linkAccount.kingdom', 'Kingdom:')}</span> {linkedPlayer.kingdom}
            </div>

            {/* Row 4: Town Center */}
            <div style={{ fontSize: '0.85rem', color: colors.textSecondary }}>
              <span style={{ color: colors.textMuted }}>{t('linkAccount.townCenter', 'Town Center:')}</span> {formatTCLevel(linkedPlayer.town_center_level)}
            </div>

            {/* Last synced - only show if not public view */}
            {!isPublicView && (
              <div style={{ fontSize: '0.7rem', color: colors.textMuted, marginTop: '0.25rem' }}>
                {t('linkAccount.synced', 'Synced:')} {formatLastSynced(lastSynced)}
              </div>
            )}
          </div>
        </div>

        {/* Action buttons - only show for own profile (not public view) */}
        {!isPublicView && (
          <div style={{ 
            display: 'flex', 
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? '0.5rem' : '0.75rem', 
            flexWrap: 'wrap' 
          }}>
            {showRefresh && (
              <Button
                variant="secondary"
                onClick={handleRefresh}
                disabled={isRefreshing}
                loading={isRefreshing}
                icon={!isRefreshing ? <span>🔄</span> : undefined}
                style={{ 
                  flex: 1, 
                  minWidth: '120px',
                  minHeight: isMobile ? '48px' : 'auto',
                  fontSize: isMobile ? '0.9rem' : undefined
                }}
              >
                {isRefreshing ? t('linkAccount.refreshing', 'Refreshing...') : t('linkAccount.refreshData', 'Refresh Data')}
              </Button>
            )}

            {!showUnlinkConfirm ? (
              <Button 
                variant="danger" 
                onClick={() => setShowUnlinkConfirm(true)}
                style={{ 
                  minHeight: isMobile ? '48px' : 'auto',
                  width: isMobile ? '100%' : 'auto'
                }}
              >
                {t('linkAccount.unlink', 'Unlink')}
              </Button>
            ) : (
              <div style={{ 
                display: 'flex', 
                gap: '0.5rem',
                width: isMobile ? '100%' : 'auto'
              }}>
                <Button
                  variant="danger"
                  onClick={handleUnlink}
                  style={{ 
                    backgroundColor: colors.error, 
                    color: '#fff', 
                    border: 'none',
                    minHeight: isMobile ? '48px' : 'auto',
                    flex: isMobile ? 1 : 'none'
                  }}
                >
                  {t('common.confirm', 'Confirm')}
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => setShowUnlinkConfirm(false)}
                  style={{ 
                    minHeight: isMobile ? '48px' : 'auto',
                    flex: isMobile ? 1 : 'none'
                  }}
                >
                  {t('common.cancel', 'Cancel')}
                </Button>
              </div>
            )}
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: '1rem',
              padding: '0.75rem',
              borderRadius: '8px',
              backgroundColor: `${colors.error}15`,
              border: `1px solid ${colors.error}40`,
              color: colors.error,
              fontSize: '0.85rem',
            }}
          >
            {error}
          </div>
        )}
      </Card>
    );
  }

  // Preview mode - show fetched data for confirmation
  if (previewData) {
    return (
      <Card
        borderColor={`${colors.primary}40`}
        padding={{ mobile: '1rem', desktop: '1.5rem' }}
        style={{ backgroundColor: colors.card, borderRadius: '16px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: colors.text }}>
            {t('linkAccount.accountFound', 'Account Found - Confirm Link')}
          </h3>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            padding: '1rem',
            backgroundColor: colors.surface,
            borderRadius: '12px',
            marginBottom: '1rem',
          }}
        >
          <KingshotAvatar 
            url={previewData.avatar_url} 
            size={64} 
            borderColor={colors.primary} 
          />

          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: '1.25rem',
                fontWeight: '700',
                marginBottom: '0.5rem',
                ...neonGlow(colors.primary),
              }}
            >
              {previewData.username}
            </div>
            <div
              style={{
                display: 'flex',
                gap: '1rem',
                flexWrap: 'wrap',
                fontSize: '0.85rem',
                color: colors.textSecondary,
              }}
            >
              <span>🏰 {t('common.kingdom', 'Kingdom')} {previewData.kingdom}</span>
              <span>🏠 {formatTCLevel(previewData.town_center_level)}</span>
            </div>
          </div>
        </div>

        <p style={{ fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '1rem' }}>
          {t('linkAccount.confirmPrompt', 'Is this your account? Click "Link Account" to connect it to your Atlas profile.')}
        </p>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={handleConfirmLink}
            style={{
              flex: 1,
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: colors.primary,
              color: '#000',
              fontSize: '0.9rem',
              fontWeight: '700',
              cursor: 'pointer',
              transition: transition.fast,
            }}
          >
            ✓ {t('linkAccount.linkAccount', 'Link Account')}
          </button>
          <button
            onClick={handleCancelPreview}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
              backgroundColor: 'transparent',
              color: colors.textSecondary,
              fontSize: '0.9rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: transition.fast,
            }}
          >
            {t('common.cancel', 'Cancel')}
          </button>
        </div>
      </Card>
    );
  }

  // Default: Input mode
  return (
    <Card
      padding={{ mobile: '1rem', desktop: '1.5rem' }}
      style={{ backgroundColor: colors.card, borderRadius: '16px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: colors.text }}>
          {t('linkAccount.title', 'Link Kingshot Account')}
        </h3>
      </div>

      <p style={{ fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '1rem', lineHeight: 1.5 }}>
        {t('linkAccount.description', 'Connect your in-game account to auto-fill your profile with your avatar, username, kingdom, and Town Center level.')}
      </p>

      <div style={{ marginBottom: '1rem' }}>
        <label
          htmlFor="player-id"
          style={{
            display: 'block',
            fontSize: '0.8rem',
            fontWeight: '600',
            color: colors.textSecondary,
            marginBottom: '0.5rem',
          }}
        >
          {t('linkAccount.playerIdLabel', 'Player ID')}
        </label>
        <input
          id="player-id"
          type="text"
          value={playerId}
          onChange={(e) => {
            setPlayerId(e.target.value.replace(/\D/g, ''));
            setError(null);
          }}
          placeholder={t('linkAccount.playerIdPlaceholder', 'Enter your numeric Player ID')}
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            border: `1px solid ${error ? colors.error : colors.border}`,
            backgroundColor: colors.surface,
            color: colors.text,
            fontSize: '1rem',
            outline: 'none',
            transition: transition.fast,
          }}
          onFocus={(e) => {
            e.target.style.borderColor = colors.primary;
            e.target.style.boxShadow = `0 0 0 2px ${colors.primary}30`;
          }}
          onBlur={(e) => {
            e.target.style.borderColor = error ? colors.error : colors.border;
            e.target.style.boxShadow = 'none';
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleVerify();
            }
          }}
        />
        <p style={{ fontSize: '0.75rem', color: colors.textMuted, marginTop: '0.5rem' }}>
          {t('linkAccount.findPlayerId', 'Find your Player ID in-game: Settings → Account → Player ID')}
        </p>
      </div>

      {isLoading && (
        <div
          style={{
            marginBottom: '1rem',
            backgroundColor: colors.surface,
            borderRadius: '12px',
            border: `1px solid ${colors.primary}30`,
          }}
        >
          <LoadingSkeleton />
          <div style={{ textAlign: 'center', paddingBottom: '0.75rem', color: colors.textSecondary, fontSize: '0.8rem' }}>
            {t('linkAccount.verifying', 'Verifying player ID...')}
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.75rem',
            borderRadius: '8px',
            backgroundColor: `${colors.error}15`,
            border: `1px solid ${colors.error}40`,
            color: colors.error,
            fontSize: '0.85rem',
          }}
        >
          {error}
        </div>
      )}

      <Button
        variant="primary"
        onClick={handleVerify}
        disabled={isLoading || !playerId.trim()}
        loading={isLoading}
        icon={!isLoading ? <span>🔍</span> : undefined}
        fullWidth
      >
        {isLoading ? t('linkAccount.verifying', 'Verifying...') : t('linkAccount.verifyPlayerId', 'Verify Player ID')}
      </Button>

      {/* Privacy & Security Trust Section */}
      <div
        style={{
          marginTop: '1.25rem',
          padding: '0.85rem 1rem',
          borderRadius: '10px',
          backgroundColor: `${colors.success}06`,
          border: `1px solid ${colors.success}20`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem' }}>🔒</span>
          <span style={{ fontSize: '0.8rem', fontWeight: '700', color: colors.success }}>
            {t('linkAccount.securityTitle', 'Your Data is Safe')}
          </span>
        </div>
        <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.75rem', color: colors.textSecondary, lineHeight: 1.7, listStyleType: 'none' }}>
          <li style={{ position: 'relative', paddingLeft: '0.25rem' }}>
            <span style={{ position: 'absolute', left: '-1.1rem', color: colors.success }}>✓</span>
            {t('linkAccount.securityNoPassword', 'We never ask for or store your game password')}
          </li>
          <li style={{ position: 'relative', paddingLeft: '0.25rem' }}>
            <span style={{ position: 'absolute', left: '-1.1rem', color: colors.success }}>✓</span>
            {t('linkAccount.securityReadOnly', 'Read-only access — we only fetch your public profile (name, avatar, kingdom)')}
          </li>
          <li style={{ position: 'relative', paddingLeft: '0.25rem' }}>
            <span style={{ position: 'absolute', left: '-1.1rem', color: colors.success }}>✓</span>
            {t('linkAccount.securityNoGameAccess', 'We cannot access, modify, or control your game account in any way')}
          </li>
          <li style={{ position: 'relative', paddingLeft: '0.25rem' }}>
            <span style={{ position: 'absolute', left: '-1.1rem', color: colors.success }}>✓</span>
            {t('linkAccount.securityUnlink', 'You can unlink at any time — your data is deleted from our servers instantly')}
          </li>
          <li style={{ position: 'relative', paddingLeft: '0.25rem' }}>
            <span style={{ position: 'absolute', left: '-1.1rem', color: colors.success }}>✓</span>
            {t('linkAccount.securityOpenSource', 'Atlas is community-built and transparent — our code is open for review')}
          </li>
        </ul>
      </div>
    </Card>
  );
};

export default LinkKingshotAccount;
