import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { Shield, LogOut, ArrowLeft } from 'lucide-react';
import UserManagement from '@/components/admin/user-management';
import { useResponsive } from '@/hooks/use-responsive';
import { cn } from '@/lib/utils';

interface AdminUser {
  id: string;
  username: string;
  isActive: boolean;
  createdAt: string;
  lastLogin: string | null;
}

export default function AdminUserManagementPage() {
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

  const handleBackToDashboard = () => {
    setLocation('/admin/admindesk');
  };

  if (!adminUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className={cn(
          "text-white text-center",
          isMobile ? "text-sm" : "text-base"
        )}>Loading admin panel...</div>
      </div>
    );
  }

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
              <Button
                variant="ghost"
                size={isMobile ? "sm" : "default"}
                onClick={handleBackToDashboard}
                className="text-slate-300 hover:text-white hover:bg-slate-700"
                data-testid="button-back-to-dashboard"
              >
                <ArrowLeft className={cn(
                  "mr-2",
                  isMobile ? "w-3 h-3" : "w-4 h-4"
                )} />
                Back
              </Button>
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
                  User Management
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
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className={cn(
            isMobile ? "p-4" : "p-6"
          )}>
            <UserManagement />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}