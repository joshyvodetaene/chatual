import { useEffect, useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

export interface InfiniteScrollProps {
  children: React.ReactNode;
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  className?: string;
  loadingComponent?: React.ReactNode;
  threshold?: number; // Distance from bottom to trigger load (in pixels)
  rootMargin?: string; // Intersection Observer root margin
}

export function InfiniteScroll({
  children,
  hasMore,
  isLoading,
  onLoadMore,
  className = '',
  loadingComponent,
  threshold = 100,
  rootMargin = '0px'
}: InfiniteScrollProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !isLoading) {
      onLoadMore();
    }
  }, [hasMore, isLoading, onLoadMore]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          handleLoadMore();
        }
      },
      {
        rootMargin,
        threshold: 0.1,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.unobserve(sentinel);
    };
  }, [handleLoadMore, rootMargin]);

  // Scroll-based fallback for better compatibility
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      if (distanceFromBottom < threshold && hasMore && !isLoading) {
        handleLoadMore();
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [handleLoadMore, threshold, hasMore, isLoading]);

  const defaultLoadingComponent = (
    <div className="flex justify-center items-center py-4" data-testid="infinite-scroll-loading">
      <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      <span className="ml-2 text-gray-500 text-sm">Loading more...</span>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      data-testid="infinite-scroll-container"
    >
      {children}
      
      {/* Sentinel element for Intersection Observer */}
      {hasMore && (
        <div
          ref={sentinelRef}
          className="h-1"
          data-testid="infinite-scroll-sentinel"
        />
      )}
      
      {/* Loading indicator */}
      {isLoading && (loadingComponent || defaultLoadingComponent)}
      
      {/* End of list indicator */}
      {!hasMore && !isLoading && (
        <div className="text-center py-4 text-gray-500 text-sm" data-testid="infinite-scroll-end">
          No more items to load
        </div>
      )}
    </div>
  );
}