import { useEffect, useRef, useState, useCallback } from 'react';
import { User, MessageWithUser } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useOfflineQueue, type QueuedMessage } from './use-offline-queue';

// Connection status types
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';

// Retry configuration
interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 5,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2
};

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export function useWebSocket(userId?: string, retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG) {
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentRoomRef = useRef<string | null>(null);
  const retryCountRef = useRef(0);
  const isReconnectingRef = useRef(false);
  const disconnectionTimeRef = useRef<Date | null>(null);
  const lastMessageTimestampRef = useRef<{[roomId: string]: string}>({});

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [messages, setMessages] = useState<MessageWithUser[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [roomOnlineUsers, setRoomOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [lastError, setLastError] = useState<string | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Initialize offline queue for message queuing when disconnected
  const {
    queuedMessages,
    queuedCount,
    failedCount,
    isProcessing: isProcessingQueue,
    enqueueMessage,
    processQueue,
    clearFailedMessages
  } = useOfflineQueue();

  // Calculate retry delay with exponential backoff
  const calculateRetryDelay = useCallback((attempt: number): number => {
    const delay = retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, attempt);
    return Math.min(delay, retryConfig.maxDelay);
  }, [retryConfig]);

  // Connect to WebSocket with retry logic
  const connect = useCallback(() => {
    if (!userId || ws.current?.readyState === WebSocket.OPEN) {
      return;
    }

    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    console.log(`[WS_HOOK] Building WebSocket URL - protocol: ${protocol}, host: ${host}`);

    // Ensure host is valid and properly formatted
    if (!host || host.trim() === '') {
      console.error('[WS_HOOK] Invalid host for WebSocket connection:', host);
      setLastError('Invalid WebSocket host');
      return;
    }

    const wsUrl = `${protocol}//${host}/ws`;
    console.log(`[WS_HOOK] WebSocket URL constructed: ${wsUrl}`);

    // Validate the WebSocket URL
    try {
      new URL(wsUrl);
    } catch (error) {
      console.error('Invalid WebSocket URL:', wsUrl, error);
      setLastError('Invalid WebSocket URL');
      return;
    }

    const isReconnect = isReconnectingRef.current;
    console.log(`[WS_HOOK] ${isReconnect ? 'Reconnecting' : 'Connecting'} to WebSocket: ${wsUrl}`);
    console.log(`[WS_HOOK] Retry attempt: ${retryCountRef.current}/${retryConfig.maxAttempts}`);

    setConnectionStatus(isReconnect ? 'reconnecting' : 'connecting');
    setLastError(null);

    // Close existing connection if any
    if (ws.current) {
      ws.current.close();
    }

    try {
      ws.current = new WebSocket(wsUrl);
    } catch (error) {
      console.error('Failed to create WebSocket:', error, 'URL:', wsUrl);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setLastError(`Failed to create WebSocket: ${errorMessage}`);
      return;
    }

    ws.current.onopen = () => {
      console.log(`[WS_HOOK] WebSocket connected successfully at ${new Date().toISOString()}`);
      console.log(`[WS_HOOK] Connection established on attempt ${retryCountRef.current + 1}`);
      setConnectionStatus('connected');
      retryCountRef.current = 0; // Reset retry count on successful connection
      isReconnectingRef.current = false;

      // Rejoin current room if we were in one
      if (currentRoomRef.current) {
        console.log(`[WS_HOOK] Rejoining room: ${currentRoomRef.current}`);
        try {
          ws.current?.send(JSON.stringify({
            type: 'join',
            userId,
            roomId: currentRoomRef.current,
          }));
        } catch (error) {
          console.error('[WS_HOOK] Error rejoining room:', error);
        }

        // Fetch missed messages if this is a reconnection
        if (isReconnect && disconnectionTimeRef.current) {
          console.log(`[WS_HOOK] Smart reconnection - fetching missed messages since ${disconnectionTimeRef.current.toISOString()}`);
          fetchMissedMessages(currentRoomRef.current);
        }
      }

      // Process any queued messages
      if (queuedCount > 0) {
        console.log(`[WS_HOOK] Processing ${queuedCount} queued messages...`);
        processQueuedMessages();
      }

      // Clear disconnection time after successful reconnection
      if (isReconnect) {
        disconnectionTimeRef.current = null;
      }
    };

    ws.current.onerror = (error) => {
      console.error('[WS_HOOK] WebSocket error occurred:', error);
      console.error('[WS_HOOK] Error event details:', {
        type: (error as ErrorEvent).type,
        target: (error as ErrorEvent).target?.constructor.name,
        timestamp: new Date().toISOString()
      });
      setConnectionStatus('error');
      setLastError('Connection error occurred');
    };

    ws.current.onmessage = (event) => {
      console.log(`[WS_HOOK] Raw message received:`, event.data?.substring(0, 100));
      try {
        const message = JSON.parse(event.data);
        console.log(`[WS_HOOK] Parsed message type: ${message.type}`);

        // Use requestIdleCallback for non-critical updates to improve performance
        const processMessage = () => {
          switch (message.type) {
          case 'new_message':
            console.log('WebSocket received new_message:', {
              messageId: message.message?.id,
              messageType: message.message?.messageType,
              photoUrl: message.message?.photoUrl,
              content: message.message?.content?.substring(0, 20)
            });
            
            // Update last message timestamp for the room
            if (message.message?.roomId && message.message?.createdAt) {
              lastMessageTimestampRef.current[message.message.roomId] = message.message.createdAt;
            }
            
            setMessages(prev => [...prev, message.message]);
            break;
          case 'user_joined':
            console.log(`[WS_HOOK] User joined: ${message.userId}`);
            setOnlineUsers(prev => new Set([...Array.from(prev), message.userId]));
            break;
          case 'user_left':
            console.log(`[WS_HOOK] User left: ${message.userId}`);
            setOnlineUsers(prev => {
              const newSet = new Set(prev);
              newSet.delete(message.userId);
              return newSet;
            });
            break;
          case 'room_online_users':
            console.log(`[WS_HOOK] Room online users update: ${message.onlineUsers?.length} users in room ${message.roomId}`);
            setRoomOnlineUsers(new Set(message.onlineUsers));
            break;
          case 'user_typing':
            console.log(`[WS_HOOK] User typing event: ${message.userId} is ${message.isTyping ? 'typing' : 'not typing'}`);
            setTypingUsers(prev => {
              const newSet = new Set(prev);
              if (message.isTyping) {
                newSet.add(message.userId);
              } else {
                newSet.delete(message.userId);
              }
              return newSet;
            });
            break;
          case 'private_chat_request':
            console.log(`[WS_HOOK] Private chat request from ${message.fromUser?.displayName}: room ${message.roomId}`);
            // Show notification to user
            toast({
              title: "New Private Chat",
              description: `${message.fromUser?.displayName || 'Someone'} wants to start a private chat with you`,
              duration: 5000,
            });
            // Refresh chat data to include the new private room
            if (userId) {
              queryClient.invalidateQueries({ queryKey: ['/api/chat-data', userId] });
            }
            break;
          case 'private_chat_closed':
            console.log(`[WS_HOOK] Private chat closed by ${message.closedBy?.displayName}: room ${message.roomId}`);
            // Show notification to user
            toast({
              title: "Private Chat Closed",
              description: message.message || `${message.closedBy?.displayName || 'Someone'} has closed this private chat`,
              variant: "destructive",
              duration: 5000,
            });
            // Refresh chat data to remove the closed private room
            if (userId) {
              queryClient.invalidateQueries({ queryKey: ['/api/chat-data', userId] });
            }
            // Emit custom event to notify parent components
            window.dispatchEvent(new CustomEvent('private-chat-closed', {
              detail: { roomId: message.roomId, closedBy: message.closedBy }
            }));
            break;
          case 'notification':
            console.log(`[WS_HOOK] Received notification:`, {
              type: message.notification?.type,
              title: message.notification?.title,
              body: message.notification?.body
            });
            // Emit custom event for notification manager to handle
            window.dispatchEvent(new CustomEvent('websocket-notification', {
              detail: message.notification
            }));
            break;
          }
        };

        // Use requestIdleCallback for non-critical message processing
        if (typeof window.requestIdleCallback === 'function') {
          window.requestIdleCallback(processMessage);
        } else {
          // Fallback for browsers without requestIdleCallback
          setTimeout(processMessage, 0);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
        setLastError('Failed to parse incoming message');
      }
    };

    ws.current.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      setConnectionStatus('disconnected');
      
      // Record disconnection time for smart reconnection
      disconnectionTimeRef.current = new Date();

      // Only attempt reconnection if it wasn't a normal closure and we haven't exceeded max attempts
      if (event.code !== 1000 && retryCountRef.current < retryConfig.maxAttempts && userId) {
        isReconnectingRef.current = true;
        retryCountRef.current += 1;
        const delay = calculateRetryDelay(retryCountRef.current - 1);

        console.log(`Reconnecting in ${delay}ms (attempt ${retryCountRef.current}/${retryConfig.maxAttempts})`);
        setLastError(`Connection lost. Retrying in ${Math.ceil(delay / 1000)}s (${retryCountRef.current}/${retryConfig.maxAttempts})`);

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      } else if (retryCountRef.current >= retryConfig.maxAttempts) {
        setLastError('Connection failed after maximum retry attempts');
        setConnectionStatus('error');
        isReconnectingRef.current = false;
      }
    };
  }, [userId, retryConfig, calculateRetryDelay]);

  // Initial connection
  useEffect(() => {
    if (!userId) {
      setConnectionStatus('disconnected');
      return;
    }

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (ws.current) {
        ws.current.close(1000, 'Component unmounting');
      }
    };
  }, [userId, connect]);

  const joinRoom = useCallback((roomId: string, clearMessages: boolean = true) => {
    currentRoomRef.current = roomId; // Store current room for reconnection
    
    // Clear messages only when explicitly requested (new room join, not reconnection)
    if (clearMessages) {
      setMessages([]);
    }

    if (ws.current && ws.current.readyState === WebSocket.OPEN && userId) {
      try {
        ws.current.send(JSON.stringify({
          type: 'join',
          userId,
          roomId,
        }));
      } catch (error) {
        console.error('[WS_HOOK] Error joining room:', error);
      }
    }
  }, [userId]);

  // Fetch messages that were missed during disconnection
  const fetchMissedMessages = useCallback(async (roomId: string) => {
    if (!disconnectionTimeRef.current) {
      console.log('[WS_HOOK] No disconnection timestamp available, skipping missed messages fetch');
      return;
    }

    const disconnectionTimestamp = disconnectionTimeRef.current.toISOString();
    console.log(`[WS_HOOK] Fetching missed messages for room ${roomId} since ${disconnectionTimestamp}`);

    try {
      const response = await fetch(`/api/rooms/${roomId}/messages/since?timestamp=${encodeURIComponent(disconnectionTimestamp)}&limit=100`);
      if (!response.ok) {
        throw new Error(`Failed to fetch missed messages: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`[WS_HOOK] Fetched ${data.items?.length || 0} missed messages`);

      if (data.items && data.items.length > 0) {
        // Add missed messages to current messages, avoiding duplicates
        setMessages(prev => {
          const existingIds = new Set(prev.map(msg => msg.id));
          const newMessages = data.items.filter((msg: MessageWithUser) => !existingIds.has(msg.id));
          
          if (newMessages.length > 0) {
            console.log(`[WS_HOOK] Adding ${newMessages.length} new missed messages`);
            // Sort by creation time to maintain chronological order
            const combined = [...prev, ...newMessages].sort((a, b) => 
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
            return combined;
          }
          
          return prev;
        });
      }
    } catch (error) {
      console.error('[WS_HOOK] Error fetching missed messages:', error);
    }
  }, []);

  // Process queued messages when connection is restored
  const processQueuedMessages = useCallback(async () => {
    await processQueue(async (queuedMessage: QueuedMessage) => {
      if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
        return false;
      }

      try {
        if (queuedMessage.type === 'message') {
          ws.current.send(JSON.stringify({
            type: 'message',
            content: queuedMessage.content,
          }));
        } else if (queuedMessage.type === 'typing') {
          ws.current.send(JSON.stringify({
            type: 'typing',
            isTyping: queuedMessage.content === 'true',
          }));
        }
        return true;
      } catch (error) {
        console.error('Failed to send queued message:', error);
        return false;
      }
    });
  }, [processQueue]);

  const sendMessage = useCallback((content: string, photoUrl?: string, photoFileName?: string, mentionedUserIds?: string[]) => {
    const messageType = photoUrl ? 'photo' : 'text';

    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      try {
        console.log('Sending WebSocket message:', {
          type: 'message',
          content: content?.substring(0, 20),
          photoUrl: photoUrl?.substring(photoUrl?.length - 30),
          photoFileName,
          messageType
        });

        ws.current.send(JSON.stringify({
          type: 'message',
          content,
          photoUrl,
          photoFileName,
          messageType,
          mentionedUserIds: mentionedUserIds || [],
        }));
      } catch (error) {
        console.error('Failed to send message:', error);
        // Queue the message for offline sending
        enqueueMessage(content, 'message', currentRoomRef.current || undefined);
      }
    } else {
      // Queue message for offline sending
      console.log('Queuing message for offline sending:', content);
      enqueueMessage(content, 'message', currentRoomRef.current || undefined);
    }
  }, [enqueueMessage]);

  // Add debouncing for typing indicators
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const sendTyping = useCallback((isTyping: boolean) => {
    // Clear any existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      try {
        // Send typing indicator immediately
        ws.current.send(JSON.stringify({
          type: 'typing',
          isTyping,
        }));

        // If starting to type, set timeout to auto-stop after 3 seconds
        if (isTyping) {
          typingTimeoutRef.current = setTimeout(() => {
            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
              try {
                ws.current.send(JSON.stringify({
                  type: 'typing',
                  isTyping: false,
                }));
              } catch (error) {
                console.error('Failed to send auto-stop typing indicator:', error);
              }
            }
          }, 3000);
        }
      } catch (error) {
        console.error('Failed to send typing indicator:', error);
      }
    }
  }, []);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    retryCountRef.current = 0;
    isReconnectingRef.current = true;
    connect();
  }, [connect]);

  return {
    isConnected: connectionStatus === 'connected',
    connectionStatus,
    lastError,
    messages,
    onlineUsers,
    roomOnlineUsers,
    typingUsers,
    joinRoom,
    sendMessage,
    sendTyping,
    setMessages,
    reconnect,
    // Offline queue status
    queuedMessages,
    queuedCount,
    failedCount,
    isProcessingQueue,
    clearFailedMessages,
  };
}