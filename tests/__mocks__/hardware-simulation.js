/**
 * Hardware Simulation Framework
 * Provides mock implementations of Arduino and hardware components for testing
 */

class MockArduinoBoard {
  constructor() {
    this.buttonCount = 8;
    this.encoderCount = 0;
    this.ledCount = 8;
    this.brightness = 128;
    this.buttonStates = new Array(this.buttonCount).fill(false);
    this.encoderStates = new Array(this.encoderCount).fill(0);
    this.ledColors = new Array(this.ledCount).fill({ r: 0, g: 0, b: 0 });
    this.isConnected = false;
    this.config = {
      buttons: this.buttonCount,
      encoders: this.encoderCount
    };
  }

  connect() {
    this.isConnected = true;
    return Promise.resolve();
  }

  disconnect() {
    this.isConnected = false;
    return Promise.resolve();
  }

  simulateButtonPress(buttonId) {
    if (buttonId >= 0 && buttonId < this.buttonCount) {
      this.buttonStates[buttonId] = true;
      setTimeout(() => {
        this.buttonStates[buttonId] = false;
      }, 100);
      return `BTN:${buttonId}`;
    }
    return null;
  }

  simulateEncoderRotation(encoderId, direction) {
    if (encoderId >= 0 && encoderId < this.encoderCount) {
      this.encoderStates[encoderId] += direction === 'CW' ? 1 : -1;
      return `ENC:${encoderId}:${direction}`;
    }
    return null;
  }

  setLEDColor(ledId, color) {
    if (ledId >= 0 && ledId < this.ledCount) {
      this.ledColors[ledId] = { ...color };
      return true;
    }
    return false;
  }

  setAllLEDs(color) {
    this.ledColors.fill({ ...color });
    return true;
  }

  setBrightness(brightness) {
    this.brightness = Math.max(0, Math.min(255, brightness));
    return true;
  }

  clearAllLEDs() {
    this.ledColors.fill({ r: 0, g: 0, b: 0 });
    return true;
  }

  getConfiguration() {
    return {
      buttons: this.buttonCount,
      encoders: this.encoderCount
    };
  }

  setConfiguration(config) {
    if (config.buttons && config.buttons > 0 && config.buttons <= 32) {
      this.buttonCount = config.buttons;
      this.buttonStates = new Array(this.buttonCount).fill(false);
    }
    if (config.encoders && config.encoders >= 0 && config.encoders <= 8) {
      this.encoderCount = config.encoders;
      this.encoderStates = new Array(this.encoderCount).fill(0);
    }
    this.config = {
      buttons: this.buttonCount,
      encoders: this.encoderCount
    };
    return true;
  }

  reset() {
    this.buttonCount = 8;
    this.encoderCount = 0;
    this.buttonStates = new Array(8).fill(false);
    this.encoderStates = [];
    this.ledColors = new Array(8).fill({ r: 0, g: 0, b: 0 });
    this.brightness = 128;
    this.config = {
      buttons: 8,
      encoders: 0
    };
    return true;
  }
}

class MockSerialPort {
  constructor(path, options = {}) {
    this.path = path;
    this.baudRate = options.baudRate || 9600;
    this.isOpen = false;
    this.listeners = new Map();
    this.arduino = new MockArduinoBoard();
  }

  async open() {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        this.isOpen = true;
        this.arduino.connect();
        this.emit('open');
        resolve();
      }, 10);
    });
  }

  close(callback) {
    this.isOpen = false;
    this.arduino.disconnect();
    this.emit('close');
    if (callback) callback();
  }

  write(data, callback) {
    if (!this.isOpen) {
      const error = new Error('Port is not open');
      if (callback) callback(error);
      return false;
    }

    setTimeout(() => {
      const response = this.processArduinoCommand(data.toString().trim());
      if (response) {
        this.emit('data', response + '\n');
      }
      if (callback) callback(null);
    }, 5);

    return true;
  }

  processArduinoCommand(command) {
    switch (command) {
      case 'CONFIG:GET':
        return `CONFIG:BUTTONS:${this.arduino.buttonCount}\nCONFIG:ENCODERS:${this.arduino.encoderCount}`;
      
      case 'CONFIG:RESET':
        this.arduino.reset();
        return 'CONFIG:RESET';
      
      case 'CONFIG:SAVE':
        return 'CONFIG:SAVED';
      
      default:
        if (command.startsWith('CONFIG:BUTTONS:')) {
          const count = parseInt(command.split(':')[2]);
          if (count > 0 && count <= 32) {
            this.arduino.setConfiguration({ buttons: count, encoders: this.arduino.encoderCount });
            return `CONFIG:BUTTONS:${count}`;
          }
          return 'ERROR:Invalid button count';
        }
        
        if (command.startsWith('CONFIG:ENCODERS:')) {
          const count = parseInt(command.split(':')[2]);
          if (count >= 0 && count <= 8) {
            this.arduino.setConfiguration({ buttons: this.arduino.buttonCount, encoders: count });
            return `CONFIG:ENCODERS:${count}`;
          }
          return 'ERROR:Invalid encoder count';
        }
        
        return 'ERROR:Unknown command';
    }
  }

  on(event, listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(listener);
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error('Mock serial port listener error:', error);
        }
      });
    }
  }

  pipe(parser) {
    const mockParser = {
      on: (event, listener) => {
        if (event === 'data') {
          // Set up data parsing simulation
          this.on('data', (rawData) => {
            const lines = rawData.split('\n').filter(line => line.trim());
            lines.forEach(line => listener(line));
          });
        }
      }
    };
    return mockParser;
  }

  static list() {
    return Promise.resolve([
      {
        path: '/dev/ttyUSB0',
        manufacturer: 'Arduino',
        serialNumber: 'MOCK001',
        pnpId: 'usb-Arduino_Micro-if00',
        locationId: '0x001',
        vendorId: '0x2341',
        productId: '0x8037'
      },
      {
        path: '/dev/ttyUSB1', 
        manufacturer: 'FTDI',
        serialNumber: 'MOCK002',
        pnpId: 'usb-FTDI-if00',
        locationId: '0x002',
        vendorId: '0x0403',
        productId: '0x6001'
      }
    ]);
  }
}

