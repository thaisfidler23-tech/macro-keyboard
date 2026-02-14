/**
 * Profile Switcher - Handles automatic and manual profile switching
 *
 * This module coordinates between the ContextManager and existing ProfileManager
 * to provide smooth, intelligent profile transitions with proper state management.
 */

const EventEmitter = require('events');

class ProfileSwitcher extends EventEmitter {
  constructor(profileManager) {
    super();

    if (!profileManager) {
      throw new Error('ProfileManager instance required');
    }

    this.profileManager = profileManager;

    // State tracking
    this.currentProfile = null;
    this.previousProfile = null;
    this.switchingInProgress = false;
    this.autoSwitchingEnabled = true;
    this.manualOverride = false;

    // Switch history for analytics and rollback
    this.switchHistory = [];
    this.maxHistoryLength = 50;

    // Configuration
    this.config = {
      autoSwitching: true,
      smoothTransitions: true,
      transitionDelay: 500,
      confirmManualSwitches: false,
      rollbackTimeout: 30000,     // 30 seconds to rollback automatic switches
      priorityThreshold: 10       // Minimum priority difference to override
    };

    // Temporary profile stack for context-aware switching
    this.profileStack = [];

    // Statistics
    this.statistics = {
      totalSwitches: 0,
      automaticSwitches: 0,
      manualSwitches: 0,
      rollbacks: 0,
      failedSwitches: 0,
      startTime: new Date()
    };

    console.log('ProfileSwitcher initialized');
  }

  /**
   * Initialize the profile switcher with current profile
   */
  async initialize() {
    try {
      this.currentProfile = await this.profileManager.getActiveProfileName();
      console.log(`ProfileSwitcher initialized with active profile: ${this.currentProfile}`);

      this.emit('initialized', { currentProfile: this.currentProfile });
    } catch (error) {
      console.error('Error initializing ProfileSwitcher:', error);
      throw error;
    }
  }

  /**
   * Switch to a profile (automatic context-aware switching)
   */
  async switchToProfile(profileName, context = {}, priority = 0) {
    if (this.switchingInProgress) {
      console.log(`Profile switch to '${profileName}' skipped - switch already in progress`);
      return { success: false, reason: 'switch_in_progress' };
    }

    // Check if profile exists
    const profiles = await this.profileManager.getProfiles();
    if (!profiles[profileName]) {
      console.error(`Profile '${profileName}' does not exist`);
      return { success: false, reason: 'profile_not_found', profileName };
    }

    // Check if already on this profile
    if (this.currentProfile === profileName) {
      console.log(`Already on profile '${profileName}'`);
      return { success: true, reason: 'already_active', profileName };
    }

    // Check if auto-switching is enabled
    if (!this.autoSwitchingEnabled) {
      console.log(`Auto-switching disabled, ignoring switch to '${profileName}'`);
      return { success: false, reason: 'auto_switching_disabled' };
    }

    // Check manual override
    if (this.manualOverride) {
      console.log(`Manual override active, ignoring automatic switch to '${profileName}'`);
      return { success: false, reason: 'manual_override_active' };
    }

    // Check priority if there's an active context switch
    const topContext = this.profileStack[this.profileStack.length - 1];
    if (topContext && topContext.priority >= priority &&
        priority < this.config.priorityThreshold) {
      console.log(`Switch to '${profileName}' blocked by higher priority context (${topContext.priority} >= ${priority})`);
      return { success: false, reason: 'priority_blocked', currentPriority: topContext.priority, requestedPriority: priority };
    }

    console.log(`Switching to profile '${profileName}' with priority ${priority}`);

    this.switchingInProgress = true;

    try {
      // Record switch attempt
      const switchRecord = {
        id: Date.now(),
        from: this.currentProfile,
        to: profileName,
        context,
        priority,
        timestamp: new Date(),
        type: 'automatic',
        success: false
      };

      // Add smooth transition delay if enabled
      if (this.config.smoothTransitions && this.config.transitionDelay > 0) {
        await this.sleep(this.config.transitionDelay);
      }

      // Push current context to stack
      if (this.currentProfile) {
        this.profileStack.push({
          profileName: this.currentProfile,
          priority,
          context: { ...context },
          timestamp: new Date(),
          switchId: switchRecord.id
        });

        // Limit stack size
        if (this.profileStack.length > 10) {
          this.profileStack.shift();
        }
      }

      // Perform the actual profile switch
      const result = await this.profileManager.activateProfile(profileName);

      if (result.success) {
        // Update state
        this.previousProfile = this.currentProfile;
        this.currentProfile = profileName;

        // Update switch record
        switchRecord.success = true;
        switchRecord.duration = Date.now() - switchRecord.id;

        // Add to history
        this.addToHistory(switchRecord);

        // Update statistics
        this.statistics.totalSwitches++;
        this.statistics.automaticSwitches++;

        // Emit events
        this.emit('profile-switched', {
          from: this.previousProfile,
          to: this.currentProfile,
          context,
          priority,
          type: 'automatic',
          record: switchRecord
        });

        // Set up rollback timer for automatic switches
        if (this.config.rollbackTimeout > 0) {
          this.setupRollbackTimer(switchRecord);
        }

        console.log(`Successfully switched to profile '${profileName}'`);
        return { success: true, profileName, previous: this.previousProfile };
      }
      // Remove from stack on failure
      this.profileStack.pop();

      switchRecord.error = result.error;
      this.addToHistory(switchRecord);
      this.statistics.failedSwitches++;

      console.error(`Failed to switch to profile '${profileName}':`, result.error);
      return { success: false, reason: 'switch_failed', error: result.error };
    } catch (error) {
      // Remove from stack on error
      if (this.profileStack.length > 0) {
        this.profileStack.pop();
      }

      this.statistics.failedSwitches++;
      console.error(`Error switching to profile '${profileName}':`, error);

      return { success: false, reason: 'switch_error', error: error.message };
    } finally {
      this.switchingInProgress = false;
    }
  }

