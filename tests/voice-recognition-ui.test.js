/**
 * Voice Recognition UI Test Suite
 * Tests the VoiceRecognitionUI class functionality
 */

// Mock electron API
const mockElectronAPI = {
  getVoiceRecognitionStatus: jest.fn(),
  startVoiceRecognitionListening: jest.fn(),
  stopVoiceRecognitionListening: jest.fn(),
  pauseVoiceRecognitionListening: jest.fn(),
  resumeVoiceRecognitionListening: jest.fn(),
  addVoiceCommand: jest.fn(),
  removeVoiceCommand: jest.fn(),
  getVoiceCommands: jest.fn(),
  testVoiceCommand: jest.fn(),
  switchVoiceProfile: jest.fn(),
  getCurrentVoiceProfile: jest.fn(),
  getVoiceProfiles: jest.fn(),
  createVoiceProfile: jest.fn(),
  startVoiceTraining: jest.fn(),
  setVoiceAudioGain: jest.fn(),
  setVoiceNoiseThreshold: jest.fn(),
  setVoiceConfidenceThreshold: jest.fn(),
  getVoiceStatistics: jest.fn(),
  clearVoiceStatistics: jest.fn(),
  onVoiceRecognitionEvent: jest.fn(),
  offVoiceRecognitionEvent: jest.fn()
};

// Set up global electronAPI
global.electronAPI = mockElectronAPI;

// Mock DOM methods
global.document = {
  createElement: jest.fn(() => ({
    innerHTML: '',
    appendChild: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      contains: jest.fn()
    },
    style: {},
    id: '',
    className: '',
    textContent: '',
    value: '',
    checked: false
  })),
  getElementById: jest.fn(),
  querySelector: jest.fn(),
  querySelectorAll: jest.fn(() => []),
  body: {
    appendChild: jest.fn(),
    removeChild: jest.fn()
  },
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
};

global.window = {
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
};

// Mock Chart.js
global.Chart = jest.fn(() => ({
  destroy: jest.fn(),
  update: jest.fn(),
  data: { datasets: [] }
}));

// Load the VoiceRecognitionUI class
const fs = require('fs');
const path = require('path');
const voiceUIPath = path.join(__dirname, '../src/renderer/VoiceRecognitionUI.js');
const voiceUICode = fs.readFileSync(voiceUIPath, 'utf8');

// Execute the code in our test environment
eval(voiceUICode);

