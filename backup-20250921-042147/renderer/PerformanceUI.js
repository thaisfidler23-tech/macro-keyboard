/**
 * PerformanceUI - Real-time performance monitoring dashboard
 * Provides visual performance metrics, charts, and optimization suggestions
 */
class PerformanceUI {
  constructor() {
    this.isInitialized = false;
    this.isVisible = false;
    this.charts = {};
    this.refreshInterval = null;
    this.metricsHistory = {
      memory: [],
      cpu: [],
      eventLoop: [],
      operations: []
    };

    this.maxHistoryPoints = 50; // Keep last 50 data points for charts
    this.refreshRate = 2000; // Update every 2 seconds

    this.init();
  }

  /**
   * Initialize the performance UI components
   */
  init() {
    if (this.isInitialized) {
      return;
    }

    this.setupEventListeners();
    this.isInitialized = true;
    console.log('PerformanceUI initialized');
  }

  /**
   * Set up IPC event listeners for performance data
   */
  setupEventListeners() {
    if (window.electronAPI) {
      // Listen for real-time performance updates
      window.electronAPI.on('system-metrics', (event, metrics) => {
        this.updateSystemMetrics(metrics);
      });

      window.electronAPI.on('performance-measurement', (event, measurement) => {
        this.updateOperationMetrics(measurement);
      });

      window.electronAPI.on('event-loop-lag', (event, lagData) => {
        this.updateEventLoopMetrics(lagData);
      });

      window.electronAPI.on('performance-alert', (event, alert) => {
        this.showPerformanceAlert(alert);
      });

      window.electronAPI.on('optimization-suggestions', (event, suggestions) => {
        this.updateOptimizationSuggestions(suggestions);
      });
    }
  }

  /**
   * Render the performance dashboard
   */
  async renderPerformanceDashboard() {
    const mainContent = document.querySelector('.container');
    if (!mainContent) {
      return;
    }

    // Create performance dashboard container
    const performanceContainer = this.createElement('div', ['performance-dashboard']);
    performanceContainer.innerHTML = `
      <div class="performance-section">
        <h3>Performance Monitoring</h3>

        <!-- Control Panel -->
        <div class="performance-controls">
          <div class="controls-row">
            <button id="perf-start-monitoring" class="btn btn-primary">
              <span class="icon">▶️</span> Start Monitoring
            </button>
            <button id="perf-stop-monitoring" class="btn btn-secondary" disabled>
              <span class="icon">⏹️</span> Stop Monitoring
            </button>
            <button id="perf-export-data" class="btn btn-secondary">
              <span class="icon">💾</span> Export Data
            </button>
            <button id="perf-clear-data" class="btn btn-secondary">
              <span class="icon">🗑️</span> Clear Data
            </button>
          </div>

          <div class="controls-row">
            <div class="control-group">
              <label for="perf-refresh-rate">Update Rate:</label>
              <select id="perf-refresh-rate">
                <option value="1000">1 second</option>
                <option value="2000" selected>2 seconds</option>
                <option value="5000">5 seconds</option>
                <option value="10000">10 seconds</option>
              </select>
            </div>

            <div class="perf-status">
              <span id="perf-status-indicator" class="status-indicator unknown">●</span>
              <span id="perf-status-text">Unknown</span>
            </div>
          </div>
        </div>

        <!-- Metrics Overview -->
        <div class="performance-overview">
          <div class="metric-card">
            <h4>Memory Usage</h4>
            <div id="memory-current" class="metric-value">--</div>
            <div id="memory-trend" class="metric-trend"></div>
          </div>

          <div class="metric-card">
            <h4>Event Loop Lag</h4>
            <div id="eventloop-current" class="metric-value">--</div>
            <div id="eventloop-trend" class="metric-trend"></div>
          </div>

          <div class="metric-card">
            <h4>Active Operations</h4>
            <div id="operations-current" class="metric-value">--</div>
            <div id="operations-trend" class="metric-trend"></div>
          </div>

          <div class="metric-card">
            <h4>Suggestions</h4>
            <div id="suggestions-current" class="metric-value">--</div>
            <div id="suggestions-trend" class="metric-trend"></div>
          </div>
        </div>

        <!-- Charts Container -->
        <div class="performance-charts">
          <div class="chart-section">
            <h4>Memory Usage Over Time</h4>
            <canvas id="memory-chart" width="800" height="200"></canvas>
          </div>

          <div class="chart-section">
            <h4>Event Loop Lag</h4>
            <canvas id="eventloop-chart" width="800" height="200"></canvas>
          </div>

          <div class="chart-section">
            <h4>Operation Performance</h4>
            <div id="operations-table" class="operations-table"></div>
          </div>
        </div>

        <!-- Optimization Suggestions -->
        <div class="optimization-suggestions">
          <h4>Optimization Suggestions</h4>
          <div id="suggestions-container" class="suggestions-container">
            <p class="no-suggestions">No suggestions available. Start monitoring to see recommendations.</p>
          </div>
        </div>

        <!-- Performance Alerts -->
        <div id="performance-alerts" class="performance-alerts"></div>
      </div>
    `;

    mainContent.appendChild(performanceContainer);
    this.setupPerformanceEventHandlers();
    this.initializeCharts();
    await this.loadInitialData();
  }

