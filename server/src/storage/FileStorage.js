const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const AWS = require('aws-sdk');
const logger = require('../utils/logger');

class FileStorage {
  constructor() {
    this.storageType = process.env.STORAGE_TYPE || 'local';
    this.basePath = process.env.STORAGE_BASE_PATH || './uploads';
    this.s3 = null;
    this.cdnBaseUrl = process.env.CDN_BASE_URL || '';
    
    if (this.storageType === 'aws') {
      this.initializeAWS();
    } else {
      this.initializeLocal();
    }
  }

  async initializeLocal() {
    try {
      // Create storage directory if it doesn't exist
      await fs.mkdir(this.basePath, { recursive: true });
      logger.info('Local file storage initialized', { basePath: this.basePath });
    } catch (error) {
      logger.error('Failed to initialize local storage:', error);
      throw error;
    }
  }

  initializeAWS() {
    try {
      this.s3 = new AWS.S3({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'us-east-1'
      });
      
      this.bucketName = process.env.AWS_S3_BUCKET;
      
      if (!this.bucketName) {
        throw new Error('AWS_S3_BUCKET environment variable required for AWS storage');
      }
      
      logger.info('AWS S3 storage initialized', { bucket: this.bucketName });
    } catch (error) {
      logger.error('Failed to initialize AWS storage:', error);
      throw error;
    }
  }

  async storeUpdateFile(fileBuffer, filename, metadata = {}) {
    try {
      const fileHash = this.calculateFileHash(fileBuffer);
      const fileSize = fileBuffer.length;
      
      // Generate unique file path
      const timestamp = Date.now();
      const sanitizedFilename = this.sanitizeFilename(filename);
      const filePath = path.join(
        'updates',
        metadata.version || 'unknown',
        metadata.platform || 'unknown',
        `${timestamp}-${sanitizedFilename}`
      );

      let storedPath;
      
      if (this.storageType === 'aws') {
        storedPath = await this.storeToS3(fileBuffer, filePath, metadata);
      } else {
        storedPath = await this.storeLocally(fileBuffer, filePath);
      }

      const fileInfo = {
        path: storedPath,
        originalName: filename,
        size: fileSize,
        hash: fileHash,
        contentType: metadata.contentType || 'application/octet-stream',
        uploadedAt: new Date().toISOString(),
        metadata: metadata
      };

      logger.info('Update file stored successfully', {
        filename,
        size: fileSize,
        path: storedPath,
        hash: fileHash
      });

      return fileInfo;

    } catch (error) {
      logger.error('Failed to store update file:', error);
      throw error;
    }
  }

  async storeToS3(fileBuffer, filePath, metadata = {}) {
    const params = {
      Bucket: this.bucketName,
      Key: filePath,
      Body: fileBuffer,
      ContentType: metadata.contentType || 'application/octet-stream',
      Metadata: {
        'original-name': metadata.originalName || '',
        'version': metadata.version || '',
        'platform': metadata.platform || '',
        'uploaded-at': new Date().toISOString()
      },
      ServerSideEncryption: 'AES256'
    };

    await this.s3.upload(params).promise();
    
    return filePath;
  }

  async storeLocally(fileBuffer, filePath) {
    const fullPath = path.join(this.basePath, filePath);
    const dir = path.dirname(fullPath);
    
    // Create directory if it doesn't exist
    await fs.mkdir(dir, { recursive: true });
    
    // Write file
    await fs.writeFile(fullPath, fileBuffer);
    
    return filePath;
  }

  async getFileStream(filePath) {
    try {
      if (this.storageType === 'aws') {
        return this.getS3FileStream(filePath);
      } else {
        return this.getLocalFileStream(filePath);
      }
    } catch (error) {
      logger.error('Failed to get file stream:', error);
      throw error;
    }
  }

  async getS3FileStream(filePath) {
    const params = {
      Bucket: this.bucketName,
      Key: filePath
    };

    return this.s3.getObject(params).createReadStream();
  }

  async getLocalFileStream(filePath) {
    const fs = require('fs');
    const fullPath = path.join(this.basePath, filePath);
    
    // Check if file exists
    await fs.promises.access(fullPath);
    
    return fs.createReadStream(fullPath);
  }

  async getFileMetadata(filePath) {
    try {
      if (this.storageType === 'aws') {
        return await this.getS3FileMetadata(filePath);
      } else {
        return await this.getLocalFileMetadata(filePath);
      }
    } catch (error) {
      logger.error('Failed to get file metadata:', error);
      throw error;
    }
  }

