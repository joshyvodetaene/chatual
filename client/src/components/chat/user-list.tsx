
import { RoomWithMembers, User } from '@shared/schema';
import { cn } from '@/lib/utils';
import UserDistance from './user-distance';
import { UserProfileMenu } from './user-profile-menu';
import FriendButton from '@/components/friends/friend-button';
import { MoreVertical, Search, Users, Wifi } from 'lucide-react';
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
    // Professional color palette
    if (gender === 'female') {
      return 'bg-gradient-to-br from-violet-500 to-purple-600';
    }
    if (gender === 'male') {
      return 'bg-gradient-to-br from-blue-500 to-indigo-600';
    }
    
    // Sophisticated fallback colors
    const colors = [
      'bg-gradient-to-br from-slate-500 to-slate-600',
      'bg-gradient-to-br from-emerald-500 to-teal-600',
      'bg-gradient-to-br from-amber-500 to-orange-600',
      'bg-gradient-to-br from-rose-500 to-pink-600',
      'bg-gradient-to-br from-cyan-500 to-blue-600',
      'bg-gradient-to-br from-purple-500 to-violet-600',
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
    <div className="w-full sm:w-60 md:w-64 lg:w-72 h-full bg-white border-l border-slate-200 flex flex-col shadow-sm" data-testid="user-list">
      {/* Professional Header */}
      <div className="px-4 py-5 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-8 h-8 bg-slate-600 rounded-lg flex items-center justify-center">
            <Users className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-slate-900 truncate">Room Members</h3>
            <p className="text-sm text-slate-600 mt-0.5" data-testid="online-count">
              {onlineMembers.length} online • {filteredMembers.length} total
            </p>
          </div>
        </div>
        
        {/* Search Input */}
        {onlineMembers.length > 3 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Search members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-9 text-sm bg-white border-slate-200 focus:border-slate-400 focus:ring-slate-400"
            />
          </div>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto overflow-x-visible min-h-0">
        {/* Online Members Section */}
        {onlineMembers.length > 0 && (
          <div className="p-4">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Online ({onlineMembers.length})
              </h4>
            </div>
            
            <div className="space-y-2">
              {filteredOnlineMembers.map((member) => (
                <div
                  key={`online-${member.id}`}
                  className="group flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-50 transition-colors duration-150 border border-transparent hover:border-slate-200"
                  data-testid={`online-user-${member.id}`}
                >
                  <div className="relative flex-shrink-0">
                    {member.primaryPhoto?.photoUrl ? (
                      <img 
                        src={member.primaryPhoto.photoUrl}
                        alt={`${member.displayName} profile`}
                        className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
                      />
                    ) : (
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium shadow-sm",
                        getAvatarColor(member.displayName, member.gender)
                      )}>
                        {getInitials(member.displayName)}
                      </div>
                    )}
                    {/* Online indicator */}
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full shadow-sm"></div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {member.displayName}
                      </p>
                      {member.age && (
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          {member.age}
                        </span>
                      )}
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-xs text-slate-600 truncate">@{member.username}</p>
                      
                      {member.location && (
                        <p className="text-xs text-slate-500 truncate flex items-center">
                          <span className="mr-1">📍</span>
                          {member.location}
                        </p>
                      )}
                      
                      <div className="flex items-center space-x-3 text-xs">
                        <div className="flex items-center space-x-1 text-emerald-600">
                          <Wifi className="w-3 h-3" />
                          <span className="font-medium">Online</span>
                        </div>
                        {currentUser && (
                          <UserDistance 
                            currentUserId={currentUser.id} 
                            targetUserId={member.id}
                            className="text-slate-500"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    {currentUser && member.id !== currentUser.id && (
                      <FriendButton
                        currentUser={currentUser}
                        targetUser={member}
                        size="sm"
                        className="h-7 px-2"
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
                        className="h-7 w-7 p-0 hover:bg-slate-200"
                        data-testid={`online-user-menu-${member.id}`}
                      >
                        <MoreVertical className="h-3 w-3" />
                      </Button>
                    </UserProfileMenu>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Offline Members Section */}
        {offlineMembers.length > 0 && (
          <div className={cn("p-4", onlineMembers.length > 0 && "border-t border-slate-100")}>
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Offline ({offlineMembers.length})
              </h4>
            </div>
            
            <div className="space-y-2">
              {offlineMembers.map((member) => (
                <div
                  key={`offline-${member.id}`}
                  className="group flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-50 transition-colors duration-150 opacity-60"
                  data-testid={`offline-user-${member.id}`}
                >
                  <div className="relative flex-shrink-0">
                    {member.primaryPhoto?.photoUrl ? (
                      <img 
                        src={member.primaryPhoto.photoUrl}
                        alt={`${member.displayName} profile`}
                        className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm grayscale"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-gradient-to-br from-slate-400 to-slate-500 rounded-full flex items-center justify-center text-white text-sm font-medium shadow-sm">
                        {getInitials(member.displayName)}
                      </div>
                    )}
                    {/* Offline indicator */}
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-slate-400 border-2 border-white rounded-full shadow-sm"></div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <p className="text-sm font-medium text-slate-700 truncate">
                        {member.displayName}
                      </p>
                      {member.age && (
                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                          {member.age}
                        </span>
                      )}
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-xs text-slate-500 truncate">@{member.username}</p>
                      
                      <div className="flex items-center space-x-3 text-xs">
                        <span className="text-slate-400 font-medium">Offline</span>
                        {currentUser && (
                          <UserDistance 
                            currentUserId={currentUser.id} 
                            targetUserId={member.id}
                            className="text-slate-400"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    <UserProfileMenu
                      user={member}
                      currentUser={currentUser!}
                      onStartPrivateChat={onStartPrivateChat}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 hover:bg-slate-200"
                        data-testid={`offline-user-menu-${member.id}`}
                      >
                        <MoreVertical className="h-3 w-3" />
                      </Button>
                    </UserProfileMenu>
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
