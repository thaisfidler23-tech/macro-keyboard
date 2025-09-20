/**
 * LEDHardwareTester - Comprehensive hardware testing framework for LED systems
 * 
 * This class provides automated testing and validation for RGB LED hardware,
 * including color accuracy, performance benchmarking, power consumption analysis,
 * and reliability testing to ensure consistent operation across different hardware configurations.
 * 
 * Features:
 * - Automated color accuracy testing with Delta E calculations
 * - Performance benchmarking for latency and frame rate
 * - Power consumption measurement and validation
 * - Thermal testing under continuous operation
 * - Cross-platform hardware compatibility testing
 * - Comprehensive test result analysis and reporting
 */

const EventEmitter = require('events');
const { performance } = require('perf_hooks');

class LEDHardwareTester extends EventEmitter {
  constructor(ledController, logger = console) {
    super();
    
    this.ledController = ledController;
    this.logger = logger;
    
    // Testing configuration
    this.config = {
      colorTolerance: {
        deltaE: 5.0,           // Maximum acceptable color difference (Delta E)
        brightnessVariation: 0.03, // 3% brightness variation tolerance
        temperatureStability: 0.05  // 5% variation across temperature range
      },
      performance: {
        maxLatency: 10,        // Maximum acceptable latency (ms)
        targetFrameRate: 60,   // Target frame rate for animations (fps)
        maxMemoryUsage: 1024,  // Maximum memory usage (bytes)
        maxPowerDraw: 450      // Maximum power draw (mA)
      },
      reliability: {
        testDuration: 24 * 60 * 60 * 1000, // 24 hours (ms)
        powerCycles: 1000,     // Number of power cycle tests
        errorRateThreshold: 0.001  // Maximum acceptable error rate (0.1%)
      }
    };
    
    // Test categories and patterns
    this.testingCategories = {
      colorAccuracy: [
        'primaryColorTest',
        'secondaryColorTest', 
        'whiteBalanceTest',
        'grayscaleTest',
        'colorTemperatureTest'
      ],
      performance: [
        'updateLatencyTest',
        'animationSmoothnessTest',
        'memoryUsageTest',
        'powerConsumptionTest',
        'thermalStabilityTest'
      ],
      reliability: [
        'longevityTest',
        'powerCycleTest',
        'dataIntegrityTest',
        'interferenceTest',
        'failureRecoveryTest'
      ]
    };
    
    // Test patterns for validation
    this.testPatterns = {
      solidColors: [
        { name: 'Pure Red', r: 255, g: 0, b: 0 },
        { name: 'Pure Green', r: 0, g: 255, b: 0 },
        { name: 'Pure Blue', r: 0, g: 0, b: 255 },
        { name: 'Pure White', r: 255, g: 255, b: 255 },
        { name: 'Pure Black', r: 0, g: 0, b: 0 },
        { name: 'Cyan', r: 0, g: 255, b: 255 },
        { name: 'Magenta', r: 255, g: 0, b: 255 },
        { name: 'Yellow', r: 255, g: 255, b: 0 }
      ],
      grayscale: this.generateGrayscalePattern(),
      temperature: this.generateTemperaturePattern()
    };
    
    // Test results storage
    this.testResults = new Map();
    this.isTestingActive = false;
    
    this.logger.info('LEDHardwareTester initialized');
  }
  
  /**
   * Generate grayscale test pattern for brightness linearity testing
   */
  generateGrayscalePattern() {
    const pattern = [];
    for (let i = 0; i <= 255; i += 17) { // 16 levels from 0 to 255
      pattern.push({
        name: `Gray ${i}`,
        r: i, g: i, b: i
      });
    }
    return pattern;
  }
  
  /**
   * Generate color temperature test pattern
   */
  generateTemperaturePattern() {
    const temperatures = [2700, 3200, 4000, 5000, 6500, 8000]; // Kelvin
    return temperatures.map(temp => ({
      name: `${temp}K`,
      ...this.kelvinToRGB(temp)
    }));
  }
  
