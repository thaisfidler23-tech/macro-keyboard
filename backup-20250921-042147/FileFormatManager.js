const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { promisify } = require('util');
const { EventEmitter } = require('events');

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const stat = promisify(fs.stat);

/**
 * File Format Manager for Macro Keyboard
 *
 * Handles import/export of macro sequences in multiple formats:
 * - JSON: Standard JavaScript Object Notation
 * - YAML: Human-readable data serialization
 * - MKB: Custom Macro Keyboard format (YAML-based with metadata)
 */
class FileFormatManager extends EventEmitter {
  constructor(logger) {
    super();

    // Provide default logger if none is provided
    this.logger = logger || {
      info: () => {},
      error: () => {},
      warn: () => {},
      debug: () => {}
    };
    this.supportedFormats = ['json', 'yaml', 'yml', 'mkb'];
    this.formatVersion = '2.0';

    // Schema definitions for validation
    this.sequenceSchema = {
      version: { required: true, type: 'string' },
      metadata: { required: true, type: 'object' },
      sequence: { required: true, type: 'array' }
    };

    this.stepSchema = {
      type: { required: true, type: 'string', enum: ['keypress', 'command', 'application'] },
      action: { required: true, type: 'string' },
      delay: { required: false, type: 'number', min: 0, max: 60000 },
      description: { required: false, type: 'string' }
    };

    this.logger.info('FileFormatManager initialized');
  }

  /**
   * Export a single sequence to specified format
   */
  async exportSequence(sequenceData, filePath, format = null) {
    try {
      // Auto-detect format from file extension if not specified
      if (!format) {
        format = this.detectFormatFromPath(filePath);
      }

      if (!this.supportedFormats.includes(format)) {
        throw new Error(`Unsupported format: ${format}`);
      }

      // Validate sequence data
      this.validateSequenceData(sequenceData);

      // Add export metadata
      const exportData = this.addExportMetadata(sequenceData, format);

      // Convert to target format
      const content = await this.serializeData(exportData, format);

      // Ensure directory exists
      await this.ensureDirectoryExists(path.dirname(filePath));

      // Write file
      await writeFile(filePath, content, 'utf8');

      this.logger.info(`Exported sequence "${sequenceData.name}" to ${filePath} (${format})`);
      this.emit('sequenceExported', { name: sequenceData.name, path: filePath, format });

      return { success: true, path: filePath, format };
    } catch (error) {
      this.logger.error(`Error exporting sequence: ${error.message}`);
      throw error;
    }
  }

