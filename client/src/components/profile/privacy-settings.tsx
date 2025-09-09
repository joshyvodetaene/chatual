import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Shield, Eye, EyeOff, Lock, Globe, Users, MessageCircle, Camera, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { User, UserPrivacySettings } from '@shared/schema';

interface PrivacySettingsProps {
  user: User;
  isMobile?: boolean;
}

type PrivacyPreferences = Omit<UserPrivacySettings, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;

export default function PrivacySettings({ user, isMobile = false }: PrivacySettingsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Fetch current privacy settings
  const { data: privacyData, isLoading } = useQuery({
    queryKey: [`/api/users/${user.id}/privacy-settings`],
    queryFn: () => apiRequest('GET', `/api/users/${user.id}/privacy-settings`),
  });

  const [privacySettings, setPrivacySettings] = useState<PrivacyPreferences>({
    profileVisibility: 'public',
    showOnlineStatus: true,
    showLastSeen: true,
    showAge: true,
    showLocation: true,
    allowDirectMessages: 'everyone',
    showPhotosToStrangers: true,
    discoverableInSearch: true,
    allowMentions: true,
  });

  // Update local state when data is loaded
  useEffect(() => {
    if (privacyData) {
      setPrivacySettings({
        profileVisibility: privacyData.profileVisibility,
        showOnlineStatus: privacyData.showOnlineStatus,
        showLastSeen: privacyData.showLastSeen,
        showAge: privacyData.showAge,
        showLocation: privacyData.showLocation,
        allowDirectMessages: privacyData.allowDirectMessages,
        showPhotosToStrangers: privacyData.showPhotosToStrangers,
        discoverableInSearch: privacyData.discoverableInSearch,
        allowMentions: privacyData.allowMentions,
      });
    }
  }, [privacyData]);

  const updatePrivacyMutation = useMutation({
    mutationFn: async (settings: PrivacyPreferences) => {
      return await apiRequest('PUT', `/api/users/${user.id}/privacy-settings`, settings);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Privacy settings updated successfully",
      });
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user.id}/privacy-settings`] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update privacy settings",
        variant: "destructive",
      });
    },
  });

  const handleSettingChange = <K extends keyof PrivacyPreferences>(
    key: K,
    value: PrivacyPreferences[K]
  ) => {
    setPrivacySettings(prev => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
  };

  const handleSave = () => {
    updatePrivacyMutation.mutate(privacySettings);
  };

  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case 'public': return <Globe className="w-4 h-4 text-green-500" />;
      case 'friends': return <Users className="w-4 h-4 text-blue-500" />;
      case 'private': return <Lock className="w-4 h-4 text-red-500" />;
      default: return <Eye className="w-4 h-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6" data-testid="privacy-settings-loading">
        <div className="animate-pulse">
          <div className="h-32 bg-gray-700 rounded-lg mb-6"></div>
          <div className="h-48 bg-gray-700 rounded-lg mb-6"></div>
          <div className="h-40 bg-gray-700 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="privacy-settings">
      {/* Profile Visibility */}
      <Card className="glass-effect backdrop-blur-glass border-primary/20">
        <CardHeader className={cn(isMobile ? "p-4 pb-3" : "")}>
          <CardTitle className={cn(
            "flex items-center justify-between",
            isMobile ? "text-lg" : ""
          )}>
            <div className="flex items-center space-x-2">
              <Shield className={cn(
                "text-primary",
                isMobile ? "w-5 h-5" : "w-6 h-6"
              )} />
              <span>Profile Visibility</span>
            </div>
            <Badge variant="outline" className="flex items-center space-x-1">
              {getVisibilityIcon(privacySettings.profileVisibility)}
              <span className="capitalize">{privacySettings.profileVisibility}</span>
            </Badge>
          </CardTitle>
          <CardDescription className={cn(
            isMobile ? "text-sm" : ""
          )}>
            Control who can see your profile and information
          </CardDescription>
        </CardHeader>
        <CardContent className={cn(isMobile ? "p-4 pt-0" : "")}>
          <div className="space-y-4">
            {/* Profile Visibility Options */}
            <div className="space-y-3">
              {[
                { value: 'public', label: 'Public', description: 'Anyone can see your profile', icon: Globe, color: 'text-green-500' },
                { value: 'friends', label: 'Friends Only', description: 'Only people you\'ve connected with', icon: Users, color: 'text-blue-500' },
                { value: 'private', label: 'Private', description: 'Only you can see your profile', icon: Lock, color: 'text-red-500' },
              ].map(({ value, label, description, icon: Icon, color }) => (
                <div
                  key={value}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors",
                    privacySettings.profileVisibility === value 
                      ? "border-primary bg-primary/10" 
                      : "border-gray-200 hover:border-primary/50"
                  )}
                  onClick={() => handleSettingChange('profileVisibility', value as any)}
                  data-testid={`profile-visibility-${value}`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={cn("w-5 h-5", color)} />
                    <div>
                      <p className="font-medium text-white">{label}</p>
                      <p className={cn(
                        "text-gray-400",
                        isMobile ? "text-xs" : "text-sm"
                      )}>{description}</p>
                    </div>
                  </div>
                  <div className={cn(
                    "w-4 h-4 rounded-full border-2",
                    privacySettings.profileVisibility === value
                      ? "border-primary bg-primary"
                      : "border-gray-300"
                  )}></div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Information Sharing */}
      <Card className="glass-effect backdrop-blur-glass border-primary/20">
        <CardHeader className={cn(isMobile ? "p-4 pb-3" : "")}>
          <CardTitle className={cn(
            "flex items-center space-x-2",
            isMobile ? "text-lg" : ""
          )}>
            <Eye className={cn(
              "text-primary",
              isMobile ? "w-5 h-5" : "w-6 h-6"
            )} />
            <span>Information Sharing</span>
          </CardTitle>
          <CardDescription className={cn(
            isMobile ? "text-sm" : ""
          )}>
            Choose what information others can see about you
          </CardDescription>
        </CardHeader>
        <CardContent className={cn(isMobile ? "p-4 pt-0" : "")}>
          <div className="space-y-6">
            {[
              {
                key: 'showOnlineStatus' as keyof PrivacyPreferences,
                label: 'Show Online Status',
                description: 'Let others see when you\'re online',
                icon: <div className="w-3 h-3 rounded-full bg-green-500"></div>,
              },
              {
                key: 'showLastSeen' as keyof PrivacyPreferences,
                label: 'Show Last Seen',
                description: 'Display when you were last active',
                icon: <Eye className="w-4 h-4 text-gray-400" />,
              },
              {
                key: 'showAge' as keyof PrivacyPreferences,
                label: 'Show Age',
                description: 'Display your age on your profile',
                icon: <span className="text-sm font-bold text-gray-400">18+</span>,
              },
              {
                key: 'showLocation' as keyof PrivacyPreferences,
                label: 'Show Location',
                description: 'Display your city/location',
                icon: <MapPin className="w-4 h-4 text-gray-400" />,
              },
              {
                key: 'showPhotosToStrangers' as keyof PrivacyPreferences,
                label: 'Show Photos to Everyone',
                description: 'Allow non-friends to see your photos',
                icon: <Camera className="w-4 h-4 text-gray-400" />,
              },
              {
                key: 'discoverableInSearch' as keyof PrivacyPreferences,
                label: 'Discoverable in Search',
                description: 'Allow others to find you through search',
                icon: <Globe className="w-4 h-4 text-gray-400" />,
              },
            ].map(({ key, label, description, icon }) => (
              <div key={key} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center w-8 h-8">
                    {icon}
                  </div>
                  <div>
                    <p className="font-medium text-white">{label}</p>
                    <p className={cn(
                      "text-gray-400",
                      isMobile ? "text-xs" : "text-sm"
                    )}>{description}</p>
                  </div>
                </div>
                <Switch
                  checked={privacySettings[key] as boolean}
                  onCheckedChange={(checked) => handleSettingChange(key, checked)}
                  data-testid={`switch-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Communication Settings */}
      <Card className="glass-effect backdrop-blur-glass border-primary/20">
        <CardHeader className={cn(isMobile ? "p-4 pb-3" : "")}>
          <CardTitle className={cn(
            "flex items-center space-x-2",
            isMobile ? "text-lg" : ""
          )}>
            <MessageCircle className={cn(
              "text-primary",
              isMobile ? "w-5 h-5" : "w-6 h-6"
            )} />
            <span>Communication</span>
          </CardTitle>
          <CardDescription className={cn(
            isMobile ? "text-sm" : ""
          )}>
            Control how others can contact and interact with you
          </CardDescription>
        </CardHeader>
        <CardContent className={cn(isMobile ? "p-4 pt-0" : "")}>
          <div className="space-y-6">
            {/* Direct Messages */}
            <div>
              <label className="block font-medium text-white mb-3">Direct Messages</label>
              <div className="space-y-2">
                {[
                  { value: 'everyone', label: 'Everyone', description: 'Anyone can send you messages' },
                  { value: 'friends', label: 'Friends Only', description: 'Only connected friends' },
                  { value: 'nobody', label: 'Nobody', description: 'Disable direct messages' },
                ].map(({ value, label, description }) => (
                  <div
                    key={value}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors",
                      privacySettings.allowDirectMessages === value 
                        ? "border-primary bg-primary/10" 
                        : "border-gray-200 hover:border-primary/50"
                    )}
                    onClick={() => handleSettingChange('allowDirectMessages', value as any)}
                    data-testid={`direct-messages-${value}`}
                  >
                    <div>
                      <p className="font-medium text-white">{label}</p>
                      <p className={cn(
                        "text-gray-400",
                        isMobile ? "text-xs" : "text-sm"
                      )}>{description}</p>
                    </div>
                    <div className={cn(
                      "w-4 h-4 rounded-full border-2",
                      privacySettings.allowDirectMessages === value
                        ? "border-primary bg-primary"
                        : "border-gray-300"
                    )}></div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Mentions */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">Allow Mentions</p>
                <p className={cn(
                  "text-gray-400",
                  isMobile ? "text-xs" : "text-sm"
                )}>Let others mention you in messages</p>
              </div>
              <Switch
                checked={privacySettings.allowMentions}
                onCheckedChange={(checked) => handleSettingChange('allowMentions', checked)}
                data-testid="switch-allow-mentions"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      {hasUnsavedChanges && (
        <div className={cn(
          "flex justify-end",
          isMobile && "px-0"
        )}>
          <Button 
            onClick={handleSave}
            disabled={updatePrivacyMutation.isPending}
            className={cn(
              "hover-lift transition-all duration-300",
              isMobile ? "w-full" : "min-w-32"
            )}
            data-testid="button-save-privacy"
          >
            {updatePrivacyMutation.isPending && (
              <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )}
            Save Privacy Settings
          </Button>
        </div>
      )}
    </div>
  );
}