# Enhanced Error Handling System

The enhanced error handling system provides comprehensive error management, categorization, recovery mechanisms, and user notifications for the Macro Keyboard application.

## Architecture Overview

### Core Components

1. **ErrorHandler Class** - Centralized error management system
2. **MacroKeyboardError Class** - Enhanced error objects with categorization
3. **SerialConnectionManager** - Hardware connection management with automatic recovery
4. **Error UI Integration** - User-facing error notifications and recovery suggestions

### Error Categories

The system categorizes all errors into four main types:

#### Hardware Errors (`HARDWARE`)
- `SERIAL_CONNECTION_FAILED` - Failed to connect to Arduino device
- `SERIAL_WRITE_FAILED` - Communication write failure
- `SERIAL_READ_TIMEOUT` - Communication timeout
- `DEVICE_NOT_FOUND` - Arduino device not detected
- `DEVICE_DISCONNECTED` - Device unplugged during operation
- `ARDUINO_COMMUNICATION_ERROR` - General communication errors
- `INVALID_HARDWARE_RESPONSE` - Unexpected device response

#### Configuration Errors (`CONFIGURATION`)
- `CONFIG_FILE_NOT_FOUND` - Configuration file missing
- `CONFIG_PARSE_ERROR` - YAML parsing failure
- `CONFIG_VALIDATION_ERROR` - Invalid configuration values
- `CONFIG_SAVE_FAILED` - Unable to save configuration
- `INVALID_BUTTON_CONFIG` - Button configuration errors
- `INVALID_ENCODER_CONFIG` - Encoder configuration errors

#### Action Errors (`ACTION`)
- `ACTION_EXECUTION_FAILED` - Failed to execute button action
- `INVALID_ACTION_TYPE` - Unknown action type
- `COMMAND_BLOCKED` - Command blocked for security
- `APPLICATION_LAUNCH_FAILED` - Unable to launch application
- `KEYPRESS_FAILED` - Keyboard input failure

#### System Errors (`SYSTEM`)
- `INITIALIZATION_FAILED` - Application startup failure
- `LOGGER_INIT_FAILED` - Logging system failure
- `IPC_ERROR` - Inter-process communication error
- `RESOURCE_NOT_AVAILABLE` - System resource unavailable
- `PERMISSION_DENIED` - Insufficient permissions

### Severity Levels

Each error is assigned a severity level for appropriate handling:

- **CRITICAL** - System cannot continue, requires restart
- **HIGH** - Critical functionality impaired but recoverable
- **MEDIUM** - Error occurred but system can continue
- **LOW** - Warning or minor issue

## Error Handler (`src/ErrorHandler.js`)

### Core Features

```javascript
const errorHandler = new ErrorHandler(logger);

// Create categorized errors
const error = errorHandler.createError(
  ErrorTypes.HARDWARE.DEVICE_NOT_FOUND,
  'Arduino device not detected',
  originalError,
  { port: '/dev/ttyUSB0' }
);

// Handle errors with automatic recovery
await errorHandler.handleError(error);

// Get error statistics
const stats = errorHandler.getErrorStats();
```

### Automatic Error Recovery

The ErrorHandler implements intelligent recovery strategies:

- **Serial Connection Errors**: Emit `serialRecovery` events for reconnection
- **Configuration Errors**: Emit `configRecovery` events for file recovery
- **Action Errors**: Emit `actionRetry` events for command retry
- **Generic Errors**: Implement exponential backoff delays

### Error History Management

- Maintains rolling history of recent errors (default: 100 items)
- Tracks retry attempts with configurable limits
- Provides error statistics by severity, type, and component
- Supports history clearing and querying

### Event System

The ErrorHandler emits events for integration:

```javascript
// Error notifications for UI
errorHandler.on('userNotification', ({ type, message, severity, actions }) => {
  // Display user-friendly error message
});

// Recovery events for component integration  
errorHandler.on('serialRecovery', (context) => {
  // Trigger serial connection recovery
});

errorHandler.on('configRecovery', (context) => {
  // Trigger configuration recovery
});

errorHandler.on('actionRetry', (context) => {
  // Retry failed action
});
```

## Serial Connection Manager (`src/SerialConnectionManager.js`)

