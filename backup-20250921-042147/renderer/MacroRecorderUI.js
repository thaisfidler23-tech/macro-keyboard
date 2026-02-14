/**
 * Macro Recording and Management UI Component
 *
 * Provides interface for recording, editing, and managing macro sequences
 * Integrates with MacroRecorder backend for sequence operations
 * Includes comprehensive import/export functionality
 */
class MacroRecorderUI {
  constructor() {
    this.isRecording = false;
    this.isPlaying = false;
    this.currentRecordingName = null;
    this.currentPlaybackName = null;
    this.recordedActions = [];
    this.savedSequences = {};

    // UI elements
    this.container = null;
    this.recordingPanel = null;
    this.sequenceList = null;
    this.sequenceEditor = null;
    this.playbackProgress = null;

    // Import/Export Dialog
    this.importExportDialog = null;

    this.initializeUI();
    this.setupEventListeners();
    this.loadSavedSequences();
    this.initializeImportExportDialog();
  }

  /**
   * Initialize the macro recorder UI
   */
  initializeUI() {
    this.container = document.createElement('div');
    this.container.className = 'macro-recorder-container';
    this.container.innerHTML = this.getUITemplate();

    // Cache UI elements
    this.recordingPanel = this.container.querySelector('.recording-panel');
    this.sequenceList = this.container.querySelector('.sequence-list');
    this.sequenceEditor = this.container.querySelector('.sequence-editor');
    this.playbackProgress = this.container.querySelector('.playback-progress');

    // Initially hide the container
    this.container.style.display = 'none';
  }

