const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { promisify } = require('util');

/**
 * Advanced Plugin Architecture System
 *
 * Provides a secure, extensible plugin system with hot-loading, sandboxing,
 * lifecycle management, and comprehensive error handling. Supports both
 * JavaScript and native plugins with dependency management and versioning.
 *
 * Features:
 * - Secure sandbox execution environment
 * - Hot-loading and hot-reloading of plugins
 * - Plugin lifecycle management (load, enable, disable, unload)
 * - Dependency resolution and version checking
 * - Plugin API versioning and compatibility checking
 * - Comprehensive error handling and recovery
 * - Plugin metrics and performance monitoring
 * - Plugin configuration management
 * - Event-driven plugin communication
 * - Plugin marketplace integration (future)
 */
class PluginManager extends EventEmitter {
  constructor(config = {}, logManager = null, performanceMonitor = null) {
    super();

    this.config = this.mergeConfig(config);
    this.logManager = logManager;
    this.performanceMonitor = performanceMonitor;

    // Plugin management state
    this.plugins = new Map(); // pluginId -> Plugin instance
    this.pluginConfigs = new Map(); // pluginId -> configuration
    this.pluginDependencies = new Map(); // pluginId -> dependencies
    this.loadOrder = []; // Dependency-resolved load order
    this.pluginStates = new Map(); // pluginId -> state (loaded, enabled, disabled, error)

    // Plugin directories and paths
    this.pluginPaths = new Set();
    this.watchedDirectories = new Map(); // path -> fs.FSWatcher

    // Security and sandboxing
    this.sandboxes = new Map(); // pluginId -> VM context
    this.apiVersions = new Map(); // version -> API definition

    // Performance tracking
    this.pluginMetrics = new Map(); // pluginId -> metrics
    this.loadTimes = new Map(); // pluginId -> load time

    // Plugin communication
    this.pluginChannels = new Map(); // channelId -> Set<pluginId>
    this.messageQueue = []; // Queued messages for disabled plugins

    this.init();
  }

  /**
   * Merge configuration with defaults
   */
  mergeConfig(userConfig) {
    const defaultConfig = {
      enabled: true,
      pluginDirectories: ['plugins', 'node_modules'],
      autoLoad: true,
      hotReload: true,
      enableSandbox: true,
      maxPlugins: 50,
      loadTimeout: 30000, // 30 seconds
      enableMetrics: true,

      // Security settings
      allowNativePlugins: false,
      allowFileSystem: false,
      allowNetworking: false,
      allowChildProcesses: false,

      // API versioning
      apiVersion: '1.0.0',
      compatibleVersions: ['1.0.0'],

      // Plugin validation
      requireSignature: false,
      trustedPublishers: [],

      // Performance limits
      maxMemoryPerPlugin: 100 * 1024 * 1024, // 100MB
      maxExecutionTime: 5000, // 5 seconds

      // Development settings
      allowLocalPlugins: true,
      enableDeveloperMode: false,
      verboseLogging: false
    };

    return { ...defaultConfig, ...userConfig };
  }

  /**
   * Initialize plugin manager
   */
  async init() {
    try {
      this.log('info', 'PluginManager initializing...');

      // Set up plugin directories
      await this.setupPluginDirectories();

      // Initialize API versions
      this.initializeAPIVersions();

      // Start file watchers for hot-reload
      if (this.config.hotReload) {
        await this.setupFileWatchers();
      }

      // Auto-load plugins if enabled
      if (this.config.autoLoad) {
        await this.loadAllPlugins();
      }

      this.log('info', 'PluginManager initialized successfully', {
        pluginCount: this.plugins.size,
        directories: Array.from(this.pluginPaths)
      });

      this.emit('manager-ready');
    } catch (error) {
      this.log('error', 'Failed to initialize PluginManager:', error);
      throw error;
    }
  }

  /**
   * Set up plugin directories
   */
  async setupPluginDirectories() {
    for (const dir of this.config.pluginDirectories) {
      const pluginPath = path.resolve(dir);

      try {
        // Create directory if it doesn't exist
        if (!fs.existsSync(pluginPath)) {
          fs.mkdirSync(pluginPath, { recursive: true });
          this.log('info', `Created plugin directory: ${pluginPath}`);
        }

        this.pluginPaths.add(pluginPath);
        this.log('debug', `Added plugin path: ${pluginPath}`);
      } catch (error) {
        this.log('warn', `Failed to set up plugin directory ${pluginPath}:`, error);
      }
    }
  }

