/**
 * LEDManagerUI - User interface for RGB LED configuration and control
 * 
 * This class provides a complete interface for managing RGB LED settings,
 * including per-button colors, effects, brightness, and profile themes.
 */

class LEDManagerUI {
  constructor() {
    this.container = null;
    this.isVisible = false;
    this.ledController = null;
    
    // UI state
    this.selectedButton = null;
    this.selectedColor = { r: 50, g: 50, b: 100 };
    this.currentBrightness = 128;
    this.isPreviewMode = false;
    
    // Default color presets
    this.colorPresets = [
      { name: 'Soft Blue', color: { r: 50, g: 50, b: 100 } },
      { name: 'Green', color: { r: 0, g: 255, b: 0 } },
      { name: 'Orange', color: { r: 255, g: 100, b: 0 } },
      { name: 'Red', color: { r: 255, g: 0, b: 0 } },
      { name: 'Purple', color: { r: 100, g: 0, b: 255 } },
      { name: 'Yellow', color: { r: 255, g: 255, b: 0 } },
      { name: 'Cyan', color: { r: 0, g: 255, b: 255 } },
      { name: 'White', color: { r: 255, g: 255, b: 255 } },
      { name: 'Off', color: { r: 0, g: 0, b: 0 } }
    ];
    
    // Available effects
    this.availableEffects = [
      { name: 'RAINBOW', displayName: 'Rainbow Cycle', description: 'Cycles through rainbow colors' },
      { name: 'BREATHE', displayName: 'Breathing', description: 'Gentle breathing effect' },
      { name: 'WAVE', displayName: 'Wave', description: 'Wave animation across buttons' },
      { name: 'RIPPLE', displayName: 'Ripple', description: 'Ripple effect from button presses' }
    ];
    
    this.currentTheme = null;
    
    this.initializeEventListeners();
    console.log('LEDManagerUI initialized');
  }
  
  /**
   * Initialize the LED manager UI
   */
  async initialize() {
    try {
      this.createUI();
      await this.loadLEDStatus();
      this.setupEventListeners();
      
      console.log('LED Manager UI initialized successfully');
    } catch (error) {
      console.error('Failed to initialize LED Manager UI:', error);
      this.showError('Failed to initialize LED manager');
    }
  }
  
