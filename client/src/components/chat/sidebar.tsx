import { User, Room, PrivateRoom } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { MessageCircle, Hash, Lock, Plus, Settings, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface SidebarProps {
  currentUser: User;
  rooms: Room[];
  privateRooms: PrivateRoom[];
  activeRoom: Room | null;
  onRoomSelect: (room: Room) => void;
  onCreateRoom: () => void;
  onStartPrivateChat: (userId: string) => void;
  className?: string;
  isMobile?: boolean;
}

export default function Sidebar({
  currentUser,
  rooms,
  privateRooms,
  activeRoom,
  onRoomSelect,
  onCreateRoom,
  onStartPrivateChat,
  className,
  isMobile = false,
}: SidebarProps) {
  console.log(`[SIDEBAR] Sidebar rendered:`, {
    userId: currentUser?.id,
    roomCount: rooms?.length || 0,
    privateRoomCount: privateRooms?.length || 0,
    activeRoomId: activeRoom?.id,
    isMobile
  });
  // State für den aktiven Tab (Räume oder Private Chats)
  const [activeTab, setActiveTab] = useState<'rooms' | 'private'>('rooms');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const deletePrivateChatMutation = useMutation({
    mutationFn: async (roomId: string) => {
      console.log(`[SIDEBAR] Deleting private chat: ${roomId} for user: ${currentUser.id}`);
      const response = await apiRequest('DELETE', `/api/private-chat/${roomId}`, {
        userId: currentUser.id
      });
      console.log(`[SIDEBAR] Delete private chat response status: ${response.status}`);
      return response;
    },
    onSuccess: () => {
      console.log(`[SIDEBAR] Private chat deleted successfully`);
      toast({
        title: "Chat closed",
        description: "Private chat has been closed.",
      });
      // Refresh chat data
      console.log(`[SIDEBAR] Invalidating chat data queries`);
      queryClient.invalidateQueries({ queryKey: ['/api/chat-data', currentUser.id] });
    },
    onError: (error: any) => {
      console.error(`[SIDEBAR] Error deleting private chat:`, error);
      toast({
        title: "Error",
        description: error?.message || "Failed to close private chat",
        variant: "destructive",
      });
    },
  });
  
  const handleClosePrivateChat = (e: React.MouseEvent, roomId: string) => {
    e.stopPropagation(); // Prevent triggering the chat selection
    
    // If closing the currently active private chat, switch to general room
    if (activeRoom?.id === roomId) {
      const generalRoom = rooms.find(room => !room.isPrivate);
      if (generalRoom) {
        onRoomSelect(generalRoom);
      }
    }
    
    deletePrivateChatMutation.mutate(roomId);
  };

  // Hilfsfunktion: Erstellt Initialen aus dem Namen (z.B. "John Doe" → "JD")
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Hilfsfunktion: Wählt eine zufällige Farbe für Avatare basierend auf dem Namen
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-gradient-to-br from-blue-400 to-blue-600',
      'bg-gradient-to-br from-green-400 to-green-600',
      'bg-gradient-to-br from-purple-400 to-purple-600',
      'bg-gradient-to-br from-orange-400 to-orange-600',
      'bg-gradient-to-br from-pink-400 to-pink-600',
      'bg-gradient-to-br from-indigo-400 to-indigo-600',
    ];
    const hash = name.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  return (
    /* Haupt-Container der Sidebar */
    <div className={cn(
      "w-80 bg-card/90 backdrop-blur-sm border-r border-primary/20 flex flex-col",
      className
    )} data-testid="sidebar">
      {/* Header-Bereich mit App-Logo und Raum-erstellen Button */}
      <div className="p-4 border-b border-primary/20 bg-primary text-white red-glow">
        <div className="flex items-center justify-between">
          {/* App-Logo und Name */}
          <div className="flex items-center space-x-3">
            {/* Chat-Icon */}
            <div className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
              <MessageCircle className="w-4 h-4" />
            </div>
            {/* App-Name */}
            <h1 className="text-xl font-semibold">Chatual</h1>
          </div>
        </div>
      </div>

      {/* Benutzer-Profil Bereich */}
      <div className="p-4 border-b border-primary/20 bg-card/60 backdrop-blur-sm">
        <div className="flex items-center space-x-3">
          {/* Benutzer-Avatar */}
          {currentUser.primaryPhoto?.photoUrl ? (
            <img 
              src={currentUser.primaryPhoto.photoUrl}
              alt={`${currentUser.displayName} profile`}
              className="w-10 h-10 rounded-full object-cover border-2 border-white"
            />
          ) : (
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium",
              getAvatarColor(currentUser.displayName)
            )}>
              {getInitials(currentUser.displayName)}
            </div>
          )}
          {/* Benutzer-Informationen */}
          <div className="flex-1 min-w-0">
            {/* Anzeigename */}
            <p className="text-sm font-medium text-white truncate">
              {currentUser.displayName}
            </p>
            {/* Benutzername mit @ Symbol */}
            <p className="text-xs text-gray-300 truncate">
              @{currentUser.username}
            </p>
          </div>
          {/* Einstellungen-Button */}
          <Button variant="ghost" size="sm" className="text-white hover:bg-white hover:bg-opacity-10" data-testid="button-user-settings">
            <Settings className="w-4 h-4 text-white" />
          </Button>
        </div>
      </div>

      {/* Tab-Navigation zwischen Räumen und privaten Chats */}
      <div className="px-4 pt-4">
        <div className={cn(
          "flex space-x-1 rounded-lg p-1",
          isMobile ? "bg-primary/20" : "bg-card/60 backdrop-blur-sm"
        )}>
          {/* Räume Tab */}
          <button
            className={cn(
              'flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              activeTab === 'rooms'
                ? 'bg-primary text-white shadow-sm red-glow' // Aktiver Zustand
                : 'text-gray-300 hover:text-white hover:bg-white hover:bg-opacity-10' // Inaktiver Zustand
            )}
            onClick={() => setActiveTab('rooms')}
            data-testid="tab-rooms"
          >
            Rooms
          </button>
          {/* Private Chats Tab */}
          <button
            className={cn(
              'flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              activeTab === 'private'
                ? 'bg-primary text-white shadow-sm red-glow' // Aktiver Zustand
                : 'text-gray-300 hover:text-white hover:bg-white hover:bg-opacity-10' // Inaktiver Zustand
            )}
            onClick={() => setActiveTab('private')}
            data-testid="tab-private"
          >
            Private
          </button>
        </div>
      </div>

      {/* Scrollbarer Inhaltsbereich */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          {/* Wenn Räume-Tab aktiv ist */}
          {activeTab === 'rooms' && (
            <>
              {/* Räume-Sektion Header */}
              <div className="flex items-center justify-between mb-3">
                {/* Sektion-Titel */}
                <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Rooms
                </h2>
              </div>
              
              {/* Liste aller verfügbaren Räume */}
              <div className="space-y-1">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className={cn(
                      "flex items-center space-x-3 p-2 rounded-lg cursor-pointer transition-colors",
                      activeRoom?.id === room.id
                        ? "bg-primary text-white red-glow" // Aktiver Raum hervorgehoben
                        : "hover:bg-white hover:bg-opacity-10 hover:text-white text-gray-300" // Hover-Effekt für inaktive Räume
                    )}
                    onClick={() => onRoomSelect(room)}
                    data-testid={`room-item-${room.id}`}
                  >
                    {/* Raum-Icon (öffentlich oder privat) */}
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      activeRoom?.id === room.id
                        ? "bg-white bg-opacity-20"
                        : "bg-gray-100"
                    )}>
                      {room.isPrivate ? (
                        <Lock className={cn(
                          "w-3 h-3",
                          activeRoom?.id === room.id ? "text-white" : "text-gray-500"
                        )} />
                      ) : (
                        /* Hash-Icon für öffentliche Räume */
                        <Hash className={cn(
                          "w-3 h-3",
                          activeRoom?.id === room.id ? "text-white" : "text-gray-500"
                        )} />
                      )}
                    </div>
                    {/* Raum-Name */}
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-medium truncate",
                        activeRoom?.id === room.id ? "text-white" : "text-gray-300"
                      )}>
                        {room.name}
                      </p>
                    </div>
                    {/* Aktiver Raum-Indikator (kleiner Punkt) */}
                    {activeRoom?.id === room.id && (
                      <div className="w-2 h-2 bg-white bg-opacity-75 rounded-full"></div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          
          {/* Wenn Private-Chats-Tab aktiv ist */}
          {activeTab === 'private' && (
            <>
              {/* Private-Chats-Sektion Header */}
              <div className="flex items-center justify-between mb-3">
                {/* Sektion-Titel */}
                <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Private Chats
                </h2>
              </div>
              
              {/* Liste aller privaten Chats */}
              <div className="space-y-1">
                {privateRooms.map((privateRoom) => (
                  <div
                    key={privateRoom.id}
                    className={cn(
                      "group flex items-center space-x-3 p-2 rounded-lg cursor-pointer transition-colors relative",
                      activeRoom?.id === privateRoom.id
                        ? "bg-primary text-white red-glow" // Aktiver Chat hervorgehoben
                        : "hover:bg-white hover:bg-opacity-10 hover:text-white text-gray-300" // Hover-Effekt für inaktive Chats
                    )}
                    onClick={() => {
                      // Erstellt ein Room-Objekt für den privaten Chat
                      const room: Room = {
                        id: privateRoom.id,
                        name: privateRoom.participant2.displayName,
                        description: 'Private chat',
                        isPrivate: true,
                        memberIds: null,
                        createdBy: privateRoom.participant1Id,
                        createdAt: new Date(),
                      };
                      onRoomSelect(room);
                    }}
                    data-testid={`private-chat-${privateRoom.participant2.username}`}
                  >
                    <div className="relative">
                      {/* Avatar des Chat-Partners */}
                      {privateRoom.participant2.primaryPhoto?.photoUrl ? (
                        <img 
                          src={privateRoom.participant2.primaryPhoto.photoUrl}
                          alt={`${privateRoom.participant2.displayName} profile`}
                          className="w-8 h-8 rounded-full object-cover border-2 border-white"
                        />
                      ) : (
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium",
                          getAvatarColor(privateRoom.participant2.displayName)
                        )}>
                          {getInitials(privateRoom.participant2.displayName)}
                        </div>
                      )}
                      {/* Online-Status-Indikator */}
                      <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-accent border-2 border-white rounded-full"></div>
                    </div>
                    {/* Chat-Partner Informationen */}
                    <div className="flex-1 min-w-0">
                      {/* Name des Chat-Partners */}
                      <p className={cn(
                        "text-sm font-medium truncate",
                        activeRoom?.id === privateRoom.id ? "text-white" : "text-gray-300"
                      )}>
                        {privateRoom.participant2.displayName}
                      </p>
                      {/* Chat-Typ Beschreibung */}
                      <p className={cn(
                        "text-xs truncate",
                        activeRoom?.id === privateRoom.id ? "text-white text-opacity-70" : "text-gray-400"
                      )}>
                        Private chat
                      </p>
                    </div>
                    {/* Close Button */}
                    <button
                      onClick={(e) => handleClosePrivateChat(e, privateRoom.id)}
                      className={cn(
                        "opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-red-500 hover:text-white",
                        activeRoom?.id === privateRoom.id
                          ? "text-white hover:bg-red-500"
                          : "text-gray-400 hover:bg-red-500 hover:text-white",
                        deletePrivateChatMutation.isPending && "opacity-50 cursor-not-allowed"
                      )}
                      disabled={deletePrivateChatMutation.isPending}
                      data-testid={`close-private-chat-${privateRoom.id}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                
                {/* Leerzustand wenn keine privaten Chats vorhanden */}
                {privateRooms.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <p className="text-sm">No private chats yet</p>
                    <p className="text-xs mt-1">Click on a user to start chatting</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}