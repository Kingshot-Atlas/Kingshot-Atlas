import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import SmartTooltip from './shared/SmartTooltip';

interface UserStats {
  reviewsWritten: number;
  kingdomsCompared: number;
  kingdomsViewed: number;
  favoritesSaved: number;
  linksShared: number;
  dataSubmissions: number;
  correctionsApproved: number;
  daysActive: number;
  leaderboardViews: number;
}

type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';

const RARITY_COLORS: Record<Rarity, string> = {
  Common: '#9ca3af',
  Uncommon: '#22c55e',
  Rare: '#3b82f6',
  Epic: '#a855f7',
  Legendary: '#fbbf24',
};

interface UserAchievement {
  id: string;
  icon: string;
  title: string;
  description: string;
  color: string;
  requirement: number;
  rarity: Rarity;
  check: (stats: UserStats) => number;
}

const USER_STATS_KEY = 'kingshot_user_stats';
const LAST_ACTIVE_DAY_KEY = 'kingshot_last_active_day';
const EARNED_ACHIEVEMENTS_KEY = 'kingshot_earned_achievements';

const userAchievements: UserAchievement[] = [
  {
    id: 'first_review',
    icon: '✍️',
    title: 'First Words',
    description: 'Write your first kingdom review',
    color: '#a855f7',
    requirement: 1,
    rarity: 'Common',
    check: (s) => s.reviewsWritten
  },
  {
    id: 'reviewer',
    icon: '📝',
    title: 'Reviewer',
    description: 'Write 5 kingdom reviews',
    color: '#a855f7',
    requirement: 5,
    rarity: 'Uncommon',
    check: (s) => s.reviewsWritten
  },
  {
    id: 'compare_novice',
    icon: '⚖️',
    title: 'Analyst',
    description: 'Compare 10 kingdoms',
    color: '#22d3ee',
    requirement: 10,
    rarity: 'Uncommon',
    check: (s) => s.kingdomsCompared
  },
  {
    id: 'explorer',
    icon: '🔍',
    title: 'Explorer',
    description: 'View 25 different kingdoms',
    color: '#22c55e',
    requirement: 25,
    rarity: 'Rare',
    check: (s) => s.kingdomsViewed
  },
  {
    id: 'collector',
    icon: '⭐',
    title: 'Collector',
    description: 'Save 10 favorites',
    color: '#fbbf24',
    requirement: 10,
    rarity: 'Uncommon',
    check: (s) => s.favoritesSaved
  },
  {
    id: 'sharer',
    icon: '🔗',
    title: 'Networker',
    description: 'Share 5 kingdom links',
    color: '#3b82f6',
    requirement: 5,
    rarity: 'Uncommon',
    check: (s) => s.linksShared
  },
  {
    id: 'contributor',
    icon: '📊',
    title: 'Contributor',
    description: 'Submit 3 KvK results',
    color: '#f97316',
    requirement: 3,
    rarity: 'Rare',
    check: (s) => s.dataSubmissions
  },
  {
    id: 'data_hero',
    icon: '🦸',
    title: 'Data Hero',
    description: 'Have 5 corrections approved',
    color: '#ec4899',
    requirement: 5,
    rarity: 'Epic',
    check: (s) => s.correctionsApproved
  },
  {
    id: 'dedicated',
    icon: '📅',
    title: 'Dedicated',
    description: 'Active for 7 days',
    color: '#14b8a6',
    requirement: 7,
    rarity: 'Rare',
    check: (s) => s.daysActive
  },
  {
    id: 'leaderboard_watcher',
    icon: '📈',
    title: 'Rankings Expert',
    description: 'View leaderboards 10 times',
    color: '#6366f1',
    requirement: 10,
    rarity: 'Uncommon',
    check: (s) => s.leaderboardViews
  },
  {
    id: 'veteran_explorer',
    icon: '🗺️',
    title: 'Veteran Explorer',
    description: 'View 100 different kingdoms',
    color: '#22c55e',
    requirement: 100,
    rarity: 'Epic',
    check: (s) => s.kingdomsViewed
  },
  {
    id: 'super_contributor',
    icon: '🏅',
    title: 'Super Contributor',
    description: 'Submit 10 KvK results',
    color: '#fbbf24',
    requirement: 10,
    rarity: 'Legendary',
    check: (s) => s.dataSubmissions
  }
];

export { userAchievements };

export const getStats = (): UserStats => {
  const stored = localStorage.getItem(USER_STATS_KEY);
  const defaults: UserStats = {
    reviewsWritten: 0,
    kingdomsCompared: 0,
    kingdomsViewed: 0,
    favoritesSaved: 0,
    linksShared: 0,
    dataSubmissions: 0,
    correctionsApproved: 0,
    daysActive: 0,
    leaderboardViews: 0
  };
  return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
};

export const incrementStat = (key: keyof UserStats, amount: number = 1) => {
  const stats = getStats();
  stats[key] += amount;
  localStorage.setItem(USER_STATS_KEY, JSON.stringify(stats));
  // Fire custom event so components re-render (storage event only fires cross-tab)
  window.dispatchEvent(new CustomEvent('achievement-stat-update'));
  // Debounced Supabase sync
  scheduleSyncToSupabase(stats);
};

