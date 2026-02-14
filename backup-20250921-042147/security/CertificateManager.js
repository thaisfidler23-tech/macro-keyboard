const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const HSMInterface = require('./HSMInterface');

/**
 * Certificate lifecycle management system
 * Handles certificate storage, validation, renewal, and HSM integration
 */
class CertificateManager extends EventEmitter {
  constructor(logger, config = {}) {
    super();

    this.logger = logger;
    this.config = {
      certificateStore: config.certificateStore || path.join(process.cwd(), 'certificates'),
      enableHSM: config.enableHSM || false,
      autoRenewal: config.autoRenewal !== false,
      renewalThreshold: config.renewalThreshold || 30, // days before expiry
      notificationThreshold: config.notificationThreshold || 7, // days for notification
      validationInterval: config.validationInterval || 24 * 60 * 60 * 1000, // 24 hours
      ...config
    };

    this.certificates = new Map();
    this.hsmInterface = null;
    this.validationTimer = null;
    this.statistics = {
      certificatesLoaded: 0,
      validationChecks: 0,
      renewalAttempts: 0,
      successfulRenewals: 0,
      lastValidationTime: null
    };

    this.initializeComponents();

    this.logger.info('CertificateManager initialized');
  }

  /**
   * Initialize certificate management components
   */
  async initializeComponents() {
    try {
      // Ensure certificate store directory exists
      await fs.mkdir(this.config.certificateStore, { recursive: true });

      // Initialize HSM interface if enabled
      if (this.config.enableHSM) {
        this.hsmInterface = new HSMInterface(this.logger, this.config);
        await this.hsmInterface.initialize();
      }

      // Load existing certificates
      await this.loadCertificates();

      // Start periodic validation
      if (this.config.validationInterval > 0) {
        this.startPeriodicValidation();
      }

      this.logger.info('Certificate management components initialized');
    } catch (error) {
      this.logger.error('Failed to initialize certificate management:', error);
      throw error;
    }
  }

  /**
   * Get signing certificate for specified platform
   */
  async getSigningCertificate(platform) {
    const certKey = `${platform}_signing`;

    if (this.certificates.has(certKey)) {
      const certificate = this.certificates.get(certKey);

      // Validate certificate is still valid
      await this.validateCertificate(certificate);

      return certificate;
    }

    // Try to load certificate for platform
    const certificate = await this.loadPlatformCertificate(platform);

    if (certificate) {
      await this.validateCertificate(certificate);
      this.certificates.set(certKey, certificate);
      return certificate;
    }

    throw new Error(`No signing certificate found for platform: ${platform}`);
  }

  /**
   * Load certificate for specific platform
   */
  async loadPlatformCertificate(platform) {
    const certConfigs = this.config.certificates?.[platform];

    if (!certConfigs) {
      this.logger.warn(`No certificate configuration found for platform: ${platform}`);
      return null;
    }

    // Try each certificate configuration
    for (const certConfig of Array.isArray(certConfigs) ? certConfigs : [certConfigs]) {
      try {
        const certificate = await this.loadCertificateFromConfig(certConfig, platform);
        if (certificate) {
          this.logger.info(`Loaded certificate for ${platform}: ${certificate.subject}`);
          return certificate;
        }
      } catch (error) {
        this.logger.warn(`Failed to load certificate config for ${platform}:`, error.message);
      }
    }

    return null;
  }

  /**
   * Load certificate from configuration
   */
  async loadCertificateFromConfig(config, platform) {
    if (config.source === 'hsm' && this.hsmInterface) {
      return await this.loadCertificateFromHSM(config);
    } else if (config.source === 'file') {
      return await this.loadCertificateFromFile(config);
    } else if (config.source === 'store' && platform === 'win32') {
      return await this.loadCertificateFromWindowsStore(config);
    } else if (config.source === 'keychain' && platform === 'darwin') {
      return await this.loadCertificateFromKeychain(config);
    }

    throw new Error(`Unsupported certificate source: ${config.source}`);
  }

