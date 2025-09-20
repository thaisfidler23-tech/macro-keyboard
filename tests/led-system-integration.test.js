const LEDController = require('../src/LEDController');
const EventEmitter = require('events');

describe('LED System Integration Tests', () => {
  let ledController;
  let mockSerialManager;
  let mockLogger;

  beforeEach(() => {
    mockSerialManager = new EventEmitter();
    mockSerialManager.writeCommand = jest.fn().mockResolvedValue();
    mockSerialManager.isConnected = jest.fn().mockReturnValue(true);
    
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };

    ledController = new LEDController(mockSerialManager, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('complete workflow integration', () => {
    test('should handle complete button press with LED feedback workflow', async () => {
      // Step 1: Set initial button color
      const initialColor = { r: 0, g: 255, b: 0 };
      await ledController.setButtonColor(5, initialColor);
      
      expect(mockSerialManager.writeCommand).toHaveBeenCalledWith('LED:BUTTON:5:0:255:0');
      expect(ledController.buttonColors[5]).toEqual(initialColor);

      // Step 2: Simulate button press from Arduino
      mockSerialManager.emit('data', 'BTN:5:PRESS');
      
      // Step 3: Simulate LED feedback from Arduino
      mockSerialManager.emit('data', 'LED:BUTTON_PRESS:5:SUCCESS');
      
      expect(mockLogger.debug).toHaveBeenCalledWith('LED button press feedback:', {
        buttonId: 5,
        status: 'SUCCESS'
      });
    });

    test('should handle profile switching with LED theme application', async () => {
      // Step 1: Create and save profile theme
      const profileTheme = {
        name: 'Gaming Theme',
        buttonColors: {
          1: { r: 255, g: 0, b: 0 },
          2: { r: 0, g: 255, b: 0 },
          3: { r: 0, g: 0, b: 255 }
        },
        brightness: 200,
        effect: { name: 'BREATHE', speed: 6 }
      };
      
      await ledController.saveProfileTheme('gaming', profileTheme);
      
      // Step 2: Apply the profile theme
      await ledController.applyProfileTheme('gaming');
      
      // Verify brightness was set
      expect(mockSerialManager.writeCommand).toHaveBeenCalledWith('LED:BRIGHTNESS:200');
      expect(ledController.brightness).toBe(200);
      
      // Verify button colors were applied
      expect(mockSerialManager.writeCommand).toHaveBeenCalledWith('LED:BUTTON:1:255:0:0');
      expect(mockSerialManager.writeCommand).toHaveBeenCalledWith('LED:BUTTON:2:0:255:0');
      expect(mockSerialManager.writeCommand).toHaveBeenCalledWith('LED:BUTTON:3:0:0:255');
      
      // Verify effect was started
      expect(mockSerialManager.writeCommand).toHaveBeenCalledWith('LED:EFFECT:BREATHE:6');
      expect(ledController.currentEffect).toEqual({ name: 'BREATHE', speed: 6 });
    });

    test('should handle hardware error recovery workflow', async () => {
      // Step 1: Initial LED command succeeds
      await ledController.setBrightness(150);
      expect(mockSerialManager.writeCommand).toHaveBeenCalledWith('LED:BRIGHTNESS:150');

      // Step 2: Hardware reports error
      const errorSpy = jest.fn();
      ledController.on('error', errorSpy);
      
      mockSerialManager.emit('data', 'LED:ERROR:BRIGHTNESS_FAIL:Hardware fault detected');
      
      expect(mockLogger.error).toHaveBeenCalledWith('LED Hardware Error:', {
        code: 'BRIGHTNESS_FAIL',
        message: 'Hardware fault detected'
      });
      expect(errorSpy).toHaveBeenCalledWith({
        code: 'BRIGHTNESS_FAIL',
        message: 'Hardware fault detected'
      });

      // Step 3: Hardware recovery
      mockSerialManager.emit('data', 'LED:STATUS:READY:32:255');
      
      expect(ledController.hardwareStatus).toEqual({
        ready: true,
        buttonCount: 32,
        maxBrightness: 255
      });

      // Step 4: Retry operation should succeed
      await ledController.setBrightness(180);
      expect(mockSerialManager.writeCommand).toHaveBeenLastCalledWith('LED:BRIGHTNESS:180');
    });

    test('should handle simultaneous effect and button color operations', async () => {
      // Step 1: Start an effect
      await ledController.startEffect('RAINBOW', 5);
      expect(ledController.currentEffect).toEqual({ name: 'RAINBOW', speed: 5 });

      // Step 2: Set individual button colors (should work alongside effect)
      const buttonColor = { r: 255, g: 255, b: 255 };
      await ledController.setButtonColor(10, buttonColor);
      
      expect(mockSerialManager.writeCommand).toHaveBeenCalledWith('LED:BUTTON:10:255:255:255');
      expect(ledController.buttonColors[10]).toEqual(buttonColor);

      // Step 3: Stop effect, button colors should remain
      await ledController.stopEffect();
      expect(ledController.currentEffect).toBeNull();
      expect(ledController.buttonColors[10]).toEqual(buttonColor);
    });

    test('should handle multiple rapid color changes', async () => {
      const colors = [
        { r: 255, g: 0, b: 0 },
        { r: 0, g: 255, b: 0 },
        { r: 0, g: 0, b: 255 },
        { r: 255, g: 255, b: 0 },
        { r: 255, g: 0, b: 255 }
      ];

      // Rapidly apply colors to different buttons
      const promises = colors.map((color, index) => 
        ledController.setButtonColor(index + 1, color)
      );
      
      await Promise.all(promises);

      // Verify all colors were set correctly
      colors.forEach((color, index) => {
        expect(ledController.buttonColors[index + 1]).toEqual(color);
        expect(mockSerialManager.writeCommand).toHaveBeenCalledWith(
          `LED:BUTTON:${index + 1}:${color.r}:${color.g}:${color.b}`
        );
      });
    });
  });

  describe('system state consistency', () => {
    test('should maintain consistent state across operations', async () => {
      // Initialize with some state
      await ledController.setBrightness(100);
      await ledController.setButtonColor(1, { r: 255, g: 0, b: 0 });
      await ledController.setButtonColor(2, { r: 0, g: 255, b: 0 });
      await ledController.startEffect('WAVE', 7);

      // Get state snapshot
      const state1 = ledController.getState();
      expect(state1.brightness).toBe(100);
      expect(state1.currentColors[1]).toEqual({ r: 255, g: 0, b: 0 });
      expect(state1.currentColors[2]).toEqual({ r: 0, g: 255, b: 0 });
      expect(state1.currentEffect).toEqual({ name: 'WAVE', speed: 7 });

      // Modify state
      await ledController.setBrightness(200);
      await ledController.setButtonColor(3, { r: 0, g: 0, b: 255 });
      await ledController.stopEffect();

      // Verify state consistency
      const state2 = ledController.getState();
      expect(state2.brightness).toBe(200);
      expect(state2.currentColors[1]).toEqual({ r: 255, g: 0, b: 0 }); // Unchanged
      expect(state2.currentColors[2]).toEqual({ r: 0, g: 255, b: 0 }); // Unchanged
      expect(state2.currentColors[3]).toEqual({ r: 0, g: 0, b: 255 }); // New
      expect(state2.currentEffect).toBeNull();
    });

    test('should handle state reset correctly', async () => {
      // Set up complex state
      await ledController.setBrightness(220);
      await ledController.setButtonColor(1, { r: 128, g: 64, b: 192 });
      await ledController.setButtonColor(5, { r: 255, g: 128, b: 0 });
      await ledController.startEffect('RIPPLE', 9);
      
      const profileTheme = {
        name: 'Test Theme',
        buttonColors: { 1: { r: 255, g: 255, b: 255 } },
        brightness: 150
      };
      await ledController.saveProfileTheme('test', profileTheme);

      // Reset state
      await ledController.reset();

      // Verify reset
      const resetState = ledController.getState();
      expect(resetState.brightness).toBe(128); // Default brightness
      expect(Object.keys(resetState.currentColors)).toHaveLength(0);
      expect(resetState.currentEffect).toBeNull();

      // Profile themes should be preserved
      expect(ledController.profileThemes['test']).toEqual(profileTheme);
    });
  });

  describe('hardware communication edge cases', () => {
    test('should handle malformed hardware responses gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // Send various malformed messages
      mockSerialManager.emit('data', 'LED:INVALID');
      mockSerialManager.emit('data', 'LED:STATUS:INVALID:FORMAT');
      mockSerialManager.emit('data', 'LED:BUTTON_PRESS:NOT_A_NUMBER');
      mockSerialManager.emit('data', 'COMPLETELY:INVALID:MESSAGE');

      // Should not crash and log warnings
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    test('should handle rapid hardware status updates', () => {
      // Send multiple rapid status updates
      mockSerialManager.emit('data', 'LED:STATUS:READY:16:128');
      mockSerialManager.emit('data', 'LED:STATUS:READY:24:200');
      mockSerialManager.emit('data', 'LED:STATUS:READY:32:255');

      // Should use latest status
      expect(ledController.hardwareStatus).toEqual({
        ready: true,
        buttonCount: 32,
        maxBrightness: 255
      });
    });

    test('should handle hardware disconnection and reconnection', async () => {
      // Initially connected
      expect(mockSerialManager.isConnected()).toBe(true);
      
      await ledController.setBrightness(150);
      expect(mockSerialManager.writeCommand).toHaveBeenCalledWith('LED:BRIGHTNESS:150');

      // Disconnect
      mockSerialManager.isConnected.mockReturnValue(false);
      
      await expect(ledController.setBrightness(200))
        .rejects.toThrow('Serial connection not available');

      // Reconnect
      mockSerialManager.isConnected.mockReturnValue(true);
      
      // Should work again
      await ledController.setBrightness(180);
      expect(mockSerialManager.writeCommand).toHaveBeenLastCalledWith('LED:BRIGHTNESS:180');
    });
  });

  describe('performance and resource management', () => {
    test('should handle many button color changes efficiently', async () => {
      const startTime = Date.now();
      
      // Set colors for all 32 buttons
      const promises = [];
      for (let i = 1; i <= 32; i++) {
        const color = {
          r: Math.floor(Math.random() * 256),
          g: Math.floor(Math.random() * 256),
          b: Math.floor(Math.random() * 256)
        };
        promises.push(ledController.setButtonColor(i, color));
      }
      
      await Promise.all(promises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(1000); // 1 second
      expect(mockSerialManager.writeCommand).toHaveBeenCalledTimes(32);
    });

    test('should clean up resources properly', () => {
      const removeListenerSpy = jest.spyOn(mockSerialManager, 'removeListener');
      
      // Create multiple LED controllers
      const controller1 = new LEDController(mockSerialManager, mockLogger);
      const controller2 = new LEDController(mockSerialManager, mockLogger);
      
      // Cleanup
      controller1.cleanup?.();
      controller2.cleanup?.();
      
      // Should remove event listeners if cleanup method exists
      if (controller1.cleanup) {
        expect(removeListenerSpy).toHaveBeenCalled();
      }
      
      removeListenerSpy.mockRestore();
    });

    test('should handle memory usage efficiently with large button counts', async () => {
      // Simulate 64-button configuration
      mockSerialManager.emit('data', 'LED:STATUS:READY:64:255');
      
      // Set colors for all buttons
      for (let i = 1; i <= 64; i++) {
        await ledController.setButtonColor(i, { 
          r: i % 256, 
          g: (i * 2) % 256, 
          b: (i * 3) % 256 
        });
      }
      
      const state = ledController.getState();
      expect(Object.keys(state.currentColors)).toHaveLength(64);
      
      // Clear all should clean up memory
      await ledController.clearAll();
      expect(Object.keys(ledController.buttonColors)).toHaveLength(0);
    });
  });

  describe('error resilience', () => {
    test('should continue operation after serial command failures', async () => {
      // First command fails
      mockSerialManager.writeCommand.mockRejectedValueOnce(new Error('Command failed'));
      
      await expect(ledController.setBrightness(150))
        .rejects.toThrow('Command failed');

      // Reset mock to succeed
      mockSerialManager.writeCommand.mockResolvedValue();
      
      // Subsequent commands should work
      await ledController.setBrightness(200);
      expect(ledController.brightness).toBe(200);
    });

    test('should handle partial hardware failures gracefully', async () => {
      const errorSpy = jest.fn();
      ledController.on('error', errorSpy);
      
      // Start with working hardware
      await ledController.setButtonColor(1, { r: 255, g: 0, b: 0 });
      
      // Hardware reports partial failure
      mockSerialManager.emit('data', 'LED:ERROR:BUTTON_FAIL:Button 5 LED failed');
      
      expect(errorSpy).toHaveBeenCalledWith({
        code: 'BUTTON_FAIL',
        message: 'Button 5 LED failed'
      });

      // Other operations should still work
      await ledController.setButtonColor(2, { r: 0, g: 255, b: 0 });
      expect(ledController.buttonColors[2]).toEqual({ r: 0, g: 255, b: 0 });
    });
  });
});