import React, { useState, useRef, useEffect } from 'react';
import { useIsMobile } from '../hooks/useMediaQuery';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  accentColor?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  maxWidth?: string;
}

const positionClasses = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
  left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
  right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
};

const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  accentColor = '#22d3ee',
  position = 'top',
  delay = 0,
  maxWidth = '250px'
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [showDelayed, setShowDelayed] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isVisible && delay > 0) {
      timeoutRef.current = setTimeout(() => setShowDelayed(true), delay);
    } else if (isVisible) {
      setShowDelayed(true);
    } else {
      setShowDelayed(false);
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isVisible, delay]);

  const handleMouseEnter = () => {
    if (!isMobile) setIsVisible(true);
  };

  const handleMouseLeave = () => {
    if (!isMobile) setIsVisible(false);
  };

  const handleClick = () => {
    if (isMobile) setIsVisible(prev => !prev);
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {children}
      {showDelayed && content && (
        <div 
          className={`absolute z-50 px-3 py-2 bg-bg rounded-md text-xs text-white shadow-tooltip text-left leading-relaxed animate-fade-in ${positionClasses[position]}`}
          style={{ 
            borderColor: accentColor, 
            borderWidth: '1px',
            maxWidth,
            whiteSpace: maxWidth === '250px' ? 'normal' : 'nowrap'
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
};

export default Tooltip;
