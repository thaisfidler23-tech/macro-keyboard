const { exec, spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const util = require('util');
const crypto = require('crypto');

const execAsync = util.promisify(exec);

/**
 * Linux package and binary signing implementation
 * Uses GPG for package signing and OpenSSL for binary verification
 */
class LinuxSigner {
  constructor(logger, config = {}) {
    this.logger = logger;
    this.config = {
      gpgPath: config.gpgPath || '/usr/bin/gpg',
      opensslPath: config.opensslPath || '/usr/bin/openssl',
      defaultKeyId: config.defaultKeyId,
      keyringPath: config.keyringPath,
      signBinaries: config.signBinaries !== false,
      supportedExtensions: config.supportedExtensions || ['.deb', '.rpm', '.tar.gz', '.tar.xz', '.AppImage'],
      ...config
    };

    this.supportedFormats = ['.deb', '.rpm', '.tar.gz', '.tar.xz', '.AppImage', '.snap'];
    this.supportedCertificateTypes = ['GPG Key', 'X.509 Certificate', 'SSH Key'];
    this.supportedAlgorithms = ['SHA256', 'SHA512'];

    this.logger.info('LinuxSigner initialized for Linux package and binary signing');
  }

  /**
   * Sign a Linux package or binary
   */
  async sign(filePath, certificate, options = {}) {
    try {
      const fileExtension = path.extname(filePath).toLowerCase();
      const fileName = path.basename(filePath);
      
      this.logger.info(`Signing Linux file: ${filePath}`);

      let signedPath;
      
      // Choose signing method based on file type and certificate type
      if (certificate.type === 'gpg') {
        signedPath = await this.signWithGPG(filePath, certificate, options);
      } else if (certificate.type === 'x509') {
        signedPath = await this.signWithX509(filePath, certificate, options);
      } else {
        throw new Error(`Unsupported certificate type for Linux signing: ${certificate.type}`);
      }

      this.logger.info(`Successfully signed: ${signedPath}`);
      return signedPath;
      
    } catch (error) {
      this.logger.error(`Linux signing failed for ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Sign with GPG key
   */
  async signWithGPG(filePath, certificate, options) {
    const signatureType = options.signatureType || 'detached';
    let signedPath;

    if (signatureType === 'detached') {
      // Create detached signature
      signedPath = `${filePath}.sig`;
      await this.createDetachedSignature(filePath, signedPath, certificate, options);
    } else if (signatureType === 'cleartext') {
      // Create cleartext signature
      signedPath = `${filePath}.asc`;
      await this.createCleartextSignature(filePath, signedPath, certificate, options);
    } else {
      throw new Error(`Unsupported GPG signature type: ${signatureType}`);
    }

    return signedPath;
  }

  /**
   * Create detached GPG signature
   */
  async createDetachedSignature(filePath, signaturePath, certificate, options) {
    const command = [this.config.gpgPath];

    // Add keyring if specified
    if (certificate.keyring) {
      command.push('--keyring', certificate.keyring);
    }

    // Add key ID if specified
    if (certificate.keyId || this.config.defaultKeyId) {
      command.push('--default-key', certificate.keyId || this.config.defaultKeyId);
    }

    // Signature options
    command.push('--armor'); // ASCII armored output
    command.push('--detach-sign');
    command.push('--digest-algo', options.algorithm || 'SHA256');

    // Output file
    command.push('--output', signaturePath);

    // Input file
    command.push(filePath);

    const result = await this.executeCommand(command);

    if (result.exitCode !== 0) {
      throw new Error(`GPG detached signing failed (exit code ${result.exitCode}): ${result.stderr}`);
    }

    this.logger.debug(`Created detached signature: ${signaturePath}`);
  }

  /**
   * Create cleartext GPG signature
   */
  async createCleartextSignature(filePath, signaturePath, certificate, options) {
    const command = [this.config.gpgPath];

    // Add keyring if specified
    if (certificate.keyring) {
      command.push('--keyring', certificate.keyring);
    }

    // Add key ID if specified
    if (certificate.keyId || this.config.defaultKeyId) {
      command.push('--default-key', certificate.keyId || this.config.defaultKeyId);
    }

    // Cleartext signature
    command.push('--clearsign');
    command.push('--digest-algo', options.algorithm || 'SHA256');

    // Output file
    command.push('--output', signaturePath);

    // Input file
    command.push(filePath);

    const result = await this.executeCommand(command);

    if (result.exitCode !== 0) {
      throw new Error(`GPG cleartext signing failed (exit code ${result.exitCode}): ${result.stderr}`);
    }

    this.logger.debug(`Created cleartext signature: ${signaturePath}`);
  }

  /**
   * Sign with X.509 certificate
   */
  async signWithX509(filePath, certificate, options) {
    const signedPath = `${filePath}.p7s`;
    
    // Create PKCS#7 signature
    const command = [
      this.config.opensslPath, 'smime',
      '-sign',
      '-in', filePath,
      '-out', signedPath,
      '-signer', certificate.certPath,
      '-inkey', certificate.keyPath,
      '-outform', 'DER',
      '-binary'
    ];

    // Add passphrase if provided
    if (certificate.passphrase) {
      command.push('-passin', `pass:${certificate.passphrase}`);
    }

    const result = await this.executeCommand(command);

    if (result.exitCode !== 0) {
      throw new Error(`X.509 signing failed (exit code ${result.exitCode}): ${result.stderr}`);
    }

    return signedPath;
  }

  /**
   * Verify Linux signature
   */
  async verify(filePath, options = {}) {
    try {
      this.logger.debug(`Verifying Linux signature: ${filePath}`);

      // Determine signature type based on file extension or options
      const signatureType = this.detectSignatureType(filePath, options);
      
      let verificationResult;

      if (signatureType === 'gpg') {
        verificationResult = await this.verifyGPGSignature(filePath, options);
      } else if (signatureType === 'x509') {
        verificationResult = await this.verifyX509Signature(filePath, options);
      } else {
        throw new Error(`Cannot determine signature type for: ${filePath}`);
      }

      return verificationResult;
      
    } catch (error) {
      this.logger.error(`Linux signature verification failed for ${filePath}:`, error);
      return {
        valid: false,
        path: filePath,
        error: error.message
      };
    }
  }

  /**
   * Verify GPG signature
   */
  async verifyGPGSignature(filePath, options) {
    // Look for signature file
    const possibleSigFiles = [
      `${filePath}.sig`,
      `${filePath}.asc`,
      `${filePath}.gpg`
    ];

    let signatureFile = options.signatureFile;
    if (!signatureFile) {
      for (const sigFile of possibleSigFiles) {
        try {
          await fs.access(sigFile);
          signatureFile = sigFile;
          break;
        } catch (error) {
          // Continue looking
        }
      }
    }

    if (!signatureFile) {
      throw new Error(`No signature file found for: ${filePath}`);
    }

    const command = [this.config.gpgPath, '--verify', signatureFile, filePath];

    // Add keyring if specified
    if (options.keyring) {
      command.splice(1, 0, '--keyring', options.keyring);
    }

    const result = await this.executeCommand(command);

    const verificationResult = {
      valid: result.exitCode === 0,
      path: filePath,
      signatureFile: signatureFile,
      output: result.stderr, // GPG outputs verification info to stderr
      exitCode: result.exitCode
    };

    if (verificationResult.valid) {
      verificationResult.details = this.parseGPGOutput(result.stderr);
    }

    return verificationResult;
  }

  /**
   * Verify X.509 signature
   */
  async verifyX509Signature(filePath, options) {
    const signatureFile = options.signatureFile || `${filePath}.p7s`;

    try {
      await fs.access(signatureFile);
    } catch (error) {
      throw new Error(`Signature file not found: ${signatureFile}`);
    }

    const command = [
      this.config.opensslPath, 'smime',
      '-verify',
      '-in', signatureFile,
      '-content', filePath,
      '-inform', 'DER'
    ];

    // Add CA certificates if provided
    if (options.caFile) {
      command.push('-CAfile', options.caFile);
    }

    const result = await this.executeCommand(command);

    return {
      valid: result.exitCode === 0,
      path: filePath,
      signatureFile: signatureFile,
      output: result.stdout,
      error: result.stderr,
      exitCode: result.exitCode
    };
  }

  /**
   * Parse GPG verification output
   */
  parseGPGOutput(output) {
    const details = {};

    // Extract signature information
    const signatureMatch = output.match(/gpg: Good signature from "([^"]+)"/);
    if (signatureMatch) {
      details.signer = signatureMatch[1];
    }

    // Extract key ID
    const keyIdMatch = output.match(/using \w+ key ([A-F0-9]+)/);
    if (keyIdMatch) {
      details.keyId = keyIdMatch[1];
    }

    // Extract signature date
    const dateMatch = output.match(/Signature made (.+)/);
    if (dateMatch) {
      details.signatureDate = dateMatch[1];
    }

    // Check for warnings
    if (output.includes('WARNING:')) {
      details.warnings = output.match(/WARNING: .+/g) || [];
    }

    return details;
  }

  /**
   * Detect signature type based on file or available signature files
   */
  detectSignatureType(filePath, options) {
    if (options.signatureType) {
      return options.signatureType;
    }

    // Check for GPG signature files
    const gpgExtensions = ['.sig', '.asc', '.gpg'];
    for (const ext of gpgExtensions) {
      try {
        require('fs').accessSync(`${filePath}${ext}`);
        return 'gpg';
      } catch (error) {
        // Continue checking
      }
    }

    // Check for X.509 signature files
    const x509Extensions = ['.p7s', '.p7b'];
    for (const ext of x509Extensions) {
      try {
        require('fs').accessSync(`${filePath}${ext}`);
        return 'x509';
      } catch (error) {
        // Continue checking
      }
    }

    return 'unknown';
  }

  /**
   * Create package checksums file
   */
  async createChecksums(filePath, options = {}) {
    const checksumAlgorithms = options.algorithms || ['sha256', 'sha512'];
    const checksumFile = options.outputFile || `${filePath}.checksums`;
    
    const checksums = {};
    const fileBuffer = await fs.readFile(filePath);

    for (const algorithm of checksumAlgorithms) {
      const hash = crypto.createHash(algorithm);
      hash.update(fileBuffer);
      checksums[algorithm] = hash.digest('hex');
    }

    // Create checksums file
    const checksumContent = Object.entries(checksums)
      .map(([algorithm, hash]) => `${hash}  ${path.basename(filePath)} (${algorithm.toUpperCase()})`)
      .join('\n') + '\n';

    await fs.writeFile(checksumFile, checksumContent);

    this.logger.info(`Created checksums file: ${checksumFile}`);
    return checksumFile;
  }

  /**
   * Verify package checksums
   */
  async verifyChecksums(filePath, checksumFile) {
    try {
      const checksumContent = await fs.readFile(checksumFile, 'utf8');
      const fileBuffer = await fs.readFile(filePath);
      const fileName = path.basename(filePath);

      const checksumLines = checksumContent.trim().split('\n');
      const results = [];

      for (const line of checksumLines) {
        const match = line.match(/^([a-f0-9]+)\s+(.+?)\s+\((\w+)\)$/);
        if (match && match[2] === fileName) {
          const [, expectedHash, , algorithm] = match;
          const hash = crypto.createHash(algorithm.toLowerCase());
          hash.update(fileBuffer);
          const actualHash = hash.digest('hex');

          results.push({
            algorithm,
            expected: expectedHash,
            actual: actualHash,
            valid: expectedHash === actualHash
          });
        }
      }

      return {
        valid: results.length > 0 && results.every(r => r.valid),
        results
      };
    } catch (error) {
      throw new Error(`Checksum verification failed: ${error.message}`);
    }
  }

  /**
   * Check if file has valid Linux signature
   */
  async isSignatureValid(filePath) {
    try {
      const result = await this.verify(filePath);
      return result.valid;
    } catch (error) {
      this.logger.error(`Error checking signature validity: ${error.message}`);
      return false;
    }
  }

  /**
   * Get supported formats for this signer
   */
  getSupportedFormats() {
    return [...this.supportedFormats];
  }

  /**
   * Get supported certificate types
   */
  getSupportedCertificateTypes() {
    return [...this.supportedCertificateTypes];
  }

  /**
   * Get supported algorithms
   */
  getSupportedAlgorithms() {
    return [...this.supportedAlgorithms];
  }

  /**
   * Execute command with proper error handling
   */
  async executeCommand(command) {
    return new Promise((resolve, reject) => {
      const process = spawn(command[0], command.slice(1), {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (exitCode) => {
        resolve({
          exitCode,
          stdout,
          stderr
        });
      });

      process.on('error', (error) => {
        reject(error);
      });

      // Set timeout for long-running operations
      const timeout = setTimeout(() => {
        process.kill();
        reject(new Error('Linux signing operation timed out'));
      }, 5 * 60 * 1000); // 5 minutes

      process.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  /**
   * Health check for Linux signer
   */
  async healthCheck() {
    try {
      // Test GPG availability
      const gpgResult = await this.executeCommand([this.config.gpgPath, '--version']);
      
      // Test OpenSSL availability
      const opensslResult = await this.executeCommand([this.config.opensslPath, 'version']);

      const healthy = gpgResult.exitCode === 0 && opensslResult.exitCode === 0;

      return {
        status: healthy ? 'healthy' : 'degraded',
        tools: {
          gpg: {
            available: gpgResult.exitCode === 0,
            version: this.extractGPGVersion(gpgResult.stdout)
          },
          openssl: {
            available: opensslResult.exitCode === 0,
            version: opensslResult.stdout.trim()
          }
        },
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'critical',
        error: error.message,
        lastChecked: new Date().toISOString()
      };
    }
  }

  /**
   * Extract GPG version from output
   */
  extractGPGVersion(output) {
    const versionMatch = output.match(/gpg \(GnuPG\) ([\d.]+)/);
    return versionMatch ? versionMatch[1] : 'unknown';
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('LinuxSigner configuration updated');
  }
}

module.exports = LinuxSigner;