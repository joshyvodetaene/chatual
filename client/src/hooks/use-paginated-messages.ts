import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageWithUser, PaginatedResponse } from '@shared/schema';

interface UsePaginatedMessagesOptions {
  roomId?: string;
  pageSize?: number; // Default is 20 for latest messages
  enabled?: boolean;
}

export function usePaginatedMessages({ 
  roomId, 
  pageSize = 20, 
  enabled = true 
}: UsePaginatedMessagesOptions) {
  const [allMessages, setAllMessages] = useState<MessageWithUser[]>([]);
  const [cursors, setCursors] = useState<{ nextCursor?: string; prevCursor?: string }>({});
  const [hasMorePages, setHasMorePages] = useState(true);
  
  // Cache for preserving messages per room (especially important for private chats)
  const [messageCache, setMessageCache] = useState<Map<string, {
    messages: MessageWithUser[];
    cursors: { nextCursor?: string; prevCursor?: string };
    hasMorePages: boolean;
  }>>(new Map());

  // Handle room switching with message preservation for private chats
  useEffect(() => {
    if (!roomId) return;
    
    // Check if we have cached data for this room
    const cachedData = messageCache.get(roomId);
    
    if (cachedData) {
      // Restore cached messages for this room (preserving private chat history)
      setAllMessages(cachedData.messages);
      setCursors(cachedData.cursors);
      setHasMorePages(cachedData.hasMorePages);
    } else {
      // New room, start fresh
      setAllMessages([]);
      setCursors({});
      setHasMorePages(true);
    }
  }, [roomId, messageCache]);

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

  // Handle initial data updates and cache them
  useEffect(() => {
    if (initialData && roomId) {
      const newMessages = initialData.items;
      const newCursors = {
        nextCursor: initialData.nextCursor,
        prevCursor: initialData.prevCursor
      };
      const newHasMorePages = initialData.hasMore;
      
      setAllMessages(newMessages);
      setCursors(newCursors);
      setHasMorePages(newHasMorePages);
      
      // Cache the data for this room to preserve history (especially for private chats)
      setMessageCache(prev => new Map(prev).set(roomId, {
        messages: newMessages,
        cursors: newCursors,
        hasMorePages: newHasMorePages
      }));
    }
  }, [initialData, roomId]);

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

  // Handle more data updates and cache them
  useEffect(() => {
    if (moreData && roomId) {
      // Prepend older messages to the beginning of the list
      const updatedMessages = [...moreData.items, ...allMessages];
      const updatedCursors = {
        ...cursors,
        nextCursor: moreData.nextCursor,
      };
      const updatedHasMorePages = moreData.hasMore;
      
      setAllMessages(updatedMessages);
      setCursors(updatedCursors);
      setHasMorePages(updatedHasMorePages);
      
      // Update cache with new messages
      setMessageCache(prev => new Map(prev).set(roomId, {
        messages: updatedMessages,
        cursors: updatedCursors,
        hasMorePages: updatedHasMorePages
      }));
    }
  }, [moreData, roomId, allMessages, cursors]);

  const loadMoreMessages = useCallback(async () => {
    if (!hasMorePages || isLoadingMore || !cursors.nextCursor) return;
    
    try {
      await fetchMoreMessages();
    } catch (error) {
      console.error('Failed to load more messages:', error);
    }
  }, [hasMorePages, isLoadingMore, cursors.nextCursor, fetchMoreMessages]);

  // Add new message (from WebSocket) to the end and cache it
  const addMessage = useCallback((message: MessageWithUser) => {
    if (!roomId) return;
    
    const updatedMessages = [...allMessages, message];
    setAllMessages(updatedMessages);
    
    // Update cache with the new message to preserve it (important for private chats)
    setMessageCache(prev => {
      const current = prev.get(roomId);
      if (current) {
        return new Map(prev).set(roomId, {
          ...current,
          messages: updatedMessages
        });
      }
      return prev;
    });
  }, [roomId, allMessages]);

  // Replace all messages (when switching rooms) and cache them
  const setMessages = useCallback((messages: MessageWithUser[]) => {
    if (!roomId) return;
    
    setAllMessages(messages);
    
    // Update cache with the new message set to preserve it (important for private chats)
    setMessageCache(prev => {
      const current = prev.get(roomId);
      if (current) {
        return new Map(prev).set(roomId, {
          ...current,
          messages: messages
        });
      } else {
        // Create new cache entry for this room
        return new Map(prev).set(roomId, {
          messages: messages,
          cursors: {},
          hasMorePages: true
        });
      }
    });
  }, [roomId]);

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