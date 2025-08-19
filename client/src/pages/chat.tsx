import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  console.log(`[CHAT_PAGE] ChatPage component initializing at ${new Date().toISOString()}`);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    console.log(`[CHAT_PAGE] Loading user from localStorage`);
    const saved = localStorage.getItem('chatual_user');
    const user = saved ? JSON.parse(saved) : null;
    console.log(`[CHAT_PAGE] User loaded:`, user ? `${user.username} (${user.id})` : 'none');
    return user;
  });
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const activeRoomRef = useRef<Room | null>(null);
  const [showUserList, setShowUserList] = useState(false);
  const [showSidebarMobile, setShowSidebarMobile] = useState(false);
  const { isMobile, isTablet, isDesktop, isSmallMobile, isLargeMobile } = useResponsive();
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

  // Chat data loading
  const { data: chatData, isLoading: isChatDataLoading } = useQuery({
    queryKey: ['/api/chat-data', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return null;
      console.log(`[CHAT_PAGE] Fetching chat data for user: ${currentUser.id}`);
      const response = await apiRequest('GET', `/api/chat-data/${currentUser.id}`);
      const data = await response.json();
      console.log(`[CHAT_PAGE] Chat data received:`, {
        roomCount: data.rooms?.length || 0,
        privateRoomCount: data.privateRooms?.length || 0
      });

      // Ensure private rooms are always maintained
      if (data.privateRooms && data.privateRooms.length > 0) {
        console.log(`[CHAT_PAGE] Private rooms found:`, data.privateRooms.map((pr: any) => ({
          id: pr.id,
          participant: pr.participant2?.displayName
        })));
      }

      return data as PrivateChatData;
    },
    enabled: !!currentUser?.id,
    staleTime: 5000, // Reduced to 5 seconds for better consistency
    refetchOnWindowFocus: true,
    refetchOnMount: true, // Always refetch when component mounts
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
    console.log(`[CHAT_PAGE] Authentication successful for user: ${user.username} (${user.id})`);
    setCurrentUser(user);
    localStorage.setItem('chatual_user', JSON.stringify(user));
    console.log(`[CHAT_PAGE] User data saved to localStorage`);
    // Set user ID for theme context
    setUserId(user.id);
    console.log(`[CHAT_PAGE] Theme context userId set: ${user.id}`);
  };

  const handleLogout = () => {
    console.log(`[CHAT_PAGE] Logout initiated for user: ${currentUser?.username}`);
    logoutMutation.mutate();
  };

  // Update rooms and private rooms when chat data changes
  useEffect(() => {
    console.log(`[CHAT_PAGE] Chat data effect triggered:`, {
      hasChatData: !!chatData,
      hasCurrentUser: !!currentUser,
      privateRoomsCount: chatData?.privateRooms?.length || 0
    });

    if (chatData && currentUser) {
      console.log(`[CHAT_PAGE] Setting ${chatData.rooms?.length || 0} rooms`);
      setRooms(chatData.rooms || []);

      // Always set private rooms, even if empty array
      console.log(`[CHAT_PAGE] Setting ${chatData.privateRooms?.length || 0} private rooms`);
      setPrivateRooms(chatData.privateRooms || []);

      // Log each private room for debugging
      if (chatData.privateRooms && chatData.privateRooms.length > 0) {
        chatData.privateRooms.forEach((pr, index) => {
          console.log(`[CHAT_PAGE] Private room ${index + 1}:`, {
            id: pr.id,
            participant1: pr.participant1?.displayName,
            participant2: pr.participant2?.displayName
          });
        });
      }
    }
  }, [chatData, currentUser]);

  // Optimize message sync with memoization to prevent unnecessary updates
  const syncedMessages = useMemo(() => {
    if (!currentUser || paginatedMessages.length === 0) return [];

    // Check if we need to sync by comparing message IDs instead of array references
    const paginatedIds = new Set(paginatedMessages.map(m => m.id));
    const wsIds = new Set(messages.map(m => m.id));

    const needsSync = paginatedMessages.length !== messages.length ||
                      !Array.from(paginatedIds).every(id => wsIds.has(id));

    if (needsSync && paginatedMessages.length > 0) {
      console.log(`[CHAT_PAGE] Syncing ${paginatedMessages.length} paginated messages to WebSocket`);
      return paginatedMessages;
    }

    return messages;
  }, [paginatedMessages, messages, currentUser]);

  // Apply synced messages only when necessary
  useEffect(() => {
    if (syncedMessages !== messages && syncedMessages.length > 0) {
      setMessages(syncedMessages);
    }
  }, [syncedMessages, messages, setMessages]);

  // Handle new messages from WebSocket (filter by current room)
  useEffect(() => {
    console.log(`[CHAT_PAGE] WebSocket message handling effect:`, {
      hasCurrentUser: !!currentUser,
      wsMessageCount: messages.length,
      activeRoomId: activeRoom?.id,
      paginatedMessageCount: paginatedMessages.length
    });
    if (!currentUser || messages.length === 0 || !activeRoom?.id) {
      console.log(`[CHAT_PAGE] Skipping message handling - missing requirements`);
      return;
    }

    // Batch process new messages for better performance
    const newMessages = messages.filter(msg =>
      msg.roomId === activeRoom.id &&
      !paginatedMessages.some(pMsg => pMsg.id === msg.id)
    );

    if (newMessages.length > 0) {
      console.log(`[CHAT_PAGE] Adding ${newMessages.length} new WebSocket messages`);
      newMessages.forEach(msg => addMessage(msg));
    }
  }, [messages, paginatedMessages, addMessage, currentUser, activeRoom?.id]);

  // Set user ID for theme context when user is available
  useEffect(() => {
    console.log(`[CHAT_PAGE] Theme context effect - setting userId:`, currentUser?.id);
    if (currentUser) {
      setUserId(currentUser.id);
      console.log(`[CHAT_PAGE] Theme userId set: ${currentUser.id}`);
    }
  }, [currentUser, setUserId]);

  // Optimize room join with async handling
  const handleRoomJoin = useCallback(async (roomId: string, userId: string) => {
    console.log(`[CHAT_PAGE] Switching to room: ${roomId}`);
    currentJoinedRoom.current = roomId;

    // For private chats, preserve message history - only clear messages for public rooms
    // Private chats should maintain their full conversation history
    const currentRoomData = activeRoomData?.room || activeRoom;
    const isPrivateChat = currentRoomData?.isPrivate || false;

    if (!isPrivateChat) {
      console.log(`[CHAT_PAGE] Clearing messages for public room`);
      setMessages([]);
    } else {
      console.log(`[CHAT_PAGE] Preserving message history for private chat`);
    }

    // Join room via WebSocket
    joinRoom(roomId);

    // Join room on server asynchronously
    try {
      const response = await apiRequest('POST', `/api/rooms/${roomId}/join`, { userId });
      console.log(`[CHAT_PAGE] Room join response status: ${response.status}`);
    } catch (error) {
      console.error(`[CHAT_PAGE] Room join error:`, error);
    }
  }, [joinRoom, setMessages, activeRoomData?.room, activeRoom]);

  useEffect(() => {
    if (activeRoom?.id && currentUser?.id && currentJoinedRoom.current !== activeRoom.id) {
      handleRoomJoin(activeRoom.id, currentUser.id);
    }
  }, [activeRoom?.id, currentUser?.id, handleRoomJoin]);


  // Set initial active room
  useEffect(() => {
    console.log(`[CHAT_PAGE] Initial room selection effect:`, {
      hasRooms: !!roomsData?.rooms,
      roomCount: roomsData?.rooms?.length || 0,
      hasActiveRoom: !!activeRoom,
      hasCurrentUser: !!currentUser
    });
    if (roomsData?.rooms && roomsData.rooms.length > 0 && !activeRoom && currentUser) {
      // Try to restore from localStorage first
      const savedRoom = localStorage.getItem('chatual_active_room');
      console.log(`[CHAT_PAGE] Saved room from localStorage:`, savedRoom);
      let roomToSet = roomsData.rooms[0]; // default

      if (savedRoom) {
        try {
          const parsedRoom = JSON.parse(savedRoom);
          const foundRoom = roomsData.rooms.find(r => r.id === parsedRoom.id);
          if (foundRoom) {
            console.log(`[CHAT_PAGE] Restored room from localStorage: ${foundRoom.name}`);
            roomToSet = foundRoom;
          } else {
            console.log(`[CHAT_PAGE] Saved room not found, using default: ${roomsData.rooms[0].name}`);
          }
        } catch (e) {
          console.log(`[CHAT_PAGE] Error parsing saved room, using default:`, e);
        }
      } else {
        console.log(`[CHAT_PAGE] No saved room, using default: ${roomsData.rooms[0].name}`);
      }

      console.log(`[CHAT_PAGE] Setting initial active room: ${roomToSet.name} (${roomToSet.id})`);
      setActiveRoom(roomToSet);
      activeRoomRef.current = roomToSet;
      localStorage.setItem('chatual_active_room', JSON.stringify({ id: roomToSet.id, name: roomToSet.name }));
      console.log(`[CHAT_PAGE] Active room saved to localStorage`);
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

  const handleRoomSelect = useCallback((room: Room) => {
    const previousRoom = activeRoom;
    setActiveRoom(room);
    activeRoomRef.current = room;

    // Use requestIdleCallback for non-critical localStorage update
    const updateStorage = () => {
      localStorage.setItem('chatual_active_room', JSON.stringify({ id: room.id, name: room.name }));
    };

    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(updateStorage);
    } else {
      setTimeout(updateStorage, 0);
    }

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
  }, [activeRoom, toast, isMobile, isTablet]);

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
          "bg-card/80 backdrop-blur-sm border-b border-primary/20 flex items-center justify-between red-glow",
          "px-2 py-2 sm:px-3 sm:py-2.5 md:px-4 md:py-3 lg:px-6 lg:py-4"
        )}>
          <div className="flex items-center space-x-2 sm:space-x-3 md:space-x-4 min-w-0 flex-1">
            {(isMobile || isTablet) && (
              <MobileMenu
                side="left"
                className="w-72 sm:w-80 md:w-96"
                triggerClassName="mr-1 sm:mr-2"
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
              "text-primary flex-shrink-0",
              "w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6"
            )} />
            <h1 className={cn(
              "font-semibold text-white truncate min-w-0 flex-1",
              "text-sm sm:text-base md:text-lg lg:text-xl"
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

          <div className="flex items-center space-x-1 sm:space-x-2 md:space-x-3">
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
              <Users className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" />
            </Button>

            <Link href="/settings">
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white hover:bg-opacity-10 hover:text-white"
                data-testid="button-settings"
              >
                <Settings className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" />
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
                  <Shield className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" />
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
              <LogOut className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" />
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
          className="w-72 sm:w-80 md:w-96"
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