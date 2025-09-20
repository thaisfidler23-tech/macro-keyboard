const { EventEmitter } = require('events');
const FileFormatManager = require('./FileFormatManager');
const fs = require('fs');
const path = require('path');

/**
 * Macro Recording System for Macro Keyboard
 * 
 * Handles recording, playback, and management of macro sequences
 * Supports keyboard input capture, timing, and conditional execution
 * Includes comprehensive import/export functionality
 */
class MacroRecorder extends EventEmitter {
  constructor(logger, actionExecutor) {
    super();
    
    this.logger = logger;
    this.actionExecutor = actionExecutor;
    
    // Initialize file format manager
    this.fileFormatManager = new FileFormatManager(logger);
    
    // Recording state
    this.isRecording = false;
    this.recordingStartTime = null;
    this.recordedSequence = [];
    this.currentRecordingName = null;
    
    // Playback state
    this.isPlaying = false;
    this.playbackTimeouts = [];
    this.playbackStartTime = null;
    this.currentPlaybackSequence = null;
    
    // Sequence management
    this.savedSequences = new Map();
    this.sequenceTemplates = new Map();
    
    // Performance tracking
    this.recordingStats = {
      totalRecordings: 0,
      totalPlaybacks: 0,
      averageSequenceLength: 0,
      lastRecordingDuration: 0
    };
    
    // Initialize templates
    this.initializeSequenceTemplates();
    
    this.logger.info('MacroRecorder initialized');
  }
  
  /**
   * Initialize built-in sequence templates
   */
  initializeSequenceTemplates() {
    // Email workflow template
    this.sequenceTemplates.set('email_workflow', {
      name: 'Email Workflow',
      description: 'Copy text, open email, create new message, and paste content',
      sequence: [
        { type: 'keypress', action: 'cmd+c', delay: 100, description: 'Copy text' },
        { type: 'application', action: 'Mail', delay: 800, description: 'Open email app' },
        { type: 'keypress', action: 'cmd+n', delay: 300, description: 'New message' },
        { type: 'keypress', action: 'cmd+v', delay: 100, description: 'Paste content' }
      ],
      conditions: [
        { check: 'clipboard_not_empty', then: 'continue', else: 'abort' }
      ]
    });
    
    // Development workflow template
    this.sequenceTemplates.set('dev_workflow', {
      name: 'Development Workflow',
      description: 'Git add, commit, and push workflow',
      sequence: [
        { type: 'keypress', action: 'cmd+`', delay: 200, description: 'Open terminal' },
        { type: 'command', action: 'git add -A', delay: 1000, description: 'Stage all changes' },
        { type: 'keypress', action: 'return', delay: 500, description: 'Execute command' },
        // Note: Commit message would need user input in real implementation
      ],
      conditions: [
        { check: 'git_repository', then: 'continue', else: 'abort' }
      ]
    });
    
    // Presentation mode template
    this.sequenceTemplates.set('presentation_mode', {
      name: 'Presentation Mode',
      description: 'Enter presentation mode with system cleanup',
      sequence: [
        { type: 'keypress', action: 'f11', delay: 300, description: 'Enter fullscreen' },
        { type: 'keypress', action: 'cmd+option+h', delay: 200, description: 'Hide other apps' },
        { type: 'command', action: 'pmset displaysleepnow', delay: 0, description: 'Prevent sleep' }
      ]
    });
    
    this.logger.info(`Initialized ${this.sequenceTemplates.size} sequence templates`);
  }
  
  /**
   * Start recording a new macro sequence
   */
  async startRecording(sequenceName = null) {
    if (this.isRecording) {
      throw new Error('Already recording a sequence');
    }
    
    if (this.isPlaying) {
      throw new Error('Cannot record while playing a sequence');
    }
    
    this.isRecording = true;
    this.recordingStartTime = Date.now();
    this.recordedSequence = [];
    this.currentRecordingName = sequenceName || `recorded_${Date.now()}`;
    
    this.logger.info(`Started recording macro sequence: ${this.currentRecordingName}`);
    this.emit('recordingStarted', {
      name: this.currentRecordingName,
      timestamp: this.recordingStartTime
    });
    
    return this.currentRecordingName;
  }
  
