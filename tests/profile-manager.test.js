/**
 * Tests for Profile Management System
 * Testing profile creation, management, and import/export functionality
 */

const ProfileManager = require('../src/ProfileManager');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

// Mock dependencies
const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

const mockConfigValidator = {
  validateConfig: jest.fn(),
  saveConfig: jest.fn()
};

const mockErrorHandler = {
  handleError: jest.fn()
};

describe('Profile Management System', () => {
  let profileManager;
  let tempDir;

  beforeEach(async () => {
    // Create temporary directory for profiles
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'macro-keyboard-profiles-'));
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Set up successful validation with proper migratedConfig
    mockConfigValidator.validateConfig.mockImplementation((config) => ({
      valid: true,
      errors: [],
      warnings: [],
      migratedConfig: { ...config } // Return the config as migratedConfig
    }));
    
    // Create ProfileManager instance
    profileManager = new ProfileManager(mockLogger, mockConfigValidator, mockErrorHandler);
    
    // Override profiles directory for testing
    profileManager.profilesDir = tempDir;
    
    await profileManager.initializeProfilesDirectory();
  });

  afterEach(async () => {
    // Clean up temporary directory
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true });
    }
  });

  describe('Profile Creation', () => {
    test('should create a new profile with valid data', async () => {
      const profileName = 'test-profile';
      const description = 'Test profile description';
      
      const result = await profileManager.createProfile(profileName, null, description);
      
      expect(result).toBe(true);
      expect(profileManager.availableProfiles.has(profileName)).toBe(true);
      
      const profile = profileManager.availableProfiles.get(profileName);
      expect(profile.data.profile.name).toBe(profileName);
      expect(profile.data.profile.description).toBe(description);
    });

    test('should reject invalid profile names', async () => {
      const invalidNames = ['test profile', 'test/profile', 'test.profile', ''];
      
      for (const invalidName of invalidNames) {
        await expect(profileManager.createProfile(invalidName))
          .rejects.toThrow(/Profile name can only contain/);
      }
    });

    test('should reject duplicate profile names', async () => {
      const profileName = 'duplicate-test';
      
      await profileManager.createProfile(profileName);
      
      await expect(profileManager.createProfile(profileName))
        .rejects.toThrow(/Profile already exists/);
    });

    test('should create profile with base configuration', async () => {
      const baseConfig = {
        version: '1.0.0',
        buttons: {
          button1: {
            description: 'Test button',
            type: 'keypress',
            action: 'ctrl+c'
          }
        }
      };
      
      const result = await profileManager.createProfile('base-test', baseConfig);
      
      expect(result).toBe(true);
      const profile = profileManager.getProfileConfig('base-test');
      expect(profile.buttons.button1).toEqual(baseConfig.buttons.button1);
    });
  });

  describe('Profile Management', () => {
    beforeEach(async () => {
      await profileManager.createProfile('profile1', null, 'First profile');
      await profileManager.createProfile('profile2', null, 'Second profile');
    });

    test('should list available profiles', () => {
      const profiles = profileManager.getAvailableProfiles();
      
      expect(profiles).toHaveLength(2);
      expect(profiles.some(p => p.name === 'profile1')).toBe(true);
      expect(profiles.some(p => p.name === 'profile2')).toBe(true);
    });

    test('should set and get active profile', () => {
      const success = profileManager.setActiveProfile('profile1');
      
      expect(success).toBe(true);
      expect(profileManager.getActiveProfileName()).toBe('profile1');
    });

    test('should reject unknown profile activation', () => {
      const success = profileManager.setActiveProfile('unknown-profile');
      
      expect(success).toBe(false);
      expect(profileManager.getActiveProfileName()).toBeNull();
    });

    test('should update profile configuration', async () => {
      const updatedConfig = {
        version: '1.0.0',
        buttons: {
          button1: { description: 'Updated', type: 'keypress', action: 'ctrl+v' }
        }
      };
      
      const result = await profileManager.updateProfile('profile1', updatedConfig, 'Updated description');
      
      expect(result).toBe(true);
      const profile = profileManager.getProfileConfig('profile1');
      expect(profile.buttons.button1.description).toBe('Updated');
      expect(profile.profile.description).toBe('Updated description');
    });

    test('should delete non-active profile', async () => {
      profileManager.setActiveProfile('profile1');
      
      const result = await profileManager.deleteProfile('profile2');
      
      expect(result).toBe(true);
      expect(profileManager.availableProfiles.has('profile2')).toBe(false);
    });

    test('should prevent deleting active profile', async () => {
      profileManager.setActiveProfile('profile1');
      
      await expect(profileManager.deleteProfile('profile1'))
        .rejects.toThrow(/Cannot delete the currently active profile/);
    });

    test('should duplicate profile', async () => {
      const result = await profileManager.duplicateProfile('profile1', 'profile1-copy', 'Copy of profile1');
      
      expect(result).toBe(true);
      expect(profileManager.availableProfiles.has('profile1-copy')).toBe(true);
      
      const original = profileManager.getProfileConfig('profile1');
      const copy = profileManager.getProfileConfig('profile1-copy');
      
      expect(copy.profile.name).toBe('profile1-copy');
      expect(copy.profile.description).toBe('Copy of profile1');
    });
  });

  describe('Profile Import/Export', () => {
    let exportPath;
    
    beforeEach(async () => {
      await profileManager.createProfile('export-test', null, 'Profile for export');
      exportPath = path.join(tempDir, 'exported-profile.yaml');
    });

    test('should export profile to file', async () => {
      const result = await profileManager.exportProfile('export-test', exportPath);
      
      expect(result).toBe(true);
      
      const stats = await fs.stat(exportPath);
      expect(stats.isFile()).toBe(true);
    });

    test('should import profile from file', async () => {
      // First export a profile
      await profileManager.exportProfile('export-test', exportPath);
      
      // Then import it with a new name
      const importedName = await profileManager.importProfile(exportPath, 'imported-profile');
      
      expect(importedName).toBe('imported-profile');
      expect(profileManager.availableProfiles.has('imported-profile')).toBe(true);
    });

    test('should handle import with overwrite', async () => {
      await profileManager.exportProfile('export-test', exportPath);
      
      // Import once
      await profileManager.importProfile(exportPath, 'overwrite-test');
      
      // Import again with overwrite
      const importedName = await profileManager.importProfile(exportPath, 'overwrite-test', true);
      
      expect(importedName).toBe('overwrite-test');
    });

    test('should reject import without overwrite for existing profile', async () => {
      await profileManager.exportProfile('export-test', exportPath);
      await profileManager.importProfile(exportPath, 'existing-test');
      
      await expect(profileManager.importProfile(exportPath, 'existing-test', false))
        .rejects.toThrow(/Profile already exists.*Use overwrite flag/);
    });
  });

  describe('Profile Statistics', () => {
    beforeEach(async () => {
      // Create profiles with different configurations
      const profile1Config = {
        buttons: {
          button1: { description: 'Test', type: 'keypress', action: 'ctrl+c' },
          button2: { description: 'Test', type: 'keypress', action: 'ctrl+v' }
        },
        encoders: {}
      };
      
      const profile2Config = {
        buttons: {},
        encoders: {
          encoder1: { description: 'Volume', typeCW: 'keypress', actionCW: 'VolumeUp' }
        }
      };
      
      await profileManager.createProfile('buttons-profile', profile1Config);
      await profileManager.createProfile('encoders-profile', profile2Config);
      await profileManager.createProfile('empty-profile');
      
      profileManager.setActiveProfile('buttons-profile');
    });

    test('should calculate profile statistics correctly', () => {
      const stats = profileManager.getProfileStatistics();
      
      expect(stats.totalProfiles).toBe(3);
      expect(stats.activeProfile).toBe('buttons-profile');
      expect(stats.profilesWithButtons).toBe(1);
      expect(stats.profilesWithEncoders).toBe(1);
      expect(stats.totalButtons).toBe(2);
      expect(stats.totalEncoders).toBe(1);
      expect(stats.lastModified).toBeInstanceOf(Date);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid configuration validation', async () => {
      mockConfigValidator.validateConfig.mockReturnValue({
        valid: false,
        errors: ['Invalid configuration'],
        warnings: [],
        migratedConfig: null
      });
      
      await expect(profileManager.createProfile('invalid-profile'))
        .rejects.toThrow(/Invalid profile configuration/);
    });

    test('should handle file system errors gracefully', async () => {
      // Try to create profile in non-existent directory
      profileManager.profilesDir = '/non/existent/path';
      
      await expect(profileManager.createProfile('fail-test'))
        .rejects.toThrow();
    });

    test('should handle missing profile errors', () => {
      expect(() => profileManager.getProfileConfig('non-existent'))
        .toThrow(/Profile not found/);
    });
  });

  describe('Profile Loading', () => {
    test('should load profiles from directory on initialization', async () => {
      // Create a profile file manually
      const profileData = {
        version: '1.0.0',
        profile: {
          name: 'manual-profile',
          description: 'Manually created profile'
        },
        buttons: {},
        encoders: {}
      };
      
      const yaml = require('js-yaml');
      const profilePath = path.join(tempDir, 'manual-profile.yaml');
      await fs.writeFile(profilePath, yaml.dump(profileData));
      
      // Reload profiles
      await profileManager.loadAvailableProfiles();
      
      expect(profileManager.availableProfiles.has('manual-profile')).toBe(true);
    });

    test('should skip invalid profile files during loading', async () => {
      // Create invalid profile file
      const invalidPath = path.join(tempDir, 'invalid-profile.yaml');
      await fs.writeFile(invalidPath, 'invalid: yaml: content');
      
      mockConfigValidator.validateConfig.mockReturnValue({
        valid: false,
        errors: ['Invalid format'],
        warnings: []
      });
      
      // Should not throw, but should log warning
      await profileManager.loadAvailableProfiles();
      
      expect(mockLogger.warn).toHaveBeenCalled();
      expect(profileManager.availableProfiles.has('invalid-profile')).toBe(false);
    });
  });
});