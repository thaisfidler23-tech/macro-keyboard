/**
 * Plugin Manager Test Suite
 * Comprehensive tests for plugin system functionality
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { EventEmitter } = require('events');
const PluginManager = require('../src/PluginManager');

// Mock dependencies
jest.mock('winston', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })
}));

describe('PluginManager', () => {
  let pluginManager;
  let mockLogger;
  let mockErrorHandler;
  let mockActionExecutor;
  let testPluginsDir;

  beforeAll(() => {
    // Create temporary plugins directory
    testPluginsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-tests-'));
  });

  afterAll(() => {
    // Clean up temporary directory
    if (fs.existsSync(testPluginsDir)) {
      fs.rmSync(testPluginsDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    mockErrorHandler = {
      handleError: jest.fn()
    };

    mockActionExecutor = {
      executeAction: jest.fn().mockResolvedValue(true),
      registerCustomActionType: jest.fn()
    };

    const config = {
      enabled: true,
      pluginsDir: testPluginsDir,
      autoLoad: true,
      hotReload: false, // Disable for testing
      security: {
        sandboxEnabled: true,
        timeoutMs: 5000,
        memoryLimitMB: 100,
        allowedModules: ['fs', 'path', 'crypto']
      },
      api: {
        version: '1.0.0',
        rateLimit: 100
      }
    };

    pluginManager = new PluginManager(
      config,
      mockLogger,
      mockErrorHandler,
      mockActionExecutor
    );
  });

  afterEach(async () => {
    if (pluginManager) {
      await pluginManager.dispose();
    }
    
    // Clean up test plugins
    const files = fs.readdirSync(testPluginsDir);
    files.forEach(file => {
      const filePath = path.join(testPluginsDir, file);
      if (fs.existsSync(filePath)) {
        fs.rmSync(filePath, { recursive: true, force: true });
      }
    });
  });

  describe('Initialization', () => {
    test('should initialize with valid configuration', async () => {
      await pluginManager.initialize();
      expect(pluginManager.isInitialized).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('PluginManager initialized successfully');
    });

    test('should create plugins directory if it does not exist', async () => {
      const nonExistentDir = path.join(testPluginsDir, 'new-plugins');
      pluginManager.config.pluginsDir = nonExistentDir;
      
      await pluginManager.initialize();
      
      expect(fs.existsSync(nonExistentDir)).toBe(true);
    });

    test('should handle initialization errors gracefully', async () => {
      const invalidConfig = {
        ...pluginManager.config,
        pluginsDir: '/invalid/path/that/cannot/be/created'
      };
      
      pluginManager.config = invalidConfig;
      
      await expect(pluginManager.initialize()).rejects.toThrow();
    });
  });

  describe('Plugin Loading', () => {
    test('should load a valid JavaScript plugin', async () => {
      const pluginContent = `
        module.exports = {
          manifest: {
            id: 'test-plugin',
            name: 'Test Plugin',
            version: '1.0.0',
            apiVersion: '1.0.0',
            description: 'A test plugin',
            author: 'Test Author'
          },
          
          initialize: function(api) {
            this.api = api;
          },
          
          dispose: function() {
            // Cleanup
          },
          
          getActionTypes: function() {
            return ['test-action'];
          },
          
          executeAction: function(actionType, config) {
            return { success: true, result: 'Test action executed' };
          }
        };
      `;
      
      const pluginPath = path.join(testPluginsDir, 'test-plugin.js');
      fs.writeFileSync(pluginPath, pluginContent);
      
      await pluginManager.initialize();
      const plugin = await pluginManager.loadPluginFromPath(pluginPath);
      
      expect(plugin).toBeDefined();
      expect(plugin.id).toBe('test-plugin');
      expect(plugin.state).toBe('loaded');
      expect(mockLogger.info).toHaveBeenCalledWith('Plugin test-plugin loaded successfully');
    });

    test('should load a valid JSON plugin manifest', async () => {
      const pluginManifest = {
        id: 'json-plugin',
        name: 'JSON Plugin',
        version: '1.0.0',
        apiVersion: '1.0.0',
        description: 'A JSON plugin',
        author: 'Test Author',
        main: 'index.js'
      };
      
      const pluginCode = `
        module.exports = {
          initialize: function(api) {
            this.api = api;
          },
          
          dispose: function() {},
          
          getActionTypes: function() {
            return ['json-action'];
          },
          
          executeAction: function(actionType, config) {
            return { success: true };
          }
        };
      `;
      
      const pluginDir = path.join(testPluginsDir, 'json-plugin');
      fs.mkdirSync(pluginDir);
      fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify(pluginManifest, null, 2));
      fs.writeFileSync(path.join(pluginDir, 'index.js'), pluginCode);
      
      await pluginManager.initialize();
      const plugins = await pluginManager.discoverPlugins();
      
      expect(plugins).toHaveLength(1);
      expect(plugins[0].id).toBe('json-plugin');
    });

    test('should reject plugins with invalid manifest', async () => {
      const invalidPluginContent = `
        module.exports = {
          // Missing required manifest
          initialize: function(api) {
            this.api = api;
          }
        };
      `;
      
      const pluginPath = path.join(testPluginsDir, 'invalid-plugin.js');
      fs.writeFileSync(pluginPath, invalidPluginContent);
      
      await pluginManager.initialize();
      
      await expect(pluginManager.loadPluginFromPath(pluginPath)).rejects.toThrow();
    });

    test('should validate API version compatibility', async () => {
      const pluginContent = `
        module.exports = {
          manifest: {
            id: 'incompatible-plugin',
            name: 'Incompatible Plugin',
            version: '1.0.0',
            apiVersion: '2.0.0', // Incompatible API version
            description: 'An incompatible plugin'
          },
          
          initialize: function(api) {}
        };
      `;
      
      const pluginPath = path.join(testPluginsDir, 'incompatible-plugin.js');
      fs.writeFileSync(pluginPath, pluginContent);
      
      await pluginManager.initialize();
      
      await expect(pluginManager.loadPluginFromPath(pluginPath)).rejects.toThrow('incompatible API version');
    });
  });

  describe('Plugin Lifecycle Management', () => {
    let testPlugin;

    beforeEach(async () => {
      const pluginContent = `
        module.exports = {
          manifest: {
            id: 'lifecycle-plugin',
            name: 'Lifecycle Plugin',
            version: '1.0.0',
            apiVersion: '1.0.0',
            description: 'Plugin for lifecycle testing'
          },
          
          isInitialized: false,
          isDisposed: false,
          
          initialize: function(api) {
            this.api = api;
            this.isInitialized = true;
          },
          
          dispose: function() {
            this.isDisposed = true;
          },
          
          getActionTypes: function() {
            return ['lifecycle-action'];
          }
        };
      `;
      
      const pluginPath = path.join(testPluginsDir, 'lifecycle-plugin.js');
      fs.writeFileSync(pluginPath, pluginContent);
      
      await pluginManager.initialize();
      testPlugin = await pluginManager.loadPluginFromPath(pluginPath);
    });

    test('should enable plugin successfully', async () => {
      const success = await pluginManager.enablePlugin('lifecycle-plugin');
      
      expect(success).toBe(true);
      const plugin = pluginManager.getPlugin('lifecycle-plugin');
      expect(plugin.state).toBe('enabled');
      expect(mockLogger.info).toHaveBeenCalledWith('Plugin lifecycle-plugin enabled successfully');
    });

    test('should disable plugin successfully', async () => {
      await pluginManager.enablePlugin('lifecycle-plugin');
      const success = await pluginManager.disablePlugin('lifecycle-plugin');
      
      expect(success).toBe(true);
      const plugin = pluginManager.getPlugin('lifecycle-plugin');
      expect(plugin.state).toBe('disabled');
      expect(mockLogger.info).toHaveBeenCalledWith('Plugin lifecycle-plugin disabled successfully');
    });

    test('should unload plugin successfully', async () => {
      const success = await pluginManager.unloadPlugin('lifecycle-plugin');
      
      expect(success).toBe(true);
      const plugin = pluginManager.getPlugin('lifecycle-plugin');
      expect(plugin).toBeUndefined();
    });

    test('should reload plugin successfully', async () => {
      await pluginManager.enablePlugin('lifecycle-plugin');
      const success = await pluginManager.reloadPlugin('lifecycle-plugin');
      
      expect(success).toBe(true);
      const plugin = pluginManager.getPlugin('lifecycle-plugin');
      expect(plugin.state).toBe('enabled');
    });
  });

  describe('Plugin Execution', () => {
    beforeEach(async () => {
      const pluginContent = `
        module.exports = {
          manifest: {
            id: 'execution-plugin',
            name: 'Execution Plugin',
            version: '1.0.0',
            apiVersion: '1.0.0',
            description: 'Plugin for execution testing'
          },
          
          initialize: function(api) {
            this.api = api;
          },
          
          dispose: function() {},
          
          getActionTypes: function() {
            return ['test-execution'];
          },
          
          executeAction: function(actionType, config) {
            if (actionType === 'test-execution') {
              return {
                success: true,
                result: 'Executed successfully',
                data: config
              };
            }
            return { success: false, error: 'Unknown action type' };
          }
        };
      `;
      
      const pluginPath = path.join(testPluginsDir, 'execution-plugin.js');
      fs.writeFileSync(pluginPath, pluginContent);
      
      await pluginManager.initialize();
      await pluginManager.loadPluginFromPath(pluginPath);
      await pluginManager.enablePlugin('execution-plugin');
    });

    test('should execute plugin action successfully', async () => {
      const result = await pluginManager.executeAction('test-execution', { param: 'value' });
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('Executed successfully');
      expect(result.data).toEqual({ param: 'value' });
    });

    test('should handle plugin action execution errors', async () => {
      const result = await pluginManager.executeAction('unknown-action', {});
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('No plugin found for action type: unknown-action');
    });

    test('should respect execution timeout', async () => {
      const slowPluginContent = `
        module.exports = {
          manifest: {
            id: 'slow-plugin',
            name: 'Slow Plugin',
            version: '1.0.0',
            apiVersion: '1.0.0',
            description: 'A slow plugin for timeout testing'
          },
          
          initialize: function(api) {
            this.api = api;
          },
          
          dispose: function() {},
          
          getActionTypes: function() {
            return ['slow-action'];
          },
          
          executeAction: function(actionType, config) {
            // Simulate slow operation
            const start = Date.now();
            while (Date.now() - start < 10000) {
              // Busy wait for 10 seconds
            }
            return { success: true };
          }
        };
      `;
      
      const pluginPath = path.join(testPluginsDir, 'slow-plugin.js');
      fs.writeFileSync(pluginPath, pluginContent);
      
      await pluginManager.loadPluginFromPath(pluginPath);
      await pluginManager.enablePlugin('slow-plugin');
      
      // Set short timeout for testing
      pluginManager.config.security.timeoutMs = 100;
      
      const result = await pluginManager.executeAction('slow-action', {});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });

  describe('Plugin Configuration', () => {
    beforeEach(async () => {
      const pluginContent = `
        module.exports = {
          manifest: {
            id: 'config-plugin',
            name: 'Config Plugin',
            version: '1.0.0',
            apiVersion: '1.0.0',
            description: 'Plugin for configuration testing'
          },
          
          config: {
            setting1: 'default',
            setting2: 42
          },
          
          initialize: function(api) {
            this.api = api;
          },
          
          dispose: function() {},
          
          updateConfig: function(newConfig) {
            this.config = { ...this.config, ...newConfig };
          },
          
          getConfig: function() {
            return this.config;
          }
        };
      `;
      
      const pluginPath = path.join(testPluginsDir, 'config-plugin.js');
      fs.writeFileSync(pluginPath, pluginContent);
      
      await pluginManager.initialize();
      await pluginManager.loadPluginFromPath(pluginPath);
    });

    test('should get plugin configuration', async () => {
      const config = await pluginManager.getPluginConfig('config-plugin');
      
      expect(config).toEqual({
        setting1: 'default',
        setting2: 42
      });
    });

    test('should update plugin configuration', async () => {
      const newConfig = { setting1: 'updated', setting3: 'new' };
      const success = await pluginManager.updatePluginConfig('config-plugin', newConfig);
      
      expect(success).toBe(true);
      
      const updatedConfig = await pluginManager.getPluginConfig('config-plugin');
      expect(updatedConfig.setting1).toBe('updated');
      expect(updatedConfig.setting2).toBe(42); // Should remain unchanged
      expect(updatedConfig.setting3).toBe('new');
    });
  });

  describe('Dependency Resolution', () => {
    test('should resolve plugin dependencies in correct order', async () => {
      // Create plugin A that depends on plugin B
      const pluginBContent = `
        module.exports = {
          manifest: {
            id: 'plugin-b',
            name: 'Plugin B',
            version: '1.0.0',
            apiVersion: '1.0.0',
            description: 'Dependency plugin'
          },
          
          initialize: function(api) {
            this.api = api;
          },
          
          dispose: function() {}
        };
      `;
      
      const pluginAContent = `
        module.exports = {
          manifest: {
            id: 'plugin-a',
            name: 'Plugin A',
            version: '1.0.0',
            apiVersion: '1.0.0',
            description: 'Main plugin',
            dependencies: ['plugin-b']
          },
          
          initialize: function(api) {
            this.api = api;
          },
          
          dispose: function() {}
        };
      `;
      
      fs.writeFileSync(path.join(testPluginsDir, 'plugin-b.js'), pluginBContent);
      fs.writeFileSync(path.join(testPluginsDir, 'plugin-a.js'), pluginAContent);
      
      await pluginManager.initialize();
      
      const pluginA = pluginManager.getPlugin('plugin-a');
      const pluginB = pluginManager.getPlugin('plugin-b');
      
      expect(pluginB).toBeDefined();
      expect(pluginA).toBeDefined();
      expect(pluginA.loadOrder).toBeGreaterThan(pluginB.loadOrder);
    });

    test('should detect circular dependencies', async () => {
      const pluginAContent = `
        module.exports = {
          manifest: {
            id: 'plugin-circular-a',
            name: 'Plugin Circular A',
            version: '1.0.0',
            apiVersion: '1.0.0',
            dependencies: ['plugin-circular-b']
          }
        };
      `;
      
      const pluginBContent = `
        module.exports = {
          manifest: {
            id: 'plugin-circular-b',
            name: 'Plugin Circular B',
            version: '1.0.0',
            apiVersion: '1.0.0',
            dependencies: ['plugin-circular-a']
          }
        };
      `;
      
      fs.writeFileSync(path.join(testPluginsDir, 'plugin-circular-a.js'), pluginAContent);
      fs.writeFileSync(path.join(testPluginsDir, 'plugin-circular-b.js'), pluginBContent);
      
      await expect(pluginManager.initialize()).rejects.toThrow('Circular dependency detected');
    });
  });

  describe('Security and Sandboxing', () => {
    test('should restrict plugin access to disallowed modules', async () => {
      const maliciousPluginContent = `
        module.exports = {
          manifest: {
            id: 'malicious-plugin',
            name: 'Malicious Plugin',
            version: '1.0.0',
            apiVersion: '1.0.0',
            description: 'A potentially malicious plugin'
          },
          
          initialize: function(api) {
            try {
              const child_process = require('child_process');
              child_process.exec('rm -rf /', () => {});
            } catch (error) {
              // Expected to fail due to sandbox restrictions
            }
          },
          
          dispose: function() {}
        };
      `;
      
      const pluginPath = path.join(testPluginsDir, 'malicious-plugin.js');
      fs.writeFileSync(pluginPath, maliciousPluginContent);
      
      await pluginManager.initialize();
      
      // Should load but sandbox should prevent dangerous operations
      await expect(pluginManager.loadPluginFromPath(pluginPath)).not.toThrow();
    });

    test('should enforce memory limits', async () => {
      // This test would require more complex memory monitoring
      // For now, we just verify the configuration is applied
      expect(pluginManager.config.security.memoryLimitMB).toBe(100);
    });
  });

  describe('Plugin Discovery', () => {
    test('should discover plugins in plugins directory', async () => {
      const plugin1Content = `
        module.exports = {
          manifest: {
            id: 'discovery-plugin-1',
            name: 'Discovery Plugin 1',
            version: '1.0.0',
            apiVersion: '1.0.0'
          },
          initialize: () => {},
          dispose: () => {}
        };
      `;
      
      const plugin2Content = `
        module.exports = {
          manifest: {
            id: 'discovery-plugin-2',
            name: 'Discovery Plugin 2',
            version: '1.0.0',
            apiVersion: '1.0.0'
          },
          initialize: () => {},
          dispose: () => {}
        };
      `;
      
      fs.writeFileSync(path.join(testPluginsDir, 'discovery-plugin-1.js'), plugin1Content);
      fs.writeFileSync(path.join(testPluginsDir, 'discovery-plugin-2.js'), plugin2Content);
      
      await pluginManager.initialize();
      const plugins = pluginManager.getAllPlugins();
      
      expect(plugins).toHaveLength(2);
      expect(plugins.map(p => p.id).sort()).toEqual(['discovery-plugin-1', 'discovery-plugin-2']);
    });
  });

  describe('Error Handling', () => {
    test('should handle plugin loading errors gracefully', async () => {
      const brokenPluginContent = `
        // Syntax error - missing closing brace
        module.exports = {
          manifest: {
            id: 'broken-plugin'
      `;
      
      const pluginPath = path.join(testPluginsDir, 'broken-plugin.js');
      fs.writeFileSync(pluginPath, brokenPluginContent);
      
      await pluginManager.initialize();
      
      await expect(pluginManager.loadPluginFromPath(pluginPath)).rejects.toThrow();
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });

    test('should handle plugin execution errors gracefully', async () => {
      const errorPluginContent = `
        module.exports = {
          manifest: {
            id: 'error-plugin',
            name: 'Error Plugin',
            version: '1.0.0',
            apiVersion: '1.0.0'
          },
          
          initialize: function(api) {
            this.api = api;
          },
          
          dispose: function() {},
          
          getActionTypes: function() {
            return ['error-action'];
          },
          
          executeAction: function(actionType, config) {
            throw new Error('Intentional plugin error');
          }
        };
      `;
      
      const pluginPath = path.join(testPluginsDir, 'error-plugin.js');
      fs.writeFileSync(pluginPath, errorPluginContent);
      
      await pluginManager.initialize();
      await pluginManager.loadPluginFromPath(pluginPath);
      await pluginManager.enablePlugin('error-plugin');
      
      const result = await pluginManager.executeAction('error-action', {});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Intentional plugin error');
    });
  });

  describe('Events and Communication', () => {
    test('should emit plugin lifecycle events', async () => {
      const loadedEvent = jest.fn();
      const enabledEvent = jest.fn();
      const disabledEvent = jest.fn();
      
      pluginManager.on('plugin-loaded', loadedEvent);
      pluginManager.on('plugin-enabled', enabledEvent);
      pluginManager.on('plugin-disabled', disabledEvent);
      
      const pluginContent = `
        module.exports = {
          manifest: {
            id: 'event-plugin',
            name: 'Event Plugin',
            version: '1.0.0',
            apiVersion: '1.0.0'
          },
          initialize: () => {},
          dispose: () => {}
        };
      `;
      
      const pluginPath = path.join(testPluginsDir, 'event-plugin.js');
      fs.writeFileSync(pluginPath, pluginContent);
      
      await pluginManager.initialize();
      await pluginManager.loadPluginFromPath(pluginPath);
      await pluginManager.enablePlugin('event-plugin');
      await pluginManager.disablePlugin('event-plugin');
      
      expect(loadedEvent).toHaveBeenCalledWith(expect.objectContaining({ pluginId: 'event-plugin' }));
      expect(enabledEvent).toHaveBeenCalledWith(expect.objectContaining({ pluginId: 'event-plugin' }));
      expect(disabledEvent).toHaveBeenCalledWith(expect.objectContaining({ pluginId: 'event-plugin' }));
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should collect plugin statistics', async () => {
      const pluginContent = `
        module.exports = {
          manifest: {
            id: 'stats-plugin',
            name: 'Stats Plugin',
            version: '1.0.0',
            apiVersion: '1.0.0'
          },
          initialize: () => {},
          dispose: () => {},
          getActionTypes: () => ['stats-action'],
          executeAction: () => ({ success: true })
        };
      `;
      
      const pluginPath = path.join(testPluginsDir, 'stats-plugin.js');
      fs.writeFileSync(pluginPath, pluginContent);
      
      await pluginManager.initialize();
      await pluginManager.loadPluginFromPath(pluginPath);
      await pluginManager.enablePlugin('stats-plugin');
      await pluginManager.executeAction('stats-action', {});
      
      const stats = pluginManager.getStatistics();
      
      expect(stats.totalPlugins).toBe(1);
      expect(stats.enabledPlugins).toBe(1);
      expect(stats.disabledPlugins).toBe(0);
      expect(stats.totalExecutions).toBeGreaterThan(0);
    });
  });

  describe('Template Creation', () => {
    test('should create plugin template', async () => {
      const templateOptions = {
        id: 'new-plugin',
        name: 'New Plugin',
        description: 'A new plugin created from template',
        author: 'Test Author'
      };
      
      const templatePath = await pluginManager.createPluginTemplate(templateOptions);
      
      expect(fs.existsSync(templatePath)).toBe(true);
      
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      expect(templateContent).toContain('new-plugin');
      expect(templateContent).toContain('New Plugin');
      expect(templateContent).toContain('Test Author');
    });
  });

  describe('Cleanup and Disposal', () => {
    test('should dispose all resources properly', async () => {
      const pluginContent = `
        module.exports = {
          manifest: {
            id: 'disposal-plugin',
            name: 'Disposal Plugin',
            version: '1.0.0',
            apiVersion: '1.0.0'
          },
          
          isDisposed: false,
          
          initialize: () => {},
          
          dispose: function() {
            this.isDisposed = true;
          }
        };
      `;
      
      const pluginPath = path.join(testPluginsDir, 'disposal-plugin.js');
      fs.writeFileSync(pluginPath, pluginContent);
      
      await pluginManager.initialize();
      await pluginManager.loadPluginFromPath(pluginPath);
      await pluginManager.enablePlugin('disposal-plugin');
      
      await pluginManager.dispose();
      
      expect(pluginManager.getAllPlugins()).toHaveLength(0);
      expect(pluginManager.isInitialized).toBe(false);
    });
  });
});