  /**
   * Add an action to the currently recording sequence
   */
  recordAction(actionConfig, description = null) {
    if (!this.isRecording) {
      throw new Error('Not currently recording');
    }
    
    const currentTime = Date.now();
    const timeFromStart = currentTime - this.recordingStartTime;
    const delay = this.recordedSequence.length > 0 ? 
      timeFromStart - this.recordedSequence[this.recordedSequence.length - 1].timestamp : 0;
    
    const recordedAction = {
      ...actionConfig,
      timestamp: timeFromStart,
      delay: Math.max(delay, 50), // Minimum 50ms delay
      description: description || `${actionConfig.type}: ${actionConfig.action}`,
      recordedAt: currentTime
    };
    
    this.recordedSequence.push(recordedAction);
    
    this.logger.debug(`Recorded action: ${recordedAction.description} (delay: ${recordedAction.delay}ms)`);
    this.emit('actionRecorded', recordedAction);
    
    return recordedAction;
  }
  
  /**
   * Stop recording and save the sequence
   */
  async stopRecording() {
    if (!this.isRecording) {
      throw new Error('Not currently recording');
    }
    
    const recordingDuration = Date.now() - this.recordingStartTime;
    const sequenceName = this.currentRecordingName;
    
    // Create sequence metadata
    const sequenceData = {
      name: sequenceName,
      sequence: [...this.recordedSequence],
      metadata: {
        recordedAt: new Date().toISOString(),
        duration: recordingDuration,
        actionCount: this.recordedSequence.length,
        version: '1.0.0'
      },
      conditions: [],
      settings: {
        pauseOnError: true,
        showProgress: true,
        allowInterruption: true
      }
    };
    
    // Save the sequence
    this.savedSequences.set(sequenceName, sequenceData);
    
    // Update stats
    this.recordingStats.totalRecordings++;
    this.recordingStats.lastRecordingDuration = recordingDuration;
    this.recordingStats.averageSequenceLength = 
      (this.recordingStats.averageSequenceLength * (this.recordingStats.totalRecordings - 1) + 
       this.recordedSequence.length) / this.recordingStats.totalRecordings;
    
    // Reset recording state
    this.isRecording = false;
    this.recordingStartTime = null;
    this.recordedSequence = [];
    this.currentRecordingName = null;
    
    this.logger.info(`Stopped recording macro sequence: ${sequenceName} (${sequenceData.sequence.length} actions, ${recordingDuration}ms)`);
    this.emit('recordingStopped', sequenceData);
    
    return sequenceData;
  }
  
  /**
   * Cancel current recording without saving
   */
  cancelRecording() {
    if (!this.isRecording) {
      throw new Error('Not currently recording');
    }
    
    const sequenceName = this.currentRecordingName;
    
    // Reset recording state
    this.isRecording = false;
    this.recordingStartTime = null;
    this.recordedSequence = [];
    this.currentRecordingName = null;
    
    this.logger.info(`Cancelled recording macro sequence: ${sequenceName}`);
    this.emit('recordingCancelled', { name: sequenceName });
  }
  
