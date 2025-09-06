import { useEffect, useRef, useState } from 'react';

interface UseLazyLoadingOptions {
  rootMargin?: string;
  threshold?: number;
}

export function useLazyLoading({ rootMargin = '50px', threshold = 0.1 }: UseLazyLoadingOptions = {}) {
  const [isInView, setIsInView] = useState(false);
  const [hasBeenInView, setHasBeenInView] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          setHasBeenInView(true);
          // Once loaded, stop observing
          observer.unobserve(element);
        }
      },
      {
        rootMargin,
        threshold,
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [rootMargin, threshold]);

  return {
    elementRef,
    isInView,
    hasBeenInView,
    shouldLoad: hasBeenInView,
  };
}

// Simple in-memory cache for loaded images
class ImageCache {
  private cache = new Map<string, boolean>();
  private preloadedImages = new Set<string>();

  isCached(src: string): boolean {
    return this.cache.has(src);
  }

  markAsCached(src: string): void {
    this.cache.set(src, true);
  }

  preloadImage(src: string): Promise<void> {
    if (this.preloadedImages.has(src)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.preloadedImages.add(src);
        this.markAsCached(src);
        resolve();
      };
      img.onerror = reject;
      img.src = src;
    });
  }

  clear(): void {
    this.cache.clear();
    this.preloadedImages.clear();
  }
}

export const imageCache = new ImageCache();

export function useImagePreloader(src: string, shouldPreload: boolean = false) {
  const [isPreloaded, setIsPreloaded] = useState(false);
  const [preloadError, setPreloadError] = useState(false);

  useEffect(() => {
    if (!shouldPreload || !src) return;

    if (imageCache.isCached(src)) {
      setIsPreloaded(true);
      return;
    }

    imageCache.preloadImage(src)
      .then(() => setIsPreloaded(true))
      .catch(() => setPreloadError(true));
  }, [src, shouldPreload]);

  return { isPreloaded, preloadError };
}