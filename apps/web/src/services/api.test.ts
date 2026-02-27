import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock localStorage (needed at module load time by ApiService constructor)
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// Mock all dependencies before importing
vi.mock('../utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn(), debug: vi.fn() },
}));

vi.mock('../lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: false,
}));

vi.mock('./kvkCorrectionService', () => ({
  kvkCorrectionService: { fetchCorrectionsFromSupabase: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('./kvkHistoryService', () => ({
  kvkHistoryService: { invalidateCache: vi.fn() },
}));

vi.mock('./kingdomsSupabaseService', () => ({
  kingdomsSupabaseService: {
    getAllKingdoms: vi.fn().mockResolvedValue([
      {
        kingdom_number: 1,
        overall_score: 62,
        total_kvks: 10,
        prep_wins: 7,
        prep_losses: 3,
        prep_win_rate: 0.7,
        battle_wins: 8,
        battle_losses: 2,
        battle_win_rate: 0.8,
        most_recent_status: 'Domination',
        rank: 1,
        recent_kvks: [],
      },
      {
        kingdom_number: 2,
        overall_score: 45,
        total_kvks: 8,
        prep_wins: 4,
        prep_losses: 4,
        prep_win_rate: 0.5,
        battle_wins: 5,
        battle_losses: 3,
        battle_win_rate: 0.625,
        most_recent_status: 'Win',
        rank: 5,
        recent_kvks: [],
      },
      {
        kingdom_number: 3,
        overall_score: 30,
        total_kvks: 6,
        prep_wins: 2,
        prep_losses: 4,
        prep_win_rate: 0.333,
        battle_wins: 3,
        battle_losses: 3,
        battle_win_rate: 0.5,
        most_recent_status: 'Loss',
        rank: 10,
        recent_kvks: [],
      },
    ]),
    invalidateCache: vi.fn(),
  },
}));

// ============================================================================
// API SERVICE — getKingdoms
// ============================================================================

describe('apiService.getKingdoms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all kingdoms without filters', async () => {
    const { apiService } = await import('./api');
    const kingdoms = await apiService.getKingdoms();
    expect(kingdoms).toHaveLength(3);
  });

  it('filters by status', async () => {
    const { apiService } = await import('./api');
    const kingdoms = await apiService.getKingdoms({ status: 'Domination' });
    expect(kingdoms).toHaveLength(1);
    expect(kingdoms[0].kingdom_number).toBe(1);
  });

  it('filters by minKvKs', async () => {
    const { apiService } = await import('./api');
    const kingdoms = await apiService.getKingdoms({ minKvKs: 9 });
    expect(kingdoms).toHaveLength(1);
    expect(kingdoms[0].kingdom_number).toBe(1);
  });

  it('filters by minPrepWinRate', async () => {
    const { apiService } = await import('./api');
    const kingdoms = await apiService.getKingdoms({ minPrepWinRate: 0.6 });
    expect(kingdoms).toHaveLength(1);
    expect(kingdoms[0].kingdom_number).toBe(1);
  });

  it('filters by minBattleWinRate', async () => {
    const { apiService } = await import('./api');
    const kingdoms = await apiService.getKingdoms({ minBattleWinRate: 0.7 });
    expect(kingdoms).toHaveLength(1);
    expect(kingdoms[0].kingdom_number).toBe(1);
  });

  it('returns empty when "all" status filter is used', async () => {
    const { apiService } = await import('./api');
    const kingdoms = await apiService.getKingdoms({ status: 'all' });
    // "all" should not filter anything
    expect(kingdoms).toHaveLength(3);
  });

  it('sorts by overall_score descending', async () => {
    const { apiService } = await import('./api');
    const kingdoms = await apiService.getKingdoms(undefined, {
      sortBy: 'overall_score',
      order: 'desc',
    });
    expect(kingdoms[0].kingdom_number).toBe(1);
    expect(kingdoms[2].kingdom_number).toBe(3);
  });

  it('sorts by kingdom_number ascending', async () => {
    const { apiService } = await import('./api');
    const kingdoms = await apiService.getKingdoms(undefined, {
      sortBy: 'kingdom_number',
      order: 'asc',
    });
    expect(kingdoms[0].kingdom_number).toBe(1);
    expect(kingdoms[1].kingdom_number).toBe(2);
    expect(kingdoms[2].kingdom_number).toBe(3);
  });

  it('combines filters and sort', async () => {
    const { apiService } = await import('./api');
    const kingdoms = await apiService.getKingdoms(
      { minKvKs: 7 },
      { sortBy: 'overall_score', order: 'asc' }
    );
    expect(kingdoms).toHaveLength(2);
    expect(kingdoms[0].kingdom_number).toBe(2); // lower score first
    expect(kingdoms[1].kingdom_number).toBe(1);
  });
});

// ============================================================================
// API SERVICE — getKingdomProfile
// ============================================================================

describe('apiService.getKingdomProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a kingdom profile for a valid kingdom number', async () => {
    const { apiService } = await import('./api');
    const profile = await apiService.getKingdomProfile(1);
    expect(profile).not.toBeNull();
    expect(profile!.kingdom_number).toBe(1);
    expect(profile!.overall_score).toBe(62);
    expect(profile!.recent_kvks).toEqual([]);
  });

  it('returns null for non-existent kingdom', async () => {
    const { apiService } = await import('./api');
    // Mock fetch for API fallback (will fail, and no local match)
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const profile = await apiService.getKingdomProfile(9999);
    expect(profile).toBeNull();
  });
});

// ============================================================================
// API SERVICE — data status exports
// ============================================================================

describe('apiService — data status', () => {
  it('exports data status flags', async () => {
    const mod = await import('./api');
    expect(typeof mod.supabaseDataLoaded).toBe('boolean');
    expect(typeof mod.supabaseKingdomsLoaded).toBe('boolean');
  });
});
