import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Camera, Trash2, Star, StarOff, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { UserPhoto } from '@shared/schema';
import type { UploadResult } from '@uppy/core';
// Using built-in file input for now
// import { ObjectUploader } from '@/components/chat/object-uploader';

interface PhotoManagerProps {
  userId: string;
  photos: UserPhoto[];
  primaryPhoto?: UserPhoto;
}

export default function PhotoManager({ userId, photos, primaryPhoto }: PhotoManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploadingPhotos, setUploadingPhotos] = useState<string[]>([]);

  const setPrimaryMutation = useMutation({
    mutationFn: async (photoId: string) => {
      await apiRequest(`/api/users/${userId}/photos/${photoId}/primary`, {
        method: 'PUT',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Primary photo updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}/profile-settings`] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to set primary photo",
        variant: "destructive",
      });
    },
  });

  const deletePhotoMutation = useMutation({
    mutationFn: async (photoId: string) => {
      await apiRequest(`/api/users/${userId}/photos/${photoId}`, {
        method: 'DELETE',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Photo deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}/profile-settings`] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete photo",
        variant: "destructive",
      });
    },
  });

  const handlePhotoUpload = async () => {
    try {
      const response = await apiRequest('/api/photos/upload-url', {
        method: 'POST',
        body: JSON.stringify({ fileName: `photo-${Date.now()}.jpg` }),
        headers: { 'Content-Type': 'application/json' },
      }) as any;
      return {
        method: 'PUT' as const,
        url: response.uploadURL,
      };
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to get upload URL",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handlePhotoUploadComplete = async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    try {
      const uploadedFile = result.successful?.[0];
      if (uploadedFile?.uploadURL) {
        setUploadingPhotos(prev => [...prev, uploadedFile.uploadURL]);
        
        await apiRequest(`/api/users/${userId}/photos`, {
          method: 'POST',
          body: JSON.stringify({
            photoUrl: uploadedFile.uploadURL,
            fileName: uploadedFile.name,
            isPrimary: photos.length === 0, // First photo becomes primary
          }),
          headers: { 'Content-Type': 'application/json' },
        });

        toast({
          title: "Success",
          description: "Photo uploaded successfully",
        });
        
        queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}/profile-settings`] });
        setUploadingPhotos(prev => prev.filter(url => url !== uploadedFile.uploadURL));
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save photo",
        variant: "destructive",
      });
      setUploadingPhotos([]);
    }
  };

  const getPhotoSrc = (photo: UserPhoto) => {
    return photo.photoUrl.startsWith('http') ? photo.photoUrl : `/photos${photo.photoUrl}`;
  };

  return (
    <div className="space-y-6" data-testid="photo-manager">
      {/* Upload Button */}
      <div className="flex justify-center">
        <Button className="border-2 border-dashed border-gray-300 hover:border-primary p-8 rounded-lg transition-colors">
          <div className="text-center">
            <Plus className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-600">Add New Photo</p>
            <p className="text-xs text-gray-400">Feature coming soon</p>
          </div>
        </Button>
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