/**
 * Load Testing Framework for Macro Keyboard Platform
 * 
 * Comprehensive load testing capabilities including normal load,
 * peak load, and stress testing scenarios.
 */

const HardwareSimulator = require('./hardware-simulator');
const PerformanceMonitor = require('../../src/PerformanceMonitor');
const EventEmitter = require('events');

class LoadTester extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      testDuration: config.testDuration || 60000, // 1 minute default
      buttonCount: config.buttonCount || 16,
      encoderCount: config.encoderCount || 4,
      loadPattern: config.loadPattern || 'normal',
      concurrency: config.concurrency || 1,
      warmupDuration: config.warmupDuration || 5000,
      cooldownDuration: config.cooldownDuration || 5000,
      ...config
    };

    this.hardwareSimulator = new HardwareSimulator({
      buttonCount: this.config.buttonCount,
      encoderCount: this.config.encoderCount
    });

    this.performanceMonitor = new PerformanceMonitor({
      enabled: true,
      collectInterval: 1000,
      enableSystemMetrics: true,
      enableApplicationMetrics: true
    });

    this.testResults = {
      startTime: null,
      endTime: null,
      duration: 0,
      totalEvents: 0,
      successfulEvents: 0,
      failedEvents: 0,
      errorRate: 0,
      averageResponseTime: 0,
      p50ResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      maxResponseTime: 0,
      averageMemoryUsage: 0,
      peakMemoryUsage: 0,
      averageCpuUsage: 0,
      peakCpuUsage: 0,
      averageEventLoopLag: 0,
      p95EventLoopLag: 0,
      memoryGrowthRate: 0,
      performanceAlerts: []
    };

    this.responseTimes = [];
    this.isRunning = false;
  }

  /**
   * Run normal load test
   */
  async runNormalLoadTest() {
    console.log('Starting Normal Load Test...');
    
    return await this.runLoadTest({
      buttonPressRate: 2, // per minute
      encoderRotationRate: 1, // per minute
      profileSwitchRate: 0.5, // per hour
      configUpdateRate: 0.1, // per hour
      testPattern: 'normal'
    });
  }

  /**
   * Run peak load test
   */
  async runPeakLoadTest() {
    console.log('Starting Peak Load Test...');
    
    return await this.runLoadTest({
      buttonPressRate: 30, // per minute
      encoderRotationRate: 15, // per minute  
      profileSwitchRate: 10, // per hour
      configUpdateRate: 2, // per hour
      testPattern: 'peak'
    });
  }

  /**
   * Run stress test
   */
  async runStressTest() {
    console.log('Starting Stress Test...');
    
    return await this.runLoadTest({
      buttonPressRate: 120, // per minute
      encoderRotationRate: 60, // per minute
      profileSwitchRate: 30, // per hour
      configUpdateRate: 10, // per hour
      testPattern: 'stress'
    });
  }

  /**
   * Generic load test runner
   */
  async runLoadTest(loadConfig) {
    this.isRunning = true;
    this.testResults.startTime = Date.now();
    
    try {
      // Initialize monitoring
      await this.performanceMonitor.startMonitoring();
      
      // Warmup period
      console.log('Warmup phase...');
      await this.runWarmup();
      
      // Generate load pattern
      console.log('Generating load pattern...');
      const events = this.generateLoadEvents(loadConfig);
      
      // Execute load test
      console.log('Executing load test...');
      await this.executeLoadTest(events);
      
      // Cooldown period
      console.log('Cooldown phase...');
      await this.runCooldown();
      
      // Analyze results
      console.log('Analyzing results...');
      await this.analyzeResults();
      
      this.testResults.endTime = Date.now();
      this.testResults.duration = this.testResults.endTime - this.testResults.startTime;
      
      return this.testResults;
      
    } catch (error) {
      console.error('Load test failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
      await this.performanceMonitor.stopMonitoring();
      this.hardwareSimulator.stop();
    }
  }

  /**
   * Run warmup phase
   */
  async runWarmup() {
    this.hardwareSimulator.start();
    
    // Generate light load during warmup
    const warmupEvents = this.hardwareSimulator.generateLoadPattern(
      'normal', 
      this.config.warmupDuration
    );
    
    await this.hardwareSimulator.executeEventSequence(warmupEvents);
    
    // Clear warmup metrics
    this.responseTimes = [];
  }

  /**
   * Run cooldown phase  
   */
  async runCooldown() {
    await this.sleep(this.config.cooldownDuration);
  }

  /**
   * Generate load events based on configuration
   */
  generateLoadEvents(loadConfig) {
    const events = [];
    const testDurationMs = this.config.testDuration;
    
    // Calculate event intervals
    const buttonInterval = 60000 / loadConfig.buttonPressRate; // ms between button presses
    const encoderInterval = 60000 / loadConfig.encoderRotationRate; // ms between encoder rotations
    
    let currentTime = 0;
    let nextButtonTime = buttonInterval;
    let nextEncoderTime = encoderInterval;
    
    while (currentTime < testDurationMs) {
      // Add button press events
      if (currentTime >= nextButtonTime) {
        const buttonId = Math.floor(Math.random() * this.config.buttonCount);
        events.push({
          time: currentTime,
          type: 'button',
          buttonId: buttonId,
          duration: 50 + Math.random() * 100
        });
        nextButtonTime += buttonInterval + (Math.random() - 0.5) * buttonInterval * 0.2; // ±10% jitter
      }
      
      // Add encoder rotation events
      if (currentTime >= nextEncoderTime) {
        const encoderId = Math.floor(Math.random() * this.config.encoderCount);
        const direction = Math.random() > 0.5 ? 'CW' : 'CCW';
        events.push({
          time: currentTime,
          type: 'encoder',
          encoderId: encoderId,
          direction: direction,
          steps: 1 + Math.floor(Math.random() * 3)
        });
        nextEncoderTime += encoderInterval + (Math.random() - 0.5) * encoderInterval * 0.2; // ±10% jitter
      }
      
      currentTime += 100; // 100ms increments
    }
    
    return events.sort((a, b) => a.time - b.time);
  }

  /**
   * Execute load test events
   */
  async executeLoadTest(events) {
    const startTime = Date.now();
    
    for (const event of events) {
      if (!this.isRunning) break;
      
      const targetTime = startTime + event.time;
      const currentTime = Date.now();
      
      // Wait until target time
      if (targetTime > currentTime) {
        await this.sleep(targetTime - currentTime);
      }
      
      // Execute event and measure response time
      const responseTime = await this.executeEventWithTiming(event);
      
      if (responseTime !== null) {
        this.responseTimes.push(responseTime);
        this.testResults.successfulEvents++;
      } else {
        this.testResults.failedEvents++;
      }
      
      this.testResults.totalEvents++;
    }
  }

  /**
   * Execute single event with timing measurement
   */
  async executeEventWithTiming(event) {
    const startTime = process.hrtime.bigint();
    
    try {
      if (event.type === 'button') {
        await this.simulateButtonPress(event);
      } else if (event.type === 'encoder') {
        await this.simulateEncoderRotation(event);
      }
      
      const endTime = process.hrtime.bigint();
      return Number(endTime - startTime) / 1000000; // Convert to milliseconds
      
    } catch (error) {
      console.error('Event execution failed:', error);
      return null;
    }
  }

  /**
   * Simulate button press with action execution
   */
  async simulateButtonPress(event) {
    // Simulate hardware event
    this.hardwareSimulator.simulateButtonPress(event.buttonId, event.duration);
    
    // Simulate action execution delay
    await this.sleep(5 + Math.random() * 20); // 5-25ms processing time
  }

  /**
   * Simulate encoder rotation with action execution
   */
  async simulateEncoderRotation(event) {
    // Simulate hardware event
    this.hardwareSimulator.simulateEncoderRotation(
      event.encoderId, 
      event.direction, 
      event.steps
    );
    
    // Simulate action execution delay
    await this.sleep(2 + Math.random() * 10); // 2-12ms processing time
  }

  /**
   * Analyze test results
   */
  async analyzeResults() {
    // Calculate response time statistics
    if (this.responseTimes.length > 0) {
      const sorted = [...this.responseTimes].sort((a, b) => a - b);
      
      this.testResults.averageResponseTime = 
        this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
      
      this.testResults.p50ResponseTime = this.getPercentile(sorted, 50);
      this.testResults.p95ResponseTime = this.getPercentile(sorted, 95);
      this.testResults.p99ResponseTime = this.getPercentile(sorted, 99);
      this.testResults.maxResponseTime = Math.max(...this.responseTimes);
    }

    // Calculate error rate
    this.testResults.errorRate = this.testResults.totalEvents > 0 
      ? (this.testResults.failedEvents / this.testResults.totalEvents) * 100 
      : 0;

    // Get performance monitoring results
    const performanceStats = this.performanceMonitor.getStatistics();
    
    this.testResults.averageMemoryUsage = performanceStats.averages?.memoryUsage || 0;
    this.testResults.averageEventLoopLag = performanceStats.averages?.eventLoopLag || 0;
    
    // Get peak values from monitoring data
    const recentMetrics = this.performanceMonitor.getRecentMetrics(this.config.testDuration);
    
    if (recentMetrics.system.length > 0) {
      this.testResults.peakMemoryUsage = Math.max(
        ...recentMetrics.system.map(m => m.memory.heapUsed)
      );
      
      // Calculate memory growth rate
      const firstMetric = recentMetrics.system[0];
      const lastMetric = recentMetrics.system[recentMetrics.system.length - 1];
      
      if (firstMetric && lastMetric) {
        const timeDiff = (lastMetric.timestamp - firstMetric.timestamp) / (1000 * 60 * 60); // hours
        const memoryDiff = lastMetric.memory.heapUsed - firstMetric.memory.heapUsed;
        this.testResults.memoryGrowthRate = timeDiff > 0 ? memoryDiff / timeDiff : 0;
      }
    }

    // Collect performance alerts
    this.testResults.performanceAlerts = this.performanceMonitor.getOptimizationSuggestions();
  }

  /**
   * Get percentile value from sorted array
   */
  getPercentile(sortedArray, percentile) {
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)] || 0;
  }

  /**
   * Run scalability test across different configurations
   */
  async runScalabilityTest() {
    const configurations = [
      { buttons: 8, encoders: 2, name: 'minimal' },
      { buttons: 16, encoders: 4, name: 'standard' },
      { buttons: 24, encoders: 6, name: 'advanced' },
      { buttons: 32, encoders: 8, name: 'maximum' }
    ];

    const results = {};

    for (const config of configurations) {
      console.log(`Testing ${config.name} configuration...`);
      
      this.config.buttonCount = config.buttons;
      this.config.encoderCount = config.encoders;
      
      // Reinitialize hardware simulator with new config
      this.hardwareSimulator = new HardwareSimulator({
        buttonCount: config.buttons,
        encoderCount: config.encoders
      });

      const testResult = await this.runNormalLoadTest();
      results[config.name] = testResult;
    }

    return results;
  }

  /**
   * Run resource constraint test
   */
  async runResourceConstraintTest(constraints = {}) {
    console.log('Starting Resource Constraint Test...');
    
    // Simulate memory pressure
    if (constraints.memoryPressure) {
      await this.simulateMemoryPressure();
    }
    
    // Simulate CPU pressure
    if (constraints.cpuPressure) {
      await this.simulateCpuPressure();
    }
    
    return await this.runNormalLoadTest();
  }

  /**
   * Simulate memory pressure
   */
  async simulateMemoryPressure() {
    // Allocate large arrays to create memory pressure
    const memoryHogs = [];
    for (let i = 0; i < 10; i++) {
      memoryHogs.push(new Array(1000000).fill(Math.random()));
    }
    
    // Keep references to prevent GC
    this.memoryHogs = memoryHogs;
  }

  /**
   * Simulate CPU pressure
   */
  async simulateCpuPressure() {
    // Start CPU-intensive background tasks
    const cpuWorkers = [];
    
    for (let i = 0; i < 4; i++) {
      const worker = setInterval(() => {
        const start = Date.now();
        while (Date.now() - start < 50) {
          // CPU-intensive calculation
          Math.sin(Math.random()) * Math.cos(Math.random());
        }
      }, 100);
      
      cpuWorkers.push(worker);
    }
    
    this.cpuWorkers = cpuWorkers;
  }

  /**
   * Generate performance report
   */
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      testConfiguration: {
        duration: this.config.testDuration,
        buttonCount: this.config.buttonCount,
        encoderCount: this.config.encoderCount,
        loadPattern: this.config.loadPattern
      },
      executionSummary: {
        totalEvents: this.testResults.totalEvents,
        successfulEvents: this.testResults.successfulEvents,
        failedEvents: this.testResults.failedEvents,
        errorRate: this.testResults.errorRate,
        testDuration: this.testResults.duration
      },
      performanceMetrics: {
        responseTime: {
          average: this.testResults.averageResponseTime,
          p50: this.testResults.p50ResponseTime,
          p95: this.testResults.p95ResponseTime,
          p99: this.testResults.p99ResponseTime,
          maximum: this.testResults.maxResponseTime
        },
        resourceUtilization: {
          averageMemoryUsage: this.testResults.averageMemoryUsage,
          peakMemoryUsage: this.testResults.peakMemoryUsage,
          memoryGrowthRate: this.testResults.memoryGrowthRate,
          averageEventLoopLag: this.testResults.averageEventLoopLag
        }
      },
      complianceStatus: this.checkCompliance(),
      recommendations: this.generateRecommendations()
    };

    return report;
  }

  /**
   * Check SLA compliance
   */
  checkCompliance() {
    const compliance = {
      overall: 'PASS',
      responseTimeCompliance: this.testResults.p95ResponseTime <= 100,
      errorRateCompliance: this.testResults.errorRate <= 1.0,
      memoryUsageCompliance: this.testResults.peakMemoryUsage <= 300 * 1024 * 1024,
      eventLoopLagCompliance: this.testResults.averageEventLoopLag <= 10
    };

    // Overall compliance check
    if (!compliance.responseTimeCompliance || 
        !compliance.errorRateCompliance ||
        !compliance.memoryUsageCompliance ||
        !compliance.eventLoopLagCompliance) {
      compliance.overall = 'FAIL';
    }

    return compliance;
  }

  /**
   * Generate optimization recommendations
   */
  generateRecommendations() {
    const recommendations = [];

    if (this.testResults.p95ResponseTime > 75) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: 'Response time approaching threshold limits',
        actions: [
          'Profile action execution paths',
          'Optimize serial communication',
          'Consider response time caching'
        ]
      });
    }

    if (this.testResults.memoryGrowthRate > 5 * 1024 * 1024) { // 5MB/hour
      recommendations.push({
        type: 'memory',
        priority: 'medium',
        message: 'Memory growth rate exceeds expected bounds',
        actions: [
          'Review for memory leaks',
          'Optimize data structures',
          'Implement periodic cleanup'
        ]
      });
    }

    return recommendations;
  }

  /**
   * Sleep utility function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this.isRunning = false;
    
    if (this.hardwareSimulator) {
      this.hardwareSimulator.stop();
    }
    
    if (this.performanceMonitor) {
      await this.performanceMonitor.stopMonitoring();
    }
    
    // Clean up resource constraint simulations
    if (this.memoryHogs) {
      this.memoryHogs = null;
    }
    
    if (this.cpuWorkers) {
      this.cpuWorkers.forEach(worker => clearInterval(worker));
      this.cpuWorkers = null;
    }
  }
}

module.exports = LoadTester;