import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Ban, Search, User as UserIcon, Shield, Clock, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { User, UserModerationActionWithDetails } from '@shared/schema';

export default function UserModerationPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [moderationDialogOpen, setModerationDialogOpen] = useState(false);
  const [moderationType, setModerationType] = useState<'warn' | 'ban'>('warn');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [isPermanentBan, setIsPermanentBan] = useState(false);
  const [banDuration, setBanDuration] = useState(24);
  const [userHistoryDialogOpen, setUserHistoryDialogOpen] = useState(false);

  const { data: usersData, isLoading: usersLoading } = useQuery<{ users: User[] }>({
    queryKey: ['/api/users/with-distance', 'admin-search'],
    staleTime: 30000,
  });

  const { data: userHistory, isLoading: historyLoading } = useQuery<{ history: UserModerationActionWithDetails[] }>({
    queryKey: ['/api/admin/user', selectedUser?.id, 'moderation-history'],
    enabled: !!selectedUser?.id && userHistoryDialogOpen,
  });

  const warnUserMutation = useMutation({
    mutationFn: async (data: { userId: string; reason: string; notes?: string }) => {
      return await apiRequest('POST', '/api/admin/warn-user', data);
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'User warned successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/moderation-data'] });
      handleCloseDialog();
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to warn user',
        variant: 'destructive',
      });
    },
  });

  const banUserMutation = useMutation({
    mutationFn: async (data: { userId: string; reason: string; notes?: string; permanent: boolean; duration?: number }) => {
      return await apiRequest('POST', '/api/admin/ban-user', data);
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'User banned successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/moderation-data'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/banned-users'] });
      handleCloseDialog();
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to ban user',
        variant: 'destructive',
      });
    },
  });

  const handleCloseDialog = () => {
    setModerationDialogOpen(false);
    setSelectedUser(null);
    setReason('');
    setNotes('');
    setIsPermanentBan(false);
    setBanDuration(24);
  };

  const handleModerateUser = (user: User, type: 'warn' | 'ban') => {
    setSelectedUser(user);
    setModerationType(type);
    setModerationDialogOpen(true);
  };

  const handleSubmitModeration = () => {
    if (!selectedUser || !reason.trim()) return;

    const data = {
      userId: selectedUser.id,
      reason: reason.trim(),
      notes: notes.trim() || undefined,
    };

    if (moderationType === 'warn') {
      warnUserMutation.mutate(data);
    } else {
      banUserMutation.mutate({
        ...data,
        permanent: isPermanentBan,
        duration: isPermanentBan ? undefined : banDuration,
      });
    }
  };

  const handleViewHistory = (user: User) => {
    setSelectedUser(user);
    setUserHistoryDialogOpen(true);
  };

  const filteredUsers = usersData?.users.filter(user => 
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.displayName.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (usersLoading) {
    return (
      <div className="space-y-4" data-testid="user-moderation-loading">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-full max-w-md"></div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="user-moderation-panel">
      {/* Search Bar */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search users by username or display name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-user-search"
          />
        </div>
        <Badge variant="outline" className="text-sm">
          {filteredUsers.length} users
        </Badge>
      </div>

      {/* Users List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredUsers.map((user) => (
          <Card key={user.id} data-testid={`user-card-${user.id}`}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base flex items-center space-x-2">
                    <UserIcon className="w-4 h-4" />
                    <span>{user.displayName}</span>
                    {user.isBanned && (
                      <Badge variant="destructive" className="text-xs">
                        Banned
                      </Badge>
                    )}
                    {user.role === 'admin' && (
                      <Badge variant="default" className="text-xs">
                        Admin
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="flex items-center space-x-4 text-sm">
                    <span>@{user.username}</span>
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3 h-3" />
                      <span>Last seen: {formatDate(user.lastSeen || new Date())}</span>
                    </span>
                    {user.isOnline && (
                      <Badge variant="default" className="text-xs bg-green-500">
                        Online
                      </Badge>
                    )}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600 dark:text-gray-400">
                  <div>
                    <span className="font-medium">Location:</span> {user.location}
                  </div>
                  {user.age && (
                    <div>
                      <span className="font-medium">Age:</span> {user.age} years old
                    </div>
                  )}
                </div>
                
                {user.isBanned && user.banReason && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded">
                    <div className="text-sm">
                      <span className="font-medium text-red-700 dark:text-red-400">
                        Ban Reason:
                      </span>
                      <span className="ml-2 text-red-600 dark:text-red-300">
                        {user.banReason}
                      </span>
                    </div>
                    {user.bannedAt && (
                      <div className="text-xs text-red-500 mt-1">
                        Banned on {formatDate(user.bannedAt)}
                      </div>
                    )}
                  </div>
                )}
                
                <div className="flex justify-end space-x-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewHistory(user)}
                    data-testid={`button-history-${user.id}`}
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    History
                  </Button>
                  
                  {user.role !== 'admin' && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleModerateUser(user, 'warn')}
                        disabled={!!user.isBanned}
                        data-testid={`button-warn-${user.id}`}
                      >
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        Warn
                      </Button>
                      
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleModerateUser(user, 'ban')}
                        disabled={!!user.isBanned}
                        data-testid={`button-ban-${user.id}`}
                      >
                        <Ban className="w-4 h-4 mr-2" />
                        Ban
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Moderation Dialog */}
      <Dialog open={moderationDialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {moderationType === 'warn' ? 'Warn User' : 'Ban User'}
            </DialogTitle>
            <DialogDescription>
              {moderationType === 'warn' 
                ? 'Send a warning to this user about their behavior'
                : 'Restrict this user\'s access to the platform'
              }
            </DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                <div className="font-medium">{selectedUser.displayName}</div>
                <div className="text-sm text-gray-500">@{selectedUser.username}</div>
              </div>
              
              <div>
                <label className="text-sm font-medium block mb-2">
                  Reason *
                </label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="harassment">Harassment</SelectItem>
                    <SelectItem value="spam">Spam</SelectItem>
                    <SelectItem value="inappropriate_content">Inappropriate Content</SelectItem>
                    <SelectItem value="fake_profile">Fake Profile</SelectItem>
                    <SelectItem value="community_guidelines">Community Guidelines Violation</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium block mb-2">
                  Additional Notes
                </label>
                <Textarea
                  placeholder="Add additional context or details..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  data-testid="textarea-moderation-notes"
                />
              </div>
              
              {moderationType === 'ban' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">Permanent Ban</label>
                      <p className="text-xs text-gray-500">
                        User will be banned permanently
                      </p>
                    </div>
                    <Switch
                      checked={isPermanentBan}
                      onCheckedChange={setIsPermanentBan}
                      data-testid="switch-permanent-ban"
                    />
                  </div>
                  
                  {!isPermanentBan && (
                    <div>
                      <label className="text-sm font-medium block mb-2">
                        Duration (hours)
                      </label>
                      <Input
                        type="number"
                        min="1"
                        max="8760"
                        value={banDuration}
                        onChange={(e) => setBanDuration(parseInt(e.target.value) || 24)}
                        data-testid="input-ban-duration"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button
              variant={moderationType === 'ban' ? 'destructive' : 'default'}
              onClick={handleSubmitModeration}
              disabled={!reason.trim() || warnUserMutation.isPending || banUserMutation.isPending}
              data-testid="button-submit-moderation"
            >
              {(warnUserMutation.isPending || banUserMutation.isPending) 
                ? `${moderationType === 'warn' ? 'Warning' : 'Banning'}...` 
                : `${moderationType === 'warn' ? 'Warn' : 'Ban'} User`
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User History Dialog */}
      <Dialog open={userHistoryDialogOpen} onOpenChange={setUserHistoryDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Moderation History
            </DialogTitle>
            <DialogDescription>
              {selectedUser && `Action history for ${selectedUser.displayName}`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {historyLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                ))}
              </div>
            ) : userHistory?.history.length ? (
              userHistory.history.map((action) => (
                <div
                  key={action.id}
                  className="p-3 border rounded-lg space-y-2"
                  data-testid={`history-item-${action.id}`}
                >
                  <div className="flex items-center justify-between">
                    <Badge
                      variant={
                        action.actionType === 'ban' 
                          ? 'destructive' 
                          : action.actionType === 'warning' 
                          ? 'secondary' 
                          : 'default'
                      }
                      className="capitalize"
                    >
                      {action.actionType}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {formatDate(action.performedAt || new Date())}
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-medium">{action.reason}</div>
                    {action.notes && (
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {action.notes}
                      </div>
                    )}
                    <div className="text-xs text-gray-500 mt-1">
                      By {action.performedByUser.displayName}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 py-8">
                No moderation history found
              </p>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserHistoryDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}