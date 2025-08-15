import { RoomWithMembers } from '@shared/schema';
import { cn } from '@/lib/utils';

interface UserListProps {
  room: RoomWithMembers;
  onlineUsers: Set<string>;
}

export default function UserList({ room, onlineUsers }: UserListProps) {
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

  const onlineMembers = room.members.filter(member => onlineUsers.has(member.id));
  const offlineMembers = room.members.filter(member => !onlineUsers.has(member.id));

  return (
    <div className="w-64 bg-white border-l border-gray-200 flex flex-col" data-testid="user-list">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">Room Members</h3>
        <p className="text-xs text-gray-500 mt-1" data-testid="total-members">
          {room.memberCount} members
        </p>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {/* Online Members */}
        {onlineMembers.length > 0 && (
          <div className="p-4">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
              Online — {onlineMembers.length}
            </h4>
            
            <div className="space-y-2">
              {onlineMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  data-testid={`online-user-${member.id}`}
                >
                  <div className="relative">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium",
                      getAvatarColor(member.displayName)
                    )}>
                      {getInitials(member.displayName)}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-accent border-2 border-white rounded-full"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {member.displayName}
                    </p>
                    <p className="text-xs text-gray-500">Member</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Offline Members */}
        {offlineMembers.length > 0 && (
          <div className={cn("p-4", onlineMembers.length > 0 && "border-t border-gray-100")}>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
              Offline — {offlineMembers.length}
            </h4>
            
            <div className="space-y-2">
              {offlineMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors opacity-60"
                  data-testid={`offline-user-${member.id}`}
                >
                  <div className="relative">
                    <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
                      {getInitials(member.displayName)}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-gray-400 border-2 border-white rounded-full"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">
                      {member.displayName}
                    </p>
                    <p className="text-xs text-gray-400">Last seen recently</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
