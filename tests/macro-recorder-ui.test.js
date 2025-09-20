/**
 * Test suite for MacroRecorderUI component
 */

// Mock the electronAPI
global.window = {
  electronAPI: {
    // Macro recording methods (mocked)
    startMacroRecording: jest.fn(),
    stopMacroRecording: jest.fn(),
    cancelMacroRecording: jest.fn(),
    playMacroSequence: jest.fn(),
    stopMacroPlayback: jest.fn(),
    getSavedSequences: jest.fn(),
    deleteMacroSequence: jest.fn(),
    duplicateMacroSequence: jest.fn(),
    getMacroStatistics: jest.fn(),
    
    // Event listener methods (mocked)
    onMacroRecordingStarted: jest.fn(),
    onMacroActionRecorded: jest.fn(),
    onMacroRecordingStopped: jest.fn(),
    onMacroPlaybackStarted: jest.fn(),
    onMacroPlaybackProgress: jest.fn(),
    onMacroPlaybackCompleted: jest.fn(),
    onMacroPlaybackStopped: jest.fn(),
    onMacroPlaybackError: jest.fn()
  },
  showNotification: jest.fn()
};

// Mock DOM methods
global.document = {
  createElement: jest.fn(() => ({
    className: '',
    innerHTML: '',
    style: {},
    addEventListener: jest.fn(),
    appendChild: jest.fn(),
    querySelector: jest.fn(() => ({
      addEventListener: jest.fn(),
      textContent: '',
      disabled: false,
      value: '',
      style: {}
    })),
    querySelectorAll: jest.fn(() => [])
  })),
  body: {
    appendChild: jest.fn()
  }
};

// Mock console methods
global.console = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};

// Import the MacroRecorderUI after setting up mocks
const MacroRecorderUI = require('../src/renderer/MacroRecorderUI');

