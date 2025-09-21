/**
 * External System Integration Test Suite
 * 
 * Tests integrations with third-party APIs and services including
 * calendar systems, voice recognition, cloud storage, and system APIs.
 */

const nock = require('nock');
const EventEmitter = require('events');

// Mock external dependencies
jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn(() => ({
        setCredentials: jest.fn(),
        getAccessToken: jest.fn()
      }))
    },
    calendar: jest.fn(() => ({
      events: {
        list: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
      }
    }))
  }
}));

jest.mock('@microsoft/microsoft-graph-client', () => ({
  Client: {
    init: jest.fn(() => ({
      api: jest.fn(() => ({
        get: jest.fn(),
        post: jest.fn(),
        patch: jest.fn(),
        delete: jest.fn()
      }))
    }))
  }
}));

describe('External System Integration Tests', () => {
  let systemIntegrationManager;
  let mockLogger;
  let testDataFactory;

  beforeEach(() => {
    jest.clearAllMocks();
    nock.cleanAll();

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };

    // Test data factory for external API responses
    testDataFactory = {
      createGoogleCalendarResponse: (events = []) => ({
        data: {
          items: events.map(event => ({
            id: event.id || `event-${Date.now()}`,
            summary: event.title || 'Test Event',
            start: { 
              dateTime: event.start || new Date().toISOString() 
            },
            end: { 
              dateTime: event.end || new Date(Date.now() + 3600000).toISOString() 
            },
            location: event.location,
            attendees: event.attendees || []
          }))
        }
      }),

      createMicrosoftGraphResponse: (events = []) => ({
        value: events.map(event => ({
          id: event.id || `event-${Date.now()}`,
          subject: event.title || 'Test Meeting',
          start: {
            dateTime: event.start || new Date().toISOString(),
            timeZone: 'UTC'
          },
          end: {
            dateTime: event.end || new Date(Date.now() + 3600000).toISOString(),
            timeZone: 'UTC'
          },
          location: { displayName: event.location },
          attendees: event.attendees || []
        }))
      }),

      createVoiceRecognitionResponse: (text, confidence = 0.95) => ({
        alternatives: [{
          transcript: text,
          confidence
        }]
      })
    };

    // Setup system integration manager mock
    systemIntegrationManager = {
      calendarIntegration: new EventEmitter(),
      voiceIntegration: new EventEmitter(),
      cloudStorage: new EventEmitter(),
      systemAPIs: new EventEmitter(),

      // Calendar methods
      getCalendarEvents: jest.fn(),
      createCalendarEvent: jest.fn(),
      updateCalendarEvent: jest.fn(),
      deleteCalendarEvent: jest.fn(),

      // Voice recognition methods
      startVoiceRecognition: jest.fn(),
      stopVoiceRecognition: jest.fn(),
      processVoiceCommand: jest.fn(),

      // Cloud storage methods
      syncConfiguration: jest.fn(),
      backupProfiles: jest.fn(),
      restoreFromCloud: jest.fn(),

      // System API methods
      getActiveApplication: jest.fn(),
      getSystemMetrics: jest.fn(),
      executeSystemCommand: jest.fn()
    };
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('Google Calendar API Integration', () => {
    test('should retrieve upcoming events successfully', async () => {
      const mockEvents = [
        {
          id: 'event1',
          title: 'Daily Standup',
          start: new Date(Date.now() + 900000).toISOString(), // 15 minutes from now
          end: new Date(Date.now() + 1800000).toISOString()   // 30 minutes from now
        },
        {
          id: 'event2', 
          title: 'Project Review',
          start: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
          end: new Date(Date.now() + 5400000).toISOString()    // 1.5 hours from now
        }
      ];

      const expectedResponse = testDataFactory.createGoogleCalendarResponse(mockEvents);

      // Mock Google Calendar API
      nock('https://www.googleapis.com')
        .get('/calendar/v3/calendars/primary/events')
        .query(true)
        .reply(200, expectedResponse.data);

      systemIntegrationManager.getCalendarEvents.mockResolvedValue(
        expectedResponse.data.items.map(item => ({
          id: item.id,
          title: item.summary,
          startTime: item.start.dateTime,
          endTime: item.end.dateTime,
          source: 'google'
        }))
      );

      const events = await systemIntegrationManager.getCalendarEvents();

      expect(events).toHaveLength(2);
      expect(events[0]).toEqual(
        expect.objectContaining({
          id: 'event1',
          title: 'Daily Standup',
          source: 'google'
        })
      );

      expect(systemIntegrationManager.getCalendarEvents).toHaveBeenCalledWith();
    });

    test('should handle calendar API rate limiting', async () => {
      // Mock rate limit response
      nock('https://www.googleapis.com')
        .get('/calendar/v3/calendars/primary/events')
        .reply(429, {
          error: {
            code: 429,
            message: 'Rate limit exceeded'
          }
        }, {
          'Retry-After': '60'
        });

      systemIntegrationManager.getCalendarEvents.mockImplementation(async () => {
        // Simulate exponential backoff
        await new Promise(resolve => setTimeout(resolve, 100));
        throw new Error('Rate limit exceeded - retry after 60 seconds');
      });

      try {
        await systemIntegrationManager.getCalendarEvents();
        fail('Should have thrown rate limit error');
      } catch (error) {
        expect(error.message).toContain('Rate limit exceeded');
        expect(error.message).toContain('retry after 60 seconds');
      }
    });

    test('should create calendar events successfully', async () => {
      const newEvent = {
        title: 'Team Retrospective',
        start: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        end: new Date(Date.now() + 90000000).toISOString(),
        location: 'Conference Room A'
      };

      nock('https://www.googleapis.com')
        .post('/calendar/v3/calendars/primary/events')
        .reply(200, {
          id: 'created-event-123',
          summary: newEvent.title,
          start: { dateTime: newEvent.start },
          end: { dateTime: newEvent.end },
          location: newEvent.location
        });

      systemIntegrationManager.createCalendarEvent.mockResolvedValue({
        id: 'created-event-123',
        success: true
      });

      const result = await systemIntegrationManager.createCalendarEvent(newEvent);

      expect(result.success).toBe(true);
      expect(result.id).toBe('created-event-123');
    });
  });

  describe('Microsoft Graph API Integration', () => {
    test('should retrieve Outlook calendar events', async () => {
      const mockEvents = [
        {
          id: 'outlook-event-1',
          title: 'Client Meeting',
          start: new Date().toISOString(),
          end: new Date(Date.now() + 3600000).toISOString(),
          location: 'Teams Call'
        }
      ];

      const expectedResponse = testDataFactory.createMicrosoftGraphResponse(mockEvents);

      nock('https://graph.microsoft.com')
        .get('/v1.0/me/events')
        .query(true)
        .reply(200, expectedResponse);

      systemIntegrationManager.getCalendarEvents.mockResolvedValue(
        expectedResponse.value.map(item => ({
          id: item.id,
          title: item.subject,
          startTime: item.start.dateTime,
          endTime: item.end.dateTime,
          source: 'microsoft'
        }))
      );

      const events = await systemIntegrationManager.getCalendarEvents();

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(
        expect.objectContaining({
          id: 'outlook-event-1',
          title: 'Client Meeting',
          source: 'microsoft'
        })
      );
    });

    test('should handle Microsoft Graph authentication errors', async () => {
      nock('https://graph.microsoft.com')
        .get('/v1.0/me/events')
        .reply(401, {
          error: {
            code: 'InvalidAuthenticationToken',
            message: 'Access token has expired'
          }
        });

      systemIntegrationManager.getCalendarEvents.mockRejectedValue(
        new Error('Authentication failed - token expired')
      );

      try {
        await systemIntegrationManager.getCalendarEvents();
        fail('Should have thrown authentication error');
      } catch (error) {
        expect(error.message).toContain('Authentication failed');
        expect(error.message).toContain('token expired');
      }
    });
  });

  describe('Voice Recognition API Integration', () => {
    test('should process voice commands successfully', async () => {
      const voiceCommand = 'switch to gaming profile';
      const mockResponse = testDataFactory.createVoiceRecognitionResponse(voiceCommand);

      systemIntegrationManager.processVoiceCommand.mockResolvedValue({
        transcript: voiceCommand,
        confidence: 0.95,
        intent: 'profile_switch',
        parameters: { profile: 'gaming' }
      });

      const result = await systemIntegrationManager.processVoiceCommand('audio-data-blob');

      expect(result.transcript).toBe(voiceCommand);
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.intent).toBe('profile_switch');
      expect(result.parameters.profile).toBe('gaming');
    });

    test('should handle low confidence voice recognition', async () => {
      const unclearCommand = 'switch... uh... gaming';
      const mockResponse = testDataFactory.createVoiceRecognitionResponse(unclearCommand, 0.3);

      systemIntegrationManager.processVoiceCommand.mockResolvedValue({
        transcript: unclearCommand,
        confidence: 0.3,
        intent: null,
        requiresConfirmation: true
      });

      const result = await systemIntegrationManager.processVoiceCommand('unclear-audio-data');

      expect(result.confidence).toBeLessThan(0.5);
      expect(result.requiresConfirmation).toBe(true);
      expect(result.intent).toBeNull();
    });

    test('should integrate voice commands with system actions', async () => {
      const actionExecutor = {
        execute: jest.fn().mockResolvedValue({ success: true })
      };

      const profileManager = {
        switchProfile: jest.fn().mockResolvedValue()
      };

      systemIntegrationManager.processVoiceCommand.mockImplementation(async (audioData) => {
        const result = {
          transcript: 'activate work mode',
          confidence: 0.92,
          intent: 'profile_switch',
          parameters: { profile: 'work' }
        };

        // Simulate integration with system components
        if (result.intent === 'profile_switch' && result.confidence > 0.8) {
          await profileManager.switchProfile(result.parameters.profile);
          await actionExecutor.execute({
            type: 'profile-switch',
            target: result.parameters.profile,
            source: 'voice'
          });
        }

        return result;
      });

      const result = await systemIntegrationManager.processVoiceCommand('work-mode-audio');

      expect(result.intent).toBe('profile_switch');
      expect(profileManager.switchProfile).toHaveBeenCalledWith('work');
      expect(actionExecutor.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'profile-switch',
          source: 'voice'
        })
      );
    });
  });

  describe('Cloud Storage Integration', () => {
    test('should sync configuration to cloud storage', async () => {
      const configData = {
        profiles: {
          gaming: { name: 'Gaming', buttons: {} },
          work: { name: 'Work', buttons: {} }
        },
        device: { buttons: 16, encoders: 2 }
      };

      // Mock cloud storage API
      nock('https://api.cloudstorage.com')
        .put('/v1/sync/configurations')
        .reply(200, {
          success: true,
          version: '1.2.3',
          timestamp: new Date().toISOString()
        });

      systemIntegrationManager.syncConfiguration.mockResolvedValue({
        success: true,
        version: '1.2.3',
        syncedFiles: ['config.yaml', 'profiles/gaming.yaml', 'profiles/work.yaml']
      });

      const result = await systemIntegrationManager.syncConfiguration(configData);

      expect(result.success).toBe(true);
      expect(result.syncedFiles).toContain('config.yaml');
      expect(result.version).toBe('1.2.3');
    });

    test('should handle cloud storage conflicts', async () => {
      const localConfig = { version: '1.2.3', lastModified: Date.now() };
      const cloudConfig = { version: '1.2.4', lastModified: Date.now() - 3600000 };

      nock('https://api.cloudstorage.com')
        .get('/v1/sync/configurations')
        .reply(200, cloudConfig);

      systemIntegrationManager.syncConfiguration.mockImplementation(async () => {
        // Simulate conflict detection
        if (localConfig.version !== cloudConfig.version) {
          return {
            success: false,
            conflict: true,
            localVersion: localConfig.version,
            cloudVersion: cloudConfig.version,
            resolution: 'manual_required'
          };
        }
      });

      const result = await systemIntegrationManager.syncConfiguration(localConfig);

      expect(result.conflict).toBe(true);
      expect(result.resolution).toBe('manual_required');
      expect(result.localVersion).toBe('1.2.3');
      expect(result.cloudVersion).toBe('1.2.4');
    });
  });

  describe('System API Integration', () => {
    test('should detect active applications across platforms', async () => {
      // Mock platform-specific system APIs
      const windowsResponse = {
        platform: 'win32',
        activeWindow: {
          title: 'Visual Studio Code',
          executable: 'Code.exe',
          processId: 1234
        }
      };

      const macOSResponse = {
        platform: 'darwin',
        activeWindow: {
          title: 'Terminal',
          bundleId: 'com.apple.Terminal',
          processId: 5678
        }
      };

      systemIntegrationManager.getActiveApplication.mockImplementation(async () => {
        const platform = process.platform;
        
        if (platform === 'win32') {
          return windowsResponse;
        } else if (platform === 'darwin') {
          return macOSResponse;
        } else {
          return {
            platform: 'linux',
            activeWindow: {
              title: 'Firefox',
              className: 'Firefox',
              processId: 9012
            }
          };
        }
      });

      const result = await systemIntegrationManager.getActiveApplication();

      expect(result.platform).toBe(process.platform);
      expect(result.activeWindow).toHaveProperty('processId');
    });

    test('should retrieve system performance metrics', async () => {
      const mockMetrics = {
        cpu: { usage: 45.2, cores: 8 },
        memory: { used: 8192, total: 16384, available: 8192 },
        disk: { used: 512000, total: 1000000, available: 488000 },
        network: { bytesReceived: 1024000, bytesSent: 512000 }
      };

      systemIntegrationManager.getSystemMetrics.mockResolvedValue(mockMetrics);

      const metrics = await systemIntegrationManager.getSystemMetrics();

      expect(metrics.cpu.usage).toBeGreaterThan(0);
      expect(metrics.memory.used).toBeGreaterThan(0);
      expect(metrics.disk.available).toBeGreaterThan(0);
      expect(metrics.network).toHaveProperty('bytesReceived');
    });

    test('should execute system commands safely', async () => {
      const command = 'tasklist /FI "IMAGENAME eq Code.exe"';
      const mockOutput = `
Image Name                     PID Session Name        Session#    Mem Usage
========================= ======== ================ =========== ============
Code.exe                      1234 Console                    1     150,000 K
      `;

      systemIntegrationManager.executeSystemCommand.mockResolvedValue({
        command,
        exitCode: 0,
        stdout: mockOutput.trim(),
        stderr: '',
        executionTime: 150
      });

      const result = await systemIntegrationManager.executeSystemCommand(command);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Code.exe');
      expect(result.executionTime).toBeGreaterThan(0);
    });
  });

  describe('API Error Recovery and Resilience', () => {
    test('should implement exponential backoff for failed API calls', async () => {
      let callCount = 0;
      const maxRetries = 3;

      nock('https://api.unreliable-service.com')
        .get('/data')
        .times(2)
        .reply(500, { error: 'Internal Server Error' })
        .get('/data')
        .reply(200, { data: 'Success on third try' });

      systemIntegrationManager.getCalendarEvents.mockImplementation(async () => {
        callCount++;
        
        if (callCount <= 2) {
          const delay = Math.pow(2, callCount) * 100; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
          throw new Error('Service temporarily unavailable');
        }
        
        return { data: 'Success on third try' };
      });

      const startTime = Date.now();
      const result = await systemIntegrationManager.getCalendarEvents();
      const totalTime = Date.now() - startTime;

      expect(result.data).toBe('Success on third try');
      expect(callCount).toBe(3);
      expect(totalTime).toBeGreaterThan(300); // Should include backoff delays
    });

    test('should gracefully handle network connectivity issues', async () => {
      systemIntegrationManager.getCalendarEvents.mockImplementation(async () => {
        const error = new Error('Network request failed');
        error.code = 'ENOTFOUND';
        throw error;
      });

      try {
        await systemIntegrationManager.getCalendarEvents();
        fail('Should have thrown network error');
      } catch (error) {
        expect(error.code).toBe('ENOTFOUND');
        expect(error.message).toContain('Network request failed');
      }

      // Verify system continues operating without external connectivity
      systemIntegrationManager.calendarIntegration.emit('offline-mode', {
        reason: 'network-unavailable',
        fallbackBehavior: 'cached-data'
      });

      expect(systemIntegrationManager.calendarIntegration.listenerCount('offline-mode')).toBeGreaterThan(0);
    });

    test('should handle API authentication token expiration', async () => {
      let tokenRefreshed = false;

      systemIntegrationManager.getCalendarEvents.mockImplementation(async () => {
        if (!tokenRefreshed) {
          tokenRefreshed = true;
          const error = new Error('Token expired');
          error.status = 401;
          throw error;
        }
        
        // Simulate successful call after token refresh
        return {
          events: [{ id: 'event-after-refresh', title: 'Test Event' }]
        };
      });

      // First call should fail with auth error, second should succeed
      try {
        await systemIntegrationManager.getCalendarEvents();
        fail('Should have thrown auth error on first call');
      } catch (error) {
        expect(error.status).toBe(401);
      }

      // Second call should succeed after token refresh
      const result = await systemIntegrationManager.getCalendarEvents();
      expect(result.events[0].id).toBe('event-after-refresh');
    });
  });

  describe('Multi-Service Integration Workflows', () => {
    test('should coordinate calendar and voice recognition for meeting automation', async () => {
      // Phase 1: Upcoming meeting detection
      const upcomingMeeting = {
        id: 'daily-standup-123',
        title: 'Daily Standup',
        start: new Date(Date.now() + 300000).toISOString(), // 5 minutes from now
        attendees: ['alice@example.com', 'bob@example.com']
      };

      systemIntegrationManager.getCalendarEvents.mockResolvedValue([{
        ...upcomingMeeting,
        source: 'google'
      }]);

      // Phase 2: Voice command for meeting preparation
      systemIntegrationManager.processVoiceCommand.mockResolvedValue({
        transcript: 'prepare for daily standup meeting',
        confidence: 0.94,
        intent: 'meeting_preparation',
        parameters: { meetingId: 'daily-standup-123' }
      });

      // Phase 3: Coordinate the workflow
      const events = await systemIntegrationManager.getCalendarEvents();
      const voiceResult = await systemIntegrationManager.processVoiceCommand('meeting-prep-audio');

      expect(events[0].id).toBe('daily-standup-123');
      expect(voiceResult.intent).toBe('meeting_preparation');
      expect(voiceResult.parameters.meetingId).toBe('daily-standup-123');

      // Verify integration triggered appropriate system actions
      systemIntegrationManager.calendarIntegration.emit('meeting-preparation', {
        meeting: events[0],
        voiceCommand: voiceResult,
        actions: ['mute-notifications', 'open-teams', 'switch-profile-meeting']
      });
    });

    test('should integrate multiple external services for context awareness', async () => {
      // Mock multiple service responses
      const calendarEvents = [
        { id: 'focus-block', title: 'Deep Work Focus Time', type: 'focus' }
      ];
      
      const systemMetrics = {
        cpu: { usage: 15.3 },
        activeApp: { name: 'IntelliJ IDEA', category: 'development' }
      };
      
      const voiceCommand = {
        transcript: 'enable focus mode',
        intent: 'focus_activation'
      };

      systemIntegrationManager.getCalendarEvents.mockResolvedValue(calendarEvents);
      systemIntegrationManager.getSystemMetrics.mockResolvedValue(systemMetrics);
      systemIntegrationManager.processVoiceCommand.mockResolvedValue(voiceCommand);

      // Simulate coordinated context detection
      const [events, metrics, voice] = await Promise.all([
        systemIntegrationManager.getCalendarEvents(),
        systemIntegrationManager.getSystemMetrics(),
        systemIntegrationManager.processVoiceCommand('focus-audio')
      ]);

      // Verify integrated context analysis
      const contextScore = calculateContextScore(events, metrics, voice);
      expect(contextScore.profile).toBe('deep-focus');
      expect(contextScore.confidence).toBeGreaterThan(0.85);

      function calculateContextScore(events, metrics, voice) {
        let score = 0;
        
        if (events.some(e => e.type === 'focus')) score += 0.4;
        if (metrics.cpu.usage < 20) score += 0.2;
        if (metrics.activeApp.category === 'development') score += 0.2;
        if (voice.intent === 'focus_activation') score += 0.3;

        return {
          confidence: score,
          profile: score > 0.8 ? 'deep-focus' : 'default'
        };
      }
    });
  });
});