  /**
   * Convert color temperature (Kelvin) to RGB
   */
  kelvinToRGB(kelvin) {
    const temp = kelvin / 100;
    let r, g, b;
    
    // Red calculation
    if (temp <= 66) {
      r = 255;
    } else {
      r = temp - 60;
      r = 329.698727446 * Math.pow(r, -0.1332047592);
      r = Math.max(0, Math.min(255, r));
    }
    
    // Green calculation
    if (temp <= 66) {
      g = temp;
      g = 99.4708025861 * Math.log(g) - 161.1195681661;
    } else {
      g = temp - 60;
      g = 288.1221695283 * Math.pow(g, -0.0755148492);
    }
    g = Math.max(0, Math.min(255, g));
    
    // Blue calculation
    if (temp >= 66) {
      b = 255;
    } else if (temp <= 19) {
      b = 0;
    } else {
      b = temp - 10;
      b = 138.5177312231 * Math.log(b) - 305.0447927307;
      b = Math.max(0, Math.min(255, b));
    }
    
    return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
  }
  
  /**
   * Run comprehensive LED hardware test suite
   */
  async runFullTestSuite() {
    if (this.isTestingActive) {
      throw new Error('Testing already in progress');
    }
    
    this.isTestingActive = true;
    this.emit('test-suite-started');
    
    try {
      this.logger.info('Starting comprehensive LED hardware test suite');
      
      const results = {
        startTime: Date.now(),
        colorAccuracy: {},
        performance: {},
        reliability: {},
        overall: { passed: true, score: 0 }
      };
      
      // Color Accuracy Tests
      this.emit('test-category-started', 'colorAccuracy');
      for (const testName of this.testingCategories.colorAccuracy) {
        try {
          results.colorAccuracy[testName] = await this[testName]();
          this.emit('test-completed', { category: 'colorAccuracy', test: testName, passed: results.colorAccuracy[testName].passed });
        } catch (error) {
          this.logger.error(`Color accuracy test '${testName}' failed:`, error);
          results.colorAccuracy[testName] = { passed: false, error: error.message };
        }
      }
      
      // Performance Tests
      this.emit('test-category-started', 'performance');
      for (const testName of this.testingCategories.performance) {
        try {
          results.performance[testName] = await this[testName]();
          this.emit('test-completed', { category: 'performance', test: testName, passed: results.performance[testName].passed });
        } catch (error) {
          this.logger.error(`Performance test '${testName}' failed:`, error);
          results.performance[testName] = { passed: false, error: error.message };
        }
      }
      
      // Reliability Tests (subset for automated testing)
      this.emit('test-category-started', 'reliability');
      const quickReliabilityTests = ['dataIntegrityTest', 'failureRecoveryTest'];
      for (const testName of quickReliabilityTests) {
        try {
          results.reliability[testName] = await this[testName]();
          this.emit('test-completed', { category: 'reliability', test: testName, passed: results.reliability[testName].passed });
        } catch (error) {
          this.logger.error(`Reliability test '${testName}' failed:`, error);
          results.reliability[testName] = { passed: false, error: error.message };
        }
      }
      
      // Calculate overall score and pass/fail
      results.overall = this.calculateOverallScore(results);
      results.endTime = Date.now();
      results.duration = results.endTime - results.startTime;
      
      // Store results
      this.testResults.set('full-suite', results);
      
      this.emit('test-suite-completed', results);
      this.logger.info(`Test suite completed. Overall score: ${results.overall.score}%, Passed: ${results.overall.passed}`);
      
      return results;
      
    } finally {
      this.isTestingActive = false;
    }
  }
  
  /**
   * Test color accuracy for primary colors (Red, Green, Blue)
   */
  async primaryColorTest() {
    this.logger.info('Running primary color accuracy test');
    
    const primaryColors = this.testPatterns.solidColors.slice(0, 3); // R, G, B
    const results = {
      passed: true,
      colors: {},
      averageDeltaE: 0,
      maxDeltaE: 0
    };
    
    let totalDeltaE = 0;
    
    for (const color of primaryColors) {
      // Set LED to target color
      await this.setLEDColor(1, color);
      
      // Simulate color measurement (in real implementation, would use colorimeter)
      const measuredColor = await this.simulateColorMeasurement(color);
      
      // Calculate color difference (Delta E)
      const deltaE = this.calculateDeltaE(color, measuredColor);
      
      results.colors[color.name] = {
        target: color,
        measured: measuredColor,
        deltaE: deltaE,
        accurate: deltaE < this.config.colorTolerance.deltaE
      };
      
      totalDeltaE += deltaE;
      results.maxDeltaE = Math.max(results.maxDeltaE, deltaE);
      
      if (deltaE >= this.config.colorTolerance.deltaE) {
        results.passed = false;
      }
    }
    
    results.averageDeltaE = totalDeltaE / primaryColors.length;
    
    return results;
  }
  
