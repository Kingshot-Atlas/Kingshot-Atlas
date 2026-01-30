import React, { useState, useEffect } from 'react';
import { userDataService } from '../services/userDataService';
import { useToast } from './Toast';
import { useAuth } from '../contexts/AuthContext';

interface FollowKingdomButtonProps {
  kingdomId: number;
  themeColor?: string;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}

const FollowKingdomButton: React.FC<FollowKingdomButtonProps> = ({
  kingdomId,
  themeColor = '#22d3ee',
  size = 'medium',
  showLabel = true,
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsFollowing(userDataService.isFollowing(kingdomId));
  }, [kingdomId]);

  const handleToggleFollow = async () => {
    if (!user) {
      showToast('Sign in to follow kingdoms', 'info');
      return;
    }

    setIsLoading(true);
    try {
      const result = await userDataService.toggleFollowKingdom(kingdomId);
      setIsFollowing(result.followed);
      
      if (result.followed) {
        showToast(`Now following Kingdom ${kingdomId}`, 'success');
      } else {
        showToast(`Unfollowed Kingdom ${kingdomId}`, 'info');
      }
    } catch (err) {
      showToast('Failed to update follow status', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const sizeStyles = {
    small: { padding: '0.3rem 0.6rem', fontSize: '0.75rem', gap: '0.25rem' },
    medium: { padding: '0.5rem 1rem', fontSize: '0.85rem', gap: '0.4rem' },
    large: { padding: '0.65rem 1.25rem', fontSize: '0.95rem', gap: '0.5rem' },
  };

  const style = sizeStyles[size];

  return (
    <button
      onClick={handleToggleFollow}
      disabled={isLoading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: style.gap,
        padding: style.padding,
        fontSize: style.fontSize,
        fontWeight: '600',
        borderRadius: '8px',
        border: isFollowing ? `1px solid ${themeColor}` : `1px solid ${themeColor}40`,
        backgroundColor: isFollowing ? `${themeColor}20` : 'transparent',
        color: isFollowing ? themeColor : '#9ca3af',
        cursor: isLoading ? 'not-allowed' : 'pointer',
        opacity: isLoading ? 0.6 : 1,
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        if (!isLoading) {
          e.currentTarget.style.backgroundColor = isFollowing ? `${themeColor}30` : `${themeColor}10`;
          e.currentTarget.style.color = themeColor;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = isFollowing ? `${themeColor}20` : 'transparent';
        e.currentTarget.style.color = isFollowing ? themeColor : '#9ca3af';
      }}
    >
      <span>{isFollowing ? '★' : '☆'}</span>
      {showLabel && <span>{isFollowing ? 'Following' : 'Follow'}</span>}
    </button>
  );
};

export default FollowKingdomButton;