### Connection Management

The SerialConnectionManager provides robust hardware communication:

```javascript
const manager = new SerialConnectionManager(config, logger, errorHandler);
await manager.initialize();

// Connection status
const status = manager.getStatus();
console.log('Connected:', status.isConnected);
console.log('State:', status.state);
```

### Automatic Reconnection

- **Exponential Backoff**: Delays increase with each failed attempt
- **Device Detection**: Scans for available Arduino devices
- **Connection States**: DISCONNECTED, CONNECTING, CONNECTED, RECONNECTING, FAILED
- **Health Monitoring**: Periodic connection health checks

### Offline Mode

When hardware is disconnected:

- Automatically enables offline mode
- Queues commands for later execution
- Processes pending commands on reconnection
- Maintains command history with timestamps

### Recovery Strategies

```javascript
// Listen for recovery events
errorHandler.on('serialRecovery', async (context) => {
  await manager.reconnect();
});

// Monitor connection events
manager.on('connected', () => {
  console.log('Hardware connected');
});

manager.on('disconnected', () => {
  console.log('Hardware disconnected, entering offline mode');
});
```

## Main Application Integration (`src/main.js`)

### Error Boundaries

The main application wraps all critical operations in error boundaries:

```javascript
// Safe configuration loading
async safeLoadConfig() {
  try {
    const config = await this.loadConfiguration();
    this.validateConfig(config);
    return config;
  } catch (error) {
    const configError = this.errorHandler.createError(
      ErrorTypes.CONFIGURATION.CONFIG_PARSE_ERROR,
      'Failed to load configuration file',
      error,
      { configPath: this.configPath }
    );
    
    await this.errorHandler.handleError(configError);
    return this.getDefaultConfig(); // Fallback to defaults
  }
}
```

### Safe Method Wrappers

All critical operations use safe wrappers that handle errors gracefully:

- `safeLoadConfig()` - Configuration loading with fallbacks
- `safeCreateWindow()` - Electron window creation
- `safeInitSerial()` - Hardware initialization

### Graceful Shutdown

The application handles shutdown gracefully even during errors:

```javascript
// Error handler integration in main process
this.errorHandler.on('error', (error, component) => {
  if (error.severity === ErrorSeverity.CRITICAL) {
    // Log critical error and prepare for shutdown
    this.logger.error('Critical error detected, initiating graceful shutdown');
    // Clean up resources
  }
});
```

## User Interface Integration

### Error Notifications

The renderer process displays user-friendly error messages:

```javascript
// Listen for error notifications
ipcRenderer.on('errorNotification', (event, { message, severity, actions }) => {
  showErrorNotification(message, severity, actions);
});

// Show recovery actions
function showErrorNotification(message, severity, recoveryActions) {
  const notification = createNotificationElement(message, severity);
  
  // Add recovery action buttons
  recoveryActions.forEach(action => {
    const button = createRecoveryButton(action);
    notification.appendChild(button);
  });
  
  document.body.appendChild(notification);
}
```

### Connection Status Display

Real-time connection status in the UI:

```javascript
// Update connection status
ipcRenderer.on('connectionStatus', (event, status) => {
  updateConnectionIndicator(status.isConnected, status.state);
});

function updateConnectionIndicator(connected, state) {
  const indicator = document.getElementById('connectionStatus');
  indicator.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
  indicator.textContent = connected ? 'Connected' : `Disconnected (${state})`;
}
```

### Error History Panel

Users can view recent errors and recovery attempts:

```javascript
// Show error history
async function showErrorHistory() {
  const history = await ipcRenderer.invoke('getErrorHistory');
  const historyPanel = document.getElementById('errorHistory');
  
  historyPanel.innerHTML = history.map(entry => `
    <div class="error-entry ${entry.error.severity.toLowerCase()}">
      <div class="error-message">${entry.error.userMessage}</div>
      <div class="error-details">
        <span class="error-type">${entry.error.type}</span>
        <span class="error-time">${new Date(entry.timestamp).toLocaleString()}</span>
      </div>
    </div>
  `).join('');
}
```

## Configuration

### Error Handler Configuration

