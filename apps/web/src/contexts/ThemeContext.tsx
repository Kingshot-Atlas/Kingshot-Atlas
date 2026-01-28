import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type ThemeMode = 'dark' | 'light';

interface ThemeColors {
  // Backgrounds
  bg: string;
  bgSecondary: string;
  bgTertiary: string;
  bgCard: string;
  bgHover: string;
  
  // Borders
  border: string;
  borderLight: string;
  borderHover: string;
  
  // Text
  text: string;
  textSecondary: string;
  textMuted: string;
  
  // Accent colors (same in both modes)
  accent: string;
  accentHover: string;
  
  // Status colors
  success: string;
  warning: string;
  error: string;
  info: string;
}

const darkTheme: ThemeColors = {
  bg: '#0a0a0a',
  bgSecondary: '#111111',
  bgTertiary: '#151515',
  bgCard: '#111111',
  bgHover: '#1a1a1a',
  
  border: '#333333',
  borderLight: '#2a2a2a',
  borderHover: '#444444',
  
  text: '#ffffff',
  textSecondary: '#9ca3af',
  textMuted: '#6b7280',
  
  accent: '#22d3ee',
  accentHover: '#06b6d4',
  
  success: '#22c55e',
  warning: '#fbbf24',
  error: '#ef4444',
  info: '#3b82f6'
};

const lightTheme: ThemeColors = {
  bg: '#f8fafc',
  bgSecondary: '#ffffff',
  bgTertiary: '#f1f5f9',
  bgCard: '#ffffff',
  bgHover: '#f1f5f9',
  
  border: '#e2e8f0',
  borderLight: '#e2e8f0',
  borderHover: '#cbd5e1',
  
  text: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#64748b',
  
  accent: '#0891b2',
  accentHover: '#0e7490',
  
  success: '#16a34a',
  warning: '#d97706',
  error: '#dc2626',
  info: '#2563eb'
};

interface ThemeContextType {
  mode: ThemeMode;
  colors: ThemeColors;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_KEY = 'kingshot_theme';

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return (saved as ThemeMode) || 'dark';
  });

  const colors = mode === 'dark' ? darkTheme : lightTheme;

  useEffect(() => {
    localStorage.setItem(THEME_KEY, mode);
    // Update body background
    document.body.style.backgroundColor = colors.bg;
    document.body.style.color = colors.text;
  }, [mode, colors]);

  const toggleTheme = () => {
    setMode(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const setTheme = (newMode: ThemeMode) => {
    setMode(newMode);
  };

  return (
    <ThemeContext.Provider value={{ mode, colors, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export { darkTheme, lightTheme };
export type { ThemeColors, ThemeMode };
