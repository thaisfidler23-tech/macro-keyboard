const LEDController = require('../src/LEDController');
const EventEmitter = require('events');

describe('LEDController', () => {
  let ledController;
  let mockSerialManager;
  let mockLogger;

  beforeEach(() => {
    mockSerialManager = new EventEmitter();
    mockSerialManager.writeCommand = jest.fn().mockResolvedValue();
    mockSerialManager.write = jest.fn(); // Add write method
    mockSerialManager.isConnected = jest.fn().mockReturnValue(true);
    
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };

    ledController = new LEDController(mockSerialManager, mockLogger);
    // Enable the LED system for testing
    ledController.isEnabled = true;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    test('should initialize with default values', () => {
      expect(ledController.isEnabled).toBe(true); // Enabled during setup
      expect(ledController.brightness).toBe(128);
      expect(ledController.currentEffect).toBeNull();
      expect(ledController.currentColors.size).toBe(0);
    });

    test('should set up event listeners', () => {
      const listenerCount = mockSerialManager.listenerCount('data');
      expect(listenerCount).toBeGreaterThan(0);
    });
  });

  describe('hardware communication', () => {
    test('should send LED command correctly', async () => {
      await ledController.sendCommand('LED:TEST:1:2:3\\n');
      
      expect(mockSerialManager.write).toHaveBeenCalledWith('LED:TEST:1:2:3\\n');
    });

    test('should handle serial command errors', async () => {
      mockSerialManager.write.mockImplementationOnce(() => {
        throw new Error('Serial error');
      });
      
      await expect(ledController.sendCommand('LED:TEST\\n')).rejects.toThrow();
    });

    test('should not send commands when serial is disconnected', async () => {
      mockSerialManager.isConnected.mockReturnValue(false);
      
      await expect(ledController.sendCommand('LED:TEST\\n')).rejects.toThrow('Serial connection not available');
    });
  });

  describe('brightness control', () => {
    test('should set brightness within valid range', async () => {
      // Mock the write method to prevent actual serial communication
      mockSerialManager.write = jest.fn();
      
      await ledController.setBrightness(200);
      
      expect(ledController.brightness).toBe(200);
      expect(mockSerialManager.write).toHaveBeenCalledWith('LED:BRIGHTNESS:200\\n');
    });

    test('should clamp brightness to valid range', async () => {
      mockSerialManager.write = jest.fn();
      
      await expect(ledController.setBrightness(300)).rejects.toThrow('Brightness must be between 0 and 255');
      await expect(ledController.setBrightness(-50)).rejects.toThrow('Brightness must be between 0 and 255');
    });

    test('should emit brightness change event', async () => {
      mockSerialManager.write = jest.fn();
      const brightnessSpy = jest.fn();
      ledController.on('brightness-changed', brightnessSpy);
      
      await ledController.setBrightness(150);
      
      expect(brightnessSpy).toHaveBeenCalledWith(150);
    });
  });

  describe('button color control', () => {
    test('should set individual button color', async () => {
      mockSerialManager.write = jest.fn();
      const color = { r: 255, g: 0, b: 128 };
      await ledController.setButtonColor(5, color);
      
      expect(ledController.currentColors.get(5)).toEqual(color);
      expect(mockSerialManager.write).toHaveBeenCalledWith('LED:5:255:0:128\\n');
    });

    test('should validate color values', async () => {
      mockSerialManager.write = jest.fn();
      const color = { r: 300, g: -50, b: 128 };
      await ledController.setButtonColor(1, color);
      
      expect(ledController.currentColors.get(1)).toEqual({ r: 255, g: 0, b: 128 });
    });

    test('should set all buttons to same color', async () => {
      mockSerialManager.write = jest.fn();
      const color = { r: 0, g: 255, b: 0 };
      await ledController.setAllButtons(color);
      
      expect(mockSerialManager.write).toHaveBeenCalledWith('LED:ALL:0:255:0\\n');
    });

    test('should clear all LEDs', async () => {
      mockSerialManager.write = jest.fn();
      
      await ledController.clearAll();
      
      expect(mockSerialManager.write).toHaveBeenCalledWith('LED:CLEAR\\n');
      expect(ledController.currentColors.size).toBe(0);
    });
  });

  describe('LED effects', () => {
    test('should start rainbow effect', async () => {
      mockSerialManager.write = jest.fn();
      
      await ledController.startEffect('RAINBOW', 5);
      
      expect(ledController.currentEffect).toEqual({ name: 'RAINBOW', speed: 5 });
      expect(mockSerialManager.write).toHaveBeenCalledWith('LED:EFFECT:RAINBOW:5\\n');
    });

    test('should start breathe effect with default speed', async () => {
      mockSerialManager.write = jest.fn();
      
      await ledController.startEffect('BREATHE');
      
      expect(ledController.currentEffect).toEqual({ name: 'BREATHE', speed: 5 });
    });

    test('should stop current effect', async () => {
      mockSerialManager.write = jest.fn();
      
      await ledController.startEffect('WAVE', 8);
      await ledController.stopEffect();
      
      expect(ledController.currentEffect).toBeNull();
    });

    test('should validate effect names', async () => {
      await expect(ledController.startEffect('INVALID_EFFECT'))
        .rejects.toThrow('Invalid effect: INVALID_EFFECT');
    });
  });

  describe('profile theme management', () => {
    test('should apply profile theme', async () => {
      mockSerialManager.write = jest.fn();
      const theme = {
        name: 'Test Theme',
        buttonColors: { 1: { r: 255, g: 0, b: 0 } },
        effect: { name: 'BREATHE', speed: 3 }
      };
      
      await ledController.applyProfileTheme('profile1', theme);
      
      expect(ledController.profileThemes.get('profile1')).toEqual(theme);
      expect(ledController.currentColors.get(1)).toEqual({ r: 255, g: 0, b: 0 });
      expect(ledController.currentEffect).toEqual({ name: 'BREATHE', speed: 3 });
    });

    test('should handle profile theme application', async () => {
      mockSerialManager.write = jest.fn();
      const theme = {
        name: 'Test Theme',
        allButtons: { r: 0, g: 255, b: 0 }
      };
      
      await ledController.applyProfileTheme('profile2', theme);
      
      expect(ledController.profileThemes.get('profile2')).toEqual(theme);
    });
  });

  describe('hardware feedback processing', () => {
    test('should handle LED responses', () => {
      mockSerialManager.emit('data', 'LED:BRIGHTNESS:150');
      
      expect(ledController.brightness).toBe(150);
    });

    test('should handle LED effect responses', () => {
      mockSerialManager.emit('data', 'LED:EFFECT:RAINBOW:7');
      
      expect(ledController.currentEffect).toEqual({ name: 'RAINBOW', speed: 7 });
    });

    test('should handle hardware errors', () => {
      const errorSpy = jest.fn();
      ledController.on('error', errorSpy);
      
      mockSerialManager.emit('data', 'LED:ERROR:BRIGHTNESS_FAIL:Invalid brightness value');
      
      expect(errorSpy).toHaveBeenCalledWith({
        message: 'LED command failed',
        error: 'BRIGHTNESS_FAIL:Invalid brightness value'
      });
    });
  });

  describe('state management', () => {
    test('should return current state', () => {
      ledController.brightness = 150;
      ledController.currentColors.set(1, { r: 255, g: 0, b: 0 });
      ledController.currentEffect = { name: 'BREATHE', speed: 5 };
      
      const state = ledController.getState();
      
      expect(state).toEqual({
        enabled: true,
        buttonCount: 8,
        brightness: 150,
        currentColors: { 1: { r: 255, g: 0, b: 0 } },
        currentEffect: { name: 'BREATHE', speed: 5 },
        availableEffects: ['RAINBOW', 'BREATHE', 'WAVE', 'RIPPLE'],
        profileThemes: {}
      });
    });

    test('should handle disconnection cleanup', () => {
      ledController.brightness = 200;
      ledController.currentColors.set(1, { r: 255, g: 0, b: 0 });
      ledController.currentEffect = { name: 'RAINBOW', speed: 5 };
      
      ledController.handleDisconnect();
      
      expect(ledController.isEnabled).toBe(false);
      expect(ledController.currentColors.size).toBe(0);
      expect(ledController.currentEffect).toBeNull();
    });
  });

  describe('color utilities', () => {
    test('should validate and clamp color values', () => {
      const color = ledController.validateColor({ r: 300, g: -50, b: 128 });
      
      expect(color).toEqual({ r: 255, g: 0, b: 128 });
    });

    test('should convert hex colors to RGB', () => {
      const color = LEDController.fromHex('#FF8000');
      
      expect(color).toEqual({ r: 255, g: 128, b: 0 });
    });

    test('should convert RGB to hex', () => {
      const hex = LEDController.toHex({ r: 255, g: 128, b: 0 });
      
      expect(hex).toBe('#ff8000');
    });

    test('should handle invalid hex colors', () => {
      const color = LEDController.fromHex('invalid');
      
      expect(color.r).toBe(0);
      expect(color.g).toBe(0);
      expect(color.b).toBe(0);
    });
  });

  describe('error handling', () => {
    test('should handle serial disconnection gracefully', async () => {
      mockSerialManager.isConnected.mockReturnValue(false);
      
      await expect(ledController.setButtonColor(1, { r: 255, g: 0, b: 0 }))
        .rejects.toThrow('LED system not available');
    });

    test('should emit error events for hardware failures', () => {
      const errorSpy = jest.fn();
      ledController.on('error', errorSpy);
      
      mockSerialManager.emit('data', 'LED:ERROR:HARDWARE_FAULT:LED strip disconnected');
      
      expect(errorSpy).toHaveBeenCalledWith({
        message: 'LED command failed',
        error: 'HARDWARE_FAULT:LED strip disconnected'
      });
    });

    test('should continue operation after recoverable errors', async () => {
      mockSerialManager.write = jest.fn()
        .mockImplementationOnce(() => {
          throw new Error('Temporary error');
        })
        .mockImplementation(() => {});
      
      // First call should fail
      await expect(ledController.setBrightness(150)).rejects.toThrow('Temporary error');
      
      // Second call should succeed
      await expect(ledController.setBrightness(150)).resolves.toBeUndefined();
    });
  });
});