  /**
   * Create the main UI structure
   */
  createUI() {
    this.container = document.createElement('div');
    this.container.className = 'led-manager-container';
    this.container.style.display = 'none';
    
    this.container.innerHTML = `
      <div class="led-manager-content">
        <div class="led-manager-header">
          <h2>RGB LED Manager</h2>
          <div class="led-status">
            <span class="led-status-indicator" id="led-status-indicator"></span>
            <span class="led-status-text" id="led-status-text">Checking...</span>
          </div>
          <button class="btn btn-small" id="close-led-manager">✕</button>
        </div>
        
        <div class="led-manager-body">
          <!-- LED Status and Quick Controls -->
          <div class="led-section">
            <h3>Quick Controls</h3>
            <div class="led-quick-controls">
              <button class="btn btn-primary" id="led-all-on">All On</button>
              <button class="btn btn-secondary" id="led-all-off">All Off</button>
              <button class="btn btn-secondary" id="led-test-pattern">Test Pattern</button>
              <button class="btn btn-secondary" id="led-stop-effects">Stop Effects</button>
            </div>
          </div>
          
          <!-- Brightness Control -->
          <div class="led-section">
            <h3>Brightness</h3>
            <div class="brightness-controls">
              <label for="brightness-slider">Brightness: <span id="brightness-value">128</span></label>
              <input type="range" id="brightness-slider" min="0" max="255" value="128" class="brightness-slider">
              <div class="brightness-presets">
                <button class="btn btn-small" data-brightness="64">25%</button>
                <button class="btn btn-small" data-brightness="128">50%</button>
                <button class="btn btn-small" data-brightness="192">75%</button>
                <button class="btn btn-small" data-brightness="255">100%</button>
              </div>
            </div>
          </div>
          
          <!-- Button Color Configuration -->
          <div class="led-section">
            <h3>Button Colors</h3>
            <div class="button-grid" id="button-grid">
              <!-- Buttons will be generated dynamically -->
            </div>
            <div class="button-color-controls">
              <div class="color-picker-container">
                <label>Selected Button Color:</label>
                <div class="color-picker-wrapper">
                  <input type="color" id="color-picker" value="#323264">
                  <div class="rgb-inputs">
                    <label>R: <input type="number" id="color-r" min="0" max="255" value="50"></label>
                    <label>G: <input type="number" id="color-g" min="0" max="255" value="50"></label>
                    <label>B: <input type="number" id="color-b" min="0" max="255" value="100"></label>
                  </div>
                </div>
              </div>
              <div class="color-presets">
                <label>Color Presets:</label>
                <div class="preset-buttons" id="color-presets">
                  <!-- Color presets will be generated -->
                </div>
              </div>
            </div>
            <div class="button-actions">
              <button class="btn btn-primary" id="apply-color-selected" disabled>Apply to Selected</button>
              <button class="btn btn-secondary" id="apply-color-all">Apply to All</button>
              <button class="btn btn-secondary" id="copy-color">Copy Color</button>
              <button class="btn btn-secondary" id="paste-color" disabled>Paste Color</button>
            </div>
          </div>
          
          <!-- LED Effects -->
          <div class="led-section">
            <h3>LED Effects</h3>
            <div class="effects-controls">
              <div class="effect-selector">
                <label for="effect-select">Effect:</label>
                <select id="effect-select">
                  <option value="">None</option>
                  <!-- Effects will be populated dynamically -->
                </select>
              </div>
              <div class="effect-speed">
                <label for="effect-speed">Speed: <span id="speed-value">5</span></label>
                <input type="range" id="effect-speed" min="1" max="10" value="5">
              </div>
              <div class="effect-actions">
                <button class="btn btn-primary" id="start-effect">Start Effect</button>
                <button class="btn btn-secondary" id="stop-effect">Stop Effect</button>
              </div>
            </div>
            <div class="current-effect" id="current-effect">
              <span>Current Effect: <span id="current-effect-name">None</span></span>
            </div>
          </div>
          
          <!-- Profile Themes -->
          <div class="led-section">
            <h3>Profile Themes</h3>
            <div class="theme-controls">
              <div class="theme-selector">
                <label for="theme-profile">Profile:</label>
                <select id="theme-profile">
                  <option value="">Select Profile</option>
                </select>
              </div>
              <div class="theme-actions">
                <button class="btn btn-primary" id="save-theme">Save Current as Theme</button>
                <button class="btn btn-secondary" id="apply-theme">Apply Theme</button>
                <button class="btn btn-secondary" id="delete-theme" disabled>Delete Theme</button>
              </div>
            </div>
            <div class="theme-preview" id="theme-preview">
              <!-- Theme preview will be shown here -->
            </div>
          </div>
          
          <!-- Advanced Settings -->
          <div class="led-section collapsible">
            <h3 class="collapsible-header" id="advanced-header">
              Advanced Settings 
              <span class="collapsible-arrow">▼</span>
            </h3>
            <div class="collapsible-content" id="advanced-content">
              <div class="advanced-options">
                <label>
                  <input type="checkbox" id="preview-mode"> Preview Mode
                  <span class="option-description">Show color changes in real-time while adjusting</span>
                </label>
                <label>
                  <input type="checkbox" id="button-press-feedback"> Button Press Feedback
                  <span class="option-description">Flash buttons when pressed</span>
                </label>
                <label>
                  <input type="checkbox" id="profile-switch-feedback"> Profile Switch Feedback  
                  <span class="option-description">Show visual feedback when switching profiles</span>
                </label>
                <label>
                  <input type="checkbox" id="system-status-feedback"> System Status Feedback
                  <span class="option-description">Show system status via LED colors</span>
                </label>
              </div>
              <div class="hardware-info">
                <h4>Hardware Information</h4>
                <div class="hardware-details" id="hardware-details">
                  <!-- Hardware info will be populated -->
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Status Messages -->
        <div class="led-messages" id="led-messages"></div>
      </div>
    `;
    
    document.body.appendChild(this.container);
    this.populateColorPresets();
    this.populateEffects();
    this.setupCollapsibleSections();
  }
  
