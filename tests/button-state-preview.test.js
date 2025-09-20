/**
 * Test file for Button State Preview System
 */

const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');

// Simplified Mock DOM environment
class MockElement {
  constructor() {
    this.style = {};
    this.children = [];
    this.innerHTML = '';
    this.classList = { add: jest.fn(), remove: jest.fn() };
    this.dataset = {};
  }

  querySelector() { return new MockElement(); }
  querySelectorAll() { return [new MockElement()]; }
  addEventListener() {}
  appendChild() {}
  removeChild() {}
  insertBefore() {}
  hasChildNodes() { return false; }
}

// Mock globals
global.document = {
  createElement: () => new MockElement(),
  querySelector: () => new MockElement(),
  querySelectorAll: () => [new MockElement()]
};

global.requestAnimationFrame = jest.fn(cb => setTimeout(cb, 0));
global.console = { log: jest.fn(), warn: jest.fn() };

// Mock ButtonStatePreview
const ButtonStatePreview = require('../src/renderer/ButtonStatePreview.js');

describe('Button State Preview System', () => {
  let preview;
  let mockContainer;
  
  beforeEach(() => {
    mockContainer = new MockElement();
    preview = new ButtonStatePreview(mockContainer, {
      device: { buttons: 4, encoders: 1 },
      buttons: { button1: { type: 'keypress', action: 'CmdOrCtrl+C' } },
      encoders: { encoder1: { typeCW: 'keypress', actionCW: 'AudioVolumeUp' } }
    });
  });

  afterEach(() => {
    if (preview) preview.destroy();
    jest.clearAllMocks();
  });

  test('should initialize with correct state maps', () => {
    expect(preview.buttonStates.size).toBe(4);
    expect(preview.encoderStates.size).toBe(1);
  });

  test('should format button actions correctly', () => {
    const result = preview.formatButtonAction({
      type: 'keypress',
      action: 'CmdOrCtrl+C',
      shortcutDisplay: 'Cmd+C'
    });
    expect(result).toContain('shortcut-display');
    expect(result).toContain('Cmd+C');
  });

  test('should handle button press simulation', () => {
    mockContainer.querySelector = jest.fn(() => new MockElement());
    preview.simulateButtonPress(1);
    
    const state = preview.buttonStates.get('button1');
    expect(state.pressed).toBe(true);
    expect(state.active).toBe(true);
  });

  test('should handle encoder rotation simulation', () => {
    const mockEncoder = new MockElement();
    mockEncoder.querySelector = jest.fn(() => new MockElement());
    mockContainer.querySelector = jest.fn(() => mockEncoder);
    
    preview.simulateEncoderRotation(1, 'CW');
    
    const state = preview.encoderStates.get('encoder1');
    expect(state.direction).toBe('CW');
    expect(state.rotation).toBe(1);
  });

  test('should truncate long text correctly', () => {
    expect(preview.truncateText('short', 10)).toBe('short');
    expect(preview.truncateText('this is very long text', 10)).toBe('this is ve...');
  });

  test('should update configuration correctly', () => {
    const newConfig = { device: { buttons: 8, encoders: 2 } };
    preview.updateConfiguration(newConfig);
    expect(preview.config).toBe(newConfig);
  });

  test('should clean up on destroy', () => {
    preview.destroy();
    expect(preview.buttonStates.size).toBe(0);
    expect(preview.encoderStates.size).toBe(0);
  });
});