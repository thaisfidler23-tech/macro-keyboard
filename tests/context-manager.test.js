const ContextManager = require('../src/ContextManager');
const EventEmitter = require('events');

// Mock child_process
jest.mock('child_process', () => ({
  exec: jest.fn()
}));

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

describe('ContextManager', () => {
  let contextManager;
  const { exec } = require('child_process');

  beforeEach(() => {
    jest.clearAllMocks();
    contextManager = new ContextManager(mockLogger);
  });

  afterEach(() => {
    if (contextManager && contextManager.isMonitoring()) {
      contextManager.stopMonitoring();
    }
  });

  test('should initialize properly', () => {
    expect(contextManager).toBeInstanceOf(EventEmitter);
    expect(contextManager.isMonitoring()).toBe(false);
    expect(contextManager.getRules()).toEqual([]);
  });

  test('should add rules', () => {
    const rule = {
      name: 'Test Rule',
      type: 'application',
      applicationName: 'TestApp',
      targetProfile: 'test'
    };

    contextManager.addRule(rule);
    const rules = contextManager.getRules();
    expect(rules).toHaveLength(1);
    expect(rules[0].name).toBe('Test Rule');
  });

  test('should start and stop monitoring', () => {
    expect(contextManager.isMonitoring()).toBe(false);
    contextManager.startMonitoring();
    expect(contextManager.isMonitoring()).toBe(true);
    contextManager.stopMonitoring();
    expect(contextManager.isMonitoring()).toBe(false);
  });

  test('should get current application', async () => {
    exec.mockImplementation((command, callback) => {
      callback(null, 'TestApp');
    });

    const appInfo = await contextManager.getCurrentApplication();
    expect(appInfo.name).toBe('TestApp');
  });

  test('should evaluate context', async () => {
    const evaluation = await contextManager.evaluateContext();
    expect(evaluation).toHaveProperty('currentContext');
    expect(evaluation).toHaveProperty('matchingRules');
    expect(evaluation).toHaveProperty('recommendedProfile');
  });
});
