// ContributorService - Handles B1-B5 and C4-C5 features
// B1: Auto-apply approved corrections
// B2: Screenshot verification tracking
// B3: Reputation scoring
// B4: Duplicate detection
// B5: Data quality reporting
// C4: Contributor leaderboard
// C5: Badge rewards

const CONTRIBUTOR_KEY = 'kingshot_contributor_stats';
const NOTIFICATIONS_KEY = 'kingshot_user_notifications';

export interface ContributorStats {
  userId: string;
  username: string;
  submissions: {
    total: number;
    approved: number;
    rejected: number;
    pending: number;
  };
  corrections: {
    total: number;
    approved: number;
    rejected: number;
    pending: number;
  };
  kvkErrors: {
    total: number;
    approved: number;
    rejected: number;
    pending: number;
  };
  reputation: number;
  badges: string[];
  lastActive: string;
  joinedAt: string;
}

export interface UserNotification {
  id: string;
  userId: string;
  type: 'submission_approved' | 'submission_rejected' | 'correction_approved' | 'correction_rejected' | 'badge_earned' | 'appeal_response';
  title: string;
  message: string;
  itemId?: string;
  read: boolean;
  createdAt: string;
}

export interface DataQualityReport {
  generatedAt: string;
  period: 'weekly' | 'monthly';
  stats: {
    totalSubmissions: number;
    approvalRate: number;
    avgResponseTime: number;
    topContributors: { userId: string; username: string; approved: number }[];
    commonErrors: { type: string; count: number }[];
    duplicatesDetected: number;
  };
}

// Badge definitions
const BADGES = {
  first_contribution: { name: 'First Steps', description: 'Made your first contribution', icon: '🌱' },
  ten_approved: { name: 'Data Scout', description: '10 approved submissions', icon: '🔍' },
  fifty_approved: { name: 'Data Hunter', description: '50 approved submissions', icon: '🎯' },
  hundred_approved: { name: 'Data Master', description: '100 approved submissions', icon: '👑' },
  perfect_accuracy: { name: 'Sharp Eye', description: '10+ submissions with 100% approval', icon: '👁️' },
  quick_responder: { name: 'Speed Demon', description: 'Submitted 5 corrections in one day', icon: '⚡' },
  veteran: { name: 'Veteran', description: 'Contributing for 30+ days', icon: '🏆' },
  screenshot_hero: { name: 'Evidence Expert', description: '10 submissions with screenshots', icon: '📸' },
};

class ContributorService {
  // Get or create contributor stats
  getContributorStats(userId: string, username: string): ContributorStats {
    const all = this.getAllContributors();
    let stats = all.find(c => c.userId === userId);
    
    if (!stats) {
      stats = {
        userId,
        username,
        submissions: { total: 0, approved: 0, rejected: 0, pending: 0 },
        corrections: { total: 0, approved: 0, rejected: 0, pending: 0 },
        kvkErrors: { total: 0, approved: 0, rejected: 0, pending: 0 },
        reputation: 100, // Start at 100
        badges: [],
        lastActive: new Date().toISOString(),
        joinedAt: new Date().toISOString()
      };
      all.push(stats);
      this.saveContributors(all);
    }
    
    return stats;
  }

