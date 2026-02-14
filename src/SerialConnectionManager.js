/**
 * Serial Connection Manager with Automatic Reconnection
 *
 * Handles serial port connections with automatic reconnection, exponential backoff,
 * device detection, and graceful degradation when hardware is unavailable.
 */

const EventEmitter = require('events');
const { ErrorHandler, ErrorTypes } = require('./ErrorHandler');

/**
 * Connection States
 */
const ConnectionState = {
  DISCONNECTED: 'DISCONNECTED',
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  RECONNECTING: 'RECONNECTING',
  FAILED: 'FAILED'
};

/**
 * Serial Connection Manager
 */
class SerialConnectionManager extends EventEmitter {
  constructor(config, logger, errorHandler = null) {
    super();
    this.config = config;
    this.logger = logger;
    this.errorHandler = errorHandler || new ErrorHandler(logger);

    // Connection state
    this.state = ConnectionState.DISCONNECTED;
    this.serialPort = null;
    this.parser = null;

    // Reconnection parameters
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.baseReconnectDelay = 1000; // 1 second
    this.maxReconnectDelay = 30000; // 30 seconds
    this.reconnectMultiplier = 1.5;
    this.reconnectTimer = null;

    // Device detection
    this.lastKnownDevices = [];
    this.deviceScanInterval = 5000; // 5 seconds
    this.deviceScanTimer = null;

    // Health monitoring
    this.lastActivityTime = Date.now();
    this.healthCheckInterval = 10000; // 10 seconds
    this.healthCheckTimer = null;
    this.connectionTimeout = 5000; // 5 seconds

    // Graceful degradation
    this.isOfflineMode = false;
    this.pendingCommands = [];
    this.maxPendingCommands = 100;

    // Bind methods
    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.reconnect = this.reconnect.bind(this);
    this.handleConnectionError = this.handleConnectionError.bind(this);
    this.handleConnectionClose = this.handleConnectionClose.bind(this);
  }

  /**
   * Initialize the connection manager
   */
  async initialize() {
    this.logger.info('Initializing Serial Connection Manager...');

    // Set up error handler listeners
    this.setupErrorHandlerListeners();

    // Start device scanning
    this.startDeviceScanning();

    // Start health monitoring
    this.startHealthMonitoring();

    // Initial connection attempt
    if (this.config.device.serialPort) {
      await this.connect();
    } else {
      this.logger.info('No serial port configured, waiting for device detection...');
      this.setState(ConnectionState.DISCONNECTED);
    }
  }

  /**
   * Set up error handler event listeners
   */
  setupErrorHandlerListeners() {
    this.errorHandler.on('serialRecovery', async context => {
      this.logger.info('Error handler requested serial recovery');
      await this.reconnect();
    });
  }

