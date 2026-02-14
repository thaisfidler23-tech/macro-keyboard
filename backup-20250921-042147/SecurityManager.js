/**
 * Security Manager for Macro Keyboard
 * Provides comprehensive security validation, sanitization, and policy enforcement
 */

const path = require('path');
const os = require('os');

class SecurityManager {
  constructor(logger, config = {}) {
    this.logger = logger;
    this.updateConfiguration(config);

    // System information for context-aware validation
    this.platform = process.platform;
    this.homeDir = os.homedir();
    this.systemPaths = this.getSystemPaths();

    this.logger.info('SecurityManager initialized with security policies');
  }

  /**
   * Update security configuration
   * @param {Object} config - Security configuration object
   */
  updateConfiguration(config = {}) {
    this.config = {
      commandExecution: {
        enabled: config.commandExecution?.enabled ?? true,
        mode: config.commandExecution?.mode ?? 'blacklist', // 'allowlist', 'blacklist', 'disabled'
        allowedCommands: config.commandExecution?.allowedCommands ?? [],
        blockedCommands: config.commandExecution?.blockedCommands ?? [],
        timeout: config.commandExecution?.timeout ?? 10000,
        maxLength: config.commandExecution?.maxLength ?? 500, // Reduced for security
        allowEnvironmentAccess: config.commandExecution?.allowEnvironmentAccess ?? false,
        allowSystemPaths: config.commandExecution?.allowSystemPaths ?? false,
        allowNetworkAccess: config.commandExecution?.allowNetworkAccess ?? false,
        requireAbsolutePaths: config.commandExecution?.requireAbsolutePaths ?? false
      },
      keypress: {
        enabled: config.keypress?.enabled ?? true,
        maxSequenceLength: config.keypress?.maxSequenceLength ?? 20,
        allowFunctionKeys: config.keypress?.allowFunctionKeys ?? true,
        allowSystemKeys: config.keypress?.allowSystemKeys ?? true
      },
      application: {
        enabled: config.application?.enabled ?? true,
        allowedApplications: config.application?.allowedApplications ?? [],
        blockedApplications: config.application?.blockedApplications ?? [],
        requireFullPath: config.application?.requireFullPath ?? false,
        allowSystemApplications: config.application?.allowSystemApplications ?? true
      },
      logging: {
        logSecurityEvents: config.logging?.logSecurityEvents ?? true,
        logBlockedActions: config.logging?.logBlockedActions ?? true,
        detailedLogging: config.logging?.detailedLogging ?? false
      }
    };
  }

  /**
   * Validate any action based on its type
   * @param {Object} actionConfig - Action configuration
   * @param {string} context - Context for logging
   * @returns {Object} Validation result with success flag and sanitized action
   */
  validateAction(actionConfig, context = 'unknown') {
    if (!actionConfig || !actionConfig.type || actionConfig.action === undefined) {
      return this.createValidationResult(false, 'Invalid action configuration', actionConfig);
    }

    const { type, action } = actionConfig;

    try {
      switch (type) {
      case 'keypress':
        return this.validateKeypress(action, context);
      case 'command':
        return this.validateCommand(action, context);
      case 'application':
        return this.validateApplication(action, context);
      default:
        return this.createValidationResult(false, `Unknown action type: ${type}`, action);
      }
    } catch (error) {
      this.logger.error(`Security validation error for ${context}:`, error);
      return this.createValidationResult(false, `Validation error: ${error.message}`, action);
    }
  }

