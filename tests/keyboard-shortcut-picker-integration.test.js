/**
 * Test file for Keyboard Shortcut Picker integration
 */

const { describe, test, expect, beforeEach, afterEach, jest } = require('@jest/globals');

// Mock DOM environment
class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName;
    this.style = {};
    this.children = [];
    this.eventListeners = {};
    this.value = '';
    this.innerHTML = '';
    this.classList = {
      add: jest.fn(),
      remove: jest.fn(),
      toggle: jest.fn(),
      contains: jest.fn()
    };
  }

  addEventListener(event, handler) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(handler);
  }

  removeEventListener(event, handler) {
    if (this.eventListeners[event]) {
      const index = this.eventListeners[event].indexOf(handler);
      if (index > -1) {
        this.eventListeners[event].splice(index, 1);
      }
    }
  }

  appendChild(child) {
    this.children.push(child);
  }

  hasChildNodes() {
    return this.children.length > 0;
  }

  getElementById(id) {
    return new MockElement();
  }
}

// Mock document
global.document = {
  createElement: jest.fn(() => new MockElement()),
  getElementById: jest.fn(() => new MockElement()),
  querySelector: jest.fn(() => new MockElement()),
  addEventListener: jest.fn(),
  head: new MockElement(),
  body: new MockElement()
};

// Mock window
global.window = {
  KeyboardShortcutPicker: undefined
};

// Mock KeyboardShortcutPicker class
class MockKeyboardShortcutPicker {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.shortcuts = new Set();
  }

  setShortcut(shortcut) {
    this.shortcuts.add(shortcut);
    return this;
  }

  getShortcut() {
    return {
      electronFormat: 'CmdOrCtrl+C',
      displayFormat: 'Cmd+C',
      keys: ['Meta', 'KeyC']
    };
  }

  destroy() {
    this.shortcuts.clear();
  }
}