  /**
   * Connect to serial port
   */
  async connect(port = null) {
    const targetPort = port || this.config.device.serialPort;

    if (!targetPort) {
      const error = this.errorHandler.createError(
        ErrorTypes.HARDWARE.DEVICE_NOT_FOUND,
        'No serial port specified for connection',
        null,
        { requestedPort: port }
      );
      await this.errorHandler.handleError(error, 'SerialConnection');
      return false;
    }

    if (this.state === ConnectionState.CONNECTING || this.state === ConnectionState.CONNECTED) {
      this.logger.warn(`Already connecting/connected to ${targetPort}`);
      return this.state === ConnectionState.CONNECTED;
    }

    this.setState(ConnectionState.CONNECTING);
    this.logger.info(`Attempting to connect to ${targetPort}...`);

    try {
      const { SerialPort } = require('serialport');
      const { ReadlineParser } = require('@serialport/parser-readline');

      // Create serial port with timeout
      this.serialPort = new SerialPort({
        path: targetPort,
        baudRate: this.config.device.baudRate,
        autoOpen: false
      });

      // Set up connection timeout
      const connectionPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Connection timeout after ${this.connectionTimeout}ms`));
        }, this.connectionTimeout);

        this.serialPort.open(error => {
          clearTimeout(timeout);
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      await connectionPromise;

      // Set up parser
      this.parser = this.serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));

      // Set up event handlers
      this.setupSerialPortHandlers();

      // Connection successful
      this.setState(ConnectionState.CONNECTED);
      this.reconnectAttempts = 0;
      this.isOfflineMode = false;
      this.lastActivityTime = Date.now();

      this.logger.info(`Successfully connected to ${targetPort}`);
      this.emit('connected', targetPort);

      // Process any pending commands
      await this.processPendingCommands();

      return true;
    } catch (error) {
      const macroError = this.errorHandler.createError(
        ErrorTypes.HARDWARE.SERIAL_CONNECTION_FAILED,
        `Failed to connect to ${targetPort}: ${error.message}`,
        error,
        { port: targetPort, baudRate: this.config.device.baudRate }
      );

      await this.errorHandler.handleError(macroError, 'SerialConnection');

      this.setState(ConnectionState.FAILED);
      this.scheduleReconnect();

      return false;
    }
  }

  /**
   * Set up serial port event handlers
   */
  setupSerialPortHandlers() {
    this.serialPort.on('data', data => {
      this.lastActivityTime = Date.now();
      this.emit('data', data);
    });

    this.parser.on('data', data => {
      this.lastActivityTime = Date.now();
      this.emit('message', data);
    });

    this.serialPort.on('error', this.handleConnectionError);
    this.serialPort.on('close', this.handleConnectionClose);

    this.serialPort.on('drain', () => {
      this.logger.debug('Serial port write buffer drained');
    });
  }

  /**
   * Handle connection errors
   */
  async handleConnectionError(error) {
    this.logger.error('Serial port error:', error);

    const macroError = this.errorHandler.createError(
      ErrorTypes.HARDWARE.ARDUINO_COMMUNICATION_ERROR,
      `Serial communication error: ${error.message}`,
      error,
      { port: this.config.device.serialPort }
    );

    await this.errorHandler.handleError(macroError, 'SerialConnection');

    // Don't immediately reconnect on error - wait for close event
  }

  /**
   * Handle connection close
   */
  async handleConnectionClose() {
    this.logger.warn('Serial port connection closed');

    if (this.state === ConnectionState.CONNECTED) {
      const macroError = this.errorHandler.createError(
        ErrorTypes.HARDWARE.DEVICE_DISCONNECTED,
        'Macro keyboard was disconnected',
        null,
        { port: this.config.device.serialPort }
      );

      await this.errorHandler.handleError(macroError, 'SerialConnection');
    }

    this.setState(ConnectionState.DISCONNECTED);
    this.emit('disconnected');

    // Clean up
    this.serialPort = null;
    this.parser = null;

    // Enable offline mode
    this.enableOfflineMode();

    // Schedule reconnection
    this.scheduleReconnect();
  }

  /**
   * Disconnect from serial port
   */
  async disconnect() {
    if (this.serialPort && this.serialPort.isOpen) {
      this.logger.info('Disconnecting from serial port...');

      return new Promise(resolve => {
        this.serialPort.close(() => {
          this.logger.info('Serial port disconnected');
          resolve();
        });
      });
    }
  }

  /**
   * Schedule automatic reconnection with exponential backoff
   */
  scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error(`Max reconnection attempts reached (${this.maxReconnectAttempts})`);
      this.setState(ConnectionState.FAILED);
      this.emit('reconnectFailed');
      return;
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(this.reconnectMultiplier, this.reconnectAttempts),
      this.maxReconnectDelay
    );

    this.reconnectAttempts++;
    this.logger.info(
      `Scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`
    );

    this.reconnectTimer = setTimeout(async () => {
      await this.reconnect();
    }, delay);
  }

  /**
   * Attempt to reconnect
   */
  async reconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.setState(ConnectionState.RECONNECTING);
    this.logger.info(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

    // First, try to detect available devices
    const availableDevices = await this.detectDevices();

    let targetPort = this.config.device.serialPort;

    // If configured port not available, try to find a suitable device
    if (!availableDevices.find(dev => dev.path === targetPort)) {
      targetPort = this.findSuitableDevice(availableDevices);

      if (targetPort && targetPort !== this.config.device.serialPort) {
        this.logger.info(`Configured port not available, trying ${targetPort}`);
      }
    }

    const success = await this.connect(targetPort);

    if (!success) {
      this.scheduleReconnect();
    }
  }

  /**
   * Detect available serial devices
   */
  async detectDevices() {
    try {
      // Allow dependency injection for testing
      let SerialPort;
      if (this.SerialPort) {
        SerialPort = this.SerialPort;
      } else {
        const serialportModule = require('serialport');
        SerialPort = serialportModule.SerialPort;
      }

      const ports = await SerialPort.list();

      this.lastKnownDevices = ports;
      this.emit('devicesDetected', ports);

      return ports;
    } catch (error) {
      this.logger.error('Error detecting serial devices:', error);
      return [];
    }
  }

  /**
   * Find a suitable device for connection
   */
  findSuitableDevice(devices) {
    // Look for Arduino-like devices
    const arduinoPatterns = [/arduino/i, /micro/i, /leonardo/i, /uno/i, /usb.*serial/i];

    for (const device of devices) {
      const deviceInfo =
        `${device.manufacturer || ''} ${device.productId || ''} ${device.vendorId || ''}`.toLowerCase();

      if (arduinoPatterns.some(pattern => pattern.test(deviceInfo))) {
        this.logger.info(`Found potential Arduino device: ${device.path} (${device.manufacturer})`);
        return device.path;
      }
    }

    // If no Arduino-like device found, return the first available port
    if (devices.length > 0) {
      this.logger.info(`No Arduino device detected, trying first available: ${devices[0].path}`);
      return devices[0].path;
    }

    return null;
  }

  /**
   * Start device scanning
   */
  startDeviceScanning() {
    this.deviceScanTimer = setInterval(async () => {
      if (this.state === ConnectionState.DISCONNECTED || this.state === ConnectionState.FAILED) {
        await this.detectDevices();
      }
    }, this.deviceScanInterval);
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    this.healthCheckTimer = setInterval(() => {
      if (this.state === ConnectionState.CONNECTED) {
        const timeSinceActivity = Date.now() - this.lastActivityTime;

        if (timeSinceActivity > this.healthCheckInterval * 2) {
          this.logger.warn(
            `No serial activity for ${timeSinceActivity}ms, checking connection health`
          );
          this.checkConnectionHealth();
        }
      }
    }, this.healthCheckInterval);
  }

  /**
   * Check connection health
   */
  async checkConnectionHealth() {
    if (!this.serialPort || !this.serialPort.isOpen) {
      this.setState(ConnectionState.DISCONNECTED);
      return;
    }

    try {
      // Send a ping command to verify connection
      await this.sendCommand('PING', 2000);
      this.lastActivityTime = Date.now();
    } catch (error) {
      this.logger.warn('Health check failed, connection may be dead');
      this.handleConnectionError(error);
    }
  }

  /**
   * Send a command with timeout
   */
  async sendCommand(command, timeout = 5000) {
    return new Promise((resolve, reject) => {
      if (!this.serialPort || !this.serialPort.isOpen) {
        if (this.isOfflineMode) {
          this.queueCommand(command);
          resolve('QUEUED');
        } else {
          reject(new Error('Serial port not connected'));
        }
        return;
      }

      const timeoutHandle = setTimeout(() => {
        reject(new Error(`Command timeout: ${command}`));
      }, timeout);

      const responseHandler = data => {
        clearTimeout(timeoutHandle);
        this.parser.removeListener('data', responseHandler);
        resolve(data);
      };

      this.parser.once('data', responseHandler);

      this.serialPort.write(`${command}\n`, error => {
        if (error) {
          clearTimeout(timeoutHandle);
          this.parser.removeListener('data', responseHandler);
          reject(error);
        }
      });
    });
  }

  /**
   * Enable offline mode for graceful degradation
   */
  enableOfflineMode() {
    this.isOfflineMode = true;
    this.logger.info('Enabled offline mode - commands will be queued');
    this.emit('offlineMode', true);
  }

  /**
   * Disable offline mode
   */
  disableOfflineMode() {
    this.isOfflineMode = false;
    this.logger.info('Disabled offline mode');
    this.emit('offlineMode', false);
  }

  /**
   * Queue command for offline mode
   */
  queueCommand(command) {
    if (this.pendingCommands.length >= this.maxPendingCommands) {
      this.pendingCommands.shift(); // Remove oldest command
    }

    this.pendingCommands.push({
      command,
      timestamp: Date.now()
    });

    this.logger.debug(`Queued command: ${command} (${this.pendingCommands.length} pending)`);
  }

  /**
   * Process pending commands after reconnection
   */
  async processPendingCommands() {
    if (this.pendingCommands.length === 0) {
      return;
    }

    this.logger.info(`Processing ${this.pendingCommands.length} pending commands...`);

    for (const { command, timestamp } of this.pendingCommands) {
      try {
        // Skip old commands (older than 30 seconds)
        if (Date.now() - timestamp > 30000) {
          this.logger.debug(`Skipping old command: ${command}`);
          continue;
        }

        await this.sendCommand(command);
        await this.sleep(100); // Small delay between commands
      } catch (error) {
        this.logger.warn(`Failed to process pending command: ${command}`, error);
      }
    }

    this.pendingCommands = [];
    this.disableOfflineMode();
  }

  /**
   * Set connection state
   */
  setState(newState) {
    if (this.state !== newState) {
      const oldState = this.state;
      this.state = newState;
      this.logger.info(`Connection state changed: ${oldState} -> ${newState}`);
      this.emit('stateChange', newState, oldState);
    }
  }

  /**
   * Get current connection status
   */
  getStatus() {
    return {
      state: this.state,
      port: this.config.device.serialPort,
      isConnected: this.state === ConnectionState.CONNECTED,
      reconnectAttempts: this.reconnectAttempts,
      isOfflineMode: this.isOfflineMode,
      pendingCommands: this.pendingCommands.length,
      lastActivity: this.lastActivityTime,
      availableDevices: this.lastKnownDevices
    };
  }

  /**
   * Clean up timers and connections
   */
  async destroy() {
    this.logger.info('Destroying Serial Connection Manager...');

    // Clear timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    if (this.deviceScanTimer) {
      clearInterval(this.deviceScanTimer);
    }
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    // Disconnect
    await this.disconnect();

    // Clear pending commands
    this.pendingCommands = [];

    this.emit('destroyed');
  }

  /**
   * Utility function for delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = {
  SerialConnectionManager,
  ConnectionState
};