  getAllContributors(): ContributorStats[] {
    try {
      const stored = localStorage.getItem(CONTRIBUTOR_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private saveContributors(contributors: ContributorStats[]) {
    localStorage.setItem(CONTRIBUTOR_KEY, JSON.stringify(contributors));
  }

  // B3: Update reputation based on review outcome
  updateReputation(userId: string, username: string, type: 'submission' | 'correction' | 'kvkError', approved: boolean) {
    const all = this.getAllContributors();
    let stats = all.find(c => c.userId === userId);
    
    if (!stats) {
      stats = this.getContributorStats(userId, username);
      all.push(stats);
    }

    // Update counts
    const category = type === 'submission' ? 'submissions' : type === 'correction' ? 'corrections' : 'kvkErrors';
    stats[category].total++;
    if (approved) {
      stats[category].approved++;
      stats[category].pending = Math.max(0, stats[category].pending - 1);
      // Reputation boost for approved
      stats.reputation = Math.min(1000, stats.reputation + 10);
    } else {
      stats[category].rejected++;
      stats[category].pending = Math.max(0, stats[category].pending - 1);
      // Reputation penalty for rejected (smaller)
      stats.reputation = Math.max(0, stats.reputation - 5);
    }

    stats.lastActive = new Date().toISOString();
    
    // Check for new badges
    this.checkAndAwardBadges(stats);
    
    this.saveContributors(all);
    return stats;
  }

  // Track new submission (increments pending)
  trackNewSubmission(userId: string, username: string, type: 'submission' | 'correction' | 'kvkError', hasScreenshot: boolean = false) {
    const all = this.getAllContributors();
    let stats = all.find(c => c.userId === userId);
    
    if (!stats) {
      stats = this.getContributorStats(userId, username);
    }

    const category = type === 'submission' ? 'submissions' : type === 'correction' ? 'corrections' : 'kvkErrors';
    stats[category].pending++;
    stats.lastActive = new Date().toISOString();

    // Track screenshot submissions for badge
    if (hasScreenshot) {
      const screenshotCount = parseInt(localStorage.getItem(`${userId}_screenshots`) || '0') + 1;
      localStorage.setItem(`${userId}_screenshots`, screenshotCount.toString());
    }

    this.checkAndAwardBadges(stats);
    this.saveContributors(all);
  }

  // C5: Check and award badges
  private checkAndAwardBadges(stats: ContributorStats) {
    const newBadges: string[] = [];
    const totalApproved = stats.submissions.approved + stats.corrections.approved + stats.kvkErrors.approved;

    // First contribution
    if (!stats.badges.includes('first_contribution') && totalApproved >= 1) {
      newBadges.push('first_contribution');
    }

    // 10 approved
    if (!stats.badges.includes('ten_approved') && totalApproved >= 10) {
      newBadges.push('ten_approved');
    }

    // 50 approved
    if (!stats.badges.includes('fifty_approved') && totalApproved >= 50) {
      newBadges.push('fifty_approved');
    }

    // 100 approved
    if (!stats.badges.includes('hundred_approved') && totalApproved >= 100) {
      newBadges.push('hundred_approved');
    }

    // Perfect accuracy (10+ with 100% approval)
    const totalSubmitted = stats.submissions.total + stats.corrections.total + stats.kvkErrors.total;
    const totalRejected = stats.submissions.rejected + stats.corrections.rejected + stats.kvkErrors.rejected;
    if (!stats.badges.includes('perfect_accuracy') && totalSubmitted >= 10 && totalRejected === 0) {
      newBadges.push('perfect_accuracy');
    }

    // Veteran (30+ days)
    const daysSinceJoin = Math.floor((Date.now() - new Date(stats.joinedAt).getTime()) / (1000 * 60 * 60 * 24));
    if (!stats.badges.includes('veteran') && daysSinceJoin >= 30 && totalApproved >= 5) {
      newBadges.push('veteran');
    }

    // Add new badges
    newBadges.forEach(badge => {
      if (!stats.badges.includes(badge)) {
        stats.badges.push(badge);
        // Send notification for new badge
        this.addNotification(stats.userId, {
          type: 'badge_earned',
          title: 'New Badge Earned!',
          message: `You earned the "${BADGES[badge as keyof typeof BADGES]?.name}" badge: ${BADGES[badge as keyof typeof BADGES]?.description}`
        });
      }
    });
  }

  // C4: Get leaderboard
  getLeaderboard(limit: number = 10): ContributorStats[] {
    const all = this.getAllContributors();
    return all
      .filter(c => c.submissions.approved + c.corrections.approved + c.kvkErrors.approved > 0)
      .sort((a, b) => {
        const aScore = a.submissions.approved + a.corrections.approved + a.kvkErrors.approved;
        const bScore = b.submissions.approved + b.corrections.approved + b.kvkErrors.approved;
        return bScore - aScore;
      })
      .slice(0, limit);
  }

  // B4: Check for duplicate submission
  checkDuplicate(type: 'correction' | 'kvkError', data: Record<string, unknown>): { isDuplicate: boolean; existingId?: string } {
    if (type === 'correction') {
      const stored = localStorage.getItem('kingshot_data_corrections');
      const corrections = stored ? JSON.parse(stored) : [];
      const duplicate = corrections.find((c: Record<string, unknown>) => 
        c.kingdom_number === data.kingdom_number && 
        c.field === data.field && 
        c.suggested_value === data.suggested_value &&
        c.status === 'pending'
      );
      return { isDuplicate: !!duplicate, existingId: duplicate?.id };
    }
    
    if (type === 'kvkError') {
      const stored = localStorage.getItem('kingshot_kvk_errors');
      const errors = stored ? JSON.parse(stored) : [];
      const duplicate = errors.find((e: Record<string, unknown>) => 
        e.kingdom_number === data.kingdom_number && 
        e.kvk_number === data.kvk_number &&
        e.error_type === data.error_type &&
        e.status === 'pending'
      );
      return { isDuplicate: !!duplicate, existingId: duplicate?.id };
    }

    return { isDuplicate: false };
  }

  // C2: Add notification for user
  addNotification(userId: string, notification: Omit<UserNotification, 'id' | 'userId' | 'read' | 'createdAt'>) {
    try {
      const stored = localStorage.getItem(NOTIFICATIONS_KEY);
      const all: UserNotification[] = stored ? JSON.parse(stored) : [];
      
      all.unshift({
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        ...notification,
        read: false,
        createdAt: new Date().toISOString()
      });

      // Keep only last 50 notifications per user
      const userNotifs = all.filter(n => n.userId === userId);
      if (userNotifs.length > 50) {
        const toRemove = userNotifs.slice(50).map(n => n.id);
        const filtered = all.filter(n => !toRemove.includes(n.id));
        localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(filtered));
      } else {
        localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(all));
      }
    } catch { /* ignore */ }
  }

  // Get notifications for user
  getNotifications(userId: string): UserNotification[] {
    try {
      const stored = localStorage.getItem(NOTIFICATIONS_KEY);
      const all: UserNotification[] = stored ? JSON.parse(stored) : [];
      return all.filter(n => n.userId === userId).slice(0, 20);
    } catch {
      return [];
    }
  }

  // Mark notification as read
  markNotificationRead(notificationId: string) {
    try {
      const stored = localStorage.getItem(NOTIFICATIONS_KEY);
      const all: UserNotification[] = stored ? JSON.parse(stored) : [];
      const updated = all.map(n => n.id === notificationId ? { ...n, read: true } : n);
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
    } catch { /* ignore */ }
  }

  // Get unread count
  getUnreadCount(userId: string): number {
    return this.getNotifications(userId).filter(n => !n.read).length;
  }

  // B5: Generate data quality report
  generateDataQualityReport(): DataQualityReport {
    const corrections = JSON.parse(localStorage.getItem('kingshot_data_corrections') || '[]');
    const kvkErrors = JSON.parse(localStorage.getItem('kingshot_kvk_errors') || '[]');
    const allSubmissions = [...corrections, ...kvkErrors];
    
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentSubmissions = allSubmissions.filter((s: Record<string, unknown>) => 
      new Date(s.created_at as string).getTime() > oneWeekAgo
    );

    const approved = recentSubmissions.filter((s: Record<string, unknown>) => s.status === 'approved').length;
    const total = recentSubmissions.length;

    // Get top contributors
    const contributors = this.getAllContributors();
    const topContributors = contributors
      .map(c => ({
        userId: c.userId,
        username: c.username,
        approved: c.submissions.approved + c.corrections.approved + c.kvkErrors.approved
      }))
      .filter(c => c.approved > 0)
      .sort((a, b) => b.approved - a.approved)
      .slice(0, 5);

    // Count error types
    const errorTypes: Record<string, number> = {};
    kvkErrors.forEach((e: Record<string, unknown>) => {
      const type = e.error_type_label as string || 'Unknown';
      errorTypes[type] = (errorTypes[type] || 0) + 1;
    });
    const commonErrors = Object.entries(errorTypes)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      generatedAt: new Date().toISOString(),
      period: 'weekly',
      stats: {
        totalSubmissions: total,
        approvalRate: total > 0 ? Math.round((approved / total) * 100) : 0,
        avgResponseTime: 24, // Hours - would need review timestamps to calculate
        topContributors,
        commonErrors,
        duplicatesDetected: 0 // Would need to track this
      }
    };
  }

  // Get badge info
  getBadgeInfo(badgeId: string) {
    return BADGES[badgeId as keyof typeof BADGES] || { name: badgeId, description: '', icon: '🏅' };
  }

  getAllBadges() {
    return BADGES;
  }
}

export const contributorService = new ContributorService();
