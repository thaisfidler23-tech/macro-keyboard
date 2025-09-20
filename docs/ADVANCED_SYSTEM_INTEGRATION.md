# Advanced System Integration Documentation

## Overview

The Advanced System Integration feature provides deep operating system integration for the macro keyboard application, enabling global shortcuts, clipboard management, window management, system monitoring, and application-specific automation. This feature transforms the macro keyboard from a simple input device into a comprehensive system automation tool.

## Architecture

### Core Components

1. **SystemIntegrationManager** (`src/SystemIntegrationManager.js`)
   - Backend system integration engine
   - Event-driven architecture using EventEmitter
   - Cross-platform compatibility layer
   - Resource management and cleanup

2. **SystemIntegrationUI** (`src/renderer/SystemIntegrationUI.js`)
   - Frontend user interface for system integration management
   - Tabbed modal interface with 5 primary sections
   - Real-time status updates and notifications
   - Keyboard shortcuts and accessibility features

3. **Integration Points**
   - Main process integration (`src/main.js`)
   - IPC communication handlers
   - Event forwarding system
   - Resource lifecycle management

## Features

### 1. Global Shortcuts Management

**Capabilities:**
- Register system-wide keyboard shortcuts
- Execute macro actions from anywhere in the system
- Conflict detection and resolution
- Context-aware action execution
- Platform-specific shortcut formats

**API:**
```javascript
// Register a global shortcut
systemIntegrationManager.registerGlobalShortcut(
  'CommandOrControl+Shift+M', // Shortcut
  async (context) => {         // Action function
    // Access to system context
    console.log('Focused app:', context.focusedApplication);
    console.log('System state:', context.systemState);
    // Perform action
    return { success: true };
  },
  {                            // Metadata
    name: 'Open Macro Manager',
    category: 'application',
    description: 'Opens the macro keyboard manager'
  }
);
```

**Events:**
- `shortcut-triggered`: Emitted when a global shortcut is executed
- `shortcut-registered`: Emitted when a new shortcut is registered
- `shortcut-unregistered`: Emitted when a shortcut is removed

### 2. Clipboard Management

**Capabilities:**
- Real-time clipboard monitoring
- Automatic content type detection (URL, email, JSON, etc.)
- Clipboard history with configurable retention
- Programmatic clipboard manipulation
- Content metadata tracking

**Content Type Detection:**
- **URL**: HTTP/HTTPS links, file paths
- **Email**: Email addresses
- **JSON**: Valid JSON objects/arrays  
- **Code**: Programming language syntax
- **Multiline Text**: Text with line breaks
- **Plain Text**: Default fallback

**API:**
```javascript
// Start clipboard monitoring
systemIntegrationManager.startClipboardWatcher();

// Set clipboard content programmatically
systemIntegrationManager.setClipboardContent(
  'New clipboard content',
  { source: 'macro-keyboard', action: 'paste-template' }
);

// Get clipboard history
const history = systemIntegrationManager.getClipboardHistory(10);
```

**Events:**
- `clipboard-changed`: Emitted when clipboard content changes
- `clipboard-set`: Emitted when content is programmatically set

### 3. Window Management

**Capabilities:**
- Active window tracking
- Application focus monitoring
- Window information collection
- Application-specific configuration
- Focus change notifications

**API:**
```javascript
// Get current active window
const activeWindow = await systemIntegrationManager.getActiveWindow();

// Add application-specific integration
systemIntegrationManager.addApplicationIntegration('Visual Studio Code', {
  shortcuts: {
    'CommandOrControl+Shift+P': 'command-palette'
  },
  automation: {
    'window-focus': 'load-development-profile'
  }
});
```

**Events:**
- `window-focus-changed`: Emitted when window focus changes
- `application-integration-added`: Emitted when app integration is configured

### 4. System State Monitoring

**Capabilities:**
- Real-time system metrics collection
- Memory and CPU usage monitoring
- Network status detection
- Battery level tracking (laptops)
- Idle time monitoring
- Change detection and alerting

