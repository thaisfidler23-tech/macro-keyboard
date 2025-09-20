/**
 * Action Step Editor Component for Macro Sequence Editing
 * 
 * Provides modal/panel interface for editing individual macro steps
 * with parameter editing, validation, and preview functionality
 */
class ActionStepEditor {
  constructor(options = {}) {
    this.isOpen = false;
    this.currentStep = null;
    this.currentIndex = -1;
    this.isNew = false;
    
    // Configuration
    this.options = {
      showPreview: true,
      enableValidation: true,
      allowCustomActions: true,
      ...options
    };
    
    // Event callbacks
    this.onSave = options.onSave || (() => {});
    this.onCancel = options.onCancel || (() => {});
    this.onPreview = options.onPreview || (() => {});
    this.onValidate = options.onValidate || (() => {});
    
    // Validation state
    this.validationErrors = [];
    this.validationWarnings = [];
    
    this.createModal();
    this.setupEventListeners();
  }
  
  /**
   * Create the modal dialog structure
   */
  createModal() {
    this.modal = document.createElement('div');
    this.modal.className = 'action-step-editor-modal';
    this.modal.style.display = 'none';
    
    this.modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-dialog">
        <div class="modal-header">
          <h3 class="modal-title">Edit Action Step</h3>
          <button class="modal-close-btn" title="Close">&times;</button>
        </div>
        
        <div class="modal-body">
          <form class="step-editor-form">
            <!-- Basic Properties -->
            <div class="form-section">
              <h4>Basic Properties</h4>
              
              <div class="form-group">
                <label for="step-type">Action Type:</label>
                <select id="step-type" name="type" required>
                  <option value="keypress">Keypress</option>
                  <option value="command">Command</option>
                  <option value="application">Application</option>
                  <option value="delay">Delay</option>
                  <option value="macro_sequence">Macro Sequence</option>
                </select>
              </div>
              
              <div class="form-group">
                <label for="step-action">Action:</label>
                <div class="action-input-container">
                  <input type="text" id="step-action" name="action" placeholder="Enter action..." required>
                  <button type="button" class="action-picker-btn" title="Browse Actions">...</button>
                </div>
                <small class="form-help">Examples: Ctrl+C, notepad.exe, /Applications/Calculator.app</small>
              </div>
              
              <div class="form-group">
                <label for="step-description">Description:</label>
                <input type="text" id="step-description" name="description" placeholder="Optional description">
              </div>
            </div>
            
            <!-- Timing Configuration -->
            <div class="form-section">
              <h4>Timing</h4>
              
              <div class="form-group">
                <label for="step-delay">Delay After (ms):</label>
                <div class="delay-input-group">
                  <input type="number" id="step-delay" name="delay" min="0" max="60000" value="100">
                  <div class="delay-presets">
                    <button type="button" data-delay="0">None</button>
                    <button type="button" data-delay="100">Fast</button>
                    <button type="button" data-delay="500">Normal</button>
                    <button type="button" data-delay="1000">Slow</button>
                  </div>
                </div>
                <input type="range" class="delay-slider" min="0" max="5000" value="100">
              </div>
            </div>
            
            <!-- Advanced Options -->
            <div class="form-section advanced-options" style="display: none;">
              <h4>Advanced Options</h4>
              
              <div class="form-group">
                <label>
                  <input type="checkbox" name="conditional" value="1">
                  Conditional Execution
                </label>
                <div class="conditional-config" style="display: none;">
                  <select name="conditionType">
                    <option value="window_exists">Window Exists</option>
                    <option value="process_exists">Process Exists</option>
                    <option value="file_exists">File Exists</option>
                  </select>
                  <input type="text" name="conditionValue" placeholder="Condition value">
                </div>
              </div>
              
              <div class="form-group">
                <label>
                  <input type="checkbox" name="retry" value="1">
                  Retry on Failure
                </label>
                <div class="retry-config" style="display: none;">
                  <label>Max Attempts: <input type="number" name="maxAttempts" min="1" max="10" value="3"></label>
                  <label>Retry Delay: <input type="number" name="retryDelay" min="100" max="5000" value="1000"> ms</label>
                </div>
              </div>
              
              <div class="form-group">
                <label for="step-priority">Priority:</label>
                <select id="step-priority" name="priority">
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
            
            <div class="form-actions">
              <button type="button" class="toggle-advanced-btn">Advanced Options</button>
            </div>
          </form>
          
          <!-- Validation Messages -->
          <div class="validation-messages">
            <div class="validation-errors"></div>
            <div class="validation-warnings"></div>
          </div>
          
          <!-- Preview Section -->
          <div class="preview-section" style="display: none;">
            <h4>Preview</h4>
            <div class="preview-content">
              <div class="preview-summary"></div>
              <div class="preview-timing"></div>
            </div>
          </div>
        </div>
        
        <div class="modal-footer">
          <div class="footer-left">
            <button type="button" class="preview-btn">Preview</button>
            <button type="button" class="validate-btn">Validate</button>
          </div>
          <div class="footer-right">
            <button type="button" class="cancel-btn">Cancel</button>
            <button type="button" class="save-btn" disabled>Save</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(this.modal);
    
    // Cache commonly used elements
    this.form = this.modal.querySelector('.step-editor-form');
    this.typeSelect = this.modal.querySelector('#step-type');
    this.actionInput = this.modal.querySelector('#step-action');
    this.descriptionInput = this.modal.querySelector('#step-description');
    this.delayInput = this.modal.querySelector('#step-delay');
    this.delaySlider = this.modal.querySelector('.delay-slider');
    this.saveBtn = this.modal.querySelector('.save-btn');
    this.validationErrorsEl = this.modal.querySelector('.validation-errors');
    this.validationWarningsEl = this.modal.querySelector('.validation-warnings');
    this.previewSection = this.modal.querySelector('.preview-section');
    this.previewSummary = this.modal.querySelector('.preview-summary');
  }
  
  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Modal controls
    this.modal.querySelector('.modal-close-btn').addEventListener('click', () => this.close());
    this.modal.querySelector('.cancel-btn').addEventListener('click', () => this.close());
    this.modal.querySelector('.save-btn').addEventListener('click', () => this.save());
    
