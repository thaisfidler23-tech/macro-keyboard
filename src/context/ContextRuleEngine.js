/**
 * Context Rule Engine - Advanced rule evaluation system for context-aware profile switching
 * Evaluates application-based, window title-based, and time-based rules with priority handling
 */

const EventEmitter = require('events');

class ContextRuleEngine extends EventEmitter {
  constructor(logger, rules = {}) {
    super();
    
    this.logger = logger || {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {}
    };
    
    this.rules = {
      applicationBased: rules.applicationBased || {},
      windowTitleBased: { patterns: rules.windowTitleBased?.patterns || [] },
      timeBased: rules.timeBased || {},
      systemStateBased: rules.systemStateBased || {},
      combined: rules.combined || []
    };
    
    this.currentContext = null;
    this.evaluationHistory = [];
    this.maxHistorySize = 100;
    
    // Rule priorities (higher = more important)
    this.rulePriorities = {
      combined: 150,
      application: 100,
      windowTitle: 90,
      systemState: 80,
      time: 50
    };
    
    // Performance tracking
    this.statistics = {
      totalEvaluations: 0,
      ruleMatches: 0,
      averageEvaluationTime: 0,
      totalEvaluationTime: 0,
      lastEvaluation: null,
      ruleTypeMatches: {
        application: 0,
        windowTitle: 0,
        time: 0,
        systemState: 0,
        combined: 0
      }
    };
    
    this.logger.info('ContextRuleEngine initialized');
  }

  /**
   * Evaluate context and return the best matching profile
   */
  evaluateContext(applicationInfo, systemState = {}) {
    const startTime = Date.now();
    
    try {
      const context = {
        applicationInfo,
        systemState: {
          currentTime: new Date(),
          isIdle: systemState.isIdle || false,
          isLocked: systemState.isLocked || false,
          presentationMode: systemState.presentationMode || false,
          ...systemState
        },
        timestamp: Date.now()
      };

      const matchedRules = [];

      // Evaluate application-based rules
      const appRules = this.evaluateApplicationRules(context);
      matchedRules.push(...appRules);

      // Evaluate window title-based rules
      const windowRules = this.evaluateWindowTitleRules(context);
      matchedRules.push(...windowRules);

      // Evaluate time-based rules
      const timeRules = this.evaluateTimeBasedRules(context);
      matchedRules.push(...timeRules);

      // Evaluate system state-based rules
      const systemRules = this.evaluateSystemStateRules(context);
      matchedRules.push(...systemRules);

      // Evaluate combined rules
      const combinedRules = this.evaluateCombinedRules(context);
      matchedRules.push(...combinedRules);

      // Sort by priority and confidence
      const sortedRules = matchedRules.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return b.confidence - a.confidence;
      });

      // Select the best rule
      const bestRule = sortedRules.length > 0 ? sortedRules[0] : null;
      
      // Update statistics
      this.updateStatistics(startTime, matchedRules, bestRule);
      
      // Store evaluation in history
      this.addToHistory(context, matchedRules, bestRule);
      
      // Update current context
      this.currentContext = {
        ...context,
        matchedRules: matchedRules,
        selectedRule: bestRule,
        selectedProfile: bestRule?.profile || null
      };

      this.logger.debug('Context evaluation completed:', {
        rulesMatched: matchedRules.length,
        selectedProfile: bestRule?.profile || 'none',
        evaluationTime: Date.now() - startTime
      });

      this.emit('contextEvaluated', this.currentContext);
      
