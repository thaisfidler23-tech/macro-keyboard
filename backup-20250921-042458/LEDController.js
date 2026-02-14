/**
 * LEDController - Manages RGB LED communication and control
 *
 * This class handles communication with the Arduino firmware to control
 * WS2812B (NeoPixel) RGB LEDs for visual feedback on the macro keyboard.
 *
 * Features:
 * - Per-button LED color control
 * - Global brightness adjustment
 * - LED effects and animations
 * - Integration with profiles for custom lighting themes
 * - Visual feedback for button presses and system states
 */

const EventEmitter = require('events');

class LEDController extends EventEmitter {
  constructor(serialManager) {
    super();

    this.serialManager = serialManager;
    this.isEnabled = false;
    this.buttonCount = 8; // Default, will be updated from hardware
    this.brightness = 128; // Default brightness (0-255)
    this.currentColors = new Map(); // button_id -> {r, g, b}
    this.currentEffect = null;

    // Default color scheme
    this.defaultColors = {
      default: { r: 50, g: 50, b: 100 }, // Soft blue
      active: { r: 0, g: 255, b: 0 }, // Green for active
      pressed: { r: 255, g: 100, b: 0 }, // Orange for pressed
      error: { r: 255, g: 0, b: 0 }, // Red for errors
      success: { r: 0, g: 255, b: 100 }, // Green-cyan for success
      warning: { r: 255, g: 255, b: 0 }, // Yellow for warnings
      profile: { r: 100, g: 0, b: 255 } // Purple for profile switches
    };

    // Profile-based color themes
    this.profileThemes = new Map();

    // LED effects
    this.availableEffects = [
      'RAINBOW', // Rainbow color cycling
      'BREATHE', // Breathing effect with current colors
      'WAVE', // Wave animation across buttons
      'RIPPLE' // Ripple effect from button presses
    ];

    this.effectSpeed = 5; // 1-10 scale

    // Bind serial event handlers
    if (this.serialManager) {
      this.serialManager.on('data', this.handleSerialData.bind(this));
      this.serialManager.on('connected', this.initialize.bind(this));
      this.serialManager.on('disconnected', this.handleDisconnect.bind(this));
    }

    console.log('LEDController initialized');
  }

  /**
   * Initialize LED system
   */
  async initialize() {
    try {
      // Query hardware status to get button count and LED status
      const status = await this.queryHardwareStatus();

      if (status && status.leds === 'Enabled') {
        this.isEnabled = true;
        this.buttonCount = status.buttons || 8;

        // Initialize all buttons with default color
        await this.setAllButtons(this.defaultColors.default);

        this.emit('initialized', {
          enabled: this.isEnabled,
          buttonCount: this.buttonCount,
          brightness: this.brightness
        });

        console.log(
          `LED system initialized: ${this.buttonCount} buttons, brightness ${this.brightness}`
        );
      } else {
        this.isEnabled = false;
        console.log('LED system not available on hardware');
      }
    } catch (error) {
      console.error('Failed to initialize LED system:', error);
      this.isEnabled = false;
      this.emit('error', { message: 'LED initialization failed', error });
    }
  }

  /**
   * Query hardware for current status
   */
  async queryHardwareStatus() {
    return new Promise((resolve, reject) => {
      if (!this.serialManager || !this.serialManager.getStatus().isConnected) {
        reject(new Error('Serial connection not available'));
        return;
      }

      let responseData = '';
      const timeout = setTimeout(() => {
        this.serialManager.removeListener('data', dataHandler);
        reject(new Error('Hardware status query timeout'));
      }, 3000);

      const dataHandler = data => {
        responseData += data;

        if (responseData.includes('STATUS:OK')) {
          clearTimeout(timeout);
          this.serialManager.removeListener('data', dataHandler);

          const status = this.parseStatusResponse(responseData);
          resolve(status);
        }
      };

      this.serialManager.on('data', dataHandler);
      this.serialManager.write('STATUS\\n');
    });
  }

  /**
   * Parse hardware status response
   */
  parseStatusResponse(response) {
    const lines = response.split('\\n');
    const status = {};

    lines.forEach(line => {
      if (line.startsWith('BUTTONS:')) {
        status.buttons = parseInt(line.split(':', 10)[1]);
      } else if (line.startsWith('ENCODERS:')) {
        status.encoders = parseInt(line.split(':', 10)[1]);
      } else if (line.startsWith('LEDS:')) {
        status.leds = line.split(':')[1];
      } else if (line.startsWith('BRIGHTNESS:')) {
        status.brightness = parseInt(line.split(':', 10)[1]);
      }
    });

    return status;
  }

