import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { UserMinus, Clock, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { User, FriendRequestWithUser } from '@shared/schema';

interface SentFriendRequestsProps {
  user: User;
  isMobile?: boolean;
}

export default function SentFriendRequests({ user, isMobile = false }: SentFriendRequestsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch sent friend requests
  const { data: requestsData, isLoading } = useQuery({
    queryKey: [`/api/users/${user.id}/sent-friend-requests`],
    queryFn: () => apiRequest('GET', `/api/users/${user.id}/sent-friend-requests`),
  });

  const sentFriendRequests = requestsData?.sentFriendRequests || [];

  // Cancel friend request mutation
  const cancelRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return await apiRequest('DELETE', `/api/friend-requests/${requestId}/cancel/${user.id}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Friend request cancelled",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user.id}/sent-friend-requests`] });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user.id}/friendship-status`] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to cancel friend request",
        variant: "destructive",
      });
    },
  });

  const handleCancel = (requestId: string) => {
    cancelRequestMutation.mutate(requestId);
  };

  if (isLoading) {
    return (
      <Card className="glass-effect backdrop-blur-glass border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <UserMinus className="w-5 h-5 text-primary" />
            <span>Sent Requests</span>
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
                <div className="w-16 h-8 bg-gray-600 rounded"></div>
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
            <UserMinus className={cn(
              "text-primary",
              isMobile ? "w-5 h-5" : "w-6 h-6"
            )} />
            <span>Sent Requests</span>
          </div>
          {sentFriendRequests.length > 0 && (
            <Badge variant="secondary" className="bg-orange-500/20">
              {sentFriendRequests.length}
            </Badge>
          )}
        </CardTitle>
        <CardDescription className={cn(isMobile ? "text-sm" : "")}>
          Friend requests you've sent
        </CardDescription>
      </CardHeader>
      <CardContent className={cn(isMobile ? "p-4 pt-0" : "")}>
        {sentFriendRequests.length === 0 ? (
          <div className="text-center py-8">
            <UserMinus className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400 mb-2">No pending sent requests</p>
            <p className="text-gray-500 text-sm">Friend requests you send will appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sentFriendRequests.map((request: FriendRequestWithUser) => (
              <div
                key={request.id}
                className="flex items-center justify-between p-4 rounded-lg border border-gray-700 hover:border-orange-500/50 transition-colors"
                data-testid={`sent-friend-request-${request.id}`}
              >
                <div className="flex items-center space-x-3">
                  <Avatar className="w-12 h-12">
                    <AvatarImage 
                      src={request.receiver.primaryPhoto || ''} 
                      alt={request.receiver.username}
                    />
                    <AvatarFallback className="bg-primary/20 text-primary">
                      {request.receiver.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-white">{request.receiver.username}</p>
                    <div className="flex items-center space-x-2 text-sm text-gray-400">
                      <Clock className="w-3 h-3" />
                      <span>Sent {new Date(request.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCancel(request.id)}
                  disabled={cancelRequestMutation.isPending}
                  className="border-orange-600 text-orange-600 hover:bg-orange-600 hover:text-white"
                  data-testid={`button-cancel-${request.id}`}
                >
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}