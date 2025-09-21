# Development Standards & Coding Guidelines
**Macro Keyboard Platform - Technical Standards Document**

**Document Version**: 1.0  
**Last Updated**: December 20, 2025  
**Scope**: All JavaScript/Node.js, Arduino C++, and configuration code  
**Compliance**: Mandatory for all team members and contributors

---

## 📋 **Executive Summary**

This document establishes comprehensive coding standards, best practices, and development guidelines for the macro-keyboard platform. These standards ensure code consistency, maintainability, and quality while supporting rapid development and team collaboration.

**Key Principles:**
- **Consistency First**: Uniform code style across all modules
- **Maintainability Focus**: Code that is easy to read, understand, and modify
- **Security by Design**: Secure coding practices integrated into development workflow
- **Performance Awareness**: Efficient code that scales with user demands
- **Test-Driven Approach**: Comprehensive testing as part of development process

---

## 🏗️ **Architecture Standards**

### **1. Module Design Principles**

#### **Single Responsibility Principle (SRP)**
Each module must have one clear, well-defined responsibility.

```javascript
// ✅ Good - Single responsibility
class SerialConnectionManager {
  connect() { /* Handle only serial connections */ }
  disconnect() { /* Handle disconnections */ }
  send() { /* Handle data transmission */ }
}

// ❌ Bad - Multiple responsibilities  
class SerialAndConfigManager {
  connect() { /* Serial connection */ }
  loadConfig() { /* Configuration management */ }
  validateButtons() { /* Button validation */ }
}
```

#### **Dependency Injection Standard**
All modules must use consistent dependency injection patterns for testability and maintainability.

```javascript
// ✅ Required Pattern - Standardized dependency injection
class ModuleName {
  constructor(dependencies = {}) {
    // Required dependencies - throw if missing
    this.logger = dependencies.logger;
    this.config = dependencies.config;
    
    if (!this.logger) {
      throw new Error('Logger dependency is required');
    }
    
    // Optional dependencies - provide defaults
    this.errorHandler = dependencies.errorHandler || new ErrorHandler();
    this.performanceMonitor = dependencies.performanceMonitor || null;
    
    // Initialize after dependency validation
    this.initialize();
  }
  
  initialize() {
    this.logger.info(`${this.constructor.name} initialized successfully`);
  }
}
```

#### **Event-Driven Communication**
Use EventEmitter pattern for inter-module communication.

```javascript
// ✅ Required Pattern - Event-driven communication
class HardwareManager extends EventEmitter {
  constructor(dependencies) {
    super();
    this.setupEventHandlers();
  }
  
  handleButtonPress(buttonId) {
    // Emit events instead of direct calls
    this.emit('button-pressed', { 
      buttonId, 
      timestamp: Date.now(),
      context: this.getCurrentContext() 
    });
  }
  
  setupEventHandlers() {
    this.on('hardware-connected', this.onHardwareConnected.bind(this));
    this.on('hardware-error', this.onHardwareError.bind(this));
  }
}
```

### **2. Error Handling Standards**

#### **Centralized Error Management**
All errors must be handled through the ErrorHandler system.

```javascript
// ✅ Required Pattern - Centralized error handling
class ActionExecutor {
  async executeAction(action) {
    try {
      const result = await this.performAction(action);
      this.logger.info('Action executed successfully', { action, result });
      return result;
    } catch (error) {
      // Use centralized error handling
      const categorizedError = this.errorHandler.categorizeError(error, {
        context: 'action-execution',
        action: action.type,
        timestamp: Date.now()
      });
      
      this.errorHandler.handleError(categorizedError);
      throw categorizedError; // Re-throw for caller handling
    }
  }
}
```

#### **Error Recovery Strategies**
Implement graceful degradation and recovery mechanisms.

```javascript
// ✅ Required Pattern - Error recovery implementation
class SerialConnectionManager {
  async connectWithRetry(maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.connect();
        this.state = ConnectionState.CONNECTED;
        return; // Success - exit retry loop
      } catch (error) {
        this.logger.warn(`Connection attempt ${attempt} failed`, { error });
        
        if (attempt === maxRetries) {
          // Final failure - enter degraded mode
          this.enterDegradedMode();
          throw new HardwareError('Connection failed after retries', error);
        }
        
        // Wait before retry with exponential backoff
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }
  }
}
```

