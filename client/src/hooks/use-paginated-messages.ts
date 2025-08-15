import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageWithUser, PaginatedResponse } from '@shared/schema';

interface UsePaginatedMessagesOptions {
  roomId?: string;
  pageSize?: number;
  enabled?: boolean;
}

export function usePaginatedMessages({ 
  roomId, 
  pageSize = 50, 
  enabled = true 
}: UsePaginatedMessagesOptions) {
  const [allMessages, setAllMessages] = useState<MessageWithUser[]>([]);
  const [cursors, setCursors] = useState<{ nextCursor?: string; prevCursor?: string }>({});
  const [hasMorePages, setHasMorePages] = useState(true);

  // Clear messages when switching rooms
  useEffect(() => {
    setAllMessages([]);
    setCursors({});
    setHasMorePages(true);
  }, [roomId]);

  // Query for initial messages
  const { 
    data: initialData, 
    isLoading: isInitialLoading,
    error: initialError,
    refetch: refetchInitial
  } = useQuery<PaginatedResponse<MessageWithUser>>({
    queryKey: ['/api/rooms', roomId, 'messages', 'initial'],
    enabled: enabled && !!roomId,
    refetchOnWindowFocus: false,
    staleTime: 0, // Always fresh
  });

  // Handle initial data updates
  useEffect(() => {
    if (initialData) {
      setAllMessages(initialData.items);
      setCursors({
        nextCursor: initialData.nextCursor,
        prevCursor: initialData.prevCursor
      });
      setHasMorePages(initialData.hasMore);
    }
  }, [initialData]);

  // Query for loading more messages (pagination)
  const { 
    data: moreData,
    isLoading: isLoadingMore,
    error: loadMoreError,
    refetch: fetchMoreMessages
  } = useQuery<PaginatedResponse<MessageWithUser>>({
    queryKey: ['/api/rooms', roomId, 'messages', 'more', cursors.nextCursor],
    queryFn: async () => {
      if (!roomId || !cursors.nextCursor) throw new Error('No cursor available');
      
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        after: cursors.nextCursor,
      });
      
      const response = await fetch(`/api/rooms/${roomId}/messages?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch more messages');
      }
      
      return response.json();
    },
    enabled: false, // Only fetch when manually triggered
  });

  // Handle more data updates
  useEffect(() => {
    if (moreData) {
      // Prepend older messages to the beginning of the list
      setAllMessages(prev => [...moreData.items, ...prev]);
      setCursors(prev => ({
        ...prev,
        nextCursor: moreData.nextCursor,
      }));
      setHasMorePages(moreData.hasMore);
    }
  }, [moreData]);

  const loadMoreMessages = useCallback(async () => {
    if (!hasMorePages || isLoadingMore || !cursors.nextCursor) return;
    
    try {
      await fetchMoreMessages();
    } catch (error) {
      console.error('Failed to load more messages:', error);
    }
  }, [hasMorePages, isLoadingMore, cursors.nextCursor, fetchMoreMessages]);

  // Add new message (from WebSocket) to the end
  const addMessage = useCallback((message: MessageWithUser) => {
    setAllMessages(prev => [...prev, message]);
  }, []);

  // Replace all messages (when switching rooms)
  const setMessages = useCallback((messages: MessageWithUser[]) => {
    setAllMessages(messages);
    // Reset pagination state when setting new messages
    setCursors({});
    setHasMorePages(true);
  }, []);

  return {
    messages: allMessages,
    isLoading: isInitialLoading,
    isLoadingMore,
    error: initialError || loadMoreError,
    hasMoreMessages: hasMorePages,
    loadMoreMessages,
    addMessage,
    setMessages,
    refetch: refetchInitial
  };
}