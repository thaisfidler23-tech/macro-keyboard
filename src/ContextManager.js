/**
 * Context Manager - Monitors system state and manages context-aware profile switching
 * 
 * This module provides intelligent profile switching based on:
 * - Active application/window
 * - Time of day and schedules
 * - System state (idle, active, presentation mode)
 * - User-defined triggers and conditions
 */

const EventEmitter = require('events');
const { exec } = require('child_process');
const crypto = require('crypto');

class ContextManager extends EventEmitter {
  constructor(logger, config = {}) {
    super();
    
    this.logger = logger || {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {}
    };
    
    // Configuration with defaults
    this.config = {
      monitoringInterval: config.monitoringInterval || 1000,
      idleThreshold: config.idleThreshold || 300000, // 5 minutes
      applicationChangeThreshold: config.applicationChangeThreshold || 500,
      hysteresisTime: config.hysteresisTime || 2000, // 2 seconds to prevent rapid switching
      maxHistorySize: config.maxHistorySize || 50,
      ...config
    };
    
    // State tracking
    this.currentContext = {
      application: { name: 'Unknown', pid: null, platform: process.platform },
      timeContext: { hour: new Date().getHours(), dayOfWeek: new Date().getDay() },
      systemState: { state: 'active', idleTime: 0, presentationMode: false },
      lastUpdate: new Date().toISOString()
    };
    
    // Context rules storage
    this.contextRules = [];
    this.contextHistory = [];
    
    // Monitoring state
    this.monitoring = false;
    this.monitoringTimer = null;
    this.lastApplicationCheck = null;
    this.lastContextChange = null;
    
    // Statistics
    this.statistics = {
      contextChanges: 0,
      applicationSwitches: 0,
      timeRuleMatches: 0,
      systemStateChanges: 0,
      lastContextChange: null,
      averageUpdateTime: 0,
      totalUpdateTime: 0,
      updateCount: 0
    };
    
    this.logger.info('ContextManager initialized');
  }

  /**
   * Start monitoring system context
   */
  startMonitoring() {
    if (this.monitoring) {
      this.logger.warn('Context monitoring already started');
      return;
    }

    this.monitoring = true;
    this.monitoringTimer = setInterval(() => {
      this.updateContext();
    }, this.config.monitoringInterval);

    this.logger.info('Context monitoring started');
    this.emit('monitoringStarted');
  }

  /**
   * Stop monitoring system context
   */
  stopMonitoring() {
    if (!this.monitoring) {
      return;
    }

    this.monitoring = false;
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }

