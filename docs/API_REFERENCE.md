# API Documentation

*Complete reference for developers working with the Macro Keyboard application*

## Table of Contents

1. [Overview](#overview)
2. [Core Classes](#core-classes)
3. [Configuration API](#configuration-api)
4. [Plugin API](#plugin-api)
5. [Serial Communication API](#serial-communication-api)
6. [Action Execution API](#action-execution-api)
7. [Security API](#security-api)
8. [Performance Monitoring API](#performance-monitoring-api)
9. [IPC API](#ipc-api)
10. [Error Handling](#error-handling)

## Overview

The Macro Keyboard application is built on Node.js/Electron with a modular architecture. This document provides complete API reference for developers contributing to the project or building plugins.

### Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Renderer      │    │   Main Process   │    │   Arduino       │
│   (UI Layer)    │◄──►│   (Core Logic)   │◄──►│   (Hardware)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                │
                     ┌──────────▼──────────┐
                     │   Plugin System     │
                     │   (Extensions)      │
                     └─────────────────────┘
```

### Key Components

- **MacroKeyboardApp**: Main application controller
- **ActionExecutor**: Handles action execution with security validation
- **SerialConnectionManager**: Manages Arduino communication
- **ProfileManager**: Handles configuration profiles
- **PluginManager**: Manages plugin lifecycle and execution
- **SecurityManager**: Provides security validation and sanitization
- **PerformanceMonitor**: Tracks application performance metrics

## Core Classes

### MacroKeyboardApp

Main application controller that orchestrates all components.

#### Constructor
```javascript
class MacroKeyboardApp {
  constructor()
}
```

#### Properties
```javascript
{
  mainWindow: BrowserWindow,           // Main Electron window (nullable)
  tray: Tray,                         // System tray instance (nullable)
  config: Object,                     // Application configuration
  logger: Logger,                     // Winston logger instance
  actionExecutor: ActionExecutor,     // Action execution handler
  serialManager: SerialConnectionManager, // Serial communication
  profileManager: ProfileManager,     // Profile management
  pluginManager: PluginManager,       // Plugin system
  // ... other managers
}
```

#### Methods

##### initialize()
```javascript
async initialize(): Promise<void>
```
Initializes all application components in dependency order.

**Example:**
```javascript
const app = new MacroKeyboardApp();
await app.initialize();
```

##### loadConfig()
```javascript
async loadConfig(): Promise<Object>
```
Loads and validates application configuration from YAML file.

**Returns:**
- `Object`: Parsed and validated configuration object

**Throws:**
- `ConfigValidationError`: When configuration is invalid
- `FileNotFoundError`: When configuration file doesn't exist

##### saveConfig(config)
```javascript
async saveConfig(config: Object): Promise<void>
```
Saves configuration to YAML file after validation.

**Parameters:**
- `config` (Object): Configuration object to save

##### handleSerialData(data)
```javascript
async handleSerialData(data: string): Promise<void>
```
Processes incoming serial data from Arduino.

**Parameters:**
- `data` (string): Raw serial data string

**Data Formats:**
- `BTN:<button_id>`: Button press event
- `ENC:<encoder_id>:<direction>`: Encoder rotation event
- `STATUS:OK`: Status response
- `ERROR:<code>:<message>`: Error message

### ActionExecutor

Executes actions with cross-platform support and security validation.

#### Constructor
```javascript
class ActionExecutor {
  constructor(logger: Logger, securityManager: SecurityManager)
}
```

#### Methods

##### executeAction(actionConfig, context)
```javascript
async executeAction(
  actionConfig: ActionConfig, 
  context: string
): Promise<ExecutionResult>
```
Main method for executing any type of action.

**Parameters:**
- `actionConfig` (ActionConfig): Action configuration object
- `context` (string): Execution context (e.g., "button1", "encoder2:CW")

**ActionConfig Interface:**
```typescript
interface ActionConfig {
  type: 'keypress' | 'command' | 'application' | 'macro';
  action: string;
  description?: string;
  enabled?: boolean;
  timeout?: number;
}
```

**Returns:**
```typescript
interface ExecutionResult {
  success: boolean;
  result?: any;
  message?: string;
  error?: string;
  executionTime?: number;
  metadata?: object;
}
```

**Example:**
```javascript
const result = await actionExecutor.executeAction({
  type: 'keypress',
  action: 'cmd+c'
}, 'button1');

if (result.success) {
  console.log('Action executed successfully');
} else {
  console.error('Action failed:', result.error);
}
```

##### executeKeypress(keyAction, context)
```javascript
async executeKeypress(
  keyAction: string, 
  context: string
): Promise<ExecutionResult>
```
Executes keyboard shortcuts using robotjs.

**Parameters:**
- `keyAction` (string): Key combination (e.g., "cmd+c", "alt+f4")
- `context` (string): Execution context

**Supported Key Formats:**
- Simple keys: `"space"`, `"enter"`, `"escape"`
- Combinations: `"cmd+c"`, `"ctrl+alt+delete"`
- Special keys: `"volumeup"`, `"volumedown"`, `"f1"`

##### executeCommand(command, context)
```javascript
async executeCommand(
  command: string, 
  context: string
): Promise<ExecutionResult>
```
Executes shell commands with security validation.

**Parameters:**
- `command` (string): Shell command to execute
- `context` (string): Execution context

**Security Features:**
- Command length validation (max 1000 chars)
- Dangerous pattern detection
- Execution timeout (10 seconds)
- Output size limiting (1MB)

##### launchApplication(appName, context)
```javascript
async launchApplication(
  appName: string, 
  context: string
): Promise<ExecutionResult>
```
Launches applications by name or path.

**Parameters:**
- `appName` (string): Application name or full path
- `context` (string): Execution context

**Platform Behavior:**
- **macOS**: Uses `open -a` command
- **Windows**: Uses `start` command  
- **Linux**: Uses `xdg-open` command

## Configuration API

### ConfigValidator

Validates configuration objects against JSON schema.

#### Constructor
```javascript
class ConfigValidator {
  constructor(logger: Logger)
}
```

#### Methods

##### validateConfig(config)
```javascript
validateConfig(config: Object): ValidationResult
```
Validates complete configuration object.

**Returns:**
```typescript
interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
```

##### validateButton(buttonConfig)
```javascript
validateButton(buttonConfig: Object): ValidationResult
```
Validates individual button configuration.

##### validateEncoder(encoderConfig)
```javascript
validateEncoder(encoderConfig: Object): ValidationResult
```
Validates individual encoder configuration.

### Configuration Schema

#### Device Configuration
```yaml
device:
  serialPort: string | null     # Serial port path
  baudRate: number              # Communication speed (9600)
  connectionTimeout: number     # Connection timeout (ms)
  buttons: number               # Button count (8-32)
  encoders: number              # Encoder count (0-8)
```

#### Button Configuration
```yaml
buttons:
  button1:
    description: string         # Human-readable description
    type: string               # Action type: keypress|command|application
    action: string             # Action to execute
    enabled: boolean           # Whether button is active
    timeout?: number           # Override default timeout (ms)
```

#### Encoder Configuration
```yaml
encoders:
  encoder1:
    description: string         # Human-readable description
    typeCW: string             # Clockwise action type
    actionCW: string           # Clockwise action
    typeCCW: string            # Counter-clockwise action type
    actionCCW: string          # Counter-clockwise action
    enabled: boolean           # Whether encoder is active
```

## Plugin API

### PluginManager

Manages plugin lifecycle, execution, and communication.

#### Constructor
```javascript
class PluginManager {
  constructor(logger: Logger, errorHandler: ErrorHandler)
}
```

#### Methods

##### loadPlugin(pluginPath)
```javascript
async loadPlugin(pluginPath: string): Promise<Plugin>
```
Loads and initializes a plugin from file or directory.

**Parameters:**
- `pluginPath` (string): Path to plugin file or directory

**Returns:**
- `Plugin`: Loaded plugin instance

##### unloadPlugin(pluginId)
```javascript
async unloadPlugin(pluginId: string): Promise<boolean>
```
Unloads and disposes of a plugin.

##### executePluginAction(pluginId, actionType, config, context)
```javascript
async executePluginAction(
  pluginId: string,
  actionType: string,
  config: Object,
  context: string
): Promise<ExecutionResult>
```
Executes a plugin-defined action.

##### sendMessage(pluginId, targetPluginId, message)
```javascript
async sendMessage(
  pluginId: string,
  targetPluginId: string,
  message: any
): Promise<any>
```
Sends message between plugins.

### Plugin Interface

Plugins must implement this interface:

```javascript
interface Plugin {
  // Required: Plugin metadata
  manifest: {
    id: string;
    name: string;
    version: string;
    apiVersion: string;
    description: string;
    author: string;
    permissions?: {
      fileSystem?: boolean;
      network?: boolean;
      hardware?: boolean;
      system?: boolean;
    };
  };
  
  // Required: Lifecycle methods
  initialize(api: PluginAPI): void;
  dispose(): void;
  
  // Optional: Action system integration
  getActionTypes?(): string[];
  executeAction?(actionType: string, config: Object, context: string): Promise<ExecutionResult>;
  
  // Optional: Configuration management
  getConfigSchema?(): Object;
  updateConfig?(config: Object): void;
}
```

### PluginAPI Interface

API object provided to plugins:

```javascript
interface PluginAPI {
  // Core functionality
  getVersion(): string;
  getLogger(): Logger;
  getConfig(): Object;
  updateConfig(config: Object): Promise<boolean>;
  
  // Action system
  registerActionType(type: string, handler: Function): boolean;
  executeSystemAction(type: string, config: Object): Promise<ExecutionResult>;
  
  // Hardware communication  
  sendSerialCommand(command: string): Promise<Object>;
  onSerialData(callback: Function): void;
  
  // Application integration
  showNotification(message: string, type?: string): void;
  showDialog(options: Object): Promise<Object>;
  
  // Plugin communication
  sendMessage(targetPlugin: string, message: any): Promise<any>;
  onMessage(callback: Function): void;
  broadcast(message: any): void;
  
  // File system (if permitted)
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<boolean>;
  
  // Network access (if permitted)
  httpRequest(options: Object): Promise<Object>;
  
  // System integration (if permitted)
  executeCommand(command: string): Promise<ExecutionResult>;
  getSystemInfo(): Object;
}
```

## Serial Communication API

### SerialConnectionManager

Manages serial communication with Arduino hardware.

#### Constructor
```javascript
class SerialConnectionManager {
  constructor(logger: Logger, errorHandler: ErrorHandler)
}
```

#### Methods

##### connect(portPath, baudRate)
```javascript
async connect(portPath: string, baudRate: number = 9600): Promise<boolean>
```
Establishes serial connection with Arduino.

**Parameters:**
- `portPath` (string): Serial port path
- `baudRate` (number): Communication speed (default: 9600)

##### disconnect()
```javascript
async disconnect(): Promise<boolean>
```
Closes serial connection.

##### sendCommand(command)
```javascript
async sendCommand(command: string): Promise<string>
```
Sends command to Arduino and waits for response.

**Command Types:**
- `STATUS`: Request status information
- `TEST`: Enter test mode
- `CONFIG:BUTTONS:<count>`: Set button count
- `CONFIG:ENCODERS:<count>`: Set encoder count
- `CONFIG:SAVE`: Save configuration to EEPROM

##### listPorts()
```javascript
static async listPorts(): Promise<PortInfo[]>
```
Lists available serial ports.

**Returns:**
```typescript
interface PortInfo {
  path: string;           // Port path (e.g., "/dev/ttyUSB0")
  manufacturer?: string;  // Device manufacturer
  serialNumber?: string;  // Device serial number
  pnpId?: string;        // Plug and play ID
  locationId?: string;   // Physical location
  vendorId?: string;     // Vendor ID
  productId?: string;    // Product ID
}
```

#### Events

The SerialConnectionManager emits events:

##### 'data'
Emitted when data is received from Arduino.
```javascript
serialManager.on('data', (data) => {
  console.log('Received:', data);
});
```

##### 'connected'
Emitted when connection is established.
```javascript
serialManager.on('connected', (portInfo) => {
  console.log('Connected to:', portInfo.path);
});
```

##### 'disconnected'
Emitted when connection is lost.
```javascript
serialManager.on('disconnected', () => {
  console.log('Serial connection lost');
});
```

##### 'error'
Emitted on communication errors.
```javascript
serialManager.on('error', (error) => {
  console.error('Serial error:', error.message);
});
```

## Security API

### SecurityManager

Provides security validation and sanitization for user actions.

#### Constructor
```javascript
class SecurityManager {
  constructor(config: Object, logger: Logger)
}
```

#### Methods

##### validateCommand(command)
```javascript
validateCommand(command: string): ValidationResult
```
Validates shell command for security threats.

**Checks:**
- Command length (max 1000 characters)
- Dangerous patterns (rm -rf, sudo, etc.)
- Command injection attempts
- Path traversal attacks

##### sanitizeCommand(command)
```javascript
sanitizeCommand(command: string): string
```
Sanitizes command by removing dangerous elements.

##### validateApplication(appName)
```javascript
validateApplication(appName: string): ValidationResult
```
Validates application launch request.

##### validateKeypress(keyCombo)
```javascript
validateKeypress(keyCombo: string): ValidationResult
```
Validates keypress action for dangerous combinations.

##### updateSecurityPolicy(policy)
```javascript
updateSecurityPolicy(policy: SecurityPolicy): void
```
Updates security configuration.

**SecurityPolicy Interface:**
```typescript
interface SecurityPolicy {
  commandExecution: {
    enabled: boolean;
    mode: 'allowlist' | 'blacklist' | 'disabled';
    allowedCommands?: string[];
    blockedCommands?: string[];
    timeout: number;
    maxLength: number;
  };
  applicationExecution: {
    enabled: boolean;
    mode: 'allowlist' | 'blacklist' | 'disabled';
    allowedApplications?: string[];
    blockedApplications?: string[];
    maxPathLength: number;
  };
  keypressValidation: {
    enabled: boolean;
    maxKeyCombinations: number;
    blockedKeys?: string[];
  };
}
```

## Performance Monitoring API

### PerformanceMonitor

Tracks application performance metrics and provides optimization insights.

#### Constructor
```javascript
class PerformanceMonitor {
  constructor(config: Object, logger: Logger)
}
```

#### Methods

##### startMonitoring()
```javascript
startMonitoring(): void
```
Begins performance data collection.

##### stopMonitoring()
```javascript
stopMonitoring(): void
```
Stops performance monitoring.

##### getMetrics()
```javascript
getMetrics(): PerformanceMetrics
```
Returns current performance metrics.

**PerformanceMetrics Interface:**
```typescript
interface PerformanceMetrics {
  system: {
    memoryUsage: {
      rss: number;        // Resident set size
      heapTotal: number;  // Total heap size
      heapUsed: number;   // Used heap size
      external: number;   // External memory
    };
    cpuUsage: {
      user: number;       // User CPU time
      system: number;     // System CPU time
    };
    eventLoopLag: number; // Event loop delay (ms)
  };
  
  application: {
    actionExecutions: {
      total: number;      // Total executions
      successful: number; // Successful executions
      failed: number;     // Failed executions
      averageTime: number; // Average execution time (ms)
    };
    serialCommunication: {
      messagesReceived: number;
      messagesSent: number;
      reconnections: number;
      averageLatency: number; // Average round-trip time (ms)
    };
  };
  
  performance: {
    buttonResponseTime: number; // Average button response time (ms)
    configReloadTime: number;   // Configuration reload time (ms)
    pluginLoadTime: number;     // Plugin loading time (ms)
  };
}
```

##### exportMetrics(format)
```javascript
async exportMetrics(format: 'json' | 'csv'): Promise<string>
```
Exports performance data in specified format.

## IPC API

### Inter-Process Communication

Communication between main process and renderer process.

#### Main Process → Renderer

##### config-updated
Sent when configuration changes:
```javascript
mainWindow.webContents.send('config-updated', newConfig);
```

##### serial-status
Sent when serial connection status changes:
```javascript
mainWindow.webContents.send('serial-status', {
  connected: boolean,
  port: string,
  error?: string
});
```

##### action-executed
Sent when action execution completes:
```javascript
mainWindow.webContents.send('action-executed', {
  context: string,
  result: ExecutionResult
});
```

#### Renderer → Main Process

##### get-config
Request current configuration:
```javascript
ipcRenderer.invoke('get-config').then(config => {
  console.log(config);
});
```

##### save-config
Save configuration changes:
```javascript
ipcRenderer.invoke('save-config', newConfig).then(success => {
  console.log('Config saved:', success);
});
```

##### execute-action
Manually execute action:
```javascript
ipcRenderer.invoke('execute-action', {
  type: 'keypress',
  action: 'cmd+c'
}, 'manual-trigger').then(result => {
  console.log('Action result:', result);
});
```

##### test-hardware
Test hardware connectivity:
```javascript
ipcRenderer.invoke('test-hardware').then(results => {
  console.log('Hardware test:', results);
});
```

## Error Handling

### ErrorHandler

Centralized error handling and reporting.

#### Constructor
```javascript
class ErrorHandler {
  constructor(logger: Logger)
}
```

#### Methods

##### handleError(error, context)
```javascript
handleError(error: Error, context: ErrorContext): void
```
Handles errors with appropriate logging and user notification.

**ErrorContext Interface:**
```typescript
interface ErrorContext {
  component: string;      // Component that generated error
  operation: string;      // Operation being performed
  severity: 'low' | 'medium' | 'high' | 'critical';
  userVisible: boolean;   // Whether to show user notification
  recovery?: string;      // Recovery instructions
  metadata?: Object;      // Additional error metadata
}
```

#### Error Types

```javascript
// Configuration errors
class ConfigValidationError extends Error {
  constructor(message: string, validationErrors: string[])
}

// Serial communication errors
class SerialConnectionError extends Error {
  constructor(message: string, port: string)
}

// Action execution errors
class ActionExecutionError extends Error {
  constructor(message: string, actionConfig: Object, originalError?: Error)
}

// Security errors
class SecurityViolationError extends Error {
  constructor(message: string, violationType: string, attemptedAction: string)
}

// Plugin errors
class PluginError extends Error {
  constructor(message: string, pluginId: string, operation: string)
}
```

#### Usage Examples

```javascript
try {
  await actionExecutor.executeAction(config, context);
} catch (error) {
  errorHandler.handleError(error, {
    component: 'ActionExecutor',
    operation: 'executeAction',
    severity: 'medium',
    userVisible: true,
    recovery: 'Check action configuration and try again'
  });
}
```

---

**Additional Resources:**
- [Plugin Development Guide](./PLUGIN_DEVELOPMENT.md): Complete guide to creating plugins
- [Architecture Overview](./docs/03-system-architect/): Detailed system architecture
- [Security Guide](./SECURITY_ARCHITECTURE.md): Security implementation details
- [Contributing Guidelines](./CONTRIBUTING.md): Development workflow and standards