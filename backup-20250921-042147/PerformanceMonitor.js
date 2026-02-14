const EventEmitter = require('events');
const os = require('os');
const process = require('process');
const fs = require('fs');
const path = require('path');

/**
 * PerformanceMonitor - Comprehensive performance monitoring and analysis
 *
 * Features:
 * - Real-time system metrics collection (CPU, memory, event loop)
 * - Application-specific performance tracking
 * - Performance trend analysis and alerting
 * - Memory leak detection
 * - Optimization recommendations
 * - Integration with LogManager for performance logging
 */
class PerformanceMonitor extends EventEmitter {
  constructor(config = {}, logManager = null) {
    super();

    this.config = this.mergeConfig(config);
    this.logManager = logManager;
    this.isInitialized = false;
    this.isMonitoring = false;

    // Monitoring intervals
    this.systemMetricsInterval = null;
    this.gcMetricsInterval = null;
    this.eventLoopLagInterval = null;
    this.alertCheckInterval = null;

    // Performance data storage
    this.metrics = {
      system: [],
      application: [],
      eventLoop: [],
      gc: [],
      custom: new Map()
    };

    // Performance thresholds and alerts
    this.thresholds = {
      memory: {
        heapUsed: 100 * 1024 * 1024, // 100MB
        rss: 200 * 1024 * 1024,      // 200MB
        external: 50 * 1024 * 1024   // 50MB
      },
      cpu: {
        usage: 80  // 80% CPU usage
      },
      eventLoop: {
        lag: 100   // 100ms event loop lag
      },
      gc: {
        duration: 50,  // 50ms GC pause
        frequency: 10  // GC runs per minute
      }
    };

    // Active performance timers
    this.activeTimers = new Map();
    this.timerHistory = [];

    // Optimization suggestions
    this.suggestions = [];
    this.lastSuggestionCheck = Date.now();

    // Historical data retention
    this.maxHistorySize = this.config.maxHistorySize || 1000;
    this.retentionPeriod = this.config.retentionPeriod || 24 * 60 * 60 * 1000; // 24 hours

    this.init();
  }

  /**
   * Merge default configuration with user config
   */
  mergeConfig(userConfig) {
    const defaultConfig = {
      enabled: true,
      collectInterval: 5000,        // 5 seconds
      gcMetricsInterval: 10000,     // 10 seconds
      eventLoopInterval: 1000,      // 1 second
      alertCheckInterval: 30000,    // 30 seconds
      enableSystemMetrics: true,
      enableApplicationMetrics: true,
      enableGCMetrics: true,
      enableEventLoopMonitoring: true,
      enableOptimizationSuggestions: true,
      maxHistorySize: 1000,
      retentionPeriod: 24 * 60 * 60 * 1000,
      exportEnabled: true,
      realTimeUpdates: true
    };

    return { ...defaultConfig, ...userConfig };
  }

  /**
   * Initialize the performance monitor
   */
  init() {
    try {
      if (!this.config.enabled) {
        this.log('info', 'Performance monitoring is disabled in configuration');
        return;
      }

      this.setupGCMetrics();
      this.isInitialized = true;

      this.log('info', 'PerformanceMonitor initialized successfully');

      // Start monitoring if auto-start is enabled
      if (this.config.autoStart !== false) {
        this.startMonitoring();
      }
    } catch (error) {
      this.log('error', 'Failed to initialize PerformanceMonitor', { error: error.message });
    }
  }