---

## 💻 **JavaScript/Node.js Coding Standards**

### **1. Code Style and Formatting**

#### **ESLint Configuration (eslint.config.js)**
```javascript
// Standard ESLint configuration - MANDATORY
export default [
  {
    files: ["src/**/*.js", "tests/**/*.js"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly"
      }
    },
    rules: {
      // Formatting rules
      "indent": ["error", 2, { "SwitchCase": 1 }],
      "linebreak-style": ["error", "unix"],
      "quotes": ["error", "single", { "avoidEscape": true }],
      "semi": ["error", "always"],
      "comma-dangle": ["error", "never"],
      
      // Code quality rules
      "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
      "no-console": ["warn"], // Use logger instead
      "prefer-const": ["error"],
      "no-var": ["error"],
      "eqeqeq": ["error", "always"],
      
      // Complexity rules
      "complexity": ["warn", 10],
      "max-lines-per-function": ["warn", 50],
      "max-params": ["warn", 4]
    }
  }
];
```

#### **Variable Naming Conventions**
```javascript
// ✅ Required naming conventions
const CONFIG_FILE_PATH = './config/default.yaml';    // Constants: SCREAMING_SNAKE_CASE
const serialPortManager = new SerialPortManager();   // Variables: camelCase
const MAX_RETRY_ATTEMPTS = 5;                        // Constants: SCREAMING_SNAKE_CASE

class PluginManager {                                // Classes: PascalCase
  constructor() {
    this.activePlugins = new Map();                  // Properties: camelCase
    this.isInitialized = false;                      // Booleans: is/has/can prefixes
  }
  
  loadPlugin(pluginPath) {                           // Methods: camelCase, descriptive
    // Private methods should use _ prefix
    return this._validatePlugin(pluginPath);
  }
  
  _validatePlugin(pluginPath) {                      // Private: _camelCase
    // Implementation
  }
}
```

#### **Function Documentation Standards**
```javascript
/**
 * Execute a macro action with comprehensive error handling and logging
 * 
 * @param {Object} action - The action configuration object
 * @param {string} action.type - Action type (keypress, command, etc.)
 * @param {Object} action.parameters - Action-specific parameters
 * @param {Object} [context={}] - Execution context information
 * @param {number} [context.buttonId] - Button that triggered the action
 * @param {string} [context.profileId] - Active profile identifier
 * @returns {Promise<Object>} Execution result with success status and data
 * @throws {ActionError} When action execution fails
 * 
 * @example
 * const result = await actionExecutor.executeAction({
 *   type: 'keypress',
 *   parameters: { keys: ['ctrl', 'c'] }
 * }, { buttonId: 1, profileId: 'default' });
 */
async executeAction(action, context = {}) {
  // Implementation with proper error handling
}
```

### **2. Asynchronous Programming Standards**

#### **Promise and Async/Await Usage**
```javascript
// ✅ Required Pattern - Proper async/await usage
class ConfigManager {
  async loadConfiguration(configPath) {
    try {
      const configData = await fs.readFile(configPath, 'utf8');
      const parsedConfig = yaml.parse(configData);
      
      // Validate configuration
      await this.validateConfiguration(parsedConfig);
      
      this.logger.info('Configuration loaded successfully', { 
        path: configPath,
        buttonCount: parsedConfig.hardware?.buttonCount 
      });
      
      return parsedConfig;
    } catch (error) {
      this.logger.error('Failed to load configuration', { 
        path: configPath, 
        error: error.message 
      });
      throw new ConfigurationError(`Config load failed: ${error.message}`, error);
    }
  }
  
  // ❌ Avoid callback patterns - use async/await
  loadConfigurationOld(configPath, callback) {
    fs.readFile(configPath, 'utf8', (err, data) => {
      // This pattern is deprecated
    });
  }
}
```

#### **Error Propagation Standards**
```javascript
// ✅ Required Pattern - Proper error propagation
class PluginLoader {
  async loadPlugin(pluginPath) {
    try {
      await this.validatePluginPath(pluginPath);
      const plugin = await this.instantiatePlugin(pluginPath);
      await this.initializePlugin(plugin);
      return plugin;
    } catch (error) {
      // Log the error with context
      this.logger.error('Plugin loading failed', {
        pluginPath,
        error: error.message,
        stack: error.stack
      });
      
      // Re-throw with additional context
      throw new PluginError(`Failed to load plugin ${pluginPath}`, error);
    }
  }
}
```

