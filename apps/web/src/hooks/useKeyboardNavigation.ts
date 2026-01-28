import { useEffect, useCallback } from 'react';

interface KeyboardNavigationOptions {
  onEscape?: () => void;
  onEnter?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onArrowLeft?: () => void;
  onArrowRight?: () => void;
  onTab?: (shiftKey: boolean) => void;
  onSlash?: () => void;
  enabled?: boolean;
}

export function useKeyboardNavigation(options: KeyboardNavigationOptions): void {
  const {
    onEscape,
    onEnter,
    onArrowUp,
    onArrowDown,
    onArrowLeft,
    onArrowRight,
    onTab,
    onSlash,
    enabled = true,
  } = options;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    const target = event.target as HTMLElement;
    const isInputFocused = 
      target.tagName === 'INPUT' || 
      target.tagName === 'TEXTAREA' || 
      target.isContentEditable;

    switch (event.key) {
      case 'Escape':
        onEscape?.();
        break;
      case 'Enter':
        if (!isInputFocused) {
          onEnter?.();
        }
        break;
      case 'ArrowUp':
        if (!isInputFocused) {
          event.preventDefault();
          onArrowUp?.();
        }
        break;
      case 'ArrowDown':
        if (!isInputFocused) {
          event.preventDefault();
          onArrowDown?.();
        }
        break;
      case 'ArrowLeft':
        if (!isInputFocused) {
          onArrowLeft?.();
        }
        break;
      case 'ArrowRight':
        if (!isInputFocused) {
          onArrowRight?.();
        }
        break;
      case 'Tab':
        onTab?.(event.shiftKey);
        break;
      case '/':
        if (!isInputFocused) {
          event.preventDefault();
          onSlash?.();
        }
        break;
    }
  }, [enabled, onEscape, onEnter, onArrowUp, onArrowDown, onArrowLeft, onArrowRight, onTab, onSlash]);

  useEffect(() => {
    if (!enabled) return;
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
}

export function useSearchShortcut(onActivate: () => void): void {
  return useKeyboardNavigation({
    onSlash: onActivate,
  });
}

export function useModalKeyboard(onClose: () => void): void {
  useKeyboardNavigation({
    onEscape: onClose,
  });
}

export function useListNavigation(
  itemCount: number,
  selectedIndex: number,
  onSelect: (index: number) => void,
  onActivate?: (index: number) => void
): void {
  useKeyboardNavigation({
    onArrowUp: () => {
      if (selectedIndex > 0) {
        onSelect(selectedIndex - 1);
      }
    },
    onArrowDown: () => {
      if (selectedIndex < itemCount - 1) {
        onSelect(selectedIndex + 1);
      }
    },
    onEnter: () => {
      if (selectedIndex >= 0 && onActivate) {
        onActivate(selectedIndex);
      }
    },
  });
}

export default useKeyboardNavigation;
