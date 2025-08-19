import { useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { User, UserPhoto } from '@shared/schema';
import { BackButton } from '@/components/ui/back-button';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, MapPin, Calendar, Camera, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useResponsive } from '@/hooks/use-responsive';

export default function UserProfilePage() {
  const [, params] = useRoute('/profile/:userId');
  const { toast } = useToast();
  const [isBlocked, setIsBlocked] = useState(false);
  const { isMobile, isTablet } = useResponsive();

  const { data: currentUserData } = useQuery<{ user: User }>({
    queryKey: ['/api/auth/user'],
  });

  const { data: profileData, isLoading } = useQuery<{
    user: User;
    photos: UserPhoto[];
    primaryPhoto?: UserPhoto;
  }>({
    queryKey: ['/api/users', params?.userId, 'profile-settings'],
    enabled: !!params?.userId,
  });

  const blockUserMutation = useMutation({
    mutationFn: async (blockedId: string) => {
      return await apiRequest('POST', `/api/users/${currentUserData?.user.id}/blocked-users`, {
        blockedId,
        reason: 'Blocked from profile view',
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User has been blocked",
      });
      setIsBlocked(true);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to block user",
        variant: "destructive",
      });
    },
  });

  const handleStartPrivateChat = async () => {
    if (!currentUserData?.user.id || !profileData?.user.id) return;

    try {
      const response = await apiRequest('POST', '/api/private-chat/create', {
        user1Id: currentUserData.user.id,
        user2Id: profileData.user.id,
      });
      await response.json(); // Parse the response
      
      // Navigate back to chat
      window.location.href = '/';
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start private chat",
        variant: "destructive",
      });
    }
  };

  const handleBlockUser = () => {
    if (!profileData?.user.id) return;
    blockUserMutation.mutate(profileData.user.id);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className={cn(
            "mt-2 text-gray-600",
            isMobile ? "text-sm" : ""
          )}>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profileData?.user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className={cn(
          "text-center",
          isMobile ? "mx-4" : ""
        )}>
          <h1 className={cn(
            "font-bold text-gray-900 mb-2",
            isMobile ? "text-xl" : "text-2xl"
          )}>User not found</h1>
          <p className={cn(
            "text-gray-600 mb-4",
            isMobile ? "text-sm" : ""
          )}>The user you're looking for doesn't exist or has been removed.</p>
          <BackButton />
        </div>
      </div>
    );
  }

  const user = profileData.user;
  const photos = profileData.photos || [];
  const primaryPhoto = profileData.primaryPhoto;
  const isOwnProfile = user.id === currentUserData?.user.id;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatAge = (dateOfBirth: string) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  };

  return (
    <div className="min-h-screen bg-gray-50" data-testid="user-profile-page">
      <div className="bg-white shadow-sm border-b">
        <div className={cn(
          "mx-auto py-4",
          isMobile ? "px-4" : "max-w-4xl px-4"
        )}>
          <BackButton />
        </div>
      </div>

      <div className={cn(
        "mx-auto",
        isMobile ? "px-4 py-6" : "max-w-4xl px-4 py-8"
      )}>
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {/* Header Section */}
          <div className={cn(
            "bg-gradient-to-r from-primary/10 to-primary/5",
            isMobile ? "p-6" : "p-8"
          )}>
            <div className={cn(
              "flex items-start",
              isMobile ? "space-x-4 flex-col space-y-4 space-x-0" : "space-x-6"
            )}>
              {/* Avatar */}
              <div className={cn(
                "relative",
                isMobile && "mx-auto"
              )}>
                <div className={cn(
                  "rounded-full overflow-hidden bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white font-bold",
                  isMobile ? "w-20 h-20 text-xl" : "w-24 h-24 text-2xl"
                )}>
                  {primaryPhoto ? (
                    <img 
                      src={primaryPhoto.photoUrl} 
                      alt={user.displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    getInitials(user.displayName)
                  )}
                </div>
                {user.isOnline && (
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 border-4 border-white rounded-full"></div>
                )}
              </div>

              {/* User Info */}
              <div className={cn(
                "flex-1 min-w-0",
                isMobile && "text-center"
              )}>
                <div className={cn(
                  "flex items-center mb-2",
                  isMobile ? "justify-center space-x-2 flex-wrap" : "space-x-3"
                )}>
                  <h1 className={cn(
                    "font-bold text-gray-900",
                    isMobile ? "text-2xl" : "text-3xl"
                  )} data-testid="profile-display-name">
                    {user.displayName}
                  </h1>
                  {user.role === 'admin' && (
                    <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                      <Shield className="w-3 h-3 mr-1" />
                      Admin
                    </Badge>
                  )}
                </div>
                <p className={cn(
                  "text-gray-600 mb-1",
                  isMobile ? "text-sm" : ""
                )}>@{user.username}</p>
                
                <div className={cn(
                  "flex items-center text-gray-500",
                  isMobile ? "flex-col space-y-2 text-xs" : "space-x-4 text-sm",
                  isMobile && "items-center"
                )}>
                  {user.location && (
                    <div className="flex items-center space-x-1">
                      <MapPin className={cn(
                        isMobile ? "w-3 h-3" : "w-4 h-4"
                      )} />
                      <span>{user.location}</span>
                    </div>
                  )}
                  
                  {user.age && (
                    <div className="flex items-center space-x-1">
                      <Calendar className={cn(
                        isMobile ? "w-3 h-3" : "w-4 h-4"
                      )} />
                      <span>{user.age} years old</span>
                    </div>
                  )}
                  
                  <div className={cn(
                    "px-2 py-1 rounded-full",
                    isMobile ? "text-xs" : "text-xs",
                    user.isOnline 
                      ? "bg-green-100 text-green-800" 
                      : "bg-gray-100 text-gray-600"
                  )}>
                    {user.isOnline ? 'Online' : 'Offline'}
                  </div>
                </div>
              </div>

              {/* Actions */}
              {!isOwnProfile && !isBlocked && (
                <div className={cn(
                  "flex",
                  isMobile ? "flex-col space-y-2 w-full" : "space-x-3"
                )}>
                  <Button 
                    onClick={handleStartPrivateChat} 
                    data-testid="button-send-message"
                    className={cn(
                      isMobile && "w-full"
                    )}
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Send Message
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    onClick={handleBlockUser}
                    disabled={blockUserMutation.isPending}
                    data-testid="button-block-user"
                    className={cn(
                      isMobile && "w-full"
                    )}
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    {blockUserMutation.isPending ? 'Blocking...' : 'Block'}
                  </Button>
                </div>
              )}

              {isBlocked && (
                <div className={cn(
                  "bg-red-50 border border-red-200 rounded-lg",
                  isMobile ? "p-3" : "p-4"
                )}>
                  <p className={cn(
                    "text-red-800",
                    isMobile ? "text-xs" : "text-sm"
                  )}>You have blocked this user</p>
                </div>
              )}
            </div>
          </div>

          {/* Bio Section */}
          {user.bio && (
            <div className={cn(
              "border-b",
              isMobile ? "p-6" : "p-8"
            )}>
              <h2 className={cn(
                "font-semibold text-gray-900 mb-3",
                isMobile ? "text-base" : "text-lg"
              )}>About</h2>
              <p className={cn(
                "text-gray-700 whitespace-pre-wrap",
                isMobile ? "text-sm" : ""
              )} data-testid="profile-bio">
                {user.bio}
              </p>
            </div>
          )}

          {/* Photos Section */}
          {photos.length > 0 && (
            <div className={cn(
              isMobile ? "p-6" : "p-8"
            )}>
              <h2 className={cn(
                "font-semibold text-gray-900 mb-4 flex items-center",
                isMobile ? "text-base" : "text-lg"
              )}>
                <Camera className={cn(
                  "mr-2",
                  isMobile ? "w-4 h-4" : "w-5 h-5"
                )} />
                Photos ({photos.length})
              </h2>
              
              <div className={cn(
                "grid gap-4",
                isMobile ? "grid-cols-2" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
              )}>
                {photos.map((photo) => (
                  <div 
                    key={photo.id}
                    className={cn(
                      "aspect-square rounded-lg overflow-hidden relative group cursor-pointer",
                      photo.isPrimary && "ring-2 ring-primary"
                    )}
                  >
                    <img 
                      src={photo.photoUrl} 
                      alt={photo.fileName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    {photo.isPrimary && (
                      <div className={cn(
                        "absolute top-2 right-2 bg-primary text-white px-2 py-1 rounded",
                        isMobile ? "text-xs" : "text-xs"
                      )}>
                        Primary
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}