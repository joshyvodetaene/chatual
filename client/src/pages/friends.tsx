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
      "min-h-screen overflow-auto",
      "bg-gradient-to-br from-black via-red-950 to-black",
      "relative"
    )}>
      {/* Animated background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-600/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-3/4 left-1/3 w-64 h-64 bg-red-400/8 rounded-full blur-2xl animate-pulse delay-500"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 p-4">
        {/* Header */}
        <div className={cn(
          "flex items-center justify-between mb-6",
          isMobile ? "mb-4" : ""
        )}>
          <div className="flex items-center space-x-4">
            <BackButton to="/chat" />
            <div>
              <h1 className={cn(
                "font-bold text-white red-glow",
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
    </div>
  );
}