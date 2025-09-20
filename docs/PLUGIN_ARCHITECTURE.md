# Plugin Architecture Documentation

## Overview

The Macro Keyboard Plugin Architecture provides a secure, extensible system for third-party developers to create custom actions, hardware integrations, and application extensions. The system uses a VM-based sandbox for security, supports hot-reload for development, and includes comprehensive lifecycle management.

## Table of Contents

1. [Plugin System Architecture](#plugin-system-architecture)
2. [Plugin Development Guide](#plugin-development-guide)
3. [Plugin API Reference](#plugin-api-reference)
4. [Security and Sandboxing](#security-and-sandboxing)
5. [Plugin Configuration](#plugin-configuration)
6. [Lifecycle Management](#lifecycle-management)
7. [Development Tools](#development-tools)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

## Plugin System Architecture

### Core Components

#### PluginManager
- **Purpose**: Central orchestrator for plugin lifecycle, execution, and communication
- **Responsibilities**:
  - Plugin discovery and loading
  - Dependency resolution
  - Secure execution via VM sandbox
  - Hot-reload and file watching
  - Plugin configuration management
  - Inter-plugin communication
  - Performance monitoring and statistics

#### VM Sandbox
- **Purpose**: Secure execution environment for plugin code
- **Features**:
  - Controlled access to Node.js modules
  - Memory and execution time limits
  - Isolated global scope
  - Custom require() function with module filtering

#### Plugin API
- **Purpose**: Standardized interface for plugin-application interaction
- **Capabilities**:
  - Action execution system
  - Configuration management
  - Logging and error handling
  - Hardware communication
  - System integration

### Plugin Types

1. **Action Plugins**: Extend the action system with new action types
2. **Hardware Plugins**: Add support for additional hardware devices
3. **Integration Plugins**: Connect with external services and applications
4. **UI Plugins**: Add new interface components and views
5. **Utility Plugins**: Provide reusable functionality for other plugins

## Plugin Development Guide

### Quick Start

1. **Create Plugin Template**:
```bash
# Use the built-in template generator
npm run create-plugin my-awesome-plugin
```

2. **Basic Plugin Structure**:
```javascript
module.exports = {
  // Plugin manifest (required)
  manifest: {
    id: 'my-awesome-plugin',
    name: 'My Awesome Plugin',
    version: '1.0.0',
    apiVersion: '1.0.0',
    description: 'A plugin that does awesome things',
    author: 'Your Name <your.email@example.com>',
    
    // Optional fields
    homepage: 'https://github.com/yourname/my-awesome-plugin',
    repository: 'https://github.com/yourname/my-awesome-plugin.git',
    license: 'MIT',
    keywords: ['macro', 'automation', 'awesome'],
    dependencies: [], // Other plugin IDs this plugin depends on
    
    // Permissions requested by the plugin
    permissions: {
      fileSystem: false,
      network: false,
      hardware: false,
      system: false
    }
  },
  
  // Plugin lifecycle methods (required)
  initialize: function(api) {
    this.api = api;
    this.logger = api.getLogger();
    this.config = api.getConfig();
    
    // Initialize plugin resources
    this.logger.info('My Awesome Plugin initialized');
  },
  
  dispose: function() {
    // Cleanup resources when plugin is unloaded
    this.logger.info('My Awesome Plugin disposed');
  },
  
  // Action system integration (optional)
  getActionTypes: function() {
    return ['awesome-action', 'another-awesome-action'];
  },
  
  executeAction: function(actionType, config, context) {
    switch (actionType) {
      case 'awesome-action':
        return this.performAwesomeAction(config, context);
      case 'another-awesome-action':
        return this.performAnotherAwesomeAction(config, context);
      default:
        return {
          success: false,
          error: `Unknown action type: ${actionType}`
        };
    }
  },
  
  // Configuration management (optional)
  getConfigSchema: function() {
    return {
      type: 'object',
      properties: {
        awesomeLevel: {
          type: 'integer',
          minimum: 1,
          maximum: 10,
          default: 5
        },
        enableCoolFeature: {
          type: 'boolean',
          default: true
        }
      }
    };
  },
  
  updateConfig: function(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Configuration updated', { config: this.config });
  },
  
  // Custom methods
  performAwesomeAction: function(config, context) {
    try {
      // Implement your awesome action logic here
      const result = this.doAwesomeThing(config);
      
      return {
        success: true,
        result: result,
        message: 'Awesome action completed successfully'
      };
    } catch (error) {
      this.logger.error('Awesome action failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  },
  
  doAwesomeThing: function(config) {
    // Your implementation here
    return 'Something awesome happened!';
  }
};
```

### Plugin Manifest Reference

#### Required Fields
- `id`: Unique identifier for the plugin (kebab-case recommended)
- `name`: Human-readable plugin name
- `version`: Plugin version (semantic versioning)
- `apiVersion`: Compatible plugin API version
- `description`: Brief description of plugin functionality
- `author`: Plugin author information

#### Optional Fields
- `homepage`: Plugin homepage URL
- `repository`: Source code repository URL
- `license`: Plugin license (SPDX identifier)
- `keywords`: Array of keywords for discovery
- `dependencies`: Array of plugin IDs this plugin depends on
- `permissions`: Object specifying requested permissions
- `main`: Entry point file (default: index.js for directory-based plugins)

### Plugin Directory Structure

#### Single File Plugin
```
my-plugin.js
```

#### Directory-Based Plugin
```
my-plugin/
├── plugin.json          # Plugin manifest
├── index.js            # Main plugin file
├── lib/               # Plugin library code
│   ├── actions.js
│   └── utils.js
├── config/            # Default configuration
│   └── schema.json
├── assets/            # Static assets
│   └── icon.png
└── README.md          # Plugin documentation
```

## Plugin API Reference

### API Object

The API object is provided to plugins during initialization and provides access to application functionality.

```javascript
api = {
  // Core functionality
  getVersion(): string,
  getLogger(): Logger,
  getConfig(): object,
  updateConfig(config): Promise<boolean>,
  
  // Action system
  registerActionType(type, handler): boolean,
  executeSystemAction(type, config): Promise<object>,
  
  // Hardware communication
  sendSerialCommand(command): Promise<object>,
  onSerialData(callback): void,
  
  // Application integration
  showNotification(message, type): void,
  showDialog(options): Promise<object>,
  
  // Plugin communication
  sendMessage(targetPlugin, message): Promise<object>,
  onMessage(callback): void,
  broadcast(message): void,
  
  // File system (if permitted)
  readFile(path): Promise<string>,
  writeFile(path, content): Promise<boolean>,
  
  // Network access (if permitted)
  httpRequest(options): Promise<object>,
  
  // System integration (if permitted)
  executeCommand(command): Promise<object>,
  getSystemInfo(): object
};
```

### Logger Interface

```javascript
logger = {
  debug(message, meta?): void,
  info(message, meta?): void,
  warn(message, meta?): void,
  error(message, meta?): void
};
```

### Action Execution Result

```javascript
{
  success: boolean,         // Whether the action succeeded
  result?: any,            // Action result data
  message?: string,        // Human-readable message
  error?: string,          // Error message if success is false
  metadata?: object        // Additional metadata
}
```

## Security and Sandboxing

### VM Sandbox Features

1. **Module Restriction**: Only allowed Node.js modules can be required
2. **Global Isolation**: Plugins cannot access the application's global scope
3. **Memory Limits**: Plugin memory usage is monitored and limited
4. **Execution Timeouts**: Long-running plugin operations are terminated
5. **Permission System**: Fine-grained control over plugin capabilities

### Default Security Configuration

```yaml
plugins:
  security:
    sandboxEnabled: true
    timeoutMs: 5000
    memoryLimitMB: 100
    allowedModules:
      - "fs"
      - "path"
      - "crypto"
      - "url"
      - "util"
```

### Permission System

Plugins must declare required permissions in their manifest:

```javascript
permissions: {
  fileSystem: false,    // Access to file system operations
  network: false,       // Network access for HTTP requests
  hardware: false,      // Direct hardware communication
  system: false         // System command execution
}
```

## Plugin Configuration

### Configuration Schema

Plugins can define a JSON Schema for their configuration:

```javascript
getConfigSchema: function() {
  return {
    type: 'object',
    properties: {
      enabled: {
        type: 'boolean',
        default: true,
        description: 'Enable this plugin'
      },
      apiKey: {
        type: 'string',
        description: 'API key for external service'
      },
      settings: {
        type: 'object',
        properties: {
          timeout: {
            type: 'integer',
            minimum: 1000,
            maximum: 30000,
            default: 5000
          }
        }
      }
    },
    required: ['enabled']
  };
}
```

### Runtime Configuration Updates

```javascript
updateConfig: function(newConfig) {
  // Validate configuration
  const validation = this.api.validateConfig(newConfig, this.getConfigSchema());
  if (!validation.valid) {
    throw new Error('Invalid configuration: ' + validation.errors.join(', '));
  }
  
  // Update configuration
  this.config = { ...this.config, ...newConfig };
  
  // Apply configuration changes
  this.applyConfigChanges();
}
```

## Lifecycle Management

### Plugin States

1. **`unloaded`**: Plugin is not loaded into memory
2. **`loaded`**: Plugin code is loaded but not active
3. **`enabled`**: Plugin is active and can execute actions
4. **`disabled`**: Plugin is loaded but inactive
5. **`error`**: Plugin has encountered an error

### State Transitions

```
unloaded → loaded → enabled
           ↓         ↓
         error ← disabled
```

### Lifecycle Events

Plugins can listen for lifecycle events:

```javascript
initialize: function(api) {
  this.api = api;
  
  // Listen for application events
  this.api.on('app-shutdown', () => {
    this.performCleanup();
  });
  
  this.api.on('config-changed', (newConfig) => {
    this.handleConfigChange(newConfig);
  });
}
```

## Development Tools

### Hot Reload

Enable hot reload for development:

```yaml
plugins:
  development:
    enableDevMode: true
    hotReload: true
    verboseLogging: true
```

With hot reload enabled, plugins are automatically reloaded when their files change.

### Plugin Inspector

Access development tools through the Plugin Manager UI:

1. Open Plugin Manager
2. Switch to "Development" tab
3. Select a plugin to inspect
4. View logs, configuration, and performance metrics

### Template Generator

Create new plugins using the template generator:

```bash
# Interactive template creation
npm run create-plugin

# Specify template options
npm run create-plugin --id my-plugin --name "My Plugin" --author "Your Name"
```

### Testing Framework

Use the provided testing utilities:

```javascript
const { PluginTester } = require('@macro-keyboard/plugin-testing');

describe('My Plugin', () => {
  let tester;
  
  beforeEach(() => {
    tester = new PluginTester();
  });
  
  test('should execute action correctly', async () => {
    const plugin = await tester.loadPlugin('./my-plugin.js');
    const result = await plugin.executeAction('my-action', {});
    
    expect(result.success).toBe(true);
  });
});
```

## Best Practices

### Plugin Development

1. **Error Handling**: Always handle errors gracefully and return appropriate error responses
2. **Resource Cleanup**: Implement proper disposal methods to clean up resources
3. **Configuration Validation**: Validate configuration inputs using JSON Schema
4. **Logging**: Use the provided logger for debugging and monitoring
5. **Performance**: Avoid blocking operations and use async/await for I/O operations

### Security

1. **Principle of Least Privilege**: Request only necessary permissions
2. **Input Validation**: Validate all inputs from configuration and API calls
3. **Safe Defaults**: Use secure default configurations
4. **Error Information**: Don't expose sensitive information in error messages

### Compatibility

1. **API Version**: Specify compatible API versions in the manifest
2. **Dependency Management**: Keep dependencies minimal and well-defined
3. **Backward Compatibility**: Maintain compatibility when updating plugins
4. **Testing**: Test plugins across different application versions

### Performance

1. **Lazy Loading**: Load resources only when needed
2. **Memory Management**: Clean up unused objects and event listeners
3. **Caching**: Cache expensive operations where appropriate
4. **Async Operations**: Use promises and async/await for non-blocking operations

## Troubleshooting

### Common Issues

#### Plugin Won't Load
- Check plugin manifest syntax and required fields
- Verify API version compatibility
- Check for syntax errors in plugin code
- Review plugin dependencies

#### Plugin Execution Fails
- Check plugin permissions and security settings
- Verify action type registration
- Review error logs in Plugin Manager
- Test with simplified configuration

#### Hot Reload Not Working
- Ensure development mode is enabled
- Check file permissions in plugins directory
- Verify plugin file syntax
- Review file watching configuration

#### Performance Issues
- Monitor plugin execution times
- Check memory usage in Plugin Manager
- Review plugin code for blocking operations
- Enable performance logging

### Debug Mode

Enable verbose logging for troubleshooting:

```yaml
plugins:
  development:
    verboseLogging: true
    enableInspection: true
```

### Log Analysis

Plugin logs are categorized by level:

- **DEBUG**: Detailed execution information
- **INFO**: General plugin operations
- **WARN**: Non-fatal issues and warnings
- **ERROR**: Plugin errors and failures

### Support Resources

1. **Documentation**: [Plugin API Documentation](./PLUGIN_API.md)
2. **Examples**: [Plugin Examples Repository](./examples/)
3. **Community**: [Plugin Developer Forum](https://forum.macro-keyboard.dev)
4. **Issues**: [GitHub Issues](https://github.com/macro-keyboard/issues)

## API Changelog

### Version 1.0.0
- Initial plugin API release
- Basic plugin lifecycle management
- Action execution system
- Configuration management
- Security sandboxing
- Hot reload support

### Future Versions
- Enhanced permission system
- Plugin marketplace integration
- Advanced debugging tools
- Performance optimization APIs
- Cross-platform compatibility improvements

---

For more detailed information, see the [Plugin API Reference](./PLUGIN_API.md) and [Plugin Examples](./examples/).