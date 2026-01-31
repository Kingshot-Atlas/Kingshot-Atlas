import React, { useState, useRef, useEffect } from 'react';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  placeholderSrc?: string;
  blurHash?: string;
  fallback?: React.ReactNode;
  loadingStyle?: 'skeleton' | 'blur' | 'fade';
}

const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  placeholderSrc,
  fallback,
  loadingStyle = 'skeleton',
  style,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '100px', // Start loading 100px before in view
        threshold: 0.01,
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setHasError(true);
  };

  if (hasError && fallback) {
    return <>{fallback}</>;
  }

  const skeletonStyle: React.CSSProperties = {
    backgroundColor: '#1a1a1a',
    animation: 'pulse 1.5s ease-in-out infinite',
  };

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    ...style,
  };

  const imgStyle: React.CSSProperties = {
    ...style,
    opacity: isLoaded ? 1 : 0,
    transition: loadingStyle === 'fade' ? 'opacity 0.3s ease-in-out' : 'opacity 0.15s ease-in-out',
  };

  return (
    <div ref={containerRef} style={containerStyle}>
      {!isLoaded && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            ...(loadingStyle === 'skeleton' ? skeletonStyle : {}),
            ...(loadingStyle === 'blur' && placeholderSrc
              ? {
                  backgroundImage: `url(${placeholderSrc})`,
                  backgroundSize: 'cover',
                  filter: 'blur(10px)',
                  transform: 'scale(1.1)',
                }
              : {}),
          }}
        />
      )}
      {isInView && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
          decoding="async"
          style={imgStyle}
          {...props}
        />
      )}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default LazyImage;
