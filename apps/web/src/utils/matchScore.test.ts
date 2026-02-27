import { describe, it, expect } from 'vitest';
import { calculateMatchScore, calculateMatchScoreForSort } from './matchScore';

// Minimal stubs matching the interfaces used by matchScore.ts
const makeKingdom = () => ({ kingdom_number: 100 } as any);

const makeFund = (overrides: Record<string, unknown> = {}) => ({
  is_recruiting: true,
  min_power_million: 0,
  min_power_range: null,
  min_tc_level: 0,
  main_language: null as string | null,
  secondary_languages: [] as string[],
  kingdom_vibe: [] as string[],
  ...overrides,
} as any);

const makeProfile = (overrides: Record<string, unknown> = {}) => ({
  power_million: 50,
  tc_level: 25,
  main_language: 'English',
  secondary_languages: ['Spanish'],
  looking_for: ['Competitive', 'Friendly'],
  kvk_availability: 'full',
  saving_for_kvk: '',
  group_size: '1',
  player_bio: '',
  play_schedule: [],
  contact_method: 'discord',
  visible_to_recruiters: true,
  ...overrides,
});

// ============================================================================
// EDGE CASES — null/empty inputs
// ============================================================================

describe('calculateMatchScore — null guards', () => {
  it('returns 0 with no transfer profile', () => {
    const { score, details } = calculateMatchScore(makeKingdom(), makeFund(), null);
    expect(score).toBe(0);
    expect(details).toEqual([]);
  });

  it('returns 0 with no fund', () => {
    const { score, details } = calculateMatchScore(makeKingdom(), null, makeProfile());
    expect(score).toBe(0);
    expect(details).toEqual([]);
  });

  it('returns 25 fallback when recruiting but no criteria match', () => {
    const fund = makeFund({ is_recruiting: true });
    const { score } = calculateMatchScore(makeKingdom(), fund, makeProfile());
    expect(score).toBe(25);
  });

  it('returns 0 when not recruiting and no criteria match', () => {
    const fund = makeFund({ is_recruiting: false });
    const { score } = calculateMatchScore(makeKingdom(), fund, makeProfile());
    expect(score).toBe(0);
  });
});

// ============================================================================
// POWER SCORING (30% weight)
// ============================================================================

describe('calculateMatchScore — Power', () => {
  it('scores 100% when player meets or exceeds power requirement', () => {
    const fund = makeFund({ min_power_million: 40 });
    const profile = makeProfile({ power_million: 50 });
    const { score } = calculateMatchScore(makeKingdom(), fund, profile);
    expect(score).toBe(100); // Only power applicable → 100%
  });

  it('gives partial credit for power within 80%', () => {
    const fund = makeFund({ min_power_million: 50 });
    const profile = makeProfile({ power_million: 45 }); // 90% of requirement
    const { score } = calculateMatchScore(makeKingdom(), fund, profile);
    expect(score).toBeGreaterThan(50);
    expect(score).toBeLessThan(100);
  });

  it('gives low score for power far below requirement', () => {
    const fund = makeFund({ min_power_million: 100 });
    const profile = makeProfile({ power_million: 20 }); // 20% of requirement
    const { score } = calculateMatchScore(makeKingdom(), fund, profile);
    expect(score).toBeLessThan(30);
  });

  it('reads min_power_range as fallback', () => {
    const fund = makeFund({ min_power_million: 0, min_power_range: '50' });
    const profile = makeProfile({ power_million: 50 });
    const { score } = calculateMatchScore(makeKingdom(), fund, profile);
    expect(score).toBe(100);
  });
});

// ============================================================================
// TC LEVEL SCORING (25% weight)
// ============================================================================

