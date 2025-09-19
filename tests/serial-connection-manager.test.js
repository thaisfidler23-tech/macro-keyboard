/**
 * Serial Connection Manager Tests
 * 
 * Tests for automatic reconnection, device detection, offline mode,
 * and error handling in serial communication.
 */

const { SerialConnectionManager, ConnectionState } = require('../src/SerialConnectionManager');
const { ErrorHandler, ErrorTypes } = require('../src/ErrorHandler');

// Mock serialport
const mockSerialPort = {
  list: jest.fn(),
  SerialPort: jest.fn()
};

const mockParser = {
  pipe: jest.fn().mockReturnThis(),
  on: jest.fn(),
  once: jest.fn(),
  removeListener: jest.fn()
};

const mockPort = {
  open: jest.fn(),
  close: jest.fn(),
  write: jest.fn(),
  isOpen: false,
  on: jest.fn(),
  pipe: jest.fn(() => mockParser)
};

// Set up mocks before requiring the module
jest.mock('serialport', () => ({
  SerialPort: mockSerialPort.SerialPort,
}));

// Mock the dynamic require in detectDevices
jest.mock('serialport', () => {
  const actualSerialPort = {
    list: mockSerialPort.list,
    SerialPort: mockSerialPort.SerialPort
  };
  return actualSerialPort;
});

jest.mock('@serialport/parser-readline', () => ({
  ReadlineParser: jest.fn(() => mockParser)
}));

