import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useAnalytics } from '../../hooks/useAnalytics';

interface QuickAction {
  label: string;
  path: string;
  color: string;
  icon: React.ReactNode;
}

const TransferHubIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 4L3 8L7 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 8H15C17.7614 8 20 10.2386 20 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M17 20L21 16L17 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M21 16H9C6.23858 16 4 13.7614 4 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const RankingsIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="14" width="5" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
    <rect x="9.5" y="3" width="5" height="18" rx="1" stroke="currentColor" strokeWidth="2" />
    <rect x="16" y="9" width="5" height="12" rx="1" stroke="currentColor" strokeWidth="2" />
    <path d="M12 6.5L13 5L12 3L11 5L12 6.5Z" fill="currentColor" />
  </svg>
);

const KvKSeasonsIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
    <path d="M12 3V12L16.5 16.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="2" fill="currentColor" />
    <path d="M8.5 2.5L12 1L15.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const AtlasBotIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="7" width="16" height="12" rx="3" stroke="currentColor" strokeWidth="2" />
    <circle cx="9" cy="13" r="1.5" fill="currentColor" />
    <circle cx="15" cy="13" r="1.5" fill="currentColor" />
    <path d="M10 16.5C10.5 17 11.2 17.25 12 17.25C12.8 17.25 13.5 17 14 16.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M12 7V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="12" cy="3" r="1" fill="currentColor" />
    <path d="M4 11H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M22 11H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const ACTIONS: QuickAction[] = [
  {
    label: 'Transfer Hub',
    path: '/transfer-hub',
    color: '#22c55e',
    icon: <TransferHubIcon />,
  },
  {
    label: 'Rankings',
    path: '/rankings',
    color: '#22d3ee',
    icon: <RankingsIcon />,
  },
  {
    label: 'KvK Seasons',
    path: '/rankings?tab=seasons',
    color: '#f97316',
    icon: <KvKSeasonsIcon />,
  },
  {
    label: 'Atlas Bot',
    path: '/atlas-bot',
    color: '#5865F2',
    icon: <AtlasBotIcon />,
  },
];

const QuickActions: React.FC = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { trackFeature } = useAnalytics();

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: isMobile ? '0.5rem 0.75rem' : '0.5rem 2rem',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: isMobile ? '0.5rem' : '0.75rem',
      }}>
        {ACTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => {
              trackFeature('QuickAction Clicked', { tile: action.label });
              navigate(action.path);
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: isMobile ? '0.4rem' : '0.5rem',
              padding: isMobile ? '0.75rem 0.5rem' : '1rem 0.5rem',
              background: '#111',
              border: '1px solid #2a2a2a',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              color: action.color,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = `${action.color}60`;
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = `0 4px 20px ${action.color}15`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#2a2a2a';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{
              width: isMobile ? '36px' : '44px',
              height: isMobile ? '36px' : '44px',
              borderRadius: '10px',
              backgroundColor: `${action.color}12`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: action.color,
            }}>
              {action.icon}
            </div>
            <span style={{
              fontSize: isMobile ? '0.7rem' : '0.8rem',
              color: '#d1d5db',
              fontWeight: 500,
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}>
              {action.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickActions;
