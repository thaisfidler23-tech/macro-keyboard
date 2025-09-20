/**
 * Microsoft Graph Calendar Provider
 * 
 * Provides calendar integration with Microsoft Outlook and Office 365
 * using the Microsoft Graph API with OAuth 2.0 authentication.
 */

const EventEmitter = require('events');
const { Client } = require('@microsoft/microsoft-graph-client');
const { AuthenticationProvider } = require('@microsoft/microsoft-graph-client');
const { ClientCredentialRequest, ConfidentialClientApplication } = require('@azure/msal-node');
const { DateTime } = require('luxon');

class MicrosoftGraphAuthProvider {
  constructor(clientId, clientSecret, tenantId = 'common') {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.tenantId = tenantId;
    this.accessToken = null;
    this.tokenExpiry = null;
    
    // Initialize MSAL client
    this.msalConfig = {
      auth: {
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        authority: `https://login.microsoftonline.com/${this.tenantId}`
      }
    };
    
    this.msalInstance = new ConfidentialClientApplication(this.msalConfig);
  }
  
  async getAccessToken() {
    // Check if current token is still valid
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }
    
    try {
      const clientCredentialRequest = {
        scopes: ['https://graph.microsoft.com/.default']
      };
      
      const response = await this.msalInstance.acquireTokenByClientCredential(clientCredentialRequest);
      
      this.accessToken = response.accessToken;
      this.tokenExpiry = new Date(response.expiresOn);
      
      return this.accessToken;
      
    } catch (error) {
      throw new Error(`Failed to acquire access token: ${error.message}`);
    }
  }
}

class MicrosoftGraphProvider extends EventEmitter {
  constructor(logger, config = {}) {
    super();
    
    this.logger = logger;
    this.config = {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      tenantId: config.tenantId || 'common',
      refreshInterval: config.refreshInterval || 300000, // 5 minutes
      maxEvents: config.maxEvents || 100,
      ...config
    };
    
    this.graphClient = null;
    this.authProvider = null;
    this.isConnected = false;
    this.isAuthenticated = false;
    this.lastSyncTime = null;
    this.currentEvents = [];
    this.monitoringTimer = null;
  }
  
  async initialize() {
    try {
      this.logger.info('Initializing Microsoft Graph provider...');
      
      if (!this.config.clientId || !this.config.clientSecret) {
        throw new Error('Microsoft Graph client ID and secret are required');
      }
      
      // Initialize authentication provider
      this.authProvider = new MicrosoftGraphAuthProvider(
        this.config.clientId,
        this.config.clientSecret,
        this.config.tenantId
      );
      
      // Test authentication
      await this.authenticate();
      
      // Initialize Graph client
      this.graphClient = Client.initWithMiddleware({
        authProvider: {
          getAccessToken: async () => {
            return await this.authProvider.getAccessToken();
          }
        }
      });
      
      this.isConnected = true;
      this.logger.info('Microsoft Graph provider initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize Microsoft Graph provider:', error);
      throw error;
    }
  }
  
