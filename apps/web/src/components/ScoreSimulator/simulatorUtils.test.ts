import { describe, it, expect } from 'vitest';
import { simulateScore, getSimulatedOutcome, SimulatedKvK } from './simulatorUtils';
import { KingdomProfile } from '../../types';

// Mock kingdom data for testing
const createMockKingdom = (overrides: Partial<KingdomProfile> = {}): KingdomProfile => ({
  kingdom_number: 172,
  total_kvks: 10,
  prep_wins: 7,
  prep_losses: 3,
  prep_win_rate: 0.7,
  prep_streak: 2,
  prep_best_streak: 4,
  battle_wins: 8,
  battle_losses: 2,
  battle_win_rate: 0.8,
  battle_streak: 3,
  battle_best_streak: 5,
  dominations: 5,
  invasions: 1,
  most_recent_status: 'Domination',
  overall_score: 8.5,
  last_updated: '2024-01-01',
  recent_kvks: [
    { id: 1, kingdom_number: 172, kvk_number: 10, opponent_kingdom: 100, prep_result: 'Win', battle_result: 'Win', overall_result: 'D', date_or_order_index: '10', created_at: '2024-01-01' },
    { id: 2, kingdom_number: 172, kvk_number: 9, opponent_kingdom: 101, prep_result: 'Win', battle_result: 'Win', overall_result: 'D', date_or_order_index: '9', created_at: '2024-01-01' },
    { id: 3, kingdom_number: 172, kvk_number: 8, opponent_kingdom: 102, prep_result: 'Loss', battle_result: 'Win', overall_result: 'W', date_or_order_index: '8', created_at: '2024-01-01' },
    { id: 4, kingdom_number: 172, kvk_number: 7, opponent_kingdom: 103, prep_result: 'Win', battle_result: 'Loss', overall_result: 'L', date_or_order_index: '7', created_at: '2024-01-01' },
    { id: 5, kingdom_number: 172, kvk_number: 6, opponent_kingdom: 104, prep_result: 'Win', battle_result: 'Win', overall_result: 'D', date_or_order_index: '6', created_at: '2024-01-01' },
  ],
  ...overrides,
});

