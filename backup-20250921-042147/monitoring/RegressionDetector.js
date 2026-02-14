const EventEmitter = require('events');

/**
 * RegressionDetector - Detects performance regressions with statistical analysis
 *
 * Features:
 * - Statistical significance testing for regression detection
 * - Trend analysis and anomaly detection algorithms
 * - Configurable regression thresholds and rules
 * - Performance degradation root cause analysis
 */
class RegressionDetector extends EventEmitter {
  constructor(config = {}, baselineManager = null, logManager = null) {
    super();

    this.config = this.mergeConfig(config);
    this.baselineManager = baselineManager;
    this.logManager = logManager;
    this.isInitialized = false;

    // Regression detection rules
    this.regressionRules = new Map();

    // Analysis results cache
    this.analysisCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes

    // Default performance metrics with their thresholds
    this.defaultMetrics = {
      buttonLatency: {
        metric: 'button_press_response_time',
        baseline: 25,        // ms
        regressionThreshold: 1.5,  // 50% increase triggers alert
        criticalThreshold: 2.0     // 100% increase fails build
      },
      serialCommunication: {
        metric: 'serial_round_trip_time',
        baseline: 15,        // ms
        regressionThreshold: 1.3,
        criticalThreshold: 1.8
      },
      applicationStartup: {
        metric: 'app_startup_time',
        baseline: 2000,      // ms
        regressionThreshold: 1.25,
        criticalThreshold: 1.5
      },
      memoryUsage: {
        metric: 'peak_memory_usage',
        baseline: 80,        // MB
        regressionThreshold: 1.2,
        criticalThreshold: 1.4
      },
      configurationLoading: {
        metric: 'config_load_time',
        baseline: 100,       // ms
        regressionThreshold: 1.4,
        criticalThreshold: 2.0
      }
    };

    this.init();
  }

  /**
   * Merge default configuration with user config
   */
  mergeConfig(userConfig) {
    const defaultConfig = {
      enabled: true,
      strictMode: false, // If true, uses more stringent statistical tests
      minSampleSize: 10,
      trendAnalysisWindow: 50,
      anomalyDetectionSensitivity: 2.0, // Z-score threshold
      regressionConfidenceLevel: 0.95,
      enableRootCauseAnalysis: true,
      enableTrendAnalysis: true,
      enableAnomalyDetection: true,
      cacheResults: true,
      alertOnRegression: true,
      alertOnImprovement: false
    };

    return { ...defaultConfig, ...userConfig };
  }

  /**
   * Initialize the regression detector
   */
  async init() {
    try {
      // Setup regression rules from default metrics and config
      this.setupRegressionRules();

      // Setup cache cleanup interval
      if (this.config.cacheResults) {
        this.setupCacheCleanup();
      }

      this.isInitialized = true;
      this.log('info', 'RegressionDetector initialized');
      this.emit('initialized');
    } catch (error) {
      this.log('error', 'Failed to initialize RegressionDetector', { error: error.message });
      throw error;
    }
  }

  /**
   * Setup regression rules from configuration
   */
  setupRegressionRules() {
    // Add default metrics
    for (const [name, config] of Object.entries(this.defaultMetrics)) {
      this.addRegressionRule(name, config);
    }

    // Add custom metrics from config
    if (this.config.customMetrics) {
      for (const [name, config] of Object.entries(this.config.customMetrics)) {
        this.addRegressionRule(name, config);
      }
    }
  }

  /**
   * Add a regression rule for a metric
   */
  addRegressionRule(name, config) {
    const rule = {
      metric: config.metric,
      baseline: config.baseline,
      regressionThreshold: config.regressionThreshold || 1.5,
      criticalThreshold: config.criticalThreshold || 2.0,
      direction: config.direction || 'higher_is_worse', // 'higher_is_worse' | 'lower_is_worse'
      enabled: config.enabled !== false,
      customAnalysis: config.customAnalysis || null
    };

    this.regressionRules.set(name, rule);
    this.log('debug', `Added regression rule for ${name}`, rule);
  }