  async authenticate() {
    try {
      const token = await this.authProvider.getAccessToken();
      this.isAuthenticated = !!token;
      
      if (this.isAuthenticated) {
        this.logger.info('Microsoft Graph authentication successful');
      }
      
      return this.isAuthenticated;
      
    } catch (error) {
      this.logger.error('Microsoft Graph authentication failed:', error);
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
    
    this.logger.info('Started Microsoft Graph event monitoring');
  }
  
  async fetchEvents() {
    try {
      const now = DateTime.now();
      const endDate = now.plus({ days: 7 }); // Fetch events for next 7 days
      
      this.logger.debug('Fetching events from Microsoft Graph...');
      
      const response = await this.graphClient
        .api('/me/events')
        .filter(
          `start/dateTime ge '${now.toISO()}' and ` +
          `start/dateTime le '${endDate.toISO()}'`
        )
        .select([
          'id', 'subject', 'start', 'end', 'location', 'attendees',
          'bodyPreview', 'organizer', 'isAllDay', 'showAs', 'sensitivity',
          'categories', 'onlineMeeting', 'isOnlineMeeting', 'webLink'
        ].join(','))
        .orderby('start/dateTime')
        .top(this.config.maxEvents)
        .get();
      
      const events = response.value || [];
      const normalizedEvents = events.map(event => this.normalizeEvent(event));
      
      // Check for changes
      if (this.hasEventsChanged(normalizedEvents)) {
        this.currentEvents = normalizedEvents;
        this.lastSyncTime = new Date();
        this.emit('eventsChanged', normalizedEvents);
        
        this.logger.debug(`Fetched ${normalizedEvents.length} events from Microsoft Graph`);
      }
      
      return normalizedEvents;
      
    } catch (error) {
      this.logger.error('Failed to fetch events from Microsoft Graph:', error);
      
      // Re-authenticate if token expired
      if (error.code === 'InvalidAuthenticationToken') {
        try {
          await this.authenticate();
        } catch (authError) {
          this.logger.error('Failed to re-authenticate:', authError);
        }
      }
      
      throw error;
    }
  }
  
  normalizeEvent(graphEvent) {
    const startDateTime = DateTime.fromISO(graphEvent.start.dateTime).toJSDate();
    const endDateTime = DateTime.fromISO(graphEvent.end.dateTime).toJSDate();
    
    return {
      id: graphEvent.id,
      title: graphEvent.subject || 'Untitled Event',
      start: startDateTime,
      end: endDateTime,
      isAllDay: graphEvent.isAllDay || false,
      location: this.parseLocation(graphEvent.location),
      attendees: this.parseAttendees(graphEvent.attendees),
      organizer: this.parseOrganizer(graphEvent.organizer),
      description: graphEvent.bodyPreview || '',
      categories: graphEvent.categories || [],
      sensitivity: graphEvent.sensitivity || 'normal',
      showAs: graphEvent.showAs || 'busy',
      isOnlineMeeting: graphEvent.isOnlineMeeting || false,
      onlineMeetingUrl: graphEvent.onlineMeeting?.joinUrl || graphEvent.webLink,
      provider: 'microsoft',
      providerId: 'microsoft',
      meetingType: this.classifyMeetingType(graphEvent),
      platform: this.detectMeetingPlatform(graphEvent),
      raw: graphEvent
    };
  }
  
  parseLocation(location) {
    if (!location) return null;
    
    return {
      displayName: location.displayName || '',
      address: location.address ? {
        street: location.address.street || '',
        city: location.address.city || '',
        state: location.address.state || '',
        postalCode: location.address.postalCode || '',
        country: location.address.countryOrRegion || ''
      } : null,
      coordinates: location.coordinates ? {
        latitude: location.coordinates.latitude,
        longitude: location.coordinates.longitude
      } : null
    };
  }
  
  parseAttendees(attendees) {
    if (!attendees || !Array.isArray(attendees)) return [];
    
    return attendees.map(attendee => ({
      name: attendee.emailAddress?.name || '',
      email: attendee.emailAddress?.address || '',
      status: attendee.status?.response || 'none',
      type: attendee.type || 'required'
    }));
  }
  
  parseOrganizer(organizer) {
    if (!organizer) return null;
    
    return {
      name: organizer.emailAddress?.name || '',
      email: organizer.emailAddress?.address || ''
    };
  }
  
  classifyMeetingType(event) {
    const title = (event.subject || '').toLowerCase();
    const attendeeCount = event.attendees ? event.attendees.length : 0;
    const categories = event.categories || [];
    
    // Check categories first
    if (categories.some(cat => cat.toLowerCase().includes('presentation'))) {
      return 'presentation';
    }
    
    if (categories.some(cat => cat.toLowerCase().includes('focus'))) {
      return 'focus-time';
    }
    
    // Check title patterns
    if (title.includes('presentation') || title.includes('demo') || title.includes('showcase')) {
      return 'presentation';
    }
    
    if (title.includes('focus') || title.includes('deep work') || title.includes('coding')) {
      return 'focus-time';
    }
    
    if (title.includes('1:1') || title.includes('one-on-one') || title.includes('1-on-1')) {
      return 'one-on-one';
    }
    
    // Classify by attendee count
    if (attendeeCount === 0 || attendeeCount === 1) {
      return 'one-on-one';
    } else if (attendeeCount <= 5) {
      return 'team-meeting';
    } else if (attendeeCount <= 20) {
      return 'large-meeting';
    } else {
      return 'presentation';
    }
  }
  
  detectMeetingPlatform(event) {
    const title = (event.subject || '').toLowerCase();
    const bodyPreview = (event.bodyPreview || '').toLowerCase();
    const location = event.location?.displayName?.toLowerCase() || '';
    const onlineMeetingUrl = event.onlineMeeting?.joinUrl || event.webLink || '';
    
    const allText = `${title} ${bodyPreview} ${location} ${onlineMeetingUrl}`.toLowerCase();
    
    if (allText.includes('teams') || allText.includes('microsoft teams')) {
      return 'teams';
    }
    
    if (allText.includes('zoom') || allText.includes('zoom.us')) {
      return 'zoom';
    }
    
    if (allText.includes('meet.google.com') || allText.includes('google meet')) {
      return 'google-meet';
    }
    
    if (allText.includes('webex') || allText.includes('cisco webex')) {
      return 'webex';
    }
    
    if (allText.includes('gotomeeting') || allText.includes('goto meeting')) {
      return 'gotomeeting';
    }
    
    if (event.isOnlineMeeting) {
      return 'teams'; // Default for Microsoft online meetings
    }
    
    return 'unknown';
  }
  
  hasEventsChanged(newEvents) {
    if (this.currentEvents.length !== newEvents.length) {
      return true;
    }
    
    // Simple change detection based on event IDs and modification times
    const currentIds = new Set(this.currentEvents.map(e => e.id));
    const newIds = new Set(newEvents.map(e => e.id));
    
    // Check for added/removed events
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
    
    this.logger.info('Microsoft Graph provider cleaned up');
  }
}

module.exports = MicrosoftGraphProvider;