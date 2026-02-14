const Ajv = require('ajv');
const addFormats = require('ajv-formats');

/**
 * Template Validation System
 *
 * Validates template structure, parameters, and sequence data
 * Ensures templates meet quality standards and compatibility requirements
 */
class TemplateValidator {
  constructor(logger) {
    this.logger = logger;

    // Initialize JSON schema validator
    this.ajv = new Ajv({ allErrors: true });
    addFormats(this.ajv);

    // Template schema
    this.templateSchema = {
      type: 'object',
      required: ['id', 'name', 'description', 'sequence'],
      properties: {
        id: {
          type: 'string',
          pattern: '^[a-zA-Z0-9_-]+$',
          minLength: 1,
          maxLength: 100
        },
        name: {
          type: 'string',
          minLength: 1,
          maxLength: 200
        },
        description: {
          type: 'string',
          minLength: 1,
          maxLength: 1000
        },
        category: {
          type: 'string',
          enum: ['productivity', 'gaming', 'development', 'content_creation', 'user']
        },
        author: {
          type: 'string',
          maxLength: 100
        },
        version: {
          type: 'string',
          pattern: '^\\d+\\.\\d+\\.\\d+$'
        },
        tags: {
          type: 'array',
          items: {
            type: 'string',
            maxLength: 50
          },
          maxItems: 20
        },
        parameters: {
          type: 'array',
          items: { $ref: '#/definitions/parameter' }
        },
        sequence: {
          type: 'array',
          items: { $ref: '#/definitions/sequenceStep' },
          minItems: 1,
          maxItems: 1000
        },
        requirements: {
          type: 'object',
          properties: {
            platforms: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['windows', 'macos', 'linux']
              }
            },
            applications: {
              type: 'array',
              items: { type: 'string' }
            },
            hardware: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['basic', 'encoders', 'leds']
              }
            }
          }
        }
      },
      definitions: {
        parameter: {
          type: 'object',
          required: ['name', 'type'],
          properties: {
            name: {
              type: 'string',
              pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$',
              maxLength: 50
            },
            type: {
              type: 'string',
              enum: [
                'text',
                'number',
                'select',
                'boolean',
                'file',
                'application',
                'key_combination',
                'list'
              ]
            },
            description: {
              type: 'string',
              maxLength: 500
            },
            default: {},
            required: {
              type: 'boolean',
              default: false
            },
            // Type-specific properties
            options: {
              type: 'array',
              items: { type: 'string' }
            },
            min: { type: 'number' },
            max: { type: 'number' },
            minLength: { type: 'integer', minimum: 0 },
            maxLength: { type: 'integer', minimum: 1 },
            extensions: {
              type: 'array',
              items: { type: 'string' }
            },
            platformMappings: {
              type: 'object',
              patternProperties: {
                '^(windows|macos|linux)$': {
                  type: 'object',
                  additionalProperties: { type: 'string' }
                }
              }
            },
            minItems: { type: 'integer', minimum: 0 },
            maxItems: { type: 'integer', minimum: 1 }
          }
        },
        sequenceStep: {
          type: 'object',
          required: ['type', 'action'],
          properties: {
            type: {
              type: 'string',
              enum: [
                'keypress',
                'command',
                'application',
                'delay',
                'macro_sequence',
                'text_input',
                'mouse_action'
              ]
            },
            action: { type: 'string' },
            delay: {
              type: 'integer',
              minimum: 0,
              maximum: 60000
            },
            description: {
              type: 'string',
              maxLength: 200
            },
            condition: {
              oneOf: [
                { type: 'string' },
                {
                  type: 'object',
                  required: ['parameter', 'operator'],
                  properties: {
                    parameter: { type: 'string' },
                    operator: {
                      type: 'string',
                      enum: [
                        'equals',
                        'not_equals',
                        'greater_than',
                        'less_than',
                        'contains',
                        'exists',
                        'not_exists'
                      ]
                    },
                    value: {}
                  }
                }
              ]
            },
            expandParameter: { type: 'string' },
            parameterExpansion: { type: 'boolean' },
            // Action-specific properties
            coordinates: {
              type: 'object',
              required: ['x', 'y'],
              properties: {
                x: { type: 'integer' },
                y: { type: 'integer' }
              }
            },
            text: { type: 'string' },
            options: {
              type: 'object',
              additionalProperties: true
            }
          }
        }
      }
    };

    // Compile schema
    this.validateTemplateSchema = this.ajv.compile(this.templateSchema);

    this.logger.debug('TemplateValidator initialized');
  }

  /**
   * Validate a complete template
   */
  validateTemplate(template) {
    const errors = [];

    try {
      // Schema validation
      const schemaValid = this.validateTemplateSchema(template);
      if (!schemaValid) {
        errors.push(...this.formatValidationErrors(this.validateTemplateSchema.errors));
      }

      // Additional custom validations
      const customValidation = this.validateCustomRules(template);
      if (!customValidation.valid) {
        errors.push(...customValidation.errors);
      }

      // Parameter validation
      if (template.parameters) {
        const paramValidation = this.validateParameterDefinitions(template.parameters);
        if (!paramValidation.valid) {
          errors.push(...paramValidation.errors);
        }
      }

      // Sequence validation
      const sequenceValidation = this.validateSequence(
        template.sequence,
        template.parameters || []
      );
      if (!sequenceValidation.valid) {
        errors.push(...sequenceValidation.errors);
      }

      // Platform compatibility validation
      if (template.requirements) {
        const compatibilityValidation = this.validateCompatibility(template.requirements);
        if (!compatibilityValidation.valid) {
          errors.push(...compatibilityValidation.errors);
        }
      }
    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: this.generateWarnings(template)
    };
  }

  /**
   * Validate parameter definitions
   */
  validateParameterDefinitions(parameters) {
    const errors = [];
    const paramNames = new Set();

    for (let i = 0; i < parameters.length; i++) {
      const param = parameters[i];

      // Check for duplicate parameter names
      if (paramNames.has(param.name)) {
        errors.push(`Duplicate parameter name: ${param.name}`);
      } else {
        paramNames.add(param.name);
      }

      // Type-specific validation
      const typeValidation = this.validateParameterType(param, i);
      if (!typeValidation.valid) {
        errors.push(...typeValidation.errors);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate individual parameter type
   */
  validateParameterType(param, index) {
    const errors = [];
    const prefix = `Parameter ${index} (${param.name || 'unnamed'})`;

    switch (param.type) {
      case 'select':
        if (!param.options || !Array.isArray(param.options) || param.options.length === 0) {
          errors.push(`${prefix}: Select parameter must have options array`);
        }
        if (param.default && param.options && !param.options.includes(param.default)) {
          errors.push(`${prefix}: Default value must be one of the options`);
        }
        break;

      case 'number':
        if (param.min !== undefined && param.max !== undefined && param.min > param.max) {
          errors.push(`${prefix}: min value cannot be greater than max value`);
        }
        if (param.default !== undefined && typeof param.default !== 'number') {
          errors.push(`${prefix}: Default value must be a number`);
        }
        break;

      case 'boolean':
        if (param.default !== undefined && typeof param.default !== 'boolean') {
          errors.push(`${prefix}: Default value must be a boolean`);
        }
        break;

      case 'text':
        if (
          param.minLength !== undefined &&
          param.maxLength !== undefined &&
          param.minLength > param.maxLength
        ) {
          errors.push(`${prefix}: minLength cannot be greater than maxLength`);
        }
        break;

      case 'list':
        if (
          param.minItems !== undefined &&
          param.maxItems !== undefined &&
          param.minItems > param.maxItems
        ) {
          errors.push(`${prefix}: minItems cannot be greater than maxItems`);
        }
        if (param.default && !Array.isArray(param.default)) {
          errors.push(`${prefix}: Default value must be an array for list parameter`);
        }
        break;

      case 'file':
        if (param.extensions && !Array.isArray(param.extensions)) {
          errors.push(`${prefix}: extensions must be an array`);
        }
        break;

      case 'application':
        if (param.platformMappings && typeof param.platformMappings !== 'object') {
          errors.push(`${prefix}: platformMappings must be an object`);
        }
        break;

      case 'key_combination':
        // Key combination specific validation could be added here
        break;
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate template sequence
   */
  validateSequence(sequence, parameters = []) {
    const errors = [];
    const paramNames = new Set(parameters.map(p => p.name));

    for (let i = 0; i < sequence.length; i++) {
      const step = sequence[i];
      const prefix = `Sequence step ${i}`;

      // Validate step structure
      const stepValidation = this.validateSequenceStep(step, paramNames, prefix);
      if (!stepValidation.valid) {
        errors.push(...stepValidation.errors);
      }

      // Validate parameter references
      const paramRefValidation = this.validateParameterReferences(step, paramNames, prefix);
      if (!paramRefValidation.valid) {
        errors.push(...paramRefValidation.errors);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate individual sequence step
   */
  validateSequenceStep(step, paramNames, prefix) {
    const errors = [];

    // Type-specific validation
    switch (step.type) {
      case 'keypress':
        if (!step.action || typeof step.action !== 'string') {
          errors.push(`${prefix}: keypress step must have valid action string`);
        }
        break;

      case 'command':
        if (!step.action || typeof step.action !== 'string') {
          errors.push(`${prefix}: command step must have valid action string`);
        }
        // Check for potentially dangerous commands
        if (this.isDangerousCommand(step.action)) {
          errors.push(`${prefix}: potentially dangerous command detected: ${step.action}`);
        }
        break;

      case 'application':
        if (!step.action || typeof step.action !== 'string') {
          errors.push(`${prefix}: application step must have valid action string`);
        }
        break;

      case 'delay':
        if (step.delay === undefined || typeof step.delay !== 'number' || step.delay < 0) {
          errors.push(`${prefix}: delay step must have valid positive delay value`);
        }
        break;

      case 'mouse_action':
        if (step.coordinates && (!step.coordinates.x || !step.coordinates.y)) {
          errors.push(
            `${prefix}: mouse_action step with coordinates must have valid x and y values`
          );
        }
        break;

      case 'text_input':
        if (!step.text && !step.action) {
          errors.push(`${prefix}: text_input step must have text or action property`);
        }
        break;
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate parameter references in sequence steps
   */
  validateParameterReferences(step, paramNames, prefix) {
    const errors = [];

    // Find parameter references in string values
    const parameterRegex = /\{\{([^}|]+)(\|([^}]+))?\}\}/g;

    const checkParameterReferences = (value, fieldName) => {
      if (typeof value !== 'string') {
        return;
      }

      let match;
      while ((match = parameterRegex.exec(value)) !== null) {
        const paramName = match[1].trim();
        if (!paramNames.has(paramName)) {
          errors.push(`${prefix}: Unknown parameter reference '${paramName}' in ${fieldName}`);
        }
      }
    };

    // Check all string fields
    Object.entries(step).forEach(([key, value]) => {
      if (typeof value === 'string') {
        checkParameterReferences(value, key);
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item === 'string') {
            checkParameterReferences(item, `${key}[${index}]`);
          }
        });
      }
    });

    // Check conditional parameter references
    if (step.condition && typeof step.condition === 'object' && step.condition.parameter) {
      if (!paramNames.has(step.condition.parameter)) {
        errors.push(`${prefix}: Unknown parameter '${step.condition.parameter}' in condition`);
      }
    }

    // Check parameter expansion references
    if (step.expandParameter && !paramNames.has(step.expandParameter)) {
      errors.push(`${prefix}: Unknown parameter '${step.expandParameter}' in expandParameter`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate parameter values against their definitions
   */
  validateParameters(parameterDefs, parameterValues) {
    const errors = [];

    // Create parameter definition map
    const paramMap = new Map();
    for (const param of parameterDefs) {
      paramMap.set(param.name, param);
    }

    // Check required parameters
    for (const param of parameterDefs) {
      if (param.required && !parameterValues.hasOwnProperty(param.name)) {
        errors.push(`Required parameter missing: ${param.name}`);
      }
    }

    // Validate provided values
    for (const [name, value] of Object.entries(parameterValues)) {
      const paramDef = paramMap.get(name);
      if (!paramDef) {
        errors.push(`Unknown parameter: ${name}`);
        continue;
      }

      const validation = this.validateParameterValue(value, paramDef);
      if (!validation.valid) {
        errors.push(...validation.errors.map(err => `Parameter ${name}: ${err}`));
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate individual parameter value
   */
  validateParameterValue(value, paramDef) {
    const errors = [];

    switch (paramDef.type) {
      case 'text':
        if (typeof value !== 'string') {
          errors.push('must be a string');
        } else {
          if (paramDef.minLength && value.length < paramDef.minLength) {
            errors.push(`must be at least ${paramDef.minLength} characters long`);
          }
          if (paramDef.maxLength && value.length > paramDef.maxLength) {
            errors.push(`must be at most ${paramDef.maxLength} characters long`);
          }
        }
        break;

      case 'number':
        if (typeof value !== 'number') {
          errors.push('must be a number');
        } else {
          if (paramDef.min !== undefined && value < paramDef.min) {
            errors.push(`must be at least ${paramDef.min}`);
          }
          if (paramDef.max !== undefined && value > paramDef.max) {
            errors.push(`must be at most ${paramDef.max}`);
          }
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push('must be a boolean');
        }
        break;

      case 'select':
        if (!paramDef.options.includes(value)) {
          errors.push(`must be one of: ${paramDef.options.join(', ')}`);
        }
        break;

      case 'list':
        if (!Array.isArray(value)) {
          errors.push('must be an array');
        } else {
          if (paramDef.minItems && value.length < paramDef.minItems) {
            errors.push(`must have at least ${paramDef.minItems} items`);
          }
          if (paramDef.maxItems && value.length > paramDef.maxItems) {
            errors.push(`must have at most ${paramDef.maxItems} items`);
          }
        }
        break;
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate template compatibility requirements
   */
  validateCompatibility(requirements) {
    const errors = [];
    const warnings = [];

    if (requirements.platforms && requirements.platforms.length === 0) {
      warnings.push('No platform compatibility specified - template may not work on all systems');
    }

    if (requirements.applications) {
      for (const app of requirements.applications) {
        if (typeof app !== 'string' || app.length === 0) {
          errors.push(`Invalid application requirement: ${app}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check for potentially dangerous commands
   */
  isDangerousCommand(command) {
    const dangerousPatterns = [
      /rm\s+-rf/i,
      /del\s+\/[sq]/i,
      /format\s+[a-z]:/i,
      /shutdown/i,
      /reboot/i,
      /killall/i,
      /sudo\s+rm/i,
      /dd\s+if=/i
    ];

    return dangerousPatterns.some(pattern => pattern.test(command));
  }

  /**
   * Generate validation warnings
   */
  generateWarnings(template) {
    const warnings = [];

    if (!template.version) {
      warnings.push('Template should have a version number');
    }

    if (!template.author) {
      warnings.push('Template should have an author specified');
    }

    if (!template.tags || template.tags.length === 0) {
      warnings.push('Template should have tags for better discoverability');
    }

    if (!template.requirements) {
      warnings.push('Template should specify compatibility requirements');
    }

    if (template.sequence.length > 50) {
      warnings.push('Template has many steps - consider breaking into smaller templates');
    }

    return warnings;
  }

  /**
   * Format AJV validation errors
   */
  formatValidationErrors(ajvErrors) {
    if (!ajvErrors) {
      return [];
    }

    return ajvErrors.map(error => {
      let message = `${error.instancePath || 'root'}: ${error.message}`;
      if (error.data !== undefined) {
        message += ` (received: ${JSON.stringify(error.data)})`;
      }
      return message;
    });
  }

  /**
   * Validate custom template rules
   */
  validateCustomRules(template) {
    const errors = [];

    // Template ID should follow naming conventions
    if (template.id && !/^[a-zA-Z0-9_-]+$/.test(template.id)) {
      errors.push('Template ID should contain only letters, numbers, underscores, and hyphens');
    }

    // Version should follow semantic versioning
    if (template.version && !/^\d+\.\d+\.\d+$/.test(template.version)) {
      errors.push('Version should follow semantic versioning (x.y.z)');
    }

    // Sequence should not be empty
    if (!template.sequence || template.sequence.length === 0) {
      errors.push('Template must have at least one sequence step');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = TemplateValidator;
