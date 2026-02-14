/**
 * Test Data Builders and Factories
 * Provides consistent, maintainable test data creation for all test scenarios
 */

const path = require('path');

/**
 * Configuration Builder
 */
class ConfigBuilder {
  constructor() {
    this.reset();
  }

  reset() {
    this.config = {
      version: '1.0.0',
      device: {
        serialPort: null,
        baudRate: 9600,
        buttons: 8,
        encoders: 2,
        connectionTimeout: 5000,
        reconnectAttempts: 5,
        reconnectDelay: 1000
      },
      buttons: {},
      encoders: {},
      logging: {
        level: 'info',
        file: 'macro-keyboard.log',
        maxSize: '10MB',
        maxFiles: 5
      },
      security: {
        allowedCommands: [],
        allowedPaths: [],
        sandboxed: true
      },
      performance: {
        enableMonitoring: true,
        metricsInterval: 5000,
        alertThresholds: {
          memory: 100,
          cpu: 80
        }
      }
    };
    return this;
  }

  withVersion(version) {
    this.config.version = version;
    return this;
  }

  withButtonCount(count) {
    this.config.device.buttons = count;
    return this;
  }

  withEncoderCount(count) {
    this.config.device.encoders = count;
    return this;
  }

  withButton(id, buttonConfig) {
    this.config.buttons[id] = {
      description: `Button ${id}`,
      actions: [],
      enabled: true,
      ...buttonConfig
    };
    return this;
  }

  withEncoder(id, encoderConfig) {
    this.config.encoders[id] = {
      description: `Encoder ${id}`,
      clockwise: { actions: [] },
      counterclockwise: { actions: [] },
      enabled: true,
      ...encoderConfig
    };
    return this;
  }

  withKeypressAction(buttonId, keys) {
    if (!this.config.buttons[buttonId]) {
      this.withButton(buttonId, {});
    }
    this.config.buttons[buttonId].actions.push({
      type: 'keypress',
      keys: keys,
      delay: 0
    });
    return this;
  }

  withCommandAction(buttonId, command, args = []) {
    if (!this.config.buttons[buttonId]) {
      this.withButton(buttonId, {});
    }
    this.config.buttons[buttonId].actions.push({
      type: 'command',
      command: command,
      args: args,
      timeout: 5000
    });
    return this;
  }

  withApplicationAction(buttonId, application) {
    if (!this.config.buttons[buttonId]) {
      this.withButton(buttonId, {});
    }
    this.config.buttons[buttonId].actions.push({
      type: 'application',
      application: application,
      timeout: 10000
    });
    return this;
  }

  withLogLevel(level) {
    this.config.logging.level = level;
    return this;
  }

  withSerialPort(port) {
    this.config.device.serialPort = port;
    return this;
  }

  withBaudRate(rate) {
    this.config.device.baudRate = rate;
    return this;
  }

  build() {
    return JSON.parse(JSON.stringify(this.config));
  }
}

/**
 * Logger Builder
 */
class LoggerBuilder {
  constructor() {
    this.reset();
  }

  reset() {
    this.loggerConfig = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
      level: 'info'
    };
    return this;
  }

  withLevel(level) {
    this.loggerConfig.level = level;
    return this;
  }

  withSpy(method) {
    this.loggerConfig[method] = jest.fn();
    return this;
  }

  build() {
    return this.loggerConfig;
  }
}

/**
 * Serial Port Mock Builder
 */
class SerialPortMockBuilder {
  constructor() {
    this.reset();
  }

  reset() {
    this.mockPort = {
      open: jest.fn((callback) => callback && callback()),
      close: jest.fn((callback) => callback && callback()),
      write: jest.fn((data, callback) => callback && callback()),
      isOpen: false,
      path: '/dev/tty.mock',
      baudRate: 9600,
      on: jest.fn(),
      once: jest.fn(),
      removeListener: jest.fn(),
      removeAllListeners: jest.fn(),
      pipe: jest.fn().mockReturnThis()
    };
    return this;
  }

  withPath(path) {
    this.mockPort.path = path;
    return this;
  }

  withBaudRate(rate) {
    this.mockPort.baudRate = rate;
    return this;
  }

  asOpen() {
    this.mockPort.isOpen = true;
    return this;
  }

  asClosed() {
    this.mockPort.isOpen = false;
    return this;
  }

  withError(error) {
    this.mockPort.open = jest.fn((callback) => callback && callback(error));
    return this;
  }

  withWriteError(error) {
    this.mockPort.write = jest.fn((data, callback) => callback && callback(error));
    return this;
  }

  build() {
    return this.mockPort;
  }
}

/**
 * Error Builder
 */
class ErrorBuilder {
  constructor() {
    this.reset();
  }

