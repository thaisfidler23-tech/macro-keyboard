/**
 * Context Manager UI Component
 * Provides user interface for managing context-aware profile switching rules and monitoring system context
 */

class ContextManagerUI {
  constructor() {
    this.isInitialized = false;
    this.contextRules = [];
    this.currentContext = null;
    this.switchingEnabled = false;

    // UI element references
    this.container = null;
    this.rulesContainer = null;
    this.currentContextDisplay = null;
    this.addRuleForm = null;
    this.statusToggle = null;
    this.historyContainer = null;

    // State tracking
    this.editingRuleId = null;
    this.switchHistory = [];

    // Initialize UI when DOM is ready
    this.initializeUI();
  }

  /**
   * Initialize the Context Manager UI
   */
  async initializeUI() {
    try {
      this.createUIElements();
      this.setupEventListeners();
      await this.loadInitialData();
      this.isInitialized = true;
      console.log('ContextManagerUI initialized successfully');
    } catch (error) {
      console.error('Failed to initialize ContextManagerUI:', error);
      this.showError('Failed to initialize context manager');
    }
  }

  /**
   * Create all UI elements for context management
   */
  createUIElements() {
    // Main container
    this.container = document.createElement('div');
    this.container.id = 'context-manager-container';
    this.container.className = 'context-manager-container hidden';
    this.container.innerHTML = `
      <div class="context-manager-header">
        <h3>Context-Aware Profiles</h3>
        <div class="context-status">
          <label class="toggle-switch">
            <input type="checkbox" id="automatic-switching-toggle">
            <span class="toggle-slider"></span>
            <span class="toggle-label">Automatic Switching</span>
          </label>
        </div>
      </div>

      <div class="context-manager-content">
        <!-- Current Context Display -->
        <div class="current-context-panel">
          <h4>Current Context</h4>
          <div class="context-info" id="current-context-info">
            <div class="context-item">
              <span class="context-label">Active Application:</span>
              <span class="context-value" id="current-app">Loading...</span>
            </div>
            <div class="context-item">
              <span class="context-label">Time of Day:</span>
              <span class="context-value" id="current-time">Loading...</span>
            </div>
            <div class="context-item">
              <span class="context-label">System State:</span>
              <span class="context-value" id="current-state">Loading...</span>
            </div>
            <div class="context-item">
              <span class="context-label">Active Profile:</span>
              <span class="context-value" id="current-profile">Loading...</span>
            </div>
          </div>
        </div>

        <!-- Context Rules Management -->
        <div class="rules-panel">
          <div class="rules-header">
            <h4>Context Rules</h4>
            <button class="btn btn-primary" id="add-rule-btn">Add Rule</button>
          </div>

          <div class="rules-list" id="rules-list">
            <!-- Rules will be populated here -->
          </div>

          <!-- Add/Edit Rule Form -->
          <div class="rule-form-container hidden" id="rule-form-container">
            <form class="rule-form" id="context-rule-form">
              <div class="form-group">
                <label for="rule-name">Rule Name:</label>
                <input type="text" id="rule-name" name="name" required>
              </div>

              <div class="form-group">
                <label for="rule-type">Trigger Type:</label>
                <select id="rule-type" name="type" required>
                  <option value="">Select trigger type</option>
                  <option value="application">Application</option>
                  <option value="time">Time of Day</option>
                  <option value="system">System State</option>
                  <option value="combined">Combined Rules</option>
                </select>
              </div>

              <!-- Application-specific fields -->
              <div class="conditional-fields application-fields hidden">
                <div class="form-group">
                  <label for="app-name">Application Name:</label>
                  <input type="text" id="app-name" name="applicationName" placeholder="e.g., Slack, Chrome, VSCode">
                </div>
                <div class="form-group">
                  <label for="app-pattern">Process Pattern (optional):</label>
                  <input type="text" id="app-pattern" name="processPattern" placeholder="Regular expression pattern">
                </div>
              </div>

              <!-- Time-specific fields -->
              <div class="conditional-fields time-fields hidden">
                <div class="form-row">
                  <div class="form-group">
                    <label for="start-time">Start Time:</label>
                    <input type="time" id="start-time" name="startTime">
                  </div>
                  <div class="form-group">
                    <label for="end-time">End Time:</label>
                    <input type="time" id="end-time" name="endTime">
                  </div>
                </div>
                <div class="form-group">
                  <label>Days of Week:</label>
                  <div class="checkbox-group">
                    <label><input type="checkbox" name="days" value="monday"> Monday</label>
                    <label><input type="checkbox" name="days" value="tuesday"> Tuesday</label>
                    <label><input type="checkbox" name="days" value="wednesday"> Wednesday</label>
                    <label><input type="checkbox" name="days" value="thursday"> Thursday</label>
                    <label><input type="checkbox" name="days" value="friday"> Friday</label>
                    <label><input type="checkbox" name="days" value="saturday"> Saturday</label>
                    <label><input type="checkbox" name="days" value="sunday"> Sunday</label>
                  </div>
                </div>
              </div>

              <!-- System state fields -->
              <div class="conditional-fields system-fields hidden">
                <div class="form-group">
                  <label for="system-state">System State:</label>
                  <select id="system-state" name="systemState">
                    <option value="">Select state</option>
                    <option value="idle">System Idle</option>
                    <option value="active">System Active</option>
                    <option value="presentation">Presentation Mode</option>
                    <option value="focus">Focus Mode</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="idle-threshold">Idle Threshold (minutes):</label>
                  <input type="number" id="idle-threshold" name="idleThreshold" min="1" max="120" value="5">
                </div>
              </div>

              <div class="form-group">
                <label for="target-profile">Target Profile:</label>
                <select id="target-profile" name="targetProfile" required>
                  <option value="">Select profile</option>
                  <!-- Will be populated dynamically -->
                </select>
              </div>

              <div class="form-group">
                <label for="rule-priority">Priority:</label>
                <select id="rule-priority" name="priority">
                  <option value="low">Low</option>
                  <option value="medium" selected>Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div class="form-actions">
                <button type="submit" class="btn btn-primary">Save Rule</button>
                <button type="button" class="btn btn-secondary" id="cancel-rule-btn">Cancel</button>
              </div>
            </form>
          </div>
        </div>

        <!-- Switch History -->
        <div class="history-panel">
          <div class="history-header">
            <h4>Recent Switches</h4>
            <button class="btn btn-secondary btn-small" id="clear-history-btn">Clear</button>
          </div>
          <div class="history-list" id="history-list">
            <!-- History items will be populated here -->
          </div>
        </div>
      </div>
    `;

    // Append to main container (assumes there's a tabs container)
    const tabContent = document.querySelector('.tab-content');
    if (tabContent) {
      tabContent.appendChild(this.container);
    }

    // Get references to key elements
    this.rulesContainer = this.container.querySelector('#rules-list');
    this.currentContextDisplay = this.container.querySelector('#current-context-info');
    this.addRuleForm = this.container.querySelector('#context-rule-form');
    this.statusToggle = this.container.querySelector('#automatic-switching-toggle');
    this.historyContainer = this.container.querySelector('#history-list');
  }

