import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { User, Room, RoomWithMembers, MessageWithUser, PrivateRoom, PrivateChatData } from '@shared/schema';
import { useWebSocket } from '@/hooks/use-websocket';
import { apiRequest, queryClient } from '@/lib/queryClient';
import Sidebar from '@/components/chat/sidebar';
import MessageList from '@/components/chat/message-list';
import MessageInput from '@/components/chat/message-input';
import UserList from '@/components/chat/user-list';
import CreateRoomModal from '@/components/chat/create-room-modal';
import AuthScreen from '@/components/auth/auth-screen';
import { Button } from '@/components/ui/button';
import { Hash, Users, Search, Settings, LogOut } from 'lucide-react';
import { Link } from 'wouter';

export default function ChatPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('chatual_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [showUserList, setShowUserList] = useState(true);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [privateRooms, setPrivateRooms] = useState<PrivateRoom[]>([]);
  const currentJoinedRoom = useRef<string | null>(null);

  const { 
    isConnected, 
    messages, 
    onlineUsers, 
    roomOnlineUsers,
    typingUsers,
    joinRoom, 
    sendMessage, 
    sendTyping,
    setMessages 
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

  const { data: messagesData } = useQuery<{ messages: MessageWithUser[] }>({
    queryKey: ['/api/rooms', activeRoom?.id, 'messages'],
    enabled: !!activeRoom?.id,
  });

  // Load messages when room changes
  useEffect(() => {
    if (messagesData?.messages) {
      setMessages(messagesData.messages);
    }
  }, [messagesData, setMessages]);

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

  const handleSendMessage = (content: string) => {
    sendMessage(content);
  };

  const handleStartPrivateChat = async (userId: string) => {
    if (!currentUser?.id) return;
    
    try {
      const response = await apiRequest('POST', '/api/private-chat/create', {
        user1Id: currentUser.id,
        user2Id: userId,
      });
      
      if (response.room) {
        setActiveRoom(response.room);
        // Refresh private rooms list
        queryClient.invalidateQueries(['/api/chat-data', currentUser.id]);
      }
    } catch (error) {
      console.error('Failed to create private chat:', error);
    }
  };

  if (!currentUser) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="h-screen flex overflow-hidden bg-chat-bg" data-testid="chat-application">
      {/* Sidebar */}
      <Sidebar
        currentUser={currentUser}
        rooms={roomsData?.rooms || []}
        privateRooms={privateRooms}
        activeRoom={activeRoom}
        onRoomSelect={handleRoomSelect}
        onCreateRoom={() => setShowCreateRoom(true)}
        onStartPrivateChat={handleStartPrivateChat}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-6">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary text-white rounded-lg flex items-center justify-center">
              <Hash className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900" data-testid="room-name">
                {activeRoom?.name || 'Select a room'}
              </h2>
              <p className="text-xs text-gray-500" data-testid="room-member-count">
                {activeRoomData?.room?.memberCount || 0} members
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowUserList(!showUserList)}
              data-testid="button-toggle-user-list"
            >
              <Users className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" data-testid="button-search">
              <Search className="w-4 h-4" />
            </Button>
            <Link href="/settings">
              <Button variant="ghost" size="sm" data-testid="button-settings">
                <Settings className="w-4 h-4" />
              </Button>
            </Link>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <MessageList
          messages={messages}
          currentUser={currentUser}
          typingUsers={typingUsers}
          activeRoomData={activeRoomData?.room}
        />

        {/* Message Input */}
        <MessageInput
          onSendMessage={handleSendMessage}
          onTyping={sendTyping}
          disabled={!activeRoom || !isConnected}
        />
      </div>

      {/* User List */}
      {showUserList && activeRoomData?.room && (
        <UserList
          room={activeRoomData.room}
          onlineUsers={roomOnlineUsers}
          currentUser={currentUser}
          onStartPrivateChat={handleStartPrivateChat}
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
