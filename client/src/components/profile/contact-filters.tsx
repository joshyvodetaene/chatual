import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Users, Heart, Calendar, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { apiRequest } from '@/lib/queryClient';
import { updateUserProfileSchema, type UpdateUserProfile, type User } from '@shared/schema';

interface ContactFiltersProps {
  user: User;
}

export default function ContactFilters({ user }: ContactFiltersProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<UpdateUserProfile>({
    resolver: zodResolver(updateUserProfileSchema),
    defaultValues: {
      displayName: user.displayName,
      location: user.location,
      latitude: user.latitude || undefined,
      longitude: user.longitude || undefined,
      genderPreference: (user.genderPreference as 'all' | 'male' | 'female') || 'all',
      ageMin: user.ageMin || 18,
      ageMax: user.ageMax || 99,
    },
  });

  const updateFiltersMutation = useMutation({
    mutationFn: async (data: UpdateUserProfile) => {
      return await apiRequest(`/api/users/${user.id}/profile`, {
        method: 'PUT',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Contact filters updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user.id}/profile-settings`] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update contact filters",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: UpdateUserProfile) => {
    updateFiltersMutation.mutate(data);
  };

  const ageRange = form.watch(['ageMin', 'ageMax']);

  return (
    <div className="space-y-6" data-testid="contact-filters">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-8">
          {/* Gender Preference */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Heart className="w-5 h-5 text-pink-500" />
                <span>Gender Preference</span>
              </CardTitle>
              <CardDescription>
                Choose who can contact you based on gender
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control as any}
                name="genderPreference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Allow contact from</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                      data-testid="select-gender-preference"
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender preference" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="all" data-testid="option-all-genders">
                          All Genders
                        </SelectItem>
                        <SelectItem value="male" data-testid="option-male-only">
                          Men Only
                        </SelectItem>
                        <SelectItem value="female" data-testid="option-female-only">
                          Women Only
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Age Range */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-blue-500" />
                <span>Age Range</span>
              </CardTitle>
              <CardDescription>
                Set the age range for users who can contact you
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Age Range</Label>
                  <span className="text-sm font-medium" data-testid="age-range-display">
                    {ageRange[0]} - {ageRange[1]} years
                  </span>
                </div>
                
                <div className="px-3">
                  <Controller
                    control={form.control}
                    name="ageMin"
                    render={({ field: ageMinField }) => (
                      <Controller
                        control={form.control}
                        name="ageMax"
                        render={({ field: ageMaxField }) => (
                          <Slider
                            min={18}
                            max={99}
                            step={1}
                            value={[ageMinField.value, ageMaxField.value]}
                            onValueChange={(value) => {
                              ageMinField.onChange(value[0]);
                              ageMaxField.onChange(value[1]);
                            }}
                            className="w-full"
                            data-testid="slider-age-range"
                          />
                        )}
                      />
                    )}
                  />
                </div>

                <div className="flex justify-between text-xs text-gray-500">
                  <span>18 years</span>
                  <span>99 years</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current Settings Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-green-500" />
                <span>Current Filter Settings</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-xs text-gray-500">Gender Preference</Label>
                  <p className="font-medium capitalize" data-testid="current-gender-preference">
                    {form.watch('genderPreference') === 'all' ? 'All Genders' : 
                     form.watch('genderPreference') === 'male' ? 'Men Only' : 'Women Only'}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Age Range</Label>
                  <p className="font-medium" data-testid="current-age-range">
                    {form.watch('ageMin')} - {form.watch('ageMax')} years
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={updateFiltersMutation.isPending || !form.formState.isDirty}
              data-testid="button-save-filters"
            >
              {updateFiltersMutation.isPending && (
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