  /**
   * Test secondary color accuracy (Cyan, Magenta, Yellow)
   */
  async secondaryColorTest() {
    this.logger.info('Running secondary color accuracy test');
    
    const secondaryColors = this.testPatterns.solidColors.slice(5, 8); // C, M, Y
    const results = {
      passed: true,
      colors: {},
      averageDeltaE: 0,
      maxDeltaE: 0
    };
    
    let totalDeltaE = 0;
    
    for (const color of secondaryColors) {
      await this.setLEDColor(1, color);
      const measuredColor = await this.simulateColorMeasurement(color);
      const deltaE = this.calculateDeltaE(color, measuredColor);
      
      results.colors[color.name] = {
        target: color,
        measured: measuredColor,
        deltaE: deltaE,
        accurate: deltaE < this.config.colorTolerance.deltaE
      };
      
      totalDeltaE += deltaE;
      results.maxDeltaE = Math.max(results.maxDeltaE, deltaE);
      
      if (deltaE >= this.config.colorTolerance.deltaE) {
        results.passed = false;
      }
    }
    
    results.averageDeltaE = totalDeltaE / secondaryColors.length;
    
    return results;
  }
  
  /**
   * Test white balance accuracy
   */
  async whiteBalanceTest() {
    this.logger.info('Running white balance accuracy test');
    
    const whiteColor = { name: 'D65 White', r: 255, g: 255, b: 255 };
    await this.setLEDColor(1, whiteColor);
    
    const measuredColor = await this.simulateColorMeasurement(whiteColor);
    const deltaE = this.calculateDeltaE(whiteColor, measuredColor);
    
    // Check white point accuracy (should be close to D65 standard)
    const whitePointAccurate = deltaE < this.config.colorTolerance.deltaE;
    
    return {
      passed: whitePointAccurate,
      target: whiteColor,
      measured: measuredColor,
      deltaE: deltaE,
      whitePointStandard: 'D65'
    };
  }
  
  /**
   * Test brightness linearity across grayscale
   */
  async grayscaleTest() {
    this.logger.info('Running grayscale linearity test');
    
    const results = {
      passed: true,
      levels: {},
      linearityScore: 0
    };
    
    const measurements = [];
    
    for (const grayLevel of this.testPatterns.grayscale) {
      await this.setLEDColor(1, grayLevel);
      const measuredBrightness = await this.simulateBrightnessMeasurement(grayLevel.r);
      
      results.levels[grayLevel.name] = {
        target: grayLevel.r / 255,
        measured: measuredBrightness,
        deviation: Math.abs((grayLevel.r / 255) - measuredBrightness)
      };
      
      measurements.push({
        target: grayLevel.r / 255,
        measured: measuredBrightness
      });
    }
    
    // Calculate linearity using correlation coefficient
    results.linearityScore = this.calculateLinearityScore(measurements);
    results.passed = results.linearityScore > 0.95; // 95% correlation required
    
    return results;
  }
  
  /**
   * Test color temperature consistency
   */
  async colorTemperatureTest() {
    this.logger.info('Running color temperature consistency test');
    
    const results = {
      passed: true,
      temperatures: {},
      consistency: 0
    };
    
    for (const tempColor of this.testPatterns.temperature) {
      await this.setLEDColor(1, tempColor);
      const measuredColor = await this.simulateColorMeasurement(tempColor);
      const deltaE = this.calculateDeltaE(tempColor, measuredColor);
      
      results.temperatures[tempColor.name] = {
        target: tempColor,
        measured: measuredColor,
        deltaE: deltaE,
        accurate: deltaE < this.config.colorTolerance.deltaE
      };
      
      if (deltaE >= this.config.colorTolerance.deltaE) {
        results.passed = false;
      }
    }
    
    return results;
  }
  
