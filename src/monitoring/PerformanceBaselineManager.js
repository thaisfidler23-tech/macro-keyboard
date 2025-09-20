const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

/**
 * PerformanceBaselineManager - Manages performance baselines and historical data
 * 
 * Features:
 * - Statistical baseline calculation with confidence intervals
 * - Baseline version management and history tracking
 * - Baseline comparison algorithms with trend analysis
 * - Automated baseline updates for validated improvements
 */
class PerformanceBaselineManager extends EventEmitter {
  constructor(config = {}, logManager = null) {
    super();
    
    this.config = this.mergeConfig(config);
    this.logManager = logManager;
    this.isInitialized = false;
    
    // Baseline storage
    this.baselines = new Map();
    this.historicalData = new Map();
    this.baselineMetadata = new Map();
    
    // Statistical analysis configuration
    this.statisticalConfig = {
      confidenceLevel: 0.95,
      outlierThreshold: 2.0, // Z-score threshold for outlier detection
      minSampleSize: 10,
      rollingWindowSize: 50,
      significanceLevel: 0.05
    };
    
    // File paths
    this.baselinesPath = path.join(this.config.dataDirectory, 'performance-baselines.json');
    this.historyPath = path.join(this.config.dataDirectory, 'performance-history.json');
    this.metadataPath = path.join(this.config.dataDirectory, 'baseline-metadata.json');
    
    this.init();
  }

  /**
   * Merge default configuration with user config
   */
  mergeConfig(userConfig) {
    const defaultConfig = {
      dataDirectory: path.join(process.cwd(), 'data', 'performance'),
      autoSave: true,
      maxHistorySize: 1000,
      retentionPeriod: 30 * 24 * 60 * 60 * 1000, // 30 days
      backupEnabled: true,
      backupInterval: 24 * 60 * 60 * 1000 // 24 hours
    };
    
    return { ...defaultConfig, ...userConfig };
  }

  /**
   * Initialize the baseline manager
   */
  async init() {
    try {
      // Ensure data directory exists
      await this.ensureDataDirectory();
      
      // Load existing baselines and historical data
      await this.loadBaselines();
      await this.loadHistoricalData();
      await this.loadMetadata();
      
      // Setup periodic backup if enabled
      if (this.config.backupEnabled) {
        this.setupPeriodicBackup();
      }
      
      this.isInitialized = true;
      this.log('info', 'PerformanceBaselineManager initialized');
      this.emit('initialized');
      
    } catch (error) {
      this.log('error', 'Failed to initialize PerformanceBaselineManager', { error: error.message });
      throw error;
    }
  }

