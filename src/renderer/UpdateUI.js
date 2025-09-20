/**
 * UpdateUI - User interface component for application updates
 * Provides visual feedback for update checking, downloading, and installation
 */
class UpdateUI {
  constructor() {
    this.isInitialized = false;
    this.currentStatus = {
      updateAvailable: false,
      isChecking: false,
      isDownloading: false,
      downloadProgress: null,
      updateInfo: null
    };
    
    this.elements = {};
    this.eventListeners = [];
    
    this.init();
  }

  /**
   * Initialize the update UI components
   */
  init() {
    if (this.isInitialized) return;
    
    this.createUIElements();
    this.bindEventListeners();
    this.setupIPCListeners();
    this.loadInitialStatus();
    
    this.isInitialized = true;
    console.log('UpdateUI initialized');
  }

  /**
   * Create HTML elements for update UI
   */
  createUIElements() {
    // Create update notification container
    this.elements.container = this.createElement('div', {
      id: 'update-container',
      className: 'update-container hidden'
    });

    // Create update status display
    this.elements.status = this.createElement('div', {
      className: 'update-status',
      innerHTML: `
        <div class="update-icon">🔄</div>
        <div class="update-text">
          <div class="update-title">Checking for updates...</div>
          <div class="update-subtitle"></div>
        </div>
      `
    });

    // Create progress bar
    this.elements.progress = this.createElement('div', {
      className: 'update-progress hidden',
      innerHTML: `
        <div class="progress-bar">
          <div class="progress-fill"></div>
        </div>
        <div class="progress-text">0%</div>
      `
    });

    // Create action buttons
    this.elements.actions = this.createElement('div', {
      className: 'update-actions',
      innerHTML: `
        <button id="update-check-btn" class="btn btn-secondary">Check for Updates</button>
        <button id="update-download-btn" class="btn btn-primary hidden">Download Update</button>
        <button id="update-install-btn" class="btn btn-primary hidden">Install & Restart</button>
        <button id="update-dismiss-btn" class="btn btn-secondary">Later</button>
      `
    });

    // Assemble the container
    this.elements.container.appendChild(this.elements.status);
    this.elements.container.appendChild(this.elements.progress);
    this.elements.container.appendChild(this.elements.actions);

    // Add to DOM
    document.body.appendChild(this.elements.container);

    // Get button references
    this.elements.checkBtn = document.getElementById('update-check-btn');
    this.elements.downloadBtn = document.getElementById('update-download-btn');
    this.elements.installBtn = document.getElementById('update-install-btn');
    this.elements.dismissBtn = document.getElementById('update-dismiss-btn');

    // Add settings panel update section
    this.createSettingsSection();
  }

  /**
   * Create update settings section in the settings panel
   */
  createSettingsSection() {
    const settingsContainer = document.getElementById('settings-content');
    if (!settingsContainer) return;

    const updateSection = this.createElement('div', {
      className: 'settings-section update-settings',
      innerHTML: `
        <h3>Application Updates</h3>
        <div class="setting-group">
          <label class="setting-label">
            <input type="checkbox" id="auto-update-enabled"> 
            Enable automatic updates
          </label>
          <p class="setting-description">Automatically check for and download updates in the background</p>
        </div>
        
        <div class="setting-group">
          <label class="setting-label">Current Version:</label>
          <span id="current-version" class="setting-value">Loading...</span>
        </div>
        
        <div class="setting-group">
          <button id="manual-update-check" class="btn btn-secondary">Check for Updates Now</button>
          <span id="last-check-time" class="setting-description"></span>
        </div>
        
        <div class="setting-group">
          <label class="setting-label">Update Statistics:</label>
          <div id="update-statistics" class="setting-value">
            <div>Total Checks: <span id="stat-checks">0</span></div>
            <div>Updates Available: <span id="stat-available">0</span></div>
            <div>Updates Installed: <span id="stat-installed">0</span></div>
          </div>
        </div>
      `
    });

    settingsContainer.appendChild(updateSection);

    // Get settings elements
    this.elements.autoUpdateCheckbox = document.getElementById('auto-update-enabled');
    this.elements.currentVersionSpan = document.getElementById('current-version');
    this.elements.manualCheckBtn = document.getElementById('manual-update-check');
    this.elements.lastCheckSpan = document.getElementById('last-check-time');
    this.elements.statisticsDiv = document.getElementById('update-statistics');
  }

  /**
   * Bind event listeners for user interactions
   */
  bindEventListeners() {
    // Update notification buttons
    this.addEventListeners([
      [this.elements.checkBtn, 'click', () => this.checkForUpdates()],
      [this.elements.downloadBtn, 'click', () => this.downloadUpdate()],
      [this.elements.installBtn, 'click', () => this.installUpdate()],
      [this.elements.dismissBtn, 'click', () => this.dismissUpdate()]
    ]);

    // Settings buttons
    if (this.elements.autoUpdateCheckbox) {
      this.addEventListeners([
        [this.elements.autoUpdateCheckbox, 'change', (e) => this.toggleAutoUpdate(e.target.checked)],
        [this.elements.manualCheckBtn, 'click', () => this.checkForUpdates()]
      ]);
    }
  }