  /**
   * Detect regressions for a specific metric
   */
  async detectRegression(metricName, currentValue, metadata = {}) {
    if (!this.isInitialized) {
      throw new Error('RegressionDetector not initialized');
    }

    const rule = this.regressionRules.get(metricName);
    if (!rule || !rule.enabled) {
      return {
        status: 'no_rule',
        message: `No regression rule defined for ${metricName}`
      };
    }

    // Check cache first
    const cacheKey = `${metricName}_${currentValue}_${JSON.stringify(metadata)}`;
    if (this.config.cacheResults && this.analysisCache.has(cacheKey)) {
      const cached = this.analysisCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.result;
      }
    }

    try {
      // Get baseline comparison
      const baseline = this.baselineManager ?
        await this.baselineManager.getBaseline(metricName) :
        { value: rule.baseline };

      if (!baseline) {
        return {
          status: 'no_baseline',
          message: `No baseline available for ${metricName}`,
          currentValue,
          rule
        };
      }

      // Perform regression analysis
      const analysis = await this.performRegressionAnalysis(metricName, currentValue, baseline, rule, metadata);

      // Cache result
      if (this.config.cacheResults) {
        this.analysisCache.set(cacheKey, {
          result: analysis,
          timestamp: Date.now()
        });
      }

      // Emit events based on results
      if (analysis.isRegression && this.config.alertOnRegression) {
        this.emit('regressionDetected', metricName, analysis);
      } else if (analysis.isImprovement && this.config.alertOnImprovement) {
        this.emit('improvementDetected', metricName, analysis);
      }

      return analysis;
    } catch (error) {
      this.log('error', `Failed to detect regression for ${metricName}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Perform comprehensive regression analysis
   */
  async performRegressionAnalysis(metricName, currentValue, baseline, rule, metadata) {
    const baselineValue = baseline.value || baseline;
    const change = currentValue - baselineValue;
    const percentChange = (change / baselineValue) * 100;
    const ratio = currentValue / baselineValue;

    // Determine if this is a regression based on direction
    const isWorseDirection = rule.direction === 'higher_is_worse' ?
      currentValue > baselineValue :
      currentValue < baselineValue;

    // Check regression thresholds
    const exceedsRegressionThreshold = rule.direction === 'higher_is_worse' ?
      ratio >= rule.regressionThreshold :
      ratio <= (2 - rule.regressionThreshold); // Inverse for lower_is_worse

    const exceedsCriticalThreshold = rule.direction === 'higher_is_worse' ?
      ratio >= rule.criticalThreshold :
      ratio <= (2 - rule.criticalThreshold);

    // Statistical significance testing
    const statisticalAnalysis = baseline.statistics ?
      this.performStatisticalTest(currentValue, baseline) : null;

    // Trend analysis
    const trendAnalysis = this.config.enableTrendAnalysis ?
      await this.analyzeTrend(metricName) : null;

    // Anomaly detection
    const anomalyAnalysis = this.config.enableAnomalyDetection ?
      await this.detectAnomaly(metricName, currentValue) : null;

    // Root cause analysis
    const rootCauseAnalysis = this.config.enableRootCauseAnalysis ?
      this.analyzeRootCause(metricName, currentValue, baseline, metadata) : null;

    // Determine severity and status
    const severity = this.determineSeverity(ratio, rule, exceedsRegressionThreshold, exceedsCriticalThreshold);
    const status = this.determineStatus(isWorseDirection, exceedsRegressionThreshold, exceedsCriticalThreshold);

    return {
      metricName,
      currentValue,
      baselineValue,
      change,
      percentChange,
      ratio,
      isRegression: status === 'regression' || status === 'critical_regression',
      isImprovement: status === 'improvement',
      isCritical: status === 'critical_regression',
      status,
      severity,
      rule,
      statistical: statisticalAnalysis,
      trend: trendAnalysis,
      anomaly: anomalyAnalysis,
      rootCause: rootCauseAnalysis,
      metadata,
      timestamp: Date.now()
    };
  }

  /**
   * Perform statistical significance test
   */
  performStatisticalTest(currentValue, baseline) {
    if (!baseline.statistics || !baseline.confidenceInterval) {
      return null;
    }

    const { statistics, confidenceInterval, sampleSize } = baseline;

    // Calculate Z-score
    const zScore = Math.abs(currentValue - baseline.value) / statistics.standardDeviation;

    // Check if value falls outside confidence interval
    const outsideCI = currentValue < confidenceInterval.lower || currentValue > confidenceInterval.upper;

    // Calculate p-value approximation for Z-test
    const pValue = this.calculatePValue(zScore);

    // Determine statistical significance
    const isSignificant = pValue < (1 - this.config.regressionConfidenceLevel);

    return {
      zScore,
      pValue,
      isSignificant,
      outsideConfidenceInterval: outsideCI,
      confidenceInterval,
      sampleSize,
      standardDeviation: statistics.standardDeviation
    };
  }

  /**
   * Calculate approximate p-value for Z-test
   */
  calculatePValue(zScore) {
    // Approximation using complementary error function
    const absZ = Math.abs(zScore);

    // Simple approximation for p-value
    if (absZ > 6) {
      return 0;
    }
    if (absZ < 0.5) {
      return 1 - (absZ * 0.3989423);
    }

    const t = 1 / (1 + 0.2316419 * absZ);
    const polynomial = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));

    return polynomial * Math.exp(-0.5 * absZ * absZ) / Math.sqrt(2 * Math.PI);
  }

  /**
   * Analyze trend for a metric
   */
  async analyzeTrend(metricName) {
    if (!this.baselineManager) {
      return null;
    }

    const historicalData = this.baselineManager.getHistoricalData(metricName, this.config.trendAnalysisWindow);

    if (historicalData.length < 5) {
      return {
        status: 'insufficient_data',
        dataPoints: historicalData.length
      };
    }

    const values = historicalData.map(d => d.value);
    const timestamps = historicalData.map(d => d.timestamp);

    // Calculate linear regression
    const regression = this.calculateLinearRegression(timestamps, values);

    // Analyze trend direction and strength
    const trendDirection = regression.slope > 0 ? 'increasing' : 'decreasing';
    const trendStrength = Math.abs(regression.correlation);

    // Categorize trend strength
    let trendCategory = 'no_trend';
    if (trendStrength > 0.8) {
      trendCategory = 'strong_trend';
    } else if (trendStrength > 0.6) {
      trendCategory = 'moderate_trend';
    } else if (trendStrength > 0.3) {
      trendCategory = 'weak_trend';
    }

    return {
      status: 'analyzed',
      direction: trendDirection,
      strength: trendStrength,
      category: trendCategory,
      slope: regression.slope,
      intercept: regression.intercept,
      correlation: regression.correlation,
      dataPoints: values.length,
      timeSpan: timestamps[timestamps.length - 1] - timestamps[0]
    };
  }

  /**
   * Calculate linear regression
   */
  calculateLinearRegression(x, y) {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumYY = y.reduce((sum, yi) => sum + yi * yi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate correlation coefficient
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
    const correlation = denominator === 0 ? 0 : numerator / denominator;

    return { slope, intercept, correlation };
  }

  /**
   * Detect anomalies in performance data
   */
  async detectAnomaly(metricName, currentValue) {
    if (!this.baselineManager) {
      return null;
    }

    const historicalData = this.baselineManager.getHistoricalData(metricName, this.config.trendAnalysisWindow);

    if (historicalData.length < this.config.minSampleSize) {
      return {
        status: 'insufficient_data',
        dataPoints: historicalData.length
      };
    }

    const values = historicalData.map(d => d.value);

    // Calculate basic statistics
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // Calculate Z-score for current value
    const zScore = Math.abs(currentValue - mean) / stdDev;

    // Modified Z-score for outlier detection
    const median = this.calculateMedian(values);
    const medianAbsoluteDeviation = this.calculateMedian(values.map(v => Math.abs(v - median)));
    const modifiedZScore = 0.6745 * (currentValue - median) / medianAbsoluteDeviation;

    // Determine anomaly status
    const isAnomaly = zScore > this.config.anomalyDetectionSensitivity;
    const isStrongAnomaly = Math.abs(modifiedZScore) > 3.5;

    return {
      status: isAnomaly ? 'anomaly_detected' : 'normal',
      zScore,
      modifiedZScore,
      isAnomaly,
      isStrongAnomaly,
      threshold: this.config.anomalyDetectionSensitivity,
      mean,
      median,
      standardDeviation: stdDev,
      medianAbsoluteDeviation
    };
  }

  /**
   * Calculate median of an array
   */
  calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /**
   * Analyze potential root causes for performance regression
   */
  analyzeRootCause(metricName, currentValue, baseline, metadata) {
    const possibleCauses = [];
    const severity = this.determineSeverity(currentValue / baseline.value,
      this.regressionRules.get(metricName), false, false);

    // Analyze based on metric type
    switch (metricName) {
    case 'buttonLatency':
      possibleCauses.push(...this.analyzeButtonLatencyRootCause(currentValue, baseline, metadata));
      break;
    case 'serialCommunication':
      possibleCauses.push(...this.analyzeSerialCommRootCause(currentValue, baseline, metadata));
      break;
    case 'applicationStartup':
      possibleCauses.push(...this.analyzeStartupRootCause(currentValue, baseline, metadata));
      break;
    case 'memoryUsage':
      possibleCauses.push(...this.analyzeMemoryRootCause(currentValue, baseline, metadata));
      break;
    case 'configurationLoading':
      possibleCauses.push(...this.analyzeConfigLoadRootCause(currentValue, baseline, metadata));
      break;
    }

    // Add generic causes based on severity
    if (severity >= 3) {
      possibleCauses.push({
        category: 'system',
        cause: 'System resource contention',
        probability: 0.6,
        investigation: 'Check CPU, memory, and I/O usage during test execution'
      });
    }

    return {
      possibleCauses,
      recommendations: this.generateRecommendations(metricName, possibleCauses),
      investigationSteps: this.generateInvestigationSteps(metricName, currentValue, baseline)
    };
  }

  /**
   * Analyze button latency root causes
   */
  analyzeButtonLatencyRootCause(currentValue, baseline, metadata) {
    const causes = [];

    if (currentValue > baseline.value * 2) {
      causes.push({
        category: 'hardware',
        cause: 'Button matrix scanning frequency degradation',
        probability: 0.8,
        investigation: 'Check Arduino firmware timing and matrix scanning algorithm'
      });
    }

    if (metadata.simultaneousButtons > 1) {
      causes.push({
        category: 'hardware',
        cause: 'Multi-button press interference',
        probability: 0.7,
        investigation: 'Test single button presses to isolate matrix ghosting issues'
      });
    }

    if (metadata.serialLatency && metadata.serialLatency > 10) {
      causes.push({
        category: 'communication',
        cause: 'Serial communication bottleneck',
        probability: 0.6,
        investigation: 'Monitor serial port performance and buffer sizes'
      });
    }

    return causes;
  }

  /**
   * Analyze serial communication root causes
   */
  analyzeSerialCommRootCause(currentValue, baseline, metadata) {
    const causes = [];

    if (currentValue > baseline.value * 1.5) {
      causes.push({
        category: 'communication',
        cause: 'Serial port driver issues or interference',
        probability: 0.7,
        investigation: 'Check system serial port drivers and USB hub performance'
      });
    }

    if (metadata.messageSize && metadata.messageSize > 100) {
      causes.push({
        category: 'protocol',
        cause: 'Large message payloads causing delays',
        probability: 0.8,
        investigation: 'Optimize message protocols and reduce payload sizes'
      });
    }

    return causes;
  }

  /**
   * Analyze startup time root causes
   */
  analyzeStartupRootCause(currentValue, baseline, metadata) {
    const causes = [];

    if (currentValue > baseline.value * 1.3) {
      causes.push({
        category: 'initialization',
        cause: 'Slow application initialization or resource loading',
        probability: 0.7,
        investigation: 'Profile application startup sequence and identify bottlenecks'
      });
    }

    if (metadata.configSize && metadata.configSize > 1000000) { // 1MB
      causes.push({
        category: 'configuration',
        cause: 'Large configuration files slowing startup',
        probability: 0.6,
        investigation: 'Optimize configuration file size and loading strategy'
      });
    }

    return causes;
  }

  /**
   * Analyze memory usage root causes
   */
  analyzeMemoryRootCause(currentValue, baseline, metadata) {
    const causes = [];

    if (currentValue > baseline.value * 1.2) {
      causes.push({
        category: 'memory',
        cause: 'Memory leak or inefficient memory usage',
        probability: 0.8,
        investigation: 'Use memory profiling tools to identify leaks and inefficient allocations'
      });
    }

    if (metadata.activeProfiles && metadata.activeProfiles > 5) {
      causes.push({
        category: 'configuration',
        cause: 'Too many active configuration profiles',
        probability: 0.6,
        investigation: 'Reduce number of simultaneously active profiles'
      });
    }

    return causes;
  }

  /**
   * Analyze configuration loading root causes
   */
  analyzeConfigLoadRootCause(currentValue, baseline, metadata) {
    const causes = [];

    if (currentValue > baseline.value * 1.5) {
      causes.push({
        category: 'io',
        cause: 'Slow file I/O or disk performance',
        probability: 0.7,
        investigation: 'Check disk performance and file system efficiency'
      });
    }

    if (metadata.yamlComplexity && metadata.yamlComplexity > 1000) {
      causes.push({
        category: 'parsing',
        cause: 'Complex YAML configuration requiring intensive parsing',
        probability: 0.8,
        investigation: 'Simplify configuration structure or implement caching'
      });
    }

    return causes;
  }

  /**
   * Generate recommendations based on root cause analysis
   */
  generateRecommendations(metricName, possibleCauses) {
    const recommendations = [];

    const highProbabilityCauses = possibleCauses.filter(c => c.probability > 0.7);

    for (const cause of highProbabilityCauses) {
      switch (cause.category) {
      case 'hardware':
        recommendations.push('Review and optimize Arduino firmware performance');
        recommendations.push('Check hardware connections and power supply stability');
        break;
      case 'communication':
        recommendations.push('Upgrade serial communication protocol or drivers');
        recommendations.push('Implement message queuing and buffering optimizations');
        break;
      case 'memory':
        recommendations.push('Implement memory profiling and leak detection');
        recommendations.push('Optimize data structures and garbage collection');
        break;
      case 'io':
        recommendations.push('Implement configuration caching mechanisms');
        recommendations.push('Optimize file I/O operations and disk access patterns');
        break;
      }
    }

    // Remove duplicates
    return [...new Set(recommendations)];
  }

  /**
   * Generate investigation steps
   */
  generateInvestigationSteps(metricName, currentValue, baseline) {
    return [
      'Compare current measurement conditions with baseline conditions',
      'Run the performance test multiple times to confirm consistency',
      'Check system resources (CPU, memory, disk) during test execution',
      'Review recent code changes that might affect this metric',
      'Test on different hardware/environment configurations',
      'Enable detailed performance logging and profiling'
    ];
  }

  /**
   * Determine severity level (1-5 scale)
   */
  determineSeverity(ratio, rule, exceedsRegression, exceedsCritical) {
    if (exceedsCritical) {
      return 5;
    } // Critical
    if (exceedsRegression) {
      return 4;
    } // High

    const deviation = Math.abs(ratio - 1);
    if (deviation > 0.3) {
      return 3;
    } // Medium
    if (deviation > 0.15) {
      return 2;
    } // Low
    return 1; // Minimal
  }

  /**
   * Determine overall status
   */
  determineStatus(isWorseDirection, exceedsRegression, exceedsCritical) {
    if (!isWorseDirection) {
      return 'improvement';
    }
    if (exceedsCritical) {
      return 'critical_regression';
    }
    if (exceedsRegression) {
      return 'regression';
    }
    return 'within_threshold';
  }

  /**
   * Run regression analysis on multiple metrics
   */
  async analyzeMultipleMetrics(metrics) {
    const results = new Map();

    for (const [metricName, value] of Object.entries(metrics)) {
      try {
        const analysis = await this.detectRegression(metricName, value);
        results.set(metricName, analysis);
      } catch (error) {
        this.log('error', `Failed to analyze ${metricName}`, { error: error.message });
        results.set(metricName, {
          status: 'error',
          error: error.message
        });
      }
    }

    // Generate summary
    const summary = this.generateAnalysisSummary(results);

    this.emit('multipleMetricsAnalyzed', { results: Object.fromEntries(results), summary });

    return {
      results: Object.fromEntries(results),
      summary
    };
  }

  /**
   * Generate analysis summary
   */
  generateAnalysisSummary(results) {
    let totalMetrics = 0;
    let regressions = 0;
    let criticalRegressions = 0;
    let improvements = 0;
    let errors = 0;

    for (const analysis of results.values()) {
      totalMetrics++;

      switch (analysis.status) {
      case 'regression':
        regressions++;
        break;
      case 'critical_regression':
        criticalRegressions++;
        regressions++; // Critical is also a regression
        break;
      case 'improvement':
        improvements++;
        break;
      case 'error':
        errors++;
        break;
      }
    }

    const overallStatus = criticalRegressions > 0 ? 'critical' :
      regressions > 0 ? 'warning' :
        errors > 0 ? 'error' : 'pass';

    return {
      overallStatus,
      totalMetrics,
      regressions,
      criticalRegressions,
      improvements,
      errors,
      successRate: ((totalMetrics - errors) / totalMetrics) * 100
    };
  }

  /**
   * Setup cache cleanup interval
   */
  setupCacheCleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [key, cached] of this.analysisCache.entries()) {
        if (now - cached.timestamp > this.cacheTimeout) {
          this.analysisCache.delete(key);
        }
      }
    }, this.cacheTimeout);
  }

  /**
   * Clear analysis cache
   */
  clearCache() {
    this.analysisCache.clear();
    this.log('debug', 'Analysis cache cleared');
  }

  /**
   * Get regression rules
   */
  getRegressionRules() {
    return Object.fromEntries(this.regressionRules);
  }

  /**
   * Update regression rule
   */
  updateRegressionRule(metricName, updates) {
    const existingRule = this.regressionRules.get(metricName);
    if (!existingRule) {
      throw new Error(`Regression rule for ${metricName} does not exist`);
    }

    const updatedRule = { ...existingRule, ...updates };
    this.regressionRules.set(metricName, updatedRule);

    this.log('info', `Updated regression rule for ${metricName}`, updates);
    this.emit('regressionRuleUpdated', metricName, updatedRule, existingRule);
  }

  /**
   * Log messages using LogManager if available
   */
  log(level, message, data = {}) {
    if (this.logManager && this.logManager.logWithComponent) {
      this.logManager.logWithComponent('RegressionDetector', level, message, data);
    } else if (this.logManager && this.logManager.getLogger) {
      const logger = this.logManager.getLogger();
      logger[level](message, data);
    } else {
      console[level](`[RegressionDetector] ${message}`, data);
    }
  }

  /**
   * Get status information
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      rulesConfigured: this.regressionRules.size,
      cacheSize: this.analysisCache.size,
      configuration: this.config
    };
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.clearCache();
    this.regressionRules.clear();
    this.removeAllListeners();

    this.isInitialized = false;
    this.log('info', 'RegressionDetector cleaned up');
  }
}

module.exports = RegressionDetector;
