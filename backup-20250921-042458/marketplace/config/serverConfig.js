/**
 * Server Configuration
 * Default configuration and validation for the marketplace server
 */

const defaultConfig = {
  // Server configuration
  host: '127.0.0.1',
  port: 3001,
  environment: process.env.NODE_ENV || 'development',
  version: '1.0.0',
  development: process.env.NODE_ENV !== 'production',

  // Database configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'macro_keyboard_marketplace',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true',
    pool: {
      min: 2,
      max: 10,
      acquireTimeoutMillis: 30000,
      createTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      createRetryIntervalMillis: 200
    }
  },

  // Authentication configuration
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    jwtExpiresIn: '24h',
    bcryptRounds: 12,
    requireEmailVerification: true,
    allowRegistration: true,
    sessionTimeout: 24 * 60 * 60 * 1000 // 24 hours
  },

  // CORS configuration
  cors: {
    allowedOrigins: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',')
      : ['http://localhost:3000', 'http://127.0.0.1:3000']
  },

  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // Limit each IP to 100 requests per windowMs
  },

  // File upload configuration
  upload: {
    maxFileSize: '50mb',
    allowedTypes: ['.js', '.zip', '.tar.gz'],
    uploadPath: process.env.UPLOAD_PATH || './uploads',
    virusScan: false // Enable in production with ClamAV
  },

  // Plugin configuration
  plugins: {
    maxPluginsPerUser: 50,
    maxVersionsPerPlugin: 100,
    requireSignature: false,
    autoPublish: false,
    defaultCategory: 'utility',
    supportedCategories: [
      'productivity',
      'automation',
      'communication',
      'entertainment',
      'development',
      'utility',
      'system',
      'security'
    ]
  },

  // Download configuration
  downloads: {
    enableAnalytics: true,
    enableCDN: false,
    cdnUrl: process.env.CDN_URL,
    maxDownloadSize: '100mb',
    downloadTimeout: 30000 // 30 seconds
  },

  // Review configuration
  reviews: {
    enableReviews: true,
    maxReviewLength: 1000,
    enableModeration: true,
    requireVerifiedUser: false,
    allowAnonymousReviews: false
  },

  // Logging configuration
  logging: {
    enabled: true,
    format: process.env.NODE_ENV === 'production' ? 'combined' : 'dev',
    level: process.env.LOG_LEVEL || 'info'
  },

  // Email configuration (for notifications)
  email: {
    enabled: false,
    service: process.env.EMAIL_SERVICE || 'smtp',
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    from: process.env.EMAIL_FROM || 'noreply@macrokeyboard.com'
  },

  // Security configuration
  security: {
    enableCSP: true,
    enableHSTS: true,
    trustProxy: false,
    rateLimitSkipSuccessfulRequests: false
  },

  // Performance configuration
  performance: {
    enableCompression: true,
    compressionLevel: 6,
    enableETag: true,
    maxRequestSize: '50mb'
  }
};

/**
 * Validate server configuration
 */
function validateConfig(config) {
  const errors = [];

  // Required fields
  const required = [
    'host',
    'port',
    'database.host',
    'database.port',
    'database.database',
    'database.username',
    'auth.jwtSecret'
  ];

  for (const field of required) {
    const value = getNestedValue(config, field);
    if (value === undefined || value === null || value === '') {
      errors.push(`Required field '${field}' is missing or empty`);
    }
  }

  // Port validation
  if (config.port && (config.port < 1 || config.port > 65535)) {
    errors.push('Port must be between 1 and 65535');
  }

  if (config.database.port && (config.database.port < 1 || config.database.port > 65535)) {
    errors.push('Database port must be between 1 and 65535');
  }

  // JWT secret validation
  if (config.auth.jwtSecret && config.auth.jwtSecret.length < 32) {
    errors.push('JWT secret must be at least 32 characters long');
  }

  // Environment validation
  const validEnvironments = ['development', 'testing', 'staging', 'production'];
  if (config.environment && !validEnvironments.includes(config.environment)) {
    errors.push(`Environment must be one of: ${validEnvironments.join(', ')}`);
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }

  return config;
}

/**
 * Get nested object value by dot notation
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current && current[key], obj);
}

/**
 * Merge configuration with environment variables
 */
function mergeWithEnvironment(config) {
  const envConfig = { ...config };

  // Map environment variables to config
  const envMappings = {
    PORT: 'port',
    HOST: 'host',
    NODE_ENV: 'environment',
    DB_HOST: 'database.host',
    DB_PORT: 'database.port',
    DB_NAME: 'database.database',
    DB_USER: 'database.username',
    DB_PASSWORD: 'database.password',
    DB_SSL: 'database.ssl',
    JWT_SECRET: 'auth.jwtSecret',
    JWT_EXPIRES_IN: 'auth.jwtExpiresIn',
    UPLOAD_PATH: 'upload.uploadPath',
    CDN_URL: 'downloads.cdnUrl',
    EMAIL_SERVICE: 'email.service',
    EMAIL_HOST: 'email.host',
    EMAIL_PORT: 'email.port',
    EMAIL_USER: 'email.auth.user',
    EMAIL_PASS: 'email.auth.pass',
    EMAIL_FROM: 'email.from',
    LOG_LEVEL: 'logging.level'
  };

  for (const [envVar, configPath] of Object.entries(envMappings)) {
    const envValue = process.env[envVar];
    if (envValue !== undefined) {
      setNestedValue(envConfig, configPath, envValue);
    }
  }

  return envConfig;
}

/**
 * Set nested object value by dot notation
 */
function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  let current = obj;

  for (const key of keys) {
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }

  // Type conversion for specific fields
  if (path.includes('port') || path.includes('Port')) {
    value = parseInt(value, 10);
  } else if (value === 'true' || value === 'false') {
    value = value === 'true';
  }

  current[lastKey] = value;
}

module.exports = {
  defaultConfig: mergeWithEnvironment(defaultConfig),
  validateConfig,
  mergeWithEnvironment
};
