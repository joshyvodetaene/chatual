import { useQuery } from '@tanstack/react-query';
import { UserWithDistance } from '@shared/schema';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserDistanceProps {
  currentUserId: string;
  targetUserId: string;
  className?: string;
}

export default function UserDistance({ currentUserId, targetUserId, className }: UserDistanceProps) {
  const { data: usersData } = useQuery<{ users: UserWithDistance[] }>({
    queryKey: ['/api/users/with-distance', currentUserId],
    enabled: !!currentUserId,
  });

  const targetUser = usersData?.users.find(user => user.id === targetUserId);

  if (!targetUser || targetUser.distance === undefined) {
    return null;
  }

  const formatDistance = (distanceKm: number, duration?: number, mode?: string): string => {
    let distanceText = '';
    
    if (distanceKm < 0.1) {
      distanceText = 'Very close';
    } else if (distanceKm < 1) {
      distanceText = `${(distanceKm * 1000).toFixed(0)}m`;
    } else if (distanceKm < 10) {
      distanceText = `${distanceKm.toFixed(1)} km`;
    } else if (distanceKm < 100) {
      distanceText = `${Math.round(distanceKm)} km`;
    } else if (distanceKm < 1000) {
      distanceText = `${Math.round(distanceKm)} km`;
    } else {
      distanceText = `${(distanceKm / 1000).toFixed(1)}k km`;
    }

    if (duration && duration > 0 && mode === 'driving') {
      const hours = Math.floor(duration / 60);
      const minutes = duration % 60;
      
      let timeText = '';
      if (hours > 0) {
        timeText = `${hours}h ${minutes}m`;
      } else {
        timeText = `${minutes}m`;
      }
      
      return `${distanceText} (${timeText})`;
    }

    return `${distanceText} away`;
  };

  const getDistanceColor = (distance: number, mode?: string): string => {
    if (mode === 'straight_line') {
      return 'text-gray-500'; // Lighter color for estimated distances
    }
    if (distance < 10) return 'text-green-600';
    if (distance < 100) return 'text-blue-600';
    if (distance < 1000) return 'text-orange-600';
    return 'text-gray-600';
  };

  return (
    <div className={cn('flex items-center gap-1 text-xs', className)}>
      <MapPin className="w-3 h-3" />
      <span className={getDistanceColor(targetUser.distance, targetUser.distanceMode)}>
        {formatDistance(targetUser.distance, targetUser.duration, targetUser.distanceMode)}
      </span>
      {targetUser.distanceMode === 'driving' && (
        <span className="text-xs text-gray-400 ml-1">🚗</span>
      )}
      {targetUser.distanceMode === 'straight_line' && (
        <span className="text-xs text-gray-400 ml-1">~</span>
      )}
    </div>
  );
}