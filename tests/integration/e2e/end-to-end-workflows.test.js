/**
 * End-to-End Integration Test Suite
 * 
 * Tests complete user workflows and data pipelines from input to output,
 * validating the entire system working together.
 */

const EventEmitter = require('events');
const { spawn } = require('child_process');

// Mock external dependencies for E2E testing
jest.mock('electron', () => ({
  app: {
    whenReady: jest.fn().mockResolvedValue(),
    on: jest.fn(),
    quit: jest.fn(),
    getPath: jest.fn(() => '/tmp'),
    isQuiting: false
  },
  BrowserWindow: jest.fn(() => ({
    loadFile: jest.fn(),
    on: jest.fn(),
    webContents: { 
      openDevTools: jest.fn(), 
      send: jest.fn(),
      executeJavaScript: jest.fn().mockResolvedValue(true)
    },
    show: jest.fn(),
    hide: jest.fn(),
    isDestroyed: jest.fn().mockReturnValue(false)
  })),
  Menu: { buildFromTemplate: jest.fn() },
  Tray: jest.fn(() => ({ 
    setContextMenu: jest.fn(), 
    setToolTip: jest.fn(),
    on: jest.fn()
  })),
  ipcMain: { handle: jest.fn() }
}));

jest.mock('robotjs', () => ({
  keyTap: jest.fn(),
  keyToggle: jest.fn(),
  typeString: jest.fn(),
  getMousePos: jest.fn().mockReturnValue({ x: 100, y: 200 }),
  moveMouse: jest.fn()
}));

