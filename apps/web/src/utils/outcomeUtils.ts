/**
 * KvK Outcome Utilities
 * Centralizes outcome naming and normalization across the application.
 * 
 * Standard Outcomes:
 * - Domination: W+W (won both phases)
 * - Reversal: W+L (won prep, lost battle)
 * - Comeback: L+W (lost prep, won battle)
 * - Invasion: L+L (lost both phases)
 */

export type StandardOutcome = 'Domination' | 'Reversal' | 'Comeback' | 'Invasion';
export type PrepResult = 'W' | 'L';
export type BattleResult = 'W' | 'L';

/**
 * KvK Date reference - all KvK events with their dates
 */
export const KVK_DATES: Record<number, string> = {
  1: '2025-05-24',
  2: '2025-06-21',
  3: '2025-07-19',
  4: '2025-08-16',
  5: '2025-09-13',
  6: '2025-10-11',
  7: '2025-11-08',
  8: '2025-12-06',
  9: '2026-01-03',
  10: '2026-01-31',
};

/**
 * Get KvK date for a given KvK number
 */
export function getKvKDate(kvkNumber: number): string | null {
  return KVK_DATES[kvkNumber] || null;
}

/**
 * Calculate the standard outcome from prep and battle results
 */
export function calculateOutcome(prep: string, battle: string): StandardOutcome {
  const prepWin = prep === 'W' || prep === 'Win';
  const battleWin = battle === 'W' || battle === 'Win';
  
  if (prepWin && battleWin) return 'Domination';
  if (prepWin && !battleWin) return 'Reversal';
  if (!prepWin && battleWin) return 'Comeback';
  return 'Invasion';
}

/**
 * Normalize any legacy outcome value to the standard format
 * Handles all known legacy values from different parts of the codebase
 */
export function normalizeOutcome(outcome: string | null | undefined, prep?: string, battle?: string): StandardOutcome {
  // If we have prep/battle, calculate directly (most reliable)
  if (prep && battle) {
    return calculateOutcome(prep, battle);
  }
  
  // Normalize from legacy value
  if (!outcome) return 'Invasion'; // Default fallback
  
  const normalized = outcome.toLowerCase().trim();
  
  // Map all known legacy values to standard outcomes
  switch (normalized) {
    // Domination variants
    case 'domination':
    case 'win':
    case 'w':
      return 'Domination';
    
    // Reversal variants (won prep, lost battle)
    case 'reversal':
    case 'preparation':
    case 'prep only':
      return 'Reversal';
    
    // Comeback variants (lost prep, won battle)
    case 'comeback':
    case 'battle':
      return 'Comeback';
    
    // Invasion variants (lost both)
    case 'invasion':
    case 'loss':
    case 'defeat':
    case 'l':
      return 'Invasion';
    
    default:
      // Unknown value - try to infer from prep/battle if available
      console.warn(`Unknown outcome value: "${outcome}"`);
      return 'Invasion';
  }
}

/**
 * Get display info for an outcome (color, emoji, description)
 */
export function getOutcomeDisplay(outcome: StandardOutcome): {
  label: string;
  abbrev: string;
  color: string;
  bgColor: string;
  emoji: string;
  description: string;
} {
  switch (outcome) {
    case 'Domination':
      return {
        label: 'Domination',
        abbrev: 'D',
        color: '#22c55e',
        bgColor: '#22c55e15',
        emoji: '👑',
        description: 'Won both Prep and Battle phases'
      };
    case 'Reversal':
      return {
        label: 'Reversal',
        abbrev: 'R',
        color: '#a855f7',
        bgColor: '#a855f715',
        emoji: '⚔️',
        description: 'Won Prep but lost Battle phase'
      };
    case 'Comeback':
      return {
        label: 'Comeback',
        abbrev: 'C',
        color: '#3b82f6',
        bgColor: '#3b82f615',
        emoji: '🔄',
        description: 'Lost Prep but won Battle phase'
      };
    case 'Invasion':
      return {
        label: 'Invasion',
        abbrev: 'I',
        color: '#ef4444',
        bgColor: '#ef444415',
        emoji: '💀',
        description: 'Lost both Prep and Battle phases'
      };
  }
}

/**
 * Get the inverse outcome (for opponent's record)
 */
export function getInverseOutcome(outcome: StandardOutcome): StandardOutcome {
  switch (outcome) {
    case 'Domination': return 'Invasion';
    case 'Invasion': return 'Domination';
    case 'Reversal': return 'Comeback';
    case 'Comeback': return 'Reversal';
  }
}

/**
 * Flip a result (W -> L, L -> W)
 */
export function flipResult(result: string): 'W' | 'L' {
  return result === 'W' || result === 'Win' ? 'L' : 'W';
}

/**
 * Check if an outcome represents a "win" (battle phase victory)
 * Battle phase determines the overall winner
 */
export function isWinningOutcome(outcome: StandardOutcome): boolean {
  return outcome === 'Domination' || outcome === 'Comeback';
}

/**
 * Check if outcome is a domination (both phases won)
 */
export function isDomination(outcome: StandardOutcome): boolean {
  return outcome === 'Domination';
}

/**
 * Check if outcome is an invasion (both phases lost)
 */
export function isInvasion(outcome: StandardOutcome): boolean {
  return outcome === 'Invasion';
}
