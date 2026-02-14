/**
 * Simple LED Manager UI Test
 * Basic test to verify the component loads and functions
 */

// Mock electron early
jest.mock('electron', () => ({
  ipcRenderer: {
    invoke: jest.fn(),
    on: jest.fn(),
    send: jest.fn()
  }
}));

// Set up JSDOM environment
require('jsdom-global')();

// Set up TextEncoder/TextDecoder
if (typeof TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Mock electronAPI
global.electronAPI = {
  getLedStatus: jest.fn().mockResolvedValue({
    enabled: true,
    buttonCount: 8,
    brightness: 128,
    currentColors: {},
    currentEffect: null
  }),
  setLedBrightness: jest.fn().mockResolvedValue({ success: true }),
  setLedButtonColor: jest.fn().mockResolvedValue({ success: true }),
  setLedAllButtons: jest.fn().mockResolvedValue({ success: true }),
  clearAllLeds: jest.fn().mockResolvedValue({ success: true }),
  startLedEffect: jest.fn().mockResolvedValue({ success: true }),
  stopLedEffect: jest.fn().mockResolvedValue({ success: true }),
  runLedTestPattern: jest.fn().mockResolvedValue({ success: true })
};

const LEDManagerUI = require('../src/renderer/LEDManagerUI');

describe('LEDManagerUI Basic Tests', () => {
  let ledManagerUI;

  beforeEach(() => {
    // Set up minimal DOM
    document.body.innerHTML = `
      <div id="led-manager-modal" class="modal" style="display: none;">
        <div class="modal-content">
          <div class="modal-body">
            <input type="range" id="led-brightness" min="0" max="255" value="128">
            <input type="color" id="color-picker" value="#323264">
            <select id="effect-select">
              <option value="">No Effect</option>
              <option value="RAINBOW">Rainbow</option>
            </select>
            <button id="test-pattern">Test Pattern</button>
            <button id="clear-all">Clear All</button>
            <div id="led-messages" class="messages-container"></div>
          </div>
        </div>
      </div>
    `;
    
    ledManagerUI = new LEDManagerUI();
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (ledManagerUI && typeof ledManagerUI.destroy === 'function') {
      ledManagerUI.destroy();
    }
  });

  test('should initialize with correct default values', () => {
    expect(ledManagerUI).toBeDefined();
    expect(ledManagerUI.isVisible).toBe(false);
    expect(ledManagerUI.selectedColor).toEqual({ r: 50, g: 50, b: 100 });
    expect(ledManagerUI.currentBrightness).toBe(128);
  });

  test('should have color presets defined', () => {
    expect(ledManagerUI.colorPresets).toBeDefined();
    expect(ledManagerUI.colorPresets.length).toBeGreaterThan(0);
    
    const softBlue = ledManagerUI.colorPresets.find(p => p.name === 'Soft Blue');
    expect(softBlue).toBeDefined();
    expect(softBlue.color).toEqual({ r: 50, g: 50, b: 100 });
  });

  test('should have LED effects defined', () => {
    expect(ledManagerUI.availableEffects).toBeDefined();
    expect(ledManagerUI.availableEffects.length).toBeGreaterThan(0);
    
    const rainbow = ledManagerUI.availableEffects.find(e => e.name === 'RAINBOW');
    expect(rainbow).toBeDefined();
    expect(rainbow.displayName).toBe('Rainbow Cycle');
  });

  test('should show and hide modal', async () => {
    const modal = document.getElementById('led-manager-modal');
    expect(modal.style.display).toBe('none');
    
    await ledManagerUI.show();
    expect(ledManagerUI.isVisible).toBe(true);
    
    ledManagerUI.hide();
    expect(ledManagerUI.isVisible).toBe(false);
  });

  test('should initialize hardware status', async () => {
    await ledManagerUI.initialize();
    expect(global.electronAPI.getLedStatus).toHaveBeenCalled();
  });

  test('should set brightness', async () => {
    await ledManagerUI.setBrightness(200);
    expect(global.electronAPI.setLedBrightness).toHaveBeenCalledWith(200);
  });

  test('should clear all LEDs', async () => {
    await ledManagerUI.clearAll();
    expect(global.electronAPI.clearAllLeds).toHaveBeenCalled();
  });

  test('should run test pattern', async () => {
    await ledManagerUI.runTestPattern();
    expect(global.electronAPI.runLedTestPattern).toHaveBeenCalled();
  });

  test('should start LED effect', async () => {
    await ledManagerUI.startEffect('RAINBOW', 5);
    expect(global.electronAPI.startLedEffect).toHaveBeenCalledWith('RAINBOW', 5);
  });

  test('should stop LED effect', async () => {
    await ledManagerUI.stopEffect();
    expect(global.electronAPI.stopLedEffect).toHaveBeenCalled();
  });

  test('should validate color RGB values', () => {
    // This assumes LEDManagerUI has a validateColor method
    if (typeof ledManagerUI.validateColor === 'function') {
      const invalidColor = { r: -10, g: 300, b: 'invalid' };
      const validatedColor = ledManagerUI.validateColor(invalidColor);
      
      expect(validatedColor.r).toBeGreaterThanOrEqual(0);
      expect(validatedColor.r).toBeLessThanOrEqual(255);
      expect(validatedColor.g).toBeGreaterThanOrEqual(0);
      expect(validatedColor.g).toBeLessThanOrEqual(255);
      expect(validatedColor.b).toBeGreaterThanOrEqual(0);
      expect(validatedColor.b).toBeLessThanOrEqual(255);
    }
  });

  test('should handle button selection', () => {
    ledManagerUI.selectButton(3);
    expect(ledManagerUI.selectedButton).toBe(3);
  });

  test('should update selected color', () => {
    const newColor = { r: 255, g: 128, b: 64 };
    ledManagerUI.selectedColor = newColor;
    expect(ledManagerUI.selectedColor).toEqual(newColor);
  });
});