describe('VoiceRecognitionUI', () => {
  let voiceUI;
  let mockModal;
  let mockContainer;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock DOM elements
    mockModal = {
      innerHTML: '',
      appendChild: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn(() => false)
      },
      style: { display: 'none' },
      querySelector: jest.fn(),
      querySelectorAll: jest.fn(() => [])
    };
    
    mockContainer = {
      appendChild: jest.fn(),
      querySelector: jest.fn(() => mockModal)
    };
    
    // Mock electronAPI responses
    mockElectronAPI.getVoiceRecognitionStatus.mockResolvedValue({
      initialized: true,
      listening: false,
      currentProfile: 'default',
      engineSupported: true,
      audioPermission: true
    });
    
    mockElectronAPI.getVoiceProfiles.mockResolvedValue([
      {
        id: 'default',
        name: 'Default Profile',
        language: 'en-US',
        commands: [
          { phrase: 'open calculator', action: 'open_calculator' }
        ]
      }
    ]);
    
    mockElectronAPI.getCurrentVoiceProfile.mockResolvedValue({
      id: 'default',
      name: 'Default Profile',
      language: 'en-US'
    });
    
    mockElectronAPI.getVoiceCommands.mockResolvedValue([
      {
        phrase: 'open calculator',
        action: 'open_calculator',
        confidence: 0.8,
        profileId: 'default'
      }
    ]);
    
    mockElectronAPI.getVoiceStatistics.mockResolvedValue({
      totalCommands: 10,
      successfulCommands: 8,
      failedCommands: 2,
      sessionDuration: 3600000,
      successRate: 80,
      averageConfidence: 0.75
    });
    
    // Create instance
    voiceUI = new VoiceRecognitionUI(mockContainer);
  });
  
  afterEach(() => {
    if (voiceUI) {
      voiceUI.destroy();
    }
  });

  describe('Initialization', () => {
    test('should create voice recognition UI successfully', () => {
      expect(voiceUI).toBeDefined();
      expect(voiceUI.container).toBe(mockContainer);
      expect(voiceUI.isVisible).toBe(false);
    });

    test('should throw error with invalid container', () => {
      expect(() => new VoiceRecognitionUI(null)).toThrow('Container element is required');
    });

    test('should check API availability on creation', () => {
      expect(voiceUI.apiAvailable).toBe(true);
    });
  });

  describe('Modal Management', () => {
    test('should show modal successfully', async () => {
      mockModal.querySelector.mockReturnValue({ focus: jest.fn() });
      
      await voiceUI.show();
      
      expect(voiceUI.isVisible).toBe(true);
      expect(mockModal.style.display).toBe('flex');
    });

    test('should hide modal successfully', () => {
      voiceUI.isVisible = true;
      mockModal.style.display = 'flex';
      
      voiceUI.hide();
      
      expect(voiceUI.isVisible).toBe(false);
      expect(mockModal.style.display).toBe('none');
    });

    test('should not show modal when API unavailable', async () => {
      voiceUI.apiAvailable = false;
      
      await voiceUI.show();
      
      expect(voiceUI.isVisible).toBe(false);
    });
  });

  describe('Voice Control', () => {
    beforeEach(async () => {
      mockModal.querySelector.mockReturnValue({ focus: jest.fn() });
      await voiceUI.show();
    });

    test('should start listening successfully', async () => {
      mockElectronAPI.startVoiceRecognitionListening.mockResolvedValue(true);
      
      await voiceUI.startListening();
      
      expect(mockElectronAPI.startVoiceRecognitionListening).toHaveBeenCalled();
    });

    test('should stop listening successfully', async () => {
      mockElectronAPI.stopVoiceRecognitionListening.mockResolvedValue(true);
      
      await voiceUI.stopListening();
      
      expect(mockElectronAPI.stopVoiceRecognitionListening).toHaveBeenCalled();
    });

    test('should pause listening successfully', async () => {
      mockElectronAPI.pauseVoiceRecognitionListening.mockResolvedValue(true);
      
      await voiceUI.pauseListening();
      
      expect(mockElectronAPI.pauseVoiceRecognitionListening).toHaveBeenCalled();
    });

    test('should resume listening successfully', async () => {
      mockElectronAPI.resumeVoiceRecognitionListening.mockResolvedValue(true);
      
      await voiceUI.resumeListening();
      
      expect(mockElectronAPI.resumeVoiceRecognitionListening).toHaveBeenCalled();
    });

    test('should handle listening errors gracefully', async () => {
      mockElectronAPI.startVoiceRecognitionListening.mockRejectedValue(new Error('Audio permission denied'));
      
      await voiceUI.startListening();
      
      // Should not throw, error should be handled internally
      expect(mockElectronAPI.startVoiceRecognitionListening).toHaveBeenCalled();
    });
  });

  describe('Command Management', () => {
    beforeEach(async () => {
      mockModal.querySelector.mockReturnValue({ focus: jest.fn() });
      await voiceUI.show();
    });

    test('should add command successfully', async () => {
      mockElectronAPI.addVoiceCommand.mockResolvedValue(true);
      
      await voiceUI.addCommand('test phrase', 'test_action', 0.8);
      
      expect(mockElectronAPI.addVoiceCommand).toHaveBeenCalledWith(
        'default',
        'test phrase',
        'test_action',
        0.8
      );
    });

    test('should remove command successfully', async () => {
      mockElectronAPI.removeVoiceCommand.mockResolvedValue(true);
      
      await voiceUI.removeCommand('test phrase');
      
      expect(mockElectronAPI.removeVoiceCommand).toHaveBeenCalledWith('test phrase');
    });

    test('should test command successfully', async () => {
      mockElectronAPI.testVoiceCommand.mockResolvedValue({
        matched: true,
        action: 'test_action',
        confidence: 0.9
      });
      
      const result = await voiceUI.testCommand('test phrase');
      
      expect(result.matched).toBe(true);
      expect(mockElectronAPI.testVoiceCommand).toHaveBeenCalledWith('test phrase');
    });

    test('should load commands successfully', async () => {
      await voiceUI.loadCommands();
      
      expect(mockElectronAPI.getVoiceCommands).toHaveBeenCalled();
    });
  });

  describe('Profile Management', () => {
    beforeEach(async () => {
      mockModal.querySelector.mockReturnValue({ focus: jest.fn() });
      await voiceUI.show();
    });

    test('should switch profile successfully', async () => {
      mockElectronAPI.switchVoiceProfile.mockResolvedValue(true);
      
      await voiceUI.switchProfile('test-profile');
      
      expect(mockElectronAPI.switchVoiceProfile).toHaveBeenCalledWith('test-profile');
    });

    test('should create profile successfully', async () => {
      mockElectronAPI.createVoiceProfile.mockResolvedValue('new-profile-id');
      
      const profileData = {
        name: 'Test Profile',
        language: 'en-US',
        commands: []
      };
      
      const profileId = await voiceUI.createProfile(profileData);
      
      expect(profileId).toBe('new-profile-id');
      expect(mockElectronAPI.createVoiceProfile).toHaveBeenCalledWith(profileData);
    });

    test('should load profiles successfully', async () => {
      await voiceUI.loadProfiles();
      
      expect(mockElectronAPI.getVoiceProfiles).toHaveBeenCalled();
    });
  });

  describe('Voice Training', () => {
    beforeEach(async () => {
      mockModal.querySelector.mockReturnValue({ focus: jest.fn() });
      await voiceUI.show();
    });

    test('should start command training successfully', async () => {
      mockElectronAPI.startVoiceTraining.mockResolvedValue(true);
      
      await voiceUI.startCommandTraining();
      
      expect(mockElectronAPI.startVoiceTraining).toHaveBeenCalledWith('command');
    });

    test('should start vocabulary training successfully', async () => {
      mockElectronAPI.startVoiceTraining.mockResolvedValue(true);
      
      await voiceUI.startVocabularyTraining();
      
      expect(mockElectronAPI.startVoiceTraining).toHaveBeenCalledWith('vocabulary');
    });

    test('should start accent training successfully', async () => {
      mockElectronAPI.startVoiceTraining.mockResolvedValue(true);
      
      await voiceUI.startAccentTraining();
      
      expect(mockElectronAPI.startVoiceTraining).toHaveBeenCalledWith('accent');
    });
  });

  describe('Audio Settings', () => {
    beforeEach(async () => {
      mockModal.querySelector.mockReturnValue({ focus: jest.fn() });
      await voiceUI.show();
    });

    test('should update audio gain successfully', async () => {
      await voiceUI.updateAudioGain(1.5);
      
      expect(mockElectronAPI.setVoiceAudioGain).toHaveBeenCalledWith(1.5);
    });

    test('should update noise threshold successfully', async () => {
      await voiceUI.updateNoiseThreshold(0.3);
      
      expect(mockElectronAPI.setVoiceNoiseThreshold).toHaveBeenCalledWith(0.3);
    });

    test('should update confidence threshold successfully', async () => {
      await voiceUI.updateConfidenceThreshold(0.8);
      
      expect(mockElectronAPI.setVoiceConfidenceThreshold).toHaveBeenCalledWith(0.8);
    });
  });

  describe('Statistics', () => {
    beforeEach(async () => {
      mockModal.querySelector.mockReturnValue({ focus: jest.fn() });
      await voiceUI.show();
    });

    test('should load statistics successfully', async () => {
      await voiceUI.loadStatistics();
      
      expect(mockElectronAPI.getVoiceStatistics).toHaveBeenCalled();
    });

    test('should clear statistics successfully', async () => {
      mockElectronAPI.clearVoiceStatistics.mockResolvedValue(true);
      
      await voiceUI.clearStatistics();
      
      expect(mockElectronAPI.clearVoiceStatistics).toHaveBeenCalled();
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      mockModal.querySelector.mockReturnValue({ focus: jest.fn() });
      await voiceUI.show();
    });

    test('should setup event listeners on show', async () => {
      expect(mockElectronAPI.onVoiceRecognitionEvent).toHaveBeenCalled();
    });

    test('should handle voice recognition events', () => {
      // Simulate event handler setup
      const eventHandlers = {};
      mockElectronAPI.onVoiceRecognitionEvent.mockImplementation((event, handler) => {
        eventHandlers[event] = handler;
      });
      
      // Re-initialize to setup handlers
      voiceUI.setupEventListeners();
      
      expect(eventHandlers['listening-started']).toBeDefined();
      expect(eventHandlers['command-recognized']).toBeDefined();
      expect(eventHandlers['training-progress']).toBeDefined();
    });

    test('should cleanup event listeners on destroy', () => {
      voiceUI.destroy();
      
      expect(mockElectronAPI.offVoiceRecognitionEvent).toHaveBeenCalled();
    });
  });

  describe('Tab Navigation', () => {
    let mockTabs, mockTabContents;
    
    beforeEach(async () => {
      mockTabs = [
        { classList: { add: jest.fn(), remove: jest.fn() }, dataset: { tab: 'voice-control' } },
        { classList: { add: jest.fn(), remove: jest.fn() }, dataset: { tab: 'commands' } },
        { classList: { add: jest.fn(), remove: jest.fn() }, dataset: { tab: 'training' } }
      ];
      
      mockTabContents = [
        { classList: { add: jest.fn(), remove: jest.fn() }, id: 'voice-control-tab' },
        { classList: { add: jest.fn(), remove: jest.fn() }, id: 'commands-tab' },
        { classList: { add: jest.fn(), remove: jest.fn() }, id: 'training-tab' }
      ];
      
      mockModal.querySelectorAll.mockImplementation((selector) => {
        if (selector.includes('.tab-button')) return mockTabs;
        if (selector.includes('.tab-content')) return mockTabContents;
        return [];
      });
      
      await voiceUI.show();
    });

    test('should switch tabs successfully', () => {
      voiceUI.switchTab('commands');
      
      // Should remove active class from all tabs
      mockTabs.forEach(tab => {
        expect(tab.classList.remove).toHaveBeenCalledWith('active');
      });
      
      mockTabContents.forEach(content => {
        expect(content.classList.remove).toHaveBeenCalledWith('active');
      });
      
      expect(voiceUI.activeTab).toBe('commands');
    });

    test('should set first tab as active by default', () => {
      expect(voiceUI.activeTab).toBe('voice-control');
    });
  });

  describe('Form Validation', () => {
    beforeEach(async () => {
      mockModal.querySelector.mockReturnValue({ focus: jest.fn() });
      await voiceUI.show();
    });

    test('should validate command phrase input', () => {
      const isValid = voiceUI.validateCommandPhrase('test command');
      expect(isValid).toBe(true);
    });

    test('should reject empty command phrase', () => {
      const isValid = voiceUI.validateCommandPhrase('');
      expect(isValid).toBe(false);
    });

    test('should reject command phrase that is too short', () => {
      const isValid = voiceUI.validateCommandPhrase('hi');
      expect(isValid).toBe(false);
    });

    test('should validate profile name input', () => {
      const isValid = voiceUI.validateProfileName('Test Profile');
      expect(isValid).toBe(true);
    });

    test('should reject empty profile name', () => {
      const isValid = voiceUI.validateProfileName('');
      expect(isValid).toBe(false);
    });
  });

  describe('Audio Visualization', () => {
    let mockCanvas, mockContext;
    
    beforeEach(async () => {
      mockCanvas = {
        getContext: jest.fn(),
        width: 400,
        height: 100
      };
      
      mockContext = {
        clearRect: jest.fn(),
        fillRect: jest.fn(),
        beginPath: jest.fn(),
        moveTo: jest.fn(),
        lineTo: jest.fn(),
        stroke: jest.fn(),
        fillStyle: '',
        strokeStyle: ''
      };
      
      mockCanvas.getContext.mockReturnValue(mockContext);
      mockModal.querySelector.mockReturnValue(mockCanvas);
      
      await voiceUI.show();
    });

    test('should initialize audio visualization canvas', () => {
      expect(mockCanvas.getContext).toHaveBeenCalledWith('2d');
    });

    test('should draw audio waveform', () => {
      const audioData = new Array(128).fill(0).map((_, i) => Math.sin(i * 0.1) * 128 + 128);
      
      voiceUI.drawAudioVisualization(audioData);
      
      expect(mockContext.clearRect).toHaveBeenCalled();
      expect(mockContext.beginPath).toHaveBeenCalled();
    });

    test('should handle empty audio data', () => {
      voiceUI.drawAudioVisualization([]);
      
      expect(mockContext.clearRect).toHaveBeenCalled();
    });
  });

  describe('Notification System', () => {
    beforeEach(async () => {
      mockModal.querySelector.mockReturnValue({ focus: jest.fn() });
      await voiceUI.show();
    });

    test('should show success notification', () => {
      voiceUI.showNotification('Test message', 'success');
      
      expect(voiceUI.notifications.length).toBe(1);
      expect(voiceUI.notifications[0].type).toBe('success');
      expect(voiceUI.notifications[0].message).toBe('Test message');
    });

    test('should show error notification', () => {
      voiceUI.showNotification('Error message', 'error');
      
      expect(voiceUI.notifications.length).toBe(1);
      expect(voiceUI.notifications[0].type).toBe('error');
    });

    test('should clear notifications automatically', (done) => {
      voiceUI.showNotification('Test message', 'success');
      
      setTimeout(() => {
        expect(voiceUI.notifications.length).toBe(0);
        done();
      }, 100);
    });
  });

  describe('Keyboard Shortcuts', () => {
    let mockKeyboardEvent;
    
    beforeEach(async () => {
      mockKeyboardEvent = {
        key: 'Enter',
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn()
      };
      
      mockModal.querySelector.mockReturnValue({ focus: jest.fn() });
      await voiceUI.show();
    });

    test('should close modal on Escape key', () => {
      mockKeyboardEvent.key = 'Escape';
      
      voiceUI.handleKeyPress(mockKeyboardEvent);
      
      expect(voiceUI.isVisible).toBe(false);
    });

    test('should switch tabs with number keys', () => {
      mockKeyboardEvent.key = '2';
      mockKeyboardEvent.ctrlKey = true;
      
      voiceUI.handleKeyPress(mockKeyboardEvent);
      
      expect(voiceUI.activeTab).toBe('commands');
    });

    test('should start listening with Space key', async () => {
      mockKeyboardEvent.key = ' ';
      mockElectronAPI.getVoiceRecognitionStatus.mockResolvedValue({
        listening: false
      });
      mockElectronAPI.startVoiceRecognitionListening.mockResolvedValue(true);
      
      await voiceUI.handleKeyPress(mockKeyboardEvent);
      
      expect(mockElectronAPI.startVoiceRecognitionListening).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      mockModal.querySelector.mockReturnValue({ focus: jest.fn() });
      await voiceUI.show();
    });

    test('should handle API errors gracefully', async () => {
      mockElectronAPI.getVoiceCommands.mockRejectedValue(new Error('API Error'));
      
      await voiceUI.loadCommands();
      
      // Should not throw, error should be handled internally
      expect(mockElectronAPI.getVoiceCommands).toHaveBeenCalled();
    });

    test('should handle missing DOM elements gracefully', () => {
      mockModal.querySelector.mockReturnValue(null);
      
      // Should not throw when elements are missing
      expect(() => voiceUI.updateUI()).not.toThrow();
    });

    test('should handle initialization errors', () => {
      global.electronAPI = null;
      
      const errorUI = new VoiceRecognitionUI(mockContainer);
      
      expect(errorUI.apiAvailable).toBe(false);
    });
  });

  describe('Memory Management', () => {
    test('should cleanup resources on destroy', () => {
      const eventListenerCount = voiceUI.eventListeners?.length || 0;
      
      voiceUI.destroy();
      
      expect(mockElectronAPI.offVoiceRecognitionEvent).toHaveBeenCalled();
      expect(voiceUI.isDestroyed).toBe(true);
    });

    test('should clear intervals and timeouts on destroy', () => {
      voiceUI.visualizationInterval = setInterval(() => {}, 100);
      voiceUI.notificationTimeout = setTimeout(() => {}, 1000);
      
      voiceUI.destroy();
      
      expect(voiceUI.visualizationInterval).toBeNull();
      expect(voiceUI.notificationTimeout).toBeNull();
    });

    test('should not perform operations after destroy', async () => {
      voiceUI.destroy();
      
      await voiceUI.show();
      
      expect(voiceUI.isVisible).toBe(false);
    });
  });
});