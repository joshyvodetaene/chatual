import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Search, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { User, UserWithFriendStatus } from '@shared/schema';

interface SendFriendRequestProps {
  user: User;
  isMobile?: boolean;
}

export default function SendFriendRequest({ user, isMobile = false }: SendFriendRequestProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserWithFriendStatus[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Send friend request mutation
  const sendRequestMutation = useMutation({
    mutationFn: async (receiverId: string) => {
      const response = await apiRequest('POST', '/api/friend-requests', {
        senderId: user.id,
        receiverId
      });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Friend request sent successfully!",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user.id}/friend-requests`] });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user.id}/sent-friend-requests`] });
      // Refresh search results to update status
      if (searchQuery) {
        performSearch();
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to send friend request",
        variant: "destructive",
      });
    },
  });

  const performSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await apiRequest('GET', `/api/search/users?q=${encodeURIComponent(searchQuery)}&currentUserId=${user.id}`);
      const data = await response.json();
      
      // Ensure results array exists
      const results = data?.results || [];
      
      if (results.length === 0) {
        setSearchResults([]);
        return;
      }
      
      // Get friendship status for each user
      const usersWithStatus = await Promise.all(
        results.map(async (foundUser: User) => {
          if (foundUser.id === user.id) return null; // Don't include self
          
          try {
            const statusResponse = await apiRequest('GET', `/api/users/${user.id}/friendship-status/${foundUser.id}`);
            const statusData = await statusResponse.json();
            return {
              ...foundUser,
              friendshipStatus: statusData.status
            } as UserWithFriendStatus;
          } catch (error) {
            return {
              ...foundUser,
              friendshipStatus: 'none'
            } as UserWithFriendStatus;
          }
        })
      );

      setSearchResults(usersWithStatus.filter(Boolean) as UserWithFriendStatus[]);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to search users",
        variant: "destructive",
      });
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch();
  };

  const handleSendRequest = (receiverId: string) => {
    sendRequestMutation.mutate(receiverId);
  };

  const getStatusBadge = (status: UserWithFriendStatus['friendshipStatus']) => {
    switch (status) {
      case 'friends':
        return <Badge className="bg-green-600 text-white">Friends</Badge>;
      case 'pending_sent':
        return <Badge className="bg-yellow-600 text-white">Request Sent</Badge>;
      case 'pending_received':
        return <Badge className="bg-blue-600 text-white">Request Received</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card className="glass-effect backdrop-blur-glass border-primary/20">
      <CardHeader className={cn(isMobile ? "p-4 pb-3" : "")}>
        <CardTitle className={cn(
          "flex items-center space-x-2",
          isMobile ? "text-lg" : ""
        )}>
          <UserPlus className={cn(
            "text-primary",
            isMobile ? "w-5 h-5" : "w-6 h-6"
          )} />
          <span>Find Friends</span>
        </CardTitle>
        <CardDescription className={cn(isMobile ? "text-sm" : "")}>
          Search for users and send friend requests
        </CardDescription>
      </CardHeader>
      <CardContent className={cn(isMobile ? "p-4 pt-0" : "")}>
        {/* Search form */}
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex space-x-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-gray-800 border-gray-700 text-white placeholder:text-gray-400"
                data-testid="input-search-users"
              />
            </div>
            <Button 
              type="submit" 
              disabled={isSearching || !searchQuery.trim()}
              className="hover-lift"
              data-testid="button-search-users"
            >
              {isSearching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
          </div>
        </form>

        {/* Search results */}
        {searchResults.length > 0 && (
          <div className="mt-6">
            <h4 className="font-medium text-white mb-4">Search Results</h4>
            <div className="space-y-3">
              {searchResults.map((foundUser) => (
                <div
                  key={foundUser.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-gray-700 hover:border-primary/50 transition-colors"
                  data-testid={`search-result-${foundUser.id}`}
                >
                  <div className="flex items-center space-x-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage 
                        src={foundUser.primaryPhoto || ''} 
                        alt={foundUser.username}
                      />
                      <AvatarFallback className="bg-primary/20 text-primary">
                        {foundUser.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-white">{foundUser.username}</p>
                      {foundUser.bio && (
                        <p className="text-sm text-gray-400 truncate max-w-40">
                          {foundUser.bio}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {getStatusBadge(foundUser.friendshipStatus)}
                    {foundUser.friendshipStatus === 'none' && (
                      <Button
                        size="sm"
                        onClick={() => handleSendRequest(foundUser.id)}
                        disabled={sendRequestMutation.isPending}
                        className="hover-lift"
                        data-testid={`button-send-request-${foundUser.id}`}
                      >
                        {sendRequestMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <UserPlus className="w-4 h-4 mr-1" />
                        )}
                        Add Friend
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {searchQuery && !isSearching && searchResults.length === 0 && (
          <div className="mt-6 text-center py-8">
            <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400 mb-2">No users found</p>
            <p className="text-gray-500 text-sm">Try searching with a different username</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}