  /**
   * Play a saved sequence
   */
  async playSequence(sequenceName) {
    if (this.isPlaying) {
      throw new Error('Already playing a sequence');
    }
    
    if (this.isRecording) {
      throw new Error('Cannot play while recording');
    }
    
    const sequenceData = this.savedSequences.get(sequenceName) || 
                        this.sequenceTemplates.get(sequenceName);
    
    if (!sequenceData) {
      throw new Error(`Sequence not found: ${sequenceName}`);
    }
    
    // Check conditions before starting
    if (sequenceData.conditions && sequenceData.conditions.length > 0) {
      const conditionsMet = await this.checkSequenceConditions(sequenceData.conditions);
      if (!conditionsMet) {
        this.logger.warn(`Sequence conditions not met for: ${sequenceName}`);
        this.emit('playbackConditionsFailed', { name: sequenceName });
        return false;
      }
    }
    
    this.isPlaying = true;
    this.playbackStartTime = Date.now();
    this.currentPlaybackSequence = sequenceData;
    this.playbackTimeouts = [];
    
    this.logger.info(`Starting playback of sequence: ${sequenceName} (${sequenceData.sequence.length} actions)`);
    this.emit('playbackStarted', {
      name: sequenceName,
      actionCount: sequenceData.sequence.length,
      estimatedDuration: this.calculateSequenceDuration(sequenceData.sequence)
    });
    
    try {
      await this.executeSequence(sequenceData.sequence, sequenceData.settings || {});
      this.recordingStats.totalPlaybacks++;
      this.emit('playbackCompleted', { name: sequenceName });
      return true;
    } catch (error) {
      this.logger.error(`Error during sequence playback: ${error.message}`);
      this.emit('playbackError', { name: sequenceName, error: error.message });
      return false;
    } finally {
      this.isPlaying = false;
      this.playbackStartTime = null;
      this.currentPlaybackSequence = null;
      this.clearPlaybackTimeouts();
    }
  }
  
  /**
   * Execute a sequence of actions with timing and error handling
   */
  async executeSequence(sequence, settings = {}) {
    const {
      pauseOnError = true,
      showProgress = true,
      allowInterruption = true
    } = settings;
    
    for (let i = 0; i < sequence.length; i++) {
      if (!this.isPlaying) {
        // Sequence was stopped
        break;
      }
      
      const action = sequence[i];
      
      try {
        // Emit progress
        if (showProgress) {
          this.emit('playbackProgress', {
            currentStep: i + 1,
            totalSteps: sequence.length,
            currentAction: action,
            progress: ((i + 1) / sequence.length) * 100
          });
        }
        
        // Wait for delay if specified
        if (action.delay && action.delay > 0) {
          await this.delay(action.delay);
        }
        
        // Execute the action
        const success = await this.actionExecutor.executeAction(action, `macro_sequence_step_${i + 1}`);
        
        if (!success && pauseOnError) {
          throw new Error(`Action failed at step ${i + 1}: ${action.description}`);
        }
        
        this.logger.debug(`Executed macro action ${i + 1}/${sequence.length}: ${action.description}`);
        
      } catch (error) {
        this.logger.error(`Error executing sequence step ${i + 1}: ${error.message}`);
        
        if (pauseOnError) {
          throw error;
        } else {
          // Continue with next action
          this.emit('playbackStepError', {
            step: i + 1,
            action: action,
            error: error.message
          });
        }
      }
    }
  }
  
  /**
   * Stop current playback
   */
  stopPlayback() {
    if (!this.isPlaying) {
      return false;
    }
    
    this.isPlaying = false;
    this.clearPlaybackTimeouts();
    
    const sequenceName = this.currentPlaybackSequence?.name || 'unknown';
    this.logger.info(`Stopped playback of sequence: ${sequenceName}`);
    this.emit('playbackStopped', { name: sequenceName });
    
    return true;
  }
  
  /**
   * Check sequence conditions
   */
  async checkSequenceConditions(conditions) {
    for (const condition of conditions) {
      const result = await this.evaluateCondition(condition);
      if (!result) {
        this.logger.debug(`Condition failed: ${condition.check}`);
        return false;
      }
    }
    return true;
  }
  
