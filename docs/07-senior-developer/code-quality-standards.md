# Code Quality Standards & Best Practices

## Senior Developer Quality Standards

This document establishes the code quality standards for the macro-keyboard project, ensuring maintainable, secure, and performant code that meets enterprise-grade requirements.

## Code Quality Metrics

### Linting Standards
- **Zero Tolerance**: All linting errors must be resolved before merge
- **Warning Threshold**: Maximum 5 warnings per file
- **Custom Rules**: Enhanced ESLint configuration with security-focused rules
- **Automated Fixes**: Use `npm run lint:fix` for automatic corrections

### Test Coverage Requirements
- **Unit Test Coverage**: Minimum 80% line coverage
- **Integration Tests**: Critical paths must have integration test coverage
- **Error Path Testing**: All error handling paths must be tested
- **Performance Tests**: Key operations must have performance benchmarks

## Code Style Guidelines

### JavaScript/Node.js Standards

```javascript
// ✅ Good: Proper async/await with error handling
async function executeAction(actionConfig, context) {
  try {
    this.logger.info(`Executing ${actionConfig.type} action for ${context}`);
    const result = await this.performAction(actionConfig);
    return { success: true, result };
  } catch (error) {
    this.logger.error(`Action execution failed for ${context}:`, error);
    throw new EnhancedError(
      ErrorTypes.ACTION.ACTION_EXECUTION_FAILED,
      `Failed to execute ${actionConfig.type}`,
      error,
      { context, actionConfig: actionConfig.type }
    );
  }
}

// ❌ Bad: Missing error handling and unclear naming
async function doStuff(cfg, ctx) {
  return this.thing(cfg);
}
```

### Error Handling Standards

```javascript
// ✅ Good: Comprehensive error handling with recovery
class SerialConnectionManager {
  async connect(port, options = {}) {
    const retryAttempts = options.retryAttempts || 3;
    let lastError;
    
    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        await this.attemptConnection(port, options);
        return { success: true, port };
      } catch (error) {
        lastError = error;
        this.logger.warn(`Connection attempt ${attempt}/${retryAttempts} failed:`, error.message);
        
        if (attempt < retryAttempts) {
          await this.sleep(1000 * attempt); // Progressive backoff
        }
      }
    }
    
    throw new ConnectionError(`Failed to connect after ${retryAttempts} attempts`, lastError);
  }
}
```

### Performance Standards

```javascript
// ✅ Good: Performance monitoring integration
class PerformanceOptimizedClass {
  async processData(data) {
    const timer = this.performanceMonitor.startTimer('processData');
    
    try {
      // Batch processing for large datasets
      const batchSize = 100;
      const results = [];
      
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        const batchResult = await this.processBatch(batch);
        results.push(...batchResult);
        
        // Yield control to prevent blocking
        if (i % (batchSize * 10) === 0) {
          await this.sleep(0);
        }
      }
      
      return results;
    } finally {
      timer.end();
    }
  }
}
```

## Security Standards

### Input Validation
```javascript
// ✅ Good: Comprehensive input validation
validateActionConfig(actionConfig) {
  if (!actionConfig || typeof actionConfig !== 'object') {
    throw new ValidationError('Action config must be a valid object');
  }
  
  if (!actionConfig.type || typeof actionConfig.type !== 'string') {
    throw new ValidationError('Action type is required and must be a string');
  }
  
  if (!this.allowedActionTypes.includes(actionConfig.type)) {
    throw new ValidationError(`Unsupported action type: ${actionConfig.type}`);
  }
  
  // Type-specific validation
  switch (actionConfig.type) {
    case 'command':
      this.validateCommandAction(actionConfig);
      break;
    case 'keypress':
      this.validateKeypressAction(actionConfig);
      break;
    default:
      this.validateGenericAction(actionConfig);
  }
}
```

### Secure Command Execution
```javascript
// ✅ Good: Security-first command execution
async executeCommand(command, context) {
  // Security validation
  const validationResult = this.securityManager.validateCommand(command);
  if (!validationResult.isValid) {
    throw new SecurityError(`Command blocked: ${validationResult.reason}`);
  }
  
  // Sandboxed execution with timeout
  const options = {
    timeout: this.commandTimeout,
    killSignal: 'SIGTERM',
    maxBuffer: 1024 * 1024, // 1MB limit
    shell: false // Prevent shell injection
  };
  
  return this.executeWithTimeout(command, options);
}
```

## Architecture Standards

### Dependency Injection
```javascript
// ✅ Good: Proper dependency injection
class ActionExecutor {
  constructor(dependencies) {
    this.logger = dependencies.logger || new NullLogger();
    this.securityManager = dependencies.securityManager;
    this.performanceMonitor = dependencies.performanceMonitor;
    
    // Validate required dependencies
    if (!this.securityManager) {
      throw new InitializationError('SecurityManager is required');
    }
  }
}
```

### Event-Driven Architecture
```javascript
// ✅ Good: Clean event handling with error boundaries
class EventDrivenComponent extends EventEmitter {
  constructor() {
    super();
    this.setupErrorHandling();
  }
  
  setupErrorHandling() {
    this.on('error', (error) => {
      this.logger.error('Component error:', error);
      this.emit('component-error', { error, component: this.constructor.name });
    });
  }
  
  async processEvent(eventType, data) {
    try {
      await this.handleEvent(eventType, data);
      this.emit('event-processed', { eventType, success: true });
    } catch (error) {
      this.emit('error', error);
      this.emit('event-processed', { eventType, success: false, error });
    }
  }
}
```

## Documentation Standards

