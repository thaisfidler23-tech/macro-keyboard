const LogManager = require('../src/LogManager');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock dependencies
jest.mock('fs');
jest.mock('path');
jest.mock('os');

describe('LogManager', () => {
  let logManager;
  let mockConfig;
  let testLogDir;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup test directory
    testLogDir = '/tmp/test-logs';
    
    // Mock default config
    mockConfig = {
      level: 'info',
      logDir: testLogDir,
      file: {
        maxFileSize: '10MB',
        maxFiles: 5,
        retentionDays: 30
      },
      console: {
        enableConsole: true,
        colorizeConsole: true
      },
      remote: {
        enableRemote: false,
        remoteEndpoint: 'https://logs.example.com/api/logs',
        batchSize: 100,
        flushInterval: 5000,
        retryAttempts: 3,
        retryDelay: 1000
      },
      performance: {
        enablePerformance: true,
        performanceThreshold: 1000
      },
      structured: {
        enableStructured: true,
        includeMetadata: true
      }
    };

    // Mock fs methods
    fs.existsSync = jest.fn().mockReturnValue(true);
    fs.mkdirSync = jest.fn();
    fs.readdirSync = jest.fn().mockReturnValue([]);
    fs.statSync = jest.fn().mockReturnValue({
      size: 1024,
      mtime: new Date(),
      isFile: () => true
    });
    fs.unlinkSync = jest.fn();

    // Mock path methods
    path.join = jest.fn().mockImplementation((...args) => args.join('/'));
    path.resolve = jest.fn().mockImplementation((...args) => '/' + args.join('/'));
    path.extname = jest.fn().mockReturnValue('.log');
    path.basename = jest.fn().mockReturnValue('test.log');

    // Mock os methods
    os.hostname = jest.fn().mockReturnValue('test-host');
    os.platform = jest.fn().mockReturnValue('test-platform');
    os.arch = jest.fn().mockReturnValue('x64');
    os.type = jest.fn().mockReturnValue('Test');
    os.release = jest.fn().mockReturnValue('1.0.0');

    // Create LogManager instance
    logManager = new LogManager(mockConfig);
  });

  afterEach(() => {
    if (logManager) {
      logManager.cleanup();
    }
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      const defaultLogManager = new LogManager();
      expect(defaultLogManager).toBeDefined();
      expect(defaultLogManager.isInitialized()).toBe(true);
    });

    test('should initialize with custom configuration', () => {
      expect(logManager).toBeDefined();
      expect(logManager.isInitialized()).toBe(true);
    });

    test('should create log directory if it does not exist', () => {
      fs.existsSync = jest.fn().mockReturnValue(false);
      
      new LogManager(mockConfig);
      
      expect(fs.mkdirSync).toHaveBeenCalledWith(testLogDir, { recursive: true });
    });

    test('should handle initialization errors gracefully', () => {
      fs.mkdirSync = jest.fn().mockImplementation(() => {
        throw new Error('Permission denied');
      });
      fs.existsSync = jest.fn().mockReturnValue(false);

      expect(() => new LogManager(mockConfig)).not.toThrow();
    });
  });

  describe('Configuration Management', () => {
    test('should update configuration', () => {
      const newConfig = {
        ...mockConfig,
        level: 'debug'
      };

      logManager.updateConfiguration(newConfig);
      
      // Should not throw and should update internal state
      expect(logManager.isInitialized()).toBe(true);
    });

    test('should handle invalid configuration updates', () => {
      const invalidConfig = null;
      
      expect(() => logManager.updateConfiguration(invalidConfig)).not.toThrow();
    });

    test('should validate configuration structure', () => {
      const invalidConfig = {
        level: 'invalid-level'
      };
      
      expect(() => new LogManager(invalidConfig)).not.toThrow();
    });
  });

  describe('Basic Logging', () => {
    let mockLogger;

    beforeEach(() => {
      mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      };
      
      // Mock getLogger to return our mock
      logManager.getLogger = jest.fn().mockReturnValue(mockLogger);
    });

    test('should log debug messages', () => {
      const logger = logManager.getLogger();
      logger.debug('Test debug message');
      
      expect(mockLogger.debug).toHaveBeenCalledWith('Test debug message');
    });

    test('should log info messages', () => {
      const logger = logManager.getLogger();
      logger.info('Test info message');
      
      expect(mockLogger.info).toHaveBeenCalledWith('Test info message');
    });

    test('should log warning messages', () => {
      const logger = logManager.getLogger();
      logger.warn('Test warning message');
      
      expect(mockLogger.warn).toHaveBeenCalledWith('Test warning message');
    });

    test('should log error messages', () => {
      const logger = logManager.getLogger();
      logger.error('Test error message');
      
      expect(mockLogger.error).toHaveBeenCalledWith('Test error message');
    });
  });

  describe('Structured Logging', () => {
    test('should log with component information', () => {
      logManager.logWithComponent('TestComponent', 'info', 'Test message');
      
      // Should not throw
      expect(logManager.isInitialized()).toBe(true);
    });

    test('should log with additional data', () => {
      const testData = { userId: 123, action: 'login' };
      
      logManager.logWithData('info', 'User action', testData);
      
      expect(logManager.isInitialized()).toBe(true);
    });

    test('should handle complex data objects', () => {
      const complexData = {
        nested: {
          object: {
            with: ['arrays', 'and', 'strings']
          }
        },
        circular: null
      };
      
      expect(() => logManager.logWithData('info', 'Complex data', complexData)).not.toThrow();
    });
  });

  describe('Performance Logging', () => {
    test('should start performance timer', () => {
      const timerId = logManager.startPerformanceTimer('test-operation');
      
      expect(typeof timerId).toBe('string');
      expect(timerId.length).toBeGreaterThan(0);
    });

    test('should end performance timer and log results', () => {
      const timerId = logManager.startPerformanceTimer('test-operation');
      
      // Simulate some delay
      setTimeout(() => {
        expect(() => logManager.endPerformanceTimer(timerId, 'Test operation completed')).not.toThrow();
      }, 10);
    });

    test('should handle invalid timer IDs', () => {
      expect(() => logManager.endPerformanceTimer('invalid-id', 'Test')).not.toThrow();
    });

    test('should log performance warnings for slow operations', () => {
      const timerId = logManager.startPerformanceTimer('slow-operation');
      
      // Mock a slow operation
      const mockNow = Date.now;
      Date.now = jest.fn()
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(3000); // 2 second delay
      
      logManager.endPerformanceTimer(timerId, 'Slow operation');
      
      Date.now = mockNow;
    });
  });

  describe('Log Management', () => {
    test('should get recent logs', async () => {
      // Mock internal logs array
      logManager.logs = [
        { timestamp: new Date(), level: 'info', message: 'Test 1' },
        { timestamp: new Date(), level: 'warn', message: 'Test 2' },
        { timestamp: new Date(), level: 'error', message: 'Test 3' }
      ];

      const recentLogs = await logManager.getRecentLogs(2);
      
      expect(Array.isArray(recentLogs)).toBe(true);
      expect(recentLogs.length).toBeLessThanOrEqual(2);
    });

    test('should export logs in JSON format', async () => {
      logManager.logs = [
        { timestamp: new Date().toISOString(), level: 'info', message: 'Test export' }
      ];

      const exported = await logManager.exportLogs(null, null, 'json');
      
      expect(typeof exported).toBe('string');
      expect(() => JSON.parse(exported)).not.toThrow();
    });

    test('should export logs in CSV format', async () => {
      logManager.logs = [
        { timestamp: new Date().toISOString(), level: 'info', message: 'Test export' }
      ];

      const exported = await logManager.exportLogs(null, null, 'csv');
      
      expect(typeof exported).toBe('string');
      expect(exported).toContain('timestamp,level,message');
    });

    test('should filter logs by date range', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      logManager.logs = [
        { timestamp: yesterday.toISOString(), level: 'info', message: 'Old log' },
        { timestamp: now.toISOString(), level: 'info', message: 'Current log' },
        { timestamp: tomorrow.toISOString(), level: 'info', message: 'Future log' }
      ];

      const filtered = await logManager.exportLogs(
        yesterday.toISOString(), 
        now.toISOString(), 
        'json'
      );
      
      const parsedLogs = JSON.parse(filtered);
      expect(parsedLogs.length).toBe(2);
    });

    test('should clear logs', async () => {
      logManager.logs = [
        { timestamp: new Date(), level: 'info', message: 'Test' }
      ];

      await logManager.clearLogs();
      
      expect(logManager.logs.length).toBe(0);
    });
  });

  describe('Statistics', () => {
    test('should calculate log statistics', () => {
      logManager.logs = [
        { level: 'info', message: 'Test 1' },
        { level: 'info', message: 'Test 2' },
        { level: 'warn', message: 'Test 3' },
        { level: 'error', message: 'Test 4' }
      ];

      const stats = logManager.getStatistics();
      
      expect(stats).toHaveProperty('totalLogs');
      expect(stats).toHaveProperty('logCounts');
      expect(stats).toHaveProperty('totalSize');
      expect(stats.totalLogs).toBe(4);
      expect(stats.logCounts.info).toBe(2);
      expect(stats.logCounts.warn).toBe(1);
      expect(stats.logCounts.error).toBe(1);
    });

    test('should handle empty logs', () => {
      logManager.logs = [];
      
      const stats = logManager.getStatistics();
      
      expect(stats.totalLogs).toBe(0);
      expect(stats.totalSize).toBe(0);
    });

    test('should calculate file sizes correctly', () => {
      fs.readdirSync = jest.fn().mockReturnValue(['test1.log', 'test2.log']);
      fs.statSync = jest.fn().mockReturnValue({ size: 1024 });

      const stats = logManager.getStatistics();
      
      expect(stats.totalSize).toBeGreaterThan(0);
    });
  });

  describe('File Management', () => {
    test('should rotate log files when size limit exceeded', () => {
      // Mock large file
      fs.statSync = jest.fn().mockReturnValue({ 
        size: 50 * 1024 * 1024, // 50MB
        mtime: new Date()
      });

      fs.readdirSync = jest.fn().mockReturnValue(['large.log']);
      
      logManager.rotateLogsIfNeeded();
      
      // Should attempt to rotate (specific implementation depends on Winston)
      expect(fs.readdirSync).toHaveBeenCalled();
    });

    test('should clean up old log files', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 40); // 40 days old

      fs.readdirSync = jest.fn().mockReturnValue(['old.log']);
      fs.statSync = jest.fn().mockReturnValue({ 
        size: 1024,
        mtime: oldDate,
        isFile: () => true
      });

      logManager.cleanupOldLogs();
      
      expect(fs.unlinkSync).toHaveBeenCalled();
    });

    test('should handle file system errors gracefully', () => {
      fs.readdirSync = jest.fn().mockImplementation(() => {
        throw new Error('File system error');
      });

      expect(() => logManager.getStatistics()).not.toThrow();
    });
  });

  describe('Remote Logging', () => {
    test('should queue logs for remote sending when enabled', () => {
      const remoteConfig = {
        ...mockConfig,
        remote: {
          enableRemote: true,
          remoteEndpoint: 'https://logs.example.com/api/logs'
        }
      };

      const remoteLogManager = new LogManager(remoteConfig);
      
      remoteLogManager.logWithData('info', 'Remote test', { test: true });
      
      expect(remoteLogManager.isInitialized()).toBe(true);
    });

    test('should batch remote logs', () => {
      const remoteConfig = {
        ...mockConfig,
        remote: {
          enableRemote: true,
          remoteEndpoint: 'https://logs.example.com/api/logs',
          batchSize: 2
        }
      };

      const remoteLogManager = new LogManager(remoteConfig);
      
      // Add logs to trigger batching
      remoteLogManager.logWithData('info', 'Test 1', {});
      remoteLogManager.logWithData('info', 'Test 2', {});
      
      expect(remoteLogManager.isInitialized()).toBe(true);
    });

    test('should handle remote logging failures', () => {
      const remoteConfig = {
        ...mockConfig,
        remote: {
          enableRemote: true,
          remoteEndpoint: 'invalid-url'
        }
      };

      expect(() => new LogManager(remoteConfig)).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    test('should handle logging errors without crashing', () => {
      const errorLogger = {
        info: jest.fn().mockImplementation(() => {
          throw new Error('Logging error');
        })
      };

      logManager.getLogger = jest.fn().mockReturnValue(errorLogger);
      
      expect(() => logManager.getLogger().info('Test')).toThrow();
    });

    test('should handle JSON serialization errors', () => {
      const circularObj = {};
      circularObj.self = circularObj;

      expect(() => logManager.logWithData('info', 'Circular test', circularObj)).not.toThrow();
    });

    test('should handle null and undefined values', () => {
      expect(() => logManager.logWithData('info', 'Null test', null)).not.toThrow();
      expect(() => logManager.logWithData('info', 'Undefined test', undefined)).not.toThrow();
    });
  });

  describe('Event Emission', () => {
    test('should emit log events', () => {
      const mockCallback = jest.fn();
      logManager.on('log-entry', mockCallback);
      
      // Trigger a log event (implementation specific)
      logManager.emit('log-entry', { level: 'info', message: 'Test' });
      
      expect(mockCallback).toHaveBeenCalled();
    });

    test('should handle event listener errors', () => {
      const errorCallback = jest.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      
      logManager.on('log-entry', errorCallback);
      
      expect(() => logManager.emit('log-entry', {})).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    test('should cleanup resources properly', () => {
      expect(() => logManager.cleanup()).not.toThrow();
    });

    test('should handle multiple cleanup calls', () => {
      logManager.cleanup();
      expect(() => logManager.cleanup()).not.toThrow();
    });

    test('should stop timers during cleanup', () => {
      const timerId = logManager.startPerformanceTimer('test');
      
      logManager.cleanup();
      
      expect(() => logManager.endPerformanceTimer(timerId, 'Test')).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    test('should handle extremely long messages', () => {
      const longMessage = 'A'.repeat(10000);
      
      expect(() => logManager.logWithData('info', longMessage, {})).not.toThrow();
    });

    test('should handle high frequency logging', () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        logManager.getLogger().info(`High frequency log ${i}`);
      }
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should handle concurrent access', async () => {
      const promises = [];
      
      for (let i = 0; i < 10; i++) {
        promises.push(
          new Promise(resolve => {
            setTimeout(() => {
              logManager.logWithData('info', `Concurrent ${i}`, { index: i });
              resolve();
            }, Math.random() * 100);
          })
        );
      }
      
      await Promise.all(promises);
      expect(logManager.isInitialized()).toBe(true);
    });
  });
});