describe('simulatorUtils', () => {
  describe('simulateScore', () => {
    it('should return a valid simulation result', () => {
      const kingdom = createMockKingdom();
      const simulatedKvKs: SimulatedKvK[] = [{ prepResult: 'W', battleResult: 'W' }];
      
      const result = simulateScore(kingdom, simulatedKvKs);
      
      expect(result).toHaveProperty('currentScore');
      expect(result).toHaveProperty('projectedScore');
      expect(result).toHaveProperty('scoreChange');
      expect(result).toHaveProperty('percentageChange');
      expect(result).toHaveProperty('breakdown');
      expect(result).toHaveProperty('insights');
      expect(result).toHaveProperty('currentTier');
      expect(result).toHaveProperty('projectedTier');
    });

    it('should increase score when simulating a domination', () => {
      const kingdom = createMockKingdom();
      const simulatedKvKs: SimulatedKvK[] = [{ prepResult: 'W', battleResult: 'W' }];
      
      const result = simulateScore(kingdom, simulatedKvKs);
      
      expect(result.scoreChange).toBeGreaterThanOrEqual(0);
    });

    it('should decrease score when simulating an invasion (double loss)', () => {
      const kingdom = createMockKingdom();
      const simulatedKvKs: SimulatedKvK[] = [{ prepResult: 'L', battleResult: 'L' }];
      
      const result = simulateScore(kingdom, simulatedKvKs);
      
      expect(result.scoreChange).toBeLessThanOrEqual(0);
    });

    it('should handle multiple simulated KvKs', () => {
      const kingdom = createMockKingdom();
      const simulatedKvKs: SimulatedKvK[] = [
        { prepResult: 'W', battleResult: 'W' },
        { prepResult: 'W', battleResult: 'W' },
        { prepResult: 'W', battleResult: 'W' },
      ];
      
      const result = simulateScore(kingdom, simulatedKvKs);
      
      expect(result.projectedScore).toBeGreaterThan(0);
      expect(result.breakdown).toBeDefined();
    });

    it('should handle new kingdom with 0 KvKs', () => {
      const kingdom = createMockKingdom({
        total_kvks: 0,
        prep_wins: 0,
        prep_losses: 0,
        battle_wins: 0,
        battle_losses: 0,
        dominations: 0,
        invasions: 0,
        recent_kvks: [],
      });
      const simulatedKvKs: SimulatedKvK[] = [{ prepResult: 'W', battleResult: 'W' }];
      
      const result = simulateScore(kingdom, simulatedKvKs);
      
      expect(result.currentScore).toBe(0);
      expect(result.projectedScore).toBeGreaterThanOrEqual(0);
    });

    it('should handle kingdom with max streaks', () => {
      const kingdom = createMockKingdom({
        prep_streak: 10,
        prep_best_streak: 10,
        battle_streak: 10,
        battle_best_streak: 10,
      });
      const simulatedKvKs: SimulatedKvK[] = [{ prepResult: 'W', battleResult: 'W' }];
      
      const result = simulateScore(kingdom, simulatedKvKs);
      
      expect(result.projectedScore).toBeGreaterThan(0);
      expect(result.currentTier).toBeDefined();
    });

    it('should generate insights for streak changes', () => {
      const kingdom = createMockKingdom({
        battle_streak: 2,
      });
      const simulatedKvKs: SimulatedKvK[] = [
        { prepResult: 'W', battleResult: 'W' },
      ];
      
      const result = simulateScore(kingdom, simulatedKvKs);
      
      expect(Array.isArray(result.insights)).toBe(true);
    });

    it('should correctly calculate tier for high scores', () => {
      const kingdom = createMockKingdom({
        overall_score: 9.5,
        prep_wins: 15,
        prep_losses: 1,
        battle_wins: 15,
        battle_losses: 1,
        dominations: 12,
        invasions: 0,
        total_kvks: 16,
      });
      const simulatedKvKs: SimulatedKvK[] = [{ prepResult: 'W', battleResult: 'W' }];
      
      const result = simulateScore(kingdom, simulatedKvKs);
      
      expect(['S', 'A']).toContain(result.projectedTier);
    });

    it('should correctly calculate tier for low scores', () => {
      const kingdom = createMockKingdom({
        overall_score: 3.0,
        prep_wins: 2,
        prep_losses: 8,
        battle_wins: 2,
        battle_losses: 8,
        dominations: 0,
        invasions: 5,
        total_kvks: 10,
      });
      const simulatedKvKs: SimulatedKvK[] = [{ prepResult: 'L', battleResult: 'L' }];
      
      const result = simulateScore(kingdom, simulatedKvKs);
      
      expect(['C', 'D']).toContain(result.projectedTier);
    });

    it('should handle all wins scenario', () => {
      const kingdom = createMockKingdom();
      const simulatedKvKs: SimulatedKvK[] = [
        { prepResult: 'W', battleResult: 'W' },
        { prepResult: 'W', battleResult: 'W' },
        { prepResult: 'W', battleResult: 'W' },
        { prepResult: 'W', battleResult: 'W' },
        { prepResult: 'W', battleResult: 'W' },
      ];
      
      const result = simulateScore(kingdom, simulatedKvKs);
      
      expect(result.scoreChange).toBeGreaterThan(0);
      expect(result.insights.length).toBeGreaterThan(0);
    });

    it('should handle all losses scenario', () => {
      const kingdom = createMockKingdom();
      const simulatedKvKs: SimulatedKvK[] = [
        { prepResult: 'L', battleResult: 'L' },
        { prepResult: 'L', battleResult: 'L' },
      ];
      
      const result = simulateScore(kingdom, simulatedKvKs);
      
      expect(result.scoreChange).toBeLessThan(0);
    });

    it('should handle experience factor correctly for new kingdoms', () => {
      const kingdom = createMockKingdom({
        total_kvks: 2,
        prep_wins: 2,
        prep_losses: 0,
        battle_wins: 2,
        battle_losses: 0,
      });
      const simulatedKvKs: SimulatedKvK[] = [
        { prepResult: 'W', battleResult: 'W' },
        { prepResult: 'W', battleResult: 'W' },
        { prepResult: 'W', battleResult: 'W' },
      ];
      
      const result = simulateScore(kingdom, simulatedKvKs);
      
      // After 3 more KvKs, total will be 5, experience factor should increase
      expect(result.breakdown.experienceGain).toBeGreaterThan(0);
    });
  });

  describe('getSimulatedOutcome', () => {
    it('should return Domination for W/W', () => {
      const result = getSimulatedOutcome('W', 'W');
      expect(result.label).toBe('Domination');
      expect(result.abbrev).toBe('D');
    });

    it('should return Comeback for L/W', () => {
      const result = getSimulatedOutcome('L', 'W');
      expect(result.label).toBe('Comeback');
      expect(result.abbrev).toBe('C');
    });

    it('should return Reversal for W/L', () => {
      const result = getSimulatedOutcome('W', 'L');
      expect(result.label).toBe('Reversal');
      expect(result.abbrev).toBe('R');
    });

    it('should return Invasion for L/L', () => {
      const result = getSimulatedOutcome('L', 'L');
      expect(result.label).toBe('Invasion');
      expect(result.abbrev).toBe('I');
    });

    it('should return correct colors for each outcome', () => {
      expect(getSimulatedOutcome('W', 'W').color).toBe('#22c55e');
      expect(getSimulatedOutcome('L', 'W').color).toBe('#3b82f6');
      expect(getSimulatedOutcome('W', 'L').color).toBe('#a855f7');
      expect(getSimulatedOutcome('L', 'L').color).toBe('#ef4444');
    });
  });
});
