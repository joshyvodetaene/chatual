import { RoomWithMembers, User } from '@shared/schema';
import { cn } from '@/lib/utils';
import UserDistance from './user-distance';
import { UserProfileMenu } from './user-profile-menu';

interface UserListProps {
  room: RoomWithMembers;
  onlineUsers: Set<string>;
  currentUser?: User;
  onStartPrivateChat: (userId: string) => void;
  blockedUserIds?: Set<string>;
  isMobile?: boolean;
}

export default function UserList({ room, onlineUsers, currentUser, onStartPrivateChat, blockedUserIds = new Set(), isMobile = false }: UserListProps) {
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

  // Filter out blocked users and ensure unique members
  const uniqueMembers = room.members.reduce((acc: User[], member: User) => {
    if (!acc.find((m: User) => m.id === member.id) && !blockedUserIds.has(member.id)) {
      acc.push(member);
    }
    return acc;
  }, [] as User[]);
  
  const filteredMembers = uniqueMembers;
  const onlineMembers = filteredMembers.filter((member: User) => onlineUsers.has(member.id));
  const offlineMembers = filteredMembers.filter((member: User) => !onlineUsers.has(member.id));

  return (
    <div className={cn(
      "bg-white border-l border-gray-200 flex flex-col h-full",
      isMobile ? "w-full" : "w-64"
    )} data-testid="user-list">
      <div className={cn(
        "border-b border-gray-200",
        isMobile ? "p-6" : "p-4"
      )}>
        <h3 className={cn(
          "font-semibold text-gray-900",
          isMobile ? "text-lg" : "text-sm"
        )}>Online in Room</h3>
        <p className={cn(
          "text-gray-500 mt-1",
          isMobile ? "text-sm" : "text-xs"
        )} data-testid="online-count">
          {onlineMembers.length} online • {filteredMembers.length} visible
        </p>
      </div>
      
      <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        {/* Online Members */}
        {onlineMembers.length > 0 && (
          <div className="p-4">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
              Online — {onlineMembers.length}
            </h4>
            
            <div className="space-y-2">
              {onlineMembers.map((member) => (
                <UserProfileMenu
                  key={`online-${member.id}`}
                  user={member}
                  currentUser={currentUser!}
                  onStartPrivateChat={onStartPrivateChat}
                >
                  <div
                    className="group flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    data-testid={`online-user-${member.id}`}
                  >
                    <div className="relative">
                      {member.primaryPhoto?.photoUrl ? (
                        <img 
                          src={member.primaryPhoto.photoUrl}
                          alt={`${member.displayName} profile`}
                          className="w-8 h-8 rounded-full object-cover border-2 border-white"
                        />
                      ) : (
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium",
                          getAvatarColor(member.displayName)
                        )}>
                          {getInitials(member.displayName)}
                        </div>
                      )}
                      <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-accent border-2 border-white rounded-full"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {member.displayName}
                        </p>
                        {member.age && (
                          <span className="text-xs text-gray-500 font-normal">
                            {member.age}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-gray-500">Member</p>
                        {currentUser && (
                          <UserDistance 
                            currentUserId={currentUser.id} 
                            targetUserId={member.id}
                            className="text-xs"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </UserProfileMenu>
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
                <UserProfileMenu
                  key={`offline-${member.id}`}
                  user={member}
                  currentUser={currentUser!}
                  onStartPrivateChat={onStartPrivateChat}
                >
                  <div
                    className="group flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors opacity-60"
                    data-testid={`offline-user-${member.id}`}
                  >
                    <div className="relative">
                      {member.primaryPhoto?.photoUrl ? (
                        <img 
                          src={member.primaryPhoto.photoUrl}
                          alt={`${member.displayName} profile`}
                          className="w-8 h-8 rounded-full object-cover border-2 border-white opacity-60"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
                          {getInitials(member.displayName)}
                        </div>
                      )}
                      <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-gray-400 border-2 border-white rounded-full"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium text-gray-700 truncate">
                          {member.displayName}
                        </p>
                        {member.age && (
                          <span className="text-xs text-gray-400 font-normal">
                            {member.age}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-gray-400">Last seen recently</p>
                        {currentUser && (
                          <UserDistance 
                            currentUserId={currentUser.id} 
                            targetUserId={member.id}
                            className="text-xs opacity-60"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </UserProfileMenu>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