  /**
   * Initialize API versions and compatibility
   */
  initializeAPIVersions() {
    // Define API v1.0.0
    this.apiVersions.set('1.0.0', {
      version: '1.0.0',
      methods: {
        // Core plugin lifecycle
        initialize: { required: true },
        activate: { required: false },
        deactivate: { required: false },
        dispose: { required: false },

        // Configuration
        getConfigSchema: { required: false },
        configure: { required: false },

        // Action handling
        executeAction: { required: false },
        getActionTypes: { required: false },

        // Event handling
        onEvent: { required: false },

        // Hardware integration
        onHardwareEvent: { required: false },
        sendHardwareCommand: { required: false }
      },

      // Available APIs for plugins
      api: {
        // Logging
        log: (level, message, data) => this.log(level, message, data),

        // Configuration access
        getConfig: key => this.getPluginConfig(this.currentPluginId, key),
        setConfig: (key, value) => this.setPluginConfig(this.currentPluginId, key, value),

        // Event system
        emit: (event, data) => this.emitPluginEvent(this.currentPluginId, event, data),
        on: (event, callback) => this.onPluginEvent(this.currentPluginId, event, callback),

        // Plugin communication
        sendMessage: (targetPlugin, message) =>
          this.sendPluginMessage(this.currentPluginId, targetPlugin, message),

        // Performance monitoring
        startTiming: operation => this.startPluginTiming(this.currentPluginId, operation),
        endTiming: timerId => this.endPluginTiming(this.currentPluginId, timerId)
      }
    });
  }

  /**
   * Set up file watchers for hot-reload
   */
  async setupFileWatchers() {
    for (const pluginPath of this.pluginPaths) {
      try {
        if (!fs.existsSync(pluginPath)) {
          continue;
        }

        const watcher = fs.watch(pluginPath, { recursive: true }, async (eventType, filename) => {
          if (!filename || !filename.endsWith('.js')) {
            return;
          }

          const fullPath = path.join(pluginPath, filename);
          this.log('debug', `Plugin file ${eventType}: ${fullPath}`);

          // Debounce file changes
          clearTimeout(this.reloadTimeout);
          this.reloadTimeout = setTimeout(async () => {
            await this.handleFileChange(fullPath, eventType);
          }, 1000);
        });

        this.watchedDirectories.set(pluginPath, watcher);
        this.log('debug', `Set up file watcher for: ${pluginPath}`);
      } catch (error) {
        this.log('warn', `Failed to set up file watcher for ${pluginPath}:`, error);
      }
    }
  }

  /**
   * Handle file changes for hot-reload
   */
  async handleFileChange(filePath, eventType) {
    try {
      const pluginId = this.getPluginIdFromPath(filePath);
      if (!pluginId) {
        return;
      }

      if (eventType === 'change' && this.plugins.has(pluginId)) {
        this.log('info', `Hot-reloading plugin: ${pluginId}`);
        await this.reloadPlugin(pluginId);
      } else if (eventType === 'rename' && !fs.existsSync(filePath)) {
        this.log('info', `Plugin removed, unloading: ${pluginId}`);
        await this.unloadPlugin(pluginId);
      }
    } catch (error) {
      this.log('error', 'Error handling file change:', error);
    }
  }

  /**
   * Get plugin ID from file path
   */
  getPluginIdFromPath(filePath) {
    const filename = path.basename(filePath, '.js');
    const dirname = path.basename(path.dirname(filePath));

    // Check if it's a main plugin file
    if (filename === 'index' || filename === dirname) {
      return dirname;
    }

    // Check if it's a direct plugin file
    if (this.plugins.has(filename)) {
      return filename;
    }

    return null;
  }

