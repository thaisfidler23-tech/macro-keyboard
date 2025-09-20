/**
 * Voice Recognition UI
 * 
 * Frontend interface for voice recognition management, providing microphone control,
 * voice command configuration, training interface, and real-time feedback.
 * 
 * Features:
 * - Microphone management with real-time audio level display
 * - Voice command configuration and testing
 * - Voice training interface for custom phrases
 * - Recognition status and statistics dashboard
 * - Profile management with import/export
 * - Real-time voice feedback and notifications
 */

class VoiceRecognitionUI {
  constructor() {
    this.isVisible = false;
    this.currentTab = 'control';
    this.isListening = false;
    this.audioLevelInterval = null;
    this.statisticsInterval = null;

    // Voice recognition data
    this.voiceStatus = {};
    this.voiceCommands = new Map();
    this.voiceProfiles = [];
    this.recognitionStats = {};
    this.commandHistory = [];

    // Audio visualization
    this.audioCanvas = null;
    this.audioCtx = null;
    this.animationId = null;

    // Event handlers
    this.eventHandlers = new Map();

    this.logger = console;
  }

  /**
   * Show the voice recognition interface
   */
  show() {
    if (this.isVisible) return;

    this.createUI();
    this.setupEventHandlers();
    this.loadVoiceData();
    this.startPeriodicUpdates();

    this.isVisible = true;
    this.logger.info('Voice recognition UI shown');
  }

  /**
   * Hide the voice recognition interface
   */
  hide() {
    if (!this.isVisible) return;

    this.cleanup();
    const modal = document.getElementById('voice-recognition-modal');
    if (modal) {
      modal.remove();
    }

    this.isVisible = false;
    this.logger.info('Voice recognition UI hidden');
  }

  /**
   * Create the main UI structure
   */
  createUI() {
    const modal = document.createElement('div');
    modal.id = 'voice-recognition-modal';
    modal.className = 'modal voice-recognition-modal';
    modal.innerHTML = this.getModalHTML();

    document.body.appendChild(modal);

    // Initialize tabs
    this.switchTab('control');

    // Initialize audio visualization
    this.initializeAudioVisualization();

    // Set up keyboard shortcuts
    this.setupKeyboardShortcuts();
  }

