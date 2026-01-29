import { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface UseKeyboardShortcutsOptions {
  onShowHelp?: () => void;
}

/**
 * Global keyboard shortcuts hook
 * Provides navigation and UI shortcuts across the app
 */
export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}) {
  const navigate = useNavigate();
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore if user is typing in an input
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    // Show help modal with ?
    if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      options.onShowHelp?.();
      return;
    }

    // Handle 'g' prefix for navigation
    if (pendingKey === 'g') {
      setPendingKey(null);
      switch (e.key.toLowerCase()) {
        case 'h':
          e.preventDefault();
          navigate('/');
          break;
        case 'l':
          e.preventDefault();
          navigate('/leaderboards');
          break;
        case 'p':
          e.preventDefault();
          navigate('/profile');
          break;
        case 'c':
          e.preventDefault();
          navigate('/compare');
          break;
        case 'a':
          e.preventDefault();
          navigate('/about');
          break;
      }
      return;
    }

    // Set pending key for 'g' prefix
    if (e.key === 'g' && !e.ctrlKey && !e.metaKey) {
      setPendingKey('g');
      // Clear pending key after 1 second
      setTimeout(() => setPendingKey(null), 1000);
      return;
    }
  }, [navigate, options, pendingKey]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { pendingKey };
}

/**
 * Hook for keyboard shortcuts help modal state
 */
export function useKeyboardHelp() {
  const [showHelp, setShowHelp] = useState(false);

  const openHelp = useCallback(() => setShowHelp(true), []);
  const closeHelp = useCallback(() => setShowHelp(false), []);
  const toggleHelp = useCallback(() => setShowHelp(prev => !prev), []);

  return {
    showHelp,
    openHelp,
    closeHelp,
    toggleHelp,
  };
}
