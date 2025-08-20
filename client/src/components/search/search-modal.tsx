import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, MessageSquare, Users, Hash, X, Clock, ArrowRight } from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useResponsive } from '@/hooks/use-responsive';
import type { User, Room, MessageWithUser } from '@shared/schema';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRoom?: (room: Room) => void;
  onSelectUser?: (user: User) => void;
  onSelectMessage?: (message: MessageWithUser) => void;
  currentUserId?: string;
}

interface SearchResults {
  messages: MessageWithUser[];
  users: User[];
  rooms: Room[];
}

export default function SearchModal({ 
  isOpen, 
  onClose, 
  onSelectRoom, 
  onSelectUser, 
  onSelectMessage,
  currentUserId 
}: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'messages' | 'users' | 'rooms'>('all');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const { isMobile } = useResponsive();

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Search messages
  const { data: messagesData, isLoading: messagesLoading } = useQuery<{ results: MessageWithUser[] }>({
    queryKey: ['/api/search/messages', debouncedQuery, currentUserId],
    enabled: !!debouncedQuery && debouncedQuery.length >= 2,
    queryFn: async () => {
      const params = new URLSearchParams({
        q: debouncedQuery,
        ...(currentUserId && { userId: currentUserId }),
        limit: '10'
      });
      const response = await fetch(`/api/search/messages?${params}`);
      if (!response.ok) throw new Error('Failed to search messages');
      return response.json();
    },
  });

  // Search users
  const { data: usersData, isLoading: usersLoading } = useQuery<{ results: User[] }>({
    queryKey: ['/api/search/users', debouncedQuery, currentUserId],
    enabled: !!debouncedQuery && debouncedQuery.length >= 2,
    queryFn: async () => {
      const params = new URLSearchParams({
        q: debouncedQuery,
        ...(currentUserId && { currentUserId }),
        limit: '10'
      });
      const response = await fetch(`/api/search/users?${params}`);
      if (!response.ok) throw new Error('Failed to search users');
      return response.json();
    },
  });

  // Search rooms
  const { data: roomsData, isLoading: roomsLoading } = useQuery<{ results: Room[] }>({
    queryKey: ['/api/search/rooms', debouncedQuery, currentUserId],
    enabled: !!debouncedQuery && debouncedQuery.length >= 2,
    queryFn: async () => {
      const params = new URLSearchParams({
        q: debouncedQuery,
        ...(currentUserId && { userId: currentUserId }),
        limit: '10'
      });
      const response = await fetch(`/api/search/rooms?${params}`);
      if (!response.ok) throw new Error('Failed to search rooms');
      return response.json();
    },
  });

  const isLoading = messagesLoading || usersLoading || roomsLoading;
  const hasResults = (messagesData?.results?.length || 0) + (usersData?.results?.length || 0) + (roomsData?.results?.length || 0) > 0;

  const handleClose = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
    setActiveTab('all');
    onClose();
  }, [onClose]);

  const handleSelectRoom = useCallback((room: Room) => {
    onSelectRoom?.(room);
    handleClose();
  }, [onSelectRoom, handleClose]);

  const handleSelectUser = useCallback((user: User) => {
    onSelectUser?.(user);
    handleClose();
  }, [onSelectUser, handleClose]);

  const handleSelectMessage = useCallback((message: MessageWithUser) => {
    onSelectMessage?.(message);
    handleClose();
  }, [onSelectMessage, handleClose]);

  const formatMessagePreview = (content: string, maxLength: number = 60) => {
    return content.length > maxLength ? content.substring(0, maxLength) + '...' : content;
  };

  const formatTimeAgo = (date: Date | null) => {
    if (!date) return '';
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={cn(
        "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700",
        isMobile ? "w-full h-full max-w-none max-h-none rounded-none p-4" : "max-w-2xl max-h-[80vh] p-6"
      )} data-testid="search-modal">
        <DialogHeader className={cn(isMobile ? "mb-4" : "mb-6")}>
          <div className="flex items-center justify-between">
            <DialogTitle className={cn(
              "flex items-center gap-2 text-gray-900 dark:text-white",
              isMobile ? "text-lg" : "text-xl"
            )}>
              <Search className={cn(isMobile ? "w-5 h-5" : "w-6 h-6")} />
              Search
            </DialogTitle>
            <DialogDescription className="sr-only">
              Search for messages, users, and rooms across your conversations
            </DialogDescription>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleClose}
              className="h-8 w-8 p-0"
              data-testid="button-close-search"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search messages, users, or rooms..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
              autoFocus
              data-testid="input-search-query"
            />
          </div>

          {/* Search Tabs */}
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
            <TabsList className="grid w-full grid-cols-4 bg-gray-100 dark:bg-gray-800">
              <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
              <TabsTrigger value="messages" className="text-xs">
                <MessageSquare className="w-3 h-3 mr-1" />
                Messages
              </TabsTrigger>
              <TabsTrigger value="users" className="text-xs">
                <Users className="w-3 h-3 mr-1" />
                Users
              </TabsTrigger>
              <TabsTrigger value="rooms" className="text-xs">
                <Hash className="w-3 h-3 mr-1" />
                Rooms
              </TabsTrigger>
            </TabsList>

            <ScrollArea className={cn(isMobile ? "h-80" : "h-56", "border-t border-gray-200 dark:border-gray-700 mt-4 pt-4")}>
              {/* Loading State */}
              {isLoading && debouncedQuery && (
                <div className="flex items-center justify-center py-6">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                  <span className="ml-2 text-sm text-gray-500">Searching...</span>
                </div>
              )}

              {/* No Query State */}
              {!debouncedQuery && (
                <div className="text-center py-6">
                  <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">Start typing to search</p>
                </div>
              )}

              {/* No Results State */}
              {debouncedQuery && !isLoading && !hasResults && (
                <div className="text-center py-6">
                  <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No results found for "{debouncedQuery}"</p>
                </div>
              )}

              {/* All Results */}
              <TabsContent value="all" className="space-y-3 max-h-full overflow-hidden">
                {/* Messages Section */}
                {messagesData?.results && messagesData.results.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Messages ({messagesData.results.length})
                    </h3>
                    <div className="space-y-2">
                      {messagesData.results.slice(0, 3).map((message) => (
                        <div
                          key={message.id}
                          onClick={() => handleSelectMessage(message)}
                          className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                          data-testid={`result-message-${message.id}`}
                        >
                          <div className="flex items-start gap-3">
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={message.user.avatar || undefined} />
                              <AvatarFallback className="text-xs">
                                {message.user.displayName.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                  {message.user.displayName}
                                </span>
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatTimeAgo(message.createdAt)}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
                                {formatMessagePreview(message.content)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Users Section */}
                {usersData?.results && usersData.results.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Users ({usersData.results.length})
                    </h3>
                    <div className="space-y-2">
                      {usersData.results.slice(0, 3).map((user) => (
                        <div
                          key={user.id}
                          onClick={() => handleSelectUser(user)}
                          className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                          data-testid={`result-user-${user.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="w-10 h-10">
                              <AvatarImage src={user.avatar || undefined} />
                              <AvatarFallback>
                                {user.displayName.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900 dark:text-white">
                                  {user.displayName}
                                </span>
                                {user.isOnline && (
                                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                                    Online
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-500">@{user.username}</p>
                            </div>
                            <ArrowRight className="w-4 h-4 text-gray-400" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rooms Section */}
                {roomsData?.results && roomsData.results.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                      <Hash className="w-4 h-4" />
                      Rooms ({roomsData.results.length})
                    </h3>
                    <div className="space-y-2">
                      {roomsData.results.slice(0, 3).map((room) => (
                        <div
                          key={room.id}
                          onClick={() => handleSelectRoom(room)}
                          className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                          data-testid={`result-room-${room.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                              <Hash className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900 dark:text-white">{room.name}</h4>
                              {room.description && (
                                <p className="text-sm text-gray-500 truncate">
                                  {room.description}
                                </p>
                              )}
                            </div>
                            <ArrowRight className="w-4 h-4 text-gray-400" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Individual tabs with full results */}
              <TabsContent value="messages">
                {messagesData?.results && messagesData.results.length > 0 ? (
                  <div className="space-y-2">
                    {messagesData.results.map((message) => (
                      <div
                        key={message.id}
                        onClick={() => handleSelectMessage(message)}
                        className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                        data-testid={`result-message-${message.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={message.user.avatar || undefined} />
                            <AvatarFallback className="text-xs">
                              {message.user.displayName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {message.user.displayName}
                              </span>
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatTimeAgo(message.createdAt)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              {message.content}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : debouncedQuery && !messagesLoading && (
                  <div className="text-center py-8">
                    <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-sm">No messages found</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="users">
                {usersData?.results && usersData.results.length > 0 ? (
                  <div className="space-y-2">
                    {usersData.results.map((user) => (
                      <div
                        key={user.id}
                        onClick={() => handleSelectUser(user)}
                        className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                        data-testid={`result-user-${user.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={user.avatar || undefined} />
                            <AvatarFallback>
                              {user.displayName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 dark:text-white">
                                {user.displayName}
                              </span>
                              {user.isOnline && (
                                <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                                  Online
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-500">@{user.username}</p>
                            {user.location && (
                              <p className="text-sm text-gray-400">{user.location}</p>
                            )}
                          </div>
                          <ArrowRight className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : debouncedQuery && !usersLoading && (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-sm">No users found</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="rooms">
                {roomsData?.results && roomsData.results.length > 0 ? (
                  <div className="space-y-2">
                    {roomsData.results.map((room) => (
                      <div
                        key={room.id}
                        onClick={() => handleSelectRoom(room)}
                        className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                        data-testid={`result-room-${room.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                            <Hash className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 dark:text-white">{room.name}</h4>
                            {room.description && (
                              <p className="text-sm text-gray-500">
                                {room.description}
                              </p>
                            )}
                          </div>
                          <ArrowRight className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : debouncedQuery && !roomsLoading && (
                  <div className="text-center py-8">
                    <Hash className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-sm">No rooms found</p>
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}