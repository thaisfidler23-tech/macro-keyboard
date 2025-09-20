# Performance Monitoring System

## Overview

The Performance Monitoring System provides comprehensive real-time performance monitoring, metrics collection, and optimization guidance for the Macro Keyboard application. It includes system resource monitoring, application performance tracking, and proactive optimization suggestions.

## Features

### Core Monitoring Capabilities
- **System Metrics**: Real-time monitoring of memory usage, CPU utilization, and system resources
- **Event Loop Monitoring**: Detection of event loop lag and blocking operations
- **Garbage Collection Tracking**: GC pause times, frequency, and performance impact
- **Operation Timing**: Performance tracking of specific application operations
- **Memory Leak Detection**: Trend analysis and early warning for memory issues

### Performance Dashboard
- **Real-time Metrics Display**: Live updating charts and gauges for system performance
- **Historical Trends**: Time-series data visualization for performance analysis
- **Performance Alerts**: Configurable thresholds with visual and desktop notifications
- **Optimization Suggestions**: AI-driven recommendations for performance improvements
- **Data Export**: JSON and CSV export for external analysis tools

### Alert System
- **Threshold-based Alerts**: Configurable warning and critical thresholds
- **Smart Notifications**: Prevents alert spam with cooldown periods
- **Categorized Alerts**: Memory, CPU, event loop, and operation-specific alerts
- **Escalation Levels**: Warning, critical, and recovery notifications

## Configuration

### Basic Configuration
```yaml
performance:
  enabled: true             # Enable performance monitoring
  updateInterval: 1000      # Metrics collection interval (ms)
  historyLimit: 1000        # Number of historical data points to keep
  enableGC: true            # Monitor garbage collection metrics
  enableOperations: true    # Track operation performance
  enableOptimizations: true # Generate optimization suggestions
```

### Threshold Configuration
```yaml
performance:
  thresholds:
    memory: 1073741824      # Memory warning threshold (1GB in bytes)
    eventLoopLag: 100       # Event loop lag warning threshold (ms)
    operationTime: 500      # Operation time warning threshold (ms)
    gcDuration: 50          # GC duration warning threshold (ms)
```

### Alert Configuration
```yaml
performance:
  alerts:
    enabled: true           # Enable performance alerts
    showNotifications: true # Show desktop notifications for critical alerts
    criticalThresholds:
      memory: 2147483648    # Critical memory threshold (2GB in bytes)
      eventLoopLag: 1000    # Critical event loop lag (ms)
      operationTime: 2000   # Critical operation time (ms)
```

### Data Retention
```yaml
performance:
  retention:
    enabled: true           # Enable automatic data cleanup
    maxAge: 86400000        # Maximum age of performance data (24 hours in ms)
    cleanupInterval: 3600000 # Cleanup check interval (1 hour in ms)
```

## API Reference

### PerformanceMonitor Class

#### Constructor
```javascript
const monitor = new PerformanceMonitor(config, logManager);
```

#### Methods

##### `startMonitoring()`
Starts performance monitoring with automatic metric collection.

##### `stopMonitoring()`
Stops performance monitoring and cleans up resources.

##### `startTimer(operationName, context = {})`
Starts timing a specific operation.
- `operationName`: Unique identifier for the operation
- `context`: Optional context data (component, user, etc.)
- Returns: Timer ID for ending the operation

##### `endTimer(timerId, additionalContext = {})`
Ends timing for a specific operation.
- `timerId`: Timer ID returned from `startTimer`
- `additionalContext`: Additional context to add to the timing record

##### `getCurrentMetrics()`
Returns current system and application metrics.

##### `getStatistics()`
Returns aggregated performance statistics.

##### `getOptimizationSuggestions()`
Returns array of optimization suggestions based on current performance data.

##### `exportData(format = 'json', timeRange = null)`
Exports performance data in JSON or CSV format.
- `format`: 'json' or 'csv'
- `timeRange`: Optional time range object with start/end dates

##### `updateConfiguration(newConfig)`
Updates monitoring configuration and restarts monitoring if needed.

#### Events

##### `metrics-updated`
Emitted when new metrics are collected (every update interval).
```javascript
monitor.on('metrics-updated', (metrics) => {
  console.log('New metrics:', metrics);
});
```

##### `performance-alert`
Emitted when performance thresholds are exceeded.
```javascript
monitor.on('performance-alert', (alert) => {
  console.log('Performance alert:', alert.message);
});
```

##### `optimization-suggestion`
Emitted when new optimization suggestions are generated.
```javascript
monitor.on('optimization-suggestion', (suggestion) => {
  console.log('Optimization suggestion:', suggestion.description);
});
```

## Usage Examples

### Basic Monitoring Setup
```javascript
const PerformanceMonitor = require('./PerformanceMonitor');
const LogManager = require('./LogManager');

const logManager = new LogManager();
const monitor = new PerformanceMonitor({
  enabled: true,
  updateInterval: 5000,
  enableGC: true
}, logManager);

// Start monitoring
monitor.startMonitoring();

// Listen for alerts
monitor.on('performance-alert', (alert) => {
  console.warn(`Performance Alert: ${alert.message}`);
});
```