  /**
   * Evaluate a single condition
   */
  async evaluateCondition(condition) {
    const { check, then, else: elseAction } = condition;
    
    switch (check) {
      case 'clipboard_not_empty':
        // In a real implementation, this would check the system clipboard
        return true; // Simplified for now
        
      case 'git_repository':
        // Check if current directory is a git repository
        try {
          const { spawn } = require('child_process');
          return new Promise((resolve) => {
            const git = spawn('git', ['rev-parse', '--git-dir'], { stdio: 'pipe' });
            git.on('close', (code) => resolve(code === 0));
            git.on('error', () => resolve(false));
          });
        } catch {
          return false;
        }
        
      case 'application_active':
        // Check if specific application is active
        // This would require platform-specific implementation
        return true; // Simplified for now
        
      default:
        this.logger.warn(`Unknown condition type: ${check}`);
        return true;
    }
  }
  
  /**
   * Get all saved sequences
   */
  getSavedSequences() {
    const sequences = {};
    
    // Add saved sequences
    this.savedSequences.forEach((data, name) => {
      sequences[name] = {
        ...data,
        type: 'recorded'
      };
    });
    
    // Add templates
    this.sequenceTemplates.forEach((data, name) => {
      sequences[name] = {
        ...data,
        type: 'template'
      };
    });
    
    return sequences;
  }
  
  /**
   * Delete a saved sequence
   */
  deleteSequence(sequenceName) {
    if (this.savedSequences.has(sequenceName)) {
      this.savedSequences.delete(sequenceName);
      this.logger.info(`Deleted sequence: ${sequenceName}`);
      this.emit('sequenceDeleted', { name: sequenceName });
      return true;
    }
    
    // Don't allow deletion of templates
    if (this.sequenceTemplates.has(sequenceName)) {
      throw new Error('Cannot delete built-in template');
    }
    
    return false;
  }
  
  /**
   * Rename a saved sequence
   */
  renameSequence(oldName, newName) {
    if (!this.savedSequences.has(oldName)) {
      throw new Error(`Sequence not found: ${oldName}`);
    }
    
    if (this.savedSequences.has(newName)) {
      throw new Error(`Sequence already exists: ${newName}`);
    }
    
    const sequenceData = this.savedSequences.get(oldName);
    sequenceData.name = newName;
    
    this.savedSequences.set(newName, sequenceData);
    this.savedSequences.delete(oldName);
    
    this.logger.info(`Renamed sequence: ${oldName} -> ${newName}`);
    this.emit('sequenceRenamed', { oldName, newName });
    
    return true;
  }
  
  /**
   * Duplicate a sequence
   */
  duplicateSequence(sourceName, newName) {
    const sourceData = this.savedSequences.get(sourceName) || 
                      this.sequenceTemplates.get(sourceName);
    
    if (!sourceData) {
      throw new Error(`Source sequence not found: ${sourceName}`);
    }
    
    if (this.savedSequences.has(newName)) {
      throw new Error(`Sequence already exists: ${newName}`);
    }
    
    const duplicatedData = {
      ...JSON.parse(JSON.stringify(sourceData)), // Deep copy
      name: newName,
      metadata: {
        ...sourceData.metadata,
        duplicatedFrom: sourceName,
        duplicatedAt: new Date().toISOString()
      }
    };
    
    this.savedSequences.set(newName, duplicatedData);
    
    this.logger.info(`Duplicated sequence: ${sourceName} -> ${newName}`);
    this.emit('sequenceDuplicated', { sourceName, newName });
    
    return duplicatedData;
  }
  
  /**
   * Get recording and playback statistics
   */
  getStatistics() {
    return {
      ...this.recordingStats,
      savedSequenceCount: this.savedSequences.size,
      templateCount: this.sequenceTemplates.size,
      isRecording: this.isRecording,
      isPlaying: this.isPlaying,
      currentRecording: this.currentRecordingName,
      currentPlayback: this.currentPlaybackSequence?.name || null
    };
  }
  
  /**
   * Calculate estimated duration of a sequence
   */
  calculateSequenceDuration(sequence) {
    return sequence.reduce((total, action) => {
      return total + (action.delay || 100) + 50; // Add estimated execution time
    }, 0);
  }
  
