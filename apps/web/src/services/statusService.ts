/**
 * Service for handling kingdom status submissions
 * Manages user-submitted status updates with moderation queue
 * 
 * IMPORTANT: Supabase is the SINGLE SOURCE OF TRUTH (ADR-010, ADR-011)
 * No localStorage fallbacks - if Supabase is unavailable, operations fail explicitly
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logger } from '../utils/logger';

// Custom error types for better error handling
export class SessionExpiredError extends Error {
  constructor(message: string = 'Your session has expired. Please sign in again.') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

export class DuplicateSubmissionError extends Error {
  constructor(message: string = 'You have already submitted a status update for this kingdom recently.') {
    super(message);
    this.name = 'DuplicateSubmissionError';
  }
}

export class NetworkError extends Error {
  constructor(message: string = 'Network error. Please check your connection and try again.') {
    super(message);
    this.name = 'NetworkError';
  }
}

// Retry configuration
const RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  retryableCodes: ['PGRST301', '40001', '503', 'NETWORK_ERROR']
};

// In-flight submission tracking to prevent duplicates
const inFlightSubmissions = new Set<string>();

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

class StatusService {
  private ensureSupabase(): void {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Database unavailable - Supabase is required for status submissions');
    }
  }

  /**
   * Retry wrapper with exponential backoff for transient failures
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry session/auth errors or duplicate submissions
        if (error instanceof SessionExpiredError || error instanceof DuplicateSubmissionError) {
          throw error;
        }
        
        // Check if error is retryable
        const errorCode = (error as { code?: string })?.code || '';
        const isRetryable = RETRY_CONFIG.retryableCodes.some(code => 
          errorCode.includes(code) || lastError?.message.includes('fetch')
        );
        
        if (!isRetryable || attempt === RETRY_CONFIG.maxAttempts) {
          logger.error(`${context} failed after ${attempt} attempts:`, lastError);
          throw lastError;
        }
        
        // Exponential backoff with jitter
        const delay = Math.min(
          RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 500,
          RETRY_CONFIG.maxDelayMs
        );
        
        logger.warn(`${context} attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError || new NetworkError();
  }

  /**
   * Generate a unique key for tracking in-flight submissions
   */
  private getSubmissionKey(userId: string, kingdomNumber: number): string {
    return `${userId}:${kingdomNumber}`;
  }

  async submitStatusUpdate(
    kingdomNumber: number,
    oldStatus: string,
    newStatus: string,
    notes: string,
    userId: string
  ): Promise<StatusSubmission> {
    this.ensureSupabase();

    const submissionKey = this.getSubmissionKey(userId, kingdomNumber);

    // Prevent duplicate in-flight submissions
    if (inFlightSubmissions.has(submissionKey)) {
      throw new DuplicateSubmissionError('A submission for this kingdom is already in progress.');
    }

    // Check for recent submissions (within last hour)
    const hasRecent = await this.hasUserSubmittedRecently(userId, kingdomNumber, 1);
    if (hasRecent) {
      throw new DuplicateSubmissionError(
        'You have already submitted a status update for this kingdom in the last hour. Please wait before submitting again.'
      );
    }

    // Mark submission as in-flight
    inFlightSubmissions.add(submissionKey);

    try {
      return await this.withRetry(async () => {
        // Verify the user has an active session before attempting insert
        const { data: sessionData, error: sessionError } = await supabase!.auth.getSession();
        
        if (sessionError || !sessionData.session) {
          logger.error('No active Supabase session:', sessionError?.message || 'Session is null');
          throw new SessionExpiredError();
        }

        // Verify the session user matches the userId being submitted
        if (sessionData.session.user.id !== userId) {
          logger.error('User ID mismatch:', { sessionUserId: sessionData.session.user.id, providedUserId: userId });
          throw new SessionExpiredError('Session mismatch - please sign out and sign in again.');
        }

        logger.info('Submitting status update with verified session:', { 
          userId, 
          kingdomNumber,
          sessionUserId: sessionData.session.user.id 
        });

        const { data, error } = await supabase!
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

        if (error) {
          logger.error('Supabase status submission failed:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            userId,
            kingdomNumber
          });
          
          // Check for auth-related errors
          if (error.code === 'PGRST301' || error.message.includes('JWT')) {
            throw new SessionExpiredError();
          }
          
          // Check for missing table/relation errors (database not set up)
          if (error.message.includes('relation') && error.message.includes('does not exist')) {
            throw new Error('Database configuration issue. Please contact support.');
          }
          
          // Check for 404/table not found
          if (error.code === '42P01' || error.message.includes('404')) {
            throw new Error('Status submissions are temporarily unavailable. Please try again later.');
          }
          
          throw new Error(`Failed to submit: ${error.message}`);
        }

        if (!data) {
          throw new Error('Failed to submit: No data returned');
        }

        logger.info(`Status submission created in Supabase for K${kingdomNumber}`);
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
      }, 'Status submission');
    } finally {
      // Always remove from in-flight tracking
      inFlightSubmissions.delete(submissionKey);
    }
  }

  async getUserPendingSubmissions(userId: string): Promise<StatusSubmission[]> {
    this.ensureSupabase();

    const { data, error } = await supabase!
      .from('status_submissions')
      .select('*')
      .eq('submitted_by', userId)
      .eq('status', 'pending')
      .order('submitted_at', { ascending: false });

    if (error) {
      logger.error('Failed to fetch user pending submissions:', error.message);
      throw new Error(`Failed to fetch: ${error.message}`);
    }

    return (data || []).map(d => this.mapSubmission(d));
  }

  async getKingdomPendingSubmissions(kingdomNumber: number): Promise<StatusSubmission[]> {
    this.ensureSupabase();

    const { data, error } = await supabase!
      .from('status_submissions')
      .select('*')
      .eq('kingdom_number', kingdomNumber)
      .eq('status', 'pending')
      .order('submitted_at', { ascending: false });

    if (error) {
      logger.error('Failed to fetch kingdom pending submissions:', error.message);
      throw new Error(`Failed to fetch: ${error.message}`);
    }

    return (data || []).map(d => this.mapSubmission(d));
  }

  async hasUserSubmittedRecently(userId: string, kingdomNumber: number, hoursAgo: number = 24): Promise<boolean> {
    this.ensureSupabase();

    const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase!
      .from('status_submissions')
      .select('id')
      .eq('submitted_by', userId)
      .eq('kingdom_number', kingdomNumber)
      .gte('submitted_at', cutoff)
      .limit(1);

    if (error) {
      logger.error('Failed to check recent submissions:', error.message);
      return false; // Fail open for rate limiting check
    }

    return (data?.length || 0) > 0;
  }

  async approveSubmission(submissionId: string, reviewerId: string, reviewNotes?: string): Promise<void> {
    this.ensureSupabase();

    const { error } = await supabase!
      .from('status_submissions')
      .update({
        status: 'approved',
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes
      })
      .eq('id', submissionId);

    if (error) {
      logger.error('Failed to approve submission in Supabase:', error.message);
      throw new Error(`Failed to approve: ${error.message}`);
    }
    logger.info(`Status submission ${submissionId} approved`);
  }

  async rejectSubmission(submissionId: string, reviewerId: string, reviewNotes?: string): Promise<void> {
    this.ensureSupabase();

    const { error } = await supabase!
      .from('status_submissions')
      .update({
        status: 'rejected',
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes
      })
      .eq('id', submissionId);

    if (error) {
      logger.error('Failed to reject submission in Supabase:', error.message);
      throw new Error(`Failed to reject: ${error.message}`);
    }
    logger.info(`Status submission ${submissionId} rejected`);
  }

  async fetchAllSubmissions(statusFilter?: 'pending' | 'approved' | 'rejected' | 'all'): Promise<StatusSubmission[]> {
    this.ensureSupabase();

    let query = supabase!
      .from('status_submissions')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Failed to fetch submissions from Supabase:', error.message);
      throw new Error(`Failed to fetch: ${error.message}`);
    }

    return (data || []).map(d => this.mapSubmission(d));
  }

  async getAllPendingSubmissions(): Promise<StatusSubmission[]> {
    return this.fetchAllSubmissions('pending');
  }

  async getSubmissionHistory(kingdomNumber: number): Promise<StatusSubmission[]> {
    this.ensureSupabase();

    const { data, error } = await supabase!
      .from('status_submissions')
      .select('*')
      .eq('kingdom_number', kingdomNumber)
      .order('submitted_at', { ascending: false });

    if (error) {
      logger.error('Failed to fetch submission history:', error.message);
      throw new Error(`Failed to fetch: ${error.message}`);
    }

    return (data || []).map(d => this.mapSubmission(d));
  }

  async getApprovedStatus(kingdomNumber: number): Promise<string | null> {
    this.ensureSupabase();

    const { data, error } = await supabase!
      .from('status_submissions')
      .select('new_status')
      .eq('kingdom_number', kingdomNumber)
      .eq('status', 'approved')
      .order('reviewed_at', { ascending: false, nullsFirst: false })
      .limit(1);

    if (error) {
      logger.error('Failed to fetch approved status:', error.message);
      return null;
    }

    return data?.[0]?.new_status || null;
  }

  async getAllApprovedStatusOverridesAsync(): Promise<Map<number, string>> {
    const overrides = new Map<number, string>();
    
    if (!isSupabaseConfigured || !supabase) {
      logger.warn('Supabase not configured - no status overrides available');
      return overrides;
    }

    try {
      const { data, error } = await supabase
        .from('status_submissions')
        .select('kingdom_number, new_status, reviewed_at, submitted_at')
        .eq('status', 'approved')
        .order('reviewed_at', { ascending: true, nullsFirst: true });

      if (error) {
        logger.error('Failed to fetch approved status overrides from Supabase:', error.message);
        return overrides;
      }

      if (data) {
        // Later approvals override earlier ones for the same kingdom
        for (const sub of data) {
          overrides.set(sub.kingdom_number, sub.new_status);
        }
        logger.info(`Loaded ${overrides.size} approved status overrides from Supabase`);
      }
    } catch (err) {
      logger.error('Error fetching status overrides:', err);
    }
    
    return overrides;
  }

  /**
   * Diagnostic function to check if status_submissions table exists and is accessible
   */
  async checkTableStatus(): Promise<{ exists: boolean; canRead: boolean; canWrite: boolean; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { exists: false, canRead: false, canWrite: false, error: 'Supabase not configured' };
    }

    try {
      // Try to read from the table (will fail if table doesn't exist)
      const { error: readError } = await supabase
        .from('status_submissions')
        .select('id')
        .limit(1);

      if (readError) {
        logger.error('status_submissions table check failed:', readError);
        return { 
          exists: readError.code !== '42P01', // 42P01 = table doesn't exist
          canRead: false, 
          canWrite: false, 
          error: `${readError.message} (code: ${readError.code})` 
        };
      }

      return { exists: true, canRead: true, canWrite: true };
    } catch (err) {
      logger.error('Table status check error:', err);
      return { exists: false, canRead: false, canWrite: false, error: String(err) };
    }
  }

  private mapSubmission(d: Record<string, unknown>): StatusSubmission {
    return {
      id: d.id as string,
      kingdom_number: d.kingdom_number as number,
      old_status: d.old_status as string,
      new_status: d.new_status as string,
      notes: (d.notes as string) || '',
      submitted_by: d.submitted_by as string,
      submitted_at: d.submitted_at as string,
      status: d.status as 'pending' | 'approved' | 'rejected',
      reviewed_by: d.reviewed_by as string | undefined,
      reviewed_at: d.reviewed_at as string | undefined,
      review_notes: d.review_notes as string | undefined
    };
  }
}

export const statusService = new StatusService();
