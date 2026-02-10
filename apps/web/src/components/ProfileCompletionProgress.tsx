import React from 'react';
import { UserProfile } from '../contexts/AuthContext';

const ProfileCompletionProgress: React.FC<{
  profile: UserProfile | null;
  isMobile: boolean;
  onScrollToLink: () => void;
}> = ({ profile, isMobile, onScrollToLink }) => {
  if (!profile) return null;
  
  // Calculate completion items
  const items = [
    { label: 'Link Kingshot Account', done: !!profile.linked_username, action: onScrollToLink },
    { label: 'Set Language', done: !!profile.language },
    { label: 'Set Region', done: !!profile.region },
    { label: 'Add Alliance Tag', done: !!profile.alliance_tag },
    { label: 'Write Bio', done: !!profile.bio },
  ];
  
  const completedCount = items.filter(i => i.done).length;
  const totalCount = items.length;
  const percentage = Math.round((completedCount / totalCount) * 100);
  
  // Don't show if 100% complete
  if (percentage === 100) return null;
  
  return (
    <div style={{
      backgroundColor: '#111111',
      borderRadius: '12px',
      padding: isMobile ? '1rem' : '1.25rem',
      marginBottom: '1.5rem',
      border: '1px solid #2a2a2a',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem', gap: '0.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '600', color: '#fff' }}>
          Profile Completion
        </h3>
        <span style={{ 
          fontSize: '0.85rem', 
          fontWeight: 'bold', 
          color: percentage >= 80 ? '#22c55e' : percentage >= 50 ? '#fbbf24' : '#22d3ee' 
        }}>
          {percentage}%
        </span>
      </div>
      
      {/* Progress bar */}
      <div style={{
        width: '100%',
        height: '8px',
        backgroundColor: '#1a1a1a',
        borderRadius: '4px',
        overflow: 'hidden',
        marginBottom: '1rem'
      }}>
        <div style={{
          width: `${percentage}%`,
          height: '100%',
          backgroundColor: percentage >= 80 ? '#22c55e' : percentage >= 50 ? '#fbbf24' : '#22d3ee',
          borderRadius: '4px',
          transition: 'width 0.3s ease'
        }} />
      </div>
      
      {/* Checklist */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {items.map((item, idx) => (
          <div 
            key={idx}
            onClick={item.action}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              padding: '0.5rem 0.25rem',
              minHeight: '44px',
              cursor: item.action ? 'pointer' : 'default',
              opacity: item.done ? 0.6 : 1,
              borderRadius: '6px',
              transition: 'background-color 0.15s'
            }}
            onMouseEnter={(e) => item.action && (e.currentTarget.style.backgroundColor = '#ffffff08')}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <span style={{ 
              width: '18px', 
              height: '18px', 
              borderRadius: '50%', 
              border: item.done ? 'none' : '2px solid #3a3a3a',
              backgroundColor: item.done ? '#22c55e' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.7rem',
              color: '#fff',
              flexShrink: 0
            }}>
              {item.done && '✓'}
            </span>
            <span style={{ 
              fontSize: '0.8rem', 
              color: item.done ? '#6b7280' : '#fff',
              textDecoration: item.done ? 'line-through' : 'none'
            }}>
              {item.label}
            </span>
            {!item.done && item.action && (
              <span style={{ fontSize: '0.7rem', color: '#22d3ee', marginLeft: 'auto' }}>→</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProfileCompletionProgress;
