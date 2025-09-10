import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Room, RoomWithMembers, MessageWithUser, PrivateRoom, PrivateChatData, BlockedUserWithDetails } from '@shared/schema';
import { useWebSocket } from '@/hooks/use-websocket';
import { usePaginatedMessages } from '@/hooks/use-paginated-messages';
import { useResponsive } from '@/hooks/use-responsive';
import { useAccessibility } from '@/hooks/use-accessibility';
import { apiRequest, queryClient } from '@/lib/queryClient';
import Sidebar from '@/components/chat/sidebar';
import MessageList from '@/components/chat/message-list';
import MessageInputEnhanced from '@/components/chat/message-input-enhanced';
import UserList from '@/components/chat/user-list';
import CreateRoomModal from '@/components/chat/create-room-modal';
import AuthScreen from '@/components/auth/auth-screen';
import { Button } from '@/components/ui/button';
import { MobileMenu } from '@/components/ui/mobile-menu';
import { SkipLink, SkipLinkContainer } from '@/components/ui/skip-link';
import { Hash, Users, Search, Settings, LogOut, Shield, Menu, UserPlus } from 'lucide-react';
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
  const [privateRooms, setPrivateRooms] = useState<PrivateRoom[]>([]);
  const currentJoinedRoom = useRef<string | null>(null);
  const { toasts, showNotification, removeToast } = useNotificationManager();
  const { 
    announceMessage, 
    announceRoomChange, 
    announceUserStatus,
    announceTyping,
    prefersReducedMotion 
  } = useAccessibility({
    announceMessages: true,
    announceNavigation: true,
    announceTyping: true
  });

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

      // Store private rooms in localStorage for persistence (including empty arrays)
      // This ensures localStorage is always synchronized with the latest API response
      localStorage.setItem(`chatual_private_rooms_${currentUser.id}`, JSON.stringify(data.privateRooms || []));

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

      // Clear query cache but preserve specific keys for private rooms
      queryClient.clear();
    },
    onError: () => {
      // Even if logout fails on server, clear local state but preserve private rooms
      const userId = currentUser?.id;
      setCurrentUser(null);
      localStorage.removeItem('chatual_user');

      queryClient.clear();
    },
  });

  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('chatual_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Update rooms and private rooms when chat data changes
  useEffect(() => {
    if (currentUser) {
      // Always prioritize fresh API data over localStorage
      if (chatData !== undefined) {
        // API data is available (even if empty), use it and update localStorage
        const privateRoomsToSet = chatData?.privateRooms || [];
        setPrivateRooms(privateRoomsToSet);
        
        // Update localStorage with the fresh API data (even if empty)
        localStorage.setItem(`chatual_private_rooms_${currentUser.id}`, JSON.stringify(privateRoomsToSet));
      } else {
        // API data not yet loaded, use localStorage as temporary fallback
        const stored = localStorage.getItem(`chatual_private_rooms_${currentUser.id}`);
        if (stored) {
          try {
            const storedRooms = JSON.parse(stored);
            if (Array.isArray(storedRooms)) {
              setPrivateRooms(storedRooms);
            }
          } catch (e) {
            // Clear corrupted localStorage data
            localStorage.removeItem(`chatual_private_rooms_${currentUser.id}`);
            setPrivateRooms([]);
          }
        }
      }
    }
  }, [chatData, currentUser]);

  // Always use paginated messages for display - WebSocket messages added separately
  const syncedMessages = useMemo(() => {
    if (!currentUser) return [];
    
    // Filter out temporary photo messages if there's a matching real message
    const filtered = paginatedMessages.filter(msg => {
      // If this is a temporary photo message, check if there's a real message for the same photo
      if (msg.id?.startsWith('temp-') && msg.messageType === 'photo' && msg.photoUrl) {
        // Extract filename from the Google Cloud Storage URL for matching
        const tempUrlMatch = msg.photoUrl.match(/photos\/([^?]+)/); 
        const tempFilename = tempUrlMatch ? tempUrlMatch[1] : msg.photoFileName;
        
        // Check if there's a real message with matching photo file
        const hasRealMessage = paginatedMessages.some(otherMsg => 
          !otherMsg.id?.startsWith('temp-') &&
          otherMsg.messageType === 'photo' &&
          otherMsg.userId === msg.userId &&
          ((tempFilename && otherMsg.photoUrl?.includes(tempFilename)) || 
           otherMsg.photoFileName === msg.photoFileName)
        );
        
        if (hasRealMessage) {
          return false; // Filter out the temporary message
        }
      }
      
      return true; // Keep all other messages
    });
    
    return filtered;
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
      // First pass: Remove any temporary messages that should be replaced by real messages
      const realPhotoMessages = newMessages.filter(msg => 
        msg.messageType === 'photo' && msg.photoFileName && !msg.id?.startsWith('temp-')
      );
      
      if (realPhotoMessages.length > 0) {
        const tempMessagesToRemove = paginatedMessages.filter(pMsg => 
          pMsg.id?.startsWith('temp-') && 
          pMsg.messageType === 'photo' && 
          realPhotoMessages.some(realMsg => 
            realMsg.userId === pMsg.userId &&
            (realMsg.photoFileName === pMsg.photoFileName || 
             // Also match by time proximity (within 30 seconds) as backup
             (pMsg.createdAt && realMsg.createdAt && Math.abs(new Date(pMsg.createdAt).getTime() - new Date(realMsg.createdAt).getTime()) < 30000))
          )
        );
        
        if (tempMessagesToRemove.length > 0) {
          const tempIds = tempMessagesToRemove.map(m => m.id);
          const filteredMessages = paginatedMessages.filter(pMsg => !tempIds.includes(pMsg.id));
          setPaginatedMessages(filteredMessages);
        }
      }
      
      // Second pass: Add all new messages
      newMessages.forEach(msg => {
        addMessage(msg);
      });
    }
  }, [messages, paginatedMessages, addMessage, currentUser, activeRoom?.id]);


  // Initialize chat layout when accessing any chatroom
  useEffect(() => {
    const initializeChatPage = () => {
      // Force layout recalculation to ensure proper CSS application
      const chatContainer = document.querySelector('.chat-messages-container');
      if (chatContainer) {
        const container = chatContainer as HTMLElement;
        // Force style recalculation
        container.style.contain = 'layout style';
        container.style.isolation = 'isolate';
        container.style.position = 'relative';
        container.style.zIndex = '1';
      }

      // Ensure message input has proper z-index
      const messageInput = document.querySelector('.message-input-container');
      if (messageInput) {
        const input = messageInput as HTMLElement;
        input.style.position = 'relative';
        input.style.zIndex = '10';
      }
    };

    if (currentUser && activeRoom?.id) {
      // Small delay to ensure DOM is ready
      setTimeout(initializeChatPage, 100);
    }
  }, [currentUser, activeRoom?.id]);

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

  // Listen for private chat closure events from WebSocket
  useEffect(() => {
    const handlePrivateChatClosed = (event: CustomEvent) => {
      const { roomId, closedBy } = event.detail;
      console.log(`[CHAT_PAGE] Received private chat closure event for room ${roomId} by ${closedBy?.username}`);
      
      // Remove from privateRooms state and update localStorage with the new state
      setPrivateRooms(prev => {
        const updatedRooms = prev.filter(room => room.id !== roomId);
        
        // Update localStorage with the current updated state
        if (currentUser?.id) {
          localStorage.setItem(`chatual_private_rooms_${currentUser.id}`, JSON.stringify(updatedRooms));
        }
        
        return updatedRooms;
      });
      
      // If the closed room was the active room, switch to a different room
      if (activeRoom?.id === roomId) {
        const remainingRooms = roomsData?.rooms || [];
        if (remainingRooms.length > 0) {
          const firstRoom = remainingRooms[0];
          setActiveRoom(firstRoom);
          activeRoomRef.current = firstRoom;
          localStorage.setItem('chatual_active_room', JSON.stringify({ id: firstRoom.id, name: firstRoom.name }));
          
          toast({
            title: "Switched Room",
            description: `Moved to "${firstRoom.name}" since your private chat was closed`,
          });
        } else {
          setActiveRoom(null);
          activeRoomRef.current = null;
          localStorage.removeItem('chatual_active_room');
        }
      }
    };

    window.addEventListener('private-chat-closed', handlePrivateChatClosed as EventListener);
    
    return () => {
      window.removeEventListener('private-chat-closed', handlePrivateChatClosed as EventListener);
    };
  }, [currentUser, privateRooms, activeRoom, roomsData, toast]);

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
      console.error('No valid room found for sending message');
      toast({
        title: "Error",
        description: "No active room selected. Please select a room first.",
        variant: "destructive",
      });
      return;
    }

    // Check if this is a private chat that might have been closed
    if (roomToUse.isPrivate) {
      const isPrivateRoomStillValid = privateRooms.some(pr => pr.id === roomToUse.id);
      if (!isPrivateRoomStillValid) {
        console.error('Attempting to send message to closed private chat');
        toast({
          title: "Chat Unavailable",
          description: "This private chat has been closed and is no longer available.",
          variant: "destructive",
        });
        
        // Switch to first available public room
        const availableRooms = roomsData?.rooms || [];
        if (availableRooms.length > 0) {
          const firstRoom = availableRooms[0];
          setActiveRoom(firstRoom);
          activeRoomRef.current = firstRoom;
          localStorage.setItem('chatual_active_room', JSON.stringify({ id: firstRoom.id, name: firstRoom.name }));
          
          toast({
            title: "Switched Room",
            description: `Moved to "${firstRoom.name}" since the private chat was closed`,
          });
        }
        return;
      }
    }

    // Add optimistic message for photo messages to improve UX
    if (photoUrl && photoFileName && roomToUse) {
      const optimisticMessage: MessageWithUser = {
        id: `temp-${Date.now()}-${Math.random()}`,
        sequenceId: 0, // Temporary placeholder for optimistic messages
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

  // Function to handle private chat deletion
  const handlePrivateRoomDeleted = (roomId: string) => {
    setPrivateRooms(prev => {
      const updatedRooms = prev.filter(room => room.id !== roomId);
      
      // Update localStorage with the current updated state
      if (currentUser?.id) {
        localStorage.setItem(`chatual_private_rooms_${currentUser.id}`, JSON.stringify(updatedRooms));
      }
      
      return updatedRooms;
    });
    
    // If the deleted room was the active room, switch to the first available room
    if (activeRoom?.id === roomId) {
      const remainingRooms = roomsData?.rooms || [];
      if (remainingRooms.length > 0) {
        const firstRoom = remainingRooms[0];
        setActiveRoom(firstRoom);
        activeRoomRef.current = firstRoom;
        localStorage.setItem('chatual_active_room', JSON.stringify({ id: firstRoom.id, name: firstRoom.name }));
      } else {
        setActiveRoom(null);
        activeRoomRef.current = null;
        localStorage.removeItem('chatual_active_room');
      }
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
    <>
      
      <div className="h-screen flex sensual-gradient overflow-hidden" role="application" aria-label="Chatual - Real-time Chat Application">
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
            onPrivateRoomDeleted={handlePrivateRoomDeleted}
          />
        </MobileMenu>
      )}

      {/* Desktop Sidebar */}
      {isDesktop && (
        <nav role="navigation" aria-label="Chat rooms and navigation" id="room-list">
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
        </nav>
      )}

      {/* Main Content Area with Resizable Panels */}
      {isDesktop ? (
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* Main Chat Panel */}
          <ResizablePanel defaultSize={showUserList ? 75 : 100} minSize={50}>
            <main className="flex flex-col h-full min-w-0 relative" id="main-content" role="main" aria-label="Chat messages and input">
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
            )} aria-hidden="true" />
            <h1 className={cn(
              "font-semibold text-white truncate min-w-0 flex-1",
              "text-sm sm:text-base md:text-lg lg:text-xl"
            )} aria-live="polite">
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

            <Link href="/friends">
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white hover:bg-opacity-10 hover:text-white"
                data-testid="button-friends"
                aria-label="Open friends"
              >
                <UserPlus className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" aria-hidden="true" />
              </Button>
            </Link>

            <Link href="/settings">
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white hover:bg-opacity-10 hover:text-white"
                data-testid="button-settings"
                aria-label="Open settings"
              >
                <Settings className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" aria-hidden="true" />
              </Button>
            </Link>

            {currentUser.role === 'admin' && (
              <Link href="/admin">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white hover:bg-opacity-10 hover:text-white"
                  data-testid="button-admin"
                  aria-label="Open admin dashboard"
                >
                  <Shield className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" aria-hidden="true" />
                </Button>
              </Link>
            )}



            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-white hover:bg-white hover:bg-opacity-10 hover:text-white"
              data-testid="button-logout"
              aria-label="Logout"
            >
              <LogOut className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div 
          className="flex-1 flex flex-col min-h-0 overflow-hidden relative"
          style={{
            contain: 'layout style size',
            isolation: 'isolate',
            position: 'relative',
            zIndex: 1
          }}
        >
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
        </div>

        {/* Message Input */}
        <MessageInputEnhanced
          onSendMessage={handleSendMessage}
          onTyping={(isTyping: boolean) => {
            if (activeRoom?.id && currentUser?.id) {
              sendTyping(isTyping);
            }
          }}
          id="message-input"
          disabled={!isConnected || !activeRoom}
          currentUser={currentUser}
          roomId={activeRoom?.id}
        />
            </main>
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
        <main className="flex-1 flex flex-col min-w-0 relative" id="main-content-mobile" role="main" aria-label="Chat messages and input">
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
            )} aria-hidden="true" />
            <h1 className={cn(
              "font-semibold text-white truncate min-w-0 flex-1",
              "text-sm sm:text-base md:text-lg lg:text-xl"
            )} aria-live="polite">
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

            <Link href="/friends">
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white hover:bg-opacity-10 hover:text-white"
                data-testid="button-friends"
                aria-label="Open friends"
              >
                <UserPlus className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" aria-hidden="true" />
              </Button>
            </Link>

            <Link href="/settings">
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white hover:bg-opacity-10 hover:text-white"
                data-testid="button-settings"
                aria-label="Open settings"
              >
                <Settings className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" aria-hidden="true" />
              </Button>
            </Link>

            {currentUser.role === 'admin' && (
              <Link href="/admin">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white hover:bg-opacity-10 hover:text-white"
                  data-testid="button-admin"
                  aria-label="Open admin dashboard"
                >
                  <Shield className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" aria-hidden="true" />
                </Button>
              </Link>
            )}



            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-white hover:bg-white hover:bg-opacity-10 hover:text-white"
              data-testid="button-logout"
              aria-label="Logout"
            >
              <LogOut className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" aria-hidden="true" />
            </Button>
          </div>
          </div>

          {/* Messages */}
          <div 
            className="flex-1 flex flex-col min-h-0 overflow-hidden relative"
            style={{
              contain: 'layout style size',
              isolation: 'isolate',
              position: 'relative',
              zIndex: 1
            }}
          >
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
          </div>

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
        </main>
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
    </>
  );
}