/**
 * Comprehensive Config Validator Tests
 * 
 * Tests configuration validation, schema loading, migration, error reporting,
 * and security validation for all configuration scenarios.
 */

const { ConfigValidator } = require('../src/ConfigValidator');
const { TestDataFactory } = require('./test-data-factory');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Mock fs module
jest.mock('fs');
jest.mock('js-yaml');

describe('ConfigValidator', () => {
  let validator;
  let mockLogger;
  let mockFs;
  let mockYaml;

  beforeEach(() => {
    mockLogger = TestDataFactory.logger().build();
    
    // Setup fs mocks
    mockFs = fs;
    mockFs.readFileSync = jest.fn();
    mockFs.writeFileSync = jest.fn();
    mockFs.existsSync = jest.fn();

    // Setup yaml mock
    mockYaml = yaml;
    mockYaml.load = jest.fn();
    mockYaml.dump = jest.fn();

    // Mock schema file reading
    const mockSchema = {
      type: 'object',
      properties: {
        version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
        device: {
          type: 'object',
          properties: {
            serialPort: { type: ['string', 'null'] },
            baudRate: { type: 'number', minimum: 9600, maximum: 115200 },
            buttons: { type: 'number', minimum: 1, maximum: 32 },
            encoders: { type: 'number', minimum: 0, maximum: 8 },
            connectionTimeout: { type: 'number', minimum: 1000 }
          },
          required: ['buttons', 'encoders']
        },
        buttons: { type: 'object' },
        encoders: { type: 'object' },
        logging: {
          type: 'object',
          properties: {
            level: { type: 'string', enum: ['error', 'warn', 'info', 'debug'] },
            file: { type: 'string' }
          }
        }
      },
      required: ['version', 'device', 'buttons', 'encoders', 'logging']
    };

    mockFs.readFileSync.mockReturnValue(JSON.stringify(mockSchema));
    validator = new ConfigValidator(mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize with schema loaded', () => {
      expect(validator).toBeInstanceOf(ConfigValidator);
      expect(validator.schema).toBeDefined();
      expect(validator.validate).toBeDefined();
      expect(mockFs.readFileSync).toHaveBeenCalled();
    });

    test('should initialize without logger', () => {
      const validatorNoLogger = new ConfigValidator();
      expect(validatorNoLogger).toBeInstanceOf(ConfigValidator);
    });

    test('should handle missing schema file gracefully', () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file');
      });

      expect(() => new ConfigValidator(mockLogger)).not.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test('should handle invalid schema JSON', () => {
      mockFs.readFileSync.mockReturnValue('invalid json{');

      expect(() => new ConfigValidator(mockLogger)).not.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Configuration Validation', () => {
    test('should validate valid configuration', () => {
      const config = TestDataFactory.config()
        .withVersion('1.0.0')
        .withButtonCount(8)
        .withEncoderCount(2)
        .build();

      const result = validator.validate(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    test('should reject configuration with invalid version format', () => {
      const config = TestDataFactory.config()
        .withVersion('invalid-version')
        .build();

      const result = validator.validate(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('version');
    });

    test('should reject configuration with missing required fields', () => {
      const config = {
        version: '1.0.0'
        // Missing device, buttons, encoders, logging
      };

      const result = validator.validate(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(error => error.includes('device'))).toBe(true);
    });

    test('should reject invalid button count', () => {
      const config = TestDataFactory.config()
        .withButtonCount(0) // Invalid: minimum is 1
        .build();

      const result = validator.validate(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('buttons'))).toBe(true);
    });

    test('should reject invalid encoder count', () => {
      const config = TestDataFactory.config()
        .withEncoderCount(10) // Invalid: maximum is 8
        .build();

      const result = validator.validate(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('encoders'))).toBe(true);
    });

    test('should reject invalid baud rate', () => {
      const config = TestDataFactory.config()
        .withBaudRate(1200) // Invalid: minimum is 9600
        .build();

      const result = validator.validate(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('baudRate'))).toBe(true);
    });

    test('should reject invalid log level', () => {
      const config = TestDataFactory.config()
        .withLogLevel('invalid-level')
        .build();

      const result = validator.validate(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('level'))).toBe(true);
    });
  });

  describe('Button Configuration Validation', () => {
    test('should validate button with keypress action', () => {
      const config = TestDataFactory.config()
        .withKeypressAction('button1', 'ctrl+c')
        .build();

      const result = validator.validate(config);

      expect(result.isValid).toBe(true);
    });

    test('should validate button with command action', () => {
      const config = TestDataFactory.config()
        .withCommandAction('button1', 'echo', ['hello'])
        .build();

      const result = validator.validate(config);

      expect(result.isValid).toBe(true);
    });

    test('should validate button with application action', () => {
      const config = TestDataFactory.config()
        .withApplicationAction('button1', 'notepad.exe')
        .build();

      const result = validator.validate(config);

      expect(result.isValid).toBe(true);
    });

    test('should reject button with invalid action type', () => {
      const config = TestDataFactory.config().build();
      config.buttons.button1 = {
        description: 'Test Button',
        actions: [{
          type: 'invalid-type',
          keys: 'ctrl+c'
        }]
      };

      const result = validator.validate(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('action'))).toBe(true);
    });

    test('should reject button with missing action keys for keypress', () => {
      const config = TestDataFactory.config().build();
      config.buttons.button1 = {
        description: 'Test Button',
        actions: [{
          type: 'keypress'
          // Missing keys
        }]
      };

      const result = validator.validate(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('keys'))).toBe(true);
    });
  });

  describe('Encoder Configuration Validation', () => {
    test('should validate encoder configuration', () => {
      const config = TestDataFactory.config()
        .withEncoder('encoder1', {
          clockwise: { actions: [{ type: 'keypress', keys: 'ctrl+plus' }] },
          counterclockwise: { actions: [{ type: 'keypress', keys: 'ctrl+minus' }] }
        })
        .build();

      const result = validator.validate(config);

      expect(result.isValid).toBe(true);
    });

    test('should reject encoder with missing direction configurations', () => {
      const config = TestDataFactory.config().build();
      config.encoders.encoder1 = {
        description: 'Test Encoder'
        // Missing clockwise and counterclockwise
      };

      const result = validator.validate(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('encoder'))).toBe(true);
    });
  });

  describe('Configuration Migration', () => {
    test('should migrate configuration from older version', () => {
      const oldConfig = {
        version: '0.9.0',
        device: { serialPort: '/dev/ttyUSB0', baudRate: 9600 },
        buttons: { button1: { description: 'Old Button' } }
      };

      const migrated = validator.migrateConfig(oldConfig);

      expect(migrated.version).toBe('1.0.0');
      expect(migrated.device.buttons).toBeDefined();
      expect(migrated.device.encoders).toBeDefined();
      expect(migrated.logging).toBeDefined();
    });

    test('should not migrate already current configuration', () => {
      const currentConfig = TestDataFactory.config().build();
      
      const migrated = validator.migrateConfig(currentConfig);

      expect(migrated).toEqual(currentConfig);
    });

    test('should handle migration errors gracefully', () => {
      const malformedConfig = null;

      const migrated = validator.migrateConfig(malformedConfig);

      expect(migrated).toBeDefined();
      expect(migrated.version).toBe('1.0.0');
    });
  });

  describe('Configuration Loading and Saving', () => {
    test('should load configuration from YAML file', () => {
      const mockConfig = TestDataFactory.config().build();
      mockFs.readFileSync.mockReturnValue('mock yaml content');
      mockYaml.load.mockReturnValue(mockConfig);

      const result = validator.loadConfig('/path/to/config.yaml');

      expect(result.isValid).toBe(true);
      expect(result.config).toEqual(mockConfig);
      expect(mockFs.readFileSync).toHaveBeenCalledWith('/path/to/config.yaml', 'utf8');
    });

    test('should handle missing configuration file', () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file');
      });

      const result = validator.loadConfig('/nonexistent/config.yaml');

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should handle invalid YAML syntax', () => {
      mockFs.readFileSync.mockReturnValue('invalid: yaml: content:');
      mockYaml.load.mockImplementation(() => {
        throw new Error('YAML parse error');
      });

      const result = validator.loadConfig('/path/to/config.yaml');

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('YAML'))).toBe(true);
    });

    test('should save valid configuration to file', () => {
      const config = TestDataFactory.config().build();
      mockYaml.dump.mockReturnValue('mock yaml output');

      const result = validator.saveConfig(config, '/path/to/output.yaml');

      expect(result.success).toBe(true);
      expect(mockYaml.dump).toHaveBeenCalledWith(config, expect.any(Object));
      expect(mockFs.writeFileSync).toHaveBeenCalledWith('/path/to/output.yaml', 'mock yaml output', 'utf8');
    });

    test('should refuse to save invalid configuration', () => {
      const invalidConfig = { version: 'invalid' };

      const result = validator.saveConfig(invalidConfig, '/path/to/output.yaml');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    });
  });

  describe('Security Validation', () => {
    test('should validate safe command paths', () => {
      const config = TestDataFactory.config()
        .withCommandAction('button1', '/usr/bin/echo', ['hello'])
        .build();

      const result = validator.validateSecurity(config);

      expect(result.isSecure).toBe(true);
      expect(result.warnings).toEqual([]);
    });

    test('should warn about potentially dangerous commands', () => {
      const config = TestDataFactory.config()
        .withCommandAction('button1', 'rm', ['-rf', '/'])
        .build();

      const result = validator.validateSecurity(config);

      expect(result.isSecure).toBe(false);
      expect(result.warnings.some(warning => warning.includes('dangerous'))).toBe(true);
    });

    test('should validate command path restrictions', () => {
      const config = TestDataFactory.config()
        .withCommandAction('button1', '../../../etc/passwd')
        .build();

      const result = validator.validateSecurity(config);

      expect(result.isSecure).toBe(false);
      expect(result.warnings.some(warning => warning.includes('path'))).toBe(true);
    });
  });

  describe('Error Reporting and Context', () => {
    test('should provide detailed error context', () => {
      const config = {
        version: '1.0.0',
        device: {
          buttons: 'invalid-type' // Should be number
        }
      };

      const result = validator.validate(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('device.buttons');
    });

    test('should provide suggestions for common errors', () => {
      const config = {
        version: '1.0.0',
        device: {
          buttons: 0 // Below minimum
        }
      };

      const result = validator.validate(config);

      expect(result.isValid).toBe(false);
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    test('should track validation metrics', () => {
      const config1 = TestDataFactory.config().build();
      const config2 = { version: 'invalid' };

      validator.validate(config1);
      validator.validate(config2);

      const metrics = validator.getValidationMetrics();

      expect(metrics.totalValidations).toBe(2);
      expect(metrics.successfulValidations).toBe(1);
      expect(metrics.failedValidations).toBe(1);
    });
  });

  describe('Configuration Defaults and Templates', () => {
    test('should provide default configuration template', () => {
      const defaultConfig = validator.getDefaultConfig();

      expect(defaultConfig).toBeDefined();
      expect(defaultConfig.version).toBe('1.0.0');
      expect(defaultConfig.device).toBeDefined();
      expect(defaultConfig.buttons).toBeDefined();
      expect(defaultConfig.encoders).toBeDefined();
    });

    test('should merge user config with defaults', () => {
      const userConfig = {
        device: {
          buttons: 16
        }
      };

      const merged = validator.mergeWithDefaults(userConfig);

      expect(merged.version).toBe('1.0.0');
      expect(merged.device.buttons).toBe(16);
      expect(merged.device.encoders).toBeDefined();
      expect(merged.logging).toBeDefined();
    });
  });

  describe('Real-time Validation and Monitoring', () => {
    test('should validate configuration changes', (done) => {
      const config = TestDataFactory.config().build();

      validator.on('configurationChanged', (changeEvent) => {
        expect(changeEvent.isValid).toBe(true);
        expect(changeEvent.changes).toBeDefined();
        done();
      });

      validator.validateChange(config, 'device.buttons', 16);
    });

    test('should emit warnings for risky changes', (done) => {
      const config = TestDataFactory.config().build();

      validator.on('validationWarning', (warning) => {
        expect(warning.severity).toBe('HIGH');
        expect(warning.message).toContain('dangerous');
        done();
      });

      validator.validateChange(config, 'buttons.button1.actions[0].command', 'rm');
    });
  });

  describe('Performance and Edge Cases', () => {
    test('should handle large configurations efficiently', () => {
      const largeConfig = TestDataFactory.config()
        .withButtonCount(32)
        .withEncoderCount(8)
        .build();

      // Add many button configurations
      for (let i = 1; i <= 32; i++) {
        largeConfig.buttons[`button${i}`] = {
          description: `Button ${i}`,
          actions: [{ type: 'keypress', keys: `ctrl+${i}` }]
        };
      }

      const startTime = Date.now();
      const result = validator.validate(largeConfig);
      const endTime = Date.now();

      expect(result.isValid).toBe(true);
      expect(endTime - startTime).toBeLessThan(100); // Should validate quickly
    });

    test('should handle circular references gracefully', () => {
      const config = TestDataFactory.config().build();
      config.circular = config; // Create circular reference

      expect(() => validator.validate(config)).not.toThrow();
    });

    test('should handle null and undefined values', () => {
      expect(() => validator.validate(null)).not.toThrow();
      expect(() => validator.validate(undefined)).not.toThrow();
      expect(() => validator.validate({})).not.toThrow();
    });
  });
});
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