import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserProfile } from '../contexts/AuthContext';

const getSupabase = () => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured');
  }
  return supabase;
};

export interface Review {
  id: string;
  kingdom_number: number;
  user_id: string;
  rating: number;
  comment: string;
  author_linked_username: string;
  author_linked_avatar_url: string | null;
  author_linked_kingdom: number | null;
  author_linked_tc_level: number;
  author_subscription_tier: string | null;
  helpful_count: number;
  created_at: string;
  updated_at: string;
}

export interface ReviewReply {
  id: string;
  review_id: string;
  user_id: string;
  kingdom_number: number;
  reply_text: string;
  author_linked_username: string;
  author_linked_avatar_url: string | null;
  author_subscription_tier: string | null;
  is_official_reply: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReviewNotification {
  id: string;
  user_id: string;
  notification_type: 'helpful_vote' | 'reply';
  review_id: string | null;
  reply_id: string | null;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface ReviewWithVoteStatus extends Review {
  user_has_voted: boolean;
  replies?: ReviewReply[];
}

const MIN_TC_LEVEL = 20;
const MIN_COMMENT_LENGTH = 10;
const MAX_COMMENT_LENGTH = 200;
const MAX_REVIEWS_PER_DAY = 3;

export type ReportReason = 'spam' | 'inappropriate' | 'misleading' | 'harassment' | 'other';

export interface ReviewReport {
  id: string;
  review_id: string;
  reporter_id: string;
  reason: ReportReason;
  details: string | null;
  status: 'pending' | 'reviewed' | 'dismissed';
  created_at: string;
}

export const reviewService = {
  /**
   * Check if a user can submit reviews
   */
  canUserReview(profile: UserProfile | null): { canReview: boolean; reason: string | null } {
    if (!profile) {
      return { canReview: false, reason: 'not_authenticated' };
    }
    if (!profile.linked_username) {
      return { canReview: false, reason: 'not_linked' };
    }
    if (!profile.linked_tc_level || profile.linked_tc_level < MIN_TC_LEVEL) {
      return { canReview: false, reason: `tc_level_low:${profile.linked_tc_level || 0}` };
    }
    return { canReview: true, reason: null };
  },

  /**
   * Get reviews for a kingdom
   */
  async getReviewsForKingdom(
    kingdomNumber: number,
    currentUserId?: string
  ): Promise<ReviewWithVoteStatus[]> {
    const { data: reviews, error } = await getSupabase()
      .from('kingdom_reviews')
      .select('*')
      .eq('kingdom_number', kingdomNumber)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reviews:', error);
      return [];
    }

    if (!reviews || reviews.length === 0) {
      return [];
    }

    // If user is logged in, check which reviews they've voted on
    let userVotes: Set<string> = new Set();
    if (currentUserId) {
      const { data: votes } = await getSupabase()
        .from('review_helpful_votes')
        .select('review_id')
        .eq('user_id', currentUserId);
      
      if (votes) {
        userVotes = new Set(votes.map(v => v.review_id));
      }
    }

    return reviews.map(review => ({
      ...review,
      user_has_voted: userVotes.has(review.id)
    }));
  },

  /**
   * Create a new review
   */
  async createReview(
    kingdomNumber: number,
    rating: number,
    comment: string,
    profile: UserProfile,
    userId: string
  ): Promise<{ success: boolean; error?: string; review?: Review }> {
    // Validate
    if (comment.length < MIN_COMMENT_LENGTH) {
      return { success: false, error: `Review must be at least ${MIN_COMMENT_LENGTH} characters` };
    }
    if (comment.length > MAX_COMMENT_LENGTH) {
      return { success: false, error: `Review must be under ${MAX_COMMENT_LENGTH} characters` };
    }
    if (rating < 1 || rating > 5) {
      return { success: false, error: 'Rating must be between 1 and 5' };
    }

    const canReviewResult = this.canUserReview(profile);
    if (!canReviewResult.canReview) {
      return { success: false, error: 'You are not eligible to submit reviews' };
    }

    // Rate limit: max 3 reviews per day
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: todayCount } = await getSupabase()
      .from('kingdom_reviews')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', today.toISOString());

    if ((todayCount ?? 0) >= MAX_REVIEWS_PER_DAY) {
      return { success: false, error: `You can only submit ${MAX_REVIEWS_PER_DAY} reviews per day` };
    }

    const { data, error } = await getSupabase()
      .from('kingdom_reviews')
      .insert({
        kingdom_number: kingdomNumber,
        user_id: userId,
        rating,
        comment: comment.trim(),
        author_linked_username: profile.linked_username,
        author_linked_avatar_url: profile.linked_avatar_url || null,
        author_linked_kingdom: profile.linked_kingdom || null,
        author_linked_tc_level: profile.linked_tc_level,
        author_subscription_tier: profile.subscription_tier || 'free'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating review:', error);
      return { success: false, error: 'Failed to submit review' };
    }

    return { success: true, review: data };
  },

  /**
   * Update an existing review
   */
  async updateReview(
    reviewId: string,
    rating: number,
    comment: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (comment.length < MIN_COMMENT_LENGTH) {
      return { success: false, error: `Review must be at least ${MIN_COMMENT_LENGTH} characters` };
    }
    if (comment.length > MAX_COMMENT_LENGTH) {
      return { success: false, error: `Review must be under ${MAX_COMMENT_LENGTH} characters` };
    }

    const { error } = await getSupabase()
      .from('kingdom_reviews')
      .update({
        rating,
        comment: comment.trim()
      })
      .eq('id', reviewId)
      .eq('user_id', userId); // RLS also enforces this

    if (error) {
      console.error('Error updating review:', error);
      return { success: false, error: 'Failed to update review' };
    }

    return { success: true };
  },

  /**
   * Delete a review (user can delete own, admin can delete any)
   */
  async deleteReview(reviewId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await getSupabase()
      .from('kingdom_reviews')
      .delete()
      .eq('id', reviewId);

    if (error) {
      console.error('Error deleting review:', error);
      return { success: false, error: 'Failed to delete review' };
    }

    return { success: true };
  },

  /**
   * Toggle helpful vote on a review
   */
  async toggleHelpfulVote(
    reviewId: string,
    userId: string,
    currentlyVoted: boolean
  ): Promise<{ success: boolean; error?: string; newVoteState: boolean }> {
    if (currentlyVoted) {
      // Remove vote
      const { error } = await getSupabase()
        .from('review_helpful_votes')
        .delete()
        .eq('review_id', reviewId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error removing vote:', error);
        return { success: false, error: 'Failed to remove vote', newVoteState: true };
      }
      return { success: true, newVoteState: false };
    } else {
      // Add vote
      const { error } = await getSupabase()
        .from('review_helpful_votes')
        .insert({
          review_id: reviewId,
          user_id: userId
        });

      if (error) {
        // Could be duplicate constraint error
        if (error.code === '23505') {
          return { success: true, newVoteState: true }; // Already voted
        }
        console.error('Error adding vote:', error);
        return { success: false, error: 'Failed to add vote', newVoteState: false };
      }
      return { success: true, newVoteState: true };
    }
  },

  /**
   * Check if user has already reviewed a kingdom
   */
  async hasUserReviewedKingdom(
    kingdomNumber: number,
    userId: string
  ): Promise<boolean> {
    const { data, error } = await getSupabase()
      .from('kingdom_reviews')
      .select('id')
      .eq('kingdom_number', kingdomNumber)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      console.error('Error checking existing review:', error);
    }

    return !!data;
  },

