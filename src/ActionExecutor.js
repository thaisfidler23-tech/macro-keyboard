const robot = require('robotjs');
const { spawn, exec } = require('child_process');
const path = require('path');
const os = require('os');

/**
 * Action Execution Engine for Macro Keyboard
 * 
 * Handles execution of different action types:
 * - keypress: Keyboard shortcuts and key combinations
 * - command: Shell commands with security restrictions
 * - application: Application launching
 */
class ActionExecutor {
  constructor(logger) {
    this.logger = logger;
    this.platform = process.platform;
    this.commandTimeout = 10000; // 10 second timeout for commands
    this.maxCommandLength = 1000; // Maximum command length for security
    
    // Initialize robotjs settings for better performance
    robot.setDelay(10);
    robot.setKeyboardDelay(10);
    
    this.logger.info('Action Executor initialized for platform:', this.platform);
  }

  /**
   * Execute an action based on its configuration
   * @param {Object} actionConfig - Configuration object with type and action
   * @param {string} context - Context for logging (button1, encoder1:CW, etc.)
   */
  async executeAction(actionConfig, context = 'unknown') {
    if (!actionConfig || !actionConfig.type || !actionConfig.action) {
      this.logger.warn(`Invalid action configuration for ${context}:`, actionConfig);
      return false;
    }

    const { type, action } = actionConfig;
    
    try {
      this.logger.info(`Executing ${type} action for ${context}: ${action}`);
      
      switch (type) {
        case 'keypress':
          return await this.executeKeypress(action, context);
        case 'command':
          return await this.executeCommand(action, context);
        case 'application':
          return await this.launchApplication(action, context);
        default:
          this.logger.error(`Unknown action type: ${type} for ${context}`);
          return false;
      }
    } catch (error) {
      this.logger.error(`Error executing action for ${context}:`, error);
      return false;
    }
  }

