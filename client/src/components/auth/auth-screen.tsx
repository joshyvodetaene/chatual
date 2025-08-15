import { useState } from 'react';
import { User } from '@shared/schema';
import RegisterForm from './register-form';
import LoginForm from './login-form';
import { MessageCircle, Heart } from 'lucide-react';

interface AuthScreenProps {
  onAuthSuccess: (user: User) => void;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="min-h-screen sensual-gradient flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-black/80"></div>
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-primary/15 rounded-full blur-3xl"></div>
      
      <div className="w-full max-w-md relative z-10">
        {/* App Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-16 h-16 bg-primary text-white rounded-2xl flex items-center justify-center red-glow shadow-2xl">
              <Heart className="w-8 h-8" />
            </div>
            <h1 className="text-4xl font-bold text-white text-glow">Chatual</h1>
          </div>
          <p className="text-gray-300 text-lg font-light">
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