  /**
   * Manual profile switch (user-initiated)
   */
  async switchToProfileManually(profileName, options = {}) {
    console.log(`Manual switch to profile '${profileName}' requested`);

    // Check if profile exists
    const profiles = await this.profileManager.getProfiles();
    if (!profiles[profileName]) {
      console.error(`Profile '${profileName}' does not exist`);
      return { success: false, reason: 'profile_not_found', profileName };
    }

    // Show confirmation if enabled
    if (this.config.confirmManualSwitches && !options.skipConfirmation) {
      const confirmed = await this.confirmProfileSwitch(profileName);
      if (!confirmed) {
        return { success: false, reason: 'user_cancelled' };
      }
    }

    this.switchingInProgress = true;

    try {
      // Clear the profile stack and set manual override
      this.profileStack = [];
      this.manualOverride = true;

      // Record manual switch
      const switchRecord = {
        id: Date.now(),
        from: this.currentProfile,
        to: profileName,
        context: { manual: true, ...options.context },
        priority: 100, // Manual switches have highest priority
        timestamp: new Date(),
        type: 'manual',
        success: false
      };

      // Perform the switch
      const result = await this.profileManager.activateProfile(profileName);

      if (result.success) {
        this.previousProfile = this.currentProfile;
        this.currentProfile = profileName;

        switchRecord.success = true;
        switchRecord.duration = Date.now() - switchRecord.id;

        this.addToHistory(switchRecord);

        // Update statistics
        this.statistics.totalSwitches++;
        this.statistics.manualSwitches++;

        // Clear manual override after successful switch
        setTimeout(() => {
          this.manualOverride = false;
          console.log('Manual override cleared - automatic switching re-enabled');
        }, options.overrideDuration || 60000); // Clear after 1 minute by default

        this.emit('profile-switched', {
          from: this.previousProfile,
          to: this.currentProfile,
          type: 'manual',
          record: switchRecord
        });

        console.log(`Manual switch to profile '${profileName}' completed successfully`);
        return { success: true, profileName, previous: this.previousProfile };
      }
      this.manualOverride = false; // Clear override on failure

      switchRecord.error = result.error;
      this.addToHistory(switchRecord);
      this.statistics.failedSwitches++;

      console.error(`Manual switch to profile '${profileName}' failed:`, result.error);
      return { success: false, reason: 'switch_failed', error: result.error };
    } catch (error) {
      this.manualOverride = false; // Clear override on error
      this.statistics.failedSwitches++;

      console.error(`Error in manual switch to profile '${profileName}':`, error);
      return { success: false, reason: 'switch_error', error: error.message };
    } finally {
      this.switchingInProgress = false;
    }
  }

  /**
   * Pop back to previous profile in context stack
   */
  async popToPreviousProfile() {
    if (this.profileStack.length === 0) {
      console.log('No previous profile in stack');
      return { success: false, reason: 'no_previous_profile' };
    }

    const previousContext = this.profileStack.pop();
    console.log(`Popping back to profile '${previousContext.profileName}'`);

    return await this.switchToProfile(
      previousContext.profileName,
      previousContext.context,
      previousContext.priority
    );
  }

