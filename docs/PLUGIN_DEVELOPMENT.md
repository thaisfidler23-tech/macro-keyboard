# Plugin Development Tutorial

*Step-by-step guide to creating your first Macro Keyboard plugin*

## Table of Contents

1. [Introduction](#introduction)
2. [Development Setup](#development-setup)
3. [Your First Plugin](#your-first-plugin)
4. [Plugin Development Workflow](#plugin-development-workflow)
5. [Advanced Plugin Features](#advanced-plugin-features)
6. [Real-World Examples](#real-world-examples)
7. [Testing and Debugging](#testing-and-debugging)
8. [Publishing and Distribution](#publishing-and-distribution)

## Introduction

Plugins extend the Macro Keyboard application with custom functionality, integrations, and action types. This tutorial will guide you through creating your first plugin and understanding the plugin development workflow.

### What You'll Learn

By the end of this tutorial, you'll be able to:
- Create basic plugins that add new action types
- Integrate with external APIs and services
- Handle plugin configuration and user settings
- Debug and test plugins effectively
- Package and distribute plugins to other users

### Prerequisites

- **Basic JavaScript knowledge** - understanding of functions, objects, and async/await
- **Node.js 18+** installed for development
- **Macro Keyboard application** installed and working
- **Text editor** or IDE (VS Code recommended)

### Plugin Capabilities

Plugins can:
- ✅ Add new action types beyond keypress/command/application
- ✅ Integrate with external services (APIs, databases, IoT devices)  
- ✅ Extend the configuration system with custom options
- ✅ Communicate with other plugins
- ✅ Add custom logging and monitoring
- ✅ Handle complex workflows and automation sequences

## Development Setup

### Enable Development Mode

First, enable plugin development in your configuration:

```yaml
# ~/.config/macro-keyboard/config.yaml
plugins:
  enabled: true
  development:
    enableDevMode: true      # Enable development features
    hotReload: true          # Automatically reload plugins on changes
    verboseLogging: true     # Detailed plugin logs
    enableInspection: true   # Development tools access
```

### Create Development Environment

```bash
# Create plugin development directory
mkdir ~/macro-keyboard-plugins
cd ~/macro-keyboard-plugins

# Initialize with package.json (optional but recommended)
npm init -y

# Install development dependencies
npm install --save-dev @types/node eslint prettier
```

### Plugin Directory Structure

Organize your development workspace:

```
~/macro-keyboard-plugins/
├── my-first-plugin/          # Individual plugin directories
│   ├── index.js             # Main plugin file
│   ├── plugin.json          # Plugin manifest (optional)
│   └── README.md            # Documentation
├── weather-plugin/          # Another plugin
├── shared/                  # Shared utilities
│   └── utils.js
└── templates/               # Plugin templates
```

## Your First Plugin

Let's create a simple "Hello World" plugin that demonstrates basic concepts.

### Step 1: Create Plugin Directory

```bash
mkdir ~/macro-keyboard-plugins/hello-world-plugin
cd hello-world-plugin
```

### Step 2: Create Plugin Manifest

Create `plugin.json` (optional but recommended for complex plugins):

```json
{
  "id": "hello-world",
  "name": "Hello World Plugin",
  "version": "1.0.0",
  "apiVersion": "1.0.0",
  "description": "A simple plugin that demonstrates basic functionality",
  "author": "Your Name <your.email@example.com>",
  "main": "index.js",
  "permissions": {
    "fileSystem": false,
    "network": false,
    "hardware": false,
    "system": false
  },
  "keywords": ["hello", "world", "tutorial", "example"]
}
```

### Step 3: Create Main Plugin File

Create `index.js`:

```javascript
// index.js - Hello World Plugin
module.exports = {
  // Plugin manifest (required)
  manifest: {
    id: 'hello-world',
    name: 'Hello World Plugin', 
    version: '1.0.0',
    apiVersion: '1.0.0',
    description: 'A simple plugin that demonstrates basic functionality',
    author: 'Your Name <your.email@example.com>',
    
    permissions: {
      fileSystem: false,
      network: false,
      hardware: false,
      system: false
    }
  },
  
  // Plugin lifecycle methods
  initialize: function(api) {
    // Store API reference for later use
    this.api = api;
    this.logger = api.getLogger();
    this.config = api.getConfig();
    
    // Log successful initialization
    this.logger.info('Hello World Plugin initialized successfully!');
    
    // Show welcome notification
    this.api.showNotification('Hello World Plugin loaded!', 'info');
  },
  
  dispose: function() {
    // Clean up resources when plugin is unloaded
    this.logger.info('Hello World Plugin disposed');
  },
  
  // Action system integration
  getActionTypes: function() {
    return ['hello-action', 'greet-user'];
  },
  
  executeAction: function(actionType, config, context) {
    this.logger.debug(`Executing action: ${actionType}`, { config, context });
    
    switch (actionType) {
      case 'hello-action':
        return this.sayHello(config, context);
      case 'greet-user':
        return this.greetUser(config, context);
      default:
        return {
          success: false,
          error: `Unknown action type: ${actionType}`
        };
    }
  },
  
  // Configuration schema
  getConfigSchema: function() {
    return {
      type: 'object',
      properties: {
        greeting: {
          type: 'string',
          default: 'Hello',
          description: 'The greeting to use'
        },
        showNotifications: {
          type: 'boolean', 
          default: true,
          description: 'Whether to show desktop notifications'
        },
        logLevel: {
          type: 'string',
          enum: ['debug', 'info', 'warn', 'error'],
          default: 'info',
          description: 'Logging level for this plugin'
        }
      }
    };
  },
  
  updateConfig: function(newConfig) {
    // Merge new configuration
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Configuration updated', { config: this.config });
    
    // Apply configuration changes
    this.applyConfigChanges();
  },
  
  // Custom action implementations
  sayHello: function(config, context) {
    try {
      const greeting = this.config.greeting || 'Hello';
      const message = `${greeting} from button ${context}!`;
      
      // Log the action
      this.logger.info('Saying hello', { message, context });
      
      // Show notification if enabled
      if (this.config.showNotifications) {
        this.api.showNotification(message, 'info');
      }
      
      // Return success result
      return {
        success: true,
        message: message,
        result: { greeting: message, timestamp: new Date().toISOString() }
      };
    } catch (error) {
      this.logger.error('Failed to say hello', { error: error.message, context });
      return {
        success: false,
        error: error.message
      };
    }
  },
  
  greetUser: function(config, context) {
    try {
      // Get username from system
      const username = require('os').userInfo().username;
      const greeting = this.config.greeting || 'Hello';
      const message = `${greeting}, ${username}! Button ${context} pressed.`;
      
      this.logger.info('Greeting user', { username, context });
      
      if (this.config.showNotifications) {
        this.api.showNotification(message, 'info');
      }
      
      return {
        success: true,
        message: message,
        result: { greeting: message, username: username, timestamp: new Date().toISOString() }
      };
    } catch (error) {
      this.logger.error('Failed to greet user', { error: error.message, context });
      return {
        success: false,
        error: error.message
      };
    }
  },
  
  // Helper methods
  applyConfigChanges: function() {
    // Apply any configuration-dependent changes
    if (this.config.logLevel) {
      // Note: Individual plugin log levels might not be supported in all implementations
      this.logger.info(`Log level set to: ${this.config.logLevel}`);
    }
  }
};
```

### Step 4: Install and Test Plugin

1. **Copy to plugins directory**:
   ```bash
   # Find your plugins directory
   # Usually ~/.config/macro-keyboard/plugins/ or similar
   
   cp -r ~/macro-keyboard-plugins/hello-world-plugin ~/.config/macro-keyboard/plugins/
   ```

2. **Restart Macro Keyboard** or wait for hot-reload (if enabled)

3. **Verify plugin loaded**:
   - Check logs for "Hello World Plugin initialized successfully!"
   - Look for notification "Hello World Plugin loaded!"

### Step 5: Configure Actions

Add the new action types to your button configuration:

```yaml
# config.yaml
buttons:
  button1:
    description: "Say Hello"
    type: "hello-action"
    action: ""  # No additional config needed
    enabled: true
    
  button2:
    description: "Greet User"
    type: "greet-user"
    action: ""
    enabled: true
```

### Step 6: Test Your Plugin

1. Press the configured buttons
2. Check for notifications appearing
3. Review logs for plugin activity:
   ```bash
   tail -f ~/.config/macro-keyboard/logs/macro-keyboard.log | grep "Hello World"
   ```

**Expected output:**
- Desktop notification when button pressed
- Log entries showing plugin activity
- No error messages

## Plugin Development Workflow

### Development Cycle

1. **Write/Edit Code** - Make changes to your plugin
2. **Hot Reload** - Changes automatically applied (if enabled)
3. **Test** - Press buttons to test functionality
4. **Debug** - Check logs and fix issues
5. **Iterate** - Repeat until satisfied

### Hot Reload Setup

Enable hot reload for efficient development:

```yaml
plugins:
  development:
    hotReload: true
    watchPlugins: true      # Watch for file changes
    reloadOnError: true     # Reload after fixing errors
```

**Benefits:**
- No need to restart application
- Immediate feedback on changes
- Faster development cycle

### Debugging Techniques

#### 1. Verbose Logging
```javascript
initialize: function(api) {
  this.logger = api.getLogger();
  this.logger.debug('Plugin initialization starting...');
  this.logger.debug('Available API methods:', Object.keys(api));
}
```

#### 2. Error Handling
```javascript
executeAction: function(actionType, config, context) {
  try {
    this.logger.debug('Action execution starting', { actionType, config, context });
    
    // Your action logic here
    const result = this.performAction(actionType, config);
    
    this.logger.debug('Action completed successfully', { result });
    return { success: true, result };
    
  } catch (error) {
    this.logger.error('Action execution failed', { 
      error: error.message, 
      stack: error.stack,
      actionType,
      config,
      context
    });
    
    return { 
      success: false, 
      error: error.message 
    };
  }
}
```

#### 3. Development Console
```javascript
// Add temporary debugging
console.log('DEBUG: Plugin state:', this);
console.log('DEBUG: API methods:', Object.keys(this.api));
console.log('DEBUG: Current config:', this.config);
```

### Plugin Structure Best Practices

#### Organize Code by Responsibility
```javascript
module.exports = {
  manifest: { /* ... */ },
  
  // Lifecycle
  initialize: function(api) { /* ... */ },
  dispose: function() { /* ... */ },
  
  // Action System
  getActionTypes: function() { /* ... */ },
  executeAction: function(actionType, config, context) { /* ... */ },
  
  // Configuration
  getConfigSchema: function() { /* ... */ },
  updateConfig: function(config) { /* ... */ },
  
  // Private/Internal Methods
  _performComplexAction: function() { /* ... */ },
  _validateInput: function() { /* ... */ },
  _handleError: function() { /* ... */ }
};
```

#### Error Boundaries
```javascript
executeAction: function(actionType, config, context) {
  // Validate inputs
  if (!actionType || typeof actionType !== 'string') {
    return { success: false, error: 'Invalid action type' };
  }
  
  // Check if action is supported
  if (!this.getActionTypes().includes(actionType)) {
    return { success: false, error: `Unsupported action: ${actionType}` };
  }
  
  // Execute with error handling
  try {
    return this._executeActionInternal(actionType, config, context);
  } catch (error) {
    this.logger.error('Unexpected error in action execution', { error });
    return { success: false, error: 'Internal plugin error' };
  }
}
```

## Advanced Plugin Features

### External API Integration

Create a plugin that fetches weather information:

```javascript
// weather-plugin/index.js
module.exports = {
  manifest: {
    id: 'weather',
    name: 'Weather Plugin',
    version: '1.0.0',
    apiVersion: '1.0.0',
    description: 'Get current weather information',
    author: 'Your Name',
    permissions: {
      network: true  // Required for HTTP requests
    }
  },
  
  initialize: function(api) {
    this.api = api;
    this.logger = api.getLogger();
    this.config = api.getConfig();
  },
  
  getActionTypes: function() {
    return ['get-weather', 'weather-alert'];
  },
  
  executeAction: async function(actionType, config, context) {
    switch (actionType) {
      case 'get-weather':
        return await this.getCurrentWeather(config);
      case 'weather-alert':
        return await this.checkWeatherAlert(config);
    }
  },
  
  getConfigSchema: function() {
    return {
      type: 'object',
      properties: {
        apiKey: {
          type: 'string',
          description: 'OpenWeatherMap API key',
          required: true
        },
        city: {
          type: 'string',
          default: 'New York',
          description: 'City for weather information'
        },
        units: {
          type: 'string',
          enum: ['metric', 'imperial', 'kelvin'],
          default: 'metric',
          description: 'Temperature units'
        }
      }
    };
  },
  
  getCurrentWeather: async function(config) {
    try {
      const { apiKey, city, units } = this.config;
      
      if (!apiKey) {
        throw new Error('API key not configured');
      }
      
      // Make HTTP request using plugin API
      const response = await this.api.httpRequest({
        method: 'GET',
        url: `https://api.openweathermap.org/data/2.5/weather`,
        params: {
          q: city,
          appid: apiKey,
          units: units
        }
      });
      
      if (response.status !== 200) {
        throw new Error(`Weather API error: ${response.status}`);
      }
      
      const weather = response.data;
      const message = `${weather.name}: ${weather.main.temp}°, ${weather.weather[0].description}`;
      
      this.api.showNotification(message, 'info');
      
      return {
        success: true,
        result: weather,
        message: message
      };
      
    } catch (error) {
      this.logger.error('Failed to get weather', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }
};
```

### Hardware Communication

Plugin that controls custom hardware via serial:

```javascript
// hardware-control-plugin/index.js
module.exports = {
  manifest: {
    id: 'hardware-control',
    name: 'Hardware Control Plugin',
    version: '1.0.0',
    apiVersion: '1.0.0',
    description: 'Control additional hardware devices',
    permissions: {
      hardware: true  // Required for serial communication
    }
  },
  
  initialize: function(api) {
    this.api = api;
    this.logger = api.getLogger();
    
    // Listen for serial data
    this.api.onSerialData((data) => {
      this.handleSerialData(data);
    });
  },
  
  getActionTypes: function() {
    return ['control-led', 'read-sensor'];
  },
  
  executeAction: async function(actionType, config, context) {
    switch (actionType) {
      case 'control-led':
        return await this.controlLED(config);
      case 'read-sensor':
        return await this.readSensor(config);
    }
  },
  
  controlLED: async function(config) {
    try {
      const command = `LED:${config.color || 'red'}:${config.brightness || 255}`;
      
      // Send command to Arduino
      const response = await this.api.sendSerialCommand(command);
      
      this.logger.info('LED command sent', { command, response });
      
      return {
        success: true,
        message: `LED set to ${config.color}`
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },
  
  handleSerialData: function(data) {
    // Process incoming serial data
    if (data.startsWith('SENSOR:')) {
      const sensorValue = data.split(':')[1];
      this.logger.debug('Sensor reading received', { value: sensorValue });
      
      // Could trigger actions based on sensor readings
      if (parseFloat(sensorValue) > 50) {
        this.api.showNotification('Sensor threshold exceeded!', 'warn');
      }
    }
  }
};
```

### Plugin Communication

Plugins can communicate with each other:

```javascript
// plugin-a/index.js
module.exports = {
  initialize: function(api) {
    this.api = api;
    
    // Listen for messages from other plugins
    this.api.onMessage((message, fromPlugin) => {
      this.logger.info('Received message from plugin', { message, fromPlugin });
      
      if (message.type === 'weather-update') {
        this.handleWeatherUpdate(message.data);
      }
    });
  },
  
  sendWeatherData: async function() {
    // Send message to specific plugin
    await this.api.sendMessage('display-plugin', {
      type: 'weather-update',
      data: { temperature: 22, condition: 'sunny' }
    });
    
    // Or broadcast to all plugins
    this.api.broadcast({
      type: 'system-event',
      data: { event: 'weather-checked', timestamp: Date.now() }
    });
  }
};
```

## Real-World Examples

### Example 1: Spotify Control Plugin

```javascript
// spotify-plugin/index.js
const SpotifyWebApi = require('spotify-web-api-node');

module.exports = {
  manifest: {
    id: 'spotify-control',
    name: 'Spotify Control Plugin',
    version: '1.0.0',
    apiVersion: '1.0.0',
    description: 'Control Spotify playback and get track information',
    permissions: {
      network: true
    }
  },
  
  initialize: function(api) {
    this.api = api;
    this.logger = api.getLogger();
    this.config = api.getConfig();
    
    // Initialize Spotify API
    this.spotify = new SpotifyWebApi({
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
      redirectUri: this.config.redirectUri
    });
    
    if (this.config.accessToken) {
      this.spotify.setAccessToken(this.config.accessToken);
    }
  },
  
  getActionTypes: function() {
    return [
      'spotify-play-pause',
      'spotify-next',
      'spotify-previous', 
      'spotify-volume-up',
      'spotify-volume-down',
      'spotify-current-track'
    ];
  },
  
  executeAction: async function(actionType, config, context) {
    try {
      switch (actionType) {
        case 'spotify-play-pause':
          return await this.togglePlayback();
        case 'spotify-next':
          return await this.nextTrack();
        case 'spotify-previous':
          return await this.previousTrack();
        case 'spotify-current-track':
          return await this.getCurrentTrack();
        // ... other actions
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  
  togglePlayback: async function() {
    const state = await this.spotify.getMyCurrentPlaybackState();
    
    if (state.body && state.body.is_playing) {
      await this.spotify.pause();
      this.api.showNotification('Spotify paused', 'info');
    } else {
      await this.spotify.play();
      this.api.showNotification('Spotify playing', 'info');
    }
    
    return { success: true };
  },
  
  getCurrentTrack: async function() {
    const track = await this.spotify.getMyCurrentPlayingTrack();
    
    if (track.body && track.body.item) {
      const info = `${track.body.item.name} by ${track.body.item.artists[0].name}`;
      this.api.showNotification(info, 'info');
      
      return {
        success: true,
        result: track.body.item,
        message: info
      };
    }
    
    return { success: false, error: 'No track playing' };
  }
};
```

### Example 2: Home Assistant Integration

```javascript
// homeassistant-plugin/index.js
module.exports = {
  manifest: {
    id: 'homeassistant',
    name: 'Home Assistant Plugin',
    version: '1.0.0',
    apiVersion: '1.0.0',
    description: 'Control Home Assistant devices and automations',
    permissions: {
      network: true
    }
  },
  
  getActionTypes: function() {
    return [
      'ha-toggle-light',
      'ha-set-scene',
      'ha-trigger-automation',
      'ha-get-sensor'
    ];
  },
  
  executeAction: async function(actionType, config, context) {
    const { haUrl, accessToken } = this.config;
    
    if (!haUrl || !accessToken) {
      return { success: false, error: 'Home Assistant not configured' };
    }
    
    try {
      switch (actionType) {
        case 'ha-toggle-light':
          return await this.toggleLight(config.entityId);
        case 'ha-set-scene':
          return await this.setScene(config.sceneId);
        case 'ha-trigger-automation':
          return await this.triggerAutomation(config.automationId);
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  
  toggleLight: async function(entityId) {
    const response = await this.api.httpRequest({
      method: 'POST',
      url: `${this.config.haUrl}/api/services/light/toggle`,
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        entity_id: entityId
      }
    });
    
    if (response.status === 200) {
      this.api.showNotification(`Toggled ${entityId}`, 'info');
      return { success: true, message: `Toggled ${entityId}` };
    }
    
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
};
```

## Testing and Debugging

### Unit Testing Plugins

Create tests for your plugins:

```javascript
// tests/hello-world-plugin.test.js
const plugin = require('../hello-world-plugin');

// Mock API object
const mockApi = {
  getLogger: () => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }),
  getConfig: () => ({
    greeting: 'Test Hello',
    showNotifications: false
  }),
  showNotification: jest.fn()
};

describe('Hello World Plugin', () => {
  beforeEach(() => {
    plugin.initialize(mockApi);
  });
  
  test('should initialize successfully', () => {
    expect(plugin.api).toBe(mockApi);
    expect(plugin.logger).toBeDefined();
  });
  
  test('should return correct action types', () => {
    const actionTypes = plugin.getActionTypes();
    expect(actionTypes).toContain('hello-action');
    expect(actionTypes).toContain('greet-user');
  });
  
  test('should execute hello action successfully', () => {
    const result = plugin.executeAction('hello-action', {}, 'button1');
    
    expect(result.success).toBe(true);
    expect(result.message).toContain('Test Hello');
    expect(result.message).toContain('button1');
  });
  
  test('should handle unknown action types', () => {
    const result = plugin.executeAction('unknown-action', {}, 'button1');
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown action type');
  });
});
```

### Integration Testing

Test plugin integration with the application:

```javascript
// tests/integration/plugin-integration.test.js
const { MacroKeyboardApp } = require('../../src/main');
const path = require('path');

describe('Plugin Integration', () => {
  let app;
  
  beforeAll(async () => {
    app = new MacroKeyboardApp();
    await app.initialize();
  });
  
  afterAll(async () => {
    await app.shutdown();
  });
  
  test('should load plugin successfully', async () => {
    const pluginPath = path.join(__dirname, '../fixtures/test-plugin');
    const plugin = await app.pluginManager.loadPlugin(pluginPath);
    
    expect(plugin).toBeDefined();
    expect(plugin.manifest.id).toBe('test-plugin');
  });
  
  test('should execute plugin action', async () => {
    const result = await app.pluginManager.executePluginAction(
      'test-plugin',
      'test-action',
      {},
      'test-context'
    );
    
    expect(result.success).toBe(true);
  });
});
```

### Debug Logging Strategy

Implement comprehensive debug logging:

```javascript
// Enhanced logging example
executeAction: function(actionType, config, context) {
  const startTime = Date.now();
  
  this.logger.debug('Action execution starting', {
    actionType,
    config,
    context,
    timestamp: new Date().toISOString()
  });
  
  try {
    const result = this._executeActionInternal(actionType, config, context);
    
    const executionTime = Date.now() - startTime;
    this.logger.debug('Action execution completed', {
      actionType,
      success: result.success,
      executionTime,
      resultSize: JSON.stringify(result).length
    });
    
    if (executionTime > 1000) {
      this.logger.warn('Slow action execution detected', {
        actionType,
        executionTime
      });
    }
    
    return result;
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    this.logger.error('Action execution failed', {
      actionType,
      error: error.message,
      stack: error.stack,
      executionTime,
      config,
      context
    });
    
    throw error;
  }
}
```

## Publishing and Distribution

### Package Your Plugin

Create a distributable package:

```bash
# Create plugin package
mkdir my-plugin-v1.0.0
cp -r my-plugin/* my-plugin-v1.0.0/

# Create archive
tar -czf my-plugin-v1.0.0.tar.gz my-plugin-v1.0.0/

# Or zip file
zip -r my-plugin-v1.0.0.zip my-plugin-v1.0.0/
```

### Documentation Template

Create `README.md` for your plugin:

```markdown
# My Plugin

Brief description of what your plugin does.

## Installation

1. Download the latest release
2. Extract to your plugins directory
3. Restart Macro Keyboard application

## Configuration

```yaml
plugins:
  my-plugin:
    enabled: true
    apiKey: "your-api-key-here"
    customOption: "value"
```

## Usage

Available action types:
- `my-action`: Does something useful
- `another-action`: Does something else

## Example Configuration

```yaml
buttons:
  button1:
    type: "my-action"
    action: ""
    description: "My custom action"
```

## Support

- GitHub Issues: [link]
- Documentation: [link]
- Email: your.email@example.com
```

### Share Your Plugin

1. **GitHub Repository**: Create public repository for your plugin
2. **Plugin Registry**: Submit to official plugin registry (if available)
3. **Community Forums**: Share in discussions and forums
4. **Documentation**: Add to community plugin list

---

**Next Steps:**
- Explore the [Plugin Architecture Documentation](./PLUGIN_ARCHITECTURE.md) for advanced features
- Check out [Real Plugin Examples](./examples/plugins/) for inspiration  
- Join the [Developer Community](https://github.com/jmassardo/macro-keyboard/discussions) for support
- Read the [API Reference](./API_REFERENCE.md) for complete API documentation