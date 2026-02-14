const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');

/**
 * AlertingManager - Comprehensive automated alerting system
 *
 * Features:
 * - Real-time performance threshold monitoring
 * - Configurable alert rules and conditions
 * - Multiple notification channels (UI, email, system notifications)
 * - Alert escalation and acknowledgment system
 * - Historical alert tracking and analysis
 */
class AlertingManager extends EventEmitter {
  constructor(config = {}, logManager = null) {
    super();

    this.config = this.mergeConfig(config);
    this.logManager = logManager;
    this.isInitialized = false;
    this.isMonitoring = false;

    // Alert state management
    this.activeAlerts = new Map();
    this.alertHistory = [];
    this.alertRules = new Map();
    this.lastAlertCheck = Date.now();

    // Alert processing intervals
    this.alertCheckInterval = null;
    this.escalationCheckInterval = null;
    this.cleanupInterval = null;

    // Notification channels
    this.notificationChannels = new Map();

    // Alert statistics
    this.alertStats = {
      totalAlerts: 0,
      criticalAlerts: 0,
      warningAlerts: 0,
      infoAlerts: 0,
      acknowledgedAlerts: 0,
      falsePositives: 0,
      averageResolutionTime: 0
    };

    // Alert templates and formatting
    this.notificationTemplates = this.setupNotificationTemplates();

    this.init();
  }

  /**
   * Merge default configuration with user config
   */
  mergeConfig(userConfig) {
    const defaultConfig = {
      enabled: true,
      checkInterval: 5000, // 5 seconds
      escalationInterval: 300000, // 5 minutes
      cleanupInterval: 3600000, // 1 hour
      maxAlertHistory: 10000,
      retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days

      // Default alert thresholds
      thresholds: {
        latency: {
          buttonResponseTime: { warning: 50, critical: 100 },
          serialCommunication: { warning: 30, critical: 60 },
          actionExecution: { warning: 200, critical: 500 }
        },
        resource: {
          memoryUsage: { warning: 80, critical: 95 },
          cpuUsage: { warning: 70, critical: 90 },
          diskSpace: { warning: 85, critical: 95 }
        },
        hardware: {
          serialConnectionLoss: { warning: 1, critical: 3 },
          buttonMissedEvents: { warning: 5, critical: 15 },
          encoderGlitches: { warning: 2, critical: 8 }
        },
        application: {
          errorRate: { warning: 1, critical: 5 },
          crashCount: { warning: 1, critical: 3 },
          configCorruption: { warning: 1, critical: 1 }
        }
      },

      // Notification channel configuration
      notifications: {
        ui: {
          enabled: true,
          priority: ['critical', 'warning', 'info']
        },
        system: {
          enabled: true,
          priority: ['critical', 'warning']
        },
        email: {
          enabled: false,
          recipients: [],
          priority: ['critical'],
          throttle: 300000 // 5 minutes
        },
        log: {
          enabled: true,
          priority: ['all']
        }
      },

      // Alert behavior configuration
      behavior: {
        enableEscalation: true,
        escalationSteps: [
          { duration: 300000, severity: 'warning' }, // 5 minutes
          { duration: 900000, severity: 'critical' } // 15 minutes
        ],
        enableThrottling: true,
        throttleWindow: 60000, // 1 minute
        enableDeduplication: true,
        deduplicationWindow: 300000, // 5 minutes
        autoAcknowledgment: false,
        autoAcknowledgmentDelay: 3600000 // 1 hour
      }
    };

    return this.deepMerge(defaultConfig, userConfig);
  }

