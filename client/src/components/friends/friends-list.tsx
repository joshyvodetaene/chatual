import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Users, Search, MoreVertical, MessageCircle, UserMinus, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { User, FriendshipWithUser } from '@shared/schema';

interface FriendsListProps {
  user: User;
  isMobile?: boolean;
}

export default function FriendsList({ user, isMobile = false }: FriendsListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [friendToRemove, setFriendToRemove] = useState<FriendshipWithUser | null>(null);

  // Fetch friends list
  const { data: friendsData, isLoading } = useQuery({
    queryKey: [`/api/users/${user.id}/friends`],
    queryFn: () => apiRequest('GET', `/api/users/${user.id}/friends`),
  });

  const friends = friendsData?.friends || [];

  // Filter friends based on search query
  const filteredFriends = friends.filter((friendship: FriendshipWithUser) =>
    friendship.friend.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Remove friend mutation
  const removeFriendMutation = useMutation({
    mutationFn: async (friendId: string) => {
      return await apiRequest('DELETE', `/api/users/${user.id}/friends/${friendId}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Friend removed successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user.id}/friends`] });
      setFriendToRemove(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to remove friend",
        variant: "destructive",
      });
    },
  });

  const handleRemoveFriend = (friendship: FriendshipWithUser) => {
    setFriendToRemove(friendship);
  };

  const confirmRemoveFriend = () => {
    if (friendToRemove) {
      removeFriendMutation.mutate(friendToRemove.friend.id);
    }
  };

  const handleStartChat = async (friendId: string) => {
    try {
      const response = await apiRequest('POST', '/api/private-chat/create', {
        user1Id: user.id,
        user2Id: friendId
      });
      
      // Navigate to the private chat (you might want to emit an event or use navigation)
      toast({
        title: "Chat Started",
        description: "Private chat created successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to start chat",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card className="glass-effect backdrop-blur-glass border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-primary" />
            <span>Friends</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse flex items-center space-x-4 p-4 rounded-lg bg-gray-700">
                <div className="w-12 h-12 bg-gray-600 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-600 rounded mb-2"></div>
                  <div className="h-3 bg-gray-600 rounded w-32"></div>
                </div>
                <div className="w-8 h-8 bg-gray-600 rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="glass-effect backdrop-blur-glass border-primary/20">
        <CardHeader className={cn(isMobile ? "p-4 pb-3" : "")}>
          <CardTitle className={cn(
            "flex items-center justify-between",
            isMobile ? "text-lg" : ""
          )}>
            <div className="flex items-center space-x-2">
              <Users className={cn(
                "text-primary",
                isMobile ? "w-5 h-5" : "w-6 h-6"
              )} />
              <span>Friends</span>
            </div>
            {friends.length > 0 && (
              <Badge variant="secondary" className="bg-primary/20">
                {friends.length}
              </Badge>
            )}
          </CardTitle>
          <CardDescription className={cn(isMobile ? "text-sm" : "")}>
            Your connected friends
          </CardDescription>
        </CardHeader>
        <CardContent className={cn(isMobile ? "p-4 pt-0" : "")}>
          {friends.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-400 mb-2">No friends yet</p>
              <p className="text-gray-500 text-sm">Start connecting with other users to build your network</p>
            </div>
          ) : (
            <>
              {/* Search bar */}
              {friends.length > 3 && (
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search friends..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-gray-800 border-gray-700 text-white placeholder:text-gray-400"
                    data-testid="input-search-friends"
                  />
                </div>
              )}

              {/* Friends list */}
              <div className="space-y-3">
                {filteredFriends.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-gray-400">No friends match your search</p>
                  </div>
                ) : (
                  filteredFriends.map((friendship: FriendshipWithUser) => (
                    <div
                      key={friendship.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-gray-700 hover:border-primary/50 transition-colors"
                      data-testid={`friend-${friendship.friend.id}`}
                    >
                      <div className="flex items-center space-x-3">
                        <Avatar className="w-12 h-12">
                          <AvatarImage 
                            src={friendship.friend.primaryPhoto || ''} 
                            alt={friendship.friend.username}
                          />
                          <AvatarFallback className="bg-primary/20 text-primary">
                            {friendship.friend.username.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-white">{friendship.friend.username}</p>
                          <div className="flex items-center space-x-2 text-sm text-gray-400">
                            <Calendar className="w-3 h-3" />
                            <span>Friends since {new Date(friendship.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-gray-800 border-gray-700">
                          <DropdownMenuItem 
                            onClick={() => handleStartChat(friendship.friend.id)}
                            className="text-white hover:bg-gray-700"
                            data-testid={`button-chat-${friendship.friend.id}`}
                          >
                            <MessageCircle className="w-4 h-4 mr-2" />
                            Start Chat
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleRemoveFriend(friendship)}
                            className="text-red-400 hover:bg-red-900/20"
                            data-testid={`button-remove-${friendship.friend.id}`}
                          >
                            <UserMinus className="w-4 h-4 mr-2" />
                            Remove Friend
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Remove friend confirmation dialog */}
      <AlertDialog open={!!friendToRemove} onOpenChange={() => setFriendToRemove(null)}>
        <AlertDialogContent className="bg-gray-900 border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Remove Friend</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Are you sure you want to remove <span className="font-medium text-white">{friendToRemove?.friend.username}</span> from your friends list? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-700 text-white border-gray-600 hover:bg-gray-600">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveFriend}
              disabled={removeFriendMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="button-confirm-remove-friend"
            >
              {removeFriendMutation.isPending && (
                <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              Remove Friend
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}