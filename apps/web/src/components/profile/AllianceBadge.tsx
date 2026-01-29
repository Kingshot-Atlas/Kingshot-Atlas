import React, { memo } from 'react';

interface AllianceBadgeProps {
  allianceTag: string;
  homeKingdom?: number;
  badgeStyle?: string;
  themeColor: string;
}

const getBadgeStyle = (style: string, color: string) => {
  switch (style) {
    case 'gradient':
      return { background: `linear-gradient(135deg, ${color} 0%, ${color}80 100%)` };
    case 'outline':
      return { backgroundColor: 'transparent', border: `2px solid ${color}` };
    case 'glow':
      return { backgroundColor: color, boxShadow: `0 0 20px ${color}60` };
    default:
      return { backgroundColor: color };
  }
};

const AllianceBadge: React.FC<AllianceBadgeProps> = ({ 
  allianceTag, 
  homeKingdom, 
  badgeStyle = 'default', 
  themeColor 
}) => {
  return (
    <div style={{
      backgroundColor: '#111116',
      borderRadius: '12px',
      padding: '1.5rem',
      border: '1px solid #2a2a2a',
      textAlign: 'center'
    }}>
      <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: '600', marginBottom: '1rem' }}>
        Alliance Badge
      </h3>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem' }}>
        <div style={{
          padding: '0.75rem 1.5rem',
          borderRadius: '8px',
          ...getBadgeStyle(badgeStyle, themeColor),
          color: '#fff',
          fontSize: '1.5rem',
          fontWeight: 'bold',
          letterSpacing: '0.1em',
          textTransform: 'uppercase' as const
        }}>
          [{allianceTag}]
        </div>
        {homeKingdom && (
          <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>
            K-{homeKingdom}
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(AllianceBadge);