  /**
   * Validate keypress actions
   * @param {string} keystroke - Keystroke sequence
   * @param {string} context - Context for logging
   * @returns {Object} Validation result
   */
  validateKeypress(keystroke, context) {
    if (!this.config.keypress.enabled) {
      return this.createValidationResult(false, 'Keypress actions are disabled', keystroke);
    }

    if (!keystroke || typeof keystroke !== 'string') {
      return this.createValidationResult(false, 'Invalid keystroke format', keystroke);
    }

    // Length validation
    if (keystroke.length > this.config.keypress.maxSequenceLength * 10) { // Generous multiplier for key names
      return this.createValidationResult(false, 'Keystroke sequence too long', keystroke);
    }

    // Sanitize and validate keystroke
    const sanitizedKeystroke = this.sanitizeKeystroke(keystroke);

    if (!this.config.keypress.allowFunctionKeys && this.containsFunctionKeys(sanitizedKeystroke)) {
      return this.createValidationResult(false, 'Function keys are not allowed', keystroke);
    }

    if (!this.config.keypress.allowSystemKeys && this.containsSystemKeys(sanitizedKeystroke)) {
      return this.createValidationResult(false, 'System keys are not allowed', keystroke);
    }

    this.logSecurityEvent('keypress', 'allowed', context, sanitizedKeystroke);
    return this.createValidationResult(true, 'Keystroke validated', sanitizedKeystroke);
  }

  /**
   * Validate command execution with comprehensive security checks
   * @param {string} command - Command to validate
   * @param {string} context - Context for logging
   * @returns {Object} Validation result
   */
  validateCommand(command, context) {
    if (!this.config.commandExecution.enabled) {
      return this.createValidationResult(false, 'Command execution is disabled', command);
    }

    if (!command || typeof command !== 'string') {
      return this.createValidationResult(false, 'Invalid command format', command);
    }

    // Basic length and format validation
    const lengthValidation = this.validateCommandLength(command);
    if (!lengthValidation.success) {
      return lengthValidation;
    }

    // Sanitize command
    const sanitizedCommand = this.sanitizeCommand(command);

    // Mode-based validation
    const modeValidation = this.validateCommandByMode(sanitizedCommand, context);
    if (!modeValidation.success) {
      return modeValidation;
    }

    // Pattern-based security validation
    const patternValidation = this.validateCommandPatterns(sanitizedCommand);
    if (!patternValidation.success) {
      return patternValidation;
    }

    // Path and environment validation
    const environmentValidation = this.validateCommandEnvironment(sanitizedCommand);
    if (!environmentValidation.success) {
      return environmentValidation;
    }

    this.logSecurityEvent('command', 'allowed', context, sanitizedCommand);
    return this.createValidationResult(true, 'Command validated', sanitizedCommand);
  }

  /**
   * Validate application launching
   * @param {string} application - Application to launch
   * @param {string} context - Context for logging
   * @returns {Object} Validation result
   */
  validateApplication(application, context) {
    if (!this.config.application.enabled) {
      return this.createValidationResult(false, 'Application launching is disabled', application);
    }

    if (!application || typeof application !== 'string') {
      return this.createValidationResult(false, 'Invalid application format', application);
    }

    const sanitizedApp = this.sanitizeApplication(application);

    // Check blocked applications
    if (this.config.application.blockedApplications.length > 0) {
      const isBlocked = this.config.application.blockedApplications.some(blocked =>
        sanitizedApp.toLowerCase().includes(blocked.toLowerCase())
      );
      if (isBlocked) {
        this.logSecurityEvent('application', 'blocked', context, sanitizedApp);
        return this.createValidationResult(false, 'Application is blocked', application);
      }
    }

    // Check allowed applications (if allowlist mode)
    if (this.config.application.allowedApplications.length > 0) {
      const isAllowed = this.config.application.allowedApplications.some(allowed =>
        sanitizedApp.toLowerCase().includes(allowed.toLowerCase()) ||
        allowed.toLowerCase() === '*'
      );
      if (!isAllowed) {
        this.logSecurityEvent('application', 'not-allowed', context, sanitizedApp);
        return this.createValidationResult(false, 'Application is not in allowed list', application);
      }
    }

    // Validate application path
    if (this.config.application.requireFullPath && !path.isAbsolute(sanitizedApp)) {
      return this.createValidationResult(false, 'Application must be specified with full path', application);
    }

    // System applications check
    if (!this.config.application.allowSystemApplications && this.isSystemApplication(sanitizedApp)) {
      return this.createValidationResult(false, 'System applications are not allowed', application);
    }

    this.logSecurityEvent('application', 'allowed', context, sanitizedApp);
    return this.createValidationResult(true, 'Application validated', sanitizedApp);
  }

