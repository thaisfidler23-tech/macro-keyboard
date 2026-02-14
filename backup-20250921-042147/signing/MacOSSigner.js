const { exec, spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const util = require('util');

const execAsync = util.promisify(exec);

/**
 * macOS code signing implementation
 * Uses codesign utility for signing macOS applications and packages
 */
class MacOSSigner {
  constructor(logger, config = {}) {
    this.logger = logger;
    this.config = {
      codesignPath: config.codesignPath || '/usr/bin/codesign',
      spctlPath: config.spctlPath || '/usr/sbin/spctl',
      xcrunPath: config.xcrunPath || '/usr/bin/xcrun',
      enableHardening: config.enableHardening !== false,
      enableNotarization: config.enableNotarization !== false,
      supportedExtensions: config.supportedExtensions || ['.app', '.pkg', '.dmg', '.dylib'],
      entitlementsPath: config.entitlementsPath,
      ...config
    };

    this.supportedFormats = ['.app', '.pkg', '.dmg', '.dylib', '.framework'];
    this.supportedCertificateTypes = ['Developer ID Application', 'Developer ID Installer', 'Mac App Store'];
    this.supportedAlgorithms = ['SHA256'];

    this.logger.info('MacOSSigner initialized for macOS code signing');
  }

  /**
   * Sign a macOS application or package
   */
  async sign(filePath, certificate, options = {}) {
    try {
      const fileExtension = path.extname(filePath).toLowerCase();
      const fileName = path.basename(filePath);

      this.logger.info(`Signing macOS file: ${filePath}`);

      // Choose signing method based on file type
      let signedPath;
      if (fileExtension === '.app') {
        signedPath = await this.signApplication(filePath, certificate, options);
      } else if (fileExtension === '.pkg') {
        signedPath = await this.signPackage(filePath, certificate, options);
      } else if (fileExtension === '.dmg') {
        signedPath = await this.signDiskImage(filePath, certificate, options);
      } else {
        signedPath = await this.signGeneric(filePath, certificate, options);
      }

      // Perform notarization if enabled and required
      if (this.config.enableNotarization && this.shouldNotarize(fileExtension) && options.notarize !== false) {
        await this.notarize(signedPath, options.notarizationCredentials || {});
      }

      this.logger.info(`Successfully signed: ${signedPath}`);
      return signedPath;
    } catch (error) {
      this.logger.error(`macOS signing failed for ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Sign macOS application bundle
   */
  async signApplication(appPath, certificate, options) {
    // Create a copy for signing to avoid modifying original
    const signedPath = `${appPath}.signed`;

    try {
      // Copy application bundle
      await this.executeCommand(['cp', '-R', appPath, signedPath]);

      // Build codesign command
      const command = await this.buildCodesignCommand(signedPath, certificate, options, 'application');

      this.logger.debug('macOS app signing command:', command.join(' '));

      // Execute signing
      const result = await this.executeCommand(command);

      if (result.exitCode !== 0) {
        throw new Error(`Application signing failed (exit code ${result.exitCode}): ${result.stderr}`);
      }

      return signedPath;
    } catch (error) {
      // Clean up on failure
      try {
        await this.executeCommand(['rm', '-rf', signedPath]);
      } catch (cleanupError) {
        this.logger.warn('Failed to clean up after signing failure:', cleanupError.message);
      }
      throw error;
    }
  }

  /**
   * Sign macOS installer package
   */
  async signPackage(pkgPath, certificate, options) {
    const signedPath = path.join(path.dirname(pkgPath), `${path.basename(pkgPath, '.pkg')}.signed.pkg`);

    const command = [
      'productsign',
      '--sign', certificate.identity,
      pkgPath,
      signedPath
    ];

    // Add timestamp if requested
    if (options.timestamp) {
      command.splice(-2, 0, '--timestamp');
    }

    const result = await this.executeCommand(command);

    if (result.exitCode !== 0) {
      throw new Error(`Package signing failed (exit code ${result.exitCode}): ${result.stderr}`);
    }

    return signedPath;
  }

  /**
   * Sign disk image
   */
  async signDiskImage(dmgPath, certificate, options) {
    const command = await this.buildCodesignCommand(dmgPath, certificate, options, 'dmg');

    const result = await this.executeCommand(command);

    if (result.exitCode !== 0) {
      throw new Error(`DMG signing failed (exit code ${result.exitCode}): ${result.stderr}`);
    }

    return dmgPath; // codesign signs in place for DMG
  }

  /**
   * Sign generic file (dylib, framework, etc.)
   */
  async signGeneric(filePath, certificate, options) {
    const command = await this.buildCodesignCommand(filePath, certificate, options, 'generic');

    const result = await this.executeCommand(command);

    if (result.exitCode !== 0) {
      throw new Error(`Generic signing failed (exit code ${result.exitCode}): ${result.stderr}`);
    }

    return filePath; // codesign signs in place
  }

  /**
   * Build codesign command arguments
   */
  async buildCodesignCommand(filePath, certificate, options, type) {
    const command = [this.config.codesignPath];

    // Always force resign
    command.push('--force');

    // Enable hardened runtime for applications
    if (type === 'application' && this.config.enableHardening) {
      command.push('--options', 'runtime');
    }

    // Add entitlements for applications
    if (type === 'application' && (options.entitlements || this.config.entitlementsPath)) {
      const entitlementsPath = options.entitlements || this.config.entitlementsPath;
      command.push('--entitlements', entitlementsPath);
    }

    // Add timestamp
    if (options.timestamp) {
      command.push('--timestamp');
    }

    // Signing identity
    command.push('--sign', certificate.identity);

    // Deep signing for applications
    if (type === 'application') {
      command.push('--deep');
    }

    // Verbose output
    command.push('--verbose');

    // File to sign
    command.push(filePath);

    return command;
  }

  /**
   * Verify macOS code signature
   */
  async verify(filePath, options = {}) {
    try {
      this.logger.debug(`Verifying macOS signature: ${filePath}`);

      // Use spctl for comprehensive verification
      const spctlCommand = [
        this.config.spctlPath,
        '--assess',
        '--type', this.getAssessmentType(filePath),
        '--verbose',
        filePath
      ];

      const spctlResult = await this.executeCommand(spctlCommand);

      // Also use codesign for detailed signature info
      const codesignCommand = [
        this.config.codesignPath,
        '--verify',
        '--verbose',
        '--deep',
        filePath
      ];

      const codesignResult = await this.executeCommand(codesignCommand);

      const verificationResult = {
        valid: spctlResult.exitCode === 0 && codesignResult.exitCode === 0,
        path: filePath,
        spctl: {
          exitCode: spctlResult.exitCode,
          output: spctlResult.stdout,
          error: spctlResult.stderr
        },
        codesign: {
          exitCode: codesignResult.exitCode,
          output: codesignResult.stdout,
          error: codesignResult.stderr
        }
      };

      if (verificationResult.valid) {
        verificationResult.details = await this.getSignatureDetails(filePath);
      }

      return verificationResult;
    } catch (error) {
      this.logger.error(`macOS signature verification failed for ${filePath}:`, error);
      return {
        valid: false,
        path: filePath,
        error: error.message
      };
    }
  }

  /**
   * Get detailed signature information
   */
  async getSignatureDetails(filePath) {
    try {
      const command = [
        this.config.codesignPath,
        '--display',
        '--verbose=2',
        filePath
      ];

      const result = await this.executeCommand(command);
      return this.parseSignatureDetails(result.stderr); // codesign outputs to stderr
    } catch (error) {
      this.logger.warn(`Failed to get signature details: ${error.message}`);
      return {};
    }
  }

  /**
   * Parse codesign output for signature details
   */
  parseSignatureDetails(output) {
    const details = {};

    // Extract identifier
    const identifierMatch = output.match(/Identifier=(.+)/);
    if (identifierMatch) {
      details.identifier = identifierMatch[1];
    }

    // Extract team identifier
    const teamMatch = output.match(/TeamIdentifier=(.+)/);
    if (teamMatch) {
      details.teamIdentifier = teamMatch[1];
    }

    // Extract authority
    const authorityMatches = output.match(/Authority=(.+)/g);
    if (authorityMatches) {
      details.authorities = authorityMatches.map(match => match.replace('Authority=', ''));
    }

    // Extract timestamp
    const timestampMatch = output.match(/Timestamp=(.+)/);
    if (timestampMatch) {
      details.timestamp = timestampMatch[1];
    }

    // Check for hardened runtime
    if (output.includes('flags=0x10000(runtime)')) {
      details.hardenedRuntime = true;
    }

    return details;
  }

  /**
   * Notarize signed application with Apple
   */
  async notarize(filePath, credentials) {
    try {
      this.logger.info(`Starting notarization for: ${filePath}`);

      if (!credentials.appleId || !credentials.appPassword || !credentials.teamId) {
        throw new Error('Missing notarization credentials (appleId, appPassword, teamId)');
      }

      // Submit for notarization
      const submitCommand = [
        this.config.xcrunPath, 'notarytool',
        'submit', filePath,
        '--apple-id', credentials.appleId,
        '--password', credentials.appPassword,
        '--team-id', credentials.teamId,
        '--wait'
      ];

      this.logger.debug('Notarization submit command:', submitCommand.join(' '));

      const result = await this.executeCommand(submitCommand, { timeout: 30 * 60 * 1000 }); // 30 minutes

      if (result.exitCode !== 0) {
        throw new Error(`Notarization failed (exit code ${result.exitCode}): ${result.stderr}`);
      }

      // Staple notarization to the file
      if (path.extname(filePath).toLowerCase() === '.app') {
        await this.stapleNotarization(filePath);
      }

      this.logger.info(`Successfully notarized: ${filePath}`);
      return true;
    } catch (error) {
      this.logger.error(`Notarization failed for ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Staple notarization ticket to application
   */
  async stapleNotarization(filePath) {
    const command = [
      this.config.xcrunPath, 'stapler', 'staple', filePath
    ];

    const result = await this.executeCommand(command);

    if (result.exitCode !== 0) {
      this.logger.warn(`Failed to staple notarization: ${result.stderr}`);
      // Don't throw error as stapling is not always critical
    } else {
      this.logger.info(`Successfully stapled notarization to: ${filePath}`);
    }
  }

  /**
   * Check if file should be notarized
   */
  shouldNotarize(fileExtension) {
    return ['.app', '.pkg', '.dmg'].includes(fileExtension.toLowerCase());
  }

  /**
   * Get assessment type for spctl
   */
  getAssessmentType(filePath) {
    const extension = path.extname(filePath).toLowerCase();
    switch (extension) {
    case '.app':
      return 'exec';
    case '.pkg':
      return 'install';
    default:
      return 'exec';
    }
  }

  /**
   * Check if file has valid macOS signature
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
   * Execute command with proper error handling and timeout support
   */
  async executeCommand(command, options = {}) {
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

      // Set timeout (default 5 minutes, override with options)
      const timeout = setTimeout(() => {
        process.kill();
        reject(new Error(`Command timed out: ${command.join(' ')}`));
      }, options.timeout || 5 * 60 * 1000);

      process.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  /**
   * Health check for macOS signer
   */
  async healthCheck() {
    try {
      // Test codesign availability
      const codesignResult = await this.executeCommand([this.config.codesignPath, '--version']);

      // Test spctl availability
      const spctlResult = await this.executeCommand([this.config.spctlPath, '--status']);

      const healthy = codesignResult.exitCode === 0 && spctlResult.exitCode === 0;

      return {
        status: healthy ? 'healthy' : 'degraded',
        tools: {
          codesign: {
            available: codesignResult.exitCode === 0,
            version: this.extractCodesignVersion(codesignResult.stdout)
          },
          spctl: {
            available: spctlResult.exitCode === 0,
            status: spctlResult.stdout.trim()
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
   * Extract codesign version from output
   */
  extractCodesignVersion(output) {
    const versionMatch = output.match(/codesign-(\d+)/);
    return versionMatch ? versionMatch[1] : 'unknown';
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('MacOSSigner configuration updated');
  }
}

module.exports = MacOSSigner;
