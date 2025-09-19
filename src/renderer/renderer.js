const { ipcRenderer } = require('electron');

class ConfigUI {
  constructor() {
    this.config = {};
    this.errorQueue = [];
    this.maxErrorHistory = 20;
    this.init();
  }

  async init() {
    await this.loadConfig();
    this.setupEventListeners();
    this.setupErrorHandling();
    this.updateUI();
    await this.loadSerialPorts();
    this.createErrorNotificationSystem();
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
    });

    document.getElementById('baud-rate').addEventListener('change', (e) => {
      this.config.device.baudRate = parseInt(e.target.value);
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
      this.showMessage('Configuration reloaded from file!');
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
    // Add to error queue
    this.errorQueue.push({
      ...notification,
      timestamp: new Date().toISOString()
    });

    // Maintain queue size
    if (this.errorQueue.length > this.maxErrorHistory) {
      this.errorQueue = this.errorQueue.slice(-this.maxErrorHistory);
    }

    // Update error counter
    this.updateErrorCounter();

    // Show notification
    this.showErrorNotification(notification);

    // Update error history
    this.updateErrorHistory();
  }

  /**
   * Show user-friendly error notification
   */
  showErrorNotification(notification) {
    const container = document.getElementById('notification-container');
    const notificationElement = document.createElement('div');
    notificationElement.className = `notification error severity-${notification.severity.toLowerCase()}`;
    
    const severityIcon = this.getSeverityIcon(notification.severity);
    const actionsHtml = notification.actions && notification.actions.length > 0 
      ? `<div class="error-actions">
          <strong>Try these solutions:</strong>
          <ul>${notification.actions.map(action => `<li>${action}</li>`).join('')}</ul>
        </div>` 
      : '';

    notificationElement.innerHTML = `
      <div class="notification-content">
        <div class="notification-header">
          <span class="severity-icon">${severityIcon}</span>
          <span class="notification-message">${notification.message}</span>
          <button class="close-notification">&times;</button>
        </div>
        ${actionsHtml}
        <div class="notification-footer">
          <small>Error ID: ${notification.errorId}</small>
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
    const stateMessages = {
      CONNECTING: 'Connecting to macro keyboard...',
      CONNECTED: 'Connected to macro keyboard',
      RECONNECTING: 'Reconnecting to macro keyboard...',
      DISCONNECTED: 'Disconnected from macro keyboard',
      FAILED: 'Connection to macro keyboard failed'
    };

    if (stateMessages[newState]) {
      const isError = newState === 'FAILED';
      if (isError) {
        this.showErrorNotification({ message: stateMessages[newState], severity: 'MEDIUM' });
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
        <div class="form-group">
          <label>Action:</label>
          <input type="text" id="btn${i}-action" value="${buttonConfig.action || ''}" placeholder="Action command/key">
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
      });

      actionInput.addEventListener('input', () => {
        this.updateButtonConfig(i, 'action', actionInput.value);
      });

      // Set current values
      typeSelect.value = buttonConfig.type || '';
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
            <div class="form-group">
              <label>Action:</label>
              <input type="text" id="enc${i}-action-cw" value="${encoderConfig.actionCW || ''}" placeholder="CW action">
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
            <div class="form-group">
              <label>Action:</label>
              <input type="text" id="enc${i}-action-ccw" value="${encoderConfig.actionCCW || ''}" placeholder="CCW action">
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
      });

      actionCWInput.addEventListener('input', () => {
        this.updateEncoderConfig(i, 'actionCW', actionCWInput.value);
      });

      typeCCWSelect.addEventListener('change', () => {
        this.updateEncoderConfig(i, 'typeCCW', typeCCWSelect.value);
      });

      actionCCWInput.addEventListener('input', () => {
        this.updateEncoderConfig(i, 'actionCCW', actionCCWInput.value);
      });

      // Set current values
      typeCWSelect.value = encoderConfig.typeCW || '';
      typeCCWSelect.value = encoderConfig.typeCCW || '';
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
  }

  updateEncoderConfig(encoderId, field, value) {
    if (!this.config.encoders) {
      this.config.encoders = {};
    }
    if (!this.config.encoders[`encoder${encoderId}`]) {
      this.config.encoders[`encoder${encoderId}`] = {};
    }
    this.config.encoders[`encoder${encoderId}`][field] = value;
  }

  async saveConfig() {
    try {
      await ipcRenderer.invoke('save-config', this.config);
      this.showMessage('Configuration saved successfully!');
    } catch (error) {
      await ipcRenderer.invoke('log-error', 'Error saving config: ' + error.message);
      this.showMessage('Error saving configuration!', 'error');
    }
  }

  async loadSerialPorts() {
    try {
      const ports = await ipcRenderer.invoke('get-serial-ports');
      const select = document.getElementById('serial-port');
      
      // Clear existing options except the first one
      while (select.children.length > 1) {
        select.removeChild(select.lastChild);
      }
      
      ports.forEach(port => {
        const option = document.createElement('option');
        option.value = port.path;
        option.textContent = `${port.path} - ${port.manufacturer || 'Unknown'}`;
        select.appendChild(option);
      });

      // Set current selection
      select.value = this.config.device.serialPort || '';
      
    } catch (error) {
      await ipcRenderer.invoke('log-error', 'Error loading serial ports: ' + error.message);
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
    if (toggle) {
      const errorCount = this.errorQueue.length;
      toggle.innerHTML = `⚠️ Errors (${errorCount})`;
      toggle.className = errorCount > 0 
        ? 'btn secondary error-history-toggle has-errors' 
        : 'btn secondary error-history-toggle';
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
      item.className = `error-history-item severity-${error.severity.toLowerCase()}`;
      
      const timestamp = new Date(error.timestamp).toLocaleString();
      
      item.innerHTML = `
        <div class="error-history-header">
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
    // Update connection status in UI
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
      const statusMessages = {
        connected: `🟢 Connected${port ? ' (' + port + ')' : ''}`,
        disconnected: '🟡 Disconnected',
        reconnecting: '🟡 Reconnecting...',
        failed: '🔴 Connection Failed',
        unknown: '❓ Unknown'
      };

      statusElement.textContent = statusMessages[status] || statusMessages.unknown;
      statusElement.className = `connection-status status-${status}`;
    }
  }
}

// Initialize the UI when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ConfigUI();
});