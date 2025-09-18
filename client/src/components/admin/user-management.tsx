import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useResponsive } from '@/hooks/use-responsive';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Users, 
  UserX, 
  Ban,
  Unlock,
  MessageSquare,
  Trash2,
  Shield,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  Flag,
  Eye,
  Search
} from 'lucide-react';
import type { User, ReportWithDetails } from '@shared/schema';

// Form schemas
const blockUserSchema = z.object({
  reason: z.string().min(1, "Reason is required").max(500, "Reason must be less than 500 characters"),
  duration: z.number().min(1, "Duration must be at least 1 hour").max(8760, "Duration cannot exceed 1 year").optional(),
  roomSpecific: z.boolean().default(false),
  roomId: z.string().optional()
});

const banUserSchema = z.object({
  reason: z.string().min(1, "Reason is required").max(500, "Reason must be less than 500 characters")
});

const messageUserSchema = z.object({
  message: z.string().min(1, "Message is required").max(1000, "Message must be less than 1000 characters"),
  type: z.string().default("admin_message")
});

const deleteUserSchema = z.object({
  reason: z.string().min(1, "Reason is required").max(500, "Reason must be less than 500 characters"),
  confirmDelete: z.boolean().refine((val) => val === true, "You must confirm user deletion")
});

type BlockUserForm = z.infer<typeof blockUserSchema>;
type BanUserForm = z.infer<typeof banUserSchema>;
type MessageUserForm = z.infer<typeof messageUserSchema>;
type DeleteUserForm = z.infer<typeof deleteUserSchema>;

