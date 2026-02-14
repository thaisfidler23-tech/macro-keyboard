/**
 * Calendar Integration Manager - Comprehensive calendar application integration
 *
 * This class provides unified calendar integration supporting:
 * - Microsoft Graph API (Outlook/Office 365)
 * - Google Calendar API
 * - Apple Calendar (macOS EventKit)
 * - CalDAV protocol for generic calendar systems
 * - Meeting-aware profile switching
 * - Event-based automation triggers
 * - Meeting controls integration
 */

const EventEmitter = require('events');
const { DateTime } = require('luxon');
const cron = require('node-cron');

const MicrosoftGraphProvider = require('./providers/MicrosoftGraphProvider');
const GoogleCalendarProvider = require('./providers/GoogleCalendarProvider');
const AppleCalendarProvider = require('./providers/AppleCalendarProvider');
const CalDAVProvider = require('./providers/CalDAVProvider');
const CalendarEventProcessor = require('./processors/CalendarEventProcessor');
const MeetingStateMachine = require('./processors/MeetingStateMachine');

/**
 * Event automation mapping for different meeting types
 */
const EVENT_AUTOMATION = {
  meetingTypes: {
    'one-on-one': {
      profile: 'meeting_focused',
      macros: ['mute_notifications', 'close_distractions', 'open_notes'],
      led_scheme: 'meeting_indicator'
    },
    'team-meeting': {
      profile: 'collaboration',
      macros: ['open_team_tools', 'prepare_screenshare', 'mute_music'],
      led_scheme: 'team_meeting'
    },
    presentation: {
      profile: 'presentation_mode',
      macros: ['presentation_setup', 'disable_notifications', 'focus_mode'],
      led_scheme: 'presentation_active'
    },
    'focus-time': {
      profile: 'deep_work',
      macros: ['enable_do_not_disturb', 'close_social_media', 'open_productivity_apps'],
      led_scheme: 'focus_mode'
    }
  },

  eventStates: {
    upcoming: {
      // 5 minutes before
      actions: ['show_meeting_reminder', 'prepare_meeting_profile'],
      notification: 'Meeting starting in 5 minutes'
    },
    starting: {
      // Meeting start time
      actions: ['switch_to_meeting_profile', 'execute_meeting_macros'],
      notification: 'Meeting started - switching to meeting mode'
    },
    active: {
      // During meeting
      actions: ['maintain_meeting_mode', 'show_meeting_controls'],
      notification: 'Meeting in progress'
    },
    ending: {
      // Meeting end time
      actions: ['restore_previous_profile', 'show_meeting_summary'],
      notification: 'Meeting ended - returning to normal mode'
    }
  }
};

class CalendarIntegrationManager extends EventEmitter {
  constructor(logger, config = {}) {
    super();

    this.logger = logger || {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {}
    };

    this.config = {
      refreshInterval: config.refreshInterval || 60000, // 1 minute
      upcomingThreshold: config.upcomingThreshold || 5 * 60 * 1000, // 5 minutes
      enabledProviders: config.enabledProviders || [],
      meetingAutomation: config.meetingAutomation !== false, // Default enabled
      privacyMode: config.privacyMode || false,
      ...config
    };

    this.providers = new Map();
    this.eventProcessor = new CalendarEventProcessor(this.logger);
    this.meetingStateMachine = new MeetingStateMachine(this.logger);
    this.contextManager = null; // Injected dependency
    this.profileManager = null; // Injected dependency

    this.currentEvents = new Map();
    this.refreshTimer = null;
    this.isInitialized = false;

    // Bind event handlers
    this.handleMeetingStateChange = this.handleMeetingStateChange.bind(this);
    this.handleEventsUpdate = this.handleEventsUpdate.bind(this);
  }

  /**
   * Initialize the calendar integration system
   */
  async initialize(contextManager, profileManager) {
    try {
      this.logger.info('Initializing Calendar Integration Manager...');

      this.contextManager = contextManager;
      this.profileManager = profileManager;

      // Initialize calendar providers
      await this.initializeProviders();

      // Start event monitoring
      await this.startEventMonitoring();

      // Set up meeting state machine
      this.meetingStateMachine.on('stateChange', this.handleMeetingStateChange);

      // Set up periodic refresh
      this.setupPeriodicRefresh();

      this.isInitialized = true;
      this.emit('initialized');

      this.logger.info('Calendar Integration Manager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Calendar Integration Manager:', error);
      throw error;
    }
  }

