import React from 'react';

interface ScoreFreshnessProps {
  updatedAt?: string;
  style?: React.CSSProperties;
}

function getRelativeTime(dateString: string): string {
  const now = new Date();
  const updated = new Date(dateString);
  const diffMs = now.getTime() - updated.getTime();
  
  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return updated.toLocaleDateString();
}

function getFreshnessColor(dateString: string): string {
  const now = new Date();
  const updated = new Date(dateString);
  const diffHours = (now.getTime() - updated.getTime()) / (1000 * 60 * 60);
  
  if (diffHours < 1) return '#22c55e';    // Green - very fresh
  if (diffHours < 24) return '#84cc16';   // Lime - fresh
  if (diffHours < 72) return '#eab308';   // Yellow - getting stale
  return '#9ca3af';                        // Gray - old
}

const ScoreFreshness: React.FC<ScoreFreshnessProps> = ({ updatedAt, style }) => {
  if (!updatedAt) return null;
  
  const relativeTime = getRelativeTime(updatedAt);
  const color = getFreshnessColor(updatedAt);
  
  return (
    <span 
      style={{ 
        fontSize: '0.7rem', 
        color,
        opacity: 0.8,
        fontWeight: 'normal',
        ...style 
      }}
      title={`Score calculated: ${new Date(updatedAt).toLocaleString()}`}
    >
      Updated {relativeTime}
    </span>
  );
};

export default ScoreFreshness;
