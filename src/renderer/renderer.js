const { ipcRenderer } = require('electron');

// Profile Management API wrapper
window.electronAPI = {
  // Generic IPC invoke for validation endpoint compatibility
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),

  // Profile management methods
  getProfiles: () => ipcRenderer.invoke('get-profiles'),
  getActiveProfileName: () => ipcRenderer.invoke('get-active-profile-name'),
  activateProfile: (profileName) => ipcRenderer.invoke('activate-profile', profileName),
  createProfile: (name, baseConfig, description) => ipcRenderer.invoke('create-profile', name, baseConfig, description),
  updateProfile: (profileName, newConfig, description) => ipcRenderer.invoke('update-profile', profileName, newConfig, description),
  updateProfileDescription: (profileName, description) => ipcRenderer.invoke('update-profile', profileName, null, description),
  deleteProfile: (profileName) => ipcRenderer.invoke('delete-profile', profileName),
  duplicateProfile: (sourceProfileName, newProfileName, description) => ipcRenderer.invoke('duplicate-profile', sourceProfileName, newProfileName, description),
  exportProfile: (profileName, exportPath) => ipcRenderer.invoke('export-profile', profileName, exportPath),
  importProfile: (importPath, profileName, overwrite) => ipcRenderer.invoke('import-profile', importPath, profileName, overwrite),
  getProfileStatistics: () => ipcRenderer.invoke('get-profile-statistics'),
  
  // File dialog methods
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  
  // Update management methods
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  getUpdateStatus: () => ipcRenderer.invoke('get-update-status'),
  setAutoUpdateEnabled: (enabled) => ipcRenderer.invoke('set-auto-update-enabled', enabled),
  getUpdateStatistics: () => ipcRenderer.invoke('get-update-statistics'),
  
  // Update event listeners
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (event, updateInfo) => callback(updateInfo));
  },
  onUpdateNotAvailable: (callback) => {
    ipcRenderer.on('update-not-available', () => callback());
  },
  onUpdateDownloadProgress: (callback) => {
    ipcRenderer.on('update-download-progress', (event, progress) => callback(progress));
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', (event, updateInfo) => callback(updateInfo));
  },
  onUpdateError: (callback) => {
    ipcRenderer.on('update-error', (event, error) => callback(error));
  }
};

class ConfigUI {
  constructor() {
    this.config = {};
    this.errorQueue = [];
    this.maxErrorHistory = 20;
    this.availablePorts = {};
    this.lastConnectionStatus = 'unknown';
    this.buttonStatePreview = null;
    this.updateUI = null;
    this.init();
  }

  async init() {
    await this.loadConfig();
    this.setupEventListeners();
    this.setupErrorHandling();
    this.updateUI();
    await this.loadSerialPorts();
    await this.loadConnectionStatus();
    this.createErrorNotificationSystem();
    this.initializeHardwarePreview();
    this.initializeUpdateUI();
    
    // Perform initial configuration validation
    await this.validateCurrentConfig();
  }

  async loadConfig() {
    try {
      this.config = await ipcRenderer.invoke('get-config');
      // Config loaded successfully
    } catch (error) {
      // Log error through main process instead of console
      await ipcRenderer.invoke('log-error', 'Error loading config: ' + error.message);
    }
  }

  async loadConnectionStatus() {
    try {
      const connectionInfo = await ipcRenderer.invoke('get-connection-status');
      if (connectionInfo) {
        const stateMapping = {
          CONNECTING: 'connecting',
          CONNECTED: 'connected',
          RECONNECTING: 'reconnecting',
          DISCONNECTED: 'disconnected',
          FAILED: 'failed'
        };
        
        const uiState = stateMapping[connectionInfo.state] || 'unknown';
        this.updateConnectionStatus(uiState, connectionInfo.port);
      }
    } catch (error) {
      await ipcRenderer.invoke('log-error', 'Error loading connection status: ' + error.message);
    }
  }

  setupEventListeners() {
    // Header buttons
    document.getElementById('reload-config').addEventListener('click', async () => {
      this.config = await ipcRenderer.invoke('reload-config');
      this.updateUI();
      this.showMessage('Configuration reloaded successfully!');
    });

    document.getElementById('save-config').addEventListener('click', async () => {
      await this.saveConfig();
    });

    document.getElementById('validate-config').addEventListener('click', async () => {
      await this.validateCurrentConfig();
    });

    // Device settings
    document.getElementById('refresh-ports').addEventListener('click', () => {
      this.loadSerialPorts();
    });

    document.getElementById('button-count').addEventListener('change', (e) => {
      this.config.device.buttons = parseInt(e.target.value);
      this.generateButtonConfig();
    });

    document.getElementById('encoder-count').addEventListener('change', (e) => {
      this.config.device.encoders = parseInt(e.target.value);
      this.generateEncoderConfig();
    });

    document.getElementById('serial-port').addEventListener('change', (e) => {
      this.config.device.serialPort = e.target.value;
      this.updatePortDetails(e.target.value);
      this.updateTestButtonState();
    });

    document.getElementById('baud-rate').addEventListener('change', (e) => {
      this.config.device.baudRate = parseInt(e.target.value);
    });

    // Connection testing
    document.getElementById('test-connection').addEventListener('click', async () => {
      await this.testConnection();
    });

    // Hardware configuration buttons
    document.getElementById('apply-hardware-config').addEventListener('click', async () => {
      await this.applyHardwareConfig();
    });

    document.getElementById('get-hardware-config').addEventListener('click', async () => {
      await this.getArduinoConfig();
    });

    document.getElementById('reset-hardware-config').addEventListener('click', async () => {
      if (confirm('Are you sure you want to reset the Arduino to default configuration?')) {
        await this.resetArduinoConfig();
      }
    });

        // Listen for config reload from main process
    ipcRenderer.on('config-reloaded', (event, config) => {
      this.config = config;
      this.updateUI();
      this.updateHardwarePreview();
    });

    // Listen for hardware events from main process
    ipcRenderer.on('hardware-event', (event, hardwareEvent) => {
      this.handleHardwareEvent(hardwareEvent);
    });
  }

