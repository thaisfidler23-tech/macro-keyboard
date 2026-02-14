const EventEmitter = require('events');
const { app, Notification, shell } = require('electron');
const os = require('os');
const nodemailer = require('nodemailer').catch(() => null); // Optional dependency

/**
 * NotificationChannels - Multi-channel notification delivery system
 *
 * Features:
 * - UI notifications with toast messages
 * - System notifications (native OS notifications)
 * - Email notifications (with SMTP configuration)
 * - Log-based notifications
 * - Webhook notifications for integrations
 * - Notification throttling and deduplication
 */
class NotificationChannels extends EventEmitter {
  constructor(config = {}, logManager = null) {
    super();

    this.config = this.mergeConfig(config);
    this.logManager = logManager;
    this.isInitialized = false;

    // Channel implementations
    this.channels = new Map();

    // Throttling and deduplication
    this.throttleCache = new Map();
    this.deduplicationCache = new Map();

    // Statistics
    this.stats = {
      totalNotifications: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      throttledNotifications: 0,
      deduplicatedNotifications: 0,
      channelStats: {}
    };

    this.init();
  }

  /**
   * Merge default configuration with user config
   */
  mergeConfig(userConfig) {
    const defaultConfig = {
      // UI Notifications
      ui: {
        enabled: true,
        position: 'top-right',
        autoHide: true,
        hideDelay: 5000,
        maxVisible: 5,
        enableActions: true,
        enableSound: true
      },

      // System Notifications
      system: {
        enabled: true,
        appName: 'Macro Keyboard',
        silent: false,
        urgency: 'normal', // low, normal, critical
        icon: null,
        timeoutType: 'default'
      },

      // Email Notifications
      email: {
        enabled: false,
        smtp: {
          host: null,
          port: 587,
          secure: false,
          auth: {
            user: null,
            pass: null
          }
        },
        from: null,
        to: [],
        subject: 'Macro Keyboard Alert: {{severity}} - {{title}}',
        template: 'default'
      },

      // Log Notifications
      log: {
        enabled: true,
        includeContext: true,
        structuredFormat: false
      },

      // Webhook Notifications
      webhook: {
        enabled: false,
        endpoints: [],
        timeout: 5000,
        retries: 3,
        format: 'json' // json, slack, discord, teams
      },

      // Throttling Configuration
      throttling: {
        enabled: true,
        window: 60000, // 1 minute
        maxPerWindow: 10,
        perRuleLimit: 3
      },

      // Deduplication Configuration
      deduplication: {
        enabled: true,
        window: 300000, // 5 minutes
        keyFields: ['ruleId', 'severity']
      }
    };

    return { ...defaultConfig, ...userConfig };
  }

  /**
   * Initialize notification channels
   */
  init() {
    try {
      this.setupChannels();
      this.isInitialized = true;

      this.log('info', 'NotificationChannels initialized successfully');
    } catch (error) {
      this.log('error', 'Failed to initialize NotificationChannels', { error: error.message });
    }
  }

  /**
   * Setup all notification channels
   */
  setupChannels() {
    // UI Channel
    if (this.config.ui.enabled) {
      this.channels.set('ui', {
        name: 'UI Notifications',
        enabled: true,
        deliver: this.deliverUINotification.bind(this),
        test: this.testUINotification.bind(this)
      });
    }

    // System Channel
    if (this.config.system.enabled) {
      this.channels.set('system', {
        name: 'System Notifications',
        enabled: true,
        deliver: this.deliverSystemNotification.bind(this),
        test: this.testSystemNotification.bind(this)
      });
    }

    // Email Channel
    if (this.config.email.enabled && this.isEmailConfigured()) {
      this.channels.set('email', {
        name: 'Email Notifications',
        enabled: true,
        deliver: this.deliverEmailNotification.bind(this),
        test: this.testEmailNotification.bind(this)
      });
    }

    // Log Channel
    if (this.config.log.enabled) {
      this.channels.set('log', {
        name: 'Log Notifications',
        enabled: true,
        deliver: this.deliverLogNotification.bind(this),
        test: this.testLogNotification.bind(this)
      });
    }

    // Webhook Channel
    if (this.config.webhook.enabled && this.config.webhook.endpoints.length > 0) {
      this.channels.set('webhook', {
        name: 'Webhook Notifications',
        enabled: true,
        deliver: this.deliverWebhookNotification.bind(this),
        test: this.testWebhookNotification.bind(this)
      });
    }

    // Initialize channel statistics
    for (const [channelName] of this.channels) {
      this.stats.channelStats[channelName] = {
        sent: 0,
        failed: 0,
        throttled: 0,
        deduplicated: 0
      };
    }
  }

