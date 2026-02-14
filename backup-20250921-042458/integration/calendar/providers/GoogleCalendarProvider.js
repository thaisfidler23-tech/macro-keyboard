/**
 * Google Calendar Provider
 *
 * Provides calendar integration with Google Calendar using the Google Calendar API v3
 * with OAuth 2.0 authentication.
 */

const EventEmitter = require('events');
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const { DateTime } = require('luxon');
const fs = require('fs').promises;
const path = require('path');

class GoogleCalendarProvider extends EventEmitter {
  constructor(logger, config = {}) {
    super();

    this.logger = logger;
    this.config = {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri || 'urn:ietf:wg:oauth:2.0:oob',
      refreshInterval: config.refreshInterval || 300000, // 5 minutes
      maxEvents: config.maxEvents || 100,
      calendarIds: config.calendarIds || ['primary'],
      tokenPath:
        config.tokenPath || path.join(process.cwd(), 'config', 'google-calendar-token.json'),
      ...config
    };

    this.oauth2Client = null;
    this.calendar = null;
    this.isConnected = false;
    this.isAuthenticated = false;
    this.lastSyncTime = null;
    this.currentEvents = [];
    this.monitoringTimer = null;
  }

  async initialize() {
    try {
      this.logger.info('Initializing Google Calendar provider...');

      if (!this.config.clientId || !this.config.clientSecret) {
        throw new Error('Google Calendar client ID and secret are required');
      }

      // Initialize OAuth2 client
      this.oauth2Client = new OAuth2Client(
        this.config.clientId,
        this.config.clientSecret,
        this.config.redirectUri
      );

      // Try to load existing token
      await this.loadStoredToken();

      if (!this.isAuthenticated) {
        this.logger.info('Google Calendar authentication required');
        // The application should handle the OAuth flow externally
        throw new Error('Google Calendar authentication required. Please complete OAuth flow.');
      }

      // Initialize Google Calendar API client
      this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      this.isConnected = true;
      this.logger.info('Google Calendar provider initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Google Calendar provider:', error);
      throw error;
    }
  }

  async loadStoredToken() {
    try {
      const tokenData = await fs.readFile(this.config.tokenPath, 'utf8');
      const token = JSON.parse(tokenData);

      this.oauth2Client.setCredentials(token);

      // Check if token is valid/refresh if needed
      const tokenInfo = await this.oauth2Client.getAccessToken();
      if (tokenInfo.token) {
        this.isAuthenticated = true;
        this.logger.info('Google Calendar token loaded successfully');
      }
    } catch (error) {
      this.logger.debug('No stored Google Calendar token found or token invalid');
      this.isAuthenticated = false;
    }
  }

  async saveToken(token) {
    try {
      await fs.mkdir(path.dirname(this.config.tokenPath), { recursive: true });
      await fs.writeFile(this.config.tokenPath, JSON.stringify(token, null, 2));
      this.logger.info('Google Calendar token saved successfully');
    } catch (error) {
      this.logger.error('Failed to save Google Calendar token:', error);
    }
  }

  getAuthUrl() {
    const scopes = [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events.readonly'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  async authenticateWithCode(code) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);

      await this.saveToken(tokens);
      this.isAuthenticated = true;

      this.logger.info('Google Calendar authentication completed');
      return true;
    } catch (error) {
      this.logger.error('Google Calendar authentication failed:', error);
      throw error;
    }
  }

