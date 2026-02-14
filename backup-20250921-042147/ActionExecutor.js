const { spawn, exec } = require('child_process');
const os = require('os');
const SecurityManager = require('./SecurityManager');

// Try to load robotjs, but handle failure gracefully
let robot = null;
let robotjsError = null;

try {
  robot = require('robotjs');
} catch (error) {
  robotjsError = error;
  this.logger.warn('Warning: robotjs failed to load. Keypress actions will not be available:', error.message);
}

/**
 * Action Execution Engine for Macro Keyboard
 *
 * Handles execution of different action types:
 * - keypress: Keyboard shortcuts and key combinations
 * - command: Shell commands with security restrictions
 * - application: Application launching
 */
class ActionExecutor {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.securityManager = new SecurityManager(config, logger);

    // Initialize platform-specific settings
    this.platform = process.platform;
    this.commandTimeout = (config?.security?.commandExecution?.timeout) || 10000;
    this.maxCommandLength = (config?.security?.commandExecution?.maxLength) || 1000;

    // Initialize robotjs if available
    if (robot) {
      robot.setDelay(10);
      if (robot.setKeyboardDelay) {
        robot.setKeyboardDelay(10);
      }
    }
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
      case 'macro_sequence':
        return await this.executeMacroSequence(actionConfig, context);
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
      // Check if robotjs is available
      if (!robot) {
        this.logger.error(`Keypress action failed: robotjs not available (${robotjsError?.message}). Action: ${keyAction} for ${context}`);
        return false;
      }

      // Security validation using SecurityManager
      const validationResult = this.securityManager.validateAction({
        type: 'keypress',
        action: keyAction
      }, context);

      if (!validationResult.isValid) {
        this.logger.error(`Keypress failed security validation: ${validationResult.reason} - ${keyAction} for ${context}`);
        return false;
      }

      // Apply security sanitization
      const sanitizedKeyAction = this.securityManager.sanitizeKeypress(keyAction);

      // Parse and normalize key combinations
      const normalizedKeys = this.normalizeKeyCombo(sanitizedKeyAction);

      if (normalizedKeys.length === 0) {
        this.logger.error(`Invalid key combination: ${sanitizedKeyAction} for ${context}`);
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
        // Security validation using SecurityManager
        const validationResult = this.securityManager.validateAction({
          type: 'command',
          action: command
        }, context);

        if (!validationResult.isValid) {
          this.logger.error(`Command failed security validation: ${command} for ${context}`);
          resolve(false);
          return;
        }

        // Apply security sanitization
        const sanitizedCommand = this.securityManager.sanitizeCommand(command);

        this.logger.info(`Executing command for ${context}: ${sanitizedCommand}`);

        const child = exec(sanitizedCommand, {
          timeout: this.commandTimeout,
          maxBuffer: 1024 * 1024, // 1MB max output
          env: { ...process.env, PATH: process.env.PATH } // Inherit PATH but nothing else sensitive
        }, (error, stdout, stderr) => {
          if (error) {
            this.logger.error(`Command execution failed for ${context}:`, error.message);
            resolve(false);
          } else {
            this.logger.info(`Command completed successfully for ${context}`);
            if (stdout) {
              this.logger.debug('Command output:', stdout.trim());
            }
            if (stderr) {
              this.logger.warn('Command stderr:', stderr.trim());
            }
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
        // Security validation using SecurityManager
        const validationResult = this.securityManager.validateAction({
          type: 'application',
          action: appName
        }, context);

        if (!validationResult.isValid) {
          this.logger.error(`Application failed security validation: ${validationResult.reason} - ${appName} for ${context}`);
          resolve(false);
          return;
        }

        // Apply security sanitization
        const sanitizedAppName = this.securityManager.sanitizeApplication(appName);

        let command;
        let args = [];

        // Platform-specific application launching
        switch (this.platform) {
        case 'darwin': // macOS
          command = 'open';
          if (sanitizedAppName.endsWith('.app') || sanitizedAppName.startsWith('/')) {
            args = ['-a', sanitizedAppName];
          } else {
            args = ['-a', sanitizedAppName];
          }
          break;

        case 'win32': // Windows
          command = 'start';
          args = ['""', sanitizedAppName]; // Empty title for start command
          break;

        default: // Linux and others
          command = 'xdg-open';
          args = [sanitizedAppName];
          break;
        }

        this.logger.info(`Launching application for ${context}: ${sanitizedAppName}`);

        const child = spawn(command, args, {
          detached: true,
          stdio: 'ignore'
        });

        child.unref(); // Allow parent to exit without waiting

        child.on('error', (error) => {
          this.logger.error(`Failed to launch application ${sanitizedAppName} for ${context}:`, error);
          resolve(false);
        });

        child.on('spawn', () => {
          this.logger.info(`Application launched successfully for ${context}: ${sanitizedAppName}`);
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
   * Execute a macro sequence action
   * @param {Object} actionConfig - Full action configuration with sequence data
   * @param {string} context - Context for logging
   */
  async executeMacroSequence(actionConfig, context) {
    try {
      const { action: sequenceName, sequence } = actionConfig;

      // Get MacroRecorder instance if available
      if (this.macroRecorder) {
        this.logger.info(`Executing macro sequence via MacroRecorder: ${sequenceName} for ${context}`);
        return await this.macroRecorder.playSequence(sequenceName);
      }

      // Fallback: Execute sequence directly if provided in action config
      if (sequence && Array.isArray(sequence)) {
        this.logger.info(`Executing inline macro sequence for ${context} (${sequence.length} steps)`);

        for (let i = 0; i < sequence.length; i++) {
          const step = sequence[i];

          // Apply delay if specified
          if (step.delay && step.delay > 0) {
            await this.delay(step.delay);
          }

          // Execute the step
          const stepContext = `${context}_step_${i + 1}`;
          const success = await this.executeAction(step, stepContext);

          if (!success) {
            this.logger.error(`Macro sequence step failed at ${i + 1}/${sequence.length} for ${context}`);
            return false;
          }

          this.logger.debug(`Executed macro sequence step ${i + 1}/${sequence.length}: ${step.description || step.type}`);
        }

        this.logger.info(`Completed inline macro sequence for ${context}`);
        return true;
      }

      // No sequence data available
      this.logger.error(`No macro sequence data available for ${sequenceName} in ${context}`);
      return false;
    } catch (error) {
      this.logger.error(`Error executing macro sequence for ${context}:`, error);
      return false;
    }
  }

  /**
   * Set the MacroRecorder instance for sequence playback
   */
  setMacroRecorder(macroRecorder) {
    this.macroRecorder = macroRecorder;
    this.logger.info('MacroRecorder instance attached to ActionExecutor');
  }

  /**
   * Utility delay function for macro sequences
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate a command without executing it
   * @param {string} command - Command to validate
   * @returns {boolean} True if command is valid and safe
   */
  validateCommand(command) {
    try {
      if (!command || typeof command !== 'string' || command.trim() === '') {
        return false;
      }

      // Use SecurityManager for validation
      const validationResult = this.securityManager.validateAction({
        type: 'command',
        action: command
      }, 'validation');

      return validationResult.isValid;
    } catch (error) {
      this.logger.error('Error validating command:', error);
      return false;
    }
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

  /**
   * Get security statistics from SecurityManager
   * @returns {Object} Security statistics
   */
  getSecurityStats() {
    return this.securityManager.getStatistics();
  }
}

module.exports = ActionExecutor;

module.exports = ActionExecutor;
