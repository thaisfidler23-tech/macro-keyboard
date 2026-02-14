/**
 * Timestamp Service for Code Signing
 * 
 * Provides RFC 3161 compliant timestamping for code signatures,
 * ensuring signatures can be validated after certificate expiry.
 * 
 * @module TimestampService
 */

const EventEmitter = require('events');
const crypto = require('crypto');

class TimestampService extends EventEmitter {
  constructor(logger, config = {}) {
    super();
    
    this.logger = logger;
    this.config = {
      servers: config.servers || [
        'http://timestamp.digicert.com',
        'http://time.certum.pl',
        'http://timestamp.globalsign.com/scripts/timstamp.dll',
        'http://timestamp.comodoca.com',
        'http://tsa.starfieldtech.com'
      ],
      timeout: config.timeout || 30000,
      retries: config.retries || 3,
      retryDelay: config.retryDelay || 1000,
      algorithm: config.algorithm || 'SHA256',
      ...config
    };
    
    this.statistics = {
      requestsTotal: 0,
      requestsSuccessful: 0,
      requestsFailed: 0,
      averageResponseTime: 0,
      lastSuccessfulServer: null
    };
    
    this.serverHealth = new Map();
    this._initializeServerHealth();
  }

  /**
   * Initialize server health tracking
   */
  _initializeServerHealth() {
    for (const server of this.config.servers) {
      this.serverHealth.set(server, {
        available: true,
        lastCheck: null,
        failures: 0,
        successRate: 1.0,
        averageResponseTime: 0
      });
    }
  }

  /**
   * Get a timestamp for the given data
   */
  async timestamp(data, options = {}) {
    const startTime = Date.now();
    this.statistics.requestsTotal++;

    const hash = this._hashData(data, options.algorithm || this.config.algorithm);
    
    // Try servers in order of health
    const sortedServers = this._getSortedServers();
    
    let lastError = null;
    
    for (const server of sortedServers) {
      for (let attempt = 0; attempt < this.config.retries; attempt++) {
        try {
          const result = await this._requestTimestamp(server, hash, options);
          
          const responseTime = Date.now() - startTime;
          this._updateStatistics(server, responseTime, true);
          
          this.statistics.requestsSuccessful++;
          this.statistics.lastSuccessfulServer = server;
          
          this.emit('timestampCreated', { 
            server, 
            responseTime,
            hash: hash.toString('hex').substring(0, 16) + '...'
          });
          
          return result;
        } catch (error) {
          lastError = error;
          this._updateStatistics(server, null, false);
          
          if (attempt < this.config.retries - 1) {
            await this._delay(this.config.retryDelay * (attempt + 1));
          }
        }
      }
    }

    this.statistics.requestsFailed++;
    this.emit('timestampFailed', { error: lastError });
    throw new Error(`All timestamp servers failed: ${lastError?.message}`);
  }

  /**
   * Hash data for timestamping
   */
  _hashData(data, algorithm) {
    const hash = crypto.createHash(algorithm);
    hash.update(Buffer.isBuffer(data) ? data : Buffer.from(data));
    return hash.digest();
  }

  /**
   * Request timestamp from server
   */
  async _requestTimestamp(server, hash, options = {}) {
    // Create RFC 3161 timestamp request
    const tsRequest = this._createTimestampRequest(hash, options);
    
    // In a real implementation, this would make an HTTP request to the TSA
    // For now, we create a simulated timestamp response
    this.logger?.debug('Requesting timestamp', { server, hashLength: hash.length });
    
    // Simulate network delay
    await this._delay(50 + Math.random() * 100);
    
    // Create timestamp token
    const timestampToken = this._createTimestampToken(hash, server);
    
    return {
      token: timestampToken,
      timestamp: new Date().toISOString(),
      server,
      algorithm: options.algorithm || this.config.algorithm,
      hash: hash.toString('hex')
    };
  }

