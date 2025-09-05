import { storage } from './storage';

/**
 * Daily cleanup scheduler for old messages
 * Keeps only the 40 newest messages per room
 */

const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const MESSAGES_TO_KEEP_PER_ROOM = 40;

export class CleanupScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    this.setupCleanupScheduler();
  }

  private setupCleanupScheduler() {
    console.log('[CLEANUP] Setting up daily message cleanup scheduler');
    
    // Run cleanup immediately on startup (with a small delay)
    setTimeout(() => {
      this.runCleanup();
    }, 30000); // 30 seconds after startup
    
    // Then run every 24 hours
    this.intervalId = setInterval(() => {
      this.runCleanup();
    }, CLEANUP_INTERVAL);
    
    console.log('[CLEANUP] Scheduler initialized - will run every 24 hours');
  }

  private async runCleanup() {
    if (this.isRunning) {
      console.log('[CLEANUP] Cleanup already in progress, skipping this run');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      console.log('[CLEANUP] Starting daily message cleanup...');
      
      const result = await storage.cleanupOldMessages(MESSAGES_TO_KEEP_PER_ROOM);
      
      const duration = Date.now() - startTime;
      console.log(`[CLEANUP] Cleanup completed in ${duration}ms: ${result.totalDeleted} messages deleted from ${result.roomsCleaned} rooms`);
      
      // Log summary
      if (result.totalDeleted > 0) {
        console.log(`[CLEANUP] Successfully cleaned ${result.roomsCleaned} rooms, freed up space by removing ${result.totalDeleted} old messages`);
      } else {
        console.log('[CLEANUP] No old messages to clean up');
      }
      
    } catch (error) {
      console.error('[CLEANUP] Error during scheduled cleanup:', error);
    } finally {
      this.isRunning = false;
    }
  }

  public async runCleanupNow(): Promise<{ totalDeleted: number; roomsCleaned: number }> {
    console.log('[CLEANUP] Manual cleanup requested');
    
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