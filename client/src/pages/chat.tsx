import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { User, Room, RoomWithMembers, MessageWithUser } from '@shared/schema';
import { useWebSocket } from '@/hooks/use-websocket';
import Sidebar from '@/components/chat/sidebar';
import MessageList from '@/components/chat/message-list';
import MessageInput from '@/components/chat/message-input';
import UserList from '@/components/chat/user-list';
import CreateRoomModal from '@/components/chat/create-room-modal';
import { Button } from '@/components/ui/button';
import { Hash, Users, Search, Settings } from 'lucide-react';

export default function ChatPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [showUserList, setShowUserList] = useState(true);
  const [showCreateRoom, setShowCreateRoom] = useState(false);

  const { 
    isConnected, 
    messages, 
    onlineUsers, 
    typingUsers,
    joinRoom, 
    sendMessage, 
    sendTyping,
    setMessages 
  } = useWebSocket(currentUser?.id);

  // Login on component mount
  useEffect(() => {
    const loginUser = async () => {
      const username = localStorage.getItem('chatual_username') || prompt('Enter your username:');
      const displayName = localStorage.getItem('chatual_display_name') || prompt('Enter your display name:');
      
      if (username && displayName) {
        localStorage.setItem('chatual_username', username);
        localStorage.setItem('chatual_display_name', displayName);
        
        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, displayName }),
          });
          
          const data = await response.json();
          setCurrentUser(data.user);
        } catch (error) {
          console.error('Login failed:', error);
        }
      }
    };

    loginUser();
  }, []);

  const { data: roomsData } = useQuery<{ rooms: Room[] }>({
    queryKey: ['/api/rooms'],
    enabled: !!currentUser,
  });

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
    if (activeRoom?.id && currentUser?.id) {
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

  if (!currentUser) {
    return (
      <div className="h-screen flex items-center justify-center bg-chat-bg">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Connecting to Chatual...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden bg-chat-bg" data-testid="chat-application">
      {/* Sidebar */}
      <Sidebar
        currentUser={currentUser}
        rooms={roomsData?.rooms || []}
        activeRoom={activeRoom}
        onRoomSelect={handleRoomSelect}
        onCreateRoom={() => setShowCreateRoom(true)}
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
            <Button variant="ghost" size="sm" data-testid="button-settings">
              <Settings className="w-4 h-4" />
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
          onlineUsers={onlineUsers}
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