  /**
   * Deep merge configuration objects
   */
  deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
      if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  /**
   * Initialize the alerting manager
   */
  init() {
    try {
      if (!this.config.enabled) {
        this.log('info', 'Alerting system is disabled in configuration');
        return;
      }

      this.setupDefaultAlertRules();
      this.setupNotificationChannels();
      this.loadAlertHistory();

      this.isInitialized = true;
      this.log('info', 'AlertingManager initialized successfully');

      // Start monitoring if auto-start is enabled
      if (this.config.autoStart !== false) {
        this.startMonitoring();
      }
    } catch (error) {
      this.log('error', 'Failed to initialize AlertingManager', { error: error.message });
    }
  }

  /**
   * Setup default alert rules based on configuration thresholds
   */
  setupDefaultAlertRules() {
    const thresholds = this.config.thresholds;

    // Latency alert rules
    this.addAlertRule('button-response-time', {
      name: 'High Button Response Time',
      description: 'Alert when button response time is elevated',
      metric: 'performance.button_response_time',
      condition: 'greater_than',
      threshold: thresholds.latency.buttonResponseTime,
      duration: 30, // seconds
      cooldown: 300, // seconds
      enabled: true,
      channels: ['ui', 'system', 'log']
    });

    this.addAlertRule('serial-communication-lag', {
      name: 'Serial Communication Lag',
      description: 'Alert when serial communication is slow',
      metric: 'performance.serial_communication_time',
      condition: 'greater_than',
      threshold: thresholds.latency.serialCommunication,
      duration: 15,
      cooldown: 180,
      enabled: true,
      channels: ['ui', 'log']
    });

    this.addAlertRule('action-execution-slow', {
      name: 'Slow Action Execution',
      description: 'Alert when action execution is slow',
      metric: 'performance.action_execution_time',
      condition: 'greater_than',
      threshold: thresholds.latency.actionExecution,
      duration: 10,
      cooldown: 120,
      enabled: true,
      channels: ['ui', 'log']
    });

    // Resource alert rules
    this.addAlertRule('high-memory-usage', {
      name: 'High Memory Usage',
      description: 'Alert when memory usage is high',
      metric: 'system.memory.percentage',
      condition: 'greater_than',
      threshold: thresholds.resource.memoryUsage,
      duration: 60,
      cooldown: 300,
      enabled: true,
      channels: ['ui', 'system', 'log']
    });

    this.addAlertRule('high-cpu-usage', {
      name: 'High CPU Usage',
      description: 'Alert when CPU usage is high',
      metric: 'system.cpu.percentage',
      condition: 'greater_than',
      threshold: thresholds.resource.cpuUsage,
      duration: 120,
      cooldown: 300,
      enabled: true,
      channels: ['ui', 'log']
    });

    // Hardware alert rules
    this.addAlertRule('serial-connection-loss', {
      name: 'Serial Connection Loss',
      description: 'Alert when serial connection is lost',
      metric: 'hardware.serial_disconnections_per_hour',
      condition: 'greater_than',
      threshold: thresholds.hardware.serialConnectionLoss,
      duration: 0, // immediate
      cooldown: 600,
      enabled: true,
      channels: ['ui', 'system', 'log']
    });

    this.addAlertRule('button-missed-events', {
      name: 'Button Missed Events',
      description: 'Alert when button events are missed',
      metric: 'hardware.button_missed_events_per_minute',
      condition: 'greater_than',
      threshold: thresholds.hardware.buttonMissedEvents,
      duration: 60,
      cooldown: 300,
      enabled: true,
      channels: ['ui', 'log']
    });

    // Application alert rules
    this.addAlertRule('high-error-rate', {
      name: 'High Error Rate',
      description: 'Alert when application error rate is high',
      metric: 'application.errors_per_minute',
      condition: 'greater_than',
      threshold: thresholds.application.errorRate,
      duration: 120,
      cooldown: 600,
      enabled: true,
      channels: ['ui', 'system', 'log']
    });

    this.addAlertRule('config-corruption', {
      name: 'Configuration Corruption',
      description: 'Alert when configuration file is corrupted',
      metric: 'application.config_corruption',
      condition: 'greater_than',
      threshold: thresholds.application.configCorruption,
      duration: 0,
      cooldown: 0,
      enabled: true,
      channels: ['ui', 'system', 'log']
    });
  }