  /**
   * Initialize configured calendar providers
   */
  async initializeProviders() {
    const enabledProviders = this.config.enabledProviders;

    // Microsoft Graph (Outlook/Office 365)
    if (enabledProviders.includes('microsoft') && (await this.isProviderConfigured('microsoft'))) {
      try {
        const provider = new MicrosoftGraphProvider(this.logger, this.config.microsoft || {});
        await provider.initialize();
        this.providers.set('microsoft', provider);
        provider.on('eventsChanged', events => this.handleEventsUpdate('microsoft', events));
        this.logger.info('Microsoft Graph provider initialized');
      } catch (error) {
        this.logger.error('Failed to initialize Microsoft Graph provider:', error);
      }
    }

    // Google Calendar
    if (enabledProviders.includes('google') && (await this.isProviderConfigured('google'))) {
      try {
        const provider = new GoogleCalendarProvider(this.logger, this.config.google || {});
        await provider.initialize();
        this.providers.set('google', provider);
        provider.on('eventsChanged', events => this.handleEventsUpdate('google', events));
        this.logger.info('Google Calendar provider initialized');
      } catch (error) {
        this.logger.error('Failed to initialize Google Calendar provider:', error);
      }
    }

    // Apple Calendar (macOS only)
    if (
      process.platform === 'darwin' &&
      enabledProviders.includes('apple') &&
      (await this.isProviderConfigured('apple'))
    ) {
      try {
        const provider = new AppleCalendarProvider(this.logger, this.config.apple || {});
        await provider.initialize();
        this.providers.set('apple', provider);
        provider.on('eventsChanged', events => this.handleEventsUpdate('apple', events));
        this.logger.info('Apple Calendar provider initialized');
      } catch (error) {
        this.logger.error('Failed to initialize Apple Calendar provider:', error);
      }
    }

    // Generic CalDAV providers
    const caldavConfigs = this.config.caldav || [];
    for (const config of caldavConfigs) {
      try {
        const provider = new CalDAVProvider(this.logger, config);
        await provider.initialize();
        const providerId = `caldav_${config.id || config.url}`;
        this.providers.set(providerId, provider);
        provider.on('eventsChanged', events => this.handleEventsUpdate(providerId, events));
        this.logger.info(`CalDAV provider initialized: ${providerId}`);
      } catch (error) {
        this.logger.error(`Failed to initialize CalDAV provider ${config.id}:`, error);
      }
    }

    this.logger.info(`Initialized ${this.providers.size} calendar providers`);
  }

  /**
   * Check if a calendar provider is configured
   */
  async isProviderConfigured(providerType) {
    const config = this.config[providerType];

    if (!config) {
      return false;
    }

    switch (providerType) {
      case 'microsoft':
        return !!(config.clientId && config.clientSecret);
      case 'google':
        return !!(config.clientId && config.clientSecret);
      case 'apple':
        return process.platform === 'darwin';
      default:
        return false;
    }
  }

  /**
   * Start monitoring events from all providers
   */
  async startEventMonitoring() {
    for (const [providerId, provider] of this.providers) {
      try {
        await provider.startMonitoring();
        this.logger.debug(`Started monitoring provider: ${providerId}`);
      } catch (error) {
        this.logger.error(`Failed to start monitoring provider ${providerId}:`, error);
      }
    }
  }

  /**
   * Set up periodic refresh of calendar events
   */
  setupPeriodicRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    this.refreshTimer = setInterval(() => {
      this.refreshAllEvents().catch(error => {
        this.logger.error('Error during periodic refresh:', error);
      });
    }, this.config.refreshInterval);

