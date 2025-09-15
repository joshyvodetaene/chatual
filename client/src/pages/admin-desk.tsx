import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { 
  Shield, 
  Users, 
  MessageSquare, 
  Settings, 
  LogOut, 
  Database,
  AlertTriangle,
  Activity
} from 'lucide-react';

interface AdminUser {
  id: string;
  username: string;
  isActive: boolean;
  createdAt: string;
  lastLogin: string | null;
}

export default function AdminDesk() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    // Check if admin is logged in
    const storedAdmin = localStorage.getItem('adminUser');
    if (!storedAdmin) {
      setLocation('/admin');
      return;
    }

    try {
      const admin = JSON.parse(storedAdmin);
      setAdminUser(admin);
    } catch (error) {
      console.error('Error parsing admin user:', error);
      setLocation('/admin');
    }
  }, [setLocation]);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Logout failed');
      }
      
      return response.json();
    },
    onSuccess: () => {
      localStorage.removeItem('adminUser');
      toast({
        title: 'Logged out',
        description: 'Admin session ended successfully',
      });
      setLocation('/admin');
    },
    onError: (error: any) => {
      console.error('Logout error:', error);
      // Force logout on error
      localStorage.removeItem('adminUser');
      setLocation('/admin');
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  if (!adminUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">Loading admin dashboard...</div>
      </div>
    );
  }

  const adminCards = [
    {
      title: 'User Management',
      description: 'Manage user accounts, roles, and permissions',
      icon: Users,
      color: 'bg-blue-500',
      action: () => setLocation('/admin/users'),
      testId: 'card-user-management'
    },
    {
      title: 'Message Monitoring',
      description: 'Monitor chat rooms and message content',
      icon: MessageSquare,
      color: 'bg-green-500',
      action: () => toast({ title: 'Feature coming soon', description: 'Message monitoring panel' }),
      testId: 'card-message-monitoring'
    },
    {
      title: 'System Settings',
      description: 'Configure application settings and features',
      icon: Settings,
      color: 'bg-purple-500',
      action: () => toast({ title: 'Feature coming soon', description: 'System settings panel' }),
      testId: 'card-system-settings'
    },
    {
      title: 'Database Management',
      description: 'Database operations and maintenance',
      icon: Database,
      color: 'bg-orange-500',
      action: () => toast({ title: 'Feature coming soon', description: 'Database management panel' }),
      testId: 'card-database-management'
    },
    {
      title: 'Security Alerts',
      description: 'View security incidents and alerts',
      icon: AlertTriangle,
      color: 'bg-red-500',
      action: () => toast({ title: 'Feature coming soon', description: 'Security alerts panel' }),
      testId: 'card-security-alerts'
    },
    {
      title: 'System Health',
      description: 'Monitor application performance and health',
      icon: Activity,
      color: 'bg-teal-500',
      action: () => toast({ title: 'Feature coming soon', description: 'System health panel' }),
      testId: 'card-system-health'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Header */}
      <div className="border-b border-slate-700 bg-slate-800/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white" data-testid="text-admin-title">
                  Admin Dashboard
                </h1>
                <p className="text-sm text-slate-400" data-testid="text-admin-subtitle">
                  Logged in as {adminUser.username}
                </p>
              </div>
            </div>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
              disabled={logoutMutation.isPending}
              data-testid="button-admin-logout"
            >
              <LogOut className="w-4 h-4 mr-2" />
              {logoutMutation.isPending ? 'Logging out...' : 'Logout'}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-2" data-testid="text-dashboard-title">
            Administrative Tools
          </h2>
          <p className="text-slate-400" data-testid="text-dashboard-description">
            Manage and monitor the chat application system
          </p>
        </div>

        {/* Admin Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {adminCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <Card
                key={index}
                className="bg-slate-800 border-slate-700 hover:bg-slate-750 transition-colors cursor-pointer"
                onClick={card.action}
                data-testid={card.testId}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className={`${card.color} p-2 rounded-lg`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-white text-lg">
                        {card.title}
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-slate-400">
                    {card.description}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Admin Info */}
        <div className="mt-12">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Admin Session Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-400">Admin ID:</span>
                  <span className="text-white ml-2 font-mono" data-testid="text-admin-id">
                    {adminUser.id}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Status:</span>
                  <span className="text-green-400 ml-2" data-testid="text-admin-status">
                    {adminUser.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Account Created:</span>
                  <span className="text-white ml-2" data-testid="text-admin-created">
                    {new Date(adminUser.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Last Login:</span>
                  <span className="text-white ml-2" data-testid="text-admin-last-login">
                    {adminUser.lastLogin 
                      ? new Date(adminUser.lastLogin).toLocaleString()
                      : 'Never'
                    }
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}