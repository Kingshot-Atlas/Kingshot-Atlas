import React from 'react';
import SmartTooltip from './shared/SmartTooltip';
import { useTranslation } from 'react-i18next';

interface AtlasScoreInfoProps {
  inline?: boolean;
}

const AtlasScoreInfo: React.FC<AtlasScoreInfoProps> = ({ inline = false }) => {
  const { t } = useTranslation();
  const neonGlow = (color: string) => ({
    color: color,
    textShadow: `0 0 8px ${color}40, 0 0 12px ${color}20`
  });

  const content = (
    <div style={{
      backgroundColor: '#0a0a0a',
      border: '1px solid #22d3ee',
      borderRadius: '10px',
      padding: '0.875rem',
      width: '240px',
      boxShadow: '0 8px 30px rgba(34, 211, 238, 0.2)',
      zIndex: 1000
    }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.5rem', ...neonGlow('#22d3ee') }}>
        {t('atlasScoreInfo.title', 'Atlas Score')}
      </div>
      <p style={{ color: '#9ca3af', fontSize: '0.7rem', lineHeight: 1.4, marginBottom: '0.5rem' }}>
        {t('atlasScoreInfo.description', 'Bayesian rating. Experience matters. No more lucky newcomers.')}
      </p>
      <div style={{ 
        backgroundColor: '#111111', 
        padding: '0.5rem', 
        borderRadius: '6px', 
        fontFamily: 'monospace',
        fontSize: '0.6rem'
      }}>
        <div><span style={{ color: '#eab308' }}>Bayesian win rates</span> · <span style={{ color: '#3b82f6' }}>Experience scaled</span></div>
        <div><span style={{ color: '#22c55e' }}>+Domination bonus</span> · <span style={{ color: '#ef4444' }}>−Invasion penalty</span></div>
      </div>
    </div>
  );

  if (inline) {
    return content;
  }

  return (
    <SmartTooltip
      accentColor="#22d3ee"
      maxWidth={260}
      content={content}
    >
      <button
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0.25rem',
          display: 'inline-flex',
          alignItems: 'center',
          color: '#6b7280'
        }}
        aria-label="How is Atlas Score calculated?"
      >
        <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
    </SmartTooltip>
  );
};

export default AtlasScoreInfo;