  /**
   * Check if email is properly configured
   */
  isEmailConfigured() {
    const email = this.config.email;
    return (
      email.smtp.host &&
      email.smtp.auth.user &&
      email.smtp.auth.pass &&
      email.from &&
      email.to.length > 0
    );
  }

  /**
   * Send notification to specified channels
   */
  async sendNotification(notification, channels = ['ui', 'log']) {
    if (!this.isInitialized) {
      throw new Error('NotificationChannels not initialized');
    }

    // Check deduplication
    if (this.config.deduplication.enabled && this.isDuplicate(notification)) {
      this.stats.deduplicatedNotifications++;
      this.log('debug', 'Notification deduplicated', {
        id: notification.id,
        title: notification.title
      });
      return { status: 'deduplicated' };
    }

    // Check throttling
    if (this.config.throttling.enabled && this.isThrottled(notification)) {
      this.stats.throttledNotifications++;
      this.log('debug', 'Notification throttled', {
        id: notification.id,
        title: notification.title
      });
      return { status: 'throttled' };
    }

    const results = [];
    this.stats.totalNotifications++;

    // Send to each requested channel
    for (const channelName of channels) {
      const channel = this.channels.get(channelName);

      if (!channel) {
        results.push({
          channel: channelName,
          status: 'not_configured',
          error: `Channel ${channelName} is not configured`
        });
        continue;
      }

      if (!channel.enabled) {
        results.push({
          channel: channelName,
          status: 'disabled',
          error: `Channel ${channelName} is disabled`
        });
        continue;
      }

      try {
        await channel.deliver(notification);

        results.push({
          channel: channelName,
          status: 'success',
          sentAt: Date.now()
        });

        this.stats.successfulDeliveries++;
        this.stats.channelStats[channelName].sent++;
      } catch (error) {
        results.push({
          channel: channelName,
          status: 'failed',
          error: error.message,
          failedAt: Date.now()
        });

        this.stats.failedDeliveries++;
        this.stats.channelStats[channelName].failed++;

        this.log('error', `Failed to deliver notification to ${channelName}`, {
          id: notification.id,
          error: error.message
        });
      }
    }

    // Update caches
    this.updateThrottleCache(notification);
    this.updateDeduplicationCache(notification);

    return { status: 'sent', results };
  }

  /**
   * Check if notification is a duplicate
   */
  isDuplicate(notification) {
    const key = this.generateDeduplicationKey(notification);
    const cached = this.deduplicationCache.get(key);

    if (!cached) {
      return false;
    }

    const age = Date.now() - cached.timestamp;
    return age < this.config.deduplication.window;
  }

  /**
   * Generate deduplication key
   */
  generateDeduplicationKey(notification) {
    const fields = this.config.deduplication.keyFields;
    const keyParts = fields.map(field => notification[field] || '').join('|');
    return `dedup:${keyParts}`;
  }

  /**
   * Check if notification is throttled
   */
  isThrottled(notification) {
    const now = Date.now();
    const windowStart = now - this.config.throttling.window;

    // Global throttling
    const globalKey = 'global';
    const globalCache = this.throttleCache.get(globalKey) || [];
    const recentGlobal = globalCache.filter(timestamp => timestamp > windowStart);

    if (recentGlobal.length >= this.config.throttling.maxPerWindow) {
      return true;
    }

    // Per-rule throttling
    if (notification.ruleId) {
      const ruleKey = `rule:${notification.ruleId}`;
      const ruleCache = this.throttleCache.get(ruleKey) || [];
      const recentRule = ruleCache.filter(timestamp => timestamp > windowStart);

      if (recentRule.length >= this.config.throttling.perRuleLimit) {
        return true;
      }
    }

    return false;
  }