  /**
   * Test LED update latency
   */
  async updateLatencyTest() {
    this.logger.info('Running LED update latency test');
    
    const iterations = 100;
    const latencies = [];
    
    for (let i = 0; i < iterations; i++) {
      const testColor = {
        r: Math.floor(Math.random() * 256),
        g: Math.floor(Math.random() * 256),
        b: Math.floor(Math.random() * 256)
      };
      
      const startTime = performance.now();
      await this.setLEDColor(1, testColor);
      const endTime = performance.now();
      
      latencies.push(endTime - startTime);
    }
    
    const results = {
      passed: true,
      iterations: iterations,
      averageLatency: latencies.reduce((a, b) => a + b) / latencies.length,
      maxLatency: Math.max(...latencies),
      minLatency: Math.min(...latencies),
      p95Latency: this.calculatePercentile(latencies, 95),
      p99Latency: this.calculatePercentile(latencies, 99)
    };
    
    results.passed = results.p95Latency < this.config.performance.maxLatency;
    
    return results;
  }
  
  /**
   * Test animation smoothness and frame rate consistency
   */
  async animationSmoothnessTest() {
    this.logger.info('Running animation smoothness test');
    
    const testDuration = 5000; // 5 seconds
    const targetFrameRate = this.config.performance.targetFrameRate;
    const expectedFrames = Math.floor(testDuration / (1000 / targetFrameRate));
    
    const frameTimes = [];
    const startTime = performance.now();
    let frameCount = 0;
    
    // Simulate rainbow animation
    while (performance.now() - startTime < testDuration) {
      const frameStartTime = performance.now();
      
      const hue = (frameCount * 2) % 360; // 2 degrees per frame
      const color = this.hsvToRgb(hue, 100, 100);
      
      await this.setLEDColor(1, color);
      frameCount++;
      
      const frameEndTime = performance.now();
      frameTimes.push(frameEndTime - frameStartTime);
      
      // Maintain target frame rate
      const targetFrameTime = 1000 / targetFrameRate;
      const actualFrameTime = frameEndTime - frameStartTime;
      const sleepTime = Math.max(0, targetFrameTime - actualFrameTime);
      
      if (sleepTime > 0) {
        await this.sleep(sleepTime);
      }
    }
    
    const actualFrameRate = frameCount / (testDuration / 1000);
    const frameRateDeviation = Math.abs(actualFrameRate - targetFrameRate) / targetFrameRate;
    
    return {
      passed: frameRateDeviation < 0.1, // Within 10% of target
      targetFrameRate: targetFrameRate,
      actualFrameRate: actualFrameRate,
      frameRateDeviation: frameRateDeviation,
      frameCount: frameCount,
      averageFrameTime: frameTimes.reduce((a, b) => a + b) / frameTimes.length,
      maxFrameTime: Math.max(...frameTimes),
      minFrameTime: Math.min(...frameTimes)
    };
  }
  
  /**
   * Test memory usage optimization
   */
  async memoryUsageTest() {
    this.logger.info('Running memory usage test');
    
    const initialMemory = process.memoryUsage();
    
    // Perform memory-intensive operations
    const operations = 1000;
    for (let i = 0; i < operations; i++) {
      const color = { r: i % 256, g: (i * 2) % 256, b: (i * 3) % 256 };
      await this.setLEDColor((i % this.ledController.buttonCount) + 1, color);
    }
    
    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    
    return {
      passed: memoryIncrease < this.config.performance.maxMemoryUsage,
      initialMemory: initialMemory,
      finalMemory: finalMemory,
      memoryIncrease: memoryIncrease,
      operations: operations,
      memoryPerOperation: memoryIncrease / operations
    };
  }
  
  /**
   * Test power consumption (simulated)
   */
  async powerConsumptionTest() {
    this.logger.info('Running power consumption test');
    
    // Simulate different power consumption scenarios
    const scenarios = [
      { name: 'All Off', color: { r: 0, g: 0, b: 0 }, expectedPower: 0 },
      { name: 'Low Brightness', color: { r: 50, g: 50, b: 50 }, expectedPower: 150 },
      { name: 'Medium Brightness', color: { r: 128, g: 128, b: 128 }, expectedPower: 300 },
      { name: 'Full Brightness White', color: { r: 255, g: 255, b: 255 }, expectedPower: 450 }
    ];
    
    const results = {
      passed: true,
      scenarios: {},
      maxPowerDraw: 0
    };
    
    for (const scenario of scenarios) {
      await this.setAllLEDs(scenario.color);
      const powerDraw = await this.simulatePowerMeasurement(scenario.color);
      
      results.scenarios[scenario.name] = {
        color: scenario.color,
        expectedPower: scenario.expectedPower,
        measuredPower: powerDraw,
        withinSpec: powerDraw <= this.config.performance.maxPowerDraw
      };
      
      results.maxPowerDraw = Math.max(results.maxPowerDraw, powerDraw);
      
      if (powerDraw > this.config.performance.maxPowerDraw) {
        results.passed = false;
      }
    }
    
    return results;
  }
  
