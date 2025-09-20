const { Pool } = require('pg');
const logger = require('../utils/logger');

class Database {
  constructor() {
    this.pool = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      this.pool = new Pool({
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'update_server',
        password: process.env.DB_PASSWORD || 'password',
        port: process.env.DB_PORT || 5432,
        max: 20, // Maximum number of connections
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      this.isConnected = true;
      logger.info('Database connected successfully');
      
      // Create tables if they don't exist
      await this.initializeTables();
      
    } catch (error) {
      logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      logger.info('Database disconnected');
    }
  }

  async query(text, params) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }
    
    try {
      const start = Date.now();
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      logger.debug('Executed query', { 
        text: text.substring(0, 100) + '...', 
        duration, 
        rows: result.rowCount 
      });
      
      return result;
    } catch (error) {
      logger.error('Database query failed:', { text, params, error: error.message });
      throw error;
    }
  }

  async initializeTables() {
    const createTablesSQL = `
      -- Updates table
      CREATE TABLE IF NOT EXISTS updates (
        id SERIAL PRIMARY KEY,
        version VARCHAR(50) NOT NULL UNIQUE,
        platform VARCHAR(20) NOT NULL,
        channel VARCHAR(20) NOT NULL DEFAULT 'stable',
        file_path VARCHAR(500) NOT NULL,
        file_size BIGINT NOT NULL,
        checksum_sha256 VARCHAR(64) NOT NULL,
        signature TEXT,
        changelog TEXT,
        required BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        published_at TIMESTAMP,
        status VARCHAR(20) DEFAULT 'draft'
      );

      -- Rollouts table
      CREATE TABLE IF NOT EXISTS rollouts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        version VARCHAR(50) NOT NULL,
        channel VARCHAR(20) NOT NULL,
        rollout_percentage INTEGER DEFAULT 1,
        target_groups JSONB DEFAULT '["all"]',
        ab_test_config JSONB,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(100),
        FOREIGN KEY (version) REFERENCES updates(version)
      );

      -- User groups table
      CREATE TABLE IF NOT EXISTS user_groups (
        user_id VARCHAR(100) PRIMARY KEY,
        rollout_percentage INTEGER NOT NULL,
        experiment_group VARCHAR(50),
        target_groups JSONB DEFAULT '["all"]',
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Analytics events table
      CREATE TABLE IF NOT EXISTS analytics_events (
        id SERIAL PRIMARY KEY,
        event_type VARCHAR(50) NOT NULL,
        user_id VARCHAR(100),
        version VARCHAR(50),
        platform VARCHAR(20),
        metadata JSONB,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Update downloads table
      CREATE TABLE IF NOT EXISTS update_downloads (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        version VARCHAR(50) NOT NULL,
        platform VARCHAR(20),
        download_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        download_completed_at TIMESTAMP,
        download_size BIGINT,
        download_speed_bps BIGINT,
        success BOOLEAN,
        error_message TEXT
      );

      -- Rollout metrics table
      CREATE TABLE IF NOT EXISTS rollout_metrics (
        id SERIAL PRIMARY KEY,
        rollout_id UUID NOT NULL,
        metric_name VARCHAR(100) NOT NULL,
        metric_value DECIMAL,
        metadata JSONB,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (rollout_id) REFERENCES rollouts(id)
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_updates_version ON updates(version);
      CREATE INDEX IF NOT EXISTS idx_updates_platform ON updates(platform);
      CREATE INDEX IF NOT EXISTS idx_updates_channel ON updates(channel);
      CREATE INDEX IF NOT EXISTS idx_rollouts_version ON rollouts(version);
      CREATE INDEX IF NOT EXISTS idx_rollouts_status ON rollouts(status);
      CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON analytics_events(user_id);
      CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics_events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_update_downloads_user ON update_downloads(user_id);
      CREATE INDEX IF NOT EXISTS idx_rollout_metrics_rollout ON rollout_metrics(rollout_id);
      CREATE INDEX IF NOT EXISTS idx_rollout_metrics_timestamp ON rollout_metrics(timestamp);
    `;

    try {
      await this.query(createTablesSQL);
      logger.info('Database tables initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database tables:', error);
      throw error;
    }
  }

  // Helper methods for common queries
  async getUpdate(version, platform, channel = 'stable') {
    const result = await this.query(
      'SELECT * FROM updates WHERE version = $1 AND platform = $2 AND channel = $3 AND status = $4',
      [version, platform, channel, 'published']
    );
    return result.rows[0];
  }

  async getLatestUpdate(platform, channel = 'stable') {
    const result = await this.query(
      'SELECT * FROM updates WHERE platform = $1 AND channel = $2 AND status = $3 ORDER BY created_at DESC LIMIT 1',
      [platform, channel, 'published']
    );
    return result.rows[0];
  }

  async createUpdate(updateData) {
    const {
      version, platform, channel, filePath, fileSize, 
      checksumSha256, signature, changelog, required
    } = updateData;

    const result = await this.query(`
      INSERT INTO updates (version, platform, channel, file_path, file_size, checksum_sha256, signature, changelog, required)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [version, platform, channel, filePath, fileSize, checksumSha256, signature, changelog, required]);

    return result.rows[0];
  }

  async logAnalyticsEvent(eventType, userId, version, platform, metadata = {}) {
    await this.query(`
      INSERT INTO analytics_events (event_type, user_id, version, platform, metadata)
      VALUES ($1, $2, $3, $4, $5)
    `, [eventType, userId, version, platform, JSON.stringify(metadata)]);
  }

  async getUserGroup(userId) {
    const result = await this.query(
      'SELECT * FROM user_groups WHERE user_id = $1',
      [userId]
    );
    return result.rows[0];
  }

  async createOrUpdateUserGroup(userId, groupData) {
    const {
      rolloutPercentage, experimentGroup, targetGroups, metadata
    } = groupData;

    const result = await this.query(`
      INSERT INTO user_groups (user_id, rollout_percentage, experiment_group, target_groups, metadata)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        rollout_percentage = EXCLUDED.rollout_percentage,
        experiment_group = EXCLUDED.experiment_group,
        target_groups = EXCLUDED.target_groups,
        metadata = EXCLUDED.metadata,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [userId, rolloutPercentage, experimentGroup, JSON.stringify(targetGroups), JSON.stringify(metadata)]);

    return result.rows[0];
  }
}

module.exports = Database;