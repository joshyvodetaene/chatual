import { useEffect, useState } from 'react';
import { Bell, User, Heart, MessageSquare, Users, Shield, Calendar, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NotificationToastProps {
  id: string;
  type: string;
  title: string;
  message: string;
  isVisible: boolean;
  onClose: () => void;
  onAction?: () => void;
  actionUrl?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  duration?: number;
}

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'message':
      return <MessageSquare className="w-5 h-5" />;
    case 'mention':
      return <User className="w-5 h-5" />;
    case 'reaction':
      return <Heart className="w-5 h-5" />;
    case 'friend_request':
      return <User className="w-5 h-5" />;
    case 'room_invite':
      return <Users className="w-5 h-5" />;
    case 'system':
      return <Bell className="w-5 h-5" />;
    case 'moderator':
      return <Shield className="w-5 h-5" />;
    case 'event':
      return <Calendar className="w-5 h-5" />;
    default:
      return <Bell className="w-5 h-5" />;
  }
};

const getPriorityStyles = (priority: string) => {
  switch (priority) {
    case 'urgent':
      return 'border-red-500 bg-red-50 dark:bg-red-950';
    case 'high':
      return 'border-orange-500 bg-orange-50 dark:bg-orange-950';
    case 'low':
      return 'border-gray-300 bg-gray-50 dark:bg-gray-800';
    default:
      return 'border-blue-500 bg-blue-50 dark:bg-blue-950';
  }
};

export function NotificationToast({
  id,
  type,
  title,
  message,
  isVisible,
  onClose,
  onAction,
  actionUrl,
  priority = 'normal',
  duration = 5000
}: NotificationToastProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isVisible, duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  const handleAction = () => {
    if (onAction) {
      onAction();
    } else if (actionUrl) {
      window.location.href = actionUrl;
    }
    handleClose();
  };

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        'relative w-80 max-w-sm z-50 transition-all duration-200',
        isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100',
        'animate-in slide-in-from-right-full'
      )}
      data-testid={`notification-toast-${id}`}
    >
      <div
        className={cn(
          'border-l-4 rounded-lg shadow-lg p-4',
          getPriorityStyles(priority)
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 text-gray-600 dark:text-gray-400">
            {getNotificationIcon(type)}
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1" data-testid="notification-title">
              {title}
            </h4>
            <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2" data-testid="notification-message">
              {message}
            </p>
            
            {(onAction || actionUrl) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAction}
                className="mt-2 h-6 px-2 text-xs hover:bg-white/20 dark:hover:bg-black/20"
                data-testid="notification-action"
              >
                View
              </Button>
            )}
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="flex-shrink-0 h-6 w-6 p-0 hover:bg-white/20 dark:hover:bg-black/20"
            data-testid="notification-close"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}