  /**
   * Handle incoming serial data
   */
  handleSerialData(data) {
    const lines = data.toString().split('\\n');

    lines.forEach(line => {
      line = line.trim();

      if (line.startsWith('LED:')) {
        this.handleLEDResponse(line);
      }
    });
  }

  /**
   * Handle LED command responses from enhanced protocol
   */
  handleLEDResponse(response) {
    // Handle error responses
    if (response.includes('ERROR:LED:')) {
      const errorParts = response.split(':');
      const errorType = errorParts[2] || 'UNKNOWN';
      const errorMessage = errorParts.slice(3).join(':') || 'Unknown LED error';

      console.error(`LED ${errorType} error:`, errorMessage);
      this.emit('error', {
        message: 'LED command failed',
        error: `${errorType}: ${errorMessage}`,
        type: errorType
      });
      return;
    }

    // Handle acknowledgment responses (LED:ACK:...)
    if (response.startsWith('LED:ACK:')) {
      const ackParts = response.split(':');
      const ackType = ackParts[2];

      switch (ackType) {
        case 'BRIGHTNESS': {
          const brightness = parseInt(ackParts[3], 10);
          this.brightness = brightness;
          this.emit('brightness-changed', brightness);
          break;
        }
        case 'EFFECT': {
          const effectName = ackParts[3];
          const speed = parseInt(ackParts[4], 10);
          this.currentEffect = { name: effectName, speed };
          this.emit('effect-started', this.currentEffect);
          break;
        }
        case 'CLEARED':
          this.currentColors.clear();
          this.currentEffect = null;
          this.emit('cleared');
          break;

        case 'RESET':
          this.currentColors.clear();
          this.currentEffect = null;
          this.emit('reset-to-default');
          break;

        case 'POWER': {
          const powerState = ackParts[3] === 'ON';
          this.isEnabled = powerState;
          this.emit('power-state-changed', powerState);
          break;
        }
        case 'SET':
        case 'ALL':
        case 'BATCH':
          // Color commands acknowledged - emit success
          this.emit('led-command-success');
          break;

        default:
          console.log('LED ACK received:', response);
          this.emit('led-command-success');
          break;
      }
      return;
    }

    // Handle power limiting notifications
    if (response.startsWith('POWER:LIMITING:')) {
      const parts = response.split(':');
      const status = parts[2];

      if (status === 'Active') {
        const reducedBrightness = parseInt(parts[4], 10);
        console.warn(`Power limiting active: brightness reduced to ${reducedBrightness}`);
        this.brightness = reducedBrightness;
        this.emit('power-limiting-active', { brightness: reducedBrightness });
      } else if (status === 'Inactive') {
        console.info('Power limiting deactivated');
        this.emit('power-limiting-inactive');
      }
      return;
    }

    // Legacy response handling for backward compatibility
    if (response.startsWith('LED:BRIGHTNESS:')) {
      const brightness = parseInt(response.split(':', 10)[2]);
      this.brightness = brightness;
      this.emit('brightness-changed', brightness);
    } else if (response.startsWith('LED:EFFECT:')) {
      const parts = response.split(':');
      const effectName = parts[2];
      const speed = parseInt(parts[3], 10);
      this.currentEffect = { name: effectName, speed };
      this.emit('effect-started', this.currentEffect);
    } else if (response === 'LED:CLEARED') {
      this.currentColors.clear();
      this.currentEffect = null;
      this.emit('cleared');
    }
  }

  /**
   * Handle serial disconnection
   */
  handleDisconnect() {
    this.isEnabled = false;
    this.currentColors.clear();
    this.currentEffect = null;
    this.emit('disconnected');
  }

  /**
   * Set color for a specific button using enhanced protocol
   */
  async setButtonColor(buttonId, color, animate = true) {
    if (!this.isEnabled || !this.serialManager.getStatus().isConnected) {
      throw new Error('LED system not available');
    }

    if (buttonId < 1 || buttonId > this.buttonCount) {
      throw new Error(`Invalid button ID: ${buttonId}. Must be 1-${this.buttonCount}`);
    }

    const { r, g, b } = this.validateColor(color);

    // Update local state
    this.currentColors.set(buttonId, { r, g, b });

    // Send enhanced protocol command
    const command = `LED:SET:${buttonId}:${r}:${g}:${b}\n`;
    await this.sendCommand(command);

    this.emit('button-color-changed', { buttonId, color: { r, g, b }, animate });
  }