  /**
   * Test thermal stability under continuous operation
   */
  async thermalStabilityTest() {
    this.logger.info('Running thermal stability test');
    
    const testDuration = 60000; // 1 minute for quick test
    const temperatureMeasurements = [];
    const startTime = performance.now();
    
    // Set LEDs to high brightness white to generate heat
    await this.setAllLEDs({ r: 255, g: 255, b: 255 });
    
    while (performance.now() - startTime < testDuration) {
      const temperature = await this.simulateTemperatureMeasurement();
      temperatureMeasurements.push({
        timestamp: performance.now() - startTime,
        temperature: temperature
      });
      
      await this.sleep(1000); // Measure every second
    }
    
    const maxTemp = Math.max(...temperatureMeasurements.map(m => m.temperature));
    const tempStable = maxTemp < 60; // 60°C threshold
    
    return {
      passed: tempStable,
      duration: testDuration,
      measurements: temperatureMeasurements,
      maxTemperature: maxTemp,
      temperatureThreshold: 60,
      stable: tempStable
    };
  }
  
  /**
   * Test data integrity during serial communication
   */
  async dataIntegrityTest() {
    this.logger.info('Running data integrity test');
    
    const testCommands = 100;
    const errors = [];
    let successfulCommands = 0;
    
    for (let i = 0; i < testCommands; i++) {
      try {
        const color = {
          r: Math.floor(Math.random() * 256),
          g: Math.floor(Math.random() * 256),
          b: Math.floor(Math.random() * 256)
        };
        
        await this.setLEDColor((i % this.ledController.buttonCount) + 1, color);
        successfulCommands++;
      } catch (error) {
        errors.push({
          command: i,
          error: error.message
        });
      }
    }
    
    const errorRate = errors.length / testCommands;
    
    return {
      passed: errorRate < this.config.reliability.errorRateThreshold,
      totalCommands: testCommands,
      successfulCommands: successfulCommands,
      errors: errors.length,
      errorRate: errorRate,
      errorThreshold: this.config.reliability.errorRateThreshold
    };
  }
  
  /**
   * Test failure recovery mechanisms
   */
  async failureRecoveryTest() {
    this.logger.info('Running failure recovery test');
    
    const results = {
      passed: true,
      tests: {}
    };
    
    // Test recovery from invalid color values
    try {
      await this.setLEDColor(1, { r: -1, g: 300, b: 'invalid' });
      results.tests.invalidColors = { passed: false, error: 'Should have thrown error for invalid colors' };
    } catch (error) {
      results.tests.invalidColors = { passed: true, recovered: true };
    }
    
    // Test recovery from invalid button IDs
    try {
      await this.setLEDColor(999, { r: 255, g: 255, b: 255 });
      results.tests.invalidButton = { passed: false, error: 'Should have thrown error for invalid button ID' };
    } catch (error) {
      results.tests.invalidButton = { passed: true, recovered: true };
    }
    
    // Verify system is still functional after errors
    try {
      await this.setLEDColor(1, { r: 255, g: 0, b: 0 });
      results.tests.postErrorFunction = { passed: true, functional: true };
    } catch (error) {
      results.tests.postErrorFunction = { passed: false, error: 'System not functional after errors' };
      results.passed = false;
    }
    
    return results;
  }
  
  /**
   * Helper method to set LED color with error handling
   */
  async setLEDColor(buttonId, color) {
    if (!this.ledController.isEnabled) {
      throw new Error('LED system not enabled');
    }
    
    return await this.ledController.setButtonColor(buttonId, color, false);
  }
  
