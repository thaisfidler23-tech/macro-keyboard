/**
 * Download Service
 * 
 * Manages plugin downloads, including file serving, rate limiting, and analytics.
 * 
 * @module DownloadService
 */

const EventEmitter = require('events');
const crypto = require('crypto');

class DownloadService extends EventEmitter {
  constructor(pluginService, logger, config = {}) {
    super();
    
    this.pluginService = pluginService;
    this.logger = logger;
    this.config = {
      storagePath: config.storagePath || './plugin-storage',
      cdnEnabled: config.cdnEnabled || false,
      cdnBaseUrl: config.cdnBaseUrl || null,
      downloadLimitPerHour: config.downloadLimitPerHour || 100,
      downloadLimitPerDay: config.downloadLimitPerDay || 1000,
      signedUrlExpiry: config.signedUrlExpiry || 3600, // 1 hour
      ...config
    };
    
    this.downloadCounts = new Map(); // Track downloads per IP
    this.activeDownloads = new Map();
    
    this.statistics = {
      totalDownloads: 0,
      uniqueDownloaders: new Set(),
      downloadsToday: 0,
      bytesServed: 0
    };
  }

  /**
   * Request a plugin download
   */
  async requestDownload(pluginId, userId, options = {}) {
    try {
      // Get plugin info
      const plugin = await this.pluginService.getPlugin(pluginId);
      
      if (!plugin) {
        throw new Error(`Plugin not found: ${pluginId}`);
      }
      
      if (!plugin.published) {
        throw new Error('Plugin is not available for download');
      }
      
      // Check rate limits
      const clientId = options.clientIp || userId;
      if (!this._checkRateLimit(clientId)) {
        throw new Error('Download rate limit exceeded');
      }
      
      // Generate download token
      const downloadToken = this._generateDownloadToken(pluginId, userId);
      
      // Track active download
      this.activeDownloads.set(downloadToken.id, {
        pluginId,
        userId,
        token: downloadToken,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      
      // Generate download URL
      const downloadUrl = this._generateDownloadUrl(plugin, downloadToken);
      
      this.emit('downloadRequested', { pluginId, userId });
      
      return {
        downloadId: downloadToken.id,
        downloadUrl,
        expiresAt: downloadToken.expiresAt,
        plugin: {
          id: plugin.id,
          name: plugin.name,
          version: plugin.version,
          size: plugin.size
        }
      };
    } catch (error) {
      this.logger?.error('Download request failed', { pluginId, error });
      throw error;
    }
  }

  /**
   * Complete a download
   */
  async completeDownload(downloadId, options = {}) {
    try {
      const download = this.activeDownloads.get(downloadId);
      
      if (!download) {
        throw new Error(`Download not found: ${downloadId}`);
      }
      
      // Verify token hasn't expired
      if (new Date() > new Date(download.token.expiresAt)) {
        this.activeDownloads.delete(downloadId);
        throw new Error('Download token expired');
      }
      
      // Mark download as complete
      download.status = 'completed';
      download.completedAt = new Date().toISOString();
      
      // Update statistics
      this.statistics.totalDownloads++;
      this.statistics.uniqueDownloaders.add(download.userId);
      this.statistics.downloadsToday++;
      
      if (options.bytesServed) {
        this.statistics.bytesServed += options.bytesServed;
      }
      
      // Increment plugin download count
      await this.pluginService.incrementDownloads(download.pluginId);
      
      // Track download
      this._trackDownload(download.userId);
      
      this.emit('downloadCompleted', {
        downloadId,
        pluginId: download.pluginId,
        userId: download.userId
      });
      
      // Clean up
      this.activeDownloads.delete(downloadId);
      
      return true;
    } catch (error) {
      this.logger?.error('Complete download failed', { downloadId, error });
      throw error;
    }
  }

  /**
   * Cancel a download
   */
  async cancelDownload(downloadId) {
    const download = this.activeDownloads.get(downloadId);
    
    if (download) {
      download.status = 'cancelled';
      this.activeDownloads.delete(downloadId);
      this.emit('downloadCancelled', { downloadId });
    }
    
    return true;
  }

  /**
   * Get download status
   */
  getDownloadStatus(downloadId) {
    const download = this.activeDownloads.get(downloadId);
    
    if (!download) {
      return null;
    }
    
    return {
      id: downloadId,
      status: download.status,
      pluginId: download.pluginId,
      createdAt: download.createdAt,
      expiresAt: download.token.expiresAt
    };
  }

  /**
   * Generate download token
   */
  _generateDownloadToken(pluginId, userId) {
    const id = crypto.randomBytes(16).toString('hex');
    const secret = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.config.signedUrlExpiry * 1000);
    
    // Create signature
    const payload = `${id}:${pluginId}:${userId}:${expiresAt.toISOString()}`;
    const signature = crypto.createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    return {
      id,
      signature,
      expiresAt: expiresAt.toISOString()
    };
  }

  /**
   * Generate download URL
   */
  _generateDownloadUrl(plugin, token) {
    if (this.config.cdnEnabled && this.config.cdnBaseUrl) {
      return `${this.config.cdnBaseUrl}/plugins/${plugin.id}/${plugin.version}?token=${token.id}&sig=${token.signature}`;
    }
    
    return `/api/v1/downloads/${plugin.id}?token=${token.id}&sig=${token.signature}`;
  }

  /**
   * Check rate limit
   */
  _checkRateLimit(clientId) {
    const now = Date.now();
    const hourAgo = now - 3600000;
    const dayAgo = now - 86400000;
    
    let counts = this.downloadCounts.get(clientId);
    
    if (!counts) {
      counts = [];
      this.downloadCounts.set(clientId, counts);
    }
    
    // Clean old entries
    counts = counts.filter(ts => ts > dayAgo);
    this.downloadCounts.set(clientId, counts);
    
    // Check hourly limit
    const downloadsLastHour = counts.filter(ts => ts > hourAgo).length;
    if (downloadsLastHour >= this.config.downloadLimitPerHour) {
      return false;
    }
    
    // Check daily limit
    if (counts.length >= this.config.downloadLimitPerDay) {
      return false;
    }
    
    return true;
  }

  /**
   * Track download
   */
  _trackDownload(clientId) {
    let counts = this.downloadCounts.get(clientId) || [];
    counts.push(Date.now());
    this.downloadCounts.set(clientId, counts);
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return {
      totalDownloads: this.statistics.totalDownloads,
      uniqueDownloaders: this.statistics.uniqueDownloaders.size,
      downloadsToday: this.statistics.downloadsToday,
      bytesServed: this.statistics.bytesServed,
      activeDownloads: this.activeDownloads.size
    };
  }

  /**
   * Reset daily statistics (call at midnight)
   */
  resetDailyStatistics() {
    this.statistics.downloadsToday = 0;
    this.downloadCounts.clear();
  }

  /**
   * Clean up expired downloads
   */
  cleanupExpiredDownloads() {
    const now = new Date();
    
    for (const [id, download] of this.activeDownloads) {
      if (new Date(download.token.expiresAt) < now) {
        this.activeDownloads.delete(id);
      }
    }
  }
}

module.exports = DownloadService;
