import { useState, useEffect, useRef } from 'react';
import { NotificationSounds } from '@/components/notifications/notification-sounds';

export interface NotificationSettings {
  sounds: boolean;
  volume: number;
  vibration: boolean;
  quietHours: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  notificationTypes: {
    messages: boolean;
    mentions: boolean;
    reactions: boolean;
    friend_requests: boolean;
    room_invites: boolean;
    system: boolean;
    moderator: boolean;
    events: boolean;
  };
}

interface NotificationData {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: any;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

interface ActiveToast extends NotificationData {
  isVisible: boolean;
  createdAt: number;
}

export function useNotificationManager() {
  const [toasts, setToasts] = useState<ActiveToast[]>([]);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const notificationSounds = useRef(NotificationSounds.getInstance());
  const toastIdCounter = useRef(0);
  
  // Load user notification settings
  useEffect(() => {
    const currentUser = JSON.parse(localStorage.getItem('chatual_user') || 'null');
    if (currentUser) {
      loadNotificationSettings(currentUser.id);
    }
  }, []);

  // Listen for WebSocket notifications
  useEffect(() => {
    const handleWebSocketNotification = (event: CustomEvent) => {
      const notification = event.detail;
      if (notification && settings) {
        // Check if notification type is enabled
        const typeKey = notification.type as keyof typeof settings.notificationTypes;
        if (settings.notificationTypes[typeKey] === false) {
          return;
        }
        
        // Check quiet hours
        if (isInQuietHours()) {
          return;
        }

        const id = `toast-${++toastIdCounter.current}`;
        const toast: ActiveToast = {
          id,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          data: notification.data,
          priority: notification.priority || 'normal',
          isVisible: true,
          createdAt: Date.now(),
        };
        
        setToasts(prev => [...prev, toast]);
        
        // Play sound if enabled
        if (settings.sounds) {
          notificationSounds.current.playSound(notification.type, {
            enabled: true,
            volume: settings.volume,
          });
        }
        
        // Vibrate if enabled and supported
        if (settings.vibration && navigator.vibrate) {
          const pattern = notification.priority === 'urgent' ? [200, 100, 200] : [100];
          navigator.vibrate(pattern);
        }
        
        // Auto-remove toast after delay (except for urgent notifications)
        if (notification.priority !== 'urgent') {
          const duration = notification.priority === 'high' ? 8000 : 5000;
          setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
          }, duration);
        }
      }
    };

    window.addEventListener('websocket-notification', handleWebSocketNotification as EventListener);
    
    return () => {
      window.removeEventListener('websocket-notification', handleWebSocketNotification as EventListener);
    };
  }, [settings]); // Re-run when settings change
  
  const loadNotificationSettings = async (userId: string) => {
    try {
      const response = await fetch(`/api/users/${userId}/notification-settings`);
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      } else {
        // Use default settings if none exist
        const defaultSettings: NotificationSettings = {
          sounds: true,
          volume: 50,
          vibration: true,
          quietHours: false,
          quietHoursStart: '22:00',
          quietHoursEnd: '07:00',
          notificationTypes: {
            messages: true,
            mentions: true,
            reactions: true,
            friend_requests: true,
            room_invites: true,
            system: true,
            moderator: true,
            events: true,
          },
        };
        setSettings(defaultSettings);
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    }
  };
  
  const isInQuietHours = (): boolean => {
    if (!settings?.quietHours) return false;
    
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const [startHour, startMin] = settings.quietHoursStart.split(':').map(Number);
    const [endHour, endMin] = settings.quietHoursEnd.split(':').map(Number);
    
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;
    
    // Handle overnight quiet hours (e.g., 22:00 to 07:00)
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime <= endTime;
    }
    
    return currentTime >= startTime && currentTime <= endTime;
  };
  
  const shouldShowNotification = (type: string): boolean => {
    if (!settings) return true;
    
    // Check if notification type is enabled
    const typeKey = type as keyof typeof settings.notificationTypes;
    if (settings.notificationTypes[typeKey] === false) {
      return false;
    }
    
    // Check quiet hours
    return !isInQuietHours();
  };
  
  const showNotification = (notificationData: NotificationData) => {
    if (!shouldShowNotification(notificationData.type)) {
      return;
    }
    
    const id = `toast-${++toastIdCounter.current}`;
    const toast: ActiveToast = {
      ...notificationData,
      id,
      isVisible: true,
      createdAt: Date.now(),
    };
    
    setToasts(prev => [...prev, toast]);
    
    // Play sound if enabled
    if (settings?.sounds) {
      notificationSounds.current.playSound(notificationData.type, {
        enabled: true,
        volume: settings.volume,
      });
    }
    
    // Vibrate if enabled and supported
    if (settings?.vibration && navigator.vibrate) {
      const pattern = notificationData.priority === 'urgent' ? [200, 100, 200] : [100];
      navigator.vibrate(pattern);
    }
    
    // Auto-remove toast after delay (except for urgent notifications)
    if (notificationData.priority !== 'urgent') {
      const duration = notificationData.priority === 'high' ? 8000 : 5000;
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  };
  
  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };
  
  const clearAllToasts = () => {
    setToasts([]);
  };
  
  // Clean up old toasts periodically
  useEffect(() => {
    const cleanup = setInterval(() => {
      const cutoff = Date.now() - 30000; // Remove toasts older than 30 seconds
      setToasts(prev => prev.filter(toast => toast.createdAt > cutoff));
    }, 10000);
    
    return () => clearInterval(cleanup);
  }, []);
  
  return {
    toasts,
    settings,
    showNotification,
    removeToast,
    clearAllToasts,
    loadNotificationSettings,
    isInQuietHours,
  };
}