  /**
   * Populate color preset buttons
   */
  populateColorPresets() {
    const container = document.getElementById('color-presets');
    
    this.colorPresets.forEach(preset => {
      const button = document.createElement('button');
      button.className = 'color-preset-btn';
      button.title = preset.name;
      button.style.backgroundColor = `rgb(${preset.color.r}, ${preset.color.g}, ${preset.color.b})`;
      button.dataset.color = JSON.stringify(preset.color);
      button.textContent = preset.name.charAt(0);
      
      container.appendChild(button);
    });
  }
  
  /**
   * Populate available effects
   */
  populateEffects() {
    const select = document.getElementById('effect-select');
    
    this.availableEffects.forEach(effect => {
      const option = document.createElement('option');
      option.value = effect.name;
      option.textContent = effect.displayName;
      option.title = effect.description;
      
      select.appendChild(option);
    });
  }
  
  /**
   * Setup collapsible sections
   */
  setupCollapsibleSections() {
    const headers = document.querySelectorAll('.collapsible-header');
    
    headers.forEach(header => {
      header.addEventListener('click', () => {
        const content = header.nextElementSibling;
        const arrow = header.querySelector('.collapsible-arrow');
        
        if (content.style.display === 'none') {
          content.style.display = 'block';
          arrow.textContent = '▼';
        } else {
          content.style.display = 'none';
          arrow.textContent = '▶';
        }
      });
    });
  }
  
  /**
   * Create button grid based on hardware configuration
   */
  createButtonGrid(buttonCount) {
    const container = document.getElementById('button-grid');
    container.innerHTML = '';
    
    // Determine grid layout based on button count
    let cols;
    switch (buttonCount) {
      case 8: cols = 4; break;
      case 12: cols = 4; break;
      case 16: cols = 4; break;
      case 24: cols = 6; break;
      case 32: cols = 8; break;
      default: cols = 4;
    }
    
    container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    
    for (let i = 1; i <= buttonCount; i++) {
      const button = document.createElement('button');
      button.className = 'led-button-preview';
      button.dataset.buttonId = i;
      button.textContent = i;
      button.title = `Button ${i} - Click to select`;
      
      container.appendChild(button);
    }
  }
  
  /**
   * Load LED status from hardware
   */
  async loadLEDStatus() {
    try {
      const status = await window.electronAPI.invoke('get-led-status');
      
      this.updateStatusDisplay(status);
      
      if (status.enabled) {
        this.createButtonGrid(status.buttonCount || 8);
        this.currentBrightness = status.brightness || 128;
        this.updateBrightnessDisplay(this.currentBrightness);
        
        // Load current colors
        if (status.currentColors) {
          this.updateButtonColors(status.currentColors);
        }
        
        // Load current effect
        if (status.currentEffect) {
          this.updateCurrentEffect(status.currentEffect);
        }
      }
      
      await this.loadProfileList();
    } catch (error) {
      console.error('Failed to load LED status:', error);
      this.showError('Failed to load LED status');
    }
  }
  
  /**
   * Update status display
   */
  updateStatusDisplay(status) {
    const indicator = document.getElementById('led-status-indicator');
    const text = document.getElementById('led-status-text');
    
    if (status.enabled) {
      indicator.className = 'led-status-indicator enabled';
      text.textContent = `Enabled (${status.buttonCount} buttons)`;
    } else {
      indicator.className = 'led-status-indicator disabled';
      text.textContent = 'Disabled or Not Available';
    }
    
    // Update hardware details
    this.updateHardwareDetails(status);
  }
  
  /**
   * Update hardware details
   */
  updateHardwareDetails(status) {
    const container = document.getElementById('hardware-details');
    
    container.innerHTML = `
      <div class="hardware-detail">
        <span class="label">Status:</span>
        <span class="value">${status.enabled ? 'Enabled' : 'Disabled'}</span>
      </div>
      <div class="hardware-detail">
        <span class="label">Button Count:</span>
        <span class="value">${status.buttonCount || 'N/A'}</span>
      </div>
      <div class="hardware-detail">
        <span class="label">Brightness:</span>
        <span class="value">${status.brightness || 'N/A'}</span>
      </div>
      <div class="hardware-detail">
        <span class="label">Current Effect:</span>
        <span class="value">${status.currentEffect ? status.currentEffect.name : 'None'}</span>
      </div>
    `;
  }
  
  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Close button
    document.getElementById('close-led-manager').addEventListener('click', () => {
      this.hide();
    });
    
