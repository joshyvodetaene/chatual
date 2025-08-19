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
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentRoomIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null); // Renamed from userIdRef to currentUserIdRef for clarity in connection logic
  const retryCountRef = useRef(0);
  const isReconnectingRef = useRef(false); // Corrected from isReconnecting to isReconnectingRef

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
  const connect = useCallback((currentUserId?: string) => { // Added currentUserId parameter
    const effectiveUserId = currentUserId || userId; // Use provided ID or hook's userId
    userIdRef.current = effectiveUserId; // Update ref with the current user ID

    console.log(`[WS_HOOK] Connect called: userId=${effectiveUserId}, current readyState=${ws.current?.readyState}`);

    if (!effectiveUserId) {
      console.warn('[WS_HOOK] Cannot connect: userId is not provided.');
      setConnectionStatus('disconnected');
      return;
    }

    if (ws.current?.readyState === WebSocket.OPEN) {
      console.log(`[WS_HOOK] WebSocket already connected, skipping connection attempt`);
      return;
    }

    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      console.log(`[WS_HOOK] Clearing existing reconnect timeout`);
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Close existing connection if it's not already closed
    if (ws.current && ws.current.readyState !== WebSocket.CLOSED) {
      console.log('[WS_HOOK] Closing existing WebSocket connection before attempting reconnect.');
      ws.current.close();
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    console.log(`[WS_HOOK] Building WebSocket URL - protocol: ${protocol}, host: ${host}`);

    // Ensure host is valid and properly formatted
    if (!host || host.trim() === '') {
      console.error('[WS_HOOK] Invalid host for WebSocket connection:', host);
      setLastError('Invalid WebSocket host');
      setConnectionStatus('error');
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
      setConnectionStatus('error');
      return;
    }

    const isReconnect = isReconnectingRef.current;
    console.log(`[WS_HOOK] ${isReconnect ? 'Reconnecting' : 'Connecting'} to WebSocket: ${wsUrl}`);
    console.log(`[WS_HOOK] Retry attempt: ${retryCountRef.current}/${retryConfig.maxAttempts}`);

    setConnectionStatus(isReconnect ? 'reconnecting' : 'connecting');
    setLastError(null);

    try {
      ws.current = new WebSocket(wsUrl);
    } catch (error) {
      console.error('Failed to create WebSocket:', error, 'URL:', wsUrl);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setLastError(`Failed to create WebSocket: ${errorMessage}`);
      setConnectionStatus('error');
      return;
    }

    ws.current.onopen = () => {
      console.log(`[WS_HOOK] WebSocket connected successfully at ${new Date().toISOString()}`);
      console.log(`[WS_HOOK] Connection established on attempt ${retryCountRef.current + 1}`);

      setConnectionStatus('connected');
      setLastError(null);
      retryCountRef.current = 0; // Reset retry count on successful connection
      isReconnectingRef.current = false;

      // Rejoin current room if we were in one
      if (currentRoomIdRef.current) {
        console.log(`[WS_HOOK] Rejoining room: ${currentRoomIdRef.current}`);
        ws.current?.send(JSON.stringify({
          type: 'join',
          userId: effectiveUserId,
          roomId: currentRoomIdRef.current,
        }));
      }

      // Process any queued messages
      if (queuedCount > 0) {
        console.log(`[WS_HOOK] Processing ${queuedCount} queued messages...`);
        processQueuedMessages();
      }

      // Set up ping interval to keep connection alive
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      pingIntervalRef.current = setInterval(() => {
        if (ws.current?.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000); // Ping every 30 seconds
    };

    ws.current.onerror = (errorEvent) => {
      console.error('[WS_HOOK] WebSocket error occurred:', errorEvent);
      // The actual error message is not directly available in ErrorEvent in some browsers.
      // We might infer it from onclose or set a generic error.
      setConnectionStatus('error');
      setLastError('Connection error occurred. Check server logs.');
      // onclose will handle the retry logic
    };

    ws.current.onmessage = (event) => {
      console.log(`[WS_HOOK] Raw message received:`, event.data?.substring(0, 100));
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
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
            setRoomOnlineUsers(prev => { // Also remove from room specific users
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
            if (effectiveUserId) {
              queryClient.invalidateQueries({ queryKey: ['/api/chat-data', effectiveUserId] });
            }
            break;
          case 'pong': // Handle pong messages for keepalive
            console.log('[WS_HOOK] Pong received');
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
        // Handle potential JSON parsing errors gracefully
      }
    };

    ws.current.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      setConnectionStatus('disconnected');

      // Clear ping interval on close
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }

      // Only attempt reconnection if it wasn't a normal closure and we haven't exceeded max attempts
      if (event.code !== 1000 && retryCountRef.current < retryConfig.maxAttempts && effectiveUserId) {
        isReconnectingRef.current = true;
        retryCountRef.current += 1;
        const delay = calculateRetryDelay(retryCountRef.current - 1);

        console.log(`Reconnecting in ${delay}ms (attempt ${retryCountRef.current}/${retryConfig.maxAttempts})`);
        setLastError(`Connection lost. Retrying in ${Math.ceil(delay / 1000)}s (${retryCountRef.current}/${retryConfig.maxAttempts})`);

        reconnectTimeoutRef.current = setTimeout(() => {
          isReconnectingRef.current = false; // Reset flag before attempting reconnect
          connect(effectiveUserId); // Pass userId to connect for continuity
        }, delay);
      } else if (retryCountRef.current >= retryConfig.maxAttempts) {
        console.log('Max reconnection attempts reached.');
        setLastError('Connection failed after maximum retry attempts');
        setConnectionStatus('error');
        isReconnectingRef.current = false;
      } else {
        console.log('WebSocket closed normally or manual disconnect.');
        isReconnectingRef.current = false; // Ensure flag is reset for normal closures
      }
    };
  }, [userId, retryConfig, calculateRetryDelay, queuedCount, processQueue, enqueueMessage, joinRoom]); // Added dependencies

  // Effect for initial connection and cleanup
  useEffect(() => {
    // Only connect if userId is available
    if (userId) {
      connect(userId); // Pass userId to connect
    } else {
      // If userId is not available, ensure status is disconnected
      setConnectionStatus('disconnected');
    }

    // Cleanup function
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      if (ws.current) {
        console.log('[WS_HOOK] Closing WebSocket connection on unmount.');
        // Use a normal closure code when unmounting intentionally
        ws.current.close(1000, 'Component unmounting');
        ws.current = null; // Clear the ref
      }
    };
  }, [userId, connect]); // Depend on userId and connect

  const joinRoom = useCallback((roomId: string) => {
    currentRoomIdRef.current = roomId; // Store current room for reconnection

    if (ws.current && ws.current.readyState === WebSocket.OPEN && userId) {
      console.log(`[WS_HOOK] Joining room: ${roomId}`);
      ws.current.send(JSON.stringify({
        type: 'join',
        userId,
        roomId,
      }));
    } else {
      console.warn(`[WS_HOOK] Cannot join room ${roomId}: WebSocket not open or userId missing.`);
    }
  }, [userId]);

  // Process queued messages when connection is restored
  const processQueuedMessages = useCallback(async () => {
    await processQueue(async (queuedMessage: QueuedMessage) => {
      if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
        return false; // Cannot process if not connected
      }

      try {
        if (queuedMessage.type === 'message') {
          ws.current.send(JSON.stringify({
            type: 'message',
            content: queuedMessage.content,
            roomId: queuedMessage.roomId, // Include roomId if available
          }));
        } else if (queuedMessage.type === 'typing') {
          ws.current.send(JSON.stringify({
            type: 'typing',
            isTyping: queuedMessage.content === 'true',
            roomId: queuedMessage.roomId, // Include roomId if available
          }));
        }
        return true; // Message sent successfully
      } catch (error) {
        console.error('Failed to send queued message:', error);
        return false; // Indicate failure to send
      }
    });
  }, [processQueue]);

  const sendMessage = useCallback((content: string, photoUrl?: string, photoFileName?: string) => {
    const messageType = photoUrl ? 'photo' : 'text';

    if (ws.current && ws.current.readyState === WebSocket.OPEN && userId) {
      try {
        console.log('Sending WebSocket message:', {
          type: 'message',
          content: content?.substring(0, 20),
          photoUrl: photoUrl?.substring(photoUrl.length - 30),
          photoFileName,
          messageType,
          roomId: currentRoomIdRef.current
        });

        ws.current.send(JSON.stringify({
          type: 'message',
          content,
          photoUrl,
          photoFileName,
          messageType,
          roomId: currentRoomIdRef.current, // Associate message with current room
        }));
      } catch (error) {
        console.error('Failed to send message:', error);
        // Queue the message for offline sending
        enqueueMessage(content, 'message', currentRoomIdRef.current);
      }
    } else {
      // Queue message for offline sending
      console.log('Queuing message for offline sending:', { content: content?.substring(0, 20), roomId: currentRoomIdRef.current });
      enqueueMessage(content, 'message', currentRoomIdRef.current);
    }
  }, [enqueueMessage, userId]);

  // Add debouncing for typing indicators
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const sendTyping = useCallback((isTyping: boolean) => {
    // Clear any existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (ws.current && ws.current.readyState === WebSocket.OPEN && userId) {
      try {
        // Send typing indicator immediately
        ws.current.send(JSON.stringify({
          type: 'typing',
          isTyping,
          roomId: currentRoomIdRef.current, // Associate typing with current room
        }));

        // If starting to type, set timeout to auto-stop after 3 seconds
        if (isTyping) {
          typingTimeoutRef.current = setTimeout(() => {
            if (ws.current && ws.current.readyState === WebSocket.OPEN && userId) {
              try {
                ws.current.send(JSON.stringify({
                  type: 'typing',
                  isTyping: false,
                  roomId: currentRoomIdRef.current,
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
    } else {
      console.warn(`[WS_HOOK] Cannot send typing status: WebSocket not open or userId missing.`);
    }
  }, [userId]);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    retryCountRef.current = 0; // Reset retry count
    isReconnectingRef.current = true; // Set reconnecting flag
    connect(userId); // Attempt to connect using the current userId
  }, [connect, userId]);

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
    setMessages, // Expose setMessages if needed elsewhere for direct updates
    reconnect,
    // Offline queue status
    queuedMessages,
    queuedCount,
    failedCount,
    isProcessingQueue,
    clearFailedMessages,
  };
}