import React, { useState, useEffect } from 'react';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useToast } from './Toast';
import { colors, neonGlow, transition } from '../utils/styles';

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
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
      )}
      <img
        src={url}
        alt=""
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          border: `2px solid ${borderColor}`,
          opacity: imgLoaded ? 1 : 0,
          transition: 'opacity 0.2s ease-in-out',
        }}
        onLoad={() => setImgLoaded(true)}
        onError={() => {
          console.error('Kingshot avatar failed to load:', url);
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
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export const LinkKingshotAccount: React.FC<LinkKingshotAccountProps> = ({
  onLink,
  onUnlink,
  linkedPlayer,
  showRefresh = true,
}) => {
  const isMobile = useIsMobile();
  const { showToast } = useToast();
  const [playerId, setPlayerId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<LinkedPlayerData | null>(null);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);

  const verifyPlayer = async (id: string): Promise<LinkedPlayerData> => {
    const response = await fetch(`${API_BASE}/api/player-link/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ player_id: id }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail?.error || 'Failed to verify player');
    }

    return response.json();
  };

  const refreshPlayer = async (id: string): Promise<LinkedPlayerData> => {
    const response = await fetch(`${API_BASE}/api/player-link/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ player_id: id }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail?.error || 'Failed to refresh player data');
    }

    return response.json();
  };

  const handleVerify = async () => {
    if (!playerId.trim()) {
      setError('Please enter your Player ID');
      return;
    }

    if (!/^\d{6,20}$/.test(playerId.trim())) {
      setError('Player ID must be 6-20 digits');
      return;
    }

    setIsLoading(true);
    setError(null);
    setPreviewData(null);

    try {
      const data = await verifyPlayer(playerId.trim());
      setPreviewData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmLink = () => {
    if (previewData && onLink) {
      onLink(previewData);
      showToast(`Account linked: ${previewData.username}`, 'success');
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
        showToast('Player data refreshed!', 'success');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed');
      showToast('Failed to refresh data', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleUnlink = () => {
    if (onUnlink) {
      onUnlink();
      showToast('Account unlinked', 'info');
      setShowUnlinkConfirm(false);
    }
  };

  // If already linked, show linked account view
  if (linkedPlayer) {
    return (
      <div
        style={{
          backgroundColor: colors.card,
          borderRadius: '16px',
          padding: isMobile ? '1rem' : '1.5rem',
          border: `1px solid ${colors.success}40`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <span style={{ fontSize: '1.25rem' }}>🎮</span>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: colors.text }}>
            Linked Kingshot Account
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
            Verified
          </span>
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
            url={linkedPlayer.avatar_url} 
            size={56} 
            borderColor={colors.primary} 
          />

          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: '1.1rem',
                fontWeight: '700',
                marginBottom: '0.25rem',
                ...neonGlow(colors.primary),
              }}
            >
              {linkedPlayer.username}
            </div>
            <div style={{ fontSize: '0.8rem', color: colors.textSecondary }}>
              Kingdom {linkedPlayer.kingdom} • {formatTCLevel(linkedPlayer.town_center_level)}
            </div>
            <div style={{ fontSize: '0.7rem', color: colors.textMuted, marginTop: '0.25rem' }}>
              ID: {linkedPlayer.player_id}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {showRefresh && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              style={{
                flex: 1,
                minWidth: '120px',
                padding: '0.6rem 1rem',
                borderRadius: '8px',
                border: `1px solid ${colors.primary}40`,
                backgroundColor: 'transparent',
                color: colors.primary,
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: isRefreshing ? 'not-allowed' : 'pointer',
                opacity: isRefreshing ? 0.6 : 1,
                transition: transition.fast,
              }}
            >
              {isRefreshing ? '⏳ Refreshing...' : '🔄 Refresh Data'}
            </button>
          )}

          {!showUnlinkConfirm ? (
            <button
              onClick={() => setShowUnlinkConfirm(true)}
              style={{
                padding: '0.6rem 1rem',
                borderRadius: '8px',
                border: `1px solid ${colors.error}40`,
                backgroundColor: 'transparent',
                color: colors.error,
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: transition.fast,
              }}
            >
              Unlink
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handleUnlink}
                style={{
                  padding: '0.6rem 1rem',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: colors.error,
                  color: '#fff',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Confirm
              </button>
              <button
                onClick={() => setShowUnlinkConfirm(false)}
                style={{
                  padding: '0.6rem 1rem',
                  borderRadius: '8px',
                  border: `1px solid ${colors.border}`,
                  backgroundColor: 'transparent',
                  color: colors.textSecondary,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>

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
      </div>
    );
  }

  // Preview mode - show fetched data for confirmation
  if (previewData) {
    return (
      <div
        style={{
          backgroundColor: colors.card,
          borderRadius: '16px',
          padding: isMobile ? '1rem' : '1.5rem',
          border: `1px solid ${colors.primary}40`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <span style={{ fontSize: '1.25rem' }}>✅</span>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: colors.text }}>
            Account Found - Confirm Link
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
              <span>🏰 Kingdom {previewData.kingdom}</span>
              <span>🏠 {formatTCLevel(previewData.town_center_level)}</span>
            </div>
          </div>
        </div>

        <p style={{ fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '1rem' }}>
          Is this your account? Click "Link Account" to connect it to your Atlas profile.
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
            ✓ Link Account
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
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Default: Input mode
  return (
    <div
      style={{
        backgroundColor: colors.card,
        borderRadius: '16px',
        padding: isMobile ? '1rem' : '1.5rem',
        border: `1px solid ${colors.border}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <span style={{ fontSize: '1.25rem' }}>🔗</span>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: colors.text }}>
          Link Kingshot Account
        </h3>
      </div>

      <p style={{ fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '1rem', lineHeight: 1.5 }}>
        Connect your in-game account to auto-fill your profile with your avatar, username, kingdom, and Town Center level.
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
          Player ID
        </label>
        <input
          id="player-id"
          type="text"
          value={playerId}
          onChange={(e) => {
            setPlayerId(e.target.value.replace(/\D/g, ''));
            setError(null);
          }}
          placeholder="Enter your numeric Player ID"
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
          Find your Player ID in-game: Settings → Account → Player ID
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
            Verifying player ID...
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

      <button
        onClick={handleVerify}
        disabled={isLoading || !playerId.trim()}
        style={{
          width: '100%',
          padding: '0.75rem 1.5rem',
          borderRadius: '8px',
          border: 'none',
          backgroundColor: isLoading || !playerId.trim() ? colors.border : colors.primary,
          color: isLoading || !playerId.trim() ? colors.textMuted : '#000',
          fontSize: '0.9rem',
          fontWeight: '700',
          cursor: isLoading || !playerId.trim() ? 'not-allowed' : 'pointer',
          transition: transition.fast,
        }}
      >
        {isLoading ? '⏳ Verifying...' : '🔍 Verify Player ID'}
      </button>
    </div>
  );
};

export default LinkKingshotAccount;