  /**
   * Get the modal HTML structure
   */
  getModalHTML() {
    return `
      <div class="modal-overlay">
        <div class="modal-content voice-recognition-content">
          <div class="modal-header">
            <h2>Voice Recognition Control</h2>
            <div class="modal-controls">
              <button id="voice-minimize-btn" class="modal-btn minimize-btn" title="Minimize (Ctrl+M)">
                <span class="icon">−</span>
              </button>
              <button id="voice-close-btn" class="modal-btn close-btn" title="Close (Escape)">
                <span class="icon">×</span>
              </button>
            </div>
          </div>

          <div class="modal-tabs">
            <button class="tab-btn active" data-tab="control">
              <span class="tab-icon">🎤</span>
              Voice Control
            </button>
            <button class="tab-btn" data-tab="commands">
              <span class="tab-icon">📝</span>
              Commands
            </button>
            <button class="tab-btn" data-tab="training">
              <span class="tab-icon">🎯</span>
              Training
            </button>
            <button class="tab-btn" data-tab="profiles">
              <span class="tab-icon">👤</span>
              Profiles
            </button>
            <button class="tab-btn" data-tab="statistics">
              <span class="tab-icon">📊</span>
              Statistics
            </button>
          </div>

          <div class="modal-body">
            ${this.getControlTabHTML()}
            ${this.getCommandsTabHTML()}
            ${this.getTrainingTabHTML()}
            ${this.getProfilesTabHTML()}
            ${this.getStatisticsTabHTML()}
          </div>

          <div class="modal-footer">
            <div class="footer-info">
              <span id="voice-status-text">Ready</span>
              <div class="voice-indicators">
                <div class="indicator" id="listening-indicator" title="Listening">🎤</div>
                <div class="indicator" id="processing-indicator" title="Processing">⚡</div>
                <div class="indicator" id="feedback-indicator" title="Feedback">🔊</div>
              </div>
            </div>
            <div class="footer-actions">
              <button id="voice-help-btn" class="btn btn-secondary">Help</button>
              <button id="voice-settings-btn" class="btn btn-secondary">Settings</button>
              <button id="voice-save-btn" class="btn btn-primary">Save Configuration</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Get Voice Control tab HTML
   */
  getControlTabHTML() {
    return `
      <div id="tab-control" class="tab-content active">
        <div class="voice-control-section">
          <div class="audio-visualization-container">
            <canvas id="audio-visualization" width="400" height="100"></canvas>
            <div class="audio-controls">
              <button id="start-listening-btn" class="btn btn-success btn-large">
                <span class="icon">🎤</span>
                Start Listening
              </button>
              <button id="stop-listening-btn" class="btn btn-danger btn-large" style="display: none;">
                <span class="icon">🛑</span>
                Stop Listening
              </button>
              <button id="pause-listening-btn" class="btn btn-warning" style="display: none;">
                <span class="icon">⏸️</span>
                Pause
              </button>
            </div>
          </div>

          <div class="recognition-feedback">
            <div class="feedback-section">
              <h4>Recognition Output</h4>
              <div id="interim-result" class="interim-result"></div>
              <div id="final-result" class="final-result"></div>
              <div id="command-result" class="command-result"></div>
            </div>

            <div class="audio-settings">
              <h4>Audio Settings</h4>
              <div class="setting-group">
                <label for="microphone-gain">Microphone Gain</label>
                <input type="range" id="microphone-gain" min="0" max="2" step="0.1" value="1">
                <span id="gain-value">1.0</span>
              </div>
              <div class="setting-group">
                <label for="noise-threshold">Noise Threshold</label>
                <input type="range" id="noise-threshold" min="0" max="1" step="0.05" value="0.3">
                <span id="threshold-value">0.3</span>
              </div>
              <div class="setting-group">
                <label for="confidence-threshold">Confidence Threshold</label>
                <input type="range" id="confidence-threshold" min="0" max="1" step="0.05" value="0.7">
                <span id="confidence-value">0.7</span>
              </div>
            </div>
          </div>

          <div class="quick-test-section">
            <h4>Quick Command Test</h4>
            <div class="test-controls">
              <input type="text" id="test-phrase" placeholder="Enter phrase to test..." />
              <button id="test-command-btn" class="btn btn-secondary">Test Command</button>
              <button id="test-confidence-btn" class="btn btn-secondary">Test Confidence</button>
            </div>
            <div id="test-results" class="test-results"></div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Get Commands tab HTML
   */
  getCommandsTabHTML() {
    return `
      <div id="tab-commands" class="tab-content">
        <div class="commands-section">
          <div class="commands-header">
            <h4>Voice Commands</h4>
            <div class="commands-actions">
              <button id="add-command-btn" class="btn btn-primary">
                <span class="icon">➕</span>
                Add Command
              </button>
              <button id="import-commands-btn" class="btn btn-secondary">Import</button>
              <button id="export-commands-btn" class="btn btn-secondary">Export</button>
            </div>
          </div>

          <div class="command-form" id="command-form" style="display: none;">
            <div class="form-group">
              <label for="command-phrase">Voice Phrase</label>
              <input type="text" id="command-phrase" placeholder="e.g., 'start recording'" />
            </div>
            <div class="form-group">
              <label for="command-action">Action</label>
              <select id="command-action">
                <option value="">Select action...</option>
                <option value="start-macro-recording">Start Macro Recording</option>
                <option value="stop-macro-recording">Stop Macro Recording</option>
                <option value="play-macro">Play Macro</option>
                <option value="pause-macro">Pause Macro</option>
                <option value="show-main-window">Show Main Window</option>
                <option value="hide-main-window">Hide Main Window</option>
                <option value="toggle-rgb-mode">Toggle RGB Mode</option>
                <option value="switch-profile">Switch Profile</option>
                <option value="execute-shortcut">Execute Shortcut</option>
                <option value="custom">Custom Action</option>
              </select>
            </div>
            <div class="form-group">
              <label for="command-confidence">Minimum Confidence</label>
              <input type="number" id="command-confidence" min="0" max="1" step="0.05" value="0.7" />
            </div>
            <div class="form-group">
              <label for="command-parameters">Parameters (JSON)</label>
              <textarea id="command-parameters" placeholder='{"key": "value"}'></textarea>
            </div>
            <div class="form-actions">
              <button id="save-command-btn" class="btn btn-success">Save Command</button>
              <button id="cancel-command-btn" class="btn btn-secondary">Cancel</button>
              <button id="test-new-command-btn" class="btn btn-info">Test</button>
            </div>
          </div>

          <div class="commands-list">
            <div class="list-header">
              <input type="text" id="command-search" placeholder="Search commands..." />
              <select id="command-filter">
                <option value="">All commands</option>
                <option value="macro">Macro commands</option>
                <option value="application">Application commands</option>
                <option value="system">System commands</option>
                <option value="custom">Custom commands</option>
              </select>
            </div>
            <div id="commands-container" class="commands-container">
              <!-- Commands will be populated here -->
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Get Training tab HTML
   */
  getTrainingTabHTML() {
    return `
      <div id="tab-training" class="tab-content">
        <div class="training-section">
          <div class="training-header">
            <h4>Voice Training</h4>
            <p>Improve recognition accuracy by training the system with your voice patterns.</p>
          </div>

          <div class="training-modes">
            <div class="training-mode-card">
              <h5>Command Training</h5>
              <p>Record multiple pronunciations of your commands to improve accuracy.</p>
              <button id="start-command-training-btn" class="btn btn-primary">Start Training</button>
            </div>

            <div class="training-mode-card">
              <h5>Vocabulary Training</h5>
              <p>Add custom words and phrases to expand recognition vocabulary.</p>
              <button id="start-vocab-training-btn" class="btn btn-primary">Start Training</button>
            </div>

            <div class="training-mode-card">
              <h5>Accent Training</h5>
              <p>Train the system to better recognize your accent and pronunciation.</p>
              <button id="start-accent-training-btn" class="btn btn-primary">Start Training</button>
            </div>
          </div>

          <div id="training-interface" class="training-interface" style="display: none;">
            <div class="training-prompt">
              <h4 id="training-title">Training Session</h4>
              <div id="training-instructions" class="training-instructions"></div>
              <div id="training-phrase" class="training-phrase"></div>
            </div>

            <div class="training-controls">
              <button id="record-training-btn" class="btn btn-danger">
                <span class="icon">🎤</span>
                Record
              </button>
              <button id="play-training-btn" class="btn btn-secondary" disabled>
                <span class="icon">▶️</span>
                Play Back
              </button>
              <button id="accept-training-btn" class="btn btn-success" disabled>
                <span class="icon">✅</span>
                Accept
              </button>
              <button id="retry-training-btn" class="btn btn-warning" disabled>
                <span class="icon">🔄</span>
                Retry
              </button>
            </div>

            <div class="training-progress">
              <div class="progress-bar">
                <div id="training-progress-fill" class="progress-fill"></div>
              </div>
              <span id="training-progress-text">0 / 0 completed</span>
            </div>

            <div class="training-results">
              <div id="training-feedback" class="training-feedback"></div>
            </div>
          </div>

          <div class="training-history">
            <h5>Training History</h5>
            <div id="training-sessions" class="training-sessions">
              <!-- Training history will be populated here -->
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Get Profiles tab HTML
   */
  getProfilesTabHTML() {
    return `
      <div id="tab-profiles" class="tab-content">
        <div class="profiles-section">
          <div class="profiles-header">
            <h4>Voice Profiles</h4>
            <div class="profiles-actions">
              <button id="create-profile-btn" class="btn btn-primary">
                <span class="icon">➕</span>
                Create Profile
              </button>
              <button id="import-profile-btn" class="btn btn-secondary">Import</button>
              <button id="export-profile-btn" class="btn btn-secondary">Export</button>
            </div>
          </div>

          <div class="current-profile">
            <h5>Current Profile</h5>
            <div id="current-profile-info" class="profile-info">
              <!-- Current profile info will be populated here -->
            </div>
          </div>

          <div class="profiles-list">
            <h5>Available Profiles</h5>
            <div id="profiles-container" class="profiles-container">
              <!-- Profiles will be populated here -->
            </div>
          </div>

          <div id="profile-editor" class="profile-editor" style="display: none;">
            <h5 id="profile-editor-title">Create New Profile</h5>
            <div class="form-group">
              <label for="profile-name">Profile Name</label>
              <input type="text" id="profile-name" placeholder="Enter profile name..." />
            </div>
            <div class="form-group">
              <label for="profile-language">Language</label>
              <select id="profile-language">
                <option value="en-US">English (US)</option>
                <option value="en-GB">English (UK)</option>
                <option value="es-ES">Spanish</option>
                <option value="fr-FR">French</option>
                <option value="de-DE">German</option>
                <option value="it-IT">Italian</option>
                <option value="pt-BR">Portuguese (Brazil)</option>
                <option value="ja-JP">Japanese</option>
                <option value="ko-KR">Korean</option>
                <option value="zh-CN">Chinese (Simplified)</option>
              </select>
            </div>
            <div class="form-group">
              <label for="profile-description">Description</label>
              <textarea id="profile-description" placeholder="Optional description..."></textarea>
            </div>
            <div class="profile-settings">
              <h6>Profile Settings</h6>
              <div class="setting-group">
                <label>
                  <input type="checkbox" id="profile-continuous" checked />
                  Continuous Recognition
                </label>
              </div>
              <div class="setting-group">
                <label>
                  <input type="checkbox" id="profile-interim" checked />
                  Show Interim Results
                </label>
              </div>
              <div class="setting-group">
                <label>
                  <input type="checkbox" id="profile-feedback" checked />
                  Voice Feedback
                </label>
              </div>
            </div>
            <div class="form-actions">
              <button id="save-profile-btn" class="btn btn-success">Save Profile</button>
              <button id="cancel-profile-btn" class="btn btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Get Statistics tab HTML
   */
  getStatisticsTabHTML() {
    return `
      <div id="tab-statistics" class="tab-content">
        <div class="statistics-section">
          <div class="stats-header">
            <h4>Voice Recognition Statistics</h4>
            <div class="stats-actions">
              <button id="refresh-stats-btn" class="btn btn-secondary">
                <span class="icon">🔄</span>
                Refresh
              </button>
              <button id="export-stats-btn" class="btn btn-secondary">Export Data</button>
              <button id="reset-stats-btn" class="btn btn-warning">Reset Statistics</button>
            </div>
          </div>

          <div class="stats-overview">
            <div class="stat-card">
              <div class="stat-value" id="total-commands-stat">0</div>
              <div class="stat-label">Total Commands</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" id="success-rate-stat">0%</div>
              <div class="stat-label">Success Rate</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" id="avg-confidence-stat">0%</div>
              <div class="stat-label">Avg Confidence</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" id="listening-time-stat">0m</div>
              <div class="stat-label">Listening Time</div>
            </div>
          </div>

          <div class="stats-charts">
            <div class="chart-container">
              <h5>Command Usage Over Time</h5>
              <canvas id="usage-chart" width="400" height="200"></canvas>
            </div>
            <div class="chart-container">
              <h5>Recognition Confidence Distribution</h5>
              <canvas id="confidence-chart" width="400" height="200"></canvas>
            </div>
          </div>

          <div class="command-history">
            <h5>Recent Commands</h5>
            <div class="history-controls">
              <input type="text" id="history-search" placeholder="Search command history..." />
              <select id="history-filter">
                <option value="">All commands</option>
                <option value="successful">Successful only</option>
                <option value="failed">Failed only</option>
                <option value="low-confidence">Low confidence</option>
              </select>
            </div>
            <div id="command-history-list" class="command-history-list">
              <!-- Command history will be populated here -->
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Set up event handlers
   */
  setupEventHandlers() {
    // Close button
    const closeBtn = document.getElementById('voice-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabId = e.target.closest('.tab-btn').dataset.tab;
        this.switchTab(tabId);
      });
    });

    // Voice control buttons
    this.setupVoiceControlHandlers();
    
    // Command management handlers
    this.setupCommandHandlers();
    
    // Training handlers
    this.setupTrainingHandlers();
    
    // Profile handlers
    this.setupProfileHandlers();
    
    // Statistics handlers
    this.setupStatisticsHandlers();

    // Settings handlers
    this.setupSettingsHandlers();
  }