  reset() {
    this.error = new Error('Test error');
    this.error.code = 'TEST_ERROR';
    this.error.type = 'TEST';
    return this;
  }

  withMessage(message) {
    this.error.message = message;
    return this;
  }

  withCode(code) {
    this.error.code = code;
    return this;
  }

  withType(type) {
    this.error.type = type;
    return this;
  }

  asSerialError() {
    this.error.code = 'ENOENT';
    this.error.message = 'Serial port not found';
    this.error.type = 'HARDWARE';
    return this;
  }

  asConfigError() {
    this.error.code = 'CONFIG_INVALID';
    this.error.message = 'Configuration validation failed';
    this.error.type = 'CONFIGURATION';
    return this;
  }

  asNetworkError() {
    this.error.code = 'ENOTFOUND';
    this.error.message = 'Network host not found';
    this.error.type = 'NETWORK';
    return this;
  }

  build() {
    return this.error;
  }
}

/**
 * Action Builder
 */
class ActionBuilder {
  constructor() {
    this.reset();
  }

  reset() {
    this.action = {
      type: 'keypress',
      keys: 'ctrl+c',
      delay: 0,
      timeout: 5000
    };
    return this;
  }

  asKeypress(keys) {
    this.action.type = 'keypress';
    this.action.keys = keys;
    delete this.action.command;
    delete this.action.args;
    delete this.action.application;
    return this;
  }

  asCommand(command, args = []) {
    this.action.type = 'command';
    this.action.command = command;
    this.action.args = args;
    delete this.action.keys;
    delete this.action.application;
    return this;
  }

  asApplication(application) {
    this.action.type = 'application';
    this.action.application = application;
    delete this.action.keys;
    delete this.action.command;
    delete this.action.args;
    return this;
  }

  withDelay(delay) {
    this.action.delay = delay;
    return this;
  }

  withTimeout(timeout) {
    this.action.timeout = timeout;
    return this;
  }

  build() {
    return JSON.parse(JSON.stringify(this.action));
  }
}

/**
 * Profile Builder
 */
class ProfileBuilder {
  constructor() {
    this.reset();
  }

  reset() {
    this.profile = {
      name: 'Test Profile',
      description: 'Test profile for unit testing',
      buttons: {},
      encoders: {},
      contexts: [],
      enabled: true
    };
    return this;
  }

  withName(name) {
    this.profile.name = name;
    return this;
  }

  withDescription(description) {
    this.profile.description = description;
    return this;
  }

  withButton(buttonId, buttonConfig) {
    this.profile.buttons[buttonId] = {
      description: `Button ${buttonId}`,
      actions: [],
      enabled: true,
      ...buttonConfig
    };
    return this;
  }

  withContext(contextName, rules = []) {
    this.profile.contexts.push({
      name: contextName,
      rules: rules,
      priority: 1
    });
    return this;
  }

  asDisabled() {
    this.profile.enabled = false;
    return this;
  }

  build() {
    return JSON.parse(JSON.stringify(this.profile));
  }
}

// Factory methods
const TestDataFactory = {
  config: () => new ConfigBuilder(),
  logger: () => new LoggerBuilder(),
  serialPort: () => new SerialPortMockBuilder(),
  error: () => new ErrorBuilder(),
  action: () => new ActionBuilder(),
  profile: () => new ProfileBuilder(),

  // Convenience methods for common configurations
  minimalConfig: () => new ConfigBuilder()
    .withButtonCount(4)
    .withEncoderCount(1)
    .build(),

  complexConfig: () => new ConfigBuilder()
    .withButtonCount(16)
    .withEncoderCount(4)
    .withButton('button1', { description: 'Copy', actions: [{ type: 'keypress', keys: 'ctrl+c' }] })
    .withButton('button2', { description: 'Paste', actions: [{ type: 'keypress', keys: 'ctrl+v' }] })
    .withEncoder('encoder1', { 
      clockwise: { actions: [{ type: 'keypress', keys: 'ctrl+plus' }] },
      counterclockwise: { actions: [{ type: 'keypress', keys: 'ctrl+minus' }] }
    })
    .build(),

  developmentProfile: () => new ProfileBuilder()
    .withName('Development')
    .withDescription('Profile for software development')
    .withButton('button1', { actions: [{ type: 'keypress', keys: 'ctrl+shift+p' }] })
    .withButton('button2', { actions: [{ type: 'command', command: 'npm', args: ['test'] }] })
    .withContext('vscode', [{ type: 'application', value: 'Visual Studio Code' }])
    .build(),

  defaultProfile: () => new ProfileBuilder()
    .withName('Default')
    .withDescription('Default system profile')
    .build()
};

module.exports = {
  ConfigBuilder,
  LoggerBuilder,
  SerialPortMockBuilder,
  ErrorBuilder,
  ActionBuilder,
  ProfileBuilder,
  TestDataFactory
};