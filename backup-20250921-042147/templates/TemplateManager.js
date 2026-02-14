const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');
const ParameterEngine = require('./ParameterEngine');
const TemplateValidator = require('./TemplateValidator');

/**
 * Comprehensive Macro Template Management System
 *
 * Handles loading, validation, parameter substitution, and management
 * of macro templates for common workflows and use cases
 */
class TemplateManager extends EventEmitter {
  constructor(logger) {
    super();

    this.logger = logger;
    this.parameterEngine = new ParameterEngine(logger);
    this.validator = new TemplateValidator(logger);

    // Template storage
    this.templates = new Map();
    this.templateCategories = new Map();
    this.userTemplates = new Map();

    // Template directories
    this.templateDir = path.join(__dirname, 'library');
    this.userTemplateDir = path.join(__dirname, '../../config/user-templates');

    // Template cache
    this.templateCache = new Map();
    this.lastLoadTime = null;

    // Search index
    this.searchIndex = new Map();

    this.logger.info('TemplateManager initialized');
  }

  /**
   * Initialize the template system
   */
  async initialize() {
    try {
      await this.ensureDirectories();
      await this.loadSystemTemplates();
      await this.loadUserTemplates();
      this.buildSearchIndex();

      this.emit('templates-loaded', {
        systemTemplates: this.templates.size,
        userTemplates: this.userTemplates.size,
        categories: this.templateCategories.size
      });

      this.logger.info(`Template system initialized with ${this.templates.size} system templates and ${this.userTemplates.size} user templates`);
    } catch (error) {
      this.logger.error('Failed to initialize template system:', error);
      throw error;
    }
  }

  /**
   * Ensure template directories exist
   */
  async ensureDirectories() {
    try {
      await fs.mkdir(this.templateDir, { recursive: true });
      await fs.mkdir(this.userTemplateDir, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create template directories:', error);
      throw error;
    }
  }

  /**
   * Load system templates from the library directory
   */
  async loadSystemTemplates() {
    try {
      const categories = ['productivity', 'gaming', 'development', 'content_creation'];

      for (const category of categories) {
        const categoryPath = path.join(this.templateDir, category);

        try {
          await fs.mkdir(categoryPath, { recursive: true });
          const files = await fs.readdir(categoryPath);

          for (const file of files) {
            if (file.endsWith('.json')) {
              await this.loadTemplate(path.join(categoryPath, file), category, false);
            }
          }
        } catch (error) {
          this.logger.warn(`Failed to load templates from category ${category}:`, error);
        }
      }
    } catch (error) {
      this.logger.error('Failed to load system templates:', error);
      throw error;
    }
  }

  /**
   * Load user-created templates
   */
  async loadUserTemplates() {
    try {
      const files = await fs.readdir(this.userTemplateDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          await this.loadTemplate(path.join(this.userTemplateDir, file), 'user', true);
        }
      }
    } catch (error) {
      this.logger.warn('Failed to load user templates:', error);
    }
  }

  /**
   * Load a single template file
   */
  async loadTemplate(filePath, category, isUserTemplate = false) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const template = JSON.parse(content);

      // Validate template structure
      const validationResult = this.validator.validateTemplate(template);
      if (!validationResult.valid) {
        this.logger.error(`Invalid template ${filePath}:`, validationResult.errors);
        return false;
      }

      // Add metadata
      template.category = category;
      template.isUserTemplate = isUserTemplate;
      template.filePath = filePath;
      template.loadedAt = new Date().toISOString();

      // Store template
      const storage = isUserTemplate ? this.userTemplates : this.templates;
      storage.set(template.id, template);

      // Update category index
      if (!this.templateCategories.has(category)) {
        this.templateCategories.set(category, []);
      }
      this.templateCategories.get(category).push(template.id);

