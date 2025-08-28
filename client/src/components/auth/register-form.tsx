import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { RegisterUser, registerUserSchema } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useGeolocation } from '@/hooks/use-geolocation';
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
import { CheckCircle, XCircle, Loader2, MapPin, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useResponsive } from '@/hooks/use-responsive';

interface RegisterFormProps {
  onSuccess: (user: any) => void;
  onSwitchToLogin: () => void;
}

export default function RegisterForm({ onSuccess, onSwitchToLogin }: RegisterFormProps) {
  const [usernameToCheck, setUsernameToCheck] = useState('');
  const { toast } = useToast();
  const { isMobile } = useResponsive();
  
  // Initialize geolocation hook
  const geolocation = useGeolocation();

  const form = useForm<RegisterUser>({
    resolver: zodResolver(registerUserSchema),
    defaultValues: {
      username: '',
      displayName: '',
      password: '',
      confirmPassword: '',
      age: 18,
      gender: '',
      location: '',
      latitude: '',
      longitude: '',
      avatar: '',
    },
    mode: 'onChange',
  });

  // Update form when coordinates are received
  useEffect(() => {
    if (geolocation.coordinates) {
      form.setValue('latitude', geolocation.coordinates.latitude.toString());
      form.setValue('longitude', geolocation.coordinates.longitude.toString());
    }
  }, [geolocation.coordinates, form]);

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
    <Card className="w-full max-w-md mx-auto bg-card/80 backdrop-blur-sm border-primary/20 shadow-2xl red-glow">
      <CardHeader className={cn(
        isMobile && "p-4 pb-3"
      )}>
        <CardTitle className={cn(
          "text-white",
          isMobile ? "text-lg" : "text-xl"
        )}>Join Chatual</CardTitle>
        <CardDescription className={cn(
          "text-gray-300",
          isMobile ? "text-sm" : ""
        )}>
          Create your account to start chatting
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
              name="age"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Age</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="18"
                      max="100"
                      placeholder="Enter your age"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 18)}
                      value={field.value || ''}
                      data-testid="input-age"
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
                  <FormLabel className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Location
                  </FormLabel>
                  <FormControl>
                    <div className="space-y-3">
                      <Textarea
                        placeholder="Enter your location (e.g., New York, USA)"
                        {...field}
                        data-testid="input-location"
                        rows={2}
                      />
                      
                      {/* Location detection section */}
                      <div className="flex flex-col space-y-2">
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={geolocation.getCurrentPosition}
                            disabled={geolocation.isLoading || !geolocation.isSupported}
                            data-testid="button-get-location"
                            className="flex items-center gap-2"
                          >
                            {geolocation.isLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RefreshCw className="w-4 h-4" />
                            )}
                            {geolocation.isLoading ? 'Getting Location...' : 'Detect My Location'}
                          </Button>
                          
                          {geolocation.coordinates && (
                            <span className="text-sm text-green-600 flex items-center gap-1">
                              <CheckCircle className="w-4 h-4" />
                              Location detected
                            </span>
                          )}
                        </div>
                        
                        {/* Error display */}
                        {geolocation.error && (
                          <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                            {geolocation.error}
                          </div>
                        )}
                        
                        {/* Coordinates display */}
                        {geolocation.coordinates && (
                          <div className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-800 p-2 rounded">
                            Coordinates: {geolocation.coordinates.latitude.toFixed(6)}, {geolocation.coordinates.longitude.toFixed(6)}
                          </div>
                        )}
                        
                        {/* Browser not supported message */}
                        {!geolocation.isSupported && (
                          <div className="text-sm text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded">
                            Location detection is not supported by your browser. Please enter your location manually.
                          </div>
                        )}
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3 red-glow transition-all duration-300 hover:shadow-lg"
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
          <p className="text-sm text-gray-300">
            Already have an account?{' '}
            <button
              onClick={onSwitchToLogin}
              className="text-primary hover:text-primary/80 font-semibold underline transition-colors"
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