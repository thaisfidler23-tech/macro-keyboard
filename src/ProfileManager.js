/**
 * Profile Management System
 * Handles multiple configuration profiles, quick switching, import/export functionality
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

class ProfileManager {
  constructor(logger, configValidator, errorHandler) {
    this.logger = logger;
    this.configValidator = configValidator;
    this.errorHandler = errorHandler;

    this.profilesDir = path.join(__dirname, '../config/profiles');
    this.activeProfile = null;
    this.availableProfiles = new Map();
  }

  /**
   * Initialize the profiles directory and load available profiles
   */
  async initializeProfilesDirectory() {
    try {
      await fs.mkdir(this.profilesDir, { recursive: true });
      await this.loadAvailableProfiles();
    } catch (error) {
      this.logger.error('Failed to initialize profiles directory:', error);
      throw error;
    }
  }

  /**
   * Load all available profiles from the profiles directory
   */
  async loadAvailableProfiles() {
    try {
      const files = await fs.readdir(this.profilesDir);
      const yamlFiles = files.filter(file => file.endsWith('.yaml') || file.endsWith('.yml'));

      this.availableProfiles.clear();

      for (const file of yamlFiles) {
        try {
          const profilePath = path.join(this.profilesDir, file);
          const profileData = await this.loadProfileFromFile(profilePath);
          const profileName = path.basename(file, path.extname(file));

          this.availableProfiles.set(profileName, {
            name: profileName,
            path: profilePath,
            data: profileData,
            lastModified: (await fs.stat(profilePath)).mtime
          });

          this.logger.debug(`Loaded profile: ${profileName}`);
        } catch (error) {
          this.logger.warn(`Failed to load profile ${file}:`, error.message);
        }
      }

      this.logger.info(`Loaded ${this.availableProfiles.size} profiles`);
    } catch (error) {
      this.logger.error('Failed to load available profiles:', error);
      throw error;
    }
  }

  /**
   * Load profile data from file with validation
   */
  async loadProfileFromFile(profilePath) {
    try {
      const fileContent = await fs.readFile(profilePath, 'utf8');
      const profileData = yaml.load(fileContent);

      // Validate profile structure
      const validation = this.configValidator.validateConfig(profileData);

      if (!validation.valid) {
        throw new Error(`Invalid profile configuration: ${validation.errors.join(', ')}`);
      }

      return validation.migratedConfig;
    } catch (error) {
      this.logger.error(`Failed to load profile from ${profilePath}:`, error);
      throw error;
    }
  }

  /**
   * Get list of available profiles with metadata
   */
  getAvailableProfiles() {
    return Array.from(this.availableProfiles.values()).map(profile => ({
      name: profile.name,
      description: profile.data.description || 'No description',
      buttonCount: Object.keys(profile.data.buttons || {}).length,
      encoderCount: Object.keys(profile.data.encoders || {}).length,
      lastModified: profile.lastModified,
      isActive: profile.name === this.activeProfile
    }));
  }

  /**
   * Get the currently active profile name
   */
  getActiveProfileName() {
    return this.activeProfile;
  }

  /**
   * Set the active profile
   */
  setActiveProfile(profileName) {
    if (this.availableProfiles.has(profileName)) {
      this.activeProfile = profileName;
      this.logger.info(`Active profile set to: ${profileName}`);
      return true;
    }
    this.logger.warn(`Profile not found: ${profileName}`);
    return false;
  }

  /**
   * Get profile configuration data
   */
  getProfileConfig(profileName) {
    const profile = this.availableProfiles.get(profileName);
    if (profile) {
      return { ...profile.data }; // Return a copy
    }
    throw new Error(`Profile not found: ${profileName}`);
  }

  /**
   * Get active profile configuration
   */
  getActiveProfileConfig() {
    if (!this.activeProfile) {
      throw new Error('No active profile set');
    }
    return this.getProfileConfig(this.activeProfile);
  }

  /**
   * Create a new profile
   */
  async createProfile(profileName, baseConfig = null, description = '') {
    if (this.availableProfiles.has(profileName)) {
      throw new Error(`Profile already exists: ${profileName}`);
    }

    // Validate profile name
    if (!/^[a-zA-Z0-9_-]+$/.test(profileName)) {
      throw new Error('Profile name can only contain letters, numbers, hyphens, and underscores');
    }

    try {
      // Use base config or create default configuration
      const profileConfig = baseConfig || this.createDefaultProfileConfig();

      // Add profile metadata
      profileConfig.profile = {
        name: profileName,
        description,
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString()
      };

      // Validate the new profile
      const validation = this.configValidator.validateConfig(profileConfig);
      if (!validation.valid) {
        throw new Error(`Invalid profile configuration: ${validation.errors.join(', ')}`);
      }

      // Save to file
      const profilePath = path.join(this.profilesDir, `${profileName}.yaml`);
      await this.saveProfileToFile(profilePath, validation.migratedConfig);

      // Add to available profiles
      this.availableProfiles.set(profileName, {
        name: profileName,
        path: profilePath,
        data: validation.migratedConfig,
        lastModified: new Date()
      });

      this.logger.info(`Created profile: ${profileName}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to create profile ${profileName}:`, error);
      throw error;
    }
  }

  /**
   * Update an existing profile
   */
  async updateProfile(profileName, newConfig, description = null) {
    if (!this.availableProfiles.has(profileName)) {
      throw new Error(`Profile not found: ${profileName}`);
    }

    try {
      const profile = this.availableProfiles.get(profileName);
      const updatedConfig = { ...newConfig };

      // Update profile metadata
      updatedConfig.profile = {
        ...updatedConfig.profile,
        name: profileName,
        description: description || updatedConfig.profile?.description || '',
        modifiedAt: new Date().toISOString()
      };

      // Validate the updated configuration
      const validation = this.configValidator.validateConfig(updatedConfig);
      if (!validation.valid) {
        throw new Error(`Invalid profile configuration: ${validation.errors.join(', ')}`);
      }

      // Save to file
      await this.saveProfileToFile(profile.path, validation.migratedConfig);

      // Update in memory
      profile.data = validation.migratedConfig;
      profile.lastModified = new Date();

      this.logger.info(`Updated profile: ${profileName}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to update profile ${profileName}:`, error);
      throw error;
    }
  }

  /**
   * Delete a profile
   */
  async deleteProfile(profileName) {
    if (!this.availableProfiles.has(profileName)) {
      throw new Error(`Profile not found: ${profileName}`);
    }

    if (profileName === this.activeProfile) {
      throw new Error('Cannot delete the currently active profile');
    }

    try {
      const profile = this.availableProfiles.get(profileName);
      await fs.unlink(profile.path);

      this.availableProfiles.delete(profileName);

      this.logger.info(`Deleted profile: ${profileName}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete profile ${profileName}:`, error);
      throw error;
    }
  }

  /**
   * Duplicate an existing profile
   */
  async duplicateProfile(sourceProfileName, newProfileName, description = '') {
    if (!this.availableProfiles.has(sourceProfileName)) {
      throw new Error(`Source profile not found: ${sourceProfileName}`);
    }

    if (this.availableProfiles.has(newProfileName)) {
      throw new Error(`Profile already exists: ${newProfileName}`);
    }

    try {
      const sourceProfile = this.availableProfiles.get(sourceProfileName);
      const sourceConfig = { ...sourceProfile.data };

      // Remove profile metadata to let createProfile add new metadata
      delete sourceConfig.profile;

      await this.createProfile(
        newProfileName,
        sourceConfig,
        description || `Copy of ${sourceProfileName}`
      );

      this.logger.info(`Duplicated profile ${sourceProfileName} to ${newProfileName}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to duplicate profile ${sourceProfileName}:`, error);
      throw error;
    }
  }

  /**
   * Export a profile to a specified path
   */
  async exportProfile(profileName, exportPath) {
    if (!this.availableProfiles.has(profileName)) {
      throw new Error(`Profile not found: ${profileName}`);
    }

    try {
      const profile = this.availableProfiles.get(profileName);
      const profileConfig = { ...profile.data };

      // Add export metadata
      profileConfig.export = {
        exportedAt: new Date().toISOString(),
        exportedBy: 'Macro Keyboard Profile Manager',
        originalName: profileName
      };

      await this.saveProfileToFile(exportPath, profileConfig);

      this.logger.info(`Exported profile ${profileName} to ${exportPath}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to export profile ${profileName}:`, error);
      throw error;
    }
  }

  /**
   * Import a profile from a file
   */
  async importProfile(importPath, profileName = null, overwrite = false) {
    try {
      const importedConfig = await this.loadProfileFromFile(importPath);

      // Determine profile name
      const finalProfileName =
        profileName ||
        importedConfig.export?.originalName ||
        importedConfig.profile?.name ||
        path.basename(importPath, path.extname(importPath));

      // Check if profile exists
      if (this.availableProfiles.has(finalProfileName) && !overwrite) {
        throw new Error(
          `Profile already exists: ${finalProfileName}. Use overwrite flag to replace.`
        );
      }

      // Clean up import metadata
      delete importedConfig.export;

      // Create or update the profile
      if (overwrite && this.availableProfiles.has(finalProfileName)) {
        await this.updateProfile(
          finalProfileName,
          importedConfig,
          importedConfig.profile?.description || `Imported from ${path.basename(importPath)}`
        );
      } else {
        await this.createProfile(
          finalProfileName,
          importedConfig,
          importedConfig.profile?.description || `Imported from ${path.basename(importPath)}`
        );
      }

      this.logger.info(`Imported profile from ${importPath} as ${finalProfileName}`);
      return finalProfileName;
    } catch (error) {
      this.logger.error(`Failed to import profile from ${importPath}:`, error);
      throw error;
    }
  }

  /**
   * Save profile configuration to file
   */
  async saveProfileToFile(filePath, config) {
    try {
      const yamlContent = yaml.dump(config, {
        indent: 2,
        lineWidth: -1,
        noRefs: true
      });

      await fs.writeFile(filePath, yamlContent, 'utf8');
    } catch (error) {
      this.logger.error(`Failed to save profile to ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Create default profile configuration
   */
  createDefaultProfileConfig() {
    return {
      version: '1.0.0',
      device: {
        serialPort: null,
        baudRate: 9600,
        connectionTimeout: 5000,
        buttons: 8,
        encoders: 0
      },
      logging: {
        level: 'info',
        file: 'logs/macro-keyboard.log',
        maxSize: 5242880,
        maxFiles: 5
      },
      security: {
        commandExecution: {
          enabled: true,
          mode: 'blacklist',
          allowedCommands: [],
          timeout: 10000,
          maxLength: 1000
        }
      },
      profiles: {
        active: 'default',
        available: ['default']
      },
      buttons: {},
      encoders: {}
    };
  }

  /**
   * Get profile statistics
   */
  getProfileStatistics() {
    const stats = {
      totalProfiles: this.availableProfiles.size,
      activeProfile: this.activeProfile,
      profilesWithButtons: 0,
      profilesWithEncoders: 0,
      totalButtons: 0,
      totalEncoders: 0,
      lastModified: null
    };

    for (const profile of this.availableProfiles.values()) {
      const buttonCount = Object.keys(profile.data.buttons || {}).length;
      const encoderCount = Object.keys(profile.data.encoders || {}).length;

      if (buttonCount > 0) {
        stats.profilesWithButtons++;
      }
      if (encoderCount > 0) {
        stats.profilesWithEncoders++;
      }

      stats.totalButtons += buttonCount;
      stats.totalEncoders += encoderCount;

      if (!stats.lastModified || profile.lastModified > stats.lastModified) {
        stats.lastModified = profile.lastModified;
      }
    }

    return stats;
  }
}

module.exports = ProfileManager;
