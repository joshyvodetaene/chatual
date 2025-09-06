import { Room } from '@shared/schema';
import { useCursorPagination } from '@/hooks/use-cursor-pagination';
import { InfiniteScroll } from '@/components/ui/infinite-scroll';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageCircle, Users } from 'lucide-react';

export interface PaginatedRoomListProps {
  className?: string;
  onRoomClick?: (room: Room) => void;
}

export function PaginatedRoomList({ 
  className = '',
  onRoomClick 
}: PaginatedRoomListProps) {
  const {
    items: rooms,
    hasMorePages,
    isInitialLoading,
    isLoadingMore,
    error,
    loadMoreItems,
    refresh
  } = useCursorPagination<Room>({
    queryKey: ['/api/rooms'],
    pageSize: 20,
    enabled: true,
    staleTime: 60000 // 1 minute for rooms
  });

  if (error) {
    return (
      <div className="text-center py-8" data-testid="room-list-error">
        <p className="text-red-500 mb-4">Failed to load rooms</p>
        <button 
          onClick={refresh}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          data-testid="button-retry"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (isInitialLoading) {
    return (
      <div className={`space-y-4 ${className}`} data-testid="room-list-loading">
        {Array.from({ length: 5 }).map((_, i) => (
          <RoomListItemSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500" data-testid="room-list-empty">
        <MessageCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p>No chat rooms available</p>
        <p className="text-sm mt-2">Create a new room to get started!</p>
      </div>
    );
  }

  return (
    <InfiniteScroll
      className={`space-y-3 ${className}`}
      hasMore={hasMorePages}
      isLoading={isLoadingMore}
      onLoadMore={loadMoreItems}
      data-testid="room-list-infinite-scroll"
    >
      {rooms.map((room) => (
        <RoomListItem
          key={room.id}
          room={room}
          onClick={() => onRoomClick?.(room)}
        />
      ))}
    </InfiniteScroll>
  );
}

interface RoomListItemProps {
  room: Room;
  onClick?: () => void;
}

function RoomListItem({ room, onClick }: RoomListItemProps) {
  const memberCount = Array.isArray(room.memberIds) ? room.memberIds.length : 0;

  return (
    <div
      className={`flex items-center space-x-3 p-4 rounded-lg border bg-card ${
        onClick ? 'cursor-pointer hover:bg-muted transition-colors' : ''
      }`}
      onClick={onClick}
      data-testid={`room-item-${room.id}`}
    >
      <div className="flex-shrink-0">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center">
          <MessageCircle className="w-6 h-6 text-white" />
        </div>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2 mb-1">
          <h3 className="font-medium text-base truncate" data-testid={`room-name-${room.id}`}>
            {room.name}
          </h3>
          {room.isPrivate && (
            <Badge variant="outline" className="text-xs">
              Private
            </Badge>
          )}
        </div>
        
        {room.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-2" data-testid={`room-description-${room.id}`}>
            {room.description}
          </p>
        )}
        
        <div className="flex items-center space-x-4 text-xs text-muted-foreground">
          <div className="flex items-center space-x-1" data-testid={`room-members-${room.id}`}>
            <Users className="w-3 h-3" />
            <span>{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
          </div>
          
          {room.createdAt && (
            <span data-testid={`room-created-${room.id}`}>
              Created {new Date(room.createdAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function RoomListItemSkeleton() {
  return (
    <div className="flex items-center space-x-3 p-4 rounded-lg border bg-card">
      <Skeleton className="w-12 h-12 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}