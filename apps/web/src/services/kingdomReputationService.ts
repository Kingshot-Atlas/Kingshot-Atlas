import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserProfile } from '../contexts/AuthContext';
import { logger } from '../utils/logger';

const getSupabase = () => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured');
  }
  return supabase;
};

// ─── Types ────────────────────────────────────────────────────

export type ReviewType = 'citizen' | 'rival';
export type VoteType = 'upvote' | 'downvote';
export type ReviewStatus = 'active' | 'flagged' | 'hidden' | 'removed';
export type ReportReason = 'spam' | 'inappropriate' | 'misleading' | 'harassment' | 'other';
export type ConfidenceLevel = 'limited' | 'emerging' | 'established';

export interface ReputationReview {
  id: string;
  kingdom_number: number;
  review_type: ReviewType;
  reviewer_user_id: string;
  reviewer_kingdom_snapshot: number | null;
  reviewer_tc_level_snapshot: number | null;
  is_publicly_anonymous: boolean;
  citizen_organization_rating: number | null;
  citizen_leadership_fairness_rating: number | null;
  citizen_overall_culture_rating: number | null;
  rival_communication_rating: number | null;
  rival_rule_compliance_rating: number | null;
  rival_sportsmanship_rating: number | null;
  overall_rating: number;
  comment: string | null;
  status: ReviewStatus;
  upvotes_count: number;
  downvotes_count: number;
  vote_score: number;
  created_at: string;
  updated_at: string;
}

export interface ReputationReviewWithVote extends ReputationReview {
  user_vote: VoteType | null;
}

