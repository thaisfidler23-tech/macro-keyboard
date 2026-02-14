/**
 * Hardware Security Module (HSM) Interface
 * 
 * Provides an abstraction layer for HSM communication and cryptographic operations.
 * Supports both hardware HSMs (PKCS#11) and software-based key management.
 * 
 * @module HSMInterface
 */

const EventEmitter = require('events');
const crypto = require('crypto');

class HSMInterface extends EventEmitter {
  constructor(logger, config = {}) {
    super();
    
    this.logger = logger;
    this.config = {
      type: config.type || 'software', // 'software', 'pkcs11', 'aws-cloudhsm', 'azure-keyvault'
      pkcs11Library: config.pkcs11Library || null,
      slotId: config.slotId || 0,
      pin: config.pin || null,
      keyStore: config.keyStore || new Map(),
      ...config
    };
    
    this.initialized = false;
    this.session = null;
    this.statistics = {
      operationsPerformed: 0,
      signingOperations: 0,
      encryptionOperations: 0,
      errors: 0
    };
  }

  /**
   * Initialize HSM connection
   */
  async initialize() {
    if (this.initialized) {
      return true;
    }

    try {
      this.logger?.info('Initializing HSM interface', { type: this.config.type });

      switch (this.config.type) {
        case 'software':
          await this._initializeSoftwareHSM();
          break;
        case 'pkcs11':
          await this._initializePKCS11();
          break;
        case 'aws-cloudhsm':
          await this._initializeAWSCloudHSM();
          break;
        case 'azure-keyvault':
          await this._initializeAzureKeyVault();
          break;
        default:
          throw new Error(`Unsupported HSM type: ${this.config.type}`);
      }

      this.initialized = true;
      this.emit('initialized', { type: this.config.type });
      return true;
    } catch (error) {
      this.statistics.errors++;
      this.logger?.error('HSM initialization failed', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Initialize software-based HSM (for development/testing)
   */
  async _initializeSoftwareHSM() {
    this.logger?.info('Using software HSM (development mode)');
    this.session = {
      type: 'software',
      id: crypto.randomUUID()
    };
  }

  /**
   * Initialize PKCS#11 HSM
   */
  async _initializePKCS11() {
    // TODO: Implement PKCS#11 initialization
    // This would use node-pkcs11 or similar library
    this.logger?.warn('PKCS#11 HSM not yet implemented, falling back to software');
    await this._initializeSoftwareHSM();
  }

  /**
   * Initialize AWS CloudHSM
   */
  async _initializeAWSCloudHSM() {
    // TODO: Implement AWS CloudHSM initialization
    this.logger?.warn('AWS CloudHSM not yet implemented, falling back to software');
    await this._initializeSoftwareHSM();
  }

  /**
   * Initialize Azure Key Vault HSM
   */
  async _initializeAzureKeyVault() {
    // TODO: Implement Azure Key Vault HSM initialization
    this.logger?.warn('Azure Key Vault HSM not yet implemented, falling back to software');
    await this._initializeSoftwareHSM();
  }

  /**
   * Generate a new key pair
   */
  async generateKeyPair(keyId, algorithm = 'RSA', options = {}) {
    this._ensureInitialized();

    try {
      const keySize = options.keySize || 2048;
      
      const { publicKey, privateKey } = crypto.generateKeyPairSync(algorithm.toLowerCase(), {
        modulusLength: keySize,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      });

      this.config.keyStore.set(keyId, {
        publicKey,
        privateKey,
        algorithm,
        createdAt: new Date().toISOString()
      });

      this.statistics.operationsPerformed++;
      this.emit('keyGenerated', { keyId, algorithm });
      
      return { keyId, publicKey };
    } catch (error) {
      this.statistics.errors++;
      throw error;
    }
  }

  /**
   * Sign data using stored key
   */
  async sign(keyId, data, algorithm = 'SHA256') {
    this._ensureInitialized();

    try {
      const keyPair = this.config.keyStore.get(keyId);
      if (!keyPair) {
        throw new Error(`Key not found: ${keyId}`);
      }

      const sign = crypto.createSign(algorithm);
      sign.update(data);
      const signature = sign.sign(keyPair.privateKey, 'base64');

      this.statistics.signingOperations++;
      this.statistics.operationsPerformed++;

      return signature;
    } catch (error) {
      this.statistics.errors++;
      throw error;
    }
  }

  /**
   * Verify signature
   */
  async verify(keyId, data, signature, algorithm = 'SHA256') {
    this._ensureInitialized();

    try {
      const keyPair = this.config.keyStore.get(keyId);
      if (!keyPair) {
        throw new Error(`Key not found: ${keyId}`);
      }

      const verify = crypto.createVerify(algorithm);
      verify.update(data);
      const isValid = verify.verify(keyPair.publicKey, signature, 'base64');

      this.statistics.operationsPerformed++;

      return isValid;
    } catch (error) {
      this.statistics.errors++;
      throw error;
    }
  }

  /**
   * Encrypt data
   */
  async encrypt(keyId, data) {
    this._ensureInitialized();

    try {
      const keyPair = this.config.keyStore.get(keyId);
      if (!keyPair) {
        throw new Error(`Key not found: ${keyId}`);
      }

      const encrypted = crypto.publicEncrypt(keyPair.publicKey, Buffer.from(data));

      this.statistics.encryptionOperations++;
      this.statistics.operationsPerformed++;

      return encrypted.toString('base64');
    } catch (error) {
      this.statistics.errors++;
      throw error;
    }
  }

  /**
   * Decrypt data
   */
  async decrypt(keyId, encryptedData) {
    this._ensureInitialized();

    try {
      const keyPair = this.config.keyStore.get(keyId);
      if (!keyPair) {
        throw new Error(`Key not found: ${keyId}`);
      }

      const decrypted = crypto.privateDecrypt(
        keyPair.privateKey,
        Buffer.from(encryptedData, 'base64')
      );

      this.statistics.encryptionOperations++;
      this.statistics.operationsPerformed++;

      return decrypted.toString();
    } catch (error) {
      this.statistics.errors++;
      throw error;
    }
  }

  /**
   * Get public key
   */
  async getPublicKey(keyId) {
    this._ensureInitialized();

    const keyPair = this.config.keyStore.get(keyId);
    if (!keyPair) {
      throw new Error(`Key not found: ${keyId}`);
    }

    return keyPair.publicKey;
  }

  /**
   * Delete key
   */
  async deleteKey(keyId) {
    this._ensureInitialized();

    if (!this.config.keyStore.has(keyId)) {
      throw new Error(`Key not found: ${keyId}`);
    }

    this.config.keyStore.delete(keyId);
    this.emit('keyDeleted', { keyId });
    return true;
  }

  /**
   * List all key IDs
   */
  async listKeys() {
    this._ensureInitialized();
    return Array.from(this.config.keyStore.keys());
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return { ...this.statistics };
  }

  /**
   * Close HSM session
   */
  async close() {
    if (!this.initialized) {
      return;
    }

    this.session = null;
    this.initialized = false;
    this.emit('closed');
    this.logger?.info('HSM interface closed');
  }

  /**
   * Ensure HSM is initialized
   */
  _ensureInitialized() {
    if (!this.initialized) {
      throw new Error('HSM not initialized. Call initialize() first.');
    }
  }
}

module.exports = HSMInterface;
