import { useState, useCallback, useEffect } from 'react';

export interface QueuedMessage {
  id: string;
  content: string;
  timestamp: number;
  roomId?: string;
  type: 'message' | 'typing';
  retryCount: number;
}

export interface OfflineQueueConfig {
  maxQueueSize: number;
  maxRetries: number;
  storageKey: string;
}

const DEFAULT_CONFIG: OfflineQueueConfig = {
  maxQueueSize: 100,
  maxRetries: 3,
  storageKey: 'chatual_offline_queue'
};

export function useOfflineQueue(config: OfflineQueueConfig = DEFAULT_CONFIG) {
  const [queuedMessages, setQueuedMessages] = useState<QueuedMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load queued messages from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(config.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        setQueuedMessages(parsed);
      }
    } catch (error) {
      console.error('Failed to load offline queue from localStorage:', error);
    }
  }, [config.storageKey]);

  // Save queued messages to localStorage whenever queue changes
  useEffect(() => {
    try {
      localStorage.setItem(config.storageKey, JSON.stringify(queuedMessages));
    } catch (error) {
      console.error('Failed to save offline queue to localStorage:', error);
    }
  }, [queuedMessages, config.storageKey]);

  // Add message to queue
  const enqueueMessage = useCallback((
    content: string,
    type: 'message' | 'typing' = 'message',
    roomId?: string
  ) => {
    const queuedMessage: QueuedMessage = {
      id: `${Date.now()}-${Math.random()}`,
      content,
      timestamp: Date.now(),
      roomId,
      type,
      retryCount: 0
    };

    setQueuedMessages(prev => {
      const newQueue = [...prev, queuedMessage];
      // Enforce max queue size
      if (newQueue.length > config.maxQueueSize) {
        console.warn(`Offline queue exceeded max size (${config.maxQueueSize}). Removing oldest messages.`);
        return newQueue.slice(-config.maxQueueSize);
      }
      return newQueue;
    });

    return queuedMessage.id;
  }, [config.maxQueueSize]);

  // Remove message from queue
  const dequeueMessage = useCallback((messageId: string) => {
    setQueuedMessages(prev => prev.filter(msg => msg.id !== messageId));
  }, []);

  // Mark message as failed (increment retry count)
  const markMessageFailed = useCallback((messageId: string) => {
    setQueuedMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, retryCount: msg.retryCount + 1 }
        : msg
    ));
  }, []);

  // Get messages ready for sending (not exceeded max retries)
  const getMessagesForSending = useCallback(() => {
    return queuedMessages.filter(msg => msg.retryCount < config.maxRetries);
  }, [queuedMessages, config.maxRetries]);

  // Clear all messages from queue
  const clearQueue = useCallback(() => {
    setQueuedMessages([]);
  }, []);

  // Clear failed messages that exceeded retry limit
  const clearFailedMessages = useCallback(() => {
    setQueuedMessages(prev => prev.filter(msg => msg.retryCount < config.maxRetries));
  }, [config.maxRetries]);

  // Process queued messages with a sender function
  const processQueue = useCallback(async (
    sendFunction: (message: QueuedMessage) => Promise<boolean>
  ) => {
    if (isProcessing || queuedMessages.length === 0) return;

    setIsProcessing(true);
    const messagesToSend = getMessagesForSending();
    
    console.log(`Processing ${messagesToSend.length} queued messages...`);

    for (const message of messagesToSend) {
      try {
        const success = await sendFunction(message);
        if (success) {
          dequeueMessage(message.id);
          console.log(`Sent queued message: ${message.id}`);
        } else {
          markMessageFailed(message.id);
          console.warn(`Failed to send queued message: ${message.id}`);
        }
      } catch (error) {
        console.error(`Error sending queued message ${message.id}:`, error);
        markMessageFailed(message.id);
      }
    }

    setIsProcessing(false);
  }, [isProcessing, queuedMessages.length, getMessagesForSending, dequeueMessage, markMessageFailed]);

  return {
    queuedMessages,
    queuedCount: queuedMessages.length,
    failedCount: queuedMessages.filter(msg => msg.retryCount >= config.maxRetries).length,
    isProcessing,
    enqueueMessage,
    dequeueMessage,
    processQueue,
    clearQueue,
    clearFailedMessages,
    getMessagesForSending
  };
}