      return this.currentContext;
      
    } catch (error) {
      this.logger.error('Error during context evaluation:', error);
      return null;
    }
  }

  /**
   * Evaluate application-based rules
   */
  evaluateApplicationRules(context) {
    const matchedRules = [];
    
    if (!context.applicationInfo?.processName) {
      return matchedRules;
    }

    for (const [appPattern, profile] of Object.entries(this.rules.applicationBased)) {
      const match = this.matchesApplication(context.applicationInfo.processName, appPattern);
      
      if (match.isMatch) {
        matchedRules.push({
          type: 'application',
          pattern: appPattern,
          profile: profile,
          priority: this.rulePriorities.application,
          confidence: match.confidence,
          metadata: {
            processName: context.applicationInfo.processName,
            matchType: match.matchType,
            executablePath: context.applicationInfo.executablePath
          }
        });
        
        this.statistics.ruleTypeMatches.application++;
      }
    }
    
    return matchedRules;
  }

  /**
   * Evaluate window title-based rules
   */
  evaluateWindowTitleRules(context) {
    const matchedRules = [];
    
    if (!context.applicationInfo?.windowTitle) {
      return matchedRules;
    }

    for (const rule of this.rules.windowTitleBased.patterns) {
      let isMatch = false;
      let confidence = 0;
      let matchType = 'none';

      if (rule.regex && rule.regex instanceof RegExp) {
        const regexMatch = rule.regex.test(context.applicationInfo.windowTitle);
        if (regexMatch) {
          isMatch = true;
          confidence = 0.9;
          matchType = 'regex';
        }
      } else if (rule.contains) {
        const containsMatch = context.applicationInfo.windowTitle
          .toLowerCase()
          .includes(rule.contains.toLowerCase());
        if (containsMatch) {
          isMatch = true;
          confidence = 0.8;
          matchType = 'contains';
        }
      } else if (rule.exact) {
        const exactMatch = context.applicationInfo.windowTitle === rule.exact;
        if (exactMatch) {
          isMatch = true;
          confidence = 1.0;
          matchType = 'exact';
        }
      }

      if (isMatch) {
        matchedRules.push({
          type: 'windowTitle',
          pattern: rule,
          profile: rule.profile,
          priority: this.rulePriorities.windowTitle,
          confidence: confidence,
          metadata: {
            windowTitle: context.applicationInfo.windowTitle,
            matchType: matchType,
            rulePattern: rule.regex?.source || rule.contains || rule.exact
          }
        });
        
        this.statistics.ruleTypeMatches.windowTitle++;
      }
    }
    
    return matchedRules;
  }

  /**
   * Evaluate time-based rules
   */
  evaluateTimeBasedRules(context) {
    const matchedRules = [];
    const currentTime = context.systemState.currentTime;
    const hour = currentTime.getHours();
    const minute = currentTime.getMinutes();
    const dayOfWeek = currentTime.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDayName = dayNames[dayOfWeek];

    // Check work hours
    if (this.rules.timeBased.workHours) {
      const workHours = this.rules.timeBased.workHours;
      if (this.isTimeInRange(hour, minute, workHours.start, workHours.end)) {
        matchedRules.push({
          type: 'time',
          pattern: 'workHours',
          profile: workHours.profile,
          priority: this.rulePriorities.time,
          confidence: 0.7,
          metadata: {
            timeRange: `${workHours.start} - ${workHours.end}`,
            currentTime: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
          }
        });
        
        this.statistics.ruleTypeMatches.time++;
      }
    }

    // Check evening hours
    if (this.rules.timeBased.evenings) {
      const evenings = this.rules.timeBased.evenings;
      if (this.isTimeInRange(hour, minute, evenings.start, evenings.end)) {
        matchedRules.push({
          type: 'time',
          pattern: 'evenings',
          profile: evenings.profile,
          priority: this.rulePriorities.time,
          confidence: 0.7,
          metadata: {
            timeRange: `${evenings.start} - ${evenings.end}`,
            currentTime: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
          }
        });
        
        this.statistics.ruleTypeMatches.time++;
      }
    }

    // Check weekend rules
    if (this.rules.timeBased.weekends && this.rules.timeBased.weekends.days) {
      const weekendDays = this.rules.timeBased.weekends.days.map(day => day.toLowerCase());
      if (weekendDays.includes(currentDayName)) {
        matchedRules.push({
          type: 'time',
          pattern: 'weekends',
          profile: this.rules.timeBased.weekends.profile,
          priority: this.rulePriorities.time,
          confidence: 0.8,
          metadata: {
            dayOfWeek: currentDayName,
            weekendDays: weekendDays
          }
        });
        
        this.statistics.ruleTypeMatches.time++;
      }
    }

    // Check custom time rules
    if (this.rules.timeBased.custom) {
      for (const customRule of this.rules.timeBased.custom) {
        if (this.evaluateCustomTimeRule(customRule, currentTime)) {
          matchedRules.push({
            type: 'time',
            pattern: 'custom',
            profile: customRule.profile,
            priority: this.rulePriorities.time + (customRule.priority || 0),
            confidence: 0.8,
            metadata: {
              ruleName: customRule.name,
              conditions: customRule.conditions
            }
          });
          
          this.statistics.ruleTypeMatches.time++;
        }
      }
    }
    
    return matchedRules;
  }

  /**
   * Evaluate system state-based rules
   */
  evaluateSystemStateRules(context) {
    const matchedRules = [];
    
    for (const [stateName, rule] of Object.entries(this.rules.systemStateBased)) {
      let isMatch = false;
      let confidence = 0;

      switch (stateName) {
        case 'idle':
          if (context.systemState.isIdle && rule.when === 'idle') {
            isMatch = true;
            confidence = 0.9;
          } else if (!context.systemState.isIdle && rule.when === 'active') {
            isMatch = true;
            confidence = 0.9;
          }
          break;
          
        case 'locked':
          if (context.systemState.isLocked && rule.when === 'locked') {
            isMatch = true;
            confidence = 1.0;
          } else if (!context.systemState.isLocked && rule.when === 'unlocked') {
            isMatch = true;
            confidence = 1.0;
          }
          break;
          
        case 'presentation':
          if (context.systemState.presentationMode && rule.when === 'active') {
            isMatch = true;
            confidence = 1.0;
          } else if (!context.systemState.presentationMode && rule.when === 'inactive') {
            isMatch = true;
            confidence = 1.0;
          }
          break;
      }

      if (isMatch) {
        matchedRules.push({
          type: 'systemState',
          pattern: stateName,
          profile: rule.profile,
          priority: this.rulePriorities.systemState,
          confidence: confidence,
          metadata: {
            systemState: stateName,
            condition: rule.when,
            currentState: context.systemState
          }
        });
        
        this.statistics.ruleTypeMatches.systemState++;
      }
    }
    
    return matchedRules;
  }

  /**
   * Evaluate combined rules (multiple conditions)
   */
  evaluateCombinedRules(context) {
    const matchedRules = [];
    
    for (const combinedRule of this.rules.combined) {
      const conditionResults = [];
      
      // Evaluate each condition in the combined rule
      for (const condition of combinedRule.conditions || []) {
        const result = this.evaluateCondition(condition, context);
        conditionResults.push(result);
      }
      
      // Check if all conditions are met (AND logic) or any condition is met (OR logic)
      let isMatch = false;
      let averageConfidence = 0;
      
      if (combinedRule.operator === 'OR') {
        isMatch = conditionResults.some(result => result.isMatch);
        const matchingResults = conditionResults.filter(result => result.isMatch);
        averageConfidence = matchingResults.length > 0 
          ? matchingResults.reduce((sum, result) => sum + result.confidence, 0) / matchingResults.length
          : 0;
      } else { // Default to AND logic
        isMatch = conditionResults.every(result => result.isMatch);
        averageConfidence = conditionResults.length > 0
          ? conditionResults.reduce((sum, result) => sum + result.confidence, 0) / conditionResults.length
          : 0;
      }
      
      if (isMatch) {
        matchedRules.push({
          type: 'combined',
          pattern: combinedRule,
          profile: combinedRule.profile,
          priority: this.rulePriorities.combined + (combinedRule.priority || 0),
          confidence: averageConfidence,
          metadata: {
            ruleName: combinedRule.name,
            operator: combinedRule.operator || 'AND',
            conditionResults: conditionResults
          }
        });
        
        this.statistics.ruleTypeMatches.combined++;
      }
    }
    
    return matchedRules;
  }

  /**
   * Evaluate a single condition
   */
  evaluateCondition(condition, context) {
    switch (condition.type) {
      case 'application':
        if (context.applicationInfo?.processName) {
          const match = this.matchesApplication(context.applicationInfo.processName, condition.value);
          return { isMatch: match.isMatch, confidence: match.confidence };
        }
        break;
        
      case 'windowTitle':
        if (context.applicationInfo?.windowTitle && condition.regex) {
          const regex = new RegExp(condition.regex);
          const isMatch = regex.test(context.applicationInfo.windowTitle);
          return { isMatch, confidence: isMatch ? 0.9 : 0 };
        }
        break;
        
      case 'time':
        const currentTime = context.systemState.currentTime;
        if (condition.timeRange) {
          const [start, end] = condition.timeRange.split('-');
          const isMatch = this.isTimeInRange(currentTime.getHours(), currentTime.getMinutes(), start.trim(), end.trim());
          return { isMatch, confidence: isMatch ? 0.8 : 0 };
        }
        break;
        
      case 'systemState':
        const stateValue = context.systemState[condition.property];
        const isMatch = stateValue === condition.value;
        return { isMatch, confidence: isMatch ? 1.0 : 0 };
    }
    
    return { isMatch: false, confidence: 0 };
  }

  /**
   * Check if an application name matches a pattern
   */
  matchesApplication(processName, pattern) {
    if (!processName || !pattern) {
      return { isMatch: false, confidence: 0, matchType: 'none' };
    }

    const normalizedProcess = processName.toLowerCase().replace(/\s+/g, '');
    const normalizedPattern = pattern.toLowerCase().replace(/\s+/g, '');

    // Exact match
    if (normalizedProcess === normalizedPattern) {
      return { isMatch: true, confidence: 1.0, matchType: 'exact' };
    }

    // Contains match
    if (normalizedProcess.includes(normalizedPattern)) {
      return { isMatch: true, confidence: 0.8, matchType: 'contains' };
    }

    // Reverse contains match
    if (normalizedPattern.includes(normalizedProcess)) {
      return { isMatch: true, confidence: 0.7, matchType: 'reverse-contains' };
    }

    // Fuzzy match (remove common suffixes/prefixes)
    const processCore = normalizedProcess.replace(/\.(exe|app|bin)$/, '');
    const patternCore = normalizedPattern.replace(/\.(exe|app|bin)$/, '');
    
    if (processCore === patternCore) {
      return { isMatch: true, confidence: 0.9, matchType: 'core-match' };
    }

    return { isMatch: false, confidence: 0, matchType: 'none' };
  }

  /**
   * Check if current time is within a specified range
   */
  isTimeInRange(hour, minute, startTime, endTime) {
    const current = hour * 60 + minute;
    
    const [startHour, startMinute] = startTime.split(':').map(n => parseInt(n));
    const start = startHour * 60 + startMinute;
    
    const [endHour, endMinute] = endTime.split(':').map(n => parseInt(n));
    const end = endHour * 60 + endMinute;
    
    if (start <= end) {
      // Same day range
      return current >= start && current <= end;
    } else {
      // Overnight range
      return current >= start || current <= end;
    }
  }

  /**
   * Evaluate custom time rule
   */
  evaluateCustomTimeRule(rule, currentTime) {
    if (!rule.conditions) {
      return false;
    }

    for (const condition of rule.conditions) {
      if (condition.type === 'dayOfWeek') {
        const dayOfWeek = currentTime.getDay();
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const currentDayName = dayNames[dayOfWeek];
        
        if (!condition.days.map(d => d.toLowerCase()).includes(currentDayName)) {
          return false;
        }
      } else if (condition.type === 'timeRange') {
        const hour = currentTime.getHours();
        const minute = currentTime.getMinutes();
        
        if (!this.isTimeInRange(hour, minute, condition.start, condition.end)) {
          return false;
        }
      }
    }
    
    return true;
  }

  /**
   * Update performance statistics
   */
  updateStatistics(startTime, matchedRules, bestRule) {
    const evaluationTime = Date.now() - startTime;
    
    this.statistics.totalEvaluations++;
    this.statistics.totalEvaluationTime += evaluationTime;
    this.statistics.averageEvaluationTime = this.statistics.totalEvaluationTime / this.statistics.totalEvaluations;
    this.statistics.lastEvaluation = new Date();
    
    if (matchedRules.length > 0) {
      this.statistics.ruleMatches++;
    }
  }

  /**
   * Add evaluation to history
   */
  addToHistory(context, matchedRules, selectedRule) {
    const historyEntry = {
      timestamp: Date.now(),
      context: { ...context },
      matchedRules: [...matchedRules],
      selectedRule: selectedRule ? { ...selectedRule } : null
    };

    this.evaluationHistory.unshift(historyEntry);

    // Limit history size
    if (this.evaluationHistory.length > this.maxHistorySize) {
      this.evaluationHistory = this.evaluationHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Get current context
   */
  getCurrentContext() {
    return this.currentContext;
  }

  /**
   * Get evaluation history
   */
  getEvaluationHistory(limit = 10) {
    return this.evaluationHistory.slice(0, limit);
  }

  /**
   * Get performance statistics
   */
  getStatistics() {
    return { ...this.statistics };
  }

  /**
   * Reset statistics
   */
  resetStatistics() {
    this.statistics = {
      totalEvaluations: 0,
      ruleMatches: 0,
      averageEvaluationTime: 0,
      totalEvaluationTime: 0,
      lastEvaluation: null,
      ruleTypeMatches: {
        application: 0,
        windowTitle: 0,
        time: 0,
        systemState: 0,
        combined: 0
      }
    };
    
    this.emit('statisticsReset');
  }

  /**
   * Update rules
   */
  updateRules(newRules) {
    this.rules = {
      applicationBased: newRules.applicationBased || {},
      windowTitleBased: { patterns: newRules.windowTitleBased?.patterns || [] },
      timeBased: newRules.timeBased || {},
      systemStateBased: newRules.systemStateBased || {},
      combined: newRules.combined || []
    };
    
    this.logger.info('Context rules updated');
    this.emit('rulesUpdated', this.rules);
  }

  /**
   * Get current rules
   */
  getRules() {
    return { ...this.rules };
  }
}

module.exports = ContextRuleEngine;