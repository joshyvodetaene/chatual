import { storage } from './storage';
import { WebSocket } from 'ws';
import type { 
  InsertNotification,
  Notification,
  UserNotificationSettings,
  User 
} from '@shared/schema';

export type NotificationType = 
  | 'message'
  | 'mention'
  | 'reaction'
  | 'friend_request'
  | 'room_invite'
  | 'join_request'
  | 'system'
  | 'moderator'
  | 'event'
  | 'marketing';

interface NotificationData {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, any>;
  actionUrl?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

interface WebSocketClient extends WebSocket {
  userId?: string;
  roomId?: string;
}

export class NotificationService {
  private clients: Map<string, WebSocketClient>;

  constructor(clients: Map<string, WebSocketClient>) {
    this.clients = clients;
  }

  /**
   * Sends a notification to a user if their preferences allow it
   */
  async sendNotification(data: NotificationData): Promise<Notification | null> {
    try {
      // Get user notification settings
      const settings = await storage.getUserNotificationSettings(data.userId);
      
      // Check if notifications are globally enabled
      if (!settings.enableNotifications) {
        console.log(`Notifications disabled for user ${data.userId}`);
        return null;
      }

      // Check if this notification type is enabled
      if (!this.isNotificationTypeEnabled(data.type, settings)) {
        console.log(`Notification type ${data.type} disabled for user ${data.userId}`);
        return null;
      }

      // Check quiet hours
      if (settings.quietHoursEnabled && this.isInQuietHours(settings)) {
        // Only allow urgent notifications during quiet hours
        if (data.priority !== 'urgent') {
          console.log(`Quiet hours active for user ${data.userId}, skipping non-urgent notification`);
          return null;
        }
      }

      // Create the notification in the database
      const notificationData: InsertNotification = {
        userId: data.userId,
        type: data.type,
        title: data.title,
        body: data.message,
        data: data.metadata || {},
        // Note: actionUrl and priority are stored in the data field as metadata
      };

      const notification = await storage.createNotification(notificationData);

      // Send real-time notification via WebSocket if user is online
      await this.sendRealTimeNotification(data.userId, notification);

      // Send browser/push notification if enabled
      // Browser notifications would be enabled here based on user preferences
      // For now we'll always try to send them
      await this.sendBrowserNotification(data.userId, notification);

      return notification;
    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
  }

  /**
   * Sends a notification to multiple users
   */
  async sendBulkNotifications(notifications: NotificationData[]): Promise<void> {
    const promises = notifications.map(notification => this.sendNotification(notification));
    await Promise.allSettled(promises);
  }

  /**
   * Sends a real-time notification via WebSocket
   */
  private async sendRealTimeNotification(userId: string, notification: Notification): Promise<void> {
    const client = this.clients.get(userId);
    
    if (client && client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify({
          type: 'notification',
          data: notification
        }));
        console.log(`Real-time notification sent to user ${userId}`);
      } catch (error) {
        console.error(`Failed to send real-time notification to user ${userId}:`, error);
      }
    }
  }

  /**
   * Sends a browser notification (placeholder for now)
   */
  private async sendBrowserNotification(userId: string, notification: Notification): Promise<void> {
    // This would integrate with a service like Firebase Cloud Messaging
    // or use the Web Push API for browser notifications
    console.log(`Browser notification would be sent to user ${userId}: ${notification.title}`);
  }

  /**
   * Checks if a specific notification type is enabled for the user
   */
  private isNotificationTypeEnabled(type: NotificationType, settings: UserNotificationSettings): boolean {
    switch (type) {
      case 'message':
        return settings.newMessages;
      case 'mention':
        return settings.mentions;
      case 'reaction':
        return settings.reactions;
      case 'friend_request':
        return settings.friendRequests;
      case 'room_invite':
        return settings.roomInvites;
      case 'join_request':
        return settings.newMatches; // Map to new_matches for now
      case 'system':
        return settings.systemUpdates;
      case 'moderator':
        return settings.securityAlerts; // Map to security_alerts for moderation
      case 'event':
        return settings.systemUpdates;
      case 'marketing':
        return false; // No marketing column in current schema
      default:
        return true;
    }
  }