describe('calculateMatchScore — TC Level', () => {
  it('scores 100% when player meets TC requirement', () => {
    const fund = makeFund({ min_tc_level: 20 });
    const profile = makeProfile({ tc_level: 25 });
    const { score } = calculateMatchScore(makeKingdom(), fund, profile);
    expect(score).toBe(100);
  });

  it('gives 70% partial for being within 2 TC levels', () => {
    const fund = makeFund({ min_tc_level: 25 });
    const profile = makeProfile({ tc_level: 23 }); // 2 below
    const { score } = calculateMatchScore(makeKingdom(), fund, profile);
    expect(score).toBe(70);
  });

  it('gives 30% partial for being 3-5 TC levels below', () => {
    const fund = makeFund({ min_tc_level: 25 });
    const profile = makeProfile({ tc_level: 21 }); // 4 below
    const { score } = calculateMatchScore(makeKingdom(), fund, profile);
    expect(score).toBe(30);
  });

  it('gives 0% for being >5 TC levels below', () => {
    const fund = makeFund({ min_tc_level: 30 });
    const profile = makeProfile({ tc_level: 20 }); // 10 below
    const { score } = calculateMatchScore(makeKingdom(), fund, profile);
    expect(score).toBe(0);
  });
});

// ============================================================================
// LANGUAGE SCORING (25% weight)
// ============================================================================

describe('calculateMatchScore — Language', () => {
  it('scores 100% for primary language match', () => {
    const fund = makeFund({ main_language: 'English' });
    const profile = makeProfile({ main_language: 'English' });
    const { score } = calculateMatchScore(makeKingdom(), fund, profile);
    expect(score).toBe(100);
  });

  it('scores 80% when player main is fund secondary', () => {
    const fund = makeFund({ main_language: 'Spanish', secondary_languages: ['English'] });
    const profile = makeProfile({ main_language: 'English', secondary_languages: [] });
    const { score } = calculateMatchScore(makeKingdom(), fund, profile);
    expect(score).toBe(80);
  });

  it('scores 60% when fund main is player secondary', () => {
    const fund = makeFund({ main_language: 'Spanish', secondary_languages: [] });
    const profile = makeProfile({ main_language: 'English', secondary_languages: ['Spanish'] });
    const { score } = calculateMatchScore(makeKingdom(), fund, profile);
    expect(score).toBe(60);
  });

  it('scores 30% for cross-secondary overlap', () => {
    const fund = makeFund({ main_language: 'French', secondary_languages: ['German'] });
    const profile = makeProfile({ main_language: 'English', secondary_languages: ['German'] });
    const { score } = calculateMatchScore(makeKingdom(), fund, profile);
    expect(score).toBe(30);
  });

  it('scores 0% for no language overlap', () => {
    const fund = makeFund({ main_language: 'Korean', secondary_languages: [] });
    const profile = makeProfile({ main_language: 'English', secondary_languages: ['Spanish'] });
    const { score } = calculateMatchScore(makeKingdom(), fund, profile);
    expect(score).toBe(0);
  });
});

// ============================================================================
// VIBE SCORING (20% weight)
// ============================================================================

describe('calculateMatchScore — Vibe', () => {
  it('scores high for full vibe overlap', () => {
    const fund = makeFund({ kingdom_vibe: ['Competitive', 'Friendly'] });
    const profile = makeProfile({ looking_for: ['Competitive', 'Friendly'] });
    const { score } = calculateMatchScore(makeKingdom(), fund, profile);
    expect(score).toBe(100);
  });

  it('gives partial credit for partial overlap', () => {
    const fund = makeFund({ kingdom_vibe: ['Competitive', 'Casual', 'Social'] });
    const profile = makeProfile({ looking_for: ['Competitive', 'Friendly'] });
    const { score } = calculateMatchScore(makeKingdom(), fund, profile);
    expect(score).toBeGreaterThan(50);
    expect(score).toBeLessThan(100);
  });

  it('scores 0% for no vibe overlap', () => {
    const fund = makeFund({ kingdom_vibe: ['Casual'] });
    const profile = makeProfile({ looking_for: ['Competitive'] });
    const { score } = calculateMatchScore(makeKingdom(), fund, profile);
    expect(score).toBe(0);
  });
});

// ============================================================================
// WEIGHTED MULTI-FACTOR SCORING
// ============================================================================

