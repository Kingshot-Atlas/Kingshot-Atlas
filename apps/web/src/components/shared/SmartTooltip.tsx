import React, { useState, useRef, useCallback, useEffect, useLayoutEffect, memo, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useIsMobile } from '../../hooks/useMediaQuery';

// Global tooltip dismissal - only 1 tooltip at a time
let globalDismissFn: (() => void) | null = null;

interface SmartTooltipProps {
  children: ReactNode;
  content: ReactNode;
  accentColor?: string;
  /** Force position preference. 'auto' will flip if near edge. */
  preferPosition?: 'top' | 'bottom' | 'auto';
  /** Max width in px */
  maxWidth?: number;
  style?: React.CSSProperties;
}

/**
 * SmartTooltip — edge-aware, portal-based, 1-at-a-time tooltip.
 * - Uses position:fixed (viewport-relative) for reliable placement
 * - Flips vertically if near top/bottom edge
 * - Shifts horizontally if near left/right edge
 * - Only 1 tooltip visible globally
 * - Desktop: hover. Mobile: tap to toggle.
 */
const SmartTooltip: React.FC<SmartTooltipProps> = ({
  children,
  content,
  accentColor = '#22d3ee',
  preferPosition = 'auto',
  maxWidth = 220,
  style
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const hideRef = useRef<() => void>(undefined);

  const hide = useCallback(() => {
    setIsVisible(false);
    if (globalDismissFn === hideRef.current) {
      globalDismissFn = null;
    }
  }, []);

  // Keep hideRef current so the global dismiss always calls the latest hide
  hideRef.current = hide;

  const show = useCallback(() => {
    // Dismiss any other open tooltip first
    if (globalDismissFn && globalDismissFn !== hideRef.current) {
      globalDismissFn();
    }
    globalDismissFn = hideRef.current!;
    setIsVisible(true);
  }, []);

  // Synchronous position calculation before browser paint
  useLayoutEffect(() => {
    if (!isVisible || !triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const margin = 8;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    // Measure actual tooltip height if available, else estimate
    const tooltipH = tooltipRef.current?.offsetHeight ?? 50;

    // Vertical: prefer above trigger, flip to below if near top edge
    let placement: 'top' | 'bottom' = 'top';
    if (preferPosition === 'bottom') {
      placement = 'bottom';
    } else if (preferPosition === 'top') {
      placement = 'top';
    } else {
      if (rect.top < tooltipH + margin + 10) {
        placement = 'bottom';
      } else if (rect.bottom + tooltipH + margin > viewportH) {
        placement = 'top';
      }
    }

    let top: number;
    if (placement === 'top') {
      top = rect.top - margin - tooltipH;
    } else {
      top = rect.bottom + margin;
    }

    // Horizontal: center on trigger, shift if near edges
    let left = rect.left + rect.width / 2;
    const halfW = maxWidth / 2;
    const edgePad = 12;

    if (left - halfW < edgePad) {
      left = edgePad + halfW;
    } else if (left + halfW > viewportW - edgePad) {
      left = viewportW - edgePad - halfW;
    }

    // Clamp top to stay on screen
    top = Math.max(edgePad, Math.min(top, viewportH - tooltipH - edgePad));

    setPos({ top, left });
  }, [isVisible, preferPosition, maxWidth]);

  // Close on window scroll (not capture — avoids dismissing from inner scrollable elements)
  useEffect(() => {
    if (!isVisible) return;
    let scrollTimeout: ReturnType<typeof setTimeout>;
    const dismiss = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => hide(), 50);
    };
    window.addEventListener('scroll', dismiss, { passive: true });
    window.addEventListener('resize', hide);
    return () => {
      clearTimeout(scrollTimeout);
      window.removeEventListener('scroll', dismiss);
      window.removeEventListener('resize', hide);
    };
  }, [isVisible, hide]);

  // Close on outside click (mobile)
  useEffect(() => {
    if (!isVisible || !isMobile) return;
    const handleClick = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        tooltipRef.current && !tooltipRef.current.contains(e.target as Node)
      ) {
        hide();
      }
    };
    // Use timeout so the current click that opened the tooltip doesn't immediately close it
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClick, true);
    }, 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClick, true);
    };
  }, [isVisible, isMobile, hide]);

  const handleMouseEnter = useCallback(() => {
    if (!isMobile) show();
  }, [isMobile, show]);

  const handleMouseLeave = useCallback(() => {
    if (!isMobile) hide();
  }, [isMobile, hide]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (isMobile) {
      e.stopPropagation();
      if (isVisible) hide();
      else show();
    }
  }, [isMobile, isVisible, show, hide]);

  return (
    <div
      ref={triggerRef}
      style={{ position: 'relative', display: 'inline-flex', ...style }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {children}
      {isVisible && createPortal(
        <div
          ref={tooltipRef}
          style={{
            position: 'fixed',
            zIndex: 99999,
            top: `${pos.top}px`,
            left: `${pos.left}px`,
            transform: 'translateX(-50%)',
            backgroundColor: '#0a0a0a',
            border: `1px solid ${accentColor}`,
            borderRadius: '8px',
            padding: '0.45rem 0.65rem',
            maxWidth: `${maxWidth}px`,
            boxShadow: `0 8px 24px rgba(0,0,0,0.6), 0 0 8px ${accentColor}20`,
            animation: 'smartTooltipIn 0.15s ease forwards',
            pointerEvents: 'none',
            lineHeight: 1.4,
            opacity: 0,
          }}
        >
          {content}
        </div>,
        document.body
      )}
    </div>
  );
};

// Inject keyframes once
if (typeof document !== 'undefined' && !document.getElementById('smart-tooltip-styles')) {
  const styleEl = document.createElement('style');
  styleEl.id = 'smart-tooltip-styles';
  styleEl.textContent = `
    @keyframes smartTooltipIn {
      from { opacity: 0; transform: translateX(-50%) translateY(4px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
  `;
  document.head.appendChild(styleEl);
}

export default memo(SmartTooltip);
