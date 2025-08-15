import { useState } from 'react';
import { User } from '@shared/schema';
import RegisterForm from './register-form';
import LoginForm from './login-form';
import { MessageCircle } from 'lucide-react';

interface AuthScreenProps {
  onAuthSuccess: (user: User) => void;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* App Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-primary text-white rounded-xl flex items-center justify-center">
              <MessageCircle className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Chatual</h1>
          </div>
          <p className="text-gray-600">
            Connect, chat, and share moments with friends
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