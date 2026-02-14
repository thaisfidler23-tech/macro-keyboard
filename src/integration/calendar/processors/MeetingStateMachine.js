/**
 * Meeting State Machine
 * 
 * Manages meeting states and transitions for context-aware behavior.
 * Tracks meeting lifecycle from pre-meeting to post-meeting states.
 * 
 * @module MeetingStateMachine
 */

const EventEmitter = require('events');
const { DateTime } = require('luxon');

/**
 * Meeting states
 */
const MeetingState = {
  IDLE: 'idle',
  PRE_MEETING: 'pre_meeting',
  JOINING: 'joining',
  IN_MEETING: 'in_meeting',
  ON_BREAK: 'on_break',
  ENDING: 'ending',
  POST_MEETING: 'post_meeting'
};

/**
 * Valid state transitions
 */
const VALID_TRANSITIONS = {
  [MeetingState.IDLE]: [MeetingState.PRE_MEETING],
  [MeetingState.PRE_MEETING]: [MeetingState.JOINING, MeetingState.IDLE],
  [MeetingState.JOINING]: [MeetingState.IN_MEETING, MeetingState.IDLE],
  [MeetingState.IN_MEETING]: [MeetingState.ON_BREAK, MeetingState.ENDING],
  [MeetingState.ON_BREAK]: [MeetingState.IN_MEETING, MeetingState.ENDING],
  [MeetingState.ENDING]: [MeetingState.POST_MEETING],
  [MeetingState.POST_MEETING]: [MeetingState.IDLE, MeetingState.PRE_MEETING]
};

class MeetingStateMachine extends EventEmitter {
  constructor(logger, config = {}) {
    super();
    
    this.logger = logger;
    this.config = {
      preMeetingBuffer: config.preMeetingBuffer || 5, // minutes
      postMeetingBuffer: config.postMeetingBuffer || 2, // minutes
      joiningTimeout: config.joiningTimeout || 5, // minutes
      autoTransitionEnabled: config.autoTransitionEnabled !== false,
      ...config
    };
    
    this.currentState = MeetingState.IDLE;
    this.currentMeeting = null;
    this.stateHistory = [];
    this.transitionTimers = new Map();
    
    this.statistics = {
      meetingsAttended: 0,
      totalMeetingTime: 0,
      stateTransitions: 0,
      averageMeetingDuration: 0
    };
  }

  /**
   * Get current state
   */
  getState() {
    return this.currentState;
  }

  /**
   * Get current meeting
   */
  getCurrentMeeting() {
    return this.currentMeeting;
  }

  /**
   * Transition to a new state
   */
  transition(newState, data = {}) {
    // Validate transition
    if (!this._isValidTransition(this.currentState, newState)) {
      this.logger?.warn('Invalid state transition', {
        from: this.currentState,
        to: newState
      });
      return false;
    }
    
    const previousState = this.currentState;
    const timestamp = DateTime.now();
    
    // Record state history
    this.stateHistory.push({
      from: previousState,
      to: newState,
      timestamp: timestamp.toISO(),
      data
    });
    
    // Trim history if too long
    if (this.stateHistory.length > 100) {
      this.stateHistory = this.stateHistory.slice(-100);
    }
    
    // Update state
    this.currentState = newState;
    this.statistics.stateTransitions++;
    
    // Handle state-specific logic
    this._handleStateEntry(newState, data);
    
    // Emit transition event
    this.emit('transition', {
      from: previousState,
      to: newState,
      timestamp: timestamp.toISO(),
      meeting: this.currentMeeting,
      data
    });
    
    this.logger?.info('Meeting state transition', { from: previousState, to: newState });
    
    return true;
  }

  /**
   * Check if transition is valid
   */
  _isValidTransition(from, to) {
    const validNextStates = VALID_TRANSITIONS[from] || [];
    return validNextStates.includes(to);
  }

  /**
   * Handle state entry
   */
  _handleStateEntry(state, data) {
    // Clear any existing timers for this state
    this._clearTransitionTimers();
    
    switch (state) {
      case MeetingState.PRE_MEETING:
        this._handlePreMeeting(data);
        break;
      case MeetingState.JOINING:
        this._handleJoining(data);
        break;
      case MeetingState.IN_MEETING:
        this._handleInMeeting(data);
        break;
      case MeetingState.ON_BREAK:
        this._handleOnBreak(data);
        break;
      case MeetingState.ENDING:
        this._handleEnding(data);
        break;
      case MeetingState.POST_MEETING:
        this._handlePostMeeting(data);
        break;
      case MeetingState.IDLE:
        this._handleIdle(data);
        break;
    }
  }

  /**
   * Handle pre-meeting state
   */
  _handlePreMeeting(data) {
    if (data.meeting) {
      this.currentMeeting = {
        ...data.meeting,
        stateEnteredAt: DateTime.now().toISO()
      };
    }
    
    this.emit('preMeeting', {
      meeting: this.currentMeeting,
      minutesUntilStart: data.minutesUntilStart || this.config.preMeetingBuffer
    });
    
    // Auto-transition to joining when meeting starts
    if (this.config.autoTransitionEnabled && this.currentMeeting) {
      const startTime = DateTime.fromISO(this.currentMeeting.startTime);
      const now = DateTime.now();
      const delay = Math.max(0, startTime.diff(now, 'milliseconds').milliseconds);
      
      const timer = setTimeout(() => {
        this.transition(MeetingState.JOINING);
      }, delay);
      
      this.transitionTimers.set('start', timer);
    }
  }

