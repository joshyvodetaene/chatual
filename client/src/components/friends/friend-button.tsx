import { useState } from 'react';
import { Button } from '@/components/ui/button';
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
import { 
  UserPlus, 
  UserMinus, 
  Users, 
  Clock, 
  MessageCircle, 
  MoreVertical,
  Check,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { User, UserWithFriendStatus } from '@shared/schema';

interface FriendButtonProps {
  currentUser: User;
  targetUser: User;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showDropdown?: boolean;
}

export default function FriendButton({ 
  currentUser, 
  targetUser, 
  className = '',
  size = 'md',
  showDropdown = false 
}: FriendButtonProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);

  // Get friendship status
  const { data: statusData, isLoading } = useQuery({
    queryKey: [`/api/users/${currentUser.id}/friendship-status/${targetUser.id}`],
    queryFn: () => apiRequest('GET', `/api/users/${currentUser.id}/friendship-status/${targetUser.id}`),
    enabled: currentUser.id !== targetUser.id,
  });

  const friendshipStatus = statusData?.status || 'none';

  // Send friend request mutation
  const sendRequestMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/friend-requests', {
        senderId: currentUser.id,
        receiverId: targetUser.id
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Friend request sent to ${targetUser.username}`,
      });
      invalidateQueries();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to send friend request",
        variant: "destructive",
      });
    },
  });

  // Remove friend mutation
  const removeFriendMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('DELETE', `/api/users/${currentUser.id}/friends/${targetUser.id}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Removed ${targetUser.username} from friends`,
      });
      invalidateQueries();
      setShowRemoveDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to remove friend",
        variant: "destructive",
      });
    },
  });

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/users/${currentUser.id}/friendship-status/${targetUser.id}`] });
    queryClient.invalidateQueries({ queryKey: [`/api/users/${currentUser.id}/friends`] });
    queryClient.invalidateQueries({ queryKey: [`/api/users/${currentUser.id}/friend-requests`] });
  };

  const handleSendRequest = () => {
    sendRequestMutation.mutate();
  };

  const handleRemoveFriend = () => {
    setShowRemoveDialog(true);
  };

  const confirmRemoveFriend = () => {
    removeFriendMutation.mutate();
  };

  const handleStartChat = async () => {
    try {
      await apiRequest('POST', '/api/private-chat/create', {
        user1Id: currentUser.id,
        user2Id: targetUser.id
      });
      
      toast({
        title: "Chat Started",
        description: `Started private chat with ${targetUser.username}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to start chat",
        variant: "destructive",
      });
    }
  };

  // Don't show button for self
  if (currentUser.id === targetUser.id) {
    return null;
  }

  const isLoading_ = isLoading || sendRequestMutation.isPending || removeFriendMutation.isPending;

  const getButtonContent = () => {
    switch (friendshipStatus) {
      case 'friends':
        return showDropdown ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size={size}
                className={cn("hover-lift", className)}
                disabled={isLoading_}
                data-testid={`friend-button-${targetUser.id}`}
              >
                <Users className="w-4 h-4 mr-2" />
                Friends
                <MoreVertical className="w-4 h-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-gray-800 border-gray-700">
              <DropdownMenuItem 
                onClick={handleStartChat}
                className="text-white hover:bg-gray-700"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Message
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={handleRemoveFriend}
                className="text-red-400 hover:bg-red-900/20"
              >
                <UserMinus className="w-4 h-4 mr-2" />
                Remove Friend
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button 
            variant="outline" 
            size={size}
            onClick={handleStartChat}
            className={cn("hover-lift", className)}
            disabled={isLoading_}
            data-testid={`friend-button-${targetUser.id}`}
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Message
          </Button>
        );

      case 'pending_sent':
        return (
          <Button 
            variant="outline" 
            size={size}
            disabled
            className={cn("opacity-60", className)}
            data-testid={`friend-button-${targetUser.id}`}
          >
            <Clock className="w-4 h-4 mr-2" />
            Request Sent
          </Button>
        );

      case 'pending_received':
        return (
          <div className="flex space-x-2">
            <Button 
              size={size}
              className={cn("bg-green-600 hover:bg-green-700", className)}
              disabled={isLoading_}
              data-testid={`button-accept-${targetUser.id}`}
            >
              <Check className="w-4 h-4 mr-2" />
              Accept
            </Button>
            <Button 
              variant="outline"
              size={size}
              className={cn("border-red-600 text-red-600 hover:bg-red-600 hover:text-white", className)}
              disabled={isLoading_}
              data-testid={`button-decline-${targetUser.id}`}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        );

      default:
        return (
          <Button 
            size={size}
            onClick={handleSendRequest}
            className={cn("hover-lift", className)}
            disabled={isLoading_}
            data-testid={`friend-button-${targetUser.id}`}
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Add Friend
          </Button>
        );
    }
  };

  return (
    <>
      {getButtonContent()}

      {/* Remove friend confirmation dialog */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent className="bg-gray-900 border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Remove Friend</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Are you sure you want to remove <span className="font-medium text-white">{targetUser.username}</span> from your friends list? 
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