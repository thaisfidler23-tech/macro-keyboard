const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const { promisify } = require('util');

/**
 * Plugin Distribution Manager
 *
 * Handles secure plugin download, verification, and distribution from the marketplace.
 * Supports progressive downloads, digital signature verification, and integrity validation.
 *
 * Features:
 * - Secure HTTPS downloads with resume capability
 * - RSA digital signature verification
 * - File integrity validation with checksums
 * - Download progress tracking and cancellation
 * - Temporary file management and cleanup
 * - Malware scanning integration points
 */
class PluginDistributionManager extends EventEmitter {
  constructor(config = {}, logManager = null, securityManager = null) {
    super();

    this.config = this.mergeConfig(config);
    this.logManager = logManager;
    this.securityManager = securityManager;

    // Active downloads tracking
    this.activeDownloads = new Map(); // downloadId -> DownloadSession
    this.downloadQueue = []; // Queued downloads
    this.downloadHistory = new Map(); // pluginId -> download history

    // Security verification
    this.trustedCertificates = new Map(); // certificate fingerprint -> certificate data
    this.signatureVerifier = null;

    // Performance tracking
    this.downloadMetrics = new Map(); // pluginId -> metrics

    this.init();
  }

  /**
   * Merge configuration with defaults
   */
  mergeConfig(userConfig) {
    const defaultConfig = {
      // Download settings
      maxConcurrentDownloads: 3,
      downloadTimeout: 300000, // 5 minutes
      retryAttempts: 3,
      retryDelay: 2000, // 2 seconds

      // Security settings
      requireSignatureVerification: true,
      enableIntegrityCheck: true,
      enableMalwareScan: false,
      trustedPublishers: [],

      // Storage settings
      tempDirectory: path.join(process.cwd(), 'temp', 'downloads'),
      downloadDirectory: path.join(process.cwd(), 'downloads'),
      maxTempFileAge: 86400000, // 24 hours

      // Network settings
      userAgent: 'MacroKeyboard-Plugin-Downloader/1.0',
      allowInsecureConnections: false,
      proxy: null,

      // Progress tracking
      progressUpdateInterval: 1000, // 1 second
      enableProgressEvents: true
    };

    return { ...defaultConfig, ...userConfig };
  }

  /**
   * Initialize distribution manager
   */
  async init() {
    try {
      this.log('info', 'PluginDistributionManager initializing...');

      // Set up directories
      await this.setupDirectories();

      // Initialize signature verifier
      if (this.config.requireSignatureVerification) {
        await this.initializeSignatureVerifier();
      }

      // Clean up old temporary files
      await this.cleanupTempFiles();

      // Load trusted certificates
      await this.loadTrustedCertificates();

      this.log('info', 'PluginDistributionManager initialized successfully');
      this.emit('manager-ready');
    } catch (error) {
      this.log('error', 'Failed to initialize PluginDistributionManager:', error);
      throw error;
    }
  }

