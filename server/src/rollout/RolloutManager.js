const { createClient } = require('redis');
const crypto = require('crypto');
const logger = require('../utils/logger');

class RolloutManager {
  constructor(database) {
    this.database = database;
    this.redis = null;
    this.isConnected = false;
  }

  async initialize() {
    try {
      this.redis = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        retry_unfulfilled_commands: true,
        socket: {
          reconnectStrategy: (retries) => Math.min(retries * 50, 500)
        }
      });

      this.redis.on('error', (error) => {
        logger.error('Redis error:', error);
      });

      this.redis.on('connect', () => {
        logger.info('Connected to Redis');
        this.isConnected = true;
      });

      this.redis.on('disconnect', () => {
        logger.warn('Disconnected from Redis');
        this.isConnected = false;
      });

      await this.redis.connect();
      
    } catch (error) {
      logger.error('Failed to initialize Redis:', error);
      throw error;
    }
  }

  async createRollout(config) {
    try {
      const rollout = {
        id: crypto.randomUUID(),
        version: config.version,
        channel: config.channel || 'stable',
        rolloutPercentage: config.startPercentage || 1,
        targetGroups: config.targetGroups || ['all'],
        abTestConfig: config.abTest || null,
        status: 'active',
        createdBy: config.createdBy || 'system',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Store in database
      const result = await this.database.query(`
        INSERT INTO rollouts (id, version, channel, rollout_percentage, target_groups, ab_test_config, status, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        rollout.id,
        rollout.version,
        rollout.channel,
        rollout.rolloutPercentage,
        JSON.stringify(rollout.targetGroups),
        rollout.abTestConfig ? JSON.stringify(rollout.abTestConfig) : null,
        rollout.status,
        rollout.createdBy
      ]);

      // Cache in Redis for fast lookups
      await this.cacheRollout(result.rows[0]);

      logger.info('Rollout created successfully', { rolloutId: rollout.id, version: rollout.version });
      
      return result.rows[0];

    } catch (error) {
      logger.error('Failed to create rollout:', error);
      throw error;
    }
  }

  async updateRollout(rolloutId, updates) {
    try {
      const setClause = [];
      const values = [];
      let paramIndex = 1;

      // Build dynamic UPDATE query
      if (updates.rolloutPercentage !== undefined) {
        setClause.push(`rollout_percentage = $${paramIndex++}`);
        values.push(updates.rolloutPercentage);
      }

      if (updates.targetGroups !== undefined) {
        setClause.push(`target_groups = $${paramIndex++}`);
        values.push(JSON.stringify(updates.targetGroups));
      }

      if (updates.status !== undefined) {
        setClause.push(`status = $${paramIndex++}`);
        values.push(updates.status);
      }

      if (updates.abTestConfig !== undefined) {
        setClause.push(`ab_test_config = $${paramIndex++}`);
        values.push(updates.abTestConfig ? JSON.stringify(updates.abTestConfig) : null);
      }

      if (setClause.length === 0) {
        throw new Error('No valid updates provided');
      }

      setClause.push(`updated_at = $${paramIndex++}`);
      values.push(new Date());
      values.push(rolloutId);

      const query = `
        UPDATE rollouts 
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await this.database.query(query, values);

      if (result.rows.length === 0) {
        return null;
      }

      // Update cache
      await this.cacheRollout(result.rows[0]);

      logger.info('Rollout updated successfully', { rolloutId, updates });

      return result.rows[0];

    } catch (error) {
      logger.error('Failed to update rollout:', error);
      throw error;
    }
  }

  async getUserGroup(userId) {
    try {
      // Create consistent user group assignment based on user ID hash
      const hash = crypto.createHash('sha256')
        .update(userId)
        .digest('hex');

      const hashValue = parseInt(hash.substring(0, 8), 16);
      const rolloutPercentage = hashValue % 100;

      // Determine experiment group (for A/B testing)
      const experimentGroup = this.getExperimentGroup(hashValue);

      const userGroup = {
        userId: userId,
        rolloutPercentage: rolloutPercentage,
        experimentGroup: experimentGroup,
        targetGroups: ['all'], // Default target groups
        metadata: {
          hashValue: hashValue,
          assignedAt: new Date().toISOString()
        }
      };

      logger.debug('User group assigned', { userId, rolloutPercentage, experimentGroup });

      return userGroup;

    } catch (error) {
      logger.error('Failed to get user group:', error);
      throw error;
    }
  }

  async isAuthorizedForUpdate(userId, version, userGroup) {
    try {
      if (!userGroup) {
        userGroup = await this.getUserGroup(userId);
      }

      // Get rollout configuration for version
      const rollout = await this.getRolloutForVersion(version);
      
      if (!rollout) {
        logger.debug('No rollout found for version', { version });
        return false;
      }

      // Check rollout status
      if (rollout.status !== 'active') {
        logger.debug('Rollout not active', { version, status: rollout.status });
        return false;
      }

      // Check rollout percentage
      if (userGroup.rolloutPercentage >= rollout.rollout_percentage) {
        logger.debug('User not in rollout percentage', {
          userId,
          userPercentage: userGroup.rolloutPercentage,
          rolloutPercentage: rollout.rollout_percentage
        });
        return false;
      }

      // Check target groups
      const targetGroups = Array.isArray(rollout.target_groups) ? 
        rollout.target_groups : 
        JSON.parse(rollout.target_groups || '["all"]');

      if (!this.isUserInTargetGroups(userGroup, targetGroups)) {
        logger.debug('User not in target groups', {
          userId,
          userGroups: userGroup.targetGroups,
          targetGroups
        });
        return false;
      }

      // Check A/B testing constraints
      if (rollout.ab_test_config && !this.isUserInABTestGroup(userGroup, rollout.ab_test_config)) {
        logger.debug('User not in A/B test group', { userId, version });
        return false;
      }

      logger.debug('User authorized for update', { userId, version });
      return true;

    } catch (error) {
      logger.error('Authorization check failed:', error);
      return false;
    }
  }

  async getRolloutForVersion(version, channel = 'stable') {
    try {
      // Try cache first
      const cacheKey = `rollout:${version}:${channel}`;
      const cached = await this.redis?.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      // Query database
      const result = await this.database.query(
        'SELECT * FROM rollouts WHERE version = $1 AND channel = $2 AND status = $3 ORDER BY created_at DESC LIMIT 1',
        [version, channel, 'active']
      );

      const rollout = result.rows[0] || null;
      
      // Cache result
      if (rollout) {
        await this.redis?.setEx(cacheKey, 300, JSON.stringify(rollout)); // 5 minute cache
      }

      return rollout;

    } catch (error) {
      logger.error('Failed to get rollout for version:', error);
      return null;
    }
  }

  async getActiveRollouts(channel = 'stable') {
    try {
      const result = await this.database.query(
        'SELECT * FROM rollouts WHERE channel = $1 AND status = $2 ORDER BY created_at DESC',
        [channel, 'active']
      );

      return result.rows;

    } catch (error) {
      logger.error('Failed to get active rollouts:', error);
      return [];
    }
  }

  async adjustRolloutPercentage(rolloutId, newPercentage) {
    try {
      if (newPercentage < 0 || newPercentage > 100) {
        throw new Error('Rollout percentage must be between 0 and 100');
      }

      const rollout = await this.updateRollout(rolloutId, {
        rolloutPercentage: newPercentage
      });

      if (rollout) {
        logger.info('Rollout percentage adjusted', {
          rolloutId,
          newPercentage,
          version: rollout.version
        });
      }

      return rollout;

    } catch (error) {
      logger.error('Failed to adjust rollout percentage:', error);
      throw error;
    }
  }

  async pauseRollout(rolloutId) {
    return this.updateRollout(rolloutId, { status: 'paused' });
  }

  async resumeRollout(rolloutId) {
    return this.updateRollout(rolloutId, { status: 'active' });
  }

  async stopRollout(rolloutId) {
    return this.updateRollout(rolloutId, { status: 'stopped' });
  }

  getExperimentGroup(hashValue) {
    // Simple A/B testing - assign users to groups based on hash
    const groups = ['control', 'experiment_a', 'experiment_b'];
    return groups[hashValue % groups.length];
  }

  isUserInTargetGroups(userGroup, targetGroups) {
    // Check if user matches any target group criteria
    if (targetGroups.includes('all')) {
      return true;
    }

    // Check if user's experiment group is in target groups
    if (targetGroups.includes(userGroup.experimentGroup)) {
      return true;
    }

    // Check user's target groups
    const userTargetGroups = userGroup.targetGroups || ['all'];
    return targetGroups.some(group => userTargetGroups.includes(group));
  }

  isUserInABTestGroup(userGroup, abTestConfig) {
    if (!abTestConfig || typeof abTestConfig === 'string') {
      abTestConfig = JSON.parse(abTestConfig || '{}');
    }

    if (!abTestConfig.enabled) {
      return true;
    }

    const allowedGroups = abTestConfig.groups || ['control', 'experiment_a'];
    return allowedGroups.includes(userGroup.experimentGroup);
  }

  async cacheRollout(rollout) {
    if (!this.redis) return;

    try {
      const cacheKey = `rollout:${rollout.version}:${rollout.channel}`;
      await this.redis.setEx(cacheKey, 300, JSON.stringify(rollout)); // 5 minute cache
    } catch (error) {
      logger.warn('Failed to cache rollout:', error);
    }
  }

  async healthCheck() {
    if (!this.redis) {
      throw new Error('Redis client not initialized');
    }

    await this.redis.ping();
    return true;
  }

  async cleanup() {
    if (this.redis) {
      await this.redis.quit();
      this.isConnected = false;
      logger.info('Redis connection closed');
    }
  }
}

module.exports = RolloutManager;