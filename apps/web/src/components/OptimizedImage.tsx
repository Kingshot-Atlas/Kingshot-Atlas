/**
 * OptimizedImage Component
 * 
 * A performance-optimized image component with:
 * - Native lazy loading
 * - Blur-up placeholder
 * - Intersection Observer fallback
 * - Error handling
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  generatePlaceholder, 
  supportsLazyLoading,
  createLazyLoadObserver,
  type ImageLoadState 
} from '../utils/imageOptimization';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
  priority?: boolean;
  placeholder?: 'blur' | 'empty' | 'none';
  objectFit?: 'cover' | 'contain' | 'fill' | 'none';
  onLoad?: () => void;
  onError?: () => void;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  className = '',
  style,
  priority = false,
  placeholder = 'blur',
  objectFit = 'cover',
  onLoad,
  onError,
}) => {
  const [loadState, setLoadState] = useState<ImageLoadState>(priority ? 'loading' : 'idle');
  const [currentSrc, setCurrentSrc] = useState<string>(
    placeholder === 'blur' ? generatePlaceholder(width || 100, height || 100) : ''
  );
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (priority) {
      // Load immediately for priority images
      setCurrentSrc(src);
      setLoadState('loading');
      return;
    }

    if (supportsLazyLoading) {
      // Use native lazy loading
      setCurrentSrc(src);
      setLoadState('loading');
      return;
    }

    // Fallback: Use Intersection Observer
    if (imgRef.current) {
      observerRef.current = createLazyLoadObserver((entry) => {
        if (entry.isIntersecting) {
          setCurrentSrc(src);
          setLoadState('loading');
          observerRef.current?.unobserve(entry.target);
        }
      });

      if (observerRef.current) {
        observerRef.current.observe(imgRef.current);
      }
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [src, priority]);

  const handleLoad = () => {
    setLoadState('loaded');
    onLoad?.();
  };

  const handleError = () => {
    setLoadState('error');
    onError?.();
  };

  const imgStyle: React.CSSProperties = {
    objectFit,
    transition: 'opacity 0.3s ease-in-out',
    opacity: loadState === 'loaded' ? 1 : 0.5,
    ...style,
  };

  if (width) imgStyle.width = width;
  if (height) imgStyle.height = height;

  return (
    <img
      ref={imgRef}
      src={currentSrc || generatePlaceholder()}
      alt={alt}
      className={className}
      style={imgStyle}
      loading={priority ? 'eager' : 'lazy'}
      decoding={priority ? 'sync' : 'async'}
      onLoad={handleLoad}
      onError={handleError}
      width={width}
      height={height}
    />
  );
};

export default OptimizedImage;
