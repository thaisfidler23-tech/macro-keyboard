/**
 * Application Detector - Cross-platform application detection service
 * Provides unified interface for detecting active applications and window information
 */

const EventEmitter = require('events');

/**
 * Base ApplicationDetector class providing common interface
 */
class ApplicationDetector extends EventEmitter {
  constructor(logger) {
    super();
    this.logger = logger || {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {}
    };
    
    this.platform = process.platform;
    this.detector = null;
    this.currentApplication = null;
    this.monitoring = false;
    this.monitoringInterval = null;
    
    // Performance tracking
    this.statistics = {
      detectionCount: 0,
      applicationChanges: 0,
      lastDetection: null,
      averageDetectionTime: 0,
      totalDetectionTime: 0,
      errors: 0
    };
    
    this.logger.info(`ApplicationDetector initialized for platform: ${this.platform}`);
  }

  /**
   * Create platform-specific detector instance
   */
  static createDetector(logger) {
    const platform = process.platform;
    
    switch (platform) {
      case 'win32':
        const WindowsApplicationDetector = require('./WindowsApplicationDetector');
        return new WindowsApplicationDetector(logger);
      case 'darwin':
        const MacOSApplicationDetector = require('./MacOSApplicationDetector');
        return new MacOSApplicationDetector(logger);
      case 'linux':
        const LinuxApplicationDetector = require('./LinuxApplicationDetector');
        return new LinuxApplicationDetector(logger);
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  /**
   * Initialize the detector
   */
  async initialize() {
    throw new Error('initialize() must be implemented by platform-specific detector');
  }

  /**
   * Start monitoring for application changes
   */
  async startMonitoring(interval = 1000) {
    if (this.monitoring) {
      this.logger.warn('Application monitoring already started');
      return;
    }

    await this.initialize();
    this.monitoring = true;
    
    // Initial detection
    await this.detectCurrentApplication();
    
    // Set up periodic monitoring
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.detectCurrentApplication();
      } catch (error) {
        this.logger.error('Error in application monitoring:', error);
        this.statistics.errors++;
      }
    }, interval);

    this.logger.info('Application monitoring started');
    this.emit('monitoringStarted');
  }

  /**
   * Stop monitoring for application changes
   */
  stopMonitoring() {
    if (!this.monitoring) {
      return;
    }

    this.monitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.logger.info('Application monitoring stopped');
    this.emit('monitoringStopped');
  }

  /**
   * Detect current active application
   */
  async detectCurrentApplication() {
    const startTime = Date.now();
    
    try {
      const applicationInfo = await this.getCurrentApplication();
      
      if (applicationInfo && this.isDifferentApplication(applicationInfo)) {
        const previousApplication = this.currentApplication;
        this.currentApplication = applicationInfo;
        this.statistics.applicationChanges++;
        
        this.logger.debug('Application changed:', {
          from: previousApplication?.processName || 'Unknown',
          to: applicationInfo.processName
        });
        
        this.emit('applicationChanged', {
          current: applicationInfo,
          previous: previousApplication
        });
      }
      
      this.statistics.detectionCount++;
      this.statistics.lastDetection = new Date();
      
      const detectionTime = Date.now() - startTime;
      this.statistics.totalDetectionTime += detectionTime;
      this.statistics.averageDetectionTime = 
        this.statistics.totalDetectionTime / this.statistics.detectionCount;
      
      return applicationInfo;
    } catch (error) {
      this.statistics.errors++;
      this.logger.error('Error detecting current application:', error);
      throw error;
    }
  }

  /**
   * Get current application information (platform-specific implementation)
   */
  async getCurrentApplication() {
    throw new Error('getCurrentApplication() must be implemented by platform-specific detector');
  }

  /**
   * Check if the detected application is different from current
   */
  isDifferentApplication(applicationInfo) {
    if (!this.currentApplication) {
      return true;
    }

    return (
      this.currentApplication.processName !== applicationInfo.processName ||
      this.currentApplication.processId !== applicationInfo.processId ||
      this.currentApplication.windowTitle !== applicationInfo.windowTitle
    );
  }

  /**
   * Get current application info synchronously
   */
  getCurrentApplicationInfo() {
    return this.currentApplication;
  }

  /**
   * Check if monitoring is active
   */
  isMonitoring() {
    return this.monitoring;
  }

  /**
   * Get detection statistics
   */
  getStatistics() {
    return { ...this.statistics };
  }

  /**
   * Reset statistics
   */
  resetStatistics() {
    this.statistics = {
      detectionCount: 0,
      applicationChanges: 0,
      lastDetection: null,
      averageDetectionTime: 0,
      totalDetectionTime: 0,
      errors: 0
    };
    this.emit('statisticsReset');
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.stopMonitoring();
    this.removeAllListeners();
  }
}

module.exports = ApplicationDetector;