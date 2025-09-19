/**
 * Enhanced Error Handling System for Macro Keyboard
 * 
 * Provides centralized error handling, categorization, logging, and recovery strategies
 * for all system components including hardware, configuration, and action execution.
 */

const EventEmitter = require('events');

/**
 * Error Categories and Types
 */
const ErrorTypes = {
  HARDWARE: {
    SERIAL_CONNECTION_FAILED: 'SERIAL_CONNECTION_FAILED',
    SERIAL_WRITE_FAILED: 'SERIAL_WRITE_FAILED',
    SERIAL_READ_TIMEOUT: 'SERIAL_READ_TIMEOUT',
    DEVICE_NOT_FOUND: 'DEVICE_NOT_FOUND',
    DEVICE_DISCONNECTED: 'DEVICE_DISCONNECTED',
    ARDUINO_COMMUNICATION_ERROR: 'ARDUINO_COMMUNICATION_ERROR',
    INVALID_HARDWARE_RESPONSE: 'INVALID_HARDWARE_RESPONSE'
  },
  CONFIGURATION: {
    CONFIG_FILE_NOT_FOUND: 'CONFIG_FILE_NOT_FOUND',
    CONFIG_PARSE_ERROR: 'CONFIG_PARSE_ERROR',
    CONFIG_VALIDATION_ERROR: 'CONFIG_VALIDATION_ERROR',
    CONFIG_SAVE_FAILED: 'CONFIG_SAVE_FAILED',
    INVALID_BUTTON_CONFIG: 'INVALID_BUTTON_CONFIG',
    INVALID_ENCODER_CONFIG: 'INVALID_ENCODER_CONFIG'
  },
  ACTION: {
    ACTION_EXECUTION_FAILED: 'ACTION_EXECUTION_FAILED',
    INVALID_ACTION_TYPE: 'INVALID_ACTION_TYPE',
    COMMAND_BLOCKED: 'COMMAND_BLOCKED',
    APPLICATION_LAUNCH_FAILED: 'APPLICATION_LAUNCH_FAILED',
    KEYPRESS_FAILED: 'KEYPRESS_FAILED'
  },
  SYSTEM: {
    INITIALIZATION_FAILED: 'INITIALIZATION_FAILED',
    LOGGER_INIT_FAILED: 'LOGGER_INIT_FAILED',
    IPC_ERROR: 'IPC_ERROR',
    RESOURCE_NOT_AVAILABLE: 'RESOURCE_NOT_AVAILABLE',
    PERMISSION_DENIED: 'PERMISSION_DENIED'
  }
};

/**
 * Error Severity Levels
 */
const ErrorSeverity = {
  LOW: 'LOW',           // Warning, system continues normally
  MEDIUM: 'MEDIUM',     // Error, but system can recover
  HIGH: 'HIGH',         // Critical error, system functionality impaired
  CRITICAL: 'CRITICAL'  // System cannot continue, requires restart/intervention
};

/**
 * Enhanced Error Class with categorization and recovery information
 */
class MacroKeyboardError extends Error {
  constructor(type, message, originalError = null, context = {}) {
    super(message);
    this.name = 'MacroKeyboardError';
    this.type = type;
    this.originalError = originalError;
    this.context = context;
    this.timestamp = new Date().toISOString();
    this.severity = this.determineSeverity(type);
    this.recoverable = this.determineRecoverable(type);
    this.userMessage = this.generateUserMessage(type, context);
    this.recoveryActions = this.getRecoveryActions(type);
  }

  determineSeverity(type) {
    const criticalErrors = [
      ErrorTypes.SYSTEM.INITIALIZATION_FAILED,
      ErrorTypes.SYSTEM.LOGGER_INIT_FAILED
    ];
    
    const highErrors = [
      ErrorTypes.HARDWARE.SERIAL_CONNECTION_FAILED,
      ErrorTypes.CONFIGURATION.CONFIG_PARSE_ERROR,
      ErrorTypes.ACTION.COMMAND_BLOCKED
    ];
    
    const mediumErrors = [
      ErrorTypes.HARDWARE.DEVICE_DISCONNECTED,
      ErrorTypes.CONFIGURATION.CONFIG_VALIDATION_ERROR,
      ErrorTypes.ACTION.ACTION_EXECUTION_FAILED
    ];
    
    if (criticalErrors.includes(type)) return ErrorSeverity.CRITICAL;
    if (highErrors.includes(type)) return ErrorSeverity.HIGH;
    if (mediumErrors.includes(type)) return ErrorSeverity.MEDIUM;
    return ErrorSeverity.LOW;
  }