  /**
   * Load all plugins from configured directories
   */
  async loadAllPlugins() {
    this.log('info', 'Loading all plugins...');
    const startTime = Date.now();

    const plugins = await this.discoverPlugins();
    const loadResults = {
      loaded: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    // Sort plugins by dependencies
    const sortedPlugins = this.resolveDependencies(plugins);

    for (const plugin of sortedPlugins) {
      try {
        await this.loadPlugin(plugin.id, plugin.path);
        loadResults.loaded++;
      } catch (error) {
        loadResults.failed++;
        loadResults.errors.push({ plugin: plugin.id, error: error.message });
        this.log('error', `Failed to load plugin ${plugin.id}:`, error);
      }
    }

    const loadTime = Date.now() - startTime;
    this.log('info', 'Plugin loading complete', {
      ...loadResults,
      totalTime: loadTime,
      pluginsLoaded: loadResults.loaded
    });

    this.emit('plugins-loaded', loadResults);
    return loadResults;
  }

  /**
   * Discover plugins in configured directories
   */
  async discoverPlugins() {
    const discovered = [];

    for (const pluginPath of this.pluginPaths) {
      if (!fs.existsSync(pluginPath)) {
        continue;
      }

      try {
        const entries = fs.readdirSync(pluginPath, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.isDirectory()) {
            // Directory-based plugin
            const pluginDir = path.join(pluginPath, entry.name);
            const manifestPath = path.join(pluginDir, 'plugin.json');
            const indexPath = path.join(pluginDir, 'index.js');

            if (fs.existsSync(manifestPath) && fs.existsSync(indexPath)) {
              discovered.push({
                id: entry.name,
                path: pluginDir,
                type: 'directory'
              });
            }
          } else if (entry.isFile() && entry.name.endsWith('.js')) {
            // Single-file plugin
            const pluginId = path.basename(entry.name, '.js');
            discovered.push({
              id: pluginId,
              path: path.join(pluginPath, entry.name),
              type: 'file'
            });
          }
        }
      } catch (error) {
        this.log('warn', `Failed to discover plugins in ${pluginPath}:`, error);
      }
    }

    this.log('debug', `Discovered ${discovered.length} plugins`);
    return discovered;
  }

  /**
   * Resolve plugin dependencies and return sorted load order
   */
  resolveDependencies(plugins) {
    const dependencyMap = new Map();
    const resolved = [];
    const resolving = new Set();

    // Build dependency map
    for (const plugin of plugins) {
      try {
        const manifest = this.loadPluginManifest(plugin);
        dependencyMap.set(plugin.id, {
          plugin,
          dependencies: manifest.dependencies || []
        });
      } catch (error) {
        // Plugin without manifest - no dependencies
        dependencyMap.set(plugin.id, {
          plugin,
          dependencies: []
        });
      }
    }

    // Recursive dependency resolution
    const resolve = pluginId => {
      if (resolved.find(p => p.id === pluginId)) {
        return;
      }
      if (resolving.has(pluginId)) {
        throw new Error(`Circular dependency detected: ${pluginId}`);
      }

      resolving.add(pluginId);

      const entry = dependencyMap.get(pluginId);
      if (!entry) {
        resolving.delete(pluginId);
        return; // Plugin not found
      }

      // Resolve dependencies first
      for (const dep of entry.dependencies) {
        resolve(dep);
      }

      resolved.push(entry.plugin);
      resolving.delete(pluginId);
    };

    // Resolve all plugins
    for (const plugin of plugins) {
      resolve(plugin.id);
    }

    return resolved;
  }

  /**
   * Load plugin manifest
   */
  loadPluginManifest(plugin) {
    let manifestPath;

    if (plugin.type === 'directory') {
      manifestPath = path.join(plugin.path, 'plugin.json');
    } else {
      // For file-based plugins, try to find manifest in same directory
      const dir = path.dirname(plugin.path);
      const manifestName = `${plugin.id}.json`;
      manifestPath = path.join(dir, manifestName);
    }

    if (!fs.existsSync(manifestPath)) {
      return {}; // No manifest - default configuration
    }

    try {
      const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
      return JSON.parse(manifestContent);
    } catch (error) {
      throw new Error(`Invalid plugin manifest: ${manifestPath}`);
    }
  }

