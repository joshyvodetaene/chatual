import { storage } from './storage';
import { createTaggedLogger } from './logger';

/**
 * Daily cleanup scheduler for old messages
 * Keeps only the 40 newest messages per room
 */

const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const MESSAGES_TO_KEEP_PER_ROOM = 40;

export class CleanupScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private logger = createTaggedLogger('CLEANUP');

  constructor() {
    this.setupCleanupScheduler();
  }

  private setupCleanupScheduler() {
    this.logger.info('Setting up daily message cleanup scheduler');
    
    // Run cleanup immediately on startup (with a small delay)
    setTimeout(() => {
      this.runCleanup();
    }, 30000); // 30 seconds after startup
    
    // Then run every 24 hours
    this.intervalId = setInterval(() => {
      this.runCleanup();
    }, CLEANUP_INTERVAL);
    
    this.logger.info('Scheduler initialized - will run every 24 hours');
  }

  private async runCleanup() {
    if (this.isRunning) {
      this.logger.debug('Cleanup already in progress, skipping this run');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      this.logger.info('Starting daily message cleanup...');
      
      const result = await storage.cleanupOldMessages(MESSAGES_TO_KEEP_PER_ROOM);
      
      const duration = Date.now() - startTime;
      this.logger.info(`Cleanup completed in ${duration}ms: ${result.totalDeleted} messages deleted from ${result.roomsCleaned} rooms`);
      
      // Log summary
      if (result.totalDeleted > 0) {
        this.logger.info(`Successfully cleaned ${result.roomsCleaned} rooms, freed up space by removing ${result.totalDeleted} old messages`);
      } else {
        this.logger.debug('No old messages to clean up');
      }
      
    } catch (error) {
      this.logger.error('Error during scheduled cleanup:', error);
    } finally {
      this.isRunning = false;
    }
  }

  public async runCleanupNow(): Promise<{ totalDeleted: number; roomsCleaned: number }> {
    this.logger.info('Manual cleanup requested');
    
    if (this.isRunning) {
      throw new Error('Cleanup is already in progress');
    }

    this.isRunning = true;
    
    try {
      const result = await storage.cleanupOldMessages(MESSAGES_TO_KEEP_PER_ROOM);
      console.log(`[CLEANUP] Manual cleanup completed: ${result.totalDeleted} messages deleted from ${result.roomsCleaned} rooms`);
      return result;
    } finally {
      this.isRunning = false;
    }
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[CLEANUP] Cleanup scheduler stopped');
    }
  }

  public getStatus() {
    return {
      isRunning: this.isRunning,
      isScheduled: this.intervalId !== null,
      nextRun: this.intervalId ? new Date(Date.now() + CLEANUP_INTERVAL) : null,
      messagesPerRoom: MESSAGES_TO_KEEP_PER_ROOM
    };
  }
}

// Create and export singleton instance
export const cleanupScheduler = new CleanupScheduler();