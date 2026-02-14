/**
 * System Event Monitor - Comprehensive system event monitoring and integration
 *
 * This module provides unified system event monitoring across platforms including:
 * - Power management events (sleep, wake, battery status)
 * - Network connectivity changes (WiFi, Ethernet, VPN)
 * - User session events (lock, unlock, login, logout)
 * - System resource monitoring (CPU, memory, disk)
 * - External device events (USB, Bluetooth, monitors)
 */

const EventEmitter = require('events');
const PowerEventMonitor = require('./PowerEventMonitor');
const NetworkEventMonitor = require('./NetworkEventMonitor');
const SessionEventMonitor = require('./SessionEventMonitor');
const HardwareEventMonitor = require('./HardwareEventMonitor');
const SystemResourceMonitor = require('./SystemResourceMonitor');

class CircularBuffer {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.buffer = [];
    this.index = 0;
    this.size = 0;
  }

  push(item) {
    this.buffer[this.index] = {
      ...item,
      timestamp: Date.now(),
      id: Math.random().toString(36).substr(2, 9)
    };
    this.index = (this.index + 1) % this.maxSize;
    if (this.size < this.maxSize) {
      this.size++;
    }
  }

  getAll() {
    if (this.size < this.maxSize) {
      return this.buffer.slice(0, this.size);
    }
    return [...this.buffer.slice(this.index), ...this.buffer.slice(0, this.index)];
  }

  getRecent(count) {
    return this.getAll().slice(-count);
  }
}

class SystemEventMonitor extends EventEmitter {
  constructor(logger, config = {}) {
    super();

    this.logger = logger || {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {}
    };

    this.config = {
      monitoringEnabled: config.monitoringEnabled !== false,
      eventHistorySize: config.eventHistorySize || 1000,
      eventThrottling: config.eventThrottling !== false,
      throttleInterval: config.throttleInterval || 1000,
      platformOverrides: config.platformOverrides || {},
      enabledMonitors: config.enabledMonitors || {
        power: true,
        network: true,
        session: true,
        hardware: true,
        system: true
      },
      ...config
    };

    this.platform = process.platform;
    this.monitors = new Map();
    this.eventHistory = new CircularBuffer(this.config.eventHistorySize);
    this.activeEvents = new Set();
    this.eventCounts = new Map();
    this.lastEventTimes = new Map();

    // Performance tracking
    this.statistics = {
      totalEvents: 0,
      eventsPerCategory: {},
      monitorStartTime: null,
      monitorUptime: 0,
      averageEventRate: 0,
      peakEventRate: 0,
      lastEventTime: null,
      errorCount: 0,
      activeMonitors: 0
    };

    // Correlation tracking for related events
    this.eventCorrelation = {
      correlationWindow: 5000, // 5 seconds
      correlationRules: new Map(),
      pendingCorrelations: new Map()
    };

    this.monitoring = false;
    this.initializeMonitors();

    this.logger.info('SystemEventMonitor initialized', {
      platform: this.platform,
      enabledMonitors: Object.keys(this.config.enabledMonitors).filter(k => this.config.enabledMonitors[k])
    });
  }

  /**
   * Initialize platform-specific monitors
   */
  initializeMonitors() {
    const monitorConfig = {
      logger: this.logger,
      platform: this.platform,
      ...this.config.platformOverrides
    };

    try {
      if (this.config.enabledMonitors.power) {
        this.monitors.set('power', new PowerEventMonitor(monitorConfig));
      }

      if (this.config.enabledMonitors.network) {
        this.monitors.set('network', new NetworkEventMonitor(monitorConfig));
      }

      if (this.config.enabledMonitors.session) {
        this.monitors.set('session', new SessionEventMonitor(monitorConfig));
      }

      if (this.config.enabledMonitors.hardware) {
        this.monitors.set('hardware', new HardwareEventMonitor(monitorConfig));
      }

      if (this.config.enabledMonitors.system) {
        this.monitors.set('system', new SystemResourceMonitor(monitorConfig));
      }

      // Set up event forwarding from each monitor
      for (const [type, monitor] of this.monitors) {
        monitor.on('event', (event) => this.handleSystemEvent(type, event));
        monitor.on('error', (error) => this.handleMonitorError(type, error));
      }

      this.statistics.activeMonitors = this.monitors.size;
    } catch (error) {
      this.logger.error('Failed to initialize monitors:', error);
      this.statistics.errorCount++;
    }
  }