      this.logger.debug(`Loaded template: ${template.name} (${template.id})`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to load template ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Get all available templates
   */
  getAllTemplates() {
    const allTemplates = new Map();

    // Add system templates
    for (const [id, template] of this.templates) {
      allTemplates.set(id, template);
    }

    // Add user templates
    for (const [id, template] of this.userTemplates) {
      allTemplates.set(id, template);
    }

    return allTemplates;
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category) {
    const templates = [];
    const templateIds = this.templateCategories.get(category) || [];

    for (const id of templateIds) {
      const template = this.templates.get(id) || this.userTemplates.get(id);
      if (template) {
        templates.push(template);
      }
    }

    return templates;
  }

  /**
   * Get a specific template by ID
   */
  getTemplate(id) {
    return this.templates.get(id) || this.userTemplates.get(id);
  }

  /**
   * Search templates by name, description, or tags
   */
  searchTemplates(query) {
    const results = [];
    const searchTerms = query.toLowerCase().split(' ');
    const allTemplates = this.getAllTemplates();

    for (const [id, template] of allTemplates) {
      let matchScore = 0;

      // Search in name
      if (template.name.toLowerCase().includes(query.toLowerCase())) {
        matchScore += 10;
      }

      // Search in description
      if (template.description && template.description.toLowerCase().includes(query.toLowerCase())) {
        matchScore += 5;
      }

      // Search in tags
      if (template.tags) {
        for (const tag of template.tags) {
          if (tag.toLowerCase().includes(query.toLowerCase())) {
            matchScore += 3;
          }
        }
      }

      // Search terms matching
      for (const term of searchTerms) {
        if (template.name.toLowerCase().includes(term) ||
            (template.description && template.description.toLowerCase().includes(term)) ||
            (template.tags && template.tags.some(tag => tag.toLowerCase().includes(term)))) {
          matchScore += 2;
        }
      }

      if (matchScore > 0) {
        results.push({
          template,
          score: matchScore
        });
      }
    }

    // Sort by relevance score
    results.sort((a, b) => b.score - a.score);
    return results.map(r => r.template);
  }

  /**
   * Install a template with custom parameters
   */
  async installTemplate(templateId, parameters = {}, customName = null) {
    try {
      const template = this.getTemplate(templateId);
      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }

      // Validate parameters
      const parameterValidation = this.validator.validateParameters(template.parameters, parameters);
      if (!parameterValidation.valid) {
        throw new Error(`Invalid parameters: ${parameterValidation.errors.join(', ')}`);
      }

      // Apply parameter substitution
      const installedSequence = await this.parameterEngine.substituteParameters(
        template.sequence,
        template.parameters,
        parameters
      );

      // Create installed template object
      const installedTemplate = {
        id: customName || `${templateId}_installed_${Date.now()}`,
        originalTemplateId: templateId,
        name: customName || `${template.name} (Installed)`,
        description: template.description,
        sequence: installedSequence,
        parameters,
        installedAt: new Date().toISOString(),
        version: template.version
      };

      this.emit('template-installed', {
        templateId,
        installedId: installedTemplate.id,
        parameters
      });

      this.logger.info(`Template installed: ${template.name} -> ${installedTemplate.id}`);
      return installedTemplate;
    } catch (error) {
      this.logger.error(`Failed to install template ${templateId}:`, error);
      throw error;
    }
  }

  /**
   * Create a new user template
   */
  async createUserTemplate(templateData) {
    try {
      // Validate template data
      const validationResult = this.validator.validateTemplate(templateData);
      if (!validationResult.valid) {
        throw new Error(`Invalid template data: ${validationResult.errors.join(', ')}`);
      }

      // Ensure unique ID
      if (this.templates.has(templateData.id) || this.userTemplates.has(templateData.id)) {
        templateData.id = `${templateData.id}_${Date.now()}`;
      }

      // Add metadata
      templateData.category = 'user';
      templateData.isUserTemplate = true;
      templateData.createdAt = new Date().toISOString();
      templateData.version = templateData.version || '1.0.0';
      templateData.author = templateData.author || 'User';

      // Save to file
      const fileName = `${templateData.id}.json`;
      const filePath = path.join(this.userTemplateDir, fileName);

      await fs.writeFile(filePath, JSON.stringify(templateData, null, 2), 'utf8');

      // Add to user templates
      templateData.filePath = filePath;
      this.userTemplates.set(templateData.id, templateData);

      // Update category index
      if (!this.templateCategories.has('user')) {
        this.templateCategories.set('user', []);
      }
      this.templateCategories.get('user').push(templateData.id);

      // Update search index
      this.updateSearchIndex(templateData);

      this.emit('user-template-created', templateData);
      this.logger.info(`User template created: ${templateData.name} (${templateData.id})`);

      return templateData;
    } catch (error) {
      this.logger.error('Failed to create user template:', error);
      throw error;
    }
  }

