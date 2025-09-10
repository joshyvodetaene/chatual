import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Users, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { User } from '@shared/schema';

import FriendRequests from './friend-requests';
import SentFriendRequests from './sent-friend-requests';
import FriendsList from './friends-list';
import SendFriendRequest from './send-friend-request';

interface FriendsManagementProps {
  user: User;
  isMobile?: boolean;
}

export default function FriendsManagement({ user, isMobile = false }: FriendsManagementProps) {
  const [activeTab, setActiveTab] = useState('friends');

  // Fetch friend requests count for badge
  const { data: requestsData } = useQuery({
    queryKey: [`/api/users/${user.id}/friend-requests`],
    queryFn: () => apiRequest('GET', `/api/users/${user.id}/friend-requests`),
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
  });

  // Fetch sent friend requests count for badge
  const { data: sentRequestsData } = useQuery({
    queryKey: [`/api/users/${user.id}/sent-friend-requests`],
    queryFn: () => apiRequest('GET', `/api/users/${user.id}/sent-friend-requests`),
    refetchInterval: 30000,
  });

  // Fetch friends count for badge
  const { data: friendsData } = useQuery({
    queryKey: [`/api/users/${user.id}/friends`],
    queryFn: () => apiRequest('GET', `/api/users/${user.id}/friends`),
  });

  const pendingRequestsCount = requestsData?.friendRequests?.length || 0;
  const sentRequestsCount = sentRequestsData?.sentFriendRequests?.length || 0;
  const totalRequestsCount = pendingRequestsCount + sentRequestsCount;
  const friendsCount = friendsData?.friends?.length || 0;

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={cn(
          "grid grid-cols-3 w-full mb-6 bg-gray-800 border-gray-700",
          isMobile ? "h-12" : "h-14"
        )}>
          <TabsTrigger 
            value="friends" 
            className={cn(
              "flex items-center space-x-2 data-[state=active]:bg-primary data-[state=active]:text-white",
              isMobile ? "text-sm" : ""
            )}
            data-testid="tab-friends"
          >
            <Users className={cn(isMobile ? "w-4 h-4" : "w-5 h-5")} />
            <span>Friends</span>
            {friendsCount > 0 && (
              <Badge variant="secondary" className="ml-1 bg-primary/20 text-xs">
                {friendsCount}
              </Badge>
            )}
          </TabsTrigger>
          
          <TabsTrigger 
            value="requests" 
            className={cn(
              "flex items-center space-x-2 data-[state=active]:bg-primary data-[state=active]:text-white",
              isMobile ? "text-sm" : ""
            )}
            data-testid="tab-requests"
          >
            <UserPlus className={cn(isMobile ? "w-4 h-4" : "w-5 h-5")} />
            <span>Requests</span>
            {totalRequestsCount > 0 && (
              <Badge variant="secondary" className="ml-1 bg-red-600 text-white text-xs">
                {totalRequestsCount}
              </Badge>
            )}
          </TabsTrigger>
          
          <TabsTrigger 
            value="find" 
            className={cn(
              "flex items-center space-x-2 data-[state=active]:bg-primary data-[state=active]:text-white",
              isMobile ? "text-sm" : ""
            )}
            data-testid="tab-find-friends"
          >
            <Search className={cn(isMobile ? "w-4 h-4" : "w-5 h-5")} />
            <span>Find</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="mt-0">
          <FriendsList user={user} isMobile={isMobile} />
        </TabsContent>

        <TabsContent value="requests" className="mt-0">
          <div className="space-y-6">
            <FriendRequests user={user} isMobile={isMobile} />
            <SentFriendRequests user={user} isMobile={isMobile} />
          </div>
        </TabsContent>

        <TabsContent value="find" className="mt-0">
          <SendFriendRequest user={user} isMobile={isMobile} />
        </TabsContent>
      </Tabs>
    </div>
  );
}