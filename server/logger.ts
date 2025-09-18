/**
 * Production-Ready Logger
 * 
 * Configurable logging system that optimizes output based on environment.
 * Reduces noise in production while maintaining essential logs.
 */

export enum LogLevel {
  TRACE = -1,
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

interface LoggerConfig {
  level: LogLevel;
  enableTimestamps: boolean;
  enableColors: boolean;
  enableDebugLogs: boolean;
}

class Logger {
  private config: LoggerConfig;

  constructor() {
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Parse LOG_LEVEL environment variable with fallback
    const getLogLevel = (): LogLevel => {
      const envLevel = process.env.LOG_LEVEL?.toLowerCase();
      switch (envLevel) {
        case 'trace': return LogLevel.TRACE;
        case 'debug': return LogLevel.DEBUG;
        case 'info': return LogLevel.INFO;
        case 'warn': return LogLevel.WARN;
        case 'error': return LogLevel.ERROR;
        default: return isProduction ? LogLevel.INFO : LogLevel.DEBUG;
      }
    };
    
    this.config = {
      level: getLogLevel(),
      enableTimestamps: true,
      enableColors: !isProduction, // No colors in production logs
      enableDebugLogs: true // Honor LOG_LEVEL for all environments
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level;
  }

  private formatMessage(level: string, tag: string, message: string, data?: any): string {
    const timestamp = this.config.enableTimestamps ? 
      `[${new Date().toISOString()}]` : '';
    
    const formattedMessage = data ? 
      `${timestamp} [${level}] ${tag} ${message}` : 
      `${timestamp} [${level}] ${tag} ${message}`;

    return formattedMessage;
  }

  // Trace logs - finest level of detail
  trace(tag: string, message: string, data?: any): void {
    if (!this.shouldLog(LogLevel.TRACE)) return;
    
    console.debug(this.formatMessage('TRACE', tag, message), data || '');
  }

  // Debug logs - honor LOG_LEVEL setting
  debug(tag: string, message: string, data?: any): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    
    console.debug(this.formatMessage('DEBUG', tag, message), data || '');
  }

  // Info logs - shown in production for important events
  info(tag: string, message: string, data?: any): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    
    console.log(this.formatMessage('INFO', tag, message), data || '');
  }

  // Warning logs - always shown
  warn(tag: string, message: string, data?: any): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    
    console.warn(this.formatMessage('WARN', tag, message), data || '');
  }

  // Error logs - always shown
  error(tag: string, message: string, error?: any): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    
    console.error(this.formatMessage('ERROR', tag, message), error || '');
  }

  // Production-safe logging for high-frequency operations
  // Use trace for very verbose logging that can be enabled with LOG_LEVEL=trace
  // Removed from legacy export as it now has its own implementation above

  // Essential logs that should always appear (startup, shutdown, critical events)
  system(tag: string, message: string, data?: any): void {
    console.log(this.formatMessage('SYSTEM', tag, message), data || '');
  }
}

// Export singleton instance
export const logger = new Logger();

// Tagged logger factory for consistent logging across modules
export const createTaggedLogger = (tag: string) => ({
  trace: (message: string, data?: any) => logger.trace(tag, message, data),
  debug: (message: string, data?: any) => logger.debug(tag, message, data),
  info: (message: string, data?: any) => logger.info(tag, message, data),
  warn: (message: string, data?: any) => logger.warn(tag, message, data),
  error: (message: string, error?: any) => logger.error(tag, message, error),
  system: (message: string, data?: any) => logger.system(tag, message, data),
});