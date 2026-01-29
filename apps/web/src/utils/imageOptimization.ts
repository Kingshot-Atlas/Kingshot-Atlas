/**
 * Image Optimization Utilities for Kingshot Atlas
 * 
 * Provides lazy loading, responsive images, and placeholder support.
 */

/**
 * Generate a tiny placeholder for images (blur-up technique)
 */
export function generatePlaceholder(width: number = 10, height: number = 10): string {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${width} ${height}'%3E%3Crect fill='%231a1a1a' width='${width}' height='${height}'/%3E%3C/svg%3E`;
}

/**
 * Check if native lazy loading is supported
 */
export const supportsLazyLoading = 'loading' in HTMLImageElement.prototype;

/**
 * Image loading states
 */
export type ImageLoadState = 'idle' | 'loading' | 'loaded' | 'error';

/**
 * Optimized image props
 */
export interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean; // If true, load immediately (above the fold)
  placeholder?: 'blur' | 'empty';
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * Get srcset for responsive images
 * Works with image services that support width parameters
 */
export function getSrcSet(
  src: string,
  widths: number[] = [320, 640, 960, 1280, 1920]
): string {
  // For external URLs that support width params (like Cloudinary, imgix)
  if (src.includes('cloudinary') || src.includes('imgix')) {
    return widths
      .map(w => `${src}?w=${w} ${w}w`)
      .join(', ');
  }
  
  // For local images, return original (no transformation available)
  return src;
}

/**
 * Get sizes attribute for responsive images
 */
export function getSizes(
  defaultSize: string = '100vw',
  breakpoints?: { [key: string]: string }
): string {
  if (!breakpoints) {
    return defaultSize;
  }
  
  const sizes = Object.entries(breakpoints)
    .map(([breakpoint, size]) => `(min-width: ${breakpoint}) ${size}`)
    .join(', ');
  
  return `${sizes}, ${defaultSize}`;
}

/**
 * Preload critical images
 * Call this for above-the-fold images to improve LCP
 */
export function preloadImage(src: string, as: 'image' = 'image'): void {
  if (typeof document === 'undefined') return;
  
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = as;
  link.href = src;
  document.head.appendChild(link);
}

/**
 * Preload multiple images
 */
export function preloadImages(srcs: string[]): void {
  srcs.forEach(src => preloadImage(src));
}

/**
 * Create an intersection observer for lazy loading
 * Returns a function to observe elements
 */
export function createLazyLoadObserver(
  onIntersect: (entry: IntersectionObserverEntry) => void,
  options?: IntersectionObserverInit
): IntersectionObserver | null {
  if (typeof IntersectionObserver === 'undefined') {
    return null;
  }
  
  const defaultOptions: IntersectionObserverInit = {
    root: null,
    rootMargin: '50px 0px', // Start loading 50px before visible
    threshold: 0.01,
    ...options,
  };
  
  return new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        onIntersect(entry);
      }
    });
  }, defaultOptions);
}

/**
 * Calculate aspect ratio padding for responsive containers
 */
export function getAspectRatioPadding(width: number, height: number): string {
  return `${(height / width) * 100}%`;
}

/**
 * Check if an image is in the viewport (for priority loading decisions)
 */
export function isInViewport(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * Decode image off main thread (prevents jank)
 */
export async function decodeImage(src: string): Promise<void> {
  const img = new Image();
  img.src = src;
  
  if ('decode' in img) {
    await img.decode();
  }
}

/**
 * Get WebP version of image URL if supported
 * (For use with image CDNs that support format conversion)
 */
export function getWebPUrl(src: string): string {
  // Check if browser supports WebP
  const supportsWebP = document.createElement('canvas')
    .toDataURL('image/webp')
    .indexOf('data:image/webp') === 0;
  
  if (!supportsWebP) return src;
  
  // For CDNs that support format params
  if (src.includes('cloudinary')) {
    return src.replace(/\.(jpg|jpeg|png)$/i, '.webp');
  }
  
  if (src.includes('imgix')) {
    const separator = src.includes('?') ? '&' : '?';
    return `${src}${separator}fm=webp`;
  }
  
  return src;
}