**Monitored Metrics:**
- **Memory Usage**: Application memory consumption
- **System Memory**: Total system memory usage
- **CPU Usage**: Current CPU utilization
- **Network Status**: Connection state
- **Battery Level**: Battery percentage (when available)
- **Idle Time**: User inactivity duration

**API:**
```javascript
// Get current system state
const systemState = await systemIntegrationManager.gatherSystemState();

// Enable continuous monitoring
systemIntegrationManager.startSystemStateMonitoring();
```

**Events:**
- `system-state-changed`: Emitted when significant system changes occur
- `system-alert`: Emitted when system metrics exceed thresholds

### 5. Application Integration

**Capabilities:**
- Application-specific shortcuts and automation
- Context-aware macro execution
- Default configurations for popular applications
- Custom integration rules
- Profile switching based on active application

**Pre-configured Applications:**
- **Visual Studio Code**: Development shortcuts and automation
- **Google Chrome**: Browser navigation and development tools
- **Terminal/Command Prompt**: System command shortcuts
- **Slack**: Communication shortcuts
- **Figma**: Design tool shortcuts

## User Interface

### Modal Structure

The System Integration UI is organized into a tabbed modal interface:

#### 1. Global Shortcuts Tab
- **Shortcut Registration Form**: Add new global shortcuts
- **Active Shortcuts List**: View and manage registered shortcuts
- **Shortcut Testing**: Test shortcut functionality
- **Conflict Resolution**: Handle shortcut conflicts

#### 2. Clipboard History Tab
- **Content History**: Searchable list of clipboard items
- **Content Type Filtering**: Filter by content type
- **Quick Actions**: Copy, edit, delete clipboard items
- **Content Preview**: Rich preview of clipboard content

#### 3. Window Management Tab
- **Active Window Display**: Current window information
- **Application Rules**: Configure application-specific behavior
- **Window History**: Track window focus changes
- **Integration Settings**: Enable/disable window tracking

#### 4. Automation Tab
- **System Commands**: Quick access to system operations
- **Automation Rules**: Configure trigger-based automation
- **Profile Management**: Create and switch between profiles
- **Macro Integration**: Link system integration to macro actions

#### 5. System Monitoring Tab
- **Real-time Metrics**: Live system performance data
- **System Alerts**: Configure thresholds and notifications
- **Performance History**: Historical system performance
- **Resource Usage**: Detailed resource consumption

### Keyboard Shortcuts

The UI supports comprehensive keyboard navigation:
- `Escape`: Close modal
- `Tab`/`Shift+Tab`: Navigate between elements
- `Ctrl+1` through `Ctrl+5`: Switch between tabs
- `Ctrl+N`: Add new item (context-dependent)
- `Ctrl+S`: Save current configuration
- `F5`: Refresh/reload current tab

## Configuration

### Settings Structure

```yaml
systemIntegration:
  globalShortcuts:
    enabled: true
    shortcuts:
      - key: "CommandOrControl+Shift+M"
        action: "open-macro-manager"
        name: "Open Macro Manager"
        category: "application"
  
  clipboard:
    enabled: true
    monitoring: true
    historySize: 100
    contentTypes: ["url", "email", "json", "code", "text"]
  
  windowManagement:
    enabled: true
    trackFocusChanges: true
    applicationIntegrations:
      "Visual Studio Code":
        shortcuts:
          "CommandOrControl+Shift+P": "command-palette"
        automation:
          "window-focus": "load-development-profile"
  
  systemMonitoring:
    enabled: true
    interval: 5000  # milliseconds
    thresholds:
      memoryUsage: 80
      cpuUsage: 70
      networkTimeout: 10000
```

### Environment Variables

- `MACRO_KEYBOARD_SYSTEM_INTEGRATION`: Enable/disable system integration
- `MACRO_KEYBOARD_LOG_LEVEL`: Set logging level for system integration
- `MACRO_KEYBOARD_MONITOR_INTERVAL`: System monitoring interval (ms)

## Cross-Platform Compatibility

### Feature Availability

