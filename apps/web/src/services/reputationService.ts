/**
 * User Reputation System
 * Tracks user contributions and quality to incentivize accurate data
 */

import { logger } from '../utils/logger';

export interface UserReputation {
  userId: string;
  username: string;
  totalSubmissions: number;
  approvedSubmissions: number;
  rejectedSubmissions: number;
  pendingSubmissions: number;
  reputationScore: number;
  level: 'Newcomer' | 'Contributor' | 'Trusted' | 'Expert' | 'Elite';
  badges: string[];
  joinedAt: string;
  lastActivityAt: string;
}

const REPUTATION_KEY = 'kingshot_user_reputation';

// Points system
const POINTS = {
  SUBMISSION_APPROVED: 10,
  SUBMISSION_REJECTED: -5,
  FIRST_SUBMISSION: 5,
  STREAK_BONUS: 2, // per consecutive approved submission
  REPORT_VERIFIED: 15,
};

// Level thresholds
const LEVELS = [
  { name: 'Newcomer', minScore: 0, color: '#6b7280' },
  { name: 'Contributor', minScore: 25, color: '#3b82f6' },
  { name: 'Trusted', minScore: 100, color: '#22c55e' },
  { name: 'Expert', minScore: 250, color: '#a855f7' },
  { name: 'Elite', minScore: 500, color: '#fbbf24' },
] as const;

// Badge definitions
const BADGES = {
  FIRST_SUBMISSION: { id: 'first_submission', name: 'First Steps', icon: '🎯', desc: 'Made your first submission' },
  TEN_APPROVED: { id: 'ten_approved', name: 'Reliable Source', icon: '✓', desc: '10 approved submissions' },
  FIFTY_APPROVED: { id: 'fifty_approved', name: 'Data Champion', icon: '🏆', desc: '50 approved submissions' },
  PERFECT_STREAK_5: { id: 'streak_5', name: 'Hot Streak', icon: '🔥', desc: '5 approved in a row' },
  PERFECT_STREAK_10: { id: 'streak_10', name: 'On Fire', icon: '💎', desc: '10 approved in a row' },
  ZERO_REJECTIONS: { id: 'zero_rejections', name: 'Perfectionist', icon: '⭐', desc: '25+ submissions with 0 rejections' },
};

class ReputationService {
  private getReputation(userId: string): UserReputation | null {
    try {
      const data = localStorage.getItem(REPUTATION_KEY);
      const allReps: Record<string, UserReputation> = data ? JSON.parse(data) : {};
      return allReps[userId] || null;
    } catch {
      return null;
    }
  }

  private saveReputation(rep: UserReputation): void {
    try {
      const data = localStorage.getItem(REPUTATION_KEY);
      const allReps: Record<string, UserReputation> = data ? JSON.parse(data) : {};
      allReps[rep.userId] = rep;
      localStorage.setItem(REPUTATION_KEY, JSON.stringify(allReps));
    } catch (e) {
      logger.warn('Failed to save reputation:', e);
    }
  }

  private calculateLevel(score: number): UserReputation['level'] {
    for (let i = LEVELS.length - 1; i >= 0; i--) {
      const level = LEVELS[i];
      if (level && score >= level.minScore) {
        return level.name as UserReputation['level'];
      }
    }
    return 'Newcomer';
  }

  private checkBadges(rep: UserReputation): string[] {
    const badges: string[] = [...rep.badges];

    // First submission badge
    if (rep.totalSubmissions >= 1 && !badges.includes(BADGES.FIRST_SUBMISSION.id)) {
      badges.push(BADGES.FIRST_SUBMISSION.id);
    }

    // 10 approved
    if (rep.approvedSubmissions >= 10 && !badges.includes(BADGES.TEN_APPROVED.id)) {
      badges.push(BADGES.TEN_APPROVED.id);
    }

    // 50 approved
    if (rep.approvedSubmissions >= 50 && !badges.includes(BADGES.FIFTY_APPROVED.id)) {
      badges.push(BADGES.FIFTY_APPROVED.id);
    }

    // Perfectionist (25+ with 0 rejections)
    if (rep.approvedSubmissions >= 25 && rep.rejectedSubmissions === 0 && !badges.includes(BADGES.ZERO_REJECTIONS.id)) {
      badges.push(BADGES.ZERO_REJECTIONS.id);
    }

    return badges;
  }

  initUser(userId: string, username: string): UserReputation {
    let rep = this.getReputation(userId);
    
    if (!rep) {
      rep = {
        userId,
        username,
        totalSubmissions: 0,
        approvedSubmissions: 0,
        rejectedSubmissions: 0,
        pendingSubmissions: 0,
        reputationScore: 0,
        level: 'Newcomer',
        badges: [],
        joinedAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString()
      };
      this.saveReputation(rep);
    }

    return rep;
  }

  getUserReputation(userId: string): UserReputation | null {
    return this.getReputation(userId);
  }

  recordSubmission(userId: string, username: string): UserReputation {
    let rep = this.getReputation(userId) || this.initUser(userId, username);
    
    rep.totalSubmissions++;
    rep.pendingSubmissions++;
    rep.lastActivityAt = new Date().toISOString();

    // First submission bonus
    if (rep.totalSubmissions === 1) {
      rep.reputationScore += POINTS.FIRST_SUBMISSION;
    }

    rep.badges = this.checkBadges(rep);
    rep.level = this.calculateLevel(rep.reputationScore);
    
    this.saveReputation(rep);
    return rep;
  }

  approveSubmission(userId: string): UserReputation | null {
    const rep = this.getReputation(userId);
    if (!rep) return null;

    rep.pendingSubmissions = Math.max(0, rep.pendingSubmissions - 1);
    rep.approvedSubmissions++;
    rep.reputationScore += POINTS.SUBMISSION_APPROVED;
    rep.lastActivityAt = new Date().toISOString();

    rep.badges = this.checkBadges(rep);
    rep.level = this.calculateLevel(rep.reputationScore);

    this.saveReputation(rep);
    return rep;
  }

  rejectSubmission(userId: string): UserReputation | null {
    const rep = this.getReputation(userId);
    if (!rep) return null;

    rep.pendingSubmissions = Math.max(0, rep.pendingSubmissions - 1);
    rep.rejectedSubmissions++;
    rep.reputationScore = Math.max(0, rep.reputationScore + POINTS.SUBMISSION_REJECTED);
    rep.lastActivityAt = new Date().toISOString();

    rep.level = this.calculateLevel(rep.reputationScore);

    this.saveReputation(rep);
    return rep;
  }

  getLeaderboard(limit: number = 10): UserReputation[] {
    try {
      const data = localStorage.getItem(REPUTATION_KEY);
      const allReps: Record<string, UserReputation> = data ? JSON.parse(data) : {};
      
      return Object.values(allReps)
        .sort((a, b) => b.reputationScore - a.reputationScore)
        .slice(0, limit);
    } catch {
      return [];
    }
  }

  getLevelInfo(level: UserReputation['level']) {
    return LEVELS.find(l => l.name === level) || LEVELS[0];
  }

  getBadgeInfo(badgeId: string) {
    return Object.values(BADGES).find(b => b.id === badgeId);
  }

  getAllBadges() {
    return Object.values(BADGES);
  }
}

export const reputationService = new ReputationService();
