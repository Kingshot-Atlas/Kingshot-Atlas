import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { usePremium } from '../../contexts/PremiumContext';

const ScoreSimulatorTeaser: React.FC = () => {
  const isMobile = useIsMobile();
  const { tier } = usePremium();
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div style={{
      backgroundColor: '#131318',
      borderRadius: '12px',
      border: '1px solid #2a2a2a',
      marginBottom: isMobile ? '1.25rem' : '1.5rem',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Header - Clickable to expand/collapse */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          padding: isMobile ? '1rem' : '1.25rem',
          borderBottom: isExpanded ? '1px solid #2a2a2a' : 'none',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.1rem' }}>🔮</span>
          <h3 style={{ color: '#fff', fontSize: isMobile ? '0.95rem' : '1.1rem', fontWeight: '600', margin: 0 }}>
            Score Simulator
          </h3>
          <Link
            to="/upgrade"
            onClick={(e) => e.stopPropagation()}
            style={{
              padding: '0.15rem 0.4rem',
              backgroundColor: '#22d3ee15',
              border: '1px solid #22d3ee40',
              borderRadius: '4px',
              fontSize: '0.6rem',
              color: '#22d3ee',
              fontWeight: 'bold',
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#22d3ee25';
              e.currentTarget.style.borderColor = '#22d3ee60';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#22d3ee15';
              e.currentTarget.style.borderColor = '#22d3ee40';
            }}
          >
            PRO
          </Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {!isExpanded && (
            <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>
              "What if I win the next KvK?"
            </span>
          )}
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="#6b7280" 
            strokeWidth="2"
            style={{ 
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease'
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {/* Blurred Preview - Only shown when expanded */}
      {isExpanded && (
      <div style={{
        padding: isMobile ? '1rem' : '1.25rem',
        position: 'relative',
        minHeight: '200px'
      }}>
        {/* Blurred content simulation */}
        <div style={{
          filter: 'blur(4px)',
          opacity: 0.5,
          pointerEvents: 'none'
        }}>
          {/* Fake current score */}
          <div style={{ 
            textAlign: 'center', 
            marginBottom: '1rem',
            padding: '0.75rem',
            backgroundColor: '#0a0a0a',
            borderRadius: '8px'
          }}>
            <div style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Current Atlas Score</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#22d3ee' }}>8.5</div>
          </div>

          {/* Fake KvK inputs */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Simulate Next KvKs</div>
            <div style={{ 
              padding: '0.5rem',
              backgroundColor: '#0a0a0a',
              borderRadius: '8px',
              display: 'flex',
              gap: '1rem',
              alignItems: 'center'
            }}>
              <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>KvK #11</span>
              <span style={{ color: '#eab308', fontSize: '0.7rem' }}>Prep: W</span>
              <span style={{ color: '#f97316', fontSize: '0.7rem' }}>Battle: W</span>
            </div>
          </div>

          {/* Fake projected results */}
          <div style={{
            padding: '1rem',
            backgroundColor: '#0a0a0a',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ color: '#6b7280', fontSize: '0.7rem' }}>Projected Score</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#22c55e' }}>9.2</div>
            <div style={{ color: '#22c55e', fontSize: '0.8rem' }}>+0.7 (↑8%)</div>
          </div>
        </div>

        {/* Overlay CTA */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(10, 10, 10, 0.7)',
          padding: '1.5rem'
        }}>
          <div style={{
            textAlign: 'center',
            maxWidth: '300px'
          }}>
            <div style={{ 
              fontSize: '2rem', 
              marginBottom: '0.75rem',
              filter: 'drop-shadow(0 0 8px #22d3ee40)'
            }}>
              🔒
            </div>
            <h4 style={{ 
              color: '#fff', 
              fontSize: '1rem', 
              fontWeight: '600', 
              marginBottom: '0.5rem',
              margin: '0 0 0.5rem 0'
            }}>
              Predict Your Future Score
            </h4>
            <p style={{ 
              color: '#9ca3af', 
              fontSize: '0.8rem', 
              marginBottom: '1rem',
              lineHeight: 1.5
            }}>
              "What if I win the next 3 KvKs?" See how your Atlas Score changes with different outcomes.
            </p>

            {/* Benefits */}
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '0.35rem',
              marginBottom: '1rem',
              textAlign: 'left'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#22c55e', fontSize: '0.7rem' }}>✓</span>
                <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Sign in to unlock 2 future KvKs. Pro gives access to 5.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#22c55e', fontSize: '0.7rem' }}>✓</span>
                <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>See streak and experience impact</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#22c55e', fontSize: '0.7rem' }}>✓</span>
                <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Get actionable insights</span>
              </div>
            </div>

            {/* CTA Button - Pro feature uses cyan color scheme */}
            <Link
              to={tier === 'anonymous' ? '/profile' : '/upgrade'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.6rem 1.25rem',
                background: 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)',
                border: 'none',
                borderRadius: '8px',
                color: '#000',
                fontSize: '0.85rem',
                fontWeight: '600',
                textDecoration: 'none',
                boxShadow: '0 0 15px rgba(34, 211, 238, 0.3)',
                transition: 'transform 0.2s, box-shadow 0.2s'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
              </svg>
              {tier === 'anonymous' ? 'Sign In to Unlock' : 'Unlock Simulator'}
            </Link>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

export default ScoreSimulatorTeaser;
