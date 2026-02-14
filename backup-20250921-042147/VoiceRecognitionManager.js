/**
 * Voice Recognition Manager
 *
 * Provides comprehensive voice command recognition and processing for hands-free
 * macro keyboard operation. Supports speech-to-text processing, command parsing,
 * voice-triggered macro execution, and cross-platform voice recognition.
 *
 * Features:
 * - Cross-platform speech recognition using Web Speech API and native engines
 * - Voice command parsing with natural language processing
 * - Integration with existing macro system for voice-triggered actions
 * - Voice training and custom vocabulary support
 * - Real-time voice feedback and status indicators
 * - Noise filtering and audio processing
 * - Multi-language support with locale detection
 * - Continuous and discrete recognition modes
 */

const EventEmitter = require('events');
const path = require('path');
const fs = require('fs').promises;

class VoiceRecognitionManager extends EventEmitter {
  constructor(logger = console, options = {}) {
    super();

    this.logger = logger;
    this.options = {
      language: 'en-US',
      continuous: true,
      interimResults: true,
      maxAlternatives: 3,
      noiseThreshold: 0.3,
      silenceTimeout: 2000,
      commandTimeout: 5000,
      confidenceThreshold: 0.7,
      voiceFeedback: true,
      adaptiveMode: true,
      ...options
    };

    // Voice recognition state
    this.isInitialized = false;
    this.isListening = false;
    this.isPaused = false;
    this.recognition = null;
    this.audioContext = null;
    this.mediaStream = null;
    this.analyser = null;

    // Voice command system
    this.voiceCommands = new Map();
    this.commandHistory = [];
    this.voiceProfiles = new Map();
    this.currentProfile = 'default';
    this.customVocabulary = new Set();
    this.commandParsers = new Map();

    // Audio processing
    this.audioProcessor = null;
    this.noiseGate = null;
    this.gainNode = null;
    this.filterNode = null;

    // Recognition statistics
    this.recognitionStats = {
      totalCommands: 0,
      successfulCommands: 0,
      failedCommands: 0,
      averageConfidence: 0,
      recognitionStartTime: null,
      totalListeningTime: 0
    };

    // Cross-platform compatibility
    this.platformFeatures = this.detectPlatformFeatures();
    this.recognitionEngine = this.selectRecognitionEngine();

    // Voice training data
    this.trainingData = {
      userPhrases: new Map(),
      pronunciations: new Map(),
      contextPatterns: new Map()
    };

    this.logger.info('VoiceRecognitionManager initialized', {
      platform: process.platform,
      engine: this.recognitionEngine,
      features: this.platformFeatures
    });
  }

  /**
   * Initialize the voice recognition system
   */
  async initialize() {
    try {
      this.logger.info('Initializing voice recognition system...');

      // Check for required permissions and capabilities
      await this.checkPermissions();

      // Initialize audio context and processing pipeline
      await this.initializeAudioProcessing();

      // Initialize speech recognition engine
      await this.initializeSpeechRecognition();

      // Load voice profiles and commands
      await this.loadVoiceProfiles();
      await this.loadVoiceCommands();

      // Initialize command parsers
      this.initializeCommandParsers();

      // Set up event listeners
      this.setupEventListeners();

      this.isInitialized = true;
      this.emit('initialized', {
        engine: this.recognitionEngine,
        language: this.options.language,
        features: this.platformFeatures
      });

      this.logger.info('Voice recognition system initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize voice recognition system', error);
      throw error;
    }
  }

  /**
   * Detect platform-specific voice recognition features
   */
  detectPlatformFeatures() {
    const features = {
      webSpeechAPI: typeof window !== 'undefined' && 'webkitSpeechRecognition' in window,
      nativeSpeechAPI: false,
      audioProcessing: typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined',
      microphoneAccess: typeof navigator !== 'undefined' && 'mediaDevices' in navigator,
      speechSynthesis: typeof speechSynthesis !== 'undefined',
      backgroundListening: false
    };

    // Platform-specific feature detection
    switch (process.platform) {
    case 'win32':
      features.nativeSpeechAPI = true;
      features.backgroundListening = true;
      break;
    case 'darwin':
      features.nativeSpeechAPI = true;
      features.backgroundListening = true;
      break;
    case 'linux':
      features.nativeSpeechAPI = false; // Requires additional setup
      features.backgroundListening = false;
      break;
    }

    return features;
  }

