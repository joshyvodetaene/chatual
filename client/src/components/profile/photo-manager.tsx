import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Camera, Trash2, Star, StarOff, Plus, Upload } from 'lucide-react';
import { ObjectUploader } from '@/components/ObjectUploader';
import type { UploadResult } from '@uppy/core';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { UserPhoto } from '@shared/schema';
import { Dialog, DialogContent, DialogFooter, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface PhotoManagerProps {
  userId: string;
  photos: UserPhoto[];
  primaryPhoto?: UserPhoto;
}

export default function PhotoManager({ userId, photos, primaryPhoto }: PhotoManagerProps) {
  console.log(`[PHOTO_MANAGER] PhotoManager rendered for user: ${userId}`);
  console.log(`[PHOTO_MANAGER] Photos count: ${photos?.length || 0}, primaryPhoto: ${primaryPhoto?.id}`);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploadingPhotos, setUploadingPhotos] = useState<string[]>([]);

  const setPrimaryMutation = useMutation({
    mutationFn: async (photoId: string) => {
      console.log(`[PHOTO_MANAGER] Setting primary photo: ${photoId} for user: ${userId}`);
      const response = await apiRequest('PUT', `/api/users/${userId}/photos/${photoId}/primary`, {});
      console.log(`[PHOTO_MANAGER] Set primary photo response status: ${response.status}`);
      return response;
    },
    onSuccess: () => {
      console.log(`[PHOTO_MANAGER] Primary photo updated successfully`);
      toast({
        title: "Success",
        description: "Primary photo updated successfully",
      });
      // Invalidate all queries that might contain user avatar data
      console.log(`[PHOTO_MANAGER] Invalidating user avatar queries`);
      queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}/profile-settings`] });
      queryClient.invalidateQueries({ queryKey: ['/api/chat-data'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rooms'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      // Force refresh of localStorage user data if this is the current user
      const currentUser = localStorage.getItem('chatual_user');
      if (currentUser) {
        const user = JSON.parse(currentUser);
        if (user.id === userId) {
          console.log(`[PHOTO_MANAGER] Refreshing localStorage user data`);
          // Update localStorage with fresh user data
          queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}`] });
        }
      }
    },
    onError: (error) => {
      console.error(`[PHOTO_MANAGER] Error setting primary photo:`, error);
      toast({
        title: "Error",
        description: "Failed to set primary photo",
        variant: "destructive",
      });
    },
  });

  const deletePhotoMutation = useMutation({
    mutationFn: async (photoId: string) => {
      console.log(`[PHOTO_MANAGER] Deleting photo: ${photoId} for user: ${userId}`);
      const response = await apiRequest('DELETE', `/api/users/${userId}/photos/${photoId}`);
      console.log(`[PHOTO_MANAGER] Delete photo response status: ${response.status}`);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Photo deleted successfully",
      });
      // Invalidate all queries that might contain user avatar data
      queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}/profile-settings`] });
      queryClient.invalidateQueries({ queryKey: ['/api/chat-data'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rooms'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      // Force refresh of localStorage user data if this is the current user
      const currentUser = localStorage.getItem('chatual_user');
      if (currentUser) {
        const user = JSON.parse(currentUser);
        if (user.id === userId) {
          // Update localStorage with fresh user data
          queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}`] });
        }
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete photo",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Error",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10485760) { // 10MB
      toast({
        title: "Error",
        description: "Image must be less than 10MB",
        variant: "destructive",
      });
      return;
    }

    try {
      // Get upload URL
      const response = await apiRequest('POST', '/api/photos/upload-url', { 
        fileName: file.name 
      });
      const data = await response.json();

      setUploadingPhotos(prev => [...prev, 'uploading']);

      // Upload file directly
      const uploadResponse = await fetch(data.uploadURL, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      // Save photo metadata with original filename
      await apiRequest('POST', `/api/users/${userId}/photos`, {
        photoUrl: data.uploadURL,
        fileName: file.name, // Keep original filename for display
        isPrimary: photos.length === 0,
      });

      toast({
        title: "Success",
        description: "Profile photo uploaded successfully",
      });

      // Invalidate all queries that might contain user avatar data
      queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}/profile-settings`] });
      queryClient.invalidateQueries({ queryKey: ['/api/chat-data'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rooms'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      // Force refresh of localStorage user data if this is the current user
      const currentUser = localStorage.getItem('chatual_user');
      if (currentUser) {
        const user = JSON.parse(currentUser);
        if (user.id === userId) {
          // Update localStorage with fresh user data
          queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}`] });
        }
      }
      setUploadingPhotos([]);

      // Reset file input
      event.target.value = '';
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to upload photo",
        variant: "destructive",
      });
      setUploadingPhotos([]);
      event.target.value = '';
    }
  };


  const getPhotoSrc = (photo: UserPhoto) => {
    // Construct proper photo URL for display
    return photo.photoUrl.startsWith('http') 
      ? photo.photoUrl 
      : photo.photoUrl.startsWith('/photos/') 
      ? photo.photoUrl  // Already has /photos/ prefix
      : `/photos${photo.photoUrl}`; // Add /photos/ prefix if missing
  };

  return (
    <div className="space-y-6" data-testid="photo-manager">
      {/* Upload Buttons */}
      <div className="flex justify-center gap-4">
        {/* Primary Upload Button */}
        <div className="relative">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            id="profile-photo-upload"
            data-testid="profile-photo-input"
          />
          <Button 
            asChild
            className="bg-primary text-white hover:bg-primary/90 px-6 py-3"
            data-testid="upload-profile-photo-button"
          >
            <label htmlFor="profile-photo-upload" className="cursor-pointer">
              <Upload className="w-5 h-5 mr-2" />
              Upload Profile Photo
            </label>
          </Button>
        </div>

        {/* Alternative dashed button */}
        <div className="relative">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            id="add-photo-upload"
            data-testid="add-photo-input"
          />
          <Button 
            variant="outline"
            className="border-2 border-dashed border-gray-300 hover:border-primary p-6 rounded-lg transition-colors bg-transparent hover:bg-primary/5"
            data-testid="add-photo-button"
            asChild
          >
            <label htmlFor="add-photo-upload" className="cursor-pointer">
              <div className="text-center">
                <Plus className="w-6 h-6 mx-auto mb-1 text-gray-500" />
                <p className="text-sm text-gray-700">Add Photo</p>
              </div>
            </label>
          </Button>
        </div>
      </div>

      {/* Photos Grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {photos.map((photo) => (
            <Card key={photo.id} className="relative overflow-hidden group">
              <div className="aspect-square relative">
                <img
                  src={getPhotoSrc(photo)}
                  alt={photo.fileName}
                  className="w-full h-full object-cover"
                  data-testid={`photo-${photo.id}`}
                />

                {/* Primary Photo Badge */}
                {photo.isPrimary && (
                  <Badge 
                    variant="default" 
                    className="absolute top-2 left-2 bg-primary text-white"
                    data-testid={`badge-primary-${photo.id}`}
                  >
                    <Star className="w-3 h-3 mr-1" />
                    Primary
                  </Badge>
                )}

                {/* Action Buttons */}
                <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                  {!photo.isPrimary && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setPrimaryMutation.mutate(photo.id)}
                      disabled={setPrimaryMutation.isPending}
                      data-testid={`button-set-primary-${photo.id}`}
                    >
                      <Star className="w-4 h-4" />
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deletePhotoMutation.mutate(photo.id)}
                    disabled={deletePhotoMutation.isPending}
                    data-testid={`button-delete-${photo.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Uploading Photos */}
      {uploadingPhotos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {uploadingPhotos.map((url) => (
            <Card key={url} className="relative overflow-hidden">
              <div className="aspect-square relative">
                <div className="w-full h-full bg-gray-200 animate-pulse flex items-center justify-center">
                  <Camera className="w-8 h-8 text-gray-400" />
                </div>
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                  <div className="text-white text-sm">Uploading...</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {photos.length === 0 && uploadingPhotos.length === 0 && (
        <div className="text-center py-12" data-testid="no-photos">
          <Camera className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No photos yet</h3>
          <p className="text-gray-500 mb-6">Add your first photo to get started</p>
        </div>
      )}
    </div>
  );
}