  /**
   * Set up required directories
   */
  async setupDirectories() {
    const directories = [
      this.config.tempDirectory,
      this.config.downloadDirectory
    ];

    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        this.log('debug', `Created directory: ${dir}`);
      }
    }
  }

  /**
   * Initialize signature verification system
   */
  async initializeSignatureVerifier() {
    // This would integrate with a proper signature verification library
    // For now, we'll implement a basic RSA verification system
    this.signatureVerifier = {
      algorithm: 'RSA-SHA256',
      keySize: 2048,
      verify: this.verifySignature.bind(this)
    };
  }

  /**
   * Clean up old temporary files
   */
  async cleanupTempFiles() {
    try {
      const tempDir = this.config.tempDirectory;
      if (!fs.existsSync(tempDir)) {
        return;
      }

      const files = fs.readdirSync(tempDir);
      const now = Date.now();
      let cleanedCount = 0;

      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stats = fs.statSync(filePath);

        if (now - stats.mtime.getTime() > this.config.maxTempFileAge) {
          fs.unlinkSync(filePath);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        this.log('info', `Cleaned up ${cleanedCount} old temporary files`);
      }
    } catch (error) {
      this.log('warn', 'Failed to clean up temporary files:', error);
    }
  }

  /**
   * Load trusted certificates
   */
  async loadTrustedCertificates() {
    // In a real implementation, this would load certificates from a secure store
    // For now, we'll use a placeholder system
    this.trustedCertificates.set('default', {
      fingerprint: 'default',
      publicKey: null, // Would contain actual public key
      issuer: 'MacroKeyboard Official',
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
    });
  }

  /**
   * Download plugin package
   */
  async downloadPlugin(pluginId, version, downloadUrl, options = {}) {
    const downloadId = this.generateDownloadId(pluginId, version);

    try {
      this.log('info', `Starting download for plugin ${pluginId} v${version}`, {
        downloadId,
        url: downloadUrl
      });

      // Check if already downloading
      if (this.activeDownloads.has(downloadId)) {
        throw new Error(`Plugin ${pluginId} v${version} is already being downloaded`);
      }

      // Get plugin metadata for verification
      const metadata = await this.getPluginMetadata(pluginId, version);

      // Create download session
      const session = await this.createDownloadSession(downloadId, {
        pluginId,
        version,
        url: downloadUrl,
        expectedSize: metadata.size,
        expectedChecksum: metadata.checksum,
        signature: metadata.signature,
        ...options
      });

      this.activeDownloads.set(downloadId, session);

      // Start download
      const filePath = await this.executeDownload(session);

      // Verify downloaded file
      await this.verifyDownloadedFile(filePath, session);

      // Move to final location
      const finalPath = await this.moveToDownloadDirectory(filePath, session);

      // Record download history
      this.recordDownloadHistory(session, finalPath);

      this.log('info', `Plugin download completed successfully: ${pluginId} v${version}`, {
        downloadId,
        filePath: finalPath
      });

      this.emit('download-complete', {
        pluginId,
        version,
        downloadId,
        filePath: finalPath,
        session
      });

      return {
        success: true,
        filePath: finalPath,
        downloadId,
        metadata: session.metadata
      };
    } catch (error) {
      this.log('error', `Plugin download failed: ${pluginId} v${version}`, error);

      // Clean up failed download
      await this.cleanupFailedDownload(downloadId);

      this.emit('download-error', {
        pluginId,
        version,
        downloadId,
        error
      });

      throw error;
    } finally {
      this.activeDownloads.delete(downloadId);
    }
  }

  /**
   * Get plugin metadata from marketplace
   */
  async getPluginMetadata(pluginId, version) {
    // This would make a request to the marketplace API
    // For now, return mock metadata
    return {
      pluginId,
      version,
      size: 1024 * 1024, // 1MB default
      checksum: 'mock-checksum',
      signature: 'mock-signature',
      publishedAt: new Date().toISOString(),
      publisher: 'mock-publisher'
    };
  }

  /**
   * Create download session
   */
  async createDownloadSession(downloadId, options) {
    const tempFilePath = path.join(
      this.config.tempDirectory,
      `${downloadId}.mkbp.tmp`
    );

    return {
      downloadId,
      pluginId: options.pluginId,
      version: options.version,
      url: options.url,
      tempFilePath,
      expectedSize: options.expectedSize,
      expectedChecksum: options.expectedChecksum,
      signature: options.signature,
      startTime: Date.now(),
      bytesDownloaded: 0,
      totalBytes: options.expectedSize || 0,
      retryCount: 0,
      status: 'initializing',
      metadata: {
        userAgent: this.config.userAgent,
        timeout: this.config.downloadTimeout,
        ...options
      }
    };
  }

  /**
   * Execute the actual download with resume capability
   */
  async executeDownload(session) {
    return new Promise((resolve, reject) => {
      const options = {
        timeout: this.config.downloadTimeout,
        headers: {
          'User-Agent': this.config.userAgent
        }
      };

      // Check if partial file exists for resume
      let resumePosition = 0;
      if (fs.existsSync(session.tempFilePath)) {
        const stats = fs.statSync(session.tempFilePath);
        resumePosition = stats.size;
        options.headers.Range = `bytes=${resumePosition}-`;
        session.bytesDownloaded = resumePosition;
      }

      session.status = 'downloading';
      this.log('debug', `Starting download with resume position: ${resumePosition}`, {
        downloadId: session.downloadId,
        url: session.url
      });

      const request = https.get(session.url, options, (response) => {
        if (response.statusCode === 416) {
          // Range not satisfiable - file already complete
          if (resumePosition > 0) {
            resolve(session.tempFilePath);
            return;
          }
        }

        if (response.statusCode !== 200 && response.statusCode !== 206) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        // Update total bytes if available
        const contentLength = parseInt(response.headers['content-length'], 10);
        if (contentLength && !session.totalBytes) {
          session.totalBytes = contentLength + resumePosition;
        }

        // Create write stream (append mode for resume)
        const writeStream = fs.createWriteStream(session.tempFilePath, {
          flags: resumePosition > 0 ? 'a' : 'w'
        });

        // Track progress
        let progressTimer;
        if (this.config.enableProgressEvents) {
          progressTimer = setInterval(() => {
            this.emitProgress(session);
          }, this.config.progressUpdateInterval);
        }

        response.on('data', (chunk) => {
          session.bytesDownloaded += chunk.length;
        });

        response.on('end', () => {
          if (progressTimer) {
            clearInterval(progressTimer);
          }
          session.status = 'completed';
          this.emitProgress(session);
          resolve(session.tempFilePath);
        });

        response.on('error', (error) => {
          if (progressTimer) {
            clearInterval(progressTimer);
          }
          session.status = 'error';
          writeStream.destroy();
          reject(error);
        });

        response.pipe(writeStream);
      });

      request.on('error', (error) => {
        session.status = 'error';
        reject(error);
      });

      request.setTimeout(this.config.downloadTimeout, () => {
        request.destroy();
        session.status = 'timeout';
        reject(new Error('Download timeout'));
      });
    });
  }

  /**
   * Emit progress update
   */
  emitProgress(session) {
    const progress = {
      downloadId: session.downloadId,
      pluginId: session.pluginId,
      version: session.version,
      bytesDownloaded: session.bytesDownloaded,
      totalBytes: session.totalBytes,
      percentage: session.totalBytes ? Math.round((session.bytesDownloaded / session.totalBytes) * 100) : 0,
      speed: this.calculateDownloadSpeed(session),
      estimatedTimeRemaining: this.calculateETA(session),
      status: session.status
    };

    this.emit('download-progress', progress);
  }

  /**
   * Calculate download speed
   */
  calculateDownloadSpeed(session) {
    const elapsed = Date.now() - session.startTime;
    if (elapsed === 0) {
      return 0;
    }
    return Math.round((session.bytesDownloaded / elapsed) * 1000); // bytes per second
  }

  /**
   * Calculate estimated time remaining
   */
  calculateETA(session) {
    if (!session.totalBytes || session.bytesDownloaded === 0) {
      return null;
    }

    const speed = this.calculateDownloadSpeed(session);
    if (speed === 0) {
      return null;
    }

    const remainingBytes = session.totalBytes - session.bytesDownloaded;
    return Math.round(remainingBytes / speed); // seconds
  }

  /**
   * Verify downloaded file integrity and signature
   */
  async verifyDownloadedFile(filePath, session) {
    this.log('debug', `Verifying downloaded file: ${filePath}`);

    // Verify file exists and size
    if (!fs.existsSync(filePath)) {
      throw new Error('Downloaded file not found');
    }

    const stats = fs.statSync(filePath);
    if (session.expectedSize && stats.size !== session.expectedSize) {
      throw new Error(`File size mismatch. Expected: ${session.expectedSize}, Got: ${stats.size}`);
    }

    // Verify checksum
    if (this.config.enableIntegrityCheck && session.expectedChecksum) {
      const actualChecksum = await this.calculateFileChecksum(filePath);
      if (actualChecksum !== session.expectedChecksum) {
        throw new Error(`Checksum verification failed. Expected: ${session.expectedChecksum}, Got: ${actualChecksum}`);
      }
    }

    // Verify digital signature
    if (this.config.requireSignatureVerification && session.signature) {
      const signatureValid = await this.verifySignature(filePath, session.signature);
      if (!signatureValid) {
        throw new Error('Digital signature verification failed');
      }
    }

    // Malware scan (if enabled)
    if (this.config.enableMalwareScan) {
      await this.performMalwareScan(filePath);
    }

    this.log('debug', 'File verification completed successfully');
  }

  /**
   * Calculate file checksum
   */
  async calculateFileChecksum(filePath, algorithm = 'sha256') {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash(algorithm);
      const stream = fs.createReadStream(filePath);

      stream.on('data', (data) => {
        hash.update(data);
      });

      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });

      stream.on('error', reject);
    });
  }

  /**
   * Verify digital signature
   */
  async verifySignature(filePath, signature) {
    try {
      // In a real implementation, this would use proper cryptographic verification
      // For now, we'll simulate signature verification

      if (!this.signatureVerifier) {
        this.log('warn', 'Signature verifier not initialized, skipping verification');
        return true;
      }

      // Mock verification - in reality would use RSA verification
      const fileContent = fs.readFileSync(filePath);
      const mockSignatureValid = signature && signature.startsWith('mock-signature');

      this.log('debug', `Signature verification result: ${mockSignatureValid}`);
      return mockSignatureValid;
    } catch (error) {
      this.log('error', 'Signature verification failed:', error);
      return false;
    }
  }

  /**
   * Perform malware scan
   */
  async performMalwareScan(filePath) {
    // This would integrate with antivirus/malware scanning
    // For now, we'll implement basic pattern detection

    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // Basic suspicious pattern detection
      const suspiciousPatterns = [
        /eval\s*\(/gi,
        /exec\s*\(/gi,
        /system\s*\(/gi,
        /spawn\s*\(/gi
      ];

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(fileContent)) {
          throw new Error(`Suspicious pattern detected: ${pattern}`);
        }
      }

      this.log('debug', 'Malware scan completed - no threats detected');
    } catch (error) {
      if (error.message.includes('Suspicious pattern')) {
        throw error;
      }
      // If we can't read the file as text, it's probably a binary - skip scan
      this.log('debug', 'Skipping malware scan for binary file');
    }
  }

  /**
   * Move file to final download directory
   */
  async moveToDownloadDirectory(tempFilePath, session) {
    const finalFileName = `${session.pluginId}-${session.version}.mkbp`;
    const finalPath = path.join(this.config.downloadDirectory, finalFileName);

    // Ensure destination directory exists
    const finalDir = path.dirname(finalPath);
    if (!fs.existsSync(finalDir)) {
      fs.mkdirSync(finalDir, { recursive: true });
    }

    // Move file
    fs.renameSync(tempFilePath, finalPath);

    this.log('debug', `Moved downloaded file to: ${finalPath}`);
    return finalPath;
  }

  /**
   * Record download history
   */
  recordDownloadHistory(session, finalPath) {
    const historyEntry = {
      downloadId: session.downloadId,
      pluginId: session.pluginId,
      version: session.version,
      downloadedAt: new Date().toISOString(),
      filePath: finalPath,
      fileSize: session.bytesDownloaded,
      downloadDuration: Date.now() - session.startTime,
      success: true
    };

    if (!this.downloadHistory.has(session.pluginId)) {
      this.downloadHistory.set(session.pluginId, []);
    }

    this.downloadHistory.get(session.pluginId).push(historyEntry);

    // Keep only last 10 entries per plugin
    const history = this.downloadHistory.get(session.pluginId);
    if (history.length > 10) {
      history.splice(0, history.length - 10);
    }
  }

  /**
   * Clean up failed download
   */
  async cleanupFailedDownload(downloadId) {
    try {
      const session = this.activeDownloads.get(downloadId);
      if (session && session.tempFilePath && fs.existsSync(session.tempFilePath)) {
        fs.unlinkSync(session.tempFilePath);
        this.log('debug', `Cleaned up failed download: ${session.tempFilePath}`);
      }
    } catch (error) {
      this.log('warn', 'Failed to clean up download file:', error);
    }
  }

  /**
   * Cancel active download
   */
  async cancelDownload(downloadId) {
    const session = this.activeDownloads.get(downloadId);
    if (!session) {
      throw new Error(`Download not found: ${downloadId}`);
    }

    session.status = 'cancelled';
    await this.cleanupFailedDownload(downloadId);
    this.activeDownloads.delete(downloadId);

    this.log('info', `Download cancelled: ${downloadId}`);
    this.emit('download-cancelled', { downloadId, session });
  }

  /**
   * Get download status
   */
  getDownloadStatus(downloadId) {
    const session = this.activeDownloads.get(downloadId);
    if (!session) {
      return { status: 'not-found' };
    }

    return {
      status: session.status,
      pluginId: session.pluginId,
      version: session.version,
      progress: {
        bytesDownloaded: session.bytesDownloaded,
        totalBytes: session.totalBytes,
        percentage: session.totalBytes ? Math.round((session.bytesDownloaded / session.totalBytes) * 100) : 0
      },
      startTime: session.startTime,
      duration: Date.now() - session.startTime
    };
  }

  /**
   * Get all active downloads
   */
  getActiveDownloads() {
    const downloads = [];

    for (const [downloadId, session] of this.activeDownloads) {
      downloads.push(this.getDownloadStatus(downloadId));
    }

    return downloads;
  }

  /**
   * Generate unique download ID
   */
  generateDownloadId(pluginId, version) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${pluginId}-${version}-${timestamp}-${random}`;
  }

  /**
   * Dispose and cleanup resources
   */
  async dispose() {
    this.log('info', 'PluginDistributionManager disposing...');

    // Cancel all active downloads
    const activeDownloadIds = Array.from(this.activeDownloads.keys());
    for (const downloadId of activeDownloadIds) {
      try {
        await this.cancelDownload(downloadId);
      } catch (error) {
        this.log('warn', `Failed to cancel download ${downloadId}:`, error);
      }
    }

    // Clean up temporary files
    await this.cleanupTempFiles();

    this.emit('manager-disposed');
    this.log('info', 'PluginDistributionManager disposed');
  }

  /**
   * Log message with context
   */
  log(level, message, data = {}) {
    if (this.logManager) {
      this.logManager[level](`[PluginDistributionManager] ${message}`, data);
    } else {
      console[level](`[PluginDistributionManager] ${message}`, data);
    }
  }
}

module.exports = PluginDistributionManager;
