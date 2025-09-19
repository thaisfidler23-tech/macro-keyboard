const MacroKeyboardApp = require('../src/main');
const ActionExecutor = require('../src/ActionExecutor');

// Mock electron modules
jest.mock('electron', () => ({
  app: {
    whenReady: jest.fn().mockResolvedValue(),
    on: jest.fn(),
    quit: jest.fn(),
    isQuiting: false
  },
  BrowserWindow: jest.fn(() => ({
    loadFile: jest.fn(),
    on: jest.fn(),
    webContents: {
      openDevTools: jest.fn(),
      send: jest.fn()
    },
    show: jest.fn(),
    hide: jest.fn()
  })),
  Menu: {
    buildFromTemplate: jest.fn()
  },
  Tray: jest.fn(() => ({
    setContextMenu: jest.fn(),
    setToolTip: jest.fn()
  })),
  ipcMain: {
    handle: jest.fn()
  }
}));

// Mock file system
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn().mockReturnValue('device:\n  buttons: 8\n  encoders: 0'),
  writeFileSync: jest.fn()
}));

// Mock winston
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    printf: jest.fn()
  },
  transports: {
    File: jest.fn(),
    Console: jest.fn()
  }
}));

// Mock yaml
jest.mock('js-yaml', () => ({
  load: jest.fn().mockReturnValue({
    device: { buttons: 8, encoders: 0 },
    buttons: {},
    encoders: {}
  }),
  dump: jest.fn()
}));

// Mock ActionExecutor
jest.mock('../src/ActionExecutor');

// Mock serialport
jest.mock('serialport', () => ({
  SerialPort: jest.fn()
}));