```yaml
errorHandling:
  maxHistorySize: 100      # Maximum number of errors to keep in history
  maxRetryAttempts: 3      # Maximum automatic retry attempts
  retryBaseDelay: 1000     # Base delay for exponential backoff (ms)
```

### Serial Connection Configuration

```yaml
device:
  serialPort: null           # Auto-detect if null
  baudRate: 9600            # Communication speed
  connectionTimeout: 5000   # Connection timeout (ms)
  healthCheckInterval: 15000 # Health check frequency (ms)
  maxReconnectAttempts: 10  # Maximum reconnection attempts
  offlineCommandLimit: 50   # Maximum queued commands in offline mode
```

## Testing

### Error Handler Tests

The error handling system includes comprehensive tests:

```bash
npm test -- tests/error-handler.test.js
```

Tests cover:
- Error creation and categorization
- Severity determination
- Recovery mechanism triggering  
- Error history management
- Statistics generation
- Event emission
- Logger integration

### Serial Connection Manager Tests

```bash
npm test -- tests/serial-connection-manager.test.js
```

Tests cover:
- Connection lifecycle management
- Automatic reconnection with exponential backoff
- Device detection and selection
- Health monitoring
- Offline mode and command queuing
- Error integration with ErrorHandler

## Best Practices

### Error Creation

Always use the ErrorHandler to create errors:

```javascript
// Good
const error = errorHandler.createError(
  ErrorTypes.HARDWARE.DEVICE_NOT_FOUND,
  'Device not detected on port /dev/ttyUSB0',
  originalError,
  { port: '/dev/ttyUSB0', baudRate: 9600 }
);

// Avoid raw Error objects
// const error = new Error('Device not found'); // Don't do this
```

### Error Context

Provide meaningful context for debugging:

```javascript
const error = errorHandler.createError(
  ErrorTypes.ACTION.ACTION_EXECUTION_FAILED,
  'Failed to execute button action',
  originalError,
  {
    buttonId: 'button1',
    actionType: 'keypress',
    action: 'cmd+c',
    attempt: 2
  }
);
```

### Component Integration

Listen for recovery events specific to your component:

```javascript
// Serial component
errorHandler.on('serialRecovery', async (context) => {
  await this.reconnect(context.port);
});

// Config component  
errorHandler.on('configRecovery', async (action) => {
  if (action === 'createDefault') {
    await this.createDefaultConfig();
  }
});
```

### User Communication

Provide actionable recovery suggestions:

```javascript
// Error messages should be user-friendly
const error = new MacroKeyboardError(
  ErrorTypes.HARDWARE.DEVICE_NOT_FOUND,
  'Arduino device not detected',
  null,
  { port: '/dev/ttyUSB0' }
);

// Generates user message: "Macro keyboard not detected. Ensure it's connected and drivers are installed."
// Provides recovery actions: ["Connect the macro keyboard via USB", "Install Arduino drivers if needed", ...]
```

## Troubleshooting

### Common Issues

1. **Unhandled Error Events**: Ensure all components listen for error events
2. **Memory Leaks**: Clear error history periodically in long-running processes
3. **Retry Loops**: Set appropriate retry limits to prevent infinite loops
4. **Context Loss**: Always provide error context for debugging

### Debug Mode

Enable detailed error logging:

```javascript
const errorHandler = new ErrorHandler(logger);
errorHandler.on('error', (error, component) => {
  console.debug('Error details:', {
    type: error.type,
    severity: error.severity,
    component,
    context: error.context,
    stack: error.stack
  });
});
```

### Error Statistics

Monitor error patterns:

```javascript
// Get error statistics
const stats = errorHandler.getErrorStats();
console.log('Error patterns:', {
  total: stats.total,
  criticalErrors: stats.bySeverity.CRITICAL || 0,
  hardwareErrors: stats.byComponent.Hardware || 0,
  recentErrors: stats.recentErrors.length
});
```

## Future Enhancements

1. **Error Reporting**: Automatic error reporting to external services
2. **Machine Learning**: Predictive error detection based on patterns
3. **Performance Monitoring**: Error impact on system performance
4. **User Preferences**: Customizable error notification behavior
5. **Error Analytics**: Detailed error analytics and reporting dashboard