| Feature | Windows | macOS | Linux |
|---------|---------|--------|-------|
| Global Shortcuts | ✅ | ✅ | ✅ |
| Clipboard Monitoring | ✅ | ✅ | ✅ |
| Window Management | ✅ | ✅ | ✅ |
| System Monitoring | ✅ | ✅ | ✅ |
| Hardware Integration | ✅ | ✅ | ⚠️ |
| Application Integration | ✅ | ✅ | ✅ |

⚠️ = Limited support or requires additional setup

### Platform-Specific Implementations

**Windows:**
- Uses Windows API for window management
- PowerShell integration for system commands
- Registry access for application detection

**macOS:**
- AppleScript integration for automation
- Accessibility API for window management
- System Events framework for monitoring

**Linux:**
- X11/Wayland compatibility layer
- D-Bus integration for system communication
- Desktop environment-specific adaptations

## API Reference

### SystemIntegrationManager Methods

#### Initialization
```javascript
async initialize()
```
Initialize the system integration manager with platform detection and feature availability checking.

#### Global Shortcuts
```javascript
registerGlobalShortcut(accelerator, action, metadata = {})
unregisterGlobalShortcut(accelerator)
getRegisteredShortcuts()
```

#### Clipboard Management
```javascript
startClipboardWatcher()
stopClipboardWatcher()
setClipboardContent(content, metadata = {})
getClipboardHistory(limit = 50)
clearClipboardHistory()
```

#### Window Management
```javascript
async getActiveWindow()
addApplicationIntegration(appName, config)
removeApplicationIntegration(appName)
getApplicationIntegrations()
```

#### System Monitoring
```javascript
async gatherSystemState()
startSystemStateMonitoring(interval = 5000)
stopSystemStateMonitoring()
getSystemStatus()
```

#### Utility Methods
```javascript
getStatus()
exportSettings()
importSettings(settings)
cleanup()
```

### Events

#### System Events
- `initialized`: System integration is ready
- `cleanup-started`: Cleanup process initiated
- `error`: System integration error occurred

#### Shortcut Events
- `shortcut-triggered`: Global shortcut executed
- `shortcut-registered`: New shortcut registered
- `shortcut-unregistered`: Shortcut removed

#### Clipboard Events
- `clipboard-changed`: Clipboard content changed
- `clipboard-set`: Content programmatically set
- `clipboard-history-cleared`: History cleared

#### Window Events
- `window-focus-changed`: Active window changed
- `application-integration-added`: App integration added
- `application-integration-removed`: App integration removed

#### System State Events
- `system-state-changed`: System metrics changed
- `system-alert`: System threshold exceeded
- `system-monitoring-started`: Monitoring enabled
- `system-monitoring-stopped`: Monitoring disabled

## Testing

### Test Coverage

The system integration feature includes comprehensive test coverage:

1. **Unit Tests** (`tests/system-integration-manager.test.js`)
   - Individual component testing
   - Method validation
   - Error handling verification

2. **UI Tests** (`tests/system-integration-ui.test.js`)
   - Interface component testing
   - User interaction validation
   - Event handling verification

3. **Integration Tests** (`tests/system-integration-workflow.test.js`)
   - End-to-end workflow testing
   - Cross-component interaction
   - Real-world scenario simulation

4. **Main Integration Tests** (`tests/main-integration.test.js`)
   - IPC communication testing
   - Event forwarding validation
   - Resource management testing

### Running Tests

```bash
# Run all system integration tests
npm test -- --grep "system.integration"

# Run specific test suites
npm test tests/system-integration-manager.test.js
npm test tests/system-integration-ui.test.js
npm test tests/system-integration-workflow.test.js

# Run tests with coverage
npm test -- --coverage --grep "system.integration"
```

### Mock Environment

Tests use comprehensive mocking for:
- Electron APIs (globalShortcut, clipboard, ipcMain)
- System APIs (process, fs, path)
- Hardware interfaces
- Network operations

## Integration Guide

### Adding System Integration to Existing Macros

1. **Import System Integration Manager**
```javascript
const SystemIntegrationManager = require('./SystemIntegrationManager');
```

