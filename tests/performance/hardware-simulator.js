/**
 * Hardware Simulator for Performance Testing
 * 
 * Provides realistic hardware event simulation for load testing
 * without requiring physical macro keyboard hardware.
 */

const EventEmitter = require('events');

class HardwareSimulator extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      buttonCount: config.buttonCount || 16,
      encoderCount: config.encoderCount || 4,
      scanRate: config.scanRate || 1000, // Hz
      simulationEnabled: true,
      ...config
    };
    
    this.isRunning = false;
    this.scanInterval = null;
    this.buttonStates = new Array(this.config.buttonCount).fill(false);
    this.encoderStates = new Array(this.config.encoderCount).fill(0);
    
    // Performance tracking
    this.eventCount = 0;
    this.startTime = null;
    this.lastEventTime = null;
  }

  /**
   * Start hardware simulation
   */
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.startTime = Date.now();
    this.eventCount = 0;
    
    // Start button matrix scanning simulation
    this.scanInterval = setInterval(() => {
      this.simulateMatrixScan();
    }, 1000 / this.config.scanRate);
    
    this.emit('simulation-started');
  }

  /**
   * Stop hardware simulation
   */
  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    
    this.emit('simulation-stopped');
  }

  /**
   * Simulate button matrix scanning
   */
  simulateMatrixScan() {
    // Simulate hardware scan timing
    const scanStart = process.hrtime.bigint();
    
    // Check for state changes (simulated button presses)
    for (let i = 0; i < this.config.buttonCount; i++) {
      // Simulation logic would check for planned button events
      // For load testing, we'll generate events based on test patterns
    }
    
    const scanDuration = Number(process.hrtime.bigint() - scanStart) / 1000000;
    
    this.emit('scan-complete', {
      duration: scanDuration,
      timestamp: Date.now()
    });
  }

  /**
   * Simulate button press event
   */
  simulateButtonPress(buttonId, duration = 100) {
    if (!this.isRunning || buttonId >= this.config.buttonCount) {
      return null;
    }

    const event = {
      type: 'BTN',
      id: buttonId,
      state: 'PRESSED',
      timestamp: Date.now(),
      duration: duration
    };

    this.buttonStates[buttonId] = true;
    this.eventCount++;
    this.lastEventTime = Date.now();

    // Emit button press event
    this.emit('button-event', event);
    
    // Schedule button release
    setTimeout(() => {
      this.simulateButtonRelease(buttonId);
    }, duration);

    return event;
  }

  /**
   * Simulate button release event
   */
  simulateButtonRelease(buttonId) {
    if (!this.isRunning || buttonId >= this.config.buttonCount) {
      return null;
    }

    const event = {
      type: 'BTN',
      id: buttonId,
      state: 'RELEASED',
      timestamp: Date.now()
    };

    this.buttonStates[buttonId] = false;
    this.eventCount++;

    this.emit('button-event', event);
    return event;
  }

  /**
   * Simulate encoder rotation event
   */
  simulateEncoderRotation(encoderId, direction = 'CW', steps = 1) {
    if (!this.isRunning || encoderId >= this.config.encoderCount) {
      return null;
    }

    const event = {
      type: 'ENC',
      id: encoderId,
      direction: direction,
      steps: steps,
      timestamp: Date.now()
    };

    this.encoderStates[encoderId] += direction === 'CW' ? steps : -steps;
    this.eventCount++;
    this.lastEventTime = Date.now();

    this.emit('encoder-event', event);
    return event;
  }

  /**
   * Generate load pattern events
   */
  generateLoadPattern(pattern = 'normal', duration = 60000) {
    const events = [];
    let currentTime = 0;

    const patterns = {
      normal: { buttonRate: 0.1, encoderRate: 0.05 }, // events per ms
      peak: { buttonRate: 0.5, encoderRate: 0.25 },
      stress: { buttonRate: 2.0, encoderRate: 1.0 }
    };

    const config = patterns[pattern] || patterns.normal;

    while (currentTime < duration) {
      // Generate button events
      if (Math.random() < config.buttonRate) {
        const buttonId = Math.floor(Math.random() * this.config.buttonCount);
        events.push({
          time: currentTime,
          type: 'button',
          buttonId: buttonId,
          duration: 50 + Math.random() * 100
        });
      }

      // Generate encoder events
      if (Math.random() < config.encoderRate) {
        const encoderId = Math.floor(Math.random() * this.config.encoderCount);
        const direction = Math.random() > 0.5 ? 'CW' : 'CCW';
        events.push({
          time: currentTime,
          type: 'encoder',
          encoderId: encoderId,
          direction: direction,
          steps: 1 + Math.floor(Math.random() * 3)
        });
      }

      currentTime += 10; // 10ms increments
    }

    return events;
  }

  /**
   * Execute planned event sequence
   */
  async executeEventSequence(events) {
    const startTime = Date.now();
    const results = {
      totalEvents: events.length,
      executedEvents: 0,
      failedEvents: 0,
      averageLatency: 0,
      maxLatency: 0
    };

    const latencies = [];

    for (const event of events) {
      const targetTime = startTime + event.time;
      const currentTime = Date.now();
      
      // Wait until target time
      if (targetTime > currentTime) {
        await this.sleep(targetTime - currentTime);
      }

      const executeStart = Date.now();
      let success = false;

      try {
        if (event.type === 'button') {
          this.simulateButtonPress(event.buttonId, event.duration);
          success = true;
        } else if (event.type === 'encoder') {
          this.simulateEncoderRotation(event.encoderId, event.direction, event.steps);
          success = true;
        }

        const executeEnd = Date.now();
        const latency = executeEnd - executeStart;
        latencies.push(latency);

        if (latency > results.maxLatency) {
          results.maxLatency = latency;
        }

      } catch (error) {
        console.error('Event execution failed:', error);
      }

      if (success) {
        results.executedEvents++;
      } else {
        results.failedEvents++;
      }
    }

    // Calculate average latency
    if (latencies.length > 0) {
      results.averageLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    }

    return results;
  }

  /**
   * Get simulation statistics
   */
  getStatistics() {
    const uptime = this.isRunning ? Date.now() - this.startTime : 0;
    const eventsPerSecond = uptime > 0 ? (this.eventCount * 1000) / uptime : 0;

    return {
      isRunning: this.isRunning,
      uptime: uptime,
      eventCount: this.eventCount,
      eventsPerSecond: eventsPerSecond,
      buttonStates: [...this.buttonStates],
      encoderStates: [...this.encoderStates],
      lastEventTime: this.lastEventTime,
      configuration: {
        buttonCount: this.config.buttonCount,
        encoderCount: this.config.encoderCount,
        scanRate: this.config.scanRate
      }
    };
  }

  /**
   * Sleep utility function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Reset simulation state
   */
  reset() {
    this.stop();
    this.buttonStates.fill(false);
    this.encoderStates.fill(0);
    this.eventCount = 0;
    this.startTime = null;
    this.lastEventTime = null;
  }
}

module.exports = HardwareSimulator;