import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Check, X, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { User, FriendRequestWithUser } from '@shared/schema';

interface FriendRequestsProps {
  user: User;
  isMobile?: boolean;
}

export default function FriendRequests({ user, isMobile = false }: FriendRequestsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch friend requests
  const { data: requestsData, isLoading } = useQuery({
    queryKey: [`/api/users/${user.id}/friend-requests`],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/users/${user.id}/friend-requests`);
      if (!response.ok) {
        throw new Error('Failed to fetch friend requests');
      }
      return await response.json();
    },
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  const friendRequests = requestsData?.friendRequests || [];

  // Respond to friend request mutation
  const respondToRequestMutation = useMutation({
    mutationFn: async ({ requestId, action }: { requestId: string; action: 'accept' | 'decline' }) => {
      const response = await apiRequest('PUT', `/api/friend-requests/${requestId}`, { action });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to respond to friend request');
      }
      return await response.json();
    },
    onSuccess: (_, { action }) => {
      toast({
        title: "Success",
        description: action === 'accept' ? "Friend request accepted!" : "Friend request declined",
      });
      // Invalidate all friend-related queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user.id}/friend-requests`] });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user.id}/sent-friend-requests`] });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user.id}/friends`] });
      queryClient.invalidateQueries({ predicate: (query) => {
        return query.queryKey[0] === `/api/users/${user.id}/friendship-status`;
      }});
      // Force immediate refetch
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: [`/api/users/${user.id}/friend-requests`] });
        queryClient.refetchQueries({ queryKey: [`/api/users/${user.id}/friends`] });
      }, 100);
    },
    onError: (error: any) => {
      console.error('Friend request response error:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to respond to friend request",
        variant: "destructive",
      });
    },
  });

  const handleAccept = (requestId: string) => {
    respondToRequestMutation.mutate({ requestId, action: 'accept' });
  };

  const handleDecline = (requestId: string) => {
    respondToRequestMutation.mutate({ requestId, action: 'decline' });
  };

  if (isLoading) {
    return (
      <Card className="glass-effect backdrop-blur-glass border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <UserPlus className="w-5 h-5 text-primary" />
            <span>Friend Requests</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse flex items-center space-x-4 p-4 rounded-lg bg-gray-700">
                <div className="w-12 h-12 bg-gray-600 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-600 rounded mb-2"></div>
                  <div className="h-3 bg-gray-600 rounded w-24"></div>
                </div>
                <div className="flex space-x-2">
                  <div className="w-16 h-8 bg-gray-600 rounded"></div>
                  <div className="w-16 h-8 bg-gray-600 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-effect backdrop-blur-glass border-primary/20">
      <CardHeader className={cn(isMobile ? "p-4 pb-3" : "")}>
        <CardTitle className={cn(
          "flex items-center justify-between",
          isMobile ? "text-lg" : ""
        )}>
          <div className="flex items-center space-x-2">
            <UserPlus className={cn(
              "text-primary",
              isMobile ? "w-5 h-5" : "w-6 h-6"
            )} />
            <span>Friend Requests</span>
          </div>
          {friendRequests.length > 0 && (
            <Badge variant="secondary" className="bg-primary/20">
              {friendRequests.length}
            </Badge>
          )}
        </CardTitle>
        <CardDescription className={cn(isMobile ? "text-sm" : "")}>
          People who want to connect with you
        </CardDescription>
      </CardHeader>
      <CardContent className={cn(isMobile ? "p-4 pt-0" : "")}>
        {friendRequests.length === 0 ? (
          <div className="text-center py-8">
            <UserPlus className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400 mb-2">No pending friend requests</p>
            <p className="text-gray-500 text-sm">When someone sends you a friend request, it will appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {friendRequests.map((request: FriendRequestWithUser) => (
              <div
                key={request.id}
                className="flex items-center justify-between p-4 rounded-lg border border-gray-700 hover:border-primary/50 transition-colors"
                data-testid={`friend-request-${request.id}`}
              >
                <div className="flex items-center space-x-3">
                  <Avatar className="w-12 h-12">
                    <AvatarImage 
                      src={typeof request.sender.primaryPhoto === 'string' ? request.sender.primaryPhoto : request.sender.primaryPhoto?.photoUrl || ''} 
                      alt={request.sender.username}
                    />
                    <AvatarFallback className="bg-primary/20 text-primary">
                      {request.sender.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-white">{request.sender.username}</p>
                    <div className="flex items-center space-x-2 text-sm text-gray-400">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(request.createdAt || new Date()).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    onClick={() => handleAccept(request.id)}
                    disabled={respondToRequestMutation.isPending}
                    className="bg-green-600 hover:bg-green-700 text-white"
                    data-testid={`button-accept-${request.id}`}
                  >
                    <Check className="w-4 h-4 mr-1" />
                    {respondToRequestMutation.isPending ? 'Processing...' : 'Accept'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDecline(request.id)}
                    disabled={respondToRequestMutation.isPending}
                    className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
                    data-testid={`button-decline-${request.id}`}
                  >
                    <X className="w-4 h-4 mr-1" />
                    {respondToRequestMutation.isPending ? 'Processing...' : 'Decline'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}