  /**
   * Clear all playback timeouts
   */
  clearPlaybackTimeouts() {
    this.playbackTimeouts.forEach(timeout => clearTimeout(timeout));
    this.playbackTimeouts = [];
  }
  
  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise((resolve) => {
      const timeout = setTimeout(resolve, ms);
      this.playbackTimeouts.push(timeout);
    });
  }
  
  /**
   * Export a single sequence to file
   */
  async exportSequence(sequenceName, filePath, format = null) {
    const sequenceData = this.savedSequences.get(sequenceName) || 
                        this.sequenceTemplates.get(sequenceName);
    
    if (!sequenceData) {
      throw new Error(`Sequence not found: ${sequenceName}`);
    }
    
    // Don't allow export of built-in templates without explicit permission
    if (this.sequenceTemplates.has(sequenceName) && !sequenceData.allowExport) {
      throw new Error('Cannot export built-in template');
    }
    
    return await this.fileFormatManager.exportSequence(sequenceData, filePath, format);
  }
  
  /**
   * Import a sequence from file
   */
  async importSequence(filePath, options = {}) {
    const {
      overwriteExisting = false,
      renameOnConflict = false,
      validateSequence = true
    } = options;
    
    const result = await this.fileFormatManager.importSequence(filePath);
    
    if (!result.success) {
      throw new Error('Import failed');
    }
    
    const { sequenceData, metadata } = result;
    let finalName = sequenceData.name;
    
    // Handle naming conflicts
    if (this.savedSequences.has(finalName)) {
      if (overwriteExisting) {
        this.logger.warn(`Overwriting existing sequence: ${finalName}`);
      } else if (renameOnConflict) {
        finalName = this.generateUniqueName(finalName);
        this.logger.info(`Renamed imported sequence to: ${finalName}`);
      } else {
        throw new Error(`Sequence already exists: ${finalName}`);
      }
    }
    
    // Add import metadata
    const importedSequence = {
      ...sequenceData,
      name: finalName,
      metadata: {
        ...sequenceData.metadata,
        ...metadata,
        importedAt: new Date().toISOString()
      }
    };
    
    // Validate sequence if requested
    if (validateSequence) {
      this.validateImportedSequence(importedSequence);
    }
    
    // Save the sequence
    this.savedSequences.set(finalName, importedSequence);
    
    this.logger.info(`Imported sequence: ${finalName} from ${filePath}`);
    this.emit('sequenceImported', { name: finalName, originalName: sequenceData.name, path: filePath });
    
    return {
      success: true,
      name: finalName,
      originalName: sequenceData.name,
      sequenceData: importedSequence
    };
  }
  
  /**
   * Export multiple sequences (bulk export)
   */
  async exportSequences(sequenceNames, outputPath, options = {}) {
    const sequences = {};
    
    // Collect sequences to export
    for (const name of sequenceNames) {
      const sequenceData = this.savedSequences.get(name) || this.sequenceTemplates.get(name);
      if (sequenceData) {
        // Skip built-in templates unless explicitly allowed
        if (!this.sequenceTemplates.has(name) || sequenceData.allowExport) {
          sequences[name] = sequenceData;
        } else {
          this.logger.warn(`Skipping built-in template: ${name}`);
        }
      } else {
        this.logger.warn(`Sequence not found for export: ${name}`);
      }
    }
    
    if (Object.keys(sequences).length === 0) {
      throw new Error('No valid sequences to export');
    }
    
    return await this.fileFormatManager.exportBulk(sequences, outputPath, options);
  }
  
  /**
   * Import multiple sequences from directory or package
   */
  async importSequences(sourcePath, options = {}) {
    const {
      overwriteExisting = false,
      createBackup = true,
      validateSequences = true,
      conflictResolution = 'error' // 'error', 'skip', 'rename', 'overwrite'
    } = options;
    
    // Create backup if requested
    if (createBackup) {
      await this.createSequencesBackup();
    }
    
    const importResult = await this.fileFormatManager.importBulk(sourcePath);
    const results = [];
    const errors = [];
    
    // Process each imported sequence
    for (const result of importResult.imported) {
      try {
        const importOptions = {
          overwriteExisting: overwriteExisting || conflictResolution === 'overwrite',
          renameOnConflict: conflictResolution === 'rename',
          validateSequence: validateSequences
        };
        
        // Check for conflicts
        if (this.savedSequences.has(result.sequenceData.name)) {
          if (conflictResolution === 'skip') {
            results.push({
              name: result.sequenceData.name,
              success: false,
              skipped: true,
              reason: 'Sequence already exists'
            });
            continue;
          } else if (conflictResolution === 'error') {
            throw new Error(`Sequence already exists: ${result.sequenceData.name}`);
          }
        }
        
        const sequenceResult = await this.importSequence(result.metadata.importedFrom, importOptions);
        results.push({
          name: sequenceResult.name,
          originalName: sequenceResult.originalName,
          success: true
        });
        
      } catch (error) {
        errors.push({
          name: result.sequenceData.name,
          error: error.message
        });
        this.logger.error(`Failed to import sequence ${result.sequenceData.name}: ${error.message}`);
      }
    }
    
    // Add any errors from the bulk import
    errors.push(...importResult.errors);
    
    this.logger.info(`Bulk import completed: ${results.length} successful, ${errors.length} errors`);
    this.emit('bulkImported', { 
      successful: results.length, 
      errors: errors.length, 
      results, 
      errors 
    });
    
    return {
      success: true,
      imported: results,
      errors,
      count: results.length
    };
  }
  
  /**
   * Export all sequences for current profile
   */
  async exportProfile(profileName, outputPath, format = 'mkb') {
    const sequences = {};
    
    // Export all saved sequences (not templates)
    this.savedSequences.forEach((sequenceData, name) => {
      sequences[name] = sequenceData;
    });
    
    if (Object.keys(sequences).length === 0) {
      throw new Error('No sequences to export in current profile');
    }
    
    const packageOptions = {
      format,
      includeMetadata: true,
      createIndex: true
    };
    
    // Add profile metadata
    packageOptions.packageMetadata = {
      name: `${profileName} Profile`,
      description: `Macro sequences from ${profileName} profile`,
      profile: profileName,
      exportedAt: new Date().toISOString(),
      sequenceCount: Object.keys(sequences).length
    };
    
    return await this.fileFormatManager.exportBulk(sequences, outputPath, packageOptions);
  }
  
  /**
   * Create a backup of current sequences
   */
  async createSequencesBackup() {
    const backupDir = path.join(process.cwd(), 'backups', 'sequences');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `backup-${timestamp}`);
    
    // Ensure backup directory exists
    await this.fileFormatManager.ensureDirectoryExists(backupDir);
    
    const sequences = {};
    this.savedSequences.forEach((sequenceData, name) => {
      sequences[name] = sequenceData;
    });
    
    if (Object.keys(sequences).length > 0) {
      await this.fileFormatManager.exportBulk(sequences, backupPath, {
        format: 'json',
        includeMetadata: true,
        createIndex: true
      });
      
      this.logger.info(`Created backup: ${backupPath}`);
      return backupPath;
    }
    
    return null;
  }
  
  /**
   * Validate imported sequence
   */
  validateImportedSequence(sequenceData) {
    // Basic structure validation
    if (!sequenceData.sequence || !Array.isArray(sequenceData.sequence)) {
      throw new Error('Invalid sequence: sequence array is required');
    }
    
    // Validate each action
    sequenceData.sequence.forEach((action, index) => {
      this.validateSequenceAction(action, index);
    });
    
    // Check for reasonable limits
    if (sequenceData.sequence.length > 1000) {
      this.logger.warn(`Large sequence imported: ${sequenceData.name} has ${sequenceData.sequence.length} actions`);
    }
    
    const totalDelay = sequenceData.sequence.reduce((sum, action) => sum + (action.delay || 0), 0);
    if (totalDelay > 300000) { // 5 minutes
      this.logger.warn(`Long sequence imported: ${sequenceData.name} has ${totalDelay}ms total delay`);
    }
    
    return true;
  }
  
  /**
   * Validate individual sequence action
   */
  validateSequenceAction(action, index) {
    if (!action.type || !['keypress', 'command', 'application'].includes(action.type)) {
      throw new Error(`Invalid action type at step ${index + 1}: ${action.type}`);
    }
    
    if (!action.action || typeof action.action !== 'string') {
      throw new Error(`Invalid action at step ${index + 1}: action must be a non-empty string`);
    }
    
    if (action.delay && (typeof action.delay !== 'number' || action.delay < 0 || action.delay > 60000)) {
      throw new Error(`Invalid delay at step ${index + 1}: must be between 0 and 60000ms`);
    }
    
    return true;
  }
  
  /**
   * Generate unique name for imported sequence
   */
  generateUniqueName(baseName) {
    let counter = 1;
    let newName = `${baseName}_imported`;
    
    while (this.savedSequences.has(newName)) {
      newName = `${baseName}_imported_${counter}`;
      counter++;
    }
    
    return newName;
  }
  
  /**
   * Get import/export statistics
   */
  getImportExportStats() {
    return {
      totalSequences: this.savedSequences.size,
      templatesCount: this.sequenceTemplates.size,
      exportableSequences: Array.from(this.savedSequences.keys()).concat(
        Array.from(this.sequenceTemplates.entries())
          .filter(([, data]) => data.allowExport)
          .map(([name]) => name)
      ),
      supportedFormats: this.fileFormatManager.getSupportedFormats()
    };
  }
  
  /**
   * Preview export without actually exporting
   */
  async previewExport(sequenceNames, format = 'mkb') {
    const sequences = {};
    const missing = [];
    
    // Collect sequences and check availability
    for (const name of sequenceNames) {
      const sequenceData = this.savedSequences.get(name) || this.sequenceTemplates.get(name);
      if (sequenceData) {
        if (!this.sequenceTemplates.has(name) || sequenceData.allowExport) {
          sequences[name] = sequenceData;
        } else {
          missing.push({ name, reason: 'Built-in template not exportable' });
        }
      } else {
        missing.push({ name, reason: 'Sequence not found' });
      }
    }
    
    return {
      sequences: Object.keys(sequences).map(name => ({
        name,
        actionCount: sequences[name].sequence?.length || 0,
        duration: sequences[name].metadata?.duration || 0,
        format,
        estimatedSize: this.estimateExportSize(sequences[name], format)
      })),
      missing,
      totalSequences: Object.keys(sequences).length,
      totalSize: Object.values(sequences).reduce((sum, seq) => sum + this.estimateExportSize(seq, format), 0)
    };
  }
  
  /**
   * Estimate export size for a sequence
   */
  estimateExportSize(sequenceData, format) {
    // Rough estimation based on format
    const baseSize = JSON.stringify(sequenceData).length;
    
    switch (format.toLowerCase()) {
      case 'json':
        return Math.round(baseSize * 1.2); // JSON formatting
      case 'yaml':
      case 'yml':
      case 'mkb':
        return Math.round(baseSize * 1.5); // YAML is more verbose
      default:
        return baseSize;
    }
  }
  
  /**
   * Get file format manager instance
   */
  getFileFormatManager() {
    return this.fileFormatManager;
  }
  
  /**
   * Cleanup resources
   */
  cleanup() {
    this.stopPlayback();
    if (this.isRecording) {
      this.cancelRecording();
    }
    
    // Cleanup file format manager
    if (this.fileFormatManager) {
      this.fileFormatManager.cleanup();
    }
    
    this.removeAllListeners();
    this.logger.info('MacroRecorder cleaned up');
  }
}

module.exports = MacroRecorder;