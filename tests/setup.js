// Jest setup file for macro-keyboard tests

// Mock console to reduce noise during tests, but preserve console.debug for debugging
const originalConsole = { ...console };
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(), 
  error: jest.fn(),
  debug: originalConsole.debug // Keep debug for test debugging
};

// Store original timers
const originalSetTimeout = global.setTimeout;
const originalSetInterval = global.setInterval;
const originalClearTimeout = global.clearTimeout;
const originalClearInterval = global.clearInterval;

// Mock setTimeout and setInterval for testing with proper fallback
global.setTimeout = jest.fn((fn, delay) => {
  if (typeof fn === 'function') {
    // For tests, execute immediately or use original setTimeout for async behavior
    if (delay === 0 || delay === undefined) {
      process.nextTick(fn);
      return 1;
    } else {
      return originalSetTimeout(fn, delay);
    }
  }
  return 1;
});

global.setInterval = jest.fn((fn, delay) => {
  if (typeof fn === 'function') {
    return originalSetInterval(fn, delay || 1000);
  }
  return 1;
});

global.clearTimeout = jest.fn((id) => {
  if (typeof id === 'number' && id !== 1) {
    return originalClearTimeout(id);
  }
});

global.clearInterval = jest.fn((id) => {
  if (typeof id === 'number' && id !== 1) {
    return originalClearInterval(id);
  }
});

// Mock process.platform for cross-platform testing
Object.defineProperty(process, 'platform', {
  value: 'darwin', // Default to macOS for consistent testing
  writable: true
});

// Global test utilities
global.createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn()
});

global.createMockConfig = () => ({
  version: '1.0.0',
  device: {
    serialPort: null,
    baudRate: 9600,
    buttons: 8,
    encoders: 2,
    connectionTimeout: 5000
  },
  buttons: {},
  encoders: {},
  logging: {
    level: 'info',
    file: 'macro-keyboard.log'
  }
});

// Suppress unhandled promise rejection warnings in tests
process.on('unhandledRejection', (reason, promise) => {
  // Log to debug but don't fail tests
  console.debug('Unhandled promise rejection in test:', reason);
});

// Set reasonable test timeout
jest.setTimeout(30000);