  /**
   * Set up event handlers for performance UI controls
   */
  setupPerformanceEventHandlers() {
    // Start monitoring
    const startBtn = document.getElementById('perf-start-monitoring');
    startBtn?.addEventListener('click', async() => {
      try {
        await window.electronAPI.invoke('start-performance-monitoring');
        this.updateMonitoringStatus(true);
      } catch (error) {
        console.error('Failed to start performance monitoring:', error);
      }
    });

    // Stop monitoring
    const stopBtn = document.getElementById('perf-stop-monitoring');
    stopBtn?.addEventListener('click', async() => {
      try {
        await window.electronAPI.invoke('stop-performance-monitoring');
        this.updateMonitoringStatus(false);
      } catch (error) {
        console.error('Failed to stop performance monitoring:', error);
      }
    });

    // Export data
    const exportBtn = document.getElementById('perf-export-data');
    exportBtn?.addEventListener('click', () => {
      this.exportPerformanceData();
    });

    // Clear data
    const clearBtn = document.getElementById('perf-clear-data');
    clearBtn?.addEventListener('click', () => {
      this.clearPerformanceData();
    });

    // Refresh rate change
    const refreshRateSelect = document.getElementById('perf-refresh-rate');
    refreshRateSelect?.addEventListener('change', (e) => {
      this.refreshRate = parseInt(e.target.value, 10);
      this.restartRefreshTimer();
    });
  }

  /**
   * Initialize performance charts
   */
  initializeCharts() {
    try {
      // Memory usage chart
      const memoryCanvas = document.getElementById('memory-chart');
      if (memoryCanvas) {
        this.charts.memory = this.createChart(memoryCanvas, {
          type: 'line',
          data: {
            labels: [],
            datasets: [{
              label: 'Heap Used (MB)',
              data: [],
              borderColor: '#3b82f6',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              tension: 0.4
            }, {
              label: 'RSS (MB)',
              data: [],
              borderColor: '#ef4444',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              tension: 0.4
            }]
          },
          options: this.getChartOptions('Memory Usage (MB)')
        });
      }

      // Event loop lag chart
      const eventLoopCanvas = document.getElementById('eventloop-chart');
      if (eventLoopCanvas) {
        this.charts.eventLoop = this.createChart(eventLoopCanvas, {
          type: 'line',
          data: {
            labels: [],
            datasets: [{
              label: 'Event Loop Lag (ms)',
              data: [],
              borderColor: '#f59e0b',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              tension: 0.4
            }]
          },
          options: this.getChartOptions('Event Loop Lag (ms)')
        });
      }
    } catch (error) {
      console.error('Failed to initialize charts:', error);
    }
  }

  /**
   * Create a chart with simplified canvas rendering
   */
  createChart(canvas, config) {
    const ctx = canvas.getContext('2d');

    return {
      canvas,
      ctx,
      config,
      update: () => this.updateCanvasChart(canvas, config)
    };
  }

  /**
   * Update canvas chart with simple line drawing
   */
  updateCanvasChart(canvas, config) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = '#e9ecef';
    ctx.lineWidth = 1;