    // Form controls
    this.typeSelect.addEventListener('change', () => this.handleTypeChange());
    this.actionInput.addEventListener('input', () => this.handleInputChange());
    this.actionInput.addEventListener('blur', () => this.validateStep());
    this.descriptionInput.addEventListener('input', () => this.handleInputChange());
    this.delayInput.addEventListener('input', () => this.handleDelayChange());
    this.delaySlider.addEventListener('input', () => this.handleSliderChange());
    
    // Action picker
    this.modal.querySelector('.action-picker-btn').addEventListener('click', () => this.showActionPicker());
    
    // Delay presets
    this.modal.querySelectorAll('.delay-presets button').forEach(btn => {
      btn.addEventListener('click', () => {
        const delay = parseInt(btn.dataset.delay);
        this.setDelay(delay);
      });
    });
    
    // Advanced options
    this.modal.querySelector('.toggle-advanced-btn').addEventListener('click', () => this.toggleAdvancedOptions());
    
    // Conditional and retry toggles
    this.modal.querySelector('input[name="conditional"]').addEventListener('change', (e) => {
      this.modal.querySelector('.conditional-config').style.display = e.target.checked ? 'block' : 'none';
    });
    
    this.modal.querySelector('input[name="retry"]').addEventListener('change', (e) => {
      this.modal.querySelector('.retry-config').style.display = e.target.checked ? 'block' : 'none';
    });
    
    // Preview and validation
    this.modal.querySelector('.preview-btn').addEventListener('click', () => this.preview());
    this.modal.querySelector('.validate-btn').addEventListener('click', () => this.validateStep());
    
