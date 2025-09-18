import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useResponsive } from '@/hooks/use-responsive';
import { cn } from '@/lib/utils';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';

import { 
  MessageSquare, 
  Plus, 
  Trash2, 
  Users, 
  Lock, 
  Globe, 
  AlertTriangle 
} from 'lucide-react';

import type { Room } from '@shared/schema';

// Create room form schema
const createRoomSchema = z.object({
  name: z.string().min(1, 'Room name is required').max(100, 'Room name must be less than 100 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  isPrivate: z.boolean().default(false),
});

type CreateRoomInput = z.infer<typeof createRoomSchema>;

interface ChatroomManagementProps {
  className?: string;
}

export default function ChatroomManagement({ className }: ChatroomManagementProps) {
  const { isMobile, isTablet } = useResponsive();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<Room | null>(null);

  // Fetch rooms
  const { data: roomsData, isLoading } = useQuery({
    queryKey: ['/api/admin/rooms'],
    queryFn: async () => {
      const response = await fetch('/api/admin/rooms');
      if (!response.ok) throw new Error('Failed to fetch rooms');
      return response.json();
    },
  });

  const rooms = roomsData?.rooms || [];

  // Create room form
  const form = useForm<CreateRoomInput>({
    resolver: zodResolver(createRoomSchema),
    defaultValues: {
      name: '',
      description: '',
      isPrivate: false,
    },
  });

  // Create room mutation
  const createRoomMutation = useMutation({
    mutationFn: async (data: CreateRoomInput) => {
      return apiRequest('/api/admin/rooms', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rooms'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rooms'] }); // Also invalidate public rooms
      toast({
        title: 'Room created',
        description: `${data.room.name} has been created successfully`,
      });
      setIsCreateDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to create room',
        description: error.message || 'An error occurred while creating the room',
        variant: 'destructive',
      });
    },
  });

  // Delete room mutation
  const deleteRoomMutation = useMutation({
    mutationFn: async (roomId: string) => {
      return apiRequest(`/api/admin/rooms/${roomId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: (data, roomId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rooms'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rooms'] });
      toast({
        title: 'Room deleted',
        description: 'The room has been deleted successfully',
      });
      setRoomToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to delete room',
        description: error.message || 'An error occurred while deleting the room',
        variant: 'destructive',
      });
    },
  });

  const handleCreateRoom = (data: CreateRoomInput) => {
    createRoomMutation.mutate(data);
  };

  const handleDeleteRoom = () => {
    if (roomToDelete) {
      deleteRoomMutation.mutate(roomToDelete.id);
    }
  };

  if (isLoading) {
    return (
      <div className={cn("p-6", className)}>
        <div className="text-center text-slate-400">Loading chatrooms...</div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={cn(
            "font-bold text-white",
            isMobile ? "text-xl" : "text-2xl"
          )}>
            Chatroom Management
          </h2>
          <p className={cn(
            "text-slate-400",
            isMobile ? "text-sm" : "text-base"
          )}>
            Manage public and private chatrooms
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button
              size={isMobile ? "sm" : "default"}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="button-create-room"
            >
              <Plus className={cn(
                "mr-2",
                isMobile ? "w-3 h-3" : "w-4 h-4"
              )} />
              {isMobile ? "Add Room" : "Create Room"}
            </Button>
          </DialogTrigger>
          <DialogContent className={cn(
            "bg-slate-800 border-slate-700 text-white",
            isMobile ? "max-w-[95vw]" : "max-w-md"
          )}>
            <DialogHeader>
              <DialogTitle>Create New Room</DialogTitle>
              <DialogDescription className="text-slate-400">
                Create a new public or private chatroom
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleCreateRoom)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Room Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter room name"
                          {...field}
                          className="bg-slate-700 border-slate-600 text-white"
                          data-testid="input-room-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter room description"
                          {...field}
                          className="bg-slate-700 border-slate-600 text-white"
                          data-testid="input-room-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isPrivate"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-room-private"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Private Room</FormLabel>
                        <FormDescription className="text-slate-400 text-sm">
                          Private rooms require invitation to join
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                    disabled={createRoomMutation.isPending}
                    data-testid="button-cancel-create"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createRoomMutation.isPending}
                    data-testid="button-confirm-create"
                  >
                    {createRoomMutation.isPending ? 'Creating...' : 'Create Room'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className={cn(
        "grid gap-4",
        isMobile ? "grid-cols-2" : isTablet ? "grid-cols-3" : "grid-cols-4"
      )}>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className={cn(
            "flex items-center space-x-3",
            isMobile ? "p-4" : "p-6"
          )}>
            <div className="bg-blue-600 p-2 rounded-lg">
              <MessageSquare className={cn(
                "text-white",
                isMobile ? "w-4 h-4" : "w-5 h-5"
              )} />
            </div>
            <div>
              <p className={cn(
                "font-bold text-white",
                isMobile ? "text-lg" : "text-2xl"
              )}>{rooms.length}</p>
              <p className={cn(
                "text-slate-400",
                isMobile ? "text-xs" : "text-sm"
              )}>Total Rooms</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className={cn(
            "flex items-center space-x-3",
            isMobile ? "p-4" : "p-6"
          )}>
            <div className="bg-green-600 p-2 rounded-lg">
              <Globe className={cn(
                "text-white",
                isMobile ? "w-4 h-4" : "w-5 w-5"
              )} />
            </div>
            <div>
              <p className={cn(
                "font-bold text-white",
                isMobile ? "text-lg" : "text-2xl"
              )}>{rooms.filter(room => !room.isPrivate).length}</p>
              <p className={cn(
                "text-slate-400",
                isMobile ? "text-xs" : "text-sm"
              )}>Public</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className={cn(
            "flex items-center space-x-3",
            isMobile ? "p-4" : "p-6"
          )}>
            <div className="bg-orange-600 p-2 rounded-lg">
              <Lock className={cn(
                "text-white",
                isMobile ? "w-4 h-4" : "w-5 w-5"
              )} />
            </div>
            <div>
              <p className={cn(
                "font-bold text-white",
                isMobile ? "text-lg" : "text-2xl"
              )}>{rooms.filter(room => room.isPrivate).length}</p>
              <p className={cn(
                "text-slate-400",
                isMobile ? "text-xs" : "text-sm"
              )}>Private</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rooms List */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">All Chatrooms</CardTitle>
          <CardDescription className="text-slate-400">
            Manage existing public and private chatrooms
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rooms.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No chatrooms found</p>
              <p className="text-slate-500 text-sm">Create your first chatroom to get started</p>
            </div>
          ) : (
            <div className={cn(
              "grid gap-4",
              isMobile ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"
            )}>
              {rooms.map((room: Room) => (
                <Card key={room.id} className="bg-slate-700 border-slate-600" data-testid={`room-card-${room.id}`}>
                  <CardContent className={cn(
                    "flex items-center justify-between",
                    isMobile ? "p-4" : "p-4"
                  )}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className={cn(
                          "font-semibold text-white truncate",
                          isMobile ? "text-sm" : "text-base"
                        )}>{room.name}</h3>
                        {room.isPrivate ? (
                          <Lock className="w-4 h-4 text-orange-400" />
                        ) : (
                          <Globe className="w-4 h-4 text-green-400" />
                        )}
                      </div>
                      {room.description && (
                        <p className={cn(
                          "text-slate-400 truncate",
                          isMobile ? "text-xs" : "text-sm"
                        )}>{room.description}</p>
                      )}
                      <p className={cn(
                        "text-slate-500",
                        isMobile ? "text-xs" : "text-xs"
                      )}>
                        Created {room.createdAt ? new Date(room.createdAt).toLocaleDateString() : 'Unknown'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size={isMobile ? "sm" : "sm"}
                      onClick={() => setRoomToDelete(room)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                      data-testid={`button-delete-room-${room.id}`}
                    >
                      <Trash2 className={cn(
                        isMobile ? "w-3 h-3" : "w-4 h-4"
                      )} />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!roomToDelete} onOpenChange={(open) => !open && setRoomToDelete(null)}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span>Delete Room</span>
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to delete "{roomToDelete?.name}"? This action cannot be undone and will permanently remove all messages in this room.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => setRoomToDelete(null)}
              disabled={deleteRoomMutation.isPending}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteRoom}
              disabled={deleteRoomMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteRoomMutation.isPending ? 'Deleting...' : 'Delete Room'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}