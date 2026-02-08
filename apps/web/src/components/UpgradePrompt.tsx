import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '../hooks/useMediaQuery';
import { SubscriptionTier } from '../contexts/PremiumContext';
import { useAuth } from '../contexts/AuthContext';

interface UpgradePromptProps {
  feature: string;
  description?: string;
  requiredTier?: SubscriptionTier;
  inline?: boolean;
  compact?: boolean;
}

const UpgradePrompt: React.FC<UpgradePromptProps> = ({ 
  feature, 
  description,
  requiredTier: _requiredTier = 'supporter',
  inline = false,
  compact = false
}) => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [isHovered, setIsHovered] = useState(false);

  const tierLabel = 'Supporter';
  const tierColor = '#22d3ee';

  if (inline) {
    return (
      <span 
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.15rem 0.4rem',
          backgroundColor: `${tierColor}15`,
          border: `1px solid ${tierColor}40`,
          borderRadius: '4px',
          fontSize: '0.7rem',
          color: tierColor,
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
        </svg>
        {tierLabel}
      </span>
    );
  }

  if (compact) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 1rem',
        backgroundColor: `${tierColor}10`,
        border: `1px solid ${tierColor}30`,
        borderRadius: '8px',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill={tierColor}>
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
          </svg>
          <span style={{ color: '#fff', fontSize: '0.85rem' }}>
            <strong>{feature}</strong> requires Atlas {tierLabel}
          </span>
        </div>
        <Link
          to={user ? '/upgrade' : '/profile'}
          style={{
            padding: '0.4rem 0.75rem',
            backgroundColor: tierColor,
            border: 'none',
            borderRadius: '6px',
            color: '#000',
            fontSize: '0.8rem',
            fontWeight: '600',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            textDecoration: 'none'
          }}
        >
          Upgrade
        </Link>
      </div>
    );
  }

  return (
    <div style={{
      padding: isMobile ? '1.25rem' : '1.5rem',
      backgroundColor: '#111111',
      border: `1px solid ${tierColor}30`,
      borderRadius: '12px',
      textAlign: 'center',
      background: `linear-gradient(135deg, #111111 0%, ${tierColor}08 100%)`
    }}>
      <div style={{
        width: '48px',
        height: '48px',
        margin: '0 auto 1rem',
        backgroundColor: `${tierColor}20`,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill={tierColor}>
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
        </svg>
      </div>
      
      <h3 style={{ 
        color: '#fff', 
        fontSize: isMobile ? '1rem' : '1.1rem', 
        fontWeight: '600', 
        marginBottom: '0.5rem' 
      }}>
        {feature}
      </h3>
      
      {description && (
        <p style={{ 
          color: '#9ca3af', 
          fontSize: isMobile ? '0.85rem' : '0.9rem', 
          marginBottom: '1rem',
          lineHeight: 1.5
        }}>
          {description}
        </p>
      )}
      
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '0.35rem 0.75rem',
        backgroundColor: `${tierColor}20`,
        borderRadius: '20px',
        marginBottom: '1rem'
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill={tierColor}>
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
        </svg>
        <span style={{ color: tierColor, fontSize: '0.8rem', fontWeight: '600' }}>
          Atlas {tierLabel}
        </span>
      </div>
      
      <div>
        <Link
          to={user ? '/upgrade' : '/profile'}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{
            display: 'inline-block',
            padding: '0.75rem 1.5rem',
            backgroundColor: isHovered ? tierColor : `${tierColor}dd`,
            border: 'none',
            borderRadius: '8px',
            color: '#000',
            fontSize: '0.9rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: isHovered ? `0 4px 20px ${tierColor}40` : 'none',
            textDecoration: 'none'
          }}
        >
          {user ? 'Upgrade Now' : 'Sign In to Upgrade'}
        </Link>
      </div>
      
      <p style={{ 
        color: '#6b7280', 
        fontSize: '0.75rem', 
        marginTop: '0.75rem' 
      }}>
        Starting at $4.99/month
      </p>
    </div>
  );
};

export default UpgradePrompt;