export default function UserManagement() {
  const { toast } = useToast();
  const { isMobile, isTablet } = useResponsive();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'online' | 'banned' | 'blocked'>('all');
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'block' | 'ban' | 'message' | 'delete' | 'unblock' | 'unban' | null>(null);

  // Form hooks
  const blockForm = useForm<BlockUserForm>({
    resolver: zodResolver(blockUserSchema),
    defaultValues: {
      reason: '',
      duration: undefined,
      roomSpecific: false,
      roomId: ''
    }
  });

  const banForm = useForm<BanUserForm>({
    resolver: zodResolver(banUserSchema),
    defaultValues: {
      reason: ''
    }
  });

  const messageForm = useForm<MessageUserForm>({
    resolver: zodResolver(messageUserSchema),
    defaultValues: {
      message: '',
      type: 'admin_message'
    }
  });

  const deleteForm = useForm<DeleteUserForm>({
    resolver: zodResolver(deleteUserSchema),
    defaultValues: {
      reason: '',
      confirmDelete: false
    }
  });

  // Data queries
  const { data: usersData, isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ['/api/admin/users', filterType],
    queryFn: () => {
      const endpoint = filterType === 'all' ? '/api/admin/users/all' :
                     filterType === 'online' ? '/api/admin/users/online' :
                     filterType === 'banned' ? '/api/admin/users/banned' :
                     '/api/admin/users/blocked';
      return fetch(endpoint).then(res => res.json());
    }
  });

  const { data: reportsData, isLoading: reportsLoading, refetch: refetchReports } = useQuery({
    queryKey: ['/api/admin/reports']
  });

  // Mutations
  const blockUserMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: BlockUserForm }) => {
      const response = await fetch(`/api/admin/users/${userId}/block-scheduled`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to block user');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'User blocked', description: 'User has been blocked successfully' });
      refetchUsers();
      setIsActionDialogOpen(false);
      blockForm.reset();
    }
  });

  const unblockUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/admin/users/${userId}/unblock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to unblock user');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'User unblocked', description: 'User has been unblocked successfully' });
      refetchUsers();
    }
  });

  const banUserMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: BanUserForm }) => {
      const response = await fetch(`/api/admin/users/${userId}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to ban user');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'User banned', description: 'User has been banned successfully' });
      refetchUsers();
      setIsActionDialogOpen(false);
      banForm.reset();
    }
  });

  const unbanUserMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
      const response = await fetch(`/api/admin/users/${userId}/unban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) throw new Error('Failed to unban user');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'User unbanned', description: 'User has been unbanned successfully' });
      refetchUsers();
    }
  });

  const messageUserMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: MessageUserForm }) => {
      const response = await fetch(`/api/admin/users/${userId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to send message');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Message sent', description: 'Message has been sent to user' });
      setIsActionDialogOpen(false);
      messageForm.reset();
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: DeleteUserForm }) => {
      const response = await fetch(`/api/admin/users/${userId}/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: data.reason }),
      });
      if (!response.ok) throw new Error('Failed to delete user');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'User deleted', description: 'User account has been permanently deleted' });
      refetchUsers();
      setIsActionDialogOpen(false);
      deleteForm.reset();
    }
  });

  const updateReportStatusMutation = useMutation({
    mutationFn: async ({ reportId, status, resolution }: { reportId: string; status: string; resolution?: string }) => {
      const response = await fetch(`/api/admin/reports/${reportId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, resolution }),
      });
      if (!response.ok) throw new Error('Failed to update report');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Report updated', description: 'Report status has been updated' });
      refetchReports();
    }
  });

  // Helper functions
  const openActionDialog = (user: User, action: typeof actionType) => {
    setSelectedUser(user);
    setActionType(action);
    setIsActionDialogOpen(true);
  };

  const handleActionSubmit = () => {
    if (!selectedUser || !actionType) return;

    switch (actionType) {
      case 'block':
        blockForm.handleSubmit((data) => blockUserMutation.mutate({ userId: selectedUser.id, data }))();
        break;
      case 'ban':
        banForm.handleSubmit((data) => banUserMutation.mutate({ userId: selectedUser.id, data }))();
        break;
      case 'message':
        messageForm.handleSubmit((data) => messageUserMutation.mutate({ userId: selectedUser.id, data }))();
        break;
      case 'delete':
        deleteForm.handleSubmit((data) => deleteUserMutation.mutate({ userId: selectedUser.id, data }))();
        break;
      case 'unblock':
        unblockUserMutation.mutate(selectedUser.id);
        setIsActionDialogOpen(false);
        break;
      case 'unban':
        unbanUserMutation.mutate({ userId: selectedUser.id, reason: 'Unbanned by admin' });
        setIsActionDialogOpen(false);
        break;
    }
  };

  const filteredUsers = usersData?.users?.filter((user: User) =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const reports = (reportsData as any)?.reports || [];
  const pendingReports = reports.filter((report: ReportWithDetails) => report.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className={cn(
          "font-bold text-white mb-2",
          isMobile ? "text-xl" : "text-2xl"
        )} data-testid="text-user-management-title">
          User Management
        </h2>
        <p className={cn(
          "text-slate-400",
          isMobile ? "text-sm" : "text-base"
        )} data-testid="text-user-management-description">
          Manage users, handle reports, and perform administrative actions.
        </p>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="reports">Reports & Moderation</TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6">
          {/* Filters and Search */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn(
                "flex gap-4",
                isMobile ? "flex-col" : "flex-row items-end"
              )}>
                <div className="flex-1">
                  <label className="text-sm text-slate-400 mb-2 block">Search Users</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                    <Input
                      placeholder="Search by username or email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 bg-slate-700 border-slate-600 text-white"
                      data-testid="input-search-users"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-slate-400 mb-2 block">Filter by Status</label>
                  <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white" data-testid="select-user-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      <SelectItem value="online">Online Users</SelectItem>
                      <SelectItem value="banned">Banned Users</SelectItem>
                      <SelectItem value="blocked">Blocked Users</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => refetchUsers()}
                  variant="outline"
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                  data-testid="button-refresh-users"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Users List */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">
                Users ({filteredUsers.length})
              </CardTitle>
              <CardDescription className="text-slate-400">
                Click on a user to view options and perform actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
                  <span className="ml-2 text-slate-400">Loading users...</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredUsers.map((user: User) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg hover:bg-slate-900/70 transition-colors"
                      data-testid={`user-card-${user.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold",
                          user.isOnline ? "bg-green-600" : "bg-slate-600"
                        )}>
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">{user.username}</span>
                            {user.isBanned && <Badge variant="destructive">Banned</Badge>}
                            {user.isOnline && <Badge variant="default">Online</Badge>}
                          </div>
                          <p className="text-sm text-slate-400">User ID: {user.id.slice(0, 8)}...</p>
                          <p className="text-xs text-slate-500">
                            Status: {user.isOnline ? 'Online' : 'Offline'}
                          </p>
                        </div>
                      </div>
                      <div className={cn(
                        "flex gap-2",
                        isMobile ? "flex-col" : "flex-row"
                      )}>
                        {!user.isBanned ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openActionDialog(user, 'block')}
                              className="border-orange-600 text-orange-300 hover:bg-orange-600/20"
                              data-testid={`button-block-${user.id}`}
                            >
                              <UserX className="h-3 w-3 mr-1" />
                              Block
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openActionDialog(user, 'ban')}
                              className="border-red-600 text-red-300 hover:bg-red-600/20"
                              data-testid={`button-ban-${user.id}`}
                            >
                              <Ban className="h-3 w-3 mr-1" />
                              Ban
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openActionDialog(user, 'unban')}
                            className="border-green-600 text-green-300 hover:bg-green-600/20"
                            data-testid={`button-unban-${user.id}`}
                          >
                            <Unlock className="h-3 w-3 mr-1" />
                            Unban
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openActionDialog(user, 'message')}
                          className="border-blue-600 text-blue-300 hover:bg-blue-600/20"
                          data-testid={`button-message-${user.id}`}
                        >
                          <MessageSquare className="h-3 w-3 mr-1" />
                          Message
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openActionDialog(user, 'delete')}
                          className="border-red-600 text-red-300 hover:bg-red-600/20"
                          data-testid={`button-delete-${user.id}`}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                  {filteredUsers.length === 0 && (
                    <div className="text-center py-8 text-slate-400">
                      No users found matching your search criteria.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-6">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Flag className="h-5 w-5" />
                User Reports ({reports.length})
              </CardTitle>
              <CardDescription className="text-slate-400">
                Pending reports: {pendingReports.length}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reportsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
                  <span className="ml-2 text-slate-400">Loading reports...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {reports.map((report: ReportWithDetails) => (
                    <div
                      key={report.id}
                      className="p-4 bg-slate-900/50 rounded-lg border-l-4 border-l-orange-500"
                      data-testid={`report-card-${report.id}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={
                              report.status === 'pending' ? 'destructive' :
                              report.status === 'resolved' ? 'default' :
                              'secondary'
                            }>
                              {report.status}
                            </Badge>
                            <span className="text-sm text-slate-400 capitalize">{report.reason}</span>
                          </div>
                          <p className="text-white">
                            <span className="text-slate-300">Reporter:</span> {report.reporter.username} → 
                            <span className="text-slate-300"> Reported:</span> {report.reportedUser.username}
                          </p>
                          <p className="text-sm text-slate-400">
                            {report.reportedAt ? new Date(report.reportedAt).toLocaleString() : 'Unknown date'}
                          </p>
                        </div>
                      </div>
                      {report.description && (
                        <p className="text-slate-300 mb-3 text-sm bg-slate-800/50 p-2 rounded">
                          "{report.description}"
                        </p>
                      )}
                      <div className="flex gap-2 flex-wrap">
                        {report.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateReportStatusMutation.mutate({ 
                                reportId: report.id, 
                                status: 'resolved',
                                resolution: 'Action taken by admin'
                              })}
                              className="border-green-600 text-green-300 hover:bg-green-600/20"
                              data-testid={`button-resolve-${report.id}`}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Resolve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateReportStatusMutation.mutate({ 
                                reportId: report.id, 
                                status: 'dismissed',
                                resolution: 'No action required'
                              })}
                              className="border-slate-600 text-slate-300 hover:bg-slate-600/20"
                              data-testid={`button-dismiss-${report.id}`}
                            >
                              <UserX className="h-3 w-3 mr-1" />
                              Dismiss
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openActionDialog(report.reportedUser, 'ban')}
                              className="border-red-600 text-red-300 hover:bg-red-600/20"
                              data-testid={`button-ban-reported-${report.id}`}
                            >
                              <Ban className="h-3 w-3 mr-1" />
                              Ban User
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  {reports.length === 0 && (
                    <div className="text-center py-8 text-slate-400">
                      No reports found.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Dialog */}
      <Dialog open={isActionDialogOpen} onOpenChange={setIsActionDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'block' && 'Block User'}
              {actionType === 'unblock' && 'Unblock User'}
              {actionType === 'ban' && 'Ban User'}
              {actionType === 'unban' && 'Unban User'}
              {actionType === 'message' && 'Send Message to User'}
              {actionType === 'delete' && 'Delete User Account'}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {selectedUser && `Acting on user: ${selectedUser.username}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {actionType === 'block' && (
              <Form {...blockForm}>
                <form onSubmit={blockForm.handleSubmit((data) => blockUserMutation.mutate({ userId: selectedUser!.id, data }))} className="space-y-4">
                  <FormField
                    control={blockForm.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reason</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Enter reason for blocking..."
                            className="bg-slate-700 border-slate-600"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={blockForm.control}
                    name="duration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Duration (hours, optional)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            placeholder="Leave empty for permanent block"
                            className="bg-slate-700 border-slate-600"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsActionDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="bg-orange-600 hover:bg-orange-700" disabled={blockUserMutation.isPending}>
                      {blockUserMutation.isPending ? 'Blocking...' : 'Block User'}
                    </Button>
                  </div>
                </form>
              </Form>
            )}

            {actionType === 'ban' && (
              <Form {...banForm}>
                <form onSubmit={banForm.handleSubmit((data) => banUserMutation.mutate({ userId: selectedUser!.id, data }))} className="space-y-4">
                  <FormField
                    control={banForm.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reason</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Enter reason for banning..."
                            className="bg-slate-700 border-slate-600"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsActionDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" variant="destructive" disabled={banUserMutation.isPending}>
                      {banUserMutation.isPending ? 'Banning...' : 'Ban User'}
                    </Button>
                  </div>
                </form>
              </Form>
            )}

            {actionType === 'message' && (
              <Form {...messageForm}>
                <form onSubmit={messageForm.handleSubmit((data) => messageUserMutation.mutate({ userId: selectedUser!.id, data }))} className="space-y-4">
                  <FormField
                    control={messageForm.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Message</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Enter message to send to user..."
                            className="bg-slate-700 border-slate-600"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={messageForm.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Message Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-slate-700 border-slate-600">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="admin_message">Admin Message</SelectItem>
                            <SelectItem value="warning">Warning</SelectItem>
                            <SelectItem value="info">Information</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsActionDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={messageUserMutation.isPending}>
                      {messageUserMutation.isPending ? 'Sending...' : 'Send Message'}
                    </Button>
                  </div>
                </form>
              </Form>
            )}

            {actionType === 'delete' && (
              <Form {...deleteForm}>
                <form onSubmit={deleteForm.handleSubmit((data) => deleteUserMutation.mutate({ userId: selectedUser!.id, data }))} className="space-y-4">
                  <div className="bg-red-950/30 border border-red-800/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-red-400 mb-2">
                      <AlertCircle className="h-4 w-4" />
                      <span className="font-semibold">Warning: Permanent Action</span>
                    </div>
                    <p className="text-red-300 text-sm">
                      This will permanently delete the user's account and all associated data. This action cannot be undone.
                    </p>
                  </div>
                  <FormField
                    control={deleteForm.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reason</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Enter reason for deletion..."
                            className="bg-slate-700 border-slate-600"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={deleteForm.control}
                    name="confirmDelete"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={field.value}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            I understand this will permanently delete the user account
                          </FormLabel>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsActionDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" variant="destructive" disabled={deleteUserMutation.isPending}>
                      {deleteUserMutation.isPending ? 'Deleting...' : 'Delete User'}
                    </Button>
                  </div>
                </form>
              </Form>
            )}

            {(actionType === 'unblock' || actionType === 'unban') && (
              <div className="space-y-4">
                <p className="text-slate-300">
                  Are you sure you want to {actionType === 'unblock' ? 'unblock' : 'unban'} {selectedUser?.username}?
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsActionDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleActionSubmit}
                    className="bg-green-600 hover:bg-green-700"
                    disabled={actionType === 'unblock' ? unblockUserMutation.isPending : unbanUserMutation.isPending}
                  >
                    {actionType === 'unblock' ? 
                      (unblockUserMutation.isPending ? 'Unblocking...' : 'Unblock User') :
                      (unbanUserMutation.isPending ? 'Unbanning...' : 'Unban User')
                    }
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}