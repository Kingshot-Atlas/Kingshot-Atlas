import React, { useState, useCallback, ReactNode } from 'react';
import { useIsMobile } from '../../hooks/useMediaQuery';

interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  accentColor?: string;
  position?: 'top' | 'bottom';
  className?: string;
}

/**
 * Shared Tooltip component following the style guide
 * - Position: Always ABOVE element by default
 * - Desktop: Instant on hover
 * - Mobile: Tap to toggle
 */
const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  accentColor = '#22d3ee',
  position = 'top',
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const isMobile = useIsMobile();

  const handleMouseEnter = useCallback(() => {
    if (!isMobile) setIsVisible(true);
  }, [isMobile]);

  const handleMouseLeave = useCallback(() => {
    if (!isMobile) setIsVisible(false);
  }, [isMobile]);

  const handleClick = useCallback(() => {
    if (isMobile) setIsVisible(prev => !prev);
  }, [isMobile]);

  const tooltipStyle: React.CSSProperties = {
    position: 'absolute',
    ...(position === 'top' ? { bottom: '100%', marginBottom: '8px' } : { top: '100%', marginTop: '8px' }),
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#0a0a0a',
    border: `1px solid ${accentColor}`,
    borderRadius: '8px',
    padding: '0.6rem 0.8rem',
    zIndex: 1000,
    whiteSpace: 'nowrap',
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    animation: 'tooltipFadeIn 0.15s ease'
  };

  return (
    <div
      className={className}
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {children}
      {isVisible && (
        <div style={tooltipStyle}>
          {content}
        </div>
      )}
      <style>{`
        @keyframes tooltipFadeIn {
          from { opacity: 0; transform: translateX(-50%) translateY(5px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default React.memo(Tooltip);