  /**
   * Validate command length
   * @param {string} command - Command to validate
   * @returns {Object} Validation result
   */
  validateCommandLength(command) {
    if (command.length > this.config.commandExecution.maxLength) {
      return this.createValidationResult(
        false,
        `Command too long: ${command.length}/${this.config.commandExecution.maxLength} characters`,
        command
      );
    }
    return this.createValidationResult(true, 'Length valid', command);
  }

  /**
   * Validate command based on allow/block list mode
   * @param {string} command - Command to validate
   * @param {string} context - Context for logging
   * @returns {Object} Validation result
   */
  validateCommandByMode(command, context) {
    const mode = this.config.commandExecution.mode;

    if (mode === 'disabled') {
      return this.createValidationResult(false, 'Command execution is disabled', command);
    }

    const commandBase = command.split(' ')[0].toLowerCase();

    if (mode === 'allowlist') {
      const allowed = this.config.commandExecution.allowedCommands;
      if (allowed.length === 0) {
        return this.createValidationResult(false, 'No commands are allowed (empty allowlist)', command);
      }

      const isAllowed = allowed.some(allowedCmd =>
        commandBase === allowedCmd.toLowerCase() ||
        command.toLowerCase().startsWith(`${allowedCmd.toLowerCase()  } `) ||
        allowedCmd === '*'
      );

      if (!isAllowed) {
        this.logSecurityEvent('command', 'not-in-allowlist', context, command);
        return this.createValidationResult(false, 'Command not in allowed list', command);
      }
    } else if (mode === 'blacklist') {
      const blocked = this.config.commandExecution.blockedCommands;
      const isBlocked = blocked.some(blockedCmd =>
        commandBase === blockedCmd.toLowerCase() ||
        command.toLowerCase().includes(blockedCmd.toLowerCase())
      );

      if (isBlocked) {
        this.logSecurityEvent('command', 'in-blacklist', context, command);
        return this.createValidationResult(false, 'Command is blocked', command);
      }
    }

    return this.createValidationResult(true, 'Mode validation passed', command);
  }

