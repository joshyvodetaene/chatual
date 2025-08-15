import { useEffect, useRef, useState } from 'react';
import { User, MessageWithUser } from '@shared/schema';

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export function useWebSocket(userId?: string) {
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<MessageWithUser[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = process.env.NODE_ENV === 'development' ? 'localhost:5000' : window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;
    
    console.log('Connecting to WebSocket:', wsUrl);
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log('WebSocket connected successfully');
      setIsConnected(true);
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.current.onmessage = (event) => {
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
    };

    ws.current.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      setIsConnected(false);
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [userId]);

  const joinRoom = (roomId: string) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN && userId) {
      ws.current.send(JSON.stringify({
        type: 'join',
        userId,
        roomId,
      }));
    }
  };

  const sendMessage = (content: string) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'message',
        content,
      }));
    }
  };

  const sendTyping = (isTyping: boolean) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'typing',
        isTyping,
      }));
    }
  };

  return {
    isConnected,
    messages,
    onlineUsers,
    typingUsers,
    joinRoom,
    sendMessage,
    sendTyping,
    setMessages,
  };
}