  /**
   * Set color for all buttons using enhanced protocol
   */
  async setAllButtons(color, animate = true) {
    if (!this.isEnabled || !this.serialManager.getStatus().isConnected) {
      throw new Error('LED system not available');
    }

    const { r, g, b } = this.validateColor(color);

    // Update local state for all buttons
    for (let i = 1; i <= this.buttonCount; i++) {
      this.currentColors.set(i, { r, g, b });
    }

    // Use legacy ALL command for backward compatibility
    const command = `LED:ALL:${r}:${g}:${b}\n`;
    await this.sendCommand(command);

    this.emit('all-colors-changed', { color: { r, g, b }, animate });
  }

  /**
   * Set multiple button colors efficiently using batch protocol
   */
  async setBatchColors(buttonColors, animate = true) {
    if (!this.isEnabled || !this.serialManager.getStatus().isConnected) {
      throw new Error('LED system not available');
    }

    if (!buttonColors || typeof buttonColors !== 'object') {
      throw new Error('buttonColors must be an object with buttonId->color mapping');
    }

    const buttonIds = Object.keys(buttonColors)
      .map(id => parseInt(id, 10))
      .filter(id => !isNaN(id) && id >= 1 && id <= this.buttonCount);

    if (buttonIds.length === 0) {
      throw new Error('No valid button IDs provided');
    }

    // Sort button IDs to ensure consistent ordering
    buttonIds.sort((a, b) => a - b);

    // Build batch command data
    let dataParams = '';
    for (let i = 0; i < buttonIds.length; i++) {
      const buttonId = buttonIds[i];
      const { r, g, b } = this.validateColor(buttonColors[buttonId]);

      // Update local state
      this.currentColors.set(buttonId, { r, g, b });

      if (i > 0) {
        dataParams += ':';
      }
      dataParams += `${r}:${g}:${b}`;
    }

    // Send batch command: LED:BATCH:<count>:<r1>:<g1>:<b1>:<r2>:<g2>:<b2>:...
    const command = `LED:BATCH:${buttonIds.length}:${dataParams}\n`;
    await this.sendCommand(command);

    this.emit('batch-colors-changed', { buttonColors, animate });
  }

  /**
   * Clear all LEDs using enhanced protocol
   */
  async clearAll() {
    if (!this.isEnabled || !this.serialManager.getStatus().isConnected) {
      throw new Error('LED system not available');
    }

    // Clear local state
    this.currentColors.clear();
    this.currentEffect = null;

    // Send clear command (legacy format for compatibility)
    await this.sendCommand('LED:CLEAR\n');

    this.emit('cleared');
  }

  /**
   * Reset LEDs to default state using enhanced protocol
   */
  async resetToDefault() {
    if (!this.isEnabled || !this.serialManager.getStatus().isConnected) {
      throw new Error('LED system not available');
    }

    // Clear local state
    this.currentColors.clear();
    this.currentEffect = null;

    // Send reset command
    await this.sendCommand('LED:RESET\n');

    this.emit('reset-to-default');
  }

  /**
   * Control LED power state
   */
  async setPowerState(enabled) {
    if (!this.serialManager.getStatus().isConnected) {
      throw new Error('LED system not available');
    }

    const powerCommand = enabled ? 'on' : 'off';
    const command = `LED:POWER:${powerCommand}\n`;
    await this.sendCommand(command);

    this.isEnabled = enabled;
    if (!enabled) {
      this.currentColors.clear();
      this.currentEffect = null;
    }

    this.emit('power-state-changed', enabled);
  }

  /**
   * Get detailed LED system status
   */
  async getDetailedStatus() {
    if (!this.serialManager.getStatus().isConnected) {
      throw new Error('Serial connection not available');
    }

    return new Promise((resolve, reject) => {
      let responseData = '';
      const timeout = setTimeout(() => {
        this.serialManager.removeListener('data', dataHandler);
        reject(new Error('LED status query timeout'));
      }, 5000);

      const dataHandler = data => {
        responseData += data;

        if (responseData.includes('LED:STATUS:END')) {
          clearTimeout(timeout);
          this.serialManager.removeListener('data', dataHandler);

          const status = this.parseDetailedStatusResponse(responseData);
          resolve(status);
        }
      };

      this.serialManager.on('data', dataHandler);
      this.serialManager.write('LED:STATUS\n');
    });
  }

