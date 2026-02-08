import React, { useState, memo } from 'react';
import { getStatusColor } from '../../utils/styles';

interface TransferStatusProps {
  status: string;
  lastUpdated?: string;
  onSubmitStatus?: () => void;
}

const getStatusDescription = (status: string) => {
  switch (status) {
    case 'Leading': return 'Transfers in are restricted — prevents top kingdoms from growing disproportionately stronger';
    case 'Ordinary': return 'Standard transfer status — open to all incoming transfers';
    default: return 'Transfer status not yet available';
  }
};

const TransferStatus: React.FC<TransferStatusProps> = ({ status, lastUpdated, onSubmitStatus }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const statusColor = status === 'Unannounced' ? '#6b7280' : getStatusColor(status);
  const isUnannounced = status === 'Unannounced';

  return (
    <div 
      style={{ fontSize: '0.7rem', position: 'relative', cursor: isUnannounced && onSubmitStatus ? 'pointer' : 'default' }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
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
      {showTooltip && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '0',
          marginBottom: '8px',
          padding: '0.5rem 0.75rem',
          backgroundColor: '#0a0a0a',
          border: `1px solid ${isUnannounced ? '#4a4a4a' : statusColor}`,
          borderRadius: '8px',
          fontSize: '0.75rem',
          color: '#fff',
          whiteSpace: 'normal',
          minWidth: '200px',
          maxWidth: '280px',
          zIndex: 100,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
        }}>
          <div style={{ color: isUnannounced ? '#9ca3af' : statusColor, fontWeight: 'bold', marginBottom: '3px' }}>
            {isUnannounced ? 'No Data Available' : status}
          </div>
          <div style={{ color: '#9ca3af', fontSize: '0.7rem' }}>
            {isUnannounced 
              ? 'Transfer status has not been reported yet' 
              : getStatusDescription(status)}
          </div>
          {isUnannounced && onSubmitStatus && (
            <div style={{ color: '#22d3ee', fontSize: '0.65rem', marginTop: '0.3rem', borderTop: '1px solid #2a2a2a', paddingTop: '0.3rem', fontWeight: '500' }}>
              Click to submit a status update
            </div>
          )}
          {!isUnannounced && lastUpdated && (
            <div style={{ color: '#6b7280', fontSize: '0.65rem', marginTop: '0.25rem', borderTop: '1px solid #2a2a2a', paddingTop: '0.25rem' }}>
              Last updated: {new Date(lastUpdated).toLocaleDateString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default memo(TransferStatus);