  /**
   * Set up event listeners for UI interactions
   */
  setupEventListeners() {
    // Automatic switching toggle
    this.statusToggle.addEventListener('change', async(e) => {
      try {
        if (e.target.checked) {
          await window.electronAPI.invoke('enable-automatic-switching');
          this.showSuccess('Automatic switching enabled');
        } else {
          await window.electronAPI.invoke('disable-automatic-switching');
          this.showSuccess('Automatic switching disabled');
        }
        this.switchingEnabled = e.target.checked;
      } catch (error) {
        console.error('Error toggling automatic switching:', error);
        this.showError('Failed to toggle automatic switching');
        // Revert toggle state
        e.target.checked = !e.target.checked;
      }
    });

    // Add rule button
    this.container.querySelector('#add-rule-btn').addEventListener('click', () => {
      this.showRuleForm();
    });

    // Cancel rule button
    this.container.querySelector('#cancel-rule-btn').addEventListener('click', () => {
      this.hideRuleForm();
    });

    // Rule form submission
    this.addRuleForm.addEventListener('submit', async(e) => {
      e.preventDefault();
      await this.saveRule();
    });

    // Rule type change - show/hide conditional fields
    this.container.querySelector('#rule-type').addEventListener('change', (e) => {
      this.toggleConditionalFields(e.target.value);
    });

    // Clear history button
    this.container.querySelector('#clear-history-btn').addEventListener('click', async() => {
      if (confirm('Clear all switch history?')) {
        this.switchHistory = [];
        this.updateHistoryDisplay();
        this.showSuccess('History cleared');
      }
    });

    // Listen for context changes from main process
    this.setupIPCListeners();
  }

