const express = require('express');
const crypto = require('crypto');
const semver = require('semver');
const logger = require('../utils/logger');
const FileStorage = require('../storage/FileStorage');

class UpdateAPIServer {
  constructor(database, rolloutManager, analytics) {
    this.database = database;
    this.rolloutManager = rolloutManager;
    this.analytics = analytics;
    this.fileStorage = new FileStorage();
    this.router = express.Router();
    
    this.setupRoutes();
  }

  setupRoutes() {
    // Check for updates endpoint
    this.router.get('/updates/check', this.handleUpdateCheck.bind(this));
    
    // Download update package endpoint
    this.router.get('/updates/download/:version', this.handleUpdateDownload.bind(this));
    
    // Get rollout configuration endpoint
    this.router.get('/rollouts/:channel', this.handleGetRollout.bind(this));
    
    // Update analytics endpoint
    this.router.post('/analytics', this.handleAnalytics.bind(this));
    
    // Admin endpoints (protected)
    this.router.post('/admin/rollouts', this.handleCreateRollout.bind(this));
    this.router.put('/admin/rollouts/:id', this.handleUpdateRollout.bind(this));
    this.router.get('/admin/rollouts/:id/metrics', this.handleGetRolloutMetrics.bind(this));
    
    // Health check for updates service
    this.router.get('/health', this.handleHealthCheck.bind(this));
  }

  async handleUpdateCheck(req, res) {
    try {
      const { version, platform, channel = 'stable', userId } = req.query;
      
      // Validate required parameters
      if (!version || !platform || !userId) {
        return res.status(400).json({
          error: 'Missing required parameters: version, platform, userId'
        });
      }

      // Validate version format
      if (!semver.valid(version)) {
        return res.status(400).json({
          error: 'Invalid version format'
        });
      }

      logger.info('Update check request', { version, platform, channel, userId });

      // Get or create user group assignment
      let userGroup = await this.database.getUserGroup(userId);
      if (!userGroup) {
        userGroup = await this.rolloutManager.getUserGroup(userId);
        await this.database.createOrUpdateUserGroup(userId, userGroup);
      }

      // Find available update
      const availableUpdate = await this.findAvailableUpdate({
        currentVersion: version,
        platform: platform,
        channel: channel,
        userGroup: userGroup
      });

      // Log analytics event
      await this.analytics.trackUpdateCheck(userId, version, platform, {
        channel,
        hasUpdate: !!availableUpdate,
        userGroup: userGroup.experimentGroup
      });

      if (availableUpdate) {
        res.json({
          hasUpdate: true,
          version: availableUpdate.version,
          downloadUrl: `/api/updates/download/${availableUpdate.version}`,
          changelog: availableUpdate.changelog,
          required: availableUpdate.required,
          fileSize: availableUpdate.file_size,
          checksum: availableUpdate.checksum_sha256,
          signature: availableUpdate.signature,
          rolloutInfo: {
            group: userGroup.experimentGroup,
            percentage: userGroup.rolloutPercentage
          }
        });
      } else {
        res.json({ 
          hasUpdate: false,
          currentVersion: version,
          channel: channel
        });
      }

    } catch (error) {
      logger.error('Update check failed:', error);
      await this.analytics.trackUpdateCheckError(req.query.userId, error.message);
      res.status(500).json({ error: 'Update check failed' });
    }
  }

