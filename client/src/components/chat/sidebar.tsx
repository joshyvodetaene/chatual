import { User, Room, PrivateRoom } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { MessageCircle, Hash, Lock, Plus, Settings, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import SearchModal from '@/components/search/search-modal';

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
  // State für den aktiven Tab (Räume oder Private Chats)
  const [activeTab, setActiveTab] = useState<'rooms' | 'private'>('rooms');
  const [showSearch, setShowSearch] = useState(false);
  

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
      "w-full sm:w-60 md:w-64 lg:w-72 h-full bg-card/90 backdrop-blur-sm border-r border-primary/20 flex flex-col",
      className
    )} data-testid="sidebar">
      {/* Header-Bereich mit App-Logo und Raum-erstellen Button */}
      <div className="p-2 sm:p-3 md:p-4 lg:p-6 border-b border-primary/20 bg-primary text-white red-glow">
        <div className="flex items-center justify-between">
          {/* App-Logo und Name */}
          <div className="flex items-center space-x-2 sm:space-x-3 md:space-x-4 min-w-0 flex-1">
            {/* Chat-Icon */}
            <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 lg:w-10 lg:h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 lg:w-5 lg:h-5" />
            </div>
            {/* App-Name */}
            <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl font-semibold truncate">Chatual</h1>
          </div>
          {/* Search Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSearch(true)}
            className="h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 p-0 hover:bg-white/20 rounded-lg flex-shrink-0 ml-2"
            data-testid="button-open-search"
          >
            <Search className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" />
          </Button>
        </div>
      </div>

      {/* Benutzer-Profil Bereich */}
      <div className="p-3 sm:p-4 md:p-6 border-b border-primary/20 bg-card/60 backdrop-blur-sm">
        <div className="flex items-center space-x-2 sm:space-x-3 md:space-x-4">
          {/* Benutzer-Avatar */}
          {currentUser.primaryPhoto?.photoUrl ? (
            <img 
              src={currentUser.primaryPhoto.photoUrl}
              alt={`${currentUser.displayName} profile`}
              className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full object-cover border-2 border-white"
            />
          ) : (
            <div className={cn(
              "w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-white text-xs sm:text-sm md:text-base font-medium",
              getAvatarColor(currentUser.displayName)
            )}>
              {getInitials(currentUser.displayName)}
            </div>
          )}
          {/* Benutzer-Informationen */}
          <div className="flex-1 min-w-0">
            {/* Anzeigename */}
            <p className="text-xs sm:text-sm md:text-base font-medium text-white truncate">
              {currentUser.displayName}
            </p>
            {/* Benutzername mit @ Symbol */}
            <p className="text-xs sm:text-sm md:text-base text-gray-300 truncate">
              @{currentUser.username}
            </p>
          </div>
          
        </div>
      </div>

      {/* Tab-Navigation zwischen Räumen und privaten Chats */}
      <div className="px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-6">
        <div className={cn(
          "flex space-x-1 rounded-lg p-1",
          isMobile ? "bg-primary/20" : "bg-card/60 backdrop-blur-sm"
        )}>
          {/* Räume Tab */}
          <button
            className={cn(
              'flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-300 ease-in-out transform hover:scale-105 active:scale-95 hover:shadow-lg',
              activeTab === 'rooms'
                ? 'bg-primary text-white shadow-sm red-glow' // Aktiver Zustand
                : 'text-gray-300 hover:text-white hover:bg-white hover:bg-opacity-10 hover:shadow-md' // Inaktiver Zustand
            )}
            onClick={() => setActiveTab('rooms')}
            data-testid="tab-rooms"
          >
            Rooms
          </button>
          {/* Private Chats Tab */}
          <button
            className={cn(
              'flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-300 ease-in-out transform hover:scale-105 active:scale-95 hover:shadow-lg relative',
              activeTab === 'private'
                ? 'bg-primary text-white shadow-sm red-glow' // Aktiver Zustand
                : 'text-gray-300 hover:text-white hover:bg-white hover:bg-opacity-10 hover:shadow-md' // Inaktiver Zustand
            )}
            onClick={() => setActiveTab('private')}
            data-testid="tab-private"
          >
            Private
            {/* Badge for new private chats */}
            {privateRooms.length > 0 && activeTab !== 'private' && (
              <span className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold animate-pulse">
                {privateRooms.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Scrollbarer Inhaltsbereich */}
      <div className="flex-1 overflow-y-auto hide-scrollbar">
        <div className="p-3 sm:p-4 md:p-6">
          {/* Wenn Räume-Tab aktiv ist */}
          {activeTab === 'rooms' && (
            <>
              {/* Räume-Sektion Header */}
              <div className="flex items-center justify-between mb-2 sm:mb-3 md:mb-4">
                {/* Sektion-Titel */}
                <h2 className="text-xs sm:text-sm md:text-base font-semibold text-gray-300 uppercase tracking-wider">
                  Rooms
                </h2>
              </div>
              
              {/* Liste aller verfügbaren Räume */}
              <div className="space-y-1 sm:space-y-2 md:space-y-3">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className={cn(
                      "flex items-center space-x-2 sm:space-x-3 md:space-x-4 p-2 sm:p-3 md:p-4 rounded-lg cursor-pointer transition-colors",
                      activeRoom?.id === room.id
                        ? "bg-primary text-white red-glow" // Aktiver Raum hervorgehoben
                        : "hover:bg-white hover:bg-opacity-10 hover:text-white text-gray-300" // Hover-Effekt für inaktive Räume
                    )}
                    onClick={() => onRoomSelect(room)}
                    data-testid={`room-item-${room.id}`}
                  >
                    {/* Raum-Icon (öffentlich oder privat) */}
                    <div className={cn(
                      "w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center",
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
                        "text-xs sm:text-sm md:text-base font-medium truncate",
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
              <div className="flex items-center justify-between mb-2 sm:mb-3 md:mb-4">
                {/* Sektion-Titel */}
                <h2 className="text-xs sm:text-sm md:text-base font-semibold text-gray-300 uppercase tracking-wider">
                  Private Chats
                </h2>
              </div>
              
              {/* Liste aller privaten Chats */}
              <div className="space-y-1 sm:space-y-2 md:space-y-3">
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
                        "text-xs sm:text-sm md:text-base font-medium truncate",
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
      
      {/* Search Modal */}
      <SearchModal
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        onSelectRoom={onRoomSelect}
        onSelectUser={(user) => onStartPrivateChat(user.id)}
        currentUserId={currentUser?.id}
      />
    </div>
  );
}