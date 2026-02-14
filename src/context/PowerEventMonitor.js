/**
 * Power Event Monitor - Cross-platform power management event detection
 *
 * Monitors:
 * - Battery level changes and status
 * - AC power connection/disconnection
 * - System suspend/resume events
 * - Power saving mode transitions
 * - Critical battery warnings
 */

const EventEmitter = require('events');
const { exec, spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class PowerEventMonitor extends EventEmitter {
  constructor(config = {}) {
    super();

    this.logger = config.logger || {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {}
    };

    this.platform = config.platform || process.platform;
    this.config = {
      batteryCheckInterval: config.batteryCheckInterval || 10000, // 10 seconds
      lowBatteryThreshold: config.lowBatteryThreshold || 20,
      criticalBatteryThreshold: config.criticalBatteryThreshold || 10,
      enableSuspendDetection: config.enableSuspendDetection !== false,
      enableACPowerDetection: config.enableACPowerDetection !== false,
      ...config
    };

    // Current power state
    this.currentState = {
      batteryLevel: null,
      batteryStatus: 'unknown', // charging, discharging, full, unknown
      acPowerConnected: null,
      powerSource: 'unknown',
      isLowBattery: false,
      isCriticalBattery: false,
      lastUpdate: null
    };

    // Monitoring state
    this.monitoring = false;
    this.batteryTimer = null;
    this.platformHandlers = null;
    this.suspendProcess = null;

    // Statistics
    this.statistics = {
      batteryChecks: 0,
      powerEvents: 0,
      suspendEvents: 0,
      resumeEvents: 0,
      acPowerChanges: 0,
      lowBatteryWarnings: 0,
      criticalBatteryWarnings: 0
    };

    this.logger.debug('PowerEventMonitor initialized', { platform: this.platform });
  }

  /**
   * Start power event monitoring
   */
  async start() {
    if (this.monitoring) {
      throw new Error('Power monitoring already started');
    }

    this.monitoring = true;

    try {
      // Initialize platform-specific monitoring
      await this.initializePlatformMonitoring();

      // Start battery monitoring
      if (this.config.enableBatteryMonitoring !== false) {
        await this.startBatteryMonitoring();
      }

      // Start suspend/resume detection
      if (this.config.enableSuspendDetection) {
        await this.startSuspendDetection();
      }

      this.logger.info('Power event monitoring started');
    } catch (error) {
      this.monitoring = false;
      this.logger.error('Failed to start power monitoring:', error);
      throw error;
    }
  }

  /**
   * Stop power event monitoring
   */
  async stop() {
    if (!this.monitoring) {
      return;
    }

    this.monitoring = false;

    // Clear battery monitoring timer
    if (this.batteryTimer) {
      clearInterval(this.batteryTimer);
      this.batteryTimer = null;
    }

    // Clean up platform-specific handlers
    if (this.platformHandlers && typeof this.platformHandlers.cleanup === 'function') {
      await this.platformHandlers.cleanup();
    }

    // Stop suspend detection process
    if (this.suspendProcess) {
      this.suspendProcess.kill();
      this.suspendProcess = null;
    }

    this.logger.info('Power event monitoring stopped');
  }

  /**
   * Initialize platform-specific monitoring
   */
  async initializePlatformMonitoring() {
    switch (this.platform) {
    case 'win32':
      this.platformHandlers = await this.initializeWindowsPowerMonitoring();
      break;
    case 'darwin':
      this.platformHandlers = await this.initializeMacOSPowerMonitoring();
      break;
    case 'linux':
      this.platformHandlers = await this.initializeLinuxPowerMonitoring();
      break;
    default:
      this.logger.warn(`Power monitoring not fully supported on platform: ${this.platform}`);
    }
  }

  /**
   * Initialize Windows power monitoring
   */
  async initializeWindowsPowerMonitoring() {
    return new Promise((resolve) => {
      // Windows power monitoring would use Win32 APIs
      // For now, implementing basic polling approach
      resolve({
        getBatteryInfo: this.getWindowsBatteryInfo.bind(this),
        cleanup: async() => {}
      });
    });
  }

  /**
   * Initialize macOS power monitoring
   */
  async initializeMacOSPowerMonitoring() {
    return new Promise((resolve) => {
      resolve({
        getBatteryInfo: this.getMacOSBatteryInfo.bind(this),
        cleanup: async() => {}
      });
    });
  }

  /**
   * Initialize Linux power monitoring
   */
  async initializeLinuxPowerMonitoring() {
    return new Promise((resolve) => {
      resolve({
        getBatteryInfo: this.getLinuxBatteryInfo.bind(this),
        cleanup: async() => {}
      });
    });
  }

  /**
   * Start battery monitoring
   */
  async startBatteryMonitoring() {
    // Get initial battery state
    await this.updateBatteryState();

    // Set up periodic battery checks
    this.batteryTimer = setInterval(async() => {
      try {
        await this.updateBatteryState();
      } catch (error) {
        this.logger.error('Error updating battery state:', error);
      }
    }, this.config.batteryCheckInterval);
  }

  /**
   * Start suspend/resume detection
   */
  async startSuspendDetection() {
    switch (this.platform) {
    case 'win32':
      await this.startWindowsSuspendDetection();
      break;
    case 'darwin':
      await this.startMacOSSuspendDetection();
      break;
    case 'linux':
      await this.startLinuxSuspendDetection();
      break;
    }
  }

  /**
   * Start Windows suspend detection
   */
  async startWindowsSuspendDetection() {
    // Windows suspend detection would use WM_POWERBROADCAST messages
    // For now, using event log monitoring as fallback
    this.logger.debug('Windows suspend detection initialized (polling mode)');
  }

  /**
   * Start macOS suspend detection
   */
  async startMacOSSuspendDetection() {
    try {
      // Monitor system power events using pmset
      this.suspendProcess = spawn('pmset', ['-g', 'log'], { stdio: 'pipe' });

      this.suspendProcess.stdout.on('data', (data) => {
        const logLine = data.toString();
        this.parseMacOSPowerLog(logLine);
      });

      this.suspendProcess.on('error', (error) => {
        this.logger.error('macOS suspend detection error:', error);
      });

      this.logger.debug('macOS suspend detection initialized');
    } catch (error) {
      this.logger.error('Failed to start macOS suspend detection:', error);
    }
  }

  /**
   * Start Linux suspend detection
   */
  async startLinuxSuspendDetection() {
    try {
      // Monitor systemd journal for suspend/resume events
      this.suspendProcess = spawn('journalctl', ['-f', '-u', 'systemd-suspend.service', '-u', 'systemd-resume.service'], { stdio: 'pipe' });

      this.suspendProcess.stdout.on('data', (data) => {
        const logLine = data.toString();
        this.parseLinuxSuspendLog(logLine);
      });

      this.suspendProcess.on('error', (error) => {
        this.logger.error('Linux suspend detection error:', error);
      });

      this.logger.debug('Linux suspend detection initialized');
    } catch (error) {
      this.logger.error('Failed to start Linux suspend detection:', error);
    }
  }

  /**
   * Update battery state
   */
  async updateBatteryState() {
    if (!this.platformHandlers) {
      return;
    }

    try {
      const batteryInfo = await this.platformHandlers.getBatteryInfo();
      const previousState = { ...this.currentState };

      // Update current state
      this.currentState = {
        ...batteryInfo,
        lastUpdate: Date.now()
      };

      // Check for state changes and emit events
      this.checkBatteryStateChanges(previousState, this.currentState);

      this.statistics.batteryChecks++;
    } catch (error) {
      this.logger.error('Failed to update battery state:', error);
    }
  }

  /**
   * Check for battery state changes and emit appropriate events
   */
  checkBatteryStateChanges(previousState, currentState) {
    // Battery level changed
    if (previousState.batteryLevel !== null && previousState.batteryLevel !== currentState.batteryLevel) {
      this.emit('event', {
        type: 'battery-level-changed',
        data: {
          previousLevel: previousState.batteryLevel,
          currentLevel: currentState.batteryLevel,
          change: currentState.batteryLevel - previousState.batteryLevel
        }
      });
      this.statistics.powerEvents++;
    }

    // Battery status changed (charging/discharging)
    if (previousState.batteryStatus !== currentState.batteryStatus) {
      this.emit('event', {
        type: 'battery-status-changed',
        data: {
          previousStatus: previousState.batteryStatus,
          currentStatus: currentState.batteryStatus,
          batteryLevel: currentState.batteryLevel
        }
      });
      this.statistics.powerEvents++;
    }

    // AC power changed
    if (previousState.acPowerConnected !== null && previousState.acPowerConnected !== currentState.acPowerConnected) {
      this.emit('event', {
        type: currentState.acPowerConnected ? 'ac-power-connected' : 'ac-power-disconnected',
        data: {
          acPowerConnected: currentState.acPowerConnected,
          batteryLevel: currentState.batteryLevel,
          batteryStatus: currentState.batteryStatus
        }
      });
      this.statistics.acPowerChanges++;
    }

    // Low battery warning
    if (!previousState.isLowBattery && currentState.isLowBattery) {
      this.emit('event', {
        type: 'battery-low',
        data: {
          batteryLevel: currentState.batteryLevel,
          threshold: this.config.lowBatteryThreshold,
          acPowerConnected: currentState.acPowerConnected
        }
      });
      this.statistics.lowBatteryWarnings++;
    }

    // Critical battery warning
    if (!previousState.isCriticalBattery && currentState.isCriticalBattery) {
      this.emit('event', {
        type: 'battery-critical',
        data: {
          batteryLevel: currentState.batteryLevel,
          threshold: this.config.criticalBatteryThreshold,
          acPowerConnected: currentState.acPowerConnected
        }
      });
      this.statistics.criticalBatteryWarnings++;
    }

    // Battery warnings cleared
    if (previousState.isLowBattery && !currentState.isLowBattery) {
      this.emit('event', {
        type: 'battery-level-normal',
        data: {
          batteryLevel: currentState.batteryLevel,
          previouslyLow: true
        }
      });
    }
  }

  /**
   * Get Windows battery information
   */
  async getWindowsBatteryInfo() {
    return new Promise((resolve, reject) => {
      const command = 'powershell -Command "Get-WmiObject -Class Win32_Battery | Select-Object EstimatedChargeRemaining, BatteryStatus, PowerManagementCapabilities | ConvertTo-Json"';

      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }

        try {
          const batteryData = JSON.parse(stdout.trim() || '{}');
          const level = batteryData.EstimatedChargeRemaining || 0;
          const status = this.parseWindowsBatteryStatus(batteryData.BatteryStatus);

          resolve({
            batteryLevel: level,
            batteryStatus: status,
            acPowerConnected: status === 'charging',
            powerSource: status === 'charging' ? 'AC Power' : 'Battery',
            isLowBattery: level <= this.config.lowBatteryThreshold,
            isCriticalBattery: level <= this.config.criticalBatteryThreshold
          });
        } catch (parseError) {
          reject(parseError);
        }
      });
    });
  }

  /**
   * Get macOS battery information
   */
  async getMacOSBatteryInfo() {
    return new Promise((resolve, reject) => {
      exec('pmset -g batt', (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }

        try {
          const output = stdout.trim();
          const batteryMatch = output.match(/(\d+)%/);
          const sourceMatch = output.match(/'([^']+)'/);
          const statusMatch = output.match(/;\s*(\w+)/);

          if (batteryMatch && sourceMatch) {
            const level = parseInt(batteryMatch[1], 10);
            const source = sourceMatch[1];
            const status = statusMatch ? statusMatch[1].toLowerCase() : 'unknown';

            const acConnected = source.toLowerCase().includes('power') || status === 'charging';

            resolve({
              batteryLevel: level,
              batteryStatus: this.normalizeBatteryStatus(status),
              acPowerConnected: acConnected,
              powerSource: source,
              isLowBattery: level <= this.config.lowBatteryThreshold,
              isCriticalBattery: level <= this.config.criticalBatteryThreshold
            });
          } else {
            throw new Error('Failed to parse battery information');
          }
        } catch (parseError) {
          reject(parseError);
        }
      });
    });
  }

  /**
   * Get Linux battery information
   */
  async getLinuxBatteryInfo() {
    try {
      // Try UPower first
      const upowerInfo = await this.getLinuxUPowerInfo();
      if (upowerInfo) {
        return upowerInfo;
      }

      // Fallback to /sys/class/power_supply
      return await this.getLinuxSysClassInfo();
    } catch (error) {
      this.logger.debug('Failed to get Linux battery info:', error);
      throw error;
    }
  }

  /**
   * Get Linux battery info using UPower
   */
  async getLinuxUPowerInfo() {
    return new Promise((resolve, reject) => {
      exec('upower -i $(upower -e | grep "BAT")', (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }

        try {
          const output = stdout.trim();
          const levelMatch = output.match(/percentage:\s*(\d+)%/);
          const stateMatch = output.match(/state:\s*(\w+)/);

          if (levelMatch) {
            const level = parseInt(levelMatch[1], 10);
            const state = stateMatch ? stateMatch[1].toLowerCase() : 'unknown';
            const acConnected = state === 'charging' || state === 'fully-charged';

            resolve({
              batteryLevel: level,
              batteryStatus: this.normalizeBatteryStatus(state),
              acPowerConnected: acConnected,
              powerSource: acConnected ? 'AC Power' : 'Battery',
              isLowBattery: level <= this.config.lowBatteryThreshold,
              isCriticalBattery: level <= this.config.criticalBatteryThreshold
            });
          } else {
            throw new Error('Failed to parse UPower output');
          }
        } catch (parseError) {
          reject(parseError);
        }
      });
    });
  }

  /**
   * Get Linux battery info from /sys/class/power_supply
   */
  async getLinuxSysClassInfo() {
    try {
      const batteryPath = '/sys/class/power_supply/BAT0';

      const capacityData = await fs.readFile(path.join(batteryPath, 'capacity'), 'utf8');
      const statusData = await fs.readFile(path.join(batteryPath, 'status'), 'utf8');

      const level = parseInt(capacityData.trim(, 10));
      const status = statusData.trim().toLowerCase();
      const acConnected = status === 'charging' || status === 'full';

      return {
        batteryLevel: level,
        batteryStatus: this.normalizeBatteryStatus(status),
        acPowerConnected: acConnected,
        powerSource: acConnected ? 'AC Power' : 'Battery',
        isLowBattery: level <= this.config.lowBatteryThreshold,
        isCriticalBattery: level <= this.config.criticalBatteryThreshold
      };
    } catch (error) {
      throw new Error(`Failed to read battery info from sysfs: ${error.message}`);
    }
  }

  /**
   * Parse Windows battery status
   */
  parseWindowsBatteryStatus(statusCode) {
    switch (statusCode) {
    case 1: return 'discharging';
    case 2: return 'charging';
    case 3: return 'critical';
    case 4: return 'charging';
    case 5: return 'critical';
    case 6: return 'charging';
    case 7: return 'charging';
    case 8: return 'charging';
    case 9: return 'charging';
    case 10: return 'partial';
    case 11: return 'full';
    default: return 'unknown';
    }
  }

  /**
   * Normalize battery status across platforms
   */
  normalizeBatteryStatus(status) {
    const normalized = status.toLowerCase();

    if (normalized.includes('charg')) {
      return 'charging';
    }
    if (normalized.includes('discharg')) {
      return 'discharging';
    }
    if (normalized.includes('full') || normalized.includes('complete')) {
      return 'full';
    }
    if (normalized.includes('critical')) {
      return 'critical';
    }
    if (normalized.includes('low')) {
      return 'low';
    }

    return normalized;
  }

  /**
   * Parse macOS power log for suspend/resume events
   */
  parseMacOSPowerLog(logLine) {
    if (logLine.includes('Sleep') || logLine.includes('Entering Sleep state')) {
      this.emit('event', {
        type: 'suspend',
        data: {
          timestamp: Date.now(),
          logLine: logLine.trim()
        }
      });
      this.statistics.suspendEvents++;
    } else if (logLine.includes('Wake') || logLine.includes('Exiting Sleep state')) {
      this.emit('event', {
        type: 'resume',
        data: {
          timestamp: Date.now(),
          logLine: logLine.trim()
        }
      });
      this.statistics.resumeEvents++;
    }
  }

  /**
   * Parse Linux suspend log for suspend/resume events
   */
  parseLinuxSuspendLog(logLine) {
    if (logLine.includes('suspend.service') && logLine.includes('Started')) {
      this.emit('event', {
        type: 'suspend',
        data: {
          timestamp: Date.now(),
          logLine: logLine.trim()
        }
      });
      this.statistics.suspendEvents++;
    } else if (logLine.includes('resume.service') && logLine.includes('Started')) {
      this.emit('event', {
        type: 'resume',
        data: {
          timestamp: Date.now(),
          logLine: logLine.trim()
        }
      });
      this.statistics.resumeEvents++;
    }
  }

  /**
   * Get current power state
   */
  getCurrentState() {
    return { ...this.currentState };
  }

  /**
   * Get power monitoring statistics
   */
  getStatistics() {
    return { ...this.statistics };
  }

  /**
   * Check if monitoring is active
   */
  isMonitoring() {
    return this.monitoring;
  }
}

module.exports = PowerEventMonitor;
