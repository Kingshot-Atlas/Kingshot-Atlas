import { SUBSCRIPTION_COLORS, SubscriptionTier } from '../../utils/constants';
import { colors } from '../../utils/styles';

export interface KingdomReviewsProps {
  kingdomNumber: number;
  compact?: boolean;
}

export const MIN_TC_LEVEL = 20;
export const MIN_COMMENT_LENGTH = 10;
export const MAX_COMMENT_LENGTH = 200;

// Get username color based on display tier (includes admin and gilded)
export const getUsernameColor = (tier: SubscriptionTier): string => {
  switch (tier) {
    case 'admin': return SUBSCRIPTION_COLORS.admin;
    case 'gilded': return SUBSCRIPTION_COLORS.gilded;
    case 'supporter': return SUBSCRIPTION_COLORS.supporter;
    default: return colors.text;
  }
};

// Get avatar border color
export const getAvatarBorderColor = (tier: SubscriptionTier): string => {
  switch (tier) {
    case 'admin': return SUBSCRIPTION_COLORS.admin;
    case 'gilded': return SUBSCRIPTION_COLORS.gilded;
    case 'supporter': return SUBSCRIPTION_COLORS.supporter;
    default: return colors.text;
  }
};

export type SortOption = 'newest' | 'helpful' | 'highest' | 'lowest';
