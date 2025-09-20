const { app, BrowserWindow, Menu, Tray, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const winston = require('winston');
const ActionExecutor = require('./ActionExecutor');
const { ErrorHandler, ErrorTypes } = require('./ErrorHandler');
const { SerialConnectionManager } = require('./SerialConnectionManager');
const { ConfigValidator } = require('./ConfigValidator');
const ProfileManager = require('./ProfileManager');
const UpdateManager = require('./UpdateManager');
const LogManager = require('./LogManager');
const PerformanceMonitor = require('./PerformanceMonitor');
const PluginManager = require('./PluginManager');
const MacroRecorder = require('./MacroRecorder');

class MacroKeyboardApp {
  constructor() {
    this.mainWindow = null;
    this.tray = null;
    this.config = {};
    this.logger = null; // Will be initialized first
    this.logManager = null; // New structured logging manager
    this.errorHandler = null; // Will be initialized after logger
    this.configValidator = null; // Will be initialized after logger
    this.profileManager = null; // Will be initialized after configValidator
    this.actionExecutor = null; // Will be initialized after error handler
    this.serialManager = null; // New serial connection manager
    this.updateManager = null; // Will be initialized after logger
    this.performanceMonitor = null; // Will be initialized after logManager
    this.pluginManager = null; // Will be initialized after errorHandler
    this.macroRecorder = null; // Will be initialized after actionExecutor
    this.serialPort = null; // Deprecated - will be removed
    this.isDev = process.argv.includes('--dev');
    
    // Error boundary state
    this.isShuttingDown = false;
    this.initializationErrors = [];
  }

  /**
   * Initialize logger with error handling
   */
  initLogger() {
    try {
      return winston.createLogger({
        level: this.isDev ? 'debug' : 'info',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.printf(({ timestamp, level, message, stack }) => {
            const logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;
            return stack ? `${logMessage}\n${stack}` : logMessage;
          })
        ),
        transports: [
          new winston.transports.File({ 
            filename: 'logs/macro-keyboard.log',
            maxsize: 5242880, // 5MB
            maxFiles: 5
          }),
          new winston.transports.Console({
            format: winston.format.simple()
          })
        ],
        exceptionHandlers: [
          new winston.transports.File({ filename: 'logs/exceptions.log' })
        ],
        rejectionHandlers: [
          new winston.transports.File({ filename: 'logs/rejections.log' })
        ]
      });
    } catch (error) {
      // Fallback to console logging
      console.error('Failed to initialize Winston logger:', error);
      return {
        info: console.log.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console),
        debug: console.debug.bind(console)
      };
    }
  }

  /**
   * Initialize the application with comprehensive error handling
   */
  async init() {
    try {
      await app.whenReady();
      
      // Initialize core systems with error boundaries
      await this.initializeCore();
      
    } catch (error) {
      console.error('Critical initialization error:', error);
      
      if (this.errorHandler) {
        const criticalError = this.errorHandler.createError(
          ErrorTypes.SYSTEM.INITIALIZATION_FAILED,
          'Failed to initialize Macro Keyboard application',
          error
        );
        await this.errorHandler.handleError(criticalError, 'Application');
      }
      
      // Attempt graceful shutdown
      this.gracefulShutdown(1);
    }
  }

  /**
   * Initialize core systems with error boundaries
   */
  async initializeCore() {
    // Ensure logs directory exists
    await this.ensureLogsDirectory();
    
    // Initialize LogManager first
    this.logManager = new LogManager(this.config?.logging || {});
    this.logger = this.logManager.getLogger(); // Get Winston logger instance for backward compatibility
    this.logger.info('Macro Keyboard application starting...');
    
    // Initialize performance monitor
    this.performanceMonitor = new PerformanceMonitor(this.config?.performance || {}, this.logManager);
    
    // Initialize error handler
    this.errorHandler = new ErrorHandler(this.logger);
    this.setupErrorHandlerListeners();
    
    // Initialize configuration validator
    this.configValidator = new ConfigValidator(this.logger);
    
    // Initialize profile manager
    this.profileManager = new ProfileManager(this.logger, this.configValidator, this.errorHandler);
    await this.profileManager.initializeProfilesDirectory();
    
    // Load configuration with error handling
    await this.safeLoadConfig();
    
    // Initialize action executor with configuration and error handler
    this.actionExecutor = new ActionExecutor(this.config, this.logger);
    
    // Initialize macro recorder after action executor
    this.macroRecorder = new MacroRecorder(this.logger, this.actionExecutor);
    this.actionExecutor.setMacroRecorder(this.macroRecorder);
    
    // Initialize plugin manager with configuration and error handler
    this.pluginManager = new PluginManager(
      this.config?.plugins || {},
      this.logger,
      this.errorHandler,
      this.actionExecutor
    );
    await this.pluginManager.initialize();
    
    // Initialize update manager with configuration
    this.updateManager = new UpdateManager(this.logger, this.config.updates);
    this.setupUpdateManagerListeners();
    
    // Create UI components with error handling
    await this.safeCreateWindow();
    await this.safeCreateTray();
    
    // Set up IPC with error handling
    await this.safeSetupIPC();
    
    // Initialize serial communication with new manager
    await this.safeInitSerial();
    
    // Start update checking if enabled
    if (this.updateManager.isUpdateSupported()) {
      this.updateManager.startUpdateChecking();
    }
    
    this.logger.info('Application initialization complete');
  }

  /**
   * Ensure logs directory exists with error handling
   */
  async ensureLogsDirectory() {
    try {
      const logsDir = path.join(__dirname, '..', 'logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create logs directory:', error);
      // Continue without logging to file
    }
  }

  /**
   * Set up error handler event listeners
   */
  setupErrorHandlerListeners() {
    this.errorHandler.on('userNotification', (notification) => {
      // Send to renderer for user display
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('error-notification', notification);
      }
      
      // Also log for debugging
      this.logger.warn('User notification:', notification);
    });
    
    this.errorHandler.on('recovery', ({ error, component, attempts }) => {
      this.logger.info(`Recovery successful for ${component}:${error.type} after ${attempts} attempts`);
      
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('error-recovered', { error: error.type, component });
      }
    });
    
    this.errorHandler.on('reconnectFailed', () => {
      this.logger.error('All reconnection attempts failed');
      
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('device-connection-failed');
      }
    });
  }

  /**
   * Set up update manager event listeners
   */
  setupUpdateManagerListeners() {
    this.updateManager.on('update-available', (updateInfo) => {
      this.logger.info('Update available:', updateInfo);
      
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('update-available', updateInfo);
      }
    });

    this.updateManager.on('update-not-available', () => {
      this.logger.info('No updates available');
      
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('update-not-available');
      }
    });

    this.updateManager.on('download-progress', (progress) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('update-download-progress', progress);
      }
    });

    this.updateManager.on('update-downloaded', (updateInfo) => {
      this.logger.info('Update downloaded:', updateInfo);
      
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('update-downloaded', updateInfo);
      }
    });

    this.updateManager.on('error', (error) => {
      this.logger.error('Update manager error:', error);
      
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('update-error', error.message);
      }
    });
  }

  /**
   * Load configuration with validation, migration, and error handling
   */
  async safeLoadConfig() {
    const configPath = path.join(__dirname, '..', 'config', 'default.yaml');
    
    try {
      let rawConfig = null;
      
      if (fs.existsSync(configPath)) {
        const configFile = fs.readFileSync(configPath, 'utf8');
        rawConfig = yaml.load(configFile);
        this.logger.info('Configuration file loaded');
      } else {
        this.logger.info('Configuration file not found, using default configuration');
        rawConfig = this.getDefaultConfig();
      }
      
      // Validate and potentially migrate configuration
      const validationResult = this.configValidator.validateConfig(rawConfig);
      
      if (!validationResult.valid) {
        const configError = this.errorHandler.createError(
          ErrorTypes.CONFIGURATION.CONFIG_VALIDATION_ERROR,
          `Configuration validation failed: ${validationResult.errors.join('; ')}`,
          null,
          { configPath, errors: validationResult.errors }
        );
        
        await this.errorHandler.handleError(configError, 'Configuration');
        
        // Fall back to default configuration
        this.config = this.getDefaultConfig();
        this.logger.warn('Using default configuration due to validation errors');
        return;
      }
      
      // Use validated/migrated configuration
      this.config = validationResult.migratedConfig;
      
      // Log any warnings (like migrations)
      if (validationResult.warnings.length > 0) {
        validationResult.warnings.forEach(warning => {
          this.logger.warn('Configuration warning:', warning);
        });
        
        // Save migrated configuration back to file
        const saveSuccess = await this.configValidator.saveConfig(this.config, configPath);
        if (saveSuccess) {
          this.logger.info('Migrated configuration saved');
        } else {
          this.logger.warn('Failed to save migrated configuration');
        }
      }
      
      this.logger.info('Configuration loaded and validated successfully');
      
      // Reconfigure LogManager with loaded configuration
      if (this.config.logging) {
        this.logManager.updateConfiguration(this.config.logging);
        this.logger.info('LogManager reconfigured with loaded settings');
      }
      
    } catch (error) {
      const configError = this.errorHandler.createError(
        ErrorTypes.CONFIGURATION.CONFIG_PARSE_ERROR,
        'Failed to load or parse configuration file',
        error,
        { configPath }
      );
      
      await this.errorHandler.handleError(configError, 'Configuration');
      
      // Fall back to default configuration
      this.config = this.getDefaultConfig();
      this.logger.warn('Using default configuration due to load/parse error');
    }
  }

  /**
   * Save configuration with validation and error handling
   */
  async safeSaveConfig() {
    const configPath = path.join(__dirname, '..', 'config', 'default.yaml');
    
    try {
      // Validate configuration before saving
      const validationResult = this.configValidator.validateConfig(this.config);
      
      if (!validationResult.valid) {
        const saveError = this.errorHandler.createError(
          ErrorTypes.CONFIGURATION.CONFIG_VALIDATION_ERROR,
          `Cannot save invalid configuration: ${validationResult.errors.join('; ')}`,
          null,
          { configPath, errors: validationResult.errors }
        );
        
        await this.errorHandler.handleError(saveError, 'Configuration');
        return false;
      }
      
      // Use validator's save method which includes backup creation
      const success = await this.configValidator.saveConfig(validationResult.migratedConfig, configPath);
      
      if (success) {
        this.logger.info('Configuration saved successfully');
        return true;
      } else {
        const saveError = this.errorHandler.createError(
          ErrorTypes.CONFIGURATION.CONFIG_SAVE_FAILED,
          'ConfigValidator failed to save configuration',
          null,
          { configPath }
        );
        
        await this.errorHandler.handleError(saveError, 'Configuration');
        return false;
      }
      
    } catch (error) {
      const saveError = this.errorHandler.createError(
        ErrorTypes.CONFIGURATION.CONFIG_SAVE_FAILED,
        'Failed to save configuration file',
        error,
        { configPath }
      );
      
      await this.errorHandler.handleError(saveError, 'Configuration');
      return false;
    }
  }

  getDefaultConfig() {
    return {
      version: '1.0.0',
      device: {
        serialPort: null,
        baudRate: 9600,
        buttons: 8,
        encoders: 0,
        connectionTimeout: 5000
      },
      buttons: {},
      encoders: {},
      logging: {
        level: 'info',
        file: 'logs/macro-keyboard.log',
        maxSize: 5242880,
        maxFiles: 5
      },
      security: {
        commandExecution: {
          enabled: true,
          mode: 'blacklist',
          allowedCommands: [],
          timeout: 10000,
          maxLength: 1000
        }
      },
      profiles: {
        active: 'default',
        available: ['default']
      }
    };
  }

  /**
   * Create window with error handling
   */
  async safeCreateWindow() {
    try {
      this.createWindow();
    } catch (error) {
      const windowError = this.errorHandler.createError(
        ErrorTypes.SYSTEM.INITIALIZATION_FAILED,
        'Failed to create main window',
        error
      );
      
      await this.errorHandler.handleError(windowError, 'Window');
      // Continue without GUI on failure
    }
  }

  /**
   * Create system tray with error handling
   */
  async safeCreateTray() {
    try {
      // Platform-specific tray creation
      if (process.platform === 'darwin') {
        this.createMacTray();
      } else if (process.platform === 'win32') {
        this.createWindowsTray();
      } else {
        // Linux - headless mode only
        this.logger.info('Running in headless mode (Linux)');
        if (this.mainWindow) {
          this.mainWindow.hide();
        }
      }
    } catch (error) {
      const trayError = this.errorHandler.createError(
        ErrorTypes.SYSTEM.INITIALIZATION_FAILED,
        'Failed to create system tray',
        error
      );
      
      await this.errorHandler.handleError(trayError, 'Tray');
      // Continue without tray on failure
    }
  }

  /**
   * Set up IPC with error handling
   */
  async safeSetupIPC() {
    try {
      this.setupIPC();
    } catch (error) {
      const ipcError = this.errorHandler.createError(
        ErrorTypes.SYSTEM.IPC_ERROR,
        'Failed to set up IPC communication',
        error
      );
      
      await this.errorHandler.handleError(ipcError, 'IPC');
    }
  }

  /**
   * Initialize serial communication with new manager and error handling
   */
  async safeInitSerial() {
    try {
      // Create serial connection manager
      this.serialManager = new SerialConnectionManager(this.config, this.logger, this.errorHandler);
      
      // Set up serial manager event listeners
      this.setupSerialManagerListeners();
      
      // Initialize the manager
      await this.serialManager.initialize();
      
      this.logger.info('Serial communication manager initialized');
    } catch (error) {
      const serialError = this.errorHandler.createError(
        ErrorTypes.HARDWARE.SERIAL_CONNECTION_FAILED,
        'Failed to initialize serial communication',
        error
      );
      
      await this.errorHandler.handleError(serialError, 'Serial');
      // Continue in offline mode
    }
  }

  /**
   * Set up serial manager event listeners
   */
  setupSerialManagerListeners() {
    this.serialManager.on('connected', (port) => {
      this.logger.info(`Connected to macro keyboard on ${port}`);
      
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('device-connected', port);
      }
    });
    
    this.serialManager.on('disconnected', () => {
      this.logger.warn('Macro keyboard disconnected');
      
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('device-disconnected');
      }
    });
    
    this.serialManager.on('message', (data) => {
      this.handleSerialData(data);
    });
    
    this.serialManager.on('stateChange', (newState, oldState) => {
      this.logger.debug(`Serial state changed: ${oldState} -> ${newState}`);
      
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('serial-state-change', { newState, oldState });
      }
    });
    
    this.serialManager.on('offlineMode', (enabled) => {
      this.logger.info(`Offline mode ${enabled ? 'enabled' : 'disabled'}`);
      
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('offline-mode', enabled);
      }
    });
  }

  createWindow() {
    // Don't create window on Linux
    if (process.platform === 'linux') return;

    this.mainWindow = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      icon: path.join(__dirname, 'assets', 'icon.png'),
      show: false
    });

    this.mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

    if (this.isDev) {
      this.mainWindow.webContents.openDevTools();
      this.mainWindow.show();
    }

    this.mainWindow.on('close', (event) => {
      if (!app.isQuiting) {
        event.preventDefault();
        this.mainWindow.hide();
      }
    });
  }

  createMacTray() {
    // Use template image for macOS system tray (16x16 or 32x32)
    const trayIconPath = path.join(__dirname, 'assets', 'tray-32x32.png');
    this.tray = new Tray(trayIconPath);
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show Macro Keyboard',
        click: () => {
          if (this.mainWindow) {
            this.mainWindow.show();
          }
        }
      },
      {
        label: 'Reload Config',
        click: () => this.reloadConfig()
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          app.isQuiting = true;
          app.quit();
        }
      }
    ]);
    
    this.tray.setContextMenu(contextMenu);
    this.tray.setToolTip('Macro Keyboard');
  }

  createWindowsTray() {
    // Use ICO file for Windows system tray
    const trayIconPath = path.join(__dirname, 'assets', 'tray-32x32.png');
    this.tray = new Tray(trayIconPath);
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show Macro Keyboard',
        click: () => {
          if (this.mainWindow) {
            this.mainWindow.show();
          }
        }
      },
      {
        label: 'Reload Config',
        click: () => this.reloadConfig()
      },
      { type: 'separator' },
      {
        label: 'Exit',
        click: () => {
          app.isQuiting = true;
          app.quit();
        }
      }
    ]);
    
    this.tray.setContextMenu(contextMenu);
    this.tray.setToolTip('Macro Keyboard');
  }

  setupIPC() {
    ipcMain.handle('get-config', () => {
      return this.config;
    });

    ipcMain.handle('save-config', async (event, newConfig) => {
      try {
        // Validate configuration before saving
        const validationResult = this.configValidator.validateConfig(newConfig);
        
        if (!validationResult.valid) {
          return {
            success: false,
            errors: validationResult.errors,
            warnings: validationResult.warnings
          };
        }
        
        this.config = validationResult.migratedConfig;
        const success = await this.safeSaveConfig();
        
        return {
          success,
          errors: success ? [] : ['Failed to save configuration'],
          warnings: validationResult.warnings
        };
      } catch (error) {
        this.logger.error('Error saving config via IPC:', error);
        return {
          success: false,
          errors: [error.message],
          warnings: []
        };
      }
    });

    ipcMain.handle('validate-config', async (event, configToValidate) => {
      try {
        const validationResult = this.configValidator.validateConfig(configToValidate);
        return validationResult;
      } catch (error) {
        this.logger.error('Error validating config via IPC:', error);
        return {
          valid: false,
          errors: [error.message],
          warnings: [],
          migratedConfig: null
        };
      }
    });

    ipcMain.handle('get-config-schema', () => {
      try {
        return {
          success: true,
          schema: this.configValidator.schema,
          version: this.configValidator.getCurrentVersion(),
          stats: this.configValidator.getStats()
        };
      } catch (error) {
        this.logger.error('Error getting config schema via IPC:', error);
        return {
          success: false,
          error: error.message
        };
      }
    });

    ipcMain.handle('reload-config', async () => {
      await this.loadConfig();
      return this.config;
    });

    ipcMain.handle('get-serial-ports', async () => {
      try {
        const { SerialPort } = require('serialport');
        const ports = await SerialPort.list();
        return ports;
      } catch (error) {
        this.logger.error('Error listing serial ports:', error);
        return [];
      }
    });

    ipcMain.handle('log-error', async (event, message) => {
      this.logger.error(message);
      return true;
    });

    // Hardware configuration IPC handlers
    ipcMain.handle('send-arduino-command', async (event, command) => {
      return this.sendArduinoCommand(command);
    });

    ipcMain.handle('configure-arduino-buttons', async (event, count) => {
      return this.configureArduinoButtons(count);
    });

    ipcMain.handle('configure-arduino-encoders', async (event, count) => {
      return this.configureArduinoEncoders(count);
    });

    ipcMain.handle('get-arduino-config', async () => {
      return this.getArduinoConfig();
    });

    ipcMain.handle('reset-arduino', async () => {
      return this.resetArduino();
    });

    // Connection status handlers
    ipcMain.handle('get-connection-status', () => {
      if (!this.serialManager) {
        return { state: 'DISCONNECTED', port: null, isConnected: false };
      }
      return this.serialManager.getConnectionInfo();
    });

    ipcMain.handle('test-connection', async (event, options) => {
      return this.testSerialConnection(options);
    });

    // Profile Management IPC handlers
    ipcMain.handle('get-profiles', async () => {
      try {
        return this.profileManager.getAvailableProfiles();
      } catch (error) {
        this.logger.error('Error getting profiles:', error);
        throw error;
      }
    });

    ipcMain.handle('get-active-profile-name', async () => {
      try {
        return this.profileManager.getActiveProfileName();
      } catch (error) {
        this.logger.error('Error getting active profile name:', error);
        throw error;
      }
    });

    ipcMain.handle('activate-profile', async (event, profileName) => {
      try {
        const success = this.profileManager.setActiveProfile(profileName);
        if (success) {
          this.config = this.profileManager.getActiveProfileConfig();
          // Notify renderer of config change
          if (this.mainWindow) {
            this.mainWindow.webContents.send('config-reloaded', this.config);
          }
          return success;
        }
        throw new Error(`Failed to activate profile: ${profileName}`);
      } catch (error) {
        this.logger.error('Error activating profile:', error);
        throw error;
      }
    });

    ipcMain.handle('create-profile', async (event, profileName, baseConfig = null, description = '') => {
      try {
        return await this.profileManager.createProfile(profileName, baseConfig, description);
      } catch (error) {
        this.logger.error('Error creating profile:', error);
        throw error;
      }
    });

    ipcMain.handle('update-profile', async (event, profileName, newConfig, description = null) => {
      try {
        return await this.profileManager.updateProfile(profileName, newConfig, description);
      } catch (error) {
        this.logger.error('Error updating profile:', error);
        throw error;
      }
    });

    ipcMain.handle('delete-profile', async (event, profileName) => {
      try {
        return await this.profileManager.deleteProfile(profileName);
      } catch (error) {
        this.logger.error('Error deleting profile:', error);
        throw error;
      }
    });

    ipcMain.handle('duplicate-profile', async (event, sourceProfileName, newProfileName, description = '') => {
      try {
        return await this.profileManager.duplicateProfile(sourceProfileName, newProfileName, description);
      } catch (error) {
        this.logger.error('Error duplicating profile:', error);
        throw error;
      }
    });

    ipcMain.handle('export-profile', async (event, profileName, exportPath) => {
      try {
        return await this.profileManager.exportProfile(profileName, exportPath);
      } catch (error) {
        this.logger.error('Error exporting profile:', error);
        throw error;
      }
    });

    ipcMain.handle('import-profile', async (event, importPath, profileName = null, overwrite = false) => {
      try {
        return await this.profileManager.importProfile(importPath, profileName, overwrite);
      } catch (error) {
        this.logger.error('Error importing profile:', error);
        throw error;
      }
    });

    ipcMain.handle('get-profile-statistics', async () => {
      try {
        return this.profileManager.getProfileStatistics();
      } catch (error) {
        this.logger.error('Error getting profile statistics:', error);
        throw error;
      }
    });

    // File dialog handlers for profile import/export
    ipcMain.handle('show-save-dialog', async (event, options) => {
      const { dialog } = require('electron');
      try {
        return await dialog.showSaveDialog(this.mainWindow, options);
      } catch (error) {
        this.logger.error('Error showing save dialog:', error);
        throw error;
      }
    });

    ipcMain.handle('show-open-dialog', async (event, options) => {
      const { dialog } = require('electron');
      try {
        return await dialog.showOpenDialog(this.mainWindow, options);
      } catch (error) {
        this.logger.error('Error showing open dialog:', error);
        throw error;
      }
    });

    // Update management IPC handlers
    ipcMain.handle('check-for-updates', async () => {
      try {
        await this.updateManager.checkForUpdates();
        return { success: true };
      } catch (error) {
        this.logger.error('Error checking for updates:', error);
        throw error;
      }
    });

    ipcMain.handle('download-update', async () => {
      try {
        this.updateManager.downloadAndInstallUpdate();
        return { success: true };
      } catch (error) {
        this.logger.error('Error downloading update:', error);
        throw error;
      }
    });

    ipcMain.handle('install-update', async () => {
      try {
        this.updateManager.quitAndInstall();
        return { success: true };
      } catch (error) {
        this.logger.error('Error installing update:', error);
        throw error;
      }
    });

    ipcMain.handle('get-update-status', () => {
      try {
        return this.updateManager.getUpdateStatus();
      } catch (error) {
        this.logger.error('Error getting update status:', error);
        throw error;
      }
    });

    ipcMain.handle('set-auto-update-enabled', async (event, enabled) => {
      try {
        this.updateManager.setAutoUpdateEnabled(enabled);
        return { success: true };
      } catch (error) {
        this.logger.error('Error setting auto-update:', error);
        throw error;
      }
    });

    ipcMain.handle('get-update-statistics', () => {
      try {
        return this.updateManager.getStatistics();
      } catch (error) {
        this.logger.error('Error getting update statistics:', error);
        throw error;
      }
    });

    // Log management handlers
    ipcMain.handle('get-recent-logs', async (event, limit = 100) => {
      try {
        return await this.logManager.getRecentLogs(limit);
      } catch (error) {
        this.logger.error('Error getting recent logs:', error);
        throw error;
      }
    });

    ipcMain.handle('get-log-statistics', () => {
      try {
        return this.logManager.getStatistics();
      } catch (error) {
        this.logger.error('Error getting log statistics:', error);
        throw error;
      }
    });

    ipcMain.handle('export-logs', async (event, startDate = null, endDate = null, format = 'json') => {
      try {
        return await this.logManager.exportLogs(startDate, endDate, format);
      } catch (error) {
        this.logger.error('Error exporting logs:', error);
        throw error;
      }
    });

    ipcMain.handle('clear-logs', async () => {
      try {
        return await this.logManager.clearLogs();
      } catch (error) {
        this.logger.error('Error clearing logs:', error);
        throw error;
      }
    });

    // Set up real-time log forwarding to renderer
    this.logManager.on('log-entry', (logData) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('log-entry', logData);
      }
    });

    // Performance monitoring IPC handlers
    ipcMain.handle('start-performance-monitoring', async (event, options = {}) => {
      try {
        this.performanceMonitor.startMonitoring(options);
        return { success: true };
      } catch (error) {
        this.logger.error('Error starting performance monitoring:', error);
        throw error;
      }
    });

    ipcMain.handle('stop-performance-monitoring', async () => {
      try {
        this.performanceMonitor.stopMonitoring();
        return { success: true };
      } catch (error) {
        this.logger.error('Error stopping performance monitoring:', error);
        throw error;
      }
    });

    ipcMain.handle('get-performance-metrics', async () => {
      try {
        return this.performanceMonitor.getMetrics();
      } catch (error) {
        this.logger.error('Error getting performance metrics:', error);
        throw error;
      }
    });

    ipcMain.handle('get-performance-history', async (event, metricType = 'all', limit = 100) => {
      try {
        return this.performanceMonitor.getHistory(metricType, limit);
      } catch (error) {
        this.logger.error('Error getting performance history:', error);
        throw error;
      }
    });

    ipcMain.handle('get-operation-performance', async () => {
      try {
        return this.performanceMonitor.getOperationPerformance();
      } catch (error) {
        this.logger.error('Error getting operation performance:', error);
        throw error;
      }
    });

    ipcMain.handle('get-optimization-suggestions', async () => {
      try {
        return this.performanceMonitor.getOptimizationSuggestions();
      } catch (error) {
        this.logger.error('Error getting optimization suggestions:', error);
        throw error;
      }
    });

    ipcMain.handle('export-performance-data', async (event, format = 'json', startDate = null, endDate = null) => {
      try {
        return await this.performanceMonitor.exportData(format, startDate, endDate);
      } catch (error) {
        this.logger.error('Error exporting performance data:', error);
        throw error;
      }
    });

    ipcMain.handle('clear-performance-data', async () => {
      try {
        this.performanceMonitor.clearData();
        return { success: true };
      } catch (error) {
        this.logger.error('Error clearing performance data:', error);
        throw error;
      }
    });

    // Set up real-time performance data forwarding to renderer
    this.performanceMonitor.on('metrics-updated', (metrics) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('performance-metrics', metrics);
      }
    });

    this.performanceMonitor.on('performance-alert', (alert) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('performance-alert', alert);
      }
    });

    this.performanceMonitor.on('optimization-suggestion', (suggestion) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('optimization-suggestion', suggestion);
      }
    });

    // Plugin Management IPC handlers
    ipcMain.handle('get-plugins', async () => {
      try {
        return this.pluginManager.getAllPlugins();
      } catch (error) {
        this.logger.error('Error getting plugins:', error);
        throw error;
      }
    });

    ipcMain.handle('get-plugin-details', async (event, pluginId) => {
      try {
        return this.pluginManager.getPluginDetails(pluginId);
      } catch (error) {
        this.logger.error('Error getting plugin details:', error);
        throw error;
      }
    });

    ipcMain.handle('enable-plugin', async (event, pluginId) => {
      try {
        const success = await this.pluginManager.enablePlugin(pluginId);
        return { success };
      } catch (error) {
        this.logger.error('Error enabling plugin:', error);
        throw error;
      }
    });

    ipcMain.handle('disable-plugin', async (event, pluginId) => {
      try {
        const success = await this.pluginManager.disablePlugin(pluginId);
        return { success };
      } catch (error) {
        this.logger.error('Error disabling plugin:', error);
        throw error;
      }
    });

    ipcMain.handle('reload-plugin', async (event, pluginId) => {
      try {
        const success = await this.pluginManager.reloadPlugin(pluginId);
        return { success };
      } catch (error) {
        this.logger.error('Error reloading plugin:', error);
        throw error;
      }
    });

    ipcMain.handle('uninstall-plugin', async (event, pluginId) => {
      try {
        const success = await this.pluginManager.uninstallPlugin(pluginId);
        return { success };
      } catch (error) {
        this.logger.error('Error uninstalling plugin:', error);
        throw error;
      }
    });

    ipcMain.handle('get-plugin-config', async (event, pluginId) => {
      try {
        return this.pluginManager.getPluginConfig(pluginId);
      } catch (error) {
        this.logger.error('Error getting plugin config:', error);
        throw error;
      }
    });

    ipcMain.handle('update-plugin-config', async (event, pluginId, config) => {
      try {
        const success = await this.pluginManager.updatePluginConfig(pluginId, config);
        return { success };
      } catch (error) {
        this.logger.error('Error updating plugin config:', error);
        throw error;
      }
    });

    ipcMain.handle('get-plugin-logs', async (event, pluginId, limit = 100) => {
      try {
        return await this.pluginManager.getPluginLogs(pluginId, limit);
      } catch (error) {
        this.logger.error('Error getting plugin logs:', error);
        throw error;
      }
    });

    ipcMain.handle('load-plugin-from-path', async (event, pluginPath) => {
      try {
        const plugin = await this.pluginManager.loadPluginFromPath(pluginPath);
        return plugin;
      } catch (error) {
        this.logger.error('Error loading plugin from path:', error);
        throw error;
      }
    });

    ipcMain.handle('create-plugin-template', async (event, options) => {
      try {
        return await this.pluginManager.createPluginTemplate(options);
      } catch (error) {
        this.logger.error('Error creating plugin template:', error);
        throw error;
      }
    });

    // Macro Recording IPC handlers
    ipcMain.handle('start-macro-recording', async (event, sequenceName) => {
      try {
        const recordingName = await this.macroRecorder.startRecording(sequenceName);
        return { success: true, recordingName };
      } catch (error) {
        this.logger.error('Error starting macro recording:', error);
        throw error;
      }
    });

    ipcMain.handle('stop-macro-recording', async () => {
      try {
        const sequenceData = await this.macroRecorder.stopRecording();
        return { success: true, sequence: sequenceData };
      } catch (error) {
        this.logger.error('Error stopping macro recording:', error);
        throw error;
      }
    });

    ipcMain.handle('cancel-macro-recording', async () => {
      try {
        this.macroRecorder.cancelRecording();
        return { success: true };
      } catch (error) {
        this.logger.error('Error cancelling macro recording:', error);
        throw error;
      }
    });

    ipcMain.handle('record-macro-action', async (event, actionConfig, description) => {
      try {
        const recordedAction = this.macroRecorder.recordAction(actionConfig, description);
        return { success: true, action: recordedAction };
      } catch (error) {
        this.logger.error('Error recording macro action:', error);
        throw error;
      }
    });

    ipcMain.handle('play-macro-sequence', async (event, sequenceName) => {
      try {
        const success = await this.macroRecorder.playSequence(sequenceName);
        return { success };
      } catch (error) {
        this.logger.error('Error playing macro sequence:', error);
        throw error;
      }
    });

    ipcMain.handle('stop-macro-playback', async () => {
      try {
        const success = this.macroRecorder.stopPlayback();
        return { success };
      } catch (error) {
        this.logger.error('Error stopping macro playback:', error);
        throw error;
      }
    });

    ipcMain.handle('get-saved-sequences', async () => {
      try {
        return this.macroRecorder.getSavedSequences();
      } catch (error) {
        this.logger.error('Error getting saved sequences:', error);
        throw error;
      }
    });

    ipcMain.handle('delete-macro-sequence', async (event, sequenceName) => {
      try {
        const success = this.macroRecorder.deleteSequence(sequenceName);
        return { success };
      } catch (error) {
        this.logger.error('Error deleting macro sequence:', error);
        throw error;
      }
    });

    ipcMain.handle('rename-macro-sequence', async (event, oldName, newName) => {
      try {
        const success = this.macroRecorder.renameSequence(oldName, newName);
        return { success };
      } catch (error) {
        this.logger.error('Error renaming macro sequence:', error);
        throw error;
      }
    });

    ipcMain.handle('duplicate-macro-sequence', async (event, sourceName, newName) => {
      try {
        const duplicatedData = this.macroRecorder.duplicateSequence(sourceName, newName);
        return { success: true, sequence: duplicatedData };
      } catch (error) {
        this.logger.error('Error duplicating macro sequence:', error);
        throw error;
      }
    });

    ipcMain.handle('get-macro-statistics', async () => {
      try {
        return this.macroRecorder.getStatistics();
      } catch (error) {
        this.logger.error('Error getting macro statistics:', error);
        throw error;
      }
    });

    // Set up real-time macro recording event forwarding to renderer
    this.macroRecorder.on('recordingStarted', (data) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('macro-recording-started', data);
      }
    });

    this.macroRecorder.on('actionRecorded', (action) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('macro-action-recorded', action);
      }
    });

    this.macroRecorder.on('recordingStopped', (sequenceData) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('macro-recording-stopped', sequenceData);
      }
    });

    this.macroRecorder.on('playbackStarted', (data) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('macro-playback-started', data);
      }
    });

    this.macroRecorder.on('playbackProgress', (progress) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('macro-playback-progress', progress);
      }
    });

    this.macroRecorder.on('playbackCompleted', (data) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('macro-playback-completed', data);
      }
    });

    this.macroRecorder.on('playbackStopped', (data) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('macro-playback-stopped', data);
      }
    });

    this.macroRecorder.on('playbackError', (error) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('macro-playback-error', error);
      }
    });

    // Set up real-time plugin event forwarding to renderer
    this.pluginManager.on('plugin-loaded', (pluginData) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('plugin-loaded', pluginData);
      }
    });

    this.pluginManager.on('plugin-enabled', (pluginData) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('plugin-enabled', pluginData);
      }
    });

    this.pluginManager.on('plugin-disabled', (pluginData) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('plugin-disabled', pluginData);
      }
    });

    this.pluginManager.on('plugin-error', (errorData) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('plugin-error', errorData);
      }
    });

    this.pluginManager.on('plugin-unloaded', (pluginData) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('plugin-unloaded', pluginData);
      }
    });
  }

  async initSerial() {
    if (this.config.device.serialPort) {
      try {
        const { SerialPort } = require('serialport');
        const { ReadlineParser } = require('@serialport/parser-readline');
        
        this.serialPort = new SerialPort({
          path: this.config.device.serialPort,
          baudRate: this.config.device.baudRate
        });

        const parser = this.serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));
        
        parser.on('data', (data) => {
          this.handleSerialData(data);
        });

        this.serialPort.on('open', () => {
          this.logger.info(`Serial port ${this.config.device.serialPort} opened`);
        });

        this.serialPort.on('error', (error) => {
          this.logger.error('Serial port error:', error);
        });

      } catch (error) {
        this.logger.error('Error initializing serial port:', error);
      }
    }
  }

  handleSerialData(data) {
    try {
      const command = data.toString().trim();
      this.logger.info(`Received command: ${command}`);
      
      // Parse button press (format: BTN:1 or ENC:1:CW)
      if (command.startsWith('BTN:')) {
        const buttonId = parseInt(command.split(':')[1]);
        this.executeButtonAction(buttonId);
      } else if (command.startsWith('ENC:')) {
        const parts = command.split(':');
        const encoderId = parseInt(parts[1]);
        const direction = parts[2];
        this.executeEncoderAction(encoderId, direction);
      }
    } catch (error) {
      this.logger.error('Error parsing serial data:', error);
    }
  }

  /**
   * Execute button action with comprehensive error handling
   */
  async executeButtonAction(buttonId) {
    try {
      // Send action start notification
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('action-started', { 
          type: 'button', 
          id: buttonId 
        });
      }

      const buttonConfig = this.config.buttons[`button${buttonId}`];
      
      if (!buttonConfig || !buttonConfig.action || !buttonConfig.type) {
        const configError = this.errorHandler.createError(
          ErrorTypes.CONFIGURATION.INVALID_BUTTON_CONFIG,
          `No valid action configured for button ${buttonId}`,
          null,
          { buttonId, buttonConfig }
        );
        
        await this.errorHandler.handleError(configError, 'ButtonAction');
        
        // Send failure notification
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('action-failed', { 
            type: 'button', 
            id: buttonId,
            error: 'No valid action configured',
            config: buttonConfig
          });
        }
        return false;
      }

      this.logger.info(`Executing action for button ${buttonId}: ${buttonConfig.action}`);
      
      if (!this.actionExecutor) {
        const systemError = this.errorHandler.createError(
          ErrorTypes.SYSTEM.RESOURCE_NOT_AVAILABLE,
          'Action executor not initialized',
          null,
          { buttonId }
        );
        
        await this.errorHandler.handleError(systemError, 'ButtonAction');
        
        // Send failure notification
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('action-failed', { 
            type: 'button', 
            id: buttonId,
            error: 'Action executor not initialized'
          });
        }
        return false;
      }

      const success = await this.actionExecutor.executeAction(buttonConfig, `button${buttonId}`);
      
      if (!success) {
        const actionError = this.errorHandler.createError(
          ErrorTypes.ACTION.ACTION_EXECUTION_FAILED,
          `Failed to execute action for button ${buttonId}`,
          null,
          { buttonId, buttonConfig }
        );
        
        await this.errorHandler.handleError(actionError, 'ButtonAction');
        
        // Send failure notification  
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('action-failed', { 
            type: 'button', 
            id: buttonId,
            error: 'Action execution failed',
            config: buttonConfig
          });
        }
      } else {
        // Send success notification
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('action-completed', { 
            type: 'button', 
            id: buttonId,
            config: buttonConfig
          });
        }
      }
      
      return success;
    } catch (error) {
      const unexpectedError = this.errorHandler.createError(
        ErrorTypes.ACTION.ACTION_EXECUTION_FAILED,
        `Unexpected error executing button ${buttonId} action`,
        error,
        { buttonId }
      );
      
      await this.errorHandler.handleError(unexpectedError, 'ButtonAction');
      
      // Send failure notification
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('action-failed', { 
          type: 'button', 
          id: buttonId,
          error: error.message || 'Unexpected error'
        });
      }
      return false;
    }
  }

  /**
   * Execute encoder action with comprehensive error handling
   */
  async executeEncoderAction(encoderId, direction) {
    try {
      // Send action start notification
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('action-started', { 
          type: 'encoder', 
          id: encoderId,
          direction: direction 
        });
      }

      const encoderConfig = this.config.encoders[`encoder${encoderId}`];
      
      if (!encoderConfig) {
        const configError = this.errorHandler.createError(
          ErrorTypes.CONFIGURATION.INVALID_ENCODER_CONFIG,
          `No configuration found for encoder ${encoderId}`,
          null,
          { encoderId, direction }
        );
        
        await this.errorHandler.handleError(configError, 'EncoderAction');
        
        // Send failure notification
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('action-failed', { 
            type: 'encoder', 
            id: encoderId,
            direction: direction,
            error: 'No encoder configuration found'
          });
        }
        return false;
      }
      
      const actionKey = direction === 'CW' ? 'actionCW' : 'actionCCW';
      const typeKey = direction === 'CW' ? 'typeCW' : 'typeCCW';
      const action = encoderConfig[actionKey];
      const type = encoderConfig[typeKey];
      
      if (!action || !type) {
        const configError = this.errorHandler.createError(
          ErrorTypes.CONFIGURATION.INVALID_ENCODER_CONFIG,
          `No ${direction} action configured for encoder ${encoderId}`,
          null,
          { encoderId, direction, encoderConfig }
        );
        
        await this.errorHandler.handleError(configError, 'EncoderAction');
        
        // Send failure notification
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('action-failed', { 
            type: 'encoder', 
            id: encoderId,
            direction: direction,
            error: `No ${direction} action configured`,
            config: encoderConfig
          });
        }
        return false;
      }
      
      this.logger.info(`Executing ${direction} action for encoder ${encoderId}: ${action}`);
      
      if (!this.actionExecutor) {
        const systemError = this.errorHandler.createError(
          ErrorTypes.SYSTEM.RESOURCE_NOT_AVAILABLE,
          'Action executor not initialized',
          null,
          { encoderId, direction }
        );
        
        await this.errorHandler.handleError(systemError, 'EncoderAction');
        
        // Send failure notification
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('action-failed', { 
            type: 'encoder', 
            id: encoderId,
            direction: direction,
            error: 'Action executor not initialized'
          });
        }
        return false;
      }

      const actionConfig = { type, action };
      const success = await this.actionExecutor.executeAction(actionConfig, `encoder${encoderId}:${direction}`);
      
      if (!success) {
        const actionError = this.errorHandler.createError(
          ErrorTypes.ACTION.ACTION_EXECUTION_FAILED,
          `Failed to execute ${direction} action for encoder ${encoderId}`,
          null,
          { encoderId, direction, actionConfig }
        );
        
        await this.errorHandler.handleError(actionError, 'EncoderAction');
        
        // Send failure notification  
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('action-failed', { 
            type: 'encoder', 
            id: encoderId,
            direction: direction,
            error: 'Action execution failed',
            config: actionConfig
          });
        }
      } else {
        // Send success notification
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('action-completed', { 
            type: 'encoder', 
            id: encoderId,
            direction: direction,
            config: actionConfig
          });
        }
      }
      
      return success;
    } catch (error) {
      const unexpectedError = this.errorHandler.createError(
        ErrorTypes.ACTION.ACTION_EXECUTION_FAILED,
        `Unexpected error executing encoder ${encoderId} ${direction} action`,
        error,
        { encoderId, direction }
      );
      
      await this.errorHandler.handleError(unexpectedError, 'EncoderAction');
      
      // Send failure notification
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('action-failed', { 
          type: 'encoder', 
          id: encoderId,
          direction: direction,
          error: error.message || 'Unexpected error'
        });
      }
      return false;
    }
  }

  /**
   * Reload configuration with error handling
   */
  async reloadConfig() {
    try {
      this.logger.info('Reloading configuration...');
      await this.safeLoadConfig();
      
      // Reinitialize serial connection with new configuration
      if (this.serialManager) {
        await this.serialManager.destroy();
        await this.safeInitSerial();
      }
      
      // Notify renderer if window exists
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('config-reloaded', this.config);
      }
      
      this.logger.info('Configuration reloaded successfully');
    } catch (error) {
      const reloadError = this.errorHandler.createError(
        ErrorTypes.CONFIGURATION.CONFIG_PARSE_ERROR,
        'Failed to reload configuration',
        error
      );
      
      await this.errorHandler.handleError(reloadError, 'Configuration');
    }
  }

  /**
   * Graceful shutdown with cleanup
   */
  async gracefulShutdown(exitCode = 0) {
    if (this.isShuttingDown) {
      this.logger.warn('Shutdown already in progress');
      return;
    }
    
    this.isShuttingDown = true;
    this.logger.info('Beginning graceful shutdown...');
    
    try {
      // Destroy serial connection manager
      if (this.serialManager) {
        await this.serialManager.destroy();
      }
      
      // Close old serial port if it exists
      if (this.serialPort && this.serialPort.isOpen) {
        await new Promise(resolve => this.serialPort.close(resolve));
      }
      
      // Clean up update manager
      if (this.updateManager) {
        this.updateManager.cleanup();
      }
      
      // Clean up error handler
      if (this.errorHandler) {
        this.errorHandler.clearHistory();
      }
      
      this.logger.info('Graceful shutdown complete');
    } catch (error) {
      this.logger.error('Error during shutdown:', error);
    } finally {
      process.exit(exitCode);
    }
  }

  // Arduino hardware configuration methods
  async sendArduinoCommand(command) {
    return new Promise((resolve, reject) => {
      if (!this.serialPort || !this.serialPort.isOpen) {
        reject(new Error('Serial port not connected'));
        return;
      }

      // Set up a timeout
      const timeout = setTimeout(() => {
        reject(new Error('Arduino command timeout'));
      }, 5000);

      let responseBuffer = '';

      const responseHandler = (data) => {
        responseBuffer += data.toString();
        
        // Check if we have complete line(s)
        const lines = responseBuffer.split('\n');
        
        for (const line of lines) {
          const response = line.trim();
          this.logger.info(`Arduino response: ${response}`);
          
          if (response.startsWith('ERROR:')) {
            clearTimeout(timeout);
            reject(new Error(response.substring(6)));
            return;
          } else if (response.startsWith('CONFIG:') || response === 'CONFIG:SAVED' || response === 'CONFIG:RESET') {
            clearTimeout(timeout);
            resolve(response);
            return;
          }
        }
      };

      // Add temporary listener
      const parser = this.serialPort.pipe(new (require('@serialport/parser-readline'))({ delimiter: '\n' }));
      parser.once('data', responseHandler);

      // Send command
      this.serialPort.write(command + '\n', (err) => {
        if (err) {
          clearTimeout(timeout);
          reject(err);
        }
      });
    });
  }

  async configureArduinoButtons(count) {
    try {
      const response = await this.sendArduinoCommand(`CONFIG:BUTTONS:${count}`);
      await this.sendArduinoCommand('CONFIG:SAVE');
      
      // Update local config to match
      this.config.device.buttons = count;
      await this.saveConfig();
      
      return response;
    } catch (error) {
      this.logger.error('Error configuring Arduino buttons:', error);
      throw error;
    }
  }

  async configureArduinoEncoders(count) {
    try {
      const response = await this.sendArduinoCommand(`CONFIG:ENCODERS:${count}`);
      await this.sendArduinoCommand('CONFIG:SAVE');
      
      // Update local config to match
      this.config.device.encoders = count;
      await this.saveConfig();
      
      return response;
    } catch (error) {
      this.logger.error('Error configuring Arduino encoders:', error);
      throw error;
    }
  }

  async getArduinoConfig() {
    try {
      // Send CONFIG:GET and collect multiple responses
      const responses = [];
      
      return new Promise((resolve, reject) => {
        if (!this.serialPort || !this.serialPort.isOpen) {
          reject(new Error('Serial port not connected'));
          return;
        }

        const timeout = setTimeout(() => {
          reject(new Error('Arduino command timeout'));
        }, 5000);

        let responseCount = 0;
        const expectedResponses = 2; // BUTTONS and ENCODERS

        const responseHandler = (data) => {
          const response = data.toString().trim();
          this.logger.info(`Arduino config response: ${response}`);
          
          if (response.startsWith('ERROR:')) {
            clearTimeout(timeout);
            reject(new Error(response.substring(6)));
            return;
          } 
          
          if (response.startsWith('CONFIG:BUTTONS:') || response.startsWith('CONFIG:ENCODERS:')) {
            responses.push(response);
            responseCount++;
            
            if (responseCount >= expectedResponses) {
              clearTimeout(timeout);
              resolve(responses.join('\n'));
            }
          }
        };

        // Add temporary listener
        const parser = this.serialPort.pipe(new (require('@serialport/parser-readline'))({ delimiter: '\n' }));
        parser.on('data', responseHandler);

        // Clean up listener after timeout
        setTimeout(() => {
          parser.removeListener('data', responseHandler);
        }, 6000);

        // Send command
        this.serialPort.write('CONFIG:GET\n', (err) => {
          if (err) {
            clearTimeout(timeout);
            reject(err);
          }
        });
      });
    } catch (error) {
      this.logger.error('Error getting Arduino config:', error);
      throw error;
    }
  }

  async resetArduino() {
    try {
      const response = await this.sendArduinoCommand('CONFIG:RESET');
      
      // Update local config to defaults
      this.config.device.buttons = 8;
      this.config.device.encoders = 0;
      await this.saveConfig();
      
      return response;
    } catch (error) {
      this.logger.error('Error resetting Arduino:', error);
      throw error;
    }
  }

  async testSerialConnection(options) {
    const { port, baudRate } = options;
    
    try {
      this.logger.info(`Testing connection to ${port} at ${baudRate} baud`);
      
      // Import SerialPort class
      const { SerialPort } = require('serialport');
      
      // Create a temporary connection for testing
      const testPort = new SerialPort({
        path: port,
        baudRate: baudRate || 115200,
        autoOpen: false
      });
      
      return new Promise((resolve) => {
        let timeout;
        let responded = false;
        
        const cleanup = () => {
          if (timeout) clearTimeout(timeout);
          if (testPort.isOpen) {
            testPort.close();
          }
        };
        
        const succeed = () => {
          if (responded) return;
          responded = true;
          cleanup();
          resolve({ success: true });
        };
        
        const fail = (error) => {
          if (responded) return;
          responded = true;
          cleanup();
          resolve({ success: false, error: error.message || 'Connection test failed' });
        };
        
        // Set timeout for test
        timeout = setTimeout(() => {
          fail({ message: 'Connection test timed out' });
        }, 5000);
        
        // Handle port events
        testPort.on('open', () => {
          this.logger.info(`Test port ${port} opened successfully`);
          
          // Send a simple test command
          testPort.write('CONFIG:TEST\n', (writeError) => {
            if (writeError) {
              fail(writeError);
              return;
            }
            
            // Wait briefly for any response, then consider success
            setTimeout(() => {
              succeed();
            }, 1000);
          });
        });
        
        testPort.on('error', (error) => {
          this.logger.error(`Test port error: ${error.message}`);
          fail(error);
        });
        
        // Attempt to open the port
        testPort.open((openError) => {
          if (openError) {
            this.logger.error(`Failed to open test port ${port}: ${openError.message}`);
            fail(openError);
          }
        });
      });
      
    } catch (error) {
      this.logger.error('Error testing serial connection:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create and initialize the app
const macroApp = new MacroKeyboardApp();

app.whenReady().then(() => {
  macroApp.init();
});

app.on('window-all-closed', () => {
  // Keep app running on macOS and Windows for tray functionality
  if (process.platform !== 'linux') {
    // Don't quit the app
    return;
  }
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    macroApp.createWindow();
  }
});

module.exports = MacroKeyboardApp;