### **3. Memory Management and Resource Cleanup**

#### **Resource Management Pattern**
```javascript
// ✅ Required Pattern - Proper resource management
class HardwareConnection {
  constructor(dependencies) {
    this.serialPort = null;
    this.connectionTimer = null;
    this.isShuttingDown = false;
  }
  
  async connect() {
    try {
      this.serialPort = new SerialPort({ path: this.config.serialPath });
      this.serialPort.on('error', this.handleSerialError.bind(this));
      
      // Set up cleanup on process termination
      process.on('SIGTERM', this.gracefulShutdown.bind(this));
      process.on('SIGINT', this.gracefulShutdown.bind(this));
    } catch (error) {
      await this.cleanup();
      throw error;
    }
  }
  
  async gracefulShutdown() {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;
    
    this.logger.info('Beginning graceful shutdown');
    
    try {
      // Clear timers
      if (this.connectionTimer) {
        clearInterval(this.connectionTimer);
        this.connectionTimer = null;
      }
      
      // Close serial connection
      if (this.serialPort && this.serialPort.isOpen) {
        await new Promise((resolve) => {
          this.serialPort.close(resolve);
        });
      }
      
      this.logger.info('Graceful shutdown completed');
    } catch (error) {
      this.logger.error('Error during shutdown', { error });
    }
  }
}
```

---

## ⚡ **Arduino C++ Coding Standards**

### **1. Code Organization and Structure**

#### **File Organization**
```cpp
// ✅ Required file header format
/*
  Module Name: Brief description of functionality
  
  Purpose: Detailed explanation of module responsibility
  
  Dependencies: List of required libraries or modules
  
  Communication Protocol: Description of serial communication format
  
  Author: Developer Name
  License: MIT
  Last Modified: Date
*/

#include "config.h"
#include <StandardLibraries.h>  // Standard libraries first
#include <ThirdPartyLibraries.h>  // Third-party libraries second
#include "LocalHeaders.h"  // Local headers last
```

#### **Variable and Function Naming**
```cpp
// ✅ Required naming conventions for Arduino C++
const int BUTTON_MATRIX_SIZE = 32;        // Constants: SCREAMING_SNAKE_CASE
const unsigned long DEBOUNCE_DELAY = 50;  // Use descriptive constant names

// Global variables: g_ prefix with camelCase
int g_currentButtonState = 0;
bool g_isSerialConnected = false;

// Function names: camelCase with descriptive names
void initializeButtonMatrix() {
  // Implementation
}

bool checkButtonPress(int buttonIndex) {
  // Implementation
}

void handleSerialCommand(String command) {
  // Implementation
}

// Private functions: leading underscore
void _updateButtonState(int buttonIndex, bool state) {
  // Implementation
}
```

### **2. Memory Management Standards**

#### **Memory Optimization Patterns**
```cpp
// ✅ Required memory management for Arduino Micro
struct ButtonState {
  bool currentState : 1;    // Use bit fields for boolean flags
  bool previousState : 1;
  bool hasChanged : 1;
  unsigned long lastDebounceTime;  // Full 32-bit for timing
};

// Use const and PROGMEM for constant data
const char BUTTON_PRESS_FORMAT[] PROGMEM = "BTN:%d";
const char ENCODER_FORMAT[] PROGMEM = "ENC:%d:%s";

// Efficient string handling
void sendButtonPress(int buttonId) {
  char buffer[16];  // Fixed-size buffer instead of String class
  snprintf_P(buffer, sizeof(buffer), BUTTON_PRESS_FORMAT, buttonId);
  Serial.println(buffer);
}
```

### **3. Hardware Interface Standards**