  /**
   * Start monitoring system events
   */
  async startMonitoring() {
    if (this.monitoring) {
      this.logger.warn('System event monitoring already started');
      return;
    }

    if (!this.config.monitoringEnabled) {
      this.logger.info('System event monitoring disabled by configuration');
      return;
    }

    this.monitoring = true;
    this.statistics.monitorStartTime = Date.now();

    const startPromises = [];

    for (const [type, monitor] of this.monitors) {
      startPromises.push(
        this.startMonitor(type, monitor)
      );
    }

    // Start all monitors concurrently
    const results = await Promise.allSettled(startPromises);

    let successCount = 0;
    results.forEach((result, index) => {
      const monitorType = Array.from(this.monitors.keys())[index];
      if (result.status === 'fulfilled') {
        successCount++;
        this.logger.info(`Started ${monitorType} event monitoring`);
      } else {
        this.logger.error(`Failed to start ${monitorType} monitoring:`, result.reason);
        this.statistics.errorCount++;
      }
    });

    if (successCount > 0) {
      this.logger.info(`System event monitoring started (${successCount}/${this.monitors.size} monitors active)`);
      this.emit('monitoringStarted', {
        activeMonitors: successCount,
        totalMonitors: this.monitors.size,
        platform: this.platform
      });
    } else {
      this.monitoring = false;
      this.logger.error('Failed to start any system event monitors');
      this.emit('monitoringFailed', {
        reason: 'No monitors could be started',
        platform: this.platform
      });
    }
  }

  /**
   * Start individual monitor with error handling
   */
  async startMonitor(type, monitor) {
    try {
      await monitor.start();
      return true;
    } catch (error) {
      this.logger.error(`Failed to start ${type} monitor:`, error);
      this.statistics.errorCount++;
      throw error;
    }
  }

  /**
   * Stop monitoring system events
   */
  async stopMonitoring() {
    if (!this.monitoring) {
      return;
    }

    this.monitoring = false;

    const stopPromises = [];

    for (const [type, monitor] of this.monitors) {
      if (typeof monitor.stop === 'function') {
        stopPromises.push(
          monitor.stop().catch(error => {
            this.logger.error(`Error stopping ${type} monitor:`, error);
          })
        );
      }
    }

    await Promise.allSettled(stopPromises);

    if (this.statistics.monitorStartTime) {
      this.statistics.monitorUptime = Date.now() - this.statistics.monitorStartTime;
    }

    this.logger.info('System event monitoring stopped');
    this.emit('monitoringStopped', {
      uptime: this.statistics.monitorUptime,
      totalEvents: this.statistics.totalEvents
    });
  }

  /**
   * Handle system event from monitors
   */
  handleSystemEvent(category, event) {
    try {
      // Apply event throttling if enabled
      if (this.config.eventThrottling && this.shouldThrottleEvent(category, event)) {
        return;
      }

      const enrichedEvent = this.enrichEvent(category, event);

      // Add to event history
      this.eventHistory.push(enrichedEvent);

      // Update statistics
      this.updateEventStatistics(category, enrichedEvent);

      // Update active events tracking
      this.updateActiveEvents(enrichedEvent);

      // Check for event correlations
      this.checkEventCorrelations(enrichedEvent);

      // Emit the unified system event
      this.emit('systemEvent', enrichedEvent);

      // Emit category-specific events
      this.emit(`${category}Event`, enrichedEvent);

      this.logger.debug('System event processed', {
        category,
        type: event.type,
        id: enrichedEvent.id
      });
    } catch (error) {
      this.logger.error('Error handling system event:', error);
      this.statistics.errorCount++;
    }
  }

  /**
   * Enrich event with additional metadata
   */
  enrichEvent(category, event) {
    return {
      ...event,
      category,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      platform: this.platform,
      correlationKey: this.generateCorrelationKey(category, event),
      sequence: this.statistics.totalEvents + 1
    };
  }

  /**
   * Generate correlation key for event grouping
   */
  generateCorrelationKey(category, event) {
    // Create a key that can be used to correlate related events
    const keyParts = [category, event.type];

    if (event.data && typeof event.data === 'object') {
      if (event.data.interface) {
        keyParts.push(event.data.interface);
      }
      if (event.data.device) {
        keyParts.push(event.data.device);
      }
      if (event.data.source) {
        keyParts.push(event.data.source);
      }
    }

    return keyParts.join(':').toLowerCase();
  }

  /**
   * Check if event should be throttled
   */
  shouldThrottleEvent(category, event) {
    const eventKey = `${category}:${event.type}`;
    const now = Date.now();

    const lastTime = this.lastEventTimes.get(eventKey);
    if (lastTime && (now - lastTime) < this.config.throttleInterval) {
      return true;
    }

    this.lastEventTimes.set(eventKey, now);
    return false;
  }

  /**
   * Update event statistics
   */
  updateEventStatistics(category, event) {
    this.statistics.totalEvents++;
    this.statistics.lastEventTime = Date.now();

    if (!this.statistics.eventsPerCategory[category]) {
      this.statistics.eventsPerCategory[category] = 0;
    }
    this.statistics.eventsPerCategory[category]++;

    // Update event rate calculation
    if (this.statistics.monitorStartTime) {
      const uptime = Date.now() - this.statistics.monitorStartTime;
      this.statistics.averageEventRate = (this.statistics.totalEvents / uptime) * 1000; // events per second
    }

    // Track event counts for rate monitoring
    const eventKey = `${category}:${event.type}`;
    this.eventCounts.set(eventKey, (this.eventCounts.get(eventKey) || 0) + 1);
  }