  /**
   * Handle joining state
   */
  _handleJoining(data) {
    this.emit('joining', { meeting: this.currentMeeting });
    
    // Auto-transition timeout
    if (this.config.autoTransitionEnabled) {
      const timer = setTimeout(() => {
        // If still in joining state, assume joined
        if (this.currentState === MeetingState.JOINING) {
          this.transition(MeetingState.IN_MEETING);
        }
      }, this.config.joiningTimeout * 60 * 1000);
      
      this.transitionTimers.set('joining-timeout', timer);
    }
  }

  /**
   * Handle in-meeting state
   */
  _handleInMeeting(data) {
    if (this.currentMeeting) {
      this.currentMeeting.joinedAt = DateTime.now().toISO();
    }
    
    this.emit('inMeeting', { meeting: this.currentMeeting });
    
    // Auto-transition when meeting ends
    if (this.config.autoTransitionEnabled && this.currentMeeting) {
      const endTime = DateTime.fromISO(this.currentMeeting.endTime);
      const now = DateTime.now();
      const delay = Math.max(0, endTime.diff(now, 'milliseconds').milliseconds);
      
      const timer = setTimeout(() => {
        this.transition(MeetingState.ENDING);
      }, delay);
      
      this.transitionTimers.set('end', timer);
    }
  }

  /**
   * Handle on-break state
   */
  _handleOnBreak(data) {
    this.emit('onBreak', {
      meeting: this.currentMeeting,
      breakDuration: data.breakDuration || 5
    });
  }

  /**
   * Handle ending state
   */
  _handleEnding(data) {
    this.emit('ending', { meeting: this.currentMeeting });
    
    // Auto-transition to post-meeting
    if (this.config.autoTransitionEnabled) {
      const timer = setTimeout(() => {
        this.transition(MeetingState.POST_MEETING);
      }, 30000); // 30 seconds
      
      this.transitionTimers.set('post', timer);
    }
  }

  /**
   * Handle post-meeting state
   */
  _handlePostMeeting(data) {
    if (this.currentMeeting) {
      this.currentMeeting.endedAt = DateTime.now().toISO();
      
      // Calculate meeting duration
      if (this.currentMeeting.joinedAt) {
        const joined = DateTime.fromISO(this.currentMeeting.joinedAt);
        const ended = DateTime.fromISO(this.currentMeeting.endedAt);
        const durationMinutes = ended.diff(joined, 'minutes').minutes;
        
        this.statistics.meetingsAttended++;
        this.statistics.totalMeetingTime += durationMinutes;
        this.statistics.averageMeetingDuration = 
          this.statistics.totalMeetingTime / this.statistics.meetingsAttended;
      }
    }
    
    this.emit('postMeeting', { meeting: this.currentMeeting });
    
    // Auto-transition back to idle
    if (this.config.autoTransitionEnabled) {
      const timer = setTimeout(() => {
        this.transition(MeetingState.IDLE);
      }, this.config.postMeetingBuffer * 60 * 1000);
      
      this.transitionTimers.set('idle', timer);
    }
  }

  /**
   * Handle idle state
   */
  _handleIdle(data) {
    this.currentMeeting = null;
    this.emit('idle');
  }

  /**
   * Clear transition timers
   */
  _clearTransitionTimers() {
    for (const timer of this.transitionTimers.values()) {
      clearTimeout(timer);
    }
    this.transitionTimers.clear();
  }

  /**
   * Start meeting (convenience method)
   */
  startMeeting(meeting) {
    if (this.currentState === MeetingState.IDLE) {
      return this.transition(MeetingState.PRE_MEETING, { meeting });
    }
    return false;
  }

  /**
   * Join meeting (convenience method)
   */
  joinMeeting() {
    if (this.currentState === MeetingState.PRE_MEETING || 
        this.currentState === MeetingState.JOINING) {
      return this.transition(MeetingState.IN_MEETING);
    }
    return false;
  }

  /**
   * Take break (convenience method)
   */
  takeBreak(duration = 5) {
    if (this.currentState === MeetingState.IN_MEETING) {
      return this.transition(MeetingState.ON_BREAK, { breakDuration: duration });
    }
    return false;
  }

  /**
   * Return from break (convenience method)
   */
  returnFromBreak() {
    if (this.currentState === MeetingState.ON_BREAK) {
      return this.transition(MeetingState.IN_MEETING);
    }
    return false;
  }

  /**
   * End meeting (convenience method)
   */
  endMeeting() {
    if (this.currentState === MeetingState.IN_MEETING || 
        this.currentState === MeetingState.ON_BREAK) {
      return this.transition(MeetingState.ENDING);
    }
    return false;
  }

  /**
   * Cancel meeting (convenience method)
   */
  cancelMeeting() {
    if (this.currentState !== MeetingState.IDLE) {
      this._clearTransitionTimers();
      this.currentState = MeetingState.IDLE;
      this.currentMeeting = null;
      this.emit('cancelled');
      return true;
    }
    return false;
  }

  /**
   * Get state history
   */
  getHistory() {
    return [...this.stateHistory];
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return { ...this.statistics };
  }

  /**
   * Check if in meeting
   */
  isInMeeting() {
    return this.currentState === MeetingState.IN_MEETING ||
           this.currentState === MeetingState.ON_BREAK;
  }

  /**
   * Check if meeting is active (including pre/post)
   */
  isMeetingActive() {
    return this.currentState !== MeetingState.IDLE;
  }

  /**
   * Reset state machine
   */
  reset() {
    this._clearTransitionTimers();
    this.currentState = MeetingState.IDLE;
    this.currentMeeting = null;
    this.stateHistory = [];
    this.emit('reset');
  }
}

// Export states for external use
MeetingStateMachine.States = MeetingState;

module.exports = MeetingStateMachine;