    this.logger.info('Context monitoring stopped');
    this.emit('monitoringStopped');
  }

  /**
   * Check if monitoring is active
   */
  isMonitoring() {
    return this.monitoring;
  }

  /**
   * Update current context by checking all context sources
   */
  async updateContext() {
    const startTime = Date.now();
    
    try {
      const previousContext = { ...this.currentContext };
      
      // Update application context
      const appInfo = await this.getCurrentApplication();
      if (appInfo.name !== this.currentContext.application.name) {
        this.currentContext.application = appInfo;
        this.statistics.applicationSwitches++;
        this.emit('applicationChanged', appInfo);
      }

      // Update time context
      const now = new Date();
      this.currentContext.timeContext = {
        hour: now.getHours(),
        dayOfWeek: now.getDay(),
        timestamp: now.toISOString()
      };

      // Update system state
      const systemState = await this.getSystemState();
      if (systemState.state !== this.currentContext.systemState.state) {
        this.currentContext.systemState = systemState;
        this.statistics.systemStateChanges++;
        this.emit('systemStateChanged', systemState);
      }

      this.currentContext.lastUpdate = new Date().toISOString();

      // Check if context has changed significantly
      if (this.hasContextChanged(previousContext, this.currentContext)) {
        this.handleContextChange();
      }

      // Update performance statistics
      const updateTime = Date.now() - startTime;
      this.statistics.totalUpdateTime += updateTime;
      this.statistics.updateCount++;
      this.statistics.averageUpdateTime = this.statistics.totalUpdateTime / this.statistics.updateCount;

    } catch (error) {
      this.logger.error('Error updating context:', error);
    }
  }

  /**
   * Get current active application information
   */
  async getCurrentApplication() {
    return new Promise((resolve) => {
      const commands = this.getPlatformCommands();
      
      exec(commands.getActiveApplication, (error, stdout) => {
        if (error) {
          this.logger.error('Error getting active application:', error);
          resolve({
            name: 'Unknown',
            pid: null,
            platform: process.platform,
            error: error.message
          });
          return;
        }

        const appName = stdout.trim();
        resolve({
          name: appName,
          pid: null, // Could be enhanced to get PID
          platform: process.platform,
          timestamp: new Date().toISOString()
        });
      });
    });
  }

  /**
   * Get system state information
   */
  async getSystemState() {
    return new Promise((resolve) => {
      const commands = this.getPlatformCommands();
      
      // Check idle time
      exec(commands.getIdleTime, (error, stdout) => {
        let idleTime = 0;
        if (!error && stdout) {
          idleTime = parseInt(stdout.trim()) || 0;
        }

        // Check presentation mode
        exec(commands.checkPresentationMode, (presError, presStdout) => {
          const presentationMode = !presError && presStdout && presStdout.trim().length > 0;
          
          resolve({
            state: idleTime > this.config.idleThreshold ? 'idle' : 'active',
            idleTime: idleTime,
            presentationMode: presentationMode,
            timestamp: new Date().toISOString()
          });
        });
      });
    });
  }

  /**
   * Get platform-specific commands
   */
  getPlatformCommands() {
    switch (process.platform) {
      case 'darwin': // macOS
        return {
          getActiveApplication: `osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true'`,
          getIdleTime: `ioreg -c IOHIDSystem | awk '/HIDIdleTime/ {print int($NF/1000000000); exit}'`,
          checkPresentationMode: `ps aux | grep -i 'keynote\\|powerpoint\\|impress' | grep -v grep`
        };
      case 'win32': // Windows
        return {
          getActiveApplication: `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(''); (Get-Process | Where-Object {$_.MainWindowTitle -ne ''} | Sort-Object CPU -Descending | Select-Object -First 1).ProcessName"`,
          getIdleTime: `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SystemInformation]::IdleTime.TotalMilliseconds"`,
          checkPresentationMode: `tasklist | findstr /i "powerpnt.exe keynote.exe impress.exe"`
        };
      case 'linux': // Linux
        return {
          getActiveApplication: `xdotool getwindowfocus getwindowname 2>/dev/null || echo "Unknown"`,
          getIdleTime: `xprintidle 2>/dev/null || echo "0"`,
          checkPresentationMode: `ps aux | grep -i 'libreoffice\\|openoffice\\|presentation' | grep -v grep`
        };
      default:
        return {
          getActiveApplication: `echo "Unknown"`,
          getIdleTime: `echo "0"`,
          checkPresentationMode: `echo ""`
        };
    }
  }

  /**
   * Check if context has changed significantly
   */
  hasContextChanged(previous, current) {
    // Application changed
    if (previous.application.name !== current.application.name) {
      return true;
    }

    // System state changed
    if (previous.systemState.state !== current.systemState.state) {
      return true;
    }

    // Hour changed (for time-based rules)
    if (previous.timeContext.hour !== current.timeContext.hour) {
      return true;
    }

    return false;
  }

  /**
   * Handle context change and evaluate rules
   */
  async handleContextChange() {
    try {
      // Implement hysteresis to prevent rapid switching
      const now = Date.now();
      if (this.lastContextChange && (now - this.lastContextChange) < this.config.hysteresisTime) {
        return;
      }

      this.lastContextChange = now;
      this.statistics.contextChanges++;
      this.statistics.lastContextChange = new Date().toISOString();

      // Add to context history
      this.contextHistory.unshift({
        timestamp: new Date().toISOString(),
        ...this.currentContext
      });

      // Limit history size
      if (this.contextHistory.length > this.config.maxHistorySize) {
        this.contextHistory = this.contextHistory.slice(0, this.config.maxHistorySize);
      }

      // Evaluate context and find matching rules
      const evaluation = await this.evaluateContext();
      
      this.logger.debug('Context changed:', evaluation);
      this.emit('contextChanged', evaluation);

    } catch (error) {
      this.logger.error('Error handling context change:', error);
    }
  }

  /**
   * Add a context rule
   */
  addRule(rule) {
    if (!rule || typeof rule !== 'object') {
      throw new Error('Rule must be an object');
    }

    if (!rule.name || !rule.type || !rule.targetProfile) {
      throw new Error('Rule must have name, type, and targetProfile');
    }

    if (!['application', 'time', 'system', 'combined'].includes(rule.type)) {
      throw new Error('Invalid rule type');
    }

    // Validate type-specific fields
    this.validateRuleFields(rule);

    // Generate ID if not provided
    if (!rule.id) {
      rule.id = crypto.randomUUID();
    }

    // Set default priority
    if (!rule.priority) {
      rule.priority = 'medium';
    }

    rule.createdAt = new Date().toISOString();
    rule.enabled = rule.enabled !== false;

    this.contextRules.push(rule);
    this.logger.info(`Added context rule: ${rule.name}`);
    this.emit('ruleAdded', rule);
  }

  /**
   * Remove a context rule
   */
  removeRule(ruleId) {
    const index = this.contextRules.findIndex(rule => rule.id === ruleId);
    if (index === -1) {
      throw new Error(`Rule not found: ${ruleId}`);
    }

    const removedRule = this.contextRules.splice(index, 1)[0];
    this.logger.info(`Removed context rule: ${removedRule.name}`);
    this.emit('ruleRemoved', removedRule);
  }

  /**
   * Update a context rule
   */
  updateRule(ruleId, updates) {
    const rule = this.contextRules.find(rule => rule.id === ruleId);
    if (!rule) {
      throw new Error(`Rule not found: ${ruleId}`);
    }

    // Validate updates
    if (updates.type && !['application', 'time', 'system', 'combined'].includes(updates.type)) {
      throw new Error('Invalid rule type');
    }

    Object.assign(rule, updates);
    rule.updatedAt = new Date().toISOString();

    // Validate the updated rule
    this.validateRuleFields(rule);

    this.logger.info(`Updated context rule: ${rule.name}`);
    this.emit('ruleUpdated', rule);
  }

  /**
   * Validate rule fields based on type
   */
  validateRuleFields(rule) {
    switch (rule.type) {
      case 'application':
        if (!rule.applicationName) {
          throw new Error('Application rules must have applicationName');
        }
        break;
      case 'time':
        if (!rule.startTime || !rule.endTime) {
          throw new Error('Time rules must have startTime and endTime');
        }
        // Validate time format
        if (!/^\d{2}:\d{2}$/.test(rule.startTime) || !/^\d{2}:\d{2}$/.test(rule.endTime)) {
          throw new Error('Invalid time format. Use HH:MM');
        }
        break;
      case 'system':
        if (!rule.systemState) {
          throw new Error('System rules must have systemState');
        }
        break;
    }
  }

  /**
   * Get all context rules
   */
  getRules() {
    return [...this.contextRules];
  }

  /**
   * Get current context
   */
  getCurrentContext() {
    return { ...this.currentContext };
  }

  /**
   * Evaluate current context against all rules
   */
  async evaluateContext() {
    const matchingRules = [];

    // Evaluate application rules
    const appRules = this.contextRules.filter(rule => 
      rule.type === 'application' && rule.enabled
    );
    
    for (const rule of appRules) {
      if (this.evaluateApplicationRule(rule)) {
        matchingRules.push(rule);
      }
    }

    // Evaluate time rules
    const timeRules = this.evaluateTimeRules();
    matchingRules.push(...timeRules);

    // Evaluate system rules
    const systemRules = this.contextRules.filter(rule => 
      rule.type === 'system' && rule.enabled
    );
    
    for (const rule of systemRules) {
      if (this.evaluateSystemRule(rule)) {
        matchingRules.push(rule);
      }
    }

    // Sort by priority
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    matchingRules.sort((a, b) => 
      (priorityOrder[b.priority] || 2) - (priorityOrder[a.priority] || 2)
    );

    // Get recommended profile (highest priority rule)
    const recommendedProfile = matchingRules.length > 0 ? matchingRules[0].targetProfile : null;

    return {
      currentContext: this.getCurrentContext(),
      matchingRules,
      recommendedProfile,
      evaluatedAt: new Date().toISOString()
    };
  }

  /**
   * Evaluate application rule
   */
  evaluateApplicationRule(rule) {
    const currentApp = this.currentContext.application.name;
    
    if (rule.applicationName) {
      if (rule.processPattern) {
        const regex = new RegExp(rule.processPattern, 'i');
        return regex.test(currentApp);
      } else {
        return currentApp.toLowerCase().includes(rule.applicationName.toLowerCase());
      }
    }
    
    return false;
  }

  /**
   * Evaluate time-based rules
   */
  evaluateTimeRules() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDayName = dayNames[currentDay];

    const matchingRules = [];
    
    const timeRules = this.contextRules.filter(rule => 
      rule.type === 'time' && rule.enabled
    );

    for (const rule of timeRules) {
      // Check if today is included in the rule's days
      if (rule.days && rule.days.length > 0) {
        if (!rule.days.includes(currentDayName)) {
          continue;
        }
      }

      // Parse start and end times
      const [startHour, startMinute] = rule.startTime.split(':').map(Number);
      const [endHour, endMinute] = rule.endTime.split(':').map(Number);
      
      const currentTime = currentHour * 60 + currentMinute;
      const startTime = startHour * 60 + startMinute;
      const endTime = endHour * 60 + endMinute;

      // Handle rules that span midnight
      let inTimeRange = false;
      if (endTime < startTime) {
        // Spans midnight
        inTimeRange = currentTime >= startTime || currentTime <= endTime;
      } else {
        // Same day
        inTimeRange = currentTime >= startTime && currentTime <= endTime;
      }

      if (inTimeRange) {
        matchingRules.push(rule);
        this.statistics.timeRuleMatches++;
      }
    }

    return matchingRules;
  }

  /**
   * Evaluate system state rule
   */
  evaluateSystemRule(rule) {
    const currentSystemState = this.currentContext.systemState;
    
    switch (rule.systemState) {
      case 'idle':
        return currentSystemState.state === 'idle';
      case 'active':
        return currentSystemState.state === 'active';
      case 'presentation':
        return currentSystemState.presentationMode;
      case 'focus':
        // Could be enhanced with focus mode detection
        return false;
      default:
        return false;
    }
  }

  /**
   * Get context history
   */
  getContextHistory() {
    return [...this.contextHistory];
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return {
      ...this.statistics,
      totalRules: this.contextRules.length,
      enabledRules: this.contextRules.filter(rule => rule.enabled).length,
      rulesByType: {
        application: this.contextRules.filter(rule => rule.type === 'application').length,
        time: this.contextRules.filter(rule => rule.type === 'time').length,
        system: this.contextRules.filter(rule => rule.type === 'system').length,
        combined: this.contextRules.filter(rule => rule.type === 'combined').length
      },
      uptime: this.monitoring ? Date.now() - this.statistics.startTime : 0
    };
  }

  /**
   * Reset statistics
   */
  resetStatistics() {
    this.statistics = {
      contextChanges: 0,
      applicationSwitches: 0,
      timeRuleMatches: 0,
      systemStateChanges: 0,
      lastContextChange: null,
      averageUpdateTime: 0,
      totalUpdateTime: 0,
      updateCount: 0,
      startTime: Date.now()
    };
    
    this.emit('statisticsReset');
  }

  /**
   * Export context rules
   */
  exportRules() {
    return {
      rules: this.contextRules,
      exportedAt: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  /**
   * Import context rules
   */
  importRules(rulesData) {
    if (!rulesData.rules || !Array.isArray(rulesData.rules)) {
      throw new Error('Invalid rules data format');
    }

    // Validate all rules before importing
    for (const rule of rulesData.rules) {
      this.validateRuleFields(rule);
    }

    this.contextRules = [...rulesData.rules];
    this.logger.info(`Imported ${rulesData.rules.length} context rules`);
    this.emit('rulesImported', rulesData);
  }
}

module.exports = ContextManager;