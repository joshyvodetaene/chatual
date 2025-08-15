import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Settings, Camera, MapPin, Shield, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { UserProfileSettings, User } from '@shared/schema';
import PhotoManager from '@/components/profile/photo-manager';
import LocationSettings from '@/components/profile/location-settings';
import BlockedUsers from '@/components/profile/blocked-users';
import ContactFilters from '@/components/profile/contact-filters';

export default function ProfileSettings() {
  // Get current user from localStorage (same as chat page)
  const [currentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('chatual_user');
    return saved ? JSON.parse(saved) : null;
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch profile settings
  const { data: profileSettings, isLoading } = useQuery({
    queryKey: [`/api/users/${currentUser?.id}/profile-settings`],
    enabled: !!currentUser?.id,
  }) as { data: UserProfileSettings | undefined; isLoading: boolean };

  // Redirect to login if no current user
  if (!currentUser) {
    return (
      <div className="flex-1 flex items-center justify-center" data-testid="profile-settings-no-user">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Please log in to access profile settings</p>
          <Button onClick={() => window.location.href = '/'}>
            Go to Chat
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center" data-testid="profile-settings-loading">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-500">Loading profile settings...</p>
        </div>
      </div>
    );
  }

  if (!profileSettings) {
    return (
      <div className="flex-1 flex items-center justify-center" data-testid="profile-settings-error">
        <div className="text-center">
          <p className="text-gray-500">Failed to load profile settings</p>
          <Button 
            onClick={() => queryClient.invalidateQueries({ queryKey: [`/api/users/${currentUser?.id}/profile-settings`] })}
            className="mt-4"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 max-w-4xl mx-auto" data-testid="profile-settings">
      <div className="mb-6">
        <div className="flex items-center space-x-3 mb-2">
          <Settings className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
        </div>
        <p className="text-gray-600">Manage your account settings and preferences</p>
      </div>

      <Tabs defaultValue="photos" className="w-full">
        <TabsList className="grid w-full grid-cols-4" data-testid="settings-tabs">
          <TabsTrigger value="photos" data-testid="tab-photos">
            <Camera className="w-4 h-4 mr-2" />
            Photos
          </TabsTrigger>
          <TabsTrigger value="location" data-testid="tab-location">
            <MapPin className="w-4 h-4 mr-2" />
            Location
          </TabsTrigger>
          <TabsTrigger value="blocked" data-testid="tab-blocked">
            <Shield className="w-4 h-4 mr-2" />
            Blocked Users
          </TabsTrigger>
          <TabsTrigger value="filters" data-testid="tab-filters">
            <Users className="w-4 h-4 mr-2" />
            Contact Filters
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="photos" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Photo Management</CardTitle>
                <CardDescription>
                  Upload and manage your profile photos. Set a primary photo that others will see.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PhotoManager 
                  userId={currentUser?.id || ''}
                  photos={profileSettings?.photos || []}
                  primaryPhoto={profileSettings?.primaryPhoto}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="location" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Location Settings</CardTitle>
                <CardDescription>
                  Update your location information to connect with nearby users.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LocationSettings 
                  user={profileSettings?.user || currentUser}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="blocked" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Blocked Users</CardTitle>
                <CardDescription>
                  Manage users you've blocked. Blocked users cannot send you messages.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BlockedUsers 
                  userId={currentUser?.id || ''}
                  blockedUsers={profileSettings?.blockedUsers || []}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="filters" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Contact Filters</CardTitle>
                <CardDescription>
                  Control who can contact you based on your preferences.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ContactFilters 
                  user={profileSettings?.user || currentUser}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}