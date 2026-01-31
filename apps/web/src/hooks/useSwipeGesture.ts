import { useState, useRef, useCallback } from 'react';
import { triggerHaptic } from './useHaptic';

type SwipeDirection = 'left' | 'right' | 'up' | 'down' | null;

interface UseSwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number; // Minimum distance to trigger swipe (default: 50px)
  hapticOnSwipe?: boolean;
  disabled?: boolean;
}

interface UseSwipeGestureReturn {
  direction: SwipeDirection;
  isSwiping: boolean;
  swipeDistance: { x: number; y: number };
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
}

export const useSwipeGesture = ({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  threshold = 50,
  hapticOnSwipe = true,
  disabled = false,
}: UseSwipeGestureOptions = {}): UseSwipeGestureReturn => {
  const [direction, setDirection] = useState<SwipeDirection>(null);
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeDistance, setSwipeDistance] = useState({ x: 0, y: 0 });
  
  const startPos = useRef({ x: 0, y: 0 });
  const currentPos = useRef({ x: 0, y: 0 });

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    
    const touch = e.touches[0];
    if (!touch) return;
    
    startPos.current = { x: touch.clientX, y: touch.clientY };
    currentPos.current = { x: touch.clientX, y: touch.clientY };
    setIsSwiping(true);
    setDirection(null);
  }, [disabled]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (disabled || !isSwiping) return;
    
    const touch = e.touches[0];
    if (!touch) return;
    
    currentPos.current = { x: touch.clientX, y: touch.clientY };
    
    const deltaX = currentPos.current.x - startPos.current.x;
    const deltaY = currentPos.current.y - startPos.current.y;
    
    setSwipeDistance({ x: deltaX, y: deltaY });
    
    // Determine direction based on dominant axis
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      setDirection(deltaX > 0 ? 'right' : 'left');
    } else {
      setDirection(deltaY > 0 ? 'down' : 'up');
    }
  }, [disabled, isSwiping]);

  const handleTouchEnd = useCallback(() => {
    if (disabled) return;
    
    const deltaX = currentPos.current.x - startPos.current.x;
    const deltaY = currentPos.current.y - startPos.current.y;
    
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    
    // Check if swipe exceeded threshold
    if (absX >= threshold || absY >= threshold) {
      if (hapticOnSwipe) {
        triggerHaptic('light');
      }
      
      // Trigger appropriate callback
      if (absX > absY) {
        // Horizontal swipe
        if (deltaX > 0 && onSwipeRight) {
          onSwipeRight();
        } else if (deltaX < 0 && onSwipeLeft) {
          onSwipeLeft();
        }
      } else {
        // Vertical swipe
        if (deltaY > 0 && onSwipeDown) {
          onSwipeDown();
        } else if (deltaY < 0 && onSwipeUp) {
          onSwipeUp();
        }
      }
    }
    
    // Reset state
    setIsSwiping(false);
    setSwipeDistance({ x: 0, y: 0 });
    setDirection(null);
  }, [disabled, threshold, hapticOnSwipe, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);

  return {
    direction,
    isSwiping,
    swipeDistance,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
};

export default useSwipeGesture;
