import { User } from '@shared/schema';
import { useCursorPagination } from '@/hooks/use-cursor-pagination';
import { InfiniteScroll } from '@/components/ui/infinite-scroll';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export interface PaginatedUserListProps {
  type: 'online' | 'distance';
  currentUserId?: string;
  className?: string;
  onUserClick?: (user: User) => void;
}

export function PaginatedUserList({ 
  type, 
  currentUserId, 
  className = '',
  onUserClick 
}: PaginatedUserListProps) {
  const queryKey = type === 'online' 
    ? ['/api/users/online']
    : ['/api/users/with-distance', currentUserId];

  const {
    items: users,
    hasMorePages,
    isInitialLoading,
    isLoadingMore,
    error,
    loadMoreItems,
    refresh
  } = useCursorPagination<User>({
    queryKey,
    pageSize: 20,
    enabled: type === 'online' || !!currentUserId,
    staleTime: 30000
  });

  if (error) {
    return (
      <div className="text-center py-8" data-testid="user-list-error">
        <p className="text-red-500 mb-4">Failed to load users</p>
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
      <div className={`space-y-4 ${className}`} data-testid="user-list-loading">
        {Array.from({ length: 5 }).map((_, i) => (
          <UserListItemSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500" data-testid="user-list-empty">
        <p>No {type === 'online' ? 'online' : ''} users found</p>
      </div>
    );
  }

  return (
    <InfiniteScroll
      className={`space-y-3 ${className}`}
      hasMore={hasMorePages}
      isLoading={isLoadingMore}
      onLoadMore={loadMoreItems}
      data-testid="user-list-infinite-scroll"
    >
      {users.map((user) => (
        <UserListItem
          key={user.id}
          user={user}
          onClick={() => onUserClick?.(user)}
          showDistance={type === 'distance'}
        />
      ))}
    </InfiniteScroll>
  );
}

interface UserListItemProps {
  user: User & { distance?: number };
  onClick?: () => void;
  showDistance?: boolean;
}

function UserListItem({ user, onClick, showDistance }: UserListItemProps) {
  return (
    <div
      className={`flex items-center space-x-3 p-3 rounded-lg border bg-card ${
        onClick ? 'cursor-pointer hover:bg-muted transition-colors' : ''
      }`}
      onClick={onClick}
      data-testid={`user-item-${user.id}`}
    >
      <Avatar className="w-12 h-12" data-testid={`avatar-${user.id}`}>
        <AvatarImage src={user.primaryPhoto?.photoUrl} alt={user.displayName} />
        <AvatarFallback>
          {user.displayName?.charAt(0).toUpperCase() || user.username?.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2">
          <p className="font-medium text-sm truncate" data-testid={`name-${user.id}`}>
            {user.displayName || user.username}
          </p>
          {user.isOnline && (
            <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
              Online
            </Badge>
          )}
        </div>
        
        <div className="flex items-center space-x-3 text-xs text-muted-foreground mt-1">
          {user.age && (
            <span data-testid={`age-${user.id}`}>{user.age} years old</span>
          )}
          {user.location && (
            <span data-testid={`location-${user.id}`}>{user.location}</span>
          )}
          {showDistance && user.distance && (
            <span data-testid={`distance-${user.id}`}>{user.distance} miles away</span>
          )}
        </div>
      </div>
    </div>
  );
}

function UserListItemSkeleton() {
  return (
    <div className="flex items-center space-x-3 p-3 rounded-lg border bg-card">
      <Skeleton className="w-12 h-12 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  );
}