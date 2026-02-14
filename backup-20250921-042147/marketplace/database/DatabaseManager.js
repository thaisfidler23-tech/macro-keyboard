/**
 * Database Manager
 * Handles PostgreSQL connection, migrations, and query utilities
 */

const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

class DatabaseManager {
  constructor(config) {
    this.config = config;
    this.pool = null;
    this.isConnected = false;
    this.migrations = [];
  }

  /**
   * Connect to the database
   */
  async connect() {
    try {
      this.pool = new Pool({
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.username,
        password: this.config.password,
        ssl: this.config.ssl,
        ...this.config.pool
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      this.isConnected = true;
      console.log(`Connected to PostgreSQL database: ${this.config.database}`);
    } catch (error) {
      this.isConnected = false;
      throw new Error(`Failed to connect to database: ${error.message}`);
    }
  }

  /**
   * Disconnect from the database
   */
  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      console.log('Disconnected from PostgreSQL database');
    }
  }

  /**
   * Execute a query
   */
  async query(text, params = []) {
    if (!this.pool) {
      throw new Error('Database not connected');
    }

    try {
      const result = await this.pool.query(text, params);
      return result;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  /**
   * Get a client from the pool for transactions
   */
  async getClient() {
    if (!this.pool) {
      throw new Error('Database not connected');
    }
    return await this.pool.connect();
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction(callback) {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Run database migrations
   */
  async runMigrations() {
    try {
      // Create migrations table if it doesn't exist
      await this.query(`
        CREATE TABLE IF NOT EXISTS migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          executed_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Load migration files
      const migrationsDir = path.join(__dirname, 'migrations');
      const migrationFiles = await this.loadMigrationFiles(migrationsDir);

      // Get executed migrations
      const { rows: executedMigrations } = await this.query(
        'SELECT name FROM migrations ORDER BY id'
      );
      const executedNames = new Set(executedMigrations.map(m => m.name));

      // Execute pending migrations
      for (const migration of migrationFiles) {
        if (!executedNames.has(migration.name)) {
          console.log(`Running migration: ${migration.name}`);

          await this.transaction(async(client) => {
            await client.query(migration.sql);
            await client.query(
              'INSERT INTO migrations (name) VALUES ($1)',
              [migration.name]
            );
          });

          console.log(`Migration completed: ${migration.name}`);
        }
      }

      console.log('All migrations completed successfully');
    } catch (error) {
      console.error('Migration error:', error);
      throw error;
    }
  }

  /**
   * Load migration files from directory
   */
  async loadMigrationFiles(migrationsDir) {
    try {
      await fs.access(migrationsDir);
    } catch {
      // Create migrations directory and initial migration if it doesn't exist
      await fs.mkdir(migrationsDir, { recursive: true });
      await this.createInitialMigration(migrationsDir);
    }

    const files = await fs.readdir(migrationsDir);
    const migrations = [];

    for (const file of files.filter(f => f.endsWith('.sql')).sort()) {
      const filePath = path.join(migrationsDir, file);
      const sql = await fs.readFile(filePath, 'utf8');
      migrations.push({
        name: file.replace('.sql', ''),
        sql
      });
    }

    return migrations;
  }

  /**
   * Create initial database schema migration
   */
  async createInitialMigration(migrationsDir) {
    const initialMigration = `-- Initial database schema for plugin marketplace
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  is_admin BOOLEAN DEFAULT FALSE,
  reputation INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP,
  profile_data JSONB DEFAULT '{}'
);

-- Plugins table
CREATE TABLE IF NOT EXISTS plugins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  author_id UUID REFERENCES users(id) ON DELETE CASCADE,
  description TEXT,
  version VARCHAR(20) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'utility',
  tags TEXT[] DEFAULT '{}',
  download_url TEXT,
  homepage_url TEXT,
  repository_url TEXT,
  license VARCHAR(50) DEFAULT 'MIT',
  compatibility JSONB DEFAULT '{}',
  permissions TEXT[] DEFAULT '{}',
  file_size INTEGER DEFAULT 0,
  file_hash VARCHAR(64),
  download_count INTEGER DEFAULT 0,
  rating_average DECIMAL(3,2) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  manifest_data JSONB DEFAULT '{}'
);

-- Plugin versions table
CREATE TABLE IF NOT EXISTS plugin_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID REFERENCES plugins(id) ON DELETE CASCADE,
  version VARCHAR(20) NOT NULL,
  changelog TEXT,
  download_url TEXT,
  file_size INTEGER DEFAULT 0,
  file_hash VARCHAR(64),
  download_count INTEGER DEFAULT 0,
  is_current BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(plugin_id, version)
);

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID REFERENCES plugins(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  title VARCHAR(200),
  comment TEXT,
  is_approved BOOLEAN DEFAULT TRUE,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(plugin_id, user_id)
);

-- Download analytics table
CREATE TABLE IF NOT EXISTS download_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID REFERENCES plugins(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,
  country VARCHAR(2),
  referrer TEXT,
  downloaded_at TIMESTAMP DEFAULT NOW()
);

-- API keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  key_hash VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  permissions TEXT[] DEFAULT '{}',
  rate_limit INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Plugin categories table
CREATE TABLE IF NOT EXISTS plugin_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_plugins_author_id ON plugins(author_id);
CREATE INDEX IF NOT EXISTS idx_plugins_category ON plugins(category);
CREATE INDEX IF NOT EXISTS idx_plugins_is_published ON plugins(is_published);
CREATE INDEX IF NOT EXISTS idx_plugins_created_at ON plugins(created_at);
CREATE INDEX IF NOT EXISTS idx_plugins_download_count ON plugins(download_count);
CREATE INDEX IF NOT EXISTS idx_plugins_rating_average ON plugins(rating_average);
CREATE INDEX IF NOT EXISTS idx_plugins_tags ON plugins USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_plugin_versions_plugin_id ON plugin_versions(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_versions_is_current ON plugin_versions(is_current);

CREATE INDEX IF NOT EXISTS idx_reviews_plugin_id ON reviews(plugin_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);

CREATE INDEX IF NOT EXISTS idx_download_analytics_plugin_id ON download_analytics(plugin_id);
CREATE INDEX IF NOT EXISTS idx_download_analytics_downloaded_at ON download_analytics(downloaded_at);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_verified ON users(is_verified);

-- Full text search indexes
CREATE INDEX IF NOT EXISTS idx_plugins_search ON plugins USING GIN(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Insert default categories
INSERT INTO plugin_categories (name, description, icon, sort_order) VALUES
  ('productivity', 'Tools that enhance workflow and productivity', 'productivity', 1),
  ('automation', 'Plugins for automating repetitive tasks', 'automation', 2),
  ('communication', 'Email, messaging, and communication tools', 'communication', 3),
  ('entertainment', 'Games, media, and entertainment applications', 'entertainment', 4),
  ('development', 'Developer tools and utilities', 'development', 5),
  ('utility', 'General purpose utilities and tools', 'utility', 6),
  ('system', 'System administration and monitoring tools', 'system', 7),
  ('security', 'Security and privacy focused applications', 'security', 8)
ON CONFLICT (name) DO NOTHING;

-- Create update timestamp triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plugins_updated_at BEFORE UPDATE ON plugins
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to update plugin ratings
CREATE OR REPLACE FUNCTION update_plugin_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE plugins SET
        rating_average = (
            SELECT ROUND(AVG(rating)::numeric, 2)
            FROM reviews
            WHERE plugin_id = COALESCE(NEW.plugin_id, OLD.plugin_id) AND is_approved = TRUE
        ),
        rating_count = (
            SELECT COUNT(*)
            FROM reviews
            WHERE plugin_id = COALESCE(NEW.plugin_id, OLD.plugin_id) AND is_approved = TRUE
        )
    WHERE id = COALESCE(NEW.plugin_id, OLD.plugin_id);
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

CREATE TRIGGER update_plugin_rating_trigger
    AFTER INSERT OR UPDATE OR DELETE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_plugin_rating();
`;

    const migrationPath = path.join(migrationsDir, '001_initial_schema.sql');
    await fs.writeFile(migrationPath, initialMigration);
    console.log('Created initial migration file');
  }

  /**
   * Check if database is healthy
   */
  async healthCheck() {
    try {
      const { rows } = await this.query('SELECT NOW() as timestamp, version() as version');
      return {
        healthy: true,
        timestamp: rows[0].timestamp,
        version: rows[0].version,
        connection: 'active'
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        connection: 'failed'
      };
    }
  }

  /**
   * Get database statistics
   */
  async getStats() {
    try {
      const stats = {};

      // Get table counts
      const tables = ['users', 'plugins', 'plugin_versions', 'reviews', 'download_analytics'];
      for (const table of tables) {
        const { rows } = await this.query(`SELECT COUNT(*) as count FROM ${table}`);
        stats[table] = parseInt(rows[0].count, 10);
      }

      // Get database size
      const { rows: sizeRows } = await this.query(`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size
      `);
      stats.database_size = sizeRows[0].size;

      return stats;
    } catch (error) {
      throw new Error(`Failed to get database statistics: ${error.message}`);
    }
  }
}

module.exports = DatabaseManager;
