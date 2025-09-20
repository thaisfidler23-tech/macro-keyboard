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
      default: { r: 50, g: 50, b: 100 },    // Soft blue
      active: { r: 0, g: 255, b: 0 },       // Green for active
      pressed: { r: 255, g: 100, b: 0 },    // Orange for pressed
      error: { r: 255, g: 0, b: 0 },        // Red for errors
      success: { r: 0, g: 255, b: 100 },    // Green-cyan for success
      warning: { r: 255, g: 255, b: 0 },    // Yellow for warnings
      profile: { r: 100, g: 0, b: 255 }     // Purple for profile switches
    };
    
    // Profile-based color themes
    this.profileThemes = new Map();
    
    // LED effects
    this.availableEffects = [
      'RAINBOW',    // Rainbow color cycling
      'BREATHE',    // Breathing effect with current colors
      'WAVE',       // Wave animation across buttons
      'RIPPLE'      // Ripple effect from button presses
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
        
        console.log(`LED system initialized: ${this.buttonCount} buttons, brightness ${this.brightness}`);
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
      if (!this.serialManager || !this.serialManager.isConnected()) {
        reject(new Error('Serial connection not available'));
        return;
      }
      
      let responseData = '';
      const timeout = setTimeout(() => {
        this.serialManager.removeListener('data', dataHandler);
        reject(new Error('Hardware status query timeout'));
      }, 3000);
      
      const dataHandler = (data) => {
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
        status.buttons = parseInt(line.split(':')[1]);
      } else if (line.startsWith('ENCODERS:')) {
        status.encoders = parseInt(line.split(':')[1]);
      } else if (line.startsWith('LEDS:')) {
        status.leds = line.split(':')[1];
      } else if (line.startsWith('BRIGHTNESS:')) {
        status.brightness = parseInt(line.split(':')[1]);
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
   * Handle LED command responses
   */
  handleLEDResponse(response) {
    if (response.includes('ERROR:')) {
      const error = response.split('ERROR:')[1];
      console.error('LED command error:', error);
      this.emit('error', { message: 'LED command failed', error });
      return;
    }
    
    // Parse successful LED responses
    if (response.startsWith('LED:BRIGHTNESS:')) {
      const brightness = parseInt(response.split(':')[2]);
      this.brightness = brightness;
      this.emit('brightness-changed', brightness);
    } else if (response.startsWith('LED:EFFECT:')) {
      const parts = response.split(':');
      const effectName = parts[2];
      const speed = parseInt(parts[3]);
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
   * Set color for a specific button
   */
  async setButtonColor(buttonId, color, animate = true) {
    if (!this.isEnabled || !this.serialManager.isConnected()) {
      throw new Error('LED system not available');
    }
    
    if (buttonId < 1 || buttonId > this.buttonCount) {
      throw new Error(`Invalid button ID: ${buttonId}. Must be 1-${this.buttonCount}`);
    }
    
    const { r, g, b } = this.validateColor(color);
    
    // Update local state
    this.currentColors.set(buttonId, { r, g, b });
    
    // Send command to hardware
    const command = `LED:${buttonId}:${r}:${g}:${b}\\n`;
    await this.sendCommand(command);
    
    this.emit('button-color-changed', { buttonId, color: { r, g, b }, animate });
  }
  
  /**
   * Set color for all buttons
   */
  async setAllButtons(color, animate = true) {
    if (!this.isEnabled || !this.serialManager.isConnected()) {
      throw new Error('LED system not available');
    }
    
    const { r, g, b } = this.validateColor(color);
    
    // Update local state for all buttons
    for (let i = 1; i <= this.buttonCount; i++) {
      this.currentColors.set(i, { r, g, b });
    }
    
    // Send command to hardware
    const command = `LED:ALL:${r}:${g}:${b}\\n`;
    await this.sendCommand(command);
    
    this.emit('all-colors-changed', { color: { r, g, b }, animate });
  }
  
  /**
   * Clear all LEDs (turn off)
   */
  async clearAll() {
    if (!this.isEnabled || !this.serialManager.isConnected()) {
      throw new Error('LED system not available');
    }
    
    // Clear local state
    this.currentColors.clear();
    this.currentEffect = null;
    
    // Send command to hardware
    await this.sendCommand('LED:CLEAR\\n');
    
    this.emit('cleared');
  }
  
  /**
   * Set brightness for all LEDs
   */
  async setBrightness(brightness) {
    if (!this.isEnabled || !this.serialManager.isConnected()) {
      throw new Error('LED system not available');
    }
    
    if (brightness < 0 || brightness > 255) {
      throw new Error('Brightness must be between 0 and 255');
    }
    
    this.brightness = brightness;
    
    // Send command to hardware
    const command = `LED:BRIGHTNESS:${brightness}\\n`;
    await this.sendCommand(command);
    
    this.emit('brightness-changed', brightness);
  }
  
  /**
   * Start an LED effect
   */
  async startEffect(effectName, speed = 5) {
    if (!this.isEnabled || !this.serialManager.isConnected()) {
      throw new Error('LED system not available');
    }
    
    if (!this.availableEffects.includes(effectName)) {
      throw new Error(`Invalid effect: ${effectName}. Available: ${this.availableEffects.join(', ')}`);
    }
    
    if (speed < 1 || speed > 10) {
      throw new Error('Speed must be between 1 and 10');
    }
    
    this.currentEffect = { name: effectName, speed };
    this.effectSpeed = speed;
    
    // Send command to hardware
    const command = `LED:EFFECT:${effectName}:${speed}\\n`;
    await this.sendCommand(command);
    
    this.emit('effect-started', this.currentEffect);
  }
  
  /**
   * Stop current effect
   */
  async stopEffect() {
    if (!this.isEnabled) return;
    
    this.currentEffect = null;
    
    // Restore default colors
    await this.setAllButtons(this.defaultColors.default);
    
    this.emit('effect-stopped');
  }
  
  /**
   * Provide visual feedback for button press
   */
  async showButtonPress(buttonId, duration = 200) {
    if (!this.isEnabled) return;
    
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
    if (!this.isEnabled) return;
    
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
    if (!this.isEnabled) return;
    
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
          await this.setButtonColor(parseInt(buttonId), color);
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
    const r = Math.max(0, Math.min(255, parseInt(color.r) || 0));
    const g = Math.max(0, Math.min(255, parseInt(color.g) || 0));
    const b = Math.max(0, Math.min(255, parseInt(color.b) || 0));
    
    return { r, g, b };
  }
  
  /**
   * Send command to hardware with error handling
   */
  async sendCommand(command) {
    return new Promise((resolve, reject) => {
      if (!this.serialManager || !this.serialManager.isConnected()) {
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
      
      const errorHandler = (error) => {
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