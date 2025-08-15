import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Ban, RotateCcw, Calendar, User as UserIcon, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { User } from '@shared/schema';

export default function BannedUsersPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [unbanDialogOpen, setUnbanDialogOpen] = useState(false);
  const [unbanReason, setUnbanReason] = useState('');

  const { data: bannedUsersData, isLoading } = useQuery<{ users: User[] }>({
    queryKey: ['/api/admin/banned-users'],
    refetchInterval: 30000,
  });

  const unbanUserMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
      return await apiRequest('POST', '/api/admin/unban-user', { userId, reason });
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'User unbanned successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/banned-users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/moderation-data'] });
      setUnbanDialogOpen(false);
      setSelectedUser(null);
      setUnbanReason('');
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to unban user',
        variant: 'destructive',
      });
    },
  });

  const handleUnbanUser = (user: User) => {
    setSelectedUser(user);
    setUnbanReason('');
    setUnbanDialogOpen(true);
  };

  const handleConfirmUnban = () => {
    if (!selectedUser) return;
    
    unbanUserMutation.mutate({
      userId: selectedUser.id,
      reason: unbanReason.trim() || 'Unbanned by admin',
    });
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'Unknown';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="banned-users-loading">
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  const bannedUsers = bannedUsersData?.users || [];

  if (bannedUsers.length === 0) {
    return (
      <div className="text-center py-12" data-testid="no-banned-users">
        <Ban className="w-16 h-16 mx-auto mb-4 text-gray-400" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No Banned Users
        </h3>
        <p className="text-gray-500">
          No users are currently banned from the platform
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="banned-users-panel">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Banned Users
          </h3>
          <p className="text-sm text-gray-500">
            {bannedUsers.length} user{bannedUsers.length !== 1 ? 's' : ''} currently banned
          </p>
        </div>
        <Badge variant="destructive" className="text-sm">
          {bannedUsers.length} banned
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {bannedUsers.map((user) => (
          <Card key={user.id} className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20" data-testid={`banned-user-card-${user.id}`}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base flex items-center space-x-2">
                    <UserIcon className="w-4 h-4" />
                    <span>{user.displayName}</span>
                    <Badge variant="destructive" className="text-xs">
                      Banned
                    </Badge>
                  </CardTitle>
                  <CardDescription className="flex items-center space-x-4 text-sm">
                    <span>@{user.username}</span>
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3 h-3" />
                      <span>Banned: {formatDate(user.bannedAt)}</span>
                    </span>
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Location:
                  </span>
                  <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                    {user.location}
                  </span>
                </div>

                {user.banReason && (
                  <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded">
                    <div className="flex items-start space-x-2">
                      <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-red-700 dark:text-red-400">
                          Ban Reason:
                        </div>
                        <div className="text-sm text-red-600 dark:text-red-300 mt-1">
                          {user.banReason}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2">
                  <div className="text-xs text-gray-500">
                    Last seen: {formatDate(user.lastSeen)}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUnbanUser(user)}
                    data-testid={`button-unban-${user.id}`}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Unban User
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Unban Confirmation Dialog */}
      <Dialog open={unbanDialogOpen} onOpenChange={(open) => !open && setUnbanDialogOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unban User</DialogTitle>
            <DialogDescription>
              Are you sure you want to unban this user? They will regain access to the platform.
            </DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                <div className="font-medium">{selectedUser.displayName}</div>
                <div className="text-sm text-gray-500">@{selectedUser.username}</div>
                {selectedUser.banReason && (
                  <div className="text-sm text-red-600 dark:text-red-400 mt-1">
                    Originally banned for: {selectedUser.banReason}
                  </div>
                )}
              </div>
              
              <div>
                <label className="text-sm font-medium block mb-2">
                  Reason for unbanning (optional)
                </label>
                <Textarea
                  placeholder="Explain why you're unbanning this user..."
                  value={unbanReason}
                  onChange={(e) => setUnbanReason(e.target.value)}
                  rows={3}
                  data-testid="textarea-unban-reason"
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUnbanDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleConfirmUnban}
              disabled={unbanUserMutation.isPending}
              data-testid="button-confirm-unban"
            >
              {unbanUserMutation.isPending ? 'Unbanning...' : 'Unban User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}