#### **Serial Communication Protocol**
```cpp
// ✅ Required serial communication format
void handleIncomingCommand() {
  if (Serial.available()) {
    String command = Serial.readStringUntil('\n');
    command.trim();
    
    // Validate command format
    if (command.startsWith("LED:")) {
      handleLEDCommand(command);
    } else if (command.startsWith("CONFIG:")) {
      handleConfigCommand(command);
    } else {
      // Send error response with proper format
      Serial.println("ERROR:INVALID_COMMAND:" + command);
    }
  }
}

// ✅ Required LED command handling
void handleLEDCommand(String command) {
  // Parse: "LED:BUTTON_ID:R:G:B" or "LED:ALL:R:G:B"
  int firstColon = command.indexOf(':', 4);
  if (firstColon == -1) {
    Serial.println("ERROR:INVALID_LED_FORMAT");
    return;
  }
  
  String target = command.substring(4, firstColon);
  String colorData = command.substring(firstColon + 1);
  
  // Implementation with error checking
}
```

---

## 🧪 **Testing Standards**

### **1. Unit Testing Requirements**

#### **Test Structure and Organization**
```javascript
// ✅ Required test file structure
// tests/module-name.test.js
const ModuleName = require('../src/ModuleName');
const { ErrorTypes } = require('../src/ErrorHandler');

describe('ModuleName', () => {
  let module;
  let mockDependencies;
  
  beforeEach(() => {
    // Set up fresh mocks for each test
    mockDependencies = {
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
      },
      config: {
        hardware: { buttonCount: 16 }
      },
      errorHandler: {
        handleError: jest.fn(),
        categorizeError: jest.fn()
      }
    };
    
    module = new ModuleName(mockDependencies);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('Initialization', () => {
    test('should initialize with valid dependencies', () => {
      expect(module).toBeDefined();
      expect(mockDependencies.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('initialized successfully')
      );
    });
    
    test('should throw error without required dependencies', () => {
      expect(() => {
        new ModuleName({ config: {} }); // Missing logger
      }).toThrow('Logger dependency is required');
    });
  });
});
```

#### **Test Coverage Requirements**
```javascript
// ✅ Required test coverage targets
// Minimum 80% line coverage
// 100% coverage for error handling paths
// Test all public methods and properties

describe('Error Handling', () => {
  test('should handle serial connection failures gracefully', async () => {
    // Mock connection failure
    mockDependencies.serialPort.connect = jest.fn().mockRejectedValue(
      new Error('Connection failed')
    );
    
    await expect(module.connect()).rejects.toThrow('Connection failed');
    
    // Verify error was logged and categorized
    expect(mockDependencies.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Connection failed'),
      expect.any(Object)
    );
    
    expect(mockDependencies.errorHandler.handleError).toHaveBeenCalledWith(
      expect.objectContaining({
        type: ErrorTypes.HARDWARE.SERIAL_CONNECTION_FAILED
      })
    );
  });
});
```

### **2. Integration Testing Standards**

#### **Hardware Simulation**
```javascript
// ✅ Required integration test pattern
describe('Hardware Integration', () => {
  let hardwareSimulator;
  
  beforeEach(() => {
    hardwareSimulator = new HardwareSimulator({
      buttonCount: 16,
      encoderCount: 2,
      simulateLatency: true
    });
  });
  
  test('should handle button press sequence correctly', async () => {
    // Simulate hardware button press
    hardwareSimulator.pressButton(1);
    
    await new Promise(resolve => setTimeout(resolve, 100)); // Debounce delay
    
    // Verify action execution
    expect(mockActionExecutor.executeAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'button-press',
        buttonId: 1
      })
    );
  });
});
```

---

## 📁 **File and Project Organization**

### **Directory Structure Standards**
```
macro-keyboard/
├── src/                          # Main application source
│   ├── main.js                   # Application entry point
│   ├── managers/                 # Core system managers
│   │   ├── SerialConnectionManager.js
│   │   ├── ProfileManager.js
│   │   └── PluginManager.js
│   ├── actions/                  # Action execution modules
│   ├── security/                 # Security and validation
│   ├── ui/                       # User interface components
│   └── utils/                    # Shared utilities
├── arduino/                      # Arduino firmware
│   └── macro-keyboard-firmware/  # Firmware source
├── config/                       # Configuration files
│   ├── default.yaml              # Default configuration
│   ├── schema.json               # Configuration schema
│   └── profiles/                 # User profiles
├── tests/                        # Test files
│   ├── unit/                     # Unit tests
│   ├── integration/              # Integration tests
│   └── __mocks__/                # Mock implementations
├── docs/                         # Documentation
│   └── 06-technical-lead/        # Technical leadership docs
└── scripts/                      # Build and utility scripts
```

