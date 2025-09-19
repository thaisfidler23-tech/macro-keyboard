/**
 * Error Handler Tests
 * 
 * Comprehensive tests for the error handling system including error categorization,
 * logging, recovery mechanisms, and user notifications.
 */

const { ErrorHandler, MacroKeyboardError, ErrorTypes, ErrorSeverity } = require('../src/ErrorHandler');

describe('ErrorHandler System', () => {
  let errorHandler;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    errorHandler = new ErrorHandler(mockLogger);
    // Suppress error events during tests
    errorHandler.on('error', () => {});
  });

  afterEach(() => {
    if (errorHandler) {
      errorHandler.removeAllListeners();
      errorHandler.clearHistory();
    }
    jest.clearAllMocks();
  });

  describe('MacroKeyboardError Class', () => {
    test('should create error with correct properties', () => {
      const originalError = new Error('Original error');
      const context = { component: 'TestComponent' };
      
      const error = new MacroKeyboardError(
        ErrorTypes.HARDWARE.DEVICE_NOT_FOUND,
        'Test error message',
        originalError,
        context
      );

      expect(error.type).toBe(ErrorTypes.HARDWARE.DEVICE_NOT_FOUND);
      expect(error.message).toBe('Test error message');
      expect(error.originalError).toBe(originalError);
      expect(error.context).toEqual(context);
      expect(error.timestamp).toBeDefined();
      expect(error.severity).toBe(ErrorSeverity.LOW); // DEVICE_NOT_FOUND is LOW severity
      expect(error.recoverable).toBe(true);
    });

    test('should determine correct severity levels', () => {
      const criticalError = new MacroKeyboardError(ErrorTypes.SYSTEM.INITIALIZATION_FAILED, 'Critical error');
      const highError = new MacroKeyboardError(ErrorTypes.HARDWARE.SERIAL_CONNECTION_FAILED, 'High error');
      const mediumError = new MacroKeyboardError(ErrorTypes.HARDWARE.DEVICE_DISCONNECTED, 'Medium error');
      const lowError = new MacroKeyboardError(ErrorTypes.HARDWARE.DEVICE_NOT_FOUND, 'Low error');

      expect(criticalError.severity).toBe(ErrorSeverity.CRITICAL);
      expect(highError.severity).toBe(ErrorSeverity.HIGH);
      expect(mediumError.severity).toBe(ErrorSeverity.MEDIUM);
      expect(lowError.severity).toBe(ErrorSeverity.LOW);
    });

    test('should generate appropriate user messages', () => {
      const deviceError = new MacroKeyboardError(ErrorTypes.HARDWARE.DEVICE_NOT_FOUND, 'Device not found');
      const configError = new MacroKeyboardError(ErrorTypes.CONFIGURATION.CONFIG_PARSE_ERROR, 'Parse error');
      const actionError = new MacroKeyboardError(ErrorTypes.ACTION.ACTION_EXECUTION_FAILED, 'Action failed');

      expect(deviceError.userMessage).toContain('not detected');
      expect(configError.userMessage).toContain('Configuration file contains errors');
      expect(actionError.userMessage).toContain('Failed to execute action');
    });

    test('should provide recovery actions', () => {
      const deviceError = new MacroKeyboardError(ErrorTypes.HARDWARE.DEVICE_NOT_FOUND, 'Device not found');
      
      expect(Array.isArray(deviceError.recoveryActions)).toBe(true);
      expect(deviceError.recoveryActions.length).toBeGreaterThan(0);
      expect(deviceError.recoveryActions).toContain('Connect the macro keyboard via USB');
    });

    test('should serialize to JSON correctly', () => {
      const error = new MacroKeyboardError(
        ErrorTypes.HARDWARE.DEVICE_NOT_FOUND,
        'Test error',
        new Error('Original'),
        { port: '/dev/ttyUSB0' }
      );

      const json = error.toJSON();

      expect(json.type).toBe(ErrorTypes.HARDWARE.DEVICE_NOT_FOUND);
      expect(json.message).toBe('Test error');
      expect(json.severity).toBe(ErrorSeverity.LOW); // DEVICE_NOT_FOUND is LOW severity
      expect(json.recoverable).toBe(true);
      expect(json.context).toEqual({ port: '/dev/ttyUSB0' });
      expect(json.timestamp).toBeDefined();
      expect(json.userMessage).toBeDefined();
      expect(json.recoveryActions).toBeDefined();
    });
  });

  describe('ErrorHandler Class', () => {
    test('should initialize correctly', () => {
      expect(errorHandler.logger).toBe(mockLogger);
      expect(errorHandler.errorHistory).toEqual([]);
      expect(errorHandler.retryAttempts).toBeInstanceOf(Map);
      expect(errorHandler.maxHistorySize).toBe(100);
      expect(errorHandler.maxRetries).toBe(3); // Use maxRetries, not maxRetryAttempts
    });

    test('should create errors correctly', () => {
      const error = errorHandler.createError(
        ErrorTypes.HARDWARE.DEVICE_NOT_FOUND,
        'Test message',
        new Error('Original'),
        { component: 'test' }
      );

      expect(error).toBeInstanceOf(MacroKeyboardError);
      expect(error.type).toBe(ErrorTypes.HARDWARE.DEVICE_NOT_FOUND);
      expect(error.message).toBe('Test message');
      expect(error.context).toEqual({ component: 'test' });
    });

    test('should handle errors without throwing', async () => {
      const error = new MacroKeyboardError(
        ErrorTypes.HARDWARE.DEVICE_DISCONNECTED,
        'Device disconnected'
      );

      expect(async () => {
        await errorHandler.handleError(error);
      }).not.toThrow();

      expect(errorHandler.errorHistory).toHaveLength(1);
      expect(errorHandler.errorHistory[0].error).toBe(error); // Check wrapped error structure
      expect(errorHandler.errorHistory[0].component).toBe('unknown');
    });

    test('should log errors with appropriate levels', async () => {
      const criticalError = new MacroKeyboardError(
        ErrorTypes.SYSTEM.INITIALIZATION_FAILED,
        'Critical error'
      );

      await errorHandler.handleError(criticalError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'CRITICAL ERROR:',
        expect.objectContaining({
          type: 'INITIALIZATION_FAILED',
          severity: 'CRITICAL',
          component: 'unknown',
          message: 'Critical error'
        })
      );
    });

    test('should maintain error history with size limit', async () => {
      errorHandler.maxHistorySize = 3;

      // Add more errors than the limit
      for (let i = 0; i < 5; i++) {
        const error = new MacroKeyboardError(
          ErrorTypes.ACTION.ACTION_EXECUTION_FAILED,
          `Error ${i}`
        );
        await errorHandler.handleError(error);
      }

      expect(errorHandler.errorHistory).toHaveLength(3);
      // Should keep the most recent errors
      expect(errorHandler.errorHistory[0].error.message).toBe('Error 2');
      expect(errorHandler.errorHistory[2].error.message).toBe('Error 4');
    });

    test('should clear history correctly', async () => {
      const error = new MacroKeyboardError(
        ErrorTypes.ACTION.ACTION_EXECUTION_FAILED,
        'Test error'
      );
      await errorHandler.handleError(error);

      expect(errorHandler.errorHistory).toHaveLength(1);

      errorHandler.clearHistory();

      expect(errorHandler.errorHistory).toHaveLength(0);
      expect(errorHandler.retryAttempts.size).toBe(0);
    });

    test('should return recent errors', async () => {
      for (let i = 0; i < 15; i++) {
        const error = new MacroKeyboardError(
          ErrorTypes.ACTION.ACTION_EXECUTION_FAILED,
          `Error ${i}`
        );
        await errorHandler.handleError(error);
      }

      const recentErrors = errorHandler.getRecentErrors(5);
      expect(recentErrors).toHaveLength(5);
      // Should return most recent errors (wrapped in history objects)
      expect(recentErrors[0].error.message).toBe('Error 10'); // slice(-5) starts from index 10
      expect(recentErrors[4].error.message).toBe('Error 14');
    });

    test('should provide error statistics', async () => {
      // Clear any previous errors
      errorHandler.clearHistory();
      
      const errors = [
        new MacroKeyboardError(ErrorTypes.HARDWARE.DEVICE_DISCONNECTED, 'Hardware error 1'),
        new MacroKeyboardError(ErrorTypes.CONFIGURATION.CONFIG_PARSE_ERROR, 'Config error'),
        new MacroKeyboardError(ErrorTypes.ACTION.ACTION_EXECUTION_FAILED, 'Action error'),
        new MacroKeyboardError(ErrorTypes.HARDWARE.DEVICE_NOT_FOUND, 'Hardware error 2')
      ];

      for (const error of errors) {
        await errorHandler.handleError(error);
      }

      const stats = errorHandler.getErrorStats();
      expect(stats.total).toBe(4);
      expect(stats.bySeverity[ErrorSeverity.MEDIUM]).toBe(2); // Device disconnected + action failed
      expect(stats.bySeverity[ErrorSeverity.HIGH]).toBe(1); // Config parse error
      expect(stats.bySeverity[ErrorSeverity.LOW]).toBe(1); // Device not found
      expect(stats.byComponent.unknown).toBe(4); // All are 'unknown' component
    });
  });

  describe('Error Recovery Mechanisms', () => {
    test('should emit serialRecovery event for device disconnection errors', async () => {
      const serialRecoverySpy = jest.fn();
      errorHandler.on('serialRecovery', serialRecoverySpy);

      const error = new MacroKeyboardError(
        ErrorTypes.HARDWARE.DEVICE_DISCONNECTED,
        'Connection failed',
        null,
        { port: '/dev/ttyUSB0' }
      );

      await errorHandler.executeRecovery(error);

      expect(serialRecoverySpy).toHaveBeenCalledWith({ port: '/dev/ttyUSB0' });
    });

    test('should emit configRecovery event for config file not found errors', async () => {
      const configRecoverySpy = jest.fn();
      errorHandler.on('configRecovery', configRecoverySpy);

      const error = new MacroKeyboardError(
        ErrorTypes.CONFIGURATION.CONFIG_FILE_NOT_FOUND,
        'File not found',
        null,
        { configPath: '/path/to/config.yaml' }
      );

      await errorHandler.executeRecovery(error);

      expect(configRecoverySpy).toHaveBeenCalledWith('createDefault');
    });

    test('should emit actionRetry event for action errors', async () => {
      const actionRetrySpy = jest.fn();
      errorHandler.on('actionRetry', actionRetrySpy);

      const error = new MacroKeyboardError(
        ErrorTypes.ACTION.ACTION_EXECUTION_FAILED,
        'Action failed',
        null,
        { actionId: 'test-action' }
      );

      await errorHandler.executeRecovery(error);

      expect(actionRetrySpy).toHaveBeenCalledWith({ actionId: 'test-action' });
    });

    test('should implement sleep for generic recovery', async () => {
      const startTime = Date.now();
      
      const error = new MacroKeyboardError(
        ErrorTypes.SYSTEM.RESOURCE_NOT_AVAILABLE,
        'Resource error'
      );

      await errorHandler.executeRecovery(error);
      
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(1000); // Should sleep for 1 second
    });
  });

  describe('Error Types and Categories', () => {
    test('should have all required error types defined', () => {
      expect(ErrorTypes.HARDWARE).toBeDefined();
      expect(ErrorTypes.CONFIGURATION).toBeDefined();
      expect(ErrorTypes.ACTION).toBeDefined();
      expect(ErrorTypes.SYSTEM).toBeDefined();

      expect(ErrorTypes.HARDWARE.DEVICE_NOT_FOUND).toBe('DEVICE_NOT_FOUND');
      expect(ErrorTypes.HARDWARE.SERIAL_CONNECTION_FAILED).toBe('SERIAL_CONNECTION_FAILED');
      expect(ErrorTypes.CONFIGURATION.CONFIG_PARSE_ERROR).toBe('CONFIG_PARSE_ERROR');
      expect(ErrorTypes.ACTION.ACTION_EXECUTION_FAILED).toBe('ACTION_EXECUTION_FAILED');
    });

    test('should have all severity levels defined', () => {
      expect(ErrorSeverity.LOW).toBe('LOW');
      expect(ErrorSeverity.MEDIUM).toBe('MEDIUM');
      expect(ErrorSeverity.HIGH).toBe('HIGH');
      expect(ErrorSeverity.CRITICAL).toBe('CRITICAL');
    });
  });

  describe('Integration with Logger', () => {
    test('should work without logger', () => {
      const handlerWithoutLogger = new ErrorHandler();
      expect(handlerWithoutLogger.logger).toBeNull();
      
      expect(() => {
        handlerWithoutLogger.createError(ErrorTypes.SYSTEM.RESOURCE_NOT_AVAILABLE, 'Test');
      }).not.toThrow();
    });
  });
});