export interface OfficialResponse {
  id: string;
  review_id: string;
  kingdom_number: number;
  responder_user_id: string;
  response_text: string;
  is_official: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReputationSummary {
  kingdom_number: number;
  review_type: ReviewType;
  review_count: number;
  avg_overall: number;
  avg_citizen_organization: number | null;
  avg_citizen_leadership: number | null;
  avg_citizen_culture: number | null;
  avg_rival_communication: number | null;
  avg_rival_compliance: number | null;
  avg_rival_sportsmanship: number | null;
  top_review_comment: string | null;
}

export interface ReputationReport {
  id: string;
  review_id: string;
  reporter_user_id: string;
  reason: ReportReason;
  details: string | null;
  status: string;
  created_at: string;
  // Joined fields (populated by admin queries)
  reporter_id: string;
  reporter_username?: string;
  reported_username?: string;
  kingdom_number?: number;
}

// ─── Constants ────────────────────────────────────────────────

const MIN_TC_LEVEL = 20;
const MIN_COMMENT_LENGTH = 10;
const MAX_COMMENT_LENGTH = 200;
const EDIT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

// ─── Helpers ──────────────────────────────────────────────────

export function getConfidenceLevel(reviewCount: number): ConfidenceLevel {
  if (reviewCount >= 15) return 'established';
  if (reviewCount >= 5) return 'emerging';
  return 'limited';
}

export function getConfidenceLabel(level: ConfidenceLevel): string {
  switch (level) {
    case 'established': return 'Established signal';
    case 'emerging': return 'Emerging signal';
    case 'limited': return 'Limited data';
  }
}

export function getSignalDescriptor(avg: number): string {
  if (avg >= 4.5) return 'Excellent';
  if (avg >= 3.5) return 'Strong';
  if (avg >= 2.5) return 'Mixed';
  if (avg >= 1.5) return 'Weak';
  return 'Poor';
}

export function generateSummarySentence(
  summary: ReputationSummary,
  reviewType: ReviewType
): string {
  if (summary.review_count === 0) return '';
  const confidence = getConfidenceLevel(summary.review_count);

  if (reviewType === 'citizen') {
    const signals = [
      { label: 'Kingdom Organization', avg: summary.avg_citizen_organization ?? 0 },
      { label: 'Leadership Fairness', avg: summary.avg_citizen_leadership ?? 0 },
      { label: 'Overall Culture', avg: summary.avg_citizen_culture ?? 0 },
    ].sort((a, b) => b.avg - a.avg);
    const strongest = signals[0]!;
    const weakest = signals[2]!;
    if (confidence === 'limited') {
      return `Based on ${summary.review_count} review${summary.review_count > 1 ? 's' : ''}, early citizen feedback highlights ${strongest.label.toLowerCase()}.`;
    }
    return `Citizens rate this kingdom strongest in ${strongest.label.toLowerCase()}, with ${weakest.label.toLowerCase()} slightly behind.`;
  } else {
    const signals = [
      { label: 'Effective Communication', avg: summary.avg_rival_communication ?? 0 },
      { label: 'Rule Compliance', avg: summary.avg_rival_compliance ?? 0 },
      { label: 'Good Sportsmanship', avg: summary.avg_rival_sportsmanship ?? 0 },
    ].sort((a, b) => b.avg - a.avg);
    const strongest = signals[0]!;
    const weakest = signals[2]!;
    if (confidence === 'limited') {
      return `Based on ${summary.review_count} review${summary.review_count > 1 ? 's' : ''}, early rival feedback highlights ${strongest.label.toLowerCase()}.`;
    }
    return `Rivals rate this kingdom well for ${strongest.label.toLowerCase()}, while ${weakest.label.toLowerCase()} is more mixed.`;
  }
}

// ─── Service ──────────────────────────────────────────────────

export const kingdomReputationService = {
  // ─── Eligibility ──────────────────────────────────────────

  canUserReview(profile: UserProfile | null): { canReview: boolean; reason: string | null } {
    if (!profile) return { canReview: false, reason: 'not_authenticated' };
    if (!profile.linked_username) return { canReview: false, reason: 'not_linked' };
    if (!profile.linked_tc_level || profile.linked_tc_level < MIN_TC_LEVEL) {
      return { canReview: false, reason: `tc_level_low:${profile.linked_tc_level || 0}` };
    }
    return { canReview: true, reason: null };
  },

  canCitizenReview(profile: UserProfile | null, kingdomNumber: number): { eligible: boolean; reason: string | null } {
    const base = this.canUserReview(profile);
    if (!base.canReview) return { eligible: false, reason: base.reason };
    if (profile!.linked_kingdom !== kingdomNumber) {
      return { eligible: false, reason: 'not_same_kingdom' };
    }
    return { eligible: true, reason: null };
  },

  async canRivalReview(profile: UserProfile | null, kingdomNumber: number): Promise<{ eligible: boolean; reason: string | null }> {
    const base = this.canUserReview(profile);
    if (!base.canReview) return { eligible: false, reason: base.reason };
    if (!profile!.linked_kingdom) return { eligible: false, reason: 'no_kingdom' };
    if (profile!.linked_kingdom === kingdomNumber) {
      return { eligible: false, reason: 'same_kingdom' };
    }

    // Check rivalry via DB function
    const { data, error } = await getSupabase()
      .rpc('is_rival_eligible', {
        p_reviewer_kingdom: profile!.linked_kingdom,
        p_target_kingdom: kingdomNumber,
      });

    if (error) {
      logger.error('Error checking rival eligibility:', error);
      return { eligible: false, reason: 'check_failed' };
    }

    if (!data) {
      return { eligible: false, reason: 'no_rivalry_history' };
    }

    return { eligible: true, reason: null };
  },

  // ─── Read ─────────────────────────────────────────────────

  async getReviewsForKingdom(
    kingdomNumber: number,
    reviewType: ReviewType,
    currentUserId?: string
  ): Promise<ReputationReviewWithVote[]> {
    const { data: reviews, error } = await getSupabase()
      .from('kingdom_reputation_reviews')
      .select('*')
      .eq('kingdom_number', kingdomNumber)
      .eq('review_type', reviewType)
      .eq('status', 'active')
      .order('vote_score', { ascending: false })
      .order('upvotes_count', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching reputation reviews:', error);
      return [];
    }

    if (!reviews || reviews.length === 0) return [];

    // Fetch user votes if logged in
    let userVotes = new Map<string, VoteType>();
    if (currentUserId) {
      const reviewIds = reviews.map(r => r.id);
      const { data: votes } = await getSupabase()
        .from('kingdom_reputation_votes')
        .select('review_id, vote_type')
        .eq('user_id', currentUserId)
        .in('review_id', reviewIds);

      if (votes) {
        votes.forEach(v => userVotes.set(v.review_id, v.vote_type as VoteType));
      }
    }

    return reviews.map(r => ({
      ...r,
      user_vote: userVotes.get(r.id) || null,
    }));
  },

  async getUserReviews(userId: string): Promise<ReputationReview[]> {
    const { data, error } = await getSupabase()
      .from('kingdom_reputation_reviews')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching user reputation reviews:', error);
      return [];
    }

    return data || [];
  },