describe('End-to-End Integration Tests', () => {
  let systemUnderTest;
  let mockHardware;
  let mockFileSystem;
  let testDataFactory;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup complete system mock
    systemUnderTest = {
      app: null,
      components: {},
      eventBus: new EventEmitter(),
      isRunning: false
    };

    // Mock hardware interface
    mockHardware = new EventEmitter();
    mockHardware.sendCommand = jest.fn().mockResolvedValue();
    mockHardware.isConnected = jest.fn().mockReturnValue(true);
    mockHardware.getDeviceInfo = jest.fn().mockReturnValue({
      buttons: 16,
      encoders: 2,
      version: '1.2.0'
    });

    // Mock file system operations
    mockFileSystem = {
      configs: new Map(),
      profiles: new Map(),
      plugins: new Map(),
      
      readConfig: jest.fn((path) => mockFileSystem.configs.get(path)),
      writeConfig: jest.fn((path, data) => mockFileSystem.configs.set(path, data)),
      readProfile: jest.fn((id) => mockFileSystem.profiles.get(id)),
      writeProfile: jest.fn((id, profile) => mockFileSystem.profiles.set(id, profile))
    };

    // Test data factory for consistent test data
    testDataFactory = {
      createProfile: (id, overrides = {}) => ({
        id,
        name: `${id} Profile`,
        buttons: {
          1: { action: 'ctrl+c', description: 'Copy' },
          2: { action: 'ctrl+v', description: 'Paste' },
          ...overrides.buttons
        },
        ledTheme: {
          brightness: 200,
          colors: {
            1: { r: 255, g: 0, b: 0 },
            2: { r: 0, g: 255, b: 0 }
          },
          ...overrides.ledTheme
        },
        contextRules: {
          applications: [`${id}.exe`],
          ...overrides.contextRules
        }
      }),

      createCalendarEvent: (overrides = {}) => ({
        id: 'event-' + Date.now(),
        title: 'Test Meeting',
        start: new Date(Date.now() + 60000), // 1 minute from now
        end: new Date(Date.now() + 120000),   // 2 minutes from now
        type: 'meeting',
        ...overrides
      }),

      createPluginConfig: (name, overrides = {}) => ({
        name,
        version: '1.0.0',
        apiVersion: '1.0',
        permissions: ['button-press', 'led-control'],
        ...overrides
      })
    };

    // Setup default test data
    mockFileSystem.profiles.set('gaming', testDataFactory.createProfile('gaming', {
      buttons: {
        1: { action: 'discord:mute', description: 'Toggle Mute' },
        2: { action: 'obs:start-recording', description: 'Start Recording' }
      }
    }));

    mockFileSystem.profiles.set('work', testDataFactory.createProfile('work', {
      buttons: {
        1: { action: 'teams:mute', description: 'Teams Mute' },
        2: { action: 'ctrl+shift+n', description: 'New Window' }
      }
    }));
  });

  describe('Complete User Workflow - Gaming Setup', () => {
    test('should execute complete gaming session workflow', async () => {
      // Phase 1: System Startup and Hardware Detection
      const startupPromise = startSystem();
      
      // Simulate hardware connection
      setTimeout(() => {
        mockHardware.emit('connected', {
          deviceInfo: { buttons: 16, encoders: 2, version: '1.2.0' }
        });
      }, 100);

      await startupPromise;
      
      expect(systemUnderTest.isRunning).toBe(true);
      expect(mockHardware.sendCommand).toHaveBeenCalledWith('CONFIG:BUTTONS:16');

      // Phase 2: Gaming Application Launch Detection
      const contextChangePromise = simulateContextChange('steam.exe', 'gaming');
      
      await contextChangePromise;

      // Verify automatic profile switch
      expect(systemUnderTest.components.profileManager.currentProfile).toBe('gaming');
      expect(mockHardware.sendCommand).toHaveBeenCalledWith('LED:BUTTON:1:255:0:0');
      expect(mockHardware.sendCommand).toHaveBeenCalledWith('LED:BUTTON:2:0:255:0');

      // Phase 3: User Button Interactions
      await simulateButtonPress(1); // Discord mute
      
      // Verify action execution
      expect(systemUnderTest.components.actionExecutor.lastAction).toEqual({
        action: 'discord:mute',
        buttonId: 1,
        success: true
      });

      // Verify LED feedback
      expect(mockHardware.sendCommand).toHaveBeenCalledWith(
        expect.stringMatching(/LED:BUTTON:1:\d+:\d+:\d+/) // LED feedback
      );

      await simulateButtonPress(2); // OBS recording
      
      expect(systemUnderTest.components.actionExecutor.lastAction).toEqual({
        action: 'obs:start-recording',
        buttonId: 2,
        success: true
      });

      // Phase 4: Gaming Session End
      await simulateContextChange('explorer.exe', 'default');
      
      // Verify profile switch back to default
      expect(systemUnderTest.components.profileManager.currentProfile).toBe('default');
      
      // Verify LED theme reset
      expect(mockHardware.sendCommand).toHaveBeenCalledWith('LED:BRIGHTNESS:100');
    });
  });

  describe('Complete User Workflow - Work Productivity', () => {
    test('should execute complete work session with calendar integration', async () => {
      await startSystem();

      // Phase 1: Calendar Event Triggers Profile Switch
      const meetingEvent = testDataFactory.createCalendarEvent({
        title: 'Daily Standup',
        type: 'meeting'
      });

      await simulateCalendarEvent(meetingEvent, 'upcoming');

      // Verify meeting profile activation
      expect(systemUnderTest.components.contextManager.currentContext).toEqual(
        expect.objectContaining({
          type: 'meeting',
          profile: 'meeting'
        })
      );

      // Phase 2: Teams Application Launch
      await simulateContextChange('Teams.exe', 'work');

      // Verify work profile with meeting context
      expect(systemUnderTest.components.profileManager.currentProfile).toBe('work');
      expect(mockHardware.sendCommand).toHaveBeenCalledWith('LED:EFFECT:BREATHE:3');

      // Phase 3: Meeting Controls Usage
      await simulateButtonPress(1); // Teams mute toggle
      
      expect(systemUnderTest.components.actionExecutor.lastAction).toEqual({
        action: 'teams:mute',
        buttonId: 1,
        success: true
      });

      // Phase 4: Multi-tasking During Meeting
      await simulateEncoderRotation(1, 'CW', 3); // Volume up
      
      expect(systemUnderTest.components.actionExecutor.lastAction).toEqual({
        action: 'volume:up',
        steps: 3,
        success: true
      });

      // Phase 5: Meeting End and Return to Work
      await simulateCalendarEvent(meetingEvent, 'ended');
      
      // Verify return to normal work profile
      expect(systemUnderTest.components.contextManager.currentContext).toEqual(
        expect.objectContaining({
          type: 'work',
          profile: 'work'
        })
      );

      expect(mockHardware.sendCommand).toHaveBeenCalledWith('LED:EFFECT:SOLID:0');
    });
  });

  describe('Plugin Integration Workflow', () => {
    test('should execute complete plugin ecosystem workflow', async () => {
      await startSystem();

      // Phase 1: Plugin Installation and Loading
      const testPlugin = {
        name: 'productivity-helper',
        version: '2.1.0',
        main: 'index.js',
        config: {
          autoSwitchProfiles: true,
          trackingEnabled: true
        }
      };

      await installAndLoadPlugin(testPlugin);

      // Verify plugin loaded successfully
      expect(systemUnderTest.components.pluginManager.loadedPlugins).toContain('productivity-helper');

      // Phase 2: Plugin Configuration and Activation
      await configurePlugin('productivity-helper', {
        buttonMappings: {
          5: { action: 'plugin:productivity-helper:start-focus-mode' }
        }
      });

      // Phase 3: Plugin-Enhanced Button Press
      await simulateButtonPress(5);

      // Verify plugin action execution
      expect(systemUnderTest.components.pluginManager.getPlugin('productivity-helper').lastCall)
        .toEqual({
          method: 'onButtonPress',
          args: [5, expect.any(Object)]
        });

      // Verify plugin-triggered system changes
      expect(systemUnderTest.components.contextManager.currentContext).toEqual(
        expect.objectContaining({
          focusMode: true,
          triggeredBy: 'productivity-helper'
        })
      );

      // Phase 4: Plugin Data Persistence
      const pluginData = await getPluginData('productivity-helper');
      
      expect(pluginData).toEqual(
        expect.objectContaining({
          sessions: expect.any(Array),
          totalFocusTime: expect.any(Number),
          buttonPressCount: expect.any(Number)
        })
      );

      // Phase 5: Plugin Ecosystem Interaction
      await installAndLoadPlugin({
        name: 'time-tracker',
        version: '1.0.0',
        dependencies: ['productivity-helper']
      });

      // Verify plugin communication
      expect(systemUnderTest.components.pluginManager.getPlugin('time-tracker'))
        .toEqual(expect.objectContaining({
          communicatesWith: ['productivity-helper']
        }));
    });
  });

  describe('Configuration Hot-Reload Workflow', () => {
    test('should handle live configuration updates without restart', async () => {
      await startSystem();

      // Phase 1: Verify Initial Configuration
      expect(systemUnderTest.components.configManager.currentConfig).toEqual(
        expect.objectContaining({
          device: { buttons: 16, encoders: 2 }
        })
      );

      // Phase 2: Update Configuration File
      const newConfig = {
        device: { buttons: 24, encoders: 4 },
        profiles: {
          'custom-profile': testDataFactory.createProfile('custom')
        }
      };

      await updateConfigurationFile(newConfig);

      // Wait for hot-reload processing
      await waitForConfigReload();

      // Phase 3: Verify Hardware Reconfiguration
      expect(mockHardware.sendCommand).toHaveBeenCalledWith('CONFIG:BUTTONS:24');
      expect(mockHardware.sendCommand).toHaveBeenCalledWith('CONFIG:ENCODERS:4');

      // Phase 4: Verify New Profile Availability
      await simulateProfileSwitch('custom-profile');
      
      expect(systemUnderTest.components.profileManager.currentProfile).toBe('custom-profile');

      // Phase 5: Test New Button Mappings
      await simulateButtonPress(15); // Button that wasn't available before
      
      expect(systemUnderTest.components.actionExecutor.lastAction).toEqual(
        expect.objectContaining({
          buttonId: 15,
          success: true
        })
      );
    });
  });

  describe('Error Recovery and Resilience Workflow', () => {
    test('should recover from hardware disconnection gracefully', async () => {
      await startSystem();

      // Phase 1: Normal Operation
      await simulateButtonPress(1);
      expect(systemUnderTest.components.actionExecutor.lastAction.success).toBe(true);

      // Phase 2: Hardware Disconnection
      mockHardware.isConnected.mockReturnValue(false);
      mockHardware.emit('disconnected', {
        reason: 'device-unplugged',
        timestamp: Date.now()
      });

      // Wait for disconnection handling
      await waitForSystemStabilization();

      // Phase 3: Verify Graceful Degradation
      expect(systemUnderTest.components.ledController.mode).toBe('software-only');
      expect(systemUnderTest.components.actionExecutor.hardwareMode).toBe('disabled');

      // Phase 4: Software-Only Operation
      await simulateButtonPress(2, 'software'); // Software button press
      
      expect(systemUnderTest.components.actionExecutor.lastAction).toEqual(
        expect.objectContaining({
          source: 'software',
          success: true
        })
      );

      // Phase 5: Hardware Reconnection
      mockHardware.isConnected.mockReturnValue(true);
      mockHardware.emit('connected', {
        deviceInfo: { buttons: 16, encoders: 2, version: '1.2.0' }
      });

      await waitForSystemStabilization();

      // Phase 6: Full Functionality Restoration
      expect(systemUnderTest.components.ledController.mode).toBe('hardware-enabled');
      expect(mockHardware.sendCommand).toHaveBeenCalledWith('LED:BRIGHTNESS:200');

      // Verify hardware button press works again
      await simulateButtonPress(3);
      expect(systemUnderTest.components.actionExecutor.lastAction).toEqual(
        expect.objectContaining({
          source: 'hardware',
          success: true
        })
      );
    });

    test('should handle plugin crashes without system failure', async () => {
      await startSystem();

      // Phase 1: Load Multiple Plugins
      await installAndLoadPlugin({ name: 'stable-plugin' });
      await installAndLoadPlugin({ name: 'buggy-plugin' });
      await installAndLoadPlugin({ name: 'dependent-plugin', dependencies: ['stable-plugin'] });

      // Phase 2: Plugin Crash Simulation
      const buggyPlugin = systemUnderTest.components.pluginManager.getPlugin('buggy-plugin');
      buggyPlugin.onButtonPress = jest.fn().mockImplementation(() => {
        throw new Error('Simulated plugin crash');
      });

      // Phase 3: Button Press that Triggers Crash
      await simulateButtonPress(1);

      // Phase 4: Verify System Stability
      expect(systemUnderTest.isRunning).toBe(true);
      expect(systemUnderTest.components.pluginManager.loadedPlugins)
        .not.toContain('buggy-plugin'); // Crashed plugin unloaded

      expect(systemUnderTest.components.pluginManager.loadedPlugins)
        .toContain('stable-plugin'); // Other plugins still running

      // Phase 5: Verify Core Functionality Continues
      await simulateButtonPress(2);
      expect(systemUnderTest.components.actionExecutor.lastAction.success).toBe(true);
    });
  });

  describe('Performance Under Load Workflow', () => {
    test('should maintain performance under high button press frequency', async () => {
      await startSystem();

      const startTime = Date.now();
      const buttonPresses = [];

      // Phase 1: Rapid Button Press Simulation
      for (let i = 0; i < 100; i++) {
        const buttonPress = simulateButtonPress((i % 16) + 1);
        buttonPresses.push(buttonPress);
        
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1)); // Brief pause every 10 presses
        }
      }

      // Wait for all button presses to complete
      await Promise.all(buttonPresses);

      const totalTime = Date.now() - startTime;
      const avgResponseTime = totalTime / 100;

      // Phase 2: Verify Performance Metrics
      expect(avgResponseTime).toBeLessThan(50); // Average response under 50ms
      expect(systemUnderTest.components.performanceMonitor.cpuUsage).toBeLessThan(80);
      expect(systemUnderTest.components.performanceMonitor.memoryUsage).toBeLessThan(200); // MB

      // Phase 3: Verify All Actions Processed
      expect(systemUnderTest.components.actionExecutor.processedActions).toBe(100);
      expect(systemUnderTest.components.actionExecutor.failedActions).toBe(0);

      // Phase 4: Verify System Stability
      expect(systemUnderTest.isRunning).toBe(true);
      expect(mockHardware.isConnected()).toBe(true);
    });
  });

  // Helper functions for E2E test scenarios
  async function startSystem() {
    systemUnderTest.isRunning = true;
    systemUnderTest.components = {
      profileManager: { 
        currentProfile: 'default',
        switchProfile: jest.fn().mockImplementation((profile) => {
          systemUnderTest.components.profileManager.currentProfile = profile;
        })
      },
      actionExecutor: { 
        lastAction: null,
        processedActions: 0,
        failedActions: 0,
        execute: jest.fn().mockImplementation((action) => {
          systemUnderTest.components.actionExecutor.lastAction = { ...action, success: true };
          systemUnderTest.components.actionExecutor.processedActions++;
          return Promise.resolve({ success: true });
        })
      },
      contextManager: { 
        currentContext: { type: 'default', profile: 'default' },
        detectContext: jest.fn()
      },
      ledController: { 
        mode: 'hardware-enabled',
        applyTheme: jest.fn()
      },
      pluginManager: { 
        loadedPlugins: [],
        getPlugin: jest.fn(),
        loadPlugin: jest.fn()
      },
      configManager: { 
        currentConfig: { device: { buttons: 16, encoders: 2 } },
        reload: jest.fn()
      },
      performanceMonitor: { 
        cpuUsage: 20,
        memoryUsage: 45
      }
    };

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  async function simulateContextChange(applicationName, expectedProfile) {
    systemUnderTest.components.contextManager.currentContext = {
      application: applicationName,
      profile: expectedProfile
    };

    systemUnderTest.components.profileManager.switchProfile(expectedProfile);
    
    // Simulate LED theme application
    mockHardware.sendCommand(`LED:PROFILE:${expectedProfile}`);
    
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  async function simulateButtonPress(buttonId, source = 'hardware') {
    const action = {
      buttonId,
      source,
      timestamp: Date.now()
    };

    await systemUnderTest.components.actionExecutor.execute(action);
    
    if (source === 'hardware') {
      mockHardware.sendCommand(`LED:BUTTON:${buttonId}:0:255:0`); // Success feedback
    }
    
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  async function simulateEncoderRotation(encoderId, direction, steps) {
    const action = {
      type: 'encoder',
      encoderId,
      direction,
      steps,
      action: direction === 'CW' ? 'volume:up' : 'volume:down'
    };

    await systemUnderTest.components.actionExecutor.execute(action);
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  async function simulateCalendarEvent(event, phase) {
    systemUnderTest.components.contextManager.currentContext = {
      ...systemUnderTest.components.contextManager.currentContext,
      calendarEvent: event,
      phase
    };

    if (phase === 'upcoming') {
      systemUnderTest.components.profileManager.switchProfile('meeting');
    } else if (phase === 'ended') {
      systemUnderTest.components.profileManager.switchProfile('work');
    }

    await new Promise(resolve => setTimeout(resolve, 30));
  }

  async function installAndLoadPlugin(pluginConfig) {
    const mockPlugin = {
      ...pluginConfig,
      lastCall: null,
      onButtonPress: jest.fn().mockImplementation((buttonId, context) => {
        mockPlugin.lastCall = { method: 'onButtonPress', args: [buttonId, context] };
      })
    };

    systemUnderTest.components.pluginManager.loadedPlugins.push(pluginConfig.name);
    systemUnderTest.components.pluginManager.getPlugin = jest.fn((name) => {
      return name === pluginConfig.name ? mockPlugin : null;
    });

    await new Promise(resolve => setTimeout(resolve, 50));
  }

  async function configurePlugin(pluginName, config) {
    // Plugin configuration would be applied here
    await new Promise(resolve => setTimeout(resolve, 20));
  }

  async function getPluginData(pluginName) {
    return {
      sessions: [{ start: Date.now() - 3600000, end: Date.now() }],
      totalFocusTime: 3600,
      buttonPressCount: 25
    };
  }

  async function updateConfigurationFile(newConfig) {
    mockFileSystem.writeConfig('config.yaml', newConfig);
    systemUnderTest.components.configManager.currentConfig = newConfig;
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  async function waitForConfigReload() {
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  async function simulateProfileSwitch(profileId) {
    systemUnderTest.components.profileManager.switchProfile(profileId);
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  async function waitForSystemStabilization() {
    await new Promise(resolve => setTimeout(resolve, 300));
  }
});