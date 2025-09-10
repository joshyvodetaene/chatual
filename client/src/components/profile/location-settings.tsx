import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CityAutocomplete } from '@/components/ui/city-autocomplete';
import { MapPin, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { apiRequest } from '@/lib/queryClient';
import { updateUserProfileSchema, type UpdateUserProfile, type User } from '@shared/schema';
import { type CityValidationResult } from '@/lib/geocoding-maps';

interface LocationSettingsProps {
  user: User;
}

export default function LocationSettings({ user }: LocationSettingsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cityValidationResult, setCityValidationResult] = useState<CityValidationResult | null>(null);

  const form = useForm<UpdateUserProfile>({
    resolver: zodResolver(updateUserProfileSchema),
    defaultValues: {
      displayName: user.displayName,
      location: user.location,
      latitude: user.latitude || undefined,
      longitude: user.longitude || undefined,
      age: user.age || 18,
      genderPreference: (user.genderPreference as 'all' | 'male' | 'female') || 'all',
      ageMin: user.ageMin || 18,
      ageMax: user.ageMax || 99,
    },
  });

  const handleCityValidation = (result: CityValidationResult) => {
    setCityValidationResult(result);
    
    // Update form with validated coordinates when city is valid
    if (result.isValid && result.latitude && result.longitude) {
      form.setValue('latitude', result.latitude);
      form.setValue('longitude', result.longitude);
    }
    // Don't prevent form submission if validation fails - let user save anyway
  };

  const updateProfileMutation = useMutation({
    mutationFn: async (data: UpdateUserProfile) => {
      return await apiRequest('PUT', `/api/users/${user.id}/profile`, data);
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Location updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user.id}/profile-settings`] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update location",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: UpdateUserProfile) => {
    updateProfileMutation.mutate(data);
  };

  return (
    <div className="space-y-6" data-testid="location-settings">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
              control={form.control as any}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <CityAutocomplete
                      value={field.value || ''}
                      onValueChange={field.onChange}
                      onValidationChange={handleCityValidation}
                      placeholder="Enter your city name"
                      data-testid="input-location"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Current Coordinates Display */}
          {user.latitude && user.longitude && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Current Coordinates</CardTitle>
                <CardDescription>
                  Your location will be automatically geocoded when you update it
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-xs text-gray-500">Latitude</Label>
                    <p className="font-mono" data-testid="text-latitude">{user.latitude}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Longitude</Label>
                    <p className="font-mono" data-testid="text-longitude">{user.longitude}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={updateProfileMutation.isPending || !form.formState.isDirty}
              data-testid="button-save-location"
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