  /**
   * Setup IPC listeners for update events from main process
   */
  setupIPCListeners() {
    // Listen for update events from main process
    window.electronAPI.onUpdateAvailable((updateInfo) => {
      console.log('Update available:', updateInfo);
      this.showUpdateAvailable(updateInfo);
    });

    window.electronAPI.onUpdateNotAvailable(() => {
      console.log('No updates available');
      this.showUpToDate();
    });

    window.electronAPI.onUpdateDownloadProgress((progress) => {
      console.log('Download progress:', progress);
      this.updateDownloadProgress(progress);
    });

    window.electronAPI.onUpdateDownloaded((updateInfo) => {
      console.log('Update downloaded:', updateInfo);
      this.showUpdateReady(updateInfo);
    });

    window.electronAPI.onUpdateError((error) => {
      console.error('Update error:', error);
      this.showUpdateError(error);
    });
  }

  /**
   * Load initial update status from main process
   */
  async loadInitialStatus() {
    try {
      const status = await window.electronAPI.getUpdateStatus();
      this.updateStatus(status);
      
      const stats = await window.electronAPI.getUpdateStatistics();
      this.updateStatistics(stats);
      
      if (this.elements.currentVersionSpan) {
        this.elements.currentVersionSpan.textContent = status.currentVersion;
      }
      
      if (this.elements.autoUpdateCheckbox) {
        this.elements.autoUpdateCheckbox.checked = status.autoUpdateEnabled;
      }
    } catch (error) {
      console.error('Failed to load update status:', error);
    }
  }

  /**
   * Check for updates manually
   */
  async checkForUpdates() {
    try {
      this.showChecking();
      await window.electronAPI.checkForUpdates();
    } catch (error) {
      console.error('Failed to check for updates:', error);
      this.showUpdateError(error.message);
    }
  }

  /**
   * Download available update
   */
  async downloadUpdate() {
    try {
      this.showDownloading();
      await window.electronAPI.downloadUpdate();
    } catch (error) {
      console.error('Failed to download update:', error);
      this.showUpdateError(error.message);
    }
  }

  /**
   * Install downloaded update
   */
  async installUpdate() {
    try {
      await window.electronAPI.installUpdate();
    } catch (error) {
      console.error('Failed to install update:', error);
      this.showUpdateError(error.message);
    }
  }

