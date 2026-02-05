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
  author_subscription_tier: 'free' | 'pro' | 'recruiter' | null;
  helpful_count: number;
  created_at: string;
  updated_at: string;
}

export interface ReviewWithVoteStatus extends Review {
  user_has_voted: boolean;
}

const MIN_TC_LEVEL = 20;
const MIN_COMMENT_LENGTH = 10;
const MAX_COMMENT_LENGTH = 1000;

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
  }
};
