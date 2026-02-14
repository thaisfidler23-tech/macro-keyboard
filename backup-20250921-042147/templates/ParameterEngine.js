/**
 * Parameter Substitution Engine for Macro Templates
 *
 * Handles dynamic parameter substitution in template sequences
 * Supports various parameter types and validation
 */
class ParameterEngine {
  constructor(logger) {
    this.logger = logger;

    // Parameter type handlers
    this.typeHandlers = {
      'text': this.handleTextParameter.bind(this),
      'number': this.handleNumberParameter.bind(this),
      'select': this.handleSelectParameter.bind(this),
      'boolean': this.handleBooleanParameter.bind(this),
      'file': this.handleFileParameter.bind(this),
      'application': this.handleApplicationParameter.bind(this),
      'key_combination': this.handleKeyCombinationParameter.bind(this),
      'list': this.handleListParameter.bind(this)
    };

    this.logger.debug('ParameterEngine initialized');
  }

  /**
   * Substitute parameters in a template sequence
   */
  async substituteParameters(sequence, parameterDefs = [], parameterValues = {}) {
    try {
      // Create parameter map for quick lookup
      const paramMap = new Map();
      for (const param of parameterDefs) {
        paramMap.set(param.name, param);
      }

      // Process each step in the sequence
      const processedSequence = [];

      for (const step of sequence) {
        const processedStep = await this.processStep(step, paramMap, parameterValues);

        // Handle conditional steps
        if (processedStep.condition) {
          const shouldInclude = await this.evaluateCondition(
            processedStep.condition,
            paramMap,
            parameterValues
          );

          if (!shouldInclude) {
            this.logger.debug(`Skipping step due to condition: ${JSON.stringify(processedStep.condition)}`);
            continue;
          }
        }

        // Handle multiple steps from list parameters
        if (Array.isArray(processedStep)) {
          processedSequence.push(...processedStep);
        } else {
          processedSequence.push(processedStep);
        }
      }

      this.logger.debug(`Parameter substitution completed. ${sequence.length} -> ${processedSequence.length} steps`);
      return processedSequence;
    } catch (error) {
      this.logger.error('Parameter substitution failed:', error);
      throw error;
    }
  }

  /**
   * Process a single step with parameter substitution
   */
  async processStep(step, paramMap, parameterValues) {
    const processedStep = { ...step };

    // Substitute parameters in all string fields
    for (const [key, value] of Object.entries(processedStep)) {
      if (typeof value === 'string') {
        processedStep[key] = await this.substituteInString(value, paramMap, parameterValues);
      } else if (Array.isArray(value)) {
        processedStep[key] = await Promise.all(
          value.map(item =>
            typeof item === 'string'
              ? this.substituteInString(item, paramMap, parameterValues)
              : item
          )
        );
      }
    }

    // Handle special parameter types that generate multiple steps
    if (processedStep.parameterExpansion) {
      return await this.expandParameterSteps(processedStep, paramMap, parameterValues);
    }

    return processedStep;
  }

