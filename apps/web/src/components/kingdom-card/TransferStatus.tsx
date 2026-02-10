import React, { memo } from 'react';
import { getStatusColor } from '../../utils/styles';
import SmartTooltip from '../shared/SmartTooltip';

interface TransferStatusProps {
  status: string;
  lastUpdated?: string;
  onSubmitStatus?: () => void;
}

const getStatusDescription = (status: string) => {
  switch (status) {
    case 'Leading': return '20 regular invites, 10 open slots, lower power cap';
    case 'Ordinary': return '35 regular invites, up to 3 special invites, 20 open slots, higher power cap';
    default: return 'Not yet reported';
  }
};

const TransferStatus: React.FC<TransferStatusProps> = ({ status, onSubmitStatus }) => {
  const statusColor = status === 'Unannounced' ? '#6b7280' : getStatusColor(status);
  const isUnannounced = status === 'Unannounced';
  const accentColor = isUnannounced ? '#4a4a4a' : statusColor;

  const tooltipContent = (
    <div style={{ fontSize: '0.7rem' }}>
      <span style={{ color: isUnannounced ? '#9ca3af' : statusColor, fontWeight: 'bold' }}>
        {isUnannounced ? 'Unknown' : status}
      </span>
      <span style={{ color: '#9ca3af', marginLeft: '0.3rem' }}>
        — {getStatusDescription(status)}
      </span>
      {isUnannounced && onSubmitStatus && (
        <div style={{ color: '#22d3ee', fontSize: '0.65rem', marginTop: '0.2rem' }}>Tap to submit</div>
      )}
    </div>
  );

  return (
    <SmartTooltip
      accentColor={accentColor}
      maxWidth={200}
      content={tooltipContent}
    >
      <div 
        style={{ fontSize: '0.7rem', cursor: isUnannounced && onSubmitStatus ? 'pointer' : 'default' }}
        onClick={isUnannounced && onSubmitStatus ? onSubmitStatus : undefined}
      >
        <span style={{ color: '#6b7280', marginRight: '0.25rem' }}>Transfer Status:</span>
        <span style={{ 
          padding: '0.25rem 0.5rem',
          borderRadius: '4px',
          backgroundColor: isUnannounced ? '#6b728015' : `${statusColor}15`,
          color: statusColor,
          fontWeight: '500',
          ...(isUnannounced && onSubmitStatus ? { 
            borderBottom: '1px dashed #6b728060',
          } : {}),
        }}>
          {status}
        </span>
      </div>
    </SmartTooltip>
  );
};

export default memo(TransferStatus);
