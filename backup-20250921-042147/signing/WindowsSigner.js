const { exec, spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const util = require('util');

const execAsync = util.promisify(exec);

/**
 * Windows Authenticode code signing implementation
 * Uses SignTool.exe for signing Windows executables and MSI packages
 */
class WindowsSigner {
  constructor(logger, config = {}) {
    this.logger = logger;
    this.config = {
      signToolPath: config.signToolPath || this.findSignTool(),
      useSignToolFromSDK: config.useSignToolFromSDK !== false,
      supportedExtensions: config.supportedExtensions || ['.exe', '.dll', '.msi', '.cab', '.ocx'],
      defaultHashAlgorithm: config.defaultHashAlgorithm || 'SHA256',
      crossCertPath: config.crossCertPath,
      usePageHashing: config.usePageHashing !== false,
      ...config
    };

    this.supportedFormats = ['.exe', '.dll', '.msi', '.cab', '.ocx', '.sys', '.scr'];
    this.supportedCertificateTypes = ['PKCS#12', 'Windows Certificate Store', 'HSM/PKCS#11'];
    this.supportedAlgorithms = ['SHA1', 'SHA256', 'SHA384', 'SHA512'];

    if (!this.config.signToolPath) {
      throw new Error('SignTool.exe not found. Please install Windows SDK or specify signToolPath');
    }

    this.logger.info(`WindowsSigner initialized with SignTool: ${this.config.signToolPath}`);
  }

  /**
   * Find SignTool.exe in common installation paths
   */
  findSignTool() {
    const possiblePaths = [
      // Windows 10/11 SDK paths
      'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\x64\\signtool.exe',
      'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\x86\\signtool.exe',

      // Windows 8.1 SDK
      'C:\\Program Files (x86)\\Windows Kits\\8.1\\bin\\x64\\signtool.exe',
      'C:\\Program Files (x86)\\Windows Kits\\8.1\\bin\\x86\\signtool.exe',

      // Visual Studio paths
      'C:\\Program Files (x86)\\Microsoft SDKs\\Windows\\v10.0A\\bin\\NETFX 4.8 Tools\\x64\\signtool.exe',
      'C:\\Program Files (x86)\\Microsoft SDKs\\Windows\\v10.0A\\bin\\NETFX 4.8 Tools\\signtool.exe',

      // Try PATH
      'signtool.exe'
    ];

    for (const signToolPath of possiblePaths) {
      try {
        // For paths without drive letter, assume it's in PATH
        if (!signToolPath.includes(':\\')) {
          return signToolPath;
        }

        // Check if file exists
        require('fs').accessSync(signToolPath, require('fs').constants.F_OK);
        return signToolPath;
      } catch (error) {
        // Continue to next path
      }
    }

    return null;
  }

  /**
   * Sign a Windows executable or package
   */
  async sign(filePath, certificate, options = {}) {
    try {
      const fileExtension = path.extname(filePath).toLowerCase();

      if (!this.supportedFormats.includes(fileExtension)) {
        throw new Error(`Unsupported file format for Windows signing: ${fileExtension}`);
      }

      this.logger.info(`Signing Windows file: ${filePath}`);

      // Prepare signing command
      const signCommand = await this.buildSignCommand(filePath, certificate, options);

      this.logger.debug('Signing command:', signCommand.join(' '));

      // Execute signing
      const result = await this.executeCommand(signCommand);

      if (result.exitCode !== 0) {
        throw new Error(`Signing failed (exit code ${result.exitCode}): ${result.stderr}`);
      }

      this.logger.info(`Successfully signed: ${filePath}`);
      return filePath; // SignTool signs in place
    } catch (error) {
      this.logger.error(`Windows signing failed for ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Build SignTool command arguments
   */
  async buildSignCommand(filePath, certificate, options) {
    const command = [this.config.signToolPath, 'sign'];

    // File digest algorithm
    command.push('/fd', options.algorithm || this.config.defaultHashAlgorithm);

    // Certificate source
    if (certificate.type === 'file') {
      command.push('/f', certificate.path);
      if (certificate.password) {
        command.push('/p', certificate.password);
      }
    } else if (certificate.type === 'store') {
      command.push('/s', certificate.store || 'MY');
      command.push('/n', certificate.subject);
    } else if (certificate.type === 'hsm') {
      // HSM/PKCS#11 signing
      command.push('/csp', certificate.csp);
      command.push('/kc', certificate.keyContainer);
    }

    // Cross-certificate for legacy compatibility
    if (this.config.crossCertPath && certificate.requiresCrossCert) {
      command.push('/ac', this.config.crossCertPath);
    }

    // Timestamp server
    if (options.timestamp && options.timestampServer) {
      if (options.rfc3161Timestamp) {
        command.push('/tr', options.timestampServer);
        command.push('/td', options.algorithm || this.config.defaultHashAlgorithm);
      } else {
        // Legacy timestamp
        command.push('/t', options.timestampServer);
      }
    }

    // Description and URL
    if (options.description) {
      command.push('/d', options.description);
    }
    if (options.url) {
      command.push('/du', options.url);
    }

    // Page hashing for large files
    if (this.config.usePageHashing) {
      command.push('/ph');
    }

    // Quiet mode
    command.push('/q');

    // File to sign (must be last)
    command.push(filePath);

    return command;
  }

  /**
   * Verify Windows Authenticode signature
   */
  async verify(filePath, options = {}) {
    try {
      this.logger.debug(`Verifying Windows signature: ${filePath}`);

      const verifyCommand = [
        this.config.signToolPath,
        'verify',
        '/pa', // Use default Authenticode policy
        '/v',  // Verbose output
        filePath
      ];

      // Add additional verification options
      if (options.requireTimestamp) {
        verifyCommand.splice(-1, 0, '/tw'); // Warn if no timestamp
      }

      if (options.checkRevocation) {
        verifyCommand.splice(-1, 0, '/o', options.revocationServer || 'all');
      }

      const result = await this.executeCommand(verifyCommand);

      const verificationResult = {
        valid: result.exitCode === 0,
        path: filePath,
        exitCode: result.exitCode,
        output: result.stdout,
        error: result.stderr
      };

      if (verificationResult.valid) {
        // Parse verification details from output
        verificationResult.details = this.parseVerificationOutput(result.stdout);
      }

      return verificationResult;
    } catch (error) {
      this.logger.error(`Windows signature verification failed for ${filePath}:`, error);
      return {
        valid: false,
        path: filePath,
        error: error.message
      };
    }
  }

  /**
   * Parse SignTool verification output for details
   */
  parseVerificationOutput(output) {
    const details = {};

    // Extract certificate information
    const certMatch = output.match(/Issued to: (.+)/);
    if (certMatch) {
      details.issuedTo = certMatch[1].trim();
    }

    const issuerMatch = output.match(/Issued by: (.+)/);
    if (issuerMatch) {
      details.issuedBy = issuerMatch[1].trim();
    }

    // Extract timestamp information
    const timestampMatch = output.match(/Timestamp Verified by: (.+)/);
    if (timestampMatch) {
      details.timestampAuthority = timestampMatch[1].trim();
      details.timestamp = true;
    }

    // Extract signature algorithm
    const algorithmMatch = output.match(/Hash of file \(([^)]+)\):/);
    if (algorithmMatch) {
      details.algorithm = algorithmMatch[1];
    }

    return details;
  }

  /**
   * Check if file has valid Windows signature
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
   * Extract signature information without full verification
   */
  async getSignatureInfo(filePath) {
    try {
      const command = [
        this.config.signToolPath,
        'verify',
        '/v',
        '/pa',
        filePath
      ];

      const result = await this.executeCommand(command);

      if (result.exitCode === 0) {
        return this.parseVerificationOutput(result.stdout);
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to get signature info: ${error.message}`);
      return null;
    }
  }

  /**
   * Remove signature from a file
   */
  async removeSignature(filePath) {
    try {
      this.logger.info(`Removing signature from: ${filePath}`);

      const command = [
        this.config.signToolPath,
        'remove',
        '/s',
        filePath
      ];

      const result = await this.executeCommand(command);

      if (result.exitCode !== 0) {
        throw new Error(`Failed to remove signature: ${result.stderr}`);
      }

      this.logger.info(`Successfully removed signature from: ${filePath}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to remove signature from ${filePath}:`, error);
      throw error;
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
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
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
        reject(new Error('SignTool operation timed out'));
      }, 5 * 60 * 1000); // 5 minutes

      process.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  /**
   * Health check for Windows signer
   */
  async healthCheck() {
    try {
      // Test SignTool availability
      const result = await this.executeCommand([this.config.signToolPath, '/?']);

      return {
        status: result.exitCode === 0 ? 'healthy' : 'degraded',
        signToolPath: this.config.signToolPath,
        signToolVersion: this.extractSignToolVersion(result.stdout),
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'critical',
        error: error.message,
        signToolPath: this.config.signToolPath,
        lastChecked: new Date().toISOString()
      };
    }
  }

  /**
   * Extract SignTool version from help output
   */
  extractSignToolVersion(output) {
    const versionMatch = output.match(/Microsoft.*SignTool.*Version\s+([\d.]+)/i);
    return versionMatch ? versionMatch[1] : 'unknown';
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('WindowsSigner configuration updated');
  }
}

module.exports = WindowsSigner;