  async getS3FileMetadata(filePath) {
    const params = {
      Bucket: this.bucketName,
      Key: filePath
    };

    const result = await this.s3.headObject(params).promise();
    
    return {
      size: result.ContentLength,
      lastModified: result.LastModified,
      contentType: result.ContentType,
      etag: result.ETag,
      metadata: result.Metadata
    };
  }

  async getLocalFileMetadata(filePath) {
    const fullPath = path.join(this.basePath, filePath);
    const stats = await fs.stat(fullPath);
    
    return {
      size: stats.size,
      lastModified: stats.mtime,
      contentType: 'application/octet-stream', // Default
      metadata: {}
    };
  }

  async deleteFile(filePath) {
    try {
      if (this.storageType === 'aws') {
        await this.deleteFromS3(filePath);
      } else {
        await this.deleteLocalFile(filePath);
      }

      logger.info('File deleted successfully', { filePath });

    } catch (error) {
      logger.error('Failed to delete file:', error);
      throw error;
    }
  }

  async deleteFromS3(filePath) {
    const params = {
      Bucket: this.bucketName,
      Key: filePath
    };

    await this.s3.deleteObject(params).promise();
  }

  async deleteLocalFile(filePath) {
    const fullPath = path.join(this.basePath, filePath);
    await fs.unlink(fullPath);
  }

  async verifyFileIntegrity(filePath, expectedHash) {
    try {
      let fileBuffer;
      
      if (this.storageType === 'aws') {
        const params = {
          Bucket: this.bucketName,
          Key: filePath
        };
        const result = await this.s3.getObject(params).promise();
        fileBuffer = result.Body;
      } else {
        const fullPath = path.join(this.basePath, filePath);
        fileBuffer = await fs.readFile(fullPath);
      }

      const actualHash = this.calculateFileHash(fileBuffer);
      const isValid = actualHash === expectedHash;

      logger.debug('File integrity check', {
        filePath,
        expectedHash,
        actualHash,
        isValid
      });

      return isValid;

    } catch (error) {
      logger.error('Failed to verify file integrity:', error);
      return false;
    }
  }

  generateDownloadUrl(filePath, expirationTime = 3600) {
    if (this.storageType === 'aws') {
      const params = {
        Bucket: this.bucketName,
        Key: filePath,
        Expires: expirationTime
      };
      
      return this.s3.getSignedUrl('getObject', params);
    } else {
      // For local storage, return API endpoint URL
      const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
      return `${baseUrl}/api/files/${encodeURIComponent(filePath)}`;
    }
  }

  generateCDNUrl(filePath) {
    if (this.cdnBaseUrl) {
      return `${this.cdnBaseUrl}/${filePath}`;
    } else {
      return this.generateDownloadUrl(filePath);
    }
  }

  calculateFileHash(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  sanitizeFilename(filename) {
    // Remove potentially dangerous characters
    return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  }

  async healthCheck() {
    try {
      if (this.storageType === 'aws') {
        // Test S3 connection
        await this.s3.headBucket({ Bucket: this.bucketName }).promise();
      } else {
        // Test local storage access
        await fs.access(this.basePath);
      }
      
      return true;
    } catch (error) {
      logger.error('Storage health check failed:', error);
      throw error;
    }
  }

  async getStorageStats() {
    try {
      if (this.storageType === 'aws') {
        // Get S3 bucket statistics (simplified)
        const params = {
          Bucket: this.bucketName,
          Prefix: 'updates/'
        };
        
        const result = await this.s3.listObjectsV2(params).promise();
        const totalFiles = result.KeyCount;
        const totalSize = result.Contents?.reduce((sum, obj) => sum + obj.Size, 0) || 0;
        
        return {
          type: 'aws-s3',
          totalFiles,
          totalSize,
          bucket: this.bucketName
        };
        
      } else {
        // Get local storage statistics
        const files = await this.getLocalFileList(path.join(this.basePath, 'updates'));
        let totalSize = 0;
        
        for (const file of files) {
          try {
            const stats = await fs.stat(file);
            totalSize += stats.size;
          } catch (error) {
            // Skip inaccessible files
          }
        }
        
        return {
          type: 'local',
          totalFiles: files.length,
          totalSize,
          basePath: this.basePath
        };
      }
    } catch (error) {
      logger.error('Failed to get storage stats:', error);
      return {
        type: this.storageType,
        error: error.message
      };
    }
  }

  async getLocalFileList(dirPath) {
    const files = [];
    
    try {
      const items = await fs.readdir(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stats = await fs.stat(itemPath);
        
        if (stats.isDirectory()) {
          const subFiles = await this.getLocalFileList(itemPath);
          files.push(...subFiles);
        } else {
          files.push(itemPath);
        }
      }
    } catch (error) {
      // Directory doesn't exist or is inaccessible
    }
    
    return files;
  }
}

module.exports = FileStorage;