2. **Initialize in Main Process**
```javascript
const systemIntegration = new SystemIntegrationManager(logger);
await systemIntegration.initialize();
```

3. **Register IPC Handlers**
```javascript
ipcMain.handle('get-system-integration-status', () => {
  return systemIntegration.getStatus();
});
```

4. **Connect to UI**
```javascript
// In renderer process
const status = await electronAPI.getSystemIntegrationStatus();
```

### Creating Custom Actions

```javascript
// Custom action with system context
const customAction = async (context) => {
  const { focusedApplication, systemState, timestamp } = context;
  
  if (focusedApplication === 'Visual Studio Code') {
    // Development-specific action
    return await executeDevAction();
  } else if (systemState.memoryUsage > 80) {
    // Memory-conscious action
    return await executeLightweightAction();
  } else {
    // Default action
    return await executeDefaultAction();
  }
};

// Register custom action
systemIntegration.registerGlobalShortcut(
  'CommandOrControl+Alt+C',
  customAction,
  { name: 'Context-Aware Custom Action', category: 'custom' }
);
```

## Performance Considerations

### Memory Management
- Clipboard history is limited to 100 items by default
- System state monitoring uses configurable intervals
- Event listeners are properly cleaned up on shutdown
- Large clipboard content is truncated for display

### CPU Usage
- System monitoring uses efficient polling intervals
- Clipboard watching uses native change detection
- Window focus tracking uses OS-level events
- Shortcut registration uses hardware-level hooks

### Network Impact
- No external network requests required
- All operations are local to the system
- Configuration can be exported/imported offline

## Security Considerations

### Input Validation
- All shortcut accelerators are validated
- Clipboard content is sanitized for display
- System command execution is restricted
- Configuration imports are schema-validated

### Permissions
- Global shortcuts require accessibility permissions on macOS
- Window management may require screen recording permission
- System monitoring uses standard OS APIs
- No elevated privileges required for basic functionality

### Data Privacy
- Clipboard content is stored locally only
- System metrics are not transmitted externally
- Application usage data remains on device
- Configuration export excludes sensitive data

## Troubleshooting

### Common Issues

1. **Global Shortcuts Not Working**
   - Check accessibility permissions (macOS)
   - Verify shortcut format
   - Check for conflicts with system shortcuts
   - Restart application with administrator privileges

2. **Clipboard Monitoring Failed**
   - Verify clipboard access permissions
   - Check for clipboard management software conflicts
   - Restart clipboard watcher service
   - Clear clipboard history and restart

3. **Window Focus Not Detected**
   - Enable accessibility permissions
   - Check window management service status
   - Verify application focus detection
   - Restart window tracking service

4. **System Monitoring Disabled**
   - Check system permissions
   - Verify monitoring service status
   - Adjust monitoring interval
   - Review system resource usage

### Debug Mode

Enable debug logging:
```bash
DEBUG=macro-keyboard:system-integration npm start
```

Debug output includes:
- Initialization steps and results
- API call parameters and responses
- Event emission and handling
- Error details and stack traces
- Performance timing information

### Support Information

When reporting issues, include:
- Operating system and version
- Node.js and Electron versions
- Application version and build
- Configuration file (sanitized)
- Debug logs (last 100 lines)
- Steps to reproduce the issue

## Future Enhancements

### Planned Features
- **Advanced Automation**: Rule-based system automation
- **Machine Learning**: Adaptive behavior based on usage patterns
- **Cloud Sync**: Configuration synchronization across devices
- **Plugin System**: Third-party integration extensions
- **Voice Integration**: Voice command system integration
- **Mobile Integration**: Smartphone companion app

### API Extensions
- **Webhook Support**: External system integration via webhooks
- **REST API**: External application integration
- **WebSocket Events**: Real-time event streaming
- **Script Engine**: Custom automation script execution
- **Template System**: Dynamic content generation

---

*This documentation is current as of the Advanced System Integration implementation. For the latest updates and API changes, refer to the source code and test files.*