import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useResponsive } from '@/hooks/use-responsive';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { adminLoginSchema } from '@shared/schema';

type AdminLoginInput = {
  username: string;
  password: string;
};
import { LogIn, Shield } from 'lucide-react';

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showCredentials, setShowCredentials] = useState(false);
  const { isMobile, isTablet } = useResponsive();

  const form = useForm<AdminLoginInput>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: AdminLoginInput) => {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });
      
      if (!response.ok) {
        throw new Error('Invalid admin credentials');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      localStorage.setItem('adminUser', JSON.stringify(data.admin));
      toast({
        title: 'Login successful',
        description: `Welcome, ${data.admin.username}`,
      });
      setLocation('/admin/admindesk');
    },
    onError: (error: any) => {
      toast({
        title: 'Login failed',
        description: error.message || 'Invalid admin credentials',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: AdminLoginInput) => {
    loginMutation.mutate(data);
  };

  const fillCredentials = () => {
    form.setValue('username', 'chatualladmin');
    form.setValue('password', 'Hardcore123!');
  };

  return (
    <div className={cn(
      "min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center",
      isMobile ? "p-3" : "p-4"
    )}>
      <Card className={cn(
        "w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700",
        isMobile ? "max-w-sm" : "max-w-md"
      )}>
        <CardHeader className={cn(
          "text-center",
          isMobile ? "space-y-3" : "space-y-4"
        )}>
          <div className="flex justify-center">
            <div className={cn(
              "bg-blue-100 dark:bg-blue-900 rounded-full",
              isMobile ? "p-2" : "p-3"
            )}>
              <Shield className={cn(
                "text-blue-600 dark:text-blue-400",
                isMobile ? "h-6 w-6" : "h-8 w-8"
              )} />
            </div>
          </div>
          <div>
            <CardTitle className={cn(
              "font-bold text-slate-900 dark:text-white",
              isMobile ? "text-xl" : "text-2xl"
            )}>
              Admin Access
            </CardTitle>
            <CardDescription className={cn(
              "text-slate-600 dark:text-slate-400",
              isMobile ? "text-sm" : "text-base"
            )}>
              Secure admin portal login
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className={cn(
          isMobile ? "space-y-5" : "space-y-6"
        )}>
          <form onSubmit={form.handleSubmit(onSubmit)} className={cn(
            isMobile ? "space-y-3" : "space-y-4"
          )}>
            <div className="space-y-2">
              <Label htmlFor="username" className={cn(
                "text-slate-700 dark:text-slate-300",
                isMobile ? "text-sm" : "text-base"
              )}>
                Username
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter admin username"
                {...form.register('username')}
                className={cn(
                  "border-slate-200 dark:border-slate-600",
                  isMobile ? "h-10" : "h-11"
                )}
                data-testid="input-admin-username"
              />
              {form.formState.errors.username && (
                <p className={cn(
                  "text-red-600 dark:text-red-400",
                  isMobile ? "text-xs" : "text-sm"
                )}>
                  {form.formState.errors.username.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className={cn(
                "text-slate-700 dark:text-slate-300",
                isMobile ? "text-sm" : "text-base"
              )}>
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter admin password"
                {...form.register('password')}
                className={cn(
                  "border-slate-200 dark:border-slate-600",
                  isMobile ? "h-10" : "h-11"
                )}
                data-testid="input-admin-password"
              />
              {form.formState.errors.password && (
                <p className={cn(
                  "text-red-600 dark:text-red-400",
                  isMobile ? "text-xs" : "text-sm"
                )}>
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            <Button 
              type="submit" 
              size={isMobile ? "default" : "lg"}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              disabled={loginMutation.isPending}
              data-testid="button-admin-login"
            >
              {loginMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "border-2 border-white border-t-transparent rounded-full animate-spin",
                    isMobile ? "w-3 h-3" : "w-4 h-4"
                  )} />
                  <span className={cn(isMobile ? "text-sm" : "text-base")}>
                    Signing in...
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <LogIn className={cn(
                    isMobile ? "w-3 h-3" : "w-4 h-4"
                  )} />
                  <span className={cn(isMobile ? "text-sm" : "text-base")}>
                    Sign In
                  </span>
                </div>
              )}
            </Button>
          </form>

          {/* Development helper */}
          <div className={cn(
            "border-t border-slate-200 dark:border-slate-700",
            isMobile ? "pt-3" : "pt-4"
          )}>
            <div className="flex items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowCredentials(!showCredentials)}
                className={cn(
                  isMobile ? "text-xs px-3 py-1" : "text-xs"
                )}
                data-testid="button-show-credentials"
              >
                {showCredentials ? 'Hide' : 'Show'} Test Credentials
              </Button>
            </div>
            
            {showCredentials && (
              <div className={cn(
                "mt-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg",
                isMobile ? "text-xs" : "text-sm"
              )}>
                <p className={cn(
                  "text-slate-600 dark:text-slate-400 mb-2",
                  isMobile ? "text-xs" : "text-sm"
                )}>Admin Credentials:</p>
                <div className={cn(
                  "space-y-1 font-mono",
                  isMobile ? "text-xs" : "text-xs"
                )}>
                  <p className="text-slate-800 dark:text-slate-200">Username: chatualladmin</p>
                  <p className="text-slate-800 dark:text-slate-200">Password: Hardcore123!</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={fillCredentials}
                  className={cn(
                    "mt-2",
                    isMobile ? "text-xs px-2 py-1" : "text-xs"
                  )}
                  data-testid="button-fill-credentials"
                >
                  Auto-fill
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}