  /**
   * Helper method to set all LEDs to same color
   */
  async setAllLEDs(color) {
    if (!this.ledController.isEnabled) {
      throw new Error('LED system not enabled');
    }
    
    return await this.ledController.setAllButtons(color, false);
  }
  
  /**
   * Simulate color measurement (placeholder for real colorimeter integration)
   */
  async simulateColorMeasurement(targetColor) {
    // Simulate measurement with small random variations
    const variation = 5; // ±5 RGB values
    
    return {
      r: Math.max(0, Math.min(255, targetColor.r + (Math.random() - 0.5) * variation)),
      g: Math.max(0, Math.min(255, targetColor.g + (Math.random() - 0.5) * variation)),
      b: Math.max(0, Math.min(255, targetColor.b + (Math.random() - 0.5) * variation))
    };
  }
  
  /**
   * Simulate brightness measurement
   */
  async simulateBrightnessMeasurement(targetBrightness) {
    const normalizedTarget = targetBrightness / 255;
    const variation = 0.02; // ±2% variation
    
    return Math.max(0, Math.min(1, normalizedTarget + (Math.random() - 0.5) * variation));
  }
  
  /**
   * Simulate power measurement
   */
  async simulatePowerMeasurement(color) {
    // Simulate power draw based on color intensity
    const intensity = (color.r + color.g + color.b) / (3 * 255);
    const basePower = 50; // Base power draw (mA)
    const maxAdditionalPower = 400; // Additional power at full brightness
    
    return basePower + (intensity * maxAdditionalPower);
  }
  
  /**
   * Simulate temperature measurement
   */
  async simulateTemperatureMeasurement() {
    // Simulate temperature rise over time with some randomness
    const baseTemp = 25; // 25°C ambient
    const timeEffect = Math.min(20, Date.now() / 100000); // Gradual heating
    const randomVariation = (Math.random() - 0.5) * 2; // ±1°C
    
    return baseTemp + timeEffect + randomVariation;
  }
  
  /**
   * Calculate CIE Delta E color difference
   */
  calculateDeltaE(color1, color2) {
    // Simplified Delta E calculation (CIE76)
    // In production, would use more accurate CIE2000 formula
    const lab1 = this.rgbToLab(color1);
    const lab2 = this.rgbToLab(color2);
    
    const deltaL = lab1.L - lab2.L;
    const deltaA = lab1.a - lab2.a;
    const deltaB = lab1.b - lab2.b;
    
    return Math.sqrt(deltaL * deltaL + deltaA * deltaA + deltaB * deltaB);
  }
  
  /**
   * Convert RGB to LAB color space (simplified)
   */
  rgbToLab(rgb) {
    // Simplified RGB to LAB conversion
    // In production, would use proper XYZ intermediate conversion
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;
    
    const L = 0.299 * r + 0.587 * g + 0.114 * b;
    const a = (r - g) * 127.5;
    const b_val = (g - b) * 127.5;
    
    return { L: L * 100, a: a, b: b_val };
  }
  
