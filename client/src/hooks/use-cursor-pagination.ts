import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';

export interface PaginatedResponse<T> {
  items: T[];
  hasMore: boolean;
  nextCursor?: string;
  prevCursor?: string;
}

export interface UseCursorPaginationOptions {
  queryKey: (string | number)[];
  pageSize?: number;
  enabled?: boolean;
  staleTime?: number;
}

export function useCursorPagination<T>({
  queryKey,
  pageSize = 20,
  enabled = true,
  staleTime = 30000 // 30 seconds
}: UseCursorPaginationOptions) {
  const [allItems, setAllItems] = useState<T[]>([]);
  const [cursors, setCursors] = useState<{ nextCursor?: string; prevCursor?: string }>({});
  const [hasMorePages, setHasMorePages] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Query for initial data
  const {
    data: initialData,
    isLoading: isInitialLoading,
    error: initialError,
    refetch: refetchInitial
  } = useQuery<PaginatedResponse<T>>({
    queryKey: [...queryKey, 'initial'],
    enabled: enabled,
    refetchOnWindowFocus: false,
    staleTime,
  });

  // Handle initial data updates
  useEffect(() => {
    if (initialData) {
      const newItems = initialData.items;
      const newCursors = {
        nextCursor: initialData.nextCursor,
        prevCursor: initialData.prevCursor
      };
      const newHasMorePages = initialData.hasMore;

      setAllItems(newItems);
      setCursors(newCursors);
      setHasMorePages(newHasMorePages);
    }
  }, [initialData]);

  // Query for loading more data (pagination)
  const {
    data: moreData,
    isLoading: isLoadingMoreQuery,
    error: loadMoreError,
    refetch: fetchMoreData
  } = useQuery<PaginatedResponse<T>>({
    queryKey: [...queryKey, 'more', cursors.nextCursor],
    enabled: false, // Only run when manually triggered
    refetchOnWindowFocus: false,
    staleTime,
  });

  // Handle loading more data
  useEffect(() => {
    if (moreData && !isLoadingMoreQuery) {
      const newItems = moreData.items;
      const newCursors = {
        nextCursor: moreData.nextCursor,
        prevCursor: moreData.prevCursor
      };
      const newHasMorePages = moreData.hasMore;

      // Append new items to existing ones
      setAllItems(prev => [...prev, ...newItems]);
      setCursors(newCursors);
      setHasMorePages(newHasMorePages);
      setIsLoadingMore(false);
    }
  }, [moreData, isLoadingMoreQuery]);

  // Function to load more items
  const loadMoreItems = async () => {
    if (!hasMorePages || isLoadingMore || !cursors.nextCursor) return;

    setIsLoadingMore(true);
    try {
      await fetchMoreData();
    } catch (error) {
      console.error('Error loading more items:', error);
      setIsLoadingMore(false);
    }
  };

  // Function to refresh all data
  const refresh = async () => {
    setAllItems([]);
    setCursors({});
    setHasMorePages(true);
    setIsLoadingMore(false);
    
    // Invalidate all related queries
    queryClient.invalidateQueries({ queryKey });
    
    await refetchInitial();
  };

  // Function to add new item to the beginning of the list
  const prependItem = (item: T) => {
    setAllItems(prev => [item, ...prev]);
  };

  // Function to remove item from the list
  const removeItem = (predicate: (item: T) => boolean) => {
    setAllItems(prev => prev.filter(item => !predicate(item)));
  };

  // Function to update an item in the list
  const updateItem = (predicate: (item: T) => boolean, updater: (item: T) => T) => {
    setAllItems(prev => prev.map(item => predicate(item) ? updater(item) : item));
  };

  return {
    // Data
    items: allItems,
    hasMorePages,
    cursors,

    // Loading states
    isInitialLoading,
    isLoadingMore: isLoadingMore || isLoadingMoreQuery,

    // Errors
    error: initialError || loadMoreError,

    // Actions
    loadMoreItems,
    refresh,
    prependItem,
    removeItem,
    updateItem,

    // Query utilities
    refetchInitial
  };
}