  async handleUpdateDownload(req, res) {
    try {
      const { version } = req.params;
      const { userId, platform } = req.query;

      if (!userId || !platform) {
        return res.status(400).json({
          error: 'Missing required parameters: userId, platform'
        });
      }

      logger.info('Update download request', { version, userId, platform });

      // Get update information
      const update = await this.database.getUpdate(version, platform);
      if (!update) {
        return res.status(404).json({ error: 'Update not found' });
      }

      // Verify user is authorized for this update
      const userGroup = await this.database.getUserGroup(userId);
      const authorized = await this.rolloutManager.isAuthorizedForUpdate(
        userId, version, userGroup
      );

      if (!authorized) {
        await this.analytics.trackDownloadUnauthorized(userId, version);
        return res.status(403).json({ error: 'Update not available for user' });
      }

      // Track download initiation
      await this.analytics.trackDownloadStart(userId, version, platform);

      // Set response headers for file download
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Length', update.file_size);
      res.setHeader('X-Checksum-SHA256', update.checksum_sha256);
      res.setHeader('X-Signature', update.signature);
      res.setHeader('Content-Disposition', `attachment; filename="update-${version}-${platform}"`);

      // Stream file from storage
      const fileStream = await this.fileStorage.getFileStream(update.file_path);
      
      // Track download progress
      let downloadedBytes = 0;
      const startTime = Date.now();
      
      fileStream.on('data', (chunk) => {
        downloadedBytes += chunk.length;
      });
      
      fileStream.on('end', async () => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        const speed = downloadedBytes / (duration / 1000); // bytes per second
        
        await this.analytics.trackDownloadComplete(userId, version, platform, {
          downloadedBytes,
          duration,
          speed
        });
      });

      fileStream.on('error', async (error) => {
        logger.error('File stream error:', error);
        await this.analytics.trackDownloadError(userId, version, platform, error.message);
      });

      fileStream.pipe(res);

    } catch (error) {
      logger.error('Update download failed:', error);
      await this.analytics.trackDownloadError(req.query.userId, req.params.version, req.query.platform, error.message);
      res.status(500).json({ error: 'Download failed' });
    }
  }

  async handleGetRollout(req, res) {
    try {
      const { channel } = req.params;
      const rollouts = await this.rolloutManager.getActiveRollouts(channel);
      
      res.json({
        channel,
        rollouts: rollouts.map(rollout => ({
          id: rollout.id,
          version: rollout.version,
          rolloutPercentage: rollout.rollout_percentage,
          targetGroups: rollout.target_groups,
          status: rollout.status,
          createdAt: rollout.created_at
        }))
      });

    } catch (error) {
      logger.error('Get rollout failed:', error);
      res.status(500).json({ error: 'Failed to get rollout information' });
    }
  }

  async handleAnalytics(req, res) {
    try {
      const { eventType, userId, version, platform, metadata } = req.body;
      
      if (!eventType || !userId) {
        return res.status(400).json({
          error: 'Missing required parameters: eventType, userId'
        });
      }

      await this.analytics.trackCustomEvent(eventType, userId, version, platform, metadata);
      
      res.json({ success: true });

    } catch (error) {
      logger.error('Analytics tracking failed:', error);
      res.status(500).json({ error: 'Failed to track analytics event' });
    }
  }

  async handleCreateRollout(req, res) {
    try {
      // TODO: Add authentication/authorization middleware
      const rolloutConfig = req.body;
      const rollout = await this.rolloutManager.createRollout(rolloutConfig);
      
      res.status(201).json(rollout);

    } catch (error) {
      logger.error('Create rollout failed:', error);
      res.status(500).json({ error: 'Failed to create rollout' });
    }
  }

  async handleUpdateRollout(req, res) {
    try {
      // TODO: Add authentication/authorization middleware
      const { id } = req.params;
      const updates = req.body;
      
      const rollout = await this.rolloutManager.updateRollout(id, updates);
      
      if (rollout) {
        res.json(rollout);
      } else {
        res.status(404).json({ error: 'Rollout not found' });
      }

    } catch (error) {
      logger.error('Update rollout failed:', error);
      res.status(500).json({ error: 'Failed to update rollout' });
    }
  }

  async handleGetRolloutMetrics(req, res) {
    try {
      const { id } = req.params;
      const metrics = await this.analytics.generateRolloutReport(id);
      
      res.json(metrics);

    } catch (error) {
      logger.error('Get rollout metrics failed:', error);
      res.status(500).json({ error: 'Failed to get rollout metrics' });
    }
  }

  async handleHealthCheck(req, res) {
    try {
      // Check database connectivity
      await this.database.query('SELECT 1');
      
      // Check Redis connectivity
      await this.rolloutManager.healthCheck();
      
      // Check file storage connectivity
      await this.fileStorage.healthCheck();
      
      res.json({
        status: 'healthy',
        services: {
          database: 'healthy',
          redis: 'healthy',
          fileStorage: 'healthy'
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Health check failed:', error);
      res.status(503).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async findAvailableUpdate({ currentVersion, platform, channel, userGroup }) {
    try {
      // Get latest published update for platform/channel
      const latestUpdate = await this.database.getLatestUpdate(platform, channel);
      
      if (!latestUpdate) {
        return null;
      }

      // Check if there's a newer version available
      if (!semver.gt(latestUpdate.version, currentVersion)) {
        return null;
      }

      // Check if user is eligible for this rollout
      const rollout = await this.rolloutManager.getRolloutForVersion(latestUpdate.version, channel);
      
      if (!rollout) {
        return null;
      }

      const authorized = await this.rolloutManager.isAuthorizedForUpdate(
        userGroup.user_id, latestUpdate.version, userGroup
      );

      return authorized ? latestUpdate : null;

    } catch (error) {
      logger.error('Error finding available update:', error);
      return null;
    }
  }

  getRouter() {
    return this.router;
  }
}

module.exports = UpdateAPIServer;