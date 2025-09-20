# Advanced Logging System

The Macro Keyboard application implements a comprehensive logging system built on top of Winston, providing structured logging, file rotation, remote aggregation, performance monitoring, and real-time log viewing capabilities.

## Features

### Core Logging Features
- **Multiple Log Levels**: Debug, Info, Warning, Error with configurable filtering
- **Structured Logging**: JSON-formatted logs with metadata and context
- **Component Tagging**: Associate logs with specific application components
- **Performance Timing**: Built-in performance measurement and threshold monitoring
- **Error Context**: Rich error information with stack traces and metadata

### File Management
- **Automatic Rotation**: Size-based log file rotation with configurable limits
- **Retention Policies**: Automatic cleanup of old log files
- **Multiple Transports**: Console, file, and remote logging simultaneously
- **Configurable Paths**: Custom log directory and file naming patterns

### Remote Logging
- **HTTP Endpoint Support**: Send logs to remote aggregation services
- **Batching**: Efficient batch processing of log entries
- **Retry Logic**: Automatic retry with exponential backoff
- **Queue Management**: In-memory queuing with overflow protection

### Real-time Features
- **Live Log Viewer**: Browser-based log viewing with filtering and search
- **Event Streaming**: Real-time log events sent to renderer process
- **Statistics Dashboard**: Log counts, sizes, and performance metrics
- **Export Functionality**: JSON and CSV export with date range filtering

## Configuration

### Basic Configuration

```yaml
logging:
  level: 'info'                    # Minimum log level (debug, info, warn, error)
  logDir: 'logs'                   # Log directory path
  
  file:
    maxFileSize: '10MB'            # Maximum size per log file
    maxFiles: 5                    # Number of rotated files to keep
    retentionDays: 30              # Days to keep old log files
    
  console:
    enableConsole: true            # Enable console output
    colorizeConsole: true          # Colorize console logs
```

### Advanced Configuration

```yaml
logging:
  remote:
    enableRemote: false            # Enable remote logging
    remoteEndpoint: 'https://logs.example.com/api/logs'
    batchSize: 100                 # Logs per batch
    flushInterval: 5000            # Milliseconds between batches
    retryAttempts: 3               # Number of retry attempts
    retryDelay: 1000               # Milliseconds between retries
    
  performance:
    enablePerformance: true        # Enable performance timing
    performanceThreshold: 1000     # Warn if operations exceed this (ms)
    
  structured:
    enableStructured: true         # Enable structured JSON logging
    includeMetadata: true          # Include system metadata in logs
```

## Usage

### Basic Logging

```javascript
const logManager = new LogManager(config.logging);
const logger = logManager.getLogger();

// Standard logging
logger.info('Application started');
logger.warn('Configuration migration applied');
logger.error('Failed to connect to device', error);
logger.debug('Button state changed', { buttonId: 1, state: 'pressed' });
```

### Structured Logging

```javascript
// Log with component context
logManager.logWithComponent('SerialManager', 'info', 'Port opened successfully');

// Log with additional data
logManager.logWithData('warn', 'Invalid button configuration', {
  buttonId: 5,
  expectedRange: '1-32',
  receivedValue: 5
});
```

### Performance Monitoring

```javascript
// Start timing an operation
const timerId = logManager.startPerformanceTimer('database-query');

// ... perform operation ...

// End timing and log results
logManager.endPerformanceTimer(timerId, 'User profile loaded');
```

### Real-time Events

```javascript
// Listen for log events (in renderer process)
logManager.on('log-entry', (logData) => {
  console.log('New log entry:', logData);
});

// Get recent logs
const recentLogs = await logManager.getRecentLogs(100);

// Export logs
const exportedData = await logManager.exportLogs(
  '2024-01-01T00:00:00Z',
  '2024-01-31T23:59:59Z',
  'csv'
);
```

## API Reference

### LogManager Class

#### Constructor
```javascript
new LogManager(config)
```
- `config` (Object): Logging configuration object

#### Methods

##### Core Logging
- `getLogger()`: Returns Winston logger instance
- `logWithComponent(component, level, message, data)`: Log with component context
- `logWithData(level, message, data)`: Log with additional data object

##### Performance Monitoring
- `startPerformanceTimer(operationName)`: Start timing operation, returns timer ID
- `endPerformanceTimer(timerId, message, data)`: End timing and log results

##### Log Management
- `getRecentLogs(limit)`: Get recent log entries (async)
- `exportLogs(startDate, endDate, format)`: Export logs in JSON or CSV format
- `clearLogs()`: Clear all stored logs (async)
- `getStatistics()`: Get log statistics and file sizes

##### Configuration
- `updateConfiguration(newConfig)`: Update logging configuration
- `isInitialized()`: Check if LogManager is properly initialized

##### Cleanup
- `cleanup()`: Clean up resources and stop timers