  /**
   * Parse detailed status response from enhanced protocol
   */
  parseDetailedStatusResponse(response) {
    const lines = response.split('\n');
    const status = {};

    lines.forEach(line => {
      line = line.trim();
      if (line.startsWith('LED:STATUS:ENABLED:')) {
        status.enabled = line.split(':')[3] === 'true';
      } else if (line.startsWith('LED:STATUS:BUTTON_COUNT:')) {
        status.buttonCount = parseInt(line.split(':', 10)[3]);
      } else if (line.startsWith('LED:STATUS:BRIGHTNESS:')) {
        status.brightness = parseInt(line.split(':', 10)[3]);
      } else if (line.startsWith('LED:STATUS:CURRENT_EFFECT:')) {
        status.currentEffect = parseInt(line.split(':', 10)[3]);
      } else if (line.startsWith('LED:STATUS:MEMORY_USAGE:')) {
        status.memoryUsage = parseInt(line.split(':', 10)[3]);
      }
    });

    return status;
  }

  /**
   * Set brightness for all LEDs using enhanced protocol
   */
  async setBrightness(brightness) {
    if (!this.isEnabled || !this.serialManager.getStatus().isConnected) {
      throw new Error('LED system not available');
    }

    if (brightness < 0 || brightness > 255) {
      throw new Error('Brightness must be between 0 and 255');
    }

    this.brightness = brightness;

    // Send enhanced protocol command
    const command = `LED:BRIGHTNESS:${brightness}\n`;
    await this.sendCommand(command);

    this.emit('brightness-changed', brightness);
  }

  /**
   * Start an LED effect using enhanced protocol
   */
  async startEffect(effectName, speed = 5) {
    if (!this.isEnabled || !this.serialManager.getStatus().isConnected) {
      throw new Error('LED system not available');
    }

    if (!this.availableEffects.includes(effectName)) {
      throw new Error(
        `Invalid effect: ${effectName}. Available: ${this.availableEffects.join(', ')}`
      );
    }

    if (speed < 1 || speed > 10) {
      throw new Error('Speed must be between 1 and 10');
    }

    this.currentEffect = { name: effectName, speed };
    this.effectSpeed = speed;

    // Send enhanced protocol command
    const command = `LED:EFFECT:${effectName}:${speed}\n`;
    await this.sendCommand(command);

    this.emit('effect-started', this.currentEffect);
  }

  /**
   * Stop current effect
   */
  async stopEffect() {
    if (!this.isEnabled) {
      return;
    }

    this.currentEffect = null;

    // Restore default colors
    await this.setAllButtons(this.defaultColors.default);

    this.emit('effect-stopped');
  }

  /**
   * Provide visual feedback for button press
   */
  async showButtonPress(buttonId, duration = 200) {
    if (!this.isEnabled) {
      return;
    }

    try {
      // Store original color
      const originalColor = this.currentColors.get(buttonId) || this.defaultColors.default;

      // Show press color
      await this.setButtonColor(buttonId, this.defaultColors.pressed, false);

      // Restore original color after duration
      setTimeout(async () => {
        try {
          await this.setButtonColor(buttonId, originalColor, true);
        } catch (error) {
          console.error('Error restoring button color:', error);
        }
      }, duration);

      this.emit('button-pressed', { buttonId, duration });
    } catch (error) {
      console.error('Error showing button press feedback:', error);
    }
  }

  /**
   * Show system status via LED colors
   */
  async showSystemStatus(status, duration = 2000) {
    if (!this.isEnabled) {
      return;
    }

    let color;
    switch (status) {
      case 'success':
        color = this.defaultColors.success;
        break;
      case 'error':
        color = this.defaultColors.error;
        break;
      case 'warning':
        color = this.defaultColors.warning;
        break;
      case 'profile-switch':
        color = this.defaultColors.profile;
        break;
      default:
        color = this.defaultColors.default;
    }

    try {
      // Store current colors
      const originalColors = new Map(this.currentColors);

      // Show status color on all buttons
      await this.setAllButtons(color, false);

      // Restore original colors after duration
      if (duration > 0) {
        setTimeout(async () => {
          try {
            for (const [buttonId, originalColor] of originalColors) {
              await this.setButtonColor(buttonId, originalColor, true);
            }
          } catch (error) {
            console.error('Error restoring colors after status display:', error);
          }
        }, duration);
      }

      this.emit('status-displayed', { status, color, duration });
    } catch (error) {
      console.error('Error showing system status:', error);
    }
  }

