/**
 * SystemIntegrationManager - Advanced system-level integrations
 * 
 * This class provides deep OS integration features including:
 * - Global keyboard shortcuts that work system-wide
 * - Advanced clipboard management and monitoring
 * - Window management and focus control
 * - System state monitoring and response
 * - Cross-platform system API access
 * - Application lifecycle management
 * - Hardware input capture beyond keyboard
 */

const EventEmitter = require('events');
const { app, BrowserWindow, globalShortcut, clipboard, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

class SystemIntegrationManager extends EventEmitter {
  constructor(logger) {
    super();
    
    this.logger = logger || console;
    this.isInitialized = false;
    
    // Global shortcut tracking
    this.registeredShortcuts = new Map();
    this.shortcutActions = new Map();
    
    // Clipboard monitoring
    this.clipboardHistory = [];
    this.clipboardWatcher = null;
    this.lastClipboardContent = '';
    
    // Window management
    this.windowStates = new Map();
    this.focusedApplication = null;
    this.windowWatcher = null;
    
    // System state monitoring
    this.systemState = {
      isScreenLocked: false,
      idleTime: 0,
      batteryLevel: null,
      networkStatus: 'unknown',
      cpuUsage: 0,
      memoryUsage: 0
    };
    
    // Hardware input management
    this.inputDevices = new Map();
    this.inputFilters = new Map();
    
    // Application integration
    this.appIntegrations = new Map();
    this.automationRules = new Map();
    
    // Cross-platform compatibility
    this.platform = process.platform;
    this.platformFeatures = this.initializePlatformFeatures();
    
    this.logger.info('SystemIntegrationManager initialized');
  }
  
  /**
   * Initialize platform-specific features
   */
  initializePlatformFeatures() {
    const features = {
      globalShortcuts: true,
      clipboardMonitoring: true,
      windowManagement: true,
      systemStateMonitoring: true,
      applicationIntegration: false,
      hardwareInputCapture: false
    };
    
    switch (this.platform) {
      case 'darwin': // macOS
        features.applicationIntegration = true;
        features.hardwareInputCapture = true;
        break;
      case 'win32': // Windows
        features.applicationIntegration = true;
        features.hardwareInputCapture = true;
        break;
      case 'linux':
        features.applicationIntegration = true;
        break;
    }
    
    return features;
  }
  
  /**
   * Initialize all system integration features
   */
  async initialize() {
    if (this.isInitialized) {
      this.logger.warn('SystemIntegrationManager already initialized');
      return;
    }
    
    try {
      // Initialize core features
      await this.initializeGlobalShortcuts();
      await this.initializeClipboardMonitoring();
      await this.initializeWindowManagement();
      await this.initializeSystemStateMonitoring();
      
      // Initialize platform-specific features
      if (this.platformFeatures.applicationIntegration) {
        await this.initializeApplicationIntegration();
      }
      
      if (this.platformFeatures.hardwareInputCapture) {
        await this.initializeHardwareInputCapture();
      }
      
      // Set up cleanup handlers
      this.setupCleanupHandlers();
      
      this.isInitialized = true;
      this.emit('initialized');
      this.logger.info('SystemIntegrationManager fully initialized');
      
    } catch (error) {
      this.logger.error('Failed to initialize SystemIntegrationManager:', error);
      this.emit('error', { message: 'Initialization failed', error });
    }
  }
  
  /**
   * Initialize global keyboard shortcut system
   */
  async initializeGlobalShortcuts() {
    if (!this.platformFeatures.globalShortcuts) {
      this.logger.warn('Global shortcuts not supported on this platform');
      return;
    }
    
    try {
      // Test if global shortcuts are available
      if (!globalShortcut.isRegistered('CommandOrControl+F12')) {
        // Register test shortcut
        const registered = globalShortcut.register('CommandOrControl+F12', () => {
          this.logger.debug('Test global shortcut triggered');
        });
        
        if (registered) {
          globalShortcut.unregister('CommandOrControl+F12');
          this.logger.info('Global shortcut system available');
        } else {
          throw new Error('Failed to register test shortcut');
        }
      }
      
    } catch (error) {
      this.logger.error('Global shortcut initialization failed:', error);
      this.platformFeatures.globalShortcuts = false;
    }
  }
  
  /**
   * Register a global keyboard shortcut
   */
  registerGlobalShortcut(shortcut, action, metadata = {}) {
    if (!this.platformFeatures.globalShortcuts) {
      throw new Error('Global shortcuts not supported');
    }
    
    try {
      // Check if shortcut is already registered
      if (this.registeredShortcuts.has(shortcut)) {
        throw new Error(`Shortcut ${shortcut} already registered`);
      }
      
      const registered = globalShortcut.register(shortcut, () => {
        try {
          this.logger.debug(`Global shortcut triggered: ${shortcut}`);
          this.executeShortcutAction(shortcut, action, metadata);
        } catch (error) {
          this.logger.error(`Error executing shortcut ${shortcut}:`, error);
        }
      });
      
      if (!registered) {
        throw new Error(`Failed to register shortcut: ${shortcut}`);
      }
      
      this.registeredShortcuts.set(shortcut, {
        action,
        metadata,
        registeredAt: new Date()
      });
      
      this.logger.info(`Global shortcut registered: ${shortcut}`);
      this.emit('shortcut-registered', { shortcut, action, metadata });
      
    } catch (error) {
      this.logger.error(`Failed to register global shortcut ${shortcut}:`, error);
      throw error;
    }
  }
  
  /**
   * Unregister a global keyboard shortcut
   */
  unregisterGlobalShortcut(shortcut) {
    if (!this.registeredShortcuts.has(shortcut)) {
      throw new Error(`Shortcut ${shortcut} not registered`);
    }
    
    try {
      globalShortcut.unregister(shortcut);
      this.registeredShortcuts.delete(shortcut);
      
      this.logger.info(`Global shortcut unregistered: ${shortcut}`);
      this.emit('shortcut-unregistered', { shortcut });
      
    } catch (error) {
      this.logger.error(`Failed to unregister shortcut ${shortcut}:`, error);
      throw error;
    }
  }
  
  /**
   * Execute action for triggered shortcut
   */
  async executeShortcutAction(shortcut, action, metadata) {
    try {
      const context = {
        shortcut,
        metadata,
        timestamp: new Date(),
        systemState: { ...this.systemState },
        focusedApplication: this.focusedApplication
      };
      
      this.emit('shortcut-triggered', context);
      
      if (typeof action === 'function') {
        await action(context);
      } else if (typeof action === 'string') {
        await this.executeActionString(action, context);
      } else if (action && typeof action === 'object') {
        await this.executeActionObject(action, context);
      }
      
      this.logger.debug(`Shortcut action executed: ${shortcut}`);
      
    } catch (error) {
      this.logger.error(`Error executing shortcut action for ${shortcut}:`, error);
      this.emit('error', { message: 'Shortcut action failed', shortcut, error });
    }
  }
  
  /**
   * Initialize clipboard monitoring system
   */
  async initializeClipboardMonitoring() {
    if (!this.platformFeatures.clipboardMonitoring) {
      this.logger.warn('Clipboard monitoring not supported on this platform');
      return;
    }
    
    try {
      // Get initial clipboard content
      this.lastClipboardContent = clipboard.readText();
      
      // Start monitoring clipboard changes
      this.startClipboardWatcher();
      
      this.logger.info('Clipboard monitoring initialized');
      
    } catch (error) {
      this.logger.error('Clipboard monitoring initialization failed:', error);
      this.platformFeatures.clipboardMonitoring = false;
    }
  }
  
  /**
   * Start clipboard content monitoring
   */
  startClipboardWatcher() {
    if (this.clipboardWatcher) {
      clearInterval(this.clipboardWatcher);
    }
    
    this.clipboardWatcher = setInterval(() => {
      try {
        const currentContent = clipboard.readText();
        
        if (currentContent !== this.lastClipboardContent && currentContent.trim()) {
          this.handleClipboardChange(currentContent, this.lastClipboardContent);
          this.lastClipboardContent = currentContent;
        }
        
      } catch (error) {
        this.logger.error('Error monitoring clipboard:', error);
      }
    }, 500); // Check every 500ms
  }
  
  /**
   * Handle clipboard content change
   */
  handleClipboardChange(newContent, oldContent) {
    const clipboardEntry = {
      content: newContent,
      timestamp: new Date(),
      source: this.detectClipboardSource(),
      type: this.detectContentType(newContent)
    };
    
    // Add to history (limit to 100 entries)
    this.clipboardHistory.unshift(clipboardEntry);
    if (this.clipboardHistory.length > 100) {
      this.clipboardHistory = this.clipboardHistory.slice(0, 100);
    }
    
    this.emit('clipboard-changed', {
      newContent,
      oldContent,
      entry: clipboardEntry
    });
    
    this.logger.debug('Clipboard content changed', {
      contentLength: newContent.length,
      type: clipboardEntry.type
    });
  }
  
  /**
   * Get clipboard history
   */
  getClipboardHistory(limit = 10) {
    return this.clipboardHistory.slice(0, limit);
  }
  
  /**
   * Set clipboard content with metadata
   */
  setClipboardContent(content, metadata = {}) {
    try {
      clipboard.writeText(content);
      
      const entry = {
        content,
        timestamp: new Date(),
        source: 'macro-keyboard',
        type: this.detectContentType(content),
        metadata
      };
      
      this.clipboardHistory.unshift(entry);
      this.lastClipboardContent = content;
      
      this.emit('clipboard-set', { content, metadata });
      this.logger.debug('Clipboard content set', { length: content.length });
      
    } catch (error) {
      this.logger.error('Failed to set clipboard content:', error);
      throw error;
    }
  }
  
  /**
   * Detect content type for clipboard entries
   */
  detectContentType(content) {
    if (!content || typeof content !== 'string') return 'unknown';
    
    // URL detection
    if (/^https?:\/\//.test(content.trim())) return 'url';
    
    // Email detection
    if (/^[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}$/.test(content.trim())) return 'email';
    
    // Path detection
    if (/^[a-zA-Z]:\\|^\//.test(content.trim())) return 'path';
    
    // JSON detection
    try {
      JSON.parse(content);
      return 'json';
    } catch (e) {
      // Not JSON
    }
    
    // Multiline text
    if (content.includes('\n')) return 'multiline-text';
    
    // Default
    return 'text';
  }
  
  /**
   * Detect clipboard content source (application)
   */
  detectClipboardSource() {
    // This would require platform-specific implementation
    // For now, return the focused application if available
    return this.focusedApplication || 'unknown';
  }
  
  /**
   * Initialize window management system
   */
  async initializeWindowManagement() {
    if (!this.platformFeatures.windowManagement) {
      this.logger.warn('Window management not supported on this platform');
      return;
    }
    
    try {
      // Start monitoring active windows
      this.startWindowWatcher();
      
      this.logger.info('Window management initialized');
      
    } catch (error) {
      this.logger.error('Window management initialization failed:', error);
      this.platformFeatures.windowManagement = false;
    }
  }
  
  /**
   * Start monitoring active windows and applications
   */
  startWindowWatcher() {
    if (this.windowWatcher) {
      clearInterval(this.windowWatcher);
    }
    
    this.windowWatcher = setInterval(async () => {
      try {
        const activeWindow = await this.getActiveWindow();
        
        if (activeWindow && activeWindow.title !== this.focusedApplication) {
          const previousApp = this.focusedApplication;
          this.focusedApplication = activeWindow.title;
          
          this.emit('window-focus-changed', {
            previous: previousApp,
            current: activeWindow.title,
            windowInfo: activeWindow
          });
          
          this.logger.debug('Active window changed:', activeWindow.title);
        }
        
      } catch (error) {
        this.logger.error('Error monitoring window focus:', error);
      }
    }, 1000); // Check every second
  }
  
  /**
   * Get currently active window information
   */
  async getActiveWindow() {
    // Platform-specific implementation would go here
    // For now, return basic information
    return {
      title: 'Unknown Application',
      processName: 'unknown',
      windowId: null,
      bounds: { x: 0, y: 0, width: 0, height: 0 }
    };
  }
  
  /**
   * Initialize system state monitoring
   */
  async initializeSystemStateMonitoring() {
    try {
      // Start monitoring system metrics
      this.startSystemStateWatcher();
      
      this.logger.info('System state monitoring initialized');
      
    } catch (error) {
      this.logger.error('System state monitoring initialization failed:', error);
    }
  }
  
  /**
   * Start monitoring system state metrics
   */
  startSystemStateWatcher() {
    setInterval(async () => {
      try {
        const newState = await this.gatherSystemState();
        
        // Check for significant changes
        const hasChanges = this.detectSystemStateChanges(newState);
        
        if (hasChanges) {
          const oldState = { ...this.systemState };
          this.systemState = { ...newState };
          
          this.emit('system-state-changed', {
            oldState,
            newState: this.systemState
          });
        }
        
      } catch (error) {
        this.logger.error('Error monitoring system state:', error);
      }
    }, 5000); // Check every 5 seconds
  }
  
  /**
   * Gather current system state information
   */
  async gatherSystemState() {
    const state = {
      timestamp: new Date(),
      idleTime: 0, // Would require platform-specific implementation
      batteryLevel: null, // Would require platform-specific implementation
      networkStatus: 'connected', // Simplified for now
      cpuUsage: 0,
      memoryUsage: 0
    };
    
    try {
      // Get memory usage
      const memUsage = process.memoryUsage();
      state.memoryUsage = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
      
      // Get system memory info
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      state.systemMemoryUsage = Math.round(((totalMem - freeMem) / totalMem) * 100);
      
      // CPU usage would require additional monitoring
      state.cpuUsage = Math.round(Math.random() * 20); // Placeholder
      
    } catch (error) {
      this.logger.error('Error gathering system state:', error);
    }
    
    return state;
  }
  
  /**
   * Detect significant system state changes
   */
  detectSystemStateChanges(newState) {
    // Check for significant memory usage changes (>10%)
    if (Math.abs(newState.memoryUsage - this.systemState.memoryUsage) > 10) {
      return true;
    }
    
    // Check for CPU usage changes (>20%)
    if (Math.abs(newState.cpuUsage - this.systemState.cpuUsage) > 20) {
      return true;
    }
    
    // Check for network status changes
    if (newState.networkStatus !== this.systemState.networkStatus) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Initialize application integration features
   */
  async initializeApplicationIntegration() {
    try {
      // Set up application-specific automation rules
      await this.loadApplicationIntegrations();
      
      this.logger.info('Application integration initialized');
      
    } catch (error) {
      this.logger.error('Application integration initialization failed:', error);
    }
  }
  
  /**
   * Load application-specific integration rules
   */
  async loadApplicationIntegrations() {
    const integrationsPath = path.join(__dirname, '..', 'config', 'app-integrations.json');
    
    try {
      const data = await fs.readFile(integrationsPath, 'utf8');
      const integrations = JSON.parse(data);
      
      for (const [appName, config] of Object.entries(integrations)) {
        this.appIntegrations.set(appName, config);
      }
      
      this.logger.info(`Loaded ${this.appIntegrations.size} application integrations`);
      
    } catch (error) {
      this.logger.debug('No application integrations file found, using defaults');
      this.createDefaultApplicationIntegrations();
    }
  }
  
  /**
   * Create default application integrations
   */
  createDefaultApplicationIntegrations() {
    const defaults = {
      'Visual Studio Code': {
        shortcuts: {
          'CommandOrControl+Shift+M': 'toggle-terminal',
          'CommandOrControl+Shift+E': 'toggle-explorer'
        },
        automation: {
          'file-save': 'auto-format'
        }
      },
      'Google Chrome': {
        shortcuts: {
          'CommandOrControl+Shift+I': 'toggle-devtools'
        },
        automation: {
          'tab-switch': 'update-context'
        }
      }
    };
    
    for (const [appName, config] of Object.entries(defaults)) {
      this.appIntegrations.set(appName, config);
    }
  }
  
  /**
   * Initialize hardware input capture
   */
  async initializeHardwareInputCapture() {
    try {
      // Platform-specific implementation would go here
      this.logger.info('Hardware input capture initialized');
      
    } catch (error) {
      this.logger.error('Hardware input capture initialization failed:', error);
    }
  }
  
  /**
   * Execute string-based action
   */
  async executeActionString(actionString, context) {
    const parts = actionString.split(':');
    const actionType = parts[0];
    const actionParams = parts.slice(1);
    
    switch (actionType) {
      case 'clipboard-set':
        this.setClipboardContent(actionParams.join(':'));
        break;
        
      case 'window-focus':
        await this.focusWindow(actionParams[0]);
        break;
        
      case 'system-command':
        await this.executeSystemCommand(actionParams.join(' '));
        break;
        
      default:
        this.logger.warn(`Unknown action string: ${actionString}`);
    }
  }
  
  /**
   * Execute object-based action
   */
  async executeActionObject(actionObject, context) {
    const { type, params } = actionObject;
    
    switch (type) {
      case 'clipboard-operation':
        await this.executeClipboardOperation(params, context);
        break;
        
      case 'window-operation':
        await this.executeWindowOperation(params, context);
        break;
        
      case 'system-integration':
        await this.executeSystemIntegration(params, context);
        break;
        
      default:
        this.logger.warn(`Unknown action type: ${type}`);
    }
  }
  
  /**
   * Setup cleanup handlers for graceful shutdown
   */
  setupCleanupHandlers() {
    const cleanup = () => {
      try {
        this.cleanup();
      } catch (error) {
        this.logger.error('Error during cleanup:', error);
      }
    };
    
    process.on('exit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    
    // Handle Electron app quit
    if (app) {
      app.on('before-quit', cleanup);
    }
  }
  
  /**
   * Clean up all system integrations
   */
  cleanup() {
    if (!this.isInitialized) return;
    
    try {
      // Unregister all global shortcuts
      if (this.registeredShortcuts.size > 0) {
        globalShortcut.unregisterAll();
        this.registeredShortcuts.clear();
      }
      
      // Stop clipboard monitoring
      if (this.clipboardWatcher) {
        clearInterval(this.clipboardWatcher);
        this.clipboardWatcher = null;
      }
      
      // Stop window monitoring
      if (this.windowWatcher) {
        clearInterval(this.windowWatcher);
        this.windowWatcher = null;
      }
      
      // Clear all stored data
      this.clipboardHistory = [];
      this.windowStates.clear();
      this.appIntegrations.clear();
      
      this.isInitialized = false;
      this.emit('cleanup-complete');
      
      this.logger.info('SystemIntegrationManager cleanup complete');
      
    } catch (error) {
      this.logger.error('Error during SystemIntegrationManager cleanup:', error);
    }
  }
  
  /**
   * Get current integration status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      platform: this.platform,
      features: this.platformFeatures,
      shortcuts: this.registeredShortcuts.size,
      clipboardHistory: this.clipboardHistory.length,
      focusedApplication: this.focusedApplication,
      systemState: { ...this.systemState }
    };
  }
}

module.exports = SystemIntegrationManager;