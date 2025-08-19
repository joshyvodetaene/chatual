import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { User, Room, RoomWithMembers, MessageWithUser, PrivateRoom, PrivateChatData, BlockedUserWithDetails } from '@shared/schema';
import { useWebSocket } from '@/hooks/use-websocket';
import { usePaginatedMessages } from '@/hooks/use-paginated-messages';
import { useResponsive } from '@/hooks/use-responsive';
import { apiRequest, queryClient } from '@/lib/queryClient';
import Sidebar from '@/components/chat/sidebar';
import MessageList from '@/components/chat/message-list';
import MessageInput from '@/components/chat/message-input';
import UserList from '@/components/chat/user-list';
import CreateRoomModal from '@/components/chat/create-room-modal';
import AuthScreen from '@/components/auth/auth-screen';
import { Button } from '@/components/ui/button';
import { MobileMenu } from '@/components/ui/mobile-menu';
import { Hash, Users, Search, Settings, LogOut, Shield, Menu } from 'lucide-react';
import { BackButton } from '@/components/ui/back-button';
import { ConnectionStatusIndicator } from '@/components/chat/connection-status';
import { Link } from 'wouter';
import { cn } from '@/lib/utils';

export default function ChatPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('chatual_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [showUserList, setShowUserList] = useState(false);
  const [showSidebarMobile, setShowSidebarMobile] = useState(false);
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [privateRooms, setPrivateRooms] = useState<PrivateRoom[]>([]);
  const currentJoinedRoom = useRef<string | null>(null);

  const { 
    isConnected,
    connectionStatus,
    lastError,
    messages, 
    onlineUsers, 
    roomOnlineUsers,
    typingUsers,
    queuedCount,
    failedCount,
    isProcessingQueue,
    joinRoom, 
    sendMessage, 
    sendTyping,
    setMessages,
    reconnect,
    clearFailedMessages
  } = useWebSocket(currentUser?.id);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      if (currentUser?.id) {
        await apiRequest('POST', '/api/auth/logout', { userId: currentUser.id });
      }
    },
    onSuccess: () => {
      setCurrentUser(null);
      localStorage.removeItem('chatual_user');
      // Clear all query cache to prevent stale data issues
      queryClient.clear();
      // Force a page reload to reset all state cleanly
      window.location.reload();
    },
    onError: () => {
      // Even if logout fails on server, clear local state
      setCurrentUser(null);
      localStorage.removeItem('chatual_user');
      queryClient.clear();
      window.location.reload();
    },
  });

  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('chatual_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const { data: roomsData } = useQuery<{ rooms: Room[] }>({
    queryKey: ['/api/rooms'],
    enabled: !!currentUser,
  });

  const { data: chatData } = useQuery<PrivateChatData>({
    queryKey: ['/api/chat-data', currentUser?.id],
    enabled: !!currentUser?.id,
  });

  const { data: blockedUsersData } = useQuery<BlockedUserWithDetails[]>({
    queryKey: ['/api/users', currentUser?.id, 'blocked-users'],
    enabled: !!currentUser?.id,
  });

  // Handle chat data changes
  useEffect(() => {
    if (chatData) {
      setPrivateRooms(chatData.privateRooms || []);
    }
  }, [chatData]);

  const { data: activeRoomData } = useQuery<{ room: RoomWithMembers }>({
    queryKey: ['/api/rooms', activeRoom?.id],
    enabled: !!activeRoom?.id,
  });

  // Use paginated messages for the active room
  const {
    messages: paginatedMessages,
    isLoading: messagesLoading,
    isLoadingMore,
    hasMoreMessages,
    loadMoreMessages,
    addMessage,
    setMessages: setPaginatedMessages
  } = usePaginatedMessages({
    roomId: activeRoom?.id,
    enabled: !!activeRoom?.id
  });

  // Sync paginated messages with WebSocket messages
  useEffect(() => {
    if (paginatedMessages.length > 0 && paginatedMessages !== messages) {
      setMessages(paginatedMessages);
    }
  }, [paginatedMessages, messages, setMessages]);

  // Handle new messages from WebSocket
  useEffect(() => {
    // When we receive a new message via WebSocket, add it to paginated messages too
    if (messages.length > paginatedMessages.length) {
      const newMessage = messages[messages.length - 1];
      if (newMessage && !paginatedMessages.find(m => m.id === newMessage.id)) {
        addMessage(newMessage);
      }
    }
  }, [messages, paginatedMessages, addMessage]);

  // Join room when active room changes
  useEffect(() => {
    if (activeRoom?.id && currentUser?.id && currentJoinedRoom.current !== activeRoom.id) {
      currentJoinedRoom.current = activeRoom.id;
      joinRoom(activeRoom.id);
      
      // Join room on server
      fetch(`/api/rooms/${activeRoom.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      });
    }
  }, [activeRoom?.id, currentUser?.id, joinRoom]);

  // Set initial active room
  useEffect(() => {
    if (roomsData?.rooms && roomsData.rooms.length > 0 && !activeRoom) {
      setActiveRoom(roomsData.rooms[0]);
    }
  }, [roomsData, activeRoom]);

  const handleRoomSelect = (room: Room) => {
    setActiveRoom(room);
  };

  const handleSendMessage = (content: string, photoUrl?: string, photoFileName?: string) => {
    sendMessage(content, photoUrl, photoFileName);
  };

  const handleStartPrivateChat = async (userId: string) => {
    if (!currentUser?.id) return;
    
    // Check if trying to start private chat with blocked user
    const blockedUserIds = new Set(blockedUsersData?.map(bu => bu.blockedId) || []);
    if (blockedUserIds.has(userId)) {
      // This shouldn't happen as blocked users should be filtered out,
      // but adding this as a safety check
      return;
    }
    
    try {
      const response = await apiRequest('POST', '/api/private-chat/create', {
        user1Id: currentUser.id,
        user2Id: userId,
      });
      const data = await response.json() as { room: Room };
      
      if (data.room) {
        setActiveRoom(data.room);
        // Refresh private rooms list
        queryClient.invalidateQueries({ queryKey: ['/api/chat-data', currentUser.id] });
      }
    } catch (error) {
      console.error('Failed to create private chat:', error);
    }
  };

  if (!currentUser) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  // Auto-show user list on desktop, hide on mobile/tablet
  useEffect(() => {
    setShowUserList(isDesktop);
  }, [isDesktop]);

  const handleRoomSelectMobile = (room: Room) => {
    handleRoomSelect(room);
    if (isMobile) {
      setShowSidebarMobile(false);
    }
  };

  return (
    <div className="h-screen flex overflow-hidden bg-background sensual-gradient" data-testid="chat-application">
      {/* Desktop Sidebar */}
      {isDesktop && (
        <Sidebar
          currentUser={currentUser}
          rooms={roomsData?.rooms || []}
          privateRooms={privateRooms}
          activeRoom={activeRoom}
          onRoomSelect={handleRoomSelect}
          onCreateRoom={() => setShowCreateRoom(true)}
          onStartPrivateChat={handleStartPrivateChat}
          className="hidden lg:flex"
        />
      )}

      {/* Mobile Sidebar */}
      {(isMobile || isTablet) && (
        <MobileMenu
          side="left"
          contentClassName="w-80 bg-sidebar border-r border-border"
        >
          <Sidebar
            currentUser={currentUser}
            rooms={roomsData?.rooms || []}
            privateRooms={privateRooms}
            activeRoom={activeRoom}
            onRoomSelect={handleRoomSelectMobile}
            onCreateRoom={() => setShowCreateRoom(true)}
            onStartPrivateChat={handleStartPrivateChat}
            className="h-full"
            isMobile={true}
          />
        </MobileMenu>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-4 lg:px-6 red-glow">
          <div className="flex items-center space-x-3">
            {/* Mobile Menu Button */}
            {(isMobile || isTablet) && (
              <MobileMenu
                side="left"
                triggerClassName="text-gray-300 hover:text-white hover:bg-primary/20 mr-2"
                contentClassName="w-80 bg-sidebar border-r border-border"
              >
                <Sidebar
                  currentUser={currentUser}
                  rooms={roomsData?.rooms || []}
                  privateRooms={privateRooms}
                  activeRoom={activeRoom}
                  onRoomSelect={handleRoomSelectMobile}
                  onCreateRoom={() => setShowCreateRoom(true)}
                  onStartPrivateChat={handleStartPrivateChat}
                  className="h-full"
                  isMobile={true}
                />
              </MobileMenu>
            )}
            
            <BackButton className={cn("mr-2", (isMobile || isTablet) && "hidden")} />
            
            <div className="w-8 h-8 bg-primary text-white rounded-lg flex items-center justify-center red-glow">
              <Hash className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-white truncate" data-testid="room-name">
                {activeRoom?.name || 'Select a room'}
              </h2>
              <p className="text-xs text-gray-400 hidden sm:block" data-testid="room-member-count">
                {activeRoomData?.room?.memberCount || 0} members
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-1 sm:space-x-2">
            {/* User List Toggle - Desktop Only */}
            {isDesktop && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowUserList(!showUserList)}
                data-testid="button-toggle-user-list"
                className="text-gray-300 hover:text-white hover:bg-primary/20"
              >
                <Users className="w-4 h-4" />
              </Button>
            )}
            
            {/* Mobile User List */}
            {(isMobile || isTablet) && activeRoomData?.room && (
              <MobileMenu
                side="right"
                triggerClassName="text-gray-300 hover:text-white hover:bg-primary/20"
                contentClassName="w-80 bg-white border-l border-gray-200"
              >
                <UserList
                  room={activeRoomData.room}
                  onlineUsers={roomOnlineUsers}
                  currentUser={currentUser}
                  onStartPrivateChat={handleStartPrivateChat}
                  blockedUserIds={new Set(blockedUsersData?.map(bu => bu.blockedId) || [])}
                  isMobile={true}
                />
              </MobileMenu>
            )}
            
            <Button variant="ghost" size="sm" data-testid="button-search" className="text-gray-300 hover:text-white hover:bg-primary/20 hidden sm:flex">
              <Search className="w-4 h-4" />
            </Button>
            <Link href="/settings">
              <Button variant="ghost" size="sm" data-testid="button-settings" className="text-gray-300 hover:text-white hover:bg-primary/20">
                <Settings className="w-4 h-4" />
              </Button>
            </Link>
            {currentUser?.role === 'admin' && (
              <Link href="/admin">
                <Button variant="ghost" size="sm" data-testid="button-admin" className="text-gray-300 hover:text-white hover:bg-primary/20 hidden sm:flex">
                  <Shield className="w-4 h-4" />
                </Button>
              </Link>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
              data-testid="button-logout"
              className="text-gray-300 hover:text-primary hover:bg-primary/20 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Connection Status Indicator */}
        <ConnectionStatusIndicator
          connectionStatus={connectionStatus}
          lastError={lastError}
          queuedCount={queuedCount}
          failedCount={failedCount}
          isProcessingQueue={isProcessingQueue}
          onReconnect={reconnect}
          onClearFailed={clearFailedMessages}
        />

        {/* Messages */}
        <MessageList
          messages={paginatedMessages}
          currentUser={currentUser}
          typingUsers={typingUsers}
          activeRoomData={activeRoomData?.room}
          isLoading={messagesLoading}
          isLoadingMore={isLoadingMore}
          hasMoreMessages={hasMoreMessages}
          onLoadMore={loadMoreMessages}
          onStartPrivateChat={handleStartPrivateChat}
        />

        {/* Message Input */}
        <MessageInput
          onSendMessage={handleSendMessage}
          onTyping={sendTyping}
          disabled={!activeRoom || !isConnected}
        />
      </div>

      {/* Desktop User List */}
      {isDesktop && showUserList && activeRoomData?.room && (
        <UserList
          room={activeRoomData.room}
          onlineUsers={roomOnlineUsers}
          currentUser={currentUser}
          onStartPrivateChat={handleStartPrivateChat}
          blockedUserIds={new Set(blockedUsersData?.map(bu => bu.blockedId) || [])}
        />
      )}

      {/* Create Room Modal */}
      <CreateRoomModal
        isOpen={showCreateRoom}
        onClose={() => setShowCreateRoom(false)}
        currentUser={currentUser}
      />
    </div>
  );
}
