/**
 * Comprehensive LEDManagerUI Tests
 * Tests all functionality including UI interactions, hardware communication,
 * color management, effects, and error handling
 */

const LEDManagerUI = require('../src/renderer/LEDManagerUI');

describe('LEDManagerUI', () => {
  let ledManagerUI;

  beforeEach(() => {
    // Set up mock electron API responses
    global.electronAPI = {
      ...global.electronAPI,
      getLedStatus: jest.fn().mockResolvedValue({
        enabled: true,
        buttonCount: 8,
        brightness: 128,
        currentColors: { button1: { r: 50, g: 50, b: 100 } },
        currentEffect: null
      }),
      setLedBrightness: jest.fn().mockResolvedValue({ success: true, brightness: 200 }),
      setLedButtonColor: jest.fn().mockResolvedValue({ success: true, buttonId: 1, color: { r: 255, g: 0, b: 0 } }),
      setLedAllButtons: jest.fn().mockResolvedValue({ success: true, color: { r: 0, g: 255, b: 0 } }),
      clearAllLeds: jest.fn().mockResolvedValue({ success: true }),
      startLedEffect: jest.fn().mockResolvedValue({ success: true, effectName: 'RAINBOW', speed: 5 }),
      stopLedEffect: jest.fn().mockResolvedValue({ success: true }),
      runLedTestPattern: jest.fn().mockResolvedValue({ success: true }),
      saveLedTheme: jest.fn().mockResolvedValue({ success: true }),
      applyLedTheme: jest.fn().mockResolvedValue({ success: true }),
      deleteLedTheme: jest.fn().mockResolvedValue({ success: true })
    };
    
    // Create new instance
    ledManagerUI = new LEDManagerUI();
  });

  afterEach(() => {
    if (ledManagerUI && typeof ledManagerUI.destroy === 'function') {
      ledManagerUI.destroy();
    }
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize with correct default values', () => {
      expect(ledManagerUI).toBeDefined();
      expect(ledManagerUI.isVisible).toBe(false);
      expect(ledManagerUI.selectedButton).toBe(null);
      expect(ledManagerUI.selectedColor).toEqual({ r: 50, g: 50, b: 100 });
      expect(ledManagerUI.currentBrightness).toBe(128);
      expect(ledManagerUI.colorPresets).toBeDefined();
      expect(ledManagerUI.availableEffects).toBeDefined();
    });

    test('should have all required color presets', () => {
      const expectedColors = [
        'Soft Blue', 'Green', 'Orange', 'Red', 'Purple', 'Yellow', 'Cyan', 'White', 'Off'
      ];
      
      expectedColors.forEach(colorName => {
        const preset = ledManagerUI.colorPresets.find(p => p.name === colorName);
        expect(preset).toBeDefined();
        expect(preset.color).toBeDefined();
        expect(preset.color.r).toBeGreaterThanOrEqual(0);
        expect(preset.color.g).toBeGreaterThanOrEqual(0);
        expect(preset.color.b).toBeGreaterThanOrEqual(0);
        expect(preset.color.r).toBeLessThanOrEqual(255);
        expect(preset.color.g).toBeLessThanOrEqual(255);
        expect(preset.color.b).toBeLessThanOrEqual(255);
      });
    });

    test('should have all required LED effects', () => {
      const expectedEffects = ['RAINBOW', 'BREATHE', 'WAVE', 'RIPPLE'];
      
      expectedEffects.forEach(effectName => {
        const effect = ledManagerUI.availableEffects.find(e => e.name === effectName);
        expect(effect).toBeDefined();
        expect(effect.displayName).toBeDefined();
        expect(effect.description).toBeDefined();
      });
    });
  });

  describe('UI Creation and Management', () => {
    test('should create UI container when showing', async () => {
      await ledManagerUI.show();
      
      expect(ledManagerUI.isVisible).toBe(true);
      expect(ledManagerUI.container).toBeDefined();
      
      const modal = document.getElementById('led-manager-modal');
      expect(modal).toBeTruthy();
      expect(modal.style.display).not.toBe('none');
    });

    test('should hide UI when hide is called', async () => {
      await ledManagerUI.show();
      ledManagerUI.hide();
      
      expect(ledManagerUI.isVisible).toBe(false);
      
      const modal = document.getElementById('led-manager-modal');
      if (modal) {
        expect(modal.style.display).toBe('none');
      }
    });

    test('should toggle visibility correctly', async () => {
      expect(ledManagerUI.isVisible).toBe(false);
      
      await ledManagerUI.toggle();
      expect(ledManagerUI.isVisible).toBe(true);
      
      await ledManagerUI.toggle();
      expect(ledManagerUI.isVisible).toBe(false);
    });

    test('should update UI elements when showing', async () => {
      await ledManagerUI.show();
      
      // Check that brightness slider exists and has correct value
      const brightnessSlider = document.getElementById('led-brightness');
      expect(brightnessSlider).toBeTruthy();
      
      // Check that color picker exists
      const colorPicker = document.getElementById('color-picker');
      expect(colorPicker).toBeTruthy();
      
      // Check that effect selector exists
      const effectSelect = document.getElementById('effect-select');
      expect(effectSelect).toBeTruthy();
    });
  });

  describe('Hardware Status Loading', () => {
    test('should load hardware status on initialization', async () => {
      await ledManagerUI.initialize();
      
      expect(global.electronAPI.getLedStatus).toHaveBeenCalled();
      expect(ledManagerUI.currentBrightness).toBe(128);
    });

    test('should handle hardware status loading errors', async () => {
      global.electronAPI.getLedStatus = jest.fn().mockRejectedValue(new Error('Hardware not available'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await ledManagerUI.initialize();
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to load LED status'));
      
      consoleSpy.mockRestore();
    });

    test('should handle disabled hardware gracefully', async () => {
      global.electronAPI.getLedStatus = jest.fn().mockResolvedValue({
        enabled: false,
        buttonCount: 0,
        brightness: 0,
        currentColors: {},
        currentEffect: null
      });

      await ledManagerUI.initialize();
      
      expect(ledManagerUI.currentBrightness).toBe(0);
    });
  });

  describe('Brightness Control', () => {
    test('should update brightness via slider', async () => {
      await ledManagerUI.show();
      
      const brightnessSlider = document.getElementById('led-brightness');
      global.testUtils.fireEvent.change(brightnessSlider, 200);
      
      await ledManagerUI.setBrightness(200);
      
      expect(global.electronAPI.setLedBrightness).toHaveBeenCalledWith(200);
      expect(ledManagerUI.currentBrightness).toBe(200);
    });

    test('should validate brightness range', async () => {
      await ledManagerUI.show();
      
      // Test below minimum
      await ledManagerUI.setBrightness(-10);
      expect(global.electronAPI.setLedBrightness).toHaveBeenCalledWith(0);
      
      // Test above maximum
      await ledManagerUI.setBrightness(300);
      expect(global.electronAPI.setLedBrightness).toHaveBeenCalledWith(255);
      
      // Test valid value
      await ledManagerUI.setBrightness(128);
      expect(global.electronAPI.setLedBrightness).toHaveBeenCalledWith(128);
    });

    test('should handle brightness setting errors', async () => {
      global.electronAPI.setLedBrightness = jest.fn().mockRejectedValue(new Error('Hardware error'));
      
      await ledManagerUI.show();
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await ledManagerUI.setBrightness(200);
      
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    test('should update brightness display value', async () => {
      await ledManagerUI.show();
      
      await ledManagerUI.setBrightness(180);
      
      const brightnessValue = document.getElementById('brightness-value');
      if (brightnessValue) {
        expect(brightnessValue.textContent).toBe('180');
      }
    });
  });

  describe('Color Management', () => {
    test('should set individual button color', async () => {
      await ledManagerUI.show();
      
      const testColor = { r: 255, g: 128, b: 0 };
      await ledManagerUI.setButtonColor(1, testColor);
      
      expect(global.electronAPI.setLedButtonColor).toHaveBeenCalledWith(1, testColor);
    });

    test('should apply color to all buttons', async () => {
      await ledManagerUI.show();
      
      const testColor = { r: 0, g: 255, b: 128 };
      await ledManagerUI.applyColorToAll(testColor);
      
      expect(global.electronAPI.setLedAllButtons).toHaveBeenCalledWith(testColor);
    });

    test('should handle color picker changes', async () => {
      await ledManagerUI.show();
      
      const colorPicker = document.getElementById('color-picker');
      global.testUtils.fireEvent.change(colorPicker, '#ff8000');
      
      expect(ledManagerUI.selectedColor).toEqual({ r: 255, g: 128, b: 0 });
    });

    test('should apply preset colors', async () => {
      await ledManagerUI.show();
      
      const redPreset = ledManagerUI.colorPresets.find(p => p.name === 'Red');
      await ledManagerUI.applyColorPreset(redPreset.color);
      
      expect(ledManagerUI.selectedColor).toEqual(redPreset.color);
    });

    test('should validate RGB color values', async () => {
      await ledManagerUI.show();
      
      // Test invalid color values
      const invalidColor = { r: -10, g: 300, b: 'invalid' };
      const validatedColor = ledManagerUI.validateColor(invalidColor);
      
      expect(validatedColor.r).toBe(0);
      expect(validatedColor.g).toBe(255);
      expect(validatedColor.b).toBe(0);
    });

    test('should convert hex colors to RGB correctly', () => {
      const testCases = [
        { hex: '#ff0000', rgb: { r: 255, g: 0, b: 0 } },
        { hex: '#00ff00', rgb: { r: 0, g: 255, b: 0 } },
        { hex: '#0000ff', rgb: { r: 0, g: 0, b: 255 } },
        { hex: '#ffffff', rgb: { r: 255, g: 255, b: 255 } },
        { hex: '#000000', rgb: { r: 0, g: 0, b: 0 } }
      ];

      testCases.forEach(({ hex, rgb }) => {
        const converted = global.testUtils.parseColorString(hex);
        expect(converted).toEqual(rgb);
      });
    });
  });

  describe('Effect Management', () => {
    test('should start LED effects', async () => {
      await ledManagerUI.show();
      
      await ledManagerUI.startEffect('RAINBOW', 7);
      
      expect(global.electronAPI.startLedEffect).toHaveBeenCalledWith('RAINBOW', 7);
    });

    test('should stop LED effects', async () => {
      await ledManagerUI.show();
      
      await ledManagerUI.stopEffect();
      
      expect(global.electronAPI.stopLedEffect).toHaveBeenCalled();
    });

    test('should handle effect selection from dropdown', async () => {
      await ledManagerUI.show();
      
      const effectSelect = document.getElementById('effect-select');
      global.testUtils.fireEvent.change(effectSelect, 'BREATHE');
      
      const startButton = document.getElementById('start-effect');
      global.testUtils.fireEvent.click(startButton);
      
      expect(global.electronAPI.startLedEffect).toHaveBeenCalledWith('BREATHE', expect.any(Number));
    });

    test('should validate effect parameters', async () => {
      await ledManagerUI.show();
      
      // Test invalid speed values
      await ledManagerUI.startEffect('WAVE', -1);
      expect(global.electronAPI.startLedEffect).toHaveBeenCalledWith('WAVE', 1);
      
      await ledManagerUI.startEffect('WAVE', 20);
      expect(global.electronAPI.startLedEffect).toHaveBeenCalledWith('WAVE', 10);
    });

    test('should handle effect errors gracefully', async () => {
      global.electronAPI.startLedEffect = jest.fn().mockRejectedValue(new Error('Effect not supported'));
      
      await ledManagerUI.show();
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await ledManagerUI.startEffect('INVALID_EFFECT');
      
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Test Patterns', () => {
    test('should run test pattern', async () => {
      await ledManagerUI.show();
      
      await ledManagerUI.runTestPattern();
      
      expect(global.electronAPI.runLedTestPattern).toHaveBeenCalled();
    });

    test('should handle test pattern button click', async () => {
      await ledManagerUI.show();
      
      const testButton = document.getElementById('test-pattern');
      global.testUtils.fireEvent.click(testButton);
      
      expect(global.electronAPI.runLedTestPattern).toHaveBeenCalled();
    });

    test('should show feedback during test pattern', async () => {
      global.electronAPI.runLedTestPattern = jest.fn(() => 
        new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
      );

      await ledManagerUI.show();
      
      const testPromise = ledManagerUI.runTestPattern();
      
      // Should show loading state
      const testButton = document.getElementById('test-pattern');
      expect(testButton.disabled).toBe(true);
      
      await testPromise;
      
      expect(testButton.disabled).toBe(false);
    });
  });

  describe('Clear All Functionality', () => {
    test('should clear all LEDs', async () => {
      await ledManagerUI.show();
      
      await ledManagerUI.clearAll();
      
      expect(global.electronAPI.clearAllLeds).toHaveBeenCalled();
    });

    test('should handle clear all button click', async () => {
      await ledManagerUI.show();
      
      const clearButton = document.getElementById('clear-all');
      global.testUtils.fireEvent.click(clearButton);
      
      expect(global.electronAPI.clearAllLeds).toHaveBeenCalled();
    });

    test('should handle clear all errors', async () => {
      global.electronAPI.clearAllLeds = jest.fn().mockRejectedValue(new Error('Hardware communication failed'));
      
      await ledManagerUI.show();
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await ledManagerUI.clearAll();
      
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('keyboard shortcuts', () => {
    test('should handle spacebar for test pattern', async () => {
      await ledManagerUI.show();
      
      // Focus the modal
      const modal = document.getElementById('led-manager-modal');
      modal.focus();
      
      global.testUtils.fireEvent.keyDown(document, 'Space');
      
      expect(global.electronAPI.runLedTestPattern).toHaveBeenCalled();
    });

    test('should handle Escape key to close modal', async () => {
      await ledManagerUI.show();
      expect(ledManagerUI.isVisible).toBe(true);
      
      global.testUtils.fireEvent.keyDown(document, 'Escape');
      
      expect(ledManagerUI.isVisible).toBe(false);
    });

    test('should handle number keys for button selection', async () => {
      await ledManagerUI.show();
      
      global.testUtils.fireEvent.keyDown(document, '3');
      
      expect(ledManagerUI.selectedButton).toBe(3);
    });

    test('should handle 'C' key for clear all', async () => {
      await ledManagerUI.show();
      
      global.testUtils.fireEvent.keyDown(document, 'c');
      
      expect(global.electronAPI.clearAllLeds).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    test('should handle LED system unavailable', async () => {
      global.electronAPI.getLedStatus = jest.fn().mockRejectedValue(new Error('LED system not available'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await ledManagerUI.initialize();
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to load LED status'));
      
      consoleSpy.mockRestore();
    });

    test('should handle IPC communication errors', async () => {
      global.electronAPI.setLedBrightness = jest.fn().mockRejectedValue(new Error('IPC communication failed'));
      
      await ledManagerUI.show();
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await ledManagerUI.setBrightness(200);
      
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    test('should recover from temporary errors', async () => {
      // First call fails, second succeeds
      global.electronAPI.setLedBrightness = jest.fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValue({ success: true });
      
      await ledManagerUI.show();
      
      // First attempt should fail
      await ledManagerUI.setBrightness(200);
      
      // Second attempt should succeed
      await ledManagerUI.setBrightness(200);
      
      expect(global.electronAPI.setLedBrightness).toHaveBeenCalledTimes(2);
    });

    test('should show error messages to user', async () => {
      global.electronAPI.startLedEffect = jest.fn().mockRejectedValue(new Error('Effect failed'));
      
      await ledManagerUI.show();
      
      await ledManagerUI.startEffect('RAINBOW');
      
      // Should show error message in UI
      const errorMessage = document.querySelector('.message-error');
      expect(errorMessage).toBeTruthy();
    });
  });

  describe('UI state management', () => {
    test('should maintain state when hiding and showing', async () => {
      await ledManagerUI.show();
      
      ledManagerUI.selectButton(5);
      ledManagerUI.selectedColor = { r: 100, g: 150, b: 200 };
      
      ledManagerUI.hide();
      
      await ledManagerUI.show();
      
      expect(ledManagerUI.selectedButton).toBe(5);
      expect(ledManagerUI.selectedColor).toEqual({ r: 100, g: 150, b: 200 });
    });

    test('should update UI when hardware status changes', async () => {
      await ledManagerUI.show();
      
      // Simulate hardware status change
      const newStatus = {
        enabled: true,
        buttonCount: 16,
        brightness: 200,
        currentColors: {},
        currentEffect: 'RAINBOW'
      };
      
      global.electronAPI.getLedStatus = jest.fn().mockResolvedValue(newStatus);
      
      await ledManagerUI.updateHardwareStatus();
      
      expect(ledManagerUI.currentBrightness).toBe(200);
    });
  });
});
          return Promise.resolve({ success: true, buttonId: args[0], color: args[1] });
        case 'set-led-all-buttons':
          return Promise.resolve({ success: true, color: args[0] });
        case 'clear-all-leds':
          return Promise.resolve({ success: true });
        case 'start-led-effect':
          return Promise.resolve({ success: true, effectName: args[0], speed: args[1] });
        case 'stop-led-effect':
          return Promise.resolve({ success: true });
        case 'run-led-test-pattern':
          return Promise.resolve({ success: true });
        default:
          return Promise.resolve({ success: true });
      }
    });
    
    // Create new instance
    ledManagerUI = new LEDManagerUI();
  });

  afterEach(() => {
    if (ledManagerUI && ledManagerUI.isVisible()) {
      ledManagerUI.hide();
    }
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    test('should create LED manager UI element', () => {
      expect(ledManagerUI.ledManagerElement).toBeDefined();
      expect(ledManagerUI.ledManagerElement.classList.contains('led-manager-overlay')).toBe(true);
    });

    test('should initialize with default state', () => {
      expect(ledManagerUI.currentBrightness).toBe(128);
      expect(ledManagerUI.selectedColor).toEqual({ r: 255, g: 255, b: 255 });
      expect(ledManagerUI.buttonColors).toEqual({});
      expect(ledManagerUI.currentEffect).toBeNull();
    });

    test('should set up event listeners', () => {
      expect(mockIpcRenderer.on).toHaveBeenCalled();
    });
  });

  describe('visibility control', () => {
    test('should show LED manager', async () => {
      await ledManagerUI.show();
      
      expect(ledManagerUI.isVisible()).toBe(true);
      expect(document.body.contains(ledManagerUI.ledManagerElement)).toBe(true);
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('get-led-status');
    });

    test('should hide LED manager', () => {
      ledManagerUI.show();
      ledManagerUI.hide();
      
      expect(ledManagerUI.isVisible()).toBe(false);
      expect(ledManagerUI.ledManagerElement.style.display).toBe('none');
    });

    test('should handle ESC key to close', async () => {
      await ledManagerUI.show();
      
      const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escEvent);
      
      expect(ledManagerUI.isVisible()).toBe(false);
    });
  });

  describe('brightness control', () => {
    test('should update brightness slider', async () => {
      await ledManagerUI.show();
      
      const brightnessSlider = ledManagerUI.ledManagerElement.querySelector('#led-brightness-slider');
      brightnessSlider.value = '200';
      brightnessSlider.dispatchEvent(new Event('input'));
      
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('set-led-brightness', 200);
    });

    test('should update brightness display value', async () => {
      await ledManagerUI.show();
      
      ledManagerUI.updateBrightness(180);
      
      const brightnessValue = ledManagerUI.ledManagerElement.querySelector('#led-brightness-value');
      expect(brightnessValue.textContent).toBe('180');
      
      const brightnessSlider = ledManagerUI.ledManagerElement.querySelector('#led-brightness-slider');
      expect(brightnessSlider.value).toBe('180');
    });
  });

  describe('color picker functionality', () => {
    test('should update selected color from color picker', async () => {
      await ledManagerUI.show();
      
      const colorPicker = ledManagerUI.ledManagerElement.querySelector('#led-color-picker');
      colorPicker.value = '#ff8000';
      colorPicker.dispatchEvent(new Event('input'));
      
      expect(ledManagerUI.selectedColor).toEqual({ r: 255, g: 128, b: 0 });
    });

    test('should update RGB input fields', async () => {
      await ledManagerUI.show();
      
      const redInput = ledManagerUI.ledManagerElement.querySelector('#led-color-r');
      redInput.value = '200';
      redInput.dispatchEvent(new Event('input'));
      
      expect(ledManagerUI.selectedColor.r).toBe(200);
    });

    test('should apply color preset', async () => {
      await ledManagerUI.show();
      
      const redPreset = ledManagerUI.ledManagerElement.querySelector('[data-color="#FF0000"]');
      redPreset.click();
      
      expect(ledManagerUI.selectedColor).toEqual({ r: 255, g: 0, b: 0 });
    });
  });

  describe('button grid interaction', () => {
    test('should create button grid based on button count', async () => {
      mockIpcRenderer.invoke.mockResolvedValueOnce({
        enabled: true,
        buttonCount: 16,
        brightness: 128,
        currentColors: {},
        currentEffect: null
      });
      
      await ledManagerUI.show();
      
      const buttons = ledManagerUI.ledManagerElement.querySelectorAll('.led-button');
      expect(buttons).toHaveLength(16);
    });

    test('should handle button click to set color', async () => {
      await ledManagerUI.show();
      
      ledManagerUI.selectedColor = { r: 0, g: 255, b: 0 };
      
      const button = ledManagerUI.ledManagerElement.querySelector('[data-button-id="5"]');
      button.click();
      
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('set-led-button-color', 5, { r: 0, g: 255, b: 0 });
    });

    test('should update button visual color', async () => {
      await ledManagerUI.show();
      
      await ledManagerUI.updateButtonColor(3, { r: 255, g: 0, b: 128 });
      
      const button = ledManagerUI.ledManagerElement.querySelector('[data-button-id="3"]');
      expect(button.style.backgroundColor).toBe('rgb(255, 0, 128)');
    });

    test('should select/deselect buttons', async () => {
      await ledManagerUI.show();
      
      const button = ledManagerUI.ledManagerElement.querySelector('[data-button-id="1"]');
      
      // First click should select
      button.dispatchEvent(new MouseEvent('click', { ctrlKey: true }));
      expect(button.classList.contains('selected')).toBe(true);
      
      // Second click should deselect
      button.dispatchEvent(new MouseEvent('click', { ctrlKey: true }));
      expect(button.classList.contains('selected')).toBe(false);
    });
  });

  describe('LED effects control', () => {
    test('should start LED effect', async () => {
      await ledManagerUI.show();
      
      const effectSelect = ledManagerUI.ledManagerElement.querySelector('#led-effect-select');
      effectSelect.value = 'RAINBOW';
      effectSelect.dispatchEvent(new Event('change'));
      
      const startButton = ledManagerUI.ledManagerElement.querySelector('#start-effect-btn');
      startButton.click();
      
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('start-led-effect', 'RAINBOW', 5);
    });

    test('should stop LED effect', async () => {
      await ledManagerUI.show();
      
      const stopButton = ledManagerUI.ledManagerElement.querySelector('#stop-effect-btn');
      stopButton.click();
      
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('stop-led-effect');
    });

    test('should update effect speed', async () => {
      await ledManagerUI.show();
      
      const speedSlider = ledManagerUI.ledManagerElement.querySelector('#led-effect-speed');
      speedSlider.value = '8';
      speedSlider.dispatchEvent(new Event('input'));
      
      // Speed should be updated but not applied until effect is started
      const effectSelect = ledManagerUI.ledManagerElement.querySelector('#led-effect-select');
      effectSelect.value = 'BREATHE';
      
      const startButton = ledManagerUI.ledManagerElement.querySelector('#start-effect-btn');
      startButton.click();
      
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('start-led-effect', 'BREATHE', 8);
    });
  });

  describe('quick controls', () => {
    test('should set all buttons to selected color', async () => {
      await ledManagerUI.show();
      
      ledManagerUI.selectedColor = { r: 255, g: 255, b: 0 };
      
      const setAllButton = ledManagerUI.ledManagerElement.querySelector('#set-all-btn');
      setAllButton.click();
      
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('set-led-all-buttons', { r: 255, g: 255, b: 0 });
    });

    test('should clear all LEDs', async () => {
      await ledManagerUI.show();
      
      const clearAllButton = ledManagerUI.ledManagerElement.querySelector('#clear-all-btn');
      clearAllButton.click();
      
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('clear-all-leds');
    });

    test('should run test pattern', async () => {
      await ledManagerUI.show();
      
      const testButton = ledManagerUI.ledManagerElement.querySelector('#test-pattern-btn');
      testButton.click();
      
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('run-led-test-pattern');
    });
  });

  describe('profile theme management', () => {
    test('should load profile themes into select', async () => {
      const mockProfiles = {
        'profile1': { name: 'Gaming Profile', ledTheme: { name: 'Gaming Theme' } },
        'profile2': { name: 'Work Profile' }
      };
      
      mockIpcRenderer.invoke.mockImplementation((channel) => {
        if (channel === 'get-profiles') {
          return Promise.resolve(mockProfiles);
        }
        return Promise.resolve({ success: true });
      });
      
      await ledManagerUI.show();
      await ledManagerUI.loadProfileThemes();
      
      const profileSelect = ledManagerUI.ledManagerElement.querySelector('#profile-theme-select');
      const options = profileSelect.querySelectorAll('option');
      expect(options).toHaveLength(3); // Including default option
    });

    test('should save current settings as profile theme', async () => {
      await ledManagerUI.show();
      
      const profileSelect = ledManagerUI.ledManagerElement.querySelector('#profile-theme-select');
      profileSelect.value = 'profile1';
      
      const saveButton = ledManagerUI.ledManagerElement.querySelector('#save-theme-btn');
      saveButton.click();
      
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('save-led-theme', 'profile1', expect.objectContaining({
        name: expect.any(String),
        buttonColors: expect.any(Object),
        brightness: expect.any(Number)
      }));
    });

    test('should apply profile theme', async () => {
      await ledManagerUI.show();
      
      const profileSelect = ledManagerUI.ledManagerElement.querySelector('#profile-theme-select');
      profileSelect.value = 'profile1';
      
      const applyButton = ledManagerUI.ledManagerElement.querySelector('#apply-theme-btn');
      applyButton.click();
      
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('apply-led-theme', 'profile1');
    });
  });

  describe('keyboard shortcuts', () => {
    test('should handle number key shortcuts for color presets', async () => {
      await ledManagerUI.show();
      
      const keyEvent = new KeyboardEvent('keydown', { key: '1' });
      document.dispatchEvent(keyEvent);
      
      // Should apply red color (first preset)
      expect(ledManagerUI.selectedColor).toEqual({ r: 255, g: 0, b: 0 });
    });

    test('should handle spacebar for test pattern', async () => {
      await ledManagerUI.show();
      
      const keyEvent = new KeyboardEvent('keydown', { key: ' ' });
      document.dispatchEvent(keyEvent);
      
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('run-led-test-pattern');
    });
  });

  describe('error handling', () => {
    test('should handle LED system unavailable', async () => {
      mockIpcRenderer.invoke.mockRejectedValueOnce(new Error('LED system not available'));
      
      await ledManagerUI.show();
      
      const errorElement = ledManagerUI.ledManagerElement.querySelector('.error-message');
      expect(errorElement.textContent).toContain('LED system not available');
    });

    test('should handle IPC communication errors', async () => {
      await ledManagerUI.show();
      
      mockIpcRenderer.invoke.mockRejectedValueOnce(new Error('Communication error'));
      
      const brightnessSlider = ledManagerUI.ledManagerElement.querySelector('#led-brightness-slider');
      brightnessSlider.value = '200';
      brightnessSlider.dispatchEvent(new Event('input'));
      
      // Should show error message
      const errorElement = ledManagerUI.ledManagerElement.querySelector('.error-message');
      expect(errorElement).toBeTruthy();
    });

    test('should recover from temporary errors', async () => {
      await ledManagerUI.show();
      
      // First call fails, second succeeds
      mockIpcRenderer.invoke
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce({ success: true });
      
      const testButton = ledManagerUI.ledManagerElement.querySelector('#test-pattern-btn');
      testButton.click();
      
      // Should retry and succeed
      setTimeout(() => {
        testButton.click();
        expect(mockIpcRenderer.invoke).toHaveBeenCalledTimes(3); // Initial status + 2 test calls
      }, 100);
    });
  });

  describe('UI state management', () => {
    test('should maintain state when hiding and showing', async () => {
      await ledManagerUI.show();
      
      ledManagerUI.selectedColor = { r: 100, g: 150, b: 200 };
      ledManagerUI.currentBrightness = 180;
      
      ledManagerUI.hide();
      await ledManagerUI.show();
      
      expect(ledManagerUI.selectedColor).toEqual({ r: 100, g: 150, b: 200 });
      expect(ledManagerUI.currentBrightness).toBe(180);
    });

    test('should update UI when hardware status changes', () => {
      const statusUpdate = {
        enabled: true,
        buttonCount: 24,
        brightness: 200,
        currentColors: { 1: { r: 255, g: 0, b: 0 } },
        currentEffect: { name: 'RAINBOW', speed: 7 }
      };
      
      ledManagerUI.updateUIFromStatus(statusUpdate);
      
      expect(ledManagerUI.currentBrightness).toBe(200);
      expect(ledManagerUI.buttonColors[1]).toEqual({ r: 255, g: 0, b: 0 });
      expect(ledManagerUI.currentEffect).toEqual({ name: 'RAINBOW', speed: 7 });
    });
  });
});