  /**
   * Set up error handling and notifications from main process
   */
  setupErrorHandling() {
    // Error notifications from main process
    ipcRenderer.on('error-notification', (event, notification) => {
      this.handleErrorNotification(notification);
    });

    // Error recovery notifications
    ipcRenderer.on('error-recovered', (event, { error, component }) => {
      this.handleErrorRecovery(error, component);
    });

    // Device connection events
    ipcRenderer.on('device-connected', (event, port) => {
      this.handleDeviceConnected(port);
    });

    ipcRenderer.on('device-disconnected', () => {
      this.handleDeviceDisconnected();
    });

    ipcRenderer.on('device-connection-failed', () => {
      this.handleDeviceConnectionFailed();
    });

    // Serial state changes
    ipcRenderer.on('serial-state-change', (event, { newState, oldState }) => {
      this.handleSerialStateChange(newState, oldState);
    });

    // Offline mode notifications
    ipcRenderer.on('offline-mode', (event, enabled) => {
      this.handleOfflineMode(enabled);
    });

    // Action feedback events
    ipcRenderer.on('action-started', (event, actionInfo) => {
      this.handleActionStarted(actionInfo);
    });

    ipcRenderer.on('action-completed', (event, actionInfo) => {
      this.handleActionCompleted(actionInfo);
    });

    ipcRenderer.on('action-failed', (event, actionInfo) => {
      this.handleActionFailed(actionInfo);
    });
  }

