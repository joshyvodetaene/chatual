import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';
import { cn } from '@/lib/utils';

export default function ChatPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('chatual_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const activeRoomRef = useRef<Room | null>(null);
  const [showUserList, setShowUserList] = useState(false);
  const [showSidebarMobile, setShowSidebarMobile] = useState(false);
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const { toast } = useToast();
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

  const createRoomMutation = useMutation({
    mutationFn: async (roomData: { name: string; description: string }) => {
      const response = await apiRequest('POST', '/api/rooms', roomData);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create room');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/rooms'] });
      setShowCreateRoom(false);
      toast({
        title: "Room Created",
        description: `Successfully created room "${data.room.name}". You can now start chatting!`,
        variant: "default",
      });
      // Switch to the newly created room
      if (data.room) {
        setActiveRoom(data.room);
        activeRoomRef.current = data.room;
        localStorage.setItem('chatual_active_room', JSON.stringify({ id: data.room.id, name: data.room.name }));
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Create Room",
        description: error.message || "Something went wrong while creating the room. Please try again.",
        variant: "destructive",
      });
    },
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


  // Set initial active room
  useEffect(() => {
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
          }
        } catch (e) {
          // Ignore parsing errors, use default
        }
      }
      
      setActiveRoom(roomToSet);
      activeRoomRef.current = roomToSet;
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
    if (!currentUser?.id) return;
    
    // Use multiple fallback strategies to find a room
    let roomToUse: Room | null = null;
    
    // Strategy 1: Use activeRoom from state
    if (activeRoom?.id) {
      roomToUse = activeRoom;
    }
    
    // Strategy 2: Use activeRoom from ref (more stable)
    if (!roomToUse && activeRoomRef.current?.id) {
      roomToUse = activeRoomRef.current;
    }
    
    // Strategy 3: Get from localStorage and validate against available rooms
    if (!roomToUse) {
      const savedRoom = localStorage.getItem('chatual_active_room');
      if (savedRoom) {
        try {
          const parsedRoom = JSON.parse(savedRoom);
          const cachedRooms = queryClient.getQueryData<{ rooms: Room[] }>(['/api/rooms']);
          if (cachedRooms?.rooms) {
            roomToUse = cachedRooms.rooms.find(r => r.id === parsedRoom.id) || null;
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
    }
    
    // Strategy 4: Use first available room from cache
    if (!roomToUse) {
      const cachedRooms = queryClient.getQueryData<{ rooms: Room[] }>(['/api/rooms']);
      if (cachedRooms?.rooms && cachedRooms.rooms.length > 0) {
        roomToUse = cachedRooms.rooms[0];
        setActiveRoom(roomToUse);
        activeRoomRef.current = roomToUse;
      }
    }
    
    if (!roomToUse) {
      // Force refresh room data and retry
      queryClient.invalidateQueries({ queryKey: ['/api/rooms'] }).then(() => {
        setTimeout(() => {
          const refreshedRooms = queryClient.getQueryData<{ rooms: Room[] }>(['/api/rooms']);
          if (refreshedRooms?.rooms && refreshedRooms.rooms.length > 0) {
            setActiveRoom(refreshedRooms.rooms[0]);
            activeRoomRef.current = refreshedRooms.rooms[0];
            sendMessage(content, photoUrl, photoFileName);
          }
        }, 1000);
      });
      return;
    }

    sendMessage(content, photoUrl, photoFileName);
  };

  const handleStartPrivateChat = async (userId: string) => {
    if (!currentUser?.id) return;
    
    try {
      const response = await apiRequest('POST', '/api/private-chat/create', {
        user1Id: currentUser.id,
        user2Id: userId,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create private chat');
      }
      
      const data = await response.json();
      
      // Invalidate chat data to refresh the room list
      await queryClient.invalidateQueries({ queryKey: ['/api/chat-data', currentUser.id] });
      
      // Set the new private room as active
      setActiveRoom(data.room);
      
      toast({
        title: "Private Chat Started",
        description: `Started a private conversation with ${data.otherUser?.username || 'user'}`
      });
    } catch (error: any) {
      toast({
        title: "Failed to Start Private Chat",
        description: error.message || "Something went wrong while starting the private chat. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRoomSelect = (room: Room) => {
    const previousRoom = activeRoom;
    setActiveRoom(room);
    activeRoomRef.current = room;
    localStorage.setItem('chatual_active_room', JSON.stringify({ id: room.id, name: room.name }));
    
    // Show toast for room switching (only if switching from another room)
    if (previousRoom && previousRoom.id !== room.id) {
      toast({
        title: "Switched Room",
        description: `Now chatting in "${room.name}"`
      });
    }
    
    if (isMobile || isTablet) {
      setShowSidebarMobile(false);
    }
  };

  // Return authentication screen if no user
  if (!currentUser) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="h-screen flex sensual-gradient overflow-hidden">
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
          className="w-80 border-r border-primary/20 bg-card/80 backdrop-blur-sm"
        />
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className={cn(
          "bg-card/80 backdrop-blur-sm border-b border-primary/20 px-4 py-3 flex items-center justify-between red-glow",
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
              "text-primary",
              isMobile ? "w-4 h-4" : "w-5 h-5"
            )} />
            <h1 className={cn(
              "font-semibold text-white truncate",
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
                "text-white hover:bg-white hover:bg-opacity-10 hover:text-white",
                showUserList && "bg-white bg-opacity-20 text-white"
              )}
              data-testid="button-toggle-user-list"
            >
              <Users className="w-4 h-4" />
            </Button>

            <Link href="/settings">
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white hover:bg-opacity-10 hover:text-white"
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
                  className="text-white hover:bg-white hover:bg-opacity-10 hover:text-white"
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
              className="text-white hover:bg-white hover:bg-opacity-10 hover:text-white"
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
        onSuccess={(room) => {
          // Switch to the newly created room
          setActiveRoom(room);
          activeRoomRef.current = room;
          localStorage.setItem('chatual_active_room', JSON.stringify({ id: room.id, name: room.name }));
        }}
      />
    </div>
  );
}