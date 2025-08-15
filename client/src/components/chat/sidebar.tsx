import { User, Room, PrivateRoom } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { MessageCircle, Hash, Lock, Plus, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface SidebarProps {
  currentUser: User;
  rooms: Room[];
  privateRooms: PrivateRoom[];
  activeRoom: Room | null;
  onRoomSelect: (room: Room) => void;
  onCreateRoom: () => void;
  onStartPrivateChat: (userId: string) => void;
}

export default function Sidebar({
  currentUser,
  rooms,
  privateRooms,
  activeRoom,
  onRoomSelect,
  onCreateRoom,
  onStartPrivateChat,
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<'rooms' | 'private'>('rooms');

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-gradient-to-br from-blue-400 to-blue-600',
      'bg-gradient-to-br from-green-400 to-green-600',
      'bg-gradient-to-br from-purple-400 to-purple-600',
      'bg-gradient-to-br from-orange-400 to-orange-600',
      'bg-gradient-to-br from-pink-400 to-pink-600',
      'bg-gradient-to-br from-indigo-400 to-indigo-600',
    ];
    const hash = name.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col" data-testid="sidebar">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-primary text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
              <MessageCircle className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-semibold">Chatual</h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white hover:bg-opacity-10"
            onClick={onCreateRoom}
            data-testid="button-create-room"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* User Profile */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-3">
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium",
            getAvatarColor(currentUser.displayName)
          )}>
            {getInitials(currentUser.displayName)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {currentUser.displayName}
            </p>
            <p className="text-xs text-gray-500 truncate">
              @{currentUser.username}
            </p>
          </div>
          <Button variant="ghost" size="sm" data-testid="button-user-settings">
            <Settings className="w-4 h-4 text-gray-400" />
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="px-4 pt-4">
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          <button
            className={cn(
              'flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              activeTab === 'rooms'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
            onClick={() => setActiveTab('rooms')}
            data-testid="tab-rooms"
          >
            Rooms
          </button>
          <button
            className={cn(
              'flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              activeTab === 'private'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
            onClick={() => setActiveTab('private')}
            data-testid="tab-private"
          >
            Private
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          {activeTab === 'rooms' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Rooms
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary hover:text-primary-dark h-auto p-0"
                  onClick={onCreateRoom}
                  data-testid="button-add-room"
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
              
              <div className="space-y-1">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className={cn(
                      "flex items-center space-x-3 p-2 rounded-lg cursor-pointer transition-colors",
                      activeRoom?.id === room.id
                        ? "bg-primary text-white"
                        : "hover:bg-gray-100"
                    )}
                    onClick={() => onRoomSelect(room)}
                    data-testid={`room-item-${room.id}`}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      activeRoom?.id === room.id
                        ? "bg-white bg-opacity-20"
                        : "bg-gray-100"
                    )}>
                      {room.isPrivate ? (
                        <Lock className={cn(
                          "w-3 h-3",
                          activeRoom?.id === room.id ? "text-white" : "text-gray-500"
                        )} />
                      ) : (
                        <Hash className={cn(
                          "w-3 h-3",
                          activeRoom?.id === room.id ? "text-white" : "text-gray-500"
                        )} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-medium truncate",
                        activeRoom?.id === room.id ? "text-white" : "text-gray-700"
                      )}>
                        {room.name}
                      </p>
                    </div>
                    {activeRoom?.id === room.id && (
                      <div className="w-2 h-2 bg-white bg-opacity-75 rounded-full"></div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          
          {activeTab === 'private' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Private Chats
                </h2>
              </div>
              
              <div className="space-y-1">
                {privateRooms.map((privateRoom) => (
                  <div
                    key={privateRoom.id}
                    className={cn(
                      "flex items-center space-x-3 p-2 rounded-lg cursor-pointer transition-colors",
                      activeRoom?.id === privateRoom.id
                        ? "bg-primary text-white"
                        : "hover:bg-gray-100"
                    )}
                    onClick={() => {
                      const room: Room = {
                        id: privateRoom.id,
                        name: privateRoom.participant2.displayName,
                        description: 'Private chat',
                        isPrivate: true,
                        createdBy: privateRoom.participant1Id,
                        createdAt: new Date(),
                      };
                      onRoomSelect(room);
                    }}
                    data-testid={`private-chat-${privateRoom.participant2.username}`}
                  >
                    <div className="relative">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium",
                        getAvatarColor(privateRoom.participant2.displayName)
                      )}>
                        {getInitials(privateRoom.participant2.displayName)}
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-accent border-2 border-white rounded-full"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-medium truncate",
                        activeRoom?.id === privateRoom.id ? "text-white" : "text-gray-900"
                      )}>
                        {privateRoom.participant2.displayName}
                      </p>
                      <p className={cn(
                        "text-xs truncate",
                        activeRoom?.id === privateRoom.id ? "text-white text-opacity-70" : "text-gray-500"
                      )}>
                        Private chat
                      </p>
                    </div>
                  </div>
                ))}
                
                {privateRooms.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">No private chats yet</p>
                    <p className="text-xs mt-1">Click on a user to start chatting</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}