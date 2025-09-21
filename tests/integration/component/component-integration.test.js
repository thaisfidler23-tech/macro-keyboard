/**
 * Component Integration Test Suite
 * 
 * Tests interactions between all internal application components,
 * validating data flow, event propagation, and state synchronization.
 */

const EventEmitter = require('events');
const MacroKeyboardApp = require('../../../src/main');

// Mock external dependencies
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
    webContents: { openDevTools: jest.fn(), send: jest.fn() },
    show: jest.fn(),
    hide: jest.fn()
  })),
  Menu: { buildFromTemplate: jest.fn() },
  Tray: jest.fn(() => ({ setContextMenu: jest.fn(), setToolTip: jest.fn() })),
  ipcMain: { handle: jest.fn() }
}));

jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
  })),
  format: { combine: jest.fn(), timestamp: jest.fn(), printf: jest.fn() },
  transports: { File: jest.fn(), Console: jest.fn() }
}));

jest.mock('serialport', () => ({
  SerialPort: jest.fn()
}));

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue('device:\n  buttons: 16\n  encoders: 2'),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn()
}));

jest.mock('js-yaml', () => ({
  load: jest.fn().mockReturnValue({
    device: { buttons: 16, encoders: 2 },
    profiles: { default: { name: 'Default' } }
  }),
  dump: jest.fn()
}));

