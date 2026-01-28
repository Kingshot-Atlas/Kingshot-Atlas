import React, { useState, useRef, useEffect } from 'react';

interface LazyCardProps {
  children: React.ReactNode;
  height?: string;
  delay?: number;
}

const LazyCard: React.FC<LazyCardProps> = ({ children, height = '280px', delay = 0 }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !hasLoaded) {
          if (delay > 0) {
            setTimeout(() => {
              setIsVisible(true);
              setHasLoaded(true);
            }, delay);
          } else {
            setIsVisible(true);
            setHasLoaded(true);
          }
        }
      },
      { rootMargin: '100px', threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [hasLoaded, delay]);

  return (
    <div ref={ref} style={{ minHeight: isVisible ? 'auto' : height }}>
      {isVisible ? (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          {children}
        </div>
      ) : (
        <div style={{
          height,
          backgroundColor: '#151515',
          borderRadius: '12px',
          border: '1px solid #2a2a2a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            width: '24px',
            height: '24px',
            border: '2px solid #2a2a2a',
            borderTopColor: '#22d3ee',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }} />
        </div>
      )}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
};

export default LazyCard;