describe('SerialConnectionManager', () => {
  let manager;
  let config;
  let mockLogger;
  let errorHandler;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    errorHandler = new ErrorHandler(mockLogger);
    // Mock handleError to prevent unhandled error events during tests
    jest.spyOn(errorHandler, 'handleError').mockResolvedValue();

    config = {
      device: {
        serialPort: '/dev/ttyUSB0',
        baudRate: 9600,
        buttons: 8,
        encoders: 0
      }
    };

    manager = new SerialConnectionManager(config, mockLogger, errorHandler);

    // Inject mock SerialPort for testing
    manager.SerialPort = {
      list: mockSerialPort.list
    };

    // Reset mocks
    jest.clearAllMocks();
    mockSerialPort.SerialPort.mockImplementation(() => mockPort);
    mockSerialPort.list.mockResolvedValue([
      { path: '/dev/ttyUSB0', manufacturer: 'Arduino Micro' },
      { path: '/dev/ttyUSB1', manufacturer: 'Other Device' }
    ]);
  });

  afterEach(() => {
    if (manager) {
      manager.removeAllListeners();
      clearTimeout(manager.reconnectTimer);
      clearInterval(manager.deviceScanTimer);
      clearInterval(manager.healthCheckTimer);
    }
  });

  describe('Initialization', () => {
    test('should initialize with correct state', () => {
      expect(manager.state).toBe(ConnectionState.DISCONNECTED);
      expect(manager.reconnectAttempts).toBe(0);
      expect(manager.isOfflineMode).toBe(false);
      expect(manager.pendingCommands).toEqual([]);
    });

    test('should set up error handler listeners', async () => {
      const errorHandlerSpy = jest.spyOn(manager, 'setupErrorHandlerListeners');
      const deviceScanningSpy = jest.spyOn(manager, 'startDeviceScanning');
      const healthMonitoringSpy = jest.spyOn(manager, 'startHealthMonitoring');
      const connectSpy = jest.spyOn(manager, 'connect').mockResolvedValue(true);

      await manager.initialize();

      expect(errorHandlerSpy).toHaveBeenCalled();
      expect(deviceScanningSpy).toHaveBeenCalled();
      expect(healthMonitoringSpy).toHaveBeenCalled();
      expect(connectSpy).toHaveBeenCalled();

      errorHandlerSpy.mockRestore();
      deviceScanningSpy.mockRestore();
      healthMonitoringSpy.mockRestore();
      connectSpy.mockRestore();
    });

    test('should handle missing serial port gracefully', async () => {
      config.device.serialPort = null;
      const connectSpy = jest.spyOn(manager, 'connect').mockResolvedValue(false);

      await manager.initialize();

      expect(connectSpy).not.toHaveBeenCalled();
      expect(manager.state).toBe(ConnectionState.DISCONNECTED);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'No serial port configured, waiting for device detection...'
      );

      connectSpy.mockRestore();
    });
  });

  describe('Connection Management', () => {
    test('should connect successfully', async () => {
      mockPort.open.mockImplementation((callback) => callback(null));
      mockPort.isOpen = true;

      const result = await manager.connect();

      expect(result).toBe(true);
      expect(manager.state).toBe(ConnectionState.CONNECTED);
      expect(manager.reconnectAttempts).toBe(0);
      expect(manager.isOfflineMode).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith('Successfully connected to /dev/ttyUSB0');
    });

    test('should handle connection failure', async () => {
      const connectionError = new Error('Connection failed');
      mockPort.open.mockImplementation((callback) => callback(connectionError));

      const result = await manager.connect();

      expect(result).toBe(false);
      expect(manager.state).toBe(ConnectionState.FAILED);
      expect(mockLogger.error).not.toHaveBeenCalled(); // Error should be handled by error handler
    });

    test('should handle connection timeout', async () => {
      // Mock timeout scenario
      jest.useFakeTimers();
      mockPort.open.mockImplementation(() => {
        // Don't call callback to simulate timeout
      });

      const connectPromise = manager.connect();
      
      // Fast-forward past timeout
      jest.advanceTimersByTime(6000);

      const result = await connectPromise;

      expect(result).toBe(false);
      expect(manager.state).toBe(ConnectionState.FAILED);

      jest.useRealTimers();
    });

    test('should prevent multiple simultaneous connections', async () => {
      manager.state = ConnectionState.CONNECTING;

      const result = await manager.connect();

      expect(result).toBe(false);
      expect(mockSerialPort.SerialPort).not.toHaveBeenCalled();
    });

    test('should disconnect cleanly', async () => {
      mockPort.isOpen = true;
      mockPort.close.mockImplementation((callback) => callback());
      manager.serialPort = mockPort;

      await manager.disconnect();

      expect(mockPort.close).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Serial port disconnected');
    });
  });

  describe('Automatic Reconnection', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should schedule reconnection with exponential backoff', () => {
      const reconnectSpy = jest.spyOn(manager, 'reconnect').mockResolvedValue();

      manager.scheduleReconnect();
      expect(manager.reconnectAttempts).toBe(1);

      // Fast-forward past initial delay (1000ms * 1.5^0 = 1000ms)
      jest.advanceTimersByTime(1500);
      expect(reconnectSpy).toHaveBeenCalledTimes(1);

      // Second attempt should have longer delay (1000ms * 1.5^1 = 1500ms)
      manager.scheduleReconnect();
      expect(manager.reconnectAttempts).toBe(2);

      // Should not be called immediately
      expect(reconnectSpy).toHaveBeenCalledTimes(1);

      // Fast-forward past second delay
      jest.advanceTimersByTime(2000);
      expect(reconnectSpy).toHaveBeenCalledTimes(2);

      reconnectSpy.mockRestore();
    });

    test('should stop reconnecting after max attempts', () => {
      manager.maxReconnectAttempts = 3;
      const reconnectFailedPromise = new Promise(resolve => {
        manager.once('reconnectFailed', resolve);
      });

      for (let i = 0; i < 4; i++) {
        manager.scheduleReconnect();
      }

      expect(manager.state).toBe(ConnectionState.FAILED);
      expect(mockLogger.error).toHaveBeenCalledWith('Max reconnection attempts reached (3)');
    });

    test('should attempt device detection during reconnection', async () => {
      const detectDevicesSpy = jest.spyOn(manager, 'detectDevices').mockResolvedValue([
        { path: '/dev/ttyUSB1', manufacturer: 'Arduino' }
      ]);
      const connectSpy = jest.spyOn(manager, 'connect').mockResolvedValue(false);

      await manager.reconnect();

      expect(detectDevicesSpy).toHaveBeenCalled();
      expect(connectSpy).toHaveBeenCalled();

      detectDevicesSpy.mockRestore();
      connectSpy.mockRestore();
    });

    test('should find suitable device if configured port unavailable', async () => {
      const devices = [
        { path: '/dev/ttyUSB1', manufacturer: 'Arduino Micro', productId: '123' },
        { path: '/dev/ttyUSB2', manufacturer: 'Other Device', productId: '456' }
      ];

      jest.spyOn(manager, 'detectDevices').mockResolvedValue(devices);
      const connectSpy = jest.spyOn(manager, 'connect').mockResolvedValue(true);

      await manager.reconnect();

      // Should try to connect to Arduino device
      expect(connectSpy).toHaveBeenCalledWith('/dev/ttyUSB1');

      connectSpy.mockRestore();
    });
  });

  describe('Device Detection', () => {
    test('should detect available devices', async () => {
      const devices = await manager.detectDevices();

      expect(devices).toHaveLength(2);
      expect(manager.lastKnownDevices).toEqual(devices);
    });

    test('should handle device detection errors', async () => {
      const detectionError = new Error('Detection failed');
      manager.SerialPort.list.mockRejectedValue(detectionError);

      const devices = await manager.detectDevices();

      expect(devices).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith('Error detecting serial devices:', detectionError);
    });

    test('should find Arduino-like devices', () => {
      const devices = [
        { path: '/dev/ttyUSB0', manufacturer: 'Arduino Micro' },
        { path: '/dev/ttyUSB1', manufacturer: 'USB Serial' },
        { path: '/dev/ttyUSB2', manufacturer: 'Other Device' }
      ];

      const suitableDevice = manager.findSuitableDevice(devices);
      expect(suitableDevice).toBe('/dev/ttyUSB0');
    });

    test('should fall back to first device if no Arduino found', () => {
      const devices = [
        { path: '/dev/ttyUSB0', manufacturer: 'Other Device' },
        { path: '/dev/ttyUSB1', manufacturer: 'Another Device' }
      ];

      const suitableDevice = manager.findSuitableDevice(devices);
      expect(suitableDevice).toBe('/dev/ttyUSB0');
    });

    test('should return null if no devices available', () => {
      const suitableDevice = manager.findSuitableDevice([]);
      expect(suitableDevice).toBeNull();
    });
  });

  describe('Health Monitoring', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should monitor connection health', () => {
      manager.state = ConnectionState.CONNECTED;
      manager.lastActivityTime = Date.now() - 25000; // 25 seconds ago
      
      const healthCheckSpy = jest.spyOn(manager, 'checkConnectionHealth').mockResolvedValue();
      manager.startHealthMonitoring();

      jest.advanceTimersByTime(15000);

      expect(healthCheckSpy).toHaveBeenCalled();
      healthCheckSpy.mockRestore();
    });

    test('should send ping for health check', async () => {
      manager.serialPort = mockPort;
      mockPort.isOpen = true;
      
      const sendCommandSpy = jest.spyOn(manager, 'sendCommand').mockResolvedValue('PONG');

      await manager.checkConnectionHealth();

      expect(sendCommandSpy).toHaveBeenCalledWith('PING', 2000);
      expect(manager.lastActivityTime).toBeCloseTo(Date.now(), -3);

      sendCommandSpy.mockRestore();
    });

    test('should handle health check failure', async () => {
      manager.serialPort = mockPort;
      mockPort.isOpen = true;

      const sendCommandSpy = jest.spyOn(manager, 'sendCommand').mockRejectedValue(new Error('Ping failed'));
      const handleErrorSpy = jest.spyOn(manager, 'handleConnectionError').mockResolvedValue();

      await manager.checkConnectionHealth();

      expect(handleErrorSpy).toHaveBeenCalled();

      sendCommandSpy.mockRestore();
      handleErrorSpy.mockRestore();
    });
  });

  describe('Offline Mode and Command Queuing', () => {
    test('should enable offline mode on disconnection', () => {
      const offlineModePromise = new Promise(resolve => {
        manager.once('offlineMode', resolve);
      });

      manager.enableOfflineMode();

      expect(manager.isOfflineMode).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Enabled offline mode - commands will be queued');
    });

    test('should queue commands in offline mode', async () => {
      manager.isOfflineMode = true;

      const result = await manager.sendCommand('TEST_COMMAND');

      expect(result).toBe('QUEUED');
      expect(manager.pendingCommands).toHaveLength(1);
      expect(manager.pendingCommands[0].command).toBe('TEST_COMMAND');
      expect(manager.pendingCommands[0].timestamp).toBeCloseTo(Date.now(), -3);
    });

    test('should maintain command queue size limit', () => {
      manager.isOfflineMode = true;
      manager.maxPendingCommands = 3;

      // Queue more commands than the limit
      for (let i = 0; i < 5; i++) {
        manager.queueCommand(`COMMAND_${i}`);
      }

      expect(manager.pendingCommands).toHaveLength(3);
      // Should keep the most recent commands
      expect(manager.pendingCommands[0].command).toBe('COMMAND_2');
      expect(manager.pendingCommands[2].command).toBe('COMMAND_4');
    });

    test('should process pending commands on reconnection', async () => {
      manager.isOfflineMode = true;
      manager.pendingCommands = [
        { command: 'CMD1', timestamp: Date.now() - 5000 },
        { command: 'CMD2', timestamp: Date.now() - 35000 }, // Old command
        { command: 'CMD3', timestamp: Date.now() - 2000 }
      ];

      const sendCommandSpy = jest.spyOn(manager, 'sendCommand').mockResolvedValue('OK');

      await manager.processPendingCommands();

      // Should skip old command and process recent ones
      expect(sendCommandSpy).toHaveBeenCalledWith('CMD1');
      expect(sendCommandSpy).toHaveBeenCalledWith('CMD3');
      expect(sendCommandSpy).not.toHaveBeenCalledWith('CMD2');
      expect(manager.pendingCommands).toEqual([]);
      expect(manager.isOfflineMode).toBe(false);

      sendCommandSpy.mockRestore();
    });
  });

  describe('Command Communication', () => {
    test('should send command successfully', async () => {
      manager.serialPort = mockPort;
      manager.parser = mockParser;
      mockPort.isOpen = true;
      mockPort.write.mockImplementation((data, callback) => callback(null));

      // Mock parser response
      setTimeout(() => {
        // Find and call the data handler
        if (mockParser.once.mock.calls.length > 0) {
          const dataHandler = mockParser.once.mock.calls.find(call => call[0] === 'data')[1];
          dataHandler('RESPONSE');
        }
      }, 100);

      const response = await manager.sendCommand('TEST_COMMAND', 1000);

      expect(response).toBe('RESPONSE');
      expect(mockPort.write).toHaveBeenCalledWith('TEST_COMMAND\n', expect.any(Function));
    });

    test('should handle command timeout', async () => {
      jest.useFakeTimers();
      manager.serialPort = mockPort;
      manager.parser = mockParser;
      mockPort.isOpen = true;
      mockPort.write.mockImplementation((data, callback) => callback(null));

      const commandPromise = manager.sendCommand('TEST_COMMAND', 1000);

      jest.advanceTimersByTime(1500);

      await expect(commandPromise).rejects.toThrow('Command timeout: TEST_COMMAND');

      jest.useRealTimers();
    });

    test('should reject if port not connected', async () => {
      manager.serialPort = null;
      manager.isOfflineMode = false;

      await expect(manager.sendCommand('TEST_COMMAND')).rejects.toThrow('Serial port not connected');
    });

    test('should handle write errors', async () => {
      manager.serialPort = mockPort;
      manager.parser = mockParser;
      mockPort.isOpen = true;
      const writeError = new Error('Write failed');
      mockPort.write.mockImplementation((data, callback) => callback(writeError));

      await expect(manager.sendCommand('TEST_COMMAND')).rejects.toThrow('Write failed');
    });
  });

  describe('Event Handling', () => {
    test('should handle connection close', async () => {
      const disconnectedPromise = new Promise(resolve => {
        manager.once('disconnected', resolve);
      });

      manager.state = ConnectionState.CONNECTED;
      manager.serialPort = mockPort;

      await manager.handleConnectionClose();

      expect(manager.state).toBe(ConnectionState.DISCONNECTED);
      expect(manager.serialPort).toBeNull();
      expect(manager.parser).toBeNull();
      expect(manager.isOfflineMode).toBe(true);
    });

    test('should handle connection error', async () => {
      const error = new Error('Connection error');
      await manager.handleConnectionError(error);

      expect(mockLogger.error).toHaveBeenCalledWith('Serial port error:', error);
    });

    test('should emit state change events', () => {
      const stateChangePromise = new Promise(resolve => {
        manager.once('stateChange', resolve);
      });

      manager.setState(ConnectionState.CONNECTED);

      expect(manager.state).toBe(ConnectionState.CONNECTED);
      expect(mockLogger.info).toHaveBeenCalledWith('Connection state changed: DISCONNECTED -> CONNECTED');
    });
  });

  describe('Status and Cleanup', () => {
    test('should provide status information', () => {
      manager.state = ConnectionState.CONNECTED;
      manager.reconnectAttempts = 2;
      manager.isOfflineMode = false;
      manager.pendingCommands = [{ command: 'CMD1' }, { command: 'CMD2' }];
      manager.lastActivityTime = Date.now() - 5000;

      const status = manager.getStatus();

      expect(status.state).toBe(ConnectionState.CONNECTED);
      expect(status.port).toBe(config.device.serialPort);
      expect(status.isConnected).toBe(true);
      expect(status.reconnectAttempts).toBe(2);
      expect(status.isOfflineMode).toBe(false);
      expect(status.pendingCommands).toBe(2);
      expect(status.lastActivity).toBeCloseTo(Date.now() - 5000, -3);
    });

    test('should cleanup resources on destroy', async () => {
      manager.reconnectTimer = setTimeout(() => {}, 1000);
      manager.deviceScanTimer = setInterval(() => {}, 1000);
      manager.healthCheckTimer = setInterval(() => {}, 1000);
      manager.serialPort = mockPort;
      manager.pendingCommands = [{ command: 'CMD1' }];

      const disconnectSpy = jest.spyOn(manager, 'disconnect').mockResolvedValue();
      const destroyedPromise = new Promise(resolve => {
        manager.once('destroyed', resolve);
      });

      await manager.destroy();

      expect(disconnectSpy).toHaveBeenCalled();
      expect(manager.pendingCommands).toEqual([]);

      disconnectSpy.mockRestore();
    });
  });

  describe('Error Handler Integration', () => {
    test('should respond to error handler serial recovery requests', async () => {
      const reconnectSpy = jest.spyOn(manager, 'reconnect').mockResolvedValue();

      // Manually call the listener
      manager.setupErrorHandlerListeners();
      errorHandler.emit('serialRecovery', { port: '/dev/ttyUSB0' });

      expect(reconnectSpy).toHaveBeenCalled();
      reconnectSpy.mockRestore();
    });

    test('should create appropriate error for connection failures', async () => {
      const connectionError = new Error('Connection failed');
      mockPort.open.mockImplementation((callback) => callback(connectionError));

      // Reset the mock to capture calls
      errorHandler.handleError.mockReset();

      const result = await manager.connect();

      expect(errorHandler.handleError).toHaveBeenCalled();
      const capturedError = errorHandler.handleError.mock.calls[0][0];
      expect(capturedError.type).toBe(ErrorTypes.HARDWARE.SERIAL_CONNECTION_FAILED);
      expect(capturedError.context.port).toBe('/dev/ttyUSB0');
    });

    test('should create appropriate error for device disconnection', async () => {
      manager.state = ConnectionState.CONNECTED;
      
      // Reset the mock to capture calls
      errorHandler.handleError.mockReset();

      await manager.handleConnectionClose();

      expect(errorHandler.handleError).toHaveBeenCalled();
      const capturedError = errorHandler.handleError.mock.calls[0][0];
      expect(capturedError.type).toBe(ErrorTypes.HARDWARE.DEVICE_DISCONNECTED);
    });
  });
});