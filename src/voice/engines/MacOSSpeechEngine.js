/**
 * macOS Speech Recognition Integration
 * 
 * Provides macOS-specific speech recognition using NSSpeechRecognizer
 * and macOS Speech framework through native Objective-C bridge.
 */

const EventEmitter = require('events');
const { spawn } = require('child_process');
const path = require('path');

class MacOSSpeechEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      language: 'en-US',
      confidenceThreshold: 0.7,
      continuous: true,
      enableDictation: true,
      systemIntegration: true,
      offlineRecognition: true,
      ...config
    };

    this.isInitialized = false;
    this.isRecognizing = false;
    this.speechProcess = null;

    // macOS Speech Recognition features
    this.features = {
      dictationCommands: true,
      systemIntegration: true,
      offlineRecognition: true,
      continuousRecognition: true,
      confidenceScoring: true,
      languageDetection: true
    };

    this.logger = config.logger || console;
  }

  /**
   * Initialize macOS Speech Recognition
   */
  async initialize() {
    try {
      if (process.platform !== 'darwin') {
        throw new Error('macOS Speech Engine only available on macOS platform');
      }

      this.logger.info('Initializing macOS Speech Recognition...');

      // Check if Speech Recognition is available and enabled
      await this.checkSpeechRecognitionAvailability();

      // Compile Objective-C bridge if needed
      await this.ensureObjectiveCBridge();

      this.isInitialized = true;
      this.emit('initialized');
      
      this.logger.info('macOS Speech Recognition initialized successfully');
      return true;

    } catch (error) {
      this.logger.error('Failed to initialize macOS Speech Recognition:', error);
      throw error;
    }
  }

  /**
   * Check if macOS Speech Recognition is available
   */
  async checkSpeechRecognitionAvailability() {
    return new Promise((resolve, reject) => {
      const checkProcess = spawn('osascript', [
        '-e',
        'tell application "System Events" to return (exists process "SpeechRecognitionServer")'
      ]);

      let output = '';
      let error = '';

      checkProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      checkProcess.stderr.on('data', (data) => {
        error += data.toString();
      });

      checkProcess.on('close', (code) => {
        if (code === 0) {
          this.logger.info('macOS Speech Recognition system available');
          resolve(true);
        } else {
          // Try alternative check using system_profiler
          this.checkSpeechFramework().then(resolve).catch(reject);
        }
      });
    });
  }

  /**
   * Alternative check using system_profiler
   */
  async checkSpeechFramework() {
    return new Promise((resolve, reject) => {
      const checkProcess = spawn('system_profiler', ['SPAudioDataType']);
      
      let output = '';

      checkProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      checkProcess.on('close', (code) => {
        if (output.includes('Built-in Microphone') || output.includes('microphone')) {
          this.logger.info('Audio input available for speech recognition');
          resolve(true);
        } else {
          reject(new Error('No microphone available for speech recognition'));
        }
      });
    });
  }

  /**
   * Ensure Objective-C bridge is available
   */
  async ensureObjectiveCBridge() {
    const bridgePath = path.join(__dirname, 'macos-speech-bridge');
    const sourcePath = path.join(__dirname, 'macos-speech-bridge.m');

    // Check if bridge exists
    const fs = require('fs').promises;
    try {
      await fs.access(bridgePath);
      this.logger.info('Objective-C bridge already exists');
      return;
    } catch {
      // Bridge doesn't exist, create it
    }

    // Create Objective-C source
    const objcSource = this.generateObjectiveCSource();
    await fs.writeFile(sourcePath, objcSource, 'utf8');

    // Compile Objective-C bridge
    await this.compileObjectiveCBridge(sourcePath, bridgePath);
    
    this.logger.info('Objective-C bridge compiled successfully');
  }

  /**
   * Generate Objective-C source for speech recognition
   */
  generateObjectiveCSource() {
    return `
#import <Foundation/Foundation.h>
#import <Speech/Speech.h>
#import <AVFoundation/AVFoundation.h>

@interface SpeechRecognitionManager : NSObject <SFSpeechRecognizerDelegate>

@property (nonatomic, strong) SFSpeechRecognizer *speechRecognizer;
@property (nonatomic, strong) SFSpeechAudioBufferRecognitionRequest *recognitionRequest;
@property (nonatomic, strong) SFSpeechRecognitionTask *recognitionTask;
@property (nonatomic, strong) AVAudioEngine *audioEngine;
@property (nonatomic, strong) AVAudioInputNode *inputNode;
@property (nonatomic) BOOL isRecording;

- (void)initializeSpeechRecognition:(NSString *)languageCode;
- (void)startRecognition;
- (void)stopRecognition;
- (void)outputJSON:(NSDictionary *)data;

@end

@implementation SpeechRecognitionManager

- (void)initializeSpeechRecognition:(NSString *)languageCode {
    NSLocale *locale = [[NSLocale alloc] initWithLocaleIdentifier:languageCode];
    self.speechRecognizer = [[SFSpeechRecognizer alloc] initWithLocale:locale];
    self.speechRecognizer.delegate = self;
    
    self.audioEngine = [[AVAudioEngine alloc] init];
    self.inputNode = [self.audioEngine inputNode];
    
    // Request authorization
    [SFSpeechRecognizer requestAuthorization:^(SFSpeechRecognizerAuthorizationStatus status) {
        dispatch_async(dispatch_get_main_queue(), ^{
            NSDictionary *authResult = @{
                @"type": @"authorization",
                @"status": @(status),
                @"authorized": @(status == SFSpeechRecognizerAuthorizationStatusAuthorized)
            };
            [self outputJSON:authResult];
        });
    }];
}

- (void)startRecognition {
    if (self.recognitionTask) {
        [self.recognitionTask cancel];
        self.recognitionTask = nil;
    }
    
    AVAudioSession *audioSession = [AVAudioSession sharedInstance];
    NSError *error;
    
    [audioSession setCategory:AVAudioSessionCategoryRecord
                  withOptions:AVAudioSessionCategoryOptionMeasurement
                        error:&error];
    if (error) {
        [self outputJSON:@{@"type": @"error", @"message": [error localizedDescription]}];
        return;
    }
    
    [audioSession setActive:YES withOptions:AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation error:&error];
    if (error) {
        [self outputJSON:@{@"type": @"error", @"message": [error localizedDescription]}];
        return;
    }
    
    self.recognitionRequest = [[SFSpeechAudioBufferRecognitionRequest alloc] init];
    self.recognitionRequest.shouldReportPartialResults = YES;
    
    self.recognitionTask = [self.speechRecognizer recognitionTaskWithRequest:self.recognitionRequest
                                                               resultHandler:^(SFSpeechRecognitionResult *result, NSError *error) {
        if (error) {
            [self outputJSON:@{@"type": @"error", @"message": [error localizedDescription]}];
            return;
        }
        
        if (result) {
            NSMutableArray *alternativesArray = [[NSMutableArray alloc] init];
            for (SFTranscription *transcription in result.transcriptions) {
                [alternativesArray addObject:@{
                    @"text": transcription.formattedString,
                    @"confidence": @(transcription.averageConfidence)
                }];
            }
            
            NSDictionary *resultData = @{
                @"type": @"result",
                @"text": result.bestTranscription.formattedString,
                @"confidence": @(result.bestTranscription.averageConfidence),
                @"isFinal": @(result.isFinal),
                @"alternatives": alternativesArray
            };
            [self outputJSON:resultData];
        }
    }];
    
    AVAudioFormat *recordingFormat = [self.inputNode outputFormatForBus:0];
    [self.inputNode installTapOnBus:0 bufferSize:1024 format:recordingFormat block:^(AVAudioPCMBuffer *buffer, AVAudioTime *when) {
        [self.recognitionRequest appendAudioPCMBuffer:buffer];
    }];
    
    [self.audioEngine prepare];
    [self.audioEngine startAndReturnError:&error];
    if (error) {
        [self outputJSON:@{@"type": @"error", @"message": [error localizedDescription]}];
        return;
    }
    
    self.isRecording = YES;
    [self outputJSON:@{@"type": @"started"}];
}

- (void)stopRecognition {
    if (self.audioEngine.isRunning) {
        [self.audioEngine stop];
        [self.inputNode removeTapOnBus:0];
    }
    
    if (self.recognitionRequest) {
        [self.recognitionRequest endAudio];
        self.recognitionRequest = nil;
    }
    
    if (self.recognitionTask) {
        [self.recognitionTask cancel];
        self.recognitionTask = nil;
    }
    
    self.isRecording = NO;
    [self outputJSON:@{@"type": @"stopped"}];
}

- (void)outputJSON:(NSDictionary *)data {
    NSError *error;
    NSData *jsonData = [NSJSONSerialization dataWithJSONObject:data options:0 error:&error];
    if (!error) {
        NSString *jsonString = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
        printf("%s\\n---EVENT---\\n", [jsonString UTF8String]);
        fflush(stdout);
    }
}

// SFSpeechRecognizerDelegate methods
- (void)speechRecognizer:(SFSpeechRecognizer *)speechRecognizer availabilityDidChange:(BOOL)available {
    NSDictionary *availabilityData = @{
        @"type": @"availabilityChanged",
        @"available": @(available)
    };
    [self outputJSON:availabilityData];
}

@end

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        SpeechRecognitionManager *manager = [[SpeechRecognitionManager alloc] init];
        
        // Initialize with language code from command line or default
        NSString *languageCode = @"en-US";
        if (argc > 1) {
            languageCode = [NSString stringWithUTF8String:argv[1]];
        }
        
        [manager initializeSpeechRecognition:languageCode];
        
        // Command processing loop
        NSFileHandle *stdin = [NSFileHandle fileHandleWithStandardInput];
        
        while (YES) {
            NSData *inputData = [stdin availableData];
            if (inputData.length == 0) break;
            
            NSString *input = [[NSString alloc] initWithData:inputData encoding:NSUTF8StringEncoding];
            input = [input stringByTrimmingCharactersInSet:[NSCharacterSet newlineCharacterSet]];
            
            if ([input isEqualToString:@"START"]) {
                [manager startRecognition];
            } else if ([input isEqualToString:@"STOP"]) {
                [manager stopRecognition];
            } else if ([input isEqualToString:@"EXIT"]) {
                [manager stopRecognition];
                break;
            }
        }
    }
    return 0;
}
`;
  }

  /**
   * Compile Objective-C bridge
   */
  async compileObjectiveCBridge(sourcePath, outputPath) {
    return new Promise((resolve, reject) => {
      const compileProcess = spawn('clang', [
        '-framework', 'Foundation',
        '-framework', 'Speech',
        '-framework', 'AVFoundation',
        '-o', outputPath,
        sourcePath
      ]);

      let error = '';

      compileProcess.stderr.on('data', (data) => {
        error += data.toString();
      });

      compileProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Failed to compile Objective-C bridge: ${error}`));
        }
      });
    });
  }

  /**
   * Start speech recognition
   */
  async startRecognition() {
    if (!this.isInitialized) {
      throw new Error('macOS Speech Engine not initialized');
    }

    if (this.isRecognizing) {
      this.logger.warn('Speech recognition already running');
      return;
    }

    try {
      const bridgePath = path.join(__dirname, 'macos-speech-bridge');
      
      this.speechProcess = spawn(bridgePath, [this.config.language], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.setupProcessEventHandlers();
      
      // Start recognition
      this.speechProcess.stdin.write('START\n');
      this.isRecognizing = true;
      
      this.emit('started');
      this.logger.info('macOS speech recognition started');

    } catch (error) {
      this.logger.error('Failed to start macOS speech recognition:', error);
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
      this.logger.info('macOS speech recognition stopped');

    } catch (error) {
      this.logger.error('Failed to stop macOS speech recognition:', error);
      throw error;
    }
  }

  /**
   * Set up process event handlers
   */
  setupProcessEventHandlers() {
    let buffer = '';

    this.speechProcess.stdout.on('data', (data) => {
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

    this.speechProcess.stderr.on('data', (data) => {
      this.logger.error('macOS speech recognition error:', data.toString());
    });

    this.speechProcess.on('close', (code) => {
      this.isRecognizing = false;
      this.speechProcess = null;
      
      if (code !== 0) {
        this.logger.error(`macOS speech process exited with code ${code}`);
        this.emit('error', new Error(`Speech process exited with code ${code}`));
      } else {
        this.emit('closed');
      }
    });

    this.speechProcess.on('error', (error) => {
      this.logger.error('macOS speech process error:', error);
      this.emit('error', error);
    });
  }

  /**
   * Handle speech recognition events
   */
  handleSpeechEvent(event) {
    switch (event.type) {
      case 'authorization':
        this.emit('authorizationChanged', {
          status: event.status,
          authorized: event.authorized
        });
        break;

      case 'result':
        this.emit('speechRecognized', {
          text: event.text,
          confidence: event.confidence,
          isFinal: event.isFinal,
          alternatives: event.alternatives || [],
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

      case 'availabilityChanged':
        this.emit('availabilityChanged', {
          available: event.available
        });
        break;

      default:
        this.logger.warn(`Unknown speech event type: ${event.type}`);
    }
  }

  /**
   * Check microphone permission
   */
  async checkMicrophonePermission() {
    return new Promise((resolve, reject) => {
      const checkProcess = spawn('osascript', [
        '-e',
        `tell application "System Events"
          tell security preferences
            tell privacy preferences
              return privacy category "microphone" is enabled for app "Terminal"
            end tell
          end tell
        end tell`
      ]);

      let output = '';

      checkProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      checkProcess.on('close', (code) => {
        const hasPermission = output.trim() === 'true';
        resolve(hasPermission);
      });
    });
  }

  /**
   * Request microphone permission
   */
  async requestMicrophonePermission() {
    return new Promise((resolve) => {
      const requestProcess = spawn('osascript', [
        '-e',
        `tell application "System Preferences"
          activate
          reveal anchor "Privacy_Microphone" of pane id "com.apple.preference.security"
        end tell`
      ]);

      requestProcess.on('close', () => {
        this.logger.info('System Preferences opened for microphone permission');
        resolve();
      });
    });
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.speechProcess) {
      try {
        this.speechProcess.stdin.write('EXIT\n');
        
        // Wait for process to exit gracefully
        await new Promise((resolve) => {
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

    this.isInitialized = false;
    this.isRecognizing = false;
    this.removeAllListeners();
  }

  /**
   * Get engine capabilities
   */
  getCapabilities() {
    return {
      platform: 'darwin',
      engine: 'Speech.framework',
      features: this.features,
      languages: ['en-US', 'en-GB', 'en-AU', 'en-CA', 'es-ES', 'es-MX', 'fr-FR', 'fr-CA', 
                  'de-DE', 'it-IT', 'pt-BR', 'pt-PT', 'ja-JP', 'ko-KR', 'zh-CN', 'zh-TW',
                  'ru-RU', 'ar-SA', 'hi-IN', 'th-TH', 'tr-TR'],
      maxAlternatives: 5,
      confidenceScoring: true,
      partialResults: true,
      continuousRecognition: true,
      systemIntegration: true
    };
  }
}

module.exports = MacOSSpeechEngine;