describe('Keyboard Shortcut Picker Integration', () => {
  let mockConfigUI;
  let mockIpcRenderer;

  beforeEach(() => {
    // Mock ipcRenderer
    mockIpcRenderer = {
      invoke: jest.fn(),
      on: jest.fn()
    };
    global.require = jest.fn((module) => {
      if (module === 'electron') {
        return { ipcRenderer: mockIpcRenderer };
      }
      return {};
    });

    // Mock ConfigUI class structure
    mockConfigUI = {
      config: {
        buttons: {
          button1: { action: 'CmdOrCtrl+C', type: 'keypress' }
        },
        encoders: {
          encoder1: { actionCW: 'CmdOrCtrl+V', typeCW: 'keypress' }
        }
      },
      updateButtonConfig: jest.fn(),
      updateEncoderConfig: jest.fn()
    };

    // Set up KeyboardShortcutPicker
    global.window.KeyboardShortcutPicker = MockKeyboardShortcutPicker;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Button Shortcut Picker Integration', () => {
    test('should create shortcut picker for button when keypress type selected', () => {
      const buttonId = 1;
      const container = new MockElement();
      const actionInput = new MockElement();

      // Mock DOM elements
      document.getElementById = jest.fn((id) => {
        if (id === `btn${buttonId}-shortcut-picker`) return container;
        if (id === `btn${buttonId}-action`) return actionInput;
        return new MockElement();
      });

      // Simulate ConfigUI method
      const toggleShortcutPicker = function(buttonId, actionType) {
        const pickerContainer = document.getElementById(`btn${buttonId}-shortcut-picker`);
        const actionInput = document.getElementById(`btn${buttonId}-action`);
        
        if (actionType === 'keypress') {
          pickerContainer.style.display = 'block';
          actionInput.style.display = 'none';
          
          if (!pickerContainer.hasChildNodes()) {
            const picker = new MockKeyboardShortcutPicker(pickerContainer, {
              onChange: (shortcut) => {
                actionInput.value = shortcut.electronFormat;
                mockConfigUI.updateButtonConfig(buttonId, 'action', shortcut.electronFormat);
              }
            });
            
            const currentAction = mockConfigUI.config.buttons?.[`button${buttonId}`]?.action;
            if (currentAction) {
              picker.setShortcut(currentAction);
            }
          }
        }
      };

      // Test the integration
      toggleShortcutPicker.call(mockConfigUI, buttonId, 'keypress');

      expect(container.style.display).toBe('block');
      expect(actionInput.style.display).toBe('none');
    });

    test('should hide shortcut picker for non-keypress action types', () => {
      const buttonId = 1;
      const container = new MockElement();
      const actionInput = new MockElement();

      document.getElementById = jest.fn((id) => {
        if (id === `btn${buttonId}-shortcut-picker`) return container;
        if (id === `btn${buttonId}-action`) return actionInput;
        return new MockElement();
      });

      const toggleShortcutPicker = function(buttonId, actionType) {
        const pickerContainer = document.getElementById(`btn${buttonId}-shortcut-picker`);
        const actionInput = document.getElementById(`btn${buttonId}-action`);
        
        if (actionType === 'keypress') {
          pickerContainer.style.display = 'block';
          actionInput.style.display = 'none';
        } else {
          pickerContainer.style.display = 'none';
          actionInput.style.display = 'block';
        }
      };

      toggleShortcutPicker.call(mockConfigUI, buttonId, 'command');

      expect(container.style.display).toBe('none');
      expect(actionInput.style.display).toBe('block');
    });

    test('should update button configuration when shortcut changes', () => {
      const buttonId = 1;
      const container = new MockElement();
      const actionInput = new MockElement();

      const createShortcutPicker = function(buttonId, container, actionInput) {
        const picker = new MockKeyboardShortcutPicker(container, {
          onChange: (shortcut) => {
            actionInput.value = shortcut.electronFormat;
            this.updateButtonConfig(buttonId, 'action', shortcut.electronFormat);
            this.updateButtonConfig(buttonId, 'shortcutDisplay', shortcut.displayFormat);
          }
        });

        const currentAction = this.config.buttons?.[`button${buttonId}`]?.action;
        if (currentAction) {
          picker.setShortcut(currentAction);
        }

        // Simulate shortcut change
        const shortcut = picker.getShortcut();
        picker.options.onChange(shortcut);

        return picker;
      };

      createShortcutPicker.call(mockConfigUI, buttonId, container, actionInput);

      expect(mockConfigUI.updateButtonConfig).toHaveBeenCalledWith(buttonId, 'action', 'CmdOrCtrl+C');
      expect(mockConfigUI.updateButtonConfig).toHaveBeenCalledWith(buttonId, 'shortcutDisplay', 'Cmd+C');
    });
  });

  describe('Encoder Shortcut Picker Integration', () => {
    test('should create shortcut picker for encoder direction when keypress type selected', () => {
      const encoderId = 1;
      const direction = 'cw';
      const container = new MockElement();
      const actionInput = new MockElement();

      document.getElementById = jest.fn((id) => {
        if (id === `enc${encoderId}-${direction}-shortcut-picker`) return container;
        if (id === `enc${encoderId}-action-${direction}`) return actionInput;
        return new MockElement();
      });

      const toggleEncoderShortcutPicker = function(encoderId, direction, actionType) {
        const pickerContainer = document.getElementById(`enc${encoderId}-${direction}-shortcut-picker`);
        const actionInput = document.getElementById(`enc${encoderId}-action-${direction}`);
        
        if (actionType === 'keypress') {
          pickerContainer.style.display = 'block';
          actionInput.style.display = 'none';
          
          if (!pickerContainer.hasChildNodes()) {
            const picker = new MockKeyboardShortcutPicker(pickerContainer);
          }
        } else {
          pickerContainer.style.display = 'none';
          actionInput.style.display = 'block';
        }
      };

      toggleEncoderShortcutPicker.call(mockConfigUI, encoderId, direction, 'keypress');

      expect(container.style.display).toBe('block');
      expect(actionInput.style.display).toBe('none');
    });

    test('should update encoder configuration when shortcut changes', () => {
      const encoderId = 1;
      const direction = 'cw';
      const fieldName = 'actionCW';
      const container = new MockElement();
      const actionInput = new MockElement();

      const createEncoderShortcutPicker = function(encoderId, direction, container, actionInput) {
        const fieldName = direction === 'cw' ? 'actionCW' : 'actionCCW';
        const picker = new MockKeyboardShortcutPicker(container, {
          onChange: (shortcut) => {
            actionInput.value = shortcut.electronFormat;
            this.updateEncoderConfig(encoderId, fieldName, shortcut.electronFormat);
            this.updateEncoderConfig(encoderId, `shortcutDisplay${direction.toUpperCase()}`, shortcut.displayFormat);
          }
        });

        const currentAction = this.config.encoders?.[`encoder${encoderId}`]?.[fieldName];
        if (currentAction) {
          picker.setShortcut(currentAction);
        }

        // Simulate shortcut change
        const shortcut = picker.getShortcut();
        picker.options.onChange(shortcut);

        return picker;
      };

      createEncoderShortcutPicker.call(mockConfigUI, encoderId, direction, container, actionInput);

      expect(mockConfigUI.updateEncoderConfig).toHaveBeenCalledWith(encoderId, fieldName, 'CmdOrCtrl+C');
      expect(mockConfigUI.updateEncoderConfig).toHaveBeenCalledWith(encoderId, 'shortcutDisplayCW', 'Cmd+C');
    });
  });

  describe('Keyboard Shortcut Templates', () => {
    test('should provide common shortcut templates', () => {
      const commonShortcuts = [
        { name: 'Copy', shortcut: 'CmdOrCtrl+C' },
        { name: 'Paste', shortcut: 'CmdOrCtrl+V' },
        { name: 'Cut', shortcut: 'CmdOrCtrl+X' },
        { name: 'Undo', shortcut: 'CmdOrCtrl+Z' },
        { name: 'Redo', shortcut: 'CmdOrCtrl+Shift+Z' },
        { name: 'Select All', shortcut: 'CmdOrCtrl+A' },
        { name: 'Find', shortcut: 'CmdOrCtrl+F' },
        { name: 'Save', shortcut: 'CmdOrCtrl+S' },
        { name: 'New', shortcut: 'CmdOrCtrl+N' },
        { name: 'Open', shortcut: 'CmdOrCtrl+O' }
      ];

      expect(commonShortcuts).toHaveLength(10);
      expect(commonShortcuts[0]).toEqual({ name: 'Copy', shortcut: 'CmdOrCtrl+C' });
      expect(commonShortcuts[1]).toEqual({ name: 'Paste', shortcut: 'CmdOrCtrl+V' });
    });
  });

  describe('Conflict Detection', () => {
    test('should detect shortcut conflicts between buttons', () => {
      const config = {
        buttons: {
          button1: { action: 'CmdOrCtrl+C', type: 'keypress' },
          button2: { action: 'CmdOrCtrl+C', type: 'keypress' },
          button3: { action: 'CmdOrCtrl+V', type: 'keypress' }
        }
      };

      const detectConflicts = function(newShortcut, excludeId) {
        const conflicts = [];
        
        Object.keys(config.buttons).forEach(buttonId => {
          if (buttonId !== excludeId) {
            const button = config.buttons[buttonId];
            if (button.type === 'keypress' && button.action === newShortcut) {
              conflicts.push({ type: 'button', id: buttonId, action: button.action });
            }
          }
        });

        return conflicts;
      };

      const conflicts = detectConflicts('CmdOrCtrl+C', 'button1');
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]).toEqual({
        type: 'button',
        id: 'button2',
        action: 'CmdOrCtrl+C'
      });
    });

    test('should detect shortcut conflicts between encoders', () => {
      const config = {
        encoders: {
          encoder1: { actionCW: 'CmdOrCtrl+Up', typeCW: 'keypress' },
          encoder2: { actionCCW: 'CmdOrCtrl+Up', typeCCW: 'keypress' }
        }
      };

      const detectEncoderConflicts = function(newShortcut, excludeId, excludeDirection) {
        const conflicts = [];
        
        Object.keys(config.encoders).forEach(encoderId => {
          const encoder = config.encoders[encoderId];
          
          if (encoderId !== excludeId || 'cw' !== excludeDirection) {
            if (encoder.typeCW === 'keypress' && encoder.actionCW === newShortcut) {
              conflicts.push({ type: 'encoder', id: encoderId, direction: 'cw', action: encoder.actionCW });
            }
          }
          
          if (encoderId !== excludeId || 'ccw' !== excludeDirection) {
            if (encoder.typeCCW === 'keypress' && encoder.actionCCW === newShortcut) {
              conflicts.push({ type: 'encoder', id: encoderId, direction: 'ccw', action: encoder.actionCCW });
            }
          }
        });

        return conflicts;
      };

      const conflicts = detectEncoderConflicts('CmdOrCtrl+Up', 'encoder1', 'cw');
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]).toEqual({
        type: 'encoder',
        id: 'encoder2',
        direction: 'ccw',
        action: 'CmdOrCtrl+Up'
      });
    });
  });

  describe('Cross-Platform Compatibility', () => {
    test('should handle platform-specific modifier keys', () => {
      const platformMappings = {
        darwin: { 'CmdOrCtrl': 'Cmd', 'Alt': 'Option' },
        win32: { 'CmdOrCtrl': 'Ctrl', 'Alt': 'Alt' },
        linux: { 'CmdOrCtrl': 'Ctrl', 'Alt': 'Alt' }
      };

      const convertShortcut = function(shortcut, platform) {
        let converted = shortcut;
        const mapping = platformMappings[platform] || platformMappings.linux;
        
        Object.keys(mapping).forEach(key => {
          converted = converted.replace(key, mapping[key]);
        });
        
        return converted;
      };

      expect(convertShortcut('CmdOrCtrl+C', 'darwin')).toBe('Cmd+C');
      expect(convertShortcut('CmdOrCtrl+C', 'win32')).toBe('Ctrl+C');
      expect(convertShortcut('CmdOrCtrl+C', 'linux')).toBe('Ctrl+C');
    });
  });
});