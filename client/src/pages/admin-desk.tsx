import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useResponsive } from '@/hooks/use-responsive';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { 
  Shield, 
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
  const { isMobile, isTablet } = useResponsive();

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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className={cn(
          "text-white text-center",
          isMobile ? "text-sm" : "text-base"
        )}>Loading admin dashboard...</div>
      </div>
    );
  }

  const adminCards = [
    {
      title: 'Chatroom Management',
      description: 'Create and manage public chatrooms',
      icon: MessageSquare,
      color: 'bg-green-500',
      action: () => setLocation('/admin/chatrooms'),
      testId: 'card-chatroom-management'
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
      action: () => setLocation('/admin/database'),
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
        <div className={cn(
          "container mx-auto",
          isMobile ? "px-3 py-3" : "px-4 py-4"
        )}>
          <div className={cn(
            "flex items-center justify-between",
            isMobile ? "flex-col gap-3" : "flex-row gap-4"
          )}>
            <div className={cn(
              "flex items-center",
              isMobile ? "gap-2" : "gap-3"
            )}>
              <div className={cn(
                "bg-blue-600 rounded-lg",
                isMobile ? "p-1.5" : "p-2"
              )}>
                <Shield className={cn(
                  "text-white",
                  isMobile ? "h-5 w-5" : "h-6 w-6"
                )} />
              </div>
              <div>
                <h1 className={cn(
                  "font-bold text-white",
                  isMobile ? "text-lg" : "text-xl"
                )} data-testid="text-admin-title">
                  Admin Dashboard
                </h1>
                <p className={cn(
                  "text-slate-400",
                  isMobile ? "text-xs" : "text-sm"
                )} data-testid="text-admin-subtitle">
                  Logged in as {adminUser.username}
                </p>
              </div>
            </div>
            <Button
              onClick={handleLogout}
              variant="outline"
              size={isMobile ? "sm" : "default"}
              className={cn(
                "border-slate-600 text-slate-300 hover:bg-slate-700",
                isMobile && "w-full"
              )}
              disabled={logoutMutation.isPending}
              data-testid="button-admin-logout"
            >
              <LogOut className={cn(
                "mr-2",
                isMobile ? "w-3 h-3" : "w-4 h-4"
              )} />
              {logoutMutation.isPending ? 'Logging out...' : 'Logout'}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={cn(
        "container mx-auto",
        isMobile ? "px-3 py-6" : "px-4 py-8"
      )}>
        <div className={cn(
          isMobile ? "mb-6" : "mb-8"
        )}>
          <h2 className={cn(
            "font-bold text-white mb-2",
            isMobile ? "text-xl" : "text-2xl"
          )} data-testid="text-dashboard-title">
            Administrative Tools
          </h2>
          <p className={cn(
            "text-slate-400",
            isMobile ? "text-sm" : "text-base"
          )} data-testid="text-dashboard-description">
            Manage and monitor the chat application system
          </p>
        </div>

        {/* Admin Cards Grid */}
        <div className={cn(
          "grid gap-4",
          isMobile ? "grid-cols-1" : isTablet ? "grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
          isMobile ? "gap-4" : "gap-6"
        )}>
          {adminCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <Card
                key={index}
                className="bg-slate-800 border-slate-700 hover:bg-slate-750 transition-colors cursor-pointer"
                onClick={card.action}
                data-testid={card.testId}
              >
                <CardHeader className={cn(
                  isMobile ? "pb-3" : "pb-4"
                )}>
                  <div className={cn(
                    "flex items-center",
                    isMobile ? "gap-2" : "gap-3"
                  )}>
                    <div className={cn(
                      `${card.color} rounded-lg`,
                      isMobile ? "p-1.5" : "p-2"
                    )}>
                      <Icon className={cn(
                        "text-white",
                        isMobile ? "h-4 w-4" : "h-5 w-5"
                      )} />
                    </div>
                    <div>
                      <CardTitle className={cn(
                        "text-white",
                        isMobile ? "text-base" : "text-lg"
                      )}>
                        {card.title}
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className={cn(
                  isMobile ? "pt-0" : "pt-0"
                )}>
                  <CardDescription className={cn(
                    "text-slate-400",
                    isMobile ? "text-sm" : "text-base"
                  )}>
                    {card.description}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Admin Info */}
        <div className={cn(
          isMobile ? "mt-8" : "mt-12"
        )}>
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className={cn(
                "text-white flex items-center",
                isMobile ? "gap-1.5 text-base" : "gap-2 text-lg"
              )}>
                <Shield className={cn(
                  isMobile ? "h-4 w-4" : "h-5 w-5"
                )} />
                Admin Session Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className={cn(
                "grid gap-4",
                isMobile ? "grid-cols-1 text-sm" : "grid-cols-1 md:grid-cols-2 text-sm"
              )}>
                <div className={cn(
                  "flex",
                  isMobile ? "flex-col space-y-1" : "items-center justify-between md:block"
                )}>
                  <span className="text-slate-400">Admin ID:</span>
                  <span className={cn(
                    "text-white font-mono break-all",
                    isMobile ? "text-xs" : "ml-2 text-sm"
                  )} data-testid="text-admin-id">
                    {isMobile ? adminUser.id.slice(0, 16) + '...' : adminUser.id}
                  </span>
                </div>
                <div className={cn(
                  "flex",
                  isMobile ? "flex-col space-y-1" : "items-center justify-between md:block"
                )}>
                  <span className="text-slate-400">Status:</span>
                  <span className={cn(
                    "text-green-400",
                    isMobile ? "" : "ml-2"
                  )} data-testid="text-admin-status">
                    {adminUser.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className={cn(
                  "flex",
                  isMobile ? "flex-col space-y-1" : "items-center justify-between md:block"
                )}>
                  <span className="text-slate-400">Account Created:</span>
                  <span className={cn(
                    "text-white",
                    isMobile ? "" : "ml-2"
                  )} data-testid="text-admin-created">
                    {new Date(adminUser.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className={cn(
                  "flex",
                  isMobile ? "flex-col space-y-1" : "items-center justify-between md:block"
                )}>
                  <span className="text-slate-400">Last Login:</span>
                  <span className={cn(
                    "text-white",
                    isMobile ? "" : "ml-2"
                  )} data-testid="text-admin-last-login">
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