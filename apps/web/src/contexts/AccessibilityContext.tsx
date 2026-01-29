import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface AccessibilityContextType {
  highContrast: boolean;
  toggleHighContrast: () => void;
  reducedMotion: boolean;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

const STORAGE_KEY = 'kingshot_accessibility';

export const AccessibilityProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Initialize from localStorage or system preference
  const [highContrast, setHighContrast] = useState(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved).highContrast || false;
      } catch {
        return false;
      }
    }
    // Check system preference
    return window.matchMedia?.('(prefers-contrast: more)').matches || false;
  });

  // Check system reduced motion preference
  const [reducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
  });

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ highContrast }));
  }, [highContrast]);

  // Apply high contrast class to document
  useEffect(() => {
    if (highContrast) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
  }, [highContrast]);

  const toggleHighContrast = useCallback(() => {
    setHighContrast((prev: boolean) => !prev);
  }, []);

  return (
    <AccessibilityContext.Provider value={{ highContrast, toggleHighContrast, reducedMotion }}>
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within AccessibilityProvider');
  }
  return context;
};

export default AccessibilityContext;
