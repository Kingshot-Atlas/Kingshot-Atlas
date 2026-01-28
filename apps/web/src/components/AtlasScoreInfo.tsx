import React, { useState } from 'react';

interface AtlasScoreInfoProps {
  inline?: boolean;
}

const AtlasScoreInfo: React.FC<AtlasScoreInfoProps> = ({ inline = false }) => {
  const [showTooltip, setShowTooltip] = useState(false);

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
        Atlas Score
      </div>
      <p style={{ color: '#9ca3af', fontSize: '0.7rem', lineHeight: 1.4, marginBottom: '0.5rem' }}>
        Skill-based rating. More wins = higher score.
      </p>
      <div style={{ 
        backgroundColor: '#111111', 
        padding: '0.5rem', 
        borderRadius: '6px', 
        fontFamily: 'monospace',
        fontSize: '0.6rem'
      }}>
        <div><span style={{ color: '#eab308' }}>Prep</span> + <span style={{ color: '#3b82f6' }}>Battle</span> wins weighted</div>
        <div><span style={{ color: '#22c55e' }}>+HK bonus</span> · <span style={{ color: '#ef4444' }}>−IK penalty</span></div>
      </div>
    </div>
  );

  if (inline) {
    return content;
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0.25rem',
          display: 'inline-flex',
          alignItems: 'center',
          color: '#6b7280'
        }}
        title="How is Atlas Score calculated?"
      >
        <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {showTooltip && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: '8px',
          animation: 'fadeIn 0.2s ease'
        }}>
          {content}
          <div style={{
            position: 'absolute',
            bottom: '-6px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderTop: '8px solid #22d3ee'
          }} />
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(-50%) translateY(5px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default AtlasScoreInfo;