  /**
   * Convert HSV to RGB
   */
  hsvToRgb(h, s, v) {
    s /= 100;
    v /= 100;
    
    const c = v * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = v - c;
    
    let r, g, b;
    
    if (h >= 0 && h < 60) {
      r = c; g = x; b = 0;
    } else if (h >= 60 && h < 120) {
      r = x; g = c; b = 0;
    } else if (h >= 120 && h < 180) {
      r = 0; g = c; b = x;
    } else if (h >= 180 && h < 240) {
      r = 0; g = x; b = c;
    } else if (h >= 240 && h < 300) {
      r = x; g = 0; b = c;
    } else {
      r = c; g = 0; b = x;
    }
    
    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255)
    };
  }
  
  /**
   * Calculate linearity score using correlation coefficient
   */
  calculateLinearityScore(measurements) {
    const n = measurements.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, sumYY = 0;
    
    for (const point of measurements) {
      sumX += point.target;
      sumY += point.measured;
      sumXY += point.target * point.measured;
      sumXX += point.target * point.target;
      sumYY += point.measured * point.measured;
    }
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
  }
  
  /**
   * Calculate percentile from array of values
   */
  calculatePercentile(values, percentile) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sorted[lower];
    }
    
    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }
  
  /**
   * Calculate overall test suite score
   */
  calculateOverallScore(results) {
    let totalTests = 0;
    let passedTests = 0;
    
    // Count color accuracy tests
    for (const [testName, result] of Object.entries(results.colorAccuracy)) {
      if (result.passed !== undefined) {
        totalTests++;
        if (result.passed) passedTests++;
      }
    }
    
    // Count performance tests
    for (const [testName, result] of Object.entries(results.performance)) {
      if (result.passed !== undefined) {
        totalTests++;
        if (result.passed) passedTests++;
      }
    }
    
    // Count reliability tests
    for (const [testName, result] of Object.entries(results.reliability)) {
      if (result.passed !== undefined) {
        totalTests++;
        if (result.passed) passedTests++;
      }
    }
    
    const score = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;
    
    return {
      passed: score >= 90, // 90% pass rate required
      score: score,
      totalTests: totalTests,
      passedTests: passedTests,
      failedTests: totalTests - passedTests
    };
  }
  
  /**
   * Generate detailed test report
   */
  generateTestReport(results) {
    const report = {
      timestamp: new Date().toISOString(),
      duration: results.duration,
      overall: results.overall,
      categories: {
        colorAccuracy: this.summarizeCategory(results.colorAccuracy),
        performance: this.summarizeCategory(results.performance),
        reliability: this.summarizeCategory(results.reliability)
      },
      recommendations: this.generateRecommendations(results)
    };
    
    return report;
  }
  
  /**
   * Summarize test category results
   */
  summarizeCategory(categoryResults) {
    const summary = {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      tests: {}
    };
    
    for (const [testName, result] of Object.entries(categoryResults)) {
      if (result.passed !== undefined) {
        summary.totalTests++;
        if (result.passed) {
          summary.passedTests++;
        } else {
          summary.failedTests++;
        }
        
        summary.tests[testName] = {
          passed: result.passed,
          score: result.score || null,
          error: result.error || null
        };
      }
    }
    
    summary.passRate = summary.totalTests > 0 ? 
      Math.round((summary.passedTests / summary.totalTests) * 100) : 0;
    
    return summary;
  }
  
  /**
   * Generate recommendations based on test results
   */
  generateRecommendations(results) {
    const recommendations = [];
    
    // Color accuracy recommendations
    if (results.colorAccuracy.primaryColorTest && !results.colorAccuracy.primaryColorTest.passed) {
      recommendations.push({
        category: 'Color Accuracy',
        issue: 'Primary color accuracy below threshold',
        recommendation: 'Check LED hardware and consider gamma correction calibration'
      });
    }
    
    if (results.colorAccuracy.whiteBalanceTest && !results.colorAccuracy.whiteBalanceTest.passed) {
      recommendations.push({
        category: 'Color Accuracy',
        issue: 'White balance inaccurate',
        recommendation: 'Adjust white balance multipliers in calibration system'
      });
    }
    
    // Performance recommendations
    if (results.performance.updateLatencyTest && !results.performance.updateLatencyTest.passed) {
      recommendations.push({
        category: 'Performance',
        issue: 'LED update latency too high',
        recommendation: 'Optimize serial communication or reduce LED count'
      });
    }
    
    if (results.performance.powerConsumptionTest && !results.performance.powerConsumptionTest.passed) {
      recommendations.push({
        category: 'Performance',
        issue: 'Power consumption exceeds limits',
        recommendation: 'Reduce maximum brightness or implement power limiting'
      });
    }
    
    // Reliability recommendations
    if (results.reliability.dataIntegrityTest && !results.reliability.dataIntegrityTest.passed) {
      recommendations.push({
        category: 'Reliability',
        issue: 'High communication error rate',
        recommendation: 'Check serial cable connections and reduce communication speed'
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
   * Get current testing status
   */
  getTestingStatus() {
    return {
      isActive: this.isTestingActive,
      lastResults: this.testResults.has('full-suite') ? this.testResults.get('full-suite') : null,
      availableTests: {
        colorAccuracy: this.testingCategories.colorAccuracy,
        performance: this.testingCategories.performance,
        reliability: this.testingCategories.reliability
      }
    };
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    this.isTestingActive = false;
    this.testResults.clear();
    this.removeAllListeners();
    this.logger.info('LEDHardwareTester destroyed');
  }
}

module.exports = LEDHardwareTester;