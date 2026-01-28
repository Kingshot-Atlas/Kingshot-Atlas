/**
 * Filtering and sorting utilities for Kingshot Atlas.
 */
import { Kingdom, FilterOptions, SortOptions } from '../types';

/**
 * Apply filters and sorting to a list of kingdoms.
 */
export function applyFiltersAndSort(
  kingdoms: Kingdom[],
  filters?: FilterOptions,
  sort?: SortOptions
): Kingdom[] {
  let result = [...kingdoms];
  
  if (filters) {
    if (filters.status && filters.status !== 'all') {
      result = result.filter(k => k.most_recent_status === filters.status);
    }
    if (filters.minKvKs) {
      result = result.filter(k => k.total_kvks >= filters.minKvKs!);
    }
    if (filters.minPrepWinRate) {
      result = result.filter(k => k.prep_win_rate >= filters.minPrepWinRate!);
    }
    if (filters.minBattleWinRate) {
      result = result.filter(k => k.battle_win_rate >= filters.minBattleWinRate!);
    }
  }
  
  if (sort) {
    result.sort((a, b) => {
      let aVal: number, bVal: number;
      switch (sort.sortBy) {
        case 'overall_score':
          aVal = a.overall_score;
          bVal = b.overall_score;
          break;
        case 'kingdom_number':
          aVal = a.kingdom_number;
          bVal = b.kingdom_number;
          break;
        case 'prep_win_rate':
          aVal = a.prep_win_rate;
          bVal = b.prep_win_rate;
          break;
        case 'battle_win_rate':
          aVal = a.battle_win_rate;
          bVal = b.battle_win_rate;
          break;
        case 'total_kvks':
          aVal = a.total_kvks;
          bVal = b.total_kvks;
          break;
        default:
          aVal = a.overall_score;
          bVal = b.overall_score;
      }
      return sort.order === 'desc' ? bVal - aVal : aVal - bVal;
    });
  }
  
  return result;
}

/**
 * Paginate a list of items.
 */
export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number
): { items: T[]; total: number; totalPages: number } {
  const total = items.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const paginatedItems = items.slice(start, start + pageSize);
  
  return { items: paginatedItems, total, totalPages };
}
