// Mock serialport for testing

const { EventEmitter } = require('events');

class MockSerialPort extends EventEmitter {
  constructor(path, options = {}) {
    super();
    this.path = path;
    this.options = options;
    this.isOpen = false;
    this.baudRate = options.baudRate || 9600;
  }

  open(callback) {
    this.isOpen = true;
    if (callback) {
      setTimeout(() => callback(null), 0);
    }
    this.emit('open');
    return this;
  }

  close(callback) {
    this.isOpen = false;
    if (callback) {
      setTimeout(() => callback(null), 0);
    }
    this.emit('close');
    return this;
  }

  write(data, callback) {
    if (callback) {
      setTimeout(() => callback(null), 0);
    }
    this.emit('data', 'ACK');
    return true;
  }

  flush(callback) {
    if (callback) {
      setTimeout(() => callback(null), 0);
    }
  }

  drain(callback) {
    if (callback) {
      setTimeout(() => callback(null), 0);
    }
  }

  static list() {
    return Promise.resolve([
      {
        path: '/dev/ttyUSB0',
        manufacturer: 'Arduino',
        productId: '0043',
        vendorId: '2341'
      }
    ]);
  }
}

const ReadlineParser = jest.fn(() => ({
  on: jest.fn()
}));

module.exports = {
  SerialPort: MockSerialPort,
  ReadlineParser
};