  determineRecoverable(type) {
    const nonRecoverableErrors = [
      ErrorTypes.SYSTEM.INITIALIZATION_FAILED,
      ErrorTypes.SYSTEM.LOGGER_INIT_FAILED,
      ErrorTypes.SYSTEM.PERMISSION_DENIED
    ];
    
    return !nonRecoverableErrors.includes(type);
  }

  generateUserMessage(type, context) {
    const messages = {
      [ErrorTypes.HARDWARE.SERIAL_CONNECTION_FAILED]: `Could not connect to macro keyboard on ${context.port || 'unknown port'}. Check USB connection.`,
      [ErrorTypes.HARDWARE.DEVICE_NOT_FOUND]: 'Macro keyboard not detected. Ensure it\'s connected and drivers are installed.',
      [ErrorTypes.HARDWARE.DEVICE_DISCONNECTED]: 'Macro keyboard was disconnected. Attempting to reconnect...',
      [ErrorTypes.CONFIGURATION.CONFIG_FILE_NOT_FOUND]: 'Configuration file not found. Creating default configuration.',
      [ErrorTypes.CONFIGURATION.CONFIG_PARSE_ERROR]: 'Configuration file contains errors. Using default settings.',
      [ErrorTypes.ACTION.ACTION_EXECUTION_FAILED]: `Failed to execute action: ${context.action || 'unknown action'}`,
      [ErrorTypes.ACTION.COMMAND_BLOCKED]: `Command blocked for security: ${context.command || 'unknown command'}`,
      [ErrorTypes.SYSTEM.INITIALIZATION_FAILED]: 'Application failed to start. Please restart the application.'
    };
    
    return messages[type] || `An error occurred: ${type}`;
  }

  getRecoveryActions(type) {
    const recoveryActions = {
      [ErrorTypes.HARDWARE.SERIAL_CONNECTION_FAILED]: [
        'Check USB cable connection',
        'Verify Arduino is powered on',
        'Try a different USB port',
        'Restart the application'
      ],
      [ErrorTypes.HARDWARE.DEVICE_NOT_FOUND]: [
        'Connect the macro keyboard via USB',
        'Install Arduino drivers if needed',
        'Check Device Manager (Windows) or System Information (macOS)'
      ],
      [ErrorTypes.HARDWARE.DEVICE_DISCONNECTED]: [
        'Reconnect the USB cable',
        'Wait for automatic reconnection',
        'Restart the application if problems persist'
      ],
      [ErrorTypes.CONFIGURATION.CONFIG_PARSE_ERROR]: [
        'Check configuration file syntax',
        'Restore from backup',
        'Reset to default configuration'
      ],
      [ErrorTypes.ACTION.ACTION_EXECUTION_FAILED]: [
        'Check action configuration',
        'Verify target application is installed',
        'Try a different action type'
      ]
    };
    
    return recoveryActions[type] || ['Restart the application', 'Contact support if problem persists'];
  }

  toJSON() {
    return {
      name: this.name,
      type: this.type,
      message: this.message,
      userMessage: this.userMessage,
      severity: this.severity,
      recoverable: this.recoverable,
      timestamp: this.timestamp,
      context: this.context,
      recoveryActions: this.recoveryActions,
      stack: this.stack
    };
  }
}

/**
 * Centralized Error Handler
 */
class ErrorHandler extends EventEmitter {
  constructor(logger = null) {
    super();
    this.logger = logger;
    this.errorHistory = [];
    this.maxHistorySize = 100;
    this.retryAttempts = new Map();
    this.maxRetries = 3;
    
    // Bind methods to preserve context
    this.handleError = this.handleError.bind(this);
    this.createError = this.createError.bind(this);
  }

  /**
   * Create a categorized error
   */
  createError(type, message, originalError = null, context = {}) {
    return new MacroKeyboardError(type, message, originalError, context);
  }

  /**
   * Handle an error with logging, recovery, and user notification
   */
  async handleError(error, component = 'unknown') {
    let macroError;
    
    if (error instanceof MacroKeyboardError) {
      macroError = error;
    } else {
      // Wrap regular errors
      macroError = new MacroKeyboardError(
        ErrorTypes.SYSTEM.RESOURCE_NOT_AVAILABLE,
        error.message || 'Unknown error occurred',
        error,
        { component }
      );
    }

    // Add to history
    this.addToHistory(macroError, component);
    
    // Log the error
    this.logError(macroError, component);
    
    // Emit error event for listeners
    this.emit('error', macroError, component);
    
    // Attempt recovery if possible
    if (macroError.recoverable) {
      await this.attemptRecovery(macroError, component);
    }
    
    // Notify user interface
    this.emit('userNotification', {
      type: 'error',
      message: macroError.userMessage,
      severity: macroError.severity,
      actions: macroError.recoveryActions,
      errorId: macroError.timestamp
    });
    
    return macroError;
  }

