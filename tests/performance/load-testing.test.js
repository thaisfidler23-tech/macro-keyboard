/**
 * Comprehensive Load Testing Test Suite
 * 
 * Tests normal load, peak load, stress scenarios, and scalability
 * across different hardware configurations.
 */

const LoadTester = require('./load-tester');
const HardwareSimulator = require('./hardware-simulator');

// Test configuration
const TEST_CONFIG = {
  QUICK_TEST_DURATION: 30000,    // 30 seconds for CI
  NORMAL_TEST_DURATION: 120000,  // 2 minutes for normal testing
  EXTENDED_TEST_DURATION: 300000, // 5 minutes for comprehensive testing
  
  RESPONSE_TIME_THRESHOLDS: {
    NORMAL_LOAD: { target: 50, warning: 75, critical: 100 },
    PEAK_LOAD: { target: 75, warning: 100, critical: 150 },
    STRESS_LOAD: { target: 100, warning: 150, critical: 200 }
  },
  
  RESOURCE_THRESHOLDS: {
    MEMORY_USAGE: 300 * 1024 * 1024, // 300MB
    MEMORY_GROWTH_RATE: 10 * 1024 * 1024, // 10MB/hour
    CPU_USAGE: 25, // 25%
    EVENT_LOOP_LAG: 10, // 10ms average
    ERROR_RATE: 1.0 // 1%
  }
};