  /**
   * Set up IPC listeners for real-time updates
   */
  setupIPCListeners() {
    // Context change events
    window.electronAPI.on('context-changed', (contextData) => {
      this.currentContext = contextData;
      this.updateCurrentContextDisplay();
    });

    window.electronAPI.on('application-changed', (appData) => {
      this.currentContext = { ...this.currentContext, application: appData };
      this.updateCurrentContextDisplay();
    });

    window.electronAPI.on('system-state-changed', (stateData) => {
      this.currentContext = { ...this.currentContext, systemState: stateData };
      this.updateCurrentContextDisplay();
    });

    window.electronAPI.on('profile-switched', (switchData) => {
      this.switchHistory.unshift({
        ...switchData,
        timestamp: new Date().toISOString()
      });

      // Keep only last 50 entries
      if (this.switchHistory.length > 50) {
        this.switchHistory = this.switchHistory.slice(0, 50);
      }

      this.updateHistoryDisplay();
      this.updateCurrentContextDisplay();
    });

    window.electronAPI.on('profile-switch-failed', (errorData) => {
      this.showError(`Profile switch failed: ${errorData.error}`);
    });

    window.electronAPI.on('switching-mode-changed', (modeData) => {
      this.switchingEnabled = modeData.mode === 'automatic';
      this.statusToggle.checked = this.switchingEnabled;
    });
  }

  /**
   * Load initial data from main process
   */
  async loadInitialData() {
    try {
      // Load context rules
      this.contextRules = await window.electronAPI.invoke('get-context-rules');
      this.updateRulesDisplay();

      // Load current context
      this.currentContext = await window.electronAPI.invoke('get-current-context');
      this.updateCurrentContextDisplay();

      // Load switching status
      const status = await window.electronAPI.invoke('get-profile-switching-status');
      this.switchingEnabled = status.isEnabled;
      this.statusToggle.checked = this.switchingEnabled;

      // Load switch history
      this.switchHistory = await window.electronAPI.invoke('get-switch-history');
      this.updateHistoryDisplay();

      // Load available profiles for rule form
      await this.loadAvailableProfiles();
    } catch (error) {
      console.error('Error loading initial data:', error);
      this.showError('Failed to load context data');
    }
  }

  /**
   * Load available profiles for the rule form dropdown
   */
  async loadAvailableProfiles() {
    try {
      const profiles = await window.electronAPI.invoke('get-profiles');
      const profileSelect = this.container.querySelector('#target-profile');

      // Clear existing options except the first one
      profileSelect.innerHTML = '<option value="">Select profile</option>';

      profiles.forEach(profile => {
        const option = document.createElement('option');
        option.value = profile.name;
        option.textContent = profile.displayName || profile.name;
        profileSelect.appendChild(option);
      });
    } catch (error) {
      console.error('Error loading profiles:', error);
    }
  }

  /**
   * Update the current context display
   */
  updateCurrentContextDisplay() {
    if (!this.currentContext) {
      return;
    }

    const currentApp = this.container.querySelector('#current-app');
    const currentTime = this.container.querySelector('#current-time');
    const currentState = this.container.querySelector('#current-state');
    const currentProfile = this.container.querySelector('#current-profile');

    if (currentApp) {
      currentApp.textContent = this.currentContext.application?.name || 'Unknown';
    }

    if (currentTime) {
      const now = new Date();
      currentTime.textContent = now.toLocaleTimeString();
    }

    if (currentState) {
      currentState.textContent = this.currentContext.systemState?.state || 'Active';
    }

    if (currentProfile) {
      currentProfile.textContent = this.currentContext.activeProfile || 'Default';
    }
  }

  /**
   * Update the rules display
   */
  updateRulesDisplay() {
    if (!this.rulesContainer) {
      return;
    }

    this.rulesContainer.innerHTML = '';

    if (this.contextRules.length === 0) {
      this.rulesContainer.innerHTML = '<div class="no-rules">No context rules configured</div>';
      return;
    }

    this.contextRules.forEach(rule => {
      const ruleElement = this.createRuleElement(rule);
      this.rulesContainer.appendChild(ruleElement);
    });
  }

