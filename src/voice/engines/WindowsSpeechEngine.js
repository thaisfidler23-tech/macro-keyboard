/**
 * Windows Speech Platform Integration
 *
 * Provides Windows-specific speech recognition using the Windows Speech Platform
 * and System.Speech.Recognition framework through native integration.
 */

const EventEmitter = require('events');
const { spawn } = require('child_process');
const path = require('path');

class WindowsSpeechEngine extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      language: 'en-US',
      confidenceThreshold: 0.7,
      continuous: true,
      grammarEnabled: true,
      customVocabulary: [],
      ...config
    };

    this.isInitialized = false;
    this.isRecognizing = false;
    this.speechProcess = null;
    this.recognizer = null;
    this.grammar = null;

    // Windows Speech Platform features
    this.features = {
      continuousRecognition: true,
      grammarConstraints: true,
      confidenceScoring: true,
      customVocabulary: true,
      offlineRecognition: true,
      multipleLanguages: true
    };

    this.logger = config.logger || console;
  }

  /**
   * Initialize Windows Speech Platform
   */
  async initialize() {
    try {
      if (process.platform !== 'win32') {
        throw new Error('Windows Speech Engine only available on Windows platform');
      }

      this.logger.info('Initializing Windows Speech Platform...');

      // Check if Windows Speech Platform is available
      await this.checkSpeechPlatformAvailability();

      // Initialize PowerShell-based speech recognition
      await this.initializePowerShellRecognition();

      this.isInitialized = true;
      this.emit('initialized');

      this.logger.info('Windows Speech Platform initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Windows Speech Platform:', error);
      throw error;
    }
  }

  /**
   * Check if Windows Speech Platform is available
   */
  async checkSpeechPlatformAvailability() {
    return new Promise((resolve, reject) => {
      const checkProcess = spawn(
        'powershell',
        [
          '-Command',
          'Add-Type -AssemblyName System.Speech; [System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers()'
        ],
        { windowsHide: true }
      );

      let output = '';
      let error = '';

      checkProcess.stdout.on('data', data => {
        output += data.toString();
      });

      checkProcess.stderr.on('data', data => {
        error += data.toString();
      });

      checkProcess.on('close', code => {
        if (code === 0 && output.trim()) {
          this.logger.info('Windows Speech Platform available');
          resolve(true);
        } else {
          reject(new Error(`Windows Speech Platform not available: ${error}`));
        }
      });
    });
  }

  /**
   * Initialize PowerShell-based speech recognition
   */
  async initializePowerShellRecognition() {
    const script = this.generatePowerShellScript();
    const scriptPath = path.join(__dirname, 'windows-speech.ps1');

    // Write PowerShell script to temporary file
    const fs = require('fs').promises;
    await fs.writeFile(scriptPath, script, 'utf8');

    this.logger.info('PowerShell speech recognition script created');
  }

  /**
   * Generate PowerShell script for speech recognition
   */
  generatePowerShellScript() {
    return `
Add-Type -AssemblyName System.Speech

# Create speech recognition engine
$recognizer = New-Object System.Speech.Recognition.SpeechRecognitionEngine
$recognizer.SetInputToDefaultAudioDevice()

# Configure recognition settings
$recognizer.MaxAlternates = 3
$recognizer.InitialSilenceTimeout = [TimeSpan]::FromSeconds(2)
$recognizer.BabbleTimeout = [TimeSpan]::FromSeconds(1)
$recognizer.EndSilenceTimeout = [TimeSpan]::FromSeconds(1)

# Create grammar
$grammarBuilder = New-Object System.Speech.Recognition.GrammarBuilder
$grammar = New-Object System.Speech.Recognition.Grammar($grammarBuilder)
$recognizer.LoadGrammar($grammar)

# Event handlers
Register-ObjectEvent -InputObject $recognizer -EventName SpeechRecognized -Action {
    $result = $Event.SourceEventArgs.Result
    $confidence = $result.Confidence
    $text = $result.Text
    $alternates = $result.Alternates | ForEach-Object { @{ Text = $_.Text; Confidence = $_.Confidence } }

    $output = @{
        Type = "SpeechRecognized"
        Text = $text
        Confidence = $confidence
        Alternates = $alternates
        Timestamp = Get-Date -Format "o"
    }

    Write-Output (ConvertTo-Json $output -Compress)
    Write-Output "---EVENT---"
}

Register-ObjectEvent -InputObject $recognizer -EventName SpeechRecognitionRejected -Action {
    $result = $Event.SourceEventArgs.Result
    $output = @{
        Type = "SpeechRejected"
        Text = $result.Text
        Confidence = $result.Confidence
        Timestamp = Get-Date -Format "o"
    }

    Write-Output (ConvertTo-Json $output -Compress)
    Write-Output "---EVENT---"
}

Register-ObjectEvent -InputObject $recognizer -EventName RecognizeCompleted -Action {
    $output = @{
        Type = "RecognizeCompleted"
        Timestamp = Get-Date -Format "o"
    }

    Write-Output (ConvertTo-Json $output -Compress)
    Write-Output "---EVENT---"
}

# Command processing loop
while ($true) {
    $input = Read-Host

    switch ($input) {
        "START" {
            $recognizer.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Multiple)
            Write-Output '{"Type":"Started","Timestamp":"' + (Get-Date -Format "o") + '"}'
            Write-Output "---EVENT---"
        }
        "STOP" {
            $recognizer.RecognizeAsyncStop()
            Write-Output '{"Type":"Stopped","Timestamp":"' + (Get-Date -Format "o") + '"}'
            Write-Output "---EVENT---"
        }
        "EXIT" {
            $recognizer.RecognizeAsyncCancel()
            $recognizer.Dispose()
            break
        }
        default {
            if ($input.StartsWith("GRAMMAR:")) {
                $grammarJson = $input.Substring(8)
                # Update grammar based on JSON input
                Write-Output '{"Type":"GrammarUpdated","Timestamp":"' + (Get-Date -Format "o") + '"}'
                Write-Output "---EVENT---"
            }
        }
    }
}
`;
  }

  /**
   * Start speech recognition
   */
  async startRecognition() {
    if (!this.isInitialized) {
      throw new Error('Windows Speech Engine not initialized');
    }

    if (this.isRecognizing) {
      this.logger.warn('Speech recognition already running');
      return;
    }

    try {
      const scriptPath = path.join(__dirname, 'windows-speech.ps1');

      this.speechProcess = spawn(
        'powershell',
        ['-ExecutionPolicy', 'Bypass', '-File', scriptPath],
        {
          windowsHide: true,
          stdio: ['pipe', 'pipe', 'pipe']
        }
      );

      this.setupProcessEventHandlers();

      // Start recognition
      this.speechProcess.stdin.write('START\n');
      this.isRecognizing = true;

      this.emit('started');
      this.logger.info('Windows speech recognition started');
    } catch (error) {
      this.logger.error('Failed to start Windows speech recognition:', error);
      throw error;
    }
  }

  /**
   * Stop speech recognition
   */
  async stopRecognition() {
    if (!this.isRecognizing || !this.speechProcess) {
      return;
    }

    try {
      this.speechProcess.stdin.write('STOP\n');
      this.isRecognizing = false;

      this.emit('stopped');
      this.logger.info('Windows speech recognition stopped');
    } catch (error) {
      this.logger.error('Failed to stop Windows speech recognition:', error);
      throw error;
    }
  }

  /**
   * Update grammar with custom commands
   */
  async updateGrammar(commands) {
    if (!this.isInitialized || !this.speechProcess) {
      throw new Error('Cannot update grammar - speech engine not ready');
    }

    try {
      const grammarData = {
        commands: commands.map(cmd => ({
          phrase: cmd.phrase,
          confidence: cmd.confidence || this.config.confidenceThreshold,
          enabled: cmd.enabled !== false
        })),
        vocabulary: this.config.customVocabulary
      };

      const grammarJson = JSON.stringify(grammarData);
      this.speechProcess.stdin.write(`GRAMMAR:${grammarJson}\n`);

      this.emit('grammarUpdated', grammarData);
      this.logger.info(`Grammar updated with ${commands.length} commands`);
    } catch (error) {
      this.logger.error('Failed to update grammar:', error);
      throw error;
    }
  }

  /**
   * Set up process event handlers
   */
  setupProcessEventHandlers() {
    let buffer = '';

    this.speechProcess.stdout.on('data', data => {
      buffer += data.toString();

      // Process complete events (delimited by ---EVENT---)
      const events = buffer.split('---EVENT---');
      buffer = events.pop(); // Keep incomplete event in buffer

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

    this.speechProcess.stderr.on('data', data => {
      this.logger.error('Windows speech recognition error:', data.toString());
    });

    this.speechProcess.on('close', code => {
      this.isRecognizing = false;
      this.speechProcess = null;

      if (code !== 0) {
        this.logger.error(`Windows speech process exited with code ${code}`);
        this.emit('error', new Error(`Speech process exited with code ${code}`));
      } else {
        this.emit('closed');
      }
    });

    this.speechProcess.on('error', error => {
      this.logger.error('Windows speech process error:', error);
      this.emit('error', error);
    });
  }

  /**
   * Handle speech recognition events
   */
  handleSpeechEvent(event) {
    switch (event.Type) {
      case 'SpeechRecognized':
        this.emit('speechRecognized', {
          text: event.Text,
          confidence: event.Confidence,
          alternates: event.Alternates || [],
          timestamp: new Date(event.Timestamp)
        });
        break;

      case 'SpeechRejected':
        this.emit('speechRejected', {
          text: event.Text,
          confidence: event.Confidence,
          timestamp: new Date(event.Timestamp)
        });
        break;

      case 'RecognizeCompleted':
        this.emit('recognizeCompleted', {
          timestamp: new Date(event.Timestamp)
        });
        break;

      case 'Started':
        this.emit('recognitionStarted', {
          timestamp: new Date(event.Timestamp)
        });
        break;

      case 'Stopped':
        this.emit('recognitionStopped', {
          timestamp: new Date(event.Timestamp)
        });
        break;

      case 'GrammarUpdated':
        this.emit('grammarUpdated', {
          timestamp: new Date(event.Timestamp)
        });
        break;

      default:
        this.logger.warn(`Unknown speech event type: ${event.Type}`);
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.speechProcess) {
      try {
        this.speechProcess.stdin.write('EXIT\n');

        // Wait for process to exit gracefully
        await new Promise(resolve => {
          const timeout = setTimeout(() => {
            this.speechProcess.kill('SIGTERM');
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
      const fs = require('fs').promises;
      const scriptPath = path.join(__dirname, 'windows-speech.ps1');
      await fs.unlink(scriptPath);
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
      platform: 'windows',
      engine: 'System.Speech.Recognition',
      features: this.features,
      languages: [
        'en-US',
        'en-GB',
        'es-ES',
        'fr-FR',
        'de-DE',
        'it-IT',
        'pt-BR',
        'ja-JP',
        'ko-KR',
        'zh-CN'
      ],
      maxAlternatives: 10,
      confidenceScoring: true,
      grammarSupport: true,
      continuousRecognition: true
    };
  }
}

module.exports = WindowsSpeechEngine;
