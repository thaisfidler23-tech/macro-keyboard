/**
 * Session Event Monitor
 * 
 * Monitors user session events across platforms including:
 * - Screen lock/unlock
 * - User login/logout
 * - Session switch (fast user switching)
 * - Idle/active state changes
 * 
 * @module SessionEventMonitor
 */

const EventEmitter = require('events');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class SessionEventMonitor extends EventEmitter {
  constructor(logger, config = {}) {
    super();
    
    this.logger = logger;
    this.config = {
      pollInterval: config.pollInterval || 5000,
      idleThreshold: config.idleThreshold || 300000, // 5 minutes
      platform: config.platform || process.platform,
      ...config
    };
    
    this.currentState = {
      locked: false,
      idle: false,
      activeUser: null,
      sessionId: null,
      lastActivity: Date.now()
    };
    
    this.pollTimer = null;
    this.running = false;
    
    this.statistics = {
      lockEvents: 0,
      unlockEvents: 0,
      idleEvents: 0,
      activeEvents: 0,
      sessionSwitches: 0
    };
  }

  /**
   * Start monitoring session events
   */
  async start() {
    if (this.running) {
      return;
    }

    this.running = true;
    this.logger?.info('Starting session event monitor');

    // Get initial state
    await this._updateSessionState();

    // Start polling
    this.pollTimer = setInterval(async () => {
      await this._updateSessionState();
    }, this.config.pollInterval);

    // Platform-specific event listeners
    this._setupPlatformListeners();

    this.emit('started');
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (!this.running) {
      return;
    }

    this.running = false;

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    this._cleanupPlatformListeners();

    this.logger?.info('Session event monitor stopped');
    this.emit('stopped');
  }

  /**
   * Update session state
   */
  async _updateSessionState() {
    try {
      const previousState = { ...this.currentState };
      
      switch (this.config.platform) {
        case 'darwin':
          await this._updateMacOSState();
          break;
        case 'win32':
          await this._updateWindowsState();
          break;
        case 'linux':
          await this._updateLinuxState();
          break;
        default:
          this.logger?.warn(`Unsupported platform: ${this.config.platform}`);
      }

      // Check for state changes and emit events
      this._checkStateChanges(previousState, this.currentState);
    } catch (error) {
      this.logger?.error('Failed to update session state', error);
    }
  }

  /**
   * Update macOS session state
   */
  async _updateMacOSState() {
    try {
      // Check if screen is locked using CGSessionCopyCurrentDictionary
      const { stdout: screenState } = await execAsync(
        'python3 -c "import Quartz; d = Quartz.CGSessionCopyCurrentDictionary(); print(d.get(\'CGSSessionScreenIsLocked\', 0) if d else 0)"',
        { timeout: 5000 }
      );
      this.currentState.locked = screenState.trim() === '1';

      // Get current user
      const { stdout: whoami } = await execAsync('whoami', { timeout: 3000 });
      this.currentState.activeUser = whoami.trim();

      // Check idle time using ioreg
      const { stdout: idleTime } = await execAsync(
        'ioreg -c IOHIDSystem | awk \'/HIDIdleTime/ {print $NF/1000000000; exit}\'',
        { timeout: 5000 }
      );
      const idleSeconds = parseFloat(idleTime) || 0;
      this.currentState.idle = idleSeconds * 1000 > this.config.idleThreshold;
      this.currentState.lastActivity = Date.now() - (idleSeconds * 1000);
    } catch (error) {
      this.logger?.debug('macOS state check failed', error);
    }
  }

  /**
   * Update Windows session state
   */
  async _updateWindowsState() {
    try {
      // Check session state using query session
      const { stdout: sessionInfo } = await execAsync(
        'query session %username%',
        { timeout: 5000 }
      );
      
      // Parse session state
      this.currentState.locked = sessionInfo.toLowerCase().includes('disc');

      // Get current user
      const { stdout: whoami } = await execAsync('whoami', { timeout: 3000 });
      this.currentState.activeUser = whoami.trim();

      // Get idle time (requires additional Windows API calls, simplified here)
      // In a real implementation, use Windows API GetLastInputInfo
      this.currentState.idle = false;
    } catch (error) {
      this.logger?.debug('Windows state check failed', error);
    }
  }

  /**
   * Update Linux session state
   */
  async _updateLinuxState() {
    try {
      // Check screen lock using various methods
      let locked = false;

      // Try gnome-screensaver
      try {
        const { stdout } = await execAsync(
          'gnome-screensaver-command -q 2>/dev/null || echo "inactive"',
          { timeout: 3000 }
        );
        locked = stdout.toLowerCase().includes('active');
      } catch {
        // Try xscreensaver
        try {
          const { stdout } = await execAsync(
            'xscreensaver-command -time 2>/dev/null',
            { timeout: 3000 }
          );
          locked = stdout.toLowerCase().includes('locked');
        } catch {
          // Unable to detect
        }
      }

      this.currentState.locked = locked;

      // Get current user
      const { stdout: whoami } = await execAsync('whoami', { timeout: 3000 });
      this.currentState.activeUser = whoami.trim();

      // Get idle time using xprintidle
      try {
        const { stdout: idleMs } = await execAsync('xprintidle 2>/dev/null || echo 0', { timeout: 3000 });
        const idleTime = parseInt(idleMs) || 0;
        this.currentState.idle = idleTime > this.config.idleThreshold;
        this.currentState.lastActivity = Date.now() - idleTime;
      } catch {
        this.currentState.idle = false;
      }
    } catch (error) {
      this.logger?.debug('Linux state check failed', error);
    }
  }

  /**
   * Check for state changes and emit events
   */
  _checkStateChanges(previous, current) {
    // Lock state change
    if (previous.locked !== current.locked) {
      if (current.locked) {
        this.statistics.lockEvents++;
        this.emit('lock', { timestamp: Date.now(), user: current.activeUser });
        this.logger?.info('Screen locked');
      } else {
        this.statistics.unlockEvents++;
        this.emit('unlock', { timestamp: Date.now(), user: current.activeUser });
        this.logger?.info('Screen unlocked');
      }
    }

    // Idle state change
    if (previous.idle !== current.idle) {
      if (current.idle) {
        this.statistics.idleEvents++;
        this.emit('idle', { timestamp: Date.now(), user: current.activeUser });
        this.logger?.info('User idle');
      } else {
        this.statistics.activeEvents++;
        this.emit('active', { timestamp: Date.now(), user: current.activeUser });
        this.logger?.info('User active');
      }
    }

    // User switch
    if (previous.activeUser && previous.activeUser !== current.activeUser) {
      this.statistics.sessionSwitches++;
      this.emit('userSwitch', {
        timestamp: Date.now(),
        previousUser: previous.activeUser,
        currentUser: current.activeUser
      });
      this.logger?.info('User switched', { from: previous.activeUser, to: current.activeUser });
    }
  }

  /**
   * Setup platform-specific event listeners
   */
  _setupPlatformListeners() {
    // Platform-specific listeners would go here
    // For macOS: NSWorkspace notifications
    // For Windows: WTS session notifications
    // For Linux: D-Bus session signals
  }

  /**
   * Cleanup platform-specific listeners
   */
  _cleanupPlatformListeners() {
    // Cleanup platform-specific listeners
  }

  /**
   * Get current session state
   */
  getState() {
    return { ...this.currentState };
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return { ...this.statistics };
  }

  /**
   * Check if screen is locked
   */
  isLocked() {
    return this.currentState.locked;
  }

  /**
   * Check if user is idle
   */
  isIdle() {
    return this.currentState.idle;
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    return this.currentState.activeUser;
  }
}

module.exports = SessionEventMonitor;
