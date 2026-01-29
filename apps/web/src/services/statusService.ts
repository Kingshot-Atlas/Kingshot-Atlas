/**
 * Service for handling kingdom status submissions
 * Manages user-submitted status updates with moderation queue
 * Supports both localStorage (offline) and Supabase (cloud) backends
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logger } from '../utils/logger';

export interface StatusSubmission {
  id: string;
  kingdom_number: number;
  old_status: string;
  new_status: string;
  notes: string;
  submitted_by: string;
  submitted_at: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
}

const SUBMISSIONS_KEY = 'kingshot_status_submissions';
const PENDING_KEY = 'kingshot_pending_submissions';

class StatusService {
  private getSubmissions(): StatusSubmission[] {
    try {
      const data = localStorage.getItem(SUBMISSIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private saveSubmissions(submissions: StatusSubmission[]): void {
    localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(submissions));
  }

  async submitStatusUpdate(
    kingdomNumber: number,
    oldStatus: string,
    newStatus: string,
    notes: string,
    userId: string
  ): Promise<StatusSubmission> {
    // Try Supabase first if configured
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('status_submissions')
          .insert({
            kingdom_number: kingdomNumber,
            old_status: oldStatus,
            new_status: newStatus,
            notes,
            submitted_by: userId
          })
          .select()
          .single();

        if (!error && data) {
          return {
            id: data.id,
            kingdom_number: data.kingdom_number,
            old_status: data.old_status,
            new_status: data.new_status,
            notes: data.notes || '',
            submitted_by: data.submitted_by,
            submitted_at: data.submitted_at,
            status: data.status
          };
        }
        // Fall through to localStorage if Supabase fails
        logger.warn('Supabase submission failed, using localStorage:', error);
      } catch (err) {
        logger.warn('Supabase submission error, using localStorage:', err);
      }
    }

    // Fallback to localStorage
    const submission: StatusSubmission = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      kingdom_number: kingdomNumber,
      old_status: oldStatus,
      new_status: newStatus,
      notes,
      submitted_by: userId,
      submitted_at: new Date().toISOString(),
      status: 'pending'
    };

    const submissions = this.getSubmissions();
    submissions.push(submission);
    this.saveSubmissions(submissions);

    // Track pending submissions per user
    this.addPendingSubmission(userId, submission.id);

    return submission;
  }

  private addPendingSubmission(userId: string, submissionId: string): void {
    try {
      const data = localStorage.getItem(PENDING_KEY);
      const pending: Record<string, string[]> = data ? JSON.parse(data) : {};
      
      if (!pending[userId]) {
        pending[userId] = [];
      }
      const userPending = pending[userId];
      if (userPending) {
        userPending.push(submissionId);
      }
      
      localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
    } catch {
      // Ignore storage errors
    }
  }

  getUserPendingSubmissions(userId: string): StatusSubmission[] {
    const submissions = this.getSubmissions();
    return submissions.filter(s => s.submitted_by === userId && s.status === 'pending');
  }

  getKingdomPendingSubmissions(kingdomNumber: number): StatusSubmission[] {
    const submissions = this.getSubmissions();
    return submissions.filter(s => s.kingdom_number === kingdomNumber && s.status === 'pending');
  }

  hasUserSubmittedRecently(userId: string, kingdomNumber: number, hoursAgo: number = 24): boolean {
    const submissions = this.getSubmissions();
    const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
    
    return submissions.some(s => 
      s.submitted_by === userId && 
      s.kingdom_number === kingdomNumber && 
      s.submitted_at > cutoff
    );
  }

  // Admin functions (for future implementation)
  async approveSubmission(submissionId: string, reviewerId: string, reviewNotes?: string): Promise<void> {
    const submissions = this.getSubmissions();
    const index = submissions.findIndex(s => s.id === submissionId);
    
    const existing = submissions[index];
    if (existing) {
      submissions[index] = {
        ...existing,
        status: 'approved' as const,
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes
      };
      this.saveSubmissions(submissions);
    }
  }

  async rejectSubmission(submissionId: string, reviewerId: string, reviewNotes?: string): Promise<void> {
    const submissions = this.getSubmissions();
    const index = submissions.findIndex(s => s.id === submissionId);
    
    const existing = submissions[index];
    if (existing) {
      submissions[index] = {
        ...existing,
        status: 'rejected' as const,
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes
      };
      this.saveSubmissions(submissions);
    }
  }

  getAllPendingSubmissions(): StatusSubmission[] {
    return this.getSubmissions().filter(s => s.status === 'pending');
  }

  getSubmissionHistory(kingdomNumber: number): StatusSubmission[] {
    return this.getSubmissions()
      .filter(s => s.kingdom_number === kingdomNumber)
      .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
  }

  /**
   * Get the most recent approved status for a kingdom
   * Returns the new_status from the most recently approved submission
   */
  getApprovedStatus(kingdomNumber: number): string | null {
    const submissions = this.getSubmissions()
      .filter(s => s.kingdom_number === kingdomNumber && s.status === 'approved')
      .sort((a, b) => new Date(b.reviewed_at || b.submitted_at).getTime() - new Date(a.reviewed_at || a.submitted_at).getTime());
    
    return submissions[0]?.new_status || null;
  }

  /**
   * Get all approved status overrides as a map of kingdom_number -> new_status
   * Used by api.ts to apply approved statuses when loading kingdom data
   */
  getAllApprovedStatusOverrides(): Map<number, string> {
    const overrides = new Map<number, string>();
    const submissions = this.getSubmissions()
      .filter(s => s.status === 'approved')
      .sort((a, b) => new Date(a.reviewed_at || a.submitted_at).getTime() - new Date(b.reviewed_at || b.submitted_at).getTime());
    
    // Later approvals override earlier ones for the same kingdom
    for (const sub of submissions) {
      overrides.set(sub.kingdom_number, sub.new_status);
    }
    
    return overrides;
  }
}

export const statusService = new StatusService();