  /**
   * Get the HTML template for the macro recorder UI
   */
  getUITemplate() {
    return `
      <div class="macro-recorder-header">
        <h2>Macro Recording & Management</h2>
        <div class="header-controls">
          <button class="close-button" title="Close Macro Recorder">×</button>
        </div>
      </div>

      <div class="macro-recorder-content">
        <!-- Recording Panel -->
        <div class="recording-panel">
          <h3>Record New Sequence</h3>
          <div class="recording-controls">
            <input type="text" class="sequence-name-input" placeholder="Sequence name (optional)" />
            <button class="start-recording-btn">Start Recording</button>
            <button class="stop-recording-btn" disabled>Stop Recording</button>
            <button class="cancel-recording-btn" disabled>Cancel</button>
          </div>

          <div class="recording-status">
            <div class="status-indicator"></div>
            <span class="status-text">Ready to record</span>
          </div>

          <div class="recorded-actions">
            <h4>Recorded Actions</h4>
            <div class="actions-list"></div>
          </div>
        </div>

        <!-- Sequence Management -->
        <div class="sequence-management">
          <h3>Saved Sequences</h3>
          <div class="sequence-controls">
            <button class="refresh-sequences-btn">Refresh</button>
            <button class="import-sequence-btn">Import</button>
            <button class="export-sequences-btn">Export All</button>
            <button class="export-selected-btn">Export Selected</button>
          </div>

          <div class="sequence-list">
            <div class="sequence-list-header">
              <input type="checkbox" class="select-all-sequences" title="Select All">
              <span class="col-name">Name</span>
              <span class="col-type">Type</span>
              <span class="col-actions">Actions</span>
              <span class="col-duration">Duration</span>
              <span class="col-controls">Controls</span>
            </div>
            <div class="sequence-list-body">
              <!-- Sequences will be populated here -->
            </div>
          </div>
        </div>

        <!-- Sequence Editor -->
        <div class="sequence-editor" style="display: none;">
          <h3>Edit Sequence: <span class="editing-sequence-name"></span></h3>
          <div class="editor-controls">
            <button class="save-sequence-btn">Save Changes</button>
            <button class="cancel-edit-btn">Cancel</button>
            <button class="test-sequence-btn">Test Sequence</button>
          </div>

          <div class="sequence-timeline">
            <div class="timeline-header">
              <span class="col-step">Step</span>
              <span class="col-type">Type</span>
              <span class="col-action">Action</span>
              <span class="col-delay">Delay (ms)</span>
              <span class="col-description">Description</span>
              <span class="col-controls">Controls</span>
            </div>
            <div class="timeline-body">
              <!-- Timeline steps will be populated here -->
            </div>
          </div>

          <div class="add-step-controls">
            <select class="step-type-select">
              <option value="keypress">Keypress</option>
              <option value="command">Command</option>
              <option value="application">Application</option>
            </select>
            <input type="text" class="step-action-input" placeholder="Action" />
            <input type="number" class="step-delay-input" placeholder="Delay (ms)" value="100" min="0" max="10000" />
            <input type="text" class="step-description-input" placeholder="Description" />
            <button class="add-step-btn">Add Step</button>
          </div>
        </div>

        <!-- Playback Progress -->
        <div class="playback-progress" style="display: none;">
          <h3>Playing: <span class="playing-sequence-name"></span></h3>
          <div class="progress-bar">
            <div class="progress-fill"></div>
            <span class="progress-text">0%</span>
          </div>
          <div class="playback-controls">
            <button class="stop-playback-btn">Stop Playback</button>
          </div>
          <div class="current-step">
            <strong>Current Step:</strong> <span class="current-step-text">-</span>
          </div>
        </div>

        <!-- Statistics Panel -->
        <div class="statistics-panel">
          <h3>Statistics</h3>
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-label">Total Recordings:</span>
              <span class="stat-value" id="total-recordings">0</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Total Playbacks:</span>
              <span class="stat-value" id="total-playbacks">0</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Saved Sequences:</span>
              <span class="stat-value" id="saved-sequences-count">0</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Average Length:</span>
              <span class="stat-value" id="average-length">0</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Set up event listeners for UI interactions
   */
  setupEventListeners() {
    // Close button
    this.container.querySelector('.close-button').addEventListener('click', () => {
      this.hide();
    });

    // Recording controls
    this.container.querySelector('.start-recording-btn').addEventListener('click', () => {
      this.startRecording();
    });

    this.container.querySelector('.stop-recording-btn').addEventListener('click', () => {
      this.stopRecording();
    });

    this.container.querySelector('.cancel-recording-btn').addEventListener('click', () => {
      this.cancelRecording();
    });

    // Sequence management controls
    this.container.querySelector('.refresh-sequences-btn').addEventListener('click', () => {
      this.loadSavedSequences();
    });

    this.container.querySelector('.import-sequence-btn').addEventListener('click', () => {
      this.importSequence();
    });

    this.container.querySelector('.export-sequences-btn').addEventListener('click', () => {
      this.exportSequences();
    });

    this.container.querySelector('.export-selected-btn').addEventListener('click', () => {
      this.exportSelectedSequences();
    });

    // Select all sequences checkbox
    this.container.querySelector('.select-all-sequences').addEventListener('change', (e) => {
      this.handleSelectAllSequences(e.target.checked);
    });

    // Sequence editor controls
    this.container.querySelector('.save-sequence-btn').addEventListener('click', () => {
      this.saveEditedSequence();
    });

    this.container.querySelector('.cancel-edit-btn').addEventListener('click', () => {
      this.cancelEdit();
    });

    this.container.querySelector('.test-sequence-btn').addEventListener('click', () => {
      this.testSequence();
    });

    this.container.querySelector('.add-step-btn').addEventListener('click', () => {
      this.addSequenceStep();
    });

    // Playback controls
    this.container.querySelector('.stop-playback-btn').addEventListener('click', () => {
      this.stopPlayback();
    });

    // Setup IPC event listeners
    this.setupIPCListeners();
  }

  /**
   * Set up IPC event listeners for backend communication
   */
  setupIPCListeners() {
    // Recording events
    window.electronAPI.onMacroRecordingStarted((data) => {
      this.handleRecordingStarted(data);
    });

    window.electronAPI.onMacroActionRecorded((action) => {
      this.handleActionRecorded(action);
    });

    window.electronAPI.onMacroRecordingStopped((sequenceData) => {
      this.handleRecordingStopped(sequenceData);
    });

    // Playback events
    window.electronAPI.onMacroPlaybackStarted((data) => {
      this.handlePlaybackStarted(data);
    });

    window.electronAPI.onMacroPlaybackProgress((progress) => {
      this.handlePlaybackProgress(progress);
    });

    window.electronAPI.onMacroPlaybackCompleted((data) => {
      this.handlePlaybackCompleted(data);
    });

    window.electronAPI.onMacroPlaybackStopped((data) => {
      this.handlePlaybackStopped(data);
    });

    window.electronAPI.onMacroPlaybackError((error) => {
      this.handlePlaybackError(error);
    });
  }

  /**
   * Start recording a new macro sequence
   */
  async startRecording() {
    try {
      const nameInput = this.container.querySelector('.sequence-name-input');
      const sequenceName = nameInput.value.trim() || null;

      const result = await window.electronAPI.startMacroRecording(sequenceName);

      if (result.success) {
        this.isRecording = true;
        this.currentRecordingName = result.recordingName;
        this.recordedActions = [];

        this.updateRecordingUI();
        this.showNotification('Recording started', 'success');
      }
    } catch (error) {
      this.showNotification(`Error starting recording: ${error.message}`, 'error');
    }
  }

  /**
   * Stop recording the current macro sequence
   */
  async stopRecording() {
    try {
      const result = await window.electronAPI.stopMacroRecording();

      if (result.success) {
        this.isRecording = false;
        this.currentRecordingName = null;

        this.updateRecordingUI();
        this.loadSavedSequences();
        this.showNotification('Recording saved successfully', 'success');
      }
    } catch (error) {
      this.showNotification(`Error stopping recording: ${error.message}`, 'error');
    }
  }

  /**
   * Cancel the current recording
   */
  async cancelRecording() {
    try {
      const result = await window.electronAPI.cancelMacroRecording();

      if (result.success) {
        this.isRecording = false;
        this.currentRecordingName = null;
        this.recordedActions = [];

        this.updateRecordingUI();
        this.showNotification('Recording cancelled', 'info');
      }
    } catch (error) {
      this.showNotification(`Error cancelling recording: ${error.message}`, 'error');
    }
  }

  /**
   * Play a saved macro sequence
   */
  async playSequence(sequenceName) {
    try {
      const result = await window.electronAPI.playMacroSequence(sequenceName);

      if (result.success) {
        this.currentPlaybackName = sequenceName;
        this.showNotification(`Playing sequence: ${sequenceName}`, 'info');
      }
    } catch (error) {
      this.showNotification(`Error playing sequence: ${error.message}`, 'error');
    }
  }

  /**
   * Stop current playback
   */
  async stopPlayback() {
    try {
      const result = await window.electronAPI.stopMacroPlayback();

      if (result.success) {
        this.isPlaying = false;
        this.currentPlaybackName = null;
        this.updatePlaybackUI();
        this.showNotification('Playback stopped', 'info');
      }
    } catch (error) {
      this.showNotification(`Error stopping playback: ${error.message}`, 'error');
    }
  }

  /**
   * Load saved sequences from backend
   */
  async loadSavedSequences() {
    try {
      this.savedSequences = await window.electronAPI.getSavedSequences();
      this.renderSequenceList();
      this.updateStatistics();
    } catch (error) {
      this.showNotification(`Error loading sequences: ${error.message}`, 'error');
    }
  }

  /**
   * Render the sequence list
   */
  renderSequenceList() {
    const listBody = this.container.querySelector('.sequence-list-body');
    listBody.innerHTML = '';

    Object.entries(this.savedSequences).forEach(([name, sequence]) => {
      const sequenceRow = this.createSequenceRow(name, sequence);
      listBody.appendChild(sequenceRow);
    });
  }

  /**
   * Create a sequence list row
   */
  createSequenceRow(name, sequence) {
    const row = document.createElement('div');
    row.className = 'sequence-row';
    row.innerHTML = `
      <span class="col-name" title="${sequence.description || name}">${name}</span>
      <span class="col-type">${sequence.type || 'recorded'}</span>
      <span class="col-actions">${sequence.sequence ? sequence.sequence.length : 0}</span>
      <span class="col-duration">${this.formatDuration(sequence.metadata?.duration || 0)}</span>
      <div class="col-controls">
        <button class="play-btn" data-sequence="${name}" title="Play Sequence">▶</button>
        <button class="edit-btn" data-sequence="${name}" title="Edit Sequence">✏</button>
        <button class="duplicate-btn" data-sequence="${name}" title="Duplicate Sequence">📄</button>
        <button class="delete-btn" data-sequence="${name}" title="Delete Sequence">🗑</button>
      </div>
    `;

    // Add event listeners for row controls
    row.querySelector('.play-btn').addEventListener('click', () => {
      this.playSequence(name);
    });

    row.querySelector('.edit-btn').addEventListener('click', () => {
      this.editSequence(name);
    });

    row.querySelector('.duplicate-btn').addEventListener('click', () => {
      this.duplicateSequence(name);
    });

    row.querySelector('.delete-btn').addEventListener('click', () => {
      this.deleteSequence(name);
    });

    return row;
  }

  /**
   * Update recording UI state
   */
  updateRecordingUI() {
    const startBtn = this.container.querySelector('.start-recording-btn');
    const stopBtn = this.container.querySelector('.stop-recording-btn');
    const cancelBtn = this.container.querySelector('.cancel-recording-btn');
    const statusIndicator = this.container.querySelector('.status-indicator');
    const statusText = this.container.querySelector('.status-text');
    const nameInput = this.container.querySelector('.sequence-name-input');

    if (this.isRecording) {
      startBtn.disabled = true;
      stopBtn.disabled = false;
      cancelBtn.disabled = false;
      nameInput.disabled = true;

      statusIndicator.className = 'status-indicator recording';
      statusText.textContent = `Recording: ${this.currentRecordingName}`;
    } else {
      startBtn.disabled = false;
      stopBtn.disabled = true;
      cancelBtn.disabled = true;
      nameInput.disabled = false;

      statusIndicator.className = 'status-indicator';
      statusText.textContent = 'Ready to record';
    }

    this.renderRecordedActions();
  }

  /**
   * Update playback UI state
   */
  updatePlaybackUI() {
    const playbackPanel = this.container.querySelector('.playback-progress');

    if (this.isPlaying) {
      playbackPanel.style.display = 'block';
      playbackPanel.querySelector('.playing-sequence-name').textContent = this.currentPlaybackName || 'Unknown';
    } else {
      playbackPanel.style.display = 'none';
    }
  }

  /**
   * Render recorded actions during recording
   */
  renderRecordedActions() {
    const actionsList = this.container.querySelector('.actions-list');
    actionsList.innerHTML = '';

    this.recordedActions.forEach((action, index) => {
      const actionElement = document.createElement('div');
      actionElement.className = 'recorded-action';
      actionElement.innerHTML = `
        <span class="action-index">${index + 1}</span>
        <span class="action-type">${action.type}</span>
        <span class="action-details">${action.action}</span>
        <span class="action-delay">${action.delay}ms</span>
        <span class="action-description">${action.description || ''}</span>
      `;
      actionsList.appendChild(actionElement);
    });
  }

  /**
   * Handle backend recording started event
   */
  handleRecordingStarted(data) {
    this.isRecording = true;
    this.currentRecordingName = data.name;
    this.recordedActions = [];
    this.updateRecordingUI();
  }

  /**
   * Handle backend action recorded event
   */
  handleActionRecorded(action) {
    this.recordedActions.push(action);
    this.renderRecordedActions();
  }

  /**
   * Handle backend recording stopped event
   */
  handleRecordingStopped(sequenceData) {
    this.isRecording = false;
    this.currentRecordingName = null;
    this.updateRecordingUI();
    this.loadSavedSequences();
  }

  /**
   * Handle backend playback started event
   */
  handlePlaybackStarted(data) {
    this.isPlaying = true;
    this.currentPlaybackName = data.name;
    this.updatePlaybackUI();
  }

  /**
   * Handle backend playback progress event
   */
  handlePlaybackProgress(progress) {
    const progressFill = this.container.querySelector('.progress-fill');
    const progressText = this.container.querySelector('.progress-text');
    const currentStepText = this.container.querySelector('.current-step-text');

    progressFill.style.width = `${progress.progress}%`;
    progressText.textContent = `${Math.round(progress.progress)}%`;
    currentStepText.textContent = `${progress.currentStep}/${progress.totalSteps}: ${progress.currentAction.description || progress.currentAction.type}`;
  }

  /**
   * Handle backend playback completed event
   */
  handlePlaybackCompleted(data) {
    this.isPlaying = false;
    this.currentPlaybackName = null;
    this.updatePlaybackUI();
    this.showNotification(`Sequence completed: ${data.name}`, 'success');
  }

  /**
   * Handle backend playback stopped event
   */
  handlePlaybackStopped(data) {
    this.isPlaying = false;
    this.currentPlaybackName = null;
    this.updatePlaybackUI();
  }

  /**
   * Handle backend playback error event
   */
  handlePlaybackError(error) {
    this.isPlaying = false;
    this.currentPlaybackName = null;
    this.updatePlaybackUI();
    this.showNotification(`Playback error: ${error.error}`, 'error');
  }

  /**
   * Update statistics display
   */
  async updateStatistics() {
    try {
      const stats = await window.electronAPI.getMacroStatistics();

      document.getElementById('total-recordings').textContent = stats.totalRecordings;
      document.getElementById('total-playbacks').textContent = stats.totalPlaybacks;
      document.getElementById('saved-sequences-count').textContent = stats.savedSequenceCount;
      document.getElementById('average-length').textContent = Math.round(stats.averageSequenceLength);
    } catch (error) {
      console.error('Error updating statistics:', error);
    }
  }

  /**
   * Format duration in milliseconds to human readable
   */
  formatDuration(ms) {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    }
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  }

  /**
   * Show the macro recorder UI
   */
  show() {
    this.container.style.display = 'block';
    this.loadSavedSequences();
    this.updateStatistics();
  }

  /**
   * Hide the macro recorder UI
   */
  hide() {
    this.container.style.display = 'none';
  }

  /**
   * Get the container element
   */
  getElement() {
    return this.container;
  }

  /**
   * Show notification to user
   */
  showNotification(message, type = 'info') {
    // This would integrate with the existing notification system
    console.log(`[${type.toUpperCase()}] ${message}`);

    // If there's a global notification system, use it
    if (window.showNotification) {
      window.showNotification(message, type);
    }
  }

  /**
   * Delete a sequence with confirmation
   */
  async deleteSequence(sequenceName) {
    if (!confirm(`Are you sure you want to delete the sequence "${sequenceName}"?`)) {
      return;
    }

    try {
      const result = await window.electronAPI.deleteMacroSequence(sequenceName);

      if (result.success) {
        this.loadSavedSequences();
        this.showNotification(`Deleted sequence: ${sequenceName}`, 'success');
      }
    } catch (error) {
      this.showNotification(`Error deleting sequence: ${error.message}`, 'error');
    }
  }

  /**
   * Duplicate a sequence
   */
  async duplicateSequence(sourceName) {
    const newName = prompt('Enter name for duplicated sequence:', `${sourceName}_copy`);
    if (!newName || newName.trim() === '') {
      return;
    }

    try {
      const result = await window.electronAPI.duplicateMacroSequence(sourceName, newName.trim());

      if (result.success) {
        this.loadSavedSequences();
        this.showNotification(`Duplicated sequence: ${newName}`, 'success');
      }
    } catch (error) {
      this.showNotification(`Error duplicating sequence: ${error.message}`, 'error');
    }
  }

  /**
   * Edit a sequence (placeholder - would open sequence editor)
   */
  editSequence(sequenceName) {
    this.showNotification(`Sequence editor for "${sequenceName}" - Coming soon!`, 'info');
    // TODO: Implement sequence editor
  }

  /**
   * Import sequence from file (placeholder)
   */
  importSequence() {
    this.showNotification('Import sequence - Coming soon!', 'info');
    // TODO: Implement sequence import
  }

  /**
   * Export all sequences (placeholder)
   */
  exportSequences() {
    this.showNotification('Export sequences - Coming soon!', 'info');
    // TODO: Implement sequence export
  }

  /**
   * Save edited sequence (placeholder)
   */
  saveEditedSequence() {
    this.showNotification('Save edited sequence - Coming soon!', 'info');
    // TODO: Implement sequence saving
  }

  /**
   * Cancel sequence editing (placeholder)
   */
  cancelEdit() {
    this.showNotification('Cancel edit - Coming soon!', 'info');
    // TODO: Implement edit cancellation
  }

  /**
   * Test a sequence (placeholder)
   */
  testSequence() {
    this.showNotification('Test sequence - Coming soon!', 'info');
    // TODO: Implement sequence testing
  }

  /**
   * Add a step to the sequence being edited (placeholder)
   */
  addSequenceStep() {
    this.showNotification('Add sequence step - Coming soon!', 'info');
    // TODO: Implement step addition
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MacroRecorderUI;
}