  async refreshToken() {
    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      this.oauth2Client.setCredentials(credentials);

      await this.saveToken(credentials);
      this.logger.debug('Google Calendar token refreshed');
    } catch (error) {
      this.logger.error('Failed to refresh Google Calendar token:', error);
      this.isAuthenticated = false;
      throw error;
    }
  }

  async startMonitoring() {
    if (!this.isAuthenticated) {
      throw new Error('Must authenticate before starting monitoring');
    }

    // Initial fetch
    await this.fetchEvents();

    // Set up periodic monitoring
    this.monitoringTimer = setInterval(async () => {
      try {
        await this.fetchEvents();
      } catch (error) {
        this.logger.error('Error during periodic event fetch:', error);
        this.emit('error', error);
      }
    }, this.config.refreshInterval);

    this.logger.info('Started Google Calendar event monitoring');
  }

  async fetchEvents() {
    try {
      const now = DateTime.now();
      const endDate = now.plus({ days: 7 });

      this.logger.debug('Fetching events from Google Calendar...');

      const allEvents = [];

      // Fetch events from all configured calendars
      for (const calendarId of this.config.calendarIds) {
        try {
          const response = await this.calendar.events.list({
            calendarId,
            timeMin: now.toISO(),
            timeMax: endDate.toISO(),
            maxResults: this.config.maxEvents,
            singleEvents: true,
            orderBy: 'startTime'
          });

          const events = response.data.items || [];
          const normalizedEvents = events.map(event => this.normalizeEvent(event, calendarId));
          allEvents.push(...normalizedEvents);

          this.logger.debug(`Fetched ${events.length} events from calendar: ${calendarId}`);
        } catch (error) {
          this.logger.error(`Failed to fetch events from calendar ${calendarId}:`, error);

          // Handle auth errors
          if (error.code === 401 || error.code === 403) {
            try {
              await this.refreshToken();
            } catch (refreshError) {
              this.logger.error('Failed to refresh token:', refreshError);
            }
          }
        }
      }

      // Sort all events by start time
      allEvents.sort((a, b) => new Date(a.start) - new Date(b.start));

      // Check for changes
      if (this.hasEventsChanged(allEvents)) {
        this.currentEvents = allEvents;
        this.lastSyncTime = new Date();
        this.emit('eventsChanged', allEvents);

        this.logger.debug(`Fetched ${allEvents.length} total events from Google Calendar`);
      }

      return allEvents;
    } catch (error) {
      this.logger.error('Failed to fetch events from Google Calendar:', error);
      throw error;
    }
  }

  normalizeEvent(googleEvent, calendarId) {
    // Handle different date/time formats
    const startDateTime = this.parseDateTime(googleEvent.start);
    const endDateTime = this.parseDateTime(googleEvent.end);

    return {
      id: googleEvent.id,
      title: googleEvent.summary || 'Untitled Event',
      start: startDateTime,
      end: endDateTime,
      isAllDay: !!googleEvent.start.date, // All-day events have 'date' instead of 'dateTime'
      location: googleEvent.location || null,
      attendees: this.parseAttendees(googleEvent.attendees),
      organizer: this.parseOrganizer(googleEvent.organizer),
      description: googleEvent.description || '',
      categories: [],
      sensitivity: 'normal',
      showAs: googleEvent.transparency === 'transparent' ? 'free' : 'busy',
      isOnlineMeeting: this.hasOnlineMeeting(googleEvent),
      onlineMeetingUrl: this.extractMeetingUrl(googleEvent),
      calendarId,
      provider: 'google',
      providerId: 'google',
      meetingType: this.classifyMeetingType(googleEvent),
      platform: this.detectMeetingPlatform(googleEvent),
      raw: googleEvent
    };
  }

  parseDateTime(dateTimeObj) {
    if (dateTimeObj.dateTime) {
      return DateTime.fromISO(dateTimeObj.dateTime).toJSDate();
    } else if (dateTimeObj.date) {
      return DateTime.fromISO(dateTimeObj.date).toJSDate();
    }
    return new Date();
  }

  parseAttendees(attendees) {
    if (!attendees || !Array.isArray(attendees)) {
      return [];
    }

    return attendees.map(attendee => ({
      name: attendee.displayName || attendee.email || '',
      email: attendee.email || '',
      status: attendee.responseStatus || 'needsAction',
      type: attendee.optional ? 'optional' : 'required',
      organizer: attendee.organizer || false
    }));
  }

  parseOrganizer(organizer) {
    if (!organizer) {
      return null;
    }

    return {
      name: organizer.displayName || organizer.email || '',
      email: organizer.email || ''
    };
  }

  hasOnlineMeeting(event) {
    const conferenceData = event.conferenceData;
    if (conferenceData && conferenceData.entryPoints) {
      return conferenceData.entryPoints.length > 0;
    }

    // Check in description or location for meeting links
    const description = (event.description || '').toLowerCase();
    const location = (event.location || '').toLowerCase();

    const meetingPatterns = [
      'meet.google.com',
      'zoom.us',
      'teams.microsoft.com',
      'webex.com',
      'gotomeeting.com',
      'bluejeans.com'
    ];

    return meetingPatterns.some(
      pattern => description.includes(pattern) || location.includes(pattern)
    );
  }

  extractMeetingUrl(event) {
    // Check conference data first
    const conferenceData = event.conferenceData;
    if (conferenceData && conferenceData.entryPoints) {
      const videoEntry = conferenceData.entryPoints.find(entry => entry.entryPointType === 'video');
      if (videoEntry) {
        return videoEntry.uri;
      }
    }

    // Extract from description
    const description = event.description || '';
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
    const urls = description.match(urlRegex) || [];

    // Look for common meeting platforms
    const meetingUrl = urls.find(url => {
      const lowerUrl = url.toLowerCase();
      return (
        lowerUrl.includes('meet.google.com') ||
        lowerUrl.includes('zoom.us') ||
        lowerUrl.includes('teams.microsoft.com') ||
        lowerUrl.includes('webex.com') ||
        lowerUrl.includes('gotomeeting.com')
      );
    });

    return meetingUrl || event.htmlLink;
  }

  classifyMeetingType(event) {
    const title = (event.summary || '').toLowerCase();
    const attendeeCount = event.attendees ? event.attendees.length : 0;
    const description = (event.description || '').toLowerCase();

    const allText = `${title} ${description}`;

    // Check for specific patterns
    if (
      allText.includes('presentation') ||
      allText.includes('demo') ||
      allText.includes('showcase')
    ) {
      return 'presentation';
    }

    if (allText.includes('focus') || allText.includes('deep work') || allText.includes('coding')) {
      return 'focus-time';
    }

    if (allText.includes('1:1') || allText.includes('one-on-one') || allText.includes('1-on-1')) {
      return 'one-on-one';
    }

    // Classify by attendee count
    if (attendeeCount === 0 || attendeeCount === 1) {
      return 'one-on-one';
    } else if (attendeeCount <= 5) {
      return 'team-meeting';
    } else if (attendeeCount <= 20) {
      return 'large-meeting';
    }
    return 'presentation';
  }

  detectMeetingPlatform(event) {
    const title = (event.summary || '').toLowerCase();
    const description = (event.description || '').toLowerCase();
    const location = (event.location || '').toLowerCase();

    const allText = `${title} ${description} ${location}`;

    if (allText.includes('meet.google.com') || allText.includes('google meet')) {
      return 'google-meet';
    }

    if (allText.includes('zoom') || allText.includes('zoom.us')) {
      return 'zoom';
    }

    if (allText.includes('teams') || allText.includes('microsoft teams')) {
      return 'teams';
    }

    if (allText.includes('webex') || allText.includes('cisco webex')) {
      return 'webex';
    }

    if (allText.includes('gotomeeting') || allText.includes('goto meeting')) {
      return 'gotomeeting';
    }

    // Check conference data
    const conferenceData = event.conferenceData;
    if (conferenceData) {
      const solutionKey = conferenceData.conferenceSolution?.key?.type || '';

      if (solutionKey === 'hangoutsMeet') {
        return 'google-meet';
      }
    }

    return 'unknown';
  }

  hasEventsChanged(newEvents) {
    if (this.currentEvents.length !== newEvents.length) {
      return true;
    }

    // Simple change detection based on event IDs
    const currentIds = new Set(this.currentEvents.map(e => `${e.calendarId}_${e.id}`));
    const newIds = new Set(newEvents.map(e => `${e.calendarId}_${e.id}`));

    if (currentIds.size !== newIds.size) {
      return true;
    }

    for (const id of newIds) {
      if (!currentIds.has(id)) {
        return true;
      }
    }

    return false;
  }

  async refresh() {
    return await this.fetchEvents();
  }

  isConnected() {
    return this.isConnected;
  }

  isAuthenticated() {
    return this.isAuthenticated;
  }

  getLastSyncTime() {
    return this.lastSyncTime;
  }

  getEventCount() {
    return this.currentEvents.length;
  }

  getCurrentEvents() {
    return [...this.currentEvents];
  }

  async cleanup() {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }

    this.isConnected = false;
    this.isAuthenticated = false;
    this.currentEvents = [];
    this.removeAllListeners();

    this.logger.info('Google Calendar provider cleaned up');
  }
}

module.exports = GoogleCalendarProvider;
