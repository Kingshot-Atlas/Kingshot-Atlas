import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useOnboardingTracker } from '../hooks/useOnboardingTracker';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useTranslation } from 'react-i18next';

const SignupNudgeBar: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { profileViewCount, signupNudgeDismissed, dismissSignupNudge } = useOnboardingTracker();
  const isMobile = useIsMobile();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!user && profileViewCount >= 3 && !signupNudgeDismissed) {
      const timer = setTimeout(() => setVisible(true), 500);
      return () => clearTimeout(timer);
    }
    // Hide immediately if user logged in or dismissed
    setVisible(false);
    return undefined;
  }, [user, profileViewCount, signupNudgeDismissed]);

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
      backgroundColor: '#111111',
      borderTop: '1px solid #22d3ee40',
      padding: isMobile ? '0.75rem 1rem' : '0.75rem 2rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: isMobile ? '0.5rem' : '1rem',
      flexWrap: 'wrap',
      animation: 'slideUpNudge 0.4s ease-out',
      boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
    }}>
      <style>{`
        @keyframes slideUpNudge {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
      
      <span style={{ 
        color: '#d1d5db', 
        fontSize: isMobile ? '0.8rem' : '0.85rem',
        textAlign: 'center',
      }}>
        {t('onboarding.signupNudge', 'Create a free account to track kingdoms and get score change alerts')}
      </span>
      
      <Link
        to="/profile"
        style={{
          padding: '0.4rem 1rem',
          backgroundColor: '#22d3ee',
          borderRadius: '6px',
          color: '#000',
          fontSize: '0.8rem',
          fontWeight: '600',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {t('onboarding.signUpFree', 'Sign Up Free')}
      </Link>
      
      <button
        onClick={() => { setVisible(false); dismissSignupNudge(); }}
        aria-label="Dismiss"
        style={{
          background: 'none',
          border: 'none',
          color: '#6b7280',
          cursor: 'pointer',
          padding: '0.25rem',
          fontSize: '1.1rem',
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  );
};

export default SignupNudgeBar;
