/**
 * Jest Setup - Global configuration for all tests
 * Sets up mocks, globals, and test utilities
 */

// Set up TextEncoder/TextDecoder for Node.js environments
if (typeof TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

const { setupTestEnvironment, cleanupTestEnvironment } = require('./ui-test-environment');

// Set up global test environment
beforeAll(() => {
  // Set up DOM environment for all tests
  setupTestEnvironment();
  
  // Mock console methods to reduce test noise but still allow debugging
  global.console = {
    ...console,
    log: jest.fn((...args) => {
      if (process.env.NODE_ENV === 'test' && process.env.JEST_VERBOSE) {
        console.log(...args);
      }
    }),
    warn: jest.fn((...args) => {
      if (process.env.NODE_ENV === 'test' && process.env.JEST_VERBOSE) {
        console.warn(...args);
      }
    }),
    error: jest.fn((...args) => {
      if (process.env.NODE_ENV === 'test' && process.env.JEST_VERBOSE) {
        console.error(...args);
      }
    }),
    info: jest.fn((...args) => {
      if (process.env.NODE_ENV === 'test' && process.env.JEST_VERBOSE) {
        console.info(...args);
      }
    }),
    debug: jest.fn((...args) => {
      if (process.env.NODE_ENV === 'test' && process.env.JEST_VERBOSE) {
        console.debug(...args);
      }
    })
  };

  // Mock timers for consistent testing
  jest.useFakeTimers('modern');
});

// Clean up after all tests
afterAll(() => {
  cleanupTestEnvironment();
  jest.useRealTimers();
});

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
  
  // Reset DOM to clean state
  if (global.document) {
    // Clear any dynamically added content
    const messages = global.document.querySelectorAll('.messages-container');
    messages.forEach(container => {
      container.innerHTML = '';
    });
    
    // Reset modal states
    const modals = global.document.querySelectorAll('.modal');
    modals.forEach(modal => {
      modal.style.display = 'none';
    });
    
    // Reset form states
    const forms = global.document.querySelectorAll('form');
    forms.forEach(form => form.reset());
  }
});

