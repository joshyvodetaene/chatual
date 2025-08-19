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
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useTheme } from '@/contexts/ThemeContext';
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
  const { setUserId } = useTheme();
  const [privateRooms, setPrivateRooms] = useState<PrivateRoom[]>([]);
  const currentJoinedRoom = useRef<string | null>(null);

  // Always call hooks consistently - enable/disable with the enabled option
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

  const { data: activeRoomData } = useQuery<{ room: RoomWithMembers }>({
    queryKey: ['/api/rooms', activeRoom?.id],
    enabled: !!activeRoom?.id && !!currentUser,
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
    enabled: !!activeRoom?.id && !!currentUser
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      if (currentUser?.id) {
        await apiRequest('POST', '/api/auth/logout', { userId: currentUser.id });
      }
    },
    onSuccess: () => {
      setCurrentUser(null);
      localStorage.removeItem('chatual_user');
      // Reset theme context to login page (light theme)
      setUserId(null);
      // Clear all query cache to prevent stale data issues
      queryClient.clear();
    },
    onError: () => {
      // Even if logout fails on server, clear local state
      setCurrentUser(null);
      localStorage.removeItem('chatual_user');
      // Reset theme context to login page (light theme)
      setUserId(null);
      queryClient.clear();
    },
  });

  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('chatual_user', JSON.stringify(user));
    // Set user ID for theme context
    setUserId(user.id);
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Handle chat data changes
  useEffect(() => {
    if (chatData && currentUser) {
      setPrivateRooms(chatData.privateRooms || []);
    }
  }, [chatData, currentUser]);

  // Sync paginated messages with WebSocket messages
  useEffect(() => {
    if (currentUser && paginatedMessages.length > 0 && paginatedMessages !== messages) {
      setMessages(paginatedMessages);
    }
  }, [paginatedMessages, messages, setMessages, currentUser]);

  // Handle new messages from WebSocket (filter by current room)
  useEffect(() => {
    if (!currentUser || messages.length === 0 || !activeRoom?.id) return;

    messages.forEach((newMessage) => {
      // Only add message if it's for the current room and doesn't already exist
      if (newMessage.roomId === activeRoom.id && !paginatedMessages.find(m => m.id === newMessage.id)) {
        addMessage(newMessage);
      }
    });
  }, [messages, paginatedMessages, addMessage, currentUser, activeRoom?.id]);

  // Set user ID for theme context when user is available
  useEffect(() => {
    if (currentUser) {
      setUserId(currentUser.id);
    }
  }, [currentUser, setUserId]);

  // Join room when active room changes and clear messages
  useEffect(() => {
    if (activeRoom?.id && currentUser?.id && currentJoinedRoom.current !== activeRoom.id) {
      currentJoinedRoom.current = activeRoom.id;
      
      // Clear WebSocket messages when switching rooms
      setMessages([]);
      
      joinRoom(activeRoom.id);
      
      // Join room on server
      fetch(`/api/rooms/${activeRoom.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      });
    }
  }, [activeRoom?.id, currentUser?.id, joinRoom, setMessages]);

  // Debug: Log room online users state and messages
  useEffect(() => {
    console.log('Room online users:', roomOnlineUsers, 'Active room:', activeRoom?.name);
    console.log('Paginated messages:', paginatedMessages.length, 'Photo messages:', paginatedMessages.filter(m => m.messageType === 'photo').length);
    console.log('All messages with types:', paginatedMessages.map(m => ({ id: m.id, type: m.messageType, hasPhoto: !!m.photoUrl, content: m.content?.substring(0, 20) })));
  }, [roomOnlineUsers, activeRoom, paginatedMessages]);

  // Debug: Track activeRoom state changes
  useEffect(() => {
    console.log('ActiveRoom changed:', activeRoom ? { id: activeRoom.id, name: activeRoom.name } : 'null');
  }, [activeRoom]);

  // Set initial active room
  useEffect(() => {
    console.log('Active room effect - roomsData:', roomsData?.rooms?.length, 'activeRoom:', activeRoom?.name, 'currentUser:', !!currentUser);
    if (roomsData?.rooms && roomsData.rooms.length > 0 && !activeRoom && currentUser) {
      // Try to restore from localStorage first
      const savedRoom = localStorage.getItem('chatual_active_room');
      let roomToSet = roomsData.rooms[0]; // default
      
      if (savedRoom) {
        try {
          const parsedRoom = JSON.parse(savedRoom);
          const foundRoom = roomsData.rooms.find(r => r.id === parsedRoom.id);
          if (foundRoom) {
            roomToSet = foundRoom;
            console.log('Restored active room from localStorage:', foundRoom.name);
          }
        } catch (e) {
          console.log('Failed to parse saved room, using default');
        }
      }
      
      console.log('Setting initial active room to:', roomToSet.name);
      setActiveRoom(roomToSet);
      localStorage.setItem('chatual_active_room', JSON.stringify({ id: roomToSet.id, name: roomToSet.name }));
    }
  }, [roomsData?.rooms, activeRoom, currentUser]);

  // Auto-show user list on desktop, hide on mobile/tablet
  useEffect(() => {
    if (currentUser) {
      setShowUserList(isDesktop);
      console.log('Setting showUserList to:', isDesktop, 'for device type:', { isMobile, isTablet, isDesktop });
    }
  }, [isDesktop, currentUser, isMobile, isTablet]);

  const handleSendMessage = (content: string, photoUrl?: string, photoFileName?: string) => {
    console.log('handleSendMessage called with:', {
      content: content?.substring(0, 20),
      photoUrl: photoUrl?.substring(photoUrl.length - 30),
      photoFileName,
      currentUser: currentUser?.id,
      activeRoom: activeRoom?.id,
      activeRoomName: activeRoom?.name,
      roomsDataLength: roomsData?.rooms?.length
    });
    
    if (!currentUser?.id) {
      console.log('No current user, aborting send');
      return;
    }
    
    // First try to use current activeRoom
    let roomToUse = activeRoom;
    
    // If no activeRoom, try to find a room from roomsData
    if (!roomToUse?.id && roomsData?.rooms && roomsData.rooms.length > 0) {
      console.log('No activeRoom, using first available room:', roomsData.rooms[0].name);
      roomToUse = roomsData.rooms[0];
      // Also set it as active room for future messages
      setActiveRoom(roomsData.rooms[0]);
    }
    
    // If still no room, try to get from current joined room or use localStorage
    if (!roomToUse?.id) {
      console.log('No room available, checking localStorage for last room');
      const savedRoom = localStorage.getItem('chatual_active_room');
      if (savedRoom && roomsData?.rooms) {
        const parsedRoom = JSON.parse(savedRoom);
        roomToUse = roomsData.rooms.find(r => r.id === parsedRoom.id) || roomsData.rooms[0];
        if (roomToUse) {
          setActiveRoom(roomToUse);
        }
      }
    }
    
    if (!roomToUse?.id) {
      console.log('No room available for sending message. Waiting for room data...');
      // Wait a bit and try again if rooms are still loading
      setTimeout(() => {
        if (roomsData?.rooms && roomsData.rooms.length > 0) {
          console.log('Retrying send with loaded rooms');
          handleSendMessage(content, photoUrl, photoFileName);
        }
      }, 500);
      return;
    }

    // Send message via WebSocket without temporary message
    console.log('About to call sendMessage via WebSocket for room:', roomToUse.name);
    sendMessage(content, photoUrl, photoFileName);
  };

  const handleStartPrivateChat = async (userId: string) => {
    if (!currentUser?.id) return;
    
    try {
      const response = await apiRequest('POST', '/api/private-chat/create', {
        user1Id: currentUser.id,
        user2Id: userId,
      });
      
      const data = await response.json();
      
      // Invalidate chat data to refresh the room list
      await queryClient.invalidateQueries({ queryKey: ['/api/chat-data', currentUser.id] });
      
      // Set the new private room as active
      setActiveRoom(data.room);
    } catch (error) {
      console.error('Failed to start private chat:', error);
    }
  };

  const handleRoomSelect = (room: Room) => {
    setActiveRoom(room);
    // Save selected room to localStorage as backup
    localStorage.setItem('chatual_active_room', JSON.stringify({ id: room.id, name: room.name }));
    if (isMobile || isTablet) {
      setShowSidebarMobile(false);
    }
  };

  // Return authentication screen if no user
  if (!currentUser) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="h-screen flex bg-gray-50 overflow-hidden">
      {/* Mobile Sidebar */}
      {(isMobile || isTablet) && (
        <MobileMenu
          side="left"
          className="w-80"
        >
          <Sidebar
            rooms={roomsData?.rooms || []}
            privateRooms={privateRooms}
            activeRoom={activeRoom}
            onRoomSelect={handleRoomSelect}
            currentUser={currentUser}
            onCreateRoom={() => setShowCreateRoom(true)}
            onStartPrivateChat={handleStartPrivateChat}
          />
        </MobileMenu>
      )}

      {/* Desktop Sidebar */}
      {isDesktop && (
        <Sidebar
          rooms={roomsData?.rooms || []}
          privateRooms={privateRooms}
          activeRoom={activeRoom}
          onRoomSelect={handleRoomSelect}
          currentUser={currentUser}
          onCreateRoom={() => setShowCreateRoom(true)}
          onStartPrivateChat={handleStartPrivateChat}
          className="w-80 border-r border-gray-200"
        />
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className={cn(
          "bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between",
          isMobile && "px-3 py-2"
        )}>
          <div className="flex items-center space-x-3 min-w-0">
            {(isMobile || isTablet) && (
              <MobileMenu
                side="left"
                className="w-80"
                triggerClassName="mr-2"
              >
                <Sidebar
                  rooms={roomsData?.rooms || []}
                  privateRooms={privateRooms}
                  activeRoom={activeRoom}
                  onRoomSelect={handleRoomSelect}
                  currentUser={currentUser}
                  onCreateRoom={() => setShowCreateRoom(true)}
                  onStartPrivateChat={handleStartPrivateChat}
                />
              </MobileMenu>
            )}
            
            <Hash className={cn(
              "text-gray-500",
              isMobile ? "w-4 h-4" : "w-5 h-5"
            )} />
            <h1 className={cn(
              "font-semibold text-gray-900 truncate",
              isMobile ? "text-base" : "text-lg"
            )}>
              {activeRoom?.name || 'Select a room'}
            </h1>
            
            <ConnectionStatusIndicator 
              connectionStatus={connectionStatus}
              lastError={lastError}
              queuedCount={queuedCount}
              failedCount={failedCount}
              isProcessingQueue={isProcessingQueue}
              onReconnect={reconnect}
              onClearFailed={clearFailedMessages}
            />
          </div>

          <div className={cn(
            "flex items-center",
            isMobile ? "space-x-1" : "space-x-2"
          )}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowUserList(!showUserList)}
              className={cn(
                "text-gray-500 hover:text-gray-700",
                showUserList && "bg-gray-100 text-gray-700"
              )}
              data-testid="button-toggle-user-list"
            >
              <Users className="w-4 h-4" />
            </Button>

            <Link href="/settings">
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-500 hover:text-gray-700"
                data-testid="button-settings"
              >
                <Settings className={cn(
                  isMobile ? "w-4 h-4" : "w-4 h-4"
                )} />
              </Button>
            </Link>

            {currentUser.role === 'admin' && (
              <Link href="/admin">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-500 hover:text-gray-700"
                  data-testid="button-admin"
                >
                  <Shield className={cn(
                    isMobile ? "w-4 h-4" : "w-4 h-4"
                  )} />
                </Button>
              </Link>
            )}

            <ThemeToggle
              variant="ghost"
              size="sm"
            />

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-gray-500 hover:text-gray-700"
              data-testid="button-logout"
            >
              <LogOut className={cn(
                isMobile ? "w-4 h-4" : "w-4 h-4"
              )} />
            </Button>
          </div>
        </div>

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
          isMobile={isMobile}
        />

        {/* Message Input */}
        <MessageInput
          onSendMessage={handleSendMessage}
          onTyping={(isTyping: boolean) => {
            if (activeRoom?.id && currentUser?.id) {
              sendTyping(isTyping);
            }
          }}
          disabled={!isConnected || !activeRoom}
        />
      </div>

      {/* Mobile User List Modal */}
      {(isMobile || isTablet) && showUserList && activeRoomData?.room && (
        <MobileMenu
          side="right"
          className="w-80"
        >
          <UserList
            room={activeRoomData.room}
            onlineUsers={roomOnlineUsers}
            currentUser={currentUser}
            onStartPrivateChat={handleStartPrivateChat}
            blockedUserIds={new Set(blockedUsersData?.map(bu => bu.blockedId) || [])}
          />
        </MobileMenu>
      )}

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