  /**
   * Execute keyboard shortcuts and key combinations
   * @param {string} keyAction - Key combination (e.g., "cmd+c", "ctrl+alt+t")
   * @param {string} context - Context for logging
   */
  async executeKeypress(keyAction, context) {
    try {
      // Parse and normalize key combinations
      const normalizedKeys = this.normalizeKeyCombo(keyAction);
      
      if (normalizedKeys.length === 0) {
        this.logger.error(`Invalid key combination: ${keyAction} for ${context}`);
        return false;
      }

      // Handle single key vs key combinations
      if (normalizedKeys.length === 1) {
        robot.keyTap(normalizedKeys[0]);
        this.logger.debug(`Single key pressed: ${normalizedKeys[0]}`);
      } else {
        // Handle key combinations (modifiers + key)
        const modifiers = normalizedKeys.slice(0, -1);
        const key = normalizedKeys[normalizedKeys.length - 1];
        
        robot.keyTap(key, modifiers);
        this.logger.debug(`Key combination pressed: ${modifiers.join('+')}+${key}`);
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to execute keypress ${keyAction}:`, error);
      return false;
    }
  }

  /**
   * Execute shell commands with security restrictions
   * @param {string} command - Command to execute
   * @param {string} context - Context for logging
   */
  async executeCommand(command, context) {
    return new Promise((resolve) => {
      try {
        // Security validation
        if (!this.validateCommand(command)) {
          this.logger.error(`Command failed security validation: ${command} for ${context}`);
          resolve(false);
          return;
        }

        this.logger.info(`Executing command for ${context}: ${command}`);
        
        const child = exec(command, {
          timeout: this.commandTimeout,
          maxBuffer: 1024 * 1024, // 1MB max output
          env: { ...process.env, PATH: process.env.PATH } // Inherit PATH but nothing else sensitive
        }, (error, stdout, stderr) => {
          if (error) {
            this.logger.error(`Command execution failed for ${context}:`, error.message);
            resolve(false);
          } else {
            this.logger.info(`Command completed successfully for ${context}`);
            if (stdout) this.logger.debug('Command output:', stdout.trim());
            if (stderr) this.logger.warn('Command stderr:', stderr.trim());
            resolve(true);
          }
        });

        // Ensure process cleanup
        child.on('close', (code) => {
          this.logger.debug(`Command process exited with code ${code} for ${context}`);
        });

      } catch (error) {
        this.logger.error(`Failed to execute command for ${context}:`, error);
        resolve(false);
      }
    });
  }

  /**
   * Launch applications by name or path
   * @param {string} appName - Application name or path
   * @param {string} context - Context for logging
   */
  async launchApplication(appName, context) {
    return new Promise((resolve) => {
      try {
        let command;
        let args = [];

        // Platform-specific application launching
        switch (this.platform) {
          case 'darwin': // macOS
            command = 'open';
            if (appName.endsWith('.app') || appName.startsWith('/')) {
              args = ['-a', appName];
            } else {
              args = ['-a', appName];
            }
            break;
          
          case 'win32': // Windows
            command = 'start';
            args = ['""', appName]; // Empty title for start command
            break;
          
          default: // Linux and others
            command = 'xdg-open';
            args = [appName];
            break;
        }

        this.logger.info(`Launching application for ${context}: ${appName}`);

        const child = spawn(command, args, {
          detached: true,
          stdio: 'ignore'
        });

        child.unref(); // Allow parent to exit without waiting

        child.on('error', (error) => {
          this.logger.error(`Failed to launch application ${appName} for ${context}:`, error);
          resolve(false);
        });

        child.on('spawn', () => {
          this.logger.info(`Application launched successfully for ${context}: ${appName}`);
          resolve(true);
        });

      } catch (error) {
        this.logger.error(`Failed to launch application for ${context}:`, error);
        resolve(false);
      }
    });
  }

  /**
   * Normalize key combinations for cross-platform compatibility
   * @param {string} keyCombo - Raw key combination string
   * @returns {Array} Normalized key array
   */
  normalizeKeyCombo(keyCombo) {
    if (!keyCombo || typeof keyCombo !== 'string') {
      return [];
    }

    // Split by + and clean up
    const parts = keyCombo.toLowerCase().split('+').map(k => k.trim());
    const normalized = [];

    for (const part of parts) {
      // Map platform-specific modifiers
      switch (part) {
        case 'cmd':
        case 'command':
        case 'super':
          normalized.push(this.platform === 'darwin' ? 'command' : 'control');
          break;
        case 'ctrl':
        case 'control':
          normalized.push('control');
          break;
        case 'alt':
        case 'option':
          normalized.push('alt');
          break;
        case 'shift':
          normalized.push('shift');
          break;
        case 'win':
        case 'meta':
          normalized.push(this.platform === 'win32' ? 'command' : 'alt');
          break;
        // Special keys
        case 'space':
          normalized.push('space');
          break;
        case 'enter':
        case 'return':
          normalized.push('enter');
          break;
        case 'tab':
          normalized.push('tab');
          break;
        case 'escape':
        case 'esc':
          normalized.push('escape');
          break;
        case 'backspace':
          normalized.push('backspace');
          break;
        case 'delete':
          normalized.push('delete');
          break;
        // Function keys
        case 'f1': case 'f2': case 'f3': case 'f4': case 'f5': case 'f6':
        case 'f7': case 'f8': case 'f9': case 'f10': case 'f11': case 'f12':
          normalized.push(part);
          break;
        // Arrow keys
        case 'up': case 'down': case 'left': case 'right':
          normalized.push(part);
          break;
        // Volume keys (macOS)
        case 'volumeup':
          normalized.push('audio_vol_up');
          break;
        case 'volumedown':
          normalized.push('audio_vol_down');
          break;
        case 'audiomute':
        case 'mute':
          normalized.push('audio_mute');
          break;
        default:
          // Regular character keys
          if (part.length === 1 && part.match(/[a-z0-9]/)) {
            normalized.push(part);
          } else if (part.length > 0) {
            // Try to use as-is for other keys
            normalized.push(part);
          }
          break;
      }
    }

    return normalized;
  }

  /**
   * Validate command for security (basic sandboxing)
   * @param {string} command - Command to validate
   * @returns {boolean} True if command is safe to execute
   */
  validateCommand(command) {
    if (!command || typeof command !== 'string') {
      return false;
    }

    // Length check
    if (command.length > this.maxCommandLength) {
      this.logger.error(`Command too long: ${command.length} characters`);
      return false;
    }

    // Dangerous patterns (basic protection)
    const dangerousPatterns = [
      /rm\s+-rf/i,           // Dangerous file deletion
      /\|\s*rm/i,            // Piped deletion
      />\s*\/dev\//i,        // Device access
      /sudo\s/i,             // Privilege escalation
      /passwd\s/i,           // Password changes
      /chmod\s.*777/i,       // Dangerous permissions
      /wget.*\|.*sh/i,       // Download and execute
      /curl.*\|.*sh/i,       // Download and execute
      /;\s*rm/i,             // Chained deletion
      /&&\s*rm/i,            // Conditional deletion
      /\/etc\/passwd/i,      // System file access
      /\/etc\/shadow/i,      // System file access
      /\$\(.*\)/,            // Command substitution
      /`.*`/,                // Backtick execution
      /<\s*\(/,              // Process substitution
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        this.logger.error(`Command contains dangerous pattern: ${pattern} in "${command}"`);
        return false;
      }
    }

    return true;
  }

  /**
   * Get platform-specific information for debugging
   * @returns {Object} Platform information
   */
  getPlatformInfo() {
    return {
      platform: this.platform,
      arch: os.arch(),
      release: os.release(),
      robotjsSupported: true
    };
  }
}

module.exports = ActionExecutor;