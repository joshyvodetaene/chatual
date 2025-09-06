import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Settings, Camera, MapPin, Shield, Users, User, Bell, Lock, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { UserProfileSettings, User as UserType } from '@shared/schema';
import PhotoManager from '@/components/profile/photo-manager';
import LocationSettings from '@/components/profile/location-settings';
import BlockedUsers from '@/components/profile/blocked-users';
import ContactFilters from '@/components/profile/contact-filters';
import BasicProfileSettings from '@/components/profile/basic-profile-settings';
import PrivacySettings from '@/components/profile/privacy-settings';
import NotificationPreferences from '@/components/profile/notification-preferences';
import AccountDeletion from '@/components/profile/account-deletion';
import GDPRCompliance from '@/components/profile/gdpr-compliance';
import { BackButton } from '@/components/ui/back-button';
import { useResponsive } from '@/hooks/use-responsive';
import { cn } from '@/lib/utils';

export default function ProfileSettings() {
  // Get current user from localStorage (same as chat page)
  const [currentUser] = useState<UserType | null>(() => {
    const saved = localStorage.getItem('chatual_user');
    return saved ? JSON.parse(saved) : null;
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isMobile, isTablet } = useResponsive();

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
    <div className={cn(
      "flex-1 bg-background sensual-gradient min-h-screen",
      isMobile ? "p-4" : "p-6",
      !isMobile && "max-w-4xl mx-auto"
    )} data-testid="profile-settings">
      <BackButton className="mb-4" />
      <div className="mb-6">
        <div className={cn(
          "flex items-center mb-2",
          isMobile ? "space-x-2" : "space-x-3"
        )}>
          <Settings className={cn(
            "text-primary",
            isMobile ? "w-5 h-5" : "w-6 h-6"
          )} />
          <h1 className={cn(
            "font-bold text-white text-glow",
            isMobile ? "text-xl" : "text-2xl"
          )}>Profile Settings</h1>
        </div>
        <p className={cn(
          "text-gray-300",
          isMobile ? "text-sm" : ""
        )}>Manage your account settings and preferences</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className={cn(
          "grid w-full glass-effect backdrop-blur-glass rounded-2xl p-2 shadow-lg",
          isMobile ? "grid-cols-4 gap-1 h-auto" : "grid-cols-9 gap-1",
        )} data-testid="settings-tabs">
          <TabsTrigger 
            value="profile" 
            data-testid="tab-profile"
            className={cn(
              "flex items-center justify-center rounded-xl transition-all duration-300 hover-lift",
              isMobile ? "flex-col gap-1 h-16 text-xs p-2" : "flex-row gap-2 h-12",
              "data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg"
            )}
          >
            <User className={cn(
              isMobile ? "w-4 h-4" : "w-4 h-4"
            )} />
            <span className={cn(
              isMobile ? "leading-tight font-medium text-xs" : "font-medium",
            )}>Profile</span>
          </TabsTrigger>
          <TabsTrigger 
            value="photos" 
            data-testid="tab-photos"
            className={cn(
              "flex items-center justify-center rounded-xl transition-all duration-300 hover-lift",
              isMobile ? "flex-col gap-1 h-16 text-xs p-2" : "flex-row gap-2 h-12",
              "data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg"
            )}
          >
            <Camera className={cn(
              isMobile ? "w-4 h-4" : "w-4 h-4"
            )} />
            <span className={cn(
              isMobile ? "leading-tight font-medium text-xs" : "font-medium",
            )}>Photos</span>
          </TabsTrigger>
          <TabsTrigger 
            value="location" 
            data-testid="tab-location"
            className={cn(
              "flex items-center justify-center rounded-xl transition-all duration-300 hover-lift",
              isMobile ? "flex-col gap-1 h-16 text-xs p-2" : "flex-row gap-2 h-12",
              "data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg"
            )}
          >
            <MapPin className={cn(
              isMobile ? "w-4 h-4" : "w-4 h-4"
            )} />
            <span className={cn(
              isMobile ? "leading-tight font-medium text-xs" : "font-medium",
            )}>Location</span>
          </TabsTrigger>
          <TabsTrigger 
            value="privacy" 
            data-testid="tab-privacy"
            className={cn(
              "flex items-center justify-center rounded-xl transition-all duration-300 hover-lift",
              isMobile ? "flex-col gap-1 h-16 text-xs p-2" : "flex-row gap-2 h-12",
              "data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg"
            )}
          >
            <Lock className={cn(
              isMobile ? "w-4 h-4" : "w-4 h-4"
            )} />
            <span className={cn(
              isMobile ? "leading-tight font-medium text-xs" : "font-medium",
            )}>Privacy</span>
          </TabsTrigger>
          <TabsTrigger 
            value="notifications" 
            data-testid="tab-notifications"
            className={cn(
              "flex items-center justify-center rounded-xl transition-all duration-300 hover-lift",
              isMobile ? "flex-col gap-1 h-16 text-xs p-2" : "flex-row gap-2 h-12",
              "data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg"
            )}
          >
            <Bell className={cn(
              isMobile ? "w-4 h-4" : "w-4 h-4"
            )} />
            <span className={cn(
              isMobile ? "leading-tight font-medium text-xs" : "font-medium",
            )}>Notifications</span>
          </TabsTrigger>
          <TabsTrigger 
            value="blocked" 
            data-testid="tab-blocked"
            className={cn(
              "flex items-center justify-center rounded-xl transition-all duration-300 hover-lift",
              isMobile ? "flex-col gap-1 h-16 text-xs p-2" : "flex-row gap-2 h-12",
              "data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg"
            )}
          >
            <Shield className={cn(
              isMobile ? "w-4 h-4" : "w-4 h-4"
            )} />
            <span className={cn(
              isMobile ? "leading-tight font-medium text-xs text-center" : "font-medium",
            )}>Blocked</span>
          </TabsTrigger>
          <TabsTrigger 
            value="filters" 
            data-testid="tab-filters"
            className={cn(
              "flex items-center justify-center rounded-xl transition-all duration-300 hover-lift",
              isMobile ? "flex-col gap-1 h-16 text-xs p-2" : "flex-row gap-2 h-12",
              "data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg"
            )}
          >
            <Users className={cn(
              isMobile ? "w-4 h-4" : "w-4 h-4"
            )} />
            <span className={cn(
              isMobile ? "leading-tight font-medium text-xs text-center" : "font-medium",
            )}>Filters</span>
          </TabsTrigger>
          <TabsTrigger 
            value="account" 
            data-testid="tab-account"
            className={cn(
              "flex items-center justify-center rounded-xl transition-all duration-300 hover-lift",
              isMobile ? "flex-col gap-1 h-16 text-xs p-2" : "flex-row gap-2 h-12",
              "data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg"
            )}
          >
            <Trash2 className={cn(
              isMobile ? "w-4 h-4" : "w-4 h-4"
            )} />
            <span className={cn(
              isMobile ? "leading-tight font-medium text-xs text-center" : "font-medium",
            )}>Account</span>
          </TabsTrigger>
          <TabsTrigger 
            value="gdpr" 
            data-testid="tab-gdpr"
            className={cn(
              "flex items-center justify-center rounded-xl transition-all duration-300 hover-lift",
              isMobile ? "flex-col gap-1 h-16 text-xs p-2" : "flex-row gap-2 h-12",
              "data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg"
            )}
          >
            <Shield className={cn(
              isMobile ? "w-4 h-4" : "w-4 h-4"
            )} />
            <span className={cn(
              isMobile ? "leading-tight font-medium text-xs text-center" : "font-medium",
            )}>GDPR</span>
          </TabsTrigger>
        </TabsList>

        <div className={cn(
          isMobile ? "mt-4" : "mt-6"
        )}>
          <TabsContent value="profile" className={cn(
            isMobile ? "space-y-4" : "space-y-6"
          )}>
            <BasicProfileSettings 
              user={profileSettings.user}
              isMobile={isMobile}
            />
          </TabsContent>
          <TabsContent value="photos" className={cn(
            isMobile ? "space-y-4" : "space-y-6"
          )}>
            <Card className={cn(
              isMobile && "mx-0"
            )}>
              <CardHeader className={cn(
                isMobile && "p-4 pb-3"
              )}>
                <CardTitle className={cn(
                  isMobile ? "text-lg" : ""
                )}>Photo Management</CardTitle>
                <CardDescription className={cn(
                  isMobile ? "text-sm" : ""
                )}>
                  Upload and manage your profile photos. Set a primary photo that others will see.
                </CardDescription>
              </CardHeader>
              <CardContent className={cn(
                isMobile && "p-4 pt-0"
              )}>
                <PhotoManager 
                  userId={currentUser?.id || ''}
                  photos={profileSettings?.photos || []}
                  primaryPhoto={profileSettings?.primaryPhoto}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="location" className={cn(
            isMobile ? "space-y-4" : "space-y-6"
          )}>
            <Card className={cn(
              isMobile && "mx-0"
            )}>
              <CardHeader className={cn(
                isMobile && "p-4 pb-3"
              )}>
                <CardTitle className={cn(
                  isMobile ? "text-lg" : ""
                )}>Location Settings</CardTitle>
                <CardDescription className={cn(
                  isMobile ? "text-sm" : ""
                )}>
                  Update your location information to connect with nearby users.
                </CardDescription>
              </CardHeader>
              <CardContent className={cn(
                isMobile && "p-4 pt-0"
              )}>
                <LocationSettings 
                  user={profileSettings?.user || currentUser}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="privacy" className={cn(
            isMobile ? "space-y-4" : "space-y-6"
          )}>
            <PrivacySettings 
              user={profileSettings.user}
              isMobile={isMobile}
            />
          </TabsContent>
          
          <TabsContent value="notifications" className={cn(
            isMobile ? "space-y-4" : "space-y-6"
          )}>
            <NotificationPreferences 
              user={profileSettings.user}
              isMobile={isMobile}
            />
          </TabsContent>

          <TabsContent value="blocked" className={cn(
            isMobile ? "space-y-4" : "space-y-6"
          )}>
            <Card className={cn(
              isMobile && "mx-0"
            )}>
              <CardHeader className={cn(
                isMobile && "p-4 pb-3"
              )}>
                <CardTitle className={cn(
                  isMobile ? "text-lg" : ""
                )}>Blocked Users</CardTitle>
                <CardDescription className={cn(
                  isMobile ? "text-sm" : ""
                )}>
                  Manage users you've blocked. Blocked users cannot send you messages.
                </CardDescription>
              </CardHeader>
              <CardContent className={cn(
                isMobile && "p-4 pt-0"
              )}>
                <BlockedUsers 
                  userId={currentUser?.id || ''}
                  blockedUsers={profileSettings?.blockedUsers || []}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="filters" className={cn(
            isMobile ? "space-y-4" : "space-y-6"
          )}>
            <Card className={cn(
              isMobile && "mx-0"
            )}>
              <CardHeader className={cn(
                isMobile && "p-4 pb-3"
              )}>
                <CardTitle className={cn(
                  isMobile ? "text-lg" : ""
                )}>Contact Filters</CardTitle>
                <CardDescription className={cn(
                  isMobile ? "text-sm" : ""
                )}>
                  Control who can contact you based on your preferences.
                </CardDescription>
              </CardHeader>
              <CardContent className={cn(
                isMobile && "p-4 pt-0"
              )}>
                <ContactFilters 
                  user={profileSettings?.user || currentUser}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="account" className={cn(
            isMobile ? "space-y-4" : "space-y-6"
          )}>
            <AccountDeletion 
              user={profileSettings.user}
              isMobile={isMobile}
            />
          </TabsContent>
          <TabsContent value="gdpr" className={cn(
            isMobile ? "space-y-4" : "space-y-6"
          )}>
            <GDPRCompliance 
              user={profileSettings.user}
              isMobile={isMobile}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}