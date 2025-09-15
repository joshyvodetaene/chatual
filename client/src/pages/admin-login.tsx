import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
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
    form.setValue('username', 'chatualadmin');
    form.setValue('password', 'Hardcore123!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full">
              <Shield className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-slate-900 dark:text-white">
              Admin Access
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              Secure admin portal login
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-slate-700 dark:text-slate-300">
                Username
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter admin username"
                {...form.register('username')}
                className="border-slate-200 dark:border-slate-600"
                data-testid="input-admin-username"
              />
              {form.formState.errors.username && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {form.formState.errors.username.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700 dark:text-slate-300">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter admin password"
                {...form.register('password')}
                className="border-slate-200 dark:border-slate-600"
                data-testid="input-admin-password"
              />
              {form.formState.errors.password && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              disabled={loginMutation.isPending}
              data-testid="button-admin-login"
            >
              {loginMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <LogIn className="w-4 h-4" />
                  Sign In
                </div>
              )}
            </Button>
          </form>

          {/* Development helper */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowCredentials(!showCredentials)}
                className="text-xs"
                data-testid="button-show-credentials"
              >
                {showCredentials ? 'Hide' : 'Show'} Test Credentials
              </Button>
            </div>
            
            {showCredentials && (
              <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg text-sm">
                <p className="text-slate-600 dark:text-slate-400 mb-2">Admin Credentials:</p>
                <div className="space-y-1 text-xs font-mono">
                  <p className="text-slate-800 dark:text-slate-200">Username: chatualadmin</p>
                  <p className="text-slate-800 dark:text-slate-200">Password: Hardcore123!</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={fillCredentials}
                  className="mt-2 text-xs"
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