// Mock Hardware Environment for comprehensive testing
class MockHardwareEnvironment {
  constructor() {
    this.arduino = new MockArduinoBoard();
    this.serialPort = null;
    this.eventListeners = new Map();
    this.isSimulating = false;
    this.simulationInterval = null;
  }

  createSerialPort(path, options) {
    this.serialPort = new MockSerialPort(path, options);
    this.serialPort.arduino = this.arduino;
    return this.serialPort;
  }

  startSimulation() {
    if (this.isSimulating) return;
    
    this.isSimulating = true;
    
    // Simulate random button presses and encoder rotations
    this.simulationInterval = setInterval(() => {
      // Random button press simulation
      if (Math.random() < 0.1) {
        const buttonId = Math.floor(Math.random() * this.arduino.buttonCount);
        const command = this.arduino.simulateButtonPress(buttonId);
        if (command && this.serialPort) {
          this.serialPort.emit('data', command + '\n');
        }
      }
      
      // Random encoder rotation simulation
      if (Math.random() < 0.05 && this.arduino.encoderCount > 0) {
        const encoderId = Math.floor(Math.random() * this.arduino.encoderCount);
        const direction = Math.random() < 0.5 ? 'CW' : 'CCW';
        const command = this.arduino.simulateEncoderRotation(encoderId, direction);
        if (command && this.serialPort) {
          this.serialPort.emit('data', command + '\n');
        }
      }
    }, 1000);
  }

  stopSimulation() {
    this.isSimulating = false;
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
  }

  simulateHardwareEvent(type, data) {
    let command = null;
    
    switch (type) {
      case 'button-press':
        command = this.arduino.simulateButtonPress(data.buttonId);
        break;
      case 'encoder-rotation':
        command = this.arduino.simulateEncoderRotation(data.encoderId, data.direction);
        break;
    }
    
    if (command && this.serialPort) {
      setTimeout(() => {
        this.serialPort.emit('data', command + '\n');
      }, data.delay || 0);
    }
    
    return command !== null;
  }

  getHardwareState() {
    return {
      arduino: {
        buttonCount: this.arduino.buttonCount,
        encoderCount: this.arduino.encoderCount,
        buttonStates: [...this.arduino.buttonStates],
        encoderStates: [...this.arduino.encoderStates],
        ledColors: [...this.arduino.ledColors],
        brightness: this.arduino.brightness,
        isConnected: this.arduino.isConnected
      },
      serialPort: {
        isOpen: this.serialPort ? this.serialPort.isOpen : false,
        path: this.serialPort ? this.serialPort.path : null
      }
    };
  }

  reset() {
    this.stopSimulation();
    this.arduino = new MockArduinoBoard();
    if (this.serialPort) {
      this.serialPort.arduino = this.arduino;
    }
    this.eventListeners.clear();
  }
}

// Global hardware environment for tests
global.mockHardware = new MockHardwareEnvironment();

// Mock serialport module
const mockSerialPortModule = {
  SerialPort: MockSerialPort,
  list: MockSerialPort.list
};

const mockReadlineParser = class ReadlineParser {
  constructor(options = {}) {
    this.delimiter = options.delimiter || '\n';
    this.listeners = new Map();
  }
  
  on(event, listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(listener);
  }
  
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(listener => listener(data));
    }
  }
};

module.exports = {
  MockArduinoBoard,
  MockSerialPort,
  MockHardwareEnvironment,
  mockHardware: global.mockHardware,
  
  // Mock modules for require statements
  serialport: mockSerialPortModule,
  '@serialport/parser-readline': {
    ReadlineParser: mockReadlineParser
  }
};