    // Quick controls
    document.getElementById('led-all-on').addEventListener('click', () => {
      this.setAllButtons(this.selectedColor);
    });
    
    document.getElementById('led-all-off').addEventListener('click', () => {
      this.clearAllLEDs();
    });
    
    document.getElementById('led-test-pattern').addEventListener('click', () => {
      this.runTestPattern();
    });
    
    document.getElementById('led-stop-effects').addEventListener('click', () => {
      this.stopCurrentEffect();
    });
    
    // Brightness controls
    const brightnessSlider = document.getElementById('brightness-slider');
    brightnessSlider.addEventListener('input', (e) => {
      const brightness = parseInt(e.target.value);
      this.updateBrightnessDisplay(brightness);
      
      if (this.isPreviewMode) {
        this.setBrightness(brightness);
      }
    });
    
    brightnessSlider.addEventListener('change', (e) => {
      const brightness = parseInt(e.target.value);
      this.setBrightness(brightness);
    });
    
    // Brightness presets
    document.querySelectorAll('[data-brightness]').forEach(button => {
      button.addEventListener('click', (e) => {
        const brightness = parseInt(e.target.dataset.brightness);
        this.setBrightness(brightness);
        this.updateBrightnessDisplay(brightness);
      });
    });
    
    // Color picker
    const colorPicker = document.getElementById('color-picker');
    const colorR = document.getElementById('color-r');
    const colorG = document.getElementById('color-g'); 
    const colorB = document.getElementById('color-b');
    
    colorPicker.addEventListener('input', (e) => {
      const hex = e.target.value;
      const color = this.hexToRgb(hex);
      this.updateColorInputs(color);
      this.selectedColor = color;
    });
    
    [colorR, colorG, colorB].forEach(input => {
      input.addEventListener('input', () => {
        const color = {
          r: parseInt(colorR.value),
          g: parseInt(colorG.value),
          b: parseInt(colorB.value)
        };
        this.selectedColor = color;
        colorPicker.value = this.rgbToHex(color);
      });
    });
    
    // Color presets
    document.getElementById('color-presets').addEventListener('click', (e) => {
      if (e.target.classList.contains('color-preset-btn')) {
        const color = JSON.parse(e.target.dataset.color);
        this.selectedColor = color;
        this.updateColorInputs(color);
        document.getElementById('color-picker').value = this.rgbToHex(color);
      }
    });
    
    // Button grid
    document.getElementById('button-grid').addEventListener('click', (e) => {
      if (e.target.classList.contains('led-button-preview')) {
        this.selectButton(parseInt(e.target.dataset.buttonId));
      }
    });
    
    // Button actions
    document.getElementById('apply-color-selected').addEventListener('click', () => {
      if (this.selectedButton) {
        this.setButtonColor(this.selectedButton, this.selectedColor);
      }
    });
    
    document.getElementById('apply-color-all').addEventListener('click', () => {
      this.setAllButtons(this.selectedColor);
    });
    
    document.getElementById('copy-color').addEventListener('click', () => {
      this.copySelectedColor();
    });
    
    document.getElementById('paste-color').addEventListener('click', () => {
      this.pasteColor();
    });
    
    // Effects
    document.getElementById('start-effect').addEventListener('click', () => {
      this.startSelectedEffect();
    });
    
    document.getElementById('stop-effect').addEventListener('click', () => {
      this.stopCurrentEffect();
    });
    
    // Speed slider
    document.getElementById('effect-speed').addEventListener('input', (e) => {
      document.getElementById('speed-value').textContent = e.target.value;
    });
    
    // Profile themes
    document.getElementById('save-theme').addEventListener('click', () => {
      this.saveCurrentTheme();
    });
    
    document.getElementById('apply-theme').addEventListener('click', () => {
      this.applySelectedTheme();
    });
    
    document.getElementById('delete-theme').addEventListener('click', () => {
      this.deleteSelectedTheme();
    });
    
    // Advanced settings
    document.getElementById('preview-mode').addEventListener('change', (e) => {
      this.isPreviewMode = e.target.checked;
    });
    