  /**
   * Setup notification channels
   */
  setupNotificationChannels() {
    // UI notification channel
    if (this.config.notifications.ui.enabled) {
      this.notificationChannels.set('ui', {
        type: 'ui',
        enabled: true,
        priority: this.config.notifications.ui.priority,
        deliver: this.deliverUINotification.bind(this)
      });
    }

    // System notification channel
    if (this.config.notifications.system.enabled) {
      this.notificationChannels.set('system', {
        type: 'system',
        enabled: true,
        priority: this.config.notifications.system.priority,
        deliver: this.deliverSystemNotification.bind(this)
      });
    }

    // Email notification channel (if configured)
    if (
      this.config.notifications.email.enabled &&
      this.config.notifications.email.recipients.length > 0
    ) {
      this.notificationChannels.set('email', {
        type: 'email',
        enabled: true,
        priority: this.config.notifications.email.priority,
        throttle: this.config.notifications.email.throttle,
        lastSent: new Map(),
        deliver: this.deliverEmailNotification.bind(this)
      });
    }

    // Log notification channel
    if (this.config.notifications.log.enabled) {
      this.notificationChannels.set('log', {
        type: 'log',
        enabled: true,
        priority: this.config.notifications.log.priority,
        deliver: this.deliverLogNotification.bind(this)
      });
    }
  }

  /**
   * Setup notification templates
   */
  setupNotificationTemplates() {
    return {
      critical: {
        title: 'CRITICAL: {{metric_name}} Alert',
        message:
          '{{metric_name}} has reached {{value}} (threshold: {{threshold}}). Immediate attention required.',
        color: '#FF0000',
        sound: 'critical_alert.wav',
        icon: 'error'
      },
      warning: {
        title: 'Warning: {{metric_name}} Alert',
        message: '{{metric_name}} is {{value}} (threshold: {{threshold}}). Please investigate.',
        color: '#FFA500',
        sound: 'warning_alert.wav',
        icon: 'warning'
      },
      info: {
        title: 'Info: {{metric_name}} Alert',
        message: '{{metric_name}} notification: {{value}}.',
        color: '#0066CC',
        sound: 'info_alert.wav',
        icon: 'info'
      },
      recovery: {
        title: 'Resolved: {{metric_name}} Alert',
        message: '{{metric_name}} has returned to normal ({{value}}). Alert resolved.',
        color: '#00FF00',
        sound: 'recovery_alert.wav',
        icon: 'success'
      }
    };
  }

  /**
   * Add an alert rule
   */
  addAlertRule(ruleId, rule) {
    const alertRule = {
      id: ruleId,
      name: rule.name,
      description: rule.description,
      metric: rule.metric,
      condition: rule.condition || 'greater_than',
      threshold: rule.threshold,
      duration: rule.duration || 0,
      cooldown: rule.cooldown || 300,
      enabled: rule.enabled !== false,
      channels: rule.channels || ['ui', 'log'],
      createdAt: Date.now(),
      updatedAt: Date.now(),

      // Runtime state
      lastTriggered: null,
      lastResolved: null,
      triggerCount: 0,
      falsePositiveCount: 0
    };

    this.alertRules.set(ruleId, alertRule);
    this.log('debug', `Added alert rule: ${rule.name}`, { ruleId });

    return ruleId;
  }

  /**
   * Remove an alert rule
   */
  removeAlertRule(ruleId) {
    const rule = this.alertRules.get(ruleId);
    if (rule) {
      this.alertRules.delete(ruleId);

      // Resolve any active alerts for this rule
      for (const [alertId, alert] of this.activeAlerts) {
        if (alert.ruleId === ruleId) {
          this.resolveAlert(alertId, 'rule_removed');
        }
      }

      this.log('debug', `Removed alert rule: ${rule.name}`, { ruleId });
      return true;
    }

    return false;
  }