/** Track daily active usage (once per calendar day) */
export const trackDailyActive = () => {
  const today = new Date().toISOString().slice(0, 10);
  const lastDay = localStorage.getItem(LAST_ACTIVE_DAY_KEY);
  if (lastDay !== today) {
    localStorage.setItem(LAST_ACTIVE_DAY_KEY, today);
    incrementStat('daysActive');
  }
};

// --- Supabase sync (debounced, fire-and-forget) ---
let syncTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSyncToSupabase(stats: UserStats) {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try {
      const { supabase, isSupabaseConfigured } = await import('../lib/supabase');
      if (!isSupabaseConfigured || !supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // Merge into user_data.settings.achievements
      const { data: existing } = await supabase
        .from('user_data')
        .select('settings')
        .eq('user_id', user.id)
        .maybeSingle();
      const currentSettings = (existing?.settings as Record<string, unknown>) || {};
      await supabase
        .from('user_data')
        .update({ settings: { ...currentSettings, achievements: stats } })
        .eq('user_id', user.id);
    } catch {
      // Silent fail — localStorage is always the fast path
    }
  }, 3000); // 3s debounce
}

/** Hydrate localStorage stats from Supabase (called on login) */
export const hydrateFromSupabase = async () => {
  try {
    const { supabase, isSupabaseConfigured } = await import('../lib/supabase');
    if (!isSupabaseConfigured || !supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('user_data')
      .select('settings')
      .eq('user_id', user.id)
      .maybeSingle();
    const cloudStats = (data?.settings as Record<string, unknown>)?.achievements as UserStats | undefined;
    if (cloudStats) {
      // Merge: take the max of local and cloud for each stat (never lose progress)
      const localStats = getStats();
      const merged: UserStats = { ...localStats };
      for (const key of Object.keys(localStats) as (keyof UserStats)[]) {
        merged[key] = Math.max(localStats[key] || 0, cloudStats[key] || 0);
      }
      localStorage.setItem(USER_STATS_KEY, JSON.stringify(merged));
    }
  } catch {
    // Silent fail
  }
};

/** Get previously earned achievement IDs (for unlock detection) */
function getPreviouslyEarned(): Set<string> {
  try {
    const stored = localStorage.getItem(EARNED_ACHIEVEMENTS_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

/** Save current earned achievement IDs */
function saveEarned(ids: string[]) {
  localStorage.setItem(EARNED_ACHIEVEMENTS_KEY, JSON.stringify(ids));
}

// --- Achievement Unlock Toast ---
interface UnlockToastProps {
  achievement: UserAchievement;
  onDismiss: () => void;
}

const UnlockToast: React.FC<UnlockToastProps> = ({ achievement, onDismiss }) => {
  const { t } = useTranslation();
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div style={{
      position: 'fixed',
      bottom: '2rem',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 10000,
      animation: 'achievementSlideUp 0.5s ease-out, achievementFadeOut 0.5s ease-in 4.5s',
      pointerEvents: 'auto',
    }}>
      <style>{`
        @keyframes achievementSlideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(30px) scale(0.9); }
          to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
        @keyframes achievementFadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes achievementShine {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
      `}</style>
      <div
        onClick={onDismiss}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.75rem 1.25rem',
          backgroundColor: '#1a1a2e',
          border: `2px solid ${achievement.color}60`,
          borderRadius: '12px',
          boxShadow: `0 8px 32px ${achievement.color}30, 0 0 60px ${achievement.color}15`,
          cursor: 'pointer',
          backgroundImage: `linear-gradient(90deg, transparent, ${achievement.color}10, transparent)`,
          backgroundSize: '200% 100%',
          animation: 'achievementSlideUp 0.5s ease-out, achievementShine 2s linear infinite',
        }}
      >
        <span style={{ fontSize: '1.5rem', filter: `drop-shadow(0 0 8px ${achievement.color})` }}>
          {achievement.icon}
        </span>
        <div>
          <div style={{ fontSize: '0.65rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {t('achievements.achievementUnlocked')}
          </div>
          <div style={{ color: achievement.color, fontWeight: '700', fontSize: '0.95rem' }}>
            {achievement.title}
          </div>
          <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
            {achievement.description}
          </div>
        </div>
      </div>
    </div>
  );
};

const UserAchievements: React.FC = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<UserStats>(getStats());
  const [showAll, setShowAll] = useState(false);
  const [newUnlock, setNewUnlock] = useState<UserAchievement | null>(null);
  const previousEarnedRef = useRef<Set<string>>(getPreviouslyEarned());

  // Track daily active on mount
  useEffect(() => {
    trackDailyActive();
  }, []);

  // Listen for stat updates (both cross-tab and same-tab)
  useEffect(() => {
    const handleUpdate = () => setStats(getStats());
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('achievement-stat-update', handleUpdate);
    return () => {
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('achievement-stat-update', handleUpdate);
    };
  }, []);

  // Hydrate from Supabase on mount
  useEffect(() => {
    hydrateFromSupabase().then(() => setStats(getStats()));
  }, []);

  // Detect newly unlocked achievements
  useEffect(() => {
    const currentEarned = userAchievements.filter(a => a.check(stats) >= a.requirement);
    const currentIds = currentEarned.map(a => a.id);
    const prev = previousEarnedRef.current;

    for (const a of currentEarned) {
      if (!prev.has(a.id)) {
        setNewUnlock(a);
        break; // Show one at a time
      }
    }

    previousEarnedRef.current = new Set(currentIds);
    saveEarned(currentIds);
  }, [stats]);

  const dismissUnlock = useCallback(() => setNewUnlock(null), []);

  const earned = userAchievements.filter(a => a.check(stats) >= a.requirement);
  const inProgress = userAchievements.filter(a => a.check(stats) < a.requirement);

  return (
    <div style={{
      backgroundColor: '#111111',
      borderRadius: '12px',
      padding: '1.25rem',
      border: '1px solid #2a2a2a'
    }}>
      <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem', textAlign: 'center' }}>
        {t('achievements.yourAchievements')}
        <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 'normal', marginLeft: '0.5rem' }}>
          ({earned.length}/{userAchievements.length})
        </span>
      </h3>

      {/* Earned */}
      {earned.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
          {earned.map(a => (
            <SmartTooltip
              key={a.id}
              accentColor={a.color}
              maxWidth={200}
              content={
                <div style={{ fontSize: '0.7rem' }}>
                  <div style={{ color: a.color, fontWeight: 'bold', marginBottom: '2px' }}>{a.title} ✓</div>
                  <div style={{ color: '#9ca3af', lineHeight: 1.4 }}>{a.description}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '3px' }}>
                    <span style={{ color: '#22c55e', fontSize: '0.65rem', fontWeight: '500' }}>Achievement Unlocked!</span>
                    <span style={{ fontSize: '0.6rem', color: RARITY_COLORS[a.rarity], fontWeight: '600' }}>{a.rarity}</span>
                  </div>
                </div>
              }
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.4rem 0.6rem',
                  backgroundColor: `${a.color}15`,
                  border: `1px solid ${a.color}30`,
                  borderRadius: '8px',
                  cursor: 'default'
                }}
              >
                <span style={{ fontSize: '1rem' }}>{a.icon}</span>
                <span style={{ fontSize: '0.75rem', color: a.color, fontWeight: '600' }}>{a.title}</span>
              </div>
            </SmartTooltip>
          ))}
        </div>
      )}

      {/* In Progress */}
      {showAll && inProgress.length > 0 && (
        <div style={{ marginTop: '0.75rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>{t('achievements.inProgress')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {inProgress.map(a => {
              const progress = a.check(stats);
              const percent = Math.min(100, (progress / a.requirement) * 100);
              return (
                <SmartTooltip
                  key={a.id}
                  accentColor={a.color}
                  maxWidth={220}
                  content={
                    <div style={{ fontSize: '0.7rem' }}>
                      <div style={{ color: '#fff', fontWeight: 'bold', marginBottom: '2px' }}>{a.icon} {a.title}</div>
                      <div style={{ color: '#9ca3af', lineHeight: 1.4, marginBottom: '3px' }}>{a.description}</div>
                      <div style={{ color: a.color, fontWeight: '500' }}>Progress: {progress}/{a.requirement} ({Math.round(percent)}%)</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                        <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>{a.requirement - progress} more to unlock</span>
                        <span style={{ fontSize: '0.6rem', color: RARITY_COLORS[a.rarity], fontWeight: '600' }}>{a.rarity}</span>
                      </div>
                    </div>
                  }
                  style={{ display: 'flex', width: '100%' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
                    <span style={{ fontSize: '0.9rem', opacity: 0.5, cursor: 'default' }}>{a.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: '0.15rem' }}>
                        {a.title} ({progress}/{a.requirement})
                      </div>
                      <div style={{ height: '4px', backgroundColor: '#2a2a2a', borderRadius: '2px' }}>
                        <div style={{ height: '100%', width: `${percent}%`, backgroundColor: a.color, borderRadius: '2px', opacity: 0.6 }} />
                      </div>
                    </div>
                  </div>
                </SmartTooltip>
              );
            })}
          </div>
        </div>
      )}

      <button
        onClick={() => setShowAll(!showAll)}
        style={{
          width: '100%',
          padding: '0.5rem',
          marginTop: '0.75rem',
          backgroundColor: 'transparent',
          border: '1px solid #2a2a2a',
          borderRadius: '6px',
          color: '#6b7280',
          fontSize: '0.8rem',
          cursor: 'pointer'
        }}
      >
        {showAll ? t('achievements.hideProgress') : t('achievements.showAll')}
      </button>

      {/* Unlock Toast */}
      {newUnlock && <UnlockToast achievement={newUnlock} onDismiss={dismissUnlock} />}
    </div>
  );
};

export default UserAchievements;
