/**
 * System Integration Workflow Integration Test
 * 
 * Tests the complete workflow from hardware input to system integration:
 * - Global shortcuts registration and execution
 * - Clipboard monitoring and management workflow
 * - Window management and application integration workflow  
 * - System state monitoring and automation workflow
 * - Cross-platform feature compatibility
 */

const { jest, describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } = require('@jest/globals');
const EventEmitter = require('events');

// Mock Electron modules
const mockElectron = {
  app: new EventEmitter(),
  BrowserWindow: jest.fn(() => ({
    webContents: {
      send: jest.fn()
    },
    isDestroyed: jest.fn(() => false)
  })),
  globalShortcut: {
    register: jest.fn(),
    unregister: jest.fn(),
    unregisterAll: jest.fn(),
    isRegistered: jest.fn()
  },
  clipboard: {
    readText: jest.fn(),
    writeText: jest.fn()
  },
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn()
  }
};

jest.mock('electron', () => mockElectron);

const SystemIntegrationManager = require('../src/SystemIntegrationManager');

describe('System Integration Workflow Integration Tests', () => {
  let systemIntegrationManager;
  let mockLogger;
  let mockMainWindow;

  beforeAll(() => {
    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    // Create mock main window
    mockMainWindow = new mockElectron.BrowserWindow();
  });

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Reset electron mocks
    mockElectron.globalShortcut.register.mockReturnValue(true);
    mockElectron.globalShortcut.isRegistered.mockReturnValue(false);
    mockElectron.clipboard.readText.mockReturnValue('');

    // Create and initialize system integration manager
    systemIntegrationManager = new SystemIntegrationManager(mockLogger);
    await systemIntegrationManager.initialize();
  });

  afterEach(() => {
    if (systemIntegrationManager && systemIntegrationManager.isInitialized) {
      systemIntegrationManager.cleanup();
    }
  });

  describe('Global Shortcut Workflow', () => {
    test('should complete full shortcut registration and execution workflow', async () => {
      // Step 1: Register a global shortcut with macro action
      const shortcut = 'CommandOrControl+Shift+M';
      const macroAction = jest.fn().mockResolvedValue({ success: true });
      const metadata = { 
        name: 'Open Macro Manager',
        category: 'application',
        description: 'Opens the macro keyboard manager'
      };

      systemIntegrationManager.registerGlobalShortcut(shortcut, macroAction, metadata);

      expect(mockElectron.globalShortcut.register).toHaveBeenCalledWith(
        shortcut,
        expect.any(Function)
      );
      expect(systemIntegrationManager.registeredShortcuts.has(shortcut)).toBe(true);

      // Step 2: Simulate shortcut trigger
      const registerCall = mockElectron.globalShortcut.register.mock.calls[0];
      const shortcutCallback = registerCall[1];

      const shortcutTriggeredPromise = new Promise((resolve) => {
        systemIntegrationManager.on('shortcut-triggered', resolve);
      });

      await shortcutCallback();

      // Step 3: Verify shortcut execution workflow
      expect(macroAction).toHaveBeenCalledWith(
        expect.objectContaining({
          shortcut,
          metadata,
          timestamp: expect.any(Date),
          systemState: expect.any(Object)
        })
      );

      const shortcutEvent = await shortcutTriggeredPromise;
      expect(shortcutEvent.shortcut).toBe(shortcut);
      expect(shortcutEvent.metadata).toBe(metadata);

      // Step 4: Test shortcut unregistration workflow
      systemIntegrationManager.unregisterGlobalShortcut(shortcut);
      
      expect(mockElectron.globalShortcut.unregister).toHaveBeenCalledWith(shortcut);
      expect(systemIntegrationManager.registeredShortcuts.has(shortcut)).toBe(false);
    });

    test('should handle shortcut conflicts and priority workflow', async () => {
      const shortcut = 'CommandOrControl+Shift+T';
      const action1 = jest.fn();
      const action2 = jest.fn();

      // Register first shortcut
      systemIntegrationManager.registerGlobalShortcut(shortcut, action1);

      // Attempt to register conflicting shortcut
      expect(() => {
        systemIntegrationManager.registerGlobalShortcut(shortcut, action2);
      }).toThrow('Shortcut CommandOrControl+Shift+T already registered');

      // Verify only first shortcut is registered
      expect(systemIntegrationManager.registeredShortcuts.get(shortcut).action).toBe(action1);
    });
  });

  describe('Clipboard Management Workflow', () => {
    test('should complete full clipboard monitoring and management workflow', async () => {
      // Step 1: Start clipboard monitoring
      systemIntegrationManager.startClipboardWatcher();

      // Step 2: Simulate clipboard content changes
      const clipboardChanges = [
        'https://github.com/example/repo',
        'user@example.com',
        '{"name": "test", "value": 42}',
        'Multi-line\ntext content'
      ];

      const clipboardEvents = [];
      systemIntegrationManager.on('clipboard-changed', (data) => {
        clipboardEvents.push(data);
      });

      // Step 3: Process each clipboard change
      for (let i = 0; i < clipboardChanges.length; i++) {
        const newContent = clipboardChanges[i];
        const oldContent = i > 0 ? clipboardChanges[i - 1] : '';
        
        systemIntegrationManager.handleClipboardChange(newContent, oldContent);
      }

      // Step 4: Verify clipboard history and content type detection
      const history = systemIntegrationManager.getClipboardHistory();
      
      expect(history).toHaveLength(4);
      expect(history[0].content).toBe('Multi-line\ntext content');
      expect(history[0].type).toBe('multiline-text');
      
      expect(history[1].content).toBe('{"name": "test", "value": 42}');
      expect(history[1].type).toBe('json');
      
      expect(history[2].content).toBe('user@example.com');
      expect(history[2].type).toBe('email');
      
      expect(history[3].content).toBe('https://github.com/example/repo');
      expect(history[3].type).toBe('url');

      // Step 5: Test programmatic clipboard setting workflow
      const newContent = 'Programmatically set content';
      const metadata = { source: 'macro-keyboard', action: 'paste-template' };

      systemIntegrationManager.setClipboardContent(newContent, metadata);

      expect(mockElectron.clipboard.writeText).toHaveBeenCalledWith(newContent);
      
      const updatedHistory = systemIntegrationManager.getClipboardHistory(1);
      expect(updatedHistory[0].content).toBe(newContent);
      expect(updatedHistory[0].metadata).toEqual(metadata);
    });

    test('should handle clipboard history size limits workflow', () => {
      // Add items beyond the limit
      for (let i = 0; i < 150; i++) {
        systemIntegrationManager.setClipboardContent(`Content ${i}`, { index: i });
      }

      const history = systemIntegrationManager.getClipboardHistory(200);
      expect(history).toHaveLength(100); // Should be limited to 100

      // Verify most recent items are preserved
      expect(history[0].content).toBe('Content 149');
      expect(history[99].content).toBe('Content 50');
    });
  });

  describe('Window Management Workflow', () => {
    test('should complete application focus tracking workflow', async () => {
      const windowEvents = [];
      systemIntegrationManager.on('window-focus-changed', (data) => {
        windowEvents.push(data);
      });

      // Step 1: Mock sequence of application focus changes
      const applications = [
        { title: 'Visual Studio Code', processName: 'code' },
        { title: 'Google Chrome', processName: 'chrome' },
        { title: 'Terminal', processName: 'terminal' }
      ];

      // Step 2: Simulate application focus changes
      for (let i = 0; i < applications.length; i++) {
        const currentApp = applications[i];
        const previousApp = i > 0 ? applications[i - 1].title : null;
        
        systemIntegrationManager.focusedApplication = previousApp;
        
        // Simulate window focus change
        systemIntegrationManager.emit('window-focus-changed', {
          previous: previousApp,
          current: currentApp.title,
          windowInfo: currentApp
        });
      }

      // Step 3: Verify focus change tracking
      expect(windowEvents).toHaveLength(3);
      expect(windowEvents[0].current).toBe('Visual Studio Code');
      expect(windowEvents[1].previous).toBe('Visual Studio Code');
      expect(windowEvents[1].current).toBe('Google Chrome');
      expect(windowEvents[2].previous).toBe('Google Chrome');
      expect(windowEvents[2].current).toBe('Terminal');
    });

    test('should handle application-specific integration workflow', () => {
      // Step 1: Set up application-specific configurations
      const vscodeConfig = {
        shortcuts: {
          'CommandOrControl+Shift+P': 'command-palette',
          'CommandOrControl+Shift+T': 'reopen-tab'
        },
        automation: {
          'window-focus': 'load-development-profile',
          'file-save': 'run-formatter'
        }
      };

      const chromeConfig = {
        shortcuts: {
          'CommandOrControl+Shift+I': 'toggle-devtools',
          'CommandOrControl+T': 'new-tab'
        },
        automation: {
          'tab-switch': 'update-browsing-context'
        }
      };

      systemIntegrationManager.appIntegrations.set('Visual Studio Code', vscodeConfig);
      systemIntegrationManager.appIntegrations.set('Google Chrome', chromeConfig);

      // Step 2: Verify application integrations are stored correctly
      expect(systemIntegrationManager.appIntegrations.get('Visual Studio Code')).toBe(vscodeConfig);
      expect(systemIntegrationManager.appIntegrations.get('Google Chrome')).toBe(chromeConfig);

      // Step 3: Test integration retrieval for focused application
      systemIntegrationManager.focusedApplication = 'Visual Studio Code';
      const activeIntegration = systemIntegrationManager.appIntegrations.get(
        systemIntegrationManager.focusedApplication
      );
      
      expect(activeIntegration).toBe(vscodeConfig);
      expect(activeIntegration.shortcuts['CommandOrControl+Shift+P']).toBe('command-palette');
    });
  });

  describe('System State Monitoring Workflow', () => {
    test('should complete system state monitoring and alerting workflow', async () => {
      const systemStateEvents = [];
      systemIntegrationManager.on('system-state-changed', (data) => {
        systemStateEvents.push(data);
      });

      // Step 1: Set initial system state
      const initialState = {
        memoryUsage: 45,
        systemMemoryUsage: 60,
        cpuUsage: 20,
        networkStatus: 'connected',
        timestamp: new Date()
      };
      systemIntegrationManager.systemState = initialState;

      // Step 2: Simulate system state changes that trigger alerts
      const stateChanges = [
        { ...initialState, memoryUsage: 70 }, // Memory spike (+25%)
        { ...initialState, cpuUsage: 50 },    // CPU spike (+30%)
        { ...initialState, networkStatus: 'disconnected' }, // Network change
        { ...initialState, memoryUsage: 47 }  // Minor change (shouldn't trigger)
      ];

      // Step 3: Process each state change
      for (const newState of stateChanges) {
        const hasChanges = systemIntegrationManager.detectSystemStateChanges(newState);
        
        if (hasChanges) {
          const oldState = { ...systemIntegrationManager.systemState };
          systemIntegrationManager.systemState = { ...newState };
          
          systemIntegrationManager.emit('system-state-changed', {
            oldState,
            newState: systemIntegrationManager.systemState
          });
        }
      }

      // Step 4: Verify only significant changes triggered events
      expect(systemStateEvents).toHaveLength(3); // Should exclude the minor memory change
      
      expect(systemStateEvents[0].newState.memoryUsage).toBe(70);
      expect(systemStateEvents[1].newState.cpuUsage).toBe(50);
      expect(systemStateEvents[2].newState.networkStatus).toBe('disconnected');
    });

    test('should gather comprehensive system state information', async () => {
      const systemState = await systemIntegrationManager.gatherSystemState();

      // Verify all required state properties are present
      expect(systemState).toHaveProperty('timestamp');
      expect(systemState).toHaveProperty('idleTime');
      expect(systemState).toHaveProperty('batteryLevel');
      expect(systemState).toHaveProperty('networkStatus');
      expect(systemState).toHaveProperty('cpuUsage');
      expect(systemState).toHaveProperty('memoryUsage');
      expect(systemState).toHaveProperty('systemMemoryUsage');

      // Verify data types
      expect(systemState.timestamp).toBeInstanceOf(Date);
      expect(typeof systemState.memoryUsage).toBe('number');
      expect(typeof systemState.systemMemoryUsage).toBe('number');
      expect(typeof systemState.cpuUsage).toBe('number');
      
      // Verify reasonable ranges
      expect(systemState.memoryUsage).toBeGreaterThanOrEqual(0);
      expect(systemState.memoryUsage).toBeLessThanOrEqual(100);
      expect(systemState.systemMemoryUsage).toBeGreaterThanOrEqual(0);
      expect(systemState.systemMemoryUsage).toBeLessThanOrEqual(100);
    });
  });

  describe('Cross-Platform Integration Workflow', () => {
    test('should handle platform-specific feature availability', () => {
      const originalPlatform = process.platform;

      // Test macOS features
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      let manager = new SystemIntegrationManager(mockLogger);
      expect(manager.platformFeatures.applicationIntegration).toBe(true);
      expect(manager.platformFeatures.hardwareInputCapture).toBe(true);

      // Test Windows features
      Object.defineProperty(process, 'platform', { value: 'win32' });
      manager = new SystemIntegrationManager(mockLogger);
      expect(manager.platformFeatures.applicationIntegration).toBe(true);
      expect(manager.platformFeatures.hardwareInputCapture).toBe(true);

      // Test Linux features
      Object.defineProperty(process, 'platform', { value: 'linux' });
      manager = new SystemIntegrationManager(mockLogger);
      expect(manager.platformFeatures.applicationIntegration).toBe(true);
      expect(manager.platformFeatures.hardwareInputCapture).toBe(false);

      // Restore original platform
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });

  describe('Action Execution Workflow', () => {
    test('should execute complete action workflow with context', async () => {
      // Step 1: Register shortcut with complex action
      const shortcut = 'CommandOrControl+Alt+C';
      const actionSequence = [];
      
      const complexAction = async (context) => {
        actionSequence.push('action-start');
        
        // Verify context contains expected data
        expect(context.shortcut).toBe(shortcut);
        expect(context.timestamp).toBeInstanceOf(Date);
        expect(context.systemState).toBeDefined();
        
        // Simulate complex action steps
        actionSequence.push('clipboard-operation');
        systemIntegrationManager.setClipboardContent('Action result', {
          source: 'macro-shortcut',
          shortcut
        });
        
        actionSequence.push('window-operation');
        // Simulate window focus change
        systemIntegrationManager.emit('window-focus-changed', {
          previous: context.focusedApplication,
          current: 'New Application'
        });
        
        actionSequence.push('action-complete');
        return { success: true, steps: actionSequence.length };
      };

      systemIntegrationManager.registerGlobalShortcut(shortcut, complexAction, {
        name: 'Complex Workflow Action',
        category: 'workflow'
      });

      // Step 2: Execute shortcut and verify workflow
      const registerCall = mockElectron.globalShortcut.register.mock.calls[0];
      const shortcutCallback = registerCall[1];

      await shortcutCallback();

      // Step 3: Verify action execution sequence
      expect(actionSequence).toEqual([
        'action-start',
        'clipboard-operation',
        'window-operation',
        'action-complete'
      ]);

      // Step 4: Verify clipboard was updated
      expect(mockElectron.clipboard.writeText).toHaveBeenCalledWith('Action result');
      
      const history = systemIntegrationManager.getClipboardHistory(1);
      expect(history[0].metadata.source).toBe('macro-shortcut');
      expect(history[0].metadata.shortcut).toBe(shortcut);
    });

    test('should handle action execution errors gracefully', async () => {
      const shortcut = 'CommandOrControl+Shift+E';
      const failingAction = jest.fn().mockRejectedValue(new Error('Action failed'));

      systemIntegrationManager.registerGlobalShortcut(shortcut, failingAction);

      const registerCall = mockElectron.globalShortcut.register.mock.calls[0];
      const shortcutCallback = registerCall[1];

      // Execute shortcut - should not throw
      await shortcutCallback();

      expect(failingAction).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error executing shortcut action'),
        expect.any(Error)
      );
    });
  });

  describe('Complete System Integration Status Workflow', () => {
    test('should provide comprehensive system integration status', async () => {
      // Step 1: Set up complete system integration state
      systemIntegrationManager.registerGlobalShortcut('Ctrl+1', () => {}, { name: 'Test 1' });
      systemIntegrationManager.registerGlobalShortcut('Ctrl+2', () => {}, { name: 'Test 2' });
      
      systemIntegrationManager.setClipboardContent('Test content 1');
      systemIntegrationManager.setClipboardContent('Test content 2');
      systemIntegrationManager.setClipboardContent('Test content 3');
      
      systemIntegrationManager.focusedApplication = 'Test Application';
      systemIntegrationManager.systemState = {
        memoryUsage: 65,
        cpuUsage: 30,
        networkStatus: 'connected'
      };

      // Step 2: Get comprehensive status
      const status = systemIntegrationManager.getStatus();

      // Step 3: Verify status completeness
      expect(status.initialized).toBe(true);
      expect(status.platform).toBe(process.platform);
      expect(status.features).toBeDefined();
      expect(status.shortcuts).toBe(2);
      expect(status.clipboardHistory).toBe(3);
      expect(status.focusedApplication).toBe('Test Application');
      expect(status.systemState.memoryUsage).toBe(65);
      expect(status.systemState.cpuUsage).toBe(30);
      expect(status.systemState.networkStatus).toBe('connected');

      // Step 4: Verify platform features
      expect(typeof status.features.globalShortcuts).toBe('boolean');
      expect(typeof status.features.clipboardMonitoring).toBe('boolean');
      expect(typeof status.features.windowManagement).toBe('boolean');
    });
  });

  describe('Cleanup Workflow', () => {
    test('should complete comprehensive cleanup workflow', () => {
      // Step 1: Set up system integration with various components
      systemIntegrationManager.registerGlobalShortcut('Ctrl+Test1', () => {});
      systemIntegrationManager.registerGlobalShortcut('Ctrl+Test2', () => {});
      systemIntegrationManager.setClipboardContent('Test content');
      systemIntegrationManager.appIntegrations.set('TestApp', { shortcuts: {} });

      // Verify components are set up
      expect(systemIntegrationManager.registeredShortcuts.size).toBe(2);
      expect(systemIntegrationManager.clipboardHistory.length).toBe(1);
      expect(systemIntegrationManager.appIntegrations.size).toBe(1);

      // Step 2: Execute cleanup
      systemIntegrationManager.cleanup();

      // Step 3: Verify comprehensive cleanup
      expect(mockElectron.globalShortcut.unregisterAll).toHaveBeenCalled();
      expect(systemIntegrationManager.registeredShortcuts.size).toBe(0);
      expect(systemIntegrationManager.clipboardHistory).toHaveLength(0);
      expect(systemIntegrationManager.appIntegrations.size).toBe(0);
      expect(systemIntegrationManager.isInitialized).toBe(false);
      
      expect(mockLogger.info).toHaveBeenCalledWith('SystemIntegrationManager cleanup complete');
    });
  });
});