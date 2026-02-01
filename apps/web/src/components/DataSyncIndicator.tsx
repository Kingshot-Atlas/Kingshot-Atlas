import React from 'react';
import { useDataFreshness } from '../hooks/useKingdomsRealtime';

interface DataSyncIndicatorProps {
  className?: string;
  compact?: boolean;
}

/**
 * Shows data sync status - last update time and connection status
 * Compact mode shows just a green dot, full mode shows timestamp
 */
export const DataSyncIndicator: React.FC<DataSyncIndicatorProps> = ({ 
  className,
  compact = false 
}) => {
  const { lastUpdated, kingdomCount, isStale } = useDataFreshness();
  
  const formatTime = (date: Date | null) => {
    if (!date) return 'Loading...';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    
    if (diffSec < 10) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffMin < 60) return `${diffMin}m ago`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const statusColor = isStale ? '#f59e0b' : '#22c55e'; // amber if stale, green if fresh
  
  if (compact) {
    return (
      <div 
        className={className}
        title={`${kingdomCount} kingdoms • Updated ${formatTime(lastUpdated)}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: statusColor,
          boxShadow: `0 0 6px ${statusColor}`,
          animation: 'pulse 2s infinite'
        }} />
      </div>
    );
  }

  return (
    <div 
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '0.75rem',
        color: '#6b7280',
        padding: '4px 8px',
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: '4px',
        border: `1px solid ${statusColor}30`
      }}
    >
      <div style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        backgroundColor: statusColor,
        boxShadow: `0 0 4px ${statusColor}`
      }} />
      <span>
        {kingdomCount > 0 ? `${kingdomCount} kingdoms` : 'Loading'}
        {' • '}
        {formatTime(lastUpdated)}
      </span>
    </div>
  );
};

export default DataSyncIndicator;
