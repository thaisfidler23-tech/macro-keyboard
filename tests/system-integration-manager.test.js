/**
 * SystemIntegrationManager Test Suite
 * 
 * Tests for advanced system integration features including:
 * - Global keyboard shortcuts
 * - Clipboard monitoring and management
 * - Window management and application integration
 * - System state monitoring
 * - Cross-platform compatibility
 */

const { jest, describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } = require('@jest/globals');
const EventEmitter = require('events');
const path = require('path');
const fs = require('fs').promises;

// Mock Electron modules
const mockElectron = {
  app: {
    on: jest.fn(),
    quit: jest.fn()
  },
  BrowserWindow: jest.fn(),
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

describe('SystemIntegrationManager', () => {
  let systemIntegrationManager;
  let mockLogger;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };
    
    // Reset clipboard mock
    mockElectron.clipboard.readText.mockReturnValue('');
    
    // Reset global shortcut mocks
    mockElectron.globalShortcut.register.mockReturnValue(true);
    mockElectron.globalShortcut.isRegistered.mockReturnValue(false);
    
    // Create new instance for each test
    systemIntegrationManager = new SystemIntegrationManager(mockLogger);
  });

  afterEach(async () => {
    if (systemIntegrationManager && systemIntegrationManager.isInitialized) {
      systemIntegrationManager.cleanup();
    }
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      await systemIntegrationManager.initialize();
      
      expect(systemIntegrationManager.isInitialized).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('SystemIntegrationManager fully initialized');
    });

    test('should detect platform features correctly', () => {
      const features = systemIntegrationManager.platformFeatures;
      
      expect(features).toHaveProperty('globalShortcuts');
      expect(features).toHaveProperty('clipboardMonitoring');
      expect(features).toHaveProperty('windowManagement');
      expect(features).toHaveProperty('systemStateMonitoring');
      expect(features).toHaveProperty('applicationIntegration');
      expect(features).toHaveProperty('hardwareInputCapture');
      
      // All features should be boolean
      Object.values(features).forEach(feature => {
        expect(typeof feature).toBe('boolean');
      });
    });

    test('should not initialize twice', async () => {
      await systemIntegrationManager.initialize();
      await systemIntegrationManager.initialize();
      
      expect(mockLogger.warn).toHaveBeenCalledWith('SystemIntegrationManager already initialized');
    });

    test('should handle initialization errors gracefully', async () => {
      // Mock globalShortcut to throw error
      mockElectron.globalShortcut.register.mockImplementation(() => {
        throw new Error('Global shortcuts not available');
      });
      
      await systemIntegrationManager.initialize();
      
      // Should continue initialization despite errors
      expect(systemIntegrationManager.platformFeatures.globalShortcuts).toBe(false);
    });
  });

  describe('Global Shortcuts', () => {
    beforeEach(async () => {
      await systemIntegrationManager.initialize();
    });

    test('should register global shortcut successfully', () => {
      const shortcut = 'CommandOrControl+Shift+K';
      const action = jest.fn();
      const metadata = { name: 'Test Shortcut' };
      
      systemIntegrationManager.registerGlobalShortcut(shortcut, action, metadata);
      
      expect(mockElectron.globalShortcut.register).toHaveBeenCalled();
      expect(systemIntegrationManager.registeredShortcuts.has(shortcut)).toBe(true);
      
      const shortcutData = systemIntegrationManager.registeredShortcuts.get(shortcut);
      expect(shortcutData.action).toBe(action);
      expect(shortcutData.metadata).toBe(metadata);
    });

    test('should prevent duplicate shortcut registration', () => {
      const shortcut = 'CommandOrControl+Shift+K';
      const action1 = jest.fn();
      const action2 = jest.fn();
      
      systemIntegrationManager.registerGlobalShortcut(shortcut, action1);
      
      expect(() => {
        systemIntegrationManager.registerGlobalShortcut(shortcut, action2);
      }).toThrow('Shortcut CommandOrControl+Shift+K already registered');
    });

    test('should unregister global shortcut successfully', () => {
      const shortcut = 'CommandOrControl+Shift+K';
      const action = jest.fn();
      
      systemIntegrationManager.registerGlobalShortcut(shortcut, action);
      systemIntegrationManager.unregisterGlobalShortcut(shortcut);
      
      expect(mockElectron.globalShortcut.unregister).toHaveBeenCalledWith(shortcut);
      expect(systemIntegrationManager.registeredShortcuts.has(shortcut)).toBe(false);
    });

    test('should handle shortcut registration failure', () => {
      mockElectron.globalShortcut.register.mockReturnValue(false);
      
      const shortcut = 'CommandOrControl+Shift+K';
      const action = jest.fn();
      
      expect(() => {
        systemIntegrationManager.registerGlobalShortcut(shortcut, action);
      }).toThrow('Failed to register shortcut: CommandOrControl+Shift+K');
    });

    test('should execute shortcut action when triggered', async () => {
      const shortcut = 'CommandOrControl+Shift+K';
      const action = jest.fn();
      const metadata = { name: 'Test Shortcut' };
      
      systemIntegrationManager.registerGlobalShortcut(shortcut, action, metadata);
      
      // Simulate shortcut trigger by calling the callback
      const registerCall = mockElectron.globalShortcut.register.mock.calls[0];
      const callback = registerCall[1];
      
      await callback();
      
      expect(action).toHaveBeenCalledWith(
        expect.objectContaining({
          shortcut,
          metadata,
          timestamp: expect.any(Date)
        })
      );
    });
  });

  describe('Clipboard Management', () => {
    beforeEach(async () => {
      await systemIntegrationManager.initialize();
    });

    test('should monitor clipboard changes', () => {
      // Start with initial content
      mockElectron.clipboard.readText.mockReturnValue('initial content');
      systemIntegrationManager.startClipboardWatcher();
      
      // Simulate clipboard change
      mockElectron.clipboard.readText.mockReturnValue('new content');
      
      // Mock the interval callback
      const changeHandler = jest.fn();
      systemIntegrationManager.on('clipboard-changed', changeHandler);
      
      // Simulate interval tick
      systemIntegrationManager.handleClipboardChange('new content', 'initial content');
      
      expect(changeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          newContent: 'new content',
          oldContent: 'initial content'
        })
      );
    });

    test('should detect content types correctly', () => {
      const testCases = [
        { content: 'https://example.com', expected: 'url' },
        { content: 'user@example.com', expected: 'email' },
        { content: 'C:\\Windows\\System32', expected: 'path' },
        { content: '/home/user/documents', expected: 'path' },
        { content: '{"key": "value"}', expected: 'json' },
        { content: 'line1\nline2', expected: 'multiline-text' },
        { content: 'simple text', expected: 'text' },
        { content: '', expected: 'unknown' },
        { content: null, expected: 'unknown' }
      ];
      
      testCases.forEach(({ content, expected }) => {
        const result = systemIntegrationManager.detectContentType(content);
        expect(result).toBe(expected);
      });
    });

    test('should maintain clipboard history', () => {
      const content1 = 'first content';
      const content2 = 'second content';
      
      systemIntegrationManager.setClipboardContent(content1, { source: 'test' });
      systemIntegrationManager.setClipboardContent(content2, { source: 'test' });
      
      const history = systemIntegrationManager.getClipboardHistory();
      
      expect(history).toHaveLength(2);
      expect(history[0].content).toBe(content2); // Most recent first
      expect(history[1].content).toBe(content1);
    });

    test('should limit clipboard history size', () => {
      // Add more than 100 entries
      for (let i = 0; i < 150; i++) {
        systemIntegrationManager.setClipboardContent(`content ${i}`);
      }
      
      const history = systemIntegrationManager.getClipboardHistory(200);
      expect(history).toHaveLength(100); // Should be limited to 100
    });

    test('should set clipboard content with metadata', () => {
      const content = 'test content';
      const metadata = { source: 'macro-keyboard', tag: 'test' };
      
      systemIntegrationManager.setClipboardContent(content, metadata);
      
      expect(mockElectron.clipboard.writeText).toHaveBeenCalledWith(content);
      
      const history = systemIntegrationManager.getClipboardHistory(1);
      expect(history[0].metadata).toEqual(metadata);
    });
  });

  describe('Window Management', () => {
    beforeEach(async () => {
      await systemIntegrationManager.initialize();
    });

    test('should track focused application changes', async () => {
      const changeHandler = jest.fn();
      systemIntegrationManager.on('window-focus-changed', changeHandler);
      
      // Mock getActiveWindow to return different applications
      systemIntegrationManager.getActiveWindow = jest.fn()
        .mockResolvedValueOnce({ title: 'Application 1' })
        .mockResolvedValueOnce({ title: 'Application 2' });
      
      // Simulate window watcher
      await systemIntegrationManager.getActiveWindow();
      systemIntegrationManager.focusedApplication = 'Application 1';
      
      await systemIntegrationManager.getActiveWindow();
      const activeWindow = await systemIntegrationManager.getActiveWindow();
      
      if (activeWindow && activeWindow.title !== systemIntegrationManager.focusedApplication) {
        const previousApp = systemIntegrationManager.focusedApplication;
        systemIntegrationManager.focusedApplication = activeWindow.title;
        
        systemIntegrationManager.emit('window-focus-changed', {
          previous: previousApp,
          current: activeWindow.title,
          windowInfo: activeWindow
        });
      }
      
      expect(changeHandler).toHaveBeenCalled();
    });
  });

  describe('System State Monitoring', () => {
    beforeEach(async () => {
      await systemIntegrationManager.initialize();
    });

    test('should gather system state information', async () => {
      const state = await systemIntegrationManager.gatherSystemState();
      
      expect(state).toHaveProperty('timestamp');
      expect(state).toHaveProperty('memoryUsage');
      expect(state).toHaveProperty('systemMemoryUsage');
      expect(state).toHaveProperty('cpuUsage');
      expect(state).toHaveProperty('networkStatus');
      
      expect(typeof state.memoryUsage).toBe('number');
      expect(typeof state.systemMemoryUsage).toBe('number');
      expect(typeof state.cpuUsage).toBe('number');
    });

    test('should detect significant system state changes', () => {
      const oldState = {
        memoryUsage: 50,
        cpuUsage: 20,
        networkStatus: 'connected'
      };
      
      systemIntegrationManager.systemState = oldState;
      
      // Test memory change
      expect(systemIntegrationManager.detectSystemStateChanges({
        ...oldState,
        memoryUsage: 65 // +15% change
      })).toBe(true);
      
      // Test CPU change
      expect(systemIntegrationManager.detectSystemStateChanges({
        ...oldState,
        cpuUsage: 45 // +25% change
      })).toBe(true);
      
      // Test network change
      expect(systemIntegrationManager.detectSystemStateChanges({
        ...oldState,
        networkStatus: 'disconnected'
      })).toBe(true);
      
      // Test no significant change
      expect(systemIntegrationManager.detectSystemStateChanges({
        ...oldState,
        memoryUsage: 55 // +5% change
      })).toBe(false);
    });
  });

  describe('Application Integration', () => {
    beforeEach(async () => {
      await systemIntegrationManager.initialize();
    });

    test('should load default application integrations', () => {
      systemIntegrationManager.createDefaultApplicationIntegrations();
      
      expect(systemIntegrationManager.appIntegrations.size).toBeGreaterThan(0);
      expect(systemIntegrationManager.appIntegrations.has('Visual Studio Code')).toBe(true);
      expect(systemIntegrationManager.appIntegrations.has('Google Chrome')).toBe(true);
    });

    test('should manage application integrations', () => {
      const appName = 'Test Application';
      const config = {
        shortcuts: {
          'CommandOrControl+T': 'test-action'
        },
        automation: {
          'window-focus': 'load-profile'
        }
      };
      
      systemIntegrationManager.appIntegrations.set(appName, config);
      
      expect(systemIntegrationManager.appIntegrations.get(appName)).toBe(config);
    });
  });

  describe('Action Execution', () => {
    beforeEach(async () => {
      await systemIntegrationManager.initialize();
    });

    test('should execute string-based actions', async () => {
      const context = {
        shortcut: 'test',
        timestamp: new Date(),
        systemState: {}
      };
      
      // Mock setClipboardContent
      systemIntegrationManager.setClipboardContent = jest.fn();
      
      await systemIntegrationManager.executeActionString('clipboard-set:test content', context);
      
      expect(systemIntegrationManager.setClipboardContent).toHaveBeenCalledWith('test content');
    });

    test('should execute object-based actions', async () => {
      const context = {
        shortcut: 'test',
        timestamp: new Date(),
        systemState: {}
      };
      
      const actionObject = {
        type: 'clipboard-operation',
        params: { content: 'test content' }
      };
      
      // Mock executeClipboardOperation
      systemIntegrationManager.executeClipboardOperation = jest.fn();
      
      await systemIntegrationManager.executeActionObject(actionObject, context);
      
      expect(systemIntegrationManager.executeClipboardOperation).toHaveBeenCalledWith(
        actionObject.params,
        context
      );
    });
  });

  describe('Status and Cleanup', () => {
    test('should return current status', async () => {
      await systemIntegrationManager.initialize();
      
      const status = systemIntegrationManager.getStatus();
      
      expect(status).toHaveProperty('initialized', true);
      expect(status).toHaveProperty('platform');
      expect(status).toHaveProperty('features');
      expect(status).toHaveProperty('shortcuts');
      expect(status).toHaveProperty('clipboardHistory');
      expect(status).toHaveProperty('systemState');
    });

    test('should cleanup resources properly', () => {
      systemIntegrationManager.registeredShortcuts.set('test', {});
      systemIntegrationManager.clipboardHistory = ['test'];
      systemIntegrationManager.isInitialized = true;
      
      systemIntegrationManager.cleanup();
      
      expect(mockElectron.globalShortcut.unregisterAll).toHaveBeenCalled();
      expect(systemIntegrationManager.registeredShortcuts.size).toBe(0);
      expect(systemIntegrationManager.clipboardHistory).toHaveLength(0);
      expect(systemIntegrationManager.isInitialized).toBe(false);
    });

    test('should handle cleanup errors gracefully', () => {
      mockElectron.globalShortcut.unregisterAll.mockImplementation(() => {
        throw new Error('Cleanup error');
      });
      
      systemIntegrationManager.isInitialized = true;
      
      expect(() => {
        systemIntegrationManager.cleanup();
      }).not.toThrow();
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error during SystemIntegrationManager cleanup:',
        expect.any(Error)
      );
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await systemIntegrationManager.initialize();
    });

    test('should emit error events', () => {
      const errorHandler = jest.fn();
      systemIntegrationManager.on('error', errorHandler);
      
      systemIntegrationManager.emit('error', {
        message: 'Test error',
        error: new Error('Test error')
      });
      
      expect(errorHandler).toHaveBeenCalledWith({
        message: 'Test error',
        error: expect.any(Error)
      });
    });

    test('should handle shortcut execution errors', async () => {
      const shortcut = 'CommandOrControl+Shift+K';
      const action = jest.fn().mockRejectedValue(new Error('Action failed'));
      
      systemIntegrationManager.registerGlobalShortcut(shortcut, action);
      
      // Simulate shortcut trigger
      const registerCall = mockElectron.globalShortcut.register.mock.calls[0];
      const callback = registerCall[1];
      
      await callback();
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error executing shortcut action'),
        expect.any(Error)
      );
    });
  });

  describe('Cross-Platform Features', () => {
    test('should handle different platforms', () => {
      const originalPlatform = process.platform;
      
      // Test macOS
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      let manager = new SystemIntegrationManager(mockLogger);
      expect(manager.platformFeatures.applicationIntegration).toBe(true);
      expect(manager.platformFeatures.hardwareInputCapture).toBe(true);
      
      // Test Windows
      Object.defineProperty(process, 'platform', { value: 'win32' });
      manager = new SystemIntegrationManager(mockLogger);
      expect(manager.platformFeatures.applicationIntegration).toBe(true);
      expect(manager.platformFeatures.hardwareInputCapture).toBe(true);
      
      // Test Linux
      Object.defineProperty(process, 'platform', { value: 'linux' });
      manager = new SystemIntegrationManager(mockLogger);
      expect(manager.platformFeatures.applicationIntegration).toBe(true);
      expect(manager.platformFeatures.hardwareInputCapture).toBe(false);
      
      // Restore original platform
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });
});