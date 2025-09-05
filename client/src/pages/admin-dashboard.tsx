import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Shield, Users, AlertTriangle, Ban, Activity, TrendingUp, UserCheck, Eye, Settings, X, Search, Hash, Trash2, Plus, UserX, UserPlus, UserCheck2 } from 'lucide-react';
import type { AdminDashboardStats, ModerationData, User, Room } from '@shared/schema';
import { BackButton } from '@/components/ui/back-button';
import { useResponsive } from '@/hooks/use-responsive';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function AdminDashboard() {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDescription, setNewRoomDescription] = useState('');
  const { isMobile, isTablet } = useResponsive();

  // Administrator user ID - this is the master admin account
  const adminUserId = '7a6dab62-7327-4f79-b025-952b687688c1';

  const { data: statsData, isLoading: statsLoading } = useQuery<{ stats: AdminDashboardStats }>({
    queryKey: ['/api/admin/dashboard-stats', adminUserId],
    refetchInterval: 30000, // Refresh every 30 seconds
    queryFn: async () => {
      const response = await fetch(`/api/admin/dashboard-stats?adminUserId=${adminUserId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard stats');
      }
      return response.json();
    },
  });

  const { data: moderationData, isLoading: moderationLoading } = useQuery<ModerationData>({
    queryKey: ['/api/admin/moderation-data', adminUserId],
    refetchInterval: 15000, // Refresh every 15 seconds
    queryFn: async () => {
      const response = await fetch(`/api/admin/moderation-data?adminUserId=${adminUserId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch moderation data');
      }
      return response.json();
    },
  });

  const { data: usersData } = useQuery<{ users: User[] }>({
    queryKey: ['/api/admin/users', adminUserId],
    refetchInterval: 30000,
    queryFn: async () => {
      const response = await fetch(`/api/admin/users?adminUserId=${adminUserId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      return response.json();
    },
  });

  const { data: roomsData } = useQuery<{ rooms: Room[] }>({
    queryKey: ['/api/admin/rooms', adminUserId],
    refetchInterval: 30000,
    queryFn: async () => {
      const response = await fetch(`/api/admin/rooms?adminUserId=${adminUserId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch rooms');
      }
      return response.json();
    },
  });

  const stats = statsData?.stats;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteRoomMutation = useMutation({
    mutationFn: async (roomId: string) => {
      const response = await fetch(`/api/admin/rooms/${roomId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ adminUserId }),
      });
      if (!response.ok) {
        throw new Error('Failed to delete room');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rooms'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard-stats'] });
      toast({
        title: 'Success',
        description: 'Room deleted successfully',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to delete room',
      });
    },
  });

  const handleDeleteRoom = (roomId: string, roomName: string) => {
    if (confirm(`Are you sure you want to delete the room "${roomName}"? This action cannot be undone and will delete all messages in the room.`)) {
      deleteRoomMutation.mutate(roomId);
    }
  };

  const createRoomMutation = useMutation({
    mutationFn: async (roomData: { name: string; description: string }) => {
      return apiRequest('POST', '/api/admin/rooms', {
        adminUserId,
        name: roomData.name,
        description: roomData.description,
        isPrivate: false
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rooms'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard-stats'] });
      setShowCreateRoom(false);
      setNewRoomName('');
      setNewRoomDescription('');
      toast({
        title: 'Success',
        description: 'Room created successfully',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to create room',
      });
    },
  });

  const blockUserMutation = useMutation({
    mutationFn: async (data: { userId: string; reason?: string }) => {
      return apiRequest('POST', '/api/admin/block-user', {
        adminUserId,
        userId: data.userId,
        reason: data.reason || 'Blocked by admin'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard-stats'] });
      toast({
        title: 'Success',
        description: 'User blocked successfully',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to block user',
      });
    },
  });

  const unblockUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest('POST', '/api/admin/unblock-user', {
        adminUserId,
        userId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard-stats'] });
      toast({
        title: 'Success',
        description: 'User unblocked successfully',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to unblock user',
      });
    },
  });

  const handleCreateRoom = () => {
    if (!newRoomName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Room name is required',
      });
      return;
    }
    createRoomMutation.mutate({
      name: newRoomName,
      description: newRoomDescription
    });
  };

  const handleBlockUser = (userId: string, username: string) => {
    if (confirm(`Are you sure you want to block user "${username}"? They will no longer be able to send messages.`)) {
      blockUserMutation.mutate({ userId });
    }
  };

  const handleUnblockUser = (userId: string, username: string) => {
    if (confirm(`Are you sure you want to unblock user "${username}"?`)) {
      unblockUserMutation.mutate(userId);
    }
  };

  const banUserMutation = useMutation({
    mutationFn: async (data: { userId: string; reason?: string }) => {
      return apiRequest('POST', '/api/admin/ban-user', {
        adminUserId,
        userId: data.userId,
        reason: data.reason || 'Banned by admin'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard-stats'] });
      toast({
        title: 'Success',
        description: 'User banned successfully',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to ban user',
      });
    },
  });

  const unbanUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest('POST', '/api/admin/unban-user', {
        adminUserId,
        userId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard-stats'] });
      toast({
        title: 'Success',
        description: 'User unbanned successfully',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to unban user',
      });
    },
  });

  const handleBanUser = (userId: string, username: string) => {
    if (confirm(`Are you sure you want to ban user "${username}"? They will be completely restricted from the platform.`)) {
      banUserMutation.mutate({ userId });
    }
  };

  const handleUnbanUser = (userId: string, username: string) => {
    if (confirm(`Are you sure you want to unban user "${username}"?`)) {
      unbanUserMutation.mutate(userId);
    }
  };

  if (statsLoading || moderationLoading) {
    return (
      <div className="min-h-screen bg-background sensual-gradient">
        <div className={cn(
          "container mx-auto",
          isMobile ? "p-4" : "p-6"
        )}>
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-white/10 rounded w-64"></div>
            <div className={cn(
              "grid gap-6",
              isMobile ? "grid-cols-1" : isTablet ? "grid-cols-1" : "grid-cols-12"
            )}>
              <div className={cn(
                "space-y-4",
                !isMobile && !isTablet && "col-span-4"
              )}>
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-48 bg-white/5 rounded-lg border border-primary/20"></div>
                ))}
              </div>
              <div className={cn(
                "space-y-4",
                !isMobile && !isTablet && "col-span-5"
              )}>
                <div className="h-64 bg-white/5 rounded-lg border border-primary/20"></div>
                <div className={cn(
                  "grid gap-4",
                  isMobile ? "grid-cols-2" : "grid-cols-4"
                )}>
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-32 bg-white/5 rounded-lg border border-primary/20"></div>
                  ))}
                </div>
              </div>
              <div className={cn(
                !isMobile && !isTablet && "col-span-3"
              )}>
                <div className="h-96 bg-white/5 rounded-lg border border-primary/20"></div>
              </div>
            </div>
            <div className="h-64 bg-white/5 rounded-lg border border-primary/20"></div>
          </div>
        </div>
      </div>
    );
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (name: string, gender?: string) => {
    // Use gender-based colors if gender is provided
    if (gender === 'female') {
      return 'bg-gradient-to-br from-red-400 to-red-600';
    }
    if (gender === 'male') {
      return 'bg-gradient-to-br from-blue-400 to-blue-600';
    }
    
    // Fallback to name-based colors for users without gender info
    const colors = [
      'bg-gradient-to-br from-green-400 to-green-600',
      'bg-gradient-to-br from-purple-400 to-purple-600',
      'bg-gradient-to-br from-orange-400 to-orange-600',
      'bg-gradient-to-br from-pink-400 to-pink-600',
      'bg-gradient-to-br from-indigo-400 to-indigo-600',
      'bg-gradient-to-br from-teal-400 to-teal-600',
    ];
    const hash = name.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  return (
    <div className="min-h-screen bg-background sensual-gradient overflow-x-hidden" data-testid="admin-dashboard">
      <div className="container mx-auto px-3 py-4 sm:p-4 md:p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 md:mb-8 gap-3 sm:gap-4">
          <div className="flex items-center space-x-2 sm:space-x-3 md:space-x-4">
            <BackButton className="mr-1 sm:mr-2 md:mr-3" />
            <div className="bg-primary rounded flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7">
              <Shield className="text-white w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" />
            </div>
            <h1 className="font-bold text-white text-lg sm:text-xl md:text-2xl lg:text-3xl">Admin Panel</h1>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-3 md:space-x-4">
            <div className="hidden sm:flex items-center space-x-2 sm:space-x-3">
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                <Search className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" />
              </Button>
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                <Settings className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" />
              </Button>
            </div>
            <div className={cn(
              "flex items-center",
              isMobile ? "space-x-1" : "space-x-1"
            )}>
              {!isMobile && <span className="text-sm text-gray-400">Admin</span>}
              <div className="relative">
                <div className={cn(
                  "bg-primary rounded-full flex items-center justify-center",
                  isMobile ? "w-7 h-7" : "w-8 h-8"
                )}>
                  <Shield className={cn(
                    "text-white",
                    isMobile ? "w-3 h-3" : "w-4 h-4"
                  )} />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full border-2 border-background"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Grid Layout */}
        <div className={cn(
          "grid gap-6",
          isMobile ? "grid-cols-1 mb-6" : isTablet ? "grid-cols-1 mb-8" : "grid-cols-12 mb-8"
        )}>
          {/* Statistics Section - Left Column */}
          <div className={cn(
            "space-y-6",
            !isMobile && !isTablet && "col-span-4"
          )}>
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Statistics</h2>
              
            </div>
          </div>

          {/* User Management Section - Center Column */}
          <div className={cn(
            "space-y-6",
            !isMobile && !isTablet && "col-span-5"
          )}>
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className={cn(
                  "font-semibold text-white",
                  isMobile ? "text-base" : "text-lg"
                )}>User</h2>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-gray-400 hover:text-white"
                  onClick={() => setShowUserDetails(false)}
                >
                  <X className={cn(
                    isMobile ? "w-3 h-3" : "w-4 h-4"
                  )} />
                </Button>
              </div>

              {/* User Management Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className={cn(
                  "font-medium text-white",
                  isMobile ? "text-xs" : "text-sm"
                )}>User Management</h3>
                <div className="flex items-center space-x-2">
                  <Button 
                    size="sm" 
                    className={cn(
                      "bg-primary hover:bg-primary/90 text-white",
                      isMobile ? "px-2 py-1 text-xs" : "px-3 py-1 text-xs"
                    )}
                  >
                    User Management
                  </Button>
                </div>
              </div>

              {/* User Grid */}
              <div className={cn(
                "grid gap-3 mb-6",
                isMobile ? "grid-cols-2" : isTablet ? "grid-cols-3" : "grid-cols-4"
              )}>
                {(usersData?.users || []).slice(0, 8).map((user, index) => (
                  <Card 
                    key={user.id}
                    className="bg-white/5 border-primary/20 cursor-pointer hover:bg-white/10 transition-colors"
                    onClick={() => {
                      setSelectedUser(user);
                      setShowUserDetails(true);
                    }}
                  >
                    <CardContent className={cn(
                      "text-center",
                      isMobile ? "p-3" : "p-4"
                    )}>
                      <div className={cn(
                        `rounded-full mx-auto mb-2 flex items-center justify-center text-white font-medium ${getAvatarColor(user.displayName, user.gender)}`,
                        isMobile ? "w-10 h-10 text-xs" : "w-12 h-12 text-sm"
                      )}>
                        {getInitials(user.displayName)}
                      </div>
                      <p className={cn(
                        "text-white font-medium mb-1",
                        isMobile ? "text-xs leading-tight" : "text-xs"
                      )}>{user.displayName}</p>
                      <Badge 
                        variant={index % 4 === 0 ? 'destructive' : 'secondary'} 
                        className={cn(
                          "px-2 py-0",
                          isMobile ? "text-xs" : "text-xs"
                        )}
                      >
                        {index % 4 === 0 ? 'Banned' : index % 3 === 0 ? 'Warning' : 'Active'}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>

          {/* Moderation Section - Right Column */}
          <div className={cn(
            "space-y-6",
            !isMobile && !isTablet && "col-span-3"
          )}>
            <div>
              <h2 className={cn(
                "font-semibold text-white mb-4",
                isMobile ? "text-base" : "text-lg"
              )}>Moderation</h2>
              
              <Card className="bg-white/5 border-primary/20">
                <CardContent className="p-6">
                  {/* Quick Actions */}
                  <div className="space-y-4 mb-6">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Customer</span>
                      <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div className="w-3/4 h-full bg-primary rounded-full"></div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className={cn(
                    "grid gap-3 mb-6",
                    isMobile ? "grid-cols-1" : "grid-cols-2"
                  )}>
                    <Button 
                      size="sm" 
                      className={cn(
                        "bg-orange-500/20 border border-orange-500/30 text-orange-400 hover:bg-orange-500/30",
                        isMobile && "w-full justify-start"
                      )}
                    >
                      <AlertTriangle className={cn(
                        isMobile ? "w-4 h-4 mr-2" : "w-3 h-3 mr-1"
                      )} />
                      Delete
                    </Button>
                    <Button 
                      size="sm" 
                      className={cn(
                        "bg-primary/20 border border-primary/30 text-primary hover:bg-primary/30",
                        isMobile && "w-full justify-start"
                      )}
                    >
                      <Ban className={cn(
                        isMobile ? "w-4 h-4 mr-2" : "w-3 h-3 mr-1"
                      )} />
                      Ban
                    </Button>
                    <Button 
                      size="sm" 
                      className={cn(
                        "bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30",
                        isMobile && "w-full justify-start"
                      )}
                    >
                      <UserCheck className={cn(
                        isMobile ? "w-4 h-4 mr-2" : "w-3 h-3 mr-1"
                      )} />
                      Own
                    </Button>
                    <Button 
                      size="sm" 
                      className={cn(
                        "bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:bg-blue-500/30",
                        isMobile && "w-full justify-start"
                      )}
                    >
                      <Eye className={cn(
                        isMobile ? "w-4 h-4 mr-2" : "w-3 h-3 mr-1"
                      )} />
                      Sel
                    </Button>
                  </div>

                  {/* Stats */}
                  <div className="space-y-3">
                    {[
                      { label: 'Reports', count: stats?.totalReports || 0, color: 'text-red-400' },
                      { label: 'Warnings', count: 0, color: 'text-orange-400' },
                      { label: 'Active Users', count: stats?.activeUsers || 0, color: 'text-green-400' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">{item.label}</span>
                        <span className={`text-sm font-medium ${item.color}`}>{item.count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Room Management Section */}
        <div className={cn(
          isMobile ? "mt-6" : "mt-8"
        )}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={cn(
              "font-semibold text-white flex items-center",
              isMobile ? "text-base" : "text-lg"
            )}>
              <Hash className="w-5 h-5 mr-2" />
              Chat Rooms
            </h2>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-400">
                {roomsData?.rooms?.length || 0} rooms
              </div>
              <Button 
                variant="default" 
                size="sm" 
                className="bg-primary/20 text-primary hover:bg-primary/30"
                onClick={() => setShowCreateRoom(!showCreateRoom)}
                data-testid="button-create-room"
              >
                <Plus className={cn(
                  isMobile ? "w-3 h-3" : "w-4 h-4"
                )} />
                {!isMobile && <span className="ml-1">Add Room</span>}
              </Button>
            </div>
          </div>

          {showCreateRoom && (
            <Card className="bg-white/5 border-primary/20 mb-4">
              <CardContent className="p-4">
                <h3 className="text-white font-medium mb-4">Create New Room</h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="room-name" className="text-gray-300">Room Name</Label>
                    <Input
                      id="room-name"
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                      placeholder="Enter room name"
                      className="bg-white/10 border-primary/30 text-white"
                      data-testid="input-room-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="room-description" className="text-gray-300">Description (Optional)</Label>
                    <Textarea
                      id="room-description"
                      value={newRoomDescription}
                      onChange={(e) => setNewRoomDescription(e.target.value)}
                      placeholder="Enter room description"
                      className="bg-white/10 border-primary/30 text-white"
                      data-testid="input-room-description"
                      rows={2}
                    />
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      onClick={handleCreateRoom}
                      disabled={createRoomMutation.isPending}
                      className="bg-primary/20 text-primary hover:bg-primary/30"
                      data-testid="button-submit-create-room"
                    >
                      {createRoomMutation.isPending ? 'Creating...' : 'Create Room'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowCreateRoom(false);
                        setNewRoomName('');
                        setNewRoomDescription('');
                      }}
                      className="border-primary/30 text-gray-300 hover:bg-white/5"
                      data-testid="button-cancel-create-room"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-white/5 border-primary/20 mb-6">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-primary/20">
                      <th className={cn(
                        "text-left font-medium text-gray-400 uppercase tracking-wider",
                        isMobile ? "p-2 text-xs" : "p-4 text-xs"
                      )}>Room Name</th>
                      {!isMobile && (
                        <>
                          <th className="text-left p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Description</th>
                          <th className="text-left p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Privacy</th>
                          <th className="text-left p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Created</th>
                        </>
                      )}
                      <th className={cn(
                        "text-right font-medium text-gray-400 uppercase tracking-wider",
                        isMobile ? "p-2 text-xs" : "p-4 text-xs"
                      )}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary/10">
                    {roomsData?.rooms?.map((room) => (
                      <tr key={room.id} className="hover:bg-white/5 transition-colors">
                        <td className={cn(isMobile ? "p-2" : "p-4")}>
                          <div className="flex items-center">
                            <div className={cn(
                              "bg-primary/20 rounded flex items-center justify-center mr-3",
                              isMobile ? "w-6 h-6" : "w-8 h-8"
                            )}>
                              <Hash className={cn(
                                "text-primary",
                                isMobile ? "w-3 h-3" : "w-4 h-4"
                              )} />
                            </div>
                            <div>
                              <div className={cn(
                                "font-medium text-white",
                                isMobile ? "text-sm" : "text-base"
                              )}>{room.name}</div>
                              {isMobile && room.description && (
                                <div className="text-xs text-gray-400 truncate max-w-32">
                                  {room.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        {!isMobile && (
                          <>
                            <td className="p-4">
                              <span className="text-sm text-gray-300">
                                {room.description || 'No description'}
                              </span>
                            </td>
                            <td className="p-4">
                              <Badge 
                                variant={room.isPrivate ? "secondary" : "default"}
                                className={room.isPrivate ? "bg-yellow-500/20 text-yellow-400" : "bg-green-500/20 text-green-400"}
                              >
                                {room.isPrivate ? 'Private' : 'Public'}
                              </Badge>
                            </td>
                            <td className="p-4">
                              <span className="text-sm text-gray-400">
                                {room.createdAt ? new Date(room.createdAt).toLocaleDateString() : 'Unknown'}
                              </span>
                            </td>
                          </>
                        )}
                        <td className={cn(
                          "text-right",
                          isMobile ? "p-2" : "p-4"
                        )}>
                          <Button
                            size="sm"
                            variant="ghost"
                            className={cn(
                              "text-red-400 hover:text-red-300 hover:bg-red-500/10",
                              isMobile && "p-1"
                            )}
                            onClick={() => handleDeleteRoom(room.id, room.name)}
                            disabled={deleteRoomMutation.isPending}
                            data-testid={`button-delete-room-${room.id}`}
                          >
                            <Trash2 className={cn(
                              isMobile ? "w-3 h-3" : "w-4 h-4"
                            )} />
                            {!isMobile && <span className="ml-1">Delete</span>}
                          </Button>
                        </td>
                      </tr>
                    )) ?? []}
                  </tbody>
                </table>
                {(!roomsData?.rooms || roomsData.rooms.length === 0) && (
                  <div className="text-center py-8 text-gray-400">
                    <Hash className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No chat rooms found</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Membered Table Section - Bottom */}
        <div className={cn(
          isMobile ? "mt-6" : "mt-8"
        )}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={cn(
              "font-semibold text-white",
              isMobile ? "text-base" : "text-lg"
            )}>Membered</h2>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-gray-400 hover:text-white"
            >
              <X className={cn(
                isMobile ? "w-3 h-3" : "w-4 h-4"
              )} />
            </Button>
          </div>

          <Card className="bg-white/5 border-primary/20">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-primary/20">
                      <th className={cn(
                        "text-left font-medium text-gray-400 uppercase tracking-wider",
                        isMobile ? "p-2 text-xs" : "p-4 text-xs"
                      )}>Username</th>
                      <th className={cn(
                        "text-left font-medium text-gray-400 uppercase tracking-wider",
                        isMobile ? "p-2 text-xs" : "p-4 text-xs"
                      )}>Display Name</th>
                      {!isMobile && (
                        <>
                          <th className="text-left p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Gender</th>
                          <th className="text-left p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Location</th>
                          <th className="text-left p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Last</th>
                        </>
                      )}
                      <th className={cn(
                        "text-left font-medium text-gray-400 uppercase tracking-wider",
                        isMobile ? "p-2 text-xs" : "p-4 text-xs"
                      )}>Status</th>
                      <th className={cn(
                        "text-left font-medium text-gray-400 uppercase tracking-wider",
                        isMobile ? "p-2 text-xs" : "p-4 text-xs"
                      )}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(usersData?.users || []).slice(0, 5).map((user, index) => (
                      <tr key={user.id} className="border-b border-primary/10 hover:bg-white/5">
                        <td className={cn(
                          isMobile ? "p-2" : "p-4"
                        )}>
                          <div className={cn(
                            "flex items-center",
                            isMobile ? "space-x-2" : "space-x-3"
                          )}>
                            <input type="checkbox" className={cn(
                              "rounded border-primary/30 bg-transparent",
                              isMobile ? "w-3 h-3" : "w-3 h-3"
                            )} />
                            <span className={cn(
                              "text-white",
                              isMobile ? "text-xs" : "text-sm"
                            )}>{user.username}</span>
                          </div>
                        </td>
                        <td className={cn(
                          "text-gray-300",
                          isMobile ? "p-2 text-xs" : "p-4 text-sm"
                        )}>{user.displayName}</td>
                        {!isMobile && (
                          <>
                            <td className="p-4 text-sm text-gray-300">{user.gender || 'N/A'}</td>
                            <td className="p-4 text-sm text-gray-300">{user.location || 'N/A'}</td>
                            <td className="p-4 text-sm text-gray-300">2h</td>
                          </>
                        )}
                        <td className={cn(
                          isMobile ? "p-2" : "p-4"
                        )}>
                          <div className="flex flex-col space-y-1">
                            {user.isBanned && (
                              <Badge variant="destructive" className="text-xs w-fit">
                                Banned
                              </Badge>
                            )}
                            {user.isOnline ? (
                              <Badge variant="default" className="text-xs w-fit bg-green-500/20 text-green-400">
                                Online
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs w-fit">
                                Offline
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className={cn(
                          isMobile ? "p-2" : "p-4"
                        )}>
                          <div className="flex items-center space-x-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 p-1"
                              onClick={() => {
                                setSelectedUser(user);
                                setShowUserDetails(true);
                              }}
                              data-testid={`button-view-user-${user.id}`}
                            >
                              <Eye className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-gray-400 hover:text-red-400 hover:bg-red-400/10 p-1"
                              onClick={() => handleBlockUser(user.id, user.username)}
                              disabled={blockUserMutation.isPending}
                              data-testid={`button-block-user-${user.id}`}
                            >
                              <UserX className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-gray-400 hover:text-green-400 hover:bg-green-400/10 p-1"
                              onClick={() => handleUnblockUser(user.id, user.username)}
                              disabled={unblockUserMutation.isPending}
                              data-testid={`button-unblock-user-${user.id}`}
                            >
                              <UserPlus className="w-3 h-3" />
                            </Button>
                            {user.isBanned ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-gray-400 hover:text-green-400 hover:bg-green-400/10 p-1"
                                onClick={() => handleUnbanUser(user.id, user.username)}
                                disabled={unbanUserMutation.isPending}
                                data-testid={`button-unban-user-${user.id}`}
                              >
                                <UserCheck2 className="w-3 h-3" />
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-gray-400 hover:text-red-400 hover:bg-red-400/10 p-1"
                                onClick={() => handleBanUser(user.id, user.username)}
                                disabled={banUserMutation.isPending}
                                data-testid={`button-ban-user-${user.id}`}
                              >
                                <Ban className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}