### Code Comments
```javascript
/**
 * Execute a macro action with comprehensive error handling and logging
 * 
 * @param {Object} actionConfig - Configuration object for the action
 * @param {string} actionConfig.type - Type of action ('keypress', 'command', 'application')
 * @param {string} actionConfig.action - The specific action to execute
 * @param {Object} [actionConfig.options] - Optional parameters for action execution
 * @param {string} context - Context identifier for logging and debugging
 * @returns {Promise<Object>} Result object with success status and data
 * @throws {ActionExecutionError} When action execution fails
 * @throws {ValidationError} When action configuration is invalid
 * @throws {SecurityError} When action is blocked by security policy
 * 
 * @example
 * const result = await actionExecutor.executeAction({
 *   type: 'keypress',
 *   action: 'ctrl+c',
 *   options: { repeat: 1 }
 * }, 'button1');
 */
async executeAction(actionConfig, context = 'unknown') {
  // Implementation...
}
```

### README Documentation
Each module should include:
- Purpose and responsibilities
- API documentation with examples
- Configuration options
- Error handling information
- Performance considerations
- Security implications

## Testing Standards

### Unit Test Structure
```javascript
describe('ActionExecutor', () => {
  let actionExecutor;
  let mockLogger;
  let mockSecurityManager;
  
  beforeEach(() => {
    mockLogger = createMockLogger();
    mockSecurityManager = createMockSecurityManager();
    
    actionExecutor = new ActionExecutor({
      logger: mockLogger,
      securityManager: mockSecurityManager
    });
  });
  
  describe('executeAction', () => {
    it('should execute valid keypress action successfully', async () => {
      // Arrange
      const actionConfig = { type: 'keypress', action: 'ctrl+c' };
      mockSecurityManager.validateAction.mockReturnValue({ isValid: true });
      
      // Act
      const result = await actionExecutor.executeAction(actionConfig, 'test');
      
      // Assert
      expect(result.success).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Executing keypress action for test')
      );
    });
    
    it('should handle security validation failure', async () => {
      // Arrange
      const actionConfig = { type: 'command', action: 'rm -rf /' };
      mockSecurityManager.validateAction.mockReturnValue({ 
        isValid: false, 
        reason: 'Dangerous command blocked' 
      });
      
      // Act & Assert
      await expect(actionExecutor.executeAction(actionConfig, 'test'))
        .rejects.toThrow(SecurityError);
    });
  });
});
```

### Integration Test Standards
```javascript
describe('Serial Connection Integration', () => {
  let serialManager;
  let testPort;
  
  beforeAll(async () => {
    testPort = await findTestSerialPort();
    serialManager = new SerialConnectionManager();
  });
  
  afterAll(async () => {
    if (serialManager.isConnected()) {
      await serialManager.disconnect();
    }
  });
  
  it('should establish connection and receive data', async (done) => {
    const timeout = setTimeout(() => {
      done(new Error('Test timed out'));
    }, 10000);
    
    serialManager.on('data', (data) => {
      clearTimeout(timeout);
      expect(data).toBeDefined();
      done();
    });
    
    await serialManager.connect(testPort);
  }, 15000);
});
```

## Performance Standards

### Benchmarking
```javascript
describe('Performance Benchmarks', () => {
  it('should process button actions within acceptable time', async () => {
    const startTime = process.hrtime.bigint();
    
    await actionExecutor.executeAction({
      type: 'keypress',
      action: 'ctrl+c'
    }, 'performance-test');
    
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1e6;
    
    expect(durationMs).toBeLessThan(100); // 100ms threshold
  });
});
```

### Memory Management
- Always cleanup resources in finally blocks
- Use WeakMap/WeakSet for caching when appropriate
- Monitor memory usage in long-running operations
- Implement resource pooling for expensive operations

## Deployment Standards

### Environment Configuration
```yaml
# config/production.yaml
logging:
  level: "info"
  enableConsole: false
  enableRemote: true
  maxFileSize: 10485760  # 10MB
  
security:
  commandExecution:
    mode: "whitelist"
    timeout: 5000
    
performance:
  monitoring:
    enabled: true
    alertThresholds:
      memory: 500MB
      cpu: 70%
```

### Health Checks
```javascript
class HealthMonitor {
  async performHealthCheck() {
    const checks = [
      this.checkMemoryUsage(),
      this.checkSerialConnection(),
      this.checkConfigValidation(),
      this.checkDatabaseConnection()
    ];
    
    const results = await Promise.allSettled(checks);
    
    return {
      status: results.every(r => r.status === 'fulfilled') ? 'healthy' : 'unhealthy',
      checks: results.map((r, i) => ({
        name: this.checkNames[i],
        status: r.status,
        error: r.reason?.message
      })),
      timestamp: new Date().toISOString()
    };
  }
}
```

## Quality Gates

### Pre-commit Requirements
1. **Linting**: All files must pass ESLint without errors
2. **Testing**: All tests must pass with minimum 80% coverage
3. **Security**: Security scan must pass without high-severity issues
4. **Performance**: Critical path performance tests must pass

### Code Review Checklist
- [ ] Code follows established patterns and conventions
- [ ] Error handling is comprehensive and appropriate
- [ ] Security implications have been considered
- [ ] Performance impact is acceptable
- [ ] Tests cover new functionality and edge cases
- [ ] Documentation is updated for public APIs
- [ ] Logging and monitoring are appropriate

## Continuous Improvement

### Metrics Tracking
- Code quality metrics (linting issues, test coverage)
- Performance metrics (response times, memory usage)
- Security metrics (vulnerabilities, security scan results)
- Development velocity (commit frequency, review time)

### Regular Reviews
- Weekly code quality review
- Monthly architecture review
- Quarterly security audit
- Annual performance optimization review

---

**Maintained by**: Senior Development Team  
**Last Updated**: December 2025  
**Version**: 1.0.0