  /**
   * Export a template for sharing
   */
  async exportTemplate(templateId) {
    try {
      const template = this.getTemplate(templateId);
      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }

      // Create export object (clean copy without file paths and metadata)
      const exportTemplate = {
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        author: template.author,
        version: template.version,
        tags: template.tags,
        parameters: template.parameters,
        sequence: template.sequence,
        requirements: template.requirements,
        exportedAt: new Date().toISOString()
      };

      this.logger.info(`Template exported: ${template.name} (${templateId})`);
      return exportTemplate;
    } catch (error) {
      this.logger.error(`Failed to export template ${templateId}:`, error);
      throw error;
    }
  }

  /**
   * Import a template from external source
   */
  async importTemplate(templateData, overwrite = false) {
    try {
      // Validate imported template
      const validationResult = this.validator.validateTemplate(templateData);
      if (!validationResult.valid) {
        throw new Error(`Invalid template data: ${validationResult.errors.join(', ')}`);
      }

      // Check for existing template
      if ((this.templates.has(templateData.id) || this.userTemplates.has(templateData.id)) && !overwrite) {
        throw new Error(`Template already exists: ${templateData.id}. Use overwrite=true to replace.`);
      }

      // Import as user template
      await this.createUserTemplate(templateData);

      this.logger.info(`Template imported: ${templateData.name} (${templateData.id})`);
      return templateData;
    } catch (error) {
      this.logger.error('Failed to import template:', error);
      throw error;
    }
  }

  /**
   * Get available categories
   */
  getCategories() {
    return Array.from(this.templateCategories.keys());
  }

  /**
   * Get template statistics
   */
  getStatistics() {
    const allTemplates = this.getAllTemplates();
    const categories = {};

    for (const [id, template] of allTemplates) {
      if (!categories[template.category]) {
        categories[template.category] = 0;
      }
      categories[template.category]++;
    }

    return {
      totalTemplates: allTemplates.size,
      systemTemplates: this.templates.size,
      userTemplates: this.userTemplates.size,
      categories,
      lastLoadTime: this.lastLoadTime
    };
  }

  /**
   * Build search index for efficient searching
   */
  buildSearchIndex() {
    this.searchIndex.clear();
    const allTemplates = this.getAllTemplates();

    for (const [id, template] of allTemplates) {
      const searchText = [
        template.name,
        template.description || '',
        ...(template.tags || [])
      ].join(' ').toLowerCase();

      this.searchIndex.set(id, searchText);
    }

    this.logger.debug(`Search index built for ${this.searchIndex.size} templates`);
  }

  /**
   * Update search index for a single template
   */
  updateSearchIndex(template) {
    const searchText = [
      template.name,
      template.description || '',
      ...(template.tags || [])
    ].join(' ').toLowerCase();

    this.searchIndex.set(template.id, searchText);
  }

  /**
   * Reload templates from disk
   */
  async reload() {
    try {
      // Clear existing templates
      this.templates.clear();
      this.userTemplates.clear();
      this.templateCategories.clear();
      this.searchIndex.clear();

      // Reload templates
      await this.loadSystemTemplates();
      await this.loadUserTemplates();
      this.buildSearchIndex();

      this.lastLoadTime = new Date().toISOString();

      this.emit('templates-reloaded', this.getStatistics());
      this.logger.info('Templates reloaded successfully');
    } catch (error) {
      this.logger.error('Failed to reload templates:', error);
      throw error;
    }
  }
}

module.exports = TemplateManager;
