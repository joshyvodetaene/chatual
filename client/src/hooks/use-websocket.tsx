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
  maxAttempts: 8, // More retry attempts for better resilience
  baseDelay: 500, // Faster initial retry (0.5 seconds)
  maxDelay: 15000, // Shorter max delay to reconnect faster (15 seconds)
  backoffMultiplier: 1.5 // Less aggressive backoff
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

    // Ensure host is valid and properly formatted
    if (!host || host.trim() === '') {
      console.error('[WS_HOOK] Invalid host for WebSocket connection:', host);
      setLastError('Invalid WebSocket host');
      return;
    }

    const wsUrl = `${protocol}//${host}/ws`;

    // Validate the WebSocket URL
    try {
      new URL(wsUrl);
    } catch (error) {
      console.error('Invalid WebSocket URL:', wsUrl, error);
      setLastError('Invalid WebSocket URL');
      return;
    }

    const isReconnect = isReconnectingRef.current;

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
      setConnectionStatus('connected');
      setLastError(null);
      retryCountRef.current = 0; // Reset retry count on successful connection
      isReconnectingRef.current = false;

      // Rejoin current room if we were in one
      if (currentRoomRef.current) {
  
        // If this is a reconnection, fetch missed messages first
        if (isReconnect && disconnectionTimeRef.current) {
          fetchMissedMessages(currentRoomRef.current).then(() => {
            // Join room after fetching missed messages
            joinRoom(currentRoomRef.current!, false);
          }).catch((error) => {
            console.error('[WS_HOOK] Error fetching missed messages, joining room anyway:', error);
            joinRoom(currentRoomRef.current!, false);
          });
        } else {
          // First connection or no disconnection time - just join
          joinRoom(currentRoomRef.current, false);
        }
      }

      // Process any queued messages after a short delay to ensure room join completes
      if (queuedCount > 0) {
        setTimeout(() => {
          processQueuedMessages();
        }, 500);
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
      try {
        const message = JSON.parse(event.data);

        // Use requestIdleCallback for non-critical updates to improve performance and prevent HMR interruptions
        const processMessage = () => {
          switch (message.type) {
          case 'new_message':
            // Update last message timestamp for the room
            if (message.message?.roomId && message.message?.createdAt) {
              lastMessageTimestampRef.current[message.message.roomId] = message.message.createdAt;
            }

            setMessages(prev => [...prev, message.message]);
            break;
          case 'user_joined':
            setOnlineUsers(prev => new Set([...Array.from(prev), message.userId]));
            break;
          case 'user_left':
            setOnlineUsers(prev => {
              const newSet = new Set(prev);
              newSet.delete(message.userId);
              return newSet;
            });
            break;
          case 'room_online_users':
            setRoomOnlineUsers(new Set(message.onlineUsers));
            break;
          case 'user_typing':
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
            // Show notification to user
            toast({
              title: "New Private Chat",
              description: `${message.fromUser?.username || 'Someone'} wants to start a private chat with you`,
              duration: 5000,
            });
            // Refresh chat data to include the new private room
            if (userId) {
              queryClient.invalidateQueries({ queryKey: ['/api/chat-data', userId] });
            }
            break;
          case 'private_chat_closed':
            // Show notification to user
            toast({
              title: "Private Chat Closed",
              description: message.message || `${message.closedBy?.username || 'Someone'} has closed this private chat`,
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
            console.log('[WS_HOOK] Received notification:', message);
            // Dispatch custom event for notification center to catch
            const notificationEvent = new CustomEvent('websocket-notification', {
              detail: message
            });
            window.dispatchEvent(notificationEvent);
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

      // Handle normal closures (user logout, component unmounting)
      if (event.code === 1000 || event.reason === 'Component unmounting') {
        setConnectionStatus('disconnected');
        return;
      }

      // Handle server cleanup (code 1001) - treat as temporary interruption  
      if (event.code === 1001) {
        setConnectionStatus('connecting');

        // Quick reconnect for server cleanup events without counting as retry
        setTimeout(() => {
          if (userId && ws.current?.readyState !== WebSocket.OPEN) {
            connect();
          }
        }, 300); // Very short delay for cleanup events
        return;
      }

      setConnectionStatus('disconnected');

      // Record disconnection time for smart reconnection
      disconnectionTimeRef.current = new Date();

      // Only attempt reconnection if we haven't exceeded max attempts
      if (retryCountRef.current < retryConfig.maxAttempts && userId) {
        isReconnectingRef.current = true;
        retryCountRef.current += 1;
        const delay = calculateRetryDelay(retryCountRef.current - 1);

        setLastError(`Connection lost. Retrying in ${Math.ceil(delay / 1000)}s (${retryCountRef.current}/${retryConfig.maxAttempts})`);

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      } else if (retryCountRef.current >= retryConfig.maxAttempts) {
        setLastError('Connection failed after maximum retry attempts. Check your internet connection.');
        setConnectionStatus('error');
        isReconnectingRef.current = false;
        console.error('[WS_HOOK] Max reconnection attempts reached');
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
    console.log(`[WS_HOOK] Joining room: ${roomId}, clearMessages: ${clearMessages}`);

    // Store previous room for cleanup
    const previousRoom = currentRoomRef.current;
    currentRoomRef.current = roomId;

    // Clear messages only when explicitly requested (new room join, not reconnection)
    if (clearMessages) {
      setMessages([]);
      // Clear typing users when switching rooms
      setTypingUsers(new Set());
      setRoomOnlineUsers(new Set());
    }

    if (ws.current && ws.current.readyState === WebSocket.OPEN && userId) {
      try {
        // Send leave message for previous room if switching rooms
        if (previousRoom && previousRoom !== roomId && clearMessages) {
          console.log(`[WS_HOOK] Leaving previous room: ${previousRoom}`);
          ws.current.send(JSON.stringify({
            type: 'leave',
            userId,
            roomId: previousRoom,
          }));
        }

        // Join new room
        console.log(`[WS_HOOK] Sending join request for room: ${roomId}`);
        ws.current.send(JSON.stringify({
          type: 'join',
          userId,
          roomId,
        }));
      } catch (error) {
        console.error('[WS_HOOK] Error joining room:', error);
        setLastError(`Failed to join room: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      console.log(`[WS_HOOK] Cannot join room - WebSocket not ready. Status: ${ws.current?.readyState}, userId: ${userId}`);
      // If WebSocket is not ready, we'll rejoin when it reconnects
    }
  }, [userId]);

  // Fetch messages that were missed during disconnection
  const fetchMissedMessages = useCallback(async (roomId: string) => {
    if (!disconnectionTimeRef.current) {
      console.log('[WS_HOOK] No disconnection timestamp available, skipping missed messages fetch');
      return;
    }

    const disconnectionTimestamp = disconnectionTimeRef.current.toISOString();

    try {
      const response = await fetch(`/api/rooms/${roomId}/messages/since?timestamp=${encodeURIComponent(disconnectionTimestamp)}&limit=100`);
      if (!response.ok) {
        throw new Error(`Failed to fetch missed messages: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.items && data.items.length > 0) {
        // Add missed messages to current messages, avoiding duplicates
        setMessages(prev => {
          const existingIds = new Set(prev.map(msg => msg.id));
          const newMessages = data.items.filter((msg: MessageWithUser) => !existingIds.has(msg.id));

          if (newMessages.length > 0) {
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
    // Only treat as photo if we have a valid photo URL (not just 'photo' string)
    const messageType = (photoUrl && photoUrl !== 'photo' && photoUrl.length > 5) ? 'photo' : 'text';

    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      try {
        console.log('Sending WebSocket message:', {
          type: 'message',
          content: content?.substring(0, 20),
          photoUrl: messageType === 'photo' ? photoUrl?.substring(photoUrl?.length - 30) : undefined,
          photoFileName,
          messageType
        });

        ws.current.send(JSON.stringify({
          type: 'message',
          content,
          photoUrl: messageType === 'photo' ? photoUrl : undefined,
          photoFileName: messageType === 'photo' ? photoFileName : undefined,
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

  // Connection health check
  const healthCheck = useCallback(() => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      try {
        ws.current.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        return true;
      } catch (error) {
        console.error('[WS_HOOK] Health check failed:', error);
        return false;
      }
    }
    return false;
  }, []);

  // Periodic health check
  useEffect(() => {
    if (connectionStatus === 'connected') {
      const healthCheckInterval = setInterval(() => {
        if (!healthCheck()) {
          console.log('[WS_HOOK] Health check failed, attempting reconnection');
          reconnect();
        }
      }, 30000); // Check every 30 seconds

      return () => clearInterval(healthCheckInterval);
    }
  }, [connectionStatus, healthCheck]);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    console.log('[WS_HOOK] Manual reconnection triggered');
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