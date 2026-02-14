/**
 * Calendar Event Processor
 * 
 * Processes calendar events and triggers automation actions based on event properties.
 * Handles event classification, notification scheduling, and automation triggers.
 * 
 * @module CalendarEventProcessor
 */

const EventEmitter = require('events');
const { DateTime } = require('luxon');

class CalendarEventProcessor extends EventEmitter {
  constructor(logger, config = {}) {
    super();
    
    this.logger = logger;
    this.config = {
      preEventNotification: config.preEventNotification || 5, // minutes
      postEventBuffer: config.postEventBuffer || 2, // minutes
      meetingKeywords: config.meetingKeywords || [
        'meeting', 'call', 'sync', 'standup', 'review', 'interview',
        '1:1', 'one-on-one', 'conference', 'presentation', 'demo'
      ],
      focusKeywords: config.focusKeywords || [
        'focus', 'deep work', 'coding', 'development', 'writing', 'design'
      ],
      breakKeywords: config.breakKeywords || [
        'lunch', 'break', 'coffee', 'walk', 'exercise'
      ],
      ...config
    };
    
    this.activeEvents = new Map();
    this.scheduledNotifications = new Map();
    
    this.statistics = {
      eventsProcessed: 0,
      meetingsDetected: 0,
      focusTimeDetected: 0,
      automationsTriggered: 0
    };
  }

  /**
   * Process a list of events
   */
  processEvents(events) {
    const now = DateTime.now();
    const processed = [];
    
    for (const event of events) {
      try {
        const processedEvent = this._processEvent(event, now);
        processed.push(processedEvent);
        this.statistics.eventsProcessed++;
      } catch (error) {
        this.logger?.error('Failed to process event', { event: event.id, error });
      }
    }
    
    // Check for event transitions
    this._checkEventTransitions(processed, now);
    
    return processed;
  }

  /**
   * Process a single event
   */
  _processEvent(event, now) {
    const startTime = DateTime.fromISO(event.startTime);
    const endTime = DateTime.fromISO(event.endTime);
    
    // Classify event type
    const eventType = this._classifyEvent(event);
    
    // Determine event status
    const status = this._getEventStatus(startTime, endTime, now);
    
    // Calculate time until event
    const minutesUntil = startTime.diff(now, 'minutes').minutes;
    const minutesSince = now.diff(endTime, 'minutes').minutes;
    
    // Determine if automation should trigger
    const shouldTriggerAutomation = this._shouldTriggerAutomation(status, minutesUntil, eventType);
    
    return {
      ...event,
      eventType,
      status,
      minutesUntil: Math.round(minutesUntil),
      minutesSince: Math.round(minutesSince),
      shouldTriggerAutomation,
      automationProfile: this._getAutomationProfile(eventType),
      processed: true
    };
  }

  /**
   * Classify event type based on title and description
   */
  _classifyEvent(event) {
    const text = `${event.title || ''} ${event.description || ''}`.toLowerCase();
    
    // Check for meeting keywords
    for (const keyword of this.config.meetingKeywords) {
      if (text.includes(keyword.toLowerCase())) {
        this.statistics.meetingsDetected++;
        return this._classifyMeetingType(event);
      }
    }
    
    // Check for focus time keywords
    for (const keyword of this.config.focusKeywords) {
      if (text.includes(keyword.toLowerCase())) {
        this.statistics.focusTimeDetected++;
        return 'focus';
      }
    }
    
    // Check for break keywords
    for (const keyword of this.config.breakKeywords) {
      if (text.includes(keyword.toLowerCase())) {
        return 'break';
      }
    }
    
    // Check for all-day events
    const startTime = DateTime.fromISO(event.startTime);
    const endTime = DateTime.fromISO(event.endTime);
    const duration = endTime.diff(startTime, 'hours').hours;
    
    if (duration >= 23) {
      return 'all-day';
    }
    
    // Default classification
    return 'event';
  }

  /**
   * Classify meeting type
   */
  _classifyMeetingType(event) {
    const text = `${event.title || ''} ${event.description || ''}`.toLowerCase();
    const attendeeCount = event.attendees?.length || 0;
    
    if (text.includes('1:1') || text.includes('one-on-one') || attendeeCount <= 2) {
      return 'one-on-one';
    }
    
    if (text.includes('standup') || text.includes('daily')) {
      return 'standup';
    }
    
    if (text.includes('interview')) {
      return 'interview';
    }
    
    if (text.includes('presentation') || text.includes('demo')) {
      return 'presentation';
    }
    
    return 'team-meeting';
  }

