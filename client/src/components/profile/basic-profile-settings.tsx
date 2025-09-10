import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CityAutocomplete } from '@/components/ui/city-autocomplete';
import { type CityValidationResult } from '@/lib/geocoding-maps';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { updateUserProfileSchema } from '@shared/schema';
import type { User, UpdateUserProfile } from '@shared/schema';
import { Loader2, User as UserIcon, Edit3, Heart, Calendar, MapPin, RefreshCw, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useGeolocation } from '@/hooks/use-geolocation';

interface BasicProfileSettingsProps {
  user: User;
  isMobile?: boolean;
}

export default function BasicProfileSettings({ user, isMobile = false }: BasicProfileSettingsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cityValidationResult, setCityValidationResult] = useState<CityValidationResult | null>(null);
  
  // Initialize geolocation hook
  const geolocation = useGeolocation();

  const form = useForm<UpdateUserProfile>({
    resolver: zodResolver(updateUserProfileSchema),
    defaultValues: {
      displayName: user.displayName,
      age: user.age || 18,
      gender: (user.gender as 'male' | 'female' | 'non-binary' | 'other') || undefined,
      bio: user.bio || '',
      location: user.location || undefined,
      latitude: user.latitude || undefined,
      longitude: user.longitude || undefined,
      genderPreference: (user.genderPreference as 'all' | 'male' | 'female') || 'all',
      ageMin: user.ageMin || 18,
      ageMax: user.ageMax || 99,
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: UpdateUserProfile) => {
      // Use coordinates from city validation if available
      if (cityValidationResult?.isValid && cityValidationResult.latitude && cityValidationResult.longitude) {
        data.latitude = cityValidationResult.latitude.toString();
        data.longitude = cityValidationResult.longitude.toString();
      }
      
      const response = await apiRequest('PUT', `/api/users/${user.id}/profile`, data);
      return await response.json();
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
                      <FormLabel className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        City
                      </FormLabel>
                      <FormControl>
                        <div className="space-y-3">
                          <CityAutocomplete
                            value={field.value || ''}
                            onValueChange={field.onChange}
                            onValidationChange={setCityValidationResult}
                            placeholder="Enter your city (Germany, Switzerland, Austria)"
                            data-testid="input-location"
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