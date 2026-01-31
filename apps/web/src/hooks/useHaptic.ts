import { useCallback } from 'react';

/**
 * Haptic feedback patterns for different interactions
 */
export type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

/**
 * Check if the device supports haptic feedback (Vibration API)
 */
export const supportsHaptic = (): boolean => {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
};

/**
 * Vibration patterns in milliseconds
 * - Single number = vibrate for that duration
 * - Array = [vibrate, pause, vibrate, pause, ...]
 */
const HAPTIC_PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 25,
  heavy: 50,
  success: [10, 50, 10], // Double tap
  warning: [30, 50, 30, 50, 30], // Triple pulse
  error: [50, 100, 50], // Strong double
};

/**
 * Trigger haptic feedback
 * @param pattern - The haptic pattern to use
 * @returns boolean indicating if haptic was triggered
 */
export const triggerHaptic = (pattern: HapticPattern = 'light'): boolean => {
  if (!supportsHaptic()) return false;
  
  try {
    const vibrationPattern = HAPTIC_PATTERNS[pattern];
    return navigator.vibrate(vibrationPattern);
  } catch {
    return false;
  }
};

/**
 * Hook to use haptic feedback in components
 * Returns memoized haptic trigger functions
 */
export const useHaptic = () => {
  const haptic = useCallback((pattern: HapticPattern = 'light') => {
    triggerHaptic(pattern);
  }, []);

  const lightTap = useCallback(() => triggerHaptic('light'), []);
  const mediumTap = useCallback(() => triggerHaptic('medium'), []);
  const heavyTap = useCallback(() => triggerHaptic('heavy'), []);
  const successFeedback = useCallback(() => triggerHaptic('success'), []);
  const warningFeedback = useCallback(() => triggerHaptic('warning'), []);
  const errorFeedback = useCallback(() => triggerHaptic('error'), []);

  return {
    haptic,
    lightTap,
    mediumTap,
    heavyTap,
    successFeedback,
    warningFeedback,
    errorFeedback,
    isSupported: supportsHaptic(),
  };
};

/**
 * HOC-style wrapper to add haptic feedback to click handlers
 * @param onClick - Original click handler
 * @param pattern - Haptic pattern to use
 */
export const withHaptic = <T extends (...args: unknown[]) => void>(
  onClick: T,
  pattern: HapticPattern = 'light'
): T => {
  return ((...args: Parameters<T>) => {
    triggerHaptic(pattern);
    return onClick(...args);
  }) as T;
};

export default useHaptic;
