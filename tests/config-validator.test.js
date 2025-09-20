const { ConfigValidator } = require('../src/ConfigValidator');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

describe('ConfigValidator', () => {
  let validator;
  let mockLogger;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    // Create validator instance
    validator = new ConfigValidator(mockLogger);
  });

  describe('Schema Loading', () => {
    test('loads schema successfully', () => {
      expect(validator.schema).toBeDefined();
      expect(validator.validate).toBeDefined();
      expect(validator.getCurrentVersion()).toBe('1.0.0');
    });

    test('schema has required properties', () => {
      const requiredProps = ['version', 'device', 'buttons', 'encoders', 'logging'];
      requiredProps.forEach(prop => {
        expect(validator.schema.properties[prop]).toBeDefined();
      });
    });
  });

  describe('Configuration Validation', () => {
    const validConfig = {
      version: '1.0.0',
      device: {
        serialPort: null,
        baudRate: 9600,
        buttons: 8,
        encoders: 2,
        connectionTimeout: 5000
      },
      buttons: {
        button1: {
          description: 'Test Button',
          type: 'keypress',
          action: 'ctrl+c',
          enabled: true
        }
      },
      encoders: {
        encoder1: {
          description: 'Volume Control',
          typeCW: 'keypress',
          actionCW: 'VolumeUp',
          typeCCW: 'keypress',
          actionCCW: 'VolumeDown',
          enabled: true
        }
      },
      logging: {
        level: 'info',
        file: 'logs/test.log',
        maxSize: 5242880,
        maxFiles: 5
      },
      security: {
        commandExecution: {
          enabled: true,
          mode: 'blacklist',
          allowedCommands: [],
          timeout: 10000,
          maxLength: 1000
        }
      },
      profiles: {
        active: 'default',
        available: ['default']
      }
    };

    test('validates correct configuration', () => {
      const result = validator.validateConfig(validConfig);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.migratedConfig).toEqual(validConfig);
    });

    test('rejects configuration with missing required fields', () => {
      const invalidConfig = {
        version: '1.0.0',
        device: {
          baudRate: 9600
          // Missing buttons and encoders
        }
      };

      const result = validator.validateConfig(invalidConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('Missing required field'))).toBe(true);
    });

    test('rejects invalid data types', () => {
      const invalidConfig = {
        ...validConfig,
        device: {
          ...validConfig.device,
          baudRate: 'not-a-number'
        }
      };

      const result = validator.validateConfig(invalidConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('Invalid type'))).toBe(true);
    });

    test('rejects invalid enum values', () => {
      const invalidConfig = {
        ...validConfig,
        logging: {
          ...validConfig.logging,
          level: 'invalid-level'
        }
      };

      const result = validator.validateConfig(invalidConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('must be one of'))).toBe(true);
    });

    test('rejects values outside valid ranges', () => {
      const invalidConfig = {
        ...validConfig,
        device: {
          ...validConfig.device,
          buttons: 50 // Max is 32
        }
      };

      const result = validator.validateConfig(invalidConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('Value too large'))).toBe(true);
    });

    test('validates button action types', () => {
      const configWithInvalidAction = {
        ...validConfig,
        buttons: {
          button1: {
            description: 'Test',
            type: 'invalid-type',
            action: 'test'
          }
        }
      };

      const result = validator.validateConfig(configWithInvalidAction);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('must be one of [keypress, command, application]'))).toBe(true);
    });
  });

  describe('Semantic Validation', () => {
    test('validates button numbers against device limits', () => {
      const config = {
        ...getValidConfig(),
        device: { ...getValidConfig().device, buttons: 4 },
        buttons: {
          button5: { // Button 5 but device only has 4 buttons
            description: 'Invalid',
            type: 'keypress',
            action: 'test'
          }
        }
      };

      const result = validator.validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Button 5 configured but device only has 4 buttons');
    });

    test('validates encoder numbers against device limits', () => {
      const config = {
        ...getValidConfig(),
        device: { ...getValidConfig().device, encoders: 1 },
        encoders: {
          encoder2: { // Encoder 2 but device only has 1 encoder
            description: 'Invalid',
            typeCW: 'keypress',
            actionCW: 'test'
          }
        }
      };

      const result = validator.validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Encoder 2 configured but device only has 1 encoders');
    });

    test('warns about allowlist mode with no allowed commands', () => {
      const config = {
        ...getValidConfig(),
        security: {
          commandExecution: {
            enabled: true,
            mode: 'allowlist',
            allowedCommands: [], // Empty allowlist
            timeout: 10000,
            maxLength: 1000
          }
        }
      };

      const result = validator.validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Allowlist mode enabled but no commands are allowed - all command actions will fail');
    });

    test('validates command actions when execution is disabled', () => {
      const config = {
        ...getValidConfig(),
        security: {
          commandExecution: {
            enabled: false, // Disabled
            mode: 'blacklist',
            allowedCommands: [],
            timeout: 10000,
            maxLength: 1000
          }
        },
        buttons: {
          button1: {
            description: 'Command button',
            type: 'command', // But commands are disabled
            action: 'echo test'
          }
        }
      };

      const result = validator.validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Button button1 uses command action but command execution is disabled');
    });
  });

  describe('Configuration Migration', () => {
    test('migrates unversioned config to 1.0.0', () => {
      const unversionedConfig = {
        device: {
          baudRate: 9600,
          buttons: 8,
          encoders: 0
        },
        buttons: {},
        encoders: {},
        logging: {
          level: 'info'
        }
      };

      const result = validator.validateConfig(unversionedConfig);
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Configuration migrated from unversioned to 1.0.0');
      expect(result.migratedConfig.version).toBe('1.0.0');
      expect(result.migratedConfig.security).toBeDefined();
      expect(result.migratedConfig.profiles).toBeDefined();
    });

    test('preserves existing data during migration', () => {
      const unversionedConfig = {
        device: {
          serialPort: '/dev/ttyUSB0',
          baudRate: 115200,
          buttons: 16,
          encoders: 4
        },
        buttons: {
          button1: {
            type: 'keypress',
            action: 'ctrl+c'
          }
        },
        encoders: {},
        logging: {
          level: 'debug',
          file: 'custom.log'
        }
      };

      const result = validator.validateConfig(unversionedConfig);
      
      expect(result.valid).toBe(true);
      expect(result.migratedConfig.device.serialPort).toBe('/dev/ttyUSB0');
      expect(result.migratedConfig.device.baudRate).toBe(115200);
      expect(result.migratedConfig.device.buttons).toBe(16);
      expect(result.migratedConfig.device.encoders).toBe(4);
      expect(result.migratedConfig.buttons.button1).toEqual(unversionedConfig.buttons.button1);
      expect(result.migratedConfig.logging.level).toBe('debug');
      expect(result.migratedConfig.logging.file).toBe('custom.log');
    });

    test('handles already current version', () => {
      const currentConfig = getValidConfig();
      
      const result = validator.validateConfig(currentConfig);
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
      expect(result.migratedConfig).toEqual(currentConfig);
    });
  });

  describe('Error Formatting', () => {
    test('formats validation errors clearly', () => {
      const invalidConfig = {
        version: '1.0.0',
        device: {
          baudRate: -100, // Invalid
          buttons: 'eight', // Invalid type
          encoders: 0
        },
        buttons: {},
        encoders: {},
        logging: {
          level: 'invalid' // Invalid enum
        }
      };

      const result = validator.validateConfig(invalidConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Check that error messages are human-readable
      const errorString = result.errors.join(' ');
      expect(errorString).toContain('must be >= 1200');
      expect(errorString).toContain('expected integer');
      expect(errorString).toContain('must be one of');
    });
  });

  describe('Utility Functions', () => {
    test('gets current version', () => {
      expect(validator.getCurrentVersion()).toBe('1.0.0');
    });

    test('gets statistics', () => {
      const stats = validator.getStats();
      
      expect(stats.schemaVersion).toBe('1.0.0');
      expect(stats.availableMigrations).toContain('unversioned->1.0.0');
      expect(stats.schemaProperties).toContain('version');
      expect(stats.schemaProperties).toContain('device');
      expect(stats.compiledValidatorReady).toBe(true);
    });

    test('handles null/undefined input gracefully', () => {
      expect(validator.validateConfig(null).valid).toBe(false);
      expect(validator.validateConfig(undefined).valid).toBe(false);
      expect(validator.validateConfig('not-an-object').valid).toBe(false);
    });
  });

  describe('File Operations', () => {
    const testConfigPath = path.join(__dirname, 'test-config.yaml');

    afterEach(() => {
      // Clean up test files
      if (fs.existsSync(testConfigPath)) {
        fs.unlinkSync(testConfigPath);
      }
      // Clean up backup files
      const backupFiles = fs.readdirSync(__dirname).filter(f => f.includes('test-config.yaml.backup'));
      backupFiles.forEach(f => fs.unlinkSync(path.join(__dirname, f)));
    });

    test('saves valid configuration', async () => {
      const config = getValidConfig();
      
      const success = await validator.saveConfig(config, testConfigPath);
      
      expect(success).toBe(true);
      expect(fs.existsSync(testConfigPath)).toBe(true);
      
      // Verify saved content can be loaded and parsed
      const savedContent = fs.readFileSync(testConfigPath, 'utf8');
      const parsedConfig = yaml.load(savedContent);
      expect(parsedConfig.version).toBe('1.0.0');
    });

    test('creates backup before saving', async () => {
      const config = getValidConfig();
      
      // Create initial file
      fs.writeFileSync(testConfigPath, 'initial content');
      
      await validator.saveConfig(config, testConfigPath);
      
      // Check backup was created
      const backupFiles = fs.readdirSync(__dirname).filter(f => f.includes('test-config.yaml.backup'));
      expect(backupFiles.length).toBe(1);
    });
  });

  // Helper function to get a valid config for tests
  function getValidConfig() {
    return {
      version: '1.0.0',
      device: {
        serialPort: null,
        baudRate: 9600,
        buttons: 8,
        encoders: 0,
        connectionTimeout: 5000
      },
      buttons: {},
      encoders: {},
      logging: {
        level: 'info',
        file: 'logs/test.log',
        maxSize: 5242880,
        maxFiles: 5
      },
      security: {
        commandExecution: {
          enabled: true,
          mode: 'blacklist',
          allowedCommands: [],
          timeout: 10000,
          maxLength: 1000
        }
      },
      profiles: {
        active: 'default',
        available: ['default']
      }
    };
  }
});