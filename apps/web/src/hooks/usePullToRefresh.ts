import { useState, useRef, useCallback, useEffect } from 'react';
import { triggerHaptic } from './useHaptic';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number; // Pull distance needed to trigger refresh (default: 80px)
  resistance?: number; // Resistance factor (default: 2.5)
  disabled?: boolean;
}

interface UsePullToRefreshReturn {
  pullDistance: number;
  isRefreshing: boolean;
  isPulling: boolean;
  containerProps: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
  indicatorStyle: React.CSSProperties;
}

export const usePullToRefresh = ({
  onRefresh,
  threshold = 80,
  resistance = 2.5,
  disabled = false,
}: UsePullToRefreshOptions): UsePullToRefreshReturn => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  
  const startY = useRef(0);
  const currentY = useRef(0);
  const isAtTop = useRef(true);

  const checkIfAtTop = useCallback(() => {
    isAtTop.current = window.scrollY <= 0;
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', checkIfAtTop, { passive: true });
    return () => window.removeEventListener('scroll', checkIfAtTop);
  }, [checkIfAtTop]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || isRefreshing) return;
    checkIfAtTop();
    if (!isAtTop.current) return;
    
    startY.current = e.touches[0]?.clientY ?? 0;
    setIsPulling(true);
  }, [disabled, isRefreshing, checkIfAtTop]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (disabled || isRefreshing || !isPulling) return;
    if (!isAtTop.current) return;
    
    currentY.current = e.touches[0]?.clientY ?? 0;
    const diff = currentY.current - startY.current;
    
    if (diff > 0) {
      // Apply resistance for natural feel
      const distance = Math.min(diff / resistance, threshold * 1.5);
      setPullDistance(distance);
      
      // Haptic when crossing threshold
      if (distance >= threshold && pullDistance < threshold) {
        triggerHaptic('medium');
      }
    }
  }, [disabled, isRefreshing, isPulling, resistance, threshold, pullDistance]);

  const handleTouchEnd = useCallback(async () => {
    if (disabled || isRefreshing) return;
    setIsPulling(false);
    
    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      triggerHaptic('success');
      
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [disabled, isRefreshing, pullDistance, threshold, onRefresh]);

  const indicatorStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: '50%',
    transform: `translate(-50%, ${Math.min(pullDistance, threshold)}px)`,
    opacity: Math.min(pullDistance / threshold, 1),
    transition: isPulling ? 'none' : 'all 0.3s ease-out',
    zIndex: 1000,
  };

  return {
    pullDistance,
    isRefreshing,
    isPulling,
    containerProps: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    indicatorStyle,
  };
};

export default usePullToRefresh;
