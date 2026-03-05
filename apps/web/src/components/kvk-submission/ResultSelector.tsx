import React from 'react';

interface ResultSelectorProps {
  label: string;
  labelColor: string;
  value: 'W' | 'L' | null;
  onChange: (result: 'W' | 'L') => void;
}

const ResultSelector: React.FC<ResultSelectorProps> = ({
  label,
  labelColor,
  value,
  onChange,
}) => {
  return (
    <div>
      <label style={{ display: 'block', color: labelColor, fontSize: '0.75rem', marginBottom: '0.35rem' }}>{label} *</label>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {(['W', 'L'] as const).map(result => (
          <button
            key={result}
            type="button"
            onClick={() => onChange(result)}
            style={{
              flex: 1,
              padding: '0.6rem',
              backgroundColor: value === result 
                ? (result === 'W' ? '#22c55e20' : '#ef444420')
                : '#0a0a0a',
              border: `1px solid ${value === result 
                ? (result === 'W' ? '#22c55e' : '#ef4444')
                : '#2a2a2a'}`,
              borderRadius: '6px',
              color: value === result 
                ? (result === 'W' ? '#22c55e' : '#ef4444')
                : '#6b7280',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.9rem'
            }}
          >
            {result === 'W' ? 'Win' : 'Loss'}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ResultSelector;