  /**
   * Apply profile-based LED theme
   */
  async applyProfileTheme(profileId, theme) {
    if (!this.isEnabled) {
      return;
    }

    try {
      // Store theme for profile
      this.profileThemes.set(profileId, theme);

      // Apply theme colors
      if (theme.allButtons) {
        // Single color for all buttons
        await this.setAllButtons(theme.allButtons);
      } else if (theme.buttonColors) {
        // Individual button colors
        for (const [buttonId, color] of Object.entries(theme.buttonColors)) {
          await this.setButtonColor(parseInt(buttonId, 10), color);
        }
      }

      // Apply effect if specified
      if (theme.effect) {
        await this.startEffect(theme.effect.name, theme.effect.speed || 5);
      }

      this.emit('theme-applied', { profileId, theme });
    } catch (error) {
      console.error('Error applying profile theme:', error);
      this.emit('error', { message: 'Failed to apply profile theme', error });
    }
  }

  /**
   * Get current LED state
   */
  getState() {
    return {
      enabled: this.isEnabled,
      buttonCount: this.buttonCount,
      brightness: this.brightness,
      currentColors: Object.fromEntries(this.currentColors),
      currentEffect: this.currentEffect,
      availableEffects: [...this.availableEffects],
      profileThemes: Object.fromEntries(this.profileThemes)
    };
  }

  /**
   * Update button count (when hardware configuration changes)
   */
  updateButtonCount(count) {
    this.buttonCount = count;

    // Clear colors for buttons that no longer exist
    const keysToDelete = [];
    for (const buttonId of this.currentColors.keys()) {
      if (buttonId > count) {
        keysToDelete.push(buttonId);
      }
    }

    keysToDelete.forEach(key => this.currentColors.delete(key));

    this.emit('button-count-changed', count);
  }

  /**
   * Validate color object
   */
  validateColor(color) {
    const r = Math.max(0, Math.min(255, parseInt(color.r, 10) || 0));
    const g = Math.max(0, Math.min(255, parseInt(color.g, 10) || 0));
    const b = Math.max(0, Math.min(255, parseInt(color.b, 10) || 0));

    return { r, g, b };
  }

  /**
   * Send command to hardware with error handling
   */
  async sendCommand(command) {
    return new Promise((resolve, reject) => {
      if (!this.serialManager || !this.serialManager.getStatus().isConnected) {
        reject(new Error('Serial connection not available'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('LED command timeout'));
      }, 2000);

      const successHandler = () => {
        clearTimeout(timeout);
        resolve();
      };

      const errorHandler = error => {
        clearTimeout(timeout);
        reject(error);
      };

      // Set up temporary listeners for this command
      this.once('led-command-success', successHandler);
      this.once('error', errorHandler);

      try {
        this.serialManager.write(command);

        // For now, assume success immediately (could be enhanced with response parsing)
        setTimeout(() => {
          this.emit('led-command-success');
        }, 100);
      } catch (error) {
        clearTimeout(timeout);
        this.removeListener('led-command-success', successHandler);
        this.removeListener('error', errorHandler);
        reject(error);
      }
    });
  }

  /**
   * Create color from hex string
   */
  static fromHex(hexString) {
    const hex = hexString.replace('#', '');

    // Validate hex string format
    if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
      return { r: 0, g: 0, b: 0 }; // Default to black for invalid input
    }

    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    return { r, g, b };
  }

  /**
   * Convert color to hex string
   */
  static toHex(color) {
    const r = Math.max(0, Math.min(255, color.r)).toString(16).padStart(2, '0');
    const g = Math.max(0, Math.min(255, color.g)).toString(16).padStart(2, '0');
    const b = Math.max(0, Math.min(255, color.b)).toString(16).padStart(2, '0');

    return `#${r}${g}${b}`;
  }

  /**
   * Cleanup and disconnect
   */
  destroy() {
    if (this.serialManager) {
      this.serialManager.removeAllListeners('data');
      this.serialManager.removeAllListeners('connected');
      this.serialManager.removeAllListeners('disconnected');
    }

    this.currentColors.clear();
    this.profileThemes.clear();
    this.currentEffect = null;
    this.isEnabled = false;

    this.removeAllListeners();
    console.log('LEDController destroyed');
  }
}

module.exports = LEDController;
