// Jest setup file for macro-keyboard tests

// Mock console to reduce noise during tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock setTimeout and setInterval for testing
global.setTimeout = jest.fn((callback) => callback());
global.setInterval = jest.fn((callback) => callback());
global.clearTimeout = jest.fn();
global.clearInterval = jest.fn();