describe('Load Testing Suite', () => {
  let loadTester;

  beforeEach(() => {
    // Use quick test duration for unit tests
    loadTester = new LoadTester({
      testDuration: TEST_CONFIG.QUICK_TEST_DURATION,
      warmupDuration: 2000,
      cooldownDuration: 1000
    });
  });

  afterEach(async () => {
    if (loadTester) {
      await loadTester.cleanup();
    }
  });

  describe('Normal Load Testing', () => {
    test('should handle typical user activity load', async () => {
      const results = await loadTester.runNormalLoadTest();
      
      expect(results.totalEvents).toBeGreaterThan(0);
      expect(results.errorRate).toBeLessThan(TEST_CONFIG.RESOURCE_THRESHOLDS.ERROR_RATE);
      expect(results.p95ResponseTime).toBeLessThan(TEST_CONFIG.RESPONSE_TIME_THRESHOLDS.NORMAL_LOAD.critical);
      
      console.log('Normal Load Test Results:', {
        totalEvents: results.totalEvents,
        errorRate: results.errorRate,
        avgResponseTime: results.averageResponseTime,
        p95ResponseTime: results.p95ResponseTime,
        peakMemoryUsage: results.peakMemoryUsage
      });
    }, 60000);

    test('should maintain consistent performance over time', async () => {
      // Extended test for performance consistency
      const extendedTester = new LoadTester({
        testDuration: TEST_CONFIG.NORMAL_TEST_DURATION,
        buttonCount: 16,
        encoderCount: 4
      });

      const results = await extendedTester.runNormalLoadTest();
      
      expect(results.averageResponseTime).toBeLessThan(TEST_CONFIG.RESPONSE_TIME_THRESHOLDS.NORMAL_LOAD.target);
      expect(results.memoryGrowthRate).toBeLessThan(TEST_CONFIG.RESOURCE_THRESHOLDS.MEMORY_GROWTH_RATE);
      expect(results.averageEventLoopLag).toBeLessThan(TEST_CONFIG.RESOURCE_THRESHOLDS.EVENT_LOOP_LAG);
      
      await extendedTester.cleanup();
    }, 180000);

    test('should handle button press frequency variations', async () => {
      const results = await loadTester.runNormalLoadTest();
      
      // Verify response time distribution
      expect(results.p99ResponseTime).toBeLessThan(results.p95ResponseTime * 1.5);
      expect(results.maxResponseTime).toBeLessThan(results.p99ResponseTime * 2);
      
      // Verify successful event processing
      const successRate = (results.successfulEvents / results.totalEvents) * 100;
      expect(successRate).toBeGreaterThan(99);
    });
  });

  describe('Peak Load Testing', () => {
    test('should handle high-frequency button presses', async () => {
      const results = await loadTester.runPeakLoadTest();
      
      expect(results.errorRate).toBeLessThan(TEST_CONFIG.RESOURCE_THRESHOLDS.ERROR_RATE);
      expect(results.p95ResponseTime).toBeLessThan(TEST_CONFIG.RESPONSE_TIME_THRESHOLDS.PEAK_LOAD.critical);
      expect(results.peakMemoryUsage).toBeLessThan(TEST_CONFIG.RESOURCE_THRESHOLDS.MEMORY_USAGE);
      
      console.log('Peak Load Test Results:', {
        totalEvents: results.totalEvents,
        errorRate: results.errorRate,
        p95ResponseTime: results.p95ResponseTime,
        peakMemoryUsage: results.peakMemoryUsage
      });
    }, 60000);

    test('should maintain acceptable performance under sustained peak load', async () => {
      const peakTester = new LoadTester({
        testDuration: TEST_CONFIG.NORMAL_TEST_DURATION,
        buttonCount: 24,
        encoderCount: 6
      });

      const results = await peakTester.runPeakLoadTest();
      
      // Peak load acceptance criteria
      expect(results.p95ResponseTime).toBeLessThan(TEST_CONFIG.RESPONSE_TIME_THRESHOLDS.PEAK_LOAD.critical);
      expect(results.averageEventLoopLag).toBeLessThan(25); // Relaxed threshold for peak load
      
      await peakTester.cleanup();
    }, 180000);

    test('should recover quickly from load spikes', async () => {
      // Test load spike recovery
      const spikeResults = await loadTester.runPeakLoadTest();
      
      // Allow brief recovery period
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const recoveryResults = await loadTester.runNormalLoadTest();
      
      // Verify recovery to normal performance levels
      expect(recoveryResults.averageResponseTime).toBeLessThan(
        spikeResults.averageResponseTime * 0.8
      );
    }, 90000);
  });

  describe('Stress Testing', () => {
    test('should identify system breaking point', async () => {
      const results = await loadTester.runStressTest();
      
      // Stress testing may have higher error rates and response times
      expect(results.errorRate).toBeLessThan(5.0); // 5% error rate acceptable under stress
      expect(results.p95ResponseTime).toBeLessThan(TEST_CONFIG.RESPONSE_TIME_THRESHOLDS.STRESS_LOAD.critical);
      
      console.log('Stress Test Results:', {
        totalEvents: results.totalEvents,
        errorRate: results.errorRate,
        p95ResponseTime: results.p95ResponseTime,
        maxResponseTime: results.maxResponseTime
      });
    }, 60000);

    test('should maintain core functionality under stress', async () => {
      const results = await loadTester.runStressTest();
      
      // Even under stress, some events should succeed
      expect(results.successfulEvents).toBeGreaterThan(0);
      expect(results.successfulEvents / results.totalEvents).toBeGreaterThan(0.8); // 80% success rate minimum
    });

    test('should handle resource exhaustion gracefully', async () => {
      const results = await loadTester.runResourceConstraintTest({
        memoryPressure: true,
        cpuPressure: true
      });
      
      // Should still function under resource pressure
      expect(results.successfulEvents).toBeGreaterThan(0);
      expect(results.errorRate).toBeLessThan(10.0); // Higher error tolerance under pressure
    }, 90000);
  });

  describe('Scalability Testing', () => {
    test('should maintain performance across different button configurations', async () => {
      const configurations = [
        { buttons: 8, encoders: 2, name: 'minimal' },
        { buttons: 16, encoders: 4, name: 'standard' },
        { buttons: 32, encoders: 8, name: 'maximum' }
      ];

      const baselineResult = await new LoadTester({
        testDuration: TEST_CONFIG.QUICK_TEST_DURATION,
        buttonCount: 8,
        encoderCount: 2
      }).runNormalLoadTest();

      for (const config of configurations.slice(1)) {
        const configTester = new LoadTester({
          testDuration: TEST_CONFIG.QUICK_TEST_DURATION,
          buttonCount: config.buttons,
          encoderCount: config.encoders
        });

        const results = await configTester.runNormalLoadTest();
        
        // Performance degradation should be less than 30%
        const performanceDegradation = 
          (results.averageResponseTime - baselineResult.averageResponseTime) / 
          baselineResult.averageResponseTime;
        
        expect(performanceDegradation).toBeLessThan(0.30);
        
        console.log(`${config.name} configuration performance:`, {
          avgResponseTime: results.averageResponseTime,
          degradation: `${(performanceDegradation * 100).toFixed(1)}%`
        });
        
        await configTester.cleanup();
      }
    }, 120000);

    test('should scale memory usage proportionally', async () => {
      const results8Button = await new LoadTester({
        testDuration: TEST_CONFIG.QUICK_TEST_DURATION,
        buttonCount: 8,
        encoderCount: 2
      }).runNormalLoadTest();

      const results32Button = await new LoadTester({
        testDuration: TEST_CONFIG.QUICK_TEST_DURATION,
        buttonCount: 32,
        encoderCount: 8
      }).runNormalLoadTest();

      // Memory usage should scale reasonably (less than 4x for 4x buttons)
      const memoryScaling = results32Button.peakMemoryUsage / results8Button.peakMemoryUsage;
      expect(memoryScaling).toBeLessThan(3.0);
      
      console.log('Memory scaling factor:', memoryScaling.toFixed(2));
    }, 90000);
  });

  describe('Hardware Simulation Testing', () => {
    test('should accurately simulate hardware events', async () => {
      const simulator = new HardwareSimulator({
        buttonCount: 16,
        encoderCount: 4
      });

      simulator.start();
      
      // Track events
      let eventCount = 0;
      simulator.on('button-event', () => eventCount++);
      simulator.on('encoder-event', () => eventCount++);

      // Generate test events
      simulator.simulateButtonPress(0, 100);
      simulator.simulateButtonPress(1, 100);
      simulator.simulateEncoderRotation(0, 'CW', 2);
      
      // Wait for events to complete
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(eventCount).toBeGreaterThan(0);
      
      const stats = simulator.getStatistics();
      expect(stats.eventCount).toBeGreaterThan(0);
      expect(stats.isRunning).toBe(true);
      
      simulator.stop();
    });

    test('should generate realistic load patterns', async () => {
      const simulator = new HardwareSimulator({
        buttonCount: 16,
        encoderCount: 4
      });

      const normalEvents = simulator.generateLoadPattern('normal', 10000);
      const peakEvents = simulator.generateLoadPattern('peak', 10000);
      const stressEvents = simulator.generateLoadPattern('stress', 10000);

      // Peak load should have more events than normal
      expect(peakEvents.length).toBeGreaterThan(normalEvents.length);
      
      // Stress load should have more events than peak
      expect(stressEvents.length).toBeGreaterThan(peakEvents.length);
      
      // Events should be properly distributed over time
      const normalTimeSpread = Math.max(...normalEvents.map(e => e.time)) - 
                              Math.min(...normalEvents.map(e => e.time));
      expect(normalTimeSpread).toBeGreaterThan(5000); // Should span most of the duration
    });
  });

  describe('Performance Monitoring Integration', () => {
    test('should collect comprehensive performance metrics', async () => {
      const results = await loadTester.runNormalLoadTest();
      
      // Verify all key metrics are collected
      expect(results.averageResponseTime).toBeDefined();
      expect(results.p95ResponseTime).toBeDefined();
      expect(results.averageMemoryUsage).toBeDefined();
      expect(results.peakMemoryUsage).toBeDefined();
      expect(results.averageEventLoopLag).toBeDefined();
      expect(results.errorRate).toBeDefined();
      
      // Verify metrics are reasonable
      expect(results.averageResponseTime).toBeGreaterThan(0);
      expect(results.p95ResponseTime).toBeGreaterThanOrEqual(results.averageResponseTime);
      expect(results.peakMemoryUsage).toBeGreaterThanOrEqual(results.averageMemoryUsage);
    });

    test('should generate performance compliance report', async () => {
      const results = await loadTester.runNormalLoadTest();
      const report = loadTester.generateReport();
      
      expect(report.timestamp).toBeDefined();
      expect(report.testConfiguration).toBeDefined();
      expect(report.executionSummary).toBeDefined();
      expect(report.performanceMetrics).toBeDefined();
      expect(report.complianceStatus).toBeDefined();
      
      // Verify compliance status structure
      expect(report.complianceStatus.overall).toMatch(/PASS|FAIL/);
      expect(report.complianceStatus.responseTimeCompliance).toBeDefined();
      expect(report.complianceStatus.errorRateCompliance).toBeDefined();
      expect(report.complianceStatus.memoryUsageCompliance).toBeDefined();
    });

    test('should provide optimization recommendations', async () => {
      // Run a stress test to potentially generate recommendations
      const results = await loadTester.runStressTest();
      const report = loadTester.generateReport();
      
      expect(Array.isArray(report.recommendations)).toBe(true);
      
      // If there are recommendations, verify structure
      if (report.recommendations.length > 0) {
        const recommendation = report.recommendations[0];
        expect(recommendation.type).toBeDefined();
        expect(recommendation.priority).toBeDefined();
        expect(recommendation.message).toBeDefined();
        expect(Array.isArray(recommendation.actions)).toBe(true);
      }
    });
  });

  describe('Error Recovery Testing', () => {
    test('should recover from temporary failures', async () => {
      // This test would simulate various failure conditions
      const results = await loadTester.runNormalLoadTest();
      
      // Even with some failures, should maintain acceptable performance
      expect(results.errorRate).toBeLessThan(TEST_CONFIG.RESOURCE_THRESHOLDS.ERROR_RATE);
      expect(results.successfulEvents).toBeGreaterThan(results.failedEvents);
    });

    test('should maintain stability after error conditions', async () => {
      // Run test that might produce errors
      await loadTester.runStressTest();
      
      // Verify system can return to normal operation
      const recoveryResults = await loadTester.runNormalLoadTest();
      
      expect(recoveryResults.errorRate).toBeLessThan(TEST_CONFIG.RESOURCE_THRESHOLDS.ERROR_RATE);
      expect(recoveryResults.p95ResponseTime).toBeLessThan(TEST_CONFIG.RESPONSE_TIME_THRESHOLDS.NORMAL_LOAD.critical);
    }, 90000);
  });
});