describe('Component Integration Tests', () => {
  let app;
  let mockComponents;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock component dependencies
    mockComponents = {
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
      },
      serialManager: new EventEmitter(),
      profileManager: new EventEmitter(),
      actionExecutor: new EventEmitter(),
      pluginManager: new EventEmitter(),
      ledController: new EventEmitter(),
      contextManager: new EventEmitter(),
      performanceMonitor: new EventEmitter()
    };

    // Add methods to mock components
    mockComponents.serialManager.writeCommand = jest.fn().mockResolvedValue();
    mockComponents.serialManager.isConnected = jest.fn().mockReturnValue(true);
    
    mockComponents.profileManager.getCurrentProfile = jest.fn().mockReturnValue('default');
    mockComponents.profileManager.switchProfile = jest.fn().mockResolvedValue();
    mockComponents.profileManager.getProfileConfig = jest.fn().mockReturnValue({});
    
    mockComponents.actionExecutor.execute = jest.fn().mockResolvedValue({ success: true });
    
    mockComponents.pluginManager.notifyPlugins = jest.fn();
    mockComponents.pluginManager.getActivePlugins = jest.fn().mockReturnValue([]);
    
    mockComponents.ledController.setButtonColor = jest.fn().mockResolvedValue();
    mockComponents.ledController.applyProfileTheme = jest.fn().mockResolvedValue();
    
    mockComponents.contextManager.detectContext = jest.fn().mockResolvedValue({});
    mockComponents.contextManager.evaluateRules = jest.fn().mockReturnValue('gaming');
    
    mockComponents.performanceMonitor.startMeasurement = jest.fn();
    mockComponents.performanceMonitor.endMeasurement = jest.fn();
  });

  describe('Serial Manager ↔ Component Integration', () => {
    test('should propagate button press events to all dependent components', async () => {
      // Setup component integration
      const { serialManager, actionExecutor, pluginManager, ledController, performanceMonitor } = mockComponents;

      // Simulate button press from hardware
      serialManager.emit('button-press', {
        buttonId: 5,
        action: 'PRESS',
        timestamp: Date.now()
      });

      await new Promise(resolve => setImmediate(resolve));

      // Verify event propagation to action executor
      expect(actionExecutor.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          buttonId: 5,
          action: 'PRESS'
        })
      );

      // Verify plugin notification
      expect(pluginManager.notifyPlugins).toHaveBeenCalledWith(
        'button-press',
        expect.objectContaining({ buttonId: 5 })
      );

      // Verify LED feedback
      expect(ledController.setButtonColor).toHaveBeenCalled();

      // Verify performance tracking
      expect(performanceMonitor.startMeasurement).toHaveBeenCalledWith(
        'button-press-handling'
      );
    });

    test('should handle encoder rotation with context switching integration', async () => {
      const { serialManager, contextManager, profileManager, ledController } = mockComponents;

      // Setup context switching
      contextManager.evaluateRules.mockReturnValue('photo-editing');
      
      // Simulate encoder rotation
      serialManager.emit('encoder-rotation', {
        encoderId: 1,
        direction: 'CW',
        steps: 2
      });

      await new Promise(resolve => setImmediate(resolve));

      // Verify context evaluation
      expect(contextManager.evaluateRules).toHaveBeenCalled();

      // Verify profile switch
      expect(profileManager.switchProfile).toHaveBeenCalledWith('photo-editing');

      // Verify LED theme update
      expect(ledController.applyProfileTheme).toHaveBeenCalledWith('photo-editing');
    });

    test('should handle hardware disconnection across all components', async () => {
      const { serialManager, ledController, pluginManager, performanceMonitor } = mockComponents;

      // Simulate hardware disconnection
      serialManager.emit('disconnected', {
        reason: 'hardware-error',
        timestamp: Date.now()
      });

      await new Promise(resolve => setImmediate(resolve));

      // Verify LED controller handles disconnection
      expect(ledController.emit).toHaveBeenCalledWith(
        'hardware-disconnected'
      );

      // Verify plugins are notified
      expect(pluginManager.notifyPlugins).toHaveBeenCalledWith(
        'hardware-disconnected',
        expect.any(Object)
      );

      // Verify performance monitoring continues
      expect(performanceMonitor.startMeasurement).toHaveBeenCalledWith(
        'reconnection-attempt'
      );
    });
  });

  describe('Profile Manager ↔ Component Integration', () => {
    test('should synchronize profile changes across all components', async () => {
      const { profileManager, ledController, actionExecutor, pluginManager, contextManager } = mockComponents;

      const newProfile = {
        id: 'streaming',
        name: 'Streaming Setup',
        buttons: {
          1: { action: 'obs:start-recording' },
          2: { action: 'obs:stop-recording' }
        },
        ledTheme: {
          1: { r: 255, g: 0, b: 0 },
          2: { r: 0, g: 255, b: 0 }
        }
      };

      profileManager.getProfileConfig.mockReturnValue(newProfile);

      // Simulate profile change
      profileManager.emit('profile-changed', {
        oldProfile: 'default',
        newProfile: 'streaming',
        config: newProfile
      });

      await new Promise(resolve => setImmediate(resolve));

      // Verify LED theme application
      expect(ledController.applyProfileTheme).toHaveBeenCalledWith('streaming');

      // Verify action executor receives new button mappings
      expect(actionExecutor.emit).toHaveBeenCalledWith(
        'config-updated',
        expect.objectContaining({
          buttons: newProfile.buttons
        })
      );

      // Verify plugins are notified
      expect(pluginManager.notifyPlugins).toHaveBeenCalledWith(
        'profile-changed',
        expect.objectContaining({
          newProfile: 'streaming'
        })
      );

      // Verify context manager updates rules
      expect(contextManager.emit).toHaveBeenCalledWith(
        'profile-context-updated',
        newProfile
      );
    });

    test('should handle profile load failures with component cleanup', async () => {
      const { profileManager, ledController, actionExecutor, pluginManager } = mockComponents;

      // Simulate profile load error
      profileManager.emit('profile-error', {
        profile: 'invalid-profile',
        error: 'Profile file corrupted',
        fallbackProfile: 'default'
      });

      await new Promise(resolve => setImmediate(resolve));

      // Verify components fall back to default configuration
      expect(ledController.applyProfileTheme).toHaveBeenCalledWith('default');
      expect(actionExecutor.emit).toHaveBeenCalledWith('config-reset');
      expect(pluginManager.notifyPlugins).toHaveBeenCalledWith(
        'profile-error',
        expect.any(Object)
      );
    });
  });

  describe('Action Executor ↔ Component Integration', () => {
    test('should coordinate action execution with LED feedback and performance monitoring', async () => {
      const { actionExecutor, ledController, performanceMonitor, pluginManager, serialManager } = mockComponents;

      const action = {
        type: 'keypress',
        key: 'ctrl+shift+s',
        buttonId: 3
      };

      // Simulate action execution request
      actionExecutor.emit('action-requested', action);

      await new Promise(resolve => setImmediate(resolve));

      // Verify performance monitoring starts
      expect(performanceMonitor.startMeasurement).toHaveBeenCalledWith(
        'action-execution',
        action
      );

      // Verify LED feedback during execution
      expect(ledController.setButtonColor).toHaveBeenCalledWith(
        3,
        expect.objectContaining({ r: expect.any(Number) }) // Execution color
      );

      // Simulate action completion
      actionExecutor.emit('action-completed', {
        action,
        result: { success: true, duration: 45 }
      });

      await new Promise(resolve => setImmediate(resolve));

      // Verify performance monitoring ends
      expect(performanceMonitor.endMeasurement).toHaveBeenCalledWith(
        'action-execution'
      );

      // Verify LED feedback completion
      expect(ledController.setButtonColor).toHaveBeenCalledWith(
        3,
        expect.objectContaining({ g: expect.any(Number) }) // Success color
      );

      // Verify plugins receive completion notification
      expect(pluginManager.notifyPlugins).toHaveBeenCalledWith(
        'action-completed',
        expect.any(Object)
      );
    });

    test('should handle action execution failures with error propagation', async () => {
      const { actionExecutor, ledController, pluginManager, performanceMonitor } = mockComponents;

      const failedAction = {
        type: 'application-launch',
        application: 'non-existent.exe',
        buttonId: 7
      };

      // Simulate action failure
      actionExecutor.emit('action-failed', {
        action: failedAction,
        error: 'Application not found'
      });

      await new Promise(resolve => setImmediate(resolve));

      // Verify LED error indication
      expect(ledController.setButtonColor).toHaveBeenCalledWith(
        7,
        expect.objectContaining({ r: 255, g: 0, b: 0 }) // Error color
      );

      // Verify plugins receive error notification
      expect(pluginManager.notifyPlugins).toHaveBeenCalledWith(
        'action-failed',
        expect.objectContaining({
          error: 'Application not found'
        })
      );

      // Verify performance tracking of failures
      expect(performanceMonitor.endMeasurement).toHaveBeenCalledWith(
        'action-execution',
        expect.objectContaining({ error: true })
      );
    });
  });

  describe('Plugin Manager ↔ Component Integration', () => {
    test('should isolate plugin failures from other components', async () => {
      const { pluginManager, actionExecutor, ledController, serialManager } = mockComponents;

      // Setup mock plugin that will fail
      const failedPlugin = {
        name: 'buggy-plugin',
        onButtonPress: jest.fn().mockRejectedValue(new Error('Plugin crashed'))
      };

      pluginManager.plugins = new Map([['buggy-plugin', failedPlugin]]);

      // Simulate button press that triggers plugin
      pluginManager.emit('plugin-execution', {
        pluginName: 'buggy-plugin',
        method: 'onButtonPress',
        args: [5, { profile: 'default' }]
      });

      await new Promise(resolve => setImmediate(resolve));

      // Verify plugin failure is isolated
      expect(actionExecutor.execute).not.toHaveBeenCalled();
      expect(ledController.setButtonColor).not.toHaveBeenCalled();
      expect(serialManager.writeCommand).not.toHaveBeenCalled();

      // Verify error is logged and contained
      expect(pluginManager.emit).toHaveBeenCalledWith(
        'plugin-error',
        expect.objectContaining({
          plugin: 'buggy-plugin',
          error: expect.any(Error)
        })
      );
    });

    test('should coordinate plugin-requested actions with system components', async () => {
      const { pluginManager, actionExecutor, ledController, contextManager } = mockComponents;

      const pluginActionRequest = {
        plugin: 'automation-plugin',
        action: {
          type: 'profile-switch',
          targetProfile: 'presentation',
          requestedBy: 'calendar-integration'
        }
      };

      // Simulate plugin requesting system action
      pluginManager.emit('plugin-action-request', pluginActionRequest);

      await new Promise(resolve => setImmediate(resolve));

      // Verify context manager evaluates request
      expect(contextManager.evaluateRules).toHaveBeenCalledWith(
        expect.objectContaining({
          requestSource: 'plugin',
          plugin: 'automation-plugin'
        })
      );

      // Verify action executor processes plugin request
      expect(actionExecutor.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'profile-switch',
          source: 'plugin'
        })
      );
    });
  });

  describe('LED Controller ↔ Component Integration', () => {
    test('should synchronize LED states with system events', async () => {
      const { ledController, serialManager, profileManager, actionExecutor } = mockComponents;

      // Test LED synchronization during profile switch
      profileManager.emit('profile-switching', {
        from: 'default',
        to: 'gaming',
        progress: 0.5
      });

      await new Promise(resolve => setImmediate(resolve));

      // Verify LED transition animation
      expect(ledController.startTransition).toHaveBeenCalledWith(
        'profile-switch',
        expect.any(Object)
      );

      // Test LED feedback during action execution
      actionExecutor.emit('action-started', {
        buttonId: 4,
        action: { type: 'macro', sequence: ['ctrl+c', 'ctrl+v'] }
      });

      await new Promise(resolve => setImmediate(resolve));

      // Verify LED feedback starts
      expect(ledController.setButtonColor).toHaveBeenCalledWith(
        4,
        expect.objectContaining({ b: expect.any(Number) }) // Action color
      );

      // Test LED error indication
      serialManager.emit('hardware-error', {
        code: 'LED_STRIP_DISCONNECTED',
        affectedButtons: [1, 2, 3, 4]
      });

      await new Promise(resolve => setImmediate(resolve));

      // Verify LED error state
      expect(ledController.setErrorState).toHaveBeenCalledWith([1, 2, 3, 4]);
    });
  });

  describe('Context Manager ↔ Component Integration', () => {
    test('should trigger automated profile switching based on context changes', async () => {
      const { contextManager, profileManager, ledController, pluginManager } = mockComponents;

      // Simulate application focus change
      contextManager.emit('application-changed', {
        previousApp: 'code.exe',
        currentApp: 'game.exe',
        context: {
          appCategory: 'gaming',
          fullscreen: true
        }
      });

      await new Promise(resolve => setImmediate(resolve));

      // Verify profile evaluation
      expect(contextManager.evaluateRules).toHaveBeenCalledWith(
        expect.objectContaining({
          currentApp: 'game.exe',
          appCategory: 'gaming'
        })
      );

      // Verify automated profile switch
      expect(profileManager.switchProfile).toHaveBeenCalledWith('gaming');

      // Verify LED theme application
      expect(ledController.applyProfileTheme).toHaveBeenCalledWith('gaming');

      // Verify plugin notification
      expect(pluginManager.notifyPlugins).toHaveBeenCalledWith(
        'context-changed',
        expect.any(Object)
      );
    });

    test('should handle calendar-based context switching', async () => {
      const { contextManager, profileManager, ledController } = mockComponents;

      // Simulate calendar event starting
      contextManager.emit('calendar-event-starting', {
        event: {
          title: 'Team Standup',
          type: 'meeting',
          duration: 30
        },
        suggestedProfile: 'meeting'
      });

      await new Promise(resolve => setImmediate(resolve));

      // Verify context-aware profile switch
      expect(profileManager.switchProfile).toHaveBeenCalledWith('meeting');

      // Verify meeting-specific LED theme
      expect(ledController.applyProfileTheme).toHaveBeenCalledWith('meeting');

      // Simulate meeting end
      setTimeout(() => {
        contextManager.emit('calendar-event-ended', {
          event: { title: 'Team Standup' },
          returnToProfile: 'default'
        });
      }, 100);

      await new Promise(resolve => setTimeout(resolve, 150));

      // Verify return to default profile
      expect(profileManager.switchProfile).toHaveBeenCalledWith('default');
    });
  });

  describe('Performance Monitor ↔ Component Integration', () => {
    test('should monitor cross-component performance metrics', async () => {
      const { performanceMonitor, actionExecutor, serialManager, pluginManager } = mockComponents;

      // Setup performance tracking
      performanceMonitor.trackComponentMetrics = jest.fn();

      // Simulate action execution chain
      actionExecutor.emit('action-started', { buttonId: 1, timestamp: Date.now() });
      serialManager.emit('command-sent', { command: 'LED:BUTTON:1:255:0:0' });
      pluginManager.emit('plugin-notified', { plugin: 'test-plugin' });
      actionExecutor.emit('action-completed', { buttonId: 1, duration: 75 });

      await new Promise(resolve => setImmediate(resolve));

      // Verify performance metrics collection
      expect(performanceMonitor.trackComponentMetrics).toHaveBeenCalledWith([
        expect.objectContaining({ component: 'action-executor' }),
        expect.objectContaining({ component: 'serial-manager' }),
        expect.objectContaining({ component: 'plugin-manager' })
      ]);
    });

    test('should detect performance bottlenecks in component interactions', async () => {
      const { performanceMonitor, actionExecutor, ledController } = mockComponents;

      performanceMonitor.detectBottlenecks = jest.fn();

      // Simulate slow LED response
      ledController.setButtonColor.mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 200)); // Slow response
      });

      actionExecutor.emit('action-started', { buttonId: 2 });

      await new Promise(resolve => setTimeout(resolve, 250));

      // Verify bottleneck detection
      expect(performanceMonitor.detectBottlenecks).toHaveBeenCalledWith(
        expect.objectContaining({
          component: 'led-controller',
          operation: 'setButtonColor',
          duration: expect.any(Number)
        })
      );
    });
  });

  describe('Error Propagation Integration', () => {
    test('should propagate and handle errors across component boundaries', async () => {
      const { serialManager, actionExecutor, ledController, pluginManager } = mockComponents;

      // Setup error handler
      const errorHandler = new EventEmitter();
      errorHandler.handleError = jest.fn();

      // Simulate cascading error scenario
      serialManager.emit('connection-error', {
        error: 'Device disconnected',
        code: 'ECONNRESET'
      });

      await new Promise(resolve => setImmediate(resolve));

      // Verify error propagation stops action execution
      expect(actionExecutor.emit).toHaveBeenCalledWith(
        'hardware-unavailable'
      );

      // Verify LED controller enters safe mode
      expect(ledController.enterSafeMode).toHaveBeenCalled();

      // Verify plugins are notified of hardware unavailability
      expect(pluginManager.notifyPlugins).toHaveBeenCalledWith(
        'hardware-error',
        expect.any(Object)
      );
    });
  });

  describe('State Synchronization Integration', () => {
    test('should maintain consistent state across all components', async () => {
      const { profileManager, ledController, actionExecutor, contextManager } = mockComponents;

      // Setup state tracking
      const stateTracker = {
        currentProfile: 'default',
        ledTheme: {},
        buttonMappings: {},
        contextRules: {}
      };

      // Simulate profile change
      profileManager.emit('profile-changed', {
        newProfile: 'development',
        config: {
          buttons: { 1: { action: 'ctrl+shift+r' } },
          ledTheme: { 1: { r: 0, g: 255, b: 0 } }
        }
      });

      await new Promise(resolve => setImmediate(resolve));

      // Verify all components have consistent state
      expect(ledController.getCurrentTheme()).toEqual(
        expect.objectContaining({ 1: { r: 0, g: 255, b: 0 } })
      );

      expect(actionExecutor.getButtonMappings()).toEqual(
        expect.objectContaining({ 1: { action: 'ctrl+shift+r' } })
      );

      expect(contextManager.getCurrentProfile()).toBe('development');
    });
  });
});