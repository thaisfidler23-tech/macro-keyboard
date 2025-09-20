const winston = require('winston');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { EventEmitter } = require('events');
const { app } = require('electron');

/**
 * Advanced logging system with structured logging, file rotation, and remote logging
 * Provides centralized logging with multiple transports and configuration options
 */
class LogManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Logging levels
      level: config.level || (process.env.NODE_ENV === 'development' ? 'debug' : 'info'),
      
      // File logging configuration
      logDir: config.logDir || path.join(app.getPath('userData'), 'logs'),
      maxFileSize: config.maxFileSize || 5 * 1024 * 1024, // 5MB
      maxFiles: config.maxFiles || 10,
      datePattern: config.datePattern || 'YYYY-MM-DD',
      
      // Console logging
      enableConsole: config.enableConsole !== false,
      colorizeConsole: config.colorizeConsole !== false,
      
      // Remote logging
      enableRemote: config.enableRemote || false,
      remoteEndpoint: config.remoteEndpoint || null,
      remoteBatchSize: config.remoteBatchSize || 100,
      remoteFlushInterval: config.remoteFlushInterval || 5000, // 5 seconds
      
      // Performance logging
      enablePerformance: config.enablePerformance || false,
      performanceThreshold: config.performanceThreshold || 100, // ms
      
      // Structured logging
      enableStructured: config.enableStructured !== false,
      includeMetadata: config.includeMetadata !== false,
      
      // Log retention
      retentionDays: config.retentionDays || 30,
      
      ...config
    };

    this.logger = null;
    this.remoteBuffer = [];
    this.remoteTimer = null;
    this.performanceTimers = new Map();
    this.metadata = this.collectMetadata();
    
    this.initializeLogger();
    this.setupRemoteLogging();
    this.startLogRotation();
    
    // Clean up old logs on startup
    this.cleanupOldLogs();
  }

  /**
   * Initialize the Winston logger with transports and configuration
   */
  initializeLogger() {
    try {
      // Ensure log directory exists
      if (!fs.existsSync(this.config.logDir)) {
        fs.mkdirSync(this.config.logDir, { recursive: true });
      }

      // Create custom format
      const customFormat = winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        winston.format.errors({ stack: true }),
        this.config.enableStructured ? winston.format.json() : winston.format.printf(this.formatMessage.bind(this))
      );

      // Create transports array
      const transports = [];

      // File transport with rotation
      transports.push(new winston.transports.File({
        filename: path.join(this.config.logDir, 'app.log'),
        maxsize: this.config.maxFileSize,
        maxFiles: this.config.maxFiles,
        format: customFormat
      }));

      // Error-only file transport
      transports.push(new winston.transports.File({
        filename: path.join(this.config.logDir, 'errors.log'),
        level: 'error',
        maxsize: this.config.maxFileSize,
        maxFiles: this.config.maxFiles,
        format: customFormat
      }));

      // Performance log transport (if enabled)
      if (this.config.enablePerformance) {
        transports.push(new winston.transports.File({
          filename: path.join(this.config.logDir, 'performance.log'),
          level: 'info',
          maxsize: this.config.maxFileSize,
          maxFiles: this.config.maxFiles,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
            winston.format((info) => {
              return info.type === 'performance' ? info : false;
            })()
          )
        }));
      }

      // Console transport (if enabled)
      if (this.config.enableConsole) {
        const consoleFormat = this.config.colorizeConsole 
          ? winston.format.combine(
              winston.format.colorize(),
              winston.format.simple()
            )
          : winston.format.simple();

        transports.push(new winston.transports.Console({
          format: consoleFormat
        }));
      }

      // Create logger instance
      this.logger = winston.createLogger({
        level: this.config.level,
        format: customFormat,
        transports,
        exceptionHandlers: [
          new winston.transports.File({ 
            filename: path.join(this.config.logDir, 'exceptions.log'),
            maxsize: this.config.maxFileSize,
            maxFiles: 3
          })
        ],
        rejectionHandlers: [
          new winston.transports.File({ 
            filename: path.join(this.config.logDir, 'rejections.log'),
            maxsize: this.config.maxFileSize,
            maxFiles: 3
          })
        ]
      });

      this.info('LogManager initialized successfully', {
        level: this.config.level,
        logDir: this.config.logDir,
        enableRemote: this.config.enableRemote
      });

    } catch (error) {
      console.error('Failed to initialize LogManager:', error);
      // Create fallback logger
      this.logger = {
        debug: console.debug.bind(console),
        info: console.info.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console)
      };
    }
  }

  /**
   * Format log message with metadata
   */
  formatMessage(info) {
    let message = `${info.timestamp} [${info.level.toUpperCase()}]`;
    
    if (this.config.includeMetadata && info.component) {
      message += ` [${info.component}]`;
    }
    
    message += `: ${info.message}`;
    
    if (info.stack) {
      message += `\n${info.stack}`;
    }
    
    if (info.data && Object.keys(info.data).length > 0) {
      message += `\nData: ${JSON.stringify(info.data, null, 2)}`;
    }
    
    return message;
  }

  /**
   * Set up remote logging if enabled
   */
  setupRemoteLogging() {
    if (!this.config.enableRemote || !this.config.remoteEndpoint) {
      return;
    }

    // Start remote flush timer
    this.remoteTimer = setInterval(() => {
      this.flushRemoteLogs();
    }, this.config.remoteFlushInterval);

    this.debug('Remote logging enabled', {
      endpoint: this.config.remoteEndpoint,
      batchSize: this.config.remoteBatchSize,
      flushInterval: this.config.remoteFlushInterval
    });
  }

  /**
   * Start log rotation timer
   */
  startLogRotation() {
    // Rotate logs daily at midnight
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    setTimeout(() => {
      this.rotateLogs();
      // Set up daily rotation
      setInterval(() => {
        this.rotateLogs();
      }, 24 * 60 * 60 * 1000); // 24 hours
    }, msUntilMidnight);
  }

  /**
   * Rotate log files
   */
  rotateLogs() {
    try {
      const dateStr = new Date().toISOString().split('T')[0];
      const logFiles = fs.readdirSync(this.config.logDir);
      
      for (const file of logFiles) {
        if (file.endsWith('.log')) {
          const oldPath = path.join(this.config.logDir, file);
          const newPath = path.join(this.config.logDir, `${file}.${dateStr}`);
          
          if (fs.existsSync(oldPath) && fs.statSync(oldPath).size > 0) {
            fs.renameSync(oldPath, newPath);
          }
        }
      }
      
      this.info('Log rotation completed', { date: dateStr });
    } catch (error) {
      this.error('Log rotation failed', error);
    }
  }

  /**
   * Clean up old log files based on retention policy
   */
  cleanupOldLogs() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
      
      const logFiles = fs.readdirSync(this.config.logDir);
      let deletedCount = 0;
      
      for (const file of logFiles) {
        const filePath = path.join(this.config.logDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }
      
      if (deletedCount > 0) {
        this.info(`Cleaned up ${deletedCount} old log files`, {
          retentionDays: this.config.retentionDays,
          cutoffDate: cutoffDate.toISOString()
        });
      }
    } catch (error) {
      this.error('Log cleanup failed', error);
    }
  }

  /**
   * Collect system metadata for log context
   */
  collectMetadata() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      appVersion: app ? app.getVersion() : 'unknown',
      hostname: os.hostname(),
      pid: process.pid,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Log debug message
   */
  debug(message, data = {}, component = null) {
    this.log('debug', message, data, component);
  }

  /**
   * Log info message
   */
  info(message, data = {}, component = null) {
    this.log('info', message, data, component);
  }

  /**
   * Log warning message
   */
  warn(message, data = {}, component = null) {
    this.log('warn', message, data, component);
  }

  /**
   * Log error message
   */
  error(message, error = null, component = null) {
    const data = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code
    } : error || {};
    
    this.log('error', message, data, component);
  }

  /**
   * Core logging method
   */
  log(level, message, data = {}, component = null) {
    if (!this.logger) {
      console.log(`[${level.toUpperCase()}] ${message}`, data);
      return;
    }

    const logData = {
      message,
      level,
      data,
      component,
      timestamp: new Date().toISOString()
    };

    if (this.config.includeMetadata) {
      logData.metadata = this.metadata;
    }

    this.logger.log(level, message, logData);

    // Add to remote buffer if remote logging enabled
    if (this.config.enableRemote) {
      this.remoteBuffer.push(logData);
      
      if (this.remoteBuffer.length >= this.config.remoteBatchSize) {
        this.flushRemoteLogs();
      }
    }

    // Emit event for real-time log monitoring
    this.emit('log', logData);
  }

  /**
   * Start performance timer
   */
  startPerformanceTimer(label, component = null) {
    if (!this.config.enablePerformance) return;
    
    this.performanceTimers.set(label, {
      start: process.hrtime.bigint(),
      component
    });
  }

  /**
   * End performance timer and log if threshold exceeded
   */
  endPerformanceTimer(label, data = {}) {
    if (!this.config.enablePerformance || !this.performanceTimers.has(label)) {
      return;
    }
    
    const timer = this.performanceTimers.get(label);
    const duration = Number(process.hrtime.bigint() - timer.start) / 1000000; // Convert to ms
    
    this.performanceTimers.delete(label);
    
    const logData = {
      type: 'performance',
      label,
      duration,
      threshold: this.config.performanceThreshold,
      ...data
    };
    
    if (duration >= this.config.performanceThreshold) {
      this.warn(`Performance threshold exceeded: ${label}`, logData, timer.component);
    } else {
      this.debug(`Performance timer: ${label}`, logData, timer.component);
    }
    
    return duration;
  }

  /**
   * Log performance metrics
   */
  logPerformance(label, duration, data = {}, component = null) {
    if (!this.config.enablePerformance) return;
    
    const logData = {
      type: 'performance',
      label,
      duration,
      threshold: this.config.performanceThreshold,
      ...data
    };
    
    this.info(`Performance: ${label} (${duration}ms)`, logData, component);
  }

  /**
   * Flush remote logs to endpoint
   */
  async flushRemoteLogs() {
    if (!this.config.enableRemote || this.remoteBuffer.length === 0) {
      return;
    }

    const logsToSend = [...this.remoteBuffer];
    this.remoteBuffer = [];

    try {
      const fetch = await import('node-fetch').then(mod => mod.default);
      
      const response = await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': `MacroKeyboard/${this.metadata.appVersion}`
        },
        body: JSON.stringify({
          logs: logsToSend,
          metadata: this.metadata,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Remote logging failed: ${response.status} ${response.statusText}`);
      }

      this.debug(`Sent ${logsToSend.length} logs to remote endpoint`);
    } catch (error) {
      // Put logs back in buffer for retry
      this.remoteBuffer.unshift(...logsToSend);
      this.error('Failed to send logs to remote endpoint', error, 'LogManager');
    }
  }

  /**
   * Get recent logs for UI display
   */
  getRecentLogs(count = 100, level = null) {
    try {
      const logFile = path.join(this.config.logDir, 'app.log');
      if (!fs.existsSync(logFile)) {
        return [];
      }

      const content = fs.readFileSync(logFile, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      const recentLines = lines.slice(-count);
      
      const logs = recentLines.map(line => {
        try {
          if (this.config.enableStructured) {
            const parsed = JSON.parse(line);
            return parsed;
          } else {
            // Parse formatted log line
            const match = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}) \[(\w+)\](?:\s\[([^\]]+)\])?: (.+)$/);
            if (match) {
              return {
                timestamp: match[1],
                level: match[2].toLowerCase(),
                component: match[3] || null,
                message: match[4]
              };
            }
            return { message: line, level: 'info', timestamp: new Date().toISOString() };
          }
        } catch (error) {
          return { message: line, level: 'info', timestamp: new Date().toISOString() };
        }
      });

      return level ? logs.filter(log => log.level === level) : logs;
    } catch (error) {
      this.error('Failed to get recent logs', error);
      return [];
    }
  }

  /**
   * Get log statistics
   */
  getLogStatistics() {
    try {
      const stats = {
        totalSize: 0,
        fileCount: 0,
        logCounts: { debug: 0, info: 0, warn: 0, error: 0 },
        oldestLog: null,
        newestLog: null
      };

      const logFiles = fs.readdirSync(this.config.logDir);
      
      for (const file of logFiles) {
        if (file.endsWith('.log')) {
          const filePath = path.join(this.config.logDir, file);
          const fileStat = fs.statSync(filePath);
          
          stats.totalSize += fileStat.size;
          stats.fileCount++;
          
          if (!stats.oldestLog || fileStat.mtime < stats.oldestLog) {
            stats.oldestLog = fileStat.mtime;
          }
          
          if (!stats.newestLog || fileStat.mtime > stats.newestLog) {
            stats.newestLog = fileStat.mtime;
          }
        }
      }
      
      // Count log levels from recent logs
      const recentLogs = this.getRecentLogs(1000);
      for (const log of recentLogs) {
        if (stats.logCounts.hasOwnProperty(log.level)) {
          stats.logCounts[log.level]++;
        }
      }

      return stats;
    } catch (error) {
      this.error('Failed to get log statistics', error);
      return null;
    }
  }

  /**
   * Update logging configuration
   */
  updateConfiguration(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    // Reinitialize logger with new configuration
    this.initializeLogger();
    
    this.info('Logging configuration updated', newConfig);
  }

  /**
   * Export logs for external analysis
   */
  exportLogs(startDate = null, endDate = null, format = 'json') {
    try {
      const logs = this.getRecentLogs(10000);
      let filteredLogs = logs;
      
      if (startDate || endDate) {
        filteredLogs = logs.filter(log => {
          const logDate = new Date(log.timestamp);
          if (startDate && logDate < new Date(startDate)) return false;
          if (endDate && logDate > new Date(endDate)) return false;
          return true;
        });
      }
      
      if (format === 'csv') {
        const csvHeader = 'timestamp,level,component,message\n';
        const csvRows = filteredLogs.map(log => 
          `${log.timestamp},${log.level},${log.component || ''},${JSON.stringify(log.message)}`
        ).join('\n');
        
        return csvHeader + csvRows;
      }
      
      return JSON.stringify(filteredLogs, null, 2);
    } catch (error) {
      this.error('Failed to export logs', error);
      return null;
    }
  }

  /**
   * Clean up resources
   */
  cleanup() {
    if (this.remoteTimer) {
      clearInterval(this.remoteTimer);
      this.remoteTimer = null;
    }
    
    // Flush any remaining remote logs
    if (this.remoteBuffer.length > 0) {
      this.flushRemoteLogs().catch(error => {
        console.error('Failed to flush logs during cleanup:', error);
      });
    }
    
    this.performanceTimers.clear();
    
    this.info('LogManager cleanup completed');
  }
}

module.exports = LogManager;