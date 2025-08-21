const { app, BrowserWindow, Menu, Tray, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const winston = require('winston');

class MacroKeyboardApp {
  constructor() {
    this.mainWindow = null;
    this.tray = null;
    this.config = {};
    this.logger = this.initLogger();
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

  executeButtonAction(buttonId) {
    const buttonConfig = this.config.buttons[`button${buttonId}`];
    if (buttonConfig && buttonConfig.action) {
      this.logger.info(`Executing action for button ${buttonId}: ${buttonConfig.action}`);
      // TODO: Implement action execution based on action type
    }
  }

  executeEncoderAction(encoderId, direction) {
    const encoderConfig = this.config.encoders[`encoder${encoderId}`];
    if (encoderConfig) {
      const actionKey = direction === 'CW' ? 'actionCW' : 'actionCCW';
      const action = encoderConfig[actionKey];
      if (action) {
        this.logger.info(`Executing ${direction} action for encoder ${encoderId}: ${action}`);
        // TODO: Implement action execution based on action type
      }
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