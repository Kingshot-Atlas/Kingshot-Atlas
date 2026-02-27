import React from 'react';
import { useTranslation } from 'react-i18next';

const EndorsementProgress: React.FC<{
  current: number;
  required: number;
}> = ({ current, required }) => {
  const { t } = useTranslation();
  const pct = Math.min(100, (current / required) * 100);
  const isComplete = current >= required;

  const getMilestone = () => {
    if (pct >= 100) return { emoji: '🎉', label: t('editor.activated', 'Activated!'), color: '#22c55e' };
    if (pct >= 75) return { emoji: '🔥', label: t('editor.almostThere', 'Almost there!'), color: '#f97316' };
    if (pct >= 50) return { emoji: '⚡', label: t('editor.halfway', 'Halfway!'), color: '#eab308' };
    if (pct >= 25) return { emoji: '🚀', label: t('editor.gainingMomentum', 'Gaining momentum'), color: '#22d3ee' };
    return null;
  };
  const milestone = getMilestone();

  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '0.35rem',
      }}>
        <span style={{ color: '#9ca3af', fontSize: '0.7rem' }}>
          {t('editor.endorsements', 'Endorsements')}
          {milestone && (
            <span style={{ marginLeft: '0.4rem', color: milestone.color, fontWeight: 600 }}>
              {milestone.emoji} {milestone.label}
            </span>
          )}
        </span>
        <span style={{
          color: isComplete ? '#22c55e' : '#eab308',
          fontSize: '0.75rem',
          fontWeight: '600',
        }}>
          {current}/{required}
        </span>
      </div>
      <div style={{
        height: '6px',
        backgroundColor: '#1a1a1a',
        borderRadius: '3px',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          backgroundColor: isComplete ? '#22c55e' : milestone?.color || '#eab308',
          borderRadius: '3px',
          transition: 'width 0.5s ease',
          ...(pct >= 75 && !isComplete ? { boxShadow: `0 0 8px ${milestone?.color || '#f97316'}60` } : {}),
        }} />
      </div>
    </div>
  );
};

export default EndorsementProgress;
