import React, { memo } from 'react';
import { Kingdom } from '../../types';
import SmartTooltip from '../shared/SmartTooltip';

interface Achievement {
  icon: string;
  title: string;
  desc: string;
  color: string;
}

interface AchievementBadgesProps {
  kingdom: Kingdom;
}

export const getAchievements = (kingdom: Kingdom): Achievement[] => {
  const achievements: Achievement[] = [];
  const isSupremeRuler = kingdom.prep_losses === 0 && kingdom.battle_losses === 0 && kingdom.total_kvks > 0;
  const isPrepMaster = kingdom.prep_losses === 0 && kingdom.prep_wins > 0;
  const isBattleLegend = kingdom.battle_losses === 0 && kingdom.battle_wins > 0;
  
  if (isSupremeRuler) {
    achievements.push({ icon: '👑', title: 'Supreme Ruler', desc: 'Undefeated overall - never lost a KvK', color: '#fbbf24' });
  } else {
    if (isPrepMaster) achievements.push({ icon: '🛡️', title: 'Prep Master', desc: 'Undefeated in Preparation Phase', color: '#eab308' });
    if (isBattleLegend) achievements.push({ icon: '⚔️', title: 'Battle Legend', desc: 'Undefeated in Battle Phase', color: '#f97316' });
  }
  
  const prepBestStreak = kingdom.prep_best_streak ?? 0;
  const battleBestStreak = kingdom.battle_best_streak ?? 0;
  const maxBestStreak = Math.max(prepBestStreak, battleBestStreak);
  
  if (maxBestStreak >= 10) {
    achievements.push({ icon: '🔥', title: 'Unstoppable', desc: `${maxBestStreak} win streak record`, color: '#ef4444' });
  } else if (maxBestStreak >= 7) {
    achievements.push({ icon: '⚡', title: 'Dominant', desc: `${maxBestStreak} win streak record`, color: '#f97316' });
  } else if (maxBestStreak >= 5) {
    achievements.push({ icon: '💪', title: 'On Fire', desc: `${maxBestStreak} win streak record`, color: '#eab308' });
  }
  
  return achievements.slice(0, 5);
};

const AchievementBadges: React.FC<AchievementBadgesProps> = ({ kingdom }) => {
  const achievements = getAchievements(kingdom);

  if (achievements.length === 0) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
      {achievements.map((a, i) => (
        <SmartTooltip
          key={i}
          accentColor={a.color}
          maxWidth={200}
          content={
            <div>
              <span style={{ color: a.color, fontWeight: 'bold', fontSize: '0.75rem' }}>{a.title}</span>
              <span style={{ color: '#9ca3af', fontSize: '0.7rem', marginLeft: '0.3rem' }}>{a.desc}</span>
            </div>
          }
        >
          <span 
            style={{ 
              fontSize: '1rem', 
              cursor: 'default', 
              filter: `drop-shadow(0 0 4px ${a.color}60)` 
            }}
          >
            {a.icon}
          </span>
        </SmartTooltip>
      ))}
    </div>
  );
};

export default memo(AchievementBadges);