  /**
   * Get event status relative to current time
   */
  _getEventStatus(startTime, endTime, now) {
    const minutesUntilStart = startTime.diff(now, 'minutes').minutes;
    const minutesUntilEnd = endTime.diff(now, 'minutes').minutes;
    
    if (minutesUntilEnd < 0) {
      return 'ended';
    }
    
    if (minutesUntilStart <= 0) {
      return 'active';
    }
    
    if (minutesUntilStart <= this.config.preEventNotification) {
      return 'starting-soon';
    }
    
    if (minutesUntilStart <= 60) {
      return 'upcoming';
    }
    
    return 'scheduled';
  }

  /**
   * Determine if automation should trigger
   */
  _shouldTriggerAutomation(status, minutesUntil, eventType) {
    // Trigger for active events
    if (status === 'active') {
      return true;
    }
    
    // Trigger for events starting soon
    if (status === 'starting-soon' && eventType !== 'event') {
      return true;
    }
    
    return false;
  }

  /**
   * Get automation profile for event type
   */
  _getAutomationProfile(eventType) {
    const profiles = {
      'one-on-one': {
        profile: 'meeting_focused',
        macros: ['mute_notifications', 'close_distractions'],
        ledScheme: 'meeting_indicator'
      },
      'team-meeting': {
        profile: 'meeting_standard',
        macros: ['mute_notifications'],
        ledScheme: 'meeting_indicator'
      },
      'standup': {
        profile: 'meeting_brief',
        macros: ['mute_notifications'],
        ledScheme: 'standup_indicator'
      },
      'interview': {
        profile: 'meeting_important',
        macros: ['mute_all', 'close_distractions', 'open_notes'],
        ledScheme: 'important_meeting'
      },
      'presentation': {
        profile: 'presentation_mode',
        macros: ['mute_all', 'hide_desktop', 'open_slides'],
        ledScheme: 'presentation_mode'
      },
      'focus': {
        profile: 'focus_mode',
        macros: ['mute_all', 'block_distractions'],
        ledScheme: 'focus_indicator'
      },
      'break': {
        profile: 'break_mode',
        macros: ['enable_notifications'],
        ledScheme: 'break_indicator'
      },
      'event': {
        profile: null,
        macros: [],
        ledScheme: null
      },
      'all-day': {
        profile: null,
        macros: [],
        ledScheme: null
      }
    };
    
    return profiles[eventType] || profiles['event'];
  }

  /**
   * Check for event transitions and emit events
   */
  _checkEventTransitions(processedEvents, now) {
    const currentActiveIds = new Set();
    
    for (const event of processedEvents) {
      if (event.status === 'active') {
        currentActiveIds.add(event.id);
        
        // Check if this is a new active event
        if (!this.activeEvents.has(event.id)) {
          this.activeEvents.set(event.id, event);
          this.emit('eventStarted', event);
          this.logger?.info('Event started', { id: event.id, title: event.title });
          
          if (event.shouldTriggerAutomation) {
            this.statistics.automationsTriggered++;
            this.emit('automationTrigger', {
              event,
              automation: event.automationProfile
            });
          }
        }
      }
      
      if (event.status === 'starting-soon') {
        this.emit('eventStartingSoon', event);
      }
    }
    
    // Check for ended events
    for (const [eventId, event] of this.activeEvents) {
      if (!currentActiveIds.has(eventId)) {
        this.activeEvents.delete(eventId);
        this.emit('eventEnded', event);
        this.logger?.info('Event ended', { id: eventId, title: event.title });
      }
    }
  }

  /**
   * Get active events
   */
  getActiveEvents() {
    return Array.from(this.activeEvents.values());
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return { ...this.statistics };
  }

  /**
   * Schedule notification for event
   */
  scheduleNotification(event, minutesBefore = 5) {
    const startTime = DateTime.fromISO(event.startTime);
    const notifyTime = startTime.minus({ minutes: minutesBefore });
    const now = DateTime.now();
    
    if (notifyTime <= now) {
      return null;
    }
    
    const delay = notifyTime.diff(now, 'milliseconds').milliseconds;
    
    const timeoutId = setTimeout(() => {
      this.emit('eventNotification', {
        event,
        minutesUntil: minutesBefore,
        message: `${event.title} starting in ${minutesBefore} minutes`
      });
      this.scheduledNotifications.delete(event.id);
    }, delay);
    
    this.scheduledNotifications.set(event.id, timeoutId);
    
    return notifyTime.toISO();
  }

  /**
   * Cancel scheduled notification
   */
  cancelNotification(eventId) {
    const timeoutId = this.scheduledNotifications.get(eventId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.scheduledNotifications.delete(eventId);
      return true;
    }
    return false;
  }

  /**
   * Clear all scheduled notifications
   */
  clearAllNotifications() {
    for (const timeoutId of this.scheduledNotifications.values()) {
      clearTimeout(timeoutId);
    }
    this.scheduledNotifications.clear();
  }
}

module.exports = CalendarEventProcessor;