  /**
   * Ensure data directory exists
   */
  async ensureDataDirectory() {
    try {
      await fs.mkdir(this.config.dataDirectory, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Add performance data point for baseline calculation
   */
  async addDataPoint(metricName, value, metadata = {}) {
    if (!this.isInitialized) {
      throw new Error('PerformanceBaselineManager not initialized');
    }

    const timestamp = Date.now();
    const dataPoint = {
      value,
      timestamp,
      metadata
    };

    // Initialize metric data if not exists
    if (!this.historicalData.has(metricName)) {
      this.historicalData.set(metricName, []);
    }

    // Add data point
    const metricData = this.historicalData.get(metricName);
    metricData.push(dataPoint);

    // Maintain rolling window size
    if (metricData.length > this.config.maxHistorySize) {
      metricData.shift();
    }

    // Auto-update baseline if enough data points
    if (metricData.length >= this.statisticalConfig.minSampleSize) {
      await this.updateBaseline(metricName);
    }

    // Auto-save if enabled
    if (this.config.autoSave) {
      await this.saveHistoricalData();
    }

    this.emit('dataPointAdded', metricName, dataPoint);
  }

  /**
   * Calculate statistical baseline for a metric
   */
  calculateBaseline(metricName) {
    const data = this.historicalData.get(metricName);
    if (!data || data.length < this.statisticalConfig.minSampleSize) {
      return null;
    }

    // Get recent data within rolling window
    const recentData = data.slice(-this.statisticalConfig.rollingWindowSize);
    const values = recentData.map(d => d.value);

    // Remove outliers using Z-score
    const cleanValues = this.removeOutliers(values);
    
    if (cleanValues.length < this.statisticalConfig.minSampleSize) {
      return null;
    }

    // Calculate statistical measures
    const stats = this.calculateStatistics(cleanValues);
    const confidenceInterval = this.calculateConfidenceInterval(cleanValues, this.statisticalConfig.confidenceLevel);

    return {
      value: stats.mean,
      statistics: stats,
      confidenceInterval,
      sampleSize: cleanValues.length,
      calculatedAt: Date.now(),
      dataPoints: recentData.length
    };
  }

  /**
   * Update baseline for a specific metric
   */
  async updateBaseline(metricName) {
    const newBaseline = this.calculateBaseline(metricName);
    
    if (!newBaseline) {
      this.log('warn', `Cannot calculate baseline for ${metricName}: insufficient data`);
      return false;
    }

    const existingBaseline = this.baselines.get(metricName);
    
    // Check if update is statistically significant
    if (existingBaseline && !this.isSignificantChange(existingBaseline, newBaseline)) {
      this.log('debug', `Baseline update for ${metricName} not statistically significant`);
      return false;
    }

    // Store previous baseline in metadata
    if (existingBaseline) {
      this.updateBaselineMetadata(metricName, existingBaseline);
    }

    // Update baseline
    this.baselines.set(metricName, newBaseline);

    // Auto-save if enabled
    if (this.config.autoSave) {
      await this.saveBaselines();
      await this.saveMetadata();
    }

    this.log('info', `Baseline updated for ${metricName}`, {
      oldValue: existingBaseline?.value,
      newValue: newBaseline.value,
      change: existingBaseline ? ((newBaseline.value - existingBaseline.value) / existingBaseline.value * 100).toFixed(2) + '%' : 'initial'
    });

    this.emit('baselineUpdated', metricName, newBaseline, existingBaseline);
    return true;
  }

  /**
   * Check if baseline change is statistically significant
   */
  isSignificantChange(oldBaseline, newBaseline) {
    // Use t-test for significance testing
    const pooledStdDev = Math.sqrt((
      (oldBaseline.sampleSize - 1) * Math.pow(oldBaseline.statistics.standardDeviation, 2) +
      (newBaseline.sampleSize - 1) * Math.pow(newBaseline.statistics.standardDeviation, 2)
    ) / (oldBaseline.sampleSize + newBaseline.sampleSize - 2));

    const standardError = pooledStdDev * Math.sqrt(1/oldBaseline.sampleSize + 1/newBaseline.sampleSize);
    const tStatistic = Math.abs(newBaseline.value - oldBaseline.value) / standardError;
    
    // Critical t-value for 95% confidence level with df approximation
    const degreesOfFreedom = oldBaseline.sampleSize + newBaseline.sampleSize - 2;
    const criticalTValue = this.getCriticalTValue(degreesOfFreedom, this.statisticalConfig.significanceLevel);

    return tStatistic > criticalTValue;
  }

  /**
   * Get critical t-value (approximation for common cases)
   */
  getCriticalTValue(degreesOfFreedom, alpha) {
    // Simplified critical values for α = 0.05 (two-tailed)
    if (degreesOfFreedom >= 30) return 1.96;
    if (degreesOfFreedom >= 20) return 2.09;
    if (degreesOfFreedom >= 10) return 2.23;
    return 2.78; // Conservative estimate for small samples
  }

  /**
   * Remove outliers using Z-score method
   */
  removeOutliers(values) {
    if (values.length < 3) return values;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length);

    return values.filter(value => {
      const zScore = Math.abs(value - mean) / stdDev;
      return zScore <= this.statisticalConfig.outlierThreshold;
    });
  }

  /**
   * Calculate comprehensive statistics
   */
  calculateStatistics(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const n = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / n;

    // Calculate variance and standard deviation
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
    const standardDeviation = Math.sqrt(variance);

    // Calculate percentiles
    const p25 = sorted[Math.floor(n * 0.25)];
    const p50 = sorted[Math.floor(n * 0.5)]; // median
    const p75 = sorted[Math.floor(n * 0.75)];
    const p90 = sorted[Math.floor(n * 0.9)];
    const p95 = sorted[Math.floor(n * 0.95)];

    return {
      mean,
      median: p50,
      standardDeviation,
      variance,
      min: sorted[0],
      max: sorted[n - 1],
      percentiles: {
        p25, p50, p75, p90, p95
      },
      coefficientOfVariation: standardDeviation / mean
    };
  }

  /**
   * Calculate confidence interval
   */
  calculateConfidenceInterval(values, confidenceLevel) {
    const stats = this.calculateStatistics(values);
    const n = values.length;
    const alpha = 1 - confidenceLevel;
    
    // Use t-distribution for small samples
    const degreesOfFreedom = n - 1;
    const tValue = this.getCriticalTValue(degreesOfFreedom, alpha);
    
    const marginOfError = tValue * (stats.standardDeviation / Math.sqrt(n));
    
    return {
      lower: stats.mean - marginOfError,
      upper: stats.mean + marginOfError,
      marginOfError,
      confidenceLevel
    };
  }

  /**
   * Get baseline for a specific metric
   */
  getBaseline(metricName) {
    return this.baselines.get(metricName) || null;
  }

  /**
   * Get all baselines
   */
  getAllBaselines() {
    return Object.fromEntries(this.baselines);
  }

  /**
   * Get historical data for a metric
   */
  getHistoricalData(metricName, limit = null) {
    const data = this.historicalData.get(metricName) || [];
    return limit ? data.slice(-limit) : data;
  }

  /**
   * Compare current value against baseline
   */
  compareToBaseline(metricName, currentValue) {
    const baseline = this.baselines.get(metricName);
    if (!baseline) {
      return {
        status: 'no_baseline',
        message: 'No baseline available for comparison'
      };
    }

    const change = currentValue - baseline.value;
    const percentChange = (change / baseline.value) * 100;
    
    // Check if within confidence interval
    const withinCI = currentValue >= baseline.confidenceInterval.lower && 
                     currentValue <= baseline.confidenceInterval.upper;

    return {
      status: withinCI ? 'within_baseline' : 'outside_baseline',
      baseline: baseline.value,
      current: currentValue,
      change,
      percentChange,
      withinConfidenceInterval: withinCI,
      confidenceInterval: baseline.confidenceInterval,
      significance: this.assessSignificance(percentChange)
    };
  }

  /**
   * Assess significance of change
   */
  assessSignificance(percentChange) {
    const absChange = Math.abs(percentChange);
    
    if (absChange < 5) return 'negligible';
    if (absChange < 15) return 'minor';
    if (absChange < 30) return 'moderate';
    if (absChange < 50) return 'significant';
    return 'critical';
  }

  /**
   * Update baseline metadata
   */
  updateBaselineMetadata(metricName, oldBaseline) {
    if (!this.baselineMetadata.has(metricName)) {
      this.baselineMetadata.set(metricName, {
        history: [],
        created: Date.now(),
        version: 1
      });
    }

    const metadata = this.baselineMetadata.get(metricName);
    metadata.history.push({
      baseline: oldBaseline,
      replacedAt: Date.now()
    });
    metadata.version++;
    metadata.lastUpdated = Date.now();

    // Maintain history size
    if (metadata.history.length > 10) {
      metadata.history.shift();
    }
  }

  /**
   * Load baselines from disk
   */
  async loadBaselines() {
    try {
      const data = await fs.readFile(this.baselinesPath, 'utf8');
      const parsed = JSON.parse(data);
      this.baselines = new Map(Object.entries(parsed));
      this.log('info', `Loaded ${this.baselines.size} performance baselines`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.log('warn', 'Failed to load baselines', { error: error.message });
      }
      this.baselines = new Map();
    }
  }

  /**
   * Save baselines to disk
   */
  async saveBaselines() {
    try {
      const data = JSON.stringify(Object.fromEntries(this.baselines), null, 2);
      await fs.writeFile(this.baselinesPath, data);
      this.log('debug', 'Baselines saved to disk');
    } catch (error) {
      this.log('error', 'Failed to save baselines', { error: error.message });
      throw error;
    }
  }

  /**
   * Load historical data from disk
   */
  async loadHistoricalData() {
    try {
      const data = await fs.readFile(this.historyPath, 'utf8');
      const parsed = JSON.parse(data);
      this.historicalData = new Map(Object.entries(parsed));
      this.log('info', `Loaded historical data for ${this.historicalData.size} metrics`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.log('warn', 'Failed to load historical data', { error: error.message });
      }
      this.historicalData = new Map();
    }
  }

  /**
   * Save historical data to disk
   */
  async saveHistoricalData() {
    try {
      const data = JSON.stringify(Object.fromEntries(this.historicalData), null, 2);
      await fs.writeFile(this.historyPath, data);
      this.log('debug', 'Historical data saved to disk');
    } catch (error) {
      this.log('error', 'Failed to save historical data', { error: error.message });
      throw error;
    }
  }

  /**
   * Load metadata from disk
   */
  async loadMetadata() {
    try {
      const data = await fs.readFile(this.metadataPath, 'utf8');
      const parsed = JSON.parse(data);
      this.baselineMetadata = new Map(Object.entries(parsed));
      this.log('info', `Loaded metadata for ${this.baselineMetadata.size} metrics`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.log('warn', 'Failed to load metadata', { error: error.message });
      }
      this.baselineMetadata = new Map();
    }
  }

  /**
   * Save metadata to disk
   */
  async saveMetadata() {
    try {
      const data = JSON.stringify(Object.fromEntries(this.baselineMetadata), null, 2);
      await fs.writeFile(this.metadataPath, data);
      this.log('debug', 'Metadata saved to disk');
    } catch (error) {
      this.log('error', 'Failed to save metadata', { error: error.message });
      throw error;
    }
  }

  /**
   * Setup periodic backup
   */
  setupPeriodicBackup() {
    setInterval(async () => {
      try {
        await this.createBackup();
      } catch (error) {
        this.log('error', 'Backup failed', { error: error.message });
      }
    }, this.config.backupInterval);
  }

  /**
   * Create backup of all data
   */
  async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(this.config.dataDirectory, 'backups', timestamp);
    
    await fs.mkdir(backupDir, { recursive: true });
    
    // Backup all data files
    await Promise.all([
      this.saveBaselines(),
      this.saveHistoricalData(), 
      this.saveMetadata()
    ]);

    // Copy files to backup directory
    const files = [
      { src: this.baselinesPath, dest: path.join(backupDir, 'baselines.json') },
      { src: this.historyPath, dest: path.join(backupDir, 'history.json') },
      { src: this.metadataPath, dest: path.join(backupDir, 'metadata.json') }
    ];

    for (const file of files) {
      try {
        await fs.copyFile(file.src, file.dest);
      } catch (error) {
        // File might not exist yet, which is okay
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
    }

    this.log('info', `Backup created at ${backupDir}`);
    this.emit('backupCreated', backupDir);
  }

  /**
   * Clear old data based on retention period
   */
  async cleanupOldData() {
    const cutoffTime = Date.now() - this.config.retentionPeriod;
    let totalRemoved = 0;

    for (const [metricName, data] of this.historicalData.entries()) {
      const originalLength = data.length;
      const filteredData = data.filter(point => point.timestamp > cutoffTime);
      this.historicalData.set(metricName, filteredData);
      totalRemoved += originalLength - filteredData.length;
    }

    if (totalRemoved > 0) {
      this.log('info', `Cleaned up ${totalRemoved} old data points`);
      if (this.config.autoSave) {
        await this.saveHistoricalData();
      }
    }

    return totalRemoved;
  }

  /**
   * Log messages using LogManager if available
   */
  log(level, message, data = {}) {
    if (this.logManager && this.logManager.logWithComponent) {
      this.logManager.logWithComponent('PerformanceBaselineManager', level, message, data);
    } else if (this.logManager && this.logManager.getLogger) {
      const logger = this.logManager.getLogger();
      logger[level](message, data);
    } else {
      console[level](`[PerformanceBaselineManager] ${message}`, data);
    }
  }

  /**
   * Get status information
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      metricsTracked: this.baselines.size,
      totalDataPoints: Array.from(this.historicalData.values()).reduce((sum, data) => sum + data.length, 0),
      lastUpdate: Math.max(...Array.from(this.baselines.values()).map(b => b.calculatedAt || 0)) || null
    };
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    if (this.config.autoSave) {
      await Promise.all([
        this.saveBaselines(),
        this.saveHistoricalData(),
        this.saveMetadata()
      ]);
    }

    this.baselines.clear();
    this.historicalData.clear();
    this.baselineMetadata.clear();
    this.removeAllListeners();
    
    this.isInitialized = false;
    this.log('info', 'PerformanceBaselineManager cleaned up');
  }
}

module.exports = PerformanceBaselineManager;