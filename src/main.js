const { app, BrowserWindow, Menu, Tray, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const winston = require('winston');
const ActionExecutor = require('./ActionExecutor');
const { ErrorHandler, ErrorTypes } = require('./ErrorHandler');
const { SerialConnectionManager } = require('./SerialConnectionManager');

class MacroKeyboardApp {
  constructor() {
    this.mainWindow = null;
    this.tray = null;
    this.config = {};
    this.logger = null; // Will be initialized first
    this.errorHandler = null; // Will be initialized after logger
    this.actionExecutor = null; // Will be initialized after error handler
    this.serialManager = null; // New serial connection manager
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
    
    // Initialize logger first
    this.logger = this.initLogger();
    this.logger.info('Macro Keyboard application starting...');
    
    // Initialize error handler
    this.errorHandler = new ErrorHandler(this.logger);
    this.setupErrorHandlerListeners();
    
    // Initialize action executor with error handler
    this.actionExecutor = new ActionExecutor(this.logger);
    
    // Load configuration with error handling
    await this.safeLoadConfig();
    
    // Create UI components with error handling
    await this.safeCreateWindow();
    await this.safeCreateTray();
    
    // Set up IPC with error handling
    await this.safeSetupIPC();
    
    // Initialize serial communication with new manager
    await this.safeInitSerial();
    
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
   * Load configuration with error handling
   */
  async safeLoadConfig() {
    const configPath = path.join(__dirname, '..', 'config', 'default.yaml');
    
    try {
      if (fs.existsSync(configPath)) {
        const configFile = fs.readFileSync(configPath, 'utf8');
        this.config = yaml.load(configFile);
        
        // Validate configuration
        this.validateConfig(this.config);
        
        this.logger.info('Configuration loaded and validated successfully');
      } else {
        this.logger.info('Configuration file not found, creating default');
        this.config = this.getDefaultConfig();
        await this.safeSaveConfig();
      }
    } catch (error) {
      const configError = this.errorHandler.createError(
        ErrorTypes.CONFIGURATION.CONFIG_PARSE_ERROR,
        'Failed to load configuration file',
        error,
        { configPath }
      );
      
      await this.errorHandler.handleError(configError, 'Configuration');
      
      // Fall back to default configuration
      this.config = this.getDefaultConfig();
      this.logger.warn('Using default configuration due to load error');
    }
  }

  /**
   * Validate configuration structure
   */
  validateConfig(config) {
    const required = ['device', 'buttons', 'encoders', 'logging'];
    
    for (const key of required) {
      if (!(key in config)) {
        throw new Error(`Missing required configuration section: ${key}`);
      }
    }
    
    // Validate device configuration
    if (!config.device.baudRate || config.device.baudRate < 1200) {
      throw new Error('Invalid baud rate in device configuration');
    }
    
    // Validate button counts
    if (config.device.buttons && (config.device.buttons < 1 || config.device.buttons > 32)) {
      throw new Error('Button count must be between 1 and 32');
    }
    
    // Validate encoder counts
    if (config.device.encoders && (config.device.encoders < 0 || config.device.encoders > 8)) {
      throw new Error('Encoder count must be between 0 and 8');
    }
  }

  /**
   * Save configuration with error handling
   */
  async safeSaveConfig() {
    const configPath = path.join(__dirname, '..', 'config', 'default.yaml');
    
    try {
      if (!fs.existsSync(path.dirname(configPath))) {
        fs.mkdirSync(path.dirname(configPath), { recursive: true });
      }
      
      const configYaml = yaml.dump(this.config, { indent: 2 });
      fs.writeFileSync(configPath, configYaml);
      this.logger.info('Configuration saved successfully');
    } catch (error) {
      const saveError = this.errorHandler.createError(
        ErrorTypes.CONFIGURATION.CONFIG_SAVE_FAILED,
        'Failed to save configuration file',
        error,
        { configPath }
      );
      
      await this.errorHandler.handleError(saveError, 'Configuration');
    }
  }

  getDefaultConfig() {
    return {
      device: {
        serialPort: null,
        baudRate: 9600,
        buttons: 8,
        encoders: 0
      },
      buttons: {},
      encoders: {},
      logging: {
        level: 'info',
        file: 'logs/macro-keyboard.log'
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
      this.config = newConfig;
      await this.saveConfig();
      return true;
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
      const buttonConfig = this.config.buttons[`button${buttonId}`];
      
      if (!buttonConfig || !buttonConfig.action || !buttonConfig.type) {
        const configError = this.errorHandler.createError(
          ErrorTypes.CONFIGURATION.INVALID_BUTTON_CONFIG,
          `No valid action configured for button ${buttonId}`,
          null,
          { buttonId, buttonConfig }
        );
        
        await this.errorHandler.handleError(configError, 'ButtonAction');
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
      return false;
    }
  }

  /**
   * Execute encoder action with comprehensive error handling
   */
  async executeEncoderAction(encoderId, direction) {
    try {
      const encoderConfig = this.config.encoders[`encoder${encoderId}`];
      
      if (!encoderConfig) {
        const configError = this.errorHandler.createError(
          ErrorTypes.CONFIGURATION.INVALID_ENCODER_CONFIG,
          `No configuration found for encoder ${encoderId}`,
          null,
          { encoderId, direction }
        );
        
        await this.errorHandler.handleError(configError, 'EncoderAction');
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