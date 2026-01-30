/**
 * Service for handling data corrections
 * Manages approved corrections and applies them to kingdom data
 */

import { apiService } from './api';

export interface DataCorrection {
  id: string;
  kingdom_number: number;
  field: string;
  current_value: string;
  suggested_value: string;
  reason: string;
  submitter_id: string;
  submitter_name: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
}

const CORRECTIONS_KEY = 'kingshot_data_corrections';
const APPLIED_CORRECTIONS_KEY = 'kingshot_applied_corrections';

class CorrectionService {
  private getCorrections(): DataCorrection[] {
    try {
      const data = localStorage.getItem(CORRECTIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private getAppliedCorrections(): Set<string> {
    try {
      const data = localStorage.getItem(APPLIED_CORRECTIONS_KEY);
      return new Set(data ? JSON.parse(data) : []);
    } catch {
      return new Set();
    }
  }

  private saveAppliedCorrections(applied: Set<string>): void {
    localStorage.setItem(APPLIED_CORRECTIONS_KEY, JSON.stringify([...applied]));
  }

  /**
   * Get all approved corrections that haven't been applied yet
   */
  getUnappliedCorrections(): DataCorrection[] {
    const corrections = this.getCorrections();
    const applied = this.getAppliedCorrections();
    
    return corrections.filter(c => 
      c.status === 'approved' && !applied.has(c.id)
    );
  }

  /**
   * Get all approved corrections as a map for quick lookup
   * Returns: Map<kingdom_number, Map<field, value>>
   */
  getAllApprovedCorrections(): Map<number, Map<string, string>> {
    const corrections = this.getCorrections()
      .filter(c => c.status === 'approved')
      .sort((a, b) => 
        new Date(a.reviewed_at || a.created_at).getTime() - 
        new Date(b.reviewed_at || b.created_at).getTime()
      );

    const result = new Map<number, Map<string, string>>();
    
    for (const c of corrections) {
      if (!result.has(c.kingdom_number)) {
        result.set(c.kingdom_number, new Map());
      }
      result.get(c.kingdom_number)!.set(c.field, c.suggested_value);
    }
    
    return result;
  }

  /**
   * Mark a correction as applied and trigger data reload
   */
  markAsApplied(correctionId: string): void {
    const applied = this.getAppliedCorrections();
    applied.add(correctionId);
    this.saveAppliedCorrections(applied);
  }

  /**
   * Apply all pending approved corrections and reload data
   * Called after approving a correction in admin dashboard
   */
  applyCorrectionsAndReload(): void {
    // Trigger data reload to pick up approved corrections
    apiService.reloadData();
  }

  /**
   * Get correction overrides for a specific kingdom
   */
  getKingdomOverrides(kingdomNumber: number): Map<string, string> {
    const allCorrections = this.getAllApprovedCorrections();
    return allCorrections.get(kingdomNumber) || new Map();
  }

  /**
   * Check if a field has an approved correction
   */
  hasCorrection(kingdomNumber: number, field: string): boolean {
    const overrides = this.getKingdomOverrides(kingdomNumber);
    return overrides.has(field);
  }

  /**
   * Get the corrected value for a field, or null if no correction
   */
  getCorrectedValue(kingdomNumber: number, field: string): string | null {
    const overrides = this.getKingdomOverrides(kingdomNumber);
    return overrides.get(field) || null;
  }
}

export const correctionService = new CorrectionService();
