/**
 * Plugin Marketplace Backend Server
 *
 * Express.js server providing RESTful API for plugin marketplace functionality
 * including authentication, plugin management, downloads, and reviews.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const { EventEmitter } = require('events');

const AuthService = require('./services/AuthService');
const PluginService = require('./services/PluginService');
const DownloadService = require('./services/DownloadService');
const ReviewService = require('./services/ReviewService');
const DatabaseManager = require('./database/DatabaseManager');
const { validateConfig, defaultConfig } = require('./config/serverConfig');

class MarketplaceServer extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = validateConfig({ ...defaultConfig, ...config });
    this.app = express();
    this.server = null;

    // Service instances
    this.databaseManager = null;
    this.authService = null;
    this.pluginService = null;
    this.downloadService = null;
    this.reviewService = null;

    this.isStarted = false;
    this.startTime = null;

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Initialize middleware stack
   */
  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ['\'self\''],
          styleSrc: ['\'self\'', '\'unsafe-inline\''],
          scriptSrc: ['\'self\''],
          imgSrc: ['\'self\'', 'data:', 'https:']
        }
      }
    }));

    // CORS configuration
    this.app.use(cors({
      origin: this.config.cors.allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: this.config.rateLimit.windowMs,
      max: this.config.rateLimit.max,
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false
    });
    this.app.use('/api/', limiter);

    // Body parsing and compression
    this.app.use(compression());
    this.app.use(express.json({ limit: this.config.upload.maxFileSize }));
    this.app.use(express.urlencoded({ extended: true, limit: this.config.upload.maxFileSize }));

    // Logging
    if (this.config.logging.enabled) {
      this.app.use(morgan(this.config.logging.format));
    }

    // Request ID and timing
    this.app.use((req, res, next) => {
      req.id = require('crypto').randomUUID();
      req.startTime = Date.now();
      res.setHeader('X-Request-ID', req.id);
      next();
    });
  }

  /**
   * Setup API routes
   */
  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: this.isStarted ? Date.now() - this.startTime : 0,
        version: this.config.version,
        services: {
          database: this.databaseManager ? this.databaseManager.isConnected : false,
          auth: this.authService ? true : false,
          plugins: this.pluginService ? true : false,
          downloads: this.downloadService ? true : false,
          reviews: this.reviewService ? true : false
        }
      });
    });

    // API version info
    this.app.get('/api/v1', (req, res) => {
      res.json({
        version: '1.0.0',
        description: 'Macro Keyboard Plugin Marketplace API',
        endpoints: {
          auth: '/api/v1/auth',
          plugins: '/api/v1/plugins',
          search: '/api/v1/search',
          download: '/api/v1/download',
          reviews: '/api/v1/reviews',
          categories: '/api/v1/categories',
          trending: '/api/v1/trending',
          featured: '/api/v1/featured'
        },
        documentation: '/api/v1/docs',
        rateLimit: {
          windowMs: this.config.rateLimit.windowMs,
          max: this.config.rateLimit.max
        }
      });
    });

    // Service routes will be added after services are initialized
  }

  /**
   * Setup service routes after initialization
   */
  setupServiceRoutes() {
    // Authentication routes
    this.app.use('/api/v1/auth', this.authService.getRouter());

    // Plugin management routes
    this.app.use('/api/v1/plugins', this.pluginService.getRouter());
    this.app.use('/api/v1/search', this.pluginService.getSearchRouter());
    this.app.use('/api/v1/categories', this.pluginService.getCategoriesRouter());
    this.app.use('/api/v1/trending', this.pluginService.getTrendingRouter());
    this.app.use('/api/v1/featured', this.pluginService.getFeaturedRouter());

    // Download routes
    this.app.use('/api/v1/download', this.downloadService.getRouter());

    // Review routes
    this.app.use('/api/v1/reviews', this.reviewService.getRouter());
  }

  /**
   * Setup error handling middleware
   */
  setupErrorHandling() {
    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `The requested resource ${req.originalUrl} was not found`,
        timestamp: new Date().toISOString(),
        requestId: req.id
      });
    });

    // Global error handler
    this.app.use((err, req, res, next) => {
      const statusCode = err.statusCode || err.status || 500;
      const message = err.message || 'Internal Server Error';

      // Log error
      console.error(`[${new Date().toISOString()}] Error ${statusCode}: ${message}`, {
        requestId: req.id,
        url: req.url,
        method: req.method,
        stack: this.config.development ? err.stack : undefined
      });

      res.status(statusCode).json({
        error: statusCode >= 500 ? 'Internal Server Error' : message,
        message: this.config.development ? message : undefined,
        timestamp: new Date().toISOString(),
        requestId: req.id
      });
    });
  }

  /**
   * Initialize all services
   */
  async initialize() {
    try {
      // Initialize database
      this.databaseManager = new DatabaseManager(this.config.database);
      await this.databaseManager.connect();
      await this.databaseManager.runMigrations();

      // Initialize services
      this.authService = new AuthService(this.databaseManager, this.config.auth);
      this.pluginService = new PluginService(this.databaseManager, this.config.plugins);
      this.downloadService = new DownloadService(this.databaseManager, this.config.downloads);
      this.reviewService = new ReviewService(this.databaseManager, this.config.reviews);

      // Setup service routes
      this.setupServiceRoutes();

      this.emit('initialized');
      return true;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Start the server
   */
  async start(port = null) {
    try {
      if (!this.databaseManager) {
        await this.initialize();
      }

      const serverPort = port || this.config.port;

      return new Promise((resolve, reject) => {
        this.server = this.app.listen(serverPort, this.config.host, (error) => {
          if (error) {
            reject(error);
            return;
          }

          this.isStarted = true;
          this.startTime = Date.now();

          console.log(`Plugin Marketplace Server started on ${this.config.host}:${serverPort}`);
          console.log(`Environment: ${this.config.environment}`);
          console.log(`API Documentation: http://${this.config.host}:${serverPort}/api/v1`);

          this.emit('started', { host: this.config.host, port: serverPort });
          resolve({ host: this.config.host, port: serverPort });
        });
      });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop the server
   */
  async stop() {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close(async(error) => {
        if (error) {
          reject(error);
          return;
        }

        try {
          // Close database connections
          if (this.databaseManager) {
            await this.databaseManager.disconnect();
          }

          this.isStarted = false;
          this.startTime = null;

          console.log('Plugin Marketplace Server stopped');
          this.emit('stopped');
          resolve();
        } catch (dbError) {
          reject(dbError);
        }
      });
    });
  }

  /**
   * Get server status
   */
  getStatus() {
    return {
      isStarted: this.isStarted,
      uptime: this.isStarted ? Date.now() - this.startTime : 0,
      startTime: this.startTime,
      config: {
        host: this.config.host,
        port: this.config.port,
        environment: this.config.environment
      },
      services: {
        database: this.databaseManager ? this.databaseManager.isConnected : false,
        auth: !!this.authService,
        plugins: !!this.pluginService,
        downloads: !!this.downloadService,
        reviews: !!this.reviewService
      }
    };
  }
}

module.exports = MarketplaceServer;
