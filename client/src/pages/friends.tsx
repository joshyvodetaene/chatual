import { useState, useEffect } from 'react';
import { useResponsive } from '@/hooks/use-responsive';
import { BackButton } from '@/components/ui/back-button';
import AuthScreen from '@/components/auth/auth-screen';
import FriendsManagement from '@/components/friends/friends-management';
import { User } from '@shared/schema';
import { cn } from '@/lib/utils';

export default function FriendsPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('chatual_user');
    return saved ? JSON.parse(saved) : null;
  });

  const { isMobile } = useResponsive();

  // Listen for auth changes
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem('chatual_user');
      setCurrentUser(saved ? JSON.parse(saved) : null);
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  if (!currentUser) {
    return <AuthScreen onAuthSuccess={setCurrentUser} />;
  }

  return (
    <div className={cn(
      "min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900",
      "p-4 overflow-auto"
    )}>
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between mb-6",
        isMobile ? "mb-4" : ""
      )}>
        <div className="flex items-center space-x-4">
          <BackButton to="/chat" />
          <div>
            <h1 className={cn(
              "font-bold text-white",
              isMobile ? "text-xl" : "text-3xl"
            )}>
              Friends
            </h1>
            <p className={cn(
              "text-gray-400",
              isMobile ? "text-sm" : ""
            )}>
              Manage your connections and find new friends
            </p>
          </div>
        </div>
      </div>

      {/* Friends Management */}
      <FriendsManagement user={currentUser} isMobile={isMobile} />
    </div>
  );
}