/**
 * @jest-environment jsdom
 */

// Mock the ipcRenderer
const mockIpcRenderer = {
  invoke: jest.fn(),
  on: jest.fn(),
  removeAllListeners: jest.fn()
};

// Set up global window object with mocked ipcRenderer
Object.defineProperty(window, 'require', {
  value: jest.fn(() => ({ ipcRenderer: mockIpcRenderer }))
});

global.ipcRenderer = mockIpcRenderer;

// Import LEDManagerUI after setting up mocks
require('../src/renderer/LEDManagerUI');

describe('LEDManagerUI', () => {
  let ledManagerUI;
  let container;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';
    
    // Create container for the UI
    container = document.createElement('div');
    document.body.appendChild(container);
    
    // Reset mock calls
    jest.clearAllMocks();
    
    // Set up default mock responses
    mockIpcRenderer.invoke.mockImplementation((channel, ...args) => {
      switch (channel) {
        case 'get-led-status':
          return Promise.resolve({
            enabled: true,
            buttonCount: 32,
            brightness: 128,
            currentColors: {},
            currentEffect: null
          });
        case 'set-led-brightness':
          return Promise.resolve({ success: true, brightness: args[0] });
        case 'set-led-button-color':
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