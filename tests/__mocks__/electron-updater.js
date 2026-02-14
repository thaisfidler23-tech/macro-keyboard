// Mock for electron-updater
const EventEmitter = require('events');

class MockAutoUpdater extends EventEmitter {
  constructor() {
    super();
    this.updateCheckResult = null;
    this.updateInfo = {
      version: '1.0.2',
      files: [],
      path: null,
      sha512: 'mock-sha512',
      releaseDate: new Date().toISOString()
    };
  }

  async checkForUpdatesAndNotify() {
    setTimeout(() => {
      this.emit('checking-for-update');
      
      // Simulate update check result
      setTimeout(() => {
        if (Math.random() > 0.5) {
          this.emit('update-available', this.updateInfo);
        } else {
          this.emit('update-not-available', this.updateInfo);
        }
      }, 100);
    }, 10);
    
    return Promise.resolve(this.updateInfo);
  }

  async checkForUpdates() {
    return this.checkForUpdatesAndNotify();
  }

  async downloadUpdate() {
    setTimeout(() => {
      this.emit('download-progress', {
        bytesPerSecond: 1048576,
        percent: 50,
        transferred: 52428800,
        total: 104857600
      });
      
      setTimeout(() => {
        this.emit('update-downloaded', this.updateInfo);
      }, 100);
    }, 10);
    
    return Promise.resolve();
  }

  quitAndInstall(isSilent = false, isForceRunAfter = false) {
    setTimeout(() => {
      this.emit('before-quit-for-update');
      // In a real scenario, this would quit the app and install update
    }, 10);
  }

  setFeedURL(options) {
    this.feedURL = options;
  }

  getFeedURL() {
    return this.feedURL;
  }
}

const autoUpdater = new MockAutoUpdater();

module.exports = { autoUpdater };