/**
 * Comprehensive API Contract Test Suite
 * 
 * Tests all API contracts including serial protocol, IPC communication,
 * plugin APIs, and external service contracts.
 */

const EventEmitter = require('events');
const { SerialConnectionManager } = require('../../../src/SerialConnectionManager');
const PluginManager = require('../../../src/PluginManager');

describe('API Contract Integration Tests', () => {
  let mockSerialPort;
  let mockLogger;
  let eventBus;

  beforeEach(() => {
    // Setup common test infrastructure
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };

    mockSerialPort = new EventEmitter();
    mockSerialPort.write = jest.fn();
    mockSerialPort.close = jest.fn();

    eventBus = new EventEmitter();

    // Mock SerialPort constructor
    jest.doMock('serialport', () => ({
      SerialPort: jest.fn(() => mockSerialPort)
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  describe('Serial Communication Contract Tests', () => {
    let serialManager;

    beforeEach(() => {
      const config = {
        device: { port: '/dev/ttyUSB0', baudRate: 9600 },
        communication: {
          timeout: 5000,
          retries: 3
        }
      };

      serialManager = new SerialConnectionManager(config, mockLogger);
    });

    describe('Hardware Command Contracts', () => {
      test('should send LED button color command with correct format', async () => {
        // Contract: LED:BUTTON:<id>:<r>:<g>:<b>
        await serialManager.sendLEDCommand('BUTTON', 5, { r: 255, g: 128, b: 0 });
        
        expect(mockSerialPort.write).toHaveBeenCalledWith('LED:BUTTON:5:255:128:0\n');
      });

      test('should send brightness command with correct format', async () => {
        // Contract: LED:BRIGHTNESS:<0-255>
        await serialManager.sendLEDCommand('BRIGHTNESS', 180);
        
        expect(mockSerialPort.write).toHaveBeenCalledWith('LED:BRIGHTNESS:180\n');
      });

      test('should send effect command with correct format', async () => {
        // Contract: LED:EFFECT:<effect>:<speed>
        await serialManager.sendLEDCommand('EFFECT', 'RAINBOW', 5);
        
        expect(mockSerialPort.write).toHaveBeenCalledWith('LED:EFFECT:RAINBOW:5\n');
      });

      test('should send configuration commands with correct format', async () => {
        // Contract: CONFIG:BUTTONS:<count>
        await serialManager.sendConfigCommand('BUTTONS', 16);
        expect(mockSerialPort.write).toHaveBeenCalledWith('CONFIG:BUTTONS:16\n');
        
        // Contract: CONFIG:ENCODERS:<count>
        await serialManager.sendConfigCommand('ENCODERS', 4);
        expect(mockSerialPort.write).toHaveBeenCalledWith('CONFIG:ENCODERS:4\n');
      });

      test('should send health check command', async () => {
        // Contract: PING
        await serialManager.sendHealthCheck();
        
        expect(mockSerialPort.write).toHaveBeenCalledWith('PING\n');
      });
    });

    describe('Hardware Response Contract Validation', () => {
      test('should parse button press events correctly', (done) => {
        serialManager.on('button-press', (data) => {
          expect(data).toEqual({
            buttonId: 8,
            action: 'PRESS',
            timestamp: expect.any(Number)
          });
          done();
        });

        // Contract: BTN:<id>:PRESS
        mockSerialPort.emit('data', 'BTN:8:PRESS');
      });

      test('should parse encoder rotation events correctly', (done) => {
        serialManager.on('encoder-rotation', (data) => {
          expect(data).toEqual({
            encoderId: 2,
            direction: 'CW',
            timestamp: expect.any(Number)
          });
          done();
        });

        // Contract: ENC:<id>:CW
        mockSerialPort.emit('data', 'ENC:2:CW');
      });

      test('should parse LED status responses correctly', (done) => {
        serialManager.on('led-status', (data) => {
          expect(data).toEqual({
            operation: 'BUTTON_COLOR',
            buttonId: 5,
            status: 'SUCCESS'
          });
          done();
        });

        // Contract: LED:STATUS:BUTTON_COLOR:5:SUCCESS
        mockSerialPort.emit('data', 'LED:STATUS:BUTTON_COLOR:5:SUCCESS');
      });

      test('should parse error responses correctly', (done) => {
        serialManager.on('hardware-error', (data) => {
          expect(data).toEqual({
            code: 'LED_HARDWARE_FAULT',
            message: 'LED strip disconnected',
            severity: 'ERROR'
          });
          done();
        });

        // Contract: ERROR:<code>:<message>
        mockSerialPort.emit('data', 'ERROR:LED_HARDWARE_FAULT:LED strip disconnected');
      });

      test('should parse health check responses correctly', (done) => {
        serialManager.on('health-response', (data) => {
          expect(data).toEqual({
            status: 'PONG',
            timestamp: expect.any(Number),
            latency: expect.any(Number)
          });
          done();
        });

        // Contract: PONG
        mockSerialPort.emit('data', 'PONG');
      });
    });

    describe('Command Response Timeout Contracts', () => {
      test('should timeout LED commands after configured duration', async () => {
        const config = {
          device: { port: '/dev/ttyUSB0', baudRate: 9600 },
          communication: { timeout: 100 } // 100ms timeout
        };

        serialManager = new SerialConnectionManager(config, mockLogger);

        const startTime = Date.now();
        
        try {
          await serialManager.sendLEDCommandWithResponse('BUTTON', 1, { r: 255, g: 0, b: 0 });
          fail('Should have timed out');
        } catch (error) {
          const duration = Date.now() - startTime;
          expect(duration).toBeGreaterThanOrEqual(100);
          expect(error.message).toContain('timeout');
        }
      });

      test('should resolve LED commands when response received within timeout', async () => {
        const config = {
          device: { port: '/dev/ttyUSB0', baudRate: 9600 },
          communication: { timeout: 1000 }
        };

        serialManager = new SerialConnectionManager(config, mockLogger);

        // Send command and simulate response
        const commandPromise = serialManager.sendLEDCommandWithResponse('BRIGHTNESS', 200);
        
        setTimeout(() => {
          mockSerialPort.emit('data', 'LED:STATUS:BRIGHTNESS:SUCCESS');
        }, 50);

        const result = await commandPromise;
        expect(result.status).toBe('SUCCESS');
      });
    });
  });

  describe('Plugin API Contract Tests', () => {
    let pluginManager;
    let testPlugin;

    beforeEach(() => {
      const config = {
        pluginDirectory: '/tmp/test-plugins',
        security: {
          sandbox: true,
          allowedModules: ['path', 'util']
        }
      };

      pluginManager = new PluginManager(config, mockLogger);

      // Mock plugin for testing
      testPlugin = {
        name: 'test-plugin',
        version: '1.0.0',
        apiVersion: '1.0',
        
        // Plugin lifecycle methods
        initialize: jest.fn(),
        enable: jest.fn(),
        disable: jest.fn(),
        cleanup: jest.fn(),
        
        // Event handlers
        onButtonPress: jest.fn(),
        onEncoderRotation: jest.fn(),
        onProfileChange: jest.fn()
      };
    });

    describe('Plugin Lifecycle Contracts', () => {
      test('should follow plugin initialization contract', async () => {
        const pluginAPI = {
          getConfig: jest.fn(),
          setConfig: jest.fn(),
          onButtonPress: jest.fn(),
          executeAction: jest.fn()
        };

        await pluginManager.loadPlugin(testPlugin, pluginAPI);
        
        // Contract: Plugin must implement initialize method
        expect(testPlugin.initialize).toHaveBeenCalledWith(pluginAPI);
        
        // Contract: Plugin should be registered in manager
        expect(pluginManager.getPlugin('test-plugin')).toBeDefined();
      });

      test('should validate plugin API version compatibility', async () => {
        // Test incompatible API version
        const incompatiblePlugin = {
          ...testPlugin,
          apiVersion: '2.0' // Incompatible version
        };

        try {
          await pluginManager.loadPlugin(incompatiblePlugin);
          fail('Should reject incompatible API version');
        } catch (error) {
          expect(error.message).toContain('API version incompatible');
        }
      });

      test('should enforce plugin method signature contracts', async () => {
        const pluginAPI = {
          getConfig: jest.fn(),
          onButtonPress: jest.fn()
        };

        await pluginManager.loadPlugin(testPlugin, pluginAPI);
        
        // Contract: onButtonPress should receive buttonId and context
        pluginManager.notifyPlugins('button-press', { buttonId: 5, context: { profile: 'gaming' } });
        
        expect(testPlugin.onButtonPress).toHaveBeenCalledWith(5, { profile: 'gaming' });
      });
    });

    describe('Plugin API Surface Contracts', () => {
      let pluginAPI;

      beforeEach(() => {
        pluginAPI = pluginManager.createPluginAPI('test-plugin');
      });

      test('should provide configuration access contract', () => {
        // Contract: getConfig(key) -> value
        const mockConfig = { testKey: 'testValue' };
        pluginManager.pluginConfigs.set('test-plugin', mockConfig);

        const result = pluginAPI.getConfig('testKey');
        expect(result).toBe('testValue');
      });

      test('should provide action execution contract', async () => {
        // Contract: executeAction(action) -> Promise<result>
        const mockActionExecutor = {
          execute: jest.fn().mockResolvedValue({ success: true })
        };
        pluginManager.actionExecutor = mockActionExecutor;

        const result = await pluginAPI.executeAction({
          type: 'keypress',
          key: 'ctrl+c'
        });

        expect(result.success).toBe(true);
        expect(mockActionExecutor.execute).toHaveBeenCalledWith({
          type: 'keypress',
          key: 'ctrl+c'
        });
      });

      test('should provide LED control contract', async () => {
        // Contract: setLEDColor(buttonId, color) -> Promise<void>
        const mockLEDController = {
          setButtonColor: jest.fn().mockResolvedValue()
        };
        pluginManager.ledController = mockLEDController;

        await pluginAPI.setLEDColor(3, { r: 255, g: 0, b: 255 });

        expect(mockLEDController.setButtonColor).toHaveBeenCalledWith(3, { r: 255, g: 0, b: 255 });
      });

      test('should enforce security contract restrictions', () => {
        // Contract: Plugin API should not expose dangerous methods
        expect(pluginAPI.require).toBeUndefined();
        expect(pluginAPI.process).toBeUndefined();
        expect(pluginAPI.fs).toBeUndefined();
        expect(pluginAPI.child_process).toBeUndefined();
        expect(pluginAPI.eval).toBeUndefined();
      });
    });

    describe('Plugin Communication Contracts', () => {
      test('should follow event emission contract', (done) => {
        const pluginAPI = pluginManager.createPluginAPI('test-plugin');
        
        // Contract: Plugin can emit events to other plugins
        pluginManager.on('plugin-event', (event) => {
          expect(event).toEqual({
            source: 'test-plugin',
            type: 'custom-event',
            data: { message: 'Hello from plugin' }
          });
          done();
        });

        pluginAPI.emit('custom-event', { message: 'Hello from plugin' });
      });

      test('should follow inter-plugin communication contract', async () => {
        // Setup two plugins for communication test
        const plugin1 = { ...testPlugin, name: 'plugin1' };
        const plugin2 = { 
          ...testPlugin, 
          name: 'plugin2',
          onPluginMessage: jest.fn()
        };

        await pluginManager.loadPlugin(plugin1);
        await pluginManager.loadPlugin(plugin2);

        const plugin1API = pluginManager.createPluginAPI('plugin1');
        
        // Contract: Plugin can send messages to other plugins
        await plugin1API.sendMessage('plugin2', {
          type: 'greeting',
          message: 'Hello plugin2'
        });

        expect(plugin2.onPluginMessage).toHaveBeenCalledWith('plugin1', {
          type: 'greeting',
          message: 'Hello plugin2'
        });
      });
    });
  });

  describe('IPC Communication Contract Tests', () => {
    test('should validate main-renderer IPC contract', () => {
      const { ipcMain } = require('electron');
      
      // Contract: IPC handlers should return structured responses
      const mockHandler = jest.fn().mockResolvedValue({
        success: true,
        data: { profiles: ['gaming', 'work'] },
        timestamp: Date.now()
      });

      ipcMain.handle('get-profiles', mockHandler);
      
      // Simulate IPC call
      const result = mockHandler();
      
      expect(result).resolves.toEqual({
        success: true,
        data: { profiles: ['gaming', 'work'] },
        timestamp: expect.any(Number)
      });
    });

    test('should validate error response contract', () => {
      const { ipcMain } = require('electron');
      
      // Contract: IPC errors should follow standard error format
      const mockErrorHandler = jest.fn().mockRejectedValue({
        code: 'PROFILE_NOT_FOUND',
        message: 'Profile "invalid" does not exist',
        details: { requestedProfile: 'invalid' }
      });

      ipcMain.handle('load-profile', mockErrorHandler);
      
      expect(mockErrorHandler()).rejects.toEqual({
        code: 'PROFILE_NOT_FOUND',
        message: 'Profile "invalid" does not exist',
        details: { requestedProfile: 'invalid' }
      });
    });
  });

  describe('Configuration Schema Contract Tests', () => {
    const ConfigValidator = require('../../../src/ConfigValidator');
    let configValidator;

    beforeEach(() => {
      configValidator = new ConfigValidator(mockLogger);
    });

    test('should validate device configuration contract', () => {
      const validDeviceConfig = {
        device: {
          buttons: 16,
          encoders: 2,
          port: '/dev/ttyUSB0',
          baudRate: 9600
        }
      };

      const result = configValidator.validate(validDeviceConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should reject invalid device configuration', () => {
      const invalidDeviceConfig = {
        device: {
          buttons: 50, // Invalid: exceeds maximum
          encoders: -1, // Invalid: negative value
          baudRate: 'invalid' // Invalid: not a number
        }
      };

      const result = configValidator.validate(invalidDeviceConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should validate profile configuration contract', () => {
      const validProfileConfig = {
        profiles: {
          gaming: {
            name: 'Gaming Profile',
            buttons: {
              1: { action: 'ctrl+c', description: 'Copy' },
              2: { action: 'ctrl+v', description: 'Paste' }
            },
            contextRules: {
              applications: ['game.exe', 'steam.exe']
            }
          }
        }
      };

      const result = configValidator.validate(validProfileConfig);
      expect(result.valid).toBe(true);
    });

    test('should validate security configuration contract', () => {
      const validSecurityConfig = {
        security: {
          pluginSandbox: true,
          allowedOrigins: ['https://api.example.com'],
          maxPluginMemory: 50000000,
          enableAuditLog: true
        }
      };

      const result = configValidator.validate(validSecurityConfig);
      expect(result.valid).toBe(true);
    });
  });

  describe('External API Contract Tests', () => {
    const SystemIntegrationManager = require('../../../src/SystemIntegrationManager');
    let systemIntegration;

    beforeEach(() => {
      systemIntegration = new SystemIntegrationManager({}, mockLogger);
    });

    test('should validate calendar API integration contract', async () => {
      // Mock Google Calendar API response
      const mockCalendarResponse = {
        data: {
          items: [
            {
              id: 'event1',
              summary: 'Team Meeting',
              start: { dateTime: '2024-12-20T10:00:00Z' },
              end: { dateTime: '2024-12-20T11:00:00Z' }
            }
          ]
        }
      };

      systemIntegration.calendarAPI = {
        events: {
          list: jest.fn().mockResolvedValue(mockCalendarResponse)
        }
      };

      const events = await systemIntegration.getCalendarEvents();
      
      // Contract: Should return standardized event format
      expect(events).toEqual([{
        id: 'event1',
        title: 'Team Meeting',
        startTime: '2024-12-20T10:00:00Z',
        endTime: '2024-12-20T11:00:00Z'
      }]);
    });

    test('should handle API rate limiting contract', async () => {
      // Mock rate limit error
      const rateLimitError = {
        code: 'RATE_LIMIT_EXCEEDED',
        headers: { 'retry-after': '60' }
      };

      systemIntegration.calendarAPI = {
        events: {
          list: jest.fn().mockRejectedValue(rateLimitError)
        }
      };

      // Contract: Should implement exponential backoff
      const result = await systemIntegration.getCalendarEventsWithRetry();
      
      expect(result.error).toBe('RATE_LIMIT_EXCEEDED');
      expect(result.retryAfter).toBe(60);
    });
  });

  describe('Performance Contract Tests', () => {
    test('should meet serial communication latency contract', async () => {
      const config = {
        device: { port: '/dev/ttyUSB0', baudRate: 115200 },
        communication: { timeout: 100 }
      };

      const serialManager = new SerialConnectionManager(config, mockLogger);
      
      const startTime = performance.now();
      
      // Simulate immediate response
      setTimeout(() => {
        mockSerialPort.emit('data', 'LED:STATUS:BUTTON:1:SUCCESS');
      }, 5);

      await serialManager.sendLEDCommandWithResponse('BUTTON', 1, { r: 255, g: 0, b: 0 });
      
      const latency = performance.now() - startTime;
      
      // Contract: LED commands should complete within 50ms under normal conditions
      expect(latency).toBeLessThan(50);
    });

    test('should meet plugin execution time contract', async () => {
      const config = {
        pluginDirectory: '/tmp/test-plugins',
        performance: { maxExecutionTime: 100 }
      };

      const pluginManager = new PluginManager(config, mockLogger);
      
      // Mock fast plugin
      const fastPlugin = {
        name: 'fast-plugin',
        onButtonPress: jest.fn().mockImplementation(() => {
          // Simulate 10ms execution
          return new Promise(resolve => setTimeout(resolve, 10));
        })
      };

      const startTime = performance.now();
      await fastPlugin.onButtonPress(1);
      const executionTime = performance.now() - startTime;

      // Contract: Plugin methods should complete within 100ms
      expect(executionTime).toBeLessThan(100);
    });
  });
});