  /**
   * Update active events tracking
   */
  updateActiveEvents(event) {
    if (event.type && event.type.includes('start') || event.type.includes('connected')) {
      this.activeEvents.add(event.correlationKey);
    } else if (event.type && (event.type.includes('end') || event.type.includes('disconnected'))) {
      this.activeEvents.delete(event.correlationKey);
    }
  }

  /**
   * Check for event correlations
   */
  checkEventCorrelations(event) {
    // Simple correlation: group events that happen within the correlation window
    const now = Date.now();
    const correlationKey = event.correlationKey;

    if (!this.eventCorrelation.pendingCorrelations.has(correlationKey)) {
      this.eventCorrelation.pendingCorrelations.set(correlationKey, []);
    }

    const correlationGroup = this.eventCorrelation.pendingCorrelations.get(correlationKey);
    correlationGroup.push(event);

    // Clean up old correlations
    this.cleanupOldCorrelations(now);

    // Emit correlation event if we have multiple related events
    if (correlationGroup.length > 1) {
      this.emit('eventCorrelation', {
        correlationKey,
        events: correlationGroup,
        correlationWindow: this.eventCorrelation.correlationWindow
      });
    }
  }

  /**
   * Clean up old correlation tracking
   */
  cleanupOldCorrelations(now) {
    for (const [key, events] of this.eventCorrelation.pendingCorrelations) {
      const recentEvents = events.filter(event =>
        now - event.timestamp < this.eventCorrelation.correlationWindow
      );

      if (recentEvents.length === 0) {
        this.eventCorrelation.pendingCorrelations.delete(key);
      } else if (recentEvents.length !== events.length) {
        this.eventCorrelation.pendingCorrelations.set(key, recentEvents);
      }
    }
  }

  /**
   * Handle monitor errors
   */
  handleMonitorError(monitorType, error) {
    this.statistics.errorCount++;
    this.logger.error(`Monitor error (${monitorType}):`, error);

    this.emit('monitorError', {
      monitorType,
      error: error.message,
      timestamp: Date.now()
    });
  }

  /**
   * Get current system state
   */
  getCurrentSystemState() {
    const state = {
      monitoring: this.monitoring,
      activeEvents: Array.from(this.activeEvents),
      activeMonitors: Array.from(this.monitors.keys()),
      platform: this.platform,
      uptime: this.statistics.monitorStartTime ? Date.now() - this.statistics.monitorStartTime : 0,
      lastEventTime: this.statistics.lastEventTime
    };

    // Get current state from each monitor
    for (const [type, monitor] of this.monitors) {
      if (typeof monitor.getCurrentState === 'function') {
        try {
          state[type] = monitor.getCurrentState();
        } catch (error) {
          this.logger.debug(`Failed to get ${type} monitor state:`, error);
        }
      }
    }

    return state;
  }

  /**
   * Get event history
   */
  getEventHistory(count = 50) {
    return this.eventHistory.getRecent(count);
  }

  /**
   * Get event statistics
   */
  getStatistics() {
    return {
      ...this.statistics,
      monitoring: this.monitoring,
      eventHistorySize: this.eventHistory.size,
      activeEventsCount: this.activeEvents.size,
      correlationPendingCount: this.eventCorrelation.pendingCorrelations.size
    };
  }

  /**
   * Check if monitoring is active
   */
  isMonitoring() {
    return this.monitoring;
  }

  /**
   * Get specific monitor
   */
  getMonitor(type) {
    return this.monitors.get(type);
  }

  /**
   * Add event correlation rule
   */
  addCorrelationRule(name, rule) {
    this.eventCorrelation.correlationRules.set(name, rule);
    this.logger.debug(`Added event correlation rule: ${name}`);
  }

  /**
   * Remove event correlation rule
   */
  removeCorrelationRule(name) {
    return this.eventCorrelation.correlationRules.delete(name);
  }

  /**
   * Reset statistics
   */
  resetStatistics() {
    this.statistics = {
      totalEvents: 0,
      eventsPerCategory: {},
      monitorStartTime: this.monitoring ? Date.now() : null,
      monitorUptime: 0,
      averageEventRate: 0,
      peakEventRate: 0,
      lastEventTime: null,
      errorCount: 0,
      activeMonitors: this.monitors.size
    };

    this.eventHistory = new CircularBuffer(this.config.eventHistorySize);
    this.activeEvents.clear();
    this.eventCounts.clear();
    this.lastEventTimes.clear();

    this.emit('statisticsReset');
  }
}

module.exports = SystemEventMonitor;
