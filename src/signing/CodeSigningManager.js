const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const WindowsSigner = require('./WindowsSigner');
const MacOSSigner = require('./MacOSSigner');
const LinuxSigner = require('./LinuxSigner');
const CertificateManager = require('../security/CertificateManager');
const TimestampService = require('./TimestampService');

/**
 * Unified code signing manager for multi-platform artifact signing
 * Handles Windows Authenticode, macOS codesign, and Linux package signing
 */
class CodeSigningManager extends EventEmitter {
  constructor(logger, config = {}) {
    super();
    
    this.logger = logger;
    this.platform = process.platform;
    this.config = {
      enableSigning: config.enableSigning !== false,
      enableTimestamping: config.enableTimestamping !== false,
      signatureAlgorithm: config.signatureAlgorithm || 'SHA256',
      timestampServers: config.timestampServers || [
        'http://timestamp.digicert.com',
        'http://time.certum.pl',
        'http://timestamp.globalsign.com/scripts/timstamp.dll'
      ],
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 5000,
      ...config
    };

    this.signer = null;
    this.certificateManager = null;
    this.timestampService = null;
    this.signingStats = {
      totalSigned: 0,
      successCount: 0,
      failureCount: 0,
      lastSigningTime: null
    };

    this.initializeComponents();
    
    this.logger.info(`CodeSigningManager initialized for platform: ${this.platform}`);
  }

  /**
   * Initialize platform-specific components
   */
  initializeComponents() {
    try {
      // Initialize platform-specific signer
      this.signer = this.createPlatformSigner();
      
      // Initialize certificate manager
      this.certificateManager = new CertificateManager(this.logger, this.config);
      
      // Initialize timestamp service
      this.timestampService = new TimestampService(this.logger, this.config);
      
      this.logger.info('Code signing components initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize code signing components:', error);
      throw error;
    }
  }

  /**
   * Create platform-specific signer instance
   */
  createPlatformSigner() {
    switch (this.platform) {
      case 'win32':
        return new WindowsSigner(this.logger, this.config);
      case 'darwin':
        return new MacOSSigner(this.logger, this.config);
      case 'linux':
        return new LinuxSigner(this.logger, this.config);
      default:
        throw new Error(`Unsupported platform for code signing: ${this.platform}`);
    }
  }

  /**
   * Sign an artifact with platform-appropriate signature
   */
  async signArtifact(artifactPath, options = {}) {
    if (!this.config.enableSigning) {
      this.logger.warn('Code signing is disabled, skipping signature');
      return { signed: false, reason: 'signing_disabled' };
    }

    const startTime = Date.now();
    let attempt = 0;
    
    while (attempt < this.config.retryAttempts) {
      try {
        attempt++;
        
        this.logger.info(`Signing artifact: ${artifactPath} (attempt ${attempt}/${this.config.retryAttempts})`);
        this.emit('signing-started', { artifactPath, attempt });

        // Validate artifact exists and is readable
        await this.validateArtifact(artifactPath);

        // Get appropriate signing certificate
        const certificate = await this.certificateManager.getSigningCertificate(this.platform);
        
        // Calculate artifact hash before signing
        const preSignHash = await this.calculateFileHash(artifactPath);
        
        // Perform platform-specific signing
        const signingOptions = {
          timestamp: this.config.enableTimestamping && options.timestamp !== false,
          description: options.description || `Macro Keyboard v${require('../../package.json').version}`,
          url: options.url || 'https://github.com/jmassardo/macro-keyboard',
          algorithm: this.config.signatureAlgorithm,
          ...options
        };

        const signedPath = await this.signer.sign(artifactPath, certificate, signingOptions);
        
        // Verify signature immediately after signing
        const verificationResult = await this.verifySigning(signedPath);
        
        if (!verificationResult.valid) {
          throw new Error(`Signature verification failed: ${verificationResult.error}`);
        }

        // Calculate post-signing hash
        const postSignHash = await this.calculateFileHash(signedPath);
        
        const result = {
          signed: true,
          originalPath: artifactPath,
          signedPath: signedPath,
          certificate: {
            thumbprint: certificate.thumbprint,
            subject: certificate.subject,
            issuer: certificate.issuer,
            validFrom: certificate.validFrom,
            validTo: certificate.validTo
          },
          signature: {
            algorithm: signingOptions.algorithm,
            timestamp: verificationResult.timestamp,
            timestampAuthority: verificationResult.timestampAuthority
          },
          hashes: {
            beforeSigning: preSignHash,
            afterSigning: postSignHash
          },
          signingTime: new Date().toISOString(),
          duration: Date.now() - startTime,
          attempt: attempt,
          platform: this.platform
        };

        // Update statistics
        this.signingStats.totalSigned++;
        this.signingStats.successCount++;
        this.signingStats.lastSigningTime = result.signingTime;

        this.logger.info(`Successfully signed artifact: ${signedPath}`);
        this.emit('signing-completed', result);

        return result;

      } catch (error) {
        this.logger.error(`Signing attempt ${attempt} failed:`, error);
        
        if (attempt >= this.config.retryAttempts) {
          this.signingStats.totalSigned++;
          this.signingStats.failureCount++;
          
          const failureResult = {
            signed: false,
            originalPath: artifactPath,
            error: error.message,
            attempts: attempt,
            duration: Date.now() - startTime,
            platform: this.platform
          };

          this.emit('signing-failed', failureResult);
          throw error;
        }

        // Wait before retry
        if (attempt < this.config.retryAttempts) {
          this.logger.info(`Retrying signing in ${this.config.retryDelay}ms...`);
          await this.delay(this.config.retryDelay);
        }
      }
    }
  }

