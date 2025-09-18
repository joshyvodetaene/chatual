import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useResponsive } from '@/hooks/use-responsive';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';
import ModerationTools from '@/components/admin/moderation-tools';

interface AdminUser {
  id: string;
  username: string;
  isActive: boolean;
  createdAt: string;
  lastLogin: string | null;
}

export default function AdminModerationTools() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const { isMobile } = useResponsive();

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

  if (!adminUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className={cn(
          "text-white text-center",
          isMobile ? "text-sm" : "text-base"
        )}>Loading moderation tools...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className={cn(
        "container mx-auto",
        isMobile ? "p-4" : "p-6"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/admin/desk')}
              className="text-white hover:bg-slate-800"
              data-testid="button-back-to-desk"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className={cn(
                "font-bold text-white",
                isMobile ? "text-xl" : "text-2xl"
              )}>
                Advanced Moderation Tools
              </h1>
              <p className={cn(
                "text-slate-400",
                isMobile ? "text-xs" : "text-sm"
              )}>
                Comprehensive moderation system with action logging, behavior tracking, and automated cleanup
              </p>
            </div>
          </div>
        </div>

        {/* Moderation Tools Component */}
        <ModerationTools adminUser={adminUser} />
      </div>
    </div>
  );
}