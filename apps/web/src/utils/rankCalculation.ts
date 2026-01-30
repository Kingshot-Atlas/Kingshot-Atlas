/**
 * Shared rank calculation utilities for Kingshot Atlas
 * Ensures consistent ranking across all components
 */

import { Kingdom } from '../types';

/**
 * Calculate rank for a specific kingdom across all kingdoms
 * @param kingdomNumber - The kingdom number to find rank for
 * @param allKingdoms - All kingdoms array (must be complete, unfiltered)
 * @returns Rank number (1-based) or 0 if not found
 */
export function calculateKingdomRank(kingdomNumber: number, allKingdoms: Kingdom[]): number {
  if (!allKingdoms || allKingdoms.length === 0) return 0;
  
  // Sort by overall_score descending
  const sorted = [...allKingdoms].sort((a, b) => b.overall_score - a.overall_score);
  
  // Find the kingdom's position
  const index = sorted.findIndex(k => k.kingdom_number === kingdomNumber);
  
  // Return 1-based rank or 0 if not found
  return index === -1 ? 0 : index + 1;
}

/**
 * Add ranks to all kingdoms (for directory/list views)
 * @param kingdoms - Kingdoms array (can be filtered)
 * @param allKingdoms - All kingdoms for rank calculation (must be complete)
 * @returns Kingdoms with rank property added
 */
export function addRanksToKingdoms(kingdoms: Kingdom[], allKingdoms: Kingdom[]): (Kingdom & { rank: number })[] {
  // Create rank lookup map for performance
  const sorted = [...allKingdoms].sort((a, b) => b.overall_score - a.overall_score);
  const rankMap = new Map<number, number>();
  sorted.forEach((k, i) => rankMap.set(k.kingdom_number, i + 1));
  
  // Add rank to each kingdom
  return kingdoms.map(k => ({
    ...k,
    rank: rankMap.get(k.kingdom_number) || 0
  }));
}

/**
 * Get top N kingdoms by rank
 * @param allKingdoms - All kingdoms array
 * @param limit - Number of top kingdoms to return
 * @returns Top kingdoms with ranks
 */
export function getTopKingdoms(allKingdoms: Kingdom[], limit: number = 10): (Kingdom & { rank: number })[] {
  const sorted = [...allKingdoms].sort((a, b) => b.overall_score - a.overall_score);
  return sorted.slice(0, limit).map((k, i) => ({
    ...k,
    rank: i + 1
  }));
}

/**
 * Validate rank calculation consistency
 * @param allKingdoms - All kingdoms array
 * @returns Validation result with any inconsistencies found
 */
export function validateRankConsistency(allKingdoms: Kingdom[]): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  
  if (!allKingdoms || allKingdoms.length === 0) {
    issues.push('No kingdoms provided');
    return { isValid: false, issues };
  }
  
  // Check for duplicate scores (ties are allowed but should be noted)
  const scoreGroups = new Map<number, number>();
  allKingdoms.forEach(k => {
    const count = scoreGroups.get(k.overall_score) || 0;
    scoreGroups.set(k.overall_score, count + 1);
  });
  
  const ties = Array.from(scoreGroups.entries()).filter(([_, count]) => count > 1);
  if (ties.length > 0) {
    const highestTie = ties[0];
    if (highestTie) {
      issues.push(`Found ${ties.length} score ties (highest: ${highestTie[0]} with ${highestTie[1]} kingdoms)`);
    }
  }
  
  // Check for NaN or invalid scores
  const invalidScores = allKingdoms.filter(k => 
    typeof k.overall_score !== 'number' || isNaN(k.overall_score)
  );
  
  if (invalidScores.length > 0) {
    issues.push(`Found ${invalidScores.length} kingdoms with invalid scores`);
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}
