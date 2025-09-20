/**
 * Apple Calendar Provider (macOS only)
 * 
 * Provides calendar integration with Apple Calendar using AppleScript
 * and EventKit framework access through system commands.
 */

const EventEmitter = require('events');
const { exec } = require('child_process');
const { promisify } = require('util');
const { DateTime } = require('luxon');

const execAsync = promisify(exec);

class AppleCalendarProvider extends EventEmitter {
  constructor(logger, config = {}) {
    super();
    
    this.logger = logger;
    this.config = {
      refreshInterval: config.refreshInterval || 300000, // 5 minutes
      maxEvents: config.maxEvents || 100,
      includedCalendars: config.includedCalendars || [], // Empty means all
      excludedCalendars: config.excludedCalendars || [],
      ...config
    };
    
    this.isConnected = false;
    this.isAuthenticated = false;
    this.lastSyncTime = null;
    this.currentEvents = [];
    this.monitoringTimer = null;
    this.availableCalendars = [];
  }
  
  async initialize() {
    try {
      if (process.platform !== 'darwin') {
        throw new Error('Apple Calendar provider only supports macOS');
      }
      
      this.logger.info('Initializing Apple Calendar provider...');
      
      // Check if Calendar app is available
      await this.checkCalendarAccess();
      
      // Get available calendars
      await this.loadAvailableCalendars();
      
      this.isConnected = true;
      this.isAuthenticated = true; // System access doesn't require OAuth
      
      this.logger.info('Apple Calendar provider initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize Apple Calendar provider:', error);
      throw error;
    }
  }
  
  async checkCalendarAccess() {
    try {
      // Test AppleScript access to Calendar
      const script = `
        tell application "Calendar"
          return name of calendars
        end tell
      `;
      
      await execAsync(`osascript -e '${script}'`);
      this.logger.debug('Apple Calendar access verified');
      
    } catch (error) {
      throw new Error('Cannot access Apple Calendar. Please grant Calendar access to the application.');
    }
  }
  
  async loadAvailableCalendars() {
    try {
      const script = `
        tell application "Calendar"
          set calendarList to {}
          repeat with cal in calendars
            set end of calendarList to (name of cal as string) & "|" & (color of cal as string) & "|" & (writable of cal as string)
          end repeat
          return calendarList
        end tell
      `;
      
      const { stdout } = await execAsync(`osascript -e '${script}'`);
      const calendarData = stdout.trim().split(', ');
      
      this.availableCalendars = calendarData.map(item => {
        const [name, color, writable] = item.split('|');
        return {
          name: name.trim(),
          color: color.trim(),
          writable: writable.trim() === 'true'
        };
      });
      
      this.logger.debug(`Found ${this.availableCalendars.length} calendars`);
      
    } catch (error) {
      this.logger.error('Failed to load available calendars:', error);
      this.availableCalendars = [];
    }
  }
  
