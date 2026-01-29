import { z } from 'zod';

/**
 * Kingdom data validation schemas
 */
export const KVKRecordSchema = z.object({
  id: z.number(),
  kingdom_number: z.number(),
  kvk_number: z.number(),
  opponent_kingdom: z.number(),
  prep_result: z.string(),
  battle_result: z.string(),
  overall_result: z.string(),
  date_or_order_index: z.string(),
  created_at: z.string(),
});

export const KingdomSchema = z.object({
  kingdom_number: z.number(),
  total_kvks: z.number(),
  prep_wins: z.number(),
  prep_losses: z.number(),
  prep_win_rate: z.number(),
  prep_streak: z.number(),
  prep_loss_streak: z.number().optional(),
  prep_best_streak: z.number().optional(),
  battle_wins: z.number(),
  battle_losses: z.number(),
  battle_win_rate: z.number(),
  battle_streak: z.number(),
  battle_loss_streak: z.number().optional(),
  battle_best_streak: z.number().optional(),
  dominations: z.number(),
  defeats: z.number(),
  most_recent_status: z.string(),
  overall_score: z.number(),
  rank: z.number().optional(),
  last_updated: z.string(),
  recent_kvks: z.array(KVKRecordSchema).optional(),
  power_tier: z.enum(['S', 'A', 'B', 'C', 'D']).optional(),
  avg_rating: z.number().optional(),
  review_count: z.number().optional(),
});

export const KingdomProfileSchema = KingdomSchema.extend({
  recent_kvks: z.array(KVKRecordSchema),
});

/**
 * User profile validation schemas
 */
export const UserProfileSchema = z.object({
  id: z.string(),
  username: z.string().min(1).max(50),
  email: z.string().email(),
  avatar_url: z.string().url().or(z.literal('')),
  home_kingdom: z.number().nullable(),
  alliance_tag: z.string().max(10),
  language: z.string(),
  region: z.string(),
  bio: z.string().max(500),
  theme_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  badge_style: z.enum(['default', 'gradient', 'outline', 'glow']),
  created_at: z.string(),
});

/**
 * Form validation schemas
 */
export const ProfileEditSchema = z.object({
  username: z.string().min(1, 'Username is required').max(50, 'Username too long'),
  home_kingdom: z.number().min(1).max(9999).nullable(),
  alliance_tag: z.string().max(10, 'Alliance tag too long').transform(val => val.toUpperCase()),
  language: z.string(),
  region: z.string(),
  bio: z.string().max(500, 'Bio too long'),
  theme_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format'),
  badge_style: z.enum(['default', 'gradient', 'outline', 'glow']),
});

export const StatusSubmissionSchema = z.object({
  kingdom_number: z.number(),
  current_status: z.string(),
  new_status: z.enum(['Leading', 'Ordinary', 'Unannounced']),
  notes: z.string().max(500).optional(),
});

export const DataCorrectionSchema = z.object({
  field: z.string(),
  currentValue: z.string(),
  suggestedValue: z.string(),
});

export const ReportSubmissionSchema = z.object({
  kingdom_number: z.number(),
  corrections: z.array(DataCorrectionSchema).min(1, 'At least one correction required'),
  notes: z.string().max(1000).optional(),
});

export const KingdomClaimSchema = z.object({
  kingdom_number: z.number(),
  role: z.enum(['king', 'r4', 'r5']),
  alliance_tag: z.string().max(10).optional(),
});

/**
 * Filter validation schemas
 */
export const FilterOptionsSchema = z.object({
  status: z.string().optional(),
  minKvKs: z.number().min(0).optional(),
  maxKvKs: z.number().max(99).optional(),
  minPrepWinRate: z.number().min(0).max(1).optional(),
  minBattleWinRate: z.number().min(0).max(1).optional(),
  tier: z.string().optional(),
  minAtlasScore: z.number().min(0).optional(),
});

export const SortOptionsSchema = z.object({
  sortBy: z.enum(['overall_score', 'overall_rank', 'kingdom_number', 'prep_win_rate', 'battle_win_rate', 'total_kvks']),
  order: z.enum(['asc', 'desc']),
});

// Type exports from schemas
export type KVKRecordInput = z.infer<typeof KVKRecordSchema>;
export type KingdomInput = z.infer<typeof KingdomSchema>;
export type KingdomProfileInput = z.infer<typeof KingdomProfileSchema>;
export type UserProfileInput = z.infer<typeof UserProfileSchema>;
export type ProfileEditInput = z.infer<typeof ProfileEditSchema>;
export type StatusSubmissionInput = z.infer<typeof StatusSubmissionSchema>;
export type ReportSubmissionInput = z.infer<typeof ReportSubmissionSchema>;
export type KingdomClaimInput = z.infer<typeof KingdomClaimSchema>;
export type FilterOptionsInput = z.infer<typeof FilterOptionsSchema>;
export type SortOptionsInput = z.infer<typeof SortOptionsSchema>;