  /**
   * Create error notification system UI
   */
  createErrorNotificationSystem() {
    // Create notification container if it doesn't exist
    if (!document.getElementById('notification-container')) {
      const container = document.createElement('div');
      container.id = 'notification-container';
      container.className = 'notification-container';
      document.body.appendChild(container);
    }

    // Create error history panel
    if (!document.getElementById('error-history-panel')) {
      const panel = document.createElement('div');
      panel.id = 'error-history-panel';
      panel.className = 'error-history-panel hidden';
      panel.innerHTML = `
        <div class="error-history-header">
          <h3>Error History</h3>
          <button id="close-error-history" class="close-btn">&times;</button>
        </div>
        <div class="error-history-content">
          <div id="error-history-list"></div>
          <button id="clear-error-history" class="btn secondary">Clear History</button>
        </div>
      `;
      document.body.appendChild(panel);

      // Set up error history panel controls
      document.getElementById('close-error-history').addEventListener('click', () => {
        document.getElementById('error-history-panel').classList.add('hidden');
      });

      document.getElementById('clear-error-history').addEventListener('click', () => {
        this.clearErrorHistory();
      });
      
      // Set up error status click handler to show error history
      document.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'error-status') {
          this.toggleErrorHistory();
        }
      });
    }

    // Create error history toggle button
    if (!document.getElementById('error-history-toggle')) {
      const toggle = document.createElement('button');
      toggle.id = 'error-history-toggle';
      toggle.className = 'btn secondary error-history-toggle';
      toggle.innerHTML = '⚠️ Errors (0)';
      toggle.addEventListener('click', () => {
        this.toggleErrorHistory();
      });

      // Add to header
      const header = document.querySelector('.header');
      if (header) {
        header.appendChild(toggle);
      }
    }
  }

  /**
   * Handle error notifications from main process
   */
  handleErrorNotification(notification) {
    // Enhance notification with category detection
    const enhancedNotification = {
      ...notification,
      timestamp: new Date().toISOString(),
      category: this.categorizeError(notification)
    };

    // Add to error queue
    this.errorQueue.push(enhancedNotification);

    // Maintain queue size
    if (this.errorQueue.length > this.maxErrorHistory) {
      this.errorQueue = this.errorQueue.slice(-this.maxErrorHistory);
    }

    // Update error counter
    this.updateErrorCounter();

    // Show notification
    this.showErrorNotification(enhancedNotification);

    // Update error history
    this.updateErrorHistory();
  }

  /**
   * Categorize error based on type and context
   */
  categorizeError(notification) {
    const message = notification.message?.toLowerCase() || '';
    const type = notification.type?.toLowerCase() || '';
    const context = notification.context?.toLowerCase() || '';

    // Hardware errors
    if (
      message.includes('serial') || 
      message.includes('port') || 
      message.includes('device') ||
      message.includes('arduino') ||
      message.includes('connection') ||
      type.includes('serial') ||
      type.includes('hardware')
    ) {
      return 'hardware';
    }

    // Configuration errors
    if (
      message.includes('config') || 
      message.includes('validation') || 
      message.includes('schema') ||
      message.includes('button') ||
      message.includes('encoder') ||
      type.includes('config') ||
      type.includes('validation')
    ) {
      return 'config';
    }

    // Default to system
    return 'system';
  }

  /**
   * Get category icon
   */
  getCategoryIcon(category) {
    const icons = {
      hardware: '🔌',
      config: '⚙️',
      system: '💻'
    };
    return icons[category] || icons.system;
  }

  /**
   * Get recovery suggestions based on error category and content
   */
  getRecoverySuggestions(notification) {
    const category = notification.category || 'system';
    let suggestions = [];

    switch (category) {
      case 'hardware':
        suggestions = [
          'Check serial port connection',
          'Verify Arduino is plugged in',
          'Try a different USB port',
          'Restart the application',
          'Check device permissions'
        ];
        break;
      case 'config':
        suggestions = [
          'Validate configuration file',
          'Check button/encoder settings',
          'Reload default configuration',
          'Review action mappings',
          'Check configuration syntax'
        ];
        break;
      case 'system':
      default:
        suggestions = [
          'Restart the application',
          'Check system permissions',
          'Review error logs',
          'Contact support if persistent'
        ];
        break;
    }

    return suggestions.length > 0 
      ? `<div class="error-actions">
          <strong>Suggested solutions:</strong>
          <ul>${suggestions.map(s => `<li>${s}</li>`).join('')}</ul>
        </div>` 
      : '';
  }

  /**
   * Show user-friendly error notification
   */
  showErrorNotification(notification) {
    const container = document.getElementById('notification-container');
    const notificationElement = document.createElement('div');
    notificationElement.className = `notification error severity-${notification.severity.toLowerCase()} category-${notification.category || 'system'}`;
    
    const severityIcon = this.getSeverityIcon(notification.severity);
    const categoryIcon = this.getCategoryIcon(notification.category);
    const actionsHtml = notification.actions && notification.actions.length > 0 
      ? `<div class="error-actions">
          <strong>Try these solutions:</strong>
          <ul>${notification.actions.map(action => `<li>${action}</li>`).join('')}</ul>
        </div>` 
      : this.getRecoverySuggestions(notification);

    notificationElement.innerHTML = `
      <div class="notification-content">
        <div class="notification-header">
          <span class="category-icon">${categoryIcon}</span>
          <span class="severity-icon">${severityIcon}</span>
          <span class="notification-message">${notification.message}</span>
          <button class="close-notification">&times;</button>
        </div>
        ${actionsHtml}
        <div class="notification-footer">
          <small>Category: ${(notification.category || 'system').toUpperCase()} | Error ID: ${notification.errorId}</small>
          <button class="btn small show-details">Show Details</button>
        </div>
      </div>
    `;

    // Auto-remove based on severity
    const autoRemoveTime = this.getAutoRemoveTime(notification.severity);
    if (autoRemoveTime > 0) {
      setTimeout(() => {
        if (notificationElement.parentNode) {
          notificationElement.remove();
        }
      }, autoRemoveTime);
    }

    // Set up event listeners
    notificationElement.querySelector('.close-notification').addEventListener('click', () => {
      notificationElement.remove();
    });

    notificationElement.querySelector('.show-details').addEventListener('click', () => {
      this.showErrorDetails(notification);
    });

    container.appendChild(notificationElement);
  }

  /**
   * Handle error recovery notifications
   */
  handleErrorRecovery(errorType, component) {
    this.showSuccessNotification(`${component} error recovered: ${errorType}`);
    
    // Update any relevant UI state
    this.updateConnectionStatus();
  }

  /**
   * Handle device connection events
   */
  handleDeviceConnected(port) {
    this.showSuccessNotification(`Macro keyboard connected on ${port}`);
    this.updateConnectionStatus('connected', port);
  }

  handleDeviceDisconnected() {
    this.showWarningNotification('Macro keyboard disconnected. Attempting to reconnect...');
    this.updateConnectionStatus('disconnected');
  }

  handleDeviceConnectionFailed() {
    this.showErrorNotification({
      message: 'Failed to connect to macro keyboard after multiple attempts',
      severity: 'HIGH',
      actions: [
        'Check USB cable connection',
        'Verify Arduino is powered on',
        'Try a different USB port',
        'Restart the application'
      ]
    });
    this.updateConnectionStatus('failed');
  }

  /**
   * Handle serial state changes
   */
  handleSerialStateChange(newState, oldState) {
    // Map SerialConnectionManager states to UI states
    const stateMapping = {
      CONNECTING: 'connecting',
      CONNECTED: 'connected',
      RECONNECTING: 'reconnecting', 
      DISCONNECTED: 'disconnected',
      FAILED: 'failed'
    };

    const stateMessages = {
      CONNECTING: 'Connecting to macro keyboard...',
      CONNECTED: 'Connected to macro keyboard',
      RECONNECTING: 'Reconnecting to macro keyboard...',
      DISCONNECTED: 'Disconnected from macro keyboard',
      FAILED: 'Connection to macro keyboard failed'
    };

    // Update visual status indicator
    this.updateConnectionStatus(stateMapping[newState] || 'unknown');

    // Show appropriate notification
    if (stateMessages[newState]) {
      const isError = newState === 'FAILED';
      if (isError) {
        this.showErrorNotification({ message: stateMessages[newState], severity: 'MEDIUM' });
      } else if (newState === 'CONNECTED') {
        this.showSuccessNotification(stateMessages[newState]);
      } else {
        this.showInfoNotification(stateMessages[newState]);
      }
    }
  }

  /**
   * Handle offline mode
   */
  handleOfflineMode(enabled) {
    if (enabled) {
      this.showWarningNotification('Running in offline mode - commands will be queued until device reconnects');
    } else {
      this.showSuccessNotification('Online mode restored - processing queued commands');
    }
  }

  /**
   * Handle action started feedback
   */
  handleActionStarted(actionInfo) {
    const { type, id, direction } = actionInfo;
    const actionName = type === 'encoder' ? `Encoder ${id} (${direction})` : `Button ${id}`;
    
    // Add visual feedback to the specific button/encoder in UI
    this.highlightActionElement(type, id, 'active');
    
    // Show brief notification for debugging (can be removed in production)
    this.showInfoNotification(`${actionName} pressed`, 1000);
  }

  /**
   * Handle action completed feedback  
   */
  handleActionCompleted(actionInfo) {
    const { type, id, direction, config } = actionInfo;
    const actionName = type === 'encoder' ? `Encoder ${id} (${direction})` : `Button ${id}`;
    
    // Remove active highlight and add success feedback
    this.highlightActionElement(type, id, 'success');
    
    // Show success notification with action details
    const actionDetails = config ? `executed "${config.action}"` : 'action completed';
    this.showSuccessNotification(`${actionName} ${actionDetails}`, 2000);
    
    // Clear highlight after a delay
    setTimeout(() => {
      this.highlightActionElement(type, id, null);
    }, 1500);
  }

  /**
   * Handle action failed feedback
   */
  handleActionFailed(actionInfo) {
    const { type, id, direction, error } = actionInfo;
    const actionName = type === 'encoder' ? `Encoder ${id} (${direction})` : `Button ${id}`;
    
    // Add error highlight
    this.highlightActionElement(type, id, 'error');
    
    // Show error notification
    this.showErrorNotification({
      message: `${actionName} failed: ${error}`,
      severity: 'MEDIUM'
    });
    
    // Clear highlight after a delay
    setTimeout(() => {
      this.highlightActionElement(type, id, null);
    }, 3000);
  }

  /**
   * Add visual feedback to action elements in the UI
   */
  highlightActionElement(type, id, state) {
    const elementId = type === 'encoder' ? `encoder${id}` : `button${id}`;
    const element = document.getElementById(elementId);
    
    if (element) {
      // Remove existing highlight classes
      element.classList.remove('action-active', 'action-success', 'action-error');
      
      // Add new state class if provided
      if (state) {
        element.classList.add(`action-${state}`);
      }
    }
  }

  updateUI() {
    // Update device settings
    document.getElementById('serial-port').value = this.config.device.serialPort || '';
    document.getElementById('baud-rate').value = this.config.device.baudRate || 9600;
    document.getElementById('button-count').value = this.config.device.buttons || 8;
    document.getElementById('encoder-count').value = this.config.device.encoders || 0;

    // Update hardware configuration selectors to match
    document.getElementById('hw-button-count').value = this.config.device.buttons || 8;
    document.getElementById('hw-encoder-count').value = this.config.device.encoders || 0;

    this.generateButtonConfig();
    this.generateEncoderConfig();
  }

  generateButtonConfig() {
    const container = document.getElementById('button-config');
    container.innerHTML = '';

    const buttonCount = this.config.device.buttons || 8;
    
    for (let i = 1; i <= buttonCount; i++) {
      const buttonDiv = document.createElement('div');
      buttonDiv.className = 'config-item';
      
      const buttonConfig = this.config.buttons[`button${i}`] || { action: '', description: '' };
      
      buttonDiv.innerHTML = `
        <h4>Button ${i}</h4>
        <div class="form-group">
          <label>Description:</label>
          <input type="text" id="btn${i}-desc" value="${buttonConfig.description || ''}" placeholder="Button description">
        </div>
        <div class="form-group">
          <label>Action Type:</label>
          <select id="btn${i}-type">
            <option value="">None</option>
            <option value="keypress">Key Press</option>
            <option value="command">Shell Command</option>
            <option value="application">Launch Application</option>
          </select>
        </div>
        <div class="form-group action-input-container">
          <label>Action:</label>
          <input type="text" id="btn${i}-action" value="${buttonConfig.action || ''}" placeholder="Action command/key">
          <div id="btn${i}-shortcut-picker" class="shortcut-picker-container" style="display: none;"></div>
        </div>
      `;
      
      container.appendChild(buttonDiv);

      // Add event listeners for this button
      const descInput = document.getElementById(`btn${i}-desc`);
      const typeSelect = document.getElementById(`btn${i}-type`);
      const actionInput = document.getElementById(`btn${i}-action`);

      descInput.addEventListener('input', () => {
        this.updateButtonConfig(i, 'description', descInput.value);
      });

      typeSelect.addEventListener('change', () => {
        this.updateButtonConfig(i, 'type', typeSelect.value);
        this.toggleShortcutPicker(i, typeSelect.value);
      });

      actionInput.addEventListener('input', () => {
        this.updateButtonConfig(i, 'action', actionInput.value);
      });

      // Set current values
      typeSelect.value = buttonConfig.type || '';
      
      // Initialize shortcut picker if needed
      if (buttonConfig.type === 'keypress') {
        this.toggleShortcutPicker(i, 'keypress');
      }
    }
  }

  generateEncoderConfig() {
    const container = document.getElementById('encoder-config');
    container.innerHTML = '';

    const encoderCount = this.config.device.encoders || 0;
    
    for (let i = 1; i <= encoderCount; i++) {
      const encoderDiv = document.createElement('div');
      encoderDiv.className = 'config-item';
      
      const encoderConfig = this.config.encoders[`encoder${i}`] || { 
        description: '', 
        actionCW: '', 
        actionCCW: '',
        typeCW: '',
        typeCCW: ''
      };
      
      encoderDiv.innerHTML = `
        <h4>Encoder ${i}</h4>
        <div class="form-group">
          <label>Description:</label>
          <input type="text" id="enc${i}-desc" value="${encoderConfig.description || ''}" placeholder="Encoder description">
        </div>
        <div class="encoder-actions">
          <div class="encoder-direction">
            <h5>Clockwise</h5>
            <div class="form-group">
              <label>Action Type:</label>
              <select id="enc${i}-type-cw">
                <option value="">None</option>
                <option value="keypress">Key Press</option>
                <option value="command">Shell Command</option>
                <option value="application">Launch Application</option>
              </select>
            </div>
            <div class="form-group action-input-container">
              <label>Action:</label>
              <input type="text" id="enc${i}-action-cw" value="${encoderConfig.actionCW || ''}" placeholder="CW action">
              <div id="enc${i}-cw-shortcut-picker" class="shortcut-picker-container" style="display: none;"></div>
            </div>
          </div>
          <div class="encoder-direction">
            <h5>Counter-Clockwise</h5>
            <div class="form-group">
              <label>Action Type:</label>
              <select id="enc${i}-type-ccw">
                <option value="">None</option>
                <option value="keypress">Key Press</option>
                <option value="command">Shell Command</option>
                <option value="application">Launch Application</option>
              </select>
            </div>
            <div class="form-group action-input-container">
              <label>Action:</label>
              <input type="text" id="enc${i}-action-ccw" value="${encoderConfig.actionCCW || ''}" placeholder="CCW action">
              <div id="enc${i}-ccw-shortcut-picker" class="shortcut-picker-container" style="display: none;"></div>
            </div>
          </div>
        </div>
      `;
      
      container.appendChild(encoderDiv);

      // Add event listeners for this encoder
      const descInput = document.getElementById(`enc${i}-desc`);
      const typeCWSelect = document.getElementById(`enc${i}-type-cw`);
      const actionCWInput = document.getElementById(`enc${i}-action-cw`);
      const typeCCWSelect = document.getElementById(`enc${i}-type-ccw`);
      const actionCCWInput = document.getElementById(`enc${i}-action-ccw`);

      descInput.addEventListener('input', () => {
        this.updateEncoderConfig(i, 'description', descInput.value);
      });

      typeCWSelect.addEventListener('change', () => {
        this.updateEncoderConfig(i, 'typeCW', typeCWSelect.value);
        this.toggleEncoderShortcutPicker(i, 'cw', typeCWSelect.value);
      });

      actionCWInput.addEventListener('input', () => {
        this.updateEncoderConfig(i, 'actionCW', actionCWInput.value);
      });

      typeCCWSelect.addEventListener('change', () => {
        this.updateEncoderConfig(i, 'typeCCW', typeCCWSelect.value);
        this.toggleEncoderShortcutPicker(i, 'ccw', typeCCWSelect.value);
      });

      actionCCWInput.addEventListener('input', () => {
        this.updateEncoderConfig(i, 'actionCCW', actionCCWInput.value);
      });

      // Set current values
      typeCWSelect.value = encoderConfig.typeCW || '';
      typeCCWSelect.value = encoderConfig.typeCCW || '';
      
      // Initialize shortcut pickers if needed
      if (encoderConfig.typeCW === 'keypress') {
        this.toggleEncoderShortcutPicker(i, 'cw', 'keypress');
      }
      if (encoderConfig.typeCCW === 'keypress') {
        this.toggleEncoderShortcutPicker(i, 'ccw', 'keypress');
      }
    }
  }

  updateButtonConfig(buttonId, field, value) {
    if (!this.config.buttons) {
      this.config.buttons = {};
    }
    if (!this.config.buttons[`button${buttonId}`]) {
      this.config.buttons[`button${buttonId}`] = {};
    }
    this.config.buttons[`button${buttonId}`][field] = value;
    
    // Update hardware preview
    this.updateHardwarePreview();
  }

  updateEncoderConfig(encoderId, field, value) {
    if (!this.config.encoders) {
      this.config.encoders = {};
    }
    if (!this.config.encoders[`encoder${encoderId}`]) {
      this.config.encoders[`encoder${encoderId}`] = {};
    }
    this.config.encoders[`encoder${encoderId}`][field] = value;
    
    // Update hardware preview
    this.updateHardwarePreview();
  }

  /**
   * Initialize the hardware preview system
   */
  initializeHardwarePreview() {
    const previewContainer = document.getElementById('hardware-preview');
    if (previewContainer && typeof ButtonStatePreview !== 'undefined') {
      this.buttonStatePreview = new ButtonStatePreview(previewContainer, {
        options: {
          animationDuration: 200,
          pressAnimationDuration: 100,
          showLabels: true,
          showDescriptions: true,
          enableHoverEffects: true,
          showShortcuts: true,
          layout: 'auto'
        }
      });
      
      // Update with current configuration
      this.updateHardwarePreview();
    }
  }

  /**
   * Update hardware preview with current configuration
   */
  updateHardwarePreview() {
    if (this.buttonStatePreview) {
      this.buttonStatePreview.updateConfiguration(this.config);
    }
  }

  /**
   * Handle hardware events from Arduino
   */
  handleHardwareEvent(hardwareEvent) {
    if (this.buttonStatePreview) {
      this.buttonStatePreview.handleHardwareEvent(hardwareEvent);
    }
    
    // Also log to console for debugging
    console.log('Hardware event received:', hardwareEvent);
  }

  /**
   * Initialize update UI components
   */
  initializeUpdateUI() {
    if (typeof UpdateUI !== 'undefined') {
      this.updateUI = new UpdateUI();
      console.log('UpdateUI initialized');
    } else {
      console.warn('UpdateUI class not available');
    }
  }

  async saveConfig() {
    try {
      await ipcRenderer.invoke('save-config', this.config);
      this.showMessage('Configuration saved successfully!');
      
      // Automatically validate configuration after saving
      await this.validateCurrentConfig();
      
    } catch (error) {
      await ipcRenderer.invoke('log-error', 'Error saving config: ' + error.message);
      this.showMessage('Error saving configuration!', 'error');
    }
  }

  async loadSerialPorts() {
    try {
      const ports = await ipcRenderer.invoke('get-serial-ports');
      const select = document.getElementById('serial-port');
      
      // Store port information for later reference
      this.availablePorts = {};
      
      // Clear existing options except the first one
      while (select.children.length > 1) {
        select.removeChild(select.lastChild);
      }
      
      ports.forEach(port => {
        // Store detailed port information
        this.availablePorts[port.path] = port;
        
        const option = document.createElement('option');
        option.value = port.path;
        option.textContent = `${port.path}${port.manufacturer ? ` - ${port.manufacturer}` : ''}${port.productId ? ` (${port.productId})` : ''}`;
        select.appendChild(option);
      });

      // Set current selection
      select.value = this.config.device.serialPort || '';
      
      // Show port details if a port is selected
      this.updatePortDetails(select.value);
      
      // Enable/disable test button
      this.updateTestButtonState();
      
    } catch (error) {
      await ipcRenderer.invoke('log-error', 'Error loading serial ports: ' + error.message);
      this.showMessage('Failed to load serial ports', 'error');
    }
  }

  updatePortDetails(portPath) {
    const portDetails = document.getElementById('port-details');
    const testButton = document.getElementById('test-connection');
    
    if (!portPath || !this.availablePorts[portPath]) {
      portDetails.style.display = 'none';
      testButton.disabled = true;
      return;
    }
    
    const port = this.availablePorts[portPath];
    portDetails.style.display = 'block';
    testButton.disabled = false;
    
    // Update port information display
    document.getElementById('port-path').textContent = port.path;
    document.getElementById('port-manufacturer').textContent = port.manufacturer || 'Unknown';
    document.getElementById('port-product-id').textContent = port.productId || 'Unknown';
    document.getElementById('port-vendor-id').textContent = port.vendorId || 'Unknown';
    document.getElementById('port-serial-number').textContent = port.serialNumber || 'Unknown';
    
    // Update status based on current connection
    this.updatePortStatus(portPath);
  }

  updatePortStatus(portPath) {
    const statusElement = document.getElementById('port-status');
    if (!statusElement) return;
    
    // Check if this port is currently connected
    const isCurrentPort = this.config?.device?.serialPort === portPath;
    const connectionStatus = this.lastConnectionStatus || 'unknown';
    
    if (isCurrentPort && connectionStatus === 'connected') {
      statusElement.textContent = 'Connected';
      statusElement.className = 'status-indicator status-connected';
    } else if (isCurrentPort && connectionStatus === 'connecting') {
      statusElement.textContent = 'Connecting';
      statusElement.className = 'status-indicator status-testing';
    } else {
      statusElement.textContent = 'Disconnected';
      statusElement.className = 'status-indicator status-disconnected';
    }
  }

  updateTestButtonState() {
    const select = document.getElementById('serial-port');
    const testButton = document.getElementById('test-connection');
    
    if (testButton) {
      testButton.disabled = !select.value;
    }
  }

  async testConnection() {
    const select = document.getElementById('serial-port');
    const testButton = document.getElementById('test-connection');
    const statusElement = document.getElementById('port-status');
    
    if (!select.value) return;
    
    try {
      // Visual feedback - testing state
      testButton.textContent = '🔍 Testing...';
      testButton.className = 'testing';
      testButton.disabled = true;
      
      if (statusElement) {
        statusElement.textContent = 'Testing';
        statusElement.className = 'status-indicator status-testing';
      }
      
      // Test connection via IPC
      const result = await ipcRenderer.invoke('test-connection', {
        port: select.value,
        baudRate: this.config.device.baudRate || 115200
      });
      
      if (result.success) {
        // Success feedback
        testButton.textContent = '✅ Success';
        testButton.className = 'success';
        
        if (statusElement) {
          statusElement.textContent = 'Test Passed';
          statusElement.className = 'status-indicator status-connected';
        }
        
        this.showMessage(`Connection test successful on ${select.value}`, 'success');
      } else {
        // Error feedback
        testButton.textContent = '❌ Failed';
        testButton.className = 'error';
        
        if (statusElement) {
          statusElement.textContent = 'Test Failed';
          statusElement.className = 'status-indicator status-disconnected';
        }
        
        this.showMessage(`Connection test failed: ${result.error}`, 'error');
      }
      
    } catch (error) {
      // Error feedback
      testButton.textContent = '❌ Error';
      testButton.className = 'error';
      
      if (statusElement) {
        statusElement.textContent = 'Test Error';
        statusElement.className = 'status-indicator status-disconnected';
      }
      
      await ipcRenderer.invoke('log-error', 'Connection test error: ' + error.message);
      this.showMessage('Connection test failed: ' + error.message, 'error');
    } finally {
      // Reset button after 3 seconds
      setTimeout(() => {
        testButton.textContent = '🔌 Test';
        testButton.className = '';
        testButton.disabled = false;
        
        // Reset status to normal state
        this.updatePortStatus(select.value);
      }, 3000);
    }
  }

  showMessage(message, type = 'success') {
    // Create a temporary message element
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
      document.body.removeChild(messageDiv);
    }, 3000);
  }

  async applyHardwareConfig() {
    try {
      const buttonCount = parseInt(document.getElementById('hw-button-count').value);
      const encoderCount = parseInt(document.getElementById('hw-encoder-count').value);

      // Apply button configuration
      await ipcRenderer.invoke('configure-arduino-buttons', buttonCount);
      
      // Apply encoder configuration  
      await ipcRenderer.invoke('configure-arduino-encoders', encoderCount);

      // Update UI to match new config
      document.getElementById('button-count').value = buttonCount;
      document.getElementById('encoder-count').value = encoderCount;
      this.config.device.buttons = buttonCount;
      this.config.device.encoders = encoderCount;
      
      this.generateButtonConfig();
      this.generateEncoderConfig();

      document.getElementById('arduino-config-status').textContent = 
        `${buttonCount} buttons, ${encoderCount} encoders`;
      
      this.showMessage('Arduino configuration applied successfully!');
    } catch (error) {
      await ipcRenderer.invoke('log-error', 'Error applying hardware config: ' + error.message);
      this.showMessage('Failed to apply Arduino configuration: ' + error.message, 'error');
    }
  }

  async getArduinoConfig() {
    try {
      const response = await ipcRenderer.invoke('get-arduino-config');
      this.parseArduinoConfigResponse(response);
      this.showMessage('Retrieved Arduino configuration');
    } catch (error) {
      await ipcRenderer.invoke('log-error', 'Error getting Arduino config: ' + error.message);
      this.showMessage('Failed to get Arduino configuration: ' + error.message, 'error');
    }
  }

  async resetArduinoConfig() {
    try {
      await ipcRenderer.invoke('reset-arduino');
      
      // Update UI to defaults
      document.getElementById('hw-button-count').value = '8';
      document.getElementById('hw-encoder-count').value = '0';
      document.getElementById('button-count').value = '8';
      document.getElementById('encoder-count').value = '0';
      
      this.config.device.buttons = 8;
      this.config.device.encoders = 0;
      
      this.generateButtonConfig();
      this.generateEncoderConfig();
      
      document.getElementById('arduino-config-status').textContent = '8 buttons, 0 encoders (default)';
      
      this.showMessage('Arduino reset to default configuration');
    } catch (error) {
      await ipcRenderer.invoke('log-error', 'Error resetting Arduino: ' + error.message);
      this.showMessage('Failed to reset Arduino: ' + error.message, 'error');
    }
  }

  parseArduinoConfigResponse(response) {
    // Parse response like "CONFIG:BUTTONS:8" or similar
    const lines = response.split('\n');
    let buttons = 8, encoders = 0;
    
    lines.forEach(line => {
      if (line.startsWith('CONFIG:BUTTONS:')) {
        buttons = parseInt(line.split(':')[2]);
      } else if (line.startsWith('CONFIG:ENCODERS:')) {
        encoders = parseInt(line.split(':')[2]);
      }
    });

    document.getElementById('hw-button-count').value = buttons;
    document.getElementById('hw-encoder-count').value = encoders;
    document.getElementById('arduino-config-status').textContent = 
      `${buttons} buttons, ${encoders} encoders`;
  }

  /**
   * Utility methods for error notification system
   */
  getSeverityIcon(severity) {
    const icons = {
      CRITICAL: '🔴',
      HIGH: '🟠',
      MEDIUM: '🟡',
      LOW: '🔵'
    };
    return icons[severity] || '⚠️';
  }

  getAutoRemoveTime(severity) {
    const times = {
      CRITICAL: 0,    // Don't auto-remove critical errors
      HIGH: 15000,    // 15 seconds
      MEDIUM: 10000,  // 10 seconds
      LOW: 5000       // 5 seconds
    };
    return times[severity] || 8000;
  }

  showSuccessNotification(message) {
    this.showNotification(message, 'success', 3000);
  }

  showInfoNotification(message) {
    this.showNotification(message, 'info', 5000);
  }

  showWarningNotification(message) {
    this.showNotification(message, 'warning', 8000);
  }

  showNotification(message, type = 'info', autoRemove = 5000) {
    const container = document.getElementById('notification-container');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const typeIcons = {
      success: '✅',
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌'
    };

    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">${typeIcons[type] || 'ℹ️'}</span>
        <span class="notification-message">${message}</span>
        <button class="close-notification">&times;</button>
      </div>
    `;

    notification.querySelector('.close-notification').addEventListener('click', () => {
      notification.remove();
    });

    if (autoRemove > 0) {
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, autoRemove);
    }

    container.appendChild(notification);
  }

  updateErrorCounter() {
    const toggle = document.getElementById('error-history-toggle');
    const errorStatus = document.getElementById('error-status');
    const errorCount = this.errorQueue.length;
    
    if (toggle) {
      toggle.innerHTML = `⚠️ Errors (${errorCount})`;
      toggle.className = errorCount > 0 
        ? 'btn secondary error-history-toggle has-errors' 
        : 'btn secondary error-history-toggle';
    }
    
    // Update header error status indicator
    if (errorStatus) {
      if (errorCount === 0) {
        errorStatus.textContent = '✅ No Errors';
        errorStatus.className = 'error-status status-ok';
        errorStatus.title = 'No recent errors';
      } else {
        // Determine highest severity in recent errors (last 5)
        const recentErrors = this.errorQueue.slice(-5);
        const hasCritical = recentErrors.some(e => e.severity === 'CRITICAL');
        const hasHigh = recentErrors.some(e => e.severity === 'HIGH');
        const hasMedium = recentErrors.some(e => e.severity === 'MEDIUM');
        
        let status, icon, className;
        if (hasCritical) {
          status = 'critical';
          icon = '🚨';
          className = 'error-status status-critical';
        } else if (hasHigh) {
          status = 'high';
          icon = '❌';
          className = 'error-status status-high';
        } else if (hasMedium) {
          status = 'medium';
          icon = '⚠️';
          className = 'error-status status-medium';
        } else {
          status = 'low';
          icon = '🟡';
          className = 'error-status status-low';
        }
        
        errorStatus.textContent = `${icon} ${errorCount} Error${errorCount !== 1 ? 's' : ''}`;
        errorStatus.className = className;
        errorStatus.title = `${errorCount} error${errorCount !== 1 ? 's' : ''} (severity: ${status}). Click to view details.`;
      }
    }
  }

  toggleErrorHistory() {
    const panel = document.getElementById('error-history-panel');
    panel.classList.toggle('hidden');
    
    if (!panel.classList.contains('hidden')) {
      this.updateErrorHistory();
    }
  }

  updateErrorHistory() {
    const list = document.getElementById('error-history-list');
    list.innerHTML = '';

    this.errorQueue.slice().reverse().forEach((error, index) => {
      const item = document.createElement('div');
      item.className = `error-history-item severity-${error.severity.toLowerCase()} category-${error.category || 'system'}`;
      
      const timestamp = new Date(error.timestamp).toLocaleString();
      const categoryIcon = this.getCategoryIcon(error.category);
      
      item.innerHTML = `
        <div class="error-history-header">
          <div class="error-category-info">
            <span class="category-icon">${categoryIcon}</span>
            <span class="category-badge">${(error.category || 'system').toUpperCase()}</span>
          </div>
          <span class="severity-badge">${error.severity}</span>
          <span class="error-time">${timestamp}</span>
        </div>
        <div class="error-message">${error.message}</div>
        ${error.actions && error.actions.length > 0 ? 
          `<div class="error-actions-summary">
            ${error.actions.length} recovery action${error.actions.length !== 1 ? 's' : ''} suggested
          </div>` : ''
        }
      `;

      item.addEventListener('click', () => {
        this.showErrorDetails(error);
      });

      list.appendChild(item);
    });

    if (this.errorQueue.length === 0) {
      list.innerHTML = '<div class="no-errors">No errors recorded</div>';
    }
  }

  showErrorDetails(error) {
    // Create modal for error details
    const modal = document.createElement('div');
    modal.className = 'error-details-modal';
    
    const actionsHtml = error.actions && error.actions.length > 0 
      ? `<div class="error-actions-detail">
          <h4>Suggested Solutions:</h4>
          <ul>${error.actions.map(action => `<li>${action}</li>`).join('')}</ul>
        </div>`
      : '';

    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Error Details</h3>
          <button class="close-modal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="error-detail-item">
            <strong>Message:</strong> ${error.message}
          </div>
          <div class="error-detail-item">
            <strong>Severity:</strong> <span class="severity-badge severity-${error.severity.toLowerCase()}">${error.severity}</span>
          </div>
          <div class="error-detail-item">
            <strong>Time:</strong> ${new Date(error.timestamp).toLocaleString()}
          </div>
          <div class="error-detail-item">
            <strong>Error ID:</strong> ${error.errorId}
          </div>
          ${actionsHtml}
        </div>
        <div class="modal-footer">
          <button class="btn secondary close-modal">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Set up close handlers
    modal.querySelectorAll('.close-modal').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.remove();
      });
    });

    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  clearErrorHistory() {
    this.errorQueue = [];
    this.updateErrorCounter();
    this.updateErrorHistory();
    this.showSuccessNotification('Error history cleared');
  }

  updateConnectionStatus(status = 'unknown', port = '') {
    // Store last connection status for port status updates
    this.lastConnectionStatus = status;
    
    // Update connection status in UI
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
      const statusMessages = {
        connected: `🟢 Connected${port ? ' (' + port + ')' : ''}`,
        connecting: '🟡 Connecting...',
        reconnecting: '🟡 Reconnecting...',
        disconnected: '⭕ Disconnected',
        failed: '🔴 Connection Failed',
        unknown: '❓ Unknown'
      };

      statusElement.textContent = statusMessages[status] || statusMessages.unknown;
      statusElement.className = `connection-status status-${status}`;
    }
    
    // Update port status in device selection if shown
    const currentPort = document.getElementById('serial-port')?.value;
    if (currentPort) {
      this.updatePortStatus(currentPort);
    }
  }

  async validateCurrentConfig() {
    // Trigger validation via IPC to main process
    try {
      const result = await window.electronAPI.invoke('validate-config');
      
      if (result.valid) {
        this.updateValidationStatus('valid', 'Configuration is valid');
      } else {
        const errorCount = result.errors.length;
        const warningCount = result.warnings.length;
        let message = '';
        
        if (errorCount > 0) {
          message += `${errorCount} error${errorCount !== 1 ? 's' : ''}`;
        }
        if (warningCount > 0) {
          if (message) message += ', ';
          message += `${warningCount} warning${warningCount !== 1 ? 's' : ''}`;
        }
        
        this.updateValidationStatus('invalid', message, result.errors, result.warnings);
      }
    } catch (error) {
      console.error('Validation failed:', error);
      this.updateValidationStatus('error', 'Validation failed: ' + error.message);
    }
  }

  updateValidationStatus(status, message = '', errors = [], warnings = []) {
    const statusElement = document.getElementById('validation-status');
    if (!statusElement) return;

    const statusMessages = {
      valid: '✅ Valid',
      invalid: '⚠️ Issues Found',
      error: '❌ Validation Error',
      validating: '🔍 Validating...'
    };

    statusElement.textContent = statusMessages[status] || message;
    statusElement.className = `validation-status status-${status}`;
    statusElement.title = message;

    // Show detailed errors/warnings if any
    if (errors.length > 0 || warnings.length > 0) {
      let details = '';
      if (errors.length > 0) {
        details += 'Errors:\n' + errors.map(e => `• ${e.message}`).join('\n');
      }
      if (warnings.length > 0) {
        if (details) details += '\n\n';
        details += 'Warnings:\n' + warnings.map(w => `• ${w.message}`).join('\n');
      }
      statusElement.title = details;
    }
  }

  /**
   * Toggle keyboard shortcut picker for encoder configuration
   */
  toggleEncoderShortcutPicker(encoderId, direction, actionType) {
    const pickerContainer = document.getElementById(`enc${encoderId}-${direction}-shortcut-picker`);
    const actionInput = document.getElementById(`enc${encoderId}-action-${direction}`);
    
    if (actionType === 'keypress') {
      // Show shortcut picker
      pickerContainer.style.display = 'block';
      actionInput.style.display = 'none';
      
      // Create shortcut picker if not exists
      if (!pickerContainer.hasChildNodes()) {
        // Import and create the shortcut picker
        if (typeof window.KeyboardShortcutPicker === 'undefined') {
          // Load the KeyboardShortcutPicker module
          const script = document.createElement('script');
          script.src = './KeyboardShortcutPicker.js';
          script.onload = () => {
            this.createEncoderShortcutPicker(encoderId, direction, pickerContainer, actionInput);
          };
          document.head.appendChild(script);
        } else {
          this.createEncoderShortcutPicker(encoderId, direction, pickerContainer, actionInput);
        }
      }
    } else {
      // Hide shortcut picker
      pickerContainer.style.display = 'none';
      actionInput.style.display = 'block';
    }
  }

  /**
   * Create a keyboard shortcut picker instance for encoder
   */
  createEncoderShortcutPicker(encoderId, direction, container, actionInput) {
    const fieldName = direction === 'cw' ? 'actionCW' : 'actionCCW';
    const picker = new KeyboardShortcutPicker(container, {
      onChange: (shortcut) => {
        // Update the action input and config
        actionInput.value = shortcut.electronFormat;
        this.updateEncoderConfig(encoderId, fieldName, shortcut.electronFormat);
        
        // Also store human-readable format for display
        this.updateEncoderConfig(encoderId, `shortcutDisplay${direction.toUpperCase()}`, shortcut.displayFormat);
      },
      onConflict: (conflicts) => {
        // Handle shortcut conflicts
        console.warn(`Shortcut conflicts detected for encoder ${encoderId} ${direction}:`, conflicts);
      }
    });

    // Set initial value if exists
    const currentAction = this.config.encoders?.[`encoder${encoderId}`]?.[fieldName];
    if (currentAction) {
      picker.setShortcut(currentAction);
    }
  }

  /**
   * Toggle keyboard shortcut picker for button configuration
   */
  toggleShortcutPicker(buttonId, actionType) {
    const pickerContainer = document.getElementById(`btn${buttonId}-shortcut-picker`);
    const actionInput = document.getElementById(`btn${buttonId}-action`);
    
    if (actionType === 'keypress') {
      // Show shortcut picker
      pickerContainer.style.display = 'block';
      actionInput.style.display = 'none';
      
      // Create shortcut picker if not exists
      if (!pickerContainer.hasChildNodes()) {
        // Import and create the shortcut picker
        if (typeof window.KeyboardShortcutPicker === 'undefined') {
          // Load the KeyboardShortcutPicker module
          const script = document.createElement('script');
          script.src = './KeyboardShortcutPicker.js';
          script.onload = () => {
            this.createShortcutPicker(buttonId, pickerContainer, actionInput);
          };
          document.head.appendChild(script);
        } else {
          this.createShortcutPicker(buttonId, pickerContainer, actionInput);
        }
      }
    } else {
      // Hide shortcut picker
      pickerContainer.style.display = 'none';
      actionInput.style.display = 'block';
    }
  }

  /**
   * Create a keyboard shortcut picker instance
   */
  createShortcutPicker(buttonId, container, actionInput) {
    const picker = new KeyboardShortcutPicker(container, {
      onChange: (shortcut) => {
        // Update the action input and config
        actionInput.value = shortcut.electronFormat;
        this.updateButtonConfig(buttonId, 'action', shortcut.electronFormat);
        
        // Also store human-readable format for display
        this.updateButtonConfig(buttonId, 'shortcutDisplay', shortcut.displayFormat);
      },
      onConflict: (conflicts) => {
        // Handle shortcut conflicts
        console.warn(`Shortcut conflicts detected for button ${buttonId}:`, conflicts);
      }
    });

    // Set initial value if exists
    const currentAction = this.config.buttons?.[`button${buttonId}`]?.action;
    if (currentAction) {
      picker.setShortcut(currentAction);
    }
  }
}

// Initialize the UI when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.configUI = new ConfigUI();
  window.profileManagerUI = new ProfileManagerUI();
  
  // Initialize profile manager with the necessary dependencies
  window.profileManagerUI.initialize().catch(error => {
    console.error('Failed to initialize ProfileManagerUI:', error);
  });
});