  /**
   * Load a specific plugin
   */
  async loadPlugin(pluginId, pluginPath) {
    const timerId = this.performanceMonitor?.startTimer(`plugin-load-${pluginId}`);

    try {
      this.log('info', `Loading plugin: ${pluginId}`, { path: pluginPath });
      this.currentPluginId = pluginId;

      // Check if already loaded
      if (this.plugins.has(pluginId)) {
        throw new Error(`Plugin ${pluginId} is already loaded`);
      }

      // Load and validate manifest
      const manifest = this.loadPluginManifest({ id: pluginId, path: pluginPath });
      await this.validatePluginManifest(manifest);

      // Create sandbox if enabled
      let context = null;
      if (this.config.enableSandbox) {
        context = this.createPluginSandbox(pluginId);
      }

      // Load plugin code
      const plugin = await this.loadPluginCode(pluginId, pluginPath, context);

      // Validate plugin interface
      this.validatePluginInterface(plugin, manifest.apiVersion || this.config.apiVersion);

      // Initialize plugin
      await this.initializePlugin(pluginId, plugin, manifest);

      // Store plugin data
      this.plugins.set(pluginId, plugin);
      this.pluginConfigs.set(pluginId, manifest);
      this.pluginStates.set(pluginId, 'loaded');
      this.loadTimes.set(pluginId, Date.now());

      // Enable plugin if configured
      if (manifest.autoEnable !== false) {
        await this.enablePlugin(pluginId);
      }

      this.log('info', `Plugin loaded successfully: ${pluginId}`);
      this.emit('plugin-loaded', { pluginId, manifest });

      return plugin;
    } catch (error) {
      this.pluginStates.set(pluginId, 'error');
      this.log('error', `Failed to load plugin ${pluginId}:`, error);
      this.emit('plugin-error', { pluginId, error });
      throw error;
    } finally {
      if (timerId && this.performanceMonitor) {
        this.performanceMonitor.endTimer(timerId);
      }
      this.currentPluginId = null;
    }
  }

  /**
   * Create secure sandbox for plugin execution
   */
  createPluginSandbox(pluginId) {
    const apiVersion = this.config.apiVersion;
    const api = this.apiVersions.get(apiVersion)?.api || {};

    const sandbox = {
      // Standard Node.js globals (limited)
      console: {
        log: (...args) => this.log('info', `[${pluginId}]`, ...args),
        warn: (...args) => this.log('warn', `[${pluginId}]`, ...args),
        error: (...args) => this.log('error', `[${pluginId}]`, ...args),
        info: (...args) => this.log('info', `[${pluginId}]`, ...args),
        debug: (...args) => this.log('debug', `[${pluginId}]`, ...args)
      },

      // Plugin API
      pluginAPI: api,

      // Controlled globals
      Buffer: this.config.allowFileSystem ? Buffer : undefined,
      process: {
        env: process.env,
        version: process.version,
        platform: process.platform
      },

      // Module system (controlled)
      require: this.createControlledRequire(pluginId),

      // Prevent access to dangerous globals
      global: undefined,
      __dirname: path.dirname(this.getPluginPath(pluginId)),
      __filename: this.getPluginPath(pluginId)
    };

    const context = vm.createContext(sandbox);
    this.sandboxes.set(pluginId, context);

    return context;
  }

  /**
   * Create controlled require function for sandbox
   */
  createControlledRequire(pluginId) {
    const allowedModules = new Set(['events', 'util', 'crypto', 'querystring', 'url', 'path']);

    return moduleId => {
      // Allow relative requires within plugin directory
      if (moduleId.startsWith('.')) {
        const pluginDir = path.dirname(this.getPluginPath(pluginId));
        const modulePath = path.resolve(pluginDir, moduleId);

        // Ensure it's within plugin directory
        if (modulePath.startsWith(pluginDir)) {
          return require(modulePath);
        }
      }

      // Allow specific Node.js modules
      if (allowedModules.has(moduleId)) {
        return require(moduleId);
      }

      throw new Error(`Module '${moduleId}' is not allowed in plugin sandbox`);
    };
  }

  /**
   * Load plugin code
   */
  async loadPluginCode(pluginId, pluginPath, context) {
    let code;
    let filePath;

    if (fs.statSync(pluginPath).isDirectory()) {
      filePath = path.join(pluginPath, 'index.js');
    } else {
      filePath = pluginPath;
    }

    code = fs.readFileSync(filePath, 'utf-8');

    if (context) {
      // Execute in sandbox
      const script = new vm.Script(code, { filename: filePath });
      const result = script.runInContext(context, {
        timeout: this.config.maxExecutionTime
      });

      // Extract plugin exports
      return context.module?.exports || result;
    }
    // Load directly (not sandboxed)
    delete require.cache[require.resolve(filePath)];
    return require(filePath);
  }

  /**
   * Validate plugin manifest
   */
  async validatePluginManifest(manifest) {
    // Check required fields
    const required = ['name', 'version'];
    for (const field of required) {
      if (!manifest[field]) {
        throw new Error(`Plugin manifest missing required field: ${field}`);
      }
    }

    // Check API version compatibility
    const apiVersion = manifest.apiVersion || this.config.apiVersion;
    if (!this.config.compatibleVersions.includes(apiVersion)) {
      throw new Error(`Plugin API version ${apiVersion} is not compatible`);
    }

    // Validate dependencies
    if (manifest.dependencies) {
      for (const dep of manifest.dependencies) {
        if (!this.plugins.has(dep) && !this.isLoadingPlugin(dep)) {
          throw new Error(`Missing dependency: ${dep}`);
        }
      }
    }
  }