describe('calculateMatchScore — Multi-factor', () => {
  it('combines all factors with correct weights', () => {
    const fund = makeFund({
      min_power_million: 50,
      min_tc_level: 25,
      main_language: 'English',
      kingdom_vibe: ['Competitive'],
    });
    const profile = makeProfile({
      power_million: 50,
      tc_level: 25,
      main_language: 'English',
      looking_for: ['Competitive'],
    });
    const { score } = calculateMatchScore(makeKingdom(), fund, profile);
    expect(score).toBe(100); // Perfect match on all factors
  });

  it('returns details array with labeled breakdowns', () => {
    const fund = makeFund({
      min_power_million: 50,
      min_tc_level: 25,
      main_language: 'English',
      kingdom_vibe: ['Competitive'],
    });
    const profile = makeProfile({
      power_million: 50,
      tc_level: 25,
      main_language: 'English',
      looking_for: ['Competitive'],
    });
    const { details } = calculateMatchScore(makeKingdom(), fund, profile);
    expect(details).toHaveLength(4);
    expect(details[0]!.label).toContain('Power');
    expect(details[0]!.label).toContain('30%');
    expect(details[1]!.label).toContain('TC Level');
    expect(details[1]!.label).toContain('25%');
    expect(details[2]!.label).toContain('Language');
    expect(details[2]!.label).toContain('25%');
    expect(details[3]!.label).toContain('Vibe');
    expect(details[3]!.label).toContain('20%');
  });
});

// ============================================================================
// SORT-ONLY VARIANT
// ============================================================================

describe('calculateMatchScoreForSort', () => {
  it('returns 0 for null inputs', () => {
    expect(calculateMatchScoreForSort(makeKingdom(), null, makeProfile())).toBe(0);
    expect(calculateMatchScoreForSort(makeKingdom(), makeFund(), null)).toBe(0);
  });

  it('matches full calculation score', () => {
    const fund = makeFund({ min_power_million: 50, main_language: 'English' });
    const profile = makeProfile({ power_million: 50, main_language: 'English' });
    const sortScore = calculateMatchScoreForSort(makeKingdom(), fund, profile);
    const { score } = calculateMatchScore(makeKingdom(), fund, profile);
    expect(sortScore).toBe(score);
  });

  it('returns 25 fallback for recruiting kingdoms with no criteria', () => {
    const fund = makeFund({ is_recruiting: true });
    expect(calculateMatchScoreForSort(makeKingdom(), fund, makeProfile())).toBe(25);
  });
});

// ============================================================================
// EDGE CASES — boundary conditions & zero-weight scenarios
// ============================================================================