  /**
   * Substitute parameter placeholders in a string
   */
  async substituteInString(str, paramMap, parameterValues) {
    // Match parameter placeholders like {{param_name}} or {{param_name|default_value}}
    const parameterRegex = /\{\{([^}|]+)(\|([^}]+))?\}\}/g;

    let result = str;
    let match;

    while ((match = parameterRegex.exec(str)) !== null) {
      const paramName = match[1].trim();
      const defaultValue = match[3]?.trim();
      const fullMatch = match[0];

      try {
        let substitutedValue;

        if (parameterValues.hasOwnProperty(paramName)) {
          // Use provided parameter value
          const paramDef = paramMap.get(paramName);
          substitutedValue = await this.processParameterValue(
            parameterValues[paramName],
            paramDef
          );
        } else if (defaultValue) {
          // Use default value
          substitutedValue = defaultValue;
        } else {
          // Use parameter default if available
          const paramDef = paramMap.get(paramName);
          if (paramDef && paramDef.default !== undefined) {
            substitutedValue = await this.processParameterValue(
              paramDef.default,
              paramDef
            );
          } else {
            throw new Error(`No value provided for required parameter: ${paramName}`);
          }
        }

        result = result.replace(fullMatch, String(substitutedValue));
      } catch (error) {
        this.logger.error(`Failed to substitute parameter ${paramName}:`, error);
        throw error;
      }
    }

    return result;
  }

  /**
   * Process a parameter value based on its type
   */
  async processParameterValue(value, paramDef) {
    if (!paramDef) {
      return value;
    }

    const handler = this.typeHandlers[paramDef.type];
    if (handler) {
      return await handler(value, paramDef);
    }

    this.logger.warn(`Unknown parameter type: ${paramDef.type}, using raw value`);
    return value;
  }

  /**
   * Handle text parameter type
   */
  async handleTextParameter(value, paramDef) {
    let result = String(value);

    // Apply text transformations
    if (paramDef.transform) {
      switch (paramDef.transform) {
      case 'uppercase':
        result = result.toUpperCase();
        break;
      case 'lowercase':
        result = result.toLowerCase();
        break;
      case 'title':
        result = result.replace(/\w\S*/g, (txt) =>
          txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
        break;
      }
    }

    // Apply length limits
    if (paramDef.maxLength && result.length > paramDef.maxLength) {
      result = result.substring(0, paramDef.maxLength);
    }

    return result;
  }

  /**
   * Handle number parameter type
   */
  async handleNumberParameter(value, paramDef) {
    const num = Number(value);

    if (isNaN(num)) {
      throw new Error(`Invalid number value: ${value}`);
    }

    // Apply range limits
    if (paramDef.min !== undefined && num < paramDef.min) {
      return paramDef.min;
    }

    if (paramDef.max !== undefined && num > paramDef.max) {
      return paramDef.max;
    }

    return num;
  }

  /**
   * Handle select parameter type
   */
  async handleSelectParameter(value, paramDef) {
    if (paramDef.options && !paramDef.options.includes(value)) {
      throw new Error(`Invalid select value: ${value}. Must be one of: ${paramDef.options.join(', ')}`);
    }

    return value;
  }

  /**
   * Handle boolean parameter type
   */
  async handleBooleanParameter(value, paramDef) {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase();
      if (['true', '1', 'yes', 'on'].includes(lowerValue)) {
        return true;
      }
      if (['false', '0', 'no', 'off'].includes(lowerValue)) {
        return false;
      }
    }

    throw new Error(`Invalid boolean value: ${value}`);
  }

  /**
   * Handle file parameter type
   */
  async handleFileParameter(value, paramDef) {
    const fs = require('fs').promises;
    const path = require('path');

    try {
      // Resolve relative paths
      const resolvedPath = path.resolve(value);

      // Check if file exists
      await fs.access(resolvedPath);

      // Check file extension if specified
      if (paramDef.extensions) {
        const ext = path.extname(resolvedPath).toLowerCase();
        if (!paramDef.extensions.includes(ext)) {
          throw new Error(`Invalid file extension: ${ext}. Allowed: ${paramDef.extensions.join(', ')}`);
        }
      }

      return resolvedPath;
    } catch (error) {
      throw new Error(`File parameter error: ${error.message}`);
    }
  }

  /**
   * Handle application parameter type
   */
  async handleApplicationParameter(value, paramDef) {
    // On different platforms, applications might have different names/paths
    const platform = process.platform;

    if (paramDef.platformMappings && paramDef.platformMappings[platform]) {
      const mapping = paramDef.platformMappings[platform][value];
      if (mapping) {
        return mapping;
      }
    }

    return value;
  }

  /**
   * Handle key combination parameter type
   */
  async handleKeyCombinationParameter(value, paramDef) {
    // Validate key combination format
    const validKeys = ['cmd', 'ctrl', 'alt', 'shift', 'option', 'meta'];
    const parts = value.split('+').map(part => part.trim().toLowerCase());

    // Check for valid modifier keys
    for (const part of parts.slice(0, -1)) {
      if (!validKeys.includes(part)) {
        this.logger.warn(`Potentially invalid modifier key: ${part}`);
      }
    }

    // Platform-specific key mapping
    const platform = process.platform;
    if (platform === 'darwin') {
      // macOS: map 'ctrl' to 'cmd' in some contexts
      value = value.replace(/ctrl\+/gi, 'cmd+');
    } else if (platform === 'win32') {
      // Windows: map 'cmd' to 'ctrl'
      value = value.replace(/cmd\+/gi, 'ctrl+');
    }

    return value;
  }

  /**
   * Handle list parameter type
   */
  async handleListParameter(value, paramDef) {
    if (!Array.isArray(value)) {
      // Try to parse as comma-separated values
      if (typeof value === 'string') {
        value = value.split(',').map(item => item.trim());
      } else {
        throw new Error('List parameter must be an array or comma-separated string');
      }
    }

    // Apply list constraints
    if (paramDef.minItems && value.length < paramDef.minItems) {
      throw new Error(`List must have at least ${paramDef.minItems} items`);
    }

    if (paramDef.maxItems && value.length > paramDef.maxItems) {
      value = value.slice(0, paramDef.maxItems);
    }

    return value;
  }

  /**
   * Expand parameter steps for list parameters
   */
  async expandParameterSteps(step, paramMap, parameterValues) {
    const expandedSteps = [];

    // Find list parameters in the step
    for (const [paramName, paramValue] of Object.entries(parameterValues)) {
      const paramDef = paramMap.get(paramName);

      if (paramDef && paramDef.type === 'list' && step.expandParameter === paramName) {
        const listValue = await this.processParameterValue(paramValue, paramDef);

        // Create a step for each list item
        for (const item of listValue) {
          const expandedStep = { ...step };
          delete expandedStep.expandParameter;
          delete expandedStep.parameterExpansion;

          // Replace the list parameter with the individual item
          const itemValues = { ...parameterValues, [paramName]: item };

          // Process the step with the individual item
          for (const [key, value] of Object.entries(expandedStep)) {
            if (typeof value === 'string') {
              expandedStep[key] = await this.substituteInString(value, paramMap, itemValues);
            }
          }

          expandedSteps.push(expandedStep);
        }

        break; // Only expand one parameter per step
      }
    }

    return expandedSteps.length > 0 ? expandedSteps : [step];
  }

  /**
   * Evaluate conditional expressions
   */
  async evaluateCondition(condition, paramMap, parameterValues) {
    if (!condition) {
      return true;
    }

    try {
      // Simple condition evaluation
      if (typeof condition === 'string') {
        // Handle simple existence checks
        return parameterValues.hasOwnProperty(condition) && parameterValues[condition];
      }

      if (typeof condition === 'object') {
        const { parameter, operator, value } = condition;
        const paramValue = parameterValues[parameter];

        switch (operator) {
        case 'equals':
          return paramValue === value;
        case 'not_equals':
          return paramValue !== value;
        case 'greater_than':
          return Number(paramValue) > Number(value);
        case 'less_than':
          return Number(paramValue) < Number(value);
        case 'contains':
          return String(paramValue).includes(String(value));
        case 'exists':
          return paramValue !== undefined && paramValue !== null && paramValue !== '';
        case 'not_exists':
          return paramValue === undefined || paramValue === null || paramValue === '';
        default:
          this.logger.warn(`Unknown condition operator: ${operator}`);
          return true;
        }
      }

      return true;
    } catch (error) {
      this.logger.error('Condition evaluation failed:', error);
      return false;
    }
  }

  /**
   * Get available parameter types
   */
  getAvailableTypes() {
    return Object.keys(this.typeHandlers);
  }

  /**
   * Validate parameter definition
   */
  validateParameterDefinition(paramDef) {
    const errors = [];

    if (!paramDef.name || typeof paramDef.name !== 'string') {
      errors.push('Parameter name is required and must be a string');
    }

    if (!paramDef.type || !this.typeHandlers[paramDef.type]) {
      errors.push(`Invalid parameter type: ${paramDef.type}`);
    }

    // Type-specific validation
    if (paramDef.type === 'select' && !paramDef.options) {
      errors.push('Select parameter must have options array');
    }

    if (paramDef.type === 'number') {
      if (paramDef.min !== undefined && paramDef.max !== undefined && paramDef.min > paramDef.max) {
        errors.push('Number parameter min value cannot be greater than max value');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = ParameterEngine;