  /**
   * Update throttle cache
   */
  updateThrottleCache(notification) {
    const now = Date.now();
    const windowStart = now - this.config.throttling.window;

    // Update global throttling
    const globalKey = 'global';
    let globalCache = this.throttleCache.get(globalKey) || [];
    globalCache.push(now);
    globalCache = globalCache.filter(timestamp => timestamp > windowStart);
    this.throttleCache.set(globalKey, globalCache);

    // Update per-rule throttling
    if (notification.ruleId) {
      const ruleKey = `rule:${notification.ruleId}`;
      let ruleCache = this.throttleCache.get(ruleKey) || [];
      ruleCache.push(now);
      ruleCache = ruleCache.filter(timestamp => timestamp > windowStart);
      this.throttleCache.set(ruleKey, ruleCache);
    }
  }

  /**
   * Update deduplication cache
   */
  updateDeduplicationCache(notification) {
    const key = this.generateDeduplicationKey(notification);
    this.deduplicationCache.set(key, {
      timestamp: Date.now(),
      notification: { ...notification }
    });

    // Clean up old entries
    const cutoff = Date.now() - this.config.deduplication.window;
    for (const [cacheKey, entry] of this.deduplicationCache.entries()) {
      if (entry.timestamp < cutoff) {
        this.deduplicationCache.delete(cacheKey);
      }
    }
  }

  /**
   * Deliver UI notification
   */
  async deliverUINotification(notification) {
    const uiNotification = {
      id: notification.id,
      type: 'alert',
      severity: notification.severity,
      title: notification.title,
      message: notification.message,
      timestamp: Date.now(),
      autoHide: this.config.ui.autoHide,
      hideDelay: this.config.ui.hideDelay,
      position: this.config.ui.position,
      color: this.getSeverityColor(notification.severity),
      icon: this.getSeverityIcon(notification.severity)
    };

    // Add actions if enabled
    if (this.config.ui.enableActions) {
      uiNotification.actions = [
        { id: 'acknowledge', label: 'Acknowledge', primary: true },
        { id: 'details', label: 'View Details', secondary: true },
        { id: 'dismiss', label: 'Dismiss', secondary: true }
      ];
    }

    // Play sound if enabled
    if (this.config.ui.enableSound && notification.severity === 'critical') {
      uiNotification.sound = this.getSeveritySound(notification.severity);
    }

    // Emit to renderer process
    this.emit('ui-notification', uiNotification);

    this.log('debug', 'UI notification sent', { id: notification.id });
  }

  /**
   * Deliver system notification
   */
  async deliverSystemNotification(notification) {
    // Check if notifications are supported and allowed
    if (!Notification.isSupported()) {
      throw new Error('System notifications are not supported');
    }

    const options = {
      title: notification.title,
      body: notification.message,
      icon: this.config.system.icon || this.getDefaultIcon(),
      silent: this.config.system.silent,
      urgency: this.mapSeverityToUrgency(notification.severity),
      timeoutType: this.config.system.timeoutType,
      actions: []
    };

    // Add actions for supported platforms
    if (process.platform === 'win32' || process.platform === 'darwin') {
      options.actions = [
        { type: 'button', text: 'Acknowledge' },
        { type: 'button', text: 'View Details' }
      ];
    }

    const systemNotification = new Notification(options);

    // Handle notification events
    systemNotification.on('click', () => {
      this.emit('notification-clicked', { id: notification.id, action: 'click' });
    });

    systemNotification.on('action', (event, index) => {
      const actions = ['acknowledge', 'details'];
      this.emit('notification-action', {
        id: notification.id,
        action: actions[index] || 'unknown'
      });
    });

    systemNotification.on('close', () => {
      this.emit('notification-closed', { id: notification.id });
    });

    systemNotification.show();

    this.log('debug', 'System notification sent', { id: notification.id });
  }

