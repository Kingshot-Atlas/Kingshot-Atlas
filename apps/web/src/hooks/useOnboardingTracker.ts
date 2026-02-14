import { useState, useEffect, useCallback } from 'react';

const STORAGE_PREFIX = 'atlas_onboarding_';

interface OnboardingState {
  // Stage 1: Anonymous profile views
  profileViewCount: number;
  signupNudgeDismissed: boolean;
  
  // Stage 2: Welcome screen
  welcomeScreenShown: boolean;
  
  // Stage 3: Battle Planner trial
  sessionCount: number;
  bpTrialUsed: boolean;
  bpTrialStartedAt: number | null; // timestamp
  
  // Stage 4: Conversion banner
  weeklySessionTimestamps: number[];
  conversionBannerDismissedAt: number | null;
}

const DEFAULT_STATE: OnboardingState = {
  profileViewCount: 0,
  signupNudgeDismissed: false,
  welcomeScreenShown: false,
  sessionCount: 0,
  bpTrialUsed: false,
  bpTrialStartedAt: null,
  weeklySessionTimestamps: [],
  conversionBannerDismissedAt: null,
};

function getStoredValue<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(STORAGE_PREFIX + key);
    if (stored === null) return defaultValue;
    return JSON.parse(stored);
  } catch {
    return defaultValue;
  }
}

function setStoredValue(key: string, value: unknown): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function useOnboardingTracker() {
  const [state, setState] = useState<OnboardingState>(() => ({
    profileViewCount: getStoredValue('profileViewCount', DEFAULT_STATE.profileViewCount),
    signupNudgeDismissed: getStoredValue('signupNudgeDismissed', DEFAULT_STATE.signupNudgeDismissed),
    welcomeScreenShown: getStoredValue('welcomeScreenShown', DEFAULT_STATE.welcomeScreenShown),
    sessionCount: getStoredValue('sessionCount', DEFAULT_STATE.sessionCount),
    bpTrialUsed: getStoredValue('bpTrialUsed', DEFAULT_STATE.bpTrialUsed),
    bpTrialStartedAt: getStoredValue('bpTrialStartedAt', DEFAULT_STATE.bpTrialStartedAt),
    weeklySessionTimestamps: getStoredValue('weeklySessionTimestamps', DEFAULT_STATE.weeklySessionTimestamps),
    conversionBannerDismissedAt: getStoredValue('conversionBannerDismissedAt', DEFAULT_STATE.conversionBannerDismissedAt),
  }));

  // Track session on mount (once per page load)
  useEffect(() => {
    const sessionKey = STORAGE_PREFIX + 'currentSession';
    const alreadyTracked = sessionStorage.getItem(sessionKey);
    if (!alreadyTracked) {
      sessionStorage.setItem(sessionKey, '1');
      const newCount = state.sessionCount + 1;
      const now = Date.now();
      const newTimestamps = [...state.weeklySessionTimestamps, now]
        .filter(ts => now - ts < 7 * 24 * 60 * 60 * 1000); // Keep only last 7 days
      
      setStoredValue('sessionCount', newCount);
      setStoredValue('weeklySessionTimestamps', newTimestamps);
      setState(prev => ({
        ...prev,
        sessionCount: newCount,
        weeklySessionTimestamps: newTimestamps,
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trackProfileView = useCallback(() => {
    setState(prev => {
      const newCount = prev.profileViewCount + 1;
      setStoredValue('profileViewCount', newCount);
      return { ...prev, profileViewCount: newCount };
    });
  }, []);

  const dismissSignupNudge = useCallback(() => {
    setStoredValue('signupNudgeDismissed', true);
    setState(prev => ({ ...prev, signupNudgeDismissed: true }));
  }, []);

  const markWelcomeShown = useCallback(() => {
    setStoredValue('welcomeScreenShown', true);
    setState(prev => ({ ...prev, welcomeScreenShown: true }));
  }, []);

  const startBpTrial = useCallback(() => {
    const now = Date.now();
    setStoredValue('bpTrialStartedAt', now);
    setState(prev => ({ ...prev, bpTrialStartedAt: now }));
  }, []);

  const markBpTrialUsed = useCallback(() => {
    setStoredValue('bpTrialUsed', true);
    setStoredValue('bpTrialStartedAt', null);
    setState(prev => ({ ...prev, bpTrialUsed: true, bpTrialStartedAt: null }));
  }, []);

  const dismissConversionBanner = useCallback(() => {
    const now = Date.now();
    setStoredValue('conversionBannerDismissedAt', now);
    setState(prev => ({ ...prev, conversionBannerDismissedAt: now }));
  }, []);

  // Derived values
  const weeklySessionCount = state.weeklySessionTimestamps.length;
  
  const isBpTrialActive = state.bpTrialStartedAt !== null && 
    !state.bpTrialUsed &&
    (Date.now() - state.bpTrialStartedAt) < 60 * 60 * 1000; // 1 hour
  
  const shouldShowConversionBanner = (() => {
    if (state.conversionBannerDismissedAt) {
      const daysSinceDismissal = (Date.now() - state.conversionBannerDismissedAt) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissal < 30) return false; // Respect 30-day cooldown
    }
    return weeklySessionCount >= 3;
  })();

  // Stage 3 activation: only after Feb 25, 2026
  const BP_TRIAL_ACTIVATION_DATE = new Date('2026-02-25T00:00:00Z').getTime();
  const isBpTrialFeatureActive = Date.now() >= BP_TRIAL_ACTIVATION_DATE;

  return {
    ...state,
    weeklySessionCount,
    isBpTrialActive,
    isBpTrialFeatureActive,
    shouldShowConversionBanner,
    trackProfileView,
    dismissSignupNudge,
    markWelcomeShown,
    startBpTrial,
    markBpTrialUsed,
    dismissConversionBanner,
  };
}