### Log Entry Structure

```javascript
{
  timestamp: '2024-01-15T10:30:00.000Z',
  level: 'info',
  message: 'Operation completed successfully',
  component: 'ActionExecutor',
  data: {
    duration: 150,
    userId: 'user123'
  },
  metadata: {
    hostname: 'mac-pro',
    platform: 'darwin',
    pid: 12345
  }
}
```

## Integration

### Main Process Integration

```javascript
// Initialize LogManager in main process
const LogManager = require('./src/LogManager');
const logManager = new LogManager(config.logging);

// Set up IPC handlers
ipcMain.handle('get-recent-logs', async (event, limit) => {
  return await logManager.getRecentLogs(limit);
});

ipcMain.handle('export-logs', async (event, startDate, endDate, format) => {
  return await logManager.exportLogs(startDate, endDate, format);
});

// Forward log events to renderer
logManager.on('log-entry', (logData) => {
  mainWindow.webContents.send('log-entry', logData);
});
```

### Renderer Process Integration

```javascript
// Access logs through IPC
const recentLogs = await window.electronAPI.invoke('get-recent-logs', 100);

// Listen for real-time log events
window.electronAPI.on('log-entry', (event, logData) => {
  addLogToViewer(logData);
});
```

## Log Viewer UI

The system includes a comprehensive log viewer component with:

### Features
- **Real-time Updates**: Automatically refreshes with new log entries
- **Level Filtering**: Filter by log level (debug, info, warn, error)
- **Search Functionality**: Search log messages and data
- **Export Options**: Export filtered logs to JSON or CSV
- **Pagination**: Handle large numbers of log entries efficiently
- **Data Expansion**: Expand log data objects for detailed inspection

### UI Components
- Filter controls (level, search term)
- Action buttons (refresh, clear, export)
- Log entry display with syntax highlighting
- Pagination controls
- Statistics display (entry count, file sizes)

### Usage
The log viewer is automatically integrated into the main application interface and provides real-time visibility into application behavior for debugging and monitoring.

## File Structure

```
logs/
├── macro-keyboard.log           # Current log file
├── macro-keyboard.log.1         # Rotated log file
├── macro-keyboard.log.2         # Older rotated log file
└── ...
```

## Performance Considerations

### Memory Management
- Log entries are kept in memory with a configurable limit
- Automatic cleanup of old entries prevents memory leaks
- File rotation prevents individual files from growing too large

### Performance Monitoring
- Built-in performance timing for critical operations
- Automatic warnings for operations exceeding thresholds
- Minimal overhead for disabled features

### Remote Logging
- Batched transmission reduces network overhead
- Exponential backoff prevents overwhelming remote services
- Local queuing ensures no log loss during network issues

## Security Considerations

### Data Sanitization
- Automatic sanitization of sensitive data in logs
- Configurable redaction of passwords and tokens
- Structured logging prevents injection attacks

### Remote Transmission
- HTTPS-only for remote log endpoints
- Optional authentication token support
- Rate limiting prevents abuse

### Local Storage
- Secure file permissions on log files
- Automatic rotation prevents disk space exhaustion
- Configurable retention policies for compliance

## Troubleshooting

### Common Issues

#### High Disk Usage
- Check `maxFileSize` and `maxFiles` configuration
- Verify `retentionDays` setting for automatic cleanup
- Monitor log level to reduce verbosity

#### Missing Logs
- Verify log directory permissions
- Check `level` configuration for filtering
- Ensure LogManager initialization completed successfully

#### Performance Issues
- Disable remote logging if not needed
- Reduce `batchSize` for remote logging
- Increase `performanceThreshold` to reduce warnings

#### Remote Logging Failures
- Verify `remoteEndpoint` URL accessibility
- Check authentication credentials if required
- Monitor network connectivity and retry settings

### Debugging

```javascript
// Enable debug logging
const config = { level: 'debug' };
const logManager = new LogManager(config);

// Check initialization status
if (!logManager.isInitialized()) {
  console.error('LogManager initialization failed');
}

// Monitor statistics
const stats = logManager.getStatistics();
console.log('Log statistics:', stats);
```

## Best Practices

### Logging Levels
- **Debug**: Detailed information for development and troubleshooting
- **Info**: General application flow and state changes
- **Warn**: Warning conditions that don't prevent operation
- **Error**: Error conditions that require attention

### Message Formatting
- Use clear, descriptive messages
- Include relevant context in structured data
- Avoid logging sensitive information (passwords, tokens)
- Use consistent terminology across components

### Performance
- Use appropriate log levels to control verbosity
- Include performance timing for critical operations
- Monitor log file sizes and adjust rotation settings
- Consider remote logging impact on application performance

### Maintenance
- Regularly review log retention policies
- Monitor disk usage for log storage
- Update remote logging endpoints as needed
- Test log export functionality periodically