/**
 * Linux Speech Recognition Integration
 * 
 * Provides Linux-specific speech recognition using PocketSphinx or Vosk
 * engines for offline speech recognition capability.
 */

const EventEmitter = require('events');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

class LinuxSpeechEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      language: 'en-US',
      confidenceThreshold: 0.6,
      continuous: true,
      engine: 'vosk', // 'vosk' or 'pocketsphinx'
      modelPath: null,
      sampleRate: 16000,
      ...config
    };

    this.isInitialized = false;
    this.isRecognizing = false;
    this.speechProcess = null;
    this.availableEngines = [];

    // Linux Speech Recognition features
    this.features = {
      offlineRecognition: true,
      customModels: true,
      lightweight: true,
      continuousRecognition: true,
      partialResults: true,
      customVocabulary: true
    };

    this.logger = config.logger || console;
  }

  /**
   * Initialize Linux Speech Recognition
   */
  async initialize() {
    try {
      this.logger.info('Initializing Linux Speech Recognition...');

      // Detect available speech engines
      await this.detectAvailableEngines();

      // Select and initialize the best available engine
      await this.selectEngine();

      // Verify model availability
      await this.verifyModels();

      this.isInitialized = true;
      this.emit('initialized');
      
      this.logger.info(`Linux Speech Recognition initialized with ${this.config.engine}`);
      return true;

    } catch (error) {
      this.logger.error('Failed to initialize Linux Speech Recognition:', error);
      throw error;
    }
  }

  /**
   * Detect available speech recognition engines
   */
  async detectAvailableEngines() {
    const engines = [];

    // Check for Vosk
    if (await this.checkCommand('python3', ['-c', 'import vosk; print("available")'])) {
      engines.push({
        name: 'vosk',
        available: true,
        quality: 'high',
        dependencies: ['python3', 'vosk']
      });
    }

    // Check for PocketSphinx
    if (await this.checkCommand('pocketsphinx_continuous', ['-h'])) {
      engines.push({
        name: 'pocketsphinx',
        available: true,
        quality: 'medium',
        dependencies: ['pocketsphinx']
      });
    }

    // Check for DeepSpeech
    if (await this.checkCommand('python3', ['-c', 'import deepspeech; print("available")'])) {
      engines.push({
        name: 'deepspeech',
        available: true,
        quality: 'high',
        dependencies: ['python3', 'deepspeech']
      });
    }

    this.availableEngines = engines;
    
    if (engines.length === 0) {
      throw new Error('No speech recognition engines available. Please install Vosk, PocketSphinx, or DeepSpeech.');
    }

    this.logger.info(`Available engines: ${engines.map(e => e.name).join(', ')}`);
  }

  /**
   * Check if a command is available
   */
  async checkCommand(command, args = []) {
    return new Promise((resolve) => {
      const process = spawn(command, args, { stdio: 'ignore' });
      
      process.on('close', (code) => {
        resolve(code === 0);
      });

      process.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Select the best available engine
   */
  async selectEngine() {
    // Prefer user-specified engine if available
    if (this.config.engine) {
      const preferredEngine = this.availableEngines.find(e => e.name === this.config.engine);
      if (preferredEngine) {
        return;
      }
    }

    // Select best quality engine
    const sortedEngines = this.availableEngines.sort((a, b) => {
      const qualityOrder = { high: 3, medium: 2, low: 1 };
      return qualityOrder[b.quality] - qualityOrder[a.quality];
    });

    this.config.engine = sortedEngines[0].name;
    this.logger.info(`Selected engine: ${this.config.engine}`);
  }

  /**
   * Verify required models are available
   */
  async verifyModels() {
    switch (this.config.engine) {
      case 'vosk':
        await this.verifyVoskModels();
        break;
      case 'pocketsphinx':
        await this.verifyPocketSphinxModels();
        break;
      case 'deepspeech':
        await this.verifyDeepSpeechModels();
        break;
    }
  }

  /**
   * Verify Vosk models
   */
  async verifyVoskModels() {
    const modelPaths = [
      this.config.modelPath,
      '/usr/share/vosk-model',
      '/usr/local/share/vosk-model',
      path.join(process.env.HOME || '/tmp', '.vosk-models'),
      './models/vosk'
    ].filter(Boolean);

    for (const modelPath of modelPaths) {
      try {
        await fs.access(modelPath);
        this.config.modelPath = modelPath;
        this.logger.info(`Found Vosk model at: ${modelPath}`);
        return;
      } catch {
        // Continue searching
      }
    }

    // Try to download a small model
    await this.downloadVoskModel();
  }

  /**
   * Download Vosk model if none found
   */
  async downloadVoskModel() {
    const modelDir = path.join(process.env.HOME || '/tmp', '.vosk-models');
    const modelName = 'vosk-model-small-en-us-0.15';
    const modelPath = path.join(modelDir, modelName);

    try {
      await fs.access(modelPath);
      this.config.modelPath = modelPath;
      return;
    } catch {
      // Model doesn't exist, download it
    }

    this.logger.info('Downloading Vosk model...');

    try {
      await fs.mkdir(modelDir, { recursive: true });

      const downloadUrl = `https://alphacephei.com/vosk/models/${modelName}.zip`;
      
      // Download and extract model (simplified version - in production, use proper HTTP client)
      const downloadProcess = spawn('wget', [
        downloadUrl,
        '-O',
        path.join(modelDir, `${modelName}.zip`)
      ]);

      await new Promise((resolve, reject) => {
        downloadProcess.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Download failed with code ${code}`));
        });
      });

      // Extract model
      const extractProcess = spawn('unzip', [
        path.join(modelDir, `${modelName}.zip`),
        '-d',
        modelDir
      ]);

      await new Promise((resolve, reject) => {
        extractProcess.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Extract failed with code ${code}`));
        });
      });

      this.config.modelPath = modelPath;
      this.logger.info('Vosk model downloaded successfully');

    } catch (error) {
      this.logger.warn('Failed to download Vosk model:', error);
      throw new Error('No Vosk model available and download failed');
    }
  }

  /**
   * Verify PocketSphinx models
   */
  async verifyPocketSphinxModels() {
    // PocketSphinx typically comes with default models
    const modelPaths = [
      '/usr/share/pocketsphinx/model',
      '/usr/local/share/pocketsphinx/model',
      '/opt/pocketsphinx/model'
    ];

    for (const modelPath of modelPaths) {
      try {
        await fs.access(path.join(modelPath, 'en-us'));
        this.config.modelPath = path.join(modelPath, 'en-us');
        this.logger.info(`Found PocketSphinx model at: ${this.config.modelPath}`);
        return;
      } catch {
        // Continue searching
      }
    }

    throw new Error('No PocketSphinx models found');
  }

  /**
   * Verify DeepSpeech models
   */
  async verifyDeepSpeechModels() {
    const modelPaths = [
      this.config.modelPath,
      './models/deepspeech',
      path.join(process.env.HOME || '/tmp', '.deepspeech-models')
    ].filter(Boolean);

    for (const modelPath of modelPaths) {
      try {
        await fs.access(path.join(modelPath, 'deepspeech-0.9.3-models.pbmm'));
        this.config.modelPath = modelPath;
        this.logger.info(`Found DeepSpeech model at: ${modelPath}`);
        return;
      } catch {
        // Continue searching
      }
    }

    throw new Error('No DeepSpeech models found. Please download models from https://github.com/mozilla/DeepSpeech/releases');
  }

  /**
   * Start speech recognition
   */
  async startRecognition() {
    if (!this.isInitialized) {
      throw new Error('Linux Speech Engine not initialized');
    }

    if (this.isRecognizing) {
      this.logger.warn('Speech recognition already running');
      return;
    }

    try {
      switch (this.config.engine) {
        case 'vosk':
          await this.startVoskRecognition();
          break;
        case 'pocketsphinx':
          await this.startPocketSphinxRecognition();
          break;
        case 'deepspeech':
          await this.startDeepSpeechRecognition();
          break;
      }

      this.isRecognizing = true;
      this.emit('started');
      this.logger.info(`${this.config.engine} speech recognition started`);

    } catch (error) {
      this.logger.error('Failed to start speech recognition:', error);
      throw error;
    }
  }

  /**
   * Start Vosk recognition
   */
  async startVoskRecognition() {
    const pythonScript = this.generateVoskScript();
    const scriptPath = path.join(__dirname, 'vosk-recognition.py');
    
    await fs.writeFile(scriptPath, pythonScript, 'utf8');

    this.speechProcess = spawn('python3', [scriptPath, this.config.modelPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.setupProcessEventHandlers();
  }

  /**
   * Generate Python script for Vosk recognition
   */
  generateVoskScript() {
    return `
import json
import os
import sys
import queue
import threading
import pyaudio
import vosk

def main():
    model_path = sys.argv[1] if len(sys.argv) > 1 else "model"
    
    if not os.path.exists(model_path):
        print(json.dumps({"type": "error", "message": f"Model not found: {model_path}"}))
        sys.exit(1)
    
    model = vosk.Model(model_path)
    rec = vosk.KaldiRecognizer(model, 16000)
    
    # Audio setup
    p = pyaudio.PyAudio()
    stream = p.open(format=pyaudio.paInt16,
                   channels=1,
                   rate=16000,
                   input=True,
                   frames_per_buffer=8192)
    
    audio_queue = queue.Queue()
    
    def audio_thread():
        while True:
            data = stream.read(4096)
            if len(data) == 0:
                break
            audio_queue.put(data)
    
    def command_thread():
        while True:
            try:
                command = input().strip()
                if command == "EXIT":
                    break
                elif command == "STOP":
                    # Stop recognition temporarily
                    continue
            except EOFError:
                break
    
    # Start threads
    audio_t = threading.Thread(target=audio_thread, daemon=True)
    command_t = threading.Thread(target=command_thread, daemon=True)
    
    audio_t.start()
    command_t.start()
    
    print(json.dumps({"type": "started"}))
    print("---EVENT---")
    sys.stdout.flush()
    
    try:
        while True:
            try:
                data = audio_queue.get(timeout=1.0)
                
                if rec.AcceptWaveform(data):
                    result = json.loads(rec.Result())
                    if result.get('text'):
                        output = {
                            "type": "result",
                            "text": result['text'],
                            "confidence": result.get('confidence', 0.8),
                            "isFinal": True
                        }
                        print(json.dumps(output))
                        print("---EVENT---")
                        sys.stdout.flush()
                else:
                    partial = json.loads(rec.PartialResult())
                    if partial.get('partial'):
                        output = {
                            "type": "partial",
                            "text": partial['partial'],
                            "confidence": 0.5,
                            "isFinal": False
                        }
                        print(json.dumps(output))
                        print("---EVENT---")
                        sys.stdout.flush()
                        
            except queue.Empty:
                continue
            except KeyboardInterrupt:
                break
                
    finally:
        stream.stop_stream()
        stream.close()
        p.terminate()
        
        print(json.dumps({"type": "stopped"}))
        print("---EVENT---")
        sys.stdout.flush()

if __name__ == "__main__":
    main()
`;
  }

  /**
   * Start PocketSphinx recognition
   */
  async startPocketSphinxRecognition() {
    const args = [
      '-hmm', path.join(this.config.modelPath, 'hmm'),
      '-lm', path.join(this.config.modelPath, 'lm'),
      '-dict', path.join(this.config.modelPath, 'dict'),
      '-samprate', this.config.sampleRate.toString(),
      '-inmic', 'yes',
      '-logfn', '/dev/null'
    ];

    this.speechProcess = spawn('pocketsphinx_continuous', args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.setupPocketSphinxEventHandlers();
  }

  /**
   * Setup PocketSphinx-specific event handlers
   */
  setupPocketSphinxEventHandlers() {
    let buffer = '';

    this.speechProcess.stdout.on('data', (data) => {
      buffer += data.toString();
      
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('INFO:')) {
          // PocketSphinx outputs recognized text directly
          const result = {
            type: 'result',
            text: trimmedLine,
            confidence: 0.7, // PocketSphinx doesn't provide confidence scores
            isFinal: true,
            timestamp: new Date()
          };
          
          this.emit('speechRecognized', result);
        }
      }
    });

    this.speechProcess.stderr.on('data', (data) => {
      const error = data.toString();
      if (!error.includes('INFO:') && !error.includes('WARNING:')) {
        this.logger.error('PocketSphinx error:', error);
      }
    });

    this.speechProcess.on('close', (code) => {
      this.isRecognizing = false;
      this.speechProcess = null;
      
      if (code !== 0) {
        this.logger.error(`PocketSphinx process exited with code ${code}`);
        this.emit('error', new Error(`Speech process exited with code ${code}`));
      } else {
        this.emit('closed');
      }
    });
  }

  /**
   * Start DeepSpeech recognition
   */
  async startDeepSpeechRecognition() {
    // DeepSpeech implementation would be similar to Vosk but using DeepSpeech Python API
    throw new Error('DeepSpeech integration not yet implemented');
  }

  /**
   * Stop speech recognition
   */
  async stopRecognition() {
    if (!this.isRecognizing || !this.speechProcess) {
      return;
    }

    try {
      if (this.config.engine === 'vosk') {
        this.speechProcess.stdin.write('STOP\n');
      } else {
        this.speechProcess.kill('SIGTERM');
      }
      
      this.isRecognizing = false;
      this.emit('stopped');
      this.logger.info('Linux speech recognition stopped');

    } catch (error) {
      this.logger.error('Failed to stop speech recognition:', error);
      throw error;
    }
  }

  /**
   * Set up process event handlers (for Vosk)
   */
  setupProcessEventHandlers() {
    let buffer = '';

    this.speechProcess.stdout.on('data', (data) => {
      buffer += data.toString();
      
      // Process complete events (delimited by ---EVENT---)
      const events = buffer.split('---EVENT---');
      buffer = events.pop() || ''; // Keep incomplete event in buffer
      
      for (const eventData of events) {
        if (eventData.trim()) {
          try {
            const event = JSON.parse(eventData.trim());
            this.handleSpeechEvent(event);
          } catch (error) {
            this.logger.error('Failed to parse speech event:', error);
          }
        }
      }
    });

    this.speechProcess.stderr.on('data', (data) => {
      this.logger.error('Speech recognition error:', data.toString());
    });

    this.speechProcess.on('close', (code) => {
      this.isRecognizing = false;
      this.speechProcess = null;
      
      if (code !== 0) {
        this.logger.error(`Speech process exited with code ${code}`);
        this.emit('error', new Error(`Speech process exited with code ${code}`));
      } else {
        this.emit('closed');
      }
    });

    this.speechProcess.on('error', (error) => {
      this.logger.error('Speech process error:', error);
      this.emit('error', error);
    });
  }

  /**
   * Handle speech recognition events
   */
  handleSpeechEvent(event) {
    switch (event.type) {
      case 'result':
      case 'partial':
        this.emit('speechRecognized', {
          text: event.text,
          confidence: event.confidence,
          isFinal: event.isFinal,
          timestamp: new Date()
        });
        break;

      case 'error':
        this.emit('error', new Error(event.message));
        break;

      case 'started':
        this.emit('recognitionStarted');
        break;

      case 'stopped':
        this.emit('recognitionStopped');
        break;

      default:
        this.logger.warn(`Unknown speech event type: ${event.type}`);
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.speechProcess) {
      try {
        if (this.config.engine === 'vosk') {
          this.speechProcess.stdin.write('EXIT\n');
        }
        
        // Wait for process to exit gracefully
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            this.speechProcess.kill('SIGKILL');
            resolve();
          }, 5000);

          this.speechProcess.on('close', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      } catch (error) {
        this.logger.error('Error during cleanup:', error);
      }

      this.speechProcess = null;
    }

    // Clean up temporary files
    try {
      const filesToClean = ['vosk-recognition.py'];
      for (const file of filesToClean) {
        const filePath = path.join(__dirname, file);
        await fs.unlink(filePath);
      }
    } catch (error) {
      // Ignore cleanup errors
    }

    this.isInitialized = false;
    this.isRecognizing = false;
    this.removeAllListeners();
  }

  /**
   * Get engine capabilities
   */
  getCapabilities() {
    return {
      platform: 'linux',
      engine: this.config.engine,
      features: this.features,
      languages: this.getSupportedLanguages(),
      maxAlternatives: this.config.engine === 'vosk' ? 1 : 3,
      confidenceScoring: this.config.engine === 'vosk',
      partialResults: this.config.engine === 'vosk',
      offlineRecognition: true
    };
  }

  /**
   * Get supported languages for current engine
   */
  getSupportedLanguages() {
    switch (this.config.engine) {
      case 'vosk':
        return ['en-US', 'en-GB', 'de-DE', 'es-ES', 'fr-FR', 'it-IT', 'pt-BR', 'ru-RU', 'zh-CN'];
      case 'pocketsphinx':
        return ['en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE'];
      case 'deepspeech':
        return ['en-US'];
      default:
        return ['en-US'];
    }
  }

  /**
   * Install missing dependencies (helper method)
   */
  async installDependencies() {
    const installCommands = {
      'vosk': 'pip3 install vosk pyaudio',
      'pocketsphinx': 'sudo apt-get install pocketsphinx pocketsphinx-en-us',
      'deepspeech': 'pip3 install deepspeech'
    };

    const command = installCommands[this.config.engine];
    if (command) {
      this.logger.info(`To install ${this.config.engine}, run: ${command}`);
    }
  }
}

module.exports = LinuxSpeechEngine;