  /**
   * Toggle automatic updates
   */
  async toggleAutoUpdate(enabled) {
    try {
      await window.electronAPI.setAutoUpdateEnabled(enabled);
      console.log(`Automatic updates ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Failed to toggle auto-updates:', error);
      // Revert checkbox state
      if (this.elements.autoUpdateCheckbox) {
        this.elements.autoUpdateCheckbox.checked = !enabled;
      }
    }
  }

  /**
   * Show update checking state
   */
  showChecking() {
    this.currentStatus.isChecking = true;
    this.updateUI({
      icon: '🔄',
      title: 'Checking for updates...',
      subtitle: 'Please wait while we check for new versions',
      showProgress: false,
      actions: ['dismiss']
    });
    this.show();
  }

  /**
   * Show update available state
   */
  showUpdateAvailable(updateInfo) {
    this.currentStatus = {
      updateAvailable: true,
      isChecking: false,
      updateInfo: updateInfo
    };
    
    this.updateUI({
      icon: '📦',
      title: `Update Available: ${updateInfo.version}`,
      subtitle: 'A new version of Macro Keyboard is available',
      showProgress: false,
      actions: ['download', 'dismiss']
    });
    this.show();
  }

  /**
   * Show up-to-date state
   */
  showUpToDate() {
    this.currentStatus.isChecking = false;
    this.currentStatus.updateAvailable = false;
    
    this.updateUI({
      icon: '✅',
      title: 'You\'re up to date!',
      subtitle: 'You have the latest version of Macro Keyboard',
      showProgress: false,
      actions: ['dismiss']
    });
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      this.hide();
    }, 3000);
  }

  /**
   * Show downloading state
   */
  showDownloading() {
    this.currentStatus.isDownloading = true;
    
    this.updateUI({
      icon: '⬇️',
      title: 'Downloading update...',
      subtitle: 'Please wait while the update is downloaded',
      showProgress: true,
      actions: ['dismiss']
    });
  }

  /**
   * Show update ready state
   */
  showUpdateReady(updateInfo) {
    this.currentStatus.isDownloading = false;
    
    this.updateUI({
      icon: '🎉',
      title: 'Update ready to install',
      subtitle: `Version ${updateInfo.version} has been downloaded and is ready to install`,
      showProgress: false,
      actions: ['install', 'dismiss']
    });
  }

  /**
   * Show update error state
   */
  showUpdateError(error) {
    this.currentStatus = {
      updateAvailable: false,
      isChecking: false,
      isDownloading: false
    };
    
    this.updateUI({
      icon: '❌',
      title: 'Update Error',
      subtitle: `Failed to check for updates: ${error}`,
      showProgress: false,
      actions: ['check', 'dismiss']
    });
  }

  /**
   * Update download progress
   */
  updateDownloadProgress(progress) {
    if (!this.elements.progress || !this.currentStatus.isDownloading) return;
    
    const progressFill = this.elements.progress.querySelector('.progress-fill');
    const progressText = this.elements.progress.querySelector('.progress-text');
    
    if (progressFill && progressText) {
      progressFill.style.width = `${progress.percent}%`;
      progressText.textContent = `${Math.round(progress.percent)}%`;
    }
    
    this.currentStatus.downloadProgress = progress;
  }

  /**
   * Update UI elements based on state
   */
  updateUI({ icon, title, subtitle, showProgress, actions }) {
    // Update status display
    const iconEl = this.elements.status.querySelector('.update-icon');
    const titleEl = this.elements.status.querySelector('.update-title');
    const subtitleEl = this.elements.status.querySelector('.update-subtitle');
    
    if (iconEl) iconEl.textContent = icon;
    if (titleEl) titleEl.textContent = title;
    if (subtitleEl) subtitleEl.textContent = subtitle;
    
    // Show/hide progress bar
    if (showProgress) {
      this.elements.progress.classList.remove('hidden');
    } else {
      this.elements.progress.classList.add('hidden');
    }
    
    // Update action buttons
    this.updateActionButtons(actions);
  }

  /**
   * Update action button visibility
   */
  updateActionButtons(visibleActions) {
    const allButtons = ['check', 'download', 'install', 'dismiss'];
    const buttonMap = {
      check: this.elements.checkBtn,
      download: this.elements.downloadBtn,
      install: this.elements.installBtn,
      dismiss: this.elements.dismissBtn
    };
    
    allButtons.forEach(action => {
      const button = buttonMap[action];
      if (button) {
        if (visibleActions.includes(action)) {
          button.classList.remove('hidden');
        } else {
          button.classList.add('hidden');
        }
      }
    });
  }

  /**
   * Update status display
   */
  updateStatus(status) {
    this.currentStatus = { ...this.currentStatus, ...status };
    
    if (status.updateAvailable && status.updateInfo) {
      this.showUpdateAvailable(status.updateInfo);
    } else if (status.isChecking) {
      this.showChecking();
    }
  }

  /**
   * Update statistics display
   */
  updateStatistics(stats) {
    if (!this.elements.statisticsDiv) return;
    
    const checksSpan = document.getElementById('stat-checks');
    const availableSpan = document.getElementById('stat-available');
    const installedSpan = document.getElementById('stat-installed');
    
    if (checksSpan) checksSpan.textContent = stats.checksPerformed || 0;
    if (availableSpan) availableSpan.textContent = stats.updatesAvailable || 0;
    if (installedSpan) installedSpan.textContent = stats.updatesInstalled || 0;
    
    if (this.elements.lastCheckSpan && stats.lastCheckTime) {
      const lastCheck = new Date(stats.lastCheckTime);
      this.elements.lastCheckSpan.textContent = `Last checked: ${lastCheck.toLocaleString()}`;
    }
  }

  /**
   * Show the update container
   */
  show() {
    this.elements.container.classList.remove('hidden');
  }

  /**
   * Hide the update container
   */
  hide() {
    this.elements.container.classList.add('hidden');
  }

  /**
   * Dismiss update notification
   */
  dismissUpdate() {
    this.hide();
  }

  /**
   * Helper method to create DOM elements
   */
  createElement(tag, attributes = {}) {
    const element = document.createElement(tag);
    
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'innerHTML') {
        element.innerHTML = value;
      } else if (key === 'className') {
        element.className = value;
      } else {
        element.setAttribute(key, value);
      }
    });
    
    return element;
  }

  /**
   * Helper method to add multiple event listeners
   */
  addEventListeners(listeners) {
    listeners.forEach(([element, event, handler]) => {
      if (element) {
        element.addEventListener(event, handler);
        this.eventListeners.push({ element, event, handler });
      }
    });
  }

  /**
   * Clean up event listeners and resources
   */
  cleanup() {
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    
    this.eventListeners = [];
    
    if (this.elements.container && this.elements.container.parentNode) {
      this.elements.container.parentNode.removeChild(this.elements.container);
    }
    
    this.isInitialized = false;
    console.log('UpdateUI cleaned up');
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UpdateUI;
}