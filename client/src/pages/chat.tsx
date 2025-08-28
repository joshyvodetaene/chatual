import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Room, RoomWithMembers, MessageWithUser, PrivateRoom, PrivateChatData, BlockedUserWithDetails } from '@shared/schema';
import { useWebSocket } from '@/hooks/use-websocket';
import { usePaginatedMessages } from '@/hooks/use-paginated-messages';
import { useResponsive } from '@/hooks/use-responsive';
import { apiRequest, queryClient } from '@/lib/queryClient';
import Sidebar from '@/components/chat/sidebar';
import MessageList from '@/components/chat/message-list';
import MessageInputEnhanced from '@/components/chat/message-input-enhanced';
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
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Link } from 'wouter';
import { cn } from '@/lib/utils';
import { NotificationCenter } from '@/components/notifications/notification-center';
import { NotificationToast } from '@/components/notifications/notification-toast';
import { useNotificationManager } from '@/hooks/use-notification-manager';

export default function ChatPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('chatual_user');
    const user = saved ? JSON.parse(saved) : null;
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
  const { toasts, showNotification, removeToast } = useNotificationManager();

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
      const response = await apiRequest('GET', `/api/chat-data/${currentUser.id}`);
      const data = await response.json();

      // Store private rooms in localStorage for persistence
      if (data.privateRooms && data.privateRooms.length > 0) {
        localStorage.setItem(`chatual_private_rooms_${currentUser.id}`, JSON.stringify(data.privateRooms));
      }

      return data as PrivateChatData;
    },
    enabled: !!currentUser?.id,
    staleTime: 30000, // Increased to 30 seconds to reduce refetching
    refetchOnWindowFocus: false, // Disable refetch on window focus to reduce re-renders
    refetchOnMount: false, // Don't always refetch on mount
    gcTime: 60000, // Keep data in cache for 1 minute
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
      // Don't remove private rooms from localStorage during logout
      const userId = currentUser?.id;
      setCurrentUser(null);
      localStorage.removeItem('chatual_user');
      // Reset theme context to login page (light theme)
      setUserId(null);
      // Clear query cache but preserve specific keys for private rooms
      queryClient.clear();
    },
    onError: () => {
      // Even if logout fails on server, clear local state but preserve private rooms
      const userId = currentUser?.id;
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

  // Update rooms and private rooms when chat data changes
  useEffect(() => {
    if (currentUser) {
      // Handle private rooms with localStorage fallback
      let privateRoomsToSet: PrivateRoom[] = [];
      
      if (chatData?.privateRooms && chatData.privateRooms.length > 0) {
        privateRoomsToSet = chatData.privateRooms;
      } else {
        // Try to restore from localStorage if API doesn't return private rooms
        const stored = localStorage.getItem(`chatual_private_rooms_${currentUser.id}`);
        if (stored) {
          try {
            const storedRooms = JSON.parse(stored);
            if (Array.isArray(storedRooms) && storedRooms.length > 0) {
              privateRoomsToSet = storedRooms;
            }
          } catch (e) {
            // Silent error handling for localStorage parsing
          }
        }
      }

      setPrivateRooms(privateRoomsToSet);
    }
  }, [chatData, currentUser]);

  // Always use paginated messages for display - WebSocket messages added separately
  const syncedMessages = useMemo(() => {
    if (!currentUser) return [];
    
    // Always use paginated messages - don't mix with WebSocket messages here
    // WebSocket messages will be added via the separate useEffect below
    return paginatedMessages;
  }, [paginatedMessages, currentUser]);

  // Don't sync WebSocket messages back to avoid duplicate filtering issues
  // WebSocket messages will be added directly to paginated list via addMessage

  // Handle new messages from WebSocket (filter by current room and handle deduplication)
  useEffect(() => {
    if (!currentUser || !activeRoom?.id || messages.length === 0) {
      return;
    }

    // Filter new messages for current room that aren't already displayed
    const newMessages = messages.filter(msg => 
      msg.roomId === activeRoom.id &&
      !paginatedMessages.some(pMsg => pMsg.id === msg.id)
    );

    if (newMessages.length > 0) {
      newMessages.forEach(msg => {
        // If this is a real message from server, remove any optimistic message for the same photo
        if (msg.messageType === 'photo' && msg.photoUrl && !msg.isTemporary) {
          // Find and remove optimistic messages with the same photo URL
          const optimisticMessages = paginatedMessages.filter(pMsg => 
            pMsg.isTemporary && 
            pMsg.messageType === 'photo' && 
            pMsg.photoUrl === msg.photoUrl &&
            pMsg.userId === msg.userId
          );
          
          if (optimisticMessages.length > 0) {
            // Remove the optimistic messages since we now have the real message
            optimisticMessages.forEach(optimisticMsg => {
              // Use setPaginatedMessages to remove the optimistic message
              setPaginatedMessages(prev => prev.filter(pMsg => pMsg.id !== optimisticMsg.id));
            });
            console.log('Removed optimistic photo messages:', optimisticMessages.length);
          }
        }
        
        addMessage(msg);
      });
    }
  }, [messages, paginatedMessages, addMessage, currentUser, activeRoom?.id]);

  // Set user ID for theme context when user is available
  useEffect(() => {
    if (currentUser) {
      setUserId(currentUser.id);
    }
  }, [currentUser, setUserId]);

  // Optimize room join with async handling
  const handleRoomJoin = useCallback(async (roomId: string, userId: string) => {
    currentJoinedRoom.current = roomId;

    // For private chats, preserve message history - only clear messages for public rooms
    // Private chats should maintain their full conversation history
    const currentRoomData = activeRoomData?.room || activeRoom;
    const isPrivateChat = currentRoomData?.isPrivate || false;

    if (!isPrivateChat) {
      setMessages([]);
    }

    // Join room via WebSocket
    joinRoom(roomId);

    // Join room on server asynchronously
    try {
      const response = await apiRequest('POST', `/api/rooms/${roomId}/join`, { userId });
    } catch (error) {
      console.error('Room join error:', error);
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

  const handleSendMessage = (content: string, photoUrl?: string, photoFileName?: string, mentionedUserIds?: string[]) => {
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
            // Add optimistic message for photo messages to improve UX
            if (photoUrl && photoFileName && refreshedRooms.rooms[0]) {
              const optimisticMessage: MessageWithUser = {
                id: `temp-${Date.now()}-${Math.random()}`,
                content: content || '',
                messageType: 'photo',
                photoUrl,
                photoFileName,
                userId: currentUser.id,
                roomId: refreshedRooms.rooms[0].id,
                createdAt: new Date(),
                mentionedUserIds: mentionedUserIds || [],
                user: currentUser,
                isTemporary: true
              };

              // Add message optimistically to see it immediately
              addMessage(optimisticMessage);
              console.log('Added optimistic photo message (fallback):', {
                id: optimisticMessage.id,
                photoUrl: photoUrl.substring(photoUrl.length - 30),
                photoFileName
              });
            }

            sendMessage(content, photoUrl, photoFileName, mentionedUserIds);
          }
        }, 1000);
      });
      return;
    }

    // Add optimistic message for photo messages to improve UX
    if (photoUrl && photoFileName && roomToUse) {
      const optimisticMessage: MessageWithUser = {
        id: `temp-${Date.now()}-${Math.random()}`,
        content: content || '',
        messageType: 'photo',
        photoUrl,
        photoFileName,
        userId: currentUser.id,
        roomId: roomToUse.id,
        createdAt: new Date(),
        mentionedUserIds: mentionedUserIds || [],
        user: currentUser,
        isTemporary: true
      };

      // Add message optimistically to see it immediately
      addMessage(optimisticMessage);
      console.log('Added optimistic photo message:', {
        id: optimisticMessage.id,
        photoUrl: photoUrl.substring(photoUrl.length - 30),
        photoFileName
      });
    }

    sendMessage(content, photoUrl, photoFileName, mentionedUserIds);
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
    
    // Prevent unnecessary re-renders if same room is selected
    if (previousRoom && previousRoom.id === room.id) {
      console.log(`[CHAT_PAGE] Same room selected, skipping re-render: ${room.name}`);
      return;
    }

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

      {/* Main Content Area with Resizable Panels */}
      {isDesktop ? (
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* Main Chat Panel */}
          <ResizablePanel defaultSize={showUserList ? 75 : 100} minSize={50}>
            <div className="flex flex-col h-full min-w-0">
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

            <NotificationCenter />

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
        <MessageInputEnhanced
          onSendMessage={handleSendMessage}
          onTyping={(isTyping: boolean) => {
            if (activeRoom?.id && currentUser?.id) {
              sendTyping(isTyping);
            }
          }}
          disabled={!isConnected || !activeRoom}
          currentUser={currentUser}
          roomId={activeRoom?.id}
        />
            </div>
          </ResizablePanel>

          {/* Resizable Handle */}
          {showUserList && activeRoomData?.room && (
            <>
              <ResizableHandle withHandle />
              
              {/* User List Panel */}
              <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
                <UserList
                  room={activeRoomData.room}
                  onlineUsers={roomOnlineUsers}
                  currentUser={currentUser}
                  onStartPrivateChat={handleStartPrivateChat}
                  blockedUserIds={new Set(blockedUsersData?.map(bu => bu.blockedId) || [])}
                />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      ) : (
        /* Mobile Chat Area */
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

            <NotificationCenter />

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
          <MessageInputEnhanced
            onSendMessage={handleSendMessage}
            onTyping={(isTyping: boolean) => {
              if (activeRoom?.id && currentUser?.id) {
                sendTyping(isTyping);
              }
            }}
            disabled={!isConnected || !activeRoom}
            currentUser={currentUser}
            roomId={activeRoom?.id}
          />
        </div>
      )}

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

      {/* Notification Toasts */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <NotificationToast
            key={toast.id}
            {...toast}
            message={toast.body}
            onClose={() => removeToast(toast.id)}
            onAction={() => {
              // Handle navigation based on notification data
              if (toast.data?.roomId) {
                // Navigate to the room where the notification occurred
                const room = roomsData?.rooms?.find(r => r.id === toast.data.roomId);
                if (room) {
                  setActiveRoom(room);
                }
              }
              removeToast(toast.id);
            }}
          />
        ))}
      </div>
    </div>
  );
}