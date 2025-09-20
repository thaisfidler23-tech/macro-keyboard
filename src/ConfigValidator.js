/**
 * Configuration Validator for Macro Keyboard
 * 
 * Provides JSON schema validation, configuration migration, and error reporting
 * for all configuration files and updates.
 */

const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const CONFIG_SCHEMA_VERSION = '1.0.0';

/**
 * Configuration validation and migration manager
 */
class ConfigValidator {
  constructor(logger = null) {
    this.logger = logger;
    this.ajv = new Ajv({ 
      allErrors: true,
      verbose: true,
      strict: false,
      removeAdditional: true // Remove unknown properties
    });
    addFormats(this.ajv);
    
    this.schema = null;
    this.currentVersion = CONFIG_SCHEMA_VERSION;
    this.migrations = new Map();
    
    // Load schema
    this.loadSchema();
    
    // Register migrations
    this.registerMigrations();
  }

  /**
   * Load JSON schema from file
   */
  loadSchema() {
    try {
      const schemaPath = path.join(__dirname, '..', 'config', 'schema.json');
      const schemaContent = fs.readFileSync(schemaPath, 'utf8');
      this.schema = JSON.parse(schemaContent);
      
      // Compile validator
      this.validate = this.ajv.compile(this.schema);
      
      this.logger?.info('Configuration schema loaded successfully');
    } catch (error) {
      this.logger?.error('Failed to load configuration schema:', error);
      throw new Error(`Schema loading failed: ${error.message}`);
    }
  }