describe('calculateMatchScore — edge cases', () => {
  it('handles player with 0 power against positive requirement', () => {
    const fund = makeFund({ min_power_million: 50 });
    const profile = makeProfile({ power_million: 0 });
    const { score } = calculateMatchScore(makeKingdom(), fund, profile);
    expect(score).toBe(0);
  });

  it('handles exact 80% power boundary (partial credit threshold)', () => {
    const fund = makeFund({ min_power_million: 100 });
    const profile = makeProfile({ power_million: 80 }); // exactly 80%
    const { score } = calculateMatchScore(makeKingdom(), fund, profile);
    expect(score).toBe(50); // 0.5 + (0.8 - 0.8) * 2.5 = 0.5 → 50%
  });

  it('handles player power exactly at requirement', () => {
    const fund = makeFund({ min_power_million: 50 });
    const profile = makeProfile({ power_million: 50 });
    const { score } = calculateMatchScore(makeKingdom(), fund, profile);
    expect(score).toBe(100);
  });

  it('handles TC level exactly at boundary (diff = 2)', () => {
    const fund = makeFund({ min_tc_level: 25 });
    const profile = makeProfile({ tc_level: 23 }); // diff = 2
    const { score } = calculateMatchScore(makeKingdom(), fund, profile);
    expect(score).toBe(70);
  });

  it('handles TC level at boundary (diff = 5)', () => {
    const fund = makeFund({ min_tc_level: 25 });
    const profile = makeProfile({ tc_level: 20 }); // diff = 5
    const { score } = calculateMatchScore(makeKingdom(), fund, profile);
    expect(score).toBe(30);
  });

  it('handles TC level just past boundary (diff = 6)', () => {
    const fund = makeFund({ min_tc_level: 25 });
    const profile = makeProfile({ tc_level: 19 }); // diff = 6
    const { score } = calculateMatchScore(makeKingdom(), fund, profile);
    expect(score).toBe(0);
  });

  it('handles empty player secondary languages', () => {
    const fund = makeFund({ main_language: 'Spanish', secondary_languages: ['English'] });
    const profile = makeProfile({ main_language: 'French', secondary_languages: [] });
    const { score } = calculateMatchScore(makeKingdom(), fund, profile);
    expect(score).toBe(0);
  });

  it('handles empty fund secondary languages', () => {
    const fund = makeFund({ main_language: 'Spanish', secondary_languages: [] });
    const profile = makeProfile({ main_language: 'French', secondary_languages: ['German'] });
    const { score } = calculateMatchScore(makeKingdom(), fund, profile);
    expect(score).toBe(0);
  });

  it('handles empty vibe arrays on both sides', () => {
    const fund = makeFund({ kingdom_vibe: [] });
    const profile = makeProfile({ looking_for: [] });
    // Both empty → vibe not applicable → falls through to other criteria or fallback
    const { score } = calculateMatchScore(makeKingdom(), fund, profile);
    // No applicable criteria → recruiting fallback
    expect(score).toBe(25);
  });

  it('handles single vibe match among many', () => {
    const fund = makeFund({ kingdom_vibe: ['A', 'B', 'C', 'D', 'E'] });
    const profile = makeProfile({ looking_for: ['A'] });
    const { score } = calculateMatchScore(makeKingdom(), fund, profile);
    // 1 overlap out of min(1,5)=1 → ratio=1.0 → score = 0.5 + 1.0*0.5 = 1.0
    expect(score).toBe(100);
  });

  it('non-recruiting fund with no criteria returns 0', () => {
    const fund = makeFund({ is_recruiting: false });
    const profile = makeProfile();
    const { score, details } = calculateMatchScore(makeKingdom(), fund, profile);
    expect(score).toBe(0);
    expect(details).toEqual([]);
  });

  it('min_power_range string parsing with non-numeric value returns no power factor', () => {
    const fund = makeFund({ min_power_million: 0, min_power_range: 'abc' });
    const profile = makeProfile({ power_million: 50 });
    // parseInt('abc') = NaN → || 0 → minPower = 0 → scorePower returns -1 (not applicable)
    const { score } = calculateMatchScore(makeKingdom(), fund, profile);
    // No applicable criteria → recruiting fallback
    expect(score).toBe(25);
  });

  it('all four factors present but all fail returns 0', () => {
    const fund = makeFund({
      min_power_million: 100,
      min_tc_level: 30,
      main_language: 'Korean',
      kingdom_vibe: ['Casual'],
    });
    const profile = makeProfile({
      power_million: 0,
      tc_level: 10,
      main_language: 'English',
      secondary_languages: [],
      looking_for: ['Competitive'],
    });
    const { score, details } = calculateMatchScore(makeKingdom(), fund, profile);
    expect(score).toBe(0);
    expect(details).toHaveLength(4);
    details.forEach(d => expect(d.matched).toBe(false));
  });

  it('detail labels always contain weight percentages', () => {
    const fund = makeFund({
      min_power_million: 50,
      min_tc_level: 25,
      main_language: 'English',
      kingdom_vibe: ['Competitive'],
    });
    const profile = makeProfile();
    const { details } = calculateMatchScore(makeKingdom(), fund, profile);
    expect(details[0]!.label).toMatch(/30%/);
    expect(details[1]!.label).toMatch(/25%/);
    expect(details[2]!.label).toMatch(/25%/);
    expect(details[3]!.label).toMatch(/20%/);
  });
});
