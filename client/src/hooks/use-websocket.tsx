import { useEffect, useRef, useState, useCallback } from 'react';
import { User, MessageWithUser } from '@shared/schema';
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
  
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [messages, setMessages] = useState<MessageWithUser[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [roomOnlineUsers, setRoomOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [lastError, setLastError] = useState<string | null>(null);
  
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
    if (!userId || ws.current?.readyState === WebSocket.OPEN) return;

    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    
    // Ensure host is valid and properly formatted
    if (!host || host.trim() === '') {
      console.error('Invalid host for WebSocket connection:', host);
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
    
    console.log(isReconnect ? 'Reconnecting to WebSocket...' : 'Connecting to WebSocket:', wsUrl);
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
      setLastError(`Failed to create WebSocket: ${error.message}`);
      return;
    }

    ws.current.onopen = () => {
      console.log('WebSocket connected successfully');
      setConnectionStatus('connected');
      retryCountRef.current = 0; // Reset retry count on successful connection
      isReconnectingRef.current = false;
      
      // Rejoin current room if we were in one
      if (currentRoomRef.current) {
        ws.current?.send(JSON.stringify({
          type: 'join',
          userId,
          roomId: currentRoomRef.current,
        }));
      }
      
      // Process any queued messages
      if (queuedCount > 0) {
        console.log(`Processing ${queuedCount} queued messages...`);
        processQueuedMessages();
      }
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('error');
      setLastError('Connection error occurred');
    };

    ws.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'new_message':
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
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.current.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      setConnectionStatus('disconnected');
      
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

  const joinRoom = useCallback((roomId: string) => {
    currentRoomRef.current = roomId; // Store current room for reconnection
    
    if (ws.current && ws.current.readyState === WebSocket.OPEN && userId) {
      ws.current.send(JSON.stringify({
        type: 'join',
        userId,
        roomId,
      }));
    }
  }, [userId]);

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

  const sendMessage = useCallback((content: string, photoUrl?: string, photoFileName?: string) => {
    const messageType = photoUrl ? 'photo' : 'text';
    
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      try {
        ws.current.send(JSON.stringify({
          type: 'message',
          content,
          photoUrl,
          photoFileName,
          messageType,
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

  const sendTyping = useCallback((isTyping: boolean) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      try {
        ws.current.send(JSON.stringify({
          type: 'typing',
          isTyping,
        }));
      } catch (error) {
        console.error('Failed to send typing indicator:', error);
        // Don't queue typing indicators as they're not critical
      }
    }
    // Don't queue typing indicators for offline sending as they're ephemeral
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
