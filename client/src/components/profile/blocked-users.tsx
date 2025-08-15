import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Shield, UserX, Plus, Trash2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { BlockedUserWithDetails } from '@shared/schema';

interface BlockedUsersProps {
  userId: string;
  blockedUsers: BlockedUserWithDetails[];
}

export default function BlockedUsers({ userId, blockedUsers }: BlockedUsersProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [blockUsername, setBlockUsername] = useState('');
  const [blockReason, setBlockReason] = useState('');

  const blockUserMutation = useMutation({
    mutationFn: async ({ blockedId, reason }: { blockedId: string; reason?: string }) => {
      return await apiRequest(`/api/users/${userId}/blocked-users`, {
        method: 'POST',
        body: { blockedId, reason },
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User blocked successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}/profile-settings`] });
      setBlockDialogOpen(false);
      setBlockUsername('');
      setBlockReason('');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to block user",
        variant: "destructive",
      });
    },
  });

  const unblockUserMutation = useMutation({
    mutationFn: async (blockedId: string) => {
      return await apiRequest(`/api/users/${userId}/blocked-users/${blockedId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User unblocked successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}/profile-settings`] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to unblock user",
        variant: "destructive",
      });
    },
  });

  const handleBlockUser = async () => {
    if (!blockUsername.trim()) {
      toast({
        title: "Error",
        description: "Please enter a username",
        variant: "destructive",
      });
      return;
    }

    // For now, we'll use the username as the ID. In a real app, you'd look up the user first.
    blockUserMutation.mutate({
      blockedId: blockUsername.trim(),
      reason: blockReason.trim() || undefined,
    });
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6" data-testid="blocked-users">
      {/* Add Block User Button */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Blocked Users</h3>
          <p className="text-sm text-gray-500">
            {blockedUsers.length} user{blockedUsers.length !== 1 ? 's' : ''} blocked
          </p>
        </div>
        
        <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-block-user">
              <Plus className="w-4 h-4 mr-2" />
              Block User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Block User</DialogTitle>
              <DialogDescription>
                Block a user to prevent them from contacting you. You can unblock them later.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="block-username">Username</Label>
                <Input
                  id="block-username"
                  placeholder="Enter username to block"
                  value={blockUsername}
                  onChange={(e) => setBlockUsername(e.target.value)}
                  data-testid="input-block-username"
                />
              </div>
              <div>
                <Label htmlFor="block-reason">Reason (Optional)</Label>
                <Textarea
                  id="block-reason"
                  placeholder="Why are you blocking this user?"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  data-testid="input-block-reason"
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setBlockDialogOpen(false)}
                data-testid="button-cancel-block"
              >
                Cancel
              </Button>
              <Button
                onClick={handleBlockUser}
                disabled={blockUserMutation.isPending}
                data-testid="button-confirm-block"
              >
                {blockUserMutation.isPending ? 'Blocking...' : 'Block User'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Blocked Users List */}
      {blockedUsers.length > 0 ? (
        <div className="space-y-4">
          {blockedUsers.map((blockedUser) => (
            <Card key={blockedUser.id} data-testid={`blocked-user-${blockedUser.id}`}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                      <UserX className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <h4 className="font-medium" data-testid={`blocked-username-${blockedUser.id}`}>
                        {blockedUser.blockedUser.displayName}
                      </h4>
                      <p className="text-sm text-gray-500">
                        @{blockedUser.blockedUser.username}
                      </p>
                      <p className="text-xs text-gray-400">
                        Blocked {formatDate(blockedUser.blockedAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    {blockedUser.reason && (
                      <Badge variant="secondary" className="max-w-32 truncate">
                        {blockedUser.reason}
                      </Badge>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => unblockUserMutation.mutate(blockedUser.blockedId)}
                      disabled={unblockUserMutation.isPending}
                      data-testid={`button-unblock-${blockedUser.id}`}
                    >
                      Unblock
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8" data-testid="no-blocked-users">
              <Shield className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No blocked users</h3>
              <p className="text-gray-500 mb-6">
                You haven't blocked anyone yet. Use the block feature to prevent unwanted contact.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}