  /**
   * Setup garbage collection metrics monitoring
   */
  setupGCMetrics() {
    try {
      // Enable GC metrics collection
      if (process.env.NODE_ENV !== 'production') {
        process.env.NODE_OPTIONS = '--expose-gc';
      }

      // Set up performance observation for GC events
      if (typeof performance !== 'undefined' && performance.observe) {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'gc') {
              this.recordGCMetric({
                type: entry.name,
                duration: entry.duration,
                timestamp: Date.now()
              });
            }
          }
        });

        observer.observe({ entryTypes: ['gc'] });
        this.gcObserver = observer;
      }
    } catch (error) {
      this.log('warn', 'Failed to setup GC metrics monitoring', { error: error.message });
    }
  }

  /**
   * Start performance monitoring
   */
  startMonitoring() {
    if (!this.isInitialized || this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;

    // Start system metrics collection
    if (this.config.enableSystemMetrics) {
      this.systemMetricsInterval = setInterval(() => {
        this.collectSystemMetrics();
      }, this.config.collectInterval);
    }

    // Start event loop lag monitoring
    if (this.config.enableEventLoopMonitoring) {
      this.startEventLoopMonitoring();
    }

    // Start alert checking
    this.alertCheckInterval = setInterval(() => {
      this.checkAlerts();
    }, this.config.alertCheckInterval);

    // Start optimization suggestions
    if (this.config.enableOptimizationSuggestions) {
      setTimeout(() => {
        this.generateOptimizationSuggestions();
      }, 60000); // Wait 1 minute before first suggestions
    }

    this.log('info', 'Performance monitoring started');
    this.emit('monitoring-started');
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    // Clear all intervals
    if (this.systemMetricsInterval) {
      clearInterval(this.systemMetricsInterval);
      this.systemMetricsInterval = null;
    }

    if (this.eventLoopLagInterval) {
      clearInterval(this.eventLoopLagInterval);
      this.eventLoopLagInterval = null;
    }

    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval);
      this.alertCheckInterval = null;
    }

    // Clean up GC observer
    if (this.gcObserver) {
      this.gcObserver.disconnect();
      this.gcObserver = null;
    }

    this.log('info', 'Performance monitoring stopped');
    this.emit('monitoring-stopped');
  }

  /**
   * Collect system performance metrics
   */
  collectSystemMetrics() {
    try {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      const uptime = process.uptime();

      const systemMetric = {
        timestamp: Date.now(),
        memory: {
          rss: memoryUsage.rss,
          heapTotal: memoryUsage.heapTotal,
          heapUsed: memoryUsage.heapUsed,
          external: memoryUsage.external,
          arrayBuffers: memoryUsage.arrayBuffers || 0
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        },
        system: {
          uptime,
          loadAverage: os.loadavg(),
          freeMemory: os.freemem(),
          totalMemory: os.totalmem(),
          platform: os.platform(),
          arch: os.arch()
        }
      };

      // Add to metrics collection
      this.addMetric('system', systemMetric);

      // Emit real-time update
      if (this.config.realTimeUpdates) {
        this.emit('system-metrics', systemMetric);
      }
    } catch (error) {
      this.log('error', 'Failed to collect system metrics', { error: error.message });
    }
  }

  /**
   * Start event loop lag monitoring
   */
  startEventLoopMonitoring() {
    let lastTime = process.hrtime.bigint();

    this.eventLoopLagInterval = setInterval(() => {
      const currentTime = process.hrtime.bigint();
      const lag = Number(currentTime - lastTime - BigInt(this.config.eventLoopInterval * 1000000)) / 1000000;

      const lagMetric = {
        timestamp: Date.now(),
        lag: Math.max(0, lag)
      };

      this.addMetric('eventLoop', lagMetric);

      if (this.config.realTimeUpdates) {
        this.emit('event-loop-lag', lagMetric);
      }

      lastTime = currentTime;
    }, this.config.eventLoopInterval);
  }

  /**
   * Record a garbage collection metric
   */
  recordGCMetric(gcData) {
    const gcMetric = {
      timestamp: Date.now(),
      ...gcData
    };

    this.addMetric('gc', gcMetric);

    if (this.config.realTimeUpdates) {
      this.emit('gc-metrics', gcMetric);
    }
  }

  /**
   * Start a performance timer for custom operations
   */
  startTimer(operationName, context = {}) {
    const timerId = `${operationName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const timer = {
      id: timerId,
      operation: operationName,
      startTime: process.hrtime.bigint(),
      startTimestamp: Date.now(),
      context
    };

    this.activeTimers.set(timerId, timer);

    return timerId;
  }

  /**
   * End a performance timer and record the measurement
   */
  endTimer(timerId, additionalContext = {}) {
    const timer = this.activeTimers.get(timerId);

    if (!timer) {
      this.log('warn', 'Attempted to end non-existent timer', { timerId });
      return null;
    }

    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - timer.startTime) / 1000000; // Convert to milliseconds

    const measurement = {
      operation: timer.operation,
      duration,
      startTimestamp: timer.startTimestamp,
      endTimestamp: Date.now(),
      context: { ...timer.context, ...additionalContext }
    };

    // Add to application metrics
    this.addMetric('application', measurement);

    // Add to timer history
    this.timerHistory.push(measurement);
    if (this.timerHistory.length > this.maxHistorySize) {
      this.timerHistory.shift();
    }

    // Remove from active timers
    this.activeTimers.delete(timerId);

    // Emit real-time update
    if (this.config.realTimeUpdates) {
      this.emit('performance-measurement', measurement);
    }

    // Log slow operations
    if (duration > 100) { // Log operations over 100ms
      this.log('warn', `Slow operation detected: ${timer.operation}`, {
        duration: `${duration.toFixed(2)}ms`,
        context: measurement.context
      });
    }

    return measurement;
  }

  /**
   * Add a metric to the appropriate collection
   */
  addMetric(type, metric) {
    if (!this.metrics[type]) {
      this.metrics[type] = [];
    }

    this.metrics[type].push(metric);

    // Enforce size limits
    if (this.metrics[type].length > this.maxHistorySize) {
      this.metrics[type].shift();
    }

    // Clean up old data
    this.cleanupOldMetrics(type);
  }

  /**
   * Clean up old metrics beyond retention period
   */
  cleanupOldMetrics(type) {
    const cutoffTime = Date.now() - this.retentionPeriod;

    this.metrics[type] = this.metrics[type].filter(metric =>
      metric.timestamp > cutoffTime
    );
  }

  /**
   * Check performance thresholds and emit alerts
   */
  checkAlerts() {
    try {
      const currentMetrics = this.getCurrentMetrics();
      const alerts = [];

      // Memory alerts
      if (currentMetrics.memory) {
        if (currentMetrics.memory.heapUsed > this.thresholds.memory.heapUsed) {
          alerts.push({
            type: 'memory',
            severity: 'warning',
            message: `High heap memory usage: ${this.formatBytes(currentMetrics.memory.heapUsed)}`,
            value: currentMetrics.memory.heapUsed,
            threshold: this.thresholds.memory.heapUsed
          });
        }

        if (currentMetrics.memory.rss > this.thresholds.memory.rss) {
          alerts.push({
            type: 'memory',
            severity: 'critical',
            message: `High RSS memory usage: ${this.formatBytes(currentMetrics.memory.rss)}`,
            value: currentMetrics.memory.rss,
            threshold: this.thresholds.memory.rss
          });
        }
      }

      // Event loop lag alerts
      if (currentMetrics.eventLoopLag > this.thresholds.eventLoop.lag) {
        alerts.push({
          type: 'eventLoop',
          severity: 'warning',
          message: `High event loop lag: ${currentMetrics.eventLoopLag.toFixed(2)}ms`,
          value: currentMetrics.eventLoopLag,
          threshold: this.thresholds.eventLoop.lag
        });
      }

      // Emit alerts
      for (const alert of alerts) {
        this.emit('performance-alert', alert);
        this.log('warn', `Performance alert: ${alert.message}`, {
          type: alert.type,
          value: alert.value,
          threshold: alert.threshold
        });
      }
    } catch (error) {
      this.log('error', 'Failed to check performance alerts', { error: error.message });
    }
  }

  /**
   * Generate optimization suggestions based on performance data
   */
  generateOptimizationSuggestions() {
    try {
      const suggestions = [];
      const recentMetrics = this.getRecentMetrics(5 * 60 * 1000); // Last 5 minutes

      // Memory leak detection
      if (recentMetrics.system.length > 10) {
        const memoryTrend = this.analyzeMemoryTrend(recentMetrics.system);
        if (memoryTrend.isIncreasing && memoryTrend.rate > 1024 * 1024) { // 1MB/min
          suggestions.push({
            type: 'memory-leak',
            severity: 'high',
            title: 'Potential Memory Leak Detected',
            description: `Memory usage is increasing at ${this.formatBytes(memoryTrend.rate)}/min`,
            recommendation: 'Review recent code changes for potential memory leaks. Check for event listeners, timers, or cached data that may not be properly cleaned up.'
          });
        }
      }

      // Slow operations detection
      const slowOperations = this.timerHistory
        .filter(timer => timer.duration > 500)
        .slice(-10);

      if (slowOperations.length > 3) {
        const operationGroups = this.groupOperationsByName(slowOperations);
        for (const [operation, timers] of operationGroups) {
          const avgDuration = timers.reduce((sum, t) => sum + t.duration, 0) / timers.length;
          suggestions.push({
            type: 'slow-operation',
            severity: 'medium',
            title: `Slow Operation: ${operation}`,
            description: `Average duration: ${avgDuration.toFixed(2)}ms`,
            recommendation: 'Consider optimizing this operation or moving it to a background task.'
          });
        }
      }

      // Event loop lag suggestions
      const recentLag = recentMetrics.eventLoop
        .filter(lag => lag.lag > this.thresholds.eventLoop.lag);

      if (recentLag.length > recentMetrics.eventLoop.length * 0.3) {
        suggestions.push({
          type: 'event-loop-lag',
          severity: 'medium',
          title: 'Frequent Event Loop Blocking',
          description: 'Event loop is frequently blocked, affecting application responsiveness',
          recommendation: 'Break down long-running operations into smaller chunks or use worker threads for CPU-intensive tasks.'
        });
      }

      // GC frequency suggestions
      const recentGC = recentMetrics.gc || [];
      if (recentGC.length > this.thresholds.gc.frequency) {
        suggestions.push({
          type: 'gc-frequency',
          severity: 'low',
          title: 'High Garbage Collection Frequency',
          description: `${recentGC.length} GC runs in the last 5 minutes`,
          recommendation: 'Consider object pooling or reducing object allocation frequency to reduce GC pressure.'
        });
      }

      // Update suggestions list
      this.suggestions = suggestions;
      this.lastSuggestionCheck = Date.now();

      // Emit suggestions
      if (suggestions.length > 0) {
        this.emit('optimization-suggestions', suggestions);
      }

      // Schedule next suggestion check
      setTimeout(() => {
        this.generateOptimizationSuggestions();
      }, 5 * 60 * 1000); // Check every 5 minutes
    } catch (error) {
      this.log('error', 'Failed to generate optimization suggestions', { error: error.message });
    }
  }

  /**
   * Analyze memory usage trend
   */
  analyzeMemoryTrend(systemMetrics) {
    if (systemMetrics.length < 2) {
      return { isIncreasing: false, rate: 0 };
    }

    const first = systemMetrics[0];
    const last = systemMetrics[systemMetrics.length - 1];

    const timeDiff = (last.timestamp - first.timestamp) / 1000 / 60; // minutes
    const memoryDiff = last.memory.heapUsed - first.memory.heapUsed;
    const rate = memoryDiff / timeDiff; // bytes per minute

    return {
      isIncreasing: rate > 0,
      rate,
      totalIncrease: memoryDiff
    };
  }

  /**
   * Group operations by name for analysis
   */
  groupOperationsByName(operations) {
    const groups = new Map();

    for (const operation of operations) {
      if (!groups.has(operation.operation)) {
        groups.set(operation.operation, []);
      }
      groups.get(operation.operation).push(operation);
    }

    return groups;
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics() {
    const latestSystem = this.metrics.system[this.metrics.system.length - 1];
    const latestEventLoop = this.metrics.eventLoop[this.metrics.eventLoop.length - 1];
    const latestGC = this.metrics.gc[this.metrics.gc.length - 1];

    return {
      timestamp: Date.now(),
      memory: latestSystem?.memory,
      cpu: latestSystem?.cpu,
      system: latestSystem?.system,
      eventLoopLag: latestEventLoop?.lag || 0,
      gc: latestGC,
      activeTimers: this.activeTimers.size,
      suggestions: this.suggestions.length
    };
  }

  /**
   * Get recent metrics within a time window
   */
  getRecentMetrics(timeWindow = 60000) {
    const cutoffTime = Date.now() - timeWindow;

    return {
      system: this.metrics.system.filter(m => m.timestamp > cutoffTime),
      application: this.metrics.application.filter(m => m.startTimestamp > cutoffTime),
      eventLoop: this.metrics.eventLoop.filter(m => m.timestamp > cutoffTime),
      gc: this.metrics.gc.filter(m => m.timestamp > cutoffTime)
    };
  }

  /**
   * Get performance statistics
   */
  getStatistics() {
    const recentMetrics = this.getRecentMetrics(5 * 60 * 1000); // Last 5 minutes
    const allMetrics = this.metrics;

    // Calculate averages
    const avgMemoryUsage = recentMetrics.system.length > 0
      ? recentMetrics.system.reduce((sum, m) => sum + m.memory.heapUsed, 0) / recentMetrics.system.length
      : 0;

    const avgEventLoopLag = recentMetrics.eventLoop.length > 0
      ? recentMetrics.eventLoop.reduce((sum, m) => sum + m.lag, 0) / recentMetrics.eventLoop.length
      : 0;

    // Operation statistics
    const operationStats = this.calculateOperationStats(recentMetrics.application);

    return {
      timestamp: Date.now(),
      monitoring: {
        isActive: this.isMonitoring,
        uptime: this.isMonitoring ? Date.now() - this.monitoringStartTime : 0
      },
      current: this.getCurrentMetrics(),
      averages: {
        memoryUsage: avgMemoryUsage,
        eventLoopLag: avgEventLoopLag
      },
      totals: {
        systemMetrics: allMetrics.system.length,
        applicationMetrics: allMetrics.application.length,
        eventLoopMetrics: allMetrics.eventLoop.length,
        gcMetrics: allMetrics.gc.length,
        activeTimers: this.activeTimers.size
      },
      operations: operationStats,
      suggestions: {
        total: this.suggestions.length,
        high: this.suggestions.filter(s => s.severity === 'high').length,
        medium: this.suggestions.filter(s => s.severity === 'medium').length,
        low: this.suggestions.filter(s => s.severity === 'low').length
      }
    };
  }

  /**
   * Calculate operation performance statistics
   */
  calculateOperationStats(applicationMetrics) {
    const operations = new Map();

    for (const metric of applicationMetrics) {
      if (!operations.has(metric.operation)) {
        operations.set(metric.operation, {
          count: 0,
          totalDuration: 0,
          minDuration: Infinity,
          maxDuration: 0,
          avgDuration: 0
        });
      }

      const stats = operations.get(metric.operation);
      stats.count++;
      stats.totalDuration += metric.duration;
      stats.minDuration = Math.min(stats.minDuration, metric.duration);
      stats.maxDuration = Math.max(stats.maxDuration, metric.duration);
      stats.avgDuration = stats.totalDuration / stats.count;
    }

    // Convert to array and sort by average duration
    return Array.from(operations.entries())
      .map(([name, stats]) => ({ operation: name, ...stats }))
      .sort((a, b) => b.avgDuration - a.avgDuration);
  }

  /**
   * Export performance data
   */
  exportData(format = 'json', timeRange = null) {
    try {
      let data;

      if (timeRange) {
        data = this.getMetricsInRange(timeRange.start, timeRange.end);
      } else {
        data = this.metrics;
      }

      const exportData = {
        timestamp: Date.now(),
        exportFormat: format,
        timeRange,
        statistics: this.getStatistics(),
        metrics: data,
        suggestions: this.suggestions,
        configuration: this.config
      };

      if (format === 'csv') {
        return this.convertToCSV(exportData);
      }

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      this.log('error', 'Failed to export performance data', { error: error.message });
      throw error;
    }
  }

  /**
   * Get metrics within a specific time range
   */
  getMetricsInRange(startTime, endTime) {
    const filterByTime = (metrics) =>
      metrics.filter(m => m.timestamp >= startTime && m.timestamp <= endTime);

    return {
      system: filterByTime(this.metrics.system),
      application: this.metrics.application.filter(m =>
        m.startTimestamp >= startTime && m.startTimestamp <= endTime),
      eventLoop: filterByTime(this.metrics.eventLoop),
      gc: filterByTime(this.metrics.gc)
    };
  }

  /**
   * Convert performance data to CSV format
   */
  convertToCSV(data) {
    const lines = [];

    // System metrics CSV
    lines.push('Type,Timestamp,RSS,HeapTotal,HeapUsed,External,EventLoopLag');

    for (const metric of data.metrics.system) {
      const eventLoopMetric = data.metrics.eventLoop.find(e =>
        Math.abs(e.timestamp - metric.timestamp) < 1000);
      const lag = eventLoopMetric?.lag || 0;

      lines.push([
        'system',
        new Date(metric.timestamp).toISOString(),
        metric.memory.rss,
        metric.memory.heapTotal,
        metric.memory.heapUsed,
        metric.memory.external,
        lag.toFixed(2)
      ].join(','));
    }

    // Application metrics CSV
    lines.push('');
    lines.push('Type,Operation,StartTime,Duration,Context');

    for (const metric of data.metrics.application) {
      lines.push([
        'application',
        metric.operation,
        new Date(metric.startTimestamp).toISOString(),
        metric.duration.toFixed(2),
        JSON.stringify(metric.context).replace(/,/g, ';')
      ].join(','));
    }

    return lines.join('\n');
  }

  /**
   * Format bytes for human-readable display
   */
  formatBytes(bytes) {
    if (bytes === 0) {
      return '0 Bytes';
    }

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))  } ${  sizes[i]}`;
  }

  /**
   * Log messages using LogManager if available, otherwise console
   */
  log(level, message, data = {}) {
    if (this.logManager && this.logManager.logWithComponent) {
      this.logManager.logWithComponent('PerformanceMonitor', level, message, data);
    } else if (this.logManager && this.logManager.getLogger) {
      const logger = this.logManager.getLogger();
      logger[level](message, data);
    } else {
      console[level](`[PerformanceMonitor] ${message}`, data);
    }
  }

  /**
   * Clean up resources and stop monitoring
   */
  cleanup() {
    this.stopMonitoring();

    // Clear all stored metrics
    this.metrics.system = [];
    this.metrics.application = [];
    this.metrics.eventLoop = [];
    this.metrics.gc = [];
    this.metrics.custom.clear();

    // Clear timers and suggestions
    this.activeTimers.clear();
    this.timerHistory = [];
    this.suggestions = [];

    // Remove all event listeners
    this.removeAllListeners();

    this.isInitialized = false;
    this.log('info', 'PerformanceMonitor cleaned up');
  }

  /**
   * Check if the monitor is initialized
   */
  isReady() {
    return this.isInitialized;
  }

  /**
   * Check if monitoring is active
   */
  isActive() {
    return this.isMonitoring;
  }

  /**
   * Get optimization suggestions
   */
  getOptimizationSuggestions() {
    return this.suggestions;
  }

  /**
   * Update configuration and reconfigure monitor
   */
  updateConfiguration(newConfig) {
    this.config = this.mergeConfig(newConfig);

    // Update thresholds if provided
    if (newConfig.thresholds) {
      this.thresholds = { ...this.thresholds, ...newConfig.thresholds };
    }

    // Restart monitoring if configuration changes require it
    if (this.isMonitoring) {
      this.stopMonitoring();
      setTimeout(() => this.startMonitoring(), 100);
    }

    this.log('info', 'PerformanceMonitor configuration updated');
  }
}

module.exports = PerformanceMonitor;
