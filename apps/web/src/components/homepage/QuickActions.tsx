import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useTranslation } from 'react-i18next';
import { useAnalytics } from '../../hooks/useAnalytics';

interface QuickAction {
  label: string;
  line1: string;
  line2: string;
  path: string;
  color: string;
  icon: React.ReactNode;
}

const TransferHubIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 4L3 8L7 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 8H15C17.7614 8 20 10.2386 20 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M17 20L21 16L17 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M21 16H9C6.23858 16 4 13.7614 4 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const BattlePlannerIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M5.6 5.6l2.15 2.15M16.25 16.25l2.15 2.15M5.6 18.4l2.15-2.15M16.25 7.75l2.15-2.15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const AtlasBotIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
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

const RankingsIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="14" width="5" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
    <rect x="9.5" y="3" width="5" height="18" rx="1" stroke="currentColor" strokeWidth="2" />
    <rect x="16" y="9" width="5" height="12" rx="1" stroke="currentColor" strokeWidth="2" />
    <path d="M12 6.5L13 5L12 3L11 5L12 6.5Z" fill="currentColor" />
  </svg>
);

const PrepSchedulerIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2" />
    <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2" />
    <circle cx="8" cy="14" r="1" fill="currentColor" />
    <circle cx="12" cy="14" r="1" fill="currentColor" />
    <circle cx="16" cy="14" r="1" fill="currentColor" />
    <circle cx="8" cy="18" r="1" fill="currentColor" />
    <circle cx="12" cy="18" r="1" fill="currentColor" />
  </svg>
);

const BattleRegistryIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M9 2H15L17 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4H7L9 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="8" y1="10" x2="16" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="8" y1="14" x2="14" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="6" cy="10" r="1" fill="currentColor" />
    <circle cx="6" cy="14" r="1" fill="currentColor" />
  </svg>
);

const QuickActions: React.FC = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { trackFeature } = useAnalytics();
  const { t } = useTranslation();

  const iconSize = isMobile ? 16 : 20;

  const ACTIONS: QuickAction[] = [
    { label: 'Transfer Hub', line1: t('quickAction.transferHub_1', 'Transfer'), line2: t('quickAction.transferHub_2', 'Hub'), path: '/transfer-hub/about', color: '#22c55e', icon: <TransferHubIcon size={iconSize} /> },
    { label: 'KvK Battle Planner', line1: t('quickAction.battlePlanner_1', 'KvK Battle'), line2: t('quickAction.battlePlanner_2', 'Planner'), path: '/tools/battle-planner', color: '#f97316', icon: <BattlePlannerIcon size={iconSize} /> },
    { label: 'KvK Battle Registry', line1: t('quickAction.battleRegistry_1', 'KvK Battle'), line2: t('quickAction.battleRegistry_2', 'Registry'), path: '/tools/battle-registry-info', color: '#f97316', icon: <BattleRegistryIcon size={iconSize} /> },
    { label: 'KvK Prep Scheduler', line1: t('quickAction.prepScheduler_1', 'KvK Prep'), line2: t('quickAction.prepScheduler_2', 'Scheduler'), path: '/tools/prep-scheduler-info', color: '#eab308', icon: <PrepSchedulerIcon size={iconSize} /> },
    { label: 'Atlas Discord Bot', line1: t('quickAction.atlasBot_1', 'Atlas'), line2: t('quickAction.atlasBot_2', 'Discord Bot'), path: '/atlas-bot', color: '#5865F2', icon: <AtlasBotIcon size={iconSize} /> },
    { label: 'Kingdom Rankings', line1: t('quickAction.rankings_1', 'Kingdom'), line2: t('quickAction.rankings_2', 'Rankings'), path: '/rankings', color: '#22d3ee', icon: <RankingsIcon size={iconSize} /> },
  ];

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: isMobile ? '0.5rem 0.75rem' : '0.5rem 2rem',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)',
        gap: isMobile ? '0.4rem' : '0.6rem',
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
              flexDirection: 'row',
              alignItems: 'center',
              gap: isMobile ? '0.4rem' : '0.5rem',
              padding: isMobile ? '0.6rem 0.5rem' : '0.7rem 0.55rem',
              background: '#111',
              border: '1px solid #2a2a2a',
              borderRadius: '10px',
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
              width: isMobile ? '32px' : '34px',
              height: isMobile ? '32px' : '34px',
              minWidth: isMobile ? '32px' : '34px',
              borderRadius: '8px',
              backgroundColor: `${action.color}12`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: action.color,
            }}>
              {action.icon}
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              lineHeight: 1.25,
              overflow: 'hidden',
            }}>
              <span style={{
                fontSize: isMobile ? '0.65rem' : '0.72rem',
                color: '#d1d5db',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}>
                {action.line1}
              </span>
              <span style={{
                fontSize: isMobile ? '0.65rem' : '0.72rem',
                color: '#d1d5db',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}>
                {action.line2}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickActions;