### Operation Timing
```javascript
// Time a specific operation
const timerId = monitor.startTimer('config-save', {
  component: 'ConfigManager',
  user: 'user123'
});

try {
  // Perform the operation
  await saveConfiguration(config);
} finally {
  // Always end the timer
  monitor.endTimer(timerId, { success: true });
}
```

### Dashboard Integration
```javascript
// Set up real-time dashboard updates
monitor.on('metrics-updated', (metrics) => {
  updateDashboard({
    memoryUsage: metrics.system.memory.used,
    eventLoopLag: metrics.system.eventLoop.lag,
    gcPauses: metrics.gc.recent
  });
});
```

### Data Export
```javascript
// Export performance data for analysis
const jsonData = monitor.exportData('json', {
  start: new Date('2023-01-01'),
  end: new Date('2023-12-31')
});

// Save to file
fs.writeFileSync('performance-data.json', jsonData);
```

## Performance Dashboard UI

### Components
- **Control Panel**: Start/stop monitoring, configure intervals, export data
- **Metric Cards**: Current values for key performance indicators
- **Real-time Charts**: Memory usage and event loop lag trends
- **Performance Table**: Recent operations with timing and statistics
- **Alerts Panel**: Active alerts with severity indicators
- **Suggestions Panel**: Optimization recommendations with actions

### Chart Features
- **Memory Usage Chart**: RSS, heap used/total, external memory over time
- **Event Loop Lag Chart**: Real-time event loop responsiveness
- **Operation Performance**: Average, min, max operation times
- **GC Impact**: Garbage collection frequency and pause times

### Alert Categories
- **Memory Alerts**: High memory usage, potential leaks, fragmentation
- **Performance Alerts**: Slow operations, event loop blocking, high CPU
- **GC Alerts**: Frequent collections, long pause times, heap pressure
- **System Alerts**: Low free memory, high system load, resource limits

## Optimization Suggestions

### Memory Optimization
- Detect memory leaks through trend analysis
- Identify large object allocations
- Suggest garbage collection tuning
- Recommend memory pool usage

### Performance Optimization
- Identify slow operations for optimization
- Detect event loop blocking patterns
- Suggest asynchronous alternatives
- Recommend caching strategies

### Resource Optimization
- Monitor system resource utilization
- Suggest process scheduling improvements
- Recommend resource limits
- Identify I/O bottlenecks

## Integration Points

### Main Process Integration
- Automatic initialization with LogManager
- IPC handlers for renderer communication
- Real-time event forwarding to UI
- Configuration management integration

### Renderer Integration
- Performance dashboard UI components
- Real-time chart updates
- Alert notification system
- Data export functionality

### Configuration Integration
- YAML configuration support
- Hot-reload capability
- Environment-specific settings
- Runtime configuration updates

## Best Practices

### Monitoring Configuration
1. Set reasonable update intervals (1-5 seconds for development, 10-30 seconds for production)
2. Configure appropriate thresholds for your application's normal performance
3. Enable GC monitoring only when needed (has small overhead)
4. Limit historical data retention to prevent memory growth

### Performance Impact
- Minimal overhead in production (< 1% CPU, < 10MB memory)
- Configurable collection intervals to balance accuracy vs. overhead
- Automatic cleanup of historical data
- Efficient event-based architecture

### Alert Management
- Set appropriate thresholds to avoid false positives
- Use alert cooldowns to prevent notification spam
- Configure different thresholds for different environments
- Monitor alert effectiveness and adjust thresholds over time

## Troubleshooting

### Common Issues

#### High Memory Usage in Performance Monitor
- Reduce `historyLimit` in configuration
- Decrease data retention period
- Check for memory leaks in custom metrics collectors

#### Missing GC Metrics
- Ensure Node.js version supports PerformanceObserver API (v8.5+)
- Check that `enableGC` is true in configuration
- Verify PerformanceObserver is available in environment

#### Performance Impact
- Increase collection interval for production use
- Disable detailed operation tracking if not needed
- Reduce historical data retention
- Check for event listener leaks

#### Alert Configuration
- Verify thresholds are appropriate for system capacity
- Check alert cooldown periods
- Ensure proper event listener setup
- Monitor alert accuracy over time

### Debugging
Enable debug logging to troubleshoot issues:
```javascript
const monitor = new PerformanceMonitor({
  debug: true,
  logLevel: 'debug'
}, logManager);
```

### Performance Monitoring Best Practices
1. Monitor baseline performance during normal operation
2. Set thresholds based on historical data analysis
3. Regularly review and adjust monitoring configuration
4. Use performance data to guide optimization efforts
5. Implement automated alerts for critical performance issues

## Future Enhancements

### Planned Features
- Machine learning-based anomaly detection
- Automated performance regression detection
- Integration with external monitoring systems
- Performance profiling and flame graph generation
- Custom metric collection framework
- Performance budgets and SLA monitoring

### Integration Opportunities
- APM (Application Performance Monitoring) tools
- Time-series databases (InfluxDB, Prometheus)
- Alerting platforms (PagerDuty, Slack)
- CI/CD performance testing integration
- Docker and container metrics
- Cloud platform monitoring integration