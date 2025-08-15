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

  const formatDistance = (distanceKm: number): string => {
    if (distanceKm < 1) {
      return 'Less than 1 km';
    } else if (distanceKm < 1000) {
      return `${distanceKm} km away`;
    } else {
      return `${Math.round(distanceKm / 1000)}k km away`;
    }
  };

  const getDistanceColor = (distance: number): string => {
    if (distance < 10) return 'text-green-600';
    if (distance < 100) return 'text-blue-600';
    if (distance < 1000) return 'text-orange-600';
    return 'text-gray-600';
  };

  return (
    <div className={cn('flex items-center gap-1 text-xs', className)}>
      <MapPin className="w-3 h-3" />
      <span className={getDistanceColor(targetUser.distance)}>
        {formatDistance(targetUser.distance)}
      </span>
    </div>
  );
}