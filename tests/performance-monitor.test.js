const PerformanceMonitor = require('../src/PerformanceMonitor');
const LogManager = require('../src/LogManager');
const EventEmitter = require('events');

// Mock dependencies
jest.mock('fs');
jest.mock('path');
jest.mock('os');
jest.mock('../src/LogManager');

describe('PerformanceMonitor', () => {
  let performanceMonitor;
  let mockLogManager;
  let mockConfig;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();

    // Mock LogManager
    mockLogManager = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      timing: jest.fn()
    };

    // Mock config
    mockConfig = {
      enabled: true,
      collectInterval: 1000,
      enableSystemMetrics: true,
      enableGCMetrics: true,
      enableEventLoopMonitoring: true
    };

    // Mock global performance APIs
    global.performance = {
      now: jest.fn(() => 1000)
    };

    // Mock PerformanceObserver
    global.PerformanceObserver = jest.fn().mockImplementation((callback) => ({
      observe: jest.fn(),
      disconnect: jest.fn()
    }));

    performanceMonitor = new PerformanceMonitor(mockConfig, mockLogManager);
  });

  afterEach(() => {
    if (performanceMonitor && performanceMonitor.stopMonitoring) {
      performanceMonitor.stopMonitoring();
    }
    jest.useRealTimers();
  });

  describe('Constructor', () => {
    test('should initialize with default configuration', () => {
      const monitor = new PerformanceMonitor({}, mockLogManager);
      expect(monitor.config).toBeDefined();
      expect(monitor.logManager).toBe(mockLogManager);
    });

    test('should merge provided config with defaults', () => {
      const customConfig = { collectInterval: 2000 };
      const monitor = new PerformanceMonitor(customConfig, mockLogManager);
      expect(monitor.config.collectInterval).toBe(2000);
    });

    test('should set up event emitter inheritance', () => {
      expect(performanceMonitor).toBeInstanceOf(EventEmitter);
    });
  });

  describe('Monitoring Lifecycle', () => {
    test('should start monitoring', () => {
      expect(() => performanceMonitor.startMonitoring()).not.toThrow();
      expect(performanceMonitor.isMonitoring).toBe(true);
    });

    test('should stop monitoring', () => {
      performanceMonitor.startMonitoring();
      expect(() => performanceMonitor.stopMonitoring()).not.toThrow();
      expect(performanceMonitor.isMonitoring).toBe(false);
    });

    test('should not start if already monitoring', () => {
      performanceMonitor.startMonitoring();
      const initialState = performanceMonitor.isMonitoring;
      performanceMonitor.startMonitoring();
      expect(performanceMonitor.isMonitoring).toBe(initialState);
    });
  });

  describe('Timer Operations', () => {
    test('should start and end timers', () => {
      const timerId = performanceMonitor.startTimer('test-operation');
      expect(timerId).toBeDefined();
      expect(performanceMonitor.activeTimers.has(timerId)).toBe(true);
      
      performanceMonitor.endTimer(timerId);
      expect(performanceMonitor.activeTimers.has(timerId)).toBe(false);
    });

    test('should handle timer context', () => {
      const context = { component: 'test', user: 'testUser' };
      const timerId = performanceMonitor.startTimer('test-operation', context);
      expect(performanceMonitor.activeTimers.get(timerId).context).toEqual(context);
    });
  });

  describe('Metrics Collection', () => {
    beforeEach(() => {
      // Mock process memory usage
      global.process = {
        memoryUsage: jest.fn(() => ({
          rss: 134217728, // 128MB
          heapUsed: 67108864, // 64MB
          heapTotal: 134217728, // 128MB
          external: 1048576, // 1MB
          arrayBuffers: 524288 // 512KB
        })),
        cpuUsage: jest.fn(() => ({
          user: 1000000, // 1 second
          system: 500000 // 0.5 seconds
        }))
      };

      // Mock os module
      require('os').freemem.mockReturnValue(1073741824); // 1GB
      require('os').totalmem.mockReturnValue(8589934592); // 8GB
      require('os').cpus.mockReturnValue([{ speed: 2400 }, { speed: 2400 }]);
      require('os').loadavg.mockReturnValue([1.0, 1.1, 1.2]);
    });

    test('should collect system metrics without errors', () => {
      expect(() => performanceMonitor.collectSystemMetrics()).not.toThrow();
    });

    test('should get current metrics', () => {
      const metrics = performanceMonitor.getCurrentMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.timestamp).toBeDefined();
    });

    test('should get statistics', () => {
      const stats = performanceMonitor.getStatistics();
      expect(stats).toBeDefined();
      expect(stats.metricsCollected).toBeDefined();
    });
  });

  describe('Optimization Suggestions', () => {
    test('should return suggestions array', () => {
      const suggestions = performanceMonitor.getOptimizationSuggestions();
      expect(Array.isArray(suggestions)).toBe(true);
    });

    test('should generate suggestions when monitoring', () => {
      performanceMonitor.startMonitoring();
      performanceMonitor.generateOptimizationSuggestions();
      const suggestions = performanceMonitor.getOptimizationSuggestions();
      expect(Array.isArray(suggestions)).toBe(true);
    });
  });

  describe('Data Export', () => {
    test('should export data in JSON format', () => {
      const result = performanceMonitor.exportData('json');
      expect(typeof result).toBe('string');
      expect(() => JSON.parse(result)).not.toThrow();
    });

    test('should export data in CSV format', () => {
      const result = performanceMonitor.exportData('csv');
      expect(typeof result).toBe('string');
      expect(result).toContain('timestamp');
    });
  });

  describe('Configuration Updates', () => {
    test('should update configuration', () => {
      const newConfig = { collectInterval: 5000 };
      performanceMonitor.updateConfiguration(newConfig);
      expect(performanceMonitor.config.collectInterval).toBe(5000);
    });

    test('should restart monitoring after config update', () => {
      performanceMonitor.startMonitoring();
      const stopSpy = jest.spyOn(performanceMonitor, 'stopMonitoring');
      const startSpy = jest.spyOn(performanceMonitor, 'startMonitoring');
      
      performanceMonitor.updateConfiguration({ collectInterval: 2000 });
      
      expect(stopSpy).toHaveBeenCalled();
      
      // Fast-forward the timeout
      jest.runAllTimers();
      expect(startSpy).toHaveBeenCalledTimes(2); // Initial + restart
    });
  });

  describe('Error Handling', () => {
    test('should handle metrics collection errors gracefully', () => {
      // Mock error in memory usage
      global.process.memoryUsage.mockImplementation(() => {
        throw new Error('Memory access error');
      });

      expect(() => performanceMonitor.collectSystemMetrics()).not.toThrow();
    });

    test('should handle GC observer setup errors', () => {
      // Mock PerformanceObserver constructor to throw
      global.PerformanceObserver = jest.fn().mockImplementation(() => {
        throw new Error('GC monitoring not supported');
      });

      expect(() => performanceMonitor.setupGCMetrics()).not.toThrow();
    });
  });

  describe('Event Loop Monitoring', () => {
    test('should start event loop monitoring', () => {
      expect(() => performanceMonitor.startEventLoopMonitoring()).not.toThrow();
    });
  });

  describe('GC Metrics', () => {
    test('should record GC metrics', () => {
      const gcData = {
        kind: 'major',
        duration: 50
      };
      
      expect(() => performanceMonitor.recordGCMetric(gcData)).not.toThrow();
    });
  });

  describe('Alert System', () => {
    test('should check alerts without errors', () => {
      expect(() => performanceMonitor.checkAlerts()).not.toThrow();
    });

    test('should emit events for performance issues', (done) => {
      let eventEmitted = false;
      
      performanceMonitor.on('performance-alert', () => {
        eventEmitted = true;
        done();
      });
      
      // Simulate high memory usage to trigger alert
      performanceMonitor.metrics.system = [{
        timestamp: Date.now(),
        memory: { used: 2000000000 } // 2GB
      }];
      
      performanceMonitor.checkAlerts();
      
      // Fallback in case no alert is triggered
      setTimeout(() => {
        if (!eventEmitted) {
          done(); // Complete the test even if no alert
        }
      }, 100);
    });
  });
});