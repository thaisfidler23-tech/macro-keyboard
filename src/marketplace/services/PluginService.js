/**
 * Plugin Service
 * 
 * Manages plugin metadata, discovery, and publishing for the marketplace.
 * 
 * @module PluginService
 */

const EventEmitter = require('events');

class PluginService extends EventEmitter {
  constructor(databaseManager, logger, config = {}) {
    super();
    
    this.db = databaseManager;
    this.logger = logger;
    this.config = {
      pageSize: config.pageSize || 20,
      maxPluginSize: config.maxPluginSize || 50 * 1024 * 1024, // 50MB
      allowedCategories: config.allowedCategories || [
        'productivity', 'automation', 'integration', 'utilities',
        'themes', 'development', 'media', 'communication'
      ],
      ...config
    };
    
    this.cache = new Map();
    this.cacheTimeout = config.cacheTimeout || 300000; // 5 minutes
  }

  /**
   * List plugins with filtering and pagination
   */
  async listPlugins(options = {}) {
    const {
      page = 1,
      pageSize = this.config.pageSize,
      category,
      search,
      sortBy = 'downloads',
      sortOrder = 'desc',
      author,
      verified
    } = options;

    try {
      // Build query (placeholder - would use actual DB queries)
      let plugins = await this._getPluginsFromCache() || [];
      
      // Apply filters
      if (category) {
        plugins = plugins.filter(p => p.category === category);
      }
      
      if (search) {
        const searchLower = search.toLowerCase();
        plugins = plugins.filter(p => 
          p.name.toLowerCase().includes(searchLower) ||
          p.description.toLowerCase().includes(searchLower)
        );
      }
      
      if (author) {
        plugins = plugins.filter(p => p.author === author);
      }
      
      if (verified !== undefined) {
        plugins = plugins.filter(p => p.verified === verified);
      }
      
      // Sort
      plugins.sort((a, b) => {
        const aVal = a[sortBy] || 0;
        const bVal = b[sortBy] || 0;
        return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
      });
      
      // Paginate
      const startIndex = (page - 1) * pageSize;
      const paginatedPlugins = plugins.slice(startIndex, startIndex + pageSize);
      
      return {
        plugins: paginatedPlugins,
        total: plugins.length,
        page,
        pageSize,
        totalPages: Math.ceil(plugins.length / pageSize)
      };
    } catch (error) {
      this.logger?.error('Failed to list plugins', error);
      throw error;
    }
  }

  /**
   * Get plugin by ID
   */
  async getPlugin(pluginId) {
    try {
      const cacheKey = `plugin:${pluginId}`;
      
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTimeout) {
          return cached.data;
        }
      }
      
      // Fetch from database (placeholder)
      const plugin = await this._fetchPluginFromDB(pluginId);
      
      if (plugin) {
        this.cache.set(cacheKey, { data: plugin, timestamp: Date.now() });
      }
      
      return plugin;
    } catch (error) {
      this.logger?.error('Failed to get plugin', { pluginId, error });
      throw error;
    }
  }

  /**
   * Create/publish a new plugin
   */
  async createPlugin(pluginData, authorId) {
    try {
      // Validate plugin data
      this._validatePluginData(pluginData);
      
      const plugin = {
        id: `plugin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...pluginData,
        author: authorId,
        authorName: pluginData.authorName || 'Unknown',
        version: pluginData.version || '1.0.0',
        downloads: 0,
        rating: 0,
        reviewCount: 0,
        verified: false,
        published: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Store in database (placeholder)
      await this._savePluginToDB(plugin);
      
      this.emit('pluginCreated', plugin);
      this.logger?.info('Plugin created', { id: plugin.id, name: plugin.name });
      
      return plugin;
    } catch (error) {
      this.logger?.error('Failed to create plugin', error);
      throw error;
    }
  }

  /**
   * Update plugin
   */
  async updatePlugin(pluginId, updates, authorId) {
    try {
      const plugin = await this.getPlugin(pluginId);
      
      if (!plugin) {
        throw new Error(`Plugin not found: ${pluginId}`);
      }
      
      if (plugin.author !== authorId) {
        throw new Error('Not authorized to update this plugin');
      }
      
      const updatedPlugin = {
        ...plugin,
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      // Don't allow changing certain fields
      delete updatedPlugin.id;
      delete updatedPlugin.author;
      delete updatedPlugin.downloads;
      delete updatedPlugin.createdAt;
      
      // Validate
      this._validatePluginData(updatedPlugin);
      
      // Store (placeholder)
      await this._savePluginToDB(updatedPlugin);
      
      // Clear cache
      this.cache.delete(`plugin:${pluginId}`);
      
      this.emit('pluginUpdated', updatedPlugin);
      
      return updatedPlugin;
    } catch (error) {
      this.logger?.error('Failed to update plugin', { pluginId, error });
      throw error;
    }
  }

  /**
   * Delete plugin
   */
  async deletePlugin(pluginId, authorId) {
    try {
      const plugin = await this.getPlugin(pluginId);
      
      if (!plugin) {
        throw new Error(`Plugin not found: ${pluginId}`);
      }
      
      if (plugin.author !== authorId) {
        throw new Error('Not authorized to delete this plugin');
      }
      
      // Delete from database (placeholder)
      await this._deletePluginFromDB(pluginId);
      
      // Clear cache
      this.cache.delete(`plugin:${pluginId}`);
      
      this.emit('pluginDeleted', { id: pluginId });
      this.logger?.info('Plugin deleted', { id: pluginId });
      
      return true;
    } catch (error) {
      this.logger?.error('Failed to delete plugin', { pluginId, error });
      throw error;
    }
  }

  /**
   * Increment download count
   */
  async incrementDownloads(pluginId) {
    try {
      const plugin = await this.getPlugin(pluginId);
      if (plugin) {
        plugin.downloads++;
        await this._savePluginToDB(plugin);
        this.cache.delete(`plugin:${pluginId}`);
      }
    } catch (error) {
      this.logger?.error('Failed to increment downloads', { pluginId, error });
    }
  }

  /**
   * Update plugin rating
   */
  async updateRating(pluginId, newRating, newReviewCount) {
    try {
      const plugin = await this.getPlugin(pluginId);
      if (plugin) {
        plugin.rating = newRating;
        plugin.reviewCount = newReviewCount;
        await this._savePluginToDB(plugin);
        this.cache.delete(`plugin:${pluginId}`);
      }
    } catch (error) {
      this.logger?.error('Failed to update rating', { pluginId, error });
    }
  }

  /**
   * Validate plugin data
   */
  _validatePluginData(data) {
    if (!data.name || data.name.length < 3) {
      throw new Error('Plugin name must be at least 3 characters');
    }
    
    if (!data.description || data.description.length < 10) {
      throw new Error('Plugin description must be at least 10 characters');
    }
    
    if (data.category && !this.config.allowedCategories.includes(data.category)) {
      throw new Error(`Invalid category: ${data.category}`);
    }
  }

  // Placeholder database methods
  async _getPluginsFromCache() {
    // Would fetch from database
    return [];
  }

  async _fetchPluginFromDB(pluginId) {
    // Would fetch from database
    return null;
  }

  async _savePluginToDB(plugin) {
    // Would save to database
  }

  async _deletePluginFromDB(pluginId) {
    // Would delete from database
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
}

module.exports = PluginService;