  /**
   * Create a rule element for display
   */
  createRuleElement(rule) {
    const element = document.createElement('div');
    element.className = `rule-item priority-${rule.priority}`;
    element.innerHTML = `
      <div class="rule-header">
        <span class="rule-name">${rule.name}</span>
        <span class="rule-priority badge">${rule.priority}</span>
      </div>
      <div class="rule-details">
        <span class="rule-type">${this.formatRuleType(rule)}</span>
        <span class="rule-target">→ ${rule.targetProfile}</span>
      </div>
      <div class="rule-actions">
        <button class="btn btn-small btn-secondary" onclick="contextManagerUI.editRule('${rule.id}')">Edit</button>
        <button class="btn btn-small btn-danger" onclick="contextManagerUI.deleteRule('${rule.id}')">Delete</button>
        <button class="btn btn-small btn-primary" onclick="contextManagerUI.testRule('${rule.id}')">Test</button>
      </div>
    `;
    return element;
  }

  /**
   * Format rule type for display
   */
  formatRuleType(rule) {
    switch (rule.type) {
    case 'application':
      return `App: ${rule.applicationName}`;
    case 'time':
      return `Time: ${rule.startTime}-${rule.endTime}`;
    case 'system':
      return `System: ${rule.systemState}`;
    case 'combined':
      return 'Combined Rules';
    default:
      return rule.type;
    }
  }

  /**
   * Update the switch history display
   */
  updateHistoryDisplay() {
    if (!this.historyContainer) {
      return;
    }

    this.historyContainer.innerHTML = '';

    if (this.switchHistory.length === 0) {
      this.historyContainer.innerHTML = '<div class="no-history">No recent switches</div>';
      return;
    }

    this.switchHistory.slice(0, 10).forEach(entry => {
      const historyElement = this.createHistoryElement(entry);
      this.historyContainer.appendChild(historyElement);
    });
  }

  /**
   * Create a history element for display
   */
  createHistoryElement(entry) {
    const element = document.createElement('div');
    element.className = 'history-item';

    const time = new Date(entry.timestamp).toLocaleTimeString();
    const triggerInfo = entry.trigger ? ` (${entry.trigger})` : '';

    element.innerHTML = `
      <div class="history-time">${time}</div>
      <div class="history-details">
        <span class="from-profile">${entry.fromProfile || 'Unknown'}</span>
        <span class="arrow">→</span>
        <span class="to-profile">${entry.toProfile}</span>
        <span class="trigger">${triggerInfo}</span>
      </div>
    `;

    return element;
  }

  /**
   * Show the rule form for adding/editing
   */
  showRuleForm(rule = null) {
    const formContainer = this.container.querySelector('#rule-form-container');
    formContainer.classList.remove('hidden');

    if (rule) {
      // Editing existing rule
      this.editingRuleId = rule.id;
      this.populateRuleForm(rule);
      this.container.querySelector('#add-rule-btn').textContent = 'Add Rule';
    } else {
      // Adding new rule
      this.editingRuleId = null;
      this.addRuleForm.reset();
      this.container.querySelector('#add-rule-btn').textContent = 'Cancel';
    }

    // Scroll form into view (only in browser environment)
    if (typeof formContainer.scrollIntoView === 'function') {
      formContainer.scrollIntoView({ behavior: 'smooth' });
    }
  }

  /**
   * Hide the rule form
   */
  hideRuleForm() {
    const formContainer = this.container.querySelector('#rule-form-container');
    formContainer.classList.add('hidden');
    this.addRuleForm.reset();
    this.editingRuleId = null;
    this.container.querySelector('#add-rule-btn').textContent = 'Add Rule';
    this.toggleConditionalFields('');
  }

  /**
   * Populate the rule form with existing rule data
   */
  populateRuleForm(rule) {
    this.container.querySelector('#rule-name').value = rule.name;
    this.container.querySelector('#rule-type').value = rule.type;
    this.container.querySelector('#target-profile').value = rule.targetProfile;
    this.container.querySelector('#rule-priority').value = rule.priority;

    // Show conditional fields
    this.toggleConditionalFields(rule.type);

    // Populate type-specific fields
    switch (rule.type) {
    case 'application':
      if (rule.applicationName) {
        this.container.querySelector('#app-name').value = rule.applicationName;
      }
      if (rule.processPattern) {
        this.container.querySelector('#app-pattern').value = rule.processPattern;
      }
      break;

    case 'time':
      if (rule.startTime) {
        this.container.querySelector('#start-time').value = rule.startTime;
      }
      if (rule.endTime) {
        this.container.querySelector('#end-time').value = rule.endTime;
      }
      if (rule.days) {
        rule.days.forEach(day => {
          const checkbox = this.container.querySelector(`input[name="days"][value="${day}"]`);
          if (checkbox) {
            checkbox.checked = true;
          }
        });
      }
      break;

    case 'system':
      if (rule.systemState) {
        this.container.querySelector('#system-state').value = rule.systemState;
      }
      if (rule.idleThreshold) {
        this.container.querySelector('#idle-threshold').value = rule.idleThreshold;
      }
      break;
    }
  }