    // Set up IPC event listeners
    this.setupIPCEventListeners();
  }
  
  /**
   * Setup IPC event listeners
   */
  setupIPCEventListeners() {
    // Listen for LED events from main process
    window.electronAPI.on('led-brightness-changed', (brightness) => {
      this.currentBrightness = brightness;
      this.updateBrightnessDisplay(brightness);
    });
    
    window.electronAPI.on('led-effect-started', (effect) => {
      this.updateCurrentEffect(effect);
    });
    
    window.electronAPI.on('led-effect-stopped', () => {
      this.updateCurrentEffect(null);
    });
    
    window.electronAPI.on('led-colors-updated', (colors) => {
      this.updateButtonColors(colors);
    });
  }
  
  /**
   * Initialize event listeners for external communication
   */
  initializeEventListeners() {
    // This method can be overridden or extended
  }
  
  /**
   * Show the LED manager
   */
  show() {
    if (!this.container) {
      this.initialize();
    }
    
    this.container.style.display = 'block';
    this.isVisible = true;
    
    // Refresh status when shown
    this.loadLEDStatus();
    
    this.emit('shown');
  }
  
  /**
   * Hide the LED manager
   */
  hide() {
    if (this.container) {
      this.container.style.display = 'none';
    }
    this.isVisible = false;
    
    this.emit('hidden');
  }
  
  /**
   * Update brightness display
   */
  updateBrightnessDisplay(brightness) {
    document.getElementById('brightness-value').textContent = brightness;
    document.getElementById('brightness-slider').value = brightness;
  }
  
  /**
   * Update color inputs
   */
  updateColorInputs(color) {
    document.getElementById('color-r').value = color.r;
    document.getElementById('color-g').value = color.g;
    document.getElementById('color-b').value = color.b;
  }
  
  /**
   * Select a button in the grid
   */
  selectButton(buttonId) {
    // Remove previous selection
    document.querySelectorAll('.led-button-preview.selected').forEach(btn => {
      btn.classList.remove('selected');
    });
    
    // Select new button
    const button = document.querySelector(`[data-button-id="${buttonId}"]`);
    if (button) {
      button.classList.add('selected');
      this.selectedButton = buttonId;
      
      // Enable apply to selected button
      document.getElementById('apply-color-selected').disabled = false;
    }
  }
  
  /**
   * Set brightness
   */
  async setBrightness(brightness) {
    try {
      await window.electronAPI.invoke('set-led-brightness', brightness);
      this.currentBrightness = brightness;
      this.showSuccess(`Brightness set to ${Math.round((brightness / 255) * 100)}%`);
    } catch (error) {
      console.error('Error setting brightness:', error);
      this.showError('Failed to set brightness');
    }
  }
  
  /**
   * Set button color
   */
  async setButtonColor(buttonId, color) {
    try {
      await window.electronAPI.invoke('set-led-button-color', buttonId, color);
      this.updateButtonPreview(buttonId, color);
      this.showSuccess(`Button ${buttonId} color updated`);
    } catch (error) {
      console.error('Error setting button color:', error);
      this.showError('Failed to set button color');
    }
  }
  
  /**
   * Set all buttons to same color
   */
  async setAllButtons(color) {
    try {
      await window.electronAPI.invoke('set-led-all-buttons', color);
      
      // Update all button previews
      document.querySelectorAll('.led-button-preview').forEach(button => {
        this.updateButtonPreview(parseInt(button.dataset.buttonId), color);
      });
      
      this.showSuccess('All buttons updated');
    } catch (error) {
      console.error('Error setting all button colors:', error);
      this.showError('Failed to set button colors');
    }
  }
  
  /**
   * Clear all LEDs
   */
  async clearAllLEDs() {
    try {
      await window.electronAPI.invoke('clear-all-leds');
      
      // Update all button previews to black
      document.querySelectorAll('.led-button-preview').forEach(button => {
        this.updateButtonPreview(parseInt(button.dataset.buttonId), { r: 0, g: 0, b: 0 });
      });
      
      this.showSuccess('All LEDs cleared');
    } catch (error) {
      console.error('Error clearing LEDs:', error);
      this.showError('Failed to clear LEDs');
    }
  }
  
  /**
   * Run test pattern
   */
  async runTestPattern() {
    try {
      await window.electronAPI.invoke('run-led-test-pattern');
      this.showSuccess('Running test pattern');
    } catch (error) {
      console.error('Error running test pattern:', error);
      this.showError('Failed to run test pattern');
    }
  }
  
  /**
   * Start selected effect
   */
  async startSelectedEffect() {
    const effectSelect = document.getElementById('effect-select');
    const speedSlider = document.getElementById('effect-speed');
    
    const effectName = effectSelect.value;
    const speed = parseInt(speedSlider.value);
    
    if (!effectName) {
      this.showError('Please select an effect');
      return;
    }
    
    try {
      await window.electronAPI.invoke('start-led-effect', effectName, speed);
      this.showSuccess(`Started ${effectName} effect`);
    } catch (error) {
      console.error('Error starting effect:', error);
      this.showError('Failed to start effect');
    }
  }
  
  /**
   * Stop current effect
   */
  async stopCurrentEffect() {
    try {
      await window.electronAPI.invoke('stop-led-effect');
      this.updateCurrentEffect(null);
      this.showSuccess('Effect stopped');
    } catch (error) {
      console.error('Error stopping effect:', error);
      this.showError('Failed to stop effect');
    }
  }
  
  /**
   * Update current effect display
   */
  updateCurrentEffect(effect) {
    const effectName = document.getElementById('current-effect-name');
    
    if (effect) {
      effectName.textContent = `${effect.name} (Speed: ${effect.speed})`;
    } else {
      effectName.textContent = 'None';
    }
  }
  
  /**
   * Update button colors display
   */
  updateButtonColors(colors) {
    Object.entries(colors).forEach(([buttonId, color]) => {
      this.updateButtonPreview(parseInt(buttonId), color);
    });
  }
  
  /**
   * Update individual button preview
   */
  updateButtonPreview(buttonId, color) {
    const button = document.querySelector(`[data-button-id="${buttonId}"]`);
    if (button) {
      button.style.backgroundColor = `rgb(${color.r}, ${color.g}, ${color.b})`;
      button.style.color = this.getContrastColor(color);
    }
  }
  
  /**
   * Get contrasting color for text
   */
  getContrastColor(color) {
    const brightness = (color.r * 299 + color.g * 587 + color.b * 114) / 1000;
    return brightness > 128 ? '#000000' : '#ffffff';
  }
  
  /**
   * Copy selected color to clipboard
   */
  copySelectedColor() {
    const colorData = {
      hex: this.rgbToHex(this.selectedColor),
      rgb: this.selectedColor
    };
    
    navigator.clipboard.writeText(JSON.stringify(colorData)).then(() => {
      this.showSuccess('Color copied to clipboard');
      document.getElementById('paste-color').disabled = false;
    }).catch(error => {
      console.error('Error copying color:', error);
      this.showError('Failed to copy color');
    });
  }
  
  /**
   * Paste color from clipboard
   */
  async pasteColor() {
    try {
      const text = await navigator.clipboard.readText();
      const colorData = JSON.parse(text);
      
      if (colorData.rgb) {
        this.selectedColor = colorData.rgb;
        this.updateColorInputs(this.selectedColor);
        document.getElementById('color-picker').value = this.rgbToHex(this.selectedColor);
        this.showSuccess('Color pasted from clipboard');
      } else {
        this.showError('Invalid color data in clipboard');
      }
    } catch (error) {
      console.error('Error pasting color:', error);
      this.showError('Failed to paste color');
    }
  }
  
  /**
   * Load profile list
   */
  async loadProfileList() {
    try {
      const profiles = await window.electronAPI.invoke('get-profiles');
      const select = document.getElementById('theme-profile');
      
      // Clear existing options except first
      while (select.children.length > 1) {
        select.removeChild(select.lastChild);
      }
      
      profiles.forEach(profile => {
        const option = document.createElement('option');
        option.value = profile.id;
        option.textContent = profile.name;
        select.appendChild(option);
      });
    } catch (error) {
      console.error('Error loading profiles:', error);
    }
  }
  
  /**
   * Save current theme
   */
  async saveCurrentTheme() {
    const profileSelect = document.getElementById('theme-profile');
    const profileId = profileSelect.value;
    
    if (!profileId) {
      this.showError('Please select a profile');
      return;
    }
    
    try {
      // Get current LED state
      const currentColors = {};
      document.querySelectorAll('.led-button-preview').forEach(button => {
        const buttonId = parseInt(button.dataset.buttonId);
        const style = window.getComputedStyle(button);
        const bgColor = style.backgroundColor;
        
        // Parse RGB color
        const matches = bgColor.match(/rgb\\((\\d+), (\\d+), (\\d+)\\)/);
        if (matches) {
          currentColors[buttonId] = {
            r: parseInt(matches[1]),
            g: parseInt(matches[2]),
            b: parseInt(matches[3])
          };
        }
      });
      
      const theme = {
        buttonColors: currentColors,
        brightness: this.currentBrightness,
        effect: this.getCurrentEffect()
      };
      
      await window.electronAPI.invoke('save-led-theme', profileId, theme);
      this.showSuccess('Theme saved successfully');
    } catch (error) {
      console.error('Error saving theme:', error);
      this.showError('Failed to save theme');
    }
  }
  
  /**
   * Apply selected theme
   */
  async applySelectedTheme() {
    const profileSelect = document.getElementById('theme-profile');
    const profileId = profileSelect.value;
    
    if (!profileId) {
      this.showError('Please select a profile');
      return;
    }
    
    try {
      await window.electronAPI.invoke('apply-led-theme', profileId);
      this.showSuccess('Theme applied successfully');
      
      // Refresh display
      await this.loadLEDStatus();
    } catch (error) {
      console.error('Error applying theme:', error);
      this.showError('Failed to apply theme');
    }
  }
  
  /**
   * Delete selected theme
   */
  async deleteSelectedTheme() {
    const profileSelect = document.getElementById('theme-profile');
    const profileId = profileSelect.value;
    
    if (!profileId) {
      this.showError('Please select a profile');
      return;
    }
    
    if (!confirm('Are you sure you want to delete this theme?')) {
      return;
    }
    
    try {
      await window.electronAPI.invoke('delete-led-theme', profileId);
      this.showSuccess('Theme deleted successfully');
    } catch (error) {
      console.error('Error deleting theme:', error);
      this.showError('Failed to delete theme');
    }
  }
  
  /**
   * Get current effect
   */
  getCurrentEffect() {
    const effectName = document.getElementById('current-effect-name').textContent;
    if (effectName !== 'None') {
      const speed = parseInt(document.getElementById('effect-speed').value);
      return { name: effectName.split(' ')[0], speed };
    }
    return null;
  }
  
  /**
   * Utility functions
   */
  hexToRgb(hex) {
    const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }
  
  rgbToHex(color) {
    const r = Math.max(0, Math.min(255, color.r)).toString(16).padStart(2, '0');
    const g = Math.max(0, Math.min(255, color.g)).toString(16).padStart(2, '0');
    const b = Math.max(0, Math.min(255, color.b)).toString(16).padStart(2, '0');
    
    return `#${r}${g}${b}`;
  }
  
  /**
   * Show success message
   */
  showSuccess(message) {
    this.showMessage(message, 'success');
  }
  
  /**
   * Show error message
   */
  showError(message) {
    this.showMessage(message, 'error');
  }
  
  /**
   * Show message with type
   */
  showMessage(message, type = 'info') {
    const container = document.getElementById('led-messages');
    
    const messageEl = document.createElement('div');
    messageEl.className = `message message-${type}`;
    messageEl.textContent = message;
    
    container.appendChild(messageEl);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (messageEl.parentNode) {
        messageEl.parentNode.removeChild(messageEl);
      }
    }, 3000);
  }
  
  /**
   * Event emitter functionality
   */
  emit(event, data) {
    // Could implement custom event system here
    console.log(`LED Manager Event: ${event}`, data);
  }
  
  /**
   * Cleanup and destroy
   */
  destroy() {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    
    this.selectedButton = null;
    this.currentTheme = null;
    this.isVisible = false;
    
    console.log('LEDManagerUI destroyed');
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LEDManagerUI;
} else {
  window.LEDManagerUI = LEDManagerUI;
}