  /**
   * Register configuration migrations between versions
   */
  registerMigrations() {
    // Migration from unversioned config to 1.0.0
    this.migrations.set('unversioned->1.0.0', (config) => {
      this.logger?.info('Migrating configuration from unversioned to 1.0.0');
      
      const migrated = {
        version: '1.0.0',
        device: {
          serialPort: config.device?.serialPort || null,
          baudRate: config.device?.baudRate || 9600,
          buttons: config.device?.buttons || 8,
          encoders: config.device?.encoders || 0,
          connectionTimeout: 5000
        },
        buttons: config.buttons || {},
        encoders: config.encoders || {},
        logging: {
          level: config.logging?.level || 'info',
          file: config.logging?.file || 'logs/macro-keyboard.log',
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
      
      return migrated;
    });
    
    // Add future migrations here
    // this.migrations.set('1.0.0->1.1.0', (config) => { ... });
  }

  /**
   * Validate configuration object against schema
   * @param {Object} config - Configuration object to validate
   * @returns {Object} Validation result with valid, errors, and warnings
   */
  validateConfig(config) {
    if (!config || typeof config !== 'object') {
      return {
        valid: false,
        errors: ['Configuration must be a valid object'],
        warnings: [],
        migratedConfig: null
      };
    }

    const result = {
      valid: false,
      errors: [],
      warnings: [],
      migratedConfig: null
    };

    try {
      // Check if migration is needed
      const configVersion = config.version;
      let workingConfig = config;
      
      if (!configVersion || configVersion !== this.currentVersion) {
        const migrationResult = this.migrateConfig(config);
        if (!migrationResult.success) {
          result.errors = migrationResult.errors;
          return result;
        }
        workingConfig = migrationResult.migratedConfig;
        result.warnings.push(`Configuration migrated from ${configVersion || 'unversioned'} to ${this.currentVersion}`);
      }

      // Validate against schema
      const isValid = this.validate(workingConfig);
      
      if (isValid) {
        result.valid = true;
        result.migratedConfig = workingConfig;
      } else {
        result.errors = this.formatValidationErrors(this.validate.errors);
      }

      // Additional semantic validation
      const semanticErrors = this.performSemanticValidation(workingConfig);
      if (semanticErrors.length > 0) {
        result.valid = false;
        result.errors.push(...semanticErrors);
      }

    } catch (error) {
      result.errors.push(`Validation error: ${error.message}`);
      this.logger?.error('Configuration validation failed:', error);
    }

    return result;
  }

  /**
   * Migrate configuration from one version to another
   * @param {Object} config - Configuration to migrate
   * @returns {Object} Migration result
   */
  migrateConfig(config) {
    const result = {
      success: false,
      migratedConfig: null,
      errors: []
    };

    try {
      const sourceVersion = config.version || 'unversioned';
      let workingConfig = { ...config };
      
      // Apply migrations in sequence
      const migrationPath = this.findMigrationPath(sourceVersion, this.currentVersion);
      
      for (const migrationKey of migrationPath) {
        const migration = this.migrations.get(migrationKey);
        if (!migration) {
          result.errors.push(`Migration not found: ${migrationKey}`);
          return result;
        }
        
        workingConfig = migration(workingConfig);
        this.logger?.debug(`Applied migration: ${migrationKey}`);
      }
      
      result.success = true;
      result.migratedConfig = workingConfig;
      
    } catch (error) {
      result.errors.push(`Migration failed: ${error.message}`);
      this.logger?.error('Configuration migration failed:', error);
    }

    return result;
  }

  /**
   * Find migration path between versions
   * @param {string} fromVersion - Source version
   * @param {string} toVersion - Target version  
   * @returns {Array} Array of migration keys
   */
  findMigrationPath(fromVersion, toVersion) {
    // For now, simple direct migrations
    // In future, could implement complex version graphs
    
    if (fromVersion === 'unversioned' && toVersion === '1.0.0') {
      return ['unversioned->1.0.0'];
    }
    
    if (fromVersion === toVersion) {
      return [];
    }
    
    throw new Error(`No migration path from ${fromVersion} to ${toVersion}`);
  }

  /**
   * Perform semantic validation beyond JSON schema
   * @param {Object} config - Configuration to validate
   * @returns {Array} Array of error messages
   */
  performSemanticValidation(config) {
    const errors = [];

    try {
      // Validate button configurations don't exceed device limits
      const buttonKeys = Object.keys(config.buttons || {});
      const maxButtons = config.device.buttons;
      
      for (const buttonKey of buttonKeys) {
        const buttonNumber = parseInt(buttonKey.replace('button', ''));
        if (buttonNumber > maxButtons) {
          errors.push(`Button ${buttonNumber} configured but device only has ${maxButtons} buttons`);
        }
      }

      // Validate encoder configurations don't exceed device limits
      const encoderKeys = Object.keys(config.encoders || {});
      const maxEncoders = config.device.encoders;
      
      for (const encoderKey of encoderKeys) {
        const encoderNumber = parseInt(encoderKey.replace('encoder', ''));
        if (encoderNumber > maxEncoders) {
          errors.push(`Encoder ${encoderNumber} configured but device only has ${maxEncoders} encoders`);
        }
      }

      // Validate security settings consistency
      if (config.security?.commandExecution?.mode === 'allowlist') {
        const allowedCommands = config.security.commandExecution.allowedCommands || [];
        if (allowedCommands.length === 0) {
          errors.push('Allowlist mode enabled but no commands are allowed - all command actions will fail');
        }
      }

      // Validate action references
      this.validateActionReferences(config, errors);

    } catch (error) {
      errors.push(`Semantic validation error: ${error.message}`);
    }

    return errors;
  }

  /**
   * Validate action references in button/encoder configs
   * @param {Object} config - Configuration object
   * @param {Array} errors - Error array to append to
   */
  validateActionReferences(config, errors) {
    const commandExecutionDisabled = config.security?.commandExecution?.enabled === false;

    // Check button actions
    for (const [buttonKey, buttonConfig] of Object.entries(config.buttons || {})) {
      if (buttonConfig.type === 'command' && commandExecutionDisabled) {
        errors.push(`Button ${buttonKey} uses command action but command execution is disabled`);
      }
      
      if (buttonConfig.type === 'keypress' && !buttonConfig.action) {
        errors.push(`Button ${buttonKey} has keypress type but no action specified`);
      }
    }

    // Check encoder actions
    for (const [encoderKey, encoderConfig] of Object.entries(config.encoders || {})) {
      if (encoderConfig.typeCW === 'command' && commandExecutionDisabled) {
        errors.push(`Encoder ${encoderKey} CW action uses command but command execution is disabled`);
      }
      if (encoderConfig.typeCCW === 'command' && commandExecutionDisabled) {
        errors.push(`Encoder ${encoderKey} CCW action uses command but command execution is disabled`);
      }
    }
  }

  /**
   * Format AJV validation errors into human-readable messages
   * @param {Array} ajvErrors - Array of AJV error objects
   * @returns {Array} Array of formatted error messages
   */
  formatValidationErrors(ajvErrors) {
    if (!ajvErrors || !Array.isArray(ajvErrors)) {
      return ['Unknown validation error'];
    }

    return ajvErrors.map(error => {
      const path = error.instancePath || error.dataPath || 'root';
      const message = error.message || 'validation failed';
      
      switch (error.keyword) {
        case 'required':
          return `Missing required field: ${path}/${error.params.missingProperty}`;
        case 'type':
          return `Invalid type at ${path}: expected ${error.params.type}, got ${typeof error.data}`;
        case 'enum':
          return `Invalid value at ${path}: must be one of [${error.params.allowedValues.join(', ')}]`;
        case 'minimum':
          return `Value too small at ${path}: must be >= ${error.params.limit}`;
        case 'maximum':
          return `Value too large at ${path}: must be <= ${error.params.limit}`;
        case 'minLength':
          return `String too short at ${path}: must be at least ${error.params.limit} characters`;
        case 'maxLength':
          return `String too long at ${path}: must be at most ${error.params.limit} characters`;
        case 'pattern':
          return `Invalid format at ${path}: ${message}`;
        default:
          return `Validation error at ${path}: ${message}`;
      }
    });
  }

  /**
   * Create backup of configuration file
   * @param {string} configPath - Path to configuration file
   * @returns {string} Backup file path
   */
  createConfigBackup(configPath) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${configPath}.backup.${timestamp}`;
      
      if (fs.existsSync(configPath)) {
        fs.copyFileSync(configPath, backupPath);
        this.logger?.info(`Configuration backed up to: ${backupPath}`);
        return backupPath;
      }
    } catch (error) {
      this.logger?.warn('Failed to create configuration backup:', error);
    }
    
    return null;
  }

  /**
   * Save validated configuration to file
   * @param {Object} config - Validated configuration object
   * @param {string} configPath - Path to save configuration
   * @returns {boolean} Success status
   */
  async saveConfig(config, configPath) {
    try {
      // Create backup first
      this.createConfigBackup(configPath);
      
      // Ensure directory exists
      const configDir = path.dirname(configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      // Convert to YAML and save
      const yamlContent = yaml.dump(config, { 
        indent: 2,
        lineWidth: 120,
        noRefs: true
      });
      
      fs.writeFileSync(configPath, yamlContent, 'utf8');
      this.logger?.info(`Configuration saved to: ${configPath}`);
      
      return true;
    } catch (error) {
      this.logger?.error('Failed to save configuration:', error);
      return false;
    }
  }

  /**
   * Get current schema version
   * @returns {string} Current schema version
   */
  getCurrentVersion() {
    return this.currentVersion;
  }

  /**
   * Get validation statistics
   * @returns {Object} Schema and validation statistics
   */
  getStats() {
    return {
      schemaVersion: this.currentVersion,
      availableMigrations: Array.from(this.migrations.keys()),
      schemaProperties: Object.keys(this.schema?.properties || {}),
      compiledValidatorReady: !!this.validate
    };
  }
}

module.exports = {
  ConfigValidator,
  CONFIG_SCHEMA_VERSION
};