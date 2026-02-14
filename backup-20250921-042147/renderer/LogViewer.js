/**
 * LogViewer - Real-time log viewing and management component
 * Provides log display, filtering, search, and export functionality
 */
class LogViewer {
  constructor() {
    this.logs = [];
    this.filteredLogs = [];
    this.currentFilter = 'all';
    this.searchTerm = '';
    this.autoRefresh = true;
    this.refreshInterval = null;
    this.isVisible = false;

    this.setupEventListeners();
    this.startAutoRefresh();
  }

  /**
   * Set up IPC event listeners for log data
   */
  setupEventListeners() {
    // Listen for real-time log events
    if (window.electronAPI) {
      window.electronAPI.on('log-entry', (event, logData) => {
        this.addLogEntry(logData);
      });
    }
  }

  /**
   * Add a new log entry and update display
   */
  addLogEntry(logData) {
    this.logs.unshift(logData);

    // Keep only recent logs to prevent memory issues
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(0, 1000);
    }

    this.applyFilters();
    this.updateDisplay();
  }

  /**
   * Render the log viewer in the settings panel
   */
  async renderLogViewer() {
    const settingsContent = document.getElementById('settings-content');
    if (!settingsContent) {
      return;
    }

    const logSection = this.createElement('div', ['log-viewer-section']);
    logSection.innerHTML = `
      <h3>Application Logs</h3>
      <div class="log-viewer-controls">
        <div class="log-controls-row">
          <div class="log-filter-group">
            <label for="log-level-filter">Filter by level:</label>
            <select id="log-level-filter">
              <option value="all">All Levels</option>
              <option value="debug">Debug</option>
              <option value="info">Info</option>
              <option value="warn">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>

          <div class="log-search-group">
            <label for="log-search">Search logs:</label>
            <input type="text" id="log-search" placeholder="Search messages...">
          </div>

          <div class="log-action-group">
            <button id="log-refresh" class="btn btn-secondary">
              <span class="icon">🔄</span> Refresh
            </button>
            <button id="log-clear" class="btn btn-secondary">
              <span class="icon">🗑️</span> Clear
            </button>
            <button id="log-export" class="btn btn-secondary">
              <span class="icon">💾</span> Export
            </button>
          </div>
        </div>

        <div class="log-controls-row">
          <div class="log-auto-refresh">
            <label>
              <input type="checkbox" id="log-auto-refresh" checked>
              Auto-refresh every 5 seconds
            </label>
          </div>

          <div class="log-stats">
            <span id="log-count">0 entries</span>
            <span id="log-stats-detail"></span>
          </div>
        </div>
      </div>

      <div class="log-viewer-container">
        <div id="log-entries" class="log-entries"></div>
      </div>

      <div class="log-pagination">
        <button id="log-prev" class="btn btn-secondary" disabled>Previous</button>
        <span id="log-page-info">Page 1</span>
        <button id="log-next" class="btn btn-secondary" disabled>Next</button>
        <select id="log-page-size">
          <option value="50">50 per page</option>
          <option value="100" selected>100 per page</option>
          <option value="200">200 per page</option>
        </select>
      </div>
    `;

    settingsContent.appendChild(logSection);
    this.setupLogViewerEventHandlers();
    await this.loadLogs();
  }

  /**
   * Set up event handlers for log viewer controls
   */
  setupLogViewerEventHandlers() {
    // Filter by level
    const levelFilter = document.getElementById('log-level-filter');
    levelFilter?.addEventListener('change', (e) => {
      this.currentFilter = e.target.value;
      this.applyFilters();
      this.updateDisplay();
    });

    // Search functionality
    const searchInput = document.getElementById('log-search');
    searchInput?.addEventListener('input', (e) => {
      this.searchTerm = e.target.value.toLowerCase();
      this.applyFilters();
      this.updateDisplay();
    });

    // Auto-refresh toggle
    const autoRefreshCheckbox = document.getElementById('log-auto-refresh');
    autoRefreshCheckbox?.addEventListener('change', (e) => {
      this.autoRefresh = e.target.checked;
      if (this.autoRefresh) {
        this.startAutoRefresh();
      } else {
        this.stopAutoRefresh();
      }
    });

    // Refresh button
    const refreshButton = document.getElementById('log-refresh');
    refreshButton?.addEventListener('click', () => {
      this.loadLogs();
    });

    // Clear button
    const clearButton = document.getElementById('log-clear');
    clearButton?.addEventListener('click', () => {
      this.clearLogs();
    });

    // Export button
    const exportButton = document.getElementById('log-export');
    exportButton?.addEventListener('click', () => {
      this.exportLogs();
    });

    // Page size change
    const pageSizeSelect = document.getElementById('log-page-size');
    pageSizeSelect?.addEventListener('change', () => {
      this.updateDisplay();
    });
  }

  /**
   * Load logs from the backend
   */
  async loadLogs() {
    try {
      if (window.electronAPI) {
        const logs = await window.electronAPI.invoke('get-recent-logs', 500);
        this.logs = logs || [];
        this.applyFilters();
        this.updateDisplay();
        this.updateLogStats();
      }
    } catch (error) {
      console.error('Failed to load logs:', error);
    }
  }

  /**
   * Apply current filters to logs
   */
  applyFilters() {
    this.filteredLogs = this.logs.filter(log => {
      // Level filter
      if (this.currentFilter !== 'all' && log.level !== this.currentFilter) {
        return false;
      }

      // Search filter
      if (this.searchTerm && !log.message.toLowerCase().includes(this.searchTerm)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Update the log display
   */
  updateDisplay() {
    const logEntries = document.getElementById('log-entries');
    const pageSize = parseInt(document.getElementById('log-page-size', 10)?.value || 100);

    if (!logEntries) {
      return;
    }

    const startIndex = 0; // For now, show latest entries
    const endIndex = Math.min(startIndex + pageSize, this.filteredLogs.length);
    const displayLogs = this.filteredLogs.slice(startIndex, endIndex);

    logEntries.innerHTML = '';

    if (displayLogs.length === 0) {
      logEntries.innerHTML = '<div class="log-entry log-empty">No logs match current filters</div>';
      return;
    }

    for (const log of displayLogs) {
      const logElement = this.createLogEntryElement(log);
      logEntries.appendChild(logElement);
    }

    // Update count
    const logCount = document.getElementById('log-count');
    if (logCount) {
      logCount.textContent = `${this.filteredLogs.length} entries`;
    }

    // Auto-scroll to top for new entries
    logEntries.scrollTop = 0;
  }

  /**
   * Create a log entry DOM element
   */
  createLogEntryElement(log) {
    const logEntry = this.createElement('div', ['log-entry', `log-${log.level}`]);

    const timestamp = new Date(log.timestamp).toLocaleString();
    const component = log.component ? ` [${log.component}]` : '';

    logEntry.innerHTML = `
      <div class="log-header">
        <span class="log-timestamp">${timestamp}</span>
        <span class="log-level">${log.level.toUpperCase()}</span>
        ${component ? `<span class="log-component">${component}</span>` : ''}
      </div>
      <div class="log-message">${this.escapeHtml(log.message)}</div>
      ${log.data && Object.keys(log.data).length > 0 ?
    `<div class="log-data">
          <button class="log-data-toggle">Show Data</button>
          <pre class="log-data-content" style="display: none;">${JSON.stringify(log.data, null, 2)}</pre>
        </div>` : ''
}
    `;

    // Add click handler for data toggle
    const dataToggle = logEntry.querySelector('.log-data-toggle');
    if (dataToggle) {
      dataToggle.addEventListener('click', () => {
        const dataContent = logEntry.querySelector('.log-data-content');
        const isVisible = dataContent.style.display !== 'none';
        dataContent.style.display = isVisible ? 'none' : 'block';
        dataToggle.textContent = isVisible ? 'Show Data' : 'Hide Data';
      });
    }

    return logEntry;
  }

  /**
   * Update log statistics display
   */
  async updateLogStats() {
    try {
      if (window.electronAPI) {
        const stats = await window.electronAPI.invoke('get-log-statistics');
        const statsDetail = document.getElementById('log-stats-detail');

        if (stats && statsDetail) {
          const totalSize = this.formatBytes(stats.totalSize);
          const levelCounts = Object.entries(stats.logCounts)
            .filter(([, count]) => count > 0)
            .map(([level, count]) => `${level}: ${count}`)
            .join(', ');

          statsDetail.textContent = `${totalSize} total | ${levelCounts}`;
        }
      }
    } catch (error) {
      console.error('Failed to load log statistics:', error);
    }
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    if (confirm('Are you sure you want to clear all logs? This action cannot be undone.')) {
      this.logs = [];
      this.filteredLogs = [];
      this.updateDisplay();
    }
  }

  /**
   * Export logs to file
   */
  async exportLogs() {
    try {
      if (window.electronAPI) {
        const format = prompt('Export format (json or csv):', 'json');
        if (!format || !['json', 'csv'].includes(format)) {
          return;
        }

        const exported = await window.electronAPI.invoke('export-logs', null, null, format);
        if (exported) {
          const blob = new Blob([exported], {
            type: format === 'csv' ? 'text/csv' : 'application/json'
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `macro-keyboard-logs-${new Date().toISOString().split('T')[0]}.${format}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      }
    } catch (error) {
      console.error('Failed to export logs:', error);
      alert('Failed to export logs. Please try again.');
    }
  }

  /**
   * Start auto-refresh timer
   */
  startAutoRefresh() {
    this.stopAutoRefresh(); // Clear existing timer

    if (this.autoRefresh) {
      this.refreshInterval = setInterval(() => {
        if (this.isVisible) {
          this.loadLogs();
        }
      }, 5000);
    }
  }

  /**
   * Stop auto-refresh timer
   */
  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  /**
   * Set visibility state (for performance optimization)
   */
  setVisible(visible) {
    this.isVisible = visible;
    if (visible && this.autoRefresh) {
      this.loadLogs();
    }
  }

  /**
   * Format bytes for display
   */
  formatBytes(bytes) {
    if (bytes === 0) {
      return '0 Bytes';
    }
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))  } ${  sizes[i]}`;
  }

  /**
   * Escape HTML for safe display
   */
  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Create DOM element with classes
   */
  createElement(tag, classes = [], content = '') {
    const element = document.createElement(tag);
    if (classes.length > 0) {
      element.classList.add(...classes);
    }
    if (content) {
      element.textContent = content;
    }
    return element;
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.stopAutoRefresh();
    this.logs = [];
    this.filteredLogs = [];

    // Remove event listeners if needed
    if (window.electronAPI && window.electronAPI.removeListener) {
      window.electronAPI.removeListener('log-entry');
    }
  }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.LogViewer = LogViewer;
}