  async getSummary(
    kingdomNumber: number,
    reviewType: ReviewType
  ): Promise<ReputationSummary | null> {
    const { data: rows, error } = await getSupabase()
      .rpc('get_kingdom_reputation_summaries', {
        p_kingdom_number: kingdomNumber,
        p_review_type: reviewType,
      });

    const data = rows?.[0] ?? null;

    if (error) {
      logger.error('Error fetching reputation summary:', error);
      return null;
    }

    return data;
  },

  async getSummaries(kingdomNumber: number): Promise<ReputationSummary[]> {
    const { data, error } = await getSupabase()
      .rpc('get_kingdom_reputation_summaries', {
        p_kingdom_number: kingdomNumber,
      });

    if (error) {
      logger.error('Error fetching reputation summaries:', error);
      return [];
    }

    return data || [];
  },

  async getResponsesForReviews(reviewIds: string[]): Promise<Map<string, OfficialResponse>> {
    if (reviewIds.length === 0) return new Map();

    const { data, error } = await getSupabase()
      .from('kingdom_reputation_responses')
      .select('*')
      .in('review_id', reviewIds);

    if (error) {
      logger.error('Error fetching responses:', error);
      return new Map();
    }

    const map = new Map<string, OfficialResponse>();
    (data || []).forEach(r => map.set(r.review_id, r));
    return map;
  },

  async getUserReviewForKingdom(
    kingdomNumber: number,
    userId: string
  ): Promise<ReputationReview | null> {
    const { data, error } = await getSupabase()
      .from('kingdom_reputation_reviews')
      .select('*')
      .eq('kingdom_number', kingdomNumber)
      .eq('reviewer_user_id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      logger.error('Error checking existing review:', error);
    }

    return data || null;
  },

  // ─── Transfer Hub summaries ───────────────────────────────

  async getCitizenSummariesForTransferHub(): Promise<ReputationSummary[]> {
    const { data, error } = await getSupabase()
      .rpc('get_kingdom_reputation_summaries', {
        p_review_type: 'citizen',
      });

    if (error) {
      logger.error('Error fetching citizen summaries:', error);
      return [];
    }
    return data || [];
  },

  // ─── Create ───────────────────────────────────────────────

