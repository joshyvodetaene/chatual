import { useState } from 'react';
import { User } from '@shared/schema';
import RegisterForm from './register-form';
import LoginForm from './login-form';
import { MessageCircle, Heart } from 'lucide-react';
import { useResponsive } from '@/hooks/use-responsive';
import { cn } from '@/lib/utils';

interface AuthScreenProps {
  onAuthSuccess: (user: User) => void;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const { isMobile, isTablet } = useResponsive();

  return (
    <div className={cn(
      "min-h-screen sensual-gradient flex items-center justify-center relative overflow-hidden",
      isMobile ? "p-4" : "p-4"
    )}>
      {/* Background Effects */}
      <div className="absolute inset-0 bg-black/80"></div>
      <div className={cn(
        "absolute bg-primary/10 rounded-full blur-3xl",
        isMobile ? "top-1/3 left-1/6 w-48 h-48" : "top-1/4 left-1/4 w-64 h-64"
      )}></div>
      <div className={cn(
        "absolute bg-primary/15 rounded-full blur-3xl",
        isMobile ? "bottom-1/3 right-1/6 w-32 h-32" : "bottom-1/4 right-1/4 w-48 h-48"
      )}></div>
      
      <div className={cn(
        "w-full relative z-10",
        isMobile ? "max-w-sm" : "max-w-md"
      )}>
        {/* App Header */}
        <div className={cn(
          "text-center",
          isMobile ? "mb-6" : "mb-8"
        )}>
          <div className={cn(
            "flex items-center justify-center mb-4",
            isMobile ? "gap-2 flex-col" : "gap-3"
          )}>
            <div className={cn(
              "bg-primary text-white rounded-2xl flex items-center justify-center red-glow shadow-2xl",
              isMobile ? "w-12 h-12" : "w-16 h-16"
            )}>
              <Heart className={cn(
                isMobile ? "w-6 h-6" : "w-8 h-8"
              )} />
            </div>
            <h1 className={cn(
              "font-bold text-white text-glow",
              isMobile ? "text-3xl" : "text-4xl"
            )}>Chatual</h1>
          </div>
          <p className={cn(
            "text-gray-300 font-light",
            isMobile ? "text-base" : "text-lg"
          )}>
            Where passion meets conversation
          </p>
        </div>

        {/* Auth Forms */}
        {isLogin ? (
          <LoginForm
            onSuccess={onAuthSuccess}
            onSwitchToRegister={() => setIsLogin(false)}
          />
        ) : (
          <RegisterForm
            onSuccess={onAuthSuccess}
            onSwitchToLogin={() => setIsLogin(true)}
          />
        )}
      </div>
    </div>
  );
}