    // Close on backdrop click
    this.modal.querySelector('.modal-backdrop').addEventListener('click', () => this.close());
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (event) => {
      if (this.isOpen) {
        switch (event.key) {
          case 'Escape':
            this.close();
            break;
          case 'Enter':
            if (event.ctrlKey) {
              this.save();
              event.preventDefault();
            }
            break;
        }
      }
    });
  }
  
  /**
   * Open editor for new step
   */
  openForNew(defaultType = 'keypress', insertIndex = -1) {
    this.isNew = true;
    this.currentIndex = insertIndex;
    this.currentStep = {
      type: defaultType,
      action: '',
      description: '',
      delay: 100,
      priority: 'normal'
    };
    
    this.populateForm();
    this.open();
  }
  
  /**
   * Open editor for existing step
   */
  openForEdit(step, index) {
    this.isNew = false;
    this.currentIndex = index;
    this.currentStep = { ...step };
    
    this.populateForm();
    this.open();
  }
  
  /**
   * Open the modal
   */
  open() {
    this.isOpen = true;
    this.modal.style.display = 'flex';
    this.modal.querySelector('.modal-title').textContent = this.isNew ? 'Create Action Step' : 'Edit Action Step';
    
    // Focus first input
    this.actionInput.focus();
    
    // Validate on open
    setTimeout(() => this.validateStep(), 100);
  }
  
  /**
   * Close the modal
   */
  close() {
    if (this.hasUnsavedChanges() && !confirm('You have unsaved changes. Are you sure you want to close?')) {
      return;
    }
    
    this.isOpen = false;
    this.modal.style.display = 'none';
    this.currentStep = null;
    this.currentIndex = -1;
    this.validationErrors = [];
    this.validationWarnings = [];
    
    this.onCancel();
  }
  
  /**
   * Save the current step
   */
  save() {
    if (!this.validateStep()) {
      return;
    }
    
    const formData = new FormData(this.form);
    const stepData = {
      type: formData.get('type'),
      action: formData.get('action'),
      description: formData.get('description') || '',
      delay: parseInt(formData.get('delay')) || 0,
      priority: formData.get('priority') || 'normal'
    };
    
    // Advanced options
    if (formData.get('conditional')) {
      stepData.conditional = {
        type: formData.get('conditionType'),
        value: formData.get('conditionValue')
      };
    }
    
    if (formData.get('retry')) {
      stepData.retry = {
        maxAttempts: parseInt(formData.get('maxAttempts')) || 3,
        delay: parseInt(formData.get('retryDelay')) || 1000
      };
    }
    
    this.onSave(stepData, this.currentIndex, this.isNew);
    this.close();
  }
  
  /**
   * Populate form with current step data
   */
  populateForm() {
    if (!this.currentStep) return;
    
    this.typeSelect.value = this.currentStep.type || 'keypress';
    this.actionInput.value = this.currentStep.action || '';
    this.descriptionInput.value = this.currentStep.description || '';
    this.delayInput.value = this.currentStep.delay || 100;
    this.delaySlider.value = this.currentStep.delay || 100;
    
    // Priority
    const prioritySelect = this.modal.querySelector('#step-priority');
    prioritySelect.value = this.currentStep.priority || 'normal';
    
    // Advanced options
    if (this.currentStep.conditional) {
      this.modal.querySelector('input[name="conditional"]').checked = true;
      this.modal.querySelector('.conditional-config').style.display = 'block';
      this.modal.querySelector('select[name="conditionType"]').value = this.currentStep.conditional.type;
      this.modal.querySelector('input[name="conditionValue"]').value = this.currentStep.conditional.value;
    }
    
    if (this.currentStep.retry) {
      this.modal.querySelector('input[name="retry"]').checked = true;
      this.modal.querySelector('.retry-config').style.display = 'block';
      this.modal.querySelector('input[name="maxAttempts"]').value = this.currentStep.retry.maxAttempts;
      this.modal.querySelector('input[name="retryDelay"]').value = this.currentStep.retry.delay;
    }
    
    this.updateActionHelp();
  }
  
  /**
   * Handle type change
   */
  handleTypeChange() {
    this.updateActionHelp();
    this.updateActionPlaceholder();
    this.handleInputChange();
  }
  
  /**
   * Handle input change
   */
  handleInputChange() {
    this.updateSaveButton();
    this.clearValidation();
  }
  
  /**
   * Handle delay input change
   */
  handleDelayChange() {
    const delay = parseInt(this.delayInput.value) || 0;
    this.delaySlider.value = delay;
    this.handleInputChange();
  }
  
  /**
   * Handle delay slider change
   */
  handleSliderChange() {
    const delay = parseInt(this.delaySlider.value) || 0;
    this.delayInput.value = delay;
    this.handleInputChange();
  }
  
  /**
   * Set delay value
   */
  setDelay(delay) {
    this.delayInput.value = delay;
    this.delaySlider.value = delay;
    this.handleInputChange();
  }
  
  /**
   * Update action help text based on type
   */
  updateActionHelp() {
    const type = this.typeSelect.value;
    const helpElement = this.modal.querySelector('.form-help');
    
    const helpTexts = {
      keypress: 'Examples: Ctrl+C, Alt+Tab, Cmd+Space, F1, Enter',
      command: 'Examples: echo "Hello", ls -la, npm install',
      application: 'Examples: notepad.exe, /Applications/Calculator.app, google-chrome',
      delay: 'Examples: 1000 (for 1 second delay)',
      macro_sequence: 'Examples: my_sequence_name, login_workflow'
    };
    
    helpElement.textContent = helpTexts[type] || 'Enter the action to perform';
  }
  
  /**
   * Update action input placeholder
   */
  updateActionPlaceholder() {
    const type = this.typeSelect.value;
    const placeholders = {
      keypress: 'Ctrl+C, Alt+Tab, etc.',
      command: 'echo "Hello World"',
      application: 'notepad.exe',
      delay: '1000',
      macro_sequence: 'sequence_name'
    };
    
    this.actionInput.placeholder = placeholders[type] || 'Enter action...';
  }
  
  /**
   * Show action picker dialog
   */
  showActionPicker() {
    const type = this.typeSelect.value;
    
    switch (type) {
      case 'keypress':
        this.showKeypressPicker();
        break;
      case 'application':
        this.showApplicationPicker();
        break;
      case 'command':
        this.showCommandPicker();
        break;
      default:
        break;
    }
  }
  
  /**
   * Show keypress picker
   */
  showKeypressPicker() {
    const picker = document.createElement('div');
    picker.className = 'keypress-picker';
    picker.innerHTML = `
      <div class="picker-header">
        <h4>Select Keypress</h4>
        <button class="picker-close">&times;</button>
      </div>
      <div class="picker-body">
        <div class="modifier-keys">
          <label><input type="checkbox" value="Ctrl"> Ctrl</label>
          <label><input type="checkbox" value="Alt"> Alt</label>
          <label><input type="checkbox" value="Shift"> Shift</label>
          <label><input type="checkbox" value="Cmd"> Cmd</label>
        </div>
        <div class="main-keys">
          <div class="key-group">
            <h5>Function Keys</h5>
            ${Array.from({length: 12}, (_, i) => `<button class="key-btn" data-key="F${i+1}">F${i+1}</button>`).join('')}
          </div>
          <div class="key-group">
            <h5>Special Keys</h5>
            <button class="key-btn" data-key="Enter">Enter</button>
            <button class="key-btn" data-key="Tab">Tab</button>
            <button class="key-btn" data-key="Space">Space</button>
            <button class="key-btn" data-key="Escape">Escape</button>
            <button class="key-btn" data-key="Backspace">Backspace</button>
            <button class="key-btn" data-key="Delete">Delete</button>
          </div>
          <div class="key-group">
            <h5>Arrow Keys</h5>
            <button class="key-btn" data-key="ArrowUp">↑</button>
            <button class="key-btn" data-key="ArrowDown">↓</button>
            <button class="key-btn" data-key="ArrowLeft">←</button>
            <button class="key-btn" data-key="ArrowRight">→</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(picker);
    
    // Handle key selection
    picker.addEventListener('click', (event) => {
      if (event.target.classList.contains('key-btn')) {
        const modifiers = Array.from(picker.querySelectorAll('input[type="checkbox"]:checked'))
          .map(cb => cb.value);
        const key = event.target.dataset.key;
        
        const combination = [...modifiers, key].join('+');
        this.actionInput.value = combination;
        this.handleInputChange();
        
        document.body.removeChild(picker);
      } else if (event.target.classList.contains('picker-close')) {
        document.body.removeChild(picker);
      }
    });
  }
  
  /**
   * Show application picker
   */
  showApplicationPicker() {
    // This would open a file dialog to select an application
    // For now, show common applications
    const commonApps = process.platform === 'darwin' ? [
      '/Applications/Calculator.app',
      '/Applications/TextEdit.app',
      '/Applications/Safari.app',
      '/Applications/Terminal.app'
    ] : [
      'notepad.exe',
      'calc.exe',
      'cmd.exe',
      'explorer.exe'
    ];
    
    const list = commonApps.map(app => `<div class="app-item" data-app="${app}">${app}</div>`).join('');
    
    const picker = document.createElement('div');
    picker.className = 'application-picker';
    picker.innerHTML = `
      <div class="picker-header">
        <h4>Select Application</h4>
        <button class="picker-close">&times;</button>
      </div>
      <div class="picker-body">
        <div class="common-apps">
          <h5>Common Applications</h5>
          ${list}
        </div>
        <div class="custom-app">
          <h5>Custom Path</h5>
          <input type="text" placeholder="Enter application path..." class="custom-app-input">
          <button class="browse-btn">Browse</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(picker);
    
    picker.addEventListener('click', (event) => {
      if (event.target.classList.contains('app-item')) {
        this.actionInput.value = event.target.dataset.app;
        this.handleInputChange();
        document.body.removeChild(picker);
      } else if (event.target.classList.contains('picker-close')) {
        document.body.removeChild(picker);
      } else if (event.target.classList.contains('browse-btn')) {
        // Would open file dialog
        alert('File dialog integration would be implemented here');
      }
    });
  }
  
  /**
   * Show command picker
   */
  showCommandPicker() {
    const commonCommands = process.platform === 'darwin' ? [
      'open .',
      'ls -la',
      'pwd',
      'whoami',
      'date',
      'echo "Hello World"'
    ] : [
      'dir',
      'cd ..',
      'echo "Hello World"',
      'ipconfig',
      'tasklist',
      'start .'
    ];
    
    const list = commonCommands.map(cmd => `<div class="command-item" data-command="${cmd}">${cmd}</div>`).join('');
    
    const picker = document.createElement('div');
    picker.className = 'command-picker';
    picker.innerHTML = `
      <div class="picker-header">
        <h4>Select Command</h4>
        <button class="picker-close">&times;</button>
      </div>
      <div class="picker-body">
        <div class="common-commands">
          <h5>Common Commands</h5>
          ${list}
        </div>
      </div>
    `;
    
    document.body.appendChild(picker);
    
    picker.addEventListener('click', (event) => {
      if (event.target.classList.contains('command-item')) {
        this.actionInput.value = event.target.dataset.command;
        this.handleInputChange();
        document.body.removeChild(picker);
      } else if (event.target.classList.contains('picker-close')) {
        document.body.removeChild(picker);
      }
    });
  }
  
  /**
   * Toggle advanced options
   */
  toggleAdvancedOptions() {
    const advancedSection = this.modal.querySelector('.advanced-options');
    const toggleBtn = this.modal.querySelector('.toggle-advanced-btn');
    
    if (advancedSection.style.display === 'none') {
      advancedSection.style.display = 'block';
      toggleBtn.textContent = 'Hide Advanced Options';
    } else {
      advancedSection.style.display = 'none';
      toggleBtn.textContent = 'Advanced Options';
    }
  }
  
  /**
   * Preview the step
   */
  preview() {
    const formData = new FormData(this.form);
    const stepData = {
      type: formData.get('type'),
      action: formData.get('action'),
      description: formData.get('description') || '',
      delay: parseInt(formData.get('delay')) || 0
    };
    
    this.previewSection.style.display = 'block';
    this.previewSummary.innerHTML = `
      <div><strong>Type:</strong> ${stepData.type}</div>
      <div><strong>Action:</strong> ${stepData.action}</div>
      <div><strong>Description:</strong> ${stepData.description || 'None'}</div>
      <div><strong>Delay:</strong> ${stepData.delay}ms</div>
    `;
    
    this.onPreview(stepData);
  }
  
  /**
   * Validate the current step
   */
  validateStep() {
    this.validationErrors = [];
    this.validationWarnings = [];
    
    const formData = new FormData(this.form);
    const type = formData.get('type');
    const action = formData.get('action');
    const delay = parseInt(formData.get('delay')) || 0;
    
    // Basic validation
    if (!action || action.trim() === '') {
      this.validationErrors.push('Action is required');
    }
    
    if (delay < 0 || delay > 60000) {
      this.validationErrors.push('Delay must be between 0 and 60000 ms');
    }
    
    // Type-specific validation
    switch (type) {
      case 'keypress':
        this.validateKeypress(action);
        break;
      case 'command':
        this.validateCommand(action);
        break;
      case 'application':
        this.validateApplication(action);
        break;
    }
    
    // Call external validation
    this.onValidate({
      type,
      action,
      delay
    }, this.validationErrors, this.validationWarnings);
    
    this.displayValidation();
    this.updateSaveButton();
    
    return this.validationErrors.length === 0;
  }
  
  /**
   * Validate keypress action
   */
  validateKeypress(action) {
    if (!action) return;
    
    const validModifiers = ['Ctrl', 'Alt', 'Shift', 'Cmd', 'Meta', 'Win'];
    const parts = action.split('+');
    
    if (parts.length > 4) {
      this.validationWarnings.push('Too many modifier keys - this may not work as expected');
    }
    
    // Check for invalid combinations
    if (parts.includes('Ctrl') && parts.includes('Cmd')) {
      this.validationWarnings.push('Using both Ctrl and Cmd - consider platform-specific actions');
    }
  }
  
  /**
   * Validate command action
   */
  validateCommand(action) {
    if (!action) return;
    
    // Check for potentially dangerous commands
    const dangerousCommands = ['rm -rf', 'del /f', 'format', 'shutdown', 'reboot'];
    if (dangerousCommands.some(cmd => action.toLowerCase().includes(cmd))) {
      this.validationWarnings.push('This command could be potentially dangerous');
    }
    
    // Check for command existence (basic)
    const command = action.split(' ')[0];
    if (command.length < 2) {
      this.validationErrors.push('Command appears to be invalid');
    }
  }
  
  /**
   * Validate application action
   */
  validateApplication(action) {
    if (!action) return;
    
    const isWindows = process.platform === 'win32';
    const isMac = process.platform === 'darwin';
    
    if (isWindows && !action.endsWith('.exe') && !action.includes('\\')) {
      this.validationWarnings.push('Windows applications typically end with .exe');
    }
    
    if (isMac && !action.startsWith('/Applications/') && !action.includes('.app')) {
      this.validationWarnings.push('Mac applications are typically in /Applications/ or end with .app');
    }
  }
  
  /**
   * Display validation messages
   */
  displayValidation() {
    // Clear previous messages
    this.validationErrorsEl.innerHTML = '';
    this.validationWarningsEl.innerHTML = '';
    
    // Show errors
    if (this.validationErrors.length > 0) {
      this.validationErrorsEl.innerHTML = `
        <div class="validation-error-header">Errors:</div>
        ${this.validationErrors.map(error => `<div class="validation-error">${error}</div>`).join('')}
      `;
    }
    
    // Show warnings
    if (this.validationWarnings.length > 0) {
      this.validationWarningsEl.innerHTML = `
        <div class="validation-warning-header">Warnings:</div>
        ${this.validationWarnings.map(warning => `<div class="validation-warning">${warning}</div>`).join('')}
      `;
    }
  }
  
  /**
   * Clear validation messages
   */
  clearValidation() {
    this.validationErrors = [];
    this.validationWarnings = [];
    this.validationErrorsEl.innerHTML = '';
    this.validationWarningsEl.innerHTML = '';
  }
  
  /**
   * Update save button state
   */
  updateSaveButton() {
    const hasRequiredFields = this.actionInput.value.trim() !== '';
    const hasNoErrors = this.validationErrors.length === 0;
    
    this.saveBtn.disabled = !hasRequiredFields || !hasNoErrors;
  }
  
  /**
   * Check for unsaved changes
   */
  hasUnsavedChanges() {
    if (!this.currentStep) return false;
    
    const formData = new FormData(this.form);
    
    return (
      formData.get('type') !== this.currentStep.type ||
      formData.get('action') !== this.currentStep.action ||
      formData.get('description') !== (this.currentStep.description || '') ||
      parseInt(formData.get('delay')) !== (this.currentStep.delay || 100)
    );
  }
  
  /**
   * Cleanup resources
   */
  destroy() {
    if (this.modal.parentNode) {
      document.body.removeChild(this.modal);
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ActionStepEditor;
}