### **File Naming Conventions**
```
✅ Correct naming patterns:
- SerialConnectionManager.js      (PascalCase for classes)
- config-validator.test.js        (kebab-case for test files)  
- default.yaml                    (lowercase for config)
- macro-keyboard-firmware.ino     (kebab-case for Arduino)

❌ Incorrect naming patterns:
- serialconnectionmanager.js      (no separation)
- ConfigValidator.test.js         (inconsistent casing)
- DEFAULT.YAML                    (unnecessary caps)
```

---

## 🔒 **Security Standards**

### **Input Validation and Sanitization**
```javascript
// ✅ Required input validation pattern
class ConfigValidator {
  validateUserInput(input) {
    // 1. Type validation
    if (typeof input !== 'object' || input === null) {
      throw new ValidationError('Input must be a valid object');
    }
    
    // 2. Schema validation
    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(this.configSchema);
    
    if (!validate(input)) {
      throw new ValidationError('Schema validation failed', validate.errors);
    }
    
    // 3. Content sanitization
    return this.sanitizeConfigData(input);
  }
  
  sanitizeConfigData(config) {
    // Remove potentially dangerous properties
    const sanitized = { ...config };
    delete sanitized.__proto__;
    delete sanitized.constructor;
    
    // Sanitize string values
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'string') {
        sanitized[key] = sanitized[key].replace(/[<>'"]/g, '');
      }
    });
    
    return sanitized;
  }
}
```

### **Plugin Security Standards**
```javascript
// ✅ Required plugin sandboxing pattern
class PluginSandbox {
  createSecureContext(pluginId) {
    return vm.createContext({
      // Provide limited, secure API
      console: this.createPluginConsole(pluginId),
      Buffer: Buffer,  // Safe Node.js globals
      setTimeout: setTimeout,
      clearTimeout: clearTimeout,
      
      // Custom secure require function
      require: this.createSecureRequire(pluginId),
      
      // Plugin-specific API
      macroAPI: this.createPluginAPI(pluginId)
    });
  }
  
  createSecureRequire(pluginId) {
    const allowedModules = ['path', 'util', 'events'];
    
    return (moduleName) => {
      if (!allowedModules.includes(moduleName)) {
        throw new SecurityError(`Module '${moduleName}' not allowed in plugins`);
      }
      
      return require(moduleName);
    };
  }
}
```

---

## 📊 **Performance Standards**

### **Performance Monitoring Requirements**
```javascript
// ✅ Required performance monitoring pattern
class PerformanceAwareModule {
  async performCriticalOperation(data) {
    const startTime = process.hrtime.bigint();
    
    try {
      const result = await this.executeOperation(data);
      
      // Measure and log performance
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000; // ms
      
      if (this.performanceMonitor) {
        this.performanceMonitor.recordMetric('operation-duration', duration, {
          operation: 'critical-operation',
          dataSize: JSON.stringify(data).length
        });
      }
      
      // Warn if operation is slow
      if (duration > this.config.performanceThresholds.criticalOperation) {
        this.logger.warn('Slow operation detected', { 
          operation: 'critical-operation', 
          duration,
          threshold: this.config.performanceThresholds.criticalOperation 
        });
      }
      
      return result;
    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      this.logger.error('Operation failed', { duration, error });
      throw error;
    }
  }
}
```

---

## ✅ **Quality Assurance Checklist**

### **Pre-commit Checklist**
- [ ] Code follows naming conventions and formatting standards
- [ ] All functions have proper JSDoc documentation
- [ ] Unit tests written for new functionality (minimum 80% coverage)
- [ ] Error handling implemented with proper categorization
- [ ] Security considerations reviewed and implemented
- [ ] Performance implications considered and measured
- [ ] Dependencies properly injected and testable
- [ ] Logging implemented with appropriate levels
- [ ] Resource cleanup implemented where applicable

### **Code Review Checklist**
- [ ] Architecture follows established patterns
- [ ] Code is readable and maintainable
- [ ] No code duplication or unnecessary complexity
- [ ] Security vulnerabilities addressed
- [ ] Performance optimizations where appropriate
- [ ] Tests comprehensive and meaningful
- [ ] Documentation updated and accurate
- [ ] Breaking changes properly communicated

This comprehensive standards document ensures consistent, high-quality code across the macro-keyboard platform while supporting rapid development and team collaboration.