  /**
   * Add error to history with size management
   */
  addToHistory(error, component) {
    this.errorHistory.push({
      error,
      component,
      timestamp: error.timestamp
    });
    
    // Maintain history size
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Log error based on severity
   */
  logError(error, component) {
    if (!this.logger) return;
    
    const logData = {
      component,
      type: error.type,
      severity: error.severity,
      recoverable: error.recoverable,
      context: error.context,
      message: error.message
    };
    
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        this.logger.error('CRITICAL ERROR:', logData);
        break;
      case ErrorSeverity.HIGH:
        this.logger.error('HIGH SEVERITY ERROR:', logData);
        break;
      case ErrorSeverity.MEDIUM:
        this.logger.warn('MEDIUM SEVERITY ERROR:', logData);
        break;
      case ErrorSeverity.LOW:
      default:
        this.logger.info('LOW SEVERITY ERROR:', logData);
        break;
    }
    
    if (error.originalError) {
      this.logger.error('Original error stack:', error.originalError.stack);
    }
  }

  /**
   * Attempt automatic recovery based on error type
   */
  async attemptRecovery(error, component) {
    const retryKey = `${component}:${error.type}`;
    const attempts = this.retryAttempts.get(retryKey) || 0;
    
    if (attempts >= this.maxRetries) {
      this.logger?.warn(`Max retry attempts reached for ${retryKey}`);
      return false;
    }
    
    this.retryAttempts.set(retryKey, attempts + 1);
    
    this.logger?.info(`Attempting recovery for ${error.type} (attempt ${attempts + 1}/${this.maxRetries})`);
    
    try {
      const recovered = await this.executeRecovery(error, component);
      
      if (recovered) {
        this.retryAttempts.delete(retryKey);
        this.emit('recovery', { error, component, attempts: attempts + 1 });
        this.logger?.info(`Recovery successful for ${error.type}`);
      }
      
      return recovered;
    } catch (recoveryError) {
      this.logger?.error(`Recovery attempt failed for ${error.type}:`, recoveryError);
      return false;
    }
  }

  /**
   * Execute specific recovery strategies
   */
  async executeRecovery(error, component) {
    switch (error.type) {
      case ErrorTypes.HARDWARE.DEVICE_DISCONNECTED:
        return this.recoverSerialConnection(error.context);
      
      case ErrorTypes.CONFIGURATION.CONFIG_FILE_NOT_FOUND:
        return this.createDefaultConfig(error.context);
      
      case ErrorTypes.ACTION.ACTION_EXECUTION_FAILED:
        return this.retryActionExecution(error.context);
      
      default:
        // Generic recovery - wait and retry
        await this.sleep(1000 * (this.retryAttempts.get(`${component}:${error.type}`) || 1));
        return false;
    }
  }

  /**
   * Attempt to recover serial connection
   */
  async recoverSerialConnection(context) {
    this.emit('serialRecovery', context);
    // Recovery logic will be handled by the serial component
    return false; // Let the serial component handle reconnection
  }

  /**
   * Create default configuration file
   */
  async createDefaultConfig(context) {
    try {
      this.emit('configRecovery', 'createDefault');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Retry action execution
   */
  async retryActionExecution(context) {
    try {
      this.emit('actionRetry', context);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Utility function for delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    const stats = {
      total: this.errorHistory.length,
      bySeverity: {},
      byType: {},
      byComponent: {},
      recentErrors: this.errorHistory.slice(-10)
    };
    
    this.errorHistory.forEach(({ error, component }) => {
      // By severity
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
      
      // By type
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
      
      // By component
      stats.byComponent[component] = (stats.byComponent[component] || 0) + 1;
    });
    
    return stats;
  }

  /**
   * Clear error history
   */
  clearHistory() {
    this.errorHistory = [];
    this.retryAttempts.clear();
  }

  /**
   * Get recent errors for debugging
   */
  getRecentErrors(count = 10) {
    return this.errorHistory.slice(-count);
  }
}

module.exports = {
  ErrorHandler,
  MacroKeyboardError,
  ErrorTypes,
  ErrorSeverity
};