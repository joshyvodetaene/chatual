import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  UserX, 
  AlertTriangle, 
  Shield, 
  MessageSquare, 
  Ban, 
  UserCheck,
  Search,
  Filter,
  Clock,
  UserMinus
} from 'lucide-react';

interface User {
  id: string;
  username: string;
  displayName?: string;
  email?: string;
  isOnline: boolean;
  isBanned: boolean;
  bannedAt?: string;
  bannedBy?: string;
  banReason?: string;
  lastSeen: string;
  role: string;
  createdAt?: string;
}

interface AdminUser {
  id: string;
  username: string;
}

export default function AdminUserManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messageDialog, setMessageDialog] = useState(false);
  const [banDialog, setBanDialog] = useState(false);
  const [messageContent, setMessageContent] = useState('');
  const [banReason, setBanReason] = useState('');
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    const storedAdmin = localStorage.getItem('adminUser');
    if (storedAdmin) {
      setAdminUser(JSON.parse(storedAdmin));
    }
  }, []);

  const getAuthHeaders = () => ({
    'admin-id': adminUser?.id || '',
    'Content-Type': 'application/json'
  });

  // Queries for different user categories
  const { data: allUsers = [], isLoading: loadingAll } = useQuery({
    queryKey: ['admin', 'users', 'all'],
    queryFn: async () => {
      const response = await fetch('/api/admin/users/all', {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch all users');
      const data = await response.json();
      return data.users;
    },
    enabled: !!adminUser?.id
  });

  const { data: onlineUsers = [], isLoading: loadingOnline } = useQuery({
    queryKey: ['admin', 'users', 'online'],
    queryFn: async () => {
      const response = await fetch('/api/admin/users/online', {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch online users');
      const data = await response.json();
      return data.users;
    },
    enabled: !!adminUser?.id
  });

  const { data: bannedUsers = [], isLoading: loadingBanned } = useQuery({
    queryKey: ['admin', 'users', 'banned'],
    queryFn: async () => {
      const response = await fetch('/api/admin/users/banned', {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch banned users');
      const data = await response.json();
      return data.users;
    },
    enabled: !!adminUser?.id
  });

  const { data: blockedUsers = [], isLoading: loadingBlocked } = useQuery({
    queryKey: ['admin', 'users', 'blocked'],
    queryFn: async () => {
      const response = await fetch('/api/admin/users/blocked', {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch blocked users');
      const data = await response.json();
      return data.users;
    },
    enabled: !!adminUser?.id
  });

  const { data: reportedUsers = [], isLoading: loadingReported } = useQuery({
    queryKey: ['admin', 'users', 'reported'],
    queryFn: async () => {
      const response = await fetch('/api/admin/users/reported', {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch reported users');
      const data = await response.json();
      return data.users;
    },
    enabled: !!adminUser?.id
  });

  // Mutations for user actions
  const sendMessageMutation = useMutation({
    mutationFn: async ({ userId, message }: { userId: string; message: string }) => {
      const response = await fetch('/api/admin/send-message', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ userId, message })
      });
      if (!response.ok) throw new Error('Failed to send message');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Message sent successfully' });
      setMessageDialog(false);
      setMessageContent('');
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to send message', 
        description: error.message,
        variant: 'destructive' 
      });
    }
  });

  const banUserMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
      const response = await fetch(`/api/admin/users/${userId}/ban`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ reason })
      });
      if (!response.ok) throw new Error('Failed to ban user');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'User banned successfully' });
      setBanDialog(false);
      setBanReason('');
      setSelectedUser(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to ban user', 
        description: error.message,
        variant: 'destructive' 
      });
    }
  });

  const unbanUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/admin/users/${userId}/unban`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ reason: 'Unbanned by admin' })
      });
      if (!response.ok) throw new Error('Failed to unban user');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'User unbanned successfully' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to unban user', 
        description: error.message,
        variant: 'destructive' 
      });
    }
  });

  const filterUsers = (users: User[]) => {
    if (!searchQuery) return users;
    return users.filter(user => 
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.displayName && user.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getUserStatus = (user: User) => {
    if (user.isBanned) return { text: 'Banned', color: 'bg-red-500' };
    if (user.isOnline) return { text: 'Online', color: 'bg-green-500' };
    return { text: 'Offline', color: 'bg-gray-500' };
  };

  const UserCard = ({ user, showActions = true }: { user: User; showActions?: boolean }) => {
    const status = getUserStatus(user);
    
    return (
      <Card className="mb-4" data-testid={`user-card-${user.id}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <CardTitle className="text-lg" data-testid={`user-username-${user.id}`}>
                  {user.username}
                </CardTitle>
                {user.displayName && (
                  <CardDescription data-testid={`user-displayname-${user.id}`}>
                    {user.displayName}
                  </CardDescription>
                )}
              </div>
              <Badge className={`${status.color} text-white`} data-testid={`user-status-${user.id}`}>
                {status.text}
              </Badge>
            </div>
            
            {showActions && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedUser(user);
                    setMessageDialog(true);
                  }}
                  data-testid={`button-message-${user.id}`}
                >
                  <MessageSquare className="w-4 h-4 mr-1" />
                  Message
                </Button>
                
                {user.isBanned ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => unbanUserMutation.mutate(user.id)}
                    disabled={unbanUserMutation.isPending}
                    data-testid={`button-unban-${user.id}`}
                  >
                    <UserCheck className="w-4 h-4 mr-1" />
                    Unban
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setSelectedUser(user);
                      setBanDialog(true);
                    }}
                    data-testid={`button-ban-${user.id}`}
                  >
                    <Ban className="w-4 h-4 mr-1" />
                    Ban
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-500">User ID:</span>
              <span className="ml-2 font-mono text-xs" data-testid={`user-id-${user.id}`}>
                {user.id.slice(0, 8)}...
              </span>
            </div>
            <div>
              <span className="text-slate-500">Last Seen:</span>
              <span className="ml-2" data-testid={`user-lastseen-${user.id}`}>
                {formatDate(user.lastSeen)}
              </span>
            </div>
            {user.isBanned && user.banReason && (
              <div className="col-span-2">
                <span className="text-slate-500">Ban Reason:</span>
                <span className="ml-2 text-red-600" data-testid={`user-banreason-${user.id}`}>
                  {user.banReason}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const tabData = [
    { id: 'all', label: 'All Users', icon: Users, users: filterUsers(allUsers), loading: loadingAll },
    { id: 'online', label: 'Online', icon: Clock, users: filterUsers(onlineUsers), loading: loadingOnline },
    { id: 'banned', label: 'Banned', icon: UserX, users: filterUsers(bannedUsers), loading: loadingBanned },
    { id: 'blocked', label: 'Blocked', icon: UserMinus, users: filterUsers(blockedUsers), loading: loadingBlocked },
    { id: 'reported', label: 'Reported', icon: AlertTriangle, users: filterUsers(reportedUsers), loading: loadingReported }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="container mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="h-8 w-8 text-blue-400" />
            <h1 className="text-3xl font-bold text-white" data-testid="page-title">
              User Management
            </h1>
          </div>
          <p className="text-slate-400" data-testid="page-description">
            Manage users, view reports, and take administrative actions
          </p>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-slate-800 border-slate-700 text-white"
              data-testid="search-users"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-slate-800 border-slate-700">
            {tabData.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger 
                  key={tab.id} 
                  value={tab.id} 
                  className="data-[state=active]:bg-slate-700"
                  data-testid={`tab-${tab.id}`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {tab.label}
                  <Badge variant="secondary" className="ml-2">
                    {tab.users.length}
                  </Badge>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {tabData.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="space-y-4">
              {tab.loading ? (
                <div className="text-center py-8">
                  <div className="text-white">Loading {tab.label.toLowerCase()}...</div>
                </div>
              ) : tab.users.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-slate-400">No {tab.label.toLowerCase()} found</div>
                </div>
              ) : (
                <div className="grid gap-4" data-testid={`users-list-${tab.id}`}>
                  {tab.users.map((user) => (
                    <UserCard key={user.id} user={user} />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>

        {/* Message Dialog */}
        <Dialog open={messageDialog} onOpenChange={setMessageDialog}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white">
            <DialogHeader>
              <DialogTitle data-testid="dialog-message-title">
                Send Message to {selectedUser?.username}
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                Send a direct administrative message to this user
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="message" className="text-slate-300">Message</Label>
                <Textarea
                  id="message"
                  placeholder="Enter your message..."
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white"
                  rows={4}
                  data-testid="input-message-content"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setMessageDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedUser && messageContent.trim()) {
                    sendMessageMutation.mutate({
                      userId: selectedUser.id,
                      message: messageContent.trim()
                    });
                  }
                }}
                disabled={!messageContent.trim() || sendMessageMutation.isPending}
                data-testid="button-send-message"
              >
                {sendMessageMutation.isPending ? 'Sending...' : 'Send Message'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Ban Dialog */}
        <Dialog open={banDialog} onOpenChange={setBanDialog}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white">
            <DialogHeader>
              <DialogTitle className="text-red-400" data-testid="dialog-ban-title">
                Ban User: {selectedUser?.username}
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                This action will prevent the user from accessing the application
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="banReason" className="text-slate-300">Ban Reason</Label>
                <Textarea
                  id="banReason"
                  placeholder="Enter reason for ban..."
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white"
                  rows={3}
                  data-testid="input-ban-reason"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setBanDialog(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (selectedUser) {
                    banUserMutation.mutate({
                      userId: selectedUser.id,
                      reason: banReason.trim() || 'Banned by admin'
                    });
                  }
                }}
                disabled={banUserMutation.isPending}
                data-testid="button-confirm-ban"
              >
                {banUserMutation.isPending ? 'Banning...' : 'Ban User'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}