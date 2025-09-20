const logger = require('../utils/logger');
const { createClient } = require('redis');

class UpdateAnalytics {
  constructor(database) {
    this.database = database;
    this.redis = null;
    this.metricsCache = new Map();
  }

  async initialize() {
    try {
      this.redis = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });
      
      await this.redis.connect();
      logger.info('Analytics Redis client connected');
      
    } catch (error) {
      logger.warn('Failed to connect Analytics Redis client:', error);
      // Continue without Redis caching
    }
  }

  async trackUpdateCheck(userId, currentVersion, platform, metadata = {}) {
    try {
      await this.database.logAnalyticsEvent(
        'update_check',
        userId,
        currentVersion,
        platform,
        {
          ...metadata,
          timestamp: new Date().toISOString(),
          userAgent: metadata.userAgent
        }
      );

      // Increment metrics counters
      await this.incrementMetric('update.check.total');
      await this.incrementMetric(`update.check.platform.${platform}`);
      
      if (metadata.channel) {
        await this.incrementMetric(`update.check.channel.${metadata.channel}`);
      }

    } catch (error) {
      logger.error('Failed to track update check:', error);
    }
  }

  async trackUpdateCheckError(userId, errorMessage) {
    try {
      await this.database.logAnalyticsEvent(
        'update_check_error',
        userId,
        null,
        null,
        {
          errorMessage,
          timestamp: new Date().toISOString()
        }
      );

      await this.incrementMetric('update.check.errors');

    } catch (error) {
      logger.error('Failed to track update check error:', error);
    }
  }

  async trackDownloadStart(userId, version, platform, metadata = {}) {
    try {
      await this.database.logAnalyticsEvent(
        'download_start',
        userId,
        version,
        platform,
        {
          ...metadata,
          timestamp: new Date().toISOString()
        }
      );

      // Create download record
      await this.database.query(`
        INSERT INTO update_downloads (user_id, version, platform, download_started_at)
        VALUES ($1, $2, $3, $4)
      `, [userId, version, platform, new Date()]);

      await this.incrementMetric('update.download.started');
      await this.incrementMetric(`update.download.version.${version}`);

    } catch (error) {
      logger.error('Failed to track download start:', error);
    }
  }

  async trackDownloadComplete(userId, version, platform, downloadMetrics = {}) {
    try {
      await this.database.logAnalyticsEvent(
        'download_complete',
        userId,
        version,
        platform,
        {
          ...downloadMetrics,
          timestamp: new Date().toISOString()
        }
      );

      // Update download record
      await this.database.query(`
        UPDATE update_downloads 
        SET download_completed_at = $1, 
            download_size = $2, 
            download_speed_bps = $3,
            success = true
        WHERE user_id = $4 AND version = $5 AND platform = $6 AND download_completed_at IS NULL
      `, [
        new Date(),
        downloadMetrics.downloadedBytes,
        downloadMetrics.speed,
        userId,
        version,
        platform
      ]);

      await this.incrementMetric('update.download.completed');
      
      // Track download speed
      if (downloadMetrics.speed) {
        await this.recordMetric('update.download.speed', downloadMetrics.speed);
      }

    } catch (error) {
      logger.error('Failed to track download complete:', error);
    }
  }

  async trackDownloadError(userId, version, platform, errorMessage) {
    try {
      await this.database.logAnalyticsEvent(
        'download_error',
        userId,
        version,
        platform,
        {
          errorMessage,
          timestamp: new Date().toISOString()
        }
      );

      // Update download record with error
      await this.database.query(`
        UPDATE update_downloads 
        SET success = false, 
            error_message = $1
        WHERE user_id = $2 AND version = $3 AND platform = $4 AND download_completed_at IS NULL
      `, [errorMessage, userId, version, platform]);

      await this.incrementMetric('update.download.errors');

    } catch (error) {
      logger.error('Failed to track download error:', error);
    }
  }

  async trackDownloadUnauthorized(userId, version) {
    try {
      await this.database.logAnalyticsEvent(
        'download_unauthorized',
        userId,
        version,
        null,
        {
          timestamp: new Date().toISOString()
        }
      );

      await this.incrementMetric('update.download.unauthorized');

    } catch (error) {
      logger.error('Failed to track download unauthorized:', error);
    }
  }

  async trackUpdateSuccess(userId, version, platform, installMetrics = {}) {
    try {
      await this.database.logAnalyticsEvent(
        'update_success',
        userId,
        version,
        platform,
        {
          ...installMetrics,
          timestamp: new Date().toISOString()
        }
      );

      await this.incrementMetric('update.install.success');
      
      if (installMetrics.installTime) {
        await this.recordMetric('update.install.duration', installMetrics.installTime);
      }

    } catch (error) {
      logger.error('Failed to track update success:', error);
    }
  }

  async trackUpdateFailure(userId, version, platform, errorMessage) {
    try {
      await this.database.logAnalyticsEvent(
        'update_failure',
        userId,
        version,
        platform,
        {
          errorMessage,
          timestamp: new Date().toISOString()
        }
      );

      await this.incrementMetric('update.install.failure');

    } catch (error) {
      logger.error('Failed to track update failure:', error);
    }
  }

  async trackCustomEvent(eventType, userId, version, platform, metadata = {}) {
    try {
      await this.database.logAnalyticsEvent(
        eventType,
        userId,
        version,
        platform,
        {
          ...metadata,
          timestamp: new Date().toISOString()
        }
      );

      await this.incrementMetric(`custom.${eventType}`);

    } catch (error) {
      logger.error('Failed to track custom event:', error);
    }
  }

  async generateRolloutReport(rolloutId, timeRange = '24h') {
    try {
      const hours = this.parseTimeRange(timeRange);
      const startTime = new Date(Date.now() - (hours * 60 * 60 * 1000));

      // Get rollout information
      const rolloutResult = await this.database.query(
        'SELECT * FROM rollouts WHERE id = $1',
        [rolloutId]
      );

      if (rolloutResult.rows.length === 0) {
        throw new Error('Rollout not found');
      }

      const rollout = rolloutResult.rows[0];

      // Get analytics events for this rollout
      const eventsResult = await this.database.query(`
        SELECT event_type, COUNT(*) as count, platform
        FROM analytics_events 
        WHERE version = $1 AND timestamp >= $2
        GROUP BY event_type, platform
        ORDER BY event_type, platform
      `, [rollout.version, startTime]);

      // Get download metrics
      const downloadMetrics = await this.database.query(`
        SELECT 
          COUNT(*) as total_downloads,
          COUNT(*) FILTER (WHERE success = true) as successful_downloads,
          COUNT(*) FILTER (WHERE success = false) as failed_downloads,
          AVG(download_speed_bps) as avg_download_speed,
          AVG(EXTRACT(EPOCH FROM (download_completed_at - download_started_at))) as avg_download_duration
        FROM update_downloads
        WHERE version = $1 AND download_started_at >= $2
      `, [rollout.version, startTime]);

      // Calculate metrics by event type
      const eventCounts = eventsResult.rows.reduce((acc, row) => {
        acc[row.event_type] = (acc[row.event_type] || 0) + parseInt(row.count);
        return acc;
      }, {});

      const downloadStats = downloadMetrics.rows[0] || {};

      // Calculate rollout health score
      const totalChecks = eventCounts.update_check || 0;
      const downloadStarts = eventCounts.download_start || 0;
      const downloadComplete = parseInt(downloadStats.successful_downloads || 0);
      const downloadFailed = parseInt(downloadStats.failed_downloads || 0);
      const updateSuccess = eventCounts.update_success || 0;
      const updateFailure = eventCounts.update_failure || 0;

      const conversionRate = totalChecks > 0 ? (downloadStarts / totalChecks) * 100 : 0;
      const downloadSuccessRate = downloadStarts > 0 ? (downloadComplete / downloadStarts) * 100 : 0;
      const installSuccessRate = downloadComplete > 0 ? (updateSuccess / downloadComplete) * 100 : 0;

      const rolloutHealth = this.calculateRolloutHealth({
        conversionRate,
        downloadSuccessRate,
        installSuccessRate,
        errorRate: (eventCounts.download_error + eventCounts.update_failure) / Math.max(downloadStarts, 1) * 100
      });

      const report = {
        rolloutId: rolloutId,
        version: rollout.version,
        channel: rollout.channel,
        rolloutPercentage: rollout.rollout_percentage,
        timeRange: timeRange,
        generatedAt: new Date().toISOString(),
        
        metrics: {
          totalUpdateChecks: totalChecks,
          totalDownloads: downloadStarts,
          successfulDownloads: downloadComplete,
          failedDownloads: downloadFailed,
          successfulUpdates: updateSuccess,
          failedUpdates: updateFailure,
          
          conversionRate: Math.round(conversionRate * 100) / 100,
          downloadSuccessRate: Math.round(downloadSuccessRate * 100) / 100,
          installSuccessRate: Math.round(installSuccessRate * 100) / 100,
          
          averageDownloadSpeed: downloadStats.avg_download_speed ? 
            Math.round(downloadStats.avg_download_speed) : null,
          averageDownloadDuration: downloadStats.avg_download_duration ?
            Math.round(downloadStats.avg_download_duration * 100) / 100 : null,
        },
        
        rolloutHealth: rolloutHealth,
        
        platformBreakdown: this.groupEventsByPlatform(eventsResult.rows),
        
        recommendations: this.generateRecommendations(rolloutHealth, {
          conversionRate,
          downloadSuccessRate,
          installSuccessRate
        })
      };

      logger.info('Generated rollout report', { rolloutId, version: rollout.version });
      
      return report;

    } catch (error) {
      logger.error('Failed to generate rollout report:', error);
      throw error;
    }
  }

  async incrementMetric(metricName, value = 1) {
    try {
      if (this.redis) {
        await this.redis.incrBy(metricName, value);
        await this.redis.expire(metricName, 86400); // Expire after 24 hours
      } else {
        // Fallback to in-memory cache
        this.metricsCache.set(metricName, (this.metricsCache.get(metricName) || 0) + value);
      }
    } catch (error) {
      logger.warn('Failed to increment metric:', error);
    }
  }

  async recordMetric(metricName, value) {
    try {
      const timestamp = Date.now();
      const key = `${metricName}:${timestamp}`;
      
      if (this.redis) {
        await this.redis.setEx(key, 3600, value.toString()); // Store for 1 hour
      }
    } catch (error) {
      logger.warn('Failed to record metric:', error);
    }
  }

  parseTimeRange(timeRange) {
    const match = timeRange.match(/(\d+)([hd])/);
    if (!match) return 24; // Default to 24 hours
    
    const [, value, unit] = match;
    const hours = unit === 'd' ? parseInt(value) * 24 : parseInt(value);
    return hours;
  }

  calculateRolloutHealth(metrics) {
    const { conversionRate, downloadSuccessRate, installSuccessRate, errorRate } = metrics;
    
    // Calculate weighted health score (0-100)
    let score = 0;
    let maxScore = 0;

    // Conversion rate (weight: 20)
    if (conversionRate >= 10) score += 20;
    else if (conversionRate >= 5) score += 15;
    else if (conversionRate >= 1) score += 10;
    maxScore += 20;

    // Download success rate (weight: 30)
    if (downloadSuccessRate >= 95) score += 30;
    else if (downloadSuccessRate >= 90) score += 25;
    else if (downloadSuccessRate >= 80) score += 20;
    else if (downloadSuccessRate >= 70) score += 15;
    maxScore += 30;

    // Install success rate (weight: 30)
    if (installSuccessRate >= 95) score += 30;
    else if (installSuccessRate >= 90) score += 25;
    else if (installSuccessRate >= 80) score += 20;
    else if (installSuccessRate >= 70) score += 15;
    maxScore += 30;

    // Error rate penalty (weight: 20)
    if (errorRate <= 1) score += 20;
    else if (errorRate <= 3) score += 15;
    else if (errorRate <= 5) score += 10;
    else if (errorRate <= 10) score += 5;
    maxScore += 20;

    const healthScore = maxScore > 0 ? (score / maxScore) * 100 : 0;
    
    let status = 'poor';
    if (healthScore >= 80) status = 'excellent';
    else if (healthScore >= 70) status = 'good';
    else if (healthScore >= 50) status = 'fair';

    return {
      score: Math.round(healthScore),
      status: status,
      metrics: metrics
    };
  }

  groupEventsByPlatform(events) {
    const platformData = {};
    
    events.forEach(event => {
      if (!event.platform) return;
      
      if (!platformData[event.platform]) {
        platformData[event.platform] = {};
      }
      
      platformData[event.platform][event.event_type] = parseInt(event.count);
    });
    
    return platformData;
  }

  generateRecommendations(rolloutHealth, metrics) {
    const recommendations = [];
    
    if (rolloutHealth.score < 50) {
      recommendations.push('Consider pausing rollout due to low health score');
    }
    
    if (metrics.conversionRate < 5) {
      recommendations.push('Low conversion rate - check update notifications and user experience');
    }
    
    if (metrics.downloadSuccessRate < 90) {
      recommendations.push('Download failures detected - check CDN performance and network issues');
    }
    
    if (metrics.installSuccessRate < 80) {
      recommendations.push('Install failures detected - review update package and compatibility');
    }
    
    if (rolloutHealth.score >= 80 && metrics.conversionRate >= 10) {
      recommendations.push('Rollout performing well - consider increasing rollout percentage');
    }
    
    return recommendations;
  }

  async cleanup() {
    if (this.redis) {
      await this.redis.quit();
    }
    this.metricsCache.clear();
  }
}

module.exports = UpdateAnalytics;