describe('MacroKeyboardApp Action Execution Integration', () => {
  let app;
  let mockActionExecutor;
  let mockLogger;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    // Setup mock action executor
    mockActionExecutor = {
      executeAction: jest.fn().mockResolvedValue(true)
    };
    ActionExecutor.mockImplementation(() => mockActionExecutor);

    // Create app instance
    app = new MacroKeyboardApp();
    app.logger = mockLogger;
    app.actionExecutor = mockActionExecutor;
    
    // Setup test configuration
    app.config = {
      device: {
        buttons: 8,
        encoders: 2
      },
      buttons: {
        button1: {
          type: 'keypress',
          action: 'ctrl+c',
          description: 'Copy'
        },
        button2: {
          type: 'command',
          action: 'echo hello',
          description: 'Test command'
        },
        button3: {
          type: 'application',
          action: 'calculator',
          description: 'Launch calculator'
        }
      },
      encoders: {
        encoder1: {
          typeCW: 'keypress',
          actionCW: 'VolumeUp',
          typeCCW: 'keypress',
          actionCCW: 'VolumeDown',
          description: 'Volume control'
        },
        encoder2: {
          typeCW: 'command',
          actionCW: 'echo clockwise',
          typeCCW: 'command',
          actionCCW: 'echo counter-clockwise',
          description: 'Test encoder'
        }
      }
    };
  });

  describe('executeButtonAction', () => {
    test('executes configured button action successfully', async () => {
      const result = await app.executeButtonAction(1);
      
      expect(result).toBe(true);
      expect(mockActionExecutor.executeAction).toHaveBeenCalledWith(
        { type: 'keypress', action: 'ctrl+c', description: 'Copy' },
        'button1'
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Executing action for button 1: ctrl+c');
    });

    test('handles button with no action configured', async () => {
      const result = await app.executeButtonAction(5); // Not configured
      
      expect(result).toBe(false);
      expect(mockActionExecutor.executeAction).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith('No action configured for button 5', undefined);
    });

    test('handles button action execution failure', async () => {
      mockActionExecutor.executeAction.mockResolvedValue(false);
      
      const result = await app.executeButtonAction(1);
      
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to execute action for button 1');
    });

    test('handles missing action executor', async () => {
      app.actionExecutor = null;
      
      const result = await app.executeButtonAction(1);
      
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith('Action executor not initialized');
    });

    test('executes command action for button', async () => {
      const result = await app.executeButtonAction(2);
      
      expect(result).toBe(true);
      expect(mockActionExecutor.executeAction).toHaveBeenCalledWith(
        { type: 'command', action: 'echo hello', description: 'Test command' },
        'button2'
      );
    });

    test('executes application action for button', async () => {
      const result = await app.executeButtonAction(3);
      
      expect(result).toBe(true);
      expect(mockActionExecutor.executeAction).toHaveBeenCalledWith(
        { type: 'application', action: 'calculator', description: 'Launch calculator' },
        'button3'
      );
    });
  });

  describe('executeEncoderAction', () => {
    test('executes clockwise encoder action successfully', async () => {
      const result = await app.executeEncoderAction(1, 'CW');
      
      expect(result).toBe(true);
      expect(mockActionExecutor.executeAction).toHaveBeenCalledWith(
        { type: 'keypress', action: 'VolumeUp' },
        'encoder1:CW'
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Executing CW action for encoder 1: VolumeUp');
    });

    test('executes counter-clockwise encoder action successfully', async () => {
      const result = await app.executeEncoderAction(1, 'CCW');
      
      expect(result).toBe(true);
      expect(mockActionExecutor.executeAction).toHaveBeenCalledWith(
        { type: 'keypress', action: 'VolumeDown' },
        'encoder1:CCW'
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Executing CCW action for encoder 1: VolumeDown');
    });

    test('executes command actions for encoder', async () => {
      const result = await app.executeEncoderAction(2, 'CW');
      
      expect(result).toBe(true);
      expect(mockActionExecutor.executeAction).toHaveBeenCalledWith(
        { type: 'command', action: 'echo clockwise' },
        'encoder2:CW'
      );
    });

    test('handles encoder with no action configured', async () => {
      const result = await app.executeEncoderAction(3, 'CW'); // Not configured
      
      expect(result).toBe(false);
      expect(mockActionExecutor.executeAction).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith('No configuration found for encoder 3');
    });

    test('handles encoder with no specific direction action', async () => {
      // Remove CW action
      delete app.config.encoders.encoder1.actionCW;
      delete app.config.encoders.encoder1.typeCW;
      
      const result = await app.executeEncoderAction(1, 'CW');
      
      expect(result).toBe(false);
      expect(mockActionExecutor.executeAction).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No CW action configured for encoder 1',
        expect.any(Object)
      );
    });

    test('handles encoder action execution failure', async () => {
      mockActionExecutor.executeAction.mockResolvedValue(false);
      
      const result = await app.executeEncoderAction(1, 'CW');
      
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to execute CW action for encoder 1');
    });

    test('handles missing action executor', async () => {
      app.actionExecutor = null;
      
      const result = await app.executeEncoderAction(1, 'CW');
      
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith('Action executor not initialized');
    });
  });

  describe('Configuration Edge Cases', () => {
    test('handles button with missing type', async () => {
      app.config.buttons.button1 = {
        action: 'ctrl+c',
        description: 'Copy'
        // Missing type
      };
      
      const result = await app.executeButtonAction(1);
      
      expect(result).toBe(false);
      expect(mockActionExecutor.executeAction).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No action configured for button 1',
        expect.any(Object)
      );
    });

    test('handles encoder with missing type but action present', async () => {
      app.config.encoders.encoder1 = {
        actionCW: 'VolumeUp',
        // Missing typeCW
        typeCCW: 'keypress',
        actionCCW: 'VolumeDown'
      };
      
      const result = await app.executeEncoderAction(1, 'CW');
      
      expect(result).toBe(false);
      expect(mockActionExecutor.executeAction).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No CW action configured for encoder 1',
        expect.any(Object)
      );
    });

    test('handles empty button configuration', async () => {
      app.config.buttons.button1 = {};
      
      const result = await app.executeButtonAction(1);
      
      expect(result).toBe(false);
      expect(mockActionExecutor.executeAction).not.toHaveBeenCalled();
    });

    test('handles empty encoder configuration', async () => {
      app.config.encoders.encoder1 = {};
      
      const result = await app.executeEncoderAction(1, 'CW');
      
      expect(result).toBe(false);
      expect(mockActionExecutor.executeAction).not.toHaveBeenCalled();
    });
  });

  describe('Logging and Context', () => {
    test('provides correct context to action executor for buttons', async () => {
      await app.executeButtonAction(1);
      
      expect(mockActionExecutor.executeAction).toHaveBeenCalledWith(
        expect.any(Object),
        'button1'
      );
    });

    test('provides correct context to action executor for encoders', async () => {
      await app.executeEncoderAction(1, 'CW');
      await app.executeEncoderAction(2, 'CCW');
      
      expect(mockActionExecutor.executeAction).toHaveBeenCalledWith(
        expect.any(Object),
        'encoder1:CW'
      );
      expect(mockActionExecutor.executeAction).toHaveBeenCalledWith(
        expect.any(Object),
        'encoder2:CCW'
      );
    });

    test('logs appropriate messages for successful executions', async () => {
      await app.executeButtonAction(1);
      await app.executeEncoderAction(1, 'CW');
      
      expect(mockLogger.info).toHaveBeenCalledWith('Executing action for button 1: ctrl+c');
      expect(mockLogger.info).toHaveBeenCalledWith('Executing CW action for encoder 1: VolumeUp');
    });
  });
});