import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { RegisterUser, registerUserSchema } from '@shared/schema';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RegisterFormProps {
  onSuccess: (user: any) => void;
  onSwitchToLogin: () => void;
}

export default function RegisterForm({ onSuccess, onSwitchToLogin }: RegisterFormProps) {
  const [usernameToCheck, setUsernameToCheck] = useState('');
  const { toast } = useToast();

  const form = useForm<RegisterUser>({
    resolver: zodResolver(registerUserSchema),
    defaultValues: {
      username: '',
      displayName: '',
      password: '',
      confirmPassword: '',
      gender: '',
      location: '',
      avatar: '',
    },
    mode: 'onChange',
  });

  const watchedUsername = form.watch('username');

  // Debounce username checking
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (watchedUsername && watchedUsername.length >= 3) {
        setUsernameToCheck(watchedUsername);
      } else {
        setUsernameToCheck('');
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [watchedUsername]);

  // Check username availability
  const { data: usernameCheck, isLoading: isCheckingUsername } = useQuery<{ available: boolean }>({
    queryKey: ['/api/auth/check-username', usernameToCheck],
    enabled: !!usernameToCheck,
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterUser) => {
      return await apiRequest('POST', '/api/auth/register', data);
    },
    onSuccess: async (response) => {
      const data = await response.json();
      toast({
        title: 'Registration successful',
        description: 'Welcome to Chatual!',
      });
      onSuccess(data.user);
    },
    onError: async (error: any) => {
      const errorData = await error.response?.json?.();
      toast({
        title: 'Registration failed',
        description: errorData?.error || 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: RegisterUser) => {
    registerMutation.mutate(data);
  };

  const getUsernameStatusIcon = () => {
    if (!usernameToCheck || usernameToCheck !== watchedUsername) return null;
    
    if (isCheckingUsername) {
      return <Loader2 className="w-4 h-4 animate-spin text-gray-400" />;
    }

    if (usernameCheck?.available) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    } else {
      return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getUsernameStatusText = () => {
    if (!usernameToCheck || usernameToCheck !== watchedUsername) return null;
    
    if (isCheckingUsername) {
      return <span className="text-sm text-gray-500">Checking availability...</span>;
    }

    if (usernameCheck?.available) {
      return <span className="text-sm text-green-600">Username is available!</span>;
    } else {
      return <span className="text-sm text-red-600">Username is already taken</span>;
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Join Chatual</CardTitle>
        <CardDescription>
          Create your account to start chatting
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nickname</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        placeholder="Choose a unique nickname"
                        {...field}
                        data-testid="input-username"
                        className={cn(
                          usernameCheck && !usernameCheck.available && "border-red-500"
                        )}
                      />
                      <div className="absolute right-3 top-3">
                        {getUsernameStatusIcon()}
                      </div>
                    </div>
                  </FormControl>
                  <div className="min-h-[20px]">
                    {getUsernameStatusText()}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Your display name"
                      {...field}
                      data-testid="input-display-name"
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
                      placeholder="Enter a secure password"
                      {...field}
                      data-testid="input-password"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Confirm your password"
                      {...field}
                      data-testid="input-confirm-password"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="gender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gender</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-gender">
                        <SelectValue placeholder="Select your gender" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter your location (e.g., New York, USA)"
                      {...field}
                      data-testid="input-location"
                      rows={2}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={
                registerMutation.isPending || 
                (usernameCheck && !usernameCheck.available) ||
                !form.formState.isValid
              }
              data-testid="button-register"
            >
              {registerMutation.isPending ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>
        </Form>

        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <button
              onClick={onSwitchToLogin}
              className="text-primary hover:underline"
              data-testid="button-switch-to-login"
            >
              Sign in
            </button>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}