/**
 * Plugin Management UI Component
 *
 * Provides a comprehensive interface for managing plugins including:
 * - Plugin discovery and installation
 * - Enable/disable plugin controls
 * - Plugin configuration management
 * - Plugin marketplace integration
 * - Development tools for plugin creation
 */
class PluginManagerUI {
  constructor() {
    this.plugins = [];
    this.selectedPlugin = null;
    this.isVisible = false;
    this.refreshTimer = null;
    this.currentView = 'installed'; // installed, marketplace, development

    this.initializeUI();
    this.setupEventHandlers();
    this.loadPlugins();
  }

  /**
   * Initialize the UI structure
   */
  initializeUI() {
    this.container = document.createElement('div');
    this.container.className = 'plugin-manager';
    this.container.innerHTML = this.getUITemplate();

    // Get UI elements
    this.headerElement = this.container.querySelector('.plugin-header');
    this.toolbarElement = this.container.querySelector('.plugin-toolbar');
    this.contentElement = this.container.querySelector('.plugin-content');
    this.sidebarElement = this.container.querySelector('.plugin-sidebar');
    this.detailsElement = this.container.querySelector('.plugin-details');
  }

  /**
   * Get the main UI template
   */
  getUITemplate() {
    return `
      <div class="plugin-header">
        <h3>Plugin Management</h3>
        <div class="plugin-header-controls">
          <div class="view-selector">
            <button class="view-btn active" data-view="installed">Installed</button>
            <button class="view-btn" data-view="marketplace">Marketplace</button>
            <button class="view-btn" data-view="development">Development</button>
          </div>
          <button class="refresh-btn" title="Refresh plugin list">🔄</button>
          <button class="settings-btn" title="Plugin settings">⚙️</button>
        </div>
      </div>

      <div class="plugin-main">
        <div class="plugin-sidebar">
          <div class="plugin-search">
            <input type="text" placeholder="Search plugins..." class="search-input">
            <button class="search-clear">✕</button>
          </div>

          <div class="plugin-filters">
            <label class="filter-label">
              <input type="checkbox" class="filter-enabled" checked> Enabled Only
            </label>
            <label class="filter-label">
              <input type="checkbox" class="filter-system"> System Plugins
            </label>
          </div>

          <div class="plugin-list">
            <!-- Plugin list will be populated dynamically -->
          </div>
        </div>

        <div class="plugin-content">
          <div class="plugin-details">
            <div class="no-selection">
              <p>Select a plugin to view details</p>
            </div>
            <!-- Plugin details will be populated dynamically -->
          </div>
        </div>
      </div>

      <div class="plugin-status-bar">
        <span class="status-text">Ready</span>
        <span class="plugin-count">0 plugins loaded</span>
      </div>
    `;
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    // View selector
    this.container.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        this.switchView(e.target.dataset.view);
      });
    });

    // Refresh button
    this.container.querySelector('.refresh-btn').addEventListener('click', () => {
      this.refreshPlugins();
    });

    // Search functionality
    const searchInput = this.container.querySelector('.search-input');
    const searchClear = this.container.querySelector('.search-clear');

    searchInput.addEventListener('input', e => {
      this.filterPlugins(e.target.value);
    });

    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      this.filterPlugins('');
    });

    // Filter checkboxes
    this.container.querySelectorAll('.filter-label input').forEach(filter => {
      filter.addEventListener('change', () => {
        this.applyFilters();
      });
    });

    // Listen for plugin events from main process
    window.electronAPI.on('plugin-loaded', (event, data) => {
      this.onPluginLoaded(data);
    });

    window.electronAPI.on('plugin-enabled', (event, data) => {
      this.onPluginStateChanged(data.pluginId, 'enabled');
    });

    window.electronAPI.on('plugin-disabled', (event, data) => {
      this.onPluginStateChanged(data.pluginId, 'disabled');
    });

    window.electronAPI.on('plugin-error', (event, data) => {
      this.onPluginError(data);
    });
  }

  /**
   * Switch between views (installed, marketplace, development)
   */
  switchView(view) {
    // Update active view button
    this.container.querySelectorAll('.view-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });

    this.currentView = view;
    this.renderContent();
  }

  /**
   * Load plugins from main process
   */
  async loadPlugins() {
    try {
      this.updateStatus('Loading plugins...');
      const plugins = await window.electronAPI.getPlugins();
      this.plugins = plugins;
      this.renderPluginList();
      this.updatePluginCount();
      this.updateStatus('Ready');
    } catch (error) {
      console.error('Failed to load plugins:', error);
      this.updateStatus('Error loading plugins');
    }
  }

  /**
   * Refresh plugin list
   */
  async refreshPlugins() {
    await this.loadPlugins();
    this.showNotification('Plugin list refreshed', 'success');
  }

  /**
   * Filter plugins based on search term
   */
  filterPlugins(searchTerm) {
    const pluginItems = this.container.querySelectorAll('.plugin-item');
    const term = searchTerm.toLowerCase();

    pluginItems.forEach(item => {
      const name = item.querySelector('.plugin-name').textContent.toLowerCase();
      const description =
        item.querySelector('.plugin-description')?.textContent?.toLowerCase() || '';

      const matches = name.includes(term) || description.includes(term);
      item.style.display = matches ? '' : 'none';
    });
  }

  /**
   * Apply filters
   */
  applyFilters() {
    const enabledOnly = this.container.querySelector('.filter-enabled').checked;
    const systemOnly = this.container.querySelector('.filter-system').checked;

    const pluginItems = this.container.querySelectorAll('.plugin-item');

    pluginItems.forEach(item => {
      const pluginId = item.dataset.pluginId;
      const plugin = this.plugins.find(p => p.id === pluginId);

      if (!plugin) {
        item.style.display = 'none';
        return;
      }

      let show = true;

      if (enabledOnly && plugin.state !== 'enabled') {
        show = false;
      }

      if (systemOnly && !plugin.isSystem) {
        show = false;
      }

      item.style.display = show ? '' : 'none';
    });
  }

  /**
   * Render plugin list
   */
  renderPluginList() {
    const listContainer = this.container.querySelector('.plugin-list');

    if (this.plugins.length === 0) {
      listContainer.innerHTML = '<div class="no-plugins">No plugins found</div>';
      return;
    }

    const listHTML = this.plugins.map(plugin => this.getPluginItemTemplate(plugin)).join('');
    listContainer.innerHTML = listHTML;

    // Add click handlers to plugin items
    listContainer.querySelectorAll('.plugin-item').forEach(item => {
      item.addEventListener('click', () => {
        this.selectPlugin(item.dataset.pluginId);
      });
    });
  }

  /**
   * Get template for individual plugin item
   */
  getPluginItemTemplate(plugin) {
    const stateClass = `state-${plugin.state}`;
    const stateIcon = this.getStateIcon(plugin.state);

    return `
      <div class="plugin-item ${stateClass}" data-plugin-id="${plugin.id}">
        <div class="plugin-icon">
          <span class="state-indicator">${stateIcon}</span>
        </div>
        <div class="plugin-info">
          <div class="plugin-name">${plugin.name}</div>
          <div class="plugin-version">v${plugin.version}</div>
          <div class="plugin-description">${plugin.description || 'No description'}</div>
        </div>
        <div class="plugin-controls">
          <button class="toggle-btn" title="${plugin.state === 'enabled' ? 'Disable' : 'Enable'}">
            ${plugin.state === 'enabled' ? '⏸️' : '▶️'}
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Get icon for plugin state
   */
  getStateIcon(state) {
    const icons = {
      enabled: '🟢',
      disabled: '🔴',
      loading: '🟡',
      error: '❌',
      unknown: '⚪'
    };
    return icons[state] || icons.unknown;
  }

  /**
   * Select a plugin and show details
   */
  async selectPlugin(pluginId) {
    // Update selection in UI
    this.container.querySelectorAll('.plugin-item').forEach(item => {
      item.classList.toggle('selected', item.dataset.pluginId === pluginId);
    });

    const plugin = this.plugins.find(p => p.id === pluginId);
    if (!plugin) {
      return;
    }

    this.selectedPlugin = plugin;
    await this.renderPluginDetails(plugin);
  }

  /**
   * Render plugin details panel
   */
  async renderPluginDetails(plugin) {
    const detailsContainer = this.container.querySelector('.plugin-details');

    try {
      // Get additional plugin info
      const pluginInfo = await window.electronAPI.getPluginDetails(plugin.id);
      const config = await window.electronAPI.getPluginConfig(plugin.id);

      detailsContainer.innerHTML = this.getPluginDetailsTemplate(plugin, pluginInfo, config);
      this.setupDetailsEventHandlers(plugin);
    } catch (error) {
      console.error('Failed to load plugin details:', error);
      detailsContainer.innerHTML = this.getErrorDetailsTemplate(plugin, error.message);
    }
  }

  /**
   * Get template for plugin details
   */
  getPluginDetailsTemplate(plugin, info, config) {
    return `
      <div class="plugin-details-header">
        <div class="plugin-title">
          <h4>${plugin.name}</h4>
          <span class="plugin-version">v${plugin.version}</span>
          <span class="plugin-state state-${plugin.state}">${plugin.state}</span>
        </div>
        <div class="plugin-actions">
          <button class="btn-primary toggle-plugin">
            ${plugin.state === 'enabled' ? 'Disable' : 'Enable'}
          </button>
          <button class="btn-secondary reload-plugin">Reload</button>
          <button class="btn-danger uninstall-plugin">Uninstall</button>
        </div>
      </div>

      <div class="plugin-details-content">
        <div class="plugin-tabs">
          <button class="tab-btn active" data-tab="overview">Overview</button>
          <button class="tab-btn" data-tab="configuration">Configuration</button>
          <button class="tab-btn" data-tab="permissions">Permissions</button>
          <button class="tab-btn" data-tab="logs">Logs</button>
        </div>

        <div class="plugin-tab-content">
          <div class="tab-panel active" data-tab="overview">
            ${this.getOverviewTabTemplate(plugin, info)}
          </div>

          <div class="tab-panel" data-tab="configuration">
            ${this.getConfigurationTabTemplate(plugin, config)}
          </div>

          <div class="tab-panel" data-tab="permissions">
            ${this.getPermissionsTabTemplate(plugin, info)}
          </div>

          <div class="tab-panel" data-tab="logs">
            ${this.getLogsTabTemplate(plugin)}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Get overview tab template
   */
  getOverviewTabTemplate(plugin, info) {
    return `
      <div class="overview-section">
        <h5>Description</h5>
        <p>${plugin.description || 'No description available'}</p>
      </div>

      <div class="overview-section">
        <h5>Details</h5>
        <dl class="plugin-meta">
          <dt>Author:</dt>
          <dd>${plugin.author || 'Unknown'}</dd>
          <dt>Version:</dt>
          <dd>${plugin.version}</dd>
          <dt>API Version:</dt>
          <dd>${info.apiVersion || '1.0.0'}</dd>
          <dt>Load Time:</dt>
          <dd>${plugin.loadTime ? new Date(plugin.loadTime).toLocaleString() : 'N/A'}</dd>
          <dt>Dependencies:</dt>
          <dd>${info.dependencies?.join(', ') || 'None'}</dd>
        </dl>
      </div>

      <div class="overview-section">
        <h5>Actions</h5>
        <div class="action-types">
          ${(info.actionTypes || [])
            .map(type => `<span class="action-type">${type}</span>`)
            .join('')}
        </div>
      </div>
    `;
  }

  /**
   * Get configuration tab template
   */
  getConfigurationTabTemplate(plugin, config) {
    if (!config || Object.keys(config).length === 0) {
      return '<p>No configuration options available</p>';
    }

    const configItems = Object.entries(config)
      .map(([key, value]) => {
        return `
        <div class="config-item">
          <label class="config-label">${key}:</label>
          <input type="text" class="config-input" data-key="${key}" value="${value}">
        </div>
      `;
      })
      .join('');

    return `
      <div class="configuration-section">
        <div class="config-form">
          ${configItems}
        </div>
        <div class="config-actions">
          <button class="btn-primary save-config">Save Configuration</button>
          <button class="btn-secondary reset-config">Reset</button>
        </div>
      </div>
    `;
  }

  /**
   * Get permissions tab template
   */
  getPermissionsTabTemplate(plugin, info) {
    const permissions = info.permissions || {};

    return `
      <div class="permissions-section">
        <h5>Requested Permissions</h5>
        <div class="permission-list">
          <div class="permission-item">
            <label>
              <input type="checkbox" ${permissions.fileSystem ? 'checked' : ''} disabled>
              File System Access
            </label>
          </div>
          <div class="permission-item">
            <label>
              <input type="checkbox" ${permissions.network ? 'checked' : ''} disabled>
              Network Access
            </label>
          </div>
          <div class="permission-item">
            <label>
              <input type="checkbox" ${permissions.hardware ? 'checked' : ''} disabled>
              Hardware Access
            </label>
          </div>
          <div class="permission-item">
            <label>
              <input type="checkbox" ${permissions.system ? 'checked' : ''} disabled>
              System Integration
            </label>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Get logs tab template
   */
  getLogsTabTemplate(plugin) {
    return `
      <div class="logs-section">
        <div class="logs-header">
          <h5>Plugin Logs</h5>
          <button class="btn-secondary refresh-logs">Refresh</button>
        </div>
        <div class="logs-content">
          <div class="log-viewer">
            <div class="loading">Loading logs...</div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Setup event handlers for plugin details
   */
  setupDetailsEventHandlers(plugin) {
    const detailsContainer = this.container.querySelector('.plugin-details');

    // Tab switching
    detailsContainer.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    // Plugin actions
    const toggleBtn = detailsContainer.querySelector('.toggle-plugin');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.togglePlugin(plugin.id);
      });
    }

    const reloadBtn = detailsContainer.querySelector('.reload-plugin');
    if (reloadBtn) {
      reloadBtn.addEventListener('click', () => {
        this.reloadPlugin(plugin.id);
      });
    }

    const uninstallBtn = detailsContainer.querySelector('.uninstall-plugin');
    if (uninstallBtn) {
      uninstallBtn.addEventListener('click', () => {
        this.uninstallPlugin(plugin.id);
      });
    }

    // Configuration
    const saveConfigBtn = detailsContainer.querySelector('.save-config');
    if (saveConfigBtn) {
      saveConfigBtn.addEventListener('click', () => {
        this.savePluginConfiguration(plugin.id);
      });
    }

    // Logs
    const refreshLogsBtn = detailsContainer.querySelector('.refresh-logs');
    if (refreshLogsBtn) {
      refreshLogsBtn.addEventListener('click', () => {
        this.refreshPluginLogs(plugin.id);
      });
    }
  }

  /**
   * Switch tabs in plugin details
   */
  switchTab(tabName) {
    const detailsContainer = this.container.querySelector('.plugin-details');

    // Update tab buttons
    detailsContainer.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update tab panels
    detailsContainer.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.dataset.tab === tabName);
    });

    // Load tab content if needed
    if (tabName === 'logs' && this.selectedPlugin) {
      this.loadPluginLogs(this.selectedPlugin.id);
    }
  }

  /**
   * Toggle plugin enabled/disabled state
   */
  async togglePlugin(pluginId) {
    try {
      const plugin = this.plugins.find(p => p.id === pluginId);
      if (!plugin) {
        return;
      }

      this.updateStatus(`${plugin.state === 'enabled' ? 'Disabling' : 'Enabling'} plugin...`);

      if (plugin.state === 'enabled') {
        await window.electronAPI.disablePlugin(pluginId);
      } else {
        await window.electronAPI.enablePlugin(pluginId);
      }

      this.showNotification(
        `Plugin ${plugin.state === 'enabled' ? 'disabled' : 'enabled'} successfully`,
        'success'
      );
    } catch (error) {
      console.error('Failed to toggle plugin:', error);
      this.showNotification('Failed to toggle plugin', 'error');
    } finally {
      this.updateStatus('Ready');
    }
  }

  /**
   * Reload plugin
   */
  async reloadPlugin(pluginId) {
    try {
      this.updateStatus('Reloading plugin...');
      await window.electronAPI.reloadPlugin(pluginId);
      this.showNotification('Plugin reloaded successfully', 'success');
      await this.refreshPlugins();
    } catch (error) {
      console.error('Failed to reload plugin:', error);
      this.showNotification('Failed to reload plugin', 'error');
    } finally {
      this.updateStatus('Ready');
    }
  }

  /**
   * Uninstall plugin
   */
  async uninstallPlugin(pluginId) {
    const plugin = this.plugins.find(p => p.id === pluginId);
    if (!plugin) {
      return;
    }

    const confirmed = confirm(`Are you sure you want to uninstall "${plugin.name}"?`);
    if (!confirmed) {
      return;
    }

    try {
      this.updateStatus('Uninstalling plugin...');
      await window.electronAPI.uninstallPlugin(pluginId);
      this.showNotification('Plugin uninstalled successfully', 'success');
      await this.refreshPlugins();

      // Clear details if this plugin was selected
      if (this.selectedPlugin?.id === pluginId) {
        this.selectedPlugin = null;
        this.container.querySelector('.plugin-details').innerHTML =
          '<div class="no-selection"><p>Select a plugin to view details</p></div>';
      }
    } catch (error) {
      console.error('Failed to uninstall plugin:', error);
      this.showNotification('Failed to uninstall plugin', 'error');
    } finally {
      this.updateStatus('Ready');
    }
  }

  /**
   * Save plugin configuration
   */
  async savePluginConfiguration(pluginId) {
    try {
      const configInputs = this.container.querySelectorAll('.config-input');
      const newConfig = {};

      configInputs.forEach(input => {
        newConfig[input.dataset.key] = input.value;
      });

      await window.electronAPI.updatePluginConfig(pluginId, newConfig);
      this.showNotification('Configuration saved successfully', 'success');
    } catch (error) {
      console.error('Failed to save configuration:', error);
      this.showNotification('Failed to save configuration', 'error');
    }
  }

  /**
   * Load plugin logs
   */
  async loadPluginLogs(pluginId) {
    try {
      const logViewer = this.container.querySelector('.log-viewer');
      logViewer.innerHTML = '<div class="loading">Loading logs...</div>';

      const logs = await window.electronAPI.getPluginLogs(pluginId);

      if (logs.length === 0) {
        logViewer.innerHTML = '<div class="no-logs">No logs found</div>';
        return;
      }

      const logsHTML = logs
        .map(
          log => `
        <div class="log-entry log-${log.level}">
          <span class="log-timestamp">${new Date(log.timestamp).toLocaleString()}</span>
          <span class="log-level">${log.level.toUpperCase()}</span>
          <span class="log-message">${log.message}</span>
        </div>
      `
        )
        .join('');

      logViewer.innerHTML = logsHTML;
    } catch (error) {
      console.error('Failed to load logs:', error);
      const logViewer = this.container.querySelector('.log-viewer');
      logViewer.innerHTML = '<div class="error">Failed to load logs</div>';
    }
  }

  /**
   * Render content based on current view
   */
  renderContent() {
    switch (this.currentView) {
      case 'installed':
        this.renderInstalledView();
        break;
      case 'marketplace':
        this.renderMarketplaceView();
        break;
      case 'development':
        this.renderDevelopmentView();
        break;
    }
  }

  /**
   * Render installed plugins view
   */
  renderInstalledView() {
    this.renderPluginList();
  }

  /**
   * Render marketplace view
   */
  renderMarketplaceView() {
    const listContainer = this.container.querySelector('.plugin-list');
    listContainer.innerHTML = `
      <div class="marketplace-message">
        <p>Plugin Marketplace</p>
        <p>Coming soon...</p>
      </div>
    `;
  }

  /**
   * Render development view
   */
  renderDevelopmentView() {
    const listContainer = this.container.querySelector('.plugin-list');
    listContainer.innerHTML = `
      <div class="development-tools">
        <h4>Plugin Development</h4>
        <button class="btn-primary create-plugin">Create New Plugin</button>
        <button class="btn-secondary load-local">Load Local Plugin</button>
        <button class="btn-secondary plugin-template">Download Template</button>
      </div>
    `;

    // Add event handlers for development tools
    listContainer.querySelector('.create-plugin')?.addEventListener('click', () => {
      this.createNewPlugin();
    });

    listContainer.querySelector('.load-local')?.addEventListener('click', () => {
      this.loadLocalPlugin();
    });
  }

  /**
   * Plugin event handlers
   */
  onPluginLoaded(data) {
    this.loadPlugins(); // Refresh the list
  }

  onPluginStateChanged(pluginId, newState) {
    const plugin = this.plugins.find(p => p.id === pluginId);
    if (plugin) {
      plugin.state = newState;
      this.renderPluginList();

      if (this.selectedPlugin?.id === pluginId) {
        this.renderPluginDetails(plugin);
      }
    }
  }

  onPluginError(data) {
    this.showNotification(`Plugin error: ${data.error}`, 'error');
  }

  /**
   * Update status bar
   */
  updateStatus(message) {
    const statusText = this.container.querySelector('.status-text');
    if (statusText) {
      statusText.textContent = message;
    }
  }

  /**
   * Update plugin count
   */
  updatePluginCount() {
    const pluginCount = this.container.querySelector('.plugin-count');
    if (pluginCount) {
      pluginCount.textContent = `${this.plugins.length} plugins loaded`;
    }
  }

  /**
   * Show notification
   */
  showNotification(message, type = 'info') {
    // This would integrate with the main notification system
    console.log(`[${type.toUpperCase()}] ${message}`);
  }

  /**
   * Set visibility of the plugin manager
   */
  setVisible(visible) {
    this.isVisible = visible;
    this.container.style.display = visible ? 'block' : 'none';

    if (visible) {
      this.refreshPlugins();
    }
  }

  /**
   * Render the plugin manager in a container
   */
  render(container) {
    container.appendChild(this.container);
  }

  /**
   * Clean up resources
   */
  dispose() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}

// Make PluginManagerUI available globally
window.PluginManagerUI = PluginManagerUI;
