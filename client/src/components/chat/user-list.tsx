import { RoomWithMembers, User } from '@shared/schema';
import { cn } from '@/lib/utils';
import UserDistance from './user-distance';
import { UserProfileMenu } from './user-profile-menu';
import FriendButton from '@/components/friends/friend-button';
import { MoreVertical, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

interface UserListProps {
  room: RoomWithMembers;
  onlineUsers: Set<string>;
  currentUser?: User;
  onStartPrivateChat: (userId: string) => void;
  blockedUserIds?: Set<string>;
  isMobile?: boolean;
}

export default function UserList({ room, onlineUsers, currentUser, onStartPrivateChat, blockedUserIds = new Set(), isMobile = false }: UserListProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (name: string, gender?: string) => {
    // Use gender-based colors if gender is provided
    if (gender === 'female') {
      return 'bg-gradient-to-br from-red-400 to-red-600';
    }
    if (gender === 'male') {
      return 'bg-gradient-to-br from-blue-400 to-blue-600';
    }
    
    // Fallback to name-based colors for users without gender info
    const colors = [
      'bg-gradient-to-br from-green-400 to-green-600',
      'bg-gradient-to-br from-purple-400 to-purple-600',
      'bg-gradient-to-br from-orange-400 to-orange-600',
      'bg-gradient-to-br from-pink-400 to-pink-600',
      'bg-gradient-to-br from-indigo-400 to-indigo-600',
      'bg-gradient-to-br from-teal-400 to-teal-600',
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
  
  // Filter online members based on search term
  const filteredOnlineMembers = onlineMembers.filter((member: User) =>
    searchTerm === '' ||
    member.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.username.toLowerCase().includes(searchTerm.toLowerCase())
  );
  

  return (
    <div className="bg-black border-l border-gray-800 flex flex-col h-full w-full sm:w-52 md:w-56 lg:w-64" data-testid="user-list">
      <div className="border-b border-gray-700 p-3 sm:p-4 md:p-6">
        <h3 className="font-semibold text-white text-sm sm:text-base md:text-lg">Online in Room</h3>
        <p className="text-gray-200 mt-1 text-xs sm:text-sm md:text-base font-medium" data-testid="online-count">
          {onlineMembers.length} online • {filteredMembers.length} visible
        </p>
      </div>
      
      <div className="flex-1 overflow-y-auto overflow-x-visible min-h-0 hide-scrollbar">
        {/* Online Members */}
        {onlineMembers.length > 0 && (
          <div className="p-2 sm:p-3 md:p-4">
            <div className="flex flex-col gap-2 sm:gap-3 md:gap-4 mb-2 sm:mb-3 md:mb-4">
              <h4 className="text-xs sm:text-sm md:text-base font-medium text-gray-300 uppercase tracking-wider">
                Online — {onlineMembers.length}
              </h4>
              {onlineMembers.length > 3 && (
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3 sm:w-4 sm:h-4" />
                  <Input
                    placeholder="Search online users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-7 sm:pl-8 h-6 sm:h-8 text-xs sm:text-sm bg-gray-800 border-gray-600 focus:border-gray-500 text-white placeholder:text-gray-400"
                  />
                </div>
              )}
            </div>
            
            <div className="space-y-1 sm:space-y-2 md:space-y-3">
              {filteredOnlineMembers.map((member) => (
                <div
                  key={`online-${member.id}`}
                  className="group flex items-center space-x-2 sm:space-x-3 md:space-x-4 p-1 sm:p-2 md:p-3 rounded-lg hover:bg-gray-800 transition-colors"
                  data-testid={`online-user-${member.id}`}
                >
                  <div className="relative">
                    {member.primaryPhoto?.photoUrl ? (
                      <img 
                        src={member.primaryPhoto.photoUrl}
                        alt={`${member.displayName} profile`}
                        className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-full object-cover border-2 border-black"
                      />
                    ) : (
                      <div className={cn(
                        "w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-white text-xs sm:text-sm md:text-base font-medium",
                        getAvatarColor(member.displayName, member.gender)
                      )}>
                        {getInitials(member.displayName)}
                      </div>
                    )}
                    <div className="absolute -bottom-0.5 sm:-bottom-1 -right-0.5 sm:-right-1 w-2 h-2 sm:w-3 sm:h-3 md:w-4 md:h-4 bg-accent border-2 border-black rounded-full"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-sm font-semibold text-white truncate">
                        {member.displayName}
                      </h4>
                      {member.age && (
                        <span className="text-sm text-gray-200 font-medium">
                          {member.age}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 mt-1">
                      <p className="text-xs text-gray-300">@{member.username}</p>
                      {member.location && (
                        <p className="text-xs text-gray-300 truncate">
                          📍 {member.location}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-green-300 font-medium">Online</span>
                        {currentUser && (
                          <UserDistance 
                            currentUserId={currentUser.id} 
                            targetUserId={member.id}
                            className="text-xs text-gray-400 font-medium"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    {currentUser && member.id !== currentUser.id && (
                      <FriendButton
                        currentUser={currentUser}
                        targetUser={member}
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    )}
                    <UserProfileMenu
                      user={member}
                      currentUser={currentUser!}
                      onStartPrivateChat={onStartPrivateChat}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 sm:p-1 md:p-2 h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8"
                        data-testid={`online-user-menu-${member.id}`}
                      >
                        <MoreVertical className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5" />
                      </Button>
                    </UserProfileMenu>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Offline Members */}
        {offlineMembers.length > 0 && (
          <div className={cn("p-4", onlineMembers.length > 0 && "border-t border-gray-800")}>
            <h4 className="text-xs sm:text-sm md:text-base font-medium text-gray-300 uppercase tracking-wider mb-2 sm:mb-3 md:mb-4">
              Offline — {offlineMembers.length}
            </h4>
            
            <div className="space-y-1 sm:space-y-2 md:space-y-3">
              {offlineMembers.map((member) => (
                <div
                  key={`offline-${member.id}`}
                  className="group flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-800 transition-colors opacity-60"
                  data-testid={`offline-user-${member.id}`}
                >
                  <div className="relative">
                    {member.primaryPhoto?.photoUrl ? (
                      <img 
                        src={member.primaryPhoto.photoUrl}
                        alt={`${member.displayName} profile`}
                        className="w-8 h-8 rounded-full object-cover border-2 border-black opacity-60"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
                        {getInitials(member.displayName)}
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-gray-400 border-2 border-black rounded-full"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium text-gray-200 truncate">
                        {member.displayName}
                      </p>
                      {member.age && (
                        <span className="text-xs text-gray-400 font-normal">
                          {member.age}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-xs text-gray-400">@{member.username}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 font-medium">Offline</span>
                        {currentUser && (
                          <UserDistance 
                            currentUserId={currentUser.id} 
                            targetUserId={member.id}
                            className="text-xs text-gray-500 font-medium opacity-80"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                  <UserProfileMenu
                    user={member}
                    currentUser={currentUser!}
                    onStartPrivateChat={onStartPrivateChat}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 sm:p-1 md:p-2 h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8"
                      data-testid={`offline-user-menu-${member.id}`}
                    >
                      <MoreVertical className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5" />
                    </Button>
                  </UserProfileMenu>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