  /**
   * Rollback to previous profile (within rollback timeout)
   */
  async rollbackToPrevious() {
    if (!this.previousProfile) {
      console.log('No previous profile to rollback to');
      return { success: false, reason: 'no_previous_profile' };
    }

    console.log(`Rolling back to previous profile: ${this.previousProfile}`);

    const result = await this.switchToProfileManually(this.previousProfile, {
      context: { rollback: true },
      skipConfirmation: true
    });

    if (result.success) {
      this.statistics.rollbacks++;
      this.emit('profile-rollback', {
        from: this.currentProfile,
        to: this.previousProfile
      });
    }

    return result;
  }

  /**
   * Setup rollback timer for automatic switches
   */
  setupRollbackTimer(switchRecord) {
    setTimeout(() => {
      // Only show rollback if still on the same profile and it was automatic
      if (this.currentProfile === switchRecord.to && switchRecord.type === 'automatic') {
        this.emit('rollback-available', {
          switchRecord,
          rollbackTo: switchRecord.from,
          expiresIn: 10000 // Show for 10 seconds
        });
      }
    }, this.config.rollbackTimeout);
  }

  /**
   * Confirm profile switch (for manual switches)
   */
  async confirmProfileSwitch(profileName) {
    return new Promise((resolve) => {
      this.emit('confirmation-required', {
        profileName,
        currentProfile: this.currentProfile,
        callback: resolve
      });

      // Auto-confirm after timeout
      setTimeout(() => resolve(true), 10000);
    });
  }

  /**
   * Enable/disable automatic profile switching
   */
  setAutoSwitchingEnabled(enabled) {
    const wasEnabled = this.autoSwitchingEnabled;
    this.autoSwitchingEnabled = enabled;

    if (wasEnabled !== enabled) {
      console.log(`Automatic profile switching ${enabled ? 'enabled' : 'disabled'}`);
      this.emit('auto-switching-changed', { enabled });
    }
  }

  /**
   * Check if automatic switching is enabled
   */
  isAutoSwitchingEnabled() {
    return this.autoSwitchingEnabled && !this.manualOverride;
  }

  /**
   * Clear manual override
   */
  clearManualOverride() {
    if (this.manualOverride) {
      this.manualOverride = false;
      console.log('Manual override cleared');
      this.emit('manual-override-cleared');
    }
  }

  /**
   * Add switch record to history
   */
  addToHistory(record) {
    this.switchHistory.push(record);

    // Limit history size
    if (this.switchHistory.length > this.maxHistoryLength) {
      this.switchHistory.shift();
    }
  }

  /**
   * Get switch history
   */
  getSwitchHistory(limit = 20) {
    return this.switchHistory
      .slice(-limit)
      .reverse(); // Most recent first
  }

  /**
   * Get current profile information
   */
  getCurrentProfile() {
    return {
      current: this.currentProfile,
      previous: this.previousProfile,
      autoSwitchingEnabled: this.autoSwitchingEnabled,
      manualOverride: this.manualOverride,
      switchingInProgress: this.switchingInProgress,
      stackDepth: this.profileStack.length
    };
  }

  /**
   * Get profile stack (for debugging/monitoring)
   */
  getProfileStack() {
    return [...this.profileStack];
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const uptime = Date.now() - this.statistics.startTime.getTime();

    return {
      ...this.statistics,
      uptime,
      currentProfile: this.currentProfile,
      successRate: this.statistics.totalSwitches > 0 ?
        ((this.statistics.totalSwitches - this.statistics.failedSwitches) / this.statistics.totalSwitches) * 100 : 0,
      averageSwitchTime: this.calculateAverageSwitchTime(),
      suggestions: this.generateOptimizationSuggestions()
    };
  }

  /**
   * Calculate average switch time from history
   */
  calculateAverageSwitchTime() {
    const successfulSwitches = this.switchHistory.filter(s => s.success && s.duration);

    if (successfulSwitches.length === 0) {
      return 0;
    }

    const totalTime = successfulSwitches.reduce((sum, s) => sum + s.duration, 0);
    return Math.round(totalTime / successfulSwitches.length);
  }

  /**
   * Generate optimization suggestions based on usage patterns
   */
  generateOptimizationSuggestions() {
    const suggestions = [];

    // Check for frequent manual overrides
    const manualSwitches = this.switchHistory.filter(s => s.source === 'manual');
    if (manualSwitches.length > this.statistics.totalSwitches * 0.7) {
      suggestions.push({
        type: 'frequent_manual',
        description: 'High frequency of manual switches detected',
        recommendation: 'Consider adjusting automatic switching rules',
        percentage: Math.round((manualSwitches.length / this.statistics.totalSwitches) * 100)
      });
    }

    // Check for failed switches
    if (this.statistics.failedSwitches > 0) {
      suggestions.push({
        type: 'failed_switches',
        description: 'Some profile switches have failed',
        recommendation: 'Review profile configurations and dependencies',
        count: this.statistics.failedSwitches
      });
    }

    // Check for deep profile stack
    if (this.profileStack.length > 3) {
      suggestions.push({
        type: 'deep_stack',
        description: 'Profile stack is getting deep',
        recommendation: 'Consider simplifying context rules to reduce nesting',
        stackDepth: this.profileStack.length
      });
    }

    return suggestions;
  }