  /**
   * Deliver email notification
   */
  async deliverEmailNotification(notification) {
    if (!nodemailer) {
      throw new Error('nodemailer is not available for email notifications');
    }

    // Create SMTP transporter
    const transporter = nodemailer.createTransporter({
      host: this.config.email.smtp.host,
      port: this.config.email.smtp.port,
      secure: this.config.email.smtp.secure,
      auth: this.config.email.smtp.auth
    });

    // Format subject
    const subject = this.formatEmailTemplate(this.config.email.subject, notification);

    // Create email content
    const emailContent = this.generateEmailContent(notification);

    const mailOptions = {
      from: this.config.email.from,
      to: this.config.email.to.join(', '),
      subject,
      html: emailContent.html,
      text: emailContent.text,
      priority: notification.severity === 'critical' ? 'high' : 'normal'
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);

    this.log('debug', 'Email notification sent', {
      id: notification.id,
      messageId: info.messageId,
      recipients: this.config.email.to.length
    });

    return info;
  }

  /**
   * Deliver log notification
   */
  async deliverLogNotification(notification) {
    const logData = {
      notificationId: notification.id,
      severity: notification.severity,
      title: notification.title,
      message: notification.message,
      timestamp: new Date().toISOString()
    };

    // Add context if enabled
    if (this.config.log.includeContext && notification.context) {
      logData.context = notification.context;
    }

    // Use structured format if enabled
    if (this.config.log.structuredFormat) {
      this.log('info', 'Alert notification', logData);
    } else {
      const logMessage = `[${notification.severity.toUpperCase()}] ${notification.title}: ${notification.message}`;
      this.log(this.mapSeverityToLogLevel(notification.severity), logMessage, logData);
    }
  }

  /**
   * Deliver webhook notification
   */
  async deliverWebhookNotification(notification) {
    const webhookPayload = this.formatWebhookPayload(notification);
    const promises = [];

    for (const endpoint of this.config.webhook.endpoints) {
      promises.push(this.sendWebhook(endpoint, webhookPayload));
    }

    const results = await Promise.allSettled(promises);

    // Check for failures
    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      throw new Error(
        `${failures.length} webhook(s) failed: ${failures.map(f => f.reason.message).join(', ')}`
      );
    }