  /**
   * Verify signature of a signed artifact
   */
  async verifySigning(signedPath, options = {}) {
    try {
      this.logger.debug(`Verifying signature for: ${signedPath}`);
      
      const verificationResult = await this.signer.verify(signedPath, options);
      
      if (verificationResult.valid) {
        this.logger.debug(`Signature verification successful for: ${signedPath}`);
      } else {
        this.logger.warn(`Signature verification failed for: ${signedPath}`, verificationResult);
      }
      
      return verificationResult;
    } catch (error) {
      this.logger.error('Signature verification error:', error);
      return {
        valid: false,
        error: error.message,
        path: signedPath
      };
    }
  }

  /**
   * Batch sign multiple artifacts
   */
  async signArtifacts(artifactPaths, options = {}) {
    const results = [];
    const batchOptions = {
      concurrency: options.concurrency || 1,
      continueOnError: options.continueOnError !== false,
      ...options
    };

    this.logger.info(`Starting batch signing of ${artifactPaths.length} artifacts`);
    this.emit('batch-signing-started', { count: artifactPaths.length, options: batchOptions });

    for (let i = 0; i < artifactPaths.length; i += batchOptions.concurrency) {
      const batch = artifactPaths.slice(i, i + batchOptions.concurrency);
      const batchPromises = batch.map(async (artifactPath) => {
        try {
          const result = await this.signArtifact(artifactPath, options);
          return { path: artifactPath, result, success: true };
        } catch (error) {
          const errorResult = { path: artifactPath, error: error.message, success: false };
          if (!batchOptions.continueOnError) {
            throw error;
          }
          return errorResult;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    this.logger.info(`Batch signing completed: ${successCount} successful, ${failureCount} failed`);
    this.emit('batch-signing-completed', { 
      results, 
      successCount, 
      failureCount, 
      totalCount: results.length 
    });

    return {
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failureCount,
        successRate: (successCount / results.length * 100).toFixed(2) + '%'
      }
    };
  }

  /**
   * Validate artifact before signing
   */
  async validateArtifact(artifactPath) {
    try {
      const stats = await fs.stat(artifactPath);
      
      if (!stats.isFile()) {
        throw new Error(`Artifact is not a file: ${artifactPath}`);
      }

      if (stats.size === 0) {
        throw new Error(`Artifact is empty: ${artifactPath}`);
      }

      // Check if file is readable
      await fs.access(artifactPath, fs.constants.R_OK);
      
      this.logger.debug(`Artifact validation successful: ${artifactPath} (${stats.size} bytes)`);
      return true;
    } catch (error) {
      this.logger.error(`Artifact validation failed: ${artifactPath}`, error);
      throw new Error(`Invalid artifact: ${error.message}`);
    }
  }

  /**
   * Calculate file hash for integrity verification
   */
  async calculateFileHash(filePath, algorithm = 'sha256') {
    try {
      const fileBuffer = await fs.readFile(filePath);
      const hash = crypto.createHash(algorithm);
      hash.update(fileBuffer);
      return hash.digest('hex');
    } catch (error) {
      this.logger.error(`Failed to calculate hash for ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Get signing capabilities for current platform
   */
  getSigningCapabilities() {
    return {
      platform: this.platform,
      supportedFormats: this.signer?.getSupportedFormats() || [],
      signingEnabled: this.config.enableSigning,
      timestampingEnabled: this.config.enableTimestamping,
      certificateTypes: this.signer?.getSupportedCertificateTypes() || [],
      algorithms: this.signer?.getSupportedAlgorithms() || []
    };
  }

  /**
   * Get signing statistics
   */
  getSigningStatistics() {
    return {
      ...this.signingStats,
      successRate: this.signingStats.totalSigned > 0 
        ? (this.signingStats.successCount / this.signingStats.totalSigned * 100).toFixed(2) + '%'
        : '0%',
      certificateStats: this.certificateManager?.getStatistics() || {},
      timestampStats: this.timestampService?.getStatistics() || {}
    };
  }

  /**
   * Update signing configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    // Update component configurations
    this.certificateManager?.updateConfig(newConfig);
    this.timestampService?.updateConfig(newConfig);
    this.signer?.updateConfig?.(newConfig);
    
    this.logger.info('Code signing configuration updated');
    this.emit('config-updated', this.config);
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Health check for signing infrastructure
   */
  async healthCheck() {
    const healthStatus = {
      overall: 'healthy',
      components: {},
      timestamp: new Date().toISOString()
    };

    try {
      // Check certificate manager
      healthStatus.components.certificateManager = await this.certificateManager.healthCheck();
      
      // Check timestamp service
      healthStatus.components.timestampService = await this.timestampService.healthCheck();
      
      // Check platform signer
      if (this.signer.healthCheck) {
        healthStatus.components.signer = await this.signer.healthCheck();
      } else {
        healthStatus.components.signer = { status: 'healthy', note: 'No health check available' };
      }

      // Determine overall health
      const componentStatuses = Object.values(healthStatus.components).map(c => c.status);
      if (componentStatuses.some(status => status === 'critical')) {
        healthStatus.overall = 'critical';
      } else if (componentStatuses.some(status => status === 'degraded')) {
        healthStatus.overall = 'degraded';
      }

    } catch (error) {
      healthStatus.overall = 'critical';
      healthStatus.error = error.message;
    }

    return healthStatus;
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    try {
      if (this.certificateManager) {
        await this.certificateManager.cleanup();
      }
      
      if (this.timestampService) {
        await this.timestampService.cleanup();
      }
      
      if (this.signer && this.signer.cleanup) {
        await this.signer.cleanup();
      }
      
      this.removeAllListeners();
      this.logger.info('CodeSigningManager cleaned up');
    } catch (error) {
      this.logger.error('Error during cleanup:', error);
    }
  }
}

module.exports = CodeSigningManager;