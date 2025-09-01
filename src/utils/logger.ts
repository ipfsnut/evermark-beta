/**
 * Enhanced logging utility for Evermark application
 * Provides structured logging with context and filtering
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogContext = 'auth' | 'blockchain' | 'evermark' | 'staking' | 'voting' | 'ui' | 'api' | 'general';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: LogContext;
  message: string;
  data?: any;
  error?: Error;
}

class Logger {
  private isDevelopment = import.meta.env.DEV;
  private minLevel: LogLevel = this.isDevelopment ? 'debug' : 'info';
  private logs: LogEntry[] = [];
  private maxLogs = 1000;

  private levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.minLevel];
  }

  private createLogEntry(
    level: LogLevel,
    context: LogContext,
    message: string,
    data?: any,
    error?: Error
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      data,
      error
    };
  }

  private formatConsoleMessage(entry: LogEntry): string {
    const emoji = {
      debug: '🐛',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌'
    }[entry.level];

    const contextEmoji = {
      auth: '🔐',
      blockchain: '⛓️',
      evermark: '⭐',
      staking: '🏦',
      voting: '🗳️',
      ui: '🎨',
      api: '🌐',
      general: '📝'
    }[entry.context];

    return `${emoji} ${contextEmoji} [${entry.context.toUpperCase()}] ${entry.message}`;
  }

  private log(
    level: LogLevel,
    context: LogContext,
    message: string,
    data?: any,
    error?: Error
  ): void {
    if (!this.shouldLog(level)) return;

    const entry = this.createLogEntry(level, context, message, data, error);
    
    // Store log entry
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console output
    const formattedMessage = this.formatConsoleMessage(entry);
    
    switch (level) {
      case 'debug':
        console.debug(formattedMessage, data || '', error || '');
        break;
      case 'info':
        console.info(formattedMessage, data || '', error || '');
        break;
      case 'warn':
        console.warn(formattedMessage, data || '', error || '');
        break;
      case 'error':
        console.error(formattedMessage, data || '', error || '');
        break;
    }
  }

  // Public methods
  debug(context: LogContext, message: string, data?: any): void {
    this.log('debug', context, message, data);
  }

  info(context: LogContext, message: string, data?: any): void {
    this.log('info', context, message, data);
  }

  warn(context: LogContext, message: string, data?: any, error?: Error): void {
    this.log('warn', context, message, data, error);
  }

  error(context: LogContext, message: string, data?: any, error?: Error): void {
    this.log('error', context, message, data, error);
  }

  // Specialized methods for common patterns
  transaction(message: string, data?: { txHash?: string; [key: string]: any }): void {
    this.info('blockchain', `Transaction: ${message}`, data);
  }

  walletAction(message: string, data?: any): void {
    this.info('auth', `Wallet: ${message}`, data);
  }

  userAction(message: string, data?: any): void {
    this.info('ui', `User: ${message}`, data);
  }

  apiCall(message: string, data?: any): void {
    this.info('api', `API: ${message}`, data);
  }

  // Utility methods
  getLogs(context?: LogContext, level?: LogLevel): LogEntry[] {
    return this.logs.filter(log => {
      if (context && log.context !== context) return false;
      if (level && log.level !== level) return false;
      return true;
    });
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  clearLogs(): void {
    this.logs = [];
  }

  setLogLevel(level: LogLevel): void {
    this.minLevel = level;
  }
}

// Create singleton instance
export const logger = new Logger();

// Default export for convenience
export default logger;

// Context-specific loggers for better organization
export const authLogger = {
  debug: (message: string, data?: any) => logger.debug('auth', message, data),
  info: (message: string, data?: any) => logger.info('auth', message, data),
  warn: (message: string, data?: any, error?: Error) => logger.warn('auth', message, data, error),
  error: (message: string, data?: any, error?: Error) => logger.error('auth', message, data, error),
};

export const blockchainLogger = {
  debug: (message: string, data?: any) => logger.debug('blockchain', message, data),
  info: (message: string, data?: any) => logger.info('blockchain', message, data),
  warn: (message: string, data?: any, error?: Error) => logger.warn('blockchain', message, data, error),
  error: (message: string, data?: any, error?: Error) => logger.error('blockchain', message, data, error),
};

export const evermarkLogger = {
  debug: (message: string, data?: any) => logger.debug('evermark', message, data),
  info: (message: string, data?: any) => logger.info('evermark', message, data),
  warn: (message: string, data?: any, error?: Error) => logger.warn('evermark', message, data, error),
  error: (message: string, data?: any, error?: Error) => logger.error('evermark', message, data, error),
};

export const stakingLogger = {
  debug: (message: string, data?: any) => logger.debug('staking', message, data),
  info: (message: string, data?: any) => logger.info('staking', message, data),
  warn: (message: string, data?: any, error?: Error) => logger.warn('staking', message, data, error),
  error: (message: string, data?: any, error?: Error) => logger.error('staking', message, data, error),
};

export const votingLogger = {
  debug: (message: string, data?: any) => logger.debug('voting', message, data),
  info: (message: string, data?: any) => logger.info('voting', message, data),
  warn: (message: string, data?: any, error?: Error) => logger.warn('voting', message, data, error),
  error: (message: string, data?: any, error?: Error) => logger.error('voting', message, data, error),
};

export const uiLogger = {
  debug: (message: string, data?: any) => logger.debug('ui', message, data),
  info: (message: string, data?: any) => logger.info('ui', message, data),
  warn: (message: string, data?: any, error?: Error) => logger.warn('ui', message, data, error),
  error: (message: string, data?: any, error?: Error) => logger.error('ui', message, data, error),
};

export const apiLogger = {
  debug: (message: string, data?: any) => logger.debug('api', message, data),
  info: (message: string, data?: any) => logger.info('api', message, data),
  warn: (message: string, data?: any, error?: Error) => logger.warn('api', message, data, error),
  error: (message: string, data?: any, error?: Error) => logger.error('api', message, data, error),
};