    this.log('debug', 'Webhook notification sent', {
      id: notification.id,
      endpoints: this.config.webhook.endpoints.length
    });
  }

  /**
   * Send webhook to endpoint
   */
  async sendWebhook(endpoint, payload) {
    const fetch = require('node-fetch').catch(() => {
      throw new Error('node-fetch is required for webhook notifications');
    });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'macro-keyboard-alerts/1.0'
      },
      body: JSON.stringify(payload),
      timeout: this.config.webhook.timeout
    };

    // Add authentication headers if configured
    if (endpoint.headers) {
      Object.assign(options.headers, endpoint.headers);
    }

    let attempt = 0;
    let lastError;

    // Retry logic
    while (attempt < this.config.webhook.retries) {
      try {
        const response = await fetch(endpoint.url, options);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json().catch(() => ({}));
      } catch (error) {
        lastError = error;
        attempt++;

        if (attempt < this.config.webhook.retries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Format webhook payload
   */
  formatWebhookPayload(notification) {
    const basePayload = {
      id: notification.id,
      timestamp: new Date().toISOString(),
      severity: notification.severity,
      title: notification.title,
      message: notification.message,
      source: 'macro-keyboard',
      hostname: os.hostname()
    };

    // Add context if available
    if (notification.context) {
      basePayload.context = notification.context;
    }

    // Format for specific webhook types
    switch (this.config.webhook.format) {
      case 'slack':
        return this.formatSlackPayload(basePayload);
      case 'discord':
        return this.formatDiscordPayload(basePayload);
      case 'teams':
        return this.formatTeamsPayload(basePayload);
      default:
        return basePayload;
    }
  }

  /**
   * Format Slack webhook payload
   */
  formatSlackPayload(payload) {
    const color = this.getSeverityColor(payload.severity);

    return {
      attachments: [
        {
          color,
          title: payload.title,
          text: payload.message,
          fields: [
            {
              title: 'Severity',
              value: payload.severity.toUpperCase(),
              short: true
            },
            {
              title: 'Source',
              value: payload.source,
              short: true
            },
            {
              title: 'Host',
              value: payload.hostname,
              short: true
            },
            {
              title: 'Time',
              value: payload.timestamp,
              short: true
            }
          ],
          footer: 'Macro Keyboard Alerts',
          ts: Math.floor(Date.now() / 1000)
        }
      ]
    };
  }

  /**
   * Format Discord webhook payload
   */
  formatDiscordPayload(payload) {
    const color = parseInt(this.getSeverityColor(payload.severity, 10).replace('#', ''), 16);

    return {
      embeds: [
        {
          title: payload.title,
          description: payload.message,
          color,
          fields: [
            {
              name: 'Severity',
              value: payload.severity.toUpperCase(),
              inline: true
            },
            {
              name: 'Host',
              value: payload.hostname,
              inline: true
            }
          ],
          timestamp: payload.timestamp,
          footer: {
            text: 'Macro Keyboard Alerts'
          }
        }
      ]
    };
  }

  /**
   * Format Microsoft Teams webhook payload
   */
  formatTeamsPayload(payload) {
    const color = this.getSeverityColor(payload.severity);

    return {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: color.replace('#', ''),
      summary: payload.title,
      sections: [
        {
          activityTitle: payload.title,
          activitySubtitle: payload.message,
          facts: [
            {
              name: 'Severity',
              value: payload.severity.toUpperCase()
            },
            {
              name: 'Host',
              value: payload.hostname
            },
            {
              name: 'Time',
              value: payload.timestamp
            }
          ],
          markdown: true
        }
      ]
    };
  }

  /**
   * Generate email content
   */
  generateEmailContent(notification) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { padding: 20px; background-color: ${this.getSeverityColor(notification.severity)}; color: white; border-radius: 8px 8px 0 0; }
          .content { padding: 20px; }
          .footer { padding: 20px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; font-size: 12px; color: #666; }
          .severity { display: inline-block; padding: 4px 8px; border-radius: 4px; color: white; font-weight: bold; background-color: ${this.getSeverityColor(notification.severity)}; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚨 ${notification.title}</h1>
          </div>
          <div class="content">
            <p><strong>Severity:</strong> <span class="severity">${notification.severity.toUpperCase()}</span></p>
            <p><strong>Message:</strong> ${notification.message}</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            ${notification.context ? `<p><strong>Context:</strong> <pre>${JSON.stringify(notification.context, null, 2)}</pre></p>` : ''}
          </div>
          <div class="footer">
            <p>This alert was generated by your Macro Keyboard application on ${os.hostname()}.</p>
            <p>To manage your alert settings, please check your application configuration.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      ALERT: ${notification.title}

      Severity: ${notification.severity.toUpperCase()}
      Message: ${notification.message}
      Time: ${new Date().toLocaleString()}
      ${notification.context ? `Context: ${JSON.stringify(notification.context, null, 2)}` : ''}

      This alert was generated by your Macro Keyboard application on ${os.hostname()}.
    `;

    return { html, text };
  }

  /**
   * Format email template
   */
  formatEmailTemplate(template, notification) {
    return template
      .replace(/\{\{severity\}\}/g, notification.severity)
      .replace(/\{\{title\}\}/g, notification.title)
      .replace(/\{\{message\}\}/g, notification.message);
  }

  /**
   * Get severity color
   */
  getSeverityColor(severity) {
    const colors = {
      critical: '#FF0000',
      warning: '#FFA500',
      info: '#0066CC',
      recovery: '#00AA00'
    };

    return colors[severity] || colors.info;
  }

  /**
   * Get severity icon
   */
  getSeverityIcon(severity) {
    const icons = {
      critical: 'error',
      warning: 'warning',
      info: 'info',
      recovery: 'check'
    };

    return icons[severity] || icons.info;
  }

  /**
   * Get severity sound
   */
  getSeveritySound(severity) {
    const sounds = {
      critical: 'critical-alert.wav',
      warning: 'warning-alert.wav',
      info: 'info-alert.wav',
      recovery: 'success-alert.wav'
    };

    return sounds[severity] || null;
  }

  /**
   * Map severity to system notification urgency
   */
  mapSeverityToUrgency(severity) {
    const mapping = {
      critical: 'critical',
      warning: 'normal',
      info: 'low',
      recovery: 'low'
    };

    return mapping[severity] || 'normal';
  }

  /**
   * Map severity to log level
   */
  mapSeverityToLogLevel(severity) {
    const mapping = {
      critical: 'error',
      warning: 'warn',
      info: 'info',
      recovery: 'info'
    };

    return mapping[severity] || 'info';
  }

  /**
   * Get default icon path
   */
  getDefaultIcon() {
    // This would return the path to the app icon
    return null; // Will use system default
  }

  /**
   * Test notification delivery for a channel
   */
  async testChannel(channelName) {
    const channel = this.channels.get(channelName);
    if (!channel) {
      throw new Error(`Channel ${channelName} is not configured`);
    }

    if (!channel.enabled) {
      throw new Error(`Channel ${channelName} is disabled`);
    }

    const testNotification = {
      id: `test_${channelName}_${Date.now()}`,
      severity: 'info',
      title: `Test Notification - ${channel.name}`,
      message: `This is a test notification to verify ${channel.name} is working correctly.`,
      timestamp: Date.now(),
      context: {
        test: true,
        channel: channelName
      }
    };

    try {
      await channel.deliver(testNotification);

      this.log('info', `Test notification sent successfully to ${channelName}`);

      return {
        channel: channelName,
        status: 'success',
        message: 'Test notification delivered successfully',
        timestamp: Date.now()
      };
    } catch (error) {
      this.log('error', `Test notification failed for ${channelName}`, { error: error.message });

      return {
        channel: channelName,
        status: 'failed',
        message: error.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Test all configured channels
   */
  async testAllChannels() {
    const results = [];

    for (const [channelName] of this.channels) {
      try {
        const result = await this.testChannel(channelName);
        results.push(result);
      } catch (error) {
        results.push({
          channel: channelName,
          status: 'failed',
          message: error.message,
          timestamp: Date.now()
        });
      }
    }

    return results;
  }

  /**
   * Get notification statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      configuredChannels: this.channels.size,
      enabledChannels: Array.from(this.channels.values()).filter(c => c.enabled).length
    };
  }

  /**
   * Get configured channels
   */
  getChannels() {
    const channels = [];

    for (const [name, channel] of this.channels) {
      channels.push({
        name,
        displayName: channel.name,
        enabled: channel.enabled,
        stats: this.stats.channelStats[name]
      });
    }

    return channels;
  }

  /**
   * Enable/disable a channel
   */
  setChannelEnabled(channelName, enabled) {
    const channel = this.channels.get(channelName);
    if (!channel) {
      return false;
    }

    channel.enabled = enabled;

    this.log('info', `Channel ${channelName} ${enabled ? 'enabled' : 'disabled'}`);

    return true;
  }

  /**
   * Clear throttling and deduplication caches
   */
  clearCaches() {
    this.throttleCache.clear();
    this.deduplicationCache.clear();

    this.log('debug', 'Notification caches cleared');
  }

  /**
   * Log messages using LogManager if available, otherwise console
   */
  log(level, message, data = {}) {
    if (this.logManager && this.logManager.logWithComponent) {
      this.logManager.logWithComponent('NotificationChannels', level, message, data);
    } else if (this.logManager && this.logManager.getLogger) {
      const logger = this.logManager.getLogger();
      logger[level](message, data);
    } else {
      console[level](`[NotificationChannels] ${message}`, data);
    }
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.channels.clear();
    this.throttleCache.clear();
    this.deduplicationCache.clear();

    // Remove all event listeners
    this.removeAllListeners();

    this.isInitialized = false;
    this.log('info', 'NotificationChannels cleaned up');
  }

  /**
   * Check if channels are initialized
   */
  isReady() {
    return this.isInitialized;
  }

  /**
   * Update configuration
   */
  updateConfiguration(newConfig) {
    this.config = this.mergeConfig(newConfig);

    // Reinitialize channels
    this.channels.clear();
    this.setupChannels();

    this.log('info', 'NotificationChannels configuration updated');
  }
}

module.exports = NotificationChannels;