  /**
   * Toggle conditional form fields based on rule type
   */
  toggleConditionalFields(type) {
    const allFields = this.container.querySelectorAll('.conditional-fields');
    allFields.forEach(field => field.classList.add('hidden'));

    if (type) {
      const targetFields = this.container.querySelector(`.${type}-fields`);
      if (targetFields) {
        targetFields.classList.remove('hidden');
      }
    }
  }

  /**
   * Save a rule (add or update)
   */
  async saveRule() {
    try {
      const formData = new FormData(this.addRuleForm);
      const rule = {
        name: formData.get('name'),
        type: formData.get('type'),
        targetProfile: formData.get('targetProfile'),
        priority: formData.get('priority')
      };

      // Add type-specific properties
      switch (rule.type) {
      case 'application':
        rule.applicationName = formData.get('applicationName');
        if (formData.get('processPattern')) {
          rule.processPattern = formData.get('processPattern');
        }
        break;

      case 'time':
        rule.startTime = formData.get('startTime');
        rule.endTime = formData.get('endTime');
        rule.days = formData.getAll('days');
        break;

      case 'system':
        rule.systemState = formData.get('systemState');
        rule.idleThreshold = parseInt(formData.get('idleThreshold', 10));
        break;
      }

      if (this.editingRuleId) {
        // Update existing rule
        await window.electronAPI.invoke('update-context-rule', this.editingRuleId, rule);
        this.showSuccess('Rule updated successfully');
      } else {
        // Add new rule
        await window.electronAPI.invoke('add-context-rule', rule);
        this.showSuccess('Rule added successfully');
      }

      this.hideRuleForm();
      this.contextRules = await window.electronAPI.invoke('get-context-rules');
      this.updateRulesDisplay();
    } catch (error) {
      console.error('Error saving rule:', error);
      this.showError('Failed to save rule');
    }
  }

  /**
   * Edit a rule
   */
  async editRule(ruleId) {
    const rule = this.contextRules.find(r => r.id === ruleId);
    if (rule) {
      this.showRuleForm(rule);
    }
  }

  /**
   * Delete a rule
   */
  async deleteRule(ruleId) {
    if (confirm('Delete this context rule?')) {
      try {
        const result = await window.electronAPI.invoke('remove-context-rule', ruleId);
        if (result && result.success) {
          this.contextRules = await window.electronAPI.invoke('get-context-rules');
          this.updateRulesDisplay();
          this.showSuccess('Rule deleted successfully');
        } else {
          this.showError('Failed to delete rule');
        }
      } catch (error) {
        console.error('Error deleting rule:', error);
        this.showError('Failed to delete rule');
      }
    }
  }

  /**
   * Test a rule manually
   */
  async testRule(ruleId) {
    try {
      const rule = this.contextRules.find(r => r.id === ruleId);
      if (rule) {
        await window.electronAPI.invoke('switch-to-profile', rule.targetProfile);
        this.showSuccess(`Switched to profile: ${rule.targetProfile}`);
      }
    } catch (error) {
      console.error('Error testing rule:', error);
      this.showError('Failed to test rule');
    }
  }

  /**
   * Show the context manager tab
   */
  show() {
    if (this.container) {
      this.container.classList.remove('hidden');
      if (!this.isInitialized) {
        this.initializeUI();
      }
    }
  }

  /**
   * Hide the context manager tab
   */
  hide() {
    if (this.container) {
      this.container.classList.add('hidden');
    }
  }

  /**
   * Show success message
   */
  showSuccess(message) {
    // Use the global notification system if available
    if (window.showNotification) {
      window.showNotification(message, 'success');
    } else {
      console.log('Success:', message);
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    // Use the global notification system if available
    if (window.showNotification) {
      window.showNotification(message, 'error');
    } else {
      console.error('Error:', message);
    }
  }

  /**
   * Cleanup when component is destroyed
   */
  destroy() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }

    // Remove event listeners
    // Note: Most listeners are on elements that will be removed, so they'll be cleaned up automatically

    this.isInitialized = false;
  }
}

// Export for use in renderer
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ContextManagerUI;
} else {
  // Make available globally in renderer process
  window.ContextManagerUI = ContextManagerUI;
}
