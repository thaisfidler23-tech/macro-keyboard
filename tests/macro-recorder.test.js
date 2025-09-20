/**
 * Comprehensive test suite for MacroRecorder functionality
 */

const MacroRecorder = require('../src/MacroRecorder');
const ActionExecutor = require('../src/ActionExecutor');
const fs = require('fs');
const path = require('path');

// Mock dependencies
jest.mock('fs');
jest.mock('path');

describe('MacroRecorder', () => {
  let macroRecorder;
  let mockActionExecutor;
  let mockSequenceDir;

  beforeEach(() => {
    // Setup mocks
    mockSequenceDir = '/test/sequences';
    mockActionExecutor = {
      executeAction: jest.fn(),
      executeSequence: jest.fn()
    };

    // Clear file system mocks
    fs.existsSync.mockClear();
    fs.mkdirSync.mockClear();
    fs.writeFileSync.mockClear();
    fs.readFileSync.mockClear();
    fs.readdirSync.mockClear();
    fs.unlinkSync.mockClear();
    fs.statSync.mockClear();

    // Mock path.join
    path.join.mockImplementation((...args) => args.join('/'));
    path.extname.mockImplementation((filename) => {
      const parts = filename.split('.');
      return parts.length > 1 ? '.' + parts[parts.length - 1] : '';
    });
    path.basename.mockImplementation((filename, ext) => {
      const base = filename.split('/').pop();
      return ext && base.endsWith(ext) ? base.slice(0, -ext.length) : base;
    });

    // Create MacroRecorder instance
    macroRecorder = new MacroRecorder(mockSequenceDir);
    
    // Mock the logger after creation
    macroRecorder.logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };
    
    macroRecorder.setActionExecutor(mockActionExecutor);
  });

  describe('Initialization', () => {
    test('should create sequences directory if it does not exist', () => {
      fs.existsSync.mockReturnValue(false);
      
      new MacroRecorder(mockSequenceDir);
      
      expect(fs.existsSync).toHaveBeenCalledWith(mockSequenceDir);
      expect(fs.mkdirSync).toHaveBeenCalledWith(mockSequenceDir, { recursive: true });
    });

    test('should not create directory if it already exists', () => {
      fs.existsSync.mockReturnValue(true);
      
      new MacroRecorder(mockSequenceDir);
      
      expect(fs.existsSync).toHaveBeenCalledWith(mockSequenceDir);
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    test('should initialize with empty state', () => {
      expect(macroRecorder.isRecording).toBe(false);
      expect(macroRecorder.isPlaying).toBe(false);
      expect(macroRecorder.currentRecordingName).toBe(null);
      expect(macroRecorder.currentSequence).toEqual([]);
      expect(macroRecorder.recordingStartTime).toBe(null);
    });
  });

  describe('Recording Management', () => {
    test('should start recording with generated name', () => {
      const result = macroRecorder.startRecording();
      
      expect(result.success).toBe(true);
      expect(result.recordingName).toMatch(/^Recording_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/);
      expect(macroRecorder.isRecording).toBe(true);
      expect(macroRecorder.currentRecordingName).toBe(result.recordingName);
      expect(macroRecorder.recordingStartTime).toBeInstanceOf(Date);
    });

    test('should start recording with custom name', () => {
      const customName = 'MyCustomSequence';
      const result = macroRecorder.startRecording(customName);
      
      expect(result.success).toBe(true);
      expect(result.recordingName).toBe(customName);
      expect(macroRecorder.currentRecordingName).toBe(customName);
    });

    test('should not start recording if already recording', () => {
      macroRecorder.startRecording();
      const result = macroRecorder.startRecording();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Already recording');
    });

    test('should record actions during recording', () => {
      macroRecorder.startRecording();
      
      const action = {
        type: 'keypress',
        action: 'ctrl+c',
        description: 'Copy text'
      };
      
      const result = macroRecorder.recordAction(action);
      
      expect(result.success).toBe(true);
      expect(macroRecorder.currentSequence).toHaveLength(1);
      expect(macroRecorder.currentSequence[0]).toMatchObject({
        ...action,
        delay: expect.any(Number)
      });
    });

    test('should not record actions when not recording', () => {
      const action = { type: 'keypress', action: 'ctrl+c' };
      const result = macroRecorder.recordAction(action);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Not currently recording');
    });

    test('should stop recording and save sequence', () => {
      fs.writeFileSync.mockImplementation(() => {});
      
      macroRecorder.startRecording('TestSequence');
      macroRecorder.recordAction({ type: 'keypress', action: 'ctrl+c' });
      
      const result = macroRecorder.stopRecording();
      
      expect(result.success).toBe(true);
      expect(result.sequenceName).toBe('TestSequence');
      expect(macroRecorder.isRecording).toBe(false);
      expect(macroRecorder.currentRecordingName).toBe(null);
      expect(macroRecorder.currentSequence).toEqual([]);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    test('should cancel recording without saving', () => {
      macroRecorder.startRecording('TestSequence');
      macroRecorder.recordAction({ type: 'keypress', action: 'ctrl+c' });
      
      const result = macroRecorder.cancelRecording();
      
      expect(result.success).toBe(true);
      expect(macroRecorder.isRecording).toBe(false);
      expect(macroRecorder.currentSequence).toEqual([]);
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    test('should handle stop recording when not recording', () => {
      const result = macroRecorder.stopRecording();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Not currently recording');
    });
  });

  describe('Sequence Playback', () => {
    beforeEach(() => {
      // Mock successful file reading
      fs.readFileSync.mockReturnValue(JSON.stringify({
        name: 'TestSequence',
        sequence: [
          { type: 'keypress', action: 'ctrl+c', delay: 100 },
          { type: 'keypress', action: 'ctrl+v', delay: 200 }
        ],
        metadata: {
          createdAt: new Date().toISOString(),
          duration: 300
        }
      }));
      
      mockActionExecutor.executeAction.mockResolvedValue({ success: true });
    });

    test('should play existing sequence successfully', async () => {
      const result = await macroRecorder.playSequence('TestSequence');
      
      expect(result.success).toBe(true);
      expect(macroRecorder.isPlaying).toBe(false); // Should be false after completion
      expect(mockActionExecutor.executeAction).toHaveBeenCalledTimes(2);
    });

    test('should handle non-existent sequence', async () => {
      fs.readFileSync.mockImplementation(() => {
        const error = new Error('ENOENT');
        error.code = 'ENOENT';
        throw error;
      });
      
      const result = await macroRecorder.playSequence('NonExistentSequence');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Sequence file not found');
    });

    test('should not start playback if already playing', async () => {
      // Start first playback
      const playPromise = macroRecorder.playSequence('TestSequence');
      
      // Try to start second playback immediately
      const result = await macroRecorder.playSequence('AnotherSequence');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Already playing a sequence');
      
      // Wait for first playback to complete
      await playPromise;
    });

    test('should stop playback when requested', async () => {
      // Start playback
      const playPromise = macroRecorder.playSequence('TestSequence');
      
      // Stop playback immediately
      const stopResult = macroRecorder.stopPlayback();
      
      expect(stopResult.success).toBe(true);
      expect(macroRecorder.isPlaying).toBe(false);
      
      // Wait for playback promise to resolve
      const playResult = await playPromise;
      expect(playResult.success).toBe(false);
      expect(playResult.error).toBe('Playback stopped');
    });

    test('should emit progress events during playback', async () => {
      const progressSpy = jest.fn();
      macroRecorder.on('playback-progress', progressSpy);
      
      await macroRecorder.playSequence('TestSequence');
      
      expect(progressSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          progress: expect.any(Number),
          currentStep: expect.any(Number),
          totalSteps: 2,
          currentAction: expect.any(Object)
        })
      );
    });
  });

  describe('Sequence Management', () => {
    test('should list saved sequences', () => {
      fs.readdirSync.mockReturnValue(['seq1.json', 'seq2.json', 'not-a-json.txt']);
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('seq1')) {
          return JSON.stringify({ name: 'Sequence1', sequence: [], metadata: {} });
        }
        if (filePath.includes('seq2')) {
          return JSON.stringify({ name: 'Sequence2', sequence: [], metadata: {} });
        }
        return '{}';
      });
      
      const sequences = macroRecorder.getSavedSequences();
      
      expect(Object.keys(sequences)).toHaveLength(2);
      expect(sequences).toHaveProperty('Sequence1');
      expect(sequences).toHaveProperty('Sequence2');
    });

    test('should delete sequence successfully', () => {
      fs.existsSync.mockReturnValue(true);
      fs.unlinkSync.mockImplementation(() => {});
      
      const result = macroRecorder.deleteSequence('TestSequence');
      
      expect(result.success).toBe(true);
      expect(fs.unlinkSync).toHaveBeenCalledWith('/test/sequences/TestSequence.json');
    });

    test('should handle delete of non-existent sequence', () => {
      fs.existsSync.mockReturnValue(false);
      
      const result = macroRecorder.deleteSequence('NonExistentSequence');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Sequence not found');
    });

    test('should duplicate sequence successfully', () => {
      fs.existsSync.mockReturnValueOnce(true).mockReturnValueOnce(false);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        name: 'OriginalSequence',
        sequence: [{ type: 'keypress', action: 'ctrl+c' }],
        metadata: { createdAt: '2024-01-01T00:00:00.000Z' }
      }));
      fs.writeFileSync.mockImplementation(() => {});
      
      const result = macroRecorder.duplicateSequence('OriginalSequence', 'DuplicatedSequence');
      
      expect(result.success).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    test('should handle duplicate with existing target name', () => {
      fs.existsSync.mockReturnValue(true);
      
      const result = macroRecorder.duplicateSequence('Source', 'ExistingTarget');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Target sequence already exists');
    });
  });

  describe('Built-in Templates', () => {
    test('should have email workflow template', () => {
      const templates = macroRecorder.getBuiltInTemplates();
      
      expect(templates).toHaveProperty('email_workflow');
      expect(templates.email_workflow.sequence).toBeDefined();
      expect(templates.email_workflow.sequence.length).toBeGreaterThan(0);
    });

    test('should have development workflow template', () => {
      const templates = macroRecorder.getBuiltInTemplates();
      
      expect(templates).toHaveProperty('development_workflow');
      expect(templates.development_workflow.sequence).toBeDefined();
    });

    test('should create sequence from template', () => {
      fs.writeFileSync.mockImplementation(() => {});
      
      const result = macroRecorder.createFromTemplate('email_workflow', 'MyEmailWorkflow');
      
      expect(result.success).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    test('should handle invalid template', () => {
      const result = macroRecorder.createFromTemplate('invalid_template', 'TestSequence');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Template not found');
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      fs.readdirSync.mockReturnValue(['seq1.json', 'seq2.json']);
      fs.readFileSync.mockImplementation((filePath) => {
        return JSON.stringify({
          sequence: [
            { type: 'keypress', action: 'ctrl+c', delay: 100 },
            { type: 'keypress', action: 'ctrl+v', delay: 200 }
          ],
          metadata: {
            playbackCount: 5,
            duration: 300,
            createdAt: '2024-01-01T00:00:00.000Z'
          }
        });
      });
    });

    test('should calculate statistics correctly', () => {
      const stats = macroRecorder.getStatistics();
      
      expect(stats.totalRecordings).toBe(1); // Increment from recording
      expect(stats.totalPlaybacks).toBe(0); // No playbacks yet
      expect(stats.savedSequenceCount).toBe(2);
      expect(stats.averageSequenceLength).toBe(2);
    });

    test('should update statistics after recording', () => {
      macroRecorder.startRecording();
      macroRecorder.recordAction({ type: 'keypress', action: 'test' });
      macroRecorder.stopRecording();
      
      const stats = macroRecorder.getStatistics();
      expect(stats.totalRecordings).toBeGreaterThan(0);
    });

    test('should update statistics after playback', async () => {
      fs.readFileSync.mockReturnValue(JSON.stringify({
        sequence: [{ type: 'keypress', action: 'test', delay: 100 }],
        metadata: { duration: 100 }
      }));
      
      await macroRecorder.playSequence('TestSequence');
      
      const stats = macroRecorder.getStatistics();
      expect(stats.totalPlaybacks).toBeGreaterThan(0);
    });
  });

  describe('Event Emission', () => {
    test('should emit recording started event', () => {
      const spy = jest.fn();
      macroRecorder.on('recording-started', spy);
      
      macroRecorder.startRecording('TestSequence');
      
      expect(spy).toHaveBeenCalledWith({
        name: 'TestSequence',
        timestamp: expect.any(Date)
      });
    });

    test('should emit action recorded event', () => {
      const spy = jest.fn();
      macroRecorder.on('action-recorded', spy);
      
      macroRecorder.startRecording();
      const action = { type: 'keypress', action: 'ctrl+c' };
      macroRecorder.recordAction(action);
      
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          ...action,
          delay: expect.any(Number)
        })
      );
    });

    test('should emit recording stopped event', () => {
      const spy = jest.fn();
      macroRecorder.on('recording-stopped', spy);
      
      fs.writeFileSync.mockImplementation(() => {});
      
      macroRecorder.startRecording('TestSequence');
      macroRecorder.stopRecording();
      
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'TestSequence',
          actionCount: 0
        })
      );
    });

    test('should emit playback events', async () => {
      const startedSpy = jest.fn();
      const completedSpy = jest.fn();
      
      macroRecorder.on('playback-started', startedSpy);
      macroRecorder.on('playback-completed', completedSpy);
      
      fs.readFileSync.mockReturnValue(JSON.stringify({
        sequence: [{ type: 'keypress', action: 'test', delay: 100 }],
        metadata: { duration: 100 }
      }));
      
      await macroRecorder.playSequence('TestSequence');
      
      expect(startedSpy).toHaveBeenCalled();
      expect(completedSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle file system errors gracefully', () => {
      fs.writeFileSync.mockImplementation(() => {
        throw new Error('Disk full');
      });
      
      macroRecorder.startRecording();
      const result = macroRecorder.stopRecording();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Disk full');
    });

    test('should handle action execution errors during playback', async () => {
      mockActionExecutor.executeAction.mockRejectedValue(new Error('Action failed'));
      
      fs.readFileSync.mockReturnValue(JSON.stringify({
        sequence: [{ type: 'keypress', action: 'invalid' }],
        metadata: {}
      }));
      
      const result = await macroRecorder.playSequence('TestSequence');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Action failed');
    });

    test('should handle malformed sequence files', () => {
      fs.readFileSync.mockReturnValue('invalid json');
      fs.readdirSync.mockReturnValue(['invalid.json']);
      
      const sequences = macroRecorder.getSavedSequences();
      
      expect(sequences).toEqual({});
    });
  });

  describe('ActionExecutor Integration', () => {
    test('should set and use ActionExecutor', () => {
      const newExecutor = {
        executeAction: jest.fn().mockResolvedValue({ success: true })
      };
      
      macroRecorder.setActionExecutor(newExecutor);
      
      expect(macroRecorder.actionExecutor).toBe(newExecutor);
    });

    test('should handle missing ActionExecutor during playback', async () => {
      macroRecorder.setActionExecutor(null);
      
      fs.readFileSync.mockReturnValue(JSON.stringify({
        sequence: [{ type: 'keypress', action: 'test' }],
        metadata: {}
      }));
      
      const result = await macroRecorder.playSequence('TestSequence');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('ActionExecutor not set');
    });
  });

  describe('Conditional Execution', () => {
    test('should evaluate conditions correctly', () => {
      const condition = {
        type: 'time',
        operator: 'between',
        value: ['09:00', '17:00']
      };
      
      // Mock current time to be within working hours
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(14);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(30);
      
      const result = macroRecorder.evaluateCondition(condition);
      
      expect(result).toBe(true);
    });

    test('should skip sequence when condition is not met', async () => {
      fs.readFileSync.mockReturnValue(JSON.stringify({
        sequence: [{ type: 'keypress', action: 'test' }],
        metadata: {
          conditions: [{
            type: 'time',
            operator: 'between',
            value: ['09:00', '10:00']
          }]
        }
      }));
      
      // Mock current time to be outside condition
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(15);
      
      const result = await macroRecorder.playSequence('TestSequence');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Condition not met');
    });
  });
});