  /**
   * Get all reviews (for admin moderation)
   */
  async getAllReviews(limit = 50): Promise<Review[]> {
    const { data, error } = await getSupabase()
      .from('kingdom_reviews')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching all reviews:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Get review summary stats for a kingdom (rating breakdown)
   */
  async getReviewStats(kingdomNumber: number): Promise<{
    totalReviews: number;
    avgRating: number;
    ratingBreakdown: { [key: number]: number };
  }> {
    const { data: reviews, error } = await getSupabase()
      .from('kingdom_reviews')
      .select('rating')
      .eq('kingdom_number', kingdomNumber);

    if (error || !reviews) {
      return { totalReviews: 0, avgRating: 0, ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
    }

    const totalReviews = reviews.length;
    if (totalReviews === 0) {
      return { totalReviews: 0, avgRating: 0, ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
    }

    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews;
    const ratingBreakdown: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach(r => {
      ratingBreakdown[r.rating] = (ratingBreakdown[r.rating] || 0) + 1;
    });

    return { totalReviews, avgRating, ratingBreakdown };
  },

  /**
   * Get user's review activity (reviews they've written)
   */
  async getUserReviews(userId: string): Promise<Review[]> {
    const { data, error } = await getSupabase()
      .from('kingdom_reviews')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user reviews:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Get user's total helpful votes received across all reviews
   */
  async getUserHelpfulCount(userId: string): Promise<number> {
    const { data, error } = await getSupabase()
      .from('kingdom_reviews')
      .select('helpful_count')
      .eq('user_id', userId);

    if (error || !data) {
      return 0;
    }

    return data.reduce((sum, r) => sum + (r.helpful_count || 0), 0);
  },

  /**
   * Check if user is a "Top Reviewer" (5+ helpful votes received)
   */
  async isTopReviewer(userId: string): Promise<boolean> {
    const helpfulCount = await this.getUserHelpfulCount(userId);
    return helpfulCount >= 5;
  },

  /**
   * Get replies for a review
   */
  async getRepliesForReview(reviewId: string): Promise<ReviewReply[]> {
    const { data, error } = await getSupabase()
      .from('review_replies')
      .select('*')
      .eq('review_id', reviewId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching replies:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Create a reply to a review
   */
  async createReply(
    reviewId: string,
    kingdomNumber: number,
    replyText: string,
    profile: UserProfile,
    userId: string,
    isOfficial: boolean = false
  ): Promise<{ success: boolean; error?: string; reply?: ReviewReply }> {
    if (replyText.length < 5) {
      return { success: false, error: 'Reply must be at least 5 characters' };
    }
    if (replyText.length > 500) {
      return { success: false, error: 'Reply must be under 500 characters' };
    }

    const { data, error } = await getSupabase()
      .from('review_replies')
      .insert({
        review_id: reviewId,
        user_id: userId,
        kingdom_number: kingdomNumber,
        reply_text: replyText.trim(),
        author_linked_username: profile.linked_username || profile.username || 'Anonymous',
        author_linked_avatar_url: profile.linked_avatar_url || null,
        author_subscription_tier: profile.subscription_tier || 'free',
        is_official_reply: isOfficial
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating reply:', error);
      return { success: false, error: 'Failed to submit reply' };
    }

    return { success: true, reply: data };
  },

  /**
   * Delete a reply
   */
  async deleteReply(replyId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await getSupabase()
      .from('review_replies')
      .delete()
      .eq('id', replyId);

    if (error) {
      console.error('Error deleting reply:', error);
      return { success: false, error: 'Failed to delete reply' };
    }

    return { success: true };
  },

  /**
   * Get user's notifications
   */
  async getUserNotifications(userId: string, unreadOnly: boolean = false): Promise<ReviewNotification[]> {
    let query = getSupabase()
      .from('review_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Mark notification as read
   */
  async markNotificationRead(notificationId: string): Promise<{ success: boolean }> {
    const { error } = await getSupabase()
      .from('review_notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) {
      console.error('Error marking notification read:', error);
      return { success: false };
    }

    return { success: true };
  },

  /**
   * Mark all notifications as read
   */
  async markAllNotificationsRead(userId: string): Promise<{ success: boolean }> {
    const { error } = await getSupabase()
      .from('review_notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error('Error marking all notifications read:', error);
      return { success: false };
    }

    return { success: true };
  },

  /**
   * Get unread notification count
   */
  async getUnreadNotificationCount(userId: string): Promise<number> {
    const { count, error } = await getSupabase()
      .from('review_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error('Error fetching notification count:', error);
      return 0;
    }

    return count || 0;
  },

  /**
   * Get aggregate rating for structured data (SEO)
   * Only returns data if kingdom has 5+ reviews (Google requirement)
   */
  async getAggregateRatingForStructuredData(
    kingdomNumber: number,
    minReviews: number = 5
  ): Promise<{
    ratingValue: number;
    reviewCount: number;
    bestRating: number;
    worstRating: number;
  } | null> {
    const { data, error } = await getSupabase()
      .rpc('get_aggregate_rating', {
        p_kingdom_number: kingdomNumber,
        p_min_reviews: minReviews
      });

    if (error || !data || data.length === 0) {
      return null;
    }

    return {
      ratingValue: parseFloat(data[0].rating_value),
      reviewCount: parseInt(data[0].review_count),
      bestRating: data[0].best_rating,
      worstRating: data[0].worst_rating
    };
  },

  /**
   * Get the featured (most helpful) review for a kingdom
   */
  async getFeaturedReview(kingdomNumber: number): Promise<Review | null> {
    const { data, error } = await getSupabase()
      .from('kingdom_reviews')
      .select('*')
      .eq('kingdom_number', kingdomNumber)
      .gt('helpful_count', 0)
      .order('helpful_count', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // No featured review found (likely no reviews with helpful votes)
      return null;
    }

    return data;
  },

  /**
   * Report a review for inappropriate content
   */
  async reportReview(
    reviewId: string,
    reporterId: string,
    reason: ReportReason,
    details?: string
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await getSupabase()
      .from('review_reports')
      .insert({
        review_id: reviewId,
        reporter_id: reporterId,
        reason,
        details: details?.trim() || null
      });

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'You have already reported this review' };
      }
      console.error('Error reporting review:', error);
      return { success: false, error: 'Failed to submit report' };
    }

    return { success: true };
  },

  /**
   * Check if user has already reported a specific review
   */
  async hasUserReportedReview(
    reviewId: string,
    userId: string
  ): Promise<boolean> {
    const { data } = await getSupabase()
      .from('review_reports')
      .select('id')
      .eq('review_id', reviewId)
      .eq('reporter_id', userId)
      .maybeSingle();

    return !!data;
  }
};
