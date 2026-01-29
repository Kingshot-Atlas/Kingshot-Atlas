import React, { useState } from 'react';
import { Kingdom } from '../types';
import { useIsMobile } from '../hooks/useMediaQuery';

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
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const earned = achievements.filter(a => a.check(kingdom));
  
  if (earned.length === 0) return null;

  const handleTooltipToggle = (id: string) => {
    setActiveTooltip(prev => prev === id ? null : id);
  };

  return (
    <div style={{ 
      display: 'flex', 
      gap: compact ? '0.25rem' : '0.5rem', 
      flexWrap: 'wrap',
      alignItems: 'center'
    }}>
      {earned.map(achievement => (
        <span
          key={achievement.id}
          style={{
            fontSize: compact ? '0.9rem' : '1.1rem',
            cursor: 'default',
            filter: `drop-shadow(0 0 4px ${achievement.color}60)`,
            transition: 'transform 0.2s ease',
            position: 'relative'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.2)';
            if (!isMobile) setActiveTooltip(achievement.id);
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            if (!isMobile) setActiveTooltip(null);
          }}
          onClick={() => isMobile && handleTooltipToggle(achievement.id)}
        >
          {achievement.icon}
          {activeTooltip === achievement.id && (
            <div style={{
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: '8px',
              backgroundColor: '#0a0a0a',
              border: `1px solid ${achievement.color}`,
              borderRadius: '8px',
              padding: '0.5rem 0.7rem',
              whiteSpace: 'nowrap',
              zIndex: 100,
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
            }}>
              <div style={{ color: achievement.color, fontWeight: 'bold', fontSize: '0.75rem', marginBottom: '3px' }}>
                {achievement.title}
              </div>
              <div style={{ color: '#9ca3af', fontSize: '0.65rem' }}>
                {achievement.description}
              </div>
            </div>
          )}
        </span>
      ))}
    </div>
  );
};

export default AchievementBadges;