  /**
   * Set up voice control event handlers
   */
  setupVoiceControlHandlers() {
    // Start/Stop/Pause listening buttons
    const startBtn = document.getElementById('start-listening-btn');
    const stopBtn = document.getElementById('stop-listening-btn');
    const pauseBtn = document.getElementById('pause-listening-btn');

    if (startBtn) {
      startBtn.addEventListener('click', async () => {
        try {
          await window.electronAPI.startVoiceListening();
          this.updateListeningUI(true);
        } catch (error) {
          this.showNotification('Failed to start voice recognition', 'error');
        }
      });
    }

    if (stopBtn) {
      stopBtn.addEventListener('click', async () => {
        try {
          await window.electronAPI.stopVoiceListening();
          this.updateListeningUI(false);
        } catch (error) {
          this.showNotification('Failed to stop voice recognition', 'error');
        }
      });
    }

    if (pauseBtn) {
      pauseBtn.addEventListener('click', async () => {
        try {
          await window.electronAPI.pauseVoiceListening();
          this.updateListeningUI(false, true);
        } catch (error) {
          this.showNotification('Failed to pause voice recognition', 'error');
        }
      });
    }

    // Audio settings sliders
    const gainSlider = document.getElementById('microphone-gain');
    if (gainSlider) {
      gainSlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        document.getElementById('gain-value').textContent = value.toFixed(1);
        window.electronAPI.setVoiceGain(value);
      });
    }

    // Test command button
    const testBtn = document.getElementById('test-command-btn');
    if (testBtn) {
      testBtn.addEventListener('click', () => {
        const phrase = document.getElementById('test-phrase').value.trim();
        if (phrase) {
          this.testVoiceCommand(phrase);
        }
      });
    }
  }

  /**
   * Set up command management handlers
   */
  setupCommandHandlers() {
    // Add command button
    const addBtn = document.getElementById('add-command-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        this.showCommandForm();
      });
    }

    // Save command button
    const saveBtn = document.getElementById('save-command-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        this.saveVoiceCommand();
      });
    }

    // Cancel command button
    const cancelBtn = document.getElementById('cancel-command-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.hideCommandForm();
      });
    }

    // Search and filter
    const searchInput = document.getElementById('command-search');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.filterCommands();
      });
    }

    const filterSelect = document.getElementById('command-filter');
    if (filterSelect) {
      filterSelect.addEventListener('change', () => {
        this.filterCommands();
      });
    }
  }

  /**
   * Set up training handlers
   */
  setupTrainingHandlers() {
    // Training mode buttons
    const commandTrainingBtn = document.getElementById('start-command-training-btn');
    if (commandTrainingBtn) {
      commandTrainingBtn.addEventListener('click', () => {
        this.startTraining('command');
      });
    }

    const vocabTrainingBtn = document.getElementById('start-vocab-training-btn');
    if (vocabTrainingBtn) {
      vocabTrainingBtn.addEventListener('click', () => {
        this.startTraining('vocabulary');
      });
    }

    const accentTrainingBtn = document.getElementById('start-accent-training-btn');
    if (accentTrainingBtn) {
      accentTrainingBtn.addEventListener('click', () => {
        this.startTraining('accent');
      });
    }
  }

  /**
   * Set up profile handlers
   */
  setupProfileHandlers() {
    // Create profile button
    const createBtn = document.getElementById('create-profile-btn');
    if (createBtn) {
      createBtn.addEventListener('click', () => {
        this.showProfileEditor();
      });
    }

    // Save profile button
    const saveBtn = document.getElementById('save-profile-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        this.saveVoiceProfile();
      });
    }
  }

  /**
   * Set up statistics handlers
   */
  setupStatisticsHandlers() {
    // Refresh stats button
    const refreshBtn = document.getElementById('refresh-stats-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.loadStatistics();
      });
    }

    // Reset stats button
    const resetBtn = document.getElementById('reset-stats-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all voice recognition statistics?')) {
          this.resetStatistics();
        }
      });
    }
  }

  /**
   * Set up settings handlers
   */
  setupSettingsHandlers() {
    // Settings sliders and controls
    const thresholdSlider = document.getElementById('noise-threshold');
    if (thresholdSlider) {
      thresholdSlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        document.getElementById('threshold-value').textContent = value.toFixed(2);
        window.electronAPI.setVoiceNoiseThreshold(value);
      });
    }

    const confidenceSlider = document.getElementById('confidence-threshold');
    if (confidenceSlider) {
      confidenceSlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        document.getElementById('confidence-value').textContent = value.toFixed(2);
        window.electronAPI.setVoiceConfidenceThreshold(value);
      });
    }
  }

  /**
   * Set up keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    const modal = document.getElementById('voice-recognition-modal');
    if (!modal) return;

    modal.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case '1':
          case '2':
          case '3':
          case '4':
          case '5':
            e.preventDefault();
            const tabIndex = parseInt(e.key) - 1;
            const tabs = ['control', 'commands', 'training', 'profiles', 'statistics'];
            if (tabs[tabIndex]) {
              this.switchTab(tabs[tabIndex]);
            }
            break;
          case 'm':
            e.preventDefault();
            // Minimize functionality
            break;
          case 's':
            e.preventDefault();
            this.saveConfiguration();
            break;
        }
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        this.hide();
      }
    });
  }

  /**
   * Initialize audio visualization
   */
  initializeAudioVisualization() {
    const canvas = document.getElementById('audio-visualization');
    if (!canvas) return;

    this.audioCanvas = canvas;
    this.audioCtx = canvas.getContext('2d');
    
    // Start visualization loop
    this.startAudioVisualization();
  }

  /**
   * Start audio visualization animation
   */
  startAudioVisualization() {
    const draw = () => {
      if (!this.audioCanvas || !this.audioCtx) return;

      const width = this.audioCanvas.width;
      const height = this.audioCanvas.height;

      // Clear canvas
      this.audioCtx.clearRect(0, 0, width, height);

      // Draw background
      this.audioCtx.fillStyle = '#1e1e1e';
      this.audioCtx.fillRect(0, 0, width, height);

      // Draw audio level bars (simulated for now)
      if (this.isListening) {
        const barCount = 20;
        const barWidth = width / barCount;
        
        for (let i = 0; i < barCount; i++) {
          const barHeight = Math.random() * height * 0.8;
          const x = i * barWidth;
          const y = height - barHeight;
          
          // Color gradient based on height
          const intensity = barHeight / height;
          const hue = intensity * 120; // Green to red
          this.audioCtx.fillStyle = `hsl(${hue}, 70%, 50%)`;
          
          this.audioCtx.fillRect(x, y, barWidth - 2, barHeight);
        }
      } else {
        // Draw inactive state
        this.audioCtx.fillStyle = '#444';
        this.audioCtx.font = '16px Arial';
        this.audioCtx.textAlign = 'center';
        this.audioCtx.fillText('Voice recognition inactive', width / 2, height / 2);
      }

      this.animationId = requestAnimationFrame(draw);
    };

    draw();
  }

  /**
   * Switch to a specific tab
   */
  switchTab(tabId) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(`tab-${tabId}`).classList.add('active');

    this.currentTab = tabId;

    // Load tab-specific data
    switch (tabId) {
      case 'commands':
        this.loadCommands();
        break;
      case 'profiles':
        this.loadProfiles();
        break;
      case 'statistics':
        this.loadStatistics();
        break;
    }
  }

  /**
   * Load voice recognition data
   */
  async loadVoiceData() {
    try {
      this.voiceStatus = await window.electronAPI.getVoiceRecognitionStatus();
      this.updateStatusDisplay();
    } catch (error) {
      this.logger.error('Failed to load voice data', error);
      this.showNotification('Failed to load voice recognition data', 'error');
    }
  }

  /**
   * Update listening UI state
   */
  updateListeningUI(isListening, isPaused = false) {
    this.isListening = isListening;

    const startBtn = document.getElementById('start-listening-btn');
    const stopBtn = document.getElementById('stop-listening-btn');
    const pauseBtn = document.getElementById('pause-listening-btn');
    const indicator = document.getElementById('listening-indicator');

    if (isListening && !isPaused) {
      startBtn.style.display = 'none';
      stopBtn.style.display = 'inline-block';
      pauseBtn.style.display = 'inline-block';
      indicator.classList.add('active');
    } else if (isPaused) {
      startBtn.textContent = 'Resume';
      startBtn.style.display = 'inline-block';
      stopBtn.style.display = 'inline-block';
      pauseBtn.style.display = 'none';
      indicator.classList.remove('active');
    } else {
      startBtn.style.display = 'inline-block';
      startBtn.textContent = 'Start Listening';
      stopBtn.style.display = 'none';
      pauseBtn.style.display = 'none';
      indicator.classList.remove('active');
    }
  }

  /**
   * Update status display
   */
  updateStatusDisplay() {
    const statusText = document.getElementById('voice-status-text');
    if (statusText && this.voiceStatus) {
      let status = 'Ready';
      if (this.voiceStatus.listening) {
        status = this.voiceStatus.paused ? 'Paused' : 'Listening';
      } else if (!this.voiceStatus.initialized) {
        status = 'Not Initialized';
      }
      
      statusText.textContent = status;
    }
  }

  /**
   * Test a voice command
   */
  async testVoiceCommand(phrase) {
    try {
      const result = await window.electronAPI.testVoiceCommand(phrase);
      const resultsDiv = document.getElementById('test-results');
      
      if (result.matched) {
        resultsDiv.innerHTML = `
          <div class="test-success">
            <strong>✅ Command Matched</strong><br>
            Action: ${result.action}<br>
            Confidence: ${(result.confidence * 100).toFixed(1)}%
          </div>
        `;
      } else {
        resultsDiv.innerHTML = `
          <div class="test-failure">
            <strong>❌ No Command Match</strong><br>
            Phrase: "${phrase}"<br>
            Suggestions: ${result.suggestions?.join(', ') || 'None'}
          </div>
        `;
      }
    } catch (error) {
      this.showNotification('Failed to test command', 'error');
    }
  }

  /**
   * Show command form
   */
  showCommandForm() {
    const form = document.getElementById('command-form');
    if (form) {
      form.style.display = 'block';
      document.getElementById('command-phrase').focus();
    }
  }

  /**
   * Hide command form
   */
  hideCommandForm() {
    const form = document.getElementById('command-form');
    if (form) {
      form.style.display = 'none';
      this.clearCommandForm();
    }
  }

  /**
   * Clear command form
   */
  clearCommandForm() {
    document.getElementById('command-phrase').value = '';
    document.getElementById('command-action').value = '';
    document.getElementById('command-confidence').value = '0.7';
    document.getElementById('command-parameters').value = '';
  }

  /**
   * Save voice command
   */
  async saveVoiceCommand() {
    try {
      const phrase = document.getElementById('command-phrase').value.trim();
      const action = document.getElementById('command-action').value;
      const confidence = parseFloat(document.getElementById('command-confidence').value);
      const parametersText = document.getElementById('command-parameters').value.trim();

      let parameters = {};
      if (parametersText) {
        parameters = JSON.parse(parametersText);
      }

      if (!phrase || !action) {
        this.showNotification('Please fill in all required fields', 'warning');
        return;
      }

      await window.electronAPI.addVoiceCommand(phrase, action, {
        confidence,
        parameters
      });

      this.hideCommandForm();
      this.loadCommands();
      this.showNotification('Voice command added successfully', 'success');

    } catch (error) {
      this.logger.error('Failed to save voice command', error);
      this.showNotification('Failed to save voice command', 'error');
    }
  }

  /**
   * Load commands list
   */
  async loadCommands() {
    try {
      const commands = await window.electronAPI.getVoiceCommands();
      this.displayCommands(commands);
    } catch (error) {
      this.logger.error('Failed to load commands', error);
    }
  }

  /**
   * Display commands in the list
   */
  displayCommands(commands) {
    const container = document.getElementById('commands-container');
    if (!container) return;

    container.innerHTML = '';

    if (!commands || commands.length === 0) {
      container.innerHTML = '<div class="no-commands">No voice commands configured</div>';
      return;
    }

    commands.forEach(command => {
      const commandElement = document.createElement('div');
      commandElement.className = 'command-item';
      commandElement.innerHTML = `
        <div class="command-info">
          <div class="command-phrase">"${command.phrase}"</div>
          <div class="command-action">${command.action}</div>
          <div class="command-confidence">Confidence: ${(command.confidence * 100).toFixed(0)}%</div>
        </div>
        <div class="command-actions">
          <button class="btn btn-small btn-secondary test-command" data-phrase="${command.phrase}">Test</button>
          <button class="btn btn-small btn-warning edit-command" data-phrase="${command.phrase}">Edit</button>
          <button class="btn btn-small btn-danger delete-command" data-phrase="${command.phrase}">Delete</button>
        </div>
      `;

      container.appendChild(commandElement);
    });

    // Add event listeners for command actions
    container.querySelectorAll('.test-command').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const phrase = e.target.dataset.phrase;
        this.testVoiceCommand(phrase);
      });
    });

    container.querySelectorAll('.delete-command').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const phrase = e.target.dataset.phrase;
        if (confirm(`Delete command "${phrase}"?`)) {
          try {
            await window.electronAPI.removeVoiceCommand(phrase);
            this.loadCommands();
            this.showNotification('Command deleted successfully', 'success');
          } catch (error) {
            this.showNotification('Failed to delete command', 'error');
          }
        }
      });
    });
  }

  /**
   * Filter commands based on search and category
   */
  filterCommands() {
    const searchTerm = document.getElementById('command-search').value.toLowerCase();
    const categoryFilter = document.getElementById('command-filter').value;

    const commandItems = document.querySelectorAll('.command-item');
    commandItems.forEach(item => {
      const phrase = item.querySelector('.command-phrase').textContent.toLowerCase();
      const action = item.querySelector('.command-action').textContent.toLowerCase();
      
      const matchesSearch = phrase.includes(searchTerm) || action.includes(searchTerm);
      const matchesCategory = !categoryFilter || action.includes(categoryFilter);

      item.style.display = (matchesSearch && matchesCategory) ? 'block' : 'none';
    });
  }

  /**
   * Start training mode
   */
  startTraining(mode) {
    const trainingInterface = document.getElementById('training-interface');
    const titleElement = document.getElementById('training-title');
    const instructionsElement = document.getElementById('training-instructions');

    trainingInterface.style.display = 'block';

    switch (mode) {
      case 'command':
        titleElement.textContent = 'Command Training';
        instructionsElement.textContent = 'Repeat each command phrase multiple times to improve recognition accuracy.';
        break;
      case 'vocabulary':
        titleElement.textContent = 'Vocabulary Training';
        instructionsElement.textContent = 'Add custom words and phrases to expand the recognition vocabulary.';
        break;
      case 'accent':
        titleElement.textContent = 'Accent Training';
        instructionsElement.textContent = 'Read the displayed phrases to train the system for your accent.';
        break;
    }

    // Start training session
    this.currentTrainingMode = mode;
    this.initializeTrainingSession();
  }

  /**
   * Initialize training session
   */
  async initializeTrainingSession() {
    try {
      const trainingData = await window.electronAPI.startVoiceTraining(this.currentTrainingMode);
      this.displayTrainingPhrase(trainingData.currentPhrase);
      this.updateTrainingProgress(trainingData.progress);
    } catch (error) {
      this.showNotification('Failed to start training session', 'error');
    }
  }

  /**
   * Display training phrase
   */
  displayTrainingPhrase(phrase) {
    const phraseElement = document.getElementById('training-phrase');
    if (phraseElement) {
      phraseElement.textContent = phrase;
    }
  }

  /**
   * Update training progress
   */
  updateTrainingProgress(progress) {
    const progressFill = document.getElementById('training-progress-fill');
    const progressText = document.getElementById('training-progress-text');

    if (progressFill) {
      progressFill.style.width = `${progress.percentage}%`;
    }

    if (progressText) {
      progressText.textContent = `${progress.completed} / ${progress.total} completed`;
    }
  }

  /**
   * Show profile editor
   */
  showProfileEditor() {
    const editor = document.getElementById('profile-editor');
    if (editor) {
      editor.style.display = 'block';
      document.getElementById('profile-name').focus();
    }
  }

  /**
   * Save voice profile
   */
  async saveVoiceProfile() {
    try {
      const name = document.getElementById('profile-name').value.trim();
      const language = document.getElementById('profile-language').value;
      const description = document.getElementById('profile-description').value.trim();

      const settings = {
        continuous: document.getElementById('profile-continuous').checked,
        interimResults: document.getElementById('profile-interim').checked,
        voiceFeedback: document.getElementById('profile-feedback').checked
      };

      if (!name) {
        this.showNotification('Please enter a profile name', 'warning');
        return;
      }

      await window.electronAPI.createVoiceProfile(name, {
        language,
        description,
        settings
      });

      document.getElementById('profile-editor').style.display = 'none';
      this.loadProfiles();
      this.showNotification('Voice profile created successfully', 'success');

    } catch (error) {
      this.logger.error('Failed to save voice profile', error);
      this.showNotification('Failed to save voice profile', 'error');
    }
  }

  /**
   * Load profiles list
   */
  async loadProfiles() {
    try {
      const profiles = await window.electronAPI.getVoiceProfiles();
      this.displayProfiles(profiles);
    } catch (error) {
      this.logger.error('Failed to load profiles', error);
    }
  }

  /**
   * Display profiles in the list
   */
  displayProfiles(profiles) {
    const container = document.getElementById('profiles-container');
    if (!container) return;

    container.innerHTML = '';

    profiles.forEach(profile => {
      const profileElement = document.createElement('div');
      profileElement.className = 'profile-item';
      profileElement.innerHTML = `
        <div class="profile-info">
          <div class="profile-name">${profile.name}</div>
          <div class="profile-language">${profile.language}</div>
          <div class="profile-commands">${profile.commandCount} commands</div>
        </div>
        <div class="profile-actions">
          <button class="btn btn-small btn-primary activate-profile" data-name="${profile.name}">
            ${profile.active ? 'Active' : 'Activate'}
          </button>
          <button class="btn btn-small btn-secondary export-profile" data-name="${profile.name}">Export</button>
          <button class="btn btn-small btn-danger delete-profile" data-name="${profile.name}">Delete</button>
        </div>
      `;

      container.appendChild(profileElement);
    });

    // Add event listeners
    container.querySelectorAll('.activate-profile').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const profileName = e.target.dataset.name;
        try {
          await window.electronAPI.switchVoiceProfile(profileName);
          this.loadProfiles();
          this.showNotification(`Switched to profile "${profileName}"`, 'success');
        } catch (error) {
          this.showNotification('Failed to switch profile', 'error');
        }
      });
    });
  }

  /**
   * Load statistics
   */
  async loadStatistics() {
    try {
      this.recognitionStats = await window.electronAPI.getVoiceRecognitionStatistics();
      this.displayStatistics();
    } catch (error) {
      this.logger.error('Failed to load statistics', error);
    }
  }

  /**
   * Display statistics
   */
  displayStatistics() {
    // Update stat cards
    document.getElementById('total-commands-stat').textContent = this.recognitionStats.totalCommands || 0;
    document.getElementById('success-rate-stat').textContent = `${this.recognitionStats.successRate || 0}%`;
    document.getElementById('avg-confidence-stat').textContent = `${this.recognitionStats.averageConfidence || 0}%`;
    
    const listeningMinutes = Math.round((this.recognitionStats.totalListeningTime || 0) / 60000);
    document.getElementById('listening-time-stat').textContent = `${listeningMinutes}m`;
  }

  /**
   * Reset statistics
   */
  async resetStatistics() {
    try {
      await window.electronAPI.resetVoiceRecognitionStatistics();
      this.loadStatistics();
      this.showNotification('Statistics reset successfully', 'success');
    } catch (error) {
      this.showNotification('Failed to reset statistics', 'error');
    }
  }

  /**
   * Save configuration
   */
  async saveConfiguration() {
    try {
      await window.electronAPI.saveVoiceRecognitionConfiguration();
      this.showNotification('Configuration saved successfully', 'success');
    } catch (error) {
      this.showNotification('Failed to save configuration', 'error');
    }
  }

  /**
   * Start periodic updates
   */
  startPeriodicUpdates() {
    // Update audio level every 100ms when listening
    this.audioLevelInterval = setInterval(() => {
      if (this.isListening) {
        // Audio level updates would happen here
      }
    }, 100);

    // Update statistics every 5 seconds
    this.statisticsInterval = setInterval(() => {
      if (this.currentTab === 'statistics') {
        this.loadStatistics();
      }
    }, 5000);
  }

  /**
   * Show notification
   */
  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    // Add to page
    document.body.appendChild(notification);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    // Clear intervals
    if (this.audioLevelInterval) {
      clearInterval(this.audioLevelInterval);
      this.audioLevelInterval = null;
    }

    if (this.statisticsInterval) {
      clearInterval(this.statisticsInterval);
      this.statisticsInterval = null;
    }

    // Stop audio visualization
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    // Clear references
    this.audioCanvas = null;
    this.audioCtx = null;

    // Clear event handlers
    this.eventHandlers.clear();

    this.logger.info('Voice Recognition UI cleanup complete');
  }
}

// Export for use in renderer
window.VoiceRecognitionUI = VoiceRecognitionUI;