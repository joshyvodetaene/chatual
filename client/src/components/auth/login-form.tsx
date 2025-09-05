import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { LoginUser, loginSchema } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react';
import { useResponsive } from '@/hooks/use-responsive';
import { cn } from '@/lib/utils';

interface LoginFormProps {
  onSuccess: (user: any) => void;
  onSwitchToRegister: () => void;
}

export default function LoginForm({ onSuccess, onSwitchToRegister }: LoginFormProps) {
  const { toast } = useToast();
  const { isMobile } = useResponsive();

  const form = useForm<LoginUser>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginUser) => {
      return await apiRequest('POST', '/api/auth/login', data);
    },
    onSuccess: async (response) => {
      const data = await response.json();
      toast({
        title: 'Login successful',
        description: `Welcome back, ${data.user.displayName}!`,
      });
      onSuccess(data.user);
    },
    onError: async (error: any) => {
      const errorData = await error.response?.json?.();
      
      // Handle banned user specifically
      if (errorData?.isBanned) {
        toast({
          title: 'Account Suspended',
          description: errorData.message || 'Your account has been banned. Please contact support.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Login failed',
          description: errorData?.error || 'Please check your credentials.',
          variant: 'destructive',
        });
      }
    },
  });

  const onSubmit = (data: LoginUser) => {
    loginMutation.mutate(data);
  };

  return (
    <Card className="w-full max-w-md mx-auto bg-card/80 backdrop-blur-sm border-primary/20 shadow-2xl red-glow">
      <CardHeader className={cn(
        isMobile && "p-4 pb-3"
      )}>
        <CardTitle className={cn(
          "flex items-center gap-2 text-white",
          isMobile ? "text-lg" : "text-xl"
        )}>
          <LogIn className={cn(
            "text-primary",
            isMobile ? "w-5 h-5" : "w-6 h-6"
          )} />
          Welcome Back
        </CardTitle>
        <CardDescription className={cn(
          "text-gray-300",
          isMobile ? "text-sm" : ""
        )}>
          Sign in to your Chatual account
        </CardDescription>
      </CardHeader>
      <CardContent className={cn(
        isMobile && "p-4 pt-0"
      )}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className={cn(
            isMobile ? "space-y-3" : "space-y-4"
          )}>
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nickname</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter your nickname"
                      {...field}
                      data-testid="input-login-username"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Enter your password"
                      {...field}
                      data-testid="input-login-password"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3 red-glow transition-all duration-300 hover:shadow-lg"
              disabled={loginMutation.isPending}
              data-testid="button-login"
            >
              {loginMutation.isPending ? 'Signing In...' : 'Sign In'}
            </Button>
          </form>
        </Form>

        <div className="mt-4 text-center">
          <p className="text-sm text-gray-300">
            Don't have an account?{' '}
            <button
              onClick={onSwitchToRegister}
              className="text-primary hover:text-primary/80 font-semibold underline transition-colors"
              data-testid="button-switch-to-register"
            >
              Create one
            </button>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}