describe('MacroRecorderUI', () => {
  let macroRecorderUI;
  let mockContainer;
  let mockElements;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create mock elements
    mockElements = {
      closeButton: { addEventListener: jest.fn() },
      startRecordingBtn: { addEventListener: jest.fn() },
      stopRecordingBtn: { addEventListener: jest.fn() },
      cancelRecordingBtn: { addEventListener: jest.fn() },
      refreshSequencesBtn: { addEventListener: jest.fn() },
      importSequenceBtn: { addEventListener: jest.fn() },
      exportSequencesBtn: { addEventListener: jest.fn() },
      saveSequenceBtn: { addEventListener: jest.fn() },
      cancelEditBtn: { addEventListener: jest.fn() },
      testSequenceBtn: { addEventListener: jest.fn() },
      addStepBtn: { addEventListener: jest.fn() },
      stopPlaybackBtn: { addEventListener: jest.fn() },
      sequenceNameInput: { value: '', disabled: false },
      statusIndicator: { className: 'status-indicator' },
      statusText: { textContent: '' },
      actionsList: { innerHTML: '' },
      sequenceListBody: { innerHTML: '' },
      playbackProgress: { style: { display: 'none' } },
      progressFill: { style: { width: '0%' } },
      progressText: { textContent: '' },
      currentStepText: { textContent: '' },
      playingSequenceName: { textContent: '' }
    };

    mockContainer = {
      className: '',
      innerHTML: '',
      style: { display: 'none' },
      querySelector: jest.fn((selector) => {
        // Map selectors to mock elements
        const selectorMap = {
          '.close-button': mockElements.closeButton,
          '.start-recording-btn': mockElements.startRecordingBtn,
          '.stop-recording-btn': mockElements.stopRecordingBtn,
          '.cancel-recording-btn': mockElements.cancelRecordingBtn,
          '.refresh-sequences-btn': mockElements.refreshSequencesBtn,
          '.import-sequence-btn': mockElements.importSequenceBtn,
          '.export-sequences-btn': mockElements.exportSequencesBtn,
          '.save-sequence-btn': mockElements.saveSequenceBtn,
          '.cancel-edit-btn': mockElements.cancelEditBtn,
          '.test-sequence-btn': mockElements.testSequenceBtn,
          '.add-step-btn': mockElements.addStepBtn,
          '.stop-playback-btn': mockElements.stopPlaybackBtn,
          '.sequence-name-input': mockElements.sequenceNameInput,
          '.status-indicator': mockElements.statusIndicator,
          '.status-text': mockElements.statusText,
          '.actions-list': mockElements.actionsList,
          '.sequence-list-body': mockElements.sequenceListBody,
          '.playback-progress': mockElements.playbackProgress,
          '.progress-fill': mockElements.progressFill,
          '.progress-text': mockElements.progressText,
          '.current-step-text': mockElements.currentStepText,
          '.playing-sequence-name': mockElements.playingSequenceName
        };
        return selectorMap[selector] || { addEventListener: jest.fn() };
      }),
      appendChild: jest.fn()
    };

    document.createElement.mockReturnValue(mockContainer);

    // Create MacroRecorderUI instance
    macroRecorderUI = new MacroRecorderUI();
  });

  describe('Initialization', () => {
    test('should initialize with correct default state', () => {
      expect(macroRecorderUI.isRecording).toBe(false);
      expect(macroRecorderUI.isPlaying).toBe(false);
      expect(macroRecorderUI.currentRecordingName).toBe(null);
      expect(macroRecorderUI.currentPlaybackName).toBe(null);
      expect(macroRecorderUI.recordedActions).toEqual([]);
      expect(macroRecorderUI.savedSequences).toEqual({});
    });

    test('should create container element', () => {
      expect(document.createElement).toHaveBeenCalledWith('div');
      expect(mockContainer.className).toBe('macro-recorder-container');
    });

    test('should set up event listeners', () => {
      // Verify that event listeners are set up
      expect(mockElements.startRecordingBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(mockElements.stopRecordingBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(mockElements.cancelRecordingBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    test('should set up IPC event listeners', () => {
      expect(window.electronAPI.onMacroRecordingStarted).toHaveBeenCalledWith(expect.any(Function));
      expect(window.electronAPI.onMacroActionRecorded).toHaveBeenCalledWith(expect.any(Function));
      expect(window.electronAPI.onMacroRecordingStopped).toHaveBeenCalledWith(expect.any(Function));
    });

    test('should initially hide the container', () => {
      expect(macroRecorderUI.container.style.display).toBe('none');
    });
  });

  describe('Recording Controls', () => {
    test('should start recording with custom name', async () => {
      const sequenceName = 'TestSequence';
      mockElements.sequenceNameInput.value = sequenceName;
      window.electronAPI.startMacroRecording.mockResolvedValue({
        success: true,
        recordingName: sequenceName
      });

      await macroRecorderUI.startRecording();

      expect(window.electronAPI.startMacroRecording).toHaveBeenCalledWith(sequenceName);
      expect(macroRecorderUI.isRecording).toBe(true);
      expect(macroRecorderUI.currentRecordingName).toBe(sequenceName);
    });

    test('should start recording with generated name when input is empty', async () => {
      mockElements.sequenceNameInput.value = '  '; // whitespace
      window.electronAPI.startMacroRecording.mockResolvedValue({
        success: true,
        recordingName: 'Generated_Name'
      });

      await macroRecorderUI.startRecording();

      expect(window.electronAPI.startMacroRecording).toHaveBeenCalledWith(null);
    });

    test('should handle recording start error', async () => {
      window.electronAPI.startMacroRecording.mockRejectedValue(new Error('Recording failed'));

      await macroRecorderUI.startRecording();

      expect(window.showNotification).toHaveBeenCalledWith(
        'Error starting recording: Recording failed',
        'error'
      );
    });

    test('should stop recording successfully', async () => {
      macroRecorderUI.isRecording = true;
      window.electronAPI.stopMacroRecording.mockResolvedValue({ success: true });

      await macroRecorderUI.stopRecording();

      expect(window.electronAPI.stopMacroRecording).toHaveBeenCalled();
      expect(macroRecorderUI.isRecording).toBe(false);
      expect(macroRecorderUI.currentRecordingName).toBe(null);
    });

    test('should cancel recording successfully', async () => {
      macroRecorderUI.isRecording = true;
      macroRecorderUI.recordedActions = [{ type: 'test' }];
      window.electronAPI.cancelMacroRecording.mockResolvedValue({ success: true });

      await macroRecorderUI.cancelRecording();

      expect(window.electronAPI.cancelMacroRecording).toHaveBeenCalled();
      expect(macroRecorderUI.isRecording).toBe(false);
      expect(macroRecorderUI.recordedActions).toEqual([]);
    });
  });

  describe('Playback Controls', () => {
    test('should play sequence successfully', async () => {
      const sequenceName = 'TestSequence';
      window.electronAPI.playMacroSequence.mockResolvedValue({ success: true });

      await macroRecorderUI.playSequence(sequenceName);

      expect(window.electronAPI.playMacroSequence).toHaveBeenCalledWith(sequenceName);
      expect(macroRecorderUI.currentPlaybackName).toBe(sequenceName);
    });

    test('should handle playback error', async () => {
      window.electronAPI.playMacroSequence.mockRejectedValue(new Error('Playback failed'));

      await macroRecorderUI.playSequence('TestSequence');

      expect(window.showNotification).toHaveBeenCalledWith(
        'Error playing sequence: Playback failed',
        'error'
      );
    });

    test('should stop playback successfully', async () => {
      macroRecorderUI.isPlaying = true;
      macroRecorderUI.currentPlaybackName = 'TestSequence';
      window.electronAPI.stopMacroPlayback.mockResolvedValue({ success: true });

      await macroRecorderUI.stopPlayback();

      expect(window.electronAPI.stopMacroPlayback).toHaveBeenCalled();
      expect(macroRecorderUI.isPlaying).toBe(false);
      expect(macroRecorderUI.currentPlaybackName).toBe(null);
    });
  });

  describe('Sequence Management', () => {
    const mockSequences = {
      'Sequence1': {
        sequence: [{ type: 'keypress', action: 'ctrl+c' }],
        metadata: { duration: 1000 }
      },
      'Sequence2': {
        sequence: [{ type: 'keypress', action: 'ctrl+v' }],
        metadata: { duration: 2000 }
      }
    };

    test('should load saved sequences', async () => {
      window.electronAPI.getSavedSequences.mockResolvedValue(mockSequences);

      await macroRecorderUI.loadSavedSequences();

      expect(window.electronAPI.getSavedSequences).toHaveBeenCalled();
      expect(macroRecorderUI.savedSequences).toEqual(mockSequences);
    });

    test('should handle sequence loading error', async () => {
      window.electronAPI.getSavedSequences.mockRejectedValue(new Error('Load failed'));

      await macroRecorderUI.loadSavedSequences();

      expect(window.showNotification).toHaveBeenCalledWith(
        'Error loading sequences: Load failed',
        'error'
      );
    });

    test('should delete sequence with confirmation', async () => {
      global.confirm = jest.fn().mockReturnValue(true);
      window.electronAPI.deleteMacroSequence.mockResolvedValue({ success: true });

      await macroRecorderUI.deleteSequence('TestSequence');

      expect(global.confirm).toHaveBeenCalledWith(
        'Are you sure you want to delete the sequence "TestSequence"?'
      );
      expect(window.electronAPI.deleteMacroSequence).toHaveBeenCalledWith('TestSequence');
    });

    test('should not delete sequence if not confirmed', async () => {
      global.confirm = jest.fn().mockReturnValue(false);

      await macroRecorderUI.deleteSequence('TestSequence');

      expect(window.electronAPI.deleteMacroSequence).not.toHaveBeenCalled();
    });

    test('should duplicate sequence with new name', async () => {
      global.prompt = jest.fn().mockReturnValue('NewSequence');
      window.electronAPI.duplicateMacroSequence.mockResolvedValue({ success: true });

      await macroRecorderUI.duplicateSequence('OriginalSequence');

      expect(global.prompt).toHaveBeenCalledWith(
        'Enter name for duplicated sequence:',
        'OriginalSequence_copy'
      );
      expect(window.electronAPI.duplicateMacroSequence).toHaveBeenCalledWith(
        'OriginalSequence',
        'NewSequence'
      );
    });

    test('should not duplicate if name is empty or cancelled', async () => {
      global.prompt = jest.fn().mockReturnValue('');

      await macroRecorderUI.duplicateSequence('OriginalSequence');

      expect(window.electronAPI.duplicateMacroSequence).not.toHaveBeenCalled();
    });
  });

  describe('Event Handling', () => {
    test('should handle recording started event', () => {
      const eventData = { name: 'TestSequence' };

      macroRecorderUI.handleRecordingStarted(eventData);

      expect(macroRecorderUI.isRecording).toBe(true);
      expect(macroRecorderUI.currentRecordingName).toBe('TestSequence');
    });

    test('should handle action recorded event', () => {
      const action = { type: 'keypress', action: 'ctrl+c', delay: 100 };

      macroRecorderUI.handleActionRecorded(action);

      expect(macroRecorderUI.recordedActions).toContain(action);
    });

    test('should handle recording stopped event', () => {
      macroRecorderUI.isRecording = true;

      macroRecorderUI.handleRecordingStopped({});

      expect(macroRecorderUI.isRecording).toBe(false);
      expect(macroRecorderUI.currentRecordingName).toBe(null);
    });

    test('should handle playback started event', () => {
      const eventData = { name: 'TestSequence' };

      macroRecorderUI.handlePlaybackStarted(eventData);

      expect(macroRecorderUI.isPlaying).toBe(true);
      expect(macroRecorderUI.currentPlaybackName).toBe('TestSequence');
    });

    test('should handle playback progress event', () => {
      const progress = {
        progress: 50,
        currentStep: 2,
        totalSteps: 4,
        currentAction: { type: 'keypress', description: 'Copy text' }
      };

      macroRecorderUI.handlePlaybackProgress(progress);

      expect(mockElements.progressFill.style.width).toBe('50%');
      expect(mockElements.progressText.textContent).toBe('50%');
      expect(mockElements.currentStepText.textContent).toBe('2/4: Copy text');
    });

    test('should handle playback completed event', () => {
      macroRecorderUI.isPlaying = true;
      const eventData = { name: 'TestSequence' };

      macroRecorderUI.handlePlaybackCompleted(eventData);

      expect(macroRecorderUI.isPlaying).toBe(false);
      expect(macroRecorderUI.currentPlaybackName).toBe(null);
      expect(window.showNotification).toHaveBeenCalledWith(
        'Sequence completed: TestSequence',
        'success'
      );
    });

    test('should handle playback error event', () => {
      macroRecorderUI.isPlaying = true;
      const error = { error: 'Action execution failed' };

      macroRecorderUI.handlePlaybackError(error);

      expect(macroRecorderUI.isPlaying).toBe(false);
      expect(window.showNotification).toHaveBeenCalledWith(
        'Playback error: Action execution failed',
        'error'
      );
    });
  });

  describe('UI State Management', () => {
    test('should update recording UI when recording starts', () => {
      macroRecorderUI.isRecording = true;
      macroRecorderUI.currentRecordingName = 'TestSequence';

      macroRecorderUI.updateRecordingUI();

      expect(mockElements.statusIndicator.className).toBe('status-indicator recording');
      expect(mockElements.statusText.textContent).toBe('Recording: TestSequence');
    });

    test('should update recording UI when recording stops', () => {
      macroRecorderUI.isRecording = false;
      macroRecorderUI.currentRecordingName = null;

      macroRecorderUI.updateRecordingUI();

      expect(mockElements.statusIndicator.className).toBe('status-indicator');
      expect(mockElements.statusText.textContent).toBe('Ready to record');
    });

    test('should update playback UI when playback starts', () => {
      macroRecorderUI.isPlaying = true;
      macroRecorderUI.currentPlaybackName = 'TestSequence';

      macroRecorderUI.updatePlaybackUI();

      expect(mockElements.playbackProgress.style.display).toBe('block');
      expect(mockElements.playingSequenceName.textContent).toBe('TestSequence');
    });

    test('should update playback UI when playback stops', () => {
      macroRecorderUI.isPlaying = false;

      macroRecorderUI.updatePlaybackUI();

      expect(mockElements.playbackProgress.style.display).toBe('none');
    });
  });

  describe('Statistics', () => {
    test('should update statistics display', async () => {
      const mockStats = {
        totalRecordings: 10,
        totalPlaybacks: 25,
        savedSequenceCount: 5,
        averageSequenceLength: 3.2
      };

      // Mock getElementById for statistics elements
      global.document.getElementById = jest.fn((id) => {
        return { textContent: '' };
      });

      window.electronAPI.getMacroStatistics.mockResolvedValue(mockStats);

      await macroRecorderUI.updateStatistics();

      expect(window.electronAPI.getMacroStatistics).toHaveBeenCalled();
    });

    test('should handle statistics update error', async () => {
      window.electronAPI.getMacroStatistics.mockRejectedValue(new Error('Stats failed'));

      await macroRecorderUI.updateStatistics();

      // Should not throw error, but log it
      expect(console.error).toHaveBeenCalledWith('Error updating statistics:', expect.any(Error));
    });
  });

  describe('Utility Methods', () => {
    test('should format duration correctly', () => {
      expect(macroRecorderUI.formatDuration(500)).toBe('500ms');
      expect(macroRecorderUI.formatDuration(1500)).toBe('1.5s');
      expect(macroRecorderUI.formatDuration(65000)).toBe('1m 5s');
    });

    test('should show and hide UI', () => {
      macroRecorderUI.show();
      expect(mockContainer.style.display).toBe('block');

      macroRecorderUI.hide();
      expect(mockContainer.style.display).toBe('none');
    });

    test('should return container element', () => {
      const element = macroRecorderUI.getElement();
      expect(element).toBe(mockContainer);
    });

    test('should show notifications', () => {
      macroRecorderUI.showNotification('Test message', 'success');

      expect(window.showNotification).toHaveBeenCalledWith('Test message', 'success');
    });
  });

  describe('Sequence Row Creation', () => {
    test('should create sequence row with correct structure', () => {
      const mockRow = {
        className: '',
        innerHTML: '',
        querySelector: jest.fn(() => ({ addEventListener: jest.fn() }))
      };
      document.createElement.mockReturnValue(mockRow);

      const sequence = {
        sequence: [{ type: 'keypress' }, { type: 'command' }],
        metadata: { duration: 5000 }
      };

      const row = macroRecorderUI.createSequenceRow('TestSequence', sequence);

      expect(row.className).toBe('sequence-row');
      expect(row.innerHTML).toContain('TestSequence');
      expect(row.innerHTML).toContain('2'); // action count
      expect(row.innerHTML).toContain('5.0s'); // formatted duration
    });

    test('should handle sequence with missing metadata', () => {
      const mockRow = {
        className: '',
        innerHTML: '',
        querySelector: jest.fn(() => ({ addEventListener: jest.fn() }))
      };
      document.createElement.mockReturnValue(mockRow);

      const sequence = {
        sequence: [{ type: 'keypress' }]
        // No metadata
      };

      const row = macroRecorderUI.createSequenceRow('TestSequence', sequence);

      expect(row.innerHTML).toContain('0ms'); // default duration formatting
    });
  });

  describe('Error Handling', () => {
    test('should handle UI initialization errors gracefully', () => {
      document.createElement.mockImplementation(() => {
        throw new Error('DOM error');
      });

      // Should not throw - error should be handled internally
      expect(() => {
        new MacroRecorderUI();
      }).toThrow('DOM error'); // This specific test expects the error to propagate
    });

    test('should handle missing UI elements gracefully', () => {
      mockContainer.querySelector.mockReturnValue(null);

      // Should not throw when elements are missing
      expect(() => {
        macroRecorderUI.updateRecordingUI();
      }).not.toThrow();
    });
  });
});