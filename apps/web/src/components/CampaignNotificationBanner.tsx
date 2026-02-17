import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useAuth } from '../contexts/AuthContext';

const DISMISS_KEY = 'kingshot_campaign_notification_dismissed';
const CAMPAIGN_END = new Date('2026-02-21T00:00:00Z').getTime();

const CampaignNotificationBanner: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(() => {
    return !!localStorage.getItem(DISMISS_KEY);
  });

  // Don't show if not logged in, already dismissed, campaign over, or already on the page
  if (!user) return null;
  if (dismissed) return null;
  if (Date.now() >= CAMPAIGN_END) return null;
  if (location.pathname === '/kingdoms/communities') return null;

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: isMobile ? '0 0.75rem 0.5rem' : '0 2rem 0.75rem',
    }}>
      <div
        onClick={() => navigate('/kingdoms/communities')}
        style={{
          background: 'linear-gradient(135deg, #1a0f05 0%, #111 50%, #0f1a0a 100%)',
          border: '1px solid #f59e0b40',
          borderRadius: '12px',
          padding: isMobile ? '0.75rem 1rem' : '0.75rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
          transition: 'border-color 0.2s ease',
        }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#f59e0b80'}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = '#f59e0b40'}
      >
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'radial-gradient(ellipse at 20% 50%, #f59e0b06, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative', zIndex: 1, minWidth: 0 }}>
          <span style={{ fontSize: '1rem', flexShrink: 0 }}>⚡</span>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontWeight: '700',
              fontSize: isMobile ? '0.8rem' : '0.85rem',
              color: '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              flexWrap: 'wrap',
            }}>
              Kingdom Colonies Campaign
              <span style={{
                fontSize: '0.55rem',
                padding: '0.1rem 0.35rem',
                backgroundColor: '#22c55e20',
                border: '1px solid #22c55e40',
                borderRadius: '3px',
                color: '#22c55e',
                fontWeight: '700',
              }}>
                LIVE
              </span>
            </div>
            <div style={{
              color: '#9ca3af',
              fontSize: isMobile ? '0.7rem' : '0.75rem',
              marginTop: '0.15rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              Top 3 kingdoms by verified players win real rewards. Rally your alliance.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative', zIndex: 1, flexShrink: 0 }}>
          <span style={{
            color: '#f59e0b',
            fontSize: isMobile ? '0.7rem' : '0.8rem',
            fontWeight: '600',
            whiteSpace: 'nowrap',
          }}>
            See leaderboard →
          </span>
          <button
            onClick={handleDismiss}
            style={{
              background: 'none',
              border: 'none',
              color: '#4b5563',
              cursor: 'pointer',
              fontSize: '0.9rem',
              padding: '0.2rem',
              lineHeight: 1,
            }}
            aria-label="Dismiss campaign notification"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};

export default CampaignNotificationBanner;