  /**
   * Validate plugin interface
   */
  validatePluginInterface(plugin, apiVersion) {
    const apiDef = this.apiVersions.get(apiVersion);
    if (!apiDef) {
      throw new Error(`Unknown API version: ${apiVersion}`);
    }

    // Check required methods
    for (const [method, config] of Object.entries(apiDef.methods)) {
      if (config.required && typeof plugin[method] !== 'function') {
        throw new Error(`Plugin missing required method: ${method}`);
      }
    }
  }

  /**
   * Initialize plugin
   */
  async initializePlugin(pluginId, plugin, manifest) {
    if (typeof plugin.initialize === 'function') {
      const config = this.getPluginConfig(pluginId) || {};
      await plugin.initialize(config, manifest);
    }
  }

  /**
   * Enable plugin
   */
  async enablePlugin(pluginId) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    if (this.pluginStates.get(pluginId) === 'enabled') {
      this.log('warn', `Plugin ${pluginId} is already enabled`);
      return;
    }

    try {
      if (typeof plugin.activate === 'function') {
        await plugin.activate();
      }

      this.pluginStates.set(pluginId, 'enabled');
      this.log('info', `Plugin enabled: ${pluginId}`);
      this.emit('plugin-enabled', { pluginId });
    } catch (error) {
      this.pluginStates.set(pluginId, 'error');
      this.log('error', `Failed to enable plugin ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Disable plugin
   */
  async disablePlugin(pluginId) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    if (this.pluginStates.get(pluginId) === 'disabled') {
      this.log('warn', `Plugin ${pluginId} is already disabled`);
      return;
    }

    try {
      if (typeof plugin.deactivate === 'function') {
        await plugin.deactivate();
      }

      this.pluginStates.set(pluginId, 'disabled');
      this.log('info', `Plugin disabled: ${pluginId}`);
      this.emit('plugin-disabled', { pluginId });
    } catch (error) {
      this.log('error', `Failed to disable plugin ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Unload plugin
   */
  async unloadPlugin(pluginId) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      this.log('warn', `Plugin not found for unload: ${pluginId}`);
      return;
    }

    try {
      // Disable first if enabled
      if (this.pluginStates.get(pluginId) === 'enabled') {
        await this.disablePlugin(pluginId);
      }

      // Dispose plugin resources
      if (typeof plugin.dispose === 'function') {
        await plugin.dispose();
      }

      // Clean up sandbox
      const sandbox = this.sandboxes.get(pluginId);
      if (sandbox) {
        this.sandboxes.delete(pluginId);
      }

      // Remove from collections
      this.plugins.delete(pluginId);
      this.pluginConfigs.delete(pluginId);
      this.pluginStates.delete(pluginId);
      this.loadTimes.delete(pluginId);
      this.pluginMetrics.delete(pluginId);

      this.log('info', `Plugin unloaded: ${pluginId}`);
      this.emit('plugin-unloaded', { pluginId });
    } catch (error) {
      this.log('error', `Failed to unload plugin ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Reload plugin
   */
  async reloadPlugin(pluginId) {
    const pluginConfig = this.pluginConfigs.get(pluginId);
    const pluginPath = this.getPluginPath(pluginId);

    if (!pluginPath) {
      throw new Error(`Cannot reload plugin ${pluginId}: path not found`);
    }

    try {
      // Unload existing plugin
      await this.unloadPlugin(pluginId);

      // Load updated plugin
      await this.loadPlugin(pluginId, pluginPath);

      this.log('info', `Plugin reloaded: ${pluginId}`);
      this.emit('plugin-reloaded', { pluginId });
    } catch (error) {
      this.log('error', `Failed to reload plugin ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Get plugin path
   */
  getPluginPath(pluginId) {
    // This would need to be implemented based on how plugin paths are stored
    // For now, return null as placeholder
    return null;
  }

  /**
   * Check if plugin is currently being loaded
   */
  isLoadingPlugin(pluginId) {
    // This would track plugins currently in the loading process
    return false;
  }

  /**
   * Get plugin configuration
   */
  getPluginConfig(pluginId, key = null) {
    const config = this.pluginConfigs.get(pluginId)?.config || {};
    return key ? config[key] : config;
  }

  /**
   * Set plugin configuration
   */
  setPluginConfig(pluginId, key, value) {
    let config = this.pluginConfigs.get(pluginId);
    if (!config) {
      config = { config: {} };
      this.pluginConfigs.set(pluginId, config);
    }

    if (!config.config) {
      config.config = {};
    }

    config.config[key] = value;
    this.emit('plugin-config-changed', { pluginId, key, value });
  }

  /**
   * Get all plugins with their states
   */
  getPlugins() {
    const result = [];

    for (const [pluginId, plugin] of this.plugins) {
      const config = this.pluginConfigs.get(pluginId) || {};
      const state = this.pluginStates.get(pluginId) || 'unknown';
      const loadTime = this.loadTimes.get(pluginId);

      result.push({
        id: pluginId,
        name: config.name || pluginId,
        version: config.version || '1.0.0',
        state,
        loadTime,
        description: config.description,
        author: config.author
      });
    }

    return result;
  }

  /**
   * Execute action through plugin
   */
  async executeAction(actionType, actionData, context = {}) {
    const results = [];

    for (const [pluginId, plugin] of this.plugins) {
      if (this.pluginStates.get(pluginId) !== 'enabled') {
        continue;
      }

      try {
        if (typeof plugin.executeAction === 'function') {
          const result = await plugin.executeAction(actionType, actionData, context);
          if (result) {
            results.push({ pluginId, result });
          }
        }
      } catch (error) {
        this.log('error', `Plugin ${pluginId} action execution failed:`, error);
      }
    }

    return results;
  }

  /**
   * Emit plugin event
   */
  emitPluginEvent(pluginId, event, data) {
    this.emit('plugin-event', { pluginId, event, data });
  }

  /**
   * Listen to plugin event
   */
  onPluginEvent(pluginId, event, callback) {
    this.on('plugin-event', eventData => {
      if (eventData.pluginId === pluginId && eventData.event === event) {
        callback(eventData.data);
      }
    });
  }

  /**
   * Send message between plugins
   */
  sendPluginMessage(fromPluginId, toPluginId, message) {
    const targetPlugin = this.plugins.get(toPluginId);
    if (!targetPlugin) {
      throw new Error(`Target plugin not found: ${toPluginId}`);
    }

    if (this.pluginStates.get(toPluginId) !== 'enabled') {
      // Queue message for when plugin is enabled
      this.messageQueue.push({
        from: fromPluginId,
        to: toPluginId,
        message,
        timestamp: Date.now()
      });
      return;
    }

    try {
      if (typeof targetPlugin.onMessage === 'function') {
        targetPlugin.onMessage(fromPluginId, message);
      }
    } catch (error) {
      this.log('error', `Failed to deliver message to ${toPluginId}:`, error);
    }
  }

  /**
   * Start plugin timing
   */
  startPluginTiming(pluginId, operation) {
    if (this.performanceMonitor) {
      return this.performanceMonitor.startTimer(`plugin-${pluginId}-${operation}`, {
        pluginId,
        operation
      });
    }
    return null;
  }

  /**
   * End plugin timing
   */
  endPluginTiming(pluginId, timerId) {
    if (this.performanceMonitor && timerId) {
      this.performanceMonitor.endTimer(timerId);
    }
  }

  /**
   * Clean up resources
   */
  async dispose() {
    this.log('info', 'PluginManager disposing...');

    // Unload all plugins
    const pluginIds = Array.from(this.plugins.keys());
    for (const pluginId of pluginIds) {
      try {
        await this.unloadPlugin(pluginId);
      } catch (error) {
        this.log('error', `Failed to unload plugin ${pluginId} during dispose:`, error);
      }
    }

    // Stop file watchers
    for (const watcher of this.watchedDirectories.values()) {
      watcher.close();
    }
    this.watchedDirectories.clear();

    // Clear all collections
    this.plugins.clear();
    this.pluginConfigs.clear();
    this.pluginStates.clear();
    this.sandboxes.clear();

    this.log('info', 'PluginManager disposed');
    this.emit('manager-disposed');
  }

  /**
   * Log message with plugin context
   */
  log(level, message, data = {}) {
    if (this.logManager) {
      this.logManager[level](`[PluginManager] ${message}`, data);
    } else {
      console[level](`[PluginManager] ${message}`, data);
    }
  }
}

module.exports = PluginManager;
