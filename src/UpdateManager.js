const { autoUpdater } = require('electron-updater');
const { app, dialog } = require('electron');
const EventEmitter = require('events');
const path = require('path');
const os = require('os');

/**
 * UpdateManager handles automatic application updates using Electron's autoUpdater
 * Integrates with GitHub Releases to provide seamless update installation
 */
class UpdateManager extends EventEmitter {
  constructor(logger, config = {}) {
    super();
    
    this.logger = logger;
    this.config = {
      // GitHub repository information
      owner: config.owner || 'jmassardo',
      repo: config.repo || 'macro-keyboard',
      
      // Update checking behavior
      checkInterval: config.checkInterval || 24 * 60 * 60 * 1000, // 24 hours
      autoDownload: config.autoDownload !== false, // Default true
      autoInstallOnAppQuit: config.autoInstallOnAppQuit !== false, // Default true
      
      // User interaction settings
      allowPrerelease: config.allowPrerelease || false,
      notify: config.notify !== false, // Default true
      silent: config.silent || false,
      
      // Server configuration
      provider: config.provider || 'github',
      updaterCacheDirName: config.updaterCacheDirName || 'macro-keyboard-updater',
      
      ...config
    };

    this.currentVersion = app.getVersion();
    this.updateCheckTimer = null;
    this.isChecking = false;
    this.updateAvailable = false;
    this.updateInfo = null;
    this.downloadProgress = null;

    // Initialize auto-updater configuration
    this.setupAutoUpdater();
    
    // Bind event handlers
    this.bindAutoUpdaterEvents();
    
    this.logger.info(`UpdateManager initialized for version ${this.currentVersion}`);
  }

  /**
   * Configure the auto-updater based on the current platform
   */
  setupAutoUpdater() {
    try {
      // Only configure auto-updater in production builds
      if (process.env.NODE_ENV === 'development') {
        this.logger.info('Update checking disabled in development mode');
        return;
      }

      // electron-updater automatically configures GitHub releases
      // Configure auto-download behavior
      autoUpdater.autoDownload = this.config.autoDownload;
      autoUpdater.autoInstallOnAppQuit = this.config.autoInstallOnAppQuit;
      autoUpdater.allowPrerelease = this.config.allowPrerelease;

      this.logger.info('Auto-updater configured for GitHub releases');

    } catch (error) {
      this.logger.error('Failed to setup auto-updater:', error);
    }
  }

  /**
   * Bind all auto-updater event handlers
   */
  bindAutoUpdaterEvents() {
    autoUpdater.on('checking-for-update', () => {
      this.isChecking = true;
      this.logger.info('Checking for application updates...');
      this.emit('checking-for-update');
    });

    autoUpdater.on('update-available', (info) => {
      this.isChecking = false;
      this.updateAvailable = true;
      this.updateInfo = info;
      this.logger.info(`Update available: ${info.version}`, info);
      this.emit('update-available', info);
      
      if (this.config.notify) {
        this.showUpdateAvailableDialog(info);
      }
    });

    autoUpdater.on('update-not-available', (info) => {
      this.isChecking = false;
      this.updateAvailable = false;
      this.logger.info('No updates available');
      this.emit('update-not-available', info);
    });

    autoUpdater.on('error', (error) => {
      this.isChecking = false;
      this.logger.error('Auto-updater error:', error);
      this.emit('error', error);
      
      if (this.config.notify && !this.config.silent) {
        this.showUpdateErrorDialog(error);
      }
    });

    autoUpdater.on('download-progress', (progressObj) => {
      this.downloadProgress = progressObj;
      this.logger.debug('Download progress:', progressObj);
      this.emit('download-progress', progressObj);
    });

    autoUpdater.on('update-downloaded', (info) => {
      this.logger.info('Update downloaded, will install on app restart', info);
      this.emit('update-downloaded', info);
      
      if (this.config.notify) {
        this.showUpdateReadyDialog(info);
      }
    });
  }

  /**
   * Start automatic update checking
   */
  startUpdateChecking() {
    if (process.env.NODE_ENV === 'development') {
      this.logger.info('Update checking disabled in development mode');
      return;
    }

    // Initial check
    this.checkForUpdates();
    
    // Schedule periodic checks
    this.updateCheckTimer = setInterval(() => {
      this.checkForUpdates();
    }, this.config.checkInterval);
    
    this.logger.info(`Automatic update checking started (interval: ${this.config.checkInterval}ms)`);
  }

  /**
   * Stop automatic update checking
   */
  stopUpdateChecking() {
    if (this.updateCheckTimer) {
      clearInterval(this.updateCheckTimer);
      this.updateCheckTimer = null;
      this.logger.info('Automatic update checking stopped');
    }
  }