  /**
   * Load certificate from HSM
   */
  async loadCertificateFromHSM(config) {
    if (!this.hsmInterface) {
      throw new Error('HSM interface not initialized');
    }

    return await this.hsmInterface.getCertificate(config);
  }

  /**
   * Load certificate from file
   */
  async loadCertificateFromFile(config) {
    const certPath = path.resolve(this.config.certificateStore, config.path);

    try {
      const certData = await fs.readFile(certPath);
      const certificate = await this.parseCertificate(certData, config);

      return {
        ...certificate,
        type: 'file',
        path: certPath,
        source: 'file'
      };
    } catch (error) {
      throw new Error(`Failed to load certificate from file ${certPath}: ${error.message}`);
    }
  }

  /**
   * Load certificate from Windows Certificate Store
   */
  async loadCertificateFromWindowsStore(config) {
    return {
      type: 'store',
      store: config.store || 'MY',
      subject: config.subject,
      thumbprint: config.thumbprint,
      source: 'store'
    };
  }

  /**
   * Load certificate from macOS Keychain
   */
  async loadCertificateFromKeychain(config) {
    return {
      type: 'keychain',
      identity: config.identity,
      keychain: config.keychain,
      source: 'keychain'
    };
  }

  /**
   * Parse certificate data
   */
  async parseCertificate(certData, config) {
    try {
      // This is a simplified parser - in production, use a proper certificate library
      const cert = {
        data: certData,
        format: config.format || 'PEM'
      };

      // Extract basic certificate information
      if (config.format === 'PEM' || !config.format) {
        const certText = certData.toString();
        cert.subject = this.extractCertificateField(certText, 'Subject:');
        cert.issuer = this.extractCertificateField(certText, 'Issuer:');
        cert.validFrom = this.extractCertificateDate(certText, 'Not Before:');
        cert.validTo = this.extractCertificateDate(certText, 'Not After:');
        cert.thumbprint = this.calculateThumbprint(certData);
      }

      // Add password if provided
      if (config.password) {
        cert.password = config.password;
      }

      return cert;
    } catch (error) {
      throw new Error(`Failed to parse certificate: ${error.message}`);
    }
  }

  /**
   * Extract field from certificate text (simplified)
   */
  extractCertificateField(certText, fieldName) {
    const match = certText.match(new RegExp(`${fieldName}\\s*(.+)`));
    return match ? match[1].trim() : 'Unknown';
  }

  /**
   * Extract date from certificate text (simplified)
   */
  extractCertificateDate(certText, fieldName) {
    const match = certText.match(new RegExp(`${fieldName}\\s*(.+)`));
    if (match) {
      try {
        return new Date(match[1].trim());
      } catch (error) {
        return null;
      }
    }
    return null;
  }

  /**
   * Calculate certificate thumbprint
   */
  calculateThumbprint(certData) {
    const hash = crypto.createHash('sha1');
    hash.update(certData);
    return hash.digest('hex').toUpperCase();
  }