    // Vertical grid lines
    for (let i = 0; i <= 10; i++) {
      const x = (width / 10) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = (height / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw data lines
    for (const dataset of config.data.datasets) {
      if (dataset.data.length < 2) {
        continue;
      }

      ctx.strokeStyle = dataset.borderColor;
      ctx.lineWidth = 2;
      ctx.beginPath();

      const maxValue = Math.max(...dataset.data) || 1;

      for (let i = 0; i < dataset.data.length; i++) {
        const x = (width / (dataset.data.length - 1)) * i;
        const y = height - (dataset.data[i] / maxValue) * height;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
    }
  }

  /**
   * Get common chart options
   */
  getChartOptions(title) {
    return {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: title
        }
      },
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: 'Time'
          }
        },
        y: {
          display: true,
          title: {
            display: true,
            text: 'Value'
          }
        }
      }
    };
  }

  /**
   * Load initial performance data
   */
  async loadInitialData() {
    try {
      if (window.electronAPI) {
        const statistics = await window.electronAPI.invoke('get-performance-statistics');
        this.updatePerformanceOverview(statistics);

        const status = await window.electronAPI.invoke('get-performance-status');
        this.updateMonitoringStatus(status.isActive);
      }
    } catch (error) {
      console.error('Failed to load initial performance data:', error);
    }
  }

  /**
   * Update system metrics display and charts
   */
  updateSystemMetrics(metrics) {
    // Add to history
    this.metricsHistory.memory.push({
      timestamp: metrics.timestamp,
      heapUsed: metrics.memory.heapUsed / 1024 / 1024, // Convert to MB
      rss: metrics.memory.rss / 1024 / 1024
    });

    // Limit history size
    if (this.metricsHistory.memory.length > this.maxHistoryPoints) {
      this.metricsHistory.memory.shift();
    }

    // Update current memory display
    const memoryCurrentElement = document.getElementById('memory-current');
    if (memoryCurrentElement) {
      memoryCurrentElement.textContent = this.formatBytes(metrics.memory.heapUsed);
    }

    // Update memory chart
    if (this.charts.memory) {
      const dataset = this.charts.memory.config.data.datasets[0];
      dataset.data = this.metricsHistory.memory.map(m => m.heapUsed);
      this.charts.memory.update();
    }
  }

  /**
   * Update event loop metrics display
   */
  updateEventLoopMetrics(lagData) {
    // Add to history
    this.metricsHistory.eventLoop.push({
      timestamp: lagData.timestamp,
      lag: lagData.lag
    });

    // Limit history size
    if (this.metricsHistory.eventLoop.length > this.maxHistoryPoints) {
      this.metricsHistory.eventLoop.shift();
    }

    // Update current lag display
    const lagCurrentElement = document.getElementById('eventloop-current');
    if (lagCurrentElement) {
      lagCurrentElement.textContent = `${lagData.lag.toFixed(2)}ms`;

      // Color code based on lag severity
      if (lagData.lag > 100) {
        lagCurrentElement.className = 'metric-value high';
      } else if (lagData.lag > 50) {
        lagCurrentElement.className = 'metric-value medium';
      } else {
        lagCurrentElement.className = 'metric-value normal';
      }
    }

    // Update event loop chart
    if (this.charts.eventLoop) {
      const dataset = this.charts.eventLoop.config.data.datasets[0];
      dataset.data = this.metricsHistory.eventLoop.map(e => e.lag);
      this.charts.eventLoop.update();
    }
  }

  /**
   * Update operation metrics display
   */
  updateOperationMetrics(measurement) {
    // Add to history
    this.metricsHistory.operations.push(measurement);

    // Limit history size
    if (this.metricsHistory.operations.length > 100) {
      this.metricsHistory.operations.shift();
    }

    // Update operations table
    this.updateOperationsTable();
  }

  /**
   * Update operations performance table
   */
  updateOperationsTable() {
    const operationsTable = document.getElementById('operations-table');
    if (!operationsTable) {
      return;
    }

    // Group operations by name and calculate stats
    const operationStats = new Map();

    for (const op of this.metricsHistory.operations) {
      if (!operationStats.has(op.operation)) {
        operationStats.set(op.operation, {
          count: 0,
          totalDuration: 0,
          minDuration: Infinity,
          maxDuration: 0,
          recentDuration: []
        });
      }

      const stats = operationStats.get(op.operation);
      stats.count++;
      stats.totalDuration += op.duration;
      stats.minDuration = Math.min(stats.minDuration, op.duration);
      stats.maxDuration = Math.max(stats.maxDuration, op.duration);
      stats.recentDuration.push(op.duration);

      // Keep only recent 10 durations
      if (stats.recentDuration.length > 10) {
        stats.recentDuration.shift();
      }
    }

    // Create table HTML
    let tableHTML = `
      <table class="performance-table">
        <thead>
          <tr>
            <th>Operation</th>
            <th>Count</th>
            <th>Avg Duration</th>
            <th>Min Duration</th>
            <th>Max Duration</th>
            <th>Recent Trend</th>
          </tr>
        </thead>
        <tbody>
    `;

    // Sort by average duration (descending)
    const sortedStats = Array.from(operationStats.entries())
      .sort(([, a], [, b]) => (b.totalDuration / b.count) - (a.totalDuration / a.count));

    for (const [operationName, stats] of sortedStats.slice(0, 10)) {
      const avgDuration = stats.totalDuration / stats.count;
      const recentAvg = stats.recentDuration.reduce((sum, d) => sum + d, 0) / stats.recentDuration.length;
      const trend = recentAvg > avgDuration ? '📈' : recentAvg < avgDuration ? '📉' : '➡️';

      tableHTML += `
        <tr>
          <td class="operation-name">${operationName}</td>
          <td>${stats.count}</td>
          <td>${avgDuration.toFixed(2)}ms</td>
          <td>${stats.minDuration.toFixed(2)}ms</td>
          <td>${stats.maxDuration.toFixed(2)}ms</td>
          <td class="trend">${trend}</td>
        </tr>
      `;
    }

    tableHTML += '</tbody></table>';
    operationsTable.innerHTML = tableHTML;
  }

  /**
   * Show performance alert
   */
  showPerformanceAlert(alert) {
    const alertsContainer = document.getElementById('performance-alerts');
    if (!alertsContainer) {
      return;
    }

    const alertElement = this.createElement('div', ['alert', `alert-${alert.severity}`]);
    alertElement.innerHTML = `
      <div class="alert-header">
        <span class="alert-icon">${this.getAlertIcon(alert.severity)}</span>
        <span class="alert-title">${alert.type.toUpperCase()} Alert</span>
        <button class="alert-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
      <div class="alert-message">${alert.message}</div>
      <div class="alert-details">
        Value: ${this.formatAlertValue(alert.value, alert.type)} |
        Threshold: ${this.formatAlertValue(alert.threshold, alert.type)}
      </div>
    `;

    // Add to container
    alertsContainer.appendChild(alertElement);

    // Auto-remove after 10 seconds for warnings, 30 seconds for critical
    const autoRemoveDelay = alert.severity === 'critical' ? 30000 : 10000;
    setTimeout(() => {
      if (alertElement.parentElement) {
        alertElement.remove();
      }
    }, autoRemoveDelay);
  }

  /**
   * Update optimization suggestions display
   */
  updateOptimizationSuggestions(suggestions) {
    const suggestionsContainer = document.getElementById('suggestions-container');
    if (!suggestionsContainer) {
      return;
    }

    if (suggestions.length === 0) {
      suggestionsContainer.innerHTML = '<p class="no-suggestions">No optimization suggestions at this time.</p>';
      return;
    }

    let suggestionsHTML = '';

    for (const suggestion of suggestions) {
      suggestionsHTML += `
        <div class="suggestion-card ${suggestion.severity}">
          <div class="suggestion-header">
            <span class="suggestion-icon">${this.getSuggestionIcon(suggestion.type)}</span>
            <h5 class="suggestion-title">${suggestion.title}</h5>
            <span class="suggestion-severity">${suggestion.severity.toUpperCase()}</span>
          </div>
          <div class="suggestion-description">${suggestion.description}</div>
          <div class="suggestion-recommendation">
            <strong>Recommendation:</strong> ${suggestion.recommendation}
          </div>
        </div>
      `;
    }

    suggestionsContainer.innerHTML = suggestionsHTML;

    // Update suggestions count
    const suggestionsCurrentElement = document.getElementById('suggestions-current');
    if (suggestionsCurrentElement) {
      suggestionsCurrentElement.textContent = suggestions.length.toString();
    }
  }

  /**
   * Update performance overview metrics
   */
  updatePerformanceOverview(statistics) {
    if (!statistics) {
      return;
    }

    // Update active operations count
    const operationsCurrentElement = document.getElementById('operations-current');
    if (operationsCurrentElement) {
      operationsCurrentElement.textContent = statistics.totals.activeTimers.toString();
    }

    // Update other overview metrics as needed
    if (statistics.current) {
      // Update memory if available
      if (statistics.current.memory) {
        const memoryCurrentElement = document.getElementById('memory-current');
        if (memoryCurrentElement) {
          memoryCurrentElement.textContent = this.formatBytes(statistics.current.memory.heapUsed);
        }
      }

      // Update event loop lag if available
      const lagCurrentElement = document.getElementById('eventloop-current');
      if (lagCurrentElement) {
        lagCurrentElement.textContent = `${statistics.current.eventLoopLag.toFixed(2)}ms`;
      }
    }
  }

  /**
   * Update monitoring status indicators
   */
  updateMonitoringStatus(isActive) {
    const statusIndicator = document.getElementById('perf-status-indicator');
    const statusText = document.getElementById('perf-status-text');
    const startBtn = document.getElementById('perf-start-monitoring');
    const stopBtn = document.getElementById('perf-stop-monitoring');

    if (statusIndicator && statusText) {
      if (isActive) {
        statusIndicator.className = 'status-indicator active';
        statusText.textContent = 'Active';
        startBtn && (startBtn.disabled = true);
        stopBtn && (stopBtn.disabled = false);

        // Start refresh timer
        this.startRefreshTimer();
      } else {
        statusIndicator.className = 'status-indicator inactive';
        statusText.textContent = 'Inactive';
        startBtn && (startBtn.disabled = false);
        stopBtn && (stopBtn.disabled = true);

        // Stop refresh timer
        this.stopRefreshTimer();
      }
    }
  }

  /**
   * Start performance data refresh timer
   */
  startRefreshTimer() {
    this.stopRefreshTimer(); // Clear existing timer

    this.refreshInterval = setInterval(async() => {
      try {
        const statistics = await window.electronAPI.invoke('get-performance-statistics');
        this.updatePerformanceOverview(statistics);
      } catch (error) {
        console.error('Failed to refresh performance data:', error);
      }
    }, this.refreshRate);
  }

  /**
   * Stop performance data refresh timer
   */
  stopRefreshTimer() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  /**
   * Restart refresh timer with new rate
   */
  restartRefreshTimer() {
    if (this.refreshInterval) {
      this.startRefreshTimer();
    }
  }

  /**
   * Export performance data
   */
  async exportPerformanceData() {
    try {
      const format = prompt('Export format (json or csv):', 'json');
      if (!format || !['json', 'csv'].includes(format)) {
        return;
      }

      const exported = await window.electronAPI.invoke('export-performance-data', format);
      if (exported) {
        const blob = new Blob([exported], {
          type: format === 'csv' ? 'text/csv' : 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `performance-data-${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to export performance data:', error);
      alert('Failed to export performance data. Please try again.');
    }
  }

  /**
   * Clear performance data
   */
  clearPerformanceData() {
    if (confirm('Are you sure you want to clear all performance data? This action cannot be undone.')) {
      // Clear local history
      this.metricsHistory.memory = [];
      this.metricsHistory.cpu = [];
      this.metricsHistory.eventLoop = [];
      this.metricsHistory.operations = [];

      // Update charts
      for (const chart of Object.values(this.charts)) {
        if (chart.config && chart.config.data) {
          for (const dataset of chart.config.data.datasets) {
            dataset.data = [];
          }
          chart.update();
        }
      }

      // Update displays
      this.updateOperationsTable();

      // Clear backend data
      if (window.electronAPI) {
        window.electronAPI.invoke('clear-performance-data').catch(error => {
          console.error('Failed to clear backend performance data:', error);
        });
      }
    }
  }

  /**
   * Get alert icon based on severity
   */
  getAlertIcon(severity) {
    const icons = {
      warning: '⚠️',
      critical: '🚨',
      info: 'ℹ️'
    };
    return icons[severity] || '⚠️';
  }

  /**
   * Get suggestion icon based on type
   */
  getSuggestionIcon(type) {
    const icons = {
      'memory-leak': '🧠',
      'slow-operation': '🐌',
      'event-loop-lag': '⏱️',
      'gc-frequency': '🗑️'
    };
    return icons[type] || '💡';
  }

  /**
   * Format alert values for display
   */
  formatAlertValue(value, type) {
    if (type === 'memory') {
      return this.formatBytes(value);
    } else if (type === 'eventLoop') {
      return `${value.toFixed(2)}ms`;
    }
    return value.toString();
  }

  /**
   * Format bytes for human-readable display
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
   * Set visibility state
   */
  setVisible(visible) {
    this.isVisible = visible;

    if (visible) {
      this.loadInitialData();
      if (this.refreshInterval) {
        this.startRefreshTimer();
      }
    } else {
      this.stopRefreshTimer();
    }
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.stopRefreshTimer();

    // Clear metrics history
    this.metricsHistory.memory = [];
    this.metricsHistory.cpu = [];
    this.metricsHistory.eventLoop = [];
    this.metricsHistory.operations = [];

    // Clear charts
    this.charts = {};

    // Remove event listeners
    if (window.electronAPI && window.electronAPI.removeListener) {
      window.electronAPI.removeListener('system-metrics');
      window.electronAPI.removeListener('performance-measurement');
      window.electronAPI.removeListener('event-loop-lag');
      window.electronAPI.removeListener('performance-alert');
      window.electronAPI.removeListener('optimization-suggestions');
    }

    this.isInitialized = false;
  }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.PerformanceUI = PerformanceUI;
}