  /**
   * Validate command against dangerous patterns
   * @param {string} command - Command to validate
   * @returns {Object} Validation result
   */
  validateCommandPatterns(command) {
    const dangerousPatterns = [
      // File system operations
      { pattern: /rm\s+-rf/i, description: 'Recursive file deletion' },
      { pattern: /\|\s*rm/i, description: 'Piped deletion' },
      { pattern: /;\s*rm/i, description: 'Chained deletion' },
      { pattern: /&&\s*rm/i, description: 'Conditional deletion' },
      { pattern: /mv\s+.*\/dev\/null/i, description: 'Move to null device' },

      // System access
      { pattern: /sudo\s/i, description: 'Privilege escalation' },
      { pattern: /su\s/i, description: 'User switching' },
      { pattern: /passwd\s/i, description: 'Password modification' },
      { pattern: /adduser|useradd/i, description: 'User creation' },
      { pattern: /chmod\s.*[4-7][0-7][0-7]/i, description: 'Dangerous permissions' },
      { pattern: /chown\s.*root/i, description: 'Root ownership change' },

      // Network and downloads
      { pattern: /wget.*\|.*sh/i, description: 'Download and execute' },
      { pattern: /curl.*\|.*sh/i, description: 'Download and execute' },
      { pattern: /nc\s.*-l/i, description: 'Network listener' },
      { pattern: /netcat.*-l/i, description: 'Network listener' },

      // Code execution
      { pattern: /\$\(.*\)/g, description: 'Command substitution' },
      { pattern: /`.*`/g, description: 'Backtick execution' },
      { pattern: /<\s*\(/g, description: 'Process substitution' },
      { pattern: /eval\s/i, description: 'Dynamic evaluation' },
      { pattern: /exec\s/i, description: 'Process execution' },

      // System files
      { pattern: /\/etc\/passwd/i, description: 'Password file access' },
      { pattern: /\/etc\/shadow/i, description: 'Shadow file access' },
      { pattern: /\/etc\/sudoers/i, description: 'Sudoers file access' },
      { pattern: /\/proc\//i, description: 'Process filesystem access' },
      { pattern: /\/sys\//i, description: 'System filesystem access' },
      { pattern: /\/dev\/(?!null|zero|random|urandom)/i, description: 'Device access' },

      // Environment manipulation
      { pattern: /export\s.*PATH/i, description: 'PATH manipulation' },
      { pattern: /unset\s/i, description: 'Environment unset' },

      // Redirection abuse
      { pattern: />\s*\/etc\//i, description: 'System directory write' },
      { pattern: />>\s*\/etc\//i, description: 'System directory append' },
      { pattern: /<\s*\/dev\/tcp/i, description: 'Network redirection' }
    ];

    for (const { pattern, description } of dangerousPatterns) {
      if (pattern.test(command)) {
        return this.createValidationResult(
          false,
          `Command contains dangerous pattern (${description}): ${pattern}`,
          command
        );
      }
    }

    return this.createValidationResult(true, 'Pattern validation passed', command);
  }

  /**
   * Validate command environment access
   * @param {string} command - Command to validate
   * @returns {Object} Validation result
   */
  validateCommandEnvironment(command) {
    // Environment variable access
    if (!this.config.commandExecution.allowEnvironmentAccess) {
      const envPatterns = [
        /\$\w+/g,              // Environment variable references
        /\$\{[^}]+\}/g,        // Complex environment variable references
        /env\s/i,              // Env command
        /printenv/i           // Print environment
      ];

      for (const pattern of envPatterns) {
        if (pattern.test(command)) {
          return this.createValidationResult(
            false,
            'Environment variable access not allowed',
            command
          );
        }
      }
    }

    // System path access
    if (!this.config.commandExecution.allowSystemPaths) {
      for (const systemPath of this.systemPaths) {
        if (command.toLowerCase().includes(systemPath.toLowerCase())) {
          return this.createValidationResult(
            false,
            `System path access not allowed: ${systemPath}`,
            command
          );
        }
      }
    }

    // Network access validation
    if (!this.config.commandExecution.allowNetworkAccess) {
      const networkPatterns = [
        /wget\s/i, /curl\s/i, /nc\s/i, /netcat\s/i, /telnet\s/i,
        /ssh\s/i, /scp\s/i, /rsync\s/i, /ftp\s/i, /sftp\s/i
      ];

      for (const pattern of networkPatterns) {
        if (pattern.test(command)) {
          return this.createValidationResult(
            false,
            'Network access not allowed',
            command
          );
        }
      }
    }

    return this.createValidationResult(true, 'Environment validation passed', command);
  }

  /**
   * Sanitize command input
   * @param {string} command - Command to sanitize
   * @returns {string} Sanitized command
   */
  sanitizeCommand(command) {
    // Remove dangerous characters and sequences
    return command
      .trim()
      .replace(/[\x00-\x1f\x7f-\x9f]/g, '') // Remove control characters
      .replace(/[^\x20-\x7e\s]/g, '')       // Remove non-printable characters
      .replace(/\s+/g, ' ')                 // Normalize whitespace
      .substring(0, this.config.commandExecution.maxLength); // Enforce length limit
  }

  /**
   * Sanitize keystroke input
   * @param {string} keystroke - Keystroke to sanitize
   * @returns {string} Sanitized keystroke
   */
  sanitizeKeystroke(keystroke) {
    return keystroke
      .trim()
      .replace(/[^\w+\-\s]/g, '') // Allow only alphanumeric, +, -, and spaces
      .replace(/\s+/g, ' ')       // Normalize whitespace
      .toLowerCase();
  }

  /**
   * Sanitize application input
   * @param {string} application - Application to sanitize
   * @returns {string} Sanitized application
   */
  sanitizeApplication(application) {
    return application
      .trim()
      .replace(/[^\w\-\/\.\s\\:]/g, '') // Allow path characters
      .replace(/\s+/g, ' ')             // Normalize whitespace
      .replace(/\.{2,}/g, '.')          // Prevent path traversal
      .substring(0, 500);               // Reasonable length limit
  }

  /**
   * Check if keystroke contains function keys
   * @param {string} keystroke - Keystroke to check
   * @returns {boolean} True if contains function keys
   */
  containsFunctionKeys(keystroke) {
    const functionKeyPattern = /f\d+/i;
    return functionKeyPattern.test(keystroke);
  }

  /**
   * Check if keystroke contains system keys
   * @param {string} keystroke - Keystroke to check
   * @returns {boolean} True if contains system keys
   */
  containsSystemKeys(keystroke) {
    const systemKeys = ['alt+f4', 'cmd+q', 'ctrl+alt+del', 'win+r', 'cmd+space'];
    const lowerKeystroke = keystroke.toLowerCase();
    return systemKeys.some(key => lowerKeystroke.includes(key));
  }

  /**
   * Check if application is a system application
   * @param {string} application - Application to check
   * @returns {boolean} True if system application
   */
  isSystemApplication(application) {
    const systemApps = [
      'regedit', 'msconfig', 'services.msc', 'gpedit.msc',
      'system preferences', 'activity monitor', 'terminal', 'cmd',
      'powershell', 'bash', 'zsh', 'sh'
    ];
    const lowerApp = application.toLowerCase();
    return systemApps.some(app => lowerApp.includes(app));
  }

  /**
   * Get system paths based on platform
   * @returns {Array} Array of system paths
   */
  getSystemPaths() {
    const common = ['/etc', '/usr/bin', '/usr/sbin', '/bin', '/sbin'];

    switch (this.platform) {
    case 'win32':
      return ['C:\\Windows', 'C:\\Program Files', 'C:\\Program Files (x86)', ...common];
    case 'darwin':
      return ['/System', '/Applications', '/Library', ...common];
    default:
      return [...common, '/root', '/boot', '/proc', '/sys'];
    }
  }

  /**
   * Create standardized validation result
   * @param {boolean} success - Validation success
   * @param {string} message - Validation message
   * @param {any} sanitizedAction - Sanitized action
   * @returns {Object} Validation result
   */
  createValidationResult(success, message, sanitizedAction = null) {
    const result = {
      success,
      message,
      sanitizedAction,
      timestamp: new Date().toISOString()
    };

    if (!success && this.config.logging.logBlockedActions) {
      this.logger.warn(`Security validation failed: ${message}`, {
        action: sanitizedAction,
        timestamp: result.timestamp
      });
    }

    return result;
  }

  /**
   * Log security events
   * @param {string} actionType - Type of action
   * @param {string} eventType - Type of event (allowed, blocked, etc.)
   * @param {string} context - Context information
   * @param {any} action - Action details
   */
  logSecurityEvent(actionType, eventType, context, action) {
    if (!this.config.logging.logSecurityEvents) {
      return;
    }

    const logData = {
      actionType,
      eventType,
      context,
      action: this.config.logging.detailedLogging ? action : '[REDACTED]',
      timestamp: new Date().toISOString(),
      platform: this.platform
    };

    if (eventType === 'allowed') {
      this.logger.info(`Security: ${actionType} action allowed for ${context}`, logData);
    } else {
      this.logger.warn(`Security: ${actionType} action ${eventType} for ${context}`, logData);
    }
  }

  /**
   * Get security statistics
   * @returns {Object} Security statistics
   */
  getSecurityStats() {
    return {
      configuration: {
        commandExecutionEnabled: this.config.commandExecution.enabled,
        commandMode: this.config.commandExecution.mode,
        allowedCommandsCount: this.config.commandExecution.allowedCommands.length,
        blockedCommandsCount: this.config.commandExecution.blockedCommands.length,
        maxCommandLength: this.config.commandExecution.maxLength,
        networkAccessAllowed: this.config.commandExecution.allowNetworkAccess,
        systemPathsAllowed: this.config.commandExecution.allowSystemPaths
      },
      platform: this.platform,
      systemPathsCount: this.systemPaths.length,
      securityLevel: this.calculateSecurityLevel()
    };
  }

  /**
   * Calculate overall security level
   * @returns {string} Security level (low, medium, high, maximum)
   */
  calculateSecurityLevel() {
    let score = 0;

    // Command execution restrictions
    if (!this.config.commandExecution.enabled) {
      score += 3;
    } else if (this.config.commandExecution.mode === 'disabled') {
      score += 3;
    } else if (this.config.commandExecution.mode === 'allowlist') {
      score += 2;
    } else {
      score += 1;
    } // blacklist mode

    // Additional restrictions
    if (!this.config.commandExecution.allowNetworkAccess) {
      score += 1;
    }
    if (!this.config.commandExecution.allowSystemPaths) {
      score += 1;
    }
    if (!this.config.commandExecution.allowEnvironmentAccess) {
      score += 1;
    }
    if (this.config.commandExecution.maxLength <= 200) {
      score += 1;
    }

    // Application restrictions
    if (!this.config.application.enabled) {
      score += 1;
    } else if (this.config.application.allowedApplications.length > 0) {
      score += 1;
    }

    if (score >= 8) {
      return 'maximum';
    }
    if (score >= 6) {
      return 'high';
    }
    if (score >= 4) {
      return 'medium';
    }
    return 'low';
  }

  // UI-focused methods for security policy management

  /**
   * Get complete security configuration for UI
   * @returns {Object} Complete security configuration
   */
  getSecurityConfiguration() {
    return {
      ...this.config,
      metadata: {
        securityLevel: this.calculateSecurityLevel(),
        platform: this.platform,
        systemPathsCount: this.systemPaths.length,
        lastUpdated: new Date().toISOString()
      }
    };
  }

  /**
   * Update security policy configuration
   * @param {Object} newConfig - New security configuration
   * @returns {Object} Update result with validation
   */
  updateSecurityPolicy(newConfig) {
    try {
      // Validate configuration structure
      const validationResult = this.validateSecurityConfiguration(newConfig);
      if (!validationResult.valid) {
        return {
          success: false,
          message: 'Invalid security configuration',
          errors: validationResult.errors
        };
      }

      // Apply configuration
      this.updateConfiguration(newConfig);

      this.logger.info('Security policy updated successfully', {
        newLevel: this.calculateSecurityLevel(),
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        message: 'Security policy updated successfully',
        newLevel: this.calculateSecurityLevel()
      };
    } catch (error) {
      this.logger.error('Failed to update security policy:', error);
      return {
        success: false,
        message: `Failed to update security policy: ${error.message}`
      };
    }
  }

  /**
   * Validate security configuration structure
   * @param {Object} config - Configuration to validate
   * @returns {Object} Validation result
   */
  validateSecurityConfiguration(config) {
    const errors = [];

    // Validate command execution configuration
    if (config.commandExecution) {
      if (config.commandExecution.mode &&
          !['allowlist', 'blacklist', 'disabled'].includes(config.commandExecution.mode)) {
        errors.push('Invalid command execution mode');
      }

      if (config.commandExecution.maxLength &&
          (typeof config.commandExecution.maxLength !== 'number' || config.commandExecution.maxLength < 1)) {
        errors.push('Invalid max command length');
      }

      if (config.commandExecution.timeout &&
          (typeof config.commandExecution.timeout !== 'number' || config.commandExecution.timeout < 1000)) {
        errors.push('Invalid command timeout (minimum 1000ms)');
      }
    }

    // Validate keypress configuration
    if (config.keypress) {
      if (config.keypress.maxSequenceLength &&
          (typeof config.keypress.maxSequenceLength !== 'number' || config.keypress.maxSequenceLength < 1)) {
        errors.push('Invalid keypress sequence length');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get security audit events (mock implementation for UI)
   * @param {Object} options - Filter options
   * @returns {Array} Audit events
   */
  getSecurityAuditEvents(options = {}) {
    // In a real implementation, this would query actual audit logs
    // For now, return mock data for UI development
    const events = [
      {
        id: '1',
        timestamp: new Date().toISOString(),
        type: 'policy_change',
        severity: 'info',
        message: 'Security policy updated',
        details: { component: 'commandExecution', action: 'update_mode' }
      },
      {
        id: '2',
        timestamp: new Date(Date.now() - 60000).toISOString(),
        type: 'action_blocked',
        severity: 'warning',
        message: 'Command blocked by security policy',
        details: { command: 'rm -rf /', reason: 'dangerous_pattern' }
      }
    ];

    // Apply filters
    let filteredEvents = events;

    if (options.type) {
      filteredEvents = filteredEvents.filter(event => event.type === options.type);
    }

    if (options.severity) {
      filteredEvents = filteredEvents.filter(event => event.severity === options.severity);
    }

    if (options.limit) {
      filteredEvents = filteredEvents.slice(0, options.limit);
    }

    return filteredEvents;
  }

  /**
   * Get user roles and permissions configuration
   * @returns {Object} User roles configuration
   */
  getUserRoles() {
    // Default role configuration - in a real app this would be configurable
    return {
      guest: {
        permissions: ['view_config', 'basic_macros'],
        restrictions: ['no_system_commands', 'no_file_access'],
        description: 'Limited access for guest users'
      },
      user: {
        permissions: ['view_config', 'edit_config', 'all_macros'],
        restrictions: ['no_admin_functions', 'limited_file_access'],
        description: 'Standard user with macro configuration access'
      },
      power_user: {
        permissions: ['all_user_permissions', 'plugin_management', 'advanced_config'],
        restrictions: ['no_security_admin', 'no_user_management'],
        description: 'Advanced user with plugin and advanced configuration access'
      },
      admin: {
        permissions: ['all_permissions'],
        restrictions: [],
        description: 'Full administrative access'
      }
    };
  }

  /**
   * Update user role configuration
   * @param {string} roleName - Name of the role
   * @param {Object} roleConfig - Role configuration
   * @returns {Object} Update result
   */
  updateUserRole(roleName, roleConfig) {
    try {
      // Validate role configuration
      if (!roleName || typeof roleName !== 'string') {
        return { success: false, message: 'Invalid role name' };
      }

      if (!roleConfig.permissions || !Array.isArray(roleConfig.permissions)) {
        return { success: false, message: 'Invalid permissions array' };
      }

      // In a real implementation, this would update the role configuration
      this.logger.info(`User role ${roleName} updated successfully`, {
        permissions: roleConfig.permissions,
        restrictions: roleConfig.restrictions || []
      });

      return {
        success: true,
        message: `Role ${roleName} updated successfully`
      };
    } catch (error) {
      this.logger.error(`Failed to update user role ${roleName}:`, error);
      return {
        success: false,
        message: `Failed to update role: ${error.message}`
      };
    }
  }

  /**
   * Test security policy against sample actions
   * @param {Array} testActions - Array of actions to test
   * @returns {Array} Test results
   */
  testSecurityPolicy(testActions = []) {
    const defaultTestActions = [
      { type: 'command', action: 'ls -la' },
      { type: 'command', action: 'rm -rf /' },
      { type: 'keypress', action: 'ctrl+c' },
      { type: 'application', action: 'Calculator' }
    ];

    const actionsToTest = testActions.length > 0 ? testActions : defaultTestActions;

    return actionsToTest.map(action => {
      const result = this.validateAction(action, 'policy_test');
      return {
        action,
        result: {
          allowed: result.success,
          reason: result.message,
          sanitized: result.sanitizedAction
        }
      };
    });
  }
}

module.exports = SecurityManager;