  /**
   * Checks if the current time is within the user's quiet hours
   */
  private isInQuietHours(settings: UserNotificationSettings): boolean {
    if (!settings.quietHoursEnabled || !settings.quietHoursStart || !settings.quietHoursEnd) {
      return false;
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    // Parse quiet hours (format: "HH:MM")
    const [startHour, startMinute] = settings.quietHoursStart.split(':').map(Number);
    const [endHour, endMinute] = settings.quietHoursEnd.split(':').map(Number);
    
    const startTime = startHour * 60 + startMinute;
    const endTime = endHour * 60 + endMinute;

    // Handle overnight quiet hours (e.g., 22:00 to 06:00)
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime < endTime;
    } else {
      return currentTime >= startTime && currentTime < endTime;
    }
  }

  /**
   * Creates a message notification for a user
   */
  async notifyNewMessage(
    recipientId: string, 
    senderId: string, 
    roomId: string, 
    messageContent: string,
    isDirect: boolean = false
  ): Promise<void> {
    try {
      // Only send notifications for direct messages, not chatroom messages
      if (!isDirect) {
        return;
      }

      const sender = await storage.getUser(senderId);
      if (!sender) return;

      const title = 'New Direct Message';
      const message = `${sender.displayName}: ${messageContent.substring(0, 100)}${messageContent.length > 100 ? '...' : ''}`;

      await this.sendNotification({
        userId: recipientId,
        type: 'message',
        title,
        message,
        metadata: {
          senderId,
          roomId,
          senderName: sender.displayName,
          isDirect
        },
        actionUrl: `/chat/${roomId}`,
        priority: 'high'
      });
    } catch (error) {
      console.error('Error sending message notification:', error);
    }
  }

  /**
   * Creates a mention notification for a user
   */
  async notifyMention(
    mentionedUserId: string,
    mentionerId: string,
    roomId: string,
    messageContent: string
  ): Promise<void> {
    try {
      const mentioner = await storage.getUser(mentionerId);
      if (!mentioner) return;

      await this.sendNotification({
        userId: mentionedUserId,
        type: 'mention',
        title: 'You were mentioned',
        message: `${mentioner.displayName} mentioned you: ${messageContent.substring(0, 100)}${messageContent.length > 100 ? '...' : ''}`,
        metadata: {
          mentionerId,
          roomId,
          mentionerName: mentioner.displayName
        },
        actionUrl: `/chat/${roomId}`,
        priority: 'high'
      });
    } catch (error) {
      console.error('Error sending mention notification:', error);
    }
  }

  /**
   * Creates a reaction notification for a user
   */
  async notifyReaction(
    messageAuthorId: string,
    reactorId: string,
    emoji: string,
    roomId: string
  ): Promise<void> {
    try {
      const reactor = await storage.getUser(reactorId);
      if (!reactor) return;

      await this.sendNotification({
        userId: messageAuthorId,
        type: 'reaction',
        title: 'Someone reacted to your message',
        message: `${reactor.displayName} reacted with ${emoji}`,
        metadata: {
          reactorId,
          roomId,
          reactorName: reactor.displayName,
          emoji
        },
        actionUrl: `/chat/${roomId}`,
        priority: 'low'
      });
    } catch (error) {
      console.error('Error sending reaction notification:', error);
    }
  }

  /**
   * Creates a system notification for a user
   */
  async notifySystem(
    userId: string,
    title: string,
    message: string,
    priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal',
    actionUrl?: string
  ): Promise<void> {
    try {
      await this.sendNotification({
        userId,
        type: 'system',
        title,
        message,
        priority,
        actionUrl
      });
    } catch (error) {
      console.error('Error sending system notification:', error);
    }
  }

  /**
   * Gets unread notification count for a user
   */
  async getUnreadNotificationCount(userId: string): Promise<number> {
    try {
      const notifications = await storage.getUserNotifications(userId, 1000, 0);
      return notifications.filter(n => !n.read).length;
    } catch (error) {
      console.error('Error getting unread notification count:', error);
      return 0;
    }
  }

  /**
   * Marks multiple notifications as read
   */
  async markNotificationsAsRead(notificationIds: string[]): Promise<void> {
    const promises = notificationIds.map(id => storage.markNotificationAsRead(id));
    await Promise.allSettled(promises);
  }
}