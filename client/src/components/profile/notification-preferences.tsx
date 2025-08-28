import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, BellOff, MessageCircle, Heart, UserPlus, AtSign, Camera, AlertTriangle, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { User } from '@shared/schema';

interface NotificationPreferencesProps {
  user: User;
  isMobile?: boolean;
}

interface NotificationSettings {
  enableNotifications: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  quietHours: {
    enabled: boolean;
    startTime: string;
    endTime: string;
  };
  notifications: {
    newMessages: boolean;
    mentions: boolean;
    reactions: boolean;
    friendRequests: boolean;
    photoLikes: boolean;
    profileViews: boolean;
    newMatches: boolean;
    roomInvites: boolean;
    systemUpdates: boolean;
    securityAlerts: boolean;
  };
  emailNotifications: {
    dailySummary: boolean;
    weeklyHighlights: boolean;
    importantUpdates: boolean;
    securityAlerts: boolean;
  };
}

export default function NotificationPreferences({ user, isMobile = false }: NotificationPreferencesProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Initialize with default notification settings
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    enableNotifications: true,
    soundEnabled: true,
    vibrationEnabled: true,
    quietHours: {
      enabled: false,
      startTime: '22:00',
      endTime: '08:00',
    },
    notifications: {
      newMessages: true,
      mentions: true,
      reactions: true,
      friendRequests: true,
      photoLikes: true,
      profileViews: false,
      newMatches: true,
      roomInvites: true,
      systemUpdates: true,
      securityAlerts: true,
    },
    emailNotifications: {
      dailySummary: false,
      weeklyHighlights: true,
      importantUpdates: true,
      securityAlerts: true,
    },
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const updateNotificationsMutation = useMutation({
    mutationFn: async (settings: NotificationSettings) => {
      // In a real app, you'd create an API endpoint to save notification settings
      return await apiRequest('PUT', `/api/users/${user.id}/notification-settings`, settings);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Notification preferences updated successfully",
      });
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user.id}/profile-settings`] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update notification preferences",
        variant: "destructive",
      });
    },
  });

  const handleSettingChange = (path: string, value: any) => {
    setNotificationSettings(prev => {
      const newSettings = { ...prev };
      const keys = path.split('.');
      let current: any = newSettings;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return newSettings;
    });
    setHasUnsavedChanges(true);
  };

  const handleSave = () => {
    updateNotificationsMutation.mutate(notificationSettings);
  };

  return (
    <div className="space-y-6" data-testid="notification-preferences">
      {/* General Settings */}
      <Card className="glass-effect backdrop-blur-glass border-primary/20">
        <CardHeader className={cn(isMobile ? "p-4 pb-3" : "")}>
          <CardTitle className={cn(
            "flex items-center justify-between",
            isMobile ? "text-lg" : ""
          )}>
            <div className="flex items-center space-x-2">
              {notificationSettings.enableNotifications ? (
                <Bell className={cn(
                  "text-primary",
                  isMobile ? "w-5 h-5" : "w-6 h-6"
                )} />
              ) : (
                <BellOff className={cn(
                  "text-gray-400",
                  isMobile ? "w-5 h-5" : "w-6 h-6"
                )} />
              )}
              <span>Notification Settings</span>
            </div>
            <Badge variant={notificationSettings.enableNotifications ? "default" : "outline"}>
              {notificationSettings.enableNotifications ? "Enabled" : "Disabled"}
            </Badge>
          </CardTitle>
          <CardDescription className={cn(
            isMobile ? "text-sm" : ""
          )}>
            Control how and when you receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className={cn(isMobile ? "p-4 pt-0" : "")}>
          <div className="space-y-6">
            {/* Master Switch */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center space-x-3">
                <Bell className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium text-white">Enable Notifications</p>
                  <p className={cn(
                    "text-gray-400",
                    isMobile ? "text-xs" : "text-sm"
                  )}>Master control for all notifications</p>
                </div>
              </div>
              <Switch
                checked={notificationSettings.enableNotifications}
                onCheckedChange={(checked) => handleSettingChange('enableNotifications', checked)}
                data-testid="switch-enable-notifications"
              />
            </div>

            {notificationSettings.enableNotifications && (
              <>
                {/* Sound & Vibration */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {notificationSettings.soundEnabled ? (
                        <Volume2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <VolumeX className="w-4 h-4 text-gray-400" />
                      )}
                      <div>
                        <p className="font-medium text-white">Sound</p>
                        <p className={cn(
                          "text-gray-400",
                          isMobile ? "text-xs" : "text-sm"
                        )}>Play notification sounds</p>
                      </div>
                    </div>
                    <Switch
                      checked={notificationSettings.soundEnabled}
                      onCheckedChange={(checked) => handleSettingChange('soundEnabled', checked)}
                      data-testid="switch-sound-enabled"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 rounded border-2 border-gray-400 flex items-center justify-center">
                        <div className="w-1 h-1 bg-gray-400 rounded"></div>
                      </div>
                      <div>
                        <p className="font-medium text-white">Vibration</p>
                        <p className={cn(
                          "text-gray-400",
                          isMobile ? "text-xs" : "text-sm"
                        )}>Vibrate on notifications</p>
                      </div>
                    </div>
                    <Switch
                      checked={notificationSettings.vibrationEnabled}
                      onCheckedChange={(checked) => handleSettingChange('vibrationEnabled', checked)}
                      data-testid="switch-vibration-enabled"
                    />
                  </div>
                </div>

                {/* Quiet Hours */}
                <div className="p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-medium text-white">Quiet Hours</p>
                      <p className={cn(
                        "text-gray-400",
                        isMobile ? "text-xs" : "text-sm"
                      )}>Pause notifications during specific hours</p>
                    </div>
                    <Switch
                      checked={notificationSettings.quietHours.enabled}
                      onCheckedChange={(checked) => handleSettingChange('quietHours.enabled', checked)}
                      data-testid="switch-quiet-hours"
                    />
                  </div>

                  {notificationSettings.quietHours.enabled && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Start Time</label>
                        <Select
                          value={notificationSettings.quietHours.startTime}
                          onValueChange={(value) => handleSettingChange('quietHours.startTime', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 24 }, (_, i) => {
                              const hour = i.toString().padStart(2, '0');
                              return (
                                <SelectItem key={hour} value={`${hour}:00`}>
                                  {hour}:00
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">End Time</label>
                        <Select
                          value={notificationSettings.quietHours.endTime}
                          onValueChange={(value) => handleSettingChange('quietHours.endTime', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 24 }, (_, i) => {
                              const hour = i.toString().padStart(2, '0');
                              return (
                                <SelectItem key={hour} value={`${hour}:00`}>
                                  {hour}:00
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* App Notifications */}
      {notificationSettings.enableNotifications && (
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
              <span>App Notifications</span>
            </CardTitle>
            <CardDescription className={cn(
              isMobile ? "text-sm" : ""
            )}>
              Choose which activities trigger notifications
            </CardDescription>
          </CardHeader>
          <CardContent className={cn(isMobile ? "p-4 pt-0" : "")}>
            <div className="space-y-4">
              {[
                { key: 'newMessages', label: 'New Messages', description: 'When someone sends you a message', icon: MessageCircle, color: 'text-blue-500' },
                { key: 'mentions', label: 'Mentions', description: 'When someone mentions you in a message', icon: AtSign, color: 'text-purple-500' },
                { key: 'reactions', label: 'Reactions', description: 'When someone reacts to your message', icon: Heart, color: 'text-red-500' },
                { key: 'friendRequests', label: 'Friend Requests', description: 'When someone wants to connect with you', icon: UserPlus, color: 'text-green-500' },
                { key: 'photoLikes', label: 'Photo Likes', description: 'When someone likes your photos', icon: Camera, color: 'text-pink-500' },
                { key: 'profileViews', label: 'Profile Views', description: 'When someone views your profile', icon: 'custom', color: 'text-blue-400' },
                { key: 'newMatches', label: 'New Matches', description: 'When you have a mutual connection', icon: Heart, color: 'text-red-400' },
                { key: 'roomInvites', label: 'Room Invites', description: 'When someone invites you to a room', icon: UserPlus, color: 'text-indigo-500' },
                { key: 'systemUpdates', label: 'System Updates', description: 'App updates and announcements', icon: Bell, color: 'text-gray-400' },
                { key: 'securityAlerts', label: 'Security Alerts', description: 'Important security notifications', icon: AlertTriangle, color: 'text-orange-500' },
              ].map(({ key, label, description, icon: Icon, color }) => (
                <div key={key} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={cn("w-5 h-5 flex items-center justify-center", color)}>
                      {Icon === 'custom' ? (
                        <div className="w-4 h-4 rounded-full bg-blue-400"></div>
                      ) : (
                        <Icon className="w-4 h-4" />
                      )}
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
                    checked={notificationSettings.notifications[key as keyof typeof notificationSettings.notifications] as boolean}
                    onCheckedChange={(checked) => handleSettingChange(`notifications.${key}`, checked)}
                    data-testid={`switch-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Email Notifications */}
      {notificationSettings.enableNotifications && (
        <Card className="glass-effect backdrop-blur-glass border-primary/20">
          <CardHeader className={cn(isMobile ? "p-4 pb-3" : "")}>
            <CardTitle className={cn(
              "flex items-center space-x-2",
              isMobile ? "text-lg" : ""
            )}>
              <div className="w-6 h-6 flex items-center justify-center bg-blue-500 rounded text-white text-xs font-bold">@</div>
              <span>Email Notifications</span>
            </CardTitle>
            <CardDescription className={cn(
              isMobile ? "text-sm" : ""
            )}>
              Receive updates and summaries via email
            </CardDescription>
          </CardHeader>
          <CardContent className={cn(isMobile ? "p-4 pt-0" : "")}>
            <div className="space-y-4">
              {[
                { key: 'dailySummary', label: 'Daily Summary', description: 'Daily digest of your activity' },
                { key: 'weeklyHighlights', label: 'Weekly Highlights', description: 'Weekly summary of important events' },
                { key: 'importantUpdates', label: 'Important Updates', description: 'Critical app updates and changes' },
                { key: 'securityAlerts', label: 'Security Alerts', description: 'Security-related notifications' },
              ].map(({ key, label, description }) => (
                <div key={key} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">{label}</p>
                    <p className={cn(
                      "text-gray-400",
                      isMobile ? "text-xs" : "text-sm"
                    )}>{description}</p>
                  </div>
                  <Switch
                    checked={notificationSettings.emailNotifications[key as keyof typeof notificationSettings.emailNotifications] as boolean}
                    onCheckedChange={(checked) => handleSettingChange(`emailNotifications.${key}`, checked)}
                    data-testid={`switch-email-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save Button */}
      {hasUnsavedChanges && (
        <div className={cn(
          "flex justify-end",
          isMobile && "px-0"
        )}>
          <Button 
            onClick={handleSave}
            disabled={updateNotificationsMutation.isPending}
            className={cn(
              "hover-lift transition-all duration-300",
              isMobile ? "w-full" : "min-w-32"
            )}
            data-testid="button-save-notifications"
          >
            {updateNotificationsMutation.isPending && (
              <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )}
            Save Notification Preferences
          </Button>
        </div>
      )}
    </div>
  );
}