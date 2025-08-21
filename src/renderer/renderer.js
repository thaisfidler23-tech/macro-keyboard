const { ipcRenderer } = require('electron');

class ConfigUI {
  constructor() {
    this.config = {};
    this.init();
  }

  async init() {
    await this.loadConfig();
    this.setupEventListeners();
    this.updateUI();
    await this.loadSerialPorts();
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
}

// Initialize the UI when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ConfigUI();
});