import React, { useState, useEffect } from 'react';
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

interface UserAchievement {
  id: string;
  icon: string;
  title: string;
  description: string;
  color: string;
  requirement: number;
  check: (stats: UserStats) => number;
}

const USER_STATS_KEY = 'kingshot_user_stats';

const userAchievements: UserAchievement[] = [
  {
    id: 'first_review',
    icon: '✍️',
    title: 'First Words',
    description: 'Write your first kingdom review',
    color: '#a855f7',
    requirement: 1,
    check: (s) => s.reviewsWritten
  },
  {
    id: 'reviewer',
    icon: '📝',
    title: 'Reviewer',
    description: 'Write 5 kingdom reviews',
    color: '#a855f7',
    requirement: 5,
    check: (s) => s.reviewsWritten
  },
  {
    id: 'compare_novice',
    icon: '⚖️',
    title: 'Analyst',
    description: 'Compare 10 kingdoms',
    color: '#22d3ee',
    requirement: 10,
    check: (s) => s.kingdomsCompared
  },
  {
    id: 'explorer',
    icon: '🔍',
    title: 'Explorer',
    description: 'View 25 different kingdoms',
    color: '#22c55e',
    requirement: 25,
    check: (s) => s.kingdomsViewed
  },
  {
    id: 'collector',
    icon: '⭐',
    title: 'Collector',
    description: 'Save 10 favorites',
    color: '#fbbf24',
    requirement: 10,
    check: (s) => s.favoritesSaved
  },
  {
    id: 'sharer',
    icon: '🔗',
    title: 'Networker',
    description: 'Share 5 kingdom links',
    color: '#3b82f6',
    requirement: 5,
    check: (s) => s.linksShared
  },
  {
    id: 'contributor',
    icon: '📊',
    title: 'Contributor',
    description: 'Submit 3 KvK results',
    color: '#f97316',
    requirement: 3,
    check: (s) => s.dataSubmissions
  },
  {
    id: 'data_hero',
    icon: '🦸',
    title: 'Data Hero',
    description: 'Have 5 corrections approved',
    color: '#ec4899',
    requirement: 5,
    check: (s) => s.correctionsApproved
  },
  {
    id: 'dedicated',
    icon: '📅',
    title: 'Dedicated',
    description: 'Active for 7 days',
    color: '#14b8a6',
    requirement: 7,
    check: (s) => s.daysActive
  },
  {
    id: 'leaderboard_watcher',
    icon: '📈',
    title: 'Rankings Expert',
    description: 'View leaderboards 10 times',
    color: '#6366f1',
    requirement: 10,
    check: (s) => s.leaderboardViews
  },
  {
    id: 'veteran_explorer',
    icon: '🗺️',
    title: 'Veteran Explorer',
    description: 'View 100 different kingdoms',
    color: '#22c55e',
    requirement: 100,
    check: (s) => s.kingdomsViewed
  },
  {
    id: 'super_contributor',
    icon: '🏅',
    title: 'Super Contributor',
    description: 'Submit 10 KvK results',
    color: '#fbbf24',
    requirement: 10,
    check: (s) => s.dataSubmissions
  }
];

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
};

const UserAchievements: React.FC = () => {
  const [stats, setStats] = useState<UserStats>(getStats());
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const handleStorage = () => setStats(getStats());
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const earned = userAchievements.filter(a => a.check(stats) >= a.requirement);
  const inProgress = userAchievements.filter(a => a.check(stats) < a.requirement);

  return (
    <div style={{
      backgroundColor: '#111111',
      borderRadius: '12px',
      padding: '1.25rem',
      border: '1px solid #2a2a2a'
    }}>
      <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span>🏆</span> Your Achievements
        <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 'normal' }}>
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
                  <div style={{ color: '#22c55e', fontSize: '0.65rem', marginTop: '3px', fontWeight: '500' }}>Achievement Unlocked!</div>
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
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>In Progress</div>
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
                      <div style={{ color: '#6b7280', fontSize: '0.65rem', marginTop: '2px' }}>{a.requirement - progress} more to unlock</div>
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
        {showAll ? 'Hide progress' : 'Show all achievements'}
      </button>
    </div>
  );
};

export default UserAchievements;
