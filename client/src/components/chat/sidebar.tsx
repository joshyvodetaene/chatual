import { User, Room } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { MessageCircle, Hash, Lock, Plus, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  currentUser: User;
  rooms: Room[];
  activeRoom: Room | null;
  onRoomSelect: (room: Room) => void;
  onCreateRoom: () => void;
}

export default function Sidebar({
  currentUser,
  rooms,
  activeRoom,
  onRoomSelect,
  onCreateRoom,
}: SidebarProps) {
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
          <div className="relative">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm",
              getAvatarColor(currentUser.displayName)
            )}>
              <span data-testid="user-initials">{getInitials(currentUser.displayName)}</span>
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-accent border-2 border-white rounded-full"></div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate" data-testid="user-name">
              {currentUser.displayName}
            </p>
            <p className="text-xs text-gray-500">Online</p>
          </div>
          <Button variant="ghost" size="sm" data-testid="button-user-settings">
            <Settings className="w-4 h-4 text-gray-400" />
          </Button>
        </div>
      </div>

      {/* Room List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
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
        </div>
      </div>
    </div>
  );
}
