import React from 'react';
import { Kingdom } from '../types';
import SmartTooltip from './shared/SmartTooltip';

interface AchievementBadgesProps {
  kingdom: Kingdom;
  compact?: boolean;
}

interface Achievement {
  id: string;
  icon: string;
  title: string;
  description: string;
  color: string;
  check: (k: Kingdom) => boolean;
}

const achievements: Achievement[] = [
  {
    id: 'undefeated_prep',
    icon: '🛡️',
    title: 'Prep Master',
    description: 'Undefeated in Preparation Phase (0 losses)',
    color: '#eab308',
    check: (k) => k.prep_losses === 0 && k.prep_wins > 0
  },
  {
    id: 'undefeated_battle',
    icon: '⚔️',
    title: 'Battle Legend',
    description: 'Undefeated in Battle Phase (0 losses)',
    color: '#3b82f6',
    check: (k) => k.battle_losses === 0 && k.battle_wins > 0
  },
  {
    id: 'undefeated_overall',
    icon: '👑',
    title: 'Supreme Ruler',
    description: 'Undefeated overall - never lost a KvK',
    color: '#fbbf24',
    check: (k) => k.prep_losses === 0 && k.battle_losses === 0 && k.total_kvks > 0
  }
];

const AchievementBadges: React.FC<AchievementBadgesProps> = ({ kingdom, compact = false }) => {
  const earned = achievements.filter(a => a.check(kingdom));
  
  if (earned.length === 0) return null;

  return (
    <div style={{ 
      display: 'flex', 
      gap: compact ? '0.25rem' : '0.5rem', 
      flexWrap: 'wrap',
      alignItems: 'center'
    }}>
      {earned.map(achievement => (
        <SmartTooltip
          key={achievement.id}
          accentColor={achievement.color}
          content={
            <div style={{ fontSize: '0.7rem' }}>
              <div style={{ color: achievement.color, fontWeight: 'bold', marginBottom: '2px' }}>{achievement.title}</div>
              <div style={{ color: '#9ca3af' }}>{achievement.description}</div>
            </div>
          }
        >
          <span
            style={{
              fontSize: compact ? '0.9rem' : '1.1rem',
              cursor: 'default',
              filter: `drop-shadow(0 0 4px ${achievement.color}60)`,
              transition: 'transform 0.2s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            {achievement.icon}
          </span>
        </SmartTooltip>
      ))}
    </div>
  );
};

export default AchievementBadges;
