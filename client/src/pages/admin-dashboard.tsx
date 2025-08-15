import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, Users, AlertTriangle, Ban, Activity, TrendingUp, UserCheck, Eye, Settings, X, Search } from 'lucide-react';
import type { AdminDashboardStats, ModerationData, User } from '@shared/schema';
import { BackButton } from '@/components/ui/back-button';

export default function AdminDashboard() {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserDetails, setShowUserDetails] = useState(false);

  const { data: statsData, isLoading: statsLoading } = useQuery<{ stats: AdminDashboardStats }>({
    queryKey: ['/api/admin/dashboard-stats'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: moderationData, isLoading: moderationLoading } = useQuery<ModerationData>({
    queryKey: ['/api/admin/moderation-data'],
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  const { data: usersData } = useQuery<{ users: User[] }>({
    queryKey: ['/api/admin/users'],
    refetchInterval: 30000,
  });

  const stats = statsData?.stats;

  if (statsLoading || moderationLoading) {
    return (
      <div className="min-h-screen bg-background sensual-gradient">
        <div className="container mx-auto p-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-white/10 rounded w-64"></div>
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-4 space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-48 bg-white/5 rounded-lg border border-primary/20"></div>
                ))}
              </div>
              <div className="col-span-5 space-y-4">
                <div className="h-64 bg-white/5 rounded-lg border border-primary/20"></div>
                <div className="grid grid-cols-4 gap-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-32 bg-white/5 rounded-lg border border-primary/20"></div>
                  ))}
                </div>
              </div>
              <div className="col-span-3">
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

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-gradient-to-br from-red-400 to-red-600',
      'bg-gradient-to-br from-pink-400 to-pink-600',
      'bg-gradient-to-br from-purple-400 to-purple-600',
      'bg-gradient-to-br from-orange-400 to-orange-600',
      'bg-gradient-to-br from-rose-400 to-rose-600',
      'bg-gradient-to-br from-fuchsia-400 to-fuchsia-600',
    ];
    const hash = name.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  return (
    <div className="min-h-screen bg-background sensual-gradient" data-testid="admin-dashboard">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <BackButton className="mr-2" />
            <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
              <Search className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
              <Settings className="w-4 h-4" />
            </Button>
            <div className="flex items-center space-x-1">
              <span className="text-sm text-gray-400">Admin</span>
              <div className="relative">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <Shield className="w-4 h-4 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full border-2 border-background"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-12 gap-6 mb-8">
          {/* Statistics Section - Left Column */}
          <div className="col-span-4 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Statistics</h2>
              
              {/* Sessions Chart */}
              <Card className="mb-4 bg-white/5 border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-white">Sessions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-32 flex items-end space-x-1">
                    {[12, 19, 3, 5, 2, 3, 8, 15, 9, 11, 4, 7].map((height, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-primary/60 rounded-sm"
                        style={{ height: `${height * 6}px` }}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Sessions Progress */}
              <Card className="mb-4 bg-white/5 border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-white">Sessions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-20 relative">
                    <svg className="w-full h-full">
                      <path
                        d="M 0 40 Q 50 20 100 30 T 200 35 T 300 25 T 400 30"
                        stroke="hsl(0, 84%, 60%)"
                        strokeWidth="2"
                        fill="none"
                        className="drop-shadow-sm"
                      />
                    </svg>
                  </div>
                </CardContent>
              </Card>

              {/* Suspicions */}
              <Card className="mb-4 bg-white/5 border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-white">Suspicions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {['User Activity', 'Login Attempts', 'Data Access', 'System Changes'].map((item, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">{item}</span>
                        <div className="w-16 h-1 bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${[60, 30, 80, 45][i]}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Additional Charts */}
              <Card className="mb-4 bg-white/5 border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-white">Contribute</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-16 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin"></div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/5 border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-white">Criteria</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="w-8 h-8 bg-primary/20 rounded border border-primary/30"></div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* User Management Section - Center Column */}
          <div className="col-span-5 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">User</h2>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-gray-400 hover:text-white"
                  onClick={() => setShowUserDetails(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* User Management Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-white">User Management</h3>
                <div className="flex items-center space-x-2">
                  <Button 
                    size="sm" 
                    className="bg-primary hover:bg-primary/90 text-white px-3 py-1 text-xs"
                  >
                    User Management
                  </Button>
                </div>
              </div>

              {/* User Grid */}
              <div className="grid grid-cols-4 gap-3 mb-6">
                {(usersData?.users || []).slice(0, 8).map((user, index) => (
                  <Card 
                    key={user.id}
                    className="bg-white/5 border-primary/20 cursor-pointer hover:bg-white/10 transition-colors"
                    onClick={() => {
                      setSelectedUser(user);
                      setShowUserDetails(true);
                    }}
                  >
                    <CardContent className="p-4 text-center">
                      <div className={`w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center text-white text-sm font-medium ${getAvatarColor(user.displayName)}`}>
                        {getInitials(user.displayName)}
                      </div>
                      <p className="text-xs text-white font-medium mb-1">{user.displayName}</p>
                      <Badge 
                        variant={index % 4 === 0 ? 'destructive' : 'secondary'} 
                        className="text-xs px-2 py-0"
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
          <div className="col-span-3 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Moderation</h2>
              
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
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <Button 
                      size="sm" 
                      className="bg-orange-500/20 border border-orange-500/30 text-orange-400 hover:bg-orange-500/30"
                    >
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Delete
                    </Button>
                    <Button 
                      size="sm" 
                      className="bg-primary/20 border border-primary/30 text-primary hover:bg-primary/30"
                    >
                      <Ban className="w-3 h-3 mr-1" />
                      Ban
                    </Button>
                    <Button 
                      size="sm" 
                      className="bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30"
                    >
                      <UserCheck className="w-3 h-3 mr-1" />
                      Own
                    </Button>
                    <Button 
                      size="sm" 
                      className="bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:bg-blue-500/30"
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      Sel
                    </Button>
                  </div>

                  {/* Stats */}
                  <div className="space-y-3">
                    {[
                      { label: 'Reports', count: stats?.totalReports || 0, color: 'text-red-400' },
                      { label: 'Warnings', count: stats?.totalWarnings || 0, color: 'text-orange-400' },
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

        {/* Membered Table Section - Bottom */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Membered</h2>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <Card className="bg-white/5 border-primary/20">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-primary/20">
                      <th className="text-left p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Username</th>
                      <th className="text-left p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Display Name</th>
                      <th className="text-left p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Gender</th>
                      <th className="text-left p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Location</th>
                      <th className="text-left p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Last</th>
                      <th className="text-left p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Reports</th>
                      <th className="text-left p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(usersData?.users || []).slice(0, 5).map((user, index) => (
                      <tr key={user.id} className="border-b border-primary/10 hover:bg-white/5">
                        <td className="p-4">
                          <div className="flex items-center space-x-3">
                            <input type="checkbox" className="w-3 h-3 rounded border-primary/30 bg-transparent" />
                            <span className="text-sm text-white">{user.username}</span>
                          </div>
                        </td>
                        <td className="p-4 text-sm text-gray-300">{user.displayName}</td>
                        <td className="p-4 text-sm text-gray-300">{user.gender || 'N/A'}</td>
                        <td className="p-4 text-sm text-gray-300">{user.location || 'N/A'}</td>
                        <td className="p-4 text-sm text-gray-300">2h</td>
                        <td className="p-4">
                          <Badge variant="secondary" className="text-xs">
                            {Math.floor(Math.random() * 10)}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center space-x-2">
                            <div className="w-16 h-2 bg-gray-700 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${Math.random() * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-400">0</span>
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