import { createContext, useContext, useState } from 'react';
import { useWebSocket } from '@/hooks/use-websocket';
import type { User, MessageWithUser } from '@shared/schema';

interface WebSocketContextType {
  isConnected: boolean;
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error' | 'reconnecting';
  lastError: string | null;
  messages: MessageWithUser[];
  onlineUsers: Set<string>;
  roomOnlineUsers: Set<string>;
  typingUsers: Set<string>;
  queuedCount: number;
  failedCount: number;
  isProcessingQueue: boolean;
  joinRoom: (roomId: string, clearMessages?: boolean) => void;
  sendMessage: (content: string, photoUrl?: string, photoFileName?: string, mentionedUserIds?: string[]) => void;
  sendTyping: (isTyping: boolean) => void;
  setMessages: React.Dispatch<React.SetStateAction<MessageWithUser[]>>;
  reconnect: () => void;
  clearFailedMessages: () => void;
  currentRoom: string | null;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

interface WebSocketProviderProps {
  children: React.ReactNode;
  user: User | null;
}

export function WebSocketProvider({ children, user }: WebSocketProviderProps) {
  const [currentRoom, setCurrentRoom] = useState<string | null>(() => {
    // Restore current room from localStorage
    const saved = localStorage.getItem('chatual_active_room');
    return saved ? JSON.parse(saved).id : null;
  });

  const websocketData = useWebSocket(user?.id);

  // Track the current room for the context
  const joinRoom = (roomId: string, clearMessages: boolean = true) => {
    setCurrentRoom(roomId);
    // Save active room to localStorage
    localStorage.setItem('chatual_active_room', JSON.stringify({ id: roomId }));
    websocketData.joinRoom(roomId, clearMessages);
  };

  const contextValue: WebSocketContextType = {
    ...websocketData,
    joinRoom,
    currentRoom,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
}