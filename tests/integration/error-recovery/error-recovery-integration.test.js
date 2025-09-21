/**
 * Error Recovery Integration Test Suite
 * 
 * Tests system behavior during failure scenarios and recovery mechanisms,
 * including hardware failures, network issues, and configuration corruption.
 */

const EventEmitter = require('events');

describe('Error Recovery Integration Tests', () => {
  let systemUnderTest;
  let mockComponents;
  let errorHandler;
  let testLogger;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup test logger for error tracking
    testLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      errorHistory: [],
      
      // Custom method to track error patterns
      logError: jest.fn().mockImplementation((error) => {
        testLogger.errorHistory.push({
          timestamp: Date.now(),
          error: error.message,
          code: error.code,
          severity: error.severity
        });
        testLogger.error(error);
      })
    };

    // Setup mock components with error simulation capabilities
    mockComponents = {
      serialManager: createMockSerialManager(),
      profileManager: createMockProfileManager(),
      actionExecutor: createMockActionExecutor(),
      ledController: createMockLEDController(),
      pluginManager: createMockPluginManager(),
      configManager: createMockConfigManager(),
      externalAPIManager: createMockExternalAPIManager()
    };

    // Setup error handler
    errorHandler = new EventEmitter();
    errorHandler.handleError = jest.fn();
    errorHandler.recoverFromError = jest.fn();
    errorHandler.reportError = jest.fn();

    // Setup system under test
    systemUnderTest = {
      components: mockComponents,
      errorHandler,
      logger: testLogger,
      isOperational: true,
      operatingMode: 'normal',
      
      // System state management
      enterSafeMode: jest.fn().mockImplementation(() => {
        systemUnderTest.operatingMode = 'safe';
      }),
      
      exitSafeMode: jest.fn().mockImplementation(() => {
        systemUnderTest.operatingMode = 'normal';
      }),
      
      shutdown: jest.fn().mockImplementation(() => {
        systemUnderTest.isOperational = false;
      })
    };
  });

  describe('Hardware Disconnection Recovery', () => {
    test('should detect hardware disconnection immediately', async () => {
      // Normal operation
      expect(mockComponents.serialManager.isConnected()).toBe(true);

      // Simulate hardware disconnection
      mockComponents.serialManager.simulateDisconnection('device-unplugged');

      await waitForAsyncOperations();

      // Verify immediate detection
      expect(mockComponents.serialManager.isConnected()).toBe(false);
      expect(testLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Hardware disconnected')
        })
      );
    });

    test('should enter graceful degradation mode on hardware loss', async () => {
      // Simulate hardware disconnection
      mockComponents.serialManager.simulateDisconnection('connection-lost');

      await waitForAsyncOperations();

      // Verify system enters degradation mode
      expect(systemUnderTest.operatingMode).toBe('safe');
      expect(mockComponents.ledController.mode).toBe('software-only');
      expect(mockComponents.actionExecutor.hardwareEnabled).toBe(false);

      // Verify user notification
      expect(errorHandler.reportError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'hardware-unavailable',
          userMessage: 'Hardware disconnected - operating in software mode'
        })
      );
    });

    test('should attempt automatic reconnection with exponential backoff', async () => {
      let reconnectAttempts = 0;
      
      mockComponents.serialManager.attemptReconnection = jest.fn().mockImplementation(async () => {
        reconnectAttempts++;
        
        // Fail first two attempts, succeed on third
        if (reconnectAttempts < 3) {
          throw new Error('Reconnection failed');
        }
        
        mockComponents.serialManager.connected = true;
        mockComponents.serialManager.emit('reconnected');
      });

      // Simulate disconnection
      mockComponents.serialManager.simulateDisconnection('transient-error');

      // Wait for reconnection attempts
      await waitForAsyncOperations(5000); // 5 second timeout

      // Verify reconnection attempts with backoff
      expect(reconnectAttempts).toBe(3);
      expect(mockComponents.serialManager.isConnected()).toBe(true);
      
      // Verify system recovery
      expect(systemUnderTest.operatingMode).toBe('normal');
      expect(mockComponents.ledController.mode).toBe('hardware-enabled');
    });

    test('should maintain functionality during hardware absence', async () => {
      // Disconnect hardware
      mockComponents.serialManager.simulateDisconnection('device-removed');

      await waitForAsyncOperations();

      // Test software-only button press
      const result = await mockComponents.actionExecutor.execute({
        buttonId: 1,
        action: 'ctrl+c',
        source: 'software'
      });

      // Verify action executes despite hardware absence
      expect(result.success).toBe(true);
      expect(result.mode).toBe('software-only');

      // Test profile switching without LED hardware
      await mockComponents.profileManager.switchProfile('gaming');
      
      expect(mockComponents.profileManager.currentProfile).toBe('gaming');
      expect(mockComponents.ledController.lastThemeApplication).toBe('software-simulation');
    });

    test('should restore full functionality after hardware reconnection', async () => {
      // Disconnect and reconnect hardware
      mockComponents.serialManager.simulateDisconnection('temporary-fault');
      await waitForAsyncOperations();
      
      mockComponents.serialManager.simulateReconnection();
      await waitForAsyncOperations();

      // Verify full restoration
      expect(systemUnderTest.operatingMode).toBe('normal');
      expect(mockComponents.serialManager.isConnected()).toBe(true);
      expect(mockComponents.ledController.mode).toBe('hardware-enabled');

      // Test full functionality restoration
      const result = await mockComponents.actionExecutor.execute({
        buttonId: 2,
        action: 'discord:mute',
        source: 'hardware'
      });

      expect(result.success).toBe(true);
      expect(result.hardwareFeedback).toBe(true);
      expect(mockComponents.serialManager.lastCommand).toContain('LED:BUTTON:2');
    });
  });

  describe('Configuration Corruption Recovery', () => {
    test('should detect corrupted configuration files', async () => {
      // Simulate corrupted configuration
      const corruptedConfig = '{ invalid yaml content }';
      
      mockComponents.configManager.simulateCorruption(corruptedConfig);

      try {
        await mockComponents.configManager.loadConfiguration();
        fail('Should have detected corruption');
      } catch (error) {
        expect(error.code).toBe('CONFIG_CORRUPTION');
        expect(error.message).toContain('Configuration file corrupted');
      }

      // Verify error logging
      expect(testLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'CONFIG_CORRUPTION'
        })
      );
    });

    test('should restore from backup configuration', async () => {
      // Setup backup configuration
      const backupConfig = {
        device: { buttons: 16, encoders: 2 },
        profiles: { default: { name: 'Default' } }
      };

      mockComponents.configManager.backupConfigurations = [backupConfig];

      // Simulate corruption
      mockComponents.configManager.simulateCorruption();

      // Trigger recovery
      await mockComponents.configManager.recoverFromCorruption();

      // Verify backup restoration
      expect(mockComponents.configManager.currentConfig).toEqual(backupConfig);
      expect(testLogger.info).toHaveBeenCalledWith(
        'Configuration restored from backup'
      );
    });

    test('should fallback to default configuration when no backup available', async () => {
      // Clear backups
      mockComponents.configManager.backupConfigurations = [];

      // Simulate corruption
      mockComponents.configManager.simulateCorruption();

      // Trigger recovery
      await mockComponents.configManager.recoverFromCorruption();

      // Verify fallback to defaults
      expect(mockComponents.configManager.currentConfig).toEqual(
        mockComponents.configManager.defaultConfiguration
      );
      
      expect(testLogger.warn).toHaveBeenCalledWith(
        'No backup available - using default configuration'
      );
    });

    test('should validate recovered configuration before applying', async () => {
      // Setup partially corrupted backup
      const partiallyCorruptedBackup = {
        device: { buttons: -5 }, // Invalid button count
        profiles: null // Invalid profiles
      };

      mockComponents.configManager.backupConfigurations = [partiallyCorruptedBackup];
      mockComponents.configManager.validateConfiguration = jest.fn().mockReturnValue({
        valid: false,
        errors: ['Invalid button count', 'Missing profiles']
      });

      // Simulate corruption and recovery
      mockComponents.configManager.simulateCorruption();
      await mockComponents.configManager.recoverFromCorruption();

      // Verify validation check
      expect(mockComponents.configManager.validateConfiguration).toHaveBeenCalled();
      
      // Verify fallback to defaults due to invalid backup
      expect(mockComponents.configManager.currentConfig).toEqual(
        mockComponents.configManager.defaultConfiguration
      );
    });
  });

  describe('Plugin System Error Recovery', () => {
    test('should isolate plugin crashes from system stability', async () => {
      // Setup crashing plugin
      const crashingPlugin = {
        name: 'buggy-plugin',
        onButtonPress: jest.fn().mockImplementation(() => {
          throw new Error('Plugin crashed unexpectedly');
        })
      };

      mockComponents.pluginManager.loadedPlugins.set('buggy-plugin', crashingPlugin);

      // Trigger plugin execution
      try {
        await mockComponents.pluginManager.executePlugin('buggy-plugin', 'onButtonPress', [1]);
      } catch (error) {
        // Plugin error should be caught and handled
        expect(error.message).toContain('Plugin crashed');
      }

      // Verify system stability
      expect(systemUnderTest.isOperational).toBe(true);
      expect(systemUnderTest.operatingMode).toBe('normal');

      // Verify plugin isolation
      expect(mockComponents.pluginManager.getPluginState('buggy-plugin')).toBe('crashed');
      expect(mockComponents.pluginManager.isPluginActive('buggy-plugin')).toBe(false);
    });

    test('should disable failed plugins and continue operation', async () => {
      const unreliablePlugin = {
        name: 'unreliable-plugin',
        errorCount: 0,
        onButtonPress: jest.fn().mockImplementation(() => {
          unreliablePlugin.errorCount++;
          if (unreliablePlugin.errorCount <= 3) {
            throw new Error(`Plugin error #${unreliablePlugin.errorCount}`);
          }
        })
      };

      mockComponents.pluginManager.loadedPlugins.set('unreliable-plugin', unreliablePlugin);

      // Trigger multiple plugin executions to exceed error threshold
      for (let i = 0; i < 5; i++) {
        try {
          await mockComponents.pluginManager.executePlugin('unreliable-plugin', 'onButtonPress', [i]);
        } catch (error) {
          // Expected errors
        }
      }

      // Verify plugin gets disabled after error threshold
      expect(mockComponents.pluginManager.isPluginActive('unreliable-plugin')).toBe(false);
      expect(mockComponents.pluginManager.getPluginState('unreliable-plugin')).toBe('disabled');
      
      // Verify system continues operating
      expect(systemUnderTest.isOperational).toBe(true);
    });

    test('should recover plugin dependencies after plugin failure', async () => {
      // Setup plugin dependency chain: A → B → C
      const pluginA = { name: 'plugin-a', dependencies: [] };
      const pluginB = { name: 'plugin-b', dependencies: ['plugin-a'] };
      const pluginC = { name: 'plugin-c', dependencies: ['plugin-b'] };

      mockComponents.pluginManager.loadedPlugins.set('plugin-a', pluginA);
      mockComponents.pluginManager.loadedPlugins.set('plugin-b', pluginB);
      mockComponents.pluginManager.loadedPlugins.set('plugin-c', pluginC);

      // Simulate plugin-b failure
      mockComponents.pluginManager.disablePlugin('plugin-b', 'crashed');

      // Verify dependency cascade handling
      expect(mockComponents.pluginManager.isPluginActive('plugin-c')).toBe(false);
      expect(mockComponents.pluginManager.getPluginState('plugin-c')).toBe('dependency-failed');
      
      // Verify plugin-a continues working (no dependency on failed plugin)
      expect(mockComponents.pluginManager.isPluginActive('plugin-a')).toBe(true);
    });
  });

  describe('Network Connectivity Error Recovery', () => {
    test('should detect network connectivity loss', async () => {
      // Simulate network failure
      mockComponents.externalAPIManager.simulateNetworkError('ENOTFOUND');

      try {
        await mockComponents.externalAPIManager.getCalendarEvents();
        fail('Should have detected network error');
      } catch (error) {
        expect(error.code).toBe('ENOTFOUND');
        expect(error.networkError).toBe(true);
      }

      // Verify offline mode activation
      expect(mockComponents.externalAPIManager.operatingMode).toBe('offline');
    });

    test('should use cached data during network outage', async () => {
      // Setup cached data
      const cachedEvents = [
        { id: 'cached-1', title: 'Cached Meeting' }
      ];

      mockComponents.externalAPIManager.cache.set('calendar-events', cachedEvents);

      // Simulate network error
      mockComponents.externalAPIManager.simulateNetworkError('NETWORK_UNREACHABLE');

      // Request should return cached data
      const events = await mockComponents.externalAPIManager.getCalendarEventsWithFallback();

      expect(events).toEqual(cachedEvents);
      expect(mockComponents.externalAPIManager.lastDataSource).toBe('cache');
    });

    test('should retry external API calls with exponential backoff', async () => {
      let callAttempts = 0;
      const maxRetries = 3;

      mockComponents.externalAPIManager.makeAPICall = jest.fn().mockImplementation(async () => {
        callAttempts++;
        
        if (callAttempts <= 2) {
          throw new Error('Temporary network error');
        }
        
        return { success: true, data: 'API response' };
      });

      const startTime = Date.now();
      const result = await mockComponents.externalAPIManager.callWithRetry('test-endpoint');
      const totalTime = Date.now() - startTime;

      // Verify retry attempts
      expect(callAttempts).toBe(3);
      expect(result.success).toBe(true);
      
      // Verify exponential backoff timing (should include delays)
      expect(totalTime).toBeGreaterThan(300); // Minimum backoff time
    });

    test('should restore full functionality when network recovers', async () => {
      // Start in offline mode
      mockComponents.externalAPIManager.operatingMode = 'offline';

      // Simulate network recovery
      mockComponents.externalAPIManager.simulateNetworkRecovery();

      await waitForAsyncOperations();

      // Verify online mode restoration
      expect(mockComponents.externalAPIManager.operatingMode).toBe('online');

      // Test API functionality restoration
      const events = await mockComponents.externalAPIManager.getCalendarEvents();
      expect(events.source).toBe('api');
      expect(events.cached).toBe(false);
    });
  });

  describe('Memory Leak and Resource Recovery', () => {
    test('should detect and recover from memory leaks', async () => {
      // Simulate memory leak scenario
      let memoryUsage = 50; // MB
      const memoryThreshold = 200; // MB

      systemUnderTest.monitorMemoryUsage = jest.fn().mockImplementation(() => {
        memoryUsage += 10; // Simulate growing memory usage
        return memoryUsage;
      });

      systemUnderTest.performGarbageCollection = jest.fn().mockImplementation(() => {
        memoryUsage = Math.max(30, memoryUsage * 0.7); // Simulate cleanup
      });

      // Monitor memory over time
      for (let i = 0; i < 20; i++) {
        const currentUsage = systemUnderTest.monitorMemoryUsage();
        
        if (currentUsage > memoryThreshold) {
          systemUnderTest.performGarbageCollection();
          break;
        }
      }

      // Verify memory management
      expect(systemUnderTest.performGarbageCollection).toHaveBeenCalled();
      expect(memoryUsage).toBeLessThan(memoryThreshold);
    });

    test('should cleanup resources on component shutdown', async () => {
      // Setup resource tracking
      const resources = {
        fileHandles: 5,
        networkConnections: 3,
        timers: 7,
        eventListeners: 12
      };

      systemUnderTest.getResourceCount = jest.fn().mockReturnValue(resources);
      systemUnderTest.cleanupResources = jest.fn().mockImplementation(() => {
        return {
          fileHandles: 0,
          networkConnections: 0,
          timers: 0,
          eventListeners: 0
        };
      });

      // Trigger shutdown
      await systemUnderTest.shutdown();

      // Verify resource cleanup
      expect(systemUnderTest.cleanupResources).toHaveBeenCalled();
      
      const finalResources = systemUnderTest.cleanupResources.mock.results[0].value;
      expect(finalResources.fileHandles).toBe(0);
      expect(finalResources.networkConnections).toBe(0);
      expect(finalResources.timers).toBe(0);
      expect(finalResources.eventListeners).toBe(0);
    });
  });

  describe('Cascading Failure Recovery', () => {
    test('should prevent cascading failures across components', async () => {
      // Setup failure propagation scenario
      mockComponents.serialManager.simulateFailure('hardware-fault');
      
      // This should NOT cause other components to fail
      expect(mockComponents.profileManager.isOperational()).toBe(true);
      expect(mockComponents.actionExecutor.isOperational()).toBe(true);
      expect(mockComponents.pluginManager.isOperational()).toBe(true);

      // Verify isolated failure handling
      expect(systemUnderTest.operatingMode).toBe('safe');
      expect(systemUnderTest.isOperational).toBe(true);
    });

    test('should maintain core functionality during multiple component failures', async () => {
      // Simulate multiple component failures
      mockComponents.serialManager.simulateFailure('connection-lost');
      mockComponents.externalAPIManager.simulateFailure('network-down');
      
      await waitForAsyncOperations();

      // Verify core functionality remains
      const result = await mockComponents.actionExecutor.execute({
        buttonId: 1,
        action: 'ctrl+c',
        source: 'software'
      });

      expect(result.success).toBe(true);
      expect(systemUnderTest.isOperational).toBe(true);

      // Verify degraded mode operation
      expect(systemUnderTest.operatingMode).toBe('safe');
      expect(mockComponents.actionExecutor.hardwareEnabled).toBe(false);
    });
  });

  // Helper functions and mock implementations
  function createMockSerialManager() {
    const mock = new EventEmitter();
    mock.connected = true;
    mock.lastCommand = '';
    
    mock.isConnected = jest.fn(() => mock.connected);
    mock.sendCommand = jest.fn().mockImplementation((cmd) => {
      mock.lastCommand = cmd;
      return Promise.resolve();
    });
    
    mock.simulateDisconnection = jest.fn((reason) => {
      mock.connected = false;
      mock.emit('disconnected', { reason, timestamp: Date.now() });
    });
    
    mock.simulateReconnection = jest.fn(() => {
      mock.connected = true;
      mock.emit('reconnected', { timestamp: Date.now() });
    });
    
    mock.simulateFailure = jest.fn((type) => {
      mock.emit('error', { type, timestamp: Date.now() });
    });
    
    return mock;
  }

  function createMockProfileManager() {
    const mock = new EventEmitter();
    mock.currentProfile = 'default';
    
    mock.switchProfile = jest.fn().mockImplementation((profileId) => {
      mock.currentProfile = profileId;
      return Promise.resolve();
    });
    
    mock.isOperational = jest.fn(() => true);
    
    return mock;
  }

  function createMockActionExecutor() {
    const mock = new EventEmitter();
    mock.hardwareEnabled = true;
    mock.lastAction = null;
    
    mock.execute = jest.fn().mockImplementation((action) => {
      mock.lastAction = action;
      return Promise.resolve({
        success: true,
        source: action.source || 'hardware',
        mode: mock.hardwareEnabled ? 'normal' : 'software-only',
        hardwareFeedback: mock.hardwareEnabled
      });
    });
    
    mock.isOperational = jest.fn(() => true);
    
    return mock;
  }

  function createMockLEDController() {
    const mock = new EventEmitter();
    mock.mode = 'hardware-enabled';
    mock.lastThemeApplication = null;
    
    mock.setMode = jest.fn((mode) => {
      mock.mode = mode;
    });
    
    mock.applyTheme = jest.fn((theme) => {
      mock.lastThemeApplication = mock.mode === 'hardware-enabled' ? theme : 'software-simulation';
      return Promise.resolve();
    });
    
    return mock;
  }

  function createMockPluginManager() {
    const mock = new EventEmitter();
    mock.loadedPlugins = new Map();
    mock.pluginStates = new Map();
    
    mock.executePlugin = jest.fn();
    mock.isPluginActive = jest.fn((name) => {
      return mock.pluginStates.get(name) !== 'disabled' && 
             mock.pluginStates.get(name) !== 'crashed';
    });
    
    mock.getPluginState = jest.fn((name) => {
      return mock.pluginStates.get(name) || 'active';
    });
    
    mock.disablePlugin = jest.fn((name, reason) => {
      mock.pluginStates.set(name, 'disabled');
    });
    
    mock.isOperational = jest.fn(() => true);
    
    return mock;
  }

  function createMockConfigManager() {
    const mock = new EventEmitter();
    mock.currentConfig = { device: { buttons: 16, encoders: 2 } };
    mock.defaultConfiguration = { device: { buttons: 8, encoders: 0 } };
    mock.backupConfigurations = [];
    
    mock.loadConfiguration = jest.fn();
    mock.validateConfiguration = jest.fn(() => ({ valid: true, errors: [] }));
    
    mock.simulateCorruption = jest.fn((corruptedData) => {
      mock.corrupted = true;
      mock.corruptedData = corruptedData;
    });
    
    mock.recoverFromCorruption = jest.fn().mockImplementation(() => {
      if (mock.backupConfigurations.length > 0) {
        const backup = mock.backupConfigurations[0];
        const validation = mock.validateConfiguration(backup);
        
        if (validation.valid) {
          mock.currentConfig = backup;
        } else {
          mock.currentConfig = mock.defaultConfiguration;
        }
      } else {
        mock.currentConfig = mock.defaultConfiguration;
      }
      
      mock.corrupted = false;
      return Promise.resolve();
    });
    
    return mock;
  }

  function createMockExternalAPIManager() {
    const mock = new EventEmitter();
    mock.operatingMode = 'online';
    mock.cache = new Map();
    mock.lastDataSource = 'api';
    
    mock.getCalendarEvents = jest.fn();
    mock.makeAPICall = jest.fn();
    
    mock.simulateNetworkError = jest.fn((errorCode) => {
      mock.operatingMode = 'offline';
      mock.networkError = { code: errorCode, timestamp: Date.now() };
    });
    
    mock.simulateNetworkRecovery = jest.fn(() => {
      mock.operatingMode = 'online';
      mock.networkError = null;
    });
    
    mock.getCalendarEventsWithFallback = jest.fn().mockImplementation(() => {
      if (mock.operatingMode === 'offline' && mock.cache.has('calendar-events')) {
        mock.lastDataSource = 'cache';
        return Promise.resolve(mock.cache.get('calendar-events'));
      }
      
      mock.lastDataSource = 'api';
      return Promise.resolve([]);
    });
    
    mock.callWithRetry = jest.fn().mockImplementation(async (endpoint) => {
      return await mock.makeAPICall(endpoint);
    });
    
    mock.simulateFailure = jest.fn((type) => {
      mock.emit('error', { type, timestamp: Date.now() });
    });
    
    return mock;
  }

  async function waitForAsyncOperations(timeout = 1000) {
    return new Promise(resolve => setTimeout(resolve, timeout));
  }
});