  async startMonitoring() {
    if (!this.isAuthenticated) {
      throw new Error('Must have system access before starting monitoring');
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
    
    this.logger.info('Started Apple Calendar event monitoring');
  }
  
  async fetchEvents() {
    try {
      const now = DateTime.now();
      const endDate = now.plus({ days: 7 });
      
      this.logger.debug('Fetching events from Apple Calendar...');
      
      // Build calendar filter
      let calendarFilter = '';
      if (this.config.includedCalendars.length > 0) {
        const calendarNames = this.config.includedCalendars.map(name => `"${name}"`).join(', ');
        calendarFilter = `whose name is in {${calendarNames}}`;
      } else if (this.config.excludedCalendars.length > 0) {
        const calendarNames = this.config.excludedCalendars.map(name => `"${name}"`).join(', ');
        calendarFilter = `whose name is not in {${calendarNames}}`;
      }
      
      const startDateStr = now.toFormat('M/d/yyyy');
      const endDateStr = endDate.toFormat('M/d/yyyy');
      
      const script = `
        tell application "Calendar"
          set eventList to {}
          set targetCalendars to calendars ${calendarFilter}
          
          repeat with cal in targetCalendars
            set calendarEvents to (events of cal whose start date ≥ date "${startDateStr}" and start date ≤ date "${endDateStr}")
            
            repeat with evt in calendarEvents
              set eventData to ""
              set eventData to eventData & (summary of evt as string) & "|||"
              set eventData to eventData & (start date of evt as string) & "|||"
              set eventData to eventData & (end date of evt as string) & "|||"
              set eventData to eventData & (location of evt as string) & "|||"
              set eventData to eventData & (description of evt as string) & "|||"
              set eventData to eventData & (allday event of evt as string) & "|||"
              set eventData to eventData & (uid of evt as string) & "|||"
              set eventData to eventData & (name of cal as string) & "|||"
              
              -- Get attendees (if available)
              set attendeeList to ""
              try
                set eventAttendees to attendees of evt
                repeat with attendee in eventAttendees
                  set attendeeList to attendeeList & (display name of attendee as string) & ":" & (email of attendee as string) & ";"
                end repeat
              end try
              set eventData to eventData & attendeeList
              
              set end of eventList to eventData
            end repeat
          end repeat
          
          return eventList
        end tell
      `;
      
      const { stdout } = await execAsync(`osascript -e '${script}'`, { maxBuffer: 1024 * 1024 });
      
      if (!stdout.trim()) {
        this.logger.debug('No events found in Apple Calendar');
        
        if (this.currentEvents.length > 0) {
          this.currentEvents = [];
          this.lastSyncTime = new Date();
          this.emit('eventsChanged', []);
        }
        
        return [];
      }
      
      const eventData = stdout.trim().split('\n');
      const normalizedEvents = eventData
        .map(data => this.parseAppleScriptEvent(data))
        .filter(event => event !== null)
        .slice(0, this.config.maxEvents);
      
      // Check for changes
      if (this.hasEventsChanged(normalizedEvents)) {
        this.currentEvents = normalizedEvents;
        this.lastSyncTime = new Date();
        this.emit('eventsChanged', normalizedEvents);
        
        this.logger.debug(`Fetched ${normalizedEvents.length} events from Apple Calendar`);
      }
      
      return normalizedEvents;
      
    } catch (error) {
      this.logger.error('Failed to fetch events from Apple Calendar:', error);
      throw error;
    }
  }
  
  parseAppleScriptEvent(eventData) {
    try {
      const parts = eventData.split('|||');
      
      if (parts.length < 8) {
        this.logger.warn('Invalid event data format:', eventData);
        return null;
      }
      
      const [
        title, startDate, endDate, location, description,
        isAllDay, uid, calendarName, attendeesData
      ] = parts;
      
      // Parse dates
      const start = this.parseAppleDate(startDate);
      const end = this.parseAppleDate(endDate);
      
      if (!start || !end) {
        this.logger.warn('Invalid date format in event:', { startDate, endDate });
        return null;
      }
      
      // Parse attendees
      const attendees = this.parseAttendees(attendeesData || '');
      
      return {
        id: uid.trim(),
        title: title.trim() || 'Untitled Event',
        start: start.toJSDate(),
        end: end.toJSDate(),
        isAllDay: isAllDay.trim() === 'true',
        location: location.trim() || null,
        attendees: attendees,
        organizer: null, // Not easily available via AppleScript
        description: description.trim() || '',
        categories: [],
        sensitivity: 'normal',
        showAs: 'busy',
        isOnlineMeeting: this.hasOnlineMeeting(description, location),
        onlineMeetingUrl: this.extractMeetingUrl(description, location),
        calendarName: calendarName.trim(),
        provider: 'apple',
        providerId: 'apple',
        meetingType: this.classifyMeetingType(title, description, attendees),
        platform: this.detectMeetingPlatform(title, description, location),
        raw: { eventData }
      };
      
    } catch (error) {
      this.logger.error('Error parsing Apple Calendar event:', error);
      return null;
    }
  }
  
  parseAppleDate(dateString) {
    try {
      // Apple Calendar returns dates in various formats
      // Try to parse common formats
      const trimmedDate = dateString.trim();
      
      // Common format: "Monday, January 1, 2024 at 9:00:00 AM"
      const dateObj = new Date(trimmedDate);
      
      if (isNaN(dateObj.getTime())) {
        return null;
      }
      
      return DateTime.fromJSDate(dateObj);
      
    } catch (error) {
      this.logger.error('Error parsing Apple date:', { dateString, error });
      return null;
    }
  }
  
  parseAttendees(attendeesData) {
    if (!attendeesData.trim()) return [];
    
    try {
      const attendeeEntries = attendeesData.split(';').filter(entry => entry.trim());
      
      return attendeeEntries.map(entry => {
        const [name, email] = entry.split(':');
        return {
          name: name ? name.trim() : '',
          email: email ? email.trim() : '',
          status: 'unknown',
          type: 'required'
        };
      });
      
    } catch (error) {
      this.logger.error('Error parsing attendees:', error);
      return [];
    }
  }
  
  hasOnlineMeeting(description, location) {
    const content = `${description} ${location}`.toLowerCase();
    
    const meetingPatterns = [
      'zoom.us', 'meet.google.com', 'teams.microsoft.com',
      'webex.com', 'gotomeeting.com', 'facetime',
      'join.me', 'bluejeans.com', 'whereby.com'
    ];
    
    return meetingPatterns.some(pattern => content.includes(pattern));
  }
  
  extractMeetingUrl(description, location) {
    const content = `${description} ${location}`;
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
    const urls = content.match(urlRegex) || [];
    
    // Look for common meeting platforms
    const meetingUrl = urls.find(url => {
      const lowerUrl = url.toLowerCase();
      return lowerUrl.includes('zoom.us') ||
             lowerUrl.includes('meet.google.com') ||
             lowerUrl.includes('teams.microsoft.com') ||
             lowerUrl.includes('webex.com') ||
             lowerUrl.includes('gotomeeting.com');
    });
    
    return meetingUrl || null;
  }
  
  classifyMeetingType(title, description, attendees) {
    const allText = `${title} ${description}`.toLowerCase();
    const attendeeCount = attendees.length;
    
    // Check for specific patterns
    if (allText.includes('presentation') || allText.includes('demo') || allText.includes('showcase')) {
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
    } else {
      return 'presentation';
    }
  }
  
  detectMeetingPlatform(title, description, location) {
    const allText = `${title} ${description} ${location}`.toLowerCase();
    
    if (allText.includes('zoom') || allText.includes('zoom.us')) {
      return 'zoom';
    }
    
    if (allText.includes('meet.google.com') || allText.includes('google meet')) {
      return 'google-meet';
    }
    
    if (allText.includes('teams') || allText.includes('microsoft teams')) {
      return 'teams';
    }
    
    if (allText.includes('webex') || allText.includes('cisco webex')) {
      return 'webex';
    }
    
    if (allText.includes('facetime')) {
      return 'facetime';
    }
    
    if (allText.includes('gotomeeting') || allText.includes('goto meeting')) {
      return 'gotomeeting';
    }
    
    return 'unknown';
  }
  
  hasEventsChanged(newEvents) {
    if (this.currentEvents.length !== newEvents.length) {
      return true;
    }
    
    // Simple change detection based on event UIDs
    const currentIds = new Set(this.currentEvents.map(e => e.id));
    const newIds = new Set(newEvents.map(e => e.id));
    
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
  
  getAvailableCalendars() {
    return [...this.availableCalendars];
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
    
    this.logger.info('Apple Calendar provider cleaned up');
  }
}

module.exports = AppleCalendarProvider;