  async createReview(
    kingdomNumber: number,
    reviewType: ReviewType,
    ratings: {
      signal1: number;
      signal2: number;
      signal3: number;
    },
    comment: string,
    profile: UserProfile,
    userId: string
  ): Promise<{ success: boolean; error?: string; review?: ReputationReview }> {
    // Validate
    if (comment.length < MIN_COMMENT_LENGTH) {
      return { success: false, error: `Review must be at least ${MIN_COMMENT_LENGTH} characters` };
    }
    if (comment.length > MAX_COMMENT_LENGTH) {
      return { success: false, error: `Review must be under ${MAX_COMMENT_LENGTH} characters` };
    }
    for (const val of [ratings.signal1, ratings.signal2, ratings.signal3]) {
      if (val < 1 || val > 5) return { success: false, error: 'Ratings must be between 1 and 5' };
    }

    const overallRating = Number(((ratings.signal1 + ratings.signal2 + ratings.signal3) / 3).toFixed(2));

    const insertData: Record<string, unknown> = {
      kingdom_number: kingdomNumber,
      review_type: reviewType,
      reviewer_user_id: userId,
      reviewer_kingdom_snapshot: profile.linked_kingdom || null,
      reviewer_tc_level_snapshot: profile.linked_tc_level || null,
      overall_rating: overallRating,
      comment: comment.trim(),
    };

    if (reviewType === 'citizen') {
      insertData.citizen_organization_rating = ratings.signal1;
      insertData.citizen_leadership_fairness_rating = ratings.signal2;
      insertData.citizen_overall_culture_rating = ratings.signal3;
    } else {
      insertData.rival_communication_rating = ratings.signal1;
      insertData.rival_rule_compliance_rating = ratings.signal2;
      insertData.rival_sportsmanship_rating = ratings.signal3;
    }

    const { data, error } = await getSupabase()
      .from('kingdom_reputation_reviews')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'You have already reviewed this kingdom' };
      }
      logger.error('Error creating reputation review:', error);
      return { success: false, error: 'Failed to submit review' };
    }

    // Refresh materialized view in background
    Promise.resolve(getSupabase().rpc('refresh_reputation_summaries')).catch(() => {});

    return { success: true, review: data };
  },

  // ─── Update ───────────────────────────────────────────────

  async updateReview(
    reviewId: string,
    reviewType: ReviewType,
    ratings: { signal1: number; signal2: number; signal3: number },
    comment: string,
    userId: string,
    existingUpdatedAt: string
  ): Promise<{ success: boolean; error?: string }> {
    // Check cooldown
    const lastEdit = new Date(existingUpdatedAt).getTime();
    const now = Date.now();
    if (now - lastEdit < EDIT_COOLDOWN_MS) {
      const remaining = Math.ceil((EDIT_COOLDOWN_MS - (now - lastEdit)) / 60000);
      return { success: false, error: `You can edit again in ${remaining} minutes` };
    }

    if (comment.length < MIN_COMMENT_LENGTH) {
      return { success: false, error: `Review must be at least ${MIN_COMMENT_LENGTH} characters` };
    }
    if (comment.length > MAX_COMMENT_LENGTH) {
      return { success: false, error: `Review must be under ${MAX_COMMENT_LENGTH} characters` };
    }

    const overallRating = Number(((ratings.signal1 + ratings.signal2 + ratings.signal3) / 3).toFixed(2));

    const updateData: Record<string, unknown> = {
      overall_rating: overallRating,
      comment: comment.trim(),
    };

    if (reviewType === 'citizen') {
      updateData.citizen_organization_rating = ratings.signal1;
      updateData.citizen_leadership_fairness_rating = ratings.signal2;
      updateData.citizen_overall_culture_rating = ratings.signal3;
    } else {
      updateData.rival_communication_rating = ratings.signal1;
      updateData.rival_rule_compliance_rating = ratings.signal2;
      updateData.rival_sportsmanship_rating = ratings.signal3;
    }

    const { error } = await getSupabase()
      .from('kingdom_reputation_reviews')
      .update(updateData)
      .eq('id', reviewId)
      .eq('reviewer_user_id', userId);

    if (error) {
      logger.error('Error updating reputation review:', error);
      return { success: false, error: 'Failed to update review' };
    }

    Promise.resolve(getSupabase().rpc('refresh_reputation_summaries')).catch(() => {});
    return { success: true };
  },

  // ─── Delete ───────────────────────────────────────────────

  async deleteReview(reviewId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await getSupabase()
      .from('kingdom_reputation_reviews')
      .delete()
      .eq('id', reviewId);

    if (error) {
      logger.error('Error deleting reputation review:', error);
      return { success: false, error: 'Failed to delete review' };
    }

    Promise.resolve(getSupabase().rpc('refresh_reputation_summaries')).catch(() => {});
    return { success: true };
  },

  // ─── Voting ───────────────────────────────────────────────

  async vote(
    reviewId: string,
    userId: string,
    voteType: VoteType,
    currentVote: VoteType | null
  ): Promise<{ success: boolean; error?: string; newVote: VoteType | null }> {
    if (currentVote === voteType) {
      // Remove vote (toggle off)
      const { error } = await getSupabase()
        .from('kingdom_reputation_votes')
        .delete()
        .eq('review_id', reviewId)
        .eq('user_id', userId);

      if (error) {
        logger.error('Error removing vote:', error);
        return { success: false, error: 'Failed to remove vote', newVote: currentVote };
      }
      return { success: true, newVote: null };
    } else if (currentVote) {
      // Change vote
      const { error } = await getSupabase()
        .from('kingdom_reputation_votes')
        .update({ vote_type: voteType })
        .eq('review_id', reviewId)
        .eq('user_id', userId);

      if (error) {
        logger.error('Error changing vote:', error);
        return { success: false, error: 'Failed to change vote', newVote: currentVote };
      }
      return { success: true, newVote: voteType };
    } else {
      // New vote
      const { error } = await getSupabase()
        .from('kingdom_reputation_votes')
        .insert({ review_id: reviewId, user_id: userId, vote_type: voteType });

      if (error) {
        if (error.code === '23505') return { success: true, newVote: voteType };
        logger.error('Error adding vote:', error);
        return { success: false, error: 'Failed to add vote', newVote: null };
      }
      return { success: true, newVote: voteType };
    }
  },

  // ─── Official Responses ───────────────────────────────────

  async createOfficialResponse(
    reviewId: string,
    kingdomNumber: number,
    responseText: string,
    userId: string
  ): Promise<{ success: boolean; error?: string; response?: OfficialResponse }> {
    if (responseText.length < 5) return { success: false, error: 'Response must be at least 5 characters' };
    if (responseText.length > 300) return { success: false, error: 'Response must be under 300 characters' };

    const { data, error } = await getSupabase()
      .from('kingdom_reputation_responses')
      .insert({
        review_id: reviewId,
        kingdom_number: kingdomNumber,
        responder_user_id: userId,
        response_text: responseText.trim(),
        is_official: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return { success: false, error: 'An official response already exists for this review' };
      logger.error('Error creating official response:', error);
      return { success: false, error: 'Failed to submit response' };
    }

    return { success: true, response: data };
  },

  // ─── Reports ──────────────────────────────────────────────

  async reportReview(
    reviewId: string,
    userId: string,
    reason: ReportReason,
    details?: string
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await getSupabase()
      .from('kingdom_reputation_reports')
      .insert({
        review_id: reviewId,
        reporter_user_id: userId,
        reason,
        details: details?.trim() || null,
      });

    if (error) {
      if (error.code === '23505') return { success: false, error: 'You have already reported this review' };
      logger.error('Error reporting review:', error);
      return { success: false, error: 'Failed to submit report' };
    }
    return { success: true };
  },

  // ─── Admin ────────────────────────────────────────────────

  async getAllReports(status?: string): Promise<ReputationReport[]> {
    let query = getSupabase()
      .from('kingdom_reputation_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) {
      logger.error('Error fetching reputation reports:', error);
      return [];
    }
    return data || [];
  },

  async updateReportStatus(
    reportId: string,
    status: 'reviewed' | 'dismissed',
    reviewedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await getSupabase()
      .from('kingdom_reputation_reports')
      .update({ status, reviewed_by: reviewedBy, reviewed_at: new Date().toISOString() })
      .eq('id', reportId);

    if (error) {
      logger.error('Error updating report status:', error);
      return { success: false, error: 'Failed to update report' };
    }
    return { success: true };
  },

  async adminHideReview(reviewId: string, reason: string, adminId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await getSupabase()
      .from('kingdom_reputation_reviews')
      .update({ status: 'hidden', moderation_reason: reason, moderated_at: new Date().toISOString(), moderated_by: adminId })
      .eq('id', reviewId);

    if (error) {
      logger.error('Error hiding review:', error);
      return { success: false, error: 'Failed to hide review' };
    }

    Promise.resolve(getSupabase().rpc('refresh_reputation_summaries')).catch(() => {});
    return { success: true };
  },
};
