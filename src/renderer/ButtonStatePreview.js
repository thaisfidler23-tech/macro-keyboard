/**
 * Button State Preview System
 * 
 * Provides visual feedback for button states, active configurations,
 * and real-time hardware status with animations and interactive elements.
 */

class ButtonStatePreview {
  constructor(container, config = {}) {
    this.container = container;
    this.config = config;
    
    // State tracking
    this.buttonStates = new Map();
    this.encoderStates = new Map();
    this.activeAnimations = new Map();
    
    // Configuration
    this.options = {
      animationDuration: 200,
      pressAnimationDuration: 100,
      showLabels: true,
      showDescriptions: true,
      enableHoverEffects: true,
      showShortcuts: true,
      layout: 'auto', // auto, grid, linear
      ...config.options
    };

    this.init();
  }

  init() {
    this.createPreviewInterface();
    this.updateLayout();
    this.setupEventListeners();
  }

  /**
   * Create the visual preview interface
   */
  createPreviewInterface() {
    this.container.innerHTML = `
      <div class="button-state-preview">
        <div class="preview-header">
          <h3>Hardware Preview</h3>
          <div class="preview-controls">
            <button class="btn small" id="toggle-labels" title="Toggle button labels">🏷️</button>
            <button class="btn small" id="toggle-descriptions" title="Toggle descriptions">📝</button>
            <button class="btn small" id="toggle-shortcuts" title="Toggle shortcuts">⌨️</button>
            <button class="btn small" id="simulate-mode" title="Toggle simulation mode">🎮</button>
          </div>
        </div>
        <div class="hardware-layout" id="hardware-layout">
          <!-- Buttons and encoders will be generated here -->
        </div>
        <div class="activity-log" id="activity-log">
          <h4>Recent Activity</h4>
          <div class="activity-list" id="activity-list">
            <!-- Activity items will be added here -->
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Update the hardware layout based on current configuration
   */
  updateLayout() {
    const layoutContainer = this.container.querySelector('#hardware-layout');
    const buttonCount = this.config.device?.buttons || 8;
    const encoderCount = this.config.device?.encoders || 0;

    // Clear existing layout
    layoutContainer.innerHTML = '';

    // Create buttons section
    if (buttonCount > 0) {
      const buttonsSection = document.createElement('div');
      buttonsSection.className = 'buttons-section';
      buttonsSection.innerHTML = '<h4>Buttons</h4>';
      
      const buttonsGrid = document.createElement('div');
      buttonsGrid.className = `buttons-grid buttons-${buttonCount}`;
      
      for (let i = 1; i <= buttonCount; i++) {
        const buttonElement = this.createButtonElement(i);
        buttonsGrid.appendChild(buttonElement);
        
        // Initialize button state
        this.buttonStates.set(`button${i}`, {
          pressed: false,
          active: false,
          lastAction: null,
          timestamp: null
        });
      }
      
      buttonsSection.appendChild(buttonsGrid);
      layoutContainer.appendChild(buttonsSection);
    }

    // Create encoders section
    if (encoderCount > 0) {
      const encodersSection = document.createElement('div');
      encodersSection.className = 'encoders-section';
      encodersSection.innerHTML = '<h4>Encoders</h4>';
      
      const encodersGrid = document.createElement('div');
      encodersGrid.className = 'encoders-grid';
      
      for (let i = 1; i <= encoderCount; i++) {
        const encoderElement = this.createEncoderElement(i);
        encodersGrid.appendChild(encoderElement);
        
        // Initialize encoder state
        this.encoderStates.set(`encoder${i}`, {
          rotation: 0,
          direction: null,
          active: false,
          lastAction: null,
          timestamp: null
        });
      }
      
      encodersSection.appendChild(encodersGrid);
      layoutContainer.appendChild(encodersSection);
    }
  }

  /**
   * Create a button preview element
   */
  createButtonElement(buttonId) {
    const buttonConfig = this.config.buttons?.[`button${buttonId}`] || {};
    const hasAction = buttonConfig.action && buttonConfig.type;
    
    const element = document.createElement('div');
    element.className = `preview-button ${hasAction ? 'has-action' : 'no-action'}`;
    element.dataset.buttonId = buttonId;
    
    element.innerHTML = `
      <div class="button-visual">
        <div class="button-number">${buttonId}</div>
        <div class="button-status-indicator"></div>
      </div>
      <div class="button-info">
        <div class="button-label" ${!this.options.showLabels ? 'style="display: none;"' : ''}>
          ${buttonConfig.description || `Button ${buttonId}`}
        </div>
        <div class="button-action" ${!this.options.showShortcuts ? 'style="display: none;"' : ''}>
          ${this.formatButtonAction(buttonConfig)}
        </div>
        <div class="button-description" ${!this.options.showDescriptions ? 'style="display: none;"' : ''}>
          ${this.getActionTypeDisplay(buttonConfig.type)}
        </div>
      </div>
    `;

    // Add interaction handlers
    if (hasAction) {
      element.addEventListener('click', () => this.simulateButtonPress(buttonId));
      element.addEventListener('mouseenter', () => this.highlightButton(buttonId, true));
      element.addEventListener('mouseleave', () => this.highlightButton(buttonId, false));
    }

    return element;
  }

  /**
   * Create an encoder preview element
   */
  createEncoderElement(encoderId) {
    const encoderConfig = this.config.encoders?.[`encoder${encoderId}`] || {};
    const hasCWAction = encoderConfig.actionCW && encoderConfig.typeCW;
    const hasCCWAction = encoderConfig.actionCCW && encoderConfig.typeCCW;
    
    const element = document.createElement('div');
    element.className = `preview-encoder ${(hasCWAction || hasCCWAction) ? 'has-action' : 'no-action'}`;
    element.dataset.encoderId = encoderId;
    
    element.innerHTML = `
      <div class="encoder-visual">
        <div class="encoder-knob">
          <div class="encoder-indicator"></div>
          <div class="encoder-number">${encoderId}</div>
        </div>
        <div class="rotation-indicator">
          <div class="rotation-arrow cw" title="Clockwise">↻</div>
          <div class="rotation-arrow ccw" title="Counter-clockwise">↺</div>
        </div>
      </div>
      <div class="encoder-info">
        <div class="encoder-label" ${!this.options.showLabels ? 'style="display: none;"' : ''}>
          ${encoderConfig.description || `Encoder ${encoderId}`}
        </div>
        <div class="encoder-actions" ${!this.options.showShortcuts ? 'style="display: none;"' : ''}>
          <div class="encoder-action-cw">
            <span class="action-direction">CW:</span>
            ${this.formatEncoderAction(encoderConfig, 'CW')}
          </div>
          <div class="encoder-action-ccw">
            <span class="action-direction">CCW:</span>
            ${this.formatEncoderAction(encoderConfig, 'CCW')}
          </div>
        </div>
        <div class="encoder-description" ${!this.options.showDescriptions ? 'style="display: none;"' : ''}>
          Rotary Encoder
        </div>
      </div>
    `;

    // Add interaction handlers
    if (hasCWAction || hasCCWAction) {
      const cwArrow = element.querySelector('.rotation-arrow.cw');
      const ccwArrow = element.querySelector('.rotation-arrow.ccw');
      
      if (hasCWAction) {
        cwArrow.addEventListener('click', () => this.simulateEncoderRotation(encoderId, 'CW'));
        cwArrow.style.cursor = 'pointer';
      }
      
      if (hasCCWAction) {
        ccwArrow.addEventListener('click', () => this.simulateEncoderRotation(encoderId, 'CCW'));
        ccwArrow.style.cursor = 'pointer';
      }
    }

    return element;
  }

  /**
   * Format button action for display
   */
  formatButtonAction(buttonConfig) {
    if (!buttonConfig.action || !buttonConfig.type) {
      return '<span class="no-action-text">No action assigned</span>';
    }

    const shortcut = buttonConfig.shortcutDisplay || buttonConfig.action;
    
    switch (buttonConfig.type) {
      case 'keypress':
        return `<span class="shortcut-display">${shortcut}</span>`;
      case 'command':
        return `<span class="command-display">${this.truncateText(buttonConfig.action, 20)}</span>`;
      case 'application':
        return `<span class="app-display">${this.truncateText(buttonConfig.action, 20)}</span>`;
      default:
        return `<span class="unknown-action">${this.truncateText(buttonConfig.action, 20)}</span>`;
    }
  }

  /**
   * Format encoder action for display
   */
  formatEncoderAction(encoderConfig, direction) {
    const actionKey = `action${direction}`;
    const typeKey = `type${direction}`;
    const shortcutKey = `shortcutDisplay${direction}`;
    
    if (!encoderConfig[actionKey] || !encoderConfig[typeKey]) {
      return '<span class="no-action-text">None</span>';
    }

    const shortcut = encoderConfig[shortcutKey] || encoderConfig[actionKey];
    
    switch (encoderConfig[typeKey]) {
      case 'keypress':
        return `<span class="shortcut-display">${shortcut}</span>`;
      case 'command':
        return `<span class="command-display">${this.truncateText(encoderConfig[actionKey], 15)}</span>`;
      case 'application':
        return `<span class="app-display">${this.truncateText(encoderConfig[actionKey], 15)}</span>`;
      default:
        return `<span class="unknown-action">${this.truncateText(encoderConfig[actionKey], 15)}</span>`;
    }
  }

  /**
   * Get action type display name
   */
  getActionTypeDisplay(type) {
    const typeMap = {
      'keypress': '⌨️ Keyboard',
      'command': '💻 Command', 
      'application': '🚀 Launch App',
      '': '❌ Not set'
    };
    return typeMap[type] || '❓ Unknown';
  }

  /**
   * Truncate text for display
   */
  truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  /**
   * Simulate button press with visual feedback
   */
  simulateButtonPress(buttonId) {
    const buttonElement = this.container.querySelector(`[data-button-id="${buttonId}"]`);
    const state = this.buttonStates.get(`button${buttonId}`);
    
    if (!buttonElement || !state) return;

    // Update state
    state.pressed = true;
    state.active = true;
    state.lastAction = Date.now();
    state.timestamp = new Date();

    // Visual feedback
    this.animateButtonPress(buttonElement);
    
    // Log activity
    const buttonConfig = this.config.buttons?.[`button${buttonId}`] || {};
    this.logActivity('button', buttonId, 'press', buttonConfig.action || 'No action');

    // Reset pressed state after animation
    setTimeout(() => {
      state.pressed = false;
      buttonElement.classList.remove('pressed');
    }, this.options.pressAnimationDuration);

    // Reset active state after longer delay
    setTimeout(() => {
      state.active = false;
      buttonElement.classList.remove('active');
    }, this.options.animationDuration * 3);
  }

  /**
   * Simulate encoder rotation with visual feedback
   */
  simulateEncoderRotation(encoderId, direction) {
    const encoderElement = this.container.querySelector(`[data-encoder-id="${encoderId}"]`);
    const state = this.encoderStates.get(`encoder${encoderId}`);
    
    if (!encoderElement || !state) return;

    // Update state
    state.direction = direction;
    state.rotation += direction === 'CW' ? 1 : -1;
    state.active = true;
    state.lastAction = Date.now();
    state.timestamp = new Date();

    // Visual feedback
    this.animateEncoderRotation(encoderElement, direction);
    
    // Log activity
    const encoderConfig = this.config.encoders?.[`encoder${encoderId}`] || {};
    const action = encoderConfig[`action${direction}`] || 'No action';
    this.logActivity('encoder', encoderId, direction.toLowerCase(), action);

    // Reset active state
    setTimeout(() => {
      state.active = false;
      encoderElement.classList.remove('active');
    }, this.options.animationDuration * 2);
  }

  /**
   * Animate button press
   */
  animateButtonPress(element) {
    element.classList.add('pressed', 'active');
    
    // Add ripple effect
    const ripple = document.createElement('div');
    ripple.className = 'button-ripple';
    element.querySelector('.button-visual').appendChild(ripple);
    
    // Remove ripple after animation
    setTimeout(() => {
      if (ripple.parentNode) {
        ripple.parentNode.removeChild(ripple);
      }
    }, this.options.pressAnimationDuration * 2);
  }

  /**
   * Animate encoder rotation
   */
  animateEncoderRotation(element, direction) {
    const knob = element.querySelector('.encoder-knob');
    const arrow = element.querySelector(`.rotation-arrow.${direction.toLowerCase()}`);
    
    // Add active classes
    element.classList.add('active');
    knob.classList.add(`rotating-${direction.toLowerCase()}`);
    arrow.classList.add('active');

    // Remove animation classes
    setTimeout(() => {
      knob.classList.remove(`rotating-${direction.toLowerCase()}`);
      arrow.classList.remove('active');
    }, this.options.animationDuration);
  }

  /**
   * Highlight button on hover
   */
  highlightButton(buttonId, highlight) {
    if (!this.options.enableHoverEffects) return;
    
    const buttonElement = this.container.querySelector(`[data-button-id="${buttonId}"]`);
    if (buttonElement) {
      if (highlight) {
        buttonElement.classList.add('highlighted');
      } else {
        buttonElement.classList.remove('highlighted');
      }
    }
  }

  /**
   * Log activity in the preview
   */
  logActivity(type, id, action, command) {
    const activityList = this.container.querySelector('#activity-list');
    if (!activityList) return;

    const timestamp = new Date().toLocaleTimeString();
    const activityItem = document.createElement('div');
    activityItem.className = `activity-item activity-${type}`;
    
    const actionIcon = type === 'button' ? '🔘' : (action === 'cw' ? '↻' : '↺');
    const actionText = type === 'button' ? 'Pressed' : `Rotated ${action.toUpperCase()}`;
    
    activityItem.innerHTML = `
      <div class="activity-icon">${actionIcon}</div>
      <div class="activity-details">
        <div class="activity-action">
          ${type.charAt(0).toUpperCase() + type.slice(1)} ${id} ${actionText}
        </div>
        <div class="activity-command">${command}</div>
        <div class="activity-timestamp">${timestamp}</div>
      </div>
    `;

    // Add to top of list
    activityList.insertBefore(activityItem, activityList.firstChild);

    // Limit number of items
    const maxItems = 10;
    while (activityList.children.length > maxItems) {
      activityList.removeChild(activityList.lastChild);
    }

    // Animate in
    activityItem.style.opacity = '0';
    activityItem.style.transform = 'translateY(-10px)';
    
    requestAnimationFrame(() => {
      activityItem.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      activityItem.style.opacity = '1';
      activityItem.style.transform = 'translateY(0)';
    });
  }

  /**
   * Update configuration and refresh display
   */
  updateConfiguration(newConfig) {
    this.config = newConfig;
    this.updateLayout();
  }

  /**
   * Handle real hardware events
   */
  handleHardwareEvent(event) {
    if (event.type === 'button') {
      this.simulateButtonPress(event.id);
    } else if (event.type === 'encoder') {
      this.simulateEncoderRotation(event.id, event.direction);
    }
  }

  /**
   * Setup event listeners for controls
   */
  setupEventListeners() {
    // Toggle controls
    const toggleLabels = this.container.querySelector('#toggle-labels');
    const toggleDescriptions = this.container.querySelector('#toggle-descriptions');
    const toggleShortcuts = this.container.querySelector('#toggle-shortcuts');
    const simulateMode = this.container.querySelector('#simulate-mode');

    toggleLabels?.addEventListener('click', () => {
      this.options.showLabels = !this.options.showLabels;
      this.toggleDisplay('.button-label, .encoder-label', this.options.showLabels);
      toggleLabels.classList.toggle('active', this.options.showLabels);
    });

    toggleDescriptions?.addEventListener('click', () => {
      this.options.showDescriptions = !this.options.showDescriptions;
      this.toggleDisplay('.button-description, .encoder-description', this.options.showDescriptions);
      toggleDescriptions.classList.toggle('active', this.options.showDescriptions);
    });

    toggleShortcuts?.addEventListener('click', () => {
      this.options.showShortcuts = !this.options.showShortcuts;
      this.toggleDisplay('.button-action, .encoder-actions', this.options.showShortcuts);
      toggleShortcuts.classList.toggle('active', this.options.showShortcuts);
    });

    simulateMode?.addEventListener('click', () => {
      this.container.classList.toggle('simulation-mode');
      simulateMode.classList.toggle('active');
    });
  }

  /**
   * Toggle display of elements
   */
  toggleDisplay(selector, show) {
    const elements = this.container.querySelectorAll(selector);
    elements.forEach(element => {
      element.style.display = show ? '' : 'none';
    });
  }

  /**
   * Destroy the preview system
   */
  destroy() {
    // Clear all animations
    this.activeAnimations.clear();
    
    // Clear states
    this.buttonStates.clear();
    this.encoderStates.clear();
    
    // Remove event listeners (they'll be removed with the DOM)
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

// Export for use in renderer
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ButtonStatePreview;
} else {
  window.ButtonStatePreview = ButtonStatePreview;
}