// Global test utilities
global.testUtils = {
  // Simulate user events
  fireEvent: {
    click: (element) => {
      const event = new global.MouseEvent('click', { bubbles: true });
      element.dispatchEvent(event);
    },
    
    change: (element, value) => {
      element.value = value;
      const event = new global.Event('change', { bubbles: true });
      element.dispatchEvent(event);
    },
    
    input: (element, value) => {
      element.value = value;
      const event = new global.Event('input', { bubbles: true });
      element.dispatchEvent(event);
    },
    
    keyDown: (element, key) => {
      const event = new global.KeyboardEvent('keydown', { 
        key, 
        code: key,
        bubbles: true 
      });
      element.dispatchEvent(event);
    },
    
    keyUp: (element, key) => {
      const event = new global.KeyboardEvent('keyup', { 
        key, 
        code: key,
        bubbles: true 
      });
      element.dispatchEvent(event);
    },
    
    focus: (element) => {
      const event = new global.Event('focus', { bubbles: true });
      element.dispatchEvent(event);
    },
    
    blur: (element) => {
      const event = new global.Event('blur', { bubbles: true });
      element.dispatchEvent(event);
    }
  },
  
  // Wait for DOM updates
  waitFor: async (callback, timeout = 5000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        await callback();
        return;
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    throw new Error(`Timeout waiting for condition after ${timeout}ms`);
  },
  
  // Find elements by various selectors
  findByTestId: (testId) => global.document.querySelector(`[data-testid="${testId}"]`),
  findAllByTestId: (testId) => Array.from(global.document.querySelectorAll(`[data-testid="${testId}"]`)),
  findByText: (text) => {
    return Array.from(global.document.querySelectorAll('*')).find(element => 
      element.textContent && element.textContent.trim() === text
    );
  },
  findByPartialText: (partialText) => {
    return Array.from(global.document.querySelectorAll('*')).find(element => 
      element.textContent && element.textContent.includes(partialText)
    );
  },
  
  // Modal testing utilities
  expectModalVisible: (modalId) => {
    const modal = global.document.getElementById(modalId);
    expect(modal).toBeTruthy();
    expect(modal.style.display).not.toBe('none');
  },
  
  expectModalHidden: (modalId) => {
    const modal = global.document.getElementById(modalId);
    if (modal) {
      expect(modal.style.display).toBe('none');
    }
  },
  
  // Form testing utilities
  fillForm: (formSelector, data) => {
    const form = global.document.querySelector(formSelector);
    expect(form).toBeTruthy();
    
    Object.entries(data).forEach(([name, value]) => {
      const input = form.querySelector(`[name="${name}"], #${name}`);
      if (input) {
        if (input.type === 'checkbox') {
          input.checked = value;
        } else {
          input.value = value;
        }
        global.testUtils.fireEvent.change(input, value);
      }
    });
  },
  
  // Mock API responses
  mockAPIResponse: (method, response) => {
    global.electronAPI[method] = jest.fn().mockResolvedValue(response);
  },
  
  // Simulate errors
  mockAPIError: (method, error) => {
    global.electronAPI[method] = jest.fn().mockRejectedValue(error);
  },
  
  // Create mock data
  createMockProfile: (overrides = {}) => ({
    name: 'test-profile',
    description: 'Test profile description',
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
    buttons: {},
    encoders: {},
    ...overrides
  }),
  
  createMockPlugin: (overrides = {}) => ({
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    enabled: true,
    description: 'A test plugin',
    ...overrides
  }),
  
  createMockPerformanceMetrics: (overrides = {}) => ({
    cpu: 25.5,
    memory: {
      rss: 104857600,
      heapTotal: 67108864,
      heapUsed: 33554432,
      external: 1048576
    },
    eventLoopLag: 5.2,
    timestamp: Date.now(),
    ...overrides
  }),
  
  // Hardware simulation
  simulateButtonPress: (buttonId) => {
    const event = new global.CustomEvent('button-press', {
      detail: { buttonId, timestamp: Date.now() }
    });
    global.document.dispatchEvent(event);
  },
  
  simulateEncoderRotation: (encoderId, direction) => {
    const event = new global.CustomEvent('encoder-rotation', {
      detail: { encoderId, direction, timestamp: Date.now() }
    });
    global.document.dispatchEvent(event);
  },
  
  // Color testing utilities
  parseColorString: (colorStr) => {
    if (colorStr.startsWith('#')) {
      const hex = colorStr.slice(1);
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16)
      };
    }
    return { r: 0, g: 0, b: 0 };
  },
  
  colorToHex: ({ r, g, b }) => {
    const toHex = (n) => n.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
};

// Extended matchers for better testing
expect.extend({
  toBeVisible(element) {
    const pass = element && 
                 element.style.display !== 'none' && 
                 !element.hidden &&
                 element.offsetParent !== null;
    
    return {
      message: () => `expected element to be ${pass ? 'hidden' : 'visible'}`,
      pass,
    };
  },
  
  toHaveClass(element, className) {
    const pass = element && element.classList.contains(className);
    
    return {
      message: () => `expected element to ${pass ? 'not ' : ''}have class "${className}"`,
      pass,
    };
  },
  
  toBeEnabled(element) {
    const pass = element && !element.disabled;
    
    return {
      message: () => `expected element to be ${pass ? 'disabled' : 'enabled'}`,
      pass,
    };
  },
  
  toHaveValue(element, value) {
    const pass = element && element.value === value;
    
    return {
      message: () => `expected element to have value "${value}" but got "${element?.value}"`,
      pass,
    };
  },
  
  toContainText(element, text) {
    const pass = element && element.textContent.includes(text);
    
    return {
      message: () => `expected element to contain text "${text}"`,
      pass,
    };
  }
});

// Global error handling for unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  throw reason;
});

// Set environment variables for testing
process.env.NODE_ENV = 'test';
process.env.JEST_TIMEOUT = '10000';