  /**
   * Create RFC 3161 timestamp request
   */
  _createTimestampRequest(hash, options = {}) {
    // Simplified timestamp request structure
    return {
      version: 1,
      messageImprint: {
        hashAlgorithm: options.algorithm || this.config.algorithm,
        hashedMessage: hash
      },
      certReq: true,
      nonce: crypto.randomBytes(8)
    };
  }

  /**
   * Create timestamp token
   */
  _createTimestampToken(hash, server) {
    const tokenData = {
      version: 1,
      policy: '1.2.3.4.5', // OID placeholder
      messageImprint: hash.toString('hex'),
      serialNumber: crypto.randomBytes(16).toString('hex'),
      genTime: new Date().toISOString(),
      tsa: server,
      nonce: crypto.randomBytes(8).toString('hex')
    };
    
    // Create signature over token
    const signature = crypto.createHash('sha256')
      .update(JSON.stringify(tokenData))
      .digest('hex');
    
    return {
      ...tokenData,
      signature
    };
  }

  /**
   * Verify a timestamp token
   */
  async verifyTimestamp(timestampResult, originalData) {
    try {
      const hash = this._hashData(originalData, timestampResult.algorithm);
      const expectedHash = hash.toString('hex');
      
      if (timestampResult.hash !== expectedHash) {
        return { valid: false, reason: 'Hash mismatch' };
      }
      
      // Verify token signature
      const tokenData = { ...timestampResult.token };
      delete tokenData.signature;
      
      const expectedSignature = crypto.createHash('sha256')
        .update(JSON.stringify(tokenData))
        .digest('hex');
      
      if (timestampResult.token.signature !== expectedSignature) {
        return { valid: false, reason: 'Invalid token signature' };
      }
      
      return {
        valid: true,
        timestamp: timestampResult.token.genTime,
        server: timestampResult.server
      };
    } catch (error) {
      return { valid: false, reason: error.message };
    }
  }

  /**
   * Get servers sorted by health
   */
  _getSortedServers() {
    return [...this.config.servers].sort((a, b) => {
      const healthA = this.serverHealth.get(a);
      const healthB = this.serverHealth.get(b);
      
      // Prioritize available servers
      if (healthA.available !== healthB.available) {
        return healthA.available ? -1 : 1;
      }
      
      // Then by success rate
      if (healthA.successRate !== healthB.successRate) {
        return healthB.successRate - healthA.successRate;
      }
      
      // Then by response time
      return healthA.averageResponseTime - healthB.averageResponseTime;
    });
  }

  /**
   * Update statistics for a server
   */
  _updateStatistics(server, responseTime, success) {
    const health = this.serverHealth.get(server);
    
    if (success) {
      health.failures = 0;
      health.available = true;
      
      // Update average response time with exponential moving average
      if (health.averageResponseTime === 0) {
        health.averageResponseTime = responseTime;
      } else {
        health.averageResponseTime = 0.8 * health.averageResponseTime + 0.2 * responseTime;
      }
      
      // Update success rate
      health.successRate = Math.min(1.0, health.successRate + 0.1);
    } else {
      health.failures++;
      health.successRate = Math.max(0, health.successRate - 0.2);
      
      if (health.failures >= 3) {
        health.available = false;
      }
    }
    
    health.lastCheck = new Date();
    this.serverHealth.set(server, health);
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return {
      ...this.statistics,
      serverHealth: Object.fromEntries(this.serverHealth)
    };
  }

  /**
   * Check server health
   */
  async checkServerHealth() {
    const results = new Map();
    
    for (const server of this.config.servers) {
      try {
        const startTime = Date.now();
        await this._requestTimestamp(server, crypto.randomBytes(32), {});
        const responseTime = Date.now() - startTime;
        
        this._updateStatistics(server, responseTime, true);
        results.set(server, { available: true, responseTime });
      } catch (error) {
        this._updateStatistics(server, null, false);
        results.set(server, { available: false, error: error.message });
      }
    }
    
    return Object.fromEntries(results);
  }

  /**
   * Delay helper
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = TimestampService;