    // Also set up cron job for more precise timing
    cron.schedule('*/5 * * * *', () => {
      // Every 5 minutes
      this.checkUpcomingMeetings().catch(error => {
        this.logger.error('Error checking upcoming meetings:', error);
      });
    });
  }

  /**
   * Refresh events from all providers
   */
  async refreshAllEvents() {
    const refreshPromises = Array.from(this.providers.entries()).map(
      async ([providerId, provider]) => {
        try {
          await provider.refresh();
        } catch (error) {
          this.logger.error(`Failed to refresh provider ${providerId}:`, error);
        }
      }
    );

    await Promise.allSettled(refreshPromises);
  }

  /**
   * Handle events update from a provider
   */
  async handleEventsUpdate(providerId, events) {
    try {
      this.logger.debug(`Received ${events.length} events from provider: ${providerId}`);

      // Process events and detect meeting state changes
      const processedEvents = await this.eventProcessor.processEvents(events);

      // Update current events map
      for (const event of processedEvents) {
        this.currentEvents.set(`${providerId}_${event.id}`, event);
      }

      // Update meeting state machine
      for (const event of processedEvents) {
        await this.meetingStateMachine.processEvent(event);
      }

      this.emit('eventsUpdated', {
        providerId,
        events: processedEvents,
        totalEvents: this.currentEvents.size
      });
    } catch (error) {
      this.logger.error(`Error handling events update from ${providerId}:`, error);
    }
  }

  /**
   * Handle meeting state changes
   */
  async handleMeetingStateChange(state, meetingEvent) {
    try {
      this.logger.info(`Meeting state changed to: ${state.name}`, {
        meeting: meetingEvent.title,
        previous: state.previous
      });

      if (!this.config.meetingAutomation) {
        this.logger.debug('Meeting automation disabled, skipping actions');
        return;
      }

      const automation = EVENT_AUTOMATION.eventStates[state.name];

      if (automation) {
        // Execute automation actions
        for (const action of automation.actions) {
          await this.executeAutomationAction(action, meetingEvent);
        }

        // Show notification
        if (automation.notification && this.contextManager) {
          await this.contextManager.emit('notification', {
            type: 'meeting',
            message: automation.notification,
            meeting: meetingEvent
          });
        }
      }

      this.emit('meetingStateChange', state, meetingEvent);
    } catch (error) {
      this.logger.error('Error handling meeting state change:', error);
    }
  }

  /**
   * Execute automation action for meeting
   */
  async executeAutomationAction(action, meetingEvent) {
    try {
      switch (action) {
        case 'show_meeting_reminder':
          this.emit('showMeetingReminder', meetingEvent);
          break;

        case 'prepare_meeting_profile':
          await this.prepareMeetingProfile(meetingEvent);
          break;

        case 'switch_to_meeting_profile':
          await this.switchToMeetingProfile(meetingEvent);
          break;

        case 'execute_meeting_macros':
          await this.executeMeetingMacros(meetingEvent);
          break;

        case 'maintain_meeting_mode':
          // Keep meeting mode active
          break;

        case 'show_meeting_controls':
          this.emit('showMeetingControls', meetingEvent);
          break;

        case 'restore_previous_profile':
          await this.restorePreviousProfile();
          break;

        case 'show_meeting_summary':
          this.emit('showMeetingSummary', meetingEvent);
          break;

        default:
          this.logger.warn(`Unknown automation action: ${action}`);
      }
    } catch (error) {
      this.logger.error(`Error executing automation action ${action}:`, error);
    }
  }

  /**
   * Prepare meeting profile based on meeting type
   */
  async prepareMeetingProfile(meetingEvent) {
    if (!this.profileManager) {
      return;
    }

    const meetingType = meetingEvent.meetingType || 'team-meeting';
    const automation = EVENT_AUTOMATION.meetingTypes[meetingType];

    if (automation && automation.profile) {
      // Store current profile for restoration
      const currentProfile = this.profileManager.getActiveProfile();
      if (currentProfile) {
        meetingEvent.previousProfile = currentProfile.name;
      }

      this.logger.info(
        `Preparing meeting profile: ${automation.profile} for meeting: ${meetingEvent.title}`
      );
    }
  }

  /**
   * Switch to meeting-appropriate profile
   */
  async switchToMeetingProfile(meetingEvent) {
    if (!this.profileManager) {
      return;
    }

    const meetingType = meetingEvent.meetingType || 'team-meeting';
    const automation = EVENT_AUTOMATION.meetingTypes[meetingType];

    if (automation && automation.profile) {
      try {
        await this.profileManager.switchToProfile(automation.profile);
        this.logger.info(`Switched to meeting profile: ${automation.profile}`);
      } catch (error) {
        this.logger.error(`Failed to switch to meeting profile ${automation.profile}:`, error);
      }
    }
  }

  /**
   * Execute meeting-specific macros
   */
  async executeMeetingMacros(meetingEvent) {
    const meetingType = meetingEvent.meetingType || 'team-meeting';
    const automation = EVENT_AUTOMATION.meetingTypes[meetingType];

    if (automation && automation.macros) {
      for (const macro of automation.macros) {
        try {
          this.emit('executeMacro', { macro, meeting: meetingEvent });
          this.logger.debug(`Executed meeting macro: ${macro}`);
        } catch (error) {
          this.logger.error(`Failed to execute meeting macro ${macro}:`, error);
        }
      }
    }
  }

  /**
   * Restore previous profile after meeting
   */
  async restorePreviousProfile() {
    if (!this.profileManager) {
      return;
    }

    // Find the most recent active meeting to get previous profile
    const activeMeetings = this.meetingStateMachine.getCurrentMeetings();

    for (const meeting of activeMeetings) {
      if (meeting.previousProfile) {
        try {
          await this.profileManager.switchToProfile(meeting.previousProfile);
          this.logger.info(`Restored previous profile: ${meeting.previousProfile}`);
          break;
        } catch (error) {
          this.logger.error(
            `Failed to restore previous profile ${meeting.previousProfile}:`,
            error
          );
        }
      }
    }
  }

  /**
   * Check for upcoming meetings and trigger notifications
   */
  async checkUpcomingMeetings() {
    const now = DateTime.now();
    const upcomingThreshold = now.plus({ milliseconds: this.config.upcomingThreshold });

    for (const event of this.currentEvents.values()) {
      const eventStart = DateTime.fromJSDate(event.start);

      if (eventStart > now && eventStart <= upcomingThreshold) {
        const minutesUntil = Math.round(eventStart.diff(now, 'minutes').minutes);

        this.emit('upcomingMeeting', {
          event,
          minutesUntil,
          message: `Meeting "${event.title}" starting in ${minutesUntil} minutes`
        });
      }
    }
  }

  /**
   * Get current calendar events
   */
  getCurrentEvents() {
    return Array.from(this.currentEvents.values());
  }

  /**
   * Get active meetings
   */
  getActiveMeetings() {
    return this.meetingStateMachine.getCurrentMeetings();
  }

  /**
   * Get provider status
   */
  getProviderStatus() {
    const status = {};

    for (const [providerId, provider] of this.providers) {
      status[providerId] = {
        connected: provider.isConnected(),
        authenticated: provider.isAuthenticated(),
        lastSync: provider.getLastSyncTime(),
        eventCount: provider.getEventCount()
      };
    }

    return status;
  }

  /**
   * Get integration status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      providersCount: this.providers.size,
      providers: this.getProviderStatus(),
      currentEvents: this.currentEvents.size,
      activeMeetings: this.meetingStateMachine.getActiveMeetingCount(),
      automationEnabled: this.config.meetingAutomation,
      privacyMode: this.config.privacyMode
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      this.logger.info('Cleaning up Calendar Integration Manager...');

      // Clear refresh timer
      if (this.refreshTimer) {
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
      }

      // Cleanup providers
      for (const [providerId, provider] of this.providers) {
        try {
          await provider.cleanup();
        } catch (error) {
          this.logger.error(`Error cleaning up provider ${providerId}:`, error);
        }
      }

      this.providers.clear();
      this.currentEvents.clear();
      this.removeAllListeners();

      this.isInitialized = false;
      this.logger.info('Calendar Integration Manager cleanup complete');
    } catch (error) {
      this.logger.error('Error during Calendar Integration Manager cleanup:', error);
    }
  }
}

module.exports = CalendarIntegrationManager;