  /**
   * Update configuration
   */
  updateConfiguration(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.emit('configuration-updated', this.config);
    console.log('ProfileSwitcher configuration updated');
  }

  /**
   * Get current configuration
   */
  getConfiguration() {
    return { ...this.config };
  }

  /**
   * Sleep utility for smooth transitions
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get profile compatibility analysis
   */
  async analyzeProfileCompatibility() {
    try {
      const profiles = await this.profileManager.getProfiles();
      const analysis = {
        totalProfiles: Object.keys(profiles).length,
        compatibleProfiles: [],
        issues: []
      };

      // Analyze each profile for context switching compatibility
      Object.entries(profiles).forEach(([name, profile]) => {
        const profileAnalysis = {
          name,
          hasDescription: !!profile.description,
          buttonCount: profile.buttons ? Object.keys(profile.buttons).length : 0,
          isContextAware: false
        };

        // Check if profile has context-aware settings
        if (profile.metadata && profile.metadata.contextRules) {
          profileAnalysis.isContextAware = true;
        }

        analysis.compatibleProfiles.push(profileAnalysis);
      });

      return analysis;
    } catch (error) {
      console.error('Error analyzing profile compatibility:', error);
      return { error: error.message };
    }
  }

  /**
   * Suggest profile optimizations
   */
  suggestOptimizations() {
    const suggestions = [];

    // Analyze switch patterns
    const recentSwitches = this.switchHistory.slice(-20);
    const switchPatterns = {};

    recentSwitches.forEach(record => {
      const pattern = `${record.from}->${record.to}`;
      switchPatterns[pattern] = (switchPatterns[pattern] || 0) + 1;
    });

    // Find common patterns
    Object.entries(switchPatterns).forEach(([pattern, count]) => {
      if (count >= 3) {
        suggestions.push({
          type: 'frequent_pattern',
          description: `Frequent switching pattern detected: ${pattern}`,
          recommendation: 'Consider creating dedicated context rules for this pattern',
          frequency: count
        });
      }
    });

    // Check for failed switches
    const failedSwitches = this.switchHistory.filter(s => !s.success);
    if (failedSwitches.length > 0) {
      suggestions.push({
        type: 'failed_switches',
        description: `${failedSwitches.length} failed switches detected`,
        recommendation: 'Check profile configurations and dependencies',
        failureRate: (failedSwitches.length / this.switchHistory.length) * 100
      });
    }

    // Check stack depth patterns
    if (this.profileStack.length > 5) {
      suggestions.push({
        type: 'deep_stack',
        description: 'Profile stack is getting deep',
        recommendation: 'Consider simplifying context rules to reduce nesting',
        stackDepth: this.profileStack.length
      });
    }

    return suggestions;
  }

  /**
   * Enable automatic switching
   */
  enableAutomaticSwitching() {
    this.autoSwitchingEnabled = true;
    this.emit('autoSwitchingEnabled');
  }

  /**
   * Disable automatic switching
   */
  disableAutomaticSwitching() {
    this.autoSwitchingEnabled = false;
    this.emit('autoSwitchingDisabled');
  }

  /**
   * Check if automatic switching is enabled
   */
  isAutomaticSwitchingEnabled() {
    return this.autoSwitchingEnabled;
  }

  /**
   * Handle context changes from ContextManager
   */
  async handleContextChange(contextData) {
    if (!this.autoSwitchingEnabled) {
      return;
    }

    try {
      // Extract recommended profile from context data
      const recommendedProfile = contextData.recommendedProfile;
      if (recommendedProfile && recommendedProfile !== this.currentProfile) {
        await this.switchToProfile(recommendedProfile, 'context-rule');
      }
    } catch (error) {
      console.error('Error handling context change:', error);
      this.emit('error', { type: 'context_change', error });
    }
  }

  /**
   * Confirm current profile (cancels rollback timers)
   */
  async confirmCurrentProfile() {
    if (this.rollbackTimer) {
      clearTimeout(this.rollbackTimer);
      this.rollbackTimer = null;
      this.emit('rollbackCancelled', { profile: this.currentProfile });
    }
  }

  /**
   * Analyze compatibility between two profiles
   */
  analyzeProfileCompatibility(profile1, profile2) {
    // This is a placeholder implementation
    // In a real implementation, this would compare profile configurations
    return {
      compatibility: 'high',
      conflicts: [],
      recommendations: []
    };
  }
}

module.exports = ProfileSwitcher;