  /**
   * Validate certificate
   */
  async validateCertificate(certificate) {
    try {
      this.logger.debug(`Validating certificate: ${certificate.subject || certificate.identity}`);

      // Check expiration
      if (certificate.validTo) {
        const now = new Date();
        const expiryDate = new Date(certificate.validTo);

        if (expiryDate < now) {
          throw new Error('Certificate has expired');
        }

        // Check if expiring soon
        const daysUntilExpiry = Math.floor((expiryDate - now) / (24 * 60 * 60 * 1000));

        if (daysUntilExpiry <= this.config.notificationThreshold) {
          await this.notifyCertificateExpiration(certificate, daysUntilExpiry);
        }

        if (daysUntilExpiry <= this.config.renewalThreshold && this.config.autoRenewal) {
          await this.scheduleCertificateRenewal(certificate);
        }
      }

      // Validate certificate chain if possible
      await this.validateCertificateChain(certificate);

      // Check certificate revocation status
      await this.checkRevocationStatus(certificate);

      this.statistics.validationChecks++;
      return true;
    } catch (error) {
      this.logger.error(`Certificate validation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate certificate chain
   */
  async validateCertificateChain(certificate) {
    // This is a placeholder for certificate chain validation
    // In production, implement proper certificate chain validation
    this.logger.debug('Certificate chain validation (placeholder)');
    return true;
  }

  /**
   * Check certificate revocation status
   */
  async checkRevocationStatus(certificate) {
    // This is a placeholder for CRL/OCSP checking
    // In production, implement proper revocation checking
    this.logger.debug('Certificate revocation check (placeholder)');
    return true;
  }

  /**
   * Notify about certificate expiration
   */
  async notifyCertificateExpiration(certificate, daysUntilExpiry) {
    const notification = {
      type: 'certificate_expiration',
      certificate: certificate.subject || certificate.identity,
      daysUntilExpiry,
      timestamp: new Date().toISOString()
    };

    this.logger.warn(`Certificate expiring in ${daysUntilExpiry} days: ${certificate.subject || certificate.identity}`);
    this.emit('certificate-expiration', notification);

    // Send notification through configured channels
    if (this.config.notificationChannels) {
      for (const channel of this.config.notificationChannels) {
        try {
          await this.sendNotification(channel, notification);
        } catch (error) {
          this.logger.error(`Failed to send notification via ${channel.type}:`, error);
        }
      }
    }
  }

  /**
   * Schedule certificate renewal
   */
  async scheduleCertificateRenewal(certificate) {
    try {
      this.logger.info(`Scheduling renewal for certificate: ${certificate.subject || certificate.identity}`);

      this.statistics.renewalAttempts++;

      const renewalResult = await this.renewCertificate(certificate);

      if (renewalResult.success) {
        this.statistics.successfulRenewals++;
        this.emit('certificate-renewed', {
          certificate: certificate.subject || certificate.identity,
          newCertificate: renewalResult.newCertificate,
          timestamp: new Date().toISOString()
        });
      }

      return renewalResult;
    } catch (error) {
      this.logger.error(`Certificate renewal failed: ${error.message}`);
      this.emit('certificate-renewal-failed', {
        certificate: certificate.subject || certificate.identity,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Renew certificate
   */
  async renewCertificate(certificate) {
    // This is a placeholder for certificate renewal
    // In production, implement proper renewal with CA
    this.logger.info(`Renewing certificate: ${certificate.subject || certificate.identity}`);

    // Return mock renewal result
    return {
      success: false,
      reason: 'Automatic renewal not implemented',
      requiresManualRenewal: true
    };
  }

  /**
   * Load all certificates from store
   */
  async loadCertificates() {
    try {
      const files = await fs.readdir(this.config.certificateStore);

      for (const file of files) {
        if (file.endsWith('.pem') || file.endsWith('.p12') || file.endsWith('.pfx')) {
          try {
            const certPath = path.join(this.config.certificateStore, file);
            const certData = await fs.readFile(certPath);

            const certificate = await this.parseCertificate(certData, {
              format: file.endsWith('.pem') ? 'PEM' : 'PKCS12'
            });

            certificate.fileName = file;
            certificate.path = certPath;

            this.certificates.set(file, certificate);
            this.statistics.certificatesLoaded++;
          } catch (error) {
            this.logger.warn(`Failed to load certificate ${file}:`, error.message);
          }
        }
      }

      this.logger.info(`Loaded ${this.statistics.certificatesLoaded} certificates from store`);
    } catch (error) {
      this.logger.error('Failed to load certificates from store:', error);
    }
  }

  /**
   * Start periodic certificate validation
   */
  startPeriodicValidation() {
    if (this.validationTimer) {
      clearInterval(this.validationTimer);
    }

    this.validationTimer = setInterval(async() => {
      try {
        await this.validateAllCertificates();
        this.statistics.lastValidationTime = new Date().toISOString();
      } catch (error) {
        this.logger.error('Periodic certificate validation failed:', error);
      }
    }, this.config.validationInterval);

    this.logger.info(`Started periodic certificate validation (interval: ${this.config.validationInterval}ms)`);
  }

  /**
   * Validate all loaded certificates
   */
  async validateAllCertificates() {
    this.logger.debug('Performing periodic certificate validation');

    for (const [key, certificate] of this.certificates) {
      try {
        await this.validateCertificate(certificate);
      } catch (error) {
        this.logger.error(`Validation failed for certificate ${key}:`, error.message);
      }
    }
  }

  /**
   * Send notification through configured channel
   */
  async sendNotification(channel, notification) {
    // Placeholder for notification sending
    // In production, implement email, Slack, webhook notifications
    this.logger.info(`Notification sent via ${channel.type}:`, notification);
  }

  /**
   * Emergency certificate revocation
   */
  async revokeCertificate(certificate, reason) {
    try {
      this.logger.warn(`Emergency certificate revocation: ${certificate.subject || certificate.identity}`);

      // Remove from active certificates
      for (const [key, cert] of this.certificates) {
        if (cert.thumbprint === certificate.thumbprint) {
          this.certificates.delete(key);
          break;
        }
      }

      // Notify about revocation
      this.emit('certificate-revoked', {
        certificate: certificate.subject || certificate.identity,
        reason,
        timestamp: new Date().toISOString()
      });

      // In production, add CRL/OCSP revocation

      return true;
    } catch (error) {
      this.logger.error(`Certificate revocation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get certificate statistics
   */
  getStatistics() {
    return {
      ...this.statistics,
      activeCertificates: this.certificates.size,
      hsmEnabled: !!this.hsmInterface
    };
  }

  /**
   * Health check for certificate management
   */
  async healthCheck() {
    const healthStatus = {
      status: 'healthy',
      certificateStore: this.config.certificateStore,
      activeCertificates: this.certificates.size,
      hsmStatus: null,
      lastValidation: this.statistics.lastValidationTime,
      timestamp: new Date().toISOString()
    };

    try {
      // Check certificate store accessibility
      await fs.access(this.config.certificateStore);

      // Check HSM if enabled
      if (this.hsmInterface) {
        healthStatus.hsmStatus = await this.hsmInterface.healthCheck();
      }

      // Count expiring certificates
      const expiringCertificates = [];
      const now = new Date();

      for (const [key, cert] of this.certificates) {
        if (cert.validTo) {
          const daysUntilExpiry = Math.floor((cert.validTo - now) / (24 * 60 * 60 * 1000));
          if (daysUntilExpiry <= this.config.notificationThreshold) {
            expiringCertificates.push({ key, daysUntilExpiry });
          }
        }
      }

      healthStatus.expiringCertificates = expiringCertificates;

      if (expiringCertificates.length > 0) {
        healthStatus.status = 'degraded';
      }
    } catch (error) {
      healthStatus.status = 'critical';
      healthStatus.error = error.message;
    }

    return healthStatus;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };

    // Restart validation if interval changed
    if (newConfig.validationInterval && this.validationTimer) {
      this.startPeriodicValidation();
    }

    this.logger.info('Certificate manager configuration updated');
    this.emit('config-updated', this.config);
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    try {
      if (this.validationTimer) {
        clearInterval(this.validationTimer);
        this.validationTimer = null;
      }

      if (this.hsmInterface) {
        await this.hsmInterface.cleanup();
      }

      this.certificates.clear();
      this.removeAllListeners();

      this.logger.info('CertificateManager cleaned up');
    } catch (error) {
      this.logger.error('Error during certificate manager cleanup:', error);
    }
  }
}

module.exports = CertificateManager;
