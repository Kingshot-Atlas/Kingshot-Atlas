import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useTranslation } from 'react-i18next';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useToast } from '../Toast';

interface QuickAction {
  label: string;
  line1: string;
  line2: string;
  path: string;
  color: string;
  icon: React.ReactNode;
  comingSoon?: boolean;
}

const TransferHubIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 4L3 8L7 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 8H15C17.7614 8 20 10.2386 20 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M17 20L21 16L17 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M21 16H9C6.23858 16 4 13.7614 4 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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

const AllianceCenterIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-4h6v4"/>
  </svg>
);

const KvKToolsIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 22V12" stroke="currentColor" strokeWidth="2" />
    <path d="M3 7l9 5 9-5" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const RankingsIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="14" width="5" height="8" rx="1" stroke="currentColor" strokeWidth="2" />
    <rect x="9.5" y="6" width="5" height="16" rx="1" stroke="currentColor" strokeWidth="2" />
    <rect x="16" y="10" width="5" height="12" rx="1" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const CalculatorIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="2" width="16" height="20" rx="2" stroke="currentColor" strokeWidth="2" />
    <line x1="8" y1="6" x2="16" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="8" cy="10" r="0.5" fill="currentColor" stroke="currentColor" />
    <circle cx="12" cy="10" r="0.5" fill="currentColor" stroke="currentColor" />
    <circle cx="16" cy="10" r="0.5" fill="currentColor" stroke="currentColor" />
    <circle cx="8" cy="14" r="0.5" fill="currentColor" stroke="currentColor" />
    <circle cx="12" cy="14" r="0.5" fill="currentColor" stroke="currentColor" />
    <circle cx="16" cy="14" r="0.5" fill="currentColor" stroke="currentColor" />
    <circle cx="8" cy="18" r="0.5" fill="currentColor" stroke="currentColor" />
    <line x1="12" y1="18" x2="16" y2="18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const QuickActions: React.FC = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { trackFeature } = useAnalytics();
  const { t } = useTranslation();
  const { showToast } = useToast();

  const iconSize = isMobile ? 16 : 20;

  const ACTIONS: QuickAction[] = [
    { label: 'Alliance Center', line1: t('quickAction.allianceCenter_1', 'Alliance'), line2: t('quickAction.allianceCenter_2', 'Center'), path: '/alliance-center/about', color: '#3b82f6', icon: <AllianceCenterIcon size={iconSize} /> },
    { label: 'KvK Tools', line1: t('quickAction.kvkTools_1', 'KvK Tools'), line2: t('quickAction.kvkTools_2', 'Discovery'), path: '/tools/kvk-tools', color: '#22d3ee', icon: <KvKToolsIcon size={iconSize} /> },
    { label: 'Transfer Hub', line1: t('quickAction.transferHub_1', 'Transfer'), line2: t('quickAction.transferHub_2', 'Hub'), path: '/transfer-hub/about', color: '#22c55e', icon: <TransferHubIcon size={iconSize} /> },
    { label: 'Atlas Discord Bot', line1: t('quickAction.atlasBot_1', 'Atlas'), line2: t('quickAction.atlasBot_2', 'Discord Bot'), path: '/atlas-bot', color: '#5865F2', icon: <AtlasBotIcon size={iconSize} /> },
    { label: 'Kingdom Rankings', line1: t('quickAction.rankings_1', 'Kingdom'), line2: t('quickAction.rankings_2', 'Rankings'), path: '/rankings', color: '#a855f7', icon: <RankingsIcon size={iconSize} /> },
    { label: 'Gaming Calculators', line1: t('quickAction.calculators_1', 'Gaming'), line2: t('quickAction.calculators_2', 'Calculators'), path: '/tools', color: '#6b7280', icon: <CalculatorIcon size={iconSize} />, comingSoon: true },
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
              if (action.comingSoon) {
                if (isMobile) showToast(t('common.comingSoon', 'This feature is coming soon!'), 'info', 2500);
                return;
              }
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
              cursor: action.comingSoon ? 'default' : 'pointer',
              transition: 'all 0.2s ease',
              color: action.color,
              opacity: action.comingSoon ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (action.comingSoon) return;
              e.currentTarget.style.borderColor = `${action.color}60`;
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = `0 4px 20px ${action.color}15`;
            }}
            onMouseLeave={(e) => {
              if (action.comingSoon) return;
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
                color: action.comingSoon ? '#6b7280' : '#d1d5db',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}>
                {action.line1}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{
                  fontSize: isMobile ? '0.65rem' : '0.72rem',
                  color: action.comingSoon ? '#6b7280' : '#d1d5db',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}>
                  {action.line2}
                </span>
                {action.comingSoon && !isMobile && (
                  <span style={{
                    fontSize: '0.5rem',
                    fontWeight: 700,
                    color: '#9ca3af',
                    backgroundColor: '#9ca3af18',
                    border: '1px solid #9ca3af30',
                    padding: '0.05rem 0.3rem',
                    borderRadius: '3px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    lineHeight: 1.4,
                  }}>
                    {t('common.soon', 'SOON')}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickActions;