  /**
   * Import a sequence from file
   */
  async importSequence(filePath) {
    try {
      // Check if file exists
      await stat(filePath);

      // Detect format from file extension
      const format = this.detectFormatFromPath(filePath);

      if (!this.supportedFormats.includes(format)) {
        throw new Error(`Unsupported format: ${format}`);
      }

      // Read file content
      const content = await readFile(filePath, 'utf8');

      // Parse content based on format
      const sequenceData = await this.deserializeData(content, format);

      // Validate imported data
      this.validateSequenceData(sequenceData);

      // Version compatibility check
      this.checkVersionCompatibility(sequenceData);

      this.logger.info(`Imported sequence "${sequenceData.name}" from ${filePath} (${format})`);
      this.emit('sequenceImported', { name: sequenceData.name, path: filePath, format });

      return {
        success: true,
        sequenceData,
        format,
        metadata: {
          importedFrom: filePath,
          importedAt: new Date().toISOString(),
          originalFormat: format
        }
      };
    } catch (error) {
      this.logger.error(`Error importing sequence from ${filePath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Export multiple sequences to a package (ZIP or directory)
   */
  async exportBulk(sequences, outputPath, options = {}) {
    const {
      format = 'mkb',
      includeMetadata = true,
      createIndex = true,
      compression = false
    } = options;

    try {
      const results = [];
      const packageInfo = {
        packageName: path.basename(outputPath, path.extname(outputPath)),
        exportedAt: new Date().toISOString(),
        version: this.formatVersion,
        sequenceCount: Object.keys(sequences).length,
        format,
        sequences: {}
      };

      // Ensure output directory exists
      await this.ensureDirectoryExists(outputPath);

      // Export each sequence
      for (const [name, sequenceData] of Object.entries(sequences)) {
        const filename = this.sanitizeFilename(`${name}.${format}`);
        const sequencePath = path.join(outputPath, filename);

        const result = await this.exportSequence(sequenceData, sequencePath, format);
        results.push(result);

        packageInfo.sequences[name] = {
          filename,
          exported: result.success,
          actionCount: sequenceData.sequence?.length || 0,
          duration: sequenceData.metadata?.duration || 0
        };
      }

      // Create package index file if requested
      if (createIndex) {
        const indexPath = path.join(outputPath, 'package-info.json');
        await writeFile(indexPath, JSON.stringify(packageInfo, null, 2), 'utf8');
      }

      this.logger.info(`Bulk export completed: ${results.length} sequences to ${outputPath}`);
      this.emit('bulkExported', { path: outputPath, count: results.length, format });

      return {
        success: true,
        path: outputPath,
        count: results.length,
        results,
        packageInfo
      };
    } catch (error) {
      this.logger.error(`Error in bulk export: ${error.message}`);
      throw error;
    }
  }

  /**
   * Import multiple sequences from directory or package
   */
  async importBulk(sourcePath) {
    try {
      const results = [];
      const errors = [];

      // Check if source is file or directory
      const sourceStats = await stat(sourcePath);

      if (sourceStats.isDirectory()) {
        // Import from directory
        const files = fs.readdirSync(sourcePath);
        const sequenceFiles = files.filter(file => {
          const ext = path.extname(file).slice(1).toLowerCase();
          return this.supportedFormats.includes(ext);
        });

        for (const file of sequenceFiles) {
          try {
            const filePath = path.join(sourcePath, file);
            const result = await this.importSequence(filePath);
            results.push(result);
          } catch (error) {
            errors.push({ file, error: error.message });
            this.logger.warn(`Failed to import ${file}: ${error.message}`);
          }
        }
      } else {
        // Single file import
        const result = await this.importSequence(sourcePath);
        results.push(result);
      }

      this.logger.info(`Bulk import completed: ${results.length} sequences, ${errors.length} errors`);
      this.emit('bulkImported', { count: results.length, errors: errors.length });

      return {
        success: true,
        imported: results,
        errors,
        count: results.length
      };
    } catch (error) {
      this.logger.error(`Error in bulk import: ${error.message}`);
      throw error;
    }
  }

  /**
   * Serialize data to specified format
   */
  async serializeData(data, format) {
    switch (format.toLowerCase()) {
    case 'json':
      return JSON.stringify(data, null, 2);

    case 'yaml':
    case 'yml':
      return yaml.dump(data, {
        indent: 2,
        lineWidth: 100,
        noRefs: true
      });

    case 'mkb':
      // MKB format is YAML with specific structure
      const mkbData = this.convertToMKBFormat(data);
      return yaml.dump(mkbData, {
        indent: 2,
        lineWidth: 100,
        noRefs: true
      });

    default:
      throw new Error(`Unsupported serialization format: ${format}`);
    }
  }

  /**
   * Deserialize data from specified format
   */
  async deserializeData(content, format) {
    try {
      let data;

      switch (format.toLowerCase()) {
      case 'json':
        data = JSON.parse(content);
        break;

      case 'yaml':
      case 'yml':
      case 'mkb':
        data = yaml.load(content);
        break;

      default:
        throw new Error(`Unsupported deserialization format: ${format}`);
      }

      // Convert from MKB format if needed
      if (format.toLowerCase() === 'mkb') {
        data = this.convertFromMKBFormat(data);
      }

      return data;
    } catch (error) {
      throw new Error(`Failed to parse ${format} format: ${error.message}`);
    }
  }

  /**
   * Convert sequence data to MKB format structure
   */
  convertToMKBFormat(sequenceData) {
    const mkbData = {
      version: this.formatVersion,
      metadata: {
        name: sequenceData.name,
        description: sequenceData.description || '',
        author: sequenceData.metadata?.author || 'Unknown',
        created: sequenceData.metadata?.recordedAt || sequenceData.metadata?.createdAt || new Date().toISOString(),
        tags: sequenceData.metadata?.tags || []
      },
      sequence: []
    };

    // Convert sequence steps to MKB format
    if (sequenceData.sequence && Array.isArray(sequenceData.sequence)) {
      mkbData.sequence = sequenceData.sequence.map((step, index) => ({
        step: index + 1,
        type: step.type,
        action: step.action,
        delay: step.delay || 100,
        description: step.description || `${step.type}: ${step.action}`
      }));
    }

    return mkbData;
  }

  /**
   * Convert MKB format back to standard sequence data
   */
  convertFromMKBFormat(mkbData) {
    return {
      name: mkbData.metadata?.name || 'Imported Sequence',
      description: mkbData.metadata?.description || '',
      sequence: mkbData.sequence?.map(step => ({
        type: step.type,
        action: step.action,
        delay: step.delay || 100,
        description: step.description
      })) || [],
      metadata: {
        version: mkbData.version || this.formatVersion,
        recordedAt: mkbData.metadata?.created || new Date().toISOString(),
        author: mkbData.metadata?.author,
        tags: mkbData.metadata?.tags || [],
        actionCount: mkbData.sequence?.length || 0,
        importedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Detect file format from file path
   */
  detectFormatFromPath(filePath) {
    const ext = path.extname(filePath).slice(1).toLowerCase();
    return this.supportedFormats.includes(ext) ? ext : 'json';
  }

  /**
   * Validate sequence data structure
   */
  validateSequenceData(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid sequence data: must be an object');
    }

    if (!data.name || typeof data.name !== 'string') {
      throw new Error('Invalid sequence data: name is required');
    }

    if (!data.sequence || !Array.isArray(data.sequence)) {
      throw new Error('Invalid sequence data: sequence must be an array');
    }

    // Validate each step in the sequence
    data.sequence.forEach((step, index) => {
      this.validateSequenceStep(step, index);
    });

    return true;
  }

  /**
   * Validate individual sequence step
   */
  validateSequenceStep(step, index) {
    if (!step || typeof step !== 'object') {
      throw new Error(`Invalid step at index ${index}: must be an object`);
    }

    if (!step.type || !['keypress', 'command', 'application'].includes(step.type)) {
      throw new Error(`Invalid step at index ${index}: type must be 'keypress', 'command', or 'application'`);
    }

    if (!step.action || typeof step.action !== 'string') {
      throw new Error(`Invalid step at index ${index}: action is required and must be a string`);
    }

    if (step.delay !== undefined && (typeof step.delay !== 'number' || step.delay < 0 || step.delay > 60000)) {
      throw new Error(`Invalid step at index ${index}: delay must be a number between 0 and 60000`);
    }

    return true;
  }

  /**
   * Check version compatibility
   */
  checkVersionCompatibility(sequenceData) {
    const dataVersion = sequenceData.metadata?.version || sequenceData.version || '1.0.0';
    const [dataMajor] = dataVersion.split('.').map(Number);
    const [currentMajor] = this.formatVersion.split('.').map(Number);

    if (dataMajor > currentMajor) {
      throw new Error(`Incompatible version: sequence version ${dataVersion} is newer than supported version ${this.formatVersion}`);
    }

    if (dataMajor < currentMajor) {
      this.logger.warn(`Importing older version sequence: ${dataVersion} (current: ${this.formatVersion})`);
    }

    return true;
  }

  /**
   * Add export metadata to sequence data
   */
  addExportMetadata(sequenceData, format) {
    const exportData = JSON.parse(JSON.stringify(sequenceData)); // Deep copy

    if (!exportData.metadata) {
      exportData.metadata = {};
    }

    exportData.metadata.exportedAt = new Date().toISOString();
    exportData.metadata.exportedFormat = format;
    exportData.metadata.exportVersion = this.formatVersion;

    if (!exportData.metadata.version) {
      exportData.metadata.version = this.formatVersion;
    }

    return exportData;
  }

  /**
   * Sanitize filename for cross-platform compatibility
   */
  sanitizeFilename(filename) {
    return filename.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');
  }

  /**
   * Ensure directory exists, create if not
   */
  async ensureDirectoryExists(dirPath) {
    try {
      await stat(dirPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await mkdir(dirPath, { recursive: true });
        this.logger.debug(`Created directory: ${dirPath}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Get supported file formats
   */
  getSupportedFormats() {
    return [...this.supportedFormats];
  }

  /**
   * Get format description
   */
  getFormatDescription(format) {
    const descriptions = {
      json: 'JavaScript Object Notation - Standard JSON format',
      yaml: 'YAML Ain\'t Markup Language - Human-readable data serialization',
      yml: 'YAML format (alternative extension)',
      mkb: 'Macro Keyboard Format - Enhanced YAML with metadata'
    };

    return descriptions[format.toLowerCase()] || 'Unknown format';
  }

  /**
   * Get file extension for format
   */
  getFormatExtension(format) {
    const extensions = {
      json: 'json',
      yaml: 'yaml',
      yml: 'yml',
      mkb: 'mkb'
    };

    return extensions[format.toLowerCase()] || 'json';
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.removeAllListeners();
    this.logger.info('FileFormatManager cleaned up');
  }
}

module.exports = FileFormatManager;
