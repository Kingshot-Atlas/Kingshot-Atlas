import React from 'react';

interface DataAttributionProps {
  submittedBy?: string;
  submittedAt?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  source?: 'user' | 'api' | 'import' | 'manual';
  compact?: boolean;
}

const DataAttribution: React.FC<DataAttributionProps> = ({
  submittedBy,
  submittedAt,
  verifiedBy,
  verifiedAt,
  source = 'api',
  compact = false
}) => {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getSourceIcon = () => {
    switch (source) {
      case 'user': return '👤';
      case 'import': return '📤';
      case 'manual': return '✏️';
      default: return '🔄';
    }
  };

  const getSourceLabel = () => {
    switch (source) {
      case 'user': return 'User submitted';
      case 'import': return 'Bulk import';
      case 'manual': return 'Admin entry';
      default: return 'System data';
    }
  };

  if (compact) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '0.7rem',
        color: '#6b7280'
      }}>
        <span>{getSourceIcon()}</span>
        {submittedBy && <span>by {submittedBy}</span>}
        {submittedAt && <span>• {formatDate(submittedAt)}</span>}
        {verifiedBy && (
          <span style={{ color: '#22c55e' }}>
            ✓ Verified
          </span>
        )}
      </div>
    );
  }

  return (
    <div style={{
      padding: '0.75rem',
      backgroundColor: '#0a0a0a',
      borderRadius: '8px',
      border: '1px solid #1f1f1f',
      fontSize: '0.8rem'
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '0.5rem'
      }}>
        <span style={{ color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span>{getSourceIcon()}</span>
          {getSourceLabel()}
        </span>
        {verifiedBy && (
          <span style={{ 
            padding: '0.15rem 0.5rem',
            backgroundColor: '#22c55e15',
            border: '1px solid #22c55e30',
            borderRadius: '4px',
            color: '#22c55e',
            fontSize: '0.7rem',
            fontWeight: '500'
          }}>
            ✓ Verified
          </span>
        )}
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {submittedBy && (
          <div style={{ color: '#6b7280' }}>
            <span>Submitted by </span>
            <span style={{ color: '#22d3ee' }}>{submittedBy}</span>
            {submittedAt && <span> • {formatDate(submittedAt)}</span>}
          </div>
        )}
        {verifiedBy && (
          <div style={{ color: '#6b7280' }}>
            <span>Verified by </span>
            <span style={{ color: '#22c55e' }}>{verifiedBy}</span>
            {verifiedAt && <span> • {formatDate(verifiedAt)}</span>}
          </div>
        )}
      </div>
    </div>
  );
};

export default DataAttribution;
