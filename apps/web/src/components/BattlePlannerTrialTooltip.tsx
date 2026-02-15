import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePremium } from '../contexts/PremiumContext';
import { useFavoritesContext } from '../contexts/FavoritesContext';
import { useOnboardingTracker } from '../hooks/useOnboardingTracker';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useTranslation } from 'react-i18next';

const BattlePlannerTrialTooltip: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { tier } = usePremium();
  const { favorites } = useFavoritesContext();
  const {
    sessionCount,
    bpTrialUsed,
    isBpTrialActive,
    isBpTrialFeatureActive,
    startBpTrial,
  } = useOnboardingTracker();
  const isMobile = useIsMobile();
  const [dismissed, setDismissed] = useState(false);

  // Only show for free users who:
  // - Are logged in
  // - Have 3+ sessions
  // - Have at least 1 favorite
  // - Haven't used their trial yet
  // - Feature is activated (after Feb 25, 2026)
  // - Are not already a supporter
  if (!user || tier === 'supporter' || tier === 'anonymous') return null;
  if (sessionCount < 3) return null;
  if (!favorites || favorites.length === 0) return null;
  if (bpTrialUsed) return null;
  if (!isBpTrialFeatureActive) return null;
  if (dismissed) return null;

  // If trial is active, show the active trial banner
  if (isBpTrialActive) {
    return (
      <div style={{
        backgroundColor: '#ef444415',
        border: '1px solid #ef444440',
        borderRadius: '12px',
        padding: isMobile ? '0.75rem 1rem' : '1rem 1.25rem',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '200px' }}>
          <span style={{ fontSize: '1.1rem' }}>⚔️</span>
          <div>
            <div style={{ color: '#ef4444', fontSize: isMobile ? '0.8rem' : '0.85rem', fontWeight: '600' }}>
              {t('bpTrial.activeTitle', 'Battle Planner Trial Active')}
            </div>
            <div style={{ color: '#9ca3af', fontSize: isMobile ? '0.7rem' : '0.75rem' }}>
              {t('bpTrial.activeDesc', 'You have free access for 1 hour. Go plan your rallies!')}
            </div>
          </div>
        </div>
        <Link
          to="/tools/kvk-battle-planner"
          style={{
            padding: '0.4rem 0.85rem',
            backgroundColor: '#ef4444',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '0.8rem',
            fontWeight: '600',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {t('bpTrial.openPlanner', 'Open Planner')}
        </Link>
      </div>
    );
  }

  // Default: show the trial offer tooltip
  return (
    <div style={{
      backgroundColor: '#ef444410',
      border: '1px solid #ef444430',
      borderRadius: '12px',
      padding: isMobile ? '0.75rem 1rem' : '1rem 1.25rem',
      marginBottom: '1rem',
      position: 'relative',
    }}>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        style={{
          position: 'absolute',
          top: '0.5rem',
          right: '0.5rem',
          background: 'none',
          border: 'none',
          color: '#6b7280',
          cursor: 'pointer',
          fontSize: '0.85rem',
          padding: '0.15rem',
        }}
      >
        ✕
      </button>
      
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        <span style={{ fontSize: '1.25rem', flexShrink: 0, marginTop: '0.1rem' }}>⚔️</span>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontSize: isMobile ? '0.85rem' : '0.9rem', fontWeight: '600', marginBottom: '0.25rem' }}>
            {t('bpTrial.offerTitle', 'Planning a rally?')}
          </div>
          <p style={{ color: '#9ca3af', fontSize: isMobile ? '0.75rem' : '0.8rem', margin: '0 0 0.75rem', lineHeight: 1.4 }}>
            {t('bpTrial.offerDesc', 'The Battle Planner calculates timing so your rallies hit together. Gold Tier kingdom feature — try it free for 1 hour.')}
          </p>
          <button
            onClick={startBpTrial}
            style={{
              padding: '0.4rem 0.85rem',
              backgroundColor: '#ef4444',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '0.8rem',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            {t('bpTrial.startTrial', 'Try Free for 1 Hour')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BattlePlannerTrialTooltip;
