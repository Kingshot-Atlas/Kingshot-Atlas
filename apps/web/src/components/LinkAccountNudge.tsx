import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface LinkAccountNudgeProps {
  variant: 'kingdom-profile' | 'transfer-hub' | 'compare' | 'inline';
  kingdomNumber?: number;
  themeColor?: string;
}

const LinkAccountNudge: React.FC<LinkAccountNudgeProps> = ({ 
  variant, 
  kingdomNumber,
  themeColor = '#22d3ee' 
}) => {
  const { user, profile } = useAuth();

  // Don't show if already linked
  if (profile?.linked_username) return null;

  if (variant === 'kingdom-profile' && kingdomNumber) {
    // "Players from your kingdom" teaser on kingdom profiles
    return (
      <Link to="/profile" style={{ textDecoration: 'none' }}>
        <div style={{
          backgroundColor: '#111111',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          border: '1px solid #2a2a2a',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = `${themeColor}40`;
          e.currentTarget.style.backgroundColor = '#131318';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#2a2a2a';
          e.currentTarget.style.backgroundColor = '#111111';
        }}
        >
          <span style={{ fontSize: '1.25rem', opacity: 0.8 }}>🔗</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#d1d5db', fontSize: '0.85rem', fontWeight: '500' }}>
              {user ? 'Link your Kingshot account' : 'Sign in & link your account'}
            </div>
            <div style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.15rem' }}>
              See players from your kingdom, submit data, and unlock more features
            </div>
          </div>
          <span style={{ color: '#4b5563', fontSize: '0.85rem' }}>→</span>
        </div>
      </Link>
    );
  }

  if (variant === 'transfer-hub') {
    // Match score teaser on Transfer Hub
    return (
      <Link to="/profile" style={{ textDecoration: 'none' }}>
        <div style={{
          backgroundColor: '#111111',
          borderRadius: '10px',
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          border: '1px dashed #2a2a2a',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#22d3ee40';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#2a2a2a';
        }}
        >
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: '#22d3ee10',
            border: '1px solid #22d3ee30',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.9rem',
            filter: 'blur(1px)',
          }}>
            🎯
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#9ca3af', fontSize: '0.8rem' }}>
              <span style={{ 
                color: '#22d3ee', 
                fontWeight: '600',
                filter: 'blur(3px)',
                userSelect: 'none',
              }}>87%</span>
              {' '}match score available
            </div>
            <div style={{ color: '#6b7280', fontSize: '0.7rem', marginTop: '0.1rem' }}>
              {user ? 'Link your account to see personalized transfer matches' : 'Sign in to see your transfer match score'}
            </div>
          </div>
        </div>
      </Link>
    );
  }

  if (variant === 'inline') {
    // Subtle inline text nudge
    return (
      <Link to="/profile" style={{ textDecoration: 'none' }}>
        <span style={{ 
          color: '#4b5563', 
          fontSize: '0.75rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          cursor: 'pointer',
          transition: 'color 0.2s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = '#9ca3af'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = '#4b5563'; }}
        >
          🔗 {user ? 'Link account for more' : 'Sign in for more'}
        </span>
      </Link>
    );
  }

  return null;
};

export default LinkAccountNudge;