  /**
   * Update an alert rule
   */
  updateAlertRule(ruleId, updates) {
    const rule = this.alertRules.get(ruleId);
    if (!rule) {
      return false;
    }

    // Update rule properties
    Object.assign(rule, updates, {
      updatedAt: Date.now()
    });

    this.log('debug', `Updated alert rule: ${rule.name}`, { ruleId, updates });
    return true;
  }

  /**
   * Start alert monitoring
   */
  startMonitoring() {
    if (!this.isInitialized || this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.lastAlertCheck = Date.now();

    // Start alert checking interval
    this.alertCheckInterval = setInterval(() => {
      this.checkAlerts();
    }, this.config.checkInterval);

    // Start escalation checking interval
    if (this.config.behavior.enableEscalation) {
      this.escalationCheckInterval = setInterval(() => {
        this.checkEscalations();
      }, this.config.escalationInterval);
    }

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldAlerts();
    }, this.config.cleanupInterval);

    this.log('info', 'Alert monitoring started');
    this.emit('monitoring-started');
  }

  /**
   * Stop alert monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    // Clear intervals
    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval);
      this.alertCheckInterval = null;
    }

    if (this.escalationCheckInterval) {
      clearInterval(this.escalationCheckInterval);
      this.escalationCheckInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.log('info', 'Alert monitoring stopped');
    this.emit('monitoring-stopped');
  }

  /**
   * Process performance metrics and check for alert conditions
   */
  processMetrics(metrics) {
    if (!this.isMonitoring) {
      return;
    }

    try {
      // Check each active alert rule
      for (const [ruleId, rule] of this.alertRules) {
        if (!rule.enabled) {
          continue;
        }

        const metricValue = this.extractMetricValue(metrics, rule.metric);
        if (metricValue !== null && metricValue !== undefined) {
          this.evaluateRule(rule, metricValue);
        }
      }
    } catch (error) {
      this.log('error', 'Failed to process metrics for alerts', { error: error.message });
    }
  }

  /**
   * Extract metric value from metrics object using dot notation
   */
  extractMetricValue(metrics, metricPath) {
    const parts = metricPath.split('.');
    let value = metrics;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return null;
      }
    }

    return value;
  }

  /**
   * Evaluate an alert rule against a metric value
   */
  evaluateRule(rule, value) {
    const shouldTrigger = this.evaluateCondition(rule.condition, value, rule.threshold);
    const alertId = `${rule.id}_${Date.now()}`;
    const existingAlert = this.findActiveAlertByRule(rule.id);

    if (shouldTrigger) {
      if (!existingAlert) {
        // New alert condition
        this.triggerAlert(alertId, rule, value);
      } else {
        // Update existing alert
        existingAlert.lastUpdate = Date.now();
        existingAlert.currentValue = value;
      }
    } else if (existingAlert) {
      // Alert condition resolved
      this.resolveAlert(existingAlert.id, 'condition_resolved');
    }
  }

  /**
   * Evaluate condition (greater_than, less_than, equals, etc.)
   */
  evaluateCondition(condition, value, threshold) {
    switch (condition) {
      case 'greater_than':
        if (typeof threshold === 'object') {
          return value > threshold.warning || value > threshold.critical;
        }
        return value > threshold;

      case 'less_than':
        if (typeof threshold === 'object') {
          return value < threshold.warning || value < threshold.critical;
        }
        return value < threshold;

      case 'equals':
        return value === threshold;

      case 'not_equals':
        return value !== threshold;

      case 'contains':
        return typeof value === 'string' && value.includes(threshold);

      default:
        return false;
    }
  }

  /**
   * Determine alert severity based on threshold
   */
  determineAlertSeverity(value, threshold) {
    if (typeof threshold === 'object') {
      if (threshold.critical && value >= threshold.critical) {
        return 'critical';
      } else if (threshold.warning && value >= threshold.warning) {
        return 'warning';
      }
    }

    return 'info';
  }

  /**
   * Find active alert by rule ID
   */
  findActiveAlertByRule(ruleId) {
    for (const alert of this.activeAlerts.values()) {
      if (alert.ruleId === ruleId) {
        return alert;
      }
    }
    return null;
  }

  /**
   * Trigger a new alert
   */
  triggerAlert(alertId, rule, value) {
    // Check cooldown period
    if (rule.lastTriggered && Date.now() - rule.lastTriggered < rule.cooldown * 1000) {
      return;
    }

    const severity = this.determineAlertSeverity(value, rule.threshold);

    const alert = {
      id: alertId,
      ruleId: rule.id,
      ruleName: rule.name,
      description: rule.description,
      metric: rule.metric,
      severity,
      currentValue: value,
      threshold: rule.threshold,
      condition: rule.condition,
      triggeredAt: Date.now(),
      lastUpdate: Date.now(),
      acknowledgedAt: null,
      acknowledgedBy: null,
      resolvedAt: null,
      resolutionReason: null,
      escalatedAt: null,
      escalationLevel: 0,
      channels: rule.channels,
      status: 'active'
    };

    // Store active alert
    this.activeAlerts.set(alertId, alert);

    // Update rule statistics
    rule.lastTriggered = Date.now();
    rule.triggerCount++;

    // Update global statistics
    this.alertStats.totalAlerts++;
    if (severity === 'critical') {
      this.alertStats.criticalAlerts++;
    } else if (severity === 'warning') {
      this.alertStats.warningAlerts++;
    } else {
      this.alertStats.infoAlerts++;
    }

    // Add to history
    this.addToHistory(alert);

    // Send notifications
    this.sendNotifications(alert);

    // Emit alert event
    this.emit('alert-triggered', alert);

    this.log('warn', `Alert triggered: ${rule.name}`, {
      alertId,
      severity,
      value,
      threshold: rule.threshold
    });
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId, reason = 'manual') {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      return false;
    }

    // Update alert status
    alert.status = 'resolved';
    alert.resolvedAt = Date.now();
    alert.resolutionReason = reason;

    // Calculate resolution time
    const resolutionTime = alert.resolvedAt - alert.triggeredAt;
    this.updateAverageResolutionTime(resolutionTime);

    // Remove from active alerts
    this.activeAlerts.delete(alertId);

    // Update history
    this.updateAlertInHistory(alert);

    // Send recovery notification
    this.sendRecoveryNotification(alert);

    // Emit resolution event
    this.emit('alert-resolved', alert);

    this.log('info', `Alert resolved: ${alert.ruleName}`, {
      alertId,
      reason,
      resolutionTime: `${resolutionTime}ms`
    });

    return true;
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId, userId = 'system') {
    const alert = this.activeAlerts.get(alertId);
    if (!alert || alert.acknowledgedAt) {
      return false;
    }

    alert.acknowledgedAt = Date.now();
    alert.acknowledgedBy = userId;

    // Update statistics
    this.alertStats.acknowledgedAlerts++;

    // Update history
    this.updateAlertInHistory(alert);

    // Emit acknowledgment event
    this.emit('alert-acknowledged', alert);

    this.log('info', `Alert acknowledged: ${alert.ruleName}`, {
      alertId,
      acknowledgedBy: userId
    });

    return true;
  }

  /**
   * Send notifications for an alert
   */
  async sendNotifications(alert) {
    const notifications = [];

    // Send to configured channels
    for (const channelName of alert.channels) {
      const channel = this.notificationChannels.get(channelName);
      if (channel && channel.enabled && this.shouldSendToChannel(alert, channel)) {
        try {
          await channel.deliver(alert);
          notifications.push({ channel: channelName, status: 'sent' });
        } catch (error) {
          this.log('error', `Failed to send notification to ${channelName}`, {
            alertId: alert.id,
            error: error.message
          });
          notifications.push({ channel: channelName, status: 'failed', error: error.message });
        }
      }
    }

    return notifications;
  }

  /**
   * Check if alert should be sent to specific channel based on priority
   */
  shouldSendToChannel(alert, channel) {
    if (channel.priority.includes('all')) {
      return true;
    }

    return channel.priority.includes(alert.severity);
  }

  /**
   * Deliver UI notification
   */
  async deliverUINotification(alert) {
    const template = this.notificationTemplates[alert.severity];
    const notification = {
      id: alert.id,
      type: 'alert',
      severity: alert.severity,
      title: this.formatTemplate(template.title, alert),
      message: this.formatTemplate(template.message, alert),
      color: template.color,
      icon: template.icon,
      timestamp: Date.now(),
      actions: [
        { label: 'Acknowledge', action: 'acknowledge' },
        { label: 'View Details', action: 'details' }
      ]
    };

    // Emit to UI
    this.emit('ui-notification', notification);
  }

  /**
   * Deliver system notification
   */
  async deliverSystemNotification(alert) {
    const template = this.notificationTemplates[alert.severity];

    // Use Electron's notification API if available
    if (typeof window !== 'undefined' && window.electronAPI) {
      await window.electronAPI.showNotification({
        title: this.formatTemplate(template.title, alert),
        body: this.formatTemplate(template.message, alert),
        icon: template.icon,
        urgency: alert.severity === 'critical' ? 'critical' : 'normal'
      });
    }
  }

  /**
   * Deliver email notification (placeholder - would need SMTP configuration)
   */
  async deliverEmailNotification(alert) {
    const template = this.notificationTemplates[alert.severity];
    const channel = this.notificationChannels.get('email');

    // Check throttling
    const lastSent = channel.lastSent.get(alert.ruleId);
    if (lastSent && Date.now() - lastSent < channel.throttle) {
      return; // Skip due to throttling
    }

    // Mark as sent (would actually send email here)
    channel.lastSent.set(alert.ruleId, Date.now());

    this.log('info', `Email notification would be sent for alert: ${alert.ruleName}`, {
      recipients: this.config.notifications.email.recipients,
      subject: this.formatTemplate(template.title, alert)
    });
  }

  /**
   * Deliver log notification
   */
  async deliverLogNotification(alert) {
    const template = this.notificationTemplates[alert.severity];

    this.log(
      alert.severity === 'critical' ? 'error' : 'warn',
      this.formatTemplate(template.message, alert),
      {
        alertId: alert.id,
        ruleId: alert.ruleId,
        metric: alert.metric,
        value: alert.currentValue,
        threshold: alert.threshold
      }
    );
  }

  /**
   * Send recovery notification
   */
  async sendRecoveryNotification(alert) {
    const template = this.notificationTemplates.recovery;
    const recoveryAlert = {
      ...alert,
      severity: 'recovery'
    };

    // Send to same channels as original alert
    for (const channelName of alert.channels) {
      const channel = this.notificationChannels.get(channelName);
      if (channel && channel.enabled) {
        try {
          if (channelName === 'ui') {
            this.emit('ui-notification', {
              id: `${alert.id}_recovery`,
              type: 'recovery',
              severity: 'recovery',
              title: this.formatTemplate(template.title, alert),
              message: this.formatTemplate(template.message, alert),
              color: template.color,
              icon: template.icon,
              timestamp: Date.now()
            });
          } else if (channelName === 'log') {
            this.log('info', this.formatTemplate(template.message, alert), {
              alertId: alert.id,
              resolutionTime: alert.resolvedAt - alert.triggeredAt
            });
          }
        } catch (error) {
          this.log('error', `Failed to send recovery notification to ${channelName}`, {
            alertId: alert.id,
            error: error.message
          });
        }
      }
    }
  }

  /**
   * Format notification template with alert data
   */
  formatTemplate(template, alert) {
    return template
      .replace(/\{\{metric_name\}\}/g, alert.ruleName)
      .replace(/\{\{value\}\}/g, alert.currentValue)
      .replace(/\{\{threshold\}\}/g, JSON.stringify(alert.threshold))
      .replace(/\{\{description\}\}/g, alert.description);
  }

  /**
   * Check for alert escalations
   */
  checkEscalations() {
    if (!this.config.behavior.enableEscalation) {
      return;
    }

    const now = Date.now();
    const escalationSteps = this.config.behavior.escalationSteps;

    for (const alert of this.activeAlerts.values()) {
      if (alert.acknowledgedAt) {
        continue; // Don't escalate acknowledged alerts
      }

      const alertAge = now - alert.triggeredAt;

      for (let i = alert.escalationLevel; i < escalationSteps.length; i++) {
        const step = escalationSteps[i];

        if (alertAge >= step.duration) {
          this.escalateAlert(alert, i + 1, step.severity);
          break;
        }
      }
    }
  }

  /**
   * Escalate an alert
   */
  escalateAlert(alert, level, severity) {
    alert.escalationLevel = level;
    alert.escalatedAt = Date.now();
    alert.severity = severity; // Update severity

    // Send escalated notification
    this.sendNotifications(alert);

    // Emit escalation event
    this.emit('alert-escalated', alert);

    this.log('warn', `Alert escalated to level ${level}: ${alert.ruleName}`, {
      alertId: alert.id,
      newSeverity: severity
    });
  }

  /**
   * Check alerts manually (called by monitoring intervals)
   */
  checkAlerts() {
    // This method is called by the monitoring interval
    // Actual alert checking is done in processMetrics()
    this.lastAlertCheck = Date.now();

    // Auto-acknowledge old alerts if configured
    if (this.config.behavior.autoAcknowledgment) {
      this.autoAcknowledgeOldAlerts();
    }
  }

  /**
   * Auto-acknowledge old alerts
   */
  autoAcknowledgeOldAlerts() {
    const cutoff = Date.now() - this.config.behavior.autoAcknowledgmentDelay;

    for (const alert of this.activeAlerts.values()) {
      if (!alert.acknowledgedAt && alert.triggeredAt < cutoff) {
        this.acknowledgeAlert(alert.id, 'auto-system');
      }
    }
  }

  /**
   * Clean up old alerts from history
   */
  cleanupOldAlerts() {
    const cutoff = Date.now() - this.config.retentionPeriod;

    // Clean up alert history
    this.alertHistory = this.alertHistory.filter(alert => alert.triggeredAt > cutoff);

    // Enforce maximum history size
    if (this.alertHistory.length > this.config.maxAlertHistory) {
      this.alertHistory = this.alertHistory.slice(-this.config.maxAlertHistory);
    }

    this.log('debug', `Cleaned up old alerts. History size: ${this.alertHistory.length}`);
  }

  /**
   * Add alert to history
   */
  addToHistory(alert) {
    this.alertHistory.push({ ...alert });

    // Enforce size limit
    if (this.alertHistory.length > this.config.maxAlertHistory) {
      this.alertHistory.shift();
    }
  }

  /**
   * Update alert in history
   */
  updateAlertInHistory(alert) {
    const index = this.alertHistory.findIndex(h => h.id === alert.id);
    if (index !== -1) {
      this.alertHistory[index] = { ...alert };
    }
  }

  /**
   * Update average resolution time
   */
  updateAverageResolutionTime(resolutionTime) {
    const resolvedCount = this.alertStats.totalAlerts - this.activeAlerts.size;
    if (resolvedCount > 0) {
      this.alertStats.averageResolutionTime =
        (this.alertStats.averageResolutionTime * (resolvedCount - 1) + resolutionTime) /
        resolvedCount;
    } else {
      this.alertStats.averageResolutionTime = resolutionTime;
    }
  }

  /**
   * Load alert history from storage (placeholder)
   */
  loadAlertHistory() {
    // This would load from persistent storage
    // For now, just initialize empty
    this.alertHistory = [];
  }

  /**
   * Save alert history to storage (placeholder)
   */
  saveAlertHistory() {
    // This would save to persistent storage
    this.log('debug', `Alert history would be saved. Size: ${this.alertHistory.length}`);
  }

  /**
   * Get current alert statistics
   */
  getAlertStatistics() {
    return {
      ...this.alertStats,
      activeAlerts: this.activeAlerts.size,
      totalRules: this.alertRules.size,
      enabledRules: Array.from(this.alertRules.values()).filter(r => r.enabled).length
    };
  }

  /**
   * Get active alerts
   */
  getActiveAlerts() {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit = 100) {
    return this.alertHistory.slice(-limit);
  }

  /**
   * Get alert rules
   */
  getAlertRules() {
    return Array.from(this.alertRules.values());
  }

  /**
   * Log messages using LogManager if available, otherwise console
   */
  log(level, message, data = {}) {
    if (this.logManager && this.logManager.logWithComponent) {
      this.logManager.logWithComponent('AlertingManager', level, message, data);
    } else if (this.logManager && this.logManager.getLogger) {
      const logger = this.logManager.getLogger();
      logger[level](message, data);
    } else {
      console[level](`[AlertingManager] ${message}`, data);
    }
  }

  /**
   * Test alert system
   */
  testAlert(severity = 'warning') {
    const testAlert = {
      id: `test_${Date.now()}`,
      ruleId: 'test-rule',
      ruleName: 'Test Alert Rule',
      description: 'This is a test alert to verify the alerting system',
      metric: 'test.metric',
      severity,
      currentValue: 100,
      threshold: { warning: 50, critical: 90 },
      condition: 'greater_than',
      triggeredAt: Date.now(),
      lastUpdate: Date.now(),
      acknowledgedAt: null,
      acknowledgedBy: null,
      resolvedAt: null,
      resolutionReason: null,
      escalatedAt: null,
      escalationLevel: 0,
      channels: ['ui', 'log'],
      status: 'active'
    };

    this.sendNotifications(testAlert);
    this.emit('alert-triggered', testAlert);

    this.log('info', 'Test alert triggered', { severity });

    // Auto-resolve after 5 seconds
    setTimeout(() => {
      testAlert.status = 'resolved';
      testAlert.resolvedAt = Date.now();
      testAlert.resolutionReason = 'test_completed';

      this.sendRecoveryNotification(testAlert);
      this.emit('alert-resolved', testAlert);

      this.log('info', 'Test alert resolved');
    }, 5000);

    return testAlert;
  }

  /**
   * Clean up resources and stop monitoring
   */
  cleanup() {
    this.stopMonitoring();

    // Save alert history before cleanup
    this.saveAlertHistory();

    // Clear all data
    this.activeAlerts.clear();
    this.alertRules.clear();
    this.alertHistory = [];
    this.notificationChannels.clear();

    // Remove all event listeners
    this.removeAllListeners();

    this.isInitialized = false;
    this.log('info', 'AlertingManager cleaned up');
  }

  /**
   * Check if the alerting manager is ready
   */
  isReady() {
    return this.isInitialized;
  }

  /**
   * Check if monitoring is active
   */
  isActive() {
    return this.isMonitoring;
  }

  /**
   * Update configuration
   */
  updateConfiguration(newConfig) {
    this.config = this.mergeConfig(newConfig);

    // Restart monitoring if configuration changes require it
    if (this.isMonitoring) {
      this.stopMonitoring();
      setTimeout(() => this.startMonitoring(), 100);
    }

    this.log('info', 'AlertingManager configuration updated');
  }
}

module.exports = AlertingManager;
