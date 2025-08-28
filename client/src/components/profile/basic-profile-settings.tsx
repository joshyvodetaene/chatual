import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { updateUserProfileSchema } from '@shared/schema';
import type { User, UpdateUserProfile } from '@shared/schema';
import { Loader2, User as UserIcon, Edit3, Heart, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BasicProfileSettingsProps {
  user: User;
  isMobile?: boolean;
}

export default function BasicProfileSettings({ user, isMobile = false }: BasicProfileSettingsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<UpdateUserProfile>({
    resolver: zodResolver(updateUserProfileSchema),
    defaultValues: {
      displayName: user.displayName,
      age: user.age || 18,
      gender: (user.gender as 'male' | 'female' | 'non-binary' | 'other') || undefined,
      bio: user.bio || '',
      location: user.location,
      latitude: user.latitude || undefined,
      longitude: user.longitude || undefined,
      genderPreference: (user.genderPreference as 'all' | 'male' | 'female') || 'all',
      ageMin: user.ageMin || 18,
      ageMax: user.ageMax || 99,
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: UpdateUserProfile) => {
      return await apiRequest('PUT', `/api/users/${user.id}/profile`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user.id}/profile-settings`] });
      queryClient.invalidateQueries({ queryKey: ['/api/chat-data'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      
      // Update localStorage with fresh user data
      const currentUser = localStorage.getItem('chatual_user');
      if (currentUser) {
        const userData = JSON.parse(currentUser);
        if (userData.id === user.id) {
          const updatedUser = { ...userData, ...form.getValues() };
          localStorage.setItem('chatual_user', JSON.stringify(updatedUser));
        }
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: UpdateUserProfile) => {
    updateProfileMutation.mutate(data);
  };

  return (
    <div className="space-y-6" data-testid="basic-profile-settings">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-6">
          {/* Personal Information */}
          <Card className="glass-effect backdrop-blur-glass border-primary/20">
            <CardHeader className={cn(isMobile ? "p-4 pb-3" : "")}>
              <CardTitle className={cn(
                "flex items-center space-x-2",
                isMobile ? "text-lg" : ""
              )}>
                <UserIcon className={cn(
                  "text-primary",
                  isMobile ? "w-5 h-5" : "w-6 h-6"
                )} />
                <span>Personal Information</span>
              </CardTitle>
              <CardDescription className={cn(
                isMobile ? "text-sm" : ""
              )}>
                Basic information about yourself that others can see
              </CardDescription>
            </CardHeader>
            <CardContent className={cn(isMobile ? "p-4 pt-0" : "")}>
              <div className={cn(
                "grid gap-6",
                isMobile ? "grid-cols-1" : "grid-cols-2"
              )}>
                <FormField
                  control={form.control as any}
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
                  control={form.control as any}
                  name="age"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Age</FormLabel>
                      <FormControl>
                        <Input 
                          type="number"
                          min="18"
                          max="100"
                          placeholder="Your age"
                          {...field}
                          onChange={e => field.onChange(parseInt(e.target.value) || undefined)}
                          data-testid="input-age"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gender</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value}
                        data-testid="select-gender"
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="non-binary">Non-Binary</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="City, Country" 
                          {...field}
                          data-testid="input-location"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control as any}
                name="bio"
                render={({ field }) => (
                  <FormItem className="mt-6">
                    <FormLabel>Bio</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Tell others about yourself..."
                        className="min-h-[100px] resize-none"
                        maxLength={500}
                        {...field}
                        data-testid="textarea-bio"
                      />
                    </FormControl>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <FormMessage />
                      <span>{(field.value || '').length}/500 characters</span>
                    </div>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Dating Preferences */}
          <Card className="glass-effect backdrop-blur-glass border-primary/20">
            <CardHeader className={cn(isMobile ? "p-4 pb-3" : "")}>
              <CardTitle className={cn(
                "flex items-center space-x-2",
                isMobile ? "text-lg" : ""
              )}>
                <Heart className={cn(
                  "text-pink-500",
                  isMobile ? "w-5 h-5" : "w-6 h-6"
                )} />
                <span>Dating Preferences</span>
              </CardTitle>
              <CardDescription className={cn(
                isMobile ? "text-sm" : ""
              )}>
                Set your preferences for meeting new people
              </CardDescription>
            </CardHeader>
            <CardContent className={cn(isMobile ? "p-4 pt-0" : "")}>
              <div className={cn(
                "grid gap-6",
                isMobile ? "grid-cols-1" : "grid-cols-3"
              )}>
                <FormField
                  control={form.control as any}
                  name="genderPreference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Interested In</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value}
                        data-testid="select-gender-preference"
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="male">Men</SelectItem>
                          <SelectItem value="female">Women</SelectItem>
                          <SelectItem value="all">Everyone</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name="ageMin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Min Age</FormLabel>
                      <FormControl>
                        <Input 
                          type="number"
                          min="18"
                          max="99"
                          {...field}
                          onChange={e => field.onChange(parseInt(e.target.value) || 18)}
                          data-testid="input-age-min"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name="ageMax"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Age</FormLabel>
                      <FormControl>
                        <Input 
                          type="number"
                          min="18"
                          max="99"
                          {...field}
                          onChange={e => field.onChange(parseInt(e.target.value) || 99)}
                          data-testid="input-age-max"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <div className={cn(
            "flex justify-end",
            isMobile && "px-0"
          )}>
            <Button 
              type="submit" 
              disabled={updateProfileMutation.isPending}
              className={cn(
                "hover-lift transition-all duration-300",
                isMobile ? "w-full" : "min-w-32"
              )}
              data-testid="button-save-profile"
            >
              {updateProfileMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Save Changes
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}