  /**
   * Manually check for updates
   */
  async checkForUpdates() {
    if (this.isChecking) {
      this.logger.debug('Update check already in progress, skipping');
      return;
    }

    if (process.env.NODE_ENV === 'development') {
      this.logger.info('Update checking disabled in development mode');
      return;
    }

    try {
      this.logger.info('Manually checking for updates...');
      autoUpdater.checkForUpdates();
    } catch (error) {
      this.logger.error('Failed to check for updates:', error);
      this.emit('error', error);
    }
  }

  /**
   * Download and install available update
   */
  downloadAndInstallUpdate() {
    if (!this.updateAvailable) {
      this.logger.warn('No update available to download');
      return;
    }

    try {
      this.logger.info('Downloading update...');
      autoUpdater.downloadUpdate();
    } catch (error) {
      this.logger.error('Failed to download update:', error);
      this.emit('error', error);
    }
  }

  /**
   * Install downloaded update and restart application
   */
  quitAndInstall() {
    try {
      this.logger.info('Installing update and restarting application...');
      autoUpdater.quitAndInstall(false, true);
    } catch (error) {
      this.logger.error('Failed to quit and install update:', error);
      this.emit('error', error);
    }
  }

  /**
   * Show dialog when update is available
   */
  async showUpdateAvailableDialog(updateInfo) {
    const response = await dialog.showMessageBox({
      type: 'info',
      title: 'Update Available',
      message: `A new version of Macro Keyboard is available!`,
      detail: `Current version: ${this.currentVersion}\nLatest version: ${updateInfo.version}\n\nWould you like to download and install the update?`,
      buttons: ['Download Update', 'Later', 'View Release Notes'],
      defaultId: 0,
      cancelId: 1
    });

    switch (response.response) {
      case 0: // Download Update
        this.downloadAndInstallUpdate();
        break;
      case 1: // Later
        this.logger.info('User chose to update later');
        break;
      case 2: // View Release Notes
        this.openReleaseNotes(updateInfo.version);
        break;
    }
  }

  /**
   * Show dialog when update is ready to install
   */
  async showUpdateReadyDialog(updateInfo) {
    const response = await dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: 'Update has been downloaded and is ready to install.',
      detail: `The application will restart to complete the installation.\n\nVersion: ${updateInfo.version}`,
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1
    });

    if (response.response === 0) {
      this.quitAndInstall();
    } else {
      this.logger.info('User chose to restart later');
    }
  }

  /**
   * Show dialog when update error occurs
   */
  async showUpdateErrorDialog(error) {
    await dialog.showErrorBox(
      'Update Error',
      `Failed to check for updates:\n\n${error.message}\n\nPlease check your internet connection and try again later.`
    );
  }

  /**
   * Open release notes in default browser
   */
  openReleaseNotes(version) {
    const { shell } = require('electron');
    const url = `https://github.com/${this.config.owner}/${this.config.repo}/releases/tag/v${version}`;
    shell.openExternal(url);
    this.logger.info(`Opened release notes: ${url}`);
  }

  /**
   * Get current update status
   */
  getUpdateStatus() {
    return {
      currentVersion: this.currentVersion,
      isChecking: this.isChecking,
      updateAvailable: this.updateAvailable,
      updateInfo: this.updateInfo,
      downloadProgress: this.downloadProgress,
      autoUpdateEnabled: this.config.autoDownload,
      lastChecked: this.lastChecked
    };
  }

  /**
   * Update configuration settings
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('UpdateManager configuration updated');
    
    // Restart update checking if interval changed
    if (newConfig.checkInterval && this.updateCheckTimer) {
      this.stopUpdateChecking();
      this.startUpdateChecking();
    }

    this.emit('config-updated', this.config);
  }

  /**
   * Get update statistics
   */
  getStatistics() {
    return {
      currentVersion: this.currentVersion,
      checksPerformed: this.checksPerformed || 0,
      updatesAvailable: this.updatesAvailable || 0,
      updatesInstalled: this.updatesInstalled || 0,
      lastCheckTime: this.lastChecked,
      errors: this.errors || 0
    };
  }

  /**
   * Enable or disable automatic updates
   */
  setAutoUpdateEnabled(enabled) {
    if (enabled) {
      this.startUpdateChecking();
    } else {
      this.stopUpdateChecking();
    }
    
    this.config.autoDownload = enabled;
    this.logger.info(`Automatic updates ${enabled ? 'enabled' : 'disabled'}`);
    this.emit('auto-update-toggled', enabled);
  }

  /**
   * Check if updates are supported on current platform
   */
  isUpdateSupported() {
    const platform = os.platform();
    const supportedPlatforms = ['darwin', 'win32', 'linux'];
    return supportedPlatforms.includes(platform) && process.env.NODE_ENV !== 'development';
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.stopUpdateChecking();
    this.removeAllListeners();
    this.logger.info('UpdateManager cleaned up');
  }
}

module.exports = UpdateManager;