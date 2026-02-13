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
    <path d="M6.5 2L2 6.5L6.5 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2 6.5H10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M17.5 2L22 6.5L17.5 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M22 6.5H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <rect x="8" y="14" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="2" />
    <path d="M12 14V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="12" cy="18" r="1.5" fill="currentColor" />
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

const GiftCodeIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="10" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
    <path d="M12 10V21" stroke="currentColor" strokeWidth="2" />
    <path d="M3 14H21" stroke="currentColor" strokeWidth="2" />
    <path d="M7.5 10C7.5 10 6 8.5 6 7C6 5.5 7.5 4 9 5C10.5 6 12 10 12 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M16.5 10C16.5 10 18 8.5 18 7C18 5.5 16.5 4 15 5C13.5 6 12 10 12 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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

const KvKSeasonsIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
    <path d="M12 3V12L16.5 16.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="2" fill="currentColor" />
    <path d="M8.5 2.5L12 1L15.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
    { label: 'KvK Battle Planner', line1: t('quickAction.battlePlanner_1', 'KvK Battle'), line2: t('quickAction.battlePlanner_2', 'Planner'), path: '/tools/battle-planner', color: '#ef4444', icon: <BattlePlannerIcon size={iconSize} /> },
    { label: 'Discord Bot Atlas', line1: t('quickAction.atlasBot_1', 'Discord'), line2: t('quickAction.atlasBot_2', 'Bot Atlas'), path: '/atlas-bot', color: '#5865F2', icon: <AtlasBotIcon size={iconSize} /> },
    { label: 'Gift Code Redeemer', line1: t('quickAction.giftCode_1', 'Gift Code'), line2: t('quickAction.giftCode_2', 'Redeemer'), path: '/gift-codes', color: '#f59e0b', icon: <GiftCodeIcon size={iconSize} /> },
    { label: 'Kingdom Rankings', line1: t('quickAction.rankings_1', 'Kingdom'), line2: t('quickAction.rankings_2', 'Rankings'), path: '/rankings', color: '#22d3ee', icon: <RankingsIcon size={iconSize} /> },
    { label: 'KvK Seasons', line1: t('quickAction.kvkSeasons_1', 'KvK'), line2: t('quickAction.kvkSeasons_2', 'Seasons'), path: '/rankings?tab=seasons', color: '#f97316', icon: <KvKSeasonsIcon size={iconSize} /> },
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
              gap: isMobile ? '0.35rem' : '0.5rem',
              padding: isMobile ? '0.55rem 0.4rem' : '0.7rem 0.55rem',
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
              width: isMobile ? '28px' : '34px',
              height: isMobile ? '28px' : '34px',
              minWidth: isMobile ? '28px' : '34px',
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
                fontSize: isMobile ? '0.6rem' : '0.72rem',
                color: '#d1d5db',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}>
                {action.line1}
              </span>
              <span style={{
                fontSize: isMobile ? '0.6rem' : '0.72rem',
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