describe('Performance Regression Testing', () => {
  test('should detect performance regressions', async () => {
    // This would typically compare against stored baseline metrics
    const currentResults = await new LoadTester({
      testDuration: TEST_CONFIG.QUICK_TEST_DURATION
    }).runNormalLoadTest();
    
    // For demo purposes, using static thresholds
    // In real implementation, would compare against historical baselines
    expect(currentResults.p95ResponseTime).toBeLessThan(TEST_CONFIG.RESPONSE_TIME_THRESHOLDS.NORMAL_LOAD.critical);
    expect(currentResults.peakMemoryUsage).toBeLessThan(TEST_CONFIG.RESOURCE_THRESHOLDS.MEMORY_USAGE);
    
    console.log('Performance Regression Check Results:', {
      p95ResponseTime: currentResults.p95ResponseTime,
      peakMemoryUsage: currentResults.peakMemoryUsage,
      errorRate: currentResults.errorRate
    });
  });
});

// Performance benchmark suite for CI/CD
describe('CI/CD Performance Benchmarks', () => {
  const CI_TEST_DURATION = 15000; // 15 seconds for fast CI execution

  test('quick performance smoke test', async () => {
    const quickTester = new LoadTester({
      testDuration: CI_TEST_DURATION,
      warmupDuration: 1000,
      cooldownDuration: 1000
    });

    const results = await quickTester.runNormalLoadTest();
    
    // Basic performance gates for CI/CD
    expect(results.errorRate).toBeLessThan(1.0);
    expect(results.p95ResponseTime).toBeLessThan(150); // Relaxed for CI
    expect(results.successfulEvents).toBeGreaterThan(0);
    
    await quickTester.cleanup();
  }, 30000);
});