  /**
   * Select the best available speech recognition engine
   */
  selectRecognitionEngine() {
    if (this.platformFeatures.webSpeechAPI) {
      return 'web-speech-api';
    } else if (this.platformFeatures.nativeSpeechAPI) {
      return 'native-api';
    }
    return 'fallback';
  }

  /**
   * Check for required permissions
   */
  async checkPermissions() {
    if (typeof navigator !== 'undefined' && navigator.permissions) {
      try {
        const micPermission = await navigator.permissions.query({ name: 'microphone' });
        if (micPermission.state === 'denied') {
          throw new Error('Microphone permission denied');
        }
      } catch (error) {
        this.logger.warn('Could not check microphone permissions', error);
      }
    }
  }

  /**
   * Initialize audio processing pipeline
   */
  async initializeAudioProcessing() {
    if (!this.platformFeatures.audioProcessing) {
      this.logger.warn('Audio processing not available');
      return;
    }

    try {
      // Create audio context
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContextClass();

      // Get microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 16000
        }
      });

      // Create audio processing nodes
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Gain control
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 1.0;

      // High-pass filter for noise reduction
      this.filterNode = this.audioContext.createBiquadFilter();
      this.filterNode.type = 'highpass';
      this.filterNode.frequency.value = 300;

      // Analyser for real-time audio analysis
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;

      // Connect audio processing chain
      source.connect(this.filterNode);
      this.filterNode.connect(this.gainNode);
      this.gainNode.connect(this.analyser);

      this.logger.info('Audio processing pipeline initialized');
    } catch (error) {
      this.logger.error('Failed to initialize audio processing', error);
      throw error;
    }
  }

  /**
   * Initialize speech recognition engine
   */
  async initializeSpeechRecognition() {
    switch (this.recognitionEngine) {
    case 'web-speech-api':
      await this.initializeWebSpeechAPI();
      break;
    case 'native-api':
      await this.initializeNativeAPI();
      break;
    default:
      throw new Error(`Unsupported recognition engine: ${this.recognitionEngine}`);
    }
  }

  /**
   * Initialize Web Speech API recognition
   */
  async initializeWebSpeechAPI() {
    if (typeof window === 'undefined' || !('webkitSpeechRecognition' in window)) {
      throw new Error('Web Speech API not available');
    }

    this.recognition = new webkitSpeechRecognition();

    // Configure recognition parameters
    this.recognition.continuous = this.options.continuous;
    this.recognition.interimResults = this.options.interimResults;
    this.recognition.maxAlternatives = this.options.maxAlternatives;
    this.recognition.lang = this.options.language;

    // Set up recognition event handlers
    this.recognition.onstart = () => {
      this.isListening = true;
      this.recognitionStats.recognitionStartTime = Date.now();
      this.emit('listening-started');
      this.logger.info('Voice recognition started');
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (this.recognitionStats.recognitionStartTime) {
        this.recognitionStats.totalListeningTime += Date.now() - this.recognitionStats.recognitionStartTime;
      }
      this.emit('listening-stopped');
      this.logger.info('Voice recognition stopped');
    };

    this.recognition.onresult = (event) => {
      this.handleRecognitionResult(event);
    };

    this.recognition.onerror = (event) => {
      this.handleRecognitionError(event);
    };

    this.recognition.onnomatch = () => {
      this.emit('no-match');
      this.logger.debug('No speech match detected');
    };

    this.recognition.onspeechstart = () => {
      this.emit('speech-start');
    };

    this.recognition.onspeechend = () => {
      this.emit('speech-end');
    };

    this.logger.info('Web Speech API recognition initialized');
  }

  /**
   * Initialize native API recognition (placeholder for platform-specific implementation)
   */
  async initializeNativeAPI() {
    // Platform-specific native API initialization would go here
    // For now, fall back to Web Speech API if available
    if (this.platformFeatures.webSpeechAPI) {
      await this.initializeWebSpeechAPI();
    } else {
      throw new Error('Native speech recognition not implemented');
    }
  }

  /**
   * Load voice profiles from configuration
   */
  async loadVoiceProfiles() {
    try {
      const configPath = path.join(__dirname, '..', 'config', 'voice-profiles.json');
      const profileData = await fs.readFile(configPath, 'utf8');
      const profiles = JSON.parse(profileData);

      for (const [name, profile] of Object.entries(profiles)) {
        this.voiceProfiles.set(name, {
          language: profile.language || this.options.language,
          commands: new Map(Object.entries(profile.commands || {})),
          vocabulary: new Set(profile.vocabulary || []),
          settings: profile.settings || {}
        });
      }

      this.logger.info(`Loaded ${this.voiceProfiles.size} voice profiles`);
    } catch (error) {
      this.logger.warn('Could not load voice profiles, using defaults', error);
      this.createDefaultProfile();
    }
  }

  /**
   * Create default voice profile
   */
  createDefaultProfile() {
    this.voiceProfiles.set('default', {
      language: this.options.language,
      commands: new Map([
        ['start macro', { action: 'start-macro-recording', confidence: 0.8 }],
        ['stop macro', { action: 'stop-macro-recording', confidence: 0.8 }],
        ['play macro', { action: 'play-macro', confidence: 0.8 }],
        ['pause macro', { action: 'pause-macro', confidence: 0.8 }],
        ['show macro keyboard', { action: 'show-main-window', confidence: 0.7 }],
        ['hide macro keyboard', { action: 'hide-main-window', confidence: 0.7 }]
      ]),
      vocabulary: new Set(['macro', 'keyboard', 'start', 'stop', 'play', 'pause', 'show', 'hide']),
      settings: {}
    });
  }

  /**
   * Load voice commands from configuration
   */
  async loadVoiceCommands() {
    const profile = this.voiceProfiles.get(this.currentProfile);
    if (profile) {
      this.voiceCommands = new Map(profile.commands);
      this.customVocabulary = new Set(profile.vocabulary);
      this.logger.info(`Loaded ${this.voiceCommands.size} voice commands for profile '${this.currentProfile}'`);
    }
  }

  /**
   * Initialize command parsers
   */
  initializeCommandParsers() {
    // Exact match parser
    this.commandParsers.set('exact', (text) => {
      const normalizedText = text.toLowerCase().trim();
      return this.voiceCommands.get(normalizedText);
    });

    // Fuzzy match parser
    this.commandParsers.set('fuzzy', (text) => {
      const normalizedText = text.toLowerCase().trim();
      let bestMatch = null;
      let bestScore = 0;

      for (const [command] of this.voiceCommands) {
        const similarity = this.calculateSimilarity(normalizedText, command);
        if (similarity > bestScore && similarity >= 0.7) {
          bestScore = similarity;
          bestMatch = this.voiceCommands.get(command);
        }
      }

      return bestMatch;
    });

    // Keyword parser
    this.commandParsers.set('keyword', (text) => {
      const words = text.toLowerCase().split(/\s+/);

      for (const [command, config] of this.voiceCommands) {
        const commandWords = command.toLowerCase().split(/\s+/);
        const matches = commandWords.filter(word => words.includes(word));

        if (matches.length >= commandWords.length * 0.7) {
          return config;
        }
      }

      return null;
    });
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Handle audio level monitoring
    if (this.analyser) {
      this.monitorAudioLevel();
    }

    // Handle recognition timeout
    this.recognitionTimeoutId = null;
  }

  /**
   * Monitor audio input level for noise gate and feedback
   */
  monitorAudioLevel() {
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateLevel = () => {
      if (!this.isListening) {
        return;
      }

      this.analyser.getByteFrequencyData(dataArray);

      // Calculate RMS level
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / bufferLength) / 255;

      // Check noise threshold
      const isAboveThreshold = rms > this.options.noiseThreshold;

      this.emit('audio-level', {
        level: rms,
        aboveThreshold: isAboveThreshold
      });

      // Continue monitoring
      if (this.isListening) {
        requestAnimationFrame(updateLevel);
      }
    };

    requestAnimationFrame(updateLevel);
  }

  /**
   * Handle speech recognition result
   */
  handleRecognitionResult(event) {
    const results = event.results;
    const lastResultIndex = results.length - 1;
    const result = results[lastResultIndex];

    if (result.isFinal) {
      const transcript = result[0].transcript.trim();
      const confidence = result[0].confidence;

      this.logger.debug('Recognition result', {
        transcript,
        confidence,
        alternatives: Array.from(result).map(alt => ({
          transcript: alt.transcript,
          confidence: alt.confidence
        }))
      });

      this.processVoiceCommand(transcript, confidence, result);
    } else {
      // Interim results
      const transcript = result[0].transcript.trim();
      this.emit('interim-result', {
        transcript,
        confidence: result[0].confidence
      });
    }
  }

  /**
   * Handle recognition errors
   */
  handleRecognitionError(event) {
    this.logger.error('Speech recognition error', {
      error: event.error,
      message: event.message
    });

    this.recognitionStats.failedCommands++;

    this.emit('recognition-error', {
      error: event.error,
      message: event.message
    });

    // Handle specific error cases
    switch (event.error) {
    case 'no-speech':
      this.emit('no-speech');
      break;
    case 'audio-capture':
      this.emit('audio-capture-error');
      break;
    case 'not-allowed':
      this.emit('permission-denied');
      break;
    case 'network':
      this.emit('network-error');
      break;
    }
  }

  /**
   * Process voice command and execute corresponding action
   */
  async processVoiceCommand(transcript, confidence, recognitionResult) {
    try {
      if (confidence < this.options.confidenceThreshold) {
        this.logger.debug('Voice command confidence too low', {
          transcript,
          confidence,
          threshold: this.options.confidenceThreshold
        });

        this.emit('low-confidence', {
          transcript,
          confidence
        });
        return;
      }

      // Try different parsing strategies
      let commandConfig = null;
      let parserUsed = null;

      for (const [parserName, parser] of this.commandParsers) {
        commandConfig = parser(transcript);
        if (commandConfig) {
          parserUsed = parserName;
          break;
        }
      }

      if (!commandConfig) {
        this.logger.debug('No matching command found', { transcript });
        this.emit('unrecognized-command', {
          transcript,
          confidence
        });
        this.recognitionStats.failedCommands++;
        return;
      }

      // Execute the command
      const commandResult = await this.executeVoiceCommand(commandConfig, {
        transcript,
        confidence,
        parserUsed,
        recognitionResult
      });

      // Update statistics
      this.recognitionStats.totalCommands++;
      if (commandResult.success) {
        this.recognitionStats.successfulCommands++;
      } else {
        this.recognitionStats.failedCommands++;
      }

      this.updateAverageConfidence(confidence);

      // Add to command history
      this.commandHistory.push({
        timestamp: new Date(),
        transcript,
        confidence,
        parserUsed,
        commandConfig,
        result: commandResult
      });

      // Limit history size
      if (this.commandHistory.length > 100) {
        this.commandHistory = this.commandHistory.slice(-100);
      }

      // Emit command executed event
      this.emit('command-executed', {
        transcript,
        confidence,
        commandConfig,
        result: commandResult
      });

      // Provide voice feedback if enabled
      if (this.options.voiceFeedback && commandResult.success) {
        this.provideVoiceFeedback(commandResult.message || 'Command executed');
      }
    } catch (error) {
      this.logger.error('Error processing voice command', error);
      this.recognitionStats.failedCommands++;

      this.emit('command-error', {
        transcript,
        confidence,
        error: error.message
      });
    }
  }

  /**
   * Execute a voice command
   */
  async executeVoiceCommand(commandConfig, context) {
    try {
      const { action } = commandConfig;

      this.logger.info('Executing voice command', {
        action,
        transcript: context.transcript,
        confidence: context.confidence
      });

      // Emit command execution event for other systems to handle
      const executionContext = {
        action,
        parameters: commandConfig.parameters || {},
        voiceContext: context,
        timestamp: new Date()
      };

      this.emit('execute-command', executionContext);

      // Return success result (actual execution handled by listeners)
      return {
        success: true,
        action,
        message: `Executed ${action}`,
        context: executionContext
      };
    } catch (error) {
      this.logger.error('Voice command execution failed', error);
      return {
        success: false,
        action: commandConfig.action,
        error: error.message
      };
    }
  }

  /**
   * Update average confidence statistic
   */
  updateAverageConfidence(newConfidence) {
    const total = this.recognitionStats.totalCommands;
    const current = this.recognitionStats.averageConfidence;
    this.recognitionStats.averageConfidence = (current * (total - 1) + newConfidence) / total;
  }

  /**
   * Calculate similarity between two strings using Levenshtein distance
   */
  calculateSimilarity(str1, str2) {
    const matrix = [];
    const len1 = str1.length;
    const len2 = str2.length;

    for (let i = 0; i <= len2; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= len1; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len2; i++) {
      for (let j = 1; j <= len1; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    const maxLen = Math.max(len1, len2);
    return maxLen > 0 ? (maxLen - matrix[len2][len1]) / maxLen : 1;
  }

  /**
   * Provide voice feedback using text-to-speech
   */
  provideVoiceFeedback(message) {
    if (!this.platformFeatures.speechSynthesis) {
      this.logger.debug('Speech synthesis not available');
      return;
    }

    try {
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 0.8;
      utterance.lang = this.options.language;

      speechSynthesis.speak(utterance);

      this.logger.debug('Voice feedback provided', { message });
    } catch (error) {
      this.logger.error('Failed to provide voice feedback', error);
    }
  }

  /**
   * Start voice recognition
   */
  async startListening() {
    if (!this.isInitialized) {
      throw new Error('Voice recognition not initialized');
    }

    if (this.isListening) {
      this.logger.warn('Already listening');
      return;
    }

    try {
      if (this.recognition) {
        this.recognition.start();
      }

      this.logger.info('Voice recognition started');
    } catch (error) {
      this.logger.error('Failed to start voice recognition', error);
      throw error;
    }
  }

  /**
   * Stop voice recognition
   */
  stopListening() {
    if (!this.isListening) {
      return;
    }

    try {
      if (this.recognition) {
        this.recognition.stop();
      }

      this.logger.info('Voice recognition stopped');
    } catch (error) {
      this.logger.error('Failed to stop voice recognition', error);
    }
  }

  /**
   * Pause voice recognition
   */
  pauseListening() {
    if (!this.isListening) {
      return;
    }

    this.isPaused = true;
    this.stopListening();
    this.logger.info('Voice recognition paused');
  }

  /**
   * Resume voice recognition
   */
  async resumeListening() {
    if (!this.isPaused) {
      return;
    }

    this.isPaused = false;
    await this.startListening();
    this.logger.info('Voice recognition resumed');
  }

  /**
   * Add or update a voice command
   */
  addVoiceCommand(phrase, action, options = {}) {
    const commandConfig = {
      action,
      confidence: options.confidence || 0.7,
      parameters: options.parameters || {},
      ...options
    };

    this.voiceCommands.set(phrase.toLowerCase(), commandConfig);

    // Add words to custom vocabulary
    const words = phrase.toLowerCase().split(/\s+/);
    words.forEach(word => this.customVocabulary.add(word));

    this.logger.info('Voice command added', {
      phrase,
      action,
      confidence: commandConfig.confidence
    });

    this.emit('command-added', {
      phrase,
      action,
      config: commandConfig
    });
  }

  /**
   * Remove a voice command
   */
  removeVoiceCommand(phrase) {
    const normalizedPhrase = phrase.toLowerCase();
    const existed = this.voiceCommands.delete(normalizedPhrase);

    if (existed) {
      this.logger.info('Voice command removed', { phrase });
      this.emit('command-removed', { phrase });
    }

    return existed;
  }

  /**
   * Switch voice profile
   */
  async switchProfile(profileName) {
    if (!this.voiceProfiles.has(profileName)) {
      throw new Error(`Voice profile '${profileName}' not found`);
    }

    this.currentProfile = profileName;
    await this.loadVoiceCommands();

    // Update recognition language if different
    const profile = this.voiceProfiles.get(profileName);
    if (profile.language !== this.options.language) {
      this.options.language = profile.language;
      if (this.recognition) {
        this.recognition.lang = profile.language;
      }
    }

    this.logger.info(`Switched to voice profile '${profileName}'`);
    this.emit('profile-switched', {
      profileName,
      commandCount: this.voiceCommands.size,
      language: profile.language
    });
  }

  /**
   * Get recognition statistics
   */
  getStatistics() {
    const successRate = this.recognitionStats.totalCommands > 0
      ? (this.recognitionStats.successfulCommands / this.recognitionStats.totalCommands) * 100
      : 0;

    return {
      ...this.recognitionStats,
      successRate: Math.round(successRate * 100) / 100,
      averageConfidence: Math.round(this.recognitionStats.averageConfidence * 100) / 100,
      isListening: this.isListening,
      currentProfile: this.currentProfile,
      totalCommands: this.voiceCommands.size,
      totalProfiles: this.voiceProfiles.size
    };
  }

  /**
   * Get voice recognition status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      listening: this.isListening,
      paused: this.isPaused,
      engine: this.recognitionEngine,
      language: this.options.language,
      profile: this.currentProfile,
      features: this.platformFeatures,
      commands: this.voiceCommands.size,
      profiles: this.voiceProfiles.size,
      statistics: this.getStatistics()
    };
  }

  /**
   * Export voice configuration
   */
  exportConfiguration() {
    const profiles = {};
    for (const [name, profile] of this.voiceProfiles) {
      profiles[name] = {
        language: profile.language,
        commands: Object.fromEntries(profile.commands),
        vocabulary: Array.from(profile.vocabulary),
        settings: profile.settings
      };
    }

    return {
      version: '1.0',
      currentProfile: this.currentProfile,
      options: this.options,
      profiles,
      statistics: this.recognitionStats,
      exportDate: new Date().toISOString()
    };
  }

  /**
   * Import voice configuration
   */
  async importConfiguration(config) {
    try {
      if (config.version !== '1.0') {
        throw new Error(`Unsupported configuration version: ${config.version}`);
      }

      // Import options
      if (config.options) {
        Object.assign(this.options, config.options);
      }

      // Import profiles
      if (config.profiles) {
        this.voiceProfiles.clear();
        for (const [name, profile] of Object.entries(config.profiles)) {
          this.voiceProfiles.set(name, {
            language: profile.language,
            commands: new Map(Object.entries(profile.commands || {})),
            vocabulary: new Set(profile.vocabulary || []),
            settings: profile.settings || {}
          });
        }
      }

      // Switch to imported current profile
      if (config.currentProfile && this.voiceProfiles.has(config.currentProfile)) {
        await this.switchProfile(config.currentProfile);
      }

      this.logger.info('Voice configuration imported successfully');
      this.emit('configuration-imported', {
        profiles: this.voiceProfiles.size,
        currentProfile: this.currentProfile
      });
    } catch (error) {
      this.logger.error('Failed to import voice configuration', error);
      throw error;
    }
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.logger.info('Cleaning up VoiceRecognitionManager...');

    // Stop recognition
    if (this.isListening) {
      this.stopListening();
    }

    // Clean up audio resources
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    // Clear recognition
    this.recognition = null;

    // Clear data structures
    this.voiceCommands.clear();
    this.voiceProfiles.clear();
    this.customVocabulary.clear();
    this.commandParsers.clear();
    this.commandHistory = [];

    // Clear timeouts
    if (this.recognitionTimeoutId) {
      clearTimeout(this.recognitionTimeoutId);
      this.recognitionTimeoutId = null;
    }

    // Reset state
    this.isInitialized = false;
    this.isListening = false;
    this.isPaused = false;

    this.logger.info('VoiceRecognitionManager cleanup complete');
  }
}

module.exports = VoiceRecognitionManager;
