/**
 * SystemIntegrationUI - User interface for advanced system integration features
 *
 * This component provides a comprehensive interface for:
 * - Global shortcut management and registration
 * - Clipboard history and advanced clipboard operations
 * - Window management and application integration
 * - System state monitoring and automation rules
 * - Hardware input capture configuration
 * - Cross-platform system integration settings
 */

class SystemIntegrationUI {
  constructor() {
    this.isVisible = false;
    this.currentTab = 'shortcuts';
    this.registeredShortcuts = new Map();
    this.clipboardHistory = [];
    this.systemIntegrationManager = null;

    // Debounced functions
    this.debouncedSearch = this.debounce(this.performSearch.bind(this), 300);

    this.initializeEventListeners();
  }

  /**
   * Show the system integration management interface
   */
  async show() {
    if (this.isVisible) {
      document.getElementById('system-integration-modal').style.display = 'block';
      return;
    }

    await this.createModal();
    await this.loadSystemIntegrationData();
    this.isVisible = true;
  }

  /**
   * Hide the system integration interface
   */
  hide() {
    const modal = document.getElementById('system-integration-modal');
    if (modal) {
      modal.style.display = 'none';
    }
    this.isVisible = false;
  }

  /**
   * Create the modal interface
   */
  async createModal() {
    // Remove existing modal if it exists
    const existingModal = document.getElementById('system-integration-modal');
    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'system-integration-modal';
    modal.className = 'system-integration-modal';
    modal.innerHTML = `
      <div class="system-integration-content">
        <div class="system-integration-header">
          <h2>Advanced System Integration</h2>
          <button class="close-button" id="close-system-integration">×</button>
        </div>

        <div class="system-integration-tabs">
          <button class="tab-button active" data-tab="shortcuts">Global Shortcuts</button>
          <button class="tab-button" data-tab="clipboard">Clipboard Manager</button>
          <button class="tab-button" data-tab="windows">Window Management</button>
          <button class="tab-button" data-tab="automation">Automation Rules</button>
          <button class="tab-button" data-tab="monitoring">System Monitoring</button>
        </div>

        <div class="system-integration-body">
          <!-- Global Shortcuts Tab -->
          <div class="tab-content active" id="shortcuts-tab">
            <div class="shortcuts-section">
              <div class="section-header">
                <h3>Global Keyboard Shortcuts</h3>
                <button class="add-shortcut-btn" id="add-shortcut-btn">Add New Shortcut</button>
              </div>

              <div class="shortcuts-search">
                <input type="text" id="shortcuts-search" placeholder="Search shortcuts...">
                <select id="shortcuts-filter">
                  <option value="all">All Shortcuts</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div class="shortcuts-list" id="shortcuts-list">
                <!-- Shortcuts will be populated here -->
              </div>

              <!-- Add/Edit Shortcut Form -->
              <div class="shortcut-form hidden" id="shortcut-form">
                <h4 id="shortcut-form-title">Add New Global Shortcut</h4>

                <div class="form-group">
                  <label for="shortcut-keys">Keyboard Combination:</label>
                  <input type="text" id="shortcut-keys" placeholder="Ctrl+Shift+K" readonly>
                  <button type="button" id="record-shortcut-btn">Record Keys</button>
                </div>

                <div class="form-group">
                  <label for="shortcut-name">Shortcut Name:</label>
                  <input type="text" id="shortcut-name" placeholder="My Custom Shortcut">
                </div>

                <div class="form-group">
                  <label for="shortcut-action-type">Action Type:</label>
                  <select id="shortcut-action-type">
                    <option value="macro">Execute Macro</option>
                    <option value="clipboard">Clipboard Operation</option>
                    <option value="window">Window Operation</option>
                    <option value="application">Application Control</option>
                    <option value="system">System Command</option>
                    <option value="custom">Custom JavaScript</option>
                  </select>
                </div>

                <div class="form-group" id="shortcut-action-params">
                  <!-- Dynamic action parameters will be inserted here -->
                </div>

                <div class="form-actions">
                  <button type="button" id="save-shortcut-btn">Save Shortcut</button>
                  <button type="button" id="test-shortcut-btn">Test Action</button>
                  <button type="button" id="cancel-shortcut-btn">Cancel</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Clipboard Manager Tab -->
          <div class="tab-content" id="clipboard-tab">
            <div class="clipboard-section">
              <div class="section-header">
                <h3>Advanced Clipboard Management</h3>
                <button class="clear-history-btn" id="clear-clipboard-history">Clear History</button>
              </div>

              <div class="clipboard-controls">
                <div class="clipboard-settings">
                  <label>
                    <input type="checkbox" id="clipboard-monitoring-enabled" checked>
                    Enable Clipboard Monitoring
                  </label>

                  <label>
                    History Size:
                    <input type="number" id="clipboard-history-size" value="100" min="10" max="1000">
                  </label>

                  <label>
                    <input type="checkbox" id="clipboard-auto-format" checked>
                    Auto-format Content
                  </label>
                </div>

                <div class="clipboard-search">
                  <input type="text" id="clipboard-search" placeholder="Search clipboard history...">
                  <select id="clipboard-content-filter">
                    <option value="all">All Content</option>
                    <option value="text">Text</option>
                    <option value="url">URLs</option>
                    <option value="email">Email Addresses</option>
                    <option value="json">JSON Data</option>
                    <option value="multiline">Multiline Text</option>
                  </select>
                </div>
              </div>

              <div class="clipboard-history" id="clipboard-history">
                <!-- Clipboard history items will be populated here -->
              </div>

              <div class="clipboard-operations">
                <h4>Quick Operations</h4>
                <div class="clipboard-quick-actions">
                  <button class="clipboard-action-btn" data-action="format-json">Format JSON</button>
                  <button class="clipboard-action-btn" data-action="extract-urls">Extract URLs</button>
                  <button class="clipboard-action-btn" data-action="remove-formatting">Remove Formatting</button>
                  <button class="clipboard-action-btn" data-action="convert-case-upper">UPPERCASE</button>
                  <button class="clipboard-action-btn" data-action="convert-case-lower">lowercase</button>
                  <button class="clipboard-action-btn" data-action="encode-url">URL Encode</button>
                  <button class="clipboard-action-btn" data-action="decode-url">URL Decode</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Window Management Tab -->
          <div class="tab-content" id="windows-tab">
            <div class="windows-section">
              <div class="section-header">
                <h3>Window Management & Application Integration</h3>
                <button class="refresh-windows-btn" id="refresh-windows-btn">Refresh</button>
              </div>

              <div class="current-window-info">
                <h4>Currently Focused Application:</h4>
                <div class="window-info" id="current-window-info">
                  <span class="window-title">Unknown</span>
                  <span class="window-process">N/A</span>
                </div>
              </div>

              <div class="window-rules">
                <h4>Application-Specific Rules</h4>

                <div class="window-rules-list" id="window-rules-list">
                  <!-- Window rules will be populated here -->
                </div>

                <button class="add-window-rule-btn" id="add-window-rule-btn">Add Window Rule</button>
              </div>

              <!-- Add/Edit Window Rule Form -->
              <div class="window-rule-form hidden" id="window-rule-form">
                <h4>Application Integration Rule</h4>

                <div class="form-group">
                  <label for="rule-application">Application Name/Pattern:</label>
                  <input type="text" id="rule-application" placeholder="Visual Studio Code">
                </div>

                <div class="form-group">
                  <label for="rule-trigger">Trigger Event:</label>
                  <select id="rule-trigger">
                    <option value="window-focus">Window Focused</option>
                    <option value="window-minimize">Window Minimized</option>
                    <option value="window-maximize">Window Maximized</option>
                    <option value="application-start">Application Started</option>
                    <option value="application-quit">Application Quit</option>
                  </select>
                </div>

                <div class="form-group">
                  <label for="rule-action">Action:</label>
                  <select id="rule-action">
                    <option value="load-profile">Load Macro Profile</option>
                    <option value="enable-shortcuts">Enable Specific Shortcuts</option>
                    <option value="run-macro">Run Macro Sequence</option>
                    <option value="system-command">Execute System Command</option>
                    <option value="custom">Custom JavaScript</option>
                  </select>
                </div>

                <div class="form-group" id="rule-action-params">
                  <!-- Dynamic action parameters -->
                </div>

                <div class="form-actions">
                  <button type="button" id="save-window-rule-btn">Save Rule</button>
                  <button type="button" id="test-window-rule-btn">Test Rule</button>
                  <button type="button" id="cancel-window-rule-btn">Cancel</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Automation Rules Tab -->
          <div class="tab-content" id="automation-tab">
            <div class="automation-section">
              <div class="section-header">
                <h3>System Automation Rules</h3>
                <button class="add-automation-btn" id="add-automation-btn">Add Rule</button>
              </div>

              <div class="automation-categories">
                <div class="automation-category">
                  <h4>Conditional Triggers</h4>
                  <div class="automation-list" id="conditional-automation-list">
                    <!-- Conditional automations will be populated here -->
                  </div>
                </div>

                <div class="automation-category">
                  <h4>Scheduled Actions</h4>
                  <div class="automation-list" id="scheduled-automation-list">
                    <!-- Scheduled automations will be populated here -->
                  </div>
                </div>

                <div class="automation-category">
                  <h4>Event-Based Actions</h4>
                  <div class="automation-list" id="event-automation-list">
                    <!-- Event-based automations will be populated here -->
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- System Monitoring Tab -->
          <div class="tab-content" id="monitoring-tab">
            <div class="monitoring-section">
              <div class="section-header">
                <h3>System State Monitoring</h3>
                <div class="monitoring-status">
                  <span class="status-indicator" id="monitoring-status">●</span>
                  <span id="monitoring-status-text">Active</span>
                </div>
              </div>

              <div class="system-metrics">
                <div class="metric-card">
                  <h4>Memory Usage</h4>
                  <div class="metric-value" id="memory-usage">0%</div>
                  <div class="metric-chart" id="memory-chart"></div>
                </div>

                <div class="metric-card">
                  <h4>CPU Usage</h4>
                  <div class="metric-value" id="cpu-usage">0%</div>
                  <div class="metric-chart" id="cpu-chart"></div>
                </div>

                <div class="metric-card">
                  <h4>Active Application</h4>
                  <div class="metric-value" id="active-application">Unknown</div>
                  <div class="application-time" id="application-time">0s</div>
                </div>

                <div class="metric-card">
                  <h4>Clipboard Activity</h4>
                  <div class="metric-value" id="clipboard-activity">0</div>
                  <div class="activity-graph" id="clipboard-graph"></div>
                </div>
              </div>

              <div class="monitoring-settings">
                <h4>Monitoring Configuration</h4>

                <div class="settings-group">
                  <label>
                    <input type="checkbox" id="monitor-system-resources" checked>
                    Monitor System Resources
                  </label>

                  <label>
                    <input type="checkbox" id="monitor-application-focus" checked>
                    Monitor Application Focus
                  </label>

                  <label>
                    <input type="checkbox" id="monitor-clipboard-changes" checked>
                    Monitor Clipboard Changes
                  </label>

                  <label>
                    Update Interval:
                    <select id="monitoring-interval">
                      <option value="1000">1 second</option>
                      <option value="5000" selected>5 seconds</option>
                      <option value="10000">10 seconds</option>
                      <option value="30000">30 seconds</option>
                    </select>
                  </label>
                </div>

                <div class="monitoring-alerts">
                  <h5>Alert Thresholds</h5>

                  <label>
                    High Memory Usage:
                    <input type="number" id="memory-alert-threshold" value="80" min="50" max="95">%
                  </label>

                  <label>
                    High CPU Usage:
                    <input type="number" id="cpu-alert-threshold" value="90" min="50" max="99">%
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="system-integration-footer">
          <div class="footer-status">
            <span id="integration-status">System Integration: Ready</span>
          </div>

          <div class="footer-actions">
            <button class="export-settings-btn" id="export-settings-btn">Export Settings</button>
            <button class="import-settings-btn" id="import-settings-btn">Import Settings</button>
            <button class="reset-settings-btn" id="reset-settings-btn">Reset to Defaults</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Set up event listeners
    this.setupEventListeners();

    // Load initial tab
    this.switchTab('shortcuts');
  }

  /**
   * Initialize global event listeners
   */
  initializeEventListeners() {
    // Handle system integration events from main process
    window.electronAPI.onSystemIntegrationEvent((event, data) => {
      this.handleSystemIntegrationEvent(event, data);
    });
  }

  /**
   * Set up event listeners for the modal
   */
  setupEventListeners() {
    // Close button
    document.getElementById('close-system-integration').addEventListener('click', () => {
      this.hide();
    });

    // Tab switching
    document.querySelectorAll('.tab-button').forEach(button => {
      button.addEventListener('click', e => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    // Global Shortcuts tab events
    this.setupShortcutsEventListeners();

    // Clipboard tab events
    this.setupClipboardEventListeners();

    // Windows tab events
    this.setupWindowsEventListeners();

    // Automation tab events
    this.setupAutomationEventListeners();

    // Monitoring tab events
    this.setupMonitoringEventListeners();

    // Footer events
    this.setupFooterEventListeners();

    // Close modal when clicking outside
    document.getElementById('system-integration-modal').addEventListener('click', e => {
      if (e.target.id === 'system-integration-modal') {
        this.hide();
      }
    });

    // Keyboard shortcuts for modal
    document.addEventListener('keydown', e => {
      if (this.isVisible) {
        this.handleKeyboardShortcuts(e);
      }
    });
  }

  /**
   * Set up event listeners for shortcuts tab
   */
  setupShortcutsEventListeners() {
    // Add shortcut button
    document.getElementById('add-shortcut-btn').addEventListener('click', () => {
      this.showShortcutForm();
    });

    // Search and filter
    document.getElementById('shortcuts-search').addEventListener('input', e => {
      this.debouncedSearch('shortcuts', e.target.value);
    });

    document.getElementById('shortcuts-filter').addEventListener('change', e => {
      this.filterShortcuts(e.target.value);
    });

    // Shortcut form events
    document.getElementById('record-shortcut-btn').addEventListener('click', () => {
      this.startShortcutRecording();
    });

    document.getElementById('save-shortcut-btn').addEventListener('click', () => {
      this.saveShortcut();
    });

    document.getElementById('test-shortcut-btn').addEventListener('click', () => {
      this.testShortcutAction();
    });

    document.getElementById('cancel-shortcut-btn').addEventListener('click', () => {
      this.hideShortcutForm();
    });

    // Dynamic action type handling
    document.getElementById('shortcut-action-type').addEventListener('change', e => {
      this.updateShortcutActionParams(e.target.value);
    });
  }

  /**
   * Set up event listeners for clipboard tab
   */
  setupClipboardEventListeners() {
    // Clear history
    document.getElementById('clear-clipboard-history').addEventListener('click', () => {
      this.clearClipboardHistory();
    });

    // Settings
    document.getElementById('clipboard-monitoring-enabled').addEventListener('change', e => {
      this.toggleClipboardMonitoring(e.target.checked);
    });

    document.getElementById('clipboard-history-size').addEventListener('change', e => {
      this.updateClipboardHistorySize(parseInt(e.target.value, 10));
    });

    // Search and filter
    document.getElementById('clipboard-search').addEventListener('input', e => {
      this.debouncedSearch('clipboard', e.target.value);
    });

    document.getElementById('clipboard-content-filter').addEventListener('change', e => {
      this.filterClipboardHistory(e.target.value);
    });

    // Quick actions
    document.querySelectorAll('.clipboard-action-btn').forEach(button => {
      button.addEventListener('click', e => {
        this.performClipboardAction(e.target.dataset.action);
      });
    });
  }

  /**
   * Set up event listeners for windows tab
   */
  setupWindowsEventListeners() {
    // Refresh windows
    document.getElementById('refresh-windows-btn').addEventListener('click', () => {
      this.refreshWindowInfo();
    });

    // Add window rule
    document.getElementById('add-window-rule-btn').addEventListener('click', () => {
      this.showWindowRuleForm();
    });

    // Window rule form
    document.getElementById('save-window-rule-btn').addEventListener('click', () => {
      this.saveWindowRule();
    });

    document.getElementById('test-window-rule-btn').addEventListener('click', () => {
      this.testWindowRule();
    });

    document.getElementById('cancel-window-rule-btn').addEventListener('click', () => {
      this.hideWindowRuleForm();
    });
  }

  /**
   * Set up event listeners for automation tab
   */
  setupAutomationEventListeners() {
    // Add automation rule
    document.getElementById('add-automation-btn').addEventListener('click', () => {
      this.showAutomationForm();
    });
  }

  /**
   * Set up event listeners for monitoring tab
   */
  setupMonitoringEventListeners() {
    // Monitoring settings
    document.getElementById('monitor-system-resources').addEventListener('change', e => {
      this.toggleSystemResourceMonitoring(e.target.checked);
    });

    document.getElementById('monitor-application-focus').addEventListener('change', e => {
      this.toggleApplicationFocusMonitoring(e.target.checked);
    });

    document.getElementById('monitor-clipboard-changes').addEventListener('change', e => {
      this.toggleClipboardMonitoring(e.target.checked);
    });

    document.getElementById('monitoring-interval').addEventListener('change', e => {
      this.updateMonitoringInterval(parseInt(e.target.value, 10));
    });

    // Alert thresholds
    document.getElementById('memory-alert-threshold').addEventListener('change', e => {
      this.updateAlertThreshold('memory', parseInt(e.target.value, 10));
    });

    document.getElementById('cpu-alert-threshold').addEventListener('change', e => {
      this.updateAlertThreshold('cpu', parseInt(e.target.value, 10));
    });
  }

  /**
   * Set up event listeners for footer actions
   */
  setupFooterEventListeners() {
    document.getElementById('export-settings-btn').addEventListener('click', () => {
      this.exportSettings();
    });

    document.getElementById('import-settings-btn').addEventListener('click', () => {
      this.importSettings();
    });

    document.getElementById('reset-settings-btn').addEventListener('click', () => {
      this.resetSettings();
    });
  }

  /**
   * Handle keyboard shortcuts within the modal
   */
  handleKeyboardShortcuts(event) {
    // ESC to close
    if (event.key === 'Escape') {
      this.hide();
      event.preventDefault();
    }

    // Ctrl+S to save (if in a form)
    if (event.ctrlKey && event.key === 's') {
      const activeForm = document.querySelector(
        '.shortcut-form:not(.hidden), .window-rule-form:not(.hidden)'
      );
      if (activeForm) {
        event.preventDefault();
        if (activeForm.classList.contains('shortcut-form')) {
          this.saveShortcut();
        } else if (activeForm.classList.contains('window-rule-form')) {
          this.saveWindowRule();
        }
      }
    }

    // Tab switching with Ctrl+Number
    if (event.ctrlKey && event.key >= '1' && event.key <= '5') {
      const tabs = ['shortcuts', 'clipboard', 'windows', 'automation', 'monitoring'];
      const tabIndex = parseInt(event.key, 10) - 1;
      if (tabs[tabIndex]) {
        this.switchTab(tabs[tabIndex]);
        event.preventDefault();
      }
    }
  }

  /**
   * Switch between tabs
   */
  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(button => {
      button.classList.remove('active');
      if (button.dataset.tab === tabName) {
        button.classList.add('active');
      }
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });

    document.getElementById(`${tabName}-tab`).classList.add('active');
    this.currentTab = tabName;

    // Load tab-specific data if needed
    this.loadTabData(tabName);
  }

  /**
   * Load data for specific tab
   */
  async loadTabData(tabName) {
    switch (tabName) {
      case 'shortcuts':
        await this.loadShortcutsData();
        break;
      case 'clipboard':
        await this.loadClipboardData();
        break;
      case 'windows':
        await this.loadWindowsData();
        break;
      case 'automation':
        await this.loadAutomationData();
        break;
      case 'monitoring':
        await this.loadMonitoringData();
        break;
    }
  }

  /**
   * Load system integration data
   */
  async loadSystemIntegrationData() {
    try {
      const status = await window.electronAPI.getSystemIntegrationStatus();
      this.updateIntegrationStatus(status);

      // Load initial tab data
      await this.loadTabData(this.currentTab);
    } catch (error) {
      console.error('Failed to load system integration data:', error);
      this.showError('Failed to load system integration data');
    }
  }

  /**
   * Update integration status display
   */
  updateIntegrationStatus(status) {
    const statusElement = document.getElementById('integration-status');
    if (statusElement) {
      statusElement.textContent = `System Integration: ${status.initialized ? 'Active' : 'Inactive'}`;
      statusElement.className = status.initialized ? 'status-active' : 'status-inactive';
    }
  }

  /**
   * Handle system integration events from main process
   */
  handleSystemIntegrationEvent(event, data) {
    switch (event) {
      case 'shortcut-triggered':
        this.handleShortcutTriggered(data);
        break;
      case 'clipboard-changed':
        this.handleClipboardChanged(data);
        break;
      case 'window-focus-changed':
        this.handleWindowFocusChanged(data);
        break;
      case 'system-state-changed':
        this.handleSystemStateChanged(data);
        break;
      default:
        console.log('Unknown system integration event:', event, data);
    }
  }

  /**
   * Debounce utility function
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Show error message
   */
  showError(message, duration = 5000) {
    // Create or update error notification
    let errorDiv = document.getElementById('system-integration-error');
    if (!errorDiv) {
      errorDiv = document.createElement('div');
      errorDiv.id = 'system-integration-error';
      errorDiv.className = 'error-notification';
      document.body.appendChild(errorDiv);
    }

    errorDiv.textContent = message;
    errorDiv.style.display = 'block';

    // Auto-hide after duration
    setTimeout(() => {
      errorDiv.style.display = 'none';
    }, duration);
  }

  /**
   * Show success message
   */
  showSuccess(message, duration = 3000) {
    // Create or update success notification
    let successDiv = document.getElementById('system-integration-success');
    if (!successDiv) {
      successDiv = document.createElement('div');
      successDiv.id = 'system-integration-success';
      successDiv.className = 'success-notification';
      document.body.appendChild(successDiv);
    }

    successDiv.textContent = message;
    successDiv.style.display = 'block';

    // Auto-hide after duration
    setTimeout(() => {
      successDiv.style.display = 'none';
    }, duration);
  }

  // Placeholder methods for tab-specific functionality
  async loadShortcutsData() {
    // Implementation will be added
    console.log('Loading shortcuts data...');
  }

  async loadClipboardData() {
    // Implementation will be added
    console.log('Loading clipboard data...');
  }

  async loadWindowsData() {
    // Implementation will be added
    console.log('Loading windows data...');
  }

  async loadAutomationData() {
    // Implementation will be added
    console.log('Loading automation data...');
  }

  async loadMonitoringData() {
    // Implementation will be added
    console.log('Loading monitoring data...');
  }

  showShortcutForm() {
    // Implementation will be added
    console.log('Showing shortcut form...');
  }

  saveShortcut() {
    // Implementation will be added
    console.log('Saving shortcut...');
  }

  clearClipboardHistory() {
    // Implementation will be added
    console.log('Clearing clipboard history...');
  }

  refreshWindowInfo() {
    // Implementation will be added
    console.log('Refreshing window info...');
  }

  exportSettings() {
    // Implementation will be added
    console.log('Exporting settings...');
  }

  importSettings() {
    // Implementation will be added
    console.log('Importing settings...');
  }

  resetSettings() {
    // Implementation will be added
    console.log('Resetting settings...');
  }
}

// Initialize when DOM is loaded
if (typeof window !== 'undefined') {
  window.systemIntegrationUI = new SystemIntegrationUI();
}

// Export for Node.js environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SystemIntegrationUI;
}
