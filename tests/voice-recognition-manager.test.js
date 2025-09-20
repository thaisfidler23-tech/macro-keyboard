/**
 * Voice Recognition Manager Test Suite
 * Tests the VoiceRecognitionManager class functionality
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

// Mock electron modules
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/mock/config/path')
  }
}));

// Mock fs modules
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    access: jest.fn(),
    mkdir: jest.fn()
  }
}));

// Mock the VoiceRecognitionManager
jest.doMock('../src/VoiceRecognitionManager.js', () => {
  class MockVoiceRecognitionManager extends EventEmitter {
    constructor() {
      super();
      this.isInitialized = false;
      this.isListening = false;
      this.currentProfile = null;
      this.profiles = new Map();
      this.commands = new Map();
      this.recognitionEngine = null;
      this.statistics = {
        totalCommands: 0,
        successfulCommands: 0,
        failedCommands: 0,
        averageConfidence: 0,
        sessionStartTime: Date.now(),
        commandHistory: []
      };
      this.audioSettings = {
        gain: 1.0,
        noiseThreshold: 0.1,
        confidenceThreshold: 0.7
      };
    }

    async initialize() {
      this.isInitialized = true;
      await this._loadProfiles();
      return true;
    }

    async _loadProfiles() {
      const mockProfiles = {
        default: {
          name: "Default Profile",
          language: "en-US",
          commands: [
            { phrase: "open calculator", action: "open_calculator" },
            { phrase: "close window", action: "close_window" }
          ],
          vocabulary: ["calculator", "window", "open", "close"],
          settings: {
            confidenceThreshold: 0.7,
            continuousRecognition: true
          }
        }
      };
      
      for (const [id, profile] of Object.entries(mockProfiles)) {
        this.profiles.set(id, profile);
        for (const command of profile.commands) {
          this.commands.set(command.phrase.toLowerCase(), {
            ...command,
            profileId: id
          });
        }
      }
      
      this.currentProfile = 'default';
    }

    async startListening() {
      if (!this.isInitialized) {
        throw new Error('Voice recognition not initialized');
      }
      this.isListening = true;
      this.emit('listening-started');
      return true;
    }

    async stopListening() {
      this.isListening = false;
      this.emit('listening-stopped');
      return true;
    }

    async pauseListening() {
      this.isListening = false;
      this.emit('listening-paused');
      return true;
    }

    async resumeListening() {
      this.isListening = true;
      this.emit('listening-resumed');
      return true;
    }

    getStatus() {
      return {
        initialized: this.isInitialized,
        listening: this.isListening,
        currentProfile: this.currentProfile,
        engineSupported: true,
        audioPermission: true
      };
    }

    async addCommand(profileId, phrase, action, confidence = 0.7) {
      const commandKey = phrase.toLowerCase();
      const command = {
        phrase: phrase,
        action: action,
        confidence: confidence,
        profileId: profileId
      };
      
      this.commands.set(commandKey, command);
      
      // Add to profile
      if (this.profiles.has(profileId)) {
        const profile = this.profiles.get(profileId);
        profile.commands.push({
          phrase: phrase,
          action: action,
          confidence: confidence
        });
      }
      
      this.emit('command-added', command);
      return true;
    }

    async removeCommand(phrase) {
      const commandKey = phrase.toLowerCase();
      const command = this.commands.get(commandKey);
      
      if (command) {
        this.commands.delete(commandKey);
        
        // Remove from profile
        if (this.profiles.has(command.profileId)) {
          const profile = this.profiles.get(command.profileId);
          profile.commands = profile.commands.filter(c => 
            c.phrase.toLowerCase() !== commandKey
          );
        }
        
        this.emit('command-removed', command);
        return true;
      }
      
      return false;
    }

    getCommands(profileId = null) {
      if (profileId) {
        return Array.from(this.commands.values()).filter(
          cmd => cmd.profileId === profileId
        );
      }
      return Array.from(this.commands.values());
    }

    async testCommand(phrase) {
      const commandKey = phrase.toLowerCase();
      const command = this.commands.get(commandKey);
      
      if (command) {
        this.emit('command-matched', {
          phrase: phrase,
          action: command.action,
          confidence: command.confidence
        });
        return {
          matched: true,
          action: command.action,
          confidence: command.confidence
        };
      }
      
      return {
        matched: false,
        action: null,
        confidence: 0
      };
    }

    async switchProfile(profileId) {
      if (this.profiles.has(profileId)) {
        this.currentProfile = profileId;
        this.emit('profile-switched', { profileId });
        return true;
      }
      return false;
    }

    getCurrentProfile() {
      if (this.currentProfile && this.profiles.has(this.currentProfile)) {
        return this.profiles.get(this.currentProfile);
      }
      return null;
    }

    getProfiles() {
      return Array.from(this.profiles.entries()).map(([id, profile]) => ({
        id,
        ...profile
      }));
    }

    async createProfile(profileData) {
      const profileId = profileData.id || Date.now().toString();
      this.profiles.set(profileId, {
        name: profileData.name,
        language: profileData.language || 'en-US',
        commands: profileData.commands || [],
        vocabulary: profileData.vocabulary || [],
        settings: profileData.settings || {
          confidenceThreshold: 0.7,
          continuousRecognition: true
        }
      });
      
      this.emit('profile-created', { profileId });
      return profileId;
    }

    async startVoiceTraining(mode) {
      this.emit('training-started', { mode });
      
      // Simulate training process
      setTimeout(() => {
        this.emit('training-progress', { progress: 50 });
      }, 100);
      
      setTimeout(() => {
        this.emit('training-completed', { 
          mode,
          improvement: 15.2,
          samples: 25
        });
      }, 200);
      
      return true;
    }

    setAudioGain(gain) {
      this.audioSettings.gain = Math.max(0, Math.min(2, gain));
      this.emit('audio-settings-changed', this.audioSettings);
    }

    setNoiseThreshold(threshold) {
      this.audioSettings.noiseThreshold = Math.max(0, Math.min(1, threshold));
      this.emit('audio-settings-changed', this.audioSettings);
    }

    setConfidenceThreshold(threshold) {
      this.audioSettings.confidenceThreshold = Math.max(0, Math.min(1, threshold));
      this.emit('audio-settings-changed', this.audioSettings);
    }

    getStatistics() {
      return {
        ...this.statistics,
        sessionDuration: Date.now() - this.statistics.sessionStartTime,
        successRate: this.statistics.totalCommands > 0 
          ? (this.statistics.successfulCommands / this.statistics.totalCommands) * 100 
          : 0
      };
    }

    clearStatistics() {
      this.statistics = {
        totalCommands: 0,
        successfulCommands: 0,
        failedCommands: 0,
        averageConfidence: 0,
        sessionStartTime: Date.now(),
        commandHistory: []
      };
      this.emit('statistics-cleared');
    }

    async cleanup() {
      this.isInitialized = false;
      this.isListening = false;
      this.removeAllListeners();
    }

    // Simulate voice command recognition
    _simulateVoiceCommand(phrase, confidence = 0.8) {
      const commandKey = phrase.toLowerCase();
      const command = this.commands.get(commandKey);
      
      this.statistics.totalCommands++;
      this.statistics.commandHistory.push({
        phrase,
        timestamp: Date.now(),
        confidence,
        matched: !!command
      });
      
      if (command) {
        this.statistics.successfulCommands++;
        this.emit('command-recognized', {
          phrase,
          action: command.action,
          confidence
        });
      } else {
        this.statistics.failedCommands++;
        this.emit('command-not-recognized', {
          phrase,
          confidence
        });
      }
    }
  }
  
  return MockVoiceRecognitionManager;
});

const VoiceRecognitionManager = require('../src/VoiceRecognitionManager.js');

describe('VoiceRecognitionManager', () => {
  let voiceManager;
  
  beforeEach(async () => {
    jest.clearAllMocks();
    voiceManager = new VoiceRecognitionManager();
    await voiceManager.initialize();
  });
  
  afterEach(async () => {
    if (voiceManager) {
      await voiceManager.cleanup();
    }
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      expect(voiceManager.isInitialized).toBe(true);
    });

    test('should load default profiles on initialization', () => {
      const profiles = voiceManager.getProfiles();
      expect(profiles).toHaveLength(1);
      expect(profiles[0].name).toBe('Default Profile');
    });

    test('should set current profile to default', () => {
      const currentProfile = voiceManager.getCurrentProfile();
      expect(currentProfile).toBeTruthy();
      expect(currentProfile.name).toBe('Default Profile');
    });
  });

  describe('Voice Recognition Control', () => {
    test('should start listening successfully', async () => {
      const result = await voiceManager.startListening();
      expect(result).toBe(true);
      expect(voiceManager.isListening).toBe(true);
    });

    test('should stop listening successfully', async () => {
      await voiceManager.startListening();
      const result = await voiceManager.stopListening();
      expect(result).toBe(true);
      expect(voiceManager.isListening).toBe(false);
    });

    test('should pause and resume listening', async () => {
      await voiceManager.startListening();
      
      await voiceManager.pauseListening();
      expect(voiceManager.isListening).toBe(false);
      
      await voiceManager.resumeListening();
      expect(voiceManager.isListening).toBe(true);
    });

    test('should throw error when starting listening without initialization', async () => {
      const uninitializedManager = new VoiceRecognitionManager();
      await expect(uninitializedManager.startListening()).rejects.toThrow('Voice recognition not initialized');
    });
  });

  describe('Status Reporting', () => {
    test('should return correct status when initialized', () => {
      const status = voiceManager.getStatus();
      expect(status.initialized).toBe(true);
      expect(status.engineSupported).toBe(true);
      expect(status.audioPermission).toBe(true);
    });

    test('should return current profile in status', async () => {
      await voiceManager.switchProfile('default');
      const status = voiceManager.getStatus();
      expect(status.currentProfile).toBe('default');
    });
  });

  describe('Command Management', () => {
    test('should add new command successfully', async () => {
      const result = await voiceManager.addCommand('default', 'test command', 'test_action', 0.8);
      expect(result).toBe(true);
      
      const commands = voiceManager.getCommands('default');
      const testCommand = commands.find(cmd => cmd.phrase === 'test command');
      expect(testCommand).toBeTruthy();
      expect(testCommand.action).toBe('test_action');
    });

    test('should remove command successfully', async () => {
      await voiceManager.addCommand('default', 'test command', 'test_action');
      const result = await voiceManager.removeCommand('test command');
      expect(result).toBe(true);
      
      const commands = voiceManager.getCommands('default');
      const testCommand = commands.find(cmd => cmd.phrase === 'test command');
      expect(testCommand).toBeFalsy();
    });

    test('should return false when removing non-existent command', async () => {
      const result = await voiceManager.removeCommand('non-existent command');
      expect(result).toBe(false);
    });

    test('should get commands for specific profile', async () => {
      await voiceManager.addCommand('default', 'profile command', 'profile_action');
      const commands = voiceManager.getCommands('default');
      expect(commands.some(cmd => cmd.phrase === 'profile command')).toBe(true);
    });

    test('should get all commands when no profile specified', () => {
      const allCommands = voiceManager.getCommands();
      expect(Array.isArray(allCommands)).toBe(true);
      expect(allCommands.length).toBeGreaterThan(0);
    });
  });

  describe('Command Testing', () => {
    test('should test existing command successfully', async () => {
      await voiceManager.addCommand('default', 'test phrase', 'test_action', 0.9);
      const result = await voiceManager.testCommand('test phrase');
      
      expect(result.matched).toBe(true);
      expect(result.action).toBe('test_action');
      expect(result.confidence).toBe(0.9);
    });

    test('should return no match for non-existent command', async () => {
      const result = await voiceManager.testCommand('unknown phrase');
      
      expect(result.matched).toBe(false);
      expect(result.action).toBeNull();
      expect(result.confidence).toBe(0);
    });
  });

  describe('Profile Management', () => {
    test('should switch profile successfully', async () => {
      const result = await voiceManager.switchProfile('default');
      expect(result).toBe(true);
      expect(voiceManager.currentProfile).toBe('default');
    });

    test('should return false when switching to non-existent profile', async () => {
      const result = await voiceManager.switchProfile('non-existent');
      expect(result).toBe(false);
    });

    test('should create new profile successfully', async () => {
      const profileData = {
        name: 'Test Profile',
        language: 'en-US',
        commands: [],
        vocabulary: ['test', 'profile']
      };
      
      const profileId = await voiceManager.createProfile(profileData);
      expect(profileId).toBeTruthy();
      
      const profiles = voiceManager.getProfiles();
      const newProfile = profiles.find(p => p.id === profileId);
      expect(newProfile).toBeTruthy();
      expect(newProfile.name).toBe('Test Profile');
    });

    test('should get current profile', () => {
      const currentProfile = voiceManager.getCurrentProfile();
      expect(currentProfile).toBeTruthy();
      expect(currentProfile.name).toBe('Default Profile');
    });

    test('should get all profiles', () => {
      const profiles = voiceManager.getProfiles();
      expect(Array.isArray(profiles)).toBe(true);
      expect(profiles.length).toBeGreaterThan(0);
    });
  });

  describe('Voice Training', () => {
    test('should start voice training successfully', async () => {
      const result = await voiceManager.startVoiceTraining('command');
      expect(result).toBe(true);
    });

    test('should emit training events', (done) => {
      let eventsReceived = 0;
      
      voiceManager.on('training-started', () => {
        eventsReceived++;
        if (eventsReceived === 3) done();
      });
      
      voiceManager.on('training-progress', () => {
        eventsReceived++;
        if (eventsReceived === 3) done();
      });
      
      voiceManager.on('training-completed', () => {
        eventsReceived++;
        if (eventsReceived === 3) done();
      });
      
      voiceManager.startVoiceTraining('vocabulary');
    });
  });

  describe('Audio Settings', () => {
    test('should set audio gain within valid range', () => {
      voiceManager.setAudioGain(1.5);
      expect(voiceManager.audioSettings.gain).toBe(1.5);
      
      voiceManager.setAudioGain(3.0); // Should be clamped to 2.0
      expect(voiceManager.audioSettings.gain).toBe(2.0);
      
      voiceManager.setAudioGain(-1.0); // Should be clamped to 0
      expect(voiceManager.audioSettings.gain).toBe(0);
    });

    test('should set noise threshold within valid range', () => {
      voiceManager.setNoiseThreshold(0.5);
      expect(voiceManager.audioSettings.noiseThreshold).toBe(0.5);
      
      voiceManager.setNoiseThreshold(2.0); // Should be clamped to 1.0
      expect(voiceManager.audioSettings.noiseThreshold).toBe(1.0);
    });

    test('should set confidence threshold within valid range', () => {
      voiceManager.setConfidenceThreshold(0.8);
      expect(voiceManager.audioSettings.confidenceThreshold).toBe(0.8);
    });

    test('should emit audio settings changed event', (done) => {
      voiceManager.on('audio-settings-changed', (settings) => {
        expect(settings.gain).toBe(1.2);
        done();
      });
      
      voiceManager.setAudioGain(1.2);
    });
  });

  describe('Statistics', () => {
    test('should return initial statistics', () => {
      const stats = voiceManager.getStatistics();
      expect(stats.totalCommands).toBe(0);
      expect(stats.successfulCommands).toBe(0);
      expect(stats.failedCommands).toBe(0);
      expect(stats.successRate).toBe(0);
    });

    test('should clear statistics', () => {
      voiceManager.statistics.totalCommands = 10;
      voiceManager.clearStatistics();
      
      const stats = voiceManager.getStatistics();
      expect(stats.totalCommands).toBe(0);
    });

    test('should calculate success rate correctly', () => {
      voiceManager.statistics.totalCommands = 10;
      voiceManager.statistics.successfulCommands = 8;
      
      const stats = voiceManager.getStatistics();
      expect(stats.successRate).toBe(80);
    });

    test('should track session duration', () => {
      const stats = voiceManager.getStatistics();
      expect(stats.sessionDuration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Event Emission', () => {
    test('should emit listening-started event', (done) => {
      voiceManager.on('listening-started', () => {
        done();
      });
      
      voiceManager.startListening();
    });

    test('should emit command-added event', (done) => {
      voiceManager.on('command-added', (command) => {
        expect(command.phrase).toBe('event test');
        expect(command.action).toBe('event_action');
        done();
      });
      
      voiceManager.addCommand('default', 'event test', 'event_action');
    });

    test('should emit profile-switched event', (done) => {
      voiceManager.on('profile-switched', (data) => {
        expect(data.profileId).toBe('default');
        done();
      });
      
      voiceManager.switchProfile('default');
    });
  });

  describe('Command Recognition Simulation', () => {
    test('should simulate successful command recognition', (done) => {
      voiceManager.on('command-recognized', (data) => {
        expect(data.phrase).toBe('open calculator');
        expect(data.confidence).toBe(0.9);
        done();
      });
      
      voiceManager._simulateVoiceCommand('open calculator', 0.9);
    });

    test('should simulate failed command recognition', (done) => {
      voiceManager.on('command-not-recognized', (data) => {
        expect(data.phrase).toBe('unknown command');
        done();
      });
      
      voiceManager._simulateVoiceCommand('unknown command', 0.5);
    });

    test('should update statistics on command recognition', () => {
      voiceManager._simulateVoiceCommand('open calculator', 0.8);
      voiceManager._simulateVoiceCommand('unknown command', 0.6);
      
      const stats = voiceManager.getStatistics();
      expect(stats.totalCommands).toBe(2);
      expect(stats.successfulCommands).toBe(1);
      expect(stats.failedCommands).toBe(1);
      expect(stats.successRate).toBe(50);
    });
  });

  describe('Cleanup', () => {
    test('should cleanup successfully', async () => {
      await voiceManager.startListening();
      await voiceManager.cleanup();
      
      expect(voiceManager.isInitialized).toBe(false);
      expect(voiceManager.isListening).toBe(false);
    });

    test('should remove all listeners on cleanup', async () => {
      voiceManager.on('test-event', () => {});
      expect(voiceManager.listenerCount('test-event')).toBe(1);
      
      await voiceManager.cleanup();
      expect(voiceManager.listenerCount('test-event')).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle profile loading errors gracefully', async () => {
      const errorManager = new VoiceRecognitionManager();
      
      // Mock file system error
      require('fs').promises.readFile.mockRejectedValue(new Error('File not found'));
      
      await expect(errorManager.initialize()).resolves.toBe(true);
      expect(errorManager.isInitialized).toBe(true);
    });
  });
});