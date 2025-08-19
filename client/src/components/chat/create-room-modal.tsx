import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { User } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onSuccess?: (room: any) => void;
}

export default function CreateRoomModal({
  isOpen,
  onClose,
  currentUser,
  onSuccess,
}: CreateRoomModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createRoomMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; isPrivate: boolean; createdBy: string }) => {
      const response = await apiRequest('POST', '/api/rooms', data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create room');
      }
      return response;
    },
    onSuccess: async (response) => {
      const data = await response.json();
      
      // Add user to the new room
      await apiRequest('POST', `/api/rooms/${data.room.id}/join`, {
        userId: currentUser.id,
      });
      
      // Invalidate rooms query to refetch
      queryClient.invalidateQueries({ queryKey: ['/api/rooms'] });
      if (isPrivate) {
        queryClient.invalidateQueries({ queryKey: ['/api/chat-data', currentUser.id] });
      }
      
      toast({
        title: 'Room Created Successfully',
        description: `${isPrivate ? 'Private' : 'Public'} room "${name}" has been created. ${isPrivate ? 'Only invited members can join.' : 'Anyone can join this room.'}`,
      });
      
      // Call onSuccess callback if provided
      if (onSuccess && data.room) {
        onSuccess(data.room);
      }
      
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Create Room',
        description: error.message.includes('already exists') 
          ? `A room with the name "${name}" already exists. Please choose a different name.`
          : error.message || 'Something went wrong while creating the room. Please check your connection and try again.',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({
        title: 'Error',
        description: 'Room name is required',
        variant: 'destructive',
      });
      return;
    }
    
    createRoomMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      isPrivate,
      createdBy: currentUser.id,
    });
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setIsPrivate(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" data-testid="create-room-modal">
        <DialogHeader>
          <DialogTitle>Create New Room</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="room-name">Room Name</Label>
            <Input
              id="room-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter room name"
              required
              data-testid="input-room-name"
            />
          </div>
          
          <div>
            <Label htmlFor="room-description">Description (Optional)</Label>
            <Textarea
              id="room-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the room"
              rows={3}
              data-testid="input-room-description"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="private-room"
              checked={isPrivate}
              onCheckedChange={(checked) => setIsPrivate(checked as boolean)}
              data-testid="checkbox-private-room"
            />
            <Label htmlFor="private-room">Private room</Label>
          </div>
          
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={createRoomMutation.isPending}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createRoomMutation.isPending}
              data-testid="button-create"
            >
              {createRoomMutation.isPending ? 'Creating...' : 'Create Room'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
