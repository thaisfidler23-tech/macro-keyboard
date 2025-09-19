const { app, BrowserWindow, Menu, Tray, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const winston = require('winston');
const ActionExecutor = require('./ActionExecutor');

class MacroKeyboardApp {
  constructor() {
    this.mainWindow = null;
    this.tray = null;
    this.config = {};
    this.logger = this.initLogger();
    this.actionExecutor = null; // Will be initialized after logger
    this.serialPort = null;
    this.isDev = process.argv.includes('--dev');
  }

  initLogger() {
    return winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `${timestamp} [${level.toUpperCase()}]: ${message}`;
        })
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/macro-keyboard.log' }),
        new winston.transports.Console()
      ]
    });
  }

  async init() {
    await app.whenReady();
    
    // Ensure logs directory exists
    if (!fs.existsSync('logs')) {
      fs.mkdirSync('logs', { recursive: true });
    }

    this.logger.info('Macro Keyboard application starting...');
    
    // Initialize action executor
    this.actionExecutor = new ActionExecutor(this.logger);
    
    await this.loadConfig();
    this.createWindow();
    
    // Platform-specific initialization
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

    this.setupIPC();
    this.initSerial();
  }

  async loadConfig() {
    const configPath = path.join(__dirname, '..', 'config', 'default.yaml');
    try {
      if (fs.existsSync(configPath)) {
        const configFile = fs.readFileSync(configPath, 'utf8');
        this.config = yaml.load(configFile);
        this.logger.info('Configuration loaded successfully');
      } else {
        this.config = this.getDefaultConfig();
        await this.saveConfig();
        this.logger.info('Created default configuration');
      }
    } catch (error) {
      this.logger.error('Error loading configuration:', error);
      this.config = this.getDefaultConfig();
    }
  }

  async saveConfig() {
    const configPath = path.join(__dirname, '..', 'config', 'default.yaml');
    try {
      if (!fs.existsSync(path.dirname(configPath))) {
        fs.mkdirSync(path.dirname(configPath), { recursive: true });
      }
      const configYaml = yaml.dump(this.config, { indent: 2 });
      fs.writeFileSync(configPath, configYaml);
      this.logger.info('Configuration saved successfully');
    } catch (error) {
      this.logger.error('Error saving configuration:', error);
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
    this.tray = new Tray(path.join(__dirname, 'assets', 'icon.png'));
    
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
    this.tray = new Tray(path.join(__dirname, 'assets', 'icon.ico'));
    
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

  async executeButtonAction(buttonId) {
    const buttonConfig = this.config.buttons[`button${buttonId}`];
    if (buttonConfig && buttonConfig.action && buttonConfig.type) {
      this.logger.info(`Executing action for button ${buttonId}: ${buttonConfig.action}`);
      
      if (!this.actionExecutor) {
        this.logger.error('Action executor not initialized');
        return false;
      }

      const success = await this.actionExecutor.executeAction(buttonConfig, `button${buttonId}`);
      if (!success) {
        this.logger.error(`Failed to execute action for button ${buttonId}`);
      }
      return success;
    } else {
      this.logger.warn(`No action configured for button ${buttonId}`, buttonConfig);
      return false;
    }
  }

  async executeEncoderAction(encoderId, direction) {
    const encoderConfig = this.config.encoders[`encoder${encoderId}`];
    if (encoderConfig) {
      const actionKey = direction === 'CW' ? 'actionCW' : 'actionCCW';
      const typeKey = direction === 'CW' ? 'typeCW' : 'typeCCW';
      const action = encoderConfig[actionKey];
      const type = encoderConfig[typeKey];
      
      if (action && type) {
        this.logger.info(`Executing ${direction} action for encoder ${encoderId}: ${action}`);
        
        if (!this.actionExecutor) {
          this.logger.error('Action executor not initialized');
          return false;
        }

        const actionConfig = { type, action };
        const success = await this.actionExecutor.executeAction(actionConfig, `encoder${encoderId}:${direction}`);
        if (!success) {
          this.logger.error(`Failed to execute ${direction} action for encoder ${encoderId}`);
        }
        return success;
      } else {
        this.logger.warn(`No ${direction} action configured for encoder ${encoderId}`, encoderConfig);
        return false;
      }
    } else {
      this.logger.warn(`No configuration found for encoder ${encoderId}`);
      return false;
    }
  }

  async reloadConfig() {
    this.logger.info('Reloading configuration...');
    await this.loadConfig();
    
    // Reinitialize serial if needed
    if (this.serialPort) {
      this.serialPort.close();
      this.serialPort = null;
    }
    
    await this.initSerial();
    
    // Notify renderer if window exists
    if (this.mainWindow) {
      this.mainWindow.webContents.send('config-reloaded', this.config);
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